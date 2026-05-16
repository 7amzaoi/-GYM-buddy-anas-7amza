-- Run in Supabase SQL after schema.sql so profile body metrics exist.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS weight_kg DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS body_fat_pct DOUBLE PRECISION;

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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_metrics_logs ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_personal_records_user_recorded_at
  ON public.personal_records (user_id, recorded_at DESC);

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
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.gymbuddy_app_state (user_id, state)
  VALUES (NEW.id, '{}')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing accounts: if signup metadata has a goal, mirror it into profiles.
UPDATE public.profiles p
SET goal = COALESCE(NULLIF(u.raw_user_meta_data->>'goal', ''), p.goal)
FROM auth.users u
WHERE p.user_id = u.id;

DROP POLICY IF EXISTS "personal_records_own" ON public.personal_records;
CREATE POLICY "personal_records_own"
ON public.personal_records
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile"
ON public.profiles
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own body metrics logs" ON public.body_metrics_logs;
CREATE POLICY "Users can manage own body metrics logs"
ON public.body_metrics_logs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_user_id_key'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.save_my_body_metrics(
  p_height_cm DOUBLE PRECISION,
  p_weight_kg DOUBLE PRECISION,
  p_age INTEGER,
  p_body_fat_pct DOUBLE PRECISION
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

  INSERT INTO public.profiles (
    user_id, email, height_cm, weight_kg, age, body_fat_pct, updated_at
  ) VALUES (
    v_uid, v_email, p_height_cm, p_weight_kg, p_age, p_body_fat_pct, now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    height_cm = EXCLUDED.height_cm,
    weight_kg = EXCLUDED.weight_kg,
    age = EXCLUDED.age,
    body_fat_pct = EXCLUDED.body_fat_pct,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_my_body_metrics(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_my_body_metrics(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, DOUBLE PRECISION) TO authenticated;

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
