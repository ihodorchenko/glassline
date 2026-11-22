import { readFileSync } from "node:fs";
import type * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";

import { architecturalModuleKey } from "../../src/levels/architecture/ArchitecturalKit";
import { KIT_DEMO_ENVIRONMENT } from "../../src/levels/demo/KitDemoLayout";
import { FIRST_SECTION_ARCHITECTURE } from "../../src/levels/first-section/FirstSectionArchitecture";
import {
  createFirstSectionDecorations,
  FIRST_SECTION_CITY,
  FIRST_SECTION_DECORATIONS,
  FIRST_SECTION_DRESSING,
} from "../../src/levels/first-section/FirstSectionCity";
import {
  FIRST_SECTION_LAYOUT,
  FIRST_SECTION_LAYOUT_ID,
  FIRST_SECTION_SECTION_IDS,
} from "../../src/levels/first-section/FirstSectionLayout";
import {
  FIRST_SECTION_LEVEL,
  FIRST_SECTION_LEVEL_DEFINITIONS,
} from "../../src/levels/first-section/FirstSectionLevel";
import { LevelRuntimeManager } from "../../src/levels/LevelRuntimeManager";
import type { LevelDecorationDefinition, LevelDefinition } from "../../src/levels/LevelTypes";
import { validateLevelDefinition } from "../../src/levels/LevelValidator";
import { PROLOGUE_TEST_LEVEL } from "../../src/levels/test/PrologueTestLevel";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import { RenderScene } from "../../src/rendering/RenderScene";

/**
 * Composed `FIRST_SECTION_LEVEL` (`FIRST_GAMEPLAY_SECTION_SPEC` §10 Q1,
 * §11.1, §11.4, §12 item 5).
 *
 * Composition assertions read the three authored layers directly instead of a
 * copied table, so the level cannot drift from them. Runtime assertions use the
 * existing `LevelRuntimeManager` / `BoxLevelContentLoader` lifecycle pattern to
 * pin that Kit and decoration content is collider-free and fully disposable.
 */

const LEVEL = FIRST_SECTION_LEVEL;
const LAYOUT = FIRST_SECTION_LAYOUT;

const SECTIONS_IN_ORDER = [
  FIRST_SECTION_SECTION_IDS.start,
  FIRST_SECTION_SECTION_IDS.buildingJump,
  FIRST_SECTION_SECTION_IDS.technical,
  FIRST_SECTION_SECTION_IDS.slide,
  FIRST_SECTION_SECTION_IDS.vault,
  FIRST_SECTION_SECTION_IDS.finish,
] as const;

/** §11.4 / `first-section-architecture.test.ts`: 13 variants → 55 batches. */
const KIT_INSTANCED_BATCHES = 55;

interface SceneMetrics {
  readonly children: number;
  readonly meshes: number;
  readonly instancedMeshes: number;
  readonly geometries: number;
  readonly materials: number;
}

interface Harness {
  readonly physics: PhysicsWorld;
  readonly scene: RenderScene;
  readonly runtime: LevelRuntimeManager;
}

const harnesses: Harness[] = [];

function sceneMetrics(scene: RenderScene): SceneMetrics {
  let meshes = 0;
  let instancedMeshes = 0;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  scene.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    meshes += 1;

    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      instancedMeshes += 1;
    }

    geometries.add(mesh.geometry);

    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        materials.add(material);
      }
    } else {
      materials.add(mesh.material);
    }
  });

  return {
    children: scene.scene.children.length,
    meshes,
    instancedMeshes,
    geometries: geometries.size,
    materials: materials.size,
  };
}

/**
 * Independent model of `BoxLevelContentLoader`'s decoration batching: an
 * opaque entry joins one instanced draw per `material + shape + castShadow`,
 * while every `plane` and every translucent entry gets its own regular mesh.
 */
function decorationDrawCalls(decorations: readonly LevelDecorationDefinition[]): {
  readonly instanced: number;
  readonly singles: number;
} {
  const batches = new Set<string>();
  let singles = 0;

  for (const decoration of decorations) {
    if (decoration.shape === "plane" || (decoration.opacity ?? 1) < 1) {
      singles += 1;
      continue;
    }

    const material = decoration.material ?? `color:${decoration.color ?? 0xffffff}`;

    batches.add(`${material}:${decoration.shape}:${(decoration.castShadow ?? true) ? "1" : "0"}`);
  }

  return { instanced: batches.size, singles };
}

function staticCollisionBatchCount(definition: LevelDefinition): number {
  const materials = new Set<string>();

  for (const geometry of definition.geometry) {
    materials.add(geometry.material ?? `surface:${geometry.surfaceId}`);
  }

  return materials.size;
}

async function createHarness(): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: 1 / 60,
  });

  await physics.initialize();

  const scene = new RenderScene();
  const runtime = new LevelRuntimeManager({
    scene,
    physics,
    definitions: FIRST_SECTION_LEVEL_DEFINITIONS,
  });
  const harness = { physics, scene, runtime };

  harnesses.push(harness);

  return harness;
}

afterEach(async () => {
  for (const harness of harnesses) {
    await harness.runtime.unloadLevel();
    harness.runtime.dispose();
    harness.scene.dispose();
    harness.physics.dispose();
  }

  harnesses.length = 0;
});

describe("First gameplay section composed level", () => {
  it("composes the authored layers without copying or mutating layout data", () => {
    expect(LEVEL.id).toBe(FIRST_SECTION_LAYOUT_ID);
    expect(LEVEL.id).toBe("first_section");
    expect(LEVEL.mode).toBe("prologue");
    expect(LEVEL.version).toBe(LAYOUT.version);
    expect(LEVEL.displayName).toBe(LAYOUT.displayName);
    expect(LEVEL.initialSpawnPointId).toBe(LAYOUT.initialSpawnPointId);

    // The spread must keep the authored object identity, not a copy.
    expect(LEVEL.metadata).toBe(LAYOUT.metadata);
    expect(LEVEL.sections).toBe(LAYOUT.sections);
    expect(LEVEL.spawnPoints).toBe(LAYOUT.spawnPoints);
    expect(LEVEL.triggers).toBe(LAYOUT.triggers);
    expect(LEVEL.checkpoints).toBe(LAYOUT.checkpoints);
    expect(LEVEL.interactionTargets).toBe(LAYOUT.interactionTargets);
    expect(LEVEL.surfaces).toBe(LAYOUT.surfaces);
    expect(LEVEL.geometry).toBe(LAYOUT.geometry);

    expect(LEVEL.architecture).toBe(FIRST_SECTION_ARCHITECTURE);
    expect(LEVEL.decorations).toBe(FIRST_SECTION_DECORATIONS);
    expect(LEVEL.environment).toBe(KIT_DEMO_ENVIRONMENT);
    expect(FIRST_SECTION_LEVEL_DEFINITIONS).toEqual([LEVEL]);

    expect(LEVEL.metadata.supportsSpeedrun).toBe(false);
    expect(LEVEL.interactionTargets).toEqual([]);

    // Composing the level must not change the collision layer itself.
    expect(LAYOUT.mode).toBe("training");
  });

  it("declares six ordered sections with a complete next-section chain", () => {
    const ordered = [...LEVEL.sections].sort((left, right) => left.order - right.order);

    expect(ordered).toHaveLength(6);
    expect(ordered.map((section) => section.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ordered.map((section) => section.id)).toEqual([...SECTIONS_IN_ORDER]);

    for (let index = 0; index < ordered.length; index += 1) {
      const section = ordered[index];

      if (!section) {
        continue;
      }

      const next = ordered[index + 1];

      if (next) {
        expect(section.nextSectionId, section.id).toBe(next.id);
      } else {
        expect(section.nextSectionId, section.id).toBeUndefined();
      }
    }
  });

  it("keeps four checkpoints, six kill volumes, and one finish trigger", () => {
    expect(LEVEL.checkpoints).toHaveLength(4);
    expect(LEVEL.checkpoints.map((checkpoint) => checkpoint.order)).toEqual([0, 1, 2, 3]);

    const killVolumes = LEVEL.triggers.filter(
      (trigger) => trigger.metadata?.kind === "kill-volume",
    );

    expect(killVolumes).toHaveLength(6);
    expect(new Set(killVolumes.map((trigger) => trigger.sectionId))).toEqual(
      new Set(SECTIONS_IN_ORDER),
    );

    const finishTriggers = LEVEL.triggers.filter((trigger) => trigger.metadata?.kind === "finish");

    expect(finishTriggers).toHaveLength(1);
    expect(finishTriggers[0]?.id).toBe("trigger_finish");
    expect(finishTriggers[0]?.type).toBe("level-transition");
    expect(finishTriggers[0]?.repeatable).toBe(false);

    expect(LEVEL.interactionTargets).toHaveLength(0);
  });

  it("resolves every spawn, surface, trigger, and checkpoint reference", () => {
    const sectionIds = new Set(LEVEL.sections.map((section) => section.id));
    const spawnIds = new Set(LEVEL.spawnPoints.map((spawnPoint) => spawnPoint.id));
    const triggerIds = new Set(LEVEL.triggers.map((trigger) => trigger.id));
    const checkpointIds = new Set(LEVEL.checkpoints.map((checkpoint) => checkpoint.id));
    const surfaceIds = new Set(LEVEL.surfaces.map((surface) => surface.id));

    for (const section of LEVEL.sections) {
      expect(spawnIds.has(section.entrySpawnPointId), section.id).toBe(true);

      if (section.exitSpawnPointId) {
        expect(spawnIds.has(section.exitSpawnPointId), section.id).toBe(true);
      }

      if (section.nextSectionId) {
        expect(sectionIds.has(section.nextSectionId), section.id).toBe(true);
      }
    }

    for (const spawnPoint of LEVEL.spawnPoints) {
      expect(sectionIds.has(spawnPoint.sectionId), spawnPoint.id).toBe(true);
    }

    for (const geometry of LEVEL.geometry) {
      expect(sectionIds.has(geometry.sectionId), geometry.id).toBe(true);
      expect(surfaceIds.has(geometry.surfaceId), geometry.id).toBe(true);
    }

    for (const trigger of LEVEL.triggers) {
      expect(sectionIds.has(trigger.sectionId), trigger.id).toBe(true);

      const targetSectionId = trigger.metadata?.targetSectionId;

      if (targetSectionId) {
        expect(sectionIds.has(targetSectionId), trigger.id).toBe(true);
      }

      const checkpointId = trigger.metadata?.checkpointId;

      if (checkpointId) {
        expect(checkpointIds.has(checkpointId), trigger.id).toBe(true);
      }
    }

    for (const checkpoint of LEVEL.checkpoints) {
      expect(sectionIds.has(checkpoint.sectionId), checkpoint.id).toBe(true);
      expect(spawnIds.has(checkpoint.spawnPointId), checkpoint.id).toBe(true);
      expect(triggerIds.has(checkpoint.triggerId), checkpoint.id).toBe(true);
    }

    for (const placement of LEVEL.architecture ?? []) {
      expect(sectionIds.has(placement.sectionId), placement.id).toBe(true);
    }

    for (const decoration of LEVEL.decorations ?? []) {
      expect(sectionIds.has(decoration.sectionId), decoration.id).toBe(true);
    }

    // One namespace across every authored layer: no id ownership ambiguity.
    const allIds = [
      ...LEVEL.sections.map((item) => item.id),
      ...LEVEL.spawnPoints.map((item) => item.id),
      ...LEVEL.triggers.map((item) => item.id),
      ...LEVEL.checkpoints.map((item) => item.id),
      ...LEVEL.surfaces.map((item) => item.id),
      ...LEVEL.geometry.map((item) => item.id),
      ...(LEVEL.architecture ?? []).map((item) => item.id),
      ...(LEVEL.decorations ?? []).map((item) => item.id),
    ];

    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("attaches 52 Kit placements, 13 variants, and 678 decorations", () => {
    expect(LEVEL.architecture).toHaveLength(52);
    expect(
      new Set(
        (LEVEL.architecture ?? []).map((placement) => architecturalModuleKey(placement.module)),
      ).size,
    ).toBe(13);

    expect(LEVEL.decorations).toHaveLength(678);
    expect(FIRST_SECTION_DRESSING).toHaveLength(73);
    expect(FIRST_SECTION_CITY).toHaveLength(605);
    expect(FIRST_SECTION_DRESSING.length + FIRST_SECTION_CITY.length).toBe(678);
    expect(createFirstSectionDecorations()).toHaveLength(678);
  });

  it("uses the Kit demo daylight environment unchanged", () => {
    expect(LEVEL.environment).toEqual(KIT_DEMO_ENVIRONMENT);
    expect(LEVEL.environment?.skyColor).toBe(KIT_DEMO_ENVIRONMENT.skyColor);
    expect(LEVEL.environment?.fogFar).toBe(KIT_DEMO_ENVIRONMENT.fogFar);
    expect(LEVEL.environment?.sunIntensity).toBe(KIT_DEMO_ENVIRONMENT.sunIntensity);
  });

  it("does not let the three layers mutate each other", () => {
    const layoutSignature = JSON.stringify({
      sections: LAYOUT.sections,
      spawnPoints: LAYOUT.spawnPoints,
      triggers: LAYOUT.triggers,
      checkpoints: LAYOUT.checkpoints,
      interactionTargets: LAYOUT.interactionTargets,
      surfaces: LAYOUT.surfaces,
      geometry: LAYOUT.geometry,
      metadata: LAYOUT.metadata,
      mode: LAYOUT.mode,
    });
    const architectureSignature = JSON.stringify(FIRST_SECTION_ARCHITECTURE);
    const decorationSignature = JSON.stringify(FIRST_SECTION_DECORATIONS);

    for (let pass = 0; pass < 8; pass += 1) {
      createFirstSectionDecorations();
      validateLevelDefinition(LEVEL);
    }

    expect(
      JSON.stringify({
        sections: LAYOUT.sections,
        spawnPoints: LAYOUT.spawnPoints,
        triggers: LAYOUT.triggers,
        checkpoints: LAYOUT.checkpoints,
        interactionTargets: LAYOUT.interactionTargets,
        surfaces: LAYOUT.surfaces,
        geometry: LAYOUT.geometry,
        metadata: LAYOUT.metadata,
        mode: LAYOUT.mode,
      }),
    ).toBe(layoutSignature);
    expect(JSON.stringify(FIRST_SECTION_ARCHITECTURE)).toBe(architectureSignature);
    expect(JSON.stringify(FIRST_SECTION_DECORATIONS)).toBe(decorationSignature);
    expect(LAYOUT.mode).toBe("training");
    expect(LEVEL.mode).toBe("prologue");
  });
});

describe("First gameplay section validation", () => {
  it("validates with zero errors and zero warnings", () => {
    const result = validateLevelDefinition(LEVEL);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("keeps the five-section Prologue taxonomy mandatory for the authored Prologue", () => {
    const wrongCount: LevelDefinition = {
      ...PROLOGUE_TEST_LEVEL,
      sections: PROLOGUE_TEST_LEVEL.sections.slice(0, 4),
    };

    expect(
      validateLevelDefinition(wrongCount).errors.some(
        (error) => error.code === "PROLOGUE_SECTION_COUNT",
      ),
    ).toBe(true);

    const wrongName: LevelDefinition = {
      ...PROLOGUE_TEST_LEVEL,
      sections: PROLOGUE_TEST_LEVEL.sections.map((section, index) =>
        index === 2 ? { ...section, displayName: "Service Deck" } : section,
      ),
    };

    expect(
      validateLevelDefinition(wrongName).errors.some(
        (error) => error.code === "PROLOGUE_SECTION_ORDER",
      ),
    ).toBe(true);

    const brokenChain: LevelDefinition = {
      ...PROLOGUE_TEST_LEVEL,
      sections: PROLOGUE_TEST_LEVEL.sections.map((section, index) =>
        index === 1 ? { ...section, nextSectionId: "sec_wrong" } : section,
      ),
    };

    expect(
      validateLevelDefinition(brokenChain).errors.some(
        (error) => error.code === "PROLOGUE_SECTION_CHAIN",
      ),
    ).toBe(true);
  });

  it("still applies the general rules to the six-section level", () => {
    const missingCheckpointSpawn: LevelDefinition = {
      ...LEVEL,
      checkpoints: LEVEL.checkpoints.map((checkpoint) =>
        checkpoint.id === "cp_slide"
          ? { ...checkpoint, spawnPointId: "missing_spawn" }
          : checkpoint,
      ),
    };
    const missingResult = validateLevelDefinition(missingCheckpointSpawn);

    expect(missingResult.valid).toBe(false);
    expect(missingResult.errors.some((error) => error.code === "MISSING_CHECKPOINT_SPAWN")).toBe(
      true,
    );
    expect(missingResult.errors.some((error) => error.code.startsWith("PROLOGUE_"))).toBe(false);

    const unknownTriggerTarget: LevelDefinition = {
      ...LEVEL,
      triggers: LEVEL.triggers.map((trigger) =>
        trigger.id === "trigger_to_slide"
          ? { ...trigger, metadata: { targetSectionId: "missing_section" } }
          : trigger,
      ),
    };
    const triggerResult = validateLevelDefinition(unknownTriggerTarget);

    expect(triggerResult.valid).toBe(false);
    expect(
      triggerResult.errors.some((error) => error.code === "MISSING_TRIGGER_TARGET_SECTION"),
    ).toBe(true);
    expect(triggerResult.errors.some((error) => error.code.startsWith("PROLOGUE_"))).toBe(false);
  });
});

describe("First gameplay section runtime composition", () => {
  it("loads all three visual layers together with the collision geometry", async () => {
    const harness = await createHarness();
    const baseline = sceneMetrics(harness.scene);
    const baselineBodies = harness.physics.rapierWorld.bodies.len();
    const baselineColliders = harness.physics.rapierWorld.colliders.len();
    const session = await harness.runtime.loadLevel(FIRST_SECTION_LAYOUT_ID);
    const loaded = sceneMetrics(harness.scene);
    const decorationDraws = decorationDrawCalls(LEVEL.decorations ?? []);
    const collisionDraws = staticCollisionBatchCount(LEVEL);

    expect(session.state).toBe("ready");
    expect(session.mode).toBe("prologue");
    expect(harness.runtime.getCurrentLevel()?.id).toBe("first_section");
    expect(harness.runtime.getCurrentLevel()?.architecture).toHaveLength(52);
    expect(harness.runtime.getCurrentLevel()?.decorations).toHaveLength(678);
    expect(harness.runtime.getInitialSpawnPoint()?.id).toBe("sp_initial");

    const snapshot = harness.runtime.getSnapshot();

    expect(snapshot.objectSurfaceCount).toBe(LEVEL.geometry.length);
    expect(snapshot.spawnPointCount).toBe(LEVEL.spawnPoints.length);
    expect(snapshot.triggerCount).toBe(LEVEL.triggers.length);
    expect(snapshot.interactionTargetCount).toBe(0);
    expect(snapshot.sections).toHaveLength(6);

    // Collision: exactly one fixed body and collider per authored box.
    expect(harness.physics.rapierWorld.bodies.len()).toBe(baselineBodies + LEVEL.geometry.length);
    expect(harness.physics.rapierWorld.colliders.len()).toBe(
      baselineColliders + LEVEL.geometry.length,
    );

    // Visuals: merged collision batches, decoration batches, and Kit batches.
    expect(decorationDraws.instanced).toBe(14);
    expect(decorationDraws.singles).toBe(2);
    expect(decorationDraws.instanced + decorationDraws.singles).toBe(16);
    expect(collisionDraws).toBe(5);
    expect(loaded.instancedMeshes - baseline.instancedMeshes).toBe(
      KIT_INSTANCED_BATCHES + decorationDraws.instanced,
    );
    expect(loaded.meshes - baseline.meshes).toBe(
      collisionDraws + KIT_INSTANCED_BATCHES + decorationDraws.instanced + decorationDraws.singles,
    );
    expect(loaded.children - baseline.children).toBe(
      collisionDraws + KIT_INSTANCED_BATCHES + decorationDraws.instanced + decorationDraws.singles,
    );
    expect(loaded.geometries).toBeGreaterThan(baseline.geometries);
    expect(loaded.materials).toBeGreaterThan(baseline.materials);
  });

  it("unloads to baseline and repeated loads do not accumulate resources", async () => {
    const harness = await createHarness();
    const baseline = sceneMetrics(harness.scene);
    const baselineBodies = harness.physics.rapierWorld.bodies.len();
    const baselineColliders = harness.physics.rapierWorld.colliders.len();

    await harness.runtime.loadLevel(FIRST_SECTION_LAYOUT_ID);

    const firstLoad = sceneMetrics(harness.scene);
    const firstLoadBodies = harness.physics.rapierWorld.bodies.len();
    const firstLoadColliders = harness.physics.rapierWorld.colliders.len();

    expect(firstLoad.children).toBeGreaterThan(baseline.children);
    expect(firstLoadColliders).toBeGreaterThan(baselineColliders);

    await harness.runtime.unloadLevel();

    expect(sceneMetrics(harness.scene)).toEqual(baseline);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(baselineBodies);
    expect(harness.physics.rapierWorld.colliders.len()).toBe(baselineColliders);
    expect(harness.runtime.getCurrentSession()).toBeNull();
    expect(harness.runtime.getSnapshot().objectSurfaceCount).toBe(0);

    await harness.runtime.loadLevel(FIRST_SECTION_LAYOUT_ID);

    expect(sceneMetrics(harness.scene)).toEqual(firstLoad);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(firstLoadBodies);
    expect(harness.physics.rapierWorld.colliders.len()).toBe(firstLoadColliders);

    await harness.runtime.unloadLevel();

    expect(sceneMetrics(harness.scene)).toEqual(baseline);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(baselineBodies);
    expect(harness.physics.rapierWorld.colliders.len()).toBe(baselineColliders);
  });
});

describe("First gameplay section DEV registration", () => {
  it("keeps first_section out of the production level list", () => {
    // `Application` is not imported: the module expects a browser composition
    // root. The registration is a single DOM-free method, so the test checks
    // its source branch directly (same pattern as the city layer's
    // `Math.random` source assertion).
    const source = readFileSync(new URL("../../src/app/Application.ts", import.meta.url), "utf8");
    const methodStart = source.indexOf("private initializeLevelRuntime(): void {");
    const methodEnd = source.indexOf("private initializeCamera(): void {");

    expect(methodStart).toBeGreaterThanOrEqual(0);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const method = source.slice(methodStart, methodEnd);
    const devStart = method.indexOf("if (import.meta.env.DEV) {");
    const devEnd = method.indexOf("\n    }", devStart);

    expect(devStart).toBeGreaterThanOrEqual(0);
    expect(devEnd).toBeGreaterThan(devStart);

    const devBlock = method.slice(devStart, devEnd);
    const production = method.slice(0, devStart) + method.slice(devEnd + "\n    }".length);

    expect(source).toMatch(
      /import \{[^}]*FIRST_SECTION_LEVEL_DEFINITIONS[^}]*\} from "\.\.\/levels\/first-section\/FirstSectionLevel";/,
    );

    // Training and Prologue stay unconditional; both review levels are DEV-only.
    expect(production).toContain("...TRAINING_TEST_LEVEL_DEFINITIONS");
    expect(production).toContain("...PROLOGUE_TEST_LEVEL_DEFINITIONS");
    expect(production).not.toContain("FIRST_SECTION_LEVEL_DEFINITIONS");
    expect(production).not.toContain("ARCHITECTURAL_KIT_DEMO_DEFINITIONS");

    expect(devBlock).toContain("definitions.push(...ARCHITECTURAL_KIT_DEMO_DEFINITIONS);");
    expect(devBlock).toContain("definitions.push(...FIRST_SECTION_LEVEL_DEFINITIONS);");
  });
});
