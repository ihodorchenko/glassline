/** Authoritative run timing. Uses a monotonic clock, never frame deltas. */
export interface RunTimer {
  start(): void;
  stop(): number;
  reset(): void;
  getElapsedTime(): number;
  isRunning(): boolean;
}

export type Clock = () => number;

/**
 * Monotonic run timer (`docs/09` §4).
 *
 * Elapsed time is always derived from the injected monotonic clock; calling
 * `getElapsedTime` any number of times from the render loop cannot affect it.
 */
export class MonotonicRunTimer implements RunTimer {
  private readonly clock: Clock;
  private startedAtMs: number | null = null;
  private stoppedAtMs: number | null = null;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  start(): void {
    if (this.startedAtMs !== null) {
      throw new Error("Run timer is already running.");
    }

    this.startedAtMs = this.clock();
    this.stoppedAtMs = null;
  }

  stop(): number {
    if (this.startedAtMs === null || this.stoppedAtMs !== null) {
      throw new Error("Run timer is not running.");
    }

    this.stoppedAtMs = this.clock();

    return this.getElapsedTime();
  }

  reset(): void {
    this.startedAtMs = null;
    this.stoppedAtMs = null;
  }

  getElapsedTime(): number {
    if (this.startedAtMs === null) {
      return 0;
    }

    const endMs = this.stoppedAtMs ?? this.clock();

    return Math.max(0, endMs - this.startedAtMs);
  }

  isRunning(): boolean {
    return this.startedAtMs !== null && this.stoppedAtMs === null;
  }
}

export function formatRunTime(elapsedMs: number): string {
  const safeMs = Math.max(0, Math.floor(elapsedMs));
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const milliseconds = safeMs % 1000;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(
    milliseconds,
  ).padStart(3, "0")}`;
}
