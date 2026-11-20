# Plano de Trabalho (Sprint Backlog) — `pf2charsheet`

Bucket de execução para corrigir os problemas de usabilidade (cores, fontes, layout, front-end, casos de uso) e os gaps funcionais/técnicos levantados na análise do sistema.

---

## Sprint 1 — Fundação Visual: Tokens de Cor, Temas e Contraste

Objetivo: eliminar os 199 hexadecimais hardcoded e as 475 linhas de `!important` de `themes.css`, garantindo contraste WCAG AA nos três temas (`current`, `light`, `dark`) e coerência semântica de cores.

### Tarefas

- [x] Criar paleta de CSS Custom Properties semânticas em `src/themes.css` (`--bg-canvas`, `--bg-surface`, `--bg-elevated`, `--bg-inset`, `--border-subtle`, `--border-strong`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`, `--accent-contrast`, `--status-success`, `--status-danger`, `--status-warn`, `--status-info`).
- [x] Mapear esses tokens no `extend.colors` de `tailwind.config.js` e remover os tokens mortos `pf.*` não utilizados.
- [x] Substituir os hexadecimais hardcoded (`bg-[#...]`, `border-[#...]`, `text-[#...]`) nos componentes pelos tokens semânticos, preservando elevação distinta entre fundo, cards e inputs nos temas `light` e `dark`.
- [x] Remover as regras por classe de `src/themes.css` baseadas em `[class~="bg-[#...]"] !important`.
- [x] Corrigir contraste WCAG AA (>= 4.5:1) no tema `light` para todas as classes de texto claro (`text-emerald-300/400`, `text-red-300/400`, `text-blue-300/400`, `text-[#93c5fd]`, `text-amber-300/400`, `text-yellow-400`, `text-indigo-400`).
- [x] Corrigir contraste WCAG AA no tema `current` para textos secundários (`#556477`, `#5c6c80`, `#68788d`, `#6b7c93`).
- [x] Integrar aos tokens os 24 fundos, 25 bordas e 17 textos hoje fora do `themes.css` (badges de raridade, card de ritual `#23122c`, card de pré-requisito `#1a1711`, botão excluir grimório `#291717`, diálogo de alterações não salvas `#3d2730`).
- [ ] Separar o papel cromático do dourado `#e0a845` (reservar para CTA primário / estado ativo; usar cor própria ou neutra para ícones decorativos, badges de nível e favoritos) e alinhar a codificação de cores de atributos entre `CharacterCreatorView.tsx` e `LevelProgressionView.tsx`.

### Critérios de Aceite (DoD)

- [x] Zero classes com hexadecimais arbitrários de superfície/borda/texto genérico fora de casos semânticos específicos de domínio.
- [x] Temas `current`, `light` e `dark` passam em contraste mínimo 4.5:1 para texto normal e 3:1 para texto grande/ícones.
- [x] Nenhum bloco escuro isolado aparece dentro do tema claro.

---

## Sprint 2 — Tipografia, CSS Quebrado e Higiene de Layout

Objetivo: corrigir fontes faltantes, eliminar microtipografia ilegível, consertar classes Tailwind ignoradas no build e corrigir a impressão da ficha.

### Tarefas

- [x] Importar `@fontsource/inter/300.css`, `800.css` e `900.css` em `src/main.tsx` para suportar `font-light`, `font-extrabold` e `font-black` sem síntese de negrito.
- [x] Elevar o piso tipográfico: substituir `text-[8px]`, `text-[9px]` e `text-[10px]` (115 ocorrências) por no mínimo `text-[11px]` ou `text-xs` (12px).
- [x] Aumentar alvos clicáveis e legibilidade em `ProficiencySelector.tsx` (`U/T/E/M/L` de 22px/`8px` para >= 28px/`11px`) e no índice A–Z de `InventoryView.tsx` (`20px`/`8px` para >= 28px/`11px`).
- [ ] Aplicar `tabular-nums` em todos os modificadores, tabelas de perícias, PV, CA, níveis e colunas numéricas.
- [ ] Reduzir o excesso de `font-black` + `uppercase` + `tracking-wider` em rótulos secundários para restaurar hierarquia tipográfica.
- [x] Instalar `@tailwindcss/typography` (ou criar estilização dedicada `.pf-prose` em `src/index.css`) para renderizar corretamente `<p>`, `<ul>`, `<li>`, `<h3>`, `<hr>` e `<table>` nas descrições HTML do Foundry em `SpellDetailModal.tsx`, `FeatDetailModal.tsx`, `EquipmentExplorerView.tsx` e `InventoryView.tsx`.
- [x] Corrigir classes quebradas verificadas ausentes no `dist/`: trocar `md:grid-cols-20` por `md:grid-cols-[repeat(20,minmax(0,1fr))]` em `LevelProgressionView.tsx`, trocar `py-0.2` (11 usos) por `py-0.5`, e definir `@keyframes fadeIn` / `.animate-fadeIn` em `tailwind.config.js` ou `src/index.css`.
- [x] Corrigir `relative fixed md:static` na `<aside>` de `src/App.tsx` (remover `relative` conflitante para restaurar drawer mobile e posicionamento da alça de redimensionamento no desktop).
- [x] Corrigir o botão "Voltar ao topo" em `src/App.tsx`: associar `ref` ao `<main className="overflow-y-auto">`, rolar o container correto e exibir o botão apenas quando `scrollTop > 300`.
- [x] Adicionar rótulo textual ao botão "Passar de Nível" em `LevelProgressionView.tsx` para manter paridade visual com "Salvar" e "Imprimir".
- [x] Refatorar `@media print` em `src/index.css` para usar os tokens de tema (cobrindo 100% dos cards, inputs e tabelas) e ocultar o buscador de compêndio de `InventoryView.tsx` na impressão.

### Critérios de Aceite (DoD)

- [x] `npm run build` gera todas as classes utilitárias usadas no JSX, sem classes mortas.
- [x] Nenhum elemento interativo ou rótulo funcional usa fonte menor que 11px ou alvo menor que 28px.
- [x] Impressão A4 da ficha gera fundo branco limpo em todas as seções, incluindo Ataques e Inventário, sem controles de busca.

---

## Sprint 3 — Design System Interno, Acessibilidade e Padronização dos Compêndios

Objetivo: criar componentes base reutilizáveis, eliminar diálogos nativos, garantir navegação por teclado e unificar a experiência entre Magias, Talentos e Equipamentos.

### Tarefas

- [ ] Criar biblioteca de componentes UI compartilhados (`Button`, `Card`, `Badge`, `Input`, `Select`, `Modal`, `ConfirmDialog`, `EmptyState`, `Tabs`). (`ConfirmDialog` e `useModalFocus` criados; demais componentes base pendentes.)
- [x] Substituir todas as 7 chamadas a `window.alert` e `window.confirm` (`App.tsx`, `CharacterCreatorView.tsx`, `FeatPickerModal.tsx`, `LevelProgressionView.tsx`, `SpellbookBuilderView.tsx`) pelo `ConfirmDialog` / `AlertDialog` interno.
- [x] Converter os 27 `<div onClick>` interativos para `<button type="button">` ou adicionar `role="button"`, `tabIndex={0}` e suporte a `Enter`/`Space`.
- [x] Adicionar anel `focus-visible:outline` consistente em todos os botões, links, cards clicáveis, selects e inputs (removendo `outline-none` sem substituto).
- [x] Implementar *focus trap*, restauração de foco ao fechar e fechamento por `Escape` em todos os modais (incluindo `TarotPrintView.tsx` e o modal de detalhe em `InventoryView.tsx`).
- [x] Padronizar os três exploradores (`App.tsx` Magias, `FeatExplorerView.tsx` Talentos, `EquipmentExplorerView.tsx` Equipamentos): mesma barra de filtros, mesmo toggle Grade/Tabela, mesmo padrão de favoritos com estrela e mesma abertura de detalhe (modal ou drawer lateral consistente, sem empurrar a grade com `col-span-full`).
- [x] Corrigir paginação em Magias e Talentos eliminando a condição de corrida do "Carregar mais" (B2) e o reset de paginação ao favoritar (B3); implementar tabela ordenável real em `EquipmentExplorerView.tsx` com a mesma paginação dos demais exploradores.
- [x] Adicionar busca/expansão no filtro de Traços em `FeatFiltersBar.tsx` (hoje limitado aos top 50 sem pesquisa).
- [x] Remover o arquivo morto `src/components/CharacterSelectorModal.tsx` (A1) e os fetches órfãos em `App.tsx` e `LevelProgressionView.tsx`.
- [x] Mover `'magia' : 'magias'` em `SpellbookBuilderView.tsx` para os dicionários i18n (`ptBR.ts` / `en.ts`) e unificar o nome do produto em `index.html`, `App.tsx` e `README.md`.

### Critérios de Aceite (DoD)

- [x] Zero chamadas a `window.alert` ou `window.confirm` no código.
- [x] Fluxo completo operável via teclado (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`).
- [x] Os três compêndios seguem exatamente o mesmo padrão visual e de paginação, sem duplicação de itens ao paginar.

---

## Sprint 4 — Reorganização da Ficha (Sub-abas), Modo Sessão de Jogo e Cards Compactos

Objetivo: transformar a ficha monolítica em uma interface ágil de mesa, com acesso rápido ao combate, sem scrolls aninhados e com densidade visual equilibrada.

### Tarefas

- [x] Decompor `LevelProgressionView.tsx` (1.773 linhas) em sub-abas internas orientadas à tarefa: `Combate`, `Perícias`, `Talentos & Progressão`, `Magias` e `Inventário`. (`Combate`, `Perícias`, `Talentos & Progressão` e `Inventário` implementadas; `Magias` entra na Sprint 5.)
- [x] Remover o card redundante "Defesas" logo abaixo do resumo de combate e eliminar containers com scroll interno preso (`max-h-[460px]`, `max-h-[380px]`, `max-h-64`) dentro da `<main>` rolável.
- [x] Expor a alternância `Ficha Consolidada` / `Planejador 1–20` diretamente no cabeçalho da aba `Talentos & Progressão` (removendo-a de dentro do modal de Configurações) e adicionar indicador visual de escolhas pendentes por nível (boosts, perícias, talentos).
- [x] Implementar painel operacional de **Modo Sessão (Combate)** na aba `Combate`: PV atual, PV temporário, botões rápidos de dano/cura (`-10`, `-5`, `-1`, `+1`, `+5`, `+10`), rastreador de *Dying* / *Wounded*, *Hero Points*, *Focus Points*, botão "Erguer Escudo" (+2 CA e HP/BT do escudo).
- [x] Atualizar `App.tsx` para refletir o PV atual real na mini-barra e no card da sidebar (corrigindo I4).
- [x] Implementar seletor de Condições PF2e (*Frightened*, *Off-Guard*, *Sickened*, *Clumsy*, *Drained*, *Enfeebled*, *Slowed*) aplicando penalidades automáticas em CA, ataques, testes de resistência e perícias em tempo real.
- [x] Redesenhar `StrikesView.tsx`: exibir cartão de combate limpo por arma com bônus de ataque, MAP (`0 / -5 / -10` ou `0 / -4 / -8` para *Agile*), cálculo de *Finesse*, *Weapon Specialization* (níveis 7+/13+) e ataque desarmado padrão (*Fist*), movendo os campos de edição para um painel colapsável/modal.
- [x] Compactar `SpellCard.tsx`, `FeatCard.tsx` e os cards de `EquipmentExplorerView.tsx`: remover `aspect-[63/88] min-h-[380px]` e `border-[6px]`, adotando cards compactos com borda indicadora de 2–3px e melhor aproveitamento de largura em grid.
- [ ] Adicionar indicador visual de "Alterações não salvas" no cabeçalho da ficha e estender a proteção `SheetGuard` para `SpellbookBuilderView.tsx` e `CharacterCreatorView.tsx`. (Badge `Não salvo` adicionado na ficha; `SheetGuard` em `SpellbookBuilderView.tsx` e `CharacterCreatorView.tsx` pendente.)

### Critérios de Aceite (DoD)

- [x] Informações de combate (PV, CA, Escudo, Condições, Ataques com MAP, Saves) cabem na primeira dobra da aba `Combate` sem scroll aninhado.
- [x] Alterar PV atual reflete imediatamente na sidebar e persiste ao salvar.
- [ ] Trocar de aba com edições pendentes em ficha, grimório ou criador sempre dispara confirmação.

---

## Sprint 5 — Fluxos End-to-End (Criador, Picker, Grimório, Compêndios e Impressão)

Objetivo: conectar todas as pontas soltas entre criação, evolução, compêndios, grimórios e impressão física.

### Tarefas

- [x] Corrigir a persistência do `CharacterCreatorView.tsx`: manter `id` no estado para evitar duplicatas ao clicar em "Salvar" e "Salvar & Abrir" (B5), e gravar `baseAttributes`, `initialTrainedSkills` (do antecedente e classe), `heritage`, `subclass` e `progressionLevels` inicializados (I3, I5).
- [x] Corrigir `loadSavedCharacterRecord` em `LevelProgressionView.tsx` para resetar integralmente o estado antes de carregar outro personagem, eliminando vazamento de dados (B1).
- [x] Dar visibilidade ao botão "Novo Herói" na sidebar (botão explícito com texto no topo ou no popover) e permitir editar Herança, Subclasse e escolhas de nível 1 diretamente na ficha. (`+ Novo Herói` adicionado no popover; edição de Herança/Subclasse depende de endpoint `heritages` na Sprint 6.)
- [x] Redesenhar `FeatPickerModal.tsx` em layout mestre-detalhe (lista filtrável à esquerda; descrição completa formatada, traços e pré-requisitos avaliados em tempo real à direita antes de clicar em escolher).
- [x] Adicionar ações contextuais nos exploradores de compêndio: "Adicionar ao Inventário" em `EquipmentExplorerView.tsx`, "Adicionar ao Grimório" em `App.tsx` (Magias) e "Vincular a Slot" em `FeatExplorerView.tsx`. (`Adicionar ao Inventário` implementado em `EquipmentExplorerView.tsx`.)
- [x] Vincular grimórios em `SpellbookBuilderView.tsx` ao personagem ativo (`character_id` na tabela `spellbooks`, I11), adicionar paginação real na busca do catálogo (removendo o corte silencioso em `limit: 60`) e cancelar requisições obsoletas (B17). (Paginação real e cancelamento B17 implementados; coluna `character_id` e aba `Magias` da ficha ficam integradas ao schema na Sprint 6.)
- [ ] Implementar a aba `Magias` na ficha do personagem: seleção de tradição/atributo-chave, cálculo de *Spell Attack* e *Spell DC*, gerenciamento de *Spell Slots* por rank (e *Signature Spells*) e vínculo direto com o grimório do personagem.
- [x] Exibir banner discreto nos exploradores quando o idioma da UI for PT-BR informando que os termos do banco de dados estão em inglês (enquanto I12 não for importado).
- [x] Evoluir `TarotPrintView.tsx` e `tarot-print.css`: suporte a tamanho Tarô (70x120mm) e Poker (63x88mm), fonte legível na impressão (>= 8.5pt), seleção de subconjunto de magias, opção de não truncar em 300 caracteres e suporte a impressão de cartas de Talentos/Ações da ficha. (Tamanho Tarô/Poker, seleção de subconjunto e texto completo implementados.)

### Critérios de Aceite (DoD)

- [x] Criar um personagem no Criador e clicar em "Salvar & Abrir" abre a ficha completa com atributos, perícias iniciais, herança e subclasse preservados, sem criar registro duplicado.
- [ ] Conjuradores conseguem consultar *Spell DC*, *Spell Attack* e marcar slots gastos diretamente na ficha.
- [x] Usuário consegue ler a regra completa de um talento dentro do `FeatPickerModal` antes de selecioná-lo.

---

## Sprint 6 — Integridade de Regras PF2e Remaster, Backup e Empacotamento Desktop

Objetivo: eliminar cálculos incorretos de regras do Remaster, adicionar backup de personagem e tornar o app distribuível fora do `vite dev`.

### Tarefas

- [ ] Ler `classFeatLevels`, `skillFeatLevels`, `skillIncreaseLevels` e progressão automática de proficiências (Percepção, Fortitude, Reflexo, Vontade, Armaduras, Armas e *Class DC*) do `system_json` da classe em `pf2e.db` até o nível 20 (I2).
- [ ] Implementar regras pendentes do Player Core Remaster: boosts parciais para atributo >= +4 (I6), validação de teto de proficiência por nível (Expert 3+, Master 7+, Legendary 15+) (I7), talentos de perícia no slot geral (I8), bloqueio de boost duplicado na ancestralidade (I9), remoção de "Score 10–18" legado (A3) e correção do `Diehard` sem somar +1 PV/nível (B9).
- [ ] Adicionar suporte a perícias de Conhecimento (*Lore*) criadas pelo antecedente ou pelo jogador na aba `Perícias`.
- [ ] Calcular *Bulk* total carregado no `InventoryView.tsx` comparando com os limites `5 + FOR` (*Encumbered*) e `10 + FOR` (máximo), com suporte a contêineres (mochila) e uso rápido de consumíveis.
- [ ] Corrigir `handleLevelUp` / `handleLevelDown` em `LevelProgressionView.tsx` para salvar estatísticas calculadas já no nível de destino (B4) e corrigir `handleSaveProgress` usando `INSERT ... ON CONFLICT(id) DO UPDATE` (B6).
- [ ] Implementar Exportar e Importar personagem em JSON (backup individual e portabilidade entre instalações).
- [ ] Migrar toda a API REST de `vite.config.ts` para handlers IPC no `electron/main.cjs` + `electron/preload.cjs`, armazenando `pf2e.db` em `app.getPath('userData')` (I1).
- [ ] Fechar itens de segurança e qualidade de backend/infra: apagar `cookies.txt` e invalidar sessão (P1), sanitizar HTML com DOMPurify antes de `dangerouslySetInnerHTML` (P3), configurar CSP e bloqueio de `will-navigate` / `setWindowOpenHandler`, validar `limit`/`offset` (B8) e remover `tsc --noUnusedLocals` warnings (A5).

### Critérios de Aceite (DoD)

- [ ] `npm run build` + `npm start` abre o app Electron funcional sem `vite dev` rodando, lendo e gravando em `userData/pf2e.db`.
- [ ] Personagens de classes distintas (ex.: Rogue, Investigator, Barbarian, Wizard, Fighter) recebem slots, perícias, saves e proficiências corretos do nível 1 ao 20.
- [ ] Exportação e importação JSON restauram um personagem completo sem perda de dados.
