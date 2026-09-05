# Arquitetura

## Objetivo

O Nexus Core sera uma plataforma local-first para acelerar a criacao de sistemas desktop. A stack alvo continua sendo `Electron + React + SQLite`, mas nesta fase estamos consolidando a organizacao da base.

## Camadas

### 1. Apps

Produtos finais para clientes ou nichos especificos.

Exemplos:

- `meu-engenheiro`
- `pdv`
- `crm`
- `financeiro`

Responsabilidades:

- regras de negocio especificas
- identidade visual do produto
- composicao de modulos
- configuracao de fluxos por segmento

### 2. Packages compartilhados

Blocos reutilizaveis da plataforma.

- `packages/core`: contratos, configuracao, eventos, logs, utilitarios do runtime
- `packages/database`: conexao SQLite, migracoes, seeds, repositorios base
- `packages/ui`: design system, layout, inputs, tabelas, cards, feedback
- `packages/auth`: autenticacao local, sessao, permissao, perfis
- `packages/modules/*`: modulos de negocio reutilizaveis

### 3. Modulos

Cada modulo precisa ser independente o suficiente para entrar em mais de um app.

Exemplos iniciais:

- `crm`
- `financeiro`
- `documentos`
- `ai`

## Regras de desenho

- Nada de regra de negocio espalhada em componente visual.
- Cada modulo deve expor contratos claros: `schema`, `service`, `routes`, `ui`, `permissions`.
- O app decide quais modulos ativa.
- O banco deve aceitar migracoes por modulo.
- Todo modulo novo deve nascer com sua propria documentacao.

## Stack-alvo

- `Electron`: shell desktop
- `React`: interface
- `SQLite`: persistencia local
- `better-sqlite3`: driver local
- `Tailwind`: base visual
- `shadcn/ui`: composicao de componentes
- `TanStack Table`: tabelas
- `React Hook Form + Zod`: formularios e validacao
- `React Router`: navegacao
- `React Query`: sincronizacao de dados locais/remotos

## Direcao de evolucao

### Fase 1

- monorepo
- padroes
- contratos do core
- catalogo de modulos

### Fase 2

- design system
- layout base
- CRUD generico
- tabelas, filtros e formularios

### Fase 3

- auth
- permissoes
- backup
- importacao/exportacao
- PDF
- logs

### Fase 4

- primeiro produto real: `meu-engenheiro`
