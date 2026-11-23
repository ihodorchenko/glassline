import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOAST_DURATION_MS,
  MIN_REQUEUED_TOAST_DURATION_MS,
  ToastQueue,
  type ToastTransition,
} from "../../src/ui/ToastQueue";

/**
 * Step 3.8 F-05 — critical gameplay confirmations must outrank routine
 * tutorial/status toasts.
 *
 * The reproduced defect: on a fresh profile the checkpoint trigger and the
 * `Move` tutorial step complete in nearly the same frame. The FIFO queue showed
 * `Move` for its full 1.8 s and the checkpoint confirmation only afterwards.
 * These tests pin the ordering contract of the extracted queue.
 */

const CRITICAL = "critical" as const;
const NORMAL = "normal" as const;

function messageOf(transition: ToastTransition | null): string | null {
  return transition?.kind === "show" ? transition.toast.message : null;
}

describe("ToastQueue — priority ordering", () => {
  it("shows an idle toast immediately and keeps routine order FIFO", () => {
    const queue = new ToastQueue();
    let now = 1_000;

    expect(messageOf(queue.push({ message: "A", durationMs: 1_000, priority: NORMAL }, now))).toBe(
      "A",
    );
    expect(queue.push({ message: "B", durationMs: 1_000, priority: NORMAL }, now + 10)).toBeNull();

    // A still visible: nothing changes before its expiry.
    expect(queue.tick(now + 999)).toBeNull();
    now += 1_000;
    expect(messageOf(queue.tick(now))).toBe("B");
    now += 1_000;
    expect(queue.tick(now)).toEqual({ kind: "hide" });
    expect(queue.tick(now + 500)).toBeNull();
  });

  it("shows a checkpoint confirmation immediately when a tutorial toast is visible", () => {
    const queue = new ToastQueue();
    const start = 5_000;

    expect(
      messageOf(queue.push({ message: "Move", durationMs: 1_800, priority: NORMAL }, start)),
    ).toBe("Move");

    // The checkpoint fires 100 ms later, as in the reproduced fresh-profile run.
    const checkpoint = queue.push(
      {
        message: "Checkpoint reached: Starting Roof Checkpoint",
        durationMs: 2_200,
        priority: CRITICAL,
      },
      start + 100,
    );

    expect(messageOf(checkpoint)).toBe("Checkpoint reached: Starting Roof Checkpoint");
    expect(queue.getSnapshot().visible?.priority).toBe(CRITICAL);

    // The interrupted tutorial toast is next, with the time it had left
    // (1 800 − 100 = 1 700 ms), not restarted at 1 800 ms.
    expect(queue.getSnapshot().interrupted?.message).toBe("Move");

    // Checkpoint toast ends at start + 2 300; no premature switch.
    expect(queue.tick(start + 2_299)).toBeNull();
    const resumed = queue.tick(start + 2_300);

    expect(messageOf(resumed)).toBe("Move");
    // 100 ms were already shown, then 400 ms minimum is not needed: 1 700 left.
    expect(queue.tick(start + 3_999)).toBeNull();
    expect(queue.tick(start + 4_000)).toEqual({ kind: "hide" });
  });

  it("never lets a routine toast preempt a checkpoint confirmation", () => {
    const queue = new ToastQueue();

    expect(
      messageOf(
        queue.push({ message: "Checkpoint reached", durationMs: 2_200, priority: CRITICAL }, 0),
      ),
    ).toBe("Checkpoint reached");
    expect(queue.push({ message: "Slide", durationMs: 1_800, priority: NORMAL }, 50)).toBeNull();
    expect(queue.getSnapshot().visible?.message).toBe("Checkpoint reached");
    expect(queue.getSnapshot().pending.map((toast) => toast.message)).toEqual(["Slide"]);

    expect(messageOf(queue.tick(2_200))).toBe("Slide");
  });

  it("keeps critical messages in FIFO order with each other", () => {
    const queue = new ToastQueue();

    expect(
      messageOf(queue.push({ message: "cp 1", durationMs: 1_000, priority: CRITICAL }, 0)),
    ).toBe("cp 1");
    expect(queue.push({ message: "cp 2", durationMs: 1_000, priority: CRITICAL }, 10)).toBeNull();
    expect(messageOf(queue.tick(1_000))).toBe("cp 2");
  });

  it("re-queues an almost-finished routine toast with a readable minimum", () => {
    const queue = new ToastQueue();

    queue.push(
      { message: "Move", durationMs: MIN_REQUEUED_TOAST_DURATION_MS + 50, priority: NORMAL },
      0,
    );
    // 50 ms of the routine toast were shown; 400 ms are left when preempted.
    queue.push({ message: "Checkpoint reached", durationMs: 1_000, priority: CRITICAL }, 50);

    expect(queue.getSnapshot().interrupted?.message).toBe("Move");
    // The checkpoint toast was shown at t = 50 for 1 000 ms.
    expect(queue.tick(1_049)).toBeNull();

    const shownAt = 1_050;

    // 10 ms of the routine toast were left; the minimum keeps it readable.
    expect(messageOf(queue.tick(shownAt))).toBe("Move");
    expect(queue.tick(shownAt + MIN_REQUEUED_TOAST_DURATION_MS - 1)).toBeNull();
    expect(queue.tick(shownAt + MIN_REQUEUED_TOAST_DURATION_MS)).toEqual({ kind: "hide" });
  });

  it("caps the backlog at five messages, dropping routine toasts oldest-first", () => {
    const queue = new ToastQueue();

    queue.push({ message: "active", durationMs: 10_000, priority: NORMAL }, 0);

    for (let index = 1; index <= 7; index += 1) {
      queue.push({ message: `n${index}`, durationMs: 1_000, priority: NORMAL }, index);
    }

    expect(queue.getSnapshot().pending.map((toast) => toast.message)).toEqual([
      "n3",
      "n4",
      "n5",
      "n6",
      "n7",
    ]);
  });

  it("never drops a queued critical to make room for routine messages", () => {
    const queue = new ToastQueue(2);

    queue.push({ message: "active", durationMs: 10_000, priority: NORMAL }, 0);
    // The critical toast preempts the visible routine one.
    queue.push({ message: "cp", durationMs: 1_000, priority: CRITICAL }, 1);
    queue.push({ message: "n1", durationMs: 1_000, priority: NORMAL }, 2);
    queue.push({ message: "n2", durationMs: 1_000, priority: NORMAL }, 3);
    queue.push({ message: "n3", durationMs: 1_000, priority: NORMAL }, 4);

    expect(queue.getSnapshot().visible?.message).toBe("cp");
    expect(queue.getSnapshot().interrupted?.message).toBe("active");
    // The 2-slot backlog keeps the two newest routine messages.
    expect(queue.getSnapshot().pending.map((toast) => toast.message)).toEqual(["n2", "n3"]);
    // The interrupted routine toast is still shown before the backlog.
    expect(messageOf(queue.tick(1_001))).toBe("active");
  });

  it("falls back to a default duration for invalid input", () => {
    const queue = new ToastQueue();

    expect(
      messageOf(queue.push({ message: "x", durationMs: Number.NaN, priority: NORMAL }, 0)),
    ).toBe("x");
    expect(queue.tick(DEFAULT_TOAST_DURATION_MS - 1)).toBeNull();
    expect(queue.tick(DEFAULT_TOAST_DURATION_MS)).toEqual({ kind: "hide" });
  });

  it("clears the visible and queued messages on restart", () => {
    const queue = new ToastQueue();

    queue.push({ message: "Checkpoint reached", durationMs: 2_200, priority: CRITICAL }, 0);
    queue.push({ message: "Move", durationMs: 1_800, priority: NORMAL }, 10);

    expect(queue.clear()).toEqual({ kind: "hide" });
    expect(queue.getSnapshot()).toEqual({ visible: null, interrupted: null, pending: [] });
    expect(queue.clear()).toBeNull();
    expect(queue.tick(10_000)).toBeNull();
  });

  it("keeps a critical toast visible for its full duration even if routine ones pile up", () => {
    const queue = new ToastQueue();

    queue.push({ message: "Checkpoint reached", durationMs: 2_200, priority: CRITICAL }, 0);

    for (let index = 1; index <= 5; index += 1) {
      queue.push({ message: `step ${index}`, durationMs: 100, priority: NORMAL }, index * 10);
    }

    expect(messageOf(queue.tick(2_000))).toBeNull();
    expect(messageOf(queue.tick(2_200))).toBe("step 1");
  });
});

/**
 * Step 3.8.1 — several critical confirmations in one notification sequence.
 *
 * Corrective defect: when a second critical toast arrived while the first was
 * visible, `tick()` promoted the *interrupted routine* toast before the queued
 * critical one. On screen: `Move → CP1 → Move` (restored remainder) `→ CP2`,
 * i.e. a checkpoint confirmation was delayed behind a routine tutorial
 * reminder and two critical confirmations were not shown back to back.
 *
 * The driver below only uses the public transitions returned by `push`/`tick`
 * (what the HUD renders), not internal fields.
 */

interface TimelineEvent {
  readonly atMs: number;
  readonly message: string;
  readonly durationMs: number;
  readonly priority: "critical" | "normal";
}

interface VisibleSegment {
  readonly message: string;
  readonly startMs: number;
  readonly endMs: number;
}

interface OpenSegment {
  readonly message: string;
  readonly startMs: number;
}

function runToastTimeline(
  events: readonly TimelineEvent[],
  untilMs: number,
  stepMs = 1,
): VisibleSegment[] {
  const queue = new ToastQueue();
  const segments: VisibleSegment[] = [];
  const ordered = [...events].sort((left, right) => left.atMs - right.atMs);
  let open: OpenSegment | null = null;
  let eventIndex = 0;

  const closeOpen = (endMs: number): void => {
    const segment = open;

    if (segment === null) {
      return;
    }

    segments.push({ message: segment.message, startMs: segment.startMs, endMs });
    open = null;
  };

  const apply = (transition: ToastTransition | null, atMs: number): void => {
    if (transition === null) {
      return;
    }

    closeOpen(atMs);

    if (transition.kind === "show") {
      open = { message: transition.toast.message, startMs: atMs };
    }
  };

  for (let now = 0; now <= untilMs; now += stepMs) {
    while (eventIndex < ordered.length) {
      const event = ordered[eventIndex];

      if (event === undefined || event.atMs > now) {
        break;
      }

      eventIndex += 1;
      apply(
        queue.push(
          {
            message: event.message,
            durationMs: event.durationMs,
            priority: event.priority,
          },
          now,
        ),
        now,
      );
    }

    apply(queue.tick(now), now);
  }

  closeOpen(untilMs + stepMs);

  return segments;
}

function messagesOf(segments: readonly VisibleSegment[]): string[] {
  return segments.map((segment) => segment.message);
}

function segmentOf(
  segments: readonly VisibleSegment[],
  message: string,
  occurrence = 0,
): VisibleSegment {
  const matches = segments.filter((segment) => segment.message === message);
  const match = matches[occurrence];

  if (match === undefined) {
    throw new Error(`Missing toast segment "${message}" (#${occurrence})`);
  }

  return match;
}

describe("ToastQueue — several critical confirmations (Move → CP1 → CP2)", () => {
  const sequence: readonly TimelineEvent[] = [
    { atMs: 0, message: "Move", durationMs: 1_800, priority: "normal" },
    { atMs: 100, message: "CP1", durationMs: 2_200, priority: "critical" },
    { atMs: 200, message: "CP2", durationMs: 2_200, priority: "critical" },
  ];

  it("plays CP1 and CP2 back to back and restores the interrupted Move afterwards", () => {
    const segments = runToastTimeline(sequence, 7_000);

    expect(messagesOf(segments)).toEqual(["Move", "CP1", "CP2", "Move"]);
    expect(segments[0]).toEqual({ message: "Move", startMs: 0, endMs: 100 });
    // CP1 is shown at its event (Step 3.8 preemption) and is not replaced early.
    expect(segmentOf(segments, "CP1")).toEqual({ message: "CP1", startMs: 100, endMs: 2_300 });
    // CP2 follows CP1 immediately; Move must not slot in between.
    expect(segmentOf(segments, "CP2")).toEqual({ message: "CP2", startMs: 2_300, endMs: 4_500 });
    // Nothing is lost: the interrupted Move keeps the time it had left (1 700 ms).
    expect(segmentOf(segments, "Move", 1)).toEqual({
      message: "Move",
      startMs: 4_500,
      endMs: 6_200,
    });
  });

  it("never leaves a gap, duplicate or out-of-order critical between the messages", () => {
    const segments = runToastTimeline(sequence, 7_000);

    // Contiguous display: every segment ends exactly where the next begins.
    let previous: VisibleSegment | null = null;

    for (const segment of segments) {
      if (previous !== null) {
        expect(segment.startMs, `gap before ${segment.message}`).toBe(previous.endMs);
      }

      previous = segment;
    }

    const criticals = segments.filter((segment) => segment.message.startsWith("CP"));

    expect(criticals.map((segment) => segment.message)).toEqual(["CP1", "CP2"]);
    expect(segmentOf(segments, "CP2").startMs).toBe(segmentOf(segments, "CP1").endMs);
    expect(criticals.every((segment) => segment.endMs - segment.startMs === 2_200)).toBe(true);
  });

  it("keeps criticals contiguous when a routine toast is queued between them", () => {
    const segments = runToastTimeline(
      [
        { atMs: 0, message: "Move", durationMs: 1_800, priority: "normal" },
        { atMs: 100, message: "CP1", durationMs: 2_200, priority: "critical" },
        { atMs: 150, message: "Jump", durationMs: 1_800, priority: "normal" },
        { atMs: 200, message: "CP2", durationMs: 2_200, priority: "critical" },
      ],
      9_000,
    );

    expect(messagesOf(segments)).toEqual(["Move", "CP1", "CP2", "Move", "Jump"]);
    expect(segmentOf(segments, "CP2")).toEqual({ message: "CP2", startMs: 2_300, endMs: 4_500 });
    expect(segmentOf(segments, "Jump").startMs).toBe(segmentOf(segments, "Move", 1).endMs);
  });

  it("shows a single critical toast normally when no second one competes", () => {
    const segments = runToastTimeline(
      [
        { atMs: 0, message: "Move", durationMs: 1_800, priority: "normal" },
        { atMs: 100, message: "CP1", durationMs: 2_200, priority: "critical" },
      ],
      5_000,
    );

    expect(messagesOf(segments)).toEqual(["Move", "CP1", "Move"]);
    expect(segmentOf(segments, "CP1")).toEqual({ message: "CP1", startMs: 100, endMs: 2_300 });
    expect(segmentOf(segments, "Move", 1)).toEqual({
      message: "Move",
      startMs: 2_300,
      endMs: 4_000,
    });
  });
});
