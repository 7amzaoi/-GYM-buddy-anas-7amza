-- ============================================================
-- One-shot migration for the GymForge → GymBuddy rebrand.
-- Run this ONCE on any Supabase project that was provisioned
-- with the old `gymforge_app_state` table name.
--
-- Safe to skip on a fresh project — schema.sql now creates the
-- table as `gymbuddy_app_state` directly.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gymforge_app_state'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gymbuddy_app_state'
  ) THEN
    EXECUTE 'ALTER TABLE public.gymforge_app_state RENAME TO gymbuddy_app_state';
  END IF;
END
$$;

-- Recreate the RLS policy under the new table name (the rename
-- preserves the policy, but the policy name is fine either way).
-- If you previously named the policy "app_state_own", this is a no-op.
