import { afterEach, describe, expect, it } from "vitest";

import {
  type ArchitecturalModuleDefinition,
  type ArchitecturalModuleKind,
  architecturalModuleKey,
  architecturalModuleSignature,
  buildArchitecturalModule,
  type KitModuleModel,
  validateArchitecturalModuleDefinition,
} from "../../src/levels/architecture/ArchitecturalKit";
import { KitGeometryPool } from "../../src/levels/architecture/KitGeometry";
import {
  FIRST_SECTION_ARCHITECTURE,
  FIRST_SECTION_ARCHITECTURE_VARIANTS,
} from "../../src/levels/first-section/FirstSectionArchitecture";
import { FIRST_SECTION_LAYOUT } from "../../src/levels/first-section/FirstSectionLayout";
import type { LevelArchitecturePlacement } from "../../src/levels/LevelTypes";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";

/**
 * Architectural Kit layer of the first gameplay section
 * (`FIRST_GAMEPLAY_SECTION_SPEC` §6 and §§5.1–5.6).
 *
 * The placement totals follow §6 (48 placements / 13 variants / 55 batches).
 * The four §5.1/§5.5 entries that §6 does not count are documented in
 * `FirstSectionArchitecture.ts` and are intentionally absent from the array.
 */

const VARIANTS = FIRST_SECTION_ARCHITECTURE_VARIANTS;
const HALF_PI = Math.PI / 2;
const EPSILON = 1e-6;

/** §6 order: facade-bay, curtain-wall, corner, column, canopy, two parapets, ... */
const VARIANT_ORDER = [
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

type VariantName = (typeof VARIANT_ORDER)[number];

/** §6 placement counts in the same order; the sum is the mandated 48. */
const VARIANT_PLACEMENT_COUNTS: readonly number[] = [2, 8, 2, 4, 2, 10, 2, 2, 2, 1, 2, 7, 4];

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

function variantKey(name: VariantName): string {
  return architecturalModuleKey(VARIANTS[name]);
}

function placementKey(placement: LevelArchitecturePlacement): string {
  return architecturalModuleKey(placement.module);
}

function findPlacement(id: string): LevelArchitecturePlacement {
  const placement = FIRST_SECTION_ARCHITECTURE.find((candidate) => candidate.id === id);

  if (!placement) {
    throw new Error(`Missing architecture placement "${id}".`);
  }

  return placement;
}

interface KeyPlacementExpectation {
  readonly id: string;
  readonly kind: ArchitecturalModuleKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
}

/** Representative placements covering every section and both yaw directions. */
const KEY_PLACEMENTS: readonly KeyPlacementExpectation[] = [
  {
    id: "arch_start_facade_bay_1",
    kind: "facade-bay",
    x: 3,
    y: 0,
    z: 2.1,
    rotationY: -HALF_PI,
  },
  {
    id: "arch_start_parapet_north",
    kind: "parapet",
    x: 0,
    y: 1.05,
    z: 17.82,
    rotationY: 0,
  },
  {
    id: "arch_start_column_west",
    kind: "column",
    x: -2.6,
    y: 0,
    z: 12,
    rotationY: 0,
  },
  {
    id: "arch_start_canopy",
    kind: "canopy",
    x: 0,
    y: 3.6,
    z: 12,
    rotationY: 0,
  },
  {
    id: "arch_jump_curtain_penthouse",
    kind: "curtain-wall",
    x: 3,
    y: 0,
    z: -9.4,
    rotationY: -HALF_PI,
  },
  {
    id: "arch_jump_curtain_canyon_south",
    kind: "curtain-wall",
    x: 0,
    y: -8.4,
    z: -13.4,
    rotationY: Math.PI,
  },
  {
    id: "arch_jump_facade_screen",
    kind: "facade-screen",
    x: 8.02,
    y: 0,
    z: -9.4,
    rotationY: HALF_PI,
  },
  {
    id: "arch_jump_joint_south",
    kind: "joint",
    x: 3.05,
    y: 0,
    z: -13.35,
    rotationY: 0,
  },
  {
    id: "arch_technical_portal_entry",
    kind: "service-portal",
    x: 0,
    y: 0.9,
    z: -30,
    rotationY: 0,
  },
  {
    id: "arch_technical_ventilation_north",
    kind: "ventilation",
    x: 1.85,
    y: 0.9,
    z: -33,
    rotationY: HALF_PI,
  },
  {
    id: "arch_technical_louver_west",
    kind: "louver",
    x: -3.45,
    y: 0.9,
    z: -38.5,
    rotationY: -HALF_PI,
  },
  {
    id: "arch_technical_parapet_north_west",
    kind: "parapet",
    x: -6,
    y: 1.95,
    z: -27.575,
    rotationY: 0,
  },
  {
    id: "arch_technical_joint_chamber",
    kind: "joint",
    x: 0,
    y: 0.9,
    z: -36.3,
    rotationY: 0,
  },
  {
    id: "arch_slide_jamb_west",
    kind: "joint",
    x: -1.85,
    y: 0.9,
    z: -47,
    rotationY: 0,
  },
  {
    id: "arch_vault_joint_2",
    kind: "joint",
    x: 0,
    y: 0.9,
    z: -63.5,
    rotationY: 0,
  },
  {
    id: "arch_finish_canopy",
    kind: "canopy",
    x: 0,
    y: 8.1,
    z: -84,
    rotationY: 0,
  },
  {
    id: "arch_finish_curtain_upper_east",
    kind: "curtain-wall",
    x: 3,
    y: 8.7,
    z: -87.5,
    rotationY: 0,
  },
  {
    id: "arch_finish_corner_east",
    kind: "corner",
    x: 7,
    y: 4.5,
    z: -87.5,
    rotationY: 0,
  },
  {
    id: "arch_finish_column_west",
    kind: "column",
    x: -3.2,
    y: 4.5,
    z: -84,
    rotationY: 0,
  },
  {
    id: "arch_finish_parapet_west",
    kind: "parapet",
    x: -4.62,
    y: 5.55,
    z: -83,
    rotationY: HALF_PI,
  },
  {
    id: "arch_finish_parapet_south",
    kind: "parapet",
    x: 0,
    y: 5.55,
    z: -87.32,
    rotationY: 0,
  },
];

describe("First gameplay section Architectural Kit layer", () => {
  it("authors exactly 48 placements across the six layout sections", () => {
    const sections = [...FIRST_SECTION_LAYOUT.sections].sort(
      (left, right) => left.order - right.order,
    );
    const counts = new Map<string, number>();

    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      counts.set(placement.sectionId, (counts.get(placement.sectionId) ?? 0) + 1);
    }

    expect(FIRST_SECTION_ARCHITECTURE).toHaveLength(48);
    expect(counts.size).toBe(6);
    // S0 8, S1 11, S2 10, S3 2, S4 3, S5 14.
    expect(sections.map((section) => counts.get(section.id) ?? 0)).toEqual([8, 11, 10, 2, 3, 14]);
    expect(counts.size).toBe(FIRST_SECTION_LAYOUT.sections.length);
  });

  it("uses 11 Kit kinds and the 13 documented variants", () => {
    const keys = new Set(VARIANT_ORDER.map((name) => variantKey(name)));

    expect(VARIANT_ORDER).toHaveLength(13);
    expect(keys.size).toBe(13);

    const placementCounts = new Map<string, number>();
    const signatures = new Map<string, Set<string>>();

    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      const key = placementKey(placement);

      expect(keys.has(key), placement.id).toBe(true);

      placementCounts.set(key, (placementCounts.get(key) ?? 0) + 1);

      const signatureSet = signatures.get(key) ?? new Set<string>();

      signatureSet.add(architecturalModuleSignature(placement.module));
      signatures.set(key, signatureSet);
    }

    expect(VARIANT_ORDER.map((name) => placementCounts.get(variantKey(name)) ?? 0)).toEqual(
      VARIANT_PLACEMENT_COUNTS,
    );

    for (const [key, signatureSet] of signatures) {
      // One generated model per key: all placements must share the full
      // definition signature, not only the 1 mm identity key.
      expect(signatureSet.size, key).toBe(1);
    }

    const kinds = new Set(VARIANT_ORDER.map((name) => VARIANTS[name].kind));

    expect(kinds.size).toBe(11);
    expect([...kinds].sort()).toEqual([
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
      expect([...kinds]).not.toContain(unused);
    }
  });

  it("builds 55 instanced batches from the real Kit builders", () => {
    let batches = 0;

    for (const name of VARIANT_ORDER) {
      const model = build(VARIANTS[name]);
      const parts = model.parts.length;

      expect(model.key, name).toBe(variantKey(name));
      expect(parts, name).toBeGreaterThanOrEqual(3);
      expect(parts, name).toBeLessThanOrEqual(6);
      expect(model.triangles, name).toBeGreaterThan(0);
      batches += parts;
    }

    // One InstancedMesh per variant part: the §6 55-batch total.
    expect(batches).toBe(55);
  });

  it("keeps every placement id unique and inside the six authored sections", () => {
    const ids = FIRST_SECTION_ARCHITECTURE.map((placement) => placement.id);
    const sectionIds = new Set(FIRST_SECTION_LAYOUT.sections.map((section) => section.id));
    const collisionIds = new Set([
      ...FIRST_SECTION_LAYOUT.geometry.map((geometry) => geometry.id),
      ...FIRST_SECTION_LAYOUT.triggers.map((trigger) => trigger.id),
    ]);

    expect(new Set(ids).size).toBe(48);

    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      expect(placement.id.trim().length).toBeGreaterThan(0);
      expect(sectionIds.has(placement.sectionId), placement.id).toBe(true);
      // Keep the visual namespace disjoint from collision/trigger ids.
      expect(collisionIds.has(placement.id), placement.id).toBe(false);
    }
  });

  it("passes the existing Kit validation for every authored definition", () => {
    for (const name of VARIANT_ORDER) {
      expect(validateArchitecturalModuleDefinition(VARIANTS[name]), name).toEqual([]);
    }

    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      expect(validateArchitecturalModuleDefinition(placement.module), placement.id).toEqual([]);
    }
  });

  it("authors the documented §6 variant parameters", () => {
    expect(VARIANTS.facadeBay).toMatchObject({
      kind: "facade-bay",
      width: 4.2,
      height: 4.2,
      revealDepth: 0.7,
      accent: true,
    });
    expect(VARIANTS.curtainWall).toMatchObject({
      kind: "curtain-wall",
      width: 6,
      height: 4.2,
      columns: 3,
      rows: 1,
      spandrel: true,
    });
    expect(VARIANTS.corner).toMatchObject({
      kind: "corner",
      width: 4.2,
      depth: 4.2,
      height: 9,
      accent: true,
    });
    expect(VARIANTS.column).toMatchObject({
      kind: "column",
      height: 3.6,
      width: 0.9,
      accent: true,
    });
    expect(VARIANTS.canopy).toMatchObject({
      kind: "canopy",
      width: 7,
      depth: 3.4,
      thickness: 0.24,
      tensionRods: true,
    });
    expect(VARIANTS.parapetSixMeters).toMatchObject({
      kind: "parapet",
      length: 6,
      height: 0.2,
      accent: true,
    });
    expect(VARIANTS.parapetFourMeters).toMatchObject({
      kind: "parapet",
      length: 4,
      height: 0.2,
      accent: true,
    });
    expect(VARIANTS.servicePortal).toMatchObject({
      kind: "service-portal",
      width: 2.8,
      height: 2.4,
      depth: 0.7,
      louvered: true,
    });
    expect(VARIANTS.ventilation).toMatchObject({
      kind: "ventilation",
      width: 2.8,
      height: 2.4,
      depth: 1,
      blades: 6,
    });
    expect(VARIANTS.louver).toMatchObject({
      kind: "louver",
      width: 5,
      height: 4,
      depth: 0.45,
      bladeCount: 18,
    });
    expect(VARIANTS.facadeScreen).toMatchObject({
      kind: "facade-screen",
      width: 6,
      height: 4.2,
      ribbons: 12,
    });
    expect(VARIANTS.jointTwoMeters).toMatchObject({
      kind: "joint",
      width: 0.9,
      height: 2,
      depth: 0.5,
    });
    expect(VARIANTS.jointFourPointFiveMeters).toMatchObject({
      kind: "joint",
      width: 0.9,
      height: 4.5,
      depth: 0.5,
    });
  });

  it("matches the key §5 coordinates and rotations", () => {
    for (const expected of KEY_PLACEMENTS) {
      const placement = findPlacement(expected.id);

      expect(placement.module.kind, expected.id).toBe(expected.kind);
      expect(placement.position.x, expected.id).toBeCloseTo(expected.x, 6);
      expect(placement.position.y, expected.id).toBeCloseTo(expected.y, 6);
      expect(placement.position.z, expected.id).toBeCloseTo(expected.z, 6);
      expect(placement.rotationY ?? 0, expected.id).toBeCloseTo(expected.rotationY, 6);
    }

    // Kit placements are authored on quarter turns.
    for (const placement of FIRST_SECTION_ARCHITECTURE) {
      const turns = (placement.rotationY ?? 0) / HALF_PI;

      expect(Math.abs(turns - Math.round(turns)), placement.id).toBeLessThan(EPSILON);
    }
  });

  it("seats every parapet coping on a collision parapet top", () => {
    const copings = FIRST_SECTION_ARCHITECTURE.filter(
      (placement) => placement.module.kind === "parapet",
    );

    expect(copings).toHaveLength(12);

    for (const coping of copings) {
      expect(coping.module.kind === "parapet" ? coping.module.height : 0).toBeCloseTo(0.2, 6);

      const supports = FIRST_SECTION_LAYOUT.geometry.filter((geometry) => {
        const top = geometry.position.y + geometry.size.y / 2;

        if (Math.abs(top - coping.position.y) > EPSILON) {
          return false;
        }

        const tolerance = 0.02;
        const minX = geometry.position.x - geometry.size.x / 2 - tolerance;
        const maxX = geometry.position.x + geometry.size.x / 2 + tolerance;
        const minZ = geometry.position.z - geometry.size.z / 2 - tolerance;
        const maxZ = geometry.position.z + geometry.size.z / 2 + tolerance;

        return (
          coping.position.x >= minX &&
          coping.position.x <= maxX &&
          coping.position.z >= minZ &&
          coping.position.z <= maxZ
        );
      });

      // A coping is a 0.20 m cap on an existing collision parapet, never a
      // freestanding railing. The 0.02 m tolerance covers the small plan
      // overhang of the physical 0.35 m parapet vs. the authored coping.
      expect(supports.length, coping.id).toBeGreaterThan(0);
    }
  });

  it("rebuilds the same variants deterministically", () => {
    for (const name of VARIANT_ORDER) {
      const first = build(VARIANTS[name]);
      const second = build(VARIANTS[name]);

      expect(second.key, name).toBe(first.key);
      expect(second.triangles, name).toBe(first.triangles);
      expect(second.parts.length, name).toBe(first.parts.length);

      for (let index = 0; index < first.parts.length; index += 1) {
        const firstPart = first.parts[index];
        const secondPart = second.parts[index];

        if (!firstPart || !secondPart) {
          throw new Error(`Missing part ${index} for "${name}".`);
        }

        expect(secondPart.material, `${name}#${index}`).toBe(firstPart.material);

        const firstPositions = firstPart.geometry.getAttribute("position");
        const secondPositions = secondPart.geometry.getAttribute("position");

        expect(secondPositions.count, `${name}#${index}`).toBe(firstPositions.count);
        expect(Array.from(secondPositions.array as Float32Array), `${name}#${index}`).toEqual(
          Array.from(firstPositions.array as Float32Array),
        );
      }
    }
  });

  it("leaves the collision layout untouched", () => {
    const before = JSON.stringify(FIRST_SECTION_LAYOUT.geometry);
    const sectionIds = FIRST_SECTION_LAYOUT.sections.map((section) => section.id);

    for (const name of VARIANT_ORDER) {
      build(VARIANTS[name]);
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

  it("builds visual-only models without creating physics colliders", async () => {
    const physics = new PhysicsWorld({
      gravity: { x: 0, y: -9.81, z: 0 },
      timestepSeconds: 1 / 60,
    });

    await physics.initialize();

    try {
      const before = physics.rapierWorld.colliders.len();

      for (const name of VARIANT_ORDER) {
        const model = build(VARIANTS[name]);

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
