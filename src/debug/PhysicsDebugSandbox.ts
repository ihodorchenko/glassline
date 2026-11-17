import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { RenderScene } from "../rendering/RenderScene";

/**
 * Temporary Phase 1 integration smoke test: a dynamic cube falling onto a static
 * ground collider, rendered by Three.js.
 *
 * This validates renderer + physics + fixed-step loop integration. It is NOT
 * gameplay content and must be removed when the player controller and level
 * runtime arrive (Phase 2–4).
 */
export class PhysicsDebugSandbox implements Disposable {
  private readonly physics: PhysicsWorld;
  private readonly renderScene: RenderScene;
  private readonly cubeBody: RAPIER.RigidBody;
  private readonly groundBody: RAPIER.RigidBody;
  private readonly cubeMesh: THREE.Mesh;
  private readonly cubeGeometry: THREE.BoxGeometry;
  private readonly cubeMaterial: THREE.MeshStandardMaterial;
  private disposed = false;

  constructor(physics: PhysicsWorld, renderScene: RenderScene) {
    this.physics = physics;
    this.renderScene = renderScene;

    const world = physics.rapierWorld;

    this.groundBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(24, 0.1, 24).setFriction(0.9), this.groundBody);

    this.cubeBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 3.2, -2).setLinearDamping(0.05),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setRestitution(0.25).setFriction(0.8),
      this.cubeBody,
    );

    this.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.cubeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd52e36,
      roughness: 0.55,
      metalness: 0.15,
    });
    this.cubeMesh = new THREE.Mesh(this.cubeGeometry, this.cubeMaterial);
    this.cubeMesh.castShadow = true;
    this.cubeMesh.receiveShadow = true;
    this.renderScene.scene.add(this.cubeMesh);

    this.syncMesh();
  }

  /** Copies the authoritative physics transform to the visual mesh. */
  syncMesh(): void {
    if (this.disposed) {
      return;
    }

    const translation = this.cubeBody.translation();
    const rotation = this.cubeBody.rotation();

    this.cubeMesh.position.set(translation.x, translation.y, translation.z);
    this.cubeMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.renderScene.scene.remove(this.cubeMesh);
    this.cubeGeometry.dispose();
    this.cubeMaterial.dispose();

    if (this.physics.isInitialized) {
      const world = this.physics.rapierWorld;

      world.removeRigidBody(this.cubeBody);
      world.removeRigidBody(this.groundBody);
    }
  }
}
