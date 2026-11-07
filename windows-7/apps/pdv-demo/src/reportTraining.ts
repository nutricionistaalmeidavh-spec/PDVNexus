/** Report-only exclusion: never touches cash sessions, inventory, receipts or canonical payments. */
export interface ReportExclusion {
  reason: string;
  excludedAt: string;
  excludedBy: string;
}
export interface ReportExclusionEvent extends ReportExclusion {
  action: "exclude" | "restore";
}
export interface ReportEligibleSale {
  number: string;
  finalizedAt: string;
  terminalId?: string;
  status?: "completed" | "cancelled";
  reportExclusion?: ReportExclusion;
  reportExclusionEvents?: ReportExclusionEvent[];
}
export interface ReportSaleIdentity { number: string; finalizedAt: string; terminalId?: string }
export function isSameReportSale(a: ReportSaleIdentity, b: ReportSaleIdentity): boolean {
  return a.number === b.number && a.finalizedAt === b.finalizedAt &&
    (a.terminalId ?? "") === (b.terminalId ?? "");
}
export function changeSaleReportExclusion<T extends ReportEligibleSale>(
  sales: readonly T[], identity: ReportSaleIdentity,
  action: "exclude" | "restore", actor: { id: string; role: string; active: boolean },
  reason: string, when: string
): T[] {
  if (!actor.active || !["manager", "admin"].includes(actor.role))
    throw new Error("Somente um gerente ou administrador ativo pode alterar a inclusão no relatório.");
  if (!actor.id.trim()) throw new Error("Operador não identificado.");
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 4 || normalizedReason.length > 200)
    throw new Error("Informe o motivo, de 4 a 200 caracteres.");
  if (!when || !Number.isFinite(Date.parse(when))) throw new Error("Data do registro inválida.");
  const matching = sales.filter(s => isSameReportSale(s, identity));
  if (matching.length !== 1) throw new Error("A venda não foi encontrada de forma única no histórico.");
  const target = matching[0];
  if (target.status === "cancelled") throw new Error("Uma venda cancelada não pode ser marcada como treinamento.");
  if (action === "exclude" && target.reportExclusion)
    throw new Error("Esta venda já foi desconsiderada do relatório.");
  if (action === "restore" && !target.reportExclusion)
    throw new Error("Esta venda já está incluída no relatório.");
  const event: ReportExclusionEvent = { action, reason: normalizedReason, excludedBy: actor.id, excludedAt: when };
  return sales.map(s => {
    if (!isSameReportSale(s, identity)) return s;
    const history = [...(s.reportExclusionEvents ?? []), event];
    return { ...s,
      reportExclusion: action === "exclude" ? { reason: normalizedReason, excludedAt: when, excludedBy: actor.id } : undefined,
      reportExclusionEvents: history };
  });
}
