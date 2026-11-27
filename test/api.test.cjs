const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startLocalServer } = require('../electron/apiServer.cjs');
const { ROOT, skipNoCatalog, tempCatalog, client } = require('./helpers.cjs');

describe('apiServer (real catalog copy)', { skip: skipNoCatalog }, () => {
  let tmp; let server; let api;
  before(async () => {
    tmp = tempCatalog();
    server = await startLocalServer({ dbPath: tmp.dbPath, distDir: path.join(ROOT, 'dist'), iconsDir: null });
    api = client(server.port);
  });
  after(() => { server?.close(); tmp?.cleanup(); });

  describe('read endpoints (regression: B1 — url.parse has no searchParams)', () => {
    it('GET /api/heritages filters by ancestry and lists that ancestry first', async () => {
      const { status, json } = await api('/api/heritages?ancestry=elf');
      assert.equal(status, 200);
      assert.ok(json.length > 0);
      assert.equal(json[0].ancestry_slug, 'elf');
    });
    it('GET /api/heritages without filter returns all', async () => {
      const all = await api('/api/heritages');
      const elf = await api('/api/heritages?ancestry=elf');
      assert.equal(all.status, 200);
      assert.ok(all.json.length >= elf.json.length);
    });
    it('GET /api/creatures paginates and honours limit', async () => {
      const { status, json } = await api('/api/creatures?limit=3');
      assert.equal(status, 200);
      assert.equal(json.creatures.length, 3);
      assert.ok(json.total >= 3);
    });
    it('GET /api/creatures clamps limit to 200', async () => {
      const { json } = await api('/api/creatures?limit=99999');
      assert.ok(json.creatures.length <= 200);
    });
    it('GET /api/creatures search narrows results', async () => {
      const all = await api('/api/creatures?limit=1');
      const wolf = await api('/api/creatures?search=wolf&limit=1');
      assert.ok(wolf.json.total > 0 && wolf.json.total < all.json.total);
    });
  });

  describe('smoke: every GET list endpoint answers 200 with data', () => {
    for (const route of ['/api/ancestries', '/api/backgrounds', '/api/classes', '/api/sources', '/api/metadata', '/api/metadata/feats', '/api/spells?limit=1', '/api/feats?limit=1', '/api/equipment']) {
      it(route, async () => {
        const { status, json } = await api(route);
        assert.equal(status, 200, JSON.stringify(json));
        assert.ok(json && (Array.isArray(json) ? json.length > 0 : Object.keys(json).length > 0));
      });
    }
    it('unknown spell/feat ids return 404', async () => {
      assert.equal((await api('/api/spells/nope')).status, 404);
      assert.equal((await api('/api/feats/nope')).status, 404);
    });
  });

  describe('characters (user.db)', () => {
    it('creates, lists, updates preserving created_at, and deletes', async () => {
      const created = await api('/api/characters', { method: 'POST', body: { id: 't1', name: 'A', level: 3, data: { x: 1 } } });
      assert.equal(created.status, 200);
      const first = (await api('/api/characters')).json.find((c) => c.id === 't1');
      assert.equal(first.level, 3);
      assert.deepEqual(JSON.parse(first.data_json), { x: 1 });
      await new Promise((r) => setTimeout(r, 1100));
      await api('/api/characters', { method: 'POST', body: { id: 't1', name: 'B', data: {} } });
      const second = (await api('/api/characters')).json.find((c) => c.id === 't1');
      assert.equal(second.name, 'B');
      assert.equal(second.created_at, first.created_at);
      assert.equal((await api('/api/characters/t1', { method: 'DELETE' })).status, 200);
      assert.ok(!(await api('/api/characters')).json.some((c) => c.id === 't1'));
    });
    it('accepts concurrent saves', async () => {
      const results = await Promise.all(Array.from({ length: 15 }, (_, i) => api('/api/characters', { method: 'POST', body: { id: `p${i}`, name: `P${i}`, data: {} } })));
      assert.ok(results.every((r) => r.status === 200));
      const ids = new Set((await api('/api/characters')).json.map((c) => c.id));
      for (let i = 0; i < 15; i++) assert.ok(ids.has(`p${i}`));
    });
    it('rejects invalid JSON with 400', async () => {
      const res = await fetch(`http://127.0.0.1:${server.port}/api/characters`, { method: 'POST', body: '{nope' });
      assert.equal(res.status, 400);
    });
    it('rejects bodies over 5 MB', async () => {
      const res = await fetch(`http://127.0.0.1:${server.port}/api/characters`, { method: 'POST', body: JSON.stringify({ name: 'big', data: { pad: 'x'.repeat(5.5 * 1024 * 1024) } }) }).catch((e) => e);
      assert.ok(res instanceof Error || res.status >= 400);
    });
  });

  describe('spellbooks (user.db) hydrated from the catalog', () => {
    it('round-trips spells and supports PUT/DELETE', async () => {
      const spells = (await api('/api/spells?limit=2')).json.spells.map((s) => s.id);
      const { json: { id } } = await api('/api/spellbooks', { method: 'POST', body: { name: 'S', spells } });
      const got = (await api(`/api/spellbooks/${id}`)).json;
      assert.equal(got.spells.length, 2);
      assert.equal((await api(`/api/spellbooks/${id}`, { method: 'PUT', body: { name: 'S2' } })).status, 200);
      assert.equal((await api(`/api/spellbooks/${id}`)).json.name, 'S2');
      assert.equal((await api(`/api/spellbooks/${id}`, { method: 'DELETE' })).status, 200);
      assert.equal((await api(`/api/spellbooks/${id}`)).status, 404);
    });
  });

  describe('input validation', () => {
    it('rejects an invalid feat', async () => {
      assert.equal((await api('/api/feats', { method: 'POST', body: { name: '' } })).status, 400);
    });
    it('creates, edits and deletes a custom feat', async () => {
      const feat = { name: 'Test Feat', level: 1, category: 'general', rarity: 'common', action_type: 'passive', traits: ['Test'], prerequisites: [], description: '<p>x</p>' };
      const created = await api('/api/feats', { method: 'POST', body: feat });
      assert.equal(created.status, 201);
      const { id } = created.json;
      assert.match(id, /^custom-feat-/);
      assert.equal((await api(`/api/feats/${id}`, { method: 'PUT', body: { ...feat, level: 2 } })).status, 200);
      assert.equal((await api(`/api/feats/${id}`)).json.level, 2);
      assert.equal((await api(`/api/feats/${id}`, { method: 'DELETE' })).status, 200);
      assert.equal((await api(`/api/feats/${id}`)).status, 404);
    });
    it('rejects invalid source edition', async () => {
      assert.equal((await api('/api/sources', { method: 'POST', body: { name: 'X', edition: '9z' } })).status, 400);
    });
  });

  describe('static serving', () => {
    it('blocks path traversal', async () => {
      const res = await fetch(`http://127.0.0.1:${server.port}/..%2f..%2fpackage.json`);
      const body = await res.text();
      assert.ok(!body.includes('"pf2charsheet"'));
    });
  });
});

describe('user.db migration', { skip: skipNoCatalog }, () => {
  it('copies legacy characters from the catalog once and persists across restarts', async () => {
    const tmp = tempCatalog();
    try {
      let server = await startLocalServer({ dbPath: tmp.dbPath, distDir: path.join(ROOT, 'dist'), iconsDir: null });
      const first = (await client(server.port)('/api/characters')).json.length;
      server.close();
      assert.ok(fs.existsSync(path.join(tmp.dir, 'user.db')));
      server = await startLocalServer({ dbPath: tmp.dbPath, distDir: path.join(ROOT, 'dist'), iconsDir: null });
      const again = client(server.port);
      assert.equal((await again('/api/characters')).json.length, first);
      await again('/api/characters', { method: 'POST', body: { id: 'persist', name: 'P', data: {} } });
      server.close();
      server = await startLocalServer({ dbPath: tmp.dbPath, distDir: path.join(ROOT, 'dist'), iconsDir: null });
      assert.ok((await client(server.port)('/api/characters')).json.some((c) => c.id === 'persist'));
      server.close();
    } finally { tmp.cleanup(); }
  });
});
