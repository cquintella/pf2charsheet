#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Import Crystal Elf, Psi-Forged, their ancestry feats, and Phrystal Affinity.

Usage: node scripts/import-psionic-heritages.cjs [--db=<path>]

Options:
  --db=<path>  SQLite database (defaults to SQLITE_DB_PATH or ./pf2e.db)
  -h, --help   Show this help

Examples:
  node scripts/import-psionic-heritages.cjs
  node scripts/import-psionic-heritages.cjs --db=/tmp/compendium.db`);
  process.exit(0);
}
const option = process.argv.find((arg) => arg.startsWith('--db='));
const databasePath = option ? option.slice(5) : process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../pf2e.db');
const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/psionics/heritages.json'), 'utf8'));
const db = new DatabaseSync(databasePath);
const json = JSON.stringify;
const upsert = (table, record) => {
  const columns = Object.keys(record);
  db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter((column) => column !== 'id').map((column) => `${column}=excluded.${column}`).join(',')}`).run(...columns.map((column) => record[column]));
};
const saveFeat = (feat, owner, source, category, prerequisites) => {
  const slug = feat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = `alluria-psionics-${owner}-${slug}`;
  const actionType = feat.actionType || 'passive';
  const actions = feat.actions || '';
  const description = `<p>${feat.description}</p>${feat.traits.includes('psionic') && category === 'ancestry' ? '<p>Psionic feats require at least 1 PEP to satisfy the Reserve Rule.</p>' : ''}`;
  const system = json({ slug, level: { value: feat.level }, category, traits: { rarity: 'common', value: feat.traits }, actionType: { value: actionType }, actions: { value: actions }, prerequisites: { value: prerequisites }, description: { value: description }, publication: { title: source } });
  upsert('items', { id, name: feat.name, slug, type: 'feat', level: feat.level, rarity: 'common', traits: json(feat.traits), category, source, img: '', description, system_json: system });
  upsert('feats', { id, name: feat.name, slug, category, level: feat.level, action_type: actionType, actions, prerequisites: json(prerequisites), traits: json(feat.traits), rarity: 'common', description, system_json: system });
};
try {
  db.exec('BEGIN');
  for (const heritage of data.heritages) {
    const id = `alluria-psionics-heritage-${heritage.slug}`;
    const source = `${data.source}, p. ${heritage.page}`;
    const system = json({ slug: heritage.slug, ancestry: { name: heritage.ancestry, slug: heritage.ancestry.toLowerCase() }, description: { value: heritage.description }, traits: { rarity: 'common', value: ['psionic'] }, rules: [{ key: 'ActorTraits', add: ['psionic'] }], publication: { title: source } });
    upsert('items', { id, name: heritage.name, slug: heritage.slug, type: 'heritage', level: 0, rarity: 'common', traits: json(['psionic']), category: '', source, img: '', description: heritage.description, system_json: system });
    upsert('heritages', { id, name: heritage.name, slug: heritage.slug, ancestry_name: heritage.ancestry, ancestry_slug: heritage.ancestry.toLowerCase(), traits: json(['psionic']), description: heritage.description, system_json: system });
    for (const feat of heritage.feats) saveFeat(feat, heritage.slug, source, 'ancestry', [{ value: `${heritage.name} Heritage` }]);
  }
  saveFeat({ ...data.phrystalAffinity, level: 1, traits: ['psionic', 'general'] }, 'general', `${data.source}, p. 134`, 'general', [{ value: 'A Psychic Energy Point (PEP) pool' }]);
  db.exec('COMMIT');
  console.log(`Imported ${data.heritages.length} heritages, ${data.heritages.reduce((sum, heritage) => sum + heritage.feats.length, 0)} ancestry feats, and Phrystal Affinity into ${databasePath}`);
} catch (error) {
  try { db.exec('ROLLBACK'); } catch {}
  throw error;
} finally { db.close(); }
