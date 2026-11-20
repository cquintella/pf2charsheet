CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  type TEXT NOT NULL,
  level INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common',
  traits TEXT,
  category TEXT,
  source TEXT,
  img TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_level ON items(level);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_slug ON items(slug);
CREATE TABLE IF NOT EXISTS ancestries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  hp INTEGER,
  size TEXT,
  speed INTEGER,
  boosts TEXT,
  flaws TEXT,
  languages TEXT,
  traits TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS heritages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  ancestry_name TEXT,
  ancestry_slug TEXT,
  traits TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS backgrounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  boosts TEXT,
  skills TEXT,
  traits TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  hp INTEGER,
  key_ability TEXT,
  perception INTEGER,
  fortitude INTEGER,
  reflex INTEGER,
  will INTEGER,
  attacks TEXT,
  defenses TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  category TEXT,
  level INTEGER,
  action_type TEXT,
  actions TEXT,
  prerequisites TEXT,
  traits TEXT,
  rarity TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feats_cat_lvl ON feats(category, level);
CREATE TABLE IF NOT EXISTS spells (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  rank INTEGER,
  category TEXT,
  traditions TEXT,
  traits TEXT,
  time TEXT,
  range TEXT,
  target TEXT,
  area TEXT,
  duration TEXT,
  defense TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_spells_rank ON spells(rank);
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  item_type TEXT,
  level INTEGER,
  price TEXT,
  bulk TEXT,
  traits TEXT,
  rarity TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(item_type);
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  action_type TEXT,
  actions TEXT,
  traits TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conditions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  category TEXT,
  alignment TEXT,
  domains TEXT,
  favored_weapons TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  ancestry TEXT,
  heritage TEXT,
  background TEXT,
  class TEXT,
  subclass TEXT,
  data_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS spellbooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tradition TEXT DEFAULT 'arcane',
  caster_class TEXT,
  description TEXT,
  spells_json TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_spellbooks_updated ON spellbooks(updated_at);
CREATE TABLE IF NOT EXISTS animals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  level INTEGER DEFAULT 0,
  size TEXT,
  traits TEXT,
  rarity TEXT DEFAULT 'common',
  hp INTEGER DEFAULT 0,
  ac INTEGER DEFAULT 10,
  fortitude INTEGER DEFAULT 0,
  reflex INTEGER DEFAULT 0,
  will INTEGER DEFAULT 0,
  perception INTEGER DEFAULT 0,
  speed INTEGER DEFAULT 25,
  senses TEXT,
  img TEXT,
  source TEXT,
  description TEXT,
  system_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_animals_level ON animals(level);
CREATE TABLE IF NOT EXISTS familiar_abilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  category TEXT,
  traits TEXT,
  description TEXT,
  img TEXT,
  system_json TEXT NOT NULL
);
