import {
  getDesktopPdvStoreBridge,
  getDesktopPrintingBridge,
  type DesktopPdvStoreBridge,
  type DesktopPrintingBridge
} from "@nexus-core/desktop-runtime";
import {
  createPdvEventBus,
  createPdvPrintQueue,
  publishPdvSnapshotDiff,
  REPOUTEIS_PDV_MODULES
} from "../../../packages/modules/pdv-ops/src/index";
import {
  decorateReceiptWithSaleObservation,
  mergeSaleObservationsIntoSnapshot,
  reconcileSaleObservationsToBrowserStore
} from "./saleObservation";

const PDV_STORE_KEY = "nexus-core:pdv-store:v1";
const eventBus = createPdvEventBus();
let previousSnapshotJson: string | null = null;

const printingBridgeRegistry = new WeakMap<object, {
  refs: number;
  original: DesktopPrintingBridge["receipt"];
  wrapped: DesktopPrintingBridge["receipt"];
}>();

const storeBridgeRegistry = new WeakMap<object, {
  refs: number;
  original: DesktopPdvStoreBridge["save"];
  wrapped: DesktopPdvStoreBridge["save"];
}>();

let activePrintQueue: ReturnType<typeof createPdvPrintQueue<Parameters<DesktopPrintingBridge["receipt"]>[0]>> | null = null;

export function getPdvOpsRuntime() {
  return {
    bus: eventBus,
    printQueue: activePrintQueue,
    modules: REPOUTEIS_PDV_MODULES
  };
}

export async function reconcileSaleObservationsToStore() {
  reconcileSaleObservationsToBrowserStore();
  const bridge = getDesktopPdvStoreBridge();
  if (!bridge) return;

  try {
    const row = await bridge.load(PDV_STORE_KEY);
    if (!row?.snapshotJson) return;
    previousSnapshotJson = row.snapshotJson;
    const merged = mergeSaleObservationsIntoSnapshot(row.snapshotJson);
    if (merged.changed) await bridge.save(PDV_STORE_KEY, merged.snapshotJson);
  } catch {
    // Decoradores auxiliares nunca devem bloquear venda, persistencia ou impressao.
  }
}

export function installDesktopSaleObservationPersistence() {
  const bridge = getDesktopPdvStoreBridge();
  if (!bridge) return () => undefined;

  const existing = storeBridgeRegistry.get(bridge);
  if (existing) {
    existing.refs += 1;
    return () => {
      existing.refs -= 1;
      if (existing.refs <= 0 && bridge.save === existing.wrapped) {
        bridge.save = existing.original;
        storeBridgeRegistry.delete(bridge);
      }
    };
  }

  const original = bridge.save.bind(bridge);
  const wrapped: DesktopPdvStoreBridge["save"] = async (storeKey, snapshotJson) => {
    if (storeKey !== PDV_STORE_KEY) return original(storeKey, snapshotJson);
    const merged = mergeSaleObservationsIntoSnapshot(snapshotJson);
    const result = await original(storeKey, merged.snapshotJson);
    publishPdvSnapshotDiff(eventBus, previousSnapshotJson, merged.snapshotJson);
    previousSnapshotJson = merged.snapshotJson;
    return result;
  };
  bridge.save = wrapped;
  storeBridgeRegistry.set(bridge, { refs: 1, original, wrapped });

  void bridge.load(PDV_STORE_KEY).then((row) => {
    previousSnapshotJson = row?.snapshotJson ?? previousSnapshotJson;
  }).catch(() => undefined);

  return () => {
    const entry = storeBridgeRegistry.get(bridge);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0 && bridge.save === entry.wrapped) {
      bridge.save = entry.original;
      storeBridgeRegistry.delete(bridge);
    }
  };
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
  const queue = createPdvPrintQueue({
    maxAttempts: 2,
    bus: eventBus,
    print: original
  });
  activePrintQueue = queue;

  const wrapped: DesktopPrintingBridge["receipt"] = async (options) => {
    await reconcileSaleObservationsToStore();
    const job = await queue.enqueue({
      ...options,
      text: decorateReceiptWithSaleObservation(options.text)
    });
    return {
      success: job.status === "printed",
      failureReason: job.failureReason
    };
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
      activePrintQueue = null;
    }
  };
}
