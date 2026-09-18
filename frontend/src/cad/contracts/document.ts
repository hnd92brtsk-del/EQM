export type CadPoint = { x: number; y: number };
export type CadRect = CadPoint & { width: number; height: number };
export type CadTransform = CadPoint & { rotation?: number; scaleX?: number; scaleY?: number };
export type CadViewport = { center: CadPoint; zoom: number };
export type CadPage = { id: string; name: string };
export type CadLayer = { id: string; name: string; pageId?: string; visible?: boolean; locked?: boolean };
export type CadBindingStatus = "resolved" | "missing" | "forbidden" | "unsupported";
export type CadEntityRef = { entityType: string; entityId: string };
export type CadBindingSnapshot = { name?: string };
export type CadBinding = CadEntityRef & { id: string; role?: string; snapshot?: CadBindingSnapshot };

export type CadDocument = {
  schemaVersion: 1;
  pages: CadPage[];
  layers: CadLayer[];
  elements: Array<{ id: string; type?: string; bindings?: CadBinding[]; [key: string]: unknown }>;
  styles: Record<string, unknown>;
  profileState: Record<string, unknown>;
  extensions: Record<string, unknown>;
};

export type CadDocumentMetadata = { name: string; description: string | null; profile: string; locationId: number | null };
export type CadDocumentRecord = CadDocumentMetadata & {
  id: number; schemaVersion: number; rowVersion: number; document: CadDocument;
  createdAt: string; updatedAt: string;
};
export type CadDocumentChangeSet = { document?: CadDocument; changedElementIds?: string[] };

export const createEmptyCadDocument = (): CadDocument => ({
  schemaVersion: 1, pages: [], layers: [], elements: [], styles: {}, profileState: {}, extensions: {}
});

export function validateCadDocument(value: unknown): CadDocument {
  if (!value || typeof value !== "object" || (value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new Error("Unsupported CAD document schemaVersion");
  }
  const document = value as Partial<CadDocument>;
  for (const key of ["pages", "layers", "elements"] as const) {
    if (!Array.isArray(document[key])) throw new Error(`Invalid CAD document ${key}`);
  }
  return document as CadDocument;
}

export function migrateCadDocument(value: unknown): CadDocument {
  return validateCadDocument(value);
}
