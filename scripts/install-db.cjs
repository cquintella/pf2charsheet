#!/usr/bin/env node
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const init = spawnSync(process.execPath, [path.join(__dirname, 'init-db.cjs')], { stdio: 'inherit' });
if (init.status !== 0) process.exit(init.status || 1);
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../pf2e.db');
const db = new DatabaseSync(dbPath);
const existingItems = db.prepare('SELECT COUNT(*) AS count FROM items').get().count;
db.close();
if (existingItems === 0) {
  const args = [path.join(__dirname, 'import-foundry.cjs')];
  if (process.env.FOUNDRY_SOURCE_DIR) args.push(`--source=${process.env.FOUNDRY_SOURCE_DIR}`);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) console.warn('Compêndio não importado. Execute npm run db:import-foundry quando a fonte estiver acessível.');
} else {
  console.log('Banco existente preservado; importação automática ignorada.');
}
