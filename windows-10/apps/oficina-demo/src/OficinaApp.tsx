import {
  BarChart3,
  Bell,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Coins,
  ContactRound,
  Download,
  FileText,
  LogOut,
  Package,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  Upload,
  UserRound,
  Users,
  Wrench
} from "lucide-react";
import {
  DEFAULT_WORKSHOP_STORE_KEY,
  addPartToOrder,
  buildWorkshopFinancialSummary,
  createBrowserWorkshopRepository,
  createOrderNumber,
  formatWorkshopOrderId,
  getLowStockItems,
  getOrderBalance,
  getOrderPaidTotal,
  getOrderTotal,
  hasWorkshopPermission,
  initials,
  moveWorkshopOrder,
  nextStatus,
  registerOrderPayment,
  renderServiceOrderDocument,
  statusLabel,
  type WorkshopCustomer,
  type WorkshopOrderStatus,
  type WorkshopPriority,
  type WorkshopPermission,
  type WorkshopServiceOrder,
  type WorkshopSnapshot,
  type WorkshopStockItem,
  type WorkshopUser,
  type WorkshopVehicle
} from "@nexus-core/module-oficina";
import { getDesktopBackupBridge, getDesktopStoreBridge } from "@nexus-core/desktop-runtime";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

type NavKey = "orders" | "customers" | "vehicles" | "stock" | "finance" | "reports" | "settings";
type OrderDraft = {
  vehicleId: string;
  customerId: string;
  technicianId: string;
  delivery: string;
  priority: WorkshopPriority;
  complaint: string;
  serviceName: string;
  servicePrice: number;
};

const navItems: Array<{ id: NavKey; label: string; Icon: typeof CalendarDays }> = [
  { id: "orders", label: "Ordens de servico", Icon: ClipboardList },
  { id: "customers", label: "Clientes", Icon: ContactRound },
  { id: "vehicles", label: "Veiculos", Icon: CarFront },
  { id: "stock", label: "Estoque", Icon: Package },
  { id: "finance", label: "Financeiro", Icon: Coins },
  { id: "reports", label: "Documentos", Icon: FileText },
  { id: "settings", label: "Configuracoes", Icon: Settings }
];

const columns: Array<{ id: WorkshopOrderStatus; label: string; Icon: typeof ClipboardList }> = [
  { id: "entrada", label: "Entrada", Icon: ClipboardList },
  { id: "diagnostico", label: "Diagnostico", Icon: Search },
  { id: "execucao", label: "Em execucao", Icon: Wrench },
  { id: "finalizacao", label: "Finalizacao", Icon: Check }
];

const paymentMethods = ["PIX", "Dinheiro", "Credito", "Debito", "Boleto"];

export function OficinaApp() {
  const repository = useMemo(() => createBrowserWorkshopRepository({ storage: window.localStorage }), []);
  const desktopStore = useMemo(() => getDesktopStoreBridge(), []);
  const desktopBackup = useMemo(() => getDesktopBackupBridge(), []);
  const [snapshot, setSnapshot] = useState<WorkshopSnapshot>(() => repository.load());
  const [desktopStoreReady, setDesktopStoreReady] = useState(false);
  const [storageLabel, setStorageLabel] = useState("Armazenamento local");
  const [activeNav, setActiveNav] = useState<NavKey>("orders");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState("");
  const [toast, setToast] = useState("");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const selectedOrder = snapshot.orders.find((order) => order.id === selectedOrderId) ?? null;
  const financialSummary = buildWorkshopFinancialSummary(snapshot);
  const lowStockItems = getLowStockItems(snapshot.stockItems);
  const activeUser = snapshot.users.find((user) => user.id === activeUserId);
  const can = (permission: WorkshopPermission) => hasWorkshopPermission(activeUser, permission);

  useEffect(() => {
    let cancelled = false;
    if (!desktopStore) {
      setDesktopStoreReady(true);
      return () => { cancelled = true; };
    }

    desktopStore.status().then((status) => {
      if (cancelled) return;
      if (!status.available) {
        setStorageLabel("Armazenamento local");
        setDesktopStoreReady(true);
        return;
      }
      setStorageLabel("Banco local SQLite");
      return desktopStore.load(DEFAULT_WORKSHOP_STORE_KEY).then((row) => {
        if (cancelled) return;
        if (row?.snapshotJson) {
          setSnapshot(repository.importSnapshot(row.snapshotJson));
        }
        setDesktopStoreReady(true);
      });
    }).catch(() => {
      if (!cancelled) setDesktopStoreReady(true);
    });

    return () => { cancelled = true; };
  }, [desktopStore, repository]);

  useEffect(() => {
    if (!desktopStoreReady) return;
    repository.save(snapshot);
    if (desktopStore) {
      void desktopStore.save(DEFAULT_WORKSHOP_STORE_KEY, JSON.stringify(snapshot));
    }
  }, [desktopStore, desktopStoreReady, repository, snapshot]);

  useEffect(() => {
    if (!desktopStoreReady || !desktopBackup) return;
    const day = new Date().toISOString().slice(0, 10);
    const marker = `oficina:auto-backup:${day}`;
    if (window.localStorage.getItem(marker)) return;
    void desktopBackup.write({ scope: "oficina", snapshotJson: JSON.stringify(snapshot), reason: "automatico", retention: snapshot.settings.backupRetention })
      .then(() => window.localStorage.setItem(marker, "ok"))
      .catch(() => undefined);
  }, [desktopBackup, desktopStoreReady, snapshot]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function patchSnapshot(patch: Partial<Omit<WorkshopSnapshot, "version" | "updatedAt">>) {
    setSnapshot((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  }

  function resolveOrderInfo(order: WorkshopServiceOrder) {
    return {
      customer: snapshot.customers.find((item) => item.id === order.customerId) ?? snapshot.customers[0],
      vehicle: snapshot.vehicles.find((item) => item.id === order.vehicleId) ?? snapshot.vehicles[0],
      technician: snapshot.users.find((item) => item.id === order.technicianId) ?? snapshot.users[0]
    };
  }

  function moveOrder(order: WorkshopServiceOrder, next: WorkshopOrderStatus) {
    if (!can("orders:write")) return setToast("Seu perfil nao pode alterar ordens de servico.");
    try {
      const moved = moveWorkshopOrder({ order, stockItems: snapshot.stockItems, nextStatus: next });
      patchSnapshot({
        orders: snapshot.orders.map((item) => item.id === order.id ? moved.order : item),
        stockItems: moved.stockItems
      });
      setToast(`${formatWorkshopOrderId(order.id)} movida para ${statusLabel(next)}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nao foi possivel mover a OS.");
    }
  }

  function addPart(order: WorkshopServiceOrder, part: WorkshopStockItem) {
    if (!can("stock:write")) return setToast("Seu perfil nao pode movimentar estoque.");
    try {
      const updated = addPartToOrder(order, part);
      patchSnapshot({ orders: snapshot.orders.map((item) => item.id === order.id ? updated : item) });
      setToast(`${part.name} adicionada a ${formatWorkshopOrderId(order.id)}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nao foi possivel adicionar a peca.");
    }
  }

  function receivePayment(order: WorkshopServiceOrder, method: string, amount: number) {
    if (!can("finance:write")) return setToast("Seu perfil nao pode registrar pagamentos.");
    try {
      const updated = registerOrderPayment(order, { method, amount });
      patchSnapshot({ orders: snapshot.orders.map((item) => item.id === order.id ? updated : item) });
      setToast(`Pagamento registrado em ${formatWorkshopOrderId(order.id)}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nao foi possivel registrar o pagamento.");
    }
  }

  function createOrder(draft: OrderDraft) {
    if (!can("orders:write")) return setToast("Seu perfil nao pode criar ordens de servico.");
    const now = new Date().toISOString();
    const created: WorkshopServiceOrder = {
      id: createOrderNumber(snapshot.orders),
      vehicleId: draft.vehicleId,
      customerId: draft.customerId,
      technicianId: draft.technicianId,
      delivery: draft.delivery,
      status: "entrada",
      priority: draft.priority,
      complaint: draft.complaint,
      diagnosis: "",
      lines: [{ id: `SRV-${now}`, name: draft.serviceName, kind: "servico", quantity: 1, unitPrice: draft.servicePrice }],
      stockApplied: false,
      paymentStatus: "aberto",
      payments: [],
      createdAt: now,
      updatedAt: now
    };
    patchSnapshot({ orders: [created, ...snapshot.orders] });
    setModalOpen(false);
    setToast(`${formatWorkshopOrderId(created.id)} criada.`);
  }

  function showOrderDocument(order: WorkshopServiceOrder) {
    const info = resolveOrderInfo(order);
    setDocumentText(renderServiceOrderDocument({ order, customer: info.customer, vehicle: info.vehicle, technician: info.technician, settings: snapshot.settings }));
  }

  function exportBackup() {
    if (!can("documents:manage")) return setToast("Seu perfil nao pode exportar backups.");
    const blob = new Blob([repository.exportSnapshot()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `backup-oficina-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Backup gerado.");
  }

  async function importBackup(file: File) {
    if (!can("documents:manage")) return setToast("Seu perfil nao pode restaurar backups.");
    try {
      const imported = repository.importSnapshot(await file.text());
      setSnapshot(imported);
      setToast("Backup restaurado.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nao foi possivel restaurar o backup.");
    }
  }

  function printDocument(text: string) {
    const printWindow = window.open("", "oficina-document", "width=760,height=900");
    if (!printWindow) return;
    printWindow.document.write(`<pre style="font-family: Consolas, monospace; font-size: 13px; white-space: pre-wrap; padding: 24px;">${escapeHtml(text)}</pre>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">OF</span>
          <span><small>SISTEMA</small><strong>OFICINA</strong></span>
        </div>
        <nav className="nav-list" aria-label="Navegacao principal">
          {navItems.filter(({ id }) => id === "orders" || id === "customers" || id === "vehicles" ? can(id === "orders" ? "orders:write" : `${id}:write` as WorkshopPermission) : id === "stock" ? can("stock:write") : id === "finance" ? can("finance:write") : id === "reports" ? can("documents:manage") : can("settings:manage")).map(({ id, label, Icon }) => (
            <button className={`nav-item ${activeNav === id ? "is-active" : ""}`} type="button" key={id} onClick={() => setActiveNav(id)}>
              <Icon size={21} strokeWidth={1.9} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="nav-bottom">
          <button className="nav-item" type="button" onClick={() => setToast("Manual e suporte entram na etapa final.")}><CircleHelp size={21} /><span>Ajuda</span></button>
          <button className="nav-item" type="button" onClick={() => setActiveUserId(null)}><LogOut size={21} /><span>Sair</span></button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="status-strip">
            <span>{snapshot.orders.length} OS</span>
            <span>{lowStockItems.length} alertas de estoque</span>
            <span>{formatCurrency(financialSummary.openAmount)} em aberto</span>
            <span>{storageLabel}</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-button notification" type="button" aria-label="Alertas" title="Alertas" onClick={() => setActiveNav("stock")}><Bell size={21} /><b>{lowStockItems.length}</b></button>
            <button className="profile-button" type="button" onClick={() => setActiveNav("settings")}>
              <span className="profile-avatar">{initials(activeUser?.name ?? "OF")}</span>
              <span><strong>{activeUser?.name ?? "Acesso"}</strong><small>{activeUser?.role ?? "Bloqueado"}</small></span>
              <ChevronDown size={17} />
            </button>
          </div>
        </header>

        <section className="content">
          {activeNav === "orders" ? (
            <OrdersView snapshot={snapshot} onOpenOrder={setSelectedOrderId} onCreateOrder={() => setModalOpen(true)} />
          ) : null}
          {activeNav === "customers" ? <CustomersView snapshot={snapshot} onPatch={patchSnapshot} /> : null}
          {activeNav === "vehicles" ? <VehiclesView snapshot={snapshot} onPatch={patchSnapshot} /> : null}
          {activeNav === "stock" ? <StockView snapshot={snapshot} onPatch={patchSnapshot} /> : null}
          {activeNav === "finance" ? <FinanceView snapshot={snapshot} onOpenOrder={setSelectedOrderId} onReceive={receivePayment} /> : null}
          {activeNav === "reports" ? <DocumentsView snapshot={snapshot} onDocument={showOrderDocument} onExport={exportBackup} onImportClick={() => importRef.current?.click()} /> : null}
          {activeNav === "settings" ? <SettingsView snapshot={snapshot} onPatch={patchSnapshot} /> : null}
        </section>
      </main>

      <input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void importBackup(file);
        event.currentTarget.value = "";
      }} />

      {modalOpen ? <OrderModal snapshot={snapshot} onClose={() => setModalOpen(false)} onCreate={createOrder} /> : null}
      {selectedOrder ? (
        <OrderDetails
          order={selectedOrder}
          info={resolveOrderInfo(selectedOrder)}
          stock={snapshot.stockItems}
          onAddPart={(part) => addPart(selectedOrder, part)}
          onClose={() => setSelectedOrderId(null)}
          onDocument={() => showOrderDocument(selectedOrder)}
          onMove={(status) => moveOrder(selectedOrder, status)}
          onReceive={(method, amount) => receivePayment(selectedOrder, method, amount)}
        />
      ) : null}
      {documentText ? <DocumentModal text={documentText} onClose={() => setDocumentText("")} onPrint={() => printDocument(documentText)} /> : null}
      {!activeUser ? <LoginModal users={snapshot.users} onLogin={setActiveUserId} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

function OrdersView({ snapshot, onOpenOrder, onCreateOrder }: { snapshot: WorkshopSnapshot; onOpenOrder: (id: string) => void; onCreateOrder: () => void }) {
  return <>
    <div className="page-heading">
      <div><p className="eyebrow">OPERACAO DA OFICINA</p><h1>Ordens de servico</h1></div>
      <div className="heading-actions"><button className="primary-button" type="button" onClick={onCreateOrder}><Plus size={19} />Criar OS</button></div>
    </div>
    <div className="kanban" aria-label="Quadro de ordens de servico">
      {columns.map(({ id, label, Icon }) => {
        const items = snapshot.orders.filter((order) => order.status === id);
        return <section className={`kanban-column column-${id}`} key={id} aria-label={label}>
          <header className="column-header"><span className="column-icon"><Icon size={18} /></span><h2>{label}</h2><span className="column-count">{items.length}</span></header>
          <div className="order-list">
            {items.map((order) => <OrderCard key={order.id} order={order} snapshot={snapshot} onOpen={() => onOpenOrder(order.id)} />)}
            {items.length === 0 ? <div className="empty-column">Nenhuma OS nesta etapa.</div> : null}
          </div>
        </section>;
      })}
    </div>
  </>;
}

function OrderCard({ order, snapshot, onOpen }: { order: WorkshopServiceOrder; snapshot: WorkshopSnapshot; onOpen: () => void }) {
  const customer = snapshot.customers.find((item) => item.id === order.customerId);
  const vehicle = snapshot.vehicles.find((item) => item.id === order.vehicleId);
  const technician = snapshot.users.find((item) => item.id === order.technicianId);
  return <article className="order-card">
    <button className="order-main" type="button" onClick={onOpen} aria-label={`Abrir ${formatWorkshopOrderId(order.id)}`}>
      <span className="order-row"><strong>{formatWorkshopOrderId(order.id)}</strong><span className={`priority priority-${order.priority.toLocaleLowerCase("pt-BR")}`}><i />{order.priority}</span></span>
      <span className="vehicle-row"><span>{vehicle?.model ?? "Veiculo nao localizado"}</span><b>{vehicle?.plate ?? "-"}</b></span>
      <span className="customer-row"><UserRound size={16} />{customer?.name ?? "Cliente nao localizado"}</span>
      <span className="technician-row"><span className="mini-avatar">{initials(technician?.name ?? "OF")}</span><span>{technician?.name ?? "Tecnico"}</span><span className="delivery"><CalendarDays size={15} />{order.delivery}</span></span>
      <span className="card-total">{formatCurrency(getOrderTotal(order))}</span>
    </button>
  </article>;
}

function CustomersView({ snapshot, onPatch }: { snapshot: WorkshopSnapshot; onPatch: (patch: Partial<Omit<WorkshopSnapshot, "version" | "updatedAt">>) => void }) {
  const [draft, setDraft] = useState({ name: "", document: "", phone: "", email: "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const customer: WorkshopCustomer = { id: createId("CLI", snapshot.customers), name: draft.name.trim(), document: draft.document.trim() || "Nao informado", phone: draft.phone.trim(), email: draft.email.trim() || undefined, active: true };
    onPatch({ customers: [customer, ...snapshot.customers] });
    setDraft({ name: "", document: "", phone: "", email: "" });
  }
  return <CrudView title="Clientes" eyebrow="CADASTRO BASE">
    <form className="inline-form" onSubmit={submit}>
      <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nome" />
      <input value={draft.document} onChange={(event) => setDraft({ ...draft, document: event.target.value })} placeholder="CPF/CNPJ" />
      <input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="Telefone" />
      <button className="primary-button" type="submit"><Save size={18} />Salvar</button>
    </form>
    <DataTable>{snapshot.customers.map((customer) => <div className="data-row" key={customer.id}><span><strong>{customer.name}</strong><small>{customer.document}</small></span><span>{customer.phone || "Sem telefone"}</span><b>{customer.active ? "Ativo" : "Inativo"}</b></div>)}</DataTable>
  </CrudView>;
}

function VehiclesView({ snapshot, onPatch }: { snapshot: WorkshopSnapshot; onPatch: (patch: Partial<Omit<WorkshopSnapshot, "version" | "updatedAt">>) => void }) {
  const [draft, setDraft] = useState({ customerId: snapshot.customers[0]?.id ?? "", model: "", plate: "", year: "", mileage: "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.model.trim() || !draft.plate.trim()) return;
    const vehicle: WorkshopVehicle = { id: createId("VEI", snapshot.vehicles), customerId: draft.customerId, model: draft.model.trim(), plate: draft.plate.trim().toUpperCase(), year: draft.year.trim(), mileage: Number(draft.mileage) || 0 };
    onPatch({ vehicles: [vehicle, ...snapshot.vehicles] });
    setDraft({ ...draft, model: "", plate: "", year: "", mileage: "" });
  }
  return <CrudView title="Veiculos" eyebrow="CADASTRO BASE">
    <form className="inline-form" onSubmit={submit}>
      <select value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value })}>{snapshot.customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select>
      <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="Modelo" />
      <input value={draft.plate} onChange={(event) => setDraft({ ...draft, plate: event.target.value })} placeholder="Placa" />
      <button className="primary-button" type="submit"><Save size={18} />Salvar</button>
    </form>
    <DataTable>{snapshot.vehicles.map((vehicle) => <div className="data-row" key={vehicle.id}><span><strong>{vehicle.model}</strong><small>{snapshot.customers.find((customer) => customer.id === vehicle.customerId)?.name}</small></span><span>{vehicle.plate}</span><b>{vehicle.mileage.toLocaleString("pt-BR")} km</b></div>)}</DataTable>
  </CrudView>;
}

function StockView({ snapshot, onPatch }: { snapshot: WorkshopSnapshot; onPatch: (patch: Partial<Omit<WorkshopSnapshot, "version" | "updatedAt">>) => void }) {
  const [draft, setDraft] = useState({ name: "", sku: "", stock: "", minStock: "", price: "", supplier: "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const item: WorkshopStockItem = { id: createId("PEC", snapshot.stockItems), name: draft.name.trim(), sku: draft.sku.trim(), stock: Number(draft.stock) || 0, minStock: Number(draft.minStock) || 0, cost: 0, price: Number(draft.price) || 0, supplier: draft.supplier.trim() };
    onPatch({ stockItems: [item, ...snapshot.stockItems] });
    setDraft({ name: "", sku: "", stock: "", minStock: "", price: "", supplier: "" });
  }
  return <CrudView title="Estoque" eyebrow="PECAS E INSUMOS">
    <form className="inline-form stock-form" onSubmit={submit}>
      <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Peca" />
      <input value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} placeholder="Codigo" />
      <input value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} placeholder="Qtd" />
      <input value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="Preco" />
      <button className="primary-button" type="submit"><Save size={18} />Salvar</button>
    </form>
    <DataTable>{snapshot.stockItems.map((item) => <div className="data-row" key={item.id}><span><strong>{item.name}</strong><small>{item.sku} | Minimo: {item.minStock} | {item.supplier}</small></span><b className={item.stock <= item.minStock ? "low-stock" : ""}>{item.stock} un.</b><span>{formatCurrency(item.price)}</span></div>)}</DataTable>
  </CrudView>;
}

function FinanceView({ snapshot, onOpenOrder, onReceive }: { snapshot: WorkshopSnapshot; onOpenOrder: (id: string) => void; onReceive: (order: WorkshopServiceOrder, method: string, amount: number) => void }) {
  const summary = buildWorkshopFinancialSummary(snapshot);
  const completed = snapshot.orders.filter((order) => order.status === "finalizacao");
  return <CrudView title="Financeiro" eyebrow="RECEBIMENTOS">
    <div className="metric-grid">
      <Metric label="Finalizadas" value={String(summary.completedOrders)} />
      <Metric label="Total previsto" value={formatCurrency(summary.totalAmount)} />
      <Metric label="Recebido" value={formatCurrency(summary.paidAmount)} />
      <Metric label="Em aberto" value={formatCurrency(summary.openAmount)} tone={summary.openAmount > 0 ? "warn" : "ok"} />
    </div>
    <DataTable>{completed.map((order) => {
      const customer = snapshot.customers.find((item) => item.id === order.customerId);
      const balance = getOrderBalance(order);
      return <div className="data-row finance-row" key={order.id}>
        <button className="row-open" type="button" onClick={() => onOpenOrder(order.id)}><strong>{formatWorkshopOrderId(order.id)} | {customer?.name}</strong><small>Pago: {formatCurrency(getOrderPaidTotal(order))}</small></button>
        <b>{formatCurrency(balance)}</b>
        {balance > 0 ? <button className="secondary-button" type="button" onClick={() => onReceive(order, "PIX", balance)}>Receber</button> : <span className="paid-badge">Pago</span>}
      </div>;
    })}</DataTable>
  </CrudView>;
}

function DocumentsView({ snapshot, onDocument, onExport, onImportClick }: { snapshot: WorkshopSnapshot; onDocument: (order: WorkshopServiceOrder) => void; onExport: () => void; onImportClick: () => void }) {
  return <CrudView title="Documentos e backup" eyebrow="OPERACAO LOCAL">
    <div className="action-grid">
      <button className="primary-button" type="button" onClick={onExport}><Download size={18} />Exportar backup</button>
      <button className="secondary-button" type="button" onClick={onImportClick}><Upload size={18} />Restaurar backup</button>
    </div>
    <DataTable>{snapshot.orders.map((order) => <div className="data-row" key={order.id}><span><strong>{formatWorkshopOrderId(order.id)}</strong><small>{statusLabel(order.status)} | {formatCurrency(getOrderTotal(order))}</small></span><button className="secondary-button" type="button" onClick={() => onDocument(order)}><FileText size={17} />Ver OS</button></div>)}</DataTable>
  </CrudView>;
}

function SettingsView({ snapshot, onPatch }: { snapshot: WorkshopSnapshot; onPatch: (patch: Partial<Omit<WorkshopSnapshot, "version" | "updatedAt">>) => void }) {
  const [settings, setSettings] = useState(snapshot.settings);
  const technicians = snapshot.users.filter((user) => user.role === "tecnico");
  function submit(event: FormEvent) {
    event.preventDefault();
    onPatch({ settings });
  }
  return <CrudView title="Configuracoes" eyebrow="DADOS DA OFICINA">
    <form className="settings-form" onSubmit={submit}>
      <input value={settings.shopName} onChange={(event) => setSettings({ ...settings, shopName: event.target.value })} placeholder="Nome da oficina" />
      <input value={settings.document} onChange={(event) => setSettings({ ...settings, document: event.target.value })} placeholder="CPF/CNPJ" />
      <input value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} placeholder="Telefone" />
      <input value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} placeholder="Endereco" />
      <input type="number" min="1" max="90" value={settings.backupRetention} onChange={(event) => setSettings({ ...settings, backupRetention: Math.max(1, Number(event.target.value) || 14) })} placeholder="Copias automaticas" />
      <button className="primary-button" type="submit"><Save size={18} />Salvar configuracoes</button>
    </form>
    <section className="users-panel">
      <h2>Usuarios</h2>
      <div className="data-table">{snapshot.users.map((user) => <div className="data-row" key={user.id}><span><strong>{user.name}</strong><small>{user.role}</small></span><b>{user.active ? "Ativo" : "Inativo"}</b></div>)}</div>
      <p className="hint">Copias automaticas: manter as ultimas {settings.backupRetention}. Tecnicos cadastrados: {technicians.map((user) => user.name).join(", ")}</p>
    </section>
  </CrudView>;
}

function OrderModal({ snapshot, onClose, onCreate }: { snapshot: WorkshopSnapshot; onClose: () => void; onCreate: (draft: OrderDraft) => void }) {
  const firstVehicle = snapshot.vehicles[0];
  const [draft, setDraft] = useState({
    vehicleId: firstVehicle?.id ?? "",
    customerId: firstVehicle?.customerId ?? snapshot.customers[0]?.id ?? "",
    technicianId: snapshot.users.find((user) => user.role === "tecnico")?.id ?? snapshot.users[0]?.id ?? "",
    delivery: "Hoje, 17:00",
    priority: "Media" as WorkshopPriority,
    serviceName: snapshot.services[0]?.name ?? "",
    servicePrice: snapshot.services[0]?.price ?? 0,
    complaint: ""
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.vehicleId || !draft.customerId || !draft.complaint.trim()) return;
    onCreate(draft);
  }
  function setVehicle(vehicleId: string) {
    const vehicle = snapshot.vehicles.find((item) => item.id === vehicleId);
    setDraft({ ...draft, vehicleId, customerId: vehicle?.customerId ?? draft.customerId });
  }
  return <Modal title="Criar ordem de servico" eyebrow="NOVA OS" onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <label>Veiculo<select autoFocus value={draft.vehicleId} onChange={(event) => setVehicle(event.target.value)}>{snapshot.vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.model} | {vehicle.plate}</option>)}</select></label>
      <label>Cliente<select value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value })}>{snapshot.customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label>
      <label>Servico<select value={draft.serviceName} onChange={(event) => {
        const service = snapshot.services.find((item) => item.name === event.target.value);
        setDraft({ ...draft, serviceName: event.target.value, servicePrice: service?.price ?? draft.servicePrice });
      }}>{snapshot.services.map((service) => <option value={service.name} key={service.id}>{service.name}</option>)}</select></label>
      <label>Valor<input value={draft.servicePrice} onChange={(event) => setDraft({ ...draft, servicePrice: Number(event.target.value) || 0 })} /></label>
      <label>Tecnico<select value={draft.technicianId} onChange={(event) => setDraft({ ...draft, technicianId: event.target.value })}>{snapshot.users.filter((user) => user.role !== "atendente").map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
      <label>Entrega<input value={draft.delivery} onChange={(event) => setDraft({ ...draft, delivery: event.target.value })} /></label>
      <label>Prioridade<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as WorkshopPriority })}><option>Alta</option><option>Media</option><option>Baixa</option></select></label>
      <label className="wide-field">Relato do cliente<textarea value={draft.complaint} onChange={(event) => setDraft({ ...draft, complaint: event.target.value })} placeholder="Ex.: barulho ao frear, vazamento, revisao preventiva" /></label>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit"><Plus size={18} />Criar OS</button></div>
    </form>
  </Modal>;
}

function OrderDetails(props: {
  order: WorkshopServiceOrder;
  info: { customer: WorkshopCustomer; vehicle: WorkshopVehicle; technician: WorkshopUser };
  stock: WorkshopStockItem[];
  onAddPart: (item: WorkshopStockItem) => void;
  onClose: () => void;
  onDocument: () => void;
  onMove: (status: WorkshopOrderStatus) => void;
  onReceive: (method: string, amount: number) => void;
}) {
  const { order, info, stock, onAddPart, onClose, onDocument, onMove, onReceive } = props;
  const next = nextStatus(order.status);
  const [selectedStockId, setSelectedStockId] = useState(stock[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const balance = getOrderBalance(order);
  return <Modal title={formatWorkshopOrderId(order.id)} eyebrow="DETALHES DA OS" onClose={onClose}>
    <div className="details">
      <div className="detail-hero"><p>{order.complaint}</p><h3>{info.vehicle.model}</h3><span>{info.vehicle.plate} | {info.vehicle.mileage.toLocaleString("pt-BR")} km</span></div>
      <dl><div><dt>Cliente</dt><dd>{info.customer.name}</dd></div><div><dt>Tecnico</dt><dd>{info.technician.name}</dd></div><div><dt>Entrega</dt><dd>{order.delivery}</dd></div><div><dt>Status</dt><dd>{statusLabel(order.status)}</dd></div></dl>
      <section className="order-financials"><div className="section-title"><h3>Servicos e pecas</h3><strong>{formatCurrency(getOrderTotal(order))}</strong></div>{order.lines.map((item) => <div className="line-item" key={item.id}><span>{item.name}<small>{item.kind === "peca" ? "Peca" : "Servico"} | {item.quantity}x</small></span><b>{formatCurrency(item.quantity * item.unitPrice)}</b></div>)}<div className="add-part"><select value={selectedStockId} onChange={(event) => setSelectedStockId(event.target.value)}>{stock.map((item) => <option value={item.id} key={item.id}>{item.name} | {item.stock} un.</option>)}</select><button className="secondary-button" type="button" onClick={() => { const item = stock.find((entry) => entry.id === selectedStockId); if (item) onAddPart(item); }}>Adicionar peca</button></div></section>
      <section className="payment-box"><div><strong>Saldo</strong><b>{formatCurrency(balance)}</b></div><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select><button className="secondary-button" type="button" disabled={balance <= 0} onClick={() => onReceive(paymentMethod, balance)}>Receber saldo</button></section>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onDocument}><Printer size={18} />OS/Recibo</button><button className="secondary-button" type="button" onClick={onClose}>Fechar</button>{next ? <button className="primary-button" type="button" onClick={() => onMove(next)}>Mover para {statusLabel(next)}</button> : null}</div>
    </div>
  </Modal>;
}

function DocumentModal({ text, onClose, onPrint }: { text: string; onClose: () => void; onPrint: () => void }) {
  return <Modal title="Documento da ordem" eyebrow="IMPRESSAO" onClose={onClose}>
    <div className="document-preview"><pre>{text}</pre><div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Fechar</button><button className="primary-button" type="button" onClick={onPrint}><Printer size={18} />Imprimir</button></div></div>
  </Modal>;
}

function LoginModal({ users, onLogin }: { users: WorkshopUser[]; onLogin: (userId: string) => void }) {
  const [userId, setUserId] = useState(users.find((user) => user.role === "admin" && user.active)?.id ?? users[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const user = users.find((item) => item.id === userId);
    if (!user?.active || user.password !== password) {
      setError("Usuario ou senha invalidos.");
      return;
    }
    onLogin(user.id);
  }
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-label="Acesso ao sistema"><header><div><p className="eyebrow">ACESSO LOCAL</p><h2>Entrar no sistema</h2></div></header><form className="form-grid" onSubmit={submit}><label>Usuario<select autoFocus value={userId} onChange={(event) => setUserId(event.target.value)}>{users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name} - {user.role}</option>)}</select></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error ? <p className="hint">{error}</p> : null}<div className="modal-actions"><button className="primary-button" type="submit">Entrar</button></div></form></section></div>;
}

function CrudView({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return <section className="operational-view"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div></div>{children}</section>;
}

function DataTable({ children }: { children: ReactNode }) {
  return <div className="data-table">{children}</div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return <div className={`metric ${tone ? `metric-${tone}` : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Modal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="icon-button close-button" type="button" onClick={onClose} aria-label="Fechar">x</button></header>{children}</section></div>;
}

function createId(prefix: string, items: Array<{ id: string }>) {
  const sequence = Math.max(...items.map((item) => Number(item.id.replace(/\D/g, ""))).filter(Number.isFinite), 0) + 1;
  return `${prefix}-${String(sequence).padStart(3, "0")}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
