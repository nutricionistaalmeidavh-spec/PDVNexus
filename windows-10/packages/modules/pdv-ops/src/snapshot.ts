import type { PdvEventBus, PdvOpsEvent } from "./eventbus.js";

export interface PdvSnapshotLike {
  completedSales?: unknown[];
  catalogProducts?: unknown[];
  cashSession?: unknown;
  extensions?: {
    inventoryMovements?: unknown[];
    auditLogs?: unknown[];
    autoBackups?: Array<{ createdAt?: string }>;
    cashClosings?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function safeSnapshot(raw?: string | null): PdvSnapshotLike | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? parsed as PdvSnapshotLike : null;
  } catch {
    return null;
  }
}

export function publishPdvSnapshotDiff(bus: PdvEventBus, previousRaw: string | null | undefined, nextRaw: string) {
  const previous = safeSnapshot(previousRaw);
  const next = safeSnapshot(nextRaw);
  if (!next) return [] as PdvOpsEvent[];
  const events: PdvOpsEvent[] = [];
  events.push(bus.publish("pdv.snapshot.saved", { updatedAt: (next.updatedAt as string | undefined) ?? "" }));

  const previousSales = previous?.completedSales?.length ?? 0;
  const nextSales = next.completedSales?.length ?? 0;
  if (nextSales > previousSales) events.push(bus.publish("pdv.sale.completed", { count: nextSales - previousSales, totalSales: nextSales }));

  const previousInventory = previous?.extensions?.inventoryMovements?.length ?? 0;
  const nextInventory = next.extensions?.inventoryMovements?.length ?? 0;
  if (nextInventory > previousInventory) events.push(bus.publish("pdv.inventory.changed", { count: nextInventory - previousInventory }));

  const previousAudit = previous?.extensions?.auditLogs?.length ?? 0;
  const nextAudit = next.extensions?.auditLogs?.length ?? 0;
  if (nextAudit > previousAudit) events.push(bus.publish("pdv.audit.changed", { count: nextAudit - previousAudit }));

  const previousBackups = previous?.extensions?.autoBackups?.length ?? 0;
  const nextBackups = next.extensions?.autoBackups?.length ?? 0;
  if (nextBackups > previousBackups) events.push(bus.publish("pdv.backup.created", { count: nextBackups - previousBackups }));
  return events;
}
