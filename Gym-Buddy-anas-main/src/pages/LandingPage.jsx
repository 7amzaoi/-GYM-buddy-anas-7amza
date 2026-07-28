import { lazy, Suspense, useContext, useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger } from '../gsap.config.js';
import { icon } from '../icons.jsx';
import { NavigateContext } from '../context/NavigateContext.jsx';

// Heavy R3F + Rapier deps — only loads when the user reaches the landing page.
const MembershipCard = lazy(() => import('../components/MembershipCard.jsx'));
const StaticMembershipCard = lazy(() => import('../components/StaticMembershipCard.jsx'));

/**
 * Should this device get the WebGL card at all?
 *
 * The 3D card is ~2.4 MB and runs a rope physics sim every frame. Phones, users
 * who asked for reduced motion, and low-core machines get the static card
 * instead — same artwork, transform-only tilt, no WebGL and no download.
 */
function prefersStaticCard() {
  if (typeof window === 'undefined') return true;
  const mq = (q) => typeof matchMedia !== 'undefined' && matchMedia(q).matches;
  if (mq('(max-width: 768px)')) return true;
  if (mq('(prefers-reduced-motion: reduce)')) return true;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores <= 4) return true;
  return false;
}

/**
 * Holds the 2 MB three.js bundle off the initial render. The card only mounts
 * once its container is in (or near) the viewport — so users who never scroll
 * to that section never download it.
 */
function DeferredMembershipCard() {
  const ref = useRef(null);
  const [shouldMount, setShouldMount] = useState(false);
  // Decided once on mount — this must not change mid-session and re-mount WebGL.
  const [useStatic] = useState(prefersStaticCard);
  useEffect(() => {
    if (shouldMount) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) {
      // Old browser fallback — mount after 2s so it still appears.
      const t = setTimeout(() => setShouldMount(true), 2000);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setShouldMount(true);
        io.disconnect();
      }
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shouldMount]);
  const skeleton = (
    <div className="lanyard-wrapper landing-lanyard">
      <div className="lanyard-skeleton">
        <div className="lanyard-skeleton-strap" />
        <div className="lanyard-skeleton-card"><div className="lanyard-skeleton-shimmer" /></div>
        <p>Loading membership card…</p>
      </div>
    </div>
  );
  return (
    <div ref={ref} className="lanyard-deferred">
      {shouldMount ? (
        <Suspense fallback={skeleton}>
          {useStatic ? <StaticMembershipCard /> : <MembershipCard />}
        </Suspense>
      ) : skeleton}
    </div>
  );
}

// Public CDN sources tried in order. Pexels CDN now blocks hot-linking
// (returns 403), so we use Mixkit which is explicitly hot-link friendly.
// If all sources fail, the CSS mesh-gradient fallback shows through.
const HERO_VIDEO_SOURCES = [
  '/hero-loop.mp4',
  '/hero-loop.webm',
  'https://assets.mixkit.co/videos/4828/4828-720.mp4', // yoga in park, ~4 MB
  'https://assets.mixkit.co/videos/4831/4831-720.mp4', // running through park, ~3 MB
];

const HERO_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=80&h=80&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=faces&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces&q=80',
];

const MARQUEE_ITEMS = [
  'Real Sets',
  'Real PRs',
  'Real Streaks',
  'AI Coach',
  'Smart Plans',
  'Live Tracker',
  'Strength Index',
  'Volume Curves',
];

const FEATURES = [
  { iconName: 'dumbbell', title: 'Smart Workout Plans',  desc: 'Pre-built and custom programs tuned to strength, hypertrophy, fat loss, or cardio.' },
  { iconName: 'chart',    title: 'Progress Analytics',   desc: 'Live charts for weight, volume, calories, and strength index — built from your real sessions.' },
  { iconName: 'bot',      title: 'AI Gym Coach',         desc: 'Conversational coach that suggests sessions, nutrition, and recovery based on your goal.' },
  { iconName: 'clock',    title: 'Live Session Tracker', desc: 'Real-time timer, rest periods, and per-set weight × reps logging with focus highlight.' },
  { iconName: 'fire',     title: 'Streaks & Records',    desc: 'Auto-detected PRs, daily streaks, and total volume that updates the moment you finish a set.' },
  { iconName: 'activity', title: 'Cross-Device Sync',    desc: 'Train on phone, review on desktop. Your plans, history, and records stay perfectly in sync.' },
];

const PROGRAMS = [
  {
    title: 'Strength',
    tag: '8 Weeks',
    blurb: 'Heavy compounds, low reps, real progressive overload.',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&auto=format&fit=crop&q=80',
  },
  {
    title: 'Hypertrophy',
    tag: '6 Weeks',
    blurb: 'High-volume splits engineered for visible muscle growth.',
    image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&auto=format&fit=crop&q=80',
  },
  {
    title: 'Cardio & HIIT',
    tag: '4 Weeks',
    blurb: 'Conditioning circuits to torch fat and build endurance.',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop&q=80',
  },
];

const STEPS = [
  { num: '01', title: 'Pick or build a plan',  desc: 'Choose a featured program or create a custom split with your favorite lifts.' },
  { num: '02', title: 'Train with the tracker', desc: 'Log every set in seconds. Timer, rest cues, and PR detection are automatic.' },
  { num: '03', title: 'See your gains',          desc: 'Strength index, weight journey, and volume update from real sessions only.' },
];

const WORKOUT_TYPES = [
  {
    iconName: 'dumbbell',
    title: 'Body Building',
    desc: 'Sculpt and strengthen your physique with targeted muscle growth programs.',
    bars: [
      { label: 'Strength',     value: 80 },
      { label: 'Hypertrophy',  value: 70 },
      { label: 'Cardio',       value: 30 },
    ],
  },
  {
    iconName: 'fire',
    title: 'Calorie Burning',
    desc: 'Boost your metabolism and shed unwanted fat with high-intensity cardio and circuits.',
    bars: [
      { label: 'Cardio',     value: 75 },
      { label: 'HIIT',       value: 70 },
      { label: 'Endurance',  value: 80 },
    ],
  },
  {
    iconName: 'leaf',
    title: 'Overall Flexibility',
    desc: 'Improve your range of motion, reduce stiffness, and enhance recovery with dynamic stretches.',
    bars: [
      { label: 'Mobility',   value: 85 },
      { label: 'Stretching', value: 80 },
      { label: 'Balance',    value: 50 },
    ],
  },
];

function TiltCard({ children, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;

    let raf = 0;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = py * -8;
      targetY = px * 10;
      el.style.setProperty('--mx', `${(px + 0.5) * 100}%`);
      el.style.setProperty('--my', `${(py + 0.5) * 100}%`);
      if (!raf) tick();
    };
    const onLeave = () => { targetX = 0; targetY = 0; if (!raf) tick(); };
    const tick = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      el.style.setProperty('--rx', `${currentX.toFixed(2)}deg`);
      el.style.setProperty('--ry', `${currentY.toFixed(2)}deg`);
      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} className={`tilt-card ${className}`}>{children}</div>;
}

export default function LandingPage() {
  const navigateToPage = useContext(NavigateContext);
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const videoLayerRef = useRef(null);
  const videoRef = useRef(null);
  const navRef = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);

  // Hero parallax: video subtly follows mouse on desktop only
  useEffect(() => {
    const hero = heroRef.current;
    const layer = videoLayerRef.current;
    if (!hero || !layer) return undefined;
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;

    let targetX = 0, targetY = 0, currentX = 0, currentY = 0, raf = 0;

    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * -24;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * -16;
      if (!raf) tick();
    };
    const tick = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      layer.style.transform = `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0) scale(1.08)`;
      if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    hero.addEventListener('mousemove', onMove);
    return () => {
      hero.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Sticky nav backdrop on scroll
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const onScroll = () => {
      if (window.scrollY > 24) nav.classList.add('is-scrolled');
      else nav.classList.remove('is-scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // CSS-driven scroll reveals via IntersectionObserver — robust, never gets stuck
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const targets = root.querySelectorAll('[data-reveal], [data-reveal-stagger]');
    if (!targets.length) return undefined;

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

    // Failsafe: if anything is still hidden after 4s (e.g. zoom/odd viewport),
    // force-reveal so users never get stuck on a blank section.
    const failSafe = window.setTimeout(() => {
      targets.forEach((el) => el.classList.add('is-revealed'));
    }, 4000);

    return () => {
      io.disconnect();
      window.clearTimeout(failSafe);
    };
  }, []);

  // GSAP — hero entrance, scroll progress, count-up stats, parallax,
  // marquee loop, scrubbed mockup. Wrapped so failure never leaves the
  // hero stuck at opacity:0 (IO-based reveals are the safety net).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let ctx;
    try {
      ctx = gsap.context(() => {
        // Hero title words reveal via CSS keyframe (.hero-word) so they
        // can never get stuck at opacity:0. JS handles the rest below.

        gsap.from(
          [
            '.hero-badge',
            '.hero-sub',
            '.hero-social',
            '.hero-buttons',
            '.hero-stats',
          ],
          {
            y: 28,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
            stagger: 0.08,
            delay: reduced ? 0 : 0.45,
            clearProps: 'transform,opacity',
          }
        );

        // ---- Floating phone mockup
        gsap.to('[data-float="mockup"]', {
          y: -14,
          duration: 3.2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });

        if (reduced) return;

        // ---- Scroll progress bar
        gsap.to('.scroll-progress', {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.2,
          },
        });

        // ---- Count-up stats
        root.querySelectorAll('[data-counter]').forEach((el) => {
          const target = parseFloat(el.dataset.counter);
          const decimals = parseInt(el.dataset.counterDecimals || '0', 10);
          const suffix = el.dataset.counterSuffix || '';
          const obj = { v: 0 };
          gsap.to(obj, {
            v: target,
            duration: 1.6,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 92%', once: true },
            onUpdate: () => {
              let n = obj.v;
              let display;
              if (n >= 1000 && decimals === 0) {
                display = (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
              } else {
                display = n.toFixed(decimals);
              }
              el.textContent = display + suffix;
            },
          });
        });

        // ---- Marquee infinite loop
        const marquee = root.querySelector('[data-marquee]');
        if (marquee) {
          const group = marquee.querySelector('.marquee-group');
          if (group) {
            const w = group.getBoundingClientRect().width;
            gsap.to(marquee, {
              x: -w,
              duration: 28,
              ease: 'none',
              repeat: -1,
            });
          }
        }

        // ---- ScrollTrigger.batch reveals — richer than IO + replays cleanly
        ScrollTrigger.batch('[data-reveal]:not(.is-revealed)', {
          start: 'top 88%',
          onEnter: (els) =>
            gsap.fromTo(
              els,
              { y: 36, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.8,
                ease: 'power3.out',
                stagger: 0.08,
                clearProps: 'transform,opacity',
                onComplete: () => els.forEach((el) => el.classList.add('is-revealed')),
              }
            ),
        });

        // ---- Parallax: program card images drift on scroll
        root.querySelectorAll('.program-image-wrap img').forEach((img) => {
          gsap.fromTo(
            img,
            { yPercent: -8 },
            {
              yPercent: 8,
              ease: 'none',
              scrollTrigger: {
                trigger: img.closest('.program-card'),
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            }
          );
        });

        // ---- Hero media subtle scroll-out (parallax depth)
        gsap.to('.hero-media', {
          yPercent: 18,
          ease: 'none',
          scrollTrigger: {
            trigger: '.hero-v2',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });

        // ---- Mockup scrub: tilt + lift while user scrolls the section
        const mockup = root.querySelector('.phone-mockup');
        if (mockup) {
          gsap.fromTo(
            mockup,
            { rotateY: -8, rotateX: 6 },
            {
              rotateY: 8,
              rotateX: -4,
              ease: 'none',
              scrollTrigger: {
                trigger: '.section-how',
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.5,
              },
            }
          );
        }
      }, root);
    } catch (err) {
      // Ensure hero content is visible if GSAP fails
      root.querySelectorAll('.hero-content > *').forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      console.warn('[LandingPage] GSAP failed, falling back to static hero:', err);
    }

    return () => ctx?.revert?.();
  }, []);

  // Smooth scroll to anchors with fixed-nav offset
  function handleNavClick(e, hash) {
    e.preventDefault();
    const target = document.querySelector(hash);
    if (!target) return;
    const y = target.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  return (
    <div className="page landing landing-v2" ref={rootRef}>
      <div className="scroll-progress" aria-hidden="true" />
      <div className="landing-ambient" aria-hidden="true">
        <div className="ambient-glow ambient-glow-1" />
        <div className="ambient-glow ambient-glow-2" />
        <div className="ambient-glow ambient-glow-3" />
      </div>

      <nav className="landing-nav landing-nav-v2" ref={navRef}>
        <div className="logo">
          <span className="logo-dot" /> GymBuddy
        </div>
        <div className="landing-nav-links">
          <a href="#features" onClick={(e) => handleNavClick(e, '#features')}>Features</a>
          <a href="#programs" onClick={(e) => handleNavClick(e, '#programs')}>Programs</a>
          <a href="#how" onClick={(e) => handleNavClick(e, '#how')}>How it works</a>
        </div>
        <div className="landing-nav-cta">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigateToPage?.('login')}>
            Log In
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigateToPage?.('register')}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <section className="hero hero-v2" ref={heroRef}>
        <div className={`hero-media ${videoFailed ? 'video-failed' : ''}`} ref={videoLayerRef} aria-hidden="true">
          <video
            ref={videoRef}
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
          >
            {HERO_VIDEO_SOURCES.map((src) => (
              <source
                key={src}
                src={src}
                type={src.endsWith('.webm') ? 'video/webm' : 'video/mp4'}
              />
            ))}
          </video>
          <div className="hero-fallback" />
        </div>
        <div className="hero-overlay" aria-hidden="true" />
        <div className="hero-grain" aria-hidden="true" />

        <div className="hero-content" data-anim="hero">
          <div className="hero-badge">
            <span className="hero-badge-dot" /> AI-Powered Training Platform
          </div>
          <h1 className="hero-title">
            <span className="hero-word">Build</span>{' '}
            <span className="hero-word">Your</span>{' '}
            <span className="hero-word accent">Strongest</span>{' '}
            <span className="hero-word">Self</span>
          </h1>
          <p className="hero-sub">
            Track every set, follow plans built for your goal, and watch your progress turn into measurable strength — all in one premium gym companion.
          </p>
          <div className="hero-social">
            <div className="hero-avatars" aria-hidden="true">
              {HERO_AVATARS.map((src, i) => (
                <img key={src} src={src} alt="" loading="lazy" style={{ zIndex: HERO_AVATARS.length - i }} />
              ))}
            </div>
            <div className="hero-social-copy">
              <div className="hero-social-stars" aria-hidden="true">★★★★★</div>
              <div className="hero-social-text">
                <strong>2,400+ athletes</strong> already training daily
              </div>
            </div>
          </div>

          <div className="hero-buttons">
            <button type="button" className="btn btn-primary btn-lg btn-glow" onClick={() => navigateToPage?.('download')}>
              {icon('zap', 20)} Start Training Free
            </button>
            <button type="button" className="btn btn-glass btn-lg" onClick={() => navigateToPage?.('login')}>
              {icon('arrow', 20)} Sign In
            </button>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-num">
                <span data-counter="50000" data-counter-suffix="+">0</span>
              </div>
              <div className="hero-stat-label">Sets logged</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-num">
                <span data-counter="98" data-counter-suffix="%">0</span>
              </div>
              <div className="hero-stat-label">Stick to their plan</div>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <div className="hero-stat-num">
                <span data-counter="4.9" data-counter-decimals="1" data-counter-suffix="★">0</span>
              </div>
              <div className="hero-stat-label">Athlete rating</div>
            </div>
          </div>
        </div>

        <div className="hero-scroll-cue" aria-hidden="true">
          <span /> SCROLL
        </div>
      </section>

      {/* ================= MARQUEE ================= */}
      <section className="section-marquee" aria-hidden="true">
        <div className="marquee-track" data-marquee>
          {[0, 1].map((dup) => (
            <div className="marquee-group" key={dup}>
              {MARQUEE_ITEMS.map((m) => (
                <span key={`${dup}-${m}`} className="marquee-item">
                  <span className="marquee-dot" /> {m}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="section section-features">
        <div className="section-header" data-reveal-stagger>
          <span className="section-eyebrow" data-reveal-item>Features</span>
          <h2 className="section-title" data-reveal-item>
            Everything You Need to <span className="accent">Dominate</span>
          </h2>
          <p className="section-sub" data-reveal-item>
            Premium tools to plan, train, recover, and prove your progress with real numbers — not vibes.
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={f.title} data-reveal style={{ '--reveal-delay': `${(i % 3) * 0.08}s` }}>
              <TiltCard className="feature-card-v2">
                <div className="feature-spotlight" aria-hidden="true" />
                <div className="feature-icon-v2">
                  <span className="feature-icon-glow" aria-hidden="true" />
                  {icon(f.iconName, 26)}
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <div className="feature-arrow" aria-hidden="true">{icon('arrow', 16)}</div>
              </TiltCard>
            </div>
          ))}
        </div>
      </section>

      {/* ================= FEATURED PROGRAMS ================= */}
      <section id="programs" className="section section-programs">
        <div className="section-header" data-reveal-stagger>
          <span className="section-eyebrow" data-reveal-item>Featured Programs</span>
          <h2 className="section-title" data-reveal-item>
            Train With <span className="accent">Purpose</span>
          </h2>
          <p className="section-sub" data-reveal-item>
            Hand-picked programs that fit your goal, schedule, and equipment — ready in one tap.
          </p>
        </div>

        <div className="programs-grid">
          {PROGRAMS.map((p, i) => (
            <article
              key={p.title}
              className="program-card"
              data-reveal
              style={{ '--reveal-delay': `${i * 0.1}s` }}
            >
              <div className="program-image-wrap">
                <img src={p.image} alt={p.title} loading="lazy" />
                <div className="program-image-grad" aria-hidden="true" />
              </div>
              <div className="program-body">
                <span className="program-tag">{p.tag}</span>
                <h3 className="program-title">{p.title}</h3>
                <p className="program-blurb">{p.blurb}</p>
                <button type="button" className="program-cta" onClick={() => navigateToPage?.('register')}>
                  Explore plan {icon('arrow', 14)}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ================= WORKOUT TYPES ================= */}
      <section id="types" className="section section-types">
        <div className="section-header" data-reveal-stagger>
          <span className="section-eyebrow" data-reveal-item>Workout Types</span>
          <h2 className="section-title" data-reveal-item>
            Explore Our <span className="accent">Workout Types</span>
          </h2>
          <p className="section-sub" data-reveal-item>
            Find the perfect training style to match your fitness aspirations.
          </p>
        </div>

        <div className="types-grid">
          {WORKOUT_TYPES.map((t, i) => (
            <article
              key={t.title}
              className="type-card"
              data-reveal
              style={{ '--reveal-delay': `${i * 0.1}s` }}
            >
              <div className="type-icon-wrap" aria-hidden="true">
                <span className="type-icon-glow" />
                <span className="type-icon">{icon(t.iconName, 32)}</span>
              </div>
              <h3 className="type-title">{t.title}</h3>
              <p className="type-desc">{t.desc}</p>
              <div className="type-bars">
                {t.bars.map((bar, bi) => (
                  <div className="type-bar" key={bar.label}>
                    <div className="type-bar-head">
                      <span className="type-bar-label">{bar.label}</span>
                      <span className="type-bar-value">{bar.value}%</span>
                    </div>
                    <div className="type-bar-track">
                      <div
                        className="type-bar-fill"
                        style={{
                          '--bar-target': `${bar.value}%`,
                          '--bar-delay': `${0.2 + bi * 0.12}s`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how" className="section section-how">
        <div className="how-grid">
          <div className="how-copy">
            <div className="section-header section-header-left" data-reveal-stagger>
              <span className="section-eyebrow" data-reveal-item>How it works</span>
              <h2 className="section-title" data-reveal-item>
                From <span className="accent">First Set</span> to a Real Streak
              </h2>
              <p className="section-sub" data-reveal-item>
                Three steps. Zero noise. Built so the data does the talking.
              </p>
            </div>
            <ol className="how-steps">
              {STEPS.map((s, i) => (
                <li
                  key={s.num}
                  className="how-step"
                  data-reveal
                  style={{ '--reveal-delay': `${i * 0.08}s` }}
                >
                  <div className="how-step-num">{s.num}</div>
                  <div>
                    <h4>{s.title}</h4>
                    <p>{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className="btn btn-primary btn-glow" onClick={() => navigateToPage?.('register')}>
              {icon('zap', 18)} Try GymBuddy Free
            </button>
          </div>

          <div className="how-mockup-wrap" data-reveal>
            <div className="mockup-glow" aria-hidden="true" />
            <div className="phone-mockup" data-float="mockup">
              <div className="phone-notch" />
              <div className="phone-screen">
                <div className="mock-status">
                  <span>9:41</span>
                  <span className="mock-status-dots">
                    <i /><i /><i />
                  </span>
                </div>

                <div className="mock-card mock-session">
                  <div className="mock-row mock-row-between">
                    <div>
                      <div className="mock-label">Today</div>
                      <div className="mock-title">Push Power</div>
                    </div>
                    <div className="mock-pill">42:18</div>
                  </div>
                  <div className="mock-progress">
                    <div className="mock-progress-fill" />
                  </div>
                  <div className="mock-row mock-row-between mock-meta">
                    <span>4/6 sets</span>
                    <span className="mock-accent">On track 🔥</span>
                  </div>
                </div>

                <div className="mock-card mock-set">
                  <div className="mock-row mock-row-between">
                    <span className="mock-set-name">Bench Press</span>
                    <span className="mock-pill mock-pill-accent">PR</span>
                  </div>
                  <div className="mock-set-rows">
                    <div className="mock-set-row done">
                      <span>1</span><span>30 kg</span><span>8</span>
                      <span className="mock-check">{icon('check', 12)}</span>
                    </div>
                    <div className="mock-set-row done">
                      <span>2</span><span>30 kg</span><span>8</span>
                      <span className="mock-check">{icon('check', 12)}</span>
                    </div>
                    <div className="mock-set-row active">
                      <span>3</span><span>32.5 kg</span><span>—</span>
                      <span className="mock-dot" />
                    </div>
                  </div>
                </div>

                <div className="mock-card mock-chart">
                  <div className="mock-row mock-row-between">
                    <span className="mock-label">Strength Index</span>
                    <span className="mock-accent mock-trend">+12.4%</span>
                  </div>
                  <div className="mock-bars">
                    {[28, 42, 36, 58, 64, 72, 88].map((v, i) => (
                      <div
                        key={i}
                        className="mock-bar"
                        style={{ '--bar-h': `${v}%`, '--bar-i': i }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MEMBERSHIP CARD ================= */}
      <section id="card" className="section section-card">
        <div className="card-section-grid">
          <div className="card-section-copy">
            <div className="section-header section-header-left" data-reveal-stagger>
              <span className="section-eyebrow" data-reveal-item>Your Gym Pass</span>
              <h2 className="section-title" data-reveal-item>
                A <span className="accent">Premium</span> Membership Card —<br />Built for Champions
              </h2>
              <p className="section-sub" data-reveal-item>
                Every GymBuddy member gets their own VIP pass. Drag it, swing it, flip it — it&apos;s yours from day one.
              </p>
            </div>
            <ul className="card-feature-list" data-reveal>
              <li>{icon('check', 16)} Instant VIP status on signup</li>
              <li>{icon('check', 16)} Lifetime access to your training history</li>
              <li>{icon('check', 16)} Synced across every device, every session</li>
            </ul>
          </div>

          <div className="card-section-stage" data-reveal>
            <DeferredMembershipCard />
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="section section-cta">
        <div className="cta-card" data-reveal>
          <div className="cta-glow" aria-hidden="true" />
          <h2 className="section-title">
            Ready to <span className="accent">Transform</span>?
          </h2>
          <p className="section-sub" style={{ marginInline: 'auto' }}>
            Join thousands of athletes turning real reps into real progress.
          </p>
          <div className="cta-buttons">
            <button type="button" className="btn btn-primary btn-lg btn-glow" onClick={() => navigateToPage?.('register')}>
              {icon('zap', 20)} Get Started — It&apos;s Free
            </button>
            <button type="button" className="btn btn-glass btn-lg" onClick={() => navigateToPage?.('login')}>
              I have an account
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer landing-footer-v2">
        <div className="logo">
          <span className="logo-dot" /> GymBuddy
        </div>
        <span>© 2026 GymBuddy. Built for champions.</span>
      </footer>
    </div>
  );
}
