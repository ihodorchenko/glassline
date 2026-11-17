import type { LevelDefinition } from "../LevelTypes";
import { createArenaGeometry, createArenaSurfaces } from "./SharedArena";

export const TRAINING_TEST_LEVEL_ID = "training_test";

const SURFACE_SECTIONS: Record<string, string> = {
  surface_concrete: "sec_start",
  surface_vault: "sec_start",
  surface_step: "sec_start",
  surface_boundary: "sec_start",
  surface_tunnel: "sec_traversal",
  surface_wallrun: "sec_traversal",
  surface_terminal: "sec_finish",
  surface_marker: "sec_traversal",
};

/**
 * Authored Training test level: three sections, checkpoints, fall pit, an
 * interaction terminal, and traversal test geometry.
 */
export const TRAINING_TEST_LEVEL: LevelDefinition = {
  id: TRAINING_TEST_LEVEL_ID,
  version: "1.1.0",
  mode: "training",
  displayName: "Runtime Test Range",
  initialSpawnPointId: "sp_initial",
  metadata: {
    description: "Training and traversal verification environment.",
    difficulty: "training",
    supportsSpeedrun: false,
    supportsRespawn: true,
  },
  sections: [
    {
      id: "sec_start",
      order: 0,
      displayName: "Start",
      entrySpawnPointId: "sp_initial",
      activationPolicy: "automatic",
      nextSectionId: "sec_traversal",
    },
    {
      id: "sec_traversal",
      order: 1,
      displayName: "Traversal",
      entrySpawnPointId: "sp_entry_traversal",
      activationPolicy: "automatic",
      nextSectionId: "sec_finish",
    },
    {
      id: "sec_finish",
      order: 2,
      displayName: "Finish",
      entrySpawnPointId: "sp_entry_finish",
      activationPolicy: "automatic",
    },
  ],
  spawnPoints: [
    {
      id: "sp_initial",
      sectionId: "sec_start",
      position: { x: 0, y: 0.93, z: 6 },
      rotationY: 0,
      type: "initial",
    },
    {
      id: "sp_cp_01",
      sectionId: "sec_start",
      position: { x: 0, y: 0.93, z: 3 },
      rotationY: 0,
      type: "checkpoint",
    },
    {
      id: "sp_entry_traversal",
      sectionId: "sec_traversal",
      position: { x: 0, y: 0.93, z: -2 },
      rotationY: 0,
      type: "transition",
    },
    {
      id: "sp_cp_02",
      sectionId: "sec_traversal",
      position: { x: 0, y: 0.93, z: -4 },
      rotationY: 0,
      type: "checkpoint",
    },
    {
      id: "sp_entry_finish",
      sectionId: "sec_finish",
      position: { x: 0, y: 0.93, z: -17 },
      rotationY: 0,
      type: "transition",
    },
    {
      id: "sp_cp_03",
      sectionId: "sec_finish",
      position: { x: 0, y: 0.93, z: -18.5 },
      rotationY: 0,
      type: "checkpoint",
    },
  ],
  triggers: [
    {
      id: "trigger_kill_volume",
      sectionId: "sec_start",
      type: "generic",
      center: { x: 11, y: -4, z: 5 },
      halfExtents: { x: 3, y: 1.5, z: 3 },
      repeatable: true,
      metadata: { kind: "kill-volume" },
    },
    {
      id: "trigger_to_traversal",
      sectionId: "sec_start",
      type: "section-entry",
      center: { x: 0, y: 1, z: -1.5 },
      halfExtents: { x: 12, y: 2, z: 0.5 },
      repeatable: true,
      metadata: { targetSectionId: "sec_traversal" },
    },
    {
      id: "trigger_to_finish",
      sectionId: "sec_traversal",
      type: "section-entry",
      center: { x: 0, y: 1, z: -16.5 },
      halfExtents: { x: 12, y: 2, z: 0.5 },
      repeatable: true,
      metadata: { targetSectionId: "sec_finish" },
    },
    {
      id: "trigger_cp_rooftop",
      sectionId: "sec_start",
      type: "checkpoint",
      center: { x: 0, y: 1, z: 3 },
      halfExtents: { x: 3, y: 1.5, z: 2 },
      repeatable: true,
      metadata: { checkpointId: "cp_rooftop" },
    },
    {
      id: "trigger_cp_industrial",
      sectionId: "sec_traversal",
      type: "checkpoint",
      center: { x: 0, y: 1, z: -4 },
      halfExtents: { x: 3, y: 1.5, z: 2 },
      repeatable: true,
      metadata: { checkpointId: "cp_industrial" },
    },
    {
      id: "trigger_cp_skybridge",
      sectionId: "sec_finish",
      type: "checkpoint",
      center: { x: 0, y: 1, z: -18.5 },
      halfExtents: { x: 3, y: 1.5, z: 2 },
      repeatable: true,
      metadata: { checkpointId: "cp_skybridge" },
    },
  ],
  checkpoints: [
    {
      id: "cp_rooftop",
      sectionId: "sec_start",
      triggerId: "trigger_cp_rooftop",
      spawnPointId: "sp_cp_01",
      displayName: "Rooftop",
      activationMode: "automatic",
      enabled: true,
      repeatable: true,
      respawnEnabled: true,
      order: 0,
    },
    {
      id: "cp_industrial",
      sectionId: "sec_traversal",
      triggerId: "trigger_cp_industrial",
      spawnPointId: "sp_cp_02",
      displayName: "Industrial",
      activationMode: "automatic",
      enabled: true,
      repeatable: true,
      respawnEnabled: true,
      order: 1,
    },
    {
      id: "cp_skybridge",
      sectionId: "sec_finish",
      triggerId: "trigger_cp_skybridge",
      spawnPointId: "sp_cp_03",
      displayName: "Skybridge",
      activationMode: "automatic",
      enabled: true,
      repeatable: true,
      respawnEnabled: true,
      order: 2,
    },
  ],
  interactionTargets: [
    {
      id: "test_terminal",
      sectionId: "sec_finish",
      position: { x: 2.5, y: 1.2, z: -18 },
      radius: 2.5,
      prompt: "Press E to access the terminal",
      enabled: true,
    },
  ],
  surfaces: createArenaSurfaces((surfaceId) => SURFACE_SECTIONS[surfaceId] ?? "sec_start"),
  geometry: createArenaGeometry((position) =>
    position.z > 0 ? "sec_start" : position.z <= -16 ? "sec_finish" : "sec_traversal",
  ),
};

export const TRAINING_TEST_LEVEL_DEFINITIONS: readonly LevelDefinition[] = [TRAINING_TEST_LEVEL];
