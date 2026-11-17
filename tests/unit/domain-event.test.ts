import { describe, expect, it } from "vitest";

import { createDomainEvent, readPayloadNumber } from "../../src/events/DomainEvent";

describe("DomainEvent", () => {
  it("creates unique event identities that do not restart across sessions", () => {
    const first = createDomainEvent("movement", "movement.jump");
    const second = createDomainEvent("movement", "movement.jump");

    expect(first.eventId).not.toBe(second.eventId);
    expect(first.eventId).toContain("movement:movement.jump:");
    expect(first.eventId.length).toBeGreaterThan("movement:movement.jump:".length);
  });

  it("keeps explicit event ids for deterministic replay and deduplication", () => {
    const first = createDomainEvent("training", "training.exercise_completed", {
      eventId: "stable-event",
      payload: { exerciseId: "ex_01" },
    });
    const second = createDomainEvent("training", "training.exercise_completed", {
      eventId: "stable-event",
      payload: { exerciseId: "ex_01" },
    });

    expect(first.eventId).toBe("stable-event");
    expect(second.eventId).toBe(first.eventId);
    expect(readPayloadNumber(first, "value")).toBeNull();
  });
});
