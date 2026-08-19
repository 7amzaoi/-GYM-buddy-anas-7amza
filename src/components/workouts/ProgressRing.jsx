import { icon } from '../../icons.jsx';

/** SVG progress ring shown around the set number on each exercise card. */
export default function ProgressRing({ done, total }) {
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const r = 16;
  const c = 2 * Math.PI * r;
  const isComplete = pct >= 1;
  return (
    <span className={`wko-ring ${isComplete ? 'is-complete' : ''}`} aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} className="wko-ring-track" />
        <circle
          cx="20" cy="20" r={r}
          className="wko-ring-fill"
          style={{ strokeDasharray: c, strokeDashoffset: c * (1 - pct) }}
        />
      </svg>
      <span className="wko-ring-label">
        {isComplete ? icon('check', 14) : `${done}/${total || '?'}`}
      </span>
    </span>
  );
}
