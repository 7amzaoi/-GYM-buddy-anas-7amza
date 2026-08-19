import { photo, photoAlt } from '../lib/imagery.js';
import { icon } from '../icons.jsx';

/**
 * PhotoFrame — the athletic-editorial photo primitive.
 *
 * Renders a named photo slot (see lib/imagery.js) with the shared dark grade
 * and legibility scrim. When the slot has no file yet it falls back to the
 * designed treatment in `.m1-photo` plus a ghosted glyph, so the composition
 * holds either way — no broken-image boxes, no invented stock art.
 *
 * Props:
 *   slot      — PhotoSlot key from lib/imagery
 *   as        — element/tag to render ('div' by default; 'button' for tappable tiles)
 *   ghost     — icon key for the fallback glyph (default 'dumbbell')
 *   className — extra classes; `.m1-photo` is always applied
 */
export default function PhotoFrame({
  slot,
  as: Tag = 'div',
  ghost = 'dumbbell',
  className = '',
  children,
  ...rest
}) {
  const src = photo(slot);
  return (
    <Tag className={`m1-photo ${className}`.trim()} {...rest}>
      {src ? (
        <img src={src} alt={photoAlt(slot)} loading="lazy" decoding="async" />
      ) : (
        <span className="m1-photo-ghost" aria-hidden="true">{icon(ghost, 160)}</span>
      )}
      {children}
    </Tag>
  );
}
