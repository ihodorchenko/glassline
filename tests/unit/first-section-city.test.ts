import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { FIRST_SECTION_ARCHITECTURE } from "../../src/levels/first-section/FirstSectionArchitecture";
import {
  createFirstSectionCity,
  createFirstSectionDecorations,
  createFirstSectionDressing,
  FIRST_SECTION_BODIES,
  FIRST_SECTION_CITY,
  FIRST_SECTION_CITY_ID_PREFIX,
  FIRST_SECTION_CITY_SEED,
  FIRST_SECTION_DECORATIONS,
  FIRST_SECTION_DRESSING,
  FIRST_SECTION_DRESSING_ID_PREFIX,
} from "../../src/levels/first-section/FirstSectionCity";
import { FIRST_SECTION_LAYOUT } from "../../src/levels/first-section/FirstSectionLayout";
import type {
  LevelDecorationDefinition,
  LevelGeometryDefinition,
  LevelMaterialType,
} from "../../src/levels/LevelTypes";
import { validateLevelDefinition } from "../../src/levels/LevelValidator";

/**
 * Decoration and city layer of the first gameplay section
 * (`FIRST_GAMEPLAY_SECTION_SPEC` §5, §7.2, §9.7, §11.4, §12 item 4).
 *
 * The assertions are derived from `FirstSectionLayout` (plate bottoms, slab
 * footprints, clearance volumes) and from the specification's own numbers
 * (street level, decoration ids, draw-call budget), so a moved body, a prop in
 * the route or an extra material batch fails against the layout instead of
 * against a copy of the implementation.
 */

const EPSILON = 1e-6;
/**
 * The loader's largest visual bevel (35 mm, `LevelContentLoader` box geometry).
 * Any leaner decal may sit this far inside the free volume: flush and inset
 * decorations are legal, a volume that eats into the route is not.
 */
const DECAL_TOLERANCE = 0.03;
/** §5.1/§5.2: street level of the city below the route. */
const STREET_LEVEL_Y = -20;
/** §5.2 jump corridor: nothing visual may enter it. */
const JUMP_CORRIDOR_HALF_WIDTH = 1.5;
const JUMP_CORRIDOR_HEIGHT = 2.5;
/** Prologue city seed; the section must not reuse it (§9.7). */
const PROLOGUE_CITY_SEED = 0x91135;

const MATERIALS: readonly LevelMaterialType[] = [
  "white",
  "concrete",
  "roof",
  "facade",
  "glass",
  "glass-far",
  "glass-rail",
  "metal",
  "aluminium",
  "composite",
  "reveal",
  "dark-metal",
  "red",
  "orange",
  "rubber",
  "asphalt",
  "warm-light",
  "cool-light",
  "foliage",
  "soil",
  "stain",
  "water",
  "membrane",
];

const KNOWN_MATERIALS = new Set<string>(MATERIALS);
const KNOWN_SHAPES = new Set(["box", "cylinder", "plane"]);
const SECTION_IDS = new Set(FIRST_SECTION_LAYOUT.sections.map((section) => section.id));
const BODY_IDS = new Set(FIRST_SECTION_BODIES.map((body) => body.id));

const DECORATION_KEYS = new Set([
  "id",
  "sectionId",
  "shape",
  "position",
  "size",
  "color",
  "text",
  "textColor",
  "accentColor",
  "material",
  "rotationX",
  "rotationY",
  "rotationZ",
  "opacity",
  "emissive",
  "emissiveIntensity",
  "castShadow",
  "receiveShadow",
]);

/**
 * §5.6 authors the single red finish marker on the finish line (`z = -84`),
 * which is exactly the trigger plane the player crosses. It is the one
 * decoration allowed to stand inside the mandatory run volume; everything else
 * must stay out of it.
 */
const FINISH_MARKER_ID = "dec_finish_marker";
const CORRIDOR_EXEMPTIONS = new Set([FINISH_MARKER_ID]);

interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly minZ: number;
  readonly maxZ: number;
}

interface Corridor extends Bounds {
  readonly id: string;
}

/**
 * Critical movement volumes: the free space the player must pass through to
 * complete the route, with the clear width and height each segment authors
 * (§5.1 run-up, §5.2 jump bands, §5.3 2.8 m gallery, §5.4 1.00 m duct, §5.5
 * vault aisle, §5.6 stair well and podium).
 */
const CRITICAL_CORRIDORS: readonly Corridor[] = [
  {
    id: "s0-runway",
    minX: -JUMP_CORRIDOR_HALF_WIDTH,
    maxX: JUMP_CORRIDOR_HALF_WIDTH,
    minY: 0,
    maxY: JUMP_CORRIDOR_HEIGHT,
    minZ: -2,
    maxZ: 18,
  },
  {
    id: "gap-a",
    minX: -JUMP_CORRIDOR_HALF_WIDTH,
    maxX: JUMP_CORRIDOR_HALF_WIDTH,
    minY: 0,
    maxY: JUMP_CORRIDOR_HEIGHT,
    minZ: -5.4,
    maxZ: -2,
  },
  {
    id: "s1-roof-b",
    minX: -JUMP_CORRIDOR_HALF_WIDTH,
    maxX: JUMP_CORRIDOR_HALF_WIDTH,
    minY: 0,
    maxY: JUMP_CORRIDOR_HEIGHT,
    minZ: -13.4,
    maxZ: -5.4,
  },
  {
    id: "gap-b",
    minX: -JUMP_CORRIDOR_HALF_WIDTH,
    maxX: JUMP_CORRIDOR_HALF_WIDTH,
    minY: 0,
    maxY: JUMP_CORRIDOR_HEIGHT,
    minZ: -17.6,
    maxZ: -13.4,
  },
  {
    id: "s1-roof-c",
    minX: -JUMP_CORRIDOR_HALF_WIDTH,
    maxX: JUMP_CORRIDOR_HALF_WIDTH,
    minY: 0,
    maxY: JUMP_CORRIDOR_HEIGHT,
    minZ: -25,
    maxZ: -17.6,
  },
  { id: "s1-plant-step", minX: -1.5, maxX: 1.5, minY: 0, maxY: 2.9, minZ: -27.4, maxZ: -25 },
  { id: "s2-platform", minX: -2, maxX: 2, minY: 0.9, maxY: 2.65, minZ: -41, maxZ: -27.4 },
  { id: "s2-gallery", minX: -1.4, maxX: 1.4, minY: 0.9, maxY: 2.65, minZ: -36.3, maxZ: -29.7 },
  { id: "s2-chamber", minX: -3, maxX: 3, minY: 0.9, maxY: 2.65, minZ: -40.8, maxZ: -36.2 },
  { id: "s3-runway", minX: -1.6, maxX: 1.6, minY: 0.9, maxY: 2.65, minZ: -47, maxZ: -41 },
  { id: "s3-duct", minX: -1.6, maxX: 1.6, minY: 0.9, maxY: 1.9, minZ: -54, maxZ: -47 },
  { id: "s3-exit", minX: -1.8, maxX: 1.8, minY: 0.9, maxY: 2.65, minZ: -57, maxZ: -54 },
  { id: "s4-channel", minX: -2.2, maxX: 2.2, minY: 0.9, maxY: 2.9, minZ: -71, maxZ: -57 },
  { id: "s5-approach", minX: -1.8, maxX: 1.8, minY: 0.9, maxY: 2.65, minZ: -73, maxZ: -71 },
  { id: "s5-stair-well", minX: -1.8, maxX: 1.8, minY: 0.9, maxY: 4.5, minZ: -78.5, maxZ: -73 },
  { id: "s5-podium", minX: -1.5, maxX: 1.5, minY: 4.5, maxY: 7.15, minZ: -87.4, maxZ: -78.5 },
];

/** §5.6 background mass: everything it contains is behind the finish facade. */
const FINISH_FACADE_Z = -87.5;

const LAYOUT_SLABS: ReadonlyMap<string, LevelGeometryDefinition> = new Map(
  FIRST_SECTION_LAYOUT.geometry.map((geometry) => [geometry.id, geometry]),
);

function slabBounds(geometry: LevelGeometryDefinition): Bounds {
  return {
    minX: geometry.position.x - geometry.size.x / 2,
    maxX: geometry.position.x + geometry.size.x / 2,
    minY: geometry.position.y - geometry.size.y / 2,
    maxY: geometry.position.y + geometry.size.y / 2,
    minZ: geometry.position.z - geometry.size.z / 2,
    maxZ: geometry.position.z + geometry.size.z / 2,
  };
}

function decorationBounds(decoration: LevelDecorationDefinition): THREE.Box3 {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(decoration.position.x, decoration.position.y, decoration.position.z),
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        decoration.rotationX ?? 0,
        decoration.rotationY ?? 0,
        decoration.rotationZ ?? 0,
        "YXZ",
      ),
    ),
    new THREE.Vector3(1, 1, 1),
  );
  const half = new THREE.Vector3(
    decoration.size.x / 2,
    decoration.size.y / 2,
    decoration.size.z / 2,
  );
  const bounds = new THREE.Box3();

  for (const signX of [-1, 1]) {
    for (const signY of [-1, 1]) {
      for (const signZ of [-1, 1]) {
        bounds.expandByPoint(
          new THREE.Vector3(signX * half.x, signY * half.y, signZ * half.z).applyMatrix4(matrix),
        );
      }
    }
  }

  return bounds;
}

function containsBounds(outer: Bounds, inner: THREE.Box3, tolerance: number): boolean {
  return (
    inner.min.x >= outer.minX - tolerance &&
    inner.max.x <= outer.maxX + tolerance &&
    inner.min.y >= outer.minY - tolerance &&
    inner.max.y <= outer.maxY + tolerance &&
    inner.min.z >= outer.minZ - tolerance &&
    inner.max.z <= outer.maxZ + tolerance
  );
}

/** Strict interior overlap: touching a corridor boundary is legal. */
function intersectsCorridorInterior(bounds: THREE.Box3, corridor: Corridor): boolean {
  return (
    bounds.min.x < corridor.maxX - DECAL_TOLERANCE &&
    bounds.max.x > corridor.minX + DECAL_TOLERANCE &&
    bounds.min.y < corridor.maxY - DECAL_TOLERANCE &&
    bounds.max.y > corridor.minY + DECAL_TOLERANCE &&
    bounds.min.z < corridor.maxZ - DECAL_TOLERANCE &&
    bounds.max.z > corridor.minZ + DECAL_TOLERANCE
  );
}

/** The part of a decoration that actually enters a corridor. */
function corridorIntersection(bounds: THREE.Box3, corridor: Corridor): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(
      Math.max(bounds.min.x, corridor.minX),
      Math.max(bounds.min.y, corridor.minY),
      Math.max(bounds.min.z, corridor.minZ),
    ),
    new THREE.Vector3(
      Math.min(bounds.max.x, corridor.maxX),
      Math.min(bounds.max.y, corridor.maxY),
      Math.min(bounds.max.z, corridor.maxZ),
    ),
  );
}

/**
 * Exact rectangle-union coverage: the top face is split at every slab edge on
 * X and each strip must be covered along Z. Used to prove that a body's top
 * never presents an un-collidered horizontal plane (V4).
 */
function rectangleUnionCovers(
  target: { readonly minX: number; readonly maxX: number },
  targetZ: { readonly minZ: number; readonly maxZ: number },
  rectangles: readonly Bounds[],
): boolean {
  const edges = new Set<number>([target.minX, target.maxX]);

  for (const rectangle of rectangles) {
    if (rectangle.minX > target.minX && rectangle.minX < target.maxX) {
      edges.add(rectangle.minX);
    }

    if (rectangle.maxX > target.minX && rectangle.maxX < target.maxX) {
      edges.add(rectangle.maxX);
    }
  }

  const sorted = [...edges].sort((left, right) => left - right);

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index] ?? Number.NaN;
    const end = sorted[index + 1] ?? Number.NaN;
    const middle = (start + end) / 2;
    const spans = rectangles
      .filter((rectangle) => rectangle.minX <= middle && rectangle.maxX >= middle)
      .map((rectangle) => [
        Math.max(rectangle.minZ, targetZ.minZ),
        Math.min(rectangle.maxZ, targetZ.maxZ),
      ])
      .filter((span) => (span[1] ?? 0) > (span[0] ?? 0))
      .sort((left, right) => (left[0] ?? 0) - (right[0] ?? 0));
    let covered = targetZ.minZ;

    for (const span of spans) {
      const low = span[0] ?? Number.NaN;
      const high = span[1] ?? Number.NaN;

      if (low > covered + EPSILON) {
        return false;
      }

      covered = Math.max(covered, high);
    }

    if (covered < targetZ.maxZ - EPSILON) {
      return false;
    }
  }

  return sorted.length >= 2;
}

function formatNumber(value: number): string {
  return value.toFixed(6);
}

/** Canonical, order-sensitive signature used for the determinism checks. */
function decorationSignature(decorations: readonly LevelDecorationDefinition[]): string {
  const hash = createHash("sha256");

  for (const decoration of decorations) {
    hash.update(
      [
        decoration.id,
        decoration.sectionId,
        decoration.shape,
        formatNumber(decoration.position.x),
        formatNumber(decoration.position.y),
        formatNumber(decoration.position.z),
        formatNumber(decoration.size.x),
        formatNumber(decoration.size.y),
        formatNumber(decoration.size.z),
        formatNumber(decoration.rotationX ?? 0),
        formatNumber(decoration.rotationY ?? 0),
        formatNumber(decoration.rotationZ ?? 0),
        decoration.material ?? "-",
        decoration.color === undefined ? "-" : decoration.color.toString(16),
        decoration.text ?? "-",
        decoration.textColor === undefined ? "-" : decoration.textColor.toString(16),
        decoration.accentColor === undefined ? "-" : decoration.accentColor.toString(16),
        formatNumber(decoration.opacity ?? 1),
        decoration.emissive === undefined ? "-" : decoration.emissive.toString(16),
        formatNumber(decoration.emissiveIntensity ?? 0),
        decoration.castShadow === undefined ? "-" : String(decoration.castShadow),
        decoration.receiveShadow === undefined ? "-" : String(decoration.receiveShadow),
      ].join("|"),
    );
    hash.update("\n");
  }

  return hash.digest("hex");
}

/**
 * Independent model of the loader's decoration batching: opaque entries share
 * one instanced draw per `material + shape + castShadow`, while every `plane`
 * and every translucent entry is its own mesh.
 */
function decorationDrawCalls(decorations: readonly LevelDecorationDefinition[]): readonly string[] {
  const batches = new Set<string>();
  const singles: string[] = [];

  for (const decoration of decorations) {
    if (decoration.shape === "plane") {
      singles.push(`${decoration.id}:plane`);
      continue;
    }

    if ((decoration.opacity ?? 1) < 1) {
      singles.push(`${decoration.id}:translucent`);
      continue;
    }

    const material = decoration.material ?? `color:${decoration.color ?? 0xffffff}`;

    batches.add(`${material}:${decoration.shape}:${(decoration.castShadow ?? true) ? "1" : "0"}`);
  }

  return [...batches, ...singles].sort();
}

function decorationById(id: string): LevelDecorationDefinition {
  const decoration = FIRST_SECTION_DECORATIONS.find((candidate) => candidate.id === id);

  if (!decoration) {
    throw new Error(`Missing decoration "${id}".`);
  }

  return decoration;
}

function countBySection(
  decorations: readonly LevelDecorationDefinition[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const decoration of decorations) {
    counts.set(decoration.sectionId, (counts.get(decoration.sectionId) ?? 0) + 1);
  }

  return counts;
}

describe("First gameplay section decoration and city layer", () => {
  it("regenerates the same layer from the same seed, in any call order", () => {
    const dressing = createFirstSectionDressing();
    const city = createFirstSectionCity();
    const combined = createFirstSectionDecorations();

    // The exported constants are the same generation, not a second one.
    expect(decorationSignature(dressing)).toBe(decorationSignature(FIRST_SECTION_DRESSING));
    expect(decorationSignature(city)).toBe(decorationSignature(FIRST_SECTION_CITY));
    expect(decorationSignature(combined)).toBe(decorationSignature(FIRST_SECTION_DECORATIONS));

    // A second pass, generated in the opposite order, must be identical.
    const cityAgain = createFirstSectionCity();
    const dressingAgain = createFirstSectionDressing();

    expect(decorationSignature(cityAgain)).toBe(decorationSignature(city));
    expect(decorationSignature(dressingAgain)).toBe(decorationSignature(dressing));
    expect(decorationSignature([...dressingAgain, ...cityAgain])).toBe(
      decorationSignature(combined),
    );
    expect(FIRST_SECTION_CITY_SEED).not.toBe(PROLOGUE_CITY_SEED);
    expect(FIRST_SECTION_CITY_SEED).toBeGreaterThan(0);
  });

  it("does not read the global random state and never calls Math.random", () => {
    const baseline = decorationSignature(FIRST_SECTION_DECORATIONS);
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("The first-section city layer must not call Math.random.");
    });

    try {
      expect(decorationSignature(createFirstSectionDecorations())).toBe(baseline);
    } finally {
      spy.mockRestore();
    }

    expect(spy).not.toHaveBeenCalled();

    // A polluted global stream (any fixed value, repeated) must not leak in.
    const polluted = vi.spyOn(Math, "random").mockReturnValue(0.999);

    try {
      for (let index = 0; index < 64; index += 1) {
        Math.random();
      }

      expect(decorationSignature(createFirstSectionDecorations())).toBe(baseline);
    } finally {
      polluted.mockRestore();
    }

    // Static check on the executable source: strip comments first, so the
    // module may still *document* the prohibition it obeys.
    const source = readFileSync(
      new URL("../../src/levels/first-section/FirstSectionCity.ts", import.meta.url),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    expect(source).not.toContain("Math.random");
    expect(source).toContain("createRandom(FIRST_SECTION_CITY_SEED)");
  });

  it("keeps every id unique in the decoration namespace", () => {
    const dressingIds = FIRST_SECTION_DRESSING.map((decoration) => decoration.id);
    const cityIds = FIRST_SECTION_CITY.map((decoration) => decoration.id);
    const allIds = FIRST_SECTION_DECORATIONS.map((decoration) => decoration.id);
    const layoutIds = new Set([
      ...FIRST_SECTION_LAYOUT.geometry.map((geometry) => geometry.id),
      ...FIRST_SECTION_LAYOUT.triggers.map((trigger) => trigger.id),
      ...FIRST_SECTION_LAYOUT.surfaces.map((surface) => surface.id),
      ...FIRST_SECTION_LAYOUT.spawnPoints.map((spawnPoint) => spawnPoint.id),
      ...FIRST_SECTION_LAYOUT.checkpoints.map((checkpoint) => checkpoint.id),
      ...FIRST_SECTION_LAYOUT.sections.map((section) => section.id),
      ...FIRST_SECTION_ARCHITECTURE.map((placement) => placement.id),
    ]);

    expect(new Set(dressingIds).size).toBe(dressingIds.length);
    expect(new Set(cityIds).size).toBe(cityIds.length);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds).toHaveLength(FIRST_SECTION_DRESSING.length + FIRST_SECTION_CITY.length);

    for (const id of dressingIds) {
      expect(id.startsWith(`${FIRST_SECTION_DRESSING_ID_PREFIX}_`), id).toBe(true);
      expect(layoutIds.has(id), id).toBe(false);
    }

    for (const id of cityIds) {
      expect(id.startsWith(`${FIRST_SECTION_CITY_ID_PREFIX}_`), id).toBe(true);
      expect(layoutIds.has(id), id).toBe(false);
    }
  });

  it("honours the LevelDecorationDefinition contract on every entry", () => {
    for (const decoration of FIRST_SECTION_DECORATIONS) {
      expect(KNOWN_SHAPES.has(decoration.shape), decoration.id).toBe(true);
      expect(SECTION_IDS.has(decoration.sectionId), decoration.id).toBe(true);
      expect(decoration.id.trim().length, decoration.id).toBeGreaterThan(0);

      for (const value of [
        decoration.position.x,
        decoration.position.y,
        decoration.position.z,
        decoration.size.x,
        decoration.size.y,
        decoration.size.z,
        decoration.rotationX ?? 0,
        decoration.rotationY ?? 0,
        decoration.rotationZ ?? 0,
        decoration.opacity ?? 1,
        decoration.emissiveIntensity ?? 0,
      ]) {
        expect(Number.isFinite(value), decoration.id).toBe(true);
      }

      expect(decoration.size.x, decoration.id).toBeGreaterThan(0);
      expect(decoration.size.y, decoration.id).toBeGreaterThan(0);
      expect(decoration.size.z, decoration.id).toBeGreaterThan(0);
      expect(decoration.opacity ?? 1, decoration.id).toBeGreaterThan(0);
      expect(decoration.opacity ?? 1, decoration.id).toBeLessThanOrEqual(1);
      expect(decoration.emissiveIntensity ?? 0, decoration.id).toBeGreaterThanOrEqual(0);

      if (decoration.material !== undefined) {
        expect(KNOWN_MATERIALS.has(decoration.material), decoration.id).toBe(true);
      } else {
        expect(decoration.color, decoration.id).toBeTypeOf("number");
      }

      for (const key of Object.keys(decoration)) {
        expect(DECORATION_KEYS.has(key), `${decoration.id}:${key}`).toBe(true);
      }

      // §7.2 V1: visual-only; the contract has no collider or surface fields.
      expect("collider" in decoration).toBe(false);
      expect("surfaceId" in decoration).toBe(false);
      expect("triggerId" in decoration).toBe(false);

      // §7.2 V6: `castShadow` defaults to true, so every entry states it.
      expect(decoration.castShadow, decoration.id).toBeTypeOf("boolean");

      if (decoration.shape === "plane") {
        expect(decoration.text?.trim().length ?? 0, decoration.id).toBeGreaterThan(0);
        expect(decoration.castShadow, decoration.id).toBe(false);
      }
    }
  });

  it("keeps every sign plane outside the masses it is mounted on", () => {
    const colliders = FIRST_SECTION_LAYOUT.geometry.map(slabBounds);
    const solids = [
      ...colliders,
      ...FIRST_SECTION_DECORATIONS.filter((decoration) => decoration.shape !== "plane").map(
        (decoration) => {
          const bounds = decorationBounds(decoration);

          return {
            minX: bounds.min.x,
            maxX: bounds.max.x,
            minY: bounds.min.y,
            maxY: bounds.max.y,
            minZ: bounds.min.z,
            maxZ: bounds.max.z,
          };
        },
      ),
    ];
    const planes = FIRST_SECTION_DECORATIONS.filter((decoration) => decoration.shape === "plane");

    expect(planes.length).toBeGreaterThanOrEqual(2);

    for (const plane of planes) {
      const point = {
        x: plane.position.x,
        y: plane.position.y,
        z: plane.position.z,
      };
      const buried = solids.filter(
        (solid) =>
          point.x > solid.minX + EPSILON &&
          point.x < solid.maxX - EPSILON &&
          point.y > solid.minY + EPSILON &&
          point.y < solid.maxY - EPSILON &&
          point.z > solid.minZ + EPSILON &&
          point.z < solid.maxZ - EPSILON,
      );

      expect(buried, plane.id).toHaveLength(0);
    }

    // Both signs face the route: the slide sign looks up the runway (+Z) and
    // the city billboard looks back at the start (-Z).
    expect(decorationById("dec_slide_sign").rotationY ?? 0).toBeCloseTo(0, 6);
    expect(
      Math.abs(planes.find((plane) => plane.id.startsWith("city_"))?.rotationY ?? 0),
    ).toBeCloseTo(Math.PI, 6);
  });

  it("holds every visual volume on the ground, a collider, or another volume", () => {
    const colliders = FIRST_SECTION_LAYOUT.geometry.map(slabBounds);
    const bounds = FIRST_SECTION_DECORATIONS.map(decorationBounds);
    const FIXTURE_TOLERANCE = 0.03;
    const FOOTPRINT_TOLERANCE = 0.12;
    const floating: string[] = [];

    const overlap = (minA: number, maxA: number, minB: number, maxB: number): number =>
      Math.min(maxA, maxB) - Math.max(minA, minB);
    // A volume is held when its bottom sits on or inside a mass below it, or
    // when a fixture starts at its top (a hanging strip, a mounted sign).
    const attaches = (holder: Bounds, box: THREE.Box3): boolean => {
      const footprint =
        overlap(holder.minX, holder.maxX, box.min.x, box.max.x) >= -FOOTPRINT_TOLERANCE &&
        overlap(holder.minZ, holder.maxZ, box.min.z, box.max.z) >= -FOOTPRINT_TOLERANCE;
      const heldFromBelow =
        box.min.y >= holder.minY - FIXTURE_TOLERANCE &&
        box.min.y <= holder.maxY + FIXTURE_TOLERANCE;
      const heldFromAbove =
        holder.minY >= box.max.y - FIXTURE_TOLERANCE &&
        holder.minY <= box.max.y + FIXTURE_TOLERANCE;

      return footprint && (heldFromBelow || heldFromAbove);
    };

    for (const [index, decoration] of FIRST_SECTION_DECORATIONS.entries()) {
      const box = bounds[index];

      if (!box) {
        throw new Error(`Missing bounds for "${decoration.id}".`);
      }

      // Ground slabs cross the street plane; masses seated on it start there.
      const crossesStreet = box.min.y <= STREET_LEVEL_Y + FIXTURE_TOLERANCE;
      const seatedOnStreet = Math.abs(box.min.y - STREET_LEVEL_Y) <= FIXTURE_TOLERANCE;

      if (crossesStreet || seatedOnStreet) {
        continue;
      }

      // A dressing fixture hangs from, stands on, or is inset into a collider
      // or another decoration: its bottom or its top lies inside that volume.
      const holders: readonly Bounds[] = [
        ...colliders,
        ...FIRST_SECTION_DECORATIONS.filter(
          (_candidate, candidateIndex) => candidateIndex !== index,
        ).map((candidate) => {
          const candidateBounds = decorationBounds(candidate);

          return {
            minX: candidateBounds.min.x,
            maxX: candidateBounds.max.x,
            minY: candidateBounds.min.y,
            maxY: candidateBounds.max.y,
            minZ: candidateBounds.min.z,
            maxZ: candidateBounds.max.z,
          };
        }),
      ];
      const attached = holders.some((holder) => attaches(holder, box));

      if (!attached) {
        floating.push(`${decoration.id} y=[${box.min.y.toFixed(3)},${box.max.y.toFixed(3)}]`);
      }
    }

    expect(floating).toEqual([]);
  });

  it("seats every support body on its plate without pasting past its edge", () => {
    const slabsAtBottom = new Map<string, Bounds[]>();

    for (const geometry of FIRST_SECTION_LAYOUT.geometry) {
      const bottom = slabBounds(geometry).minY;
      const key = bottom.toFixed(6);
      const list = slabsAtBottom.get(key) ?? [];

      list.push(slabBounds(geometry));
      slabsAtBottom.set(key, list);
    }

    let supportBodies = 0;

    for (const body of FIRST_SECTION_BODIES) {
      const decoration = decorationById(body.id);
      const bounds = decorationBounds(decoration);

      expect(decoration.castShadow, body.id).toBe(true);

      if (body.kind === "background") {
        // §5.6: the finish backdrop stands fully behind the facade plane.
        expect(bounds.max.z, body.id).toBeLessThanOrEqual(FINISH_FACADE_Z + EPSILON);
        expect(bounds.max.y, body.id).toBeCloseTo(13, 6);
        expect(bounds.min.y, body.id).toBeCloseTo(STREET_LEVEL_Y, 6);
        continue;
      }

      supportBodies += 1;

      const listed = body.slabIds.map((slabId) => {
        const slab = LAYOUT_SLABS.get(slabId);

        if (!slab) {
          throw new Error(`Body "${body.id}" references unknown slab "${slabId}".`);
        }

        return slab;
      });
      const listedBounds = listed.map(slabBounds);
      const bodyTop = bounds.max.y;

      // The body top is exactly the plate underside (§5 "верх совпадает с
      // низом плиты"), and lower than the walkable top of every plate it holds.
      for (const slab of listedBounds) {
        expect(slab.minY, body.id).toBeCloseTo(bodyTop, 6);
        expect(bodyTop, body.id).toBeLessThan(slab.maxY - EPSILON);
      }

      // The listed slabs fully support the body footprint.
      expect(
        rectangleUnionCovers(
          { minX: bounds.min.x, maxX: bounds.max.x },
          { minZ: bounds.min.z, maxZ: bounds.max.z },
          listedBounds,
        ),
        body.id,
      ).toBe(true);

      // Stronger, layout-wide check: every collider that starts at the body's
      // height together covers the footprint. A body that reached past its
      // plate (or sat inside one) would leave an uncovered strip here.
      const supports = slabsAtBottom.get(bodyTop.toFixed(6)) ?? [];

      expect(supports.length, body.id).toBeGreaterThan(0);
      expect(
        rectangleUnionCovers(
          { minX: bounds.min.x, maxX: bounds.max.x },
          { minZ: bounds.min.z, maxZ: bounds.max.z },
          supports,
        ),
        body.id,
      ).toBe(true);

      // And the body is seated on the street, so no mass floats over the city.
      expect(bounds.min.y, body.id).toBeCloseTo(STREET_LEVEL_Y, 6);
    }

    // 12 support masses + the finish backdrop.
    expect(supportBodies).toBe(12);
    expect(FIRST_SECTION_BODIES).toHaveLength(13);
  });

  it("keeps every decoration out of the critical movement volume", () => {
    const colliders = FIRST_SECTION_LAYOUT.geometry.map(slabBounds);
    const violations: string[] = [];
    const exempted: string[] = [];
    const resolvedByCollider: string[] = [];

    for (const decoration of FIRST_SECTION_DECORATIONS) {
      const bounds = decorationBounds(decoration);
      const corridors = CRITICAL_CORRIDORS.filter((corridor) =>
        intersectsCorridorInterior(bounds, corridor),
      );

      if (corridors.length === 0) {
        continue;
      }

      // Surface decals are legal: only the part of a decoration that enters a
      // corridor has to be filled by collision geometry (floor paint, obstacle
      // bands, wall linings). Free-standing volumes are not.
      const freeVolume = corridors.some(
        (corridor) =>
          !colliders.some((collider) =>
            containsBounds(collider, corridorIntersection(bounds, corridor), DECAL_TOLERANCE),
          ),
      );

      if (!freeVolume) {
        resolvedByCollider.push(decoration.id);
        continue;
      }

      if (CORRIDOR_EXEMPTIONS.has(decoration.id)) {
        exempted.push(decoration.id);
        continue;
      }

      violations.push(`${decoration.id} in ${corridors.map((corridor) => corridor.id).join(",")}`);
    }

    expect(violations).toEqual([]);
    expect(exempted).toEqual([FINISH_MARKER_ID]);

    // The authored finish marker is the only exemption and it must still be a
    // thin post on the finish line, not a mass in the player's lane.
    const marker = decorationById(FINISH_MARKER_ID);

    expect(marker.position.x).toBeCloseTo(0, 6);
    expect(marker.position.z).toBeCloseTo(-84, 6);
    expect(marker.size.x).toBeLessThan(0.2);
    expect(marker.size.z).toBeLessThan(0.2);

    // Positive control: the sweep is not vacuous. Several dressing entries do
    // reach into a corridor and are only legal because a collider occupies that
    // space (floor paint, gallery linings, vault obstacle bands).
    expect(resolvedByCollider.length).toBeGreaterThanOrEqual(5);
    expect(resolvedByCollider).toContain("dec_gallery_lining_west");
    expect(resolvedByCollider).toContain("dec_vault_1_stripe");
  });

  it("casts shadows only from building bodies and keeps the city shadowless", () => {
    for (const decoration of FIRST_SECTION_DRESSING) {
      expect(decoration.castShadow === true, decoration.id).toBe(BODY_IDS.has(decoration.id));
    }

    // §7.2 V7: every far city mass is authored without a shadow.
    for (const decoration of FIRST_SECTION_CITY) {
      expect(decoration.castShadow, decoration.id).toBe(false);
    }

    const shadowCasters = FIRST_SECTION_DECORATIONS.filter(
      (decoration) => decoration.castShadow === true,
    );

    expect(shadowCasters.map((decoration) => decoration.id).sort()).toEqual([...BODY_IDS].sort());
    expect(shadowCasters).toHaveLength(13);
  });

  it("stays inside the section draw-call and instance budgets", () => {
    const dressingBatches = decorationDrawCalls(FIRST_SECTION_DRESSING);
    const cityBatches = decorationDrawCalls(FIRST_SECTION_CITY);
    const combinedBatches = decorationDrawCalls(FIRST_SECTION_DECORATIONS);

    // §11.4 / §12 item 4 budget: 12–16 decoration draws and 8–12 city draws.
    expect(dressingBatches.length).toBeGreaterThanOrEqual(12);
    expect(dressingBatches.length).toBeLessThanOrEqual(16);
    expect(cityBatches.length).toBeGreaterThanOrEqual(8);
    expect(cityBatches.length).toBeLessThanOrEqual(12);

    // Batches sharing a key merge when both sub-layers load together, so the
    // combined count can only be lower than the sum of the two budgets.
    expect(combinedBatches.length).toBeLessThanOrEqual(dressingBatches.length + cityBatches.length);
    expect(combinedBatches.length).toBeLessThanOrEqual(28);

    // The grouping is authored, not incidental: one deliberate batch per
    // material/shape/shadow triple.
    expect(dressingBatches).toEqual([
      "asphalt:box:0",
      "concrete:box:0",
      "concrete:box:1",
      "cool-light:box:0",
      "dark-metal:box:0",
      "dec_slide_sign:plane",
      "facade:box:1",
      "glass-far:box:0",
      "metal:box:0",
      "metal:cylinder:0",
      "red:box:0",
      "warm-light:box:0",
      "white:box:0",
    ]);
    const cityPlanes = cityBatches.filter((key) => key.endsWith(":plane"));

    expect(cityPlanes).toHaveLength(1);
    expect(cityPlanes[0]?.startsWith(`${FIRST_SECTION_CITY_ID_PREFIX}_`)).toBe(true);
    expect(cityBatches.filter((key) => !key.endsWith(":plane"))).toEqual([
      "asphalt:box:0",
      "concrete:box:0",
      "dark-metal:box:0",
      "facade:box:0",
      "glass-far:box:0",
      "metal:box:0",
      "metal:cylinder:0",
      "red:box:0",
      "roof:box:0",
      "white:box:0",
    ]);

    // Instance budgets keep the V7 triangle cost bounded: one instanced draw
    // per batch still renders one 300-triangle rounded box per instance.
    expect(FIRST_SECTION_DRESSING.length).toBeLessThanOrEqual(120);
    expect(FIRST_SECTION_CITY.length).toBeLessThanOrEqual(700);
    expect(FIRST_SECTION_DRESSING.length).toBeGreaterThanOrEqual(50);
    expect(FIRST_SECTION_CITY.length).toBeGreaterThanOrEqual(200);
  });

  it("dresses all six segments with the §5 elements", () => {
    const sections = countBySection(FIRST_SECTION_DECORATIONS);

    for (const section of FIRST_SECTION_LAYOUT.sections) {
      expect(sections.get(section.id) ?? 0, section.id).toBeGreaterThan(1);
    }

    const required = [
      "dec_start_body",
      "dec_start_edge_marker",
      "dec_jump_mass_b",
      "dec_jump_mass_c",
      "dec_jump_canyon_street",
      "dec_plant_body",
      "dec_gallery_light_west",
      "dec_gallery_light_east",
      "dec_plant_vent_west_body",
      "dec_plant_vent_east_body",
      "dec_slide_runway_body",
      "dec_duct_body",
      "dec_slide_sign",
      "dec_channel_body",
      "dec_vault_1_stripe",
      "dec_vault_2_stripe",
      "dec_vault_3_stripe",
      "dec_finish_approach_body",
      "dec_podium_body",
      "dec_tower_body",
      FINISH_MARKER_ID,
    ];

    for (const id of required) {
      expect(() => decorationById(id), id).not.toThrow();
    }

    // §5 element checks that the bodies alone cannot express.
    const sign = decorationById("dec_slide_sign");
    const ductBody = decorationById("dec_duct_body");
    const channelBody = decorationById("dec_channel_body");
    const podiumBody = decorationById("dec_podium_body");
    const plantBody = decorationById("dec_plant_body");
    const street = decorationById("dec_jump_canyon_street");
    const marker = decorationById(FINISH_MARKER_ID);
    const galleryLight = decorationById("dec_gallery_light_west");
    const vent = decorationById("dec_plant_vent_west_body");

    expect(sign.shape).toBe("plane");
    expect(sign.text).toBe("SHIFT · SLIDE");
    expect(sign.position.y).toBeCloseTo(3.2, 6);
    expect(sign.size.x).toBeCloseTo(2.4, 6);
    expect(sign.size.y).toBeCloseTo(0.5, 6);

    expect(ductBody.position.y + ductBody.size.y / 2).toBeCloseTo(0.7, 6);
    expect(ductBody.size.x).toBeCloseTo(3.6, 6);
    expect(channelBody.position.y + channelBody.size.y / 2).toBeCloseTo(0.7, 6);
    expect(channelBody.size.x).toBeCloseTo(4.4, 6);
    expect(podiumBody.position.y + podiumBody.size.y / 2).toBeCloseTo(4.3, 6);
    expect(podiumBody.size.x).toBeCloseTo(10, 6);
    expect(plantBody.size.x).toBeCloseTo(16, 6);
    expect(plantBody.position.y + plantBody.size.y / 2).toBeCloseTo(0, 6);
    expect(street.position.y + street.size.y / 2).toBeCloseTo(STREET_LEVEL_Y + 0.02, 6);
    expect(marker.material).toBe("red");
    expect(marker.position.y + marker.size.y / 2).toBeCloseTo(7.1, 6);
    expect(galleryLight.material).toBe("cool-light");
    expect(galleryLight.position.y).toBeCloseTo(3.2, 6);
    expect(vent.material).toBe("metal");
    expect(vent.position.x).toBeCloseTo(-5.4, 6);
  });

  it("gives the route a city above and below it without walling it in", () => {
    const massing = FIRST_SECTION_CITY.filter(
      (decoration) => decorationBounds(decoration).max.y > -10,
    );
    const bounds = FIRST_SECTION_CITY.map(decorationBounds);
    const minY = Math.min(...bounds.map((box) => box.min.y));
    const maxY = Math.max(...bounds.map((box) => box.max.y));
    const minX = Math.min(...bounds.map((box) => box.min.x));
    const maxX = Math.max(...bounds.map((box) => box.max.x));
    const minZ = Math.min(...bounds.map((box) => box.min.z));
    const maxZ = Math.max(...bounds.map((box) => box.max.z));

    // A city, not a backdrop card: it surrounds the route and rises above the
    // roofs, while its pavement sits on the authored street level.
    expect(minY).toBeCloseTo(STREET_LEVEL_Y - 0.4, 6);
    expect(maxY).toBeGreaterThan(20);
    expect(minX).toBeLessThan(-150);
    expect(maxX).toBeGreaterThan(150);
    expect(minZ).toBeLessThan(-180);
    expect(maxZ).toBeGreaterThan(120);
    expect(massing.length).toBeGreaterThan(50);

    // §5.1–§5.6: the playable route sits on its own cleared site. No city mass
    // above the street enters it (the pavement plates and sidewalks may).
    for (const decoration of massing) {
      const box = decorationBounds(decoration);
      const insideSite = box.max.x > -14 && box.min.x < 14 && box.max.z > -101 && box.min.z < 19;

      expect(insideSite, decoration.id).toBe(false);
    }

    // The street grid reads from the roof: pavement, sidewalks and markings.
    const materials = new Set(FIRST_SECTION_CITY.map((decoration) => decoration.material));

    for (const material of ["asphalt", "concrete", "roof", "white"] as const) {
      expect(materials.has(material), material).toBe(true);
    }
  });

  it("leaves the collision layer, surfaces, triggers, and spawn points untouched", () => {
    const geometry = JSON.stringify(FIRST_SECTION_LAYOUT.geometry);
    const surfaces = JSON.stringify(FIRST_SECTION_LAYOUT.surfaces);
    const triggers = JSON.stringify(FIRST_SECTION_LAYOUT.triggers);
    const spawnPoints = JSON.stringify(FIRST_SECTION_LAYOUT.spawnPoints);
    const checkpoints = JSON.stringify(FIRST_SECTION_LAYOUT.checkpoints);
    const architecture = JSON.stringify(FIRST_SECTION_ARCHITECTURE);

    for (let pass = 0; pass < 10; pass += 1) {
      createFirstSectionDecorations();
    }

    expect(JSON.stringify(FIRST_SECTION_LAYOUT.geometry)).toBe(geometry);
    expect(JSON.stringify(FIRST_SECTION_LAYOUT.surfaces)).toBe(surfaces);
    expect(JSON.stringify(FIRST_SECTION_LAYOUT.triggers)).toBe(triggers);
    expect(JSON.stringify(FIRST_SECTION_LAYOUT.spawnPoints)).toBe(spawnPoints);
    expect(JSON.stringify(FIRST_SECTION_LAYOUT.checkpoints)).toBe(checkpoints);
    expect(JSON.stringify(FIRST_SECTION_ARCHITECTURE)).toBe(architecture);
    expect(FIRST_SECTION_LAYOUT.geometry).toHaveLength(58);

    // §11.1: the composed definition validates with the decoration layer
    // attached, without changing the layout's own status.
    const layoutResult = validateLevelDefinition(FIRST_SECTION_LAYOUT);

    expect(layoutResult.errors).toEqual([]);
    expect(layoutResult.warnings).toEqual([]);

    const dressedResult = validateLevelDefinition({
      ...FIRST_SECTION_LAYOUT,
      decorations: FIRST_SECTION_DECORATIONS,
    });

    expect(dressedResult.errors).toEqual([]);
    expect(dressedResult.warnings).toEqual([]);
  });
});
