import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installCloudflareWebAnalytics } from "./lib/cloudflare-web-analytics";
import "./styles.css";

installCloudflareWebAnalytics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
