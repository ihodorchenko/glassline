import type { LevelDefinition } from "../LevelTypes";
import { createPrologueDecorations, PROLOGUE_ENVIRONMENT } from "./ReleaseArenaPolish";
import { createArenaGeometry, createArenaSurfaces } from "./SharedArena";

export const PROLOGUE_TEST_LEVEL_ID = "prologue_test";

const SECTION_IDS = {
  rooftop: "sec_rooftop",
  industrial: "sec_industrial",
  construction: "sec_construction",
  skybridge: "sec_skybridge",
  finish: "sec_finish",
} as const;

const SURFACE_SECTIONS: Record<string, string> = {
  surface_concrete: SECTION_IDS.rooftop,
  surface_vault: SECTION_IDS.industrial,
  surface_step: SECTION_IDS.industrial,
  surface_boundary: SECTION_IDS.rooftop,
  surface_tunnel: SECTION_IDS.construction,
  surface_wallrun: SECTION_IDS.skybridge,
  surface_terminal: SECTION_IDS.finish,
  surface_marker: SECTION_IDS.skybridge,
};

function sectionForZ(z: number): string {
  if (z > 2) {
    return SECTION_IDS.rooftop;
  }

  if (z > -6) {
    return SECTION_IDS.industrial;
  }

  if (z > -10) {
    return SECTION_IDS.construction;
  }

  if (z > -16) {
    return SECTION_IDS.skybridge;
  }

  return SECTION_IDS.finish;
}

/**
 * Initial release Prologue route: five ordered sections with five mandatory
 * checkpoints, a finish trigger, and a dusk skyline presentation layer.
 */
export const PROLOGUE_TEST_LEVEL: LevelDefinition = {
  id: PROLOGUE_TEST_LEVEL_ID,
  version: "1.2.0",
  mode: "prologue",
  displayName: "Prologue — Rooftop Run",
  initialSpawnPointId: "sp_initial",
  metadata: {
    description: "Rooftop Run: the five-section initial Prologue route.",
    difficulty: "test",
    supportsSpeedrun: true,
    supportsRespawn: true,
  },
  sections: [
    {
      id: SECTION_IDS.rooftop,
      order: 0,
      displayName: "Rooftop",
      entrySpawnPointId: "sp_initial",
      activationPolicy: "automatic",
      nextSectionId: SECTION_IDS.industrial,
    },
    {
      id: SECTION_IDS.industrial,
      order: 1,
      displayName: "Industrial",
      entrySpawnPointId: "sp_entry_industrial",
      activationPolicy: "automatic",
      nextSectionId: SECTION_IDS.construction,
    },
    {
      id: SECTION_IDS.construction,
      order: 2,
      displayName: "Construction",
      entrySpawnPointId: "sp_entry_construction",
      activationPolicy: "automatic",
      nextSectionId: SECTION_IDS.skybridge,
    },
    {
      id: SECTION_IDS.skybridge,
      order: 3,
      displayName: "Skybridge",
      entrySpawnPointId: "sp_entry_skybridge",
      activationPolicy: "automatic",
      nextSectionId: SECTION_IDS.finish,
    },
    {
      id: SECTION_IDS.finish,
      order: 4,
      displayName: "Finish",
      entrySpawnPointId: "sp_entry_finish",
      activationPolicy: "automatic",
    },
  ],
  spawnPoints: [
    {
      id: "sp_initial",
      sectionId: SECTION_IDS.rooftop,
      position: { x: 0, y: 0.93, z: 6 },
      rotationY: 0,
      type: "initial",
    },
    {
      id: "sp_cp_rooftop",
      sectionId: SECTION_IDS.rooftop,
      position: { x: 0, y: 0.93, z: 3 },
      rotationY: 0,
      type: "checkpoint",
    },
    {
      id: "sp_entry_industrial",
      sectionId: SECTION_IDS.industrial,
      position: { x: 0, y: 0.93, z: 1.5 },
      rotationY: 0,
      type: "transition",
    },
    {
      id: "sp_cp_industrial",
      sectionId: SECTION_IDS.industrial,
      position: { x: 0, y: 0.93, z: -2.5 },
      rotationY: 0,
      type: "checkpoint",
    },
    {
      id: "sp_entry_construction",
      sectionId: SECTION_IDS.construction,
      position: { x: 0, y: 0.93, z: -6.2 },
      rotationY: 0,
      type: "transition",
    },
    {
      id: "sp_cp_construction",
      sectionId: SECTION_IDS.construction,
      position: { x: 0, y: 0.93, z: -8.5 },
      rotationY: 0,
      type: "checkpoint",
    },
    {
      id: "sp_entry_skybridge",
      sectionId: SECTION_IDS.skybridge,
      position: { x: 0, y: 0.93, z: -10.2 },
      rotationY: 0,
      type: "transition",
    },
    {
      id: "sp_cp_skybridge",
      sectionId: SECTION_IDS.skybridge,
      position: { x: 0, y: 0.93, z: -14.5 },
      rotationY: 0,
      type: "checkpoint",
    },
    {
      id: "sp_entry_finish",
      sectionId: SECTION_IDS.finish,
      position: { x: 0, y: 0.93, z: -16.2 },
      rotationY: 0,
      type: "transition",
    },
    {
      id: "sp_cp_finish",
      sectionId: SECTION_IDS.finish,
      position: { x: 0, y: 0.93, z: -18.5 },
      rotationY: 0,
      type: "checkpoint",
    },
  ],
  triggers: [
    {
      id: "trigger_kill_volume",
      sectionId: SECTION_IDS.rooftop,
      type: "generic",
      center: { x: 11, y: -4, z: 5 },
      halfExtents: { x: 3, y: 1.5, z: 3 },
      repeatable: true,
      metadata: { kind: "kill-volume" },
    },
    {
      id: "trigger_to_industrial",
      sectionId: SECTION_IDS.rooftop,
      type: "section-entry",
      center: { x: 0, y: 1, z: 2 },
      halfExtents: { x: 12, y: 2, z: 0.6 },
      repeatable: true,
      metadata: { targetSectionId: SECTION_IDS.industrial },
    },
    {
      id: "trigger_to_construction",
      sectionId: SECTION_IDS.industrial,
      type: "section-entry",
      center: { x: 0, y: 1, z: -6 },
      halfExtents: { x: 12, y: 2, z: 0.6 },
      repeatable: true,
      metadata: { targetSectionId: SECTION_IDS.construction },
    },
    {
      id: "trigger_to_skybridge",
      sectionId: SECTION_IDS.construction,
      type: "section-entry",
      center: { x: 0, y: 1, z: -10 },
      halfExtents: { x: 12, y: 2, z: 0.6 },
      repeatable: true,
      metadata: { targetSectionId: SECTION_IDS.skybridge },
    },
    {
      id: "trigger_to_finish",
      sectionId: SECTION_IDS.skybridge,
      type: "section-entry",
      center: { x: 0, y: 1, z: -16 },
      halfExtents: { x: 12, y: 2, z: 0.6 },
      repeatable: true,
      metadata: { targetSectionId: SECTION_IDS.finish },
    },
    {
      id: "trigger_finish",
      sectionId: SECTION_IDS.finish,
      type: "level-transition",
      center: { x: 0, y: 1, z: -19.5 },
      halfExtents: { x: 4, y: 2, z: 0.6 },
      repeatable: false,
      metadata: { kind: "finish" },
    },
    {
      id: "trigger_cp_rooftop",
      sectionId: SECTION_IDS.rooftop,
      type: "checkpoint",
      center: { x: 0, y: 1, z: 3 },
      halfExtents: { x: 3, y: 1.5, z: 2 },
      repeatable: true,
      metadata: { checkpointId: "cp_rooftop" },
    },
    {
      id: "trigger_cp_industrial",
      sectionId: SECTION_IDS.industrial,
      type: "checkpoint",
      center: { x: 0, y: 1, z: -2.5 },
      halfExtents: { x: 3, y: 1.5, z: 2 },
      repeatable: true,
      metadata: { checkpointId: "cp_industrial" },
    },
    {
      id: "trigger_cp_construction",
      sectionId: SECTION_IDS.construction,
      type: "checkpoint",
      center: { x: 0, y: 1, z: -8.5 },
      halfExtents: { x: 3, y: 1.5, z: 2 },
      repeatable: true,
      metadata: { checkpointId: "cp_construction" },
    },
    {
      id: "trigger_cp_skybridge",
      sectionId: SECTION_IDS.skybridge,
      type: "checkpoint",
      center: { x: 0, y: 1, z: -14.5 },
      halfExtents: { x: 3, y: 1.5, z: 2 },
      repeatable: true,
      metadata: { checkpointId: "cp_skybridge" },
    },
    {
      id: "trigger_cp_finish",
      sectionId: SECTION_IDS.finish,
      type: "checkpoint",
      center: { x: 0, y: 1, z: -18.5 },
      halfExtents: { x: 3, y: 1.5, z: 2 },
      repeatable: true,
      metadata: { checkpointId: "cp_finish" },
    },
  ],
  checkpoints: [
    {
      id: "cp_rooftop",
      sectionId: SECTION_IDS.rooftop,
      triggerId: "trigger_cp_rooftop",
      spawnPointId: "sp_cp_rooftop",
      displayName: "Rooftop Checkpoint",
      activationMode: "automatic",
      enabled: true,
      repeatable: true,
      respawnEnabled: true,
      order: 0,
    },
    {
      id: "cp_industrial",
      sectionId: SECTION_IDS.industrial,
      triggerId: "trigger_cp_industrial",
      spawnPointId: "sp_cp_industrial",
      displayName: "Industrial Checkpoint",
      activationMode: "automatic",
      enabled: true,
      repeatable: true,
      respawnEnabled: true,
      order: 1,
    },
    {
      id: "cp_construction",
      sectionId: SECTION_IDS.construction,
      triggerId: "trigger_cp_construction",
      spawnPointId: "sp_cp_construction",
      displayName: "Construction Checkpoint",
      activationMode: "automatic",
      enabled: true,
      repeatable: true,
      respawnEnabled: true,
      order: 2,
    },
    {
      id: "cp_skybridge",
      sectionId: SECTION_IDS.skybridge,
      triggerId: "trigger_cp_skybridge",
      spawnPointId: "sp_cp_skybridge",
      displayName: "Skybridge Checkpoint",
      activationMode: "automatic",
      enabled: true,
      repeatable: true,
      respawnEnabled: true,
      order: 3,
    },
    {
      id: "cp_finish",
      sectionId: SECTION_IDS.finish,
      triggerId: "trigger_cp_finish",
      spawnPointId: "sp_cp_finish",
      displayName: "Finish Checkpoint",
      activationMode: "automatic",
      enabled: true,
      repeatable: true,
      respawnEnabled: true,
      order: 4,
    },
  ],
  interactionTargets: [
    {
      id: "test_terminal",
      sectionId: SECTION_IDS.finish,
      position: { x: 2.5, y: 1.2, z: -18 },
      radius: 2.5,
      prompt: "Press E to access the terminal",
      enabled: true,
    },
  ],
  surfaces: createArenaSurfaces((surfaceId) => SURFACE_SECTIONS[surfaceId] ?? SECTION_IDS.rooftop),
  geometry: createArenaGeometry((position) => sectionForZ(position.z)),
  decorations: createPrologueDecorations((z) => sectionForZ(z)),
  environment: PROLOGUE_ENVIRONMENT,
};

export const PROLOGUE_TEST_LEVEL_DEFINITIONS: readonly LevelDefinition[] = [PROLOGUE_TEST_LEVEL];
