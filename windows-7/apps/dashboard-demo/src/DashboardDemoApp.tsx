import {
  buildAcademicDashboard,
  buildPdvDashboard,
  type DashboardChart,
  type DashboardDefinition,
  type DashboardKpi
} from "@nexus-core/module-dashboard";
import { useState } from "react";

const dashboards = {
  pdv: buildPdvDashboard({
    revenue: 8342.72,
    previousRevenue: 7120.43,
    salesCount: 186,
    averageTicket: 44.85,
    stockAlerts: 7,
    scaleSales: 48
  }),
  academic: buildAcademicDashboard({
    disciplines: 3,
    materials: 31,
    artifacts: 5,
    conversations: 2
  })
};

type DashboardKey = keyof typeof dashboards;

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

function KpiGrid({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <section className="kpi-grid">
      {kpis.map((kpi) => (
        <article key={kpi.key} className={`kpi kpi--${kpi.tone ?? "neutral"}`}>
          <span>{kpi.label}</span>
          <strong>{kpi.formattedValue}</strong>
          <small>{kpi.trend ? `${kpi.trend.direction === "up" ? "+" : kpi.trend.direction === "down" ? "-" : ""}${kpi.trend.label}` : "Atual"}</small>
        </article>
      ))}
    </section>
  );
}

function ChartGrid({ dashboard }: { dashboard: DashboardDefinition }) {
  return (
    <section className="chart-grid">
      {dashboard.charts.map((chart) => (
        <article key={chart.key} className="panel">
          <h2>{chart.title}</h2>
          <Chart chart={chart} />
        </article>
      ))}
      {dashboard.summary ? (
        <article className="panel summary">
          <h2>{dashboard.summary.title}</h2>
          {dashboard.summary.items.map((item) => (
            <div key={item.label} className="summary-row">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </article>
      ) : null}
    </section>
  );
}

function Chart({ chart }: { chart: DashboardChart }) {
  const max = Math.max(...chart.data.map((item) => item.value), 1);

  if (chart.type === "metric-list") {
    return (
      <div className="metric-list">
        {chart.data.map((item) => (
          <div key={item.label} className="metric-row">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bars">
      {chart.data.map((item) => (
        <div key={item.label} className="bar-item">
          <div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max((item.value / max) * 100, 6)}%` }} /></div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ dashboard }: { dashboard: DashboardDefinition }) {
  if (!dashboard.table) {
    return null;
  }

  return (
    <section className="panel table-panel">
      <h2>{dashboard.table.title}</h2>
      <table>
        <thead>
          <tr>{dashboard.table.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {dashboard.table.rows.map((row, index) => (
            <tr key={index}>{dashboard.table?.columns.map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}