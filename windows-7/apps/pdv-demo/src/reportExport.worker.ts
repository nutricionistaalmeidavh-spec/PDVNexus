import { buildSalesPdf, buildSalesXlsx, type ExportContext } from "./reportDocuments";
import type { ReportResult } from "./salesReporting";

type Request = { kind: "pdf" | "xlsx"; report: ReportResult; context: ExportContext };
const worker = self as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<Request>) => {
  try {
    worker.postMessage({ type: "progress", label: "Preparando o arquivo..." });
    const { kind, report, context } = event.data;
    if (kind !== "pdf" && kind !== "xlsx") throw new Error("Formato não suportado.");
    const binary = kind === "pdf" ? buildSalesPdf(report, context) : buildSalesXlsx(report, context);
    worker.postMessage({ type: "done", bytes: binary.buffer }, [binary.buffer]);
  } catch (error) {
    worker.postMessage({ type: "error", message: error instanceof Error ? error.message : "Falha ao exportar." });
  }
};
