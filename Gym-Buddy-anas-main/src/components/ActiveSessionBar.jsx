import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { Store } from '../store.js';
import { ROUTES } from '../routes.js';
import { icon } from '../icons.jsx';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { getExerciseById } from '../data.js';
import { formatTime } from './workouts/helpers.js';
import useSessionTimer from '../hooks/useSessionTimer.js';
import * as haptics from '../lib/haptics.js';

/**
 * ACTIVE SESSION BAR — the mini-player.
 *
 * Shown only when a workout is running AND the user has navigated away from
 * Workouts. Docks directly above the tab bar and taps back into the session,
 * so a session can never be "lost" behind navigation.
 *
 * The clock comes from the same useSessionTimer hook WorkoutsPage uses — both
 * derive from session.startTime, so there is no second interval and no chance
 * of the two readouts disagreeing.
 */
export default function ActiveSessionBar() {
  const navigateToPage = useContext(NavigateContext);
  const location = useLocation();
  const session = Store.get('activeSession');

  // Hook order must stay stable, so it runs before any early return.
  const elapsedSec = useSessionTimer(session);

  if (!session) return null;
  if (location.pathname === ROUTES.workouts) return null;

  // Name the exercise being worked on, not just the session.
  const exercises = session.exercises || [];
  let label = session.planName || 'Freestyle Workout';
  let sub = null;
  const current = exercises.find((ex) => (ex.sets || []).some((s) => !s.done)) || exercises[0];
  if (current) {
    const data = getExerciseById(current.id);
    if (data) {
      const sets = current.sets || [];
      label = data.name;
      sub = `Set ${Math.min(sets.filter((s) => s.done).length + 1, sets.length)} of ${sets.length}`;
    }
  }

  return (
    <button
      type="button"
      className="asb"
      onClick={() => { haptics.tap(); navigateToPage?.('workouts'); }}
      aria-label={`Return to workout: ${label}`}
    >
      <span className="asb-pulse" aria-hidden="true" />
      <span className="asb-body">
        <span className="asb-name">{label}</span>
        {sub && <span className="asb-sub">{sub}</span>}
      </span>
      <span className="asb-timer">{formatTime(elapsedSec)}</span>
      <span className="asb-chev" aria-hidden="true">{icon('chevron', 16)}</span>
    </button>
  );
}
