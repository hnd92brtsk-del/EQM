import { describe, expect, it } from "vitest";

import { MAIN_EQUIPMENT_SHAPE_OPTIONS } from "../../constants/pidPalette";
import { EQUIPMENT_SYMBOL_REGISTRY, getEquipmentSymbolSpec } from "./equipmentSymbolRegistry";

describe("equipmentSymbolRegistry", () => {
  it("contains a spec for every library shape option", () => {
    const libraryKeys = MAIN_EQUIPMENT_SHAPE_OPTIONS.map((item) => item.key);
    expect(Object.keys(EQUIPMENT_SYMBOL_REGISTRY).sort()).toEqual(libraryKeys.sort());
  });

  it("marks all main equipment library symbols as ISO-14617", () => {
    for (const key of Object.keys(EQUIPMENT_SYMBOL_REGISTRY)) {
      expect(getEquipmentSymbolSpec(key).standard).toBe("ISO-14617");
    }
  });

  it("falls back to the generic spec", () => {
    expect(getEquipmentSymbolSpec("missing").key).toBe("generic");
  });
});
