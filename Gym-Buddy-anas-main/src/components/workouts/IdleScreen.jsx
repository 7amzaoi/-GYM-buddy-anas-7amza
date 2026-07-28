import { useEffect } from 'react';
import { icon } from '../../icons.jsx';
import { attachTilt } from '../../lib/motion.js';
import SmartBanner from '../SmartBanner.jsx';

/** Start-of-day view shown when there's no active workout session. */
export default function IdleScreen({
  rootRef,
  heroRef,
  navigateToPage,
  progress,
  recentAll,
  recentVisible,
  recentHidden,
  recentExpanded,
  setRecentExpanded,
  onStartEmpty,
}) {
  const thisWeek = progress.workoutsThisWeek || 0;
  const total = progress.totalWorkouts || 0;
  const streak = progress.streak || 0;

  // Hero card 3D tilt on cursor (auto-skipped on coarse pointers / reduced motion).
  useEffect(() => {
    if (!heroRef.current) return undefined;
    return attachTilt(heroRef.current, { max: 7, lerp: 0.16 });
  }, [heroRef]);

  return (
    <div className="wko" ref={rootRef}>
      <div className="wko-bg" aria-hidden="true">
        <span className="wko-bg-blob wko-bg-blob-1" />
        <span className="wko-bg-blob wko-bg-blob-2" />
        <span className="wko-bg-blob wko-bg-blob-3" />
        <span className="wko-bg-grid" />
      </div>

      <header className="wko-header" data-reveal>
        <span className="gx-eyebrow">{icon('activity', 13)} Train</span>
        <h1 className="wko-h1">Workouts</h1>
        <p className="gx-subtitle">Log a session in real-time. Pick exercises, track sets, finish strong.</p>
      </header>

      {/* Contextual nudge (streak risk, comeback, celebration…). Lives here
          rather than on Today: this is the screen where it's actionable, and it
          keeps the Today hero as the single call to action. */}
      <SmartBanner />

      <div className="wko-stats-strip" data-reveal>
        <div className="wko-stat">
          <span className="wko-stat-val">{thisWeek}</span>
          <span className="wko-stat-lbl">This week</span>
        </div>
        <span className="wko-stat-div" aria-hidden />
        <div className="wko-stat">
          <span className="wko-stat-val">{total}</span>
          <span className="wko-stat-lbl">Total workouts</span>
        </div>
        <span className="wko-stat-div" aria-hidden />
        <div className="wko-stat">
          <span className="wko-stat-val wko-accent">{streak}</span>
          <span className="wko-stat-lbl">Day streak</span>
        </div>
      </div>

      <div className="wko-start" data-reveal ref={heroRef}>
        <div className="wko-start-glow" aria-hidden />
        <div className="wko-start-body">
          <div className="wko-start-icon-wrap" aria-hidden>
            <span className="wko-start-ring wko-start-ring-1" />
            <span className="wko-start-ring wko-start-ring-2" />
            <div className="wko-start-icon">{icon('play', 28)}</div>
          </div>
          <h2 className="wko-start-title">Ready to lift?</h2>
          <p className="wko-start-desc">
            Start an empty workout and build it as you go — or use one of your saved plans.
          </p>
          <div className="wko-start-actions">
            <button type="button" className="gx-btn gx-btn-primary wko-cta-primary" onClick={onStartEmpty}>
              {icon('play', 16)} Start Empty Workout
            </button>
            <button type="button" className="gx-btn gx-btn-ghost" onClick={() => navigateToPage?.('planner')}>
              {icon('dumbbell', 15)} Use a Plan
            </button>
          </div>
        </div>
      </div>

      <section className="gx-card wko-recent" data-reveal>
        <div className="dash-card-head">
          <span className="gx-eyebrow">{icon('clock', 13)} Recent</span>
          <button type="button" className="dash-link" onClick={() => navigateToPage?.('progress')}>
            View all {icon('arrow', 12)}
          </button>
        </div>
        {recentAll.length === 0 ? (
          <div className="wko-empty-mini">
            <span className="wko-empty-icon">{icon('activity', 26)}</span>
            <p>No workouts yet — your first session starts the habit.</p>
          </div>
        ) : (
          <>
            <div className="wko-recent-list">
              {recentVisible.map((w) => {
                const name = (w.planName && w.planName.trim()) || 'Freestyle Workout';
                return (
                  <div key={w.id || name + w.date} className="wko-recent-row">
                    <span className="wko-recent-icon">{icon('activity', 16)}</span>
                    <div className="wko-recent-info">
                      <h4>{name}</h4>
                      <p>
                        {new Date(w.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' · '}
                        {w.duration ? `${w.duration} min` : 'No duration'}
                        {' · '}
                        {w.exercises} ex
                      </p>
                    </div>
                    <span className="gx-badge is-accent">
                      {icon('fire', 11)} {Math.round(w.calories || 0)} cal
                    </span>
                  </div>
                );
              })}
            </div>
            {recentHidden > 0 && (
              <button
                type="button"
                className="wko-recent-more"
                onClick={() => setRecentExpanded((v) => !v)}
                aria-expanded={recentExpanded}
              >
                <span>{recentExpanded ? 'Show less' : `Show ${recentHidden} more`}</span>
                <span className={`wko-recent-more-chev ${recentExpanded ? 'is-open' : ''}`} aria-hidden="true">
                  {icon('arrow', 13)}
                </span>
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
