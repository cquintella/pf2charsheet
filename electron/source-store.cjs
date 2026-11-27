const TABLES = { feat:'feats', spell:'spells', weapon:'equipment', armor:'equipment', shield:'equipment', equipment:'equipment', consumable:'equipment', ammo:'equipment', backpack:'equipment', treasure:'equipment', kit:'equipment', ancestry:'ancestries', heritage:'heritages', background:'backgrounds', class:'classes', action:'actions', condition:'conditions', deity:'deities' };
function transaction(db, callback) {
  if (typeof db.transaction === 'function') return db.transaction(callback);
  db.exec('BEGIN');
  try { const result = callback(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
function updatePublication(raw, oldName, newName) {
  let system;
  try { system = JSON.parse(raw); } catch { throw new Error('Invalid system data; no sources were changed'); }
  if (system && typeof system === 'object' && system.publication && typeof system.publication.title === 'string' && system.publication.title.trim().toLowerCase() === oldName.toLowerCase()) system.publication.title = newName;
  return JSON.stringify(system);
}
function changeSource(db, oldValue, newValue, edition = '') {
  const oldName = typeof oldValue === 'string' ? oldValue.trim() : '';
  const newName = typeof newValue === 'string' ? newValue.trim() : '';
  if (!oldName || oldName.length > 200 || newName.length > 200 || !['','1e','2e','2r'].includes(edition)) throw new Error('Invalid source name or edition');
  const registered = db.prepare('SELECT name FROM sources WHERE name = ? COLLATE NOCASE').get(oldName);
  const rows = db.prepare('SELECT id,type,system_json FROM items WHERE TRIM(source) = ? COLLATE NOCASE').all(oldName);
  if (!registered && rows.length === 0) return null;
  if (newName === oldName) return transaction(db, () => {
    db.prepare('INSERT INTO sources (name,edition) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET edition=excluded.edition').run(newName,edition);
    return { updated: 0 };
  });
  if (newName && oldName.toLowerCase() !== newName.toLowerCase()) {
    const duplicate = db.prepare("SELECT name FROM sources WHERE name=? COLLATE NOCASE UNION SELECT TRIM(source) AS name FROM items WHERE TRIM(source)=? COLLATE NOCASE LIMIT 1").get(newName,newName);
    if (duplicate) throw new Error('Source already exists');
  }
  return transaction(db, () => {
    for (const row of rows) {
      const itemSystem = updatePublication(row.system_json, oldName, newName);
      db.prepare('UPDATE items SET source=?,system_json=? WHERE id=?').run(newName,itemSystem,row.id);
      const table = TABLES[row.type];
      if (table) {
        const detail = db.prepare(`SELECT system_json FROM ${table} WHERE id=?`).get(row.id);
        if (detail) db.prepare(`UPDATE ${table} SET system_json=? WHERE id=?`).run(updatePublication(detail.system_json, oldName, newName),row.id);
      }
    }
    db.prepare('DELETE FROM sources WHERE name=? COLLATE NOCASE').run(oldName);
    if (newName) db.prepare('INSERT INTO sources (name,edition) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET edition=excluded.edition').run(newName,edition);
    return { updated: rows.length };
  });
}
module.exports = { changeSource };
