import type { CadDocument } from "../contracts/document";

export const createPerformanceFixture = (count: number): CadDocument => ({
  schemaVersion: 1, pages: [], layers: [], styles: {}, profileState: {}, extensions: {},
  elements: Array.from({ length: count }, (_, index) => ({ id: `fixture-${index}`, type: "placeholder-rect", x: index % 100, y: Math.floor(index / 100) }))
});

export const performanceFixtureSizes = [0, 100, 1_000, 5_000, 10_000] as const;
