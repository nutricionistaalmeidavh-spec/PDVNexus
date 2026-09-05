# Modulo Balanca

## Nome

`balanca`

## Objetivo

Permitir configuracao de balancas etiquetadoras, leitura de codigos de barras, conexao com leitor USB e leitura de balanca USB para produtos vendidos por peso.

## Dependencias

- `@nexus-core/core`
- modulo de produtos do PDV
- modulo de vendas/lancamentos
- shell desktop Electron para drivers USB/serial na versao final

## Banco de dados

Tabelas candidatas:

- `scale_profiles`
- `scale_barcode_rules`
- `weighed_product_logs`
- `weighed_label_templates`
- `usb_device_profiles`

Indices candidatos:

- prefixo da balanca
- codigo do produto
- data de empacotamento
- caixa/dispositivo

## API/Servicos

Casos de uso principais:

- cadastrar perfil de balanca
- definir regra de composicao do codigo de barras
- configurar leitor USB
- configurar balanca USB
- emitir etiqueta com peso, preco, preco/kg e data
- ler codigo de barras no PDV
- ler peso direto da balanca conectada
- converter leitura em item de venda
- exportar carga para Toledo
- exportar carga para Urano

Servicos implementados nesta fase:

- `buildWeighedLabel`
- `parseScaleBarcode`
- `resolveSaleItemFromBarcode`
- `resolvePosInputFromBarcode`
- `parseUsbScaleWeight`
- `buildToledoItemLine`
- `buildUranoProductLine`
- `exportToledoItemsFile`
- `exportUranoProductsFile`

## UI

Telas candidatas:

- configuracao de balanca
- configuracao de leitor USB
- tabela de produtos por peso
- emissao/reimpressao de etiquetas
- historico de leituras
- exportacao de carga
- simulador de leitura para homologacao

Componentes:

- formulario de regra de codigo
- preview da etiqueta
- simulador de leitura
- gerador de arquivo TXT
- status de dispositivo USB

## Permissoes

- administrador: configura perfis, regras e dispositivos
- operador: imprime etiqueta
- caixa: apenas le codigo e peso no PDV

## Exemplos de uso

### PDV com etiqueta

1. operador pesa produto
2. balanca gera etiqueta com codigo
3. caixa bipa no PDV usando leitor USB
4. sistema extrai peso/preco
5. item entra na venda

### PDV com balanca conectada

1. caixa seleciona ou bipa produto
2. sistema recebe peso via USB serial/HID
3. PDV calcula total por preco/kg
4. item entra na venda

## Possiveis customizacoes

- diferentes layouts de etiqueta por fabricante
- regra por prefixo de loja
- leitura de peso ou preco embedado
- data opcional
- integracao com impressora termica
- compatibilidade com Filizola, Toledo e layouts customizados
- comunicacao serial por porta COM
- leitura HID por vendorId/productId

## Fabricantes cobertos na estrutura atual

- `Toledo MGV`: exportacao `ITENSMGV.TXT`
- `Urano Integra`: exportacao `PRODUTOS.TXT`
- `EAN-13 balanca Brasil`: leitura por prefixo 2 com dado embedado por preco ou peso

## Historico

- `0.1.0`: estrutura inicial do modulo e contratos base
- `0.2.0`: parser EAN-13, resolucao de item de venda e exportadores Toledo/Urano
- `0.3.0`: contratos para leitor USB, balanca USB e app demo PDV