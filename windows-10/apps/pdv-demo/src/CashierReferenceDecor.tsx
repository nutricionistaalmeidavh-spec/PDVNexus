import { useEffect } from "react";

const CLIENT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const SELLER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4ZM6 20v-2.2a6 6 0 0 1 12 0V20" fill="currentColor"/></svg>`;

function ensureIcon(target: Element | null, kind: "client" | "seller") {
  if (!target) return;
  const dataName = kind === "client" ? "cashierClientIcon" : "cashierSellerIcon";
  if (target.querySelector(`[data-${kind === "client" ? "cashier-client-icon" : "cashier-seller-icon"}="true"]`)) return;

  const icon = document.createElement("span");
  icon.className = `cashier-reference-icon cashier-reference-icon--${kind}`;
  icon.dataset[dataName] = "true";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = kind === "client" ? CLIENT_ICON : SELLER_ICON;
  target.prepend(icon);
}

export function CashierReferenceDecor() {
  useEffect(() => {
    const apply = () => {
      const shell = document.querySelector('[data-shell="pdv-nexus"][data-view="caixa"]');
      if (!shell) return;

      const clientCard = shell.querySelector("main > section > section > aside > div:nth-of-type(1)");
      const sellerCard = shell.querySelector("main > section > section > div:first-child > div:nth-child(1) > div:last-child > div:nth-child(2)");
      ensureIcon(clientCard, "client");
      ensureIcon(sellerCard, "seller");
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", apply);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", apply);
    };
  }, []);

  return null;
}
