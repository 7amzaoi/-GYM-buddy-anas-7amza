-- Run in Supabase → SQL Editor. Enable Authentication → Email (Providers).
-- Mirrors app state JSON per user so you can swap localStorage sync for this row.

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  display_name TEXT,
  goal TEXT DEFAULT 'muscle gain',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gymbuddy_app_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.body_metrics_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight_kg DOUBLE PRECISION,
  body_fat_pct DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_body_metrics_logs_user_logged_at
  ON public.body_metrics_logs (user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS public.personal_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  sets INTEGER,
  weight_kg DOUBLE PRECISION,
  reps INTEGER,
  time_min DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_personal_records_user_recorded_at
  ON public.personal_records (user_id, recorded_at DESC);

-- In-app notifications. Rows are created client-side today (see
-- services/notificationSuggestions.js); the shape is deliberately transport
-- agnostic so a future Web Push sender can consume the same rows without a
-- migration:
--   * `kind` + `data` carry everything a push payload would need.
--   * `scheduled_for` NULL = deliver immediately; a future timestamp is a
--     user-set reminder that a sender/cron would pick up. Readers must filter
--     it out until it is due — there is no UI to set one yet.
--   * `priority` maps onto push importance channels (1 normal .. 3 critical).
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  action_url TEXT,
  read_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  priority SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT notifications_kind_check
    CHECK (kind IN ('pr_broken', 'reminder', 'streak', 'system')),
  CONSTRAINT notifications_priority_check
    CHECK (priority BETWEEN 1 AND 3)
);

-- Feed order: newest first for a given user.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);

-- Unread badge. Partial index so it only carries the rows the bell counts.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gymbuddy_app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_own" ON public.profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "app_state_own" ON public.gymbuddy_app_state FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "body_metrics_logs_own" ON public.body_metrics_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "personal_records_own" ON public.personal_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_own" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'personal_records_user_exercise_metric_key'
  ) THEN
    ALTER TABLE public.personal_records
      ADD CONSTRAINT personal_records_user_exercise_metric_key
      UNIQUE (user_id, exercise_id, metric_type);
  END IF;
END $$;

-- Backfill verification columns for already-existing accounts.
UPDATE public.profiles p
SET
  email_verified = (
    COALESCE(
      u.email_confirmed_at,
      (to_jsonb(u) ->> 'confirmed_at')::timestamptz
    ) IS NOT NULL
  ),
  email_verified_at = COALESCE(
    u.email_confirmed_at,
    (to_jsonb(u) ->> 'confirmed_at')::timestamptz
  )
FROM auth.users u
WHERE p.user_id = u.id;

-- Trigger: mirror auth.users email into profiles on signup (optional; or insert from client after signUp).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, email_verified, email_verified_at, display_name, goal)
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
  );
  INSERT INTO public.gymbuddy_app_state (user_id, state)
  VALUES (NEW.id, '{}');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing accounts: if signup metadata has a goal, mirror it into profiles.
UPDATE public.profiles p
SET goal = COALESCE(NULLIF(u.raw_user_meta_data->>'goal', ''), p.goal)
FROM auth.users u
WHERE p.user_id = u.id;

CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    email_verified = (
      COALESCE(
        NEW.email_confirmed_at,
        (to_jsonb(NEW) ->> 'confirmed_at')::timestamptz
      ) IS NOT NULL
    ),
    email_verified_at = COALESCE(
      NEW.email_confirmed_at,
      (to_jsonb(NEW) ->> 'confirmed_at')::timestamptz
    ),
    updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_auth_user_updated();

-- Admin-only view for SQL editor: clear verified/unverified account list.
CREATE OR REPLACE VIEW public.account_verification_status AS
SELECT
  u.id AS user_id,
  u.email,
  u.created_at,
  COALESCE(
    u.email_confirmed_at,
    (to_jsonb(u) ->> 'confirmed_at')::timestamptz
  ) AS email_verified_at,
  (
    COALESCE(
      u.email_confirmed_at,
      (to_jsonb(u) ->> 'confirmed_at')::timestamptz
    ) IS NOT NULL
  ) AS is_verified
FROM auth.users u;

CREATE OR REPLACE FUNCTION public.log_my_body_metrics(
  p_logged_at TIMESTAMPTZ,
  p_weight_kg DOUBLE PRECISION,
  p_body_fat_pct DOUBLE PRECISION,
  p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.body_metrics_logs (user_id, logged_at, weight_kg, body_fat_pct, notes)
  VALUES (v_uid, COALESCE(p_logged_at, now()), p_weight_kg, p_body_fat_pct, p_notes);

  INSERT INTO public.profiles (user_id, email, weight_kg, body_fat_pct, updated_at)
  VALUES (v_uid, v_email, p_weight_kg, p_body_fat_pct, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    weight_kg = EXCLUDED.weight_kg,
    body_fat_pct = EXCLUDED.body_fat_pct,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.log_my_body_metrics(TIMESTAMPTZ, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_my_body_metrics(TIMESTAMPTZ, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO authenticated;
