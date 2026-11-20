import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, describe, expect, it } from "vitest";

import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import type { MovementInputSample } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import { PlayerSystem } from "../../src/player/PlayerSystem";

const FIXED_DT = 1 / 60;

interface Harness {
  readonly physics: PhysicsWorld;
  readonly player: PlayerSystem;
}

const activeHarnesses: Harness[] = [];

function input(overrides: Partial<MovementInputSample> = {}): MovementInputSample {
  return {
    move: { x: 0, y: 0 },
    jumpPressed: false,
    jumpHeld: false,
    sprintHeld: false,
    crouchHeld: false,
    interactPressed: false,
    ...overrides,
  };
}

async function createHarness(
  options: { withWall?: boolean; withStairs?: boolean } = {},
): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: FIXED_DT,
  });

  await physics.initialize();

  const world = physics.rapierWorld;
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0));

  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20), groundBody);

  if (options.withWall) {
    const wallBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 1.5, -3));

    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 1.5, 0.2), wallBody);
  }

  if (options.withStairs) {
    // A staircase descending toward -z: 6 steps of 0.25 m, each 0.7 m deep.
    for (let index = 0; index < 6; index += 1) {
      const top = 1.5 - index * 0.25;
      const depth = 0.7;
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, top / 2, -4 - index * depth),
      );

      world.createCollider(RAPIER.ColliderDesc.cuboid(3, top / 2, depth / 2), body);
    }
  }

  const player = new PlayerSystem(physics, {
    tuning: DEFAULT_MOVEMENT_TUNING,
    spawnPoint: { x: 0, y: 0.93, z: 0 },
  });

  player.activate();

  const harness = { physics, player };

  activeHarnesses.push(harness);

  return harness;
}

function step(harness: Harness, sample: MovementInputSample, steps: number, yaw = 0): void {
  for (let index = 0; index < steps; index += 1) {
    harness.player.fixedUpdate(sample, yaw, FIXED_DT);
    harness.physics.step();
  }
}

afterEach(() => {
  for (const harness of activeHarnesses) {
    harness.player.dispose();
    harness.physics.dispose();
  }

  activeHarnesses.length = 0;
});

describe("PlayerSystem physics integration", () => {
  it("settles on the ground under the kinematic character controller", async () => {
    const harness = await createHarness();

    step(harness, input(), 120);

    const snapshot = harness.player.getMovementSnapshot();
    const position = harness.player.getPosition();

    expect(snapshot.grounded).toBe(true);
    expect(snapshot.state).toBe("IDLE");
    expect(position.y).toBeGreaterThan(0.85);
    expect(position.y).toBeLessThan(0.95);
  });

  it("moves forward and strafes according to the view yaw", async () => {
    const harness = await createHarness();

    step(harness, input(), 120);
    step(harness, input({ move: { x: 0, y: 1 } }), 90);

    const forwardPosition = harness.player.getPosition();

    expect(forwardPosition.z).toBeLessThan(-1);

    harness.player.reset();
    step(harness, input(), 120);
    step(harness, input({ move: { x: 1, y: 0 } }), 90);

    const rightPosition = harness.player.getPosition();

    expect(rightPosition.x).toBeGreaterThan(1);
  });

  it("jumps over its own height and lands back on the ground", async () => {
    const harness = await createHarness();

    step(harness, input(), 120);

    const startY = harness.player.getPosition().y;
    let maxY = startY;
    let groundedAfterLanding = false;

    harness.player.fixedUpdate(input({ jumpPressed: true, jumpHeld: true }), 0, FIXED_DT);
    harness.physics.step();

    for (let index = 0; index < 180; index += 1) {
      harness.player.fixedUpdate(input({ jumpHeld: index < 30 }), 0, FIXED_DT);
      harness.physics.step();

      const position = harness.player.getPosition();

      maxY = Math.max(maxY, position.y);

      if (index > 30 && harness.player.getMovementSnapshot().grounded) {
        groundedAfterLanding = true;
      }
    }

    expect(maxY).toBeGreaterThan(startY + 0.5);
    expect(groundedAfterLanding).toBe(true);
    expect(harness.player.getPosition().y).toBeCloseTo(startY, 1);
  });

  it("does not pass through a static wall", async () => {
    const harness = await createHarness({ withWall: true });

    step(harness, input(), 120);
    step(harness, input({ move: { x: 0, y: 1 }, sprintHeld: true }), 180);

    const position = harness.player.getPosition();
    const snapshot = harness.player.getMovementSnapshot();

    // The wall front face is at z = -2.8; the capsule radius is 0.3 m.
    expect(position.z).toBeGreaterThan(-2.7);
    expect(snapshot.speed).toBeLessThan(1);
  });

  it("keeps the physics body aligned with the simulated position", async () => {
    const harness = await createHarness();

    step(harness, input({ move: { x: 0, y: 1 } }), 90);

    const position = harness.player.getPosition();
    const translation = harness.player.body.translation();

    expect(translation.x).toBeCloseTo(position.x, 4);
    expect(translation.y).toBeCloseTo(position.y, 4);
    expect(translation.z).toBeCloseTo(position.z, 4);
  });

  it("reset returns the player to the spawn point", async () => {
    const harness = await createHarness();

    step(harness, input({ move: { x: 0, y: 1 } }), 90);
    harness.player.reset();

    expect(harness.player.getPosition()).toEqual({ x: 0, y: 0.93, z: 0 });
    expect(harness.player.getState()).toBe("IDLE");
  });

  it("walks down a staircase without free-falling between steps", async () => {
    const harness = await createHarness({ withStairs: true });

    // Place the player on top of the first step (top surface at y = 1.5).
    harness.player.teleportTo({ x: 0, y: 1.5 + 0.875, z: -2.5 });
    step(harness, input(), 60);

    expect(harness.player.getMovementSnapshot().grounded).toBe(true);

    let maxFreeFallSteps = 0;
    let currentFreeFallSteps = 0;
    let maxStepDropMeters = 0;
    let previousY = harness.player.getPosition().y;

    // Walk forward (-z) across all six steps.
    for (let index = 0; index < 420; index += 1) {
      harness.player.fixedUpdate(input({ move: { x: 0, y: 1 } }), 0, FIXED_DT);
      harness.physics.step();

      const snapshot = harness.player.getMovementSnapshot();

      if (!snapshot.grounded && snapshot.state !== "JUMPING") {
        currentFreeFallSteps += 1;
        maxFreeFallSteps = Math.max(maxFreeFallSteps, currentFreeFallSteps);
      } else {
        currentFreeFallSteps = 0;
      }

      const y = harness.player.getPosition().y;

      maxStepDropMeters = Math.max(maxStepDropMeters, previousY - y);
      previousY = y;
    }

    const finalPosition = harness.player.getPosition();

    // The player must have descended most of the staircase height.
    expect(finalPosition.y).toBeLessThan(1.0);
    // Ground-stick keeps the character attached: no long free falls.
    expect(maxFreeFallSteps).toBeLessThanOrEqual(3);
    // No single frame drops more than one step height plus margin.
    expect(maxStepDropMeters).toBeLessThan(0.3);
  });

  it("keeps the camera's vertical motion bounded while descending stairs", async () => {
    const harness = await createHarness({ withStairs: true });

    harness.player.teleportTo({ x: 0, y: 1.5 + 0.875, z: -2.5 });
    step(harness, input(), 60);

    // Warm the vertical filter up to the settled body height before measuring.
    for (let index = 0; index < 30; index += 1) {
      harness.player.getInterpolatedPosition(1);
    }

    let maxCameraJumpPerFrame = 0;
    let previousCameraY = harness.player.getInterpolatedPosition(1).y;

    for (let index = 0; index < 420; index += 1) {
      harness.player.fixedUpdate(input({ move: { x: 0, y: 1 } }), 0, FIXED_DT);
      harness.physics.step();

      const cameraY = harness.player.getInterpolatedPosition(1).y;

      maxCameraJumpPerFrame = Math.max(maxCameraJumpPerFrame, Math.abs(cameraY - previousCameraY));
      previousCameraY = cameraY;
    }

    // With ground-stick the body itself never exceeds ~9 m/s descent within snap
    // range (0.15 m/frame); the vertical filter must keep the view below that.
    expect(maxCameraJumpPerFrame).toBeLessThan(0.18);
  });
});
