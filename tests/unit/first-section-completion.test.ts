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
import { STATISTIC_DEFINITIONS } from "../../src/statistics/StatisticDefinitions";
import { StatisticsSystem } from "../../src/statistics/StatisticsSystem";

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

interface SpeedrunCompletionRequest {
  readonly levelId: string;
  readonly valid: boolean;
  readonly completionTimeMs?: number;
  readonly eventId?: string;
  readonly timestamp?: number;
}

function recordSpeedrunCompletion(
  harness: CompletionHarness,
  request: SpeedrunCompletionRequest,
): boolean {
  return harness.progression.recordEvent(
    createDomainEvent("speedrun", "speedrun.completed", {
      eventId: request.eventId ?? `speedrun-${request.levelId}`,
      timestamp: request.timestamp ?? 1500,
      payload: {
        levelId: request.levelId,
        valid: request.valid,
        ...(request.completionTimeMs === undefined
          ? {}
          : { completionTimeMs: request.completionTimeMs }),
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

  it("does not duplicate level completion or milestones for a new completion event", () => {
    const harness = createHarness();

    harness.complete({ mode: "prologue", levelId: PROLOGUE_TEST_LEVEL_ID });
    harness.complete({ mode: "prologue", levelId: PROLOGUE_TEST_LEVEL_ID });

    const snapshot = harness.progression.getSnapshot();
    const campaign = campaignOf(harness);

    // A second finish is a new authoritative event: the campaign may advance
    // `lastCompletedAt`/`revision`, but it must not duplicate the level record
    // or re-award the milestone. Full idempotency of the completion operation
    // is not part of the contract.
    expect(harness.published).toHaveLength(2);
    expect(campaign.completedLevelIds).toEqual([PROLOGUE_TEST_LEVEL_ID]);
    expect(snapshot.statistics.totalCompletedLevels).toBe(1);
    expect(snapshot.milestones.filter(({ id }) => id === "first_prologue_completion")).toHaveLength(
      1,
    );
    expect(snapshot.prologueCompleted).toBe(true);
  });

  it("rejects a replayed event id without changing progression", () => {
    const harness = createHarness();

    harness.complete({ mode: "prologue", levelId: PROLOGUE_TEST_LEVEL_ID });

    const snapshot = harness.progression.getSnapshot();
    const replay = harness.published[0] as DomainEvent;

    expect(harness.progression.recordEvent(replay)).toBe(false);
    expect(harness.progression.getSnapshot().revision).toBe(snapshot.revision);
  });

  it("preserves the existing valid Prologue speedrun behavior", () => {
    const harness = createHarness();

    recordSpeedrunCompletion(harness, {
      levelId: PROLOGUE_TEST_LEVEL_ID,
      valid: true,
      completionTimeMs: 90000,
    });

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

describe("Speedrun completion isolation", () => {
  it("updates Prologue progression for a valid Prologue speedrun", () => {
    const harness = createHarness();

    expect(
      recordSpeedrunCompletion(harness, {
        levelId: PROLOGUE_TEST_LEVEL_ID,
        valid: true,
        completionTimeMs: 90000,
      }),
    ).toBe(true);

    const snapshot = harness.progression.getSnapshot();
    const campaign = campaignOf(harness);

    expect(snapshot.prologueCompleted).toBe(true);
    expect(snapshot.prologueBestCompletionTime).toBe(90000);
    expect(campaign.completedLevelIds).toEqual([PROLOGUE_TEST_LEVEL_ID]);
    expect(snapshot.statistics.totalCompletedLevels).toBe(1);
    expect(harness.progression.hasMilestone("first_prologue_completion")).toBe(true);
  });

  it("does not update Prologue progression for a valid first_section speedrun", () => {
    const harness = createHarness();

    expect(
      recordSpeedrunCompletion(harness, {
        levelId: FIRST_SECTION_LEVEL_ID,
        valid: true,
        completionTimeMs: 10000,
      }),
    ).toBe(false);

    const snapshot = harness.progression.getSnapshot();
    const campaign = campaignOf(harness);

    expect(snapshot.prologueCompleted).toBe(false);
    expect(snapshot.prologueBestCompletionTime).toBeNull();
    expect(campaign.completedLevelIds).toEqual([]);
    expect(snapshot.statistics.totalCompletedLevels).toBe(0);
    expect(harness.progression.hasMilestone("first_prologue_completion")).toBe(false);
  });

  it("does not update Prologue progression for a valid speedrun on another level", () => {
    const harness = createHarness();

    expect(
      recordSpeedrunCompletion(harness, {
        levelId: ORDINARY_LEVEL_ID,
        valid: true,
        completionTimeMs: 10000,
      }),
    ).toBe(false);

    expect(harness.progression.getSnapshot().prologueCompleted).toBe(false);
    expect(campaignOf(harness).completedLevelIds).toEqual([]);
  });

  it("does not count an invalid Prologue speedrun as completion", () => {
    const harness = createHarness();

    expect(
      recordSpeedrunCompletion(harness, {
        levelId: PROLOGUE_TEST_LEVEL_ID,
        valid: false,
        completionTimeMs: 5000,
      }),
    ).toBe(false);

    const snapshot = harness.progression.getSnapshot();

    expect(snapshot.prologueCompleted).toBe(false);
    expect(snapshot.prologueBestCompletionTime).toBeNull();
    expect(campaignOf(harness).completedLevelIds).toEqual([]);
    expect(harness.progression.hasMilestone("first_prologue_completion")).toBe(false);
  });

  it("does not overwrite a Prologue best time with another level's run", () => {
    const harness = createHarness();

    recordSpeedrunCompletion(harness, {
      levelId: PROLOGUE_TEST_LEVEL_ID,
      valid: true,
      completionTimeMs: 90000,
      timestamp: 1500,
    });

    const before = harness.progression.getSnapshot();
    const campaignBefore = campaignOf(harness);

    recordSpeedrunCompletion(harness, {
      levelId: FIRST_SECTION_LEVEL_ID,
      valid: true,
      completionTimeMs: 10000,
      eventId: "speedrun-first-section-fast",
      timestamp: 2500,
    });

    const after = harness.progression.getSnapshot();
    const campaignAfter = campaignOf(harness);

    expect(after.prologueCompleted).toBe(true);
    expect(after.prologueBestCompletionTime).toBe(90000);
    expect(campaignAfter.completedLevelIds).toEqual([PROLOGUE_TEST_LEVEL_ID]);
    expect(campaignAfter.lastCompletedAt).toBe(campaignBefore.lastCompletedAt);
    expect(after.revision).toBe(before.revision);
  });
});

describe("Speedrun event routing", () => {
  it("keeps general speedrun statistics for a non-Prologue level", () => {
    const statistics = new StatisticsSystem({
      definitions: STATISTIC_DEFINITIONS,
      clock: () => 1000,
    });

    statistics.startSession({ sessionId: "session-first-section", mode: "speedrun" });

    expect(
      statistics.recordEvent(
        createDomainEvent("speedrun", "speedrun.completed", {
          eventId: "speedrun-first-section-stats",
          sessionId: "session-first-section",
          payload: {
            value: 1,
            levelId: FIRST_SECTION_LEVEL_ID,
            valid: true,
            completionTimeMs: 10000,
          },
        }),
      ),
    ).toBe(true);

    expect(statistics.getCurrentSession()?.values["speedrun.completed_runs"]).toBe(1);

    statistics.dispose();
  });
});
