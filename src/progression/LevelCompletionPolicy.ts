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

/** Authored Prologue checkpoint count used by the `checkpoint_pro` achievement. */
export const PROLOGUE_CHECKPOINT_SET_SIZE = 5;

export interface PrologueCheckpointSetDecision {
  /** Gameplay mode of the running session. */
  readonly mode: GameplayMode | null;
  /** Level the running session loaded. */
  readonly levelId: string | null;
  /** Unique checkpoints activated in the current session. */
  readonly activatedCheckpointCount: number;
  /** Whether this session already published the set event. */
  readonly alreadyEmitted: boolean;
}

/**
 * Whether activating another checkpoint may publish `checkpoint.prologue_all`.
 *
 * That event feeds the `checkpoint_pro` achievement ("Activate all five
 * Prologue checkpoints in one run"). It is Prologue-specific, so the level id
 * is part of the condition, exactly like `shouldPublishPrologueCompletion`:
 * the checkpoint count alone is never an identity signal. A different level
 * (for example `first_section`) must not unlock a Prologue achievement even if
 * it authors five or more checkpoints, and no generic per-level threshold is
 * introduced here. A future First Section achievement needs its own event and
 * definition.
 */
export function shouldPublishPrologueCheckpointSet(input: PrologueCheckpointSetDecision): boolean {
  if (input.alreadyEmitted) {
    return false;
  }

  if (input.levelId !== PROLOGUE_COMPLETION_LEVEL_ID) {
    return false;
  }

  if (input.mode === "training") {
    return false;
  }

  return input.activatedCheckpointCount >= PROLOGUE_CHECKPOINT_SET_SIZE;
}
