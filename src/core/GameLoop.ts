/**
 * Fixed-timestep game loop.
 *
 * Physics always advances by `1 / physicsHz` seconds regardless of the rendering
 * frame rate. Rendering receives an interpolation alpha in the 0..1 range.
 *
 * See `docs/02_TECHNICAL_ARCHITECTURE.md` §7 for the timing contract.
 */

export interface GameLoopConfig {
  /** Fixed simulation frequency. 60 Hz is the initial default. */
  readonly physicsHz: number;

  /** Maximum wall-clock time a single frame may contribute, in seconds. */
  readonly maxFrameDeltaSeconds: number;

  /** Upper bound on fixed steps per rendered frame (catch-up protection). */
  readonly maxPhysicsStepsPerFrame: number;
}

export const DEFAULT_GAME_LOOP_CONFIG: GameLoopConfig = {
  physicsHz: 60,
  maxFrameDeltaSeconds: 0.1,
  maxPhysicsStepsPerFrame: 5,
};

/** Frame scheduling abstraction so the loop can be driven deterministically in tests. */
export interface FrameScheduler {
  requestFrame(callback: (timestampMs: number) => void): number;
  cancelFrame(handle: number): void;
}

export interface GameLoopCallbacks {
  /** Called at the start of every rendered frame, before fixed updates. */
  onFrameStart?(timestampMs: number): void;

  /** One fixed simulation step. */
  onFixedUpdate(fixedDeltaSeconds: number, stepIndex: number): void;

  /** Rendering, with interpolation alpha from the remaining accumulator. */
  onRender(alpha: number, frameDeltaSeconds: number): void;
}

export interface GameLoopStats {
  readonly frameCount: number;
  readonly physicsStepCount: number;
  readonly droppedTimeSeconds: number;
  readonly lastFrameDeltaSeconds: number;
}

const browserFrameScheduler: FrameScheduler = {
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
};

/** Avoids floating-point drift when the accumulator is extremely close to a full step. */
const STEP_EPSILON_SECONDS = 1e-9;

function validateConfig(config: GameLoopConfig): void {
  if (!Number.isFinite(config.physicsHz) || config.physicsHz <= 0 || config.physicsHz > 1000) {
    throw new RangeError(`Invalid physicsHz: ${config.physicsHz}. Expected a value in (0, 1000].`);
  }

  if (!Number.isFinite(config.maxFrameDeltaSeconds) || config.maxFrameDeltaSeconds <= 0) {
    throw new RangeError(
      `Invalid maxFrameDeltaSeconds: ${config.maxFrameDeltaSeconds}. Expected a positive value.`,
    );
  }

  if (
    !Number.isInteger(config.maxPhysicsStepsPerFrame) ||
    config.maxPhysicsStepsPerFrame < 1
  ) {
    throw new RangeError(
      `Invalid maxPhysicsStepsPerFrame: ${config.maxPhysicsStepsPerFrame}. Expected a positive integer.`,
    );
  }
}

export class GameLoop {
  private readonly config: GameLoopConfig;
  private readonly callbacks: GameLoopCallbacks;
  private readonly scheduler: FrameScheduler;
  private readonly fixedStepSeconds: number;

  private accumulatorSeconds = 0;
  private lastTimestampMs: number | null = null;
  private frameHandle: number | null = null;
  private running = false;

  private frameCount = 0;
  private physicsStepCount = 0;
  private droppedTimeSeconds = 0;
  private lastFrameDeltaSeconds = 0;

  constructor(
    config: GameLoopConfig,
    callbacks: GameLoopCallbacks,
    scheduler: FrameScheduler = browserFrameScheduler,
  ) {
    validateConfig(config);

    this.config = config;
    this.callbacks = callbacks;
    this.scheduler = scheduler;
    this.fixedStepSeconds = 1 / config.physicsHz;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get fixedDeltaSeconds(): number {
    return this.fixedStepSeconds;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.accumulatorSeconds = 0;
    this.lastTimestampMs = null;
    this.scheduleNextFrame();
  }

  stop(): void {
    if (!this.running && this.frameHandle === null) {
      return;
    }

    this.running = false;

    if (this.frameHandle !== null) {
      this.scheduler.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  getStats(): GameLoopStats {
    return {
      frameCount: this.frameCount,
      physicsStepCount: this.physicsStepCount,
      droppedTimeSeconds: this.droppedTimeSeconds,
      lastFrameDeltaSeconds: this.lastFrameDeltaSeconds,
    };
  }

  private scheduleNextFrame(): void {
    this.frameHandle = this.scheduler.requestFrame((timestampMs) => this.onFrame(timestampMs));
  }

  private onFrame(timestampMs: number): void {
    this.frameHandle = null;

    if (!this.running) {
      return;
    }

    const previousTimestampMs = this.lastTimestampMs;
    this.lastTimestampMs = timestampMs;

    const rawDeltaSeconds =
      previousTimestampMs === null ? 0 : Math.max(0, (timestampMs - previousTimestampMs) / 1000);
    const clampedDeltaSeconds = Math.min(rawDeltaSeconds, this.config.maxFrameDeltaSeconds);

    this.droppedTimeSeconds += rawDeltaSeconds - clampedDeltaSeconds;
    this.accumulatorSeconds += clampedDeltaSeconds;
    this.lastFrameDeltaSeconds = clampedDeltaSeconds;

    this.callbacks.onFrameStart?.(timestampMs);

    let steps = 0;

    while (
      this.accumulatorSeconds + STEP_EPSILON_SECONDS >= this.fixedStepSeconds &&
      steps < this.config.maxPhysicsStepsPerFrame
    ) {
      this.callbacks.onFixedUpdate(this.fixedStepSeconds, steps);
      this.accumulatorSeconds -= this.fixedStepSeconds;
      steps += 1;
      this.physicsStepCount += 1;
    }

    // Catch-up protection: if the step budget was exhausted, discard the excess
    // instead of simulating an ever-growing backlog.
    if (this.accumulatorSeconds >= this.fixedStepSeconds) {
      const droppedSeconds =
        this.accumulatorSeconds - (this.accumulatorSeconds % this.fixedStepSeconds);

      this.accumulatorSeconds %= this.fixedStepSeconds;
      this.droppedTimeSeconds += droppedSeconds;
    }

    const alpha = this.accumulatorSeconds / this.fixedStepSeconds;

    this.frameCount += 1;
    this.callbacks.onRender(alpha, clampedDeltaSeconds);

    this.scheduleNextFrame();
  }
}
