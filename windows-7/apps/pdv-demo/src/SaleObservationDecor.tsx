import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  getSaleObservation,
  installDesktopSaleObservationPrinting,
  reconcileSaleObservationsToStore,
  saveSaleObservationDraft
} from "./saleObservation";

type SaleContext = {
  saleNumber: string;
  customerId: string;
  customerName: string;
};

const EMPTY_CONTEXT: SaleContext = { saleNumber: "", customerId: "", customerName: "" };

function textOf(element: Element | null) {
  return element?.textContent?.trim() ?? "";
}

function currentSaleNumber(shell: Element) {
  for (const candidate of Array.from(shell.querySelectorAll("div"))) {
    const children = Array.from(candidate.children);
    const label = children.find((child) => child.tagName === "SPAN" && textOf(child) === "Venda");
    const value = children.find((child) => child.tagName === "STRONG");
    if (label && value) return textOf(value);
  }
  return "";
}

function resolveSaleContext(shell: Element): SaleContext {
  const saleNumber = currentSaleNumber(shell);
  const customerSelect = shell.querySelector("main > section > section > aside select") as HTMLSelectElement | null;
  const selectedOption = customerSelect?.selectedOptions?.[0];
  return {
    saleNumber,
    customerId: customerSelect?.value ?? "",
    customerName: selectedOption?.textContent?.trim() ?? ""
  };
}

function ensureAnchor(shell: Element) {
  const orderPanel = shell.querySelector("main > section > section > aside");
  if (!orderPanel) return null;

  const existing = orderPanel.querySelector('[data-sale-observation-anchor="true"]');
  if (existing) return existing;

  const anchor = document.createElement("div");
  anchor.dataset.saleObservationAnchor = "true";
  const customerSelect = orderPanel.querySelector("select");
  if (customerSelect?.nextSibling) orderPanel.insertBefore(anchor, customerSelect.nextSibling);
  else orderPanel.appendChild(anchor);
  return anchor;
}

function sameContext(left: SaleContext, right: SaleContext) {
  return left.saleNumber === right.saleNumber && left.customerId === right.customerId && left.customerName === right.customerName;
}

export function SaleObservationDecor() {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [context, setContext] = useState<SaleContext>(EMPTY_CONTEXT);
  const [note, setNote] = useState("");
  const [printOnReceipt, setPrintOnReceipt] = useState(false);

  const saleActive = Boolean(context.saleNumber && context.saleNumber !== "------");

  useEffect(() => {
    const apply = () => {
      const shell = document.querySelector('[data-shell="pdv-nexus"][data-view="caixa"]');
      if (!shell) {
        setPortalTarget(null);
        setContext((current) => sameContext(current, EMPTY_CONTEXT) ? current : EMPTY_CONTEXT);
        return;
      }

      const anchor = ensureAnchor(shell);
      setPortalTarget((current) => current === anchor ? current : anchor);
      const next = resolveSaleContext(shell);
      setContext((current) => sameContext(current, next) ? current : next);
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("change", apply, true);
    window.addEventListener("hashchange", apply);
    return () => {
      observer.disconnect();
      document.removeEventListener("change", apply, true);
      window.removeEventListener("hashchange", apply);
    };
  }, []);

  useEffect(() => {
    if (!saleActive) {
      setNote("");
      setPrintOnReceipt(false);
      return;
    }
    const saved = getSaleObservation(context.saleNumber);
    setNote(saved?.note ?? "");
    setPrintOnReceipt(Boolean(saved?.printOnReceipt));
  }, [context.saleNumber, saleActive]);

  useEffect(() => {
    const uninstallPrinting = installDesktopSaleObservationPrinting();
    void reconcileSaleObservationsToStore();
    const timer = window.setInterval(() => void reconcileSaleObservationsToStore(), 1500);
    return () => {
      window.clearInterval(timer);
      uninstallPrinting();
    };
  }, []);

  const persist = (nextNote: string, nextPrintOnReceipt: boolean) => {
    if (!saleActive) return;
    saveSaleObservationDraft({
      saleNumber: context.saleNumber,
      customerId: context.customerId,
      customerName: context.customerName,
      note: nextNote,
      printOnReceipt: nextPrintOnReceipt
    });
    void reconcileSaleObservationsToStore();
  };

  if (!portalTarget) return null;

  return createPortal(
    <section style={styles.panel} aria-label="Observação da venda">
      <div style={styles.header}>
        <div>
          <strong style={styles.title}>Observação da venda</strong>
          <span style={styles.subtitle}>Fica vinculada à venda e ao cliente selecionado.</span>
        </div>
        <span style={styles.counter}>{note.length}/500</span>
      </div>
      <textarea
        value={note}
        onChange={(event) => {
          const value = event.target.value.slice(0, 500);
          setNote(value);
          persist(value, printOnReceipt);
        }}
        maxLength={500}
        rows={3}
        disabled={!saleActive}
        placeholder={saleActive ? "Ex.: separar 2 caixas; cliente retira amanhã às 10h." : "Inicie uma venda para adicionar observação."}
        style={styles.textarea}
      />
      <label style={{ ...styles.checkRow, opacity: saleActive ? 1 : 0.55 }}>
        <input
          type="checkbox"
          checked={printOnReceipt}
          disabled={!saleActive}
          onChange={(event) => {
            const checked = event.target.checked;
            setPrintOnReceipt(checked);
            persist(note, checked);
          }}
        />
        <span>Imprimir esta observação no cupom não fiscal</span>
      </label>
      <div style={styles.hint}>
        {printOnReceipt && note.trim()
          ? "A observação será registrada e também impressa."
          : "A observação fica somente no registro interno da venda."}
      </div>
    </section>,
    portalTarget
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    display: "grid",
    gap: 8,
    padding: "10px 12px",
    margin: "8px 0",
    border: "1px solid rgba(148, 163, 184, 0.28)",
    borderRadius: 10,
    background: "rgba(15, 23, 42, 0.32)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start"
  },
  title: { display: "block", fontSize: 13 },
  subtitle: { display: "block", marginTop: 2, fontSize: 11, opacity: 0.72 },
  counter: { fontSize: 10, opacity: 0.65, whiteSpace: "nowrap" },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 68,
    padding: "9px 10px",
    borderRadius: 8,
    border: "1px solid rgba(148, 163, 184, 0.34)",
    background: "rgba(2, 6, 23, 0.38)",
    color: "inherit",
    font: "inherit",
    fontSize: 12,
    lineHeight: 1.4
  },
  checkRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 12,
    cursor: "pointer"
  },
  hint: { fontSize: 10, opacity: 0.68 }
};
