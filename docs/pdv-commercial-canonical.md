# PDV Nexus — fonte canônica e limites de implantação P2/P3

## Modelos de persistência (sem serviços pagos obrigatórios)

- **Windows 10+**: SQLite local. As tabelas `pdv_products`, `pdv_customers`, `pdv_sales`, `pdv_sale_items`, `pdv_cancelled_sales`, `pdv_inventory_movements`, `pdv_settings` são lidas para carregar o aplicativo. A cópia `pdv_store` permanece apenas por compatibilidade e é gravada **na mesma transação** das tabelas. A rotina de upgrade não apaga dados.
- **Windows 7/8 x86 (Electron antigo)**: arquivo `pdv-nexus-data.json` com escrita em arquivo temporário + renomeação e cópia `.bak`. Não alegar que esse runtime usa SQLite; o Node 16 não fornece `node:sqlite`. A leitura prioriza o arquivo único e falha explicitamente se o arquivo e o backup forem ilegíveis.
- **Frontend**: o React reflete o estado persistente. Não mantém saldo paralelo em banco externo, navegador ou D1. O módulo `commercialLedger` integra o único snapshot `extensions`, armazenado na tabela de configurações do SQLite ou no único arquivo JSON legado.

## Registros de negócio canônicos

| Fonte registrada | Efeito derivado |
|---|---|
| Fornecedor | Nome e documento referenciados pela compra |
| Compra em rascunho | Não modifica estoque nem gera conta exigível |
| Compra confirmada como recebida | Acrescenta movimento `PURCHASE:id:linha`, atualiza estoque e custo médio ponderado e passa a gerar valor a pagar |
| Baixa de compra | Saldo a pagar = total recebido − soma das baixas |
| Venda finalizada | Receita da venda e custo por item **capturado no momento da venda**, inclusive após futuras mudanças de custo |
| Venda com pagamento a prazo | Saldo a receber = parcela a prazo − soma de recebimentos vinculados à venda |
| Despesa | Lançamento individual com ID, data, valor e categoria |
| Relatório de lucratividade | Receita líquida da venda − custo histórico dos itens; não inventar lucro quando não há custo conhecido |

Limites 100/200 eliminados da persistência. Paginação de tela não afeta exportações nem a totalização. Registro já perdido por software antigo exige recuperação de backup, se disponível.

## Invariantes técnicos

1. Toda movimentação entra uma vez (ID único). Recebimento duplicado e baixa além do saldo são rejeitados.
2. Estoque vem de `catalogProducts` e movimento persistido na mesma gravação. Custos e saldos financeiros são **derivações**, não tabelas autônomas editáveis.
3. No Windows 10+, alteração das tabelas e do snapshot de compatibilidade forma **uma transação SQL** com rollback em falha.
4. Sync remoto requer token >=16 caracteres. `GET /pdv-store` retorna `revision`; `PUT /pdv-store` exige `expectedRevision`. Falha com HTTP 428 sem revisão e HTTP 409 no conflito, sem substituir silenciosamente compras/vendas de outro terminal.
5. Esse mecanismo oferece proteção contra perda de atualização, **não substitui um protocolo distribuído de comandos operacionais**; conflitos devem ser recarregados e revalidados antes da reaplicação por um cliente.
6. A atualização do instalador já vendido continua isolada; nenhuma release nova deve ocupar o canal legado `releases/latest`.

## Fiscal: preparação, não emissão

- Cadastro da empresa já define CNPJ; preparação fiscal no módulo usa **o mesmo CNPJ**, sem criar outro cadastro, e guarda apenas UF, IE e regime tributário. Estados inicialmente expostos: SP/PR/MG/RJ/SC/RS.
- O sistema **não** possui, nesta implementação, integração autorizada SEFAZ, assinatura de XML com certificado A1, distribuição de documento autorizado, certificado/CSC ou suporte homologado a contingência. Não gera NFC-e com validade fiscal, protocolo, XML assinado ou DANFE fiscal.
- O gate `buildFiscalReadiness` retorna `issuanceEnabled: false` até existir um adapter efetivo com credenciamento, certificado e homologação. Jamais converter cupom não fiscal em NFC-e por troca de rótulo.
- Os padrões exigem atualização contínua. Em 06/11/2026 o portal oficial listava NT 2025.002 v1.53 (RTC, 30/10/2026), NT 2026.008 v1.01 (30/10/2026), NT 2026.007 v1.11 (30/10/2026), e Pacote de Schemas 010g v1.03 (26/10/2026). Referência: https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY%3D e https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w%3D .
- NF-e e NFC-e para produção ainda exigem implementação de XML, assinatura, transporte e resposta oficial, regras fiscais por produto/UF, testes de homologação e autorização; o cliente deve fornecer seus dados fiscais e credenciais sem inseri-los no repositório.

## Testes

`cd windows-10 && npm ci && npm run test:pdv-payments && npm run test:pdv-upgrade && npm run typecheck`.

E2E captura as abas de compras, contas, lucratividade e preparação fiscal via Electron em `qa/flows/ui-review.json`. Não publicar nem mesclar antes de QA verde e aprovação.
