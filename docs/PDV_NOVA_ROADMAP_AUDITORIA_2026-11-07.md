# PDV Nexus Nova — auditoria de conclusão do roadmap
Data: 2026-11-07

## Estado confirmado na main

- PR #21 integrada em 2026-11-07: código canônico SQLite, atualização isolada dos clientes legados, dados de vendas preservados sem cortes de 100/200, custos, margem, compras, fornecedores e financeiro.
- PR #27 integrada em 2026-11-07, merge `40acaa4c6cb275722d9c5c350b49f27960b8696f`: conciliação da #20 (marca, empreendimento e exclusão gerencial reversível de vendas de treinamento); contagem separada de dinheiro/PIX/crédito/débito; atalhos seguros; contato do cliente; navegação separada de Vendas, Financeiro, Fechamento e Administração; PIN de autorização gerencial no fechamento.
- No último commit da PR #27: os cinco gates passaram (Windows 7, Windows 8 x86, Windows 10, QA visual Electron e QA comercial).
- PR #31 integrada em 2026-11-07, merge `e11d89be8962d0bdc9d0f8cafaf6495b14cc62ec`: teste SQLite real de volume, com três gravações controladas pela revisão, histórico e integridade verificados; checks de Build Windows 10, QA visual e QA comercial verdes.
- PRs de integração redundantes #24 e #26 encerradas sem merge para evitar duplicações; PR #22 alternativa de versão de instalador encerrada, sem modificar canal legado.

## Medidas do benchmark do SQLite (GitHub Actions Windows)

Amostra sintética: 2.000 vendas, 2.000 itens, 2.500 movimentações de estoque, um produto, três ciclos atômicos de leitura/gravação e revisão.

| Medida | Resultado |
| --- | ---: |
| Gravação, mediana | 55,26 ms |
| Gravação, maior tempo | 55,32 ms |
| Leitura/parse do snapshot, mediana | 5,83 ms |
| Leitura/parse do snapshot, maior tempo | 9,71 ms |
| Vendas e movimentos preservados | 100% |
| Revisões canônicas | 3 de 3 |

Evidência: [GitHub Actions, QA comercial da PR #31](https://github.com/nutricionistaalmeidavh-spec/PDVNexus/actions/runs/42389713550). Marcador no log: `PDV_SQLITE_VOLUME_BENCHMARK`.

**Interpretação:** o SQLite não apresentou gargalo grave nesta carga sintética. O valor não é tempo total de resposta da interface, e não certifica máquinas de clientes, grandes históricos (>2.000 vendas) nem multi-terminal simultâneo.

## O que não declarar concluído sem evidências adicionais

1. **QA exploratório Ollama**: PR #23 original (8/10 personas no último relatório consolidado) está substituída por tentativas de integração adaptadas à main, PRs #29 e #30, ainda sujeitas aos próprios checks de 10 jornadas. Só aceitar 10/10 se o relatório de GitHub Actions confirmar (sem forçar PASS).
2. **Medição ponta-a-ponta em hardware real:** fazer cronômetro de clique, persistência, renderização e emissão do comprovante no computador cliente; benchmark isolado do SQLite não abrange isso.
3. **Emissão fiscal e multi-caixa transacional:** não declarar homologado/autorizado sem endpoints e testes reais. Fora do escopo desta rodada de UX.
4. **Atualizador dos clientes antigos:** canal `releases/latest` permanece bloqueado pela edição Nova. Não habilitar publicação automática ou sobrescrever instalações legadas.

## Critérios de release

- Núcleo gratuito R$ 0; funcionamento offline; open source; serviços pagos apenas opcionais explícitos.
- Sem alteração de secrets, sem publicação automática, sem migração destrutiva de vendas, estoque, clientes ou configurações.
- O merge das correções não equivale à distribuição automática de novos instaladores.
