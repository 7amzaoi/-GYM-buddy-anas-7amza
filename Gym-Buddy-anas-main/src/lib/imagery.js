/**
 * Photo slots for the athletic-editorial identity.
 * Runtime twin of imagery.ts — keep the two in sync.
 *
 * The design leans on real gym photography (hero, plan cards, record rows,
 * profile banner). Rather than hardcode paths at each call site, every photo
 * position is a NAMED SLOT resolved here. A slot with no file resolves to
 * `null` and the UI falls back to a designed dark treatment (see `.m1-photo`
 * in _m1.css) — so the layout is never broken, just un-photographed.
 *
 * TO ADD REAL PHOTOGRAPHY: drop files into `public/img/` using the exact
 * filenames below and flip the matching `available` flag to true. Nothing else
 * changes. Recommended: dark, high-contrast, desaturated gym shots; 1600px wide
 * for banners, 800px square for tiles; JPEG ~80% quality.
 */
const SLOTS = {
  'hero-today':     { file: 'hero.jpeg',     available: true, alt: 'Athlete mid-lift' },
  'plan-strength':  { file: 'plan-strength.jpeg',  available: true, alt: 'Barbell rack' },
  'plan-cardio':    { file: 'plan-cardio.jpeg',    available: true, alt: 'Conditioning work' },
  'plan-custom':    { file: 'plan-custom.jpeg',    available: true, alt: 'Dumbbell rack' },
  'record-tile':    { file: 'record-tile.jpeg',    available: true, alt: 'Loaded barbell' },
  'profile-banner': { file: 'profile-banner.jpeg', available: true, alt: 'Gym floor' },
  avatar:           { file: 'avatar.jpeg',         available: false, alt: 'Profile photo' },

  /* Second and third takes per category. With one photo each, two strength
     plans on the same screen showed the identical picture. These widen the pool
     (see PLAN_SLOT_POOL in DashboardPage); until the files exist they resolve
     to null and the pool simply skips them, so nothing regresses. */
  'plan-strength-2': { file: 'plan-strength-2.jpeg', available: false, alt: 'Chalked hands on a bar' },
  'plan-strength-3': { file: 'plan-strength-3.jpeg', available: false, alt: 'Squat rack under low light' },
  'plan-cardio-2':   { file: 'plan-cardio-2.jpeg',   available: false, alt: 'Treadmill row at night' },
  'plan-fatloss':    { file: 'plan-fatloss.jpeg',    available: false, alt: 'Battle ropes mid-swing' },
  'plan-muscle':     { file: 'plan-muscle.jpeg',     available: false, alt: 'Cable machine and dumbbells' },
  'plan-custom-2':   { file: 'plan-custom-2.jpeg',   available: false, alt: 'Kettlebells on a rack' },
};

/** Resolved URL for a slot, or null when no photo has been supplied yet. */
export function photo(slot) {
  const d = SLOTS[slot];
  return d && d.available ? `/img/${d.file}` : null;
}

export function photoAlt(slot) {
  return SLOTS[slot]?.alt ?? '';
}

/** Every slot still awaiting a file — used by the design-status report. */
export function missingPhotos() {
  return Object.keys(SLOTS)
    .filter((k) => !SLOTS[k].available)
    .map((k) => `public/img/${SLOTS[k].file}`);
}
