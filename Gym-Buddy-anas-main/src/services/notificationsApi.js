import { supabase } from '../lib/supabaseClient.js';

/**
 * In-app notifications. IN-APP ONLY — nothing here registers a service worker,
 * asks for the Notification permission, or talks to a push service. Rows are
 * written by the client (services/notificationSuggestions.js) and read while
 * the app is open.
 *
 * Row shape (see supabase/migrations_notifications.sql):
 *   kind          'pr_broken' | 'reminder' | 'streak' | 'system'
 *   data          kind-specific JSON payload (exercise_id, streak length, ...)
 *   action_url    in-app hash route to open on tap, e.g. '#/records'
 *   read_at       null = unread
 *   scheduled_for null = immediate; a future timestamp is a user-set reminder
 *                 that is NOT surfaced until it is due
 *   priority      1 normal, 2 important, 3 critical
 */

const COLUMNS = 'id,kind,title,body,data,action_url,read_at,scheduled_for,created_at,priority';

async function getAuthedUser() {
  if (!supabase) return { user: null, error: new Error('Supabase not configured') };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user: null, error };
  return { user: data?.user ?? null, error: null };
}

function toInt(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Normalise a DB row into the shape the UI renders. */
function mapRowToNotification(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body ?? null,
    data: row.data ?? null,
    action_url: row.action_url ?? null,
    read_at: row.read_at ?? null,
    scheduled_for: row.scheduled_for ?? null,
    created_at: row.created_at,
    priority: toInt(row.priority) ?? 1,
  };
}

/**
 * Newest-first page of notifications that are due now.
 *
 * `before` is a created_at ISO string for keyset pagination — cheaper and
 * stable under inserts, unlike an offset.
 */
export async function list({ limit = 30, before = null } = {}) {
  if (!supabase) return { notifications: [], error: new Error('Supabase not configured') };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { notifications: [], error: userErr ?? new Error('Not authenticated') };

  let query = supabase
    .from('notifications')
    .select(COLUMNS)
    .eq('user_id', user.id)
    // Scheduled-for-later reminders exist as rows but are not yet deliverable.
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) return { notifications: [], error };

  return { notifications: (data || []).map(mapRowToNotification), error: null };
}

export async function markRead(ids) {
  if (!supabase) return { error: new Error('Supabase not configured') };
  const list_ = (Array.isArray(ids) ? ids : [ids]).filter((id) => id != null);
  if (list_.length === 0) return { error: null };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { error: userErr ?? new Error('Not authenticated') };

  // Only stamp rows that are still unread, so re-reading a notification does
  // not keep moving its read timestamp forward.
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
    .in('id', list_);

  return { error: error ?? null };
}

export async function markAllRead() {
  if (!supabase) return { error: new Error('Supabase not configured') };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { error: userErr ?? new Error('Not authenticated') };

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  return { error: error ?? null };
}

export async function create({
  kind,
  title,
  body = null,
  data = null,
  action_url = null,
  scheduled_for = null,
  priority = 1,
} = {}) {
  if (!supabase) return { notification: null, error: new Error('Supabase not configured') };
  if (!kind || !title) return { notification: null, error: new Error('Missing kind or title') };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { notification: null, error: userErr ?? new Error('Not authenticated') };

  const row = {
    user_id: user.id,
    kind,
    title,
    body,
    data,
    action_url,
    scheduled_for,
    priority: toInt(priority) ?? 1,
  };

  const { data: inserted, error } = await supabase
    .from('notifications')
    .insert(row)
    .select(COLUMNS)
    .single();

  if (error) return { notification: null, error };
  return { notification: mapRowToNotification(inserted), error: null };
}

export async function remove(id) {
  if (!supabase) return { error: new Error('Supabase not configured') };
  if (id == null) return { error: new Error('Missing id') };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { error: userErr ?? new Error('Not authenticated') };

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .eq('id', id);

  return { error: error ?? null };
}

export async function unreadCount() {
  if (!supabase) return { count: 0, error: new Error('Supabase not configured') };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { count: 0, error: userErr ?? new Error('Not authenticated') };

  // head:true → count only, no rows over the wire.
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`);

  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

/**
 * Has a notification of this kind been created within the last `days`?
 * Backs the suggestion engine's re-nag guardrail. `dataMatch` narrows to a
 * single subject (e.g. one exercise) via JSONB containment.
 */
export async function existsRecent({ kind, days = 7, dataMatch = null } = {}) {
  if (!supabase) return { exists: false, error: new Error('Supabase not configured') };
  if (!kind) return { exists: false, error: new Error('Missing kind') };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { exists: false, error: userErr ?? new Error('Not authenticated') };

  const since = new Date(Date.now() - days * 86400000).toISOString();
  let query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('kind', kind)
    .gte('created_at', since);

  if (dataMatch) query = query.contains('data', dataMatch);

  const { count, error } = await query;
  if (error) return { exists: false, error };
  return { exists: (count ?? 0) > 0, error: null };
}
