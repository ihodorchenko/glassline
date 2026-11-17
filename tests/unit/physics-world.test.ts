import RAPIER from "@dimforge/rapier3d-compat";
import { describe, expect, it } from "vitest";
import type { PhysicsWorldOptions } from "../../src/physics/PhysicsConfig";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";

const OPTIONS: PhysicsWorldOptions = {
  gravity: { x: 0, y: -9.81, z: 0 },
  timestepSeconds: 1 / 60,
};

describe("PhysicsWorld", () => {
  it("initializes Rapier and simulates gravity on a dynamic body", async () => {
    const physics = new PhysicsWorld(OPTIONS);

    await physics.initialize();

    expect(physics.isInitialized).toBe(true);

    const world = physics.rapierWorld;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0));

    world.createCollider(RAPIER.ColliderDesc.ball(0.5), body);

    const startY = body.translation().y;

    for (let step = 0; step < 30; step += 1) {
      physics.step();
    }

    expect(body.translation().y).toBeLessThan(startY);

    physics.dispose();
    expect(physics.isInitialized).toBe(false);
  });

  it("rejects stepping before initialization", () => {
    const physics = new PhysicsWorld(OPTIONS);

    expect(() => physics.step()).toThrow(/not initialized/i);
    expect(() => physics.rapierWorld).toThrow(/not initialized/i);
  });

  it("dispose is idempotent", async () => {
    const physics = new PhysicsWorld(OPTIONS);

    await physics.initialize();
    physics.dispose();

    expect(() => physics.dispose()).not.toThrow();
  });

  it("rejects an invalid timestep", () => {
    expect(() => new PhysicsWorld({ ...OPTIONS, timestepSeconds: 0 })).toThrow(RangeError);
    expect(() => new PhysicsWorld({ ...OPTIONS, timestepSeconds: Number.NaN })).toThrow(RangeError);
  });
});
