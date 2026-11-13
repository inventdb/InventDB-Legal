import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { ToastProvider } from "./components/Toast";
import "./styles/global.css";
// casebook.css defines the shared components (buttons, inputs, tables,
// dialogs); module sheets come after it so a module can still refine them.
// chambers.css comes last: the frame, the docket and the dossier.
import "./styles/casebook.css";
import "./styles/analyze.css";
import "./styles/notifications.css";
import "./styles/reports.css";
import "./styles/workflows.css";
import "./styles/files.css";
import "./styles/import.css";
import "./styles/dashboard.css";
import "./styles/views.css";
import "./styles/drill.css";
import "./styles/calendar.css";
import "./styles/chambers.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
