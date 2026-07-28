/** Normalize event.target to an Element so `.closest` is safe (TEXT_NODE breaks otherwise). */
export function closestElement(raw: unknown): Element | null {
  if (!raw || typeof raw !== 'object') return null;
  let n: Node | null = raw as Node;
  while (n && !(n instanceof Element)) n = n.parentNode;
  return n instanceof Element ? n : null;
}
