import { describe, expect, it } from "vitest";

import {
  MAIN_EQUIPMENT_OBJECT_SYMBOLS,
  resolveMainEquipmentLibraryKey,
} from "./mainEquipmentObjectSymbols";

describe("mainEquipmentObjectSymbols", () => {
  it("provides an object-level symbol for every registered leaf object", () => {
    expect(MAIN_EQUIPMENT_OBJECT_SYMBOLS.length).toBeGreaterThan(100);
    expect(new Set(MAIN_EQUIPMENT_OBJECT_SYMBOLS.map((item) => item.libraryKey)).size).toBe(
      MAIN_EQUIPMENT_OBJECT_SYMBOLS.length
    );
  });

  it("resolves generic or missing keys through id/code mapping", () => {
    const spiralClassifier = MAIN_EQUIPMENT_OBJECT_SYMBOLS.find((item) => item.code === "4.1");
    expect(spiralClassifier).toBeTruthy();
    expect(
      resolveMainEquipmentLibraryKey({
        id: spiralClassifier!.id,
        code: spiralClassifier!.code,
        libraryKey: "generic",
      })
    ).toBe(spiralClassifier!.libraryKey);
  });
});
