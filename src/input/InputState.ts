import { applyRadialDeadZone, clampVector2Magnitude, type Vector2Like } from "../shared/math";
import {
  DEFAULT_ACTION_BINDINGS,
  INPUT_ACTIONS,
  INPUT_ACTION_KINDS,
  isActionEnabledInContext,
  type ActionBindings,
  type GamepadBindings,
  type GamepadButtonGroup,
  type GamepadSnapshot,
  type InputAction,
  type InputContext,
  type KeyboardBindingGroup,
} from "./InputActions";

const ZERO_VECTOR: Vector2Like = { x: 0, y: 0 };

export interface ButtonState {
  readonly pressed: boolean;
  readonly held: boolean;
  readonly released: boolean;
  readonly value: number;
}

export const IDLE_BUTTON_STATE: ButtonState = {
  pressed: false,
  held: false,
  released: false,
  value: 0,
};

/** Immutable raw device state sampled once per rendered frame. */
export interface RawInputState {
  readonly context: InputContext;
  readonly heldKeys: ReadonlySet<string>;
  readonly mouseDeltaX: number;
  readonly mouseDeltaY: number;
  readonly gamepad: GamepadSnapshot | null;
}

/** Resolved action/axis values before button-transition tracking. */
export interface ResolvedActions {
  readonly move: Vector2Like;
  readonly navigate: Vector2Like;
  readonly lookMouse: Vector2Like;
  readonly lookGamepad: Vector2Like;
  readonly actionValues: ReadonlyMap<InputAction, number>;
}

/** Stable input snapshot consumed by one rendered frame. */
export interface InputFrame {
  readonly timestampMs: number;
  readonly context: InputContext;
  readonly move: Vector2Like;
  readonly navigate: Vector2Like;
  readonly lookMouse: Vector2Like;
  readonly lookGamepad: Vector2Like;
  readonly buttons: Readonly<Record<InputAction, ButtonState>>;
}

function createIdleButtons(): Record<InputAction, ButtonState> {
  const buttons = {} as Record<InputAction, ButtonState>;

  for (const action of INPUT_ACTIONS) {
    buttons[action] = IDLE_BUTTON_STATE;
  }

  return buttons;
}

export const IDLE_INPUT_FRAME: InputFrame = {
  timestampMs: 0,
  context: "gameplay",
  move: ZERO_VECTOR,
  navigate: ZERO_VECTOR,
  lookMouse: ZERO_VECTOR,
  lookGamepad: ZERO_VECTOR,
  buttons: createIdleButtons(),
};

export function isActionPressed(frame: InputFrame, action: InputAction): boolean {
  return frame.buttons[action].pressed;
}

export function isActionHeld(frame: InputFrame, action: InputAction): boolean {
  return frame.buttons[action].held;
}

interface ButtonRoute {
  readonly action: InputAction;
  readonly keyboard: KeyboardBindingGroup;
  readonly gamepad: GamepadButtonGroup;
}

const BUTTON_ROUTES: readonly ButtonRoute[] = [
  { action: "Jump", keyboard: "jump", gamepad: "jump" },
  { action: "Crouch", keyboard: "crouch", gamepad: "crouch" },
  { action: "Sprint", keyboard: "sprint", gamepad: "sprint" },
  { action: "Interact", keyboard: "interact", gamepad: "interact" },
  { action: "Restart", keyboard: "restart", gamepad: "restart" },
  { action: "Pause", keyboard: "pause", gamepad: "pause" },
  { action: "Confirm", keyboard: "confirm", gamepad: "confirm" },
  { action: "Cancel", keyboard: "cancel", gamepad: "cancel" },
  { action: "ToggleSettings", keyboard: "toggleSettings", gamepad: "toggleSettings" },
  { action: "ToggleLeaderboard", keyboard: "toggleLeaderboard", gamepad: "toggleLeaderboard" },
];

interface NavigationRoute {
  readonly axis: "x" | "y";
  readonly direction: 1 | -1;
  readonly keyboard: KeyboardBindingGroup;
  readonly gamepad: GamepadButtonGroup;
}

const NAVIGATION_ROUTES: readonly NavigationRoute[] = [
  { axis: "y", direction: 1, keyboard: "navigateUp", gamepad: "navigateUp" },
  { axis: "y", direction: -1, keyboard: "navigateDown", gamepad: "navigateDown" },
  { axis: "x", direction: -1, keyboard: "navigateLeft", gamepad: "navigateLeft" },
  { axis: "x", direction: 1, keyboard: "navigateRight", gamepad: "navigateRight" },
];

/**
 * Pure action resolution from raw device state.
 * Contains no DOM access, which keeps it directly unit-testable.
 */
export class InputActionResolver {
  private readonly bindings: ActionBindings;

  constructor(bindings: ActionBindings = DEFAULT_ACTION_BINDINGS) {
    this.bindings = bindings;
  }

  resolve(raw: RawInputState): ResolvedActions {
    const actionValues = new Map<InputAction, number>();

    for (const route of BUTTON_ROUTES) {
      if (!isActionEnabledInContext(route.action, raw.context)) {
        continue;
      }

      const value = Math.max(
        this.keyboardButtonValue(this.bindings.keyboard[route.keyboard], raw.heldKeys),
        this.gamepadButtonValue(raw.gamepad, this.bindings.gamepad.buttons[route.gamepad]),
      );

      if (value > 0) {
        actionValues.set(route.action, value);
      }
    }

    return {
      move: isActionEnabledInContext("Move", raw.context)
        ? this.resolveMove(raw)
        : ZERO_VECTOR,
      navigate: isActionEnabledInContext("Navigate", raw.context)
        ? this.resolveNavigate(raw)
        : ZERO_VECTOR,
      lookMouse: isActionEnabledInContext("Look", raw.context)
        ? { x: raw.mouseDeltaX, y: raw.mouseDeltaY }
        : ZERO_VECTOR,
      lookGamepad: isActionEnabledInContext("Look", raw.context)
        ? this.resolveGamepadLook(raw.gamepad)
        : ZERO_VECTOR,
      actionValues,
    };
  }

  private resolveMove(raw: RawInputState): Vector2Like {
    const keyboard = this.bindings.keyboard;
    const keyboardX =
      (this.keyboardButtonValue(keyboard.moveRight, raw.heldKeys) > 0 ? 1 : 0) -
      (this.keyboardButtonValue(keyboard.moveLeft, raw.heldKeys) > 0 ? 1 : 0);
    const keyboardY =
      (this.keyboardButtonValue(keyboard.moveForward, raw.heldKeys) > 0 ? 1 : 0) -
      (this.keyboardButtonValue(keyboard.moveBackward, raw.heldKeys) > 0 ? 1 : 0);

    const gamepad = this.resolveGamepadMove(raw.gamepad);

    return clampVector2Magnitude({ x: keyboardX + gamepad.x, y: keyboardY + gamepad.y });
  }

  private resolveGamepadMove(gamepad: GamepadSnapshot | null): Vector2Like {
    if (!gamepad) {
      return ZERO_VECTOR;
    }

    const bindings = this.bindings.gamepad;
    const axes = readStick(gamepad, bindings);

    // Gamepad Y grows downwards; gameplay "forward" is positive.
    return { x: axes.x, y: -axes.y };
  }

  private resolveGamepadLook(gamepad: GamepadSnapshot | null): Vector2Like {
    if (!gamepad) {
      return ZERO_VECTOR;
    }

    const bindings = this.bindings.gamepad;
    const axes = bindings.lookAxes;
    const stick = applyRadialDeadZone(
      { x: gamepad.axes[axes[0]] ?? 0, y: gamepad.axes[axes[1]] ?? 0 },
      bindings.stickDeadZone,
    );

    return stick;
  }

  private resolveNavigate(raw: RawInputState): Vector2Like {
    let x = 0;
    let y = 0;

    for (const route of NAVIGATION_ROUTES) {
      const active =
        this.keyboardButtonValue(this.bindings.keyboard[route.keyboard], raw.heldKeys) > 0 ||
        this.gamepadButtonValue(raw.gamepad, this.bindings.gamepad.buttons[route.gamepad]) > 0;

      if (!active) {
        continue;
      }

      if (route.axis === "x") {
        x += route.direction;
      } else {
        y += route.direction;
      }
    }

    return clampVector2Magnitude({ x, y });
  }

  private keyboardButtonValue(
    keys: readonly string[],
    heldKeys: ReadonlySet<string>,
  ): number {
    for (const key of keys) {
      if (heldKeys.has(key)) {
        return 1;
      }
    }

    return 0;
  }

  private gamepadButtonValue(
    gamepad: GamepadSnapshot | null,
    indices: readonly number[],
  ): number {
    if (!gamepad) {
      return 0;
    }

    let value = 0;

    for (const index of indices) {
      const button = gamepad.buttons[index];

      if (button?.pressed) {
        // Digital buttons may report value 0 in some browsers; pressed is authoritative.
        value = Math.max(value, button.value > 0 ? Math.min(1, button.value) : 1);
      }
    }

    return value;
  }
}

function readStick(gamepad: GamepadSnapshot, bindings: GamepadBindings): Vector2Like {
  return applyRadialDeadZone(
    {
      x: gamepad.axes[bindings.moveAxes[0]] ?? 0,
      y: gamepad.axes[bindings.moveAxes[1]] ?? 0,
    },
    bindings.stickDeadZone,
  );
}

/** Tracks pressed/held/released edges for button actions across frames. */
export class ButtonTransitionTracker {
  private readonly previousHeld = new Map<InputAction, boolean>();

  update(action: InputAction, held: boolean, value: number): ButtonState {
    const wasHeld = this.previousHeld.get(action) ?? false;

    this.previousHeld.set(action, held);

    return {
      pressed: held && !wasHeld,
      held,
      released: !held && wasHeld,
      value: held ? value : 0,
    };
  }

  reset(): void {
    this.previousHeld.clear();
  }
}

/**
 * Builds immutable input frames from raw device samples, adding button edges.
 * One frame is produced per rendered frame and consumed by all fixed steps.
 */
export class InputFrameBuilder {
  private readonly resolver: InputActionResolver;
  private readonly tracker = new ButtonTransitionTracker();

  constructor(bindings: ActionBindings = DEFAULT_ACTION_BINDINGS) {
    this.resolver = new InputActionResolver(bindings);
  }

  build(raw: RawInputState, timestampMs: number): InputFrame {
    const resolved = this.resolver.resolve(raw);
    const buttons = {} as Record<InputAction, ButtonState>;

    for (const action of INPUT_ACTIONS) {
      if (INPUT_ACTION_KINDS[action] !== "button") {
        buttons[action] = IDLE_BUTTON_STATE;
        continue;
      }

      const value = resolved.actionValues.get(action) ?? 0;
      buttons[action] = this.tracker.update(action, value > 0, value);
    }

    return {
      timestampMs,
      context: raw.context,
      move: resolved.move,
      navigate: resolved.navigate,
      lookMouse: resolved.lookMouse,
      lookGamepad: resolved.lookGamepad,
      buttons,
    };
  }

  reset(): void {
    this.tracker.reset();
  }
}
