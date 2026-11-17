import { describe, expect, it } from "vitest";

import { TRAINING_EXERCISES } from "../../src/training/TrainingExercises";
import { TrainingSystem } from "../../src/training/TrainingSystem";

const START = 1000;

function createSystem(): TrainingSystem {
  return new TrainingSystem(TRAINING_EXERCISES, { clock: () => START });
}

function sample(position: { x: number; y: number; z: number }, speed = 0) {
  return { position, speed };
}

describe("TrainingSystem", () => {
  it("validates the authored ten-exercise set", () => {
    expect(TRAINING_EXERCISES).toHaveLength(10);
    expect(new Set(TRAINING_EXERCISES.map((exercise) => exercise.id)).size).toBe(10);
    expect(TRAINING_EXERCISES.every((exercise) => exercise.objectives.length > 0)).toBe(true);
  });

  it("evaluates all ten exercises from authoritative gameplay events and movement samples", () => {
    const system = createSystem();

    system.startSession("training-session-1");

    // Exercise 1: movement + reach rooftop.
    system.update(sample({ x: 0, y: 0.93, z: 5 }, 2), START);
    system.update(sample({ x: 0, y: 0.93, z: 5 }, 2), START + 600);
    system.update(sample({ x: 0, y: 0.93, z: 3 }), START + 700);

    // Exercise 2: running + approach.
    system.update(sample({ x: 0, y: 0.93, z: 2 }, 6), START + 800);
    system.update(sample({ x: 0, y: 0.93, z: 2 }, 6), START + 1700);
    system.update(sample({ x: 0, y: 0.93, z: 0 }), START + 1750);

    // Exercise 3: two jumps + stay ready.
    system.handleEvent({ type: "action", action: "jump", timestamp: START + 1700 });
    system.handleEvent({ type: "action", action: "jump", timestamp: START + 1800 });
    system.update(sample({ x: 0, y: 0.93, z: -0.2 }), START + 1900);

    // Exercise 4: vault + landing.
    system.handleEvent({ type: "action", action: "vault_started", timestamp: START + 2000 });
    system.update(sample({ x: 0, y: 0.93, z: -3 }), START + 2100);

    // Exercise 5: slide + tunnel exit.
    system.handleEvent({ type: "action", action: "slide_started", timestamp: START + 2200 });
    system.update(sample({ x: 0, y: 0.5, z: -10 }), START + 2300);

    // Exercise 6: wall run + corridor end.
    system.handleEvent({ type: "action", action: "wallrun_started", timestamp: START + 2400 });
    system.update(sample({ x: 0, y: 0.93, z: -14 }), START + 2500);

    // Exercise 7: wall jump + final platform.
    system.handleEvent({ type: "action", action: "walljumped", timestamp: START + 2600 });
    system.update(sample({ x: 0, y: 0.93, z: -16.5 }), START + 2700);

    // Exercise 8: two landings + momentum + approach.
    system.handleEvent({ type: "action", action: "landed", timestamp: START + 2800 });
    system.handleEvent({ type: "action", action: "landed", timestamp: START + 2900 });
    system.update(sample({ x: 0, y: 0.93, z: -17 }, 6), START + 3000);
    system.update(sample({ x: 0, y: 0.93, z: -17 }, 6), START + 3600);
    system.update(sample({ x: 0, y: 0.93, z: -18 }), START + 3700);

    // Exercise 9: terminal interaction.
    system.update(sample({ x: 2.5, y: 0.93, z: -18 }), START + 3800);
    system.handleEvent({
      type: "interaction",
      targetId: "test_terminal",
      timestamp: START + 3900,
    });

    // Exercise 10: combined final jump/landing/speed/finish zone.
    system.handleEvent({ type: "action", action: "jump", timestamp: START + 4000 });
    system.handleEvent({ type: "action", action: "landed", timestamp: START + 4100 });
    system.update(sample({ x: 0, y: 0.93, z: -18 }, 5), START + 4200);
    system.update(sample({ x: 0, y: 0.93, z: -18 }, 5), START + 4800);
    system.update(sample({ x: 0, y: 0.93, z: -18.5 }), START + 4900);

    const snapshot = system.getSnapshot();

    expect(snapshot.status).toBe("completed");
    expect(snapshot.completedExercises).toBe(10);
    expect(snapshot.result?.completed).toBe(true);
    expect(snapshot.result?.exercises).toHaveLength(10);
    expect(snapshot.result?.exercises.every((exercise) => exercise.completed)).toBe(true);
  });

  it("tracks objective progress and emits completion events", () => {
    const system = createSystem();
    const events: string[] = [];

    system.subscribe((event) => events.push(event.type));
    system.startSession("training-session-1");
    system.update(sample({ x: 0, y: 0.93, z: 5 }, 2), START);
    system.update(sample({ x: 0, y: 0.93, z: 5 }, 2), START + 600);

    expect(events).toContain("exercise:started");
    expect(events).toContain("objective:completed");

    const snapshot = system.getSnapshot();

    expect(snapshot.currentExercise?.status).toBe("active");
    expect(snapshot.exerciseIndex).toBe(0);
    expect(snapshot.currentObjective?.objectiveId).toBe("reach_rooftop");
  });

  it("restarts the current exercise and the whole session", () => {
    const system = createSystem();

    system.startSession("training-session-1");
    system.update(sample({ x: 0, y: 0.93, z: 5 }, 2), START);
    system.update(sample({ x: 0, y: 0.93, z: 5 }, 2), START + 600);
    system.update(sample({ x: 0, y: 0.93, z: 3 }), START + 700);

    expect(system.getSnapshot().exerciseIndex).toBe(1);

    system.restartCurrentExercise(START + 800);

    let snapshot = system.getSnapshot();

    expect(snapshot.exerciseIndex).toBe(1);
    expect(snapshot.currentExercise?.attempts).toBe(2);
    expect(snapshot.currentExercise?.currentObjectiveIndex).toBe(0);

    system.restartSession(START + 900);

    snapshot = system.getSnapshot();

    expect(snapshot.exerciseIndex).toBe(0);
    expect(snapshot.completedExercises).toBe(0);
    expect(snapshot.status).toBe("running");
  });

  it("supports abandonment", () => {
    const system = createSystem();

    system.startSession("training-session-1");
    system.abandon();

    expect(system.getStatus()).toBe("abandoned");
    expect(system.getSnapshot().result).toBeNull();
  });
});
