import { describe, expect, it } from "vitest";

import {
  createDomainEvent,
  type DomainEvent,
  readPayloadString,
} from "../../src/events/DomainEvent";
import { PROLOGUE_TEST_LEVEL_ID } from "../../src/levels/test/PrologueTestLevel";
import {
  PROLOGUE_COMPLETION_LEVEL_ID,
  shouldPublishPrologueCompletion,
} from "../../src/progression/LevelCompletionPolicy";
import {
  PROGRESSION_CONTENT,
  PROGRESSION_MILESTONES,
} from "../../src/progression/ProgressionContent";
import { ProgressionSystem } from "../../src/progression/ProgressionSystem";
import type { GameplayMode } from "../../src/sessions/GameplaySessionManager";

/**
 * A level that shares the `prologue` gameplay mode but is not the Prologue.
 * Step 3.2B authors the real one; the id is the contract this test protects.
 */
const FIRST_SECTION_LEVEL_ID = "first_section";
const ORDINARY_LEVEL_ID = "ordinary_test_level";

interface CompletionRequest {
  readonly mode: GameplayMode;
  readonly levelId: string;
  readonly speedrunValid?: boolean | null;
  readonly eventId?: string;
}

interface CompletionHarness {
  readonly progression: ProgressionSystem;
  readonly published: DomainEvent[];
  /** Mirrors `Application.completeGameplay`: publish only what the policy allows. */
  complete(request: CompletionRequest): boolean;
}

function createHarness(): CompletionHarness {
  const progression = new ProgressionSystem({
    contents: PROGRESSION_CONTENT,
    milestones: PROGRESSION_MILESTONES,
    clock: () => 1000,
  });
  const published: DomainEvent[] = [];
  let sequence = 0;

  return {
    progression,
    published,
    complete(request: CompletionRequest): boolean {
      const publishes = shouldPublishPrologueCompletion({
        mode: request.mode,
        levelId: request.levelId,
        speedrunValid: request.speedrunValid ?? null,
      });

      if (!publishes) {
        return false;
      }

      const event = createDomainEvent("level", "level.completed", {
        eventId: request.eventId ?? `level-completed-${sequence}`,
        timestamp: 2000 + sequence,
        mode: request.mode,
        payload: { value: 1, levelId: request.levelId },
      });

      sequence += 1;
      published.push(event);
      progression.recordEvent(event);

      return true;
    },
  };
}

function campaignOf(harness: CompletionHarness) {
  return harness.progression.getProgression().campaign;
}

function recordValidSpeedrun(harness: CompletionHarness, completionTimeMs: number): void {
  harness.progression.recordEvent(
    createDomainEvent("speedrun", "speedrun.completed", {
      eventId: "speedrun-valid",
      timestamp: 1500,
      payload: {
        levelId: PROLOGUE_TEST_LEVEL_ID,
        completionTimeMs,
        valid: true,
      },
    }),
  );
}

describe("Prologue completion policy", () => {
  it("pins the completion level to the authored Prologue level id", () => {
    expect(PROLOGUE_COMPLETION_LEVEL_ID).toBe(PROLOGUE_TEST_LEVEL_ID);
  });

  it("selects only Prologue-mode finishes and valid Prologue speedruns", () => {
    const prologue = (mode: GameplayMode, speedrunValid: boolean | null = null) =>
      shouldPublishPrologueCompletion({
        mode,
        levelId: PROLOGUE_TEST_LEVEL_ID,
        speedrunValid,
      });

    expect(prologue("prologue")).toBe(true);
    expect(prologue("speedrun", true)).toBe(true);
    expect(prologue("speedrun", false)).toBe(false);
    expect(prologue("speedrun", null)).toBe(false);
    expect(prologue("training")).toBe(false);

    expect(
      shouldPublishPrologueCompletion({
        mode: "prologue",
        levelId: FIRST_SECTION_LEVEL_ID,
        speedrunValid: null,
      }),
    ).toBe(false);
    expect(
      shouldPublishPrologueCompletion({
        mode: "speedrun",
        levelId: FIRST_SECTION_LEVEL_ID,
        speedrunValid: true,
      }),
    ).toBe(false);
    expect(
      shouldPublishPrologueCompletion({
        mode: null,
        levelId: PROLOGUE_TEST_LEVEL_ID,
        speedrunValid: null,
      }),
    ).toBe(false);
  });
});

describe("Prologue completion isolation", () => {
  it("keeps existing Prologue progression when prologue_test completes", () => {
    const harness = createHarness();

    expect(harness.complete({ mode: "prologue", levelId: PROLOGUE_TEST_LEVEL_ID })).toBe(true);

    expect(harness.published).toHaveLength(1);
    expect(readPayloadString(harness.published[0] as DomainEvent, "levelId")).toBe(
      PROLOGUE_TEST_LEVEL_ID,
    );

    const snapshot = harness.progression.getSnapshot();
    const campaign = campaignOf(harness);

    expect(snapshot.prologueCompleted).toBe(true);
    expect(campaign.completedLevelIds).toEqual([PROLOGUE_TEST_LEVEL_ID]);
    expect(snapshot.statistics.totalCompletedLevels).toBe(1);
    expect(harness.progression.hasMilestone("first_prologue_completion")).toBe(true);
  });

  it("does not complete the Prologue when first_section finishes", () => {
    const harness = createHarness();

    expect(harness.complete({ mode: "prologue", levelId: FIRST_SECTION_LEVEL_ID })).toBe(false);

    const snapshot = harness.progression.getSnapshot();
    const campaign = campaignOf(harness);

    expect(harness.published).toEqual([]);
    expect(snapshot.prologueCompleted).toBe(false);
    expect(campaign.completedLevelIds).toEqual([]);
    expect(snapshot.statistics.totalCompletedLevels).toBe(0);
    expect(harness.progression.hasMilestone("first_prologue_completion")).toBe(false);
  });

  it("does not complete the Prologue for an ordinary level in prologue mode", () => {
    const harness = createHarness();

    expect(harness.complete({ mode: "prologue", levelId: ORDINARY_LEVEL_ID })).toBe(false);

    expect(harness.progression.getSnapshot().prologueCompleted).toBe(false);
    expect(campaignOf(harness).completedLevelIds).toEqual([]);
  });

  it("does not duplicate progression changes on repeated completion", () => {
    const harness = createHarness();

    harness.complete({ mode: "prologue", levelId: PROLOGUE_TEST_LEVEL_ID });
    harness.complete({ mode: "prologue", levelId: PROLOGUE_TEST_LEVEL_ID });

    const snapshot = harness.progression.getSnapshot();
    const campaign = campaignOf(harness);

    expect(harness.published).toHaveLength(2);
    expect(campaign.completedLevelIds).toEqual([PROLOGUE_TEST_LEVEL_ID]);
    expect(snapshot.statistics.totalCompletedLevels).toBe(1);
    expect(snapshot.milestones.filter(({ id }) => id === "first_prologue_completion")).toHaveLength(
      1,
    );
    expect(snapshot.prologueCompleted).toBe(true);

    // Replaying the exact same event is rejected by event-id deduplication.
    const replay = harness.published[0] as DomainEvent;
    const revisionBeforeReplay = snapshot.revision;

    expect(harness.progression.recordEvent(replay)).toBe(false);
    expect(harness.progression.getSnapshot().revision).toBe(revisionBeforeReplay);
  });

  it("preserves the existing valid Prologue speedrun behavior", () => {
    const harness = createHarness();

    recordValidSpeedrun(harness, 90000);

    expect(
      harness.complete({
        mode: "speedrun",
        levelId: PROLOGUE_TEST_LEVEL_ID,
        speedrunValid: true,
      }),
    ).toBe(true);

    const snapshot = harness.progression.getSnapshot();

    expect(harness.published).toHaveLength(1);
    expect(snapshot.prologueCompleted).toBe(true);
    expect(snapshot.prologueBestCompletionTime).toBe(90000);
    expect(campaignOf(harness).completedLevelIds).toEqual([PROLOGUE_TEST_LEVEL_ID]);
  });

  it("does not publish for an invalid speedrun completion", () => {
    const harness = createHarness();

    expect(
      harness.complete({
        mode: "speedrun",
        levelId: PROLOGUE_TEST_LEVEL_ID,
        speedrunValid: false,
      }),
    ).toBe(false);

    expect(harness.published).toEqual([]);
    expect(harness.progression.getSnapshot().prologueCompleted).toBe(false);
  });
});
