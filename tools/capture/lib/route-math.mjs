/**
 * Pure route-measurement predicates shared by the capture harnesses.
 *
 * Step 3.7 Scope C: the Step 3.6 gallery assertion used `(x ?? 9) < 1.0`, which
 * silently accepted a large negative lateral deviation. These helpers make the
 * tolerance symmetric and carry a self-check that proves both signs are
 * rejected outside the tolerance.
 */

/** Sentinel used when a pose was not captured; it can never satisfy a tolerance. */
export const MISSING_LATERAL_SENTINEL = 9;

/**
 * `true` only when a measured lateral offset is a finite number strictly inside
 * ±`tolerance`. Missing or non-finite samples always fail.
 *
 * @param {number | null | undefined} x
 * @param {number} tolerance
 * @returns {boolean}
 */
export function isWithinLateralTolerance(x, tolerance) {
  if (typeof x !== "number" || !Number.isFinite(x)) {
    return false;
  }

  return Math.abs(x) < tolerance;
}

/**
 * Largest absolute lateral offset in a set of poses. Missing samples become the
 * sentinel, so a missing pose is reported as an out-of-tolerance deviation
 * instead of being dropped.
 *
 * @param {readonly (number | null | undefined)[]} samples
 * @returns {number}
 */
export function maxLateralOffset(samples) {
  if (samples.length === 0) {
    return MISSING_LATERAL_SENTINEL;
  }

  return Math.max(
    ...samples.map((x) =>
      typeof x === "number" && Number.isFinite(x) ? Math.abs(x) : MISSING_LATERAL_SENTINEL,
    ),
  );
}

/**
 * Proves the symmetric tolerance detects deviations in both directions and
 * rejects missing samples. The old one-sided predicate passes `-1.4`, so this
 * check fails if the regression ever returns.
 *
 * @param {number} tolerance
 * @returns {{ passed: boolean, tolerance: number, cases: readonly {label: string, x: number | null, expected: boolean, actual: boolean}[], failures: readonly string[] }}
 */
export function lateralToleranceSelfCheck(tolerance = 1.0) {
  const cases = [
    { label: "centre", x: 0, expected: true },
    { label: "positive inside", x: 0.6, expected: true },
    { label: "negative inside", x: -0.6, expected: true },
    { label: "positive near edge", x: 0.99, expected: true },
    { label: "negative near edge", x: -0.99, expected: true },
    { label: "positive at edge", x: tolerance, expected: false },
    { label: "negative at edge", x: -tolerance, expected: false },
    { label: "positive outside", x: 1.4, expected: false },
    { label: "negative outside (Step 3.6 bug)", x: -1.4, expected: false },
    { label: "negative far outside", x: -3.2, expected: false },
    { label: "missing sample", x: null, expected: false },
  ].map((entry) => ({
    ...entry,
    actual: isWithinLateralTolerance(entry.x, tolerance),
  }));

  const failures = cases
    .filter((entry) => entry.actual !== entry.expected)
    .map(
      (entry) =>
        `${entry.label} x=${String(entry.x)}: expected ${entry.expected}, got ${entry.actual}`,
    );

  return { passed: failures.length === 0, tolerance, cases, failures };
}
