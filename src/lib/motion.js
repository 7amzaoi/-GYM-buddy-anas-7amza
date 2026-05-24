/**
 * Unified motion helpers for GymBuddy — Phase 0 of the 2026 redesign.
 *
 * One reveal system used by every app page so scroll animation timing,
 * easing, and reduced-motion behaviour stay identical site-wide.
 *
 * Design rules (UI/UX skill §7):
 *   - transform/opacity only, never width/height
 *   - 150-400ms durations, spring-ish easing
 *   - 30-50ms stagger between items
 *   - prefers-reduced-motion fully respected
 */
import { gsap, ScrollTrigger } from '../gsap.config.js';

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function isCoarsePointer() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * Reveal elements matching `selector` inside `root` as they scroll in.
 * Returns a cleanup function. Falls back to instant-visible when the
 * user prefers reduced motion.
 *
 * @param {HTMLElement} root        scope element
 * @param {string} selector         defaults to '[data-reveal]'
 * @param {object} [opts]
 * @param {number} [opts.y]         entry offset in px (default 32)
 * @param {number} [opts.duration]  seconds (default 0.7)
 * @param {number} [opts.stagger]   seconds between items (default 0.05)
 */
export function revealOnScroll(root, selector = '[data-reveal]', opts = {}) {
  if (!root) return () => {};
  const els = Array.from(root.querySelectorAll(selector));
  if (!els.length) return () => {};

  const { y = 32, duration = 0.7, stagger = 0.05 } = opts;

  // Reduced motion → just show everything, no animation.
  if (prefersReducedMotion()) {
    els.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return () => {};
  }

  let ctx;
  try {
    ctx = gsap.context(() => {
      ScrollTrigger.batch(els, {
        start: 'top 88%',
        onEnter: (batch) =>
          gsap.fromTo(
            batch,
            { y, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration,
              ease: 'power3.out',
              stagger,
              overwrite: true,
              clearProps: 'transform,opacity',
            }
          ),
      });
    }, root);
  } catch (err) {
    // GSAP failed — never leave content stuck invisible.
    els.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    console.warn('[motion] revealOnScroll fell back to static:', err);
  }

  return () => ctx?.revert?.();
}

/**
 * Staggered entrance for a group of elements on mount (no scroll trigger).
 * Use for above-the-fold content like page headers.
 */
export function entranceStagger(elements, opts = {}) {
  const els = Array.isArray(elements) ? elements.filter(Boolean) : [elements];
  if (!els.length) return () => {};

  if (prefersReducedMotion()) {
    els.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return () => {};
  }

  const { y = 24, duration = 0.7, stagger = 0.06, delay = 0.05 } = opts;
  let tween;
  try {
    tween = gsap.fromTo(
      els,
      { y, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration,
        ease: 'power3.out',
        stagger,
        delay,
        clearProps: 'transform,opacity',
      }
    );
  } catch (err) {
    els.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    console.warn('[motion] entranceStagger fell back to static:', err);
  }
  return () => tween?.kill?.();
}

/**
 * Count a number up from 0 to `target` when `el` scrolls into view.
 * Reliable across StrictMode double-mounts via a dataset guard.
 *
 * @param {HTMLElement} el
 * @param {number} target
 * @param {object} [opts]  { decimals, suffix, prefix, duration }
 */
export function countUp(el, target, opts = {}) {
  if (!el) return () => {};
  const { decimals = 0, suffix = '', prefix = '', duration = 1.6 } = opts;

  const finalText = prefix + target.toFixed(decimals) + suffix;

  if (prefersReducedMotion()) {
    el.textContent = finalText;
    return () => {};
  }

  let io;
  const run = () => {
    if (el.dataset.counted === '1') return;
    el.dataset.counted = '1';
    const proxy = { v: 0 };
    gsap.to(proxy, {
      v: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = prefix + proxy.v.toFixed(decimals) + suffix;
      },
      onComplete: () => {
        el.textContent = finalText;
      },
    });
  };

  io = new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          run();
          obs.unobserve(e.target);
        }
      }
    },
    { threshold: 0.35 }
  );
  io.observe(el);

  // Safety: snap to final value if never triggered.
  const failSafe = window.setTimeout(() => {
    if (el.dataset.counted !== '1') el.textContent = finalText;
  }, 3500);

  return () => {
    io?.disconnect();
    window.clearTimeout(failSafe);
  };
}

/**
 * Attach a smooth cursor-lerped 3D tilt to an element.
 * Sets --tilt-x / --tilt-y / --mx / --my CSS vars; the element's CSS
 * decides how to use them. Skipped on coarse pointers + reduced motion.
 */
export function attachTilt(el, opts = {}) {
  if (!el || isCoarsePointer() || prefersReducedMotion()) return () => {};
  const { max = 6, lerp = 0.14 } = opts;

  let raf = 0;
  let tx = 0, ty = 0, cx = 0, cy = 0;

  const tick = () => {
    cx += (tx - cx) * lerp;
    cy += (ty - cy) * lerp;
    el.style.setProperty('--tilt-x', `${cx.toFixed(2)}deg`);
    el.style.setProperty('--tilt-y', `${cy.toFixed(2)}deg`);
    if (Math.abs(tx - cx) > 0.02 || Math.abs(ty - cy) > 0.02) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0;
    }
  };
  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ty = (py - 0.5) * -2 * max;
    tx = (px - 0.5) * 2 * max;
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    if (!raf) tick();
  };
  const onLeave = () => {
    tx = 0; ty = 0;
    if (!raf) tick();
  };

  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseleave', onLeave);
  return () => {
    el.removeEventListener('mousemove', onMove);
    el.removeEventListener('mouseleave', onLeave);
    if (raf) cancelAnimationFrame(raf);
  };
}
