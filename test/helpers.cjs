const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CATALOG = path.join(ROOT, 'pf2e.db');
const BUNDLED = path.join(ROOT, 'build-resources', 'pf2e.db');

/** Real catalog DBs are git-ignored; tests that need them are skipped when absent. */
const skipNoCatalog = fs.existsSync(CATALOG) ? false : 'pf2e.db not found (run npm run db:init / import)';
const skipNoBundled = fs.existsSync(BUNDLED) && fs.existsSync(CATALOG) ? false : 'build-resources/pf2e.db not found (run npm run dist:prepare)';

/** Copies the real catalog into a fresh temp dir so tests never touch the user's data. */
function tempCatalog(source = CATALOG) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf2-test-'));
  fs.copyFileSync(source, path.join(dir, 'pf2e.db'));
  return { dir, dbPath: path.join(dir, 'pf2e.db'), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** Minimal JSON client bound to a running server. */
function client(port) {
  const base = `http://127.0.0.1:${port}`;
  return async (p, { method = 'GET', body } = {}) => {
    const res = await fetch(base + p, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    return { status: res.status, json, text };
  };
}

module.exports = { ROOT, CATALOG, BUNDLED, skipNoCatalog, skipNoBundled, tempCatalog, client };
