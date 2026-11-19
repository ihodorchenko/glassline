import { describe, expect, it } from "vitest";

import { CameraSystem } from "../../src/camera/CameraSystem";
import { IDLE_INPUT_FRAME, type InputFrame } from "../../src/input/InputState";
import type { MovementModelSnapshot } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import type { Vector2Like } from "../../src/shared/math";

const FIXED_DT = 1 / 60;
const PLAYER_POSITION = { x: 0, y: 0.895, z: 0 };

function frame(
  lookMouse: Vector2Like = { x: 0, y: 0 },
  lookGamepad: Vector2Like = { x: 0, y: 0 },
): InputFrame {
  return { ...IDLE_INPUT_FRAME, lookMouse, lookGamepad };
}

function movement(overrides: Partial<MovementModelSnapshot> = {}): MovementModelSnapshot {
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
    postureHeight:
      overrides.stance === "sliding"
        ? DEFAULT_MOVEMENT_TUNING.slideHeight
        : overrides.stance === "crouching"
          ? DEFAULT_MOVEMENT_TUNING.crouchHeight
          : DEFAULT_MOVEMENT_TUNING.capsuleHeight,
    wallRunSide: null,
    landingRemainingSeconds: 0,
    landingIntensity: 0,
    ...overrides,
  };
}

function createCamera(): CameraSystem {
  return new CameraSystem({
    fovDegrees: 75,
    nearPlane: 0.1,
    farPlane: 500,
    tuning: DEFAULT_MOVEMENT_TUNING,
  });
}

function renderFrames(
  camera: CameraSystem,
  movementSnapshot: MovementModelSnapshot,
  frames: number,
  inputFrame = frame(),
): void {
  for (let index = 0; index < frames; index += 1) {
    camera.renderUpdate({
      frame: inputFrame,
      movement: movementSnapshot,
      playerPosition: PLAYER_POSITION,
      deltaSeconds: FIXED_DT,
    });
  }
}

describe("CameraSystem look", () => {
  it("yaws right on positive mouse X movement", () => {
    const camera = createCamera();

    camera.applyLook(frame({ x: 100, y: 0 }), FIXED_DT);

    expect(camera.viewYaw).toBeLessThan(0);
  });

  it("pitches down on positive mouse Y movement", () => {
    const camera = createCamera();

    camera.applyLook(frame({ x: 0, y: 100 }), FIXED_DT);

    expect(camera.viewPitch).toBeLessThan(0);
  });

  it("inverts vertical look when configured", () => {
    const camera = createCamera();

    camera.setLookConfiguration({
      mouseSensitivity: 1,
      invertMouseY: true,
      gamepadSensitivity: 1,
      invertGamepadY: false,
    });
    camera.applyLook(frame({ x: 0, y: 100 }), FIXED_DT);

    expect(camera.viewPitch).toBeGreaterThan(0);
  });

  it("scales look input by sensitivity", () => {
    const normal = createCamera();
    const sensitive = createCamera();

    sensitive.setLookConfiguration({
      mouseSensitivity: 2,
      invertMouseY: false,
      gamepadSensitivity: 1,
      invertGamepadY: false,
    });

    normal.applyLook(frame({ x: 50, y: 0 }), FIXED_DT);
    sensitive.applyLook(frame({ x: 50, y: 0 }), FIXED_DT);

    expect(Math.abs(sensitive.viewYaw)).toBeCloseTo(Math.abs(normal.viewYaw) * 2, 6);
  });

  it("clamps pitch to the configured limit", () => {
    const camera = createCamera();

    for (let index = 0; index < 100; index += 1) {
      camera.applyLook(frame({ x: 0, y: 1000 }), FIXED_DT);
    }

    expect(camera.viewPitch).toBeCloseTo((-85 * Math.PI) / 180, 4);
  });

  it("applies gamepad look as a rate over time", () => {
    const camera = createCamera();

    camera.applyLook(frame({ x: 0, y: 0 }, { x: 1, y: 0 }), FIXED_DT);

    expect(camera.viewYaw).toBeLessThan(0);
  });
});

describe("CameraSystem posture and response", () => {
  it("moves the camera to the crouching eye height", () => {
    const camera = createCamera();

    renderFrames(camera, movement({ stance: "crouching" }), 180);

    const expectedOffset =
      DEFAULT_MOVEMENT_TUNING.crouchingEyeHeight - DEFAULT_MOVEMENT_TUNING.crouchHeight / 2;

    expect(camera.camera.position.y).toBeCloseTo(PLAYER_POSITION.y + expectedOffset, 2);
  });

  it("moves the camera back to the standing eye height", () => {
    const camera = createCamera();

    renderFrames(camera, movement({ stance: "crouching" }), 120);
    renderFrames(camera, movement({ stance: "standing" }), 180);

    const expectedOffset =
      DEFAULT_MOVEMENT_TUNING.standingEyeHeight - DEFAULT_MOVEMENT_TUNING.capsuleHeight / 2;

    expect(camera.camera.position.y).toBeCloseTo(PLAYER_POSITION.y + expectedOffset, 2);
  });

  it("raises FOV while sprinting", () => {
    const camera = createCamera();

    renderFrames(camera, movement({ state: "SPRINTING", moving: true, speed: 8.5 }), 180);

    expect(camera.getCurrentFov()).toBeGreaterThan(80);
  });

  it("keeps the base FOV when reduced motion is enabled", () => {
    const camera = createCamera();

    camera.setViewConfiguration({
      baseFov: 75,
      sprintFov: 82,
      bobIntensity: 1,
      motionIntensity: 1,
      reducedMotion: true,
    });

    renderFrames(camera, movement({ state: "SPRINTING", moving: true, speed: 8.5 }), 180);

    expect(camera.getCurrentFov()).toBeCloseTo(75, 4);
  });

  it("applies a landing dip proportional to landing intensity", () => {
    const standing = createCamera();
    const landing = createCamera();

    renderFrames(standing, movement(), 60);
    renderFrames(landing, movement({ landingIntensity: 1 }), 60);

    expect(landing.camera.position.y).toBeLessThan(standing.camera.position.y);
  });

  it("scales landing camera impact by motion intensity", () => {
    const normal = createCamera();
    const muted = createCamera();

    for (const camera of [normal, muted]) {
      camera.setViewConfiguration({
        baseFov: 75,
        sprintFov: 82,
        bobIntensity: 1,
        motionIntensity: camera === normal ? 1 : 0,
        reducedMotion: false,
      });
    }

    const landing = movement({ landingIntensity: 1, moving: true, speed: 2 });

    renderFrames(normal, landing, 8);
    renderFrames(muted, landing, 8);

    expect(Math.abs(normal.camera.rotation.z)).toBeGreaterThan(0.001);
    expect(Math.abs(muted.camera.rotation.z)).toBeLessThan(0.0001);
  });

  it("disables bob under reduced motion", () => {
    const camera = createCamera();

    camera.setViewConfiguration({
      baseFov: 75,
      sprintFov: 82,
      bobIntensity: 1,
      motionIntensity: 1,
      reducedMotion: true,
    });

    const heights: number[] = [];

    for (let index = 0; index < 120; index += 1) {
      camera.renderUpdate({
        frame: frame(),
        movement: movement({ state: "RUNNING", moving: true, speed: 6 }),
        playerPosition: PLAYER_POSITION,
        deltaSeconds: FIXED_DT,
      });
      heights.push(camera.camera.position.y);
    }

    const spread = Math.max(...heights) - Math.min(...heights);

    expect(spread).toBeLessThan(0.002);
  });

  it("updates aspect ratio on resize", () => {
    const camera = createCamera();

    camera.resize(1600, 900);

    expect(camera.camera.aspect).toBeCloseTo(1600 / 900, 6);
  });
});

describe("CameraSystem traversal responses", () => {
  it("lowers the camera to the sliding eye height", () => {
    const camera = createCamera();

    renderFrames(camera, movement({ stance: "sliding" }), 180);

    const expectedOffset =
      DEFAULT_MOVEMENT_TUNING.slidingEyeHeight - DEFAULT_MOVEMENT_TUNING.slideHeight / 2;

    expect(camera.camera.position.y).toBeCloseTo(PLAYER_POSITION.y + expectedOffset, 2);
  });

  it("rolls toward the wall during a wall run", () => {
    const rightWall = createCamera();
    const leftWall = createCamera();

    renderFrames(
      rightWall,
      movement({ state: "WALLRUN", wallRunSide: "right", moving: true, speed: 6 }),
      120,
    );
    renderFrames(
      leftWall,
      movement({ state: "WALLRUN", wallRunSide: "left", moving: true, speed: 6 }),
      120,
    );

    expect(rightWall.getCurrentRoll()).toBeLessThan(-0.03);
    expect(leftWall.getCurrentRoll()).toBeGreaterThan(0.03);
  });

  it("disables wall-run roll under reduced motion", () => {
    const camera = createCamera();

    camera.setViewConfiguration({
      baseFov: 75,
      sprintFov: 82,
      bobIntensity: 1,
      motionIntensity: 1,
      reducedMotion: true,
    });

    renderFrames(
      camera,
      movement({ state: "WALLRUN", wallRunSide: "right", moving: true, speed: 6 }),
      120,
    );

    expect(Math.abs(camera.getCurrentRoll())).toBeLessThan(0.001);
  });

  it("resets transient camera effects after respawn", () => {
    const camera = createCamera();

    camera.applyLook(frame({ x: 100, y: 100 }), FIXED_DT);
    renderFrames(camera, movement({ state: "SPRINTING", moving: true, speed: 8.5 }), 120);

    camera.resetForRespawn(1.2);

    expect(camera.viewYaw).toBeCloseTo(1.2, 6);
    expect(camera.viewPitch).toBeCloseTo(0, 6);
    expect(camera.getCurrentFov()).toBeCloseTo(75, 6);
    expect(camera.getCurrentRoll()).toBeCloseTo(0, 6);
  });
});
