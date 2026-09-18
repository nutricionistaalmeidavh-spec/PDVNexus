# Jornadas E2E de negocio do PDV Nexus

Esta suite complementa os testes de dominio e os fluxos ja existentes de revisao visual, checkout demonstrativo e rastreio fisico de lotes.

## Cobertura

- 25 jornadas de negocio independentes executadas sobre o runtime ArtiSys QA.
- 2 fluxos ArtiSys QA ja existentes: `ui-review` e `batch-physical-tracking`.
- 1 demo E2E de checkout (`checkout-flow`).
- Total operacional: 28 jornadas/fluxos automatizados de interface, alem dos testes de dominio.

Categorias obrigatorias:

- caixa;
- vendas e pagamentos;
- clientes;
- produtos;
- estoque e entrada de compra;
- financeiro e cancelamentos;
- usuarios/permissoes;
- configuracoes e cupom;
- relatorios;
- promocoes.

Cada jornada e executada em uma nova instancia Electron e restaura ou prepara o estado necessario antes de exercer a UI, evitando depender da ordem dos demais fluxos.
