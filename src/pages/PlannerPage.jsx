import { useState, useEffect, useRef } from 'react';
import { getAllExercises, getExerciseById } from '../data.js';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { Toast } from '../lib/interactions.js';
import { revealOnScroll } from '../lib/motion.js';

const CATEGORIES = {
  strength: { label: 'Strength', iconKey: 'dumbbell' },
  cardio: { label: 'Cardio', iconKey: 'activity' },
  fatLoss: { label: 'Fat Loss', iconKey: 'fire' },
  muscleGain: { label: 'Muscle Gain', iconKey: 'zap' },
};

const FILTERS = [
  { id: null, label: 'All', iconKey: 'target' },
  { id: 'strength', label: 'Strength', iconKey: 'dumbbell' },
  { id: 'cardio', label: 'Cardio', iconKey: 'activity' },
  { id: 'fatLoss', label: 'Fat Loss', iconKey: 'fire' },
  { id: 'muscleGain', label: 'Muscle Gain', iconKey: 'zap' },
];

export default function PlannerPage() {
  const rootRef = useRef(null);
  const user = Store.get('user');
  const [planFilter, setPlanFilter] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const userPlans = user ? (Store.get('customPlans') || []) : [];
  const history = Store.get('workoutHistory') || [];
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

  function handleCreatePlan(ev) {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const name = String(fd.get('cp-name'));
    const category = String(fd.get('cp-cat'));
    const duration = String(fd.get('cp-dur'));
    const checkboxes = ev.target.querySelectorAll('.cp-exercise:checked');
    const exercises = [...checkboxes].map(cb => cb.value);
    if (exercises.length === 0) {
      Toast.show('Select at least one exercise!', 'warning');
      return;
    }
    Store.addCustomPlan({ name, category, duration, level: 'Custom', description: 'Your custom workout plan.', exercises, calories: exercises.length * 50 });
    setCreateOpen(false);
    Toast.show('Custom plan "' + name + '" created!', 'success');
    setPlanFilter(null);
  }

  return (
    <div className="plan" ref={rootRef}>
      {/* ===== Header ===== */}
      <header className="plan-header" data-reveal>
        <div>
          <span className="gx-eyebrow">{icon('dumbbell', 13)} Plans</span>
          <h1 className="plan-h1">My Plans</h1>
          <p className="gx-subtitle">Organize your training plans for strength, fat loss and growth — your personal library.</p>
        </div>
        {hasAnyPlans ? (
          <button type="button" className="gx-btn gx-btn-primary" onClick={() => setCreateOpen(true)}>
            {icon('plus', 15)} Create Plan
          </button>
        ) : null}
      </header>

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
                  <article key={p.id} className={`gx-card plan-card ${completed ? 'is-completed' : ''} ${isOpen ? 'is-open' : ''}`} data-reveal>
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
          <button type="button" className="gx-btn gx-btn-primary" onClick={() => setCreateOpen(true)}>
            {icon('plus', 15)} Create Your First Plan
          </button>
        </div>
      )}

      {/* ===== Create plan modal ===== */}
      {createOpen && (
        <div
          className="gx-modal-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}
        >
          <div className="gx-modal gx-modal-wide" role="dialog" aria-modal="true" aria-label="Create custom plan">
            <div className="gx-modal-head">
              <h2>Create Custom Plan</h2>
              <button type="button" className="gx-modal-close" onClick={() => setCreateOpen(false)} aria-label="Close">
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
                <span>Select exercises</span>
                <div className="plan-ex-picker">
                  {getAllExercises().map(ex => (
                    <label key={ex.id} className="plan-ex-item">
                      <input type="checkbox" value={ex.id} className="cp-exercise" />
                      <span className="plan-ex-name">{ex.name}</span>
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
    </div>
  );
}
