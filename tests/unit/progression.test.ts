import { describe, expect, it } from "vitest";

import { createDomainEvent } from "../../src/events/DomainEvent";
import {
  PROGRESSION_CONTENT,
  PROGRESSION_MILESTONES,
} from "../../src/progression/ProgressionContent";
import { ProgressionSystem } from "../../src/progression/ProgressionSystem";
import type { PersistedProgression } from "../../src/progression/ProgressionTypes";

function fakePersistence() {
  let stored: PersistedProgression | null = null;

  return {
    persistence: {
      load: async () => stored,
      save: async (data: PersistedProgression) => {
        stored = data;
      },
    },
  };
}

function createSystem(clock = () => 1000): ProgressionSystem {
  return new ProgressionSystem({
    contents: PROGRESSION_CONTENT,
    milestones: PROGRESSION_MILESTONES,
    clock,
  });
}

function exerciseEvent(eventId: string, exerciseId: string) {
  return createDomainEvent("training", "training.exercise_completed", {
    eventId,
    payload: { exerciseId },
  });
}

describe("ProgressionSystem", () => {
  it("tracks training completion and deterministic content unlocks", () => {
    const system = createSystem();

    expect(system.isContentUnlocked("training_movement")).toBe(true);
    expect(system.isContentUnlocked("training_running")).toBe(false);

    system.recordEvent(exerciseEvent("e1", "ex_01_movement_basics"));

    expect(system.isContentUnlocked("training_running")).toBe(true);
    expect(system.getSnapshot().trainingCompleted).toBe(1);
    expect(system.hasMilestone("first_training_exercise")).toBe(true);

    system.recordEvent(exerciseEvent("e1", "ex_01_movement_basics"));
    expect(system.getSnapshot().trainingCompleted).toBe(1);

    system.recordEvent(exerciseEvent("e2", "ex_02_running"));
    expect(system.isContentUnlocked("training_jumping")).toBe(true);
  });

  it("unlocks all training content through the chain and all-training milestone", () => {
    const system = createSystem();
    const ids = [
      "ex_01_movement_basics",
      "ex_02_running",
      "ex_03_jumping",
      "ex_04_vaulting",
      "ex_05_sliding",
      "ex_06_wall_running",
      "ex_07_wall_jumping",
      "ex_08_landing_momentum",
      "ex_09_interaction",
      "ex_10_combined_traversal",
    ];

    for (const [index, exerciseId] of ids.entries()) {
      system.recordEvent(exerciseEvent(`e${index}`, exerciseId));
    }

    expect(system.getSnapshot().trainingCompleted).toBe(10);
    expect(system.isContentUnlocked("training_combined_traversal")).toBe(true);
    expect(system.hasMilestone("all_training_exercises")).toBe(true);
  });

  it("tracks Prologue completion, best time, and milestones", () => {
    const system = createSystem();

    system.recordEvent(
      createDomainEvent("speedrun", "speedrun.completed", {
        eventId: "run-1",
        payload: { levelId: "prologue_test", completionTimeMs: 90000, valid: true },
      }),
    );

    expect(system.getSnapshot().prologueCompleted).toBe(true);
    expect(system.getSnapshot().prologueBestCompletionTime).toBe(90000);
    expect(system.hasMilestone("first_prologue_completion")).toBe(true);

    system.recordEvent(
      createDomainEvent("speedrun", "speedrun.completed", {
        eventId: "run-2",
        payload: { levelId: "prologue_test", completionTimeMs: 95000, valid: true },
      }),
    );

    expect(system.getSnapshot().prologueBestCompletionTime).toBe(90000);
  });

  it("consumes achievement events for milestones and play-time statistics", () => {
    const system = createSystem();

    system.recordEvent(
      createDomainEvent("achievement", "achievement.unlocked", {
        eventId: "a1",
        payload: { achievementId: "gold_standard" },
      }),
    );

    expect(system.hasMilestone("gold_standard_route")).toBe(true);

    system.recordEvent(
      createDomainEvent("session", "session.started", { eventId: "s1", timestamp: 2000 }),
    );
    system.recordEvent(
      createDomainEvent("session", "session.completed", {
        eventId: "s2",
        timestamp: 3000,
        payload: { durationSeconds: 42 },
      }),
    );

    expect(system.getSnapshot().statistics.totalPlayTimeSeconds).toBe(42);
    expect(system.getSnapshot().statistics.firstSessionAt).toBe(2000);
    expect(system.getSnapshot().statistics.lastPlayedAt).toBe(3000);
  });

  it("persists progression and restores it", async () => {
    const fake = fakePersistence();
    const first = new ProgressionSystem({
      contents: PROGRESSION_CONTENT,
      milestones: PROGRESSION_MILESTONES,
      persistence: fake.persistence,
      clock: () => 1000,
    });

    first.recordEvent(exerciseEvent("e1", "ex_01_movement_basics"));
    await first.flushPersistence();

    const restored = new ProgressionSystem({
      contents: PROGRESSION_CONTENT,
      milestones: PROGRESSION_MILESTONES,
      persistence: fake.persistence,
      clock: () => 2000,
    });

    await restored.initialize();

    expect(restored.getSnapshot().trainingCompleted).toBe(1);
    expect(restored.isContentUnlocked("training_running")).toBe(true);
    expect(restored.hasMilestone("first_training_exercise")).toBe(true);
  });
});
