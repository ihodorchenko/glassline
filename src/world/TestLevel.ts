import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import type { CheckpointDefinition, SpawnPointDefinition } from "../checkpoint/CheckpointSystem";
import type { Disposable } from "../core/Disposable";
import type { InteractionTargetDefinition } from "../interaction/InteractionSystem";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { RenderScene } from "../rendering/RenderScene";

const CONCRETE = 0xc7c9c7;
const PURE_WHITE = 0xf1f1ed;
const STEEL = 0x747a7d;
const DARK_METAL = 0x33393d;
const RUNNER_RED = 0xd52e36;

const SPAWN_Y = 0.93;

type BoxSize = readonly [number, number, number];
type BoxPosition = readonly [number, number, number];

export interface TestLevelData {
  readonly initialSpawnPointId: string;
  readonly killPlaneY: number;
  readonly spawnPoints: readonly SpawnPointDefinition[];
  readonly checkpoints: readonly CheckpointDefinition[];
  readonly interactionTargets: readonly InteractionTargetDefinition[];
}

/**
 * Temporary Phase 3 test environment: authored geometry with matching static
 * colliders plus checkpoint triggers, spawn points, a fall pit, an interaction
 * terminal, and traversal features (vault obstacle, slide tunnel, wall-run
 * corridor).
 *
 * Final Training/Prologue content arrives with the Level Design/Runtime phases.
 */
export class TestLevel implements Disposable {
  private readonly physics: PhysicsWorld;
  private readonly renderScene: RenderScene;
  private readonly bodies: RAPIER.RigidBody[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly materials = new Map<number, THREE.MeshStandardMaterial>();
  private readonly data: TestLevelData;
  private disposed = false;

  constructor(physics: PhysicsWorld, renderScene: RenderScene) {
    this.physics = physics;
    this.renderScene = renderScene;

    this.buildGeometry();
    this.data = this.createLevelData();
  }

  getData(): TestLevelData {
    return this.data;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const mesh of this.meshes) {
      this.renderScene.removeObject(mesh);
    }

    if (this.physics.isInitialized) {
      const world = this.physics.rapierWorld;

      for (const body of this.bodies) {
        world.removeRigidBody(body);
      }
    }

    this.unitBox.dispose();

    for (const material of this.materials.values()) {
      material.dispose();
    }

    this.bodies.length = 0;
    this.meshes.length = 0;
    this.materials.clear();
  }

  private createLevelData(): TestLevelData {
    const spawnPoints: SpawnPointDefinition[] = [
      { id: "sp_initial", position: { x: 0, y: SPAWN_Y, z: 6 }, rotationY: 0 },
      { id: "sp_cp_01", position: { x: 0, y: SPAWN_Y, z: 3 }, rotationY: 0 },
      { id: "sp_cp_02", position: { x: 0, y: SPAWN_Y, z: -4 }, rotationY: 0 },
      { id: "sp_cp_03", position: { x: 0, y: SPAWN_Y, z: -18.5 }, rotationY: 0 },
    ];

    const checkpoints: CheckpointDefinition[] = [
      {
        id: "test_cp_rooftop",
        sectionId: "rooftop",
        displayName: "Rooftop",
        trigger: { center: { x: 0, y: 1, z: 3 }, halfExtents: { x: 3, y: 1.5, z: 2 } },
        spawnPointId: "sp_cp_01",
        respawnEnabled: true,
      },
      {
        id: "test_cp_industrial",
        sectionId: "industrial",
        displayName: "Industrial",
        trigger: { center: { x: 0, y: 1, z: -4 }, halfExtents: { x: 3, y: 1.5, z: 2 } },
        spawnPointId: "sp_cp_02",
        respawnEnabled: true,
      },
      {
        id: "test_cp_skybridge",
        sectionId: "skybridge",
        displayName: "Skybridge",
        trigger: { center: { x: 0, y: 1, z: -18.5 }, halfExtents: { x: 3, y: 1.5, z: 2 } },
        spawnPointId: "sp_cp_03",
        respawnEnabled: true,
      },
    ];

    const terminalHandle = this.terminalColliderHandle;

    const interactionTargets: InteractionTargetDefinition[] = [
      {
        id: "test_terminal",
        position: { x: 2.5, y: 1.2, z: -18 },
        radius: 2.5,
        prompt: "Press E to access the terminal",
        enabled: true,
        ...(terminalHandle === null ? {} : { colliderHandle: terminalHandle }),
      },
    ];

    return {
      initialSpawnPointId: "sp_initial",
      killPlaneY: -3,
      spawnPoints,
      checkpoints,
      interactionTargets,
    };
  }

  private buildGeometry(): void {
    // Ground plates leave a square fall pit at x/z in [8, 14] x [2, 8].
    this.addBox([30, 0.2, 44], [-7, -0.1, 0], CONCRETE);
    this.addBox([8, 0.2, 44], [18, -0.1, 0], CONCRETE);
    this.addBox([6, 0.2, 24], [11, -0.1, -10], CONCRETE);
    this.addBox([6, 0.2, 14], [11, -0.1, 15], CONCRETE);

    // Boundary walls.
    this.addBox([0.5, 3, 44], [-22.25, 1.5, 0], DARK_METAL);
    this.addBox([0.5, 3, 44], [22.25, 1.5, 0], DARK_METAL);
    this.addBox([44, 3, 0.5], [0, 1.5, -22.25], DARK_METAL);
    this.addBox([44, 3, 0.5], [0, 1.5, 22.25], DARK_METAL);

    // Vault obstacle on the start route.
    this.addBox([2.4, 0.75, 0.7], [0, 0.375, -1], PURE_WHITE);

    // Slide tunnel: ceiling bottom at 1.05 m (standing and crouch blocked, slide passes).
    this.addBox([0.4, 2.6, 4], [-1.9, 1.3, -7.6], STEEL);
    this.addBox([0.4, 2.6, 4], [1.9, 1.3, -7.6], STEEL);
    this.addBox([4, 0.2, 4], [0, 1.15, -7.6], STEEL);

    // Wall-run corridor.
    this.addBox([0.4, 3.4, 7], [-2.4, 1.7, -12.5], PURE_WHITE);
    this.addBox([0.4, 3.4, 7], [2.4, 1.7, -12.5], PURE_WHITE);

    // Interaction terminal and navigation accent.
    this.terminalColliderHandle = this.addBox([0.6, 1.2, 0.6], [2.5, 0.6, -18], DARK_METAL);
    this.addBox([0.5, 2.2, 0.5], [6, 1.1, -8], RUNNER_RED);

    // Small step feature near the start.
    this.addBox([1.6, 0.18, 1.6], [4, 0.09, 1], PURE_WHITE);
    this.addBox([1.6, 0.3, 1.6], [4, 0.15, -0.8], PURE_WHITE);
  }

  private addBox(size: BoxSize, position: BoxPosition, color: number): number {
    const material = this.getMaterial(color);
    const mesh = new THREE.Mesh(this.unitBox, material);

    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.renderScene.addObject(mesh);
    this.meshes.push(mesh);

    const body = this.physics.rapierWorld.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position[0], position[1], position[2]),
    );
    const collider = this.physics.rapierWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
        .setFriction(1)
        .setRestitution(0),
      body,
    );

    this.bodies.push(body);

    return collider.handle;
  }

  private getMaterial(color: number): THREE.MeshStandardMaterial {
    const existing = this.materials.get(color);

    if (existing) {
      return existing;
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0.06,
    });

    this.materials.set(color, material);

    return material;
  }

  private terminalColliderHandle: number | null = null;
}
