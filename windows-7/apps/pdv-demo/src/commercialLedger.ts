import {
  applyPdvStockMovement,
  type PdvStockMovement
} from "../../../packages/database/src/pdv";

export interface CommercialSupplier {
  id: string;
  name: string;
  document?: string;
  phone?: string;
  createdAt: string;
}
export interface PurchaseLine {
  productCode: string;
  quantity: number;
  unitCost: number;
}
export interface CommercialPurchase {
  id: string;
  supplierId: string;
  orderedAt: string;
  dueDate?: string;
  status: "draft" | "received";
  items: PurchaseLine[];
  receivedAt?: string;
  invoiceRef?: string;
}
export interface CommercialSettlement {
  id: string;
  referenceId: string;
  amount: number;
  paidAt: string;
  method: string;
  kind: "purchase" | "sale";
}
export interface CommercialExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  occurredAt: string;
}
export interface CommercialFiscalProfile {
  uf: string;
  stateRegistration: string;
  taxRegime: "simples" | "normal" | "";
}
export interface CommercialLedger {
  fiscalProfile: CommercialFiscalProfile;
  suppliers: CommercialSupplier[];
  purchases: CommercialPurchase[];
  settlements: CommercialSettlement[];
  expenses: CommercialExpense[];
}
export interface CommercialCatalogProduct {
  productCode: string;
  productName: string;
  stock: number;
  minStock?: number;
  costPrice?: number;
  unitPrice?: number;
  active?: boolean;
}
export interface CommercialSaleItem {
  productCode: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  unitCostAtSale?: number;
}
export interface CommercialSale {
  number: string;
  finalizedAt: string;
  netTotal: number;
  discountPercent?: number;
  items: CommercialSaleItem[];
  payments: Array<{ method: string; amount: number }>;
}
export interface CommercialSummary {
  purchasesTotal: number;
  payableOpen: number;
  receivableOpen: number;
  expensesTotal: number;
  revenueTotal: number;
  knownCostTotal: number;
  grossProfit: number | null;
  uncostedSales: number;
}
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const stock3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;
function positive(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} deve ser maior que zero.`);
}
function nonnegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} não pode ser negativo.`);
}
function required(value: string, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Preencha ${field}.`);
}
function unique<T extends { id: string }>(rows: T[], id: string) {
  if (rows.some((row) => row.id === id)) throw new Error("Identificador duplicado; operação não aplicada.");
}
export function emptyCommercialLedger(): CommercialLedger {
  return { suppliers: [], purchases: [], settlements: [], expenses: [], fiscalProfile: { uf: "", stateRegistration: "", taxRegime: "" } };
}
export function normalizeCommercialLedger(value: unknown): CommercialLedger {
  const obj = value && typeof value === "object" ? value as Partial<CommercialLedger> : {};
  return {
    suppliers: Array.isArray(obj.suppliers) ? obj.suppliers : [],
    purchases: Array.isArray(obj.purchases) ? obj.purchases : [],
    settlements: Array.isArray(obj.settlements) ? obj.settlements : [],
    expenses: Array.isArray(obj.expenses) ? obj.expenses : [],
    fiscalProfile: { uf: obj.fiscalProfile?.uf ?? "", stateRegistration: obj.fiscalProfile?.stateRegistration ?? "", taxRegime: obj.fiscalProfile?.taxRegime ?? "" }
  };
}
export function updateCommercialFiscalProfile(ledger: CommercialLedger, profile: CommercialFiscalProfile): CommercialLedger {
  if (profile.uf && !["SP", "PR", "MG", "RJ", "SC", "RS"].includes(profile.uf)) throw new Error("UF ainda não parametrizada para preparação fiscal.");
  if (!["", "simples", "normal"].includes(profile.taxRegime)) throw new Error("Regime tributário não reconhecido.");
  return { ...ledger, fiscalProfile: { uf: profile.uf, stateRegistration: profile.stateRegistration.trim(), taxRegime: profile.taxRegime } };
}
export function purchaseTotal(purchase: CommercialPurchase) {
  return money(purchase.items.reduce((sum, row) => sum + row.quantity * row.unitCost, 0));
}
export function registerSupplier(ledger: CommercialLedger, supplier: CommercialSupplier): CommercialLedger {
  required(supplier.id, "identificador de fornecedor");
  required(supplier.name, "nome do fornecedor");
  required(supplier.createdAt, "data do cadastro");
  unique(ledger.suppliers, supplier.id);
  return { ...ledger, suppliers: [...ledger.suppliers, { ...supplier, name: supplier.name.trim() }] };
}
export function registerPurchase(ledger: CommercialLedger, purchase: CommercialPurchase, catalog: CommercialCatalogProduct[]): CommercialLedger {
  required(purchase.id, "número da compra");
  if (!ledger.suppliers.some((s) => s.id === purchase.supplierId)) throw new Error("Fornecedor não cadastrado.");
  if (purchase.status !== "draft") throw new Error("A compra deve iniciar como rascunho.");
  if (!purchase.items.length) throw new Error("Informe ao menos um item da compra.");
  const codes = new Set<string>();
  for (const item of purchase.items) {
    if (!catalog.some((p) => p.productCode === item.productCode && p.active !== false)) throw new Error(`Produto ${item.productCode} não está disponível no cadastro.`);
    if (codes.has(item.productCode)) throw new Error("Produto duplicado na mesma compra.");
    codes.add(item.productCode);
    positive(item.quantity, "Quantidade");
    nonnegative(item.unitCost, "Custo unitário");
  }
  unique(ledger.purchases, purchase.id);
  return { ...ledger, purchases: [...ledger.purchases, { ...purchase, items: purchase.items.map((item) => ({...item})) }] };
}
export function receivePurchase<T extends CommercialCatalogProduct>(input: {
  ledger: CommercialLedger;
  catalog: T[];
  movements: PdvStockMovement[];
  purchaseId: string;
  receivedAt: string;
}): { ledger: CommercialLedger; catalog: T[]; movements: PdvStockMovement[] } {
  const purchase = input.ledger.purchases.find((p) => p.id === input.purchaseId);
  if (!purchase) throw new Error("Compra não encontrada.");
  if (purchase.status !== "draft") throw new Error("Compra já recebida; recebimento duplicado bloqueado.");
  required(input.receivedAt, "data de recebimento");
  let catalog = [...input.catalog];
  const nextMovements: PdvStockMovement[] = [];
  for (const [index, line] of purchase.items.entries()) {
    const product = catalog.find((p) => p.productCode === line.productCode);
    if (!product) throw new Error(`Produto ${line.productCode} removido do catálogo; recebimento não aplicado.`);
    const id = `PURCHASE:${purchase.id}:${index}`;
    if (input.movements.some((movement) => movement.id === id)) throw new Error("Movimento de compra duplicado; recebimento interrompido.");
    const stockBefore = product.stock;
    const delta = applyPdvStockMovement({
      products: catalog,
      movement: {
        id,
        productCode: line.productCode,
        productName: product.productName,
        type: "entry",
        quantityDelta: line.quantity,
        reason: `Recebimento da compra ${purchase.id}`,
        createdAt: input.receivedAt
      }
    });
    // Existing unknown costs cannot be reconstructed. Use the newly documented unit cost.
    // For known costs, moving-weighted average reflects the remaining balance plus receipt.
    const newCost = product.costPrice === undefined || stockBefore <= 0
      ? line.unitCost
      : (product.costPrice * stockBefore + line.unitCost * line.quantity) / (stockBefore + line.quantity);
    catalog = delta.products.map((p) => p.productCode === line.productCode ? { ...p, costPrice: money(newCost) } : p);
    nextMovements.push(delta.movement);
  }
  return {
    catalog,
    movements: [...nextMovements, ...input.movements],
    ledger: {
      ...input.ledger,
      purchases: input.ledger.purchases.map((p) => p.id === purchase.id ?
        { ...p, status: "received" as const, receivedAt: input.receivedAt } : p)
    }
  };
}
function settlementsSum(ledger: CommercialLedger, kind: CommercialSettlement["kind"], ref: string) {
  return money(ledger.settlements.filter((p) => p.kind === kind && p.referenceId === ref).reduce((n, p) => n + p.amount, 0));
}
function validateSettlement(ledger: CommercialLedger, settlement: Omit<CommercialSettlement, "kind">) {
  unique(ledger.settlements, settlement.id);
  required(settlement.id, "identificador de pagamento");
  required(settlement.referenceId, "referência");
  required(settlement.method, "forma de pagamento");
  required(settlement.paidAt, "data do pagamento");
  positive(settlement.amount, "Valor do pagamento");
}
export function purchaseOpenBalance(ledger: CommercialLedger, purchase: CommercialPurchase): number {
  if (purchase.status !== "received") return 0;
  return Math.max(0, money(purchaseTotal(purchase) - settlementsSum(ledger, "purchase", purchase.id)));
}
export function settlePayable(ledger: CommercialLedger, payment: Omit<CommercialSettlement, "kind">): CommercialLedger {
  validateSettlement(ledger, payment);
  const purchase = ledger.purchases.find((p) => p.id === payment.referenceId);
  if (!purchase || purchase.status !== "received") throw new Error("Compra não recebida ou inexistente.");
  const balance = purchaseOpenBalance(ledger, purchase);
  if (money(payment.amount) > balance) throw new Error("Pagamento excede saldo a pagar.");
  return { ...ledger, settlements: [...ledger.settlements, { ...payment, amount: money(payment.amount), kind: "purchase" }] };
}
export function saleCreditTotal(sale: CommercialSale, creditMethods: string[]): number {
  const methods = new Set(creditMethods.map((method) => method.toLocaleLowerCase("pt-BR").trim()));
  return money(sale.payments.filter((p) => methods.has(p.method.toLocaleLowerCase("pt-BR").trim())).reduce((sum, p) => sum + p.amount, 0));
}
export function saleOpenBalance(ledger: CommercialLedger, sale: CommercialSale, creditMethods: string[]): number {
  return Math.max(0, money(saleCreditTotal(sale, creditMethods) - settlementsSum(ledger, "sale", sale.number)));
}
export function settleReceivable(ledger: CommercialLedger, payment: Omit<CommercialSettlement, "kind">,
  sales: CommercialSale[], creditMethods: string[]): CommercialLedger {
  validateSettlement(ledger, payment);
  const sale = sales.find((s) => s.number === payment.referenceId);
  if (!sale) throw new Error("Venda não encontrada.");
  const balance = saleOpenBalance(ledger, sale, creditMethods);
  if (money(payment.amount) > balance) throw new Error("Recebimento excede saldo a receber.");
  return { ...ledger, settlements: [...ledger.settlements, { ...payment, amount: money(payment.amount), kind: "sale" }] };
}
export function registerExpense(ledger: CommercialLedger, expense: CommercialExpense): CommercialLedger {
  unique(ledger.expenses, expense.id);
  required(expense.id, "identificador da despesa");
  required(expense.description, "descrição da despesa");
  required(expense.occurredAt, "data da despesa");
  positive(expense.amount, "Valor da despesa");
  return { ...ledger, expenses: [...ledger.expenses, { ...expense, amount: money(expense.amount) }] };
}
export function saleGrossProfit(sale: CommercialSale): { revenue: number; cost: number | null; grossProfit: number | null } {
  const revenue = money(sale.netTotal);
  if (sale.items.some((item) => item.unitCostAtSale === undefined ||
      !Number.isFinite(item.unitCostAtSale) || (item.unitCostAtSale ?? 0) < 0)) return { revenue, cost: null, grossProfit: null };
  const cost = money(sale.items.reduce((n, item) => n + item.quantity * (item.unitCostAtSale ?? 0), 0));
  return { revenue, cost, grossProfit: money(revenue - cost) };
}
export function summarizeCommercial(input: {
  ledger: CommercialLedger; sales: CommercialSale[]; creditMethods?: string[];
}): CommercialSummary {
  const { ledger, sales } = input;
  const creditMethods = input.creditMethods ?? ["A PRAZO", "CREDIARIO", "CREDIÁRIO"];
  let knownCostTotal = 0, knownProfit = 0, uncostedSales = 0;
  for (const sale of sales) {
    const report = saleGrossProfit(sale);
    if (report.grossProfit === null) uncostedSales++;
    else { knownCostTotal += report.cost ?? 0; knownProfit += report.grossProfit; }
  }
  return {
    purchasesTotal: money(ledger.purchases.filter((p) => p.status === "received").reduce((n, p) => n + purchaseTotal(p), 0)),
    payableOpen: money(ledger.purchases.reduce((n, p) => n + purchaseOpenBalance(ledger, p), 0)),
    receivableOpen: money(sales.reduce((n, s) => n + saleOpenBalance(ledger, s, creditMethods), 0)),
    expensesTotal: money(ledger.expenses.reduce((n, e) => n + e.amount, 0)),
    revenueTotal: money(sales.reduce((n, s) => n + s.netTotal, 0)),
    knownCostTotal: money(knownCostTotal),
    grossProfit: uncostedSales ? null : money(knownProfit),
    uncostedSales
  };
}
export interface FiscalReadinessInput {
  issuerCnpj: string;
  uf: string;
  certificateConfigured: boolean;
  homologated: boolean;
}
export function buildFiscalReadiness(input: FiscalReadinessInput): {
  status: "configuration-required" | "homologation-required" | "external-integration-required";
  issuanceEnabled: false;
  message: string;
} {
  if (!(/^[A-Z0-9]{14}$/i.test(input.issuerCnpj.replace(/[.\/\-\s]/g, "").trim())) || !/^[A-Z]{2}$/.test(input.uf.toUpperCase()) ||
      !input.certificateConfigured) {
    return { status: "configuration-required", issuanceEnabled: false,
      message: "Dados do emitente e certificado A1 devem ser configurados. Nenhuma NFC-e foi transmitida." };
  }
  if (!input.homologated) {
    return { status: "homologation-required", issuanceEnabled: false,
      message: "Homologação por UF e credenciamento fiscal pendentes. Emissão bloqueada." };
  }
  return { status: "external-integration-required", issuanceEnabled: false,
    message: "O emissor fiscal real ainda não está conectado: não há autorização de NFC-e, DANFE ou protocolo." };
}
