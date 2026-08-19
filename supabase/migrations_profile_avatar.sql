-- ============================================================================
-- Profile avatar — columns + Storage RLS
-- Run in Supabase → SQL Editor. Idempotent: safe to re-run.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. profiles columns
-- ---------------------------------------------------------------------------
-- avatar_url    a PERMANENT pointer to the active image — never an expiring
--               URL. For a preset it is a root-relative app path
--               (/avatars/preset-04.webp). For an upload it is the Storage
--               object path ({user_id}/avatar.webp), which the client signs
--               into a short-lived URL at display time via resolveAvatarUrl().
--               Storing a signed URL here instead would mean every user's
--               avatar breaking simultaneously the moment the tokens lapse.
-- avatar_source which source produced it. Stored separately rather than
--               inferred by string-matching the URL, so the picker can ring
--               the currently-selected preset without parsing anything.
--               NULL = no avatar; the UI falls back to the user's initials.
--               NULL passes the CHECK below (CHECK is not violated by NULL).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_source TEXT CHECK (avatar_source IN ('preset','upload'));


-- ---------------------------------------------------------------------------
-- 2. Storage bucket — CREATE THIS MANUALLY IN THE DASHBOARD FIRST
-- ---------------------------------------------------------------------------
-- Exactly ONE bucket is needed. Create it under Storage → New bucket BEFORE
-- running this file, or the policies below will exist but match nothing.
--
--   Bucket: "avatar-uploads"
--     Public: NO (private).
--     Holds user-cropped avatars at path: {user_id}/avatar.webp
--     Because the bucket is private, reads require a signed URL. The client
--     stores only the object PATH in profiles.avatar_url and mints a 1-hour
--     signed URL at display time, so nothing in the database ever expires.
--
-- There is deliberately NO bucket for the 10 preset avatars. Those are static
-- assets committed to the repo at public/avatars/preset-01.webp … preset-10.webp
-- and served by the app's own host at /avatars/<file>. They ship with the
-- build, are identical for every user, and change only when a file is
-- committed — so they need no storage backend, no policy, and no RLS surface.
--
-- RLS is already enabled on storage.objects by default in Supabase, so there
-- is no ALTER TABLE ... ENABLE ROW LEVEL SECURITY here (that statement needs
-- table-owner rights the SQL Editor role does not have).


-- ---------------------------------------------------------------------------
-- 3. RLS — avatar-uploads: each user is confined to their own folder
-- ---------------------------------------------------------------------------
-- storage.objects stores the object key in `name`, e.g.
--   "3f9a…-uuid/avatar.webp"
-- storage.foldername(name) splits that into a text[] of path segments, so
--   (storage.foldername(name))[1]
-- is the first segment — the folder. Comparing it to auth.uid()::text is what
-- confines a user to their own directory. auth.uid() returns uuid, so the
-- ::text cast is required for the comparison to typecheck.
--
-- USING  → which existing rows this role may see/act on.
-- WITH CHECK → what the row must look like after an INSERT/UPDATE.
-- UPDATE needs BOTH: USING stops you targeting someone else's object,
-- WITH CHECK stops you rewriting the path to land in someone else's folder.
-- The client uploads with upsert:true, which issues an UPDATE when the object
-- already exists — so the UPDATE policy is load-bearing, not optional.
--
-- All four are scoped TO authenticated: anonymous visitors match no policy,
-- and because RLS denies by default that means they get nothing at all.

DROP POLICY IF EXISTS "avatar_uploads_select_own" ON storage.objects;
CREATE POLICY "avatar_uploads_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatar-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_uploads_insert_own" ON storage.objects;
CREATE POLICY "avatar_uploads_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatar-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_uploads_update_own" ON storage.objects;
CREATE POLICY "avatar_uploads_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatar-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatar-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar_uploads_delete_own" ON storage.objects;
CREATE POLICY "avatar_uploads_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatar-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ---------------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------------
-- SELECT policyname, cmd, roles
--   FROM pg_policies
--  WHERE schemaname = 'storage' AND tablename = 'objects'
--    AND policyname LIKE 'avatar%'
--  ORDER BY policyname;
--
-- Expect 4 rows, all on avatar-uploads: SELECT / INSERT / UPDATE / DELETE.
-- If you see an old "avatar_presets_public_read" row from an earlier run of a
-- previous version of this file, drop it — presets are no longer in Storage:
--   DROP POLICY IF EXISTS "avatar_presets_public_read" ON storage.objects;
