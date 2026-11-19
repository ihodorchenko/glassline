import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import { MaterialLibrary } from "./MaterialLibrary";
import { SkyDome, type SkyState } from "./SkyDome";

/**
 * Visual world container: sky, atmosphere, lighting, reflections.
 *
 * Camera ownership belongs to the Camera System, and level geometry is provided
 * by level content. This class owns everything that defines the look of the
 * world between levels.
 */
export interface SceneEnvironment {
  readonly skyColor: number;
  readonly fogColor: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly sunColor: number;
  readonly sunIntensity: number;
  readonly hemisphereIntensity: number;
  readonly zenithColor?: number;
  readonly horizonColor?: number;
  readonly groundColor?: number;
  readonly cloudColor?: number;
  readonly cloudShadowColor?: number;
  readonly cloudCover?: number;
  readonly sunAzimuth?: number;
  readonly sunElevation?: number;
}

const DEFAULT_ENVIRONMENT: Required<SceneEnvironment> = {
  skyColor: 0xa7b9c4,
  fogColor: 0xdfeaf2,
  fogNear: 90,
  fogFar: 560,
  sunColor: 0xfff3df,
  sunIntensity: 5.6,
  hemisphereIntensity: 0.3,
  zenithColor: 0x2a6cc4,
  horizonColor: 0xd3e9f8,
  groundColor: 0xc3d5df,
  cloudColor: 0xffffff,
  cloudShadowColor: 0xb4c8d8,
  cloudCover: 0.46,
  sunAzimuth: 2.25,
  sunElevation: 0.83,
};

const SUN_DISTANCE = 90;
const WORLD_FOCUS = new THREE.Vector3(0, 0, -6);

function resolveEnvironment(environment: SceneEnvironment | null): Required<SceneEnvironment> {
  if (!environment) {
    return DEFAULT_ENVIRONMENT;
  }

  return {
    ...DEFAULT_ENVIRONMENT,
    ...environment,
  };
}

function sunDirectionFromAngles(azimuth: number, elevation: number): THREE.Vector3 {
  const cosElevation = Math.cos(elevation);

  return new THREE.Vector3(
    Math.sin(azimuth) * cosElevation,
    Math.sin(elevation),
    -Math.cos(azimuth) * cosElevation,
  ).normalize();
}

export class RenderScene implements Disposable {
  readonly scene = new THREE.Scene();
  readonly materials = new MaterialLibrary();

  private readonly hemisphere: THREE.HemisphereLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly sky: SkyDome;
  private renderer: THREE.WebGLRenderer | null = null;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private resolvedEnvironment = DEFAULT_ENVIRONMENT;
  private sunDirection = sunDirectionFromAngles(
    DEFAULT_ENVIRONMENT.sunAzimuth,
    DEFAULT_ENVIRONMENT.sunElevation,
  );
  private disposed = false;

  constructor(renderer?: THREE.WebGLRenderer) {
    this.hemisphere = new THREE.HemisphereLight(0xd6e9fa, 0x9a968a, 0.3);
    this.ambient = new THREE.AmbientLight(0xb9d0e2, 0.24);
    this.sun = new THREE.DirectionalLight(0xfff3df, 5.6);
    this.rim = new THREE.DirectionalLight(0xbcd8f0, 0.42);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.updateProjectionMatrix();

    this.sun.target.position.copy(WORLD_FOCUS);
    this.scene.add(
      this.hemisphere,
      this.ambient,
      this.sun,
      this.sun.target,
      this.rim,
      this.rim.target,
    );

    this.sky = new SkyDome(this.createSkyState(this.resolvedEnvironment));
    this.scene.add(this.sky.mesh);

    this.setEnvironment(null);

    if (renderer) {
      this.attachRenderer(renderer);
    }
  }

  get skyDome(): SkyDome {
    return this.sky;
  }

  /** Connects the renderer so the scene can build its sky reflection probe. */
  attachRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
    this.refreshEnvironmentMap();
  }

  /** Applies level-owned visual atmosphere; `null` restores the default scene. */
  setEnvironment(environment: SceneEnvironment | null): void {
    const resolved = resolveEnvironment(environment);

    this.resolvedEnvironment = resolved;

    this.scene.background = new THREE.Color(resolved.skyColor);
    this.scene.fog = new THREE.Fog(resolved.fogColor, resolved.fogNear, resolved.fogFar);

    this.sun.color.setHex(resolved.sunColor);
    this.sun.intensity = resolved.sunIntensity;
    this.hemisphere.intensity = resolved.hemisphereIntensity;

    this.sunDirection = sunDirectionFromAngles(resolved.sunAzimuth, resolved.sunElevation);
    this.sun.position.copy(this.sunDirection).multiplyScalar(SUN_DISTANCE).add(WORLD_FOCUS);
    this.sun.target.position.copy(WORLD_FOCUS);
    this.rim.position
      .copy(this.sunDirection)
      .multiplyScalar(-SUN_DISTANCE)
      .add(new THREE.Vector3(24, 32, 12));
    this.rim.target.position.copy(WORLD_FOCUS);

    this.sky.setState(this.createSkyState(resolved));

    if (this.renderer) {
      this.refreshEnvironmentMap();
    }
  }

  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
  }

  update(deltaSeconds: number): void {
    this.sky.update(deltaSeconds);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.sky.dispose();
    this.materials.dispose();
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    this.scene.clear();
  }

  private createSkyState(environment: Required<SceneEnvironment>): SkyState {
    return {
      zenithColor: environment.zenithColor,
      horizonColor: environment.horizonColor,
      groundColor: environment.groundColor,
      cloudColor: environment.cloudColor,
      cloudShadowColor: environment.cloudShadowColor,
      cloudCover: environment.cloudCover,
      sunColor: environment.sunColor,
      sunDirection: sunDirectionFromAngles(environment.sunAzimuth, environment.sunElevation),
      sunIntensity: 1.15,
    };
  }

  private refreshEnvironmentMap(): void {
    if (!this.renderer) {
      return;
    }

    const generator = new THREE.PMREMGenerator(this.renderer);
    const probeScene = new THREE.Scene();
    const probe = new THREE.Mesh(this.sky.mesh.geometry, this.sky.mesh.material);

    probe.frustumCulled = false;
    probeScene.add(probe);

    const target = generator.fromScene(probeScene, 0.035, 0.1, 900);

    generator.dispose();

    this.environmentTarget?.dispose();
    this.environmentTarget = target;
    this.scene.environment = target.texture;
    this.scene.environmentIntensity = 0.9;
  }
}
