/** Authored level definitions consumed by the Level Runtime (`docs/15`). */

export type GameMode = "training" | "prologue";

export type SurfaceType = "concrete" | "metal" | "rubber" | "glass" | "asphalt";

export type SpawnPointType = "initial" | "checkpoint" | "respawn" | "training" | "transition";

export type LevelTriggerType =
  | "section-entry"
  | "section-exit"
  | "level-transition"
  | "checkpoint"
  | "training"
  | "generic";

export type SectionActivationPolicy = "automatic" | "triggered" | "manual";

export interface LevelVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface LevelBounds {
  readonly center: LevelVector3;
  readonly halfExtents: LevelVector3;
}

export interface LevelMetadata {
  readonly description?: string;
  readonly difficulty?: string;
  readonly estimatedDurationSeconds?: number;
  readonly supportsSpeedrun: boolean;
  readonly supportsRespawn: boolean;
}

/** Semantic surface metadata for traversal (see `docs/02` §9.6 and `docs/06` §3.4). */
export interface LevelSurfaceDefinition {
  readonly id: string;
  readonly sectionId: string;
  readonly surfaceType: SurfaceType;
  readonly walkable: boolean;
  readonly landingSurface: boolean;
  readonly wallRunSurface: boolean;
  readonly wallJumpSurface: boolean;
  readonly vaultObstacle: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LevelGeometryDefinition {
  readonly id: string;
  readonly sectionId: string;
  readonly position: LevelVector3;
  readonly size: LevelVector3;
  /** References a `LevelSurfaceDefinition.id`. */
  readonly surfaceId: string;
  readonly color?: number;
}

export interface LevelSpawnPointDefinition {
  readonly id: string;
  readonly sectionId: string;
  readonly position: LevelVector3;
  /** Yaw in radians. */
  readonly rotationY: number;
  readonly type: SpawnPointType;
  readonly enabled?: boolean;
}

export interface LevelTriggerMetadata {
  /** Destination section for `section-entry` / `section-exit` triggers. */
  readonly targetSectionId?: string;
  /** Checkpoint runtime id interpreted by the Checkpoint System. */
  readonly checkpointId?: string;
  /** Semantic level marker such as `kill-volume` or `out-of-bounds`. */
  readonly kind?: string;
}

export interface LevelTriggerDefinition {
  readonly id: string;
  readonly sectionId: string;
  readonly type: LevelTriggerType;
  readonly center: LevelVector3;
  readonly halfExtents: LevelVector3;
  readonly enabled?: boolean;
  readonly repeatable?: boolean;
  readonly metadata?: LevelTriggerMetadata;
}

/** Authored checkpoint data. Runtime progress belongs to the Checkpoint System. */
export interface AuthoredCheckpointDefinition {
  readonly id: string;
  readonly sectionId: string;
  readonly triggerId: string;
  readonly spawnPointId: string;
  readonly displayName: string;
  readonly activationMode?: "automatic" | "interaction" | "scripted";
  readonly enabled?: boolean;
  readonly repeatable?: boolean;
  readonly respawnEnabled?: boolean;
  readonly order?: number;
}

export interface LevelInteractionTargetDefinition {
  readonly id: string;
  readonly sectionId: string;
  readonly position: LevelVector3;
  readonly radius: number;
  readonly prompt: string;
  readonly enabled?: boolean;
}

export interface LevelSectionDefinition {
  readonly id: string;
  readonly order: number;
  readonly displayName: string;
  readonly entrySpawnPointId: string;
  readonly exitSpawnPointId?: string;
  readonly activationPolicy: SectionActivationPolicy;
  readonly nextSectionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LevelDefinition {
  readonly id: string;
  readonly version: string;
  readonly mode: GameMode;
  readonly displayName: string;
  readonly initialSpawnPointId: string;
  readonly sections: readonly LevelSectionDefinition[];
  readonly spawnPoints: readonly LevelSpawnPointDefinition[];
  readonly triggers: readonly LevelTriggerDefinition[];
  readonly checkpoints: readonly AuthoredCheckpointDefinition[];
  readonly interactionTargets: readonly LevelInteractionTargetDefinition[];
  readonly geometry: readonly LevelGeometryDefinition[];
  readonly surfaces: readonly LevelSurfaceDefinition[];
  readonly metadata: LevelMetadata;
}
