import { formatTime } from './helpers.js';

/** Floating rest-timer banner — only renders when `active` is true. */
export default function RestBanner({
  active, remaining, duration, onSkip, onBump, onChangeDuration,
}) {
  if (!active) return null;
  const pct = duration > 0 ? (remaining / duration) * 100 : 0;
  return (
    <div className="wko-rest" role="status" aria-live="polite">
      <div className="wko-rest-body">
        <div className="wko-rest-head">
          <span className="wko-rest-label">Rest</span>
          <button type="button" className="wko-rest-skip" onClick={onSkip}>Skip</button>
        </div>
        <div className="wko-rest-time">{formatTime(remaining)}</div>
        <div className="wko-rest-bar">
          <div className="wko-rest-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="wko-rest-controls">
          <button type="button" className="wko-rest-bump" onClick={() => onBump(-15)}>−15s</button>
          <span className="wko-rest-duration">
            Default <strong>{duration}s</strong>
            <button type="button" onClick={() => onChangeDuration(Math.max(15, duration - 15))} aria-label="Decrease default rest">−</button>
            <button type="button" onClick={() => onChangeDuration(Math.min(300, duration + 15))} aria-label="Increase default rest">+</button>
          </span>
          <button type="button" className="wko-rest-bump" onClick={() => onBump(15)}>+15s</button>
        </div>
      </div>
    </div>
  );
}
