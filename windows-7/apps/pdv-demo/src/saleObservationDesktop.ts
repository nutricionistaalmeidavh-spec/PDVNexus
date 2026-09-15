import { getDesktopPdvStoreBridge, getDesktopPrintingBridge, type DesktopPrintingBridge } from "@nexus-core/desktop-runtime";
import {
  decorateReceiptWithSaleObservation,
  mergeSaleObservationsIntoSnapshot,
  reconcileSaleObservationsToBrowserStore
} from "./saleObservation";

const PDV_STORE_KEY = "nexus-core:pdv-store:v1";

const printingBridgeRegistry = new WeakMap<object, {
  refs: number;
  original: DesktopPrintingBridge["receipt"];
  wrapped: DesktopPrintingBridge["receipt"];
}>();

export async function reconcileSaleObservationsToStore() {
  reconcileSaleObservationsToBrowserStore();
  const bridge = getDesktopPdvStoreBridge();
  if (!bridge) return;

  try {
    const row = await bridge.load(PDV_STORE_KEY);
    if (!row?.snapshotJson) return;
    const merged = mergeSaleObservationsIntoSnapshot(row.snapshotJson);
    if (merged.changed) await bridge.save(PDV_STORE_KEY, merged.snapshotJson);
  } catch {
    // A observacao auxiliar nunca deve bloquear venda, persistencia ou impressao.
  }
}

export function installDesktopSaleObservationPrinting() {
  const bridge = getDesktopPrintingBridge();
  if (!bridge) return () => undefined;

  const existing = printingBridgeRegistry.get(bridge);
  if (existing) {
    existing.refs += 1;
    return () => {
      existing.refs -= 1;
      if (existing.refs <= 0 && bridge.receipt === existing.wrapped) {
        bridge.receipt = existing.original;
        printingBridgeRegistry.delete(bridge);
      }
    };
  }

  const original = bridge.receipt.bind(bridge);
  const wrapped: DesktopPrintingBridge["receipt"] = async (options) => {
    await reconcileSaleObservationsToStore();
    return original({
      ...options,
      text: decorateReceiptWithSaleObservation(options.text)
    });
  };
  bridge.receipt = wrapped;
  printingBridgeRegistry.set(bridge, { refs: 1, original, wrapped });

  return () => {
    const entry = printingBridgeRegistry.get(bridge);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0 && bridge.receipt === entry.wrapped) {
      bridge.receipt = entry.original;
      printingBridgeRegistry.delete(bridge);
    }
  };
}
