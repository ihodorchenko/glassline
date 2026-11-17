import { describe, expect, it } from "vitest";

import {
  type MovementInputSample,
  MovementModel,
  type MovementModelSnapshot,
} from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";

const FIXED_DT = 1 / 60;
const FORWARD = { x: 0, y: 0, z: -1 };

function input(overrides: Partial<MovementInputSample> = {}): MovementInputSample {
  return {
    move: { x: 0, y: 0 },
    jumpPressed: false,
    jumpHeld: false,
    sprintHeld: false,
    crouchHeld: false,
    ...overrides,
  };
}

function runForward(): MovementInputSample {
  return input({ move: { x: 0, y: 1 } });
}

function simulate(
  model: MovementModel,
  sample: MovementInputSample,
  steps: number,
  grounded: boolean,
): MovementModelSnapshot {
  const magnitude = Math.min(1, Math.hypot(sample.move.x, sample.move.y));
  const direction = { x: 0, y: 0, z: -magnitude };

  for (let step = 0; step < steps; step += 1) {
    model.step(sample, direction, grounded, FIXED_DT);
  }

  return model.getSnapshot();
}

describe("MovementModel horizontal locomotion", () => {
  it("accelerates toward the run speed over multiple fixed steps", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    const snapshot = simulate(model, runForward(), 30, true);

    expect(snapshot.speed).toBeCloseTo(DEFAULT_MOVEMENT_TUNING.runSpeed, 1);
    expect(snapshot.state).toBe("RUNNING");
  });

  it("preserves momentum briefly and decelerates to idle without input", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    simulate(model, runForward(), 30, true);

    const movingSpeed = model.getSnapshot().speed;
    const stopped = simulate(model, input(), 60, true);

    expect(movingSpeed).toBeGreaterThan(5);
    expect(stopped.speed).toBe(0);
    expect(stopped.state).toBe("IDLE");
  });

  it("reaches sprint speed and reports the SPRINTING state", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    const snapshot = simulate(model, input({ move: { x: 0, y: 1 }, sprintHeld: true }), 60, true);

    expect(snapshot.speed).toBeCloseTo(DEFAULT_MOVEMENT_TUNING.sprintSpeed, 1);
    expect(snapshot.state).toBe("SPRINTING");
  });

  it("caps crouched movement speed and reports the crouch stance", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    const snapshot = simulate(model, input({ move: { x: 0, y: 1 }, crouchHeld: true }), 60, true);

    expect(snapshot.stance).toBe("crouching");
    expect(snapshot.speed).toBeCloseTo(
      DEFAULT_MOVEMENT_TUNING.runSpeed * DEFAULT_MOVEMENT_TUNING.crouchSpeedMultiplier,
      1,
    );
    expect(snapshot.state).toBe("RUNNING");
  });

  it("limits air acceleration and horizontal air speed", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    for (let step = 0; step < 120; step += 1) {
      model.step(runForward(), FORWARD, false, FIXED_DT);
    }

    const snapshot = model.getSnapshot();

    expect(snapshot.speed).toBeLessThanOrEqual(DEFAULT_MOVEMENT_TUNING.maxAirSpeed + 0.001);
    expect(snapshot.state).toBe("FALLING");
  });
});

describe("MovementModel jumping", () => {
  it("jumps from the ground with the configured jump velocity", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    model.step(input({ jumpPressed: true, jumpHeld: true }), FORWARD, true, FIXED_DT);

    const events = model.consumeEvents();
    const snapshot = model.getSnapshot();

    expect(events.jumped).toBe(true);
    expect(snapshot.verticalSpeed).toBeGreaterThan(7);
    expect(snapshot.state).toBe("JUMPING");
    expect(snapshot.grounded).toBe(false);
  });

  it("executes a buffered jump after landing", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    // Airborne attempt: no coyote time available yet.
    model.step(input({ jumpPressed: true, jumpHeld: true }), FORWARD, false, FIXED_DT);
    expect(model.consumeEvents().jumped).toBe(false);

    // The buffer is still active when the player touches the ground on the next step.
    model.step(input({ jumpHeld: true }), FORWARD, true, FIXED_DT);

    expect(model.consumeEvents().jumped).toBe(true);
    expect(model.getSnapshot().verticalSpeed).toBeGreaterThan(7);
  });

  it("allows a jump within the coyote-time window after leaving the ground", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    model.step(input(), FORWARD, true, FIXED_DT);
    model.step(input(), FORWARD, false, FIXED_DT);

    model.step(input({ jumpPressed: true, jumpHeld: true }), FORWARD, false, FIXED_DT);

    expect(model.consumeEvents().jumped).toBe(true);
  });

  it("does not allow a second jump once coyote time has expired", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    model.step(input({ jumpPressed: true, jumpHeld: true }), FORWARD, true, FIXED_DT);
    model.step(input({ jumpHeld: true }), FORWARD, false, FIXED_DT);

    for (let step = 0; step < 30; step += 1) {
      model.step(input({ jumpHeld: true }), FORWARD, false, FIXED_DT);
    }

    const before = model.getSnapshot().verticalSpeed;

    model.step(input({ jumpPressed: true, jumpHeld: true }), FORWARD, false, FIXED_DT);

    expect(model.consumeEvents().jumped).toBe(false);
    expect(model.getSnapshot().verticalSpeed).toBeLessThan(before);
  });

  it("supports variable jump height by releasing jump early", () => {
    const holding = new MovementModel(DEFAULT_MOVEMENT_TUNING);
    const released = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    holding.step(input({ jumpPressed: true, jumpHeld: true }), FORWARD, true, FIXED_DT);
    released.step(input({ jumpPressed: true, jumpHeld: true }), FORWARD, true, FIXED_DT);

    for (let step = 0; step < 18; step += 1) {
      holding.step(input({ jumpHeld: true }), FORWARD, false, FIXED_DT);
      released.step(input({ jumpHeld: false }), FORWARD, false, FIXED_DT);
    }

    expect(holding.getSnapshot().verticalSpeed).toBeGreaterThan(
      released.getSnapshot().verticalSpeed,
    );
  });

  it("clamps the falling speed", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    for (let step = 0; step < 300; step += 1) {
      model.step(input(), FORWARD, false, FIXED_DT);
    }

    expect(model.getSnapshot().verticalSpeed).toBeGreaterThanOrEqual(
      -DEFAULT_MOVEMENT_TUNING.maxFallSpeed,
    );
  });
});

describe("MovementModel collision reconciliation and landing", () => {
  it("removes velocity into an obstacle while keeping tangential motion", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    simulate(model, runForward(), 60, true);

    // The controller allowed only lateral movement this step.
    model.applyCollisionResult({ x: FIXED_DT * 2, y: 0, z: 0 }, FIXED_DT, true);

    const velocity = model.getVelocity();

    expect(velocity.z).toBeCloseTo(0, 6);
    expect(velocity.x).toBeCloseTo(2, 6);
  });

  it("reports a landing after an airborne step with ground contact", () => {
    const model = new MovementModel(DEFAULT_MOVEMENT_TUNING);

    model.step(input({ jumpPressed: true, jumpHeld: true }), FORWARD, true, FIXED_DT);
    model.consumeEvents();

    for (let step = 0; step < 60; step += 1) {
      model.step(input(), FORWARD, false, FIXED_DT);
    }

    model.applyCollisionResult({ x: 0, y: -0.05, z: 0 }, FIXED_DT, true);

    const events = model.consumeEvents();
    const snapshot = model.getSnapshot();

    expect(events.landed).toBe(true);
    expect(events.impactSpeed).toBeGreaterThan(0);
    expect(snapshot.state).toBe("LANDING");
    expect(snapshot.grounded).toBe(true);
    expect(snapshot.landingIntensity).toBe(1);
  });
});
