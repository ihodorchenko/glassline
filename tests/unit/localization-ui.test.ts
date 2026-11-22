import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGE_IDS } from "../../src/localization/Language";
import { ENGLISH_RESOURCES } from "../../src/localization/resources/en";
import { SETTING_LABEL_KEYS } from "../../src/ui/UIManager";

const REQUIRED_UI_KEYS = [
  "app.title",
  "menu.training",
  "menu.prologue",
  "menu.rankedPrologue",
  "menu.localRecords",
  "menu.settings",
  "menu.credits",
  "menu.hint",
  "common.back",
  "common.resume",
  "common.restart",
  "common.abandon",
  "common.retry",
  "common.mainMenu",
  "common.loading",
  "common.on",
  "common.off",
  "pause.title",
  "loading.mode",
  "hud.exercise",
  "hud.progress",
  "hud.speedrun",
  "hud.checkpoints",
  "hud.checkpointReached",
  "hud.interactionPrompt",
  "hud.vaultPrompt",
  "hud.tutorial",
  "hud.pauseHint",
  "speedrun.medal",
  "speedrun.valid",
  "results.title",
  "results.mode",
  "results.level",
  "results.level.prologue_test",
  "results.level.first_section",
  "results.duration",
  "results.trainingCompleted",
  "results.splits",
  "records.title",
  "records.empty",
  "credits.title",
  "credits.inspiration",
  "error.title",
  "settings.title",
  "settings.applyHint",
  "settings.hiddenUnsupported",
  "settings.categories.audio",
  "settings.categories.controls",
  "settings.categories.camera",
  "settings.categories.hud",
  "settings.categories.accessibility",
  "settings.categories.gameplay",
  "settings.categories.language",
  "menu.progress",
  "achievements.first_steps.title",
  "achievements.first_steps.description",
  "achievements.unlocked",
  "tutorial.steps.move.title",
  "content.training_movement",
  "milestones.first_training_exercise",
  "records.prologueRecords",
  "records.noRuns",
  "records.progress",
  "records.statistics",
];

describe("UI localization resources", () => {
  it("ships English and Russian as supported languages", () => {
    expect(SUPPORTED_LANGUAGE_IDS).toEqual(["en", "ru"]);
  });

  it("contains all required interface strings", () => {
    for (const key of REQUIRED_UI_KEYS) {
      expect(ENGLISH_RESOURCES[key], `missing key ${key}`).toBeTypeOf("string");
    }
  });

  it("contains labels for every settings control exposed by the UI", () => {
    for (const key of Object.values(SETTING_LABEL_KEYS)) {
      expect(ENGLISH_RESOURCES[key], `missing key ${key}`).toBeTypeOf("string");
    }
  });

  it("keeps run-time formatting keys for plurals", () => {
    expect(ENGLISH_RESOURCES["time.seconds"]).toBeTypeOf("object");
    expect(ENGLISH_RESOURCES["time.minutes"]).toBeTypeOf("object");
  });
});
