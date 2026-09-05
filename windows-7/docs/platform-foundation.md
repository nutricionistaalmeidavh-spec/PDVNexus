# Platform Foundation

## Objetivo desta etapa

Esta fase cria a espinha dorsal do `Nexus Core` como software factory, sem acoplar a base ao `Meu Engenheiro`.

## O que precisa existir na fundacao

- contratos compartilhados entre apps e modulos
- registro padrao de modulos
- design system minimo
- modelos de dados iniciais
- organizacao de navegacao por feature

## Regra central

Todo produto novo deve conseguir responder a estas perguntas:

1. quais modulos ele usa
2. quais entidades ele persiste
3. quais telas ele publica
4. quais capacidades sao genericas e ficam na plataforma

## Nucleo que nasce agora

- `packages/core`: tipos, contratos e registro de modulos
- `packages/database`: schemas iniciais e seed local
- `packages/ui`: primitives e shell de navegacao
- `packages/modules/*`: metadados e feature contracts
- `apps/meu-engenheiro`: composicao inicial do primeiro produto