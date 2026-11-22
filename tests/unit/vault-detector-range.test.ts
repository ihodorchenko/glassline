import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, describe, expect, it } from "vitest";

import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import { VaultDetector } from "../../src/player/detection/VaultDetector";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";

/**
 * Narrow range regression for `VaultDetector` after the multi-height probe fix.
 *
 * The physical feet include the 0.02 m Rapier character-controller skin; the
 * detector must measure obstacle height from the authored support surface and
 * must cover the whole `vaultMinHeight … vaultMaxHeight` range.
 */

const DT = 1 / 60;
const FLOOR_TOP = 0;
const PHYSICAL_FEET = 0.02;
const AGENT_CENTER_Y = FLOOR_TOP + DEFAULT_MOVEMENT_TUNING.capsuleHeight / 2 + PHYSICAL_FEET;

interface DetectionWorld {
  readonly physics: PhysicsWorld;
  readonly world: RAPIER.World;
}

const worlds: DetectionWorld[] = [];

function addBox(
  world: RAPIER.World,
  center: { x: number; y: number; z: number },
  halfExtents: { x: number; y: number; z: number },
): RAPIER.Collider {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z),
  );

  return world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z),
    body,
  );
}

async function createWorld(
  obstacleHeight: number,
  options: { readonly ceiling?: boolean; readonly landingDrop?: boolean } = {},
): Promise<DetectionWorld> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: DT,
  });

  await physics.initialize();

  const world = physics.rapierWorld;

  if (options.landingDrop) {
    // Support only under the agent and the obstacle; the landing zone sits
    // 0.75 m lower, which is outside the allowed vault landing drop (0.6 m).
    addBox(world, { x: 0, y: -0.1, z: 0.2 }, { x: 20, y: 0.1, z: 1.8 });
    addBox(world, { x: 0, y: -0.85, z: -2.8 }, { x: 20, y: 0.1, z: 1.2 });
  } else {
    addBox(world, { x: 0, y: -0.1, z: 0 }, { x: 20, y: 0.1, z: 20 });
  }

  addBox(
    world,
    { x: 0, y: obstacleHeight / 2, z: -1.25 },
    { x: 2, y: obstacleHeight / 2, z: 0.25 },
  );

  if (options.ceiling) {
    addBox(world, { x: 0, y: 1.6, z: -1.25 }, { x: 2, y: 0.1, z: 1 });
  }

  // The agent's own kinematic capsule must never be detected as the obstacle.
  const agentBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, AGENT_CENTER_Y, 0),
  );

  world.createCollider(
    RAPIER.ColliderDesc.capsule(
      DEFAULT_MOVEMENT_TUNING.capsuleHeight / 2 - DEFAULT_MOVEMENT_TUNING.capsuleRadius,
      DEFAULT_MOVEMENT_TUNING.capsuleRadius,
    ),
    agentBody,
  );

  world.step();

  const detectionWorld = { physics, world };

  worlds.push(detectionWorld);

  return detectionWorld;
}

function detect(physicsWorld: DetectionWorld): ReturnType<VaultDetector["detect"]> {
  return new VaultDetector(physicsWorld.world, DEFAULT_MOVEMENT_TUNING).detect(
    { x: 0, y: AGENT_CENTER_Y, z: 0 },
    { x: 0, y: 0, z: -1 },
    PHYSICAL_FEET,
  );
}

afterEach(() => {
  for (const physicsWorld of worlds) {
    physicsWorld.physics.dispose();
  }

  worlds.length = 0;
});

describe("VaultDetector range regression", () => {
  for (const height of [0.35, 0.5, 0.7, 1.1, 1.15]) {
    it(`detects a ${height.toFixed(2)} m obstacle from physical feet with a 0.02 m offset`, async () => {
      const physicsWorld = await createWorld(height);
      const candidate = detect(physicsWorld);

      expect(candidate).not.toBeNull();
      expect(candidate?.obstacleTopY).toBeCloseTo(height, 4);
      expect(candidate?.landingPosition.z).toBeLessThan(-1.5);
    });
  }

  for (const height of [0.34, 1.16]) {
    it(`rejects a ${height.toFixed(2)} m obstacle outside vaultMinHeight/vaultMaxHeight`, async () => {
      const physicsWorld = await createWorld(height);

      expect(detect(physicsWorld)).toBeNull();
    });
  }

  it("rejects an obstacle whose landing space exceeds the allowed drop", async () => {
    const physicsWorld = await createWorld(0.75, { landingDrop: true });

    expect(detect(physicsWorld)).toBeNull();
  });

  it("rejects an obstacle without enough headroom", async () => {
    const physicsWorld = await createWorld(0.75, { ceiling: true });

    expect(detect(physicsWorld)).toBeNull();
  });

  it("never detects the agent's own kinematic capsule", async () => {
    // Every accepted case above runs with the kinematic agent capsule in the
    // same world; a detector that did not exclude kinematic bodies would hit
    // the agent at ~0 m and return null for all of them.
    const physicsWorld = await createWorld(0.75);

    expect(detect(physicsWorld)).not.toBeNull();
  });
});
