-- Run in Supabase SQL Editor for existing projects.
-- Adds explicit verification fields and keeps them synced from auth.users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

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

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_auth_user_updated();

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
