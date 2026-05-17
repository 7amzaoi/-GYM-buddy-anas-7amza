import { useState, useContext } from 'react';
import { getAllExercises } from '../data.js';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { Toast } from '../lib/interactions.js';

const catLabels = {
  strength: '🏋️ Strength',
  cardio: '🏃 Cardio',
  fatLoss: '🔥 Fat Loss',
  muscleGain: '💪 Muscle Gain'
};

export default function PlannerPage() {
  const navigateToPage = useContext(NavigateContext);
  const user = Store.get('user');
  const [planFilter, setPlanFilter] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

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

  function handleStartWorkout(planId) {
    Store.startSession(planId);
    if (Store.get('activeSession')) {
      Toast.show("Workout session started! Let's go!", 'success');
      navigateToPage?.('session');
    } else {
      Toast.show('Could not start session', 'error');
    }
  }

  function deleteCustomPlan(id) {
    Store.deleteCustomPlan(id);
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
      Toast.show('⚠️ Select at least one exercise!', 'warning');
      return;
    }
    Store.addCustomPlan({ name, category, duration, level: 'Custom', description: 'Your custom workout plan.', exercises, calories: exercises.length * 50 });
    setCreateOpen(false);
    Toast.show('✅ Custom plan "' + name + '" created!', 'success');
    setPlanFilter(null);
  }

  return (
    <>
      <div className="page-header animate-fade">
        <h1>{icon('dumbbell', 24)} Workout Planner</h1>
        <p>Your personal workout plans, all in one place</p>
      </div>

      {hasAnyPlans ? (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }} className="animate-slide-up delay-1">
          <button type="button" className={`btn btn-sm ${planFilter === null ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPlanFilter(null)}>
            All
          </button>
          <button type="button" className={`btn btn-sm ${planFilter === 'strength' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPlanFilter('strength')}>🏋️ Strength</button>
          <button type="button" className={`btn btn-sm ${planFilter === 'cardio' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPlanFilter('cardio')}>🏃 Cardio</button>
          <button type="button" className={`btn btn-sm ${planFilter === 'fatLoss' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPlanFilter('fatLoss')}>🔥 Fat Loss</button>
          <button type="button" className={`btn btn-sm ${planFilter === 'muscleGain' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPlanFilter('muscleGain')}>💪 Muscle Gain</button>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setCreateOpen(true)}>
            {icon('plus', 16)} Create Plan
          </button>
        </div>
      ) : null}

      {hasAnyPlans ? (
        displayedPlans.length > 0 ? (
          <div className="grid grid-3 animate-slide-up delay-2" id="plans-grid">
            {displayedPlans.map(p => {
              const completed = isPlanCompleted(p);
              const lastDone = lastCompletionFor(p);
              const lastDoneLabel = lastDone?.date
                ? new Date(lastDone.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : null;
              return (
                <div key={p.id} className={`card card-hover plan-card ${completed ? 'plan-card-completed' : ''}`} style={{ cursor: 'pointer' }}>
                  {completed ? (
                    <div className="plan-card-completed-stamp" aria-hidden="true">
                      {icon('check', 14)} COMPLETED
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <span className="badge badge-accent">{catLabels[p.category] || p.category}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomPlan(p.id);
                      }}
                      style={{ padding: '4px', color: 'var(--danger)' }}
                      aria-label="Delete plan"
                    >
                      {icon('trash', 16)}
                    </button>
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>{p.name}</h3>
                  <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>{p.description || ''}</p>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <span>{icon('clock', 14)} {p.duration}</span>
                    <span>{icon('zap', 14)} {p.level || 'Custom'}</span>
                    <span>{icon('fire', 14)} ~{p.calories} cal</span>
                  </div>
                  {completed && lastDoneLabel ? (
                    <div className="plan-card-meta">
                      {icon('check', 12)} Last completed {lastDoneLabel}
                    </div>
                  ) : null}
                  <button type="button" className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => handleStartWorkout(p.id)}>
                    {icon('play', 14)} {completed ? 'Start Again' : 'Start Workout'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="planner-empty animate-fade" style={{ textAlign: 'center', padding: '60px 24px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No plans match this filter.</p>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }} onClick={() => setPlanFilter(null)}>
              Clear Filter
            </button>
          </div>
        )
      ) : (
        <div className="planner-empty-state animate-fade">
          <div className="planner-empty-icon">{icon('dumbbell', 56)}</div>
          <h2 className="planner-empty-title">No workout plans yet</h2>
          <p className="planner-empty-desc">
            Build your training around your goals. Create your first plan to start tracking sets, reps, and progress.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            {icon('plus', 16)} Create Your First Plan
          </button>
        </div>
      )}

      <div id="create-plan-modal" className={createOpen ? '' : 'hidden'}>
        {createOpen ? (
          <div className="modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
            <div className="modal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>{icon('plus', 20)} Create Custom Plan</h2>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => setCreateOpen(false)}>{icon('x', 20)}</button>
              </div>
              <form onSubmit={handleCreatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="input-group"><label htmlFor="cp-name">Plan Name</label><input className="input" id="cp-name" name="cp-name" required placeholder="My Workout" /></div>
                <div className="input-group"><label htmlFor="cp-cat">Category</label>
                  <select className="input" id="cp-cat" name="cp-cat" defaultValue="strength">
                    <option value="strength">Strength</option><option value="cardio">Cardio</option><option value="fatLoss">Fat Loss</option><option value="muscleGain">Muscle Gain</option>
                  </select>
                </div>
                <div className="input-group"><label htmlFor="cp-dur">Duration</label><input className="input" id="cp-dur" name="cp-dur" placeholder="45 min" required /></div>
                <div className="input-group"><label>Select Exercises</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
                    {getAllExercises().map(ex => (
                      <label key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.85rem', cursor: 'pointer', padding: '4px' }}>
                        <input type="checkbox" value={ex.id} className="cp-exercise" /> {ex.icon} {ex.name}
                      </label>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>{icon('check', 16)} Create Plan</button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
