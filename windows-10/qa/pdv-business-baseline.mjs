export const MAIN_PDV_STORE_KEY = "nexus-core:pdv-store:v1";

export const PDV_BUSINESS_BASELINE = Object.freeze({
  catalogProducts: [
    { productCode: "00021", barcode: "7891000000212", productName: "Picanha Bovina", unitPrice: 79.9, itemType: "weight", shelfLifeDays: 3, unitLabel: "KG", stock: 12.2, minStock: 3, category: "Acougue" },
    { productCode: "00034", barcode: "7891000000342", productName: "Tomate Italiano", unitPrice: 8.99, itemType: "weight", shelfLifeDays: 4, unitLabel: "KG", stock: 25.8, minStock: 6, category: "Hortifruti" },
    { productCode: "00101", barcode: "7895555441971", productName: "Teclado com fio", unitPrice: 100, itemType: "unit", shelfLifeDays: 0, unitLabel: "UN", stock: 8, minStock: 2, category: "Informatica" },
    { productCode: "00102", barcode: "7894123412341", productName: "Mouse sem fio", unitPrice: 49.9, itemType: "unit", shelfLifeDays: 0, unitLabel: "UN", stock: 14, minStock: 4, category: "Informatica" },
    { productCode: "00103", barcode: "7894900011110", productName: "Coca-Cola 2,5L", unitPrice: 12, itemType: "unit", shelfLifeDays: 90, unitLabel: "UN", stock: 22, minStock: 6, category: "Bebidas" }
  ],
  registeredCustomers: [
    { id: "CLI-001", name: "Cliente Balcao", document: "Consumidor final", city: "Sao Paulo", creditLimit: 0, creditUsed: 0 },
    { id: "CLI-002", name: "Joao Santos", document: "123.456.789-00", city: "Cubatao", creditLimit: 5000, creditUsed: 284.99 },
    { id: "CLI-003", name: "Maria Oliveira", document: "987.654.321-00", city: "Sao Paulo", creditLimit: 2500, creditUsed: 420 }
  ],
  completedSales: [],
  cashSession: null,
  paymentOptions: [
    { name: "A VISTA", feePercent: 0, showsInCashflow: true },
    { name: "PIX", feePercent: 0, showsInCashflow: true },
    { name: "CREDITO", feePercent: 3, showsInCashflow: true },
    { name: "DEBITO", feePercent: 2.5, showsInCashflow: true },
    { name: "A PRAZO", feePercent: 0, showsInCashflow: false },
    { name: "CHEQUE", feePercent: 0, showsInCashflow: true },
    { name: "OUTROS", feePercent: 0, showsInCashflow: true }
  ],
  deviceConfig: {
    scaleBrand: "toledo",
    barcodeMode: "DEFAULT_PRICE",
    requestCommand: "\u0005",
    selectedPort: "",
    baudRate: "9600",
    manualProductCode: "00034"
  },
  extensions: {
    inventoryMovements: [],
    cashClosings: [],
    receiptPrinterConfig: { paperFormat: "58mm", paperWidth: 32, autoPrint: false, printerName: "Impressora 58/80mm ou A4" },
    lastReceiptText: "",
    users: [
      { id: "OP-001", name: "Operador Caixa", role: "cashier", active: true },
      { id: "GER-001", name: "Gerente", role: "manager", active: true }
    ],
    currentOperatorId: "OP-001",
    auditLogs: [],
    cancelledSales: [],
    terminalConfig: { terminalId: "CAIXA-01", terminalName: "Caixa principal", mode: "single", active: true },
    tefConfig: { enabled: false, simulationMode: false, provider: "Captura manual", merchantCode: "", endpointUrl: "", integrationMode: "simulated" },
    tefTransactions: [],
    autoBackupConfig: { enabled: true, retention: 7, trigger: "sale-finalized" },
    autoBackups: [],
    storeSettings: { storeName: "PDV Nexus", document: "Nao informado", phone: "", address: "", showOnReceipt: false },
    promotionGroups: []
  }
});

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function mergePdvBusinessSeed(base, patch) {
  if (Array.isArray(patch)) return clone(patch);
  if (!patch || typeof patch !== "object") return clone(patch);
  const source = base && typeof base === "object" && !Array.isArray(base) ? base : {};
  const result = clone(source);
  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) result[key] = clone(value);
    else if (value && typeof value === "object") result[key] = mergePdvBusinessSeed(source[key], value);
    else result[key] = value;
  }
  return result;
}

export function hydratePdvBusinessFlowSteps(steps) {
  return steps.map((step) => {
    if (step?.action !== "desktopStoreSet" || step.key !== MAIN_PDV_STORE_KEY || !step.value || typeof step.value !== "object" || Array.isArray(step.value)) return step;
    return { ...step, value: mergePdvBusinessSeed(PDV_BUSINESS_BASELINE, step.value) };
  });
}
