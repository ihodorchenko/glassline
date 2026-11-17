import { describe, expect, it, vi } from "vitest";

import type { MovementModelSnapshot } from "../../src/player/MovementModel";
import { PlayerStateSystem } from "../../src/player/PlayerStateSystem";

function movementSnapshot(overrides: Partial<MovementModelSnapshot> = {}): MovementModelSnapshot {
  return {
    state: "IDLE",
    stance: "standing",
    grounded: true,
    moving: false,
    speed: 0,
    verticalSpeed: 0,
    velocity: { x: 0, y: 0, z: 0 },
    canJump: true,
    landingRemainingSeconds: 0,
    landingIntensity: 0,
    ...overrides,
  };
}

describe("PlayerStateSystem", () => {
  it("starts in the initializing lifecycle without movement capabilities", () => {
    const system = new PlayerStateSystem();
    const snapshot = system.getSnapshot();

    expect(snapshot.lifecycle).toBe("initializing");
    expect(snapshot.capabilities.canMove).toBe(false);
    expect(snapshot.capabilities.canLook).toBe(false);
    expect(snapshot.capabilities.canPause).toBe(true);
    expect(snapshot.capabilities.canRestart).toBe(true);
  });

  it("derives movement capabilities from lifecycle and locomotion", () => {
    const system = new PlayerStateSystem();

    system.activate();
    system.updateFromMovement(movementSnapshot({ state: "RUNNING", moving: true }), 100);

    const capabilities = system.getSnapshot().capabilities;

    expect(capabilities.canMove).toBe(true);
    expect(capabilities.canLook).toBe(true);
    expect(capabilities.canJump).toBe(true);
    expect(capabilities.canSprint).toBe(true);
    expect(capabilities.canCrouch).toBe(true);
    expect(capabilities.canInteract).toBe(true);
    expect(capabilities.canSlide).toBe(false);
  });

  it("disables jump capability while airborne", () => {
    const system = new PlayerStateSystem();

    system.activate();
    system.updateFromMovement(
      movementSnapshot({ state: "FALLING", grounded: false, canJump: false }),
      100,
    );

    expect(system.getSnapshot().capabilities.canJump).toBe(false);
    expect(system.getSnapshot().capabilities.canSprint).toBe(false);
  });

  it("removes movement capabilities when disabled but keeps pause/restart", () => {
    const system = new PlayerStateSystem();

    system.activate();
    system.updateFromMovement(movementSnapshot(), 100);
    system.disable();

    const capabilities = system.getSnapshot().capabilities;

    expect(system.getSnapshot().lifecycle).toBe("disabled");
    expect(capabilities.canMove).toBe(false);
    expect(capabilities.canLook).toBe(false);
    expect(capabilities.canPause).toBe(true);
    expect(capabilities.canRestart).toBe(true);
  });

  it("respects control-state projections", () => {
    const system = new PlayerStateSystem();

    system.activate();
    system.updateFromMovement(movementSnapshot(), 100);
    system.setControlState({ movementInputEnabled: false });

    const snapshot = system.getSnapshot();

    expect(snapshot.capabilities.canMove).toBe(false);
    expect(snapshot.capabilities.canLook).toBe(true);
  });

  it("increments revision only when the effective snapshot changes", () => {
    const system = new PlayerStateSystem();

    system.activate();
    system.updateFromMovement(movementSnapshot(), 100);

    const revision = system.getSnapshot().revision;

    system.updateFromMovement(movementSnapshot(), 200);

    expect(system.getSnapshot().revision).toBe(revision);

    system.updateFromMovement(movementSnapshot({ state: "RUNNING", moving: true }), 300);

    expect(system.getSnapshot().revision).toBe(revision + 1);
  });

  it("notifies subscribers about effective state changes", () => {
    const system = new PlayerStateSystem();
    const listener = vi.fn();

    system.subscribe(listener);
    system.activate();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].lifecycle).toBe("active");
  });
});
