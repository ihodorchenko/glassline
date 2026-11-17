import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { RenderScene } from "../rendering/RenderScene";

const CONCRETE = 0xc7c9c7;
const PURE_WHITE = 0xf1f1ed;
const STEEL = 0x747a7d;
const DARK_METAL = 0x33393d;
const RUNNER_RED = 0xd52e36;

type BoxSize = readonly [number, number, number];
type BoxPosition = readonly [number, number, number];

/**
 * Temporary Phase 2 test environment: authored visual geometry with matching
 * static colliders.
 *
 * It is a verification level for the player controller, not the final Training
 * or Prologue content (those arrive with the Level Design/Runtime phases).
 */
export class TestLevel implements Disposable {
  private readonly physics: PhysicsWorld;
  private readonly renderScene: RenderScene;
  private readonly bodies: RAPIER.RigidBody[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly unitBox = new THREE.BoxGeometry(1, 1, 1);
  private readonly materials = new Map<number, THREE.MeshStandardMaterial>();
  private disposed = false;

  constructor(physics: PhysicsWorld, renderScene: RenderScene) {
    this.physics = physics;
    this.renderScene = renderScene;

    this.build();
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

  private build(): void {
    // Ground and boundary walls.
    this.addBox([44, 0.2, 44], [0, -0.1, 0], CONCRETE);
    this.addBox([0.5, 3, 40], [-19.75, 1.5, 0], DARK_METAL);
    this.addBox([0.5, 3, 40], [19.75, 1.5, 0], DARK_METAL);
    this.addBox([40, 3, 0.5], [0, 1.5, -19.75], DARK_METAL);
    this.addBox([40, 3, 0.5], [0, 1.5, 19.75], DARK_METAL);

    // Low step (climbable through autostep).
    this.addBox([1.6, 0.18, 1.6], [4, 0.09, 1], PURE_WHITE);
    this.addBox([1.6, 0.3, 1.6], [4, 0.15, -0.8], PURE_WHITE);

    // Obstacles for collision and air-control testing.
    this.addBox([2.5, 0.6, 1.2], [-2.5, 0.3, -2], STEEL);
    this.addBox([1.2, 2, 1.2], [-4.5, 1, -5], DARK_METAL);
    this.addBox([4, 0.5, 3], [0, 0.25, -7], PURE_WHITE);
    this.addBox([2, 1.4, 2], [0, 0.7, -10], PURE_WHITE);

    // Wall surface reserved for the Phase 3 wall-run work.
    this.addBox([10, 3, 0.4], [0, 1.5, -14], STEEL);

    // Navigation accent marker.
    this.addBox([0.5, 2.2, 0.5], [6, 1.1, -8], RUNNER_RED);
  }

  private addBox(size: BoxSize, position: BoxPosition, color: number): void {
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
    this.physics.rapierWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
        .setFriction(1)
        .setRestitution(0),
      body,
    );
    this.bodies.push(body);
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
}
