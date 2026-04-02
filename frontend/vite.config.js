import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
var appVersion = readFileSync(fileURLToPath(new URL("../VERSION", import.meta.url)), "utf-8").trim();
var devApiProxyTarget = process.env.VITE_DEV_API_PROXY_TARGET || "http://localhost:8000";
export default defineConfig({
    base: "/",
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(appVersion)
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (id.indexOf("node_modules") === -1)
                        return;
                    if (id.indexOf("reactflow") !== -1)
                        return "vendor-reactflow";
                    if (id.indexOf("recharts") !== -1)
                        return "vendor-recharts";
                    if (id.indexOf("@mui/material") !== -1 || id.indexOf("@mui/icons-material") !== -1 || id.indexOf("@emotion/") !== -1) {
                        return "vendor-mui";
                    }
                    if (id.indexOf("@tanstack/react-query") !== -1)
                        return "vendor-react-query";
                    if (id.indexOf("react-dom") !== -1 || id.indexOf("react-router-dom") !== -1 || id.indexOf("react/") !== -1) {
                        return "vendor-react";
                    }
                    return;
                }
            }
        }
    },
    server: {
        host: "0.0.0.0",
        port: 5173,
        proxy: {
            "/api": {
                target: devApiProxyTarget,
                changeOrigin: true
            }
        }
    },
    test: {
        environment: "jsdom",
        globals: true
    }
});
