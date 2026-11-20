import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, describe, expect, it } from "vitest";

import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import { VaultDetector } from "../../src/player/detection/VaultDetector";
import { WallRunDetector } from "../../src/player/detection/WallRunDetector";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";

interface Harness {
  readonly physics: PhysicsWorld;
  readonly world: RAPIER.World;
  readonly collider: RAPIER.Collider;
}

const harnesses: Harness[] = [];

async function createHarness(): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: 1 / 60,
  });

  await physics.initialize();

  const world = physics.rapierWorld;
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0));

  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.1, 30), groundBody);

  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.93, 0),
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(
      DEFAULT_MOVEMENT_TUNING.capsuleHeight / 2 - DEFAULT_MOVEMENT_TUNING.capsuleRadius,
      DEFAULT_MOVEMENT_TUNING.capsuleRadius,
    ),
    playerBody,
  );
  const harness = { physics, world, collider };

  harnesses.push(harness);

  return harness;
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
  world.step();
}

afterEach(() => {
  for (const harness of harnesses) {
    harness.physics.dispose();
  }

  harnesses.length = 0;
});

describe("WallRunDetector", () => {
  it("detects a parallel wall to the side while moving along it", async () => {
    const harness = await createHarness();

    addBox(harness.world, { x: 0.9, y: 1.6, z: 0 }, { x: 0.2, y: 1.6, z: 3 });

    const detector = new WallRunDetector(harness.world);

    const candidate = detector.detect({ x: 0, y: 0.93, z: 0 }, { x: 0, y: -1, z: -6 });

    expect(candidate).not.toBeNull();
    expect(candidate?.side).toBe("right");
    expect(candidate?.tangent.z).toBeLessThan(-0.9);
  });

  it("rejects low speed and distant walls", async () => {
    const harness = await createHarness();

    addBox(harness.world, { x: 0.9, y: 1.6, z: 0 }, { x: 0.2, y: 1.6, z: 3 });
    addBox(harness.world, { x: 2.5, y: 1.6, z: 0 }, { x: 0.2, y: 1.6, z: 3 });

    const detector = new WallRunDetector(harness.world);

    expect(detector.detect({ x: 0, y: 0.93, z: 0 }, { x: 0, y: -1, z: -3 })).toBeNull();
  });

  it("returns null when no wall is nearby", async () => {
    const harness = await createHarness();
    const detector = new WallRunDetector(harness.world);

    expect(detector.detect({ x: 0, y: 0.93, z: 0 }, { x: 0, y: -1, z: -6 })).toBeNull();
  });

  it("gates wall-run eligibility through the surface resolver", async () => {
    const harness = await createHarness();

    addBox(harness.world, { x: 0.9, y: 1.6, z: 0 }, { x: 0.2, y: 1.6, z: 3 });

    const velocity = { x: 0, y: -1, z: -6 };
    const rejected = new WallRunDetector(harness.world, {
      isWallRunnable: () => false,
    });

    expect(rejected.detect({ x: 0, y: 0.93, z: 0 }, velocity)).toBeNull();

    const accepted = new WallRunDetector(harness.world, {
      isWallRunnable: () => true,
    });

    const candidate = accepted.detect({ x: 0, y: 0.93, z: 0 }, velocity);

    expect(candidate).not.toBeNull();
    expect(candidate?.side).toBe("right");
  });
});

describe("VaultDetector", () => {
  it("detects a vaultable obstacle and validates a landing beyond it", async () => {
    const harness = await createHarness();

    addBox(harness.world, { x: 0, y: 0.375, z: -1.25 }, { x: 1, y: 0.375, z: 0.25 });

    const detector = new VaultDetector(harness.world, DEFAULT_MOVEMENT_TUNING);
    const candidate = detector.detect({ x: 0, y: 0.93, z: 0 }, { x: 0, y: 0, z: -1 }, 0.055);

    expect(candidate).not.toBeNull();
    expect(candidate?.landingPosition.z).toBeLessThan(-1.5);
    expect(candidate?.landingPosition.y).toBeGreaterThan(0.8);
  });

  it("rejects obstacles that are too low or too tall", async () => {
    const low = await createHarness();

    addBox(low.world, { x: 0, y: 0.1, z: -1.25 }, { x: 1, y: 0.1, z: 0.25 });
    expect(
      new VaultDetector(low.world, DEFAULT_MOVEMENT_TUNING).detect(
        { x: 0, y: 0.93, z: 0 },
        { x: 0, y: 0, z: -1 },
        0.055,
      ),
    ).toBeNull();

    const tall = await createHarness();

    addBox(tall.world, { x: 0, y: 0.8, z: -1.25 }, { x: 1, y: 0.8, z: 0.25 });
    expect(
      new VaultDetector(tall.world, DEFAULT_MOVEMENT_TUNING).detect(
        { x: 0, y: 0.93, z: 0 },
        { x: 0, y: 0, z: -1 },
        0.055,
      ),
    ).toBeNull();
  });

  it("returns null when there is no obstacle ahead", async () => {
    const harness = await createHarness();

    expect(
      new VaultDetector(harness.world, DEFAULT_MOVEMENT_TUNING).detect(
        { x: 0, y: 0.93, z: 0 },
        { x: 0, y: 0, z: -1 },
        0.055,
      ),
    ).toBeNull();
  });
});
