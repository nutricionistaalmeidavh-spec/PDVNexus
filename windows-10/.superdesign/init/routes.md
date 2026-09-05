# Routes

Framework: React 19 + Vite. Routing is app-local and mostly hash based, not file based.

## Apps

| App | Entry | Route model | Main screen |
| --- | --- | --- | --- |
| `apps/meu-engenheiro` | `apps/meu-engenheiro/src/main.tsx` | `useHashRoute`, default `#/disciplinas` | `MeuEngenheiroApp` |
| `apps/pdv-demo` | `apps/pdv-demo/src/main.tsx` | `useHashRoute`, default `#/caixa` | `PdvDemoApp` |
| `apps/nexus-crm` | `apps/nexus-crm/src/main.tsx` | static single app shell | `NexusCrmApp` |
| `apps/dashboard-demo` | `apps/dashboard-demo/src/main.tsx` | internal state tabs: `pdv` and `academic` | `DashboardDemoApp` |

## `apps/meu-engenheiro/src/MeuEngenheiroApp.tsx`

Routes:
- `#/disciplinas` -> `apps/meu-engenheiro/src/pages/DisciplinasPage.tsx`
- `#/dr-engenheiro` -> `apps/meu-engenheiro/src/pages/DrEngenheiroPage.tsx`
- `#/artefatos` -> `apps/meu-engenheiro/src/pages/ArtefatosPage.tsx`
- fallback -> inline `HomePage`

Router/render config:

```tsx
export function MeuEngenheiroApp() {
  const route = useHashRoute("/disciplinas");

  return (
    <AppShell title="Meu Engenheiro" nav={meuEngenheiroAppDefinition.navigation}>
      {route === "/disciplinas" ? <DisciplinasPage /> : null}
      {route === "/dr-engenheiro" ? <DrEngenheiroPage /> : null}
      {route === "/artefatos" ? <ArtefatosPage /> : null}
      {!["/disciplinas", "/dr-engenheiro", "/artefatos"].includes(route) ? <HomePage /> : null}
    </AppShell>
  );
}
```

## `apps/pdv-demo/src/PdvDemoApp.tsx`

Routes:
- `#/caixa` -> point-of-sale checkout route
- `#/produtos` -> products/catalog management route
- `#/clientes` -> customer management route
- `#/financeiro` -> sales, cash, payments, reports route
- `#/administracao` -> users, terminal, TEF, backup route
- `#/balanca` -> scale/barcode integration route

Navigation config:

```tsx
const nav = [
  { key: "caixa", label: "Caixa Rapido", path: "/caixa", icon: "CX" },
  { key: "produtos", label: "Produtos", path: "/produtos", icon: "PR" },
  { key: "clientes", label: "Clientes", path: "/clientes", icon: "CL" },
  { key: "financeiro", label: "Financeiro", path: "/financeiro", icon: "FX" },
  { key: "administracao", label: "Administracao", path: "/administracao", icon: "AD" },
  { key: "balanca", label: "Balanca", path: "/balanca", icon: "KG" }
];
```

## `apps/dashboard-demo/src/DashboardDemoApp.tsx`

Internal views:
- `pdv` -> dark professional operational dashboard for POS metrics
- `academic` -> light academic dashboard for study progress

No URL routing. State is controlled by two sidebar buttons.
