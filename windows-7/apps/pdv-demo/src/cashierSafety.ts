/** Contagem cega: os valores informados nunca são pré-preenchidos a partir das vendas. */
export interface PdvCashCountDraft { cash: string; pix: string; credit: string; debit: string; }
const parseCount = (raw: string, label: string): number => {
  if (!raw.trim()) throw new Error(`Preencha ${label}, inclusive quando for R$ 0,00.`);
  const normalized = raw.trim().includes(",") ? raw.trim().replace(/\\./g, "").replace(",", ".") : raw.trim();
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Valor inválido em ${label}.`);
  return Math.round((value + Number.EPSILON) * 100) / 100;
};
export function buildPdvCashCount(input: PdvCashCountDraft): Record<string, number> {
  return {
    "A VISTA": parseCount(input.cash, "dinheiro contado"),
    PIX: parseCount(input.pix, "PIX conferido"),
    CREDITO: parseCount(input.credit, "crédito conferido"),
    DEBITO: parseCount(input.debit, "débito conferido")
  };
}
export function shouldHandlePdvHotkey(
  key: string, options: {route: string; editing: boolean; dialogOpen?: boolean; modifiers?: boolean; composing?: boolean}
): boolean {
  if (options.route !== "/caixa" || options.dialogOpen || options.modifiers || options.composing) return false;
  if (key === "F3") return true;
  if (options.editing) return false;
  return key === "F2" || key === "F6" || key === "F8" || key === "Delete";
}
