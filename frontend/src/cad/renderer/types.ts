import type { CadDocumentChangeSet, CadPoint, CadViewport } from "../contracts/document";

export type HitTestOptions = { tolerance?: number };
export type HitResult = { elementId: string; distance?: number };
export interface CadRenderer {
  mount(host: HTMLElement): Promise<void> | void;
  unmount(): void;
  sync(changes: CadDocumentChangeSet): void;
  setViewport(viewport: CadViewport): void;
  hitTest(point: CadPoint, options?: HitTestOptions): HitResult[];
  resize(width: number, height: number): void;
}
