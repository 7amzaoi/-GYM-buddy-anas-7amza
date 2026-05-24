import { getExerciseById } from './data.js';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient.js';
import { upsertPersonalRecords } from './services/personalRecordsApi.js';

const STATE_VERSION = 2;

/* ====================== Types ====================== */

export interface WeightEntry {
  date: string;
  value: number;
}

export interface CaloriesEntry {
  date: string;
  value: number;
}

export interface WeeklyPerformance {
  strengthVolume: number[];
  caloriesBurned: number[];
  duration: number[];
}

export interface ProgressData {
  weight: WeightEntry[];
  calories: CaloriesEntry[];
  workoutsThisWeek: number;
  totalWorkouts: number;
  streak: number;
  totalVolume: number;
  personalRecords: Record<string, string>;
  weeklyPerformance: WeeklyPerformance;
  [key: string]: unknown;
}

export interface User {
  source: 'local' | 'supabase';
  id?: string;
  email?: string | null;
  name: string;
  goal?: string;
  joinDate: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  age?: number | null;
  body_fat_pct?: number | null;
  [key: string]: unknown;
}

export interface SessionSet {
  weight: string | number;
  reps: string | number;
  done: boolean;
  [key: string]: unknown;
}

export interface SessionExercise {
  id: string;
  done?: boolean;
  sets?: SessionSet[];
  [key: string]: unknown;
}

export interface ActiveSession {
  planId: string | null;
  planName: string;
  isFreestyle?: boolean;
  exercises: SessionExercise[];
  startTime: number;
  calories: number;
  [key: string]: unknown;
}

export interface ExerciseLogEntry {
  id: string;
  volume: number;
  doneSets: number;
  bestWeight: number;
  bestReps: number;
}

export interface HistoryEntry {
  id: string;
  planId: string | null;
  planName: string;
  date: string;
  duration: number;
  exercises: number;
  exerciseLog: ExerciseLogEntry[];
  completed: number;
  calories: number;
  volume: number;
  [key: string]: unknown;
}

export interface RecordEntry {
  id?: string;
  exercise_id?: string;
  exercise_name?: string;
  category?: string;
  metric_type?: string;
  value?: number;
  unit?: string | null;
  secondary_value?: number | null;
  secondary_unit?: string | null;
  tertiary_value?: number | null;
  tertiary_unit?: string | null;
  recorded_at?: string;
  source?: string;
  [key: string]: unknown;
}

export interface CustomPlan {
  id: string;
  name: string;
  category: string;
  duration: number | string;
  level: string;
  description: string;
  exercises: string[];
  calories: number;
}

export interface BodyMeasurement {
  id: string;
  date: string;
  chest: number | null;
  shoulders: number | null;
  biceps: number | null;
  waist: number | null;
  hips: number | null;
  thighs: number | null;
  calves: number | null;
  neck: number | null;
  notes: string | null;
}

export interface MetricsLogEntry {
  date: string;
  weight: number;
  bodyFat: number | null;
  notes: string;
}

export interface ChatMessage {
  role: string;
  text: string;
  [key: string]: unknown;
}

export interface AppState {
  user: User | null;
  currentPage: string;
  workoutHistory: HistoryEntry[];
  customPlans: CustomPlan[];
  progressData: ProgressData;
  records: RecordEntry[];
  chatMessages: ChatMessage[];
  activeSession: ActiveSession | null;
  bodyMeasurements: BodyMeasurement[];
  metricsLog?: MetricsLogEntry[];
  waterIntake?: number;
  _stateVersion: number;
  // Loose escape hatch for ad-hoc keys consumers may write at runtime.
  [key: string]: unknown;
}

type Listener = (state: AppState) => void;

/* ====================== Helpers ====================== */

function emptyProgressData(): ProgressData {
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
      duration: [0, 0, 0, 0, 0, 0, 0],
    },
  };
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function startOfDay(d: Date | string | number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export interface DerivedStats {
  totalWorkouts: number;
  workoutsThisWeek: number;
  streak: number;
}

export function deriveStatsFromHistory(history: HistoryEntry[] = []): DerivedStats {
  const valid = (history || []).filter(
    (h) => h && h.date && Number.isFinite(Date.parse(h.date))
  );
  const totalWorkouts = valid.length;

  const todayStart = startOfDay(new Date()).getTime();
  const weekAgo = todayStart - 6 * 24 * 60 * 60 * 1000;
  const workoutsThisWeek = valid.filter(
    (h) => startOfDay(new Date(h.date)).getTime() >= weekAgo
  ).length;

  const dayKeys = new Set(valid.map((h) => startOfDay(new Date(h.date)).getTime()));
  let streak = 0;
  const cursor = new Date(todayStart);
  if (!dayKeys.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (dayKeys.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { totalWorkouts, workoutsThisWeek, streak };
}

export interface CaloriesBucket {
  date: string;
  value: number;
}

export function deriveCaloriesByDay(
  history: HistoryEntry[] = [],
  days = 7
): CaloriesBucket[] {
  const valid = (history || []).filter((h) => h && h.date);
  const todayStart = startOfDay(new Date());
  const buckets: CaloriesBucket[] = Array.from({ length: days }, (_, i) => {
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

export function deriveWeeklyPerformanceFromHistory(
  history: HistoryEntry[] = []
): WeeklyPerformance {
  const todayStart = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const idx = new Map(days.map((d, i) => [d, i]));
  const out: WeeklyPerformance = {
    strengthVolume: Array(7).fill(0),
    caloriesBurned: Array(7).fill(0),
    duration: Array(7).fill(0),
  };
  for (const h of history || []) {
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

export function deriveStrengthIndex(records: RecordEntry[] = []): number {
  const weights = (records || []).filter((r) => r?.metric_type === 'weight');
  let total = 0;
  for (const r of weights) {
    const w = Number(r.value) || 0;
    const reps = Number(r.secondary_value) || 1;
    total += w * (1 + reps / 30);
  }
  return Math.round(total);
}

export function buildPersonalRecordsMap(
  records: RecordEntry[] = []
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of records || []) {
    if (r?.metric_type !== 'weight' || !r?.exercise_name) continue;
    const reps = Number(r.secondary_value) || 0;
    const sets = Number(r.tertiary_value) || 0;
    out[r.exercise_name] =
      `${Number(r.value) || 0} kg${reps > 0 ? ` x ${reps} reps` : ''}${sets > 0 ? ` • ${sets} sets` : ''}`;
  }
  return out;
}

/* ====================== Store ====================== */

export interface LogoutOptions {
  skipRemote?: boolean;
}

export interface BodyMeasurementInput {
  chest?: unknown;
  shoulders?: unknown;
  biceps?: unknown;
  waist?: unknown;
  hips?: unknown;
  thighs?: unknown;
  calves?: unknown;
  neck?: unknown;
  notes?: unknown;
}

export interface CustomPlanInput {
  name: string;
  category: string;
  duration: number | string;
  level?: string;
  description?: string;
  exercises?: string[];
  calories?: number;
}

interface StoreShape {
  _state: AppState;
  _listeners: Listener[];

  init(): void;
  _migrateIfNeeded(): void;
  recomputeDerivedStats(): void;
  get<K extends keyof AppState>(key: K): AppState[K];
  get(key: string): unknown;
  set<K extends keyof AppState>(key: K, value: AppState[K]): void;
  set(key: string, value: unknown): void;
  update<K extends keyof AppState>(key: K, fn: (current: AppState[K]) => AppState[K]): void;
  update(key: string, fn: (current: unknown) => unknown): void;
  applyCloudPatch(patch: Partial<AppState> | null | undefined): void;
  _save(): void;
  _notify(): void;
  subscribe(fn: Listener): () => void;
  login(email: string, name: string): void;
  logout(options?: LogoutOptions): void;
  logoutSupabaseCleanup(): void;
  register(name: string, email: string, goal?: string): void;
  startSession(planId: string): void;
  startFreestyleSession(): void;
  addExerciseToSession(exerciseId: string): void;
  removeExerciseFromSession(idx: number): void;
  discardSession(): void;
  logBodyMeasurements(values: BodyMeasurementInput): void;
  removeBodyMeasurement(id: string): void;
  completeSession(): void;
  captureAutoRecordsFromSession(session: ActiveSession | null | undefined): void;
  addCustomPlan(plan: CustomPlanInput): void;
  deleteCustomPlan(id: string): void;
}

export const Store: StoreShape = {
  _state: {} as AppState,
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
        } catch {
          /* ignore */
        }
      }
    }
    const defaults: AppState = {
      user: null,
      currentPage: 'landing',
      workoutHistory: [],
      customPlans: [],
      progressData: emptyProgressData(),
      records: [],
      chatMessages: [],
      activeSession: null,
      bodyMeasurements: [],
      _stateVersion: STATE_VERSION,
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        this._state = { ...defaults, ...parsed };
        this._state.progressData = {
          ...emptyProgressData(),
          ...(parsed.progressData || {}),
        };
      } catch {
        this._state = defaults;
      }
    } else {
      this._state = defaults;
    }

    this._migrateIfNeeded();
    this.recomputeDerivedStats();
  },

  /** One-time wipe of legacy seed data carried over from previous releases. */
  _migrateIfNeeded() {
    const v = Number(this._state._stateVersion) || 0;
    if (v >= STATE_VERSION) return;

    const seededWeightDates = new Set([
      '2026-04-24',
      '2026-04-25',
      '2026-04-26',
      '2026-04-27',
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
    ]);
    const p = this._state.progressData || emptyProgressData();
    const weight = (p.weight || []).filter((w) => !seededWeightDates.has(w?.date));
    const calories = (p.calories || []).filter((c) => !seededWeightDates.has(c?.date));

    // Drop the fabricated weeklyPerformance — it will be re-derived from history.
    this._state.progressData = {
      ...p,
      weight,
      calories,
      weeklyPerformance: {
        strengthVolume: [0, 0, 0, 0, 0, 0, 0],
        caloriesBurned: [0, 0, 0, 0, 0, 0, 0],
        duration: [0, 0, 0, 0, 0, 0, 0],
      },
    };
    this._state._stateVersion = STATE_VERSION;
    try {
      localStorage.setItem('gymbuddy_state', JSON.stringify(this._state));
    } catch {
      /* ignore */
    }
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
      personalRecords,
    };
  },

  get(key: string) {
    return (this._state as Record<string, unknown>)[key];
  },

  set(key: string, value: unknown) {
    const state = this._state as Record<string, unknown>;
    if (Object.is(state[key], value)) return;
    state[key] = value;
    if (key === 'workoutHistory' || key === 'records') this.recomputeDerivedStats();
    this._save();
    this._notify();
  },

  update(key: string, fn: (current: unknown) => unknown) {
    const state = this._state as Record<string, unknown>;
    state[key] = fn(state[key]);
    if (key === 'workoutHistory' || key === 'records') this.recomputeDerivedStats();
    this._save();
    this._notify();
  },

  /** Merge server `gymbuddy_app_state.state` (never touches `user`). */
  applyCloudPatch(patch) {
    if (!patch || typeof patch !== 'object') return;
    const skip = new Set(['user']);
    const state = this._state as Record<string, unknown>;
    const patchObj = patch as Record<string, unknown>;
    for (const k of Object.keys(patchObj)) {
      if (skip.has(k)) continue;
      if (k === 'metricsLog') {
        const localLog = Array.isArray(state.metricsLog)
          ? (state.metricsLog as MetricsLogEntry[])
          : [];
        const remoteLog = Array.isArray(patchObj.metricsLog)
          ? (patchObj.metricsLog as MetricsLogEntry[])
          : [];
        const localLast = localLog.at(-1)?.date ? Date.parse(localLog.at(-1)!.date) : 0;
        const remoteLast = remoteLog.at(-1)?.date ? Date.parse(remoteLog.at(-1)!.date) : 0;
        // Never let an older cloud snapshot overwrite newer local metric logs.
        state.metricsLog = localLast > remoteLast ? localLog : remoteLog;
        continue;
      }
      if (k === 'progressData') {
        const localP = (state.progressData as ProgressData) || ({} as ProgressData);
        const remoteP = (patchObj.progressData as Partial<ProgressData>) || {};
        const localW = Array.isArray(localP.weight) ? localP.weight : [];
        const remoteW = Array.isArray(remoteP.weight) ? remoteP.weight : [];
        const localLastW = localW.at(-1)?.date ? Date.parse(localW.at(-1)!.date) : 0;
        const remoteLastW = remoteW.at(-1)?.date ? Date.parse(remoteW.at(-1)!.date) : 0;
        state.progressData =
          localLastW > remoteLastW
            ? { ...remoteP, ...localP, weight: localW }
            : { ...localP, ...remoteP };
        continue;
      }
      state[k] = patchObj[k];
    }
    this.recomputeDerivedStats();
    try {
      localStorage.setItem('gymbuddy_state', JSON.stringify(this._state));
    } catch {
      /* ignore */
    }
    this._notify();
  },

  _save() {
    try {
      localStorage.setItem('gymbuddy_state', JSON.stringify(this._state));
    } catch {
      /* ignore */
    }
    try {
      const u = this._state.user;
      if (isSupabaseConfigured() && u?.id && u.source === 'supabase') {
        import('./sync/cloudMirror.js')
          .then((m) => m.scheduleCloudMirrorDebounced())
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
  },

  _notify() {
    this._listeners.forEach((fn) => fn(this._state));
  },
  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  },

  login(email, name) {
    this.set('user', {
      source: 'local',
      email,
      name,
      joinDate: new Date().toISOString(),
      goal: 'muscle gain',
    });
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
    this.set('user', {
      source: 'local',
      email,
      name,
      joinDate: new Date().toISOString(),
      goal: goal || 'muscle gain',
    });
    this.set('currentPage', 'dashboard');
  },

  startSession(planId) {
    try {
      const customs = this.get('customPlans') || [];
      const plan = customs.find((p) => p.id === planId);
      if (!plan) {
        console.warn('Plan not found:', planId);
        return;
      }
      this.set('activeSession', {
        planId,
        planName: plan.name,
        exercises: plan.exercises.map((eid: string) => ({ id: eid, done: false })),
        startTime: Date.now(),
        calories: plan.calories || 300,
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
    this.update('activeSession', (s: ActiveSession | null) => {
      if (!s) return s;
      const exData = getExerciseById(exerciseId);
      const numSets = exData ? exData.sets : 3;
      const sets: SessionSet[] = Array.from({ length: numSets }, () => ({
        weight: '',
        reps: '',
        done: false,
      }));
      s.exercises = [...(s.exercises || []), { id: exerciseId, sets }];
      // Re-estimate calories at ~50 kcal per exercise so the summary is sensible.
      s.calories = s.exercises.length * 50;
      return s;
    });
  },

  removeExerciseFromSession(idx) {
    this.update('activeSession', (s: ActiveSession | null) => {
      if (!s) return s;
      s.exercises = (s.exercises || []).filter((_, i: number) => i !== idx);
      s.calories = s.exercises.length * 50;
      return s;
    });
  },

  /** Discard the active session without saving to history. */
  discardSession() {
    this.set('activeSession', null);
  },

  /** Append a body-measurements entry. Empty values are stored as null. */
  logBodyMeasurements(values) {
    const entry: BodyMeasurement = {
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
      notes: ((values.notes as string | undefined) || '').toString().trim() || null,
    };
    this.update('bodyMeasurements', (list: BodyMeasurement[] | undefined) => [
      entry,
      ...(list || []),
    ]);
  },

  removeBodyMeasurement(id) {
    this.update('bodyMeasurements', (list: BodyMeasurement[] | undefined) =>
      (list || []).filter((b) => b.id !== id)
    );
  },

  completeSession() {
    const session = this.get('activeSession');
    if (!session) return;

    // Compute real lifted volume from logged sets so totalVolume and weeklyPerf reflect actual work.
    let sessionVolume = 0;
    for (const ex of session.exercises || []) {
      for (const ls of ex.sets || []) {
        if (!ls?.done) continue;
        const w = parseFloat(String(ls.weight)) || 0;
        const r = parseInt(String(ls.reps), 10) || 0;
        sessionVolume += w * r;
      }
    }

    // Per-exercise breakdown for analytics (Phase B): volume by muscle, overload hints, etc.
    const exerciseLog: ExerciseLogEntry[] = (session.exercises || [])
      .map((ex) => {
        let volume = 0;
        let bestWeight = 0,
          bestReps = 0;
        for (const ls of ex.sets || []) {
          if (!ls?.done) continue;
          const w = parseFloat(String(ls.weight)) || 0;
          const r = parseInt(String(ls.reps), 10) || 0;
          volume += w * r;
          if (w > bestWeight) {
            bestWeight = w;
            bestReps = r;
          }
        }
        const doneSets = (ex.sets || []).filter((s) => s.done).length;
        return { id: ex.id, volume, doneSets, bestWeight, bestReps };
      })
      .filter((e) => e.doneSets > 0);

    const entry: HistoryEntry = {
      id: Date.now().toString(),
      planId: session.planId,
      planName: session.planName,
      date: new Date().toISOString(),
      duration: Math.round((Date.now() - session.startTime) / 60000),
      exercises: session.exercises.length,
      exerciseLog,
      completed: session.exercises.filter((e) => (e.sets || []).some((s) => s.done)).length,
      calories: Number(session.calories) || 0,
      volume: sessionVolume,
    };

    this.update('workoutHistory', (h: HistoryEntry[]) => [entry, ...h]);
    this.captureAutoRecordsFromSession(session);

    this.update('progressData', (p: ProgressData) => ({
      ...p,
      totalVolume: (Number(p.totalVolume) || 0) + sessionVolume,
    }));

    // Refresh totals/streak/weeklyPerf/calories from authoritative history + records.
    this.recomputeDerivedStats();
    this._save();
    this._notify();

    this.set('activeSession', null);
  },

  captureAutoRecordsFromSession(session) {
    if (!session?.exercises?.length) return;
    const nowIso = new Date().toISOString();
    const updates: RecordEntry[] = [];

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
        const timeVals = doneSets
          .map((s) => Number(s.weight || 0))
          .filter((v) => Number.isFinite(v));
        const distVals = doneSets
          .map((s) => Number(s.reps || 0))
          .filter((v) => Number.isFinite(v));
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
        const weightVals = doneSets
          .map((s) => Number(s.weight || 0))
          .filter((v) => Number.isFinite(v));
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

    if (updates.length === 0) return;

    const existingRecords = this.get('records') || [];

    const isBetter = (candidate: RecordEntry, current?: RecordEntry): boolean => {
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
        return (
          tTime > cTime ||
          (tTime === cTime && (tDist > cDist || (tDist === cDist && tSets > cSets)))
        );
      }
      return Number(candidate.value || 0) > Number(current.value || 0);
    };

    const toUpsert = updates.filter((cand) => {
      const cur = existingRecords.find(
        (x) => x.exercise_id === cand.exercise_id && x.metric_type === cand.metric_type
      );
      return isBetter(cand, cur);
    });

    this.update('records', (records: RecordEntry[]) => {
      const next = [...(records || [])];

      for (const r of updates) {
        const idx = next.findIndex(
          (x) => x.exercise_id === r.exercise_id && x.metric_type === r.metric_type
        );
        if (idx === -1) {
          next.push({ ...r, id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` });
          continue;
        }
        const cur = next[idx];
        if (isBetter(r, cur)) next[idx] = { ...cur, ...r, id: cur.id };
      }
      return next;
    });

    this.update('progressData', (p: ProgressData) => {
      const prs = { ...(p.personalRecords || {}) };
      for (const r of updates) {
        // Keep personalRecords used by existing strength charts strictly for strength/fitness weight PRs.
        if (r.metric_type !== 'weight') continue;
        const sets = Number(r.tertiary_value || 0);
        const repsPart = r.secondary_value ? ` x ${r.secondary_value} reps` : '';
        const setsPart = sets > 0 ? ` • ${sets} sets` : '';
        const text = `${r.value} kg${repsPart}${setsPart}`;
        if (r.exercise_name) prs[r.exercise_name] = text;
      }
      return { ...p, personalRecords: prs };
    });

    // Persist PRs as real DB rows (so other devices don't rely on JSON state).
    try {
      const u = this.get('user');
      if (isSupabaseConfigured() && u?.source === 'supabase' && toUpsert.length > 0) {
        void upsertPersonalRecords(toUpsert).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  },

  addCustomPlan(plan) {
    const id = 'custom_' + Date.now();
    const newPlan: CustomPlan = {
      id,
      name: plan.name,
      category: plan.category,
      duration: plan.duration,
      level: plan.level || 'Custom',
      description: plan.description || 'Your custom workout plan.',
      exercises: plan.exercises || [],
      calories: plan.calories ?? 300,
    };
    this.update('customPlans', (cp: CustomPlan[]) => [...(cp || []), newPlan]);
  },

  deleteCustomPlan(id) {
    this.update('customPlans', (cp: CustomPlan[]) => (cp || []).filter((p) => p.id !== id));
  },
};
