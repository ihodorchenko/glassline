import * as THREE from "three";

import type { Disposable } from "../core/Disposable";

/**
 * Visual world container: background, fog, and lighting.
 *
 * Camera ownership moved to the Camera System, and level geometry is provided
 * by level content (see `TestLevel` during Phase 2).
 */
export class RenderScene implements Disposable {
  readonly scene = new THREE.Scene();

  private disposed = false;

  constructor() {
    this.scene.background = new THREE.Color(0xa7b9c4);
    this.scene.fog = new THREE.Fog(0xa7b9c4, 70, 220);

    this.createLighting();
  }

  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
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
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(sun);
  }
}
