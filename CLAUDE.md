# GymBuddy — working manual

Read this before touching anything. It encodes conventions that are easy to
break silently and expensive to find afterwards.

## Repo layout

The app lives at the repo root. Run every command from there:

```
<repo root>/                     ← git root, this file, package.json
├── .claude/settings.local.json  ← tracked (permission allowlist)
├── src/  public/  scripts/  supabase/
└── .artifacts/                  ← generated screenshots + design artifacts
```

```bash
npm install
```

> **Changed 2026-08-19.** Until then the app sat one level down, in a folder
> called `Gym-Buddy-anas-main/`, and this section told you to `cd` into it.
> That nesting was never a decision — it was an accident, and it cost real
> time before anyone questioned it.
>
> What happened: someone cloned the repo into `Gym-Buddy-anas-main/`, then ran
> `git init` in the **parent** directory and committed from there. Git skipped
> the inner `.git/` but tracked all 186 files beneath it as ordinary paths.
>
> That one action caused everything that looked mysterious afterwards:
> - **`main` and this branch had no common ancestor** — `git init` starts a new
>   history; a clone would have shared one. `git merge` refused outright.
> - **The two branches shared zero paths** — every file here sat one level
>   deeper than its counterpart on `main`.
> - **A live clone of `main@c19ac7d` was sitting at `Gym-Buddy-anas-main/.git`**,
>   reporting 114 phantom modifications to anything that walked up into it.
>
> Evidence, if you ever need to re-check the reasoning: this branch's root
> commit `ef8add3` is byte-identical to `main@992db87` in 62 of 63 files, one
> directory down; both are dated 2026-05-17 and both are titled "7amza edits".
>
> The flatten was a pure `git mv`, so `git log --follow <file>` traces any file
> straight through it. **Do not re-nest.** No tooling ever required it — there
> is no deploy config in this repo at all.

## Stack

React 18 · Vite 6 · React Router 6 (**HashRouter**) · Supabase · GSAP · Three.js
(`@react-three/fiber`, `drei`, `rapier`, `meshline`).

Plain CSS — **no Tailwind, no CSS-in-JS, no UI library.** Inter is the only face.

Entry: `src/main.jsx` → `src/App.jsx`. Routes: `src/routes.js` (`ROUTES` map,
`pathForPage`, `pageIdFromPath`). Nav items: `src/lib/navItems.js`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build — **must pass before any task is done** |
| `npm run lint` | ESLint — **must pass before any task is done** |
| `npm run typecheck` | `tsc --noEmit` over the `.ts` twins |
| `npm run check:mobile <route>` | Phone-viewport verification harness |

### The verification gate

`npm run check:mobile dashboard` runs the route in three device profiles
(iPhone SE 375×667, iPhone 14 390×844, Pixel 7 412×915) and reports PASS/FAIL for:
console cleanliness · horizontal overflow · **44×44px tap targets** · bottom-nav
safe-area clearance · body-text contrast. Screenshots land in `.artifacts/screens/`.
Exits 1 on any failure.

Flags: `--session` (seeds an active workout, for focus mode / session bar),
`--sheet` (opens a bottom sheet).

**Do not claim a UI change works without pasting this output.** "Should work" and
"looks correct" are not acceptable — measure computed values in a real browser
rather than reasoning about CSS. That method has caught every non-obvious bug in
this codebase so far.

## Non-negotiable rules

1. **No new dependencies without asking first.**
2. **Touch only the files the task lists.** If another must change, stop and say why.
3. No drive-by refactors. No reformatting files you aren't changing.
4. Reuse existing tokens and classes before writing new CSS.
5. Real data only — never invent a metric the Store doesn't expose. If a design
   implies data that doesn't exist, stop and ask.
6. `.env` / `.env.local` stay gitignored. Never commit real credentials.

## The JS/TS twin-file rule (easiest thing to break)

These modules exist as **both `.js` and `.ts`**. Runtime imports use the `.js`;
the `.ts` exists for `npm run typecheck`. **Change one → mirror the other.**

`src/store` · `src/lib/`: `asyncTimeout`, `authBootstrap`, `domTargets`,
`haptics`, `imagery`, `interactions`, `motion`, `navItems`, `personalization`,
`supabaseClient`

TypeScript-only, no twin: `src/lib/gamification.ts`, `src/lib/notifications.ts`.

## State — `src/store.js`

A pub/sub singleton, **not Redux**. `Store.get(key)` / `Store.set(key, value)` /
`Store.update(key, fn)` / `Store.subscribe(fn)`. Components re-render via a
`useReducer` bump subscribed in `App.jsx`.

Derived stats are pure functions exported alongside it — use them, don't
recompute: `deriveStatsFromHistory`, `deriveWeeklyPerformanceFromHistory`,
`deriveCaloriesByDay`, `deriveStrengthIndex`, `buildPersonalRecordsMap`.

Session lifecycle (`startSession`, `startFreestyleSession`, `completeSession`,
`discardSession`, `captureAutoRecordsFromSession`) is load-bearing and
well-tested by hand. Treat changes there as high-risk.

## CSS architecture

`src/styles/index.css` imports 38 partials **in cascade order**. The order is
architecture, not housekeeping:

```
1. _foundation.css     design tokens, base elements
2. _theme.css          semantic tokens + light theme (must precede components)
3. legacy page styles
4. gx-* design system, modals, bottom sheet
5. marketing + per-page bundles
6. cross-cutting (smart banner, error boundary)
7. M1 identity layer   ← MUST BE LAST
     _m1.css · _m1-screens.css · _m1-system.css
     _daily-report.css · _glass.css
     _theme-light.css  ← absolute last: patches legacy sheets that bake dark hexes
```

M1 re-dresses primitives defined in every section above it. Import it earlier and
later sheets win on equal specificity and the restyle **silently doesn't apply**.

New CSS goes in `src/styles/_<name>.css`, `@import`ed into the correct slot.
Page selectors stay prefixed: `.wko-*` `.prog-*` `.gx-*` `.m1-*` `.dr-*` `.asb-*`.

### Tokens — `_foundation.css`

`--space-1..16` (4 8 12 16 20 24 32 40 48 64) · `--radius-2xs..xl`, `--radius-pill`
`--text-xs..4xl` · `--elev-1..4` · `--dur-fast|base|slow` ·
`--ease-out|in|spring|std` · `--z-base|raised|sticky|nav|overlay|modal|toast` ·
`--glass-*`

**Never hardcode a spacing, radius, duration or colour that has a token.**

### Semantic tokens — `_theme.css`

`--surface-0..3` · `--text-1..3` · `--hairline` · `--on-accent` · `--accent-ink` ·
`--on-photo` / `--on-photo-dim` · `--scrim-0..3` · `--glass-*`

`:root[data-theme='light']` overrides these. A legacy bridge maps the old names
(`--bg-main`, `--text-primary`, `--border`, …) onto the semantic layer — prefer
the semantic names in new code.

### Accent + theme

`--accent` / `--accent-rgb` are **user-configurable at runtime**
(`src/lib/personalization.js`: 5 accents — lime, cyan, violet, ember, punch).
Never hardcode a colour that should come from the accent.

Each accent carries a `deep` variant used as `--accent-ink` in light mode, where
the bright accent fails contrast on white. `applyAccent` / `applyTheme` /
`initAccent` / `initTheme` set the root attributes.

### Two CSS traps this codebase has already hit

**1. An undefined custom property inside a shorthand invalidates the whole
declaration.** `padding: var(--m1-gutter) var(--space-4)` drops *entirely* — not
partially — if `--m1-gutter` isn't defined in that scope. Give every custom
property a `:root` default. This cost hours twice.

**2. In photo contexts, re-scope tokens instead of fighting specificity.**
`.m1-photo`, `.plan-card`, `.prof-hero`, `.m1-topbar` etc. locally redefine
`--text-1: var(--on-photo)` and `--accent-ink: var(--accent)` so everything
inside stays legible in both themes. Adding a new photo surface? Add it to that
scope list — don't write `!important`.

## Navigation, motion, haptics

`navigateToPage(pageId)` in `App.jsx` is the single entry point (via
`NavigateContext`). It wraps navigation in `document.startViewTransition` with
`flushSync`, sets `documentElement.dataset.nav` to `forward` / `back` from the
`NAV_ITEMS` order, and drives the CSS slides in `_app-shell.css`.
`view-transition-name` is on the **main content region only**, so the tab bar and
header read as fixed furniture. Fully disabled under `prefers-reduced-motion`.

`src/lib/haptics.js` — `tap()` 10ms · `success()` [10,40,20] · `warn()` [30,30,30].
No-ops unless `'vibrate' in navigator`; module-level enable flag from
`localStorage['gymbuddy_haptics']`. Wired to tab press, set completion, PR
recorded, session finished. **Don't add haptics anywhere else without being asked.**

**No gesture library. No animation beyond what a task explicitly asks for.**

## Performance decisions already made — don't undo them

- Every page in `App.jsx` is `React.lazy` + `Suspense`. Two boundaries: one
  **inside** `AuthenticatedChrome` around `<Outlet>` (sidebar/tab bar stay
  mounted), one around the public routes. Fallback is `PageSkeleton` — pure CSS,
  no images, no JS.
- `MembershipCard` (WebGL, ~2.4 MB of three/fiber/drei/rapier/meshline) is lazy
  and mounts only when in view. Under 769px, `prefers-reduced-motion`, or
  `hardwareConcurrency <= 4` it renders `StaticMembershipCard` instead.
- `LiquidEther` (1167 lines, three-based fluid sim) has exactly one usage:
  `DownloadPage.jsx`. That page is lazy-loaded, so the sim stays out of the
  app-shell chunk. Keep it that way — verify before adding a second usage.

These are **load-time decisions, not feature removals.** Nothing here is deleted.

## Environment

Not in the repo — create it per machine:

```bash
cp .env.example .env.local
```

`VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY`

Both missing → `supabaseClient` is `null`, `isSupabaseConfigured()` is `false`,
and the app runs local-only on localStorage. It does **not** crash — auth, sync
and cloud records are simply inert.

## Branches

Active work: **`feat/mobile-redesign-m1`**. Remote `main` is an older, unrelated
history — a plain `git clone` lands on the old code. After cloning:

```bash
git checkout feat/mobile-redesign-m1
```

Work on one machine at a time. `git pull` **before** starting, push when done.
