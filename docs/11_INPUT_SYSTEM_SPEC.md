# 11_INPUT_SYSTEM_SPEC.md

**Project:** Glassline  
**Document:** Input System Specification

## 1. Overview

The Input System manages all player input and translates physical device interactions into abstract gameplay actions.

Its primary responsibility is to provide a consistent input interface between hardware devices and game systems.

The system must support:

- Keyboard input.
- Mouse input.
- Mouse movement and camera control.
- Mouse wheel input.
- Gamepad input.
- Input remapping.
- Multiple control profiles.
- Sensitivity configuration.
- Input state tracking.
- Context-sensitive actions.
- Input focus management.
- UI and gameplay input separation.

The initial implementation targets desktop browsers.

Keyboard & Mouse is the primary control scheme.

Gamepad support should be included in the architecture and implemented without introducing unnecessary complexity.

### Design Philosophy

The Input System must:

1. Separate physical devices from gameplay actions.
2. Provide a unified action-based API.
3. Support configurable bindings.
4. Prevent UI input from leaking into gameplay.
5. Handle simultaneous inputs correctly.
6. Support analog and digital input.
7. Avoid unnecessary allocations during gameplay.
8. Remain independent of player movement implementation.

The Movement System must consume abstract input values rather than directly reading keyboard or mouse events.

---

# 2. Architecture

## 2.1 High-Level Architecture

```text
         Physical Devices
                |
       +--------+--------+
       |        |        |
       v        v        v
    Keyboard  Mouse   Gamepad
       |        |        |
       +--------+--------+
                |
                v
          InputManager
                |
                v
         Input Processing
                |
       +--------+--------+
       |        |        |
       v        v        v
    Bindings  Contexts  Filters
       |        |        |
       +--------+--------+
                |
                v
          Input Actions
                |
       +--------+--------+
       |        |        |
       v        v        v
    Movement  Camera     UI
```

## 2.2 Core Modules

### InputManager

Central coordinator responsible for:

- Device initialization.
- Input event processing.
- Action state management.
- Binding resolution.
- Context management.
- Device detection.
- Input state exposure.

### KeyboardInput

Responsible for:

- Keyboard event registration.
- Key state tracking.
- Key press and release.
- Keyboard focus handling.

### MouseInput

Responsible for:

- Mouse movement.
- Mouse buttons.
- Mouse wheel.
- Pointer lock.
- Mouse delta accumulation.

### GamepadInput

Responsible for:

- Gamepad detection.
- Button state.
- Analog stick state.
- Trigger values.
- Device disconnection.
- Controller selection.

### InputBindingManager

Responsible for:

- Action-to-control mappings.
- Binding lookup.
- Binding changes.
- Duplicate binding detection.
- Binding persistence.

### InputContextManager

Responsible for:

- Active input contexts.
- Context priorities.
- Action filtering.
- Gameplay and UI separation.

### InputProcessor

Responsible for:

- Digital input normalization.
- Analog input processing.
- Dead zones.
- Sensitivity.
- Input smoothing where appropriate.

---

# 3. Input Action Model

## 3.1 Purpose

Gameplay systems must operate on logical actions.

For example, the movement controller should request:

```typescript
input.getAxis("Move");
input.isPressed("Jump");
input.isHeld("Sprint");
```

It must not inspect:

```typescript
event.code === "KeyW";
```

This separation makes input remapping possible without modifying gameplay code.

## 3.2 Action Types

The system supports three primary action types.

| Type | Description | Example |
|---|---|---|
| Button | Press/release action | Jump |
| Axis1D | Single analog value | Look sensitivity or throttle |
| Axis2D | Two-dimensional direction | Movement |

### Button

A digital action with:

- Pressed state.
- Held state.
- Released state.
- Optional repeat behavior.

### Axis1D

A normalized scalar value.

Range:

```text
-1.0 ... 1.0
```

Some actions, such as analog triggers, may use:

```text
0.0 ... 1.0
```

### Axis2D

A two-dimensional input value.

```typescript
interface Vector2Input {
    x: number;

    y: number;
}
```

Typical range:

```text
x: -1.0 ... 1.0
y: -1.0 ... 1.0
```

Analog values must be clamped to supported ranges.

---

# 4. Gameplay Actions

## 4.1 Movement Actions

Initial movement actions:

| Action | Type | Description |
|---|---|---|
| Move | Axis2D | Character movement |
| Jump | Button | Jump |
| Crouch | Button | Crouch or slide |
| Sprint | Button | Sprint |
| Interact | Button | Contextual interaction |
| Restart | Button | Restart exercise or run |

The exact behavior of Crouch, Sprint, and Jump is defined by Gameplay and Movement specifications.

The Input System only provides action states.

## 4.2 Camera Actions

| Action | Type | Description |
|---|---|---|
| Look | Axis2D | Camera rotation |
| LookSensitivity | Axis1D | Optional configurable modifier |

Mouse and gamepad camera input must be normalized consistently.

However, their underlying input characteristics are different.

Mouse input represents relative movement.

Gamepad input represents a continuous analog position.

These devices must not be treated as identical raw values.

## 4.3 UI Actions

| Action | Type | Description |
|---|---|---|
| Navigate | Axis2D | Menu navigation |
| Confirm | Button | Confirm selection |
| Cancel | Button | Back or cancel |
| Pause | Button | Open pause menu |
| ToggleSettings | Button | Open settings |
| ToggleLeaderboard | Button | Open leaderboard |

UI actions must be available only in appropriate contexts.

## 4.4 Initial Action Registry

```typescript
type InputAction =
    | "Move"
    | "Jump"
    | "Crouch"
    | "Sprint"
    | "Interact"
    | "Restart"
    | "Look"
    | "Navigate"
    | "Confirm"
    | "Cancel"
    | "Pause"
    | "ToggleSettings"
    | "ToggleLeaderboard";
```

The registry must be centralized.

Do not scatter arbitrary action string identifiers throughout the project.

---

# 5. Default Keyboard & Mouse Bindings

## 5.1 Keyboard Bindings

Recommended initial layout:

| Action | Default Binding |
|---|---|
| Move Forward | W |
| Move Backward | S |
| Move Left | A |
| Move Right | D |
| Jump | Space |
| Crouch | Left Shift / Right Shift |
| Sprint | X |
| Slide | Left Shift (while running) |
| Interact | E |
| Restart | R |
| Pause | Escape |

The movement actions combine into one Axis2D action.

## 5.2 Mouse Bindings

| Action | Default Binding |
|---|---|
| Look | Mouse Movement |
| Interact | Left Mouse Button, optional |
| Alternate Action | Right Mouse Button, reserved |
| Scroll | Mouse Wheel, reserved |

Mouse buttons must remain configurable.

Do not assign gameplay actions to browser-reserved mouse behavior without considering browser compatibility.

## 5.3 Default Binding Configuration

```typescript
const DEFAULT_KEY_BINDINGS = {
    MoveForward: ["KeyW"],
    MoveBackward: ["KeyS"],
    MoveLeft: ["KeyA"],
    MoveRight: ["KeyD"],

    Jump: ["Space"],
    Crouch: ["ShiftLeft", "ShiftRight"],
    Sprint: ["KeyX"],
    Interact: ["KeyE"],
    Restart: ["KeyR"],

    Pause: ["Escape"],
    Confirm: ["Enter", "Space"],
    Cancel: ["Escape"]
};
```

The implementation must use `KeyboardEvent.code` for physical key identification where appropriate.

This preserves physical key placement across different keyboard layouts.

Display labels should use user-friendly localized key names.

---

# 6. Input State

## 6.1 Button State

Each digital action should expose the following states:

```typescript
interface ButtonState {
    pressed: boolean;

    held: boolean;

    released: boolean;

    value: number;
}
```

Interpretation:

- `pressed`: Activated during the current input frame.
- `held`: Currently active.
- `released`: Deactivated during the current input frame.
- `value`: Normalized activation value.

Pressed and released are transient states.

They must not remain active across multiple simulation frames.

## 6.2 Axis State

```typescript
interface AxisState {
    value: number;

    previousValue: number;

    delta: number;
}
```

For Axis2D:

```typescript
interface Axis2DState {
    x: number;

    y: number;

    previousX: number;

    previousY: number;
}
```

## 6.3 Input Frame

The system should provide a stable input snapshot for gameplay simulation.

```typescript
interface InputFrame {
    timestamp: number;

    move: Vector2Input;

    look: Vector2Input;

    jumpPressed: boolean;

    jumpHeld: boolean;

    jumpReleased: boolean;

    crouchPressed: boolean;

    crouchHeld: boolean;

    sprintHeld: boolean;

    interactPressed: boolean;
}
```

The Movement System should consume one consistent snapshot per simulation update.

Input state must not change unpredictably halfway through a physics update.

---

# 7. Input Processing

## 7.1 Digital Input Normalization

Keyboard movement is assembled from individual digital bindings.

Example:

```text
W = +1 Y
S = -1 Y
A = -1 X
D = +1 X
```

Diagonal movement must be normalized.

Without normalization, diagonal input would have a magnitude greater than straight-line input.

```typescript
function normalizeMovement(
    x: number,
    y: number
): Vector2Input {
    const length = Math.hypot(x, y);

    if (length <= 1) {
        return { x, y };
    }

    return {
        x: x / length,
        y: y / length
    };
}
```

## 7.2 Analog Input

Gamepad sticks provide analog values.

The system must preserve analog magnitude after applying dead-zone processing.

Avoid converting every nonzero analog input into a full-strength digital action.

## 7.3 Dead Zones

Gamepad sticks require configurable dead zones.

Recommended initial values:

```typescript
const DEFAULT_LEFT_STICK_DEADZONE = 0.15;

const DEFAULT_RIGHT_STICK_DEADZONE = 0.12;
```

Use radial dead-zone processing.

A radial dead zone is preferable to independent X/Y thresholds because it preserves directional consistency.

Conceptual implementation:

```typescript
function applyRadialDeadzone(
    x: number,
    y: number,
    deadzone: number
): Vector2Input {
    const magnitude = Math.hypot(x, y);

    if (magnitude <= deadzone) {
        return { x: 0, y: 0 };
    }

    const normalizedMagnitude = Math.min(
        1,
        (magnitude - deadzone) / (1 - deadzone)
    );

    return {
        x: (x / magnitude) * normalizedMagnitude,
        y: (y / magnitude) * normalizedMagnitude
    };
}
```

The final result must remain within the normalized input range.

## 7.4 Input Smoothing

Input smoothing may be applied to analog camera controls.

However:

- Keyboard movement should remain responsive.
- Mouse movement should not receive unnecessary smoothing.
- Jump and other critical actions must not be delayed.
- Movement physics must not depend on UI frame rate.

Smoothing parameters must be configurable.

The default implementation should prefer direct input unless smoothing provides a measurable improvement.

---

# 8. Mouse Input

## 8.1 Mouse Movement

Mouse movement controls camera rotation.

Use relative mouse movement while pointer lock is active.

Relevant browser API:

```typescript
event.movementX;
event.movementY;
```

Do not calculate camera movement using the difference between absolute screen coordinates while pointer lock is active.

## 8.2 Pointer Lock

Pointer lock is required for comfortable first-person gameplay.

The system must:

1. Request pointer lock after an explicit user interaction.
2. Confirm successful acquisition.
3. Process relative mouse movement.
4. Handle pointer lock loss.
5. Allow the player to reacquire pointer lock.

Browser restrictions must be respected.

Pointer lock must never be requested automatically without an appropriate user gesture.

## 8.3 Pointer Lock Lifecycle

```text
Main Menu
    |
    v
Player Starts Gameplay
    |
    v
Request Pointer Lock
    |
    v
Pointer Lock Acquired
    |
    v
Active Gameplay
    |
    +---- Escape / Focus Loss
    |
    v
Pointer Lock Released
    |
    v
Pause / Resume Interface
    |
    v
Explicit Resume
    |
    v
Request Pointer Lock Again
```

The application must distinguish between:

- Intentional pause.
- Browser focus loss.
- Unexpected pointer lock loss.

## 8.4 Mouse Sensitivity

Mouse sensitivity must be configurable.

Suggested initial value:

```typescript
const DEFAULT_MOUSE_SENSITIVITY = 1.0;
```

Camera sensitivity must be applied in one well-defined layer.

Do not apply sensitivity in both MouseInput and CameraController.

## 8.5 Mouse Wheel

Mouse wheel events may be used for future features.

Examples:

- Menu navigation.
- Weapon or equipment selection, if introduced.
- Optional camera controls.

The initial gameplay implementation does not require mouse wheel actions.

---

# 9. Gamepad Support

## 9.1 Browser API

Use the standard Gamepad API.

Relevant browser interface:

```typescript
navigator.getGamepads();
```

Support common desktop controllers.

Examples:

- Xbox-compatible controllers.
- PlayStation-compatible controllers.
- Generic HID gamepads supported by the browser.

Do not assume every controller uses identical button mappings.

## 9.2 Default Gamepad Layout

Recommended default mapping:

| Action | Gamepad Control |
|---|---|
| Move | Left Stick |
| Look | Right Stick |
| Jump | A / Cross |
| Crouch / Slide | B / Circle |
| Sprint | Left Stick Press |
| Interact | X / Square |
| Pause | Menu / Start |

These are logical defaults.

Actual physical button mapping depends on the browser's standardized gamepad mapping.

## 9.3 Analog Triggers

The system should support analog triggers.

Potential future uses:

- Variable sprint intensity.
- Context-sensitive interaction.
- Additional movement controls.

The initial movement system may treat relevant triggers as digital actions.

## 9.4 Device Detection

The system must detect:

- Controller connected.
- Controller disconnected.
- Active controller changes.
- Controller input availability.

Use browser connection events where available.

Also handle periodic polling because browser support and connection behavior can vary.

## 9.5 Controller Selection

If multiple controllers are connected:

- Prefer the most recently active controller.
- Maintain a stable active device while the player is using it.
- Avoid switching devices because of insignificant analog noise.

## 9.6 Gamepad Vibration

Gamepad vibration is optional.

If supported, it may be used for:

- Landing feedback.
- Major movement impacts.
- Checkpoint activation.

Vibration must not be required for gameplay.

It must respect browser permissions and device capabilities.

---

# 10. Input Contexts

## 10.1 Purpose

Input contexts define which actions are active in different application states.

This prevents gameplay input from interfering with menus.

## 10.2 Initial Contexts

| Context | Description |
|---|---|
| Gameplay | Character movement and camera |
| MainMenu | Main menu navigation |
| PauseMenu | Pause interface |
| Settings | Settings navigation |
| Results | Speedrun results |
| Training | Training interface |
| Dialog | Modal dialogs |

## 10.3 Context Priority

Contexts must support priorities.

Example:

```text
Dialog       100
PauseMenu     80
Settings      70
Results       60
MainMenu      50
Gameplay      10
```

These values are initial design values.

A higher-priority context can consume actions that would otherwise reach a lower-priority context.

## 10.4 Context Switching

When switching from Gameplay to PauseMenu:

- Disable gameplay actions.
- Preserve UI navigation actions.
- Release held gameplay actions.
- Stop accumulating gameplay mouse movement.
- Release pointer lock when appropriate.

When returning to Gameplay:

- Re-enable gameplay actions.
- Request pointer lock through an explicit user interaction.
- Do not restore previously held keys automatically.

## 10.5 Context API

```typescript
interface InputContextManager {
    pushContext(contextId: string): void;

    popContext(contextId: string): void;

    setContext(contextId: string): void;

    getActiveContext(): string;

    isActionEnabled(action: string): boolean;
}
```

The implementation must prevent accidental duplicate context registration.

---

# 11. Input Remapping

## 11.1 Requirements

The player must be able to change keyboard bindings.

The architecture must also support configurable gamepad bindings.

Remapping must not require changes to gameplay code.

## 11.2 Binding Model

```typescript
interface InputBinding {
    id: string;

    action: string;

    device: "keyboard" | "mouse" | "gamepad";

    control: string;

    modifiers?: string[];

    enabled: boolean;
}
```

## 11.3 Binding Configuration

```typescript
interface InputBindingProfile {
    id: string;

    name: string;

    bindings: InputBinding[];
}
```

## 11.4 Remapping Flow

```text
Open Controls
      |
      v
Select Action
      |
      v
Waiting For Input
      |
      v
Capture Physical Input
      |
      v
Check Compatibility
      |
      v
Check Conflicts
      |
      +---- Conflict
      |       |
      |       v
      |   Show Warning
      |       |
      |       v
      |   Confirm Replacement
      |
      v
Save New Binding
      |
      v
Update Active Input
```

## 11.5 Conflict Handling

The system must detect conflicting bindings.

Examples:

- Two actions assigned to the same key.
- An action bound to a reserved key.
- An invalid gamepad control.
- A binding incompatible with the current context.

Some duplicate bindings are valid.

For example, Space may be used for Jump in Gameplay and Confirm in MainMenu.

Conflict detection must consider context compatibility.

## 11.6 Reserved Keys

The browser and operating system reserve some keyboard combinations.

The system must not assume that every key can be captured.

At minimum:

- Escape must remain available for basic navigation.
- Browser shortcuts must not be forcibly intercepted.
- System shortcuts must not be blocked.
- Invalid bindings must produce clear feedback.

The player must always have a way to restore default bindings.

---

# 12. Input Profiles

## 12.1 Purpose

Profiles allow players to maintain different configurations.

Initial support:

- Default.
- Custom.

Future support:

- Multiple custom profiles.
- Different control schemes.
- Imported profiles.

## 12.2 Default Profile

The default profile must always be available.

It must not be possible to permanently delete the default profile.

## 12.3 Custom Profile

Custom profiles contain:

- Keyboard bindings.
- Mouse bindings.
- Gamepad bindings.
- Sensitivity settings.
- Dead-zone configuration.

Profiles must be persisted through the Save System.

---

# 13. Input Focus and Browser Integration

## 13.1 Focus Handling

The system must monitor application focus.

Relevant events:

- `window.blur`
- `window.focus`
- `document.visibilitychange`
- `pointerlockchange`

## 13.2 Focus Loss

When the browser loses focus:

1. Clear transient input states.
2. Release all held gameplay actions.
3. Stop accumulating mouse deltas.
4. Suspend gameplay input processing where appropriate.
5. Notify the application state manager.

The Speedrun timer continues running unless the run lifecycle explicitly defines another rule.

Input focus loss must not silently pause an official speedrun.

## 13.3 Keyboard Event Handling

Use:

- `keydown`
- `keyup`

Track physical key states using `KeyboardEvent.code`.

Ignore repeated keydown events for one-shot actions.

Use `preventDefault()` only when the application owns the relevant interaction and preventing the browser behavior is necessary.

Do not globally suppress browser keyboard shortcuts.

## 13.4 Editable Elements

When an HTML input, textarea, or content-editable element has focus:

- Gameplay input must be disabled.
- Text input must work normally.
- Key remapping must not interfere with text editing.

The Input System must be aware of UI focus boundaries.

---

# 14. Input and Movement Integration

## 14.1 Separation of Responsibilities

The Input System collects and interprets user intent.

The Movement System determines how the character responds.

Example:

```text
Keyboard W
    |
    v
InputManager
    |
    v
Move Action
    |
    v
InputFrame
    |
    v
MovementController
    |
    v
Character Physics
```

## 14.2 Movement Input

The movement controller receives normalized movement input.

```typescript
interface MovementInput {
    direction: Vector2Input;

    jumpPressed: boolean;

    jumpHeld: boolean;

    jumpReleased: boolean;

    crouchPressed: boolean;

    crouchHeld: boolean;

    sprintHeld: boolean;
}
```

The controller must not depend on specific physical keys.

## 14.3 Camera Integration

CameraController consumes the Look action.

Mouse and gamepad inputs must be processed differently where necessary.

Mouse input is relative movement.

Gamepad input is a normalized directional axis.

Camera sensitivity must be configurable.

## 14.4 Simulation Timing

Input collection and gameplay simulation may run at different frequencies.

The system must provide a stable input snapshot.

Requirements:

- One-shot button events must not be lost.
- One-shot events must not be executed multiple times unintentionally.
- Analog values must remain available to simulation.
- Input state must be consistent during one simulation update.

For fixed-step simulation, transient events should be buffered until consumed by the simulation.

---

# 15. Input Recording and Debugging

## 15.1 Debug Input Overlay

Development builds should provide an optional input debugging overlay.

Display:

- Active input device.
- Current input context.
- Movement vector.
- Look vector.
- Button states.
- Pointer lock state.
- Active binding profile.

Example:

```text
INPUT DEBUG

DEVICE: KEYBOARD + MOUSE
CONTEXT: GAMEPLAY

MOVE:  X 0.00 / Y 1.00
LOOK:  X 0.24 / Y -0.08

JUMP:   RELEASED
SPRINT: HELD
CROUCH: RELEASED

POINTER LOCK: ACTIVE
```

The overlay must be disabled in production by default.

## 15.2 Input Event Logging

Development builds may record input events for debugging.

Do not write every input event to persistent storage.

Logging must be optional and must not affect gameplay performance.

---

# 16. Accessibility

The Input System should support accessibility improvements.

Initial requirements:

- Remappable keyboard controls.
- Configurable mouse sensitivity.
- Configurable gamepad dead zones.
- Invert Y axis.
- Alternative control bindings.
- Clear indication of active input device.

Future options:

- Toggle instead of hold for selected actions.
- Custom movement sensitivity curves.
- Reduced simultaneous button requirements.
- Additional input-device support.

Accessibility features must not introduce unexpected behavior into competitive Speedrun timing.

---

# 17. Performance Requirements

The Input System must be lightweight.

Requirements:

- Avoid unnecessary allocations during input processing.
- Avoid registering duplicate DOM event listeners.
- Avoid creating new event handlers every frame.
- Avoid polling Gamepad API multiple times per frame.
- Cache active device state.
- Reuse input state objects where practical.
- Avoid unnecessary state notifications.
- Keep input processing independent from rendering FPS.

The Gamepad API should be polled at an appropriate update frequency.

Mouse deltas must be accumulated safely between simulation updates.

---

# 18. Error Handling

The system must handle:

- Missing input device.
- Unsupported Gamepad API.
- Pointer lock denied.
- Pointer lock lost.
- Invalid binding.
- Duplicate binding.
- Device disconnection.
- Focus loss.
- Invalid input profile.
- Unexpected keyboard events.

A missing gamepad must never prevent Keyboard & Mouse gameplay.

Pointer lock failure must produce a recoverable state.

Invalid saved bindings must fall back to defaults where necessary.

---

# 19. Suggested Project Structure

```text
src/
  systems/
    input/
      InputManager.ts

      devices/
        KeyboardInput.ts
        MouseInput.ts
        GamepadInput.ts

      actions/
        InputActionRegistry.ts
        InputActionState.ts
        InputFrame.ts

      bindings/
        InputBindingManager.ts
        InputBindingProfile.ts
        DefaultBindings.ts
        BindingValidator.ts

      contexts/
        InputContextManager.ts
        InputContext.ts

      processing/
        InputProcessor.ts
        DeadzoneProcessor.ts
        InputNormalizer.ts

      debugging/
        InputDebugOverlay.ts

      types/
        InputTypes.ts
        InputDeviceTypes.ts
```

Adapt the structure to existing project conventions.

Do not duplicate an existing input abstraction.

---

# 20. Testing Requirements

## 20.1 Keyboard Tests

- Key press.
- Key release.
- Key repeat.
- Simultaneous keys.
- Diagonal movement.
- Focus loss.
- Browser shortcut handling.
- Editable element focus.

## 20.2 Mouse Tests

- Mouse movement.
- Mouse buttons.
- Mouse wheel.
- Pointer lock acquisition.
- Pointer lock release.
- Pointer lock failure.
- Focus loss.
- Delta accumulation.

## 20.3 Gamepad Tests

- Device connection.
- Device disconnection.
- Analog stick values.
- Dead-zone processing.
- Button press and release.
- Multiple controllers.
- Controller selection.

## 20.4 Binding Tests

- Default bindings.
- Custom bindings.
- Remapping.
- Duplicate detection.
- Context-aware conflicts.
- Invalid bindings.
- Reset to defaults.
- Persistence across reloads.

## 20.5 Context Tests

- Gameplay context.
- Pause context.
- Dialog context.
- Context priority.
- Context switching.
- Held key release.
- UI/gameplay isolation.

## 20.6 Integration Tests

- Movement input reaches MovementController.
- Jump is triggered once per press.
- Mouse controls camera rotation.
- Gamepad controls movement.
- Pause disables gameplay input.
- Resume restores gameplay input.
- Focus loss does not create stuck keys.
- Speedrun timer remains independent of input focus.

---

# 21. Implementation Phases

## Phase 1 — Core Input Infrastructure

Implement:

- InputManager.
- InputActionRegistry.
- InputActionState.
- KeyboardInput.
- Basic action mapping.

Acceptance criteria:

- Keyboard input is converted into abstract actions.
- Movement works without direct keyboard access in MovementController.
- Pressed and released states are correct.

## Phase 2 — Mouse and Camera

Implement:

- MouseInput.
- Pointer lock.
- Mouse delta accumulation.
- Camera sensitivity.
- Pointer lock lifecycle.

Acceptance criteria:

- First-person camera responds correctly.
- Pointer lock is requested only after user interaction.
- Focus loss does not leave stuck input.

## Phase 3 — Context System

Implement:

- InputContextManager.
- Gameplay context.
- Main menu context.
- Pause context.
- Dialog context.

Acceptance criteria:

- UI input does not leak into gameplay.
- Gameplay actions are disabled while paused.
- Held actions are released on context transitions.

## Phase 4 — Binding Configuration

Implement:

- InputBindingManager.
- Default binding profiles.
- Remapping.
- Conflict detection.
- Save System integration.

Acceptance criteria:

- Player can remap keyboard controls.
- Invalid conflicts are rejected.
- Default bindings can be restored.
- Changes persist across reloads.

## Phase 5 — Gamepad Support

Implement:

- GamepadInput.
- Device detection.
- Standard mapping.
- Analog processing.
- Dead zones.
- Controller selection.

Acceptance criteria:

- Common gamepads work.
- Analog movement is smooth.
- Disconnected devices do not break gameplay.
- Keyboard & Mouse remains available.

## Phase 6 — Polish and Accessibility

Implement:

- Input debug overlay.
- Accessibility settings.
- Error handling.
- Performance optimization.
- Comprehensive integration tests.

Acceptance criteria:

- All required input devices behave consistently.
- Accessibility options work.
- No unnecessary input processing overhead is introduced.

---

# 22. Definition of Done

The Input System is complete when:

- [ ] Keyboard input is supported.
- [ ] Mouse input is supported.
- [ ] Pointer lock works.
- [ ] Gamepad architecture is implemented.
- [ ] Common gamepads are supported.
- [ ] Abstract input actions are available.
- [ ] Movement uses abstract actions.
- [ ] Camera uses abstract Look input.
- [ ] Input contexts are implemented.
- [ ] UI and gameplay input are isolated.
- [ ] Keyboard remapping works.
- [ ] Binding conflicts are validated.
- [ ] Default bindings can be restored.
- [ ] Custom bindings persist.
- [ ] Gamepad dead zones work.
- [ ] Focus loss does not cause stuck inputs.
- [ ] Input snapshots are stable during simulation.
- [ ] Debugging tools are available in development builds.
- [ ] Input processing does not introduce measurable performance degradation.

---

# 23. Final Design Constraints

The implementation agent must follow these rules:

1. Never access keyboard events directly from MovementController.
2. Never access mouse events directly from CameraController.
3. Use abstract input actions.
4. Keep physical device handling separate from gameplay logic.
5. Support Keyboard & Mouse as the primary control scheme.
6. Support Gamepad without making it mandatory.
7. Use physical key codes for keyboard binding identification.
8. Handle browser pointer lock restrictions correctly.
9. Do not globally suppress browser shortcuts.
10. Normalize digital diagonal movement.
11. Preserve analog input magnitude.
12. Use radial dead-zone processing for gamepad sticks.
13. Prevent UI input from reaching gameplay contexts.
14. Release held actions on focus loss.
15. Do not pause official Speedrun timing because of input focus loss.
16. Do not rely on rendering FPS for input correctness.
17. Do not apply sensitivity in multiple system layers.
18. Persist custom bindings through Save System.
19. Keep input processing lightweight.
20. Keep the architecture extensible for future input devices.

**Primary objective:** Create a reliable, device-independent input architecture that provides precise first-person movement control while allowing flexible remapping, gamepad support, and clean integration with the gameplay systems.