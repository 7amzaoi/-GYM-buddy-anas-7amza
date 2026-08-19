# Photo slots — athletic-editorial (M1) identity

Drop the six files below into this folder using these EXACT filenames, then flip
the matching `available` flag to `true` in **both** `src/lib/imagery.js` and
`src/lib/imagery.ts` (they are twins — keep them in sync). No other change is
needed; the UI picks the images up automatically.

| filename             | ratio        | size        | used by                                  |
|----------------------|--------------|-------------|------------------------------------------|
| `hero.jpeg`     | 4:3 landscape| 1600 × 1200 | Today — full-bleed hero                   |
| `plan-strength.jpeg`  | 16:9         | 1600 × 900  | Plans — strength cards                    |
| `plan-cardio.jpeg`    | 16:9         | 1600 × 900  | Plans — cardio cards                      |
| `plan-custom.jpeg`    | 16:9         | 1600 × 900  | Plans — custom cards                      |
| `record-tile.jpeg`    | 1:1 square   | 800 × 800   | Today recent-session rail + Records rows  |
| `profile-banner.jpeg` | 3:2          | 1600 × 1067 | Profile — banner                          |

## Art direction

Dark, high-contrast, desaturated gym photography. Iron, chalk, hard side light,
deep black shadows.

## Grading — already applied at source

The supplied photography is already graded dark and desaturated, so the app now
only touches it up:

```css
filter: saturate(0.92) contrast(1.03);
```

Legibility of overlaid text comes from a scrim gradient, not from darkening the
image. If you ever swap in a **brighter, un-graded** photo, darken it at source
to match — don't raise the filter, or the already-dark shots go muddy.

Format: JPEG, quality ~80%.
