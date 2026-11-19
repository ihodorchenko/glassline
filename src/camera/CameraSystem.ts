import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import type { InputFrame } from "../input/InputState";
import type { MovementModelSnapshot, PlayerStance } from "../player/MovementModel";
import type { MovementTuning } from "../player/MovementTuning";
import type { Vector3Like } from "../shared/math";
import { clamp } from "../shared/math";

const MOUSE_RADIANS_PER_PIXEL = 0.0022;
const GAMEPAD_RADIANS_PER_SECOND = 2.4;
const PITCH_LIMIT_RADIANS = (85 * Math.PI) / 180;
const EYE_HEIGHT_DAMPING = 12;
const FOV_DAMPING = 8;
const ROLL_DAMPING = 10;
const WALL_RUN_ROLL_RADIANS = 0.06;
const LANDING_DIP_METERS = 0.06;
const BOB_AMPLITUDE_METERS = 0.018;

export interface CameraLookConfiguration {
  readonly mouseSensitivity: number;
  readonly invertMouseY: boolean;
  readonly gamepadSensitivity: number;
  readonly invertGamepadY: boolean;
}

export interface CameraViewConfiguration {
  readonly baseFov: number;
  readonly sprintFov: number;
  readonly bobIntensity: number;
  readonly motionIntensity: number;
  readonly reducedMotion: boolean;
}

export interface CameraSystemOptions {
  readonly fovDegrees: number;
  readonly nearPlane: number;
  readonly farPlane: number;
  readonly tuning: MovementTuning;
}

export interface CameraRenderInput {
  readonly frame: InputFrame;
  readonly movement: MovementModelSnapshot;
  /** Interpolated player body center in world space. */
  readonly playerPosition: Vector3Like;
  readonly deltaSeconds: number;
}

function damp(current: number, target: number, lambda: number, deltaSeconds: number): number {
  return target + (current - target) * Math.exp(-lambda * deltaSeconds);
}

/**
 * Owns the first-person camera and its presentation response.
 *
 * The camera consumes input and Movement System state; it never controls the
 * player's physical body (`docs/13_CAMERA_SYSTEM_SPEC.md` §4.3).
 */
export class CameraSystem implements Disposable {
  readonly camera: THREE.PerspectiveCamera;

  private readonly tuning: MovementTuning;
  private look: CameraLookConfiguration = {
    mouseSensitivity: 1,
    invertMouseY: false,
    gamepadSensitivity: 1,
    invertGamepadY: false,
  };
  private view: CameraViewConfiguration;

  private yaw = 0;
  private pitch = 0;
  private currentEyeHeightOffset: number;
  private currentFov: number;
  private currentRoll = 0;
  private bobPhase = 0;
  private disposed = false;

  constructor(options: CameraSystemOptions) {
    this.tuning = options.tuning;
    this.camera = new THREE.PerspectiveCamera(
      options.fovDegrees,
      1,
      options.nearPlane,
      options.farPlane,
    );
    this.camera.rotation.order = "YXZ";

    this.view = {
      baseFov: options.fovDegrees,
      sprintFov: options.fovDegrees + 7,
      bobIntensity: 1,
      motionIntensity: 1,
      reducedMotion: false,
    };

    this.currentFov = options.fovDegrees;
    this.modelPostureHeight = this.tuning.capsuleHeight;
    this.currentEyeHeightOffset = this.tuning.standingEyeHeight - this.modelPostureHeight / 2;
  }

  get viewYaw(): number {
    return this.yaw;
  }

  get viewPitch(): number {
    return this.pitch;
  }

  /** Places the camera for the non-gameplay menu vignette. */
  setPresentationPose(
    position: { readonly x: number; readonly y: number; readonly z: number },
    yaw = 0,
    pitch = 0,
  ): void {
    this.camera.position.set(position.x, position.y, position.z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.camera.rotation.set(pitch, yaw, 0);
  }

  setLookConfiguration(configuration: CameraLookConfiguration): void {
    this.look = configuration;
  }

  setViewConfiguration(configuration: CameraViewConfiguration): void {
    this.view = configuration;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Applies user look input for the current rendered frame.
   * Mouse input is a relative delta; gamepad input is a rate per second.
   */
  applyLook(frame: InputFrame, deltaSeconds: number): void {
    const mouse = frame.lookMouse;
    const gamepad = frame.lookGamepad;
    const mouseInvert = this.look.invertMouseY ? -1 : 1;
    const gamepadInvert = this.look.invertGamepadY ? -1 : 1;

    this.yaw -=
      mouse.x * this.look.mouseSensitivity * MOUSE_RADIANS_PER_PIXEL +
      gamepad.x *
        this.look.gamepadSensitivity *
        GAMEPAD_RADIANS_PER_SECOND *
        Math.max(0, deltaSeconds);
    this.pitch -=
      mouse.y * this.look.mouseSensitivity * MOUSE_RADIANS_PER_PIXEL * mouseInvert +
      gamepad.y *
        this.look.gamepadSensitivity *
        GAMEPAD_RADIANS_PER_SECOND *
        gamepadInvert *
        Math.max(0, deltaSeconds);

    this.pitch = clamp(this.pitch, -PITCH_LIMIT_RADIANS, PITCH_LIMIT_RADIANS);
  }

  /** Updates camera transform, eye height, bob, landing dip, and FOV. */
  renderUpdate(input: CameraRenderInput): void {
    if (this.disposed) {
      return;
    }

    const deltaSeconds = Math.max(0, input.deltaSeconds);

    this.applyLook(input.frame, deltaSeconds);
    this.updateEyeHeight(input.movement.stance, deltaSeconds, input.movement.postureHeight);
    this.updateFov(input.movement, deltaSeconds);
    this.updateRoll(input.movement, deltaSeconds);

    const bobOffset = this.computeBobOffset(input.movement, deltaSeconds);
    const landingDip = this.view.reducedMotion
      ? 0
      : input.movement.landingIntensity * LANDING_DIP_METERS;

    this.camera.position.set(
      input.playerPosition.x,
      input.playerPosition.y + this.currentEyeHeightOffset + bobOffset - landingDip,
      input.playerPosition.z,
    );
    this.camera.rotation.set(this.pitch, this.yaw, this.currentRoll);

    if (this.camera.fov !== this.currentFov) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Used by tests and diagnostics to inspect applied configuration. */
  getCurrentFov(): number {
    return this.currentFov;
  }

  getCurrentRoll(): number {
    return this.currentRoll;
  }

  /** World-space direction the camera is looking along. */
  getLookDirection(): Vector3Like {
    const cosPitch = Math.cos(this.pitch);

    return {
      x: -Math.sin(this.yaw) * cosPitch,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cosPitch,
    };
  }

  /** Resets transient effects after respawn. */
  resetForRespawn(rotationY = 0): void {
    this.yaw = rotationY;
    this.pitch = 0;
    this.currentRoll = 0;
    this.bobPhase = 0;
    this.currentFov = this.view.baseFov;
    this.currentEyeHeightOffset = this.tuning.standingEyeHeight - this.tuning.capsuleHeight / 2;
  }

  dispose(): void {
    this.disposed = true;
  }

  private modelPostureHeight: number;

  private updateEyeHeight(stance: PlayerStance, deltaSeconds: number, postureHeight: number): void {
    this.modelPostureHeight = postureHeight;
    const eyeHeight =
      stance === "sliding"
        ? this.tuning.slidingEyeHeight
        : stance === "crouching"
          ? this.tuning.crouchingEyeHeight
          : this.tuning.standingEyeHeight;
    const targetOffset = eyeHeight - this.modelPostureHeight / 2;

    this.currentEyeHeightOffset = damp(
      this.currentEyeHeightOffset,
      targetOffset,
      EYE_HEIGHT_DAMPING,
      deltaSeconds,
    );
  }

  private updateFov(movement: MovementModelSnapshot, deltaSeconds: number): void {
    const motionScale = this.view.reducedMotion ? 0 : this.view.motionIntensity;
    const sprintBlend =
      movement.state === "SPRINTING"
        ? clamp(movement.speed / this.tuning.sprintSpeed, 0, 1) * motionScale
        : 0;
    const targetFov = this.view.baseFov + (this.view.sprintFov - this.view.baseFov) * sprintBlend;

    this.currentFov = damp(this.currentFov, targetFov, FOV_DAMPING, deltaSeconds);
  }

  private updateRoll(movement: MovementModelSnapshot, deltaSeconds: number): void {
    const targetRoll =
      !this.view.reducedMotion && movement.state === "WALLRUN" && movement.wallRunSide !== null
        ? movement.wallRunSide === "left"
          ? WALL_RUN_ROLL_RADIANS
          : -WALL_RUN_ROLL_RADIANS
        : 0;

    this.currentRoll = damp(this.currentRoll, targetRoll, ROLL_DAMPING, deltaSeconds);
  }

  private computeBobOffset(movement: MovementModelSnapshot, deltaSeconds: number): number {
    if (this.view.reducedMotion || !movement.grounded || movement.speed < 0.1) {
      return 0;
    }

    this.bobPhase += deltaSeconds * (6 + movement.speed * 0.5);

    const speedScale = clamp(movement.speed / this.tuning.sprintSpeed, 0, 1);
    const amplitude =
      BOB_AMPLITUDE_METERS * this.view.bobIntensity * this.view.motionIntensity * speedScale;

    return Math.sin(this.bobPhase) * amplitude;
  }
}
