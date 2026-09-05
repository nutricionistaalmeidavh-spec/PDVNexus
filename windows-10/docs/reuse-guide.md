# Reutilizacao dos Modulos

## Como isso funciona na pratica

A software factory nao reaproveita um sistema inteiro; ela reaproveita blocos previsiveis.

Exemplo com o modulo de IA:

- no `Meu Engenheiro`, ele vira `Dr. Engenheiro`
- no `Nexus CRM`, ele vira `Assistente Comercial`
- no futuro, no financeiro, ele pode virar `Analista Financeiro`

O modulo continua sendo o mesmo, mas muda:

- o prompt base
- o contexto enviado
- o nome exibido
- as telas que consomem a capacidade

Exemplo com o modulo de cadastros:

- no `Meu Engenheiro`, ele organiza `semestres`, `disciplinas` e `materiais`
- no `CRM`, ele organiza `leads`, `clientes` e `atividades`
- em outro sistema, pode organizar `produtos`, `categorias` e `estoque`

## O que voce reutiliza de verdade

Quando um modulo amadurece, voce nao o recria. Voce reutiliza:

- estrutura de pastas
- contratos e tipos
- componentes visuais
- fluxos de tela
- validacoes
- persistencia
- integracao com IA
- filtros, busca e listagens

## O que muda em cada produto

Normalmente so muda:

- nome do produto
- entidades do dominio
- textos e labels
- regras especificas
- ordem das telas
- identidade visual

## Regra mental simples

Pense assim:

- `platform` = motor e pecas prontas
- `app` = combinacao dessas pecas para um nicho

## Exemplo real do workspace

Hoje ja existem dois apps na base:

- `apps/meu-engenheiro`
- `apps/nexus-crm`

Os dois usam a mesma ideia de composicao por modulo e o mesmo shell visual compartilhado.