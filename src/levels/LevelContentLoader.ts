import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { Disposable } from "../core/Disposable";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { MaterialLibrary } from "../rendering/MaterialLibrary";
import type { RenderScene } from "../rendering/RenderScene";
import {
  architecturalModuleKey,
  architecturalModuleSignature,
  buildArchitecturalModule,
  type KitModuleModel,
  validateArchitecturalModuleDefinition,
} from "./architecture/ArchitecturalKit";
import { KitGeometryPool } from "./architecture/KitGeometry";
import type {
  LevelArchitecturePlacement,
  LevelDecorationDefinition,
  LevelDefinition,
  LevelGeometryDefinition,
  LevelInteractionTargetDefinition,
  LevelMaterialType,
  SurfaceType,
} from "./LevelTypes";
import type { ILevelRuntimeObject, RuntimeObjectRegistry } from "./RuntimeObjectRegistry";
import type { SpawnPointManager } from "./SpawnPointManager";
import type { SurfaceRegistry } from "./SurfaceRegistry";
import type { TriggerManager } from "./TriggerManager";

export interface LevelContentDependencies {
  readonly sessionId: string;
  readonly levelId: string;
  readonly scene: RenderScene;
  readonly physics: PhysicsWorld;
  readonly spawnPoints: SpawnPointManager;
  readonly triggers: TriggerManager;
  readonly surfaces: SurfaceRegistry;
  readonly objects: RuntimeObjectRegistry;
}

export interface LoadedLevelContent extends Disposable {
  readonly interactionTargets: readonly LevelInteractionTargetDefinition[];
}

const SURFACE_MATERIALS: Record<SurfaceType, LevelMaterialType> = {
  concrete: "concrete",
  metal: "metal",
  rubber: "rubber",
  glass: "glass",
  asphalt: "asphalt",
};

function surfaceObject(
  geometry: LevelGeometryDefinition,
  surfaces: SurfaceRegistry,
): ILevelRuntimeObject {
  return {
    id: `surface:${geometry.id}`,
    sectionId: geometry.sectionId,
    objectType: "movement-surface",
    // Surfaces describe the whole loaded level; section gating applies to
    // triggers and interactables, not to static collision metadata.
    activate: () => surfaces.setActive(geometry.id, true),
    deactivate: () => undefined,
    dispose: () => surfaces.unregister(geometry.id),
  };
}

function spawnObject(
  spawnPointId: string,
  sectionId: string,
  spawnPoints: SpawnPointManager,
): ILevelRuntimeObject {
  return {
    id: `spawn:${spawnPointId}`,
    sectionId,
    objectType: "spawn-point",
    activate: () => spawnPoints.setEnabled(spawnPointId, true),
    deactivate: () => undefined,
    dispose: () => spawnPoints.unregister(spawnPointId),
  };
}

function decorationMatrix(decoration: LevelDecorationDefinition): THREE.Matrix4 {
  const position = new THREE.Vector3(
    decoration.position.x,
    decoration.position.y,
    decoration.position.z,
  );
  const rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      decoration.rotationX ?? 0,
      decoration.rotationY ?? 0,
      decoration.rotationZ ?? 0,
      "YXZ",
    ),
  );
  const scale = new THREE.Vector3(decoration.size.x, decoration.size.y, decoration.size.z);

  return new THREE.Matrix4().compose(position, rotation, scale);
}

function architectureMatrix(placement: LevelArchitecturePlacement): THREE.Matrix4 {
  const position = new THREE.Vector3(
    placement.position.x,
    placement.position.y,
    placement.position.z,
  );
  const rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      placement.rotationX ?? 0,
      placement.rotationY ?? 0,
      placement.rotationZ ?? 0,
      "YXZ",
    ),
  );

  return new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1));
}

interface DecorationBatch {
  readonly shape: "box" | "cylinder";
  readonly material: THREE.MeshStandardMaterial;
  castShadow: boolean;
  receiveShadow: boolean;
  readonly matrices: THREE.Matrix4[];
}

/**
 * Instantiates authored geometry as visual meshes and static Rapier colliders,
 * and registers level runtime objects.
 *
 * Visual decorations are batched into instanced meshes by material and shape so
 * dense city dressing stays inside a small draw-call budget. Architectural Kit
 * modules are generated once per variant and instanced per material batch; they
 * remain visual-only, exactly like authored decorations.
 */
export class BoxLevelContentLoader {
  async load(
    definition: LevelDefinition,
    dependencies: LevelContentDependencies,
  ): Promise<LoadedLevelContent> {
    // Validate every kit placement and its cache identity before touching the
    // scene. Runtime validation normally catches bad data first; repeating it
    // here means direct loader callers also fail before any scene mutation.
    const architecturePlacements = definition.architecture ?? [];
    const kitSignatures = new Map<string, string>();

    for (const placement of architecturePlacements) {
      const issues = validateArchitecturalModuleDefinition(placement.module);

      if (issues.length > 0) {
        throw new Error(
          `Invalid architectural module in placement "${placement.id}": ${issues.join(" ")}`,
        );
      }

      const key = architecturalModuleKey(placement.module);
      const signature = architecturalModuleSignature(placement.module);
      const existing = kitSignatures.get(key);

      if (existing !== undefined && existing !== signature) {
        throw new Error(
          `Architectural module key collision in placement "${placement.id}": "${key}" resolves to different definitions.`,
        );
      }

      kitSignatures.set(key, signature);
    }

    const world = dependencies.physics.rapierWorld;
    const unitBevelBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.03);
    const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    const boxGeometries = new Map<string, THREE.BufferGeometry>();
    const getBoxGeometry = (size: { x: number; y: number; z: number }): THREE.BufferGeometry => {
      const key = `${size.x}:${size.y}:${size.z}`;
      const cached = boxGeometries.get(key);

      if (cached) {
        return cached;
      }

      const bevel = Math.max(0.004, Math.min(0.035, Math.min(size.x, size.y, size.z) * 0.16));
      const geometry = new RoundedBoxGeometry(size.x, size.y, size.z, 2, bevel);

      boxGeometries.set(key, geometry);

      return geometry;
    };
    const library: MaterialLibrary = dependencies.scene.materials;
    const meshes: THREE.Mesh[] = [];
    const decorationMeshes: THREE.InstancedMesh[] = [];
    const architectureMeshes: THREE.InstancedMesh[] = [];
    const transparentMeshes: THREE.Mesh[] = [];
    const transparentMaterials: THREE.MeshStandardMaterial[] = [];
    const ownedDecorationGeometries: THREE.BufferGeometry[] = [];
    const kitPool = new KitGeometryPool();
    const kitModels = new Map<string, KitModuleModel>();
    const kitBatches = new Map<string, { model: KitModuleModel; matrices: THREE.Matrix4[] }>();
    const bodies: RAPIER.RigidBody[] = [];
    const batches = new Map<string, DecorationBatch>();
    const staticBatches = new Map<
      string,
      { material: THREE.Material; geometries: THREE.BufferGeometry[] }
    >();
    let disposed = false;
    let kitPoolDisposed = false;
    let environmentRestored = false;
    const removedObjects = new Set<THREE.Object3D>();
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedInstancedMeshes = new Set<THREE.InstancedMesh>();
    const disposedMaterials = new Set<THREE.Material>();
    const removedBodies = new Set<RAPIER.RigidBody>();

    /**
     * Idempotent teardown shared by the returned `dispose` and the load error
     * path. Each mesh, geometry, material and rigid body is attempted on its
     * own; a failed resource stays referenced so a later call can retry only
     * the failed operations. A successful cleanup sets `disposed` and is a
     * no-op afterwards.
     */
    const disposeContent = (): void => {
      if (disposed) {
        return;
      }

      const failures: unknown[] = [];
      const attempt = (action: () => void): boolean => {
        try {
          action();
          return true;
        } catch (error) {
          failures.push(error);
          return false;
        }
      };

      const disposeGeometry = (geometry: THREE.BufferGeometry): boolean => {
        if (disposedGeometries.has(geometry)) {
          return true;
        }

        if (!attempt(() => geometry.dispose())) {
          return false;
        }

        disposedGeometries.add(geometry);
        return true;
      };

      const removeObject = (object: THREE.Object3D): boolean => {
        if (removedObjects.has(object)) {
          return true;
        }

        if (!attempt(() => dependencies.scene.removeObject(object))) {
          return false;
        }

        removedObjects.add(object);
        return true;
      };

      const disposeInstancedMesh = (mesh: THREE.InstancedMesh): boolean => {
        if (disposedInstancedMeshes.has(mesh)) {
          return true;
        }

        if (!attempt(() => mesh.dispose())) {
          return false;
        }

        disposedInstancedMeshes.add(mesh);
        return true;
      };

      const disposeMaterial = (material: THREE.Material): boolean => {
        if (disposedMaterials.has(material)) {
          return true;
        }

        if (!attempt(() => material.dispose())) {
          return false;
        }

        disposedMaterials.add(material);
        return true;
      };

      const removeBody = (body: RAPIER.RigidBody): boolean => {
        if (removedBodies.has(body)) {
          return true;
        }

        if (!dependencies.physics.isInitialized) {
          removedBodies.add(body);
          return true;
        }

        if (!attempt(() => world.removeRigidBody(body))) {
          return false;
        }

        removedBodies.add(body);
        return true;
      };

      for (const [key, batch] of staticBatches) {
        for (let index = batch.geometries.length - 1; index >= 0; index -= 1) {
          const geometry = batch.geometries[index];

          if (geometry && disposeGeometry(geometry)) {
            batch.geometries.splice(index, 1);
          }
        }

        if (batch.geometries.length === 0) {
          staticBatches.delete(key);
        }
      }

      for (let index = meshes.length - 1; index >= 0; index -= 1) {
        const mesh = meshes[index];

        if (!mesh) {
          continue;
        }

        const removed = removeObject(mesh);
        const geometryDisposed = disposeGeometry(mesh.geometry);

        if (removed && geometryDisposed) {
          meshes.splice(index, 1);
        }
      }

      for (let index = decorationMeshes.length - 1; index >= 0; index -= 1) {
        const mesh = decorationMeshes[index];

        if (!mesh) {
          continue;
        }

        const removed = removeObject(mesh);
        const instanceDisposed = disposeInstancedMesh(mesh);

        if (removed && instanceDisposed) {
          decorationMeshes.splice(index, 1);
        }
      }

      for (let index = architectureMeshes.length - 1; index >= 0; index -= 1) {
        const mesh = architectureMeshes[index];

        if (!mesh) {
          continue;
        }

        const removed = removeObject(mesh);
        const instanceDisposed = disposeInstancedMesh(mesh);

        if (removed && instanceDisposed) {
          architectureMeshes.splice(index, 1);
        }
      }

      for (const [key, model] of kitModels) {
        let complete = true;

        for (const part of model.parts) {
          if (!disposeGeometry(part.geometry)) {
            complete = false;
          }
        }

        if (complete) {
          kitModels.delete(key);
        }
      }

      if (!kitPoolDisposed && attempt(() => kitPool.dispose())) {
        kitPoolDisposed = true;
      }

      for (let index = transparentMeshes.length - 1; index >= 0; index -= 1) {
        const mesh = transparentMeshes[index];

        if (mesh && removeObject(mesh)) {
          transparentMeshes.splice(index, 1);
        }
      }

      for (let index = ownedDecorationGeometries.length - 1; index >= 0; index -= 1) {
        const geometry = ownedDecorationGeometries[index];

        if (geometry && disposeGeometry(geometry)) {
          ownedDecorationGeometries.splice(index, 1);
        }
      }

      for (let index = transparentMaterials.length - 1; index >= 0; index -= 1) {
        const material = transparentMaterials[index];

        if (material && disposeMaterial(material)) {
          transparentMaterials.splice(index, 1);
        }
      }

      for (let index = bodies.length - 1; index >= 0; index -= 1) {
        const body = bodies[index];

        if (body && removeBody(body)) {
          bodies.splice(index, 1);
        }
      }

      for (const [key, geometry] of boxGeometries) {
        if (disposeGeometry(geometry)) {
          boxGeometries.delete(key);
        }
      }

      disposeGeometry(unitBevelBox);
      disposeGeometry(unitCylinder);

      if (!environmentRestored && attempt(() => dependencies.scene.setEnvironment(null))) {
        environmentRestored = true;
      }

      batches.clear();
      kitBatches.clear();

      const hasPendingResources =
        meshes.length > 0 ||
        decorationMeshes.length > 0 ||
        architectureMeshes.length > 0 ||
        transparentMeshes.length > 0 ||
        ownedDecorationGeometries.length > 0 ||
        transparentMaterials.length > 0 ||
        bodies.length > 0 ||
        boxGeometries.size > 0 ||
        staticBatches.size > 0 ||
        kitModels.size > 0 ||
        !kitPoolDisposed ||
        !environmentRestored;

      if (failures.length > 0) {
        console.error("[Glassline] Level content disposal reported failures.", failures);
        return;
      }

      if (hasPendingResources) {
        console.error(
          "[Glassline] Level content disposal left pending resources; a retry is required.",
        );
        return;
      }

      disposed = true;
      removedObjects.clear();
      disposedGeometries.clear();
      disposedInstancedMeshes.clear();
      disposedMaterials.clear();
      removedBodies.clear();
    };

    try {
      if (definition.environment) {
        dependencies.scene.setEnvironment(definition.environment);
      }

      const surfaceDefinitions = new Map(
        definition.surfaces.map((surface) => [surface.id, surface]),
      );

      for (const geometry of definition.geometry) {
        const surfaceDefinition = surfaceDefinitions.get(geometry.surfaceId);

        if (!surfaceDefinition) {
          throw new Error(
            `Geometry "${geometry.id}" references unknown surface "${geometry.surfaceId}".`,
          );
        }

        const material = library.get(
          geometry.material ?? SURFACE_MATERIALS[surfaceDefinition.surfaceType],
        );
        const surfaceMaterial =
          geometry.color !== undefined ? library.getColor(geometry.color, 0.78, 0.08) : material;
        const batchKey = surfaceMaterial.uuid;
        let staticBatch = staticBatches.get(batchKey);

        if (!staticBatch) {
          staticBatch = { material: surfaceMaterial, geometries: [] };
          staticBatches.set(batchKey, staticBatch);
        }

        const transformed = getBoxGeometry(geometry.size).clone();

        transformed.applyMatrix4(
          new THREE.Matrix4().makeTranslation(
            geometry.position.x,
            geometry.position.y,
            geometry.position.z,
          ),
        );
        staticBatch.geometries.push(transformed);

        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(
            geometry.position.x,
            geometry.position.y,
            geometry.position.z,
          ),
        );
        bodies.push(body);

        const collider = world.createCollider(
          RAPIER.ColliderDesc.cuboid(geometry.size.x / 2, geometry.size.y / 2, geometry.size.z / 2)
            .setFriction(1)
            .setRestitution(0),
          body,
        );

        dependencies.surfaces.register({
          id: geometry.id,
          sectionId: geometry.sectionId,
          definition: surfaceDefinition,
          colliderHandle: collider.handle,
          bounds: {
            center: { ...geometry.position },
            halfExtents: {
              x: geometry.size.x / 2,
              y: geometry.size.y / 2,
              z: geometry.size.z / 2,
            },
          },
          active: true,
        });
        dependencies.objects.register(surfaceObject(geometry, dependencies.surfaces));
      }

      for (const staticBatch of staticBatches.values()) {
        const merged = mergeGeometries(staticBatch.geometries, false);

        for (const geometry of staticBatch.geometries) {
          geometry.dispose();
        }

        staticBatch.geometries.length = 0;

        if (!merged) {
          continue;
        }

        const mesh = new THREE.Mesh(merged, staticBatch.material);

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes.push(mesh);
        dependencies.scene.addObject(mesh);
      }

      staticBatches.clear();

      for (const decoration of definition.decorations ?? []) {
        const opacity = decoration.opacity ?? 1;

        if (decoration.shape === "plane") {
          const material = library.getSign({
            text: decoration.text ?? "",
            background: decoration.color ?? 0x14191d,
            textColor: decoration.textColor ?? 0xffffff,
            accent: decoration.accentColor ?? 0xd52e36,
          });
          const geometry = new THREE.PlaneGeometry(1, 1);
          const mesh = new THREE.Mesh(geometry, material);

          ownedDecorationGeometries.push(geometry);
          transparentMeshes.push(mesh);
          mesh.position.set(decoration.position.x, decoration.position.y, decoration.position.z);
          mesh.scale.set(decoration.size.x, decoration.size.y, 1);
          mesh.rotation.set(
            decoration.rotationX ?? 0,
            decoration.rotationY ?? 0,
            decoration.rotationZ ?? 0,
          );
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          dependencies.scene.addObject(mesh);
          continue;
        }

        if (opacity < 1) {
          const material = new THREE.MeshStandardMaterial({
            color: decoration.color ?? 0xffffff,
            roughness: 0.5,
            metalness: 0.1,
            transparent: true,
            opacity,
            emissive: decoration.emissive ?? 0x000000,
            emissiveIntensity: decoration.emissiveIntensity ?? 0,
          });
          const geometry = decoration.shape === "cylinder" ? unitCylinder : unitBevelBox;
          const mesh = new THREE.Mesh(geometry, material);

          mesh.position.set(decoration.position.x, decoration.position.y, decoration.position.z);
          mesh.scale.set(decoration.size.x, decoration.size.y, decoration.size.z);
          mesh.rotation.set(
            decoration.rotationX ?? 0,
            decoration.rotationY ?? 0,
            decoration.rotationZ ?? 0,
          );
          mesh.castShadow = decoration.castShadow ?? false;
          mesh.receiveShadow = decoration.receiveShadow ?? false;
          transparentMeshes.push(mesh);
          transparentMaterials.push(material);
          dependencies.scene.addObject(mesh);
          continue;
        }

        const material = decoration.material
          ? library.get(decoration.material)
          : library.getColor(decoration.color ?? 0xffffff);
        const castShadow = decoration.castShadow ?? true;
        const receiveShadow = decoration.receiveShadow ?? true;
        const key = `${material.uuid}:${decoration.shape}:${castShadow ? 1 : 0}`;
        let batch = batches.get(key);

        if (!batch) {
          batch = {
            shape: decoration.shape,
            material,
            castShadow,
            receiveShadow,
            matrices: [],
          };
          batches.set(key, batch);
        } else {
          batch.receiveShadow = batch.receiveShadow || receiveShadow;
        }

        batch.matrices.push(decorationMatrix(decoration));
      }

      for (const batch of batches.values()) {
        const geometry = batch.shape === "cylinder" ? unitCylinder : unitBevelBox;
        const mesh = new THREE.InstancedMesh(geometry, batch.material, batch.matrices.length);

        batch.matrices.forEach((matrix, index) => {
          mesh.setMatrixAt(index, matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = batch.castShadow;
        mesh.receiveShadow = batch.receiveShadow;
        mesh.frustumCulled = false;
        decorationMeshes.push(mesh);
        dependencies.scene.addObject(mesh);
      }

      // Architectural Kit: one generated geometry per authored module variant,
      // one instanced draw per material batch, shared across every placement.
      for (const placement of architecturePlacements) {
        const key = architecturalModuleKey(placement.module);
        let model = kitModels.get(key);

        if (!model) {
          model = buildArchitecturalModule(placement.module, kitPool);
          kitModels.set(key, model);
        }

        let batch = kitBatches.get(key);

        if (!batch) {
          batch = { model, matrices: [] };
          kitBatches.set(key, batch);
        }

        batch.matrices.push(architectureMatrix(placement));
      }

      for (const batch of kitBatches.values()) {
        for (const part of batch.model.parts) {
          const material = library.get(part.material);
          const mesh = new THREE.InstancedMesh(part.geometry, material, batch.matrices.length);

          batch.matrices.forEach((matrix, index) => {
            mesh.setMatrixAt(index, matrix);
          });

          mesh.instanceMatrix.needsUpdate = true;
          mesh.castShadow = part.castShadow;
          mesh.receiveShadow = part.receiveShadow;
          mesh.frustumCulled = false;
          architectureMeshes.push(mesh);
          dependencies.scene.addObject(mesh);
        }
      }

      for (const spawnPoint of definition.spawnPoints) {
        dependencies.spawnPoints.register(spawnPoint);
        dependencies.objects.register(
          spawnObject(spawnPoint.id, spawnPoint.sectionId, dependencies.spawnPoints),
        );
      }

      for (const trigger of definition.triggers) {
        // Triggers are disabled until their section is activated.
        dependencies.triggers.register({ ...trigger, enabled: false });
        dependencies.objects.register({
          id: `trigger:${trigger.id}`,
          sectionId: trigger.sectionId,
          objectType: "trigger",
          activate: () => {
            if (trigger.enabled !== false) {
              dependencies.triggers.enable(trigger.id);
            }
          },
          deactivate: () => dependencies.triggers.disable(trigger.id),
          dispose: () => dependencies.triggers.unregister(trigger.id),
        });
      }

      for (const checkpoint of definition.checkpoints) {
        dependencies.objects.register({
          id: `checkpoint:${checkpoint.id}`,
          sectionId: checkpoint.sectionId,
          objectType: "checkpoint",
          activate: () => undefined,
          deactivate: () => undefined,
          dispose: () => undefined,
        });
      }

      for (const target of definition.interactionTargets) {
        dependencies.objects.register({
          id: `interactable:${target.id}`,
          sectionId: target.sectionId,
          objectType: "interactable",
          activate: () => undefined,
          deactivate: () => undefined,
          dispose: () => undefined,
        });
      }

      return {
        interactionTargets: [...definition.interactionTargets],
        dispose: disposeContent,
      };
    } catch (error) {
      try {
        disposeContent();
      } catch (disposeError) {
        console.error("[Glassline] Failed to dispose partial level content.", disposeError);
      }

      throw error;
    }
  }
}
