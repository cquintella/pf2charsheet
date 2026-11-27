const { randomUUID } = require('node:crypto');
const ITEM_TYPES = new Set(['weapon','armor','shield','equipment','consumable','ammo','backpack','treasure','kit']);
const CATEGORIES = new Set(['spell','cantrip','focus','ritual']);
const RARITIES = new Set(['common','uncommon','rare','unique']);
const TRADITIONS = new Set(['arcane','divine','occult','primal']);
function transaction(db, callback) {
  if (typeof db.transaction === 'function') return db.transaction(callback);
  db.exec('BEGIN');
  try { const result = callback(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
function getExisting(db, type, id) {
  return db.prepare(`SELECT t.*,i.img,i.source,i.rarity AS item_rarity FROM ${type === 'spell' ? 'spells' : 'equipment'} t JOIN items i ON t.id=i.id WHERE t.id=?`).get(id);
}
function saveCatalogEntry(db, type, input, id) {
  if (!['spell','equipment'].includes(type) || !input || typeof input !== 'object') throw new Error('Invalid item');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const level = Number(input.level);
  if (!name || name.length > 200 || !Number.isInteger(level) || level < 0 || level > (type === 'spell' ? 10 : 30)) throw new Error('Invalid name or level');
  if (!RARITIES.has(input.rarity) || !Array.isArray(input.traits) || !input.traits.every(value => typeof value === 'string')) throw new Error('Invalid rarity or traits');
  if (type === 'equipment' && !ITEM_TYPES.has(input.itemType)) throw new Error('Invalid item type');
  if (type === 'spell' && (!CATEGORIES.has(input.category) || !Array.isArray(input.traditions) || !input.traditions.every(value => TRADITIONS.has(value)))) throw new Error('Invalid spell category or traditions');
  const existing = id ? getExisting(db, type, id) : null;
  if (id && !existing) return null;
  if (existing && type === 'equipment' && input.itemType !== existing.item_type) throw new Error('Cannot change an existing item type');
  let system;
  try { system = JSON.parse(input.systemJson || '{}'); } catch { throw new Error('Invalid system JSON'); }
  if (!system || typeof system !== 'object' || Array.isArray(system)) throw new Error('Invalid system JSON');
  const idValue = id || `custom-${type}-${randomUUID()}`;
  const slug = existing?.slug || name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || idValue;
  const description = typeof input.description === 'string' ? input.description : '';
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  const traits = [...new Set(input.traits.map(value => value.trim().toLowerCase()).filter(Boolean))];
  if (type === 'spell') {
    for (const category of ['cantrip','focus','ritual']) {
      const index = traits.indexOf(category);
      if (category === input.category && index === -1) traits.push(category);
      if (category !== input.category && index !== -1) traits.splice(index, 1);
    }
  }
  system.slug = slug;
  system.level = { ...system.level, value: level };
  system.traits = { ...system.traits, value: traits, rarity: input.rarity, ...(type === 'spell' ? { traditions: input.traditions } : {}) };
  system.description = { ...system.description, value: description };
  system.publication = { ...system.publication, title: source };
  if (type === 'spell') {
    for (const key of ['time','range','target','duration']) system[key] = { ...system[key], value: String(input[key] || '') };
    if (String(input.area || '') !== String(existing?.area || '')) {
      const area = String(input.area || '').trim();
      const match = area.match(/^(\d+)(?:\s*(?:ft|feet|foot))?\s+([a-z-]+)$/i);
      system.area = !area ? null : match ? { ...system.area, value: Number(match[1]), type: match[2].toLowerCase(), details: area } : { details: area };
    }
    if (String(input.defense || '') !== String(existing?.defense || '')) {
      system.defense = { ...system.defense, save: { ...system.defense?.save, statistic: String(input.defense || '') || null } };
    }
    if (input.category !== 'ritual') delete system.ritual;
    else if (!system.ritual) system.ritual = {};
  }
  const json = JSON.stringify(system);
  const sourceType = type === 'spell' ? 'spell' : input.itemType;
  const category = type === 'spell' ? input.category : (typeof system.category === 'string' ? system.category : '');
  return transaction(db, () => {
    db.prepare(`INSERT INTO items (id,name,slug,type,level,rarity,traits,category,source,img,description,system_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,level=excluded.level,rarity=excluded.rarity,traits=excluded.traits,category=excluded.category,source=excluded.source,description=excluded.description,system_json=excluded.system_json`)
      .run(idValue,name,slug,sourceType,level,input.rarity,JSON.stringify(traits),category,source,existing?.img || '',description,json);
    if (type === 'equipment') {
      db.prepare(`INSERT INTO equipment (id,name,slug,item_type,level,price,bulk,traits,rarity,description,system_json) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,level=excluded.level,price=excluded.price,bulk=excluded.bulk,traits=excluded.traits,rarity=excluded.rarity,description=excluded.description,system_json=excluded.system_json`)
        .run(idValue,name,slug,input.itemType,level,String(input.price || ''),String(input.bulk || ''),JSON.stringify(traits),input.rarity,description,json);
    } else {
      db.prepare(`INSERT INTO spells (id,name,slug,rank,category,traditions,traits,time,range,target,area,duration,defense,description,system_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,rank=excluded.rank,category=excluded.category,traditions=excluded.traditions,traits=excluded.traits,time=excluded.time,range=excluded.range,target=excluded.target,area=excluded.area,duration=excluded.duration,defense=excluded.defense,description=excluded.description,system_json=excluded.system_json`)
        .run(idValue,name,slug,level,category,JSON.stringify(input.traditions),JSON.stringify(traits),String(input.time || ''),String(input.range || ''),String(input.target || ''),String(input.area || ''),String(input.duration || ''),String(input.defense || ''),description,json);
    }
    return idValue;
  });
}
function deleteCatalogEntry(db, type, id) {
  if (!['spell','equipment'].includes(type)) throw new Error('Invalid type');
  if (!getExisting(db,type,id)) return false;
  const table = type === 'spell' ? 'spells' : 'equipment';
  return transaction(db, () => { db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id); db.prepare('DELETE FROM items WHERE id=?').run(id); return true; });
}
module.exports = { saveCatalogEntry, deleteCatalogEntry };
