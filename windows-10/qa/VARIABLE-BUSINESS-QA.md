# QA de sequências comerciais variáveis — PDV Nexus

A suite roda quatro jornadas sobre o Electron real em runner Windows, cada uma com sua própria base SQLite efêmera, mantendo **um único estado dentro de toda a jornada**. Nenhum reset ocorre entre as operações.

Alterna a ordem de entrada de estoque e venda (antes/depois), usa teclado em dinheiro ou mouse em PIX, varia quantidade, cancela com autorização gerencial, confere relatórios e fecha o caixa. O mesmo cenário verifica valores canônicos antes e depois de recarregar a tela, em cada etapa. As sementes garantem reprodutibilidade.

O relatório contém número de assertivas, status por operação, falhas, screenshots e traces Playwright. São testes de negócios com resultado verificado, não contagem de cliques ou personas buscando cumprir 14 passos.

Executar em `windows-10`:
```powershell
npm ci
npm ci --prefix tools/artisys-qa
node --test tests/pdv-qa-variable-business.test.mjs
npm run build:pdv-demo
node qa/run-variable-business-journeys.mjs --output qa-variable-artifacts
```

Núcleo R$ 0, sem API paga, sem usar dados reais, sem instalação do cliente e sem alterar mecanismo de atualização. Workflow: `QA - PDV Jornadas Variaveis (Caixa, Estoque, Vendas)`.

Limites: quatro cenários não provam todas as combinações, e o GitHub Actions deve demonstrar aprovação real antes de considerar a cobertura concluída. A PR permanece sem merge.
