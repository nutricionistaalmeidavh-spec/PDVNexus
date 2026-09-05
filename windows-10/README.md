# Nexus Core

Base de software reutilizavel para montar ERPs e sistemas desktop com foco em reaproveitamento de modulos, componentes e regras comuns.

## Visao

O objetivo do Nexus Core e reduzir o custo de criar novos sistemas. Em vez de iniciar cada projeto do zero, a ideia e combinar:

- `core`: servicos e infraestrutura compartilhada
- `packages`: componentes, utilitarios e modulos reutilizaveis
- `apps`: produtos finais montados sobre a base comum
- `docs`: arquitetura, catalogo e padroes de desenvolvimento

## Estrutura Inicial

```text
nexus-core/
  apps/
    meu-engenheiro/
  packages/
    core/
    database/
    ui/
    auth/
    modules/
      crm/
      financeiro/
      documentos/
      ai/
  docs/
    architecture.md
    roadmap.md
    module-template.md
```

## Principios

- Tudo novo deve nascer como potencial modulo reutilizavel.
- Regras especificas de negocio ficam no app, nao no core.
- Componentes visuais ficam separados da regra.
- Banco, auth, logs e configuracao precisam funcionar offline.
- Cada modulo deve ser catalogado para reutilizacao futura.

## Primeira Fase

1. Consolidar a arquitetura e convencoes.
2. Estruturar monorepo.
3. Criar contratos base do core, UI e modulos.
4. Implementar o primeiro CRUD generico.
5. Usar `meu-engenheiro` como primeiro app da plataforma.
