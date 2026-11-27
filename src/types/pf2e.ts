export type Tradition = 'arcane' | 'divine' | 'occult' | 'primal';

export type SpellCategory = 'spell' | 'cantrip' | 'focus' | 'ritual';

export type DefenseType = 'fortitude' | 'reflex' | 'will' | 'ac';

export type ActionCost = '1' | '2' | '3' | 'reaction' | 'free' | string;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'unique';

export type AttributeKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface SpellItem {
  id: string;
  name: string;
  slug: string;
  rank: number;
  category: string;
  traditions: string; // JSON array string
  traits: string; // JSON array string
  time: string;
  range: string;
  target: string;
  area: string;
  duration: string;
  defense: string;
  description: string;
  system_json: string;
  img: string;
  rarity: Rarity;
  source?: string;
}

export interface SpellFilters {
  search: string;
  rank: string; // 'all' | '0' (cantrips) | '1' .. '10'
  tradition: string; // 'all' | Tradition
  category: string; // 'all' | SpellCategory
  defense: string; // 'all' | DefenseType
  actions: string; // 'all' | '1' | '2' | '3' | 'reaction' | 'free'
  trait: string; // 'all' | trait name
  rarity: string; // 'all' | Rarity
  onlyFavorites?: boolean;
  limit: number;
  offset: number;
}

export interface SpellMetadata {
  traditions: string[];
  categories: string[];
  ranks: number[];
  defenses: string[];
  actionTypes: string[];
  traits: { name: string; count: number }[];
  totalSpells: number;
}

export interface Spellbook {
  id: string;
  name: string;
  tradition: string;
  caster_class: string;
  description: string;
  spells_json: string; // JSON array string of spell IDs
  spells?: SpellItem[] | string[]; // Hydrated spell objects or IDs array
  created_at?: string;
  updated_at?: string;
}

// Feat Interfaces
export type FeatCategory = 'class' | 'ancestry' | 'skill' | 'general' | 'classfeature' | 'ancestryfeature' | string;

export interface FeatItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  level: number;
  action_type: string; // 'passive' | 'action' | 'reaction' | 'free'
  actions: string; // '' | '1' | '2' | '3'
  prerequisites: string; // JSON array string e.g. [{"value": "Trained in Athletics"}]
  traits: string; // JSON array string
  rarity: Rarity;
  description: string;
  system_json: string;
  img: string;
  source?: string;
}

export interface FeatFilters {
  search: string;
  category: string; // 'all' | FeatCategory
  level: string; // 'all' | '0' .. '20'
  max_level?: string; // '<= max_level'
  action_type: string; // 'all' | 'passive' | 'action' | 'reaction' | 'free'
  actions: string; // 'all' | '1' | '2' | '3'
  rarity: string; // 'all' | Rarity
  trait: string; // 'all' | trait name
  onlyFavorites?: boolean;
  limit: number;
  offset: number;
}

export interface FeatMetadata {
  categories: string[];
  levels: number[];
  actionTypes: string[];
  actions: string[];
  rarities: string[];
  traits: { name: string; count: number }[];
  totalFeats: number;
}

export interface AncestryItem {
  id: string;
  name: string;
  slug: string;
  hp: number;
  size: string;
  speed: number;
  boosts: string; // JSON string
  flaws: string; // JSON string
  languages: string; // JSON string
  traits: string; // JSON string
  description: string;
  system_json: string;
  img?: string;
  rarity?: Rarity;
}

export interface HeritageItem {
  id: string;
  name: string;
  slug: string;
  ancestry_name: string | null;
  ancestry_slug: string | null;
  traits: string; // JSON string
  description: string;
  system_json: string;
  img?: string;
  rarity?: Rarity;
}

export interface BackgroundItem {
  id: string;
  name: string;
  slug: string;
  boosts: string; // JSON string
  skills: string; // JSON string
  traits: string; // JSON string
  description: string;
  system_json: string;
  img?: string;
  rarity?: Rarity;
}

export interface ClassItem {
  id: string;
  name: string;
  slug: string;
  hp: number;
  key_ability: string; // JSON string e.g. ["str", "dex"]
  perception: number;
  fortitude: number;
  reflex: number;
  will: number;
  attacks: string; // JSON string
  defenses: string; // JSON string
  description: string;
  system_json: string;
  img?: string;
  rarity?: Rarity;
}

export interface SavedCharacterRecord {
  id: string;
  name: string;
  level: number;
  ancestry: string;
  heritage: string;
  background: string;
  class: string;
  subclass: string;
  data_json: string;
  created_at?: string;
  updated_at?: string;
}

export interface CharacterABCState {
  name: string;
  level: number;
  // A: Ancestry
  ancestry: AncestryItem | null;
  heritage?: HeritageItem | null;
  useAlternativeBoosts: boolean; // 2 free boosts instead of fixed
  ancestryBoostChoices: Record<string, AttributeKey>; // slot index -> chosen attribute
  useVoluntaryFlaw: boolean;
  voluntaryFlaw: AttributeKey | null; // -1 to this attribute
  voluntaryBoost: AttributeKey | null; // +1 to another attribute
  // B: Background
  background: BackgroundItem | null;
  backgroundBoostChoice1: AttributeKey | null; // from the 2 specific attributes
  backgroundBoostChoice2: AttributeKey | null; // free boost
  // C: Class
  selectedClass: ClassItem | null;
  psychicConsciousMind?: string;
  classKeyAttributeChoice: AttributeKey | null; // chosen key attribute
  // Level 1 Free Boosts (4 distinct attributes)
  level1FreeBoosts: AttributeKey[];
  // House Rule: Extra attribute boosts at character creation
  extraAttributeBoosts?: Partial<Record<AttributeKey, number>>;
  // Level 1 Free Trained Skills (additional + INT + overlap)
  selectedSkills?: SkillKey[];
}

// Level Progression Types
export type SkillKey = 
  | 'acrobatics'
  | 'arcana'
  | 'athletics'
  | 'crafting'
  | 'deception'
  | 'diplomacy'
  | 'intimidation'
  | 'medicine'
  | 'nature'
  | 'occultism'
  | 'performance'
  | 'religion'
  | 'society'
  | 'stealth'
  | 'survival'
  | 'thievery';

export type ProficiencyRank = 0 | 1 | 2 | 3 | 4; // 0: Untrained, 1: Trained, 2: Expert, 3: Master, 4: Legendary

export interface LoreSkillEntry {
  id: string;
  name: string;
  rank: ProficiencyRank;
}

export type HpProgressionMode = 'full' | 'average' | 'roll';

export interface CharacterSpellcastingState {
  tradition: string;
  ability: AttributeKey;
  proficiency: ProficiencyRank;
  spellbookId?: string;
  slotsMax: Record<number, number>;
  slotsUsed: Record<number, number>;
  signatureSpells: string[];
}

export interface FeatSelectionRecord {
  choices?: Record<string, string>;
  prerequisites?: string;
  system_json?: string;
  description?: string;
  featId: string;
  featName: string;
  featImg: string;
  level: number;
  category: string;
  action_type?: string;
  actions?: string;
  traits?: string;
}

export interface LevelProgressionData {
  level: number;
  attributeBoosts: AttributeKey[]; // up to 4 selected at 5, 10, 15, 20
  skillIncreases: SkillKey[]; // skills upgraded at this level
  attributeOverrides?: Partial<Record<AttributeKey, number>>;
  skillRankOverrides?: Partial<Record<SkillKey, ProficiencyRank>>; // manual rank at this level
  hpRoll?: number; // rolled hit die value for levels 2..20 when hpMode === 'roll'
  feats: Record<string, FeatSelectionRecord>; // slotKey -> FeatSelectionRecord
}

export interface CharacterProgressionSheet {
  characterId: string;
  name: string;
  currentLevel: number;
  baseABC: CharacterABCState;
  levels: Record<number, LevelProgressionData>;
}

export interface EquipmentItem {
  source?: string;
  traits?: string;
  rarity?: string;
  id: string;
  name: string;
  item_type: string;
  level: number;
  price: string;
  bulk: string;
  description: string;
  system_json: string;
  img?: string;
}

export interface InventoryEntry {
  id: string;
  item: EquipmentItem;
  quantity: number;
  equipped: boolean;
  containerId?: string;
}

export interface CharacterInventory {
  items: InventoryEntry[];
  coins: { pp: number; gp: number; sp: number; cp: number };
}

export interface CharacterStrike {
  id: string;
  kind: 'melee' | 'ranged';
  weapon: string;
  inventoryEntryId?: string;
  damageTypeOverride?: string;
  attribute: 'str' | 'dex';
  proficiency: ProficiencyRank;
  itemBonus: number;
  dice: string;
  strengthDamage: number;
  damageType: string;
  otherDamage: number;
  traits: string;
}

export interface CreatureItem {
  id: string;
  name: string;
  slug: string;
  level: number;
  size: string;
  traits: string;
  rarity: Rarity;
  hp: number;
  ac: number;
  fortitude: number;
  reflex: number;
  will: number;
  perception: number;
  speed: number;
  senses: string;
  img?: string;
  source?: string;
  description: string;
  system_json: string;
}

export type VisionType = 'normal' | 'low-light-vision' | 'darkvision' | 'greater-darkvision';

export type CompanionKind = 'animal' | 'familiar' | 'eidolon' | 'construct';

export interface CharacterCompanion {
  id: string;
  name: string;
  kind: CompanionKind;
  species: string;
  level: number;
  size: string;
  speed: number;
  vision: VisionType;
  visionRange?: string;
  skills?: Partial<Record<SkillKey, number>>;
  senses: string;
  currentHp: number;
  maxHp: number;
  ac: number;
  fortitude: number;
  reflex: number;
  will: number;
  perception: number;
  attributes: Record<AttributeKey, number>;
  attacks: string;
  support: string;
  notes: string;
}
