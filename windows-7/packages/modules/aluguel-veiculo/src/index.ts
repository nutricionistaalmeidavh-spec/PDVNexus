import { defineModule } from "@nexus-core/core";

export type RentalStatus = "reserva" | "retirada" | "em_uso" | "devolucao";
export type RentalPriority = "Alta" | "Media" | "Baixa";
export type RentalPaymentStatus = "aberto" | "pago";
export type RentalUserRole = "admin" | "atendente" | "vistoriador";
export type VehicleAvailability = "disponivel" | "reservado" | "locado" | "manutencao";

export interface RentalCustomer {
  id: string;
  name: string;
  document: string;
  phone: string;
  email?: string;
  address?: string;
  active: boolean;
}

export interface RentalVehicle {
  id: string;
  model: string;
  plate: string;
  year: string;
  mileage: number;
  category: string;
  color: string;
  dailyRate: number;
  purchasePrice: number;
  availability: VehicleAvailability;
}

export interface RentalLine {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface RentalPayment {
  method: string;
  amount: number;
  paidAt: string;
}

export interface VehicleRental {
  id: string;
  vehicleId: string;
  customerId: string;
  attendantId: string;
  pickupDate: string;
  returnDate: string;
  status: RentalStatus;
  priority: RentalPriority;
  notes: string;
  checkoutChecklist: string[];
  lines: RentalLine[];
  paymentStatus: RentalPaymentStatus;
  payments: RentalPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface RentalUser {
  id: string;
  name: string;
  role: RentalUserRole;
  active: boolean;
  password?: string;
}

export interface RentalExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  paid: boolean;
}

export interface RentalSettings {
  companyName: string;
  document: string;
  phone: string;
  address: string;
}

export interface RentalSnapshot {
  version: number;
  updatedAt: string;
  customers: RentalCustomer[];
  vehicles: RentalVehicle[];
  rentals: VehicleRental[];
  expenses: RentalExpense[];
  users: RentalUser[];
  settings: RentalSettings;
}

export interface RentalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RentalFinancialSummary {
  openRentals: number;
  completedRentals: number;
  grossRevenue: number;
  paidAmount: number;
  openAmount: number;
  expensesAmount: number;
  netResult: number;
  availableVehicles: number;
  rentedVehicles: number;
}

export const aluguelVeiculoModule = defineModule({
  key: "aluguel-veiculo",
  name: "Aluguel de Veiculo",
  description: "Frota, reservas, locacoes, checklist, documentos e financeiro para locadoras de veiculos.",
  routes: [
    { key: "locacoes", label: "Locacoes", path: "/locacoes", icon: "LC" },
    { key: "clientes", label: "Clientes", path: "/clientes", icon: "CL" },
    { key: "frota", label: "Frota", path: "/frota", icon: "FR" },
    { key: "financeiro", label: "Financeiro", path: "/financeiro", icon: "FI" },
    { key: "documentos", label: "Documentos", path: "/documentos", icon: "DO" }
  ],
  entities: ["rental", "customer", "vehicle", "expense", "payment", "document", "user"],
  reusable: true
});

export const RENTAL_STORE_VERSION = 1;
export const DEFAULT_RENTAL_STORE_KEY = "aluguel-veiculo:store:v1";

export const rentalCustomersSeed: RentalCustomer[] = [
  { id: "CLI-001", name: "Marina Lopes", document: "123.456.789-00", phone: "(11) 98888-1200", email: "marina@email.com", active: true },
  { id: "CLI-002", name: "Rafael Nunes", document: "234.567.890-11", phone: "(11) 97777-3311", active: true },
  { id: "CLI-003", name: "Construtora Prado Ltda", document: "12.345.678/0001-90", phone: "(11) 96666-4433", active: true },
  { id: "CLI-004", name: "Camila Duarte", document: "456.789.012-33", phone: "(11) 95555-5544", active: true },
  { id: "CLI-005", name: "LogMais Entregas", document: "98.765.432/0001-10", phone: "(11) 94444-6655", active: true }
];

export const rentalVehiclesSeed: RentalVehicle[] = [
  { id: "VEI-001", model: "Fiat Mobi Like", plate: "FRT-1D23", year: "2024", mileage: 18200, category: "Economico", color: "Branco", dailyRate: 119.9, purchasePrice: 68800, availability: "locado" },
  { id: "VEI-002", model: "Hyundai HB20 Sense", plate: "RNT-8A45", year: "2025", mileage: 7120, category: "Compacto", color: "Prata", dailyRate: 149.9, purchasePrice: 84200, availability: "reservado" },
  { id: "VEI-003", model: "Chevrolet Onix LT", plate: "ALU-2B56", year: "2024", mileage: 11890, category: "Compacto", color: "Preto", dailyRate: 159.9, purchasePrice: 88900, availability: "disponivel" },
  { id: "VEI-004", model: "Jeep Renegade Sport", plate: "CAR-7C89", year: "2023", mileage: 33600, category: "SUV", color: "Cinza", dailyRate: 249.9, purchasePrice: 118000, availability: "locado" },
  { id: "VEI-005", model: "Toyota Corolla XEI", plate: "MOV-4E21", year: "2024", mileage: 13210, category: "Executivo", color: "Prata", dailyRate: 289.9, purchasePrice: 154000, availability: "disponivel" },
  { id: "VEI-006", model: "Renault Master Furgao", plate: "VAN-3F11", year: "2022", mileage: 65430, category: "Utilitario", color: "Branco", dailyRate: 329.9, purchasePrice: 179000, availability: "manutencao" }
];

export const rentalUsersSeed: RentalUser[] = [
  { id: "USR-001", name: "Paulo Mendes", role: "admin", active: true, password: "1234" },
  { id: "USR-002", name: "Bianca Castro", role: "atendente", active: true },
  { id: "USR-003", name: "Leo Martins", role: "vistoriador", active: true }
];

export const rentalExpensesSeed: RentalExpense[] = [
  { id: "DES-001", description: "Seguro frota", category: "Seguro", amount: 4280, dueDate: "05/08/2026", paid: true },
  { id: "DES-002", description: "Manutencao preventiva", category: "Manutencao", amount: 1850, dueDate: "12/08/2026", paid: true },
  { id: "DES-003", description: "Rastreamento veicular", category: "Tecnologia", amount: 690, dueDate: "18/08/2026", paid: false }
];

export const defaultRentalSettings: RentalSettings = {
  companyName: "Locadora Laranja",
  document: "Documento nao informado",
  phone: "(00) 00000-0000",
  address: "Endereco nao informado"
};

export const rentalRentalsSeed: VehicleRental[] = [
  makeRental("LOC-000412", "VEI-001", "CLI-001", "USR-002", "13/08 09:00", "17/08 18:00", "em_uso", "Media", "Cliente solicitou cadeirinha infantil.", 4, 119.9, true),
  makeRental("LOC-000413", "VEI-002", "CLI-002", "USR-002", "14/08 10:00", "16/08 18:00", "reserva", "Baixa", "Retirada na loja aeroporto.", 2, 149.9),
  makeRental("LOC-000409", "VEI-004", "CLI-003", "USR-003", "10/08 08:00", "20/08 18:00", "retirada", "Alta", "Contrato mensal corporativo em negociacao.", 10, 249.9, true),
  makeRental("LOC-000410", "VEI-005", "CLI-004", "USR-002", "08/08 11:00", "11/08 17:00", "devolucao", "Media", "Devolucao concluida sem avarias.", 3, 289.9, true)
];

export const defaultRentalSnapshot = createRentalSnapshot();

export function createRentalSnapshot(input: Partial<Omit<RentalSnapshot, "version" | "updatedAt">> = {}, updatedAt = new Date().toISOString()): RentalSnapshot {
  return {
    version: RENTAL_STORE_VERSION,
    updatedAt,
    customers: input.customers ?? rentalCustomersSeed,
    vehicles: input.vehicles ?? rentalVehiclesSeed,
    rentals: input.rentals ?? rentalRentalsSeed,
    expenses: input.expenses ?? rentalExpensesSeed,
    users: input.users ?? rentalUsersSeed,
    settings: input.settings ?? defaultRentalSettings
  };
}

export function createBrowserRentalRepository(options: { storage: RentalStorage; storeKey?: string; defaults?: RentalSnapshot; now?: () => string }) {
  const storeKey = options.storeKey ?? DEFAULT_RENTAL_STORE_KEY;
  const defaults = options.defaults ?? defaultRentalSnapshot;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    load() {
      const raw = options.storage.getItem(storeKey);
      if (!raw) {
        options.storage.setItem(storeKey, JSON.stringify(defaults));
        return defaults;
      }
      return normalizeRentalSnapshot(parseJson(raw, defaults), defaults, now());
    },
    save(next: RentalSnapshot) {
      const snapshot = normalizeRentalSnapshot(next, defaults, now());
      options.storage.setItem(storeKey, JSON.stringify(snapshot));
      return snapshot;
    },
    exportSnapshot() {
      return JSON.stringify(this.load(), null, 2);
    },
    importSnapshot(raw: string) {
      const parsed = parseStrictJson(raw);
      const next = normalizeRentalSnapshot(parsed, defaults, now());
      options.storage.setItem(storeKey, JSON.stringify(next));
      return next;
    },
    clear() {
      options.storage.removeItem(storeKey);
    }
  };
}

export function getRentalTotal(rental: VehicleRental) {
  return roundCurrency(rental.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
}

export function getRentalPaidTotal(rental: VehicleRental) {
  return roundCurrency(rental.payments.reduce((sum, payment) => sum + payment.amount, 0));
}

export function getRentalBalance(rental: VehicleRental) {
  return roundCurrency(Math.max(getRentalTotal(rental) - getRentalPaidTotal(rental), 0));
}

export function getRentalDays(rental: VehicleRental) {
  const daily = rental.lines.find((line) => line.id.startsWith("DIA-"));
  return daily?.quantity ?? 1;
}

export function registerRentalPayment(rental: VehicleRental, payment: Omit<RentalPayment, "paidAt">, paidAt = new Date().toISOString()): VehicleRental {
  if (payment.amount <= 0) {
    throw new Error("Valor do pagamento deve ser maior que zero.");
  }
  const payments = [...rental.payments, { ...payment, paidAt }];
  const nextRental = { ...rental, payments, updatedAt: paidAt };
  return {
    ...nextRental,
    paymentStatus: getRentalBalance(nextRental) <= 0 ? "pago" : "aberto"
  };
}

export function moveVehicleRental(input: { rental: VehicleRental; vehicles: RentalVehicle[]; nextStatus: RentalStatus }) {
  const rental = { ...input.rental, status: input.nextStatus, updatedAt: new Date().toISOString() };
  const vehicles = input.vehicles.map((vehicle) => {
    if (vehicle.id !== rental.vehicleId) return vehicle;
    if (input.nextStatus === "reserva") return { ...vehicle, availability: "reservado" as VehicleAvailability };
    if (input.nextStatus === "devolucao") return { ...vehicle, availability: "disponivel" as VehicleAvailability };
    return { ...vehicle, availability: "locado" as VehicleAvailability };
  });
  return { rental, vehicles };
}

export function buildRentalFinancialSummary(snapshot: RentalSnapshot): RentalFinancialSummary {
  const completedRentals = snapshot.rentals.filter((rental) => rental.status === "devolucao");
  const grossRevenue = roundCurrency(snapshot.rentals.reduce((sum, rental) => sum + getRentalTotal(rental), 0));
  const paidAmount = roundCurrency(snapshot.rentals.reduce((sum, rental) => sum + getRentalPaidTotal(rental), 0));
  const expensesAmount = roundCurrency(snapshot.expenses.reduce((sum, expense) => sum + expense.amount, 0));
  return {
    openRentals: snapshot.rentals.filter((rental) => rental.status !== "devolucao").length,
    completedRentals: completedRentals.length,
    grossRevenue,
    paidAmount,
    openAmount: roundCurrency(grossRevenue - paidAmount),
    expensesAmount,
    netResult: roundCurrency(paidAmount - expensesAmount),
    availableVehicles: snapshot.vehicles.filter((vehicle) => vehicle.availability === "disponivel").length,
    rentedVehicles: snapshot.vehicles.filter((vehicle) => vehicle.availability === "locado").length
  };
}

export function renderRentalContract(input: {
  rental: VehicleRental;
  customer: RentalCustomer;
  vehicle: RentalVehicle;
  attendant: RentalUser;
  settings: RentalSettings;
}) {
  const lines = input.rental.lines.map((line) => `${line.name} - ${line.quantity} x ${formatCurrencyAscii(line.unitPrice)} = ${formatCurrencyAscii(line.quantity * line.unitPrice)}`);
  return [
    input.settings.companyName,
    input.settings.document,
    input.settings.phone,
    input.settings.address,
    "",
    `CONTRATO DE LOCACAO ${input.rental.id}`,
    `Status: ${statusLabel(input.rental.status)} | Prioridade: ${input.rental.priority}`,
    `Cliente: ${input.customer.name} | Documento: ${input.customer.document}`,
    `Veiculo: ${input.vehicle.model} | Placa: ${input.vehicle.plate} | KM: ${input.vehicle.mileage.toLocaleString("pt-BR")}`,
    `Retirada: ${input.rental.pickupDate}`,
    `Devolucao prevista: ${input.rental.returnDate}`,
    `Atendente: ${input.attendant.name}`,
    "",
    `Observacoes: ${input.rental.notes || "Sem observacoes"}`,
    "",
    "CHECKLIST",
    ...input.rental.checkoutChecklist.map((item) => `- ${item}`),
    "",
    "VALORES",
    ...lines,
    "",
    `Total: ${formatCurrencyAscii(getRentalTotal(input.rental))}`,
    `Pago: ${formatCurrencyAscii(getRentalPaidTotal(input.rental))}`,
    `Saldo: ${formatCurrencyAscii(getRentalBalance(input.rental))}`,
    "",
    "Assinatura do cliente: ______________________________"
  ].join("\n");
}

export function statusLabel(status: RentalStatus) {
  return ({ reserva: "Reserva", retirada: "Retirada", em_uso: "Em uso", devolucao: "Devolucao" })[status];
}

export function availabilityLabel(status: VehicleAvailability) {
  return ({ disponivel: "Disponivel", reservado: "Reservado", locado: "Locado", manutencao: "Manutencao" })[status];
}

export function nextStatus(status: RentalStatus): RentalStatus | null {
  const transitions: Record<RentalStatus, RentalStatus | null> = {
    reserva: "retirada",
    retirada: "em_uso",
    em_uso: "devolucao",
    devolucao: null
  };
  return transitions[status];
}

export function formatRentalId(id: string) {
  const digits = id.replace(/\D/g, "");
  return `LOC #${digits.padStart(6, "0")}`;
}

export function createRentalNumber(rentals: VehicleRental[]) {
  const sequence = Math.max(...rentals.map((rental) => Number(rental.id.replace(/\D/g, ""))).filter(Number.isFinite), 410) + 1;
  return `LOC-${String(sequence).padStart(6, "0")}`;
}

export function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "LV";
}

export function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function makeRental(
  id: string,
  vehicleId: string,
  customerId: string,
  attendantId: string,
  pickupDate: string,
  returnDate: string,
  status: RentalStatus,
  priority: RentalPriority,
  notes: string,
  days: number,
  dailyRate: number,
  partiallyPaid = false
): VehicleRental {
  const total = roundCurrency(days * dailyRate);
  return {
    id,
    vehicleId,
    customerId,
    attendantId,
    pickupDate,
    returnDate,
    status,
    priority,
    notes,
    checkoutChecklist: ["Documento e CNH conferidos", "Tanque registrado", "Fotos do veiculo anexadas"],
    lines: [{ id: `DIA-${id}`, name: "Diarias", quantity: days, unitPrice: dailyRate }],
    paymentStatus: partiallyPaid ? "aberto" : "aberto",
    payments: partiallyPaid ? [{ method: "PIX", amount: roundCurrency(total * 0.5), paidAt: "2026-08-13T09:00:00.000Z" }] : [],
    createdAt: "2026-08-13T09:00:00.000Z",
    updatedAt: "2026-08-13T09:00:00.000Z"
  };
}

function normalizeRentalSnapshot(candidate: unknown, defaults: RentalSnapshot, updatedAt: string): RentalSnapshot {
  if (!candidate || typeof candidate !== "object") {
    return defaults;
  }
  const value = candidate as Partial<RentalSnapshot>;
  return {
    version: RENTAL_STORE_VERSION,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : updatedAt,
    customers: normalizeArray(value.customers, defaults.customers),
    vehicles: normalizeArray(value.vehicles, defaults.vehicles),
    rentals: normalizeArray(value.rentals, defaults.rentals),
    expenses: normalizeArray(value.expenses, defaults.expenses),
    users: normalizeArray(value.users, defaults.users),
    settings: value.settings ?? defaults.settings
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
