const { randomUUID } = require('node:crypto');

const CATEGORIES = new Set(['class', 'ancestry', 'skill', 'general', 'classfeature', 'ancestryfeature', 'calling', 'bonus']);
const RARITIES = new Set(['common', 'uncommon', 'rare', 'unique']);
const ACTION_TYPES = new Set(['passive', 'action', 'reaction', 'free']);

function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid feat data');
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const level = Number(data.level);
  if (!name || name.length > 200) throw new Error('Name is required and must be at most 200 characters');
  if (!CATEGORIES.has(data.category)) throw new Error('Invalid category');
  if (!Number.isInteger(level) || level < 0 || level > 20) throw new Error('Invalid level');
  if (!RARITIES.has(data.rarity)) throw new Error('Invalid rarity');
  if (!ACTION_TYPES.has(data.action_type)) throw new Error('Invalid action type');
  const actions = data.action_type === 'action' ? String(data.actions || '') : '';
  if (data.action_type === 'action' && !['1', '2', '3'].includes(actions)) throw new Error('Invalid action count');
  if (!Array.isArray(data.traits) || !data.traits.every((value) => typeof value === 'string')) throw new Error('Invalid traits');
  if (!Array.isArray(data.prerequisites) || !data.prerequisites.every((value) => typeof value === 'string')) throw new Error('Invalid prerequisites');
  if (typeof data.description !== 'string') throw new Error('Invalid description');
  return { name, level, category: data.category, rarity: data.rarity, action_type: data.action_type, actions, traits: [...new Set(data.traits.map((value) => value.trim().toLowerCase()).filter(Boolean))], prerequisites: data.prerequisites.map((value) => value.trim()).filter(Boolean), description: data.description, source: typeof data.source === 'string' ? data.source.trim() : '' };
}

function transaction(db, callback) {
  if (typeof db.transaction === 'function') return db.transaction(callback);
  db.exec('BEGIN');
  try { const result = callback(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

function saveFeat(db, data, id) {
  const feat = validate(data);
  const existing = id ? db.prepare('SELECT f.*, i.source, i.img FROM feats f JOIN items i ON i.id=f.id WHERE f.id=?').get(id) : null;
  if (id && !existing) return null;
  const featId = id || `custom-feat-${randomUUID()}`;
  const slug = existing?.slug || feat.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || featId;
  let system = {};
  if (existing?.system_json) {
    try { system = JSON.parse(existing.system_json); }
    catch { throw new Error('Existing feat contains invalid system data'); }
    if (!system || typeof system !== 'object' || Array.isArray(system)) throw new Error('Existing feat contains invalid system data');
  }
  let previousPrerequisites = [];
  if (existing?.prerequisites) {
    try { previousPrerequisites = JSON.parse(existing.prerequisites); }
    catch { throw new Error('Existing feat contains invalid prerequisite data'); }
    if (!Array.isArray(previousPrerequisites)) throw new Error('Existing feat contains invalid prerequisite data');
  }
  const prerequisites = feat.prerequisites.map((value) => previousPrerequisites.find((entry) => typeof entry === 'string' ? entry === value : entry && entry.value === value) || { value });
  system.slug = slug;
  system.level = { ...system.level, value: feat.level };
  system.category = feat.category;
  system.actionType = { ...system.actionType, value: feat.action_type };
  system.actions = { ...system.actions, value: feat.actions ? Number(feat.actions) : null };
  system.traits = { ...system.traits, value: feat.traits, rarity: feat.rarity };
  system.prerequisites = { ...system.prerequisites, value: prerequisites };
  system.description = { ...system.description, value: feat.description };
  system.publication = { ...system.publication, title: feat.source };
  const traits = JSON.stringify(feat.traits);
  const systemJson = JSON.stringify(system);
  return transaction(db, () => {
    db.prepare(`INSERT INTO items (id,name,slug,type,level,rarity,traits,category,source,img,description,system_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,level=excluded.level,rarity=excluded.rarity,traits=excluded.traits,category=excluded.category,source=excluded.source,description=excluded.description,system_json=excluded.system_json`)
      .run(featId, feat.name, slug, 'feat', feat.level, feat.rarity, traits, feat.category, feat.source, existing?.img || '', feat.description, systemJson);
    db.prepare(`INSERT INTO feats (id,name,slug,category,level,action_type,actions,prerequisites,traits,rarity,description,system_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,level=excluded.level,action_type=excluded.action_type,actions=excluded.actions,prerequisites=excluded.prerequisites,traits=excluded.traits,rarity=excluded.rarity,description=excluded.description,system_json=excluded.system_json`)
      .run(featId, feat.name, slug, feat.category, feat.level, feat.action_type, feat.actions, JSON.stringify(prerequisites), traits, feat.rarity, feat.description, systemJson);
    return featId;
  });
}

function deleteFeat(db, id) {
  if (!db.prepare('SELECT id FROM feats WHERE id=?').get(id)) return false;
  return transaction(db, () => {
    db.prepare('DELETE FROM feats WHERE id=?').run(id);
    db.prepare("DELETE FROM items WHERE id=? AND type='feat'").run(id);
    return true;
  });
}

module.exports = { saveFeat, deleteFeat };
