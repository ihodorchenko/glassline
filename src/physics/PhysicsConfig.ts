import type { Vector3Like } from "../shared/math";

/** Physics world configuration. See `docs/02_TECHNICAL_ARCHITECTURE.md` §9. */
export interface PhysicsWorldOptions {
  readonly gravity: Vector3Like;

  /** Must match the game loop fixed timestep (`1 / physicsHz`). */
  readonly timestepSeconds: number;
}

export const DEFAULT_PHYSICS_OPTIONS: PhysicsWorldOptions = {
  gravity: { x: 0, y: -9.81, z: 0 },
  timestepSeconds: 1 / 60,
};

/**
 * Collision membership bit flags. The concrete Rapier interaction groups are
 * derived through {@link interactionGroups}.
 */
export const PHYSICS_LAYERS = {
  PLAYER: 1 << 0,
  WORLD: 1 << 1,
  PARKOUR: 1 << 2,
  TRIGGER: 1 << 3,
  DECORATION: 1 << 4,
  INTERACTION: 1 << 5,
} as const;

export type PhysicsLayer = (typeof PHYSICS_LAYERS)[keyof typeof PHYSICS_LAYERS];

/** Packs membership and filter bit masks into a Rapier interaction-groups value. */
export function interactionGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}
