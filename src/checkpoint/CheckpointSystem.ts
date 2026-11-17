import type { Disposable } from "../core/Disposable";
import type { Vector3Like } from "../shared/math";

/** Runtime checkpoint definition owned by level content and interpreted here (`docs/16` §6.1). */
export interface CheckpointDefinition {
  readonly id: string;
  readonly levelId: string;
  readonly sectionId: string;
  readonly spawnPointId: string;
  readonly displayName: string;
  readonly activationMode?: "automatic" | "interaction" | "scripted";
  readonly enabled?: boolean;
  readonly repeatable?: boolean;
  readonly respawnEnabled?: boolean;
  readonly order?: number;
}

/** Resolves a Level Runtime spawn point into a placement transform (`docs/16` §11.2). */
export interface CheckpointSpawnResolver {
  resolve(spawnPointId: string): {
    readonly position: Vector3Like;
    readonly rotationY: number;
  } | null;
}

export interface CheckpointSystemOptions {
  readonly levelId: string;
  readonly sessionId: string;
  readonly spawnResolver: CheckpointSpawnResolver;
}

export interface CheckpointActivatedEvent {
  readonly sessionId: string;
  readonly levelId: string;
  readonly checkpointId: string;
  readonly sectionId: string;
  readonly spawnPointId: string;
  readonly timestamp: number;
  readonly activationIndex: number;
}

export interface CheckpointProgressSnapshot {
  readonly sessionId: string;
  readonly levelId: string;
  readonly activeCheckpointId: string | null;
  readonly activatedCheckpointIds: readonly string[];
  readonly revision: number;
}

/** Destination data consumed by `RespawnManager` through its adapter contract. */
export interface RespawnDestination {
  readonly checkpointId: string;
  readonly spawnPointId: string;
  readonly position: Vector3Like;
  readonly rotationY: number;
}

export type CheckpointListener = (event: CheckpointActivatedEvent) => void;

/**
 * Owns checkpoint activation, session-scoped progress, and respawn destination
 * selection (`docs/16`).
 *
 * Level Runtime owns trigger detection and spawn resolution; this system turns
 * validated trigger signals into checkpoint progress.
 */
export class CheckpointSystem implements Disposable {
  private readonly definitions = new Map<string, CheckpointDefinition>();
  private readonly levelId: string;
  private readonly spawnResolver: CheckpointSpawnResolver;
  private sessionId: string;
  private readonly listeners = new Set<CheckpointListener>();
  private readonly activatedCheckpointIds: string[] = [];

  private activeCheckpointId: string | null = null;
  private revision = 0;

  constructor(definitions: readonly CheckpointDefinition[], options: CheckpointSystemOptions) {
    this.levelId = options.levelId;
    this.sessionId = options.sessionId;
    this.spawnResolver = options.spawnResolver;

    for (const definition of definitions) {
      if (this.definitions.has(definition.id)) {
        throw new Error(`Duplicate checkpoint id "${definition.id}".`);
      }

      if (definition.levelId !== options.levelId) {
        throw new Error(
          `Checkpoint "${definition.id}" belongs to level "${definition.levelId}", expected "${options.levelId}".`,
        );
      }

      this.definitions.set(definition.id, {
        ...definition,
        activationMode: definition.activationMode ?? "automatic",
        enabled: definition.enabled ?? true,
        repeatable: definition.repeatable ?? true,
        respawnEnabled: definition.respawnEnabled ?? true,
      });
    }
  }

  getSnapshot(): CheckpointProgressSnapshot {
    return {
      sessionId: this.sessionId,
      levelId: this.levelId,
      activeCheckpointId: this.activeCheckpointId,
      activatedCheckpointIds: [...this.activatedCheckpointIds],
      revision: this.revision,
    };
  }

  getActiveCheckpointId(): string | null {
    return this.activeCheckpointId;
  }

  getDefinition(checkpointId: string): CheckpointDefinition | null {
    return this.definitions.get(checkpointId) ?? null;
  }

  /**
   * Handles a validated trigger signal from Level Runtime.
   * Returns the activation event, or null for duplicate/disabled/invalid requests.
   */
  notifyTriggerEnter(checkpointId: string, timestampMs: number): CheckpointActivatedEvent | null {
    const definition = this.definitions.get(checkpointId);

    if (!definition || definition.enabled === false) {
      return null;
    }

    if (definition.activationMode !== "automatic") {
      return null;
    }

    if (this.activatedCheckpointIds.includes(checkpointId)) {
      return null;
    }

    if (!this.spawnResolver.resolve(definition.spawnPointId)) {
      console.warn(
        `[Glassline] Checkpoint "${checkpointId}" was ignored: spawn point "${definition.spawnPointId}" is unavailable.`,
      );

      return null;
    }

    this.activatedCheckpointIds.push(checkpointId);
    this.activeCheckpointId = checkpointId;
    this.revision += 1;

    const event: CheckpointActivatedEvent = {
      sessionId: this.sessionId,
      levelId: this.levelId,
      checkpointId,
      sectionId: definition.sectionId,
      spawnPointId: definition.spawnPointId,
      timestamp: timestampMs,
      activationIndex: this.activatedCheckpointIds.length - 1,
    };

    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error("[Glassline] A checkpoint listener failed.", error);
      }
    }

    return event;
  }

  /** Resolves the active (or explicitly preferred activated) destination. */
  resolveRespawnDestination(preferredCheckpointId?: string): RespawnDestination | null {
    const checkpointId = preferredCheckpointId ?? this.activeCheckpointId;

    if (!checkpointId || !this.activatedCheckpointIds.includes(checkpointId)) {
      return null;
    }

    const definition = this.definitions.get(checkpointId);

    if (!definition || definition.enabled === false || definition.respawnEnabled === false) {
      return null;
    }

    const spawn = this.spawnResolver.resolve(definition.spawnPointId);

    if (!spawn) {
      return null;
    }

    return {
      checkpointId: definition.id,
      spawnPointId: definition.spawnPointId,
      position: { ...spawn.position },
      rotationY: spawn.rotationY,
    };
  }

  reset(sessionId = this.sessionId): void {
    this.sessionId = sessionId;
    this.activeCheckpointId = null;
    this.activatedCheckpointIds.length = 0;
    this.revision += 1;
  }

  subscribe(listener: CheckpointListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
  }
}
