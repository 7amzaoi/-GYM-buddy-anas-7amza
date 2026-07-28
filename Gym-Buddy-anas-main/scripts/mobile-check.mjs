/**
 * mobile-check.mjs — phone-viewport verification harness for GymBuddy.
 *
 * Usage:
 *   node scripts/mobile-check.mjs dashboard
 *   node scripts/mobile-check.mjs workouts --session
 *
 * Runs the app in three mobile device profiles and reports PASS/FAIL for
 * console cleanliness, horizontal overflow, tap-target size, bottom-nav
 * safe-area clearance, and body-text contrast. Full-page screenshots land in
 * .artifacts/screens/<route>-<profile>.png. Exits 1 if any check fails.
 *
 * Chromium only (per project constraint) — no webkit/firefox, no test runner.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS = path.join(ROOT, '.artifacts', 'screens');
const INSET = 34; // simulated home-indicator inset (px)

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const PROFILES = [
  { name: 'iPhone SE', slug: 'iphone-se', viewport: { width: 375, height: 667 }, ua: IOS_UA },
  { name: 'iPhone 14', slug: 'iphone-14', viewport: { width: 390, height: 844 }, ua: IOS_UA },
  { name: 'Pixel 7', slug: 'pixel-7', viewport: { width: 412, height: 915 }, ua: ANDROID_UA },
];

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const route = argv.find((a) => !a.startsWith('--'));
const flags = new Set(argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2)));
if (!route) {
  console.error('Usage: node scripts/mobile-check.mjs <route> [--session]');
  process.exit(1);
}

// ---------------------------------------------------------------- seed
// Give the app a logged-in local user (routes are auth-gated) and mark
// onboarding complete so the overlay doesn't cover the screen.
function seedData() {
  const user = {
    source: 'local',
    email: 'harness@local.test',
    name: 'Harness',
    joinDate: '2026-01-01T00:00:00.000Z',
    goal: 'muscle gain',
    weight_kg: 75,
  };
  const state = { user, _stateVersion: 2 };
  if (flags.has('session')) {
    state.activeSession = {
      startTime: Date.now(),
      planName: 'Freestyle Workout',
      exercises: [
        { id: 's1', sets: [{ weight: '40', reps: '10', done: true }, { weight: '40', reps: '10', done: false }] },
        { id: 's2', sets: [{ weight: '', reps: '', done: false }] },
      ],
    };
  }
  return { onboarded: '1', state };
}

// ---------------------------------------------------------------- server
async function isViteUp(port) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 600);
    const res = await fetch(`http://localhost:${port}/`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const body = await res.text();
    return body.includes('id="app"') || body.includes('/@vite/client') || body.includes('/src/main.jsx');
  } catch {
    return false;
  }
}

async function ensureServer() {
  for (const port of [5173, 5174, 5175, 5176, 5177, 5178, 4173, 3000]) {
    if (await isViteUp(port)) return { base: `http://localhost:${port}`, started: false, proc: null };
  }
  // Start vite directly through node (no shell) so we get a killable pid.
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const proc = spawn(process.execPath, [viteBin, '--host', 'localhost'], { cwd: ROOT });
  const port = await new Promise((resolve, reject) => {
    let buf = '';
    const to = setTimeout(() => {
      proc.kill(); // don't leak the child if we never parsed a port
      reject(new Error('vite did not start within 30s'));
    }, 30000);
    const onData = (d) => {
      // Vite colours the URL, inserting ANSI escapes between "localhost:" and
      // the port (localhost:\x1b[1m5173\x1b[22m/). Strip them before matching.
      buf += d.toString().replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
      const m = buf.match(/localhost:(\d+)/);
      if (m) {
        clearTimeout(to);
        proc.stdout.off('data', onData);
        resolve(Number(m[1]));
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', (c) => reject(new Error(`vite exited early (code ${c})`)));
  });
  // Give it a beat to be fully ready.
  for (let i = 0; i < 20; i++) {
    if (await isViteUp(port)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return { base: `http://localhost:${port}`, started: true, proc };
}

function stopServer(server) {
  if (!server?.started || !server.proc) return;
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${server.proc.pid} /T /F`, { stdio: 'ignore' });
    else server.proc.kill('SIGTERM');
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- in-page checks
// One serialisable function evaluated in the browser; returns raw measurements.
function pageChecks() {
  const out = {};

  // ---- overflow ----
  const scroller = document.scrollingElement || document.documentElement;
  out.overflow = { scrollWidth: scroller.scrollWidth, innerWidth: window.innerWidth };

  const visible = (el, cs) =>
    cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0;
  // On-screen = intersects the viewport box. Excludes off-canvas chrome such
  // as the mobile-hidden sidebar (translateX(-100%)), which isn't tappable.
  const onScreen = (r) =>
    r.width > 0 && r.height > 0 && r.left < window.innerWidth && r.right > 0 && r.top < window.innerHeight && r.bottom > 0;

  // ---- tap targets ----
  const tapEls = [...document.querySelectorAll('button, a, [role="tab"]')];
  const tapBad = [];
  for (const el of tapEls) {
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    const r = el.getBoundingClientRect();
    if (!onScreen(r)) continue;
    if (r.width < 44 || r.height < 44) {
      tapBad.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 24),
        w: Math.round(r.width),
        h: Math.round(r.height),
        text: (el.textContent || '').trim().slice(0, 16),
      });
    }
  }
  out.tap = { total: tapEls.length, bad: tapBad.slice(0, 8), badCount: tapBad.length };

  // ---- contrast (body text only) ----
  const parseRGB = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const L1 = lum(a);
    const L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };
  // Effective opaque background behind the text: alpha-composite each
  // semi-transparent background-color layer over its ancestors, ending on the
  // page background. Without this, glass/accent-dim surfaces read as opaque
  // white/lime and produce bogus ~1:1 ratios.
  const resolveBg = (el) => {
    let node = el;
    const layers = [];
    while (node && node.nodeType === 1) {
      const st = getComputedStyle(node);
      // A gradient/image paints behind the text and can't be read from
      // computed style — bail so we don't emit a bogus dark-on-dark ratio.
      if (st.backgroundImage && st.backgroundImage !== 'none') return null;
      const c = parseRGB(st.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
      node = node.parentElement;
    }
    let base = { r: 11, g: 11, b: 11 }; // --bg-main #0B0B0B
    for (let i = layers.length - 1; i >= 0; i--) {
      const c = layers[i];
      base = {
        r: c.r * c.a + base.r * (1 - c.a),
        g: c.g * c.a + base.g * (1 - c.a),
        b: c.b * c.a + base.b * (1 - c.a),
      };
    }
    return { r: base.r, g: base.g, b: base.b, a: 1 };
  };
  const contrastBad = [];
  let contrastChecked = 0;
  for (const el of document.querySelectorAll('body *')) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!hasText) continue;
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    const r = el.getBoundingClientRect();
    if (!onScreen(r)) continue;
    // Skip gradient/clipped text — its painted colour can't be read from `color`.
    const clip = cs.webkitBackgroundClip || cs.backgroundClip || '';
    if (clip.includes('text')) continue;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
    if (isLarge) continue; // spec: body text
    const fg = parseRGB(cs.color);
    if (!fg || fg.a === 0) continue; // fully transparent text = not readable signal
    const bg = resolveBg(el); // text sits on the element's own background, if any
    if (!bg) continue; // unreadable (gradient/image behind the text)
    let f = fg;
    if (fg.a < 1) {
      f = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    }
    const cr = ratio(f, bg);
    contrastChecked++;
    if (cr < 4.5 - 0.05) {
      contrastBad.push({
        text: (el.textContent || '').trim().slice(0, 24),
        ratio: Math.round(cr * 100) / 100,
        size: Math.round(size),
        fg: cs.color,
      });
    }
  }
  out.contrast = { checked: contrastChecked, bad: contrastBad.slice(0, 8), badCount: contrastBad.length };

  return out;
}

// Safe-area is measured after injecting the simulated inset token.
function safeAreaCheck(inset) {
  const s = document.createElement('style');
  s.textContent = `:root{--safe-top:${inset}px !important;--safe-bottom:${inset}px !important;--safe-left:${inset}px !important;--safe-right:${inset}px !important;}`;
  document.head.appendChild(s);
  /* Normally the tab bar is the bottom-most chrome, so its clearance is what
     must beat the home indicator. In full-screen focus mode the bar is
     deliberately translated OFF-SCREEN, and the bottom-most thing becomes the
     primary action inside the overlay — measure that instead, or the check
     reports a huge negative clearance for a layout that is actually correct. */
  const overlay = document.querySelector('.wko-focus');
  const nav = overlay
    ? (overlay.querySelector('.wko-focus-cta') || overlay)
    : document.querySelector('.mobile-nav');
  if (!nav) return { found: false };
  const cs = getComputedStyle(nav);
  if (cs.display === 'none') return { found: false, hidden: true };
  const r = nav.getBoundingClientRect();
  if (overlay) {
    /* The overlay's own bottom padding is the reserved inset. */
    const oPad = parseFloat(getComputedStyle(overlay).paddingBottom) || 0;
    const below = window.innerHeight - r.bottom;
    return {
      found: true, measured: 'wko-focus-cta',
      innerHeight: window.innerHeight,
      navBottom: Math.round(r.bottom),
      belowNav: Math.round(below),
      padBottom: Math.round(oPad),
      clearance: Math.round(below),
    };
  }
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const belowNav = window.innerHeight - r.bottom;
  return {
    found: true,
    innerHeight: window.innerHeight,
    navBottom: Math.round(r.bottom),
    belowNav: Math.round(belowNav),
    padBottom: Math.round(padBottom),
    clearance: Math.round(belowNav + padBottom),
  };
}

// ---------------------------------------------------------------- verdicts
function evaluate(raw, console_, safe) {
  const R = {};

  const jsErr = console_.jsErrors.length;
  const badResp = console_.badResponses.length;
  const rej = console_.rejections.length;
  R.console = {
    pass: jsErr + badResp + rej === 0,
    reason:
      jsErr + badResp + rej === 0
        ? 'clean'
        : `${jsErr} err, ${badResp} 4xx/5xx, ${rej} rejection` +
          (console_.jsErrors[0] ? ` — ${console_.jsErrors[0].slice(0, 60)}` : '') +
          (console_.badResponses[0] ? ` — ${console_.badResponses[0].slice(0, 60)}` : ''),
  };

  const over = raw.overflow.scrollWidth - raw.overflow.innerWidth;
  R.overflow = {
    pass: over <= 1,
    reason: over <= 1 ? `${raw.overflow.scrollWidth}<=${raw.overflow.innerWidth}` : `+${over}px (scrollW ${raw.overflow.scrollWidth} > ${raw.overflow.innerWidth})`,
  };

  R.tap = {
    pass: raw.tap.badCount === 0,
    reason:
      raw.tap.badCount === 0
        ? `${raw.tap.total} ok`
        : `${raw.tap.badCount}/${raw.tap.total} <44px e.g. ${raw.tap.bad
            .slice(0, 3)
            .map((b) => `${b.tag}.${b.cls || '?'}(${b.w}x${b.h})`)
            .join(', ')}`,
  };

  if (!safe.found) {
    R.safe = { pass: false, reason: safe.hidden ? '.mobile-nav display:none' : '.mobile-nav not found' };
  } else {
    R.safe = {
      pass: safe.clearance >= INSET,
      reason: `clearance ${safe.clearance}px (belowNav ${safe.belowNav} + pad ${safe.padBottom}) vs ${INSET}px indicator`,
    };
  }

  R.contrast = {
    pass: raw.contrast.badCount === 0,
    reason:
      raw.contrast.badCount === 0
        ? `${raw.contrast.checked} ok`
        : `${raw.contrast.badCount} low e.g. ${raw.contrast.bad
            .slice(0, 3)
            .map((b) => `"${b.text}"(${b.ratio})`)
            .join(', ')}`,
  };

  return R;
}

// ---------------------------------------------------------------- run
async function runProfile(browser, base, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: profile.ua,
  });
  const data = seedData();
  await context.addInitScript((d) => {
    try {
      localStorage.setItem('gymbuddy_onboarded', d.onboarded);
      localStorage.setItem('gymbuddy_state', JSON.stringify(d.state));
    } catch {
      /* ignore */
    }
    window.__rejections = [];
    window.addEventListener('unhandledrejection', (e) => window.__rejections.push(String(e.reason)));
  }, data);

  const page = await context.newPage();
  const isApp = (u) => u && u.startsWith(base);
  const console_ = { jsErrors: [], badResponses: [], rejections: [] };
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url || '';
    if (url && !isApp(url)) return; // ignore external resource noise (fonts/CDN)
    console_.jsErrors.push(m.text());
  });
  page.on('pageerror', (e) => console_.jsErrors.push(String(e)));
  page.on('response', (r) => {
    if (r.status() >= 400 && isApp(r.url())) console_.badResponses.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    if (isApp(r.url())) console_.badResponses.push(`failed ${r.url()}`);
  });

  let mainFound = true;
  try {
    await page.goto(`${base}/#/${route}`, { waitUntil: 'commit' });
    await page.waitForSelector('main.main-content', { timeout: 15000 });
    await page.waitForTimeout(500); // let reveal/render settle
  } catch {
    mainFound = false;
  }

  console_.rejections = await page.evaluate(() => window.__rejections || []).catch(() => []);
  const raw = await page.evaluate(pageChecks, INSET).catch(() => null);
  const safe = await page.evaluate(safeAreaCheck, INSET).catch(() => ({ found: false }));

  mkdirSync(SCREENS, { recursive: true });
  const shot = path.join(SCREENS, `${route}-${profile.slug}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

  await context.close();

  if (!mainFound || !raw) {
    return {
      profile,
      shot,
      results: {
        console: { pass: false, reason: 'route main element not found' },
        overflow: { pass: false, reason: 'not measured' },
        tap: { pass: false, reason: 'not measured' },
        safe: { pass: false, reason: safe.found ? 'measured' : '.mobile-nav not found' },
        contrast: { pass: false, reason: 'not measured' },
      },
    };
  }
  return { profile, shot, results: evaluate(raw, console_, safe) };
}

function printTable(rows) {
  const checks = ['console', 'overflow', 'tap', 'safe', 'contrast'];
  const mark = (p) => (p ? 'PASS' : 'FAIL');
  const colW = 11;
  const head = 'profile'.padEnd(12) + checks.map((c) => c.padEnd(colW)).join('');
  console.log('\n' + head);
  console.log('-'.repeat(head.length));
  for (const row of rows) {
    const line = row.profile.name.padEnd(12) + checks.map((c) => mark(row.results[c].pass).padEnd(colW)).join('');
    console.log(line);
  }
  console.log('');
  // Reasons for failures only.
  for (const row of rows) {
    const fails = checks.filter((c) => !row.results[c].pass);
    if (!fails.length) continue;
    console.log(`${row.profile.name}:`);
    for (const c of fails) console.log(`  ✗ ${c.padEnd(9)} ${row.results[c].reason}`);
  }
}

// Slow pointer drag so velocity stays low (a fast flick would close early).
async function slowDrag(page, x, y, dyTotal, steps, stepDelay) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x, y + (dyTotal * i) / steps);
    await page.waitForTimeout(stepDelay);
  }
  await page.mouse.up();
}

// --sheet: open the exercise picker BottomSheet, drag 20% (spring back),
// drag 50% (close), and assert focus returns to the trigger + no bg scroll.
async function runSheetTest(browser, base) {
  const profile = PROFILES.find((p) => p.slug === 'iphone-14');
  const context = await browser.newContext({
    viewport: profile.viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: profile.ua,
  });
  const state = {
    user: { source: 'local', email: 'harness@local.test', name: 'Harness', joinDate: '2026-01-01T00:00:00.000Z', goal: 'muscle gain', weight_kg: 75 },
    _stateVersion: 2,
    activeSession: {
      startTime: Date.now(), planName: 'Freestyle Workout',
      exercises: [{ id: 's1', sets: [{ weight: '40', reps: '10', done: true }, { weight: '40', reps: '10', done: false }] }],
    },
  };
  await context.addInitScript((st) => {
    try {
      localStorage.setItem('gymbuddy_onboarded', '1');
      localStorage.setItem('gymbuddy_state', JSON.stringify(st));
    } catch { /* ignore */ }
  }, state);

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const u = m.location()?.url || '';
    if (!u || u.startsWith(base)) errors.push(m.text());
  });

  await page.goto(`${base}/#/workouts`, { waitUntil: 'commit' });
  await page.waitForSelector('main.main-content', { timeout: 15000 });
  await page.waitForSelector('.wko-add-ex', { timeout: 10000 });

  const o = {};
  // Scroll the page a bit so "background didn't move" is a real assertion.
  await page.evaluate(() => document.querySelector('.main-content')?.scrollTo(0, 150));
  await page.waitForTimeout(150);
  o.scrollYBefore = await page.evaluate(() => window.scrollY);
  o.mainScrollBefore = await page.evaluate(() => document.querySelector('.main-content')?.scrollTop ?? 0);

  // Mark + focus the trigger, then open the picker (evaluate-click avoids the
  // "element not stable" wait from the animated workout background).
  await page.evaluate(() => {
    const b = document.querySelector('.wko-add-ex');
    b.setAttribute('data-trigger', '1');
    b.focus();
    b.click();
  });
  await page.waitForSelector('dialog.sheet[open]', { timeout: 5000 });
  await page.waitForTimeout(450);
  o.opened = await page.evaluate(() => !!document.querySelector('dialog.sheet[open]'));
  o.lockedWhileOpen = await page.evaluate(() => getComputedStyle(document.querySelector('.main-content')).overflow === 'hidden');

  const geo = () => page.evaluate(() => {
    const g = document.querySelector('.sheet__grabber').getBoundingClientRect();
    const p = document.querySelector('.sheet__panel').getBoundingClientRect();
    return { gx: g.left + g.width / 2, gy: g.top + g.height / 2, height: p.height };
  });

  // Drag down 20% slowly -> should spring back (stays open).
  let g = await geo();
  await slowDrag(page, g.gx, g.gy, g.height * 0.2, 8, 55);
  await page.waitForTimeout(450);
  o.stillOpenAfter20 = await page.evaluate(() => !!document.querySelector('dialog.sheet[open]'));

  mkdirSync(SCREENS, { recursive: true });
  await page.screenshot({ path: path.join(SCREENS, 'sheet-workouts.png') }).catch(() => {});

  // Drag down 50% -> should close.
  g = await geo();
  await slowDrag(page, g.gx, g.gy, g.height * 0.5, 6, 45);
  await page.waitForTimeout(650);
  o.closedAfter50 = await page.evaluate(() => !document.querySelector('dialog.sheet[open]'));

  o.focusReturned = await page.evaluate(() => document.activeElement?.getAttribute('data-trigger') === '1');
  o.scrollYAfter = await page.evaluate(() => window.scrollY);
  o.mainScrollAfter = await page.evaluate(() => document.querySelector('.main-content')?.scrollTop ?? 0);
  o.restored = await page.evaluate(() => getComputedStyle(document.querySelector('.main-content')).overflow !== 'hidden');
  o.errors = errors;

  await context.close();
  return o;
}


// --session: full-screen focus mode + the ActiveSessionBar mini-player.
// Asserts the tab bar leaves the viewport (without unmounting), that navigating
// away surfaces the session bar with a >=44px target, and that tapping it
// returns to the SAME exercise index rather than a reset session.
async function runSessionTest(browser, base) {
  const profile = PROFILES.find((p) => p.slug === 'iphone-14');
  const context = await browser.newContext({
    viewport: profile.viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: profile.ua,
  });
  const state = {
    user: { source: 'local', email: 'h@local.test', name: 'Harness',
            joinDate: '2026-01-01T00:00:00.000Z', goal: 'muscle gain', weight_kg: 75 },
    _stateVersion: 2,
    activeSession: {
      startTime: Date.now() - 90000, planName: 'Push Day A', planId: null, calories: 0,
      exercises: [
        // First exercise fully done, so the focus target is exercise index 1.
        { id: 's1', sets: [{ weight: '60', reps: '8', done: true }] },
        { id: 's2', sets: [{ weight: '80', reps: '5', done: false }] },
      ],
    },
  };
  await context.addInitScript((st) => {
    try {
      localStorage.setItem('gymbuddy_onboarded', '1');
      localStorage.setItem('gymbuddy_state', JSON.stringify(st));
    } catch { /* ignore */ }
  }, state);

  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const out = { steps: [] };
  const step = (name, pass, detail) => out.steps.push({ name, pass, detail });

  await page.goto(`${base}/#/workouts`, { waitUntil: 'commit' });
  await page.waitForSelector('.wko-focus', { timeout: 15000 });
  await page.waitForTimeout(700);

  // 1. focus mode is showing the right exercise
  const focusName = await page.$eval('.wko-focus-name', (el) => el.textContent.trim());
  step('focus mode on the current exercise', focusName.toLowerCase() === 'squat', `showing "${focusName}"`);

  // 2. tab bar translated OFF-SCREEN but still mounted
  const nav = await page.evaluate(() => {
    const el = document.querySelector('.mobile-nav');
    if (!el) return { mounted: false };
    const r = el.getBoundingClientRect();
    return { mounted: true, top: Math.round(r.top), vh: window.innerHeight,
             offscreen: r.top >= window.innerHeight - 1 };
  });
  step('tab bar still mounted', nav.mounted === true, 'not unmounted');
  step('tab bar off-screen', nav.offscreen === true, `top ${nav.top} >= viewport ${nav.vh}`);

  // 3. navigate away -> session bar appears, target >= 44px
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.mnav-tab')].find((x) => /today/i.test(x.textContent));
    b && b.click();
  });
  // The tab bar is off-screen, so navigate via the hash instead.
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForSelector('.asb', { timeout: 8000 });
  await page.waitForTimeout(600);
  const bar = await page.evaluate(() => {
    const el = document.querySelector('.asb');
    const r = el.getBoundingClientRect();
    return { visible: r.width > 0 && r.height > 0 && r.bottom <= window.innerHeight + 1,
             w: Math.round(r.width), h: Math.round(r.height),
             name: el.querySelector('.asb-name')?.textContent.trim() };
  });
  step('session bar visible off /workouts', bar.visible === true, `"${bar.name}"`);
  step('session bar target >= 44px', bar.h >= 44 && bar.w >= 44, `${bar.w}x${bar.h}`);

  // 4. tap it -> back on the SAME exercise
  await page.evaluate(() => document.querySelector('.asb').click());
  await page.waitForSelector('.wko-focus', { timeout: 8000 });
  await page.waitForTimeout(600);
  const backName = await page.$eval('.wko-focus-name', (el) => el.textContent.trim());
  const hash = await page.evaluate(() => location.hash);
  step('tap returns to the same exercise', backName === focusName, `${hash} — "${backName}"`);

  step('no console errors', errors.length === 0, errors[0] || '');
  await page.screenshot({ path: path.join(SCREENS, "session-focus.png") }).catch(() => {});
  await context.close();
  return out;
}

function reportSession(o) {
  console.log('');
  let ok = true;
  for (const s of o.steps) {
    ok = ok && s.pass;
    console.log(`  ${s.pass ? 'PASS' : 'FAIL'}  ${s.name.padEnd(36)} ${s.detail}`);
  }
  console.log('screenshot: .artifacts/screens/session-focus.png');
  console.log(`
RESULT: ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

function reportSheet(o) {
  const line = (label, ok, detail) => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} ${detail || ''}`);
  console.log('\n=== BottomSheet interaction (#/workouts picker, iPhone 14) ===');
  line('sheet opened', o.opened, `dialog[open]=${o.opened}`);
  line('background scroll locked while open', o.lockedWhileOpen, `.main-content overflow:hidden`);
  line('drag 20% springs back (stays open)', o.stillOpenAfter20, `open=${o.stillOpenAfter20}`);
  line('drag 50% closes', o.closedAfter50, `closed=${o.closedAfter50}`);
  line('focus returned to trigger', o.focusReturned, `activeElement=trigger`);
  line('window.scrollY unchanged', o.scrollYBefore === o.scrollYAfter, `${o.scrollYBefore} -> ${o.scrollYAfter}`);
  line('bg scroll pos preserved', o.mainScrollBefore === o.mainScrollAfter, `.main-content ${o.mainScrollBefore} -> ${o.mainScrollAfter}`);
  line('scroll lock released on close', o.restored, `overflow restored`);
  line('no console errors', o.errors.length === 0, o.errors.slice(0, 2).join(' | '));
  console.log('screenshot: .artifacts/screens/sheet-workouts.png');
  const pass = o.opened && o.lockedWhileOpen && o.stillOpenAfter20 && o.closedAfter50 &&
    o.focusReturned && o.scrollYBefore === o.scrollYAfter && o.mainScrollBefore === o.mainScrollAfter &&
    o.restored && o.errors.length === 0;
  console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'}`);
  return pass;
}

(async () => {
  let server;
  let browser;
  try {
    server = await ensureServer();
    console.log(`route: #/${route}${flags.has('session') ? ' (--session)' : ''}${flags.has('sheet') ? ' (--sheet)' : ''}   server: ${server.base}${server.started ? ' (started)' : ' (reused)'}`);
    browser = await chromium.launch();

    if (flags.has('session')) {
      const o = await runSessionTest(browser, server.base);
      process.exitCode = reportSession(o) ? 0 : 1;
      return;
    }

    if (flags.has('sheet')) {
      const o = await runSheetTest(browser, server.base);
      process.exitCode = reportSheet(o) ? 0 : 1;
      return;
    }

    const rows = [];
    for (const profile of PROFILES) {
      rows.push(await runProfile(browser, server.base, profile));
    }
    printTable(rows);
    console.log(`screenshots: .artifacts/screens/${route}-<profile>.png`);
    const anyFail = rows.some((r) => Object.values(r.results).some((c) => !c.pass));
    console.log(`\nRESULT: ${anyFail ? 'FAIL' : 'PASS'}`);
    process.exitCode = anyFail ? 1 : 0;
  } catch (err) {
    console.error('harness error:', err?.message || err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    stopServer(server);
  }
})();
