import { EXERCISES, getExerciseById } from '../data.js';

/**
 * Plan suggestion — proposes the next workout to build, from REAL signals only.
 *
 * Two inputs, both already in the Store:
 *   1. the user's goal          (`user.goal`)
 *   2. what they actually trained (`workoutHistory[].exerciseLog[].id`)
 *
 * It never invents a metric. The "reason" line shown on the card is derived
 * from the same data it used to choose, so the suggestion can always explain
 * itself: "Back — not trained in 12 days" is a fact from the log, not a slogan.
 *
 * Deliberately NOT a periodised program (phases / weeks / day counters). The
 * Store has no such entity, and inventing one would put fake progress numbers
 * in front of the user.
 */

/** How far back "recently trained" looks. */
const RECENCY_WINDOW_DAYS = 14;

/** Muscle groups we can actually detect from the catalog's `muscles` strings. */
const FOCUS_GROUPS = [
  { id: 'chest',     label: 'Chest',     match: /chest/i },
  { id: 'back',      label: 'Back',      match: /back|lat/i },
  { id: 'shoulders', label: 'Shoulders', match: /shoulder|delt/i },
  { id: 'arms',      label: 'Arms',      match: /biceps|triceps|forearm/i },
  { id: 'legs',      label: 'Legs',      match: /quad|hamstr|glute|calf|calves|legs/i },
  { id: 'core',      label: 'Core',      match: /core|abs/i },
];

/** Goal → which catalog section to draw from, and how the plan is framed. */
const GOAL_PROFILE = {
  'muscle gain': { category: 'strength', size: 6, note: 'hypertrophy volume' },
  strength:      { category: 'strength', size: 5, note: 'heavy compounds' },
  'fat loss':    { category: 'fitness',  size: 6, note: 'circuit pace' },
  cardio:        { category: 'cardio',   size: 5, note: 'conditioning' },
};
const DEFAULT_PROFILE = GOAL_PROFILE['muscle gain'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Days since each focus group was last trained. Missing = never trained. */
function daysSinceByGroup(history) {
  const today = startOfDay(new Date()).getTime();
  const out = {};

  for (const entry of history || []) {
    const t = Date.parse(entry?.date);
    if (!Number.isFinite(t)) continue;
    const days = Math.floor((today - startOfDay(t).getTime()) / 86400000);
    // exerciseLog is written by completeSession; older entries may lack it.
    for (const logged of entry.exerciseLog || []) {
      const ex = getExerciseById(logged?.id);
      if (!ex?.muscles) continue;
      for (const g of FOCUS_GROUPS) {
        if (!g.match.test(ex.muscles)) continue;
        if (out[g.id] === undefined || days < out[g.id]) out[g.id] = days;
      }
    }
  }
  return out;
}

/** Every exercise in the catalog whose muscles match a group. */
function exercisesForGroup(groupId, category) {
  const group = FOCUS_GROUPS.find((g) => g.id === groupId);
  const pool = EXERCISES[category] || [];
  if (!group) return pool;
  const hit = pool.filter((e) => group.match.test(e.muscles || ''));
  return hit.length > 0 ? hit : pool;
}

/**
 * Suggest the next plan to build.
 *
 * @param {{ user?: {goal?: string}, workoutHistory?: any[] }} state
 * @returns {{
 *   focusId: string, focusLabel: string, title: string, reason: string,
 *   category: string, exerciseIds: string[], exerciseNames: string[],
 *   duration: string, calories: number, isApprox: true
 * }}
 */
export function suggestPlan({ user, workoutHistory } = {}) {
  const goal = (user?.goal || '').toLowerCase();
  const profile = GOAL_PROFILE[goal] || DEFAULT_PROFILE;

  const seen = daysSinceByGroup(workoutHistory);

  // Pick the group that has gone longest without work. Never-trained groups
  // sort first — they are the biggest genuine gap.
  const ranked = [...FOCUS_GROUPS].sort((a, b) => {
    const da = seen[a.id] === undefined ? Infinity : seen[a.id];
    const db = seen[b.id] === undefined ? Infinity : seen[b.id];
    return db - da;
  });
  const focus = ranked[0];
  const gap = seen[focus.id];

  let reason;
  if ((workoutHistory || []).length === 0) {
    reason = `A balanced ${profile.note} start for your goal.`;
  } else if (gap === undefined) {
    reason = `${focus.label} hasn't appeared in your log yet.`;
  } else if (gap >= RECENCY_WINDOW_DAYS) {
    reason = `${focus.label} not trained in ${gap} days.`;
  } else {
    reason = `${focus.label} is your longest gap — ${gap} day${gap === 1 ? '' : 's'}.`;
  }

  const picked = exercisesForGroup(focus.id, profile.category).slice(0, profile.size);
  // Estimates, and labelled as such in the UI — the app already treats plan
  // duration and calories as approximations (addCustomPlan defaults to 300).
  const duration = `${Math.max(20, picked.length * 8)} min`;
  const calories = Math.round(picked.length * 55);

  return {
    focusId: focus.id,
    focusLabel: focus.label,
    title: `${focus.label} Focus`,
    reason,
    category: profile.category,
    exerciseIds: picked.map((e) => e.id),
    exerciseNames: picked.map((e) => e.name),
    duration,
    calories,
    isApprox: true,
  };
}

/** Shape `suggestPlan` output into the argument `Store.addCustomPlan` expects. */
export function suggestionToPlan(s) {
  return {
    name: s.title,
    category: s.category,
    duration: s.duration,
    level: 'Suggested',
    description: s.reason,
    exercises: s.exerciseIds,
    calories: s.calories,
  };
}
