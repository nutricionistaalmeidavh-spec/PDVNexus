import { useEffect, useMemo, useState } from "react";
import {
  buildProductLabelPreview,
  formatDateForLabel,
  upsertProductBatch,
  type ProductBatch,
  type ProductLabelBatchStore,
  type ProductLabelSizePreset
} from "./productLabels";
import { loadProductLabelBatchContext, saveProductLabelBatchStore } from "./productLabelBatchStore";
import "./pdv-label-batches.css";

type BatchUiDraft = {
  id: string;
  lotNumber: string;
  manufacturedAt: string;
  expiresAt: string;
  quantity: string;
  remainingQuantity: string;
};

type LabelUiDraft = {
  batchId: string;
  lotNumber: string;
  expiresAt: string;
  copies: string;
  sizePreset: ProductLabelSizePreset;
  customWidthMm: string;
  customHeightMm: string;
  showPrice: boolean;
  showLot: boolean;
  showExpiry: boolean;
};

const EMPTY_STORE: ProductLabelBatchStore = { version: 1, updatedAt: "", productIdentities: [], batches: [] };

function emptyBatchDraft(): BatchUiDraft {
  return { id: "", lotNumber: "", manufacturedAt: "", expiresAt: "", quantity: "", remainingQuantity: "" };
}

function emptyLabelDraft(): LabelUiDraft {
  return {
    batchId: "",
    lotNumber: "",
    expiresAt: "",
    copies: "1",
    sizePreset: "40x25",
    customWidthMm: "40",
    customHeightMm: "25",
    showPrice: true,
    showLot: true,
    showExpiry: true
  };
}

export function LabelBatchTools() {
  const [route, setRoute] = useState(readRoute);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof loadProductLabelBatchContext>>["products"]>([]);
  const [store, setStore] = useState<ProductLabelBatchStore>(EMPTY_STORE);
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [batchDraft, setBatchDraft] = useState<BatchUiDraft>(emptyBatchDraft);
  const [labelDraft, setLabelDraft] = useState<LabelUiDraft>(emptyLabelDraft);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleHashChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    if (open) void refreshContext();
  }, [open]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.productCode === selectedProductCode) ?? products[0],
    [products, selectedProductCode]
  );
  const productBatches = useMemo(
    () => store.batches.filter((batch) => batch.productCode === selectedProduct?.productCode),
    [store.batches, selectedProduct?.productCode]
  );
  const selectedBatch = productBatches.find((batch) => batch.id === labelDraft.batchId);
  const preview = selectedProduct ? buildProductLabelPreview(selectedProduct, {
    productCode: selectedProduct.productCode,
    batchId: labelDraft.batchId || undefined,
    lotNumber: labelDraft.lotNumber || undefined,
    expiresAt: labelDraft.expiresAt || undefined,
    copies: parsePositiveInteger(labelDraft.copies),
    sizePreset: labelDraft.sizePreset,
    customWidthMm: parseDecimal(labelDraft.customWidthMm),
    customHeightMm: parseDecimal(labelDraft.customHeightMm),
    showPrice: labelDraft.showPrice,
    showLot: labelDraft.showLot,
    showExpiry: labelDraft.showExpiry
  }, selectedBatch) : null;

  if (route !== "/produtos") return null;

  async function refreshContext() {
    setLoading(true);
    setMessage("");
    try {
      const context = await loadProductLabelBatchContext();
      setProducts(context.products);
      setStore(context.store);
      setSelectedProductCode((current) => context.products.some((product) => product.productCode === current)
        ? current
        : (context.products[0]?.productCode ?? ""));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar produtos, lotes e etiquetas.");
    } finally {
      setLoading(false);
    }
  }

  function changeProduct(productCode: string) {
    setSelectedProductCode(productCode);
    setBatchDraft(emptyBatchDraft());
    setLabelDraft(emptyLabelDraft());
    setMessage("");
  }

  async function saveBatch() {
    if (!selectedProduct) return;
    try {
      const previous = batchDraft.id ? store.batches.find((batch) => batch.id === batchDraft.id) : undefined;
      const result = upsertProductBatch(store.batches, {
        id: batchDraft.id || undefined,
        productCode: selectedProduct.productCode,
        lotNumber: batchDraft.lotNumber,
        manufacturedAt: batchDraft.manufacturedAt || undefined,
        expiresAt: batchDraft.expiresAt || undefined,
        quantity: parseDecimal(batchDraft.quantity),
        remainingQuantity: previous ? previous.remainingQuantity : undefined
      });
      const next = await saveProductLabelBatchStore({ ...store, batches: result.batches });
      setStore(next);
      setBatchDraft(emptyBatchDraft());
      chooseBatchForLabel(result.batch);
      setMessage(`Lote ${result.batch.lotNumber} salvo para ${selectedProduct.productName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o lote.");
    }
  }

  function editBatch(batch: ProductBatch) {
    setBatchDraft({
      id: batch.id,
      lotNumber: batch.lotNumber,
      manufacturedAt: batch.manufacturedAt ?? "",
      expiresAt: batch.expiresAt ?? "",
      quantity: String(batch.quantity),
      remainingQuantity: String(batch.remainingQuantity)
    });
    setMessage("");
  }

  function chooseBatchForLabel(batch?: ProductBatch) {
    setLabelDraft((current) => ({
      ...current,
      batchId: batch?.id ?? "",
      lotNumber: batch?.lotNumber ?? "",
      expiresAt: batch?.expiresAt ?? ""
    }));
  }

  return (
    <>
      <button className="pdv-label-tools-trigger" type="button" onClick={() => setOpen(true)}>
        Etiquetas e lotes
      </button>
      {open ? (
        <div className="pdv-label-tools-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="pdv-label-tools-dialog" role="dialog" aria-modal="true" aria-label="Etiquetas e lotes">
            <header className="pdv-label-tools-header">
              <div>
                <strong>Etiquetas e lotes</strong>
                <span>Validade por lote e preparação de etiquetas por produto.</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            </header>

            {loading ? <p className="pdv-label-tools-status">Carregando produtos...</p> : null}
            {message ? <p className="pdv-label-tools-status" role="status">{message}</p> : null}

            <div className="pdv-label-tools-product-row">
              <label>
                Produto
                <select value={selectedProduct?.productCode ?? ""} onChange={(event) => changeProduct(event.target.value)}>
                  {products.map((product) => (
                    <option key={product.productCode} value={product.productCode}>{product.productCode} — {product.productName}</option>
                  ))}
                </select>
              </label>
              {selectedProduct ? (
                <div className="pdv-label-tools-identity">
                  <span>Código de barras</span>
                  <strong>{selectedProduct.barcode || "Não informado"}</strong>
                  <small>{barcodeTypeLabel(selectedProduct.barcodeType)}</small>
                </div>
              ) : null}
            </div>

            {!selectedProduct && !loading ? <p>Nenhum produto cadastrado foi encontrado.</p> : null}

            {selectedProduct ? (
              <div className="pdv-label-tools-columns">
                <div className="pdv-label-tools-panel">
                  <div className="pdv-label-tools-panel-title">
                    <div>
                      <strong>Lotes e validade</strong>
                      <span>Um produto pode ter vários lotes e datas diferentes.</span>
                    </div>
                    {batchDraft.id ? <button type="button" onClick={() => setBatchDraft(emptyBatchDraft())}>Novo lote</button> : null}
                  </div>

                  <div className="pdv-label-tools-grid">
                    <label>Lote<input value={batchDraft.lotNumber} onChange={(event) => setBatchDraft({ ...batchDraft, lotNumber: event.target.value })} placeholder="Ex.: LT-2026-09" /></label>
                    <label>Quantidade<input inputMode="decimal" value={batchDraft.quantity} onChange={(event) => setBatchDraft({ ...batchDraft, quantity: event.target.value })} placeholder="Ex.: 24" /></label>
                    <label>Fabricação<input type="date" value={batchDraft.manufacturedAt} onChange={(event) => setBatchDraft({ ...batchDraft, manufacturedAt: event.target.value })} /></label>
                    <label>Validade<input type="date" value={batchDraft.expiresAt} onChange={(event) => setBatchDraft({ ...batchDraft, expiresAt: event.target.value })} /></label>
                  </div>
                  <button className="pdv-label-tools-primary" type="button" onClick={() => void saveBatch()}>{batchDraft.id ? "Atualizar lote" : "Salvar lote"}</button>
                  <small className="pdv-label-tools-help">Validade é opcional. Produtos sem validade continuam funcionando normalmente.</small>

                  <div className="pdv-label-tools-batches">
                    {productBatches.length ? productBatches.map((batch) => (
                      <article key={batch.id}>
                        <div><strong>{batch.lotNumber}</strong><span>Saldo: {batch.remainingQuantity} / {batch.quantity}</span></div>
                        <div><span>Fabricação: {batch.manufacturedAt ? formatDateForLabel(batch.manufacturedAt) : "—"}</span><span>Validade: {batch.expiresAt ? formatDateForLabel(batch.expiresAt) : "Sem validade"}</span></div>
                        <div className="pdv-label-tools-actions">
                          <button type="button" onClick={() => editBatch(batch)}>Editar</button>
                          <button type="button" onClick={() => chooseBatchForLabel(batch)}>Usar na etiqueta</button>
                        </div>
                      </article>
                    )) : <p>Nenhum lote cadastrado para este produto.</p>}
                  </div>
                </div>

                <div className="pdv-label-tools-panel">
                  <div className="pdv-label-tools-panel-title">
                    <div><strong>Preparar etiqueta</strong><span>Defina os dados e confira a prévia antes da impressão.</span></div>
                  </div>

                  <div className="pdv-label-tools-grid">
                    <label>Lote cadastrado<select value={labelDraft.batchId} onChange={(event) => chooseBatchForLabel(productBatches.find((batch) => batch.id === event.target.value))}><option value="">Sem lote / manual</option>{productBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.lotNumber}</option>)}</select></label>
                    <label>Cópias<input inputMode="numeric" value={labelDraft.copies} onChange={(event) => setLabelDraft({ ...labelDraft, copies: event.target.value })} /></label>
                    <label>Lote na etiqueta<input value={labelDraft.lotNumber} onChange={(event) => setLabelDraft({ ...labelDraft, lotNumber: event.target.value })} placeholder="Opcional" /></label>
                    <label>Validade na etiqueta<input type="date" value={labelDraft.expiresAt} onChange={(event) => setLabelDraft({ ...labelDraft, expiresAt: event.target.value })} /></label>
                    <label>Tamanho<select value={labelDraft.sizePreset} onChange={(event) => setLabelDraft({ ...labelDraft, sizePreset: event.target.value as ProductLabelSizePreset })}><option value="40x25">40 × 25 mm</option><option value="50x30">50 × 30 mm</option><option value="60x40">60 × 40 mm</option><option value="custom">Personalizado</option></select></label>
                    {labelDraft.sizePreset === "custom" ? <><label>Largura (mm)<input inputMode="decimal" value={labelDraft.customWidthMm} onChange={(event) => setLabelDraft({ ...labelDraft, customWidthMm: event.target.value })} /></label><label>Altura (mm)<input inputMode="decimal" value={labelDraft.customHeightMm} onChange={(event) => setLabelDraft({ ...labelDraft, customHeightMm: event.target.value })} /></label></> : null}
                  </div>

                  <div className="pdv-label-tools-checks">
                    <label><input type="checkbox" checked={labelDraft.showPrice} onChange={(event) => setLabelDraft({ ...labelDraft, showPrice: event.target.checked })} />Preço</label>
                    <label><input type="checkbox" checked={labelDraft.showLot} onChange={(event) => setLabelDraft({ ...labelDraft, showLot: event.target.checked })} />Lote</label>
                    <label><input type="checkbox" checked={labelDraft.showExpiry} onChange={(event) => setLabelDraft({ ...labelDraft, showExpiry: event.target.checked })} />Validade</label>
                  </div>

                  {preview ? (
                    <div className="pdv-label-preview-wrap">
                      <div className="pdv-label-preview" style={{ aspectRatio: `${preview.widthMm} / ${preview.heightMm}` }}>
                        <strong>{preview.productName}</strong>
                        {preview.priceText ? <b>{preview.priceText}</b> : null}
                        <div className="pdv-label-preview-barcode"><span>CÓDIGO DE BARRAS</span><code>{preview.barcode || "SEM CÓDIGO"}</code></div>
                        <div className="pdv-label-preview-meta">{preview.lotText ? <span>LOTE: {preview.lotText}</span> : null}{preview.expiryText ? <span>VAL: {preview.expiryText}</span> : null}</div>
                      </div>
                      <small>{preview.widthMm} × {preview.heightMm} mm · {preview.copies} {preview.copies === 1 ? "etiqueta" : "etiquetas"}</small>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function readRoute() {
  const route = window.location.hash.replace(/^#/, "").split("?")[0];
  return route || "/caixa";
}

function parseDecimal(value: string) {
  return Number(String(value ?? "").trim().replace(",", "."));
}

function parsePositiveInteger(value: string) {
  const number = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

function barcodeTypeLabel(value: "internal" | "gtin" | "manual") {
  if (value === "internal") return "Código interno do PDV";
  if (value === "gtin") return "GTIN/EAN informado";
  return "Código manual";
}
