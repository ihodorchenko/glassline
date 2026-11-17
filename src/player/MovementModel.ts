import type { Vector2Like, Vector3Like } from "../shared/math";
import type { MovementTuning } from "./MovementTuning";

/** Canonical movement state set (`docs/02_TECHNICAL_ARCHITECTURE.md` §10.4). */
export type MovementState =
  | "IDLE"
  | "RUNNING"
  | "SPRINTING"
  | "JUMPING"
  | "FALLING"
  | "LANDING"
  | "SLIDING"
  | "VAULTING"
  | "WALLRUN"
  | "WALLJUMP";

/** Crouching is a posture modifier, not a separate canonical state. */
export type PlayerStance = "standing" | "crouching";

export interface MovementInputSample {
  /** Local movement intent: x = right, y = forward. Magnitude 0..1. */
  readonly move: Vector2Like;
  readonly jumpPressed: boolean;
  readonly jumpHeld: boolean;
  readonly sprintHeld: boolean;
  readonly crouchHeld: boolean;
}

export interface MovementModelSnapshot {
  readonly state: MovementState;
  readonly stance: PlayerStance;
  readonly grounded: boolean;
  readonly moving: boolean;
  readonly speed: number;
  readonly verticalSpeed: number;
  readonly velocity: Vector3Like;
  readonly canJump: boolean;
  readonly landingRemainingSeconds: number;
  /** 1 right after landing, decaying to 0 during the recovery window. */
  readonly landingIntensity: number;
}

export interface MovementStepEvents {
  readonly jumped: boolean;
  readonly landed: boolean;
  readonly impactSpeed: number;
}

interface MutableVector3 {
  x: number;
  y: number;
  z: number;
}

const NO_EVENTS: MovementStepEvents = { jumped: false, landed: false, impactSpeed: 0 };
const MOVING_SPEED_THRESHOLD = 0.1;

interface MutableVector2 {
  x: number;
  y: number;
}

function moveTowards(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  maxDelta: number,
): MutableVector2 {
  const deltaX = targetX - currentX;
  const deltaZ = targetZ - currentZ;
  const distance = Math.hypot(deltaX, deltaZ);

  if (distance <= maxDelta || distance === 0) {
    return { x: targetX, y: targetZ };
  }

  const scale = maxDelta / distance;

  return { x: currentX + deltaX * scale, y: currentZ + deltaZ * scale };
}

/**
 * Pure movement simulation for grounded locomotion, jumping, air control, and
 * crouch posture. Physics/collision is applied externally by `PlayerSystem`
 * through Rapier's kinematic character controller.
 */
export class MovementModel {
  private readonly tuning: MovementTuning;

  private velocity: MutableVector3 = { x: 0, y: 0, z: 0 };
  private state: MovementState = "IDLE";
  private stance: PlayerStance = "standing";
  private grounded = false;
  private landingRemainingSeconds = 0;
  private jumpBufferSeconds = 0;
  private coyoteRemainingSeconds = 0;
  private sprintIntent = false;

  private stepEvents: MovementStepEvents = NO_EVENTS;

  constructor(tuning: MovementTuning) {
    this.tuning = tuning;
  }

  getTuning(): MovementTuning {
    return this.tuning;
  }

  getState(): MovementState {
    return this.state;
  }

  getStance(): PlayerStance {
    return this.stance;
  }

  getGrounded(): boolean {
    return this.grounded;
  }

  getVelocity(): Vector3Like {
    return this.velocity;
  }

  /** Advances movement intent by one fixed timestep before collision. */
  step(
    input: MovementInputSample,
    moveDirectionWorld: Vector3Like,
    grounded: boolean,
    deltaSeconds: number,
  ): void {
    const tuning = this.tuning;
    const wasGrounded = this.grounded;

    this.stepEvents = NO_EVENTS;
    this.grounded = grounded;

    this.landingRemainingSeconds = Math.max(0, this.landingRemainingSeconds - deltaSeconds);
    this.jumpBufferSeconds = Math.max(0, this.jumpBufferSeconds - deltaSeconds);

    if (grounded) {
      this.coyoteRemainingSeconds = 0;
    } else if (wasGrounded) {
      this.coyoteRemainingSeconds = tuning.coyoteTimeSeconds;
    } else {
      this.coyoteRemainingSeconds = Math.max(0, this.coyoteRemainingSeconds - deltaSeconds);
    }

    if (input.jumpPressed) {
      this.jumpBufferSeconds = tuning.jumpBufferSeconds;
    }

    this.stance = input.crouchHeld ? "crouching" : "standing";
    this.sprintIntent = input.sprintHeld && this.stance === "standing";

    const moveMagnitude = Math.min(1, Math.hypot(moveDirectionWorld.x, moveDirectionWorld.z));
    const hasMoveIntent = moveMagnitude > 0.001;
    const targetHorizontal = this.resolveTargetVelocity(moveDirectionWorld, moveMagnitude);

    if (grounded) {
      const acceleration = hasMoveIntent ? tuning.groundAcceleration : tuning.groundDeceleration;
      const next = moveTowards(
        this.velocity.x,
        this.velocity.z,
        targetHorizontal.x,
        targetHorizontal.y,
        acceleration * deltaSeconds,
      );

      this.velocity.x = next.x;
      this.velocity.z = next.y;
    } else if (hasMoveIntent) {
      const next = moveTowards(
        this.velocity.x,
        this.velocity.z,
        targetHorizontal.x,
        targetHorizontal.y,
        tuning.airAcceleration * deltaSeconds,
      );
      const horizontalSpeed = Math.hypot(next.x, next.y);

      if (horizontalSpeed > tuning.maxAirSpeed) {
        const scale = tuning.maxAirSpeed / horizontalSpeed;

        next.x *= scale;
        next.y *= scale;
      }

      this.velocity.x = next.x;
      this.velocity.z = next.y;
    }

    const canExecuteBufferedJump =
      this.jumpBufferSeconds > 0 && (grounded || this.coyoteRemainingSeconds > 0);

    if (canExecuteBufferedJump) {
      this.velocity.y = Math.sqrt(2 * tuning.gravity * tuning.jumpHeight);
      this.grounded = false;
      this.coyoteRemainingSeconds = 0;
      this.jumpBufferSeconds = 0;
      this.stepEvents = { jumped: true, landed: false, impactSpeed: 0 };
    } else if (this.grounded) {
      this.velocity.y = 0;
    } else {
      const gravityScale =
        !input.jumpHeld && this.velocity.y > 0 ? tuning.jumpReleaseGravityMultiplier : 1;

      this.velocity.y -= tuning.gravity * gravityScale * deltaSeconds;
      this.velocity.y = Math.max(this.velocity.y, -tuning.maxFallSpeed);
    }

    this.updateState();
  }

  /** Desired world translation for the current fixed step. */
  getDesiredTranslation(deltaSeconds: number): Vector3Like {
    return {
      x: this.velocity.x * deltaSeconds,
      y: this.velocity.y * deltaSeconds,
      z: this.velocity.z * deltaSeconds,
    };
  }

  /**
   * Reconciles velocity with the movement the character controller actually
   * allowed, removing velocity into obstacles and preserving wall-sliding.
   */
  applyCollisionResult(
    actualMovement: Vector3Like,
    deltaSeconds: number,
    groundedAfter: boolean,
  ): void {
    if (deltaSeconds <= 0) {
      return;
    }

    const verticalBefore = this.velocity.y;

    this.velocity.x = actualMovement.x / deltaSeconds;
    this.velocity.z = actualMovement.z / deltaSeconds;
    this.velocity.y = groundedAfter ? 0 : actualMovement.y / deltaSeconds;

    const wasAirborne = !this.grounded && (this.state === "JUMPING" || this.state === "FALLING");

    this.grounded = groundedAfter;

    if (wasAirborne && groundedAfter) {
      this.state = "LANDING";
      this.landingRemainingSeconds = this.tuning.landingRecoverySeconds;
      this.stepEvents = {
        jumped: false,
        landed: true,
        impactSpeed: Math.max(0, -verticalBefore),
      };
    }

    this.updateState();
  }

  /** Returns and clears the events produced by the latest fixed step. */
  consumeEvents(): MovementStepEvents {
    const events = this.stepEvents;

    this.stepEvents = NO_EVENTS;

    return events;
  }

  getSnapshot(): MovementModelSnapshot {
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const landingIntensity =
      this.landingRemainingSeconds > 0
        ? this.landingRemainingSeconds / this.tuning.landingRecoverySeconds
        : 0;

    return {
      state: this.state,
      stance: this.stance,
      grounded: this.grounded,
      moving: horizontalSpeed > MOVING_SPEED_THRESHOLD,
      speed: horizontalSpeed,
      verticalSpeed: this.velocity.y,
      velocity: { ...this.velocity },
      canJump: this.grounded || this.coyoteRemainingSeconds > 0,
      landingRemainingSeconds: this.landingRemainingSeconds,
      landingIntensity,
    };
  }

  private resolveTargetVelocity(
    moveDirectionWorld: Vector3Like,
    moveMagnitude: number,
  ): Vector2Like {
    if (moveMagnitude <= 0.001) {
      return { x: 0, y: 0 };
    }

    const horizontalLength = Math.hypot(moveDirectionWorld.x, moveDirectionWorld.z);
    const directionX = moveDirectionWorld.x / horizontalLength;
    const directionZ = moveDirectionWorld.z / horizontalLength;

    const baseSpeed =
      this.stance === "crouching"
        ? this.tuning.runSpeed * this.tuning.crouchSpeedMultiplier
        : this.sprintIntent && moveMagnitude > 0.5
          ? this.tuning.sprintSpeed
          : moveMagnitude < 0.4
            ? this.tuning.walkSpeed
            : this.tuning.runSpeed;
    const targetSpeed = baseSpeed * moveMagnitude;

    return { x: directionX * targetSpeed, y: directionZ * targetSpeed };
  }

  private updateState(): void {
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);

    if (!this.grounded) {
      this.state = this.velocity.y > 0.05 ? "JUMPING" : "FALLING";

      return;
    }

    if (this.landingRemainingSeconds > 0) {
      this.state = "LANDING";

      return;
    }

    if (horizontalSpeed <= MOVING_SPEED_THRESHOLD) {
      this.state = "IDLE";

      return;
    }

    this.state =
      this.sprintIntent && horizontalSpeed > this.tuning.runSpeed * 0.85 ? "SPRINTING" : "RUNNING";
  }
}
