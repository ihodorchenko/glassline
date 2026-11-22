import type { GameplayMode } from "../sessions/GameplaySessionManager";

/**
 * Authored campaign Prologue level.
 *
 * The id is kept explicit instead of inferring "Prologue" from
 * `mode === "prologue"`: `prologue` is currently the only mode that can run a
 * single authored level, so new levels (for example the first standalone
 * section) reuse it. Only the level below may feed Prologue progression.
 */
export const PROLOGUE_COMPLETION_LEVEL_ID = "prologue_test";

export interface LevelCompletionDecision {
  /** Gameplay mode of the session that just finished. */
  readonly mode: GameplayMode | null;
  /** Level the finished session actually ran. */
  readonly levelId: string;
  /** Speedrun validation result; `null` when no ranked run was active. */
  readonly speedrunValid: boolean | null;
}

/**
 * Whether finishing a session may publish `level.completed`.
 *
 * `ProgressionSystem` treats `level.completed` as proof that the campaign
 * Prologue was completed (`campaign.prologueCompleted`), so publication is
 * gated on the authored Prologue level itself:
 *
 * - `prologue` — a normal finish of the Prologue level;
 * - `speedrun` — a valid ranked run of the Prologue level only;
 * - `training` — never.
 *
 * Completing any other level (for example `first_section`, which shares the
 * `prologue` mode) publishes nothing and therefore cannot mark the Prologue as
 * completed. This is a publication decision, not event-consumer masking.
 */
export function shouldPublishPrologueCompletion(input: LevelCompletionDecision): boolean {
  if (input.levelId !== PROLOGUE_COMPLETION_LEVEL_ID) {
    return false;
  }

  if (input.mode === "prologue") {
    return true;
  }

  return input.mode === "speedrun" && input.speedrunValid === true;
}
