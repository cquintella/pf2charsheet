#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Import custom creatures into the local compendium.

Usage:
  node scripts/import-custom-creatures.cjs [--db=<path>]

Options:
  --db=<path>  SQLite database (defaults to SQLITE_DB_PATH or ./pf2e.db)
  -h, --help   Show this help

Examples:
  node scripts/import-custom-creatures.cjs
  node scripts/import-custom-creatures.cjs --db=/tmp/compendium.db`);
  process.exit(0);
}

const option = process.argv.find((argument) => argument.startsWith('--db='));
const databasePath = option ? option.slice('--db='.length) : process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../pf2e.db');
const sourcePath = path.resolve(__dirname, '../data/creatures/tigone.json');
const creature = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const database = new DatabaseSync(databasePath);
try {
  database.prepare(`
    INSERT INTO animals (id, name, slug, level, size, traits, rarity, hp, ac, fortitude, reflex, will, perception, speed, senses, img, source, description, system_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, slug=excluded.slug, level=excluded.level, size=excluded.size,
      traits=excluded.traits, hp=excluded.hp, ac=excluded.ac, fortitude=excluded.fortitude,
      reflex=excluded.reflex, will=excluded.will, perception=excluded.perception,
      speed=excluded.speed, senses=excluded.senses, description=excluded.description,
      system_json=excluded.system_json
  `).run(creature.id, creature.name, creature.slug, creature.level, creature.size,
    JSON.stringify(creature.traits), '', creature.hp, creature.ac, creature.fortitude,
    creature.reflex, creature.will, creature.perception, creature.speed,
    JSON.stringify(creature.senses), '', '', creature.description, JSON.stringify(creature.system));
  console.log(`Imported ${creature.name} into ${databasePath}`);
} finally {
  database.close();
}
