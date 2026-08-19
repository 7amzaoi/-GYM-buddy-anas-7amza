import { useRef } from 'react';

/**
 * Static stand-in for the WebGL membership card.
 *
 * The 3D version pulls in three + @react-three/fiber + drei + rapier + meshline
 * (~2.4 MB) and runs a rope physics simulation every frame. That is a bad trade
 * on a phone GPU, for users who asked for less motion, and on low-core devices —
 * so those get this instead: the same artwork as a plain <img> with a cheap
 * pointer-driven tilt (transform only, no layout, no WebGL).
 *
 * Nothing is removed — the 3D card still renders everywhere else.
 */
export default function StaticMembershipCard() {
  const ref = useRef(null);

  // Tilt is transform-only and skipped entirely on coarse pointers.
  function onMove(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--tilt-y', `${px * 14}deg`);
    el.style.setProperty('--tilt-x', `${-py * 14}deg`);
  }
  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--tilt-y', '0deg');
    el.style.setProperty('--tilt-x', '0deg');
  }

  return (
    <div className="lanyard-wrapper landing-lanyard smc-wrap">
      <div
        ref={ref}
        className="smc"
        onPointerMove={onMove}
        onPointerLeave={reset}
      >
        <span className="smc-strap" aria-hidden="true" />
        <img
          className="smc-card"
          src="/membership-card.png"
          alt="GymBuddy membership card"
          loading="lazy"
          decoding="async"
          width="420"
          height="620"
        />
      </div>
    </div>
  );
}
