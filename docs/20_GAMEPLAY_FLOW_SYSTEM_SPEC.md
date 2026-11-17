# 20_GAMEPLAY_FLOW_SYSTEM_SPEC.md

# Gameplay Flow System Specification

**Project:** Mirror's Edge-Inspired First-Person Parkour Game  
**Document:** Gameplay Flow System  
**Version:** 1.0  
**Status:** Implementation Specification  
**Priority:** Core Application Architecture

---

## 1. Purpose

The Gameplay Flow System defines how the player navigates through the application and how the application transitions between major gameplay experiences.

It connects the Main Menu, Training, Prologue, Speedrun, Pause, Results, Settings, and other application-level screens into a coherent user experience.

The system coordinates high-level application flow while delegating gameplay execution and domain-specific behavior to specialized systems.

It provides:

- A predictable navigation structure.
- Explicit application flow states.
- Screen and mode transition orchestration.
- Entry and exit conditions for gameplay experiences.
- Loading and transition presentation.
- Navigation history where appropriate.
- Safe handling of interrupted transitions.
- Consistent integration with Gameplay Session System.

The initial implementation must provide a complete flow for Training and Prologue.

---

## 2. Scope and Ownership

### 2.1 Responsibilities

The Gameplay Flow System owns:

- High-level application flow.
- Main Menu navigation.
- Gameplay mode selection.
- Level selection entry points.
- Transition between application screens.
- Pause menu navigation.
- Results screen navigation.
- Confirmation flows for destructive actions.
- Loading screen orchestration.
- High-level navigation history.
- Transition validation.
- Flow restoration after gameplay session termination.
- Coordination of UI navigation with gameplay lifecycle.

### 2.2 Non-responsibilities

The system does not own:

- Actual gameplay session lifecycle.
- Level loading implementation.
- Level geometry or section activation.
- Player movement or physics.
- Checkpoint activation.
- Respawn execution.
- Speedrun timer or run validation.
- Training exercise logic.
- Persistent progression rules.
- Settings persistence.
- UI visual implementation.
- Input device processing.
- Save storage implementation.

These responsibilities remain with the relevant systems.

### 2.3 Related Specifications

- `01_AGENT_RULES.md`
- `02_TECHNICAL_ARCHITECTURE.md`
- `03_GAMEPLAY_SPEC.md`
- `07_UI_UX_SPEC.md`
- `09_SPEEDRUN_SYSTEM_SPEC.md`
- `10_SAVE_SYSTEM_SPEC.md`
- `11_INPUT_SYSTEM_SPEC.md`
- `14_INTERACTION_SYSTEM_SPEC.md`
- `15_LEVEL_RUNTIME_SYSTEM_SPEC.md`
- `18_PLAYER_STATE_SYSTEM_SPEC.md`
- `19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`

---

## 3. Design Principles

### 3.1 Flow Is Not Gameplay State

Application navigation state must remain separate from gameplay domain state.

For example:

- Opening Pause Menu does not create a new gameplay session.
- Opening Settings does not change the player's movement state.
- Displaying Results does not itself complete a Speedrun.
- Returning to Main Menu does not directly unload level objects.

The Flow System requests operations from the responsible systems and reacts to their results.

### 3.2 Explicit Navigation

Every major navigation transition must be represented explicitly.

Avoid navigation based on scattered boolean variables such as:

```ts
isMainMenuOpen
isPauseMenuOpen
isResultsVisible
isLoading
isPlaying
```

These values can create contradictory UI states.

Use one authoritative flow state and explicit transition requests.

### 3.3 Single Navigation Authority

The Gameplay Flow System is the authority for high-level navigation.

Individual UI components must not independently decide which application screen becomes active.

### 3.4 Domain Ownership

The Flow System coordinates specialized systems but never replaces them.

### 3.5 Recoverable Transitions

A failed screen or gameplay transition must produce a defined recovery path.

The player must never be left in an inaccessible or contradictory application state.

### 3.6 Presentation Independence

Flow state must not depend on animation completion.

UI transitions may animate, but application state must remain correct even when animations are disabled, interrupted, or skipped.

---

## 4. Application Structure

### 4.1 High-Level Navigation Map

```text
Application
    |
    v
Main Menu
    |
    +----------------------+
    |          |           |
    v          v           v
 Training   Prologue    Settings
    |          |
    v          v
 Training   Prologue
 Selection   Preparation
    |          |
    v          v
 Training   Prologue
 Session     Session
    |          |
    +-----+----+
          |
          v
       Gameplay
          |
    +-----+----------+
    |        |       |
    v        v       v
  Pause   Completion Failure
    |        |       |
    v        v       v
  Resume   Results Recovery
    |        |       |
    +--------+-------+
          |
          v
     Main Menu
```

The diagram describes logical navigation, not a requirement to create a separate scene for every state.

### 4.2 Initial Screens

The initial implementation must support:

- Main Menu.
- Training Selection.
- Prologue Introduction.
- Loading.
- Ready / Start Presentation.
- Gameplay HUD.
- Pause Menu.
- Settings.
- Results.
- Confirmation Dialog.
- Error / Recovery Presentation.

Some screens may be overlays rather than full-screen destinations.

### 4.3 Navigation Layers

The application should distinguish three navigation layers:

**Application Layer**

- Main Menu.
- Mode Selection.
- Training Selection.
- Settings.
- Results.

**Gameplay Layer**

- Gameplay HUD.
- Pause Menu.
- In-game Settings.
- Completion Presentation.

**System Overlay Layer**

- Loading.
- Confirmation.
- Error.
- Temporary notifications.

A system overlay must not accidentally replace the underlying navigation destination.

---

## 5. Flow State Model

### 5.1 GameplayFlowState

```ts
type GameplayFlowState =
    | "boot"
    | "main_menu"
    | "training_selection"
    | "prologue_intro"
    | "loading"
    | "ready"
    | "gameplay"
    | "paused"
    | "settings"
    | "completing"
    | "results"
    | "confirmation"
    | "recovering"
    | "error";
```

The state represents the current high-level application destination.

It is not a replacement for Gameplay Session, Player State, or Level Runtime states.

### 5.2 GameplayFlowSnapshot

```ts
interface GameplayFlowSnapshot {
    currentState: GameplayFlowState;

    previousState?: GameplayFlowState;

    activeSessionId?: string;

    activeMode?: GameplayMode;

    activeTransition?: FlowTransition;

    overlay?: FlowOverlay;

    canNavigateBack: boolean;

    isTransitioning: boolean;
}
```

The snapshot must be immutable.

### 5.3 FlowTransition

```ts
interface FlowTransition {
    id: string;

    source: GameplayFlowState;

    destination: GameplayFlowState;

    reason: FlowTransitionReason;

    startedAt: number;

    status:
        | "requested"
        | "validating"
        | "executing"
        | "completed"
        | "failed"
        | "cancelled";
}
```

### 5.4 FlowTransitionReason

```ts
type FlowTransitionReason =
    | "player_navigation"
    | "session_started"
    | "session_paused"
    | "session_resumed"
    | "session_completed"
    | "session_abandoned"
    | "session_failed"
    | "system_recovery"
    | "application_startup";
```

---

## 6. Core Architecture

### 6.1 Components

The initial implementation should contain:

- `GameplayFlowManager`
- `GameplayFlowCoordinator`
- `GameplayFlowStateMachine`
- `GameplayFlowValidator`
- `GameplayFlowTransitionManager`
- `GameplayNavigationResolver`
- `GameplayFlowHistory`
- `GameplayFlowEvents`
- `GameplayFlowPolicyProvider`
- `GameplayFlowPresentationCoordinator`

### 6.2 GameplayFlowManager

Public interface for application navigation.

```ts
interface IGameplayFlowManager {
    getSnapshot(): GameplayFlowSnapshot;

    navigate(
        request: FlowNavigationRequest
    ): Promise<FlowOperationResult>;

    navigateBack(): Promise<FlowOperationResult>;

    openOverlay(
        request: FlowOverlayRequest
    ): Promise<FlowOperationResult>;

    closeOverlay(): Promise<FlowOperationResult>;
}
```

The manager exposes navigation operations and the current flow snapshot.

It does not implement individual screens.

### 6.3 GameplayFlowCoordinator

Coordinates high-level navigation.

Responsibilities:

- Validate navigation requests.
- Resolve destination states.
- Coordinate Gameplay Session operations.
- Coordinate presentation transitions.
- Handle transition failures.
- Maintain flow history.
- Subscribe to relevant system events.

### 6.4 GameplayFlowStateMachine

Owns valid state transitions.

It must reject unsupported transitions rather than silently accepting arbitrary destinations.

### 6.5 GameplayFlowValidator

Validates whether navigation is currently allowed.

Examples:

- Cannot enter gameplay while another session is unloading.
- Cannot resume gameplay without a paused session.
- Cannot open a new gameplay mode while a transition is active.
- Cannot return to Main Menu before an active session is abandoned or completed.
- Cannot display Results before a result is available.

### 6.6 GameplayNavigationResolver

Resolves navigation destinations from user intent and application context.

For example:

- Main Menu → Training Selection.
- Main Menu → Prologue Introduction.
- Pause → Gameplay.
- Results → Main Menu.
- Settings → Previous Destination.

### 6.7 GameplayFlowHistory

Stores a limited navigation history.

History is useful for reversible application navigation.

It must not be treated as a gameplay session history or progression database.

---

## 7. Navigation Contracts

### 7.1 Navigation Request

```ts
interface FlowNavigationRequest {
    destination: GameplayFlowState;

    reason: FlowTransitionReason;

    parameters?: Record<string, unknown>;

    replaceHistory?: boolean;
}
```

Navigation parameters should use typed domain-specific request objects where possible.

Avoid passing arbitrary data through the flow system.

### 7.2 Operation Result

```ts
interface FlowOperationResult {
    success: boolean;

    destination?: GameplayFlowState;

    error?: {
        code: FlowErrorCode;

        message: string;

        recoverable: boolean;
    };
}
```

### 7.3 Navigation Validation

Before committing a transition, validate:

1. Current flow state.
2. Requested destination.
3. Active transition status.
4. Active gameplay session.
5. Required domain operation.
6. Destination prerequisites.
7. Relevant mode policy.

A transition must not commit if its required domain operation fails.

### 7.4 Transition Atomicity

A navigation transition has three logical stages:

1. Validate.
2. Execute required domain operations.
3. Commit destination state.

The destination state must not become authoritative before required operations succeed.

Presentation animation may begin during execution, but it must not conceal an invalid application state.

---

## 8. Main Menu Flow

### 8.1 Main Menu

Main Menu is the primary entry point.

Initial options:

- Continue Training.
- Training.
- Prologue.
- Settings.
- Exit / Return to Title where supported.

The exact menu content must follow `07_UI_UX_SPEC.md`.

### 8.2 Training Entry

Flow:

```text
Main Menu
    |
    v
Training Selection
    |
    v
Training Preparation
    |
    v
Loading
    |
    v
Ready
    |
    v
Gameplay
```

The Training System provides available exercises and their metadata.

The Flow System requests a Training session from Gameplay Session System.

It does not create exercises or manage exercise progress.

### 8.3 Prologue Entry

Flow:

```text
Main Menu
    |
    v
Prologue Introduction
    |
    v
Loading
    |
    v
Ready
    |
    v
Gameplay
```

The Prologue Introduction may display:

- Level title.
- Brief narrative context.
- Gameplay instructions.
- Control reminders.
- Start action.

Starting the Prologue requests a new Prologue session.

### 8.4 Continue

Continue must resolve the appropriate available destination using progression and save data.

It must not assume that an interrupted session can always be resumed.

The initial implementation may provide a simple Continue Training or Restart Prologue behavior if persistent session restoration is not supported.

---

## 9. Loading Flow

### 9.1 Loading State

The Loading state is entered when a destination requires asynchronous preparation.

Examples:

- Starting Training.
- Starting Prologue.
- Restarting a level.
- Returning to gameplay after a session transition.
- Loading a new level.

### 9.2 Loading Presentation

The presentation may include:

- Minimal progress indicator.
- Level title.
- Section name.
- Short loading message.
- Transition animation.

The initial implementation does not require elaborate loading artwork.

### 9.3 Loading Progress

```ts
interface FlowLoadingProgress {
    operationId: string;

    phase: string;

    progress?: number;

    message?: string;

    indeterminate: boolean;
}
```

Progress may be indeterminate when the underlying system cannot provide reliable progress information.

Do not fabricate percentages.

### 9.4 Loading Failure

If loading fails:

1. Cancel the transition.
2. Request cleanup from Gameplay Session System if a session was created.
3. Keep gameplay input disabled.
4. Display a recoverable error.
5. Return to the appropriate safe destination.

The system must not leave the Flow state stuck at `loading`.

---

## 10. Ready and Start Flow

### 10.1 Ready State

The Ready state represents a prepared gameplay session awaiting activation.

The level must be loaded.

Required systems must be initialized.

The player must be positioned safely.

Gameplay input must remain disabled until the start operation is accepted.

### 10.2 Start Presentation

The initial implementation may use:

- A short countdown.
- A start prompt.
- A level introduction.
- A simple transition from loading to gameplay.

The presentation must be configurable by gameplay mode.

### 10.3 Starting Gameplay

The Flow System requests the Gameplay Session System to start the prepared session.

It waits for the authoritative session transition.

Only after success does the Flow System commit to `gameplay`.

If session startup fails, transition to the recovery flow.

---

## 11. Gameplay Flow

### 11.1 Gameplay State

The gameplay state is active while a valid gameplay session is running.

The Gameplay Flow System should perform minimal work during this state.

It listens to lifecycle events and responds to explicit navigation requests.

### 11.2 HUD Integration

Gameplay HUD is presented by the UI system.

It may display:

- Speed.
- Movement feedback.
- Current objective.
- Checkpoint information.
- Interaction prompts.
- Timer and split information.
- Pause control hint.

The HUD must consume domain snapshots and events.

It must not own gameplay state.

### 11.3 Gameplay Exit

Leaving gameplay must go through an explicit transition.

The Flow System must not directly hide the gameplay scene or destroy level resources.

It must first coordinate the appropriate Gameplay Session operation.

---

## 12. Pause Flow

### 12.1 Pause Entry

Pause can be requested by:

- Pause input action.
- UI control.
- System interruption.
- Application focus loss.

The Flow System requests a pause from Gameplay Session System.

It enters `paused` only after the session confirms the transition.

### 12.2 Pause Menu

Initial options:

- Resume.
- Restart.
- Settings.
- Return to Main Menu.

The Pause Menu is an overlay over the active gameplay context.

It should preserve the underlying level and session.

### 12.3 Resume

Flow:

```text
Paused
   |
   v
Request Session Resume
   |
   v
Validate Player and Input
   |
   v
Restore Gameplay
   |
   v
Gameplay
```

The UI must not independently enable gameplay input.

### 12.4 Restart

Restart flow:

```text
Paused
   |
   v
Confirm Restart
   |
   v
Request Session Restart
   |
   v
Loading / Ready
   |
   v
Gameplay
```

The restart operation is owned by Gameplay Session System.

The Flow System provides the presentation and coordinates navigation.

### 12.5 Return to Main Menu

Flow:

```text
Paused
   |
   v
Confirm Abandonment
   |
   v
Request Session Abandonment
   |
   v
Session Teardown
   |
   v
Main Menu
```

If the player has an active ranked Speedrun, the Speedrun System must process abandonment according to its own rules.

---

## 13. Settings Flow

### 13.1 Entry Points

Settings may be opened from:

- Main Menu.
- Pause Menu.
- Other supported application screens.

### 13.2 Navigation Behavior

When opening Settings, the Flow System stores the previous destination.

After closing Settings, the player returns to that destination.

Examples:

```text
Main Menu -> Settings -> Main Menu
```

```text
Paused -> Settings -> Paused
```

Settings must not implicitly resume gameplay.

### 13.3 Settings Categories

Initial categories may include:

- Controls.
- Mouse and Camera.
- Audio.
- Graphics.
- Accessibility.

Settings behavior and persistence are defined in `25_SETTINGS_SYSTEM_SPEC.md`.

---

## 14. Results Flow

### 14.1 Results Entry

Results are displayed after the authoritative gameplay system reports completion.

The Flow System must not infer successful completion from:

- Reaching a UI animation.
- Opening a menu.
- Unloading a level.
- A generic trigger without validated completion.

### 14.2 Training Results

May include:

- Exercise completed.
- Time.
- Accuracy or execution score where supported.
- Best result.
- Retry.
- Return to Training Selection.

### 14.3 Prologue Results

May include:

- Completion status.
- Total time where relevant.
- Checkpoint statistics.
- Available progression unlocks.
- Retry.
- Return to Main Menu.

### 14.4 Speedrun Results

The Speedrun System provides:

- Final time.
- Splits.
- Medal.
- Personal best status.
- Validation status.
- Leaderboard result.

The Flow System displays the result through the UI system.

It does not calculate or modify the result.

### 14.5 Results Navigation

Initial options:

- Retry.
- Return to Main Menu.
- Continue where supported.

Retry must create a valid new execution or session according to the owning gameplay system.

---

## 15. Confirmation and Dialog Flow

### 15.1 Confirmation Requests

Confirmation is required for potentially destructive operations.

Examples:

- Abandon active session.
- Restart a run.
- Reset Training progress.
- Discard unsaved settings where applicable.

### 15.2 Dialog Model

```ts
interface FlowConfirmationRequest {
    id: string;

    title: string;

    message: string;

    confirmLabel: string;

    cancelLabel: string;

    action: FlowConfirmationAction;
}
```

```ts
type FlowConfirmationAction =
    | "abandon_session"
    | "restart_session"
    | "reset_progress"
    | "discard_settings";
```

### 15.3 Confirmation Rules

- Dialogs must not execute the action before confirmation.
- Cancel must preserve the previous flow state.
- Duplicate confirmation submissions must be ignored.
- Dialogs must be accessible through keyboard and gamepad navigation.
- A confirmation must remain associated with the operation that created it.
- Closing a dialog must not accidentally close an underlying gameplay session.

---

## 16. Overlay Management

### 16.1 FlowOverlay

```ts
interface FlowOverlay {
    id: string;

    type:
        | "loading"
        | "confirmation"
        | "notification"
        | "error";

    blocking: boolean;

    dismissible: boolean;
}
```

### 16.2 Overlay Rules

Overlays are presentation layers, not navigation destinations.

The system must prevent incompatible overlays from appearing simultaneously.

For example:

- Loading overlay blocks gameplay navigation.
- Confirmation dialog blocks its underlying menu.
- Error overlay may block input until acknowledged.
- Non-blocking notifications must not interrupt gameplay.

Overlay stacking must be deterministic.

The initial implementation may support only one blocking overlay at a time.

---

## 17. Navigation History

### 17.1 History Rules

History is useful for ordinary menu navigation.

Examples:

- Main Menu → Settings → Main Menu.
- Training Selection → Exercise Details → Training Selection.

History must not be used to restore an old gameplay session after it has been unloaded.

### 17.2 Back Navigation

Back behavior depends on the current state.

Examples:

- Settings returns to its previous screen.
- Confirmation closes the dialog.
- Pause returns to gameplay only through an explicit resume operation.
- Results returns to Main Menu or the appropriate parent screen.
- Loading cannot be cancelled unless the underlying operation supports cancellation.

### 17.3 History Replacement

Some transitions should replace the current history entry.

For example:

- Boot → Main Menu.
- Loading → Gameplay.
- Loading → Ready.

This prevents the Back action from returning to obsolete intermediate states.

---

## 18. Input Integration

### 18.1 Navigation Actions

The Flow System consumes abstract actions from Input System.

Relevant actions include:

- UI Navigate.
- Confirm.
- Cancel.
- Pause.
- Toggle Settings.

### 18.2 Input Contexts

Expected contexts:

- Main Menu.
- UI Navigation.
- Gameplay.
- Pause Menu.
- Dialog.
- Results.

Input System owns the contexts and action mapping.

The Flow System requests context changes when its destination changes.

### 18.3 Input Safety

The system must ensure:

- Gameplay actions are unavailable in Main Menu.
- UI navigation remains available while paused.
- Confirmation dialogs receive navigation input.
- Gameplay does not receive accidental input during transitions.
- Input focus is restored safely after loading.

---

## 19. Transition Presentation

### 19.1 Presentation Coordinator

The `GameplayFlowPresentationCoordinator` controls high-level transition presentation.

Responsibilities:

- Loading overlays.
- Screen transitions.
- Fade in/out.
- Intro presentation.
- Pause presentation.
- Results presentation.
- Error presentation.

It does not determine whether the underlying transition is valid.

### 19.2 Visual Direction

The visual design must follow the established UI/UX and Asset Bible specifications.

The presentation should preserve the game's visual identity:

- Minimalist layout.
- Strong typography.
- White and red visual language.
- Clear hierarchy.
- Restrained animation.
- Minimal unnecessary decoration.

### 19.3 Reduced Motion

Transitions must respect accessibility settings.

When reduced motion is enabled:

- Long transitions are shortened or removed.
- Camera movement is not introduced by UI transitions.
- Essential state changes remain clear.
- Loading indicators remain understandable.

### 19.4 Transition Failure

A visual animation failure must not prevent a successful logical transition.

A logical transition failure must not be hidden by a completed visual animation.

---

## 20. Session Integration

### 20.1 Gameplay Session Is Authoritative

Gameplay Flow requests session operations through `IGameplaySessionManager`.

It listens for authoritative lifecycle events.

It must not directly change `GameplaySessionStatus`.

### 20.2 Mapping Flow to Session

| Gameplay Flow | Expected Session State |
|---|---|
| Main Menu | No active session |
| Training Selection | No active session |
| Prologue Introduction | No active session |
| Loading | Preparing / Loading / Initializing |
| Ready | Ready |
| Gameplay | Running |
| Paused | Paused |
| Completing | Completing |
| Results | Completed |
| Recovering | Failed / Abandoning / Unloading |

This is a conceptual mapping.

The Flow System must not enforce a one-to-one state relationship where multiple presentation states are valid for one session state.

### 20.3 Event Synchronization

The Flow System subscribes to:

- Session ready.
- Session started.
- Session paused.
- Session resumed.
- Session restarted.
- Session completed.
- Session abandoned.
- Session failed.
- Session unloaded.

Events must be checked against the active session ID.

Outdated events must be ignored.

### 20.4 Session Unavailability

If the session disappears unexpectedly:

1. Disable gameplay navigation.
2. Enter recovery flow.
3. Query authoritative session state.
4. Determine whether recovery is possible.
5. Navigate to a safe destination.
6. Display an appropriate message.

---

## 21. Error Handling

### 21.1 Error Codes

```ts
type FlowErrorCode =
    | "INVALID_DESTINATION"
    | "INVALID_TRANSITION"
    | "TRANSITION_IN_PROGRESS"
    | "SESSION_REQUIRED"
    | "SESSION_UNAVAILABLE"
    | "SESSION_OPERATION_FAILED"
    | "LEVEL_UNAVAILABLE"
    | "LOADING_FAILED"
    | "DESTINATION_NOT_READY"
    | "OVERLAY_CONFLICT"
    | "CONFIRMATION_REQUIRED"
    | "STALE_FLOW_CONTEXT"
    | "UNKNOWN_ERROR";
```

### 21.2 Error Recovery

Errors should be classified as:

- Recoverable navigation failure.
- Gameplay session failure.
- Loading failure.
- Presentation failure.
- Invalid user request.
- Application-level failure.

The recovery destination depends on the error category.

Examples:

- Invalid menu navigation: remain on current screen.
- Level load failure: return to the relevant menu.
- Session initialization failure: return to Main Menu after cleanup.
- Session completion persistence failure: show results with a persistence warning where possible.
- Presentation failure: preserve the valid logical state.

### 21.3 Error Presentation

Technical error details must be logged separately from player-facing messages.

Player-facing messages should explain what happened and provide a safe next action.

---

## 22. Initial Implementation Scope

The initial implementation must include:

- Main Menu flow.
- Training Selection flow.
- Prologue Introduction flow.
- Loading state.
- Ready state.
- Gameplay state.
- Pause flow.
- Resume flow.
- Restart flow.
- Settings navigation.
- Confirmation dialogs.
- Completion flow.
- Results flow.
- Abandonment flow.
- Error recovery.
- Basic navigation history.
- Overlay management.
- Input context coordination.
- Gameplay Session integration.
- Session event synchronization.
- Reduced-motion support.

### 22.1 Deferred Features

The following are future features:

- Multiplayer lobby navigation.
- Online matchmaking.
- Spectator navigation.
- Social profile navigation.
- Cloud save conflict screens.
- Online leaderboard navigation.
- Advanced branching narrative flow.
- Multiple simultaneous gameplay sessions.
- Dynamic campaign map.
- Cross-session cinematic sequences.

The architecture must allow additional destinations without turning the Flow System into a monolithic application controller.

---

## 23. Testing Requirements

### 23.1 State Transition Tests

Test:

- Boot → Main Menu.
- Main Menu → Training Selection.
- Main Menu → Prologue Introduction.
- Main Menu → Settings.
- Settings → Previous Destination.
- Loading → Ready.
- Ready → Gameplay.
- Gameplay → Paused.
- Paused → Gameplay.
- Paused → Settings.
- Completing → Results.
- Results → Main Menu.

Invalid transitions must be rejected.

### 23.2 Gameplay Integration Tests

Test:

- Start Training from Main Menu.
- Start Prologue from Main Menu.
- Pause active gameplay.
- Resume gameplay.
- Restart Training.
- Restart Prologue.
- Abandon active session.
- Complete Prologue.
- Display Speedrun results.
- Return to Main Menu after unloading.

### 23.3 Overlay Tests

Test:

- Open confirmation.
- Cancel confirmation.
- Confirm abandonment.
- Block navigation during loading.
- Prevent duplicate blocking overlays.
- Close notification overlays.
- Recover from overlay presentation failure.

### 23.4 Failure Tests

Test:

- Loading failure.
- Session startup failure.
- Session unexpectedly unloaded.
- Duplicate navigation request.
- Concurrent navigation requests.
- Stale session events.
- Failed session abandonment.
- Failed presentation animation.
- Focus loss during transition.

### 23.5 Accessibility Tests

Test:

- Keyboard-only navigation.
- Gamepad navigation.
- Reduced motion.
- Focus restoration.
- Dialog navigation.
- Clear transition feedback.

### 23.6 End-to-End Scenarios

**Training:**

```text
Boot
  -> Main Menu
  -> Training Selection
  -> Loading
  -> Ready
  -> Gameplay
  -> Pause
  -> Settings
  -> Pause
  -> Resume
  -> Complete Exercise
  -> Results
  -> Training Selection
```

**Prologue:**

```text
Boot
  -> Main Menu
  -> Prologue Introduction
  -> Loading
  -> Ready
  -> Gameplay
  -> Pause
  -> Resume
  -> Complete Prologue
  -> Results
  -> Main Menu
```

**Abandonment:**

```text
Main Menu
  -> Prologue
  -> Loading
  -> Gameplay
  -> Pause
  -> Confirm Abandonment
  -> Session Abandonment
  -> Session Cleanup
  -> Main Menu
```

---

## 24. Implementation Phases

### Phase 1: Flow Models

Implement:

- GameplayFlowState.
- GameplayFlowSnapshot.
- FlowTransition.
- FlowNavigationRequest.
- FlowOperationResult.
- FlowOverlay.
- Flow error types.

### Phase 2: State Machine

Implement:

- GameplayFlowStateMachine.
- GameplayFlowValidator.
- GameplayFlowTransitionManager.
- Explicit transition definitions.
- Navigation history.

### Phase 3: Core Navigation

Implement:

- Boot.
- Main Menu.
- Training Selection.
- Prologue Introduction.
- Settings navigation.
- Back behavior.

### Phase 4: Gameplay Integration

Implement:

- Gameplay Session integration.
- Loading flow.
- Ready flow.
- Gameplay flow.
- Pause.
- Resume.
- Restart.
- Abandonment.

### Phase 5: Completion and Results

Implement:

- Completion event handling.
- Results navigation.
- Retry.
- Return to Main Menu.
- Speedrun result presentation.

### Phase 6: Overlays and Recovery

Implement:

- Confirmation.
- Loading overlay.
- Error overlay.
- Overlay conflict handling.
- Focus-loss recovery.
- Failed transition recovery.

### Phase 7: Validation

Run:

- State machine tests.
- Navigation tests.
- Gameplay integration tests.
- End-to-end tests.
- Accessibility tests.
- Transition stress tests.

---

## 25. Acceptance Criteria

The implementation is accepted when:

1. Main Menu is the initial user-facing destination.
2. Training can be launched from Main Menu.
3. Prologue can be launched from Main Menu.
4. Loading and Ready states are handled explicitly.
5. Gameplay begins only after session startup succeeds.
6. Pause and resume use Gameplay Session System.
7. Restart delegates to Gameplay Session System.
8. Abandonment requires confirmation where appropriate.
9. Results are displayed only after authoritative completion.
10. Settings return to their previous destination.
11. Overlays do not corrupt underlying navigation.
12. Invalid transitions are rejected.
13. Concurrent transitions are prevented.
14. Stale session events are ignored.
15. Failed transitions have a recovery path.
16. Navigation history does not restore unloaded sessions.
17. Gameplay input is unavailable outside valid gameplay states.
18. UI input remains available during pause and dialogs.
19. Presentation animation does not control logical state.
20. Reduced-motion settings are respected.
21. Training and Prologue end-to-end flows work.
22. No domain-specific gameplay logic is duplicated in the Flow System.

---

## 26. Definition of Done

- [ ] Flow state model implemented.
- [ ] Flow snapshot implemented.
- [ ] Navigation requests implemented.
- [ ] State transition validation implemented.
- [ ] Single transition enforcement implemented.
- [ ] Navigation history implemented.
- [ ] Main Menu navigation works.
- [ ] Training entry works.
- [ ] Prologue entry works.
- [ ] Loading flow works.
- [ ] Ready flow works.
- [ ] Gameplay flow works.
- [ ] Pause and resume work.
- [ ] Settings navigation works.
- [ ] Restart flow works.
- [ ] Abandonment flow works.
- [ ] Completion flow works.
- [ ] Results flow works.
- [ ] Confirmation dialogs work.
- [ ] Overlay management works.
- [ ] Error recovery works.
- [ ] Input contexts are coordinated.
- [ ] Session event synchronization works.
- [ ] Stale events are ignored.
- [ ] Accessibility requirements are met.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] End-to-end tests pass.
- [ ] No duplicated session lifecycle ownership exists.
- [ ] Architecture follows `01_AGENT_RULES.md` and `02_TECHNICAL_ARCHITECTURE.md`.

---

## 27. Final Design Constraints

1. Gameplay Flow owns high-level application navigation.
2. Gameplay Session owns gameplay session lifecycle.
3. Level Runtime owns level loading and runtime level lifecycle.
4. Player State owns player lifecycle and aggregated player state.
5. Specialized gameplay systems retain their domain authority.
6. UI components must not independently control application navigation.
7. Every major navigation transition must be validated.
8. Only one blocking flow transition may execute at a time.
9. Loading must not expose partially initialized gameplay.
10. Pause and resume must be coordinated through Gameplay Session.
11. Settings navigation must preserve the previous destination.
12. Results must originate from authoritative gameplay completion.
13. Abandonment must not be treated as completion.
14. Navigation history must not restore invalid gameplay sessions.
15. Overlay state must remain separate from destination state.
16. Presentation animation must never determine application state.
17. Stale session events must be ignored.
18. Failed transitions must have a safe recovery path.
19. The Flow System must not contain per-frame gameplay logic.
20. The implementation must remain extensible without introducing unnecessary application framework complexity.

**End of Specification**