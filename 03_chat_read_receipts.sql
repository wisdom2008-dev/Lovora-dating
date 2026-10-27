-- LOVORA Chat Upgrade: read receipts
-- Run this file in Supabase SQL Editor AFTER deploying the updated app.
-- This migration assumes the working app schema: matches(id, user1, user2)
-- and messages(match_id, sender_id, content, created_at).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_lovora_messages_read(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND (m.user1 = auth.uid() OR m.user2 = auth.uid())
  ) THEN
    RAISE EXCEPTION 'You are not a member of this match';
  END IF;

  UPDATE public.messages
  SET read_at = now()
  WHERE match_id = p_match_id
    AND sender_id <> auth.uid()
    AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_lovora_messages_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_lovora_messages_read(uuid) TO authenticated;

-- Enable UPDATE events for read receipt changes. If replica identity is already
-- configured differently, this is safe to leave as FULL for reliable payloads.
ALTER TABLE public.messages REPLICA IDENTITY FULL;
