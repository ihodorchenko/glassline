import RAPIER from "@dimforge/rapier3d-compat";

import type { Disposable } from "../core/Disposable";
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
