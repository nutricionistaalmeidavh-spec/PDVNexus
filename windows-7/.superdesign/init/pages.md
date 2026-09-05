# Pages

## Meu Engenheiro - Disciplinas

Entry: `apps/meu-engenheiro/src/MeuEngenheiroApp.tsx`

Dependencies:
- `apps/meu-engenheiro/src/MeuEngenheiroApp.tsx`
  - `packages/ui/src/index.tsx`
  - `apps/meu-engenheiro/src/app-definition.ts`
    - `packages/core/src/index.ts`
    - `packages/modules/ai/src/index.ts`
    - `packages/modules/crm/src/index.ts`
    - `packages/modules/documentos/src/index.ts`
  - `apps/meu-engenheiro/src/lib/useHashRoute.ts`
  - `apps/meu-engenheiro/src/pages/DisciplinasPage.tsx`
    - `packages/database/src/index.ts`
    - `packages/ui/src/index.tsx`

Actual route branch: `route === "/disciplinas"`.

## Meu Engenheiro - Dr. Engenheiro

Entry: `apps/meu-engenheiro/src/MeuEngenheiroApp.tsx`

Dependencies:
- `apps/meu-engenheiro/src/MeuEngenheiroApp.tsx`
  - `packages/ui/src/index.tsx`
  - `apps/meu-engenheiro/src/app-definition.ts`
  - `apps/meu-engenheiro/src/lib/useHashRoute.ts`
  - `apps/meu-engenheiro/src/pages/DrEngenheiroPage.tsx`
    - `packages/database/src/index.ts`
    - `packages/ui/src/index.tsx`
    - `apps/meu-engenheiro/src/lib/ai.ts`

Actual route branch: `route === "/dr-engenheiro"`.

## Meu Engenheiro - Artefatos

Entry: `apps/meu-engenheiro/src/MeuEngenheiroApp.tsx`

Dependencies:
- `apps/meu-engenheiro/src/MeuEngenheiroApp.tsx`
  - `packages/ui/src/index.tsx`
  - `apps/meu-engenheiro/src/app-definition.ts`
  - `apps/meu-engenheiro/src/lib/useHashRoute.ts`
  - `apps/meu-engenheiro/src/pages/ArtefatosPage.tsx`
    - `packages/database/src/index.ts`
    - `packages/ui/src/index.tsx`

Actual route branch: `route === "/artefatos"`.

## Dashboard Demo

Entry: `apps/dashboard-demo/src/DashboardDemoApp.tsx`

Dependencies:
- `apps/dashboard-demo/src/DashboardDemoApp.tsx`
  - `packages/modules/dashboard/src/index.ts`
- `apps/dashboard-demo/src/styles.css`

Actual render branch: `active === "pdv"` initially, with switchable `academic` branch through local state.

## Nexus CRM

Entry: `apps/nexus-crm/src/NexusCrmApp.tsx`

Dependencies:
- `apps/nexus-crm/src/NexusCrmApp.tsx`
  - `packages/ui/src/index.tsx`
  - `apps/nexus-crm/src/app-definition.ts`
    - `packages/core/src/index.ts`
    - `packages/modules/ai/src/index.ts`
    - `packages/modules/crm/src/index.ts`

Actual render branch: static single page inside `AppShell`.

## PDV Demo - Caixa

Entry: `apps/pdv-demo/src/PdvDemoApp.tsx`

Dependencies:
- `apps/pdv-demo/src/PdvDemoApp.tsx`
  - `packages/ui/src/index.tsx`
  - `apps/meu-engenheiro/src/lib/useHashRoute.ts`
  - `packages/database/src/index.ts`
  - `packages/desktop-runtime/src/index.ts`
  - `packages/modules/balanca/src/index.ts`

Actual route branch: default route `route === "/caixa"`. The file is large; for design context use line ranges around the render block and the `styles` object, not the full file.
