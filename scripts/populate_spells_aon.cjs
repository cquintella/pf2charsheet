#!/usr/bin/env node

/**
 * Script de Ingestão e Atualização de Magias: Archives of Nethys (AoN) / PF2e Wiki
 * 
 * Funcionalidades:
 * - Consulta a API Elasticsearch oficial do Archives of Nethys (ou arquivo JSON local)
 * - Checagem estrita de duplicatas pelo nome normalizado (case-insensitive e sem espaços extras)
 * - Inserção atômica em ambas as tabelas 'items' e 'spells' do SQLite (pf2e.db)
 * - Mapeamento completo dos campos do Remaster (grau, tradições, traços, ações, alcance, etc.)
 * - Suporte a modo teste (--dry-run), atualização de existentes (--update) e limite de paginação (--limit)
 * 
 * Uso:
 *   node scripts/populate_spells_aon.cjs                     (busca do Archives of Nethys)
 *   node scripts/populate_spells_aon.cjs --dry-run           (apenas simula sem gravar)
 *   node scripts/populate_spells_aon.cjs --file=spells.json  (importa de dump JSON local)
 *   node scripts/populate_spells_aon.cjs --update            (atualiza magias existentes)
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Argumentos de linha de comando
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isUpdateMode = args.includes('--update');
const fileArg = args.find(a => a.startsWith('--file='));
const localJsonFile = fileArg ? fileArg.split('=')[1] : null;
const limitArg = args.find(a => a.startsWith('--limit='));
const maxFetchLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const dbArg = args.find(a => a.startsWith('--db='));
const dbFilePath = dbArg ? dbArg.split('=')[1] : path.resolve(__dirname, '../pf2e.db');

// URLs da API Elasticsearch do Archives of Nethys
const AON_PRIMARY_URL = 'https://elasticsearch.aonprd.com/aon/_search';
const AON_FALLBACK_URL = 'https://elasticsearch.aonprd.com/aon70/_search';

/**
 * Normaliza o nome para deduplicação semântica precisa
 */
function normalizeSpellName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[’'´`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gera slug a partir do nome
 */
function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Mapeia ação do formato textual para formato PF2e padronizado
 */
function parseActionTime(actionStr) {
  if (!actionStr) return '1';
  const str = String(actionStr).toLowerCase().trim();
  if (str.includes('reaction') || str.includes('reação')) return 'reaction';
  if (str.includes('free') || str.includes('livre')) return 'free';
  if (str.includes('3') || str.includes('three')) return '3';
  if (str.includes('2') || str.includes('two')) return '2';
  if (str.includes('1') || str.includes('one') || str.includes('single')) return '1';
  return actionStr.trim();
}

/**
 * Normaliza tradições mágicas em array JSON
 */
function parseTraditions(traditionsData) {
  const valid = ['arcane', 'divine', 'occult', 'primal'];
  const list = [];

  if (Array.isArray(traditionsData)) {
    traditionsData.forEach(t => {
      const lower = String(t).toLowerCase().trim();
      if (valid.includes(lower) && !list.includes(lower)) {
        list.push(lower);
      }
    });
  } else if (typeof traditionsData === 'string') {
    valid.forEach(t => {
      if (traditionsData.toLowerCase().includes(t) && !list.includes(t)) {
        list.push(t);
      }
    });
  }
  return JSON.stringify(list);
}

/**
 * Determina a categoria canônica da magia
 */
function determineCategory(rank, traitsArray, isRitual) {
  if (isRitual || traitsArray.includes('ritual')) return 'ritual';
  if (traitsArray.includes('cantrip')) return 'cantrip';
  if (traitsArray.includes('focus')) return 'focus';
  if (rank === 0) return 'cantrip';
  return 'spell';
}

/**
 * Busca magias paginadas da API Elasticsearch do Archives of Nethys
 */
async function fetchSpellsFromAoN() {
  console.log(`[AoN] Conectando à API do Archives of Nethys: ${AON_PRIMARY_URL}`);
  let url = AON_PRIMARY_URL;
  let spells = [];
  let searchAfter = null;
  const batchSize = 250;
  let page = 1;

  while (spells.length < maxFetchLimit) {
    const payload = {
      size: Math.min(batchSize, maxFetchLimit - spells.length),
      query: {
        bool: {
          filter: [
            { term: { category: 'spell' } }
          ]
        }
      },
      sort: [
        { level: { order: 'asc' } },
        { _id: { order: 'asc' } }
      ]
    };

    if (searchAfter) {
      payload.search_after = searchAfter;
    }

    try {
      console.log(`[AoN] Buscando lote ${page} (tamanho: ${payload.size}, acumulados: ${spells.length})...`);
      let res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PF2eCharSheet-Ingestion/1.0 (Desktop App; Educational/Personal Use)'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok && url === AON_PRIMARY_URL) {
        console.warn(`[AoN] Falha na rota principal (${res.status}). Tentando rota de contingência: ${AON_FALLBACK_URL}`);
        url = AON_FALLBACK_URL;
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'PF2eCharSheet-Ingestion/1.0'
          },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        throw new Error(`Resposta HTTP inválida de AoN: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const hits = json.hits?.hits || [];

      if (hits.length === 0) {
        console.log(`[AoN] Fim dos registros retornados pelo Nethys.`);
        break;
      }

      for (const hit of hits) {
        const src = hit._source || {};
        spells.push({
          id: hit._id || `aon_${slugify(src.name)}`,
          name: src.name || '',
          rank: src.level ?? (src.rank ?? 1),
          traditions: src.tradition || src.traditions || [],
          traits: src.trait || src.traits || [],
          time: src.action || src.actions || src.time || '1',
          range: src.range || '',
          target: src.target || '',
          area: src.area || '',
          duration: src.duration || '',
          defense: src.saving_throw || src.defense || '',
          description: src.text_html || src.text_markdown || src.text || '',
          rarity: (src.rarity || 'common').toLowerCase(),
          source: src.source || src.publication || 'Archives of Nethys',
          isRitual: Boolean(src.ritual)
        });
      }

      const lastHit = hits[hits.length - 1];
      searchAfter = lastHit.sort;
      page++;

      // Pausa educada de 150ms entre lotes para não sobrecarregar o serviço comunitário
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.error(`[AoN] Erro de rede ou consulta na página ${page}:`, err.message);
      throw new Error(`Importação interrompida após ${spells.length} registros; nenhuma gravação foi realizada. ${err.message}`);
    }
  }

  return spells;
}

/**
 * Lê magias de um arquivo JSON local (dump do AoN ou exportação da Wiki)
 */
function loadSpellsFromLocalFile(filePath) {
  console.log(`[Arquivo] Carregando magias do arquivo local: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const items = Array.isArray(data) ? data : (data.spells || data.hits || data.results || []);

  return items.map((item, idx) => {
    const src = item._source || item;
    return {
      id: item._id || src.id || `local_spell_${idx}_${slugify(src.name)}`,
      name: src.name || '',
      rank: src.level ?? (src.rank ?? 1),
      traditions: src.traditions || src.tradition || [],
      traits: src.traits || src.trait || [],
      time: src.time || src.action || src.actions || '1',
      range: src.range || '',
      target: src.target || '',
      area: src.area || '',
      duration: src.duration || '',
      defense: src.defense || src.saving_throw || '',
      description: src.description || src.text_html || src.text || '',
      rarity: (src.rarity || 'common').toLowerCase(),
      source: src.source || 'PF2e Source Dump',
      isRitual: Boolean(src.ritual)
    };
  });
}

/**
 * Execução Principal da Ingestão
 */
async function main() {
  console.log(`=======================================================`);
  console.log(`PF2e Character Sheet - Ingestão de Magias (Deduplicada)`);
  console.log(`Banco SQLite: ${dbFilePath}`);
  console.log(`Modo Teste (--dry-run): ${isDryRun ? 'SIM' : 'NÃO'}`);
  console.log(`Modo Atualização (--update): ${isUpdateMode ? 'SIM' : 'NÃO'}`);
  console.log(`=======================================================\n`);

  if (!fs.existsSync(dbFilePath)) {
    console.error(`[Erro] Banco SQLite não encontrado em ${dbFilePath}`);
    process.exit(1);
  }

  const db = new DatabaseSync(dbFilePath);

  // 1. Carrega todas as magias já existentes no banco para checagem por nome
  console.log(`[1/4] Mapeando magias existentes no SQLite...`);
  const existingSpellsRows = db.prepare(`SELECT id, name, slug FROM spells`).all();
  const existingItemsRows = db.prepare(`SELECT id, name, slug FROM items WHERE type = 'spell'`).all();

  const existingByName = new Map();
  for (const row of existingSpellsRows) {
    const norm = normalizeSpellName(row.name);
    if (norm) existingByName.set(norm, row);
  }
  for (const row of existingItemsRows) {
    const norm = normalizeSpellName(row.name);
    if (norm && !existingByName.has(norm)) {
      existingByName.set(norm, row);
    }
  }

  console.log(`  -> ${existingByName.size} magias únicas já catalogadas no banco.`);

  // 2. Coleta as magias da fonte indicada (AoN ou arquivo local)
  console.log(`\n[2/4] Extraindo magias da fonte de dados...`);
  let sourceSpells = [];

  if (localJsonFile) {
    sourceSpells = loadSpellsFromLocalFile(localJsonFile);
  } else {
    try {
      sourceSpells = await fetchSpellsFromAoN();
    } catch (err) {
      console.error(`\n[Atenção] Falha ao consultar a API remota do Archives of Nethys: ${err.message}`);
      console.log(`\nDica: Se você estiver offline ou em ambiente sem acesso à internet externa,`);
      console.log(`você pode salvar um dump JSON da Wiki/AoN e executar:`);
      console.log(`  node scripts/populate_spells_aon.cjs --file=caminho/para/magias.json\n`);
      process.exit(1);
    }
  }

  console.log(`  -> ${sourceSpells.length} registros obtidos da fonte.`);

  // 3. Processamento e Deduplicação
  console.log(`\n[3/4] Analisando registros e filtrando duplicatas...`);
  const toInsert = [];
  const toUpdate = [];
  const skippedDuplicates = [];
  const seenInBatch = new Set();

  for (const raw of sourceSpells) {
    if (!raw.name || !raw.name.trim()) continue;

    const normName = normalizeSpellName(raw.name);

    // Evita duplicatas internas no próprio lote da fonte
    if (seenInBatch.has(normName)) {
      continue;
    }
    seenInBatch.add(normName);

    // Checagem contra o banco de dados
    if (existingByName.has(normName)) {
      const existing = existingByName.get(normName);
      if (isUpdateMode) {
        toUpdate.push({ ...raw, existingId: existing.id });
      } else {
        skippedDuplicates.push({ name: raw.name, existingId: existing.id });
      }
    } else {
      toInsert.push(raw);
    }
  }

  console.log(`  -> Novas magias para inserir: ${toInsert.length}`);
  console.log(`  -> Duplicatas ignoradas (já presentes): ${skippedDuplicates.length}`);
  if (isUpdateMode) {
    console.log(`  -> Magias existentes a atualizar: ${toUpdate.length}`);
  }

  if (skippedDuplicates.length > 0) {
    console.log(`\nExemplos de duplicatas evitadas pelo nome:`);
    skippedDuplicates.slice(0, 5).forEach(d => {
      console.log(`  • "${d.name}" (ID existente: ${d.existingId})`);
    });
    if (skippedDuplicates.length > 5) {
      console.log(`  ... e mais ${skippedDuplicates.length - 5} magias já existentes.`);
    }
  }

  if (toInsert.length === 0 && toUpdate.length === 0) {
    console.log(`\n[Concluído] Nenhuma magia nova foi encontrada na consulta realizada. Nenhuma inserção necessária.`);
    return;
  }

  if (isDryRun) {
    console.log(`\n[DRY-RUN] Modo de teste ativo. Nenhuma alteração foi gravada no SQLite.`);
    console.log(`Execute o comando sem '--dry-run' para persistir as ${toInsert.length} novas magias.`);
    return;
  }

  // 4. Inserção no SQLite dentro de Transação Atômica
  console.log(`\n[4/4] Gravando alterações no banco de dados SQLite...`);

  const insertItemStmt = db.prepare(`
    INSERT OR REPLACE INTO items (id, name, slug, type, level, rarity, traits, category, source, img, description, system_json)
    VALUES (?, ?, ?, 'spell', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSpellStmt = db.prepare(`
    INSERT OR REPLACE INTO spells (id, name, slug, rank, category, traditions, traits, time, range, target, area, duration, defense, description, system_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION');

  let insertedCount = 0;
  let updatedCount = 0;

  try {
    for (const s of toInsert) {
      const spellSlug = slugify(s.name);
      const uniqueId = s.id && !s.id.startsWith('aon_') ? s.id : `spell_${spellSlug}`;
      const parsedRank = Number.parseInt(s.rank, 10);
      const rank = Number.isFinite(parsedRank) ? Math.max(0, parsedRank) : 1;

      let traitsArr = Array.isArray(s.traits) ? s.traits.map(t => String(t).toLowerCase().trim()) : [];
      if (s.isRitual && !traitsArr.includes('ritual')) traitsArr.push('ritual');
      if (rank === 0 && !traitsArr.includes('cantrip')) traitsArr.push('cantrip');

      const category = determineCategory(rank, traitsArr, s.isRitual);
      const traditionsJson = parseTraditions(s.traditions);
      const traitsJson = JSON.stringify(traitsArr);
      const timeVal = parseActionTime(s.time);
      const defaultImg = rank === 0 ? '/assets/icons/default-icons/spell.svg' : '/assets/icons/default-icons/spell.svg';

      const sysJson = JSON.stringify({
        level: { value: rank },
        traits: { value: traitsArr, rarity: s.rarity, traditions: JSON.parse(traditionsJson) },
        time: { value: timeVal },
        range: { value: s.range },
        target: { value: s.target },
        area: { value: s.area },
        duration: { value: s.duration },
        defense: { save: { statistic: s.defense } },
        publication: { title: s.source }
      });

      // 1. Grava na tabela global items
      insertItemStmt.run(
        uniqueId,
        s.name,
        spellSlug,
        rank,
        s.rarity,
        traitsJson,
        category,
        s.source,
        defaultImg,
        s.description,
        sysJson
      );

      // 2. Grava na tabela especializada spells
      insertSpellStmt.run(
        uniqueId,
        s.name,
        spellSlug,
        rank,
        category,
        traditionsJson,
        traitsJson,
        timeVal,
        s.range,
        s.target,
        s.area,
        s.duration,
        s.defense,
        s.description,
        sysJson
      );

      insertedCount++;
    }

    if (isUpdateMode) {
      for (const s of toUpdate) {
        const spellSlug = slugify(s.name);
        const targetId = s.existingId;
        const parsedRank = Number.parseInt(s.rank, 10);
      const rank = Number.isFinite(parsedRank) ? Math.max(0, parsedRank) : 1;

        let traitsArr = Array.isArray(s.traits) ? s.traits.map(t => String(t).toLowerCase().trim()) : [];
        if (s.isRitual && !traitsArr.includes('ritual')) traitsArr.push('ritual');
        if (rank === 0 && !traitsArr.includes('cantrip')) traitsArr.push('cantrip');

        const category = determineCategory(rank, traitsArr, s.isRitual);
        const traditionsJson = parseTraditions(s.traditions);
        const traitsJson = JSON.stringify(traitsArr);
        const timeVal = parseActionTime(s.time);
        const defaultImg = '/assets/icons/default-icons/spell.svg';

        const sysJson = JSON.stringify({
          level: { value: rank },
          traits: { value: traitsArr, rarity: s.rarity, traditions: JSON.parse(traditionsJson) },
          time: { value: timeVal },
          range: { value: s.range },
          target: { value: s.target },
          area: { value: s.area },
          duration: { value: s.duration },
          defense: { save: { statistic: s.defense } },
          publication: { title: s.source }
        });

        insertItemStmt.run(
          targetId,
          s.name,
          spellSlug,
          rank,
          s.rarity,
          traitsJson,
          category,
          s.source,
          defaultImg,
          s.description,
          sysJson
        );

        insertSpellStmt.run(
          targetId,
          s.name,
          spellSlug,
          rank,
          category,
          traditionsJson,
          traitsJson,
          timeVal,
          s.range,
          s.target,
          s.area,
          s.duration,
          s.defense,
          s.description,
          sysJson
        );

        updatedCount++;
      }
    }

    db.exec('COMMIT');
    console.log(`[Sucesso] Transação confirmada no SQLite!`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error(`[Erro] Falha durante gravação no SQLite. Rollback executado:`, err);
    process.exit(1);
  }

  // Estatísticas finais
  const finalCount = db.prepare(`SELECT count(*) as total FROM spells`).all()[0].total;

  console.log(`\n=======================================================`);
  console.log(`Resumo da Operação:`);
  console.log(`  • Novas magias inseridas: ${insertedCount}`);
  if (isUpdateMode) {
    console.log(`  • Magias atualizadas: ${updatedCount}`);
  }
  console.log(`  • Duplicatas evitadas: ${skippedDuplicates.length}`);
  console.log(`  • Total de magias no banco agora: ${finalCount}`);
  console.log(`=======================================================`);
}

main().catch(err => {
  console.error('[Erro Fatal]:', err);
  process.exit(1);
});
