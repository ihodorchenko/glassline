import { describe, expect, it } from "vitest";

import { createDomainEvent } from "../../src/events/DomainEvent";
import { INITIAL_TUTORIAL_STEPS } from "../../src/tutorial/InitialTutorial";
import { TutorialSystem } from "../../src/tutorial/TutorialSystem";
import type { PersistedTutorial } from "../../src/tutorial/TutorialTypes";

function fakePersistence() {
  let stored: PersistedTutorial | null = null;

  return {
    persistence: {
      load: async () => stored,
      save: async (data: PersistedTutorial) => {
        stored = data;
      },
    },
  };
}

describe("TutorialSystem", () => {
  it("tracks first-time tutorial steps and completion", () => {
    const system = new TutorialSystem({ steps: INITIAL_TUTORIAL_STEPS, clock: () => 1000 });
    const events: string[] = [];

    system.subscribe((event) => events.push(event.type));

    system.recordEvent(
      createDomainEvent("session", "session.started", {
        eventId: "s1",
        payload: { mode: "training" },
      }),
    );
    system.recordEvent(createDomainEvent("movement", "movement.started", { eventId: "m1" }));
    system.recordEvent(createDomainEvent("movement", "movement.jump", { eventId: "m2" }));
    system.recordEvent(createDomainEvent("movement", "movement.slide", { eventId: "m3" }));
    system.recordEvent(createDomainEvent("movement", "movement.vault", { eventId: "m4" }));
    system.recordEvent(createDomainEvent("movement", "movement.wall_run", { eventId: "m5" }));
    system.recordEvent(createDomainEvent("movement", "movement.wall_jump", { eventId: "m6" }));

    expect(system.getSnapshot().completed).toBe(false);

    system.recordEvent(
      createDomainEvent("interaction", "interaction.completed", { eventId: "i1" }),
    );

    const snapshot = system.getSnapshot();

    expect(snapshot.completed).toBe(true);
    expect(snapshot.completedSteps).toBe(INITIAL_TUTORIAL_STEPS.length);
    expect(snapshot.nextStep).toBeNull();
    expect(events).toContain("tutorial:completed");

    system.recordEvent(createDomainEvent("movement", "movement.jump", { eventId: "m7" }));
    expect(system.getSnapshot().completedSteps).toBe(INITIAL_TUTORIAL_STEPS.length);
  });

  it("persists and restores progress", async () => {
    const fake = fakePersistence();
    const first = new TutorialSystem({
      steps: INITIAL_TUTORIAL_STEPS,
      persistence: fake.persistence,
    });

    first.recordEvent(createDomainEvent("movement", "movement.started", { eventId: "m1" }));
    await first.flushPersistence();

    const restored = new TutorialSystem({
      steps: INITIAL_TUTORIAL_STEPS,
      persistence: fake.persistence,
    });

    await restored.initialize();

    expect(restored.getSnapshot().completedStepIds).toContain("move");
  });
});
