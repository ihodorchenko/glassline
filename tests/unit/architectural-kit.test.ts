import { afterEach, describe, expect, it } from "vitest";

import {
  ARCHITECTURAL_KIT_MODULE_KINDS,
  type ArchitecturalModuleDefinition,
  architecturalModuleKey,
  buildArchitecturalModule,
  type KitModuleModel,
  validateArchitecturalModuleDefinition,
} from "../../src/levels/architecture/ArchitecturalKit";
import { KitGeometryPool } from "../../src/levels/architecture/KitGeometry";
import { type MaterialKey, MaterialLibrary } from "../../src/rendering/MaterialLibrary";

const MINIMAL_MODULES: readonly ArchitecturalModuleDefinition[] = [
  { kind: "facade-bay", width: 4.2, height: 4.2 },
  { kind: "curtain-wall", width: 6, height: 4.2 },
  { kind: "corner", width: 4.2, depth: 4.2, height: 9 },
  { kind: "column", height: 5.2, width: 0.9 },
  { kind: "cantilever", width: 8, depth: 3.2 },
  { kind: "canopy", width: 7, depth: 3.4 },
  { kind: "bridge", length: 10, width: 3.2, height: 3.4 },
  { kind: "stair", width: 2.4, height: 4.2, run: 4.8 },
  { kind: "parapet", length: 6, height: 1.1 },
  { kind: "service-portal", width: 2.8, height: 3 },
  { kind: "ventilation", width: 2.8, height: 2.4 },
  { kind: "louver", width: 5, height: 4 },
  { kind: "glass-railing", length: 4 },
  { kind: "facade-screen", width: 5, height: 4.5 },
  { kind: "joint", height: 3.6 },
];

const pools: KitGeometryPool[] = [];
const models: KitModuleModel[] = [];

function createPool(): KitGeometryPool {
  const pool = new KitGeometryPool();

  pools.push(pool);

  return pool;
}

function build(definition: ArchitecturalModuleDefinition, pool = createPool()): KitModuleModel {
  const model = buildArchitecturalModule(definition, pool);

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

describe("Architectural Kit module builders", () => {
  it("covers every documented module kind", () => {
    expect(MINIMAL_MODULES.map((module) => module.kind)).toEqual([
      ...ARCHITECTURAL_KIT_MODULE_KINDS,
    ]);
  });

  it("builds every module with finite geometry and a material batch", () => {
    for (const definition of MINIMAL_MODULES) {
      const model = build(definition);

      expect(model.parts.length, definition.kind).toBeGreaterThan(0);
      expect(model.triangles, definition.kind).toBeGreaterThan(80);

      for (const part of model.parts) {
        const position = part.geometry.getAttribute("position");

        expect(position, definition.kind).toBeTruthy();
        expect(position.count).toBeGreaterThan(0);
        expect(position.count % 3).toBe(0);
        expect(part.geometry.boundingSphere, definition.kind).not.toBeNull();

        for (const value of Array.from(position.array as Float32Array)) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });

  it("generates deterministic geometry for the same authored variant", () => {
    const definition = MINIMAL_MODULES[0];

    if (!definition) {
      throw new Error("Fixture is missing.");
    }

    const first = build(definition);
    const second = build(definition);

    expect(architecturalModuleKey(definition)).toBe(architecturalModuleKey(definition));
    expect(second.key).toBe(first.key);
    expect(second.triangles).toBe(first.triangles);
    expect(second.parts.map((part) => part.material)).toEqual(
      first.parts.map((part) => part.material),
    );

    for (let index = 0; index < first.parts.length; index += 1) {
      const firstPart = first.parts[index];
      const secondPart = second.parts[index];

      if (!firstPart || !secondPart) {
        continue;
      }

      expect(secondPart.geometry.boundingSphere?.radius).toBeCloseTo(
        firstPart.geometry.boundingSphere?.radius ?? Number.NaN,
        5,
      );
    }
  });

  it("keeps module geometry local to the authored dimensions", () => {
    const model = build({ kind: "column", height: 4, width: 1 });

    for (const part of model.parts) {
      const box = part.geometry.boundingBox;

      expect(box).not.toBeNull();
      expect(box?.min.y).toBeGreaterThanOrEqual(-0.01);
      expect(box?.max.y).toBeLessThanOrEqual(4.2);
      expect(box?.min.x).toBeGreaterThanOrEqual(-1.6);
      expect(box?.max.x).toBeLessThanOrEqual(1.6);
    }
  });

  it("rejects invalid module data instead of emitting broken geometry", () => {
    expect(
      validateArchitecturalModuleDefinition({ kind: "column", height: 0, width: 0.9 }),
    ).not.toEqual([]);
    expect(() => build({ kind: "column", height: 0, width: 0.9 })).toThrow();
    expect(() => build({ kind: "column", height: Number.NaN, width: 0.9 })).toThrow();
    expect(() => build({ kind: "curtain-wall", width: 6, height: 4, columns: 2.5 })).toThrow();
  });

  it("resolves every kit material through the central MaterialLibrary", () => {
    const library = new MaterialLibrary();
    const used = new Set<MaterialKey>();

    for (const definition of MINIMAL_MODULES) {
      const model = build(definition);

      for (const part of model.parts) {
        const material = library.get(part.material);

        expect(material, part.material).toBeTruthy();
        used.add(part.material);
      }
    }

    // The kit must not build its own material universe: every batch maps onto a
    // semantic key of the shared library.
    expect(used.size).toBeGreaterThanOrEqual(6);
    expect(used.has("concrete")).toBe(true);
    expect(used.has("glass")).toBe(true);
    expect(used.has("aluminium")).toBe(true);
    expect(used.has("composite")).toBe(true);
    expect(used.has("dark-metal")).toBe(true);
    expect(used.has("red")).toBe(true);

    // Material hierarchy is carried by response, not only by hue.
    const aluminium = library.get("aluminium");
    const composite = library.get("composite");
    const reveal = library.get("reveal");

    expect(aluminium.metalness).toBeGreaterThan(0.8);
    expect(composite.roughness).toBeGreaterThan(0.4);
    expect(reveal.roughness).toBeGreaterThan(0.8);
    expect(aluminium.roughness).toBeLessThan(composite.roughness);

    library.dispose();
  });

  it("stays inside a sane triangle budget for a reusable kit", () => {
    let total = 0;

    for (const definition of MINIMAL_MODULES) {
      const model = build(definition);

      expect(model.triangles, definition.kind).toBeLessThan(12_000);
      total += model.triangles;
    }

    expect(total).toBeLessThan(26_000);
  });

  it("rejects non-positive authored dimensions for every kind", () => {
    for (const definition of MINIMAL_MODULES) {
      const probe = { ...definition } as unknown as Record<string, unknown>;

      for (const [key, value] of Object.entries(probe)) {
        if (typeof value === "number" && value > 0) {
          expect(
            validateArchitecturalModuleDefinition({
              ...definition,
              [key]: 0,
            } as ArchitecturalModuleDefinition).length,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
