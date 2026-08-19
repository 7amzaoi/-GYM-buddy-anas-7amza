import { Store } from '../store.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import { create, existsRecent } from './notificationsApi.js';

/**
 * Suggestion engine — decides WHICH notifications deserve to exist, and writes
 * them as rows. Deliberately the only place that decides to nag the user, so
 * the rules stay auditable in one file.
 *
 * Client-side, no cron: `runSuggestionChecks()` is called by the Store at app
 * boot and after a session is finished. That is the whole schedule. Nothing
 * here registers a service worker or requests notification permission — these
 * are in-app rows only.
 *
 * This module is NOT the same thing as lib/notifications.ts. That one derives
 * ephemeral banner nudges from Store state and forgets them daily; these are
 * durable rows in Supabase that survive reload and sync across devices.
 */

const GUARD_KEY = 'gymbuddy_notif_suggested';

/** The run currently in flight, if any — see `runSuggestionChecks`. */
let inFlight = null;

/** Do not re-create the same suggestion inside this window. */
const RENAG_DAYS = 7;

/** How far back a "this session" PR can be. Covers a session finished just
 *  now, and a boot shortly after one that was interrupted mid-write. */
const PR_LOOKBACK_MS = 6 * 60 * 60 * 1000;

const STREAK_MILESTONES = [3, 7, 14, 30];

const METRIC_STALE_DAYS = 30;
const METRIC_VERY_STALE_DAYS = 60;

// ---------------------------------------------------------------- guard
// Two layers. localStorage is the cheap one and stops a re-nag without a
// network round-trip on every boot; the table query is the cross-device one,
// because localStorage on a new phone knows nothing. Both must agree the
// suggestion is new before it is created.

function readGuard() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUARD_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function guardedLocally(key) {
  const at = readGuard()[key];
  if (!at) return false;
  return Date.now() - at < RENAG_DAYS * 86400000;
}

function stampGuard(key) {
  try {
    const all = readGuard();
    all[key] = Date.now();
    // Drop entries well past the window so this never grows without bound.
    const cutoff = Date.now() - RENAG_DAYS * 2 * 86400000;
    for (const k of Object.keys(all)) if (all[k] < cutoff) delete all[k];
    localStorage.setItem(GUARD_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — the table guard still applies */
  }
}

/** Undo an optimistic stamp when the insert it was protecting failed. */
function releaseGuard(key) {
  try {
    const all = readGuard();
    delete all[key];
    localStorage.setItem(GUARD_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Create a notification unless an equivalent one was raised recently.
 * `guardKey` scopes the local guard; `dataMatch` scopes the remote one.
 */
async function suggest(guardKey, payload, dataMatch = null) {
  if (guardedLocally(guardKey)) return false;

  const { exists, error } = await existsRecent({
    kind: payload.kind,
    days: RENAG_DAYS,
    dataMatch,
  });
  // On a query failure, stay silent rather than risk duplicate nags.
  if (error || exists) return false;

  // Stamp BEFORE the insert, not after. Between the `existsRecent` read and the
  // insert completing there is a window where a second caller would also see
  // "nothing recent" and create a duplicate. Claiming the key first closes it;
  // the cost of a lost stamp on a failed insert is one skipped suggestion,
  // which is far cheaper than nagging the user twice.
  stampGuard(guardKey);

  const { error: createErr } = await create(payload);
  if (createErr) {
    releaseGuard(guardKey);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------- helpers

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysSince(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((startOfDay(new Date()).getTime() - startOfDay(t).getTime()) / 86400000);
}

/** Most recent body-metric entry across BOTH logs the app writes:
 *  metricsLog (weight / body fat) and bodyMeasurements (tape measurements). */
function lastBodyMetricIso() {
  const metrics = Store.get('metricsLog') || [];
  const measurements = Store.get('bodyMeasurements') || [];
  const stamps = [...metrics, ...measurements]
    .map((e) => Date.parse(e?.date))
    .filter((t) => Number.isFinite(t));
  if (stamps.length === 0) return null;
  return new Date(Math.max(...stamps)).toISOString();
}

// ---------------------------------------------------------------- checks

/**
 * A personal record set in (or just before) this session.
 * `captureAutoRecordsFromSession` has already written the winning records with
 * a fresh `recorded_at`, so a recent stamp IS the signal — no need to re-derive
 * the comparison, and no change to that load-bearing function's contract.
 */
async function checkPrBroken() {
  const records = Store.get('records') || [];
  const cutoff = Date.now() - PR_LOOKBACK_MS;

  const fresh = records
    .filter((r) => {
      const t = Date.parse(r?.recorded_at);
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at));

  let made = 0;
  for (const r of fresh) {
    const exId = r.exercise_id;
    if (!exId) continue;
    const ok = await suggest(
      `pr_broken:${exId}`,
      {
        kind: 'pr_broken',
        title: 'New personal record',
        body: `${r.exercise_name} — you beat your previous best.`,
        data: { exercise_id: exId, exercise_name: r.exercise_name, metric_type: r.metric_type },
        action_url: '#/records',
        priority: 2,
      },
      { exercise_id: exId }
    );
    if (ok) made += 1;
  }
  return made;
}

/** Highest milestone the current streak has reached, once each. */
async function checkStreakMilestone() {
  const streak = Number(Store.get('progressData')?.streak) || 0;
  const milestone = [...STREAK_MILESTONES].reverse().find((m) => streak >= m);
  if (!milestone) return 0;

  const ok = await suggest(
    `streak:${milestone}`,
    {
      kind: 'streak',
      title: `${milestone}-day streak`,
      body:
        milestone >= 30
          ? 'A full month of showing up. This is what consistency looks like.'
          : 'Consistency is compounding — keep the chain going.',
      data: { milestone, streak },
      action_url: '#/progress',
      priority: 1,
    },
    { milestone }
  );
  return ok ? 1 : 0;
}

/** Body metrics going stale. Escalates in importance at 60 days. */
async function checkStaleBodyMetrics() {
  const last = lastBodyMetricIso();
  // Never logged anything: nothing to be stale yet. The onboarding flow covers
  // first entry; nagging a brand-new account on day one would be noise.
  if (!last) return 0;

  const days = daysSince(last);
  if (days === null || days < METRIC_STALE_DAYS) return 0;

  const veryStale = days >= METRIC_VERY_STALE_DAYS;
  const ok = await suggest(
    veryStale ? 'reminder:metrics:60' : 'reminder:metrics:30',
    {
      kind: 'reminder',
      title: veryStale ? 'Body metrics are 2 months old' : 'Time to log your measurements',
      body: `Last logged ${days} days ago. A fresh entry keeps your progress charts honest.`,
      data: { topic: 'body_metrics', days_since: days, threshold: veryStale ? 60 : 30 },
      action_url: '#/progress',
      priority: veryStale ? 2 : 1,
    },
    { topic: 'body_metrics', threshold: veryStale ? 60 : 30 }
  );
  return ok ? 1 : 0;
}

// ---------------------------------------------------------------- entry point

/**
 * The single entry point. Store calls this at boot and after a session ends.
 *
 * Never throws and never blocks the caller's flow — a failed suggestion is not
 * worth interrupting a workout for.
 *
 * @param {{ trigger?: 'boot' | 'session-finish' }} [opts]
 * @returns {Promise<number>} how many notifications were created
 */
export async function runSuggestionChecks(opts = {}) {
  // Non-reentrant. The boot effect double-invokes under React StrictMode, and
  // a session can finish while a boot run is still in flight — two concurrent
  // runs would both read "nothing recent" before either wrote, and create
  // duplicates. Callers join the run already in progress instead.
  if (inFlight) return inFlight;
  inFlight = doRun(opts).finally(() => { inFlight = null; });
  return inFlight;
}

async function doRun({ trigger = 'boot' } = {}) {
  try {
    // Rows live in Supabase; with no backend there is nowhere to put them.
    if (!isSupabaseConfigured()) return 0;
    const user = Store.get('user');
    if (!user?.id || user.source !== 'supabase') return 0;

    // PR and streak both change AT session finish, so they run on both
    // triggers (on boot they also catch a session whose write was interrupted).
    const checks = [checkPrBroken(), checkStreakMilestone()];

    // Stale measurements are a boot-time concern. Asking someone to go find a
    // tape measure in the seconds after they finished training is bad timing,
    // and it would bury the PR they just earned.
    if (trigger !== 'session-finish') checks.push(checkStaleBodyMetrics());

    const results = await Promise.all(checks);
    const created = results.reduce((a, b) => a + b, 0);

    // Pull the new rows into the bell straight away, so a PR set 2 seconds ago
    // is visible without waiting for the next boot.
    if (created > 0) await Store.refreshNotifications();
    return created;
  } catch {
    return 0;
  }
}
