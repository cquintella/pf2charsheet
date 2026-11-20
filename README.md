![PF2ECharSheet](docs/banner.jpg)

# Pathfinder Character Manager 2eR

## Instalação para desenvolvimento

É necessário Node.js 22.13 ou mais recente, com `node:sqlite` disponível.

```sh
npm install
npm run dev
```

A instalação cria `pf2e.db` com o esquema necessário quando o arquivo ainda não existe. O comando é idempotente e não apaga personagens, grimórios ou compêndios existentes. Para inicializar manualmente:

```sh
npm run db:init
```

O banco é local e não é enviado ao Git. Ele contém os dados dos personagens e deve ser incluído nos backups pessoais do usuário.

## Dados dos compêndios

Em um banco novo, `npm install` também tenta baixar o repositório [Foundry PF2e](https://github.com/foundryvtt/pf2e) na revisão `52dfeee703b887237f5e454747bcae45b136f9af` e importar seus arquivos JSON. Se o download falhar, a instalação preserva o banco vazio e informa como repetir a operação. Um banco que já contém itens não é atualizado automaticamente.

Para importar ou atualizar manualmente:

```sh
npm run db:import-foundry
```

Para usar um checkout local do Foundry, sem baixar novamente:

```sh
npm run db:import-foundry -- --source=/caminho/para/pf2e
```

Também é possível definir `FOUNDRY_SOURCE_DIR` na instalação. Para testar em outro banco, use `--db=/caminho/para/banco.db` ou `SQLITE_DB_PATH`. A importação atualiza os dados de compêndio por ID e preserva personagens e grimórios. A versão específica da fonte está no script `scripts/import-foundry.cjs` e deve ser alterada deliberadamente.

O importador cobre ancestralidades, heranças, antecedentes, classes, talentos, magias, equipamentos, ações, condições e divindades. Regras de jogo estruturadas são mantidas em `system_json`, mas nem todas são aplicadas automaticamente pela ficha.

O importador de magias do Archives of Nethys (`npm run db:populate-spells`) permanece opcional e não substitui a importação dos outros compêndios. O código e os dados do Foundry têm termos de licença e atribuição próprios; consulte a documentação da fonte antes de redistribuí-los.
