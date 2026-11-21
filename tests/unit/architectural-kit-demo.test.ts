import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ARCHITECTURAL_KIT_MODULE_KINDS,
  architecturalModuleKey,
} from "../../src/levels/architecture/ArchitecturalKit";
import {
  ARCHITECTURAL_KIT_DEMO_DEFINITIONS,
  ARCHITECTURAL_KIT_DEMO_LEVEL,
  ARCHITECTURAL_KIT_DEMO_LEVEL_ID,
} from "../../src/levels/demo/ArchitecturalKitDemo";
import { LevelRuntimeManager } from "../../src/levels/LevelRuntimeManager";
import type { LevelDefinition } from "../../src/levels/LevelTypes";
import { validateLevelDefinition } from "../../src/levels/LevelValidator";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import { RenderScene } from "../../src/rendering/RenderScene";

interface Harness {
  readonly physics: PhysicsWorld;
  readonly scene: RenderScene;
  readonly runtime: LevelRuntimeManager;
}

const harnesses: Harness[] = [];

async function createHarness(
  definitions: readonly LevelDefinition[] = ARCHITECTURAL_KIT_DEMO_DEFINITIONS,
): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: 1 / 60,
  });

  await physics.initialize();

  const scene = new RenderScene();
  const runtime = new LevelRuntimeManager({ scene, physics, definitions });
  const harness = { physics, scene, runtime };

  harnesses.push(harness);

  return harness;
}

function countInstancedMeshes(scene: RenderScene): number {
  let count = 0;

  scene.scene.traverse((object) => {
    if ((object as THREE.InstancedMesh).isInstancedMesh) {
      count += 1;
    }
  });

  return count;
}

afterEach(async () => {
  for (const harness of harnesses) {
    await harness.runtime.unloadLevel();
    harness.runtime.dispose();
    harness.physics.dispose();
  }

  harnesses.length = 0;
});

describe("Architectural Kit demonstration composition", () => {
  it("is a valid, visual-only review level with every module kind placed", () => {
    const validation = validateLevelDefinition(ARCHITECTURAL_KIT_DEMO_LEVEL);

    expect(validation.errors).toEqual([]);

    const placements = ARCHITECTURAL_KIT_DEMO_LEVEL.architecture ?? [];

    expect(placements.length).toBeGreaterThanOrEqual(60);
    expect(ARCHITECTURAL_KIT_DEMO_LEVEL.geometry).toHaveLength(1);
    expect(ARCHITECTURAL_KIT_DEMO_LEVEL.surfaces).toHaveLength(1);
    expect(ARCHITECTURAL_KIT_DEMO_LEVEL.checkpoints).toHaveLength(0);
    expect(ARCHITECTURAL_KIT_DEMO_LEVEL.triggers).toHaveLength(0);

    const placedKinds = new Set(placements.map((placement) => placement.module.kind));

    expect([...placedKinds].sort()).toEqual([...ARCHITECTURAL_KIT_MODULE_KINDS].sort());

    for (const placement of placements) {
      expect(placement.id.length, placement.id).toBeGreaterThan(0);
    }
  });

  it("reuses module variants across placements instead of duplicating geometry", () => {
    const placements = ARCHITECTURAL_KIT_DEMO_LEVEL.architecture ?? [];
    const variantKeys = new Set(
      placements.map((placement) => architecturalModuleKey(placement.module)),
    );

    expect(variantKeys.size).toBeLessThan(placements.length);
    expect(variantKeys.size).toBeGreaterThan(15);
  });

  it("loads the composition as instanced architecture and unloads every resource", async () => {
    const harness = await createHarness();
    const baselineChildren = harness.scene.scene.children.length;
    const baselineInstancedMeshes = countInstancedMeshes(harness.scene);
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");

    const session = await harness.runtime.loadLevel(ARCHITECTURAL_KIT_DEMO_LEVEL_ID);

    expect(session.state).toBe("ready");
    expect(harness.runtime.getCurrentLevel()?.id).toBe(ARCHITECTURAL_KIT_DEMO_LEVEL_ID);
    expect(harness.runtime.getSnapshot().objectSurfaceCount).toBe(1);
    expect(harness.runtime.getSnapshot().spawnPointCount).toBe(1);
    expect(countInstancedMeshes(harness.scene)).toBeGreaterThan(baselineInstancedMeshes + 50);

    const loadedChildren = harness.scene.scene.children.length;

    expect(loadedChildren).toBeGreaterThan(baselineChildren + 80);

    const disposeCallsBeforeUnload = disposeSpy.mock.calls.length;

    await harness.runtime.unloadLevel();

    expect(harness.scene.scene.children.length).toBe(baselineChildren);
    expect(harness.runtime.getCurrentLevel()).toBeNull();
    // Every kit model part and every cached primitive is released on unload.
    expect(disposeSpy.mock.calls.length - disposeCallsBeforeUnload).toBeGreaterThan(80);
    expect(countInstancedMeshes(harness.scene)).toBe(baselineInstancedMeshes);

    disposeSpy.mockRestore();

    // Reload after full teardown: no stale geometry or scene objects survive.
    const reloaded = await harness.runtime.loadLevel(ARCHITECTURAL_KIT_DEMO_LEVEL_ID);

    expect(reloaded.state).toBe("ready");
    expect(harness.scene.scene.children.length).toBe(loadedChildren);

    await harness.runtime.unloadLevel();

    expect(harness.scene.scene.children.length).toBe(baselineChildren);
  });

  it("rejects an invalid architecture placement before the level loads", async () => {
    const placements = ARCHITECTURAL_KIT_DEMO_LEVEL.architecture ?? [];
    const firstPlacement = placements[0];

    if (!firstPlacement) {
      throw new Error("Demo composition has no placements.");
    }

    const brokenModule: LevelDefinition = {
      ...ARCHITECTURAL_KIT_DEMO_LEVEL,
      id: "broken_architecture_level",
      architecture: [
        {
          ...firstPlacement,
          module: { kind: "column", height: -2, width: 0.9 },
        },
      ],
    };

    expect(validateLevelDefinition(brokenModule).errors.map((error) => error.code)).toContain(
      "INVALID_ARCHITECTURE_MODULE",
    );

    const unknownSection: LevelDefinition = {
      ...ARCHITECTURAL_KIT_DEMO_LEVEL,
      id: "broken_architecture_section",
      architecture: [{ ...firstPlacement, sectionId: "missing_section" }],
    };

    expect(validateLevelDefinition(unknownSection).errors.map((error) => error.code)).toContain(
      "INVALID_ARCHITECTURE_SECTION",
    );

    const harness = await createHarness([brokenModule]);

    await expect(harness.runtime.loadLevel(brokenModule.id)).rejects.toMatchObject({
      code: "INVALID_LEVEL_DEFINITION",
    });
    expect(harness.scene.scene.children.length).toBe(9);
  });
});
