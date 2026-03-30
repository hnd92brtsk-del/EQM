import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const appVersion = readFileSync(fileURLToPath(new URL("../VERSION", import.meta.url)), "utf-8").trim();

export default defineConfig({
  base: "/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("node_modules") === -1) return;

          if (id.indexOf("reactflow") !== -1) return "vendor-reactflow";
          if (id.indexOf("recharts") !== -1) return "vendor-recharts";
          if (id.indexOf("@mui/material") !== -1 || id.indexOf("@mui/icons-material") !== -1 || id.indexOf("@emotion/") !== -1) {
            return "vendor-mui";
          }
          if (id.indexOf("@tanstack/react-query") !== -1) return "vendor-react-query";
          if (id.indexOf("react-dom") !== -1 || id.indexOf("react-router-dom") !== -1 || id.indexOf("react/") !== -1) {
            return "vendor-react";
          }

          return;
        }
      }
    }
  },
  server: {
    host: "localhost",
    port: 5173
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
