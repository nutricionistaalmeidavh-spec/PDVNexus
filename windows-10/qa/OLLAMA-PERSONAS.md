# Clientes sintéticos locais — PDV Nexus (Ollama + GitHub Actions)

Este experimento testa a **interface Electron real**, não somente mocks de API. Utiliza GitHub-hosted Windows e um modelo Ollama local. Nenhuma API paga, SaaS ou segredo é necessário.

## Execução

- Workflow: **QA - Ollama Personas (Windows)**, acionado por push na branch de QA ou manualmente por \`workflow_dispatch\` após existir na branch padrão.
- Modelo padrão: \`qwen3:1.7b\`, CPU; opcional \`qwen3:0.6b\` para smoke mais rápido.
- 10 personas sequenciais, cada uma em pasta \`userData\` exclusiva, limpa depois de executar.
- Observação da tela por Playwright (controles visíveis), decisão via \`/api/chat\` do Ollama em \`127.0.0.1:11434\`, ação controlada por allowlist.
- Traces, capturas, decisões e \`report.md\`/\`summary.json\` em artefatos temporários do Actions.
- Metas verificadas no estado real de navegação/armazenamento, nunca na afirmação do modelo.
- Perfis de teste sem acesso a clientes reais, licenças de produção ou credenciais. Nenhuma mutação de código de produção. Bloqueio de requisições externas no contexto Playwright.

## Sem falsos positivos

Uma persona falha se o modelo retorna JSON inválido repetidamente, escolhe controle ausente, excede passos ou não alcança a meta. O relatório aponta a falha; aprovação de navegação não implica testes completos de venda, instalação, emissão fiscal ou 1.000 usuários simultâneos.

A IA é exploratória e probabilística. Os testes E2E determinísticos existentes continuam sendo o gate de regressão prioritário.

## Desenvolvimento local

\`\`\`powershell
cd windows-10
npm ci
npm ci --prefix tools/artisys-qa
node --test tests/pdv-qa-ollama-personas.test.mjs
npm run build:pdv-demo
# Em outro terminal: ollama serve; ollama pull qwen3:1.7b
node qa/run-ollama-personas.mjs --config qa/ollama-personas.config.json --output qa-ollama-artifacts --count 3
\`\`\`

Importante: o runner usa \`ollama-windows-amd64.zip\` oficial, sem serviço externo. Caso download, capacidade do runner ou inferência excedam limites, o job falha e preserva evidências. Não há fallback silencioso para nuvem paga.
