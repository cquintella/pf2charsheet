#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const REVISION = '52dfeee703b887237f5e454747bcae45b136f9af';
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
import-animals.cjs — Importa animais dos bestiários e habilidades de familiares do Foundry PF2e

USO:
  node scripts/import-animals.cjs [opções]

OPÇÕES:
  --source=<dir>   Caminho para um checkout local de github.com/foundryvtt/pf2e
  --db=<arquivo>   Caminho do banco SQLite de destino (padrão: ./pf2e.db ou SQLITE_DB_PATH)
  -h, --help       Exibe esta ajuda

EXEMPLOS:
  node scripts/import-animals.cjs
  node scripts/import-animals.cjs --source=/tmp/pf2e --db=./pf2e.db
`);
  process.exit(0);
}

const dirArg = args.find((arg) => arg.startsWith('--source='));
const dbArg = args.find((arg) => arg.startsWith('--db='));
const dbPath = dbArg ? dbArg.slice(5) : process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../pf2e.db');
const j = (value) => JSON.stringify(value ?? {});

function insert(db, table, record) {
  const columns = Object.keys(record);
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns
    .filter((c) => c !== 'id')
    .map((c) => `${c}=excluded.${c}`)
    .join(',')}`;
  db.prepare(sql).run(...columns.map((column) => record[column]));
}

function* jsonFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonFiles(file);
    else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('_')) yield file;
  }
}

function importAnimal(db, actor) {
  if (actor.type !== 'npc' || !actor._id || !actor.name || !actor.system) return false;
  const s = actor.system;
  const traits = Array.isArray(s.traits?.value) ? s.traits.value : [];
  if (!traits.includes('animal')) return false;

  const sensesList = Array.isArray(s.perception?.senses)
    ? s.perception.senses.map((x) => (typeof x === 'string' ? x : [x.type, x.range ? `${x.range} ft.` : ''].filter(Boolean).join(' ')))
    : [];

  insert(db, 'animals', {
    id: actor._id,
    name: actor.name,
    slug: s.slug || '',
    level: typeof s.details?.level?.value === 'number' ? s.details.level.value : 0,
    size: typeof s.traits?.size?.value === 'string' ? s.traits.size.value : 'med',
    traits: j(traits),
    rarity: s.traits?.rarity || 'common',
    hp: typeof s.attributes?.hp?.max === 'number' ? s.attributes.hp.max : 0,
    ac: typeof s.attributes?.ac?.value === 'number' ? s.attributes.ac.value : 10,
    fortitude: typeof s.saves?.fortitude?.value === 'number' ? s.saves.fortitude.value : 0,
    reflex: typeof s.saves?.reflex?.value === 'number' ? s.saves.reflex.value : 0,
    will: typeof s.saves?.will?.value === 'number' ? s.saves.will.value : 0,
    perception: typeof s.perception?.mod === 'number' ? s.perception.mod : 0,
    speed: typeof s.attributes?.speed?.value === 'number' ? s.attributes.speed.value : 25,
    senses: j(sensesList),
    img: actor.img || '',
    source: s.details?.publication?.title || '',
    description: s.details?.publicNotes || '',
    system_json: j(s),
  });
  return true;
}

function importFamiliarAbility(db, item) {
  if (!item._id || !item.name || !item.system) return false;
  const s = item.system;
  const traits = Array.isArray(s.traits?.value) ? s.traits.value : [];
  insert(db, 'familiar_abilities', {
    id: item._id,
    name: item.name,
    slug: s.slug || '',
    category: typeof s.category === 'string' ? s.category : item.type || 'familiar',
    traits: j(traits),
    description: s.description?.value || '',
    img: item.img || '',
    system_json: j(s),
  });
  return true;
}

async function main() {
  let temporary;
  try {
    let source = dirArg && path.resolve(dirArg.slice('--source='.length));
    if (!source) {
      temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pf2e-animals-'));
      const archive = path.join(temporary, 'source.tar.gz');
      const url = `https://codeload.github.com/foundryvtt/pf2e/tar.gz/${REVISION}`;
      console.log(`Baixando compêndio oficial Foundry PF2e (${REVISION})...`);
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Download falhou: HTTP ${response.status}`);
      fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
      execFileSync('tar', ['-xzf', archive, '-C', temporary], { stdio: 'inherit' });
      source = path.join(temporary, `pf2e-${REVISION}`);
    }

    const packsRoot = fs.existsSync(path.join(source, 'packs', 'pf2e'))
      ? path.join(source, 'packs', 'pf2e')
      : fs.existsSync(path.join(source, 'packs'))
      ? path.join(source, 'packs')
      : source;
    if (!fs.existsSync(packsRoot)) throw new Error(`Diretório não encontrado: ${packsRoot}`);

    const db = new DatabaseSync(dbPath);
    try {
      db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
      db.exec('BEGIN');
      let animalCount = 0;
      let familiarCount = 0;
      try {
        const dirs = fs
          .readdirSync(packsRoot, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);

        for (const dirName of dirs) {
          if (dirName.endsWith('-bestiary') || dirName.startsWith('pathfinder-bestiary')) {
            for (const file of jsonFiles(path.join(packsRoot, dirName))) {
              const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
              if (importAnimal(db, doc)) animalCount++;
            }
          } else if (dirName === 'familiar-abilities') {
            for (const file of jsonFiles(path.join(packsRoot, dirName))) {
              const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
              if (importFamiliarAbility(db, doc)) familiarCount++;
            }
          }
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      console.log(`Importados ${animalCount} animais e ${familiarCount} habilidades de familiar.`);
    } finally {
      db.close();
    }
  } finally {
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Erro na importação de animais: ${error.message}`);
  process.exitCode = 1;
});
