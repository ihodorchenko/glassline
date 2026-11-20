# 14_INTERACTION_SYSTEM_SPEC.md

**Project:** Glassline  
**Document:** Interaction System Specification

## 1. Purpose

This document defines the Interaction System for Glassline, a first-person parkour game inspired by the original *Mirror's Edge* (2008).

The Interaction System provides a unified way for the player to interact with objects, environmental elements, triggers, and gameplay features.

It is responsible for:

- Detecting interactable objects.
- Determining whether an interaction is available.
- Selecting the most relevant interaction target.
- Executing contextual interactions.
- Managing interaction priorities.
- Providing interaction feedback.
- Displaying contextual UI prompts.
- Supporting automatic and manual interactions.
- Communicating interaction events to other gameplay systems.
- Integrating with the Input System and UI System.

The system must remain lightweight and extensible.

It should not become a general-purpose gameplay controller or contain the implementation logic of every interactable object.

---

## 2. Design Principles

### 2.1 Contextual Interaction

The player should interact with objects using a small set of consistent controls.

The meaning of an interaction depends on the object and current gameplay context.

Examples:

- Activating a training checkpoint.
- Starting a challenge.
- Opening a door.
- Activating a terminal.
- Collecting an optional object.
- Triggering a tutorial instruction.
- Entering a finish zone.

### 2.2 Minimal UI

Interaction prompts should be concise.

The player should understand:

- What can be interacted with.
- Which action is required.
- Whether the action is currently available.

Avoid displaying prompts for every nearby object simultaneously.

### 2.3 Predictable Target Selection

When multiple interactable objects are nearby, the system must select one predictable target.

The selected target should not rapidly switch between nearby objects.

### 2.4 Separation of Responsibilities

The Interaction System discovers and coordinates interactions.

Individual objects implement their own interaction behavior.

The UI System displays interaction prompts.

The Input System provides abstract interaction input.

The Gameplay Systems determine the consequences of successful interactions.

### 2.5 Safe Execution

An interaction must be validated before execution.

The system must prevent:

- Interacting with disabled objects.
- Triggering the same interaction multiple times unintentionally.
- Executing interactions from invalid distances.
- Executing interactions after the target becomes unavailable.
- Executing gameplay actions while the game is paused.

---

## 3. Scope

### 3.1 Initial Implementation

The initial Interaction System must support:

- Interactable object registration.
- Interactable object discovery.
- Distance-based detection.
- View-direction detection.
- Target selection.
- Interaction availability checks.
- Manual interaction through the Interact action.
- Automatic trigger interactions.
- Contextual interaction prompts.
- Interaction cooldowns.
- Interaction cancellation.
- Interaction events.
- Interaction priority.
- Integration with Training Mode.
- Integration with Prologue.
- Integration with UI and Input Systems.

### 3.2 Future Features

The architecture should allow:

- Multi-step interactions.
- Hold-to-interact actions.
- Interaction progress indicators.
- Timed interactions.
- Interaction sequences.
- Context-sensitive interaction animations.
- Environmental puzzles.
- Multiplayer interaction ownership.
- Object inspection.
- Inventory-based interactions.
- Interaction history and analytics.

These features are not required for the initial implementation unless a specific gameplay requirement introduces them.

---

## 4. Interaction Architecture

### 4.1 Main Components

| Component | Responsibility |
|---|---|
| InteractionManager | Main interaction orchestration |
| InteractionDetector | Finds nearby interactable objects |
| InteractionTargetSelector | Selects the active target |
| InteractionExecutor | Validates and executes actions |
| InteractionRegistry | Tracks registered interactables |
| InteractionPromptProvider | Provides UI prompt data |
| InteractionEvents | Publishes interaction events |
| InteractionSettings | Stores interaction configuration |

### 4.2 Architecture Diagram

```text
Input System
     |
     | Interact
     v
InteractionManager
     |
     +-- InteractionDetector
     |       |
     |       +-- Distance Query
     |       +-- View Direction
     |       +-- Occlusion Check
     |
     +-- InteractionTargetSelector
     |
     +-- InteractionExecutor
     |
     +-- InteractionRegistry
     |
     +-- InteractionEvents
     |
     v
Active Interactable
     |
     +-- Availability Validation
     +-- Interaction Execution
     +-- Interaction Result
     |
     v
Gameplay Systems

InteractionManager
     |
     v
InteractionPromptProvider
     |
     v
UI System
```

### 4.3 Responsibilities

`InteractionManager` coordinates the interaction lifecycle.

`InteractionDetector` identifies potential interaction targets.

`InteractionTargetSelector` determines which target should receive player input.

`InteractionExecutor` validates the action and calls the target's interaction implementation.

`InteractionRegistry` maintains references to active interactable objects.

Individual interactables own their specific behavior.

---

## 5. Interaction Model

### 5.1 Core Interface

Every manually interactable object must implement a common interface.

```ts
interface IInteractable {
  readonly id: string;

  getInteractionInfo(
    context: InteractionContext
  ): InteractionInfo | null;

  canInteract(
    context: InteractionContext
  ): boolean;

  interact(
    context: InteractionContext
  ): InteractionResult | Promise<InteractionResult>;
}
```

The exact implementation may use synchronous execution for simple interactions and asynchronous execution for operations that require loading or external system coordination.

The interaction contract must remain consistent.

### 5.2 Interaction Context

The context provides information about the interaction request.

```ts
interface InteractionContext {
  playerId: string;

  source: InteractionSource;

  playerPosition: Vector3;
  playerForward: Vector3;

  targetPosition: Vector3;

  timestamp: number;
}
```

Possible interaction sources:

```ts
type InteractionSource =
  | "manual"
  | "automatic"
  | "scripted"
  | "system";
```

The context must not expose unnecessary internal player or system objects.

### 5.3 Interaction Information

```ts
interface InteractionInfo {
  id: string;

  title: string;
  description?: string;

  actionLabel: string;
  inputAction: string;

  priority: number;

  maxDistance: number;

  requiresLineOfSight: boolean;

  holdDuration?: number;
}
```

The initial implementation should primarily use instant interactions.

`holdDuration` is reserved for future support unless explicitly required.

### 5.4 Interaction Result

```ts
interface InteractionResult {
  success: boolean;

  reason?: InteractionFailureReason;

  message?: string;

  closePrompt?: boolean;
}
```

Possible failure reasons:

```ts
type InteractionFailureReason =
  | "unavailable"
  | "out_of_range"
  | "blocked"
  | "invalid_state"
  | "cooldown"
  | "cancelled"
  | "execution_failed";
```

A failed interaction must not be treated as a successful gameplay action.

---

## 6. Interaction Categories

The system should distinguish between different interaction behaviors.

### 6.1 Manual Interactions

Require explicit player input.

Examples:

- Activating a terminal.
- Opening a door.
- Starting a training activity.
- Activating a challenge.
- Interacting with a checkpoint.

Manual interactions use the abstract `Interact` input action.

### 6.2 Automatic Interactions

Execute when the player enters a valid trigger or interaction region.

Examples:

- Entering a finish zone.
- Activating a section transition.
- Entering a tutorial trigger.
- Starting a scripted sequence.

Automatic interactions must not require the player to press Interact.

### 6.3 Scripted Interactions

Triggered by another gameplay system.

Examples:

- Activating a door after completing a challenge.
- Showing a tutorial message after a movement action.
- Starting a scripted environmental event.

Scripted interactions should still use the interaction contract where practical, but they do not require target selection or player input.

### 6.4 System Interactions

Used internally by gameplay systems.

These interactions may bypass player-facing UI but must still validate their execution conditions.

---

## 7. Detection System

### 7.1 Detection Requirements

The detector must identify relevant interactables near the player.

Detection should consider:

- Maximum interaction distance.
- Player view direction.
- Object visibility.
- Object availability.
- Object interaction priority.
- Current gameplay state.

### 7.2 Detection Methods

Use a combination of:

1. Spatial distance query.
2. View direction test.
3. Line-of-sight test.
4. Interaction availability validation.

Do not rely exclusively on a single forward raycast.

A single raycast can miss objects that are slightly outside the camera center or have irregular collision geometry.

### 7.3 Detection Range

The initial implementation has no separate global detection range: each
interactable is authored with its own `radius`, and range validation compares
the player distance against that per-target radius only.

Example (level content): the Prologue terminal uses `radius: 2.5` m.

A global detection range may be introduced later as a cap:

```text
effectiveRange = min(
    globalDetectionRange,
    interactableMaxDistance
)
```

Some special objects may use a separately configured range if the design explicitly requires it.

### 7.4 View Direction

The system should prioritize objects that are near the center of the player's view.

Calculate the normalized direction from the camera to the interaction target.

Compare it with the camera forward vector.

```text
viewAlignment = dot(
    cameraForward,
    directionToTarget
)
```

A higher alignment value indicates that the target is closer to the center of the view.

The system should use a configurable minimum alignment threshold.

### 7.5 Line of Sight

For interactables that require visibility, perform an occlusion check.

The check should ignore:

- The player collider.
- Non-blocking trigger volumes.
- Decorative objects configured as non-occluding.
- The target's own collision geometry when appropriate.

A target behind a solid wall should not normally be selectable.

### 7.6 Detection Frequency

Detection does not need to run at the rendering frame rate.

Recommended initial frequency:

```text
interactionDetectionRate = 10 Hz
```

The system may refresh immediately when:

- The player moves significantly.
- The camera rotates significantly.
- The active target becomes invalid.
- An interactable is registered or removed.
- An interaction completes.

Detection should remain responsive without performing unnecessary spatial queries.

---

## 8. Target Selection

### 8.1 Selection Criteria

The target selector evaluates valid candidates using:

- Distance.
- View alignment.
- Interaction priority.
- Availability.
- Visibility.

### 8.2 Selection Score

A configurable scoring function may be used.

Conceptually:

```text
score =
    viewAlignment * viewWeight
    + distanceScore * distanceWeight
    + priorityScore * priorityWeight
```

Higher scores are preferred.

The scoring function must be deterministic.

### 8.3 Priority

Some interactions should take precedence over others.

Example:

| Interaction | Suggested Priority |
|---|---:|
| Critical gameplay object | 100 |
| Checkpoint | 90 |
| Training terminal | 80 |
| Door | 60 |
| Optional collectible | 40 |
| Decorative interaction | 10 |

Priority values are configurable.

### 8.4 Target Stability

The active target should not switch rapidly between two similarly scored candidates.

Implement target hysteresis.

For example:

- Keep the current target if it remains valid.
- Switch only when another candidate is meaningfully better.
- Switch immediately if the current target becomes invalid.

Initial suggested hysteresis threshold:

```text
targetSwitchThreshold = 0.15
```

This value should be tuned during gameplay testing.

### 8.5 Target Lifecycle

The active target may change when:

- The player moves out of range.
- The player looks away.
- The target becomes unavailable.
- The target is destroyed.
- The target is disabled.
- Another candidate becomes significantly more relevant.

The system must clear stale target references safely.

---

## 9. Interaction Execution

### 9.1 Execution Flow

When the player presses Interact:

1. Read the current active target.
2. Confirm that the target still exists.
3. Validate the player's gameplay state.
4. Validate distance.
5. Validate line of sight if required.
6. Call `canInteract`.
7. Execute the interaction.
8. Process the interaction result.
9. Publish interaction events.
10. Refresh the active target and prompt.

### 9.2 Validation

Validation must happen at execution time.

A target that was valid during the previous detection update may become invalid before the player presses Interact.

Do not rely exclusively on cached detection results.

### 9.3 Duplicate Execution

The same interaction must not execute repeatedly from a single input press.

Use an execution lock or per-target cooldown where necessary.

For asynchronous interactions:

- Mark the interaction as executing.
- Reject duplicate requests.
- Release the lock when execution completes or fails.
- Handle cancellation and object destruction safely.

### 9.4 Interaction Cooldown

Initial global cooldown (implemented default in `InteractionSystem`):

```text
interactionCooldown = 0.6 seconds
```

The initial implementation uses a single system-wide cooldown. Per-target
cooldowns remain an extension point; individual interactables may define their
own cooldown when that is introduced.

Cooldowns should prevent accidental repeated activation without making interaction feel sluggish.

### 9.5 Asynchronous Execution

Some interactions may require asynchronous operations.

Examples:

- Loading a challenge.
- Opening a level transition.
- Initializing a training activity.

The Interaction System must not block the rendering or physics loop while waiting.

If an asynchronous operation fails:

- Clear execution state.
- Restore valid prompt behavior.
- Report the failure through the interaction result.
- Avoid leaving the target permanently locked.

---

## 10. Automatic Trigger Interactions

### 10.1 Trigger Requirements

Automatic interactions are based on spatial trigger regions.

They should be used for:

- Finish zones.
- Section transitions.
- Tutorial activation.
- Scripted gameplay events.

### 10.2 Trigger Lifecycle

```text
NotInside
    |
    | Enter trigger
    v
Inside
    |
    | Conditions satisfied
    v
Activated
    |
    | Exit or reset
    v
NotInside
```

An automatic trigger must define whether it is:

- Repeatable.
- One-time.
- Resettable.
- Active only in specific gameplay modes.

### 10.3 Duplicate Trigger Prevention

A trigger must not activate repeatedly while the player remains inside it unless repeated activation is explicitly intended.

Use an activation state or cooldown.

### 10.4 Trigger Exit

On exit:

- Update the trigger state.
- Clear temporary references.
- Reset repeatable triggers when appropriate.

Do not automatically reverse a completed gameplay action simply because the player exits the trigger.

---

## 11. Interaction Prompts

### 11.1 Purpose

Interaction prompts provide contextual information about the active target.

The prompt must be concise and visually consistent with the minimalistic UI style defined in `07_UI_UX_SPEC.md`.

### 11.2 Prompt Content

A prompt may contain:

- Object title.
- Action label.
- Input icon or key label.
- Optional short description.

Example:

```text
ACTIVATE TRAINING

[E] Interact
```

Another example:

```text
OPEN DOOR

[E] Open
```

### 11.3 Prompt Visibility

Show the prompt when:

- A valid target is selected.
- The target is available.
- The player is allowed to interact.
- The relevant UI context is active.

Hide the prompt when:

- No valid target exists.
- The target is unavailable.
- The player leaves the interaction range.
- The gameplay is paused.
- A blocking dialog or menu is active.
- The target is destroyed.

### 11.4 Prompt Updates

When the active target changes:

- Update prompt content.
- Use a subtle transition.
- Avoid unnecessary full UI reconstruction.
- Prevent flickering during target hysteresis.

### 11.5 Input Labels

The UI should display the correct input representation.

Examples:

- Keyboard: `E`
- Gamepad: controller-specific Interact icon.

The Interaction System should provide the abstract input action identifier.

The UI System should resolve the actual device-specific icon or label.

### 11.6 Unavailable Interactions

The initial implementation may hide unavailable interactions.

If an interaction is important to gameplay, it may display a disabled prompt with a short reason.

Examples:

```text
CHECKPOINT

Unavailable
```

```text
TRAINING TERMINAL

Complete the previous exercise
```

Do not expose internal error messages to the player.

---

## 12. Interaction Registration

### 12.1 Registry

Interactable objects must register themselves with the Interaction Registry when they become active.

They must unregister when destroyed or disabled.

Conceptual interface:

```ts
interface InteractionRegistry {
  register(interactable: IInteractable): void;

  unregister(interactableId: string): void;

  getNearby(
    position: Vector3,
    radius: number
  ): IInteractable[];
}
```

### 12.2 Registration Lifecycle

Registration should follow object lifecycle.

Do not keep references to destroyed objects.

The registry must handle duplicate registration safely.

### 12.3 Spatial Filtering

For small scenes, a simple collection with distance filtering may be sufficient.

For larger procedural environments, use a spatial partitioning structure.

Possible implementations:

- Spatial grid.
- Uniform grid.
- Spatial hash.
- Existing engine spatial query system.

The initial implementation should choose the simplest approach that meets performance requirements.

### 12.4 Dynamic Objects

Interactables may be created or removed at runtime.

The registry must update without requiring a complete scene scan.

Procedural generation systems should register interactables as part of object creation.

---

## 13. Interactable Object Types

The initial game should provide a small set of reusable interaction types.

### 13.1 Generic Interactable

Base implementation for simple interactions.

It provides:

- ID.
- Interaction information.
- Availability.
- Execution callback.
- Optional cooldown.

### 13.2 Training Terminal

Used to start or access training activities.

Responsibilities:

- Identify the associated training activity.
- Validate training availability.
- Request the Training System to start the activity.
- Report success or failure.

The terminal must not implement training mechanics itself.

### 13.3 Checkpoint Interactable

Used to activate or confirm a checkpoint where manual activation is required.

Responsibilities:

- Identify the checkpoint.
- Validate whether activation is allowed.
- Notify the Checkpoint or Speedrun System.
- Provide feedback.

Checkpoint progression rules remain owned by the relevant gameplay system.

### 13.4 Door Interactable

Used for simple door interactions.

Responsibilities:

- Validate current door state.
- Request opening or closing.
- Report the resulting state.
- Provide appropriate prompt labels.

Door animation and physical behavior belong to the door object or environmental system.

### 13.5 Collectible Interactable

Used for optional collectible objects.

Responsibilities:

- Validate that the collectible has not already been collected.
- Notify the Progress System.
- Trigger visual feedback.
- Prevent duplicate collection.

### 13.6 Finish Zone

The finish zone is normally an automatic trigger rather than a manual interaction.

Responsibilities:

- Detect valid player entry.
- Validate current run state.
- Notify Speedrun System.
- Prevent duplicate finish events.

The official run completion rules remain owned by the Speedrun System.

---

## 14. Interaction and Movement Integration

The Interaction System consumes player position and camera direction.

It does not control movement.

### 14.1 Required Data

```ts
interface InteractionPlayerState {
  position: Vector3;
  forward: Vector3;
  cameraPosition: Vector3;
  cameraForward: Vector3;

  isGrounded: boolean;
  movementState: MovementState;

  isAlive: boolean;
  canInteract: boolean;
}
```

The exact model may be reduced to the fields actually needed.

### 14.2 Movement Restrictions

Some interactions may be unavailable during:

- Vaulting.
- Wall running.
- Sliding.
- Falling.
- Respawn.
- Forced movement.

The Interaction System should use explicit gameplay state restrictions.

Avoid hardcoding movement state checks for every object.

An interaction policy should define which movement states permit interaction.

### 14.3 Player Movement During Interaction

For the initial implementation, most interactions should not stop player movement.

If an interaction requires movement to stop, the owning gameplay system must explicitly request that behavior through the appropriate movement interface.

The Interaction System must not directly freeze the player.

---

## 15. Interaction and Input Integration

The Interaction System consumes the abstract `Interact` action from `11_INPUT_SYSTEM_SPEC.md`.

It must not read raw keyboard or gamepad events.

### 15.1 Input Behavior

When the Interact action is pressed:

- Request execution of the current valid target.
- Ignore repeated input while execution is locked.
- Respect the active Input Context.
- Avoid execution while UI navigation owns the input.

### 15.2 Input Contexts

Interaction input should normally be active in Gameplay context.

It should be disabled or redirected when:

- Main Menu is active.
- Pause Menu is active.
- Settings are open.
- A blocking dialog is active.
- Results UI owns the input.

### 15.3 Hold Interactions

The architecture should allow future hold-to-interact actions.

The initial implementation only needs instant interactions.

If hold interactions are added later, progress tracking should be separated from the basic interaction executor.

---

## 16. Interaction and UI Integration

The Interaction System provides presentation data.

The UI System decides how that information is displayed.

Conceptual interface:

```ts
interface InteractionPromptData {
  targetId: string;

  title: string;
  description?: string;

  actionLabel: string;
  inputAction: string;

  isAvailable: boolean;
}
```

The UI System should subscribe to changes in the active prompt rather than polling the Interaction Manager continuously.

### 16.1 Prompt Events

Publish:

- `interactionTargetChanged`
- `interactionPromptUpdated`
- `interactionPromptHidden`

### 16.2 Execution Feedback

Publish:

- `interactionStarted`
- `interactionCompleted`
- `interactionFailed`

The UI may use these events to provide subtle visual feedback.

---

## 17. Interaction and Gameplay Systems

The Interaction System must coordinate with gameplay systems through explicit interfaces.

### 17.1 Training System

Training terminals request training activity activation.

The Training System validates and owns activity progression.

### 17.2 Speedrun System

Checkpoint interactions notify the Speedrun System.

The Speedrun System validates checkpoint order and timing.

The Interaction System must not directly update run time or leaderboard records.

### 17.3 Progress System

Collectibles and persistent world interactions notify the Progress System.

The Progress System owns persistence and completion rules.

### 17.4 Level System

Doors, terminals, and scripted objects may request level or section transitions.

The Level System owns loading and transition behavior.

### 17.5 Tutorial System

Interactions may trigger tutorial messages.

The Tutorial System owns tutorial progression and presentation rules.

---

## 18. Interaction Events

Use a consistent event model.

Suggested events:

```ts
type InteractionEvent =
  | "interactionTargetChanged"
  | "interactionStarted"
  | "interactionCompleted"
  | "interactionFailed"
  | "interactionCancelled"
  | "interactionPromptUpdated"
  | "interactionPromptHidden"
  | "interactionTriggerEntered"
  | "interactionTriggerExited";
```

Event data should include:

```ts
interface InteractionEventData {
  targetId?: string;

  interactionId?: string;

  source: InteractionSource;

  timestamp: number;

  result?: InteractionResult;
}
```

Events must be emitted after the relevant state change has been committed.

Avoid publishing success before an asynchronous interaction has actually completed.

---

## 19. Interaction Configuration

All shared interaction parameters should be centralized.

Example:

```ts
interface InteractionSettings {
  detectionRange: number;

  detectionRate: number;

  minimumViewAlignment: number;

  targetSwitchThreshold: number;

  defaultInteractionCooldown: number;

  defaultRequiresLineOfSight: boolean;

  allowInteractionDuringAirborne: boolean;

  allowInteractionDuringSliding: boolean;
}
```

Object-specific parameters should remain part of the individual interactable configuration.

The system should support different profiles if future gameplay modes require different interaction behavior.

---

## 20. Performance Requirements

The Interaction System must remain lightweight.

Requirements:

- Avoid scanning the entire scene every frame.
- Use spatial filtering.
- Avoid unnecessary raycasts.
- Reuse temporary vectors and query objects where practical.
- Limit candidate validation to nearby objects.
- Avoid unnecessary UI updates.
- Cache interaction information while the target remains unchanged.
- Clean up destroyed interactable references.
- Avoid creating new event subscriptions during every detection cycle.

For the initial level size, a simple spatial query is preferable to premature complex optimization.

---

## 21. Error Handling and Recovery

The system must handle invalid interaction states safely.

Examples:

- Target destroyed during execution.
- Target becomes unavailable.
- Target moves outside interaction range.
- Target becomes occluded.
- Asynchronous interaction fails.
- Interaction callback throws an error.
- Duplicate registration.
- Duplicate execution request.
- Scene transition during interaction.
- Player respawn during interaction.

Recovery behavior:

1. Stop invalid execution.
2. Release execution locks.
3. Clear stale target references.
4. Restore valid prompt state.
5. Report a controlled failure.
6. Avoid leaving the Interaction System in a blocked state.

A failed interaction must not crash the gameplay loop.

---

## 22. Debugging and Visualization

The Interaction System must provide a debug mode.

Debug visualization should include:

- Detection range.
- Current active target.
- Nearby candidates.
- Candidate scores.
- View alignment.
- Distance to target.
- Line-of-sight result.
- Target priority.
- Interaction availability.
- Execution state.
- Cooldown state.
- Trigger activation state.

Example:

```text
INTERACTION DEBUG

Active Target: TrainingTerminal_01

Distance: 2.1 m
View Alignment: 0.94
Priority: 80

Line Of Sight: VALID
Available: YES
Executing: NO

Candidates:
  Checkpoint_02       0.87
  TrainingTerminal_01 0.94
  Door_01             0.71
```

Debug mode should be disabled in production builds unless explicitly enabled.

---

## 23. Testing Requirements

### 23.1 Unit Tests

Test:

- Interaction range validation.
- View alignment calculation.
- Target scoring.
- Target priority.
- Target hysteresis.
- Availability validation.
- Cooldown behavior.
- Execution lock behavior.
- Interaction result handling.
- Trigger activation state.
- Registry registration and removal.

### 23.2 Integration Tests

Test:

- Selecting a single nearby object.
- Selecting between multiple objects.
- Switching targets while moving.
- Switching targets while looking around.
- Interaction with occluded objects.
- Interaction at maximum range.
- Interaction after target destruction.
- Interaction during invalid movement states.
- Automatic trigger activation.
- Asynchronous interaction completion.
- Asynchronous interaction failure.
- Input context changes.
- Prompt visibility and updates.

### 23.3 Regression Tests

The following scenarios must be tested repeatedly:

- Two interactables positioned very close together.
- An interactable behind a wall.
- An interactable moving during detection.
- An interactable disappearing during execution.
- Player rapidly rotating the camera.
- Player entering and leaving a trigger repeatedly.
- Player pressing Interact repeatedly.
- Player opening a menu while an interaction is available.
- Player respawning while an interaction is executing.
- Level transition during asynchronous interaction.

### 23.4 Gameplay Tests

Test interactions in:

- Training Mode.
- Prologue Rooftop.
- Prologue Industrial.
- Prologue Construction.
- Prologue Skybridge.
- Prologue Finish.

Verify that interaction prompts do not interfere with movement, route readability, or Speedrun HUD.

---

## 24. Implementation Phases

### Phase 1 — Interaction Foundation

Implement:

- `IInteractable`.
- Interaction Registry.
- Interaction Detector.
- Distance validation.
- View direction validation.
- Basic target selection.

Acceptance criteria:

- Interactables register and unregister correctly.
- Nearby targets are detected.
- Invalid targets are rejected.
- Target selection is deterministic.

### Phase 2 — Manual Interaction

Implement:

- Interact input integration.
- Interaction validation.
- Interaction execution.
- Cooldowns.
- Execution locking.
- Interaction results.
- Interaction events.

Acceptance criteria:

- The player can activate valid objects.
- Invalid interactions are rejected.
- Duplicate execution is prevented.
- Failures do not block future interactions.

### Phase 3 — Interaction Prompts

Implement:

- Prompt data provider.
- Active target UI.
- Input action labels.
- Prompt transitions.
- Prompt visibility rules.

Acceptance criteria:

- Correct prompt is displayed.
- Prompt changes when the target changes.
- Prompt disappears when no target is available.
- UI does not flicker between nearby targets.

### Phase 4 — Automatic Interactions

Implement:

- Trigger registration.
- Trigger lifecycle.
- One-time activation.
- Repeatable activation.
- Automatic gameplay events.

Acceptance criteria:

- Trigger events fire reliably.
- Duplicate activation is prevented.
- Trigger state resets correctly.
- Finish zones can notify Speedrun System.

### Phase 5 — Gameplay Integration

Implement:

- Training terminals.
- Checkpoint interactions where required.
- Doors.
- Collectibles.
- Finish zone integration.
- Tutorial event integration.

Acceptance criteria:

- Interactable objects use shared interfaces.
- Gameplay logic remains in owning systems.
- Training and Prologue use the same interaction infrastructure.

### Phase 6 — Debugging and Optimization

Implement:

- Debug visualization.
- Candidate scoring display.
- Spatial filtering.
- Performance checks.
- Error recovery.

Acceptance criteria:

- Interaction behavior is inspectable.
- No unnecessary full-scene scans occur.
- Destroyed objects do not remain registered.
- No critical interaction lock or prompt state issues remain.

---

## 25. Definition of Done

The Interaction System is considered complete for the initial implementation when:

- [ ] Common interactable interface is implemented.
- [ ] Interactable registration works.
- [ ] Interactable removal works.
- [ ] Nearby object detection works.
- [ ] Distance validation works.
- [ ] View direction validation works.
- [ ] Line-of-sight validation works.
- [ ] Target priority works.
- [ ] Target hysteresis prevents flickering.
- [ ] Manual interaction works.
- [ ] Interaction availability is validated.
- [ ] Duplicate execution is prevented.
- [ ] Cooldowns work.
- [ ] Interaction results are handled.
- [ ] Automatic triggers work.
- [ ] Interaction prompts work.
- [ ] Input labels adapt to active device.
- [ ] UI integration works.
- [ ] Training integration works.
- [ ] Speedrun checkpoint integration works.
- [ ] Finish zone integration works.
- [ ] Error recovery works.
- [ ] Debug visualization is available.
- [ ] Unit and integration tests pass.

---

## 26. Final Design Constraints

The implementation agent must follow these constraints:

1. Use a shared interaction contract for manually interactable objects.
2. Keep object-specific gameplay logic inside the object or its owning gameplay system.
3. Separate detection, target selection, validation, and execution.
4. Validate interactions again immediately before execution.
5. Use deterministic target selection.
6. Prevent rapid target switching through hysteresis.
7. Do not rely exclusively on a single forward raycast.
8. Prevent duplicate execution.
9. Support asynchronous interactions without blocking gameplay.
10. Keep automatic triggers separate from manual interaction input.
11. Keep UI presentation outside the Interaction System.
12. Do not access raw keyboard or gamepad events.
13. Do not directly modify player movement.
14. Do not directly modify Speedrun timing or persistent progress.
15. Use explicit events and interfaces to communicate with gameplay systems.
16. Remove stale object references safely.
17. Keep detection and validation efficient.
18. Prioritize predictable behavior and clear player feedback over unnecessary interaction complexity.

The final result should provide a consistent interaction layer that allows the player to engage with the environment without interrupting the fast, fluid parkour experience.