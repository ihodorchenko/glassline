import RAPIER from "@dimforge/rapier3d-compat";

import type { Vector3Like } from "../../shared/math";
import type { WallRunCandidate } from "../MovementModel";

const UP = { x: 0, y: 1, z: 0 };
const DEFAULT_MAX_DISTANCE = 0.75;
const DEFAULT_MIN_ALIGNMENT = 0.4;
const DEFAULT_MIN_SPEED = 5;

export interface WallRunDetectorOptions {
  readonly maxDistance?: number;
  readonly minAlignment?: number;
  readonly minSpeed?: number;
}

function normalize(vector: Vector3Like): Vector3Like | null {
  const length = Math.hypot(vector.x, vector.y, vector.z);

  if (length < 1e-6) {
    return null;
  }

  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

/**
 * Detects a viable wall-run surface to the left or right of the player using
 * short horizontal ray casts (see `docs/12_MOVEMENT_SYSTEM_SPEC.md` §6.4).
 */
export class WallRunDetector {
  private readonly world: RAPIER.World;
  private readonly maxDistance: number;
  private readonly minAlignment: number;
  private readonly minSpeed: number;

  constructor(world: RAPIER.World, options: WallRunDetectorOptions = {}) {
    this.world = world;
    this.maxDistance = options.maxDistance ?? DEFAULT_MAX_DISTANCE;
    this.minAlignment = options.minAlignment ?? DEFAULT_MIN_ALIGNMENT;
    this.minSpeed = options.minSpeed ?? DEFAULT_MIN_SPEED;
  }

  detect(position: Vector3Like, velocity: Vector3Like): WallRunCandidate | null {
    const speed = Math.hypot(velocity.x, velocity.z);

    if (speed < this.minSpeed || Math.abs(velocity.y) > 8) {
      return null;
    }

    const direction = normalize({ x: velocity.x, y: 0, z: velocity.z });

    if (!direction) {
      return null;
    }

    // Right vector relative to travel direction (y-up, right-handed).
    const right = { x: -direction.z, y: 0, z: direction.x };

    for (const sign of [1, -1] as const) {
      const origin = { x: position.x, y: position.y + 0.2, z: position.z };
      const dir = { x: right.x * sign, y: 0, z: right.z * sign };
      const hit = this.world.castRayAndGetNormal(
        new RAPIER.Ray(origin, dir),
        this.maxDistance,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC,
      );

      if (!hit || hit.timeOfImpact <= 0.05) {
        continue;
      }

      const normal = hit.normal;

      if (Math.abs(normal.y) > 0.35) {
        continue;
      }

      const tangent = normalize({
        x: UP.y * normal.z - UP.z * normal.y,
        y: UP.z * normal.x - UP.x * normal.z,
        z: UP.x * normal.y - UP.y * normal.x,
      });

      if (!tangent) {
        continue;
      }

      const alignment = (tangent.x * velocity.x + tangent.z * velocity.z) / speed;

      if (Math.abs(alignment) < this.minAlignment) {
        continue;
      }

      const signCorrection = alignment >= 0 ? 1 : -1;

      return {
        side: sign === 1 ? "right" : "left",
        normal: { x: normal.x, y: 0, z: normal.z },
        tangent: {
          x: tangent.x * signCorrection,
          y: 0,
          z: tangent.z * signCorrection,
        },
        point: {
          x: origin.x + dir.x * hit.timeOfImpact,
          y: origin.y,
          z: origin.z + dir.z * hit.timeOfImpact,
        },
      };
    }

    return null;
  }
}
