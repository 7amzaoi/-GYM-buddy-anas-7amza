/**
 * Suspense fallback for route-level code splitting.
 *
 * Deliberately shaped like the screens it stands in for — a hero block, a stat
 * row, a couple of cards — so the swap to real content doesn't shift layout.
 * Pure CSS, no images, no JS: it must be in the app-shell chunk and cost
 * nothing to render.
 */
export default function PageSkeleton() {
  return (
    <div className="pskel" role="status" aria-busy="true" aria-label="Loading">
      <div className="pskel-hero" />
      <div className="pskel-row">
        <span className="pskel-stat" />
        <span className="pskel-stat" />
        <span className="pskel-stat" />
      </div>
      <div className="pskel-card" />
      <div className="pskel-card pskel-card-sm" />
      <span className="gx-sr-only">Loading…</span>
    </div>
  );
}
