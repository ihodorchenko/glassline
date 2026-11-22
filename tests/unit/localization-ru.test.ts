import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_LANGUAGE_ID,
  DEFAULT_LANGUAGE_REGISTRY,
  getLanguageLabel,
  SUPPORTED_LANGUAGE_IDS,
} from "../../src/localization/Language";
import { LocalizationManager } from "../../src/localization/LocalizationManager";
import { createDefaultLocalizationResourceLoader } from "../../src/localization/LocalizationResourceLoader";
import { ENGLISH_RESOURCES } from "../../src/localization/resources/en";
import { RUSSIAN_RESOURCES } from "../../src/localization/resources/ru";
import type {
  PluralCategory,
  TranslationResources,
  TranslationValue,
} from "../../src/localization/TranslationTypes";
import { ResourceLoader } from "../../src/resources/ResourceLoader";
import type { SessionResults } from "../../src/sessions/GameplaySessionManager";
import { SETTINGS_BY_ID } from "../../src/settings/SettingsDefinitions";
import { SettingsManager } from "../../src/settings/SettingsManager";
import type { SettingDefinition } from "../../src/settings/SettingsTypes";
import { validateSettingValue } from "../../src/settings/SettingsValidator";
import {
  SETTING_LABEL_KEYS,
  type UIActions,
  type UILongTermData,
  UIManager,
} from "../../src/ui/UIManager";

const RU_PLURAL_SAMPLE_COUNTS = [0, 1, 2, 3, 4, 5, 11, 21, 22, 25, 101, 1.5];

const PLURAL_CATEGORIES = new Set<PluralCategory>(["zero", "one", "two", "few", "many", "other"]);

function sortedKeys(resources: TranslationResources): string[] {
  return Object.keys(resources).sort();
}

function placeholdersOf(value: TranslationValue): Set<string> {
  const forms = typeof value === "string" ? [value] : Object.values(value);
  const found = new Set<string>();

  for (const form of forms) {
    for (const match of String(form).matchAll(/\{(\w+)\}/g)) {
      found.add(match[1] ?? "");
    }
  }

  return found;
}

function sortedPlaceholders(value: TranslationValue): string[] {
  return [...placeholdersOf(value)].sort();
}

function requireLanguageSetting(): SettingDefinition {
  const definition = SETTINGS_BY_ID.get("general.language");

  if (!definition) {
    throw new Error('Setting "general.language" is not defined.');
  }

  return definition;
}

describe("Russian language resources", () => {
  it("ships English and Russian as supported languages", () => {
    expect(SUPPORTED_LANGUAGE_IDS).toEqual(["en", "ru"]);
    expect(DEFAULT_LANGUAGE_ID).toBe("en");

    expect(DEFAULT_LANGUAGE_REGISTRY.get("ru")).toMatchObject({
      id: "ru",
      displayName: "Russian",
      nativeDisplayName: "Русский",
      locale: "ru-RU",
      direction: "ltr",
      supported: true,
    });
    expect(DEFAULT_LANGUAGE_REGISTRY.getSupportedLanguageIds()).toEqual(["en", "ru"]);
  });

  it("labels language settings with human-readable native names", () => {
    expect(getLanguageLabel("en")).toBe("English");
    expect(getLanguageLabel("ru")).toBe("Русский");
    expect(getLanguageLabel("de")).toBe("de");
  });

  it("covers every English key and adds no extra keys", () => {
    expect(sortedKeys(RUSSIAN_RESOURCES)).toEqual(sortedKeys(ENGLISH_RESOURCES));
    expect(Object.keys(RUSSIAN_RESOURCES)).toHaveLength(Object.keys(ENGLISH_RESOURCES).length);
  });

  it("keeps every string/plural resource of the same kind", () => {
    for (const key of Object.keys(ENGLISH_RESOURCES)) {
      expect(typeof RUSSIAN_RESOURCES[key], key).toBe(typeof ENGLISH_RESOURCES[key]);
    }
  });

  it("preserves every placeholder in both directions", () => {
    for (const key of Object.keys(ENGLISH_RESOURCES)) {
      const english = ENGLISH_RESOURCES[key];
      const russian = RUSSIAN_RESOURCES[key];

      if (english === undefined || russian === undefined) {
        throw new Error(`Missing resource for "${key}".`);
      }

      expect(sortedPlaceholders(russian), `placeholders of ${key}`).toEqual(
        sortedPlaceholders(english),
      );
    }
  });

  it("ships valid Russian plural categories for every plural resource", () => {
    const rules = new Intl.PluralRules("ru-RU");
    const requiredCategories = new Set(RU_PLURAL_SAMPLE_COUNTS.map((count) => rules.select(count)));
    const pluralKeys = Object.keys(ENGLISH_RESOURCES).filter(
      (key) => typeof ENGLISH_RESOURCES[key] === "object",
    );

    expect(pluralKeys.length).toBeGreaterThan(0);

    for (const key of pluralKeys) {
      const value = RUSSIAN_RESOURCES[key];

      expect(typeof value, key).toBe("object");

      if (typeof value !== "object") {
        continue;
      }

      expect(typeof value.other, `${key}.other`).toBe("string");

      for (const category of Object.keys(value)) {
        expect(PLURAL_CATEGORIES.has(category as PluralCategory), `${key}.${category}`).toBe(true);
      }

      for (const category of requiredCategories) {
        expect(typeof value[category as PluralCategory], `${key}.${category}`).toBe("string");
      }
    }
  });

  it("resolves Russian plural forms through the manager", () => {
    expect(RUSSIAN_RESOURCES["results.attempts"]).toMatchObject({
      one: "{count} попытка",
      few: "{count} попытки",
      many: "{count} попыток",
    });
    expect(RUSSIAN_RESOURCES["time.seconds"]).toMatchObject({
      one: "{count} секунда",
      few: "{count} секунды",
      many: "{count} секунд",
    });
    expect(RUSSIAN_RESOURCES["time.minutes"]).toMatchObject({
      one: "{count} минута",
      few: "{count} минуты",
      many: "{count} минут",
    });
  });

  it("translates runner-facing terminology instead of machine literals", () => {
    expect(RUSSIAN_RESOURCES["menu.prologue"]).toBe("Пролог");
    expect(RUSSIAN_RESOURCES["menu.rankedPrologue"]).toBe("Рейтинговый пролог");
    expect(RUSSIAN_RESOURCES["content.ranked_prologue"]).toBe("Рейтинговый пролог");
    expect(RUSSIAN_RESOURCES["menu.training"]).toBe("Тренировка");
    expect(RUSSIAN_RESOURCES["settings.title"]).toBe("Настройки");
    expect(RUSSIAN_RESOURCES["results.title"]).toBe("Результаты");
    expect(RUSSIAN_RESOURCES["pause.title"]).toBe("Пауза");
  });

  it("keeps Russian player-facing text free of untranslated English UI words", () => {
    const untranslated = Object.entries(RUSSIAN_RESOURCES).flatMap(([key, value]) => {
      const forms = typeof value === "string" ? [value] : Object.values(value);

      return forms.some((form) =>
        /\b(Training|Settings|Results|Credits|Loading|Continue)\b/.test(form),
      )
        ? [key]
        : [];
    });

    expect(untranslated).toEqual([]);
  });
});

describe("default localization loader with Russian", () => {
  it("registers Russian resources in the default loader", async () => {
    const loader = createDefaultLocalizationResourceLoader(new ResourceLoader());

    expect(loader.has("en")).toBe(true);
    expect(loader.has("ru")).toBe(true);
    expect(loader.has("de")).toBe(false);
    await expect(loader.load("ru")).resolves.toBe(RUSSIAN_RESOURCES);
    await expect(loader.load("de")).rejects.toMatchObject({
      code: "FAILED",
      resourceKey: "locales:de",
    });
  });
});

describe("LocalizationManager English <-> Russian switching", () => {
  async function createManager(): Promise<LocalizationManager> {
    const loader = createDefaultLocalizationResourceLoader(new ResourceLoader());
    const manager = new LocalizationManager({
      loader,
      registry: DEFAULT_LANGUAGE_REGISTRY,
    });

    await manager.initialize("en");

    return manager;
  }

  it("switches en -> ru -> en and emits changes", async () => {
    const manager = await createManager();
    const listener = vi.fn();

    manager.subscribe(listener);

    expect(manager.t("menu.prologue")).toBe("Prologue");

    const toRussian = await manager.setLanguage("ru");

    expect(toRussian).toEqual({ changed: true, languageId: "ru" });
    expect(listener).toHaveBeenCalledWith({ previousLanguageId: "en", languageId: "ru" });
    expect(manager.activeLanguage.id).toBe("ru");
    expect(manager.t("menu.prologue")).toBe("Пролог");
    expect(manager.t("settings.title")).toBe("Настройки");

    const toEnglish = await manager.setLanguage("en");

    expect(toEnglish).toEqual({ changed: true, languageId: "en" });
    expect(manager.t("menu.prologue")).toBe("Prologue");
    expect(manager.getMissingKeys()).toEqual([]);

    manager.dispose();
  });

  it("selects Russian plural forms by count", async () => {
    const manager = await createManager();

    await manager.setLanguage("ru");

    expect(manager.t("results.attempts", { count: 1 })).toBe("1 попытка");
    expect(manager.t("results.attempts", { count: 2 })).toBe("2 попытки");
    expect(manager.t("results.attempts", { count: 5 })).toBe("5 попыток");
    expect(manager.t("results.attempts", { count: 11 })).toBe("11 попыток");
    expect(manager.t("results.attempts", { count: 21 })).toBe("21 попытка");
    expect(manager.t("results.attempts", { count: 22 })).toBe("22 попытки");
    expect(manager.t("time.seconds", { count: 3 })).toBe("3 секунды");
    expect(manager.t("time.minutes", { count: 5 })).toBe("5 минут");

    manager.dispose();
  });

  it("rejects unknown languages without changing the active one", async () => {
    const manager = await createManager();

    await manager.setLanguage("ru");

    const result = await manager.setLanguage("de");

    expect(result.changed).toBe(false);
    expect(manager.activeLanguage.id).toBe("ru");
    expect(manager.t("menu.prologue")).toBe("Пролог");

    manager.dispose();
  });
});

describe("general.language settings enum", () => {
  it("exposes English and Russian as allowed values", () => {
    const definition = requireLanguageSetting();

    expect(definition.type).toBe("enum");
    expect(definition.defaultValue).toBe("en");
    expect(definition.constraints?.allowedValues).toEqual(["en", "ru"]);
    expect(validateSettingValue(definition, "en")).toBeNull();
    expect(validateSettingValue(definition, "ru")).toBeNull();
    expect(validateSettingValue(definition, "de")?.code).toBe("INVALID_ENUM");
  });

  it("persists a Russian selection through the SettingsManager", async () => {
    const manager = new SettingsManager({ persistence: null });

    await manager.initialize();

    const accepted = await manager.update({ "general.language": "ru" });

    expect(accepted.applied).toBe(true);
    expect(manager.getValue("general.language")).toBe("ru");

    const rejected = await manager.update({ "general.language": "de" });

    expect(rejected.applied).toBe(false);
    expect(rejected.issues[0]?.code).toBe("INVALID_ENUM");
    expect(manager.getValue("general.language")).toBe("ru");

    manager.dispose();
  });
});

const NOOP_ACTIONS: UIActions = {
  onStartTraining: () => undefined,
  onStartPrologue: () => undefined,
  onStartSpeedrun: () => undefined,
  onResume: () => undefined,
  onRestart: () => undefined,
  onAbandon: () => undefined,
  onRetry: () => undefined,
  onReturnToMenu: () => undefined,
  onPause: () => undefined,
  onAudioCue: () => undefined,
};

const SPEEDRUN_RESULTS = {
  sessionId: "session-ru",
  mode: "speedrun",
  levelId: "prologue_test",
  status: "completed",
  durationMs: 91_234,
  completedAt: 1_760_000_000_000,
  speedrun: {
    totalTimeMs: 91_234,
    checkpointsCompleted: 5,
    splits: [
      { index: 0, checkpointId: "cp_01", splitTimeMs: 12_000, totalTimeMs: 12_000 },
      { index: 1, checkpointId: "cp_02", splitTimeMs: 16_000, totalTimeMs: 28_000 },
    ],
    medal: "gold",
    validation: { valid: true },
  },
} as unknown as SessionResults;

function resultsFor(mode: SessionResults["mode"], levelId: string): SessionResults {
  return {
    sessionId: `session-${mode}-${levelId}`,
    mode,
    levelId,
    status: "completed",
    durationMs: 12_345,
    completedAt: 1_760_000_000_000,
  };
}

const LONG_TERM_DATA: UILongTermData = {
  trainingCompleted: 3,
  trainingTotal: 10,
  prologueCompleted: true,
  prologueBestMs: 91_234,
  achievementsUnlocked: 1,
  achievementsTotal: 12,
  tutorialCompleted: 4,
  tutorialTotal: 8,
  milestones: 2,
  records: [{ timeMs: 91_234, medal: "gold", completedAt: 1_760_000_000_000 }],
  achievements: [
    {
      id: "first_run",
      title: "Первый забег",
      description: "Пройдите рейтинговый пролог.",
      unlocked: true,
      hidden: false,
    },
  ],
  statistics: {
    totalSessions: 4,
    completedSessions: 2,
    totalPlayTimeSeconds: 320,
    totalDistanceMeters: 1_500,
    totalJumps: 30,
    totalVaults: 5,
    totalFalls: 2,
    totalCheckpoints: 9,
  },
};

// --- Minimal DOM double ---------------------------------------------------
//
// Vitest runs with `environment: "node"` and no DOM package is installed, so
// the UI re-render test drives the real `UIManager` through a tiny DOM double.
// It implements only the API surface `UIManager` uses: element creation,
// class/style/attribute handling, `append`/`replaceChildren`, simple selector
// queries, `closest`, focus and event registration.

class FakeClassList {
  private readonly tokens = new Set<string>();

  add(...names: string[]): void {
    for (const name of names) {
      this.tokens.add(name);
    }
  }

  remove(...names: string[]): void {
    for (const name of names) {
      this.tokens.delete(name);
    }
  }

  toggle(name: string, force?: boolean): boolean {
    const enabled = force ?? !this.tokens.has(name);

    if (enabled) {
      this.tokens.add(name);
    } else {
      this.tokens.delete(name);
    }

    return enabled;
  }

  contains(name: string): boolean {
    return this.tokens.has(name);
  }

  replaceAll(names: readonly string[]): void {
    this.tokens.clear();

    for (const name of names) {
      this.tokens.add(name);
    }
  }

  get value(): string {
    return [...this.tokens].join(" ");
  }
}

class FakeStyle {
  readonly properties = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.properties.set(name, value);
  }
}

interface SelectorAttribute {
  readonly name: string;
  readonly value?: string;
}

interface CompoundSelector {
  readonly tag?: string;
  readonly classes: readonly string[];
  readonly attributes: readonly SelectorAttribute[];
}

const SELECTOR_TOKEN = /^([a-zA-Z][\w-]*)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/;

function parseCompound(step: string): CompoundSelector {
  const classes: string[] = [];
  const attributes: SelectorAttribute[] = [];
  let tag: string | undefined;
  let rest = step;

  while (rest.length > 0) {
    const match = SELECTOR_TOKEN.exec(rest);

    if (!match) {
      throw new Error(`Unsupported selector: "${step}".`);
    }

    if (match[1] !== undefined) {
      tag = match[1].toLowerCase();
    } else if (match[2] !== undefined) {
      classes.push(match[2]);
    } else if (match[3] !== undefined) {
      const name = match[3];
      const value = match[4];

      attributes.push(value === undefined ? { name } : { name, value });
    }

    rest = rest.slice(match[0].length);
  }

  return tag === undefined ? { classes, attributes } : { tag, classes, attributes };
}

function matchesCompound(node: FakeElement, compound: CompoundSelector): boolean {
  if (compound.tag !== undefined && node.tagName !== compound.tag.toUpperCase()) {
    return false;
  }

  if (!compound.classes.every((name) => node.classList.contains(name))) {
    return false;
  }

  return compound.attributes.every((attribute) => {
    const actual = node.getAttribute(attribute.name);

    return actual !== null && (attribute.value === undefined || actual === attribute.value);
  });
}

class FakeElement {
  readonly tagName: string;
  readonly children: FakeElement[] = [];
  readonly classList = new FakeClassList();
  readonly style = new FakeStyle();

  tabIndex = 0;
  parentElement: FakeElement | null = null;

  private ownText = "";
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<(event?: unknown) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get className(): string {
    return this.classList.value;
  }

  set className(value: string) {
    this.classList.replaceAll(
      value
        .split(/\s+/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    );
  }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.children.length = 0;
    this.ownText = value;
  }

  get dataset(): Record<string, string | undefined> {
    const data: Record<string, string | undefined> = {};

    for (const [name, value] of this.attributes) {
      if (!name.startsWith("data-")) {
        continue;
      }

      const key = name
        .slice("data-".length)
        .replace(/-([a-z])/g, (_match: string, letter: string) => letter.toUpperCase());

      data[key] = value;
    }

    return data;
  }

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) {
      node.parentElement?.removeChild(node);
      node.parentElement = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes: FakeElement[]): void {
    for (const child of [...this.children]) {
      this.removeChild(child);
    }

    this.append(...nodes);
  }

  removeChild(node: FakeElement): void {
    const index = this.children.indexOf(node);

    if (index >= 0) {
      this.children.splice(index, 1);
      node.parentElement = null;
    }
  }

  remove(): void {
    this.parentElement?.removeChild(this);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name.toLowerCase(), String(value));
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name.toLowerCase()) ?? null;
  }

  addEventListener(type: string, listener: (event?: unknown) => void): void {
    const bucket = this.listeners.get(type) ?? new Set<(event?: unknown) => void>();

    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: (event?: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  click(): void {
    for (const listener of this.listeners.get("click") ?? []) {
      listener();
    }
  }

  focus(_options?: { readonly preventScroll?: boolean }): void {
    // Focus is a no-op in the DOM double.
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const steps = selector
      .trim()
      .split(/\s+/)
      .map((step) => parseCompound(step));
    const last = steps[steps.length - 1];

    if (!last) {
      return [];
    }

    return this.descendants().filter((candidate) => {
      if (!matchesCompound(candidate, last)) {
        return false;
      }

      let ancestor = candidate.parentElement;

      for (let index = steps.length - 2; index >= 0; index -= 1) {
        const step = steps[index];

        if (!step) {
          return false;
        }

        while (ancestor !== null && !matchesCompound(ancestor, step)) {
          ancestor = ancestor.parentElement;
        }

        if (ancestor === null) {
          return false;
        }

        ancestor = ancestor.parentElement;
      }

      return true;
    });
  }

  closest(selector: string): FakeElement | null {
    const compound = parseCompound(selector.trim());
    let node: FakeElement | null = this;

    while (node !== null) {
      if (matchesCompound(node, compound)) {
        return node;
      }

      node = node.parentElement;
    }

    return null;
  }

  private descendants(): FakeElement[] {
    const found: FakeElement[] = [];
    const visit = (node: FakeElement): void => {
      for (const child of node.children) {
        found.push(child);
        visit(child);
      }
    };

    visit(this);

    return found;
  }
}

class FakeDocument {
  readonly body = new FakeElement("body");
  readonly documentElement = new FakeElement("html");

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

interface UiHarness {
  readonly localization: LocalizationManager;
  readonly settings: SettingsManager;
  readonly ui: UIManager;
  readonly container: FakeElement;
}

async function createUiHarness(): Promise<UiHarness> {
  const loader = createDefaultLocalizationResourceLoader(new ResourceLoader());
  const localization = new LocalizationManager({
    loader,
    registry: DEFAULT_LANGUAGE_REGISTRY,
  });

  await localization.initialize("en");

  const settings = new SettingsManager({ persistence: null });

  await settings.initialize();
  vi.stubGlobal("document", new FakeDocument());

  const container = new FakeElement("main");
  const ui = new UIManager({
    localize: (key, params) => localization.t(key, (params ?? {}) as never),
    locale: () => localization.activeLanguage.locale,
    settings,
    actions: NOOP_ACTIONS,
    parent: container as unknown as HTMLElement,
  });

  return { localization, settings, ui, container };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UIManager language switching", () => {
  it("re-renders the visible screen in Russian after switching", async () => {
    const { localization, ui, container } = await createUiHarness();

    ui.showMainMenu();

    expect(container.textContent).toContain("Training");
    expect(container.textContent).toContain("Ranked Prologue");
    expect(container.textContent).toContain("Settings");

    await localization.setLanguage("ru");
    ui.refreshLocalization();

    expect(ui.getActiveScreen()).toBe("main-menu");
    expect(container.textContent).toContain("Тренировка");
    expect(container.textContent).toContain("Рейтинговый пролог");
    expect(container.textContent).toContain("Настройки");
    expect(container.textContent).not.toContain("Ranked Prologue");
    expect(container.textContent).not.toContain("Local Records");
  });

  it("shows native language names in the settings enum and re-renders on change", async () => {
    const { localization, settings, ui, container } = await createUiHarness();

    ui.showSettings("main-menu");

    const languageValue = (): string =>
      container.querySelector('[data-setting-id="general.language"] .gl-setting__value')
        ?.textContent ?? "";

    expect(ui.getActiveScreen()).toBe("settings");
    expect(container.textContent).toContain("Language");

    // Language lives in the "general" category tab; open it like a player would.
    const languageTab = container
      .querySelectorAll(".gl-tab")
      .find((tab) => tab.textContent.includes("Language"));

    expect(languageTab).toBeDefined();
    languageTab?.click();

    expect(languageValue()).toBe("English");
    expect(languageValue()).not.toBe("EN");

    await settings.update({ "general.language": "ru" });
    await localization.setLanguage("ru");
    ui.applySettings(settings.getSnapshot());
    ui.refreshLocalization();

    expect(container.textContent).toContain("Язык");
    expect(languageValue()).toBe("Русский");
    expect(container.textContent).toContain("Настройки");
    expect(container.textContent).toContain("Сбросить раздел");
  });

  it("renders pause, loading, results, credits and records in Russian", async () => {
    const { localization, ui, container } = await createUiHarness();

    await localization.setLanguage("ru");

    ui.showPause();
    expect(container.textContent).toContain("Пауза");
    expect(container.textContent).toContain("Выйти в главное меню");

    ui.showLoading("prologue");
    expect(container.textContent).toContain("Подготовка к забегу");
    expect(container.textContent).toContain("Генерация города");
    expect(container.textContent).toContain("Пролог");

    ui.showResults(SPEEDRUN_RESULTS);
    expect(container.textContent).toContain("Результаты");
    expect(container.textContent).toContain("золотая медаль");
    expect(container.textContent).toContain("Забег засчитан");

    ui.showCredits();
    expect(container.textContent).toContain("Титры");
    expect(container.textContent).toContain("самостоятельный проект");

    ui.setLongTermData(LONG_TERM_DATA);
    ui.showRecords();
    expect(container.textContent).toContain("Рекорды пролога");
    expect(container.textContent).toContain("золотая медаль");
    expect(container.textContent).toContain("Завершено");
  });

  it("labels `none` medals and results attempts through resources", async () => {
    const { localization, ui, container } = await createUiHarness();

    await localization.setLanguage("ru");
    ui.showResults(SPEEDRUN_RESULTS);

    expect(container.textContent).toContain("Режим: Рейтинговый пролог");
    expect(container.textContent).toContain("Забег засчитан");

    const noMedalResults = {
      ...SPEEDRUN_RESULTS,
      speedrun: {
        ...(SPEEDRUN_RESULTS.speedrun as unknown as Record<string, unknown>),
        medal: "none",
      },
    } as unknown as SessionResults;

    ui.showResults(noMedalResults);
    expect(container.textContent).toContain("Без медали");
  });

  it("uses the shared UI label keys for every visible setting", () => {
    for (const key of Object.values(SETTING_LABEL_KEYS)) {
      expect(typeof RUSSIAN_RESOURCES[key], `missing Russian label ${key}`).toBe("string");
      expect(typeof ENGLISH_RESOURCES[key], `missing English label ${key}`).toBe("string");
    }
  });
});

describe("Results level identity", () => {
  it("uses the level id, not the prologue gameplay mode, for a prologue-mode session", async () => {
    const { ui, container } = await createUiHarness();

    ui.showResults(resultsFor("prologue", "prologue_test"));

    expect(container.textContent).toContain("Level: Prologue");
    expect(container.textContent).not.toContain("Mode: Prologue");

    ui.showResults(resultsFor("prologue", "first_section"));

    expect(container.textContent).toContain("Level: First Section");
    expect(container.textContent).not.toContain("Level: Prologue");
    expect(container.textContent).not.toContain("Mode: Prologue");
  });

  it("keeps the existing Training and Ranked Prologue markings", async () => {
    const { ui, container } = await createUiHarness();

    ui.showResults(resultsFor("training", "training_test"));
    expect(container.textContent).toContain("Mode: Training");
    expect(container.textContent).not.toContain("Mode: Prologue");

    ui.showResults(resultsFor("speedrun", "prologue_test"));
    expect(container.textContent).toContain("Mode: Ranked Prologue");
    expect(container.textContent).not.toContain("Level: Prologue");
  });

  it("falls back to the mode row for an unknown level id", async () => {
    const { ui, container } = await createUiHarness();

    ui.showResults(resultsFor("prologue", "unknown_level"));

    expect(container.textContent).toContain("Mode: Prologue");
    expect(container.textContent).not.toContain("unknown_level");
  });

  it("re-renders the level identity on a language switch", async () => {
    const { localization, ui, container } = await createUiHarness();

    ui.showResults(resultsFor("prologue", "first_section"));
    expect(container.textContent).toContain("Level: First Section");

    await localization.setLanguage("ru");
    ui.refreshLocalization();

    expect(ui.getActiveScreen()).toBe("results");
    expect(container.textContent).toContain("Уровень: Первый участок");
    expect(container.textContent).not.toContain("First Section");

    ui.showResults(resultsFor("prologue", "prologue_test"));
    expect(container.textContent).toContain("Уровень: Пролог");

    await localization.setLanguage("en");
    ui.refreshLocalization();

    expect(container.textContent).toContain("Level: Prologue");
  });
});
