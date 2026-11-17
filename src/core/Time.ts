/** Monotonic millisecond clock used for diagnostics and non-gameplay timing. */
export interface TimeSource {
  now(): number;
}

export const monotonicTime: TimeSource = {
  now: () => performance.now(),
};

/**
 * Measures a synchronous operation with the provided clock.
 * Used for startup diagnostics, never for gameplay timing.
 */
export function measure<T>(time: TimeSource, operation: () => T): { result: T; durationMs: number } {
  const startedAt = time.now();
  const result = operation();

  return { result, durationMs: time.now() - startedAt };
}
