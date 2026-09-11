import assert from "node:assert/strict";
import test from "node:test";
import { resolveReceiptStoreHeader } from "../apps/pdv-demo/src/storeReceiptSettings";
import {
  applyPdvInventoryCount,
  applyPdvStockMovement,
  authorizePdvAction,
  cancelPdvSale,
  closePdvCashSession,
  completePdvSale,
  configurePdvTerminal,
  createBrowserPdvRepository,
  createPdvAutoBackup,
  exportPdvReportCsv,
  filterPdvSalesForCashSession,
  filterPdvSalesHistory,
  generatePdvDashboardReport,
  planPdvStorageMigration,
  renderPdvReceipt,
  createPdvTefProviderRequest,
  resolvePdvTefTransaction,
  upsertPdvPaymentOption,
  upsertPdvUser,
  verifyPdvUserPassword,
  resolvePdvPayment
} from "../packages/database/src/pdv";

test("resolvePdvPayment reports the remaining amount before a sale can close", () => {
  const summary = resolvePdvPayment({
    total: 125.5,
    payments: [
      { method: "DINHEIRO", amount: 50 },
      { method: "PIX", amount: 25.25 }
    ]
  });

  assert.equal(summary.status, "insufficient");
  assert.equal(summary.paidTotal, 75.25);
  assert.equal(summary.remainingTotal, 50.25);
  assert.equal(summary.changeDue, 0);
});

test("resolvePdvPayment returns change only from immediate payments", () => {
  const summary = resolvePdvPayment({
    total: 98.9,
    payments: [
      { method: "DINHEIRO", amount: 100 },
      { method: "A PRAZO", amount: 20 }
    ],
    creditMethods: ["A PRAZO"],
    changeMethods: ["DINHEIRO"]
  });

  assert.equal(summary.status, "paid");
  assert.equal(summary.paidTotal, 120);
  assert.equal(summary.creditTotal, 20);
  assert.equal(summary.changeDue, 1.1);
});

test("resolvePdvPayment rejects customer credit above the available limit", () => {
  assert.throws(
    () =>
      resolvePdvPayment({
        total: 200,
        payments: [{ method: "A PRAZO", amount: 200 }],
        creditMethods: ["A PRAZO"],
        availableCredit: 150,
        customerName: "Maria Oliveira"
      }),
    /Limite de credito insuficiente para Maria Oliveira/
  );
});

test("completePdvSale stores the reusable payment summary on the finalized sale", () => {
  const result = completePdvSale({
    finalizedAt: "2026-08-10 15:00",
    completedSales: [],
    products: [{ productCode: "00101", productName: "Teclado", stock: 5 }],
    customer: { id: "CLI-002", name: "Joao Santos", creditLimit: 500, creditUsed: 100 },
    sale: {
      number: "000001",
      discountPercent: 0,
      items: [{ productCode: "00101", productName: "Teclado", quantity: 1, unitPrice: 100 }],
      payments: [
        { method: "DINHEIRO", amount: 120 },
        { method: "A PRAZO", amount: 50 }
      ]
    }
  });

  assert.equal(result.completedSale.netTotal, 100);
  assert.equal(result.completedSale.paymentSummary.paidTotal, 170);
  assert.equal(result.completedSale.paymentSummary.changeDue, 20);
  assert.equal(result.completedSale.paymentSummary.creditTotal, 50);
});

test("applyPdvStockMovement updates stock and records the balance after movement", () => {
  const result = applyPdvStockMovement({
    products: [{ productCode: "00101", productName: "Teclado", stock: 5, minStock: 2 }],
    movement: {
      id: "MOV-1",
      productCode: "00101",
      productName: "Teclado",
      type: "entry",
      quantityDelta: 4,
      reason: "Compra",
      createdAt: "2026-08-10 16:00"
    }
  });

  assert.equal(result.products[0].stock, 9);
  assert.equal(result.movement.stockBefore, 5);
  assert.equal(result.movement.stockAfter, 9);
  assert.equal(result.lowStockAlerts.length, 0);
});

test("applyPdvInventoryCount adjusts stock to the counted quantity and flags low stock", () => {
  const result = applyPdvInventoryCount({
    products: [{ productCode: "00015", productName: "Queijo", stock: 18.4, minStock: 4 }],
    count: {
      id: "INV-1",
      productCode: "00015",
      productName: "Queijo",
      countedQuantity: 3.25,
      reason: "Contagem",
      createdAt: "2026-08-10 16:10"
    }
  });

  assert.equal(result.products[0].stock, 3.25);
  assert.equal(result.movement.quantityDelta, -15.15);
  assert.equal(result.lowStockAlerts[0].productCode, "00015");
});

test("applyPdvStockMovement rejects movements that would create negative stock", () => {
  assert.throws(
    () =>
      applyPdvStockMovement({
        products: [{ productCode: "00102", productName: "Mouse", stock: 2, minStock: 1 }],
        movement: {
          id: "MOV-NEG",
          productCode: "00102",
          productName: "Mouse",
          type: "adjustment",
          quantityDelta: -3,
          reason: "Ajuste",
          createdAt: "2026-08-10 16:20"
        }
      }),
    /Estoque nao pode ficar negativo para Mouse/
  );
});

test("closePdvCashSession summarizes payments and reports divergence", () => {
  const result = closePdvCashSession({
    openedAt: "2026-08-10 09:00",
    closedAt: "2026-08-10 18:00",
    initialAmount: 350,
    withdrawals: [{ amount: 25, note: "Sangria", createdAt: "2026-08-10 14:00" }],
    sales: [
      { number: "001", payments: [{ method: "A VISTA", amount: 100 }, { method: "PIX", amount: 50 }], netTotal: 150 },
      { number: "002", payments: [{ method: "A PRAZO", amount: 80 }], netTotal: 80 }
    ],
    countedByMethod: { "A VISTA": 424, PIX: 50, "A PRAZO": 80 }
  });

  assert.equal(result.expectedByMethod["A VISTA"], 425);
  assert.equal(result.expectedByMethod.PIX, 50);
  assert.equal(result.expectedByMethod["A PRAZO"], 80);
  assert.equal(result.expectedCashTotal, 425);
  assert.equal(result.divergenceByMethod["A VISTA"], -1);
  assert.equal(result.status, "divergent");
});

test("filterPdvSalesForCashSession only includes sales finalized while the cash session is open", () => {
  const sales = filterPdvSalesForCashSession({
    openedAt: "28/08/2026, 09:00:00",
    closedAt: "28/08/2026, 18:00:00",
    sales: [
      { number: "ANTERIOR", finalizedAt: "28/08/2026, 08:59:59", netTotal: 20, payments: [{ method: "A VISTA", amount: 20 }] },
      { number: "ATUAL", finalizedAt: "28/08/2026, 12:00:00", netTotal: 50, payments: [{ method: "A VISTA", amount: 50 }] },
      { number: "POSTERIOR", finalizedAt: "28/08/2026, 18:00:01", netTotal: 70, payments: [{ method: "A VISTA", amount: 70 }] }
    ]
  });

  assert.deepEqual(sales.map((sale) => sale.number), ["ATUAL"]);
});

test("browser repository keeps a product registration and its deletion after reload", () => {
  const storage = new Map<string, string>();
  const repository = createBrowserPdvRepository({
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    },
    storeKey: "pdv-test",
    defaults: { catalogProducts: [] as Array<{ productCode: string }>, registeredCustomers: [] as string[], completedSales: [] as string[], cashSession: null as null, paymentOptions: [] as string[], deviceConfig: {} }
  });

  repository.save({ catalogProducts: [{ productCode: "00099" }] });
  assert.deepEqual(repository.load().catalogProducts, [{ productCode: "00099" }]);
  repository.save({ catalogProducts: [] });
  assert.deepEqual(repository.load().catalogProducts, []);
});

test("renderPdvReceipt creates a printable non fiscal receipt", () => {
  const receipt = renderPdvReceipt({
    storeName: "PDV Nexus",
    documentLabel: "CUPOM NAO FISCAL",
    sale: {
      number: "000123",
      finalizedAt: "2026-08-10 16:30",
      seller: "Administrador",
      customerName: "Cliente Balcao",
      netTotal: 112.5,
      paymentSummary: { paidTotal: 120, changeDue: 7.5 },
      items: [{ productName: "Teclado sem fio", quantity: 1, unitLabel: "UN", unitPrice: 100, totalPrice: 100 }],
      payments: [{ method: "A VISTA", amount: 120 }]
    },
    width: 32
  });

  assert.match(receipt, /PDV Nexus/);
  assert.match(receipt, /CUPOM NAO FISCAL/);
  assert.match(receipt, /Teclado sem fio/);
  assert.match(receipt, /TOTAL\s+R\$ 112,50/);
  assert.match(receipt, /TROCO\s+R\$ 7,50/);
});

test("authorizePdvAction allows a manager to approve a sensitive operation", () => {
  const result = authorizePdvAction({
    action: "cancel-sale",
    operator: { id: "OP-001", name: "Caixa", role: "cashier", active: true },
    managerPassword: "4321",
    users: [
      { id: "OP-001", name: "Caixa", role: "cashier", active: true },
      { id: "GER-001", name: "Gerente", role: "manager", active: true, managerPassword: "4321" }
    ],
    reason: "Cliente desistiu",
    createdAt: "2026-08-10 17:00"
  });

  assert.equal(result.authorizedBy?.id, "GER-001");
  assert.equal(result.auditLog.action, "cancel-sale");
  assert.equal(result.auditLog.operatorId, "OP-001");
  assert.equal(result.auditLog.authorizedById, "GER-001");
});

test("authorizePdvAction rejects a sensitive operation without manager approval", () => {
  assert.throws(
    () =>
      authorizePdvAction({
        action: "cancel-sale",
        operator: { id: "OP-001", name: "Caixa", role: "cashier", active: true },
        managerPassword: "wrong",
        users: [{ id: "GER-001", name: "Gerente", role: "manager", active: true, managerPassword: "4321" }],
        reason: "Erro",
        createdAt: "2026-08-10 17:05"
      }),
    /Autorizacao de gerente necessaria/
  );
});

test("cancelPdvSale returns stock, reverses customer credit and records the reason", () => {
  const result = cancelPdvSale({
    sale: {
      number: "000777",
      customerId: "CLI-002",
      items: [{ productCode: "00101", productName: "Teclado", quantity: 2 }],
      payments: [{ method: "A PRAZO", amount: 80 }],
      netTotal: 80,
      finalizedAt: "2026-08-10 16:00",
      paymentSummary: { creditTotal: 80 }
    },
    products: [{ productCode: "00101", productName: "Teclado", stock: 3, minStock: 1 }],
    customer: { id: "CLI-002", name: "Joao Santos", creditLimit: 500, creditUsed: 120 },
    reason: "Cliente desistiu",
    cancelledAt: "2026-08-10 17:10",
    operator: { id: "OP-001", name: "Caixa", role: "cashier", active: true },
    authorization: {
      auditLog: {
        id: "AUD-1",
        action: "cancel-sale",
        operatorId: "OP-001",
        operatorName: "Caixa",
        authorizedById: "GER-001",
        authorizedByName: "Gerente",
        reason: "Cliente desistiu",
        createdAt: "2026-08-10 17:10"
      },
      authorizedBy: { id: "GER-001", name: "Gerente", role: "manager", active: true }
    }
  });

  assert.equal(result.cancelledSale.status, "cancelled");
  assert.equal(result.cancelledSale.cancelReason, "Cliente desistiu");
  assert.equal(result.products[0].stock, 5);
  assert.equal(result.customer.creditUsed, 40);
  assert.equal(result.stockMovements[0].type, "cancellation");
  assert.equal(result.auditLog.authorizedById, "GER-001");
});

test("generatePdvDashboardReport summarizes sales, payments, top products, low stock and cashflow", () => {
  const report = generatePdvDashboardReport({
    from: "2026-08-10T00:00:00.000Z",
    to: "2026-08-10T23:59:59.999Z",
    sales: [
      {
        number: "001",
        finalizedAt: "2026-08-10T10:00:00.000Z",
        netTotal: 150,
        items: [
          { productCode: "00101", productName: "Teclado", quantity: 1, totalPrice: 100 },
          { productCode: "00102", productName: "Mouse", quantity: 1, totalPrice: 50 }
        ],
        payments: [{ method: "A VISTA", amount: 150 }]
      },
      {
        number: "002",
        finalizedAt: "2026-08-10T11:00:00.000Z",
        netTotal: 100,
        items: [{ productCode: "00101", productName: "Teclado", quantity: 1, totalPrice: 100 }],
        payments: [{ method: "PIX", amount: 100 }]
      },
      {
        number: "003",
        finalizedAt: "2026-08-11T11:00:00.000Z",
        netTotal: 999,
        items: [{ productCode: "999", productName: "Fora", quantity: 1, totalPrice: 999 }],
        payments: [{ method: "PIX", amount: 999 }]
      }
    ],
    products: [
      { productCode: "00101", productName: "Teclado", stock: 1, minStock: 2 },
      { productCode: "00102", productName: "Mouse", stock: 8, minStock: 2 }
    ],
    cashClosings: [{ closedAt: "2026-08-10T18:00:00.000Z", expectedCashTotal: 500, countedCashTotal: 498, status: "divergent" }]
  });

  assert.equal(report.salesCount, 2);
  assert.equal(report.salesTotal, 250);
  assert.equal(report.paymentsByMethod["A VISTA"], 150);
  assert.equal(report.paymentsByMethod.PIX, 100);
  assert.equal(report.topProducts[0].productCode, "00101");
  assert.equal(report.topProducts[0].quantity, 2);
  assert.equal(report.lowStockAlerts[0].productCode, "00101");
  assert.equal(report.cashflow.expectedCashTotal, 500);
  assert.equal(report.cashflow.divergentClosings, 1);
});

test("generatePdvDashboardReport accepts dates persisted in Brazilian desktop format", () => {
  const report = generatePdvDashboardReport({
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-08-31T23:59:59.999Z",
    sales: [{
      number: "420918",
      finalizedAt: "11/08/2026, 01:02:10",
      netTotal: 79.9,
      items: [{ productCode: "00021", productName: "Picanha Bovina", quantity: 1, totalPrice: 79.9 }],
      payments: [{ method: "A VISTA", amount: 79.9 }]
    }],
    products: [],
    cashClosings: [{ closedAt: "11/08/2026, 01:10:00", expectedCashTotal: 79.9, countedCashTotal: 79.9, status: "balanced" }]
  });

  assert.equal(report.salesCount, 1);
  assert.equal(report.salesTotal, 79.9);
  assert.equal(report.paymentsByMethod["A VISTA"], 79.9);
  assert.equal(report.cashflow.divergenceTotal, 0);
});

test("configurePdvTerminal prepares a reusable terminal identity for multi cashier operation", () => {
  const terminal = configurePdvTerminal({
    terminalId: " caixa 02 ",
    terminalName: " Caixa lateral ",
    mode: "client",
    serverUrl: " http://192.168.0.10:5173 "
  });

  assert.equal(terminal.terminalId, "CAIXA-02");
  assert.equal(terminal.terminalName, "Caixa lateral");
  assert.equal(terminal.mode, "client");
  assert.equal(terminal.serverUrl, "http://192.168.0.10:5173");
  assert.equal(terminal.active, true);
});

test("upsertPdvUser requires manager level authorization to create an active user", () => {
  const result = upsertPdvUser({
    users: [{ id: "GER-001", name: "Gerente", role: "manager", active: true }],
    user: { id: "OP-002", name: "Operador 2", role: "cashier", active: true },
    operator: { id: "GER-001", name: "Gerente", role: "manager", active: true },
    createdAt: "2026-08-10T19:00:00.000Z"
  });

  assert.equal(result.users.length, 2);
  assert.equal(result.users[1].id, "OP-002");
  assert.equal(result.auditLog.action, "upsert-user");
  assert.equal(result.auditLog.operatorId, "GER-001");
});

test("upsertPdvPaymentOption normalizes methods and prevents duplicate names", () => {
  const result = upsertPdvPaymentOption({
    options: [{ name: "PIX", feePercent: 0, showsInCashflow: true }],
    option: { name: " credito loja ", feePercent: 2.75, showsInCashflow: false, active: true }
  });

  assert.equal(result.length, 2);
  assert.equal(result[1].name, "CREDITO LOJA");
  assert.equal(result[1].feePercent, 2.75);
  assert.equal(result[1].showsInCashflow, false);
});

test("filterPdvSalesHistory returns completed and cancelled sales by period, status and customer", () => {
  const history = filterPdvSalesHistory({
    sales: [
      { number: "001", customerId: "CLI-001", finalizedAt: "2026-08-10T10:00:00.000Z", netTotal: 50, payments: [{ method: "PIX", amount: 50 }] },
      { number: "002", customerId: "CLI-002", finalizedAt: "2026-08-09T10:00:00.000Z", netTotal: 70, payments: [{ method: "A VISTA", amount: 70 }] }
    ],
    cancelledSales: [
      { number: "003", customerId: "CLI-001", finalizedAt: "2026-08-10T12:00:00.000Z", netTotal: 20, payments: [{ method: "PIX", amount: 20 }], status: "cancelled" }
    ],
    filters: {
      from: "2026-08-10T00:00:00.000Z",
      to: "2026-08-10T23:59:59.999Z",
      customerId: "CLI-001",
      status: "all",
      paymentMethod: "PIX"
    }
  });

  assert.deepEqual(history.map((sale) => sale.number), ["003", "001"]);
});

test("filterPdvSalesHistory accepts Brazilian desktop timestamps", () => {
  const history = filterPdvSalesHistory({
    sales: [{ number: "000002", customerId: "CLI-001", finalizedAt: "28/08/2026, 17:15:47", netTotal: 8.99, payments: [{ method: "A VISTA", amount: 8.99 }] }],
    filters: { status: "all" }
  });

  assert.deepEqual(history.map((sale) => sale.number), ["000002"]);
});

test("exportPdvReportCsv emits dashboard rows ready for spreadsheets", () => {
  const csv = exportPdvReportCsv({
    rows: [
      { date: "2026-08-10", number: "001", customerName: "Cliente Balcao", status: "completed", paymentMethods: "PIX", total: 125.5 }
    ]
  });

  assert.match(csv, /data;venda;cliente;status;formas;total/);
  assert.match(csv, /2026-08-10;001;Cliente Balcao;completed;PIX;125,50/);
});

test("planPdvStorageMigration chooses SQLite in desktop when it is available", () => {
  const plan = planPdvStorageMigration({
    isDesktop: true,
    sqliteAvailable: true,
    localSnapshotExists: true,
    sqliteSnapshotExists: false
  });

  assert.equal(plan.target, "sqlite");
  assert.equal(plan.shouldCopyLocalToSqlite, true);
  assert.equal(plan.status, "migration-required");
});

test("resolvePdvTefTransaction approves simulated card payments with authorization metadata", () => {
  const transaction = resolvePdvTefTransaction({
    enabled: true,
    simulationMode: true,
    provider: "Simulador TEF",
    saleNumber: "000123",
    method: "CREDITO",
    amount: 89.9,
    createdAt: "2026-08-10T20:00:00.000Z"
  });

  assert.equal(transaction.status, "approved");
  assert.equal(transaction.authorizationCode.length, 6);
  assert.equal(transaction.provider, "Simulador TEF");
  assert.equal(transaction.amount, 89.9);
});

test("verifyPdvUserPassword authenticates active users and rejects inactive users", () => {
  assert.equal(verifyPdvUserPassword({ user: { id: "OP-001", name: "Caixa", role: "cashier", active: true, password: "1234" }, password: "1234" }).ok, true);
  assert.equal(verifyPdvUserPassword({ user: { id: "OP-002", name: "Caixa 2", role: "cashier", active: false, password: "1234" }, password: "1234" }).ok, false);
});

test("createPdvAutoBackup keeps the newest snapshots inside the retention limit", () => {
  const result = createPdvAutoBackup({
    backups: [
      { id: "BKP-1", createdAt: "2026-08-10T10:00:00.000Z", reason: "manual", snapshotJson: "{}" },
      { id: "BKP-2", createdAt: "2026-08-10T11:00:00.000Z", reason: "manual", snapshotJson: "{}" }
    ],
    snapshotJson: "{\"ok\":true}",
    reason: "sale-finalized",
    createdAt: "2026-08-10T12:00:00.000Z",
    retention: 2
  });

  assert.deepEqual(result.map((backup) => backup.id), ["BKP-2026-08-10T12-00-00-000Z", "BKP-2"]);
  assert.equal(result[0].reason, "sale-finalized");
});

test("createPdvTefProviderRequest prepares a machine integration payload without approving it locally", () => {
  const request = createPdvTefProviderRequest({
    provider: "Stone Local Bridge",
    endpointUrl: " http://127.0.0.1:9090/pay ",
    merchantCode: "LOJA-01",
    saleNumber: "000555",
    method: "DEBITO",
    amount: 45.75,
    createdAt: "2026-08-10T21:00:00.000Z"
  });

  assert.equal(request.url, "http://127.0.0.1:9090/pay");
  assert.equal(request.payload.amount, 45.75);
  assert.equal(request.payload.captureMode, "card-present");
  assert.equal(request.expectedStatus, "pending-provider");
});


test("store receipt header keeps legacy branding until opt-in", () => {
  const header = resolveReceiptStoreHeader({
    storeName: "Loja Exemplo",
    address: "Rua Central, 123",
    phone: "(16) 99999-0000",
    showOnReceipt: false
  });

  assert.deepEqual(header, { storeName: "PDV Nexus" });
});

test("store receipt header exposes optional data after opt-in", () => {
  const header = resolveReceiptStoreHeader({
    storeName: "  Loja Exemplo  ",
    address: "  Rua Central, 123  ",
    phone: "  (16) 99999-0000  ",
    showOnReceipt: true
  });

  assert.deepEqual(header, {
    storeName: "Loja Exemplo",
    address: "Rua Central, 123",
    phone: "(16) 99999-0000"
  });
});

test("renderPdvReceipt prints optional store address and phone", () => {
  const receipt = renderPdvReceipt({
    storeName: "Loja Exemplo",
    address: "Rua Central, 123",
    phone: "(16) 99999-0000",
    documentLabel: "CUPOM NAO FISCAL",
    sale: {
      number: "000999",
      finalizedAt: "2026-09-11 13:00",
      seller: "Operador",
      customerName: "Cliente",
      netTotal: 10,
      paymentSummary: { paidTotal: 10, changeDue: 0 },
      items: [{ productName: "Produto", quantity: 1, unitLabel: "UN", unitPrice: 10, totalPrice: 10 }],
      payments: [{ method: "PIX", amount: 10 }]
    },
    width: 42
  });

  assert.match(receipt, /Loja Exemplo/);
  assert.match(receipt, /Rua Central, 123/);
  assert.match(receipt, /Telefone: \(16\) 99999-0000/);
});
