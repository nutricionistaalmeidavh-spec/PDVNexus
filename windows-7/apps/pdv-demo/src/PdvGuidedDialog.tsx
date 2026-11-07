import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

/** Diálogo acessível e reutilizável. Sem serviço remoto nem dependências externas. */
type Props = {
  title: string;
  description: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  tone?: "default" | "danger";
  busy?: boolean;
  step?: string;
};

const overlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 5000,
  background: "rgba(10, 20, 38, .68)", display: "grid", placeItems: "center",
  padding: 16, boxSizing: "border-box"
};
const panel: CSSProperties = {
  width: "min(580px, 100%)", maxHeight: "min(90vh, 820px)",
  overflowY: "auto", background: "#fff", color: "#0f172a",
  borderRadius: 18, padding: "22px", boxSizing: "border-box",
  display: "grid", gap: 15, boxShadow: "0 24px 80px rgba(0, 0, 0, .32)"
};

export const guidedFieldStyle: CSSProperties = {
  minWidth: 0, width: "100%", boxSizing: "border-box", padding: "11px 12px",
  border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, background: "#fff"
};

export const guidedPrimaryStyle: CSSProperties = {
  minHeight: 42, padding: "10px 17px", border: 0, borderRadius: 9,
  background: "#1d4ed8", color: "#fff", fontWeight: 700, cursor: "pointer"
};

export const guidedSecondaryStyle: CSSProperties = {
  ...guidedPrimaryStyle, border: "1px solid #cbd5e1",
  color: "#334155", background: "#fff"
};

export function PdvGuidedDialog({ title, description, children, actions, onClose, tone = "default", busy = false, step }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = dialogRef.current?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])");
    (first ?? dialogRef.current)?.focus();
    return () => previousFocus?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); return; }
    if (event.key !== "Tab") return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    ) ?? []).filter((element) => element.getAttribute("aria-hidden") !== "true");
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <div style={overlay} data-pdv-guided-dialog="true">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
      aria-describedby={descriptionId} tabIndex={-1} onKeyDown={handleKeyDown} style={panel}>
      <header style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
        <div>
          {step ? <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, color: "#64748b" }}>{step}</p> : null}
          <h2 id={titleId} style={{ margin: 0, fontSize: 21, color: tone === "danger" ? "#991b1b" : "#0f172a" }}>{title}</h2>
        </div>
        <button type="button" aria-label="Fechar janela" onClick={onClose} disabled={busy}
          style={{ ...guidedSecondaryStyle, padding: "4px 12px", minHeight: 34 }}>Fechar</button>
      </header>
      <p id={descriptionId} style={{ margin: 0, color: "#475569", lineHeight: 1.55, fontSize: 14 }}>{description}</p>
      <div style={{ display: "grid", gap: 13 }}>{children}</div>
      <footer style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>{actions}</footer>
    </section>
  </div>;
}
