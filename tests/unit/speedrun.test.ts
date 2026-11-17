import { describe, expect, it } from "vitest";

import { formatRunTime, MonotonicRunTimer } from "../../src/speedrun/RunTimer";
import {
  calculateMedal,
  type SpeedrunRoute,
  SpeedrunSystem,
} from "../../src/speedrun/SpeedrunSystem";

const ROUTE: SpeedrunRoute = {
  id: "prologue_test_route",
  name: "Prologue Test Route",
  version: 1,
  sections: [
    { id: "sec_rooftop", displayName: "Rooftop", checkpointId: "cp_rooftop" },
    { id: "sec_industrial", displayName: "Industrial", checkpointId: "cp_industrial" },
    { id: "sec_construction", displayName: "Construction", checkpointId: "cp_construction" },
    { id: "sec_skybridge", displayName: "Skybridge", checkpointId: "cp_skybridge" },
    { id: "sec_finish", displayName: "Finish", checkpointId: "cp_finish" },
  ],
  checkpointOrder: ["cp_rooftop", "cp_industrial", "cp_construction", "cp_skybridge", "cp_finish"],
  finishTriggerId: "trigger_finish",
  medalThresholds: { bronze: 240000, silver: 180000, gold: 120000 },
};

function harness(): {
  readonly system: SpeedrunSystem;
  readonly advance: (milliseconds: number) => void;
  readonly now: () => number;
} {
  let now = 1000;
  const system = new SpeedrunSystem({ route: ROUTE, clock: () => now });

  return {
    system,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    now: () => now,
  };
}

describe("MonotonicRunTimer", () => {
  it("measures monotonic elapsed time independent of updates", () => {
    let now = 100;
    const timer = new MonotonicRunTimer(() => now);

    timer.start();
    now += 12345;

    for (let index = 0; index < 100; index += 1) {
      now += 0;
      timer.getElapsedTime();
    }

    expect(timer.getElapsedTime()).toBe(12345);
    expect(timer.stop()).toBe(12345);
    expect(timer.isRunning()).toBe(false);
  });

  it("rejects invalid timer operations", () => {
    const now = 0;
    const timer = new MonotonicRunTimer(() => now);

    expect(() => timer.stop()).toThrow(/not running/);

    timer.start();
    expect(() => timer.start()).toThrow(/already running/);
    timer.stop();
    expect(() => timer.stop()).toThrow(/not running/);
    expect(timer.getElapsedTime()).toBe(0);
  });
});

describe("SpeedrunSystem", () => {
  it("records ordered checkpoints and produces a validated result with splits", () => {
    const { system, advance } = harness();

    system.prepare("session-1");
    system.startRun();

    advance(10000);
    expect(system.recordCheckpoint("cp_rooftop")?.splitTimeMs).toBe(10000);

    advance(5000);
    expect(system.recordCheckpoint("cp_industrial")?.splitTimeMs).toBe(5000);

    advance(5000);
    system.recordCheckpoint("cp_construction");

    advance(5000);
    system.recordCheckpoint("cp_skybridge");

    advance(5000);
    system.recordCheckpoint("cp_finish");

    advance(30000);
    const result = system.finishRun("trigger_finish");

    expect(result.validation.valid).toBe(true);
    expect(result.totalTimeMs).toBe(60000);
    expect(result.checkpointsCompleted).toBe(5);
    expect(result.splits).toHaveLength(5);
    expect(result.splits[0]).toMatchObject({
      checkpointId: "cp_rooftop",
      sectionId: "sec_rooftop",
      splitTimeMs: 10000,
      totalTimeMs: 10000,
    });
    expect(result.splits[4]).toMatchObject({
      checkpointId: "cp_finish",
      splitTimeMs: 5000,
      totalTimeMs: 30000,
    });
    expect(result.medal).toBe("gold");
    expect(system.getState()).toBe("finished");
  });

  it("invalidates out-of-order checkpoint activation", () => {
    const { system, advance } = harness();

    system.prepare("session-1");
    system.startRun();
    advance(1000);

    expect(system.recordCheckpoint("cp_industrial")).toBeNull();
    expect(system.getState()).toBe("invalidated");
    expect(system.getSnapshot().validationErrors[0]).toContain("CHECKPOINT_ORDER_VIOLATION");
  });

  it("invalidates a finish with missing checkpoints", () => {
    const { system, advance } = harness();

    system.prepare("session-1");
    system.startRun();
    advance(1000);
    system.recordCheckpoint("cp_rooftop");
    advance(1000);

    const result = system.finishRun("trigger_finish");

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.some((error) => error.includes("MISSING_CHECKPOINT"))).toBe(
      true,
    );
    expect(result.medal).toBe("none");
    expect(system.getState()).toBe("invalidated");
  });

  it("does not depend on frame timing or getter calls for elapsed time", () => {
    const { system, advance } = harness();

    system.prepare("session-1");
    system.startRun();
    advance(1500);

    for (let index = 0; index < 500; index += 1) {
      system.getElapsedTimeMs();
    }

    for (const checkpointId of ROUTE.checkpointOrder) {
      system.recordCheckpoint(checkpointId);
      advance(1);
    }

    advance(2485);
    const result = system.finishRun("trigger_finish");

    expect(result.totalTimeMs).toBe(3990);
    expect(result.validation.valid).toBe(true);
  });

  it("supports abandonment and medals", () => {
    const { system, advance } = harness();

    system.prepare("session-1");
    system.startRun();
    advance(500);
    system.abandon("player");

    expect(system.getState()).toBe("abandoned");
    expect(system.getResult()).toBeNull();

    expect(calculateMedal(120000, ROUTE.medalThresholds)).toBe("gold");
    expect(calculateMedal(150000, ROUTE.medalThresholds)).toBe("silver");
    expect(calculateMedal(200000, ROUTE.medalThresholds)).toBe("bronze");
    expect(calculateMedal(300000, ROUTE.medalThresholds)).toBe("none");
    expect(formatRunTime(62345)).toBe("01:02.345");
  });
});
