import { useEffect, useState } from 'react';

/**
 * Elapsed seconds for an active workout session.
 *
 * Extracted from WorkoutsPage so ActiveSessionBar can show the same running
 * clock without a second interval and a second copy of the arithmetic. Both
 * consumers derive from `session.startTime`, so they can never drift apart —
 * the value is recomputed from wall-clock time on every tick rather than
 * incremented, which also keeps it correct after the tab is backgrounded.
 *
 * @param {{startTime:number}|null} session
 * @param {boolean} paused  freeze the readout (the start time is untouched)
 */
export default function useSessionTimer(session, paused = false) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const startTime = session?.startTime ?? null;

  useEffect(() => {
    if (startTime == null) {
      setElapsedSec(0);
      return undefined;
    }
    const read = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    read();
    if (paused) return undefined;
    const id = window.setInterval(read, 1000);
    return () => window.clearInterval(id);
  }, [startTime, paused]);

  return elapsedSec;
}
