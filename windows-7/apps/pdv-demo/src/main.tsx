import React from "react";
import ReactDOM from "react-dom/client";
import { PdvDemoApp } from "./PdvDemoApp";
import { SaleObservationDecor } from "./SaleObservationDecor";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <>
      <SaleObservationDecor />
      <PdvDemoApp />
    </>
  </React.StrictMode>
);