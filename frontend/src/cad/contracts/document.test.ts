import { describe, expect, it } from "vitest";
import { createEmptyCadDocument, validateCadDocument } from "./document";

describe("CAD document validation", () => {
  it("accepts the Phase 0 v1 document", () => expect(validateCadDocument(createEmptyCadDocument()).schemaVersion).toBe(1));
  it("rejects unsupported versions", () => expect(() => validateCadDocument({ schemaVersion: 2 })).toThrow());
});
