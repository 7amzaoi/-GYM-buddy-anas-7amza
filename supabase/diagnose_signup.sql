-- ============================================================================
-- Signup 500 — compact diagnostic
-- Returns short scalars instead of the function body, because the SQL Editor
-- truncates multi-line prosrc output to the first couple of lines.
-- Read-only. Safe to run any time.
-- ============================================================================

SELECT
  -- THE key question. If this is true, the function still points at the table
  -- we renamed away, and that is the cause of "Database error saving new user".
  (prosrc LIKE '%gymforge_app_state%')            AS still_uses_OLD_table,
  (prosrc LIKE '%gymbuddy_app_state%')            AS uses_NEW_table,
  (prosrc LIKE '%ON CONFLICT%')                   AS has_on_conflict_guard,
  length(prosrc)                                  AS body_length
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = 'public'::regnamespace;


-- Which app-state table actually exists?
SELECT
  to_regclass('public.gymbuddy_app_state') IS NOT NULL AS gymbuddy_exists,
  to_regclass('public.gymforge_app_state') IS NOT NULL AS gymforge_exists;


-- Is the trigger attached and enabled? ('O' = enabled)
SELECT tgname, tgrelid::regclass::text AS on_table, tgenabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';


-- Any NOT NULL column on profiles without a default would also break the
-- trigger's INSERT. Expect zero rows.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND is_nullable = 'NO'
  AND column_default IS NULL
  AND column_name <> 'user_id';
