import RAPIER from "@dimforge/rapier3d-compat";

import type { Disposable } from "../core/Disposable";
import type { Vector3Like } from "../shared/math";
import type { PhysicsWorldOptions } from "./PhysicsConfig";

/**
 * Owns the Rapier physics world and the fixed simulation step.
 *
 * Rapier owns physical simulation and collision detection; Three.js only
 * represents the result visually (see `docs/02_TECHNICAL_ARCHITECTURE.md` §9).
 */
export class PhysicsWorld implements Disposable {
  private readonly options: PhysicsWorldOptions;
  private world: RAPIER.World | null = null;
  private disposed = false;

  constructor(options: PhysicsWorldOptions) {
    if (!Number.isFinite(options.timestepSeconds) || options.timestepSeconds <= 0) {
      throw new RangeError(`Invalid physics timestep: ${options.timestepSeconds}.`);
    }

    this.options = options;
  }

  get isInitialized(): boolean {
    return this.world !== null;
  }

  /**
   * Engine-level access to the Rapier world.
   * Gameplay systems must use movement/query interfaces, not raw Rapier calls.
   */
  get rapierWorld(): RAPIER.World {
    if (!this.world) {
      throw new Error("PhysicsWorld is not initialized. Await initialize() first.");
    }

    return this.world;
  }

  async initialize(): Promise<void> {
    if (this.world || this.disposed) {
      return;
    }

    await RAPIER.init();

    const gravity = this.options.gravity;
    const world = new RAPIER.World({ x: gravity.x, y: gravity.y, z: gravity.z });

    world.timestep = this.options.timestepSeconds;
    this.world = world;
  }

  /** Casts a ray and returns the first hit. */
  castRay(
    from: Vector3Like,
    to: Vector3Like,
    options: { readonly ignoreKinematic?: boolean } = {},
  ): { readonly colliderHandle: number; readonly distance: number } | null {
    const direction = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const length = Math.hypot(direction.x, direction.y, direction.z);

    if (length < 1e-6) {
      return null;
    }

    const normalized = {
      x: direction.x / length,
      y: direction.y / length,
      z: direction.z / length,
    };
    const hit = this.rapierWorld.castRay(
      new RAPIER.Ray(from, normalized),
      length,
      true,
      options.ignoreKinematic ? RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC : undefined,
    );

    if (!hit) {
      return null;
    }

    return { colliderHandle: hit.collider.handle, distance: hit.timeOfImpact };
  }

  /** Advances the simulation by exactly one fixed timestep. */
  step(): void {
    this.rapierWorld.step();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.world) {
      this.world.free();
      this.world = null;
    }
  }
}
