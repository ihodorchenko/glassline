import { describe, expect, it } from "vitest";

import {
  DEFAULT_ACTION_BINDINGS,
  type GamepadButtonSnapshot,
  type GamepadSnapshot,
  type InputContext,
} from "../../src/input/InputActions";
import {
  InputActionResolver,
  InputFrameBuilder,
  type RawInputState,
} from "../../src/input/InputState";

function rawInput(overrides: Partial<RawInputState> = {}): RawInputState {
  return {
    context: "gameplay",
    heldKeys: new Set<string>(),
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    gamepad: null,
    ...overrides,
  };
}

function makeGamepad(
  axes: readonly number[],
  pressedIndices: readonly number[] = [],
): GamepadSnapshot {
  const buttons: GamepadButtonSnapshot[] = Array.from({ length: 16 }, (_unused, index) => ({
    pressed: pressedIndices.includes(index),
    value: pressedIndices.includes(index) ? 1 : 0,
  }));

  return { axes, buttons };
}

function resolve(raw: RawInputState) {
  return new InputActionResolver(DEFAULT_ACTION_BINDINGS).resolve(raw);
}

describe("InputActionResolver", () => {
  it("normalizes diagonal keyboard movement to unit length", () => {
    const resolved = resolve(rawInput({ heldKeys: new Set(["KeyW", "KeyD"]) }));

    expect(resolved.move.x).toBeCloseTo(Math.SQRT1_2, 5);
    expect(resolved.move.y).toBeCloseTo(Math.SQRT1_2, 5);
    expect(Math.hypot(resolved.move.x, resolved.move.y)).toBeCloseTo(1, 5);
  });

  it("disables gameplay actions outside gameplay contexts", () => {
    const resolved = resolve(
      rawInput({
        context: "main-menu",
        heldKeys: new Set(["KeyW", "Space", "ShiftLeft"]),
      }),
    );

    expect(resolved.move).toEqual({ x: 0, y: 0 });
    expect(resolved.actionValues.has("Jump")).toBe(false);
    expect(resolved.actionValues.has("Sprint")).toBe(false);
  });

  it("maps Sprint, Interact and Restart keys", () => {
    const resolved = resolve(rawInput({ heldKeys: new Set(["ShiftLeft", "KeyE", "KeyR"]) }));

    expect(resolved.actionValues.get("Sprint")).toBe(1);
    expect(resolved.actionValues.get("Interact")).toBe(1);
    expect(resolved.actionValues.get("Restart")).toBe(1);
  });

  it("maps Escape to Pause in gameplay and Cancel in menus", () => {
    const gameplay = resolve(rawInput({ heldKeys: new Set(["Escape"]) }));

    expect(gameplay.actionValues.get("Pause")).toBe(1);
    expect(gameplay.actionValues.has("Cancel")).toBe(false);

    const menu = resolve(rawInput({ context: "pause-menu", heldKeys: new Set(["Escape"]) }));

    expect(menu.actionValues.get("Cancel")).toBe(1);
    expect(menu.actionValues.has("Pause")).toBe(false);
  });

  it("maps Space and Enter to Confirm in menus without triggering Jump", () => {
    const menu = resolve(rawInput({ context: "main-menu", heldKeys: new Set(["Enter"]) }));

    expect(menu.actionValues.get("Confirm")).toBe(1);
    expect(menu.actionValues.has("Jump")).toBe(false);
    expect(menu.actionValues.has("Pause")).toBe(false);
  });

  it("reports mouse look deltas only in gameplay", () => {
    const gameplay = resolve(rawInput({ mouseDeltaX: 12, mouseDeltaY: -4 }));

    expect(gameplay.lookMouse).toEqual({ x: 12, y: -4 });

    const menu = resolve(rawInput({ context: "main-menu", mouseDeltaX: 12, mouseDeltaY: -4 }));

    expect(menu.lookMouse).toEqual({ x: 0, y: 0 });
  });

  it("applies gamepad dead zone and inverts stick Y for forward movement", () => {
    const insideDeadZone = resolve(rawInput({ gamepad: makeGamepad([0.1, -0.1, 0, 0]) }));

    expect(insideDeadZone.move).toEqual({ x: 0, y: 0 });

    const forward = resolve(rawInput({ gamepad: makeGamepad([0, -0.6, 0, 0]) }));

    expect(forward.move.y).toBeGreaterThan(0.4);
    expect(forward.move.x).toBeCloseTo(0, 6);
  });

  it("maps D-pad navigation in menu contexts", () => {
    const resolved = resolve(
      rawInput({ context: "main-menu", gamepad: makeGamepad([0, 0, 0, 0], [13]) }),
    );

    expect(resolved.navigate.y).toBe(-1);
  });

  it("maps gamepad A to Confirm in menus", () => {
    const resolved = resolve(
      rawInput({ context: "main-menu", gamepad: makeGamepad([0, 0, 0, 0], [0]) }),
    );

    expect(resolved.actionValues.get("Confirm")).toBe(1);
  });
});

describe("InputFrameBuilder", () => {
  it("emits pressed, held and released edges", () => {
    const builder = new InputFrameBuilder(DEFAULT_ACTION_BINDINGS);
    const pressed = builder.build(rawInput({ heldKeys: new Set(["Space"]) }), 0);

    expect(pressed.buttons.Jump.pressed).toBe(true);
    expect(pressed.buttons.Jump.held).toBe(true);

    const held = builder.build(rawInput({ heldKeys: new Set(["Space"]) }), 16);

    expect(held.buttons.Jump.pressed).toBe(false);
    expect(held.buttons.Jump.held).toBe(true);

    const released = builder.build(rawInput(), 32);

    expect(released.buttons.Jump.released).toBe(true);
    expect(released.buttons.Jump.held).toBe(false);
  });

  it("reset makes a held key press again", () => {
    const builder = new InputFrameBuilder(DEFAULT_ACTION_BINDINGS);

    builder.build(rawInput({ heldKeys: new Set(["Space"]) }), 0);
    builder.reset();

    const rebuilt = builder.build(rawInput({ heldKeys: new Set(["Space"]) }), 16);

    expect(rebuilt.buttons.Jump.pressed).toBe(true);
  });

  it("does not produce button edges for axis actions", () => {
    const builder = new InputFrameBuilder(DEFAULT_ACTION_BINDINGS);
    const frame = builder.build(rawInput({ heldKeys: new Set(["KeyW"]) }), 0);

    expect(frame.buttons.Look.pressed).toBe(false);
    expect(frame.buttons.Move.pressed).toBe(false);
    expect(frame.move.y).toBe(1);
  });

  it("carries the active context into the frame", () => {
    const builder = new InputFrameBuilder(DEFAULT_ACTION_BINDINGS);
    const context: InputContext = "settings";
    const frame = builder.build(rawInput({ context }), 0);

    expect(frame.context).toBe(context);
  });
});
