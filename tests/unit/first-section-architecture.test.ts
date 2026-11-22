import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";

import {
  type ArchitecturalModuleDefinition,
  architecturalModuleKey,
  architecturalModuleSignature,
  buildArchitecturalModule,
  type KitModuleModel,
  type KitModulePart,
  validateArchitecturalModuleDefinition,
} from "../../src/levels/architecture/ArchitecturalKit";
import { KitGeometryPool } from "../../src/levels/architecture/KitGeometry";
import {
  FIRST_SECTION_ARCHITECTURE,
  FIRST_SECTION_ARCHITECTURE_VARIANTS,
} from "../../src/levels/first-section/FirstSectionArchitecture";
import {
  FIRST_SECTION_LAYOUT,
  FIRST_SECTION_SECTION_IDS,
  type FirstSectionSectionId,
} from "../../src/levels/first-section/FirstSectionLayout";
import type { LevelArchitecturePlacement } from "../../src/levels/LevelTypes";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";

/**
 * Architectural Kit layer of the first gameplay section
 * (`FIRST_GAMEPLAY_SECTION_SPEC` §6 and §§5.1–5.6).
 *
 * The expected variants and the 52-placement table below are transcribed
 * independently from the specification, so a wrong or moved placement must
 * differ from both the implementation and this table.
 */

const VARIANTS = FIRST_SECTION_ARCHITECTURE_VARIANTS;
const SECTION = FIRST_SECTION_SECTION_IDS;
const HALF_PI = Math.PI / 2;
const EPSILON = 1e-6;

const VARIANT_NAMES = [
  "facadeBay",
  "curtainWall",
  "corner",
  "column",
  "canopy",
  "parapetSixMeters",
  "parapetFourMeters",
  "servicePortal",
  "ventilation",
  "louver",
  "facadeScreen",
  "jointTwoMeters",
  "jointFourPointFiveMeters",
] as const;

type VariantName = (typeof VARIANT_NAMES)[number];

/** Independent transcription of the 13 §6 variants, including parameters. */
const EXPECTED_VARIANTS: Readonly<Record<VariantName, ArchitecturalModuleDefinition>> = {
  facadeBay: {
    kind: "facade-bay",
    width: 4.2,
    height: 4.2,
    revealDepth: 0.7,
    accent: true,
  },
  curtainWall: {
    kind: "curtain-wall",
    width: 6,
    height: 4.2,
    columns: 3,
    rows: 1,
    spandrel: true,
  },
  corner: {
    kind: "corner",
    width: 4.2,
    depth: 4.2,
    height: 9,
    accent: true,
  },
  column: {
    kind: "column",
    height: 3.6,
    width: 0.9,
    accent: true,
  },
  canopy: {
    kind: "canopy",
    width: 7,
    depth: 3.4,
    thickness: 0.24,
    tensionRods: true,
  },
  parapetSixMeters: {
    kind: "parapet",
    length: 6,
    height: 0.2,
    accent: true,
  },
  parapetFourMeters: {
    kind: "parapet",
    length: 4,
    height: 0.2,
    accent: true,
  },
  servicePortal: {
    kind: "service-portal",
    width: 2.8,
    height: 2.4,
    depth: 0.7,
    louvered: true,
  },
  ventilation: {
    kind: "ventilation",
    width: 2.8,
    height: 2.4,
    depth: 1,
    blades: 6,
  },
  louver: {
    kind: "louver",
    width: 5,
    height: 4,
    depth: 0.45,
    bladeCount: 18,
  },
  facadeScreen: {
    kind: "facade-screen",
    width: 6,
    height: 4.2,
    ribbons: 12,
  },
  jointTwoMeters: {
    kind: "joint",
    width: 0.9,
    height: 2,
    depth: 0.5,
  },
  jointFourPointFiveMeters: {
    kind: "joint",
    width: 0.9,
    height: 4.5,
    depth: 0.5,
  },
};

interface ExpectedPlacement {
  readonly sectionId: FirstSectionSectionId;
  readonly variant: VariantName;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
}

function expectedPlacement(
  sectionId: FirstSectionSectionId,
  variant: VariantName,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): ExpectedPlacement {
  return { sectionId, variant, x, y, z, rotationY };
}

/** Independent transcription of all §5 placement rows (52 entries). */
const EXPECTED_PLACEMENTS: readonly ExpectedPlacement[] = [
  /* S0 — Starting Roof (10). */
  expectedPlacement(SECTION.start, "facadeBay", 3, 0, 2.1, -HALF_PI),
  expectedPlacement(SECTION.start, "facadeBay", 3, 0, 6.3, -HALF_PI),
  expectedPlacement(SECTION.start, "parapetSixMeters", -11.8, 1.05, 8, HALF_PI),
  expectedPlacement(SECTION.start, "parapetSixMeters", 11.8, 1.05, 8, HALF_PI),
  expectedPlacement(SECTION.start, "parapetSixMeters", 0, 1.05, 17.82),
  expectedPlacement(SECTION.start, "column", -2.6, 0, 12),
  expectedPlacement(SECTION.start, "column", 2.6, 0, 12),
  expectedPlacement(SECTION.start, "canopy", 0, 3.6, 12),
  expectedPlacement(SECTION.start, "jointTwoMeters", 0, 0, 2),
  expectedPlacement(SECTION.start, "jointTwoMeters", 0, 0, 10),

  /* S1 — Building Jump (11). */
  expectedPlacement(SECTION.buildingJump, "curtainWall", 3, 0, -9.4, -HALF_PI),
  expectedPlacement(SECTION.buildingJump, "curtainWall", 0, -8.4, -5.4),
  expectedPlacement(SECTION.buildingJump, "curtainWall", 0, -8.4, -13.4, Math.PI),
  expectedPlacement(SECTION.buildingJump, "curtainWall", 0, -8.4, -17.6),
  expectedPlacement(SECTION.buildingJump, "facadeScreen", 8.02, 0, -9.4, HALF_PI),
  expectedPlacement(SECTION.buildingJump, "parapetSixMeters", -7.8, 1.05, -9.4, HALF_PI),
  expectedPlacement(SECTION.buildingJump, "parapetSixMeters", 7.8, 1.05, -9.4, HALF_PI),
  expectedPlacement(SECTION.buildingJump, "parapetSixMeters", -7.8, 1.05, -21.3, HALF_PI),
  expectedPlacement(SECTION.buildingJump, "parapetSixMeters", 7.8, 1.05, -21.3, HALF_PI),
  expectedPlacement(SECTION.buildingJump, "jointFourPointFiveMeters", 3.05, 0, -5.45),
  expectedPlacement(SECTION.buildingJump, "jointFourPointFiveMeters", 3.05, 0, -13.35),

  /* S2 — Technical Passage (10). */
  expectedPlacement(SECTION.technical, "servicePortal", 0, 0.9, -30),
  expectedPlacement(SECTION.technical, "servicePortal", 0, 0.9, -40.7),
  expectedPlacement(SECTION.technical, "ventilation", 1.85, 0.9, -33, HALF_PI),
  expectedPlacement(SECTION.technical, "ventilation", 1.85, 0.9, -38.5, HALF_PI),
  expectedPlacement(SECTION.technical, "louver", -3.45, 0.9, -38.5, -HALF_PI),
  expectedPlacement(SECTION.technical, "facadeScreen", 3.45, 0.9, -38.5, HALF_PI),
  expectedPlacement(SECTION.technical, "parapetFourMeters", -6, 1.95, -27.575),
  expectedPlacement(SECTION.technical, "parapetFourMeters", 6, 1.95, -27.575),
  expectedPlacement(SECTION.technical, "jointTwoMeters", 0, 0.9, -30),
  expectedPlacement(SECTION.technical, "jointTwoMeters", 0, 0.9, -36.3),

  /* S3 — Slide Section (2). */
  expectedPlacement(SECTION.slide, "jointTwoMeters", -1.85, 0.9, -47),
  expectedPlacement(SECTION.slide, "jointTwoMeters", 1.85, 0.9, -47),

  /* S4 — Vault Section (5). */
  expectedPlacement(SECTION.vault, "facadeBay", -2.65, 0.9, -61, -HALF_PI),
  expectedPlacement(SECTION.vault, "facadeBay", -2.65, 0.9, -67, -HALF_PI),
  expectedPlacement(SECTION.vault, "jointTwoMeters", 0, 0.9, -59.5),
  expectedPlacement(SECTION.vault, "jointTwoMeters", 0, 0.9, -63.5),
  expectedPlacement(SECTION.vault, "jointTwoMeters", 0, 0.9, -67.5),

  /* S5 — Finish Point (14). */
  expectedPlacement(SECTION.finish, "curtainWall", -3, 4.5, -87.5),
  expectedPlacement(SECTION.finish, "curtainWall", 3, 4.5, -87.5),
  expectedPlacement(SECTION.finish, "curtainWall", -3, 8.7, -87.5),
  expectedPlacement(SECTION.finish, "curtainWall", 3, 8.7, -87.5),
  expectedPlacement(SECTION.finish, "corner", -7, 4.5, -87.5, 0),
  expectedPlacement(SECTION.finish, "corner", 7, 4.5, -87.5, -HALF_PI),
  expectedPlacement(SECTION.finish, "column", -3.2, 4.5, -84),
  expectedPlacement(SECTION.finish, "column", 3.2, 4.5, -84),
  expectedPlacement(SECTION.finish, "canopy", 0, 8.1, -84),
  expectedPlacement(SECTION.finish, "parapetSixMeters", -4.8, 5.55, -83, HALF_PI),
  expectedPlacement(SECTION.finish, "parapetSixMeters", 4.8, 5.55, -83, HALF_PI),
  expectedPlacement(SECTION.finish, "parapetSixMeters", 0, 5.55, -87.32),
  expectedPlacement(SECTION.finish, "jointFourPointFiveMeters", -5, 4.5, -83),
  expectedPlacement(SECTION.finish, "jointFourPointFiveMeters", 5, 4.5, -83),
];

const pools: KitGeometryPool[] = [];
const models: KitModuleModel[] = [];

function build(definition: ArchitecturalModuleDefinition): KitModuleModel {
  const pool = new KitGeometryPool();
  const model = buildArchitecturalModule(definition, pool);

  pools.push(pool);
  models.push(model);

  return model;
}

afterEach(() => {
  for (const model of models) {
    model.dispose();
  }

  for (const pool of pools) {
    pool.dispose();
  }

  models.length = 0;
  pools.length = 0;
});

function actualKey(placement: LevelArchitecturePlacement): string {
  return architecturalModuleKey(placement.module);
}

function expectedKey(name: VariantName): string {
  return architecturalModuleKey(EXPECTED_VARIANTS[name]);
}

function formatNumber(value: number): string {
  return value.toFixed(6);
}

function actualPlacementSignature(placement: LevelArchitecturePlacement): string {
  return [
    placement.sectionId,
    architecturalModuleSignature(placement.module),
    formatNumber(placement.position.x),
    formatNumber(placement.position.y),
    formatNumber(placement.position.z),
    formatNumber(placement.rotationY ?? 0),
  ].join("|");
}

function expectedPlacementSignature(placement: ExpectedPlacement): string {
  return [
    placement.sectionId,
    architecturalModuleSignature(EXPECTED_VARIANTS[placement.variant]),
    formatNumber(placement.x),
    formatNumber(placement.y),
    formatNumber(placement.z),
    formatNumber(placement.rotationY),
  ].join("|");
}

function findPlacement(id: string): LevelArchitecturePlacement {
  const placement = FIRST_SECTION_ARCHITECTURE.find((candidate) => candidate.id === id);

  if (!placement) {
    throw new Error(`Missing architecture placement "${id}".`);
  }

  return placement;
}

function countBySection(
  placements: readonly { readonly sectionId: string }[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const placement of placements) {
    counts.set(placement.sectionId, (counts.get(placement.sectionId) ?? 0) + 1);
  }

  return counts;
}

function countByVariant(
  placements: readonly { readonly variant: VariantName }[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const placement of placements) {
    const key = expectedKey(placement.variant);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function countActualByVariant(
  placements: readonly LevelArchitecturePlacement[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const placement of placements) {
    const key = actualKey(placement);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function uniqueModules(): ReadonlyMap<string, ArchitecturalModuleDefinition> {
  const modules = new Map<string, ArchitecturalModuleDefinition>();

  for (const placement of FIRST_SECTION_ARCHITECTURE) {
    const key = actualKey(placement);

    if (!modules.has(key)) {
      modules.set(key, placement.module);
    }
  }

  return modules;
}

function placementMatrix(placement: LevelArchitecturePlacement): THREE.Matrix4 {
  const matrix = new THREE.Matrix4().makeRotationY(placement.rotationY ?? 0);

  matrix.setPosition(placement.position.x, placement.position.y, placement.position.z);

  return matrix;
}

function boundsOfParts(
  placement: LevelArchitecturePlacement,
  parts: readonly KitModulePart[],
): THREE.Box3 {
  const matrix = placementMatrix(placement);
  const bounds = new THREE.Box3();

  for (const part of parts) {
    part.geometry.computeBoundingBox();

    const local = part.geometry.boundingBox;

    if (local) {
      bounds.union(local.clone().applyMatrix4(matrix));
    }
  }

  if (bounds.isEmpty()) {
    throw new Error(`Placement "${placement.id}" produced no geometry bounds.`);
  }

  return bounds;
}

function worldBounds(placement: LevelArchitecturePlacement): THREE.Box3 {
  return boundsOfParts(placement, build(placement.module).parts);
}

/** World bounds grouped by semantic material, so a part can be isolated. */
function worldMaterialBounds(
  placement: LevelArchitecturePlacement,
): ReadonlyMap<string, THREE.Box3> {
  const model = build(placement.module);
  const matrix = placementMatrix(placement);
  const bounds = new Map<string, THREE.Box3>();

  for (const part of model.parts) {
    part.geometry.computeBoundingBox();

    const local = part.geometry.boundingBox;

    if (!local) {
      continue;
    }

    const world = local.clone().applyMatrix4(matrix);
    const existing = bounds.get(part.material);

    if (existing) {
      existing.union(world);
    } else {
      bounds.set(part.material, world);
    }
  }

  if (bounds.size === 0) {
    throw new Error(`Placement "${placement.id}" produced no geometry bounds.`);
  }

  return bounds;
}

const TRIANGLE_EPSILON = 1e-7;

interface MeshTriangle {
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  readonly c: THREE.Vector3;
}

interface WorldTriangle {
  readonly triangle: MeshTriangle;
  readonly min: THREE.Vector3;
  readonly max: THREE.Vector3;
  readonly index: number;
}

function triangleNormal(triangle: MeshTriangle): THREE.Vector3 {
  return new THREE.Vector3()
    .subVectors(triangle.b, triangle.a)
    .cross(new THREE.Vector3().subVectors(triangle.c, triangle.a));
}

function triangleInterval(triangle: MeshTriangle, axis: THREE.Vector3): readonly [number, number] {
  const values = [triangle.a, triangle.b, triangle.c].map((vertex) => vertex.dot(axis));

  return [Math.min(...values), Math.max(...values)];
}

function separatedOnAxis(first: MeshTriangle, second: MeshTriangle, axis: THREE.Vector3): boolean {
  const length = axis.length();

  if (length < 1e-12) {
    return false;
  }

  const normalized = axis.clone().divideScalar(length);
  const [firstMin, firstMax] = triangleInterval(first, normalized);
  const [secondMin, secondMax] = triangleInterval(second, normalized);

  return firstMax < secondMin - TRIANGLE_EPSILON || secondMax < firstMin - TRIANGLE_EPSILON;
}

function coplanarTrianglesIntersect(
  first: MeshTriangle,
  second: MeshTriangle,
  normal: THREE.Vector3,
): boolean {
  const magnitudes = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  const dropAxis = magnitudes.indexOf(Math.max(...magnitudes));
  const project2D = (point: THREE.Vector3): readonly [number, number] => {
    if (dropAxis === 0) {
      return [point.y, point.z];
    }

    if (dropAxis === 1) {
      return [point.x, point.z];
    }

    return [point.x, point.y];
  };
  const first2D = [first.a, first.b, first.c].map(project2D);
  const second2D = [second.a, second.b, second.c].map(project2D);
  const edges = (points: ReadonlyArray<readonly [number, number]>) =>
    [
      [points[0], points[1]],
      [points[1], points[2]],
      [points[2], points[0]],
    ] as const;

  for (const points of [first2D, second2D]) {
    for (const [start, end] of edges(points)) {
      if (!start || !end) {
        continue;
      }

      const axisX = -(end[1] - start[1]);
      const axisY = end[0] - start[0];
      const axisLength = Math.hypot(axisX, axisY);

      if (axisLength < 1e-12) {
        continue;
      }

      const nx = axisX / axisLength;
      const ny = axisY / axisLength;
      const firstProjection = first2D.map(([x, y]) => x * nx + y * ny);
      const secondProjection = second2D.map(([x, y]) => x * nx + y * ny);
      const firstMin = Math.min(...firstProjection);
      const firstMax = Math.max(...firstProjection);
      const secondMin = Math.min(...secondProjection);
      const secondMax = Math.max(...secondProjection);

      if (firstMax < secondMin - TRIANGLE_EPSILON || secondMax < firstMin - TRIANGLE_EPSILON) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Triangle-triangle intersection via the separating-axis theorem.
 *
 * For non-coplanar triangles the candidate axes are the two face normals and
 * the nine edge-edge cross products. Coplanar pairs need the in-plane edge
 * normals as well, otherwise two disjoint triangles on the same plane would
 * be reported as overlapping. Touching surfaces within TRIANGLE_EPSILON count
 * as intersecting; this test only establishes the fact, not penetration depth.
 */
function trianglesIntersect(first: MeshTriangle, second: MeshTriangle): boolean {
  const firstNormal = triangleNormal(first);
  const secondNormal = triangleNormal(second);
  const firstNormalLength = firstNormal.length();
  const secondNormalLength = secondNormal.length();

  if (firstNormalLength < 1e-12 || secondNormalLength < 1e-12) {
    return false;
  }

  const parallel =
    Math.abs(firstNormal.dot(secondNormal)) >= firstNormalLength * secondNormalLength * (1 - 1e-10);

  if (parallel) {
    const planeOffset = -firstNormal.dot(first.a) / firstNormalLength;
    const maxDistance = Math.max(
      ...[second.a, second.b, second.c].map((vertex) =>
        Math.abs(vertex.dot(firstNormal) / firstNormalLength + planeOffset),
      ),
    );

    if (maxDistance <= 1e-6) {
      return coplanarTrianglesIntersect(first, second, firstNormal);
    }
  }

  const firstEdges = [
    new THREE.Vector3().subVectors(first.b, first.a),
    new THREE.Vector3().subVectors(first.c, first.b),
    new THREE.Vector3().subVectors(first.a, first.c),
  ];
  const secondEdges = [
    new THREE.Vector3().subVectors(second.b, second.a),
    new THREE.Vector3().subVectors(second.c, second.b),
    new THREE.Vector3().subVectors(second.a, second.c),
  ];
  const axes: THREE.Vector3[] = [firstNormal, secondNormal];

  for (const firstEdge of firstEdges) {
    for (const secondEdge of secondEdges) {
      axes.push(new THREE.Vector3().crossVectors(firstEdge, secondEdge));
    }
  }

  for (const axis of axes) {
    if (separatedOnAxis(first, second, axis)) {
      return false;
    }
  }

  return true;
}

function partWorldTriangles(part: KitModulePart, matrix: THREE.Matrix4): WorldTriangle[] {
  const position = part.geometry.getAttribute("position");
  const index = part.geometry.getIndex();
  const vertices: THREE.Vector3[] = [];

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    vertices.push(
      new THREE.Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(matrix),
    );
  }

  const triangles: WorldTriangle[] = [];
  const indexCount = index ? index.count : position.count;

  for (let offset = 0; offset < indexCount; offset += 3) {
    const firstIndex = index ? index.getX(offset) : offset;
    const secondIndex = index ? index.getX(offset + 1) : offset + 1;
    const thirdIndex = index ? index.getX(offset + 2) : offset + 2;
    const a = vertices[firstIndex];
    const b = vertices[secondIndex];
    const c = vertices[thirdIndex];

    if (!a || !b || !c) {
      throw new Error(`Part "${part.material}" references a missing vertex.`);
    }

    triangles.push({
      triangle: { a, b, c },
      min: new THREE.Vector3(
        Math.min(a.x, b.x, c.x),
        Math.min(a.y, b.y, c.y),
        Math.min(a.z, b.z, c.z),
      ),
      max: new THREE.Vector3(
        Math.max(a.x, b.x, c.x),
        Math.max(a.y, b.y, c.y),
        Math.max(a.z, b.z, c.z),
      ),
      index: offset / 3,
    });
  }

  return triangles;
}

function worldTrianglesOverlap(first: WorldTriangle, second: WorldTriangle): boolean {
  return (
    first.min.x <= second.max.x + TRIANGLE_EPSILON &&
    first.max.x >= second.min.x - TRIANGLE_EPSILON &&
    first.min.y <= second.max.y + TRIANGLE_EPSILON &&
    first.max.y >= second.min.y - TRIANGLE_EPSILON &&
    first.min.z <= second.max.z + TRIANGLE_EPSILON &&
    first.max.z >= second.min.z - TRIANGLE_EPSILON
  );
}

interface CopingIntersectionDiagnostic {
  readonly id: string;
  readonly rotationY: number;
  readonly whiteTriangles: number;
  readonly concreteTriangles: number;
  readonly intersectingPairs: number;
  readonly firstPair: {
    readonly whiteTriangle: number;
    readonly concreteTriangle: number;
    readonly whiteCentroid: THREE.Vector3;
    readonly concreteCentroid: THREE.Vector3;
  } | null;
}

function diagnoseCopingIntersections(): CopingIntersectionDiagnostic[] {
  const diagnostics: CopingIntersectionDiagnostic[] = [];

  for (const placement of FIRST_SECTION_ARCHITECTURE) {
    if (placement.module.kind !== "parapet") {
      continue;
    }

    const model = build(placement.module);
    const matrix = placementMatrix(placement);
    const whiteParts = model.parts.filter((part) => part.material === "white");
    const concreteParts = model.parts.filter((part) => part.material === "concrete");
    const whiteTriangles = whiteParts.flatMap((part) => partWorldTriangles(part, matrix));
    const concreteTriangles = concreteParts.flatMap((part) => partWorldTriangles(part, matrix));
    let intersectingPairs = 0;
    let firstPair: CopingIntersectionDiagnostic["firstPair"] = null;

    for (const white of whiteTriangles) {
      for (const concrete of concreteTriangles) {
        if (!worldTrianglesOverlap(white, concrete)) {
          continue;
        }

        if (trianglesIntersect(white.triangle, concrete.triangle)) {
          intersectingPairs += 1;

          if (!firstPair) {
            const whiteCentroid = new THREE.Vector3()
              .add(white.triangle.a)
              .add(white.triangle.b)
              .add(white.triangle.c)
              .divideScalar(3);
            const concreteCentroid = new THREE.Vector3()
              .add(concrete.triangle.a)
              .add(concrete.triangle.b)
              .add(concrete.triangle.c)
              .divideScalar(3);

            firstPair = {
              whiteTriangle: white.index,
              concreteTriangle: concrete.index,
              whiteCentroid,
              concreteCentroid,
            };
          }
        }
      }
    }

    diagnostics.push({
      id: placement.id,
      rotationY: placement.rotationY ?? 0,
      whiteTriangles: whiteTriangles.length,
      concreteTriangles: concreteTriangles.length,
      intersectingPairs,
      firstPair,
    });
  }

  return diagnostics;
}

function overlap1D(
  firstMin: number,
  firstMax: number,
  secondMin: number,
  secondMax: number,
): number {
  return Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin);
}

function xOverlap(first: THREE.Box3, second: THREE.Box3): number {
  return overlap1D(first.min.x, first.max.x, second.min.x, second.max.x);
}

function zOverlap(first: THREE.Box3, second: THREE.Box3): number {
  return overlap1D(first.min.z, first.max.z, second.min.z, second.max.z);
}

describe("First gameplay section Architectural Kit layer", () => {
  it("authors all 52 placements across the six layout sections", () => {
    const sections = [...FIRST_SECTION_LAYOUT.sections].sort(
      (left, right) => left.order - right.order,
    );
    const actualSections = countBySection(FIRST_SECTION_ARCHITECTURE);
    const expectedSections = countBySection(EXPECTED_PLACEMENTS);
    const actualCounts = sections.map((section) => actualSections.get(section.id) ?? 0);

    expect(FIRST_SECTION_ARCHITECTURE).toHaveLength(52);
    expect(EXPECTED_PLACEMENTS).toHaveLength(52);
    expect(actualCounts).toEqual([10, 11, 10, 2, 5, 14]);
    expect(actualSections).toEqual(expectedSections);
  });

  it("uses 11 Kit kinds and the 13 documented variants", () => {
    const actualVariants = uniqueModules();
    const actualKinds = new Set(
      FIRST_SECTION_ARCHITECTURE.map((placement) => placement.module.kind),
    );

    expect(EXPECTED_PLACEMENTS.map((placement) => expectedKey(placement.variant))).toHaveLength(52);
    expect(
      new Set(EXPECTED_PLACEMENTS.map((placement) => expectedKey(placement.variant))).size,
    ).toBe(13);
    expect(actualVariants.size).toBe(13);
    expect(new Set(actualVariants.keys())).toEqual(
      new Set(EXPECTED_PLACEMENTS.map((placement) => expectedKey(placement.variant))),
    );
    expect(countActualByVariant(FIRST_SECTION_ARCHITECTURE)).toEqual(
      countByVariant(EXPECTED_PLACEMENTS),
    );

    for (const name of VARIANT_NAMES) {
      // The exported record and the implementation placements must agree.
      expect(architecturalModuleKey(VARIANTS[name]), name).toBe(expectedKey(name));
    }

    expect(actualKinds.size).toBe(11);
    expect([...actualKinds].sort()).toEqual([
      "canopy",
      "column",
      "corner",
      "curtain-wall",
      "facade-bay",
      "facade-screen",
      "joint",
      "louver",
      "parapet",
      "service-portal",
      "ventilation",
    ]);

    for (const unused of ["cantilever", "bridge", "stair", "glass-railing"]) {
      expect([...actualKinds]).not.toContain(unused);
    }
  });

  it("matches every placement against the §5 table", () => {
    const actual = FIRST_SECTION_ARCHITECTURE.map(actualPlacementSignature).sort();
    const expected = EXPECTED_PLACEMENTS.map(expectedPlacementSignature).sort();

    // Exact multiset comparison detects missing, extra, duplicated, moved,
    // re-rotated, or re-varianted placements.
    expect(actual).toHaveLength(52);
    expect(actual).toEqual(expected);
  });

  it("keeps every placement id unique and scoped to the authored sections", () => {
    const ids = FIRST_SECTION_ARCHITECTURE.map((placement) => placement.id);
    const sectionIds = new Set(FIRST_SECTION_LAYOUT.sections.map((section) => section.id));
    const collisionIds = new Set([
      ...FIRST_SECTION_LAYOUT.geometry.map((geometry) => geometry.id),
      ...FIRST_SECTION_LAYOUT.triggers.map((trigger) => trigger.id),
    ]);

    expect(new Set(ids).size).toBe(52);

    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      expect(placement.id.trim().length).toBeGreaterThan(0);
      expect(sectionIds.has(placement.sectionId), placement.id).toBe(true);
      expect(collisionIds.has(placement.id), placement.id).toBe(false);
    }
  });

  it("passes the existing Kit validation for every definition", () => {
    for (const name of VARIANT_NAMES) {
      expect(validateArchitecturalModuleDefinition(VARIANTS[name]), name).toEqual([]);
    }

    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      expect(validateArchitecturalModuleDefinition(placement.module), placement.id).toEqual([]);
    }
  });

  it("builds 55 instanced batches from the real Kit builders", () => {
    const modules = uniqueModules();
    let batches = 0;

    expect(modules.size).toBe(13);

    for (const [key, definition] of modules) {
      const model = build(definition);
      const parts = model.parts.length;

      expect(model.key, key).toBe(key);
      expect(parts, key).toBeGreaterThanOrEqual(3);
      expect(parts, key).toBeLessThanOrEqual(6);
      expect(model.triangles, key).toBeGreaterThan(0);
      batches += parts;
    }

    expect(batches).toBe(55);
  });

  it("supports the full coping footprint with only the designed overhang", () => {
    const copings = FIRST_SECTION_ARCHITECTURE.filter(
      (placement) => placement.module.kind === "parapet",
    );

    expect(copings).toHaveLength(12);

    // The two coordinates corrected after the collision-geometry review.
    expect(findPlacement("arch_technical_parapet_north_west").position.z).toBeCloseTo(-27.575, 6);
    expect(findPlacement("arch_finish_parapet_west").position.x).toBeCloseTo(-4.8, 6);
    expect(findPlacement("arch_finish_parapet_east").position.x).toBeCloseTo(4.8, 6);

    for (const coping of copings) {
      const materialBounds = worldMaterialBounds(coping);
      const footprint = materialBounds.get("white");
      const rotation = coping.rotationY ?? 0;
      const alongX = Math.abs(Math.cos(rotation)) > 0.5;
      const supports = FIRST_SECTION_LAYOUT.geometry.filter((geometry) => {
        const top = geometry.position.y + geometry.size.y / 2;

        if (Math.abs(top - coping.position.y) > EPSILON) {
          return false;
        }

        const halfX = geometry.size.x / 2;
        const halfZ = geometry.size.z / 2;

        return (
          coping.position.x >= geometry.position.x - halfX - EPSILON &&
          coping.position.x <= geometry.position.x + halfX + EPSILON &&
          coping.position.z >= geometry.position.z - halfZ - EPSILON &&
          coping.position.z <= geometry.position.z + halfZ + EPSILON
        );
      });

      expect(supports, coping.id).toHaveLength(1);

      const support = supports[0];

      if (!support || coping.module.kind !== "parapet" || !footprint) {
        throw new Error(`Missing coping support data for "${coping.id}".`);
      }

      const supportMinX = support.position.x - support.size.x / 2;
      const supportMaxX = support.position.x + support.size.x / 2;
      const supportMinZ = support.position.z - support.size.z / 2;
      const supportMaxZ = support.position.z + support.size.z / 2;
      const footprintMinX = footprint.min.x;
      const footprintMaxX = footprint.max.x;
      const footprintMinZ = footprint.min.z;
      const footprintMaxZ = footprint.max.z;

      const footprintMinAlong = alongX ? footprintMinX : footprintMinZ;
      const footprintMaxAlong = alongX ? footprintMaxX : footprintMaxZ;
      const footprintMinDepth = alongX ? footprintMinZ : footprintMinX;
      const footprintMaxDepth = alongX ? footprintMaxZ : footprintMaxX;
      const supportMinAlong = alongX ? supportMinX : supportMinZ;
      const supportMaxAlong = alongX ? supportMaxX : supportMaxZ;
      const supportMinDepth = alongX ? supportMinZ : supportMinX;
      const supportMaxDepth = alongX ? supportMaxZ : supportMaxX;

      const supportTop = support.position.y + support.size.y / 2;

      // The white coping plate is the structural cap. Its lower face is
      // height - 0.175 = 0.025 m above the module origin: a 0.020 m concrete
      // upstand plus the designed 0.005 m shadow gap. The module's dark-metal
      // strip and red accent sit at or below the origin, so the total module
      // AABB must not be used as the support plane.
      expect(coping.position.y, coping.id).toBeCloseTo(supportTop, 6);
      expect(footprint.min.y - supportTop, coping.id).toBeCloseTo(0.025, 3);
      expect(footprint.max.y - footprint.min.y, coping.id).toBeCloseTo(0.17, 3);

      // The 0.46 m coping fully covers the 0.35 m collision parapet depth;
      // the designed overhang is (0.46 - 0.35) / 2 = 0.055 m on each side.
      expect(footprintMinDepth, coping.id).toBeLessThanOrEqual(supportMinDepth + EPSILON);
      expect(footprintMaxDepth, coping.id).toBeGreaterThanOrEqual(supportMaxDepth - EPSILON);

      const depthOverhangLow = supportMinDepth - footprintMinDepth;
      const depthOverhangHigh = footprintMaxDepth - supportMaxDepth;

      expect(depthOverhangLow, coping.id).toBeCloseTo(0.055, 3);
      expect(depthOverhangHigh, coping.id).toBeCloseTo(0.055, 3);

      // The upstand is fully supported along the run. Only the coping plate's
      // designed 0.02 m end overhang may exceed the collision parapet.
      const supportedAlong = overlap1D(
        footprintMinAlong,
        footprintMaxAlong,
        supportMinAlong,
        supportMaxAlong,
      );

      expect(supportedAlong, coping.id).toBeGreaterThanOrEqual(coping.module.length - EPSILON);

      const runOverhangLow = Math.max(0, supportMinAlong - footprintMinAlong);
      const runOverhangHigh = Math.max(0, footprintMaxAlong - supportMaxAlong);

      expect(runOverhangLow, coping.id).toBeLessThanOrEqual(0.02 + EPSILON);
      expect(runOverhangHigh, coping.id).toBeLessThanOrEqual(0.02 + EPSILON);
    }
  });

  it("mirrors the S5 corner pair and keeps it clear of the curtain walls", () => {
    const westPlacement = findPlacement("arch_finish_corner_west");
    const eastPlacement = findPlacement("arch_finish_corner_east");

    expect(westPlacement.rotationY ?? 0).toBeCloseTo(0, 6);
    expect(eastPlacement.rotationY ?? 0).toBeCloseTo(-HALF_PI, 6);

    const west = worldBounds(westPlacement);
    const east = worldBounds(eastPlacement);
    const westCurtain = worldBounds(findPlacement("arch_finish_curtain_lower_west"));
    const eastCurtain = worldBounds(findPlacement("arch_finish_curtain_lower_east"));

    // The handed corner module is mirrored by choosing yaw -π/2 on the east.
    expect(east.min.x).toBeCloseTo(-west.max.x, 5);
    expect(east.max.x).toBeCloseTo(-west.min.x, 5);
    expect(east.min.y).toBeCloseTo(west.min.y, 5);
    expect(east.max.y).toBeCloseTo(west.max.y, 5);
    expect(east.min.z).toBeCloseTo(west.min.z, 5);
    expect(east.max.z).toBeCloseTo(west.max.z, 5);

    // Both front wings stay on the authored facade plane z = -87.5.
    expect(west.max.z).toBeCloseTo(east.max.z, 6);
    expect(Math.abs(west.max.z + 87.5)).toBeLessThan(0.15);

    // The corner wings must not run into the curtain-wall panels: the west
    // corner ends at x ≈ -6.925, the west curtain runs x -6…0, and the east
    // pair mirrors that gap. With east yaw 0 the wing reached x 2.8…7.075 and
    // overlapped the curtain wall.
    expect(zOverlap(west, westCurtain)).toBeGreaterThan(0);
    expect(zOverlap(east, eastCurtain)).toBeGreaterThan(0);
    expect(xOverlap(west, westCurtain)).toBeLessThanOrEqual(EPSILON);
    expect(xOverlap(east, eastCurtain)).toBeLessThanOrEqual(EPSILON);
    expect(xOverlap(west, eastCurtain)).toBeLessThanOrEqual(EPSILON);
    expect(xOverlap(east, westCurtain)).toBeLessThanOrEqual(EPSILON);
    expect(xOverlap(west, east)).toBeLessThanOrEqual(EPSILON);
  });

  it("rebuilds the same variants deterministically", () => {
    for (const [key, definition] of uniqueModules()) {
      const first = build(definition);
      const second = build(definition);

      expect(second.key, key).toBe(first.key);
      expect(second.triangles, key).toBe(first.triangles);
      expect(second.parts.length, key).toBe(first.parts.length);

      for (let index = 0; index < first.parts.length; index += 1) {
        const firstPart = first.parts[index];
        const secondPart = second.parts[index];

        if (!firstPart || !secondPart) {
          throw new Error(`Missing part ${index} for "${key}".`);
        }

        expect(secondPart.material, `${key}#${index}`).toBe(firstPart.material);

        const firstPositions = firstPart.geometry.getAttribute("position");
        const secondPositions = secondPart.geometry.getAttribute("position");

        expect(secondPositions.count, `${key}#${index}`).toBe(firstPositions.count);
        expect(Array.from(secondPositions.array as Float32Array), `${key}#${index}`).toEqual(
          Array.from(firstPositions.array as Float32Array),
        );
      }
    }
  });

  it("leaves the collision layout untouched", () => {
    const before = JSON.stringify(FIRST_SECTION_LAYOUT.geometry);
    const sectionIds = FIRST_SECTION_LAYOUT.sections.map((section) => section.id);

    for (const definition of uniqueModules().values()) {
      build(definition);
    }

    expect(FIRST_SECTION_LAYOUT.geometry).toHaveLength(58);
    expect(JSON.stringify(FIRST_SECTION_LAYOUT.geometry)).toBe(before);
    expect(FIRST_SECTION_LAYOUT.sections.map((section) => section.id)).toEqual(sectionIds);
    expect(FIRST_SECTION_LAYOUT.sections).toHaveLength(6);

    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      for (const key of Object.keys(placement)) {
        expect(["id", "sectionId", "module", "position", "rotationY"]).toContain(key);
      }

      expect("collider" in placement).toBe(false);
      expect("rigidBody" in placement).toBe(false);
      expect("geometry" in placement).toBe(false);
    }
  });

  it("separates known triangle-mesh intersection cases", () => {
    const triangle = (
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      cx: number,
      cy: number,
      cz: number,
    ): MeshTriangle => ({
      a: new THREE.Vector3(ax, ay, az),
      b: new THREE.Vector3(bx, by, bz),
      c: new THREE.Vector3(cx, cy, cz),
    });
    const base = triangle(0, 0, 0, 1, 0, 0, 0, 1, 0);
    const coplanarOverlap = triangle(0.2, 0.2, 0, 0.8, 0.2, 0, 0.2, 0.8, 0);
    const coplanarApart = triangle(2, 2, 0, 3, 2, 0, 2, 3, 0);
    const parallelPlane = triangle(0.2, 0.2, 1, 0.8, 0.2, 1, 0.2, 0.8, 1);
    const crossing = triangle(0.2, 0.2, -1, 0.2, 0.2, 1, 0.8, 0.8, 0);

    expect(trianglesIntersect(base, coplanarOverlap)).toBe(true);
    expect(trianglesIntersect(base, coplanarApart)).toBe(false);
    expect(trianglesIntersect(base, parallelPlane)).toBe(false);
    expect(trianglesIntersect(base, crossing)).toBe(true);
  });

  it("confirms triangle-level coping/concrete intersection for all 12 copings", () => {
    const diagnostics = diagnoseCopingIntersections();

    expect(diagnostics).toHaveLength(12);
    expect(new Set(diagnostics.map((diagnostic) => diagnostic.rotationY))).toEqual(
      new Set([0, HALF_PI]),
    );

    for (const diagnostic of diagnostics) {
      expect(diagnostic.whiteTriangles, diagnostic.id).toBeGreaterThan(0);
      expect(diagnostic.concreteTriangles, diagnostic.id).toBeGreaterThan(0);
      expect(diagnostic.intersectingPairs, diagnostic.id).toBeGreaterThan(0);
      expect(diagnostic.firstPair, diagnostic.id).not.toBeNull();

      if (diagnostic.firstPair) {
        expect(diagnostic.firstPair.whiteTriangle, diagnostic.id).toBeGreaterThanOrEqual(0);
        expect(diagnostic.firstPair.concreteTriangle, diagnostic.id).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(diagnostic.firstPair.whiteCentroid.y), diagnostic.id).toBe(true);
        expect(Number.isFinite(diagnostic.firstPair.concreteCentroid.y), diagnostic.id).toBe(true);
      }
    }
  });

  it("builds visual-only models without creating physics colliders", async () => {
    const physics = new PhysicsWorld({
      gravity: { x: 0, y: -9.81, z: 0 },
      timestepSeconds: 1 / 60,
    });

    await physics.initialize();

    try {
      const before = physics.rapierWorld.colliders.len();

      for (const definition of uniqueModules().values()) {
        const model = build(definition);

        for (const part of model.parts) {
          expect(Object.keys(part).sort()).toEqual([
            "castShadow",
            "geometry",
            "material",
            "receiveShadow",
          ]);
        }
      }

      expect(physics.rapierWorld.colliders.len()).toBe(before);
      expect(before).toBe(0);
    } finally {
      physics.dispose();
    }
  });
});
