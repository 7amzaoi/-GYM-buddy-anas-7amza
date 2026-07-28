/**
 * Personalization layer — accent theming + onboarding flag.
 * Used by the onboarding flow (Phase 2) and the customization
 * settings (Phase 8). Purely client-side; never touches auth/DB.
 */

/** Selectable accent colors. Each has a main hex + a darker companion
 *  for gradients, and pre-split rgb channels for rgba() composition. */
/** `deep` is the same hue darkened enough to be READ as text on a white
 *  surface (the neon `hex` values sit around 1.4:1 on white). Light mode maps
 *  --accent-ink to it; dark mode keeps the neon. */
export const ACCENTS = [
  { id: 'lime',   label: 'Neon Lime', hex: '#D4FF00', hex2: '#B8E600', deep: '#4F6100', rgb: '212, 255, 0' },
  { id: 'cyan',   label: 'Ice Cyan',  hex: '#22E0D6', hex2: '#15B8AF', deep: '#0A6660', rgb: '34, 224, 214' },
  { id: 'violet', label: 'Ultra',     hex: '#A78BFA', hex2: '#8B5CF6', deep: '#5B34C7', rgb: '167, 139, 250' },
  { id: 'ember',  label: 'Ember',     hex: '#FF8A3D', hex2: '#F0691E', deep: '#8F3D00', rgb: '255, 138, 61' },
  { id: 'punch',  label: 'Punch',     hex: '#FF5C8A', hex2: '#E63E70', deep: '#A11242', rgb: '255, 92, 138' },
];

export const THEMES = [
  { id: 'dark',  label: 'Dark' },
  { id: 'light', label: 'Light' },
];
const THEME_KEY = 'gymbuddy_theme';

const ACCENT_KEY = 'gymbuddy_accent';
const ONBOARD_KEY = 'gymbuddy_onboarded';

export function getStoredAccentId() {
  try {
    return localStorage.getItem(ACCENT_KEY) || 'lime';
  } catch {
    return 'lime';
  }
}

/** Apply an accent across the whole site by overriding CSS custom
 *  properties on :root. Every component reads --accent / --accent-rgb,
 *  so one call re-themes the entire app. */
export function applyAccent(id, { persist = true } = {}) {
  const a = ACCENTS.find((x) => x.id === id) || ACCENTS[0];
  const root = document.documentElement;
  root.style.setProperty('--accent', a.hex);
  root.style.setProperty('--accent-2', a.hex2);
  root.style.setProperty('--accent-rgb', a.rgb);
  root.style.setProperty('--accent-dim', `rgba(${a.rgb}, 0.15)`);
  root.style.setProperty('--accent-glow', `rgba(${a.rgb}, 0.3)`);
  root.style.setProperty('--accent-deep', a.deep);
  if (persist) {
    try {
      localStorage.setItem(ACCENT_KEY, a.id);
    } catch {
      /* storage unavailable — accent still applies for this session */
    }
  }
  return a;
}

/** Call once on app boot so a saved accent survives reloads. */
export function initAccent() {
  applyAccent(getStoredAccentId(), { persist: false });
}

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Flip the whole app between the dark and light token sets. */
export function applyTheme(id, { persist = true } = {}) {
  const theme = id === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }
  return theme;
}

/** Boot the saved theme. `.theme-booting` suppresses the colour transition so
 *  the first paint doesn't visibly cross-fade from the default. */
export function initTheme() {
  const root = document.documentElement;
  root.classList.add('theme-booting');
  applyTheme(getStoredTheme(), { persist: false });
  requestAnimationFrame(() => root.classList.remove('theme-booting'));
}

export function isOnboarded() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(ONBOARD_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Used by a "redo onboarding" action in settings later. */
export function resetOnboarded() {
  try {
    localStorage.removeItem(ONBOARD_KEY);
  } catch {
    /* ignore */
  }
}
