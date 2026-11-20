#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

// Fixed upstream snapshot; update deliberately after checking compatibility.
const REVISION = '52dfeee703b887237f5e454747bcae45b136f9af';
const args = process.argv.slice(2);
const dirArg = args.find(arg => arg.startsWith('--source='));
const dbArg = args.find(arg => arg.startsWith('--db='));
const dbPath = dbArg ? dbArg.slice(5) : process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../pf2e.db');
const relevant = new Set(['ancestry', 'heritage', 'background', 'class', 'feat', 'spell', 'weapon', 'armor', 'shield', 'equipment', 'consumable', 'backpack', 'treasure', 'ammo', 'kit', 'action', 'condition', 'deity']);
const physical = new Set(['weapon', 'armor', 'shield', 'equipment', 'consumable', 'backpack', 'treasure', 'ammo', 'kit']);
const j = value => JSON.stringify(value ?? {});

function insert(db, table, record) {
  const columns = Object.keys(record);
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter(c => c !== 'id').map(c => `${c}=excluded.${c}`).join(',')}`;
  db.prepare(sql).run(...columns.map(column => record[column]));
}
function importItem(db, item) {
  const type = item.type;
  if (!relevant.has(type) || !item._id || !item.name || !item.system) return false;
  const s = item.system;
  const id = item._id;
  const name = item.name;
  const slug = s.slug || '';
  const level = typeof s.level === 'number' ? s.level : s.level?.value ?? 0;
  const traits = Array.isArray(s.traits?.value) ? s.traits.value : [];
  const rarity = s.traits?.rarity || 'common';
  const description = s.description?.value || '';
  const system_json = j(s);
  let category = typeof s.category === 'string' ? s.category : '';
  if (type === 'spell') category = traits.includes('cantrip') ? 'cantrip' : traits.includes('focus') ? 'focus' : traits.includes('ritual') || s.ritual ? 'ritual' : 'spell';
  const common = { id, name, slug };
  insert(db, 'items', { ...common, type, level, rarity, traits: j(traits), category, source: s.publication?.title || '', img: item.img || '', description, system_json });
  const base = { ...common, description, system_json };
  if (type === 'ancestry') insert(db, 'ancestries', { ...base, hp: s.hp ?? 0, size: typeof s.size === 'string' ? s.size : s.size?.value || '', speed: s.speed ?? 0, boosts: j(s.boosts), flaws: j(s.flaws), languages: j(s.languages), traits: j(traits) });
  else if (type === 'heritage') insert(db, 'heritages', { ...base, ancestry_name: s.ancestry?.name || '', ancestry_slug: s.ancestry?.slug || '', traits: j(traits) });
  else if (type === 'background') insert(db, 'backgrounds', { ...base, boosts: j(s.boosts), skills: j(s.trainedSkills?.value || []), traits: j(traits) });
  else if (type === 'class') insert(db, 'classes', { ...base, hp: s.hp ?? 0, key_ability: j(s.keyAbility?.value || []), perception: s.perception ?? 0, fortitude: s.savingThrows?.fortitude ?? 0, reflex: s.savingThrows?.reflex ?? 0, will: s.savingThrows?.will ?? 0, attacks: j(s.attacks), defenses: j(s.defenses) });
  else if (type === 'feat') insert(db, 'feats', { ...base, category, level, action_type: s.actionType?.value || '', actions: String(s.actions?.value ?? ''), prerequisites: j(s.prerequisites?.value || []), traits: j(traits), rarity });
  else if (type === 'spell') insert(db, 'spells', { ...base, rank: level, category, traditions: j(s.traits?.traditions || []), traits: j(traits), time: s.time?.value || '', range: s.range?.value || '', target: s.target?.value || '', area: s.area?.value ? `${s.area.value} ${s.area.type || ''}`.trim() : '', duration: s.duration?.value || '', defense: s.defense?.save?.statistic || '' });
  else if (physical.has(type)) { const price = s.price?.value || {}; insert(db, 'equipment', { ...base, item_type: type, level, price: ['pp', 'gp', 'sp', 'cp'].filter(k => price[k]).map(k => `${price[k]} ${k}`).join(' ') || '0', bulk: String(s.bulk?.value ?? ''), traits: j(traits), rarity }); }
  else if (type === 'action') insert(db, 'actions', { ...base, action_type: s.actionType?.value || '', actions: String(s.actions?.value ?? ''), traits: j(traits) });
  else if (type === 'condition') insert(db, 'conditions', base);
  else if (type === 'deity') insert(db, 'deities', { ...base, category, alignment: typeof s.alignment === 'string' ? s.alignment : '', domains: j(s.domains?.primary || []), favored_weapons: j(s.weapons || []) });
  return true;
}
function* jsonFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonFiles(file);
    else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('_')) yield file;
  }
}
async function main() {
  let temporary;
  try {
    let source = dirArg && path.resolve(dirArg.slice('--source='.length));
    if (!source) {
      temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pf2e-source-'));
      const archive = path.join(temporary, 'source.tar.gz');
      const url = `https://codeload.github.com/foundryvtt/pf2e/tar.gz/${REVISION}`;
      console.log(`Baixando Foundry PF2e ${REVISION}...`);
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Download falhou: HTTP ${response.status}`);
      fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
      execFileSync('tar', ['-xzf', archive, '-C', temporary], { stdio: 'inherit' });
      source = path.join(temporary, `pf2e-${REVISION}`);
    }
    const packsRoot = fs.existsSync(path.join(source, 'packs', 'pf2e')) ? path.join(source, 'packs', 'pf2e') : fs.existsSync(path.join(source, 'packs')) ? path.join(source, 'packs') : source;
    if (!fs.existsSync(packsRoot)) throw new Error(`Diretório não encontrado: ${packsRoot}`);
    const db = new DatabaseSync(dbPath);
    try {
      db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
      db.exec('BEGIN');
      let count = 0;
      try {
        for (const file of jsonFiles(packsRoot)) {
          const item = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (importItem(db, item)) count++;
        }
        if (!count) throw new Error('Nenhum documento PF2e encontrado na fonte.');
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      console.log(`Importados ${count} documentos; personagens e grimórios preservados.`);
    } finally { db.close(); }
  } finally { if (temporary) fs.rmSync(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(`Erro na importação: ${error.message}`); process.exitCode = 1; });
