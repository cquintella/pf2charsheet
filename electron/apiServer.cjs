const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.ico': 'image/x-icon',
};

function resolveSqlJsWasmPath() {
  const pkgDist = path.dirname(require.resolve('sql.js'));
  const candidate = path.join(pkgDist, 'sql-wasm.wasm');
  const unpacked = candidate.replace('app.asar', 'app.asar.unpacked');
  if (fs.existsSync(unpacked)) return unpacked;
  return candidate;
}

function createDbAdapter(sqlDb, dbPath) {
  const persist = () => {
    const data = Buffer.from(sqlDb.export());
    const tmpPath = `${dbPath}.tmp`;
    fs.writeFileSync(tmpPath, data);
    fs.renameSync(tmpPath, dbPath);
  };

  return {
    prepare(sql) {
      return {
        all(...rawParams) {
          const params = rawParams.map((p) => (p === undefined ? null : p));
          const stmt = sqlDb.prepare(sql);
          try {
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) {
              rows.push(stmt.getAsObject());
            }
            return rows;
          } finally {
            stmt.free();
          }
        },
        get(...rawParams) {
          const params = rawParams.map((p) => (p === undefined ? null : p));
          const stmt = sqlDb.prepare(sql);
          try {
            stmt.bind(params);
            if (!stmt.step()) return undefined;
            return stmt.getAsObject();
          } finally {
            stmt.free();
          }
        },
        run(...rawParams) {
          const params = rawParams.map((p) => (p === undefined ? null : p));
          const stmt = sqlDb.prepare(sql);
          try {
            stmt.bind(params);
            stmt.step();
          } finally {
            stmt.free();
          }
          persist();
        },
      };
    },
    close() {
      sqlDb.close();
    },
  };
}

const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      bytes += chunk.length;
      if (bytes > MAX_JSON_BODY_BYTES) {
        aborted = true;
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, payload, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function startLocalServer({ dbPath, distDir, iconsDir }) {
  const initSqlJs = require('sql.js');
  const wasmPath = resolveSqlJsWasmPath();
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  const fileBuffer = fs.readFileSync(dbPath);
  const sqlDb = new SQL.Database(fileBuffer);
  const db = createDbAdapter(sqlDb, dbPath);

  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '/', true);
    let pathname = parsedUrl.pathname || '/';
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      /* keep raw pathname */
    }
    const method = req.method || 'GET';

    // ANCESTRIES ENDPOINT
    if (pathname === '/api/ancestries' && method === 'GET') {
      try {
        const rows = db.prepare(`
          SELECT a.*, i.img, i.rarity
          FROM ancestries a
          JOIN items i ON a.id = i.id
          ORDER BY a.name ASC
        `).all();
        return sendJson(res, rows);
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // HERITAGES ENDPOINT
    if (pathname === '/api/heritages' && method === 'GET') {
      try {
        const ancestrySlug = (parsedUrl.searchParams.get('ancestry') || '').trim().toLowerCase();
        const rows = ancestrySlug
          ? db.prepare(`
              SELECT h.*, i.img, i.rarity
              FROM heritages h
              JOIN items i ON h.id = i.id
              WHERE LOWER(COALESCE(h.ancestry_slug, '')) = ? OR h.ancestry_slug IS NULL OR h.ancestry_slug = ''
              ORDER BY CASE WHEN LOWER(COALESCE(h.ancestry_slug, '')) = ? THEN 0 ELSE 1 END, h.name ASC
            `).all(ancestrySlug, ancestrySlug)
          : db.prepare(`
              SELECT h.*, i.img, i.rarity
              FROM heritages h
              JOIN items i ON h.id = i.id
              ORDER BY h.name ASC
            `).all();
        return sendJson(res, rows);
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // CREATURES (ANIMALS) COMPENDIUM ENDPOINT
    if (pathname === '/api/creatures' && method === 'GET') {
      try {
        const search = (parsedUrl.searchParams.get('search') || '').trim();
        const letter = (parsedUrl.searchParams.get('letter') || '').trim().toLowerCase();
        const level = parsedUrl.searchParams.get('level') || '';
        const size = (parsedUrl.searchParams.get('size') || '').trim().toLowerCase();
        const rarity = (parsedUrl.searchParams.get('rarity') || '').trim().toLowerCase();
        const trait = (parsedUrl.searchParams.get('trait') || '').trim().toLowerCase();
        const limit = Math.min(200, Math.max(1, parseInt(parsedUrl.searchParams.get('limit') || '48', 10) || 48));
        const offset = Math.max(0, parseInt(parsedUrl.searchParams.get('offset') || '0', 10) || 0);

        const where = [];
        const params = [];
        if (search) {
          where.push('(LOWER(name) LIKE ? OR LOWER(traits) LIKE ? OR LOWER(description) LIKE ?)');
          const term = `%${search.toLowerCase()}%`;
          params.push(term, term, term);
        }
        if (/^[a-z]$/.test(letter)) {
          where.push('LOWER(name) LIKE ?');
          params.push(`${letter}%`);
        }
        if (level !== '' && level !== 'all') {
          where.push('level = ?');
          params.push(parseInt(level, 10));
        }
        if (size && size !== 'all') {
          where.push('LOWER(size) = ?');
          params.push(size);
        }
        if (rarity && rarity !== 'all') {
          where.push('LOWER(rarity) = ?');
          params.push(rarity);
        }
        if (trait && trait !== 'all') {
          where.push('LOWER(traits) LIKE ?');
          params.push(`%"${trait}"%`);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const countRow = db.prepare(`SELECT COUNT(*) as total FROM animals ${whereSql}`).get(...params);
        const rows = db.prepare(`SELECT * FROM animals ${whereSql} ORDER BY level ASC, name ASC LIMIT ? OFFSET ?`).all(...params, limit, offset);
        return sendJson(res, { total: countRow?.total || 0, creatures: rows });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // BACKGROUNDS ENDPOINT
    if (pathname === '/api/backgrounds' && method === 'GET') {
      try {
        const rows = db.prepare(`
          SELECT b.*, i.img, i.rarity
          FROM backgrounds b
          JOIN items i ON b.id = i.id
          ORDER BY b.name ASC
        `).all();
        return sendJson(res, rows);
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // CLASSES ENDPOINT
    if (pathname === '/api/classes' && method === 'GET') {
      try {
        const rows = db.prepare(`
          SELECT c.*, i.img, i.rarity
          FROM classes c
          JOIN items i ON c.id = i.id
          ORDER BY c.name ASC
        `).all();
        return sendJson(res, rows);
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // CHARACTERS ENDPOINT
    if (pathname === '/api/characters') {
      if (method === 'GET') {
        try {
          const rows = db.prepare(`
            SELECT id, name, level, ancestry, heritage, background, class, subclass, data_json, created_at, updated_at
            FROM characters
            ORDER BY updated_at DESC
          `).all();
          return sendJson(res, rows);
        } catch (err) {
          return sendJson(res, { error: err.message }, 500);
        }
      }

      if (method === 'POST') {
        readJsonBody(req)
          .then((data) => {
            try {
              const id = data.id || 'char_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              const name = data.name || 'Novo Personagem';
              const level = data.level || 1;
              const ancestry = data.ancestry || '';
              const heritage = data.heritage || '';
              const background = data.background || '';
              const className = data.class || '';
              const subclass = data.subclass || '';
              const dataJson = typeof data.data === 'string' ? data.data : JSON.stringify(data.data || {});

              db.prepare(`
                INSERT INTO characters (id, name, level, ancestry, heritage, background, class, subclass, data_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                  name = excluded.name,
                  level = excluded.level,
                  ancestry = excluded.ancestry,
                  heritage = excluded.heritage,
                  background = excluded.background,
                  class = excluded.class,
                  subclass = excluded.subclass,
                  data_json = excluded.data_json,
                  updated_at = CURRENT_TIMESTAMP
              `).run(id, name, level, ancestry, heritage, background, className, subclass, dataJson);

              return sendJson(res, { success: true, id });
            } catch (err) {
              return sendJson(res, { error: err.message }, 500);
            }
          })
          .catch(() => sendJson(res, { error: 'JSON inválido' }, 400));
        return;
      }
    }

    if (pathname.startsWith('/api/characters/') && method === 'DELETE') {
      const id = pathname.replace('/api/characters/', '');
      try {
        db.prepare('DELETE FROM characters WHERE id = ?').run(id);
        return sendJson(res, { success: true });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // LIST SPELL ICONS ENDPOINT
    if (pathname === '/api/icons/spells' && method === 'GET') {
      try {
        if (!iconsDir || !fs.existsSync(iconsDir)) {
          return sendJson(res, []);
        }
        const files = fs
          .readdirSync(iconsDir)
          .filter((f) => f.endsWith('.webp') || f.endsWith('.svg') || f.endsWith('.png'))
          .sort();

        const icons = files.map((file) => ({
          filename: file,
          name: file.replace(/\.[^/.]+$/, '').replace(/-/g, ' '),
          path: `systems/pf2e/icons/spells/${file}`,
          url: `/assets/icons/spells/${file}`,
        }));

        return sendJson(res, icons);
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // UPDATE SPELL ICON ENDPOINT
    if (pathname.startsWith('/api/spells/') && pathname.endsWith('/icon') && method === 'PUT') {
      const id = pathname.replace('/api/spells/', '').replace('/icon', '');
      readJsonBody(req)
        .then((data) => {
          try {
            const img = data.img;
            if (!img) return sendJson(res, { error: 'Campo img obrigatorio' }, 400);
            db.prepare('UPDATE items SET img = ? WHERE id = ?').run(img, id);
            return sendJson(res, { success: true, img });
          } catch (err) {
            return sendJson(res, { error: err.message }, 500);
          }
        })
        .catch(() => sendJson(res, { error: 'JSON invalido' }, 400));
      return;
    }

    // SPELLBOOKS ENDPOINTS
    if (pathname === '/api/spellbooks') {
      if (method === 'GET') {
        try {
          const rows = db.prepare(`
            SELECT id, name, tradition, caster_class, description, spells_json, created_at, updated_at
            FROM spellbooks
            ORDER BY updated_at DESC
          `).all();
          return sendJson(res, rows);
        } catch (err) {
          return sendJson(res, { error: err.message }, 500);
        }
      }

      if (method === 'POST') {
        readJsonBody(req)
          .then((data) => {
            try {
              const id = data.id || 'sb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              const name = data.name || 'Novo Grimório';
              const tradition = data.tradition || 'arcane';
              const casterClass = data.caster_class || 'Wizard';
              const description = data.description || '';
              const spellsJson = typeof data.spells === 'string' ? data.spells : JSON.stringify(data.spells || []);

              db.prepare(`
                INSERT INTO spellbooks (id, name, tradition, caster_class, description, spells_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).run(id, name, tradition, casterClass, description, spellsJson);

              return sendJson(res, { success: true, id });
            } catch (err) {
              return sendJson(res, { error: err.message }, 500);
            }
          })
          .catch(() => sendJson(res, { error: 'JSON inválido' }, 400));
        return;
      }
    }

    if (pathname.startsWith('/api/spellbooks/')) {
      const id = pathname.replace('/api/spellbooks/', '');

      if (method === 'GET') {
        try {
          const sb = db.prepare('SELECT * FROM spellbooks WHERE id = ?').get(id);
          if (!sb) return sendJson(res, { error: 'Grimório não encontrado' }, 404);

          let spellIds = [];
          try {
            spellIds = JSON.parse(sb.spells_json || '[]');
          } catch {
            /* ignore */
          }

          let hydratedSpells = [];
          if (spellIds.length > 0) {
            const placeholders = spellIds.map(() => '?').join(',');
            hydratedSpells = db
              .prepare(`
                SELECT s.*, i.img, i.rarity
                FROM spells s
                JOIN items i ON s.id = i.id
                WHERE s.id IN (${placeholders})
              `)
              .all(...spellIds);
          }

          return sendJson(res, { ...sb, spells: hydratedSpells });
        } catch (err) {
          return sendJson(res, { error: err.message }, 500);
        }
      }

      if (method === 'PUT') {
        readJsonBody(req)
          .then((data) => {
            try {
              const name = data.name;
              const tradition = data.tradition;
              const casterClass = data.caster_class;
              const description = data.description;
              const spellsJson = typeof data.spells === 'string' ? data.spells : JSON.stringify(data.spells || []);

              db.prepare(`
                UPDATE spellbooks
                SET name = COALESCE(?, name),
                    tradition = COALESCE(?, tradition),
                    caster_class = COALESCE(?, caster_class),
                    description = COALESCE(?, description),
                    spells_json = COALESCE(?, spells_json),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).run(name, tradition, casterClass, description, spellsJson, id);

              return sendJson(res, { success: true });
            } catch (err) {
              return sendJson(res, { error: err.message }, 500);
            }
          })
          .catch(() => sendJson(res, { error: 'JSON inválido' }, 400));
        return;
      }

      if (method === 'DELETE') {
        try {
          db.prepare('DELETE FROM spellbooks WHERE id = ?').run(id);
          return sendJson(res, { success: true });
        } catch (err) {
          return sendJson(res, { error: err.message }, 500);
        }
      }
    }

    // METADATA ENDPOINT
    if (pathname === '/api/metadata') {
      try {
        const traitRows = db.prepare('SELECT traits FROM spells').all();
        const traitCounts = {};
        for (const r of traitRows) {
          try {
            const list = JSON.parse(r.traits);
            for (const t of list) {
              traitCounts[t] = (traitCounts[t] || 0) + 1;
            }
          } catch {
            /* ignore */
          }
        }
        const sortedTraits = Object.entries(traitCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));

        return sendJson(res, {
          traditions: ['arcane', 'divine', 'occult', 'primal'],
          categories: ['spell', 'cantrip', 'focus', 'ritual'],
          ranks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          defenses: ['fortitude', 'reflex', 'will', 'ac'],
          actionTypes: ['1', '2', '3', 'reaction', 'free'],
          traits: sortedTraits,
          totalSpells: db.prepare('SELECT count(*) as count FROM spells').get().count,
        });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // SPELLS QUERY ENDPOINT
    if (pathname === '/api/spells') {
      try {
        const query = parsedUrl.query;
        const search = String(query.search || '').trim().toLowerCase();
        const rank = query.rank;
        const tradition = query.tradition;
        const category = query.category;
        const defense = query.defense;
        const actions = query.actions;
        const trait = query.trait;
        const rarity = query.rarity;
        const ids = query.ids;
        const limit = Math.min(200, Math.max(1, parseInt(String(query.limit || '60'), 10) || 60));
        const offset = Math.max(0, parseInt(String(query.offset || '0'), 10) || 0);

        const conditions = [];
        const params = [];

        if (ids !== undefined) {
          const idList = String(ids).split(',').map((s) => s.trim()).filter(Boolean);
          if (idList.length === 0) {
            conditions.push('1 = 0');
          } else {
            conditions.push(`s.id IN (${idList.map(() => '?').join(',')})`);
            params.push(...idList);
          }
        }

        if (search) {
          conditions.push('(LOWER(s.name) LIKE ? OR LOWER(s.traits) LIKE ? OR LOWER(s.description) LIKE ?)');
          const term = `%${search}%`;
          params.push(term, term, term);
        }

        if (rank !== undefined && rank !== '' && rank !== 'all') {
          const r = parseInt(String(rank), 10);
          if (r === 0) {
            conditions.push("s.traits LIKE '%\"cantrip\"%'");
          } else {
            conditions.push('s.rank = ?');
            params.push(r);
          }
        }

        if (tradition && tradition !== 'all') {
          conditions.push('s.traditions LIKE ?');
          params.push(`%"${tradition}"%`);
        }

        if (category && category !== 'all') {
          if (category === 'cantrip') {
            conditions.push("(s.category = 'cantrip' OR s.traits LIKE '%\"cantrip\"%')");
          } else if (category === 'focus') {
            conditions.push("(s.category = 'focus' OR s.traits LIKE '%\"focus\"%')");
          } else if (category === 'ritual') {
            conditions.push("(s.category = 'ritual' OR s.traits LIKE '%\"ritual\"%' OR s.system_json LIKE '%\"ritual\":{%')");
          } else if (category === 'spell') {
            conditions.push("(s.category = 'spell' OR (s.traits NOT LIKE '%\"cantrip\"%' AND s.traits NOT LIKE '%\"focus\"%' AND s.traits NOT LIKE '%\"ritual\"%' AND s.system_json NOT LIKE '%\"ritual\":{%'))");
          }
        }

        if (defense && defense !== 'all') {
          conditions.push('s.defense = ?');
          params.push(defense);
        }

        if (actions && actions !== 'all') {
          conditions.push('s.time = ?');
          params.push(actions);
        }

        if (trait && trait !== 'all') {
          conditions.push('s.traits LIKE ?');
          params.push(`%"${trait}"%`);
        }

        if (rarity && rarity !== 'all') {
          conditions.push('i.rarity = ?');
          params.push(rarity);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const total = db.prepare(`SELECT count(*) as total FROM spells s JOIN items i ON s.id = i.id ${whereClause}`).get(...params).total;

        const rows = db
          .prepare(`
            SELECT
              s.id, s.name, s.slug, s.rank, s.category, s.traditions,
              s.traits, s.time, s.range, s.target, s.area, s.duration,
              s.defense, s.description, s.system_json, i.img, i.rarity
            FROM spells s
            JOIN items i ON s.id = i.id
            ${whereClause}
            ORDER BY s.rank ASC, s.name ASC
            LIMIT ? OFFSET ?
          `)
          .all(...params, limit, offset);

        return sendJson(res, { total, spells: rows });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    if (pathname.startsWith('/api/spells/')) {
      const id = pathname.replace('/api/spells/', '');
      try {
        const spell = db
          .prepare(`
            SELECT s.*, i.img, i.rarity, i.source, s.system_json
            FROM spells s
            JOIN items i ON s.id = i.id
            WHERE s.id = ?
          `)
          .get(id);
        if (!spell) return sendJson(res, { error: 'Spell not found' }, 404);
        return sendJson(res, spell);
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // EQUIPMENT ENDPOINT
    if (pathname === '/api/equipment') {
      try {
        const search = String(parsedUrl.query.search || '').trim().toLowerCase();
        const type = String(parsedUrl.query.type || 'all');
        const offset = Math.max(0, Number.parseInt(String(parsedUrl.query.offset || '0'), 10) || 0);
        const conditions = ['LOWER(e.name) LIKE ?'];
        const params = [`%${search}%`];
        if (type !== 'all') {
          conditions.push('e.item_type = ?');
          params.push(type);
        }
        const initial = String(parsedUrl.query.initial || '').toLowerCase();
        if (/^[a-z]$/.test(initial)) {
          conditions.push('LOWER(e.name) LIKE ?');
          params.push(`${initial}%`);
        }
        const level = String(parsedUrl.query.level || 'all');
        const rarity = String(parsedUrl.query.rarity || 'all');
        const ids = parsedUrl.query.ids;
        if (level !== 'all' && /^\d+$/.test(level)) {
          conditions.push('e.level = ?');
          params.push(Number(level));
        }
        if (rarity !== 'all') {
          conditions.push('e.rarity = ?');
          params.push(rarity);
        }
        if (ids !== undefined) {
          const list = String(ids).split(',').filter(Boolean);
          if (!list.length) conditions.push('1 = 0');
          else {
            conditions.push(`e.id IN (${list.map(() => '?').join(',')})`);
            params.push(...list);
          }
        }
        const where = conditions.join(' AND ');
        const total = db.prepare(`SELECT count(*) AS total FROM equipment e WHERE ${where}`).get(...params).total;
        const items = db
          .prepare(`SELECT e.id, e.name, e.item_type, e.level, e.price, e.bulk, e.description, e.system_json, e.traits, e.rarity, i.img FROM equipment e LEFT JOIN items i ON e.id = i.id WHERE ${where} ORDER BY e.name LIMIT 40 OFFSET ?`)
          .all(...params, offset);
        return sendJson(res, { items, total });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // FEATS METADATA ENDPOINT
    if (pathname === '/api/metadata/feats') {
      try {
        const traitRows = db.prepare('SELECT traits FROM feats').all();
        const traitCounts = {};
        for (const r of traitRows) {
          try {
            const list = JSON.parse(r.traits);
            for (const t of list) {
              traitCounts[t] = (traitCounts[t] || 0) + 1;
            }
          } catch {
            /* ignore */
          }
        }
        const sortedTraits = Object.entries(traitCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count }));

        return sendJson(res, {
          categories: ['class', 'ancestry', 'skill', 'general', 'classfeature', 'ancestryfeature'],
          levels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
          actionTypes: ['passive', 'action', 'reaction', 'free'],
          actions: ['1', '2', '3'],
          rarities: ['common', 'uncommon', 'rare', 'unique'],
          traits: sortedTraits,
          totalFeats: db.prepare('SELECT count(*) as count FROM feats').get().count,
        });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // FEATS QUERY ENDPOINT
    if (pathname === '/api/feats') {
      try {
        const query = parsedUrl.query;
        const search = String(query.search || '').trim().toLowerCase();
        const category = query.category;
        const level = query.level;
        const max_level = query.max_level;
        const action_type = query.action_type;
        const actions = query.actions;
        const trait = query.trait;
        const rarity = query.rarity;
        const ids = query.ids;
        const limit = Math.min(200, Math.max(1, parseInt(String(query.limit || '60'), 10) || 60));
        const offset = Math.max(0, parseInt(String(query.offset || '0'), 10) || 0);

        const conditions = [];
        const params = [];

        if (ids !== undefined) {
          const idList = String(ids).split(',').map((s) => s.trim()).filter(Boolean);
          if (idList.length === 0) {
            conditions.push('1 = 0');
          } else {
            conditions.push(`f.id IN (${idList.map(() => '?').join(',')})`);
            params.push(...idList);
          }
        }

        if (search) {
          conditions.push('(LOWER(f.name) LIKE ? OR LOWER(f.traits) LIKE ? OR LOWER(f.description) LIKE ? OR LOWER(f.prerequisites) LIKE ?)');
          const term = `%${search}%`;
          params.push(term, term, term, term);
        }

        if (category && category !== 'all') {
          conditions.push('f.category = ?');
          params.push(category);
        }

        if (max_level !== undefined && max_level !== '' && max_level !== 'all') {
          conditions.push('f.level <= ?');
          params.push(parseInt(String(max_level), 10));
        } else if (level !== undefined && level !== '' && level !== 'all') {
          conditions.push('f.level = ?');
          params.push(parseInt(String(level), 10));
        }

        if (action_type && action_type !== 'all') {
          conditions.push('f.action_type = ?');
          params.push(action_type);
        }

        if (actions && actions !== 'all') {
          conditions.push('f.actions = ?');
          params.push(actions);
        }

        if (trait && trait !== 'all') {
          conditions.push('f.traits LIKE ?');
          params.push(`%"${trait}"%`);
        }

        if (rarity && rarity !== 'all') {
          conditions.push('i.rarity = ?');
          params.push(rarity);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const total = db.prepare(`SELECT count(*) as total FROM feats f JOIN items i ON f.id = i.id ${whereClause}`).get(...params).total;

        const rows = db
          .prepare(`
            SELECT
              f.id, f.name, f.slug, f.category, f.level, f.action_type,
              f.actions, f.prerequisites, f.traits, f.description,
              f.system_json, i.img, i.rarity
            FROM feats f
            JOIN items i ON f.id = i.id
            ${whereClause}
            ORDER BY f.level ASC, f.name ASC
            LIMIT ? OFFSET ?
          `)
          .all(...params, limit, offset);

        return sendJson(res, { total, feats: rows });
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    if (pathname.startsWith('/api/feats/')) {
      const id = pathname.replace('/api/feats/', '');
      try {
        const feat = db
          .prepare(`
            SELECT f.*, i.img, i.rarity, i.source, f.system_json
            FROM feats f
            JOIN items i ON f.id = i.id
            WHERE f.id = ?
          `)
          .get(id);
        if (!feat) return sendJson(res, { error: 'Feat not found' }, 404);
        return sendJson(res, feat);
      } catch (err) {
        return sendJson(res, { error: err.message }, 500);
      }
    }

    // STATIC FILE SERVING FROM distDir
    const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const resolvedDist = path.resolve(distDir);
    let filePath = path.resolve(resolvedDist, relPath);
    if (!filePath.startsWith(resolvedDist)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(resolvedDist, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        port: address.port,
        close: () => {
          server.close();
          db.close();
        },
      });
    });
  });
}

module.exports = { startLocalServer };
