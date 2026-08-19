import { supabase } from '../lib/supabaseClient.js';

/** @returns {number|null} */
function toNum(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
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

/**
 * Read current row → merge patch → upsert.
 * IMPORTANT: Do not chain `.select()` after `.upsert` — when RLS blocks RETURNING rows,
 * some clients stall or return errors; we only rely on `{ error }` from upsert.
 */
export async function upsertProfile(userLike, patch = {}) {
  if (!supabase || !userLike?.id) {
    return { error: new Error('No Supabase session / user id') };
  }
  const { user } = await getAuthedUser();
  const effectiveUserId = user?.id || userLike.id;
  if (!effectiveUserId) return { error: new Error('Not authenticated') };

  /** @type {Record<string, unknown>} */
  const row = {
    user_id: effectiveUserId,
    email: patch.email ?? user?.email ?? userLike.email ?? null,
    display_name: patch.display_name ?? userLike.name ?? null,
    goal: patch.goal !== undefined ? patch.goal : userLike.goal ?? 'muscle gain',
    updated_at: new Date().toISOString(),
    height_cm: null,
    weight_kg: null,
    age: null,
    body_fat_pct: null,
  };

  if ('height_cm' in patch) row.height_cm = toNum(patch.height_cm);
  else if (userLike.height_cm != null && userLike.height_cm !== '') row.height_cm = toNum(userLike.height_cm);

  if ('weight_kg' in patch) row.weight_kg = toNum(patch.weight_kg);
  else if (userLike.weight_kg != null && userLike.weight_kg !== '') row.weight_kg = toNum(userLike.weight_kg);

  if ('age' in patch) row.age = patch.age === '' || patch.age == null ? null : Math.round(Number(patch.age));
  else if (userLike.age != null && userLike.age !== '') row.age = Math.round(Number(userLike.age));

  if ('body_fat_pct' in patch) row.body_fat_pct = toNum(patch.body_fat_pct);
  else if (userLike.body_fat_pct != null && userLike.body_fat_pct !== '') row.body_fat_pct = toNum(userLike.body_fat_pct);

  const { error } = await runDbCallWithTimeout(
    (signal) =>
      supabase
        .from('profiles')
        .upsert(row, { onConflict: 'user_id' })
        .abortSignal(signal),
    12000,
    'Save profile'
  );
  return { error: error ?? null };
}

export async function saveBodyMetricsRemote(userLike, metrics = {}) {
  if (!supabase || !userLike?.id) {
    return { error: new Error('No Supabase session / user id') };
  }
  const { user } = await getAuthedUser();
  const effectiveUserId = user?.id || userLike.id;
  if (!effectiveUserId) return { error: new Error('Not authenticated') };

  const hasHeight = Object.prototype.hasOwnProperty.call(metrics, 'height_cm');
  const hasWeight = Object.prototype.hasOwnProperty.call(metrics, 'weight_kg');
  const hasAge = Object.prototype.hasOwnProperty.call(metrics, 'age');
  const hasBodyFat = Object.prototype.hasOwnProperty.call(metrics, 'body_fat_pct');

  const height = hasHeight
    ? toNum(metrics.height_cm)
    : (userLike.height_cm == null || userLike.height_cm === '' ? null : toNum(userLike.height_cm));
  const weight = hasWeight
    ? toNum(metrics.weight_kg)
    : (userLike.weight_kg == null || userLike.weight_kg === '' ? null : toNum(userLike.weight_kg));
  const age = hasAge
    ? (metrics.age === '' || metrics.age == null || Number.isNaN(Number(metrics.age))
      ? null
      : Math.round(Number(metrics.age)))
    : (userLike.age == null || userLike.age === '' ? null : Math.round(Number(userLike.age)));
  const bodyFat = hasBodyFat
    ? toNum(metrics.body_fat_pct)
    : (userLike.body_fat_pct == null || userLike.body_fat_pct === '' ? null : toNum(userLike.body_fat_pct));

  const row = {
    user_id: effectiveUserId,
    email: user?.email ?? userLike.email ?? null,
    updated_at: new Date().toISOString(),
    height_cm: height,
    weight_kg: weight,
    age,
    body_fat_pct: bodyFat,
  };
  const { error } = await runDbCallWithTimeout(
    (signal) =>
      supabase
        .from('profiles')
        .upsert(row, { onConflict: 'user_id' })
        .abortSignal(signal),
    12000,
    'Save body metrics'
  );
  return { error: error ?? null };
}

export async function logBodyMetricsRemote(userLike, metrics = {}) {
  if (!supabase || !userLike?.id) {
    return { error: new Error('No Supabase session / user id') };
  }
  const { user } = await getAuthedUser();
  const effectiveUserId = user?.id || userLike.id;
  if (!effectiveUserId) return { error: new Error('Not authenticated') };

  const weight = toNum(metrics.weight_kg);
  const bodyFat = toNum(metrics.body_fat_pct);
  const notes = typeof metrics.notes === 'string' ? metrics.notes : null;
  const loggedAt = metrics.logged_at || new Date().toISOString();

  const { error } = await runDbCallWithTimeout(
    (signal) =>
      supabase
        .rpc('log_my_body_metrics', {
          p_logged_at: loggedAt,
          p_weight_kg: weight,
          p_body_fat_pct: bodyFat,
          p_notes: notes,
        })
        .abortSignal(signal),
    12000,
    'Log body metrics'
  );

  // If function doesn't exist yet, keep profile save working anyway.
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (!msg.includes('log_my_body_metrics') && !msg.includes('function')) {
      return { error };
    }
  }

  return saveBodyMetricsRemote(
    { ...userLike, id: effectiveUserId, email: user?.email ?? userLike.email ?? null },
    { weight_kg: weight, body_fat_pct: bodyFat }
  );
}
