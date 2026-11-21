/**
 * Architectural Kit — demonstration level definition.
 *
 * A dev-only review composition loaded through the existing Level Runtime (not
 * a gameplay level): one authored section, an initial spawn on the plaza, the
 * plaza deck as the only physical element, and a large visual architecture
 * layer built from the reusable kit modules.
 *
 * The level is registered only in development builds; the deterministic capture
 * boot (`?capture=1&level=architecture`) starts it for review screenshots.
 */

import type { LevelDefinition } from "../LevelTypes";
import {
  createKitDemoDecorations,
  createKitDemoGeometry,
  createKitDemoPlacements,
  createKitDemoSurfaces,
  KIT_DEMO_ENVIRONMENT,
  KIT_DEMO_SECTION_ID,
} from "./KitDemoLayout";

export const ARCHITECTURAL_KIT_DEMO_LEVEL_ID = "architectural_kit_demo";

/** Spawn on the plaza looking at the atrium / facade composition. */
const SPAWN_POSITION = { x: 10, y: 0.93, z: -26 } as const;
const SPAWN_ROTATION_Y = 0.92;

const SPAWN_POINT_ID = "sp_kit_initial";

export const ARCHITECTURAL_KIT_DEMO_LEVEL: LevelDefinition = {
  id: ARCHITECTURAL_KIT_DEMO_LEVEL_ID,
  version: "1.0.0",
  mode: "training",
  displayName: "Architectural Kit — Composition Study",
  initialSpawnPointId: SPAWN_POINT_ID,
  metadata: {
    description:
      "Review composition for the reusable Architectural Kit: facade wing, glazed atrium, east tower, skybridge, canopy and technical annex.",
    difficulty: "review",
    estimatedDurationSeconds: 0,
    supportsSpeedrun: false,
    supportsRespawn: true,
  },
  sections: [
    {
      id: KIT_DEMO_SECTION_ID,
      order: 0,
      displayName: "Kit Plaza",
      entrySpawnPointId: SPAWN_POINT_ID,
      activationPolicy: "automatic",
    },
  ],
  spawnPoints: [
    {
      id: SPAWN_POINT_ID,
      sectionId: KIT_DEMO_SECTION_ID,
      position: SPAWN_POSITION,
      rotationY: SPAWN_ROTATION_Y,
      type: "initial",
    },
  ],
  triggers: [],
  checkpoints: [],
  interactionTargets: [],
  surfaces: createKitDemoSurfaces(),
  geometry: createKitDemoGeometry(),
  decorations: createKitDemoDecorations(),
  architecture: createKitDemoPlacements(),
  environment: KIT_DEMO_ENVIRONMENT,
};

export const ARCHITECTURAL_KIT_DEMO_DEFINITIONS: readonly LevelDefinition[] = [
  ARCHITECTURAL_KIT_DEMO_LEVEL,
];
