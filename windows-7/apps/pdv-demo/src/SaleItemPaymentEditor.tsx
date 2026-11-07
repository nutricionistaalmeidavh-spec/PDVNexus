import { useMemo, useState, type CSSProperties } from "react";
import { effectiveItemTenders, resolveItemPayments,
  type AllocationSale, type ItemPaymentAssignment } from "./saleItemPayments";
import "./sale-item-payments.css";

type Props = {
  sale: AllocationSale;
  cashMethodNames?: readonly string[];
  onChange: (assignments: ItemPaymentAssignment[]) => void;
};
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtyLabel = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export function SaleItemPaymentEditor({ sale, cashMethodNames = [], onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const assignments = sale.paymentItemAssignments ?? [];
  const tenders = useMemo(() => [...effectiveItemTenders(sale, cashMethodNames).values()],
    [sale.payments, sale.netTotal, sale.paymentSummary?.changeDue, cashMethodNames]);
  const isMixed = tenders.length > 1;
  const allocation = useMemo(() => resolveItemPayments(sale, assignments, cashMethodNames),
    [sale, assignments, cashMethodNames]);
  const update = (itemId: string, method: string, raw: string) => {
    if (!raw.trim()) { onChange(assignments.filter(a => !(a.itemId === itemId && a.method === method))); return; }
    const quantity = Number(raw);
    if (!Number.isFinite(quantity) || quantity < 0) return;
    const other = assignments.filter(a => !(a.itemId === itemId && a.method === method));
    onChange(quantity ? [...other, { itemId, method, quantity }] : other);
  };
  if (!sale.items.length) return null;
  return <section className="sale-allocation" aria-label="Pagamento de cada produto">
    <div className="sale-allocation__head">
      <div><strong>Pagamento por produto</strong>
        <p>{isMixed ? "Venda com pagamentos diferentes: associe a quantidade de cada produto à forma recebida." :
          "Uma única forma de pagamento: cada produto será identificado automaticamente no relatório."}</p>
      </div>
      {isMixed && <button type="button" className="sale-allocation__toggle"
        aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
        {expanded ? "Fechar divisão" : "Dividir itens"}
      </button>}
    </div>
    {isMixed && !expanded && <p className="sale-allocation__notice">
      {assignments.length ? (allocation.error || "Distribuição conferida. Revise antes de finalizar.") :
        "Sem divisão informada, a venda continua normal, mas o relatório exibirá pagamento não identificado por item."}
    </p>}
    {isMixed && expanded && <>
      <div className="sale-allocation__table" role="group" aria-label="Distribuição de quantidades entre pagamentos">
        <div className="sale-allocation__row sale-allocation__column-head" style={{ "--allocation-cols": tenders.length } as CSSProperties}>
          <span>Produto / empreendimento</span>
          {tenders.map(t => <span key={t.method}>{t.method}<small>{money(t.cents / 100)}</small></span>)}
        </div>
        {sale.items.map(item => <div className="sale-allocation__row" key={item.id} style={{ "--allocation-cols": tenders.length } as CSSProperties}>
          <label className="sale-allocation__product">{item.productName}
            <small>{item.brand ? `Marca: ${item.brand} · ` : ""}{item.producer ? `Empreendimento: ${item.producer} · ` : ""}{item.productCode} · {qtyLabel(item.quantity)} {item.unitLabel} · {money(item.totalPrice)}</small>
          </label>
          {tenders.map(tender => {
            const value = assignments.find(a => a.itemId === item.id && a.method === tender.method)?.quantity;
            return <label key={tender.method}>
              <span className="sale-allocation__mobile-method">{tender.method}</span>
              <input type="number" min="0" max={item.quantity}
                step={item.unitLabel === "UN" ? "1" : "0.001"}
                aria-label={item.productName + ": quantidade em " + tender.method}
                value={value === undefined ? "" : String(value)}
                onChange={e => update(item.id, tender.method, e.target.value)}
                placeholder="0" />
            </label>;
          })}
        </div>)}
      </div>
      <p className={allocation.error ? "sale-allocation__error" :
        allocation.rows.length ? "sale-allocation__ok" : "sale-allocation__notice"} role="status">
        {allocation.error || (allocation.rows.length ?
          "Vínculos conciliados. Cada item e cada forma de pagamento serão registrados na venda." :
          "Preencha as quantidades dos itens em cada coluna. A soma deve bater com a venda e os recebimentos.")}
      </p>
      <p className="sale-allocation__foot">
        Para itens em unidades, distribua quantidades inteiras. Para itens por peso, até três casas decimais.
        Descontos são distribuídos proporcionalmente, com acerto dos centavos.
      </p>
      <button type="button" className="sale-allocation__clear" onClick={() => onChange([])}
        disabled={!assignments.length}>Limpar distribuição</button>
    </>}
  </section>;
}
