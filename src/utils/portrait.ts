import type { SavedCharacterRecord } from '../types/pf2e';

export type PortraitDbSource = 'portraitdb' | 'none';
const PORTRAIT_DB_STORAGE_KEY = 'pf2e_portrait_db';
const CUSTOM_PORTRAITS_STORAGE_KEY = 'pf2e_custom_portraits';

export const PORTRAIT_SEXES = ['Female', 'Male', 'Other'] as const;
export type PortraitSex = (typeof PORTRAIT_SEXES)[number];

export interface CustomPortraitEntry {
  path: string;
  species: string;
  sex: string;
  className: string;
}

export interface PortraitCriteria {
  readonly species: string;
  readonly sex: string;
  readonly search?: string;
}

/** Filters and queries portraits provided by an optional portrait plugin. */
export class PortraitGallery {
  constructor(private readonly portraits: readonly CustomPortraitEntry[]) {}

  get all(): readonly CustomPortraitEntry[] {
    return this.portraits;
  }

  get species(): string[] {
    return [...new Set(this.portraits.map((portrait) => portrait.species))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }

  matching(criteria: PortraitCriteria): CustomPortraitEntry[] {
    const query = (criteria.search ?? '').trim().toLowerCase();
    return this.portraits.filter((portrait) => {
      const speciesMatch =
        criteria.species === '' ||
        portrait.species.localeCompare(criteria.species, undefined, { sensitivity: 'base' }) === 0;
      const sexMatch =
        criteria.sex === '' ||
        portrait.sex.localeCompare(criteria.sex, undefined, { sensitivity: 'base' }) === 0;
      const searchMatch =
        query === '' ||
        portrait.species.toLowerCase().includes(query) ||
        portrait.className.toLowerCase().includes(query) ||
        portrait.path.toLowerCase().includes(query);
      return speciesMatch && sexMatch && searchMatch;
    });
  }

  defaultSpeciesFor(characterSpecies: string): string {
    return (
      this.species.find(
        (held) => held.localeCompare(characterSpecies, undefined, { sensitivity: 'base' }) === 0
      ) ?? ''
    );
  }
}

export function getSelectedPortraitDb(): PortraitDbSource {
  try {
    return localStorage.getItem(PORTRAIT_DB_STORAGE_KEY) === 'portraitdb' ? 'portraitdb' : 'none';
  } catch {
    return 'none';
  }
}

export function getLocalCustomPortraits(): CustomPortraitEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PORTRAITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CustomPortraitEntry =>
        Boolean(item) &&
        typeof (item as CustomPortraitEntry).path === 'string' &&
        typeof (item as CustomPortraitEntry).species === 'string' &&
        typeof (item as CustomPortraitEntry).sex === 'string'
    );
  } catch {
    return [];
  }
}

export function saveLocalCustomPortrait(entry: CustomPortraitEntry): void {
  try {
    const existing = getLocalCustomPortraits().filter((item) => item.path !== entry.path);
    const next = [...existing, entry].sort((a, b) =>
      a.species.localeCompare(b.species, undefined, { sensitivity: 'base' })
      || a.sex.localeCompare(b.sex, undefined, { sensitivity: 'base' })
    );
    localStorage.setItem(CUSTOM_PORTRAITS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore storage limits */
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
