/**
 * TypeScript twin of imageCrop.js — the runtime imports the `.js`, this exists
 * so `npm run typecheck` covers the module. Change one, mirror the other.
 *
 * Circular avatar crop — native canvas, no library. Pointer-drag to pan, wheel
 * or pinch to zoom, bounded so the image can never leave the circular mask.
 * Confirming rasterises the visible circle into a 512x512 offscreen canvas and
 * exports WEBP (PNG where canvas can't encode WEBP).
 */

/** Hard ceiling on input size, before any decoding happens. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** Exported avatar edge length, in px. */
export const OUTPUT_SIZE = 512;

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const WEBP_QUALITY = 0.85;

export interface CropView {
  x: number;
  y: number;
  zoom: number;
  size: number;
}

export interface CropControls {
  confirm: () => Promise<void>;
  cancel: () => void;
  getZoom: () => number;
  setZoom: (rel: number) => void;
  minZoom: number;
  maxZoom: number;
}

export interface CropSessionOptions {
  mount?: HTMLElement | null;
  onReady?: (controls: CropControls) => void;
}

export interface CropResult {
  blob: Blob;
  previewUrl: string;
}

/**
 * Guard the file before we spend anything decoding it.
 * @returns a user-facing message, or null when the file is fine.
 */
export function validateImageFile(file: File | null): string | null {
  if (!file) return 'No file selected.';
  if (!String(file.type || '').startsWith('image/')) {
    return 'That file isn’t an image. Choose a JPG, PNG or WEBP.';
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `That image is ${mb} MB. Choose one under 8 MB.`;
  }
  return null;
}

function loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject('That image couldn’t be opened. It may be corrupt.');
    };
    img.src = url;
  });
}

/**
 * Export the visible circle at OUTPUT_SIZE. `destination-in` composites the
 * circle as an alpha mask, so corners are transparent rather than black.
 */
function exportCircle(img: HTMLImageElement, view: CropView): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const out = document.createElement('canvas');
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext('2d');
    if (!ctx) {
      reject('This browser can’t process images.');
      return;
    }

    const scale = OUTPUT_SIZE / view.size;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      img,
      view.x * scale,
      view.y * scale,
      img.naturalWidth * view.zoom * scale,
      img.naturalHeight * view.zoom * scale
    );

    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    out.toBlob(
      (blob) => {
        if (blob && blob.type === 'image/webp') {
          resolve(blob);
          return;
        }
        out.toBlob(
          (png) => (png ? resolve(png) : reject('Could not save the cropped image.')),
          'image/png'
        );
      },
      'image/webp',
      WEBP_QUALITY
    );
  });
}

/**
 * Start an interactive crop. The canvas is built inside `options.mount` so the
 * crop lives inline in the calling component; Save/Cancel are the caller's own
 * buttons, delivered through `options.onReady(controls)`.
 *
 * Rejects with a user-facing string.
 */
export function openCropSession(
  file: File,
  options: CropSessionOptions = {}
): Promise<CropResult> {
  const invalid = validateImageFile(file);
  if (invalid) return Promise.reject(invalid);

  return new Promise<CropResult>((resolve, reject) => {
    let cleanup: () => void = () => {};

    loadImage(file)
      .then(({ img, url }) => {
        const mount = options.mount;
        if (!mount) {
          URL.revokeObjectURL(url);
          reject('Nowhere to show the cropper.');
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.className = 'avpick-canvas';
        canvas.setAttribute('role', 'application');
        canvas.setAttribute(
          'aria-label',
          'Crop your photo. Drag to reposition, pinch or scroll to zoom.'
        );
        mount.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject('This browser can’t process images.');
          return;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const size = Math.max(200, Math.min(mount.clientWidth || 280, 320));
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        ctx.scale(dpr, dpr);

        const baseScale = Math.max(size / img.naturalWidth, size / img.naturalHeight);

        const view: CropView = { x: 0, y: 0, zoom: baseScale, size };
        view.x = (size - img.naturalWidth * view.zoom) / 2;
        view.y = (size - img.naturalHeight * view.zoom) / 2;

        function clamp(): void {
          const w = img.naturalWidth * view.zoom;
          const h = img.naturalHeight * view.zoom;
          view.x = Math.min(0, Math.max(size - w, view.x));
          view.y = Math.min(0, Math.max(size - h, view.y));
        }

        function draw(): void {
          if (!ctx) return;
          ctx.clearRect(0, 0, size, size);
          ctx.save();
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(
            img,
            view.x,
            view.y,
            img.naturalWidth * view.zoom,
            img.naturalHeight * view.zoom
          );
          ctx.restore();
        }

        clamp();
        draw();

        function zoomTo(nextRelative: number, originX: number, originY: number): void {
          const clampedRel = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextRelative));
          const next = baseScale * clampedRel;
          if (next === view.zoom) return;
          const ratio = next / view.zoom;
          view.x = originX - (originX - view.x) * ratio;
          view.y = originY - (originY - view.y) * ratio;
          view.zoom = next;
          clamp();
          draw();
        }

        const points = new Map<number, { x: number; y: number }>();
        let last: { x: number; y: number } | null = null;
        let pinchStart: { dist: number; rel: number } | null = null;

        const onPointerDown = (e: PointerEvent): void => {
          points.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
          canvas.setPointerCapture(e.pointerId);
          if (points.size === 1) last = { x: e.offsetX, y: e.offsetY };
          if (points.size === 2) {
            const [a, b] = [...points.values()];
            pinchStart = {
              dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
              rel: view.zoom / baseScale,
            };
          }
        };

        const onPointerMove = (e: PointerEvent): void => {
          if (!points.has(e.pointerId)) return;
          points.set(e.pointerId, { x: e.offsetX, y: e.offsetY });

          if (points.size >= 2 && pinchStart) {
            const [a, b] = [...points.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
            zoomTo(pinchStart.rel * (dist / pinchStart.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
            return;
          }

          if (last) {
            view.x += e.offsetX - last.x;
            view.y += e.offsetY - last.y;
            last = { x: e.offsetX, y: e.offsetY };
            clamp();
            draw();
          }
        };

        const onPointerUp = (e: PointerEvent): void => {
          points.delete(e.pointerId);
          try {
            canvas.releasePointerCapture(e.pointerId);
          } catch {
            /* already gone */
          }
          if (points.size < 2) pinchStart = null;
          last = points.size === 1 ? [...points.values()][0] : null;
        };

        const onWheel = (e: WheelEvent): void => {
          e.preventDefault();
          const rel = view.zoom / baseScale;
          zoomTo(rel * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.offsetX, e.offsetY);
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });

        cleanup = () => {
          canvas.removeEventListener('pointerdown', onPointerDown);
          canvas.removeEventListener('pointermove', onPointerMove);
          canvas.removeEventListener('pointerup', onPointerUp);
          canvas.removeEventListener('pointercancel', onPointerUp);
          canvas.removeEventListener('wheel', onWheel);
          canvas.remove();
          URL.revokeObjectURL(url);
        };

        const controls: CropControls = {
          async confirm() {
            try {
              const blob = await exportCircle(img, view);
              cleanup();
              resolve({ blob, previewUrl: URL.createObjectURL(blob) });
            } catch (err) {
              cleanup();
              reject(typeof err === 'string' ? err : 'Could not save the cropped image.');
            }
          },
          cancel() {
            cleanup();
            reject('cancelled');
          },
          getZoom: () => view.zoom / baseScale,
          setZoom: (rel: number) => zoomTo(rel, size / 2, size / 2),
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        };

        options.onReady?.(controls);
      })
      .catch((err) => {
        cleanup();
        reject(typeof err === 'string' ? err : 'That image couldn’t be opened.');
      });
  });
}
