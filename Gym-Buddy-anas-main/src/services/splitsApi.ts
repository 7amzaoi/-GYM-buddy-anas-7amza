import { supabase } from '../lib/supabaseClient.js';
import { Store, type CustomSplit, type SplitDay } from '../store.js';

/**
 * TypeScript twin of splitsApi.js — the runtime imports the `.js`, this exists
 * so `npm run typecheck` covers the module. Change one, mirror the other.
 *
 * Weekly split sharing. Mirrors avatarApi.ts — getAuthedUser(), withTimeout(),
 * runDbCallWithTimeout() and a { data, error } return from every export.
 */

export interface SharedSplitRow {
  id: number | string;
  owner_id: string;
  owner_display_name: string | null;
  slug: string;
  name: string;
  description: string | null;
  days: SplitDay[];
  created_at: string;
  revoked_at: string | null;
}

export interface ShareResult {
  id: number | string | null;
  slug: string;
  path: string;
  url: string;
}

export interface ApiResult<T> {
  data: T | null;
  error: Error | null;
}

const TABLE = 'shared_splits';
const COLUMNS = 'id,owner_id,owner_display_name,slug,name,description,days,created_at,revoked_at';

const SLUG_ALPHABET = '23456789bcdfghjkmnpqrstvwxyz';
const SLUG_LENGTH = 12;
const SLUG_ATTEMPTS = 5;
const PG_UNIQUE_VIOLATION = '23505';

function makeSlug(): string {
  const bytes = new Uint8Array(SLUG_LENGTH);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < SLUG_LENGTH; i += 1) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

async function getAuthedUser(): Promise<{ user: { id: string; email?: string } | null; error: Error | null }> {
  if (!supabase) return { user: null, error: new Error('Supabase is not configured') };
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return { user: null, error: error as unknown as Error };
    if (data?.user) return { user: data.user as unknown as { id: string; email?: string }, error: null };
    return { user: null, error: new Error('Not authenticated') };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)), user: null };
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runDbCallWithTimeout<T extends { error?: unknown }>(
  queryFactory: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string
): Promise<T | { error: Error }> {
  const controller = new AbortController();
  try {
    return await withTimeout(queryFactory(controller.signal), ms, label);
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      return { error: new Error(`${label} timed out`) };
    }
    return { error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    controller.abort();
  }
}

/** The public path a share link points at. */
export function sharedSplitPath(slug: string): string {
  return `/split/${slug}`;
}

/** Absolute URL for the native share sheet / clipboard. HashRouter, so `#`. */
export function sharedSplitUrl(slug: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#${sharedSplitPath(slug)}`;
}

/** Rebuild days from scratch so nothing local-only leaks into a readable row. */
function snapshotDays(days: SplitDay[] | undefined): SplitDay[] {
  const out: SplitDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = (days || [])[i] || ({ dayIndex: i, type: 'rest' } as SplitDay);
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
 * Slug is client-generated: there is no server function here to do it, and a
 * client slug plus the table's UNIQUE constraint is self-correcting — a clash
 * surfaces as 23505 and we try another, which beats trusting randomness.
 */
export async function shareSplit(localSplit: CustomSplit | null): Promise<ApiResult<ShareResult>> {
  if (!localSplit) return { data: null, error: new Error('No split to share') };

  const client = supabase;
  if (!client) return { data: null, error: new Error('Supabase is not configured') };

  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return { data: null, error: authError ?? new Error('Not authenticated') };
  }

  const storeUser = (Store.get('user') || {}) as { name?: string };
  const row = {
    owner_id: user.id,
    owner_display_name: storeUser.name || user.email || 'A GymBuddy user',
    name: localSplit.name,
    description: localSplit.description || '',
    days: snapshotDays(localSplit.days),
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
    const slug = makeSlug();
    const res = (await runDbCallWithTimeout(
      (signal) =>
        client
          .from(TABLE)
          .insert({ ...row, slug })
          .select('id,slug')
          .abortSignal(signal) as unknown as Promise<{
          data?: { id: number }[];
          error?: { code?: string } | null;
        }>,
      12000,
      'Share split'
    )) as { data?: { id: number }[]; error?: { code?: string } | null };

    if (!res?.error) {
      const created = Array.isArray(res.data) ? res.data[0] : (res.data as unknown as { id: number });
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

    lastError = res.error instanceof Error ? res.error : new Error(String((res.error as { message?: string })?.message ?? res.error));
    if (res.error?.code !== PG_UNIQUE_VIOLATION) break;
  }

  return { data: null, error: lastError ?? new Error('Could not create the share link') };
}

/**
 * Fetch one live shared split by slug.
 *
 * Returns { data: null, error: null } for a revoked or nonexistent slug — the
 * UI must tell "this link is dead" apart from "the network failed".
 */
export async function getSharedSplit(slug: string | null): Promise<ApiResult<SharedSplitRow>> {
  if (!slug) return { data: null, error: null };

  const client = supabase;
  if (!client) return { data: null, error: new Error('Supabase is not configured') };

  const res = (await runDbCallWithTimeout(
    (signal) =>
      client
        .from(TABLE)
        .select(COLUMNS)
        .eq('slug', slug)
        .is('revoked_at', null)
        .abortSignal(signal)
        .maybeSingle() as unknown as Promise<{
        data?: SharedSplitRow | null;
        error?: unknown;
      }>,
    12000,
    'Load shared split'
  )) as { data?: SharedSplitRow | null; error?: unknown };

  if (res?.error) {
    return {
      data: null,
      error: res.error instanceof Error ? res.error : new Error(String(res.error)),
    };
  }
  return { data: res?.data ?? null, error: null };
}

/** Kill a link the current user owns. RLS enforces the ownership. */
export async function revokeSharedSplit(
  sharedSplitId: number | string | null
): Promise<ApiResult<{ id: number | string; revoked: boolean }>> {
  if (!sharedSplitId) return { data: null, error: new Error('No share to revoke') };

  const client = supabase;
  if (!client) return { data: null, error: new Error('Supabase is not configured') };

  const { user, error: authError } = await getAuthedUser();
  if (authError || !user) {
    return { data: null, error: authError ?? new Error('Not authenticated') };
  }

  const res = (await runDbCallWithTimeout(
    (signal) =>
      client
        .from(TABLE)
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', sharedSplitId)
        .eq('owner_id', user.id)
        .abortSignal(signal) as unknown as Promise<{ error?: unknown }>,
    12000,
    'Revoke share'
  )) as { error?: unknown };

  if (res?.error) {
    return {
      data: null,
      error: res.error instanceof Error ? res.error : new Error(String(res.error)),
    };
  }
  return { data: { id: sharedSplitId, revoked: true }, error: null };
}

/**
 * Copy a fetched shared split into the viewer's own splits.
 *
 * Purely local — touches no table. Fresh local id and its own days array, so
 * editing the copy can never reach back to the owner's row. `sourceSplitId` is
 * provenance only and is never used to re-fetch or re-sync.
 */
export async function importSharedSplit(
  sharedSplitRow: SharedSplitRow | null
): Promise<ApiResult<CustomSplit>> {
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
