import { 
  SpellFilters, 
  SpellItem, 
  SpellMetadata, 
  Spellbook, 
  AncestryItem, 
  HeritageItem,
  CreatureItem,
  BackgroundItem,  
  ClassItem,
  FeatItem,
  FeatFilters,
  FeatMetadata
} from '../types/pf2e';

export interface SpellIconOption {
  filename: string;
  name: string;
  path: string;
  url: string;
}

export async function fetchSpellMetadata(): Promise<SpellMetadata> {
  const res = await fetch('/api/metadata');
  if (!res.ok) throw new Error('Falha ao obter metadados de magias');
  return res.json();
}

export async function fetchSpells(
  filters: SpellFilters, 
  favoriteIds?: string[]
): Promise<{ total: number; spells: SpellItem[] }> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.rank && filters.rank !== 'all') params.set('rank', filters.rank);
  if (filters.tradition && filters.tradition !== 'all') params.set('tradition', filters.tradition);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.defense && filters.defense !== 'all') params.set('defense', filters.defense);
  if (filters.actions && filters.actions !== 'all') params.set('actions', filters.actions);
  if (filters.trait && filters.trait !== 'all') params.set('trait', filters.trait);
  if (filters.rarity && filters.rarity !== 'all') params.set('rarity', filters.rarity);
  if (filters.onlyFavorites) {
    params.set('ids', (favoriteIds || []).join(','));
  }
  params.set('limit', String(filters.limit));
  params.set('offset', String(filters.offset));

  const res = await fetch(`/api/spells?${params.toString()}`);
  if (!res.ok) throw new Error('Falha ao buscar magias');
  return res.json();
}

export async function fetchSpellById(id: string): Promise<SpellItem> {
  const res = await fetch(`/api/spells/${id}`);
  if (!res.ok) throw new Error(`Magia ${id} nao encontrada`);
  return res.json();
}

export interface CatalogEntryInput {
  name: string; level: number; rarity: string; traits: string[]; description: string; source: string; systemJson: string;
  itemType?: string; price?: string; bulk?: string; category?: string; traditions?: string[];
  time?: string; range?: string; target?: string; area?: string; duration?: string; defense?: string;
}

export async function saveCatalogEntry(type: 'spell' | 'equipment', data: CatalogEntryInput, id?: string): Promise<{ id: string }> {
  const path = type === 'spell' ? 'spells' : 'equipment';
  const res = await fetch(`/api/${path}${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!res.ok) throw new Error('Failed to save entry');
  return res.json();
}

export async function deleteCatalogEntry(type: 'spell' | 'equipment', id: string): Promise<void> {
  const res = await fetch(`/api/${type === 'spell' ? 'spells' : 'equipment'}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete entry');
}

export async function fetchSpellIcons(): Promise<SpellIconOption[]> {
  const res = await fetch('/api/icons/spells');
  if (!res.ok) throw new Error('Falha ao listar ícones de magias');
  return res.json();
}

export async function updateSpellIcon(id: string, imgPath: string): Promise<{ success: boolean; img: string }> {
  const res = await fetch(`/api/spells/${id}/icon`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ img: imgPath })
  });
  if (!res.ok) throw new Error('Falha ao atualizar ícone da magia');
  return res.json();
}

export async function fetchSpellbooks(): Promise<Spellbook[]> {
  const res = await fetch('/api/spellbooks');
  if (!res.ok) throw new Error('Falha ao listar grimórios');
  return res.json();
}

export async function fetchSpellbookById(id: string): Promise<Spellbook> {
  const res = await fetch(`/api/spellbooks/${id}`);
  if (!res.ok) throw new Error(`Grimório ${id} não encontrado`);
  return res.json();
}

export async function createSpellbook(data: Partial<Spellbook>): Promise<{ success: boolean; id: string }> {
  const res = await fetch('/api/spellbooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Falha ao criar grimório');
  return res.json();
}

export async function updateSpellbook(id: string, data: Partial<Spellbook>): Promise<{ success: boolean }> {
  const res = await fetch(`/api/spellbooks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Falha ao salvar grimório');
  return res.json();
}

export async function deleteSpellbook(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/spellbooks/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Falha ao excluir grimório');
  return res.json();
}

// Feats (Talentos) APIs
export async function fetchSources(): Promise<string[]> {
  const res = await fetch('/api/sources');
  if (!res.ok) throw new Error('Failed to load sources');
  return res.json();
}

export type SourceEdition = '' | '1e' | '2e' | '2r';
export interface SourceRecord { name: string; edition: SourceEdition }
export async function fetchSourceRecords(): Promise<SourceRecord[]> {
  const res = await fetch('/api/sources?details=1');
  if (!res.ok) throw new Error('Failed to load sources');
  return res.json();
}

export async function createSource(name: string, edition: SourceEdition): Promise<void> {
  const res = await fetch('/api/sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, edition }) });
  if (!res.ok) throw new Error('Failed to create source');
}

export async function changeSource(previousName: string, name: string, edition: SourceEdition): Promise<void> {
  const res = await fetch('/api/sources', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previousName, name, edition }) });
  if (!res.ok) throw new Error('Failed to update source');
}

export async function deleteSource(previousName: string): Promise<void> {
  const res = await fetch('/api/sources', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previousName }) });
  if (!res.ok) throw new Error('Failed to delete source');
}

export interface FeatInput {
  name: string;
  category: string;
  level: number;
  rarity: string;
  action_type: string;
  actions: string;
  traits: string[];
  prerequisites: string[];
  description: string;
  source: string;
}

export async function saveFeat(data: FeatInput, id?: string): Promise<{ id: string }> {
  const res = await fetch(id ? `/api/feats/${encodeURIComponent(id)}` : '/api/feats', {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save feat');
  return res.json();
}

export async function deleteFeat(id: string): Promise<void> {
  const res = await fetch(`/api/feats/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete feat');
}

export async function fetchFeatMetadata(): Promise<FeatMetadata> {
  const res = await fetch('/api/metadata/feats');
  if (!res.ok) throw new Error('Falha ao obter metadados de talentos');
  return res.json();
}

export async function fetchFeats(
  filters: FeatFilters,
  favoriteIds?: string[]
): Promise<{ total: number; feats: FeatItem[] }> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.level && filters.level !== 'all') params.set('level', filters.level);
  if (filters.max_level && filters.max_level !== 'all') params.set('max_level', filters.max_level);
  if (filters.action_type && filters.action_type !== 'all') params.set('action_type', filters.action_type);
  if (filters.actions && filters.actions !== 'all') params.set('actions', filters.actions);
  if (filters.rarity && filters.rarity !== 'all') params.set('rarity', filters.rarity);
  if (filters.trait && filters.trait !== 'all') params.set('trait', filters.trait);
  if (filters.onlyFavorites) {
    params.set('ids', (favoriteIds || []).join(','));
  }
  params.set('limit', String(filters.limit));
  params.set('offset', String(filters.offset));

  const res = await fetch(`/api/feats?${params.toString()}`);
  if (!res.ok) throw new Error('Falha ao buscar talentos');
  return res.json();
}

export async function fetchFeatById(id: string): Promise<FeatItem> {
  const res = await fetch(`/api/feats/${id}`);
  if (!res.ok) throw new Error(`Talento ${id} não encontrado`);
  return res.json();
}

// Character Creator & Compendium APIs
export async function fetchAncestries(): Promise<AncestryItem[]> {
  const res = await fetch('/api/ancestries');
  if (!res.ok) throw new Error('Falha ao obter ancestralidades');
  return res.json();
}

export async function fetchHeritages(ancestrySlug?: string): Promise<HeritageItem[]> {
  const query = ancestrySlug ? `?ancestry=${encodeURIComponent(ancestrySlug)}` : '';
  const res = await fetch(`/api/heritages${query}`);
  if (!res.ok) throw new Error('Falha ao obter heranças');
  return res.json();
}

export async function fetchCreatures(filters: {
  search?: string;
  letter?: string;
  level?: string;
  size?: string;
  rarity?: string;
  trait?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ total: number; creatures: CreatureItem[] }> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.letter && filters.letter !== 'all') params.set('letter', filters.letter);
  if (filters.level && filters.level !== 'all') params.set('level', filters.level);
  if (filters.size && filters.size !== 'all') params.set('size', filters.size);
  if (filters.rarity && filters.rarity !== 'all') params.set('rarity', filters.rarity);
  if (filters.trait && filters.trait !== 'all') params.set('trait', filters.trait);
  params.set('limit', String(filters.limit ?? 48));
  params.set('offset', String(filters.offset ?? 0));
  const res = await fetch(`/api/creatures?${params.toString()}`);
  if (!res.ok) throw new Error('Falha ao buscar criaturas');
  return res.json();
}

export async function fetchBackgrounds(): Promise<BackgroundItem[]> {
  const res = await fetch('/api/backgrounds');
  if (!res.ok) throw new Error('Falha ao obter antecedentes');
  return res.json();
}

export async function fetchClasses(): Promise<ClassItem[]> {
  const res = await fetch('/api/classes');
  if (!res.ok) throw new Error('Falha ao obter classes');
  return res.json();
}

export async function fetchCharacters(): Promise<any[]> {
  const res = await fetch('/api/characters');
  if (!res.ok) throw new Error('Falha ao listar personagens');
  return res.json();
}

export async function saveCharacter(data: any): Promise<{ success: boolean; id: string }> {
  const res = await fetch('/api/characters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    let detail = '';
    try {
      const errBody = await res.json() as { error?: string };
      if (errBody?.error) detail = errBody.error;
    } catch { /* ignore */ }
    throw new Error(detail ? `Falha ao salvar personagem: ${detail}` : 'Falha ao salvar personagem');
  }
  return res.json();
}

export async function deleteCharacter(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/characters/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Falha ao remover personagem');
  return res.json();
}

export async function fetchEquipment(search: string, type: string, offset: number, options?: { level?: string; rarity?: string; ids?: string[]; initial?: string }): Promise<{ items: import('../types/pf2e').EquipmentItem[]; total: number }> {
  const params = new URLSearchParams({ search, type, offset: String(offset) });
  if (options?.initial) params.set('initial', options.initial);
  if (options?.level && options.level !== 'all') params.set('level', options.level);
  if (options?.rarity && options.rarity !== 'all') params.set('rarity', options.rarity);
  if (options?.ids) params.set('ids', options.ids.join(','));
  const res = await fetch(`/api/equipment?${params}`);
  if (!res.ok) throw new Error('Falha ao buscar equipamentos');
  return res.json();
}

export interface PortraitDbEntry {
  path: string;
  species: string;
  sex: string;
  className: string;
}

export interface PortraitPluginResponse {
  available: boolean;
  id: string;
  label: string;
  portraits: PortraitDbEntry[];
}

export async function fetchPortraitPlugin(): Promise<PortraitPluginResponse> {
  const res = await fetch('/api/portraitdb/plugin');
  if (!res.ok) return { available: false, id: 'portraitdb', label: 'portraitdb', portraits: [] };
  return res.json();
}

export async function fetchCustomPortraits(): Promise<PortraitDbEntry[]> {
  const res = await fetch('/api/portraitdb');
  if (!res.ok) return [];
  return res.json();
}

export async function addCustomPortrait(data: { dataUrl: string; species: string; sex: string }): Promise<{ success: boolean; item: PortraitDbEntry }> {
  const res = await fetch('/api/portraitdb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add portrait to portraitdb');
  return res.json();
}
