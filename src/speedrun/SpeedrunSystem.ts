import { type Clock, MonotonicRunTimer, type RunTimer } from "./RunTimer";
import type { SpeedrunRecordEntry } from "./SpeedrunRecords";

export type SpeedrunRunState =
  | "idle"
  | "preparing"
  | "ready"
  | "running"
  | "finished"
  | "invalidated"
  | "abandoned"
  | "failed";

export interface SpeedrunRouteSection {
  readonly id: string;
  readonly displayName: string;
  readonly checkpointId?: string;
}

/** Required checkpoint order for a route (`docs/09` §6.2). */
export interface SpeedrunRoute {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly sections: readonly SpeedrunRouteSection[];
  /** Checkpoint runtime ids in required order. */
  readonly checkpointOrder: readonly string[];
  readonly finishTriggerId: string;
  readonly medalThresholds: {
    readonly bronze: number;
    readonly silver: number;
    readonly gold: number;
  };
}

export interface SpeedrunSplit {
  readonly checkpointId: string;
  readonly sectionId: string;
  readonly index: number;
  readonly splitTimeMs: number;
  readonly totalTimeMs: number;
}

export interface SpeedrunValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export type SpeedrunMedal = "gold" | "silver" | "bronze" | "none";

export interface SpeedrunResult {
  readonly sessionId: string;
  readonly routeId: string;
  readonly routeVersion: number;
  readonly totalTimeMs: number;
  readonly splits: readonly SpeedrunSplit[];
  readonly checkpointsCompleted: number;
  readonly validation: SpeedrunValidationResult;
  readonly medal: SpeedrunMedal;
  readonly completedAt: number;
  readonly statisticsSummary?: Readonly<Record<string, number>>;
}

export interface SpeedrunSnapshot {
  readonly state: SpeedrunRunState;
  readonly sessionId: string | null;
  readonly routeId: string;
  readonly routeVersion: number;
  readonly elapsedTimeMs: number;
  readonly checkpointsCompleted: number;
  readonly requiredCheckpoints: number;
  readonly splits: readonly SpeedrunSplit[];
  readonly validationErrors: readonly string[];
  readonly result: SpeedrunResult | null;
}

export type SpeedrunEvent =
  | { readonly type: "run:prepared"; readonly sessionId: string }
  | { readonly type: "run:started"; readonly sessionId: string; readonly timestamp: number }
  | {
      readonly type: "run:checkpoint";
      readonly checkpointId: string;
      readonly split: SpeedrunSplit;
    }
  | { readonly type: "run:finished"; readonly result: SpeedrunResult }
  | { readonly type: "run:invalidated"; readonly errors: readonly string[] }
  | { readonly type: "run:abandoned"; readonly reason: string };

export type SpeedrunListener = (event: SpeedrunEvent) => void;

export interface SpeedrunSystemOptions {
  readonly route: SpeedrunRoute;
  readonly clock?: Clock;
  /** Wall-clock timestamp source for persisted record dates. */
  readonly wallClock?: () => number;
  readonly records?: {
    addRecord(entry: SpeedrunRecordEntry): boolean;
  } | null;
}

/**
 * Owns run state, the authoritative timer, checkpoint sequence validation, and
 * result construction for Prologue speedruns (`docs/09`).
 *
 * It does not detect checkpoint triggers, calculate medals from gameplay state,
 * or aggregate statistics.
 */
export class SpeedrunSystem {
  private readonly route: SpeedrunRoute;
  private readonly clock: Clock;
  private readonly wallClock: () => number;
  private readonly timer: RunTimer;
  private readonly records: SpeedrunSystemOptions["records"];
  private readonly listeners = new Set<SpeedrunListener>();

  private state: SpeedrunRunState = "idle";
  private sessionId: string | null = null;
  private splits: SpeedrunSplit[] = [];
  private validationErrors: string[] = [];
  private result: SpeedrunResult | null = null;
  private startedAtMs: number | null = null;
  private lastSplitTotalTimeMs = 0;

  constructor(options: SpeedrunSystemOptions) {
    this.route = options.route;
    this.clock = options.clock ?? (() => performance.now());
    this.wallClock = options.wallClock ?? (() => Date.now());
    this.records = options.records ?? null;
    this.timer = new MonotonicRunTimer(this.clock);
  }

  getRoute(): SpeedrunRoute {
    return this.route;
  }

  getState(): SpeedrunRunState {
    return this.state;
  }

  getResult(): SpeedrunResult | null {
    return this.result;
  }

  getElapsedTimeMs(): number {
    return this.timer.getElapsedTime();
  }

  getSnapshot(): SpeedrunSnapshot {
    return {
      state: this.state,
      sessionId: this.sessionId,
      routeId: this.route.id,
      routeVersion: this.route.version,
      elapsedTimeMs: this.timer.getElapsedTime(),
      checkpointsCompleted: this.splits.length,
      requiredCheckpoints: this.route.checkpointOrder.length,
      splits: [...this.splits],
      validationErrors: [...this.validationErrors],
      result: this.result,
    };
  }

  prepare(sessionId: string): void {
    if (this.state !== "idle") {
      throw new Error(`Cannot prepare a speedrun from state "${this.state}".`);
    }

    this.sessionId = sessionId;
    this.state = "preparing";
    this.state = "ready";
    this.emit({ type: "run:prepared", sessionId });
  }

  /** Starts timing. Called by the Gameplay Session when gameplay becomes active. */
  startRun(): void {
    if (this.state !== "ready") {
      throw new Error(`Cannot start a speedrun from state "${this.state}".`);
    }

    this.timer.reset();
    this.timer.start();
    this.startedAtMs = this.clock();
    this.lastSplitTotalTimeMs = 0;
    this.state = "running";
    this.emit({
      type: "run:started",
      sessionId: this.sessionId ?? "unknown",
      timestamp: this.startedAtMs,
    });
  }

  /**
   * Records an accepted checkpoint activation. Out-of-order or skipped
   * checkpoints invalidate the run (`docs/09` §6.3).
   */
  recordCheckpoint(checkpointId: string): SpeedrunSplit | null {
    if (this.state !== "running") {
      return null;
    }

    const expectedIndex = this.splits.length;
    const expectedCheckpointId = this.route.checkpointOrder[expectedIndex];

    if (checkpointId !== expectedCheckpointId) {
      if (this.route.checkpointOrder.includes(checkpointId)) {
        this.invalidate(
          `CHECKPOINT_ORDER_VIOLATION: expected "${expectedCheckpointId ?? "finish"}", received "${checkpointId}".`,
        );

        return null;
      }

      this.validationErrors.push(`UNKNOWN_CHECKPOINT: "${checkpointId}" is not part of the route.`);

      return null;
    }

    const section = this.route.sections.find(
      (candidate) => candidate.checkpointId === checkpointId,
    );
    const totalTimeMs = this.timer.getElapsedTime();
    const split: SpeedrunSplit = {
      checkpointId,
      sectionId: section?.id ?? "unknown",
      index: expectedIndex,
      splitTimeMs: Math.max(0, totalTimeMs - this.lastSplitTotalTimeMs),
      totalTimeMs,
    };

    this.lastSplitTotalTimeMs = totalTimeMs;
    this.splits.push(split);
    this.emit({ type: "run:checkpoint", checkpointId, split });

    return split;
  }

  /**
   * Accepts the finish signal, stops the timer, validates the run, and returns
   * the authoritative result.
   */
  finishRun(
    finishTriggerId: string,
    statisticsSummary?: Readonly<Record<string, number>>,
  ): SpeedrunResult {
    if (this.state !== "running") {
      throw new Error(`Cannot finish a speedrun from state "${this.state}".`);
    }

    if (finishTriggerId !== this.route.finishTriggerId) {
      this.validationErrors.push(`INVALID_FINISH_TRIGGER: "${finishTriggerId}".`);
    }

    const completedAt = this.wallClock();
    const totalTimeMs = this.timer.stop();
    const errors: string[] = [...this.validationErrors];

    if (this.splits.length !== this.route.checkpointOrder.length) {
      errors.push(
        `MISSING_CHECKPOINT: completed ${this.splits.length}/${this.route.checkpointOrder.length}.`,
      );
    }

    for (let index = 0; index < this.route.checkpointOrder.length; index += 1) {
      const expected = this.route.checkpointOrder[index];
      const actual = this.splits[index]?.checkpointId;

      if (expected !== actual) {
        errors.push(`CHECKPOINT_SEQUENCE: index ${index} expected "${expected ?? "none"}".`);
        break;
      }
    }

    if (totalTimeMs <= 0) {
      errors.push("INVALID_COMPLETION_TIME: elapsed time must be positive.");
    }

    if (this.splits.some((split) => split.totalTimeMs > totalTimeMs)) {
      errors.push("INVALID_SPLIT: split time exceeds run duration.");
    }

    const validation: SpeedrunValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };

    if (!validation.valid) {
      this.state = "invalidated";
      this.validationErrors = errors;
      this.emit({ type: "run:invalidated", errors });

      const invalidResult: SpeedrunResult = {
        sessionId: this.sessionId ?? "unknown",
        routeId: this.route.id,
        routeVersion: this.route.version,
        totalTimeMs,
        splits: [...this.splits],
        checkpointsCompleted: this.splits.length,
        validation,
        medal: "none",
        completedAt,
      };

      this.result = invalidResult;

      return invalidResult;
    }

    const result: SpeedrunResult = {
      sessionId: this.sessionId ?? "unknown",
      routeId: this.route.id,
      routeVersion: this.route.version,
      totalTimeMs,
      splits: [...this.splits],
      checkpointsCompleted: this.splits.length,
      validation,
      medal: calculateMedal(totalTimeMs, this.route.medalThresholds),
      completedAt,
      ...(statisticsSummary === undefined ? {} : { statisticsSummary }),
    };

    this.state = "finished";
    this.result = result;
    this.records?.addRecord({
      id: `${result.sessionId}:${result.completedAt}`,
      routeId: result.routeId,
      routeVersion: result.routeVersion,
      completionTimeMs: result.totalTimeMs,
      medal: result.medal,
      completedAt: result.completedAt,
      splits: result.splits.map((split) => ({
        checkpointId: split.checkpointId,
        sectionId: split.sectionId,
        index: split.index,
        splitTimeMs: split.splitTimeMs,
        totalTimeMs: split.totalTimeMs,
      })),
      validation: { valid: validation.valid, errors: [...validation.errors] },
      sessionId: result.sessionId,
    });
    this.emit({ type: "run:finished", result });

    return result;
  }

  abandon(reason: string): void {
    if (this.state === "running") {
      this.timer.stop();
    }

    this.state = "abandoned";
    this.emit({ type: "run:abandoned", reason });
  }

  fail(error: string): void {
    if (this.state === "running") {
      this.timer.stop();
    }

    this.validationErrors.push(`RUN_FAILED: ${error}`);
    this.state = "failed";
  }

  subscribe(listener: SpeedrunListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
    this.timer.reset();
  }

  private invalidate(error: string): void {
    this.validationErrors.push(error);
    this.state = "invalidated";
    this.emit({ type: "run:invalidated", errors: [...this.validationErrors] });
  }

  private emit(event: SpeedrunEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error("[Glassline] A speedrun listener failed.", error);
      }
    }
  }
}

export function calculateMedal(
  elapsedTimeMs: number,
  thresholds: SpeedrunRoute["medalThresholds"],
): SpeedrunMedal {
  if (elapsedTimeMs <= thresholds.gold) {
    return "gold";
  }

  if (elapsedTimeMs <= thresholds.silver) {
    return "silver";
  }

  if (elapsedTimeMs <= thresholds.bronze) {
    return "bronze";
  }

  return "none";
}
