import type { NavItem } from "@nexus-core/core";
import React, { useState, type CSSProperties, type PropsWithChildren } from "react";

export function AppShell(props: PropsWithChildren<{ title: string; nav: NavItem[]; collapsible?: boolean; sidebarPosition?: "left" | "right"; sidebarTitle?: string; hideTitle?: boolean }>) {
  const { title, nav, children, collapsible = true, sidebarPosition = "left", sidebarTitle = "Nexus Core", hideTitle = false } = props;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ ...styles.page, gridTemplateColumns: sidebarPosition === "right" ? `minmax(0, 1fr) ${collapsed ? "76px" : "240px"}` : `${collapsed ? "76px" : "240px"} minmax(0, 1fr)` }}>
      <aside style={{ ...styles.sidebar, order: sidebarPosition === "right" ? 2 : 1, paddingInline: collapsed ? "10px" : "16px" }}>
        <div style={styles.sidebarHeader}>
          <div style={{ ...styles.brand, ...(collapsed ? styles.visuallyHidden : {}) }}>{sidebarTitle}</div>
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
      <main style={{ ...styles.main, order: sidebarPosition === "right" ? 1 : 2 }}>
        {hideTitle ? null : <header style={styles.header}><h1 style={styles.title}>{title}</h1></header>}
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
    fontFamily: "Segoe UI, sans-serif"
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
  nav: {
    display: "grid",
    gap: "8px"
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
  main: {
    minWidth: 0,
    padding: "24px"
  },
  header: {
    marginBottom: "24px"
  },
  title: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1.1
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    marginBottom: "16px"
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px"
  },
  cardSubtitle: {
    margin: "8px 0 0",
    color: "#475569"
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "16px" },
  cardToggle: { border: "1px solid #cbd5e1", borderRadius: "10px", background: "#f8fafc", color: "#0f172a", padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap" },
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
