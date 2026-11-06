# Auditoria inicial: crítica de usabilidade PDV Nexus (06/11/2026)

**Escopo e método:** leitura do código, contratos de negócio e roteiros do ArtiSys QA. O fluxo automatizado disponível captura Caixa, Produtos, Clientes, Financeiro, Administração, Balança e Configurações em Windows. **Esta nota não se apresenta como teste observacional com compradores iniciantes nem como inspeção visual independente das capturas.**

## Achados comprovados no código antes da correção
- **P0 — perda silenciosa de histórico:** a finalização guardava somente 100 vendas e havia limites de retenção de 200 movimentos de estoque, 100 cancelamentos/TEF, 50 fechamentos de caixa e 200 auditorias. Uma loja pode superar esses números rapidamente. A branch retira a poda automática dos estados canônicos.
- **P1 — aprendibilidade:** fluxo do caixa contém comandos F2 (nova venda), F6 (pagamento à vista) e F8 (finalizar). Os controles existem, mas o usuário novo precisa compreender a sequência de abrir caixa, iniciar venda, adicionar produtos e concluir.
- **P1 — sensação de limite no catálogo:** o código do caixa aplica filtros de categoria, busca, ativação e vendibilidade. Não foi encontrada restrição de 5 cadastros. A distinção entre catálogo completo e vitrine filtrada merece texto contextual visível.
- **P1 — dispersão operacional:** estoque e cadastro estão em Produtos; relatórios, caixa e financeiro compartilham outras seções; uma tarefa completa exige alternar rotas. QA verifica que elas abrem, mas não mede facilidade de descoberta.
- **P2 — automação de QA:** 25 jornadas E2E mais UI review, checkout demo e rastreio físico cobrem navegação e funções com dados preparados. Não substituem teste com usuários leigos nem validação de ambiente instalado e dados reais.

## Melhoria recomendada na sequência
1. **P0** preservar todas as vendas e movimentações; ampliar testes com 120+ vendas e regressões; avaliar desempenho da persistência SQLite/JSON com bases grandes antes da publicação.
2. **P1** guia opcional de primeiro uso com tarefas simples: cadastrar produto → abrir caixa → iniciar venda → adicionar item → receber → consultar relatório.
3. **P1** botões com legenda textual para principais teclas, feedback de ações e ajuda contextual em estado vazio do caixa/produtos. Mostrar filtro ativo e contagem total vs visível.
4. **P1** distinguir recursos demonstrativos, opcionais e restrições verdadeiras no anúncio e no próprio software.
5. **P2** QA guiado com 5 pessoas sem conhecimento prévio, medindo tarefas concluídas sem ajuda, cliques, erros e tempo; evidência com captura de tela, logs e fluxos.
6. **P2** paginação e consultas indexadas do histórico local para evitar que grande volume de vendas degrade a UI; nenhum corte destrutivo para performance.

A avaliação do comprador é um relato subjetivo de confusão e limitação, não evidência de má-fé. As limitações objetivas acima devem ser corrigidas independentemente da motivação do comentário.
