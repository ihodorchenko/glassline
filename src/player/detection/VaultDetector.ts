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
 * Rapier character-controller skin: the physical capsule bottom rests this far
 * above the support surface (`PlayerSystem` creates the controller with the
 * same offset). `feetY` is the physical capsule bottom, so the authored
 * support height is `feetY - footOffset`.
 */
const DEFAULT_FOOT_OFFSET = 0.02;
/**
 * Horizontal probe heights above the support surface. A single chest-height
 * ray misses obstacles whose top is at or below the chest, including the
 * lowest part of the tuning range (`vaultMinHeight` 0.35). The set spans the
 * whole face of any obstacle from 0.35 to `vaultMaxHeight` while staying below
 * the top of the tallest vaultable obstacle, so every qualifying height is
 * represented.
 */
const FORWARD_PROBE_HEIGHTS = [0.12, 0.3, 0.45, 0.65, 0.85, 1.0] as const;
/** Inclusive tuning boundaries: authored min/max heights must not fail on float noise. */
const HEIGHT_EPSILON = 1e-6;

/**
 * Detects a vaultable obstacle ahead of the player and validates the landing
 * space and head clearance for the scripted vault trajectory
 * (`docs/12_MOVEMENT_SYSTEM_SPEC.md` §14).
 *
 * `feetY` is the physical capsule bottom, including the character controller
 * skin. Probes and height validation are expressed relative to the authored
 * support surface (`feetY - footOffset`), never to authored level coordinates.
 */
export class VaultDetector {
  private readonly world: RAPIER.World;
  private readonly tuning: MovementTuning;
  private readonly footOffset: number;

  constructor(world: RAPIER.World, tuning: MovementTuning, footOffset = DEFAULT_FOOT_OFFSET) {
    this.world = world;
    this.tuning = tuning;
    this.footOffset = Math.max(0, footOffset);
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
    const supportY = feetY - this.footOffset;

    // Cast several horizontal probes across the obstacle face. A single ray at
    // chest height misses a 0.5 m obstacle (its top sits below the chest once
    // the physical capsule bottom includes the controller skin). Collect every
    // valid face hit, then validate candidates from the nearest to the farthest
    // so a low non-vaultable lip cannot hide a vaultable obstacle behind it.
    const forwardHits: RAPIER.RayColliderIntersection[] = [];

    for (const probeHeight of FORWARD_PROBE_HEIGHTS) {
      const hit = this.castRay(
        { x: position.x, y: supportY + probeHeight, z: position.z },
        direction,
        FORWARD_REACH,
      );

      if (!hit || hit.timeOfImpact < 0.08 || Math.abs(hit.normal.y) > 0.4) {
        continue;
      }

      forwardHits.push(hit);
    }

    forwardHits.sort((left, right) => left.timeOfImpact - right.timeOfImpact);

    for (const forwardHit of forwardHits) {
      const candidate = this.evaluateHit(position, direction, supportY, standingHalf, forwardHit);

      if (candidate) {
        return candidate;
      }
    }

    return null;
  }

  private evaluateHit(
    position: Vector3Like,
    direction: Vector3Like,
    supportY: number,
    standingHalf: number,
    forwardHit: RAPIER.RayColliderIntersection,
  ): VaultCandidate | null {
    const frontX = position.x + direction.x * forwardHit.timeOfImpact;
    const frontZ = position.z + direction.z * forwardHit.timeOfImpact;

    // Move slightly into the obstacle so the downward probe lands on its top
    // surface instead of missing the front edge.
    const topX = frontX + direction.x * 0.1;
    const topZ = frontZ + direction.z * 0.1;
    const topHit = this.castRay({ x: topX, y: supportY + 2.2, z: topZ }, DOWN, 3);

    if (!topHit) {
      return null;
    }

    const topY = supportY + 2.2 - topHit.timeOfImpact;
    const obstacleHeight = topY - supportY;

    if (
      obstacleHeight < this.tuning.vaultMinHeight - HEIGHT_EPSILON ||
      obstacleHeight > this.tuning.vaultMaxHeight + HEIGHT_EPSILON
    ) {
      return null;
    }

    const landingX = topX + direction.x * LANDING_REACH;
    const landingZ = topZ + direction.z * LANDING_REACH;
    const landingHit = this.castRay({ x: landingX, y: supportY + 2.2, z: landingZ }, DOWN, 3);

    if (!landingHit) {
      return null;
    }

    const landingSurfaceY = supportY + 2.2 - landingHit.timeOfImpact;

    if (landingSurfaceY < supportY - 0.6) {
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
        y: landingSurfaceY + standingHalf + this.footOffset,
        z: landingZ,
      },
      direction,
      obstacleTopY: topY,
    };
  }

  /**
   * Interpolates the scripted vault trajectory. The arc lift is
   * clearance-aware: it grows so the capsule bottom stays above the obstacle
   * top over the traversal, which lets the vault move through the character
   * controller without passing through the obstacle.
   */
  static samplePosition(
    candidate: VaultCandidate,
    tuning: MovementTuning,
    progress: number,
  ): Vector3Like {
    const t = clamp(progress, 0, 1);
    const start = candidate.startPosition;
    const landing = candidate.landingPosition;

    // At the quarter point the sine is sqrt(1/2); require the capsule bottom
    // (center minus half height) to clear the obstacle top with a margin.
    const requiredLift =
      (candidate.obstacleTopY +
        0.05 +
        tuning.capsuleHeight / 2 -
        (0.75 * start.y + 0.25 * landing.y)) /
      Math.SQRT1_2;
    const lift = Math.max(0, tuning.vaultArcLift, requiredLift);

    return {
      x: start.x + (landing.x - start.x) * t,
      y: start.y + (landing.y - start.y) * t + Math.sin(Math.PI * t) * lift,
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
