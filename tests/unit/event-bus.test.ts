import { describe, expect, it } from "vitest";

import { EventBus } from "../../src/core/EventBus";

interface TestEvents {
  [key: string]: unknown;

  ping: { value: number };
}

describe("EventBus", () => {
  it("delivers typed payloads to subscribers", () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];

    bus.on("ping", (payload) => received.push(payload.value));
    bus.emit("ping", { value: 42 });

    expect(received).toEqual([42]);
  });

  it("supports unsubscribe", () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    const unsubscribe = bus.on("ping", (payload) => received.push(payload.value));

    unsubscribe();
    bus.emit("ping", { value: 1 });

    expect(received).toEqual([]);
    expect(bus.listenerCount("ping")).toBe(0);
  });

  it("supports one-shot listeners", () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];

    bus.once("ping", (payload) => received.push(payload.value));
    bus.emit("ping", { value: 1 });
    bus.emit("ping", { value: 2 });

    expect(received).toEqual([1]);
    expect(bus.listenerCount()).toBe(0);
  });

  it("allows listeners to unsubscribe during dispatch", () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];

    const unsubscribe = bus.on("ping", (payload) => {
      received.push(payload.value);
      unsubscribe();
    });

    bus.emit("ping", { value: 1 });
    bus.emit("ping", { value: 2 });

    expect(received).toEqual([1]);
  });
});
