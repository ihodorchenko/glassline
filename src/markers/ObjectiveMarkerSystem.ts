/**
 * In-world objective marker: a small red four-sided pyramid (apex down) floating
 * above the active target with an optional ring decal on the surface.
 *
 * Presentation-only system (`docs/reports/UX_CITY_TARGETS.md` §1). It owns no
 * gameplay state: the target comes from the composition root each frame, the
 * marker is hidden outside gameplay, in capture mode and when the active
 * objective has no world position. Geometry and materials are created once and
 * the per-frame path only writes transforms/opacity (zero allocations).
 */

import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import type { Vector3Like } from "../shared/math";
import {
  computeObjectiveMarkerFadeAlpha,
  computeObjectiveMarkerPose,
  createObjectiveMarkerTarget,
  OBJECTIVE_MARKER_BASE_SIZE,
  OBJECTIVE_MARKER_COLOR,
  OBJECTIVE_MARKER_EMISSION,
  OBJECTIVE_MARKER_HEIGHT,
  OBJECTIVE_MARKER_METALNESS,
  OBJECTIVE_MARKER_RING_DIAMETER,
  OBJECTIVE_MARKER_RING_HEIGHT,
  OBJECTIVE_MARKER_ROUGHNESS,
  type ObjectiveMarkerPose,
  type ObjectiveMarkerTarget,
} from "./ObjectiveMarkerRules";

/** Scene registration hooks supplied by the composition root (RenderScene). */
export interface ObjectiveMarkerSceneHooks {
  addObject(object: THREE.Object3D): void;
  removeObject(object: THREE.Object3D): void;
}

export interface ObjectiveMarkerSystemOptions extends ObjectiveMarkerSceneHooks {
  /** Writes the active target into the reusable container; false hides the marker. */
  readonly resolveTarget: (out: ObjectiveMarkerTarget) => boolean;
  /** Existing reduced-motion setting (camera/accessibility). */
  readonly getReducedMotion: () => boolean;
  /** Deterministic capture boot: the marker never spawns. */
  readonly captureMode: boolean;
  /**
   * Optional authoritative surface resolution (downward physics ray). Receives
   * the authored target point and returns the marked surface Y, or null to use
   * the authored fallback offset.
   */
  readonly resolveSurfaceY?: (x: number, y: number, z: number) => number | null;
}

/** Read-only marker state for tests and diagnostics (not used per frame). */
export interface ObjectiveMarkerSnapshot {
  readonly visible: boolean;
  readonly attached: boolean;
  readonly hasTarget: boolean;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  readonly alpha: number;
  readonly surfaceY: number;
}

/**
 * Creates the pyramid material.
 *
 * Runner red with a small emissive term so it reads in shadow; roughness/met
 * match the AD brief and the emission stays under the 0.15 cap (no glow pass,
 * no bloom: the HDR threshold is above this value).
 */
export function createObjectiveMarkerMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: OBJECTIVE_MARKER_COLOR,
    roughness: OBJECTIVE_MARKER_ROUGHNESS,
    metalness: OBJECTIVE_MARKER_METALNESS,
    emissive: OBJECTIVE_MARKER_COLOR,
    emissiveIntensity: OBJECTIVE_MARKER_EMISSION,
    flatShading: true,
    transparent: true,
    opacity: 1,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/** Creates the flat ring-decal material (same red, depth-tested, no x-ray). */
export function createObjectiveMarkerRingMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: OBJECTIVE_MARKER_COLOR,
    roughness: OBJECTIVE_MARKER_ROUGHNESS,
    metalness: OBJECTIVE_MARKER_METALNESS,
    emissive: OBJECTIVE_MARKER_COLOR,
    emissiveIntensity: OBJECTIVE_MARKER_EMISSION,
    transparent: true,
    opacity: 1,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
}

/** Builds the apex-down square pyramid geometry with its apex at local Y = 0. */
export function createObjectiveMarkerGeometry(): THREE.ConeGeometry {
  const radius = OBJECTIVE_MARKER_BASE_SIZE / Math.SQRT2;
  const geometry = new THREE.ConeGeometry(radius, OBJECTIVE_MARKER_HEIGHT, 4);

  // ConeGeometry has its apex up and base down; flip so the apex points down,
  // then offset so the apex sits at the mesh origin (position = apex world Y).
  geometry.rotateX(Math.PI);
  geometry.translate(0, OBJECTIVE_MARKER_HEIGHT / 2, 0);

  return geometry;
}

/** Builds the flat ring decal lying in the XZ plane around the local origin. */
export function createObjectiveMarkerRingGeometry(): THREE.RingGeometry {
  const outerRadius = OBJECTIVE_MARKER_RING_DIAMETER / 2;
  const innerRadius = outerRadius * 0.8;
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);

  geometry.rotateX(-Math.PI / 2);

  return geometry;
}

export class ObjectiveMarkerSystem implements Disposable {
  private readonly options: ObjectiveMarkerSystemOptions;
  private readonly pyramid: THREE.Mesh<THREE.ConeGeometry, THREE.MeshStandardMaterial>;
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial>;
  private readonly target = createObjectiveMarkerTarget();
  private readonly pose: ObjectiveMarkerPose = { apexY: 0, yaw: 0 };

  private attached = false;
  private hasTarget = false;
  private disposed = false;
  private surfaceY = 0;
  private alpha = 0;
  private resolvedX = Number.NaN;
  private resolvedY = Number.NaN;
  private resolvedZ = Number.NaN;

  constructor(options: ObjectiveMarkerSystemOptions) {
    this.options = options;
    this.pyramid = new THREE.Mesh(createObjectiveMarkerGeometry(), createObjectiveMarkerMaterial());
    this.ring = new THREE.Mesh(
      createObjectiveMarkerRingGeometry(),
      createObjectiveMarkerRingMaterial(),
    );

    this.pyramid.name = "objective-marker-pyramid";
    this.ring.name = "objective-marker-ring";
    this.pyramid.visible = false;
    this.ring.visible = false;
    this.pyramid.castShadow = false;
    this.pyramid.receiveShadow = false;
    this.ring.castShadow = false;
    this.ring.receiveShadow = false;
  }

  /** True while a marker is actually drawn (target exists and is not faded out). */
  get isVisible(): boolean {
    return this.pyramid.visible;
  }

  get isAttached(): boolean {
    return this.attached;
  }

  /**
   * Advances the marker for one rendered frame.
   *
   * `elapsedSeconds` is the application/gameplay clock (fixed-step accumulated),
   * so bob and yaw are frame-rate independent and deterministic.
   */
  update(cameraPosition: Vector3Like, elapsedSeconds: number): void {
    if (this.disposed) {
      return;
    }

    // Capture mode must keep the review frames byte-identical: no target is
    // resolved and no geometry is ever registered with the scene.
    if (this.options.captureMode) {
      return;
    }

    if (!this.options.resolveTarget(this.target)) {
      this.hide();

      return;
    }

    const changed =
      this.target.x !== this.resolvedX ||
      this.target.y !== this.resolvedY ||
      this.target.z !== this.resolvedZ;

    if (!this.attached || changed) {
      this.surfaceY = this.resolveSurfaceY();
      this.resolvedX = this.target.x;
      this.resolvedY = this.target.y;
      this.resolvedZ = this.target.z;
      this.attach();
    }

    const reducedMotion = this.options.getReducedMotion();

    computeObjectiveMarkerPose(this.pose, elapsedSeconds, this.surfaceY, reducedMotion);

    this.pyramid.position.set(this.target.x, this.pose.apexY, this.target.z);
    this.pyramid.rotation.y = this.pose.yaw;
    this.ring.position.set(
      this.target.x,
      this.surfaceY + OBJECTIVE_MARKER_RING_HEIGHT,
      this.target.z,
    );

    const deltaX = this.target.x - cameraPosition.x;
    const deltaY = this.pose.apexY - cameraPosition.y;
    const deltaZ = this.target.z - cameraPosition.z;
    const distance = Math.hypot(deltaX, deltaY, deltaZ);
    const alpha = computeObjectiveMarkerFadeAlpha(distance);

    this.alpha = alpha;
    this.pyramid.material.opacity = alpha;
    this.ring.material.opacity = alpha;

    const visible = alpha > 0.001;

    this.hasTarget = true;
    this.pyramid.visible = visible;
    this.ring.visible = visible;
  }

  /** Snapshot for tests/diagnostics; allocates, so it is not used per frame. */
  getSnapshot(): ObjectiveMarkerSnapshot {
    return {
      visible: this.pyramid.visible,
      attached: this.attached,
      hasTarget: this.hasTarget,
      position: {
        x: this.pyramid.position.x,
        y: this.pyramid.position.y,
        z: this.pyramid.position.z,
      },
      yaw: this.pyramid.rotation.y,
      alpha: this.alpha,
      surfaceY: this.surfaceY,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.attached) {
      this.options.removeObject(this.pyramid);
      this.options.removeObject(this.ring);
      this.attached = false;
    }

    this.pyramid.geometry.dispose();
    this.pyramid.material.dispose();
    this.ring.geometry.dispose();
    this.ring.material.dispose();
    this.pyramid.visible = false;
    this.ring.visible = false;
  }

  private attach(): void {
    if (this.attached) {
      return;
    }

    this.options.addObject(this.pyramid);
    this.options.addObject(this.ring);
    this.attached = true;
  }

  private hide(): void {
    this.hasTarget = false;
    this.alpha = 0;
    this.pyramid.visible = false;
    this.ring.visible = false;
  }

  private resolveSurfaceY(): number {
    const fallback = this.target.y + this.target.surfaceOffsetY;
    const resolver = this.options.resolveSurfaceY;

    if (!resolver) {
      return fallback;
    }

    const resolved = resolver(this.target.x, this.target.y, this.target.z);

    if (resolved === null || !Number.isFinite(resolved)) {
      return fallback;
    }

    // Guard against a ray that started inside geometry or hit an overhead:
    // the marked surface must sit below the target point and within reach.
    if (resolved > this.target.y + 0.05 || resolved < this.target.y - 5) {
      return fallback;
    }

    return resolved;
  }
}
