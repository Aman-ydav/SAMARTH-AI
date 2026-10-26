import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { bootstrapApp, rootErrorHandlers } from "@/app/bootstrap";
import { router } from "@/app/router";
import { store } from "@/app/store";

bootstrapApp({ store, router });

createRoot(document.getElementById("root"), rootErrorHandlers).render(
    <StrictMode>
        <App />
    </StrictMode>
);
