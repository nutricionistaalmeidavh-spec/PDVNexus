import { defineModule } from "@nexus-core/core";

export type WorkshopOrderStatus = "entrada" | "diagnostico" | "execucao" | "finalizacao";
export type WorkshopPriority = "Alta" | "Media" | "Baixa";
export type WorkshopLineKind = "servico" | "peca";
export type WorkshopPaymentStatus = "aberto" | "pago";
export type WorkshopUserRole = "admin" | "atendente" | "tecnico";
export type WorkshopPermission = "orders:write" | "customers:write" | "vehicles:write" | "stock:write" | "finance:write" | "documents:manage" | "settings:manage" | "users:manage";

export interface WorkshopCustomer {
  id: string;
  name: string;
  document: string;
  phone: string;
  email?: string;
  address?: string;
  active: boolean;
}

export interface WorkshopVehicle {
  id: string;
  customerId: string;
  model: string;
  plate: string;
  year: string;
  mileage: number;
}

export interface WorkshopStockItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  supplier: string;
}

export interface WorkshopService {
  id: string;
  name: string;
  price: number;
  category: string;
}

export interface WorkshopOrderLine {
  id: string;
  name: string;
  kind: WorkshopLineKind;
  quantity: number;
  unitPrice: number;
  stockItemId?: string;
}

export interface WorkshopPayment {
  method: string;
  amount: number;
  paidAt: string;
}

export interface WorkshopServiceOrder {
  id: string;
  vehicleId: string;
  customerId: string;
  technicianId: string;
  delivery: string;
  status: WorkshopOrderStatus;
  priority: WorkshopPriority;
  complaint: string;
  diagnosis: string;
  lines: WorkshopOrderLine[];
  stockApplied: boolean;
  paymentStatus: WorkshopPaymentStatus;
  payments: WorkshopPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopUser {
  id: string;
  name: string;
  role: WorkshopUserRole;
  active: boolean;
  password?: string;
}

export interface WorkshopSettings {
  shopName: string;
  document: string;
  phone: string;
  address: string;
  backupRetention: number;
}

export interface WorkshopSnapshot {
  version: number;
  updatedAt: string;
  customers: WorkshopCustomer[];
  vehicles: WorkshopVehicle[];
  stockItems: WorkshopStockItem[];
  services: WorkshopService[];
  orders: WorkshopServiceOrder[];
  users: WorkshopUser[];
  settings: WorkshopSettings;
}

export interface WorkshopStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface WorkshopFinancialSummary {
  openOrders: number;
  completedOrders: number;
  openAmount: number;
  paidAmount: number;
  totalAmount: number;
  lowStockCount: number;
}

export const oficinaModule = defineModule({
  key: "oficina",
  name: "Oficina",
  description: "Ordens de servico, clientes, veiculos, estoque, documentos e financeiro para oficinas.",
  routes: [
    { key: "ordens", label: "Ordens", path: "/ordens", icon: "OS" },
    { key: "clientes", label: "Clientes", path: "/clientes", icon: "CL" },
    { key: "veiculos", label: "Veiculos", path: "/veiculos", icon: "VE" },
    { key: "estoque", label: "Estoque", path: "/estoque", icon: "ES" },
    { key: "financeiro", label: "Financeiro", path: "/financeiro", icon: "FI" }
  ],
  entities: ["serviceOrder", "customer", "vehicle", "stockItem", "service", "payment", "user"],
  reusable: true
});

export const WORKSHOP_STORE_VERSION = 1;
export const DEFAULT_WORKSHOP_STORE_KEY = "workshop-software:store:v1";

export const workshopCustomersSeed: WorkshopCustomer[] = [
  { id: "CLI-001", name: "Marcos Paulo Oliveira", document: "123.456.789-00", phone: "(12) 98888-1200", email: "marcos@email.com", active: true },
  { id: "CLI-002", name: "Patricia M. Souza", document: "234.567.890-11", phone: "(12) 97777-3311", active: true },
  { id: "CLI-003", name: "Fernando Costa", document: "345.678.901-22", phone: "(12) 96666-4433", active: true },
  { id: "CLI-004", name: "Carla Mendes", document: "456.789.012-33", phone: "(12) 95555-5544", active: true },
  { id: "CLI-005", name: "Renato Tavares", document: "567.890.123-44", phone: "(12) 94444-6655", active: true },
  { id: "CLI-006", name: "Juliana Lima", document: "678.901.234-55", phone: "(12) 93333-7766", active: true }
];

export const workshopVehiclesSeed: WorkshopVehicle[] = [
  { id: "VEI-001", customerId: "CLI-001", model: "Honda Civic EXL 2016", plate: "FQX-1D23", year: "2016", mileage: 98200 },
  { id: "VEI-002", customerId: "CLI-002", model: "Ford Ka SE 2018", plate: "QWE-8A45", year: "2018", mileage: 74120 },
  { id: "VEI-003", customerId: "CLI-003", model: "VW Polo Comfortline 2020", plate: "RQA-2B56", year: "2020", mileage: 41890 },
  { id: "VEI-004", customerId: "CLI-004", model: "Chevrolet Onix LT 2019", plate: "GHI-7C89", year: "2019", mileage: 63600 },
  { id: "VEI-005", customerId: "CLI-005", model: "Jeep Compass Limited 2018", plate: "BDR-4E21", year: "2018", mileage: 88210 },
  { id: "VEI-006", customerId: "CLI-006", model: "Toyota Corolla XEI 2017", plate: "BCV-3F11", year: "2017", mileage: 105430 }
];

export const workshopStockSeed: WorkshopStockItem[] = [
  { id: "PEC-001", sku: "OL-5W30", name: "Oleo motor 5W30", stock: 14, minStock: 5, cost: 33, price: 49.9, supplier: "Distribuidora Vale" },
  { id: "PEC-002", sku: "FIL-PSL55", name: "Filtro de oleo PSL55", stock: 9, minStock: 4, cost: 19, price: 31.5, supplier: "Autopecas Central" },
  { id: "PEC-003", sku: "FR-PD", name: "Pastilha de freio dianteira", stock: 3, minStock: 6, cost: 118, price: 185, supplier: "Freios Brasil" },
  { id: "PEC-004", sku: "COR-KIT", name: "Kit correia dentada", stock: 4, minStock: 3, cost: 248, price: 342, supplier: "Autopecas Central" },
  { id: "PEC-005", sku: "SUS-AMD", name: "Amortecedor dianteiro", stock: 8, minStock: 4, cost: 221, price: 298, supplier: "Suspensao Forte" }
];

export const workshopServicesSeed: WorkshopService[] = [
  { id: "SRV-001", name: "Revisao de freios", price: 280, category: "Freios" },
  { id: "SRV-002", name: "Troca de oleo", price: 120, category: "Motor" },
  { id: "SRV-003", name: "Diagnostico eletrico", price: 180, category: "Eletrica" },
  { id: "SRV-004", name: "Avaliacao de embreagem", price: 160, category: "Transmissao" },
  { id: "SRV-005", name: "Troca de amortecedor", price: 240, category: "Suspensao" },
  { id: "SRV-006", name: "Alinhamento e balanceamento", price: 160, category: "Rodas" }
];

export const workshopUsersSeed: WorkshopUser[] = [
  { id: "USR-001", name: "Marcos Silva", role: "admin", active: true, password: "1234" },
  { id: "USR-002", name: "Joao Santos", role: "tecnico", active: true, password: "1234" },
  { id: "USR-003", name: "Lucas Ferreira", role: "tecnico", active: true, password: "1234" },
  { id: "USR-004", name: "Ana Beatriz", role: "tecnico", active: true, password: "1234" }
];

export const defaultWorkshopSettings: WorkshopSettings = {
  shopName: "Sistema para Oficina",
  document: "Documento nao informado",
  phone: "(00) 00000-0000",
  address: "Endereco nao informado",
  backupRetention: 14
};

const rolePermissions: Record<WorkshopUserRole, WorkshopPermission[]> = {
  admin: ["orders:write", "customers:write", "vehicles:write", "stock:write", "finance:write", "documents:manage", "settings:manage", "users:manage"],
  atendente: ["orders:write", "customers:write", "vehicles:write", "documents:manage"],
  tecnico: ["orders:write"]
};

export function hasWorkshopPermission(user: WorkshopUser | undefined, permission: WorkshopPermission) {
  return Boolean(user?.active && rolePermissions[user.role].includes(permission));
}

export function verifyWorkshopUserPassword(user: WorkshopUser | undefined, password: string) {
  return Boolean(user?.active && user.password && password === user.password);
}

export const workshopOrdersSeed: WorkshopServiceOrder[] = [
  makeOrder("OS-000125", "VEI-001", "CLI-001", "USR-002", "24/05 15:00", "entrada", "Alta", "Revisao de freios", "Ruido ao frear", [serviceLine("Revisao de freios", 280), partLine("PEC-003", "Pastilha de freio dianteira", 1, 185)]),
  makeOrder("OS-000126", "VEI-002", "CLI-002", "USR-003", "24/05 17:30", "entrada", "Baixa", "Troca de oleo", "Troca preventiva", [serviceLine("Troca de oleo", 120), partLine("PEC-001", "Oleo motor 5W30", 4, 49.9), partLine("PEC-002", "Filtro de oleo PSL55", 1, 31.5)]),
  makeOrder("OS-000123", "VEI-003", "CLI-003", "USR-002", "24/05 11:00", "diagnostico", "Media", "Diagnostico eletrico", "Luz da injecao acesa", [serviceLine("Diagnostico eletrico", 180)]),
  makeOrder("OS-000124", "VEI-004", "CLI-004", "USR-004", "24/05 16:00", "diagnostico", "Alta", "Embreagem", "Pedal pesado", [serviceLine("Avaliacao de embreagem", 160)]),
  makeOrder("OS-000121", "VEI-005", "CLI-005", "USR-003", "24/05 14:00", "execucao", "Alta", "Suspensao dianteira", "Batida seca na dianteira", [serviceLine("Troca de amortecedor", 240), partLine("PEC-005", "Amortecedor dianteiro", 2, 298)]),
  makeOrder("OS-000122", "VEI-006", "CLI-006", "USR-002", "24/05 18:00", "execucao", "Media", "Alinhamento e balanceamento", "Volante puxando", [serviceLine("Alinhamento e balanceamento", 160)]),
  makeOrder("OS-000120", "VEI-001", "CLI-001", "USR-004", "24/05 10:30", "finalizacao", "Baixa", "Revisao 40.000 km", "Revisao completa", [serviceLine("Revisao 40.000 km", 340), partLine("PEC-001", "Oleo motor 5W30", 5, 49.9)], true)
];

export const defaultWorkshopSnapshot = createWorkshopSnapshot();

export function createWorkshopSnapshot(input: Partial<Omit<WorkshopSnapshot, "version" | "updatedAt">> = {}, updatedAt = new Date().toISOString()): WorkshopSnapshot {
  return {
    version: WORKSHOP_STORE_VERSION,
    updatedAt,
    customers: input.customers ?? workshopCustomersSeed,
    vehicles: input.vehicles ?? workshopVehiclesSeed,
    stockItems: input.stockItems ?? workshopStockSeed,
    services: input.services ?? workshopServicesSeed,
    orders: input.orders ?? workshopOrdersSeed,
    users: input.users ?? workshopUsersSeed,
    settings: input.settings ?? defaultWorkshopSettings
  };
}

export function createBrowserWorkshopRepository(options: { storage: WorkshopStorage; storeKey?: string; defaults?: WorkshopSnapshot; now?: () => string }) {
  const storeKey = options.storeKey ?? DEFAULT_WORKSHOP_STORE_KEY;
  const defaults = options.defaults ?? defaultWorkshopSnapshot;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    load() {
      const raw = options.storage.getItem(storeKey);
      if (!raw) {
        options.storage.setItem(storeKey, JSON.stringify(defaults));
        return defaults;
      }
      return normalizeWorkshopSnapshot(parseJson(raw, defaults), defaults, now());
    },
    save(next: WorkshopSnapshot) {
      const snapshot = normalizeWorkshopSnapshot(next, defaults, now());
      options.storage.setItem(storeKey, JSON.stringify(snapshot));
      return snapshot;
    },
    patch(patch: Partial<Omit<WorkshopSnapshot, "version" | "updatedAt">>) {
      const current = this.load();
      const next = createWorkshopSnapshot({ ...current, ...patch }, now());
      options.storage.setItem(storeKey, JSON.stringify(next));
      return next;
    },
    exportSnapshot() {
      return JSON.stringify(this.load(), null, 2);
    },
    importSnapshot(raw: string) {
      const parsed = parseStrictJson(raw);
      const next = normalizeWorkshopSnapshot(parsed, defaults, now());
      options.storage.setItem(storeKey, JSON.stringify(next));
      return next;
    },
    clear() {
      options.storage.removeItem(storeKey);
    }
  };
}

export function getOrderTotal(order: WorkshopServiceOrder) {
  return roundCurrency(order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
}

export function getOrderPaidTotal(order: WorkshopServiceOrder) {
  return roundCurrency(order.payments.reduce((sum, payment) => sum + payment.amount, 0));
}

export function getOrderBalance(order: WorkshopServiceOrder) {
  return roundCurrency(Math.max(getOrderTotal(order) - getOrderPaidTotal(order), 0));
}

export function getLowStockItems(items: WorkshopStockItem[]) {
  return items.filter((item) => item.stock <= item.minStock);
}

export function addPartToOrder(order: WorkshopServiceOrder, part: WorkshopStockItem, quantity = 1): WorkshopServiceOrder {
  if (quantity <= 0) {
    throw new Error("Quantidade deve ser maior que zero.");
  }
  if (quantity > part.stock && !order.stockApplied) {
    throw new Error(`Estoque insuficiente para ${part.name}.`);
  }
  return {
    ...order,
    lines: [...order.lines, partLine(part.id, part.name, quantity, part.price)],
    updatedAt: new Date().toISOString()
  };
}

export function moveWorkshopOrder(input: { order: WorkshopServiceOrder; stockItems: WorkshopStockItem[]; nextStatus: WorkshopOrderStatus }) {
  const shouldApplyStock = input.nextStatus === "finalizacao" && !input.order.stockApplied;
  const order = {
    ...input.order,
    status: input.nextStatus,
    stockApplied: input.order.stockApplied || shouldApplyStock,
    updatedAt: new Date().toISOString()
  };

  if (!shouldApplyStock) {
    return { order, stockItems: input.stockItems, lowStockItems: getLowStockItems(input.stockItems) };
  }

  const stockItems = applyOrderStockUsage(input.stockItems, input.order);
  return { order, stockItems, lowStockItems: getLowStockItems(stockItems) };
}

export function applyOrderStockUsage(stockItems: WorkshopStockItem[], order: WorkshopServiceOrder) {
  return stockItems.map((item) => {
    const used = order.lines
      .filter((line) => line.kind === "peca" && line.stockItemId === item.id)
      .reduce((sum, line) => sum + line.quantity, 0);
    return used ? { ...item, stock: roundStock(Math.max(0, item.stock - used)) } : item;
  });
}

export function registerOrderPayment(order: WorkshopServiceOrder, payment: Omit<WorkshopPayment, "paidAt">, paidAt = new Date().toISOString()): WorkshopServiceOrder {
  if (payment.amount <= 0) {
    throw new Error("Valor do pagamento deve ser maior que zero.");
  }
  const payments = [...order.payments, { ...payment, paidAt }];
  const nextOrder = { ...order, payments, updatedAt: paidAt };
  return {
    ...nextOrder,
    paymentStatus: getOrderBalance(nextOrder) <= 0 ? "pago" : "aberto"
  };
}

export function buildWorkshopFinancialSummary(snapshot: WorkshopSnapshot): WorkshopFinancialSummary {
  const completedOrders = snapshot.orders.filter((order) => order.status === "finalizacao");
  const totalAmount = roundCurrency(completedOrders.reduce((sum, order) => sum + getOrderTotal(order), 0));
  const paidAmount = roundCurrency(completedOrders.reduce((sum, order) => sum + getOrderPaidTotal(order), 0));
  return {
    openOrders: snapshot.orders.filter((order) => order.status !== "finalizacao").length,
    completedOrders: completedOrders.length,
    openAmount: roundCurrency(totalAmount - paidAmount),
    paidAmount,
    totalAmount,
    lowStockCount: getLowStockItems(snapshot.stockItems).length
  };
}

export function renderServiceOrderDocument(input: {
  order: WorkshopServiceOrder;
  customer: WorkshopCustomer;
  vehicle: WorkshopVehicle;
  technician: WorkshopUser;
  settings: WorkshopSettings;
}) {
  const total = getOrderTotal(input.order);
  const lines = input.order.lines.map((line) => {
    const subtotal = line.quantity * line.unitPrice;
    return `${line.kind.toUpperCase().padEnd(7)} ${line.name} - ${line.quantity} x ${formatCurrencyAscii(line.unitPrice)} = ${formatCurrencyAscii(subtotal)}`;
  });

  return [
    input.settings.shopName,
    input.settings.document,
    input.settings.phone,
    input.settings.address,
    "",
    `ORDEM DE SERVICO ${input.order.id}`,
    `Status: ${statusLabel(input.order.status)} | Prioridade: ${input.order.priority}`,
    `Cliente: ${input.customer.name}`,
    `Veiculo: ${input.vehicle.model} | Placa: ${input.vehicle.plate} | KM: ${input.vehicle.mileage.toLocaleString("pt-BR")}`,
    `Tecnico: ${input.technician.name}`,
    `Entrega prevista: ${input.order.delivery}`,
    "",
    `Relato: ${input.order.complaint}`,
    `Diagnostico: ${input.order.diagnosis || "A preencher"}`,
    "",
    "SERVICOS E PECAS",
    ...lines,
    "",
    `Total: ${formatCurrencyAscii(total)}`,
    `Pago: ${formatCurrencyAscii(getOrderPaidTotal(input.order))}`,
    `Saldo: ${formatCurrencyAscii(getOrderBalance(input.order))}`,
    "",
    "Assinatura do cliente: ______________________________"
  ].join("\n");
}

export function statusLabel(status: WorkshopOrderStatus) {
  return ({ entrada: "Entrada", diagnostico: "Diagnostico", execucao: "Em execucao", finalizacao: "Finalizacao" })[status];
}

export function nextStatus(status: WorkshopOrderStatus): WorkshopOrderStatus | null {
  const transitions: Record<WorkshopOrderStatus, WorkshopOrderStatus | null> = {
    entrada: "diagnostico",
    diagnostico: "execucao",
    execucao: "finalizacao",
    finalizacao: null
  };
  return transitions[status];
}

export function formatWorkshopOrderId(id: string) {
  const digits = id.replace(/\D/g, "");
  return `OS #${digits.padStart(6, "0")}`;
}

export function createOrderNumber(orders: WorkshopServiceOrder[]) {
  const sequence = Math.max(...orders.map((order) => Number(order.id.replace(/\D/g, ""))).filter(Number.isFinite), 120) + 1;
  return `OS-${String(sequence).padStart(6, "0")}`;
}

export function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "OF";
}

export function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function makeOrder(
  id: string,
  vehicleId: string,
  customerId: string,
  technicianId: string,
  delivery: string,
  status: WorkshopOrderStatus,
  priority: WorkshopPriority,
  complaint: string,
  diagnosis: string,
  lines: WorkshopOrderLine[],
  stockApplied = false
): WorkshopServiceOrder {
  return {
    id,
    vehicleId,
    customerId,
    technicianId,
    delivery,
    status,
    priority,
    complaint,
    diagnosis,
    lines,
    stockApplied,
    paymentStatus: "aberto",
    payments: [],
    createdAt: "2026-05-24T09:00:00.000Z",
    updatedAt: "2026-05-24T09:00:00.000Z"
  };
}

function serviceLine(name: string, unitPrice: number): WorkshopOrderLine {
  return { id: `SRV-${slug(name)}-${unitPrice}`, name, kind: "servico", quantity: 1, unitPrice };
}

function partLine(stockItemId: string, name: string, quantity: number, unitPrice: number): WorkshopOrderLine {
  return { id: `PEC-${stockItemId}-${Date.now()}-${Math.round(Math.random() * 10000)}`, stockItemId, name, kind: "peca", quantity, unitPrice };
}

function normalizeWorkshopSnapshot(candidate: unknown, defaults: WorkshopSnapshot, updatedAt: string): WorkshopSnapshot {
  if (!candidate || typeof candidate !== "object") {
    return defaults;
  }
  const value = candidate as Partial<WorkshopSnapshot>;
  return {
    version: WORKSHOP_STORE_VERSION,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : updatedAt,
    customers: normalizeArray(value.customers, defaults.customers),
    vehicles: normalizeArray(value.vehicles, defaults.vehicles),
    stockItems: normalizeArray(value.stockItems, defaults.stockItems),
    services: normalizeArray(value.services, defaults.services),
    orders: normalizeArray(value.orders, defaults.orders),
    users: normalizeArray(value.users, defaults.users),
    settings: { ...defaults.settings, ...(value.settings ?? {}) }
  };
}

function normalizeArray<T>(value: unknown, fallback: T[]) {
  return Array.isArray(value) ? value as T[] : fallback;
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
    throw new Error("Arquivo de backup invalido.");
  }
}

function formatCurrencyAscii(value: number) {
  return `R$ ${roundCurrency(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function roundStock(value: number) {
  return Number(value.toFixed(3));
}

function slug(value: string) {
  return value.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "");
}
