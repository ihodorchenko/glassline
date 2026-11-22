export declare const MISSING_LATERAL_SENTINEL: number;

export declare function isWithinLateralTolerance(
  x: number | null | undefined,
  tolerance: number,
): boolean;

export declare function maxLateralOffset(samples: readonly (number | null | undefined)[]): number;

export interface LateralToleranceCase {
  readonly label: string;
  readonly x: number | null;
  readonly expected: boolean;
  readonly actual: boolean;
}

export interface LateralToleranceSelfCheck {
  readonly passed: boolean;
  readonly tolerance: number;
  readonly cases: readonly LateralToleranceCase[];
  readonly failures: readonly string[];
}

export declare function lateralToleranceSelfCheck(tolerance?: number): LateralToleranceSelfCheck;
