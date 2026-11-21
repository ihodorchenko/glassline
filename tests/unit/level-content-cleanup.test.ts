import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BoxLevelContentLoader,
  type LevelContentDependencies,
  type LoadedLevelContent,
} from "../../src/levels/LevelContentLoader";
import type {
  LevelArchitecturePlacement,
  LevelDefinition,
  LevelSpawnPointDefinition,
} from "../../src/levels/LevelTypes";
import { RuntimeObjectRegistry } from "../../src/levels/RuntimeObjectRegistry";
import { SpawnPointManager } from "../../src/levels/SpawnPointManager";
import { SurfaceRegistry } from "../../src/levels/SurfaceRegistry";
import { TriggerManager } from "../../src/levels/TriggerManager";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import { RenderScene } from "../../src/rendering/RenderScene";

const SECTION_ID = "sec_cleanup";
const SURFACE_ID = "surface_cleanup";

const SPAWN: LevelSpawnPointDefinition = {
  id: "sp_cleanup",
  sectionId: SECTION_ID,
  position: { x: 0, y: 1, z: 0 },
  rotationY: 0,
  type: "initial",
};

const PLACEMENT: LevelArchitecturePlacement = {
  id: "kit_0",
  sectionId: SECTION_ID,
  position: { x: 0, y: 0, z: 0 },
  module: { kind: "column", height: 5.2, width: 0.9 },
};

interface Harness {
  readonly loader: BoxLevelContentLoader;
  readonly scene: RenderScene;
  readonly physics: PhysicsWorld;
  readonly dependencies: LevelContentDependencies;
  readonly baselineChildren: number;
  readonly baselineMeshes: number;
  readonly baselineInstancedMeshes: number;
  readonly baselineBodies: number;
  readonly baselineBackground: number;
  readonly baselineFog: string;
}

const harnesses: Harness[] = [];
let loadedContent: LoadedLevelContent | null = null;

async function createHarness(): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: 1 / 60,
  });

  await physics.initialize();

  const scene = new RenderScene();
  const spawnPoints = new SpawnPointManager(SPAWN.id);
  const triggers = new TriggerManager();
  const surfaces = new SurfaceRegistry();
  const objects = new RuntimeObjectRegistry();
  const dependencies: LevelContentDependencies = {
    sessionId: "cleanup-session",
    levelId: "cleanup_level",
    scene,
    physics,
    spawnPoints,
    triggers,
    surfaces,
    objects,
  };
  const harness: Harness = {
    loader: new BoxLevelContentLoader(),
    scene,
    physics,
    dependencies,
    baselineChildren: scene.scene.children.length,
    baselineMeshes: countSceneMeshes(scene),
    baselineInstancedMeshes: countInstancedMeshes(scene),
    baselineBodies: physics.rapierWorld.bodies.len(),
    baselineBackground: readBackground(scene),
    baselineFog: readFog(scene),
  };

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

function countSceneMeshes(scene: RenderScene): number {
  let count = 0;

  scene.scene.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) {
      count += 1;
    }
  });

  return count;
}

function readBackground(scene: RenderScene): number {
  const background = scene.scene.background;

  return background instanceof THREE.Color ? background.getHex() : -1;
}

function readFog(scene: RenderScene): string {
  const fog = scene.scene.fog;

  return fog instanceof THREE.Fog ? `${fog.near}:${fog.far}:${fog.color.getHex()}` : "none";
}

function createDefinition(
  options: {
    readonly architecture?: readonly LevelArchitecturePlacement[];
    readonly spawnPoints?: readonly LevelSpawnPointDefinition[];
  } = {},
): LevelDefinition {
  return {
    id: "cleanup_level",
    version: "1.0.0",
    mode: "training",
    displayName: "Cleanup fixture",
    initialSpawnPointId: SPAWN.id,
    sections: [
      {
        id: SECTION_ID,
        order: 0,
        displayName: "Cleanup",
        entrySpawnPointId: SPAWN.id,
        activationPolicy: "automatic",
      },
    ],
    spawnPoints: options.spawnPoints ?? [SPAWN],
    triggers: [],
    checkpoints: [],
    interactionTargets: [],
    surfaces: [
      {
        id: SURFACE_ID,
        sectionId: SECTION_ID,
        surfaceType: "concrete",
        walkable: true,
        landingSurface: true,
        wallRunSurface: false,
        wallJumpSurface: false,
        vaultObstacle: false,
      },
    ],
    geometry: [
      {
        id: "geo_deck",
        sectionId: SECTION_ID,
        position: { x: 0, y: -0.45, z: 0 },
        size: { x: 10, y: 0.9, z: 10 },
        surfaceId: SURFACE_ID,
        material: "concrete",
      },
    ],
    decorations: [
      {
        id: "deco_solid",
        sectionId: SECTION_ID,
        shape: "box",
        position: { x: 0, y: 1, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        material: "concrete",
      },
      {
        id: "deco_transparent",
        sectionId: SECTION_ID,
        shape: "box",
        position: { x: 1, y: 1, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        material: "concrete",
        opacity: 0.5,
      },
      {
        id: "deco_sign",
        sectionId: SECTION_ID,
        shape: "plane",
        position: { x: 0, y: 2, z: 1 },
        size: { x: 2, y: 1, z: 1 },
        text: "CLEANUP",
      },
    ],
    architecture: options.architecture ?? [PLACEMENT],
    environment: {
      skyColor: 0x102030,
      fogColor: 0x203040,
      fogNear: 10,
      fogFar: 100,
      sunColor: 0xffffff,
      sunIntensity: 4,
      hemisphereIntensity: 0.2,
    },
    metadata: {
      description: "Cleanup fixture",
      difficulty: "review",
      estimatedDurationSeconds: 0,
      supportsSpeedrun: false,
      supportsRespawn: true,
    },
  };
}

afterEach(() => {
  loadedContent?.dispose();
  loadedContent = null;

  for (const harness of harnesses) {
    harness.scene.dispose();
    harness.physics.dispose();
  }

  harnesses.length = 0;
  vi.restoreAllMocks();
});

describe("BoxLevelContentLoader hardening", () => {
  it("rejects an invalid architectural module before touching the scene", async () => {
    const harness = await createHarness();
    const addObject = vi.spyOn(harness.scene, "addObject");
    const setEnvironment = vi.spyOn(harness.scene, "setEnvironment");
    const definition = createDefinition({
      architecture: [
        {
          ...PLACEMENT,
          module: { kind: "column", height: true, width: 0.9 },
        } as unknown as LevelArchitecturePlacement,
      ],
    });

    await expect(harness.loader.load(definition, harness.dependencies)).rejects.toThrow(
      /Invalid architectural module/,
    );

    expect(addObject).not.toHaveBeenCalled();
    expect(setEnvironment).not.toHaveBeenCalled();
    expect(harness.scene.scene.children.length).toBe(harness.baselineChildren);
    expect(countInstancedMeshes(harness.scene)).toBe(harness.baselineInstancedMeshes);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(harness.baselineBodies);
    expect(readBackground(harness.scene)).toBe(harness.baselineBackground);
  });

  it("rejects a key collision between different definitions before touching the scene", async () => {
    const harness = await createHarness();
    const addObject = vi.spyOn(harness.scene, "addObject");
    const setEnvironment = vi.spyOn(harness.scene, "setEnvironment");
    const definition = createDefinition({
      architecture: [
        { ...PLACEMENT, id: "kit_a", module: { kind: "column", height: 5.2, width: 0.9 } },
        {
          ...PLACEMENT,
          id: "kit_b",
          position: { x: 2, y: 0, z: 0 },
          module: { kind: "column", height: 5.2004, width: 0.9 },
        },
      ],
    });

    await expect(harness.loader.load(definition, harness.dependencies)).rejects.toThrow(
      /collision/i,
    );

    expect(addObject).not.toHaveBeenCalled();
    expect(setEnvironment).not.toHaveBeenCalled();
    expect(harness.scene.scene.children.length).toBe(harness.baselineChildren);
    expect(countInstancedMeshes(harness.scene)).toBe(harness.baselineInstancedMeshes);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(harness.baselineBodies);
  });

  it("restores the scene, colliders, geometries and environment after a mid-load failure", async () => {
    const harness = await createHarness();
    const addObject = vi.spyOn(harness.scene, "addObject");
    const setEnvironment = vi.spyOn(harness.scene, "setEnvironment");
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const definition = createDefinition({ spawnPoints: [SPAWN, SPAWN] });

    await expect(harness.loader.load(definition, harness.dependencies)).rejects.toThrow(
      /already registered/,
    );

    // The loader must have built the static mesh, decorations and kit meshes
    // before the duplicate spawn registration failed.
    expect(addObject.mock.calls.length).toBeGreaterThan(0);
    expect(disposeSpy.mock.calls.length).toBeGreaterThan(0);

    expect(harness.scene.scene.children.length).toBe(harness.baselineChildren);
    expect(countInstancedMeshes(harness.scene)).toBe(harness.baselineInstancedMeshes);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(harness.baselineBodies);
    expect(readBackground(harness.scene)).toBe(harness.baselineBackground);
    expect(setEnvironment).toHaveBeenLastCalledWith(null);
  });

  it("disposes successful content exactly once and returns to baseline", async () => {
    const harness = await createHarness();
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const content = await harness.loader.load(createDefinition(), harness.dependencies);

    loadedContent = content;

    expect(harness.scene.scene.children.length).toBeGreaterThan(harness.baselineChildren);
    expect(harness.physics.rapierWorld.bodies.len()).toBeGreaterThan(harness.baselineBodies);

    const disposeCallsAfterLoad = disposeSpy.mock.calls.length;

    content.dispose();

    expect(harness.scene.scene.children.length).toBe(harness.baselineChildren);
    expect(countInstancedMeshes(harness.scene)).toBe(harness.baselineInstancedMeshes);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(harness.baselineBodies);
    expect(readBackground(harness.scene)).toBe(harness.baselineBackground);

    const disposeCallsAfterFirstDispose = disposeSpy.mock.calls.length;

    expect(disposeCallsAfterFirstDispose).toBeGreaterThan(disposeCallsAfterLoad);

    content.dispose();

    expect(disposeSpy.mock.calls.length).toBe(disposeCallsAfterFirstDispose);
    expect(harness.scene.scene.children.length).toBe(harness.baselineChildren);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(harness.baselineBodies);
  });
  it("returns the scene and physics world to baseline when scene.addObject throws mid-load", async () => {
    const harness = await createHarness();
    const originalAddObject = harness.scene.addObject.bind(harness.scene);
    let addedObjects = 0;
    const failing = { object: null as THREE.Object3D | null };
    let failingGeometryDisposed = false;

    vi.spyOn(harness.scene, "addObject").mockImplementation((object: THREE.Object3D) => {
      originalAddObject(object);
      addedObjects += 1;

      if (addedObjects === 4) {
        failing.object = object;

        const mesh = object as THREE.Mesh;
        mesh.geometry.addEventListener("dispose", () => {
          failingGeometryDisposed = true;
        });

        throw new Error("synthetic addObject failure");
      }
    });

    await expect(harness.loader.load(createDefinition(), harness.dependencies)).rejects.toThrow(
      "synthetic addObject failure",
    );

    expect(addedObjects).toBe(4);

    if (!failing.object) {
      throw new Error("The loader did not report the object whose addObject call failed.");
    }

    expect(failing.object.parent).toBeNull();
    expect(failingGeometryDisposed).toBe(true);

    expect(harness.scene.scene.children.length).toBe(harness.baselineChildren);
    expect(countSceneMeshes(harness.scene)).toBe(harness.baselineMeshes);
    expect(countInstancedMeshes(harness.scene)).toBe(harness.baselineInstancedMeshes);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(harness.baselineBodies);
    expect(readBackground(harness.scene)).toBe(harness.baselineBackground);
    expect(readFog(harness.scene)).toBe(harness.baselineFog);
  });

  it("retries only the failed resource on the next cleanup call", async () => {
    const harness = await createHarness();
    const content = await harness.loader.load(createDefinition(), harness.dependencies);

    loadedContent = content;

    const addedRoots = harness.scene.scene.children.slice(harness.baselineChildren);
    const targetMesh = addedRoots.find(
      (object): object is THREE.Mesh =>
        (object as THREE.Mesh).isMesh && !(object as THREE.InstancedMesh).isInstancedMesh,
    );
    const instancedMesh = addedRoots.find(
      (object): object is THREE.InstancedMesh => (object as THREE.InstancedMesh).isInstancedMesh,
    );

    if (!targetMesh || !instancedMesh) {
      throw new Error("Cleanup fixture did not load the expected meshes.");
    }

    const targetGeometry = targetMesh.geometry;
    const otherGeometry = instancedMesh.geometry;
    let targetDisposeEvents = 0;
    let otherDisposeEvents = 0;

    targetGeometry.addEventListener("dispose", () => {
      targetDisposeEvents += 1;
    });
    otherGeometry.addEventListener("dispose", () => {
      otherDisposeEvents += 1;
    });

    const originalDispose = THREE.BufferGeometry.prototype.dispose;
    let failTargetOnce = true;

    vi.spyOn(THREE.BufferGeometry.prototype, "dispose").mockImplementation(function (
      this: THREE.BufferGeometry,
    ) {
      if (failTargetOnce && this === targetGeometry) {
        failTargetOnce = false;

        throw new Error("synthetic geometry dispose failure");
      }

      originalDispose.call(this);
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => content.dispose()).not.toThrow();

    // The failed geometry is still referenced by the loader, but every other
    // resource group was released and the scene/colliders/atmosphere are back
    // at baseline.
    expect(targetDisposeEvents).toBe(0);
    expect(otherDisposeEvents).toBeGreaterThan(0);
    expect(harness.scene.scene.children.length).toBe(harness.baselineChildren);
    expect(countSceneMeshes(harness.scene)).toBe(harness.baselineMeshes);
    expect(countInstancedMeshes(harness.scene)).toBe(harness.baselineInstancedMeshes);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(harness.baselineBodies);
    expect(readBackground(harness.scene)).toBe(harness.baselineBackground);
    expect(readFog(harness.scene)).toBe(harness.baselineFog);
    expect(consoleError).toHaveBeenCalled();

    // A second call retries only the failed geometry and completes teardown.
    expect(() => content.dispose()).not.toThrow();

    expect(targetDisposeEvents).toBe(1);
    expect(otherDisposeEvents).toBeGreaterThan(0);
    expect(harness.scene.scene.children.length).toBe(harness.baselineChildren);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(harness.baselineBodies);
    expect(readBackground(harness.scene)).toBe(harness.baselineBackground);
    expect(readFog(harness.scene)).toBe(harness.baselineFog);

    // Fully disposed content is a no-op afterwards.
    expect(() => content.dispose()).not.toThrow();
    expect(targetDisposeEvents).toBe(1);
  });
});
