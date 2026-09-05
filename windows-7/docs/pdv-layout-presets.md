# Presets de layout do PDV

Este arquivo registra os layouts do caixa como modelos reutilizaveis para outros produtos da Software Factory.

## classic-operational-pdv-layout

Status: preservado como referencia.

Uso indicado:
- PDV mais administrativo, com blocos separados por `SectionCard`.
- Bom para sistemas de escritorio, estoque, assistencia tecnica, distribuidores e operacoes com mais formulario.

Estrutura:
- Cabecalho com status do caixa, numero da venda e acoes de nova venda/remover item.
- Campo grande de leitura/digitacao.
- Cards de cliente, vendedor e quantidade de itens.
- Tabela principal de itens da venda.
- Lateral com total, pagamentos, desconto e atalhos.

Modulos consumidos:
- venda
- pagamento
- estoque
- clientes
- recibo
- operador

## modern-touch-cashier-layout

Status: layout atual do primeiro lancamento.

Uso indicado:
- PDV visual, rapido e mais amigavel para touchscreen.
- Bom para lojas, mercados pequenos, lanchonetes, restaurantes, conveniencia e operacoes de balcão.

Estrutura:
- Banner superior com status do caixa, venda, operador e itens.
- Busca/bipe central com botao de adicionar.
- Categorias horizontais.
- Grid de produtos com cards grandes.
- Pedido lateral com cliente, itens, totais, formas de pagamento e atalhos grandes.
- Captura manual de PIX/cartao: operador cobra fora do sistema e confirma no PDV.

Atalhos:
- F2: nova venda
- F3: foco em produto/bipe
- F6: pagamento rapido
- F8: finalizar venda
- Delete: remover ultimo item

Modulos consumidos:
- venda
- pagamento manual
- estoque
- clientes
- recibo
- operador
- backup
