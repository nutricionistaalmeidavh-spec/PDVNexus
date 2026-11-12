import { useMemo, useState } from "react";
import { buildPdvProductSearchIndex, findPdvProductsIndexed, type PdvSearchableProduct } from "./productSearch";

export type PdvPickerProduct = PdvSearchableProduct & {
  stock: number;
  unitPrice: number;
  unitLabel?: string;
};
type Props<T extends PdvPickerProduct> = {
  products: readonly T[];
  initialSearch?: string;
  onSelect: (product: T) => void;
  onClose: () => void;
  onCreateProduct?: () => void;
};

const PAGE_SIZE = 30;
const formatMoney = (price: number) => price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PdvProductPicker<T extends PdvPickerProduct>({ products, initialSearch = "", onSelect, onClose, onCreateProduct }: Props<T>) {
  const [query, setQuery] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const searchIndex = useMemo(() => buildPdvProductSearchIndex(products), [products]);
  const matches = useMemo(() =>
    query.trim() ? findPdvProductsIndexed(searchIndex, query) : searchIndex.entries.map(({ product }) => product),
    [searchIndex, query]
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const items = matches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div data-pdv-product-picker="true" style={{
      position: "fixed", inset: 0, zIndex: 3000, background: "rgba(11, 28, 50, .70)",
      display: "grid", placeItems: "center", padding: "16px", boxSizing: "border-box"
    }}>
      <section role="dialog" aria-modal="true" aria-label="Escolher produto" style={{
        background: "#fff", color: "#0f172a", borderRadius: "12px", width: "min(920px, 100%)",
        maxHeight: "min(780px, 90vh)", display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 16px 60px rgba(10,25,47,.35)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", gap: "12px", borderBottom: "1px solid #e2e8f0" }}>
          <div><strong style={{ fontSize: "18px" }}>Escolher produto</strong><p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "12px" }}>Pesquise pelo nome, marca, código ou categoria. Toque no produto para adicionar à venda.</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar seleção de produtos" style={{ background: "#f1f5f9", border: 0, borderRadius: "6px", padding: "10px 14px", cursor: "pointer" }}>Fechar</button>
        </div>
        <div style={{ padding: "12px 18px" }}>
          <input autoFocus aria-label="Buscar produto por nome, marca, código ou categoria" placeholder="Ex.: café, Coca-Cola, 00101..." value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} style={{ width: "100%", padding: "12px", fontSize: "15px", border: "1px solid #cbd5e1", borderRadius: "8px", boxSizing: "border-box" }} />
          <p style={{ margin: "7px 0 0", color: "#64748b", fontSize: "12px" }}>{matches.length} produto(s) encontrado(s). Todos os resultados estão disponíveis por páginas.</p>
        </div>
        <div style={{ padding: "5px 18px 15px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(165px,1fr))", gap: "10px", overflowY: "auto" }}>
          {items.map((product) => <button type="button" key={product.productCode} onClick={() => onSelect(product)} disabled={product.stock <= 0} style={{
            border: "1px solid #cbd5e1", borderRadius: "9px", padding: "12px", textAlign: "left",
            background: product.stock > 0 ? "#fff" : "#f1f5f9", cursor: product.stock > 0 ? "pointer" : "not-allowed",
            color: "#0f172a", display: "grid", gap: "7px", minHeight: "114px", opacity: product.stock > 0 ? 1 : .6
          }}>
            <strong style={{ fontSize: "13px" }}>{product.productName}</strong>
            <span style={{ fontSize: "11px", color: "#64748b" }}>{product.brand ? product.brand + " · " : ""}{product.productCode} · Estoque {product.stock.toLocaleString("pt-BR")}</span>
            <b style={{ fontSize: "16px", color: "#0f4ea3" }}>{formatMoney(product.unitPrice)}</b>
          </button>)}
          {!matches.length ? <div style={{ display: "grid", gap: 9, gridColumn: "1 / -1", justifyItems: "start" }}>
            <p role="status">Nenhum produto encontrado. Experimente parte do nome ou código. Para cadastrar uma mercadoria nova, use a opção abaixo.</p>
            {onCreateProduct ? <button type="button" onClick={onCreateProduct} style={{ border: "1px solid #2563eb", color: "#fff", background: "#1d4ed8", borderRadius: 6, padding: "10px 14px", cursor: "pointer", fontWeight: 700 }}>Cadastrar novo produto</button> : null}
          </div> : null}
        </div>
        {totalPages > 1 ? <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "flex-end", borderTop: "1px solid #e2e8f0", padding: "10px 18px" }}>
          <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Anterior</button>
          <span>Página {safePage} de {totalPages}</span>
          <button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Próxima</button>
        </div> : null}
      </section>
    </div>
  );
}
