# QA exploratorio — PDV Nexus

Esta terceira camada verifica problemas da interface real, independentemente do sucesso do modelo Ollama.

## Componentes open source
- Playwright / Electron (ja integrados).
- Gremlins.js 2.2.0 (MIT): acoes pseudoaleatorias reproduziveis na UI.
- axe-core 4.14.0 (MPL-2.0): inspecao WCAG automatizada.
- Oraculos locais: leitura da fonte canonica SQLite via nexusDesktop.pdvStore, invariantes de estoque, pagamentos e persistencia apos reload.

## Execucao
Workflow: QA - Exploracao Real (Gremlins + axe).

Padrao: 7 modulos x 2 sementes x 50 interacoes = 700 eventos planejados. Cenarios isolados em perfis temporarios. Seeds, screenshots e Playwright traces ficam no artifact.

Testes E2E das 25 jornadas comerciais continuam independentes, para validar operacoes completas e estados reais. Nao considere um click bem sucedido como prova de que uma compra ou venda funciona.

Cada instancia usa um diretorio de dados exclusivo; as requisicoes HTTP externas do renderer sao bloqueadas. Nao existe dependencia de API paga nem deploy.

## Comandos locais
Na pasta windows-10, em Windows:

    npm ci
    npm ci --prefix tools/artisys-qa
    npm install --no-save --no-package-lock --ignore-scripts --prefix tools/artisys-qa gremlins.js@2.2.0 axe-core@4.14.0
    node --test tests/pdv-qa-exploratory-metrics.test.mjs
    npm run build:pdv-demo
    node qa/run-exploratory-matrix.mjs --seeds 2 --actions 50

## Interpretacao
- critical: erro de renderer, perda de persistencia, invariante canonica violada ou falha de infraestrutura.
- high / medium: acessibilidade ou outras observacoes que requerem confirmacao.
- checked: nenhuma falha critica durante esta exploracao; NAO significa sistema aprovado integralmente.
- Seed permite reproduzir sequencias; conferir screenshots/trace.zip antes de atribuir causa.

## Proximas etapas
- Usar GraphWalker-rs (https://github.com/graphwalker/graphwalker-rs) como gerador de caminhos somente apos modelar os estados canonicos e as transicoes reais de caixa, compras, estoque, venda, cancelamento e relatorios.
- Acrescentar testes de teclado, offline, arquivo de relatorio, cenarios de limite e reinicio do desktop; nao fingir cobertura nao instrumentada.
- Nao perseguir nota 10/10 de Ollama: registrar incidentes, rotas distintas, acertos, loops e dados corrompidos, nao apenas missao cumprida.
