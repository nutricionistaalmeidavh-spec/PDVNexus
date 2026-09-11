import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const CLIENT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const SELLER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4ZM6 20v-2.2a6 6 0 0 1 12 0V20" fill="currentColor"/></svg>`;

type CashierMetrics = {
  items: number;
  quantity: string;
  saleActive: boolean;
};

function ensureIcon(target: Element | null, kind: "client" | "seller") {
  if (!target) return;
  const selector = kind === "client" ? "[data-cashier-client-icon=\"true\"]" : "[data-cashier-seller-icon=\"true\"]";
  if (target.querySelector(selector)) return;

  const icon = document.createElement("span");
  icon.className = `cashier-reference-icon cashier-reference-icon--${kind}`;
  if (kind === "client") icon.dataset.cashierClientIcon = "true";
  else icon.dataset.cashierSellerIcon = "true";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = kind === "client" ? CLIENT_ICON : SELLER_ICON;
  target.prepend(icon);
}

function dispatchCashierShortcut(key: "Delete" | "F2") {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

export function CashierReferenceDecor() {
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [metrics, setMetrics] = useState<CashierMetrics>({ items: 0, quantity: "0,000", saleActive: false });

  useEffect(() => {
    const apply = () => {
      const shell = document.querySelector('[data-shell="pdv-nexus"][data-view="caixa"]');
      if (!shell) {
        setPortalTarget(null);
        return;
      }

      const grid = shell.querySelector("main > section > section");
      setPortalTarget((current) => current === grid ? current : grid);

      const clientCard = shell.querySelector("main > section > section > aside > div:nth-of-type(1)");
      const sellerCard = shell.querySelector("main > section > section > div:first-child > div:nth-child(1) > div:last-child > div:nth-child(2)");
      ensureIcon(clientCard, "client");
      ensureIcon(sellerCard, "seller");

      const itemArea = shell.querySelector("main > section > section > aside > div:nth-of-type(2)");
      const itemRows = itemArea ? Array.from(itemArea.children).filter((child) => Boolean(child.querySelector("div strong"))) : [];
      const quantityNode = shell.querySelector("main > section > section > div:first-child > div:nth-child(1) > div:last-child > div:last-child strong");
      const quantity = (quantityNode?.textContent?.trim() || "0.000").replace(".", ",");
      const itemAreaText = itemArea?.textContent || "";
      const saleActive = Boolean(itemArea) && !itemAreaText.includes("Pressione F2");
      const next = { items: itemRows.length, quantity, saleActive };

      setMetrics((current) => current.items === next.items && current.quantity === next.quantity && current.saleActive === next.saleActive ? current : next);
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
    window.addEventListener("hashchange", apply);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", apply);
    };
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <section className="cashier-reference-footer" data-cashier-footer="sale-actions" aria-label="Resumo e ações da venda">
      <div className="cashier-reference-metric">
        <span>Itens</span>
        <strong>{metrics.items}</strong>
      </div>
      <div className="cashier-reference-metric cashier-reference-metric--quantity">
        <span>Qtd. total</span>
        <strong>{metrics.quantity}</strong>
      </div>
      <div className="cashier-reference-footer-spacer" />
      <button
        type="button"
        className="cashier-reference-action cashier-reference-action--cancel"
        onClick={() => dispatchCashierShortcut("Delete")}
        disabled={metrics.items === 0}
      >
        Cancelar item
      </button>
      <button
        type="button"
        className="cashier-reference-action cashier-reference-action--clear"
        onClick={() => dispatchCashierShortcut("F2")}
        disabled={!metrics.saleActive}
      >
        Limpar venda
      </button>
    </section>,
    portalTarget
  );
}
