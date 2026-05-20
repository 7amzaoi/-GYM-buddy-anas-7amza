import { useEffect, useRef, useState, useContext } from 'react';
import { Store } from '../store.js';
import { icon } from '../icons.jsx';
import { getExerciseById } from '../data.js';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { Toast, launchConfetti } from '../lib/interactions.js';

function initSetsForSession() {
  Store.update('activeSession', s => {
    s.exercises = s.exercises.map(ex => {
      if (!ex.sets) {
        const data = getExerciseById(ex.id);
        const numSets = data ? data.sets : 3;
        ex.sets = Array.from({ length: numSets }, () => ({ weight: '', reps: '', done: false }));
      }
      return ex;
    });
    return s;
  });
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function SessionPage() {
  const navigateToPage = useContext(NavigateContext);
  const session = Store.get('activeSession');

  const [elapsedSec, setElapsedSec] = useState(0);
  const [restMode, setRestMode] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [endModal, setEndModal] = useState(false);

  const pausedRef = useRef(false);
  const restModeRef = useRef(false);

  useEffect(() => {
    restModeRef.current = restMode;
  }, [restMode]);

  const sessionKey = session ? `${session.planId}:${session.startTime}` : '';

  useEffect(() => {
    const s = Store.get('activeSession');
    if (!s) return undefined;
    if (!s.exercises?.[0]?.sets) initSetsForSession();

    setElapsedSec(0);
    setPaused(false);
    pausedRef.current = false; // pause ref kept in sync in toggleTimer
    setRestMode(false);
    restModeRef.current = false;
    setRestSeconds(0);

    const id = window.setInterval(() => {
      if (!Store.get('activeSession')) return;
      if (pausedRef.current) return;
      if (restModeRef.current) {
        setRestSeconds(prev => {
          const next = prev - 1;
          if (next <= 0) {
            restModeRef.current = false;
            setRestMode(false);
            Toast.show('Rest over! Go!', 'info', 2000);
            return 0;
          }
          return next;
        });
      } else {
        setElapsedSec(v => v + 1);
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [sessionKey]);

  function updateSet(ei, si, field, value) {
    Store.update('activeSession', s => {
      if (s.exercises[ei]?.sets?.[si]) {
        s.exercises[ei].sets[si][field] = value;
      }
      return s;
    });
  }

  function toggleSetDone(exerciseIdx, setIdx) {
    Store.update('activeSession', s => {
      const set = s.exercises[exerciseIdx]?.sets?.[setIdx];
      if (!set) return s;
      set.done = !set.done;
      if (set.done && (!set.weight || !set.reps)) {
        set.done = false;
        Toast.show('Enter weight and reps first!', 'warning');
        return s;
      }
      if (set.done) Toast.show(`Set ${setIdx + 1} done!`, 'success', 1500);
      return s;
    });
  }

  function addSet(exerciseIdx) {
    Store.update('activeSession', s => {
      const lastSet = s.exercises[exerciseIdx]?.sets?.at(-1);
      s.exercises[exerciseIdx].sets.push({
        weight: lastSet?.weight || '',
        reps: lastSet?.reps || '',
        done: false
      });
      return s;
    });
    Toast.show('Set added!', 'info', 1500);
  }

  function completeWorkout() {
    launchConfetti();
    Toast.show('Workout Complete! You crushed it!', 'success', 4000);
    const s = Store.get('activeSession');
    if (s) {
      const totalWeight = s.exercises.reduce((a, ex) => {
        return a + (ex.sets || []).reduce((b, ls) =>
          b + (ls.done ? (parseFloat(ls.weight) || 0) * (parseInt(ls.reps, 10) || 0) : 0), 0);
      }, 0);
      Store.update('progressData', p => {
        p.totalVolume = (p.totalVolume || 0) + totalWeight;
        return p;
      });
    }
    window.setTimeout(() => {
      Store.completeSession();
      navigateToPage?.('dashboard');
    }, 1500);
  }

  function toggleTimer() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    Toast.show(next ? 'Timer paused' : 'Timer resumed', 'info', 1500);
  }

  function startRest() {
    restModeRef.current = true;
    setRestMode(true);
    setRestSeconds(60);
    Toast.show('Rest for 60 seconds...', 'info', 2000);
  }

  function doEndSession() {
    setEndModal(false);
    Toast.show('Session saved! Great work!', 'success');
    Store.completeSession();
    navigateToPage?.('planner');
  }

  if (!session) {
    return (
      <div className="sess">
        <div className="sess-empty" data-reveal>
          <div className="sess-empty-icon">{icon('dumbbell', 44)}</div>
          <h2 className="sess-empty-title">No active session</h2>
          <p className="sess-empty-desc">Start a workout from the planner to begin tracking your sets.</p>
          <button type="button" className="gx-btn gx-btn-primary" onClick={() => navigateToPage?.('planner')}>
            {icon('arrow', 15)} Go to Planner
          </button>
        </div>
      </div>
    );
  }

  const refreshed = Store.get('activeSession');

  const allDone = refreshed.exercises.every(ex => ex.sets && ex.sets.every(ls => ls.done));
  const totalSets = refreshed.exercises.reduce((a, ex) => a + (ex.sets ? ex.sets.length : 0), 0);
  const doneSets = refreshed.exercises.reduce((a, ex) => a + (ex.sets ? ex.sets.filter(ls => ls.done).length : 0), 0);
  const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;
  const doneExercises = refreshed.exercises.filter(ex => ex.sets && ex.sets.length > 0 && ex.sets.every(ls => ls.done)).length;

  const displayTime = formatTime(restMode ? restSeconds : elapsedSec);
  // First exercise that still has unfinished sets — the current focus.
  const focusIdx = refreshed.exercises.findIndex(ex => !(ex.sets && ex.sets.length > 0 && ex.sets.every(ls => ls.done)));

  return (
    <div className="sess">
      {/* ===== Sticky session bar ===== */}
      <div className={`sess-bar ${restMode ? 'is-rest' : ''}`}>
        <button type="button" className="sess-bar-back" onClick={() => setEndModal(true)} aria-label="End session">
          {icon('back', 18)}
        </button>
        <div className="sess-bar-title">
          <h1>{refreshed.planName}</h1>
          <span>{doneSets}/{totalSets} sets · {doneExercises}/{refreshed.exercises.length} exercises</span>
        </div>
        <div className="sess-bar-timer">
          <span className="sess-timer-label">{restMode ? 'Rest' : 'Elapsed'}</span>
          <span className={`sess-timer-val ${restMode ? 'is-rest' : ''} ${paused ? 'is-paused' : ''}`}>{displayTime}</span>
        </div>
        <div className="sess-bar-actions">
          <button type="button" className="sess-icon-btn" onClick={toggleTimer} aria-label={paused ? 'Resume timer' : 'Pause timer'}>
            {paused ? icon('play', 15) : icon('pause', 15)}
          </button>
          {!restMode ? (
            <button type="button" className="gx-btn gx-btn-ghost sess-rest-btn" onClick={startRest}>
              {icon('clock', 14)} Rest
            </button>
          ) : null}
        </div>
      </div>

      {/* ===== Progress ===== */}
      <div className="sess-progress" data-reveal>
        <div className="sess-progress-track">
          <div className="sess-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="sess-progress-meta">
          <span className="sess-progress-pct">{pct}% complete</span>
          <span className={`sess-progress-state ${restMode ? 'is-rest' : ''}`}>
            {restMode ? icon('clock', 13) : icon('zap', 13)} {restMode ? 'Resting' : 'Working'}
          </span>
          <span className="sess-progress-cal">{icon('fire', 13)} ~{refreshed.calories} cal</span>
        </div>
      </div>

      {/* ===== Exercises ===== */}
      <div className="sess-exercises">
        {refreshed.exercises.map((ex, ei) => {
          const data = getExerciseById(ex.id);
          if (!data) return null;
          const sets = ex.sets || [];
          const exDone = sets.length > 0 && sets.every(ls => ls.done);
          const exDoneSets = sets.filter(ls => ls.done).length;
          const isFocus = ei === focusIdx && !exDone;
          return (
            <article key={ex.id} className={`gx-card sess-ex ${exDone ? 'is-done' : ''} ${isFocus ? 'is-focus' : ''}`}>
              <div className="sess-ex-head">
                <div className="sess-ex-title">
                  <span className={`sess-ex-badge ${exDone ? 'is-done' : ''}`}>
                    {exDone ? icon('check', 15) : ei + 1}
                  </span>
                  <div>
                    <h3>{data.name}</h3>
                    <span className="sess-ex-sub">{exDoneSets}/{sets.length} sets done</span>
                  </div>
                </div>
                {isFocus ? <span className="sess-ex-now">Current</span> : null}
              </div>

              <div className="sess-set-grid sess-set-head">
                <span>Set</span><span>Weight (kg)</span><span>Reps</span><span>Done</span>
              </div>
              {sets.map((ls, si) => (
                <div key={si} className={`sess-set-grid sess-set-row ${ls.done ? 'is-done' : ''}`}>
                  <span className="sess-set-idx">{si + 1}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="sess-set-input"
                    value={ls.weight}
                    onChange={ev => updateSet(ei, si, 'weight', ev.target.value)}
                    placeholder="kg"
                    aria-label={`Weight for set ${si + 1}`}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    className="sess-set-input"
                    value={ls.reps}
                    onChange={ev => updateSet(ei, si, 'reps', ev.target.value)}
                    placeholder="reps"
                    aria-label={`Reps for set ${si + 1}`}
                  />
                  <button
                    type="button"
                    className={`sess-set-check ${ls.done ? 'is-checked' : ''}`}
                    onClick={() => toggleSetDone(ei, si)}
                    aria-label={`Mark set ${si + 1} as done`}
                  >
                    {ls.done ? icon('check', 15) : null}
                  </button>
                </div>
              ))}
              <button type="button" className="sess-add-set" onClick={() => addSet(ei)}>
                {icon('plus', 14)} Add set
              </button>
            </article>
          );
        })}
      </div>

      {/* ===== Footer action ===== */}
      <div className="sess-footer">
        {allDone && totalSets > 0 ? (
          <button type="button" className="gx-btn gx-btn-primary sess-complete-btn" onClick={completeWorkout}>
            {icon('trophy', 17)} Complete Workout
          </button>
        ) : (
          <button type="button" className="gx-btn gx-btn-ghost sess-complete-btn" onClick={() => setEndModal(true)}>
            End Session
          </button>
        )}
      </div>

      {/* ===== End session modal ===== */}
      {endModal && (
        <div
          className="gx-modal-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) setEndModal(false); }}
        >
          <div className="gx-modal gx-modal-sm" role="dialog" aria-modal="true" aria-label="End session">
            <div className="sess-end-icon">{icon('clock', 26)}</div>
            <h2 className="sess-end-title">End this session?</h2>
            <p className="sess-end-desc">Your completed sets will be saved to your history.</p>
            <div className="sess-end-actions">
              <button type="button" className="gx-btn gx-btn-ghost" onClick={() => setEndModal(false)}>
                Keep Going
              </button>
              <button type="button" className="gx-btn gx-btn-primary" onClick={doEndSession}>
                {icon('check', 15)} Yes, End
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
