-- ============================================================================
-- FIX: signup returns 500 "Database error saving new user"
-- Run in Supabase → SQL Editor. Idempotent: safe to re-run.
-- ============================================================================
--
-- Symptom: POST /auth/v1/signup returns
--   {"code":500,"error_code":"unexpected_failure",
--    "msg":"Database error saving new user"}
--
-- Cause: auth.users has an AFTER INSERT trigger (on_auth_user_created) running
-- public.handle_new_user(), which seeds a row in public.profiles and one in the
-- app-state table. If ANY statement in that function raises, the whole INSERT
-- into auth.users is rolled back and GoTrue surfaces it as a generic 500.
--
-- The likely culprit here: the deployed copy of the function still inserts into
-- `public.gymforge_app_state`, which was renamed to `public.gymbuddy_app_state`
-- by migration_rename_app_state_to_gymbuddy.sql. The function body is NOT
-- rewritten by ALTER TABLE ... RENAME, so it kept pointing at a table that no
-- longer exists.


-- ---------------------------------------------------------------------------
-- STEP 1 — DIAGNOSE (read-only). Run this first and read the output.
-- ---------------------------------------------------------------------------
-- Look for `gymforge_app_state` in the body. If it is there, that is the bug.
SELECT prosrc AS deployed_handle_new_user_body
  FROM pg_proc
 WHERE proname = 'handle_new_user'
   AND pronamespace = 'public'::regnamespace;

-- Which app-state table actually exists right now?
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('gymbuddy_app_state', 'gymforge_app_state');

-- Is the trigger even attached?
SELECT tgname, tgrelid::regclass AS on_table, tgenabled
  FROM pg_trigger
 WHERE tgname = 'on_auth_user_created';


-- ---------------------------------------------------------------------------
-- STEP 2 — FIX. Replaces the function body regardless of what it said before.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- ON CONFLICT DO NOTHING on both inserts: a retried signup, or a row seeded
  -- by the client's own upsertProfile, must not abort account creation.
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

  -- Correct table name. The rename migration moved gymforge_app_state ->
  -- gymbuddy_app_state, and a function body does not follow a table rename.
  INSERT INTO public.gymbuddy_app_state (user_id, state)
  VALUES (NEW.id, '{}')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the trigger exists and points at the function.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ---------------------------------------------------------------------------
-- STEP 3 — VERIFY the new body took (should NOT contain gymforge).
-- ---------------------------------------------------------------------------
SELECT position('gymforge' in prosrc) AS should_be_zero,
       position('gymbuddy_app_state' in prosrc) AS should_be_nonzero
  FROM pg_proc
 WHERE proname = 'handle_new_user'
   AND pronamespace = 'public'::regnamespace;
