import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type CheckpointDefinition, CheckpointSystem } from "../../src/checkpoint/CheckpointSystem";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import type { MovementInputSample } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import { PlayerSystem } from "../../src/player/PlayerSystem";
import { RespawnManager } from "../../src/respawn/RespawnManager";

const FIXED_DT = 1 / 60;

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

function addBox(
  world: RAPIER.World,
  center: { x: number; y: number; z: number },
  halfExtents: { x: number; y: number; z: number },
): void {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
  );

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z),
    body,
  );
}

async function createHarness(configure?: (world: RAPIER.World) => void): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: FIXED_DT,
  });

  await physics.initialize();

  const world = physics.rapierWorld;

  addBox(world, { x: 0, y: -0.1, z: 0 }, { x: 30, y: 0.1, z: 30 });
  configure?.(world);

  const player = new PlayerSystem(physics, {
    tuning: DEFAULT_MOVEMENT_TUNING,
    spawnPoint: { x: 0, y: 0.93, z: 0 },
  });

  player.activate();

  const harness = { physics, player };

  harnesses.push(harness);

  return harness;
}

function step(harness: Harness, sample: MovementInputSample, steps: number): void {
  for (let index = 0; index < steps; index += 1) {
    harness.player.fixedUpdate(sample, 0, FIXED_DT);
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

describe("PlayerSystem traversal integration", () => {
  it("slides under a low ceiling that blocks standing and crouching", async () => {
    const harness = await createHarness((world) => {
      // Ceiling bottom at 1.05 m spanning z in [-9.5, -6.5].
      addBox(world, { x: 0, y: 1.15, z: -8 }, { x: 2, y: 0.1, z: 1.5 });
    });

    step(harness, input(), 120);

    // Sprint up to speed, then crouch to enter a slide before the tunnel.
    step(harness, input({ move: { x: 0, y: 1 }, sprintHeld: true }), 45);

    const beforeSlide = harness.player.getPosition();
    const speedBeforeSlide = harness.player.getMovementSnapshot().speed;

    step(harness, input({ crouchHeld: true }), 60);

    const afterSlide = harness.player.getPosition();

    expect(speedBeforeSlide).toBeGreaterThan(5);
    expect(afterSlide.z).toBeLessThan(beforeSlide.z - 3);
    expect(afterSlide.z).toBeLessThan(-9.5);
  });

  it("blocks a crouching player at the low ceiling", async () => {
    const harness = await createHarness((world) => {
      addBox(world, { x: 0, y: 1.15, z: -8 }, { x: 2, y: 0.1, z: 1.5 });
    });

    step(harness, input(), 120);
    step(harness, input({ crouchHeld: true }), 120);
    step(harness, input({ crouchHeld: true, move: { x: 0, y: 1 } }), 120);

    const position = harness.player.getPosition();

    expect(harness.player.getState()).not.toBe("SLIDING");
    expect(position.z).toBeGreaterThan(-6.7);
  });

  it("vaults over an obstacle when the interact action is pressed", async () => {
    const harness = await createHarness((world) => {
      // 0.75 m high obstacle with a clear landing behind it.
      addBox(world, { x: 0, y: 0.375, z: -1.25 }, { x: 1, y: 0.375, z: 0.25 });
    });

    step(harness, input(), 120);

    let vaultEvents = 0;

    harness.player.onMovementEvent("player:vault-started", () => {
      vaultEvents += 1;
    });

    let stepped = 0;

    while (harness.player.getPosition().z > -0.4 && stepped < 30) {
      step(harness, input({ move: { x: 0, y: 1 } }), 1);
      stepped += 1;
    }

    step(harness, input({ move: { x: 0, y: 1 }, interactPressed: true }), 1);
    step(harness, input(), 40);

    const position = harness.player.getPosition();

    expect(vaultEvents).toBe(1);
    expect(position.z).toBeLessThan(-1.9);
  });
});

describe("Respawn integration with the player controller", () => {
  it("restores the player at the active checkpoint and re-enables movement", async () => {
    const harness = await createHarness();

    step(harness, input(), 120);

    const spawnTransforms: Record<
      string,
      { position: { x: number; y: number; z: number }; rotationY: number }
    > = {
      sp_initial: { position: { x: 0, y: 0.93, z: 0 }, rotationY: 0 },
      sp_cp: { position: { x: 0, y: 0.93, z: 2 }, rotationY: 0 },
    };
    const checkpoints: CheckpointDefinition[] = [
      {
        id: "cp",
        levelId: "test_level",
        sectionId: "test",
        displayName: "Test",
        spawnPointId: "sp_cp",
        respawnEnabled: true,
      },
    ];
    const checkpointSystem = new CheckpointSystem(checkpoints, {
      levelId: "test_level",
      sessionId: "test_session",
      spawnResolver: {
        resolve: (spawnPointId) => spawnTransforms[spawnPointId] ?? null,
      },
    });

    expect(checkpointSystem.notifyTriggerEnter("cp", 100)?.checkpointId).toBe("cp");

    const camera = { resetForRespawn: vi.fn() };
    const control = { setEnabled: vi.fn() };
    const manager = new RespawnManager(
      { checkpoints: checkpointSystem, player: harness.player, camera, input: control },
      { fallbackSpawn: { x: 0, y: 0.93, z: 0 }, respawnDurationSeconds: 0.1 },
    );

    // Simulate a fall below the kill plane.
    harness.player.teleportTo({ x: 0, y: -10, z: 0 });
    expect(manager.request("fall")).toBe(true);

    manager.update(0.05);
    manager.update(0.06);

    expect(harness.player.getPosition().z).toBeCloseTo(2, 3);
    expect(control.setEnabled).toHaveBeenLastCalledWith(true);

    step(harness, input({ move: { x: 0, y: 1 } }), 60);

    expect(harness.player.getPosition().z).toBeLessThan(1.5);
    expect(harness.player.getMovementSnapshot().grounded).toBe(true);
  });
});
