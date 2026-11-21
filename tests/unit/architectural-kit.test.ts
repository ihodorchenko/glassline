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
    expect(used.has("glass-near")).toBe(true);
    expect(used.has("glass")).toBe(false);
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

  it("keeps glass-near calibrated for close panes without retuning shared glass roles", () => {
    const library = new MaterialLibrary();
    const near = library.get("glass-near");
    const shared = library.get("glass");
    const far = library.get("glass-far");
    const rail = library.get("glass-rail");

    // ART_BRIEF §2 curtain glass: dark blue-graphite albedo, glossy but opaque.
    expect(near.color.getHexString()).toBe("1a2530");
    expect(near.roughness).toBeCloseTo(0.1, 5);
    expect(near.metalness).toBeCloseTo(0.6, 5);
    expect(near.envMapIntensity).toBeCloseTo(1.3, 5);
    expect(near.transparent).toBe(false);
    expect(near.depthWrite).toBe(true);

    // The distant-city and balustrade roles keep their previous calibration.
    expect(shared.color.getHexString()).toBe("0e1d2a");
    expect(shared.roughness).toBeCloseTo(0.13, 5);
    expect(shared.metalness).toBeCloseTo(0.6, 5);
    expect(shared.envMapIntensity).toBeCloseTo(0.5, 5);
    expect(shared.transparent).toBe(false);

    expect(far.color.getHexString()).toBe("0d1a26");
    expect(far.roughness).toBeCloseTo(0.2, 5);
    expect(far.metalness).toBeCloseTo(0.5, 5);
    expect(far.envMapIntensity).toBeCloseTo(0.35, 5);
    expect(far.transparent).toBe(false);

    expect(rail.roughness).toBeCloseTo(0.08, 5);
    expect(rail.metalness).toBeCloseTo(0.2, 5);
    expect(rail.envMapIntensity).toBeCloseTo(1.2, 5);
    expect(rail.transparent).toBe(true);
    expect(rail.depthWrite).toBe(false);
    expect(rail.opacity).toBeCloseTo(0.32, 5);

    // The near role reuses the existing sheen shader; only uniforms differ.
    expect(near.customProgramCacheKey()).toBe("glassline-glass-sheen");
    expect(near.customProgramCacheKey()).toBe(shared.customProgramCacheKey());

    library.dispose();
  });

  it("builds the spandrel as an opaque matte panel with its own material role", () => {
    const library = new MaterialLibrary();
    const spandrel = library.get("spandrel");
    const near = library.get("glass-near");
    const composite = library.get("composite");

    // Opaque by contract: no blending, no depth-write change, full opacity.
    expect(spandrel.transparent).toBe(false);
    expect(spandrel.depthWrite).toBe(true);
    expect(spandrel.opacity).toBe(1);

    // The difference from glass is carried by the response, not by hue alone:
    // 8.4x the roughness, essentially non-metallic, a fraction of the env
    // response and no view-dependent sheen term (the glass roles run one).
    expect(spandrel.roughness).toBeGreaterThan(near.roughness * 4);
    expect(spandrel.roughness).toBeGreaterThan(0.7);
    expect(spandrel.metalness).toBeLessThan(0.1);
    expect(spandrel.metalness).toBeLessThan(near.metalness / 10);
    expect(spandrel.envMapIntensity).toBeLessThan(near.envMapIntensity / 3);
    expect(spandrel.customProgramCacheKey()).not.toBe(near.customProgramCacheKey());
    expect(spandrel.color.getHexString()).not.toBe(near.color.getHexString());
    // Part of the neutral architectural envelope, not a coloured insert: the
    // matte panel replaces the pale composite the band used to share.
    expect(spandrel.color.getHexString()).toBe("767d80");
    expect(spandrel.color.getHexString()).not.toBe(composite.color.getHexString());

    // One semantic role shared by every placement; never per-instance.
    expect(library.get("spandrel")).toBe(spandrel);

    library.dispose();
  });

  it("keeps spandrel: false on the previous curtain-wall behaviour", () => {
    const model = build({ kind: "curtain-wall", width: 6, height: 4.2, columns: 3, rows: 1 });

    // Same batches, triangle count and glazing seat as before Step 2.3B: the
    // opaque zone must not leak into the glazed-only variant.
    expect(model.parts.map((part) => part.material)).toEqual([
      "glass-far",
      "aluminium",
      "glass-near",
    ]);
    expect(model.triangles).toBe(328);

    const glazing = model.parts.find((part) => part.material === "glass-near");

    expect(glazing?.geometry.boundingBox?.min.y).toBeCloseTo(0.1275, 3);
    expect(glazing?.geometry.boundingBox?.max.y).toBeCloseTo(4.0725, 3);
  });

  it("builds the spandrel as a framed matte field inside the storey band", () => {
    const model = build({
      kind: "curtain-wall",
      width: 6,
      height: 4.2,
      columns: 3,
      rows: 1,
      spandrel: true,
    });
    const panel = model.parts.find((part) => part.material === "spandrel");
    const box = panel?.geometry.boundingBox;

    // Exactly one opaque batch for the whole band: cassettes are merged per
    // material, and the dark frame/joints reuse the module's metal batch.
    expect(model.parts.filter((part) => part.material === "spandrel")).toHaveLength(1);
    expect(model.parts.map((part) => part.material).sort()).toEqual([
      "aluminium",
      "dark-metal",
      "glass-far",
      "glass-near",
      "spandrel",
    ]);
    // Five batches, exactly as many as the composite band used to occupy: no
    // extra draw call per placement.
    expect(model.parts).toHaveLength(5);
    // Glazing 328 + framed spandrel zone 84 triangles for the demo variant.
    expect(model.triangles).toBe(412);

    // The field stays inside the 0.48 m band, spans the usable width (with a
    // half joint gap at each jamb) and is recessed behind the glazing plane so
    // the frame reads in front of it.
    expect(box).not.toBeNull();
    expect(box?.min.y).toBeGreaterThanOrEqual(0.1);
    expect(box?.max.y).toBeLessThanOrEqual(0.58);
    expect(box?.min.x).toBeCloseTo(-2.888, 3);
    expect(box?.max.x).toBeCloseTo(2.888, 3);
    expect(box?.max.z).toBeLessThan(0.0375);
    expect(box?.min.z).toBeGreaterThan(-0.14);

    // The glazing keeps its exact geometry and only moves above the band.
    const glazing = model.parts.find((part) => part.material === "glass-near");
    const glazingBox = glazing?.geometry.boundingBox;

    expect(glazingBox?.min.y).toBeCloseTo(0.6075, 3);
    expect(glazingBox?.max.y).toBeCloseTo(4.0725, 3);
    expect(glazingBox?.min.x).toBeCloseTo(-2.872, 3);
    expect(glazingBox?.max.x).toBeCloseTo(2.872, 3);
  });

  it("builds finite, local and deterministic spandrel geometry", () => {
    const definition = {
      kind: "curtain-wall",
      width: 6,
      height: 4.2,
      columns: 3,
      rows: 1,
      spandrel: true,
    } as const;
    const first = build(definition);
    const second = build(definition);

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

      const box = firstPart.geometry.boundingBox;
      const position = firstPart.geometry.getAttribute("position");

      expect(position).toBeTruthy();

      for (const value of Array.from(position.array as Float32Array)) {
        expect(Number.isFinite(value)).toBe(true);
      }

      // Module-local metres: nothing escapes the authored 6 x 4.2 x 0.34 bay.
      expect(box?.min.x).toBeGreaterThanOrEqual(-3.01);
      expect(box?.max.x).toBeLessThanOrEqual(3.01);
      expect(box?.min.y).toBeGreaterThanOrEqual(-0.01);
      expect(box?.max.y).toBeLessThanOrEqual(4.21);
      expect(box?.min.z).toBeGreaterThanOrEqual(-0.16);
      expect(box?.max.z).toBeLessThanOrEqual(0.17);

      expect(secondPart.geometry.boundingSphere?.radius).toBeCloseTo(
        firstPart.geometry.boundingSphere?.radius ?? Number.NaN,
        5,
      );
    }
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
