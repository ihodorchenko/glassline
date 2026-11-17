import type { Disposable } from "../core/Disposable";
import type { Vector3Like } from "../shared/math";

export interface CheckpointTrigger {
  readonly center: Vector3Like;
  readonly halfExtents: Vector3Like;
}

export interface CheckpointDefinition {
  readonly id: string;
  readonly sectionId: string;
  readonly displayName: string;
  readonly trigger: CheckpointTrigger;
  readonly spawnPointId: string;
  readonly respawnEnabled: boolean;
}

export interface SpawnPointDefinition {
  readonly id: string;
  readonly position: Vector3Like;
  readonly rotationY: number;
}

export interface CheckpointActivatedEvent {
  readonly sessionId: string;
  readonly checkpointId: string;
  readonly sectionId: string;
  readonly spawnPointId: string;
  readonly timestamp: number;
  readonly activationIndex: number;
}

export interface CheckpointProgressSnapshot {
  readonly sessionId: string;
  readonly activeCheckpointId: string | null;
  readonly activatedCheckpointIds: readonly string[];
  readonly revision: number;
}

export interface RespawnDestination {
  readonly checkpointId: string;
  readonly spawnPointId: string;
  readonly position: Vector3Like;
  readonly rotationY: number;
}

export type CheckpointListener = (event: CheckpointActivatedEvent) => void;

function contains(trigger: CheckpointTrigger, position: Vector3Like): boolean {
  return (
    Math.abs(position.x - trigger.center.x) <= trigger.halfExtents.x &&
    Math.abs(position.y - trigger.center.y) <= trigger.halfExtents.y &&
    Math.abs(position.z - trigger.center.z) <= trigger.halfExtents.z
  );
}

/**
 * Owns checkpoint definitions, deterministic activation order, session-scoped
 * progress, and respawn destination resolution.
 *
 * It does not orchestrate player recovery; `RespawnManager` owns that lifecycle
 * (`docs/16_CHECKPOINT_SYSTEM_SPEC.md`).
 */
export class CheckpointSystem implements Disposable {
  private readonly definitions: readonly CheckpointDefinition[];
  private readonly spawnPoints = new Map<string, SpawnPointDefinition>();
  private readonly initialSpawnPointId: string;
  private readonly listeners = new Set<CheckpointListener>();
  private readonly activatedCheckpointIds: string[] = [];

  private sessionId: string;
  private activeCheckpointId: string | null = null;
  private revision = 0;

  constructor(
    definitions: readonly CheckpointDefinition[],
    spawnPoints: readonly SpawnPointDefinition[],
    initialSpawnPointId: string,
    sessionId = "local-session",
  ) {
    this.definitions = [...definitions];
    this.sessionId = sessionId;
    this.initialSpawnPointId = initialSpawnPointId;

    const seenCheckpointIds = new Set<string>();

    for (const spawnPoint of spawnPoints) {
      this.spawnPoints.set(spawnPoint.id, spawnPoint);
    }

    for (const definition of this.definitions) {
      if (seenCheckpointIds.has(definition.id)) {
        throw new Error(`Duplicate checkpoint id "${definition.id}".`);
      }

      seenCheckpointIds.add(definition.id);

      if (!this.spawnPoints.has(definition.spawnPointId)) {
        throw new Error(
          `Checkpoint "${definition.id}" references missing spawn point "${definition.spawnPointId}".`,
        );
      }
    }

    if (!this.spawnPoints.has(initialSpawnPointId)) {
      throw new Error(`Initial spawn point "${initialSpawnPointId}" is not registered.`);
    }
  }

  getSnapshot(): CheckpointProgressSnapshot {
    return {
      sessionId: this.sessionId,
      activeCheckpointId: this.activeCheckpointId,
      activatedCheckpointIds: [...this.activatedCheckpointIds],
      revision: this.revision,
    };
  }

  getActiveCheckpointId(): string | null {
    return this.activeCheckpointId;
  }

  getInitialSpawnPoint(): SpawnPointDefinition | undefined {
    return this.spawnPoints.get(this.initialSpawnPointId);
  }

  /**
   * Activates at most one checkpoint per call, in definition order.
   * Deterministic for the same player position and progress state.
   */
  update(playerPosition: Vector3Like, timestampMs: number): CheckpointActivatedEvent | null {
    for (const definition of this.definitions) {
      if (
        this.activatedCheckpointIds.includes(definition.id) ||
        !contains(definition.trigger, playerPosition)
      ) {
        continue;
      }

      this.activatedCheckpointIds.push(definition.id);
      this.activeCheckpointId = definition.id;
      this.revision += 1;

      const event: CheckpointActivatedEvent = {
        sessionId: this.sessionId,
        checkpointId: definition.id,
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

    return null;
  }

  resolveRespawnDestination(preferredCheckpointId?: string): RespawnDestination | null {
    const checkpointId = preferredCheckpointId ?? this.activeCheckpointId;

    if (!checkpointId || !this.activatedCheckpointIds.includes(checkpointId)) {
      return null;
    }

    const definition = this.definitions.find((candidate) => candidate.id === checkpointId);

    if (!definition || !definition.respawnEnabled) {
      return null;
    }

    const spawnPoint = this.spawnPoints.get(definition.spawnPointId);

    if (!spawnPoint) {
      return null;
    }

    return {
      checkpointId: definition.id,
      spawnPointId: spawnPoint.id,
      position: { ...spawnPoint.position },
      rotationY: spawnPoint.rotationY,
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
