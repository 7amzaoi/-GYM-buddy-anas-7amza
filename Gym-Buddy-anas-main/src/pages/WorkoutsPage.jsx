import { useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getAllExercises, getExerciseById, EXERCISES } from '../data.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { Toast, launchConfetti } from '../lib/interactions.js';
import { revealOnScroll } from '../lib/motion.js';
import * as haptics from '../lib/haptics.js';

import {
  computeLiveStats, formatTime, playBeep,
  MUSCLE_GROUPS,
} from '../components/workouts/helpers.js';
import IdleScreen from '../components/workouts/IdleScreen.jsx';
import ExerciseCard from '../components/workouts/ExerciseCard.jsx';
import RestBanner from '../components/workouts/RestBanner.jsx';
import { PickerModal, PlateModal, DiscardModal, SummaryModal } from '../components/workouts/Modals.jsx';
import FocusMode from '../components/workouts/FocusMode.jsx';
import useSessionTimer from '../hooks/useSessionTimer.js';
import useWakeLock from '../hooks/useWakeLock.js';

/** Curated quick-pick exercise IDs shown at the top of the picker modal. */
const QUICK_PICK_IDS = ['s1', 's2', 's3', 's5', 's6'];

export default function WorkoutsPage() {
  const navigateToPage = useContext(NavigateContext);
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const exercisesRef = useRef(null);
  const [, forceRender] = useReducer((x) => x + 1, 0);

  // ===== State =====
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

  // Shared with ActiveSessionBar — one source of truth for the clock.
  const elapsedSec = useSessionTimer(session, paused);
  // Keep the screen awake while logging (no-op where unsupported).
  useWakeLock(!!session);

  // ===== Effects =====

  // Backfill default sets when starting from a plan. (The elapsed clock itself
  // now comes from useSessionTimer, shared with ActiveSessionBar.)
  useEffect(() => {
    if (!session) return;
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
  }, [sessionKey]);

  /* Full-screen focus mode: session running AND a mobile viewport. The class
     lives on <html> so the tab bar (rendered in AuthenticatedChrome, outside
     this tree) can be translated off-screen without unmounting it. */
  const [isMobile, setIsMobile] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return undefined;
    const mq = matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const [overviewOpen, setOverviewOpen] = useState(false);
  const focusActive = !!session && isMobile && !overviewOpen && !summaryOpen;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('wko-focus', focusActive);
    return () => root.classList.remove('wko-focus');
  }, [focusActive]);

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

  /* Focus target: the first set that still needs logging. Falls back to the
     last set of the last exercise once everything is done, so the view always
     has something to render. */
  const focus = useMemo(() => {
    const exs = session?.exercises || [];
    for (let ei = 0; ei < exs.length; ei++) {
      const sets = exs[ei].sets || [];
      for (let si = 0; si < sets.length; si++) {
        if (!sets[si].done) return { ei, si };
      }
    }
    const lastEi = Math.max(0, exs.length - 1);
    return { ei: lastEi, si: Math.max(0, (exs[lastEi]?.sets || []).length - 1) };
  }, [session]);
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
      haptics.success(); // set completed
      setRestRemaining(restDuration);
      setRestActive(true);
    }
  }

  /* Focus mode's dominant action: mark the current set done and advance.
     Delegates to toggleSetDone so the rest timer, haptics and validation stay
     in exactly one place. */
  function completeCurrentSet() {
    toggleSetDone(focus.ei, focus.si);
  }

  /* Skip = drop this set from the plan, not mark it done. Keeps the "sets done"
     stat honest. Falls back to clearing the inputs when it's the only set. */
  function skipCurrentSet() {
    const sets = session?.exercises?.[focus.ei]?.sets || [];
    if (sets.length <= 1) {
      updateSet(focus.ei, focus.si, 'weight', '');
      updateSet(focus.ei, focus.si, 'reps', '');
      Toast.show('Set cleared.', 'info', 1200);
      return;
    }
    removeSet(focus.ei, focus.si);
    haptics.tap();
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
    haptics.success(); // session finished
    Toast.show('Workout saved!', 'success', 2500);
    window.setTimeout(() => {
      const { newPRs = 0 } = Store.completeSession() || {};
      if (newPRs > 0) haptics.success(); // new personal record(s)
    }, 200);
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

      {focusActive && (
        <FocusMode
          exIndex={focus.ei}
          setIndex={focus.si}
          ex={session.exercises[focus.ei]}
          data={getExerciseById(session.exercises[focus.ei]?.id)}
          elapsedSec={elapsedSec}
          paused={paused}
          onUpdateSet={updateSet}
          onCompleteSet={completeCurrentSet}
          onSkipSet={skipCurrentSet}
          onOpenPlates={() => setPlateModal({
            ei: focus.ei,
            weight: session.exercises[focus.ei]?.sets?.[focus.si]?.weight || '',
            bar: 20,
          })}
          onOpenOverview={() => setOverviewOpen(true)}
          onTogglePause={togglePause}
          rest={{
            active: restActive,
            remaining: restRemaining,
            duration: restDuration,
            onSkip: skipRest,
            onBump: bumpRest,
            onChangeDuration: setRestDuration,
          }}
        />
      )}

      {/* Sticky live header — eyebrow, plan name, oversized timer, completion bar. */}
      <header className="m1-wkhead">
        <div className="m1-wkhead-top">
          <span className="m1-eyebrow is-muted">Active workout</span>
          <button
            type="button"
            className="m1-iconbtn"
            onClick={() => setDiscardConfirm(true)}
            aria-label="Discard workout"
          >
            {icon('x', 19)}
          </button>
        </div>
        <h1 className="m1-display m1-h2 m1-wkhead-title">{session.planName}</h1>
        <div className="m1-wkhead-row">
          <span className={`m1-timer ${paused ? 'is-paused' : ''}`}>{formatTime(elapsedSec)}</span>
          <div className="m1-wkhead-right">
            <span className="m1-meta">
              {liveStats.doneSets}/{liveStats.totalSets} sets · {session.exercises.length} ex
            </span>
            <button
              type="button"
              className="m1-iconbtn"
              onClick={togglePause}
              aria-label={paused ? 'Resume' : 'Pause'}
            >
              {paused ? icon('play', 17) : icon('pause', 17)}
            </button>
          </div>
        </div>
        <div className="m1-progress">
          <span style={{ width: `${liveStats.totalSets ? (liveStats.doneSets / liveStats.totalSets) * 100 : 0}%` }} />
        </div>

        {/* Rest timer lives inside the sticky header, so it pins to the top of
            the screen while you rest instead of floating at the bottom where the
            tab bar and FAB overlapped it. Renders nothing when inactive. */}
        <RestBanner
          active={restActive}
          remaining={restRemaining}
          duration={restDuration}
          onSkip={skipRest}
          onBump={bumpRest}
          onChangeDuration={setRestDuration}
        />
      </header>

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

          <button type="button" className="m1-cta m1-finish" onClick={tryFinish}>
            {icon('check', 17)} Finish
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
