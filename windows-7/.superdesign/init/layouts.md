# Layouts

## `packages/ui/src/index.tsx` - `AppShell`

The shared layout is a desktop-first two-column application shell with a sticky dark sidebar, compact text/icon navigation, collapsible width, and a plain content region with a title header. It is used by `meu-engenheiro`, `nexus-crm`, and `pdv-demo`.

```tsx
import type { NavItem } from "@nexus-core/core";
import React, { useState, type CSSProperties, type PropsWithChildren } from "react";

export function AppShell(props: PropsWithChildren<{ title: string; nav: NavItem[]; collapsible?: boolean }>) {
  const { title, nav, children, collapsible = true } = props;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ ...styles.page, gridTemplateColumns: collapsed ? "76px minmax(0, 1fr)" : "240px minmax(0, 1fr)" }}>
      <aside style={{ ...styles.sidebar, paddingInline: collapsed ? "10px" : "16px" }}>
        <div style={styles.sidebarHeader}>
          <div style={{ ...styles.brand, ...(collapsed ? styles.visuallyHidden : {}) }}>Nexus Core</div>
          {collapsible ? <button type="button" onClick={() => setCollapsed((current) => !current)} style={styles.collapseButton} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>{collapsed ? ">" : "<"}</button> : null}
        </div>
        <nav style={styles.nav}>
          {nav.map((item) => (
            <a key={item.key} href={`#${item.path}`} style={{ ...styles.navItem, justifyContent: collapsed ? "center" : "flex-start" }} title={collapsed ? item.label : undefined}>
              <span>{item.icon ?? "•"}</span>
              {collapsed ? null : <span>{item.label}</span>}
            </a>
          ))}
        </nav>
      </aside>
      <main style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.title}>{title}</h1>
        </header>
        <section>{children}</section>
      </main>
    </div>
  );
}
```

## `apps/dashboard-demo/src/DashboardDemoApp.tsx` - Dashboard Page Shell

The dashboard demo has its own CSS-driven shell instead of using `AppShell`: a 232px sidebar, topbar, filters, KPI grid, chart grid, and optional data table.

```tsx
export function DashboardDemoApp() {
  const [active, setActive] = useState<DashboardKey>("pdv");
  const dashboard = dashboards[active];

  return (
    <main className={`dashboard-page dashboard-page--${active}`}>
      <aside className="sidebar">
        <div className="brand">Nexus Dashboards</div>
        <button className={active === "pdv" ? "nav active" : "nav"} onClick={() => setActive("pdv")}>PDV</button>
        <button className={active === "academic" ? "nav active" : "nav"} onClick={() => setActive("academic")}>Sr. Engenheiro</button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{dashboard.recommendedStyle}</p>
            <h1>{dashboard.name}</h1>
            <p className="subtitle">{dashboard.description}</p>
          </div>
          <div className="actions">
            {dashboard.quickActions.map((action) => (
              <button key={action.key} className={`action action--${action.intent}`}>{action.label}</button>
            ))}
          </div>
        </header>

        <div className="filters">
          {dashboard.filters.map((filter) => (
            <label key={filter.key} className="filter">
              <span>{filter.label}</span>
              <input value={Array.isArray(filter.value) ? filter.value.join(", ") : filter.value ?? ""} readOnly />
            </label>
          ))}
        </div>

        <KpiGrid kpis={dashboard.kpis} />
        <ChartGrid dashboard={dashboard} />
        {dashboard.table ? <DataTable dashboard={dashboard} /> : null}
      </section>
    </main>
  );
}
```
