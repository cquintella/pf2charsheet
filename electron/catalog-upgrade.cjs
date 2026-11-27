const fs = require('fs');

// Tables whose rows are carried from the old catalog into a freshly bundled one.
// `where` limits the rows (user-created content only); null copies everything.
const CARRY = [
  { table: 'characters', where: null },
  { table: 'spellbooks', where: null },
  { table: 'sources', where: null },
  { table: 'items', where: "id LIKE 'custom-%'" },
  { table: 'feats', where: "id LIKE 'custom-%'" },
  { table: 'spells', where: "id LIKE 'custom-%'" },
  { table: 'equipment', where: "id LIKE 'custom-%'" },
];

function hasTable(db, table) {
  const stmt = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?");
  try { stmt.bind([table]); return stmt.step(); } finally { stmt.free(); }
}

function columnsOf(db, table) {
  const stmt = db.prepare(`PRAGMA table_info(${table})`);
  const names = [];
  try { while (stmt.step()) names.push(stmt.getAsObject().name); } finally { stmt.free(); }
  return names;
}

/**
 * Replaces the user's catalog DB with the bundled one, keeping user data.
 * The previous file is saved as `<path>.bak` first. Only columns present in both
 * schemas are copied, so schema changes between versions do not break the upgrade.
 * Returns the number of carried rows per table.
 */
function upgradeCatalog(SQL, userCatalogPath, bundledPath) {
  const oldDb = new SQL.Database(fs.readFileSync(userCatalogPath));
  const newDb = new SQL.Database(fs.readFileSync(bundledPath));
  const carried = {};
  try {
    newDb.run('BEGIN');
    for (const { table, where } of CARRY) {
      if (!hasTable(oldDb, table) || !hasTable(newDb, table)) continue;
      const newCols = new Set(columnsOf(newDb, table));
      const cols = columnsOf(oldDb, table).filter((c) => newCols.has(c));
      if (!cols.length) continue;
      const select = oldDb.prepare(`SELECT ${cols.join(',')} FROM ${table}${where ? ` WHERE ${where}` : ''}`);
      const insert = newDb.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
      let count = 0;
      try {
        while (select.step()) { insert.run(select.get()); count++; }
      } finally { select.free(); insert.free(); }
      carried[table] = count;
    }
    newDb.run('COMMIT');
    fs.copyFileSync(userCatalogPath, `${userCatalogPath}.bak`);
    const tmp = `${userCatalogPath}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(newDb.export()));
    fs.renameSync(tmp, userCatalogPath);
    return carried;
  } finally {
    oldDb.close();
    newDb.close();
  }
}

module.exports = { upgradeCatalog };
