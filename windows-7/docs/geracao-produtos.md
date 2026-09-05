# Geracao de Produtos

## Produtos atuais da base

A Software Factory ja consegue gerar dois produtos a partir do monorepo:

- `Sr. Engenheiro`: app academico com disciplinas, artefatos e IA
- `PDV Demo`: app de caixa com produtos por peso, leitura de codigo, estoque conceitual e integracao inicial de balanca

## Como gerar o Sr. Engenheiro em modo web

Comando:

```bash
npm run build:meu-engenheiro
```

Saida:

```text
apps/meu-engenheiro/dist
```

## Como abrir o Sr. Engenheiro em modo desktop

Comando:

```bash
npm run desktop:start
```

O shell Electron carrega o build de `apps/meu-engenheiro`.

## Como gerar o PDV em modo web

Comando:

```bash
npm run build:pdv-demo
```

Saida:

```text
apps/pdv-demo/dist
```

## Como abrir o PDV em modo desktop

Comando:

```bash
npm run desktop:start:pdv
```

O shell Electron usa `NEXUS_APP=pdv-demo` para carregar o PDV.

## Como gerar pacote desktop de teste

Comando:

```bash
npm run desktop:pack
```

Saida:

```text
apps/nexus-desktop/dist-desktop/win-unpacked/Nexus Core.exe
```

## O que ja existe para o Sr. Engenheiro

- disciplinas
- artefatos
- chat IA com Gemini, OpenRouter e Groq
- chaves por usuario no desktop com `safeStorage`
- shell Electron

## O que ainda falta para o Sr. Engenheiro ficar vendavel

- banco local SQLite
- cadastro real de disciplinas/materiais
- persistencia de conversas
- upload/importacao de materiais
- geracao real de artefatos
- instalador com icone e nome final

## O que ja existe para o PDV

- demo de cadastro de produtos por peso em memoria
- leitura EAN-13 de balanca
- leitor USB em modo teclado
- bridge serial Electron para balanca USB/COM
- parser de peso de balanca
- lancamento de item na venda
- totalizacao
- exportacao Toledo `ITENSMGV.TXT`
- exportacao Urano `PRODUTOS.TXT`

## O que ainda falta para o PDV ficar vendavel

- cadastro real de produtos
- SQLite para produtos, estoque e vendas
- tela de caixa completa
- abertura e fechamento de caixa
- controle de estoque
- formas de pagamento
- NFC-e/SAT, se for fiscal
- homologacao com uma balanca real
- configuracao persistente de porta COM por caixa
- instalador com marca do produto

## Hardware necessario para homologar PDV

- leitor de codigo de barras USB configurado para enviar `Enter` ao final
- balanca etiquetadora Toledo ou Urano para validar arquivos TXT
- balanca USB/serial ou conversor USB/COM para validar leitura direta de peso
- exemplos reais de etiquetas emitidas no cliente

## Observacao

O leitor USB tipo teclado ja tende a funcionar sem driver especial. A balanca conectada diretamente exige homologacao por modelo, porque cada fabricante pode enviar strings de peso em formatos diferentes.