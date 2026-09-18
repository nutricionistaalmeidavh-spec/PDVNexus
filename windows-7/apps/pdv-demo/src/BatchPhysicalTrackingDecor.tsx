import { useEffect, useState } from "react";
import {
  clearBatchPhysicalSale,
  countReservedPhysicalScans,
  markBatchPhysicalSaleAmbiguous,
  parseProductBatchTrackingBarcode,
  recordBatchPhysicalScan,
  resolveProductBatchTrackingScan
} from "./batchPhysicalTracking";
import {
  loadMainPdvSnapshot,
  loadProductBatchPhysicalScanLedger,
  loadProductLabelBatchStore,
  saveProductBatchPhysicalScanLedger
} from "./productLabelBatchStore";

type CatalogSnapshotProduct = {
  productCode: string;
  productName: string;
  itemType?: string;
  stock?: number;
};

export function BatchPhysicalTrackingDecor() {
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<"ok" | "warning" | "error">("ok");

  useEffect(() => {
    let disposed = false;

    const handlePhysicalScan = async (input: HTMLInputElement, rawValue: string) => {
      try {
        const parsed = parseProductBatchTrackingBarcode(rawValue);
        if (!parsed) return;
        const [store, snapshotJson] = await Promise.all([loadProductLabelBatchStore(), loadMainPdvSnapshot()]);
        if (disposed) return;
        const snapshot = safeJson(snapshotJson);
        const products = Array.isArray(snapshot.catalogProducts) ? snapshot.catalogProducts.filter(isCatalogProduct) : [];
        const batch = store.batches.find((item) => item.id === parsed.batchId);
        if (!batch) throw new Error("Etiqueta de lote não reconhecida neste PDV.");
        const product = products.find((item) => item.productCode === batch.productCode);
        if (!product) throw new Error(`Produto ${batch.productCode} do lote não existe mais no catálogo.`);
        if (product.itemType === "weight") {
          throw new Error("Produto por peso exige leitura de peso e lote em fluxo próprio; esta etiqueta não será lançada como 1 unidade.");
        }
        const saleBefore = readCurrentSaleNumber();
        const ledger = loadProductBatchPhysicalScanLedger();
        const reserved = saleBefore ? countReservedPhysicalScans(ledger, batch.id, saleBefore) : 0;
        const scan = resolveProductBatchTrackingScan(rawValue, store, new Date().toISOString().slice(0, 10), reserved);
        if (!scan) return;

        const quantityBefore = readCartProductQuantity(product.productName);
        setNativeInputValue(input, product.productCode);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));

        const inserted = await waitForCartIncrease(product.productName, quantityBefore, 1400);
        if (!inserted) throw new Error(`O lote ${scan.lotNumber} foi validado, mas o produto não entrou no carrinho. Nenhuma baixa de lote foi registrada.`);
        const saleNumber = await waitForSaleNumber(900);
        if (!saleNumber) throw new Error("Não foi possível vincular a etiqueta física à venda atual.");

        const freshLedger = loadProductBatchPhysicalScanLedger();
        const nextLedger = recordBatchPhysicalScan(freshLedger, {
          saleNumber,
          productCode: scan.productCode,
          batchId: scan.batchId,
          lotNumber: scan.lotNumber,
          expiresAt: scan.expiresAt,
          barcode: scan.barcode,
          scannedAt: new Date().toISOString()
        });
        saveProductBatchPhysicalScanLedger(nextLedger);
        setStatusKind("ok");
        setStatus(`Lote ${scan.lotNumber} confirmado fisicamente para esta unidade.`);
      } catch (error) {
        setStatusKind("error");
        setStatus(error instanceof Error ? error.message : "Falha ao identificar o lote físico.");
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key === "Enter" && target instanceof HTMLInputElement && target.placeholder.includes("Bipe")) {
        const rawValue = target.value.trim();
        if (!rawValue.startsWith("NXL1:")) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void handlePhysicalScan(target, rawValue);
        return;
      }
      if (event.key === "Delete") markCurrentSaleAmbiguous();
      if (event.key === "F2") clearCurrentSaleTracking();
    };

    const onClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest("button") : null;
      if (!element) return;
      const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (text === "Cancelar item" || text.includes("Remover ultimo item")) markCurrentSaleAmbiguous();
      if (text === "Limpar venda" || text.includes("Nova venda")) clearCurrentSaleTracking();
    };

    const markCurrentSaleAmbiguous = () => {
      const saleNumber = readCurrentSaleNumber();
      if (!saleNumber) return;
      const ledger = loadProductBatchPhysicalScanLedger();
      if (!ledger.records.some((record) => record.saleNumber === saleNumber)) return;
      saveProductBatchPhysicalScanLedger(markBatchPhysicalSaleAmbiguous(ledger, saleNumber));
      setStatusKind("warning");
      setStatus("Carrinho alterado após leitura de lote: esta venda será tratada como FEFO presumido para evitar rastreio físico falso.");
    };

    const clearCurrentSaleTracking = () => {
      const saleNumber = readCurrentSaleNumber();
      if (!saleNumber) return;
      const ledger = loadProductBatchPhysicalScanLedger();
      if (!ledger.records.some((record) => record.saleNumber === saleNumber)) return;
      saveProductBatchPhysicalScanLedger(clearBatchPhysicalSale(ledger, saleNumber));
      setStatus("");
    };

    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      disposed = true;
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!status) return null;
  const background = statusKind === "error" ? "#7f1d1d" : statusKind === "warning" ? "#854d0e" : "#14532d";
  return (
    <div
      data-batch-tracking-status={statusKind}
      role="status"
      style={{ position: "fixed", left: 20, bottom: 20, zIndex: 190, maxWidth: 520, padding: "10px 14px", borderRadius: 8, background, color: "#fff", font: "700 12px/1.35 Segoe UI, sans-serif", boxShadow: "0 8px 24px rgba(15,23,42,.24)" }}
    >
      {status}
    </div>
  );
}

function readCurrentSaleNumber() {
  const candidates = Array.from(document.querySelectorAll("span"));
  const label = candidates.find((element) => element.textContent?.trim() === "Venda" && element.parentElement?.querySelector("strong"));
  const number = label?.parentElement?.querySelector("strong")?.textContent?.trim() ?? "";
  return number && number !== "------" ? number : "";
}

function readCartProductQuantity(productName: string) {
  const productLabels = Array.from(document.querySelectorAll("strong"))
    .filter((element) => element.textContent?.replace(/\s+/g, " ").trim() === productName);
  for (const label of productLabels) {
    let row: Element | null = label.parentElement;
    for (let depth = 0; row && depth < 4; depth += 1, row = row.parentElement) {
      const text = row.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!text.includes(productName)) continue;
      const match = text.match(/([\d.,]+)\s*(?:UN|KG)\s*x\s*R\$/i);
      if (!match) continue;
      return Number(match[1].replace(/\./g, "").replace(",", ".")) || 0;
    }
  }
  return 0;
}

async function waitForCartIncrease(productName: string, before: number, timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (readCartProductQuantity(productName) > before) return true;
    await delay(45);
  }
  return false;
}

async function waitForSaleNumber(timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const saleNumber = readCurrentSaleNumber();
    if (saleNumber) return saleNumber;
    await delay(35);
  }
  return "";
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isCatalogProduct(value: unknown): value is CatalogSnapshotProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as CatalogSnapshotProduct;
  return Boolean(product.productCode && product.productName);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
