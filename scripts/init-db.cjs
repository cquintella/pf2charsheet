#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../pf2e.db');
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const db = new DatabaseSync(dbPath);
try {
  db.exec('BEGIN');
  db.exec(schema);
  db.exec('COMMIT');
  console.log(`Banco inicializado: ${dbPath}`);
} catch (error) {
  try { db.exec('ROLLBACK'); } catch {}
  console.error('Não foi possível inicializar o banco:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
