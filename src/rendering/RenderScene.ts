import * as THREE from "three";

import type { Disposable } from "../core/Disposable";

/**
 * Visual world container: background, fog, and lighting.
 *
 * Camera ownership moved to the Camera System, and level geometry is provided
 * by level content (see `TestLevel` during Phase 2).
 */
export interface SceneEnvironment {
  readonly skyColor: number;
  readonly fogColor: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly sunColor: number;
  readonly sunIntensity: number;
  readonly hemisphereIntensity: number;
}

const DEFAULT_ENVIRONMENT: SceneEnvironment = {
  skyColor: 0xa7b9c4,
  fogColor: 0xa7b9c4,
  fogNear: 70,
  fogFar: 220,
  sunColor: 0xffffff,
  sunIntensity: 1.6,
  hemisphereIntensity: 1.15,
};

export class RenderScene implements Disposable {
  readonly scene = new THREE.Scene();

  private readonly hemisphere: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private disposed = false;

  constructor() {
    this.hemisphere = new THREE.HemisphereLight(0xffffff, 0x7d858a, 1.15);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.scene.add(this.hemisphere, this.sun);
    this.createLighting();
    this.setEnvironment(null);
  }

  /** Applies level-owned visual atmosphere; `null` restores the default scene. */
  setEnvironment(environment: SceneEnvironment | null): void {
    const resolved = environment ?? DEFAULT_ENVIRONMENT;

    this.scene.background = new THREE.Color(resolved.skyColor);
    this.scene.fog = new THREE.Fog(resolved.fogColor, resolved.fogNear, resolved.fogFar);
    this.sun.color.setHex(resolved.sunColor);
    this.sun.intensity = resolved.sunIntensity;
    this.hemisphere.intensity = resolved.hemisphereIntensity;
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
    this.sun.position.set(9, 15, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
  }
}
