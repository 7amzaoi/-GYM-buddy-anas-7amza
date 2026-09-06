import { useMemo, useState } from 'react';
import { Store } from '../../store.js';
import { icon } from '../../icons.jsx';
import { photo } from '../../lib/imagery.js';
import { suggestPlan, suggestionToPlan } from '../../lib/planSuggestion.js';
import NotificationBell from '../notifications/NotificationBell.jsx';
import NotificationSheet from '../notifications/NotificationSheet.jsx';

/**
 * TRAIN — start-of-day view, shown when no session is active.
 *
 * Layout follows the approved mock: top bar → hero plan → Current Program rail
 * → Recent Workouts → Quick Actions.
 *
 * Everything on screen is real Store data. Two things in the mock are
 * deliberately NOT reproduced, because the Store has no such entity and faking
 * them would put invented numbers in front of the user:
 *   - the periodised program (Phase 1 / Week 3 / Day 1 / "7 of 20"). Replaced,
 *     per the agreed decision, by the plan you last trained, which lives in the
 *     Current Program rail.
 *   - the hero's "0 of 12" ring. It counted completed sessions for the plan the
 *     hero showed; the hero no longer shows a plan, so the ring went with it.
 *
 * The hero is a fixed "Empty Workout" card. It used to be the last-trained
 * plan, which made the screen's primary action "repeat what you already have" —
 * and that plan is already in the rail below with its own Continue button.
 */

/** Photo slot per plan category, so the cards aren't flat colour blocks. */
const CATEGORY_SLOT = {
  strength: 'plan-strength',
  cardio: 'plan-cardio',
  fitness: 'plan-fatloss',
  fatLoss: 'plan-fatloss',
  muscleGain: 'plan-muscle',
};

function slotFor(plan, i = 0) {
  const pool = [CATEGORY_SLOT[plan?.category] || 'plan-custom', 'plan-custom-2', 'plan-strength-2'];
  return pool[i % pool.length];
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function IdleScreen({
  rootRef,
  navigateToPage,
  progress,
  recentAll,
  recentExpanded,
  onStartEmpty,
  // WorkoutsPage also passes `heroRef`, `recentVisible`, `recentHidden` and
  // `setRecentExpanded`. They are received and deliberately not read, so the
  // props contract is untouched: `heroRef` drove the old cursor tilt (noise on
  // a touch screen), and the recent-list slice is derived here instead — see
  // RECENT_PREVIEW below.
}) {
  const [starting, setStarting] = useState(false);
  const [creating, setCreating] = useState(false);

  const plans = Store.get('customPlans') || [];
  const user = Store.get('user') || {};
  const thisWeek = progress.workoutsThisWeek || 0;
  const weeklyGoal = Number(Store.get('weeklyGoal')) || 5;

  /* Not memoised on purpose. These are `find`s over a handful of plans — far
     cheaper than the render they'd guard — and memoising them against
     `Store.get('customPlans') || []` would either churn the deps every render
     (a new array each time) or go stale the moment a plan is created. */

  /** The plan behind the most recent logged session, else the newest plan. */
  let lastPlan = null;
  for (const h of recentAll) {
    const hit = plans.find((p) => p.id === h.planId);
    if (hit) { lastPlan = hit; break; }
  }
  if (!lastPlan) lastPlan = plans.at(-1) || null;

  const lastTrainedOn = lastPlan
    ? (recentAll.find((h) => h.planId === lastPlan.id)?.date ?? null)
    : null;

  /* Two rows collapsed, like the reference. The parent's `recentVisible` /
     `recentHidden` cap at 3, which pushed Quick Actions off the fold; deriving
     the slice here keeps the prop contract untouched while owning the count
     the toggle reports. */
  const RECENT_PREVIEW = 2;
  const shownRecent = recentExpanded ? recentAll : recentAll.slice(0, RECENT_PREVIEW);

  /* Weekly analysis. `weeklyPerformance.duration` is derived by the Store
     (deriveWeeklyPerformanceFromHistory): 7 slots, index 0 = six days ago,
     index 6 = today. Minutes per day, so a day with any value is a day trained
     and the value itself gives the bar its height. Nothing here is invented. */
  const weekMins = progress.weeklyPerformance?.duration || [0, 0, 0, 0, 0, 0, 0];
  const weekTotal = weekMins.reduce((a, b) => a + (Number(b) || 0), 0);
  const daysTrained = weekMins.filter((d) => Number(d) > 0).length;
  const peakMins = Math.max(...weekMins.map((d) => Number(d) || 0), 1);
  const dayLetters = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(d.toLocaleDateString(undefined, { weekday: 'narrow' }));
    }
    return out;
  }, []);

  /* This one IS worth memoising — it walks every logged exercise against the
     catalog. Keyed on primitives so the deps stay stable across renders. */
  const goalKey = user.goal || '';
  const suggestion = useMemo(
    () => suggestPlan({ user: { goal: goalKey }, workoutHistory: recentAll }),
    [goalKey, recentAll]
  );

  function handleStartPlan() {
    if (starting || !lastPlan) return;
    setStarting(true);
    try {
      Store.startSession(lastPlan.id);
    } finally {
      setStarting(false);
    }
  }

  function handleStartEmpty() {
    if (starting) return;
    setStarting(true);
    try {
      onStartEmpty?.();
    } finally {
      setStarting(false);
    }
  }

  /** Build the suggested plan for real, then drop the user into it. */
  function handleBuildSuggestion() {
    if (creating) return;
    setCreating(true);
    try {
      Store.addCustomPlan(suggestionToPlan(suggestion));
      const made = (Store.get('customPlans') || []).at(-1);
      if (made?.id) Store.startSession(made.id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="wko wko-idle" ref={rootRef}>
      {/* ===== Top bar — the mock's settings gear is the notification bell ===== */}
      <div className="wko-topbar">
        <h1 className="wko-title">Train</h1>
        <NotificationBell />
      </div>
      <NotificationSheet />

      {/* ===== Hero — always a fresh, empty workout =====
          Was the last-trained plan, which made this screen's primary action
          "repeat the plan you already have". That plan is still one tap away in
          the Current Program rail directly below, with its own Continue button,
          and the suggestion sits beside it with Build. The hero now carries the
          one thing neither of those can offer: starting from nothing. */}
      <section className="wko-hero" aria-labelledby="wko-hero-name">
        <div className="wko-hero-head">
          <div className="wko-hero-id">
            <span className="wko-eyebrow">{icon('plus', 12)} New workout</span>
            <h2 className="wko-hero-name" id="wko-hero-name">Empty Workout</h2>
            {/* Deliberately no duration / exercises / calories line: an empty
                session has none of them yet, and printing a placeholder would
                put an invented number in front of the user. */}
            <p className="wko-hero-reason">Start with nothing and add exercises as you go.</p>
          </div>
        </div>

        <button
          type="button"
          className="wko-go"
          onClick={handleStartEmpty}
          disabled={starting}
          aria-busy={starting}
        >
          {icon('play', 17)} {starting ? 'Starting…' : 'Start Empty Workout'}
        </button>
      </section>

      {/* ===== Current Program — last plan + the suggestion, side by side ===== */}
      <section className="wko-sec">
        <div className="wko-sec-head">
          <h2 className="wko-sec-title">Current Program</h2>
        </div>
        <div className="wko-rail">
          {/* Only when a plan exists. The suggestion beside it always shows —
              on first run it is the only card in the rail. */}
          {lastPlan && (
          <article className="wko-pcard">
            <h3 className="wko-pcard-name">{lastPlan.name}</h3>
            <p className="wko-pcard-sub">
              {lastPlan.category || 'Custom'}
              {lastTrainedOn && <> · last {fmtDate(lastTrainedOn)}</>}
            </p>

            {/* Last 7 days: bar height = minutes trained that day, filled =
                a day you showed up. This is the commitment read — the shape
                of your week, not just a count. */}
            <div
              className="wko-week"
              role="img"
              aria-label={
                `Trained ${daysTrained} of the last 7 days, ${weekTotal} minutes total. ` +
                `${thisWeek} of ${weeklyGoal} sessions against your weekly goal.`
              }
            >
              {weekMins.map((mins, i) => (
                <span
                  key={dayLetters[i] + i}
                  className={`wko-week-day${Number(mins) > 0 ? ' is-on' : ''}${i === 6 ? ' is-today' : ''}`}
                >
                  <span className="wko-week-track">
                    <span
                      className="wko-week-bar"
                      style={{ blockSize: `${Math.max(12, (Number(mins) / peakMins) * 100)}%` }}
                    />
                  </span>
                  <span className="wko-week-lbl" aria-hidden="true">{dayLetters[i]}</span>
                </span>
              ))}
            </div>

            <p className="wko-pcard-foot">
              <span>
                <b className="wko-pcard-strong">{thisWeek}/{weeklyGoal}</b> sessions
                {weekTotal > 0 && <> · {weekTotal} min</>}
              </span>
              <button type="button" className="wko-pcard-go" onClick={handleStartPlan} disabled={starting}>
                Continue {icon('arrow', 13)}
              </button>
            </p>
          </article>
          )}

          <article className="wko-pcard wko-pcard-sug">
            <span className="wko-eyebrow">{icon('target', 12)} Suggested</span>
            <h3 className="wko-pcard-name">{suggestion.title}</h3>
            <p className="wko-pcard-reason">{suggestion.reason}</p>
            <p className="wko-pcard-foot">
              <span>{suggestion.exerciseIds.length} exercises</span>
              <button type="button" className="wko-pcard-go" onClick={handleBuildSuggestion} disabled={creating}>
                {creating ? 'Building…' : 'Build'} {icon('plus', 13)}
              </button>
            </p>
          </article>
        </div>
      </section>

      {/* ===== Recent ===== */}
      <section className="wko-sec">
        <div className="wko-sec-head">
          <h2 className="wko-sec-title">Recent Workouts</h2>
          {recentAll.length > 0 && (
            <button type="button" className="wko-sec-link" onClick={() => navigateToPage?.('progress')}>
              View all {icon('arrow', 12)}
            </button>
          )}
        </div>

        {recentAll.length === 0 ? (
          <p className="wko-log-empty">Sessions appear here once you finish one.</p>
        ) : (
          <>
            <ul className="wko-rlist">
              {shownRecent.map((w, i) => {
                const name = (w.planName && w.planName.trim()) || 'Freestyle Workout';
                const src = photo(slotFor({ category: null }, i));
                return (
                  <li key={w.id || name + w.date}>
                    <button type="button" className="wko-rrow" onClick={() => navigateToPage?.('progress')}>
                      <span className="wko-rthumb">
                        {src ? <img src={src} alt="" loading="lazy" /> : icon('dumbbell', 18)}
                      </span>
                      <span className="wko-rtext">
                        <b>{name}</b>
                        <span>
                          {icon('clock', 11)} {w.duration ? `${w.duration} min` : '—'}
                          {'  '}{icon('dumbbell', 11)} {w.exercises} exercises
                        </span>
                      </span>
                      <span className="wko-rmeta">
                        <time dateTime={w.date}>{fmtDate(w.date)}</time>
                        {icon('arrow', 13)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* No "show more" toggle here: the section head already carries
                "View all", which goes to the full history on Progress. Two
                controls for the same job cost 52px of fold for nothing. */}
          </>
        )}
      </section>

      {/* ===== Quick actions =====
          The mock's three chips (Browse Exercises / Create Workout / View
          Plans) all live on the Planner today, so three chips would be three
          routes to one screen. These go to three genuinely different places. */}
      <section className="wko-sec">
        <h2 className="wko-sec-title">Quick Actions</h2>
        <div className="wko-chips">
          {/* The Empty Workout chip that used to lead this row is gone: the
              hero is that action now, and two identical primary buttons on
              one screen is clutter, not a shortcut. */}
          <button type="button" className="wko-chip" onClick={() => navigateToPage?.('planner')}>
            {icon('dumbbell', 14)} Plans
          </button>
          {/* The library has no bottom-bar tab (mobile:false in NAV_ITEMS), so
              this chip is its mobile entry point. The row is a horizontal
              scroller, so a fifth chip costs no vertical space. */}
          <button type="button" className="wko-chip" onClick={() => navigateToPage?.('library')}>
            {icon('target', 14)} Exercises
          </button>
          <button type="button" className="wko-chip" onClick={() => navigateToPage?.('records')}>
            {icon('medal', 14)} Records
          </button>
          <button type="button" className="wko-chip" onClick={() => navigateToPage?.('progress')}>
            {icon('chart', 14)} Progress
          </button>
        </div>
      </section>
    </div>
  );
}
