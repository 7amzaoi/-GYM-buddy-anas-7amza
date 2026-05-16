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
            Toast.show('Rest over! Go! 🔥', 'info', 2000);
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
      if (set.done) Toast.show(`Set ${setIdx + 1} done! 💪`, 'success', 1500);
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
    Toast.show('Workout Complete! You crushed it! 🏆', 'success', 4000);
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
      <div className="session-container page">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <h2>No Active Session</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>Start a workout from the planner first.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigateToPage?.('planner')}>Go to Planner</button>
        </div>
      </div>
    );
  }

  const refreshed = Store.get('activeSession');

  const allDone = refreshed.exercises.every(ex => ex.sets && ex.sets.every(ls => ls.done));
  const totalSets = refreshed.exercises.reduce((a, ex) => a + (ex.sets ? ex.sets.length : 0), 0);
  const doneSets = refreshed.exercises.reduce((a, ex) => a + (ex.sets ? ex.sets.filter(ls => ls.done).length : 0), 0);
  const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  const displayTime = formatTime(restMode ? restSeconds : elapsedSec);

  return (
    <div className="session-container">
      <div className="page-header animate-fade">
        <div className="session-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setEndModal(true)}>{icon('back', 20)}</button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{refreshed.planName}</h1>
              <p>{doneSets}/{totalSets} sets completed</p>
            </div>
          </div>
          <div className="session-header-actions">
            <div className={`timer-mini ${restMode ? 'rest' : ''}`} id="timer-display">{displayTime}</div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={toggleTimer}>
              {paused ? icon('play', 14) : icon('pause', 14)}
            </button>
            {!restMode ? (
              <button type="button" className="btn btn-primary btn-sm" data-tooltip="Rest 60s" onClick={startRest}>
                {icon('clock', 14)} Rest
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="animate-slide-up delay-1" style={{ marginBottom: '28px' }}>
        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width .5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
          <span>{pct}% complete</span>
          <span>{restMode ? '😤 Resting...' : '💪 Working'}</span>
          <span>~{refreshed.calories} cal</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-slide-up delay-2">
        {refreshed.exercises.map((ex, ei) => {
          const data = getExerciseById(ex.id);
          if (!data) return null;
          const sets = ex.sets || [];
          const exDone = sets.length > 0 && sets.every(ls => ls.done);
          return (
            <div key={ex.id} className={`card ${exDone ? 'exercise-card-done' : ''}`} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{data.icon}</span> {data.name}
                </h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => Toast.show(`${data.name} — History coming soon!`, 'info', 2000)} style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>
                  HISTORY
                </button>
              </div>
              <div className="set-row set-row-header">
                <span>Set</span><span>Weight (kg)</span><span>Reps</span><span style={{ textAlign: 'center' }}>Done</span>
              </div>
              {sets.map((ls, si) => (
                <div key={si} className={`set-row ${ls.done ? 'set-row-done' : ''}`}>
                  <span className="set-row-index">{si + 1}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="set-input"
                    value={ls.weight}
                    onChange={ev => updateSet(ei, si, 'weight', ev.target.value)}
                    placeholder="kg"
                    aria-label={`Weight for set ${si + 1}`}
                    style={ls.done ? { opacity: '.6' } : undefined}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    className="set-input"
                    value={ls.reps}
                    onChange={ev => updateSet(ei, si, 'reps', ev.target.value)}
                    placeholder="reps"
                    aria-label={`Reps for set ${si + 1}`}
                    style={ls.done ? { opacity: '.6' } : undefined}
                  />
                  <div className="set-row-done-cell">
                    <button type="button" className={`set-done-btn ${ls.done ? 'checked' : ''}`} onClick={() => toggleSetDone(ei, si)} aria-label={`Mark set ${si + 1} as done`}>
                      {ls.done ? icon('check', 16) : null}
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" className="add-set-btn" onClick={() => addSet(ei)}>
                {icon('plus', 14)} ADD SET
              </button>
            </div>
          );
        })}
      </div>

      <div id="end-session-modal" className={endModal ? '' : 'hidden'}>
        {endModal ? (
          <div className="modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setEndModal(false); }}>
            <div className="modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <h2 style={{ marginBottom: '8px' }}>{icon('back', 22)} End Session?</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Your progress will be saved.</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEndModal(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={doEndSession} style={{ flex: 1 }}>{icon('check', 16)} Yes, End</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: '28px', display: 'flex', gap: '12px' }} className="animate-slide-up delay-3">
        {allDone && totalSets > 0 ? (
          <button type="button" className="btn btn-primary pulse-glow" onClick={completeWorkout} style={{ flex: 1 }}>{icon('trophy', 18)} Complete Workout!</button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setEndModal(true)} style={{ flex: 1 }}>End Session</button>
        )}
      </div>
    </div>
  );
}
