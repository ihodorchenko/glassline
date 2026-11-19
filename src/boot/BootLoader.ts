import type { BootStage } from "../app/ApplicationConfig";

interface StageCopy {
  readonly label: string;
  readonly detail: string;
  readonly progress: number;
}

const STAGE_COPY: Record<BootStage, StageCopy> = {
  boot: {
    label: "BOOTING",
    detail: "Initiating runner network",
    progress: 6,
  },
  storage: {
    label: "RESTORING RUNNER DATA",
    detail: "Profile · settings · local records",
    progress: 18,
  },
  world: {
    label: "MAPPING THE CITY",
    detail: "City grid · far skyline",
    progress: 32,
  },
  materials: {
    label: "GENERATING MATERIALS",
    detail: "Concrete · glass · signage",
    progress: 48,
  },
  physics: {
    label: "BUILDING COLLISION",
    detail: "Capsule · roof colliders",
    progress: 61,
  },
  level: {
    label: "ASSEMBLING ROOFTOPS",
    detail: "Sections · checkpoints · props",
    progress: 74,
  },
  audio: {
    label: "TUNING THE MIX",
    detail: "Ambience · footsteps · score",
    progress: 87,
  },
  ui: {
    label: "OPENING THE MENU",
    detail: "Paper · ink · runner network",
    progress: 95,
  },
  ready: {
    label: "READY",
    detail: "Enter the city",
    progress: 100,
  },
};

const MIN_VISIBLE_MS = 900;
const HIDE_TRANSITION_MS = 420;

/**
 * Styled paper/ink boot loader that exists in index.html before the bundle
 * loads, then tracks Application initialization stages.
 */
export class BootLoader {
  private readonly root: HTMLElement | null;
  private readonly stage: HTMLElement | null;
  private readonly detail: HTMLElement | null;
  private readonly fill: HTMLElement | null;
  private readonly percent: HTMLElement | null;
  private readonly track: HTMLElement | null;
  private readonly startedAt = performance.now();
  private hidden = false;

  constructor(documentRoot: Document = document) {
    this.root = documentRoot.getElementById("boot-loader");
    this.stage = documentRoot.getElementById("boot-stage");
    this.detail = documentRoot.getElementById("boot-detail");
    this.fill = documentRoot.getElementById("boot-fill");
    this.percent = documentRoot.getElementById("boot-percent");
    this.track = documentRoot.getElementById("boot-track");
  }

  setStage(stage: BootStage): void {
    if (!this.root || this.hidden) {
      return;
    }

    const copy = STAGE_COPY[stage];

    if (this.stage) {
      this.stage.textContent = copy.label;
    }

    if (this.detail) {
      this.detail.textContent = copy.detail;
    }

    this.applyProgress(copy.progress);
  }

  complete(): void {
    if (!this.root || this.hidden) {
      return;
    }

    this.setStage("ready");
    this.root.classList.add("is-ready");

    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - this.startedAt));

    window.setTimeout(() => this.hide(), wait);
  }

  fail(error: unknown): void {
    if (!this.root) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);

    this.root.classList.add("is-error");
    this.root.classList.remove("is-ready");

    if (this.stage) {
      this.stage.textContent = "UNABLE TO START";
    }

    if (this.detail) {
      this.detail.textContent = message.slice(0, 160);
    }

    this.applyProgress(100);
  }

  hide(): void {
    if (!this.root || this.hidden) {
      return;
    }

    this.hidden = true;
    this.root.classList.add("is-hidden");
    window.setTimeout(() => this.root?.remove(), HIDE_TRANSITION_MS);
  }

  private applyProgress(progress: number): void {
    const value = Math.max(0, Math.min(100, progress));

    if (this.fill) {
      this.fill.style.width = `${value}%`;
    }

    if (this.percent) {
      this.percent.textContent = String(Math.round(value)).padStart(2, "0");
    }

    this.track?.setAttribute("aria-valuenow", String(Math.round(value)));
  }
}
