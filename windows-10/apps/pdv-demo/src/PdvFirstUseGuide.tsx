import { useState } from "react";

type Props = {
  productReady: boolean;
  cashReady: boolean;
  onAddProduct: () => void;
  onOpenCash: (initialAmount: string) => void;
  onStartSale: () => void;
  onDismiss: () => void;
};

export function PdvFirstUseGuide({ productReady, cashReady, onAddProduct, onOpenCash, onStartSale, onDismiss }: Props) {
  const [initialAmount, setInitialAmount] = useState("0");
  return (
    <div data-pdv-first-use-guide="true" role="complementary" aria-label="Primeiros passos para usar o PDV" style={{
      position: "fixed", left: "max(16px, min(240px, 17vw))", bottom: "16px", zIndex: 1600,
      width: "min(330px, calc(100vw - 32px))", maxHeight: "68vh", overflowY: "auto",
      padding: "16px", background: "#fff", color: "#0f172a", border: "1px solid #dbe4ee",
      borderRadius: "10px", boxShadow: "0 12px 38px rgba(15,23,42,.22)", boxSizing: "border-box"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px" }}>
        <div><strong style={{ fontSize: "16px" }}>Primeiros passos</strong><p style={{ margin: "3px 0 10px", fontSize: "12px", color: "#64748b" }}>Configure o essencial e realize sua primeira venda.</p></div>
        <button type="button" onClick={onDismiss} aria-label="Dispensar guia inicial" style={{ border: 0, background: "transparent", color: "#475569", cursor: "pointer", fontSize: "12px" }}>Dispensar</button>
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        <button type="button" onClick={onAddProduct} style={buttonStyle}>{productReady ? "✓ " : "1. "}Cadastrar um produto</button>
        {!cashReady ? <label style={{ display: "grid", gap: "4px", fontSize: "12px", color: "#334155", fontWeight: 700 }}>
          Troco inicial (R$)
          <input type="text" inputMode="decimal" aria-label="Troco inicial (R$)" value={initialAmount} onChange={(event) => setInitialAmount(event.target.value)} placeholder="Ex.: 150,00 (ou 0,00)" style={{ padding: "9px", border: "1px solid #cbd5e1", borderRadius: 6, width: "100%", boxSizing: "border-box" }} />
        </label> : null}
        <button type="button" onClick={() => onOpenCash(initialAmount)} disabled={cashReady} style={{ ...buttonStyle, opacity: cashReady ? .7 : 1 }}>{cashReady ? "✓ Caixa já aberto" : "2. Abrir o caixa"}</button>
        <button type="button" onClick={onStartSale} style={{ ...buttonStyle, background: "#2563eb", color: "#fff", borderColor: "#2563eb" }}>3. Iniciar primeira venda (F2)</button>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#64748b" }}>Os cinco produtos de exemplo não são um limite de cadastro.</p>
    </div>
  );
}

const buttonStyle = {
  padding: "10px", minHeight: "40px", border: "1px solid #cbd5e1",
  borderRadius: "6px", background: "#f8fafc", fontWeight: 700,
  color: "#0f172a", cursor: "pointer", textAlign: "left" as const
};
