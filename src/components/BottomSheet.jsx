import { useCallback, useEffect, useRef } from 'react';
import { icon } from '../icons.jsx';

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(max-width: 768px)').matches;
// Fade (no slide) on desktop and for reduced-motion users.
const noSlide = () => reducedMotion() || !isMobile();

/**
 * BottomSheet — a mobile bottom sheet built on the native <dialog> element
 * (focus trapping, Esc, and focus-return-to-trigger come for free).
 *
 * - Slides up from the bottom; drag the handle down to dismiss (pointer events
 *   only). Past 40% of its height or a fast flick closes; otherwise it springs
 *   back. The backdrop opacity tracks the drag.
 * - Content scrolls internally; the sheet never exceeds
 *   calc(100dvh - var(--safe-top) - var(--space-8)).
 * - Locks background scroll while open (iOS-safe position technique) and
 *   restores the exact scroll position on close.
 * - prefers-reduced-motion → fade, no slide.
 * - At >=769px a CSS switch renders it as a centred dialog (see _bottom-sheet.css).
 *
 * Props: open, onClose, title, children, snapPoints? (single snap for now).
 */
export default function BottomSheet({ open, onClose, title, children }) {
  const dialogRef = useRef(null);
  const panelRef = useRef(null);
  const drag = useRef({ active: false, startY: 0, startT: 0, height: 0, pointerId: null });
  // True while WE are closing the dialog because `open` went false (parent-driven),
  // so the native 'close' handler doesn't call onClose a second time.
  const programmatic = useRef(false);

  const setDrag = (v) => dialogRef.current?.style.setProperty('--sheet-drag', String(v));

  // ---- background scroll lock (iOS-safe: position:fixed keeps scroll pos) ----
  const lockScroll = useCallback(() => {
    const y = window.scrollY || 0;
    document.body.dataset.sheetScrollY = String(y);
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    // The app's mobile scroll container is .main-content, not the document —
    // freeze it too (scrollTop is preserved across overflow toggles).
    const scroller = document.querySelector('.main-content');
    if (scroller) scroller.style.overflow = 'hidden';
  }, []);

  const unlockScroll = useCallback(() => {
    const y = parseInt(document.body.dataset.sheetScrollY || '0', 10);
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    delete document.body.dataset.sheetScrollY;
    const scroller = document.querySelector('.main-content');
    if (scroller) scroller.style.overflow = '';
    window.scrollTo(0, y);
  }, []);

  const animateOpen = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (noSlide()) {
      // Fade in, no slide (desktop / reduced-motion).
      panel.style.transform = 'none';
      panel.style.opacity = '0';
      panel.getBoundingClientRect(); // reflow
      requestAnimationFrame(() => {
        panel.style.transition = 'opacity var(--dur-base) var(--ease-std)';
        panel.style.opacity = '1';
        setDrag(1);
      });
      return;
    }
    panel.style.transition = 'none';
    panel.style.transform = 'translateY(100%)';
    panel.getBoundingClientRect(); // force reflow
    requestAnimationFrame(() => {
      panel.style.transition = '';
      panel.style.transform = 'translateY(0)';
      setDrag(1);
    });
  }, []);

  // Animate out (slide on mobile, fade elsewhere), then close the dialog.
  const closeWithAnim = useCallback(() => {
    const dlg = dialogRef.current;
    const panel = panelRef.current;
    if (!dlg || !dlg.open) return;
    setDrag(0);
    if (!panel) {
      dlg.close();
      return;
    }
    const fade = noSlide();
    panel.style.transition = `${fade ? 'opacity' : 'transform'} var(--dur-base) var(--ease-in)`;
    if (fade) panel.style.opacity = '0';
    else panel.style.transform = 'translateY(100%)';
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      panel.removeEventListener('transitionend', finish);
      if (dlg.open) dlg.close();
    };
    panel.addEventListener('transitionend', finish);
    setTimeout(finish, 400); // safety net
  }, []);

  // Open / close the native dialog when `open` changes.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      lockScroll();
      setDrag(0);
      dlg.showModal();
      animateOpen();
    } else if (!open && dlg.open) {
      programmatic.current = true;
      closeWithAnim();
    }
  }, [open, lockScroll, animateOpen, closeWithAnim]);

  // Single close path: fires for drag/Esc/backdrop/button and programmatic close.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return undefined;
    const onNativeClose = () => {
      unlockScroll();
      if (panelRef.current) {
        panelRef.current.style.transform = '';
        panelRef.current.style.opacity = '';
        panelRef.current.style.transition = '';
      }
      if (programmatic.current) programmatic.current = false;
      else onClose?.();
    };
    // Animate Esc instead of the instant native dismiss.
    const onCancel = (e) => {
      e.preventDefault();
      closeWithAnim();
    };
    dlg.addEventListener('close', onNativeClose);
    dlg.addEventListener('cancel', onCancel);
    return () => {
      dlg.removeEventListener('close', onNativeClose);
      dlg.removeEventListener('cancel', onCancel);
    };
  }, [onClose, unlockScroll, closeWithAnim]);

  // Clean up the scroll lock if we unmount while open.
  useEffect(() => () => {
    if (document.body.dataset.sheetScrollY !== undefined) unlockScroll();
  }, [unlockScroll]);

  // ---- pointer drag-to-dismiss (mobile only) ----
  const onPointerDown = (e) => {
    if (!isMobile()) return; // desktop = centred dialog, no drag
    const panel = panelRef.current;
    drag.current = {
      active: true,
      startY: e.clientY,
      startT: performance.now(),
      height: panel.getBoundingClientRect().height || 1,
      pointerId: e.pointerId,
    };
    panel.style.transition = 'none';
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.active) return;
    const dy = Math.max(0, e.clientY - d.startY);
    panelRef.current.style.transform = `translateY(${dy}px)`;
    setDrag(Math.max(0, 1 - dy / d.height));
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const dy = Math.max(0, e.clientY - d.startY);
    const velocity = dy / Math.max(1, performance.now() - d.startT); // px/ms
    const panel = panelRef.current;
    panel.style.transition = '';
    try { e.currentTarget.releasePointerCapture(d.pointerId); } catch { /* ignore */ }
    if (dy > 0.4 * d.height || velocity > 0.6) {
      closeWithAnim();
    } else {
      panel.style.transform = 'translateY(0)';
      setDrag(1);
    }
  };

  const onBackdropClick = (e) => {
    if (e.target === dialogRef.current) closeWithAnim(); // click outside the panel
  };

  return (
    <dialog ref={dialogRef} className="sheet" onClick={onBackdropClick}>
      <div className="sheet__panel" ref={panelRef} role="document">
        <div
          className="sheet__grabber"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="sheet__handle" aria-hidden="true" />
          <div className="sheet__head">
            {title ? <h2 className="sheet__title">{title}</h2> : <span />}
            <button type="button" className="sheet__close" onClick={closeWithAnim} aria-label="Close">
              {icon('x', 18)}
            </button>
          </div>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </dialog>
  );
}
