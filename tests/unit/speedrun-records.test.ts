import { describe, expect, it } from "vitest";
import { SpeedrunRecordStore } from "../../src/speedrun/SpeedrunRecordStore";
import type { PersistedSpeedrunRecords } from "../../src/speedrun/SpeedrunRecords";
import { type SpeedrunRoute, SpeedrunSystem } from "../../src/speedrun/SpeedrunSystem";

const ROUTE: SpeedrunRoute = {
  id: "route",
  name: "Route",
  version: 1,
  sections: [{ id: "s1", displayName: "S1", checkpointId: "cp1" }],
  checkpointOrder: ["cp1"],
  finishTriggerId: "finish",
  medalThresholds: { bronze: 240000, silver: 180000, gold: 120000 },
};

function entry(id: string, time: number, completedAt: number) {
  return {
    id,
    routeId: "route",
    routeVersion: 1,
    completionTimeMs: time,
    medal: "gold" as const,
    completedAt,
    splits: [
      { checkpointId: "cp1", sectionId: "s1", index: 0, splitTimeMs: 1000, totalTimeMs: time },
    ],
    validation: { valid: true, errors: [] as string[] },
    sessionId: `session-${id}`,
  };
}

describe("SpeedrunRecordStore", () => {
  it("sorts validated records and exposes personal bests", () => {
    const store = new SpeedrunRecordStore();

    store.addRecord(entry("slow", 60000, 2));
    store.addRecord(entry("fast", 50000, 3));
    store.addRecord({ ...entry("invalid", 40000, 4), validation: { valid: false, errors: [] } });
    store.addRecord(entry("fast", 50000, 3));

    expect(store.getRecords()).toHaveLength(2);
    expect(store.getPersonalBest("route", 1)?.id).toBe("fast");
    expect(store.isPersonalBest(entry("fast", 50000, 3))).toBe(true);
  });

  it("persists records", async () => {
    let stored: PersistedSpeedrunRecords | null = null;
    const persistence = {
      load: async () => stored,
      save: async (data: PersistedSpeedrunRecords) => {
        stored = data;
      },
    };
    const first = new SpeedrunRecordStore({ persistence });

    first.addRecord(entry("fast", 50000, 3));
    await first.flushPersistence();

    const restored = new SpeedrunRecordStore({ persistence });

    await restored.initialize();

    expect(restored.getPersonalBest("route", 1)?.id).toBe("fast");
  });

  it("repairs records written with monotonic completion timestamps", async () => {
    let stored: PersistedSpeedrunRecords = {
      schemaVersion: 1,
      records: [{ ...entry("legacy", 50000, 0), completedAt: 1234 }],
      updatedAt: 1234,
    };
    const persistence = {
      load: async () => stored,
      save: async (data: PersistedSpeedrunRecords) => {
        stored = data;
      },
    };
    const store = new SpeedrunRecordStore({
      persistence,
      clock: () => 1_700_000_000_000,
    });

    await store.initialize();

    expect(store.getPersonalBest("route", 1)?.completedAt).toBe(1_700_000_000_000);
    expect(store.getRecords()).toHaveLength(1);
  });

  it("records valid SpeedrunSystem runs with wall-clock completion dates", () => {
    let now = 1000;
    const store = new SpeedrunRecordStore();
    const system = new SpeedrunSystem({
      route: ROUTE,
      clock: () => now,
      wallClock: () => 1_700_000_000_000,
      records: store,
    });

    system.prepare("session-1");
    system.startRun();
    now += 1000;
    system.recordCheckpoint("cp1");
    now += 5000;
    const result = system.finishRun("finish");

    expect(result.validation.valid).toBe(true);
    expect(result.completedAt).toBe(1_700_000_000_000);
    expect(store.getRecords()).toHaveLength(1);
    expect(store.getPersonalBest("route", 1)?.completionTimeMs).toBe(6000);
    expect(store.getPersonalBest("route", 1)?.completedAt).toBe(1_700_000_000_000);
  });
});
