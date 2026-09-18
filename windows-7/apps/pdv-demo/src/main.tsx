import React from "react";
import ReactDOM from "react-dom/client";
import { LabelBatchTools } from "./LabelBatchTools";
import { PdvDemoApp } from "./PdvDemoApp";
import { ProductBatchFefoSync } from "./ProductBatchFefoSync";
import { SaleObservationDecor } from "./SaleObservationDecor";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <>
      <SaleObservationDecor />
      <ProductBatchFefoSync />
      <LabelBatchTools />
      <PdvDemoApp />
    </>
  </React.StrictMode>
);