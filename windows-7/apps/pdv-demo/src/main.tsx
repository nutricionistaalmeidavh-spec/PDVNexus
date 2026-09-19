import React from "react";
import ReactDOM from "react-dom/client";
import { BatchPhysicalTrackingDecor } from "./BatchPhysicalTrackingDecor";
import { LabelBatchTools } from "./LabelBatchTools";
import { PdvDemoApp } from "./PdvDemoApp";
import { PdvOpsDecor } from "./PdvOpsDecor";
import { ProductBatchFefoSync } from "./ProductBatchFefoSync";
import { SaleObservationDecor } from "./SaleObservationDecor";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <>
      <SaleObservationDecor />
      <BatchPhysicalTrackingDecor />
      <ProductBatchFefoSync />
      <LabelBatchTools />
      <PdvOpsDecor />
      <PdvDemoApp />
    </>
  </React.StrictMode>
);
