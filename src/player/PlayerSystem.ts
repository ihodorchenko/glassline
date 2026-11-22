import RAPIER from "@dimforge/rapier3d-compat";

import type { Disposable } from "../core/Disposable";
import { EventBus, type Unsubscribe } from "../core/EventBus";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { Vector2Like, Vector3Like } from "../shared/math";
import { clamp } from "../shared/math";
import { VaultDetector } from "./detection/VaultDetector";
import { WallRunDetector } from "./detection/WallRunDetector";
import {
  type MovementEnvironment,
  type MovementInputSample,
  MovementModel,
  type MovementModelSnapshot,
  type MovementState,
  type PlayerStance,
} from "./MovementModel";
import { DEFAULT_MOVEMENT_TUNING, type MovementTuning } from "./MovementTuning";

export interface MovementEventMap {
  [key: string]: unknown;
  "player:jumped": { readonly speed: number };
  "player:landed": { readonly impactSpeed: number };
  "player:sliding-started": { readonly speed: number };
  "player:sliding-ended": Record<string, never>;
  "player:vault-started": { readonly speed: number; readonly vaultType: "standard" | "speed" };
  "player:wallrun-started": { readonly side: "left" | "right" };
  "player:wallrun-ended": Record<string, never>;
  "player:walljumped": Record<string, never>;
}

export interface PlayerSystemOptions {
  readonly tuning?: MovementTuning;
  /** Capsule center world position. */
  readonly spawnPoint: Vector3Like;
  /**
   * Optional surface-eligibility resolver for wall running
   * (`12_MOVEMENT_SYSTEM_SPEC.md` §15.2): receives the wall hit point and
   * reports whether that surface is wall-runnable. Without it the detector
   * uses pure geometry (unit tests).
   */
  readonly isWallRunnable?: (position: Vector3Like) => boolean;
}

const DOWN_RAY = { x: 0, y: -1, z: 0 };
/** Skin used by the kinematic character controller; also the physical foot offset. */
const CHARACTER_CONTROLLER_OFFSET = 0.02;

function toWorldDirection(move: Vector2Like, viewYaw: number): Vector3Like {
  const forwardX = -Math.sin(viewYaw);
  const forwardZ = -Math.cos(viewYaw);
  const rightX = Math.cos(viewYaw);
  const rightZ = -Math.sin(viewYaw);

  return {
    x: rightX * move.x + forwardX * move.y,
    y: 0,
    z: rightZ * move.x + forwardZ * move.y,
  };
}

/**
 * Owns the player's physical representation and executes movement through
 * Rapier's kinematic character controller.
 *
 * Movement rules live in `MovementModel`; this class handles physics
 * integration, obstacle detection, scripted vault motion, collision results,
 * posture volumes, interpolation, and canonical movement events.
 */
export class PlayerSystem implements Disposable {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;

  private readonly physics: PhysicsWorld;
  private readonly tuning: MovementTuning;
  private readonly spawnPoint: Vector3Like;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly wallRunDetector: WallRunDetector;
  private readonly vaultDetector: VaultDetector;
  private readonly events = new EventBus<MovementEventMap>();
  private readonly desiredTranslation = { x: 0, y: 0, z: 0 };
  private readonly actualMovement = { x: 0, y: 0, z: 0 };

  private model: MovementModel;
  private active = false;
  private disposed = false;

  private postureHeight: number;
  private effectiveStance: PlayerStance = "standing";

  private previousPosition: Vector3Like;
  private currentPosition: Vector3Like;
  private distanceSinceLastRead = 0;

  /**
   * Vertically smoothed position used for camera presentation only. Autostep
   * lifts and landing impacts move the body instantly; the filter lets the
   * view ride over them while gameplay logic keeps seeing the true position.
   */
  private filteredY: number;
  private lastFilterDeltaSeconds = 1 / 60;
  /** Horizontal distance already glided up the current riser (meters). */
  private stepGlideProgress = 0;
  /** Support-surface normal under the feet after the latest fixed step. */
  private lastSlopeNormal: Vector3Like | null = null;

  private vaultSnapSuspended = false;

  constructor(physics: PhysicsWorld, options: PlayerSystemOptions) {
    this.physics = physics;
    this.tuning = options.tuning ?? DEFAULT_MOVEMENT_TUNING;
    this.spawnPoint = options.spawnPoint;
    this.postureHeight = this.tuning.capsuleHeight;

    const world = physics.rapierWorld;
    const halfHeight = this.tuning.capsuleHeight / 2 - this.tuning.capsuleRadius;

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        options.spawnPoint.x,
        options.spawnPoint.y,
        options.spawnPoint.z,
      ),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, this.tuning.capsuleRadius),
      this.body,
    );

    this.controller = world.createCharacterController(CHARACTER_CONTROLLER_OFFSET);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    // includeDowncast lets autostep ride *down* over ledges and steps as well,
    // which removes the "fall off every stair" jolt on descents.
    this.controller.enableAutostep(this.tuning.maxStepHeight, this.tuning.stepMinWidth, true);
    this.controller.enableSnapToGround(this.tuning.snapToGroundDistance);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((35 * Math.PI) / 180);
    this.controller.setSlideEnabled(true);
    this.controller.setApplyImpulsesToDynamicBodies(false);

    this.wallRunDetector = new WallRunDetector(world, {
      minSpeed: this.tuning.wallRunMinSpeed,
      ...(options.isWallRunnable ? { isWallRunnable: options.isWallRunnable } : {}),
    });
    this.vaultDetector = new VaultDetector(world, this.tuning, CHARACTER_CONTROLLER_OFFSET);

    this.model = new MovementModel(this.tuning);
    this.previousPosition = { ...options.spawnPoint };
    this.currentPosition = { ...options.spawnPoint };
    this.filteredY = options.spawnPoint.y;
  }

  get isActive(): boolean {
    return this.active && !this.disposed;
  }

  get tuningConfig(): MovementTuning {
    return this.tuning;
  }

  get halfHeight(): number {
    return this.tuning.capsuleHeight / 2;
  }

  activate(): void {
    this.active = true;
  }

  deactivate(): void {
    this.active = false;
  }

  onMovementEvent<K extends keyof MovementEventMap>(
    type: K,
    listener: (payload: MovementEventMap[K]) => void,
  ): Unsubscribe {
    return this.events.on(type, listener);
  }

  /** One fixed simulation step. */
  fixedUpdate(input: MovementInputSample, viewYaw: number, deltaSeconds: number): void {
    if (!this.isActive || deltaSeconds <= 0) {
      return;
    }

    const worldDirection = toWorldDirection(input.move, viewYaw);
    const activeVault = this.model.getActiveVault();

    this.lastFilterDeltaSeconds = deltaSeconds;

    // Snap-to-ground fights the clearance arc: it would glue the rising
    // capsule to the obstacle top mid-vault. Suspend it for the traversal and
    // restore it as soon as the vault ends.
    if (activeVault && !this.vaultSnapSuspended) {
      this.controller.enableSnapToGround(0);
      this.vaultSnapSuspended = true;
    } else if (!activeVault && this.vaultSnapSuspended) {
      this.controller.enableSnapToGround(this.tuning.snapToGroundDistance);
      this.vaultSnapSuspended = false;
    }

    if (activeVault) {
      this.updateScriptedVault(input, worldDirection, activeVault, deltaSeconds);

      return;
    }

    const translation = this.body.translation();
    let grounded = this.controller.computedGrounded();

    // Ground-stick: riding *down* over steps and ledges keeps the body glued to
    // the surface instead of entering micro free-falls between them. The model
    // arms it only when walking off a ledge — never after jumps or wall kicks.
    const groundStick = !grounded && this.model.wantsGroundSnap();

    if (groundStick) {
      const stickHit = this.physics.rapierWorld.castRay(
        new RAPIER.Ray(
          { x: translation.x, y: translation.y - this.postureHeight / 2, z: translation.z },
          DOWN_RAY,
        ),
        this.tuning.snapToGroundDistance,
        true,
        undefined,
        undefined,
        undefined,
        this.body,
      );

      if (stickHit) {
        grounded = true;
      } else {
        // Nothing under the feet within snap range: this is a real drop.
        this.model.disarmGroundSnap();
      }
    }

    const environment: MovementEnvironment = {
      grounded,
      wallRun: grounded ? null : this.wallRunDetector.detect(translation, this.model.getVelocity()),
      vault: grounded
        ? this.vaultDetector.detect(
            translation,
            this.resolveForward(input, worldDirection, viewYaw),
            this.getFeetPosition().y,
          )
        : null,
    };

    this.model.step(input, worldDirection, environment, deltaSeconds);
    this.applyPosture(this.resolveDesiredStance());

    const desired = this.model.getDesiredTranslation(deltaSeconds);

    this.desiredTranslation.x = desired.x;
    this.desiredTranslation.y = desired.y;
    this.desiredTranslation.z = desired.z;

    // When ground-sticking, stop exactly at the surface below: the body glides
    // down step faces without overshooting into them or bouncing off them.
    if (groundStick && grounded && !this.controller.computedGrounded()) {
      const feetY = translation.y - this.postureHeight / 2;
      const hit = this.physics.rapierWorld.castRay(
        new RAPIER.Ray({ x: translation.x, y: feetY, z: translation.z }, DOWN_RAY),
        this.tuning.snapToGroundDistance,
        true,
        undefined,
        undefined,
        undefined,
        this.body,
      );

      if (hit) {
        const maxStickStep = Math.max(0, hit.timeOfImpact);

        if (this.desiredTranslation.y < -maxStickStep) {
          this.desiredTranslation.y = -maxStickStep;
        }
      }
    }

    const translationBefore = this.body.translation();

    // Detect a climbable riser before consulting the controller; when found we
    // override its result with our own slope-following displacement — same feel
    // at any speed, no one-frame hop, no walking stall at low risers.
    const glideTarget = this.computeStepGlide(translationBefore, deltaSeconds);

    this.controller.computeColliderMovement(this.collider, this.desiredTranslation);

    const computed = this.controller.computedMovement(this.actualMovement);
    const movement = { x: computed.x, y: computed.y, z: computed.z };
    let glideActive = false;

    if (glideTarget) {
      glideActive = true;
      movement.x = glideTarget.dx;
      movement.y = glideTarget.dy;
      movement.z = glideTarget.dz;
    } else if (grounded && this.lastSlopeNormal !== null) {
      // The controller flattens our commanded motion onto the surface plane,
      // which loses speed on inclines. Re-map the command along the steepest
      // line of the slope so uphill keeps its push and downhill gains slide.
      const normal = this.lastSlopeNormal;
      const slopeCos = normal.y;

      if (slopeCos < 0.995 && slopeCos > 0.05) {
        let gx = normal.x;
        let gz = normal.z;
        const gLen = Math.hypot(gx, gz);

        if (gLen > 1e-6) {
          gx /= gLen;
          gz /= gLen;

          const commandX = this.desiredTranslation.x / deltaSeconds;
          const commandZ = this.desiredTranslation.z / deltaSeconds;
          const intentAlongDown = commandX * gx + commandZ * gz;

          if (intentAlongDown < 0) {
            // Climbing: the controller projected our command onto the surface
            // plane (losing cos(slope) of travel) and its autostep only fires
            // with strong intent, so inclines crawl and steep ones stall. Ride
            // the slope line ourselves: horizontal travel keeps the commanded
            // magnitude, vertical follows tan(slope) per unit — an exact ascent
            // that hugs the ramp at any walk/run/sprint speed.
            const slopeSin = Math.sqrt(Math.max(0, 1 - slopeCos * slopeCos));
            const commanded = Math.hypot(this.desiredTranslation.x, this.desiredTranslation.z);

            if (commanded > 1e-6) {
              // Keep the full horizontal magnitude of the command — only its
              // direction is rotated onto the steepest-ascent line. Shrinking
              // it to the projected part re-introduces the cos(slope) loss and
              // makes walking up steep ramps crawl.
              movement.x = -gx * commanded;
              movement.z = -gz * commanded;
              movement.y += (commanded * slopeSin) / slopeCos;
            }
          } else if (slopeCos < Math.cos((35 * Math.PI) / 180)) {
            // Sliding down a too-steep slope felt like crawling: accelerate the
            // controller's slide along the downhill direction.
            const along = movement.x * gx + movement.z * gz;

            if (along < 0) {
              const boosted = along * this.tuning.slopeSlideSpeedMultiplier;
              const delta = boosted - along;

              movement.x += gx * delta;
              movement.z += gz * delta;
            }
          }
        }
      }
    }

    const nextX = translationBefore.x + movement.x;
    const nextY = translationBefore.y + movement.y;
    const nextZ = translationBefore.z + movement.z;

    this.previousPosition = {
      x: translationBefore.x,
      y: translationBefore.y,
      z: translationBefore.z,
    };
    this.currentPosition = { x: nextX, y: nextY, z: nextZ };
    this.distanceSinceLastRead += Math.hypot(movement.x, movement.z);

    this.body.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });

    // Glide steps are kinematic by construction (the riser and its top were
    // validated by raycasts), so their travel can legitimately be a tiny
    // final sliver. Reconciling velocity against that sliver collapses the
    // commanded speed on every stair (the jerky ascent); preserve the
    // model's commanded horizontal momentum instead and keep only the
    // glide's actual vertical lift.
    const resultMovement = glideActive
      ? { x: this.desiredTranslation.x, y: movement.y, z: this.desiredTranslation.z }
      : { x: movement.x, y: movement.y, z: movement.z };

    this.model.applyCollisionResult(
      resultMovement,
      deltaSeconds,
      this.controller.computedGrounded(),
    );

    // Feed slope handling with the surface under the *final* pose of this step
    // (post glide/collision), so incline easing matches where we actually are.
    const groundedNow = this.controller.computedGrounded();

    this.lastSlopeNormal = groundedNow ? this.probeSupportNormal(this.currentPosition) : null;
    this.model.setSlopeNormal(this.lastSlopeNormal);

    this.emitMovementEvents();
  }

  getMovementSnapshot(): MovementModelSnapshot {
    return {
      ...this.model.getSnapshot(),
      stance: this.effectiveStance,
      postureHeight: this.postureHeight,
    };
  }

  getPostureHeight(): number {
    return this.postureHeight;
  }

  getFeetPosition(): Vector3Like {
    const translation = this.body.translation();

    return {
      x: translation.x,
      y: translation.y - this.postureHeight / 2,
      z: translation.z,
    };
  }

  getEyePosition(eyeHeightAboveFeet: number): Vector3Like {
    const feet = this.getFeetPosition();

    return { x: feet.x, y: feet.y + eyeHeightAboveFeet, z: feet.z };
  }

  getState(): MovementState {
    return this.model.getState();
  }

  getStance(): PlayerStance {
    return this.effectiveStance;
  }

  getPosition(): Vector3Like {
    return this.currentPosition;
  }

  /** Consumes locomotion distance accumulated since the last call (meters). */
  consumeDistanceDelta(): number {
    const distance = this.distanceSinceLastRead;

    this.distanceSinceLastRead = 0;

    return distance;
  }

  getInterpolatedPosition(alpha: number): Vector3Like {
    const t = clamp(alpha, 0, 1);
    const rawY = this.previousPosition.y + (this.currentPosition.y - this.previousPosition.y) * t;

    return {
      x: this.previousPosition.x + (this.currentPosition.x - this.previousPosition.x) * t,
      y: this.dampFilteredY(rawY),
      z: this.previousPosition.z + (this.currentPosition.z - this.previousPosition.z) * t,
    };
  }

  /**
   * Exponential low-pass on the camera's vertical follow. The time constant is
   * short (~70 ms) so sustained climbs and falls track exactly, while single
   * autostep lifts and landing thumps are smoothed away.
   */
  private dampFilteredY(targetY: number): number {
    const lambda = 14;
    const deltaSeconds = Math.max(1 / 240, Math.min(this.lastFilterDeltaSeconds, 0.1));

    this.filteredY += (targetY - this.filteredY) * (1 - Math.exp(-lambda * deltaSeconds));

    return this.filteredY;
  }

  /** Teleports the player and resets transient movement state (used by respawn). */
  teleportTo(position: Vector3Like): void {
    this.model = new MovementModel(this.tuning);
    this.effectiveStance = "standing";
    this.postureHeight = this.tuning.capsuleHeight;

    if (this.vaultSnapSuspended) {
      this.controller.enableSnapToGround(this.tuning.snapToGroundDistance);
      this.vaultSnapSuspended = false;
    }

    this.collider.setHalfHeight(this.tuning.capsuleHeight / 2 - this.tuning.capsuleRadius);
    this.collider.setTranslationWrtParent({ x: 0, y: 0, z: 0 });
    this.body.setTranslation(position, true);
    this.body.setNextKinematicTranslation(position);
    this.collider.setTranslation(position);
    this.previousPosition = { ...position };
    this.currentPosition = { ...position };
    this.filteredY = position.y;
    this.distanceSinceLastRead = 0;
  }

  reset(): void {
    this.teleportTo(this.spawnPoint);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.physics.isInitialized) {
      const world = this.physics.rapierWorld;

      world.removeCharacterController(this.controller);
      world.removeRigidBody(this.body);
    }
  }

  private updateScriptedVault(
    input: MovementInputSample,
    worldDirection: Vector3Like,
    activeVault: NonNullable<ReturnType<MovementModel["getActiveVault"]>>,
    deltaSeconds: number,
  ): void {
    this.model.step(
      input,
      worldDirection,
      { grounded: false, wallRun: null, vault: null },
      deltaSeconds,
    );

    const remainingVault = this.model.getActiveVault();
    const vaultCompleted = remainingVault === null;
    const elapsed = remainingVault ? remainingVault.elapsedSeconds : activeVault.durationSeconds;
    const progress = elapsed / activeVault.durationSeconds;
    const target = VaultDetector.samplePosition(activeVault.candidate, this.tuning, progress);
    const translationBefore = this.body.translation();

    // Collision-validated traversal: the scripted arc moves through the
    // character controller instead of a raw kinematic teleport, so the body
    // cannot pass through geometry — anything in the way clamps the motion
    // safely (spec §14.6).
    this.desiredTranslation.x = target.x - translationBefore.x;
    this.desiredTranslation.y = target.y - translationBefore.y;
    this.desiredTranslation.z = target.z - translationBefore.z;

    this.controller.computeColliderMovement(this.collider, this.desiredTranslation);
    const computed = this.controller.computedMovement(this.actualMovement);
    const movement = { x: computed.x, y: computed.y, z: computed.z };
    const next = {
      x: translationBefore.x + movement.x,
      y: translationBefore.y + movement.y,
      z: translationBefore.z + movement.z,
    };

    this.previousPosition = {
      x: translationBefore.x,
      y: translationBefore.y,
      z: translationBefore.z,
    };
    this.currentPosition = next;
    this.body.setNextKinematicTranslation(next);

    // On the completion step `MovementModel.updateVault` has already set the
    // profile's retained exit velocity. Re-applying the final arc segment's
    // displacement would overwrite it with an arbitrary last-frame speed
    // (observed 0–23 m/s instead of entry × retention).
    if (!vaultCompleted) {
      this.model.applyVaultMotion(movement, deltaSeconds);
    }

    this.emitMovementEvents();
  }

  /** Unit normal of the surface directly under the feet, or null. */
  private probeSupportNormal(translation: Vector3Like): Vector3Like | null {
    const feetY = translation.y - this.postureHeight / 2;

    for (const offset of [0, 0.14, -0.14]) {
      const hit = this.physics.rapierWorld.castRayAndGetNormal(
        new RAPIER.Ray({ x: translation.x + offset, y: feetY + 0.1, z: translation.z }, DOWN_RAY),
        0.45,
        true,
        undefined,
        undefined,
        undefined,
        this.body,
      );

      if (hit) {
        return { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z };
      }
    }

    return null;
  }

  /**
   * Deterministic step-up, purely kinematic (no shape sweeps): probe the feet
   * level for a riser face ahead, then confirm a flat climbable top above it.
   * When found, glide along the slope line at `stepGlideSpeed` — same feel at
   * any speed, no one-frame autostep hop and no walking stall at low risers.
   */
  private computeStepGlide(
    translationBefore: Vector3Like,
    deltaSeconds: number,
  ): { readonly dx: number; readonly dy: number; readonly dz: number } | null {
    const desiredHorizontal = Math.hypot(this.desiredTranslation.x, this.desiredTranslation.z);

    if (desiredHorizontal <= 1e-6) {
      this.stepGlideProgress = 0;

      return null;
    }

    const dirX = this.desiredTranslation.x / desiredHorizontal;
    const dirZ = this.desiredTranslation.z / desiredHorizontal;
    const lift = this.tuning.maxStepHeight;
    const feetY = translationBefore.y - this.postureHeight / 2;

    // Riser face: horizontal rays at foot height hit something within reach.
    // The rays start at the capsule CENTER, not its front surface: when the
    // capsule is already touching the riser, a ray from the surface can start
    // on/inside the face and miss it (jerky stair ascent). Two heights cover
    // the face even when the feet float slightly above or below the step top.
    const probeHeights = [feetY + 0.04, feetY + 0.12];
    let face: RAPIER.RayColliderHit | null = null;

    for (const probeY of probeHeights) {
      const hit = this.physics.rapierWorld.castRay(
        new RAPIER.Ray(
          {
            x: translationBefore.x,
            y: probeY,
            z: translationBefore.z,
          },
          { x: dirX, y: 0, z: dirZ },
        ),
        this.tuning.stepGlideProbeAhead + this.tuning.capsuleRadius + 0.05,
        true,
        undefined,
        undefined,
        undefined,
        this.body,
      );

      if (!hit) {
        continue;
      }

      if (!face || hit.timeOfImpact < face.timeOfImpact) {
        face = hit;
      }
    }

    if (!face) {
      this.stepGlideProgress = 0;

      return null;
    }

    const wallX = translationBefore.x + dirX * face.timeOfImpact;
    const wallZ = translationBefore.z + dirZ * face.timeOfImpact;

    // Climbable top just behind the face?
    const support = this.physics.rapierWorld.castRayAndGetNormal(
      new RAPIER.Ray(
        { x: wallX + dirX * 0.12, y: feetY + lift + 0.05, z: wallZ + dirZ * 0.12 },
        DOWN_RAY,
      ),
      lift + 0.15,
      true,
      undefined,
      undefined,
      undefined,
      this.body,
    );

    if (!support || support.normal.y < 0.9) {
      this.stepGlideProgress = 0;

      return null;
    }

    const surfaceFeetY = feetY + lift + 0.05 - support.timeOfImpact;
    const rise = surfaceFeetY - feetY;

    if (rise < 0.04 || rise > lift) {
      this.stepGlideProgress = 0;

      return null;
    }

    // Glide horizontally from here to where the capsule center sits over the
    // step top (wall plane plus 0.12 m of overshoot). The face distance is
    // measured from the capsule center (see the probe above).
    const horizTarget = Math.max(0.02, face.timeOfImpact + 0.12);
    const travel = Math.min(
      desiredHorizontal,
      this.tuning.stepGlideSpeed * deltaSeconds,
      horizTarget - this.stepGlideProgress,
    );

    if (travel <= 1e-6) {
      this.stepGlideProgress = 0;

      return null;
    }

    const before = this.stepGlideProgress / horizTarget;
    const after = (this.stepGlideProgress + travel) / horizTarget;

    // Smoothstep easing: zero vertical acceleration at both ends of the ramp.
    const ease = (t: number): number => t * t * (3 - 2 * t);

    this.stepGlideProgress += travel;

    if (this.stepGlideProgress >= horizTarget - 1e-4) {
      this.stepGlideProgress = 0;
    }

    return {
      dx: dirX * travel,
      dz: dirZ * travel,
      dy: rise * (ease(Math.min(1, after)) - ease(Math.min(1, before))),
    };
  }

  private resolveForward(
    input: MovementInputSample,
    worldDirection: Vector3Like,
    viewYaw: number,
  ): Vector3Like {
    const magnitude = Math.hypot(input.move.x, input.move.y);

    if (magnitude > 0.1) {
      const length = Math.hypot(worldDirection.x, worldDirection.z);

      if (length > 1e-6) {
        return { x: worldDirection.x / length, y: 0, z: worldDirection.z / length };
      }
    }

    return { x: -Math.sin(viewYaw), y: 0, z: -Math.cos(viewYaw) };
  }

  private resolveDesiredStance(): PlayerStance {
    const snapshot = this.model.getSnapshot();

    if (snapshot.state === "SLIDING") {
      return "sliding";
    }

    return snapshot.stance;
  }

  private applyPosture(desiredStance: PlayerStance): void {
    const targetHeight =
      desiredStance === "sliding"
        ? this.tuning.slideHeight
        : desiredStance === "crouching"
          ? this.tuning.crouchHeight
          : this.tuning.capsuleHeight;

    if (targetHeight > this.postureHeight && !this.hasStandingClearance(targetHeight)) {
      this.effectiveStance =
        this.postureHeight < this.tuning.capsuleHeight ? "crouching" : this.effectiveStance;

      return;
    }

    this.effectiveStance = desiredStance;

    if (targetHeight === this.postureHeight) {
      return;
    }

    this.applyPostureGeometry(targetHeight);
  }

  private applyPostureGeometry(targetHeight: number): void {
    const halfCapsule = Math.max(0.05, targetHeight / 2 - this.tuning.capsuleRadius);
    const translation = this.body.translation();
    const feetY = translation.y - this.postureHeight / 2;
    const bodyY = feetY + targetHeight / 2;
    const deltaY = bodyY - translation.y;

    this.collider.setHalfHeight(halfCapsule);
    this.collider.setTranslationWrtParent({ x: 0, y: 0, z: 0 });
    this.body.setTranslation({ x: translation.x, y: bodyY, z: translation.z }, true);
    this.body.setNextKinematicTranslation({ x: translation.x, y: bodyY, z: translation.z });
    this.collider.setTranslation({ x: translation.x, y: bodyY, z: translation.z });

    this.previousPosition = {
      x: this.previousPosition.x,
      y: this.previousPosition.y + deltaY,
      z: this.previousPosition.z,
    };
    this.currentPosition = {
      x: this.currentPosition.x,
      y: this.currentPosition.y + deltaY,
      z: this.currentPosition.z,
    };
    this.postureHeight = targetHeight;
  }

  private hasStandingClearance(targetHeight: number): boolean {
    const translation = this.body.translation();
    const feetY = translation.y - this.postureHeight / 2;
    const headroom = targetHeight - this.postureHeight;
    const originY = feetY + this.postureHeight + 0.02;
    const hit = this.physics.rapierWorld.castRay(
      new RAPIER.Ray({ x: translation.x, y: originY, z: translation.z }, { x: 0, y: 1, z: 0 }),
      Math.max(0.01, headroom - 0.02 + 0.05),
      true,
    );

    return hit === null;
  }

  private emitMovementEvents(): void {
    const events = this.model.consumeEvents();
    const snapshot = this.model.getSnapshot();

    if (events.jumped) {
      this.events.emit("player:jumped", { speed: snapshot.speed });
    }

    if (events.landed) {
      this.events.emit("player:landed", { impactSpeed: events.impactSpeed });
    }

    if (events.slidingStarted) {
      this.events.emit("player:sliding-started", { speed: snapshot.speed });
    }

    if (events.slidingEnded) {
      this.events.emit("player:sliding-ended", {});
    }

    if (events.vaultStarted) {
      this.events.emit("player:vault-started", {
        speed: snapshot.speed,
        vaultType: events.vaultType ?? "standard",
      });
    }

    if (events.wallRunStarted) {
      this.events.emit("player:wallrun-started", {
        side: snapshot.wallRunSide ?? "right",
      });
    }

    if (events.wallRunEnded) {
      this.events.emit("player:wallrun-ended", {});
    }

    if (events.wallJumped) {
      this.events.emit("player:walljumped", {});
    }
  }
}
