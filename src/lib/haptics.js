/**
 * Haptics — a thin wrapper over the Vibration API. Runtime twin of haptics.ts;
 * keep the two in sync.
 *
 * Every call is a silent no-op when the device has no 'vibrate' support or the
 * user has switched haptics off. The enabled flag is read once from
 * localStorage at module load (key 'gymbuddy_haptics'; any value other than
 * '0'/'false' counts as on), and kept in sync by setHapticsEnabled.
 */
const KEY = 'gymbuddy_haptics';

function readEnabled() {
  try {
    const v = localStorage.getItem(KEY);
    return v !== '0' && v !== 'false';
  } catch {
    return true;
  }
}

let enabled = readEnabled();

export function hapticsEnabled() {
  return enabled;
}

export function setHapticsEnabled(on) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function fire(pattern) {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** Light confirmation — taps, selections, navigation. */
export function tap() {
  fire(10);
}

/** Positive multi-pulse — set completed, workout saved, new personal record. */
export function success() {
  fire([10, 40, 20]);
}

/** Attention — warnings and rejected input. */
export function warn() {
  fire([30, 30, 30]);
}
