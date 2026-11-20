import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import url from 'url';
import fs from 'fs';

function sqlitePlugin() {
  let db: any = null;

  return {
    name: 'pf2e-sqlite-api',
    configureServer(server: any) {
      const dbPath = path.resolve(__dirname, 'pf2e.db');
      db = new DatabaseSync(dbPath);

      server.middlewares.use((req: any, res: any, next: any) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname || '';
        const method = req.method;

        const readBody = () => new Promise<any>((resolve, reject) => {
          let body = '';
          req.on('data', (chunk: any) => body += chunk);
          req.on('end', () => {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch (e) {
              reject(e);
            }
          });
        });

        // ANCESTRIES ENDPOINT
        if (pathname === '/api/ancestries' && method === 'GET') {
          try {
            const sql = `
              SELECT a.*, i.img, i.rarity
              FROM ancestries a
              JOIN items i ON a.id = i.id
              ORDER BY a.name ASC
            `;
            const rows = db.prepare(sql).all();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(rows));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // BACKGROUNDS ENDPOINT
        if (pathname === '/api/backgrounds' && method === 'GET') {
          try {
            const sql = `
              SELECT b.*, i.img, i.rarity
              FROM backgrounds b
              JOIN items i ON b.id = i.id
              ORDER BY b.name ASC
            `;
            const rows = db.prepare(sql).all();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(rows));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // CLASSES ENDPOINT
        if (pathname === '/api/classes' && method === 'GET') {
          try {
            const sql = `
              SELECT c.*, i.img, i.rarity
              FROM classes c
              JOIN items i ON c.id = i.id
              ORDER BY c.name ASC
            `;
            const rows = db.prepare(sql).all();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(rows));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
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
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(rows));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          if (method === 'POST') {
            readBody().then((data) => {
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
                  INSERT OR REPLACE INTO characters (id, name, level, ancestry, heritage, background, class, subclass, data_json, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(id, name, level, ancestry, heritage, background, className, subclass, dataJson);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, id }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            }).catch(() => {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'JSON inválido' }));
            });
            return;
          }
        }

        if (pathname.startsWith('/api/characters/') && method === 'DELETE') {
          const id = pathname.replace('/api/characters/', '');
          try {
            db.prepare('DELETE FROM characters WHERE id = ?').run(id);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // LIST SPELL ICONS ENDPOINT
        if (pathname === '/api/icons/spells' && method === 'GET') {
          try {
            const iconsDir = path.resolve(__dirname, 'public/assets/icons/spells');
            if (!fs.existsSync(iconsDir)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            const files = fs.readdirSync(iconsDir)
              .filter(f => f.endsWith('.webp') || f.endsWith('.svg') || f.endsWith('.png'))
              .sort();

            const icons = files.map(file => ({
              filename: file,
              name: file.replace(/\.[^/.]+$/, '').replace(/-/g, ' '),
              path: `systems/pf2e/icons/spells/${file}`,
              url: `/assets/icons/spells/${file}`
            }));

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(icons));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // UPDATE SPELL ICON ENDPOINT
        if (pathname.startsWith('/api/spells/') && pathname.endsWith('/icon') && method === 'PUT') {
          const id = pathname.replace('/api/spells/', '').replace('/icon', '');
          readBody().then((data) => {
            try {
              const img = data.img;
              if (!img) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Campo img obrigatorio' }));
                return;
              }

              db.prepare('UPDATE items SET img = ? WHERE id = ?').run(img, id);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, img }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          }).catch(() => {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'JSON invalido' }));
          });
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
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(rows));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          if (method === 'POST') {
            readBody().then((data) => {
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

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, id }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            }).catch(() => {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'JSON inválido' }));
            });
            return;
          }
        }

        if (pathname.startsWith('/api/spellbooks/')) {
          const id = pathname.replace('/api/spellbooks/', '');

          if (method === 'GET') {
            try {
              const sb = db.prepare('SELECT * FROM spellbooks WHERE id = ?').get(id);
              if (!sb) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Grimório não encontrado' }));
                return;
              }

              let spellIds: string[] = [];
              try {
                spellIds = JSON.parse(sb.spells_json || '[]');
              } catch (e) {}

              let hydratedSpells: any[] = [];
              if (spellIds.length > 0) {
                const placeholders = spellIds.map(() => '?').join(',');
                const sql = `
                  SELECT s.*, i.img, i.rarity
                  FROM spells s
                  JOIN items i ON s.id = i.id
                  WHERE s.id IN (${placeholders})
                `;
                hydratedSpells = db.prepare(sql).all(...spellIds);
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ...sb, spells: hydratedSpells }));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          if (method === 'PUT') {
            readBody().then((data) => {
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

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          if (method === 'DELETE') {
            try {
              db.prepare('DELETE FROM spellbooks WHERE id = ?').run(id);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }
        }

        // METADATA ENDPOINT
        if (pathname === '/api/metadata') {
          try {
            const traitRows = db.prepare('SELECT traits FROM spells').all();
            const traitCounts: Record<string, number> = {};
            for (const r of traitRows) {
              try {
                const list = JSON.parse(r.traits);
                for (const t of list) {
                  traitCounts[t] = (traitCounts[t] || 0) + 1;
                }
              } catch (e) {}
            }

            const sortedTraits = Object.entries(traitCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => ({ name, count }));

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              traditions: ['arcane', 'divine', 'occult', 'primal'],
              categories: ['spell', 'cantrip', 'focus', 'ritual'],
              ranks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
              defenses: ['fortitude', 'reflex', 'will', 'ac'],
              actionTypes: ['1', '2', '3', 'reaction', 'free'],
              traits: sortedTraits,
              totalSpells: db.prepare('SELECT count(*) as count FROM spells').get().count
            }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // SPELLS QUERY ENDPOINT
        if (pathname === '/api/spells') {
          try {
            const query = parsedUrl.query;
            const search = (query.search as string || '').trim().toLowerCase();
            const rank = query.rank as string;
            const tradition = query.tradition as string;
            const category = query.category as string;
            const defense = query.defense as string;
            const actions = query.actions as string;
            const trait = query.trait as string;
            const rarity = query.rarity as string;
            const ids = query.ids as string;
            const limit = parseInt(query.limit as string || '60', 10);
            const offset = parseInt(query.offset as string || '0', 10);

            const conditions: string[] = [];
            const params: any[] = [];

            if (ids !== undefined) {
              const idList = ids.split(',').map(s => s.trim()).filter(Boolean);
              if (idList.length === 0) {
                conditions.push('1 = 0');
              } else {
                const placeholders = idList.map(() => '?').join(',');
                conditions.push(`s.id IN (${placeholders})`);
                params.push(...idList);
              }
            }

            if (search) {
              conditions.push('(LOWER(s.name) LIKE ? OR LOWER(s.traits) LIKE ? OR LOWER(s.description) LIKE ?)');
              const term = `%${search}%`;
              params.push(term, term, term);
            }

            if (rank !== undefined && rank !== '' && rank !== 'all') {
              const r = parseInt(rank, 10);
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

            const countSql = `SELECT count(*) as total FROM spells s JOIN items i ON s.id = i.id ${whereClause}`;
            const total = db.prepare(countSql).get(...params).total;

            const selectSql = `
              SELECT 
                s.id, s.name, s.slug, s.rank, s.category, s.traditions, 
                s.traits, s.time, s.range, s.target, s.area, s.duration, 
                s.defense, s.description, s.system_json, i.img, i.rarity
              FROM spells s
              JOIN items i ON s.id = i.id
              ${whereClause}
              ORDER BY s.rank ASC, s.name ASC
              LIMIT ? OFFSET ?
            `;
            const rows = db.prepare(selectSql).all(...params, limit, offset);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ total, spells: rows }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (pathname.startsWith('/api/spells/')) {
          const id = pathname.replace('/api/spells/', '');
          try {
            const sql = `
              SELECT s.*, i.img, i.rarity, i.source, s.system_json
              FROM spells s
              JOIN items i ON s.id = i.id
              WHERE s.id = ?
            `;
            const spell = db.prepare(sql).get(id);
            if (!spell) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Spell not found' }));
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(spell));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // Equipment catalog for character inventories.
        if (pathname === '/api/equipment') {
          try {
            const search = String(parsedUrl.query.search || '').trim().toLowerCase();
            const type = String(parsedUrl.query.type || 'all');
            const offset = Math.max(0, Number.parseInt(String(parsedUrl.query.offset || '0'), 10) || 0);
            const conditions = ["LOWER(e.name) LIKE ?"];
            const params: (string | number)[] = [`%${search}%`];
            if (type !== 'all') { conditions.push('e.item_type = ?'); params.push(type); }
            const initial = String(parsedUrl.query.initial || '').toLowerCase();
            if (/^[a-z]$/.test(initial)) { conditions.push('LOWER(e.name) LIKE ?'); params.push(`${initial}%`); }
            const level = String(parsedUrl.query.level || 'all');
            const rarity = String(parsedUrl.query.rarity || 'all');
            const ids = parsedUrl.query.ids;
            if (level !== 'all' && /^\d+$/.test(level)) { conditions.push('e.level = ?'); params.push(Number(level)); }
            if (rarity !== 'all') { conditions.push('e.rarity = ?'); params.push(rarity); }
            if (ids !== undefined) {
              const list = String(ids).split(',').filter(Boolean);
              if (!list.length) conditions.push('1 = 0');
              else { conditions.push(`e.id IN (${list.map(() => '?').join(',')})`); params.push(...list); }
            }
            const where = conditions.join(' AND ');
            const total = db.prepare(`SELECT count(*) AS total FROM equipment e WHERE ${where}`).get(...params).total;
            const items = db.prepare(`SELECT e.id, e.name, e.item_type, e.level, e.price, e.bulk, e.description, e.system_json, e.traits, e.rarity, i.img FROM equipment e LEFT JOIN items i ON e.id = i.id WHERE ${where} ORDER BY e.name LIMIT 40 OFFSET ?`).all(...params, offset);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ items, total }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // FEATS METADATA ENDPOINT
        if (pathname === '/api/metadata/feats') {
          try {
            const traitRows = db.prepare('SELECT traits FROM feats').all();
            const traitCounts: Record<string, number> = {};
            for (const r of traitRows) {
              try {
                const list = JSON.parse(r.traits);
                for (const t of list) {
                  traitCounts[t] = (traitCounts[t] || 0) + 1;
                }
              } catch (e) {}
            }

            const sortedTraits = Object.entries(traitCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => ({ name, count }));

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              categories: ['class', 'ancestry', 'skill', 'general', 'classfeature', 'ancestryfeature'],
              levels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
              actionTypes: ['passive', 'action', 'reaction', 'free'],
              actions: ['1', '2', '3'],
              rarities: ['common', 'uncommon', 'rare', 'unique'],
              traits: sortedTraits,
              totalFeats: db.prepare('SELECT count(*) as count FROM feats').get().count
            }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        // FEATS QUERY ENDPOINT
        if (pathname === '/api/feats') {
          try {
            const query = parsedUrl.query;
            const search = (query.search as string || '').trim().toLowerCase();
            const category = query.category as string;
            const level = query.level as string;
            const max_level = query.max_level as string;
            const action_type = query.action_type as string;
            const actions = query.actions as string;
            const trait = query.trait as string;
            const rarity = query.rarity as string;
            const ids = query.ids as string;
            const limit = parseInt(query.limit as string || '60', 10);
            const offset = parseInt(query.offset as string || '0', 10);

            const conditions: string[] = [];
            const params: any[] = [];

            if (ids !== undefined) {
              const idList = ids.split(',').map(s => s.trim()).filter(Boolean);
              if (idList.length === 0) {
                conditions.push('1 = 0');
              } else {
                const placeholders = idList.map(() => '?').join(',');
                conditions.push(`f.id IN (${placeholders})`);
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
              params.push(parseInt(max_level, 10));
            } else if (level !== undefined && level !== '' && level !== 'all') {
              conditions.push('f.level = ?');
              params.push(parseInt(level, 10));
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
            const countSql = `SELECT count(*) as total FROM feats f JOIN items i ON f.id = i.id ${whereClause}`;
            const total = db.prepare(countSql).get(...params).total;

            const selectSql = `
              SELECT 
                f.id, f.name, f.slug, f.category, f.level, f.action_type, 
                f.actions, f.prerequisites, f.traits, f.description, 
                f.system_json, i.img, i.rarity
              FROM feats f
              JOIN items i ON f.id = i.id
              ${whereClause}
              ORDER BY f.level ASC, f.name ASC
              LIMIT ? OFFSET ?
            `;
            const rows = db.prepare(selectSql).all(...params, limit, offset);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ total, feats: rows }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (pathname.startsWith('/api/feats/')) {
          const id = pathname.replace('/api/feats/', '');
          try {
            const sql = `
              SELECT f.*, i.img, i.rarity, i.source, f.system_json
              FROM feats f
              JOIN items i ON f.id = i.id
              WHERE f.id = ?
            `;
            const feat = db.prepare(sql).get(id);
            if (!feat) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Feat not found' }));
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(feat));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), sqlitePlugin()],
  resolve: {
    alias: {
      '@portraitdb': path.resolve(__dirname, '../portraitdb/index.ts'),
    },
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
