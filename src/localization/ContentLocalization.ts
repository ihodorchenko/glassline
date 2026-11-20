/**
 * Content localization boundary helpers.
 *
 * Authored content (training exercises, levels, boot stages) keeps its English
 * text as the runtime fallback so content remains readable even when a
 * translation is missing. Player-facing systems resolve the deterministic
 * resource key at the boundary (Application snapshots/emissions, speedrun
 * route construction, boot loader) and fall back to the authored string.
 *
 * See `docs/27_LOCALIZATION_SYSTEM_SPEC.md` §2.2 and §7.
 */

import type { LocalizationManager } from "./LocalizationManager";

/** Resolves a translation resource key, or the authored fallback when absent. */
export type ContentTranslator = (key: string, fallback: string) => string;

/** Minimal localization surface needed to resolve content strings. */
type LocalizationLookup = Pick<LocalizationManager, "has" | "t">;

const IDENTITY_TRANSLATOR: ContentTranslator = (_key, fallback) => fallback;

export function trainingExerciseTitleKey(exerciseId: string): string {
  return `training.exercise.${exerciseId}.title`;
}

export function trainingExerciseDescriptionKey(exerciseId: string): string {
  return `training.exercise.${exerciseId}.description`;
}

export function trainingObjectiveDescriptionKey(exerciseId: string, objectiveId: string): string {
  return `training.exercise.${exerciseId}.objective.${objectiveId}`;
}

export function levelNameKey(levelId: string): string {
  return `level.${levelId}.name`;
}

export function levelRouteNameKey(levelId: string): string {
  return `level.${levelId}.route.name`;
}

export function levelSectionNameKey(levelId: string, sectionId: string): string {
  return `level.${levelId}.section.${sectionId}.name`;
}

export function levelCheckpointNameKey(levelId: string, checkpointId: string): string {
  return `level.${levelId}.checkpoint.${checkpointId}.name`;
}

export function levelInteractionPromptKey(levelId: string, targetId: string): string {
  return `level.${levelId}.interaction.${targetId}.prompt`;
}

export function bootStageLabelKey(stage: string): string {
  return `boot.stage.${stage}.label`;
}

export function bootStageDetailKey(stage: string): string {
  return `boot.stage.${stage}.detail`;
}

export const BOOT_ERROR_LABEL_KEY = "boot.error.label";

/**
 * Resolves a content translation without ever leaking a raw key to the player:
 * missing resources and unresolved keys both fall back to the authored text.
 */
export function localizeContent(
  localization: LocalizationLookup | null | undefined,
  key: string,
  fallback: string,
): string {
  if (localization === null || localization === undefined || !localization.has(key)) {
    return fallback;
  }

  const translated = localization.t(key);

  return translated === key ? fallback : translated;
}

/** Builds a `ContentTranslator` bound to a localization manager. */
export function createContentTranslator(
  localization: LocalizationLookup | null | undefined,
): ContentTranslator {
  if (localization === null || localization === undefined) {
    return IDENTITY_TRANSLATOR;
  }

  return (key, fallback) => localizeContent(localization, key, fallback);
}
