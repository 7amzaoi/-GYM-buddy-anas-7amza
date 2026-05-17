/** Normalize event.target to an Element so `.closest` is safe (TEXT_NODE breaks otherwise). */
export function closestElement(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let n = /** @type {Node} */ (raw);
  while (n && !(n instanceof Element)) n = /** @type {Node} */ (n).parentNode;
  return n instanceof Element ? n : null;
}
