import { icon } from '../../icons.jsx';
import { formatTime } from './helpers.js';
import RestBanner from './RestBanner.jsx';

/**
 * FOCUS MODE — the full-screen logging view shown on mobile while a session is
 * running.
 *
 * Read at arm's length, mid-set, with one hand: the weight and rep figures are
 * the largest type on the screen, the single dominant action sits at thumb
 * height, and every secondary control is small and pushed to the sides so it
 * can't be hit by accident while reaching for "Complete set".
 *
 * It renders as a fixed overlay ON TOP of the exercise list rather than
 * replacing it — the list, the sticky header and the tab bar all stay mounted
 * underneath (the chrome is translated off-screen by `html.wko-focus`), so
 * leaving focus mode restores scroll position and state for free.
 */
export default function FocusMode({
  exIndex, setIndex, data, ex, elapsedSec, paused,
  onUpdateSet, onCompleteSet, onSkipSet, onOpenPlates, onOpenOverview, onTogglePause,
  rest,
}) {
  const sets = ex?.sets || [];
  const current = sets[setIndex];
  if (!data || !current) return null;

  const totalSets = sets.length;
  const doneSets = sets.filter((s) => s.done).length;
  const canComplete = String(current.weight).trim() !== '' && String(current.reps).trim() !== '';

  return (
    <section className="wko-focus" aria-label={`Logging ${data.name}`}>
      {/* ---- Top: which exercise, which set ---- */}
      <header className="wko-focus-top">
        <div className="wko-focus-top-row">
          <span className="wko-focus-timer">{formatTime(elapsedSec)}</span>
          <button
            type="button"
            className="wko-focus-lateral"
            onClick={onTogglePause}
            aria-label={paused ? 'Resume timer' : 'Pause timer'}
          >
            {paused ? icon('play', 16) : icon('pause', 16)}
          </button>
        </div>
        <h1 className="wko-focus-name">{data.name}</h1>
        <p className="wko-focus-sub">
          Set {setIndex + 1} of {totalSets}
          {data.reps ? <> · target {data.reps} reps</> : null}
          {' · '}
          {data.muscles}
        </p>
        <div className="wko-focus-progress" aria-hidden="true">
          <span style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
      </header>

      {/* ---- The numbers: the whole point of the screen ---- */}
      <div className="wko-focus-fields">
        <label className="wko-focus-field">
          <span className="wko-focus-field-lbl">Weight</span>
          <input
            type="number"
            inputMode="decimal"
            className="wko-focus-input"
            value={current.weight}
            onChange={(e) => onUpdateSet(exIndex, setIndex, 'weight', e.target.value)}
            placeholder="0"
            aria-label="Weight in kilograms"
          />
          <span className="wko-focus-field-unit">kg</span>
        </label>

        <span className="wko-focus-times" aria-hidden="true">×</span>

        <label className="wko-focus-field">
          <span className="wko-focus-field-lbl">Reps</span>
          <input
            type="number"
            inputMode="numeric"
            className="wko-focus-input"
            value={current.reps}
            onChange={(e) => onUpdateSet(exIndex, setIndex, 'reps', e.target.value)}
            placeholder="0"
            aria-label="Repetitions"
          />
          <span className="wko-focus-field-unit">reps</span>
        </label>
      </div>

      {/* ---- Secondary: small, lateral, out of the thumb arc ---- */}
      <div className="wko-focus-secondary">
        <button type="button" className="wko-focus-lateral" onClick={onOpenPlates}>
          {icon('dumbbell', 15)} Plates
        </button>
        <button type="button" className="wko-focus-lateral" onClick={onSkipSet}>
          {icon('skip', 15)} Skip set
        </button>
        <button type="button" className="wko-focus-lateral" onClick={onOpenOverview}>
          {icon('menu', 15)} All exercises
        </button>
      </div>

      {/* ---- Rest timer sits directly above the primary action ---- */}
      <div className="wko-focus-foot">
        <RestBanner {...rest} />
        <button
          type="button"
          className="m1-cta wko-focus-cta"
          onClick={onCompleteSet}
          disabled={!canComplete}
        >
          {icon('check', 18)} Complete set
        </button>
      </div>
    </section>
  );
}
