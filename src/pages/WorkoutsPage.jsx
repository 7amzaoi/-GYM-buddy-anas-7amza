import { useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getAllExercises, getExerciseById, EXERCISES } from '../data.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { Toast, launchConfetti } from '../lib/interactions.js';
import { revealOnScroll } from '../lib/motion.js';

import {
  computeLiveStats, formatTime, playBeep,
  MUSCLE_GROUPS,
} from '../components/workouts/helpers.js';
import IdleScreen from '../components/workouts/IdleScreen.jsx';
import ExerciseCard from '../components/workouts/ExerciseCard.jsx';
import RestBanner from '../components/workouts/RestBanner.jsx';
import { PickerModal, PlateModal, DiscardModal, SummaryModal } from '../components/workouts/Modals.jsx';

/** Curated quick-pick exercise IDs shown at the top of the picker modal. */
const QUICK_PICK_IDS = ['s1', 's2', 's3', 's5', 's6'];

export default function WorkoutsPage() {
  const navigateToPage = useContext(NavigateContext);
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const exercisesRef = useRef(null);
  const [, forceRender] = useReducer((x) => x + 1, 0);

  // ===== State =====
  const [elapsedSec, setElapsedSec] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerCat, setPickerCat] = useState('all');
  const [pickerMuscle, setPickerMuscle] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [restActive, setRestActive] = useState(false);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restDuration, setRestDuration] = useState(60);
  const [plateModal, setPlateModal] = useState(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const pausedRef = useRef(false);

  // ===== Store subscription =====
  useEffect(() => Store.subscribe(() => forceRender()), []);

  const session = Store.get('activeSession');
  const history = Store.get('workoutHistory') || [];
  const progress = Store.get('progressData') || {};
  const records = Store.get('records') || [];
  const allExerciseLogs = useMemo(
    () => history.flatMap((h) => h.exerciseLog || []),
    [history]
  );
  const sessionKey = session ? `${session.startTime}` : '';

  // ===== Effects =====

  // Live elapsed-time tick + backfill default sets when starting from a plan.
  useEffect(() => {
    if (!session) {
      setElapsedSec(0);
      return undefined;
    }
    Store.update('activeSession', (s) => {
      if (!s) return s;
      s.exercises = (s.exercises || []).map((ex) => {
        if (ex.sets) return ex;
        const d = getExerciseById(ex.id);
        const n = d ? d.sets : 3;
        return { ...ex, sets: Array.from({ length: n }, () => ({ weight: '', reps: '', done: false })) };
      });
      return s;
    });
    setElapsedSec(Math.max(0, Math.floor((Date.now() - session.startTime) / 1000)));
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setElapsedSec(Math.max(0, Math.floor((Date.now() - session.startTime) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sessionKey]);

  // Reveal-on-scroll for idle state.
  useEffect(() => revealOnScroll(rootRef.current, '[data-reveal]'), [!!session]);

  // Confetti when the summary modal opens.
  useEffect(() => { if (summaryOpen) launchConfetti(); }, [summaryOpen]);

  // Auto rest-timer countdown.
  useEffect(() => {
    if (!restActive) return undefined;
    const id = window.setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          setRestActive(false);
          playBeep();
          if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
          Toast.show('Rest over — back to work!', 'success', 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [restActive]);

  // ===== Derived =====
  const liveStats = computeLiveStats(session);
  const recentAll = useMemo(() => history.slice(0, 10), [history]);
  const RECENT_PREVIEW = 3;
  const recentVisible = recentExpanded ? recentAll : recentAll.slice(0, RECENT_PREVIEW);
  const recentHidden = Math.max(0, recentAll.length - RECENT_PREVIEW);

  // ===== Handlers =====
  function startEmpty() {
    Store.startFreestyleSession();
    Toast.show("Let's go! Add your first exercise.", 'success', 2000);
  }

  function togglePause() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    Toast.show(next ? 'Timer paused' : 'Timer resumed', 'info', 1200);
  }

  function openPicker() {
    setPickerQuery('');
    setPickerCat('all');
    setPickerMuscle(null);
    setPickerOpen(true);
  }

  function pickExercise(exerciseId) {
    Store.addExerciseToSession(exerciseId);
    setPickerOpen(false);
    Toast.show('Exercise added', 'success', 1200);
    // Smooth-scroll the new exercise into view after the next paint.
    window.setTimeout(() => {
      exercisesRef.current?.lastElementChild?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  function removeExercise(idx) { Store.removeExerciseFromSession(idx); }

  function updateSet(ei, si, field, value) {
    Store.update('activeSession', (s) => {
      if (s?.exercises[ei]?.sets?.[si]) s.exercises[ei].sets[si][field] = value;
      return s;
    });
  }

  function toggleSetDone(ei, si) {
    let startedDone = false;
    Store.update('activeSession', (s) => {
      const set = s?.exercises[ei]?.sets?.[si];
      if (!set) return s;
      set.done = !set.done;
      if (set.done && (!set.weight || !set.reps)) {
        set.done = false;
        Toast.show('Enter weight and reps first!', 'warning');
        return s;
      }
      if (set.done) startedDone = true;
      return s;
    });
    if (startedDone) {
      setRestRemaining(restDuration);
      setRestActive(true);
    }
  }

  function bumpRest(delta) { setRestRemaining((prev) => Math.max(0, Math.min(900, prev + delta))); }
  function skipRest() { setRestActive(false); setRestRemaining(0); }

  function addSet(ei) {
    Store.update('activeSession', (s) => {
      const last = s?.exercises[ei]?.sets?.at(-1);
      s.exercises[ei].sets.push({
        weight: last?.weight || '',
        reps: last?.reps || '',
        done: false,
      });
      return s;
    });
  }

  function removeSet(ei, si) {
    Store.update('activeSession', (s) => {
      if (!s?.exercises[ei]?.sets) return s;
      if (s.exercises[ei].sets.length <= 1) {
        Toast.show('Each exercise needs at least one set.', 'warning', 1500);
        return s;
      }
      s.exercises[ei].sets.splice(si, 1);
      return s;
    });
  }

  function tryFinish() {
    if (liveStats.doneSets === 0) {
      Toast.show('Complete at least one set before finishing.', 'warning');
      return;
    }
    setSummaryOpen(true);
  }

  function confirmSave() {
    // Optionally save the current exercises as a reusable plan first.
    if (saveAsTemplate) {
      const exerciseIds = (session?.exercises || []).map((e) => e.id).filter(Boolean);
      if (exerciseIds.length > 0) {
        const fallbackName = `Workout ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        Store.addCustomPlan({
          name: templateName.trim() || fallbackName,
          category: 'strength',
          duration: `${Math.max(1, Math.round(elapsedSec / 60))} min`,
          level: 'Custom',
          description: 'Saved from a completed workout.',
          exercises: exerciseIds,
          calories: exerciseIds.length * 50,
        });
        Toast.show('Saved as template in Plans.', 'info', 2200);
      }
    }
    setSummaryOpen(false);
    setSaveAsTemplate(false);
    setTemplateName('');
    launchConfetti();
    Toast.show('Workout saved!', 'success', 2500);
    window.setTimeout(() => Store.completeSession(), 200);
  }

  function confirmDiscard() {
    setDiscardConfirm(false);
    Store.discardSession();
    Toast.show('Workout discarded.', 'info', 1500);
  }

  // ===== Idle screen =====
  if (!session) {
    return (
      <IdleScreen
        rootRef={rootRef}
        heroRef={heroRef}
        navigateToPage={navigateToPage}
        progress={progress}
        recentAll={recentAll}
        recentVisible={recentVisible}
        recentHidden={recentHidden}
        recentExpanded={recentExpanded}
        setRecentExpanded={setRecentExpanded}
        onStartEmpty={startEmpty}
      />
    );
  }

  // ===== Active workout screen =====
  const allExercises = getAllExercises();
  const filteredPicker = allExercises.filter((e) => {
    if (pickerCat !== 'all') {
      const inCat = EXERCISES[pickerCat]?.some((x) => x.id === e.id);
      if (!inCat) return false;
    }
    if (pickerMuscle) {
      const group = MUSCLE_GROUPS.find((m) => m.id === pickerMuscle);
      if (group && !group.match.test(e.muscles || '')) return false;
    }
    if (pickerQuery.trim()) {
      const q = pickerQuery.trim().toLowerCase();
      return e.name.toLowerCase().includes(q) || (e.muscles || '').toLowerCase().includes(q);
    }
    return true;
  });
  const muscleCounts = MUSCLE_GROUPS.reduce((acc, g) => {
    acc[g.id] = allExercises.filter((e) => g.match.test(e.muscles || '')).length;
    return acc;
  }, {});
  const quickPicks = QUICK_PICK_IDS.map((id) => getExerciseById(id)).filter(Boolean);

  return (
    <div className="wko wko-active">
      <div className="wko-bg" aria-hidden="true">
        <span className="wko-bg-blob wko-bg-blob-1" />
        <span className="wko-bg-blob wko-bg-blob-2" />
        <span className="wko-bg-grid" />
      </div>

      {/* Sticky live bar */}
      <div className="wko-livebar">
        <div className="wko-livebar-left">
          <button type="button" className="wko-livebar-btn" onClick={() => setDiscardConfirm(true)} aria-label="Discard workout">
            {icon('x', 17)}
          </button>
          <div className="wko-livebar-title">
            <h1>{session.planName}</h1>
            <span>{liveStats.doneSets}/{liveStats.totalSets} sets · {session.exercises.length} exercises</span>
          </div>
        </div>
        <div className="wko-livebar-timer">
          <span className="wko-livebar-timer-label">Duration</span>
          <span className={`wko-livebar-timer-val ${paused ? 'is-paused' : ''}`}>{formatTime(elapsedSec)}</span>
        </div>
        <div className="wko-livebar-actions">
          <button type="button" className="wko-livebar-btn" onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'}>
            {paused ? icon('play', 15) : icon('pause', 15)}
          </button>
          <button type="button" className="gx-btn gx-btn-primary wko-finish-btn" onClick={tryFinish}>
            {icon('check', 15)} Finish
          </button>
        </div>
      </div>

      {/* Live stats strip */}
      <div className="wko-live-stats">
        <LiveStat val={liveStats.doneSets}                         lbl="Sets done" />
        <LiveStat val={liveStats.totalReps}                        lbl="Total reps" />
        <LiveStat val={liveStats.totalVolume.toLocaleString()}     lbl="Volume (kg)" />
        <LiveStat val={session.exercises.length}                   lbl="Exercises" />
      </div>

      {/* Exercises */}
      {session.exercises.length === 0 ? (
        <div className="wko-empty-state">
          <div className="wko-empty-state-icon">{icon('dumbbell', 44)}</div>
          <h3>No exercises yet</h3>
          <p>Add your first exercise to begin logging sets.</p>
          <button type="button" className="gx-btn gx-btn-primary" onClick={openPicker}>
            {icon('plus', 16)} Add Exercise
          </button>
        </div>
      ) : (
        <>
          <div className="wko-exercises" ref={exercisesRef}>
            {session.exercises.map((ex, ei) => {
              const data = getExerciseById(ex.id);
              if (!data) return null;
              return (
                <ExerciseCard
                  key={`${ex.id}-${ei}`}
                  ex={ex} ei={ei} exercises={session.exercises} data={data}
                  records={records} allExerciseLogs={allExerciseLogs}
                  onUpdateSet={updateSet}
                  onToggleSetDone={toggleSetDone}
                  onAddSet={addSet}
                  onRemoveSet={removeSet}
                  onRemoveExercise={removeExercise}
                  onOpenPlateModal={setPlateModal}
                />
              );
            })}
          </div>

          <button type="button" className="wko-add-ex" onClick={openPicker}>
            {icon('plus', 18)} Add Another Exercise
          </button>
        </>
      )}

      {/* ===== Modals & overlays ===== */}
      <PickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        query={pickerQuery} setQuery={setPickerQuery}
        cat={pickerCat} setCat={setPickerCat}
        muscle={pickerMuscle} setMuscle={setPickerMuscle}
        filteredExercises={filteredPicker}
        muscleCounts={muscleCounts}
        quickPicks={quickPicks}
        onPick={pickExercise}
      />

      <RestBanner
        active={restActive}
        remaining={restRemaining}
        duration={restDuration}
        onSkip={skipRest}
        onBump={bumpRest}
        onChangeDuration={setRestDuration}
      />

      <PlateModal
        value={plateModal}
        onChange={setPlateModal}
        onClose={() => setPlateModal(null)}
      />

      <DiscardModal
        open={discardConfirm}
        onClose={() => setDiscardConfirm(false)}
        onConfirm={confirmDiscard}
      />

      <SummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        onConfirm={confirmSave}
        session={session}
        liveStats={liveStats}
        elapsedSec={elapsedSec}
        saveAsTemplate={saveAsTemplate}
        setSaveAsTemplate={setSaveAsTemplate}
        templateName={templateName}
        setTemplateName={setTemplateName}
      />
    </div>
  );
}

function LiveStat({ val, lbl }) {
  return (
    <div className="wko-live-stat">
      <span className="wko-live-stat-val">{val}</span>
      <span className="wko-live-stat-lbl">{lbl}</span>
    </div>
  );
}
