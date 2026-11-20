# 16_CHECKPOINT_SYSTEM_SPEC.md

**Project:** Glassline  
**Document:** Checkpoint System Specification

## 1. Purpose

The Checkpoint System manages checkpoint availability, activation, player progress, and the checkpoint data used to determine a respawn destination.

It provides a consistent mechanism for recording meaningful progress through a level. Restoring the player after a failure or restart is a separate recovery lifecycle owned by the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`); the Checkpoint System supplies the active checkpoint and resolves its destination through the Respawn integration contract.

The system must support:

- Training checkpoints.
- Prologue checkpoints.
- Speedrun checkpoint integration.
- Checkpoint activation feedback.
- Respawn destination resolution.
- Checkpoint progress tracking.
- Session-scoped checkpoint state.
- Checkpoint reset and invalidation.
- Integration with Level Runtime and Movement Systems.
- Integration with the Respawn System as a destination provider, not as a recovery orchestrator.

The system must work independently of the rendering engine and must not own player physics, the player recovery lifecycle, or speedrun timing.

## 2. Core Design Principles

### 2.1 Single Responsibility

The Checkpoint System owns checkpoint gameplay state.

It does not own:

- Level geometry.
- Section transitions.
- Player movement physics.
- The player recovery/respawn lifecycle.
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

The Checkpoint System decides which checkpoint should be used and exposes that destination. Level Runtime resolves and validates the actual spawn transform.

The recovery lifecycle around that destination — request validation, control suspension, player placement, movement reset, camera reset, failure policy and completion events — is owned by the Respawn System and orchestrated exclusively by `RespawnManager` (`17_RESPAWN_SYSTEM_SPEC.md`).

The Checkpoint System must not implement a second respawn coordinator, a competing `RespawnCoordinator`, or its own recovery sequence.

### 2.3 Deterministic Behavior

Checkpoint selection must be deterministic.

The same session state and the same checkpoint activation sequence must produce the same active checkpoint.

The system must not depend on object loading order, frame rate, or rendering timing.

### 2.4 Explicit Ownership

Each system owns its own state:

| System | Responsibility |
|---|---|
| Checkpoint System | Checkpoint activation, progress state, and respawn destination resolution |
| Respawn System | The complete player recovery lifecycle through `RespawnManager` |
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
- Recovery at the most recently activated valid checkpoint, executed by the Respawn System.
- Resetting checkpoint progress when an exercise or session restarts.

**Prologue**
- Five mandatory checkpoint locations.
- Checkpoints associated with the five Prologue sections.
- Progress tracking throughout one Prologue session.
- Recovery at the most recently activated valid checkpoint, executed by the Respawn System.
- Integration with Speedrun checkpoint events.
- Checkpoint progress reset when a new run begins.

The exact checkpoint IDs must be stable and defined in the level content.

### 3.2 Initial Checkpoint Behavior

For the initial implementation:

- Checkpoints are activated when the player enters their valid activation area.
- A checkpoint can be activated only when it belongs to the current level session.
- Re-entering an already activated checkpoint must not create duplicate progress.
- Activating a checkpoint updates the active checkpoint used as the recovery destination.
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
| CheckpointRespawnAdapter | Resolves respawn destinations for the Respawn System |
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
     +-- CheckpointRespawnAdapter
     |
     +-- CheckpointEvents
     |
     +-- CheckpointFeedbackProvider
     |
     v
External Systems
     |
     +-- Speedrun System
     +-- Respawn System (destination consumer)
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

### 6.4 Respawn Destination Contract

The Checkpoint System provides destination data to the Respawn System.

The recovery request model (`RespawnRequest`, `RespawnReason`), the recovery state machine, and the `RespawnResult` contract are owned by `17_RESPAWN_SYSTEM_SPEC.md` and must not be redefined here.

The checkpoint-side output is a resolved destination:

```ts
interface CheckpointRespawnDestination {
    sessionId: string;

    checkpointId: string;

    sectionId: string;

    spawnPointId: string;

    /** Transform resolved through Level Runtime spawn resolution. */
    position: Vector3;

    rotation: Vector3;
}
```

Checkpoint System resolves and returns the destination. It does not validate or execute the recovery policy. Whether recovery is allowed, how player control is suspended, how state is reset, and how the outcome is reported are Respawn System decisions.

### 6.5 Respawn Destination Failure

If no valid destination can be resolved, the adapter returns `null` together with a structured checkpoint-side error.

The Respawn System owns the failure policy — fallback spawn, run invalidation, player notification — and must not assume that a destination always exists.

A checkpoint without a resolvable spawn point must not be reported as a valid recovery target.

## 7. CheckpointManager

### 7.1 Purpose

CheckpointManager is the public entry point for checkpoint operations.

It coordinates registration, activation, progress tracking, and destination resolution for the Respawn System.

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

    resolveRespawnDestination(
        checkpointId: string | null
    ): Promise<CheckpointRespawnDestination | null>;

    resetProgress(): void;

    disableCheckpoint(checkpointId: string): void;

    disposeSession(sessionId: string): Promise<void>;
}
```

`resolveRespawnDestination` is read-only with respect to checkpoint progress. It returns the destination for the requested checkpoint, or for the active checkpoint when `checkpointId` is `null`.

The CheckpointManager must not execute player placement, movement reset, camera reset, or recovery policy. Those operations belong to the Respawn System.

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

The default for checkpoints is repeatable (`repeatable ?? true` in the
implementation); all five Prologue checkpoints are authored `repeatable: true`.

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

## 11. Respawn Integration

### 11.1 Ownership

Player recovery is owned by the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`) and orchestrated exclusively by `RespawnManager`.

The Checkpoint System participates as a destination provider only:

| Operation | Owner |
|---|---|
| Decide that recovery is required | Respawn System, gameplay mode, or failure detection |
| Allow or reject recovery for a ranked run | Speedrun System, evaluated by the Respawn System |
| Select the checkpoint and resolve its spawn point | Checkpoint System |
| Suspend and restore player control | Respawn System through Player/Movement interfaces |
| Place the player and reset movement state | Movement System through the Respawn System |
| Reset transient camera effects | Camera System through the Respawn System |
| Run failure policy and publish recovery events | Respawn System |

### 11.2 Destination Adapter

The Checkpoint System exposes the adapter consumed by `RespawnManager`:

```ts
interface ICheckpointRespawnAdapter {
    resolveRespawnDestination(
        context: RespawnContext,
        preferredCheckpointId?: string
    ): Promise<RespawnDestination | null>;
}
```

`RespawnContext`, `RespawnDestination`, and the adapter composition are defined by `17_RESPAWN_SYSTEM_SPEC.md`. The Checkpoint System must not redefine them.

The adapter:

1. Validates the session and the requested checkpoint.
2. Selects the active checkpoint when no preference is supplied.
3. Resolves the spawn point through Level Runtime.
4. Validates that the destination is usable.
5. Returns the destination or a structured failure.

### 11.3 Destination Resolution Rules

- A destination must belong to the active LevelSession.
- A disabled checkpoint must not resolve a destination.
- A checkpoint without a valid spawn point must fail explicitly.
- Destination resolution must be deterministic for the same session state.
- Concurrent resolution requests must not mutate checkpoint progress.

### 11.4 Failure Reporting

If destination resolution fails, the Checkpoint System reports a structured error and does not change checkpoint progress.

The Respawn System decides the recovery outcome, including fallback behavior and user-facing failure handling.

Because the Checkpoint System never controls player control or player placement, a destination failure must not leave the player locked.

### 11.5 Forbidden Behavior

The Checkpoint System must not:

- Implement its own respawn sequence or a competing coordinator.
- Suspend or restore player control.
- Place or teleport the player transform directly.
- Reset movement or camera state itself.
- Publish recovery lifecycle events as the authoritative source; the Respawn System owns them.

## 12. Prologue Checkpoint Configuration

### 12.1 Required Structure

The Prologue contains five mandatory checkpoints.

They correspond to the five main sections:

| Sequence | Section | Checkpoint ID |
|---|---|---|
| 1 | Rooftop | `cp_rooftop` |
| 2 | Industrial | `cp_industrial` |
| 3 | Construction | `cp_construction` |
| 4 | Skybridge | `cp_skybridge` |
| 5 | Finish | `cp_finish` |

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
- Provide the final recovery destination if requested.
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

Checkpoint System owns physical checkpoint activation and checkpoint progress state.

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
- The Respawn System applies the configured recovery policy for any subsequent recovery request.

The initial implementation should keep the Prologue checkpoint layout and trigger placement aligned with the required Speedrun sequence to minimize accidental out-of-order activation.

### 13.4 Respawn During Speedrun

Recovering during a ranked run is coordinated by the Respawn System.

The Checkpoint System must not evaluate run policy, restart the timer, mark a run as failed, or apply a penalty.

Its role is limited to:

- Keeping the active checkpoint and progress state consistent with the current session.
- Resolving the recovery destination when the Respawn System requests it.
- Publishing checkpoint activation and active-checkpoint facts for observation.

Before a ranked recovery, the Respawn System requests an evaluation from the Speedrun System and applies its decision. The Speedrun System owns timer behavior and run classification (`09_SPEEDRUN_SYSTEM_SPEC.md`).

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

Checkpoint System provides checkpoint activation, progress, and destination resolution. Recovery execution is performed by the Respawn System.

### 14.1 Training Restart

A training exercise restart may specify:

- A checkpoint ID.
- A fallback spawn point.
- Whether checkpoint progress is reset.
- Whether the current exercise state is preserved.

The Training System determines the restart policy.

The Respawn System executes the restart as a recovery request (`reason = "training-restart"`), using the Checkpoint System for destination resolution and activation state.

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
    | CheckpointProgressResetEvent;
```

Recovery lifecycle events (`respawn requested`, `started`, `completed`, `failed`) are owned by the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`). The Checkpoint System must not publish a competing authoritative recovery event.

### 19.2 Active Checkpoint Changed

```ts
interface ActiveCheckpointChangedEvent {
    sessionId: string;

    previousCheckpointId: string | null;

    currentCheckpointId: string | null;

    timestamp: number;
}
```

### 19.3 Recovery Observation

The Checkpoint System may expose read-only observations that the Respawn System and presentation layers consume:

- The active checkpoint ID before and after recovery.
- Checkpoint progress reset notifications.
- Destination resolution failures.

These are checkpoint facts, not recovery lifecycle events.

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
    | "DESTINATION_UNRESOLVABLE"
    | "CHECKPOINT_REGISTRATION_FAILED"
    | "CHECKPOINT_ACTIVATION_FAILED"
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
- Failed destination resolution must not corrupt checkpoint progress.
- A destination failure must be reported to the Respawn System, which owns the recovery failure policy.
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
- Destination resolution must not block the normal rendering loop.
- Checkpoint registration should happen during level initialization.
- Inactive checkpoints must not perform unnecessary runtime work.

Checkpoint logic should execute only when activation, invalidation, progress reset, or destination resolution occurs.

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
- Resolved destination state.
- Last activation or destination error.

### 22.1 Debug Actions

Development builds may support:

- Activate checkpoint by ID.
- Disable checkpoint.
- Re-enable checkpoint.
- Set active checkpoint.
- Resolve a checkpoint destination.
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
- Destination resolution for the active checkpoint.
- Destination fallback selection.
- Invalid session rejection.
- Concurrent destination resolution.

### 23.2 Integration Tests

Test:

1. Initialize a Training session.
2. Register Training checkpoints.
3. Activate a checkpoint.
4. Verify progress.
5. Resolve a respawn destination through `ICheckpointRespawnAdapter`.
6. Verify the destination maps to the expected Level Runtime spawn point.
7. Verify that the Respawn System receives the destination and performs recovery.
8. Verify that checkpoint progress survives a normal respawn.
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
- Destination resolution for a disabled checkpoint.
- Destination resolution after session disposal.
- Unresolvable spawn point.
- Concurrent destination resolution requests.
- Checkpoint invalidation during destination resolution.
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
- Checkpoint activation and destination models.
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

### Phase 4 — Respawn Destination Integration

Implement:

- `ICheckpointRespawnAdapter`.
- Destination resolution through Level Runtime spawn points.
- Destination validation and structured failures.
- Session-scoped destination consistency.

**Deliverable:** Deterministic respawn destination resolution consumed by the Respawn System.

The recovery lifecycle itself is implemented in `17_RESPAWN_SYSTEM_SPEC.md` and must not be duplicated here.

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
- [ ] The active checkpoint resolves a deterministic respawn destination.
- [ ] Destination resolution uses Level Runtime spawn resolution.
- [ ] Destination failures are reported to the Respawn System without corrupting progress.
- [ ] The Checkpoint System exposes no competing respawn lifecycle manager.
- [ ] Training checkpoints work correctly.
- [ ] All five Prologue checkpoints are registered and validated.
- [ ] Prologue checkpoint activation events reach Speedrun.
- [ ] Checkpoint System does not own Speedrun sequence validation.
- [ ] Checkpoint System does not own recovery policy or execution.
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
6. Destination resolution integrates with Level Runtime spawn points.
7. Recovery execution is delegated to `RespawnManager` through the adapter.
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
11. Keep activation and destination resolution deterministic.
12. Make duplicate activation safe.
13. Make destination resolution resistant to concurrency and cancellation.
14. Use typed, session-scoped events.
15. Keep Level Runtime spawn resolution behind the destination adapter.
16. Do not implement or duplicate the respawn lifecycle; `RespawnManager` in `17_RESPAWN_SYSTEM_SPEC.md` is the sole orchestrator.
17. Do not publish authoritative recovery lifecycle events.
18. Do not assume a specific rendering or physics engine.
19. Do not implement future features unless explicitly requested.
20. Follow `01_AGENT_RULES.md` and the architecture in `02_TECHNICAL_ARCHITECTURE.md`.
21. Respect ownership boundaries defined in `09_SPEEDRUN_SYSTEM_SPEC.md`, `10_SAVE_SYSTEM_SPEC.md`, `12_MOVEMENT_SYSTEM_SPEC.md`, `13_CAMERA_SYSTEM_SPEC.md`, `14_INTERACTION_SYSTEM_SPEC.md`, `15_LEVEL_RUNTIME_SYSTEM_SPEC.md`, and `17_RESPAWN_SYSTEM_SPEC.md`.

The Checkpoint System must provide reliable progress recording and respawn destination data without becoming a second Level Runtime, Movement, Respawn, or Speedrun system.