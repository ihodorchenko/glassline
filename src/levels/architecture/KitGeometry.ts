/**
 * Architectural Kit — geometry construction helpers.
 *
 * The kit is built from shared primitive geometry (beveled boxes, cylinders,
 * extruded architectural profiles) which is cached per module build and then
 * merged into one geometry per material. That gives every authored module a
 * small, stable part list (usually 3-5 material batches) that the level loader
 * can instance across every placement of the same module variant.
 *
 * Ownership: geometries created by {@link KitGeometryPool} are shared and
 * disposed once by the pool; ad-hoc extruded profiles are owned by the
 * {@link KitPartCollector} and released as soon as the merged parts exist.
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { MaterialKey } from "../../rendering/MaterialLibrary";
import type { KitModulePart } from "./KitTypes";

export type Vector3Tuple = readonly [number, number, number];

export interface KitPartOptions {
  readonly position?: Vector3Tuple;
  readonly rotation?: Vector3Tuple;
  readonly scale?: Vector3Tuple;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

interface PendingPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: MaterialKey;
  readonly matrix: THREE.Matrix4;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
  readonly owned: boolean;
}

const DEFAULT_CAST_SHADOW = true;
const DEFAULT_RECEIVE_SHADOW = true;

function clampBevel(size: readonly number[], bevel: number): number {
  const limit = Math.min(...size) * 0.24;

  return Math.max(0.0015, Math.min(bevel, limit));
}

/** Rounded rectangle outline centred on (0, 0), used for frames and columns. */
export function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corner = Math.max(0, Math.min(radius, halfWidth - 1e-4, halfHeight - 1e-4));
  const shape = new THREE.Shape();

  if (corner <= 1e-4) {
    shape.moveTo(-halfWidth, -halfHeight);
    shape.lineTo(halfWidth, -halfHeight);
    shape.lineTo(halfWidth, halfHeight);
    shape.lineTo(-halfWidth, halfHeight);
    shape.closePath();

    return shape;
  }

  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + corner);
  shape.lineTo(halfWidth, halfHeight - corner);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - corner, halfHeight);
  shape.lineTo(-halfWidth + corner, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - corner);
  shape.lineTo(-halfWidth, -halfHeight + corner);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + corner, -halfHeight);
  shape.closePath();

  return shape;
}

/** Rectangular ring (door/window surround) with a centred opening. */
export function rectRingShape(
  width: number,
  height: number,
  border: number,
  cornerRadius = 0,
  borderY = border,
): THREE.Shape {
  const shape = roundedRectShape(width, height, cornerRadius);
  const innerWidth = width - border * 2;
  const innerHeight = height - borderY * 2;
  const hole = new THREE.Path();

  if (innerWidth <= 0 || innerHeight <= 0) {
    return shape;
  }

  const innerRadius = Math.max(0, cornerRadius - Math.min(border, borderY) * 0.6);
  const halfWidth = innerWidth / 2;
  const halfHeight = innerHeight / 2;
  const corner = Math.max(0, Math.min(innerRadius, halfWidth - 1e-4, halfHeight - 1e-4));

  if (corner <= 1e-4) {
    hole.moveTo(-halfWidth, -halfHeight);
    hole.lineTo(halfWidth, -halfHeight);
    hole.lineTo(halfWidth, halfHeight);
    hole.lineTo(-halfWidth, halfHeight);
    hole.closePath();
  } else {
    hole.moveTo(-halfWidth + corner, -halfHeight);
    hole.lineTo(halfWidth - corner, -halfHeight);
    hole.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + corner);
    hole.lineTo(halfWidth, halfHeight - corner);
    hole.quadraticCurveTo(halfWidth, halfHeight, halfWidth - corner, halfHeight);
    hole.lineTo(-halfWidth + corner, halfHeight);
    hole.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - corner);
    hole.lineTo(-halfWidth, -halfHeight + corner);
    hole.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + corner, -halfHeight);
    hole.closePath();
  }

  shape.holes.push(hole);

  return shape;
}

/** Closed polygon shape from (x, y) points. */
export function polygonShape(points: readonly (readonly [number, number])[]): THREE.Shape {
  const shape = new THREE.Shape();

  points.forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });

  shape.closePath();

  return shape;
}

export class KitGeometryPool {
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly boxCache = new Map<string, THREE.BufferGeometry>();
  private readonly roundedBoxCache = new Map<string, THREE.BufferGeometry>();
  private readonly cylinderCache = new Map<string, THREE.BufferGeometry>();

  /** Plain box (no bevel) — for thin mullions, glass panes and gaskets. */
  box(width: number, height: number, depth: number): THREE.BufferGeometry {
    const key = `${width}:${height}:${depth}`;
    const cached = this.boxCache.get(key);

    if (cached) {
      return cached;
    }

    const geometry = new THREE.BoxGeometry(width, height, depth);

    this.boxCache.set(key, geometry);
    this.geometries.push(geometry);

    return geometry;
  }

  /** Beveled box — for concrete volumes, sills, panels and treads. */
  roundedBox(width: number, height: number, depth: number, bevel = 0.03): THREE.BufferGeometry {
    const radius = clampBevel([width, height, depth], bevel);
    const key = `${width}:${height}:${depth}:${radius}`;
    const cached = this.roundedBoxCache.get(key);

    if (cached) {
      return cached;
    }

    const geometry = new RoundedBoxGeometry(width, height, depth, 2, radius);

    this.roundedBoxCache.set(key, geometry);
    this.geometries.push(geometry);

    return geometry;
  }

  /** Smooth-shaded cylinder — pipes, rods, handrails. */
  cylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments = 12,
  ): THREE.BufferGeometry {
    const key = `${radiusTop}:${radiusBottom}:${height}:${radialSegments}`;
    const cached = this.cylinderCache.get(key);

    if (cached) {
      return cached;
    }

    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1);

    this.cylinderCache.set(key, geometry);
    this.geometries.push(geometry);

    return geometry;
  }

  /**
   * Faceted cylinder with flat normals — tapered concrete columns, octagonal
   * posts. Indexed geometry is expanded once so each face gets its own normal.
   */
  facetedCylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    sides = 8,
  ): THREE.BufferGeometry {
    const key = `faceted:${radiusTop}:${radiusBottom}:${height}:${sides}`;
    const cached = this.cylinderCache.get(key);

    if (cached) {
      return cached;
    }

    const source = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides, 1);
    const geometry = source.toNonIndexed();

    source.dispose();
    geometry.computeVertexNormals();

    this.cylinderCache.set(key, geometry);
    this.geometries.push(geometry);

    return geometry;
  }

  /**
   * Disposes every cached primitive. Failures are aggregated after all
   * geometries have been attempted; failed geometries stay in the pool so a
   * subsequent call can retry them without re-disposing the successful ones.
   */
  dispose(): void {
    const failures: unknown[] = [];
    const retained: THREE.BufferGeometry[] = [];

    for (const geometry of this.geometries) {
      try {
        geometry.dispose();
      } catch (error) {
        failures.push(error);
        retained.push(geometry);
      }
    }

    this.geometries.length = 0;
    this.geometries.push(...retained);

    if (this.geometries.length === 0) {
      this.boxCache.clear();
      this.roundedBoxCache.clear();
      this.cylinderCache.clear();
    }

    if (failures.length > 0) {
      throw new Error(
        `Failed to dispose ${failures.length} architectural kit ${failures.length === 1 ? "geometry" : "geometries"}.`,
        { cause: failures[0] },
      );
    }
  }
}

/**
 * Collects positioned primitives for one module and merges them into one
 * geometry per material/shadow combination.
 */
export class KitPartCollector {
  private readonly pending: PendingPart[] = [];

  constructor(private readonly pool: KitGeometryPool) {}

  /**
   * Releases every collector-owned geometry that has not been merged yet.
   * Safe to call after a failed build and after {@link finish}; repeated calls
   * are no-ops because the pending list is cleared.
   */
  abort(): void {
    for (const part of this.pending) {
      if (part.owned) {
        part.geometry.dispose();
      }
    }

    this.pending.length = 0;
  }

  /** Adds a shared-pool primitive. The pool owns the geometry. */
  addShared(
    geometry: THREE.BufferGeometry,
    material: MaterialKey,
    options: KitPartOptions = {},
  ): void {
    this.push(geometry, material, options, false);
  }

  /** Adds a collector-owned geometry (extruded profile, custom buffer). */
  addOwned(
    geometry: THREE.BufferGeometry,
    material: MaterialKey,
    options: KitPartOptions = {},
  ): void {
    this.push(geometry, material, options, true);
  }

  box(
    size: Vector3Tuple,
    position: Vector3Tuple,
    material: MaterialKey,
    options: Omit<KitPartOptions, "position" | "scale"> & { readonly bevel?: number } = {},
  ): void {
    this.assertPositive(size, "box");

    const geometry =
      options.bevel === undefined
        ? this.pool.box(size[0], size[1], size[2])
        : this.pool.roundedBox(size[0], size[1], size[2], options.bevel);

    this.addShared(geometry, material, {
      position,
      ...(options.rotation === undefined ? {} : { rotation: options.rotation }),
      castShadow: options.castShadow ?? DEFAULT_CAST_SHADOW,
      receiveShadow: options.receiveShadow ?? DEFAULT_RECEIVE_SHADOW,
    });
  }

  roundedBox(
    size: Vector3Tuple,
    position: Vector3Tuple,
    material: MaterialKey,
    options: Omit<KitPartOptions, "position" | "scale"> & { readonly bevel?: number } = {},
  ): void {
    this.box(size, position, material, { ...options, bevel: options.bevel ?? 0.03 });
  }

  cylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    position: Vector3Tuple,
    material: MaterialKey,
    options: Omit<KitPartOptions, "position" | "scale"> & { readonly sides?: number } = {},
  ): void {
    this.assertPositive([radiusTop, radiusBottom, height], "cylinder");

    const geometry = options.sides
      ? this.pool.facetedCylinder(radiusTop, radiusBottom, height, options.sides)
      : this.pool.cylinder(radiusTop, radiusBottom, height);

    this.addShared(geometry, material, {
      position,
      ...(options.rotation === undefined ? {} : { rotation: options.rotation }),
      castShadow: options.castShadow ?? DEFAULT_CAST_SHADOW,
      receiveShadow: options.receiveShadow ?? DEFAULT_RECEIVE_SHADOW,
    });
  }

  /**
   * Extrudes a 2D shape along Z, centred on local z = 0. The shape is authored
   * in the module's XY plane (frames, joints, tapered profiles).
   *
   * `bevelOffset` follows the extrusion's own semantics: the bevel starts that
   * far from the authored outline. A negative offset equal to `bevel` turns
   * the default outward roll into a *chamfer* — the end faces come out inset
   * and the widest section sits mid-depth — which is how a pressed cassette
   * plate is authored (curtain-wall spandrel, Step 2.3C).
   */
  extrusion(
    shape: THREE.Shape,
    depth: number,
    position: Vector3Tuple,
    material: MaterialKey,
    options: Omit<KitPartOptions, "position" | "scale"> & {
      readonly bevel?: number;
      readonly bevelOffset?: number;
    } = {},
  ): void {
    this.assertPositive([depth], "extrusion depth");

    const bevel = options.bevel ?? 0.015;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelOffset: options.bevelOffset ?? 0,
      bevelSegments: 1,
      curveSegments: 6,
      steps: 1,
    });

    geometry.translate(0, 0, -depth / 2);
    geometry.clearGroups();

    this.addOwned(geometry, material, {
      position,
      ...(options.rotation === undefined ? {} : { rotation: options.rotation }),
      castShadow: options.castShadow ?? DEFAULT_CAST_SHADOW,
      receiveShadow: options.receiveShadow ?? DEFAULT_RECEIVE_SHADOW,
    });
  }

  /**
   * Extrudes a cross-section authored as (z, y) points along X. Used for the
   * horizontal architectural profiles: copings, fascias, slab edges, blades.
   * The resulting solid is centred on x = 0.
   */
  profileAlongX(
    profile: readonly (readonly [number, number])[],
    length: number,
    position: Vector3Tuple,
    material: MaterialKey,
    options: Omit<KitPartOptions, "position" | "scale"> & { readonly bevel?: number } = {},
  ): void {
    this.assertPositive([length], "profile length");

    const shape = polygonShape(profile);
    const bevel = options.bevel ?? 0.012;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: length,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      curveSegments: 4,
      steps: 1,
    });

    // Shape x becomes world z, extrusion becomes -x: rotate the solid so the
    // profile cross-section faces +X and the run is centred on the origin.
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(length / 2, 0, 0);
    geometry.clearGroups();

    this.addOwned(geometry, material, {
      position,
      ...(options.rotation === undefined ? {} : { rotation: options.rotation }),
      castShadow: options.castShadow ?? DEFAULT_CAST_SHADOW,
      receiveShadow: options.receiveShadow ?? DEFAULT_RECEIVE_SHADOW,
    });
  }

  /**
   * Merges every collected primitive into one part per material batch.
   *
   * The merged parts become the caller's property. On any failure the
   * intermediate clones, already merged parts and collector-owned geometries
   * are released before the error is rethrown, so a failed build cannot leak
   * GPU geometry.
   */
  finish(): readonly KitModulePart[] {
    const groups = new Map<
      string,
      {
        readonly material: MaterialKey;
        readonly castShadow: boolean;
        readonly receiveShadow: boolean;
        readonly geometries: THREE.BufferGeometry[];
      }
    >();
    const disposable = new Set<THREE.BufferGeometry>();
    const parts: KitModulePart[] = [];
    let ownedDisposed = false;

    const disposeOwned = (): void => {
      if (ownedDisposed) {
        return;
      }

      ownedDisposed = true;

      for (const part of this.pending) {
        if (part.owned) {
          part.geometry.dispose();
        }
      }
    };

    try {
      for (const part of this.pending) {
        const key = `${part.material}|${part.castShadow ? 1 : 0}|${part.receiveShadow ? 1 : 0}`;
        let group = groups.get(key);

        if (!group) {
          group = {
            material: part.material,
            castShadow: part.castShadow,
            receiveShadow: part.receiveShadow,
            geometries: [],
          };
          groups.set(key, group);
        }

        const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();

        geometry.applyMatrix4(part.matrix);
        geometry.clearGroups();
        group.geometries.push(geometry);
        disposable.add(geometry);
      }

      disposeOwned();

      for (const group of groups.values()) {
        if (group.geometries.length === 0) {
          continue;
        }

        let merged: THREE.BufferGeometry;

        if (group.geometries.length === 1) {
          const single = group.geometries[0];

          if (!single) {
            continue;
          }

          merged = single;
        } else {
          const mergedGeometry = mergeGeometries(group.geometries, false);

          if (!mergedGeometry) {
            throw new Error(`Failed to merge architectural kit geometry for "${group.material}".`);
          }

          merged = mergedGeometry;
          disposable.add(merged);
        }

        merged.computeBoundingSphere();
        merged.computeBoundingBox();
        parts.push({
          geometry: merged,
          material: group.material,
          castShadow: group.castShadow,
          receiveShadow: group.receiveShadow,
        });
        disposable.delete(merged);

        for (const geometry of group.geometries) {
          disposable.delete(geometry);

          if (geometry !== merged) {
            geometry.dispose();
          }
        }
      }

      return parts;
    } catch (error) {
      for (const geometry of disposable) {
        geometry.dispose();
      }

      for (const part of parts) {
        part.geometry.dispose();
      }

      throw error;
    } finally {
      disposeOwned();
      this.pending.length = 0;
    }
  }

  private assertPositive(values: readonly number[], label: string): void {
    for (const value of values) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(
          `Architectural kit ${label} requires positive finite dimensions; received ${String(value)}.`,
        );
      }
    }
  }

  private push(
    geometry: THREE.BufferGeometry,
    material: MaterialKey,
    options: KitPartOptions,
    owned: boolean,
  ): void {
    const position = options.position ?? [0, 0, 0];
    const rotation = options.rotation ?? [0, 0, 0];
    const scale = options.scale ?? [1, 1, 1];
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2], "XYZ"),
    );
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(position[0], position[1], position[2]),
      quaternion,
      new THREE.Vector3(scale[0], scale[1], scale[2]),
    );

    this.pending.push({
      geometry,
      material,
      matrix,
      castShadow: options.castShadow ?? DEFAULT_CAST_SHADOW,
      receiveShadow: options.receiveShadow ?? DEFAULT_RECEIVE_SHADOW,
      owned,
    });
  }
}

/**
 * Lofts a closed cross-section from a bottom ring to a top ring and returns a
 * flat-shaded, non-indexed geometry. Used for tapered columns: a square section
 * with chamfered corners that narrows towards the capital.
 */
export function loftPrism(
  bottom: readonly (readonly [number, number])[],
  top: readonly (readonly [number, number])[],
  height: number,
): THREE.BufferGeometry {
  if (bottom.length !== top.length || bottom.length < 3) {
    throw new Error("Architectural kit loft requires matching sections (at least 3 points).");
  }

  const count = bottom.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const bottomPoint = bottom[index];
    const topPoint = top[index];

    if (!bottomPoint || !topPoint) {
      continue;
    }

    // Bottom ring vertices then top ring vertices.
    positions.push(bottomPoint[0], 0, bottomPoint[1]);
    uvs.push(index / count, 0);
    positions.push(topPoint[0], height, topPoint[1]);
    uvs.push(index / count, 1);
  }

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const bottomA = index * 2;
    const topA = index * 2 + 1;
    const bottomB = next * 2;
    const topB = next * 2 + 1;

    indices.push(bottomA, bottomB, topB, bottomA, topB, topA);
  }

  // Caps (fan around the first ring vertex).
  for (let index = 1; index < count - 1; index += 1) {
    const next = index + 1;

    indices.push(0, next * 2, index * 2);
    indices.push(1, index * 2 + 1, next * 2 + 1);
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const faceted = geometry.toNonIndexed();

  geometry.dispose();
  faceted.computeVertexNormals();

  return faceted;
}

/**
 * Authored dimension guard. Invalid dimensions must fail the build instead of
 * producing non-finite geometry; `LevelValidator` catches the same data earlier
 * with a readable validation error.
 */
export function dimension(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;

  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new Error(`Architectural kit ${label} must be a positive distance.`);
  }

  return resolved;
}

/** Authored count guard (whole number of panels, fins, treads, ...). */
export function count(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;

  if (!Number.isFinite(resolved) || resolved < 1 || !Number.isInteger(resolved)) {
    throw new Error(`Architectural kit ${label} must be a positive integer.`);
  }

  return resolved;
}

/** Triangle count of a merged part list (used for diagnostics and tests). */
export function countPartTriangles(parts: readonly KitModulePart[]): number {
  let triangles = 0;

  for (const part of parts) {
    const position = part.geometry.getAttribute("position");

    if (!position) {
      continue;
    }

    triangles += Math.floor(position.count / 3);
  }

  return triangles;
}
