import { expect, test } from "@playwright/test";

const baseUrl = process.env.EQM_CAD_E2E_URL;
const token = process.env.EQM_CAD_E2E_TOKEN;
const documentId = process.env.EQM_CAD_E2E_DOCUMENT_ID;

test("CAD Pixi renderer mounts, resizes, and unmounts without crashing the SPA", async ({ page }) => {
  test.skip(!baseUrl || !token || !documentId, "Set EQM_CAD_E2E_URL, EQM_CAD_E2E_TOKEN and EQM_CAD_E2E_DOCUMENT_ID.");
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.addInitScript((value) => localStorage.setItem("eqm_token", value), token!);
  await page.goto(`/engineering/cad/${documentId}`);
  const canvas = page.getByTestId("cad-pixi-canvas");
  await expect(canvas).toBeVisible();
  const initialBounds = await canvas.boundingBox();
  expect(initialBounds?.width).toBeGreaterThan(0);
  expect(initialBounds?.height).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(canvas).toBeVisible();
  const resizedBounds = await canvas.boundingBox();
  expect(resizedBounds?.width).toBeGreaterThan(0);
  expect(resizedBounds?.height).toBeGreaterThan(0);
  await page.goto("/dashboard");
  await expect(page.locator("body")).toBeVisible();
  await page.goto(`/engineering/cad/${documentId}`);
  await expect(page.getByTestId("cad-pixi-canvas")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
