import { useEffect } from 'react';

/**
 * Hold a screen Wake Lock while `active` is true, so the phone doesn't dim
 * mid-set with the workout on screen.
 *
 * Fully guarded: unsupported browsers (all of iOS before 16.4, and any
 * non-secure context) simply get a no-op. The lock is also dropped whenever the
 * page is hidden — the browser revokes it on backgrounding anyway, so it is
 * re-requested on the way back rather than assumed to still be held.
 */
export default function useWakeLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;

    let sentinel = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        // The browser can revoke it on its own (low battery, tab switch).
        sentinel.addEventListener?.('release', () => { sentinel = null; });
      } catch {
        /* denied or unsupported — the session just runs without it */
      }
    };

    const release = () => {
      const s = sentinel;
      sentinel = null;
      s?.release?.().catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
      else release();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [active]);
}
