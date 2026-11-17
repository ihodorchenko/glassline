/**
 * Movement tuning values.
 * See `docs/12_MOVEMENT_SYSTEM_SPEC.md` §5.3 and §6.
 */
export interface MovementTuning {
  readonly capsuleHeight: number;
  readonly capsuleRadius: number;
  readonly standingEyeHeight: number;
  readonly crouchingEyeHeight: number;
  readonly groundDetectionDistance: number;
  readonly maxStepHeight: number;

  readonly walkSpeed: number;
  readonly runSpeed: number;
  readonly sprintSpeed: number;
  readonly crouchSpeedMultiplier: number;

  readonly groundAcceleration: number;
  readonly groundDeceleration: number;
  readonly airAcceleration: number;
  readonly maxAirSpeed: number;

  readonly gravity: number;
  readonly jumpHeight: number;
  readonly maxFallSpeed: number;
  readonly jumpBufferSeconds: number;
  readonly coyoteTimeSeconds: number;
  readonly jumpReleaseGravityMultiplier: number;

  readonly landingRecoverySeconds: number;
}

export const DEFAULT_MOVEMENT_TUNING: MovementTuning = {
  capsuleHeight: 1.75,
  capsuleRadius: 0.3,
  standingEyeHeight: 1.6,
  crouchingEyeHeight: 1.05,
  groundDetectionDistance: 0.12,
  maxStepHeight: 0.3,

  walkSpeed: 3.5,
  runSpeed: 6,
  sprintSpeed: 8.5,
  crouchSpeedMultiplier: 0.5,

  groundAcceleration: 18,
  groundDeceleration: 14,
  airAcceleration: 5,
  maxAirSpeed: 9.5,

  gravity: 22,
  jumpHeight: 1.25,
  maxFallSpeed: 35,
  jumpBufferSeconds: 0.12,
  coyoteTimeSeconds: 0.1,
  jumpReleaseGravityMultiplier: 2.5,

  landingRecoverySeconds: 0.18,
};
