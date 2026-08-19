import { supabase } from '../lib/supabaseClient.js';
import { Store } from '../store.js';

/**
 * Weekly split sharing.
 *
 * Mirrors avatarApi.js — getAuthedUser(), withTimeout(), runDbCallWithTimeout()
 * and a { data, error } return from every export. Nothing here throws.
 *
 * TypeScript twin: splitsApi.ts. Change one, mirror the other.
 */

const TABLE = 'shared_splits';
const COLUMNS = 'id,owner_id,owner_display_name,slug,name,description,days,created_at,revoked_at';

/* Slug alphabet: no vowels (can't spell anything unfortunate), no 0/O/1/l/I
   (can't be misread aloud or retyped wrongly). 32 symbols x 12 chars ~= 60 bits,
   which makes guessing impractical — though the security model is still
   "unlisted", not private. See the RLS comments in migrations_weekly_split.sql. */
const SLUG_ALPHABET = '23456789bcdfghjkmnpqrstvwxyz';
const SLUG_LENGTH = 12;
const SLUG_ATTEMPTS = 5;

/** Postgres unique-violation. Used to retry a slug rather than trust randomness. */
const PG_UNIQUE_VIOLATION = '23505';

function makeSlug() {
  const bytes = new Uint8Array(SLUG_LENGTH);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < SLUG_LENGTH; i += 1) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

async function getAuthedUser() {
  if (!supabase) return { user: null, error: new Error('Supabase is not configured') };
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return { user: null, error };
    if (data?.user) return { user: data.user, error: null };
    return { user: null, error: new Error('Not authenticated') };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)), user: null };
  }
}

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function runDbCallWithTimeout(queryFactory, ms, label) {
  const controller = new AbortController();
  try {
    return await withTimeout(queryFactory(controller.signal), ms, label);
  } catch (error) {
    if (error?.name === 'AbortError') return { error: new Error(`${label} timed out`) };
    return { error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    controller.abort();
  }
}

/** The public path a share link points at. */
export function sharedSplitPath(slug) {
  return `/split/${slug}`;
}

/** Absolute URL for the native share sheet / clipboard. HashRouter, so `#`. */
export function sharedSplitUrl(slug) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${sharedSplitPath(slug)}`;
}

/**
 * Strip a local split's days down to exactly what a viewer needs.
 *
 * Rebuilt rather than passed through so nothing local-only (ids, timestamps,
 * a stray plan reference) leaks into a row other users can read.
 */
function snapshotDays(days) {
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const d = (days || [])[i] || { dayIndex: i, type: 'rest' };
    if (d.type !== 'plan') {
      out.push({ dayIndex: i, type: 'rest' });
      continue;
    }
    out.push({
      dayIndex: i,
      type: 'plan',
      planName: d.planName || 'Training',
      category: d.category || 'strength',
      exercises: (d.exercises || []).map((e) => ({
        id: e.id,
        name: e.name,
        muscles: e.muscles || '',
      })),
    });
  }
  return out;
}

/**
 * Publish an immutable snapshot of a local split and return its share path.
 *
 * The slug is generated client-side. There is no server function in this
 * project to do it, and a client slug plus the table's UNIQUE constraint is
 * self-correcting: a collision surfaces as 23505 and we simply try another
 * one. That is stronger than trusting randomness blindly, and it avoids
 * standing up an edge function for a 12-character string.
 */
export async function shareSplit(localSplit) {
  if (!localSplit) return { data: null, error: new Error('No split to share') };

  const client = supabase;
  if (!client) return { data: null, error: new Error('Supabase is not configured') };

  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return { data: null, error: authError ?? new Error('Not authenticated') };
  }

  const storeUser = Store.get('user') || {};
  const row = {
    owner_id: user.id,
    owner_display_name: storeUser.name || user.email || 'A GymBuddy user',
    name: localSplit.name,
    description: localSplit.description || '',
    days: snapshotDays(localSplit.days),
  };

  let lastError = null;
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
    const slug = makeSlug();
    const res = await runDbCallWithTimeout(
      (signal) =>
        client
          .from(TABLE)
          .insert({ ...row, slug })
          .select('id,slug')
          .abortSignal(signal),
      12000,
      'Share split'
    );

    if (!res?.error) {
      const created = Array.isArray(res.data) ? res.data[0] : res.data;
      return {
        data: {
          id: created?.id ?? null,
          slug,
          path: sharedSplitPath(slug),
          url: sharedSplitUrl(slug),
        },
        error: null,
      };
    }

    lastError = res.error;
    // Only a slug clash is worth retrying; anything else fails immediately.
    if (res.error?.code !== PG_UNIQUE_VIOLATION) break;
  }

  return { data: null, error: lastError ?? new Error('Could not create the share link') };
}

/**
 * Fetch one live shared split by slug.
 *
 * Returns { data: null, error: null } for a revoked or nonexistent slug — the
 * UI has to tell "this link is dead" apart from "the network failed", and
 * collapsing both into an error makes that impossible.
 */
export async function getSharedSplit(slug) {
  if (!slug) return { data: null, error: null };

  const client = supabase;
  if (!client) return { data: null, error: new Error('Supabase is not configured') };

  const res = await runDbCallWithTimeout(
    (signal) =>
      client
        .from(TABLE)
        .select(COLUMNS)
        .eq('slug', slug)
        .is('revoked_at', null)
        .abortSignal(signal)
        .maybeSingle(),
    12000,
    'Load shared split'
  );

  if (res?.error) return { data: null, error: res.error };
  return { data: res?.data ?? null, error: null };
}

/** Kill a link the current user owns. RLS enforces the ownership. */
export async function revokeSharedSplit(sharedSplitId) {
  if (!sharedSplitId) return { data: null, error: new Error('No share to revoke') };

  const client = supabase;
  if (!client) return { data: null, error: new Error('Supabase is not configured') };

  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return { data: null, error: authError ?? new Error('Not authenticated') };
  }

  const res = await runDbCallWithTimeout(
    (signal) =>
      client
        .from(TABLE)
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', sharedSplitId)
        .eq('owner_id', user.id)
        .abortSignal(signal),
    12000,
    'Revoke share'
  );

  if (res?.error) return { data: null, error: res.error };
  return { data: { id: sharedSplitId, revoked: true }, error: null };
}

/**
 * Copy a fetched shared split into the viewer's own splits.
 *
 * Purely local — touches no table. The copy gets a fresh local id and its own
 * days array, so editing it afterwards can never reach back to the owner's
 * row. `sourceSplitId` records where it came from for provenance display and
 * is never used to re-fetch or re-sync.
 */
export async function importSharedSplit(sharedSplitRow) {
  if (!sharedSplitRow) return { data: null, error: new Error('Nothing to import') };
  try {
    const created = Store.addCustomSplit({
      name: sharedSplitRow.name,
      description: sharedSplitRow.description || '',
      days: snapshotDays(sharedSplitRow.days),
      sourceSplitId: sharedSplitRow.id != null ? String(sharedSplitRow.id) : null,
    });
    return { data: created, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
