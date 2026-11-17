import { describe, expect, it } from "vitest";

import { AchievementSystem } from "../../src/achievements/AchievementSystem";
import type { PersistedAchievements } from "../../src/achievements/AchievementTypes";
import { INITIAL_ACHIEVEMENTS } from "../../src/achievements/InitialAchievements";
import { createDomainEvent } from "../../src/events/DomainEvent";

function fakePersistence(initial: PersistedAchievements | null = null) {
  let stored = initial;

  return {
    persistence: {
      load: async () => stored,
      save: async (data: PersistedAchievements) => {
        stored = data;
      },
    },
    read: () => stored,
  };
}

describe("AchievementSystem", () => {
  it("unlocks event achievements from authoritative events", () => {
    const system = new AchievementSystem({ definitions: INITIAL_ACHIEVEMENTS });
    const events: string[] = [];

    system.subscribe((event) => events.push(event.achievementId));

    const unlocked = system.recordEvent(
      createDomainEvent("training", "training.exercise_completed", {
        eventId: "t1",
        payload: { exerciseId: "ex_01_movement_basics" },
      }),
    );

    expect(unlocked.map((definition) => definition.id)).toContain("first_steps");
    expect(system.isUnlocked("first_steps")).toBe(true);
    expect(events).toContain("first_steps");

    system.recordEvent(
      createDomainEvent("training", "training.exercise_completed", {
        eventId: "t1",
        payload: { exerciseId: "ex_01_movement_basics" },
      }),
    );

    expect(system.getUnlockedCount()).toBe(1);
  });

  it("accumulates counters and respects prerequisites", () => {
    const system = new AchievementSystem({
      definitions: INITIAL_ACHIEVEMENTS,
      clock: () => 1000,
    });

    for (let index = 0; index < 10; index += 1) {
      system.recordEvent(
        createDomainEvent("training", "training.exercise_completed", {
          eventId: `exercise-${index}`,
          payload: { exerciseId: `ex-${index}` },
        }),
      );
    }

    expect(system.isUnlocked("first_steps")).toBe(true);
    expect(system.isUnlocked("learning_the_basics")).toBe(true);
    expect(system.isUnlocked("parkour_foundations")).toBe(true);
  });

  it("evaluates threshold conditions from payload values", () => {
    const system = new AchievementSystem({ definitions: INITIAL_ACHIEVEMENTS });

    system.recordEvent(createDomainEvent("speedrun", "speedrun.completed", { eventId: "run-1" }));

    system.recordEvent(
      createDomainEvent("speedrun", "speedrun.medal", {
        eventId: "medal-2",
        payload: { value: 2 },
      }),
    );

    expect(system.isUnlocked("first_run")).toBe(true);
    expect(system.isUnlocked("speed_is_everything")).toBe(true);
    expect(system.isUnlocked("gold_standard")).toBe(false);

    system.recordEvent(
      createDomainEvent("speedrun", "speedrun.medal", {
        eventId: "medal-3",
        payload: { value: 3 },
      }),
    );

    expect(system.isUnlocked("gold_standard")).toBe(true);
  });

  it("supports compound movement counters and tutorial completion events", () => {
    const system = new AchievementSystem({ definitions: INITIAL_ACHIEVEMENTS });

    for (const type of [
      "movement.vault",
      "movement.slide",
      "movement.wall_run",
      "movement.wall_jump",
    ]) {
      system.recordEvent(createDomainEvent("movement", type, { eventId: type }));
    }

    expect(system.isUnlocked("master_of_movement")).toBe(true);

    system.recordEvent(
      createDomainEvent("training", "training.exercise_completed", { eventId: "training" }),
    );
    system.recordEvent(
      createDomainEvent("tutorial", "tutorial.completed", { eventId: "tutorial" }),
    );

    expect(system.isUnlocked("tutorial_graduate")).toBe(true);
  });

  it("persists achievement records", async () => {
    const persistence = fakePersistence();
    const first = new AchievementSystem({
      definitions: INITIAL_ACHIEVEMENTS,
      persistence: persistence.persistence,
    });

    first.recordEvent(
      createDomainEvent("training", "training.exercise_completed", { eventId: "t1" }),
    );
    await first.flushPersistence();

    const restored = new AchievementSystem({
      definitions: INITIAL_ACHIEVEMENTS,
      persistence: persistence.persistence,
    });

    await restored.initialize();

    expect(restored.isUnlocked("first_steps")).toBe(true);
    expect(restored.getUnlockedCount()).toBe(1);
  });
});
