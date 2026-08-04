import { lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { gsap } from '../gsap.config.js';
import { icon } from '../icons.jsx';
import { NavigateContext } from '../context/NavigateContext.jsx';
import { BRAND_ACCENT } from '../lib/personalization.js';

// Heavy three-based fluid sim — lazy so initial bundle stays small.
const LiquidEther = lazy(() => import('../components/LiquidEther.jsx'));

// Brand-tuned palette for the fluid background (overrides the sim's default
// purple/pink). This is a marketing surface, so it uses the brand accent
// rather than the visitor's chosen one — same rule as `.brand-lock`.
// WebGL takes literal colours, so it can't inherit the CSS scope.
const LIQUID_COLORS = [BRAND_ACCENT.deep, BRAND_ACCENT.hex2, BRAND_ACCENT.hex];

const FEATURES = [
  {
    iconName: 'bot',
    title: 'Pocket AI Coach',
    desc: 'Conversational coaching, plan tweaks, and nutrition guidance — right next to your gym bag.',
  },
  {
    iconName: 'activity',
    title: 'Live Cross-Device Sync',
    desc: 'Train on phone, review on desktop. Every set lands in your history within seconds.',
  },
  {
    iconName: 'fire',
    title: 'Auto-Detected PRs',
    desc: 'The app spots a new personal record the second you log it — no manual tracking.',
  },
];

const AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=faces&q=80',
];

const STATS = [
  { value: 50000, label: 'Sets Logged',   format: 'k', suffix: '+' },
  { value: 98,    label: 'Stick to Plan', suffix: '%' },
  { value: 4.9,   label: 'Star Rating',   decimals: 1, suffix: '★' },
];

const STEPS = [
  {
    num: '01',
    iconName: 'arrow',
    title: 'Download & sign up',
    desc: 'Grab GymBuddy from your store and create an account in under a minute — no card needed.',
  },
  {
    num: '02',
    iconName: 'target',
    title: 'Set your goal',
    desc: 'Tell the AI what you are chasing — strength, fat loss, or cardio — and get a tuned plan.',
  },
  {
    num: '03',
    iconName: 'fire',
    title: 'Train & track',
    desc: 'Log every set in two taps. PRs, streaks, and volume curves build themselves as you lift.',
  },
];

const TESTIMONIALS = [
  {
    name: 'Marcus T.',
    role: 'Powerlifter · 2 yrs in',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=120&h=120&fit=crop&crop=faces&q=80',
    quote: 'The PR detection alone changed how I train. I stopped guessing and started progressing every week.',
  },
  {
    name: 'Lena R.',
    role: 'CrossFit athlete',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=faces&q=80',
    quote: 'Logging a set takes two taps. The AI coach actually adjusts the plan when I miss a session.',
  },
  {
    name: 'Daniel K.',
    role: 'Hybrid athlete',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces&q=80',
    quote: 'Cross-device sync is flawless — phone at the gym, desktop for planning. Never lost a rep.',
  },
];

const FAQS = [
  {
    q: 'Is GymBuddy free to download?',
    a: 'Yes. The core tracker, planner, and progress charts are free forever. A premium tier unlocks the advanced AI coach.',
  },
  {
    q: 'Does it work offline at the gym?',
    a: 'Absolutely. Sessions log locally and sync the moment you are back online — no connection needed mid-workout.',
  },
  {
    q: 'Which devices are supported?',
    a: 'iOS and Android phones, plus a synced desktop web app for planning. Your data stays identical across all of them.',
  },
  {
    q: 'Can I import my existing training history?',
    a: 'You can. GymBuddy accepts CSV imports from most popular trackers so your streak and PRs carry over.',
  },
];

// Minimal generic platform marks — geometric shapes, not trademarked logos.
const IconApple = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="3" width="12" height="18" rx="3" />
    <line x1="11" y1="18" x2="13" y2="18" />
  </svg>
);
const IconAndroidPlay = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M5 3.4v17.2c0 .8.9 1.3 1.6.9l13.2-8.6c.7-.4.7-1.4 0-1.8L6.6 2.5c-.7-.4-1.6.1-1.6.9z" />
  </svg>
);

function StoreButton({ store, onClick, compact = false }) {
  const isApple = store === 'apple';
  const subtitle = isApple ? 'Download on the' : 'Get it on';
  const platform = isApple ? 'App Store' : 'Google Play';
  return (
    <button
      type="button"
      className={`dl-store-btn ${compact ? 'is-compact' : ''}`}
      onClick={onClick}
      aria-label={`${subtitle} ${platform}`}
    >
      <span className="dl-store-btn-icon">{isApple ? <IconApple /> : <IconAndroidPlay />}</span>
      <span className="dl-store-btn-text">
        <span className="dl-store-btn-sub">{subtitle}</span>
        <span className="dl-store-btn-name">{platform}</span>
      </span>
    </button>
  );
}

export default function DownloadPage() {
  const navigateToPage = useContext(NavigateContext);
  const rootRef = useRef(null);
  const [openFaq, setOpenFaq] = useState(0);

  // Intersection-observer scroll reveals (safety net) + GSAP polish
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const targets = root.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    targets.forEach((el) => io.observe(el));
    const failSafe = window.setTimeout(
      () => targets.forEach((el) => el.classList.add('is-revealed')),
      4000
    );

    let ctx;
    try {
      ctx = gsap.context(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) return;

        // Hero entrance — staggered fade-up
        gsap.from('[data-dl-anim="hero"] > *', {
          y: 28,
          opacity: 0,
          duration: 0.85,
          ease: 'power3.out',
          stagger: 0.08,
          delay: 0.1,
          clearProps: 'transform,opacity',
        });

        // Phone stage entrance — fade-up via opacity only. Float is
        // handled by a CSS keyframe on .dl-phone-bob and mouse parallax
        // by the dedicated raf-lerp useEffect; both have their own
        // transform layer so nothing collides here.
        gsap.from('.dl-phone-stack', {
          opacity: 0,
          duration: 1.1,
          ease: 'power3.out',
          delay: 0.35,
        });

      }, root);
    } catch (err) {
      console.warn('[DownloadPage] GSAP failed, falling back to CSS reveals:', err);
    }

    // ---- Count-up stats via IntersectionObserver (more reliable than
    //      ScrollTrigger for above-the-fold and StrictMode double-mount).
    const counterEls = root.querySelectorAll('[data-dl-counter]');
    const runCount = (el) => {
      if (el.dataset.dlCounted === '1') return;
      el.dataset.dlCounted = '1';
      const target = parseFloat(el.dataset.dlCounter);
      const decimals = parseInt(el.dataset.dlDecimals || '0', 10);
      const suffix = el.dataset.dlSuffix || '';
      const format = el.dataset.dlFormat || '';
      const finalDisplay =
        format === 'k' && target >= 1000
          ? Math.round(target / 1000) + 'K' + suffix
          : target.toFixed(decimals) + suffix;
      el.dataset.dlFinal = finalDisplay;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.6,
        ease: 'power2.out',
        onUpdate: () => {
          let display;
          if (format === 'k' && obj.v >= 1000) {
            display = Math.round(obj.v / 1000) + 'K';
          } else {
            display = obj.v.toFixed(decimals);
          }
          el.textContent = display + suffix;
        },
        onComplete: () => {
          el.textContent = finalDisplay;
        },
      });
    };
    const counterIo = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            runCount(entry.target);
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.3 }
    );
    counterEls.forEach((el) => counterIo.observe(el));
    // Safety net: if the IO never fires within 3.5s, snap to final values
    const counterFailSafe = window.setTimeout(() => {
      counterEls.forEach((el) => {
        if (el.dataset.dlCounted !== '1' && el.dataset.dlFinal) {
          el.textContent = el.dataset.dlFinal;
        } else if (el.dataset.dlCounted !== '1') {
          runCount(el);
        }
      });
    }, 3500);

    // ---- Cursor-tracking glow on the stats banner ----
    const banner = root.querySelector('.dl-stats-banner');
    const onBannerMove = (e) => {
      const rect = banner.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      banner.style.setProperty('--dl-mx', `${x}%`);
      banner.style.setProperty('--dl-my', `${y}%`);
    };
    banner?.addEventListener('mousemove', onBannerMove);

    // ---- Stat flicker on hover: cycle random numbers, snap back ----
    const stats = root.querySelectorAll('.dl-stat');
    const flickerHandlers = [];
    stats.forEach((stat) => {
      const el = stat.querySelector('[data-dl-counter]');
      if (!el) return;
      let timer = 0;
      const onEnter = () => {
        if (el.dataset.dlCounted !== '1') return;
        const finalDisplay = el.dataset.dlFinal || el.textContent;
        let ticks = 0;
        clearInterval(timer);
        timer = setInterval(() => {
          if (ticks++ >= 6) {
            clearInterval(timer);
            el.textContent = finalDisplay;
            return;
          }
          const noise = Math.floor(Math.random() * 90 + 10);
          el.textContent = noise + (el.dataset.dlSuffix || '');
        }, 40);
      };
      const onLeave = () => {
        clearInterval(timer);
        el.textContent = el.dataset.dlFinal || el.textContent;
      };
      stat.addEventListener('mouseenter', onEnter);
      stat.addEventListener('mouseleave', onLeave);
      flickerHandlers.push({ stat, onEnter, onLeave, timer: () => timer });
    });

    return () => {
      io.disconnect();
      counterIo.disconnect();
      window.clearTimeout(failSafe);
      window.clearTimeout(counterFailSafe);
      banner?.removeEventListener('mousemove', onBannerMove);
      flickerHandlers.forEach(({ stat, onEnter, onLeave }) => {
        stat.removeEventListener('mouseenter', onEnter);
        stat.removeEventListener('mouseleave', onLeave);
      });
      ctx?.revert?.();
    };
  }, []);

  // ---- Physics-driven mouse parallax on the phone stack ----
  // Cursor position drives target rotateX/rotateY, lerped each frame so
  // the phones feel like they have a bit of inertia rather than snapping.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const stage = root.querySelector('.dl-hero-stage');
    const stack = root.querySelector('.dl-phone-stack');
    if (!stage || !stack) return undefined;
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let targetRx = 0, targetRy = 0;
    let currentRx = 0, currentRy = 0;
    let raf = 0;
    let active = false;

    const tick = () => {
      currentRx += (targetRx - currentRx) * 0.08;
      currentRy += (targetRy - currentRy) * 0.08;
      stack.style.setProperty('--mouse-rx', `${currentRx.toFixed(2)}deg`);
      stack.style.setProperty('--mouse-ry', `${currentRy.toFixed(2)}deg`);
      if (active || Math.abs(targetRx - currentRx) > 0.02 || Math.abs(targetRy - currentRy) > 0.02) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const onMove = (e) => {
      const rect = stage.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5..0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      targetRy = px * 22;   // rotateY range ±11deg
      targetRx = py * -14;  // rotateX range ±7deg (inverted Y feels natural)
      active = true;
      if (!raf) tick();
    };

    const onLeave = () => {
      targetRx = 0;
      targetRy = 0;
      active = false;
      if (!raf) tick();
    };

    stage.addEventListener('mousemove', onMove);
    stage.addEventListener('mouseleave', onLeave);
    return () => {
      stage.removeEventListener('mousemove', onMove);
      stage.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ---- Micro-interactions: scroll progress, magnetic buttons,
  //      feature-card 3D tilt + cursor spotlight ----
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const cleanups = [];

    // --- Scroll progress bar ---
    const fill = root.querySelector('.dl-scroll-progress-fill');
    if (fill) {
      let progRaf = 0;
      const updateProgress = () => {
        progRaf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        fill.style.transform = `scaleX(${pct.toFixed(4)})`;
      };
      const onScroll = () => {
        if (!progRaf) progRaf = requestAnimationFrame(updateProgress);
      };
      updateProgress();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        if (progRaf) cancelAnimationFrame(progRaf);
      });
    }

    if (reduced || coarse) return () => cleanups.forEach((fn) => fn());

    // --- Magnetic store buttons: button drifts toward the cursor ---
    root.querySelectorAll('.dl-store-btn:not(.is-compact)').forEach((btn) => {
      let raf = 0;
      let tx = 0, ty = 0, cx = 0, cy = 0;
      const tick = () => {
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        btn.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = 0;
        }
      };
      const onMove = (e) => {
        const r = btn.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 18;
        // Drift toward cursor + a constant -5px hover lift baked in
        ty = ((e.clientY - r.top) / r.height - 0.5) * 14 - 5;
        if (!raf) tick();
      };
      const onLeave = () => {
        tx = 0; ty = 0;
        if (!raf) tick();
      };
      btn.addEventListener('mousemove', onMove);
      btn.addEventListener('mouseleave', onLeave);
      cleanups.push(() => {
        btn.removeEventListener('mousemove', onMove);
        btn.removeEventListener('mouseleave', onLeave);
        if (raf) cancelAnimationFrame(raf);
        btn.style.transform = '';
      });
    });

    // --- Feature-card 3D tilt + cursor spotlight ---
    root.querySelectorAll('[data-tilt]').forEach((card) => {
      let raf = 0;
      let trx = 0, tryy = 0, crx = 0, cry = 0;
      const tick = () => {
        crx += (trx - crx) * 0.14;
        cry += (tryy - cry) * 0.14;
        card.style.setProperty('--tilt-x', `${crx.toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${cry.toFixed(2)}deg`);
        if (Math.abs(trx - crx) > 0.02 || Math.abs(tryy - cry) > 0.02) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = 0;
        }
      };
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        trx = (py - 0.5) * -10;  // rotateX ±5deg
        tryy = (px - 0.5) * 12;  // rotateY ±6deg
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        if (!raf) tick();
      };
      const onLeave = () => {
        trx = 0; tryy = 0;
        if (!raf) tick();
      };
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      cleanups.push(() => {
        card.removeEventListener('mousemove', onMove);
        card.removeEventListener('mouseleave', onLeave);
        if (raf) cancelAnimationFrame(raf);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  function handleStoreClick(store) {
    console.info(`[DownloadPage] store click: ${store}`);
    // No real listing yet — placeholder behavior. Hook real URLs here later.
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&bgcolor=0B0B0B&color=${BRAND_ACCENT.hex.replace('#', '')}&data=${encodeURIComponent('https://gymbuddy.app/download')}`;

  return (
    <div className="page download-page brand-lock" ref={rootRef}>
      {/* Scroll progress bar — neon strip, width tracks page scroll */}
      <div className="dl-scroll-progress" aria-hidden="true">
        <span className="dl-scroll-progress-fill" />
      </div>

      {/* Animated fluid backdrop — three-based LiquidEther sim with brand colors.
          Sits behind every section but pauses when the page is off-screen. */}
      <div className="dl-backdrop" aria-hidden="true">
        <Suspense fallback={<div className="dl-backdrop-fallback" />}>
          <LiquidEther
            colors={LIQUID_COLORS}
            mouseForce={19}
            cursorSize={70}
            resolution={0.5}
            isViscous={false}
            viscous={30}
            iterationsViscous={32}
            iterationsPoisson={32}
            isBounce={false}
            autoDemo={true}
            autoSpeed={0.4}
            autoIntensity={2.2}
            takeoverDuration={0.25}
            autoResumeDelay={3000}
            autoRampDuration={0.6}
            className="dl-liquid"
          />
        </Suspense>
        <div className="dl-backdrop-overlay" />
        <div className="dl-backdrop-glow dl-backdrop-glow-1" />
        <div className="dl-backdrop-glow dl-backdrop-glow-2" />
      </div>

      {/* Top bar — minimal, back to landing */}
      <nav className="dl-nav">
        <button
          type="button"
          className="dl-back"
          onClick={() => navigateToPage?.('landing')}
          aria-label="Back to home"
        >
          {icon('back', 18)} <span>Back</span>
        </button>
        <div className="dl-nav-brand">
          <span className="logo-dot" /> GymBuddy
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => navigateToPage?.('login')}
        >
          Log In
        </button>
      </nav>

      {/* ============== SECTION 1: HERO ============== */}
      <section className="dl-hero">
        <div className="dl-hero-content" data-dl-anim="hero">
          <div className="dl-badge">
            <span className="dl-badge-dot" /> AI-Powered Training Platform
          </div>

          <h1 className="dl-h1">
            Take Your <span className="dl-accent">Strength</span> Everywhere
          </h1>

          <p className="dl-sub">
            The full GymBuddy AI in your pocket — plan, log, and prove progress from anywhere.
            Built for athletes who don&apos;t skip rest days, just bad reps.
          </p>

          <div className="dl-store-row">
            <StoreButton store="apple" onClick={() => handleStoreClick('apple')} />
            <StoreButton store="google" onClick={() => handleStoreClick('google')} />
          </div>

          <div className="dl-social">
            <div className="dl-avatars" aria-hidden="true">
              {AVATARS.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  style={{ zIndex: AVATARS.length - i }}
                />
              ))}
            </div>
            <div className="dl-social-copy">
              <div className="dl-social-stars" aria-hidden="true">★★★★★</div>
              <div className="dl-social-text">
                <strong>2,400+ athletes</strong> training daily
              </div>
            </div>
          </div>
        </div>

        {/* Visual: modern dual-iPhone mockup with physics-driven tilt + float.
            Two nested layers: outer .dl-phone-stack owns mouse rotateX/Y,
            inner .dl-phone-bob owns the CSS-keyframe float so they can't conflict. */}
        <div className="dl-hero-stage" aria-hidden="true">
          <div className="dl-phone-stack">
            <div className="dl-phone-bob">
            {/* Back phone — chart + streak */}
            <div className="dl-phone dl-phone-back">
              <span className="dl-phone-frame" />
              <span className="dl-phone-shine" />
              <span className="dl-phone-side dl-phone-side-power" />
              <span className="dl-phone-side dl-phone-side-volup" />
              <span className="dl-phone-side dl-phone-side-voldown" />
              <span className="dl-phone-island" />
              <div className="dl-phone-screen">
                <div className="dl-phone-row dl-phone-row-between">
                  <span className="dl-phone-label">Weekly Volume</span>
                  <span className="dl-phone-trend">+18%</span>
                </div>
                <div className="dl-phone-chart">
                  {[28, 42, 36, 58, 64, 72, 88].map((v, i) => (
                    <div key={i} className="dl-phone-bar" style={{ '--h': `${v}%`, '--i': i }} />
                  ))}
                </div>
                <div className="dl-phone-row dl-phone-row-between">
                  <span className="dl-phone-muted">Streak</span>
                  <span className="dl-phone-accent">12 days 🔥</span>
                </div>
              </div>
            </div>

            {/* Front phone — live session */}
            <div className="dl-phone dl-phone-front">
              <span className="dl-phone-frame" />
              <span className="dl-phone-shine" />
              <span className="dl-phone-side dl-phone-side-power" />
              <span className="dl-phone-side dl-phone-side-volup" />
              <span className="dl-phone-side dl-phone-side-voldown" />
              <span className="dl-phone-island" />
              <div className="dl-phone-screen">
                <div className="dl-phone-row dl-phone-row-between">
                  <div>
                    <div className="dl-phone-muted">Today</div>
                    <div className="dl-phone-title">Push Power</div>
                  </div>
                  <div className="dl-phone-pill">42:18</div>
                </div>
                <div className="dl-phone-progress">
                  <div className="dl-phone-progress-fill" />
                </div>
                <div className="dl-phone-row dl-phone-row-between dl-phone-meta">
                  <span>4 / 6 sets</span>
                  <span className="dl-phone-accent">On track</span>
                </div>
                <div className="dl-phone-divider" />
                <div className="dl-phone-row dl-phone-row-between">
                  <span className="dl-phone-set">Bench Press</span>
                  <span className="dl-phone-pill dl-phone-pill-accent">PR</span>
                </div>
                <div className="dl-phone-set-rows">
                  <div className="dl-phone-set-row done"><span>1</span><span>30 kg</span><span>8</span></div>
                  <div className="dl-phone-set-row done"><span>2</span><span>30 kg</span><span>8</span></div>
                  <div className="dl-phone-set-row active"><span>3</span><span>32.5 kg</span><span>—</span></div>
                </div>
              </div>
            </div>
            </div>{/* /dl-phone-bob */}
          </div>{/* /dl-phone-stack */}
        </div>{/* /dl-hero-stage */}
      </section>

      {/* ============== SECTION 2: FEATURES ============== */}
      <section className="dl-features-section">
        <div className="dl-section-header" data-reveal>
          <span className="dl-eyebrow">Why on Mobile</span>
          <h2 className="dl-h2">Built for <span className="dl-accent">the floor</span>, not the desk</h2>
        </div>
        <div className="dl-features-grid">
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className="dl-feature-card"
              data-reveal
              style={{ '--reveal-delay': `${i * 0.08}s` }}
            >
              <div className="dl-feature-card-inner" data-tilt>
                <div className="dl-feature-icon">{icon(f.iconName, 24)}</div>
                <h3 className="dl-feature-title">{f.title}</h3>
                <p className="dl-feature-desc">{f.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ============== SECTION 3: HOW IT WORKS ============== */}
      <section className="dl-steps-section">
        <div className="dl-section-header" data-reveal>
          <span className="dl-eyebrow">Get Started</span>
          <h2 className="dl-h2">Up and running in <span className="dl-accent">three steps</span></h2>
        </div>
        <div className="dl-steps">
          <span className="dl-steps-line" aria-hidden="true" />
          {STEPS.map((s, i) => (
            <div
              key={s.num}
              className="dl-step"
              data-reveal
              style={{ '--reveal-delay': `${i * 0.12}s` }}
            >
              <div className="dl-step-marker">
                <span className="dl-step-num">{s.num}</span>
                <span className="dl-step-icon">{icon(s.iconName, 22)}</span>
              </div>
              <h3 className="dl-step-title">{s.title}</h3>
              <p className="dl-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============== SECTION 4: STATS BANNER ============== */}
      <section className="dl-stats-banner" data-reveal>
        <span className="dl-stats-edge-bottom" aria-hidden="true" />
        <div className="dl-stats-inner">
          {STATS.map((s) => (
            <div key={s.label} className="dl-stat">
              <div className="dl-stat-num">
                <span
                  data-dl-counter={s.value}
                  data-dl-decimals={s.decimals ?? 0}
                  data-dl-suffix={s.suffix ?? ''}
                  data-dl-format={s.format ?? ''}
                >
                  0
                </span>
              </div>
              <div className="dl-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============== SECTION 5: TESTIMONIALS ============== */}
      <section className="dl-testimonials">
        <div className="dl-section-header" data-reveal>
          <span className="dl-eyebrow">Loved by Lifters</span>
          <h2 className="dl-h2">What the <span className="dl-accent">community</span> says</h2>
        </div>
        <div className="dl-testi-grid">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={t.name}
              className="dl-testi-card"
              data-reveal
              style={{ '--reveal-delay': `${i * 0.1}s` }}
            >
              <div className="dl-testi-stars" aria-label="5 out of 5 stars">★★★★★</div>
              <blockquote className="dl-testi-quote">{t.quote}</blockquote>
              <figcaption className="dl-testi-author">
                <img src={t.avatar} alt="" loading="lazy" />
                <div>
                  <div className="dl-testi-name">{t.name}</div>
                  <div className="dl-testi-role">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ============== SECTION 6: FAQ ============== */}
      <section className="dl-faq-section">
        <div className="dl-section-header" data-reveal>
          <span className="dl-eyebrow">Questions</span>
          <h2 className="dl-h2">Everything you <span className="dl-accent">need to know</span></h2>
        </div>
        <div className="dl-faq-list">
          {FAQS.map((f, i) => (
            <div
              key={f.q}
              className={`dl-faq-item ${openFaq === i ? 'is-open' : ''}`}
              data-reveal
              style={{ '--reveal-delay': `${i * 0.06}s` }}
            >
              <button
                type="button"
                className="dl-faq-q"
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                aria-expanded={openFaq === i}
              >
                <span>{f.q}</span>
                <span className="dl-faq-toggle" aria-hidden="true">{icon('plus', 18)}</span>
              </button>
              <div className="dl-faq-a-wrap">
                <div className="dl-faq-a-inner">
                  <p className="dl-faq-a">{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============== SECTION 7: FINAL CTA ============== */}
      <section className="dl-final-cta">
        <div className="dl-final-card" data-reveal>
          <h2 className="dl-h2 dl-h2-center">
            Ready to build your <span className="dl-accent">strongest self</span>?
          </h2>
          <p className="dl-sub dl-sub-center">
            Scan the QR with your phone or hit a store button — you&apos;ll be lifting smarter inside 60 seconds.
          </p>

          <div className="dl-final-grid">
            <div className="dl-final-stores">
              <StoreButton store="apple" onClick={() => handleStoreClick('apple')} />
              <StoreButton store="google" onClick={() => handleStoreClick('google')} />
            </div>

            <div className="dl-qr-card" aria-label="QR code to download the app">
              <div className="dl-qr-frame">
                <img src={qrSrc} alt="QR code to download GymBuddy" />
              </div>
              <div className="dl-qr-caption">
                <span className="dl-qr-caption-dot" />
                Scan to download instantly
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== STICKY MOBILE CTA ============== */}
      <div className="dl-mobile-sticky" aria-hidden={false}>
        <StoreButton store="apple"  onClick={() => handleStoreClick('apple')}  compact />
        <StoreButton store="google" onClick={() => handleStoreClick('google')} compact />
      </div>
    </div>
  );
}
