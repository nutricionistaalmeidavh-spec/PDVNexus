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
  caixa: "Caixa",
  produtos: "Produtos",
  clientes: "Clientes",
  financeiro: "Financeiro",
  administracao: "Administração",
  balanca: "Balança",
  configuracoes: "Configurações"
};

const PDV_CASHIER_CSS = `
[data-shell="pdv-nexus"][data-view="caixa"] main {
  padding: 14px 16px 18px !important;
  background: #f4f7fb !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) 292px !important;
  gap: 12px !important;
  align-items: start !important;
  max-width: none !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child,
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside {
  display: contents !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) {
  order: 1;
  grid-column: 1 / -1;
  display: grid !important;
  grid-template-columns: 1fr 2fr !important;
  min-height: 72px !important;
  padding: 0 !important;
  border: 1px solid #d9e0e8 !important;
  border-radius: 8px !important;
  background: #ffffff !important;
  box-shadow: 0 2px 7px rgba(15, 38, 68, 0.05) !important;
  overflow: hidden;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:first-child {
  display: grid;
  align-content: center;
  padding: 12px 20px;
  border-right: 1px solid #e4e9ef;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:first-child::before {
  content: "Status do caixa";
  color: #445064;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 4px;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:first-child > h2,
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:first-child > p:last-child {
  display: none !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:first-child > p:first-child {
  margin: 0 !important;
  color: #16864b !important;
  font-size: 12px !important;
  font-weight: 800 !important;
  letter-spacing: 0 !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:last-child {
  display: grid !important;
  grid-template-columns: 1fr 1.15fr !important;
  align-items: stretch !important;
  gap: 0 !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:last-child > div {
  display: grid !important;
  align-content: center !important;
  gap: 4px !important;
  padding: 10px 22px !important;
  border: 0 !important;
  border-left: 1px solid #e4e9ef !important;
  background: #ffffff !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:last-child > div:last-child {
  display: none !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:last-child span {
  color: #536174 !important;
  font-size: 10px !important;
  font-weight: 700 !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(1) > div:last-child strong {
  color: #12213a !important;
  font-size: 14px !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(2) {
  order: 2;
  grid-column: 1;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto auto auto !important;
  gap: 7px !important;
  padding: 32px 12px 12px !important;
  position: relative;
  border: 1px solid #d9e0e8 !important;
  border-radius: 8px !important;
  background: #ffffff !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(2)::before {
  content: "BIPAR / DIGITAR CÓDIGO DO PRODUTO";
  position: absolute;
  top: 10px;
  left: 12px;
  color: #27364b;
  font-size: 10px;
  font-weight: 800;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(2) input {
  min-height: 46px !important;
  border: 2px solid #164c95 !important;
  border-radius: 7px !important;
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.04) !important;
  font-size: 14px !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(2) button {
  min-height: 46px !important;
  border-radius: 7px !important;
  font-size: 10px !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-last-child(2) {
  order: 9;
  grid-column: 1;
  position: relative;
  padding-top: 28px !important;
  margin-top: 2px;
  border: 1px solid #d9e0e8 !important;
  border-bottom: 0 !important;
  border-radius: 8px 8px 0 0 !important;
  background: #ffffff !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-last-child(2)::before {
  content: "PRODUTOS RÁPIDOS";
  position: absolute;
  top: 9px;
  left: 12px;
  color: #526174;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .08em;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:last-child {
  order: 10;
  grid-column: 1;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  border: 1px solid #d9e0e8 !important;
  border-top: 0 !important;
  border-radius: 0 0 8px 8px !important;
  background: #ffffff !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:last-child > button {
  border-radius: 6px !important;
  box-shadow: none !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(1) {
  order: 3;
  grid-column: 1;
  width: calc(50% - 5px);
  min-height: 76px;
  box-sizing: border-box;
  padding: 12px 14px !important;
  border: 1px solid #d9e0e8;
  border-radius: 8px;
  background: #ffffff;
  align-self: stretch;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(1)::before {
  content: "CLIENTE";
  display: block;
  margin-bottom: 4px;
  color: #526174;
  font-size: 9px;
  font-weight: 800;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > select {
  order: 4;
  grid-column: 1;
  width: calc(50% - 5px) !important;
  justify-self: end;
  margin-top: -88px;
  min-height: 76px !important;
  padding: 26px 12px 10px !important;
  border: 1px solid #d9e0e8 !important;
  border-radius: 8px !important;
  background: #ffffff !important;
  color: #14243d !important;
  font-size: 11px !important;
  font-weight: 700 !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(2) {
  order: 5;
  grid-column: 1;
  min-height: 260px !important;
  max-height: 310px !important;
  padding: 39px 0 0 !important;
  position: relative;
  border: 1px solid #d9e0e8;
  border-radius: 8px;
  background: #ffffff !important;
  overflow: auto !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(2)::before {
  content: "Produto                                      Qtd.        Valor unitário          Total";
  position: absolute;
  inset: 0 0 auto 0;
  min-height: 36px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  box-sizing: border-box;
  background: #062d57;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  white-space: pre;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(2) > div {
  margin: 0 14px !important;
  padding: 9px 0 !important;
  border-radius: 0 !important;
  border-bottom: 1px solid #e4e9ef !important;
  background: transparent !important;
  font-size: 11px !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(3) {
  order: 6;
  grid-column: 1;
  display: grid !important;
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
  gap: 0 !important;
  padding: 0 !important;
  border: 1px solid #d9e0e8 !important;
  border-radius: 8px !important;
  overflow: hidden;
  background: #ffffff !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(3) > div {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-right: 1px solid #e4e9ef;
  font-size: 10px;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(4) {
  order: 2;
  grid-column: 2;
  min-height: 112px;
  display: grid !important;
  align-content: center;
  padding: 38px 18px 14px !important;
  position: relative;
  border: 0 !important;
  border-radius: 8px 8px 0 0 !important;
  background: #062d57 !important;
  color: #ffffff !important;
  font-size: 38px !important;
  font-weight: 900 !important;
  text-align: right !important;
  box-sizing: border-box;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(4)::before {
  content: "TOTAL DA VENDA";
  position: absolute;
  top: 13px;
  left: 16px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(5) {
  order: 3;
  grid-column: 2;
  display: grid !important;
  grid-template-columns: 1fr !important;
  gap: 7px !important;
  padding: 34px 12px 12px !important;
  position: relative;
  border: 1px solid #d9e0e8;
  border-top: 0;
  background: #ffffff;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(5)::before {
  content: "FORMAS DE PAGAMENTO";
  position: absolute;
  top: 11px;
  left: 12px;
  color: #2d3d52;
  font-size: 9px;
  font-weight: 800;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(5) > button {
  min-height: 34px !important;
  justify-content: flex-start;
  border-radius: 6px !important;
  border: 1px solid #dce2e9 !important;
  background: #ffffff !important;
  color: #1f3048 !important;
  font-size: 10px !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(5) > button:first-child {
  background: #0f4ea3 !important;
  border-color: #0f4ea3 !important;
  color: #ffffff !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-of-type(6) {
  order: 4;
  grid-column: 2;
  margin-top: -12px;
  border-radius: 0 !important;
  border: 1px solid #d9e0e8 !important;
  border-top: 0 !important;
  background: #f8fafc !important;
  color: #5c6d81 !important;
  font-size: 8px !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-last-of-type(2) {
  order: 5;
  grid-column: 2;
  padding: 10px 12px !important;
  border: 1px solid #d9e0e8;
  border-top: 0;
  background: #ffffff;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-last-of-type(2) > div {
  padding: 9px !important;
  border-radius: 6px !important;
  font-size: 10px !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-last-of-type(2) + button {
  order: 6;
  grid-column: 2;
  min-height: 36px !important;
  margin-top: -12px;
  border-radius: 0 !important;
  border: 1px solid #d9e0e8 !important;
  background: #ffffff !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:nth-last-of-type(2) + button + label {
  order: 7;
  grid-column: 2;
  margin-top: -12px;
  padding: 9px 12px;
  border: 1px solid #d9e0e8;
  border-top: 0;
  background: #ffffff;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:last-of-type {
  order: 8;
  grid-column: 2;
  grid-template-columns: 1fr 1fr !important;
  gap: 7px !important;
  padding: 34px 12px 12px !important;
  position: relative;
  margin-top: -12px;
  border: 1px solid #d9e0e8;
  border-top: 0;
  border-radius: 0 0 8px 8px;
  background: #ffffff;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:last-of-type::before {
  content: "ATALHOS";
  position: absolute;
  top: 11px;
  left: 12px;
  color: #2d3d52;
  font-size: 9px;
  font-weight: 800;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:last-of-type > button {
  min-height: 62px !important;
  border-radius: 7px !important;
  background: #0f4ea3 !important;
  color: #ffffff !important;
  font-size: 11px !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:last-of-type > button:nth-child(4),
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > div:last-of-type > button:nth-child(5) {
  background: #ff5a45 !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > aside > button:last-child {
  order: 7;
  grid-column: 1;
  width: 220px;
  justify-self: end;
  min-height: 40px !important;
  border: 1px solid #efb4ad !important;
  border-radius: 7px !important;
  background: #fffafa !important;
  color: #c34c41 !important;
  font-size: 10px !important;
}
[data-shell="pdv-nexus"][data-view="caixa"] main > section > section > div:first-child > div:nth-child(3):not(:nth-last-child(2)) {
  order: 4;
  grid-column: 1;
}
@media (max-width: 980px) {
  [data-shell="pdv-nexus"][data-view="caixa"] main > section > section {
    grid-template-columns: 1fr !important;
  }
  [data-shell="pdv-nexus"][data-view="caixa"] main > section > section > * {
    grid-column: 1 !important;
  }
}
`;

export function AppShell(props: AppShellProps) {
  const { title, nav, children, collapsible = true, sidebarPosition = "left", sidebarTitle = "Nexus Core", hideTitle = false } = props;
  const [collapsed, setCollapsed] = useState(false);
  const isPdvShell = title.toLocaleLowerCase("pt-BR").includes("pdv");
  const shellNav: NavItem[] = isPdvShell && !nav.some((item) => item.path === "/configuracoes")
    ? [...nav, { key: "configuracoes", label: "Configurações", path: "/configuracoes", icon: "CF" }]
    : nav;
  const activePath = typeof window === "undefined" ? shellNav[0]?.path : (window.location.hash.replace(/^#/, "") || shellNav[0]?.path);
  const activeItem = shellNav.find((item) => item.path === activePath) ?? shellNav[0];
  const activeKey = String(activeItem?.key ?? "");
  const effectiveSidebarPosition = isPdvShell ? "left" : sidebarPosition;
  const expandedWidth = isPdvShell ? 196 : 240;
  const collapsedWidth = isPdvShell ? 68 : 76;
  const cssVars = isPdvShell ? ({
    "--nexus-card-radius": "10px",
    "--nexus-card-shadow": "0 4px 16px rgba(15, 35, 62, 0.06)",
    "--nexus-card-border": "1px solid #dbe5f1",
    "--nexus-card-title-size": "17px"
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
    <div
      style={pageStyle}
      data-shell={isPdvShell ? "pdv-nexus" : "nexus-core"}
      data-view={isPdvShell ? activeKey : undefined}
      data-cashier-layout={isPdvShell && activePath === "/caixa" ? "reference-v1" : undefined}
    >
      {isPdvShell ? <style>{PDV_CASHIER_CSS}</style> : null}
      <aside
        style={{
          ...styles.sidebar,
          ...(isPdvShell ? styles.pdvSidebar : null),
          order: effectiveSidebarPosition === "right" ? 2 : 1,
          paddingInline: collapsed ? "9px" : isPdvShell ? "12px" : "16px"
        }}
      >
        {isPdvShell ? (
          <div style={styles.pdvBrandRow}>
            <div style={styles.pdvBrandMark}>▦</div>
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
        {isPdvShell && !(hideTitle && activePath === "/caixa") ? (
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
        ) : !isPdvShell && !hideTitle ? (
          <header style={styles.header}><h1 style={styles.title}>{title}</h1></header>
        ) : null}
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
    background: "#052a50",
    borderRight: "1px solid rgba(148, 163, 184, 0.14)",
    boxShadow: "5px 0 20px rgba(15, 35, 62, 0.08)",
    paddingBlock: "14px"
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
    gap: "8px",
    minHeight: "54px",
    padding: "0 3px 13px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.11)",
    marginBottom: "14px"
  },
  pdvBrandMark: {
    width: "34px",
    minWidth: "34px",
    height: "34px",
    display: "grid",
    placeItems: "center",
    borderRadius: "7px",
    background: "transparent",
    color: "#ffffff",
    fontSize: "23px",
    fontWeight: 900
  },
  pdvBrandCopy: {
    minWidth: 0,
    display: "grid",
    gap: "1px",
    flex: 1
  },
  pdvBrandTitle: {
    color: "#ffffff",
    fontSize: "17px",
    lineHeight: 1.05,
    whiteSpace: "nowrap"
  },
  pdvBrandSubtitle: {
    color: "#93abc5",
    fontSize: "9px",
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
    width: "25px",
    minWidth: "25px",
    height: "25px",
    borderRadius: "6px",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#b9cade",
    fontSize: "13px"
  },
  pdvNavSectionLabel: {
    margin: "2px 8px 8px",
    color: "#6e8ba8",
    fontSize: "8px",
    fontWeight: 800,
    letterSpacing: "0.15em"
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
    minHeight: "43px",
    padding: "7px 8px",
    borderRadius: "7px",
    background: "transparent",
    color: "#d0dbea",
    border: "1px solid transparent"
  },
  pdvNavItemActive: {
    color: "#ffffff",
    background: "#104c98",
    border: "1px solid #1c60b6",
    boxShadow: "0 5px 14px rgba(0, 0, 0, 0.14)"
  },
  pdvNavIcon: {
    width: "27px",
    minWidth: "27px",
    height: "27px",
    display: "grid",
    placeItems: "center",
    borderRadius: "6px",
    background: "rgba(255, 255, 255, 0.05)",
    color: "#c3d3e4",
    fontSize: "8px",
    fontWeight: 900,
    letterSpacing: "0.03em"
  },
  pdvNavIconActive: {
    background: "rgba(255, 255, 255, 0.12)",
    color: "#ffffff"
  },
  pdvNavLabel: {
    fontSize: "12px",
    fontWeight: 650,
    whiteSpace: "nowrap"
  },
  pdvSidebarFooter: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    marginTop: "auto",
    padding: "13px 8px 1px",
    borderTop: "1px solid rgba(255, 255, 255, 0.11)",
    color: "#a5bad0",
    fontSize: "9px"
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
    background: "#20ad64",
    boxShadow: "0 0 0 3px rgba(32, 173, 100, 0.12)"
  },
  main: {
    minWidth: 0,
    padding: "24px"
  },
  pdvMain: {
    minWidth: 0,
    padding: "0 22px 26px",
    background: "#f4f7fb"
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
    minHeight: "72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
    margin: "0 -22px 18px",
    padding: "0 24px",
    background: "#ffffff",
    borderBottom: "1px solid #dbe2ea",
    boxShadow: "0 3px 12px rgba(15, 35, 62, 0.04)"
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
    fontSize: "21px",
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
    minHeight: "29px",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid #d8e3ef",
    background: "#f7fafc",
    color: "#526a84",
    fontSize: "10px",
    fontWeight: 650
  },
  pdvUserBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "29px",
    padding: "0 11px",
    borderRadius: "7px",
    background: "#0b315a",
    color: "#edf4fb",
    fontSize: "10px",
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
