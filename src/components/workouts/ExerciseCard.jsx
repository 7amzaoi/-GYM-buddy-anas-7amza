import { icon } from '../../icons.jsx';
import ProgressRing from './ProgressRing.jsx';
import { calc1RM, getOverloadSuggestion } from './helpers.js';

/** A single exercise card with its sets, overload hint, plate tool, and remove button. */
export default function ExerciseCard({
  ex, ei, exercises, data, records, allExerciseLogs,
  onUpdateSet, onToggleSetDone, onAddSet, onRemoveSet,
  onRemoveExercise, onOpenPlateModal,
}) {
  const sets = ex.sets || [];
  const exDoneSets = sets.filter((s) => s.done).length;
  const exDone = sets.length > 0 && exDoneSets === sets.length;
  // The first exercise that still has incomplete sets is the "now" focus.
  const isFocus = !exDone && exercises
    .slice(0, ei)
    .every((p) => (p.sets || []).length > 0 && (p.sets || []).every((s) => s.done));
  const hint = getOverloadSuggestion(ex.id, records, allExerciseLogs);

  return (
    <article className={`gx-card wko-ex ${exDone ? 'is-done' : ''} ${isFocus ? 'is-focus' : ''}`}>
      {isFocus ? <span className="wko-ex-now" aria-hidden>Now</span> : null}

      {hint && (
        <div className="wko-ex-overload" title="Progressive overload suggestion">
          <span className="wko-ex-overload-icon">{icon('zap', 12)}</span>
          <span>
            Last best <strong>{hint.bestW}kg × {hint.bestR}</strong>
            {' · '}
            try <strong className="wko-ex-overload-target">{hint.nextW}kg × {hint.nextR}</strong>
          </span>
        </div>
      )}

      <div className="wko-ex-head">
        <div className="wko-ex-title">
          <ProgressRing done={exDoneSets} total={sets.length} />
          <div>
            <h3>{data.name}</h3>
            <span className="wko-ex-muscles">{data.muscles}</span>
          </div>
        </div>
        <div className="wko-ex-tools">
          <button
            type="button"
            className="wko-ex-tool"
            onClick={() => onOpenPlateModal({ ei, weight: (ex.sets?.[0]?.weight) || '', bar: 20 })}
            aria-label={`Plate calculator for ${data.name}`}
            title="Plate calculator"
          >
            {icon('dumbbell', 14)}
          </button>
          <button
            type="button"
            className="wko-ex-remove"
            onClick={() => onRemoveExercise(ei)}
            aria-label={`Remove ${data.name}`}
          >
            {icon('trash', 15)}
          </button>
        </div>
      </div>

      <div className="wko-set-grid wko-set-head">
        <span>Set</span><span>Weight (kg)</span><span>Reps</span><span>Done</span><span aria-hidden />
      </div>
      {sets.map((ls, si) => {
        const oneRm = ls.done ? calc1RM(ls.weight, ls.reps) : null;
        return (
          <div key={si} className="wko-set-wrap">
            <div className={`wko-set-grid wko-set-row ${ls.done ? 'is-done' : ''}`}>
              <span className="wko-set-idx">{si + 1}</span>
              <input
                type="number"
                inputMode="decimal"
                className="wko-set-input"
                value={ls.weight}
                onChange={(e) => onUpdateSet(ei, si, 'weight', e.target.value)}
                placeholder="kg"
                aria-label={`Weight set ${si + 1}`}
              />
              <input
                type="number"
                inputMode="numeric"
                className="wko-set-input"
                value={ls.reps}
                onChange={(e) => onUpdateSet(ei, si, 'reps', e.target.value)}
                placeholder="reps"
                aria-label={`Reps set ${si + 1}`}
              />
              <button
                type="button"
                className={`wko-set-check ${ls.done ? 'is-checked' : ''}`}
                onClick={() => onToggleSetDone(ei, si)}
                aria-label={`Mark set ${si + 1} done`}
              >
                {ls.done ? icon('check', 15) : null}
              </button>
              <button
                type="button"
                className="wko-set-remove"
                onClick={() => onRemoveSet(ei, si)}
                aria-label={`Remove set ${si + 1}`}
                disabled={sets.length <= 1}
              >
                {icon('x', 13)}
              </button>
            </div>
            {ls.done && (
              <div className="wko-set-extras">
                {oneRm ? (
                  <span className="wko-set-1rm" title="Estimated 1-rep max (Epley)">
                    {icon('zap', 11)} ~{oneRm} kg 1RM
                  </span>
                ) : null}
                <div className="wko-set-rpe" role="group" aria-label={`RPE for set ${si + 1}`}>
                  <span className="wko-set-rpe-label">RPE</span>
                  {[6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`wko-set-rpe-btn ${ls.rpe === n ? 'is-active' : ''}`}
                      onClick={() => onUpdateSet(ei, si, 'rpe', ls.rpe === n ? null : n)}
                      aria-pressed={ls.rpe === n}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="wko-add-set" onClick={() => onAddSet(ei)}>
        {icon('plus', 13)} Add set
      </button>
    </article>
  );
}
