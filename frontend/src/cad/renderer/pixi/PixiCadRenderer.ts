import { Application, Container } from "pixi.js";
import type { CadDocumentChangeSet, CadPoint, CadViewport } from "../../contracts/document";
import type { CadRenderer, HitResult, HitTestOptions } from "../types";

export class PixiCadRenderer implements CadRenderer {
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private scene: Container | null = null;

  async mount(host: HTMLElement) {
    this.unmount();
    const app = new Application();
    await app.init({ backgroundAlpha: 0, antialias: true, preference: "webgl", resizeTo: host });
    this.app = app;
    this.host = host;
    this.scene = new Container();
    app.stage.addChild(this.scene);
    app.canvas.setAttribute("data-testid", "cad-pixi-canvas");
    host.replaceChildren(app.canvas);
    this.observer = new ResizeObserver(([entry]) => this.resize(entry.contentRect.width, entry.contentRect.height));
    this.observer.observe(host);
    this.resize(host.clientWidth, host.clientHeight);
  }

  unmount() {
    this.observer?.disconnect();
    this.observer = null;
    if (this.host) this.host.replaceChildren();
    this.scene?.destroy({ children: true });
    this.scene = null;
    this.app?.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    this.app = null;
    this.host = null;
  }

  sync(_changes: CadDocumentChangeSet) { /* Phase 0 deliberately has no scene entities. */ }
  setViewport(_viewport: CadViewport) { /* Phase 0 viewport contract only. */ }
  hitTest(_point: CadPoint, _options?: HitTestOptions): HitResult[] { return []; }
  resize(width: number, height: number) {
    if (width > 0 && height > 0) this.app?.renderer.resize(width, height);
  }
}
