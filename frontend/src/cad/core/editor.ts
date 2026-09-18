import type { CadDocument, CadViewport } from "../contracts/document";

export interface CadEditor {
  readonly document: CadDocument;
  readonly viewport: CadViewport;
  readonly plugins: readonly string[];
  setTool(toolId: string): void;
  save(): Promise<void>;
  dispose(): void;
}
