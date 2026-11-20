# Relatório de Diagnóstico Sistêmico de UX e Plano de Evolução: Gerenciador PF2e Remaster

Este documento estabelece o diagnóstico crítico de arquitetura de informação, usabilidade e experiência do usuário (UX) do gerenciador de personagens de Pathfinder 2ª Edição Remasterizada (`pf2charsheet`), acompanhado da especificação sistêmica das mudanças necessárias para transformar o protótipo funcional atual em uma ferramenta coesa, ágil e ergonomicamente alinhada aos padrões de mesa de jogo e design contemporâneo de software.

## Diagnóstico Sistêmico da Interface Atual

A análise da interface e do fluxo operacional do sistema revelou um conjunto de qualidades técnicas notáveis — tais como acesso direto ao banco SQLite local de alta densidade em [pf2e.db](file:///Users/caq/src/pf2charsheet/pf2e.db) e renderização veloz em React/Tailwind —, contraposto a gargalos sistêmicos de experiência do usuário. Uma abordagem de UX sistêmica não avalia telas como silos estéticos isolados, mas sim como nós interconectados em um ecossistema de dados, modelos mentais do jogador e ciclos de interação durante as fases de preparação e execução da sessão de RPG.

### Fragmentação do Estado e Ausência de Contexto Global Ativo

O principal problema estrutural identificado em [App.tsx](file:///Users/caq/src/pf2charsheet/src/App.tsx) é a dispersão de contexto. A aplicação operava previamente sem uma entidade de personagem ativo sustentada de forma unificada no topo da árvore de componentes.

- Em [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx), o usuário instancia um novo personagem através de um assistente dividido em cinco etapas.
- Em [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx), existia outro estado local independente que inicializava o guerreiro padrão Valeros ou carregava o primeiro registro da tabela SQLite, sem sincronização direta com a navegação originada do criador.
- Em [SpellbookBuilderView.tsx](file:///Users/caq/src/pf2charsheet/src/components/SpellbookBuilderView.tsx), grimórios são mantidos como listas genéricas e desconectadas de qualquer ficha de personagem, impossibilitando que um Mago ou Clérigo veja suas magias atreladas à sua própria ficha de evolução.
- Nos compêndios em [FeatExplorerView.tsx](file:///Users/caq/src/pf2charsheet/src/components/FeatExplorerView.tsx) e na busca de magias em [App.tsx](file:///Users/caq/src/pf2charsheet/src/App.tsx), os itens de banco de dados funcionavam apenas como catálogo de leitura e favoritos em localStorage, sem a possibilidade de injetar um talento ou magia diretamente na ficha ativa.

### Ruptura no Modelo Mental entre Criação (ABC) e Progressão de Nível

Pathfinder 2e Remaster possui uma curva contínua de criação e evolução: o 1º nível é simplesmente o marco fundacional onde Ancestralidade, Antecedente, Classe e Aumentos Livres são definidos, seguido imediatamente pela alocação de talentos e perícias do 1º ao 20º nível.

- A separação estrita da interface em abas estanques fratura o modelo mental do jogador.
- Quando o usuário conclui o passo 5 em [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx#L1349-L1450) e salva o herói, a ação final era puramente estática. O sistema não guiava o usuário fluidamente para o planejamento dos níveis subsequentes nem preservava a visualização unificada da ficha.
- A progressão em [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx#L845-L1115) duplicava seleções de nível 1 em uma interface diferente daquela onde o personagem foi construído, gerando redundância cognitiva e retrabalho.

### Incompletude nas Regras Fundamentais do Remaster (ABCH e Subclasses)

O sistema afirma aderir ao padrão PF2e Remaster, porém omitia pilares mandatórios das regras de criação do *Player Core*:

- Omissão da Herança (*Heritage*): O método de criação oficial é ABCH (*Ancestry, Background, Class, Heritage*). O banco SQLite contém a tabela `heritages` com todas as heranças versáteis (Nephilim, Aasimar, Tiefling, Dhampir, Changeling) e heranças específicas de cada ancestralidade, conforme definido no esquema em [export_foundry_to_sqlite.cjs](file:///Users/caq/src/pf2charsheet/scripts/export_foundry_to_sqlite.cjs#L57-L66). Todavia, não existia endpoint em [vite.config.ts](file:///Users/caq/src/pf2charsheet/vite.config.ts) nem etapa seletora de herança no criador em [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx).
- Ausência de Subclasses e Doutrinas: Classes de PF2e dependem intrinsecamente de escolhas no 1º nível (ex.: Doutrina de Clérigo entre Clérigo de Guerra ou Enclausurado; Tradição de Bruxo; Esquema de Ladino; Ordem de Druida). O estado tipado em [types/pf2e.ts](file:///Users/caq/src/pf2charsheet/src/types/pf2e.ts#L170) previa o campo `subclass`, mas ele nunca era alimentado ou consultado na UI.
- Resquício de Valores Legados (*Ability Scores*): O Remaster extinguiu completamente os valores 10, 12, 14, 18 em prol de puramente Modificadores de Atributo (+0, +1, +2, +4). A UI em [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx#L529-L531) e [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx#L1135) continuava exibindo "Score 18", gerando confusão semântica para quem joga com o livro remasterizado.

### Cálculo Rígido e Incompleto de Estatísticas de Combate

As estatísticas derivadas atuais não refletem um personagem jogável real:

- A Classe de Armadura (CA) em [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx#L414) está fixada como sem armadura (`10 + Dex + 2 + Level`). Personagens não possuem seletor de armadura (leve, média, pesada), escudo alçado nem bônus de item.
- Não há gestão de ataques principais (*Strikes* corporais e à distância), cálculo de CDs de magia (*Spell DC*), nem inventário/carga (*Bulk*).
- A aplicação opera como um "planejador de talentos", mas falha em operar como uma "ficha de mesa" funcional.

### Sobrecarga Visual e Ergonomia da Interface

A inspeção detalhada do layout evidenciava fricções de ergonomia:

- Proliferação excessiva de micropipografia: Uso frequente de classes utilitárias como `text-[8px]`, `text-[9px]` e `text-[10px]` em badges de ações, traits e slots de nível. Isso prejudica drasticamente a legibilidade em telas de alta resolução ou laptops sem escala agressiva.
- Navegação superior sem responsividade elástica: Em telas menores ou janelas divididas, os botões de abas horizontais causavam transbordamento sem gaveta adaptativa.
- Diálogos bloqueantes e feedback primitivo: O aplicativo ainda utiliza `window.confirm` nativo do navegador para exclusões em [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx#L419) e [SpellbookBuilderView.tsx](file:///Users/caq/src/pf2charsheet/src/components/SpellbookBuilderView.tsx#L181), quebrando a estética e a imersão de um app desktop construído sobre Electron.
- Inconsistência na alocação de talentos: A seleção de talentos no slot de nível abre o [FeatPickerModal.tsx](file:///Users/caq/src/pf2charsheet/src/components/FeatPickerModal.tsx), mas este não exibe o texto completo das regras do talento nem os pré-requisitos validados contra o personagem, forçando o usuário a adivinhar se cumpre os requisitos.

## Arquitetura Sistêmica Proposta

A solução requer migrar da abordagem de "abas desconectadas" para um modelo centrado no personagem com compêndios utilitários adjacentes.

### Visão Geral da Topologia da Interface

- Cabeçalho Global Persistente com Seletor Ativo: O topo da aplicação exibe permanentemente o avatar, nome, classe, nível e seletor rápido do personagem ativo no sistema. Qualquer aba acessada subsequentemente opera no contexto desse personagem.
- Modos de Ficha Alternáveis: Uma alternância direta entre "Modo Criação & Evolução (1-20)" e "Modo Ficha de Jogo (Em Sessão)".
- Conexão Bidirecional com Compêndios: A navegação por Magias e Talentos passa a exibir botões contextuais como "Adicionar à Ficha Ativa (Slot Nvl X)" ou "Adicionar ao Grimório de [Nome do Personagem]".
- Banco SQLite Enriquecido com Heranças e Características de Classe: Exposição formal de `heritages` e `classfeatures` via endpoints no servidor embutido do Vite e rotas IPC do Electron.

## Mudanças Implementadas: Nova Barra Lateral Esquerda com Gestão de Personagem no Topo e Refinamento Ergonômico

A reorganização visual e de navegação solicitada foi implementada com êxito em [App.tsx](file:///Users/caq/src/pf2charsheet/src/App.tsx), [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx), [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx) e [SpellFiltersBar.tsx](file:///Users/caq/src/pf2charsheet/src/components/SpellFiltersBar.tsx):

- Largura Ajustável e Recolhimento da Barra Lateral: Implementado manipulador de arrasto (*drag-to-resize*) na borda direita da barra lateral, permitindo redimensionamento contínuo entre 200px e 480px, com persistência da largura em `localStorage`. Adicionado botão recolher/expandir (*collapse/expand*) utilizando os ícones `PanelLeftClose` e `PanelLeftOpen`, contraindo a barra lateral para uma coluna compacta de ícones de 64px e expandindo de volta à largura customizada.
- Remoção de Elementos Redundantes na Barra Lateral: Removidos o botão redundante "Trocar" no card de personagem (mantendo o dropdown suspenso direto para troca ágil e o botão "+ Novo Herói") e a aba "Criador ABC" da lista de abas, limpando o ruído visual e centralizando a navegação na ficha de progressão.
- Otimização do Compêndio de Magias: Removida a linha redundante de botões "Tipos de Recursos Mágicos" em [SpellFiltersBar.tsx](file:///Users/caq/src/pf2charsheet/src/components/SpellFiltersBar.tsx), uma vez que a categoria da magia (padrão, truque, foco ou ritual) já é selecionável pelo combobox do painel de filtros.
- Card de Personagem Ativo Unificado com Hierarquia de Informação e Popover: O card do personagem ativo foi transformado em um gatilho clicável único, eliminando o combobox redundante. A hierarquia visual foi calibrada para priorizar o Nome do Herói como âncora principal em tipografia de alto impacto (`text-sm sm:text-base font-black text-white`), tratando classe, ancestralidade e arquétipos como metadados secundários subordinados ao nome (acomodando personagens multiclasse e com arquétipos).
- Inclusão de Mini-Status de Combate: Incorporada no card uma leitura operacional rápida com pontos de vida (`PV atual / máximo`), badge de Classe de Armadura (`CA`) e mini-barra de progresso de saúde.
- Popover Interativo de Seleção e Gerenciamento Nativo: Ao clicar no card, abre-se um popover suspenso com campo de busca em tempo real, lista rolante customizada de todos os heróis salvos com exclusão direta por item (`Trash2` no hover com confirmação de segurança) e atalho direto para criar um novo herói em branco. A seleção do personagem é instantânea em 1 clique com fechamento ao clicar fora.
- Eliminação de Redundâncias e Ruído (Modelos Icônicos e Modal Secundário): Removidos integralmente o modal secundário `CharacterSelectorModal`, os botões de modelos pré-gerados icônicos e o botão duplicado de gerenciador. Todo o ciclo de vida do personagem (selecionar, alternar, excluir e criar novo herói) ocorre nativamente no seletor unificado, erradicando telas intermediárias desnecessárias. Na visão de progressão de nível, foram eliminados botões e selects duplicados de troca de herói.
- Ação Direta de Criação: O cabeçalho do painel mantém apenas o botão de ação rápida `UserPlus` ("Novo"), direcionando sem ambiguidades para o assistente de criação em branco.
- Botões de Ação Imediata (Ficha e Impressão): Adicionados botões dedicados de "Visualizar Ficha" (`FileText`) e "Imprimir Ficha" (`Printer`) tanto no cabeçalho do herói na barra lateral quanto na barra de ações de [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx), com estilos `@media print` em [index.css](file:///Users/caq/src/pf2charsheet/src/index.css) formatando folhas A4 limpas com isolamento de controles interativos.
- Filtro Estrito de Talentos de Ancestralidade: O seletor de talentos em [FeatPickerModal.tsx](file:///Users/caq/src/pf2charsheet/src/components/FeatPickerModal.tsx) agora restringe a busca estritamente ao traço da ancestralidade escolhida pelo personagem (ex.: apenas talentos com traço `human`, `elf`, `centaur`, etc.), eliminando a exibição confusa de talentos de outras raças em slots de ancestralidade.
- Limpeza Terminológica de Persistência: Removidas todas as menções explícitas a "no SQLite" em botões de ação e alertas de feedback ("Salvar Personagem", "Salvar Ficha", "Salvar Grimório"), mantendo o foco cognitivo no modelo conceitual do usuário e na imersão de mesa.
- Abas Verticais Focadas: Agrupamento limpo das abas entre "Ficha & Evolução" (Progressão 1-20, Grimórios) e "Compêndios Remaster" (Magias, Talentos), com realce dourado de alto contraste na aba ativa.
- Sincronização Bidirecional de Estado: O componente raiz em [App.tsx](file:///Users/caq/src/pf2charsheet/src/App.tsx) centraliza o carregamento dos personagens e compêndios auxiliares, propagando o identificador do personagem ativo diretamente para [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx) e recebendo eventos de atualização de [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx).
- Rodapé de Status de Banco: Indicador de conectividade com `pf2e.db` SQLite posicionado no rodapé da barra lateral, preservando a área principal de conteúdo livre para foco exclusivo na ficha e nos filtros.

## Plano de Execução em Sprints Operacionais (Sprint Backlog Buckets)

Para viabilizar a implementação técnica sem quebras de funcionalidade, as diretrizes foram estruturadas em cinco sprints sequenciais com objetivos precisos, arquivos impactados e critérios de aceite mensuráveis.

### Sprint 1: Fundação do Remaster (Heranças, Subclasses e Modificadores Puros)

- Objetivo Estratégico: Eliminar todas as inconsistências com as regras do PF2e Remaster, disponibilizando heranças e subclasses diretamente no fluxo de criação e erradicando os resquícios de atributos pré-remasterizados.
- Arquivos Impactados:
- [vite.config.ts](file:///Users/caq/src/pf2charsheet/vite.config.ts): Implementar endpoint `/api/heritages` com suporte a filtros por `ancestry_slug` e busca por heranças versáteis (`ancestry_name IS NULL` ou traço versátil).
- [types/pf2e.ts](file:///Users/caq/src/pf2charsheet/src/types/pf2e.ts): Criar `HeritageItem`, atualizar `CharacterABCState` com `heritage: HeritageItem | null` e `subclass: string`. Remover propriedades `score` mantendo apenas modificador.
- [api.ts](file:///Users/caq/src/pf2charsheet/src/services/api.ts): Adicionar funções `fetchHeritages(ancestrySlug?: string)` e `fetchHeritageById(id: string)`.
- [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx): Inserir o passo "B - Herança (Heritage)" logo após a Ancestralidade. Adicionar seleção de Subclasse/Doutrina na etapa de Classe. Remover todos os rótulos "Score 10".
- [formatters.ts](file:///Users/caq/src/pf2charsheet/src/utils/formatters.ts): Remover cálculos que multiplicam modificador por dois para gerar score falso de 10 a 18.
- Instruções Práticas de Implementação:
- Consultar a tabela `heritages` do SQLite: `SELECT h.*, i.img, i.rarity FROM heritages h JOIN items i ON h.id = i.id`.
- Ao selecionar uma ancestralidade (ex.: Humano), buscar heranças específicas e heranças versáteis (Nephilim, Changeling, etc.).
- Exibir os benefícios da herança na coluna de resumo lateral.
- Critérios de Aceite (DoD):
- O assistente de criação reflete o ciclo ABCH completo (Ancestry, Background, Class, Heritage).
- Nenhuma tela exibe pontuações legadas de 10 a 18; apenas modificadores com sinal (+0, +1, +2, +3, +4).
- Personagens salvos no SQLite gravam os campos `heritage` e `subclass` preenchidos.

### Sprint 2: Continuidade Operacional e Unificação Criação-Progressão

- Objetivo Estratégico: Eliminar o atrito cognitivo entre o assistente de 1º nível e o planejador de 1-20, transformando-os em uma experiência coesa e sem redundância.
- Arquivos Impactados:
- [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx): Conectar o botão final "Salvar & Abrir Progressão" disparando navegação direta para o nível 1 em [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx).
- [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx): Exibir badge com aviso caso o personagem ativo possua talentos ou aumentos pendentes no nível inspecionado.
- [App.tsx](file:///Users/caq/src/pf2charsheet/src/App.tsx): Notificar a mudança de abas preservando os dados em memória sem recarregamento desnecessário do SQLite.
- Instruções Práticas de Implementação:
- No seletor de níveis (1 a 20) de [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx#L810-L842), adicionar um ponto indicador âmbar pulsante nos botões de nível que possuem escolhas não preenchidas.
- Validar as perícias iniciais treinadas no 1º nível contra a fórmula da classe selecionada (`baseClassSkills + IntMod`). Exibir contador decrescente de pontos disponíveis.
- Critérios de Aceite (DoD):
- O jogador consegue criar um herói no Criador ABC e, ao salvar, cai imediatamente na tela de progressão com os atributos, herança e classe já selecionados.
- Os botões de nível indicam visualmente se há escolhas pendentes naquele nível.
- O sistema bloqueia ou alerta sobreseleção de perícias no 1º nível além do limite da classe.

### Sprint 3: Interconexão Reativa dos Compêndios (Magias e Talentos Injetáveis)

- Objetivo Estratégico: Transformar os compêndios de leitura passiva em ferramentas ativas de composição de ficha.
- Arquivos Impactados:
- [FeatCard.tsx](file:///Users/caq/src/pf2charsheet/src/components/FeatCard.tsx) e [FeatTableView.tsx](file:///Users/caq/src/pf2charsheet/src/components/FeatTableView.tsx): Inserir botão de ação rápida "Vincular à Ficha".
- [SpellCard.tsx](file:///Users/caq/src/pf2charsheet/src/components/SpellCard.tsx) e [SpellTableView.tsx](file:///Users/caq/src/pf2charsheet/src/components/SpellTableView.tsx): Inserir botão "Adicionar ao Grimório".
- [SpellbookBuilderView.tsx](file:///Users/caq/src/pf2charsheet/src/components/SpellbookBuilderView.tsx): Vincular grimórios ao `character_id` do herói ativo.
- [FeatPickerModal.tsx](file:///Users/caq/src/pf2charsheet/src/components/FeatPickerModal.tsx): Renderizar pré-requisitos completos e indicar se o personagem cumpre as exigências.
- Instruções Práticas de Implementação:
- Quando o usuário clica em "Vincular à Ficha" em um talento, abrir menu popover listando os slots de talento disponíveis compatíveis no personagem ativo (ex.: "Slot Talento de Perícia Nvl 2", "Slot Talento Geral Nvl 3").
- Filtrar automaticamente o compêndio de magias de acordo com a tradição mágica da classe ativa (Arcana, Divina, Oculta ou Primal).
- Critérios de Aceite (DoD):
- Um talento do compêndio pode ser vinculado diretamente a um slot livre do personagem sem abrir a tela de progressão manualmente.
- O grimório ativo é salvo associado ao personagem corrente e carregado automaticamente ao trocar de herói.

### Sprint 4: Cockpit de Mesa / Modo Sessão de Jogo (Ficha Operacional de Combate)

- Objetivo Estratégico: Prover uma interface dedicada ao jogo em tempo real durante a sessão, otimizada para consulta ágil de dados de combate e sobrevivência.
- Arquivos Impactados:
- Novo componente `src/components/PlaySessionView.tsx`.
- [App.tsx](file:///Users/caq/src/pf2charsheet/src/App.tsx): Adicionar a aba "Ficha de Mesa" na barra lateral esquerda.
- [LevelProgressionView.tsx](file:///Users/caq/src/pf2charsheet/src/components/LevelProgressionView.tsx): Compartilhar cálculos derivados com a ficha de jogo.
- Instruções Práticas de Implementação:
- Rastreador de Pontos de Vida: Barra visual de PV com valor atual, máximo e temporário. Botões rápidos de +/- 1, 5, 10.
- Painel de Ataques (*Strikes*): Exibir os ataques padrão (arma principal, desarmado) com bônus de acerto e fórmula de dano calculada baseada em Força/Destreza e nível.
- Seletor de Condições de PF2e: Dropdown com condições oficiais (Frightened, Sickened, Clumsy, Drained, Stunned). Aplicar penalidade automática nos modificadores enquanto ativas.
- Rastreador de Ações e Reações: Cartões visuais das reações disponíveis (Ataque de Oportunidade/Reativo, Bloqueio com Escudo) e magias preparadas prontas para conjuração.
- Critérios de Aceite (DoD):
- O jogador consegue alterar PV e registrar dano em menos de 2 cliques durante a rodada de combate.
- Ativar uma condição como *Frightened 1* aplica penalidade visual imediata nos testes de ataque e CA.
- Ataques exibem o valor exato do bônus de acerto com MAP (Penalidade por Múltiplos Ataques: 0 / -5 / -10).

### Sprint 5: Refinamento Ergonômico, Acessibilidade e Baralhos Táticos

- Objetivo Estratégico: Elevar o acabamento visual, acessibilidade tipográfica e utilitários de suporte físico de mesa.
- Arquivos Impactados:
- [index.css](file:///Users/caq/src/pf2charsheet/src/index.css): Padronização de escala tipográfica mínima (substituindo classes de texto menores que 11px por tamanhos legíveis).
- [TarotPrintView.tsx](file:///Users/caq/src/pf2charsheet/src/components/TarotPrintView.tsx) e [tarot-print.css](file:///Users/caq/src/pf2charsheet/src/components/tarot-print.css): Expandir o gerador de cartas para suportar talentos de classe e ações de combate.
- [CharacterCreatorView.tsx](file:///Users/caq/src/pf2charsheet/src/components/CharacterCreatorView.tsx) e [SpellbookBuilderView.tsx](file:///Users/caq/src/pf2charsheet/src/components/SpellbookBuilderView.tsx): Substituição de diálogos nativos (`window.confirm`) por modais assíncronos estilizados com Tailwind.
- Instruções Práticas de Implementação:
- No gerador de cartas de impressão, permitir marcar quais talentos da ficha ativa devem ser impressos em formato de carta de tarô para apoio físico na mesa.
- Adicionar atalhos de teclado globais para navegação rápida entre abas e busca instantânea nos compêndios.
- Critérios de Aceite (DoD):
- Nenhum elemento textual da interface possui tamanho inferior a 11px.
- Todas as operações de exclusão utilizam modais internos com suporte a confirmação por teclado.
- A ferramenta gera PDF para impressão de cartas de tarô combinando magias e talentos da ficha ativa.

## Conclusão Pragmática

Com o Sprint 1 e Sprint 2 focados na integridade das regras do Remaster e na experiência de montagem, seguidos pelos Sprints 3 e 4 focados na interconexão e dinâmica de mesa, o projeto `pf2charsheet` alcança maturidade de produto, transformando o rico banco SQLite local em uma estação de trabalho para jogadores e mestres de Pathfinder 2e.
