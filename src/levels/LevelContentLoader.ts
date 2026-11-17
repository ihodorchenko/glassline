import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { RenderScene } from "../rendering/RenderScene";
import type {
  LevelDefinition,
  LevelGeometryDefinition,
  LevelInteractionTargetDefinition,
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

/**
 * Instantiates authored box geometry as visual meshes and static Rapier
 * colliders, and registers level runtime objects.
 *
 * This is the initial "load the whole level" implementation; procedural
 * generation or asset streaming can replace this loader behind the same
 * runtime contract (`docs/15` §16.3).
 */
export class BoxLevelContentLoader {
  async load(
    definition: LevelDefinition,
    dependencies: LevelContentDependencies,
  ): Promise<LoadedLevelContent> {
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const materials = new Map<number, THREE.MeshStandardMaterial>();
    const meshes: THREE.Mesh[] = [];
    const bodies: RAPIER.RigidBody[] = [];
    const world = dependencies.physics.rapierWorld;

    const getMaterial = (color: number): THREE.MeshStandardMaterial => {
      const existing = materials.get(color);

      if (existing) {
        return existing;
      }

      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.06,
      });

      materials.set(color, material);

      return material;
    };

    const surfaceDefinitions = new Map(definition.surfaces.map((surface) => [surface.id, surface]));

    for (const geometry of definition.geometry) {
      const surfaceDefinition = surfaceDefinitions.get(geometry.surfaceId);

      if (!surfaceDefinition) {
        throw new Error(
          `Geometry "${geometry.id}" references unknown surface "${geometry.surfaceId}".`,
        );
      }

      const material = getMaterial(geometry.color ?? 0xc7c9c7);
      const mesh = new THREE.Mesh(unitBox, material);

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

        if (dependencies.physics.isInitialized) {
          for (const body of bodies) {
            world.removeRigidBody(body);
          }
        }

        unitBox.dispose();

        for (const material of materials.values()) {
          material.dispose();
        }

        meshes.length = 0;
        bodies.length = 0;
        materials.clear();
      },
    };
  }
}
