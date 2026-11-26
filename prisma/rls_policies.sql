-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES & PRIVATE STORAGE BUCKET
-- Run this script in the Supabase SQL Editor after running `npx prisma db push`.
-- Concept: RLS acts like an automatic WHERE clause inside PostgreSQL so no row
-- can ever be leaked even if someone queries Supabase directly from the browser.
-- ============================================================================

-- 1. Enable RLS on every table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendee_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- 2. USERS TABLE POLICIES
-- Authenticated users can read and update only their own user profile row.
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. MEETINGS TABLE POLICIES
-- Hosts can perform all actions (SELECT, INSERT, UPDATE, DELETE) on their own meetings.
CREATE POLICY "meetings_host_all"
  ON public.meetings FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Attendees can read a meeting ONLY if they have a session row in that meeting
-- (matched by authenticated user_id or a signed x-session-id request header).
CREATE POLICY "meetings_attendee_select_joined"
  ON public.meetings FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendee_sessions s
      WHERE s.meeting_id = public.meetings.id
        AND (
          (auth.uid() IS NOT NULL AND s.user_id = auth.uid())
          OR s.id::text = coalesce(
            current_setting('request.headers', true)::json->>'x-session-id',
            ''
          )
        )
    )
  );

-- 4. SITE_UPLOADS TABLE POLICIES
-- Only the meeting's host can read, create, update, or delete site uploads.
CREATE POLICY "site_uploads_host_all"
  ON public.site_uploads FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- 5. ATTENDEE_SESSIONS TABLE POLICIES
-- Each attendee can read ONLY their own session row (or the host can view sessions in their meeting).
CREATE POLICY "attendee_sessions_select_own"
  ON public.attendee_sessions FOR SELECT
  TO anon, authenticated
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR id::text = coalesce(
      current_setting('request.headers', true)::json->>'x-session-id',
      ''
    )
    OR EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = public.attendee_sessions.meeting_id
        AND m.host_id = auth.uid()
    )
  );

-- 6. WAITLIST TABLE POLICIES
-- Public visitors can ONLY insert into the waitlist. No SELECT, UPDATE, or DELETE policies exist,
-- which means nobody can ever read or scrape waitlist emails from the client.
CREATE POLICY "waitlist_insert_only"
  ON public.waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (char_length(email) >= 5 AND char_length(email) <= 254);

-- 7. PRIVATE SUPABASE STORAGE BUCKET FOR UPLOADED SITES
-- Create a strictly private bucket (`public = false`) for raw ZIPs and extracted static assets.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('meeting-sites', 'meeting-sites', false, 26214400)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 26214400;

-- Host can manage only files stored under their own `{host_id}/` folder prefix.
CREATE POLICY "storage_host_manage_own_prefix"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'meeting-sites'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'meeting-sites'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 8. PHASE 2 TABLES: MEETING_INVITES, MEETING_NOTES, MEETING_CHAT_MESSAGES
ALTER TABLE public.meeting_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_invites_host_all"
  ON public.meeting_invites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = public.meeting_invites.meeting_id
        AND m.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = public.meeting_invites.meeting_id
        AND m.host_id = auth.uid()
    )
  );

CREATE POLICY "meeting_notes_host_select"
  ON public.meeting_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = public.meeting_notes.meeting_id
        AND m.host_id = auth.uid()
    )
  );

CREATE POLICY "meeting_chat_host_select"
  ON public.meeting_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = public.meeting_chat_messages.meeting_id
        AND m.host_id = auth.uid()
    )
  );