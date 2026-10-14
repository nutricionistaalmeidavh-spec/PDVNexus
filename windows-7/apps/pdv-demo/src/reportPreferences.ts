import type { ReportFilters, ReportView } from "./salesReporting";

export const SALES_REPORT_FAVORITES_KEY = "nexus-core:sales-report-favorites:v1";
export interface SalesReportFavorite {
  id: string;
  name: string;
  view: ReportView;
  filters: ReportFilters;
  createdAt: string;
}
const allowedViews: ReportView[] = ["lines", "sales", "products", "payments", "operators"];
const allowedStatus = ["completed", "cancelled", "all"];
const clean = (value: unknown, max = 128) => typeof value === "string" ? value.slice(0, max) : "";
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value)) ? clean(value) : "";
export function normalizeReportFilters(filters: unknown): ReportFilters {
  if (!filters || typeof filters !== "object") return { status: "completed" };
  const input = filters as Record<string, unknown>;
  const status = clean(input.status);
  return {
    from: date(input.from), to: date(input.to),
    query: clean(input.query), productCode: clean(input.productCode),
    paymentMethod: clean(input.paymentMethod), operator: clean(input.operator),
    brand: clean(input.brand), producer: clean(input.producer),
    status: allowedStatus.includes(status) ? status as ReportFilters["status"] : "completed"
  };
}
/** A preset stores only report preferences, never customer or financial records. */
export function parseReportFavorites(raw: string | null): SalesReportFavorite[] {
  if (!raw || raw.length > 100_000) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const valid = value.filter((x): x is Record<string, unknown> =>
      !!x && typeof x === "object" && !Array.isArray(x));
    const seen = new Set<string>();
    return valid.slice(0, 24).flatMap(x => {
      const id = clean(x.id, 60), name = clean(x.name, 60).trim();
      const view = clean(x.view) as ReportView;
      if (!id || !name || seen.has(id) || !allowedViews.includes(view)) return [];
      seen.add(id);
      return [{ id, name, view, filters: normalizeReportFilters(x.filters), createdAt: clean(x.createdAt, 35) }];
    });
  } catch { return []; }
}
export function saveReportFavorite(
  existing: readonly SalesReportFavorite[], input: { name: string; view: ReportView; filters: ReportFilters },
  now: string, id: string
): SalesReportFavorite[] {
  const name = input.name.trim().slice(0, 60);
  if (!name) throw new Error("Informe um nome para o relatório favorito.");
  if (!allowedViews.includes(input.view)) throw new Error("Visão de relatório inválida.");
  const key = name.toLocaleLowerCase("pt-BR");
  const saved = existing.find(f => f.name.toLocaleLowerCase("pt-BR") === key);
  const favorite: SalesReportFavorite = {
    id: saved?.id ?? id, name, view: input.view,
    filters: normalizeReportFilters(input.filters), createdAt: saved?.createdAt ?? now
  };
  const without = existing.filter(f => f.id !== favorite.id && f.name.toLocaleLowerCase("pt-BR") !== key);
  return [favorite, ...without].slice(0, 12);
}
export function removeReportFavorite(existing: readonly SalesReportFavorite[], id: string): SalesReportFavorite[] {
  return existing.filter(f => f.id !== id);
}
export interface ComparablePeriod { from: string; to: string; days: number }
/** Calendar-day comparisons avoid local DST shifts and preserve inclusive period length. */
export function previousComparablePeriod(from: string, to: string): ComparablePeriod | null {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to)) return null;
  const parse = (value: string) => Date.parse(value + "T00:00:00Z");
  const start = parse(from), end = parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (days < 1 || days > 3660) return null;
  const iso = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
  return { from: iso(start - days * 86_400_000), to: iso(start - 86_400_000), days };
}
export function comparisonDelta(current: number, previous: number): { absolute: number; percentage: number | null } {
  const absolute = Math.round((current - previous) * 100) / 100;
  return { absolute, percentage: previous === 0 ? null : (current - previous) / Math.abs(previous) * 100 };
}
