/**
 * Smart notifications — derives personalized reminders, streak alerts and
 * motivational nudges from the current Store state. Pure functions only.
 */
import { Store } from '../store.js';

const DISMISS_KEY = 'gymbuddy_notif_dismissed';

export type NotificationTone = 'warn' | 'accent' | 'info';

export interface NotificationAction {
  label: string;
  page: string;
}

export interface SmartNotification {
  id: string;
  priority: number;
  tone: NotificationTone;
  iconKey: string;
  title: string;
  message: string;
  action: NotificationAction | null;
}

interface DismissBlob {
  day: string;
  ids: string[];
}

function startOfDay(d: Date | string | number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Today's date as a YYYY-MM-DD key — used to scope dismissals to one day. */
function todayKey(): string {
  return startOfDay(new Date()).toISOString().slice(0, 10);
}

export function getDismissed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') as Partial<DismissBlob>;
    return raw.day === todayKey() ? raw.ids || [] : [];
  } catch {
    return [];
  }
}

export function dismissNotification(id: string): void {
  try {
    const ids = new Set(getDismissed());
    ids.add(id);
    const blob: DismissBlob = { day: todayKey(), ids: [...ids] };
    localStorage.setItem(DISMISS_KEY, JSON.stringify(blob));
  } catch {
    /* storage unavailable — dismissal is best-effort */
  }
}

const GOAL_NUDGE: Record<string, string> = {
  lose_weight: 'Every session burns toward your weight goal.',
  build_muscle: 'Consistent volume is how muscle is built — log a set today.',
  gain_strength: 'Strength compounds. One more heavy session moves the needle.',
  stay_fit: 'Staying fit is a daily habit — keep the rhythm going.',
  endurance: 'Endurance is built one session at a time.',
};

interface ProgressDataShape {
  streak?: number;
  workoutsThisWeek?: number;
  [key: string]: unknown;
}

interface HistoryShape {
  date?: string | number | Date;
  [key: string]: unknown;
}

interface UserShape {
  goal?: string;
  [key: string]: unknown;
}

/**
 * Builds the full list of candidate notifications, highest priority first.
 * Each item: { id, priority, tone, iconKey, title, message, action }.
 */
export function buildNotifications(): SmartNotification[] {
  const progress = (Store.get('progressData') as ProgressDataShape | null | undefined) || {};
  const history = (Store.get('workoutHistory') as HistoryShape[] | null | undefined) || [];
  const user = (Store.get('user') as UserShape | null | undefined) || {};
  const water = (Store.get('waterIntake') as number | null | undefined) || 0;

  const streak = progress.streak || 0;
  const thisWeek = progress.workoutsThisWeek || 0;
  const hour = new Date().getHours();
  const todayStart = startOfDay(new Date()).getTime();

  const validHistory = history.filter(
    (h): h is HistoryShape & { date: string | number | Date } =>
      !!(h && h.date && Number.isFinite(Date.parse(String(h.date))))
  );
  const workedOutToday = validHistory.some(
    (h) => startOfDay(new Date(h.date)).getTime() === todayStart
  );
  const lastWorkout = validHistory
    .map((h) => startOfDay(new Date(h.date)).getTime())
    .sort((a, b) => b - a)[0];
  const daysSince = lastWorkout ? Math.round((todayStart - lastWorkout) / 86400000) : null;

  const out: SmartNotification[] = [];

  // Streak at risk — highest priority, only after midday.
  if (streak > 0 && !workedOutToday && hour >= 12) {
    out.push({
      id: 'streak-risk',
      priority: 100,
      tone: 'warn',
      iconKey: 'fire',
      title: `Your ${streak}-day streak is on the line`,
      message: 'Log a workout before midnight to keep it alive.',
      action: { label: 'Start Workout', page: 'planner' },
    });
  }

  // Comeback nudge — been away a while.
  if (daysSince !== null && daysSince >= 3) {
    out.push({
      id: 'comeback',
      priority: 90,
      tone: 'warn',
      iconKey: 'activity',
      title: `It's been ${daysSince} days`,
      message: 'A short session is enough to get the momentum back.',
      action: { label: 'Plan a Session', page: 'planner' },
    });
  }

  // Streak celebration.
  if (streak >= 3 && workedOutToday) {
    out.push({
      id: 'streak-win',
      priority: 70,
      tone: 'accent',
      iconKey: 'trophy',
      title: `${streak} days strong`,
      message: 'You are building a serious habit — keep showing up.',
      action: { label: 'View Progress', page: 'progress' },
    });
  }

  // Weekly goal hit.
  if (thisWeek >= 4) {
    out.push({
      id: 'week-goal',
      priority: 60,
      tone: 'accent',
      iconKey: 'star',
      title: 'Weekly target smashed',
      message: `${thisWeek} workouts this week — you are ahead of most athletes.`,
      action: { label: 'See Analytics', page: 'progress' },
    });
  }

  // Hydration reminder — afternoon/evening, behind on water.
  if (hour >= 14 && water < 5) {
    out.push({
      id: 'hydration',
      priority: 40,
      tone: 'info',
      iconKey: 'leaf',
      title: 'Stay hydrated',
      message: `You've had ${water} of 8 glasses today. Top up to recover better.`,
      action: null,
    });
  }

  // Goal-based motivational nudge — fallback when nothing urgent.
  if (!workedOutToday) {
    const goalKey = user.goal || 'stay_fit';
    out.push({
      id: 'goal-nudge',
      priority: 20,
      tone: 'info',
      iconKey: 'target',
      title: hour < 12 ? 'Good morning, athlete' : 'Ready for today?',
      message: GOAL_NUDGE[goalKey] || GOAL_NUDGE.stay_fit,
      action: { label: 'Start Workout', page: 'planner' },
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

/** The single highest-priority notification not yet dismissed today. */
export function getTopNotification(): SmartNotification | null {
  const dismissed = new Set(getDismissed());
  return buildNotifications().find((n) => !dismissed.has(n.id)) || null;
}
