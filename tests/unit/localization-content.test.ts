import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { BootStage } from "../../src/app/ApplicationConfig";
import {
  BOOT_ERROR_LABEL_FALLBACK,
  BOOT_STAGE_COPY,
  BOOT_TAGLINE_FALLBACK,
  BOOT_TAGLINE_KEY,
  bootTagline,
  detectBootLanguage,
} from "../../src/boot/BootLoader";
import { PROLOGUE_TEST_LEVEL } from "../../src/levels/test/PrologueTestLevel";
import { TRAINING_TEST_LEVEL } from "../../src/levels/test/TrainingTestLevel";
import {
  BOOT_ERROR_LABEL_KEY,
  bootStageDetailKey,
  bootStageLabelKey,
  createContentTranslator,
  levelCheckpointNameKey,
  levelInteractionPromptKey,
  levelNameKey,
  levelRouteNameKey,
  levelSectionNameKey,
  localizeContent,
  trainingExerciseDescriptionKey,
  trainingExerciseTitleKey,
  trainingObjectiveDescriptionKey,
} from "../../src/localization/ContentLocalization";
import { DEFAULT_LANGUAGE_REGISTRY } from "../../src/localization/Language";
import { LocalizationManager } from "../../src/localization/LocalizationManager";
import { createDefaultLocalizationResourceLoader } from "../../src/localization/LocalizationResourceLoader";
import { ENGLISH_RESOURCES } from "../../src/localization/resources/en";
import { RUSSIAN_RESOURCES } from "../../src/localization/resources/ru";
import type { TranslationValue } from "../../src/localization/TranslationTypes";
import { ResourceLoader } from "../../src/resources/ResourceLoader";
import { createPrologueRoute } from "../../src/speedrun/PrologueRoute";
import { TRAINING_EXERCISES } from "../../src/training/TrainingExercises";
import { settingValueClassName } from "../../src/ui/UIManager";

interface ContentExpectation {
  readonly key: string;
  readonly fallback: string;
}

const CONTENT_KEY_PREFIX = /^(training\.exercise\.|level\.|boot\.)/;

/** Derived content keys with the authored English text that must match `en.ts`. */
function contentExpectations(): ContentExpectation[] {
  const expectations: ContentExpectation[] = [];

  for (const exercise of TRAINING_EXERCISES) {
    expectations.push(
      { key: trainingExerciseTitleKey(exercise.id), fallback: exercise.title },
      { key: trainingExerciseDescriptionKey(exercise.id), fallback: exercise.description },
    );

    for (const objective of exercise.objectives) {
      expectations.push({
        key: trainingObjectiveDescriptionKey(exercise.id, objective.id),
        fallback: objective.description,
      });
    }
  }

  for (const level of [PROLOGUE_TEST_LEVEL, TRAINING_TEST_LEVEL]) {
    expectations.push({ key: levelNameKey(level.id), fallback: level.displayName });

    for (const section of level.sections) {
      expectations.push({
        key: levelSectionNameKey(level.id, section.id),
        fallback: section.displayName,
      });
    }

    for (const checkpoint of level.checkpoints) {
      expectations.push({
        key: levelCheckpointNameKey(level.id, checkpoint.id),
        fallback: checkpoint.displayName,
      });
    }

    for (const target of level.interactionTargets) {
      expectations.push({
        key: levelInteractionPromptKey(level.id, target.id),
        fallback: target.prompt,
      });
    }
  }

  expectations.push({
    key: levelRouteNameKey(PROLOGUE_TEST_LEVEL.id),
    fallback: `${PROLOGUE_TEST_LEVEL.displayName} Route`,
  });

  for (const stage of Object.keys(BOOT_STAGE_COPY) as BootStage[]) {
    expectations.push(
      { key: bootStageLabelKey(stage), fallback: BOOT_STAGE_COPY[stage].label },
      { key: bootStageDetailKey(stage), fallback: BOOT_STAGE_COPY[stage].detail },
    );
  }

  expectations.push(
    { key: BOOT_ERROR_LABEL_KEY, fallback: BOOT_ERROR_LABEL_FALLBACK },
    { key: BOOT_TAGLINE_KEY, fallback: BOOT_TAGLINE_FALLBACK },
  );

  return expectations;
}

function stringValue(resources: Readonly<Record<string, TranslationValue>>, key: string): string {
  const value = resources[key];

  if (typeof value !== "string") {
    throw new Error(`Expected "${key}" to be a string resource.`);
  }

  return value;
}

async function createManager(languageId: "en" | "ru"): Promise<LocalizationManager> {
  const loader = createDefaultLocalizationResourceLoader(new ResourceLoader());
  const manager = new LocalizationManager({
    loader,
    registry: DEFAULT_LANGUAGE_REGISTRY,
  });

  await manager.initialize(languageId);

  return manager;
}

describe("authored content localization keys", () => {
  it("derives one deterministic key per authored content string", () => {
    const expectations = contentExpectations();
    const keys = expectations.map((expectation) => expectation.key);

    expect(expectations.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers training exercises, both levels and boot stages", () => {
    const keys = new Set(contentExpectations().map((expectation) => expectation.key));

    for (const exercise of TRAINING_EXERCISES) {
      expect(keys.has(trainingExerciseTitleKey(exercise.id)), exercise.id).toBe(true);
      expect(keys.has(trainingExerciseDescriptionKey(exercise.id)), exercise.id).toBe(true);

      for (const objective of exercise.objectives) {
        expect(
          keys.has(trainingObjectiveDescriptionKey(exercise.id, objective.id)),
          `${exercise.id}.${objective.id}`,
        ).toBe(true);
      }
    }

    expect(keys.has(levelRouteNameKey(PROLOGUE_TEST_LEVEL.id))).toBe(true);

    for (const stage of Object.keys(BOOT_STAGE_COPY)) {
      expect(keys.has(bootStageLabelKey(stage)), stage).toBe(true);
      expect(keys.has(bootStageDetailKey(stage)), stage).toBe(true);
    }
  });

  it("ships every content key in English and Russian", () => {
    for (const { key, fallback } of contentExpectations()) {
      const english = stringValue(ENGLISH_RESOURCES, key);
      const russian = stringValue(RUSSIAN_RESOURCES, key);

      expect(english, `en ${key}`).toBe(fallback);
      expect(russian.trim().length, `ru ${key}`).toBeGreaterThan(0);
      expect(russian, `ru ${key} must not fall back to the raw key`).not.toBe(key);
    }
  });

  it("keeps English resources in sync with the authored content (drift guard)", () => {
    const drift = contentExpectations().flatMap(({ key, fallback }) => {
      const english = ENGLISH_RESOURCES[key];

      return english === fallback ? [] : [{ key, authored: fallback, resource: english }];
    });

    expect(drift).toEqual([]);
  });

  it("ships no stale content resources that no authored content derives", () => {
    const expected = new Set(contentExpectations().map((expectation) => expectation.key));

    for (const resources of [ENGLISH_RESOURCES, RUSSIAN_RESOURCES]) {
      const stale = Object.keys(resources)
        .filter((key) => CONTENT_KEY_PREFIX.test(key))
        .filter((key) => !expected.has(key));

      expect(stale).toEqual([]);
    }
  });

  it("actually translates content instead of copying English into ru.ts", () => {
    const untranslated = contentExpectations().flatMap(({ key }) => {
      const english = ENGLISH_RESOURCES[key];
      const russian = RUSSIAN_RESOURCES[key];

      return english === russian ? [key] : [];
    });

    expect(untranslated).toEqual([]);
  });

  it("returns authored fallbacks for missing content keys and without a manager", () => {
    expect(localizeContent(null, "training.exercise.missing.title", "Fallback")).toBe("Fallback");
    expect(localizeContent(undefined, "level.missing.name", "Fallback")).toBe("Fallback");
    expect(localizeContent({ has: () => false, t: () => "unused" }, "key", "Fallback")).toBe(
      "Fallback",
    );
  });
});

describe("content localization on language switch", () => {
  it("resolves training and level content in Russian after switching", async () => {
    const manager = await createManager("en");
    const exercise = TRAINING_EXERCISES[0];
    const objective = exercise?.objectives[0];
    const section = PROLOGUE_TEST_LEVEL.sections[0];
    const checkpoint = PROLOGUE_TEST_LEVEL.checkpoints[0];
    const interaction = PROLOGUE_TEST_LEVEL.interactionTargets[0];

    expect(exercise).toBeDefined();
    expect(objective).toBeDefined();
    expect(section).toBeDefined();
    expect(checkpoint).toBeDefined();
    expect(interaction).toBeDefined();

    if (!exercise || !objective || !section || !checkpoint || !interaction) {
      return;
    }

    const resolve = createContentTranslator(manager);

    expect(resolve(trainingExerciseTitleKey(exercise.id), exercise.title)).toBe(exercise.title);
    expect(
      resolve(levelSectionNameKey(PROLOGUE_TEST_LEVEL.id, section.id), section.displayName),
    ).toBe(section.displayName);

    await manager.setLanguage("ru");

    expect(resolve(trainingExerciseTitleKey(exercise.id), exercise.title)).toBe(
      RUSSIAN_RESOURCES[trainingExerciseTitleKey(exercise.id)],
    );
    expect(
      resolve(trainingObjectiveDescriptionKey(exercise.id, objective.id), objective.description),
    ).toBe(RUSSIAN_RESOURCES[trainingObjectiveDescriptionKey(exercise.id, objective.id)]);
    expect(
      resolve(levelSectionNameKey(PROLOGUE_TEST_LEVEL.id, section.id), section.displayName),
    ).toBe(RUSSIAN_RESOURCES[levelSectionNameKey(PROLOGUE_TEST_LEVEL.id, section.id)]);
    expect(
      resolve(
        levelCheckpointNameKey(PROLOGUE_TEST_LEVEL.id, checkpoint.id),
        checkpoint.displayName,
      ),
    ).toBe(RUSSIAN_RESOURCES[levelCheckpointNameKey(PROLOGUE_TEST_LEVEL.id, checkpoint.id)]);
    expect(
      resolve(
        levelInteractionPromptKey(PROLOGUE_TEST_LEVEL.id, interaction.id),
        interaction.prompt,
      ),
    ).toBe(RUSSIAN_RESOURCES[levelInteractionPromptKey(PROLOGUE_TEST_LEVEL.id, interaction.id)]);

    await manager.setLanguage("en");

    expect(resolve(trainingExerciseTitleKey(exercise.id), exercise.title)).toBe(exercise.title);

    manager.dispose();
  });

  it("builds the Prologue speedrun route with Russian section names and route name", async () => {
    const manager = await createManager("ru");
    const route = createPrologueRoute(PROLOGUE_TEST_LEVEL, createContentTranslator(manager));

    for (const section of route.sections) {
      expect(section.displayName).toBe(
        RUSSIAN_RESOURCES[levelSectionNameKey(PROLOGUE_TEST_LEVEL.id, section.id)],
      );
    }

    expect(route.name).toBe(RUSSIAN_RESOURCES[levelRouteNameKey(PROLOGUE_TEST_LEVEL.id)]);

    await manager.setLanguage("en");

    const englishRoute = createPrologueRoute(PROLOGUE_TEST_LEVEL, createContentTranslator(manager));

    expect(englishRoute.name).toBe(`${PROLOGUE_TEST_LEVEL.displayName} Route`);

    manager.dispose();
  });

  it("keeps authored route names when no translator is supplied", () => {
    const route = createPrologueRoute(PROLOGUE_TEST_LEVEL);

    expect(route.name).toBe(`${PROLOGUE_TEST_LEVEL.displayName} Route`);
    expect(route.sections.map((section) => section.displayName)).toEqual(
      [...PROLOGUE_TEST_LEVEL.sections]
        .sort((left, right) => left.order - right.order)
        .map((section) => section.displayName),
    );
  });
});

describe("boot screen language strategy", () => {
  it("selects Russian from ru* browser locales and English otherwise", () => {
    expect(detectBootLanguage("ru")).toBe("ru");
    expect(detectBootLanguage("ru-RU")).toBe("ru");
    expect(detectBootLanguage("RU-ru")).toBe("ru");
    expect(detectBootLanguage("en-US")).toBe("en");
    expect(detectBootLanguage("de-DE")).toBe("en");
    expect(detectBootLanguage("")).toBe("en");
    expect(detectBootLanguage(null)).toBe("en");
  });

  it("ships boot stage copy for both boot languages", () => {
    for (const stage of Object.keys(BOOT_STAGE_COPY) as BootStage[]) {
      expect(typeof RUSSIAN_RESOURCES[bootStageLabelKey(stage)]).toBe("string");
      expect(typeof RUSSIAN_RESOURCES[bootStageDetailKey(stage)]).toBe("string");
      expect(typeof ENGLISH_RESOURCES[bootStageLabelKey(stage)]).toBe("string");
      expect(typeof ENGLISH_RESOURCES[bootStageDetailKey(stage)]).toBe("string");
    }

    expect(typeof RUSSIAN_RESOURCES[BOOT_ERROR_LABEL_KEY]).toBe("string");
  });
});

describe("post-G5.1 UI cosmetics", () => {
  it("maps the boot tagline to the boot language and keeps the no-JS English fallback", () => {
    const english = ENGLISH_RESOURCES[BOOT_TAGLINE_KEY];
    const russian = RUSSIAN_RESOURCES[BOOT_TAGLINE_KEY];

    expect(english).toBe(BOOT_TAGLINE_FALLBACK);
    expect(typeof russian).toBe("string");
    expect(russian).toBe("Паркур от первого лица");
    expect(bootTagline("ru")).toBe(russian);
    expect(bootTagline("en")).toBe(BOOT_TAGLINE_FALLBACK);
    expect(russian).not.toBe(english);

    // index.html stays the no-JS English fallback; the brand line stays English
    // by design and must not be replaced by the localized tagline.
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    expect(indexHtml).toContain(">First-person parkour<");
    // Authored brand line stays English; CSS uppercases it at runtime.
    expect(indexHtml).toContain("Glassline / Runner Network");
    expect(indexHtml).not.toContain("Паркур от первого лица");
  });

  it("gives the language value a solid paper/ink chip with >=4.5:1 contrast", () => {
    expect(settingValueClassName("general.language")).toBe(
      "gl-setting__value gl-setting__value--chip",
    );
    expect(settingValueClassName("audio.master_volume")).toBe("gl-setting__value");
    expect(settingValueClassName("accessibility.large_text")).toBe("gl-setting__value");

    const css = readFileSync(resolve(process.cwd(), "src/styles/main.css"), "utf8");
    const chipStart = css.indexOf(".gl-setting__value--chip");
    const chipBlock = css.slice(chipStart, css.indexOf("}", chipStart) + 1);

    expect(chipStart).toBeGreaterThan(-1);
    expect(chipBlock).toContain("background: #f1f1ed");
    expect(chipBlock).toContain("color: #1a1a1a");
    expect(chipBlock).toContain("white-space: nowrap");
    expect(chipBlock).toContain("var(--glassline-accent)");
    expect(css).toContain(".gl-ui--high-contrast .gl-setting__value--chip");

    const ratio = contrastRatio("#1a1a1a", "#f1f1ed");

    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(15.4, 1);
  });
});

function hexToRgb(hex: string): readonly [number, number, number] {
  const normalized = hex.replace("#", "");

  expect(normalized).toHaveLength(6);

  const value = Number.parseInt(normalized, 16);

  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function relativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((channel) => {
    const value = channel / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}
