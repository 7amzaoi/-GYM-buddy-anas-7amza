import { getExerciseById } from './data.js';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient.js';
import { upsertPersonalRecords } from './services/personalRecordsApi.js';

const STATE_VERSION = 2;

/**
 * State keys that live in memory only — never written to localStorage and
 * never mirrored to `gymbuddy_app_state`.
 *
 * `notifications` is here because the `public.notifications` TABLE is its
 * source of truth. Mirroring the slice would create a second, always-staler
 * copy that `applyCloudPatch` would then restore over the fresh one on the
 * next boot — and `isOpen` would come back as `true`, popping the sheet open
 * on load. Read it from the table via `refreshNotifications()` instead.
 *
 * Imported by sync/cloudMirror.js so both write paths strip the same keys.
 */
export const EPHEMERAL_STATE_KEYS = ['notifications'];

/** A copy of `state` safe to persist or upload. */
export function toPersistableState(state) {
  const out = { ...(state || {}) };
  for (const k of EPHEMERAL_STATE_KEYS) delete out[k];
  return out;
}

function emptyNotifications() {
  return { items: [], unreadCount: 0, isOpen: false };
}

function emptyProgressData() {
  return {
    weight: [],
    calories: [],
    workoutsThisWeek: 0,
    totalWorkouts: 0,
    streak: 0,
    totalVolume: 0,
    personalRecords: {},
    weeklyPerformance: {
      strengthVolume: [0, 0, 0, 0, 0, 0, 0],
      caloriesBurned: [0, 0, 0, 0, 0, 0, 0],
      duration: [0, 0, 0, 0, 0, 0, 0]
    }
  };
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function deriveStatsFromHistory(history = []) {
  const valid = (history || []).filter(h => h && h.date && Number.isFinite(Date.parse(h.date)));
  const totalWorkouts = valid.length;

  const todayStart = startOfDay(new Date()).getTime();
  const weekAgo = todayStart - 6 * 24 * 60 * 60 * 1000;
  const workoutsThisWeek = valid.filter(h => startOfDay(new Date(h.date)).getTime() >= weekAgo).length;

  const dayKeys = new Set(valid.map(h => startOfDay(new Date(h.date)).getTime()));
  let streak = 0;
  let cursor = new Date(todayStart);
  if (!dayKeys.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (dayKeys.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { totalWorkouts, workoutsThisWeek, streak };
}

export function deriveCaloriesByDay(history = [], days = 7) {
  const valid = (history || []).filter(h => h && h.date);
  const todayStart = startOfDay(new Date());
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - (days - 1 - i));
    return { date: d.toISOString().slice(0, 10), value: 0 };
  });
  const idx = new Map(buckets.map((b, i) => [b.date, i]));
  for (const h of valid) {
    const k = startOfDay(new Date(h.date)).toISOString().slice(0, 10);
    const i = idx.get(k);
    if (i !== undefined) buckets[i].value += Number(h.calories) || 0;
  }
  return buckets;
}

export function deriveWeeklyPerformanceFromHistory(history = []) {
  const todayStart = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const idx = new Map(days.map((d, i) => [d, i]));
  const out = {
    strengthVolume: Array(7).fill(0),
    caloriesBurned: Array(7).fill(0),
    duration: Array(7).fill(0)
  };
  for (const h of (history || [])) {
    if (!h?.date) continue;
    const k = startOfDay(new Date(h.date)).toISOString().slice(0, 10);
    const i = idx.get(k);
    if (i === undefined) continue;
    out.caloriesBurned[i] += Number(h.calories) || 0;
    out.duration[i] += Number(h.duration) || 0;
    out.strengthVolume[i] += Number(h.volume) || 0;
  }
  return out;
}

export function deriveStrengthIndex(records = []) {
  const weights = (records || []).filter(r => r?.metric_type === 'weight');
  let total = 0;
  for (const r of weights) {
    const w = Number(r.value) || 0;
    const reps = Number(r.secondary_value) || 1;
    total += w * (1 + reps / 30);
  }
  return Math.round(total);
}

export function buildPersonalRecordsMap(records = []) {
  const out = {};
  for (const r of records || []) {
    if (r?.metric_type !== 'weight' || !r?.exercise_name) continue;
    const reps = Number(r.secondary_value) || 0;
    const sets = Number(r.tertiary_value) || 0;
    out[r.exercise_name] = `${Number(r.value) || 0} kg${reps > 0 ? ` x ${reps} reps` : ''}${sets > 0 ? ` • ${sets} sets` : ''}`;
  }
  return out;
}

export const Store = {
  _state: {},
  _listeners: [],

  init() {
    // One-time migration: read from the legacy `gymforge_state` key if present
    // so users keep their data after the GymForge → GymBuddy rebrand.
    let saved = localStorage.getItem('gymbuddy_state');
    if (!saved) {
      const legacy = localStorage.getItem('gymforge_state');
      if (legacy) {
        saved = legacy;
        try {
          localStorage.setItem('gymbuddy_state', legacy);
          localStorage.removeItem('gymforge_state');
        } catch { /* ignore */ }
      }
    }
    const defaults = {
      user: null,
      currentPage: 'landing',
      workoutHistory: [],
      customPlans: [],
      progressData: emptyProgressData(),
      records: [],
      chatMessages: [],
      activeSession: null,
      bodyMeasurements: [],
      /** Sessions/week the user is aiming for — the denominator of the
       *  "x / y" readout on the Today screen. User-editable in Profile. */
      weeklyGoal: 5,
      notifications: emptyNotifications(),
      _stateVersion: STATE_VERSION
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this._state = { ...defaults, ...parsed };
        this._state.progressData = { ...emptyProgressData(), ...(parsed.progressData || {}) };
      }
      catch { this._state = defaults; }
    } else {
      this._state = defaults;
    }

    // Always start from a clean slice: it is memory-only, but an older build
    // may have persisted one before EPHEMERAL_STATE_KEYS existed.
    this._state.notifications = emptyNotifications();

    this._migrateIfNeeded();
    this.recomputeDerivedStats();
  },

  /** One-time wipe of legacy seed data carried over from previous releases. */
  _migrateIfNeeded() {
    const v = Number(this._state._stateVersion) || 0;
    if (v >= STATE_VERSION) return;

    const seededWeightDates = new Set([
      '2026-04-24', '2026-04-25', '2026-04-26',
      '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30'
    ]);
    const p = this._state.progressData || emptyProgressData();
    const weight = (p.weight || []).filter(w => !seededWeightDates.has(w?.date));
    const calories = (p.calories || []).filter(c => !seededWeightDates.has(c?.date));

    // Drop the fabricated weeklyPerformance — it will be re-derived from history.
    this._state.progressData = {
      ...p,
      weight,
      calories,
      weeklyPerformance: { strengthVolume: [0,0,0,0,0,0,0], caloriesBurned: [0,0,0,0,0,0,0], duration: [0,0,0,0,0,0,0] }
    };
    this._state._stateVersion = STATE_VERSION;
    try { localStorage.setItem('gymbuddy_state', JSON.stringify(toPersistableState(this._state))); } catch { /* ignore */ }
  },

  /** Recompute totals/streak/weeklyPerf from real history + records. Call after any history/records change. */
  recomputeDerivedStats() {
    const history = this._state.workoutHistory || [];
    const records = this._state.records || [];
    const stats = deriveStatsFromHistory(history);
    const weeklyPerformance = deriveWeeklyPerformanceFromHistory(history);
    const calories = deriveCaloriesByDay(history, 7);
    const personalRecords = buildPersonalRecordsMap(records);

    this._state.progressData = {
      ...emptyProgressData(),
      ...this._state.progressData,
      ...stats,
      weeklyPerformance,
      calories,
      personalRecords
    };
  },

  get(key) { return this._state[key]; },

  set(key, value) {
    if (Object.is(this._state[key], value)) return;
    this._state[key] = value;
    if (key === 'workoutHistory' || key === 'records') this.recomputeDerivedStats();
    this._save();
    this._notify();
  },

  update(key, fn) {
    this._state[key] = fn(this._state[key]);
    if (key === 'workoutHistory' || key === 'records') this.recomputeDerivedStats();
    this._save();
    this._notify();
  },

  /** Merge server `gymbuddy_app_state.state` (never touches `user`). */
  applyCloudPatch(patch) {
    if (!patch || typeof patch !== 'object') return;
    // Also skip the memory-only keys: an app_state row written by an older
    // build may still carry a stale `notifications` blob.
    const skip = new Set(['user', ...EPHEMERAL_STATE_KEYS]);
    for (const k of Object.keys(patch)) {
      if (skip.has(k)) continue;
      if (k === 'metricsLog') {
        const localLog = Array.isArray(this._state.metricsLog) ? this._state.metricsLog : [];
        const remoteLog = Array.isArray(patch.metricsLog) ? patch.metricsLog : [];
        const localLast = localLog.at(-1)?.date ? Date.parse(localLog.at(-1).date) : 0;
        const remoteLast = remoteLog.at(-1)?.date ? Date.parse(remoteLog.at(-1).date) : 0;
        // Never let an older cloud snapshot overwrite newer local metric logs.
        this._state.metricsLog = localLast > remoteLast ? localLog : remoteLog;
        continue;
      }
      if (k === 'progressData') {
        const localP = this._state.progressData || {};
        const remoteP = patch.progressData || {};
        const localW = Array.isArray(localP.weight) ? localP.weight : [];
        const remoteW = Array.isArray(remoteP.weight) ? remoteP.weight : [];
        const localLastW = localW.at(-1)?.date ? Date.parse(localW.at(-1).date) : 0;
        const remoteLastW = remoteW.at(-1)?.date ? Date.parse(remoteW.at(-1).date) : 0;
        this._state.progressData = localLastW > remoteLastW
          ? { ...remoteP, ...localP, weight: localW }
          : { ...localP, ...remoteP };
        continue;
      }
      this._state[k] = patch[k];
    }
    this.recomputeDerivedStats();
    try { localStorage.setItem('gymbuddy_state', JSON.stringify(toPersistableState(this._state))); } catch { /* ignore */ }
    this._notify();
  },

  _save() {
    try { localStorage.setItem('gymbuddy_state', JSON.stringify(toPersistableState(this._state))); } catch { /* ignore */ }
    try {
      const u = this._state.user;
      if (isSupabaseConfigured() && u?.id && u.source === 'supabase') {
        import('./sync/cloudMirror.js').then(m => m.scheduleCloudMirrorDebounced()).catch(() => {});
      }
    } catch { /* ignore */ }
  },

  _notify() { this._listeners.forEach(fn => fn(this._state)); },
  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  },

  login(email, name) {
    this.set('user', { source: 'local', email, name, joinDate: new Date().toISOString(), goal: 'muscle gain' });
    this.set('currentPage', 'dashboard');
  },

  logout(options = {}) {
    const skipRemote = options.skipRemote === true;
    const u = this.get('user');
    if (!skipRemote && u?.source === 'supabase' && isSupabaseConfigured() && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    this.set('user', null);
    this.set('currentPage', 'landing');
    this.set('chatMessages', []);
    this.set('activeSession', null);
  },

  /** After remote sign-out (listener) — skips another signOut RPC */
  logoutSupabaseCleanup() {
    this.logout({ skipRemote: true });
  },

  register(name, email, goal) {
    this.set('user', { source: 'local', email, name, joinDate: new Date().toISOString(), goal: goal || 'muscle gain' });
    this.set('currentPage', 'dashboard');
  },

  startSession(planId) {
    try {
      const customs = this.get('customPlans') || [];
      const plan = customs.find(p => p.id === planId);
      if (!plan) { console.warn('Plan not found:', planId); return; }
      this.set('activeSession', {
        planId, planName: plan.name,
        exercises: plan.exercises.map(eid => ({ id: eid, done: false })),
        startTime: Date.now(), calories: plan.calories || 300
      });
    } catch (err) {
      console.error('startSession error:', err);
    }
  },

  /** Starts an empty freestyle workout — exercises added on the fly. */
  startFreestyleSession() {
    this.set('activeSession', {
      planId: null,
      planName: 'Freestyle Workout',
      isFreestyle: true,
      exercises: [],
      startTime: Date.now(),
      calories: 0,
    });
  },

  /** Append an exercise (with default sets pre-filled) to the active session. */
  addExerciseToSession(exerciseId) {
    this.update('activeSession', s => {
      if (!s) return s;
      const exData = getExerciseById(exerciseId);
      const numSets = exData ? exData.sets : 3;
      const sets = Array.from({ length: numSets }, () => ({ weight: '', reps: '', done: false }));
      s.exercises = [...(s.exercises || []), { id: exerciseId, sets }];
      // Re-estimate calories at ~50 kcal per exercise so the summary is sensible.
      s.calories = (s.exercises.length) * 50;
      return s;
    });
  },

  removeExerciseFromSession(idx) {
    this.update('activeSession', s => {
      if (!s) return s;
      s.exercises = (s.exercises || []).filter((_, i) => i !== idx);
      s.calories = (s.exercises.length) * 50;
      return s;
    });
  },

  /** Discard the active session without saving to history. */
  discardSession() {
    this.set('activeSession', null);
  },

  /** Append a body-measurements entry. Empty values are stored as null. */
  logBodyMeasurements(values) {
    const entry = {
      id: `bm_${Date.now()}`,
      date: new Date().toISOString(),
      chest: numOrNull(values.chest),
      shoulders: numOrNull(values.shoulders),
      biceps: numOrNull(values.biceps),
      waist: numOrNull(values.waist),
      hips: numOrNull(values.hips),
      thighs: numOrNull(values.thighs),
      calves: numOrNull(values.calves),
      neck: numOrNull(values.neck),
      notes: (values.notes || '').toString().trim() || null,
    };
    this.update('bodyMeasurements', list => [entry, ...(list || [])]);
  },

  removeBodyMeasurement(id) {
    this.update('bodyMeasurements', list => (list || []).filter(b => b.id !== id));
  },

  completeSession() {
    const session = this.get('activeSession');
    if (!session) return { newPRs: 0 };

    // Compute real lifted volume from logged sets so totalVolume and weeklyPerf reflect actual work.
    let sessionVolume = 0;
    for (const ex of session.exercises || []) {
      for (const ls of ex.sets || []) {
        if (!ls?.done) continue;
        const w = parseFloat(ls.weight) || 0;
        const r = parseInt(ls.reps, 10) || 0;
        sessionVolume += w * r;
      }
    }

    // Per-exercise breakdown for analytics (Phase B): volume by muscle, overload hints, etc.
    const exerciseLog = (session.exercises || []).map(ex => {
      let volume = 0;
      let bestWeight = 0, bestReps = 0;
      for (const ls of (ex.sets || [])) {
        if (!ls?.done) continue;
        const w = parseFloat(ls.weight) || 0;
        const r = parseInt(ls.reps, 10) || 0;
        volume += w * r;
        if (w > bestWeight) { bestWeight = w; bestReps = r; }
      }
      const doneSets = (ex.sets || []).filter(s => s.done).length;
      return { id: ex.id, volume, doneSets, bestWeight, bestReps };
    }).filter(e => e.doneSets > 0);

    const entry = {
      id: Date.now().toString(),
      planId: session.planId,
      planName: session.planName,
      date: new Date().toISOString(),
      duration: Math.round((Date.now() - session.startTime) / 60000),
      exercises: session.exercises.length,
      exerciseLog,
      completed: session.exercises.filter(e => (e.sets || []).some(s => s.done)).length,
      calories: Number(session.calories) || 0,
      volume: sessionVolume
    };

    this.update('workoutHistory', h => [entry, ...h]);
    const newPRs = this.captureAutoRecordsFromSession(session);

    this.update('progressData', p => ({
      ...p,
      totalVolume: (Number(p.totalVolume) || 0) + sessionVolume
    }));

    // Refresh totals/streak/weeklyPerf/calories from authoritative history + records.
    this.recomputeDerivedStats();
    this._save();
    this._notify();

    this.set('activeSession', null);

    // Fire-and-forget: streak and PR records are both final by this point.
    // Never awaited — the finish flow must not wait on the network, and the
    // engine swallows its own errors.
    void this._runNotificationSuggestions('session-finish');

    return { newPRs };
  },

  /** Lazy so the suggestion engine (and its Supabase calls) stay out of the
   *  boot chunk, and so store.js keeps no static dependency on a module that
   *  imports it back. */
  _runNotificationSuggestions(trigger) {
    if (!isSupabaseConfigured()) return Promise.resolve(0);
    return import('./services/notificationSuggestions.js')
      .then((m) => m.runSuggestionChecks({ trigger }))
      .catch(() => 0);
  },

  /**
   * Remove a logged session. `workoutHistory` was previously append-only —
   * `completeSession` was its single writer and there was no way to delete an
   * entry, so a session logged by mistake (or legacy seed data, which the v2
   * migration wiped from weight/calories but NOT from history) was permanent
   * short of clearing all app data.
   *
   * Matches on `id`, falling back to planName+date for pre-id entries.
   * Derived stats (streak, weekly volume, totals) are recomputed after.
   */
  deleteWorkoutFromHistory(idOrKey) {
    let removed = 0;
    this.update('workoutHistory', (h) => {
      const next = (h || []).filter((w) => {
        const match = w.id ? w.id === idOrKey : `${w.planName}${w.date}` === idOrKey;
        if (match) removed++;
        return !match;
      });
      return next;
    });
    if (removed) {
      this.recomputeDerivedStats();
      this._save();
      this._notify();
    }
    return removed;
  },

  captureAutoRecordsFromSession(session) {
    if (!session?.exercises?.length) return 0;
    const nowIso = new Date().toISOString();
    const updates = [];

    for (const ex of session.exercises) {
      const exData = getExerciseById(ex.id);
      if (!exData) continue;
      const doneSets = (ex.sets || []).filter((s) => s.done);
      if (doneSets.length === 0) continue;

      const category = ex.id.startsWith('c')
        ? 'cardio'
        : ex.id.startsWith('f')
          ? 'fitness'
          : 'strength';

      const setsCount = doneSets.length;

      if (category === 'cardio') {
        // Convention for cardio in the current Session UI:
        // - weight input = time (minutes)
        // - reps input = distance (km) (optional)
        const timeVals = doneSets.map((s) => Number(s.weight || 0)).filter((v) => Number.isFinite(v));
        const distVals = doneSets.map((s) => Number(s.reps || 0)).filter((v) => Number.isFinite(v));
        const timeMax = timeVals.length ? Math.max(...timeVals) : null;
        const distMax = distVals.length ? Math.max(...distVals) : null;
        if (timeMax != null) {
          updates.push({
            exercise_id: ex.id,
            exercise_name: exData.name,
            category,
            metric_type: 'cardio_sets',
            value: setsCount,
            unit: 'sets',
            secondary_value: timeMax,
            secondary_unit: 'min',
            tertiary_value: distMax,
            tertiary_unit: distMax != null ? 'km' : null,
            recorded_at: nowIso,
            source: 'session',
          });
        }
      } else {
        const weightVals = doneSets.map((s) => Number(s.weight || 0)).filter((v) => Number.isFinite(v));
        if (!weightVals.length) continue;
        const weightMax = Math.max(...weightVals);
        const repsAtMax = doneSets
          .filter((s) => Math.abs(Number(s.weight || 0) - weightMax) < 0.0001)
          .map((s) => Number(s.reps || 0))
          .filter((v) => Number.isFinite(v));
        const repsBest = repsAtMax.length ? Math.max(...repsAtMax) : null;

        updates.push({
          exercise_id: ex.id,
          exercise_name: exData.name,
          category,
          metric_type: 'weight',
          value: weightMax,
          unit: 'kg',
          secondary_value: repsBest,
          secondary_unit: repsBest != null ? 'reps' : null,
          tertiary_value: setsCount,
          tertiary_unit: 'sets',
          recorded_at: nowIso,
          source: 'session',
        });
      }
    }

    if (updates.length === 0) return 0;

    const existingRecords = this.get('records') || [];

    const isBetter = (candidate, current) => {
      if (!current) return true;
      if (candidate.metric_type === 'weight') {
        const cw = Number(current.value || 0);
        const cc = Number(current.secondary_value || 0);
        const tw = Number(candidate.value || 0);
        const tc = Number(candidate.secondary_value || 0);
        const ts = Number(candidate.tertiary_value || 0);
        const cs = Number(current.tertiary_value || 0);
        return tw > cw || (tw === cw && (tc > cc || (tc === cc && ts > cs)));
      }
      if (candidate.metric_type === 'cardio_sets') {
        const cTime = Number(current.secondary_value || 0);
        const tTime = Number(candidate.secondary_value || 0);
        const cDist = Number(current.tertiary_value || 0);
        const tDist = Number(candidate.tertiary_value || 0);
        const cSets = Number(current.value || 0);
        const tSets = Number(candidate.value || 0);
        return tTime > cTime || (tTime === cTime && (tDist > cDist || (tDist === cDist && tSets > cSets)));
      }
      return Number(candidate.value || 0) > Number(current.value || 0);
    };

    const toUpsert = updates.filter((cand) => {
      const cur = existingRecords.find((x) => x.exercise_id === cand.exercise_id && x.metric_type === cand.metric_type);
      return isBetter(cand, cur);
    });

    this.update('records', (records) => {
      const next = [...(records || [])];

      for (const r of updates) {
        const idx = next.findIndex((x) => x.exercise_id === r.exercise_id && x.metric_type === r.metric_type);
        if (idx === -1) {
          next.push({ ...r, id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` });
          continue;
        }
        const cur = next[idx];
        if (isBetter(r, cur)) next[idx] = { ...cur, ...r, id: cur.id };
      }
      return next;
    });

    this.update('progressData', (p) => {
      const prs = { ...(p.personalRecords || {}) };
      for (const r of updates) {
        // Keep personalRecords used by existing strength charts strictly for strength/fitness weight PRs.
        if (r.metric_type !== 'weight') continue;
        const sets = Number(r.tertiary_value || 0);
        const repsPart = r.secondary_value ? ` x ${r.secondary_value} reps` : '';
        const setsPart = sets > 0 ? ` • ${sets} sets` : '';
        const text = `${r.value} kg${repsPart}${setsPart}`;
        prs[r.exercise_name] = text;
      }
      return { ...p, personalRecords: prs };
    });

    // Persist PRs as real DB rows (so other devices don't rely on JSON state).
    try {
      const u = this.get('user');
      if (isSupabaseConfigured() && u?.source === 'supabase' && toUpsert.length > 0) {
        void upsertPersonalRecords(toUpsert).catch(() => {});
      }
    } catch {}

    // Number of exercises that set a genuinely-better record this session.
    return toUpsert.length;
  },

  // ---------------------------------------------------------------- notifications
  // The `public.notifications` table is the source of truth; this slice is a
  // memory-only view of it (see EPHEMERAL_STATE_KEYS). Every mutation writes
  // through to the table first, then updates the slice, so a reload re-reads
  // the same answer rather than trusting local state.
  //
  // `_setNotifications` bypasses `set()` deliberately: `set()` persists, and
  // this slice must never reach localStorage or the cloud mirror.
  _setNotifications(fn) {
    const prev = this._state.notifications || { items: [], unreadCount: 0, isOpen: false };
    this._state.notifications = { ...prev, ...fn(prev) };
    this._notify();
  },

  openNotifications() {
    this._setNotifications(() => ({ isOpen: true }));
    // Opening is the natural moment to re-read — the sheet should not show a
    // list that went stale while the app sat in the background.
    void this.refreshNotifications();
  },

  closeNotifications() {
    this._setNotifications(() => ({ isOpen: false }));
  },

  /** Re-read the feed + unread count from the table. Safe to call anytime. */
  async refreshNotifications() {
    const u = this.get('user');
    if (!isSupabaseConfigured() || u?.source !== 'supabase') {
      this._setNotifications(() => ({ items: [], unreadCount: 0 }));
      return;
    }
    try {
      const api = await import('./services/notificationsApi.js');
      const [{ notifications, error }, { count }] = await Promise.all([
        api.list({ limit: 30 }),
        api.unreadCount(),
      ]);
      if (error) return;
      this._setNotifications(() => ({ items: notifications, unreadCount: count }));
    } catch { /* offline — keep whatever is on screen */ }
  },

  async markNotificationRead(id) {
    if (id == null) return;
    const before = this._state.notifications?.items || [];
    if (!before.some((n) => n.id === id && !n.read_at)) return; // already read

    try {
      const { markRead } = await import('./services/notificationsApi.js');
      const { error } = await markRead([id]);
      if (error) return;
    } catch { return; }

    const readAt = new Date().toISOString();
    this._setNotifications((p) => ({
      items: p.items.map((n) => (n.id === id ? { ...n, read_at: n.read_at || readAt } : n)),
      unreadCount: Math.max(0, p.unreadCount - 1),
    }));
  },

  async markAllNotificationsRead() {
    if ((this._state.notifications?.unreadCount || 0) === 0) return;

    try {
      const { markAllRead } = await import('./services/notificationsApi.js');
      const { error } = await markAllRead();
      if (error) return;
    } catch { return; }

    const readAt = new Date().toISOString();
    this._setNotifications((p) => ({
      items: p.items.map((n) => (n.read_at ? n : { ...n, read_at: readAt })),
      unreadCount: 0,
    }));
  },

  addCustomPlan(plan) {
    const id = 'custom_' + Date.now();
    const newPlan = {
      id,
      name: plan.name,
      category: plan.category,
      duration: plan.duration,
      level: plan.level || 'Custom',
      description: plan.description || 'Your custom workout plan.',
      exercises: plan.exercises || [],
      calories: plan.calories ?? 300
    };
    this.update('customPlans', cp => [...(cp || []), newPlan]);
  },

  deleteCustomPlan(id) {
    this.update('customPlans', cp => (cp || []).filter(p => p.id !== id));
  },

  /**
   * Rename a plan in place.
   *
   * The id is deliberately untouched: history entries reference the plan by
   * `planId`, so keeping it preserves "last trained" and the completed stamp.
   * Deleting and recreating — the only way to rename before this existed —
   * silently broke both.
   */
  renameCustomPlan(id, name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    let changed = false;
    this.update('customPlans', cp => (cp || []).map(p => {
      if (p.id !== id || p.name === clean) return p;
      changed = true;
      return { ...p, name: clean };
    }));
    return changed;
  },
};
