/**
 * Script de exportação de Compêndios LevelDB do Foundry VTT para SQLite.
 * Suporta tanto extração seletiva quanto extração de todos os 100 packs do sistema PF2e.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ClassicLevel } = require('classic-level');

const PACKS_DIR = process.env.FOUNDRY_PACKS_DIR || '/tmp/pf2e_packs_copy';
const DB_FILE = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../pf2e.db');

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

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

BEGIN TRANSACTION;
`;

async function runExport() {
  console.log(`Iniciando exportacao para ${DB_FILE}...`);
  const sqliteProc = spawn('sqlite3', [DB_FILE], {
    stdio: ['pipe', 'inherit', 'inherit']
  });

  function writeSql(sql) {
    return new Promise((resolve) => {
      if (!sqliteProc.stdin.write(sql)) {
        sqliteProc.stdin.once('drain', resolve);
      } else {
        resolve();
      }
    });
  }

  await writeSql(SCHEMA);

  if (!fs.existsSync(PACKS_DIR)) {
    console.error(`Diretorio de packs nao encontrado: ${PACKS_DIR}`);
    process.exit(1);
  }

  const packs = fs.readdirSync(PACKS_DIR);
  let totalImported = 0;

  for (const packName of packs) {
    const packPath = path.join(PACKS_DIR, packName);
    if (!fs.statSync(packPath).isDirectory()) continue;

    console.log(`Processando compendio: ${packName}`);
    try {
      const db = new ClassicLevel(packPath, { valueEncoding: 'json' });
      await db.open();

      let packCount = 0;
      for await (const [key, val] of db.iterator({ gt: '!items!' })) {
        if (!key.startsWith('!items!')) continue;
        packCount++;
        totalImported++;

        const sys = val.system || {};
        const id = val._id;
        const name = val.name || '';
        const slug = sys.slug || '';
        const type = val.type || '';
        const level = sys.level?.value ?? (typeof sys.level === 'number' ? sys.level : 0);
        const rarity = sys.traits?.rarity || 'common';
        let traitsArray = sys.traits?.value || [];
        let category = sys.category || '';

        // Determinacao correta de categoria para magias do PF2e
        if (type === 'spell') {
          if (traitsArray.includes('cantrip')) {
            category = 'cantrip';
          } else if (traitsArray.includes('focus')) {
            category = 'focus';
          } else if (sys.ritual) {
            category = 'ritual';
            if (!traitsArray.includes('ritual')) traitsArray.push('ritual');
          } else {
            category = 'spell';
          }
        }

        const traits = JSON.stringify(traitsArray);
        const source = sys.publication?.title || '';
        const img = val.img || '';
        const desc = sys.description?.value || '';
        const sysJson = JSON.stringify(sys);

        // Insercao na tabela global items
        await writeSql(`INSERT OR REPLACE INTO items (id, name, slug, type, level, rarity, traits, category, source, img, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${escapeSql(type)}, ${level}, ${escapeSql(rarity)}, ${escapeSql(traits)}, ${escapeSql(category)}, ${escapeSql(source)}, ${escapeSql(img)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);

        // Insercao nas tabelas de dominio especializadas
        if (type === 'ancestry') {
          const hp = sys.hp || 0;
          const size = sys.size || 'med';
          const speed = sys.speed || 25;
          const boosts = JSON.stringify(sys.boosts || {});
          const flaws = JSON.stringify(sys.flaws || {});
          const languages = JSON.stringify(sys.languages || {});
          await writeSql(`INSERT OR REPLACE INTO ancestries (id, name, slug, hp, size, speed, boosts, flaws, languages, traits, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${hp}, ${escapeSql(size)}, ${speed}, ${escapeSql(boosts)}, ${escapeSql(flaws)}, ${escapeSql(languages)}, ${escapeSql(traits)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        } else if (type === 'heritage') {
          const ancName = sys.ancestry?.name || '';
          const ancSlug = sys.ancestry?.slug || '';
          await writeSql(`INSERT OR REPLACE INTO heritages (id, name, slug, ancestry_name, ancestry_slug, traits, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${escapeSql(ancName)}, ${escapeSql(ancSlug)}, ${escapeSql(traits)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        } else if (type === 'background') {
          const boosts = JSON.stringify(sys.boosts || {});
          const skills = JSON.stringify(sys.trainedSkills?.value || []);
          await writeSql(`INSERT OR REPLACE INTO backgrounds (id, name, slug, boosts, skills, traits, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${escapeSql(boosts)}, ${escapeSql(skills)}, ${escapeSql(traits)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        } else if (type === 'class') {
          const hp = sys.hp || 0;
          const keyAb = JSON.stringify(sys.keyAbility?.value || []);
          const perc = sys.perception || 1;
          const fort = sys.savingThrows?.fortitude || 1;
          const ref = sys.savingThrows?.reflex || 1;
          const will = sys.savingThrows?.will || 1;
          const attacks = JSON.stringify(sys.attacks || {});
          const defenses = JSON.stringify(sys.defenses || {});
          await writeSql(`INSERT OR REPLACE INTO classes (id, name, slug, hp, key_ability, perception, fortitude, reflex, will, attacks, defenses, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${hp}, ${escapeSql(keyAb)}, ${perc}, ${fort}, ${ref}, ${will}, ${escapeSql(attacks)}, ${escapeSql(defenses)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        } else if (type === 'feat') {
          const actType = sys.actionType?.value || '';
          const actionsVal = sys.actions?.value || '';
          const prereqs = JSON.stringify(sys.prerequisites?.value || []);
          await writeSql(`INSERT OR REPLACE INTO feats (id, name, slug, category, level, action_type, actions, prerequisites, traits, rarity, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${escapeSql(category)}, ${level}, ${escapeSql(actType)}, ${escapeSql(actionsVal)}, ${escapeSql(prereqs)}, ${escapeSql(traits)}, ${escapeSql(rarity)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        } else if (type === 'spell') {
          const rank = sys.level?.value || 1;
          const traditions = JSON.stringify(sys.traits?.traditions || []);
          const timeVal = sys.time?.value || '';
          const rangeVal = sys.range?.value || '';
          const targetVal = sys.target?.value || '';
          const areaVal = sys.area?.value ? `${sys.area.value} ft ${sys.area.type || ''}` : '';
          const durationVal = sys.duration?.value || '';
          const defenseVal = sys.defense?.save?.statistic || '';
          await writeSql(`INSERT OR REPLACE INTO spells (id, name, slug, rank, category, traditions, traits, time, range, target, area, duration, defense, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${rank}, ${escapeSql(category)}, ${escapeSql(traditions)}, ${escapeSql(traits)}, ${escapeSql(timeVal)}, ${escapeSql(rangeVal)}, ${escapeSql(targetVal)}, ${escapeSql(areaVal)}, ${escapeSql(durationVal)}, ${escapeSql(defenseVal)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        } else if (['weapon', 'armor', 'shield', 'equipment', 'consumable', 'backpack', 'treasure', 'ammo', 'kit'].includes(type)) {
          const price = sys.price?.value ? `${sys.price.value.gp || 0} gp ${sys.price.value.sp || 0} sp` : '0 gp';
          const bulk = sys.bulk?.value ?? '0';
          await writeSql(`INSERT OR REPLACE INTO equipment (id, name, slug, item_type, level, price, bulk, traits, rarity, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${escapeSql(type)}, ${level}, ${escapeSql(price)}, ${escapeSql(bulk)}, ${escapeSql(traits)}, ${escapeSql(rarity)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        } else if (type === 'action') {
          const actType = sys.actionType?.value || '';
          const actionsVal = sys.actions?.value || '';
          await writeSql(`INSERT OR REPLACE INTO actions (id, name, slug, action_type, actions, traits, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${escapeSql(actType)}, ${escapeSql(actionsVal)}, ${escapeSql(traits)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        } else if (type === 'condition') {
          await writeSql(`INSERT OR REPLACE INTO conditions (id, name, slug, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        } else if (type === 'deity') {
          const align = sys.alignment || '';
          const domains = JSON.stringify(sys.domains?.primary || []);
          const favWeap = JSON.stringify(sys.weapons || []);
          await writeSql(`INSERT OR REPLACE INTO deities (id, name, slug, category, alignment, domains, favored_weapons, description, system_json) VALUES (${escapeSql(id)}, ${escapeSql(name)}, ${escapeSql(slug)}, ${escapeSql(category)}, ${escapeSql(align)}, ${escapeSql(domains)}, ${escapeSql(favWeap)}, ${escapeSql(desc)}, ${escapeSql(sysJson)});\n`);
        }
      }

      await db.close();
      console.log(`  -> ${packCount} itens importados de ${packName}`);
    } catch (err) {
      console.warn(`  [Aviso] Falha ao ler pack ${packName}: ${err.message}`);
    }
  }

  await writeSql('COMMIT;\nPRAGMA optimize;\n');
  sqliteProc.stdin.end();

  sqliteProc.on('exit', (code) => {
    console.log(`Exportacao concluida com codigo ${code}. Total de itens importados: ${totalImported}`);
  });
}

runExport();
