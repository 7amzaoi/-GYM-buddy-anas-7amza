/**
 * Gamification — XP, levels, achievements, streak freezes.
 * Pure derivations from existing Store data (history/records/progress). No new persistent state
 * needed for XP or badges; only `streakFreezesUsed` is stored.
 */
import { Store } from '../store.js';

/* ====================== Types ====================== */

export interface ExerciseLogEntry {
  doneSets?: number;
  [key: string]: unknown;
}

export interface HistoryEntry {
  date?: string | number | Date;
  volume?: number;
  exerciseLog?: ExerciseLogEntry[];
  [key: string]: unknown;
}

export interface RecordEntry {
  [key: string]: unknown;
}

export interface ProgressData {
  totalWorkouts?: number;
  streak?: number;
  [key: string]: unknown;
}

export interface ComputeXpInput {
  history?: HistoryEntry[];
  records?: RecordEntry[];
  streak?: number;
}

export interface LevelInfo {
  level: number;
  currentInLevel: number;
  neededForLevel: number;
  pct: number;
  totalXp: number;
  nextLevelAt: number;
}

export type BadgeTier = 'bronze' | 'silver' | 'gold';

export interface BadgeStats {
  totalWorkouts: number;
  streak: number;
  recordCount: number;
  totalVolume: number;
  level: number;
  earlyBird: boolean;
  nightOwl: boolean;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  desc: string;
  iconKey: string;
  tier: BadgeTier;
  test: (s: BadgeStats) => boolean;
}

export interface Badge extends Omit<BadgeDefinition, 'test'> {
  test: (s: BadgeStats) => boolean;
  unlocked: boolean;
}

export interface FreezeState {
  earned: number;
  used: number;
  available: number;
  untilNext: number;
}

/* ====================== XP & Levels ====================== */

/**
 * Total XP earned across the user's history.
 *   +50 per workout
 *   +5  per logged set
 *   +1  per 50 kg of volume
 *   +100 per personal record
 *   +10 per active streak day (current streak only)
 */
export function computeXp({ history = [], records = [], streak = 0 }: ComputeXpInput = {}): number {
  let xp = 0;
  for (const h of history) {
    xp += 50;
    const sets = (h.exerciseLog || []).reduce((sum, e) => sum + (e.doneSets || 0), 0);
    xp += sets * 5;
    xp += Math.floor((h.volume || 0) / 50);
  }
  xp += (records.length || 0) * 100;
  xp += streak * 10;
  return Math.max(0, Math.round(xp));
}

/** Cumulative XP required to reach `level`. Level 1 starts at 0. */
function xpForLevel(level: number): number {
  // 0, 100, ~283, ~520, ~800, ... (100 * (n-1)^1.5)
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 1.5));
}

/** Resolve XP → { level, currentInLevel, neededForLevel, pct, totalXp }. */
export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const totalForLevel = xpForLevel(level);
  const nextLevelAt = xpForLevel(level + 1);
  const neededForLevel = nextLevelAt - totalForLevel;
  const currentInLevel = xp - totalForLevel;
  const pct = neededForLevel > 0 ? Math.min(100, (currentInLevel / neededForLevel) * 100) : 100;
  return { level, currentInLevel, neededForLevel, pct, totalXp: xp, nextLevelAt };
}

/** Display-only title tier — purely cosmetic. */
export function titleForLevel(level: number): string {
  if (level <= 3) return 'Beginner';
  if (level <= 6) return 'Rookie';
  if (level <= 10) return 'Athlete';
  if (level <= 15) return 'Champion';
  if (level <= 20) return 'Elite';
  return 'Legend';
}

/* ====================== Achievement badges ====================== */

const BADGE_LIBRARY: BadgeDefinition[] = [
  // Workouts count
  { id: 'first-rep',    name: 'First Rep',      desc: 'Complete your first workout',         iconKey: 'check',    tier: 'bronze', test: (s) => s.totalWorkouts >= 1 },
  { id: 'wk-10',        name: '10 Workouts',    desc: 'Log 10 total workouts',               iconKey: 'dumbbell', tier: 'bronze', test: (s) => s.totalWorkouts >= 10 },
  { id: 'wk-25',        name: '25 Workouts',    desc: 'Log 25 total workouts',               iconKey: 'dumbbell', tier: 'silver', test: (s) => s.totalWorkouts >= 25 },
  { id: 'wk-50',        name: 'Half Century',   desc: 'Log 50 total workouts',               iconKey: 'trophy',   tier: 'silver', test: (s) => s.totalWorkouts >= 50 },
  { id: 'wk-100',       name: 'Centurion',      desc: 'Log 100 total workouts',              iconKey: 'trophy',   tier: 'gold',   test: (s) => s.totalWorkouts >= 100 },

  // Streaks
  { id: 'str-3',        name: 'On Fire',        desc: 'Reach a 3-day streak',                iconKey: 'fire',     tier: 'bronze', test: (s) => s.streak >= 3 },
  { id: 'str-7',        name: 'Week Warrior',   desc: 'Reach a 7-day streak',                iconKey: 'fire',     tier: 'silver', test: (s) => s.streak >= 7 },
  { id: 'str-30',       name: 'Iron Habit',     desc: 'Reach a 30-day streak',               iconKey: 'fire',     tier: 'gold',   test: (s) => s.streak >= 30 },

  // Records / Strength
  { id: 'pr-first',     name: 'First PR',       desc: 'Hit your first personal record',      iconKey: 'star',     tier: 'bronze', test: (s) => s.recordCount >= 1 },
  { id: 'pr-10',        name: 'Record Hunter',  desc: 'Hit 10 personal records',             iconKey: 'star',     tier: 'silver', test: (s) => s.recordCount >= 10 },

  // Volume
  { id: 'vol-1k',       name: 'First 1,000kg',  desc: 'Lift 1,000 kg total volume',          iconKey: 'zap',      tier: 'bronze', test: (s) => s.totalVolume >= 1000 },
  { id: 'vol-10k',      name: '10,000 Club',    desc: 'Lift 10,000 kg total volume',         iconKey: 'zap',      tier: 'silver', test: (s) => s.totalVolume >= 10000 },
  { id: 'vol-50k',      name: 'Half-Ton Hero',  desc: 'Lift 50,000 kg total volume',         iconKey: 'zap',      tier: 'gold',   test: (s) => s.totalVolume >= 50000 },

  // Variety / behaviour
  { id: 'level-5',      name: 'Rising Star',    desc: 'Reach Level 5',                       iconKey: 'arrow',    tier: 'bronze', test: (s) => s.level >= 5 },
  { id: 'level-10',     name: 'Seasoned',       desc: 'Reach Level 10',                      iconKey: 'arrow',    tier: 'silver', test: (s) => s.level >= 10 },
  { id: 'level-20',     name: 'Elite Tier',     desc: 'Reach Level 20',                      iconKey: 'arrow',    tier: 'gold',   test: (s) => s.level >= 20 },
  { id: 'early-bird',   name: 'Early Bird',     desc: 'Train before 8 AM',                   iconKey: 'clock',    tier: 'bronze', test: (s) => s.earlyBird },
  { id: 'night-owl',    name: 'Night Owl',      desc: 'Train after 9 PM',                    iconKey: 'clock',    tier: 'bronze', test: (s) => s.nightOwl },
];

export interface BuildBadgeStatsInput {
  history?: HistoryEntry[];
  records?: RecordEntry[];
  progress?: ProgressData;
  level: number;
}

/** Build the snapshot of stats used by badge `test()` predicates. */
function buildBadgeStats({ history, records, progress, level }: BuildBadgeStatsInput): BadgeStats {
  const recordCount = (records || []).length;
  let totalVolume = 0;
  let earlyBird = false;
  let nightOwl = false;
  for (const h of history || []) {
    totalVolume += Number(h.volume || 0);
    if (h.date) {
      const hr = new Date(h.date).getHours();
      if (hr < 8) earlyBird = true;
      if (hr >= 21) nightOwl = true;
    }
  }
  return {
    totalWorkouts: progress?.totalWorkouts || 0,
    streak: progress?.streak || 0,
    recordCount,
    totalVolume,
    level,
    earlyBird,
    nightOwl,
  };
}

/** Returns the full badge catalog with `unlocked` boolean attached. */
export function computeBadges({ history, records, progress, level }: BuildBadgeStatsInput): Badge[] {
  const stats = buildBadgeStats({ history, records, progress, level });
  return BADGE_LIBRARY.map((b) => ({ ...b, unlocked: !!b.test(stats) }));
}

/* ====================== Streak freezes ====================== */

const FREEZES_KEY = 'gymbuddy_streak_freezes_used';

/** Number of freezes already consumed by the user. */
export function getFreezesUsed(): number {
  try {
    const n = parseInt(localStorage.getItem(FREEZES_KEY) || '0', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Persist a new "used" total. Clamped to ≥ 0. */
export function setFreezesUsed(n: number): void {
  try {
    localStorage.setItem(FREEZES_KEY, String(Math.max(0, n | 0)));
  } catch {
    /* storage off */
  }
}

/**
 * Derive freeze counts:
 *   earned = floor(totalWorkouts / 7) — every 7 workouts buys a freeze
 *   used   = stored localStorage counter
 *   available = max(0, earned - used)
 */
export function computeFreezes(): FreezeState {
  const progress = (Store.get('progressData') as ProgressData | null | undefined) || {};
  const earned = Math.floor((progress.totalWorkouts || 0) / 7);
  const used = getFreezesUsed();
  const available = Math.max(0, earned - used);
  const totalWorkouts = progress.totalWorkouts || 0;
  // Workouts remaining until next freeze drops.
  const nextAt = (Math.floor(totalWorkouts / 7) + 1) * 7;
  const untilNext = Math.max(0, nextAt - totalWorkouts);
  return { earned, used, available, untilNext };
}

/** Consume one freeze and reset the user's streak to 1 (a "rescued" day). */
export function consumeFreeze(): { ok: boolean } {
  const { available } = computeFreezes();
  if (available <= 0) return { ok: false };
  setFreezesUsed(getFreezesUsed() + 1);
  Store.update('progressData', (p: ProgressData) => ({
    ...p,
    streak: Math.max(1, p.streak || 0) + 1,
  }));
  return { ok: true };
}
