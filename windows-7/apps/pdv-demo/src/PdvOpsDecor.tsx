import { getDesktopPdvStoreBridge } from "@nexus-core/desktop-runtime";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  buildPdvOperationalAlerts,
  exportPdvOperationsReportCsv,
  previewPdvCustomerImport,
  previewPdvProductImport,
  REPOUTEIS_PDV_MODULES,
  type PdvImportedCustomer,
  type PdvImportedProduct,
  type PdvReportingSale
} from "../../../packages/modules/pdv-ops/src/index";
import { getPdvOpsRuntime } from "./saleObservationDesktop";

const PDV_STORE_KEY = "nexus-core:pdv-store:v1";
type ImportKind = "products" | "customers";

type ProductLike = {
  productCode: string;
  barcode?: string;
  productName: string;
  unitPrice: number;
  itemType?: "unit" | "weight";
  shelfLifeDays?: number;
  unitLabel?: string;
  stock: number;
  minStock?: number;
  category?: string;
  active?: boolean;
};

type CustomerLike = {
  id: string;
  name: string;
  document?: string;
  city?: string;
  creditLimit?: number;
  creditUsed?: number;
};

type SnapshotLike = {
  catalogProducts?: ProductLike[];
  registeredCustomers?: CustomerLike[];
  completedSales?: PdvReportingSale[];
  cashSession?: { openedAt?: string } | null;
  extensions?: {
    cashClosings?: Array<{ status?: string; closedAt?: string; divergenceByMethod?: Record<string, number> }>;
    autoBackups?: Array<{ createdAt?: string }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function parseSnapshot(raw: string | null): SnapshotLike | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? value as SnapshotLike : null;
  } catch {
    return null;
  }
}

async function readSnapshot() {
  const bridge = getDesktopPdvStoreBridge();
  if (bridge) {
    const row = await bridge.load(PDV_STORE_KEY);
    if (row?.snapshotJson) return row.snapshotJson;
  }
  return window.localStorage.getItem(PDV_STORE_KEY);
}

async function writeSnapshot(snapshot: SnapshotLike) {
  const raw = JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() });
  const bridge = getDesktopPdvStoreBridge();
  if (bridge) await bridge.save(PDV_STORE_KEY, raw);
  window.localStorage.setItem(PDV_STORE_KEY, raw);
}

function mergeProducts(snapshot: SnapshotLike, products: PdvImportedProduct[]) {
  const current = [...(snapshot.catalogProducts ?? [])];
  for (const product of products) {
    current.push({
      productCode: product.code,
      barcode: product.barcode,
      productName: product.name,
      unitPrice: product.price,
      itemType: "unit",
      shelfLifeDays: 0,
      unitLabel: "UN",
      stock: product.stock,
      minStock: product.minimumStock,
      category: product.category,
      active: true
    });
  }
  return { ...snapshot, catalogProducts: current };
}

function mergeCustomers(snapshot: SnapshotLike, customers: PdvImportedCustomer[]) {
  const current = [...(snapshot.registeredCustomers ?? [])];
  for (const customer of customers) {
    current.push({
      id: customer.id,
      name: customer.name,
      document: customer.document,
      city: customer.city,
      creditLimit: customer.creditLimit,
      creditUsed: 0
    });
  }
  return { ...snapshot, registeredCustomers: current };
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function PdvOpsDecor() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [route, setRoute] = useState(() => window.location.hash || "#/caixa");
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotLike | null>(null);
  const [importKind, setImportKind] = useState<ImportKind>("products");
  const [message, setMessage] = useState("");
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/caixa");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const raw = await readSnapshot();
        if (active) setSnapshot(parseSnapshot(raw));
      } catch {
        if (active) setMessage("Não foi possível ler o snapshot operacional.");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const runtime = getPdvOpsRuntime();
    return runtime.bus.subscribe("*", () => setEventCount((value) => value + 1));
  }, []);

  const alerts = useMemo(() => {
    const runtime = getPdvOpsRuntime();
    const backups = snapshot?.extensions?.autoBackups ?? [];
    return buildPdvOperationalAlerts({
      products: snapshot?.catalogProducts ?? [],
      cashClosings: snapshot?.extensions?.cashClosings ?? [],
      printJobs: runtime.printQueue?.list() ?? [],
      lastBackupAt: backups[0]?.createdAt,
      cashSessionOpenedAt: snapshot?.cashSession?.openedAt
    });
  }, [snapshot, eventCount]);

  const handleImport = async (file: File) => {
    const raw = await file.text();
    const current = snapshot ?? parseSnapshot(await readSnapshot());
    if (!current) {
      setMessage("Base do PDV indisponível para importação.");
      return;
    }

    if (importKind === "products") {
      const existingCodes = (current.catalogProducts ?? []).map((product) => product.productCode);
      const preview = previewPdvProductImport(raw, existingCodes);
      if (preview.issues.length) {
        setMessage(`Importação bloqueada: ${preview.issues.slice(0, 3).map((issue) => `linha ${issue.row}: ${issue.message}`).join("; ")}`);
        return;
      }
      await writeSnapshot(mergeProducts(current, preview.products));
      setMessage(`${preview.products.length} produto(s) importado(s). Recarregando o PDV.`);
    } else {
      const existingIds = (current.registeredCustomers ?? []).map((customer) => customer.id);
      const preview = previewPdvCustomerImport(raw, existingIds);
      if (preview.issues.length) {
        setMessage(`Importação bloqueada: ${preview.issues.slice(0, 3).map((issue) => `linha ${issue.row}: ${issue.message}`).join("; ")}`);
        return;
      }
      await writeSnapshot(mergeCustomers(current, preview.customers));
      setMessage(`${preview.customers.length} cliente(s) importado(s). Recarregando o PDV.`);
    }

    window.setTimeout(() => window.location.reload(), 400);
  };

  const exportReport = () => {
    const csv = exportPdvOperationsReportCsv(snapshot?.completedSales ?? []);
    downloadText(`pdv-nexus-relatorio-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
    setMessage("Relatório operacional exportado em CSV.");
  };

  if (!route.includes("/administracao")) return null;

  return (
    <aside style={styles.dock} aria-label="Robustez operacional do PDV">
      <button type="button" style={styles.trigger} onClick={() => setOpen((value) => !value)}>
        Operação {alerts.length ? `(${alerts.length})` : "OK"}
      </button>
      {open ? (
        <section style={styles.panel}>
          <div style={styles.header}>
            <div>
              <strong>Robustez operacional</strong>
              <div style={styles.muted}>RepoUteis P0 + P1 · local/offline</div>
            </div>
            <button type="button" style={styles.close} onClick={() => setOpen(false)} aria-label="Fechar">×</button>
          </div>

          <div style={styles.metrics}>
            <span>{REPOUTEIS_PDV_MODULES.p0.length} P0</span>
            <span>{REPOUTEIS_PDV_MODULES.p1.length} P1</span>
            <span>{eventCount} eventos</span>
          </div>

          <div style={styles.block}>
            <strong style={styles.blockTitle}>Alertas</strong>
            {alerts.length === 0 ? <span style={styles.ok}>Nenhum alerta operacional.</span> : alerts.slice(0, 5).map((alert) => <span key={alert.id} style={styles.alert}>{alert.message}</span>)}
          </div>

          <div style={styles.block}>
            <strong style={styles.blockTitle}>Importação</strong>
            <div style={styles.row}>
              <select value={importKind} onChange={(event) => setImportKind(event.target.value as ImportKind)} style={styles.select}>
                <option value="products">Produtos/estoque</option>
                <option value="customers">Clientes</option>
              </select>
              <button type="button" style={styles.action} onClick={() => fileRef.current?.click()}>Importar CSV</button>
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                event.currentTarget.value = "";
              }} />
            </div>
          </div>

          <div style={styles.block}>
            <strong style={styles.blockTitle}>Relatórios</strong>
            <button type="button" style={styles.action} onClick={exportReport}>Exportar vendas CSV</button>
          </div>

          {message ? <div style={styles.message}>{message}</div> : null}
        </section>
      ) : null}
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  dock: { position: "fixed", right: 18, bottom: 18, zIndex: 1200, fontFamily: "inherit" },
  trigger: { border: "1px solid rgba(148,163,184,.35)", borderRadius: 999, padding: "9px 14px", background: "#0f172a", color: "#f8fafc", cursor: "pointer", boxShadow: "0 10px 24px rgba(2,6,23,.28)" },
  panel: { position: "absolute", right: 0, bottom: 48, width: 330, display: "grid", gap: 12, padding: 14, border: "1px solid rgba(148,163,184,.3)", borderRadius: 14, background: "#0f172a", color: "#e2e8f0", boxShadow: "0 18px 50px rgba(2,6,23,.42)" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  close: { border: 0, background: "transparent", color: "#cbd5e1", fontSize: 20, cursor: "pointer" },
  muted: { marginTop: 2, fontSize: 11, color: "#94a3b8" },
  metrics: { display: "flex", gap: 7, flexWrap: "wrap", fontSize: 11 },
  block: { display: "grid", gap: 7, paddingTop: 10, borderTop: "1px solid rgba(148,163,184,.18)" },
  blockTitle: { fontSize: 12 },
  row: { display: "flex", gap: 7 },
  select: { flex: 1, minWidth: 0, borderRadius: 7, border: "1px solid rgba(148,163,184,.3)", background: "#111827", color: "#e2e8f0", padding: "7px 8px" },
  action: { borderRadius: 7, border: "1px solid rgba(148,163,184,.3)", background: "#1e293b", color: "#f8fafc", padding: "7px 9px", cursor: "pointer" },
  alert: { display: "block", fontSize: 11, color: "#fbbf24" },
  ok: { fontSize: 11, color: "#86efac" },
  message: { fontSize: 11, lineHeight: 1.4, color: "#cbd5e1" }
};
