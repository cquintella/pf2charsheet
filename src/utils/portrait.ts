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
