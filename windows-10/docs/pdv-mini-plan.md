# Mini Planilha do PDV

| Ordem | Frente | Status | Prioridade | Proximo entregavel | Concluido quando | Observacao |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Regras de fechamento da venda | Concluido | Alta | Centralizar validacoes e baixa de estoque | Venda valida estoque, pagamento, credito e registra resultado | Base criada em `@nexus-core/database` |
| 2 | Persistencia local versionada | Concluido | Alta | Snapshot unico com migracao dos dados antigos | App carrega/salva por uma chave versionada e migra chaves antigas | Base criada com `nexus-core:pdv-store:v1` |
| 3 | Backup e restauracao | Concluido | Alta | Exportar/importar dados do PDV em JSON | Usuario consegue salvar e restaurar snapshot local | Logica reutilizavel em `@nexus-core/database` |
| 4 | UI do caixa | Concluido | Alta | Tela de venda mais operacional e rapida | Caixa fica otimizado para leitor, teclado, itens e total visivel | Primeira UI operacional entregue no app PDV |
| 5 | Tela de pagamento | Concluido | Alta | Fluxo dedicado para dinheiro, PIX, credito, debito e prazo | Pagamento valida falta, troco, limite e multiplas formas | Modulo reutilizavel criado em `@nexus-core/database` e consumido pelo PDV |
| 6 | Estoque completo | Concluido | Alta | Entrada, ajuste, inventario e alerta de minimo | Estoque tem movimentacao, historico e alerta | Modulo reutilizavel e UI de movimentos entregues |
| 7 | Fechamento de caixa | Concluido | Alta | Resumo por forma de pagamento, sangria e conferencia | Caixa fecha com conferencia e divergencia visivel | Conferencia por forma e historico de fechamento entregues |
| 8 | Impressao de cupom | Concluido parcial | Media | Cupom nao fiscal 58/80mm | Venda finalizada gera impressao/reimpressao | Integracao desktop configurada; teste fisico segue bloqueado |
| 9 | Relatorios e dashboard | Concluido | Media | Vendas por periodo, forma de pagamento e estoque baixo | Gestor ve movimento, indicadores e exportacao CSV | Dashboard 30 dias, historico filtravel e CSV entregues no Financeiro |
| 10 | Login e operador | Concluido | Media | Usuario, permissao e senha de gerente | Acoes sensiveis registram operador/autorizacao | Cadastro/edicao de usuarios, operador ativo e auditoria MVP entregues |
| 10.1 | Cancelamento e estorno | Concluido | Alta | Cancelar venda, devolver estoque e registrar motivo | Venda cancelada sai das vendas ativas, estoque/credito sao estornados e auditoria registra autorizacao | Requer senha de gerente no MVP |
| 11 | SQLite via Electron | Concluido | Alta | Persistencia em banco local real | Dados saem do storage do navegador para banco local | Bridge SQLite, status de migracao e botao de sincronizacao entregues |
| 12 | Cadastro de formas de pagamento | Concluido | Media | Criar, editar, ativar/desativar formas | Caixa usa apenas formas ativas e financeiro guarda taxas | CRUD local entregue com regra reutilizavel em `@nexus-core/database` |
| 13 | Multi-caixa | Concluido MVP | Media | Identidade do caixa e sincronizacao por servidor local HTTP | Venda registra terminal e snapshot pode ser enviado/baixado em rede local | Servidor desktop com SQLite e token opcional entregue; sincronizacao transacional em tempo real fica para evolucao |
| 14 | Captura manual cartao/PIX | Concluido | Alta | Registrar cartao/PIX sem TEF automatico | Caixa cobra na maquininha/QR externo e confirma a venda como recebida | TEF real ficou fora do primeiro lancamento por decisao do usuario |
| 14.1 | TEF maquininha | Adiado | Media | Integrar SDK/API de provedor escolhido | PDV envia payload card-present e grava autorizacao/NSU retornado | Depende de provedor, SDK, credenciais e homologacao |
| 15 | Polimento UI | Concluido parcial | Media | Melhorar telas administrativas e atalhos | Financeiro/configuracoes concentram paineis e caixa tem F2/F3/F6/F8 | Nova UI do caixa entregue; ajustes finos ainda podem evoluir |
| 15.1 | Backup automatico | Concluido | Alta | Backup ao finalizar venda e backup manual | Snapshot tem retencao local e arquivos no desktop Electron | Retencao configuravel entregue |
| 15.2 | Configuracoes gerais | Concluido | Media | Dados da loja, login, backup, captura manual e atalhos | Gestor altera preferencias em uma aba propria | Aba Configuracoes entregue |
| 16 | Instalador Windows | Adiado | Media | Pacote instalavel do PDV | Instalador abre app com nome, icone e pasta de dados | Usuario decidiu deixar para quando terminar tudo |
| 17 | Impressao fisica | Adiado | Baixa | Testar impressora 58/80mm real | Cupom sai na impressora fisica | Fora desta leva por decisao do usuario |
| 18 | Notas fiscais | Adiado | Alta | NFC-e/SAT/contingencia | Emissao fiscal homologada | Fora desta leva por decisao do usuario |
| 19 | Empacotamento e assinatura | Adiado | Media | Build assinado | Instalador sem alerta de fornecedor desconhecido | Fora desta leva por decisao do usuario |
| 20 | Teste fisico | Bloqueado | Baixa | Validar leitor, balanca e impressora reais | Hardware real validado | Seguiremos sem hardware por enquanto |

## Regra de acompanhamento

- Sempre terminar uma frente com `typecheck` e build do app afetado.
- Evitar misturar UI, banco e impressao na mesma etapa.
- Manter regras e capacidades reutilizaveis em `packages/*` ou `packages/modules/*`; apps devem apenas compor os modulos.
- Atualizar esta planilha ao concluir ou mudar a prioridade de uma frente.
- Registrar layouts reutilizaveis em `docs/pdv-layout-presets.md` antes de substituir a UI principal.
