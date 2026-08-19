import { supabase } from '../lib/supabaseClient.js';

/**
 * TypeScript twin of notificationsApi.js — the runtime imports the `.js`, this
 * exists so `npm run typecheck` covers the module. Change one, mirror the other.
 *
 * In-app notifications. IN-APP ONLY — nothing here registers a service worker,
 * asks for the Notification permission, or talks to a push service. Rows are
 * written by the client (services/notificationSuggestions.js) and read while
 * the app is open.
 */

export type NotificationKind = 'pr_broken' | 'reminder' | 'streak' | 'system';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  action_url: string | null;
  read_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  priority: number;
}

const COLUMNS = 'id,kind,title,body,data,action_url,read_at,scheduled_for,created_at,priority';

async function getAuthedUser(): Promise<{ user: { id: string } | null; error: Error | null }> {
  if (!supabase) return { user: null, error: new Error('Supabase not configured') };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user: null, error: error as unknown as Error };
  return { user: (data?.user as { id: string } | null) ?? null, error: null };
}

function toInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function mapRowToNotification(row: Record<string, any>): AppNotification {
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

export interface ListOpts {
  limit?: number;
  before?: string | null;
}

/**
 * Newest-first page of notifications that are due now.
 *
 * `before` is a created_at ISO string for keyset pagination — cheaper and
 * stable under inserts, unlike an offset.
 */
export async function list(
  { limit = 30, before = null }: ListOpts = {}
): Promise<{ notifications: AppNotification[]; error: Error | null }> {
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
  if (error) return { notifications: [], error: error as unknown as Error };

  return { notifications: (data || []).map(mapRowToNotification), error: null };
}

export async function markRead(ids: number | number[]): Promise<{ error: Error | null }> {
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

  return { error: (error as unknown as Error) ?? null };
}

export async function markAllRead(): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { error: userErr ?? new Error('Not authenticated') };

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  return { error: (error as unknown as Error) ?? null };
}

export interface CreateOpts {
  kind: NotificationKind;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  action_url?: string | null;
  scheduled_for?: string | null;
  priority?: number;
}

export async function create({
  kind,
  title,
  body = null,
  data = null,
  action_url = null,
  scheduled_for = null,
  priority = 1,
}: CreateOpts): Promise<{ notification: AppNotification | null; error: Error | null }> {
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

  if (error) return { notification: null, error: error as unknown as Error };
  return { notification: mapRowToNotification(inserted as Record<string, any>), error: null };
}

export async function remove(id: number): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') };
  if (id == null) return { error: new Error('Missing id') };

  const { user, error: userErr } = await getAuthedUser();
  if (userErr || !user?.id) return { error: userErr ?? new Error('Not authenticated') };

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .eq('id', id);

  return { error: (error as unknown as Error) ?? null };
}

export async function unreadCount(): Promise<{ count: number; error: Error | null }> {
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

  if (error) return { count: 0, error: error as unknown as Error };
  return { count: count ?? 0, error: null };
}

export interface ExistsRecentOpts {
  kind: NotificationKind;
  days?: number;
  dataMatch?: Record<string, unknown> | null;
}

/**
 * Has a notification of this kind been created within the last `days`?
 * Backs the suggestion engine's re-nag guardrail. `dataMatch` narrows to a
 * single subject (e.g. one exercise) via JSONB containment.
 */
export async function existsRecent(
  { kind, days = 7, dataMatch = null }: ExistsRecentOpts
): Promise<{ exists: boolean; error: Error | null }> {
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
  if (error) return { exists: false, error: error as unknown as Error };
  return { exists: (count ?? 0) > 0, error: null };
}
