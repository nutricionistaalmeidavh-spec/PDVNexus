export type PdvProductType = "unit" | "weight";

export interface PdvProduct {
  id: string;
  code: string;
  barcode: string;
  name: string;
  category: string;
  type: PdvProductType;
  price: number;
  stock: number;
  minimumStock: number;
  active: boolean;
  updatedAt: string;
}

export interface PdvCustomer {
  id: string;
  name: string;
  document: string;
  phone?: string;
  creditLimit: number;
  creditUsed: number;
  active: boolean;
  updatedAt: string;
}

export interface PdvSaleLine {
  productId: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PdvSale {
  id: string;
  number: string;
  terminalId: string;
  operatorId: string;
  customerId?: string;
  lines: PdvSaleLine[];
  total: number;
  payments: Array<{ method: string; amount: number }>;
  status: "completed" | "cancelled" | "pending-sync";
  createdAt: string;
}

export interface PdvStoreSnapshot {
  products: PdvProduct[];
  customers: PdvCustomer[];
  sales: PdvSale[];
}

export const EMPTY_PDV_STORE: PdvStoreSnapshot = { products: [], customers: [], sales: [] };

export const PDV_LOCAL_STORE_VERSION = 1;
export const DEFAULT_PDV_LOCAL_STORE_KEY = "nexus-core:pdv-store:v1";

export interface PdvKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PdvLocalStore<
  TProduct,
  TCustomer,
  TCompletedSale,
  TCashSession,
  TPaymentOption,
  TDeviceConfig
> {
  version: number;
  updatedAt: string;
  catalogProducts: TProduct[];
  registeredCustomers: TCustomer[];
  completedSales: TCompletedSale[];
  cashSession: TCashSession | null;
  paymentOptions: TPaymentOption[];
  deviceConfig: TDeviceConfig;
  extensions?: Record<string, unknown>;
}

export interface PdvLegacyStorageKeys {
  catalogProducts: string;
  registeredCustomers: string;
  completedSales: string;
  cashSession: string;
  paymentOptions: string;
  deviceConfig: string;
}

export type PdvLocalStoreDefaults<
  TProduct,
  TCustomer,
  TCompletedSale,
  TCashSession,
  TPaymentOption,
  TDeviceConfig
> = Omit<
  PdvLocalStore<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig>,
  "version" | "updatedAt"
>;

export function createDefaultPdvLocalStore<
  TProduct,
  TCustomer,
  TCompletedSale,
  TCashSession,
  TPaymentOption,
  TDeviceConfig
>(
  defaults: PdvLocalStoreDefaults<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig>,
  updatedAt = new Date().toISOString()
): PdvLocalStore<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig> {
  return {
    version: PDV_LOCAL_STORE_VERSION,
    updatedAt,
    ...defaults
  };
}

export function createBrowserPdvRepository<
  TProduct,
  TCustomer,
  TCompletedSale,
  TCashSession,
  TPaymentOption,
  TDeviceConfig
>(options: {
  storage: PdvKeyValueStorage;
  defaults: PdvLocalStoreDefaults<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig>;
  storeKey?: string;
  legacyKeys?: PdvLegacyStorageKeys;
  now?: () => string;
}) {
  const storeKey = options.storeKey ?? DEFAULT_PDV_LOCAL_STORE_KEY;
  const now = options.now ?? (() => new Date().toISOString());

  const save = (
    patch: Partial<PdvLocalStoreDefaults<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig>>
  ) => {
    const current = load();
    const { version: _version, updatedAt: _updatedAt, ...currentData } = current;
    const next = createDefaultPdvLocalStore({ ...currentData, ...patch }, now());
    options.storage.setItem(storeKey, JSON.stringify(next));
    return next;
  };

  const load = () => {
    const raw = options.storage.getItem(storeKey);
    if (raw) {
      return normalizePdvLocalStore<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig>(
        parseJson(raw, {}),
        options.defaults,
        now()
      );
    }

    const migrated = migrateLegacyPdvLocalStore(options.storage, options.defaults, options.legacyKeys, now());
    options.storage.setItem(storeKey, JSON.stringify(migrated));
    return migrated;
  };

  return {
    load,
    save,
    exportSnapshot() {
      return JSON.stringify(load(), null, 2);
    },
    importSnapshot(raw: string) {
      const parsed = parseStrictJson(raw);
      const next = normalizePdvLocalStore<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig>(
        parsed,
        options.defaults,
        now()
      );
      options.storage.setItem(storeKey, JSON.stringify(next));
      return next;
    },
    clear() {
      options.storage.removeItem(storeKey);
    }
  };
}

export interface PdvSaleCompletionProduct {
  productCode: string;
  productName: string;
  stock: number;
}

export interface PdvSaleCompletionCustomer {
  id: string;
  name: string;
  creditLimit: number;
  creditUsed: number;
}

export interface PdvSaleCompletionLine {
  productCode: string;
  productName: string;
  quantity: number;
}

export interface PdvSaleCompletionPayment {
  method: string;
  amount: number;
}

export type PdvPaymentStatus = "paid" | "insufficient";

export interface PdvPaymentResolutionInput {
  total: number;
  payments: PdvSaleCompletionPayment[];
  availableCredit?: number;
  customerName?: string;
  creditMethods?: string[];
  changeMethods?: string[];
}

export interface PdvPaymentSummary {
  status: PdvPaymentStatus;
  total: number;
  paidTotal: number;
  remainingTotal: number;
  changeDue: number;
  creditTotal: number;
  immediateTotal: number;
}

export type PdvStockMovementType = "entry" | "sale" | "adjustment" | "inventory" | "cancellation";

export interface PdvStockMovementProduct {
  productCode: string;
  productName: string;
  stock: number;
  minStock?: number;
}

export interface PdvStockMovementDraft {
  id: string;
  productCode: string;
  productName: string;
  type: PdvStockMovementType;
  quantityDelta: number;
  reason: string;
  createdAt: string;
}

export interface PdvStockMovement extends PdvStockMovementDraft {
  stockBefore: number;
  stockAfter: number;
}

export interface PdvInventoryCountDraft {
  id: string;
  productCode: string;
  productName: string;
  countedQuantity: number;
  reason: string;
  createdAt: string;
}

export interface PdvLowStockAlert {
  productCode: string;
  productName: string;
  stock: number;
  minStock: number;
}

export interface PdvStockMovementResult<TProduct extends PdvStockMovementProduct> {
  products: TProduct[];
  movement: PdvStockMovement;
  lowStockAlerts: PdvLowStockAlert[];
}

export interface PdvCashClosingSale {
  number: string;
  payments: PdvSaleCompletionPayment[];
  netTotal: number;
}

export interface PdvCashSessionSale extends PdvCashClosingSale {
  finalizedAt: string;
}

export interface PdvCashClosingWithdrawal {
  amount: number;
  note: string;
  createdAt: string;
}

export interface PdvCashClosingInput {
  openedAt: string;
  closedAt: string;
  initialAmount: number;
  withdrawals: PdvCashClosingWithdrawal[];
  sales: PdvCashClosingSale[];
  countedByMethod: Record<string, number>;
  cashMethods?: string[];
}

export interface PdvCashClosingSummary {
  openedAt: string;
  closedAt: string;
  expectedByMethod: Record<string, number>;
  countedByMethod: Record<string, number>;
  divergenceByMethod: Record<string, number>;
  expectedCashTotal: number;
  countedCashTotal: number;
  withdrawalTotal: number;
  salesTotal: number;
  status: "balanced" | "divergent";
}

export interface PdvReceiptSale {
  number: string;
  finalizedAt: string;
  seller: string;
  customerName: string;
  netTotal: number;
  paymentSummary: Pick<PdvPaymentSummary, "paidTotal" | "changeDue">;
  items: Array<{ productName: string; quantity: number; unitLabel: string; unitPrice: number; totalPrice: number }>;
  payments: PdvSaleCompletionPayment[];
}

export interface PdvReceiptInput {
  storeName: string;
  address?: string;
  phone?: string;
  documentLabel: string;
  sale: PdvReceiptSale;
  width?: number;
}

export interface PdvReportSale {
  number: string;
  finalizedAt: string;
  netTotal: number;
  items: Array<{ productCode: string; productName: string; quantity: number; totalPrice: number }>;
  payments: PdvSaleCompletionPayment[];
}

export interface PdvReportCashClosing {
  closedAt: string;
  expectedCashTotal: number;
  countedCashTotal: number;
  status: "balanced" | "divergent";
}

export interface PdvDashboardReportInput<TProduct extends PdvStockMovementProduct> {
  from: string;
  to: string;
  sales: PdvReportSale[];
  products: TProduct[];
  cashClosings: PdvReportCashClosing[];
}

export interface PdvDashboardReport {
  from: string;
  to: string;
  salesCount: number;
  salesTotal: number;
  averageTicket: number;
  paymentsByMethod: Record<string, number>;
  topProducts: Array<{ productCode: string; productName: string; quantity: number; total: number }>;
  lowStockAlerts: PdvLowStockAlert[];
  cashflow: {
    expectedCashTotal: number;
    countedCashTotal: number;
    divergenceTotal: number;
    divergentClosings: number;
  };
}

export type PdvUserRole = "cashier" | "manager" | "admin";

export interface PdvUser {
  id: string;
  name: string;
  role: PdvUserRole;
  active: boolean;
  managerPassword?: string;
  password?: string;
}

export interface PdvAuditLog {
  id: string;
  action: string;
  operatorId: string;
  operatorName: string;
  authorizedById?: string;
  authorizedByName?: string;
  reason: string;
  createdAt: string;
}

export type PdvTerminalMode = "single" | "server" | "client";

export interface PdvTerminalConfig {
  terminalId: string;
  terminalName: string;
  mode: PdvTerminalMode;
  active: boolean;
  serverUrl?: string;
}

export interface ConfigurePdvTerminalInput {
  terminalId: string;
  terminalName: string;
  mode: PdvTerminalMode;
  serverUrl?: string;
  active?: boolean;
}

export interface PdvPaymentOption {
  name: string;
  feePercent: number;
  showsInCashflow: boolean;
  active?: boolean;
  kind?: "cash" | "pix" | "credit" | "debit" | "store-credit" | "check" | "other";
}

export interface UpsertPdvPaymentOptionInput<TPaymentOption extends PdvPaymentOption> {
  options: TPaymentOption[];
  option: TPaymentOption;
}

export interface UpsertPdvUserInput {
  users: PdvUser[];
  user: PdvUser;
  operator: PdvUser;
  createdAt: string;
}

export interface UpsertPdvUserResult {
  users: PdvUser[];
  auditLog: PdvAuditLog;
}

export interface PdvHistorySale {
  number: string;
  customerId?: string;
  finalizedAt: string;
  netTotal: number;
  payments: PdvSaleCompletionPayment[];
  status?: "completed" | "cancelled";
}

export interface PdvSalesHistoryFilters {
  from?: string;
  to?: string;
  customerId?: string;
  status?: "all" | "completed" | "cancelled";
  paymentMethod?: string;
  query?: string;
}

export interface FilterPdvSalesHistoryInput<TSale extends PdvHistorySale> {
  sales: TSale[];
  cancelledSales?: TSale[];
  filters?: PdvSalesHistoryFilters;
}

export interface PdvReportCsvRow {
  date: string;
  number: string;
  customerName: string;
  status: string;
  paymentMethods: string;
  total: number;
}

export interface PdvStorageMigrationPlanInput {
  isDesktop: boolean;
  sqliteAvailable: boolean;
  localSnapshotExists: boolean;
  sqliteSnapshotExists: boolean;
}

export interface PdvStorageMigrationPlan {
  target: "localStorage" | "sqlite";
  shouldCopyLocalToSqlite: boolean;
  shouldKeepLocalFallback: boolean;
  status: "browser-only" | "ready" | "migration-required" | "sqlite-unavailable";
}

export interface PdvTefTransactionInput {
  enabled: boolean;
  simulationMode: boolean;
  provider: string;
  saleNumber: string;
  method: string;
  amount: number;
  createdAt: string;
}

export interface PdvUserPasswordVerificationInput {
  user: PdvUser;
  password: string;
}

export interface PdvUserPasswordVerification {
  ok: boolean;
  reason: "authenticated" | "inactive-user" | "missing-password" | "invalid-password";
}

export interface PdvAutoBackup {
  id: string;
  createdAt: string;
  reason: string;
  snapshotJson: string;
}

export interface CreatePdvAutoBackupInput {
  backups: PdvAutoBackup[];
  snapshotJson: string;
  reason: string;
  createdAt: string;
  retention: number;
}

export interface PdvTefProviderRequestInput {
  provider: string;
  endpointUrl: string;
  merchantCode: string;
  saleNumber: string;
  method: string;
  amount: number;
  createdAt: string;
}

export interface PdvTefProviderRequest {
  url: string;
  expectedStatus: "pending-provider";
  payload: {
    provider: string;
    merchantCode: string;
    saleNumber: string;
    method: string;
    amount: number;
    captureMode: "card-present";
    createdAt: string;
  };
}

export interface PdvTefTransaction {
  id: string;
  provider: string;
  saleNumber: string;
  method: string;
  amount: number;
  status: "approved" | "declined" | "disabled";
  authorizationCode: string;
  nsu: string;
  createdAt: string;
  message: string;
}

export interface PdvActionAuthorization {
  authorizedBy?: PdvUser;
  auditLog: PdvAuditLog;
}

export interface PdvActionAuthorizationInput {
  action: string;
  operator: PdvUser;
  users: PdvUser[];
  reason: string;
  createdAt: string;
  managerPassword?: string;
  sensitiveRoles?: PdvUserRole[];
}

export interface PdvSaleCancellationLine {
  productCode: string;
  productName: string;
  quantity: number;
}

export interface PdvSaleCancellationDraft {
  number: string;
  customerId?: string;
  items: PdvSaleCancellationLine[];
  payments: PdvSaleCompletionPayment[];
  netTotal: number;
  finalizedAt: string;
  paymentSummary?: Partial<Pick<PdvPaymentSummary, "creditTotal">>;
}

export interface CancelPdvSaleInput<TProduct extends PdvStockMovementProduct, TCustomer extends PdvSaleCompletionCustomer, TSale extends PdvSaleCancellationDraft> {
  sale: TSale;
  products: TProduct[];
  customer: TCustomer;
  reason: string;
  cancelledAt: string;
  operator: PdvUser;
  authorization: PdvActionAuthorization;
}

export interface CancelPdvSaleResult<TProduct extends PdvStockMovementProduct, TCustomer extends PdvSaleCompletionCustomer, TSale extends PdvSaleCancellationDraft> {
  products: TProduct[];
  customer: TCustomer;
  cancelledSale: TSale & { status: "cancelled"; cancelledAt: string; cancelReason: string; cancelledById: string; authorizedById?: string };
  stockMovements: PdvStockMovement[];
  auditLog: PdvAuditLog;
}

export interface PdvSaleCompletionDraft {
  items: PdvSaleCompletionLine[];
  payments: PdvSaleCompletionPayment[];
  discountPercent: number;
}

export interface CompletePdvSaleInput<
  TProduct extends PdvSaleCompletionProduct,
  TCustomer extends PdvSaleCompletionCustomer,
  TSale extends PdvSaleCompletionDraft,
  TCompletedSale
> {
  sale: TSale;
  products: TProduct[];
  customer: TCustomer;
  completedSales: TCompletedSale[];
  finalizedAt: string;
  maxCompletedSales?: number;
}

export interface CompletePdvSaleResult<
  TProduct extends PdvSaleCompletionProduct,
  TCustomer extends PdvSaleCompletionCustomer,
  TSale extends PdvSaleCompletionDraft,
  TCompletedSale
> {
  products: TProduct[];
  customer: TCustomer;
  completedSale: TSale & { finalizedAt: string; netTotal: number; paymentSummary: PdvPaymentSummary };
  completedSales: Array<TCompletedSale | (TSale & { finalizedAt: string; netTotal: number; paymentSummary: PdvPaymentSummary })>;
}

export function resolvePdvPayment(input: PdvPaymentResolutionInput): PdvPaymentSummary {
  const total = roundCurrency(input.total);
  const creditMethods = new Set(input.creditMethods ?? ["A PRAZO"]);
  const changeMethods = new Set(input.changeMethods ?? ["DINHEIRO", "A VISTA"]);

  const paidTotal = roundCurrency(input.payments.reduce((sum, payment) => sum + normalizePaymentAmount(payment.amount), 0));
  const creditTotal = roundCurrency(
    input.payments.reduce((sum, payment) => sum + (creditMethods.has(payment.method) ? normalizePaymentAmount(payment.amount) : 0), 0)
  );
  const immediateTotal = roundCurrency(paidTotal - creditTotal);
  const changeEligibleTotal = roundCurrency(
    input.payments.reduce((sum, payment) => sum + (changeMethods.has(payment.method) ? normalizePaymentAmount(payment.amount) : 0), 0)
  );
  const availableCredit = input.availableCredit ?? Number.POSITIVE_INFINITY;

  if (creditTotal > availableCredit) {
    throw new Error(`Limite de credito insuficiente para ${input.customerName ?? "cliente"}.`);
  }

  const remainingTotal = roundCurrency(Math.max(total - paidTotal, 0));
  const changeDue = roundCurrency(Math.max(Math.min(changeEligibleTotal, paidTotal) - total, 0));

  return {
    status: remainingTotal > 0 ? "insufficient" : "paid",
    total,
    paidTotal,
    remainingTotal,
    changeDue,
    creditTotal,
    immediateTotal
  };
}

export function applyPdvStockMovement<TProduct extends PdvStockMovementProduct>(input: {
  products: TProduct[];
  movement: PdvStockMovementDraft;
}): PdvStockMovementResult<TProduct> {
  const product = input.products.find((item) => item.productCode === input.movement.productCode);
  if (!product) {
    throw new Error(`Produto ${input.movement.productCode} nao encontrado no catalogo.`);
  }

  const stockBefore = roundStock(product.stock);
  const stockAfter = roundStock(stockBefore + input.movement.quantityDelta);

  if (stockAfter < 0) {
    throw new Error(`Estoque nao pode ficar negativo para ${product.productName}.`);
  }

  const movement: PdvStockMovement = { ...input.movement, stockBefore, stockAfter };
  const products = input.products.map((item) => item.productCode === product.productCode ? { ...item, stock: stockAfter } : item);

  return {
    products,
    movement,
    lowStockAlerts: getPdvLowStockAlerts(products)
  };
}

export function applyPdvInventoryCount<TProduct extends PdvStockMovementProduct>(input: {
  products: TProduct[];
  count: PdvInventoryCountDraft;
}): PdvStockMovementResult<TProduct> {
  const product = input.products.find((item) => item.productCode === input.count.productCode);
  if (!product) {
    throw new Error(`Produto ${input.count.productCode} nao encontrado no catalogo.`);
  }

  return applyPdvStockMovement({
    products: input.products,
    movement: {
      id: input.count.id,
      productCode: input.count.productCode,
      productName: input.count.productName,
      type: "inventory",
      quantityDelta: roundStock(input.count.countedQuantity - product.stock),
      reason: input.count.reason,
      createdAt: input.count.createdAt
    }
  });
}

export function getPdvLowStockAlerts<TProduct extends PdvStockMovementProduct>(products: TProduct[]): PdvLowStockAlert[] {
  return products
    .filter((product) => typeof product.minStock === "number" && product.stock <= product.minStock)
    .map((product) => ({
      productCode: product.productCode,
      productName: product.productName,
      stock: roundStock(product.stock),
      minStock: product.minStock ?? 0
    }));
}

export function closePdvCashSession(input: PdvCashClosingInput): PdvCashClosingSummary {
  const cashMethods = new Set(input.cashMethods ?? ["A VISTA"]);
  const withdrawalTotal = roundCurrency(input.withdrawals.reduce((sum, withdrawal) => sum + normalizePaymentAmount(withdrawal.amount), 0));
  const salesTotal = roundCurrency(input.sales.reduce((sum, sale) => sum + normalizePaymentAmount(sale.netTotal), 0));
  const expectedByMethod = input.sales.reduce<Record<string, number>>((acc, sale) => {
    for (const payment of sale.payments) {
      acc[payment.method] = roundCurrency((acc[payment.method] ?? 0) + normalizePaymentAmount(payment.amount));
    }
    return acc;
  }, {});

  for (const method of cashMethods) {
    expectedByMethod[method] = roundCurrency((expectedByMethod[method] ?? 0) + input.initialAmount - withdrawalTotal);
  }

  const methods = new Set([...Object.keys(expectedByMethod), ...Object.keys(input.countedByMethod)]);
  const countedByMethod: Record<string, number> = {};
  const divergenceByMethod: Record<string, number> = {};

  for (const method of methods) {
    countedByMethod[method] = roundCurrency(input.countedByMethod[method] ?? 0);
    divergenceByMethod[method] = roundCurrency(countedByMethod[method] - (expectedByMethod[method] ?? 0));
  }

  const expectedCashTotal = roundCurrency([...cashMethods].reduce((sum, method) => sum + (expectedByMethod[method] ?? 0), 0));
  const countedCashTotal = roundCurrency([...cashMethods].reduce((sum, method) => sum + (countedByMethod[method] ?? 0), 0));
  const status = Object.values(divergenceByMethod).some((value) => value !== 0) ? "divergent" : "balanced";

  return {
    openedAt: input.openedAt,
    closedAt: input.closedAt,
    expectedByMethod,
    countedByMethod,
    divergenceByMethod,
    expectedCashTotal,
    countedCashTotal,
    withdrawalTotal,
    salesTotal,
    status
  };
}

export function renderPdvReceipt(input: PdvReceiptInput): string {
  const width = input.width ?? 42;
  const lines = [
    centerText(input.storeName, width),
    ...(input.address?.trim() ? [centerText(input.address.trim(), width)] : []),
    ...(input.phone?.trim() ? [centerText(`Telefone: ${input.phone.trim()}`, width)] : []),
    centerText(input.documentLabel, width),
    "-".repeat(width),
    `Venda: ${input.sale.number}`,
    `Data: ${input.sale.finalizedAt}`,
    `Operador: ${input.sale.seller}`,
    `Cliente: ${input.sale.customerName}`,
    "-".repeat(width),
    ...input.sale.items.map((item) => renderReceiptLine(item, width)),
    "-".repeat(width),
    receiptAmountLine("TOTAL", input.sale.netTotal, width),
    ...input.sale.payments.map((payment) => receiptAmountLine(payment.method, payment.amount, width)),
    receiptAmountLine("PAGO", input.sale.paymentSummary.paidTotal, width),
    receiptAmountLine("TROCO", input.sale.paymentSummary.changeDue, width),
    "-".repeat(width),
    centerText("Obrigado pela preferencia", width)
  ];

  return `${lines.join("\n")}\n`;
}

export function authorizePdvAction(input: PdvActionAuthorizationInput): PdvActionAuthorization {
  if (!input.operator.active) {
    throw new Error("Operador inativo.");
  }

  const sensitiveRoles = new Set(input.sensitiveRoles ?? ["manager", "admin"]);
  const operatorCanAuthorize = sensitiveRoles.has(input.operator.role);
  const manager = operatorCanAuthorize
    ? input.operator
    : input.users.find((user) => user.active && sensitiveRoles.has(user.role) && user.managerPassword === input.managerPassword);

  if (!manager) {
    throw new Error("Autorizacao de gerente necessaria.");
  }

  return {
    authorizedBy: manager,
    auditLog: {
      id: `AUD-${input.createdAt}-${input.action}`.replace(/\W+/g, "-"),
      action: input.action,
      operatorId: input.operator.id,
      operatorName: input.operator.name,
      authorizedById: manager.id,
      authorizedByName: manager.name,
      reason: input.reason,
      createdAt: input.createdAt
    }
  };
}

export function cancelPdvSale<TProduct extends PdvStockMovementProduct, TCustomer extends PdvSaleCompletionCustomer, TSale extends PdvSaleCancellationDraft>(
  input: CancelPdvSaleInput<TProduct, TCustomer, TSale>
): CancelPdvSaleResult<TProduct, TCustomer, TSale> {
  if (!input.reason.trim()) {
    throw new Error("Informe o motivo do cancelamento.");
  }

  const returnedByProduct = input.sale.items.reduce<Record<string, { productName: string; quantity: number }>>((acc, item) => {
    const current = acc[item.productCode] ?? { productName: item.productName, quantity: 0 };
    acc[item.productCode] = { ...current, quantity: roundStock(current.quantity + item.quantity) };
    return acc;
  }, {});

  const stockMovements: PdvStockMovement[] = [];
  const products = input.products.map((product) => {
    const returned = returnedByProduct[product.productCode];
    if (!returned) return product;
    const stockBefore = roundStock(product.stock);
    const stockAfter = roundStock(stockBefore + returned.quantity);
    stockMovements.push({
      id: `CANCEL-${input.sale.number}-${product.productCode}`,
      productCode: product.productCode,
      productName: product.productName,
      type: "cancellation",
      quantityDelta: returned.quantity,
      reason: input.reason,
      createdAt: input.cancelledAt,
      stockBefore,
      stockAfter
    });
    return { ...product, stock: stockAfter };
  });

  const creditTotal = roundCurrency(input.sale.paymentSummary?.creditTotal ?? input.sale.payments.filter((payment) => payment.method === "A PRAZO").reduce((sum, payment) => sum + normalizePaymentAmount(payment.amount), 0));
  const customer = creditTotal > 0 ? { ...input.customer, creditUsed: roundCurrency(Math.max(input.customer.creditUsed - creditTotal, 0)) } : input.customer;

  return {
    products,
    customer,
    cancelledSale: {
      ...input.sale,
      status: "cancelled",
      cancelledAt: input.cancelledAt,
      cancelReason: input.reason,
      cancelledById: input.operator.id,
      authorizedById: input.authorization.authorizedBy?.id
    },
    stockMovements,
    auditLog: input.authorization.auditLog
  };
}

export function generatePdvDashboardReport<TProduct extends PdvStockMovementProduct>(
  input: PdvDashboardReportInput<TProduct>
): PdvDashboardReport {
  const fromTime = parsePdvTimestamp(input.from);
  const toTime = parsePdvTimestamp(input.to);
  const sales = input.sales.filter((sale) => {
    const time = parsePdvTimestamp(sale.finalizedAt);
    return Number.isFinite(time) && time >= fromTime && time <= toTime;
  });
  const cashClosings = input.cashClosings.filter((closing) => {
    const time = parsePdvTimestamp(closing.closedAt);
    return Number.isFinite(time) && time >= fromTime && time <= toTime;
  });
  const salesTotal = roundCurrency(sales.reduce((sum, sale) => sum + normalizePaymentAmount(sale.netTotal), 0));
  const paymentsByMethod = sales.reduce<Record<string, number>>((acc, sale) => {
    for (const payment of sale.payments) {
      acc[payment.method] = roundCurrency((acc[payment.method] ?? 0) + normalizePaymentAmount(payment.amount));
    }
    return acc;
  }, {});
  const productsByCode = sales.reduce<Record<string, { productCode: string; productName: string; quantity: number; total: number }>>((acc, sale) => {
    for (const item of sale.items) {
      const current = acc[item.productCode] ?? { productCode: item.productCode, productName: item.productName, quantity: 0, total: 0 };
      acc[item.productCode] = {
        ...current,
        quantity: roundStock(current.quantity + item.quantity),
        total: roundCurrency(current.total + normalizePaymentAmount(item.totalPrice))
      };
    }
    return acc;
  }, {});
  const expectedCashTotal = roundCurrency(cashClosings.reduce((sum, closing) => sum + normalizePaymentAmount(closing.expectedCashTotal), 0));
  const countedCashTotal = roundCurrency(cashClosings.reduce((sum, closing) => sum + normalizePaymentAmount(closing.countedCashTotal), 0));

  return {
    from: input.from,
    to: input.to,
    salesCount: sales.length,
    salesTotal,
    averageTicket: sales.length ? roundCurrency(salesTotal / sales.length) : 0,
    paymentsByMethod,
    topProducts: Object.values(productsByCode).sort((a, b) => b.total - a.total).slice(0, 8),
    lowStockAlerts: getPdvLowStockAlerts(input.products),
    cashflow: {
      expectedCashTotal,
      countedCashTotal,
      divergenceTotal: roundCurrency(countedCashTotal - expectedCashTotal),
      divergentClosings: cashClosings.filter((closing) => closing.status === "divergent").length
    }
  };
}

export function parsePdvTimestamp(value: string): number {
  const normalized = value.trim();
  const brazilianDate = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brazilianDate) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = brazilianDate;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
  }
  return Date.parse(normalized);
}

export function filterPdvSalesForCashSession<TSale extends PdvCashSessionSale>(input: {
  openedAt: string;
  closedAt: string;
  sales: TSale[];
}): TSale[] {
  const openedAt = parsePdvTimestamp(input.openedAt);
  const closedAt = parsePdvTimestamp(input.closedAt);

  if (!Number.isFinite(openedAt) || !Number.isFinite(closedAt) || closedAt < openedAt) {
    throw new Error("Periodo de caixa invalido.");
  }

  return input.sales.filter((sale) => {
    const finalizedAt = parsePdvTimestamp(sale.finalizedAt);
    return Number.isFinite(finalizedAt) && finalizedAt >= openedAt && finalizedAt <= closedAt;
  });
}

export function configurePdvTerminal(input: ConfigurePdvTerminalInput): PdvTerminalConfig {
  const terminalId = input.terminalId.trim().replace(/\s+/g, "-").toUpperCase();
  const terminalName = input.terminalName.trim().replace(/\s+/g, " ");

  if (!terminalId) {
    throw new Error("Informe o identificador do caixa.");
  }

  if (!terminalName) {
    throw new Error("Informe o nome do caixa.");
  }

  if (input.mode === "client" && !input.serverUrl?.trim()) {
    throw new Error("Informe o endereco do servidor para caixa cliente.");
  }

  return {
    terminalId,
    terminalName,
    mode: input.mode,
    active: input.active ?? true,
    serverUrl: input.serverUrl?.trim() || undefined
  };
}

export function upsertPdvUser(input: UpsertPdvUserInput): UpsertPdvUserResult {
  if (!input.operator.active || !["manager", "admin"].includes(input.operator.role)) {
    throw new Error("Somente gerente ou administrador pode alterar usuarios.");
  }

  const user = {
    ...input.user,
    id: input.user.id.trim().toUpperCase(),
    name: input.user.name.trim()
  };

  if (!user.id || !user.name) {
    throw new Error("Informe codigo e nome do usuario.");
  }

  const exists = input.users.some((item) => item.id === user.id);
  const users = exists ? input.users.map((item) => item.id === user.id ? user : item) : [...input.users, user];

  return {
    users,
    auditLog: {
      id: `AUD-${input.createdAt}-upsert-user-${user.id}`.replace(/\W+/g, "-"),
      action: "upsert-user",
      operatorId: input.operator.id,
      operatorName: input.operator.name,
      reason: exists ? `Usuario ${user.id} atualizado` : `Usuario ${user.id} criado`,
      createdAt: input.createdAt
    }
  };
}

export function upsertPdvPaymentOption<TPaymentOption extends PdvPaymentOption>(
  input: UpsertPdvPaymentOptionInput<TPaymentOption>
): TPaymentOption[] {
  const name = input.option.name.trim().replace(/\s+/g, " ").toUpperCase();
  if (!name) {
    throw new Error("Informe o nome da forma de pagamento.");
  }

  const option = {
    ...input.option,
    name,
    feePercent: roundCurrency(Math.max(input.option.feePercent, 0)),
    active: input.option.active ?? true
  };
  const exists = input.options.some((item) => normalizePaymentMethodName(item.name) === name);

  return exists
    ? input.options.map((item) => normalizePaymentMethodName(item.name) === name ? option : item)
    : [...input.options, option];
}

export function filterPdvSalesHistory<TSale extends PdvHistorySale>(
  input: FilterPdvSalesHistoryInput<TSale>
): TSale[] {
  const filters = input.filters ?? {};
  const status = filters.status ?? "completed";
  const allSales = [
    ...input.sales.map((sale) => ({ ...sale, status: sale.status ?? "completed" })),
    ...(input.cancelledSales ?? []).map((sale) => ({ ...sale, status: "cancelled" as const }))
  ] as TSale[];
  const from = filters.from ? parsePdvTimestamp(filters.from) : Number.NEGATIVE_INFINITY;
  const to = filters.to ? parsePdvTimestamp(filters.to) : Number.POSITIVE_INFINITY;
  const paymentMethod = filters.paymentMethod ? normalizePaymentMethodName(filters.paymentMethod) : "";
  const query = filters.query?.trim().toLowerCase() ?? "";

  return allSales
    .filter((sale) => {
      const time = parsePdvTimestamp(sale.finalizedAt);
      if (!Number.isFinite(time) || time < from || time > to) return false;
      if (status !== "all" && (sale.status ?? "completed") !== status) return false;
      if (filters.customerId && sale.customerId !== filters.customerId) return false;
      if (paymentMethod && !sale.payments.some((payment) => normalizePaymentMethodName(payment.method) === paymentMethod)) return false;
      if (query && !`${sale.number} ${sale.customerId ?? ""}`.toLowerCase().includes(query)) return false;
      return true;
    })
    .sort((a, b) => parsePdvTimestamp(b.finalizedAt) - parsePdvTimestamp(a.finalizedAt));
}

export function exportPdvReportCsv(input: { rows: PdvReportCsvRow[] }): string {
  const lines = [
    "data;venda;cliente;status;formas;total",
    ...input.rows.map((row) => [
      row.date,
      row.number,
      escapeCsvCell(row.customerName),
      row.status,
      escapeCsvCell(row.paymentMethods),
      roundCurrency(row.total).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ].join(";"))
  ];

  return `${lines.join("\n")}\n`;
}

export function planPdvStorageMigration(input: PdvStorageMigrationPlanInput): PdvStorageMigrationPlan {
  if (!input.isDesktop) {
    return {
      target: "localStorage",
      shouldCopyLocalToSqlite: false,
      shouldKeepLocalFallback: true,
      status: "browser-only"
    };
  }

  if (!input.sqliteAvailable) {
    return {
      target: "localStorage",
      shouldCopyLocalToSqlite: false,
      shouldKeepLocalFallback: true,
      status: "sqlite-unavailable"
    };
  }

  return {
    target: "sqlite",
    shouldCopyLocalToSqlite: input.localSnapshotExists && !input.sqliteSnapshotExists,
    shouldKeepLocalFallback: true,
    status: input.localSnapshotExists && !input.sqliteSnapshotExists ? "migration-required" : "ready"
  };
}

export function resolvePdvTefTransaction(input: PdvTefTransactionInput): PdvTefTransaction {
  const amount = roundCurrency(input.amount);
  const baseId = `${input.createdAt}-${input.saleNumber}-${input.method}-${amount}`.replace(/\W+/g, "-");

  if (!input.enabled) {
    return {
      id: `TEF-${baseId}`,
      provider: input.provider,
      saleNumber: input.saleNumber,
      method: input.method,
      amount,
      status: "disabled",
      authorizationCode: "",
      nsu: "",
      createdAt: input.createdAt,
      message: "Captura externa/manual; pagamento registrado pelo operador."
    };
  }

  if (!input.simulationMode) {
    return {
      id: `TEF-${baseId}`,
      provider: input.provider,
      saleNumber: input.saleNumber,
      method: input.method,
      amount,
      status: "declined",
      authorizationCode: "",
      nsu: "",
      createdAt: input.createdAt,
      message: "TEF real ainda depende da homologacao/configuracao do provedor."
    };
  }

  const authorizationCode = stableNumericCode(`${baseId}-AUTH`, 6);

  return {
    id: `TEF-${baseId}`,
    provider: input.provider,
    saleNumber: input.saleNumber,
    method: input.method,
    amount,
    status: "approved",
    authorizationCode,
    nsu: stableNumericCode(`${baseId}-NSU`, 9),
    createdAt: input.createdAt,
    message: `TEF simulado aprovado (${authorizationCode}).`
  };
}

export function completePdvSale<
  TProduct extends PdvSaleCompletionProduct,
  TCustomer extends PdvSaleCompletionCustomer,
  TSale extends PdvSaleCompletionDraft,
  TCompletedSale
>(
  input: CompletePdvSaleInput<TProduct, TCustomer, TSale, TCompletedSale>
): CompletePdvSaleResult<TProduct, TCustomer, TSale, TCompletedSale> {
  const { sale, products, customer, completedSales, finalizedAt } = input;

  if (!sale.items.length) {
    throw new Error("Adicione pelo menos um item antes de finalizar a venda.");
  }

  const grossTotal = roundCurrency(sale.items.reduce((sum, item) => sum + item.quantity * getLineUnitPrice(item), 0));
  const netTotal = roundCurrency(grossTotal - grossTotal * (sale.discountPercent / 100));
  const availableCredit = Math.max(customer.creditLimit - customer.creditUsed, 0);
  const paymentSummary = resolvePdvPayment({
    total: netTotal,
    payments: sale.payments,
    availableCredit,
    customerName: customer.name
  });

  if (paymentSummary.status === "insufficient") {
    throw new Error(`Pagamento insuficiente. Faltam ${formatCurrency(paymentSummary.remainingTotal)}.`);
  }

  const soldByProduct = sale.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.productCode] = roundStock((acc[item.productCode] ?? 0) + item.quantity);
    return acc;
  }, {});

  for (const [productCode, soldQuantity] of Object.entries(soldByProduct)) {
    const product = products.find((item) => item.productCode === productCode);
    if (!product) {
      throw new Error(`Produto ${productCode} nao encontrado no catalogo.`);
    }

    if (soldQuantity > product.stock) {
      throw new Error(`Estoque insuficiente para ${product.productName}.`);
    }
  }

  const updatedProducts = products.map((product) => {
    const soldQuantity = soldByProduct[product.productCode] ?? 0;
    return soldQuantity ? { ...product, stock: roundStock(product.stock - soldQuantity) } : product;
  });
  const updatedCustomer = paymentSummary.creditTotal ? { ...customer, creditUsed: roundCurrency(customer.creditUsed + paymentSummary.creditTotal) } : customer;
  const completedSale = { ...sale, finalizedAt, netTotal, paymentSummary };
  const maxCompletedSales = input.maxCompletedSales ?? 100;

  return {
    products: updatedProducts,
    customer: updatedCustomer,
    completedSale,
    completedSales: [completedSale, ...completedSales].slice(0, maxCompletedSales)
  };
}

export function verifyPdvUserPassword(input: PdvUserPasswordVerificationInput): PdvUserPasswordVerification {
  if (!input.user.active) {
    return { ok: false, reason: "inactive-user" };
  }

  const expectedPassword = input.user.password ?? input.user.managerPassword;
  if (!expectedPassword) {
    return { ok: false, reason: "missing-password" };
  }

  return expectedPassword === input.password
    ? { ok: true, reason: "authenticated" }
    : { ok: false, reason: "invalid-password" };
}

export function createPdvAutoBackup(input: CreatePdvAutoBackupInput): PdvAutoBackup[] {
  if (!input.snapshotJson.trim()) {
    throw new Error("Snapshot do backup nao pode ser vazio.");
  }

  const retention = Math.max(Math.floor(input.retention), 1);
  const backup: PdvAutoBackup = {
    id: `BKP-${input.createdAt.replace(/\W+/g, "-").replace(/-$/, "")}`,
    createdAt: input.createdAt,
    reason: input.reason,
    snapshotJson: input.snapshotJson
  };

  return [backup, ...input.backups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, retention);
}

export function createPdvTefProviderRequest(input: PdvTefProviderRequestInput): PdvTefProviderRequest {
  const url = input.endpointUrl.trim();
  if (!url) {
    throw new Error("Informe a URL da ponte TEF/maquininha.");
  }

  return {
    url,
    expectedStatus: "pending-provider",
    payload: {
      provider: input.provider,
      merchantCode: input.merchantCode,
      saleNumber: input.saleNumber,
      method: input.method,
      amount: roundCurrency(input.amount),
      captureMode: "card-present",
      createdAt: input.createdAt
    }
  };
}

function getLineUnitPrice(item: PdvSaleCompletionLine) {
  const withPrice = item as PdvSaleCompletionLine & { unitPrice?: number; totalPrice?: number };

  if (typeof withPrice.totalPrice === "number") {
    return withPrice.quantity > 0 ? withPrice.totalPrice / withPrice.quantity : 0;
  }

  return withPrice.unitPrice ?? 0;
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function normalizePaymentAmount(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizePaymentMethodName(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function roundStock(value: number) {
  return Number(value.toFixed(3));
}

function centerText(value: string, width: number) {
  const text = value.slice(0, width);
  const left = Math.max(Math.floor((width - text.length) / 2), 0);
  return `${" ".repeat(left)}${text}`;
}

function renderReceiptLine(item: PdvReceiptSale["items"][number], width: number) {
  const quantity = `${item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${item.unitLabel}`;
  const value = formatCurrencyAscii(item.totalPrice);
  const nameLine = item.productName.slice(0, width);
  const detail = `${quantity} x ${formatCurrencyAscii(item.unitPrice)}`;
  return `${nameLine}\n${fitReceiptColumns(detail, value, width)}`;
}

function receiptAmountLine(label: string, value: number, width: number) {
  return fitReceiptColumns(label, formatCurrencyAscii(value), width);
}

function fitReceiptColumns(left: string, right: string, width: number) {
  const rightText = right.slice(0, width);
  const leftWidth = Math.max(width - rightText.length - 1, 0);
  return `${left.slice(0, leftWidth).padEnd(leftWidth, " ")} ${rightText}`;
}

function formatCurrencyAscii(value: number) {
  return `R$ ${roundCurrency(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeCsvCell(value: string) {
  const text = value.replace(/"/g, '""');
  return /[;\n"]/.test(text) ? `"${text}"` : text;
}

function stableNumericCode(seed: string, length: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return String(hash).padStart(length, "0").slice(-length);
}

function normalizePdvLocalStore<
  TProduct,
  TCustomer,
  TCompletedSale,
  TCashSession,
  TPaymentOption,
  TDeviceConfig
>(
  candidate: unknown,
  defaults: PdvLocalStoreDefaults<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig>,
  updatedAt: string
): PdvLocalStore<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig> {
  if (!candidate || typeof candidate !== "object") {
    return createDefaultPdvLocalStore(defaults, updatedAt);
  }

  const store = candidate as Partial<PdvLocalStore<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig>>;

  return {
    version: PDV_LOCAL_STORE_VERSION,
    updatedAt: typeof store.updatedAt === "string" ? store.updatedAt : updatedAt,
    catalogProducts: normalizeArray(store.catalogProducts, defaults.catalogProducts),
    registeredCustomers: normalizeArray(store.registeredCustomers, defaults.registeredCustomers),
    completedSales: Array.isArray(store.completedSales) ? store.completedSales : defaults.completedSales,
    cashSession: store.cashSession === undefined ? defaults.cashSession : store.cashSession,
    paymentOptions: Array.isArray(store.paymentOptions) ? store.paymentOptions : defaults.paymentOptions,
    deviceConfig: store.deviceConfig ?? defaults.deviceConfig,
    extensions: store.extensions ?? defaults.extensions
  };
}

function normalizeArray<T>(value: unknown, fallback: T[]) {
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

function migrateLegacyPdvLocalStore<
  TProduct,
  TCustomer,
  TCompletedSale,
  TCashSession,
  TPaymentOption,
  TDeviceConfig
>(
  storage: PdvKeyValueStorage,
  defaults: PdvLocalStoreDefaults<TProduct, TCustomer, TCompletedSale, TCashSession, TPaymentOption, TDeviceConfig>,
  legacyKeys: PdvLegacyStorageKeys | undefined,
  updatedAt: string
) {
  if (!legacyKeys) {
    return createDefaultPdvLocalStore(defaults, updatedAt);
  }

  return createDefaultPdvLocalStore(
    {
      catalogProducts: readLegacyValue(storage, legacyKeys.catalogProducts, defaults.catalogProducts),
      registeredCustomers: readLegacyValue(storage, legacyKeys.registeredCustomers, defaults.registeredCustomers),
      completedSales: readLegacyValue(storage, legacyKeys.completedSales, defaults.completedSales),
      cashSession: readLegacyValue(storage, legacyKeys.cashSession, defaults.cashSession),
      paymentOptions: readLegacyValue(storage, legacyKeys.paymentOptions, defaults.paymentOptions),
      deviceConfig: readLegacyValue(storage, legacyKeys.deviceConfig, defaults.deviceConfig)
    },
    updatedAt
  );
}

function readLegacyValue<T>(storage: PdvKeyValueStorage, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  return raw ? parseJson(raw, fallback) : fallback;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function parseStrictJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Arquivo de backup invalido ou corrompido.");
  }
}
