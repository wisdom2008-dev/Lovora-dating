-- LOVORA community completion migration (additive).
-- Apply 04, then 05, then this file in a TEST Supabase project first.
-- Private community metadata is discoverable; membership and messages stay restricted.

create table if not exists public.lovora_community_join_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.lovora_communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (community_id,user_id)
);
create table if not exists public.lovora_community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.lovora_communities(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (community_id,invited_user_id)
);
create index if not exists lovora_community_requests_owner_idx on public.lovora_community_join_requests(community_id,status,created_at);
create index if not exists lovora_community_invites_user_idx on public.lovora_community_invites(invited_user_id,status,created_at desc);

alter table public.lovora_community_join_requests enable row level security;
alter table public.lovora_community_invites enable row level security;
drop policy if exists lovora_community_requests_read on public.lovora_community_join_requests;
create policy lovora_community_requests_read on public.lovora_community_join_requests for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.lovora_community_members cm where cm.community_id=lovora_community_join_requests.community_id and cm.user_id=auth.uid() and cm.role in ('owner','moderator')));
drop policy if exists lovora_community_invites_read on public.lovora_community_invites;
create policy lovora_community_invites_read on public.lovora_community_invites for select to authenticated using (invited_user_id=auth.uid() or invited_by=auth.uid());

create or replace function public.lovora_request_community_join(p_community_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
 if v_uid is null then raise exception 'Please sign in first.'; end if;
 if not exists(select 1 from public.lovora_communities c where c.id=p_community_id and c.is_private) then raise exception 'This community does not require a private join request.'; end if;
 if exists(select 1 from public.lovora_communities c where c.id=p_community_id and c.is_premium) and not exists(select 1 from public.profiles p where p.id=v_uid and p.premium_until>now()) then raise exception 'This is a LOVORA Gold community. Active Gold membership is required.'; end if;
 if exists(select 1 from public.lovora_community_members cm where cm.community_id=p_community_id and cm.user_id=v_uid) then raise exception 'You are already a member.'; end if;
 insert into public.lovora_community_join_requests(community_id,user_id,status) values(p_community_id,v_uid,'pending')
 on conflict(community_id,user_id) do update set status='pending',created_at=now(),reviewed_at=null returning id into v_id;
 insert into public.lovora_notifications(user_id,kind,title,body)
 select c.created_by,'community_join_request','New community join request',left(coalesce((select display_name from public.profiles where id=v_uid),'A LOVORA member'),80)||' requested to join '||c.name||'.'
 from public.lovora_communities c where c.id=p_community_id and c.created_by is not null and c.created_by<>v_uid;
 return v_id;
end $$;

create or replace function public.lovora_invite_community_member(p_community_id uuid,p_invited_user_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
 if v_uid is null then raise exception 'Please sign in first.'; end if;
 if not exists(select 1 from public.lovora_community_members cm where cm.community_id=p_community_id and cm.user_id=v_uid and cm.role in ('owner','moderator')) then raise exception 'Only the owner or a moderator can invite members.'; end if;
 if p_invited_user_id is null or p_invited_user_id=v_uid then raise exception 'Enter another user’s account UUID.'; end if;
 if not exists(select 1 from auth.users where id=p_invited_user_id) then raise exception 'No account found for that user ID.'; end if;
 if exists(select 1 from public.lovora_communities c where c.id=p_community_id and c.is_premium) and not exists(select 1 from public.profiles p where p.id=p_invited_user_id and p.premium_until>now()) then raise exception 'That user needs active LOVORA Gold to join this Gold community.'; end if;
 insert into public.lovora_community_invites(community_id,invited_user_id,invited_by,status) values(p_community_id,p_invited_user_id,v_uid,'pending')
 on conflict(community_id,invited_user_id) do update set invited_by=v_uid,status='pending',created_at=now(),responded_at=null returning id into v_id;
 insert into public.lovora_notifications(user_id,kind,title,body) select p_invited_user_id,'community_invite','Community invitation','You have been invited to join '||c.name||'.' from public.lovora_communities c where c.id=p_community_id;
 return v_id;
end $$;

create or replace function public.lovora_review_community_join_request(p_request_id uuid,p_approve boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); r public.lovora_community_join_requests%rowtype; c public.lovora_communities%rowtype;
begin
 if v_uid is null then raise exception 'Please sign in first.'; end if;
 select * into r from public.lovora_community_join_requests where id=p_request_id for update;
 if not found then raise exception 'Join request not found.'; end if;
 if not exists(select 1 from public.lovora_community_members cm where cm.community_id=r.community_id and cm.user_id=v_uid and cm.role in ('owner','moderator')) then raise exception 'Only the owner or a moderator can review requests.'; end if;
 select * into c from public.lovora_communities where id=r.community_id;
 if r.status<>'pending' then raise exception 'This request has already been reviewed.'; end if;
 if p_approve and c.is_premium and not exists(select 1 from public.profiles p where p.id=r.user_id and p.premium_until>now()) then raise exception 'The requester needs active LOVORA Gold.'; end if;
 update public.lovora_community_join_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=now() where id=r.id;
 if p_approve then insert into public.lovora_community_members(community_id,user_id,role) values(r.community_id,r.user_id,'member') on conflict do nothing; end if;
 insert into public.lovora_notifications(user_id,kind,title,body) values(r.user_id,'community_request_update',case when p_approve then 'Join request approved' else 'Join request declined' end,case when p_approve then 'You can now join '||c.name||'.' else 'Your request to join '||c.name||' was declined.' end);
end $$;

create or replace function public.lovora_respond_community_invite(p_invite_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); i public.lovora_community_invites%rowtype; c public.lovora_communities%rowtype;
begin
 if v_uid is null then raise exception 'Please sign in first.'; end if;
 select * into i from public.lovora_community_invites where id=p_invite_id and invited_user_id=v_uid for update;
 if not found then raise exception 'Invitation not found.'; end if;
 if i.status<>'pending' then raise exception 'This invitation is no longer pending.'; end if;
 select * into c from public.lovora_communities where id=i.community_id;
 if p_accept and c.is_premium and not exists(select 1 from public.profiles p where p.id=v_uid and p.premium_until>now()) then raise exception 'Active LOVORA Gold is required for this community.'; end if;
 update public.lovora_community_invites set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now() where id=i.id;
 if p_accept then insert into public.lovora_community_members(community_id,user_id,role) values(i.community_id,v_uid,'member') on conflict do nothing; end if;
end $$;

-- Replace the earlier join function with a version that handles public vs private paths safely.
create or replace function public.lovora_join_community(p_community_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'Please sign in first.'; end if;
 if not exists(select 1 from public.lovora_communities c where c.id=p_community_id and not c.is_private) then raise exception 'This community is private. Request access or accept an invitation.'; end if;
 if exists(select 1 from public.lovora_communities c where c.id=p_community_id and c.is_premium) and not exists(select 1 from public.profiles p where p.id=v_uid and p.premium_until>now()) then raise exception 'This is a LOVORA Gold community. Active Gold membership is required.'; end if;
 insert into public.lovora_community_members(community_id,user_id,role) values(p_community_id,v_uid,'member') on conflict(community_id,user_id) do nothing;
end $$;

revoke all on function public.lovora_request_community_join(uuid) from public;
revoke all on function public.lovora_invite_community_member(uuid,uuid) from public;
revoke all on function public.lovora_review_community_join_request(uuid,boolean) from public;
revoke all on function public.lovora_respond_community_invite(uuid,boolean) from public;
revoke all on function public.lovora_join_community(uuid) from public;
grant execute on function public.lovora_request_community_join(uuid) to authenticated;
grant execute on function public.lovora_invite_community_member(uuid,uuid) to authenticated;
grant execute on function public.lovora_review_community_join_request(uuid,boolean) to authenticated;
grant execute on function public.lovora_respond_community_invite(uuid,boolean) to authenticated;
grant execute on function public.lovora_join_community(uuid) to authenticated;
