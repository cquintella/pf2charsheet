export interface ExportedCharacterPayload {
  format: 'pf2charsheet';
  version: 1;
  character: {
    name: string;
    level: number;
    ancestry: string;
    heritage: string;
    background: string;
    class: string;
    subclass: string;
    data: Record<string, unknown>;
  };
}

export interface ImportedCharacterInput {
  name: string;
  level: number;
  ancestry: string;
  heritage: string;
  background: string;
  class: string;
  subclass: string;
  data: Record<string, unknown>;
}

export function exportCharacterJson(character: ImportedCharacterInput): void {
  const payload: ExportedCharacterPayload = {
    format: 'pf2charsheet',
    version: 1,
    character,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (character.name || 'character')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'character';
  a.href = url;
  a.download = `${safeName}.pf2char.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedCharacterJson(rawText: string): ImportedCharacterInput {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid JSON object');
  }

  const candidate = (
    parsed.format === 'pf2charsheet' && parsed.character && typeof parsed.character === 'object'
      ? parsed.character
      : parsed
  ) as Record<string, unknown>;

  const name = typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : '';
  if (!name) {
    throw new Error('Missing character name');
  }

  let data: Record<string, unknown> | null = null;
  if (candidate.data && typeof candidate.data === 'object' && !Array.isArray(candidate.data)) {
    data = candidate.data as Record<string, unknown>;
  } else if (typeof candidate.data_json === 'string') {
    const inner = JSON.parse(candidate.data_json) as unknown;
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      data = inner as Record<string, unknown>;
    }
  }

  if (!data) {
    throw new Error('Missing character data');
  }

  const rawLevel = typeof candidate.level === 'number' ? candidate.level : 1;
  const level = Math.max(1, Math.min(20, Math.floor(rawLevel)));

  return {
    name,
    level,
    ancestry: typeof candidate.ancestry === 'string' ? candidate.ancestry : '',
    heritage: typeof candidate.heritage === 'string' ? candidate.heritage : '',
    background: typeof candidate.background === 'string' ? candidate.background : '',
    class: typeof candidate.class === 'string' ? candidate.class : '',
    subclass: typeof candidate.subclass === 'string' ? candidate.subclass : '',
    data,
  };
}
