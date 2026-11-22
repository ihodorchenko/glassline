import { describe, expect, it } from "vitest";

import { CameraSystem } from "../../src/camera/CameraSystem";
import { IDLE_INPUT_FRAME } from "../../src/input/InputState";
import type { MovementModelSnapshot } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import { boundsOfId } from "../helpers/first-section-harness";

/**
 * Step 3.8 F-03 — camera clearance in the First Section slide duct.
 *
 * Authored geometry (`FirstSectionLayout.ts` §5.4): duct floor top 0.90 m,
 * ceiling underside 1.90 m, i.e. a 1.00 m slot. The camera is part of the body,
 * so the eye must never be above the top of the current collider — otherwise a
 * posture capped by the ceiling (a slide that ends inside the duct keeps the
 * 0.90 m collider) would put the camera inside the ceiling slab.
 *
 * These tests use the real authored floor/ceiling heights and the production
 * `CameraSystem`, and pin both the settled heights and the new invariant. The
 * crouch-at-the-lip residual (eye 1.05 m > 1.00 m opening) is documented in the
 * Step 3.8 report: it is outside any solid and readable, and fixing it would
 * require changing `MovementTuning` or the authored duct.
 */

const DUCT_FLOOR = boundsOfId("geo_slide_floor").maxY;
const DUCT_CEILING = boundsOfId("geo_slide_ceiling").minY;
const SLOT_CLEARANCE = DUCT_CEILING - DUCT_FLOOR;
const FIXED_DT = 1 / 60;

/** Body centre when the capsule rests on the duct floor (2 cm controller skin). */
function bodyYFor(postureHeight: number): number {
  return DUCT_FLOOR + 0.02 + postureHeight / 2;
}

function feetYFor(postureHeight: number): number {
  return bodyYFor(postureHeight) - postureHeight / 2;
}

function createCamera(): CameraSystem {
  return new CameraSystem({
    fovDegrees: 75,
    nearPlane: 0.1,
    farPlane: 500,
    tuning: DEFAULT_MOVEMENT_TUNING,
  });
}

function movement(overrides: Partial<MovementModelSnapshot>): MovementModelSnapshot {
  return {
    state: "IDLE",
    stance: "standing",
    grounded: true,
    moving: false,
    speed: 0,
    verticalSpeed: 0,
    velocity: { x: 0, y: 0, z: 0 },
    canJump: true,
    canSlide: false,
    postureHeight: DEFAULT_MOVEMENT_TUNING.capsuleHeight,
    wallRunSide: null,
    landingRemainingSeconds: 0,
    landingIntensity: 0,
    landingImpactSpeed: 0,
    ...overrides,
  };
}

function settle(
  camera: CameraSystem,
  snapshot: MovementModelSnapshot,
  frames = 120,
  positionY = bodyYFor(snapshot.postureHeight),
): number {
  for (let index = 0; index < frames; index += 1) {
    camera.renderUpdate({
      frame: IDLE_INPUT_FRAME,
      movement: snapshot,
      playerPosition: { x: 0, y: positionY, z: -50.5 },
      deltaSeconds: FIXED_DT,
    });
  }

  return camera.camera.position.y;
}

describe("F-03 — authored duct clearance", () => {
  it("keeps the authored 1.00 m slot and the 0.90 m duct floor", () => {
    expect(DUCT_FLOOR).toBeCloseTo(0.9, 6);
    expect(DUCT_CEILING).toBeCloseTo(1.9, 6);
    expect(SLOT_CLEARANCE).toBeCloseTo(1, 6);
  });

  it("documents the crouch eye above the slot that makes crouch-only entry impossible", () => {
    // The authored relationship behind the Step 3.6 observation: the crouch
    // eye (1.05 m) is taller than the 1.00 m slot, while the slide eye (0.65 m)
    // and the slide collider (0.90 m) fit. This is the reason the crouched view
    // at the lip looks over the lintel; it is not a camera-positioning bug.
    expect(DEFAULT_MOVEMENT_TUNING.crouchingEyeHeight).toBeGreaterThan(SLOT_CLEARANCE);
    expect(DEFAULT_MOVEMENT_TUNING.crouchHeight).toBeGreaterThan(SLOT_CLEARANCE);
    expect(DEFAULT_MOVEMENT_TUNING.slidingEyeHeight).toBeLessThan(SLOT_CLEARANCE);
    expect(DEFAULT_MOVEMENT_TUNING.slideHeight).toBeLessThan(SLOT_CLEARANCE);
  });
});

describe("F-03 — duct camera clearance", () => {
  it("settles the slide camera below the ceiling with a readable margin", () => {
    const camera = createCamera();
    const y = settle(camera, movement({ stance: "sliding", state: "SLIDING", postureHeight: 0.9 }));
    const clearance = DUCT_CEILING - y;

    expect(y).toBeCloseTo(feetYFor(0.9) + DEFAULT_MOVEMENT_TUNING.slidingEyeHeight, 4);
    expect(clearance, "slide camera clearance to the duct ceiling").toBeGreaterThan(0.25);
  });

  it("keeps a capped crouch (slide ended inside the duct) below the ceiling", () => {
    const camera = createCamera();
    // The slide ran out inside the duct: the collider cannot grow, so the body
    // keeps the 0.90 m posture while the stance is reported as crouching.
    const snapshot = movement({ stance: "crouching", postureHeight: 0.9 });
    const y = settle(camera, snapshot);
    const feetY = feetYFor(0.9);
    const eyeAboveFeet = y - feetY;

    // Before the Step 3.8 clamp this was 1.05 m above the feet (y = 1.97),
    // i.e. 0.07 m inside the authored ceiling slab.
    expect(eyeAboveFeet).toBeLessThan(0.9 - 0.05);
    expect(DUCT_CEILING - y, "capped-crouch camera clearance").toBeGreaterThan(0.1);
  });

  it("never places the settled camera above the top of its own collider", () => {
    const cases = [
      { stance: "standing" as const, postureHeight: DEFAULT_MOVEMENT_TUNING.capsuleHeight },
      { stance: "crouching" as const, postureHeight: DEFAULT_MOVEMENT_TUNING.crouchHeight },
      { stance: "sliding" as const, postureHeight: DEFAULT_MOVEMENT_TUNING.slideHeight },
      { stance: "crouching" as const, postureHeight: DEFAULT_MOVEMENT_TUNING.slideHeight },
    ];

    for (const testCase of cases) {
      const camera = createCamera();
      const y = settle(camera, movement(testCase));
      const feetY = feetYFor(testCase.postureHeight);

      expect(
        y - feetY,
        `${testCase.stance} eye at ${testCase.postureHeight} m posture`,
      ).toBeLessThanOrEqual(testCase.postureHeight - 0.05);
    }
  });

  it("keeps the normal standing and crouch eye heights unchanged", () => {
    const standing = createCamera();

    expect(settle(standing, movement({ stance: "standing" }))).toBeCloseTo(
      feetYFor(DEFAULT_MOVEMENT_TUNING.capsuleHeight) + DEFAULT_MOVEMENT_TUNING.standingEyeHeight,
      4,
    );

    const crouching = createCamera();

    expect(settle(crouching, movement({ stance: "crouching", postureHeight: 1.15 }))).toBeCloseTo(
      feetYFor(1.15) + DEFAULT_MOVEMENT_TUNING.crouchingEyeHeight,
      4,
    );
  });

  it("returns to the standing eye after respawn", () => {
    const camera = createCamera();

    settle(camera, movement({ stance: "sliding", postureHeight: 0.9 }));
    camera.resetForRespawn(0);
    settle(camera, movement({ stance: "standing" }), 1, 1.795);

    expect(camera.camera.position.y).toBeCloseTo(1.795 + 0.725, 4);
  });
});
