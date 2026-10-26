-- LOVORA starter database schema for Supabase
-- Run this in Supabase SQL Editor in a NEW project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'LOVORA member' check (char_length(display_name) between 1 and 40),
  age int not null check (age >= 18 and age <= 99),
  city text default '',
  bio text default '' check (char_length(bio) <= 500),
  interests text[] not null default '{}',
  photo_url text,
  is_verified boolean not null default false,
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'like' check (kind in ('like','super')),
  created_at timestamptz not null default now(),
  unique(from_user,to_user),
  check(from_user <> to_user)
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check(user_a <> user_b),
  unique(user_a,user_b)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(char_length(reason) between 3 and 1000),
  status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check(reporter_id <> reported_user_id)
);
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id <> blocked_id)
);
alter table public.profiles enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

create policy "Profiles visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "Members create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Members update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Members see likes they sent or received" on public.likes for select to authenticated using (auth.uid() = from_user or auth.uid() = to_user);
create policy "Members send likes as themselves" on public.likes for insert to authenticated with check (auth.uid() = from_user);
create policy "Members see their matches" on public.matches for select to authenticated using (auth.uid() = user_a or auth.uid() = user_b);
create policy "Members create match involving themselves" on public.matches for insert to authenticated with check (auth.uid() = user_a or auth.uid() = user_b);
create policy "Members see messages in their matches" on public.messages for select to authenticated using (
  exists(select 1 from public.matches m where m.id::text = messages.match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
);
create policy "Members send messages as themselves" on public.messages for insert to authenticated with check (
  auth.uid() = sender_id and exists(select 1 from public.matches m where m.id::text = messages.match_id and (m.user_a = auth.uid() or m.user_b = auth.uid()))
);
create policy "Members submit reports as themselves" on public.reports for insert to authenticated with check(auth.uid() = reporter_id);
create policy "Members see their own reports" on public.reports for select to authenticated using(auth.uid() = reporter_id);
create policy "Members manage own blocks" on public.blocks for select to authenticated using(auth.uid() = blocker_id);
create policy "Members block others as themselves" on public.blocks for insert to authenticated with check(auth.uid() = blocker_id);
create policy "Members unblock others as themselves" on public.blocks for delete to authenticated using(auth.uid() = blocker_id);

-- NOTE: Production review required. Before launch, tighten profile visibility,
-- match creation, message access, moderation/admin policies, and payment entitlement.
