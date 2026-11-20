/**
 * Movement tuning values.
 * See `docs/12_MOVEMENT_SYSTEM_SPEC.md` §5.3 and §6.
 */
export interface MovementTuning {
  readonly capsuleHeight: number;
  readonly capsuleRadius: number;
  readonly standingEyeHeight: number;
  readonly crouchingEyeHeight: number;
  readonly slidingEyeHeight: number;
  readonly crouchHeight: number;
  readonly slideHeight: number;
  readonly groundDetectionDistance: number;
  /** Height the character controller steps over automatically (up and down). */
  readonly maxStepHeight: number;
  /** Autostep horizontal tolerance used by the character controller. */
  readonly stepMinWidth: number;
  /**
   * Snap-to-ground distance for descents steeper than `maxStepHeight`: while
   * within this range below a surface, the body is pulled to it at up to
   * `groundStickSpeed` instead of entering free fall.
   */
  readonly snapToGroundDistance: number;
  readonly groundStickSpeed: number;
  /** Horizontal speed (m/s) at which the body glides up a step riser. */
  readonly stepGlideSpeed: number;
  /** How far ahead of the capsule edge to look for a climbable step top. */
  readonly stepGlideProbeAhead: number;

  readonly walkSpeed: number;
  readonly runSpeed: number;
  readonly sprintSpeed: number;
  readonly crouchSpeedMultiplier: number;

  /** Slope angle (deg) up to which full speed is kept when climbing. */
  readonly slopeEaseMinAngleDegrees: number;
  /** Fraction of target speed retained at `maxSlopeClimbAngle`. */
  readonly slopeEaseMaxFactor: number;
  /** Multiplier applied to the controller's slide down too-steep slopes. */
  readonly slopeSlideSpeedMultiplier: number;

  readonly groundAcceleration: number;
  readonly groundDeceleration: number;
  readonly airAcceleration: number;
  readonly maxAirSpeed: number;

  readonly gravity: number;
  readonly jumpHeight: number;
  /** Extra rise added to the impulse so the physical apex still reaches
   * jumpHeight despite controller offset and snap-to-ground at take-off. */
  readonly jumpTakeoffCompensationMeters: number;
  /** Fraction of the full jump velocity kept when jump is released early (variable jump). */
  readonly minJumpVelocityRatio: number;
  readonly maxFallSpeed: number;
  readonly jumpBufferSeconds: number;
  readonly coyoteTimeSeconds: number;
  readonly jumpReleaseGravityMultiplier: number;

  readonly landingRecoverySeconds: number;

  readonly slideMinEntrySpeed: number;
  readonly slideFriction: number;
  readonly slideMinDurationSeconds: number;
  readonly slideMaxDurationSeconds: number;
  readonly slideExitSpeed: number;

  readonly vaultMinHeight: number;
  readonly vaultMaxHeight: number;
  readonly vaultDurationSeconds: number;
  readonly vaultArcLift: number;

  readonly wallRunMinSpeed: number;
  readonly wallRunMaxDurationSeconds: number;
  readonly wallRunGravityMultiplier: number;
  readonly wallRunSpeedDecay: number;
  readonly wallJumpOutwardSpeed: number;
  readonly wallJumpUpSpeed: number;
}

export const DEFAULT_MOVEMENT_TUNING: MovementTuning = {
  capsuleHeight: 1.75,
  capsuleRadius: 0.3,
  standingEyeHeight: 1.6,
  crouchingEyeHeight: 1.05,
  slidingEyeHeight: 0.65,
  crouchHeight: 1.15,
  slideHeight: 0.9,
  groundDetectionDistance: 0.12,
  maxStepHeight: 0.4,
  stepMinWidth: 0.08,
  snapToGroundDistance: 1.0,
  groundStickSpeed: 9,
  stepGlideSpeed: 4.5,
  stepGlideProbeAhead: 0.35,

  slopeEaseMinAngleDegrees: 18,
  slopeEaseMaxFactor: 0.72,
  slopeSlideSpeedMultiplier: 2.2,

  walkSpeed: 3.5,
  runSpeed: 6,
  sprintSpeed: 8.5,
  crouchSpeedMultiplier: 0.5,

  groundAcceleration: 18,
  groundDeceleration: 14,
  airAcceleration: 5,
  maxAirSpeed: 9.5,

  gravity: 22,
  /** Design apex above the take-off surface (docs/12 §6.2). */
  jumpHeight: 1.25,
  /** Extra rise added to the impulse so the physical apex still reaches
   * jumpHeight despite the body starting below its nominal ground clearance
   * (controller offset + snap-to-ground). */
  jumpTakeoffCompensationMeters: 0.35,
  minJumpVelocityRatio: 0.6,
  maxFallSpeed: 35,
  jumpBufferSeconds: 0.12,
  coyoteTimeSeconds: 0.14,
  jumpReleaseGravityMultiplier: 2.5,

  slideMinEntrySpeed: 5,
  slideFriction: 2,
  slideMinDurationSeconds: 0.25,
  slideMaxDurationSeconds: 1.2,
  slideExitSpeed: 2.5,

  vaultMinHeight: 0.35,
  vaultMaxHeight: 1.15,
  vaultDurationSeconds: 0.45,
  vaultArcLift: 0.25,

  wallRunMinSpeed: 5,
  wallRunMaxDurationSeconds: 1.5,
  wallRunGravityMultiplier: 0.35,
  wallRunSpeedDecay: 1,
  wallJumpOutwardSpeed: 5.5,
  wallJumpUpSpeed: 6,

  landingRecoverySeconds: 0.18,
};
