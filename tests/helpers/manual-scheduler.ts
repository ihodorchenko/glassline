import type { FrameScheduler } from "../../src/core/GameLoop";

/**
 * Deterministic frame scheduler for game-loop tests.
 * Frames run only when the test calls {@link ManualFrameScheduler.advanceTo}.
 */
export class ManualFrameScheduler implements FrameScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, (timestampMs: number) => void>();

  requestFrame(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);

    return handle;
  }

  cancelFrame(handle: number): void {
    this.callbacks.delete(handle);
  }

  get pendingFrameCount(): number {
    return this.callbacks.size;
  }

  advanceTo(timestampMs: number): void {
    const pending = [...this.callbacks.values()];

    this.callbacks.clear();

    for (const callback of pending) {
      callback(timestampMs);
    }
  }
}
