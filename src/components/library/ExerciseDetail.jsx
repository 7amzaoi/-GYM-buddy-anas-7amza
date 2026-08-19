import BottomSheet from '../BottomSheet.jsx';
import { icon } from '../../icons.jsx';

/**
 * ExerciseDetail — the sheet that opens when a library tile is tapped.
 *
 * Sections: hero (thumbnail + name + muscles), quick facts, a "how to"
 * placeholder, and the Add-to-workout action.
 *
 * `addLabel` differs by context and is decided by the page, not here: with a
 * workout running the button appends the exercise to it; without one there is
 * nothing to append to, so it just takes you to Train.
 *
 * @param {{
 *   exercise: object | null,
 *   categoryLabel?: string,
 *   gifUrl?: string | null,
 *   addLabel?: string,
 *   onAdd?: (exercise: object) => void,
 *   onClose?: () => void,
 * }} props
 */
export default function ExerciseDetail({
  exercise, categoryLabel, gifUrl = null, addLabel = 'Add to workout', onAdd, onClose,
}) {
  // The sheet title stays generic: the exercise name is the hero heading right
  // below it, and printing it twice made the sheet read as a stutter.
  return (
    <BottomSheet open={!!exercise} onClose={onClose} title="Exercise">
      {exercise && (
        <div className="lib-detail">
          <div className="lib-detail-hero">
            <span className="lib-detail-thumb">
              {/* Same fallback/GIF split as ExerciseTile — see the WORKOUTX
                  INTEGRATION POINT comment there. */}
              {gifUrl ? (
                <img
                  className="lib-detail-gif"
                  src={gifUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width="320"
                  height="320"
                />
              ) : (
                <span className="lib-detail-glyph" aria-hidden="true">{exercise.icon}</span>
              )}
            </span>
            <div className="lib-detail-headings">
              <h3 className="lib-detail-name">{exercise.name}</h3>
              <p className="lib-detail-muscles">{exercise.muscles}</p>
            </div>
          </div>

          <dl className="lib-facts">
            <div className="lib-fact">
              <dt>Sets</dt>
              <dd>{exercise.sets}</dd>
            </div>
            <div className="lib-fact">
              <dt>Reps</dt>
              <dd>{exercise.reps}</dd>
            </div>
            <div className="lib-fact">
              <dt>Category</dt>
              <dd>{categoryLabel || '—'}</dd>
            </div>
          </dl>

          <section className="lib-howto">
            <h4 className="lib-howto-title">How to</h4>
            <p className="lib-howto-body">
              Detailed guide coming soon. For now, the sets and reps above are the
              defaults this exercise starts with when you add it to a workout.
            </p>
          </section>

          <button type="button" className="lib-add" onClick={() => onAdd?.(exercise)}>
            {icon('plus', 16)} {addLabel}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
