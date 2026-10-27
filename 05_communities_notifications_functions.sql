-- LOVORA Stage 2: community actions + server-created notifications.
-- Prerequisite: 04_lovora_platform_features.sql has been reviewed and applied.
-- Additive only. Does not replace existing matching or send_lovora_message functions.

drop function if exists public.lovora_create_community(text,text,text,text);
create or replace function public.lovora_create_community(
  p_name text,
  p_slug text,
  p_description text default '',
  p_category text default 'general',
  p_is_private boolean default false,
  p_rules text default '',
  p_is_premium boolean default false
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(regexp_replace(btrim(coalesce(p_slug, '')), '[^a-zA-Z0-9-]+', '-', 'g'));
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'Community name must be 2–80 characters.'; end if;
  if char_length(v_slug) < 2 or char_length(v_slug) > 80 then raise exception 'Community slug must be 2–80 characters.'; end if;
  if char_length(coalesce(p_description,'')) > 1000 then raise exception 'Description is too long.'; end if;
  if char_length(coalesce(p_rules,'')) > 3000 then raise exception 'Community rules are too long.'; end if;
  insert into public.lovora_communities(slug,name,description,category,is_private,rules,is_premium,created_by)
  values (v_slug,v_name,btrim(coalesce(p_description,'')),left(coalesce(nullif(btrim(p_category),''),'general'),60),coalesce(p_is_private,false),btrim(coalesce(p_rules,'')),coalesce(p_is_premium,false),v_uid)
  returning id into v_id;
  insert into public.lovora_community_members(community_id,user_id,role) values(v_id,v_uid,'owner');
  return v_id;
end $$;

-- Safe aggregate for the public community directory: return counts, never member UUIDs.
create or replace function public.lovora_public_community_member_counts()
returns table(community_id uuid, member_count bigint)
language sql stable security definer set search_path = public
as $$
  select c.id, count(cm.user_id)::bigint
  from public.lovora_communities c
  left join public.lovora_community_members cm on cm.community_id=c.id
  where not c.is_private
  group by c.id;
$$;

create or replace function public.lovora_join_community(p_community_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;
  if not exists(select 1 from public.lovora_communities c where c.id=p_community_id and not c.is_private) then
    raise exception 'This community is private or unavailable. Ask its owner for access.';
  end if;
  if exists(select 1 from public.lovora_communities c where c.id=p_community_id and c.is_premium) and not exists(select 1 from public.profiles p where p.id=v_uid and p.premium_until > now()) then
    raise exception 'This is a LOVORA Gold community. Active premium membership is required.';
  end if;
  insert into public.lovora_community_members(community_id,user_id,role)
  values(p_community_id,v_uid,'member') on conflict(community_id,user_id) do nothing;
end $$;

create or replace function public.lovora_leave_community(p_community_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;
  delete from public.lovora_community_members
  where community_id=p_community_id and user_id=v_uid and role='member';
  if not found and exists(select 1 from public.lovora_community_members where community_id=p_community_id and user_id=v_uid and role in ('owner','moderator')) then
    raise exception 'Community owners and moderators must transfer their role before leaving.';
  end if;
end $$;

create or replace function public.lovora_send_community_message(p_community_id uuid, p_content text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_body text := btrim(coalesce(p_content,''));
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;
  if char_length(v_body)<1 or char_length(v_body)>2000 then raise exception 'Messages must contain 1–2000 characters.'; end if;
  if not exists(select 1 from public.lovora_community_members cm where cm.community_id=p_community_id and cm.user_id=v_uid) then
    raise exception 'Join this community before sending messages.';
  end if;
  if exists(select 1 from public.profiles p where p.id=v_uid and p.account_status is not null and p.account_status <> 'active') then
    raise exception 'Your account is restricted.';
  end if;
  insert into public.lovora_community_messages(community_id,sender_id,content)
  values(p_community_id,v_uid,v_body) returning id into v_id;
  return v_id;
end $$;

create or replace function public.lovora_mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  update public.lovora_notifications set read_at=coalesce(read_at,now())
  where id=p_notification_id and user_id=auth.uid();
end $$;

-- Notifications are created server-side for direct messages and new matches.
create or replace function public.lovora_notify_direct_message()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_recipient uuid;
begin
  select case when m.user1=new.sender_id then m.user2 else m.user1 end
    into v_recipient
  from public.matches m
  where m.id=new.match_id and (m.user1=new.sender_id or m.user2=new.sender_id);
  if v_recipient is not null and v_recipient <> new.sender_id then
    insert into public.lovora_notifications(user_id,kind,title,body)
    values(v_recipient,'message','New message','You received a new message on LOVORA.');
  end if;
  return new;
end $$;

drop trigger if exists lovora_message_notification on public.messages;
create trigger lovora_message_notification after insert on public.messages
for each row execute function public.lovora_notify_direct_message();

create or replace function public.lovora_notify_new_match()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.lovora_notifications(user_id,kind,title,body)
  values(new.user1,'match','It’s a match!','You have a new LOVORA match.'),
        (new.user2,'match','It’s a match!','You have a new LOVORA match.');
  return new;
end $$;

drop trigger if exists lovora_match_notification on public.matches;
create trigger lovora_match_notification after insert on public.matches
for each row execute function public.lovora_notify_new_match();

-- Group message notifications are generated from the persisted message row.
create or replace function public.lovora_notify_community_message()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_name text;
begin
  select name into v_name from public.lovora_communities where id=new.community_id;
  insert into public.lovora_notifications(user_id,kind,title,body)
  select cm.user_id,'community_message','New community message',left(coalesce(v_name,'A community') || ' has a new message.',1000)
  from public.lovora_community_members cm
  where cm.community_id=new.community_id and cm.user_id<>new.sender_id;
  return new;
end $$;

drop trigger if exists lovora_community_message_notification on public.lovora_community_messages;
create trigger lovora_community_message_notification after insert on public.lovora_community_messages
for each row execute function public.lovora_notify_community_message();

revoke all on function public.lovora_create_community(text,text,text,text,boolean,text,boolean) from public;
revoke all on function public.lovora_public_community_member_counts() from public;
revoke all on function public.lovora_join_community(uuid) from public;
revoke all on function public.lovora_leave_community(uuid) from public;
revoke all on function public.lovora_send_community_message(uuid,text) from public;
revoke all on function public.lovora_mark_notification_read(uuid) from public;
grant execute on function public.lovora_create_community(text,text,text,text,boolean,text,boolean) to authenticated;
grant execute on function public.lovora_public_community_member_counts() to authenticated;
grant execute on function public.lovora_join_community(uuid) to authenticated;
grant execute on function public.lovora_leave_community(uuid) to authenticated;
grant execute on function public.lovora_send_community_message(uuid,text) to authenticated;
grant execute on function public.lovora_mark_notification_read(uuid) to authenticated;

-- Realtime publication is deliberately not altered automatically. Enable the relevant
-- tables in Supabase Dashboard > Database > Publications only after reviewing project settings.
