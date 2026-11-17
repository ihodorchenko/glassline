import { describe, expect, it, vi } from "vitest";

import {
  InteractionSystem,
  type InteractionTargetDefinition,
} from "../../src/interaction/InteractionSystem";

const EYE = { x: 0, y: 1.6, z: 0 };
const LOOK_FORWARD = { x: 0, y: 0, z: -1 };

function target(overrides: Partial<InteractionTargetDefinition> = {}): InteractionTargetDefinition {
  return {
    id: "terminal",
    position: { x: 0, y: 1.2, z: -2 },
    radius: 3,
    prompt: "Press E to access the terminal",
    enabled: true,
    ...overrides,
  };
}

describe("InteractionSystem", () => {
  it("selects the nearest validated target in range and facing the view", () => {
    const system = new InteractionSystem([
      target({ id: "far", position: { x: 0, y: 1.2, z: -2.5 } }),
      target({ id: "near", position: { x: 0, y: 1.2, z: -1.5 } }),
    ]);

    const snapshot = system.update(EYE, LOOK_FORWARD, 0);

    expect(snapshot).toEqual({
      available: true,
      targetId: "near",
      prompt: "Press E to access the terminal",
    });
  });

  it("does not offer targets that are out of range or behind the player", () => {
    const distant = new InteractionSystem([target({ position: { x: 0, y: 1.2, z: -10 } })]);

    distant.update(EYE, LOOK_FORWARD, 0);
    expect(distant.getSnapshot().available).toBe(false);

    const behind = new InteractionSystem([target({ position: { x: 0, y: 1.2, z: 2 } })]);

    behind.update(EYE, LOOK_FORWARD, 0);
    expect(behind.getSnapshot().available).toBe(false);
  });

  it("respects disabled targets and line-of-sight validation", () => {
    const disabled = new InteractionSystem([target({ enabled: false })]);

    disabled.update(EYE, LOOK_FORWARD, 0);
    expect(disabled.getSnapshot().available).toBe(false);

    const occluded = new InteractionSystem([target()], {
      lineOfSight: () => false,
    });

    occluded.update(EYE, LOOK_FORWARD, 0);
    expect(occluded.getSnapshot().available).toBe(false);
  });

  it("executes only the validated available interaction", () => {
    const system = new InteractionSystem([target()]);
    const listener = vi.fn();

    system.subscribe(listener);

    expect(system.tryInteract(true, 0)).toEqual({ executed: false, reason: "no-target" });

    system.update(EYE, LOOK_FORWARD, 100);

    const result = system.tryInteract(true, 100);

    expect(result).toEqual({ executed: true, targetId: "terminal" });
    expect(listener).toHaveBeenCalledWith("terminal");
    expect(system.tryInteract(false, 200)).toEqual({ executed: false, reason: "not-pressed" });
  });

  it("enforces the interaction cooldown", () => {
    const system = new InteractionSystem([target()], { cooldownSeconds: 0.5 });

    system.update(EYE, LOOK_FORWARD, 0);
    expect(system.tryInteract(true, 1000).executed).toBe(true);

    system.update(EYE, LOOK_FORWARD, 1100);
    expect(system.tryInteract(true, 1100)).toEqual({ executed: false, reason: "cooldown" });

    system.update(EYE, LOOK_FORWARD, 1600);
    expect(system.tryInteract(true, 1600).executed).toBe(true);
  });

  it("supports disabling a target at runtime", () => {
    const system = new InteractionSystem([target()]);

    system.setTargetEnabled("terminal", false);
    system.update(EYE, LOOK_FORWARD, 0);

    expect(system.getSnapshot().available).toBe(false);
  });
});
