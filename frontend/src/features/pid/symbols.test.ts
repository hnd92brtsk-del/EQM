import { describe, expect, it } from "vitest";

import { normalizePidSymbol } from "./symbols";

describe("normalizePidSymbol", () => {
  it("preserves explicit ISO-14617 symbols", () => {
    expect(
      normalizePidSymbol({
        pidSymbol: {
          source: "library",
          libraryKey: "crusher_jaw",
          standard: "ISO-14617",
        },
      })
    ).toEqual({
      source: "library",
      libraryKey: "crusher_jaw",
      standard: "ISO-14617",
    });
  });

  it("keeps legacy ISA-5.1 when present", () => {
    expect(
      normalizePidSymbol({
        pidSymbol: {
          source: "library",
          libraryKey: "generic",
          standard: "ISA-5.1",
        },
      })
    ).toEqual({
      source: "library",
      libraryKey: "generic",
      standard: "ISA-5.1",
    });
  });

  it("falls back to legacy default when no standard is stored", () => {
    expect(normalizePidSymbol({ shapeKey: "generic" })).toEqual({
      source: "library",
      libraryKey: "generic",
      standard: "ISA-5.1",
    });
  });

  it("prefers inferred fallback over generic library symbols", () => {
    expect(normalizePidSymbol({ shapeKey: "generic" }, "screen_vibratory")).toEqual({
      source: "library",
      libraryKey: "screen_vibratory",
      standard: "ISA-5.1",
    });
  });
});
