import RAPIER from "@dimforge/rapier3d-compat";
import type { Disposable } from "../core/Disposable";
import { EventBus, type Unsubscribe } from "../core/EventBus";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { Vector2Like, Vector3Like } from "../shared/math";
import { clamp } from "../shared/math";
import {
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
}

export interface PlayerSystemOptions {
  readonly tuning?: MovementTuning;
  /** Capsule center world position. */
  readonly spawnPoint: Vector3Like;
}

export interface PlayerStepResult {
  readonly jumped: boolean;
  readonly landed: boolean;
  readonly impactSpeed: number;
}

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
 * integration, collision results, interpolation, and canonical movement events.
 */
export class PlayerSystem implements Disposable {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;

  private readonly physics: PhysicsWorld;
  private readonly tuning: MovementTuning;
  private readonly spawnPoint: Vector3Like;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly events = new EventBus<MovementEventMap>();
  private readonly desiredTranslation = { x: 0, y: 0, z: 0 };
  private readonly actualMovement = { x: 0, y: 0, z: 0 };

  private model: MovementModel;
  private active = false;
  private disposed = false;

  private previousPosition: Vector3Like;
  private currentPosition: Vector3Like;

  constructor(physics: PhysicsWorld, options: PlayerSystemOptions) {
    this.physics = physics;
    this.tuning = options.tuning ?? DEFAULT_MOVEMENT_TUNING;
    this.spawnPoint = options.spawnPoint;

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
    this.controller.enableAutostep(this.tuning.maxStepHeight, 0.1, false);
    this.controller.enableSnapToGround(this.tuning.groundDetectionDistance);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((35 * Math.PI) / 180);
    this.controller.setSlideEnabled(true);
    this.controller.setApplyImpulsesToDynamicBodies(false);

    this.model = new MovementModel(this.tuning);
    this.previousPosition = { ...options.spawnPoint };
    this.currentPosition = { ...options.spawnPoint };
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

  /**
   * One fixed simulation step: computes desired movement, resolves collisions,
   * and queues the kinematic translation for the following physics step.
   */
  fixedUpdate(input: MovementInputSample, viewYaw: number, deltaSeconds: number): PlayerStepResult {
    if (!this.isActive || deltaSeconds <= 0) {
      return { jumped: false, landed: false, impactSpeed: 0 };
    }

    const worldDirection = toWorldDirection(input.move, viewYaw);

    this.model.step(input, worldDirection, this.controller.computedGrounded(), deltaSeconds);

    const desired = this.model.getDesiredTranslation(deltaSeconds);

    this.desiredTranslation.x = desired.x;
    this.desiredTranslation.y = desired.y;
    this.desiredTranslation.z = desired.z;

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

    this.body.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });

    this.model.applyCollisionResult(
      { x: movement.x, y: movement.y, z: movement.z },
      deltaSeconds,
      this.controller.computedGrounded(),
    );

    const stepEvents = this.model.consumeEvents();
    const snapshot = this.model.getSnapshot();

    if (stepEvents.jumped) {
      this.events.emit("player:jumped", { speed: snapshot.speed });
    }

    if (stepEvents.landed) {
      this.events.emit("player:landed", { impactSpeed: stepEvents.impactSpeed });
    }

    return {
      jumped: stepEvents.jumped,
      landed: stepEvents.landed,
      impactSpeed: stepEvents.impactSpeed,
    };
  }

  getMovementSnapshot(): MovementModelSnapshot {
    return this.model.getSnapshot();
  }

  getState(): MovementState {
    return this.model.getState();
  }

  getStance(): PlayerStance {
    return this.model.getStance();
  }

  /** Latest simulated capsule center. */
  getPosition(): Vector3Like {
    return this.currentPosition;
  }

  /** Body center interpolated between the last two fixed steps. */
  getInterpolatedPosition(alpha: number): Vector3Like {
    const t = clamp(alpha, 0, 1);

    return {
      x: this.previousPosition.x + (this.currentPosition.x - this.previousPosition.x) * t,
      y: this.previousPosition.y + (this.currentPosition.y - this.previousPosition.y) * t,
      z: this.previousPosition.z + (this.currentPosition.z - this.previousPosition.z) * t,
    };
  }

  /** Resets the player to its spawn point. Used by diagnostics and tests. */
  reset(): void {
    this.model = new MovementModel(this.tuning);
    this.body.setTranslation(this.spawnPoint, true);
    this.body.setNextKinematicTranslation(this.spawnPoint);
    this.previousPosition = { ...this.spawnPoint };
    this.currentPosition = { ...this.spawnPoint };
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
}
