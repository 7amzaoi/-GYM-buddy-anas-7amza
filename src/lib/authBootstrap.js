import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { Store } from '../store.js';
import { upsertProfile } from '../services/profilesApi.js';
import { loadPersonalRecords, upsertPersonalRecords } from '../services/personalRecordsApi.js';

function buildUser(profile, authUser) {
  const meta = authUser.user_metadata || {};
  const metaGoal = typeof meta.goal === 'string' ? meta.goal : null;
  const name =
    profile?.display_name ||
    meta.display_name ||
    meta.name ||
    (authUser.email ? authUser.email.split('@')[0] : 'Athlete');

  const profileGoal = typeof profile?.goal === 'string' ? profile.goal : null;
  const resolvedGoal =
    profileGoal && !(profileGoal === 'muscle gain' && metaGoal && metaGoal !== profileGoal)
      ? profileGoal
      : (metaGoal || 'muscle gain');

  return {
    source: 'supabase',
    id: authUser.id,
    email: authUser.email,
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

export async function loadUserIntoStore(authUser) {
  if (!supabase || !authUser) return;
  // Never block login UX on remote profile queries.
  Store.set('user', buildUser({}, authUser));

  void (async () => {
    let profile = null;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
      profile = data ?? null;
    } catch {}

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
          profile = res.data ?? null;
        } catch {}
      }
    }

    const built = buildUser(profile || {}, authUser);
    Store.set('user', built);

    // Repair old rows where signup goal wasn't persisted and defaulted to muscle gain.
    const profileGoal = typeof profile?.goal === 'string' ? profile.goal : null;
    const metaGoal = typeof authUser?.user_metadata?.goal === 'string' ? authUser.user_metadata.goal : null;
    if (metaGoal && (profileGoal == null || (profileGoal === 'muscle gain' && profileGoal !== metaGoal))) {
      void upsertProfile(built, { goal: metaGoal }).catch(() => {});
    }

    // Keep Progress page baseline aligned with profile metrics from server.
    if (Number.isFinite(Number(built.weight_kg))) {
      const weightNum = Number(built.weight_kg);
      const bodyFatNum = Number.isFinite(Number(built.body_fat_pct)) ? Number(built.body_fat_pct) : null;
      const today = new Date().toISOString().slice(0, 10);

      Store.update('progressData', p => {
        const arr = [...(p?.weight || [])];
        const last = arr.at(-1);
        if (!last || Math.abs(Number(last.value) - weightNum) > 0.0001) {
          arr.push({ date: today, value: weightNum });
        }
        return { ...p, weight: arr.slice(-30) };
      });

      Store.update('metricsLog', log => {
        const arr = [...(log || [])];
        const last = arr.at(-1);
        if (!last || Math.abs(Number(last.weight) - weightNum) > 0.0001) {
          arr.push({ date: new Date().toISOString(), weight: weightNum, bodyFat: bodyFatNum, notes: '' });
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
      const st = gs?.state;
      if (st && typeof st === 'object' && Object.keys(st).length > 0) {
        Store.applyCloudPatch(st);
      }
    } catch {}

    // Load personal records from relational table and mirror into Store.
    try {
      const { records } = await loadPersonalRecords(authUser.id);
      if (Array.isArray(records) && records.length > 0) {
        Store.set('records', records);

        // Keep strength chart compatible: only weight PRs feed `progress.personalRecords`.
        const prs = {};
        for (const r of records) {
          if (!r || r.metric_type !== 'weight') continue;
          const sets = Number(r.tertiary_value || 0);
          const reps = Number(r.secondary_value || 0);
          const weight = Number(r.value || 0);
          if (!r.exercise_name || !Number.isFinite(weight)) continue;
          prs[r.exercise_name] = `${weight} kg${reps > 0 ? ` x ${reps} reps` : ''}${sets > 0 ? ` • ${sets} sets` : ''}`;
        }
        Store.update('progressData', (p) => ({ ...p, personalRecords: prs }));
      } else {
        // Backfill: if the new table is empty, migrate JSON records once.
        const localRecords = Store.get('records') || [];
        if (localRecords.length > 0) await upsertPersonalRecords(localRecords);
      }
    } catch {}
  })();
}

export async function refreshUserFromRemote() {
  if (!isSupabaseConfigured() || !supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await loadUserIntoStore(session.user);
}

export async function hydrateAuthSession() {
  if (!isSupabaseConfigured() || !supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) await loadUserIntoStore(session.user);
}

let authListenerUnsubscribe = null;

export function ensureAuthSubscription() {
  if (!isSupabaseConfigured() || !supabase || authListenerUnsubscribe) return authListenerUnsubscribe;

  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) await loadUserIntoStore(session.user);
    else if (event === 'SIGNED_OUT') {
      const cur = Store.get('user');
      if (cur?.source === 'supabase') Store.logoutSupabaseCleanup();
    }
  });

  authListenerUnsubscribe = () => data?.subscription?.unsubscribe?.();
  return authListenerUnsubscribe;
}
