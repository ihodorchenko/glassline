import type { Vector2Like, Vector3Like } from "../shared/math";
import { clamp } from "../shared/math";
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

/** Crouching and sliding are posture modifiers, not separate canonical states. */
export type PlayerStance = "standing" | "crouching" | "sliding";

export type WallRunSide = "left" | "right";

/** Vault traversal profile (`12_MOVEMENT_SYSTEM_SPEC.md` §14.4). */
export type VaultType = "standard" | "speed";

export interface WallRunCandidate {
  readonly side: WallRunSide;
  /** Unit normal pointing from the wall toward the player. */
  readonly normal: Vector3Like;
  /** Unit horizontal direction along the wall. */
  readonly tangent: Vector3Like;
  /** Point on the wall surface. */
  readonly point: Vector3Like;
}

export interface VaultCandidate {
  readonly startPosition: Vector3Like;
  readonly landingPosition: Vector3Like;
  readonly direction: Vector3Like;
  /** Absolute Y of the obstacle's top surface, for clearance-aware arcs. */
  readonly obstacleTopY: number;
}

export interface MovementEnvironment {
  readonly grounded: boolean;
  readonly wallRun: WallRunCandidate | null;
  readonly vault: VaultCandidate | null;
}

export interface MovementInputSample {
  /** Local movement intent: x = right, y = forward. Magnitude 0..1. */
  readonly move: Vector2Like;
  readonly jumpPressed: boolean;
  readonly jumpHeld: boolean;
  readonly sprintHeld: boolean;
  readonly crouchHeld: boolean;
  readonly interactPressed: boolean;
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
  readonly canSlide: boolean;
  /** Physical capsule height in the current posture; overridden by PlayerSystem. */
  readonly postureHeight: number;
  readonly wallRunSide: WallRunSide | null;
  readonly landingRemainingSeconds: number;
  /** 1 right after landing, decaying to 0 during the recovery window. */
  readonly landingIntensity: number;
  /** Vertical impact speed of the current landing recovery (0 when not landing). */
  readonly landingImpactSpeed: number;
}

export interface MovementStepEvents {
  readonly jumped: boolean;
  readonly landed: boolean;
  readonly impactSpeed: number;
  readonly slidingStarted: boolean;
  readonly slidingEnded: boolean;
  readonly vaultStarted: boolean;
  readonly vaultType: VaultType | null;
  readonly wallRunStarted: boolean;
  readonly wallRunEnded: boolean;
  readonly wallJumped: boolean;
}

const NO_EVENTS: MovementStepEvents = {
  jumped: false,
  landed: false,
  impactSpeed: 0,
  slidingStarted: false,
  slidingEnded: false,
  vaultStarted: false,
  vaultType: null,
  wallRunStarted: false,
  wallRunEnded: false,
  wallJumped: false,
};

const MOVING_SPEED_THRESHOLD = 0.1;
const WALL_JUMP_STATE_SECONDS = 0.25;

interface MutableVector3 {
  x: number;
  y: number;
  z: number;
}

interface MutableVector2 {
  x: number;
  y: number;
}

interface ActiveVault {
  readonly candidate: VaultCandidate;
  readonly profile: VaultType;
  readonly entrySpeed: number;
  elapsedSeconds: number;
  readonly durationSeconds: number;
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

function horizontalSpeed(velocity: Vector3Like): number {
  return Math.hypot(velocity.x, velocity.z);
}

/**
 * Pure movement simulation: grounded locomotion, jumping, crouch/slide posture,
 * vaulting, wall running, and wall jumping. Collision is applied externally by
 * `PlayerSystem` through Rapier's kinematic character controller.
 */
export class MovementModel {
  private readonly tuning: MovementTuning;

  private velocity: MutableVector3 = { x: 0, y: 0, z: 0 };
  private state: MovementState = "IDLE";
  private stance: PlayerStance = "standing";
  private grounded = false;
  private landingRemainingSeconds = 0;
  /** Vertical impact speed of the current landing recovery (0 when not landing). */
  private landingImpactSpeed = 0;
  private jumpBufferSeconds = 0;
  private coyoteRemainingSeconds = 0;
  private sprintIntent = false;
  private jumpCutApplied = false;
  /** Contextual-interaction buffer for vaults (spec `03_GAMEPLAY_SPEC.md` §5.3). */
  private interactBufferSeconds = 0;
  /** Airborne collision passes since the current jump was executed. */
  private airborneStepsSinceJump = 0;
  /** True only during the fixed step that executed the jump. */
  private jumpExecutedThisStep = false;
  /** True while the player is walking off ledges and should stick to the ground. */
  private groundStickArmed = false;
  /** Slope angle (deg) of the current support surface while grounded. */
  private slopeAngleDegrees = 0;

  private slideElapsedSeconds = 0;
  private vault: ActiveVault | null = null;

  private wallRunSide: WallRunSide | null = null;
  private wallRunTangent: Vector3Like | null = null;
  private wallRunElapsedSeconds = 0;
  private wallJumpRemainingSeconds = 0;
  /** The current airborne phase began with a wall jump; landings still count. */
  private wallJumpLandingPending = false;
  /** Whether the body was off the ground when the current step began. */
  private airborneAtStepStart = false;

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

  getActiveVault(): ActiveVault | null {
    return this.vault;
  }

  /**
   * True when the player just walked off a ledge (with grounded movement input,
   * never right after a jump) and should keep sticking to the surface below.
   */
  wantsGroundSnap(): boolean {
    return this.groundStickArmed;
  }

  /** Called by PlayerSystem when no surface exists within snap range below. */
  disarmGroundSnap(): void {
    this.groundStickArmed = false;
  }

  /** Advances movement intent by one fixed timestep before collision. */
  step(
    input: MovementInputSample,
    moveDirectionWorld: Vector3Like,
    environment: MovementEnvironment,
    deltaSeconds: number,
  ): void {
    const tuning = this.tuning;
    const wasGrounded = this.grounded;

    this.airborneAtStepStart =
      !wasGrounded &&
      (this.state === "JUMPING" ||
        this.state === "FALLING" ||
        this.state === "WALLJUMP" ||
        this.wallJumpLandingPending);

    this.stepEvents = NO_EVENTS;
    this.grounded = environment.grounded;

    // Walking off a ledge (never from a jump or wall kick) starts the coyote
    // window; while it runs and the player keeps pushing forward, the body
    // sticks to surfaces within snap range instead of entering micro free-falls
    // between steps. Leaving the window — by jumping, kicking off a wall, or
    // falling past the stick distance — turns the drop into a normal fall.
    if (this.grounded) {
      this.coyoteRemainingSeconds = 0;
      this.groundStickArmed = false;
    } else if (wasGrounded) {
      this.coyoteRemainingSeconds = tuning.coyoteTimeSeconds;
      this.groundStickArmed =
        input.move.y > 0.1 &&
        this.velocity.y <= 0 &&
        this.state !== "JUMPING" &&
        this.state !== "WALLRUN" &&
        this.state !== "WALLJUMP" &&
        this.wallJumpRemainingSeconds <= 0;
    } else if (this.groundStickArmed) {
      this.coyoteRemainingSeconds = Math.max(0, this.coyoteRemainingSeconds - deltaSeconds);

      if (this.coyoteRemainingSeconds <= 0 || this.velocity.y < -tuning.groundStickSpeed) {
        this.groundStickArmed = false;
      }
    }

    this.landingRemainingSeconds = Math.max(0, this.landingRemainingSeconds - deltaSeconds);
    this.jumpBufferSeconds = Math.max(0, this.jumpBufferSeconds - deltaSeconds);
    this.interactBufferSeconds = Math.max(0, this.interactBufferSeconds - deltaSeconds);

    if (input.jumpPressed) {
      this.jumpBufferSeconds = tuning.jumpBufferSeconds;
    }

    if (input.interactPressed) {
      this.interactBufferSeconds = tuning.vaultInteractBufferSeconds;
    }

    if (this.vault) {
      this.updateVault(deltaSeconds);

      return;
    }

    if (this.state === "WALLRUN") {
      this.updateWallRun(input, environment, deltaSeconds);

      return;
    }

    if (this.state === "WALLJUMP") {
      this.wallJumpRemainingSeconds = Math.max(0, this.wallJumpRemainingSeconds - deltaSeconds);
    }

    if (this.beginVault(input, environment)) {
      return;
    }

    this.beginSlide(input);
    this.updateStance(input);

    const moveMagnitude = Math.min(1, Math.hypot(moveDirectionWorld.x, moveDirectionWorld.z));
    const hasMoveIntent = moveMagnitude > 0.001;
    const targetHorizontal = this.resolveTargetVelocity(moveDirectionWorld, moveMagnitude);

    const sliding = this.state === "SLIDING";

    if (this.grounded || sliding) {
      if (sliding) {
        this.updateSlideMovement(moveDirectionWorld, moveMagnitude, deltaSeconds);
      } else {
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
      }
    } else if (hasMoveIntent) {
      const next = moveTowards(
        this.velocity.x,
        this.velocity.z,
        targetHorizontal.x,
        targetHorizontal.y,
        tuning.airAcceleration * deltaSeconds,
      );
      const speed = Math.hypot(next.x, next.y);

      if (speed > tuning.maxAirSpeed) {
        const scale = tuning.maxAirSpeed / speed;

        next.x *= scale;
        next.y *= scale;
      }

      this.velocity.x = next.x;
      this.velocity.z = next.y;
    }

    this.tryBeginWallRun(environment);
    this.executeJump();
    this.applyVerticalMotion(input, deltaSeconds);
    this.updateSlideExit(input, deltaSeconds);
    this.updateState();
    // A WALLJUMP keeps its landing semantics until a collision pass confirms
    // the touchdown: `updateState()` relabels it FALLING once the outward kick
    // expires, and the grounded environment flag can flip before the actual
    // contact is resolved — neither must swallow the landing event. The flag
    // is consumed in `applyCollisionResult`.
    if (this.state === "WALLJUMP") {
      this.wallJumpLandingPending = true;
    }
    this.jumpExecutedThisStep = false;
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
    // An upward displacement the model did not request (its vertical intent was
    // zero or downward) is a support/collision correction from the character
    // controller, never ballistic motion. Converting it to `y / dt` turns a
    // one-frame step-up or contact correction into a large launch velocity
    // (observed 0.09 m -> 5.2 m/s at the 0.50 m vault obstacle). Keep only
    // commanded upward motion (jumps, wall jumps, rising vault arcs).
    const unrequestedUpwardCorrection = verticalBefore <= 0 && actualMovement.y > 0;

    this.velocity.y =
      groundedAfter || unrequestedUpwardCorrection ? 0 : actualMovement.y / deltaSeconds;

    // Airborne status must be judged against the state at the START of this
    // step: `step()` may already have flipped `grounded` from the environment
    // probe or relabeled WALLJUMP as FALLING before contact is resolved. A
    // pending wall-jump flag keeps the landing semantics across that rename.
    const wasAirborne = this.airborneAtStepStart;

    this.grounded = groundedAfter;

    if (groundedAfter) {
      this.wallJumpLandingPending = false;
    }

    if (wasAirborne && groundedAfter) {
      this.state = "LANDING";
      this.landingRemainingSeconds = this.tuning.landingRecoverySeconds;
      this.landingImpactSpeed = Math.max(0, -verticalBefore);
      this.stepEvents = {
        ...NO_EVENTS,
        landed: true,
        impactSpeed: this.landingImpactSpeed,
      };
    } else if (groundedAfter) {
      this.groundStickArmed = false;
    } else if (wasAirborne || this.groundStickArmed) {
      // Still airborne inside the stick window: the descent must stay within
      // one stick step of the surface, otherwise this is a real fall and the
      // window closes.
      const dropPerStep = this.tuning.groundStickSpeed * deltaSeconds;

      if (-actualMovement.y > dropPerStep + 1e-4) {
        this.groundStickArmed = false;
      }
    }

    this.updateState();
  }

  /** Applies a scripted vault translation produced by `PlayerSystem`. */
  applyVaultMotion(actualMovement: Vector3Like, deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    this.velocity.x = actualMovement.x / deltaSeconds;
    this.velocity.z = actualMovement.z / deltaSeconds;
    this.velocity.y = actualMovement.y / deltaSeconds;
    this.grounded = false;
  }

  /** Returns and clears the events produced by the latest fixed step. */
  consumeEvents(): MovementStepEvents {
    const events = this.stepEvents;

    this.stepEvents = NO_EVENTS;

    return events;
  }

  getSnapshot(): MovementModelSnapshot {
    const speed = horizontalSpeed(this.velocity);
    const landingIntensity =
      this.landingRemainingSeconds > 0
        ? this.landingRemainingSeconds / this.tuning.landingRecoverySeconds
        : 0;

    return {
      state: this.state,
      stance: this.stance,
      grounded: this.grounded,
      moving: speed > MOVING_SPEED_THRESHOLD,
      speed,
      verticalSpeed: this.velocity.y,
      velocity: { ...this.velocity },
      canJump:
        this.grounded ||
        this.coyoteRemainingSeconds > 0 ||
        (this.state === "WALLRUN" && this.wallRunElapsedSeconds > 0) ||
        (this.state === "SLIDING" &&
          this.slideElapsedSeconds >= this.tuning.slideMinDurationSeconds),
      canSlide:
        this.grounded && this.state !== "SLIDING" && speed >= this.tuning.slideMinEntrySpeed,
      postureHeight: this.tuning.capsuleHeight,
      wallRunSide: this.wallRunSide,
      landingRemainingSeconds: this.landingRemainingSeconds,
      landingIntensity,
      landingImpactSpeed: this.landingImpactSpeed,
    };
  }

  private beginVault(input: MovementInputSample, environment: MovementEnvironment): boolean {
    const interactRequested = input.interactPressed || this.interactBufferSeconds > 0;

    if (!interactRequested || !this.grounded || !environment.vault) {
      return false;
    }

    const tuning = this.tuning;
    const entrySpeed = horizontalSpeed(this.velocity);

    // Any vault needs a minimum approach speed; the speed vault additionally
    // requires a higher speed threshold (deterministic selection rule).
    if (entrySpeed < tuning.vaultMinEntrySpeed) {
      return false;
    }

    const profile: VaultType = entrySpeed >= tuning.vaultSpeedMinEntrySpeed ? "speed" : "standard";

    this.interactBufferSeconds = 0;
    this.vault = {
      candidate: environment.vault,
      profile,
      entrySpeed,
      elapsedSeconds: 0,
      durationSeconds:
        profile === "speed" ? tuning.vaultSpeedDurationSeconds : tuning.vaultDurationSeconds,
    };
    this.state = "VAULTING";
    this.slideElapsedSeconds = 0;
    this.stepEvents = { ...NO_EVENTS, vaultStarted: true, vaultType: profile };

    return true;
  }

  private updateVault(deltaSeconds: number): void {
    const vault = this.vault;

    if (!vault) {
      return;
    }

    vault.elapsedSeconds += deltaSeconds;

    if (vault.elapsedSeconds >= vault.durationSeconds) {
      const retention =
        vault.profile === "speed"
          ? this.tuning.vaultSpeedMomentumRetention
          : this.tuning.vaultStandardMomentumRetention;
      const exitSpeed = vault.entrySpeed * retention;

      // Vault completion preserves a configurable fraction of the incoming
      // horizontal momentum along the vault direction (spec §14.5).
      this.velocity.x = vault.candidate.direction.x * exitSpeed;
      this.velocity.z = vault.candidate.direction.z * exitSpeed;
      this.velocity.y = 0;
      this.vault = null;
      this.state = "FALLING";
    }
  }

  /**
   * Slide motion: `slideFriction` decays the speed magnitude while steering
   * bends the velocity toward the current input direction at a limited,
   * configurable rate (`slideSteeringAcceleration`). Without steering input
   * the direction is preserved, so straight slides decay exactly at
   * `slideFriction` per second; the target magnitude never exceeds the
   * decayed speed, so steering cannot increase slide speed.
   */
  private updateSlideMovement(
    moveDirectionWorld: Vector3Like,
    moveMagnitude: number,
    deltaSeconds: number,
  ): void {
    const tuning = this.tuning;
    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const decayedSpeed = Math.max(0, currentSpeed - tuning.slideFriction * deltaSeconds);

    let directionX = 0;
    let directionZ = 0;
    const horizontalLength = Math.hypot(moveDirectionWorld.x, moveDirectionWorld.z);

    if (moveMagnitude > 0.001 && horizontalLength > 1e-6) {
      directionX = moveDirectionWorld.x / horizontalLength;
      directionZ = moveDirectionWorld.z / horizontalLength;
    } else if (currentSpeed > 1e-6) {
      directionX = this.velocity.x / currentSpeed;
      directionZ = this.velocity.z / currentSpeed;
    }

    const next = moveTowards(
      this.velocity.x,
      this.velocity.z,
      directionX * decayedSpeed,
      directionZ * decayedSpeed,
      tuning.slideSteeringAcceleration * deltaSeconds,
    );

    this.velocity.x = next.x;
    this.velocity.z = next.y;
  }

  private beginSlide(input: MovementInputSample): void {
    if (this.state === "SLIDING" || !this.grounded || !input.crouchHeld) {
      return;
    }

    if (horizontalSpeed(this.velocity) < this.tuning.slideMinEntrySpeed) {
      return;
    }

    this.state = "SLIDING";
    this.slideElapsedSeconds = 0;
    this.stance = "sliding";
    this.stepEvents = { ...NO_EVENTS, slidingStarted: true };
  }

  private updateSlideExit(input: MovementInputSample, deltaSeconds: number): void {
    if (this.state !== "SLIDING") {
      return;
    }

    this.slideElapsedSeconds += deltaSeconds;

    const speed = horizontalSpeed(this.velocity);
    const minimumReached = this.slideElapsedSeconds >= this.tuning.slideMinDurationSeconds;
    const shouldExit =
      !this.grounded ||
      speed <= this.tuning.slideExitSpeed ||
      this.slideElapsedSeconds >= this.tuning.slideMaxDurationSeconds ||
      (minimumReached && !input.crouchHeld);

    if (shouldExit) {
      this.endSlide();
    }
  }

  private endSlide(): void {
    if (this.state !== "SLIDING") {
      return;
    }

    this.state = this.grounded ? "RUNNING" : "FALLING";
    this.slideElapsedSeconds = 0;
    this.stance = "standing";
    this.stepEvents = { ...this.stepEvents, slidingEnded: true };
  }

  private updateStance(input: MovementInputSample): void {
    if (this.state === "SLIDING") {
      this.stance = "sliding";

      return;
    }

    this.stance = input.crouchHeld ? "crouching" : "standing";
    this.sprintIntent = input.sprintHeld && this.stance === "standing";
  }

  private tryBeginWallRun(environment: MovementEnvironment): void {
    if (this.state === "WALLRUN" || this.grounded || !environment.wallRun) {
      return;
    }

    if (this.state === "VAULTING") {
      return;
    }

    const speed = horizontalSpeed(this.velocity);

    if (speed < this.tuning.wallRunMinSpeed || this.velocity.y > 3) {
      return;
    }

    this.state = "WALLRUN";
    this.wallRunSide = environment.wallRun.side;
    this.wallRunTangent = environment.wallRun.tangent;
    this.wallRunElapsedSeconds = 0;
    this.stepEvents = { ...this.stepEvents, wallRunStarted: true };
  }

  private updateWallRun(
    input: MovementInputSample,
    environment: MovementEnvironment,
    deltaSeconds: number,
  ): void {
    const tuning = this.tuning;
    const wallRun = environment.wallRun;

    this.wallRunElapsedSeconds += deltaSeconds;

    if (input.jumpPressed) {
      this.performWallJump(wallRun);

      return;
    }

    if (!wallRun || tuning.wallRunMaxDurationSeconds <= this.wallRunElapsedSeconds) {
      this.endWallRun();

      return;
    }

    const tangent = wallRun.tangent;
    const speed = Math.max(
      horizontalSpeed(this.velocity) - tuning.wallRunSpeedDecay * deltaSeconds,
      tuning.wallRunMinSpeed,
    );

    this.wallRunTangent = tangent;
    this.velocity.x = tangent.x * speed;
    this.velocity.z = tangent.z * speed;
    this.velocity.y = Math.max(
      this.velocity.y - tuning.gravity * tuning.wallRunGravityMultiplier * deltaSeconds,
      -tuning.maxFallSpeed,
    );
    this.stance = input.crouchHeld ? "crouching" : "standing";
    this.grounded = false;
    this.state = "WALLRUN";
  }

  private performWallJump(wallRun: WallRunCandidate | null): void {
    const tuning = this.tuning;
    const tangent = wallRun?.tangent ?? this.wallRunTangent ?? { x: 0, y: 0, z: -1 };
    const normal = wallRun?.normal ?? { x: 0, y: 0, z: 0 };
    const speed = Math.max(horizontalSpeed(this.velocity), tuning.wallRunMinSpeed);

    this.velocity.x = tangent.x * speed * 0.9 + normal.x * tuning.wallJumpOutwardSpeed;
    this.velocity.z = tangent.z * speed * 0.9 + normal.z * tuning.wallJumpOutwardSpeed;
    this.velocity.y = tuning.wallJumpUpSpeed;
    this.groundStickArmed = false;
    this.wallRunSide = null;
    this.wallRunTangent = null;
    this.wallRunElapsedSeconds = 0;
    this.wallJumpRemainingSeconds = WALL_JUMP_STATE_SECONDS;
    this.state = "WALLJUMP";
    this.stepEvents = { ...this.stepEvents, wallJumped: true, wallRunEnded: true };
  }

  private endWallRun(): void {
    if (this.state !== "WALLRUN") {
      return;
    }

    this.wallRunSide = null;
    this.wallRunTangent = null;
    this.wallRunElapsedSeconds = 0;
    this.state = "FALLING";
    this.stepEvents = { ...this.stepEvents, wallRunEnded: true };
  }

  private executeJump(): void {
    const tuning = this.tuning;
    const slidingCanJump =
      this.state === "SLIDING" && this.slideElapsedSeconds >= tuning.slideMinDurationSeconds;
    const canExecute =
      this.jumpBufferSeconds > 0 &&
      (this.grounded || this.coyoteRemainingSeconds > 0 || slidingCanJump);

    if (!canExecute) {
      return;
    }

    if (this.state === "SLIDING") {
      this.endSlide();
    }

    const effectiveJumpHeight = tuning.jumpHeight + tuning.jumpTakeoffCompensationMeters;

    this.velocity.y = Math.sqrt(2 * tuning.gravity * effectiveJumpHeight);
    this.jumpCutApplied = false;
    this.airborneStepsSinceJump = 0;
    this.jumpExecutedThisStep = true;
    this.groundStickArmed = false;
    this.grounded = false;
    this.coyoteRemainingSeconds = 0;
    this.jumpBufferSeconds = 0;
    this.state = "JUMPING";
    this.stepEvents = { ...this.stepEvents, jumped: true };
  }

  private applyVerticalMotion(input: MovementInputSample, deltaSeconds: number): void {
    const tuning = this.tuning;

    if (this.state === "SLIDING") {
      // No downward bias: when grounded the shortened capsule is already in
      // contact through the controller offset, and a bias fights the
      // snap-to-ground feature — that interaction stalls the controller and
      // kills slide velocity in a single step (GF-ISSUE-01). When airborne
      // the slide exits to FALLING on this same step (updateSlideExit), so
      // nothing needs biasing here either.
      this.velocity.y = 0;

      return;
    }

    if (!this.grounded) {
      // Airborne steps since the jump was executed. The press edge lives for
      // one fixed step, and depending on sampling order its loss may be read
      // either on the exec step or on the first airborne step — so releases
      // are only trusted from the second airborne step onward.
      if (!this.jumpExecutedThisStep) {
        this.airborneStepsSinceJump += 1;
      }

      // Variable jump height: a trusted release while rising cuts the remaining
      // rise once to `minJumpVelocityRatio` and applies heavier gravity until
      // the apex. Holding jump keeps the full ballistic arc.
      const jumpReleased = !input.jumpHeld && this.airborneStepsSinceJump >= 2;

      const rising = this.velocity.y > 0;
      const gravityScale = jumpReleased && rising ? tuning.jumpReleaseGravityMultiplier : 1;

      this.velocity.y -= tuning.gravity * gravityScale * deltaSeconds;
      this.velocity.y = Math.max(this.velocity.y, -tuning.maxFallSpeed);

      if (jumpReleased && this.velocity.y > 0 && this.state === "JUMPING" && !this.jumpCutApplied) {
        this.velocity.y *= tuning.minJumpVelocityRatio;
        this.jumpCutApplied = true;
      }

      // Ground-stick: just walked off a ledge within snap range — clamp the
      // descent to a constant stick speed so stairs and ledges are ridden down
      // smoothly instead of turning into micro free-falls.
      if (this.wantsGroundSnap()) {
        this.velocity.y = Math.max(this.velocity.y, -tuning.groundStickSpeed);
      }

      return;
    }

    this.velocity.y = 0;
  }

  /** Ground-speed multiplier for the current slope angle (1 on gentle slopes). */
  private slopeSpeedFactor(): number {
    const tuning = this.tuning;
    const min = tuning.slopeEaseMinAngleDegrees;
    const max = 50; // matches the controller's max climb angle

    if (this.slopeAngleDegrees <= min || max <= min) {
      return 1;
    }

    const t = clamp((this.slopeAngleDegrees - min) / (max - min), 0, 1);

    return 1 - (1 - tuning.slopeEaseMaxFactor) * t;
  }

  /** Angle (deg) of the surface we are standing on; 0 when airborne or flat. */
  getSlopeAngleDegrees(): number {
    return this.grounded ? this.slopeAngleDegrees : 0;
  }

  /**
   * Feeds the support-surface normal probed at the end of the previous fixed
   * step (post-collision position), so locomotion eases speed on inclines.
   */
  setSlopeNormal(normal: Vector3Like | null): void {
    if (!normal) {
      this.slopeAngleDegrees = 0;

      return;
    }

    const length = Math.hypot(normal.x, normal.y, normal.z);

    this.slopeAngleDegrees =
      length > 1e-6 ? (Math.acos(clamp(normal.y / length, -1, 1)) * 180) / Math.PI : 0;
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
    // Gentle speed taper up steep inclines instead of the controller's harsh
    // cosine projection, which nearly stops players around 30 degrees.
    const slopeFactor = this.slopeSpeedFactor();
    const targetSpeed = baseSpeed * moveMagnitude * slopeFactor;

    return { x: directionX * targetSpeed, y: directionZ * targetSpeed };
  }

  private updateState(): void {
    const speed = horizontalSpeed(this.velocity);

    if (this.state === "SLIDING" || this.state === "VAULTING" || this.state === "WALLRUN") {
      return;
    }

    if (!this.grounded) {
      this.state =
        this.wallJumpRemainingSeconds > 0
          ? "WALLJUMP"
          : this.velocity.y > 0.05
            ? "JUMPING"
            : "FALLING";

      return;
    }

    if (this.landingRemainingSeconds > 0) {
      this.state = "LANDING";

      return;
    }

    if (speed <= MOVING_SPEED_THRESHOLD) {
      this.state = "IDLE";

      return;
    }

    this.state = this.sprintIntent && speed > this.tuning.runSpeed * 0.85 ? "SPRINTING" : "RUNNING";
  }
}
