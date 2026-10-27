-- LOVORA optional platform-feature foundation (additive tables only).
-- IMPORTANT: This file does NOT alter existing profiles, likes, matches, or messages.
-- Review against the live Supabase schema before running. Run in a test project first.
create extension if not exists pgcrypto;

create table if not exists public.lovora_communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  category text not null default 'general',
  is_private boolean not null default false,
  rules text not null default '' check (char_length(rules) <= 3000),
  is_premium boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.lovora_communities add column if not exists rules text not null default '';
alter table public.lovora_communities add column if not exists is_premium boolean not null default false;
create table if not exists public.lovora_community_members (
  community_id uuid not null references public.lovora_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','moderator','owner')),
  joined_at timestamptz not null default now(),
  primary key (community_id,user_id)
);
create table if not exists public.lovora_community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.lovora_communities(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.lovora_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 60),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.lovora_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','in_review','approved','rejected','cancelled')),
  provider_reference text,
  reviewer_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create table if not exists public.lovora_account_violations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  summary text not null check (char_length(summary) between 1 and 1000),
  severity text not null default 'notice' check (severity in ('notice','warning','restriction','suspension')),
  status text not null default 'active' check (status in ('active','appealed','overturned','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create table if not exists public.lovora_wallet_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.lovora_coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount <> 0),
  transaction_type text not null check (transaction_type in ('purchase','gift_sent','gift_received','subscription_bonus','refund','admin_adjustment')),
  reference_id uuid,
  description text not null default '' check (char_length(description) <= 300),
  created_at timestamptz not null default now()
);
create table if not exists public.lovora_gifts_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  coin_cost bigint not null check (coin_cost > 0),
  animation_key text not null default 'sparkle',
  enabled boolean not null default true
);
create table if not exists public.lovora_gifts_sent (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  gift_id uuid not null references public.lovora_gifts_catalog(id),
  message text not null default '' check (char_length(message) <= 300),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create table if not exists public.lovora_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null,
  provider text not null,
  provider_reference text unique,
  status text not null default 'pending' check (status in ('pending','active','past_due','cancelled','expired','refunded')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.lovora_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_id,blocked_id),
  check (blocker_id <> blocked_id)
);
create table if not exists public.lovora_safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  community_id uuid references public.lovora_communities(id) on delete set null,
  reason_code text not null,
  details text not null default '' check (char_length(details) <= 3000),
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  created_at timestamptz not null default now(),
  check (reported_user_id is null or reporter_id <> reported_user_id)
);

-- Starter public communities so the directory is usable immediately after migration.
insert into public.lovora_communities(slug,name,description,category,is_private) values
 ('travel-buddies','Travel Buddies','Find travel friends, swap stories and plan your next adventure.','Travel & Culture',false),
 ('music-lovers','Music Lovers','Discover artists, share playlists and meet fellow music fans.','Music',false),
 ('fitness-wellness','Fitness & Wellness','Motivate each other and make healthy habits more fun.','Wellness',false),
 ('tech-ai','Tech & AI','Build, learn, exchange ideas and find your people.','Tech & Career',false),
 ('foodies','Foodies','Recipes, restaurant tips and delicious conversations.','Food & Culture',false),
 ('gaming-lounge','Gaming Lounge','Find teammates and friends for your favorite games.','Games',false)
on conflict(slug) do nothing;

create index if not exists lovora_community_messages_recent on public.lovora_community_messages(community_id,created_at desc);
create index if not exists lovora_notifications_user_recent on public.lovora_notifications(user_id,created_at desc);
create index if not exists lovora_violations_user_recent on public.lovora_account_violations(user_id,created_at desc);
create index if not exists lovora_coin_transactions_user_recent on public.lovora_coin_transactions(user_id,created_at desc);
create index if not exists lovora_subscriptions_user_status on public.lovora_subscriptions(user_id,status,ends_at desc);

-- Enable RLS everywhere. Policies deliberately do not grant client-side wallet, payment,
-- verification decisions, moderation decisions, or arbitrary subscription writes.
do $$ declare t text; begin
  foreach t in array array['lovora_communities','lovora_community_members','lovora_community_messages','lovora_notifications','lovora_verification_requests','lovora_account_violations','lovora_wallet_accounts','lovora_coin_transactions','lovora_gifts_catalog','lovora_gifts_sent','lovora_subscriptions','lovora_blocks','lovora_safety_reports'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

-- Security-definer helper avoids recursive RLS when checking community membership.
create or replace function public.lovora_is_community_member(p_community_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lovora_community_members cm
    where cm.community_id = p_community_id and cm.user_id = p_user_id
  );
$$;
revoke all on function public.lovora_is_community_member(uuid, uuid) from public;
grant execute on function public.lovora_is_community_member(uuid, uuid) to authenticated;

-- Public-to-authenticated directory and member-visible group data.
drop policy if exists lovora_communities_read on public.lovora_communities;
create policy lovora_communities_read on public.lovora_communities for select to authenticated using (true); -- Directory metadata stays visible; private membership/content remains protected.
drop policy if exists lovora_community_members_read on public.lovora_community_members;
create policy lovora_community_members_read on public.lovora_community_members for select to authenticated using (user_id=auth.uid() or public.lovora_is_community_member(community_id, auth.uid()));
drop policy if exists lovora_community_members_join on public.lovora_community_members;
create policy lovora_community_members_join on public.lovora_community_members for insert to authenticated with check (user_id=auth.uid() and role='member' and exists(select 1 from public.lovora_communities c where c.id=community_id and not c.is_private and (not c.is_premium or exists(select 1 from public.profiles p where p.id=auth.uid() and p.premium_until > now()))));
drop policy if exists lovora_community_members_leave on public.lovora_community_members;
create policy lovora_community_members_leave on public.lovora_community_members for delete to authenticated using (user_id=auth.uid() and role='member');
drop policy if exists lovora_community_messages_read on public.lovora_community_messages;
create policy lovora_community_messages_read on public.lovora_community_messages for select to authenticated using (exists(select 1 from public.lovora_community_members cm where cm.community_id=public.lovora_community_messages.community_id and cm.user_id=auth.uid()));
drop policy if exists lovora_community_messages_send on public.lovora_community_messages;
-- Client inserts are intentionally not allowed; use lovora_send_community_message RPC.

drop policy if exists lovora_notifications_owner_read on public.lovora_notifications;
create policy lovora_notifications_owner_read on public.lovora_notifications for select to authenticated using (user_id=auth.uid());
drop policy if exists lovora_notifications_owner_update on public.lovora_notifications;
create policy lovora_notifications_owner_update on public.lovora_notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists lovora_verification_owner_read on public.lovora_verification_requests;
create policy lovora_verification_owner_read on public.lovora_verification_requests for select to authenticated using (user_id=auth.uid());
drop policy if exists lovora_verification_owner_request on public.lovora_verification_requests;
create policy lovora_verification_owner_request on public.lovora_verification_requests for insert to authenticated with check (user_id=auth.uid() and status='pending' and reviewer_note is null and reviewed_at is null);
drop policy if exists lovora_violations_owner_read on public.lovora_account_violations;
create policy lovora_violations_owner_read on public.lovora_account_violations for select to authenticated using (user_id=auth.uid());

drop policy if exists lovora_wallet_owner_read on public.lovora_wallet_accounts;
create policy lovora_wallet_owner_read on public.lovora_wallet_accounts for select to authenticated using (user_id=auth.uid());
drop policy if exists lovora_coin_tx_owner_read on public.lovora_coin_transactions;
create policy lovora_coin_tx_owner_read on public.lovora_coin_transactions for select to authenticated using (user_id=auth.uid());
drop policy if exists lovora_gifts_catalog_read on public.lovora_gifts_catalog;
create policy lovora_gifts_catalog_read on public.lovora_gifts_catalog for select to authenticated using (enabled=true);
drop policy if exists lovora_gifts_sent_read on public.lovora_gifts_sent;
create policy lovora_gifts_sent_read on public.lovora_gifts_sent for select to authenticated using (sender_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists lovora_subscriptions_owner_read on public.lovora_subscriptions;
create policy lovora_subscriptions_owner_read on public.lovora_subscriptions for select to authenticated using (user_id=auth.uid());
drop policy if exists lovora_blocks_owner_manage on public.lovora_blocks;
create policy lovora_blocks_owner_manage on public.lovora_blocks for all to authenticated using (blocker_id=auth.uid()) with check (blocker_id=auth.uid());
drop policy if exists lovora_reports_owner_insert on public.lovora_safety_reports;
create policy lovora_reports_owner_insert on public.lovora_safety_reports for insert to authenticated with check (reporter_id=auth.uid());
drop policy if exists lovora_reports_owner_read on public.lovora_safety_reports;
create policy lovora_reports_owner_read on public.lovora_safety_reports for select to authenticated using (reporter_id=auth.uid());

insert into public.lovora_gifts_catalog(slug,name,coin_cost,animation_key) values
 ('rose','Rose',10,'rose-bloom'),('heart','Heart',25,'heart-pulse'),('teddy','Teddy Bear',50,'teddy-pop'),('crown','Crown',100,'gold-shine'),('diamond','Diamond',250,'diamond-sparkle')
on conflict(slug) do nothing;

-- Wallet balances and coin ledger are read-only to clients by design.
-- Add audited SECURITY DEFINER RPCs and verify payment-provider webhooks before enabling purchases/gifts.
-- Do not award verification or subscription status from browser-side JavaScript.
