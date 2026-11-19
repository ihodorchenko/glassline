import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, describe, expect, it } from "vitest";

import { PROLOGUE_ARENA_BOXES } from "../../src/levels/test/PrologueArena";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import type { MovementInputSample } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import { PlayerSystem } from "../../src/player/PlayerSystem";

const DT = 1 / 60;

interface Harness {
  readonly physics: PhysicsWorld;
  readonly player: PlayerSystem;
}

const harnesses: Harness[] = [];

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

async function createHarness(spawn: { x: number; y: number; z: number }): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: DT,
  });

  await physics.initialize();

  const world = physics.rapierWorld;

  for (const box of PROLOGUE_ARENA_BOXES) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(box.position.x, box.position.y, box.position.z),
    );

    world.createCollider(
      RAPIER.ColliderDesc.cuboid(box.size.x / 2, box.size.y / 2, box.size.z / 2),
      body,
    );
  }

  const player = new PlayerSystem(physics, {
    tuning: DEFAULT_MOVEMENT_TUNING,
    spawnPoint: spawn,
  });

  player.activate();

  const harness = { physics, player };

  harnesses.push(harness);

  return harness;
}

function step(harness: Harness, sample: MovementInputSample, steps: number, yaw = 0): void {
  for (let index = 0; index < steps; index += 1) {
    harness.player.fixedUpdate(sample, yaw, DT);
    harness.physics.step();
  }
}

afterEach(() => {
  for (const harness of harnesses) {
    harness.player.dispose();
    harness.physics.dispose();
  }

  harnesses.length = 0;
});

describe("Prologue lower-route traversal", () => {
  it("sprint-jumps the lower gap and climbs the stair flight", async () => {
    const harness = await createHarness({ x: 0, y: -2.07, z: -29 });

    step(harness, input(), 90);

    expect(harness.player.getMovementSnapshot().grounded).toBe(true);

    const sprint = input({ move: { x: 0, y: 1 }, sprintHeld: true });
    let jumped = false;
    let landed = false;

    for (let index = 0; index < 360; index += 1) {
      const position = harness.player.getPosition();
      const snapshot = harness.player.getMovementSnapshot();
      const shouldJump = !jumped && position.z < -31.2 && snapshot.grounded;

      if (shouldJump) {
        jumped = true;
      }

      harness.player.fixedUpdate(
        shouldJump ? { ...sprint, jumpPressed: true, jumpHeld: true } : sprint,
        0,
        DT,
      );
      harness.physics.step();

      if (
        jumped &&
        harness.player.getPosition().z < -35 &&
        harness.player.getMovementSnapshot().grounded
      ) {
        landed = true;
        break;
      }
    }

    const afterGap = harness.player.getPosition();

    expect(jumped).toBe(true);
    expect(landed).toBe(true);
    expect(afterGap.z).toBeLessThan(-35);
    expect(afterGap.y).toBeGreaterThan(-3.2);

    // Walk up the 0.15 m stair flight; autostep is slow but reliable.
    for (let index = 0; index < 600; index += 1) {
      harness.player.fixedUpdate(input({ move: { x: 0, y: 1 } }), 0, DT);
      harness.physics.step();

      if (harness.player.getPosition().z < -41.5) {
        break;
      }
    }

    const afterStairs = harness.player.getPosition();

    expect(afterStairs.z).toBeLessThan(-41.5);
    expect(afterStairs.y).toBeGreaterThan(-1.2);
  });

  it("jumps the final scaffold ascent to the high finish roof", async () => {
    const harness = await createHarness({ x: 0, y: -1.07, z: -65 });

    step(harness, input(), 60);

    const edges = [-72.3, -77.8, -83.4, -89.0, -94.6, -100.2, -105.8, -111.4, -117.0];
    let edgeIndex = 0;
    let jumpHoldFrames = 0;
    let landed = false;

    for (let index = 0; index < 2400; index += 1) {
      const position = harness.player.getPosition();
      const snapshot = harness.player.getMovementSnapshot();
      const edgeZ = edges[edgeIndex] ?? Number.NEGATIVE_INFINITY;
      const jump = position.z < edgeZ && snapshot.grounded;

      if (jump) {
        edgeIndex += 1;
        jumpHoldFrames = 14;
      }

      harness.player.fixedUpdate(
        input({
          move: { x: 0, y: 1 },
          jumpPressed: jump,
          jumpHeld: jumpHoldFrames > 0,
          sprintHeld: true,
        }),
        0,
        DT,
      );
      harness.physics.step();
      jumpHoldFrames = Math.max(0, jumpHoldFrames - 1);

      if (position.z < -120 && snapshot.grounded) {
        landed = true;
        break;
      }
    }

    const position = harness.player.getPosition();

    expect(landed).toBe(true);
    expect(position.y).toBeGreaterThan(4.8);
  });

  it("walks the high catwalk out, around the turn, and back", async () => {
    const harness = await createHarness({ x: 0, y: 6.1, z: -122.8 });

    step(harness, input(), 60);
    let gapJumped = false;
    let jumpHoldFrames = 0;

    for (let index = 0; index < 900; index += 1) {
      const position = harness.player.getPosition();
      const jump =
        !gapJumped &&
        position.x > 23.4 &&
        position.x < 24.6 &&
        harness.player.getMovementSnapshot().grounded;

      if (jump) {
        gapJumped = true;
        jumpHoldFrames = 14;
      }

      harness.player.fixedUpdate(
        input({
          move: { x: 0, y: 1 },
          jumpPressed: jump,
          jumpHeld: jumpHoldFrames > 0,
        }),
        -Math.PI / 2,
        DT,
      );
      harness.physics.step();
      jumpHoldFrames = Math.max(0, jumpHoldFrames - 1);

      if (harness.player.getPosition().x > 47) {
        break;
      }
    }

    const outbound = harness.player.getPosition();

    expect(gapJumped).toBe(true);
    expect(outbound.x).toBeGreaterThan(46);
    expect(outbound.y).toBeGreaterThan(4.8);

    for (let index = 0; index < 160; index += 1) {
      harness.player.fixedUpdate(input({ move: { x: 0, y: 1 } }), 0, DT);
      harness.physics.step();

      if (harness.player.getPosition().z < -130.6) {
        break;
      }
    }

    const turn = harness.player.getPosition();

    expect(turn.z).toBeLessThan(-129.5);

    for (let index = 0; index < 900; index += 1) {
      harness.player.fixedUpdate(input({ move: { x: 0, y: 1 } }), Math.PI / 2, DT);
      harness.physics.step();

      if (harness.player.getPosition().x < 10) {
        break;
      }
    }

    const back = harness.player.getPosition();

    expect(back.x).toBeLessThan(12);
    expect(back.y).toBeGreaterThan(4.8);
  });

  it("crosses the bridge and reaches the finish roof", async () => {
    const harness = await createHarness({ x: 0, y: 0.03, z: -43 });

    step(harness, input(), 60);

    for (let index = 0; index < 480; index += 1) {
      harness.player.fixedUpdate(input({ move: { x: 0, y: 1 } }), 0, DT);
      harness.physics.step();

      if (harness.player.getPosition().z < -58) {
        break;
      }
    }

    const afterFinish = harness.player.getPosition();

    expect(afterFinish.z).toBeLessThan(-58);
    expect(afterFinish.y).toBeGreaterThan(-1.2);
  });
});
