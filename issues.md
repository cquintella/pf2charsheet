# Issues — pf2charsheet

Análise estática de 2026-11-18. Itens marcados **[testado]** foram verificados de fato (tsc, consultas ao `pf2e.db`, semântica do SQLite, CSS gerado em `dist/`). Os demais vêm da leitura do código.

**Objetivo do produto (definido em 2026-11-18):** app desktop **single-user**, distribuído para rodar inteiro (autocontido, sem servidor de dev), com interface em **inglês e português** e troca de idioma nas configurações.

**Prioridades (revisadas para esse objetivo):**
1. **I1 é bloqueante:** sem ele o app distribuído não funciona. Mover a API do Vite para o processo main do Electron (IPC via `preload`), com o banco no diretório de dados do usuário (`app.getPath('userData')`) em vez da pasta do projeto, e empacotamento (ex.: electron-builder) incluindo o `pf2e.db` inicial. Isso também elimina P2 (não haverá servidor HTTP local).
2. P1: apagar o cookie e invalidar a sessão.
3. B1, B2, B4 e B5, que corrompem ou duplicam dados.
4. I2: ler os slots e aumentos dos dados da classe (`system_json`) em vez de usar listas fixas.
5. I12: dados do compêndio em português (hoje só a interface é traduzida).

---

## Código perigoso

- [ ] **P1** — `cookies.txt` (raiz): cookie de sessão `HttpOnly` de `foundry.intelliurb.com` em texto puro. Está no `.gitignore`, mas qualquer zip ou backup da pasta leva o arquivo junto. **Apagar o arquivo e invalidar a sessão.**
- [ ] **P2** — (deixa de existir quando I1 for feito, porque não haverá servidor HTTP) `vite.config.ts:113`, `:234`: os `POST` de personagens e grimórios não têm autenticação nem checagem de `Origin`, e fazem `JSON.parse` sem olhar o `Content-Type`.
  - Qualquer site aberto enquanto `npm run dev` roda pode mandar um POST `text/plain` (sem preflight) e criar ou sobrescrever registros.
  - Como é `INSERT OR REPLACE` e o id `char_valeros` é fixo e conhecido, dá para sobrescrever esse personagem.
  - Provável (não testado): o middleware de `configureServer` roda antes do host-check interno do Vite, o que abre espaço para DNS rebinding.
- [ ] **P3** — HTML vindo do banco vai direto para `dangerouslySetInnerHTML`, sem sanitizar: `SpellDetailModal.tsx:299`, `FeatDetailModal.tsx:211`, `EquipmentExplorerView.tsx:53`, `InventoryView.tsx:77`.
  - O `populate_spells_aon.cjs` grava `text_html` de uma fonte externa.
  - O `index.html` não tem CSP e o `electron/main.cjs` não bloqueia `will-navigate` nem `setWindowOpenHandler`.
  - Hoje há 0 ocorrências de `<script` / `onerror=` / `javascript:` no banco **[testado]**.
  - Somado ao P2, um script injetado poderia apagar tudo pela API.
- [ ] **P4** — `scripts/populate_spells_aon.cjs:449-508`: `--update` casa magias só pelo nome e sobrescreve o `system_json` do Foundry com um esqueleto. Também troca o `img` pelo ícone padrão, apagando ícones personalizados.
- [ ] **P5** — `vite.config.ts:190-201`: `PUT /api/spells/:id/icon` faz `UPDATE items` em qualquer tipo de item, com qualquer string.
- [ ] **P6** — `vite.config.ts:22`: `readBody` não tem limite de tamanho.
- [ ] **P7** — `electron/main.cjs:22-31`: o fechamento depende do renderer responder ao IPC. Se o renderer travar, a janela não fecha e não há timeout.

## Implementações incompletas

- [ ] **I1** — **Não há backend em produção.** A API inteira vive em `configureServer` (`vite.config.ts:13`), que só roda no `vite dev`.
  - No `npm start` empacotado, o `main.cjs:38` carrega `dist/index.html` via `file://` e não existe `/api` nenhum.
  - O `package.json` define `WAIT_ON_WEB=true`, mas o `main.cjs` nunca lê essa variável. Isso cria uma corrida no `electron:dev`.
- [ ] **I2** — **Slots de talento e aumentos de perícia estão fixos no código** (`LevelProgressionView.tsx:93-140`, `:1295`, `:1410`). O banco já traz `classFeatLevels`, `skillFeatLevels` e `skillIncreaseLevels` **[testado]**. Divergências reais:
  - Barbarian, Rogue e Investigator têm talento de classe no nível 1; o código só dá esse talento a fighter/gunslinger.
  - O Rogue tem talento de perícia no nível 1; o código não dá.
  - Rogue e Investigator têm aumento de perícia em todo nível a partir do 2; o código não trata isso.
- [ ] **I3** — Heritage e subclass são sempre gravados como `''` (`LevelProgressionView.tsx:738,741`, `CharacterCreatorView.tsx:385`). A tabela `heritages` existe, mas não há endpoint para ela.
- [ ] **I4** — PV atual não é rastreado: em `App.tsx:296`, `hp = maxHp`, então a barra de vida fica sempre em 100%.
- [ ] **I5** — O criador não grava perícias treinadas (antecedente e classe) nem `baseAttributes`. A ficha cai nos padrões fixos do Valeros (`LevelProgressionView.tsx:184`).
- [ ] **I6** — Não há regra de boost parcial para atributo ≥ +4 (`LevelProgressionView.tsx:428-435`).
- [ ] **I7** — O teto de proficiência por nível não é validado: o texto em `LevelProgressionView.tsx:1427` descreve a regra, mas nada a aplica.
- [ ] **I8** — O slot geral não oferece talentos de perícia (`FeatPickerModal.tsx:36`).
- [ ] **I9** — O criador permite escolher o mesmo atributo duas vezes nos boosts livres da ancestralidade, ou repetir um boost fixo (`CharacterCreatorView.tsx:795-812`, sem `disabled`).
- [ ] **I10** — O texto "1.994 Magias • 7.213 Talentos" está fixo em `App.tsx:826`; o valor real já vem em `metadata.totalSpells`.
- [ ] **I11** — Grimórios não têm vínculo com personagem (a tabela `spellbooks` não tem `character_id`).
- [x] **I-i18n** — **Internacionalização implementada (2026-11-18).** Antes não havia nenhuma: ~580 textos fixos em PT-BR.
  - Camada própria e tipada, sem dependência nova: `src/i18n/Translator.ts`, `I18nContext.tsx`, `gameTerms.ts`, `messages/ptBR.ts` e `messages/en.ts`. O compilador obriga os dois dicionários a terem as mesmas chaves.
  - Idioma inicial: escolha salva → idioma do sistema → inglês. A escolha fica em `localStorage` (`pf2e_locale`), e `<html lang>` é atualizado.
  - Troca de idioma em **Configurações** (engrenagem na barra lateral, nova `SettingsModal`) e também em "Opções de jogo" da ficha.
  - Verificado: `tsc` e `vite build` sem erros, 584 chaves com mesmos placeholders nos dois idiomas, `Translator`/`detectLocale` testados **[testado]**. A troca na interface não foi conferida visualmente (extensão do Chrome desconectada).
  - Fora do escopo: `CharacterSelectorModal.tsx` (código abandonado, A1) e as mensagens de `throw new Error` em `services/api.ts`, que só vão para o console.
- [ ] **I12** — **Dados do compêndio só em inglês.** Nomes e descrições de magias, talentos, itens, ancestralidades e classes vêm do Foundry em inglês, e o seletor "Idioma do banco de dados" é só informativo. Para PT-BR completo: importar a tradução da comunidade (módulo de tradução PT-BR do Foundry) em colunas/tabela por idioma e escolher a coluna conforme o idioma. TODO: confirmar qual módulo de tradução PT-BR existe, sua licença e cobertura antes de implementar.
- [ ] **I13** — Nomes de personagem e grimório padrão (`Valeros…`, `Novo Herói`, `Grimório N`) são gravados no idioma ativo no momento da criação; trocar o idioma depois não os renomeia (comportamento esperado para dados do usuário).
- [ ] TODO: verificar no Player Core se o defeito voluntário do Remaster exige dois defeitos para ganhar um boost. O código usa um defeito para um boost (`CharacterCreatorView.tsx:291-298`).

## Código abandonado

- [ ] **A1** — `src/components/CharacterSelectorModal.tsx` (754 linhas) não é importado em lugar nenhum. Restos dele:
  - Em `App.tsx:115-117` e `:272-278`, ancestralidades, antecedentes e classes são buscados e nunca lidos.
  - Em `LevelProgressionView.tsx`, `onOpenCharModal` e `onNavigateToCreator` não são usados, e `backgrounds`/`classes` são buscados à toa (`:154-155`).
- [ ] **A2** — `scripts/export_foundry_to_sqlite.cjs` foi substituído pelo `import-foundry.cjs`. Ele depende de `classic-level` (não está nas dependências) e da CLI `sqlite3`, monta SQL por concatenação, não cria a tabela `spellbooks` e nenhum script do npm o chama.
- [ ] **A3** — "Score" legado continua na interface (`LevelProgressionView.tsx:1117,1614`, `CharacterCreatorView.tsx:539`), embora o `relatorio.md` trate isso como problema.
- [ ] **A4** — Duplicações:
  - `cleanDescription` em `SpellDetailModal.tsx` copia `cleanDescriptionHtml` de `utils/formatters.ts`.
  - `SavedCharacterRecord` é redeclarado em `CharacterCreatorView.tsx:47`.
  - O cálculo de perícias é feito duas vezes: no `useMemo` de `LevelProgressionView.tsx:493` e inline em `:1773-1781`. Os dois podem divergir.
- [ ] **A5** — `tsc --noUnusedLocals --noUnusedParameters` aponta 54 imports e variáveis sem uso **[testado]**. Exemplos: `current` em `LevelProgressionView.tsx:629` e `categoryKey` em `:815`.

## Bugs

- [ ] **B1** — `LevelProgressionView.tsx:338-375`: **dados vazam entre personagens.** `loadSavedCharacterRecord` só sobrescreve os campos que existem no registro novo.
  - Ao trocar do personagem A para um personagem criado pelo criador (sem `progressionLevels` e sem `initialTrainedSkills`), os talentos e perícias de A continuam na tela.
  - Se você salvar, esses dados são gravados em B.
- [ ] **B2** — `App.tsx:357-362`, `FeatExplorerView.tsx:107-112`: **"Carregar mais" tem corrida.** O `setFilters` dispara o effect, que busca o novo offset sem acumular, enquanto a chamada explícita acumula. Conforme a ordem de chegada, a lista fica só com a página 2 ou com itens duplicados (keys repetidas).
- [ ] **B3** — `App.tsx:337-343`, `FeatExplorerView.tsx:89-93`: favoritar um item recria `loadSpells`/`loadFeats`, recarrega a lista e perde a paginação.
- [ ] **B4** — `LevelProgressionView.tsx:785-792`: **subir de nível grava estatísticas velhas.**
  - `handleSaveProgress(nextLvl)` roda no mesmo tick, então `hpStats`, `combatStats` e `calculatedAttributes` saem calculados para o nível anterior.
  - A sidebar (`App.tsx:294`) mostra PV e CA desatualizados.
  - Subir de nível também salva em silêncio todas as edições pendentes.
- [ ] **B5** — `CharacterCreatorView.tsx:381`, `:1393`: o save não manda `id`, então cada clique cria um personagem novo.
  - "Salvar" seguido de "Salvar & Abrir Progressão" gera dois registros.
  - Reabrir um personagem e salvar gera uma cópia.
  - "Salvar & Abrir" navega mesmo quando o save falha.
- [ ] **B6** — `vite.config.ts:127`: `INSERT OR REPLACE` reseta o `created_at` a cada save **[testado]**. Usar `INSERT ... ON CONFLICT(id) DO UPDATE`.
- [ ] **B7** — `vite.config.ts:303-328`: o `PUT` de grimório não tem `.catch`. Com JSON inválido, a promise é rejeitada sem tratamento e a requisição fica pendurada.
- [ ] **B8** — `vite.config.ts:395-396`, `:600-601`: `limit`/`offset` não são validados. `limit=-1` devolve a tabela inteira e `limit=abc` dá 500 com "datatype mismatch" **[testado]**.
- [ ] **B9** — `LevelProgressionView.tsx:453,462`: o talento Diehard soma +1 PV por nível. Isso está errado: ele só muda o limite de *dying*.
- [ ] **B10** — `LevelProgressionView.tsx:251-317`, `SpellbookBuilderView.tsx:67`: o app recria o Valeros quando não há personagens e recria um grimório quando a lista fica vazia, então nunca dá para ter zero. No dev com `StrictMode`, o effect roda duas vezes e cria dois grimórios.
- [ ] **B11** — `App.tsx:364`, `:845`: `window.scrollTo` não faz nada, porque quem rola é o `<main overflow-y-auto>`. O botão "voltar ao topo" está quebrado.
- [ ] **B12** — `App.tsx:407`: `relative fixed md:static`. No CSS gerado, `.relative` vem depois de `.fixed` e vence **[testado]**.
  - No mobile o drawer não fica fixo.
  - No desktop, a alça de redimensionar é posicionada em relação à viewport, não à sidebar.
  - O efeito visual não foi conferido na tela.
- [ ] **B13** — `CharacterCreatorView.tsx:426-435`: excluir um personagem pelo criador não avisa o `App`. A sidebar fica com dados velhos e pode continuar apontando para o personagem excluído.
- [ ] **B14** — `LevelProgressionView.tsx:1062-1093`, `CharacterCreatorView.tsx:508`: `+{valor}` com valor negativo aparece como `+-1`.
- [ ] **B15** — `scripts/populate_spells_aon.cjs:67-76`: `parseActionTime` transforma "10 minutes" e "1 day" em `'1'` (uma ação).
- [ ] **B16** — `LevelProgressionView.tsx:1772`: `attributeBoosts.includes` quebra se um registro antigo não tiver o campo.
- [ ] **B17** — `SpellbookBuilderView.tsx:106-134`: a busca do catálogo não cancela requisições antigas, então respostas fora de ordem podem sobrescrever o resultado mais recente.

## Baixa performance

- [ ] **D1** — `App.tsx:235-279`: o effect de montagem depende de `refreshCharacters`, que depende de `activeCharId`. Resultado: cada troca de personagem refaz a busca de metadados (que faz `JSON.parse` dos traits de 1.994 magias) e de ancestralidades, antecedentes e classes completas, cujo resultado nem é usado.
- [ ] **D2** — `/api/metadata` e `/api/metadata/feats` (`vite.config.ts:349`, `:554`) fazem scan completo com `JSON.parse` linha a linha em toda chamada, sem cache.
- [ ] **D3** — Buscas usam `LOWER(x) LIKE '%t%'` sobre `description` e sobre traits guardados como texto JSON (`LIKE '%"x"%'`).
  - Isso é full scan, mais um `COUNT(*)` separado.
  - O `LOWER` é redundante, porque `LIKE` já ignora maiúsculas em ASCII.
  - O caminho certo é FTS5 mais uma tabela de traits.
- [ ] **D4** — As listagens (`/api/spells`, `/api/feats`, `/api/equipment`, ancestralidades, antecedentes, classes) devolvem `system_json` e `description` de cada linha.
- [ ] **D5** — `LevelProgressionView.tsx:708-723`: `snapshot()` roda `JSON.stringify` do estado inteiro a cada render, incluindo cada tecla digitada.
  - O estado traz objetos completos de ancestralidade, antecedente e classe (cerca de 5 KB de `system_json` cada) e o inventário com descrições.
  - Essas cópias também são gravadas no `data_json` (12–26 KB por personagem **[testado]**) e envelhecem em relação ao compêndio.
- [ ] **D6** — `scripts/import-foundry.cjs:19-22`: faz `prepare` de um statement novo por linha importada. Cachear um statement por tabela.
- [ ] **D7** — `weaponDamage` faz `JSON.parse` do item 2 a 3 vezes por render (`EquipmentExplorerView.tsx:67`, `InventoryView.tsx`).
- [ ] **D8** — `EquipmentExplorerView.tsx:38`: favoritar recarrega a página mesmo sem o filtro de favoritos ativo.
- [ ] **D9** — `LevelProgressionView.tsx:377-397`: os talentos que não foram encontrados são buscados de novo a cada edição.
