import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import {
  ARCHITECTURAL_KIT_MODULE_KINDS,
  type ArchitecturalModuleDefinition,
  validateArchitecturalModuleDefinition,
} from "../../src/levels/architecture/ArchitecturalKit";
import {
  KitGeometryPool,
  KitPartCollector,
  roundedRectShape,
} from "../../src/levels/architecture/KitGeometry";

const VALID_MODULES: readonly ArchitecturalModuleDefinition[] = [
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

const INVALID_CROSS_FIELD: readonly ArchitecturalModuleDefinition[] = [
  { kind: "facade-bay", width: 0.7, height: 4.2 },
  { kind: "facade-bay", width: 4.2, height: 4.2, revealDepth: 0.12 },
  { kind: "curtain-wall", width: 0.3, height: 4.2, columns: 3 },
  { kind: "curtain-wall", width: 6, height: 0.3, rows: 2 },
  { kind: "corner", width: 1.1, depth: 4.2, height: 9 },
  { kind: "corner", width: 4.2, depth: 1.1, height: 9 },
  { kind: "corner", width: 4.2, depth: 4.2, height: 3 },
  { kind: "cantilever", width: 8, depth: 0.2 },
  { kind: "cantilever", width: 0.2, depth: 3.2, railing: true },
  { kind: "canopy", width: 0.1, depth: 3.4 },
  { kind: "bridge", length: 0.5, width: 3.2, height: 3.4 },
  { kind: "bridge", length: 10, width: 0.4, height: 3.4 },
  { kind: "bridge", length: 10, width: 3.2, height: 0.2 },
  { kind: "bridge", length: 10, width: 3.2, height: 1.0 },
  { kind: "stair", width: 2.4, height: 4.2, run: 0.4 },
  { kind: "parapet", length: 6, height: 0.1 },
  { kind: "service-portal", width: 2.8, height: 1.0 },
  { kind: "service-portal", width: 0.2, height: 3 },
  { kind: "service-portal", width: 2.8, height: 3, depth: 0.05 },
  { kind: "ventilation", width: 2.8, height: 0.5 },
  { kind: "ventilation", width: 0.04, height: 2.4 },
  { kind: "ventilation", width: 2.8, height: 2.4, depth: 0.04 },
  { kind: "ventilation", width: 2.8, height: 2.4, blades: 100 },
  { kind: "louver", width: 5, height: 0.3 },
  { kind: "louver", width: 0.4, height: 4 },
  { kind: "louver", width: 5, height: 4, bladeCount: 100 },
  { kind: "glass-railing", length: 0.25 },
  { kind: "glass-railing", length: 4, height: 0.3 },
  { kind: "facade-screen", width: 5, height: 0.2 },
  { kind: "facade-screen", width: 0.2, height: 4.5 },
  { kind: "facade-screen", width: 5, height: 1.0, ribbons: 12 },
  { kind: "joint", width: 0.9, height: 0.1 },
];

describe("validateArchitecturalModuleDefinition", () => {
  it("accepts every documented kind with its canonical defaults", () => {
    expect(VALID_MODULES.map((module) => module.kind)).toEqual([...ARCHITECTURAL_KIT_MODULE_KINDS]);

    for (const definition of VALID_MODULES) {
      expect(validateArchitecturalModuleDefinition(definition), definition.kind).toEqual([]);
    }
  });

  it("rejects unknown parameters instead of silently ignoring typos", () => {
    const issues = validateArchitecturalModuleDefinition({
      kind: "column",
      height: 5.2,
      width: 0.9,
      heigth: 5.2,
    } as unknown as ArchitecturalModuleDefinition);

    expect(issues.some((issue) => issue.includes('unknown parameter "heigth"'))).toBe(true);
  });

  it("rejects boolean values in numeric parameters", () => {
    const issues = validateArchitecturalModuleDefinition({
      kind: "column",
      height: true,
      width: 0.9,
    } as unknown as ArchitecturalModuleDefinition);

    expect(
      issues.some((issue) => issue.includes('parameter "height" must be a finite number')),
    ).toBe(true);
  });

  it("rejects non-boolean values in boolean parameters", () => {
    const issues = validateArchitecturalModuleDefinition({
      kind: "curtain-wall",
      width: 6,
      height: 4.2,
      spandrel: 1,
    } as unknown as ArchitecturalModuleDefinition);

    expect(issues.some((issue) => issue.includes('parameter "spandrel" must be a boolean'))).toBe(
      true,
    );
  });

  it("rejects non-numeric strings in numeric parameters", () => {
    const issues = validateArchitecturalModuleDefinition({
      kind: "column",
      height: "5.2",
      width: 0.9,
    } as unknown as ArchitecturalModuleDefinition);

    expect(
      issues.some((issue) => issue.includes('parameter "height" must be a finite number')),
    ).toBe(true);
  });

  it("rejects every incompatible cross-field combination", () => {
    for (const definition of INVALID_CROSS_FIELD) {
      const issues = validateArchitecturalModuleDefinition(definition);

      expect(issues.length, JSON.stringify(definition)).toBeGreaterThan(0);
      expect(issues.some((issue) => issue.includes(`"${definition.kind}"`))).toBe(true);
    }
  });

  it("keeps integer counts integral", () => {
    const issues = validateArchitecturalModuleDefinition({
      kind: "curtain-wall",
      width: 6,
      height: 4.2,
      columns: 2.5,
    });

    expect(issues.some((issue) => issue.includes('parameter "columns" must be an integer'))).toBe(
      true,
    );
  });
});

describe("KitPartCollector positive-size guard and abort", () => {
  it("rejects zero, negative and non-finite box/cylinder/extrusion dimensions", () => {
    const pool = new KitGeometryPool();
    const collector = new KitPartCollector(pool);

    expect(() => collector.box([0, 1, 1], [0, 0, 0], "concrete")).toThrow();
    expect(() => collector.box([1, -1, 1], [0, 0, 0], "concrete")).toThrow();
    expect(() => collector.box([1, Number.NaN, 1], [0, 0, 0], "concrete")).toThrow();
    expect(() => collector.roundedBox([1, 1, 0], [0, 0, 0], "concrete")).toThrow();
    expect(() => collector.cylinder(0, 0.1, 1, [0, 0, 0], "aluminium")).toThrow();
    expect(() => collector.cylinder(0.1, 0.1, 0, [0, 0, 0], "aluminium")).toThrow();
    expect(() =>
      collector.extrusion(roundedRectShape(1, 1, 0.1), 0, [0, 0, 0], "concrete"),
    ).toThrow();
    expect(() =>
      collector.profileAlongX(
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        0,
        [0, 0, 0],
        "concrete",
      ),
    ).toThrow();

    collector.abort();
    pool.dispose();
  });

  it("disposes owned pending geometry once and is safe to call twice", () => {
    const pool = new KitGeometryPool();
    const collector = new KitPartCollector(pool);
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const owned = new THREE.BoxGeometry(1, 1, 1);

    collector.addOwned(owned, "concrete");
    collector.abort();

    const callsAfterFirstAbort = disposeSpy.mock.calls.length;

    expect(callsAfterFirstAbort).toBeGreaterThan(0);

    collector.abort();

    expect(disposeSpy.mock.calls.length).toBe(callsAfterFirstAbort);
    expect(collector.finish()).toEqual([]);

    disposeSpy.mockRestore();
    pool.dispose();
  });

  it("does not dispose a merged part that was already returned by finish", () => {
    const pool = new KitGeometryPool();
    const collector = new KitPartCollector(pool);
    const disposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");

    collector.box([1, 1, 1], [0, 0, 0], "concrete");

    const parts = collector.finish();
    const disposeCallsAfterFinish = disposeSpy.mock.calls.length;

    expect(parts).toHaveLength(1);

    collector.abort();

    expect(disposeSpy.mock.calls.length).toBe(disposeCallsAfterFinish);

    for (const part of parts) {
      part.geometry.dispose();
    }

    disposeSpy.mockRestore();
    pool.dispose();
  });
});
