-- Run in Supabase SQL after schema.sql. Idempotent — safe to re-run.
--
-- In-app notifications. Rows are created client-side today (see
-- services/notificationSuggestions.js). The shape is deliberately transport
-- agnostic so a future Web Push sender can consume the same rows without a
-- migration:
--   * `kind` + `data` carry everything a push payload would need.
--   * `scheduled_for` NULL = deliver immediately; a future timestamp is a
--     user-set reminder for a sender/cron to pick up. Readers must filter it
--     out until it is due — there is no UI to set one yet.
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
  priority SMALLINT NOT NULL DEFAULT 1
);

-- Constraints added separately so re-running against an existing table works.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_kind_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_kind_check
      CHECK (kind IN ('pr_broken', 'reminder', 'streak', 'system'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_priority_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_priority_check
      CHECK (priority BETWEEN 1 AND 3);
  END IF;
END $$;

-- Feed order: newest first for a given user.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);

-- Unread badge. Partial index so it only carries the rows the bell counts.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Own rows only — same pattern as personal_records.
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own"
ON public.notifications
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
