import RAPIER from "@dimforge/rapier3d-compat";

import type { Vector3Like } from "../../shared/math";
import { clamp } from "../../shared/math";
import type { VaultCandidate } from "../MovementModel";
import type { MovementTuning } from "../MovementTuning";

const DOWN = { x: 0, y: -1, z: 0 };
const UP = { x: 0, y: 1, z: 0 };
const FORWARD_REACH = 1.1;
const LANDING_REACH = 0.9;

/**
 * Detects a vaultable obstacle ahead of the player and validates the landing
 * space and head clearance for the scripted vault trajectory
 * (`docs/12_MOVEMENT_SYSTEM_SPEC.md` §14).
 */
export class VaultDetector {
  private readonly world: RAPIER.World;
  private readonly tuning: MovementTuning;

  constructor(world: RAPIER.World, tuning: MovementTuning) {
    this.world = world;
    this.tuning = tuning;
  }

  detect(position: Vector3Like, forward: Vector3Like, feetY: number): VaultCandidate | null {
    const directionLength = Math.hypot(forward.x, forward.z);

    if (directionLength < 1e-6) {
      return null;
    }

    const direction = {
      x: forward.x / directionLength,
      y: 0,
      z: forward.z / directionLength,
    };
    const standingHalf = this.tuning.capsuleHeight / 2;
    const chestY = feetY + 0.5;

    // Ignore kinematic bodies (the player) so the probe can start at the body center.
    const forwardOrigin = { x: position.x, y: chestY, z: position.z };
    const forwardHit = this.castRay(forwardOrigin, direction, FORWARD_REACH);

    if (!forwardHit || forwardHit.timeOfImpact < 0.08) {
      return null;
    }

    if (Math.abs(forwardHit.normal.y) > 0.4) {
      return null;
    }

    const frontX = forwardOrigin.x + direction.x * forwardHit.timeOfImpact;
    const frontZ = forwardOrigin.z + direction.z * forwardHit.timeOfImpact;

    // Move slightly into the obstacle so the downward probe lands on its top
    // surface instead of missing the front edge.
    const topX = frontX + direction.x * 0.1;
    const topZ = frontZ + direction.z * 0.1;
    const topHit = this.castRay({ x: topX, y: feetY + 2.2, z: topZ }, DOWN, 3);

    if (!topHit) {
      return null;
    }

    const topY = feetY + 2.2 - topHit.timeOfImpact;
    const obstacleHeight = topY - feetY;

    if (
      obstacleHeight < this.tuning.vaultMinHeight ||
      obstacleHeight > this.tuning.vaultMaxHeight
    ) {
      return null;
    }

    const landingX = topX + direction.x * LANDING_REACH;
    const landingZ = topZ + direction.z * LANDING_REACH;
    const landingHit = this.castRay({ x: landingX, y: feetY + 2.2, z: landingZ }, DOWN, 3);

    if (!landingHit) {
      return null;
    }

    const landingSurfaceY = feetY + 2.2 - landingHit.timeOfImpact;

    if (landingSurfaceY < feetY - 0.6) {
      return null;
    }

    const clearanceSamples = [
      { x: frontX, z: frontZ },
      { x: frontX + direction.x * 0.4, z: frontZ + direction.z * 0.4 },
      { x: frontX + direction.x * 0.8, z: frontZ + direction.z * 0.8 },
    ];

    for (const sample of clearanceSamples) {
      const headroom = this.castRay({ x: sample.x, y: topY + 0.05, z: sample.z }, UP, 1.2);

      if (headroom) {
        return null;
      }
    }

    return {
      startPosition: { ...position },
      landingPosition: {
        x: landingX,
        y: landingSurfaceY + standingHalf + 0.02,
        z: landingZ,
      },
      direction,
    };
  }

  /** Interpolates the scripted vault trajectory. */
  static samplePosition(
    candidate: VaultCandidate,
    tuning: MovementTuning,
    progress: number,
  ): Vector3Like {
    const t = clamp(progress, 0, 1);
    const start = candidate.startPosition;
    const landing = candidate.landingPosition;

    return {
      x: start.x + (landing.x - start.x) * t,
      y: start.y + (landing.y - start.y) * t + Math.sin(Math.PI * t) * tuning.vaultArcLift,
      z: start.z + (landing.z - start.z) * t,
    };
  }

  private castRay(
    origin: Vector3Like,
    direction: Vector3Like,
    maxToi: number,
  ): RAPIER.RayColliderIntersection | null {
    return this.world.castRayAndGetNormal(
      new RAPIER.Ray(origin, direction),
      maxToi,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC,
    );
  }
}
