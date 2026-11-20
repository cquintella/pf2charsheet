import { 
  SpellFilters, 
  SpellItem, 
  SpellMetadata, 
  Spellbook, 
  AncestryItem, 
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
  if (!res.ok) throw new Error('Falha ao salvar personagem');
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
