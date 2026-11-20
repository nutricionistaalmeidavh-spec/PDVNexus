# PDV Nexus — P0 e P1 Multiloja

## Escopo e compatibilidade
- **P0:** proteção de gravação multi-caixa com `expectedRevision` obrigatório, mensagens para HTTP 409, backup pré-recebimento e bloqueio de importação/recebimento em lojas com dados locais não reconciliados.
- **P1:** empresa e filiais locais, seleção de unidade, cadastro/renomeação/desativação, operadores autorizados por filial e armazenamento comercial independente por `store_key`.
- Edições Windows 10+ (SQLite) e Windows 7/8 (JSON legado) utilizam a **mesma chave antiga da matriz**, `nexus-core:pdv-store:v1`, para não afetar instalações existentes. Filiais novas usam chaves novas.
- O registro de empresa e filiais permanece local ao computador (`localStorage`) no P1. O serviço central P2 utiliza provisionamento explícito com tokens por filial/terminal, não sincroniza esse cadastro automaticamente. Não copiar snapshots para transportar o registro de filiais.
- **P2/P3 na mesma PR:** serviço PostgreSQL opcional em `services/pdv-sync-server`, API de eventos incrementais, tokens por filial/terminal, UI de conexão e sincronização automática somente quando seguro. Transferências entre filiais e relatórios consolidados completos continuam para P4/P5.
- **Não habilitar release ou migração automatizada** até homologar as três arquiteturas e o fluxo completo de dados em máquinas reais.

## Fluxo administrativo
1. Abrir **Administração > Empresa e filiais**, autenticar-se como gerente.
2. Informar o nome da nova unidade e selecionar **Cadastrar filial**. O sistema faz um backup do banco atual, grava um snapshot novo/vazio e registra o cadastro somente após a criação ser confirmada.
3. Definir os operadores permitidos na filial. A matriz permanece no banco legado.
4. Para trocar de filial, não pode existir venda aberta, caixa aberto, sincronização servidora ativa ou gravações pendentes. A aplicação recarrega a chave canônica selecionada.
5. A filial pode ser renomeada/desativada sem excluir vendas e estoques. O cadastro é local ao PC; no futuro a autorização será centralizada no servidor.

## Contrato de proteção de dados
- Matrícula da filial não altera banco ou rotas do usuário legado; as novas filiais não herdam o estoque da matriz.
- Armazenamentos auxiliares (observações, lote, etiquetas, escaneamento, importação, relatórios) seguem a chave da filial ativa.
- Snapshots das filiais contêm `extensions.branchId` e `extensions.companyId`; restauração de backup de filial diferente deve ser recusada. Backups legados sem ID só podem ser restaurados na matriz.
- Sincronização HTTP exige token de pelo menos 16 caracteres no servidor, `expectedRevision` e comparação atômica de revisão. O cliente precisa receber a revisão antes de enviar. Conflitos bloqueiam a gravação; nenhum merge automático é presumido.
- Recebimento de um snapshot sobre operações comerciais locais existentes é bloqueado até conciliação. A sincronização operacional incremental por comandos é **P3**; a operação multi-caixa concorrente não está homologada para produção neste marco.
- **P0/P1 são preliminares**: validar permissões de usuários, recuperação de cadastro de filiais e upgrade end-to-end antes da publicação.

## Gates de qualidade
- `cd windows-10 && npm ci && npm run typecheck && npm run test:pdv-payments && npm run test:pdv-upgrade && npm run build:pdv-demo`
- `cd windows-7 && npm ci && npm run typecheck && npm run test:pdv-payments && npm run test:pdv-upgrade && npm run build:pdv-demo` (conforme scripts disponíveis).
- Integração manual QA: criar uma filial com nome distinto, vender em matriz, trocar para filial, verificar ausência de vendas/estoques da matriz; bloquear troca com caixa aberto; backup cruzado; testar 409 e HTTP 428; atualizar de instalação antiga sem reconfiguração.

## P2/P3 — novos gates
- Executar `.github/workflows/qa-pdv-multiloja.yml` com PostgreSQL 17 real e testes de eventos do Windows 7/10.
- Conexão central ativada somente pelo usuário e em modo Caixa único; nunca usar simultaneamente o antigo protocolo de snapshots multi-caixa.
- P4 e P5 ainda pendentes: transferências com dupla confirmação, estoque remoto consolidado, dashboard da rede.
- P6 pendente: homologação em hardware real, roteiros completos offline/reconexão, instaladores e release controlada.
