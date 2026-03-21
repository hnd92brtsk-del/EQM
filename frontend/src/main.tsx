import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AppThemeProvider } from "./context/ThemeContext";
import { DEFAULT_QUERY_GC_TIME, DEFAULT_QUERY_STALE_TIME } from "./api/queryDefaults";
import "./i18n";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: DEFAULT_QUERY_STALE_TIME,
      gcTime: DEFAULT_QUERY_GC_TIME
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </AppThemeProvider>
  </React.StrictMode>
);
