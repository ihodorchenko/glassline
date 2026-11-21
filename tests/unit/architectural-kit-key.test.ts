import { describe, expect, it } from "vitest";

import {
  type ArchitecturalModuleDefinition,
  architecturalModuleKey,
  architecturalModuleSignature,
} from "../../src/levels/architecture/ArchitecturalKit";

function column(height: number): ArchitecturalModuleDefinition {
  return { kind: "column", height, width: 0.9 };
}

describe("architecturalModuleKey", () => {
  it("is deterministic and independent of authored property order", () => {
    const first = { kind: "facade-bay", width: 4.2, height: 4.2 } as const;
    const second = { height: 4.2, width: 4.2, kind: "facade-bay" } as const;

    expect(architecturalModuleKey(first)).toBe(architecturalModuleKey(second));
    expect(architecturalModuleKey(first)).toBe(architecturalModuleKey(first));
    expect(architecturalModuleSignature(first)).toBe(architecturalModuleSignature(second));
  });

  it("canonicalizes omitted optional fields to their documented defaults", () => {
    const omitted: ArchitecturalModuleDefinition = {
      kind: "facade-bay",
      width: 4.2,
      height: 4.2,
    };
    const explicitDefaults: ArchitecturalModuleDefinition = {
      kind: "facade-bay",
      width: 4.2,
      height: 4.2,
      revealDepth: 0.7,
      accent: true,
    };

    expect(architecturalModuleKey(omitted)).toBe(architecturalModuleKey(explicitDefaults));
    expect(architecturalModuleSignature(omitted)).toBe(
      architecturalModuleSignature(explicitDefaults),
    );
  });

  it("canonicalizes boolean defaults without hiding an explicit false", () => {
    const omitted = { kind: "curtain-wall", width: 6, height: 4.2 } as const;
    const explicitFalse = {
      kind: "curtain-wall",
      width: 6,
      height: 4.2,
      spandrel: false,
    } as const;
    const explicitTrue = {
      kind: "curtain-wall",
      width: 6,
      height: 4.2,
      spandrel: true,
    } as const;

    expect(architecturalModuleKey(omitted)).toBe(architecturalModuleKey(explicitFalse));
    expect(architecturalModuleKey(omitted)).not.toBe(architecturalModuleKey(explicitTrue));
  });

  it("canonicalizes the derived stair step count", () => {
    const omitted = { kind: "stair", width: 2.4, height: 4.2, run: 4.8 } as const;
    const explicit = {
      kind: "stair",
      width: 2.4,
      height: 4.2,
      run: 4.8,
      steps: 25,
    } as const;

    expect(architecturalModuleKey(omitted)).toBe(architecturalModuleKey(explicit));
    expect(architecturalModuleSignature(omitted)).toBe(architecturalModuleSignature(explicit));
  });

  it("normalizes floating-point noise below the signature precision", () => {
    const exact = column(5.2);
    const noisy = column(5.199999999);

    expect(architecturalModuleKey(exact)).toBe(architecturalModuleKey(noisy));
    expect(architecturalModuleSignature(exact)).toBe(architecturalModuleSignature(noisy));
  });

  it("keeps sub-millimetre authored differences detectable by the signature", () => {
    const base = column(5.2);
    const slightlyDifferent = column(5.2004);

    // The 1 mm pooling key intentionally groups both variants...
    expect(architecturalModuleKey(base)).toBe(architecturalModuleKey(slightlyDifferent));
    // ...but the full-definition signature used by the loader collision guard
    // still distinguishes them, so they can never silently share geometry.
    expect(architecturalModuleSignature(base)).not.toBe(
      architecturalModuleSignature(slightlyDifferent),
    );
  });

  it("never matches different kinds, booleans or integer parameters", () => {
    const asColumn = { kind: "column", height: 5.2, width: 0.9 } as const;
    const asJoint = { kind: "joint", width: 5.2, height: 5.2, depth: 0.9 } as const;
    const accentOn = { kind: "column", height: 5.2, width: 0.9, accent: true } as const;
    const accentOff = { kind: "column", height: 5.2, width: 0.9, accent: false } as const;
    const rowsOne = { kind: "curtain-wall", width: 6, height: 4.2, rows: 1 } as const;
    const rowsTwo = { kind: "curtain-wall", width: 6, height: 4.2, rows: 2 } as const;

    expect(architecturalModuleKey(asColumn)).not.toBe(architecturalModuleKey(asJoint));
    expect(architecturalModuleKey(accentOn)).not.toBe(architecturalModuleKey(accentOff));
    expect(architecturalModuleKey(rowsOne)).not.toBe(architecturalModuleKey(rowsTwo));
  });

  it("starts with the authored kind so collisions across kinds are impossible", () => {
    expect(architecturalModuleKey(column(5.2)).startsWith("column|")).toBe(true);
    expect(architecturalModuleSignature(column(5.2)).startsWith("column|")).toBe(true);
  });
});
