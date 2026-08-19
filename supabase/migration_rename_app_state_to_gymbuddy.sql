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


-- ============================================================
-- REQUIRED: rewrite handle_new_user() too.
--
-- ALTER TABLE ... RENAME renames the table. It does NOT rewrite
-- function bodies. handle_new_user() — the AFTER INSERT trigger
-- on auth.users that seeds a profiles row and an app-state row —
-- keeps the old name baked into its source, so after the rename
-- above it inserts into a table that no longer exists.
--
-- The failure is SILENT until the next signup, and then it looks
-- nothing like a rename problem: every INSERT into auth.users is
-- rolled back and GoTrue reports
--   {"code":500,"msg":"Database error saving new user"}
-- This cost real debugging time on 2026-08-19. Do not drop this
-- block from the migration.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- ON CONFLICT DO NOTHING on both: a retried signup, or a row the
  -- client seeded itself via upsertProfile, must not abort account
  -- creation.
  INSERT INTO public.profiles (
    user_id, email, email_verified, email_verified_at, display_name, goal
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.email_confirmed_at,
      (to_jsonb(NEW) ->> 'confirmed_at')::timestamptz
    ) IS NOT NULL,
    COALESCE(
      NEW.email_confirmed_at,
      (to_jsonb(NEW) ->> 'confirmed_at')::timestamptz
    ),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'goal', ''), 'muscle gain')
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.gymbuddy_app_state (user_id, state)
  VALUES (NEW.id, '{}')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Confirm the rewrite took: expect false / true / true.
-- SELECT (prosrc LIKE '%gymforge_app_state%') AS still_uses_old,
--        (prosrc LIKE '%gymbuddy_app_state%') AS uses_new,
--        (prosrc LIKE '%ON CONFLICT%')        AS has_guard
--   FROM pg_proc
--  WHERE proname = 'handle_new_user'
--    AND pronamespace = 'public'::regnamespace;
