import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 30_000,
  use: { baseURL: process.env.EQM_CAD_E2E_URL, headless: true }
});
