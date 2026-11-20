import type { LevelDefinition } from "../levels/LevelTypes";
import {
  type ContentTranslator,
  levelNameKey,
  levelRouteNameKey,
  levelSectionNameKey,
} from "../localization/ContentLocalization";
import type { SpeedrunRoute, SpeedrunRouteSection } from "./SpeedrunSystem";

export const PROLOGUE_MEDAL_THRESHOLDS = {
  bronze: 240000,
  silver: 180000,
  gold: 120000,
} as const;

const IDENTITY_TRANSLATOR: ContentTranslator = (_key, fallback) => fallback;

/**
 * Builds the authoritative Speedrun route from authored Prologue content.
 *
 * The route owns required checkpoint order only; checkpoint activation remains
 * with the Checkpoint System and level content owns physical triggers.
 *
 * `translate` localizes player-facing route/section names. The route is built
 * once per session, so the fallback translator keeps authored English when no
 * localization is supplied. Visible HUD/results paths resolve names from level
 * content at render time instead, so a mid-session language switch is reflected
 * immediately even though this route object keeps its build-time language.
 */
export function createPrologueRoute(
  level: LevelDefinition,
  translate: ContentTranslator = IDENTITY_TRANSLATOR,
): SpeedrunRoute {
  if (level.mode !== "prologue") {
    throw new Error(`Level "${level.id}" is not a Prologue level.`);
  }

  const sections: SpeedrunRouteSection[] = [...level.sections]
    .sort((left, right) => left.order - right.order)
    .map((section) => {
      const checkpoint = level.checkpoints.find((candidate) => candidate.sectionId === section.id);

      return {
        id: section.id,
        displayName: translate(levelSectionNameKey(level.id, section.id), section.displayName),
        ...(checkpoint === undefined ? {} : { checkpointId: checkpoint.id }),
      };
    });

  const checkpointOrder = [...level.checkpoints]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((checkpoint) => checkpoint.id);

  if (checkpointOrder.length === 0) {
    throw new Error(`Prologue level "${level.id}" defines no checkpoints.`);
  }

  const finishTrigger = level.triggers.find((trigger) => trigger.metadata?.kind === "finish");

  if (!finishTrigger) {
    throw new Error(`Prologue level "${level.id}" has no finish trigger.`);
  }

  return {
    id: `${level.id}_route`,
    name: translate(
      levelRouteNameKey(level.id),
      translate(levelNameKey(level.id), `${level.displayName} Route`),
    ),
    version: 1,
    sections,
    checkpointOrder,
    finishTriggerId: finishTrigger.id,
    medalThresholds: PROLOGUE_MEDAL_THRESHOLDS,
  };
}
