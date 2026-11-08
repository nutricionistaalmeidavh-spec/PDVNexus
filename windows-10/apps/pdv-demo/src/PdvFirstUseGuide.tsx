import { useState, type CSSProperties } from "react";
import { PdvGuidedDialog, guidedPrimaryStyle, guidedSecondaryStyle } from "./PdvGuidedDialog";

/**
 * Checklist de primeiro acesso. Os estados vêm do PDV/SQLite canônico.
 * Apenas a preferência de dispensar é armazenada pelo aplicativo hospedeiro.
 */
type Props = {
  storeReady: boolean;
  managerReady: boolean;
  productReady: boolean;
  cashReady: boolean;
  firstSaleDone: boolean;
  onConfigureStore: () => void;
  onConfigureManager: () => void;
  onAddProduct: () => void;
  onOpenCash: (initialAmount: string) => void;
  onStartSale: () => void;
  onDismiss: () => void;
};
type StepId = "store" | "manager" | "product" | "cash" | "sale";
type Step = { id: StepId; title: string; detail: string; done: boolean; optional: boolean; action: string };

const cardStyle: CSSProperties = {
  position: "fixed", left: "max(16px, min(240px, 17vw))", bottom: 16, zIndex: 1600,
  width: "min(370px, calc(100vw - 32px))", maxHeight: "min(74vh, 690px)", overflowY: "auto",
  padding: 16, background: "#fff", color: "#0f172a", border: "1px solid #dbe4ee",
  borderRadius: 14, boxShadow: "0 12px 38px rgba(15,23,42,.22)", boxSizing: "border-box"
};
const stepStyle: CSSProperties = {
  display: "flex", gap: 10, alignItems: "center", width: "100%", minHeight: 48,
  padding: "10px", border: "1px solid #e2e8f0", borderRadius: 9,
  background: "#f8fafc", textAlign: "left", color: "#0f172a", cursor: "pointer"
};
const smallButton: CSSProperties = {
  ...guidedSecondaryStyle, padding: "8px 12px", minHeight: 44, fontSize: 12
};

export function PdvFirstUseGuide({
  storeReady, managerReady, productReady, cashReady, firstSaleDone,
  onConfigureStore, onConfigureManager, onAddProduct, onOpenCash, onStartSale, onDismiss
}: Props) {
  const [initialAmount, setInitialAmount] = useState("0");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps: Step[] = [
    { id: "store", title: "Dados da loja", detail: storeReady ? "Nome e endereço informados" : "Identifique sua loja nos comprovantes", done: storeReady, optional: true, action: "Configurar loja" },
    { id: "manager", title: "Segurança e gerente", detail: managerReady ? "PIN gerencial configurado" : "Proteja operações sensíveis com PIN", done: managerReady, optional: true, action: "Configurar gerente" },
    { id: "product", title: "Cadastrar produto", detail: productReady ? "Há produto próprio cadastrado" : "Os cinco produtos de exemplo não contam", done: productReady, optional: false, action: "Cadastrar produto" },
    { id: "cash", title: "Abrir o caixa", detail: cashReady ? "Caixa já foi aberto" : "Informe o troco inicial ou comece com R$ 0,00", done: cashReady, optional: false, action: "Abrir caixa" },
    { id: "sale", title: "Primeira venda", detail: firstSaleDone ? "Primeira venda registrada" : "Inicie uma venda e finalize no caixa", done: firstSaleDone, optional: false, action: "Iniciar venda (F2)" }
  ];
  const completed = steps.filter((step) => step.done).length;
  const percentage = Math.round(100 * completed / steps.length);
  const operationReady = productReady && cashReady;
  const current = steps[stepIndex] ?? steps[0];

  const openStep = (index: number) => {
    setStepIndex(index);
    setWizardOpen(true);
  };
  const doAction = (step: Step) => {
    setWizardOpen(false);
    if (step.id === "store") onConfigureStore();
    if (step.id === "manager") onConfigureManager();
    if (step.id === "product") onAddProduct();
    if (step.id === "cash") onOpenCash(initialAmount);
    if (step.id === "sale") onStartSale();
  };

  return <div data-pdv-first-use-guide="true" role="complementary" aria-label="Preparação inicial do PDV" style={cardStyle}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
      <div>
        <strong style={{ fontSize: 17 }}>Prepare seu PDV</strong>
        <p style={{ margin: "5px 0 12px", fontSize: 12, color: "#64748b" }}>Configure o essencial no seu ritmo, sem serviços pagos.</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dispensar guia inicial" style={{ ...smallButton, minHeight: 36, whiteSpace: "nowrap" }}>Fazer depois</button>
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
      <strong>Preparação inicial</strong><span>{completed} de {steps.length}</span>
    </div>
    <div role="progressbar" aria-label="Etapas de primeiro acesso concluídas" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={steps.length}
      style={{ height: 8, borderRadius: 10, background: "#e2e8f0", overflow: "hidden", marginBottom: 12 }}>
      <div style={{ width: percentage + "%", height: "100%", background: "#2563eb", transition: "width .2s" }} />
    </div>
    <div style={{ display: "grid", gap: 7 }}>
      {steps.map((step, index) => <button key={step.id} type="button" onClick={() => openStep(index)} style={stepStyle}>
        <span aria-hidden="true" style={{ color: step.done ? "#15803d" : "#64748b", fontSize: 18, fontWeight: 700 }}>{step.done ? "✓" : "○"}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 13 }}>{step.title}</strong>
          <small style={{ display: "block", color: "#64748b", marginTop: 3 }}>{step.detail}</small>
        </span>
        <span style={{ fontSize: 11, color: step.done ? "#15803d" : "#475569", whiteSpace: "nowrap" }}>{step.done ? "Concluído" : step.optional ? "Opcional" : "Pendente"}</span>
      </button>)}
    </div>
    <p role="status" style={{ fontSize: 12, color: operationReady ? "#166534" : "#475569", margin: "12px 0" }}>
      {firstSaleDone ? "Sua primeira venda foi registrada. Você já pode continuar operando." :
        operationReady ? "Seu PDV está preparado para vender. Conclua a primeira venda quando desejar." :
        "Os cadastros podem ser feitos aos poucos. O tutorial não bloqueia o caixa."}
    </p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={() => openStep(steps.findIndex((step) => !step.done) < 0 ? 0 : steps.findIndex((step) => !step.done))}
        style={{ ...guidedPrimaryStyle, flex: 1, minHeight: 44, fontSize: 13 }}>Tutorial guiado</button>
      <button type="button" onClick={onDismiss} style={smallButton}>{firstSaleDone ? "Concluir" : "Começar a trabalhar"}</button>
    </div>

    {wizardOpen ? <PdvGuidedDialog
      title={current.title}
      description={current.detail}
      step={"PREPARAÇÃO DO PDV · ETAPA " + (stepIndex + 1) + " DE " + steps.length}
      onClose={() => setWizardOpen(false)}
      actions={<>
        <button type="button" style={smallButton} disabled={stepIndex === 0} onClick={() => setStepIndex((value) => Math.max(0, value - 1))}>Anterior</button>
        <button type="button" style={smallButton} onClick={() => stepIndex === steps.length - 1 ? setWizardOpen(false) : setStepIndex((value) => value + 1)}>
          {stepIndex === steps.length - 1 ? "Fechar roteiro" : "Próximo"}
        </button>
        <button type="button" style={guidedPrimaryStyle} onClick={() => doAction(current)} disabled={current.id === "cash" && cashReady}>
          {current.done && current.id !== "cash" ? "Revisar configuração" : current.action}
        </button>
      </>}>
      <div style={{ padding: 12, background: "#f8fafc", borderRadius: 9, fontSize: 13 }}>
        <strong>{current.done ? "Concluído" : current.optional ? "Etapa opcional" : "Etapa pendente"}</strong>
        <p style={{ margin: "6px 0 0", color: "#475569" }}>
          {current.id === "store" ? "Informe o nome e o endereço reais da loja em Configurações." :
           current.id === "manager" ? "Defina o PIN do gerente em Configurações para aprovar operações sensíveis." :
           current.id === "product" ? "Cadastre um produto real com preço e estoque. Os produtos de demonstração continuam apenas como exemplos." :
           current.id === "cash" ? "A abertura movimenta o caixa real. Informe o troco corretamente; não é uma simulação." :
           "Uma venda só fica concluída quando for finalizada no caixa. O tutorial não cria vendas fictícias."}
        </p>
      </div>
      {current.id === "cash" && !cashReady ? <label style={{ display: "grid", gap: 6, fontWeight: 700, fontSize: 13 }}>
        Troco inicial (R$)
        <input type="text" inputMode="decimal" aria-label="Troco inicial (R$)" value={initialAmount}
          onChange={(event) => setInitialAmount(event.target.value)} placeholder="Ex.: 150,00 (ou 0,00)"
          style={{ padding: 11, border: "1px solid #cbd5e1", borderRadius: 8, width: "100%", boxSizing: "border-box" }} />
      </label> : null}
      <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Você pode avançar, voltar ou fechar. O progresso é calculado pelos dados efetivamente salvos no PDV.</p>
    </PdvGuidedDialog> : null}
  </div>;
}
