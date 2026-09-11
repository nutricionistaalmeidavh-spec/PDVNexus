import type { NavItem } from "@nexus-core/core";
import React, { useState, type CSSProperties, type PropsWithChildren } from "react";

type AppShellProps = PropsWithChildren<{
  title: string;
  nav: NavItem[];
  collapsible?: boolean;
  sidebarPosition?: "left" | "right";
  sidebarTitle?: string;
  hideTitle?: boolean;
}>;

const PDV_LABELS: Record<string, string> = {
  caixa: "Caixa (PDV)",
  produtos: "Produtos",
  clientes: "Clientes",
  financeiro: "Financeiro",
  administracao: "Administração",
  balanca: "Balança",
  configuracoes: "Configurações"
};

export function AppShell(props: AppShellProps) {
  const { title, nav, children, collapsible = true, sidebarPosition = "left", sidebarTitle = "Nexus Core", hideTitle = false } = props;
  const [collapsed, setCollapsed] = useState(false);
  const isPdvShell = title.toLocaleLowerCase("pt-BR").includes("pdv");
  const shellNav: NavItem[] = isPdvShell && !nav.some((item) => item.path === "/configuracoes")
    ? [...nav, { key: "configuracoes", label: "Configurações", path: "/configuracoes", icon: "CF" }]
    : nav;
  const activePath = typeof window === "undefined" ? shellNav[0]?.path : (window.location.hash.replace(/^#/, "") || shellNav[0]?.path);
  const activeItem = shellNav.find((item) => item.path === activePath) ?? shellNav[0];
  const effectiveSidebarPosition = isPdvShell ? "left" : sidebarPosition;
  const expandedWidth = isPdvShell ? 248 : 240;
  const collapsedWidth = isPdvShell ? 78 : 76;
  const cssVars = isPdvShell ? ({
    "--nexus-card-radius": "14px",
    "--nexus-card-shadow": "0 8px 28px rgba(15, 35, 62, 0.07)",
    "--nexus-card-border": "1px solid #dbe5f1",
    "--nexus-card-title-size": "18px"
  } as CSSProperties) : undefined;

  const pageStyle: CSSProperties = {
    ...styles.page,
    ...(isPdvShell ? styles.pdvPage : null),
    ...cssVars,
    gridTemplateColumns: effectiveSidebarPosition === "right"
      ? `minmax(0, 1fr) ${collapsed ? `${collapsedWidth}px` : `${expandedWidth}px`}`
      : `${collapsed ? `${collapsedWidth}px` : `${expandedWidth}px`} minmax(0, 1fr)`
  };

  return (
    <div style={pageStyle} data-shell={isPdvShell ? "pdv-nexus" : "nexus-core"}>
      <aside
        style={{
          ...styles.sidebar,
          ...(isPdvShell ? styles.pdvSidebar : null),
          order: effectiveSidebarPosition === "right" ? 2 : 1,
          paddingInline: collapsed ? "10px" : isPdvShell ? "14px" : "16px"
        }}
      >
        {isPdvShell ? (
          <div style={styles.pdvBrandRow}>
            <div style={styles.pdvBrandMark}>N</div>
            {collapsed ? null : (
              <div style={styles.pdvBrandCopy}>
                <strong style={styles.pdvBrandTitle}>PDV Nexus</strong>
                <span style={styles.pdvBrandSubtitle}>Gestão comercial</span>
              </div>
            )}
            {collapsible ? (
              <button
                type="button"
                onClick={() => setCollapsed((current) => !current)}
                style={{ ...styles.collapseButton, ...styles.pdvCollapseButton, marginLeft: collapsed ? "auto" : undefined }}
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                title={collapsed ? "Expandir menu" : "Recolher menu"}
              >
                {collapsed ? ">" : "<"}
              </button>
            ) : null}
          </div>
        ) : (
          <div style={styles.sidebarHeader}>
            <div style={{ ...styles.brand, ...(collapsed ? styles.visuallyHidden : {}) }}>{sidebarTitle}</div>
            {collapsible ? <button type="button" onClick={() => setCollapsed((current) => !current)} style={styles.collapseButton} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={collapsed ? "Expandir menu" : "Recolher menu"}>{collapsed ? ">" : "<"}</button> : null}
          </div>
        )}

        {isPdvShell && !collapsed ? <div style={styles.pdvNavSectionLabel}>NAVEGAÇÃO</div> : null}
        <nav style={{ ...styles.nav, ...(isPdvShell ? styles.pdvNav : null) }}>
          {shellNav.map((item) => {
            const active = item.path === activePath;
            const label = isPdvShell ? (PDV_LABELS[String(item.key)] ?? item.label) : item.label;
            return (
              <a
                key={item.key}
                href={`#${item.path}`}
                aria-current={active ? "page" : undefined}
                style={{
                  ...styles.navItem,
                  ...(isPdvShell ? styles.pdvNavItem : null),
                  ...(isPdvShell && active ? styles.pdvNavItemActive : null),
                  justifyContent: collapsed ? "center" : "flex-start"
                }}
                title={collapsed ? label : undefined}
              >
                <span style={isPdvShell ? { ...styles.pdvNavIcon, ...(active ? styles.pdvNavIconActive : null) } : undefined}>{item.icon ?? "•"}</span>
                {collapsed ? null : <span style={isPdvShell ? styles.pdvNavLabel : undefined}>{label}</span>}
              </a>
            );
          })}
        </nav>

        {isPdvShell ? (
          <div style={{ ...styles.pdvSidebarFooter, ...(collapsed ? styles.pdvSidebarFooterCollapsed : null) }}>
            <span style={styles.pdvStatusDot} />
            {collapsed ? null : <div><strong>Operação local</strong><span>Windows 10</span></div>}
          </div>
        ) : null}
      </aside>

      <main style={{ ...styles.main, ...(isPdvShell ? styles.pdvMain : null), order: effectiveSidebarPosition === "right" ? 1 : 2 }}>
        {isPdvShell ? (
          <header style={styles.pdvTopbar}>
            <div>
              <p style={styles.pdvTopbarEyebrow}>PDV NEXUS / OPERAÇÃO LOCAL</p>
              <h1 style={styles.pdvTopbarTitle}>{activeItem ? (PDV_LABELS[String(activeItem.key)] ?? activeItem.label) : "PDV"}</h1>
            </div>
            <div style={styles.pdvTopbarActions}>
              <span style={styles.pdvLocalBadge}><span style={styles.pdvStatusDot} /> Local</span>
              <span style={styles.pdvUserBadge}>Administrador</span>
            </div>
          </header>
        ) : hideTitle ? null : (
          <header style={styles.header}><h1 style={styles.title}>{title}</h1></header>
        )}
        <section>{children}</section>
      </main>
    </div>
  );
}

export function SectionCard(props: PropsWithChildren<{ title: string; subtitle?: string; hidden?: boolean; wide?: boolean; collapsible?: boolean; defaultOpen?: boolean }>) {
  if (props.hidden) return null;
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  const collapsible = props.collapsible ?? true;
  return (
    <article style={{ ...styles.card, gridColumn: props.wide ? "1 / -1" : undefined }}>
      <div style={styles.cardHeader}>
        <div><h2 style={styles.cardTitle}>{props.title}</h2>{props.subtitle ? <p style={styles.cardSubtitle}>{props.subtitle}</p> : null}</div>
        {collapsible ? <button type="button" onClick={() => setOpen((current) => !current)} style={styles.cardToggle} aria-expanded={open}>{open ? "Recolher" : "Expandir"}</button> : null}
      </div>
      {open ? <div>{props.children}</div> : null}
    </article>
  );
}

export function Pill(props: PropsWithChildren) {
  return <span style={styles.pill}>{props.children}</span>;
}

export function TextInput(props: { value: string; placeholder?: string; onChange?: (value: string) => void }) {
  return (
    <input
      value={props.value}
      placeholder={props.placeholder}
      onChange={(event) => props.onChange?.(event.target.value)}
      style={styles.input}
    />
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    minHeight: "100vh",
    backgroundColor: "#f5f7fb",
    color: "#0f172a",
    fontFamily: "Segoe UI, Inter, system-ui, sans-serif"
  },
  pdvPage: {
    backgroundColor: "#eef3f9",
    color: "#10213a"
  },
  sidebar: {
    position: "sticky",
    top: 0,
    height: "100vh",
    boxSizing: "border-box",
    overflowY: "auto",
    backgroundColor: "#111827",
    color: "#ffffff",
    paddingBlock: "18px"
  },
  pdvSidebar: {
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(180deg, #071426 0%, #0b1b32 55%, #0d2340 100%)",
    borderRight: "1px solid rgba(148, 163, 184, 0.14)",
    boxShadow: "8px 0 30px rgba(15, 35, 62, 0.08)",
    paddingBlock: "16px"
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: "40px",
    gap: "8px",
    marginBottom: "18px"
  },
  brand: {
    fontSize: "20px",
    fontWeight: 700,
    whiteSpace: "nowrap"
  },
  pdvBrandRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "48px",
    padding: "0 4px 14px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.14)",
    marginBottom: "16px"
  },
  pdvBrandMark: {
    width: "38px",
    minWidth: "38px",
    height: "38px",
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    background: "linear-gradient(145deg, #2563eb, #0ea5e9)",
    boxShadow: "0 8px 22px rgba(37, 99, 235, 0.28)",
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: 900
  },
  pdvBrandCopy: {
    minWidth: 0,
    display: "grid",
    gap: "2px",
    flex: 1
  },
  pdvBrandTitle: {
    color: "#ffffff",
    fontSize: "16px",
    lineHeight: 1.1,
    whiteSpace: "nowrap"
  },
  pdvBrandSubtitle: {
    color: "#8fa6c2",
    fontSize: "11px",
    whiteSpace: "nowrap"
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clipPath: "inset(50%)"
  },
  collapseButton: {
    width: "38px",
    minWidth: "38px",
    height: "38px",
    border: "1px solid #475569",
    borderRadius: "10px",
    backgroundColor: "#1f2937",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: 1
  },
  pdvCollapseButton: {
    width: "30px",
    minWidth: "30px",
    height: "30px",
    borderRadius: "8px",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#afc2d9",
    fontSize: "15px"
  },
  pdvNavSectionLabel: {
    margin: "2px 10px 8px",
    color: "#607b9a",
    fontSize: "9px",
    fontWeight: 800,
    letterSpacing: "0.16em"
  },
  nav: {
    display: "grid",
    gap: "8px"
  },
  pdvNav: {
    gap: "5px"
  },
  navItem: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    color: "#e5e7eb",
    textDecoration: "none",
    padding: "10px 12px",
    borderRadius: "12px",
    backgroundColor: "#1f2937",
    minHeight: "44px",
    boxSizing: "border-box"
  },
  pdvNavItem: {
    minHeight: "44px",
    padding: "7px 9px",
    borderRadius: "10px",
    background: "transparent",
    color: "#adc0d6",
    border: "1px solid transparent"
  },
  pdvNavItemActive: {
    color: "#ffffff",
    background: "linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)",
    border: "1px solid rgba(96, 165, 250, 0.34)",
    boxShadow: "0 8px 20px rgba(29, 78, 216, 0.22)"
  },
  pdvNavIcon: {
    width: "29px",
    minWidth: "29px",
    height: "29px",
    display: "grid",
    placeItems: "center",
    borderRadius: "8px",
    background: "rgba(148, 163, 184, 0.08)",
    color: "#8fa6c2",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "0.04em"
  },
  pdvNavIconActive: {
    background: "rgba(255, 255, 255, 0.14)",
    color: "#ffffff"
  },
  pdvNavLabel: {
    fontSize: "13px",
    fontWeight: 650,
    whiteSpace: "nowrap"
  },
  pdvSidebarFooter: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    marginTop: "auto",
    padding: "14px 10px 2px",
    borderTop: "1px solid rgba(148, 163, 184, 0.14)",
    color: "#9bb0c8",
    fontSize: "10px"
  },
  pdvSidebarFooterCollapsed: {
    justifyContent: "center",
    paddingInline: 0
  },
  pdvStatusDot: {
    width: "7px",
    minWidth: "7px",
    height: "7px",
    borderRadius: "999px",
    background: "#22c55e",
    boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.12)"
  },
  main: {
    minWidth: 0,
    padding: "24px"
  },
  pdvMain: {
    minWidth: 0,
    padding: "0 24px 28px",
    background: "linear-gradient(180deg, #f7f9fc 0%, #eef3f9 100%)"
  },
  header: {
    marginBottom: "24px"
  },
  title: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1.1
  },
  pdvTopbar: {
    minHeight: "78px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
    margin: "0 -24px 20px",
    padding: "0 28px",
    background: "rgba(255, 255, 255, 0.94)",
    borderBottom: "1px solid #dbe5f1",
    boxShadow: "0 4px 18px rgba(15, 35, 62, 0.04)"
  },
  pdvTopbarEyebrow: {
    margin: "0 0 4px",
    color: "#71869f",
    fontSize: "9px",
    fontWeight: 800,
    letterSpacing: "0.14em"
  },
  pdvTopbarTitle: {
    margin: 0,
    color: "#10213a",
    fontSize: "22px",
    lineHeight: 1.1,
    fontWeight: 750
  },
  pdvTopbarActions: {
    display: "flex",
    alignItems: "center",
    gap: "9px"
  },
  pdvLocalBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    minHeight: "30px",
    padding: "0 11px",
    borderRadius: "999px",
    border: "1px solid #d8e3ef",
    background: "#f7fafc",
    color: "#526a84",
    fontSize: "11px",
    fontWeight: 650
  },
  pdvUserBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "30px",
    padding: "0 12px",
    borderRadius: "9px",
    background: "#0b1b32",
    color: "#e7eef7",
    fontSize: "11px",
    fontWeight: 650
  },
  card: {
    backgroundColor: "#ffffff",
    border: "var(--nexus-card-border, 0)",
    borderRadius: "var(--nexus-card-radius, 20px)",
    padding: "20px",
    boxShadow: "var(--nexus-card-shadow, 0 10px 30px rgba(15, 23, 42, 0.08))",
    marginBottom: "16px"
  },
  cardTitle: {
    margin: 0,
    color: "#10213a",
    fontSize: "var(--nexus-card-title-size, 20px)"
  },
  cardSubtitle: {
    margin: "7px 0 0",
    color: "#60758d",
    fontSize: "12px"
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "16px" },
  cardToggle: { border: "1px solid #d4deea", borderRadius: "9px", background: "#f8fafc", color: "#334a63", padding: "7px 11px", cursor: "pointer", whiteSpace: "nowrap", fontSize: "11px", fontWeight: 650 },
  pill: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "#e2e8f0",
    color: "#334155",
    fontSize: "12px",
    marginRight: "8px",
    marginBottom: "8px"
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    outline: "none",
    fontSize: "15px",
    boxSizing: "border-box"
  }
};
