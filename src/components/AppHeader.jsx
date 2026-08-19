import { useEffect, useRef, useState } from 'react';

/**
 * Collapsing large-title header (iOS-style).
 *
 * At scroll 0 the large title (--text-3xl) sits in flow and scrolls away.
 * Past ~48px it collapses into a compact, centred sticky bar (--text-lg) with
 * a hairline border and frosted blur.
 *
 * The collapse is driven purely by an IntersectionObserver watching a sentinel
 * div — there is NO scroll listener and no per-frame work. The compact bar has
 * zero net layout height (negative margin in CSS), so pinning it never shifts
 * the content below.
 *
 * `eyebrow` is optional and preserves the existing gx-eyebrow chip so the
 * desktop rendering stays visually identical to the old page headers.
 *
 * @param {{ title: string, subtitle?: React.ReactNode, action?: React.ReactNode, eyebrow?: React.ReactNode }} props
 */
export default function AppHeader({ title, subtitle, action, eyebrow }) {
  const [collapsed, setCollapsed] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // `.app-header` is display:contents so the sticky bar's containing block is
  // the full-height page root (it stays pinned for the whole scroll, not just
  // while the header is on screen).
  return (
    <header className="app-header" data-collapsed={collapsed}>
      {/* Compact sticky bar — pinned at top, zero net layout height (see CSS).
          Decorative duplicate of the h1, hidden from assistive tech. */}
      <div className="app-header__bar" aria-hidden="true">
        <span className="app-header__bar-title">{title}</span>
      </div>

      {/* Large hero title — scrolls away under the bar. */}
      <div className="app-header__hero">
        {/* Crossing this point (~48px down) toggles the collapse. */}
        <span ref={sentinelRef} className="app-header__sentinel" aria-hidden="true" />
        <div className="app-header__hero-text">
          {eyebrow && <span className="gx-eyebrow">{eyebrow}</span>}
          <h1 className="app-header__title">{title}</h1>
          {subtitle && <p className="gx-subtitle">{subtitle}</p>}
        </div>
        {action && <div className="app-header__action">{action}</div>}
      </div>
    </header>
  );
}
