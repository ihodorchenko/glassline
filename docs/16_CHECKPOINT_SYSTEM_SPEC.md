# 16_CHECKPOINT_SYSTEM_SPEC.md

# Checkpoint System Specification

## 1. Purpose

The Checkpoint System manages checkpoint availability, activation, player progress, and respawn coordination.

It provides a consistent mechanism for recording meaningful progress through a level and restoring the player to an appropriate location after failure or restart.

The system must support:

- Training checkpoints.
- Prologue checkpoints.
- Speedrun checkpoint integration.
- Checkpoint activation feedback.
- Respawn point resolution.
- Checkpoint progress tracking.
- Session-scoped checkpoint state.
- Checkpoint reset and invalidation.
- Integration with Level Runtime and Movement Systems.

The system must work independently of the rendering engine and must not own player physics or speedrun timing.

## 2. Core Design Principles

### 2.1 Single Responsibility

The Checkpoint System owns checkpoint gameplay state.

It does not own:

- Level geometry.
- Section transitions.
- Player movement physics.
- Interaction detection.
- Speedrun timing.
- Speedrun checkpoint sequence validation.
- Leaderboard records.
- Persistent application storage.
- Camera presentation.
- UI rendering.

### 2.2 Checkpoint and Respawn Separation

A checkpoint represents a recorded progress location.

A respawn point represents a transform where the player can be placed.

These concepts are related but are not interchangeable.

A checkpoint references a spawn point managed by Level Runtime.

The Checkpoint System decides which checkpoint should be used. Level Runtime resolves and validates the actual spawn transform.

### 2.3 Deterministic Behavior

Checkpoint selection must be deterministic.

The same session state and the same checkpoint activation sequence must produce the same active checkpoint.

The system must not depend on object loading order, frame rate, or rendering timing.

### 2.4 Explicit Ownership

Each system owns its own state:

| System | Responsibility |
|---|---|
| Checkpoint System | Checkpoint activation and progress state |
| Level Runtime | Spawn point availability and player placement coordination |
| Speedrun System | Required checkpoint order and run validation |
| Movement System | Physics state and movement reset |
| Interaction System | Detection and execution of manual interactions |
| Save System | Persistence infrastructure |
| UI System | Checkpoint feedback and respawn presentation |
| Audio System | Checkpoint and respawn sound behavior |

## 3. Initial Implementation Scope

### 3.1 Required Modes

The initial implementation must support:

**Training**
- Training-specific checkpoint activation.
- Exercise restart points.
- Respawn at the most recently activated valid checkpoint.
- Resetting checkpoint progress when an exercise or session restarts.

**Prologue**
- Five mandatory checkpoint locations.
- Checkpoints associated with the five Prologue sections.
- Progress tracking throughout one Prologue session.
- Respawn at the most recently activated valid checkpoint.
- Integration with Speedrun checkpoint events.
- Checkpoint progress reset when a new run begins.

The exact checkpoint IDs must be stable and defined in the level content.

### 3.2 Initial Checkpoint Behavior

For the initial implementation:

- Checkpoints are activated when the player enters their valid activation area.
- A checkpoint can be activated only when it belongs to the current level session.
- Re-entering an already activated checkpoint must not create duplicate progress.
- Activating a checkpoint updates the current respawn checkpoint.
- Checkpoint activation is confirmed only after the referenced spawn point is validated.
- Checkpoint progress is scoped to a LevelSession.
- A new session starts with a clean checkpoint state.

### 3.3 Future Features

The following features are outside the initial implementation:

- Multiple checkpoint branches.
- Optional checkpoints.
- Checkpoint selection menus.
- Persistent world-state restoration.
- Network-synchronized checkpoints.
- Competitive multiplayer checkpoint validation.
- Advanced checkpoint rollback.
- Dynamic checkpoint creation during gameplay.
- Checkpoint history visualization.
- Ghost Replay checkpoint annotations.

Architecture should allow these features without requiring changes to the basic checkpoint contract.

## 4. Terminology

| Term | Meaning |
|---|---|
| Checkpoint | A gameplay progress marker |
| Checkpoint Definition | Static configuration for a checkpoint |
| Checkpoint Instance | Runtime representation of a checkpoint |
| Activation | Recording player progress at a checkpoint |
| Active Checkpoint | The checkpoint currently selected for respawn |
| Checkpoint History | Ordered list of activated checkpoints |
| Respawn | Restoring the player to a valid spawn location |
| Checkpoint Sequence | Expected progression order owned by Speedrun |
| Spawn Point | A Level Runtime location used to place the player |

## 5. Architecture Overview

The system consists of:

| Component | Responsibility |
|---|---|
| CheckpointManager | Coordinates checkpoint operations |
| CheckpointRegistry | Stores registered checkpoint definitions and instances |
| CheckpointActivator | Processes activation requests |
| CheckpointProgressTracker | Tracks session checkpoint progress |
| RespawnCoordinator | Coordinates player respawn |
| CheckpointValidator | Validates checkpoint configuration and requests |
| CheckpointEvents | Publishes checkpoint lifecycle events |
| CheckpointFeedbackProvider | Produces presentation data for UI and Audio |
| CheckpointPersistenceAdapter | Optional integration with persistence infrastructure |

### 5.1 High-Level Architecture

```text
Level Runtime
     |
     +-- Checkpoint Definitions
     |
     v
CheckpointManager
     |
     +-- CheckpointRegistry
     |
     +-- CheckpointActivator
     |
     +-- CheckpointProgressTracker
     |
     +-- CheckpointValidator
     |
     +-- RespawnCoordinator
     |
     +-- CheckpointEvents
     |
     +-- CheckpointFeedbackProvider
     |
     v
External Systems
     |
     +-- Speedrun System
     +-- Movement System
     +-- Interaction System
     +-- UI System
     +-- Audio System
     +-- Save System
```

## 6. Checkpoint Data Models

### 6.1 CheckpointDefinition

Defines a checkpoint in level content.

```ts
interface CheckpointDefinition {
    id: string;

    levelId: string;

    sectionId: string;

    spawnPointId: string;

    displayName: string;

    order?: number;

    activationMode: CheckpointActivationMode;

    enabled: boolean;

    repeatable: boolean;

    respawnEnabled: boolean;

    metadata?: Record<string, unknown>;
}
```

```ts
type CheckpointActivationMode =
    | "automatic"
    | "interaction"
    | "scripted";
```

`order` is optional because not every checkpoint needs a globally meaningful order.

For Speedrun checkpoints, the required sequence is defined by the Speedrun System.

### 6.2 CheckpointRuntime

```ts
interface CheckpointRuntime {
    id: string;

    definition: CheckpointDefinition;

    state: CheckpointRuntimeState;

    activatedAt?: number;

    activationCount: number;

    lastActivatedSessionId?: string;
}
```

```ts
type CheckpointRuntimeState =
    | "registered"
    | "available"
    | "activated"
    | "disabled"
    | "invalid";
```

The runtime state must be derived from explicit lifecycle operations.

Do not use visual appearance as the source of truth.

### 6.3 CheckpointProgress

```ts
interface CheckpointProgress {
    sessionId: string;

    levelId: string;

    activeCheckpointId: string | null;

    activatedCheckpointIds: string[];

    activationHistory: CheckpointActivationRecord[];

    updatedAt: number;
}
```

```ts
interface CheckpointActivationRecord {
    checkpointId: string;

    sectionId: string;

    activatedAt: number;

    activationIndex: number;
}
```

Activation history records actual activation events.

It must not be treated as proof that a Speedrun run followed the required route.

### 6.4 RespawnRequest

```ts
interface RespawnRequest {
    sessionId: string;

    reason: RespawnReason;

    preferredCheckpointId?: string;

    fallbackSpawnPointId?: string;

    resetMovementState: boolean;

    resetCameraEffects: boolean;
}
```

```ts
type RespawnReason =
    | "fall"
    | "manual-restart"
    | "training-restart"
    | "scripted"
    | "recovery";
```

### 6.5 RespawnResult

```ts
interface RespawnResult {
    success: boolean;

    checkpointId?: string;

    spawnPointId?: string;

    position?: Vector3;

    rotation?: Vector3;

    reason?: string;
}
```

## 7. CheckpointManager

### 7.1 Purpose

CheckpointManager is the public entry point for checkpoint operations.

It coordinates registration, activation, progress tracking, and respawn requests.

### 7.2 Interface

```ts
interface ICheckpointManager {
    initializeSession(
        session: LevelSession,
        definitions: CheckpointDefinition[]
    ): Promise<void>;

    activateCheckpoint(
        checkpointId: string,
        context: CheckpointActivationContext
    ): Promise<CheckpointActivationResult>;

    getActiveCheckpoint(): CheckpointRuntime | null;

    getCheckpoint(
        checkpointId: string
    ): CheckpointRuntime | null;

    getProgress(): CheckpointProgress | null;

    requestRespawn(
        request: RespawnRequest
    ): Promise<RespawnResult>;

    resetProgress(): void;

    disableCheckpoint(checkpointId: string): void;

    disposeSession(sessionId: string): Promise<void>;
}
```

### 7.3 Lifecycle

CheckpointManager must be initialized after Level Runtime has created the session and made required checkpoint spawn points available.

Expected lifecycle:

```text
Level Session Created
       |
       v
Checkpoint Definitions Loaded
       |
       v
Checkpoint Validation
       |
       v
Checkpoint Registration
       |
       v
Progress Initialized
       |
       v
Checkpoint System Ready
       |
       v
Gameplay
       |
       v
Session Disposal
```

The manager must reject operations for an unknown or disposed session.

## 8. CheckpointRegistry

### 8.1 Purpose

Stores checkpoint runtime objects for the active session.

### 8.2 Interface

```ts
interface ICheckpointRegistry {
    register(
        definition: CheckpointDefinition
    ): void;

    unregister(checkpointId: string): void;

    get(
        checkpointId: string
    ): CheckpointRuntime | null;

    getBySection(
        sectionId: string
    ): CheckpointRuntime[];

    getAll(): CheckpointRuntime[];

    clear(): void;
}
```

### 8.3 Registration Rules

- Checkpoint IDs must be unique within a level session.
- Each checkpoint must reference an existing section.
- Each checkpoint must reference a valid spawn point.
- A checkpoint must belong to the active level.
- Disabled checkpoints must not be activated.
- Invalid definitions must be reported before gameplay.
- Unregistered checkpoints must not remain in progress as valid respawn targets.

The registry must not own trigger collision detection.

Level Runtime and TriggerManager provide spatial activation signals.

## 9. Checkpoint Activation

### 9.1 Activation Sources

The system supports three activation sources.

**Automatic**

The player enters the checkpoint activation area.

**Interaction**

The player activates the checkpoint through the Interaction System.

**Scripted**

A gameplay system explicitly requests checkpoint activation.

The initial Prologue checkpoints should use automatic activation unless the level design explicitly requires another behavior.

### 9.2 Activation Context

```ts
interface CheckpointActivationContext {
    sessionId: string;

    source: "trigger" | "interaction" | "scripted";

    actorId: string;

    timestamp: number;
}
```

### 9.3 Activation Result

```ts
interface CheckpointActivationResult {
    success: boolean;

    checkpointId: string;

    newlyActivated: boolean;

    isCurrentRespawnCheckpoint: boolean;

    reason?: CheckpointActivationFailureReason;
}
```

```ts
type CheckpointActivationFailureReason =
    | "checkpoint-not-found"
    | "checkpoint-disabled"
    | "invalid-session"
    | "invalid-spawn-point"
    | "already-activated"
    | "activation-rejected"
    | "activation-in-progress";
```

### 9.4 Activation Sequence

1. Receive activation request.
2. Validate session ID.
3. Resolve checkpoint definition.
4. Verify checkpoint is enabled.
5. Verify checkpoint belongs to the active level.
6. Validate referenced spawn point through Level Runtime.
7. Verify activation policy.
8. Check whether the checkpoint is already activated.
9. Record activation.
10. Update active respawn checkpoint when eligible.
11. Publish activation events.
12. Produce feedback data for UI and Audio.

The active checkpoint must not change until its spawn point has been validated.

### 9.5 Duplicate Activation

Repeated activation requests must be safe.

For a non-repeatable checkpoint:

- The first valid activation records progress.
- Subsequent activations do not create additional progress records.
- The active checkpoint remains unchanged unless an explicit policy permits otherwise.
- No duplicate activation feedback should be generated.

For a repeatable checkpoint:

- Activation count may increase.
- Activation history may record repeated activations.
- The checkpoint may become the active respawn checkpoint again.

The default for Prologue checkpoints is non-repeatable.

### 9.6 Atomicity

Checkpoint activation must behave as one logical operation.

If progress cannot be committed, the active checkpoint must not change.

If a later feedback subscriber fails, the checkpoint activation must remain valid. Presentation failures must not roll back committed gameplay progress.

## 10. Active Checkpoint Selection

### 10.1 Purpose

The active checkpoint is the preferred location for the next respawn.

It is not necessarily the last checkpoint whose trigger was physically entered if that checkpoint failed validation or is not eligible for respawn.

### 10.2 Selection Rules

The default selection rule is:

- Select the most recently successfully activated checkpoint with `respawnEnabled = true`.
- Ignore disabled checkpoints.
- Ignore checkpoints belonging to another session.
- Ignore checkpoints whose spawn points are unavailable.
- Use the configured fallback if no valid checkpoint exists.

### 10.3 Initial Spawn

The initial player spawn is not automatically considered an activated checkpoint.

The Level Runtime System owns initial spawn resolution.

A level may explicitly define its initial spawn as a checkpoint if required by its gameplay design.

### 10.4 Checkpoint Invalidation

When the active checkpoint becomes unavailable:

1. Mark it invalid or disabled.
2. Resolve the previous valid checkpoint from activation history.
3. If no valid checkpoint exists, use the configured fallback spawn.
4. Publish an active checkpoint change event.

The system must not silently select a checkpoint from another level session.

## 11. RespawnCoordinator

### 11.1 Purpose

Coordinates respawn operations across Level Runtime, Movement, and Camera Systems.

It does not implement player physics.

### 11.2 Interface

```ts
interface IRespawnCoordinator {
    respawn(
        request: RespawnRequest
    ): Promise<RespawnResult>;

    canRespawn(
        sessionId: string
    ): boolean;

    cancelRespawn(): void;

    isRespawning(): boolean;
}
```

### 11.3 Respawn Sequence

1. Validate the active session.
2. Confirm respawn is allowed.
3. Prevent overlapping respawn operations.
4. Resolve the preferred checkpoint.
5. Resolve the corresponding spawn point through Level Runtime.
6. Validate the destination.
7. Temporarily suspend player control through the appropriate gameplay coordinator.
8. Request player placement through the Movement/Player adapter.
9. Reset movement state.
10. Reset transient camera effects when requested.
11. Restore valid player control.
12. Publish respawn completion.
13. Return RespawnResult.

The player must not be placed at an unresolved or invalid transform.

### 11.4 Movement Reset

Movement System owns the actual physics state reset.

The Checkpoint System should request a reset through an interface:

```ts
interface IPlayerRespawnAdapter {
    placePlayer(
        position: Vector3,
        rotation: Vector3
    ): Promise<void>;

    resetMovementState(): void;

    setPlayerControlEnabled(
        enabled: boolean
    ): void;
}
```

The implementation must ensure that:

- Velocity is reset.
- Transient movement states are cleared.
- Grounded state is recalculated.
- Active traversal abilities are cancelled safely.
- The player does not retain a slide, vault, or wall-run state after respawn.

Exact physics operations remain in Movement System.

### 11.5 Camera Reset

Camera System should expose a dedicated respawn reset operation.

```ts
interface IRespawnCameraAdapter {
    resetTransientEffects(): void;

    applySpawnRotation(
        rotation: Vector3
    ): void;
}
```

Camera bob, roll, landing offsets, and FOV transitions must return to an appropriate neutral state.

Camera reset must not be implemented by directly modifying camera internals from Checkpoint System.

### 11.6 Respawn Failure

If respawn fails:

- Restore player control when safe.
- Release the respawn operation lock.
- Keep the active checkpoint unchanged unless it has become invalid.
- Report a structured failure.
- Attempt a valid fallback spawn only when configured.

The system must never leave the player permanently locked because of a failed respawn operation.

## 12. Prologue Checkpoint Configuration

### 12.1 Required Structure

The Prologue contains five mandatory checkpoints.

They correspond to the five main sections:

| Sequence | Section | Checkpoint ID |
|---|---|---|
| 1 | Rooftop | `prologue_rooftop` |
| 2 | Industrial | `prologue_industrial` |
| 3 | Construction | `prologue_construction` |
| 4 | Skybridge | `prologue_skybridge` |
| 5 | Finish | `prologue_finish` |

These IDs are stable identifiers, not display names.

Each checkpoint must reference a valid spawn point in its corresponding section.

The exact position and orientation are defined by Level Design.

### 12.2 Checkpoint Activation

The default Prologue behavior is:

- Activate a checkpoint when the player enters its valid activation volume.
- Record the activation in session progress.
- Update the active respawn checkpoint.
- Publish a checkpoint event for Speedrun.
- Show a concise confirmation through UI.
- Trigger appropriate audio feedback.

Checkpoint activation must not automatically mark a Speedrun checkpoint as valid.

Speedrun must validate the expected order independently.

### 12.3 Finish Checkpoint

The Finish checkpoint has special integration requirements.

It may:

- Record the final progress location.
- Request final respawn state if applicable.
- Publish a final checkpoint activation event.
- Notify Speedrun that the final checkpoint location was reached.

It must not independently mark the Speedrun run as completed.

Speedrun and Gameplay Systems own run completion conditions.

### 12.4 Session Consistency

All five Prologue checkpoints must belong to the same LevelSession.

The active checkpoint and progress history must remain associated with that session throughout section transitions.

Starting a new Prologue session must create new checkpoint progress.

## 13. Speedrun Integration

### 13.1 Ownership Boundary

Checkpoint System owns physical checkpoint activation and respawn state.

Speedrun System owns route progression and validation.

The two systems must not maintain competing authoritative versions of checkpoint order.

### 13.2 Event Contract

Checkpoint System publishes a checkpoint activation event:

```ts
interface CheckpointActivatedEvent {
    sessionId: string;

    levelId: string;

    checkpointId: string;

    sectionId: string;

    source: string;

    timestamp: number;

    activationIndex: number;
}
```

Speedrun System consumes this event and validates:

- Whether the checkpoint belongs to the current run.
- Whether it is the expected checkpoint.
- Whether the checkpoint is already recorded.
- Whether the event belongs to the correct route version.
- Whether the run should continue or enter a failed state.

### 13.3 Invalid Order

If the player activates a checkpoint out of the expected order:

- Checkpoint System may still record the physical activation according to its configuration.
- Speedrun System decides whether the run becomes invalid.
- Checkpoint System must not attempt to repair or override Speedrun state.
- Respawn behavior follows the configured gameplay policy.

The initial implementation should keep the Prologue checkpoint layout and trigger placement aligned with the required Speedrun sequence to minimize accidental out-of-order activation.

### 13.4 Respawn During Speedrun

Respawn must not silently restart the Speedrun timer.

The Speedrun System owns timer behavior.

Before respawning, the Checkpoint System publishes a respawn request event.

Speedrun may respond according to the current run policy.

Possible policies include:

- Continue the run with a time penalty.
- Mark the run as failed.
- Allow a practice respawn without a ranked result.

The initial policy must be explicitly configured by Speedrun System and must not be inferred by Checkpoint System.

### 13.5 Route Version

Checkpoint activation events must include enough context to associate them with the active level and route configuration.

The Level Runtime session provides level version information.

Speedrun remains responsible for route version validation and recording.

## 14. Training Integration

Training checkpoints may represent:

- Exercise start positions.
- Intermediate practice locations.
- Exercise reset locations.
- Safe recovery positions.

Training System owns the meaning of each checkpoint.

Checkpoint System provides activation and respawn infrastructure.

### 14.1 Training Restart

A training exercise restart may specify:

- A checkpoint ID.
- A fallback spawn point.
- Whether checkpoint progress is reset.
- Whether the current exercise state is preserved.

The Training System determines the restart policy.

Checkpoint System performs the validated activation and respawn operations.

### 14.2 Training Progress

Training checkpoint progress may be session-scoped.

Persistent exercise progress must be stored through Training System and Save System.

Checkpoint System must not directly persist exercise completion.

## 15. Interaction System Integration

For checkpoints configured with `activationMode = "interaction"`:

1. Checkpoint is registered as an interactable runtime object.
2. Interaction System detects and selects the checkpoint.
3. Interaction System executes the interaction.
4. The checkpoint activation request is sent to CheckpointManager.
5. CheckpointManager validates and commits activation.
6. The result is returned to Interaction System.
7. UI and Audio receive the corresponding checkpoint event.

The checkpoint implementation must not duplicate interaction detection or prompt logic.

Automatic checkpoints use TriggerManager and do not require manual interaction.

Scripted checkpoints are activated through a validated public API.

## 16. UI and Audio Integration

### 16.1 UI Responsibilities

Checkpoint System provides presentation data.

UI System decides how to display it.

Suggested feedback:

- Short checkpoint activation notification.
- Current checkpoint indicator where appropriate.
- Respawn loading feedback.
- Respawn failure message.
- Optional progress indication in Speedrun UI.

Checkpoint UI should remain consistent with the minimalist visual direction described in `07_UI_UX_SPEC.md`.

Checkpoint notifications must not obscure the player's view for an extended period.

### 16.2 Audio Responsibilities

Audio System consumes checkpoint events and controls:

- Checkpoint activation sound.
- Respawn transition sound.
- Optional environment feedback.

Checkpoint System must not directly play audio assets.

### 16.3 Feedback Model

```ts
interface CheckpointFeedback {
    checkpointId: string;

    displayName: string;

    isNewActivation: boolean;

    isCurrentRespawnCheckpoint: boolean;
}
```

Feedback should be generated only after successful activation.

Presentation failures must not affect checkpoint gameplay state.

## 17. Persistence Strategy

### 17.1 Initial Implementation

Checkpoint progress is session-scoped.

It is not required to persist checkpoint activation history across application restarts.

When the active LevelSession ends:

- Checkpoint progress is cleared.
- Runtime checkpoint instances are disposed.
- Session-scoped subscriptions are removed.

### 17.2 Future Persistence

Future implementations may persist:

- Last safe checkpoint.
- Training exercise checkpoint progress.
- Selected recovery location.
- Optional checkpoint completion state.

Persistence must use Save System interfaces.

Do not introduce direct IndexedDB access into Checkpoint System.

### 17.3 Data Versioning

If persistent checkpoint data is introduced, it must have an explicit schema version and migration strategy.

Persistent checkpoint state must be associated with a level ID and compatible level version.

Invalid or obsolete checkpoint references must be handled safely.

## 18. Checkpoint Validation

### 18.1 Definition Validation

The validator must check:

- Non-empty checkpoint ID.
- Valid level ID.
- Valid section ID.
- Valid spawn point ID.
- Supported activation mode.
- Valid activation configuration.
- Unique checkpoint IDs.
- Valid respawn configuration.

### 18.2 Runtime Validation

Before activation:

- Session must exist.
- Session must be active or in an explicitly permitted state.
- Checkpoint must be registered.
- Checkpoint must be enabled.
- Checkpoint section must be available.
- Spawn point must resolve.
- Actor must be the player or another explicitly permitted actor.

### 18.3 Prologue Validation

The Prologue configuration must provide all five required checkpoint IDs.

Each checkpoint must belong to the corresponding section.

The validator must verify that the referenced spawn points exist.

It must not implement Speedrun route validation.

### 18.4 Validation Result

```ts
interface CheckpointValidationResult {
    valid: boolean;

    errors: CheckpointValidationError[];

    warnings: CheckpointValidationWarning[];
}
```

Errors that compromise safe respawn must block checkpoint initialization.

## 19. Events

### 19.1 Required Events

```ts
type CheckpointEvent =
    | CheckpointSystemReadyEvent
    | CheckpointActivatedEvent
    | ActiveCheckpointChangedEvent
    | CheckpointDisabledEvent
    | CheckpointInvalidatedEvent
    | CheckpointProgressResetEvent
    | RespawnRequestedEvent
    | RespawnStartedEvent
    | RespawnCompletedEvent
    | RespawnFailedEvent;
```

### 19.2 Active Checkpoint Changed

```ts
interface ActiveCheckpointChangedEvent {
    sessionId: string;

    previousCheckpointId: string | null;

    currentCheckpointId: string | null;

    timestamp: number;
}
```

### 19.3 Respawn Events

```ts
interface RespawnRequestedEvent {
    sessionId: string;

    reason: RespawnReason;

    checkpointId?: string;

    timestamp: number;
}
```

```ts
interface RespawnCompletedEvent {
    sessionId: string;

    checkpointId: string;

    spawnPointId: string;

    timestamp: number;
}
```

```ts
interface RespawnFailedEvent {
    sessionId: string;

    checkpointId?: string;

    error: CheckpointRuntimeError;

    timestamp: number;
}
```

Events must be session-scoped.

A listener must not process events from an old or destroyed session.

## 20. Error Handling

### 20.1 Error Categories

```ts
type CheckpointRuntimeErrorCode =
    | "CHECKPOINT_NOT_FOUND"
    | "CHECKPOINT_DISABLED"
    | "INVALID_SESSION"
    | "INVALID_SPAWN_POINT"
    | "CHECKPOINT_REGISTRATION_FAILED"
    | "CHECKPOINT_ACTIVATION_FAILED"
    | "RESPAWN_NOT_ALLOWED"
    | "RESPAWN_IN_PROGRESS"
    | "RESPAWN_PLACEMENT_FAILED"
    | "MOVEMENT_RESET_FAILED"
    | "CAMERA_RESET_FAILED"
    | "CHECKPOINT_CONFIGURATION_INVALID"
    | "SESSION_DISPOSED";
```

```ts
interface CheckpointRuntimeError {
    code: CheckpointRuntimeErrorCode;

    message: string;

    checkpointId?: string;

    sessionId?: string;

    recoverable: boolean;

    cause?: unknown;
}
```

### 20.2 Error Rules

- Invalid checkpoint definitions must be reported before gameplay.
- Failed activation must not change the active checkpoint.
- Failed respawn must release the respawn lock.
- Failed camera reset must not corrupt checkpoint progress.
- Failed movement reset must be treated as a serious respawn failure.
- Missing fallback spawn must produce an explicit failure.
- Duplicate activation must not be treated as a fatal runtime error.
- Cleanup must continue even when one checkpoint fails to dispose.

## 21. Performance Requirements

The Checkpoint System must remain lightweight.

Requirements:

- Checkpoint lookup should use an ID-based registry.
- Activation must not scan every level object.
- Checkpoint progress should use efficient lookup structures.
- Activation should not allocate unnecessary objects every frame.
- Checkpoint state must not be polled continuously when event-driven activation is available.
- Respawn must not block the normal rendering loop.
- Checkpoint registration should happen during level initialization.
- Inactive checkpoints must not perform unnecessary runtime work.

Checkpoint logic should execute only when activation, invalidation, progress reset, or respawn operations occur.

## 22. Debugging and Development Tools

The initial implementation should include a development-only Checkpoint Debug Panel.

It should display:

- Current session ID.
- Registered checkpoint count.
- Active checkpoint ID.
- Activated checkpoint IDs.
- Activation history.
- Checkpoint state.
- Referenced spawn point.
- Respawn operation state.
- Last activation or respawn error.

### 22.1 Debug Actions

Development builds may support:

- Activate checkpoint by ID.
- Disable checkpoint.
- Re-enable checkpoint.
- Set active checkpoint.
- Request respawn.
- Reset checkpoint progress.
- List registered checkpoints.
- Validate checkpoint configuration.

Debug operations must use the public CheckpointManager interface.

They must not modify internal state directly.

## 23. Testing Requirements

### 23.1 Unit Tests

Test:

- Checkpoint definition validation.
- Duplicate checkpoint ID rejection.
- Checkpoint registration.
- Checkpoint unregistration.
- Activation state transitions.
- Duplicate activation behavior.
- Repeatable checkpoint behavior.
- Active checkpoint selection.
- Checkpoint invalidation.
- Progress history ordering.
- Progress reset.
- Respawn fallback selection.
- Invalid session rejection.
- Respawn operation locking.

### 23.2 Integration Tests

Test:

1. Initialize a Training session.
2. Register Training checkpoints.
3. Activate a checkpoint.
4. Verify progress.
5. Request respawn.
6. Verify spawn resolution.
7. Verify movement reset.
8. Verify camera reset.
9. Dispose the session.
10. Verify checkpoint state is cleared.

For Prologue:

1. Initialize a Prologue session.
2. Register all five required checkpoints.
3. Activate Rooftop checkpoint.
4. Move through Industrial.
5. Activate Industrial checkpoint.
6. Continue through Construction.
7. Activate Construction checkpoint.
8. Continue through Skybridge.
9. Activate Skybridge checkpoint.
10. Reach Finish.
11. Activate Finish checkpoint.
12. Verify Speedrun receives activation events.
13. Verify the same session ID is preserved.
14. Dispose the session.

### 23.3 Failure Tests

Test:

- Missing checkpoint definition.
- Invalid spawn point.
- Disabled checkpoint activation.
- Activation during session disposal.
- Activation from an invalid actor.
- Duplicate activation requests.
- Respawn during another respawn.
- Respawn after session disposal.
- Movement placement failure.
- Movement reset failure.
- Camera reset failure.
- Invalid fallback spawn.
- Checkpoint invalidation during respawn.
- Old session event delivery.

### 23.4 Performance Tests

Verify:

- Checkpoint lookup remains efficient with many registered checkpoints.
- Activation does not require a full-level object scan.
- Progress tracking does not produce duplicate records.
- Repeated session creation does not leak checkpoint objects.
- Event subscriptions are removed after disposal.

## 24. Implementation Phases

### Phase 1 — Core Models

Implement:

- CheckpointDefinition.
- CheckpointRuntime.
- CheckpointProgress.
- Activation and respawn models.
- Runtime error models.

**Deliverable:** Type-safe checkpoint contracts.

### Phase 2 — Registry and Validation

Implement:

- CheckpointRegistry.
- CheckpointValidator.
- Registration lifecycle.
- Definition validation.

**Deliverable:** Validated checkpoint configuration.

### Phase 3 — Activation and Progress

Implement:

- CheckpointManager.
- CheckpointActivator.
- CheckpointProgressTracker.
- Active checkpoint selection.
- Activation events.

**Deliverable:** Reliable session-scoped checkpoint activation.

### Phase 4 — Respawn Coordination

Implement:

- RespawnCoordinator.
- Spawn resolution integration.
- Movement adapter.
- Camera adapter.
- Respawn failure recovery.

**Deliverable:** Safe and deterministic player respawn.

### Phase 5 — Training Integration

Implement:

- Training checkpoint configuration.
- Exercise restart integration.
- Training respawn behavior.
- Progress reset behavior.

**Deliverable:** Functional Training checkpoints.

### Phase 6 — Prologue Integration

Implement:

- Five mandatory checkpoint definitions.
- Section associations.
- Spawn point references.
- Automatic activation triggers.
- Speedrun event integration.

**Deliverable:** Complete Prologue checkpoint flow.

### Phase 7 — UI, Audio, and Debugging

Implement:

- Checkpoint feedback model.
- UI integration.
- Audio event integration.
- Development debug panel.

**Deliverable:** Complete checkpoint presentation and diagnostics.

### Phase 8 — Verification

Implement and run:

- Unit tests.
- Integration tests.
- Failure tests.
- Session lifecycle tests.
- Performance checks.

**Deliverable:** Stable Checkpoint System.

## 25. Acceptance Criteria

The implementation is accepted when:

- [ ] Checkpoints have stable unique IDs.
- [ ] Checkpoints reference valid level sections and spawn points.
- [ ] Checkpoints can be registered and unregistered.
- [ ] Checkpoint activation validates the current session.
- [ ] Invalid checkpoints cannot become active respawn locations.
- [ ] Duplicate activation is handled safely.
- [ ] Activation history is recorded deterministically.
- [ ] Active checkpoint selection follows the documented rules.
- [ ] Checkpoint progress is session-scoped.
- [ ] A new session starts with clean checkpoint progress.
- [ ] Respawn uses Level Runtime spawn resolution.
- [ ] Respawn resets movement state through the Movement System.
- [ ] Camera effects reset through the Camera System.
- [ ] Failed respawn operations release their locks.
- [ ] Training checkpoints work correctly.
- [ ] All five Prologue checkpoints are registered and validated.
- [ ] Prologue checkpoint activation events reach Speedrun.
- [ ] Checkpoint System does not own Speedrun sequence validation.
- [ ] UI and Audio receive checkpoint feedback events.
- [ ] Save System is accessed only through appropriate interfaces.
- [ ] Session disposal releases all checkpoint resources.
- [ ] Unit and integration tests cover normal and failure paths.

## 26. Definition of Done

The Checkpoint System is complete for the initial implementation when:

1. Core checkpoint models and interfaces are implemented.
2. Checkpoint registration and validation work.
3. Automatic, interaction-based, and scripted activation paths are supported.
4. Activation progress is tracked correctly.
5. Active respawn checkpoint selection is deterministic.
6. Respawn coordination works with Level Runtime.
7. Movement and Camera integrations use dedicated adapters.
8. Training checkpoints work.
9. All five Prologue checkpoints work.
10. Speedrun receives checkpoint activation events without duplicated sequence logic.
11. UI and Audio integrations receive appropriate events.
12. Session cleanup removes all checkpoint runtime state.
13. Failure cases are handled without corrupting the session.
14. Automated tests pass.
15. No known resource leaks or stale event subscriptions remain.

## 27. Final Design Constraints

The implementation agent must follow these constraints:

1. Do not implement player physics inside Checkpoint System.
2. Do not directly manipulate the player transform through engine-specific APIs.
3. Do not own spawn point definitions or placement logic.
4. Do not duplicate Level Runtime responsibilities.
5. Do not duplicate Interaction System detection or execution.
6. Do not own Speedrun timing or checkpoint sequence validation.
7. Do not access IndexedDB directly.
8. Keep checkpoint progress session-scoped in the initial implementation.
9. Keep checkpoint IDs stable and explicit.
10. Validate spawn point availability before committing activation.
11. Keep activation and respawn operations deterministic.
12. Make duplicate activation safe.
13. Make respawn operations resistant to concurrency and cancellation.
14. Use typed, session-scoped events.
15. Keep movement and camera integration behind adapters.
16. Do not assume a specific rendering or physics engine.
17. Do not implement future features unless explicitly requested.
18. Follow `01_AGENT_RULES.md` and the architecture in `02_TECHNICAL_ARCHITECTURE.md`.
19. Respect ownership boundaries defined in `09_SPEEDRUN_SYSTEM_SPEC.md`, `10_SAVE_SYSTEM_SPEC.md`, `12_MOVEMENT_SYSTEM_SPEC.md`, `13_CAMERA_SYSTEM_SPEC.md`, `14_INTERACTION_SYSTEM_SPEC.md`, and `15_LEVEL_RUNTIME_SYSTEM_SPEC.md`.

The Checkpoint System must provide reliable progress recording and respawn coordination without becoming a second Level Runtime, Movement, or Speedrun system.