import type { User as SupabaseAuthUser, Subscription } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { Store, type User as AppUser, type ProgressData, type MetricsLogEntry } from '../store.js';
import { upsertProfile } from '../services/profilesApi.js';
import { loadPersonalRecords, upsertPersonalRecords } from '../services/personalRecordsApi.js';

interface ProfileRow {
  display_name?: string | null;
  goal?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  age?: number | null;
  body_fat_pct?: number | null;
  avatar_url?: string | null;
  avatar_source?: 'preset' | 'upload' | null;
  [key: string]: unknown;
}

function buildUser(profile: ProfileRow | null | undefined, authUser: SupabaseAuthUser): AppUser {
  const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
  const metaGoal = typeof meta.goal === 'string' ? meta.goal : null;
  const name =
    profile?.display_name ||
    (typeof meta.display_name === 'string' ? meta.display_name : null) ||
    (typeof meta.name === 'string' ? meta.name : null) ||
    (authUser.email ? authUser.email.split('@')[0] : 'Athlete');

  const profileGoal = typeof profile?.goal === 'string' ? profile.goal : null;
  const resolvedGoal =
    profileGoal && !(profileGoal === 'muscle gain' && metaGoal && metaGoal !== profileGoal)
      ? profileGoal
      : metaGoal || 'muscle gain';

  return {
    source: 'supabase',
    id: authUser.id,
    email: authUser.email ?? null,
    name,
    goal: resolvedGoal,
    joinDate: authUser.created_at || new Date().toISOString(),
    height_cm: profile?.height_cm ?? null,
    weight_kg: profile?.weight_kg ?? null,
    age: profile?.age ?? null,
    body_fat_pct: profile?.body_fat_pct ?? null,
    avatar_url: profile?.avatar_url ?? null,
    avatar_source: profile?.avatar_source ?? null,
  };
}

export async function loadUserIntoStore(authUser: SupabaseAuthUser | null | undefined): Promise<void> {
  if (!supabase || !authUser) return;
  // Never block login UX on remote profile queries.
  Store.set('user', buildUser({}, authUser));

  void (async () => {
    let profile: ProfileRow | null = null;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
      profile = (data as ProfileRow | null) ?? null;
    } catch {
      /* ignore */
    }

    if (!profile) {
      const stub = buildUser({}, authUser);
      const seeded = await upsertProfile(stub, {});
      if (!seeded.error) {
        try {
          const res = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle();
          profile = (res.data as ProfileRow | null) ?? null;
        } catch {
          /* ignore */
        }
      }
    }

    const built = buildUser(profile || {}, authUser);
    Store.set('user', built);

    // Repair old rows where signup goal wasn't persisted and defaulted to muscle gain.
    const profileGoal = typeof profile?.goal === 'string' ? profile.goal : null;
    const userMeta = (authUser.user_metadata || {}) as Record<string, unknown>;
    const metaGoal = typeof userMeta.goal === 'string' ? userMeta.goal : null;
    if (metaGoal && (profileGoal == null || (profileGoal === 'muscle gain' && profileGoal !== metaGoal))) {
      void upsertProfile(built, { goal: metaGoal }).catch(() => {});
    }

    // Keep Progress page baseline aligned with profile metrics from server.
    if (Number.isFinite(Number(built.weight_kg))) {
      const weightNum = Number(built.weight_kg);
      const bodyFatNum = Number.isFinite(Number(built.body_fat_pct))
        ? Number(built.body_fat_pct)
        : null;
      const today = new Date().toISOString().slice(0, 10);

      Store.update('progressData', (p: ProgressData) => {
        const arr = [...(p?.weight || [])];
        const last = arr.at(-1);
        if (!last || Math.abs(Number(last.value) - weightNum) > 0.0001) {
          arr.push({ date: today, value: weightNum });
        }
        return { ...p, weight: arr.slice(-30) };
      });

      Store.update('metricsLog', (log: MetricsLogEntry[] | undefined) => {
        const arr = [...(log || [])];
        const last = arr.at(-1);
        if (!last || Math.abs(Number(last.weight) - weightNum) > 0.0001) {
          arr.push({
            date: new Date().toISOString(),
            weight: weightNum,
            bodyFat: bodyFatNum,
            notes: '',
          });
        }
        return arr;
      });
    }

    try {
      const { data: gs } = await supabase
        .from('gymbuddy_app_state')
        .select('state')
        .eq('user_id', authUser.id)
        .maybeSingle();
      const st = (gs as { state?: unknown } | null)?.state;
      if (st && typeof st === 'object' && Object.keys(st as object).length > 0) {
        Store.applyCloudPatch(st as Record<string, unknown>);
      }
    } catch {
      /* ignore */
    }

    // Load personal records from relational table and mirror into Store.
    try {
      const { records } = await loadPersonalRecords(authUser.id);
      if (Array.isArray(records) && records.length > 0) {
        Store.set('records', records);

        // Keep strength chart compatible: only weight PRs feed `progress.personalRecords`.
        const prs: Record<string, string> = {};
        for (const r of records) {
          if (!r || r.metric_type !== 'weight') continue;
          const sets = Number(r.tertiary_value || 0);
          const reps = Number(r.secondary_value || 0);
          const weight = Number(r.value || 0);
          if (!r.exercise_name || !Number.isFinite(weight)) continue;
          prs[r.exercise_name] =
            `${weight} kg${reps > 0 ? ` x ${reps} reps` : ''}${sets > 0 ? ` • ${sets} sets` : ''}`;
        }
        Store.update('progressData', (p: ProgressData) => ({ ...p, personalRecords: prs }));
      } else {
        // Backfill: if the new table is empty, migrate JSON records once.
        const localRecords = Store.get('records') || [];
        if (localRecords.length > 0) await upsertPersonalRecords(localRecords);
      }
    } catch {
      /* ignore */
    }
  })();
}

export async function refreshUserFromRemote(): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) await loadUserIntoStore(session.user);
}

export async function hydrateAuthSession(): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) await loadUserIntoStore(session.user);
}

let authListenerUnsubscribe: (() => void) | null = null;

export function ensureAuthSubscription(): (() => void) | null {
  if (!isSupabaseConfigured() || !supabase || authListenerUnsubscribe) return authListenerUnsubscribe;

  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) await loadUserIntoStore(session.user);
    else if (event === 'SIGNED_OUT') {
      const cur = Store.get('user');
      if (cur?.source === 'supabase') Store.logoutSupabaseCleanup();
    }
  });

  const subscription = (data as { subscription?: Subscription } | null)?.subscription;
  authListenerUnsubscribe = () => subscription?.unsubscribe?.();
  return authListenerUnsubscribe;
}
