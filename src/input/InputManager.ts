import type { Disposable } from "../core/Disposable";
import {
  type ActionBindings,
  DEFAULT_ACTION_BINDINGS,
  type GamepadSnapshot,
  type InputContext,
} from "./InputActions";
import { IDLE_INPUT_FRAME, type InputFrame, InputFrameBuilder } from "./InputState";

export interface InputManagerOptions {
  readonly canvas: HTMLCanvasElement;

  readonly bindings?: ActionBindings;

  /** Reports pointer-lock transitions so presentation can react. */
  readonly onPointerLockChanged?: (locked: boolean) => void;
}

const EMPTY_KEYS: ReadonlySet<string> = new Set();

function readGamepadSnapshot(): GamepadSnapshot | null {
  const navigatorWithGamepads = navigator as Navigator & {
    getGamepads?: () => (Gamepad | null)[];
  };

  if (typeof navigatorWithGamepads.getGamepads !== "function") {
    return null;
  }

  let gamepads: (Gamepad | null)[];

  try {
    gamepads = navigatorWithGamepads.getGamepads();
  } catch {
    return null;
  }

  for (const gamepad of gamepads) {
    if (!gamepad?.connected) {
      continue;
    }

    return {
      axes: [...gamepad.axes],
      buttons: gamepad.buttons.map((button) => ({
        pressed: button.pressed,
        value: button.value,
      })),
    };
  }

  return null;
}

/**
 * DOM adapter for the Input System: collects physical device state and exposes
 * one immutable {@link InputFrame} per rendered frame.
 *
 * Action resolution lives in `InputState` so it can be tested without a browser.
 */
export class InputManager implements Disposable {
  private readonly canvas: HTMLCanvasElement;
  private readonly bindings: ActionBindings;
  private readonly onPointerLockChanged: ((locked: boolean) => void) | undefined;
  private readonly frameBuilder: InputFrameBuilder;
  private readonly heldKeys = new Set<string>();
  private readonly heldMouseButtons = new Set<number>();
  private readonly cleanups: Array<() => void> = [];
  /**
   * Key codes with a (non-repeat) keydown since the previous frame build.
   * A press+release that both happen inside one rendered frame leaves no
   * held state behind; this set preserves the press edge for the next frame
   * so one-shot actions cannot be lost (see `11_INPUT_SYSTEM_SPEC.md` §14.4).
   */
  private readonly pendingPresses = new Set<string>();

  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private context: InputContext = "gameplay";
  private enabled = true;
  private disposed = false;
  private frame: InputFrame = IDLE_INPUT_FRAME;

  constructor(options: InputManagerOptions) {
    this.canvas = options.canvas;
    this.bindings = options.bindings ?? DEFAULT_ACTION_BINDINGS;
    this.onPointerLockChanged = options.onPointerLockChanged;
    this.frameBuilder = new InputFrameBuilder(this.bindings);
    this.registerListeners();
  }

  get activeContext(): InputContext {
    return this.context;
  }

  get isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  get currentFrame(): InputFrame {
    return this.frame;
  }

  setContext(context: InputContext): void {
    if (this.context === context) {
      return;
    }

    this.context = context;
    this.releaseHeldInput();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;

    if (!enabled) {
      this.releaseHeldInput();
    }
  }

  /** Samples devices and produces the input frame for the current rendered frame. */
  updateFrame(timestampMs: number): void {
    if (this.disposed) {
      return;
    }

    const gamepad = this.enabled ? readGamepadSnapshot() : null;

    this.frame = this.frameBuilder.build(
      {
        context: this.context,
        heldKeys: this.enabled ? this.heldKeys : EMPTY_KEYS,
        pendingPresses: this.enabled ? this.pendingPresses : EMPTY_KEYS,
        mouseDeltaX: this.enabled ? this.mouseDeltaX : 0,
        mouseDeltaY: this.enabled ? this.mouseDeltaY : 0,
        gamepad,
      },
      timestampMs,
    );

    this.pendingPresses.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  /** Requests pointer lock. Must only be called from an explicit user gesture. */
  requestPointerLock(): void {
    if (this.disposed || this.isPointerLocked) {
      return;
    }

    try {
      const result: unknown = this.canvas.requestPointerLock();

      if (result instanceof Promise) {
        void result.catch((error: unknown) => {
          console.warn("[Glassline] Pointer lock was rejected.", error);
        });
      }
    } catch (error) {
      console.warn("[Glassline] Pointer lock is unavailable.", error);
    }
  }

  /** Clears held state without changing the context. Used on focus loss. */
  releaseHeldInput(): void {
    this.heldKeys.clear();
    this.heldMouseButtons.clear();
    this.pendingPresses.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.frameBuilder.reset();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.releaseHeldInput();

    for (const cleanup of this.cleanups) {
      cleanup();
    }

    this.cleanups.length = 0;
  }

  private registerListeners(): void {
    const onKeyDown: EventListener = (event) => {
      if (!this.enabled) {
        return;
      }

      const keyboardEvent = event as KeyboardEvent;

      this.heldKeys.add(keyboardEvent.code);

      if (!keyboardEvent.repeat) {
        this.pendingPresses.add(keyboardEvent.code);
      }

      if (this.shouldPreventDefault(keyboardEvent.code)) {
        keyboardEvent.preventDefault();
      }
    };

    const onKeyUp: EventListener = (event) => {
      this.heldKeys.delete((event as KeyboardEvent).code);
    };

    const onMouseMove: EventListener = (event) => {
      if (!this.enabled || !this.isPointerLocked) {
        return;
      }

      const mouseEvent = event as MouseEvent;

      this.mouseDeltaX += mouseEvent.movementX;
      this.mouseDeltaY += mouseEvent.movementY;
    };

    const onMouseDown: EventListener = (event) => {
      if (!this.enabled) {
        return;
      }

      this.heldMouseButtons.add((event as MouseEvent).button);
    };

    const onMouseUp: EventListener = (event) => {
      this.heldMouseButtons.delete((event as MouseEvent).button);
    };

    const onBlur: EventListener = () => {
      this.releaseHeldInput();
    };

    const onVisibilityChange: EventListener = () => {
      if (document.hidden) {
        this.releaseHeldInput();
      }
    };

    const onCanvasClick: EventListener = () => {
      if (this.enabled && this.context === "gameplay") {
        this.requestPointerLock();
      }
    };

    const onContextMenu: EventListener = (event) => {
      event.preventDefault();
    };

    const onPointerLockChange: EventListener = () => {
      this.releaseHeldInput();
      this.onPointerLockChanged?.(this.isPointerLocked);
    };

    const onPointerLockError: EventListener = () => {
      console.warn("[Glassline] Pointer lock could not be acquired.");
    };

    this.listen("keydown", window, onKeyDown);
    this.listen("keyup", window, onKeyUp);
    this.listen("mousemove", window, onMouseMove);
    this.listen("mousedown", window, onMouseDown);
    this.listen("mouseup", window, onMouseUp);
    this.listen("blur", window, onBlur);
    this.listen("visibilitychange", document, onVisibilityChange);
    this.listen("pointerlockchange", document, onPointerLockChange);
    this.listen("pointerlockerror", document, onPointerLockError);
    this.listen("click", this.canvas, onCanvasClick);
    this.listen("contextmenu", this.canvas, onContextMenu);
  }

  private listen(type: string, target: EventTarget, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.cleanups.push(() => target.removeEventListener(type, handler));
  }

  private shouldPreventDefault(code: string): boolean {
    if (!this.isBoundKey(code)) {
      return false;
    }

    // Prevent page scrolling for gameplay keys while leaving browser shortcuts intact.
    return code === "Space" || code.startsWith("Arrow");
  }

  private isBoundKey(code: string): boolean {
    for (const keys of Object.values(this.bindings.keyboard)) {
      if (keys.includes(code)) {
        return true;
      }
    }

    return false;
  }
}
