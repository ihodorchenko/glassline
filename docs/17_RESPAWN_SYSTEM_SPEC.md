# 17_RESPAWN_SYSTEM_SPEC.md

# Respawn System Specification

## 1. Purpose

The Respawn System manages the complete player recovery lifecycle.

It coordinates the process of restoring the player to a valid gameplay position after falling, becoming stuck, failing a scripted sequence, or explicitly requesting a restart.

The system is responsible for:

- Detecting and processing respawn requests.
- Managing respawn lifecycle states.
- Coordinating player control suspension.
- Resolving recovery destinations through Checkpoint System.
- Coordinating player placement through Movement System.
- Resetting movement and traversal state.
- Resetting transient camera effects.
- Coordinating visual and audio feedback.
- Restoring player control.
- Handling failed or interrupted respawn operations.
- Preventing overlapping respawn operations.

The Respawn System must provide a consistent recovery experience across Training and Prologue.

It does not own checkpoint progress, spawn point definitions, movement physics, camera presentation, or level lifecycle.

## 2. Core Design Principles

### 2.1 Separation of Responsibilities

Respawn is a coordinated gameplay operation.

It must not duplicate responsibilities belonging to other systems.

| System | Responsibility |
|---|---|
| Respawn System | Orchestrates the complete recovery lifecycle |
| Checkpoint System | Selects the active checkpoint and resolves respawn destination |
| Level Runtime | Provides valid spawn locations and session state |
| Movement System | Places the player and resets physics state |
| Camera System | Restores camera state and transient effects |
| Input System | Controls gameplay input availability |
| UI System | Displays respawn feedback |
| Audio System | Plays respawn-related audio |
| Speedrun System | Determines how respawn affects a run |
| Gameplay System | Determines whether respawn is allowed in the current mode |

### 2.2 Recovery Must Be Atomic

From the player's perspective, respawn must behave as one controlled operation.

The player must not:

- Regain control before placement is complete.
- Retain velocity from the previous movement state.
- Remain in a vault, slide, or wall-run state.
- Spawn inside invalid geometry.
- Receive duplicate respawn operations.
- Become permanently locked after an error.

### 2.3 Physics Ownership

Respawn System must never implement physics calculations.

It requests movement reset and player placement through Movement System interfaces.

### 2.4 Checkpoint Ownership

Respawn System must not independently select a checkpoint by inspecting level objects.

It delegates destination selection to Checkpoint System.

### 2.5 Engine Independence

The implementation must use abstract interfaces.

Do not assume a particular 3D engine, scene graph, physics API, or character controller implementation.

## 3. Initial Implementation Scope

### 3.1 Required Recovery Scenarios

The initial implementation must support:

1. Falling below the playable level.
2. Entering a configured kill or recovery volume.
3. Manual restart.
4. Training exercise restart.
5. Scripted recovery.
6. Recovery from an invalid or stuck player state when explicitly requested.

### 3.2 Required Modes

**Training**
- Respawn at the active training checkpoint.
- Restart an exercise at its configured spawn point.
- Support manual exercise restart.
- Restore the player without corrupting exercise state.

**Prologue**
- Respawn at the latest valid activated checkpoint.
- Preserve the active LevelSession.
- Coordinate with Speedrun System.
- Support recovery from falls and configured failure volumes.
- Avoid resetting the entire level when a checkpoint respawn is sufficient.

### 3.3 Initial Recovery Presentation

The initial implementation should use a short, consistent recovery sequence:

1. Detect or receive the recovery request.
2. Suspend gameplay control.
3. Apply a brief visual transition.
4. Place the player at the resolved destination.
5. Reset movement state.
6. Reset camera transient effects.
7. Restore gameplay control.
8. Complete the visual transition.
9. Notify dependent systems.

The exact transition duration must be configurable.

Avoid unnecessarily long loading or death animations.

### 3.4 Future Features

The following are outside the initial implementation:

- Complex death animations.
- Context-sensitive cinematic recovery.
- Multiple recovery camera perspectives.
- Advanced rewind mechanics.
- Physics-based recovery animations.
- Multiplayer respawn synchronization.
- Network-authoritative respawn.
- Dynamic recovery penalties.
- Spectator mode.
- Persistent death statistics.
- Recovery voting or selection screens.

Architecture must allow future extensions without changing core recovery ownership.

## 4. Terminology

| Term | Meaning |
|---|---|
| Respawn Request | A request to restore the player |
| Recovery | Complete respawn operation |
| Recovery Reason | Cause of the respawn |
| Recovery Destination | Valid player spawn transform |
| Recovery Sequence | Ordered set of operations performed during respawn |
| Control Lock | Temporary suspension of gameplay control |
| Recovery Presentation | Visual and audio feedback |
| Recovery Policy | Rules determining whether and how recovery is allowed |
| Respawn Context | Information about the current session and recovery request |

## 5. Architecture Overview

The system consists of:

| Component | Responsibility |
|---|---|
| RespawnManager | Public entry point and lifecycle coordinator |
| RespawnRequestProcessor | Validates and queues recovery requests |
| RespawnStateMachine | Controls recovery state transitions |
| RespawnPolicyProvider | Determines recovery rules |
| RecoveryDestinationResolver | Requests destination from Checkpoint System |
| PlayerControlCoordinator | Suspends and restores gameplay control |
| PlayerRecoveryExecutor | Coordinates player placement and state reset |
| RecoveryPresentationController | Coordinates visual and audio feedback |
| RespawnEvents | Publishes recovery lifecycle events |
| RespawnValidator | Validates recovery requests and destinations |

### 5.1 High-Level Architecture

```text
Failure Detection / Manual Restart
                |
                v
         RespawnManager
                |
                +-- RespawnRequestProcessor
                |
                +-- RespawnStateMachine
                |
                +-- RespawnPolicyProvider
                |
                +-- RecoveryDestinationResolver
                |
                +-- PlayerControlCoordinator
                |
                +-- PlayerRecoveryExecutor
                |
                +-- RecoveryPresentationController
                |
                +-- RespawnValidator
                |
                v
          External Systems
                |
                +-- Checkpoint System
                +-- Level Runtime
                +-- Movement System
                +-- Camera System
                +-- Input System
                +-- UI System
                +-- Audio System
                +-- Speedrun System
```

## 6. Respawn Data Models

### 6.1 RespawnRequest

Represents a request to restore the player.

```ts
interface RespawnRequest {
    id: string;

    sessionId: string;

    reason: RespawnReason;

    source: RespawnRequestSource;

    preferredCheckpointId?: string;

    preferredSpawnPointId?: string;

    fallbackAllowed: boolean;

    presentation: RespawnPresentationOptions;

    metadata?: Record<string, unknown>;
}
```

```ts
type RespawnReason =
    | "fall"
    | "kill-volume"
    | "manual-restart"
    | "training-restart"
    | "scripted"
    | "stuck-recovery"
    | "system-recovery";
```

```ts
type RespawnRequestSource =
    | "movement"
    | "trigger"
    | "input"
    | "training"
    | "gameplay"
    | "system";
```

A request must have a unique ID.

The ID is used to prevent duplicate processing.

### 6.2 RespawnPresentationOptions

```ts
interface RespawnPresentationOptions {
    useFade: boolean;

    showMessage: boolean;

    playAudio: boolean;

    transitionDuration: number;

    messageKey?: string;
}
```

Presentation options must not determine gameplay validity.

A request can use a minimal presentation while still performing the complete recovery operation.

### 6.3 RespawnContext

```ts
interface RespawnContext {
    requestId: string;

    sessionId: string;

    levelId: string;

    mode: GameMode;

    reason: RespawnReason;

    currentSectionId?: string;

    checkpointId?: string;

    requestedAt: number;
}
```

### 6.4 RespawnDestination

```ts
interface RespawnDestination {
    spawnPointId: string;

    checkpointId?: string;

    position: Vector3;

    rotation: Vector3;

    sectionId: string;

    source: "checkpoint" | "explicit" | "fallback";
}
```

The destination must be resolved and validated before player placement.

### 6.5 RespawnResult

```ts
interface RespawnResult {
    success: boolean;

    requestId: string;

    destination?: RespawnDestination;

    startedAt: number;

    completedAt?: number;

    failureReason?: RespawnFailureReason;
}
```

## 7. RespawnManager

### 7.1 Purpose

RespawnManager is the public entry point for player recovery.

It owns the recovery lifecycle and coordinates the required adapters.

### 7.2 Interface

```ts
interface IRespawnManager {
    requestRespawn(
        request: RespawnRequest
    ): Promise<RespawnResult>;

    canRespawn(
        context: RespawnContext
    ): boolean;

    getState(): RespawnState;

    isRespawning(): boolean;

    cancelRespawn(
        requestId?: string
    ): Promise<void>;

    reset(): Promise<void>;
}
```

### 7.3 Lifecycle Responsibilities

RespawnManager must:

- Validate incoming requests.
- Apply recovery policies.
- Prevent duplicate operations.
- Resolve recovery destinations.
- Coordinate control suspension.
- Execute placement and movement reset.
- Coordinate camera reset.
- Trigger recovery presentation.
- Restore control.
- Publish lifecycle events.
- Handle cancellation and failures.

It must not directly manipulate engine objects.

## 8. Respawn State Machine

### 8.1 States

```ts
type RespawnState =
    | "idle"
    | "requested"
    | "validating"
    | "preparing"
    | "presenting"
    | "placing-player"
    | "resetting-movement"
    | "resetting-camera"
    | "restoring-control"
    | "completing"
    | "completed"
    | "failed"
    | "cancelled";
```

### 8.2 Expected State Flow

```text
Idle
 |
 v
Requested
 |
 v
Validating
 |
 v
Preparing
 |
 v
Presenting
 |
 v
Placing Player
 |
 v
Resetting Movement
 |
 v
Resetting Camera
 |
 v
Restoring Control
 |
 v
Completing
 |
 v
Completed
 |
 v
Idle
```

Failure may occur at any stage.

The manager must enter Failed or Cancelled and execute the appropriate cleanup procedure.

### 8.3 State Transition Rules

- Only one active respawn operation is allowed.
- Duplicate requests with the same request ID must be ignored or return the existing result.
- Incompatible requests during recovery must be rejected.
- State changes must be explicit.
- Completion must only be published after control restoration succeeds.
- Failed operations must release locks and resources.
- Cancellation must not leave the player in a partially restored state.

A terminal state may be observable briefly before the manager returns to Idle.

The last result should remain available to diagnostics.

## 9. RespawnRequestProcessor

### 9.1 Purpose

Processes incoming requests and prevents conflicting recovery operations.

### 9.2 Request Validation

Every request must be checked for:

- Valid request ID.
- Valid session ID.
- Valid recovery reason.
- Supported request source.
- Current session availability.
- Recovery policy.
- Existing active recovery operation.

### 9.3 Duplicate Requests

The system must handle common duplicate scenarios:

- Multiple fall detection events in consecutive frames.
- Trigger enter and scripted recovery occurring together.
- Manual restart during an active recovery.
- Multiple callbacks requesting the same recovery.

The processor must guarantee that only one operation can modify player placement at a time.

### 9.4 Request Priority

Initial request priority:

| Priority | Request |
|---|---|
| Critical | System recovery |
| High | Kill volume |
| High | Fall |
| Normal | Training restart |
| Normal | Manual restart |
| Normal | Scripted recovery |
| Low | Stuck recovery |

Priority is used only when requests are competing before execution begins.

Once a recovery operation starts, a new request must not interrupt it unless explicitly authorized by the policy provider.

## 10. RespawnPolicyProvider

### 10.1 Purpose

Determines whether recovery is allowed in the current gameplay context.

Different game modes may have different recovery rules.

### 10.2 Interface

```ts
interface IRespawnPolicyProvider {
    evaluate(
        context: RespawnContext
    ): RespawnPolicyResult;
}
```

```ts
interface RespawnPolicyResult {
    allowed: boolean;

    reason?: string;

    allowFallback: boolean;

    allowCancellation: boolean;

    metadata?: Record<string, unknown>;
}
```

### 10.3 Initial Policies

**Training**
- Fall recovery is allowed.
- Manual restart is allowed.
- Exercise restart is allowed.
- Recovery must preserve unrelated training progress.
- Training System may provide a specific spawn destination.

**Prologue**
- Fall recovery is allowed.
- Kill-volume recovery is allowed.
- Manual restart follows the configured gameplay policy.
- Checkpoint recovery must use the active valid checkpoint.
- Speedrun consequences are delegated to Speedrun System.

### 10.4 Speedrun Policy

Respawn System must not decide whether a run remains valid.

Before executing a recovery that may affect an active run, it must notify Speedrun System.

Speedrun may:

- Allow the recovery.
- Allow recovery but invalidate the run.
- Reject the request.
- Apply a configured penalty.

The exact policy is owned by Speedrun System.

If Speedrun does not respond, Respawn System must follow the explicit configured fallback policy.

It must not silently assume that a ranked run can continue.

## 11. RecoveryDestinationResolver

### 11.1 Purpose

Resolves the destination for a recovery request.

It delegates checkpoint selection to Checkpoint System.

### 11.2 Interface

```ts
interface IRecoveryDestinationResolver {
    resolve(
        request: RespawnRequest,
        context: RespawnContext
    ): Promise<RespawnDestination | null>;

    validate(
        destination: RespawnDestination
    ): Promise<boolean>;
}
```

### 11.3 Resolution Priority

The default priority is:

1. Explicit preferred spawn point when authorized.
2. Explicit preferred checkpoint when valid.
3. Active checkpoint from Checkpoint System.
4. Configured fallback spawn point.
5. Recovery failure.

The request reason and gameplay mode may restrict the use of explicit destinations.

For example, a normal fall recovery in Prologue should prefer the active checkpoint.

### 11.4 Destination Validation

Before placement:

- Confirm the destination belongs to the active session.
- Confirm its section is loaded.
- Confirm the spawn point is available.
- Confirm position and rotation are finite.
- Confirm the destination is allowed by the current policy.
- Confirm the destination has not been invalidated.

Collision safety and final player placement validation must be coordinated with Movement and Level Runtime.

## 12. PlayerControlCoordinator

### 12.1 Purpose

Temporarily suspends and restores player gameplay control.

It coordinates Input and gameplay control without directly modifying unrelated UI input.

### 12.2 Interface

```ts
interface IPlayerControlCoordinator {
    suspendGameplayControl(
        requestId: string
    ): Promise<void>;

    restoreGameplayControl(
        requestId: string
    ): Promise<void>;

    isGameplayControlSuspended(): boolean;
}
```

### 12.3 Control Suspension

During recovery:

- Movement input must not move the player.
- Jump, sprint, slide, vault, and wall-run actions must not execute.
- Manual interaction must be disabled.
- Gameplay look input may be disabled or temporarily constrained according to presentation policy.
- UI interaction must remain available where required.

The Input System remains responsible for input contexts.

Respawn System requests a gameplay control suspension through the appropriate coordinator.

It must not unregister DOM or device listeners directly.

### 12.4 Restoration

Gameplay control must only be restored after:

- Player placement succeeds.
- Movement state is reset.
- Camera state is safe.
- Required gameplay systems are ready.

Control restoration must be idempotent.

## 13. PlayerRecoveryExecutor

### 13.1 Purpose

Coordinates actual player restoration through Movement System adapters.

### 13.2 Interface

```ts
interface IPlayerRecoveryExecutor {
    placePlayer(
        destination: RespawnDestination
    ): Promise<void>;

    resetMovement(): Promise<void>;

    validatePlayerState(): Promise<boolean>;
}
```

### 13.3 Placement Sequence

1. Verify destination.
2. Ensure player control is suspended.
3. Request player placement through Movement System.
4. Request velocity reset.
5. Clear transient traversal states.
6. Recalculate grounded state.
7. Verify player state.
8. Return execution result.

### 13.4 Movement Reset Requirements

The Movement System must ensure:

- Linear velocity is cleared.
- Angular velocity is cleared when applicable.
- Jump buffer is cleared.
- Coyote-time state is reset.
- Slide state is cleared.
- Vault state is cleared.
- Wall-run state is cleared.
- Wall-jump state is cleared.
- Landing transient state is cleared.
- Ground detection is recalculated.
- Collision state is valid.

These operations belong to Movement System.

Respawn System only coordinates their execution.

### 13.5 Placement Safety

The player must not be restored at a destination where the character collider overlaps blocking geometry.

The Movement System or a dedicated spawn validation adapter must verify placement.

If validation fails, the system should request a configured fallback destination.

It must not repeatedly teleport the player between invalid destinations.

## 14. Camera Recovery Integration

### 14.1 Purpose

Camera System owns all camera presentation and transient effect resets.

Respawn System requests a camera recovery operation.

### 14.2 Interface

```ts
interface IRespawnCameraAdapter {
    prepareForRespawn(): Promise<void>;

    applySpawnRotation(
        rotation: Vector3
    ): void;

    resetTransientEffects(): Promise<void>;

    completeRespawn(): Promise<void>;
}
```

### 14.3 Required Behavior

Camera System must:

- Remove accumulated camera bob.
- Reset landing offsets.
- Reset wall-run roll.
- Reset slide and vault camera offsets.
- Restore a valid camera height.
- Apply the spawn rotation.
- Restore the normal FOV.
- Avoid visual discontinuities when control returns.

The Camera System remains responsible for reduced-motion settings.

### 14.4 Camera Failure

A camera reset failure must be reported.

It must not cause a second player placement operation.

The implementation may use a safe camera reset fallback.

The player must not remain permanently locked because of a non-critical presentation failure.

## 15. RecoveryPresentationController

### 15.1 Purpose

Coordinates visual and audio feedback during recovery.

It does not implement UI rendering or audio playback.

### 15.2 Interface

```ts
interface IRecoveryPresentationController {
    begin(
        options: RespawnPresentationOptions
    ): Promise<void>;

    showRecoveryFeedback(
        context: RespawnContext
    ): void;

    complete(
        options: RespawnPresentationOptions
    ): Promise<void>;

    cancel(): Promise<void>;
}
```

### 15.3 Initial Presentation

The initial presentation should be minimal:

- Short fade or equivalent visual transition.
- Optional concise recovery message.
- Optional checkpoint name.
- Short audio cue.
- Smooth return to normal gameplay.

The visual transition must not depend on the gameplay camera's movement effects.

UI must remain readable and must not inherit camera shake.

### 15.4 Timing

Suggested configurable defaults:

| Stage | Suggested Duration |
|---|---:|
| Begin recovery transition | 0.10–0.20 s |
| Hidden transition / placement | 0.05–0.15 s |
| Return transition | 0.15–0.25 s |

These are starting values, not fixed requirements.

The complete recovery should feel responsive.

The system must avoid artificial delays when the destination is already available.

### 15.5 Reduced Motion

When reduced motion is enabled:

- Use minimal fading.
- Avoid unnecessary camera movement.
- Avoid dramatic zoom or FOV changes.
- Avoid motion-heavy recovery presentation.

The setting is owned by the relevant application settings and Camera/UI systems.

## 16. Failure Detection Integration

### 16.1 Fall Detection

Movement System provides player fall state and relevant world position information.

Respawn System consumes an explicit recovery signal.

It must not independently implement world-boundary collision detection.

### 16.2 Kill Volumes

Level Runtime and TriggerManager provide kill-volume trigger events.

Respawn System receives the event and requests recovery.

A kill volume is a trigger type, not a special physics implementation inside Respawn System.

### 16.3 Stuck Recovery

Stuck recovery must be explicitly requested.

Possible sources:

- Development tools.
- Gameplay recovery logic.
- Training exercise controller.
- Future player state validation.

The initial implementation should not run aggressive automatic stuck detection.

### 16.4 Failure Debouncing

Fall and kill-volume signals may occur multiple times before the player is restored.

The request processor must debounce repeated signals and enforce one active recovery operation.

A configurable minimum interval may be used after successful recovery to prevent immediate repeated activation caused by overlapping triggers.

## 17. Checkpoint System Integration

### 17.1 Ownership

Checkpoint System remains the authoritative source for the active checkpoint.

Respawn System requests a destination through its public API.

### 17.2 Integration Interface

```ts
interface ICheckpointRespawnAdapter {
    resolveRespawnDestination(
        context: RespawnContext,
        preferredCheckpointId?: string
    ): Promise<RespawnDestination | null>;
}
```

The adapter may internally use Level Runtime to resolve the checkpoint's spawn point.

### 17.3 Respawn Progress

A normal respawn must not reset checkpoint progress.

The active checkpoint remains unchanged unless:

- The checkpoint becomes invalid.
- The gameplay mode explicitly requests progress reset.
- The owning system starts a new session.

### 17.4 Restart Versus Respawn

These operations are different:

**Respawn**
- Restores the player.
- Preserves the active session.
- Preserves checkpoint progress.
- Does not automatically reset the timer.

**Restart Session**
- Ends or resets the current session.
- Creates a new session lifecycle.
- Resets session-scoped checkpoint progress.
- Is coordinated by Level Runtime and Gameplay Systems.

Respawn System must not treat every manual restart as a full level restart.

## 18. Speedrun Integration

### 18.1 Purpose

Speedrun System decides how a recovery affects an active run.

Respawn System only reports and executes the recovery request.

### 18.2 Event Contract

Before recovery begins:

```ts
interface SpeedrunRespawnEvaluationRequest {
    sessionId: string;

    requestId: string;

    reason: RespawnReason;

    checkpointId?: string;

    requestedAt: number;
}
```

```ts
interface SpeedrunRespawnEvaluationResult {
    allowed: boolean;

    runStatus:
        | "continue"
        | "invalidated"
        | "failed"
        | "not-running";

    penalty?: number;

    reason?: string;
}
```

The Speedrun System owns the meaning of each result.

### 18.3 Behavior

Respawn System must:

- Notify Speedrun before a ranked recovery.
- Respect an explicit rejection.
- Execute allowed recovery.
- Publish respawn completion or failure.
- Preserve the same LevelSession unless another system explicitly ends it.

It must not:

- Stop or restart the timer directly.
- Modify split times.
- Modify medals.
- Change leaderboard records.
- Validate checkpoint order.

### 18.4 Practice and Training

For unranked practice and Training, recovery may be allowed without a Speedrun evaluation.

The active game mode and run state determine whether evaluation is required.

## 19. Pause and Application Lifecycle

Respawn operations must behave safely when the application is paused or loses focus.

### 19.1 Pause During Recovery

If gameplay pauses during recovery:

- Preserve the current recovery state.
- Prevent player control restoration until gameplay can safely resume.
- Preserve the resolved destination.
- Avoid restarting the recovery sequence.
- Resume only the remaining required operations.

### 19.2 Focus Loss

If the browser loses focus:

- Keep gameplay control suspended.
- Do not treat focus loss as a respawn request.
- Avoid interpreting missing input as a recovery signal.
- Restore normal input context only after the application lifecycle allows it.

### 19.3 Session Unload

If the level session is unloaded during recovery:

- Cancel pending operations.
- Prevent stale player placement.
- Release recovery locks.
- Remove session-scoped subscriptions.
- Do not restore gameplay control into a destroyed session.

## 20. Error Handling

### 20.1 Error Categories

```ts
type RespawnFailureReason =
    | "invalid-request"
    | "invalid-session"
    | "respawn-not-allowed"
    | "destination-not-found"
    | "destination-invalid"
    | "player-placement-failed"
    | "movement-reset-failed"
    | "camera-reset-failed"
    | "control-restoration-failed"
    | "presentation-failed"
    | "operation-cancelled"
    | "session-unloaded"
    | "speedrun-rejected"
    | "internal-error";
```

```ts
interface RespawnError {
    reason: RespawnFailureReason;

    message: string;

    requestId: string;

    sessionId: string;

    recoverable: boolean;

    cause?: unknown;
}
```

### 20.2 Failure Recovery Rules

**Destination resolution failure**
- Do not move the player.
- Attempt a configured fallback.
- Report failure if no valid fallback exists.

**Player placement failure**
- Keep control suspended.
- Attempt a safe fallback when available.
- Do not report successful recovery.

**Movement reset failure**
- Treat as a critical recovery failure.
- Do not restore normal movement control.
- Attempt a safe recovery path or escalate to the application recovery coordinator.

**Camera reset failure**
- Attempt a safe camera reset.
- Do not repeat player placement.
- Report a presentation error.

**Presentation failure**
- Continue gameplay recovery if it is safe.
- Use a minimal or no-transition fallback.
- Do not leave gameplay permanently blocked.

**Control restoration failure**
- Keep the failure visible to the application coordinator.
- Avoid claiming that respawn completed.
- Provide a controlled retry or recovery path.

### 20.3 Cleanup

Every recovery path must release:

- Operation locks.
- Temporary presentation resources.
- Temporary control locks when safe.
- Pending callbacks.
- Session-scoped event subscriptions.

Cleanup must be idempotent.

## 21. Events

### 21.1 Required Events

```ts
type RespawnEvent =
    | RespawnRequestedEvent
    | RespawnRejectedEvent
    | RespawnStartedEvent
    | RespawnDestinationResolvedEvent
    | RespawnPlacementStartedEvent
    | RespawnMovementResetEvent
    | RespawnCameraResetEvent
    | RespawnCompletedEvent
    | RespawnFailedEvent
    | RespawnCancelledEvent;
```

### 21.2 Event Payload

All events must include:

- Request ID.
- Session ID.
- Level ID where available.
- Recovery reason.
- Monotonic timestamp.

Events describing a resolved destination must also include its checkpoint and spawn point IDs.

### 21.3 Event Ordering

The expected successful sequence is:

```text
RespawnRequested
        |
        v
RespawnStarted
        |
        v
RespawnDestinationResolved
        |
        v
RespawnPlacementStarted
        |
        v
RespawnMovementReset
        |
        v
RespawnCameraReset
        |
        v
RespawnCompleted
```

Control suspension and restoration events may be published as additional diagnostics.

A completion event must never be published before player placement and required movement restoration succeed.

## 22. Performance Requirements

Respawn must not introduce unnecessary gameplay frame work.

Requirements:

- Recovery operations run asynchronously where appropriate.
- No synchronous asset loading during recovery.
- No full-level reinitialization for ordinary checkpoint respawn.
- No continuous polling when event-driven signals are available.
- No duplicate placement requests.
- No repeated allocation of persistent recovery objects.
- No unnecessary camera or environment recreation.
- All temporary resources must be released after completion.

A normal checkpoint respawn should reuse the loaded level session.

## 23. Debugging and Development Tools

The initial implementation must include a development-only Respawn Debug Panel.

It should display:

- Current respawn state.
- Active request ID.
- Current session ID.
- Recovery reason.
- Resolved checkpoint ID.
- Resolved spawn point ID.
- Player placement result.
- Movement reset result.
- Camera reset result.
- Control suspension state.
- Last recovery error.

### 23.1 Debug Actions

Development builds may support:

- Request fall recovery.
- Request manual recovery.
- Request recovery at a specified checkpoint.
- Request recovery at a specified spawn point.
- Cancel a pending request.
- Simulate destination resolution failure.
- Simulate placement failure.
- Inspect recovery event history.

Debug actions must use public interfaces.

They must not directly modify player physics or camera state.

## 24. Testing Requirements

### 24.1 Unit Tests

Test:

- Request validation.
- Duplicate request detection.
- Request priority.
- Recovery policy evaluation.
- State machine transitions.
- Destination resolution.
- Fallback destination selection.
- Operation locking.
- Cancellation.
- Error classification.
- Cleanup idempotency.

### 24.2 Integration Tests

Test:

**Training**
1. Load Training.
2. Activate a checkpoint.
3. Request fall recovery.
4. Verify destination resolution.
5. Verify player placement.
6. Verify movement reset.
7. Verify camera reset.
8. Verify control restoration.
9. Verify checkpoint progress is preserved.

**Prologue**
1. Load Prologue.
2. Activate Rooftop checkpoint.
3. Progress to Industrial.
4. Activate Industrial checkpoint.
5. Trigger fall recovery.
6. Verify respawn uses the Industrial checkpoint.
7. Verify the same LevelSession remains active.
8. Verify Speedrun receives recovery events.
9. Verify timer behavior follows Speedrun policy.

### 24.3 Failure Tests

Test:

- Invalid session.
- Missing active checkpoint.
- Invalid spawn destination.
- Invalid destination section.
- Player placement failure.
- Movement reset failure.
- Camera reset failure.
- Presentation failure.
- Control restoration failure.
- Duplicate requests.
- Cancellation during destination resolution.
- Cancellation during presentation.
- Session unload during recovery.
- Application pause during recovery.
- Repeated fall signals.
- Speedrun rejection.

### 24.4 Performance Tests

Verify:

- Normal respawn does not reload the complete level.
- Respawn does not block the rendering loop.
- No duplicate recovery operations occur.
- Temporary resources are released.
- Repeated recovery does not create retained event subscriptions.
- The system remains responsive after multiple consecutive recoveries.

## 25. Implementation Phases

### Phase 1 — Core Models and State Machine

Implement:

- RespawnRequest.
- RespawnContext.
- RespawnDestination.
- RespawnResult.
- RespawnState.
- RespawnManager.
- RespawnStateMachine.

**Deliverable:** Type-safe recovery lifecycle.

### Phase 2 — Request Processing and Policies

Implement:

- RespawnRequestProcessor.
- Duplicate request protection.
- Request validation.
- RespawnPolicyProvider.
- Training and Prologue policies.

**Deliverable:** Controlled and validated recovery requests.

### Phase 3 — Destination Resolution

Implement:

- RecoveryDestinationResolver.
- Checkpoint System adapter.
- Level Runtime integration.
- Fallback destination support.

**Deliverable:** Reliable recovery destination selection.

### Phase 4 — Player Recovery

Implement:

- PlayerControlCoordinator.
- PlayerRecoveryExecutor.
- Movement System adapter.
- Player placement validation.
- Movement state reset.

**Deliverable:** Safe player restoration.

### Phase 5 — Camera and Presentation

Implement:

- Camera recovery adapter.
- RecoveryPresentationController.
- UI integration.
- Audio integration.
- Reduced-motion handling.

**Deliverable:** Complete recovery presentation.

### Phase 6 — Speedrun Integration

Implement:

- Speedrun recovery evaluation request.
- Recovery result handling.
- Ranked and practice policy integration.
- Respawn lifecycle events.

**Deliverable:** Correct interaction between recovery and speedrun state.

### Phase 7 — Failure Recovery and Lifecycle

Implement:

- Cancellation.
- Pause handling.
- Session unload handling.
- Fallback recovery.
- Cleanup and resource release.

**Deliverable:** Robust recovery lifecycle.

### Phase 8 — Debugging and Verification

Implement:

- Development debug panel.
- Unit tests.
- Integration tests.
- Failure tests.
- Performance tests.

**Deliverable:** Verified Respawn System.

## 26. Acceptance Criteria

The implementation is accepted when:

- [ ] Respawn requests use explicit IDs and session IDs.
- [ ] Only one recovery operation can modify player placement at a time.
- [ ] Duplicate requests are handled safely.
- [ ] Recovery policies are mode-aware.
- [ ] Checkpoint System resolves the authoritative recovery destination.
- [ ] Level Runtime validates spawn availability.
- [ ] Player placement is delegated to Movement System.
- [ ] Movement transient states are reset.
- [ ] Camera transient effects are reset through Camera System.
- [ ] Gameplay control is suspended during recovery.
- [ ] Gameplay control is restored only after successful recovery.
- [ ] Training recovery works.
- [ ] Prologue recovery works.
- [ ] Checkpoint progress is preserved during normal respawn.
- [ ] Speedrun receives recovery evaluation requests where required.
- [ ] Respawn does not directly manipulate the Speedrun timer.
- [ ] UI and Audio receive recovery lifecycle events.
- [ ] Application pause and session unload are handled safely.
- [ ] Failed operations release temporary resources and locks.
- [ ] Fallback recovery is supported.
- [ ] Unit and integration tests cover normal and failure paths.

## 27. Definition of Done

The Respawn System is complete for the initial implementation when:

1. The full recovery lifecycle is implemented.
2. Recovery requests are validated and deduplicated.
3. Recovery policies work for Training and Prologue.
4. Destination resolution uses Checkpoint System and Level Runtime.
5. Player placement and physics reset use Movement System interfaces.
6. Camera restoration uses Camera System interfaces.
7. Gameplay input is suspended and restored safely.
8. Recovery presentation works with UI and Audio.
9. Speedrun integration follows the ownership boundary.
10. Pause, cancellation, and unload scenarios are safe.
11. Recovery failures have explicit handling.
12. Temporary resources and event subscriptions are released.
13. Automated tests pass.
14. No known state corruption or permanent player-control lock remains.

## 28. Final Design Constraints

The implementation agent must follow these constraints:

1. Do not implement physics or collision detection inside Respawn System.
2. Do not select checkpoints by scanning level objects.
3. Do not own spawn point definitions.
4. Do not directly manipulate camera internals.
5. Do not implement input device handling.
6. Do not own Speedrun timer or leaderboard behavior.
7. Do not reset checkpoint progress during ordinary respawn.
8. Do not recreate the complete level for a normal checkpoint respawn.
9. Keep the recovery lifecycle explicit and state-driven.
10. Prevent overlapping player placement operations.
11. Validate every recovery destination before placement.
12. Keep movement and camera operations behind dedicated interfaces.
13. Restore gameplay control only after a safe recovery.
14. Handle asynchronous cancellation and session destruction.
15. Keep events typed and session-scoped.
16. Make cleanup idempotent.
17. Do not assume a specific rendering or physics engine.
18. Keep initial implementation minimal and responsive.
19. Do not implement future features unless explicitly requested.
20. Follow `01_AGENT_RULES.md` and the architecture in `02_TECHNICAL_ARCHITECTURE.md`.
21. Respect ownership boundaries defined in `09_SPEEDRUN_SYSTEM_SPEC.md`, `10_SAVE_SYSTEM_SPEC.md`, `11_INPUT_SYSTEM_SPEC.md`, `12_MOVEMENT_SYSTEM_SPEC.md`, `13_CAMERA_SYSTEM_SPEC.md`, `15_LEVEL_RUNTIME_SYSTEM_SPEC.md`, and `16_CHECKPOINT_SYSTEM_SPEC.md`.

The Respawn System must provide a reliable and predictable recovery experience while preserving clear ownership boundaries between gameplay, movement, checkpoint, level runtime, camera, and speedrun systems.