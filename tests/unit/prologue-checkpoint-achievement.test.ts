import { describe, expect, it } from "vitest";

import { PROLOGUE_TEST_LEVEL_ID } from "../../src/levels/test/PrologueTestLevel";
import {
  PROLOGUE_CHECKPOINT_SET_SIZE,
  PROLOGUE_COMPLETION_LEVEL_ID,
  shouldPublishPrologueCheckpointSet,
} from "../../src/progression/LevelCompletionPolicy";

/**
 * `checkpoint.prologue_all` gates the Prologue-only `checkpoint_pro`
 * achievement. Step 3.5 separates the checkpoint count (a condition) from the
 * level identity (the actual gate), so a different level with five or more
 * checkpoints cannot unlock a Prologue achievement.
 */

const FIRST_SECTION_LEVEL_ID = "first_section";
const ORDINARY_LEVEL_ID = "ordinary_checkpoint_test";

function decision(overrides: {
  readonly mode?: "training" | "prologue" | "speedrun" | null;
  readonly levelId?: string | null;
  readonly activatedCheckpointCount?: number;
  readonly alreadyEmitted?: boolean;
}): Parameters<typeof shouldPublishPrologueCheckpointSet>[0] {
  return {
    mode: overrides.mode === undefined ? "prologue" : overrides.mode,
    levelId: overrides.levelId === undefined ? PROLOGUE_COMPLETION_LEVEL_ID : overrides.levelId,
    activatedCheckpointCount: overrides.activatedCheckpointCount ?? PROLOGUE_CHECKPOINT_SET_SIZE,
    alreadyEmitted: overrides.alreadyEmitted ?? false,
  };
}

describe("Prologue checkpoint achievement policy", () => {
  it("pins the authored Prologue level and its checkpoint count", () => {
    expect(PROLOGUE_COMPLETION_LEVEL_ID).toBe(PROLOGUE_TEST_LEVEL_ID);
    expect(PROLOGUE_CHECKPOINT_SET_SIZE).toBe(5);
  });

  it("publishes after the fifth Prologue checkpoint in prologue and speedrun modes", () => {
    expect(shouldPublishPrologueCheckpointSet(decision({ activatedCheckpointCount: 5 }))).toBe(
      true,
    );
    expect(
      shouldPublishPrologueCheckpointSet(
        decision({ mode: "speedrun", activatedCheckpointCount: 6 }),
      ),
    ).toBe(true);
  });

  it("waits for the authored Prologue checkpoint count", () => {
    for (const count of [0, 1, 4]) {
      expect(
        shouldPublishPrologueCheckpointSet(decision({ activatedCheckpointCount: count })),
        `count ${count}`,
      ).toBe(false);
    }
  });

  it("publishes at most once per session", () => {
    expect(
      shouldPublishPrologueCheckpointSet(
        decision({ activatedCheckpointCount: 5, alreadyEmitted: true }),
      ),
    ).toBe(false);
  });

  it("never publishes for First Section, regardless of checkpoint count", () => {
    for (const count of [4, 5, 9]) {
      expect(
        shouldPublishPrologueCheckpointSet(
          decision({ levelId: FIRST_SECTION_LEVEL_ID, activatedCheckpointCount: count }),
        ),
        `count ${count}`,
      ).toBe(false);
    }
  });

  it("never publishes for any other level with enough checkpoints", () => {
    expect(
      shouldPublishPrologueCheckpointSet(
        decision({ levelId: ORDINARY_LEVEL_ID, activatedCheckpointCount: 5 }),
      ),
    ).toBe(false);
    expect(
      shouldPublishPrologueCheckpointSet(decision({ levelId: null, activatedCheckpointCount: 5 })),
    ).toBe(false);
  });

  it("keeps the existing non-training Prologue condition", () => {
    expect(shouldPublishPrologueCheckpointSet(decision({ mode: "training" }))).toBe(false);
    expect(shouldPublishPrologueCheckpointSet(decision({ mode: null }))).toBe(true);
  });
});
