import { useState, useEffect, useRef, useContext } from 'react';
import { getAllExercises, getExerciseById } from '../data.js';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { Toast } from '../lib/interactions.js';
import { revealOnScroll } from '../lib/motion.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import AppHeader from '../components/AppHeader.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import * as haptics from '../lib/haptics.js';

const CATEGORIES = {
  strength: { label: 'Strength', iconKey: 'dumbbell' },
  cardio: { label: 'Cardio', iconKey: 'activity' },
  fatLoss: { label: 'Fat Loss', iconKey: 'fire' },
  muscleGain: { label: 'Muscle Gain', iconKey: 'zap' },
};

/**
 * The exercise list tags 17 different muscle names, which is far too
 * fine-grained to pick from. These are the groups a lifter actually thinks in.
 * An exercise belongs to a group if *any* of its tags does, so Bench Press
 * (Chest, Triceps) shows under both Chest and Arms — which is correct: it does
 * train both, and hiding it from Arms would be the surprising behaviour.
 */
const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest', tags: ['chest', 'upper chest'] },
  { id: 'back', label: 'Back', tags: ['back'] },
  { id: 'shoulders', label: 'Shoulders', tags: ['shoulders', 'rear delts'] },
  { id: 'arms', label: 'Arms', tags: ['biceps', 'triceps', 'forearms', 'arms'] },
  { id: 'legs', label: 'Legs', tags: ['quads', 'hamstrings', 'glutes', 'legs'] },
  { id: 'core', label: 'Core', tags: ['core'] },
  { id: 'cardio', label: 'Cardio', tags: ['cardio', 'full body', 'power'] },
];

function muscleTokens(ex) {
  return String(ex.muscles || '')
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
}

function matchesMuscleGroup(ex, groupId) {
  if (!groupId) return true;
  const group = MUSCLE_GROUPS.find((g) => g.id === groupId);
  if (!group) return true;
  return muscleTokens(ex).some((t) => group.tags.includes(t));
}

const FILTERS = [
  { id: null, label: 'All', iconKey: 'target' },
  { id: 'strength', label: 'Strength', iconKey: 'dumbbell' },
  { id: 'cardio', label: 'Cardio', iconKey: 'activity' },
  { id: 'fatLoss', label: 'Fat Loss', iconKey: 'fire' },
  { id: 'muscleGain', label: 'Muscle Gain', iconKey: 'zap' },
];

export default function PlannerPage() {
  const rootRef = useRef(null);
  const navigateToPage = useContext(NavigateContext);
  const user = Store.get('user');
  const [planFilter, setPlanFilter] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  /** Plan waiting on confirmation because another session is already running. */
  const [pendingStart, setPendingStart] = useState(null);
  /** Muscle group narrowing the create-plan exercise list; null = all. */
  const [exFilter, setExFilter] = useState(null);
  /* Selection lives in state, not in the DOM. The filter has to be free to
     unmount rows, and reading `.cp-exercise:checked` at submit would then drop
     every exercise picked under a different group without telling anyone. */
  const [pickedIds, setPickedIds] = useState([]);

  const userPlans = user ? (Store.get('customPlans') || []) : [];
  const history = Store.get('workoutHistory') || [];
  const activeSession = Store.get('activeSession');
  const completedPlanIds = new Set(
    history
      .map(h => h.planId)
      .filter(Boolean)
  );
  const completedByName = new Set(
    history
      .filter(h => !h.planId && h.planName)
      .map(h => h.planName)
  );
  const isPlanCompleted = (p) => completedPlanIds.has(p.id) || completedByName.has(p.name);
  const lastCompletionFor = (p) =>
    history.find(h => (h.planId && h.planId === p.id) || (!h.planId && h.planName === p.name));

  const displayedPlans = planFilter ? userPlans.filter(p => p.category === planFilter) : userPlans;
  const hasAnyPlans = userPlans.length > 0;
  const completedCount = userPlans.filter(isPlanCompleted).length;

  useEffect(() => {
    const cleanup = revealOnScroll(rootRef.current, '[data-reveal]');
    return cleanup;
  }, [planFilter, createOpen, userPlans.length]);

  function deleteCustomPlan(id) {
    Store.deleteCustomPlan(id);
    if (expandedId === id) setExpandedId(null);
  }

  /**
   * Start a plan as today's workout.
   *
   * Store.startSession replaces `activeSession` outright, so a running session
   * would lose every logged set without warning. Three cases: this same plan is
   * already running (just go back to it), a different one is running (ask
   * first), or nothing is running (start straight away).
   */
  function startPlan(p, exerciseCount) {
    haptics.tap();
    if (exerciseCount === 0) {
      Toast.show('This plan has no exercises yet — add some first.', 'warning');
      return;
    }
    const active = Store.get('activeSession');
    if (active) {
      if (active.planId === p.id) {
        navigateToPage?.('workouts');
        return;
      }
      setPendingStart(p);
      return;
    }
    Store.startSession(p.id);
    navigateToPage?.('workouts');
  }

  function confirmStart() {
    const p = pendingStart;
    setPendingStart(null);
    if (!p) return;
    Store.startSession(p.id);
    navigateToPage?.('workouts');
  }

  function handleCreatePlan(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const name = String(fd.get('cp-name'));
    const category = String(fd.get('cp-cat'));
    const duration = String(fd.get('cp-dur'));
    const exercises = pickedIds;
    if (exercises.length === 0) {
      Toast.show('Select at least one exercise!', 'warning');
      return;
    }
    Store.addCustomPlan({ name, category, duration, level: 'Custom', description: 'Your custom workout plan.', exercises, calories: exercises.length * 50 });
    closeCreate();
    Toast.show('Custom plan "' + name + '" created!', 'success');
    setPlanFilter(null);
  }

  function openCreate() {
    setPickedIds([]);
    setExFilter(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setPickedIds([]);
    setExFilter(null);
  }

  function togglePicked(id) {
    setPickedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const allExercises = getAllExercises();
  const visibleExercises = allExercises.filter((ex) => matchesMuscleGroup(ex, exFilter));

  return (
    <div className="plan" ref={rootRef}>
      {/* ===== Header ===== */}
      <AppHeader
        eyebrow={<>{icon('dumbbell', 13)} Plans</>}
        title="My Plans"
        subtitle="Organize your training plans for strength, fat loss and growth — your personal library."
        action={
          hasAnyPlans ? (
            <button type="button" className="gx-btn gx-btn-primary" onClick={openCreate}>
              {icon('plus', 15)} Create Plan
            </button>
          ) : undefined
        }
      />

      {hasAnyPlans ? (
        <>
          {/* ===== Summary strip ===== */}
          <div className="plan-summary" data-reveal>
            <div className="plan-summary-item">
              <span className="plan-summary-val">{userPlans.length}</span>
              <span className="plan-summary-label">Total plans</span>
            </div>
            <div className="plan-summary-div" aria-hidden="true" />
            <div className="plan-summary-item">
              <span className="plan-summary-val plan-accent">{completedCount}</span>
              <span className="plan-summary-label">Completed</span>
            </div>
            <div className="plan-summary-div" aria-hidden="true" />
            <div className="plan-summary-item">
              <span className="plan-summary-val">{history.length}</span>
              <span className="plan-summary-label">Sessions logged</span>
            </div>
          </div>

          {/* ===== Filter chips ===== */}
          <div className="plan-filters" data-reveal>
            {FILTERS.map(f => (
              <button
                key={f.id ?? 'all'}
                type="button"
                className={`plan-chip ${planFilter === f.id ? 'is-active' : ''}`}
                onClick={() => setPlanFilter(f.id)}
              >
                {icon(f.iconKey, 14)} {f.label}
              </button>
            ))}
          </div>

          {/* ===== Plans grid ===== */}
          {displayedPlans.length > 0 ? (
            <div className="plan-grid">
              {displayedPlans.map(p => {
                const completed = isPlanCompleted(p);
                const lastDone = lastCompletionFor(p);
                const lastDoneLabel = lastDone?.date
                  ? new Date(lastDone.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : null;
                const cat = CATEGORIES[p.category] || { label: p.category, iconKey: 'dumbbell' };
                const exCount = Array.isArray(p.exercises) ? p.exercises.length : 0;
                const isOpen = expandedId === p.id;
                const exDetails = (p.exercises || [])
                  .map((eid) => getExerciseById(eid))
                  .filter(Boolean);
                return (
                  <article key={p.id} className={`gx-card plan-card ${completed ? 'is-completed' : ''} ${isOpen ? 'is-open' : ''}`} data-category={p.category} data-reveal>
                    <div className="plan-card-top">
                      <span className="plan-card-cat">{icon(cat.iconKey, 13)} {cat.label}</span>
                      <button
                        type="button"
                        className="plan-card-del"
                        onClick={(e) => { e.stopPropagation(); deleteCustomPlan(p.id); }}
                        aria-label={`Delete ${p.name}`}
                      >
                        {icon('trash', 15)}
                      </button>
                    </div>

                    {completed ? (
                      <span className="plan-card-stamp">{icon('check', 12)} Completed</span>
                    ) : null}

                    <h3 className="plan-card-name">{p.name}</h3>
                    <p className="plan-card-desc">{p.description || 'Your custom workout plan.'}</p>

                    <div className="plan-card-stats">
                      <span>{icon('clock', 14)} {p.duration}</span>
                      <span>{icon('dumbbell', 14)} {exCount} {exCount === 1 ? 'exercise' : 'exercises'}</span>
                      <span>{icon('fire', 14)} ~{p.calories} cal</span>
                    </div>

                    {completed && lastDoneLabel ? (
                      <div className="plan-card-last">{icon('calendar', 12)} Last done {lastDoneLabel}</div>
                    ) : null}

                    <button
                      type="button"
                      className="plan-card-start"
                      onClick={() => startPlan(p, exDetails.length)}
                    >
                      {icon('play', 15)}
                      {activeSession?.planId === p.id ? 'Resume workout' : 'Start workout'}
                    </button>

                    <button
                      type="button"
                      className="plan-card-toggle"
                      onClick={() => setExpandedId(isOpen ? null : p.id)}
                      aria-expanded={isOpen}
                    >
                      <span>{isOpen ? 'Hide exercises' : 'View exercises'}</span>
                      <span className={`plan-card-toggle-chev ${isOpen ? 'is-open' : ''}`} aria-hidden="true">
                        {icon('arrow', 13)}
                      </span>
                    </button>

                    {isOpen && (
                      <ul className="plan-card-exlist">
                        {exDetails.length === 0 ? (
                          <li className="plan-card-exlist-empty">No exercises in this plan.</li>
                        ) : exDetails.map((ex, i) => (
                          <li key={ex.id} className="plan-card-exlist-item">
                            <span className="plan-card-exlist-idx">{i + 1}</span>
                            <div className="plan-card-exlist-info">
                              <span className="plan-card-exlist-name">{ex.name}</span>
                              <span className="plan-card-exlist-muscles">{ex.muscles}</span>
                            </div>
                            <span className="plan-card-exlist-sets">{ex.sets}×{ex.reps}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="plan-empty" data-reveal>
              <div className="plan-empty-icon">{icon('target', 40)}</div>
              <p className="plan-empty-title">No plans match this filter</p>
              <button type="button" className="gx-btn gx-btn-ghost" onClick={() => setPlanFilter(null)}>
                Clear filter
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="plan-empty plan-empty-hero" data-reveal>
          <div className="plan-empty-icon plan-empty-icon-lg">{icon('dumbbell', 52)}</div>
          <h2 className="plan-empty-title">No workout plans yet</h2>
          <p className="plan-empty-desc">
            Build your training around your goals. Create your first plan to organize your routine for strength, fat loss, or muscle gain.
          </p>
          <button type="button" className="gx-btn gx-btn-primary" onClick={openCreate}>
            {icon('plus', 15)} Create Your First Plan
          </button>
        </div>
      )}

      {/* ===== Create plan modal ===== */}
      {createOpen && (
        <div
          className="gx-modal-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) closeCreate(); }}
        >
          <div className="gx-modal gx-modal-wide" role="dialog" aria-modal="true" aria-label="Create custom plan">
            <div className="gx-modal-head">
              <h2>Create Custom Plan</h2>
              <button type="button" className="gx-modal-close" onClick={closeCreate} aria-label="Close">
                {icon('x', 18)}
              </button>
            </div>
            <form className="gx-modal-form" onSubmit={handleCreatePlan}>
              <label className="prof-field">
                <span>Plan name</span>
                <input id="cp-name" name="cp-name" required placeholder="My Workout" />
              </label>
              <div className="plan-form-row">
                <label className="prof-field">
                  <span>Category</span>
                  <select id="cp-cat" name="cp-cat" defaultValue="strength">
                    <option value="strength">Strength</option>
                    <option value="cardio">Cardio</option>
                    <option value="fatLoss">Fat Loss</option>
                    <option value="muscleGain">Muscle Gain</option>
                  </select>
                </label>
                <label className="prof-field">
                  <span>Duration</span>
                  <input id="cp-dur" name="cp-dur" placeholder="45 min" required />
                </label>
              </div>
              <div className="prof-field">
                <div className="plan-ex-head">
                  <span>Select exercises</span>
                  <span className={`plan-ex-count ${pickedIds.length > 0 ? 'is-on' : ''}`}>
                    {pickedIds.length} selected
                  </span>
                </div>

                {/* Muscle-group narrowing. The full list is 34 exercises across
                    17 muscle tags — unusable to scan when you know you're
                    training chest today. */}
                <div className="plan-ex-filters" role="group" aria-label="Filter exercises by muscle group">
                  <button
                    type="button"
                    className={`plan-ex-chip ${exFilter === null ? 'is-active' : ''}`}
                    aria-pressed={exFilter === null}
                    onClick={() => setExFilter(null)}
                  >
                    All <span className="plan-ex-chip-n">{allExercises.length}</span>
                  </button>
                  {MUSCLE_GROUPS.map((g) => {
                    const n = allExercises.filter((ex) => matchesMuscleGroup(ex, g.id)).length;
                    if (n === 0) return null;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        className={`plan-ex-chip ${exFilter === g.id ? 'is-active' : ''}`}
                        aria-pressed={exFilter === g.id}
                        onClick={() => setExFilter(exFilter === g.id ? null : g.id)}
                      >
                        {g.label} <span className="plan-ex-chip-n">{n}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="plan-ex-picker">
                  {visibleExercises.length === 0 ? (
                    <p className="plan-ex-empty">No exercises for this muscle group.</p>
                  ) : visibleExercises.map(ex => (
                    <label key={ex.id} className="plan-ex-item">
                      <input
                        type="checkbox"
                        value={ex.id}
                        className="cp-exercise"
                        checked={pickedIds.includes(ex.id)}
                        onChange={() => togglePicked(ex.id)}
                      />
                      <span className="plan-ex-name">{ex.name}</span>
                      <span className="plan-ex-muscles">{ex.muscles}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="gx-btn gx-btn-primary" style={{ width: '100%' }}>
                {icon('check', 15)} Create Plan
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingStart}
        onCancel={() => setPendingStart(null)}
        onConfirm={confirmStart}
        title="A workout is already running"
        subject={activeSession ? `${activeSession.planName || 'Freestyle Workout'} is in progress` : ''}
        note={`Starting ${pendingStart?.name || 'this plan'} discards it, including any sets you have logged. It won't be saved to your history.`}
        confirmLabel="Start anyway"
        tone="danger"
        iconKey="play"
      />
    </div>
  );
}
