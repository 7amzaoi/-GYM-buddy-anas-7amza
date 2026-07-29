import { useContext, useEffect, useRef } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getExerciseById } from '../data.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { revealOnScroll } from '../lib/motion.js';
import PhotoFrame from '../components/PhotoFrame.jsx';
import { photo } from '../lib/imagery.js';
import * as haptics from '../lib/haptics.js';

/**
 * TODAY — the athletic-editorial home screen.
 *
 * One job: answer "what do I do right now" above the fold. A full-bleed hero
 * carries today's session and the single primary action; everything below it is
 * glanceable proof you're on track.
 *
 * All figures come from the store: streak / workoutsThisWeek / weekly
 * strengthVolume / workoutHistory / customPlans, and the user's own weeklyGoal
 * (set in Profile) as the "x / y" denominator.
 */

/** Photo slots the recent-session rail cycles through, so consecutive tiles
 *  never repeat the same image. */
const RAIL_SLOTS = ['record-tile', 'plan-strength', 'plan-custom', 'plan-cardio'];

/** Plan categories are stored as camelCase keys; these are the display names.
 *  Same labels the Planner screen uses, so a plan reads identically in both. */
const CATEGORY_LABELS = {
  strength: 'Strength',
  cardio: 'Cardio',
  fatLoss: 'Fat Loss',
  muscleGain: 'Muscle Gain',
};

/** Candidate photos per plan category, best fit first. See planSlot(). */
const PLAN_SLOT_POOL = {
  strength: ['plan-strength', 'plan-strength-2', 'plan-strength-3'],
  cardio: ['plan-cardio', 'plan-cardio-2'],
  fatLoss: ['plan-fatloss', 'plan-cardio-2', 'plan-cardio'],
  muscleGain: ['plan-muscle', 'plan-strength-2', 'plan-custom'],
  default: ['plan-custom', 'plan-custom-2'],
};

/** 18_420 -> "18.4k" so a long number never breaks the 3-across stat row. */
function compact(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

export default function DashboardPage() {
  const navigateToPage = useContext(NavigateContext);
  const rootRef = useRef(null);

  const user = Store.get('user');
  const progress = Store.get('progressData');
  const history = Store.get('workoutHistory') || [];
  const plans = Store.get('customPlans') || [];

  const firstName = (user?.name || 'Athlete').trim().split(/\s+/)[0];
  const streak = progress.streak || 0;
  const thisWeek = progress.workoutsThisWeek || 0;
  const weeklyGoal = Number(Store.get('weeklyGoal')) || 5;
  const weekVol = (progress?.weeklyPerformance?.strengthVolume || []).reduce((a, b) => a + b, 0);

  // The hero has three states, in priority order: a session already running,
  // a plan ready to start, or nothing planned yet.
  const session = Store.get('activeSession');
  const plan = plans[0] || null;
  const planExercises = plan ? (plan.exercises || []).filter((id) => getExerciseById(id)).length : 0;

  let heroState = 'empty';
  if (session) heroState = 'resume';
  else if (plan) heroState = 'plan';

  let heroTitle;
  let heroMeta;
  let ctaLabel;
  let ctaIcon;
  if (heroState === 'resume') {
    const sets = (session.exercises || []).flatMap((e) => e.sets || []);
    const doneSets = sets.filter((x) => x.done).length;
    heroTitle = session.planName || 'Freestyle Workout';
    heroMeta = `In progress · ${doneSets}/${sets.length} sets · ${(session.exercises || []).length} exercises`;
    ctaLabel = 'Resume workout';
    ctaIcon = 'play';
  } else if (heroState === 'plan') {
    heroTitle = plan.name;
    heroMeta = [plan.category, `${planExercises} exercise${planExercises === 1 ? '' : 's'}`, plan.duration]
      .filter(Boolean).join(' · ');
    ctaLabel = 'Start workout';
    ctaIcon = 'play';
  } else {
    heroTitle = 'Pick your first plan';
    heroMeta = 'Choose a plan and it shows up here every day';
    ctaLabel = 'Browse plans';
    ctaIcon = 'dumbbell';
  }

  const recent = history.slice(0, 3);
  const today = new Date();

  /* Plans ordered by when they were last trained. `workoutHistory` is
   * newest-first and every completed session carries the `planId` it ran, so
   * the first time an id appears is that plan's last use. Freestyle sessions
   * have no planId and are skipped; ids whose plan has since been deleted drop
   * out. Plans never trained yet fill the remaining slots, newest first, so the
   * section is still useful before any history exists. */
  const lastUsedAt = new Map();
  for (const w of history) {
    if (w.planId && !lastUsedAt.has(w.planId)) lastUsedAt.set(w.planId, w.date);
  }
  const trained = [...lastUsedAt.keys()]
    .map((id) => plans.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => ({ ...p, lastUsed: lastUsedAt.get(p.id) }));
  const untrained = plans
    .filter((p) => !lastUsedAt.has(p.id))
    .slice()
    .reverse()
    .map((p) => ({ ...p, lastUsed: null }));
  /* Two, not three: the cards are full-width posters, so a third pushes the
     section past a screenful and "All plans" is right there for the rest. */
  const recentPlans = [...trained, ...untrained].slice(0, 2);

  /** The three facts worth carrying on a plan card, in priority order. */
  function planFacts(p) {
    const count = (p.exercises || []).filter((id) => getExerciseById(id)).length;
    const facts = [`${count} exercise${count === 1 ? '' : 's'}`];
    if (p.duration) facts.push(p.duration);
    facts.push(
      p.lastUsed
        ? `Last ${new Date(p.lastUsed).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
        : 'Not trained yet'
    );
    return facts;
  }

  /* Art stays in the plan's own category so a cardio plan never gets a squat
   * rack, but each category has a pool: with one photo per category, two
   * strength plans on the same screen showed the identical picture. The choice
   * is keyed off the plan id, so a given plan always keeps the same photo
   * instead of reshuffling on every render. Slots without a file yet are
   * filtered out, so the pool grows on its own as images are added. */
  function planSlot(p) {
    const pool = (PLAN_SLOT_POOL[p.category] || PLAN_SLOT_POOL.default).filter((s) => photo(s));
    if (pool.length === 0) return 'plan-custom';
    let h = 0;
    for (const ch of String(p.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return pool[h % pool.length];
  }

  useEffect(() => revealOnScroll(rootRef.current, '[data-reveal]', { y: 24, stagger: 0.05 }), []);

  function onHeroAction() {
    haptics.tap();
    // A running session is resumed, never replaced — starting a new one here
    // used to silently discard the sets already logged.
    if (heroState === 'resume') {
      navigateToPage?.('workouts');
      return;
    }
    if (heroState === 'plan') {
      Store.startSession(plan.id);
      navigateToPage?.('workouts');
      return;
    }
    navigateToPage?.('planner');
  }

  return (
    <div className="m1-today" ref={rootRef}>
      {/* ===== Top bar ===== */}
      <div className="m1-topbar">
        <span className="m1-wordmark">GymBuddy</span>
        <button
          type="button"
          className="m1-iconbtn"
          aria-label="Notifications"
          onClick={() => navigateToPage?.('profile')}
        >
          {icon('bell', 21)}
        </button>
      </div>

      {/* ===== Hero: today's session over a full-bleed photo ===== */}
      <PhotoFrame slot="hero-today" ghost="dumbbell" className="m1-hero">
        <div className="m1-hero-body">
          {/* The real weekday and date. The big title below is the plan's own
              name — a plan called "Monday" used to be the only date-looking
              thing on the screen, which read as the app being stuck on Monday. */}
          <span className="m1-eyebrow">
            {heroState === 'resume' ? 'Pick up where you left off' : (
              <>
                Today
                <span className="m1-eyebrow-sep" aria-hidden="true">·</span>
                <time dateTime={today.toISOString().slice(0, 10)}>
                  {today.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                </time>
              </>
            )}
          </span>
          <h1 className="m1-display m1-h1 m1-hero-title">{heroTitle}</h1>
          <span className="m1-meta">{heroMeta}</span>
          <button type="button" className="m1-cta" onClick={onHeroAction}>
            {icon(ctaIcon, 16)} {ctaLabel}
          </button>
        </div>
      </PhotoFrame>

      <div className="m1-body">
        {/* ===== Stat row ===== */}
        <div className="m1-stats" data-reveal role="list">
          <div role="listitem" className="m1-stat is-accent">
            <span className="m1-stat-val">{streak}</span>
            <span className="m1-stat-lbl">Day streak</span>
          </div>
          <div role="listitem" className="m1-stat">
            <span className="m1-stat-val">{thisWeek}<span className="u">/{weeklyGoal}</span></span>
            <span className="m1-stat-lbl">This week</span>
          </div>
          <div role="listitem" className="m1-stat">
            <span className="m1-stat-val">{compact(weekVol)}</span>
            <span className="m1-stat-lbl">Kg volume</span>
          </div>
        </div>

        {/* ===== Recent sessions rail ===== */}
        <section data-reveal>
          <div className="m1-sechead">
            <span className="m1-eyebrow is-muted">Recent sessions</span>
            <button type="button" className="m1-seclink" onClick={() => navigateToPage?.('records')}>
              See all
            </button>
          </div>

          {recent.length === 0 ? (
            <p className="m1-empty">
              No sessions yet, {firstName}. Your first one starts the streak.
            </p>
          ) : (
            <div className="m1-rail">
              {recent.map((w, i) => (
                <PhotoFrame
                  key={w.id || `${w.planName}-${w.date}`}
                  /* Cycle the art so a run of same-named sessions (e.g. several
                     freestyle ones) doesn't read as a repeated-image glitch. */
                  slot={RAIL_SLOTS[i % RAIL_SLOTS.length]}
                  ghost="activity"
                  as="button"
                  type="button"
                  className="m1-railcard"
                  onClick={() => navigateToPage?.('progress')}
                >
                  <span className="m1-railcard-name">
                    {(w.planName && w.planName.trim()) || 'Freestyle'}
                  </span>
                  <span className="m1-railcard-date">
                    {new Date(w.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </span>
                </PhotoFrame>
              ))}
            </div>
          )}
        </section>

        {/* ===== Plans rail =====
            Hidden entirely when there are no plans: the hero is already the
            "pick your first plan" empty state, and a second empty box under it
            would just repeat the same prompt. */}
        {recentPlans.length > 0 && (
          <section data-reveal>
            <div className="m1-sechead">
              <span className="m1-eyebrow is-muted">Your plans</span>
              <button
                type="button"
                className="m1-seclink"
                onClick={() => { haptics.tap(); navigateToPage?.('planner'); }}
              >
                All plans {icon('arrow', 12)}
              </button>
            </div>

            <div className="m1-plangrid">
              {recentPlans.map((p) => (
                <PhotoFrame
                  key={p.id}
                  slot={planSlot(p)}
                  ghost="dumbbell"
                  as="button"
                  type="button"
                  className="m1-plancard"
                  onClick={() => { haptics.tap(); navigateToPage?.('planner'); }}
                >
                  <span className="m1-plancard-tag">
                    {icon(p.category === 'cardio' ? 'activity' : 'dumbbell', 12)}
                    {CATEGORY_LABELS[p.category] || 'Custom'}
                  </span>
                  <span className="m1-plancard-foot">
                    <span className="m1-plancard-text">
                      <span className="m1-plancard-name">{p.name}</span>
                      <span className="m1-plancard-meta">
                        {planFacts(p).map((f) => <span key={f}>{f}</span>)}
                      </span>
                    </span>
                    <span className="m1-plancard-go" aria-hidden="true">{icon('arrow', 17)}</span>
                  </span>
                </PhotoFrame>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
