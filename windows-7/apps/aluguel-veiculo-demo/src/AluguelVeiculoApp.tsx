import {
  Bell,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Coins,
  ContactRound,
  Download,
  FileText,
  Gauge,
  LogOut,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  Upload,
  UserRound
} from "lucide-react";
import { getDesktopStoreBridge } from "@nexus-core/desktop-runtime";
import {
  DEFAULT_RENTAL_STORE_KEY,
  availabilityLabel,
  buildRentalFinancialSummary,
  createBrowserRentalRepository,
  createRentalNumber,
  formatRentalId,
  getRentalBalance,
  getRentalDays,
  getRentalPaidTotal,
  getRentalTotal,
  initials,
  moveVehicleRental,
  nextStatus,
  registerRentalPayment,
  renderRentalContract,
  statusLabel,
  type RentalCustomer,
  type RentalExpense,
  type RentalPriority,
  type RentalSnapshot,
  type RentalStatus,
  type RentalUser,
  type RentalVehicle,
  type VehicleRental
} from "@nexus-core/module-aluguel-veiculo";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

type NavKey = "rentals" | "customers" | "vehicles" | "finance" | "documents" | "settings";
type RentalDraft = {
  vehicleId: string;
  customerId: string;
  attendantId: string;
  pickupDate: string;
  returnDate: string;
  priority: RentalPriority;
  days: number;
  dailyRate: number;
  notes: string;
};

const navItems: Array<{ id: NavKey; label: string; Icon: typeof CalendarDays }> = [
  { id: "rentals", label: "Locacoes", Icon: ClipboardCheck },
  { id: "customers", label: "Clientes", Icon: ContactRound },
  { id: "vehicles", label: "Frota", Icon: CarFront },
  { id: "finance", label: "Financeiro", Icon: Coins },
  { id: "documents", label: "Documentos", Icon: FileText },
  { id: "settings", label: "Configuracoes", Icon: Settings }
];

const columns: Array<{ id: RentalStatus; label: string; Icon: typeof ClipboardCheck }> = [
  { id: "reserva", label: "Reserva", Icon: ClipboardCheck },
  { id: "retirada", label: "Retirada", Icon: Search },
  { id: "em_uso", label: "Em uso", Icon: Gauge },
  { id: "devolucao", label: "Devolucao", Icon: Check }
];

const paymentMethods = ["PIX", "Dinheiro", "Credito", "Debito", "Boleto"];

export function AluguelVeiculoApp() {
  const repository = useMemo(() => createBrowserRentalRepository({ storage: window.localStorage }), []);
  const desktopStore = useMemo(() => getDesktopStoreBridge(), []);
  const [snapshot, setSnapshot] = useState<RentalSnapshot>(() => repository.load());
  const [desktopStoreReady, setDesktopStoreReady] = useState(false);
  const [storageLabel, setStorageLabel] = useState("Armazenamento local");
  const [activeNav, setActiveNav] = useState<NavKey>("rentals");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState("");
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const selectedRental = snapshot.rentals.find((rental) => rental.id === selectedRentalId) ?? null;
  const financialSummary = buildRentalFinancialSummary(snapshot);
  const unavailableCount = snapshot.vehicles.filter((vehicle) => vehicle.availability !== "disponivel").length;

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
      return desktopStore.load(DEFAULT_RENTAL_STORE_KEY).then((row) => {
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
      void desktopStore.save(DEFAULT_RENTAL_STORE_KEY, JSON.stringify(snapshot));
    }
  }, [desktopStore, desktopStoreReady, repository, snapshot]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function patchSnapshot(patch: Partial<Omit<RentalSnapshot, "version" | "updatedAt">>) {
    setSnapshot((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  }

  function resolveRentalInfo(rental: VehicleRental) {
    return {
      customer: snapshot.customers.find((item) => item.id === rental.customerId) ?? snapshot.customers[0],
      vehicle: snapshot.vehicles.find((item) => item.id === rental.vehicleId) ?? snapshot.vehicles[0],
      attendant: snapshot.users.find((item) => item.id === rental.attendantId) ?? snapshot.users[0]
    };
  }

  function moveRental(rental: VehicleRental, next: RentalStatus) {
    const moved = moveVehicleRental({ rental, vehicles: snapshot.vehicles, nextStatus: next });
    patchSnapshot({
      rentals: snapshot.rentals.map((item) => item.id === rental.id ? moved.rental : item),
      vehicles: moved.vehicles
    });
    setToast(`${formatRentalId(rental.id)} movida para ${statusLabel(next)}.`);
  }

  function receivePayment(rental: VehicleRental, method: string, amount: number) {
    try {
      const updated = registerRentalPayment(rental, { method, amount });
      patchSnapshot({ rentals: snapshot.rentals.map((item) => item.id === rental.id ? updated : item) });
      setToast(`Pagamento registrado em ${formatRentalId(rental.id)}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nao foi possivel registrar o pagamento.");
    }
  }

  function createRental(draft: RentalDraft) {
    const now = new Date().toISOString();
    const created: VehicleRental = {
      id: createRentalNumber(snapshot.rentals),
      vehicleId: draft.vehicleId,
      customerId: draft.customerId,
      attendantId: draft.attendantId,
      pickupDate: draft.pickupDate,
      returnDate: draft.returnDate,
      status: "reserva",
      priority: draft.priority,
      notes: draft.notes,
      checkoutChecklist: ["Documento e CNH conferidos", "Tanque registrado", "Fotos do veiculo anexadas"],
      lines: [{ id: `DIA-${now}`, name: "Diarias", quantity: draft.days, unitPrice: draft.dailyRate }],
      paymentStatus: "aberto",
      payments: [],
      createdAt: now,
      updatedAt: now
    };
    patchSnapshot({
      rentals: [created, ...snapshot.rentals],
      vehicles: snapshot.vehicles.map((vehicle) => vehicle.id === draft.vehicleId ? { ...vehicle, availability: "reservado" } : vehicle)
    });
    setModalOpen(false);
    setToast(`${formatRentalId(created.id)} criada.`);
  }

  function showRentalDocument(rental: VehicleRental) {
    const info = resolveRentalInfo(rental);
    setDocumentText(renderRentalContract({ rental, customer: info.customer, vehicle: info.vehicle, attendant: info.attendant, settings: snapshot.settings }));
  }

  function exportBackup() {
    const blob = new Blob([repository.exportSnapshot()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `backup-aluguel-veiculo-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Backup gerado.");
  }

  async function importBackup(file: File) {
    try {
      const imported = repository.importSnapshot(await file.text());
      setSnapshot(imported);
      setToast("Backup restaurado.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Nao foi possivel restaurar o backup.");
    }
  }

  function printDocument(text: string) {
    const printWindow = window.open("", "rental-document", "width=760,height=900");
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
          <span className="brand-mark">LV</span>
          <span><small>SISTEMA</small><strong>LOCADORA</strong></span>
        </div>
        <nav className="nav-list" aria-label="Navegacao principal">
          {navItems.map(({ id, label, Icon }) => (
            <button className={`nav-item ${activeNav === id ? "is-active" : ""}`} type="button" key={id} onClick={() => setActiveNav(id)}>
              <Icon size={21} strokeWidth={1.9} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="nav-bottom">
          <button className="nav-item" type="button" onClick={() => setToast("Manual e suporte entram na etapa final.")}><CircleHelp size={21} /><span>Ajuda</span></button>
          <button className="nav-item" type="button" onClick={() => setToast("Sessao local encerrada apenas na demonstracao.")}><LogOut size={21} /><span>Sair</span></button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="status-strip">
            <span>{snapshot.rentals.length} locacoes</span>
            <span>{financialSummary.availableVehicles} veiculos disponiveis</span>
            <span>{formatCurrency(financialSummary.openAmount)} em aberto</span>
            <span>{storageLabel}</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-button notification" type="button" aria-label="Alertas" title="Alertas" onClick={() => setActiveNav("vehicles")}><Bell size={21} /><b>{unavailableCount}</b></button>
            <button className="profile-button" type="button" onClick={() => setActiveNav("settings")}>
              <span className="profile-avatar">P</span>
              <span><strong>Paulo Mendes</strong><small>Administrador</small></span>
              <ChevronDown size={17} />
            </button>
          </div>
        </header>

        <section className="content">
          {activeNav === "rentals" ? <RentalsView snapshot={snapshot} onOpenRental={setSelectedRentalId} onCreateRental={() => setModalOpen(true)} /> : null}
          {activeNav === "customers" ? <CustomersView snapshot={snapshot} onPatch={patchSnapshot} /> : null}
          {activeNav === "vehicles" ? <VehiclesView snapshot={snapshot} onPatch={patchSnapshot} /> : null}
          {activeNav === "finance" ? <FinanceView snapshot={snapshot} onPatch={patchSnapshot} onOpenRental={setSelectedRentalId} onReceive={receivePayment} /> : null}
          {activeNav === "documents" ? <DocumentsView snapshot={snapshot} onDocument={showRentalDocument} onExport={exportBackup} onImportClick={() => importRef.current?.click()} /> : null}
          {activeNav === "settings" ? <SettingsView snapshot={snapshot} onPatch={patchSnapshot} /> : null}
        </section>
      </main>

      <input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void importBackup(file);
        event.currentTarget.value = "";
      }} />

      {modalOpen ? <RentalModal snapshot={snapshot} onClose={() => setModalOpen(false)} onCreate={createRental} /> : null}
      {selectedRental ? (
        <RentalDetails
          rental={selectedRental}
          info={resolveRentalInfo(selectedRental)}
          onClose={() => setSelectedRentalId(null)}
          onDocument={() => showRentalDocument(selectedRental)}
          onMove={(status) => moveRental(selectedRental, status)}
          onReceive={(method, amount) => receivePayment(selectedRental, method, amount)}
        />
      ) : null}
      {documentText ? <DocumentModal text={documentText} onClose={() => setDocumentText("")} onPrint={() => printDocument(documentText)} /> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

function RentalsView({ snapshot, onOpenRental, onCreateRental }: { snapshot: RentalSnapshot; onOpenRental: (id: string) => void; onCreateRental: () => void }) {
  const summary = buildRentalFinancialSummary(snapshot);
  return <>
    <div className="page-heading">
      <div><p className="eyebrow">OPERACAO DA LOCADORA</p><h1>Locacoes e reservas</h1></div>
      <div className="heading-actions"><button className="primary-button" type="button" onClick={onCreateRental}><Plus size={19} />Nova locacao</button></div>
    </div>
    <div className="metric-grid dashboard-strip">
      <Metric label="Receita prevista" value={formatCurrency(summary.grossRevenue)} />
      <Metric label="Resultado liquido" value={formatCurrency(summary.netResult)} tone={summary.netResult >= 0 ? "ok" : "warn"} />
      <Metric label="Frota locada" value={`${summary.rentedVehicles}/${snapshot.vehicles.length}`} />
      <Metric label="Em aberto" value={formatCurrency(summary.openAmount)} tone={summary.openAmount > 0 ? "warn" : "ok"} />
    </div>
    <div className="kanban" aria-label="Quadro de locacoes">
      {columns.map(({ id, label, Icon }) => {
        const items = snapshot.rentals.filter((rental) => rental.status === id);
        return <section className={`kanban-column column-${id}`} key={id} aria-label={label}>
          <header className="column-header"><span className="column-icon"><Icon size={18} /></span><h2>{label}</h2><span className="column-count">{items.length}</span></header>
          <div className="order-list">
            {items.map((rental) => <RentalCard key={rental.id} rental={rental} snapshot={snapshot} onOpen={() => onOpenRental(rental.id)} />)}
            {items.length === 0 ? <div className="empty-column">Nenhuma locacao nesta etapa.</div> : null}
          </div>
        </section>;
      })}
    </div>
  </>;
}

function RentalCard({ rental, snapshot, onOpen }: { rental: VehicleRental; snapshot: RentalSnapshot; onOpen: () => void }) {
  const customer = snapshot.customers.find((item) => item.id === rental.customerId);
  const vehicle = snapshot.vehicles.find((item) => item.id === rental.vehicleId);
  const attendant = snapshot.users.find((item) => item.id === rental.attendantId);
  return <article className="order-card">
    <button className="order-main" type="button" onClick={onOpen} aria-label={`Abrir ${formatRentalId(rental.id)}`}>
      <span className="order-row"><strong>{formatRentalId(rental.id)}</strong><span className={`priority priority-${rental.priority.toLocaleLowerCase("pt-BR")}`}><i />{rental.priority}</span></span>
      <span className="vehicle-row"><span>{vehicle?.model ?? "Veiculo nao localizado"}</span><b>{vehicle?.plate ?? "-"}</b></span>
      <span className="customer-row"><UserRound size={16} />{customer?.name ?? "Cliente nao localizado"}</span>
      <span className="technician-row"><span className="mini-avatar">{initials(attendant?.name ?? "LV")}</span><span>{attendant?.name ?? "Atendente"}</span><span className="delivery"><CalendarDays size={15} />{rental.returnDate}</span></span>
      <span className="card-total">{formatCurrency(getRentalTotal(rental))}</span>
    </button>
  </article>;
}

function CustomersView({ snapshot, onPatch }: { snapshot: RentalSnapshot; onPatch: (patch: Partial<Omit<RentalSnapshot, "version" | "updatedAt">>) => void }) {
  const [draft, setDraft] = useState({ name: "", document: "", phone: "", email: "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    const customer: RentalCustomer = { id: createId("CLI", snapshot.customers), name: draft.name.trim(), document: draft.document.trim() || "Nao informado", phone: draft.phone.trim(), email: draft.email.trim() || undefined, active: true };
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

function VehiclesView({ snapshot, onPatch }: { snapshot: RentalSnapshot; onPatch: (patch: Partial<Omit<RentalSnapshot, "version" | "updatedAt">>) => void }) {
  const [draft, setDraft] = useState({ model: "", plate: "", year: "", category: "", dailyRate: "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.model.trim() || !draft.plate.trim()) return;
    const vehicle: RentalVehicle = { id: createId("VEI", snapshot.vehicles), model: draft.model.trim(), plate: draft.plate.trim().toUpperCase(), year: draft.year.trim(), mileage: 0, category: draft.category.trim() || "Compacto", color: "Nao informado", dailyRate: Number(draft.dailyRate) || 0, purchasePrice: 0, availability: "disponivel" };
    onPatch({ vehicles: [vehicle, ...snapshot.vehicles] });
    setDraft({ model: "", plate: "", year: "", category: "", dailyRate: "" });
  }
  return <CrudView title="Frota" eyebrow="VEICULOS DA LOCADORA">
    <form className="inline-form" onSubmit={submit}>
      <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="Modelo" />
      <input value={draft.plate} onChange={(event) => setDraft({ ...draft, plate: event.target.value })} placeholder="Placa" />
      <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Categoria" />
      <input value={draft.dailyRate} onChange={(event) => setDraft({ ...draft, dailyRate: event.target.value })} placeholder="Diaria" />
      <button className="primary-button" type="submit"><Save size={18} />Salvar</button>
    </form>
    <DataTable>{snapshot.vehicles.map((vehicle) => <div className="data-row" key={vehicle.id}><span><strong>{vehicle.model}</strong><small>{vehicle.category} | {vehicle.color} | {vehicle.year}</small></span><span>{vehicle.plate}</span><b className={`availability availability-${vehicle.availability}`}>{availabilityLabel(vehicle.availability)}</b><span>{formatCurrency(vehicle.dailyRate)}/dia</span></div>)}</DataTable>
  </CrudView>;
}

function FinanceView({ snapshot, onPatch, onOpenRental, onReceive }: { snapshot: RentalSnapshot; onPatch: (patch: Partial<Omit<RentalSnapshot, "version" | "updatedAt">>) => void; onOpenRental: (id: string) => void; onReceive: (rental: VehicleRental, method: string, amount: number) => void }) {
  const summary = buildRentalFinancialSummary(snapshot);
  const [draft, setDraft] = useState({ description: "", category: "", amount: "", dueDate: "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.description.trim()) return;
    const expense: RentalExpense = { id: createId("DES", snapshot.expenses), description: draft.description.trim(), category: draft.category.trim() || "Geral", amount: Number(draft.amount) || 0, dueDate: draft.dueDate.trim() || "Sem data", paid: false };
    onPatch({ expenses: [expense, ...snapshot.expenses] });
    setDraft({ description: "", category: "", amount: "", dueDate: "" });
  }
  return <CrudView title="Financeiro" eyebrow="RECEITAS E DESPESAS">
    <div className="metric-grid">
      <Metric label="Receita prevista" value={formatCurrency(summary.grossRevenue)} />
      <Metric label="Recebido" value={formatCurrency(summary.paidAmount)} />
      <Metric label="Despesas" value={formatCurrency(summary.expensesAmount)} tone="warn" />
      <Metric label="Resultado" value={formatCurrency(summary.netResult)} tone={summary.netResult >= 0 ? "ok" : "warn"} />
    </div>
    <DataTable>{snapshot.rentals.map((rental) => {
      const customer = snapshot.customers.find((item) => item.id === rental.customerId);
      const balance = getRentalBalance(rental);
      return <div className="data-row finance-row" key={rental.id}>
        <button className="row-open" type="button" onClick={() => onOpenRental(rental.id)}><strong>{formatRentalId(rental.id)} | {customer?.name}</strong><small>Pago: {formatCurrency(getRentalPaidTotal(rental))}</small></button>
        <b>{formatCurrency(balance)}</b>
        {balance > 0 ? <button className="secondary-button" type="button" onClick={() => onReceive(rental, "PIX", balance)}>Receber</button> : <span className="paid-badge">Pago</span>}
      </div>;
    })}</DataTable>
    <form className="inline-form expense-form" onSubmit={submit}>
      <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Despesa" />
      <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Categoria" />
      <input value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="Valor" />
      <input value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} placeholder="Vencimento" />
      <button className="primary-button" type="submit"><Save size={18} />Adicionar</button>
    </form>
    <DataTable>{snapshot.expenses.map((expense) => <div className="data-row" key={expense.id}><span><strong>{expense.description}</strong><small>{expense.category} | Vence em {expense.dueDate}</small></span><b>{formatCurrency(expense.amount)}</b><span className={expense.paid ? "paid-badge" : "open-badge"}>{expense.paid ? "Pago" : "Aberto"}</span></div>)}</DataTable>
  </CrudView>;
}

function DocumentsView({ snapshot, onDocument, onExport, onImportClick }: { snapshot: RentalSnapshot; onDocument: (rental: VehicleRental) => void; onExport: () => void; onImportClick: () => void }) {
  return <CrudView title="Documentos e backup" eyebrow="CONTRATOS E OPERACAO LOCAL">
    <div className="action-grid">
      <button className="primary-button" type="button" onClick={onExport}><Download size={18} />Exportar backup</button>
      <button className="secondary-button" type="button" onClick={onImportClick}><Upload size={18} />Restaurar backup</button>
    </div>
    <DataTable>{snapshot.rentals.map((rental) => <div className="data-row" key={rental.id}><span><strong>{formatRentalId(rental.id)}</strong><small>{statusLabel(rental.status)} | {formatCurrency(getRentalTotal(rental))}</small></span><button className="secondary-button" type="button" onClick={() => onDocument(rental)}><FileText size={17} />Ver contrato</button></div>)}</DataTable>
  </CrudView>;
}

function SettingsView({ snapshot, onPatch }: { snapshot: RentalSnapshot; onPatch: (patch: Partial<Omit<RentalSnapshot, "version" | "updatedAt">>) => void }) {
  const [settings, setSettings] = useState(snapshot.settings);
  function submit(event: FormEvent) {
    event.preventDefault();
    onPatch({ settings });
  }
  return <CrudView title="Configuracoes" eyebrow="DADOS DA LOCADORA">
    <form className="settings-form" onSubmit={submit}>
      <input value={settings.companyName} onChange={(event) => setSettings({ ...settings, companyName: event.target.value })} placeholder="Nome da locadora" />
      <input value={settings.document} onChange={(event) => setSettings({ ...settings, document: event.target.value })} placeholder="CPF/CNPJ" />
      <input value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} placeholder="Telefone" />
      <input value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} placeholder="Endereco" />
      <button className="primary-button" type="submit"><Save size={18} />Salvar configuracoes</button>
    </form>
    <section className="users-panel">
      <h2>Usuarios</h2>
      <div className="data-table">{snapshot.users.map((user) => <div className="data-row" key={user.id}><span><strong>{user.name}</strong><small>{user.role}</small></span><b>{user.active ? "Ativo" : "Inativo"}</b></div>)}</div>
    </section>
  </CrudView>;
}

function RentalModal({ snapshot, onClose, onCreate }: { snapshot: RentalSnapshot; onClose: () => void; onCreate: (draft: RentalDraft) => void }) {
  const firstVehicle = snapshot.vehicles.find((vehicle) => vehicle.availability === "disponivel") ?? snapshot.vehicles[0];
  const [draft, setDraft] = useState({
    vehicleId: firstVehicle?.id ?? "",
    customerId: snapshot.customers[0]?.id ?? "",
    attendantId: snapshot.users[0]?.id ?? "",
    pickupDate: "Hoje, 09:00",
    returnDate: "Amanha, 18:00",
    priority: "Media" as RentalPriority,
    days: 1,
    dailyRate: firstVehicle?.dailyRate ?? 0,
    notes: ""
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.vehicleId || !draft.customerId) return;
    onCreate(draft);
  }
  function setVehicle(vehicleId: string) {
    const vehicle = snapshot.vehicles.find((item) => item.id === vehicleId);
    setDraft({ ...draft, vehicleId, dailyRate: vehicle?.dailyRate ?? draft.dailyRate });
  }
  return <Modal title="Nova locacao" eyebrow="RESERVA DE VEICULO" onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <label>Veiculo<select autoFocus value={draft.vehicleId} onChange={(event) => setVehicle(event.target.value)}>{snapshot.vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.model} | {vehicle.plate}</option>)}</select></label>
      <label>Cliente<select value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value })}>{snapshot.customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label>
      <label>Retirada<input value={draft.pickupDate} onChange={(event) => setDraft({ ...draft, pickupDate: event.target.value })} /></label>
      <label>Devolucao<input value={draft.returnDate} onChange={(event) => setDraft({ ...draft, returnDate: event.target.value })} /></label>
      <label>Diarias<input value={draft.days} onChange={(event) => setDraft({ ...draft, days: Number(event.target.value) || 1 })} /></label>
      <label>Valor da diaria<input value={draft.dailyRate} onChange={(event) => setDraft({ ...draft, dailyRate: Number(event.target.value) || 0 })} /></label>
      <label>Atendente<select value={draft.attendantId} onChange={(event) => setDraft({ ...draft, attendantId: event.target.value })}>{snapshot.users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
      <label>Prioridade<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as RentalPriority })}><option>Alta</option><option>Media</option><option>Baixa</option></select></label>
      <label className="wide-field">Observacoes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Ex.: retirada no aeroporto, motorista adicional, seguro completo" /></label>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit"><Plus size={18} />Criar locacao</button></div>
    </form>
  </Modal>;
}

function RentalDetails(props: {
  rental: VehicleRental;
  info: { customer: RentalCustomer; vehicle: RentalVehicle; attendant: RentalUser };
  onClose: () => void;
  onDocument: () => void;
  onMove: (status: RentalStatus) => void;
  onReceive: (method: string, amount: number) => void;
}) {
  const { rental, info, onClose, onDocument, onMove, onReceive } = props;
  const next = nextStatus(rental.status);
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const balance = getRentalBalance(rental);
  return <Modal title={formatRentalId(rental.id)} eyebrow="DETALHES DA LOCACAO" onClose={onClose}>
    <div className="details">
      <div className="detail-hero"><p>{rental.notes || "Locacao sem observacoes adicionais."}</p><h3>{info.vehicle.model}</h3><span>{info.vehicle.plate} | {info.vehicle.mileage.toLocaleString("pt-BR")} km | {getRentalDays(rental)} diaria(s)</span></div>
      <dl><div><dt>Cliente</dt><dd>{info.customer.name}</dd></div><div><dt>Atendente</dt><dd>{info.attendant.name}</dd></div><div><dt>Retirada</dt><dd>{rental.pickupDate}</dd></div><div><dt>Devolucao</dt><dd>{rental.returnDate}</dd></div></dl>
      <section className="order-financials"><div className="section-title"><h3>Valores</h3><strong>{formatCurrency(getRentalTotal(rental))}</strong></div>{rental.lines.map((item) => <div className="line-item" key={item.id}><span>{item.name}<small>{item.quantity}x</small></span><b>{formatCurrency(item.quantity * item.unitPrice)}</b></div>)}</section>
      <section className="checklist-box">{rental.checkoutChecklist.map((item) => <span key={item}><Check size={15} />{item}</span>)}</section>
      <section className="payment-box"><div><strong>Saldo</strong><b>{formatCurrency(balance)}</b></div><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select><button className="secondary-button" type="button" disabled={balance <= 0} onClick={() => onReceive(paymentMethod, balance)}>Receber saldo</button></section>
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={onDocument}><Printer size={18} />Contrato</button><button className="secondary-button" type="button" onClick={onClose}>Fechar</button>{next ? <button className="primary-button" type="button" onClick={() => onMove(next)}>Mover para {statusLabel(next)}</button> : null}</div>
    </div>
  </Modal>;
}

function DocumentModal({ text, onClose, onPrint }: { text: string; onClose: () => void; onPrint: () => void }) {
  return <Modal title="Contrato de locacao" eyebrow="IMPRESSAO" onClose={onClose}>
    <div className="document-preview"><pre>{text}</pre><div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Fechar</button><button className="primary-button" type="button" onClick={onPrint}><Printer size={18} />Imprimir</button></div></div>
  </Modal>;
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
