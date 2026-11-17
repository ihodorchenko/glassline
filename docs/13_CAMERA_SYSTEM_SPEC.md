# 13_CAMERA_SYSTEM_SPEC.md

**Project:** Glassline  
**Document:** Camera System Specification

## 1. Purpose

This document defines the first-person Camera System for Glassline, a first-person parkour game inspired by the original *Mirror's Edge* (2008).

The Camera System is responsible for:

- First-person perspective.
- Mouse and gamepad look input.
- Camera rotation and orientation.
- Field of View (FOV).
- Camera positioning.
- Camera height transitions.
- Movement-based camera effects.
- Jump and landing feedback.
- Sprint and slide feedback.
- Wall-run camera effects.
- Camera smoothing and inertia.
- Camera comfort settings.
- Camera integration with movement, audio, and UI systems.

The camera should communicate speed, physical movement, and player actions while keeping the environment readable.

The camera is a presentation system. It must never become the source of truth for player movement or collision.

---

## 2. Design Principles

### 2.1 First-Person Immersion

The player should feel physically present in the environment.

Camera movement should communicate the character's body movement without requiring a visible third-person character model.

### 2.2 Readability Over Effects

The player must always be able to understand:

- Where they are moving.
- Where they are looking.
- Which surface they are approaching.
- Where they can land.
- Which route is available.

Camera effects must never obscure important geometry or navigation cues.

### 2.3 Controlled Motion

The camera should feel responsive but not mechanically rigid.

Use controlled smoothing and small movement offsets to create a sense of weight.

Avoid excessive camera lag that makes precision parkour difficult.

### 2.4 Movement-Driven Feedback

Camera effects should reflect actual movement state.

Examples:

- Sprinting increases FOV slightly.
- Jumping produces subtle vertical movement.
- Landing produces a short impact response.
- Sliding lowers the camera.
- Wall running produces a controlled roll.

The camera must not invent movement states or independently determine whether an action succeeded.

### 2.5 Comfort and Accessibility

The camera must support players sensitive to motion.

All nonessential movement effects should be configurable.

The default camera should remain relatively stable and avoid excessive head bob, shake, roll, or sudden FOV changes.

---

## 3. Scope

### 3.1 Initial Implementation

The initial Camera System must support:

- First-person camera.
- Mouse look.
- Gamepad look input when a controller is available; keyboard and mouse remain the required initial control path (`03_GAMEPLAY_SPEC.md` §5.1).
- Horizontal and vertical rotation.
- Configurable look sensitivity.
- Vertical look limits.
- FOV configuration.
- Sprint FOV transition.
- Camera height transitions.
- Jump camera response.
- Landing camera response.
- Slide camera response.
- Wall-run camera roll.
- Camera smoothing.
- Camera reset and recovery.
- Settings integration.
- Reduced-motion behavior.
- Debug information.

### 3.2 Future Features

The architecture should allow:

- Advanced cinematic camera effects.
- Contextual camera framing.
- More detailed first-person body animations.
- Dynamic camera behavior for special movement abilities.
- Advanced head movement simulation.
- Per-surface camera feedback.
- Cinematic replay cameras.
- Spectator camera.
- Ghost replay camera.

These features are not required for the initial implementation.

---

## 4. Architecture

The Camera System consumes abstract look input and movement data.

It produces the final camera transform and presentation parameters.

### 4.1 Main Components

| Component | Responsibility |
|---|---|
| CameraController | Main camera orchestration |
| CameraLookController | Mouse and gamepad look |
| CameraRig | Camera transform hierarchy |
| CameraEffectsController | Movement-based effects |
| CameraFOVController | FOV transitions |
| CameraHeightController | Standing, crouching, and sliding height |
| CameraSmoothing | Controlled interpolation |
| CameraSettings | User-configurable parameters |
| CameraDebugController | Debug visualization and values |

### 4.2 Architecture Diagram

```text
Input System
    |
    +-- Look X
    +-- Look Y
    |
    v
CameraLookController
    |
    v
CameraController <----- Movement System
    |                         |
    |                         +-- Speed
    |                         +-- Acceleration
    |                         +-- Movement State
    |                         +-- Vertical Velocity
    |                         +-- Landing Impact
    |
    +-- CameraRig
    |
    +-- CameraHeightController
    |
    +-- CameraFOVController
    |
    +-- CameraEffectsController
    |
    v
Final Camera Transform
    |
    +-- Rendering
    +-- UI Presentation
    +-- Audio Spatialization Context
```

### 4.3 Separation of Responsibilities

The Camera System must not:

- Apply player acceleration.
- Modify player velocity.
- Resolve collisions.
- Determine whether the player is grounded.
- Trigger parkour actions.
- Make gameplay decisions, such as selecting respawn destinations, checkpoint state, or run state.
- Own input device handling.
- Own gameplay state transitions.

The Camera System may request camera-related input behavior, such as pointer lock, through the Input System.

The Input System remains responsible for actual device and browser input management.

---

## 5. Camera Rig

### 5.1 Recommended Hierarchy

Use a hierarchical camera rig to separate physical positioning, player look, and visual effects.

```text
PlayerRoot
    |
    +-- CameraHeightPivot
            |
            +-- LookPivot
                    |
                    +-- EffectsPivot
                            |
                            +-- Camera
```

Responsibilities:

| Transform | Responsibility |
|---|---|
| PlayerRoot | World position and physical orientation |
| CameraHeightPivot | Standing and crouching height |
| LookPivot | Player-controlled pitch and yaw |
| EffectsPivot | Temporary camera effects |
| Camera | Projection and rendering |

The hierarchy may be adapted to the selected engine, but the separation of responsibilities must remain.

### 5.2 Camera Position

The camera position must follow the player collider while maintaining a configurable eye height.

Initial standing eye height:

```text
standingEyeHeight = 1.60 m
```

The camera should not be positioned using an arbitrary offset unrelated to the player collider.

### 5.3 Camera Rotation

Player-controlled rotation should be separated from temporary effects.

Mouse and gamepad input modify the look rotation.

Movement effects modify a separate presentation transform.

This prevents camera effects from accumulating into the player's actual look direction.

---

## 6. Camera Orientation

### 6.1 Yaw

Yaw represents horizontal rotation around the world up axis.

Yaw should not have an artificial limit.

### 6.2 Pitch

Pitch represents vertical rotation.

Initial limits:

```text
minimumPitch = -85 degrees
maximumPitch = 85 degrees
```

The limits must be configurable.

Pitch should not wrap around.

### 6.3 Rotation Representation

The implementation may use Euler angles or quaternions.

However:

- Look input should remain intuitive.
- Pitch must be clamped.
- Temporary roll effects must not corrupt yaw or pitch.
- Camera rotation should not accumulate floating-point drift.

### 6.4 Sensitivity

Look sensitivity is user-configurable.

The canonical user settings are owned by the Input System and stored by the Settings System:

- `controls.mouse_sensitivity`
- `controls.invert_mouse_y`
- `controls.gamepad_sensitivity`
- `controls.invert_gamepad_y`

The Camera System must not define separate editable `camera.look_sensitivity` settings.

Internally, the camera may expose separate horizontal and vertical multipliers, but they are implementation details derived from the canonical Input configuration, not independent user settings.

The actual sensitivity scale depends on the Input System implementation.

Avoid applying sensitivity twice if the Input System already normalizes or scales look input.

---

## 7. Mouse Look Integration

### 7.1 Input Source

The Camera System receives abstract look input from `11_INPUT_SYSTEM_SPEC.md`.

It must not subscribe directly to DOM mouse events.

The Input System is responsible for:

- Pointer lock.
- Mouse movement events.
- Input accumulation.
- Focus loss.
- Pointer lock state.
- Mouse sensitivity profiles, if owned centrally.

### 7.2 Mouse Delta

Mouse look should use relative movement delta rather than absolute cursor position.

Conceptually:

```text
yawDelta = lookInput.x * horizontalSensitivity
pitchDelta = lookInput.y * verticalSensitivity
```

The sign of the vertical axis must be consistent with the configured inversion setting.

### 7.3 Frame Independence

Mouse delta represents accumulated pointer movement, not a continuous velocity.

Do not blindly multiply raw mouse delta by `deltaTime`.

The Input System should define whether look input is delivered as accumulated per-frame displacement or normalized rate.

The Camera System must use the documented input contract consistently.

### 7.4 Pointer Lock

Pointer lock behavior belongs to the Input System.

The Camera System should react to changes in look input availability.

When pointer lock is lost:

- Do not generate artificial camera movement.
- Preserve the current camera orientation.
- Do not reset yaw or pitch.
- Allow the UI to request pointer lock again when appropriate.

---

## 8. Gamepad Look

Gamepad look is an optional control path for the initial release; the Camera System must accept it when gamepad input is available, but must not require a controller (`03_GAMEPLAY_SPEC.md` §5.1).

### 8.1 Input Source

Gamepad look is received as a normalized two-dimensional input vector.

The Input System is responsible for:

- Controller discovery.
- Stick dead zones.
- Device disconnection.
- Axis normalization.

### 8.2 Camera Response

Gamepad look should behave as a continuous rotation rate.

Conceptually:

```text
yaw += lookInput.x * angularSpeed * deltaTime
pitch += lookInput.y * angularSpeed * deltaTime
```

### 8.3 Response Curve

A configurable response curve may be used.

The initial implementation should support:

- Dead zone.
- Sensitivity.
- Maximum angular speed.
- Optional response curve.

The default response should be predictable and suitable for precise platform navigation.

### 8.4 Mouse and Gamepad Switching

The camera should support switching between input devices without resetting orientation.

The last active device may be used to select relevant sensitivity settings.

---

## 9. Field of View

### 9.1 Purpose

FOV communicates speed and movement intensity.

It should provide a subtle sense of acceleration without creating excessive distortion.

### 9.2 Default FOV

Initial target:

```text
defaultFOV = 75 degrees
```

The value should be configurable.

### 9.3 Sprint FOV

During sprinting, FOV may increase slightly.

Initial target:

```text
sprintFOV = 82 degrees
```

The transition must be smooth.

FOV should respond to actual horizontal speed and sprint state.

It must not jump immediately between values.

### 9.4 Dynamic FOV

The initial implementation may use:

- Default FOV.
- Sprint FOV.
- Optional temporary movement FOV modifiers.

Avoid combining multiple independent FOV systems that compete with each other.

The final FOV must be calculated through a single controller.

### 9.5 FOV Transition

Use a configurable interpolation speed or damped smoothing function.

FOV changes should be reversible and should not overshoot.

### 9.6 User Settings

Expose:

- Base FOV.
- Dynamic FOV toggle.
- Sprint FOV intensity.

Reduced-motion settings should disable or reduce dynamic FOV changes.

---

## 10. Camera Height

### 10.1 Height Source

Camera height should reflect the physical player posture.

The Movement System exposes:

- The canonical movement state (`IDLE`, `RUNNING`, `SPRINTING`, `JUMPING`, `FALLING`, `LANDING`, `SLIDING`, `VAULTING`, `WALLRUN`, `WALLJUMP`).
- The crouch stance and the current collider height.

The Camera System translates these into camera height. The Camera System does not decide the player's posture, collision clearance, or movement transitions.

### 10.2 Standing Height

```text
standingEyeHeight = 1.60 m
```

### 10.3 Crouching Height

```text
crouchingEyeHeight = 1.05 m
```

### 10.4 Sliding Height

Sliding may use a lower camera position.

Initial target:

```text
slidingEyeHeight = 0.65 m
```

The actual height must be consistent with the player collider and movement animation.

### 10.5 Height Transitions

Camera height transitions should be smooth.

However, camera interpolation must not make the player perceive that they have more physical clearance than the collider actually provides.

The Movement System remains responsible for collision and standing clearance.

### 10.6 Vaulting

During vaulting, the camera may follow a controlled vertical trajectory.

The movement trajectory remains authoritative.

The camera should not independently calculate a different vault path.

### 10.7 Recovery

If a movement action is interrupted, camera height must return to a valid state.

Never leave the camera permanently at crouched or sliding height after an invalid transition.

---

## 11. Movement-Based Camera Effects

### 11.1 Overview

Movement effects are visual feedback derived from Movement System state.

Where an effect corresponds to a canonical gameplay event (`player:jumped`, `player:landed`, `player:sliding-started`, `player:sliding-ended`, `player:vault-started`, `player:wallrun-started`, `player:wallrun-ended`, `player:walljumped` — see `03_GAMEPLAY_SPEC.md` §18), the Camera System consumes that event instead of independently inferring the action from velocity.

The initial implementation should support:

- Running camera bob.
- Sprint camera bob.
- Jump response.
- Landing response.
- Slide response.
- Wall-run roll.
- Vault response.

Each effect must have:

- An activation condition.
- An intensity.
- A duration or update rule.
- A neutral state.
- A reduced-motion behavior.

### 11.2 Running Camera Bob

Camera bob simulates subtle body movement while running.

The effect should be based on movement speed and grounded state.

It must not run while the player is stationary or airborne.

Initial behavior:

- Small vertical oscillation.
- Very subtle horizontal movement.
- Speed-dependent intensity.
- Smooth fade-in and fade-out.

Avoid large sinusoidal movement that makes the horizon difficult to track.

### 11.3 Sprint Camera Bob

Sprint bob may be slightly stronger than normal running bob.

The effect must remain subtle.

Sprint camera bob should not be confused with actual player position changes.

### 11.4 Bobbing Frequency

Footstep timing and camera bob may use related movement data, but they should not be tightly coupled.

The Audio System owns footstep playback.

The Camera System owns camera oscillation.

The two systems may consume the same movement speed and cadence information.

### 11.5 Jump Response

Jumping may produce a small camera response.

Possible effects:

- Subtle downward anticipation.
- Slight upward response after jump initiation.
- Reduced vertical bob while airborne.
- Small adjustment near the jump apex.

The effect must not make the camera appear to jump independently from the player.

### 11.6 Landing Response

Landing is one of the most important camera feedback events.

The camera may use landing impact intensity to generate:

- Short downward displacement.
- Small rotational response.
- Brief FOV adjustment, if enabled.

The response should be proportional to actual vertical impact speed.

Avoid excessive shake.

Landing effects must be short and recover smoothly.

### 11.7 Slide Response

Sliding changes camera height through the height controller.

An additional small forward or downward effect may communicate acceleration into the slide.

The camera should not move through the floor.

### 11.8 Wall Run Roll

During wall running, the camera may roll toward the wall.

The effect should communicate that the player is moving along a vertical surface.

Initial target:

```text
maximumWallRunRoll = 8 degrees
```

The value should be configurable.

The camera should smoothly return to neutral when wall running ends.

Reduced-motion settings should reduce or disable wall-run roll.

### 11.9 Vault Response

Vaulting may use a small camera trajectory or anticipation effect.

The camera should follow the movement trajectory rather than inventing independent movement.

Avoid exaggerated camera movement during short vaults.

---

## 12. Camera Smoothing and Inertia

### 12.1 Purpose

Smoothing should make camera movement feel natural without reducing responsiveness.

### 12.2 Look Smoothing

Mouse look should be immediate by default.

Optional smoothing may be provided for users who prefer it.

Gamepad look may use controlled smoothing to reduce abrupt stick changes.

### 12.3 Effect Smoothing

Movement effects should use smoothing.

Examples:

- FOV transition.
- Camera height transition.
- Landing recovery.
- Wall-run roll.
- Running bob intensity.

### 12.4 Avoid Excessive Lag

The camera must remain sufficiently synchronized with the player.

Do not introduce large position delays between the player collider and camera.

### 12.5 Damped Interpolation

Use a stable interpolation approach.

Avoid simple interpolation factors that depend directly on frame rate.

Conceptually:

```text
alpha = 1 - exp(-responseRate * deltaTime)

current = lerp(current, target, alpha)
```

For rotations, use an appropriate quaternion interpolation method.

For fixed-timestep physics with variable rendering, the final camera transform may interpolate between physics snapshots.

---

## 13. Camera Effect Composition

### 13.1 Single Composition Pipeline

All camera effects must be composed through a single pipeline.

Do not let independent systems directly overwrite the camera transform.

Recommended order:

1. Base player position.
2. Camera height.
3. Player look rotation.
4. Movement-based positional effects.
5. Movement-based rotational effects.
6. Final projection parameters.

The exact transform hierarchy may differ, but the composition order must remain explicit.

### 13.2 Effect Priority

When multiple effects are active, they must not produce unstable results.

Suggested priority:

1. Physical player position.
2. Collider-aligned camera height.
3. Player look orientation.
4. Active parkour action response.
5. Landing and impact response.
6. Continuous movement bob.
7. Optional decorative effects.

Temporary effects should never permanently modify base camera transforms.

### 13.3 Effect Stacking

The system must prevent uncontrolled accumulation.

For example:

- Landing shake should not accumulate with every frame.
- Wall-run roll should not accumulate after repeated wall runs.
- Sprint FOV should return to the correct base value.
- Camera bob should stop when movement ends.

Each effect should have a defined neutral value.

---

## 14. Motion Comfort and Accessibility

### 14.1 Comfort Presets

Provide at least two camera presets:

| Preset | Behavior |
|---|---|
| Standard | Normal movement feedback |
| Reduced Motion | Minimal camera movement |

The player must be able to configure individual effects as well.

### 14.2 Camera Settings

Required settings:

- Base FOV.
- Effective look sensitivity (derived from Input System settings).
- Invert Y (Input System setting consumed by camera look).
- Dynamic FOV.
- Camera bob.
- Camera roll.
- Landing camera effect.
- Camera smoothing.
- Reduced-motion preset (shared accessibility preference).

The canonical values and setting IDs are owned by the Settings System (`25_SETTINGS_SYSTEM_SPEC.md`); the Camera System consumes them through the Settings application layer and does not maintain a second settings registry. Look sensitivity must be applied in exactly one layer (see §16).

### 14.3 Reduced Motion Behavior

Reduced Motion should:

- Disable or minimize camera bob.
- Disable wall-run roll.
- Reduce landing displacement.
- Disable dynamic FOV or use a smaller range.
- Minimize nonessential camera shake.
- Preserve camera height changes required for gameplay readability.

Reduced Motion must not disable gameplay mechanics.

The Reduced Motion policy is coordinated by the Accessibility System (`26_ACCESSIBILITY_SYSTEM_SPEC.md`); the user preference itself is owned by the Settings System (`25_SETTINGS_SYSTEM_SPEC.md`). The Camera System applies the effective accessibility configuration and must not maintain a competing reduced-motion state.

### 14.4 FOV Range

Initial configurable range:

```text
minimumFOV = 60 degrees
maximumFOV = 100 degrees
defaultFOV = 75 degrees
```

The exact range may depend on the rendering engine and display aspect ratio.

### 14.5 Comfort Defaults

Default effects should be subtle.

The first playable version should not depend on strong camera movement to communicate gameplay actions.

---

## 15. Camera Settings and Persistence

Camera settings are owned by the Settings System (`25_SETTINGS_SYSTEM_SPEC.md`), for example `camera.field_of_view`, `camera.bob_intensity`, `camera.motion_intensity`, and the shared Reduced Motion preference (`accessibility.reduced_motion`). Look sensitivity is owned by the Input System (`controls.mouse_sensitivity`, `controls.gamepad_sensitivity`, invert-Y settings). The Camera System consumes the effective configuration through the Settings application layer; it must not maintain an independent settings store or access IndexedDB directly.

Shared accessibility preferences (including Reduced Motion) are coordinated by the Accessibility System (`26_ACCESSIBILITY_SYSTEM_SPEC.md`) and take precedence over user motion intensity.

The following model describes the camera's applied configuration, not a second persistence schema:

```ts
interface CameraSettings {
  baseFOV: number;

  horizontalSensitivity: number;
  verticalSensitivity: number;

  invertY: boolean;

  dynamicFOVEnabled: boolean;
  sprintFOVIntensity: number;

  cameraBobEnabled: boolean;
  cameraBobIntensity: number;

  cameraRollEnabled: boolean;
  cameraRollIntensity: number;

  landingEffectEnabled: boolean;
  landingEffectIntensity: number;

  lookSmoothingEnabled: boolean;
  lookSmoothingIntensity: number;

  reducedMotion: boolean;
}
```

The model may be extended as additional settings are introduced, provided each field has a corresponding Settings definition. Sensitivity and invert-Y values are read from the canonical Settings/Input integration described in §16; they are not separately editable Camera-owned settings.

Requirements:

- Settings must be applied immediately.
- Settings changes must not reset player orientation.
- Invalid values must be clamped to supported ranges.
- Defaults must be available if saved settings are missing.
- Settings persistence is owned by the Settings System, which uses Save System (`10_SAVE_SYSTEM_SPEC.md`) infrastructure; the Camera System must not persist settings or access IndexedDB directly.

---

## 16. Camera and Input Integration

The Camera System consumes abstract look input.

It must not handle raw device events.

Input System responsibilities:

- Mouse input.
- Gamepad input.
- Pointer lock.
- Input context.
- Input focus.
- Device switching.

Camera System responsibilities:

- Applying look input.
- Updating orientation.
- Applying sensitivity configuration where appropriate.
- Maintaining pitch limits.
- Producing final camera rotation.

Avoid applying the same sensitivity multiplier in both systems.

The interface between Input and Camera must clearly define whether look values are raw or already processed.

---

## 17. Camera and Movement Integration

The Camera System consumes movement metrics from `12_MOVEMENT_SYSTEM_SPEC.md`.

Required data:

```ts
interface CameraMovementInput {
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;

  horizontalSpeed: number;
  verticalSpeed: number;

  movementState: MovementState;

  isGrounded: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isWallRunning: boolean;

  landingImpact: number;
}
```

The exact interface may be reduced if some fields are unnecessary.

The Camera System must not query movement internals directly.

Use a stable movement data interface or event subscription.

Movement effects are derived from Movement System output and, where relevant, from the effective player state snapshot provided by the Player State System (`18_PLAYER_STATE_SYSTEM_SPEC.md`). The Camera System may use the player state to suspend or restore effects during respawn, pause, or disabled control; it must not duplicate player lifecycle state or make gameplay decisions.

### 17.1 Synchronization

The camera should follow the latest valid player transform.

When movement uses a fixed physics timestep, rendering interpolation should prevent visible jitter.

Camera look input should remain responsive even if physics updates run at a different frequency.

---

## 18. Camera and UI Integration

The camera must provide a stable reference for first-person rendering.

UI elements should not be attached to temporary camera effect transforms unless they intentionally need to move with the camera.

For example:

- HUD should remain visually stable.
- Crosshair should not inherit landing shake unless explicitly designed to.
- Menus should not inherit gameplay camera bob.
- Pause screens should use a stable presentation state.

When gameplay is paused, the Camera System must stop movement-based effects.

Whether the player can still look around while a menu is open is determined by the active Input Context.

---

## 19. Camera Lifecycle

### 19.1 Initialization

On initialization:

1. Read the effective camera configuration from the Settings System.
2. Initialize camera rig.
3. Apply that configuration.
4. Set base FOV.
5. Initialize yaw and pitch.
6. Subscribe to movement data.
7. Initialize neutral effect states.

The camera must not apply movement effects before receiving valid player state.

### 19.2 Gameplay Start

At gameplay start:

- Preserve or initialize player orientation according to the spawn configuration.
- Reset temporary effects.
- Apply correct camera height.
- Apply base FOV.
- Wait for valid input context.

### 19.3 Pause

When gameplay is paused:

- Stop movement-based camera effects.
- Preserve player look orientation.
- Do not continue landing or wall-run animations.
- Avoid changing FOV unexpectedly.

### 19.4 Respawn

After respawn:

- Reset temporary camera effects.
- Restore valid camera height.
- Reset roll to neutral.
- Restore valid FOV.
- Preserve orientation only if explicitly requested by the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`).

### 19.5 Scene Transition

During level transitions:

- Disable gameplay-only effects.
- Prevent stale movement events from affecting the next scene.
- Unsubscribe from previous movement sources.
- Initialize the camera with the new player instance.

---

## 20. Debugging and Visualization

A debug mode should expose:

- Current yaw.
- Current pitch.
- Current FOV.
- Base camera height.
- Current camera height.
- Active camera effects.
- Movement state.
- Current effect intensity.
- Wall-run roll.
- Landing impact value.
- Look input.
- Active input device.
- Pointer lock state.

Example:

```text
CAMERA DEBUG

Yaw: 128.5
Pitch: -12.4
FOV: 79.2

Height: 1.60 m
Roll: 0.0 degrees

Movement: Sprinting
Horizontal Speed: 8.1 m/s

Effects:
  Camera Bob: 0.35
  Dynamic FOV: ACTIVE
  Landing: INACTIVE
  Wall Roll: INACTIVE

Input:
  Device: Mouse
  Pointer Lock: ACTIVE
```

Debug mode should be disabled in production builds unless explicitly enabled.

---

## 21. Performance Requirements

The Camera System must be lightweight.

Requirements:

- Avoid unnecessary object allocation.
- Reuse vectors and temporary objects.
- Avoid expensive scene queries.
- Avoid per-frame subscription creation.
- Avoid repeated settings lookups.
- Avoid rebuilding camera objects during normal gameplay.
- Keep effect calculations predictable.
- Avoid expensive post-processing for basic camera feedback.

Camera effects should not significantly affect rendering performance.

---

## 22. Error Handling and Recovery

The Camera System must recover from invalid states.

Examples:

- Missing movement data.
- Invalid camera transform.
- Invalid FOV.
- Invalid settings values.
- Stale movement event.
- Player respawn.
- Scene transition.
- Input focus loss.

Recovery behavior:

1. Validate incoming data.
2. Ignore invalid movement metrics.
3. Return temporary effects to neutral.
4. Restore valid base FOV.
5. Restore valid camera height.
6. Preserve orientation when possible.
7. Reconnect to the current player and movement source.

The camera must never remain permanently rolled, displaced, or zoomed after an interrupted movement action.

---

## 23. Testing Requirements

### 23.1 Unit Tests

Test:

- Yaw updates.
- Pitch clamping.
- Invert Y.
- Sensitivity application.
- FOV clamping.
- FOV interpolation.
- Camera height interpolation.
- Reduced-motion behavior.
- Effect reset.
- Rotation composition.
- Invalid settings recovery.

### 23.2 Integration Tests

Test:

- Mouse look.
- Gamepad look.
- Input device switching.
- Pointer lock loss and restoration.
- Sprint FOV.
- Running camera bob.
- Jump camera response.
- Landing camera response.
- Slide camera height.
- Wall-run roll.
- Pause and resume.
- Respawn.
- Scene transition.

### 23.3 Comfort Tests

Test:

- Reduced Motion preset.
- Camera bob disabled.
- Camera roll disabled.
- Dynamic FOV disabled.
- Low and high FOV values.
- Long sprint sequences.
- Repeated jumps and landings.
- Repeated wall-run transitions.

### 23.4 Frame Rate Tests

Test camera behavior at:

- 30 FPS.
- 60 FPS.
- 120 FPS.
- Unstable rendering frame rates.

The camera must not exhibit visible jitter or different effect durations caused by frame-rate assumptions.

---

## 24. Implementation Phases

### Phase 1 — Camera Foundation

Implement:

- Camera rig.
- First-person positioning.
- Yaw and pitch.
- Pitch limits.
- Mouse look.
- Gamepad look (optional control path).
- Base FOV.

Acceptance criteria:

- Camera follows the player.
- Look input is responsive.
- Pitch limits work.
- Camera orientation is independent from movement physics.

### Phase 2 — Camera Height and FOV

Implement:

- Standing height.
- Crouching height.
- Sliding height.
- Smooth transitions.
- Sprint FOV.
- Settings integration.

Acceptance criteria:

- Camera height matches player posture.
- FOV changes smoothly.
- Settings apply immediately.
- No camera transform accumulation occurs.

### Phase 3 — Movement Effects

Implement:

- Running camera bob.
- Sprint camera bob.
- Jump response.
- Landing response.
- Slide response.
- Wall-run roll.
- Vault response.

Acceptance criteria:

- Effects reflect actual movement state.
- Effects return to neutral.
- Effects do not modify player physics.
- Effects can be individually disabled.

### Phase 4 — Comfort and Lifecycle

Implement:

- Reduced Motion.
- Camera settings.
- Pause behavior.
- Respawn reset.
- Scene transition recovery.
- Invalid state handling.

Acceptance criteria:

- All comfort settings work.
- Temporary effects cannot become stuck.
- Camera remains stable through lifecycle changes.

### Phase 5 — Debugging and Tuning

Implement:

- Debug overlay.
- Effect visualization.
- Movement synchronization checks.
- Sensitivity tuning.
- FOV tuning.
- Comfort testing.

Acceptance criteria:

- Camera behavior can be inspected.
- Tuning values are centralized.
- No critical camera jitter or visual instability remains.

---

## 25. Definition of Done

The Camera System is considered complete for the initial implementation when:

- [ ] First-person camera rig is implemented.
- [ ] Camera position follows the player correctly.
- [ ] Mouse look works.
- [ ] Gamepad look works when a controller is available.
- [ ] Yaw and pitch are handled correctly.
- [ ] Pitch limits are configurable.
- [ ] Sensitivity settings work.
- [ ] Invert Y works.
- [ ] Base FOV is configurable.
- [ ] Sprint FOV transition works.
- [ ] Camera height follows player posture.
- [ ] Crouching and sliding camera transitions work.
- [ ] Running camera bob works.
- [ ] Jump response works.
- [ ] Landing response works.
- [ ] Wall-run roll works.
- [ ] Effects return to neutral.
- [ ] Reduced Motion works.
- [ ] Camera settings are applied from the Settings System and persisted by the Settings System through Save System infrastructure.
- [ ] Pause and respawn behavior is correct.
- [ ] Camera does not modify movement physics.
- [ ] Camera remains stable across frame rates.
- [ ] Debug visualization is available.
- [ ] Unit and integration tests pass.

---

## 26. Final Design Constraints

The implementation agent must follow these constraints:

1. The Camera System is a presentation system, not a physics system.
2. Player movement remains authoritative for position and velocity.
3. Player look rotation must be separated from temporary camera effects.
4. Camera effects must be composed through one controlled pipeline.
5. Mouse look must not receive unnecessary frame-time scaling.
6. Gamepad look must use time-based angular rotation.
7. FOV transitions must be smooth and configurable.
8. Camera height must remain consistent with physical player posture.
9. Movement effects must be derived from actual Movement System state.
10. Temporary effects must always have a defined neutral state.
11. Camera effects must never accumulate indefinitely.
12. Reduced Motion must be supported from the initial implementation.
13. UI must remain stable and must not accidentally inherit gameplay camera effects.
14. Camera settings must be read from the Settings System, which persists them through Save System infrastructure; the Camera System must not access IndexedDB directly.
15. The same Camera System must be used in Training and Prologue.
16. Avoid excessive head bob, shake, roll, and FOV distortion.
17. Prioritize spatial readability and player comfort over cinematic effects.

The final result should deliver a responsive first-person camera that communicates speed and parkour movement while keeping the environment readable, navigation precise, and the experience comfortable during extended play sessions.