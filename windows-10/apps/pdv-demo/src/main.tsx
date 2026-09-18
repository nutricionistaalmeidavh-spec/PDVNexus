import React from "react";
import ReactDOM from "react-dom/client";
import { BatchPhysicalTrackingDecor } from "./BatchPhysicalTrackingDecor";
import { CashierReferenceDecor } from "./CashierReferenceDecor";
import { CustomerPresentationDecor } from "./CustomerPresentationDecor";
import { LabelBatchTools } from "./LabelBatchTools";
import { PdvDemoApp } from "./PdvDemoApp";
import { ProductBatchFefoSync } from "./ProductBatchFefoSync";
import { SaleObservationDecor } from "./SaleObservationDecor";
import "./pdv-dense-v2.css";
import "./pdv-dense-v2-grid.css";
import "./pdv-cashier-v3.css";
import "./pdv-e55.css";
import "./pdv-observation-layout-fix.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="pdv-density-root" data-cashier-layout="dense-v2">
      <div className="pdv-operation-title" role="heading" aria-level={1}>VENDA (PDV)</div>
      <CashierReferenceDecor />
      <CustomerPresentationDecor />
      <SaleObservationDecor />
      <BatchPhysicalTrackingDecor />
      <ProductBatchFefoSync />
      <LabelBatchTools />
      <PdvDemoApp />
    </div>
  </React.StrictMode>
);