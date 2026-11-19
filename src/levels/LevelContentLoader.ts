import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { MaterialLibrary } from "../rendering/MaterialLibrary";
import type { RenderScene } from "../rendering/RenderScene";
import type {
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

interface DecorationBatch {
  readonly shape: "box" | "cylinder";
  readonly material: THREE.MeshStandardMaterial;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
  readonly matrices: THREE.Matrix4[];
}

/**
 * Instantiates authored geometry as visual meshes and static Rapier colliders,
 * and registers level runtime objects.
 *
 * Visual decorations are batched into instanced meshes by material and shape so
 * dense city dressing stays inside a small draw-call budget.
 */
export class BoxLevelContentLoader {
  async load(
    definition: LevelDefinition,
    dependencies: LevelContentDependencies,
  ): Promise<LoadedLevelContent> {
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    const library: MaterialLibrary = dependencies.scene.materials;
    const meshes: THREE.Mesh[] = [];
    const decorationMeshes: THREE.InstancedMesh[] = [];
    const transparentMeshes: THREE.Mesh[] = [];
    const transparentMaterials: THREE.MeshStandardMaterial[] = [];
    const bodies: RAPIER.RigidBody[] = [];
    const world = dependencies.physics.rapierWorld;

    if (definition.environment) {
      dependencies.scene.setEnvironment(definition.environment);
    }

    const surfaceDefinitions = new Map(definition.surfaces.map((surface) => [surface.id, surface]));

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
      const mesh = new THREE.Mesh(unitBox, material);

      if (geometry.color !== undefined) {
        mesh.material = library.getColor(geometry.color, 0.78, 0.08);
      }

      mesh.scale.set(geometry.size.x, geometry.size.y, geometry.size.z);
      mesh.position.set(geometry.position.x, geometry.position.y, geometry.position.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      dependencies.scene.addObject(mesh);
      meshes.push(mesh);

      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(
          geometry.position.x,
          geometry.position.y,
          geometry.position.z,
        ),
      );
      const collider = world.createCollider(
        RAPIER.ColliderDesc.cuboid(geometry.size.x / 2, geometry.size.y / 2, geometry.size.z / 2)
          .setFriction(1)
          .setRestitution(0),
        body,
      );

      bodies.push(body);

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

    const batches = new Map<string, DecorationBatch>();

    for (const decoration of definition.decorations ?? []) {
      const opacity = decoration.opacity ?? 1;

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
        const geometry = decoration.shape === "cylinder" ? unitCylinder : unitBox;
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
        dependencies.scene.addObject(mesh);
        transparentMeshes.push(mesh);
        transparentMaterials.push(material);
        continue;
      }

      const material = decoration.material
        ? library.get(decoration.material)
        : library.getColor(decoration.color ?? 0xffffff);
      const castShadow = decoration.castShadow ?? true;
      const receiveShadow = decoration.receiveShadow ?? true;
      const key = `${material.uuid}:${decoration.shape}:${castShadow ? 1 : 0}:${receiveShadow ? 1 : 0}`;
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
      }

      batch.matrices.push(decorationMatrix(decoration));
    }

    for (const batch of batches.values()) {
      const geometry = batch.shape === "cylinder" ? unitCylinder : unitBox;
      const mesh = new THREE.InstancedMesh(geometry, batch.material, batch.matrices.length);

      batch.matrices.forEach((matrix, index) => {
        mesh.setMatrixAt(index, matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = batch.castShadow;
      mesh.receiveShadow = batch.receiveShadow;
      mesh.frustumCulled = false;
      dependencies.scene.addObject(mesh);
      decorationMeshes.push(mesh);
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

    let disposed = false;

    return {
      interactionTargets: [...definition.interactionTargets],
      dispose: () => {
        if (disposed) {
          return;
        }

        disposed = true;

        for (const mesh of meshes) {
          dependencies.scene.removeObject(mesh);
        }

        for (const mesh of decorationMeshes) {
          dependencies.scene.removeObject(mesh);
          mesh.dispose();
        }

        for (const mesh of transparentMeshes) {
          dependencies.scene.removeObject(mesh);
        }

        for (const material of transparentMaterials) {
          material.dispose();
        }

        if (dependencies.physics.isInitialized) {
          for (const body of bodies) {
            world.removeRigidBody(body);
          }
        }

        unitBox.dispose();
        unitCylinder.dispose();

        meshes.length = 0;
        decorationMeshes.length = 0;
        transparentMeshes.length = 0;
        transparentMaterials.length = 0;
        bodies.length = 0;
        batches.clear();
        dependencies.scene.setEnvironment(null);
      },
    };
  }
}
