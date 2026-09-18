# Política de CI e QA — PDVNexus

Este repositório é público. Enquanto permanecer público e os workflows usarem runners padrão hospedados pelo GitHub (`windows-latest`, `ubuntu-latest` ou `macos-latest`), a política do projeto é:

1. Não restringir CI/QA por preocupação com a cota mensal de minutos de repositórios privados.
2. Executar typecheck, testes, build e QA/Playwright em pushes relevantes e pull requests.
3. Manter `workflow_dispatch` para validações manuais.
4. Usar cache de dependências sempre que suportado.
5. Usar `concurrency` com `cancel-in-progress` para eliminar runs superseded.
6. Otimizar armazenamento, não minutos:
   - instaladores: artifacts por 7 dias e apenas no `main` ou execução manual;
   - evidências de QA: artifacts por 3 dias;
   - distribuição permanente continua fora do GitHub Actions.
7. Manter `timeout-minutes` para evitar jobs presos.
8. Se o repositório se tornar privado, reavaliar esta política antes de continuar com execução ampla de CI.

## Cobertura atual

- Windows 10: typecheck, testes e build do instalador.
- Windows 7: typecheck, testes e build do instalador.
- Windows 8 x86: typecheck, testes, bundle e build do instalador.
- QA Windows 10: ArtiSys QA, captura de UI, Playwright/E2E e demo de checkout.
