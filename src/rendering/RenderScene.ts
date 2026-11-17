import * as THREE from "three";

import type { Disposable } from "../core/Disposable";

export interface RenderSceneOptions {
  readonly fovDegrees: number;
  readonly nearPlane: number;
  readonly farPlane: number;
}

const SKY_COLOR = 0xa7b9c4;
const CONCRETE_COLOR = 0xc7c9c7;
const PURE_WHITE = 0xf1f1ed;
const DARK_METAL = 0x33393d;
const STEEL = 0x747a7d;
const RUNNER_RED = 0xd52e36;

/**
 * Holds the visual world: scene graph, camera, lighting, and placeholder geometry.
 *
 * The environment is a technical placeholder for the Phase 1 smoke test.
 * Real level content is produced by the Level Runtime and procedural generators.
 */
export class RenderScene implements Disposable {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private disposed = false;

  constructor(options: RenderSceneOptions) {
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 70, 220);

    this.camera = new THREE.PerspectiveCamera(
      options.fovDegrees,
      1,
      options.nearPlane,
      options.farPlane,
    );
    this.camera.position.set(0, 1.6, 7);
    this.camera.lookAt(0, 1.1, 0);

    this.createLighting();
    this.createEnvironment();
  }

  resize(width: number, height: number): void {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);

    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const geometry of this.geometries) {
      geometry.dispose();
    }

    for (const material of this.materials) {
      material.dispose();
    }

    this.geometries.length = 0;
    this.materials.length = 0;
    this.scene.clear();
  }

  private createLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x7d858a, 1.15);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(9, 15, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 24;
    sun.shadow.camera.bottom = -24;
    this.scene.add(sun);
  }

  private createEnvironment(): void {
    const groundGeometry = new THREE.PlaneGeometry(120, 120);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: CONCRETE_COLOR,
      roughness: 0.96,
      metalness: 0,
    });
    const ground = this.createMesh(groundGeometry, groundMaterial);

    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Large architectural silhouettes to validate lighting, fog, and contrast.
    this.addBox([7, 3.5, 5], [-9, 1.75, -7], PURE_WHITE);
    this.addBox([4.5, 7, 4.5], [10, 3.5, -12], PURE_WHITE);
    this.addBox([3, 2, 3], [-4.5, 1, -11], DARK_METAL);
    this.addBox([6, 1.2, 2.2], [3.5, 0.6, -4.5], STEEL);
    this.addBox([2.2, 2.6, 2.2], [7, 1.3, -2.5], DARK_METAL);
    this.addBox([0.7, 2.6, 0.7], [0, 1.3, -13], RUNNER_RED, true);
  }

  private addBox(
    size: readonly [number, number, number],
    position: readonly [number, number, number],
    color: number,
    emissive = false,
  ): void {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0.06,
      emissive: emissive ? color : 0x000000,
      emissiveIntensity: emissive ? 0.35 : 0,
    });
    const mesh = this.createMesh(geometry, material);

    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private createMesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    this.geometries.push(geometry);
    this.materials.push(material);

    return new THREE.Mesh(geometry, material);
  }
}
