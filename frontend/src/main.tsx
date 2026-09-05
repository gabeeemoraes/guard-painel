import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/dashboard.css";
import "./styles/dashboard-shell.css";
import "./styles/responsive.css";
import "./styles/animations.css";
import "./styles/polish.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
