import { verifyPdvUserPassword, type PdvUser } from "../../../packages/database/src/pdv";

/** Nunca autoriza o fechamento só por selecionar um nome de gerente no menu. */
export function authorizePdvCashManager(users: readonly PdvUser[], pin: string): PdvUser {
  if (!pin.trim()) throw new Error("Informe o PIN de gerente para conferir ou fechar o caixa.");
  const manager = users.find((user) =>
    user.active && (user.role === "manager" || user.role === "admin") &&
    verifyPdvUserPassword({ user, password: pin }).ok
  );
  if (!manager) throw new Error("PIN de gerente inválido ou não configurado em Administração.");
  return manager;
}

/** Contagem cega: os valores informados nunca são pré-preenchidos a partir das vendas. */
export interface PdvCashCountDraft { cash: string; pix: string; credit: string; debit: string; extras?: Record<string, string>; }
const parseCount = (raw: string, label: string): number => {
  if (!raw.trim()) throw new Error(`Preencha ${label}, inclusive quando for R$ 0,00.`);
  const normalized = raw.trim().includes(",") ? raw.trim().split(".").join("").replace(",", ".") : raw.trim();
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Valor inválido em ${label}.`);
  return Math.round((value + Number.EPSILON) * 100) / 100;
};
export function buildPdvCashCount(input: PdvCashCountDraft): Record<string, number> {
  return {
    "A VISTA": parseCount(input.cash, "dinheiro contado"),
    PIX: parseCount(input.pix, "PIX conferido"),
    CREDITO: parseCount(input.credit, "crédito conferido"),
    DEBITO: parseCount(input.debit, "débito conferido"),
    ...Object.fromEntries(Object.entries(input.extras ?? {}).map(([name, value]) => [name, parseCount(value, `${name} conferido`)]))
  };
}
export function shouldHandlePdvHotkey(
  key: string, options: {route: string; editing: boolean; scannerInput?: boolean; dialogOpen?: boolean; modifiers?: boolean; composing?: boolean}
): boolean {
  if (options.route !== "/caixa" || options.dialogOpen || options.modifiers || options.composing) return false;
  if (key === "F3") return true;
  if (key === "Delete") return !options.editing;
  if (options.editing && !options.scannerInput) return false;
  return key === "F2" || key === "F6" || key === "F8";
}
