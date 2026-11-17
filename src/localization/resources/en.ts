import type { TranslationResources } from "../TranslationTypes";

/**
 * Initial English translation resources.
 * Additional languages are registered through the language registry.
 */
export const ENGLISH_RESOURCES: TranslationResources = {
  "app.title": "Glassline",

  "menu.continue": "Continue",
  "menu.training": "Training",
  "menu.prologue": "Prologue",
  "menu.localRecords": "Local Records",
  "menu.settings": "Settings",
  "menu.credits": "Credits",
  "menu.exit": "Exit",

  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.loading": "Loading",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.audio.master": "Master volume",
  "settings.audio.muted": "Mute audio",
  "settings.camera.fov": "Field of view",
  "settings.controls.sensitivity": "Look sensitivity",
  "settings.display.quality": "Graphics quality",

  "results.completionTime": "Completion time",
  "results.personalBest": "Personal best",
  "results.medal": "Medal",

  "time.seconds": {
    one: "{count} second",
    other: "{count} seconds",
  },
  "time.minutes": {
    one: "{count} minute",
    other: "{count} minutes",
  },
};
