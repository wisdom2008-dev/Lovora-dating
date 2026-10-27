-- LOVORA compatibility functions for the current deployed frontend.
-- Run only after the community tables and earlier functions have been created.

CREATE OR REPLACE FUNCTION public.lovora_leave_community(p_community_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  DELETE FROM public.lovora_community_members
  WHERE community_id = p_community_id AND user_id = v_user_id AND role = 'member';
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.lovora_community_members WHERE community_id=p_community_id AND user_id=v_user_id) THEN
      RAISE EXCEPTION 'Owners and moderators cannot leave until they transfer their role.';
    END IF;
    RAISE EXCEPTION 'You are not a member of this community.';
  END IF;
  RETURN 'You left the community.';
END;
$$;

CREATE OR REPLACE FUNCTION public.lovora_respond_community_invite(
  p_invite_id uuid,
  p_accept boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_community_id uuid;
  v_is_premium boolean;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Please sign in first.'; END IF;
  SELECT i.community_id, c.is_premium
  INTO v_community_id, v_is_premium
  FROM public.lovora_community_invites i
  JOIN public.lovora_communities c ON c.id = i.community_id
  WHERE i.id = p_invite_id
    AND i.invited_user_id = v_user_id
    AND i.status = 'pending'
    AND c.is_private = true
  FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found or no longer available.'; END IF;

  IF p_accept AND v_is_premium AND NOT EXISTS (
    SELECT 1 FROM public.lovora_subscriptions s
    WHERE s.user_id = v_user_id AND s.status = 'active'
      AND (s.ends_at IS NULL OR s.ends_at > now())
  ) THEN RAISE EXCEPTION 'An active Gold subscription is required.'; END IF;

  IF p_accept THEN
    INSERT INTO public.lovora_community_members(community_id,user_id,role)
    VALUES(v_community_id,v_user_id,'member')
    ON CONFLICT (community_id,user_id) DO NOTHING;
  END IF;
  UPDATE public.lovora_community_invites
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      responded_at = now()
  WHERE id = p_invite_id;
  RETURN CASE WHEN p_accept THEN 'Invitation accepted.' ELSE 'Invitation declined.' END;
END;
$$;

REVOKE ALL ON FUNCTION public.lovora_leave_community(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lovora_respond_community_invite(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lovora_leave_community(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lovora_respond_community_invite(uuid,boolean) TO authenticated;
