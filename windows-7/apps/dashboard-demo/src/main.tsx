import React from "react";
import ReactDOM from "react-dom/client";
import { DashboardDemoApp } from "./DashboardDemoApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DashboardDemoApp />
  </React.StrictMode>
);