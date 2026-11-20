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

  it("rides up a step edge as a smooth ramp, not a hop", async () => {
    const physics = new PhysicsWorld({
      gravity: { x: 0, y: -9.81, z: 0 },
      timestepSeconds: FIXED_DT,
    });

    await physics.initialize();

    const world = physics.rapierWorld;
    const groundBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20), groundBody);

    // A 0.2 m step ahead on the running line (front face at z = -6).
    const stepBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.1, -12),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(6, 0.1, 6), stepBody);

    const player = new PlayerSystem(physics, {
      tuning: DEFAULT_MOVEMENT_TUNING,
      spawnPoint: { x: 0, y: 0.895, z: 0 },
    });

    player.activate();
    activeHarnesses.push({ physics, player });

    step({ physics, player }, input(), 60);

    let previousY = player.getPosition().y;
    let maxLiftPerStep = 0;
    let reachedTop = false;

    for (let index = 0; index < 400; index += 1) {
      player.fixedUpdate(input({ move: { x: 0, y: 1 } }), 0, FIXED_DT);
      physics.step();

      const position = player.getPosition();

      maxLiftPerStep = Math.max(maxLiftPerStep, position.y - previousY);
      previousY = position.y;

      // The step block spans z in [-18, -6]; standing on it means z < -6.2
      // with feet at the block top (center ≈ 0.895 + 0.2 = 1.095).
      if (position.z < -6.2 && position.y > 1.0) {
        reachedTop = true;
        break;
      }
    }

    expect(reachedTop).toBe(true);
    // The climb over the riser is spread across several frames: no single fixed
    // step may throw the body up by more than ~0.06 m (raw autostep hops the
    // full 0.2 m in one frame).
    expect(maxLiftPerStep).toBeLessThan(0.06);
  });

  it("runs up a steep ramp without stalling", async () => {
    const physics = new PhysicsWorld({
      gravity: { x: 0, y: -9.81, z: 0 },
      timestepSeconds: FIXED_DT,
    });

    await physics.initialize();

    const world = physics.rapierWorld;
    const groundBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.1, 60), groundBody);

    // A 35° ramp rising toward -z (beyond Rapier's comfortable climb handling).
    const angle = (35 * Math.PI) / 180;
    const rampLength = 8;
    const rampCenterY = Math.sin(angle) * (rampLength / 2) + 0.02;
    const rampCenterZ = -(6 + Math.cos(angle) * (rampLength / 2));
    const rampBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, rampCenterY, rampCenterZ)
        .setRotation({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) }),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(6, 0.15, rampLength / 2), rampBody);

    const player = new PlayerSystem(physics, {
      tuning: DEFAULT_MOVEMENT_TUNING,
      spawnPoint: { x: 0, y: 0.895, z: 0 },
    });

    player.activate();
    activeHarnesses.push({ physics, player });

    step({ physics, player }, input(), 60);

    let minSpeedOnRamp = Number.POSITIVE_INFINITY;
    let samples = 0;
    let reachedTop = false;

    for (let index = 0; index < 400; index += 1) {
      player.fixedUpdate(input({ move: { x: 0, y: 1 } }), 0, FIXED_DT);
      physics.step();

      const position = player.getPosition();

      if (position.z < -6 && position.z > -14 && player.getMovementSnapshot().grounded) {
        minSpeedOnRamp = Math.min(minSpeedOnRamp, player.getMovementSnapshot().speed);
        samples += 1;
      }

      if (position.z < -12 && position.y > 5) {
        reachedTop = true;
        break;
      }
    }

    expect(samples).toBeGreaterThan(20);
    // Before slope handling the body crawled at ~0.6 m/s and never climbed;
    // now the incline keeps most of the run speed and the ramp is traversable.
    expect(minSpeedOnRamp).toBeGreaterThan(2.5);
    expect(reachedTop).toBe(true);
  });

  it("slides down a ramp and exits cleanly at the bottom (GF-11 slope case)", async () => {
    const physics = new PhysicsWorld({
      gravity: { x: 0, y: -9.81, z: 0 },
      timestepSeconds: FIXED_DT,
    });

    await physics.initialize();

    const world = physics.rapierWorld;
    const groundBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.1, 60), groundBody);

    // A 35° ramp rising toward -z (the same shape as the climb test).
    const angle = (35 * Math.PI) / 180;
    const rampLength = 8;
    const rampCenterY = Math.sin(angle) * (rampLength / 2) + 0.02;
    const rampCenterZ = -(6 + Math.cos(angle) * (rampLength / 2));
    const rampBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, rampCenterY, rampCenterZ)
        .setRotation({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) }),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(6, 0.15, rampLength / 2), rampBody);

    const player = new PlayerSystem(physics, {
      tuning: DEFAULT_MOVEMENT_TUNING,
      spawnPoint: { x: 0, y: 3.2, z: -9.5 },
    });

    player.activate();
    activeHarnesses.push({ physics, player });

    step({ physics, player }, input(), 60);

    let slid = false;
    let maxSpeedDropPerStep = 0;
    let previousSpeed: number | null = null;
    let exitState: string | null = null;
    let exitY = 0;

    for (let index = 0; index < 300; index += 1) {
      // Downhill = backward input (+z).
      player.fixedUpdate(input({ move: { x: 0, y: -1 }, crouchHeld: index > 30 }), 0, FIXED_DT);
      physics.step();

      const snapshot = player.getMovementSnapshot();
      const position = player.getPosition();

      if (snapshot.state === "SLIDING") {
        slid = true;

        if (previousSpeed !== null) {
          maxSpeedDropPerStep = Math.max(maxSpeedDropPerStep, previousSpeed - snapshot.speed);
        }

        previousSpeed = snapshot.speed;
      } else if (slid) {
        exitState = snapshot.state;
        exitY = position.y;
        break;
      }
    }

    expect(slid).toBe(true);
    // No single-step velocity kill on the descent.
    expect(maxSpeedDropPerStep).toBeLessThan(1);
    // The slide exits to a valid grounded state at the bottom of the ramp.
    expect(exitState).toBe("RUNNING");
    expect(exitY).toBeLessThan(1.2);
  });

  it("emits a landing event after a wall jump touchdown", async () => {
    const physics = new PhysicsWorld({
      gravity: { x: 0, y: -9.81, z: 0 },
      timestepSeconds: FIXED_DT,
    });

    await physics.initialize();

    const world = physics.rapierWorld;
    const groundBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20), groundBody);

    // Tall wall alongside the sprint line at x = -0.9.
    const wallBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(-0.9, 10, -8),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 10, 20), wallBody);

    const player = new PlayerSystem(physics, {
      tuning: DEFAULT_MOVEMENT_TUNING,
      spawnPoint: { x: 0, y: 0.93, z: 0 },
    });

    player.activate();
    activeHarnesses.push({ physics, player });

    let landedEvents = 0;

    player.onMovementEvent("player:landed", () => {
      landedEvents += 1;
    });

    step({ physics, player }, input(), 60);
    step({ physics, player }, input({ move: { x: 0, y: 1 }, sprintHeld: true }), 80);

    // Jump toward the wall, then kick off it once a wall run is established.
    player.fixedUpdate(
      input({ move: { x: 0, y: 1 }, sprintHeld: true, jumpPressed: true, jumpHeld: true }),
      0,
      FIXED_DT,
    );
    physics.step();

    let sawWallRun = false;
    let sawWallJump = false;

    for (let index = 0; index < 40 && !sawWallJump; index += 1) {
      player.fixedUpdate(input({ move: { x: 0, y: 1 }, sprintHeld: true }), 0, FIXED_DT);
      physics.step();

      if (player.getState() === "WALLRUN") {
        sawWallRun = true;
      }

      if (sawWallRun) {
        player.fixedUpdate(
          input({ move: { x: 0, y: 1 }, sprintHeld: true, jumpPressed: true, jumpHeld: true }),
          0,
          FIXED_DT,
        );
        physics.step();

        if (player.getState() === "WALLJUMP") {
          sawWallJump = true;
        }
      }
    }

    expect(sawWallRun).toBe(true);
    expect(sawWallJump).toBe(true);

    // Settle back onto the ground: the wall-jump airborne phase must produce a
    // landing event even though updateState() relabels WALLJUMP as FALLING
    // before contact resolves.
    for (let index = 0; index < 200 && landedEvents === 0; index += 1) {
      player.fixedUpdate(input(), 0, FIXED_DT);
      physics.step();
    }

    expect(landedEvents).toBeGreaterThan(0);
  });

  it("climbs a 0.15 m stair flight without per-step velocity collapses", async () => {
    // Regression for the jerky stair ascent: the step-glide's final sliver
    // used to reconcile the velocity down to ~1 m/s on every riser, and the
    // face probe could miss the riser when the capsule was already touching
    // it (deep stalls). The climb must keep most of the run speed.
    const physics = new PhysicsWorld({
      gravity: { x: 0, y: -9.81, z: 0 },
      timestepSeconds: FIXED_DT,
    });

    await physics.initialize();

    const world = physics.rapierWorld;
    const groundBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.1, 60), groundBody);

    // Ten 0.15 m risers, 0.5 m apart (the skybridge stair proportions).
    for (let index = 0; index < 10; index += 1) {
      const top = index === 0 ? 0.15 : 0.15 + index * 0.15;

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, top / 2 - 0.05, -2 - index * 0.5),
      );

      world.createCollider(RAPIER.ColliderDesc.cuboid(3, top / 2 + 0.05, 0.25), body);
    }

    const player = new PlayerSystem(physics, {
      tuning: DEFAULT_MOVEMENT_TUNING,
      spawnPoint: { x: 0, y: 0.895, z: 0 },
    });

    player.activate();
    activeHarnesses.push({ physics, player });

    step({ physics, player }, input(), 60);

    let minSpeed = Number.POSITIVE_INFINITY;
    let maxSpeedDropPerStep = 0;
    let previousSpeed: number | null = null;

    for (let index = 0; index < 240; index += 1) {
      player.fixedUpdate(input({ move: { x: 0, y: 1 } }), 0, FIXED_DT);
      physics.step();

      const position = player.getPosition();
      const snapshot = player.getMovementSnapshot();

      // Only measure once the climb has started (first riser reached).
      if (position.z < -1.2 && position.y > 1.1) {
        minSpeed = Math.min(minSpeed, snapshot.speed);

        if (previousSpeed !== null) {
          maxSpeedDropPerStep = Math.max(maxSpeedDropPerStep, previousSpeed - snapshot.speed);
        }

        previousSpeed = snapshot.speed;
      }

      if (position.z < -4.6 && position.y > 1.5) {
        break;
      }
    }

    const final = player.getPosition();

    // The flight was climbed…
    expect(final.z).toBeLessThan(-4.6);
    // …without stalls: the speed stays in the run band…
    expect(minSpeed).toBeGreaterThan(3);
    // …and without per-step collapses.
    expect(maxSpeedDropPerStep).toBeLessThan(2);
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

  it("keeps slide velocity smooth on flat ground (no single-step velocity kill)", async () => {
    // Regression for GF-ISSUE-01: a grounded slide's downward bias used to
    // fight the controller's snap-to-ground feature, which occasionally
    // stalled the controller and dropped the slide speed from ~7 m/s to ~0
    // in a single fixed step. The same world/start as the minimal Rapier
    // repro so the failure mode is deterministic.
    const physics = new PhysicsWorld({
      gravity: { x: 0, y: -9.81, z: 0 },
      timestepSeconds: FIXED_DT,
    });

    await physics.initialize();

    const world = physics.rapierWorld;
    const groundBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.1, 30), groundBody);

    const player = new PlayerSystem(physics, {
      tuning: DEFAULT_MOVEMENT_TUNING,
      spawnPoint: { x: 0, y: 0.9, z: 13 },
    });

    player.activate();
    activeHarnesses.push({ physics, player });

    // Settle, then sprint to full speed.
    step({ physics, player }, input(), 90);
    step({ physics, player }, input({ move: { x: 0, y: 1 }, sprintHeld: true }), 90);

    let maxSpeedDropPerStep = 0;
    let previousSpeed: number | null = null;
    let slideSteps = 0;

    for (let index = 0; index < 300; index += 1) {
      player.fixedUpdate(
        input({ move: { x: 0, y: 1 }, sprintHeld: true, crouchHeld: true }),
        0,
        FIXED_DT,
      );
      physics.step();

      const snapshot = player.getMovementSnapshot();

      if (snapshot.state === "SLIDING") {
        slideSteps += 1;

        if (previousSpeed !== null) {
          maxSpeedDropPerStep = Math.max(maxSpeedDropPerStep, previousSpeed - snapshot.speed);
        }

        previousSpeed = snapshot.speed;
      } else if (slideSteps > 0) {
        break;
      }
    }

    // The slide must actually run (well past the minimum duration)…
    expect(slideSteps).toBeGreaterThan(20);
    // …and its friction (2 m/s/s => 0.033 m/s per step) is the only decay:
    // a single-step drop of even 1 m/s is the velocity-kill signature.
    expect(maxSpeedDropPerStep).toBeLessThan(1);
  });

  it("reports the vault profile in the vault-started event", async () => {
    const harness = await createHarness();
    const events: Array<{ speed: number; vaultType: string }> = [];

    harness.player.onMovementEvent("player:vault-started", (payload) => {
      events.push({ speed: payload.speed, vaultType: payload.vaultType });
    });

    // Vault obstacle at (0, 0.375, -1.25) in front of the run line.
    const world = harness.physics.rapierWorld;
    const obstacleBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.375, -1.25),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(1.2, 0.375, 0.35), obstacleBody);

    step(harness, input(), 120);

    for (let index = 0; index < 90 && events.length === 0; index += 1) {
      harness.player.fixedUpdate(
        input({ move: { x: 0, y: 1 }, sprintHeld: true, interactPressed: true }),
        0,
        FIXED_DT,
      );
      harness.physics.step();
    }

    expect(events.length).toBe(1);
    const event = events[0];

    if (!event) {
      throw new Error("expected a vault-started event");
    }

    // The vault may start as soon as the candidate appears, so the profile
    // must match the event's own speed (the model tests cover the exact
    // selection thresholds deterministically).
    expect(event.vaultType).toBe(event.speed >= 6 ? "speed" : "standard");
    expect(event.speed).toBeGreaterThanOrEqual(DEFAULT_MOVEMENT_TUNING.vaultMinEntrySpeed);
  });

  it("keeps the vault capsule out of the obstacle (collision-validated traversal)", async () => {
    const harness = await createHarness();
    const world = harness.physics.rapierWorld;

    // Vault obstacle spanning z [-0.65, -1.35], top y = 0.75, width x ±1.2.
    const obstacleBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.375, -1),
    );

    const obstacleCollider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.2, 0.375, 0.35),
      obstacleBody,
    );

    step(harness, input(), 120);

    let vaulted = false;
    let penetrated = false;

    for (let index = 0; index < 240; index += 1) {
      harness.player.fixedUpdate(
        input({ move: { x: 0, y: 1 }, sprintHeld: true, interactPressed: true }),
        0,
        FIXED_DT,
      );
      harness.physics.step();

      const snapshot = harness.player.getMovementSnapshot();

      if (snapshot.state === "VAULTING") {
        vaulted = true;

        // Engine-authoritative overlap check: the vault moves through the
        // character controller, so the capsule must never intersect the
        // obstacle (the pre-fix kinematic teleport swept through it).
        if (world.intersectionPair(harness.player.collider, obstacleCollider)) {
          penetrated = true;
        }
      } else if (vaulted) {
        break;
      }
    }

    expect(vaulted).toBe(true);
    expect(penetrated).toBe(false);
  });

  it("starts a wall run only when the surface resolver accepts the wall", async () => {
    const runWallRunScenario = async (isWallRunnable: boolean) => {
      const physics = new PhysicsWorld({
        gravity: { x: 0, y: -9.81, z: 0 },
        timestepSeconds: FIXED_DT,
      });

      await physics.initialize();

      const world = physics.rapierWorld;
      const groundBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
      );

      world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.1, 20), groundBody);

      // Wall on the right of the run line (x 0.8..1.0, z -1.5..1.5).
      const wallBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0.9, 1.6, 0),
      );

      world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 1.6, 1.5), wallBody);

      const player = new PlayerSystem(physics, {
        tuning: DEFAULT_MOVEMENT_TUNING,
        spawnPoint: { x: 0.3, y: 0.93, z: 2 },
        isWallRunnable: () => isWallRunnable,
      });

      player.activate();
      activeHarnesses.push({ physics, player });

      for (let index = 0; index < 60; index += 1) {
        player.fixedUpdate(input(), 0, FIXED_DT);
        physics.step();
      }

      let wallRan = false;

      for (let index = 0; index < 120; index += 1) {
        const sample =
          index < 20
            ? input({ move: { x: 0, y: 1 }, sprintHeld: true })
            : input({
                move: { x: 0, y: 1 },
                sprintHeld: true,
                jumpPressed: index === 20,
                jumpHeld: true,
              });

        player.fixedUpdate(sample, 0, FIXED_DT);
        physics.step();

        if (player.getMovementSnapshot().state === "WALLRUN") {
          wallRan = true;
          break;
        }
      }

      return wallRan;
    };

    expect(await runWallRunScenario(false)).toBe(false);
    expect(await runWallRunScenario(true)).toBe(true);
  });
});
