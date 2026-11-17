import type { LevelSpawnPointDefinition, SpawnPointType } from "./LevelTypes";

export interface RuntimeSpawnPoint extends LevelSpawnPointDefinition {
  readonly enabled: boolean;
}

export interface SpawnResolutionContext {
  /** Explicit spawn point selected by the checkpoint or transition system. */
  readonly spawnPointId?: string;
  /** Current level section. */
  readonly sectionId?: string;
  /** Last-resort spawn point (usually the level initial spawn). */
  readonly fallbackSpawnPointId?: string;
}

const SECTION_PRIORITY: readonly SpawnPointType[] = [
  "respawn",
  "checkpoint",
  "training",
  "transition",
  "initial",
];

/**
 * Registers and resolves level spawn points (`docs/15` §9).
 *
 * It validates spawn identity, section ownership, and enabled state. It does not
 * move the player or execute recovery; those are Movement/Respawn responsibilities.
 */
export class SpawnPointManager {
  private readonly spawnPoints = new Map<string, RuntimeSpawnPoint>();
  private readonly initialSpawnPointId: string;

  constructor(initialSpawnPointId: string) {
    this.initialSpawnPointId = initialSpawnPointId;
  }

  register(spawnPoint: LevelSpawnPointDefinition): void {
    if (this.spawnPoints.has(spawnPoint.id)) {
      throw new Error(`Spawn point "${spawnPoint.id}" is already registered.`);
    }

    this.spawnPoints.set(spawnPoint.id, {
      ...spawnPoint,
      enabled: spawnPoint.enabled ?? true,
    });
  }

  unregister(spawnPointId: string): void {
    this.spawnPoints.delete(spawnPointId);
  }

  get(spawnPointId: string): RuntimeSpawnPoint | null {
    return this.spawnPoints.get(spawnPointId) ?? null;
  }

  getInitialSpawnPoint(): RuntimeSpawnPoint | null {
    return this.get(this.initialSpawnPointId);
  }

  getSpawnPointForSection(sectionId: string): RuntimeSpawnPoint | null {
    const candidates = [...this.spawnPoints.values()].filter(
      (spawnPoint) => spawnPoint.sectionId === sectionId && spawnPoint.enabled,
    );

    for (const type of SECTION_PRIORITY) {
      const match = candidates.find((spawnPoint) => spawnPoint.type === type);

      if (match) {
        return match;
      }
    }

    return candidates[0] ?? null;
  }

  /** Priority: explicit spawn → current section spawn → level initial spawn. */
  resolveSpawnPoint(context: SpawnResolutionContext = {}): RuntimeSpawnPoint | null {
    if (context.spawnPointId) {
      const explicit = this.spawnPoints.get(context.spawnPointId);

      if (explicit?.enabled) {
        return explicit;
      }
    }

    if (context.sectionId) {
      const sectionSpawn = this.getSpawnPointForSection(context.sectionId);

      if (sectionSpawn) {
        return sectionSpawn;
      }
    }

    const fallback = context.fallbackSpawnPointId
      ? this.spawnPoints.get(context.fallbackSpawnPointId)
      : null;

    if (fallback?.enabled) {
      return fallback;
    }

    return this.getInitialSpawnPoint();
  }

  setEnabled(spawnPointId: string, enabled: boolean): void {
    const spawnPoint = this.spawnPoints.get(spawnPointId);

    if (spawnPoint) {
      this.spawnPoints.set(spawnPointId, { ...spawnPoint, enabled });
    }
  }

  getAll(): readonly RuntimeSpawnPoint[] {
    return [...this.spawnPoints.values()];
  }

  getCount(): number {
    return this.spawnPoints.size;
  }

  clear(): void {
    this.spawnPoints.clear();
  }
}
