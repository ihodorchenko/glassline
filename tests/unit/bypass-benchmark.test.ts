import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, describe, expect, it } from "vitest";

import { PROLOGUE_ARENA_BOXES } from "../../src/levels/test/PrologueArena";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import type { MovementInputSample } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import { PlayerSystem } from "../../src/player/PlayerSystem";

const DT = 1 / 60;
const harnesses: PhysicsWorld[] = [];

function input(overrides: Partial<MovementInputSample> = {}): MovementInputSample {
  return {
    move: { x: 0, y: 0 },
    jumpPressed: false,
    jumpHeld: false,
    sprintHeld: true,
    crouchHeld: false,
    interactPressed: false,
    ...overrides,
  };
}

async function createHarness(spawn: { x: number; y: number; z: number }): Promise<{
  physics: PhysicsWorld;
  player: PlayerSystem;
}> {
  const physics = new PhysicsWorld({ gravity: { x: 0, y: -9.81, z: 0 }, timestepSeconds: DT });
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
  harnesses.push(physics);
  return { physics, player };
}

afterEach(() => {
  for (const physics of harnesses.splice(0)) physics.dispose();
});

function step(
  harness: { physics: PhysicsWorld; player: PlayerSystem },
  sample: MovementInputSample,
  yaw: number,
  frames = 1,
): void {
  for (let index = 0; index < frames; index += 1) {
    harness.player.fixedUpdate(sample, yaw, DT);
    harness.physics.step();
  }
}

describe("catwalk line timing", () => {
  it("times the direct two-jump line", async () => {
    const harness = await createHarness({ x: 50, y: 6.1, z: -130.8 });
    step(harness, input(), Math.PI / 2, 30);
    let first = false;
    let second = false;
    let hold = 0;
    let frame = 0;

    for (; frame < 1200; frame += 1) {
      const p = harness.player.getPosition();
      const grounded = harness.player.getMovementSnapshot().grounded;
      const jumpFirst = !first && p.x < 39.8 && p.x > 38.6 && grounded;
      const jumpSecond = first && !second && p.x < 34.8 && p.x > 33.6 && grounded;

      if (jumpFirst) {
        first = true;
        hold = 14;
      } else if (jumpSecond) {
        second = true;
        hold = 14;
      }

      harness.player.fixedUpdate(
        input({
          move: { x: 0, y: 1 },
          jumpPressed: jumpFirst || jumpSecond,
          jumpHeld: hold > 0,
        }),
        Math.PI / 2,
        DT,
      );
      harness.physics.step();
      hold = Math.max(0, hold - 1);

      if (p.x < 25) break;
    }

    // Tuned movement (variable jump, takeoff compensation) shortens the line:
    // the direct route now runs ~280 frames instead of the original ~330.
    expect(frame).toBeGreaterThan(260);
    expect(frame).toBeLessThan(450);
  });

  it("times the lower bypass", async () => {
    const harness = await createHarness({ x: 50, y: 6.1, z: -130.8 });
    step(harness, input(), Math.PI / 2, 30);
    const route = [
      { x: 37, z: -130.8 },
      { x: 37, z: -134.8 },
      { x: 31, z: -135.3 },
      { x: 31, z: -133.2 },
      { x: 31, z: -130.9 },
      { x: 25, z: -130.8 },
    ];
    let target = 0;
    let first = false;
    let hold = 0;
    let frame = 0;

    for (; frame < 1800; frame += 1) {
      const p = harness.player.getPosition();
      const grounded = harness.player.getMovementSnapshot().grounded;
      const goal = route[target] ?? { x: 25, z: -130.8 };
      if (Math.hypot(p.x - goal.x, p.z - goal.z) < 0.7 && target < route.length - 1) {
        target += 1;
      }

      const dx = goal.x - p.x;
      const dz = goal.z - p.z;
      const yaw = Math.atan2(-dx, -dz);
      const jumpFirst = !first && p.x < 39.8 && p.x > 38.6 && grounded;

      if (jumpFirst) {
        first = true;
        hold = 14;
      }

      harness.player.fixedUpdate(
        input({
          move: { x: 0, y: 1 },
          jumpPressed: jumpFirst,
          jumpHeld: hold > 0,
        }),
        yaw,
        DT,
      );
      harness.physics.step();
      hold = Math.max(0, hold - 1);

      if (target === route.length - 1 && Math.hypot(p.x - 25, p.z + 130.8) < 0.8) break;
    }

    expect(target).toBe(route.length - 1);
    expect(frame).toBeGreaterThan(350);
    expect(frame).toBeLessThan(500);
    // The direct two-jump line is faster; the bypass trades ~0.4 s for one fewer
    // timed jump. Keep the gap visible rather than silently tuning it away.
    expect(frame).toBeGreaterThan(378 + 5);
    expect(frame - 378).toBeLessThan(120);
  });
});
