/**
 * Priority-aware toast queue (Step 3.8 F-05).
 *
 * The HUD has a single toast slot. Before this module the slot was a plain FIFO:
 * a tutorial step completion ("Move") could hold the slot for its full 1.8 s
 * while a checkpoint confirmation waited behind it. That is the wrong order —
 * checkpoint feedback confirms progress the player just made and must not be
 * delayed by routine tutorial/status messages.
 *
 * The queue keeps the existing notification contract (one message at a time,
 * fixed durations, a bounded backlog) and adds exactly one rule:
 *
 *   - a `critical` message preempts a visible `normal` message immediately; the
 *     preempted message keeps its remaining duration and is shown once the
 *     queued critical confirmations are done, so routine feedback is delayed
 *     rather than lost;
 *   - queued `critical` messages are shown back to back, in arrival order,
 *     before any routine message (including the preempted one): a second
 *     checkpoint confirmation must not wait behind a tutorial reminder;
 *   - `normal` messages never preempt anything and queue behind the active one;
 *   - among equal priorities the order stays FIFO;
 *   - the backlog cap drops the oldest `normal` message first, and never drops a
 *     queued `critical` message while a normal one remains.
 *
 * The module is pure: it owns no DOM and no timers. `UIManager` renders the
 * returned transitions and calls {@link ToastQueue.tick} with the same clock it
 * already uses for the HUD.
 */

/** Message classes the HUD knows how to prioritize. */
export type ToastPriority = "critical" | "normal";

export interface ToastRequest {
  readonly message: string;
  readonly durationMs: number;
  readonly priority: ToastPriority;
}

/** The currently visible toast (what the HUD renders). */
export interface VisibleToast {
  readonly message: string;
  readonly priority: ToastPriority;
}

export type ToastTransition =
  | { readonly kind: "show"; readonly toast: VisibleToast }
  | { readonly kind: "hide" };

export interface ToastQueueSnapshot {
  readonly visible: VisibleToast | null;
  /**
   * The routine message that was interrupted by a critical one. It is shown
   * after every queued critical message.
   */
  readonly interrupted: VisibleToast | null;
  /**
   * Pending messages in arrival order. Queued critical messages are consumed
   * first, in order; routine messages keep their relative order after them.
   */
  readonly pending: readonly VisibleToast[];
}

/** Default on-screen duration, matching the pre-existing `showToast` default. */
export const DEFAULT_TOAST_DURATION_MS = 2200;
/**
 * A preempted message keeps its remaining time, but never less than this, so an
 * almost-finished routine toast cannot flash for a single indistinguishable
 * frame before disappearing.
 */
export const MIN_REQUEUED_TOAST_DURATION_MS = 400;
/** Backlog cap; the pre-existing queue capped at five pending messages. */
export const DEFAULT_TOAST_QUEUE_LIMIT = 5;

interface ActiveToast extends ToastRequest {
  readonly expiresAtMs: number;
}

function normalizeDuration(durationMs: number): number {
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : DEFAULT_TOAST_DURATION_MS;
}

function visibleOf(toast: ToastRequest): VisibleToast {
  return { message: toast.message, priority: toast.priority };
}

export class ToastQueue {
  private readonly limit: number;
  private active: ActiveToast | null = null;
  /**
   * A single routine message displaced by a critical one. It is shown after any
   * queued critical confirmation, never before one.
   */
  private interrupted: ToastRequest | null = null;
  private pending: ToastRequest[] = [];

  constructor(limit = DEFAULT_TOAST_QUEUE_LIMIT) {
    this.limit = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_TOAST_QUEUE_LIMIT;
  }

  /**
   * Requests a toast. Returns the transition the HUD must render now, or null
   * when the visible message does not change.
   */
  push(request: ToastRequest, nowMs: number): ToastTransition | null {
    if (!Number.isFinite(nowMs)) {
      return null;
    }

    const toast: ToastRequest = {
      message: request.message,
      durationMs: normalizeDuration(request.durationMs),
      priority: request.priority,
    };

    if (this.active === null) {
      return this.display(toast, nowMs);
    }

    if (toast.priority === "critical" && this.active.priority === "normal") {
      this.interrupted = {
        message: this.active.message,
        durationMs: Math.max(MIN_REQUEUED_TOAST_DURATION_MS, this.active.expiresAtMs - nowMs),
        priority: this.active.priority,
      };

      return this.display(toast, nowMs);
    }

    this.pending.push(toast);
    this.trim();

    return null;
  }

  /**
   * Advances time: expires the visible toast and promotes the next message.
   *
   * Order of promotion: queued `critical` messages first (arrival order), then
   * the interrupted routine toast, then the remaining backlog. This keeps a
   * sequence of checkpoint confirmations contiguous even when the first one
   * displaced a tutorial toast (Step 3.8.1).
   *
   * Returns the transition to render, or null while the current toast is still
   * within its duration and when nothing is visible.
   */
  tick(nowMs: number): ToastTransition | null {
    if (this.active === null || !Number.isFinite(nowMs)) {
      return null;
    }

    if (nowMs < this.active.expiresAtMs) {
      return null;
    }

    this.active = null;

    // A queued confirmation must not wait behind the routine toast that an
    // earlier confirmation displaced: that produced `Move → CP1 → Move → CP2`.
    const criticalIndex = this.pending.findIndex((toast) => toast.priority === "critical");
    const critical = criticalIndex === -1 ? undefined : this.pending[criticalIndex];

    if (critical !== undefined) {
      this.pending.splice(criticalIndex, 1);

      return this.display(critical, nowMs);
    }

    if (this.interrupted !== null) {
      const next = this.interrupted;

      this.interrupted = null;

      return this.display(next, nowMs);
    }

    const next = this.pending.shift();

    return next === undefined ? { kind: "hide" } : this.display(next, nowMs);
  }

  /** Drops the visible toast and every pending message (restart/menu). */
  clear(): ToastTransition | null {
    const wasVisible = this.active !== null;

    this.active = null;
    this.interrupted = null;
    this.pending = [];

    return wasVisible ? { kind: "hide" } : null;
  }

  getSnapshot(): ToastQueueSnapshot {
    return {
      visible: this.active === null ? null : visibleOf(this.active),
      interrupted: this.interrupted === null ? null : visibleOf(this.interrupted),
      pending: this.pending.map(visibleOf),
    };
  }

  private display(toast: ToastRequest, nowMs: number): ToastTransition {
    this.active = { ...toast, expiresAtMs: nowMs + toast.durationMs };

    return { kind: "show", toast: visibleOf(toast) };
  }

  /**
   * Enforces the backlog cap. Routine messages are dropped oldest-first; a
   * queued critical message is only dropped when the backlog is entirely
   * critical (the queue must stay bounded even if a future level emits a burst
   * of confirmations).
   */
  private trim(): void {
    while (this.pending.length > this.limit) {
      const routineIndex = this.pending.findIndex((toast) => toast.priority === "normal");
      this.pending.splice(routineIndex === -1 ? 0 : routineIndex, 1);
    }
  }
}
