/**
 * Centralised input action registry.
 * See `docs/11_INPUT_SYSTEM_SPEC.md` §3–§5 and §10.
 */

export const INPUT_ACTIONS = [
  "Move",
  "Jump",
  "Crouch",
  "Sprint",
  "Interact",
  "Restart",
  "Look",
  "Navigate",
  "Confirm",
  "Cancel",
  "Pause",
  "ToggleSettings",
  "ToggleLeaderboard",
] as const;

export type InputAction = (typeof INPUT_ACTIONS)[number];

export type InputActionKind = "button" | "axis1d" | "axis2d";

export const INPUT_ACTION_KINDS: Readonly<Record<InputAction, InputActionKind>> = {
  Move: "axis2d",
  Jump: "button",
  Crouch: "button",
  Sprint: "button",
  Interact: "button",
  Restart: "button",
  Look: "axis2d",
  Navigate: "axis2d",
  Confirm: "button",
  Cancel: "button",
  Pause: "button",
  ToggleSettings: "button",
  ToggleLeaderboard: "button",
};

/**
 * Initial input contexts. Gameplay and training share gameplay actions.
 * Priority resolution between contexts is introduced with the UI phases.
 */
export type InputContext =
  | "gameplay"
  | "training"
  | "main-menu"
  | "pause-menu"
  | "settings"
  | "results"
  | "dialog";

export const GAMEPLAY_INPUT_CONTEXTS: readonly InputContext[] = ["gameplay", "training"];

const MENU_INPUT_CONTEXTS: readonly InputContext[] = [
  "main-menu",
  "pause-menu",
  "settings",
  "results",
  "dialog",
];

const ACTION_CONTEXTS: Readonly<Record<InputAction, readonly InputContext[]>> = {
  Move: GAMEPLAY_INPUT_CONTEXTS,
  Jump: GAMEPLAY_INPUT_CONTEXTS,
  Crouch: GAMEPLAY_INPUT_CONTEXTS,
  Sprint: GAMEPLAY_INPUT_CONTEXTS,
  Interact: GAMEPLAY_INPUT_CONTEXTS,
  Restart: GAMEPLAY_INPUT_CONTEXTS,
  Look: GAMEPLAY_INPUT_CONTEXTS,
  Navigate: MENU_INPUT_CONTEXTS,
  Confirm: MENU_INPUT_CONTEXTS,
  Cancel: MENU_INPUT_CONTEXTS,
  Pause: GAMEPLAY_INPUT_CONTEXTS,
  ToggleSettings: ["main-menu", "pause-menu"],
  ToggleLeaderboard: ["main-menu", "pause-menu", "results"],
};

export function isActionEnabledInContext(action: InputAction, context: InputContext): boolean {
  return ACTION_CONTEXTS[action].includes(context);
}

export type KeyboardBindingGroup =
  | "moveForward"
  | "moveBackward"
  | "moveLeft"
  | "moveRight"
  | "jump"
  | "crouch"
  | "sprint"
  | "interact"
  | "restart"
  | "pause"
  | "confirm"
  | "cancel"
  | "navigateUp"
  | "navigateDown"
  | "navigateLeft"
  | "navigateRight"
  | "toggleSettings"
  | "toggleLeaderboard";

export type GamepadButtonGroup =
  | "jump"
  | "crouch"
  | "sprint"
  | "interact"
  | "restart"
  | "pause"
  | "confirm"
  | "cancel"
  | "navigateUp"
  | "navigateDown"
  | "navigateLeft"
  | "navigateRight"
  | "toggleSettings"
  | "toggleLeaderboard";

export type KeyboardBindings = Readonly<Record<KeyboardBindingGroup, readonly string[]>>;

export interface GamepadButtonSnapshot {
  readonly pressed: boolean;
  readonly value: number;
}

export interface GamepadSnapshot {
  readonly axes: readonly number[];
  readonly buttons: readonly GamepadButtonSnapshot[];
}

export interface GamepadBindings {
  /** [axisX, axisY] of the movement stick. */
  readonly moveAxes: readonly [number, number];

  /** [axisX, axisY] of the look stick. */
  readonly lookAxes: readonly [number, number];

  readonly stickDeadZone: number;

  readonly buttons: Readonly<Record<GamepadButtonGroup, readonly number[]>>;
}

export interface ActionBindings {
  readonly keyboard: KeyboardBindings;
  readonly gamepad: GamepadBindings;
}

export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBindings = {
  moveForward: ["KeyW"],
  moveBackward: ["KeyS"],
  moveLeft: ["KeyA"],
  moveRight: ["KeyD"],
  jump: ["Space"],
  crouch: ["ControlLeft", "ControlRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  interact: ["KeyE"],
  restart: ["KeyR"],
  pause: ["Escape"],
  confirm: ["Enter", "Space"],
  cancel: ["Escape"],
  navigateUp: ["ArrowUp"],
  navigateDown: ["ArrowDown"],
  navigateLeft: ["ArrowLeft"],
  navigateRight: ["ArrowRight"],
  toggleSettings: [],
  toggleLeaderboard: [],
};

export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = {
  moveAxes: [0, 1],
  lookAxes: [2, 3],
  stickDeadZone: 0.15,
  buttons: {
    jump: [0],
    crouch: [1],
    interact: [2],
    sprint: [10],
    pause: [9],
    confirm: [0],
    cancel: [1],
    restart: [8],
    navigateUp: [12],
    navigateDown: [13],
    navigateLeft: [14],
    navigateRight: [15],
    toggleSettings: [],
    toggleLeaderboard: [],
  },
};

export const DEFAULT_ACTION_BINDINGS: ActionBindings = {
  keyboard: DEFAULT_KEYBOARD_BINDINGS,
  gamepad: DEFAULT_GAMEPAD_BINDINGS,
};
