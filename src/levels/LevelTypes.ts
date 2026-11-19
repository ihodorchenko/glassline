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

export type LevelDecorationShape = "box" | "cylinder" | "plane";

/** Semantic material family resolved by the renderer's procedural library. */
export type LevelMaterialType =
  | "white"
  | "concrete"
  | "roof"
  | "facade"
  | "glass"
  | "glass-far"
  | "metal"
  | "dark-metal"
  | "red"
  | "orange"
  | "rubber"
  | "asphalt"
  | "warm-light"
  | "cool-light"
  | "foliage"
  | "soil"
  | "stain"
  | "water"
  | "membrane";

/** Visual-only authored geometry; it never receives a physics collider. */
export interface LevelDecorationDefinition {
  readonly id: string;
  readonly sectionId: string;
  readonly shape: LevelDecorationShape;
  readonly position: LevelVector3;
  readonly size: LevelVector3;
  readonly color?: number;
  /** Text rendered on a `plane` sign surface. Lines are separated by `\n`. */
  readonly text?: string;
  readonly textColor?: number;
  readonly accentColor?: number;
  /** Semantic PBR material; falls back to the authored colour when omitted. */
  readonly material?: LevelMaterialType;
  readonly rotationX?: number;
  readonly rotationY?: number;
  readonly rotationZ?: number;
  readonly opacity?: number;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

/** Lighting, fog, and sky treatment applied while a level is loaded. */
export interface LevelEnvironmentDefinition {
  readonly skyColor: number;
  readonly fogColor: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly sunColor: number;
  readonly sunIntensity: number;
  readonly hemisphereIntensity: number;
  readonly zenithColor?: number;
  readonly horizonColor?: number;
  readonly groundColor?: number;
  readonly cloudColor?: number;
  readonly cloudShadowColor?: number;
  readonly cloudCover?: number;
  /** Sun azimuth in radians, 0 pointing down the route (-Z). */
  readonly sunAzimuth?: number;
  /** Sun elevation above the horizon in radians. */
  readonly sunElevation?: number;
}

export interface LevelGeometryDefinition {
  readonly id: string;
  readonly sectionId: string;
  readonly position: LevelVector3;
  readonly size: LevelVector3;
  /** References a `LevelSurfaceDefinition.id`. */
  readonly surfaceId: string;
  readonly color?: number;
  readonly material?: LevelMaterialType;
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
  readonly decorations?: readonly LevelDecorationDefinition[];
  readonly environment?: LevelEnvironmentDefinition;
  readonly metadata: LevelMetadata;
}
