import type { SavedCharacterRecord } from '../types/pf2e';

export type PortraitDbSource = 'portraitdb' | 'none';
const PORTRAIT_DB_STORAGE_KEY = 'pf2e_portrait_db';

export function getSelectedPortraitDb(): PortraitDbSource {
  try {
    return localStorage.getItem(PORTRAIT_DB_STORAGE_KEY) === 'none' ? 'none' : 'portraitdb';
  } catch {
    return 'portraitdb';
  }
}

export function setSelectedPortraitDb(value: PortraitDbSource): void {
  try {
    localStorage.setItem(PORTRAIT_DB_STORAGE_KEY, value);
  } catch {
    /* A escolha permanece ativa nesta sessão. */
  }
}

/** Reads the portrait URL or data URI stored inside a character's JSON payload. */
export function getCharacterPortrait(record: Pick<SavedCharacterRecord, 'data_json'> | null | undefined): string | undefined {
  if (!record?.data_json) return undefined;
  try {
    const parsed = JSON.parse(record.data_json) as { portrait?: unknown };
    return typeof parsed.portrait === 'string' && parsed.portrait.trim() !== '' ? parsed.portrait : undefined;
  } catch {
    return undefined;
  }
}

/** Normalizes gallery paths so both Vite dev (/portraits/...) and file:// builds resolve cleanly. */
export function resolvePortraitSrc(src: string | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  if (src.startsWith('/portraits/') && typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return `.${src}`;
  }
  return src;
}

/** Reads an image File into a data URL without resizing, for interactive cropping. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/**
 * Computes clamped pan limits and rendered dimensions for a square crop viewport.
 * At zoom = 1, the image covers the viewport (like CSS object-fit: cover).
 */
export function getPortraitCropMetrics(
  naturalWidth: number,
  naturalHeight: number,
  viewportSize: number,
  zoom: number,
  panX: number,
  panY: number
) {
  const safeW = Math.max(1, naturalWidth);
  const safeH = Math.max(1, naturalHeight);
  const baseScale = Math.max(viewportSize / safeW, viewportSize / safeH);
  const totalScale = baseScale * Math.max(1, zoom);
  const dispW = safeW * totalScale;
  const dispH = safeH * totalScale;
  const maxPanX = Math.max(0, (dispW - viewportSize) / 2);
  const maxPanY = Math.max(0, (dispH - viewportSize) / 2);
  const clampedX = Math.max(-maxPanX, Math.min(maxPanX, panX));
  const clampedY = Math.max(-maxPanY, Math.min(maxPanY, panY));
  const imgLeft = viewportSize / 2 + clampedX - dispW / 2;
  const imgTop = viewportSize / 2 + clampedY - dispH / 2;

  return {
    totalScale,
    dispW,
    dispH,
    maxPanX,
    maxPanY,
    panX: clampedX,
    panY: clampedY,
    imgLeft,
    imgTop,
  };
}

/** Renders the zoomed and panned square portrait region to a compact WebP/JPEG data URL. */
export function cropPortraitToSquare(
  src: string,
  viewportSize: number,
  zoom: number,
  panX: number,
  panY: number,
  outputSize = 256
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('Invalid image source.'));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable.'));
        return;
      }
      const m = getPortraitCropMetrics(
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
        viewportSize,
        zoom,
        panX,
        panY
      );
      const sx = Math.max(0, -m.imgLeft / m.totalScale);
      const sy = Math.max(0, -m.imgTop / m.totalScale);
      const sSide = viewportSize / m.totalScale;
      ctx.drawImage(img, sx, sy, sSide, sSide, 0, 0, outputSize, outputSize);
      const webp = canvas.toDataURL('image/webp', 0.85);
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = src;
  });
}

/** Resizes and center-crops an uploaded image file to a compact square data URL. */
export function compressPortraitFile(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        const webp = canvas.toDataURL('image/webp', 0.85);
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
