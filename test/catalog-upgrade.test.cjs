const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { upgradeCatalog } = require('../electron/catalog-upgrade.cjs');
const { startLocalServer, resolveSqlJsWasmPath } = require('../electron/apiServer.cjs');
const { ROOT, BUNDLED, skipNoBundled, tempCatalog, client } = require('./helpers.cjs');

describe('upgradeCatalog', { skip: skipNoBundled }, () => {
  it('replaces the catalog but keeps characters, spellbooks, sources and custom rows', async () => {
    const tmp = tempCatalog();
    try {
      const old = new DatabaseSync(tmp.dbPath);
      old.exec(`INSERT INTO items(id,name,slug,type,level,rarity,traits,category,source,img,description,system_json) VALUES('custom-feat-1','Mine','mine','feat',1,'common','[]','general','','','d','{}');
        INSERT INTO feats(id,name,slug,category,level,action_type,actions,prerequisites,traits,rarity,description,system_json) VALUES('custom-feat-1','Mine','mine','general',1,'passive','','[]','[]','common','d','{}');
        INSERT INTO sources(name,edition) VALUES('MySource','2e');
        INSERT INTO characters(id,name,data_json) VALUES('legacy','L','{}');`);
      const before = old.prepare('SELECT count(*) AS n FROM characters').get().n;
      old.close();

      const SQL = await require('sql.js')({ locateFile: () => resolveSqlJsWasmPath() });
      const carried = upgradeCatalog(SQL, tmp.dbPath, BUNDLED);
      assert.ok(carried.characters >= 1 && carried.feats >= 1 && carried.sources >= 1);
      assert.ok(fs.existsSync(`${tmp.dbPath}.bak`), 'backup of the previous catalog');

      const db = new DatabaseSync(tmp.dbPath);
      assert.equal(db.prepare('SELECT count(*) AS n FROM characters').get().n, before);
      assert.equal(db.prepare("SELECT name FROM feats WHERE id='custom-feat-1'").get().name, 'Mine');
      assert.equal(db.prepare("SELECT edition FROM sources WHERE name='MySource'").get().edition, '2e');
      db.close();

      const server = await startLocalServer({ dbPath: tmp.dbPath, distDir: path.join(ROOT, 'dist'), iconsDir: null });
      try {
        const api = client(server.port);
        assert.ok((await api('/api/characters')).json.some((c) => c.id === 'legacy'));
        assert.equal((await api('/api/feats/custom-feat-1')).json.name, 'Mine');
      } finally { server.close(); }
    } finally { tmp.cleanup(); }
  });
});
