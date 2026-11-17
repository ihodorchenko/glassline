import { describe, expect, it } from "vitest";

import { createDomainEvent } from "../../src/events/DomainEvent";
import { STATISTIC_DEFINITIONS } from "../../src/statistics/StatisticDefinitions";
import { StatisticsSystem } from "../../src/statistics/StatisticsSystem";
import type { PersistedStatistics } from "../../src/statistics/StatisticsTypes";

function fakePersistence(initial: PersistedStatistics | null = null) {
  let stored: PersistedStatistics | null = initial;

  return {
    persistence: {
      load: async () => stored,
      save: async (data: PersistedStatistics) => {
        stored = data;
      },
    },
    read: () => stored,
  };
}

function createSystem(clock = () => 1000): {
  system: StatisticsSystem;
  persistence: ReturnType<typeof fakePersistence>;
} {
  const persistence = fakePersistence();
  const system = new StatisticsSystem({
    definitions: STATISTIC_DEFINITIONS,
    clock,
    persistence: persistence.persistence,
  });

  return { system, persistence };
}

describe("StatisticsSystem", () => {
  it("aggregates validated events into session and lifetime scopes", () => {
    const clock = { now: 1000 };
    const { system } = createSystem(() => clock.now);

    system.startSession({ sessionId: "session-1", mode: "training", startedAt: 1000 });

    expect(
      system.recordEvent(
        createDomainEvent("movement", "movement.jump", {
          eventId: "e1",
          sessionId: "session-1",
          payload: { value: 1 },
        }),
      ),
    ).toBe(true);
    system.recordEvent(
      createDomainEvent("movement", "movement.jump", {
        eventId: "e2",
        sessionId: "session-1",
        payload: { value: 1 },
      }),
    );
    system.recordEvent(
      createDomainEvent("movement", "movement.maximum_speed", {
        eventId: "e3",
        sessionId: "session-1",
        payload: { value: 6.4 },
      }),
    );
    system.recordEvent(
      createDomainEvent("movement", "movement.maximum_speed", {
        eventId: "e4",
        sessionId: "session-1",
        payload: { value: 4.1 },
      }),
    );
    system.recordEvent(
      createDomainEvent("movement", "movement.distance", {
        eventId: "e5",
        sessionId: "session-1",
        payload: { value: 12.5 },
      }),
    );

    clock.now = 61000;
    const summary = system.finalizeSession({ completed: true, endedAt: 61000 });

    expect(summary?.durationSeconds).toBe(60);
    expect(summary?.completed).toBe(true);
    expect(summary?.values["general.total_jumps"]).toBe(2);
    expect(summary?.values["general.total_distance"]).toBe(12.5);
    expect(summary?.values["movement.maximum_speed"]).toBe(6.4);
    expect(system.getSnapshot().lifetime.totalSessions).toBe(1);
    expect(system.getSnapshot().lifetime.completedSessions).toBe(1);
    expect(system.getSnapshot().lifetime.values["general.total_jumps"]).toBe(2);
    expect(system.getSnapshot().modes.training?.sessionCount).toBe(1);
    expect(system.getCurrentSession()).toBeNull();
  });

  it("deduplicates repeated event ids and rejects events from other sessions", () => {
    const { system } = createSystem();

    system.startSession({ sessionId: "session-1", mode: "training" });

    const event = createDomainEvent("movement", "movement.jump", {
      eventId: "duplicate",
      sessionId: "session-1",
      payload: { value: 1 },
    });

    expect(system.recordEvent(event)).toBe(true);
    expect(system.recordEvent(event)).toBe(false);
    expect(
      system.recordEvent(
        createDomainEvent("movement", "movement.jump", {
          eventId: "other-session",
          sessionId: "session-2",
          payload: { value: 1 },
        }),
      ),
    ).toBe(false);
    expect(system.getCurrentSession()?.values["general.total_jumps"]).toBe(1);
  });

  it("rejects invalid numeric values and unknown event types", () => {
    const { system } = createSystem();

    system.startSession({ sessionId: "session-1", mode: "training" });

    expect(
      system.recordEvent(
        createDomainEvent("movement", "movement.jump", {
          eventId: "negative",
          sessionId: "session-1",
          payload: { value: -5 },
        }),
      ),
    ).toBe(false);
    expect(
      system.recordEvent(
        createDomainEvent("unknown", "unknown.event", {
          eventId: "unknown",
          sessionId: "session-1",
          payload: { value: 1 },
        }),
      ),
    ).toBe(false);
  });

  it("persists and restores lifetime statistics", async () => {
    const persistence = fakePersistence();
    const first = new StatisticsSystem({
      definitions: STATISTIC_DEFINITIONS,
      persistence: persistence.persistence,
      clock: () => 1000,
    });

    first.startSession({ sessionId: "s1", mode: "prologue", startedAt: 1000 });
    first.recordEvent(
      createDomainEvent("movement", "movement.vault", {
        eventId: "v1",
        sessionId: "s1",
        payload: { value: 1 },
      }),
    );
    first.finalizeSession({ completed: true, endedAt: 2000 });
    await first.flushPersistence();

    const restored = new StatisticsSystem({
      definitions: STATISTIC_DEFINITIONS,
      persistence: persistence.persistence,
      clock: () => 3000,
    });

    await restored.initialize();

    expect(restored.getLifetime().totalSessions).toBe(1);
    expect(restored.getLifetime().values["general.total_vaults"]).toBe(1);
  });
});
