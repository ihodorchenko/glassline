import { type Disposable, disposeAll } from "../core/Disposable";

export interface StatusOverlayState {
  readonly lines: readonly string[];
}

/**
 * Development status overlay for Phase 1 verification.
 *
 * It is presentation only and is expected to be replaced by the HUD System.
 * DOM updates are throttled to avoid per-frame layout work.
 */
export class StatusOverlay implements Disposable {
  private static readonly UPDATE_INTERVAL_MS = 250;

  private readonly root: HTMLDivElement;
  private readonly content: HTMLPreElement;
  private lastUpdateAtMs = 0;
  private disposed = false;
  private visible = true;

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement("div");
    this.root.className = "gl-status";

    this.content = document.createElement("pre");
    this.content.style.margin = "0";

    this.root.append(this.content);
    parent.append(this.root);
  }

  update(lines: readonly string[], nowMs: number): void {
    if (this.disposed || nowMs - this.lastUpdateAtMs < StatusOverlay.UPDATE_INTERVAL_MS) {
      return;
    }

    this.lastUpdateAtMs = nowMs;
    this.content.textContent = lines.join("\n");
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.style.display = visible ? "" : "none";
  }

  isVisible(): boolean {
    return this.visible;
  }

  showFatal(title: string, details: string): void {
    if (this.disposed) {
      return;
    }

    this.root.classList.add("gl-status--fatal");
    this.content.textContent = `${title}\n\n${details}`;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.root.remove();
  }
}

/** Disposes a set of application resources in reverse order. */
export function disposeResources(resources: readonly (Disposable | null | undefined)[]): void {
  disposeAll(resources);
}
