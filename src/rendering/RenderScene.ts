import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import { CityLife } from "./CityLife";
import { MaterialLibrary } from "./MaterialLibrary";
import { MenuBackdrop } from "./MenuBackdrop";
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

/** Art-direction hemisphere fill: 0.37 of sun (was 0.35). */
const HEMISPHERE_FILL_RATIO = 0.37 / 0.35;

/**
 * Interior ambient occlusion (W1.1 fix round, items 1+2).
 *
 * A screen-space GTAO term cannot tell a covered service block from an open
 * roof: measured large-radius AO is ~0.78 inside the block but 0.88-0.96 on the
 * roof deck (overlapping ranges), and it costs a second full scene pass. So the
 * renderer uses a deterministic *sky-visibility probe* at the camera instead:
 * nine rays into the upper hemisphere against level geometry give how much open
 * sky the camera can see. Open roofs probe ~1.0 and are bit-for-bit unchanged
 * (the start-roof luma budget is 0.0026); a covered block probes low and its
 * ambient/IBL is attenuated and pushed toward the neutral-cool #c8d4dc bounce.
 * Sun intensity, exposure and the grade are untouched.
 */
const AMBIENT_OCCLUSION_STRENGTH = 0.72;
const AMBIENT_BASE_INTENSITY = 0.08;
const PROBE_DISTANCE = 8;
const PROBE_MOVE_EPSILON = 0.08;

function probeDirections(): THREE.Vector3[] {
  // A narrow cone around the zenith: this detects a ceiling/duct directly above
  // the camera (a covered block) without counting distant facades, which would
  // wrongly occlude open roofs that happen to sit next to a tall building.
  const directions = [new THREE.Vector3(0, 1, 0)];
  const spread = Math.tan((22 * Math.PI) / 180);

  for (let index = 0; index < 8; index += 1) {
    const azimuth = (index / 8) * Math.PI * 2;
    directions.push(
      new THREE.Vector3(Math.cos(azimuth) * spread, 1, Math.sin(azimuth) * spread).normalize(),
    );
  }

  return directions;
}

const PROBE_DIRECTIONS = probeDirections();

const SUN_DISTANCE = 90;
const WORLD_FOCUS = new THREE.Vector3(0, 0, -48);

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
  readonly menuBackdrop: MenuBackdrop;
  readonly cityLife: CityLife;

  private readonly hemisphere: THREE.HemisphereLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly sky: SkyDome;
  private readonly baseHemisphereSky = new THREE.Color(0xdceafa);
  private readonly baseHemisphereGround = new THREE.Color(0x8f9bab);
  private readonly baseAmbientColor = new THREE.Color(0xb9d0e2);
  private renderer: THREE.WebGLRenderer | null = null;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private resolvedEnvironment = DEFAULT_ENVIRONMENT;
  private sunDirection = sunDirectionFromAngles(
    DEFAULT_ENVIRONMENT.sunAzimuth,
    DEFAULT_ENVIRONMENT.sunElevation,
  );
  private disposed = false;
  private reducedMotion = false;

  // Interior ambient probe state.
  private readonly probeRaycaster = new THREE.Raycaster();
  private readonly probeMeshes: THREE.Object3D[] = [];
  private readonly probeOrigin = new THREE.Vector3();
  private readonly lastProbePosition = new THREE.Vector3(Number.MAX_VALUE, 0, 0);
  private activeCamera: THREE.Camera | null = null;
  private probeInitialised = false;
  private ambientScale = 1;
  private ambientTarget = 1;
  private appliedAmbientScale = -1;

  constructor(renderer?: THREE.WebGLRenderer) {
    // Hemisphere provides the cool skylight fill; ambient is deliberately tiny
    // so it cannot flatten the directional key. The rim is a faint cool
    // kicker only (it used to act as a second key and washed the shadows out).
    this.hemisphere = new THREE.HemisphereLight(
      this.baseHemisphereSky,
      this.baseHemisphereGround,
      0.23,
    );
    this.ambient = new THREE.AmbientLight(this.baseAmbientColor, AMBIENT_BASE_INTENSITY);
    this.sun = new THREE.DirectionalLight(0xfff3df, 5.6);
    this.rim = new THREE.DirectionalLight(0xbcd8f0, 0.14);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    // PCF (Vogel-disk, 5 taps) with a ~1-texel radius: 4096 over the ~120 m
    // light frustum puts one texel at ~3-4 cm, i.e. a crisp but soft edge.
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 1;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 280;
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 92;
    this.sun.shadow.camera.bottom = -92;
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
    this.menuBackdrop = new MenuBackdrop(this.materials);
    this.cityLife = new CityLife();
    this.scene.add(this.sky.mesh, this.menuBackdrop.group, this.cityLife.group);

    this.setEnvironment(null);

    if (renderer) {
      this.attachRenderer(renderer);
    }
  }

  get skyDome(): SkyDome {
    return this.sky;
  }

  setMenuBackdropVisible(visible: boolean): void {
    this.menuBackdrop.setVisible(visible);
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.cityLife.setMotionEnabled(!enabled);
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
    // W1.1 fix round item 3: hemisphere fill 0.35 -> 0.37 of the key (+5.7 %),
    // soft-shell safety for the roof p25 / local contrast. Interior ambient
    // occlusion is a per-pixel post term (published via scene.userData below).
    this.hemisphere.intensity = resolved.hemisphereIntensity * HEMISPHERE_FILL_RATIO;
    this.applyAmbientState();

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
    this.probeMeshes.length = 0;

    if ((object as THREE.Camera).isCamera) {
      this.activeCamera = object as THREE.Camera;
    }
  }

  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
    this.probeMeshes.length = 0;

    if (this.activeCamera === object) {
      this.activeCamera = null;
    }
  }

  update(deltaSeconds: number): void {
    this.updateAmbientProbe(deltaSeconds);

    if (!this.reducedMotion) {
      this.sky.update(deltaSeconds);
    }

    this.cityLife.update(deltaSeconds);
  }

  /**
   * Deterministic sky-visibility probe (see the constants block). Runs only when
   * the camera has moved, so a frozen capture camera probes once and stays put.
   */
  private updateAmbientProbe(deltaSeconds: number): void {
    const camera = this.activeCamera;

    if (!camera) {
      return;
    }

    camera.getWorldPosition(this.probeOrigin);

    if (
      !this.probeInitialised ||
      this.probeOrigin.distanceTo(this.lastProbePosition) > PROBE_MOVE_EPSILON
    ) {
      this.lastProbePosition.copy(this.probeOrigin);
      this.probeInitialised = true;
      const skyVisibility = this.probeSkyVisibility();
      this.ambientTarget = 1 - AMBIENT_OCCLUSION_STRENGTH * (1 - skyVisibility);
    }

    if (deltaSeconds <= 0) {
      this.ambientScale = this.ambientTarget;
    } else {
      // Fast but smooth adaptation (~0.2 s) so walking under cover does not pop.
      this.ambientScale += (this.ambientTarget - this.ambientScale) * Math.min(1, deltaSeconds * 5);
    }

    if (Math.abs(this.ambientScale - this.appliedAmbientScale) > 0.002) {
      this.applyAmbientState();
    }
  }

  private probeSkyVisibility(): number {
    const meshes = this.collectProbeMeshes();
    let openRays = 0;

    if (meshes.length === 0) {
      return 1;
    }

    for (const direction of PROBE_DIRECTIONS) {
      this.probeRaycaster.set(this.probeOrigin, direction);
      this.probeRaycaster.far = PROBE_DISTANCE;

      if (this.probeRaycaster.intersectObjects(meshes, false).length === 0) {
        openRays += 1;
      }
    }

    return openRays / PROBE_DIRECTIONS.length;
  }

  /** Visible level meshes only: no sky dome, menu backdrop, bird flock or camera. */
  private collectProbeMeshes(): THREE.Object3D[] {
    if (this.probeMeshes.length > 0) {
      return this.probeMeshes;
    }

    const visit = (object: THREE.Object3D): void => {
      if (
        object === this.sky.mesh ||
        object === this.menuBackdrop.group ||
        object === this.cityLife.group ||
        object === this.activeCamera ||
        !object.visible
      ) {
        return;
      }

      if ((object as THREE.Mesh).isMesh) {
        this.probeMeshes.push(object);
      }

      for (const child of object.children) {
        visit(child);
      }
    };

    for (const child of this.scene.children) {
      visit(child);
    }

    return this.probeMeshes;
  }

  /**
   * Publishes the interior weight for the post-process ambient term. Open roofs
   * publish 0 and are therefore untouched; a covered block publishes ~0.6-1.0
   * and PostPipeline applies `ambient *= mix(1.0, AO, 0.75)` per pixel there.
   */
  private applyAmbientState(): void {
    const interiorWeight = 1 - this.ambientScale;
    this.scene.userData.ambientInteriorWeight = Math.min(1, Math.max(0, interiorWeight));
    this.appliedAmbientScale = this.ambientScale;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.sky.dispose();
    this.menuBackdrop.dispose();
    this.cityLife.dispose();
    this.materials.dispose();
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    this.scene.clear();
  }

  private createSkyState(environment: Required<SceneEnvironment>): SkyState {
    return {
      zenithColor: environment.zenithColor,
      // The level-owned sky colour doubles as the mid-gradient stop, so the
      // horizon -> mid -> zenith palette stays entirely data-driven.
      midColor: environment.skyColor,
      horizonColor: environment.horizonColor,
      groundColor: environment.groundColor,
      cloudColor: environment.cloudColor,
      cloudShadowColor: environment.cloudShadowColor,
      cloudCover: environment.cloudCover,
      sunColor: environment.sunColor,
      sunDirection: sunDirectionFromAngles(environment.sunAzimuth, environment.sunElevation),
      // Sky disc/glow track the directional key instead of a private constant.
      sunIntensity: environment.sunIntensity,
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
    this.scene.environmentIntensity = 0.78;
  }
}
