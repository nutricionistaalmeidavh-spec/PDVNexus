import React from "react";
import ReactDOM from "react-dom/client";
import { CashierReferenceDecor } from "./CashierReferenceDecor";
import { PdvDemoApp } from "./PdvDemoApp";
import "./pdv-dense-v2.css";
import "./pdv-dense-v2-grid.css";
import "./pdv-cashier-v3.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="pdv-density-root" data-cashier-layout="dense-v2">
      <div className="pdv-operation-title" role="heading" aria-level={1}>VENDA (PDV)</div>
      <CashierReferenceDecor />
      <PdvDemoApp />
    </div>
  </React.StrictMode>
);