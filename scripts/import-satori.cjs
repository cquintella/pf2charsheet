#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Import the Satori versatile heritage and its ancestry feats.

Usage:
  node scripts/import-satori.cjs [--db=<path>]

Options:
  --db=<path>  SQLite database (defaults to SQLITE_DB_PATH or ./pf2e.db)
  -h, --help   Show this help

Examples:
  node scripts/import-satori.cjs
  node scripts/import-satori.cjs --db=/tmp/compendium.db`);
  process.exit(0);
}

const option = process.argv.find((argument) => argument.startsWith('--db='));
const databasePath = option ? option.slice('--db='.length) : process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../pf2e.db');
const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/psionics/satori.json'), 'utf8'));
const db = new DatabaseSync(databasePath);
const json = JSON.stringify;
const upsert = (table, record) => {
  const columns = Object.keys(record);
  db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter((column) => column !== 'id').map((column) => `${column}=excluded.${column}`).join(',')}`).run(...columns.map((column) => record[column]));
};
try {
  db.exec('BEGIN');
  const heritage = data.heritage;
  const heritageId = 'alluria-psionics-heritage-satori';
  const heritageSystem = json({ slug: heritage.slug, description: { value: heritage.description }, traits: { rarity: 'uncommon', value: ['psionic'] }, rules: [{ key: 'ActorTraits', add: ['psionic'] }], publication: { title: data.source } });
  upsert('items', { id: heritageId, name: heritage.name, slug: heritage.slug, type: 'heritage', level: 0, rarity: 'uncommon', traits: json(['psionic']), category: '', source: data.source, img: '', description: heritage.description, system_json: heritageSystem });
  upsert('heritages', { id: heritageId, name: heritage.name, slug: heritage.slug, ancestry_name: '', ancestry_slug: '', traits: json(['psionic']), description: heritage.description, system_json: heritageSystem });
  for (const feat of data.feats) {
    const slug = feat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = `alluria-psionics-satori-${slug}`;
    const actionType = feat.actionType || 'passive';
    const actions = feat.actions || '';
    const description = `<p>${feat.description}</p>${feat.traits.includes('psionic') ? '<p>Psionic feats require at least 1 PEP to satisfy the Reserve Rule.</p>' : ''}`;
    const system = json({ slug, level: { value: feat.level }, category: 'ancestry', traits: { rarity: 'common', value: feat.traits }, actionType: { value: actionType }, actions: { value: actions }, prerequisites: { value: [] }, description: { value: description }, publication: { title: data.source } });
    upsert('items', { id, name: feat.name, slug, type: 'feat', level: feat.level, rarity: 'common', traits: json(feat.traits), category: 'ancestry', source: data.source, img: '', description, system_json: system });
    upsert('feats', { id, name: feat.name, slug, category: 'ancestry', level: feat.level, action_type: actionType, actions, prerequisites: json([]), traits: json(feat.traits), rarity: 'common', description, system_json: system });
  }
  db.exec('COMMIT');
  console.log(`Imported Satori and ${data.feats.length} ancestry feats into ${databasePath}`);
} catch (error) {
  try { db.exec('ROLLBACK'); } catch {}
  throw error;
} finally {
  db.close();
}
