# Fluxo PDV + Balanca

## Objetivo

Conectar o modulo de balanca ao PDV para que produtos pesados entrem na venda por leitura de codigo ou por peso vindo da balanca.

## Leitor de codigo de barras USB

O primeiro suporte planejado e o modo `keyboard-wedge`, que e o modo mais comum em leitores USB de PDV.

Nesse modo:

- o leitor se comporta como teclado
- o caixa deixa o foco no campo de leitura
- ao bipar, o codigo entra como texto
- o leitor normalmente envia `Enter` ao final
- o PDV processa o codigo automaticamente

No modulo isso esta representado por:

- `BarcodeScannerProfile`
- `keyboardWedgeScannerProfile`
- `resolvePosInputFromBarcode`

## Balanca USB conectada ao PDV

Para balanca conectada diretamente ao sistema, o modulo ja separa o contrato em tres tipos:

- `serial`: porta COM/USB serial, muito comum em balancas comerciais
- `hid`: dispositivo USB HID
- `keyboard-wedge`: quando a balanca envia peso como texto, semelhante a teclado

No modulo isso esta representado por:

- `UsbScaleDeviceProfile`
- `genericUsbScaleProfile`
- `parseUsbScaleWeight`

## Fluxo operacional por etiqueta

1. cadastrar produto como item vendido por peso
2. exportar carga para Toledo ou Urano
3. pesar produto na balanca etiquetadora
4. emitir etiqueta contendo codigo, peso/preco e data
5. ler etiqueta no caixa com leitor USB
6. decodificar dados EAN-13
7. criar lancamento da venda no PDV

## Fluxo operacional por balanca conectada

1. selecionar ou bipar o produto no PDV
2. receber peso da balanca USB
3. calcular total usando preco/kg
4. inserir item na venda

## Dados minimos por etiqueta

- prefixo da balanca
- codigo do produto
- peso
- preco total ou preco/kg
- data opcional

## Como isso entra na software factory

O modulo `balanca` nao fica preso ao PDV. Ele pode ser reutilizado em:

- PDV de mercado
- acougue
- hortifruti
- conveniencia
- cozinha industrial
- distribuidora com fracionamento

## Demo criada

O app `apps/pdv-demo` demonstra:

- bipada de leitor USB modo teclado
- leitura simulada de balanca USB serial/HID
- criacao de item de venda
- totalizacao da venda
- exportacao Toledo `ITENSMGV.TXT`
- exportacao Urano `PRODUTOS.TXT`

## Proximos blocos tecnicos

1. bridge Electron para listar portas seriais
2. bridge Electron para WebHID/HID nativo
3. configuracao de porta por loja/caixa
4. persistencia dos produtos e perfis de balanca
5. impressao ou salvamento real dos arquivos TXT