import type { UiCue } from "../audio/AudioManager";
import type { InputContext } from "../input/InputActions";
import type { InputFrame } from "../input/InputState";
import {
  levelCheckpointNameKey,
  trainingExerciseTitleKey,
} from "../localization/ContentLocalization";
import { getLanguageLabel } from "../localization/Language";
import type { SessionResults } from "../sessions/GameplaySessionManager";
import type { SettingsManager } from "../settings/SettingsManager";
import type { SettingDefinition, SettingsSnapshot, SettingValue } from "../settings/SettingsTypes";
import { formatRunTime } from "../speedrun/RunTimer";

export type UIScreen =
  | "main-menu"
  | "loading"
  | "pause"
  | "settings"
  | "results"
  | "credits"
  | "records"
  | "error";

export interface UIActions {
  onStartTraining(): void;
  onStartPrologue(): void;
  onStartSpeedrun(): void;
  onResume(): void;
  onRestart(): void;
  onAbandon(): void;
  onRetry(): void;
  onReturnToMenu(): void;
  onPause(): void;
  onAudioCue(cue: UiCue): void;
}

export interface UIManagerOptions {
  readonly localize: (key: string, params?: Readonly<Record<string, unknown>>) => string;
  readonly settings: SettingsManager;
  readonly actions: UIActions;
  readonly parent?: HTMLElement;
  readonly onScreenChanged?: () => void;
  /** Locale used for locale-sensitive formatting (dates, language labels). */
  readonly locale?: () => string;
}

export interface HudTrainingState {
  readonly current: number;
  readonly total: number;
  readonly title: string;
  readonly objectiveDescription: string;
  readonly value: number;
  readonly target: number;
}

export interface HudSpeedrunState {
  readonly elapsedMs: number;
  readonly checkpointsCompleted: number;
  readonly required: number;
  readonly splits: readonly {
    readonly index: number;
    readonly splitTimeMs: number;
    readonly totalTimeMs: number;
    /** Localized route-section name resolved by the Application. */
    readonly label?: string;
  }[];
  readonly medal: string | null;
}

export interface HudState {
  readonly mode: "training" | "prologue" | "speedrun" | null;
  readonly training: HudTrainingState | null;
  readonly speedrun: HudSpeedrunState | null;
  readonly interactionPrompt: string | null;
  readonly tutorialHint: { readonly title: string; readonly hint: string } | null;
  readonly speed: number;
  readonly movementState: string;
  readonly paused: boolean;
}

export interface UIAchievementEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly unlocked: boolean;
  readonly hidden: boolean;
}

export interface UIRecordEntry {
  readonly timeMs: number;
  readonly medal: string;
  readonly completedAt: number;
}

export interface UILongTermData {
  readonly trainingCompleted: number;
  readonly trainingTotal: number;
  readonly prologueCompleted: boolean;
  readonly prologueBestMs: number | null;
  readonly achievementsUnlocked: number;
  readonly achievementsTotal: number;
  readonly tutorialCompleted: number;
  readonly tutorialTotal: number;
  readonly milestones: number;
  readonly records: readonly UIRecordEntry[];
  readonly achievements: readonly UIAchievementEntry[];
  readonly statistics: {
    readonly totalSessions: number;
    readonly completedSessions: number;
    readonly totalPlayTimeSeconds: number;
    readonly totalDistanceMeters: number;
    readonly totalJumps: number;
    readonly totalVaults: number;
    readonly totalFalls: number;
    readonly totalCheckpoints: number;
  };
}

type ReturnContext = "main-menu" | "pause-menu";

export const SETTING_LABEL_KEYS: Readonly<Record<string, string>> = {
  "audio.master_volume": "settings.audio.master_volume",
  "audio.music_volume": "settings.audio.music_volume",
  "audio.sfx_volume": "settings.audio.sfx_volume",
  "audio.ui_volume": "settings.audio.ui_volume",
  "audio.muted": "settings.audio.muted",
  "controls.mouse_sensitivity": "settings.controls.mouse_sensitivity",
  "controls.invert_mouse_y": "settings.controls.invert_mouse_y",
  "controls.gamepad_sensitivity": "settings.controls.gamepad_sensitivity",
  "controls.invert_gamepad_y": "settings.controls.invert_gamepad_y",
  "controls.gamepad_dead_zone": "settings.controls.gamepad_dead_zone",
  "controls.gamepad_look_dead_zone": "settings.controls.gamepad_look_dead_zone",
  "camera.field_of_view": "settings.camera.field_of_view",
  "camera.bob_intensity": "settings.camera.bob_intensity",
  "camera.motion_intensity": "settings.camera.motion_intensity",
  "hud.enabled": "settings.hud.enabled",
  "hud.show_speed_indicator": "settings.hud.show_speed_indicator",
  "hud.show_speedrun_timer": "settings.hud.show_speedrun_timer",
  "hud.show_section_progress": "settings.hud.show_section_progress",
  "hud.show_training_objectives": "settings.hud.show_training_objectives",
  "hud.show_training_hints": "settings.hud.show_training_hints",
  "hud.show_interaction_prompts": "settings.hud.show_interaction_prompts",
  "hud.ui_scale": "settings.hud.ui_scale",
  "accessibility.reduced_motion": "settings.accessibility.reduced_motion",
  "accessibility.high_contrast": "settings.accessibility.high_contrast",
  "accessibility.color_independent_status": "settings.accessibility.color_independent_status",
  "accessibility.large_text": "settings.accessibility.large_text",
  "accessibility.reduce_grain": "settings.accessibility.reduce_grain",
  "gameplay.show_tutorial_hints": "settings.gameplay.show_tutorial_hints",
  "gameplay.contextual_assistance": "settings.gameplay.contextual_assistance",
  "gameplay.training_assistance": "settings.gameplay.training_assistance",
  "gameplay.show_checkpoint_feedback": "settings.gameplay.show_checkpoint_feedback",
  "general.language": "settings.language",
};

const SETTING_CATEGORY_ORDER = [
  "audio",
  "controls",
  "camera",
  "hud",
  "accessibility",
  "gameplay",
  "general",
] as const;

/**
 * Medal ids are gameplay data (`SpeedrunMedal`); the UI is the layer that maps
 * them to player-facing labels so RU/EN wording follows the active language.
 * `none` is rendered through `medal.none` instead of a template.
 */
const MEDAL_LABEL_KEYS: Readonly<Record<string, string>> = {
  gold: "medal.gold",
  silver: "medal.silver",
  bronze: "medal.bronze",
};

const UNSUPPORTED_SETTING_IDS = new Set([
  "display.fullscreen",
  "display.resolution",
  "display.quality",
  "display.vsync",
]);

const HUD_TIMER_THROTTLE_MS = 50;

/**
 * Non-colour status markers used when `accessibility.color_independent_status`
 * is enabled (`docs/26_ACCESSIBILITY_SYSTEM_SPEC.md` §10): state is carried by
 * a glyph/shape in addition to the accent colour, so it survives colour
 * blindness, monochrome displays and low-contrast environments.
 */
export type ColorIndependentStatus = "complete" | "incomplete" | "active-tab";

const COLOR_INDEPENDENT_MARKERS: Readonly<Record<ColorIndependentStatus, string>> = {
  complete: "✓",
  incomplete: "✗",
  "active-tab": "▸",
};

/**
 * Returns the non-colour prefix for a status, or an empty string when the
 * preference is disabled. Exported for unit testing; the DOM contract is the
 * rendered text of the results list and settings tabs.
 */
export function colorIndependentStatusMarker(
  status: ColorIndependentStatus,
  enabled: boolean,
): string {
  return enabled ? `${COLOR_INDEPENDENT_MARKERS[status]} ` : "";
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}

function humanizeSettingId(settingId: string): string {
  const segment = settingId.split(".").pop() ?? settingId;

  return segment
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Post-G5.1 contrast fix: the language value sits over the bright 3D backdrop at
 * 1280×720. It receives a solid paper/ink chip (`.gl-setting__value--chip`) so
 * its contrast no longer depends on whatever is rendered behind the panel.
 */
export function settingValueClassName(settingId: string): string {
  return settingId === "general.language"
    ? "gl-setting__value gl-setting__value--chip"
    : "gl-setting__value";
}

/**
 * Presentation layer for gameplay screens and HUD (`docs/07`, `docs/23`, `docs/24`).
 *
 * It renders authoritative snapshots provided by the Application and forwards
 * user actions through callbacks. It does not own gameplay or session state.
 */
export class UIManager {
  private readonly localize: UIManagerOptions["localize"];
  private readonly settings: SettingsManager;
  private readonly actions: UIActions;
  private readonly onScreenChanged: (() => void) | null;
  private readonly getLocale: () => string;

  private readonly root: HTMLDivElement;
  private readonly screensHost: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private readonly announcer: HTMLDivElement;

  private screen: UIScreen | null = null;
  private settingsReturnContext: ReturnContext = "main-menu";
  private settingsCategory = "audio";
  private settingsFocusedSettingId: string | null = null;
  private focusables: HTMLElement[] = [];
  private focusedIndex = 0;
  private readonly clickHandlers = new WeakMap<HTMLElement, () => void>();
  private readonly adjustHandlers = new WeakMap<HTMLElement, (direction: -1 | 1) => void>();
  private backHandler: (() => void) | null = null;

  private lastNavigationAtMs = 0;
  private lastDirection = 0;
  private lastHudUpdateAtMs = 0;
  private toastExpiresAtMs = 0;
  private toastQueue: { message: string; durationMs: number }[] = [];

  private reducedMotion = false;
  private highContrast = false;
  private colorIndependentStatus = true;
  private largeText = false;
  private uiScale = 1;
  private hudEnabled = true;
  private showSpeed = true;
  private showTimer = true;
  private showTrainingObjectives = true;
  private showInteractionPrompts = true;

  private hudSpeedrunPanel: HTMLDivElement;
  private hudSpeedrunTimer: HTMLDivElement;
  private hudSpeedrunCheckpoints: HTMLDivElement;
  private hudSpeedrunSplits: HTMLOListElement;
  private hudTrainingPanel: HTMLDivElement;
  private hudTrainingExercise: HTMLDivElement;
  private hudTrainingObjective: HTMLDivElement;
  private hudTrainingProgress: HTMLDivElement;
  private hudInteractionPrompt: HTMLDivElement;
  private hudTutorial: HTMLDivElement;
  private hudTutorialTitle: HTMLDivElement;
  private hudTutorialHint: HTMLDivElement;
  private hudSpeed: HTMLDivElement;
  private hudHint: HTMLDivElement;

  private longTermData: UILongTermData | null = null;
  private disposed = false;

  constructor(options: UIManagerOptions) {
    this.localize = options.localize;
    this.settings = options.settings;
    this.actions = options.actions;
    this.onScreenChanged = options.onScreenChanged ?? null;
    this.getLocale =
      options.locale ??
      (() =>
        typeof document === "undefined" ? "en-US" : document.documentElement.lang || "en-US");

    this.root = element("div", "gl-ui");
    this.screensHost = element("div", "gl-ui__screens");
    this.hud = element("div", "gl-hud");
    this.toast = element("div", "gl-toast");
    this.toast.setAttribute("role", "status");
    this.toast.setAttribute("aria-live", "polite");
    this.announcer = element("div", "gl-sr-only");
    this.announcer.setAttribute("aria-live", "assertive");

    this.hudSpeedrunPanel = element("div", "gl-hud__panel gl-hud__panel--timer");
    this.hudSpeedrunTimer = element("div", "gl-hud__timer");
    this.hudSpeedrunCheckpoints = element("div", "gl-hud__meta");
    this.hudSpeedrunSplits = element("ol", "gl-hud__splits");
    this.hudSpeedrunPanel.append(
      this.hudSpeedrunTimer,
      this.hudSpeedrunCheckpoints,
      this.hudSpeedrunSplits,
    );

    this.hudTrainingPanel = element("div", "gl-hud__panel gl-hud__panel--training");
    this.hudTrainingExercise = element("div", "gl-hud__meta");
    this.hudTrainingObjective = element("div", "gl-hud__objective");
    this.hudTrainingProgress = element("div", "gl-hud__progress");
    this.hudTrainingPanel.append(
      this.hudTrainingExercise,
      this.hudTrainingObjective,
      this.hudTrainingProgress,
    );

    this.hudInteractionPrompt = element("div", "gl-hud__prompt");
    this.hudTutorial = element("div", "gl-hud__tutorial");
    this.hudTutorialTitle = element("div", "gl-hud__tutorial-title");
    this.hudTutorialHint = element("div", "gl-hud__tutorial-hint");
    this.hudTutorial.append(this.hudTutorialTitle, this.hudTutorialHint);
    this.hudSpeed = element("div", "gl-hud__speed");
    this.hudHint = element("div", "gl-hud__hint");

    this.hud.append(
      this.hudSpeedrunPanel,
      this.hudTrainingPanel,
      this.hudSpeed,
      this.hudInteractionPrompt,
      this.hudTutorial,
      this.hudHint,
    );

    this.root.append(this.screensHost, this.hud, this.toast, this.announcer);
    (options.parent ?? document.body).append(this.root);

    this.root.addEventListener("keydown", this.handleTabTrap);
    this.applySettingsFromManager();
  }

  getActiveScreen(): UIScreen | null {
    return this.screen;
  }

  getInputContext(): InputContext {
    if (this.screen === "settings") {
      return "settings";
    }

    if (this.screen === "pause") {
      return "pause-menu";
    }

    if (this.screen === "results") {
      return "results";
    }

    if (this.screen === null) {
      return "gameplay";
    }

    return "main-menu";
  }

  getSettingsReturnContext(): ReturnContext {
    return this.settingsReturnContext;
  }

  setLongTermData(data: UILongTermData): void {
    this.longTermData = data;

    if (this.screen === "records") {
      this.showRecords();
    }
  }

  showMainMenu(): void {
    this.renderMainMenu();
  }

  showLoading(mode: "training" | "prologue" | "speedrun"): void {
    const screen = this.createScreen("common.loading", "gl-screen--loading");
    const label = this.localize(`loading.${mode}`);
    const loader = element("div", "gl-loading");
    const track = element("div", "gl-loading__track", "");

    track.append(element("div", "gl-loading__fill", ""));
    loader.setAttribute("role", "status");
    loader.setAttribute("aria-live", "polite");
    loader.append(
      element("p", "gl-loading__network", this.localize("loading.network")),
      element("div", "gl-loading__wordmark", "Glassline"),
      element("div", "gl-loading__rule", ""),
      element("p", "gl-loading__eyebrow", this.localize("loading.preparing")),
      element("h1", "gl-screen__title", this.localize("loading.mode", { mode: label })),
      element("p", "gl-screen__muted", this.localize("common.loading")),
      track,
      element("p", "gl-loading__detail", this.localize("loading.detail")),
    );
    screen.append(loader);
    this.setScreen("loading", screen);
  }

  showPause(): void {
    const screen = this.createScreen("pause.title", "gl-screen--panel");
    const buttons = element("div", "gl-menu");

    this.addMenuButton(buttons, this.localize("common.resume"), () => this.actions.onResume());
    this.addMenuButton(buttons, this.localize("pause.restart"), () => this.actions.onRestart());
    this.addMenuButton(buttons, this.localize("pause.settings"), () =>
      this.showSettings("pause-menu"),
    );
    this.addMenuButton(buttons, this.localize("pause.abandon"), () => this.actions.onAbandon());

    screen.append(buttons);
    this.backHandler = () => this.actions.onResume();
    this.setScreen("pause", screen);
  }

  showSettings(returnContext: ReturnContext): void {
    this.settingsReturnContext = returnContext;
    this.renderSettings();
  }

  showResults(results: SessionResults | null): void {
    this.resultsPayload = results;

    const screen = this.createScreen("results.title", "gl-screen--panel");
    const body = element("div", "gl-results");

    if (!results) {
      body.append(element("p", "gl-screen__muted", this.localize("results.noResults")));
    } else {
      const modeLabel = this.localize(
        results.mode === "training"
          ? "menu.training"
          : results.mode === "speedrun"
            ? "menu.rankedPrologue"
            : "menu.prologue",
      );

      body.append(
        element("div", "gl-results__row", this.localize("results.mode", { mode: modeLabel })),
        element(
          "div",
          "gl-results__row",
          this.localize("results.duration", { duration: formatRunTime(results.durationMs) }),
        ),
      );

      if (results.training) {
        const completed = results.training.exercises.filter(
          (exercise) => exercise.completed,
        ).length;

        body.append(
          element(
            "div",
            "gl-results__row",
            this.localize("results.trainingCompleted", {
              completed,
              total: results.training.exercises.length,
            }),
          ),
        );

        const list = element("ol", "gl-results__list");

        for (const exercise of results.training.exercises) {
          const exerciseTitle = this.localizeWithFallback(
            trainingExerciseTitleKey(exercise.exerciseId),
            exercise.title,
          );

          list.append(
            element(
              "li",
              exercise.completed ? "gl-results__item is-complete" : "gl-results__item",
              `${colorIndependentStatusMarker(
                exercise.completed ? "complete" : "incomplete",
                this.colorIndependentStatus,
              )}${exerciseTitle}${
                exercise.completed ? "" : ` ${this.localize("results.incomplete")}`
              } · ${this.localize("results.attempts", { count: exercise.attempts })}`,
            ),
          );
        }

        body.append(list);
      }

      if (results.speedrun) {
        const speedrun = results.speedrun;
        const medal = this.formatMedal(speedrun.medal);

        body.append(
          element(
            "div",
            "gl-results__row",
            this.localize("results.speedrunTime", { time: formatRunTime(speedrun.totalTimeMs) }),
          ),
          element(
            "div",
            "gl-results__row",
            this.localize("speedrun.checkpoints", {
              completed: speedrun.checkpointsCompleted,
              required: speedrun.splits.length,
            }),
          ),
          element(
            "div",
            "gl-results__row",
            medal === null
              ? this.localize("medal.none")
              : this.localize("speedrun.medal", { medal }),
          ),
          element(
            "div",
            "gl-results__row",
            speedrun.validation.valid
              ? this.localize("speedrun.valid")
              : this.localize("speedrun.invalid"),
          ),
        );

        const splits = element("ol", "gl-results__list");

        for (const split of speedrun.splits) {
          const checkpointName = this.localizeWithFallback(
            levelCheckpointNameKey(results.levelId, split.checkpointId),
            split.checkpointId,
          );

          splits.append(
            element(
              "li",
              "gl-results__item",
              `${checkpointName} · ${formatRunTime(split.splitTimeMs)} (${formatRunTime(split.totalTimeMs)})`,
            ),
          );
        }

        body.append(splits);
      }
    }

    const buttons = element("div", "gl-menu");

    this.addMenuButton(buttons, this.localize("common.retry"), () => this.actions.onRetry());
    this.addMenuButton(buttons, this.localize("common.mainMenu"), () =>
      this.actions.onReturnToMenu(),
    );

    body.append(buttons);
    screen.append(body);
    this.backHandler = () => this.actions.onReturnToMenu();
    this.setScreen("results", screen);
  }

  showCredits(): void {
    const screen = this.createScreen("credits.title", "gl-screen--panel");

    screen.append(
      element("p", "gl-screen__text", this.localize("credits.project")),
      element("p", "gl-screen__text", this.localize("credits.tech")),
      element("p", "gl-screen__text", this.localize("credits.inspiration")),
      element("p", "gl-screen__text", this.localize("credits.attribution")),
    );

    const buttons = element("div", "gl-menu");

    this.addMenuButton(buttons, this.localize("common.back"), () => this.showMainMenu());
    screen.append(buttons);
    this.backHandler = () => this.showMainMenu();
    this.setScreen("credits", screen);
  }

  showRecords(): void {
    const screen = this.createScreen("records.title", "gl-screen--panel");
    const body = element("div", "gl-results");
    const data = this.longTermData;

    if (data) {
      const records = data.records;
      const recordsTitle = element(
        "h2",
        "gl-results__heading",
        this.localize("records.prologueRecords"),
      );

      body.append(recordsTitle);

      if (records.length === 0) {
        body.append(element("p", "gl-screen__muted", this.localize("records.noRuns")));
      } else {
        const list = element("ol", "gl-results__list");

        for (const record of records.slice(0, 5)) {
          const medal = this.formatMedal(record.medal);
          const medalText =
            medal === null
              ? this.localize("medal.none")
              : this.localize("records.medalValue", { medal });
          const completedAt = new Date(record.completedAt).toLocaleDateString(this.getLocale());

          list.append(
            element(
              "li",
              "gl-results__item",
              `${formatRunTime(record.timeMs)} · ${medalText} · ${this.localize("records.completedAt", { date: completedAt })}`,
            ),
          );
        }

        body.append(list);
      }

      if (data.prologueBestMs !== null) {
        body.append(
          element(
            "div",
            "gl-results__row",
            this.localize("records.personalBest", { time: formatRunTime(data.prologueBestMs) }),
          ),
        );
      }

      body.append(
        element("h2", "gl-results__heading", this.localize("records.progress")),
        element(
          "div",
          "gl-results__row",
          this.localize("menu.progress", {
            training: `${data.trainingCompleted}/${data.trainingTotal}`,
            prologue: data.prologueCompleted
              ? this.localize("menu.prologueComplete")
              : this.localize("menu.prologueIncomplete"),
            achievements: `${data.achievementsUnlocked}/${data.achievementsTotal}`,
          }),
        ),
        element(
          "div",
          "gl-results__row",
          this.localize("records.tutorial", {
            completed: data.tutorialCompleted,
            total: data.tutorialTotal,
          }),
        ),
        element(
          "div",
          "gl-results__row",
          `${this.localize("records.statistics")} · ${this.localize("records.statSessions")}: ${data.statistics.totalSessions} · ${this.localize("records.statPlayTime")}: ${Math.round(data.statistics.totalPlayTimeSeconds)}s · ${this.localize("records.statDistance")}: ${Math.round(data.statistics.totalDistanceMeters)}m`,
        ),
        element(
          "div",
          "gl-results__row",
          `${this.localize("records.statJumps")}: ${data.statistics.totalJumps} · ${this.localize("records.statVaults")}: ${data.statistics.totalVaults} · ${this.localize("records.statFalls")}: ${data.statistics.totalFalls} · ${this.localize("records.statCheckpoints")}: ${data.statistics.totalCheckpoints}`,
        ),
      );

      body.append(element("h2", "gl-results__heading", this.localize("records.achievements")));

      const unlocked = data.achievements.filter((achievement) => achievement.unlocked);

      if (unlocked.length === 0) {
        body.append(element("p", "gl-screen__muted", this.localize("records.noAchievements")));
      } else {
        const achievementList = element("ol", "gl-results__list");

        for (const achievement of unlocked.slice(0, 6)) {
          achievementList.append(
            element("li", "gl-results__item", `${achievement.title} — ${achievement.description}`),
          );
        }

        body.append(achievementList);
      }
    } else {
      body.append(element("p", "gl-screen__muted", this.localize("records.empty")));
    }

    const buttons = element("div", "gl-menu");

    this.addMenuButton(buttons, this.localize("records.startPrologue"), () =>
      this.actions.onStartPrologue(),
    );
    this.addMenuButton(buttons, this.localize("common.back"), () => this.showMainMenu());
    body.append(buttons);
    screen.append(body);
    this.backHandler = () => this.showMainMenu();
    this.setScreen("records", screen);
  }

  showError(message: string): void {
    const screen = this.createScreen("error.title", "gl-screen--panel");

    screen.append(
      element("p", "gl-screen__text", message),
      element("p", "gl-screen__muted", this.localize("menu.hint")),
    );

    const buttons = element("div", "gl-menu");

    this.addMenuButton(buttons, this.localize("error.return"), () => this.actions.onReturnToMenu());
    screen.append(buttons);
    this.backHandler = () => this.actions.onReturnToMenu();
    this.setScreen("error", screen);
  }

  hideScreens(): void {
    this.screen = null;
    this.focusables = [];
    this.screensHost.replaceChildren();
    this.hud.classList.add("is-visible");
    this.notifyScreenChanged();
  }

  updateHud(state: HudState, nowMs: number): void {
    if (this.disposed) {
      return;
    }

    if (this.toastExpiresAtMs > 0 && nowMs >= this.toastExpiresAtMs) {
      this.toastExpiresAtMs = 0;

      const nextToast = this.toastQueue.shift();

      if (nextToast) {
        this.displayToast(nextToast.message, nowMs, nextToast.durationMs);
      } else {
        this.toast.textContent = "";
        this.toast.classList.remove("is-visible");
      }
    }

    if (nowMs - this.lastHudUpdateAtMs < HUD_TIMER_THROTTLE_MS) {
      return;
    }

    this.lastHudUpdateAtMs = nowMs;

    const showHud = this.screen === null && !state.paused && this.hudEnabled && state.mode !== null;

    this.hud.classList.toggle("is-visible", showHud);
    this.hud.classList.toggle("is-hidden", !showHud);

    if (!showHud) {
      return;
    }

    const showSpeedrun = state.speedrun !== null && this.showTimer;
    const showTraining = state.training !== null && this.showTrainingObjectives;

    this.hudSpeedrunPanel.classList.toggle("is-visible", showSpeedrun);
    this.hudTrainingPanel.classList.toggle("is-visible", showTraining);
    this.hudSpeed.classList.toggle("is-visible", this.showSpeed);
    this.hudInteractionPrompt.classList.toggle(
      "is-visible",
      this.showInteractionPrompts && state.interactionPrompt !== null,
    );
    this.hudTutorial.classList.toggle("is-visible", state.tutorialHint !== null);

    if (state.tutorialHint) {
      this.hudTutorialTitle.textContent = `${this.localize("hud.tutorial")} · ${state.tutorialHint.title}`;
      this.hudTutorialHint.textContent = state.tutorialHint.hint;
    }

    if (state.speedrun && this.showTimer) {
      this.hudSpeedrunTimer.textContent = formatRunTime(state.speedrun.elapsedMs);
      this.hudSpeedrunCheckpoints.textContent = this.localize("hud.checkpoints", {
        completed: state.speedrun.checkpointsCompleted,
        required: state.speedrun.required,
      });
      this.hudSpeedrunSplits.replaceChildren();

      for (const split of state.speedrun.splits.slice(-4)) {
        const splitLabel = split.label === undefined ? "" : `${split.label} · `;

        this.hudSpeedrunSplits.append(
          element(
            "li",
            "gl-hud__split",
            `${split.index + 1}. ${splitLabel}${formatRunTime(split.splitTimeMs)}`,
          ),
        );
      }
    }

    if (state.training && this.showTrainingObjectives) {
      this.hudTrainingExercise.textContent = this.localize("hud.exercise", {
        current: state.training.current,
        total: state.training.total,
      });
      this.hudTrainingObjective.textContent = state.training.title;
      this.hudTrainingProgress.textContent = `${state.training.objectiveDescription} · ${this.localize(
        "hud.progress",
        {
          value: formatHudNumber(state.training.value),
          target: formatHudNumber(state.training.target),
        },
      )}`;
    }

    this.hudInteractionPrompt.textContent = state.interactionPrompt ?? "";
    this.hudSpeed.textContent = `${this.localize("hud.speed")} ${state.speed.toFixed(1)} m/s`;
    this.hudHint.textContent = this.localize("hud.pauseHint");
  }

  showToast(message: string, nowMs: number, durationMs = 2200): void {
    if (this.disposed) {
      return;
    }

    if (this.toastExpiresAtMs > nowMs) {
      this.toastQueue.push({ message, durationMs });

      if (this.toastQueue.length > 5) {
        this.toastQueue.shift();
      }

      return;
    }

    this.displayToast(message, nowMs, durationMs);
  }

  private displayToast(message: string, nowMs: number, durationMs: number): void {
    this.toast.textContent = message;
    this.toast.classList.add("is-visible");
    this.toastExpiresAtMs = nowMs + durationMs;
    this.announce(message);
  }

  applySettings(snapshot: SettingsSnapshot): void {
    this.applySnapshot(snapshot);

    if (this.screen === "settings") {
      this.renderSettings();
    }
  }

  refreshLocalization(): void {
    if (!this.screen) {
      return;
    }

    switch (this.screen) {
      case "main-menu":
        this.showMainMenu();
        break;
      case "pause":
        this.showPause();
        break;
      case "settings":
        this.renderSettings();
        break;
      case "results":
        // Results content is data-driven; re-render with the last payload.
        if (this.resultsPayload) {
          this.showResults(this.resultsPayload);
        }
        break;
      case "credits":
        this.showCredits();
        break;
      case "records":
        this.showRecords();
        break;
      default:
        break;
    }
  }

  /** Processes keyboard/gamepad navigation for the active screen. */
  update(frame: InputFrame, nowMs: number): void {
    if (this.disposed || this.screen === null) {
      return;
    }

    const navigate = frame.navigate;
    const directionY = Math.abs(navigate.y) > 0.6 ? Math.sign(navigate.y) : 0;
    const directionX = Math.abs(navigate.x) > 0.6 ? Math.sign(navigate.x) : 0;

    if (directionY === 0 && directionX === 0) {
      this.lastDirection = 0;
    } else {
      const direction = directionY !== 0 ? (directionY > 0 ? -1 : 1) : directionX > 0 ? 1 : -1;
      const repeatDelayMs = this.lastDirection === direction ? 90 : 260;

      if (this.lastDirection !== direction || nowMs - this.lastNavigationAtMs >= repeatDelayMs) {
        this.lastNavigationAtMs = nowMs;
        this.lastDirection = direction;

        if (directionX !== 0 && directionY === 0) {
          this.adjustFocused(directionX > 0 ? 1 : -1);
        } else {
          this.moveFocus(direction);
        }
      }
    }

    if (frame.buttons.Confirm.pressed) {
      this.activateFocused();
    }

    if (frame.buttons.Cancel.pressed && this.backHandler) {
      this.actions.onAudioCue("back");
      this.backHandler();
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.root.removeEventListener("keydown", this.handleTabTrap);
    this.root.remove();
  }

  private resultsPayload: SessionResults | null = null;

  private renderMainMenu(): void {
    const screen = this.createScreen(null, "gl-screen--main-menu");
    screen.setAttribute("aria-label", this.localize("app.title"));
    const title = element("h1", "gl-screen__title gl-title", this.localize("app.title"));
    const subtitle = element("p", "gl-screen__subtitle", this.localize("menu.subtitle"));
    const buttons = element("div", "gl-menu");

    this.addMenuButton(buttons, this.localize("menu.training"), () =>
      this.actions.onStartTraining(),
    );
    this.addMenuButton(buttons, this.localize("menu.prologue"), () =>
      this.actions.onStartPrologue(),
    );
    this.addMenuButton(buttons, this.localize("menu.rankedPrologue"), () =>
      this.actions.onStartSpeedrun(),
    );
    this.addMenuButton(buttons, this.localize("menu.localRecords"), () => this.showRecords());
    this.addMenuButton(buttons, this.localize("menu.settings"), () =>
      this.showSettings("main-menu"),
    );
    this.addMenuButton(buttons, this.localize("menu.credits"), () => this.showCredits());

    const footer = element("div", "gl-screen__footer");

    if (this.longTermData) {
      footer.append(
        element(
          "div",
          "gl-screen__progress",
          this.localize("menu.progress", {
            training: `${this.longTermData.trainingCompleted}/${this.longTermData.trainingTotal}`,
            prologue: this.longTermData.prologueCompleted
              ? this.localize("menu.prologueComplete")
              : this.localize("menu.prologueIncomplete"),
            achievements: `${this.longTermData.achievementsUnlocked}/${this.longTermData.achievementsTotal}`,
          }),
        ),
      );
    }

    footer.append(
      element("div", "gl-menu-hint", this.localize("menu.hint")),
      element("div", "gl-screen__muted", this.localize("menu.version", { version: "0.1.0" })),
    );

    screen.append(title, subtitle, buttons, footer);
    this.backHandler = null;
    this.setScreen("main-menu", screen);
  }

  private renderSettings(): void {
    const screen = this.createScreen("settings.title", "gl-screen--panel gl-screen--settings");
    const tabs = element("div", "gl-tabs", undefined);
    tabs.setAttribute("role", "tablist");

    const definitions = this.visibleSettingsDefinitions();
    const categories = SETTING_CATEGORY_ORDER.filter((category) =>
      definitions.some((definition) => definition.category === category),
    );

    if (!categories.includes(this.settingsCategory as (typeof categories)[number])) {
      this.settingsCategory = categories[0] ?? "audio";
    }

    for (const category of categories) {
      const isActive = category === this.settingsCategory;
      const tabLabel = this.localize(
        `settings.categories.${category === "general" ? "language" : category}`,
      );
      // Color-independent status: the selected tab also carries a shape/position
      // marker, not only the accent colour + aria-selected state.
      const tabMarker = isActive
        ? colorIndependentStatusMarker("active-tab", this.colorIndependentStatus)
        : "";
      const tab = this.createActionElement(
        "div",
        `gl-tab${isActive ? " is-active" : ""}`,
        `${tabMarker}${tabLabel}`,
        () => {
          this.settingsCategory = category;
          this.renderSettings();
        },
      );
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(category === this.settingsCategory));
      tabs.append(tab);
    }

    const list = element("div", "gl-settings");

    for (const definition of definitions.filter(
      (candidate) => candidate.category === this.settingsCategory,
    )) {
      list.append(this.createSettingRow(definition));
    }

    const reset = this.createActionElement(
      "div",
      "gl-settings__reset",
      this.localize("settings.resetCategory"),
      () => {
        void this.settings
          .resetCategory(definitionCategory(this.settingsCategory))
          .then((result) => {
            if (!result.applied) {
              console.warn(
                `[Glassline] Settings reset failed: ${result.issues.map((issue) => issue.message).join("; ")}`,
              );
            }
          })
          .catch((error: unknown) => console.warn("[Glassline] Settings reset failed.", error));
      },
    );
    list.append(reset);
    list.append(element("div", "gl-settings__hint", this.localize("settings.applyHint")));
    list.append(element("div", "gl-settings__hint", this.localize("settings.hiddenUnsupported")));

    const buttons = element("div", "gl-menu");

    this.addMenuButton(buttons, this.localize("common.back"), () => this.closeSettings());
    screen.append(tabs, list, buttons);
    this.backHandler = () => this.closeSettings();
    this.setScreen("settings", screen);

    const remembered = this.settingsFocusedSettingId
      ? screen.querySelector<HTMLElement>(
          `[data-setting-id="${this.settingsFocusedSettingId}"] .gl-setting__control`,
        )
      : null;
    const firstSetting = remembered ?? screen.querySelector<HTMLElement>(".gl-setting__control");

    if (firstSetting) {
      this.focusElement(firstSetting);
    }
  }

  private closeSettings(): void {
    if (this.settingsReturnContext === "pause-menu") {
      this.showPause();
    } else {
      this.showMainMenu();
    }
  }

  private createSettingRow(definition: SettingDefinition): HTMLElement {
    const row = element("div", "gl-setting");
    row.setAttribute("role", "group");
    row.setAttribute("data-setting-id", definition.id);

    const label = element(
      "div",
      "gl-setting__label",
      this.localize(SETTING_LABEL_KEYS[definition.id] ?? `settings.${definition.id}`) ||
        humanizeSettingId(definition.id),
    );
    const value = element(
      "div",
      settingValueClassName(definition.id),
      this.formatSettingValue(definition, this.currentSettingValue(definition)),
    );

    row.append(label, value);

    const adjust = this.createActionElement(
      "div",
      "gl-setting__control",
      "",
      () => this.toggleSetting(definition),
      () => this.adjustSetting(definition),
    );
    adjust.setAttribute("aria-label", `${label.textContent ?? ""}: ${value.textContent ?? ""}`);
    row.append(adjust);

    return row;
  }

  private toggleSetting(definition: SettingDefinition): void {
    const current = this.currentSettingValue(definition);

    if (definition.type === "boolean") {
      this.commitSetting(definition.id, !current);
    } else if (definition.type === "number" || definition.type === "integer") {
      this.adjustSetting(definition, 1);
    } else if (definition.type === "enum" && definition.constraints?.allowedValues) {
      const values = definition.constraints.allowedValues;
      const index = values.indexOf(current);
      const next = values[(index + 1) % values.length];

      if (next !== undefined) {
        this.commitSetting(definition.id, next);
      }
    }
  }

  private adjustSetting(definition: SettingDefinition, direction: -1 | 1 = 1): void {
    const current = this.currentSettingValue(definition);

    if (definition.type === "boolean") {
      this.commitSetting(definition.id, !current);
      return;
    }

    if (definition.type === "number" || definition.type === "integer") {
      const value = typeof current === "number" ? current : definition.defaultValue;
      const constraints = definition.constraints;
      const minimum = constraints?.minimum ?? 0;
      const maximum = constraints?.maximum ?? 1;
      const step = this.stepForSetting(definition);
      const next = Math.min(maximum, Math.max(minimum, Number(value) + direction * step));

      this.commitSetting(definition.id, Number(next.toFixed(4)));
      return;
    }

    if (definition.type === "enum" && definition.constraints?.allowedValues) {
      const values = definition.constraints.allowedValues;
      const index = values.indexOf(current);
      const next = values[(index + direction + values.length) % values.length];

      if (next !== undefined) {
        this.commitSetting(definition.id, next);
      }
    }
  }

  private stepForSetting(definition: SettingDefinition): number {
    const constraints = definition.constraints;
    const range = (constraints?.maximum ?? 1) - (constraints?.minimum ?? 0);

    if (definition.type === "integer") {
      return 1;
    }

    if (definition.id.endsWith("_volume")) {
      return 0.05;
    }

    if (definition.id === "camera.field_of_view") {
      return 1;
    }

    if (definition.id === "hud.ui_scale") {
      return 0.05;
    }

    return range > 2 ? 0.1 : 0.05;
  }

  private currentSettingValue(definition: SettingDefinition): SettingValue {
    return this.settings.getValue<SettingValue>(definition.id) ?? definition.defaultValue;
  }

  private formatSettingValue(definition: SettingDefinition, value: SettingValue): string {
    if (definition.type === "boolean") {
      return value ? this.localize("common.on") : this.localize("common.off");
    }

    if (definition.type === "number" || definition.type === "integer") {
      const numeric = typeof value === "number" ? value : 0;

      if (definition.id.endsWith("_volume") || definition.id.includes("intensity")) {
        return `${Math.round(numeric * 100)}%`;
      }

      if (definition.id === "camera.field_of_view") {
        return `${Math.round(numeric)}°`;
      }

      if (definition.id === "hud.ui_scale") {
        return `${Math.round(numeric * 100)}%`;
      }

      return numeric.toFixed(2).replace(/\.?0+$/, "");
    }

    if (definition.id === "general.language") {
      return getLanguageLabel(String(value));
    }

    return String(value);
  }

  /**
   * Maps a `SpeedrunMedal` id to the localized label used by the
   * `speedrun.medal` / `records.medalValue` templates. Returns `null` for
   * "none" (and unknown ids), so callers render `medal.none` instead of
   * producing a stray template.
   */
  /**
   * Resolves a content-owned translation but keeps the authored fallback for
   * missing resources (the resource manager returns the raw key otherwise).
   */
  private localizeWithFallback(key: string, fallback: string): string {
    const value = this.localize(key);

    return value === key ? fallback : value;
  }

  private formatMedal(medal: string | null | undefined): string | null {
    if (!medal || medal === "none") {
      return null;
    }

    const key = MEDAL_LABEL_KEYS[medal];

    return key ? this.localize(key) : medal;
  }

  private commitSetting(settingId: string, value: SettingValue): void {
    this.actions.onAudioCue("confirm");

    void this.settings
      .update({ [settingId]: value })
      .then((result) => {
        if (!result.applied) {
          console.warn(
            `[Glassline] Setting "${settingId}" could not be applied: ${result.issues
              .map((issue) => issue.message)
              .join("; ")}`,
          );
        }
      })
      .catch((error: unknown) => console.warn("[Glassline] Setting update failed.", error));

    if (this.screen === "settings") {
      this.renderSettings();
    }
  }

  private visibleSettingsDefinitions(): readonly SettingDefinition[] {
    return this.settings
      .getDefinitions()
      .filter((definition) => !UNSUPPORTED_SETTING_IDS.has(definition.id));
  }

  private createScreen(titleKey: string | null, modifier: string): HTMLElement {
    const screen = element("section", `gl-screen ${modifier}`);
    screen.setAttribute("role", "dialog");
    screen.setAttribute("aria-modal", "true");

    if (titleKey) {
      screen.setAttribute("aria-label", this.localize(titleKey));
      screen.append(element("h1", "gl-screen__title", this.localize(titleKey)));
    }

    return screen;
  }

  private addMenuButton(
    container: HTMLElement,
    label: string,
    onClick: () => void,
    className = "",
  ): HTMLElement {
    const button = this.createActionElement(
      "div",
      `gl-menu-button ${className}`.trim(),
      label,
      onClick,
    );

    button.setAttribute("role", "button");
    button.setAttribute("aria-label", label);
    container.append(button);

    return button;
  }

  private createActionElement(
    tag: string,
    className: string,
    label: string,
    onClick: () => void,
    onAdjust?: (direction: -1 | 1) => void,
  ): HTMLElement {
    const node = element(tag as "div", className, label);

    node.tabIndex = 0;
    node.setAttribute("data-ui-focusable", "true");
    this.clickHandlers.set(node, onClick);

    if (onAdjust) {
      this.adjustHandlers.set(node, onAdjust);
    }

    node.addEventListener("click", () => {
      this.actions.onAudioCue("confirm");
      onClick();
    });
    node.addEventListener("mouseenter", () => this.focusElement(node));

    return node;
  }

  private setScreen(screen: UIScreen, elementNode: HTMLElement): void {
    this.screen = screen;
    this.screensHost.replaceChildren(elementNode);
    this.hud.classList.remove("is-visible");
    this.focusables = [...elementNode.querySelectorAll<HTMLElement>("[data-ui-focusable]")];
    this.focusedIndex = 0;
    this.focusCurrent();
    this.notifyScreenChanged();
  }

  private notifyScreenChanged(): void {
    this.onScreenChanged?.();
  }

  private focusCurrent(): void {
    const elementNode = this.focusables[this.focusedIndex];

    if (!elementNode) {
      return;
    }

    this.focusElement(elementNode);
  }

  private focusElement(elementNode: HTMLElement): void {
    const index = this.focusables.indexOf(elementNode);

    if (index >= 0) {
      this.focusedIndex = index;
    }

    const settingRow = elementNode.closest<HTMLElement>(".gl-setting");

    if (settingRow?.dataset.settingId) {
      this.settingsFocusedSettingId = settingRow.dataset.settingId;
    }

    for (const focusable of this.focusables) {
      focusable.classList.toggle("is-focused", focusable === elementNode);
      focusable.setAttribute("aria-current", focusable === elementNode ? "true" : "false");
    }

    elementNode.focus({ preventScroll: true });
  }

  private moveFocus(direction: -1 | 1): void {
    if (this.focusables.length === 0) {
      return;
    }

    this.actions.onAudioCue("navigate");
    this.focusedIndex =
      (this.focusedIndex + direction + this.focusables.length) % this.focusables.length;
    this.focusCurrent();
  }

  private activateFocused(): void {
    const focused = this.focusables[this.focusedIndex];

    if (!focused) {
      return;
    }

    const handler = this.clickHandlers.get(focused);

    if (handler) {
      this.actions.onAudioCue("confirm");
      handler();
    } else {
      this.adjustSettingFromFocused(focused, 1);
    }
  }

  private adjustSettingFromFocused(focused: HTMLElement, direction: -1 | 1): void {
    const handler = this.adjustHandlers.get(focused);

    if (handler) {
      this.actions.onAudioCue("navigate");
      handler(direction);
    }
  }

  private adjustFocused(direction: -1 | 1): void {
    const focused = this.focusables[this.focusedIndex];

    if (!focused) {
      return;
    }

    if (this.adjustHandlers.has(focused)) {
      this.adjustSettingFromFocused(focused, direction);
      return;
    }

    const categoryTab = focused.getAttribute("data-ui-category");

    if (categoryTab) {
      this.moveFocus(direction);
    }
  }

  private handleTabTrap = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" || this.screen === null || this.focusables.length === 0) {
      return;
    }

    event.preventDefault();
    this.moveFocus(event.shiftKey ? -1 : 1);
  };

  private applySettingsFromManager(): void {
    this.applySnapshot(this.settings.getSnapshot());
  }

  private applySnapshot(snapshot: SettingsSnapshot): void {
    const values = snapshot.values;

    this.reducedMotion = readBoolean(values, "accessibility.reduced_motion", false);
    this.highContrast = readBoolean(values, "accessibility.high_contrast", false);
    this.colorIndependentStatus = readBoolean(
      values,
      "accessibility.color_independent_status",
      true,
    );
    this.largeText = readBoolean(values, "accessibility.large_text", false);
    this.uiScale = clampNumber(readNumber(values, "hud.ui_scale", 1), 0.8, 1.4);
    this.hudEnabled = readBoolean(values, "hud.enabled", true);
    this.showSpeed = readBoolean(values, "hud.show_speed_indicator", true);
    this.showTimer = readBoolean(values, "hud.show_speedrun_timer", true);
    this.showTrainingObjectives = readBoolean(values, "hud.show_training_objectives", true);
    this.showInteractionPrompts = readBoolean(values, "hud.show_interaction_prompts", true);

    this.root.classList.toggle("gl-ui--reduced-motion", this.reducedMotion);
    this.root.classList.toggle("gl-ui--high-contrast", this.highContrast);
    this.root.classList.toggle("gl-ui--large-text", this.largeText);
    this.root.style.setProperty("--gl-ui-scale", String(this.uiScale));
  }

  private announce(message: string): void {
    this.announcer.textContent = message;
  }
}

function readBoolean(
  values: Readonly<Record<string, SettingValue>>,
  id: string,
  fallback: boolean,
): boolean {
  const value = values[id];

  return typeof value === "boolean" ? value : fallback;
}

function readNumber(
  values: Readonly<Record<string, SettingValue>>,
  id: string,
  fallback: number,
): number {
  const value = values[id];

  return typeof value === "number" ? value : fallback;
}

function formatHudNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function definitionCategory(category: string): Parameters<SettingsManager["resetCategory"]>[0] {
  return category as Parameters<SettingsManager["resetCategory"]>[0];
}
