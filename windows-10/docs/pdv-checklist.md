# Checklist do PDV

## Concluido

- [x] Shell desktop Electron compartilhado
- [x] Navegacao real entre Caixa, Produtos, Clientes, Financeiro e Balanca
- [x] Catalogo inicial de produtos por unidade e por peso
- [x] Leitor USB em modo teclado para codigo de barras
- [x] Integracao serial/USB com balanca via bridge Electron
- [x] Perfis de codigo de balanca e exportacao Toledo/Urano
- [x] Caixa rapido com itens, desconto e duas formas de pagamento
- [x] Validacao de pagamento antes do fechamento
- [x] Persistencia local das vendas finalizadas
- [x] Financeiro inicial baseado nas vendas finalizadas

## Proximo bloco

- [x] Cadastro, edicao e exclusao persistente de produtos (base local)
- [x] Baixa de estoque por venda e bloqueio por saldo (alerta visual ainda pendente)
- [x] Cadastro, edicao e exclusao local de clientes com limite basico (parcelas e cobranca ainda pendentes)
- [x] Abertura/fechamento local de caixa, sangria basica e formas de pagamento com taxas (operador, suprimento e parcelas ainda pendentes)
- [ ] Impressao de cupom em impressora termica
- [ ] Relatorios e dashboard de vendas
- [ ] Teste real com leitor USB e balancas Toledo/Urano
- [ ] Empacotamento instalavel do PDV

## Arquitetura local para tres caixas

- [x] Modelo recomendado: um computador servidor na loja com banco central na rede local
- [ ] API local para os caixas consultarem produtos, estoque e clientes
- [ ] Identidade de cada caixa e operador
- [ ] Fila offline de vendas com sincronizacao posterior
- [ ] Baixa de estoque transacional para evitar venda acima do saldo

Cada caixa terá seu próprio leitor USB e, quando necessário, sua própria balança. O banco central ficará no computador servidor; os terminais acessam a API pela rede local. O servidor não precisa ficar exposto à internet.

## Criterio para sair do MVP

O PDV sera considerado pronto para uso pessoal quando conseguir cadastrar produtos, vender itens unitarios e pesados, ler o codigo pelo leitor USB, conversar com a balanca configurada, baixar estoque, fechar o caixa e reabrir o aplicativo mantendo os dados locais.







