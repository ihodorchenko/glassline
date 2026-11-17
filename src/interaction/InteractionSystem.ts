import type { Disposable } from "../core/Disposable";
import type { Vector3Like } from "../shared/math";

export interface InteractionTargetDefinition {
  readonly id: string;
  readonly position: Vector3Like;
  readonly radius: number;
  readonly prompt: string;
  readonly enabled?: boolean;
  /** Optional physics collider used for line-of-sight validation. */
  readonly colliderHandle?: number;
}

export interface InteractionSnapshot {
  readonly available: boolean;
  readonly targetId: string | null;
  readonly prompt: string | null;
}

export interface InteractionOptions {
  readonly cooldownSeconds?: number;
  readonly minimumFacingDot?: number;
  readonly lineOfSight?: (eyePosition: Vector3Like, target: InteractionTargetDefinition) => boolean;
}

export type InteractionExecutionResult =
  | { readonly executed: true; readonly targetId: string }
  | {
      readonly executed: false;
      readonly reason: "not-pressed" | "no-target" | "disabled" | "cooldown";
    };

export type InteractionListener = (targetId: string) => void;

const DEFAULT_COOLDOWN_SECONDS = 0.6;
const DEFAULT_MINIMUM_FACING_DOT = 0.2;

function distance(left: Vector3Like, right: Vector3Like): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

/**
 * Selects, validates, and executes contextual interactions
 * (`docs/14_INTERACTION_SYSTEM_SPEC.md`).
 *
 * Validation covers: target enabled, range, facing direction, physics
 * line-of-sight, and interaction cooldown. Execution only happens for the
 * currently available validated target.
 */
export class InteractionSystem implements Disposable {
  private readonly targets = new Map<string, InteractionTargetDefinition>();
  private readonly listeners = new Set<InteractionListener>();
  private readonly cooldownSeconds: number;
  private readonly minimumFacingDot: number;
  private readonly lineOfSight:
    | ((eyePosition: Vector3Like, target: InteractionTargetDefinition) => boolean)
    | null;

  private snapshot: InteractionSnapshot = {
    available: false,
    targetId: null,
    prompt: null,
  };
  private lastExecutionAtMs = Number.NEGATIVE_INFINITY;

  constructor(targets: readonly InteractionTargetDefinition[], options: InteractionOptions = {}) {
    this.cooldownSeconds = options.cooldownSeconds ?? DEFAULT_COOLDOWN_SECONDS;
    this.minimumFacingDot = options.minimumFacingDot ?? DEFAULT_MINIMUM_FACING_DOT;
    this.lineOfSight = options.lineOfSight ?? null;

    for (const target of targets) {
      this.targets.set(target.id, { ...target });
    }
  }

  getSnapshot(): InteractionSnapshot {
    return this.snapshot;
  }

  /** Re-evaluates the currently available interaction for the player's view. */
  update(
    eyePosition: Vector3Like,
    lookDirection: Vector3Like,
    _timestampMs: number,
  ): InteractionSnapshot {
    const lookLength = Math.hypot(lookDirection.x, lookDirection.y, lookDirection.z);

    if (lookLength < 1e-6) {
      this.snapshot = { available: false, targetId: null, prompt: null };

      return this.snapshot;
    }

    const normalizedLook = {
      x: lookDirection.x / lookLength,
      y: lookDirection.y / lookLength,
      z: lookDirection.z / lookLength,
    };

    let bestTarget: InteractionTargetDefinition | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const target of this.targets.values()) {
      if (target.enabled === false) {
        continue;
      }

      const targetDistance = distance(eyePosition, target.position);

      if (targetDistance > target.radius || targetDistance >= bestDistance) {
        continue;
      }

      const direction = {
        x: target.position.x - eyePosition.x,
        y: target.position.y - eyePosition.y,
        z: target.position.z - eyePosition.z,
      };
      const directionLength = Math.hypot(direction.x, direction.y, direction.z);

      if (directionLength < 1e-6) {
        continue;
      }

      const facingDot =
        (direction.x * normalizedLook.x +
          direction.y * normalizedLook.y +
          direction.z * normalizedLook.z) /
        directionLength;

      if (facingDot < this.minimumFacingDot) {
        continue;
      }

      if (this.lineOfSight && !this.lineOfSight(eyePosition, target)) {
        continue;
      }

      bestTarget = target;
      bestDistance = targetDistance;
    }

    this.snapshot = bestTarget
      ? { available: true, targetId: bestTarget.id, prompt: bestTarget.prompt }
      : { available: false, targetId: null, prompt: null };

    return this.snapshot;
  }

  /**
   * Executes the currently available interaction.
   * Must be called from the same step as `update` for the validated target.
   */
  tryInteract(pressed: boolean, timestampMs: number): InteractionExecutionResult {
    if (!pressed) {
      return { executed: false, reason: "not-pressed" };
    }

    if (!this.snapshot.available || !this.snapshot.targetId) {
      return { executed: false, reason: "no-target" };
    }

    if (timestampMs - this.lastExecutionAtMs < this.cooldownSeconds * 1000) {
      return { executed: false, reason: "cooldown" };
    }

    const target = this.targets.get(this.snapshot.targetId);

    if (!target || target.enabled === false) {
      return { executed: false, reason: "disabled" };
    }

    this.lastExecutionAtMs = timestampMs;

    for (const listener of [...this.listeners]) {
      try {
        listener(target.id);
      } catch (error) {
        console.error("[Glassline] An interaction listener failed.", error);
      }
    }

    return { executed: true, targetId: target.id };
  }

  setTargetEnabled(targetId: string, enabled: boolean): void {
    const target = this.targets.get(targetId);

    if (target) {
      this.targets.set(targetId, { ...target, enabled });
    }
  }

  subscribe(listener: InteractionListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
    this.targets.clear();
    this.snapshot = { available: false, targetId: null, prompt: null };
  }
}
