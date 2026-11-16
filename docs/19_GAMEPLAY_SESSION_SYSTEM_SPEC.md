# 19_GAMEPLAY_SESSION_SYSTEM_SPEC.md

# Gameplay Session System Specification

**Project:** Mirror's Edge-Inspired First-Person Parkour Game  
**Document:** Gameplay Session System  
**Version:** 1.0  
**Status:** Implementation Specification  
**Priority:** Core Architecture

---

## 1. Purpose

The Gameplay Session System manages the lifecycle and coordination of an active gameplay session.

It provides a consistent entry point for starting, pausing, resuming, restarting, completing, abandoning, and unloading gameplay.

The system coordinates gameplay subsystems without taking ownership of their internal state or business logic.

It is responsible for ensuring that all participating systems agree on the current gameplay session and that session transitions happen in a predictable order.

The system must support:

- Training sessions.
- Prologue sessions.
- Speedrun sessions.
- Session restart.
- Pause and resume.
- Session completion.
- Session abandonment.
- Recovery after interrupted gameplay.
- Clean session teardown.
- Future gameplay modes.

The initial implementation must support Training and Prologue.

---

## 2. Scope

### 2.1 Responsibilities

The Gameplay Session System owns:

- Gameplay session creation.
- Session identity and metadata.
- Session lifecycle.
- Session startup orchestration.
- Session shutdown orchestration.
- Session-level transition validation.
- Coordination between gameplay subsystems.
- Session configuration.
- Session context distribution.
- Session-scoped event routing.
- Session cleanup coordination.
- Session transition error handling.

### 2.2 Non-responsibilities

The system must not own:

- Level geometry or runtime level objects.
- Level section activation.
- Player movement or physics.
- Player lifecycle and locomotion state.
- Respawn execution.
- Checkpoint activation and progress.
- Speedrun timer and validation.
- Input device processing.
- Camera presentation.
- Interaction detection and execution.
- Save storage implementation.
- UI rendering.
- Audio playback.

These responsibilities remain with their respective systems.

### 2.3 Related Specifications

This specification builds on:

- `02_TECHNICAL_ARCHITECTURE.md`
- `03_GAMEPLAY_SPEC.md`
- `07_UI_UX_SPEC.md`
- `09_SPEEDRUN_SYSTEM_SPEC.md`
- `10_SAVE_SYSTEM_SPEC.md`
- `11_INPUT_SYSTEM_SPEC.md`
- `12_MOVEMENT_SYSTEM_SPEC.md`
- `13_CAMERA_SYSTEM_SPEC.md`
- `14_INTERACTION_SYSTEM_SPEC.md`
- `15_LEVEL_RUNTIME_SYSTEM_SPEC.md`
- `16_CHECKPOINT_SYSTEM_SPEC.md`
- `17_RESPAWN_SYSTEM_SPEC.md`
- `18_PLAYER_STATE_SYSTEM_SPEC.md`

---

## 3. Core Design Principles

### 3.1 One Active Gameplay Session

Only one active gameplay session may exist at a time in the initial implementation.

A new session cannot become active until the previous session has completed teardown or has been explicitly invalidated.

### 3.2 Explicit Lifecycle

Session transitions must be explicit and validated.

Systems must not independently decide that a gameplay session has started or ended.

### 3.3 Session Identity

Every gameplay session receives a unique `sessionId`.

All session-scoped operations and events must carry this identifier.

This prevents delayed asynchronous operations from modifying a newer session.

### 3.4 Domain Ownership

The Gameplay Session System coordinates other systems but does not replace them.

For example:

- Level Runtime owns level loading and unloading.
- Player State owns the aggregated player state.
- Respawn System owns recovery execution.
- Checkpoint System owns checkpoint progress.
- Speedrun System owns timing and route validation.
- Input System owns input contexts.
- Save System owns persistence infrastructure.

### 3.5 Deterministic Transitions

Session transitions must follow a defined sequence.

The implementation must avoid partially initialized sessions, duplicated startup operations, and incomplete teardown.

### 3.6 Asynchronous Safety

Loading, initialization, and cleanup may be asynchronous.

The session coordinator must handle cancellation, stale results, and failures safely.

---

## 4. Gameplay Session Model

### 4.1 GameplaySession

The primary session model.

```ts
interface GameplaySession {
    id: string;

    mode: GameplayMode;

    levelId: string;

    status: GameplaySessionStatus;

    configuration: GameplaySessionConfiguration;

    createdAt: number;

    startedAt?: number;

    completedAt?: number;

    metadata: GameplaySessionMetadata;
}
```

The model represents session identity and configuration.

It must not contain duplicated mutable state belonging to other systems.

### 4.2 GameplayMode

```ts
type GameplayMode =
    | "training"
    | "prologue"
    | "speedrun";
```

`speedrun` may be represented as a separate mode or as a Prologue session with a Speedrun configuration, depending on the final Gameplay Specification.

The initial implementation must preserve the distinction between:

- Playing the Prologue normally.
- Playing the Prologue as a ranked Speedrun attempt.

If Speedrun is implemented as a session variant, the session model must explicitly identify that variant.

### 4.3 GameplaySessionStatus

```ts
type GameplaySessionStatus =
    | "created"
    | "preparing"
    | "loading"
    | "initializing"
    | "ready"
    | "starting"
    | "running"
    | "paused"
    | "resuming"
    | "restarting"
    | "completing"
    | "completed"
    | "abandoning"
    | "abandoned"
    | "failed"
    | "unloading"
    | "unloaded";
```

The status describes the lifecycle of the complete gameplay session.

It does not replace:

- `PlayerLifecycleState`.
- `MovementState`.
- `RespawnState`.
- `RunState`.
- `LevelSessionState`.

Each domain remains authoritative for its own state.

### 4.4 GameplaySessionConfiguration

```ts
interface GameplaySessionConfiguration {
    levelId: string;

    difficulty?: string;

    isRanked: boolean;

    enableCheckpoints: boolean;

    enableTimer: boolean;

    enableGhostRecording: boolean;

    startPointId?: string;

    seed?: number;

    customOptions?: Record<string, unknown>;
}
```

The configuration must be immutable after the session enters initialization.

Changing configuration requires creating a new session or performing an explicitly supported session restart.

`enableGhostRecording` is reserved for future Ghost Replay functionality. It must remain disabled unless that feature is implemented.

### 4.5 GameplaySessionMetadata

```ts
interface GameplaySessionMetadata {
    source: SessionStartSource;

    parentSessionId?: string;

    applicationVersion: string;

    levelVersion: string;

    routeVersion?: string;

    createdBy: "player" | "system";
}
```

```ts
type SessionStartSource =
    | "main_menu"
    | "training_menu"
    | "level_select"
    | "restart"
    | "recovery"
    | "system";
```

Metadata supports diagnostics, result validation, and future session history.

---

## 5. Session Lifecycle

### 5.1 Lifecycle Overview

A normal gameplay session follows this lifecycle:

```text
Created
   |
   v
Preparing
   |
   v
Loading
   |
   v
Initializing
   |
   v
Ready
   |
   v
Starting
   |
   v
Running
   |
   +------> Paused
   |           |
   |           v
   |        Resuming
   |           |
   +-----------+
   |
   +------> Restarting
   |           |
   |           v
   |         Ready
   |
   +------> Completing
   |           |
   |           v
   |        Completed
   |
   +------> Abandoning
   |           |
   |           v
   |        Abandoned
   |
   +------> Failed
               |
               v
            Unloading
               |
               v
            Unloaded
```

A session may enter `Failed` from any startup or runtime transition where recovery is impossible.

### 5.2 Created

The session has been requested and its configuration validated.

No gameplay systems are expected to be active yet.

### 5.3 Preparing

The coordinator prepares the required systems and validates dependencies.

Examples:

- Resolve the requested gameplay mode.
- Validate level availability.
- Validate session configuration.
- Check whether another session is active.
- Prepare loading resources.

### 5.4 Loading

The Level Runtime System is requested to load the appropriate level.

The Gameplay Session System does not load geometry directly.

It waits for the Level Runtime operation to complete.

### 5.5 Initializing

The coordinator initializes session-dependent systems.

Expected initialization includes:

- Player State.
- Player spawn configuration.
- Movement.
- Camera.
- Input contexts.
- Interaction registry.
- Checkpoint progress.
- Respawn dependencies.
- Gameplay mode-specific systems.
- Speedrun configuration when applicable.

Systems must initialize against the same `sessionId`.

### 5.6 Ready

All required systems have completed initialization.

The player may be positioned at the initial spawn point, but gameplay input must remain disabled until the session starts.

The UI may display:

- Level title.
- Starting instructions.
- Countdown.
- Ready state.
- Initial objective.

### 5.7 Starting

The coordinator performs the transition from preparation to active gameplay.

Typical operations:

1. Validate session readiness.
2. Validate the initial player state.
3. Activate the player.
4. Enable gameplay input.
5. Enable gameplay interactions.
6. Start the Speedrun timer if applicable.
7. Notify UI and Audio systems.
8. Transition the session to `running`.

The exact ordering must prevent the player from moving before the level and player are ready.

For ranked Speedrun, timer activation must follow the rules defined in `09_SPEEDRUN_SYSTEM_SPEC.md`.

### 5.8 Running

The session is actively playable.

The Gameplay Session System primarily observes lifecycle events and coordinates transitions.

It must not perform per-frame gameplay updates.

### 5.9 Paused

A session can be paused by:

- Player request.
- Application focus loss.
- System interruption.
- Explicit gameplay mode rules.

Pause behavior must be coordinated with:

- Input System.
- Player State.
- Movement System.
- Speedrun System.
- UI System.
- Audio System.

The session coordinator does not implement a separate physics pause mechanism.

The engine adapter or runtime loop must provide the required simulation suspension.

### 5.10 Resuming

The coordinator validates that the session can resume.

It restores the required input and gameplay permissions.

If the session was interrupted by application focus loss, input must not resume until focus is restored and the required input state has been refreshed.

### 5.11 Restarting

Restarting creates a new gameplay execution context or resets the existing session according to the selected restart policy.

The initial implementation should prefer a controlled restart using the existing level session when safe.

Restart must:

- Stop or invalidate active Speedrun execution.
- Cancel active interactions.
- Cancel pending respawn operations.
- Reset player transient state.
- Reset or restore checkpoint progress according to mode rules.
- Resolve the correct spawn point.
- Reset camera presentation.
- Reinitialize gameplay input.
- Restore mode-specific systems.

Restart must not leave stale asynchronous operations attached to the previous execution context.

A restart is not equivalent to creating an unrelated new session.

The session may retain its `sessionId`, but it must increment its execution generation.

```ts
interface GameplaySessionExecution {
    sessionId: string;

    generation: number;

    startedAt?: number;

    status: GameplaySessionStatus;
}
```

Every asynchronous operation must be associated with the generation in which it was created.

Results from an outdated generation must be ignored.

### 5.12 Completing

The session is ending normally.

Typical causes:

- Prologue finish trigger.
- Training completion.
- Explicit objective completion.
- Mode-specific completion condition.

The coordinator requests the appropriate domain systems to finalize their results.

For Speedrun:

- Finalize the timer.
- Validate the run.
- Calculate statistics.
- Submit the result to the local leaderboard when valid.

The Gameplay Session System does not calculate medals or leaderboard rankings.

### 5.13 Abandoning

The player explicitly leaves the session without completing it.

Typical causes:

- Returning to the main menu.
- Leaving Training.
- Exiting a Prologue attempt.

The coordinator requests the relevant systems to terminate their active operations.

For Speedrun, abandonment must be reported to the Speedrun System so the attempt can be marked appropriately.

### 5.14 Failed

A session enters this state when it cannot continue safely.

Examples:

- Required level initialization failed.
- Essential gameplay dependency failed.
- Session configuration is invalid.
- Runtime integrity cannot be maintained.
- Critical system initialization timed out.

Recoverable failures should be handled without unnecessarily destroying the entire application.

### 5.15 Unloading and Unloaded

The coordinator requests Level Runtime teardown and waits for session-scoped systems to release their resources.

After successful cleanup, the session becomes `unloaded`.

The active session reference must be cleared only after the required teardown operations have completed or been safely invalidated.

---

## 6. Core Architecture

### 6.1 Components

The initial implementation should contain:

- `GameplaySessionManager`
- `GameplaySessionCoordinator`
- `GameplaySessionFactory`
- `GameplaySessionValidator`
- `GameplaySessionTransitionGuard`
- `GameplaySessionLifecycle`
- `GameplaySessionContext`
- `GameplaySessionEvents`
- `GameplaySessionPolicyProvider`
- `GameplaySessionCleanupCoordinator`

### 6.2 GameplaySessionManager

The public entry point for session operations.

Responsibilities:

- Create a session.
- Start a session.
- Pause and resume.
- Restart.
- Complete.
- Abandon.
- Query the active session.
- Subscribe to lifecycle events.

It must not contain the detailed initialization logic of every subsystem.

```ts
interface IGameplaySessionManager {
    getActiveSession(): GameplaySession | null;

    startSession(
        request: StartSessionRequest
    ): Promise<SessionOperationResult>;

    pauseSession(
        reason: SessionPauseReason
    ): Promise<SessionOperationResult>;

    resumeSession(): Promise<SessionOperationResult>;

    restartSession(
        request?: RestartSessionRequest
    ): Promise<SessionOperationResult>;

    completeSession(
        result: SessionCompletionRequest
    ): Promise<SessionOperationResult>;

    abandonSession(
        reason: SessionAbandonReason
    ): Promise<SessionOperationResult>;

    getSessionSnapshot(): GameplaySessionSnapshot | null;
}
```

### 6.3 GameplaySessionCoordinator

Coordinates the lifecycle and startup sequence.

Responsibilities:

- Resolve required subsystem dependencies.
- Execute startup phases.
- Coordinate pause and resume.
- Coordinate restart.
- Coordinate completion.
- Coordinate teardown.
- Handle failures.
- Reject invalid or conflicting transitions.

It is the central orchestrator.

### 6.4 GameplaySessionFactory

Creates session models and their immutable configuration.

Responsibilities:

- Generate unique session IDs.
- Apply mode defaults.
- Validate initial configuration.
- Generate metadata.
- Assign execution generation.

It does not load levels or initialize gameplay systems.

### 6.5 GameplaySessionValidator

Validates whether a session operation is allowed.

Examples:

- Starting while another session is running.
- Pausing an unloaded session.
- Resuming a completed session.
- Restarting while teardown is in progress.
- Completing an abandoned session.
- Starting a ranked run with an unsupported route version.

### 6.6 GameplaySessionTransitionGuard

Prevents concurrent lifecycle transitions.

The system must support only one lifecycle-changing operation at a time.

```ts
interface IGameplaySessionTransitionGuard {
    acquire(
        sessionId: string,
        operation: SessionOperationType
    ): Promise<TransitionLockResult>;

    release(
        sessionId: string,
        operationId: string
    ): void;

    isTransitioning(sessionId: string): boolean;
}
```

The implementation must be cancellation-safe and must release transition locks in all success and failure paths.

---

## 7. Session Context

### 7.1 GameplaySessionContext

The context provides a shared reference to the active session.

```ts
interface GameplaySessionContext {
    sessionId: string;

    generation: number;

    mode: GameplayMode;

    levelId: string;

    configuration: Readonly<GameplaySessionConfiguration>;

    isCurrent(): boolean;
}
```

Systems receive the context during initialization.

The context must be immutable.

### 7.2 Session Context Validation

Every session-scoped asynchronous operation must validate that its context is still current before committing results.

Example:

```ts
async function initializeSystem(
    context: GameplaySessionContext
): Promise<void> {
    const result = await performInitialization();

    if (!context.isCurrent()) {
        return;
    }

    applyInitialization(result);
}
```

The actual implementation must use the project's established cancellation and dependency-injection conventions.

### 7.3 Session Scope

A system instance may be:

- Application-scoped.
- Session-scoped.
- Execution-scoped.
- Operation-scoped.

The initial architecture should use the following guidelines:

**Application-scoped:**

- Save System.
- Settings.
- Audio configuration.
- Global UI services.
- Input device management.

**Session-scoped:**

- Level Runtime session.
- Checkpoint progress.
- Interaction registrations.
- Player gameplay state.
- Session-specific gameplay configuration.

**Execution-scoped:**

- Restart-sensitive operations.
- Respawn operations.
- Speedrun attempt execution.
- Temporary player recovery tasks.

Application-scoped systems must not retain stale references to unloaded session objects.

---

## 8. Subsystem Integration

### 8.1 Integration Contract

Each participating system must expose an explicit session lifecycle contract.

```ts
interface IGameplaySessionParticipant {
    readonly id: string;

    prepare(
        context: GameplaySessionContext
    ): Promise<void>;

    initialize(
        context: GameplaySessionContext
    ): Promise<void>;

    activate(
        context: GameplaySessionContext
    ): Promise<void>;

    suspend(
        context: GameplaySessionContext,
        reason: SessionPauseReason
    ): Promise<void>;

    resume(
        context: GameplaySessionContext
    ): Promise<void>;

    reset(
        context: GameplaySessionContext,
        generation: number
    ): Promise<void>;

    shutdown(
        context: GameplaySessionContext
    ): Promise<void>;
}
```

Not every system needs to implement every method.

Optional lifecycle capabilities should be represented explicitly rather than by silently ignoring required operations.

### 8.2 Level Runtime System

The Level Runtime System:

- Loads the requested level.
- Creates the Level Session.
- Registers runtime objects.
- Resolves initial spawn points.
- Activates the initial section.
- Releases level resources during teardown.

The Gameplay Session System waits for Level Runtime results.

It does not manipulate level geometry or directly activate sections.

### 8.3 Player State System

The Player State System:

- Initializes the player lifecycle.
- Activates or disables the player.
- Provides the current player state snapshot.
- Coordinates player availability during pause and recovery.

The Gameplay Session System requests lifecycle transitions through the Player State interface.

It does not directly modify movement state or player capability flags.

### 8.4 Movement System

The Movement System:

- Initializes movement configuration.
- Resets transient traversal state during restart.
- Suspends simulation when required.
- Restores movement after valid activation.
- Maintains its own movement state machine.

The Gameplay Session System must not reset movement by directly changing internal movement variables.

### 8.5 Camera System

The Camera System:

- Initializes the camera rig.
- Applies the initial spawn orientation.
- Resets transient camera effects.
- Handles pause-related presentation.
- Restores normal camera behavior after resume.

Camera initialization must not alter player physics.

### 8.6 Input System

The Input System:

- Switches to the appropriate input context.
- Disables gameplay actions during preparation.
- Enables gameplay actions when the session starts.
- Preserves UI navigation during pause.
- Prevents stuck input after focus loss.
- Restores input safely during resume.

The Gameplay Session System does not read raw keyboard, mouse, or gamepad events.

### 8.7 Interaction System

The Interaction System:

- Initializes session-specific interactables.
- Registers and unregisters runtime targets.
- Enables interaction when gameplay is active.
- Cancels active interactions during restart and teardown.
- Prevents interactions during invalid lifecycle states.

### 8.8 Checkpoint System

The Checkpoint System:

- Initializes checkpoint progress for the session.
- Resolves the active checkpoint.
- Resets progress according to the selected restart policy.
- Releases session-scoped checkpoint data.

It remains the authority for checkpoint activation and progress.

### 8.9 Respawn System

The Respawn System:

- Handles player recovery requests.
- Resolves recovery destinations.
- Executes recovery lifecycle.
- Cancels operations when the session is unloading.
- Prevents stale recovery operations from affecting a newer execution generation.

The Gameplay Session System must not implement respawn itself.

During restart, the coordinator must ensure that active respawn operations are completed or cancelled before starting a new execution generation.

### 8.10 Speedrun System

The Speedrun System:

- Initializes attempt state when required.
- Starts and stops its own timer.
- Tracks checkpoints and splits.
- Validates run completion.
- Handles abandonment.
- Produces the final run result.

The Gameplay Session System controls when the Speedrun lifecycle is invoked.

It does not own the timer or calculate leaderboard results.

### 8.11 Save System

The Save System provides persistence infrastructure.

The Gameplay Session System may request persistence of:

- Completed Training progress.
- Prologue completion.
- Speedrun results.
- Session-related progression.

It must not write directly to IndexedDB.

Persistence failures must not leave a completed gameplay session in an ambiguous lifecycle state.

### 8.12 UI System

The UI System presents:

- Loading.
- Ready.
- Countdown.
- Pause.
- Resume.
- Completion.
- Failure.
- Abandon confirmation.

The session coordinator emits events and state snapshots.

UI must not become the authority for gameplay session state.

### 8.13 Audio System

The Audio System reacts to lifecycle events.

Examples:

- Gameplay start.
- Pause.
- Resume.
- Session completion.
- Session abandonment.
- Loading transitions.

The session coordinator does not directly play audio clips.

---

## 9. Startup Orchestration

### 9.1 Start Request

```ts
interface StartSessionRequest {
    mode: GameplayMode;

    levelId: string;

    configuration?: Partial<GameplaySessionConfiguration>;

    startPointId?: string;

    source: SessionStartSource;
}
```

### 9.2 Startup Sequence

The initial startup sequence must follow these phases:

1. Validate the request.
2. Verify that no conflicting session transition is active.
3. Create a new session.
4. Create the session context.
5. Prepare participating systems.
6. Load the level through Level Runtime.
7. Initialize session-scoped systems.
8. Resolve the initial player spawn.
9. Initialize player and camera.
10. Initialize mode-specific systems.
11. Validate readiness.
12. Enter `ready`.
13. Execute the start transition.
14. Enable gameplay.
15. Enter `running`.

The exact initialization order must be defined by explicit dependencies.

Avoid relying on arbitrary registration order.

### 9.3 Dependency Ordering

Subsystem initialization should use dependency declarations.

Example:

```ts
interface SessionParticipantDefinition {
    id: string;

    dependencies: string[];

    required: boolean;

    phase:
        | "prepare"
        | "initialize"
        | "activate";
}
```

Example dependency relationships:

- Player initialization depends on Level Runtime spawn availability.
- Camera initialization depends on player spawn configuration.
- Interaction initialization depends on Level Runtime registrations.
- Speedrun initialization depends on route configuration.
- Input activation depends on session readiness.
- Player activation depends on successful initialization.

A participant must not be activated before its required dependencies are ready.

### 9.4 Startup Failure

If a required participant fails:

1. Stop further initialization.
2. Cancel outstanding startup operations.
3. Mark the session as failed.
4. Disable gameplay input.
5. Prevent player activation.
6. Clean up successfully initialized participants.
7. Unload the level if necessary.
8. Notify UI.
9. Release the session transition lock.

Optional participant failure may be tolerated only when the session policy explicitly allows it.

---

## 10. Pause and Resume

### 10.1 Pause Request

```ts
type SessionPauseReason =
    | "player"
    | "focus_lost"
    | "system"
    | "debug";
```

Pause requests must be idempotent.

Repeated pause requests must not cause repeated subsystem suspension.

### 10.2 Pause Sequence

1. Validate that the session is running.
2. Enter the pause transition.
3. Disable gameplay input.
4. Suspend player gameplay control.
5. Suspend gameplay interactions.
6. Suspend gameplay simulation according to runtime policy.
7. Notify Speedrun System.
8. Notify Audio and UI systems.
9. Enter `paused`.

The Speedrun System determines whether pausing is allowed in the current mode.

A ranked run must follow the restrictions defined in `09_SPEEDRUN_SYSTEM_SPEC.md`.

The session coordinator must not silently pause or resume a ranked timer against Speedrun policy.

### 10.3 Resume Sequence

1. Validate the session and application focus.
2. Validate that the level is still available.
3. Validate player availability.
4. Restore required simulation.
5. Restore player control.
6. Restore interaction availability.
7. Restore gameplay input.
8. Notify Speedrun System.
9. Notify Audio and UI systems.
10. Enter `running`.

Gameplay input must not become available before the player and simulation are ready.

### 10.4 Focus Loss

Application focus loss must be treated as a session interruption.

The Input System is responsible for clearing device state and preventing stuck actions.

The session coordinator determines whether the session should enter `paused`.

The system must not assume that browser focus loss always means the player explicitly requested a pause.

---

## 11. Restart Policy

### 11.1 Restart Types

```ts
type SessionRestartReason =
    | "player_request"
    | "training_restart"
    | "level_restart"
    | "system_recovery";
```

### 11.2 Restart Request

```ts
interface RestartSessionRequest {
    reason: SessionRestartReason;

    checkpointPolicy:
        | "preserve"
        | "reset"
        | "initial";

    startPointId?: string;
}
```

### 11.3 Restart Behavior

The restart policy depends on the gameplay mode.

**Training:**

- Restart the current exercise or training area.
- Preserve unrelated Training progress.
- Restore the appropriate initial player state.

**Prologue:**

- Restart the Prologue according to the selected checkpoint policy.
- Reset temporary section-specific state.
- Restore the initial or requested spawn point.

**Speedrun:**

- The Speedrun System determines whether restart invalidates the current attempt.
- A new attempt must receive a new attempt identity.
- Timer and splits must not accidentally continue from the previous attempt.
- Route validation must use the current route version.

### 11.4 Restart Safety

Before restarting:

- Cancel active interactions.
- Cancel pending respawn operations.
- Suspend player control.
- Stop active execution-sensitive timers through their owning systems.
- Invalidate the previous execution generation.
- Reset player transient state.
- Resolve the destination.
- Restore camera state.
- Initialize the new execution generation.

The operation must be atomic from the player's perspective.

The player must never be left in an active but partially reset state.

---

## 12. Completion and Abandonment

### 12.1 Completion Request

```ts
interface SessionCompletionRequest {
    reason: string;

    resultData?: Record<string, unknown>;
}
```

Completion must be initiated by an authoritative gameplay event or mode-specific completion condition.

For Prologue, the Finish section and its completion trigger provide the appropriate signal.

The session coordinator validates the request and delegates result calculation to the owning system.

### 12.2 Completion Sequence

1. Validate completion conditions.
2. Enter `completing`.
3. Disable gameplay input.
4. Suspend player control.
5. Cancel active interactions.
6. Finalize Speedrun state if applicable.
7. Collect mode-specific results.
8. Request persistence where required.
9. Notify UI and Audio.
10. Enter `completed`.

The completion presentation may remain visible while the level remains loaded.

Unloading should happen only when the player leaves the result screen or starts another session.

### 12.3 Abandonment

```ts
type SessionAbandonReason =
    | "main_menu"
    | "level_selection"
    | "player_exit"
    | "system_shutdown";
```

Abandonment is distinct from successful completion.

The system must notify Speedrun and other mode-specific systems before teardown.

A player must not be able to abandon a session and accidentally produce a successful completion result.

---

## 13. Session Cleanup

### 13.1 Cleanup Responsibilities

The `GameplaySessionCleanupCoordinator` ensures that session-scoped resources are released.

Cleanup includes:

- Disable gameplay input.
- Disable player gameplay control.
- Cancel pending interactions.
- Cancel respawn operations.
- Stop session-specific timers through their owners.
- Unregister runtime interactables.
- Release checkpoint session state.
- Release player session state.
- Unload Level Runtime session.
- Remove session-specific event subscriptions.
- Release session-scoped references.
- Clear the active session.

### 13.2 Cleanup Ordering

Cleanup must follow reverse dependency order where appropriate.

For example:

1. Stop new gameplay operations.
2. Disable input and interactions.
3. Cancel execution-sensitive operations.
4. Shut down mode-specific systems.
5. Shut down player-dependent systems.
6. Unload Level Runtime.
7. Release remaining session-scoped resources.
8. Clear active session context.

The exact order must be validated against actual dependency relationships.

### 13.3 Idempotent Cleanup

Cleanup must be safe to invoke more than once.

If a participant has already been shut down, another shutdown request must not cause an error or duplicate resource release.

### 13.4 Cleanup Failure

A failed cleanup operation must not allow stale resources to be reused by a new session.

The coordinator must:

- Record the failure.
- Invalidate the old session context.
- Continue best-effort cleanup where safe.
- Prevent stale callbacks from committing changes.
- Report diagnostics.
- Release resources that can be safely released.

A cleanup failure must be visible to the development diagnostics system.

---

## 14. Events

### 14.1 GameplaySessionEvents

All lifecycle events must include session identity and monotonic timestamps.

```ts
interface GameplaySessionEvent {
    sessionId: string;

    generation: number;

    timestamp: number;

    eventId: string;
}
```

### 14.2 Event Types

```ts
type GameplaySessionEventType =
    | "session_created"
    | "session_preparing"
    | "session_loading"
    | "session_initializing"
    | "session_ready"
    | "session_started"
    | "session_paused"
    | "session_resuming"
    | "session_restarted"
    | "session_completing"
    | "session_completed"
    | "session_abandoning"
    | "session_abandoned"
    | "session_failed"
    | "session_unloading"
    | "session_unloaded";
```

### 14.3 Event Ordering

Events must be emitted after the corresponding state transition has been committed.

Consumers must not infer successful initialization from a `session_initializing` event.

A `session_ready` event guarantees that all required initialization operations have completed.

### 14.4 Stale Event Handling

Consumers must ignore events that belong to:

- An outdated session.
- An invalid execution generation.
- A session that has already been unloaded.

Events should be dispatched through the established application event infrastructure.

Avoid direct dependencies between unrelated systems.

---

## 15. Session Snapshot

The system exposes an immutable snapshot for UI and diagnostics.

```ts
interface GameplaySessionSnapshot {
    session: Readonly<GameplaySession>;

    execution: Readonly<GameplaySessionExecution>;

    status: GameplaySessionStatus;

    canPause: boolean;

    canResume: boolean;

    canRestart: boolean;

    canComplete: boolean;

    canAbandon: boolean;

    isTransitioning: boolean;

    activeOperation?: string;
}
```

Capabilities must be derived from:

- Current session status.
- Session mode.
- Session policy.
- Relevant domain system state.

They must not become independently mutable booleans.

The snapshot is not a replacement for Player State or Speedrun snapshots.

---

## 16. Session Policies

### 16.1 GameplaySessionPolicyProvider

Policies define which operations are allowed for each mode.

```ts
interface GameplaySessionPolicy {
    allowPause: boolean;

    allowRestart: boolean;

    allowAbandon: boolean;

    allowManualCheckpointSelection: boolean;

    allowFocusLossPause: boolean;

    requireRankedValidation: boolean;
}
```

### 16.2 Training Policy

Initial defaults:

- Pause allowed.
- Restart allowed.
- Abandon allowed.
- Checkpoint selection may be allowed where Training supports it.
- Focus-loss pause allowed.
- No ranked validation required.

### 16.3 Prologue Policy

Initial defaults:

- Pause allowed.
- Restart allowed.
- Abandon allowed.
- Checkpoint selection follows the Prologue design rules.
- Focus-loss pause allowed.
- Normal completion validation required.

### 16.4 Speedrun Policy

Initial defaults:

- Restart behavior controlled by Speedrun rules.
- Pause behavior controlled by ranked-run policy.
- Abandonment invalidates or abandons the active attempt.
- Checkpoint sequence validation required.
- Route version validation required.
- Focus-loss behavior must follow the ranked attempt policy.

These defaults must be reconciled with `09_SPEEDRUN_SYSTEM_SPEC.md`.

The session policy must not override a stricter rule owned by a specialized system.

---

## 17. Error Handling

### 17.1 Error Model

```ts
type SessionErrorCode =
    | "INVALID_REQUEST"
    | "SESSION_ALREADY_ACTIVE"
    | "SESSION_NOT_FOUND"
    | "INVALID_TRANSITION"
    | "CONFIGURATION_INVALID"
    | "LEVEL_LOAD_FAILED"
    | "PARTICIPANT_INITIALIZATION_FAILED"
    | "PLAYER_INITIALIZATION_FAILED"
    | "SESSION_NOT_READY"
    | "OPERATION_IN_PROGRESS"
    | "OPERATION_CANCELLED"
    | "STALE_SESSION_CONTEXT"
    | "CLEANUP_FAILED"
    | "PERSISTENCE_FAILED"
    | "UNKNOWN_ERROR";
```

### 17.2 Operation Result

```ts
interface SessionOperationResult {
    success: boolean;

    sessionId?: string;

    error?: {
        code: SessionErrorCode;

        message: string;

        systemId?: string;

        recoverable: boolean;
    };
}
```

### 17.3 Failure Isolation

A non-critical subsystem failure must not automatically crash the entire application.

The coordinator must distinguish:

- Required participant failure.
- Optional participant failure.
- Recoverable operation failure.
- Fatal session failure.
- Cleanup failure.

Error messages intended for players must be separate from technical diagnostics.

---

## 18. Time and Execution Rules

### 18.1 Monotonic Time

Session lifecycle timestamps must use a monotonic time source.

Use the same application timing abstraction established for gameplay timing.

Do not use wall-clock time for measuring elapsed gameplay duration.

### 18.2 Asynchronous Operations

Every asynchronous lifecycle operation must:

- Have an operation identifier.
- Have a session identifier.
- Have an execution generation.
- Support cancellation where possible.
- Validate context before committing results.
- Release locks in all exit paths.

### 18.3 No Per-Frame Work

The Gameplay Session System is event-driven.

It must not perform:

- Movement updates.
- Camera updates.
- Physics updates.
- Input polling.
- Interaction detection.
- Timer ticking.

Those systems operate independently.

---

## 19. Initial Implementation Scope

The initial implementation must include:

- Single active gameplay session.
- Training session creation.
- Prologue session creation.
- Session identity.
- Session configuration.
- Startup orchestration.
- Required participant initialization.
- Ready and running states.
- Pause and resume.
- Restart.
- Completion.
- Abandonment.
- Session failure handling.
- Cleanup.
- Execution generation.
- Session-scoped events.
- Immutable session snapshots.
- Focus-loss handling.
- Integration with Speedrun.
- Integration with Level Runtime.
- Integration with Player State.
- Integration with Respawn.

### 19.1 Deferred Features

The following are not required for the initial implementation:

- Multiplayer sessions.
- Network-hosted sessions.
- Cooperative gameplay.
- Spectator sessions.
- Session migration between devices.
- Cloud session recovery.
- Reconnectable network sessions.
- Background simulation.
- Multiple simultaneous gameplay sessions.
- Session matchmaking.
- Shared online progression.
- Advanced session analytics.

The architecture should avoid preventing these features but must not implement them prematurely.

---

## 20. Testing Requirements

### 20.1 Session Lifecycle Tests

Test:

- Create a Training session.
- Create a Prologue session.
- Start a valid session.
- Reject invalid session configuration.
- Reject a second active session.
- Complete a session.
- Abandon a session.
- Unload a session.

### 20.2 Startup Tests

Test:

- Successful participant initialization.
- Level loading failure.
- Player initialization failure.
- Optional participant failure.
- Required participant failure.
- Cancellation during loading.
- Cancellation during initialization.
- Stale initialization results.

### 20.3 Pause and Resume Tests

Test:

- Pause while running.
- Duplicate pause requests.
- Resume while paused.
- Resume before focus is restored.
- Invalid resume request.
- Pause during an unsupported transition.
- Input remains disabled until resume is complete.

### 20.4 Restart Tests

Test:

- Restart Training.
- Restart Prologue.
- Restart from a selected spawn point.
- Preserve checkpoint progress.
- Reset checkpoint progress.
- Restart during active interaction.
- Restart during respawn.
- Restart during loading.
- Repeated restart requests.
- Stale operations from the previous generation.

### 20.5 Completion Tests

Test:

- Valid Prologue completion.
- Invalid completion request.
- Speedrun completion delegation.
- Completion persistence failure.
- Completion presentation without immediate unloading.
- Duplicate completion requests.

### 20.6 Cleanup Tests

Test:

- Normal cleanup.
- Duplicate cleanup.
- Cleanup after startup failure.
- Cleanup during pause.
- Cleanup during respawn.
- Cleanup with pending asynchronous operations.
- Cleanup failure in one participant.
- No stale session references after unload.

### 20.7 Integration Tests

Test complete flows:

**Training:**

```text
Main Menu
  -> Create Training Session
  -> Load Level
  -> Initialize Player
  -> Ready
  -> Running
  -> Pause
  -> Resume
  -> Restart Exercise
  -> Complete Training
  -> Unload
```

**Prologue:**

```text
Main Menu
  -> Create Prologue Session
  -> Load Level
  -> Initialize Gameplay
  -> Ready
  -> Running
  -> Activate Checkpoints
  -> Reach Finish
  -> Complete Session
  -> Show Results
  -> Unload
```

**Speedrun:**

```text
Main Menu
  -> Create Speedrun Session
  -> Validate Route
  -> Load Level
  -> Initialize Run
  -> Ready
  -> Start Attempt
  -> Complete Checkpoints
  -> Finish Run
  -> Validate Result
  -> Save Result
  -> Show Results
```

---

## 21. Implementation Phases

### Phase 1: Core Models

Implement:

- GameplaySession.
- GameplaySessionConfiguration.
- GameplaySessionMetadata.
- GameplaySessionExecution.
- GameplaySessionContext.
- GameplaySessionSnapshot.
- Session operation result types.

### Phase 2: Lifecycle Coordinator

Implement:

- GameplaySessionManager.
- GameplaySessionCoordinator.
- GameplaySessionFactory.
- GameplaySessionValidator.
- GameplaySessionTransitionGuard.
- Explicit transition rules.

### Phase 3: Startup Integration

Integrate:

- Level Runtime.
- Player State.
- Movement.
- Camera.
- Input.
- Interaction.
- Checkpoint.

Implement dependency-aware initialization.

### Phase 4: Runtime Lifecycle

Implement:

- Running.
- Pause.
- Resume.
- Focus-loss handling.
- Restart.
- Execution generation.

### Phase 5: Completion and Cleanup

Implement:

- Completion.
- Abandonment.
- Failure handling.
- Cleanup coordinator.
- Session unloading.
- Stale operation invalidation.

### Phase 6: Speedrun Integration

Integrate:

- Speedrun initialization.
- Timer lifecycle.
- Ranked pause policy.
- Restart behavior.
- Attempt abandonment.
- Result finalization.

### Phase 7: Validation

Run:

- Unit tests.
- Integration tests.
- Lifecycle stress tests.
- Cancellation tests.
- Repeated transition tests.
- Memory and resource cleanup tests.

---

## 22. Acceptance Criteria

The implementation is accepted when:

1. Only one active gameplay session can exist.
2. Every session has a unique identity.
3. Session startup follows an explicit dependency-aware sequence.
4. Required systems are initialized before gameplay becomes available.
5. Invalid transitions are rejected.
6. Concurrent lifecycle operations are prevented.
7. Pause and resume are coordinated across relevant systems.
8. Focus loss cannot leave input actions stuck.
9. Restart invalidates outdated execution operations.
10. Restart does not duplicate or leak session resources.
11. Completion is delegated to authoritative gameplay systems.
12. Abandonment cannot be mistaken for successful completion.
13. Speedrun rules remain owned by the Speedrun System.
14. Checkpoint progress remains owned by the Checkpoint System.
15. Player lifecycle remains owned by the Player State System.
16. Respawn remains owned by the Respawn System.
17. Level loading and unloading remain owned by Level Runtime.
18. Cleanup is idempotent.
19. Failed initialization cannot leave partially active gameplay.
20. Stale asynchronous results cannot modify a newer session.
21. Session events are correctly scoped and ordered.
22. No gameplay subsystem depends on UI state to determine session validity.

---

## 23. Definition of Done

The Gameplay Session System is complete when:

- [ ] All core session models and interfaces are implemented.
- [ ] Lifecycle transitions are explicitly defined.
- [ ] Transition validation is implemented.
- [ ] Single-session enforcement works.
- [ ] Startup orchestration is implemented.
- [ ] Dependency ordering is implemented.
- [ ] Training integration works.
- [ ] Prologue integration works.
- [ ] Speedrun integration works.
- [ ] Pause and resume work.
- [ ] Focus-loss handling works.
- [ ] Restart behavior works.
- [ ] Execution generation prevents stale operations.
- [ ] Completion and abandonment work.
- [ ] Cleanup is idempotent.
- [ ] Failure handling is implemented.
- [ ] Session snapshots are immutable.
- [ ] Session events are documented.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] No duplicate ownership of subsystem state exists.
- [ ] No session-scoped resources remain after successful unload.
- [ ] Architecture follows `01_AGENT_RULES.md` and `02_TECHNICAL_ARCHITECTURE.md`.

---

## 24. Final Design Constraints

1. Gameplay Session System is the authoritative owner of gameplay session lifecycle.
2. Only one active gameplay session is supported initially.
3. Every session must have a unique `sessionId`.
4. Every restart-sensitive execution must have a generation identifier.
5. Session transitions must be explicit and validated.
6. Startup must be dependency-aware.
7. Required participants must initialize before gameplay starts.
8. Gameplay input must remain disabled until the session is ready.
9. Pause and resume must coordinate all relevant systems.
10. Session restart must invalidate stale asynchronous operations.
11. Completion and abandonment must remain distinct.
12. Session teardown must be idempotent.
13. The Gameplay Session System must not own level, movement, camera, input, interaction, checkpoint, respawn, or Speedrun business logic.
14. Specialized systems remain authoritative for their own domain state.
15. All session-scoped operations must validate their session context.
16. No UI component may become the authority for session lifecycle.
17. No per-frame gameplay logic belongs in the session coordinator.
18. The architecture must remain compatible with future gameplay modes without implementing unnecessary infrastructure now.

**End of Specification**