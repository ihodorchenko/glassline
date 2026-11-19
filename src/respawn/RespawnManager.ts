import type { RespawnDestination } from "../checkpoint/CheckpointSystem";
import type { Disposable } from "../core/Disposable";
import type { Vector3Like } from "../shared/math";

export type RespawnReason =
  | "fall"
  | "manual-restart"
  | "training-restart"
  | "scripted"
  | "recovery";

export type RespawnState = "idle" | "respawning" | "failed";

export interface RespawnCheckpointAdapter {
  resolveRespawnDestination(preferredCheckpointId?: string): RespawnDestination | null;
}

export interface RespawnPlayerAdapter {
  teleportTo(position: Vector3Like): void;
  activate(): void;
  deactivate(): void;
}

export interface RespawnCameraAdapter {
  resetForRespawn(rotationY: number): void;
}

export interface RespawnControlAdapter {
  setEnabled(enabled: boolean): void;
}

export interface RespawnManagerDependencies {
  readonly checkpoints: RespawnCheckpointAdapter;
  readonly player: RespawnPlayerAdapter;
  readonly camera: RespawnCameraAdapter;
  readonly input: RespawnControlAdapter;
}

export interface RespawnManagerOptions {
  readonly fallbackSpawn: Vector3Like;
  readonly fallbackRotationY?: number;
  /** Control-suspension window; keeps recovery visually explicit and atomic. */
  readonly respawnDurationSeconds?: number;
}

export interface RespawnCompletionEvent {
  readonly reason: RespawnReason;
  readonly destination: RespawnDestination | null;
  readonly usedFallback: boolean;
}

export type RespawnListener = (event: RespawnCompletionEvent) => void;

const DEFAULT_RESPAWN_DURATION_SECONDS = 0.15;

/**
 * The single owner of the player recovery lifecycle
 * (`docs/17_RESPAWN_SYSTEM_SPEC.md`).
 *
 * Requests resolve a destination through the Checkpoint System, suspend player
 * control, place/reset the player and camera, then restore control after a short
 * deterministic window. No other system may orchestrate recovery.
 */
export class RespawnManager implements Disposable {
  private readonly dependencies: RespawnManagerDependencies;
  private readonly fallbackSpawn: Vector3Like;
  private readonly fallbackRotationY: number;
  private readonly respawnDurationSeconds: number;
  private readonly listeners = new Set<RespawnListener>();

  private state: RespawnState = "idle";
  private elapsedSeconds = 0;
  private lastReason: RespawnReason = "recovery";
  private lastDestination: RespawnDestination | null = null;
  private lastUsedFallback = false;
  private emergencyAnchor: RespawnDestination | null = null;

  constructor(dependencies: RespawnManagerDependencies, options: RespawnManagerOptions) {
    this.dependencies = dependencies;
    this.fallbackSpawn = options.fallbackSpawn;
    this.fallbackRotationY = options.fallbackRotationY ?? 0;
    this.respawnDurationSeconds =
      options.respawnDurationSeconds ?? DEFAULT_RESPAWN_DURATION_SECONDS;
  }

  get currentState(): RespawnState {
    return this.state;
  }

  get isRespawning(): boolean {
    return this.state === "respawning";
  }

  getLastDestination(): RespawnDestination | null {
    return this.lastDestination;
  }

  /**
   * Sets a fall-only recovery anchor for exposed optional route sections. It
   * does not participate in checkpoints, speedrun splits, or preferred
   * checkpoint requests; passing `null` restores normal checkpoint recovery.
   */
  setEmergencyAnchor(destination: RespawnDestination | null): void {
    this.emergencyAnchor = destination
      ? { ...destination, position: { ...destination.position } }
      : null;
  }

  subscribe(listener: RespawnListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Starts recovery. Returns false when a recovery is already in progress.
   * Destinations fall back to the level's initial spawn point.
   */
  request(reason: RespawnReason, preferredCheckpointId?: string): boolean {
    if (this.state === "respawning") {
      return false;
    }

    const anchor = reason === "fall" ? this.emergencyAnchor : null;
    const checkpointDestination =
      anchor ?? this.dependencies.checkpoints.resolveRespawnDestination(preferredCheckpointId);
    const destination = checkpointDestination ?? {
      checkpointId: "fallback",
      spawnPointId: "fallback",
      position: { ...this.fallbackSpawn },
      rotationY: this.fallbackRotationY,
    };
    const usedFallback = checkpointDestination === null;

    this.lastReason = reason;
    this.lastDestination = destination;
    this.lastUsedFallback = usedFallback;
    this.elapsedSeconds = 0;
    this.state = "respawning";

    this.dependencies.player.deactivate();
    this.dependencies.input.setEnabled(false);
    this.dependencies.player.teleportTo(destination.position);
    this.dependencies.camera.resetForRespawn(destination.rotationY);

    return true;
  }

  /** Advances the recovery lifecycle. Called once per fixed step while busy. */
  update(deltaSeconds: number): void {
    if (this.state !== "respawning" || deltaSeconds <= 0) {
      return;
    }

    this.elapsedSeconds += deltaSeconds;

    if (this.elapsedSeconds < this.respawnDurationSeconds) {
      return;
    }

    this.finish();
  }

  dispose(): void {
    this.listeners.clear();
  }

  private finish(): void {
    this.dependencies.player.activate();
    this.dependencies.input.setEnabled(true);
    this.state = "idle";

    const event: RespawnCompletionEvent = {
      reason: this.lastReason,
      destination: this.lastDestination,
      usedFallback: this.lastUsedFallback,
    };

    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error("[Glassline] A respawn listener failed.", error);
      }
    }
  }
}
