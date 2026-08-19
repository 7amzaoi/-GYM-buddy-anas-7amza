/**
 * ExerciseTile — one card in the exercise library grid.
 *
 * The thumbnail is a dedicated, fixed-aspect-ratio box, NOT a text node with an
 * emoji sitting in it. That is the entire point of this structure: when the
 * WorkoutX asset provider lands, the only edit is passing a `gifUrl` — the box,
 * its size and its reserved space are identical either way, so swapping a GIF
 * in causes no reflow and no layout shift.
 *
 * @param {{
 *   exercise: { id: string, name: string, muscles: string, sets: number, reps: string, icon: string },
 *   gifUrl?: string | null,
 *   onOpen?: (exercise: object) => void,
 * }} props
 */
export default function ExerciseTile({ exercise, gifUrl = null, onOpen }) {
  return (
    <button
      type="button"
      className="lib-tile"
      onClick={() => onOpen?.(exercise)}
      aria-label={`${exercise.name} — ${exercise.muscles}`}
    >
      <span className="lib-tile-thumb">
        {/* ▼▼▼ WORKOUTX INTEGRATION POINT ▼▼▼
            Today `gifUrl` is always null, so every tile renders the fallback
            glyph. When the assetProvider from the WorkoutX plan ships, the call
            site passes `gifUrl={assetProvider.thumbFor(exercise.id)}` and this
            branch starts serving real animations. Nothing else changes. */}
        {gifUrl ? (
          <img
            className="lib-tile-gif"
            src={gifUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width="240"
            height="240"
          />
        ) : (
          <span className="lib-tile-glyph" aria-hidden="true">{exercise.icon}</span>
        )}
        {/* ▲▲▲ WORKOUTX INTEGRATION POINT ▲▲▲ */}
      </span>

      <span className="lib-tile-body">
        <span className="lib-tile-name">{exercise.name}</span>
        <span className="lib-tile-muscles">{exercise.muscles}</span>
      </span>
    </button>
  );
}
