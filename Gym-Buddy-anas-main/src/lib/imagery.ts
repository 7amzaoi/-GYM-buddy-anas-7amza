/**
 * Photo slots for the athletic-editorial identity.
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
export type PhotoSlot =
  | 'hero-today'
  | 'plan-strength'
  | 'plan-cardio'
  | 'plan-custom'
  | 'record-tile'
  | 'profile-banner'
  | 'avatar'
  | 'plan-strength-2'
  | 'plan-strength-3'
  | 'plan-cardio-2'
  | 'plan-fatloss'
  | 'plan-muscle'
  | 'plan-custom-2';

type SlotDef = { file: string; available: boolean; alt: string };

const SLOTS: Record<PhotoSlot, SlotDef> = {
  'hero-today':      { file: 'hero.jpeg',      available: true, alt: 'Athlete mid-lift' },
  'plan-strength':   { file: 'plan-strength.jpeg',   available: true, alt: 'Barbell rack' },
  'plan-cardio':     { file: 'plan-cardio.jpeg',     available: true, alt: 'Conditioning work' },
  'plan-custom':     { file: 'plan-custom.jpeg',     available: true, alt: 'Dumbbell rack' },
  'record-tile':     { file: 'record-tile.jpeg',     available: true, alt: 'Loaded barbell' },
  'profile-banner':  { file: 'profile-banner.jpeg',  available: true, alt: 'Gym floor' },
  avatar:            { file: 'avatar.jpeg',          available: false, alt: 'Profile photo' },

  /* Second and third takes per category. With one photo each, two strength
     plans on the same screen showed the identical picture; these widen the pool
     that PLAN_SLOT_POOL in DashboardPage picks from. */
  'plan-strength-2': { file: 'plan-strength-2.jpeg', available: true, alt: 'Chalked hands on a bar' },
  'plan-strength-3': { file: 'plan-strength-3.jpeg', available: true, alt: 'Squat rack under low light' },
  'plan-cardio-2':   { file: 'plan-cardio-2.jpeg',   available: true, alt: 'Treadmill row at night' },
  'plan-fatloss':    { file: 'plan-fatloss.jpeg',    available: true, alt: 'Battle ropes mid-swing' },
  'plan-muscle':     { file: 'plan-muscle.jpeg',     available: true, alt: 'Cable machine and dumbbells' },
  'plan-custom-2':   { file: 'plan-custom-2.jpeg',   available: true, alt: 'Kettlebells on a rack' },
};

/** Resolved URL for a slot, or null when no photo has been supplied yet. */
export function photo(slot: PhotoSlot): string | null {
  const d = SLOTS[slot];
  return d && d.available ? `/img/${d.file}` : null;
}

export function photoAlt(slot: PhotoSlot): string {
  return SLOTS[slot]?.alt ?? '';
}

/** Every slot still awaiting a file — used by the design-status report. */
export function missingPhotos(): string[] {
  return (Object.keys(SLOTS) as PhotoSlot[])
    .filter((k) => !SLOTS[k].available)
    .map((k) => `public/img/${SLOTS[k].file}`);
}
