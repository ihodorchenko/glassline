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
  "player:vault-started": { readonly speed: number };
  "player:wallrun-started": { readonly side: "left" | "right" };
  "player:wallrun-ended": Record<string, never>;
  "player:walljumped": Record<string, never>;
}

export interface PlayerSystemOptions {
  readonly tuning?: MovementTuning;
  /** Capsule center world position. */
  readonly spawnPoint: Vector3Like;
}

const DOWN_RAY = { x: 0, y: -1, z: 0 };

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

    this.controller = world.createCharacterController(0.02);
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
    });
    this.vaultDetector = new VaultDetector(world, this.tuning);

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

    this.controller.computeColliderMovement(this.collider, this.desiredTranslation);

    const movement = this.controller.computedMovement(this.actualMovement);
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

    this.model.applyCollisionResult(
      { x: movement.x, y: movement.y, z: movement.z },
      deltaSeconds,
      this.controller.computedGrounded(),
    );

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
    const elapsed = remainingVault ? remainingVault.elapsedSeconds : activeVault.durationSeconds;
    const progress = elapsed / activeVault.durationSeconds;
    const target = VaultDetector.samplePosition(activeVault.candidate, this.tuning, progress);
    const translationBefore = this.body.translation();
    const movement = {
      x: target.x - translationBefore.x,
      y: target.y - translationBefore.y,
      z: target.z - translationBefore.z,
    };

    this.previousPosition = {
      x: translationBefore.x,
      y: translationBefore.y,
      z: translationBefore.z,
    };
    this.currentPosition = { ...target };
    this.body.setNextKinematicTranslation(target);
    this.model.applyVaultMotion(movement, deltaSeconds);
    this.emitMovementEvents();
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
      this.events.emit("player:vault-started", { speed: snapshot.speed });
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
