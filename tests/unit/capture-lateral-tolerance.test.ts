import { describe, expect, it } from "vitest";

import {
  isWithinLateralTolerance,
  lateralToleranceSelfCheck,
  MISSING_LATERAL_SENTINEL,
  maxLateralOffset,
} from "../../tools/capture/lib/route-math.mjs";

/**
 * Step 3.7 Scope C — the Step 3.6 gallery check used `(x ?? 9) < 1.0`, which
 * accepted any negative lateral deviation. These tests pin the corrected
 * symmetric predicate and prove that deviations on both sides are detected.
 */
describe("capture lateral tolerance", () => {
  it("accepts offsets inside the tolerance on both sides", () => {
    expect(isWithinLateralTolerance(0, 1)).toBe(true);
    expect(isWithinLateralTolerance(0.6, 1)).toBe(true);
    expect(isWithinLateralTolerance(-0.6, 1)).toBe(true);
    expect(isWithinLateralTolerance(0.99, 1)).toBe(true);
    expect(isWithinLateralTolerance(-0.99, 1)).toBe(true);
  });

  it("rejects offsets outside the tolerance on both sides", () => {
    expect(isWithinLateralTolerance(1.4, 1)).toBe(false);
    // The Step 3.6 predicate returned `true` here: `-1.4 < 1.0`.
    expect(isWithinLateralTolerance(-1.4, 1)).toBe(false);
    expect(isWithinLateralTolerance(-3.2, 1)).toBe(false);
    expect(isWithinLateralTolerance(8, 1)).toBe(false);
    expect(isWithinLateralTolerance(-8, 1)).toBe(false);
  });

  it("rejects the boundary, missing and non-finite samples", () => {
    expect(isWithinLateralTolerance(1, 1)).toBe(false);
    expect(isWithinLateralTolerance(-1, 1)).toBe(false);
    expect(isWithinLateralTolerance(null, 1)).toBe(false);
    expect(isWithinLateralTolerance(undefined, 1)).toBe(false);
    expect(isWithinLateralTolerance(Number.NaN, 1)).toBe(false);
  });

  it("reports the largest absolute deviation and never drops a missing pose", () => {
    expect(maxLateralOffset([0.2, -1.4, 0.3])).toBeCloseTo(1.4, 6);
    expect(maxLateralOffset([0.2, null, 0.3])).toBe(MISSING_LATERAL_SENTINEL);
    expect(maxLateralOffset([])).toBe(MISSING_LATERAL_SENTINEL);
  });

  it("self-check fails loudly if the one-sided comparison ever returns", () => {
    const result = lateralToleranceSelfCheck(1);

    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);

    const negativeOutside = result.cases.find((entry) => entry.x === -1.4);

    expect(negativeOutside, "self-check must include the negative-outside case").toBeDefined();
    expect(negativeOutside?.expected).toBe(false);
    expect(negativeOutside?.actual).toBe(false);
  });
});
