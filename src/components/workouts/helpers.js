/**
 * Pure helpers + constants used by the Workouts page and its subcomponents.
 * Kept here (no React) so the components stay focused on rendering.
 */

/** Epley 1RM estimate, rounded to nearest 0.5kg. Returns null for invalid input. */
export function calc1RM(weight, reps) {
  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return null;
  if (r === 1) return Math.round(w * 2) / 2;
  return Math.round(w * (1 + r / 30) * 2) / 2;
}

export const PLATE_INVENTORY = [25, 20, 15, 10, 5, 2.5, 1.25];

export const BAR_OPTIONS = [
  { id: 20, label: 'Olympic bar', kg: 20 },
  { id: 15, label: 'Women\'s bar', kg: 15 },
  { id: 10, label: 'Short bar', kg: 10 },
  { id: 0, label: 'No bar', kg: 0 },
];

/** Greedy plate breakdown for one side of the bar. */
export function calculatePlates(target, barWeight = 20) {
  const t = parseFloat(target);
  if (!Number.isFinite(t) || t <= barWeight) {
    return { ok: t === barWeight, perSide: 0, plates: [], leftover: 0, total: t };
  }
  const perSide = (t - barWeight) / 2;
  let remaining = perSide;
  const plates = [];
  for (const p of PLATE_INVENTORY) {
    while (remaining >= p - 0.001) {
      plates.push(p);
      remaining -= p;
    }
  }
  return { ok: Math.abs(remaining) < 0.01, perSide, plates, leftover: remaining, total: t };
}

/** Short beep using Web Audio — used at rest-timer end. */
export function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    window.setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch { /* audio blocked */ }
}

/** Look up the user's best previous record + a progressive overload suggestion. */
export function getOverloadSuggestion(exerciseId, records, exerciseLogs) {
  // Prefer formal record; fall back to the latest exerciseLog entry.
  const rec = (records || []).find((r) => r.exercise_id === exerciseId && r.metric_type === 'weight');
  let bestW = 0, bestR = 0;
  if (rec) {
    bestW = Number(rec.value || 0);
    bestR = Number(rec.secondary_value || 0);
  } else {
    for (const log of exerciseLogs || []) {
      if (log.id === exerciseId && log.bestWeight > bestW) {
        bestW = log.bestWeight; bestR = log.bestReps || 0;
      }
    }
  }
  if (bestW <= 0) return null;
  // Suggest +2.5kg when reps ≥ 5, otherwise add a rep at the same weight.
  const nextW = bestR >= 5 ? Math.round((bestW + 2.5) * 2) / 2 : bestW;
  const nextR = bestR < 5 && bestR > 0 ? bestR + 1 : bestR;
  return { bestW, bestR, nextW, nextR };
}

export const CATEGORY_TABS = [
  { id: 'all', label: 'All', iconKey: 'target' },
  { id: 'strength', label: 'Strength', iconKey: 'dumbbell' },
  { id: 'cardio', label: 'Cardio', iconKey: 'activity' },
  { id: 'fatLoss', label: 'Fat Loss', iconKey: 'fire' },
  { id: 'muscleGain', label: 'Muscle', iconKey: 'zap' },
];

/** Muscle filter groups — each `match` regex looks at the exercise's muscles string. */
export const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest', match: /chest/i },
  { id: 'back', label: 'Back', match: /back|lat/i },
  { id: 'shoulders', label: 'Shoulders', match: /shoulder|delt/i },
  { id: 'biceps', label: 'Biceps', match: /biceps/i },
  { id: 'triceps', label: 'Triceps', match: /triceps/i },
  { id: 'legs', label: 'Legs', match: /legs|quad|hamstr|glute|calf|calves/i },
  { id: 'core', label: 'Core', match: /core|abs/i },
  { id: 'fullbody', label: 'Full Body', match: /full body/i },
];

export function formatTime(secs) {
  if (secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Live volume / set counts derived from the session's logged sets. */
export function computeLiveStats(session) {
  if (!session) return { totalSets: 0, doneSets: 0, totalReps: 0, totalVolume: 0 };
  let totalSets = 0, doneSets = 0, totalReps = 0, totalVolume = 0;
  for (const ex of session.exercises || []) {
    for (const ls of ex.sets || []) {
      totalSets += 1;
      if (ls.done) {
        doneSets += 1;
        const r = parseInt(ls.reps, 10) || 0;
        const w = parseFloat(ls.weight) || 0;
        totalReps += r;
        totalVolume += w * r;
      }
    }
  }
  return { totalSets, doneSets, totalReps, totalVolume };
}
