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
import SplitBuilder, { WeekStrip, DAY_FULL } from '../components/planner/SplitBuilder.jsx';
import { shareSplit, revokeSharedSplit } from '../services/splitsApi.js';

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
  /** Plan being renamed: { id, name }. Drives the rename modal. */
  const [renaming, setRenaming] = useState(null);
  /** Muscle group narrowing the create-plan exercise list; null = all. */
  const [exFilter, setExFilter] = useState(null);
  /* Selection lives in state, not in the DOM. The filter has to be free to
     unmount rows, and reading `.cp-exercise:checked` at submit would then drop
     every exercise picked under a different group without telling anyone. */
  const [pickedIds, setPickedIds] = useState([]);
  /* Splits are additive: a tab keeps the existing plan flow completely intact
     rather than restructuring the page around a concept most users won't open. */
  const [tab, setTab] = useState('plans');
  const [splitBuilderOpen, setSplitBuilderOpen] = useState(false);
  const [openSplitId, setOpenSplitId] = useState(null);
  /** Split id currently being shared, so only that row shows a spinner. */
  const [sharingId, setSharingId] = useState(null);
  /** Last share per split id: { sharedId, url }. Enables revoke without a refetch. */
  const [shares, setShares] = useState({});

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

  const userSplits = user ? (Store.get('customSplits') || []) : [];
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

  function handleRename(ev) {
    ev.preventDefault();
    if (!renaming) return;
    const name = String(renaming.name || '').trim();
    if (!name) {
      Toast.show('Give the plan a name.', 'warning');
      return;
    }
    Store.renameCustomPlan(renaming.id, name);
    setRenaming(null);
    Toast.show('Plan renamed.', 'success');
  }

  function togglePicked(id) {
    setPickedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const allExercises = getAllExercises();
  const visibleExercises = allExercises.filter((ex) => matchesMuscleGroup(ex, exFilter));

  /**
   * Publish a snapshot, then hand the link to the OS share sheet when there is
   * one and fall back to the clipboard. navigator.share must be called inside
   * the user gesture, so it runs before any state update that could yield.
   */
  async function handleShare(split) {
    if (sharingId) return;
    setSharingId(split.id);
    try {
      const { data, error } = await shareSplit(split);
      if (error || !data) {
        Toast.show('Could not create a share link. Please try again.', 'error', 5000);
        return;
      }
      setShares((prev) => ({ ...prev, [split.id]: { sharedId: data.id, url: data.url } }));
      const url = data.url;
      if (navigator.share) {
        try {
          await navigator.share({ title: split.name, text: `My ${split.name} split`, url });
          return;
        } catch {
          // Cancelled or unsupported at runtime — fall through to the clipboard.
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        Toast.show('Share link copied to clipboard.', 'success', 3000);
      } catch {
        Toast.show(url, 'info', 8000);
      }
    } finally {
      setSharingId(null);
    }
  }

  async function handleRevoke(splitId) {
    const share = shares[splitId];
    if (!share?.sharedId) return;
    const { error } = await revokeSharedSplit(share.sharedId);
    if (error) {
      Toast.show('Could not revoke that link.', 'error', 4000);
      return;
    }
    setShares((prev) => { const next = { ...prev }; delete next[splitId]; return next; });
    Toast.show('Link revoked. It no longer opens for anyone.', 'success', 3500);
  }

  function handleDeleteSplit(id) {
    Store.deleteCustomSplit(id);
    if (openSplitId === id) setOpenSplitId(null);
    Toast.show('Split deleted.', 'info', 2500);
  }

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

      <div className="split-tabs" role="tablist" aria-label="Plans or splits">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'plans'}
          className={`split-tab ${tab === 'plans' ? 'is-active' : ''}`}
          onClick={() => setTab('plans')}
        >
          Plans <span className="split-tab-count">{userPlans.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'splits'}
          className={`split-tab ${tab === 'splits' ? 'is-active' : ''}`}
          onClick={() => setTab('splits')}
        >
          Splits <span className="split-tab-count">{userSplits.length}</span>
        </button>
      </div>

      {tab === 'splits' && (
        <SplitsPanel
          splits={userSplits}
          openSplitId={openSplitId}
          setOpenSplitId={setOpenSplitId}
          builderOpen={splitBuilderOpen}
          setBuilderOpen={setSplitBuilderOpen}
          onShare={handleShare}
          onRevoke={handleRevoke}
          onDelete={handleDeleteSplit}
          sharingId={sharingId}
          shares={shares}
        />
      )}

      {tab === 'plans' && (hasAnyPlans ? (
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
                      <span className="plan-card-acts">
                        <button
                          type="button"
                          className="plan-card-edit"
                          onClick={(e) => { e.stopPropagation(); setRenaming({ id: p.id, name: p.name }); }}
                          aria-label={`Rename ${p.name}`}
                        >
                          {icon('edit', 15)}
                        </button>
                        <button
                          type="button"
                          className="plan-card-del"
                          onClick={(e) => { e.stopPropagation(); deleteCustomPlan(p.id); }}
                          aria-label={`Delete ${p.name}`}
                        >
                          {icon('trash', 15)}
                        </button>
                      </span>
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
      ))}

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

      {/* ===== Rename plan ===== */}
      {renaming && (
        <div
          className="gx-modal-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setRenaming(null); }}
        >
          <div className="gx-modal gx-modal-sm" role="dialog" aria-modal="true" aria-label="Rename plan">
            <div className="gx-modal-head">
              <h2>Rename Plan</h2>
              <button type="button" className="gx-modal-close" onClick={() => setRenaming(null)} aria-label="Close">
                {icon('x', 18)}
              </button>
            </div>
            <form className="gx-modal-form" onSubmit={handleRename}>
              <label className="prof-field">
                <span>Plan name</span>
                {/* autoFocus: the modal exists only to edit this one field. */}
                <input
                  value={renaming.name}
                  onChange={(e) => setRenaming((cur) => ({ ...cur, name: e.target.value }))}
                  maxLength={40}
                  autoFocus
                  required
                />
              </label>
              <button type="submit" className="gx-btn gx-btn-primary" style={{ width: '100%' }}>
                {icon('check', 15)} Save Name
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

/**
 * Splits tab: builder, list, and per-split detail.
 *
 * Kept in this file rather than another component because it is presentation
 * over props with no state of its own — all of it lives in PlannerPage.
 */
function SplitsPanel({
  splits, openSplitId, setOpenSplitId, builderOpen, setBuilderOpen,
  onShare, onRevoke, onDelete, sharingId, shares,
}) {
  if (builderOpen) {
    return (
      <section className="split-panel" data-reveal>
        <h2 className="split-panel-title">New weekly split</h2>
        <SplitBuilder
          onDone={() => setBuilderOpen(false)}
          onCancel={() => setBuilderOpen(false)}
        />
      </section>
    );
  }

  if (splits.length === 0) {
    return (
      <div className="plan-empty plan-empty-hero" data-reveal>
        <div className="plan-empty-icon plan-empty-icon-lg">{icon('calendar', 52)}</div>
        <h2 className="plan-empty-title">No weekly splits yet</h2>
        <p className="plan-empty-desc">
          A split maps your week — which days you train, which you rest, and what
          each session is. Build one and you can share it with a friend.
        </p>
        <button type="button" className="gx-btn gx-btn-primary" onClick={() => setBuilderOpen(true)}>
          {icon('plus', 15)} Build a split
        </button>
      </div>
    );
  }

  return (
    <section className="split-panel" data-reveal>
      <button type="button" className="split-btn is-primary split-new" onClick={() => setBuilderOpen(true)}>
        {icon('plus', 15)} Build a split
      </button>

      <ul className="split-list">
        {splits.map((sp) => {
          const open = openSplitId === sp.id;
          const training = (sp.days || []).filter((d) => d.type === 'plan').length;
          const share = shares[sp.id];
          return (
            <li className="split-card" key={sp.id}>
              <button
                type="button"
                className="split-card-head"
                onClick={() => setOpenSplitId(open ? null : sp.id)}
                aria-expanded={open}
              >
                <span className="split-card-text">
                  <span className="split-card-name">{sp.name}</span>
                  <span className="split-card-meta">
                    {training} training · {7 - training} rest
                    {sp.sourceSplitId ? ' · Imported from a shared split' : ''}
                  </span>
                </span>
                <span className={`split-day-chev ${open ? 'is-open' : ''}`} aria-hidden="true">
                  {icon('chevron', 16)}
                </span>
              </button>

              <WeekStrip days={sp.days} compact />

              {open && (
                <div className="split-card-body">
                  {sp.description && <p className="split-detail-desc">{sp.description}</p>}

                  <ul className="split-daylist is-readonly">
                    {(sp.days || []).map((d, i) => (
                      <li className={`split-day ${d.type === 'plan' ? 'is-training' : 'is-rest'}`} key={i}>
                        <div className="split-day-head is-static">
                          <span className="split-day-name">{DAY_FULL[i]}</span>
                          <span className="split-day-sum">
                            {d.type === 'plan' ? (d.planName || 'Training') : 'Rest'}
                          </span>
                        </div>
                        {d.type === 'plan' && (d.exercises || []).length > 0 && (
                          <ul className="split-exsummary">
                            {d.exercises.map((e) => (
                              <li key={e.id}>
                                <span className="split-ex-name">{e.name}</span>
                                <span className="split-ex-muscles">{e.muscles}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="split-actions">
                    <button
                      type="button"
                      className="split-btn is-primary"
                      onClick={() => onShare(sp)}
                      disabled={sharingId === sp.id}
                    >
                      {sharingId === sp.id ? 'Creating link…' : <>{icon('share', 15)} Share</>}
                    </button>
                    <button type="button" className="split-btn is-danger" onClick={() => onDelete(sp.id)}>
                      {icon('trash', 15)} Delete
                    </button>
                  </div>

                  {share && (
                    <div className="split-share-row">
                      <p className="split-hint">
                        Anyone signed in with this link can view this snapshot. Editing the
                        split won’t change what they see.
                      </p>
                      <button type="button" className="split-btn" onClick={() => onRevoke(sp.id)}>
                        Revoke link
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
