import {
  AncestryItem,
  AttributeKey,
  BackgroundItem,
  CharacterABCState,
  CharacterCompanion,
  CharacterInventory,
  CharacterSpellcastingState,
  CharacterStrike,
  ClassItem,
  EquipmentItem,
  FeatItem,
  FeatSelectionRecord,
  HeritageItem,
  InventoryEntry,
  LevelProgressionData,
  LoreSkillEntry,
  ProficiencyRank,
  SkillKey,
  VisionType,
} from '../types/pf2e';
import {
  fetchAncestries,
  fetchBackgrounds,
  fetchClasses,
  fetchEquipment,
  fetchFeats,
  fetchHeritages,
} from '../services/api';
import { CharacterAppearance, CharacterDetails } from './characterDetails';
import { DEFAULT_SESSION_STATE, SessionState } from './conditions';
import { ALL_SKILLS, getProficiencyBonus } from './formatters';
import { PSYCHIC_MIND_ATTRIBUTES, psychicSlotsForLevel } from './psychic';
import { computeInitialSkillBudget, deriveDefaultLoreSkills } from './skills';

const ALL_ATTRIBUTES: readonly AttributeKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const ATTR_CAP: Record<AttributeKey, string> = {
  str: 'Str',
  dex: 'Dex',
  con: 'Con',
  int: 'Int',
  wis: 'Wis',
  cha: 'Cha',
};

const SIZE_MAP: Record<string, { size: number; sizeName: string }> = {
  tiny: { size: 0, sizeName: 'Tiny' },
  sm: { size: 1, sizeName: 'Small' },
  small: { size: 1, sizeName: 'Small' },
  med: { size: 2, sizeName: 'Medium' },
  medium: { size: 2, sizeName: 'Medium' },
  lg: { size: 3, sizeName: 'Large' },
  large: { size: 3, sizeName: 'Large' },
  huge: { size: 4, sizeName: 'Huge' },
  grg: { size: 5, sizeName: 'Gargantuan' },
};

export interface PathbuilderWeapon {
  name: string;
  qty: number;
  prof: string;
  die: string;
  pot: number;
  str: string;
  mat: string | null;
  display: string;
  runes: string[];
  damageType: string;
  attack: number;
  damageBonus: number;
  extraDamage: string[];
  increasedDice: boolean;
  isInventor: boolean;
  grade: string;
}

export interface PathbuilderArmor {
  name: string;
  qty: number;
  prof: string;
  pot: number;
  res: string;
  mat: string | null;
  display: string;
  worn: boolean;
  runes: string[];
  grade: string;
}

export interface PathbuilderSpellCaster {
  name: string;
  magicTradition: string;
  spellcastingType: string;
  ability: string;
  proficiency: number;
  focusPoints: number;
  innate: boolean;
  perDay: number[];
  spells: Array<{ spellLevel: number; list: string[] }>;
  prepared: unknown[];
  blendedSpells: unknown[];
}

export interface PathbuilderFocusEntry {
  abilityBonus: number;
  proficiency: number;
  itemBonus: number;
  focusCantrips: string[];
  focusSpells: string[];
}

export type PathbuilderFeatTuple = [
  string,
  string | null,
  string,
  number,
  string,
  string,
  string | null,
];

export interface PathbuilderBuild {
  name: string;
  class: string;
  dualClass: string | null;
  level: number;
  xp: number;
  ancestry: string;
  heritage: string;
  background: string;
  alignment: string;
  gender: string;
  age: string;
  deity: string;
  size: number;
  sizeName: string;
  keyability: string;
  languages: string[];
  rituals: unknown[];
  resistances: string[];
  inventorMods: unknown[];
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
    breakdown: {
      ancestryFree: string[];
      ancestryBoosts: string[];
      ancestryFlaws: string[];
      backgroundBoosts: string[];
      classBoosts: string[];
      mapLevelledBoosts: Record<string, string[]>;
    };
  };
  attributes: {
    ancestryhp: number;
    classhp: number;
    bonushp: number;
    bonushpPerLevel: number;
    speed: number;
    speedBonus: number;
  };
  proficiencies: Record<string, number>;
  mods: Record<string, unknown>;
  feats: PathbuilderFeatTuple[];
  specials: string[];
  lores: Array<[string, number]>;
  equipmentContainers: Record<string, unknown>;
  equipment: Array<[string, number] | [string, number, string]>;
  specificProficiencies: {
    trained: string[];
    expert: string[];
    master: string[];
    legendary: string[];
  };
  weapons: PathbuilderWeapon[];
  money: { pp: number; gp: number; sp: number; cp: number };
  armor: PathbuilderArmor[];
  spellCasters: PathbuilderSpellCaster[];
  focusPoints: number;
  focus: Record<string, Record<string, PathbuilderFocusEntry>>;
  formula: string[];
  acTotal: {
    acProfBonus: number;
    acAbilityBonus: number;
    acItemBonus: number;
    acTotal: number;
    shieldBonus: string;
  };
  pets: unknown[];
  familiars: unknown[];
}

export interface PathbuilderExportPayload {
  success: true;
  build: PathbuilderBuild;
}

export interface ExportCharacterJsonInput {
  name: string;
  level: number;
  ancestry: AncestryItem | null;
  heritage: HeritageItem | null;
  background: BackgroundItem | null;
  selectedClass: ClassItem | null;
  subclass: string;
  consciousMindName?: string;
  charState: Partial<CharacterABCState>;
  currentAttributes: Record<AttributeKey, number>;
  appearance: CharacterAppearance;
  xp: number;
  languages: string;
  hpStats: {
    ancestryHp: number;
    baseClassHp: number;
    bonusPerLevel?: number;
  };
  speed: number;
  acTotal: number;
  acProfRank: ProficiencyRank;
  acItemBonus: number;
  shieldBonus?: number;
  proficiencies: {
    perception: ProficiencyRank;
    fortitude: ProficiencyRank;
    reflex: ProficiencyRank;
    will: ProficiencyRank;
    spellcasting: ProficiencyRank;
    simple: ProficiencyRank;
    martial: ProficiencyRank;
    advanced: ProficiencyRank;
    unarmed: ProficiencyRank;
    unarmored: ProficiencyRank;
    light: ProficiencyRank;
    medium: ProficiencyRank;
    heavy: ProficiencyRank;
  };
  skillRanks: Record<SkillKey, ProficiencyRank>;
  loreSkills: LoreSkillEntry[];
  levelData: Record<number, LevelProgressionData>;
  inventory: CharacterInventory;
  strikes: CharacterStrike[];
  spellcasting: CharacterSpellcastingState;
  focusPoints: number;
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

function parseAttrKey(raw: unknown): AttributeKey | null {
  if (typeof raw !== 'string') return null;
  const lower = raw.trim().toLowerCase() as AttributeKey;
  return ALL_ATTRIBUTES.includes(lower) ? lower : null;
}

function categoryToPathbuilderFeatType(category: string): string {
  switch (category.toLowerCase()) {
    case 'ancestry':
      return 'Ancestry Feat';
    case 'general':
      return 'General Feat';
    case 'skill':
      return 'Skill Feat';
    case 'heritage':
      return 'Heritage';
    case 'class':
    case 'archetype':
    default:
      return 'Class Feat';
  }
}

function pathbuilderFeatTypeToCategory(featType: string): string {
  const lower = featType.toLowerCase();
  if (lower.includes('ancestry')) return 'ancestry';
  if (lower.includes('skill')) return 'skill';
  if (lower.includes('general')) return 'general';
  if (lower.includes('heritage')) return 'heritage';
  return 'class';
}

function resolveSizeFromAncestry(ancestry: AncestryItem | null): { size: number; sizeName: string } {
  if (!ancestry?.system_json) return { size: 2, sizeName: 'Medium' };
  try {
    const sys = JSON.parse(ancestry.system_json) as { size?: string };
    const key = (sys.size || '').toLowerCase();
    return SIZE_MAP[key] || { size: 2, sizeName: 'Medium' };
  } catch {
    return { size: 2, sizeName: 'Medium' };
  }
}

function buildPathbuilderExport(input: ExportCharacterJsonInput): PathbuilderExportPayload {
  const { size, sizeName } = resolveSizeFromAncestry(input.ancestry);
  const keyAbility = input.charState.classKeyAttributeChoice || input.spellcasting.ability || 'str';
  const langList = input.languages
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const mapLevelledBoosts: Record<string, string[]> = {};
  if (Array.isArray(input.charState.level1FreeBoosts) && input.charState.level1FreeBoosts.length > 0) {
    mapLevelledBoosts['1'] = input.charState.level1FreeBoosts.map((a) => ATTR_CAP[a]);
  }
  for (const lvl of [5, 10, 15, 20]) {
    if (lvl > input.level) break;
    const boosts = input.levelData[lvl]?.attributeBoosts;
    if (Array.isArray(boosts) && boosts.length > 0) {
      mapLevelledBoosts[String(lvl)] = boosts.map((a) => ATTR_CAP[a]);
    }
  }

  const ancestryFree = Object.values(input.charState.ancestryBoostChoices || {})
    .filter((a): a is AttributeKey => ALL_ATTRIBUTES.includes(a))
    .map((a) => ATTR_CAP[a]);

  const backgroundBoosts = [input.charState.backgroundBoostChoice1, input.charState.backgroundBoostChoice2]
    .filter((a): a is AttributeKey => Boolean(a && ALL_ATTRIBUTES.includes(a)))
    .map((a) => ATTR_CAP[a]);

  const classBoosts = input.charState.classKeyAttributeChoice
    ? [ATTR_CAP[input.charState.classKeyAttributeChoice]]
    : [];

  const tradition = input.spellcasting.tradition.toLowerCase();
  const castingRank = input.proficiencies.spellcasting * 2;
  const proficiencies: Record<string, number> = {
    classDC: Math.max(2, castingRank || 2),
    perception: input.proficiencies.perception * 2,
    fortitude: input.proficiencies.fortitude * 2,
    reflex: input.proficiencies.reflex * 2,
    will: input.proficiencies.will * 2,
    heavy: input.proficiencies.heavy * 2,
    medium: input.proficiencies.medium * 2,
    light: input.proficiencies.light * 2,
    unarmored: input.proficiencies.unarmored * 2,
    advanced: input.proficiencies.advanced * 2,
    martial: input.proficiencies.martial * 2,
    simple: input.proficiencies.simple * 2,
    unarmed: input.proficiencies.unarmed * 2,
    castingArcane: tradition === 'arcane' ? castingRank : 0,
    castingDivine: tradition === 'divine' ? castingRank : 0,
    castingOccult: tradition === 'occult' ? castingRank : 0,
    castingPrimal: tradition === 'primal' ? castingRank : 0,
    piloting: 0,
    computers: 0,
  };
  for (const skill of ALL_SKILLS) {
    proficiencies[skill] = (input.skillRanks[skill] || 0) * 2;
  }

  const feats: PathbuilderFeatTuple[] = [];
  if (input.heritage?.name) {
    feats.push([input.heritage.name, null, 'Heritage', 1, 'Heritage Feat', 'parentChoice', null]);
  }
  for (let lvl = 1; lvl <= input.level; lvl++) {
    const levelFeats = input.levelData[lvl]?.feats || {};
    for (const [slotKey, feat] of Object.entries(levelFeats)) {
      const featType = categoryToPathbuilderFeatType(feat.category || '');
      const isVersatile = slotKey === 'versatile_heritage_1';
      feats.push([
        feat.featName,
        null,
        featType,
        feat.level || lvl,
        isVersatile ? 'Heritage Featversatile heritage' : slotKey,
        isVersatile ? 'childChoice' : 'standardChoice',
        isVersatile ? 'Heritage Feat' : null,
      ]);
    }
  }

  const specials: string[] = [];
  if (input.selectedClass?.system_json) {
    try {
      const sys = JSON.parse(input.selectedClass.system_json) as {
        items?: Record<string, { name?: string; level?: number }>;
      };
      for (const feature of Object.values(sys.items || {})) {
        if (typeof feature.name === 'string' && typeof feature.level === 'number' && feature.level <= input.level) {
          specials.push(feature.name);
        }
      }
    } catch { /* ignore */ }
  }
  if (input.subclass && !specials.includes(input.subclass)) specials.push(input.subclass);
  if (input.consciousMindName && !specials.includes(input.consciousMindName)) specials.push(input.consciousMindName);
  if (input.heritage?.name && !specials.includes(input.heritage.name)) specials.push(input.heritage.name);

  const lores: Array<[string, number]> = input.loreSkills.map((l) => [l.name, l.rank * 2]);

  const weapons: PathbuilderWeapon[] = [];
  const armor: PathbuilderArmor[] = [];
  const equipment: Array<[string, number]> = [];

  for (const entry of input.inventory.items) {
    const item = entry.item;
    let sys: Record<string, unknown> = {};
    try {
      sys = JSON.parse(item.system_json || '{}') as Record<string, unknown>;
    } catch { /* ignore */ }

    if (item.item_type === 'weapon') {
      const damage = (sys.damage || {}) as { die?: string; damageType?: string };
      const runesObj = (sys.runes || {}) as { potency?: number; striking?: number; property?: string[] };
      const category = typeof sys.category === 'string' ? sys.category : 'simple';
      const profRank = input.proficiencies[category as keyof typeof input.proficiencies] ?? 1;
      const pot = typeof runesObj.potency === 'number' ? runesObj.potency : 0;
      const strikeMatch = input.strikes.find((s) => s.inventoryEntryId === entry.id || s.weapon === item.name);
      const attrKey = strikeMatch?.attribute || (category === 'ranged' ? 'dex' : 'str');
      const attack = (input.currentAttributes[attrKey] || 0) + getProficiencyBonus(profRank, input.level) + pot;
      const typeMap: Record<string, string> = { bludgeoning: 'B', piercing: 'P', slashing: 'S' };
      const dmgType = typeMap[damage.damageType || ''] || (damage.damageType || 'B').slice(0, 1).toUpperCase();

      weapons.push({
        name: item.name,
        qty: entry.quantity,
        prof: category,
        die: damage.die || 'd4',
        pot,
        str: runesObj.striking ? String(runesObj.striking) : '',
        mat: null,
        display: item.name,
        runes: Array.isArray(runesObj.property) ? runesObj.property : [],
        damageType: dmgType,
        attack,
        damageBonus: strikeMatch?.otherDamage || 0,
        extraDamage: [],
        increasedDice: false,
        isInventor: false,
        grade: '',
      });
    } else if (item.item_type === 'armor' || item.item_type === 'shield') {
      const runesObj = (sys.runes || {}) as { potency?: number; resilient?: number; property?: string[] };
      const category = item.item_type === 'shield' ? 'shield' : (typeof sys.category === 'string' ? sys.category : 'light');
      armor.push({
        name: item.name,
        qty: entry.quantity,
        prof: category,
        pot: typeof runesObj.potency === 'number' ? runesObj.potency : 0,
        res: runesObj.resilient ? String(runesObj.resilient) : '',
        mat: null,
        display: item.name,
        worn: entry.equipped,
        runes: Array.isArray(runesObj.property) ? runesObj.property : [],
        grade: '',
      });
    } else {
      equipment.push([item.name, entry.quantity]);
    }
  }

  const perDay = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let rank = 1; rank <= 10; rank++) {
    perDay[rank] = input.spellcasting.slotsMax[rank] || 0;
  }

  const hasSpellcasting = Boolean(tradition) || input.proficiencies.spellcasting > 0;
  const spellCasters: PathbuilderSpellCaster[] = hasSpellcasting
    ? [
        {
          name: input.selectedClass?.name || 'Spellcaster',
          magicTradition: tradition || 'occult',
          spellcastingType: 'spontaneous',
          ability: input.spellcasting.ability,
          proficiency: castingRank,
          focusPoints: 0,
          innate: false,
          perDay,
          spells: [],
          prepared: [],
          blendedSpells: [],
        },
      ]
    : [];

  const focus: Record<string, Record<string, PathbuilderFocusEntry>> =
    input.focusPoints > 0 && tradition
      ? {
          [tradition]: {
            [input.spellcasting.ability]: {
              abilityBonus: input.currentAttributes[input.spellcasting.ability] || 0,
              proficiency: castingRank,
              itemBonus: 0,
              focusCantrips: [],
              focusSpells: [],
            },
          },
        }
      : {};

  return {
    success: true,
    build: {
      name: input.name || 'Character',
      class: input.selectedClass?.name || '',
      dualClass: null,
      level: input.level,
      xp: input.xp,
      ancestry: input.ancestry?.name || '',
      heritage: input.heritage?.name || '',
      background: input.background?.name || '',
      alignment: 'N',
      gender: input.appearance.gender || 'Not set',
      age: 'Not set',
      deity: 'Not set',
      size,
      sizeName,
      keyability: keyAbility,
      languages: langList.length > 0 ? langList : ['None selected'],
      rituals: [],
      resistances: [],
      inventorMods: [],
      abilities: {
        str: 10 + (input.currentAttributes.str || 0) * 2,
        dex: 10 + (input.currentAttributes.dex || 0) * 2,
        con: 10 + (input.currentAttributes.con || 0) * 2,
        int: 10 + (input.currentAttributes.int || 0) * 2,
        wis: 10 + (input.currentAttributes.wis || 0) * 2,
        cha: 10 + (input.currentAttributes.cha || 0) * 2,
        breakdown: {
          ancestryFree,
          ancestryBoosts: [],
          ancestryFlaws: [],
          backgroundBoosts,
          classBoosts,
          mapLevelledBoosts,
        },
      },
      attributes: {
        ancestryhp: input.hpStats.ancestryHp,
        classhp: input.hpStats.baseClassHp,
        bonushp: 0,
        bonushpPerLevel: input.hpStats.bonusPerLevel || 0,
        speed: input.speed,
        speedBonus: 0,
      },
      proficiencies,
      mods: {},
      feats,
      specials,
      lores,
      equipmentContainers: {},
      equipment,
      specificProficiencies: {
        trained: [],
        expert: [],
        master: [],
        legendary: [],
      },
      weapons,
      money: { ...input.inventory.coins },
      armor,
      spellCasters,
      focusPoints: input.focusPoints,
      focus,
      formula: [],
      acTotal: {
        acProfBonus: getProficiencyBonus(input.acProfRank, input.level),
        acAbilityBonus: input.currentAttributes.dex || 0,
        acItemBonus: input.acItemBonus,
        acTotal: input.acTotal,
        shieldBonus: input.shieldBonus ? String(input.shieldBonus) : '0',
      },
      pets: [],
      familiars: [],
    },
  };
}

export function exportCharacterJson(character: ExportCharacterJsonInput): void {
  const payload = buildPathbuilderExport(character);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName =
    (character.name || 'character')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'character';
  a.href = url;
  a.download = `${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function featItemToSelection(feat: FeatItem, level: number, category: string): FeatSelectionRecord {
  return {
    featId: feat.id,
    featName: feat.name,
    featImg: feat.img || '',
    level,
    category,
    action_type: feat.action_type,
    actions: feat.actions,
    traits: feat.traits,
    prerequisites: feat.prerequisites,
    description: feat.description,
    system_json: feat.system_json,
  };
}

async function resolveFeatByName(name: string): Promise<FeatItem | null> {
  try {
    const res = await fetchFeats({
      search: name,
      category: 'all',
      level: 'all',
      max_level: 'all',
      action_type: 'all',
      actions: 'all',
      rarity: 'all',
      trait: 'all',
      limit: 25,
      offset: 0,
    });
    const lower = name.trim().toLowerCase();
    return res.feats.find((f) => f.name.toLowerCase() === lower) || res.feats[0] || null;
  } catch {
    return null;
  }
}

async function resolveEquipmentByName(name: string, type: string): Promise<EquipmentItem> {
  try {
    const res = await fetchEquipment(name, type, 0);
    const lower = name.trim().toLowerCase();
    const match = res.items.find((i) => i.name.toLowerCase() === lower) || res.items[0];
    if (match) return match;
  } catch { /* fallback below */ }
  return {
    id: `imported_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    item_type: type === 'all' ? 'equipment' : type,
    level: 0,
    price: '',
    bulk: 'L',
    description: '',
    system_json: '{}',
  };
}

function emptyProgressionLevels(): Record<number, LevelProgressionData> {
  const levels: Record<number, LevelProgressionData> = {};
  for (let l = 1; l <= 20; l++) {
    levels[l] = { level: l, attributeBoosts: [], skillIncreases: [], feats: {} };
  }
  return levels;
}

function reverseLevelledBoosts(finalMod: number, boostCount: number): number {
  for (let candidate = finalMod - boostCount; candidate <= finalMod; candidate++) {
    let mod = candidate;
    let partial = false;
    for (let i = 0; i < boostCount; i++) {
      if (mod < 4) {
        mod += 1;
      } else if (partial) {
        mod += 1;
        partial = false;
      } else {
        partial = true;
      }
    }
    if (mod === finalMod) return candidate;
  }
  return finalMod - boostCount;
}

async function importPathbuilderBuild(build: Partial<PathbuilderBuild>): Promise<ImportedCharacterInput> {
  const name = typeof build.name === 'string' && build.name.trim() ? build.name.trim() : '';
  if (!name) throw new Error('Missing character name');

  const rawLevel = typeof build.level === 'number' ? build.level : 1;
  const level = Math.max(1, Math.min(20, Math.floor(rawLevel)));

  const ancestryName = typeof build.ancestry === 'string' ? build.ancestry : '';
  const heritageName = typeof build.heritage === 'string' ? build.heritage : '';
  const backgroundName = typeof build.background === 'string' ? build.background : '';
  const className = typeof build.class === 'string' ? build.class : '';

  const [ancestries, backgrounds, classes] = await Promise.all([
    fetchAncestries().catch(() => [] as AncestryItem[]),
    fetchBackgrounds().catch(() => [] as BackgroundItem[]),
    fetchClasses().catch(() => [] as ClassItem[]),
  ]);

  const selectedAncestry =
    ancestries.find((a) => a.name.toLowerCase() === ancestryName.toLowerCase()) || null;
  const heritages = selectedAncestry
    ? await fetchHeritages(selectedAncestry.slug).catch(() => [] as HeritageItem[])
    : await fetchHeritages().catch(() => [] as HeritageItem[]);
  const selectedHeritage =
    heritages.find((h) => h.name.toLowerCase() === heritageName.toLowerCase()) || null;
  const selectedBackground =
    backgrounds.find((b) => b.name.toLowerCase() === backgroundName.toLowerCase()) || null;
  const selectedClass =
    classes.find((c) => c.name.toLowerCase() === className.toLowerCase()) || null;

  const isPsychic = (selectedClass?.slug || selectedClass?.name || className).toLowerCase() === 'psychic';
  const specials = Array.isArray(build.specials) ? build.specials : [];

  let subclass = '';
  let psychicConsciousMind = '';
  if (isPsychic) {
    const subMatch = specials.find((s) => s.toLowerCase() in PSYCHIC_MIND_ATTRIBUTES);
    if (subMatch) subclass = subMatch;

    try {
      const psychicFeats = await fetchFeats({
        search: '',
        category: 'classfeature',
        level: '1',
        max_level: 'all',
        action_type: 'all',
        actions: 'all',
        rarity: 'all',
        trait: 'psychic',
        limit: 200,
        offset: 0,
      });
      const consciousMinds = psychicFeats.feats.filter((f) => {
        try {
          const sys = JSON.parse(f.system_json || '{}') as { traits?: { otherTags?: string[] } };
          return sys.traits?.otherTags?.includes('psychic-conscious-mind');
        } catch {
          return false;
        }
      });
      const cmMatch = consciousMinds.find((cm) =>
        specials.some((s) => s.toLowerCase() === cm.name.toLowerCase())
      );
      if (cmMatch) psychicConsciousMind = cmMatch.id;
    } catch { /* ignore */ }
  }

  const progressionLevels = emptyProgressionLevels();

  // Abilities & Levelled Boosts
  const currentMods: Record<AttributeKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  const ab = build.abilities;
  if (ab) {
    for (const attr of ALL_ATTRIBUTES) {
      const score = ab[attr];
      if (typeof score === 'number') {
        currentMods[attr] = Math.floor((score - 10) / 2);
      }
    }
  }

  const baseAttributes: Record<AttributeKey, number> = { ...currentMods };
  const boostCounts: Record<AttributeKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  const mapBoosts = ab?.breakdown?.mapLevelledBoosts || {};
  for (const lvl of [5, 10, 15, 20]) {
    const rawList = mapBoosts[String(lvl)];
    if (!Array.isArray(rawList)) continue;
    const parsed = rawList.map(parseAttrKey).filter((a): a is AttributeKey => a !== null);
    if (lvl <= level) {
      progressionLevels[lvl].attributeBoosts = parsed;
      for (const attr of parsed) {
        boostCounts[attr] += 1;
      }
    }
  }
  for (const attr of ALL_ATTRIBUTES) {
    if (boostCounts[attr] > 0) {
      baseAttributes[attr] = reverseLevelledBoosts(currentMods[attr], boostCounts[attr]);
    }
  }

  const level1FreeBoosts = Array.isArray(mapBoosts['1'])
    ? mapBoosts['1'].map(parseAttrKey).filter((a): a is AttributeKey => a !== null)
    : [];
  const bgBoosts = Array.isArray(ab?.breakdown?.backgroundBoosts)
    ? ab.breakdown.backgroundBoosts.map(parseAttrKey).filter((a): a is AttributeKey => a !== null)
    : [];
  const keyAttr = parseAttrKey(build.keyability) || parseAttrKey(ab?.breakdown?.classBoosts?.[0]) || null;

  // Skills & Lores
  const profs = build.proficiencies || {};
  const initialBudget = computeInitialSkillBudget(selectedBackground, selectedClass, baseAttributes.int);
  const initialTrainedSet = new Set<SkillKey>(initialBudget.autoTrained);
  const rankOverridesAtLevel: Partial<Record<SkillKey, ProficiencyRank>> = {};

  for (const skill of ALL_SKILLS) {
    const pbVal = profs[skill];
    if (typeof pbVal === 'number' && pbVal > 0) {
      const rank = Math.min(4, Math.max(0, Math.floor(pbVal / 2))) as ProficiencyRank;
      if (rank >= 1) initialTrainedSet.add(skill);
      if (rank >= 2) rankOverridesAtLevel[skill] = rank;
    }
  }
  if (Object.keys(rankOverridesAtLevel).length > 0) {
    progressionLevels[level].skillRankOverrides = rankOverridesAtLevel;
  }

  const loreSkills: LoreSkillEntry[] = Array.isArray(build.lores) && build.lores.length > 0
    ? build.lores.map(([loreName, pbRank], idx) => ({
        id: `lore_${Date.now().toString(36)}_${idx}`,
        name: String(loreName),
        rank: Math.min(4, Math.max(1, Math.floor((Number(pbRank) || 2) / 2))) as ProficiencyRank,
      }))
    : deriveDefaultLoreSkills(selectedBackground, selectedClass);

  // Feats
  const rawFeats = Array.isArray(build.feats) ? build.feats : [];
  const resolvedFeats = await Promise.all(
    rawFeats.map(async (tuple) => {
      const [featName, , featType, featLvl, slotLabel] = tuple;
      if (!featName || featType === 'Heritage') return null;
      const item = await resolveFeatByName(String(featName));
      return {
        featName: String(featName),
        featType: String(featType || ''),
        lvl: Math.max(1, Math.min(20, Math.floor(Number(featLvl) || 1))),
        slotLabel: String(slotLabel || ''),
        item,
      };
    })
  );

  for (const entry of resolvedFeats) {
    if (!entry || !entry.item) continue;
    const category = pathbuilderFeatTypeToCategory(entry.featType);
    const lvlFeats = progressionLevels[entry.lvl].feats;
    let slotKey = `${category}_${entry.lvl}`;
    if (entry.lvl === 1 && category === 'general' && entry.slotLabel.toLowerCase().includes('versatile')) {
      slotKey = 'versatile_heritage_1';
    } else if (lvlFeats[slotKey]) {
      let idx = 2;
      while (lvlFeats[`${category}_${entry.lvl}_${idx}`]) idx++;
      slotKey = `${category}_${entry.lvl}_${idx}`;
    }
    lvlFeats[slotKey] = featItemToSelection(entry.item, entry.lvl, category);
  }

  // Equipment, Weapons, Armor, Strikes
  const inventoryItems: InventoryEntry[] = [];
  const strikes: CharacterStrike[] = [];

  const weaponEntries = Array.isArray(build.weapons) ? build.weapons : [];
  for (const w of weaponEntries) {
    const item = await resolveEquipmentByName(w.name, 'weapon');
    const entryId = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    inventoryItems.push({ id: entryId, item, quantity: w.qty || 1, equipped: true });

    const profRank = Math.min(4, Math.max(0, Math.floor((profs[w.prof] || 2) / 2))) as ProficiencyRank;
    const isRanged = w.damageType === 'P' && (w.name.toLowerCase().includes('bow') || w.name.toLowerCase().includes('sling'));
    strikes.push({
      id: `strike_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      kind: isRanged ? 'ranged' : 'melee',
      weapon: item.name,
      inventoryEntryId: entryId,
      attribute: isRanged ? 'dex' : 'str',
      proficiency: profRank,
      itemBonus: w.pot || 0,
      dice: `1${w.die || 'd4'}`,
      strengthDamage: isRanged ? 0 : currentMods.str,
      damageType: w.damageType || 'B',
      otherDamage: w.damageBonus || 0,
      traits: '',
    });
  }

  const armorEntries = Array.isArray(build.armor) ? build.armor : [];
  for (const a of armorEntries) {
    const type = a.prof === 'shield' ? 'shield' : 'armor';
    const item = await resolveEquipmentByName(a.name, type);
    inventoryItems.push({
      id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      item,
      quantity: a.qty || 1,
      equipped: Boolean(a.worn),
    });
  }

  const gearEntries = Array.isArray(build.equipment) ? build.equipment : [];
  for (const g of gearEntries) {
    const gearName = Array.isArray(g) ? String(g[0]) : '';
    const qty = Array.isArray(g) && typeof g[1] === 'number' ? g[1] : 1;
    if (!gearName) continue;
    const item = await resolveEquipmentByName(gearName, 'all');
    inventoryItems.push({
      id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      item,
      quantity: qty,
      equipped: false,
    });
  }

  const coins = {
    pp: build.money?.pp || 0,
    gp: build.money?.gp || 0,
    sp: build.money?.sp || 0,
    cp: build.money?.cp || 0,
  };

  // Spellcasting & Focus
  const primaryCaster = Array.isArray(build.spellCasters) ? build.spellCasters[0] : undefined;
  const slotsMax: Record<number, number> = isPsychic ? psychicSlotsForLevel(level) : {};
  if (primaryCaster && Array.isArray(primaryCaster.perDay)) {
    for (let r = 1; r <= 10; r++) {
      if (typeof primaryCaster.perDay[r] === 'number' && primaryCaster.perDay[r] > 0) {
        slotsMax[r] = primaryCaster.perDay[r];
      }
    }
  }
  const spellcasting: CharacterSpellcastingState = {
    tradition: primaryCaster?.magicTradition || (isPsychic ? 'occult' : ''),
    ability: parseAttrKey(primaryCaster?.ability) || keyAttr || 'cha',
    proficiency: Math.min(4, Math.max(0, Math.floor((primaryCaster?.proficiency || 0) / 2))) as ProficiencyRank,
    slotsMax,
    slotsUsed: {},
    signatureSpells: [],
  };

  const focusMax = typeof build.focusPoints === 'number' ? Math.min(3, Math.max(0, build.focusPoints)) : isPsychic ? 2 : 0;
  const session: SessionState = {
    ...DEFAULT_SESSION_STATE,
    focusPoints: focusMax,
    maxFocusPoints: focusMax,
  };

  const languages = Array.isArray(build.languages)
    ? build.languages.filter((l) => l && l !== 'None selected').join(', ')
    : '';
  const appearance = CharacterDetails.parseAppearance({
    gender: build.gender && build.gender !== 'Not set' ? build.gender : '',
  });

  const charState: Partial<CharacterABCState> = {
    name,
    level,
    ancestry: selectedAncestry,
    heritage: selectedHeritage,
    background: selectedBackground,
    selectedClass,
    psychicConsciousMind,
    classKeyAttributeChoice: keyAttr,
    level1FreeBoosts,
    backgroundBoostChoice1: bgBoosts[0] || null,
    backgroundBoostChoice2: bgBoosts[1] || null,
    selectedSkills: Array.from(initialTrainedSet),
  };

  const companions: CharacterCompanion[] = [];
  const visionOverride: VisionType | null = null;

  return {
    name,
    level,
    ancestry: selectedAncestry?.name || ancestryName,
    heritage: selectedHeritage?.name || heritageName,
    background: selectedBackground?.name || backgroundName,
    class: selectedClass?.name || className,
    subclass,
    data: {
      charState,
      baseAttributes,
      calculatedAttributes: Object.fromEntries(
        ALL_ATTRIBUTES.map((attr) => [attr, { mod: currentMods[attr], score: 10 + currentMods[attr] * 2 }])
      ),
      freeArchetype: false,
      portrait: '',
      companions,
      visionOverride,
      visionRange: '',
      senses: '',
      languages,
      appearance,
      xp: typeof build.xp === 'number' ? build.xp : 0,
      inventory: { items: inventoryItems, coins },
      strikes,
      session,
      progressionLevels,
      initialTrainedSkills: Array.from(initialTrainedSet),
      loreSkills,
      spellcasting,
    },
  };
}

export async function parseImportedCharacterJson(rawText: string): Promise<ImportedCharacterInput> {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid JSON object');
  }

  // Pathbuilder 2e format ({ success: true, build: { ... } } or direct build object)
  if (parsed.build && typeof parsed.build === 'object' && !Array.isArray(parsed.build)) {
    return importPathbuilderBuild(parsed.build as Partial<PathbuilderBuild>);
  }
  if ('abilities' in parsed && 'proficiencies' in parsed && typeof parsed.name === 'string') {
    return importPathbuilderBuild(parsed as Partial<PathbuilderBuild>);
  }

  // Legacy pf2charsheet format fallback
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
