import { DEFAULT_GAME_LOOP_CONFIG, type GameLoopConfig } from "../core/GameLoop";
import { DEFAULT_PHYSICS_OPTIONS, type PhysicsWorldOptions } from "../physics/PhysicsConfig";
import { DEFAULT_MOVEMENT_TUNING, type MovementTuning } from "../player/MovementTuning";
import type { RendererOptions } from "../rendering/Renderer";
import type { DatabaseOptions } from "../storage/Database";
import { DATABASE_NAME, DATABASE_VERSION } from "../storage/SaveSchema";

export interface CameraConfig {
  readonly fovDegrees: number;
  readonly nearPlane: number;
  readonly farPlane: number;
}

export interface ApplicationConfig {
  readonly appName: string;
  readonly appVersion: string;
  readonly canvasId: string;
  readonly gameLoop: GameLoopConfig;
  readonly renderer: RendererOptions;
  readonly camera: CameraConfig;
  readonly movement: MovementTuning;
  readonly physics: PhysicsWorldOptions;
  readonly storage: DatabaseOptions;
  readonly enableStatusOverlay: boolean;
}

export const DEFAULT_APPLICATION_CONFIG: ApplicationConfig = {
  appName: "Glassline",
  appVersion: "0.1.0",
  canvasId: "game-canvas",
  gameLoop: DEFAULT_GAME_LOOP_CONFIG,
  renderer: {
    antialias: true,
    maxPixelRatio: 2,
    shadowsEnabled: true,
  },
  camera: {
    fovDegrees: 75,
    nearPlane: 0.1,
    farPlane: 500,
  },
  movement: DEFAULT_MOVEMENT_TUNING,
  physics: DEFAULT_PHYSICS_OPTIONS,
  storage: {
    name: DATABASE_NAME,
    version: DATABASE_VERSION,
    openTimeoutMs: 3000,
  },
  enableStatusOverlay: true,
};
