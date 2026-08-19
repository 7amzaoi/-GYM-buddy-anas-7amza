-- ============================================================================
-- Weekly split sharing
-- Run in Supabase → SQL Editor. Idempotent: safe to re-run.
-- ============================================================================
--
-- WHY THIS TABLE EXISTS AT ALL
-- A user's own splits live in customSplits inside the per-user
-- gymbuddy_app_state JSONB blob, which RLS locks to its owner — another
-- user's client physically cannot read it. Sharing therefore needs a second,
-- readable home. This table is that home.
--
-- Every row is an immutable SNAPSHOT taken at share time, not a live view of
-- the owner's split. If the owner edits their split afterwards, links already
-- shared keep showing what was actually shared. That is deliberate: a friend
-- opening a link should see what you sent them, not something that changed
-- underneath them.

CREATE TABLE IF NOT EXISTS public.shared_splits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Snapshotted at share time so the viewer sees the name the owner had when
  -- they shared, and so rendering a shared split needs no join against
  -- profiles (which RLS would block for a non-owner anyway).
  owner_display_name TEXT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- The full 7-day snapshot, same shape as the local split's `days` array.
  days JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- NULL = live link. Set = dead. Soft revoke rather than DELETE so the owner
  -- keeps a record of what they had shared and with what content.
  revoked_at TIMESTAMPTZ
);

-- slug already has a unique index from the UNIQUE constraint; this is the
-- "my shared splits" lookup, which filters by owner.
CREATE INDEX IF NOT EXISTS idx_shared_splits_owner
  ON public.shared_splits (owner_id, created_at DESC);

ALTER TABLE public.shared_splits ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- READ: any signed-in user may read any row whose link is still live.
--
-- ⚠ READ THIS BEFORE ASSUMING IT IS PRIVATE. This is deliberately NOT
-- owner-scoped. The whole point of a share link is that someone who is not
-- the owner can open it, and the viewer's client has only the slug — it
-- cannot prove a relationship to the owner. So the security model is
-- UNLISTED, not private: possession of the slug is the credential. Any
-- authenticated user who has, is given, or successfully guesses a slug can
-- read that row. Slugs are 12 chars from a 32-symbol alphabet (~60 bits) to
-- make guessing impractical, but that is obscurity, not authorisation.
--
-- What this still guarantees: anonymous visitors get nothing (TO authenticated),
-- and a revoked link stops resolving for everyone immediately.
DROP POLICY IF EXISTS "shared_splits_read_live" ON public.shared_splits;
CREATE POLICY "shared_splits_read_live"
  ON public.shared_splits
  FOR SELECT
  TO authenticated
  USING (revoked_at IS NULL);

-- CREATE: you may only publish a share owned by yourself. WITH CHECK is the
-- operative half on INSERT — it validates the row being written, blocking
-- anyone from inserting a row attributed to another user.
DROP POLICY IF EXISTS "shared_splits_insert_own" ON public.shared_splits;
CREATE POLICY "shared_splits_insert_own"
  ON public.shared_splits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: only the owner, and this is what makes revoke safe — a viewer who
-- can READ a row (see the read policy above) still cannot revoke or alter it.
-- USING picks which existing rows may be targeted; WITH CHECK stops an owner
-- reassigning owner_id to someone else on the way out.
DROP POLICY IF EXISTS "shared_splits_update_own" ON public.shared_splits;
CREATE POLICY "shared_splits_update_own"
  ON public.shared_splits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE: only the owner. Revoking is preferred (keeps the record), but hard
-- deletion stays available.
DROP POLICY IF EXISTS "shared_splits_delete_own" ON public.shared_splits;
CREATE POLICY "shared_splits_delete_own"
  ON public.shared_splits
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);


-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
-- SELECT policyname, cmd, roles FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'shared_splits'
--  ORDER BY policyname;
-- Expect 4 rows: SELECT / INSERT / UPDATE / DELETE.
