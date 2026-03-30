import type { PidSourceRef, PidSymbol } from "../../types/pid";

type UnknownRecord = Record<string, unknown>;

const DEFAULT_STANDARD = "ISA-5.1" as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function normalizePidSymbol(rawMeta: unknown, fallbackLibraryKey = "generic"): PidSymbol {
  const meta = asRecord(rawMeta);
  const rawPidSymbol = asRecord(meta.pidSymbol);
  const libraryKey = asString(rawPidSymbol.libraryKey) || asString(meta.shapeKey) || fallbackLibraryKey;
  const assetUrl = asString(rawPidSymbol.assetUrl);
  const standard = (asString(rawPidSymbol.standard) || DEFAULT_STANDARD) as PidSymbol["standard"];
  const source = asString(rawPidSymbol.source);

  if (source === "upload" && assetUrl) {
    return {
      source: "upload",
      libraryKey,
      assetUrl,
      standard,
    };
  }

  return {
    source: "library",
    libraryKey,
    standard,
  };
}

export function buildPidSymbolMeta(symbol: PidSymbol): Record<string, unknown> {
  const normalized = normalizePidSymbol({ pidSymbol: symbol, shapeKey: symbol.libraryKey }, symbol.libraryKey || "generic");
  return {
    shapeKey: normalized.libraryKey,
    pidSymbol: normalized,
  };
}

export function mergePidSymbolIntoMetaData(
  existingMetaData: Record<string, unknown> | null | undefined,
  symbol: PidSymbol
): Record<string, unknown> {
  return {
    ...(existingMetaData || {}),
    ...buildPidSymbolMeta(symbol),
  };
}

export function extractPidSymbolFromSourceRef(sourceRef?: PidSourceRef | null, fallbackLibraryKey = "generic"): PidSymbol {
  return normalizePidSymbol(sourceRef?.meta || null, fallbackLibraryKey);
}
