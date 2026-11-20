import type { BootStage } from "../app/ApplicationConfig";
import {
  BOOT_ERROR_LABEL_KEY,
  bootStageDetailKey,
  bootStageLabelKey,
} from "../localization/ContentLocalization";
import { ENGLISH_RESOURCES } from "../localization/resources/en";
import { RUSSIAN_RESOURCES } from "../localization/resources/ru";
import type { TranslationResources } from "../localization/TranslationTypes";

interface StageCopy {
  readonly label: string;
  readonly detail: string;
  readonly progress: number;
}

/**
 * Authored English boot copy. It is the fallback source for
 * `boot.stage.<stage>.label|detail` resources (`docs/27` §2.2); a drift test
 * keeps `en.ts` and this table in sync.
 */
export const BOOT_STAGE_COPY: Record<BootStage, StageCopy> = {
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

/** Boot-screen language. Settings are not loaded yet, so the browser locale decides. */
export type BootLanguageId = "en" | "ru";

/**
 * Picks the boot-screen language from `navigator.language` (`ru*` → Russian,
 * everything else → English). The persisted `general.language` setting cannot be
 * used here because the boot screen paints before settings/storage initialize;
 * if the persisted preference differs, the in-game UI follows the setting while
 * the boot chrome follows the browser locale.
 */
export function detectBootLanguage(navigatorLanguage?: string | null): BootLanguageId {
  const language =
    navigatorLanguage ??
    (typeof navigator === "undefined" ? undefined : (navigator.language as string | undefined));

  return language?.toLowerCase().startsWith("ru") === true ? "ru" : "en";
}

function bootResources(languageId: BootLanguageId): TranslationResources {
  return languageId === "ru" ? RUSSIAN_RESOURCES : ENGLISH_RESOURCES;
}

const MIN_VISIBLE_MS = 900;
const HIDE_TRANSITION_MS = 420;

/** Authored fallback for the boot failure stage label. */
export const BOOT_ERROR_LABEL_FALLBACK = "UNABLE TO START";

/** Static tagline authored in `index.html`; the no-JS fallback stays English. */
export const BOOT_TAGLINE_FALLBACK = "First-person parkour";
export const BOOT_TAGLINE_KEY = "boot.tagline";

/**
 * Resolves the boot tagline for a boot language. The brand line
 * (`GLASSLINE / RUNNER NETWORK`) intentionally stays English.
 */
export function bootTagline(languageId: BootLanguageId): string {
  const value = bootResources(languageId)[BOOT_TAGLINE_KEY];

  return typeof value === "string" ? value : BOOT_TAGLINE_FALLBACK;
}

/**
 * Styled paper/ink boot loader that exists in index.html before the bundle
 * loads, then tracks Application initialization stages.
 */
export class BootLoader {
  private readonly root: HTMLElement | null;
  private readonly stage: HTMLElement | null;
  private readonly detail: HTMLElement | null;
  private readonly tagline: HTMLElement | null;
  private readonly fill: HTMLElement | null;
  private readonly percent: HTMLElement | null;
  private readonly track: HTMLElement | null;
  private readonly resources: TranslationResources;
  private readonly startedAt = performance.now();
  private hidden = false;

  constructor(
    documentRoot: Document = document,
    languageId: BootLanguageId = detectBootLanguage(),
  ) {
    this.root = documentRoot.getElementById("boot-loader");
    this.stage = documentRoot.getElementById("boot-stage");
    this.detail = documentRoot.getElementById("boot-detail");
    this.tagline = documentRoot.querySelector<HTMLElement>(".boot-loader__tagline");
    this.fill = documentRoot.getElementById("boot-fill");
    this.percent = documentRoot.getElementById("boot-percent");
    this.track = documentRoot.getElementById("boot-track");
    this.resources = bootResources(languageId);

    // index.html keeps the static English tagline for the no-JS case; the
    // localized tagline is applied as soon as the bundle runs, before the first
    // boot stage update, so the browser-locale language is visible early.
    if (this.tagline) {
      this.tagline.textContent = bootTagline(languageId);
    }
  }

  setStage(stage: BootStage): void {
    if (!this.root || this.hidden) {
      return;
    }

    const copy = this.resolveStageCopy(stage);

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
      this.stage.textContent = this.translate(BOOT_ERROR_LABEL_KEY, BOOT_ERROR_LABEL_FALLBACK);
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

  private resolveStageCopy(stage: BootStage): StageCopy {
    const authored = BOOT_STAGE_COPY[stage];

    return {
      ...authored,
      label: this.translate(bootStageLabelKey(stage), authored.label),
      detail: this.translate(bootStageDetailKey(stage), authored.detail),
    };
  }

  private translate(key: string, fallback: string): string {
    const value = this.resources[key];

    return typeof value === "string" ? value : fallback;
  }
}
