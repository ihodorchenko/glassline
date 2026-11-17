import type { TutorialStepDefinition } from "./TutorialTypes";

function step(
  id: string,
  source: string,
  eventType: string,
  payloadMatch?: Readonly<Record<string, string>>,
): TutorialStepDefinition {
  return {
    id,
    titleKey: `tutorial.steps.${id}.title`,
    hintKey: `tutorial.steps.${id}.hint`,
    source,
    eventType,
    ...(payloadMatch === undefined ? {} : { payloadMatch }),
  };
}

/** Initial contextual tutorial progression (`docs/28`). */
export const INITIAL_TUTORIAL_STEPS: readonly TutorialStepDefinition[] = [
  step("start_training", "session", "session.started", { mode: "training" }),
  step("move", "movement", "movement.started"),
  step("jump", "movement", "movement.jump"),
  step("slide", "movement", "movement.slide"),
  step("vault", "movement", "movement.vault"),
  step("wall_run", "movement", "movement.wall_run"),
  step("wall_jump", "movement", "movement.wall_jump"),
  step("interact", "interaction", "interaction.completed"),
];
