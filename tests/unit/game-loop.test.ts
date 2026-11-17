import { describe, expect, it } from "vitest";

import { DEFAULT_GAME_LOOP_CONFIG, GameLoop, type GameLoopConfig } from "../../src/core/GameLoop";
import { ManualFrameScheduler } from "../helpers/manual-scheduler";

interface LoopHarness {
  readonly loop: GameLoop;
  readonly scheduler: ManualFrameScheduler;
  readonly steps: number[];
  readonly renders: Array<{ alpha: number; deltaSeconds: number }>;
  readonly frameStarts: number[];
}

function createHarness(overrides: Partial<GameLoopConfig> = {}): LoopHarness {
  const scheduler = new ManualFrameScheduler();
  const steps: number[] = [];
  const renders: Array<{ alpha: number; deltaSeconds: number }> = [];
  const frameStarts: number[] = [];

  const loop = new GameLoop(
    { ...DEFAULT_GAME_LOOP_CONFIG, ...overrides },
    {
      onFrameStart: (timestampMs) => frameStarts.push(timestampMs),
      onFixedUpdate: (_delta, stepIndex) => steps.push(stepIndex),
      onRender: (alpha, deltaSeconds) => renders.push({ alpha, deltaSeconds }),
    },
    scheduler,
  );

  return { loop, scheduler, steps, renders, frameStarts };
}

const FRAME_MS = 1000 / 60;

describe("GameLoop", () => {
  it("runs one fixed step per 60 Hz frame after the initial frame", () => {
    const { loop, scheduler, steps } = createHarness();

    loop.start();

    // First scheduled frame only establishes the timestamp baseline.
    scheduler.advanceTo(0);
    expect(steps).toHaveLength(0);

    for (let frame = 1; frame <= 60; frame += 1) {
      scheduler.advanceTo(frame * FRAME_MS);
    }

    // 60 frame deltas of 1/60 s each -> 60 fixed steps (allow 1 for float drift).
    expect(steps.length).toBeGreaterThanOrEqual(59);
    expect(steps.length).toBeLessThanOrEqual(60);
  });

  it("clamps long frame deltas and reports dropped time", () => {
    const { loop, scheduler, steps, renders } = createHarness({
      maxFrameDeltaSeconds: 0.1,
      maxPhysicsStepsPerFrame: 5,
    });

    loop.start();
    scheduler.advanceTo(0);
    scheduler.advanceTo(500);

    expect(steps).toHaveLength(5);
    expect(renders.at(-1)?.deltaSeconds).toBeCloseTo(0.1, 6);

    // 500 ms of wall time minus the 5 simulated steps (83.3 ms) is dropped.
    const stats = loop.getStats();
    expect(stats.droppedTimeSeconds).toBeCloseTo(0.5 - (5 * 1000) / 60 / 1000, 3);
  });

  it("drops the simulation backlog when the step budget is exhausted", () => {
    const { loop, scheduler, steps } = createHarness({
      maxFrameDeltaSeconds: 0.1,
      maxPhysicsStepsPerFrame: 2,
    });

    loop.start();
    scheduler.advanceTo(0);
    scheduler.advanceTo(100);

    expect(steps).toHaveLength(2);
    expect(loop.getStats().droppedTimeSeconds).toBeGreaterThan(0.06);
  });

  it("stop cancels the pending frame", () => {
    const { loop, scheduler, renders } = createHarness();

    loop.start();
    expect(scheduler.pendingFrameCount).toBe(1);

    loop.stop();
    expect(scheduler.pendingFrameCount).toBe(0);

    scheduler.advanceTo(100);
    expect(renders).toHaveLength(0);
    expect(loop.isRunning).toBe(false);
  });

  it("reports a partial-step interpolation alpha", () => {
    const { loop, scheduler, steps, renders } = createHarness();

    loop.start();
    scheduler.advanceTo(0);
    scheduler.advanceTo(FRAME_MS / 2);

    expect(steps).toHaveLength(0);
    expect(renders.at(-1)?.alpha).toBeCloseTo(0.5, 3);
  });

  it("restarts from a clean accumulator", () => {
    const { loop, scheduler, steps } = createHarness();

    loop.start();
    scheduler.advanceTo(0);
    scheduler.advanceTo(FRAME_MS / 2);
    loop.stop();
    loop.start();

    scheduler.advanceTo(10_000);
    expect(steps).toHaveLength(0);

    scheduler.advanceTo(10_000 + FRAME_MS);
    expect(steps).toHaveLength(1);
  });

  it("calls onFrameStart before fixed updates", () => {
    const scheduler = new ManualFrameScheduler();
    const order: string[] = [];

    const loop = new GameLoop(
      DEFAULT_GAME_LOOP_CONFIG,
      {
        onFrameStart: () => order.push("frame-start"),
        onFixedUpdate: () => order.push("fixed"),
        onRender: () => order.push("render"),
      },
      scheduler,
    );

    loop.start();
    scheduler.advanceTo(0);
    scheduler.advanceTo(FRAME_MS);

    expect(order[0]).toBe("frame-start");
    expect(order.at(-1)).toBe("render");
    expect(order.filter((entry) => entry === "fixed").length).toBeGreaterThan(0);
  });

  it("rejects invalid configuration", () => {
    expect(
      () =>
        new GameLoop(
          { ...DEFAULT_GAME_LOOP_CONFIG, physicsHz: 0 },
          {
            onFixedUpdate: () => undefined,
            onRender: () => undefined,
          },
        ),
    ).toThrow(RangeError);

    expect(
      () =>
        new GameLoop(
          { ...DEFAULT_GAME_LOOP_CONFIG, maxFrameDeltaSeconds: 0 },
          {
            onFixedUpdate: () => undefined,
            onRender: () => undefined,
          },
        ),
    ).toThrow(RangeError);
  });
});
