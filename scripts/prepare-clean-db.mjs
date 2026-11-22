import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';

const rootDir = process.cwd();
const sourceDb = path.join(rootDir, 'pf2e.db');
const outDir = path.join(rootDir, 'build-resources');
const cleanDb = path.join(outDir, 'pf2e.db');

if (!fs.existsSync(sourceDb)) {
  console.error('pf2e.db not found at', sourceDb);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(sourceDb, cleanDb);
execFileSync(process.execPath, [path.join(rootDir, 'scripts/import-custom-creatures.cjs'), `--db=${cleanDb}`], { stdio: 'inherit' });

const db = new DatabaseSync(cleanDb);
db.exec('DELETE FROM characters; DELETE FROM spellbooks; VACUUM;');
const charCount = db.prepare('SELECT count(*) AS count FROM characters').get().count;
const sbCount = db.prepare('SELECT count(*) AS count FROM spellbooks').get().count;
const spellCount = db.prepare('SELECT count(*) AS count FROM spells').get().count;
db.close();

console.log(`Prepared clean database at ${cleanDb} (characters=${charCount}, spellbooks=${sbCount}, spells=${spellCount})`);
