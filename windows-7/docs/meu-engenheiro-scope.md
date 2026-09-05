# Meu Engenheiro - Escopo Inicial

## Base visual observada

Pelos prints enviados em 5 de agosto de 2026, o produto atual ja demonstra uma estrutura consistente e reaproveitavel:

- pagina de `Disciplinas`
- pagina de `Dr. Engenheiro`
- pagina de `Artefatos`
- roteamento simples por paginas
- busca global por conteudo
- cards com metadados
- filtros por tipo de artefato

## Leitura de produto

O `Meu Engenheiro` nao precisa ser tratado como um app isolado. Ele parece ser a composicao de tres modulos fortes:

### 1. Modulo Academico

Responsavel por organizar a estrutura do conhecimento.

Entidades candidatas:

- curso
- semestre
- disciplina
- material

Responsabilidades:

- cadastrar disciplinas
- agrupar por semestre ou categoria
- listar quantidade de materiais
- abrir detalhes da disciplina

### 2. Modulo Especialista IA

Responsavel pelo `Dr. Engenheiro`.

Entidades candidatas:

- especialista
- conversa
- mensagem
- contexto
- sugestao

Responsabilidades:

- chat geral por area
- chat contextual por disciplina
- perguntas sugeridas
- historico de conversas
- configuracao de contexto por disciplina

### 3. Modulo Artefatos

Responsavel pelo conteudo gerado.

Entidades candidatas:

- artefato
- tipo de artefato
- disciplina vinculada
- origem da geracao

Tipos observados nos prints:

- resumo
- infografico
- mapa mental
- imagem

Responsabilidades:

- listar artefatos
- buscar por titulo
- filtrar por tipo
- abrir detalhes
- duplicar
- baixar
- excluir

## Navegacao inicial

Estrutura sugerida para a primeira versao:

- `/disciplinas`
- `/disciplinas/:id`
- `/dr-engenheiro`
- `/artefatos`
- `/artefatos/:id`

## MVP recomendado

Para colocar o produto em uso rapido, eu focaria no seguinte:

### Bloco 1

- layout base
- navegacao
- tema visual
- shell desktop

### Bloco 2

- CRUD de disciplinas
- agrupamento por semestre
- busca em disciplinas

### Bloco 3

- tela do especialista
- chat funcional
- perguntas sugeridas

### Bloco 4

- listagem de artefatos
- filtros por tipo
- detalhe do artefato

## O que fica para depois

- matriz curricular completa
- perfil e preferencias
- lembretes e prazos
- painel de questoes
- galeria expandida
- analytics de uso

## Reaproveitamento dentro do Nexus Core

O `Meu Engenheiro` ja valida varios ativos da plataforma:

- `module-ai`
- `module-documentos`
- `module-crm` adaptado para entidades academicas
- `ui` para cards, filtros e tabelas
- `database` para SQLite local
