# 18_PLAYER_STATE_SYSTEM_SPEC.md

# Player State System Specification

**Project:** Glassline — First-Person Parkour Game  
**Document:** 18 — Player State System  
**Status:** Implementation Specification  
**Priority:** Core Gameplay Infrastructure

---

## 1. Purpose

The Player State System defines the player's overall runtime condition and coordinates state transitions between gameplay systems.

It provides a consistent answer to questions such as:

- Is the player currently active in the level?
- Can the player move, look, jump, sprint, or interact?
- Is the player temporarily disabled?
- Is a respawn operation in progress?
- Has the player been activated after spawning?
- Can gameplay input be accepted at this moment?

The system prevents different subsystems from independently maintaining conflicting versions of the player's state.

For example, the UI must not assume that the player can interact simply because the player is standing still. The player may be respawning, paused, disabled, or in a scripted sequence.

The Player State System acts as a coordination and aggregation layer. It does not replace the specialized state machines owned by other systems.

### 1.1 Core Design Principle

There must be one authoritative owner for each category of player state.

The Player State System aggregates information from those owners and provides a consistent effective state snapshot to other systems.

It must not become a monolithic state machine that attempts to control every aspect of the player.

---

## 2. Scope

### 2.1 Included in Initial Implementation

- Player lifecycle state.
- Aggregation of authoritative subsystem states.
- Effective player state snapshots.
- Capability and eligibility evaluation.
- Validated player lifecycle transitions.
- Coordination of activation and deactivation.
- Integration with Movement, Input, Camera, Interaction, Level Runtime, and Respawn.
- Session-scoped state.
- Ordered state transition events.
- Recovery from invalid or inconsistent state.
- Debugging and automated tests.

### 2.2 Explicitly Excluded

The following systems are not part of this specification:

- Movement physics and locomotion state transitions.
- Respawn execution and recovery presentation.
- Input device processing and action mapping.
- Camera effects and camera movement.
- Interaction target detection and execution.
- Health, damage, stamina, or combat.
- Multiplayer synchronization.
- Character possession or switching.
- Persistent player progression.

These systems may contribute information to the Player State System, but they retain ownership of their own behavior.

---

## 3. State Domains and Ownership

The player has multiple independent state domains.

They must remain separate even when several domains change at approximately the same time.

### 3.1 Lifecycle State

**Owner:** Player State System.

Describes whether the player entity is available for gameplay.

Initial states:

- `initializing`
- `inactive`
- `active`
- `disabled`
- `respawning`
- `unavailable`

Definitions:

**Initializing**

The player runtime is being created or connected to the active gameplay session.

**Inactive**

The player exists but has not been activated for gameplay.

Examples include a newly created player before the level finishes loading.

**Active**

The player is available for normal gameplay, subject to other domain restrictions.

**Disabled**

Gameplay control is temporarily unavailable.

Examples include scripted sequences or system-controlled transitions.

**Respawning**

A recovery operation is being executed by the Respawn System.

**Unavailable**

The player is no longer available for gameplay.

This state is used during session teardown, entity destruction, or unrecoverable initialization failure.

### 3.2 Locomotion State

**Owner:** Movement System.

The Player State System must consume the Movement System's current state without redefining it.

Examples:

- Grounded.
- Walking.
- Running.
- Sprinting.
- Crouching.
- Sliding.
- Jumping.
- Falling.
- Landing.
- Vaulting.
- WallRunning.
- WallJumping.

The exact state definitions and transitions remain governed by `12_MOVEMENT_SYSTEM_SPEC.md`.

The Player State System must never force a locomotion state by directly modifying Movement System internals.

### 3.3 Input and Control State

**Owner:** Input System and the control coordination layer.

Describes whether gameplay actions can be accepted.

Examples:

- Gameplay input enabled.
- Gameplay input suspended.
- Look input enabled.
- Movement input enabled.
- UI input available.

The Player State System consumes the effective control availability rather than reading raw keyboard, mouse, or gamepad events.

### 3.4 Respawn State

**Owner:** Respawn System.

The Player State System may expose the current recovery status in its aggregate snapshot.

It must not duplicate the Respawn System's operation state machine.

The authoritative recovery states remain defined in `17_RESPAWN_SYSTEM_SPEC.md`.

### 3.5 Interaction Eligibility

**Owner:** Interaction System.

Determines whether the player may begin or continue an interaction.

Examples:

- Interaction allowed.
- Interaction temporarily restricted.
- Interaction unavailable.

The Player State System exposes lifecycle and capability information that Interaction System may use when evaluating eligibility.

The Interaction System remains responsible for final validation.

### 3.6 Camera Presentation State

**Owner:** Camera System.

The Player State System does not own camera orientation, FOV, effects, or presentation transitions.

It may expose lifecycle events such as activation, deactivation, and respawn completion so that Camera System can react.

### 3.7 Gameplay Session Context

**Owner:** Gameplay orchestration and Level Runtime.

The Player State System receives the active session identity and relevant lifecycle notifications.

It does not own:

- Level loading.
- Section activation.
- Spawn point definitions.
- Checkpoint progress.
- Level transitions.

These responsibilities remain defined in `15_LEVEL_RUNTIME_SYSTEM_SPEC.md` and `16_CHECKPOINT_SYSTEM_SPEC.md`.

---

## 4. Architecture

### 4.1 Components

The initial implementation consists of:

- `PlayerStateManager`
- `PlayerLifecycleController`
- `PlayerStateSnapshot`
- `PlayerStateContext`
- `PlayerStateTransitionCoordinator`
- `PlayerStateValidator`
- `PlayerCapabilityResolver`
- `PlayerStatePolicy`
- `PlayerStateEvents`

Each component must have a narrow responsibility.

### 4.2 PlayerStateManager

The central public entry point for querying the player's aggregate state.

Responsibilities:

- Maintain the authoritative player lifecycle state.
- Collect state information from registered domain providers.
- Produce consistent state snapshots.
- Delegate lifecycle transitions to the transition coordinator.
- Publish state change events.
- Reject stale session updates.
- Expose read-only state information to consumers.

It must not directly manipulate Movement, Camera, Input, or Interaction internals.

Suggested interface:

```ts
interface IPlayerStateManager {
    getSnapshot(): PlayerStateSnapshot;

    getLifecycleState(): PlayerLifecycleState;

    getCapabilities(): PlayerCapabilities;

    requestTransition(
        request: PlayerStateTransitionRequest
    ): Promise<PlayerStateTransitionResult>;

    subscribe(
        listener: (event: PlayerStateEvent) => void
    ): Unsubscribe;
}
```

The public API should expose read-only snapshots and validated transition requests.

Internal mutable state must not be exposed to arbitrary gameplay systems.

### 4.3 PlayerLifecycleController

Owns lifecycle-specific transition logic.

Responsibilities:

- Initialize player lifecycle.
- Activate the player.
- Disable and re-enable the player.
- Enter and leave respawning state.
- Mark the player unavailable.
- Coordinate lifecycle cleanup.

It must not own the detailed recovery procedure.

When entering or leaving respawning state, it must coordinate with `RespawnManager`.

### 4.4 PlayerStateTransitionCoordinator

Coordinates operations involving multiple systems.

Examples:

- Initial player activation.
- Gameplay deactivation.
- Respawn lifecycle synchronization.
- Session teardown.

Responsibilities:

- Validate transition prerequisites.
- Execute transitions in a predictable order.
- Prevent overlapping lifecycle transitions.
- Handle partial failures.
- Ensure cleanup is performed when a transition fails.
- Publish the final transition result.

The coordinator must not directly duplicate the business logic of participating systems.

### 4.5 PlayerStateValidator

Validates lifecycle transitions and aggregate state consistency.

Examples:

- An unavailable player cannot become active without initialization.
- A player cannot enter respawning state without a valid active session.
- A player cannot become active while the current respawn operation is still placing the player.
- A stale session cannot activate a player from a previous level.

Validation should return structured errors rather than silently changing state.

### 4.6 PlayerCapabilityResolver

Calculates effective player capabilities from authoritative domain information and policy.

It must not maintain independent mutable copies of capability flags.

The resolver should be deterministic: identical domain inputs and policies must produce identical capability results.

---

## 5. Data Contracts

### 5.1 PlayerLifecycleState

```ts
type PlayerLifecycleState =
    | "initializing"
    | "inactive"
    | "active"
    | "disabled"
    | "respawning"
    | "unavailable";
```

### 5.2 PlayerStateSnapshot

Represents the effective player state at a particular point in time.

```ts
interface PlayerStateSnapshot {
    playerId: string;
    sessionId: string;

    lifecycle: PlayerLifecycleState;

    locomotion: {
        state: string;
        isGrounded: boolean;
        isMoving: boolean;
        isTraversing: boolean;
    };

    control: {
        gameplayInputEnabled: boolean;
        movementInputEnabled: boolean;
        lookInputEnabled: boolean;
        uiInputEnabled: boolean;
    };

    respawn: {
        isInProgress: boolean;
        operationId?: string;
    };

    capabilities: PlayerCapabilities;

    revision: number;
    timestamp: number;
}
```

The locomotion and control fields are read-only projections of their authoritative systems.

The `revision` increases whenever a published effective snapshot changes.

The `timestamp` uses a monotonic time source consistent with the runtime architecture.

The snapshot must be immutable from the consumer's perspective.

### 5.3 PlayerCapabilities

Capabilities describe what the player is currently permitted to do.

```ts
interface PlayerCapabilities {
    canMove: boolean;
    canLook: boolean;

    canJump: boolean;
    canSprint: boolean;
    canCrouch: boolean;
    canSlide: boolean;

    canInteract: boolean;

    canPause: boolean;
    canRestart: boolean;
}
```

These values are derived.

They must never be independently modified by gameplay code.

For example:

- `canJump` depends on lifecycle, control availability, and Movement System eligibility.
- `canSprint` depends on lifecycle, control availability, and Movement System eligibility.
- `canInteract` depends on lifecycle, control availability, and Interaction System restrictions.
- `canLook` depends on lifecycle and look-control availability.
- `canPause` is primarily an application/gameplay policy and must not be disabled merely because gameplay movement is unavailable.

The resolver must distinguish between player capabilities and UI/application actions.

A player who cannot move may still be able to open the pause menu.

### 5.4 PlayerStateContext

```ts
interface PlayerStateContext {
    playerId: string;
    sessionId: string;

    source:
        | "level-runtime"
        | "gameplay"
        | "respawn"
        | "input"
        | "system"
        | "script";

    timestamp: number;
}
```

All lifecycle transition requests must include a valid context.

### 5.5 PlayerStateTransitionRequest

```ts
interface PlayerStateTransitionRequest {
    requestId: string;

    target: PlayerLifecycleState;

    context: PlayerStateContext;

    reason:
        | "initialization"
        | "level-activation"
        | "scripted"
        | "respawn-started"
        | "respawn-completed"
        | "gameplay-disabled"
        | "gameplay-enabled"
        | "session-unload"
        | "system-recovery";
}
```

The request must be validated before changing lifecycle state.

### 5.6 PlayerStateTransitionResult

```ts
interface PlayerStateTransitionResult {
    success: boolean;

    requestId: string;

    previousState?: PlayerLifecycleState;
    currentState?: PlayerLifecycleState;

    reason?: string;
}
```

Failures must provide enough information for logging and debugging.

---

## 6. Lifecycle Transition Rules

### 6.1 Allowed Transitions

The initial lifecycle transition graph is:

```text
initializing
    |
    v
inactive
    |
    v
active <--------> disabled
    |
    v
respawning
    |
    v
active

Any non-unavailable state
    |
    v
unavailable
```

Additional valid paths:

- `initializing` → `unavailable`
- `inactive` → `unavailable`
- `disabled` → `unavailable`
- `respawning` → `unavailable`

A respawn failure must not automatically reactivate the player.

The failure policy must be determined by Respawn System and the active gameplay session.

### 6.2 Invalid Transitions

The following transitions must be rejected unless an explicit recovery policy permits them:

- `unavailable` → `active`
- `unavailable` → `respawning`
- `initializing` → `respawning`
- `inactive` → `respawning`
- `respawning` → `respawning`
- `active` → `active`

Repeated requests should be idempotent where appropriate.

An already-active player receiving an activation request should not trigger a second activation sequence.

### 6.3 Transition Atomicity

A lifecycle transition may involve several systems.

The Player State System must not publish the final state until all required operations have completed successfully.

However, it must publish a transition-start event when the operation begins.

If an operation fails:

1. Stop subsequent transition steps.
2. Execute the appropriate rollback or cleanup operations.
3. Preserve a valid lifecycle state.
4. Publish a transition-failed event.
5. Record diagnostic information.

Rollback must not blindly restore old subsystem states if those states have independently changed.

The transition coordinator should request restoration through each subsystem's public interface.

---

## 7. Player Activation

Activation occurs when a player becomes ready for normal gameplay.

Typical sequence:

1. Level Runtime creates or initializes the player.
2. Player State System enters `initializing`.
3. Movement System initializes its runtime state.
4. Camera System initializes the camera rig.
5. Input System prepares the Gameplay context.
6. Interaction System registers the player as an interaction source.
7. Required player dependencies report readiness.
8. Player State System enters `inactive`.
9. Gameplay orchestration requests activation.
10. Control coordination enables the required gameplay controls.
11. Player State System enters `active`.
12. `player.activated` is published.

The exact initialization order may be adapted to the selected engine.

A player must not become active before the minimum required systems are ready.

Optional presentation systems must not block gameplay activation unless explicitly configured as required dependencies.

---

## 8. Player Deactivation and Disablement

Disablement is a temporary lifecycle restriction.

Examples:

- Scripted gameplay sequences.
- Controlled transitions.
- Temporary gameplay restrictions.
- System recovery operations.

When entering `disabled`:

- Gameplay movement input must be suspended.
- New interactions must be rejected.
- Ongoing interactions must be cancelled or handled according to Interaction System policy.
- Camera look may be allowed or restricted according to the transition policy.
- UI input must remain available where appropriate.
- The Movement System must not be forced into an invented locomotion state.
- Existing physics must remain valid.

Disablement must be reversible.

The system must retain enough context to determine which restrictions should be lifted when returning to `active`.

Do not use a single global boolean that blindly enables every subsystem during reactivation.

---

## 9. Respawn Integration

Respawn System is the authoritative owner of recovery execution.

Player State System only coordinates lifecycle representation.

### 9.1 Respawn Start

When Respawn System accepts a recovery operation:

1. Respawn System publishes its operation-start event.
2. Player State System validates the current session.
3. Lifecycle transitions from `active` or an explicitly permitted `disabled` state to `respawning`.
4. Player control is suspended through the control coordination layer.
5. Aggregate state snapshots reflect the recovery operation.

### 9.2 Respawn Completion

After Respawn System confirms successful recovery:

1. Movement System confirms its reset is complete.
2. Camera System confirms its recovery reset is complete.
3. Input/control coordination restores the appropriate gameplay controls.
4. Respawn System reports successful completion.
5. Player State System transitions to `active`.
6. A new aggregate snapshot is published.
7. `player.activated` or a dedicated recovery-completed event is emitted according to the event contract.

Do not emit a second initial activation event for every respawn.

Use `player.respawnCompleted` for recovery-specific consumers.

### 9.3 Respawn Failure

If recovery fails:

- Do not assume the player is safe to control.
- Keep gameplay input suspended when necessary.
- Do not publish `active` without a valid recovery result.
- Allow Respawn System to execute its failure policy.
- Transition to a valid disabled or unavailable state when appropriate.

### 9.4 Checkpoint Integration

`RespawnManager` from `17_RESPAWN_SYSTEM_SPEC.md` is the sole owner and orchestrator of the full respawn lifecycle.

`16_CHECKPOINT_SYSTEM_SPEC.md` defines the Checkpoint System as a destination provider only: it owns checkpoint activation and progress and exposes the active recovery destination through the Respawn integration adapter.

There is no separate checkpoint-level respawn coordinator in the integrated architecture. A checkpoint subsystem must not own recovery orchestration, player placement, or recovery lifecycle state.

---

## 10. Capability Resolution

Capabilities must be derived from the current authoritative state.

A simplified evaluation model:

```ts
function resolveCapabilities(
    state: PlayerStateSnapshotInput,
    policy: PlayerStatePolicy
): PlayerCapabilities {
    const active = state.lifecycle === "active";

    const canControl =
        active &&
        state.control.gameplayInputEnabled;

    return {
        canMove:
            canControl &&
            state.control.movementInputEnabled,

        canLook:
            active &&
            state.control.lookInputEnabled,

        canJump:
            canControl &&
            state.movement.canJump,

        canSprint:
            canControl &&
            state.movement.canSprint,

        canCrouch:
            canControl &&
            state.movement.canCrouch,

        canSlide:
            canControl &&
            state.movement.canSlide,

        canInteract:
            canControl &&
            !state.respawn.isInProgress &&
            policy.allowInteraction,

        canPause:
            policy.allowPause,

        canRestart:
            policy.allowRestart
    };
}
```

This is illustrative pseudocode. The production implementation must use actual domain contracts and must not introduce duplicated mutable state.

### 10.1 Capability Evaluation Rules

- Lifecycle restrictions take precedence over ordinary gameplay permissions.
- Respawn restrictions take precedence over normal movement and interaction permissions.
- Movement eligibility is determined by Movement System.
- Interaction eligibility is determined by Interaction System.
- Input availability is determined by the control coordination layer.
- UI/application actions follow their own policies.
- A capability must never be considered available solely because a UI control is visible.

### 10.2 Avoiding Capability Conflicts

Do not expose independent setters such as:

```ts
setCanMove(false);
setCanInteract(true);
setCanJump(true);
```

Such APIs create conflicting state combinations.

Instead, capabilities must be recalculated from lifecycle, domain states, and policy.

---

## 11. Player State Events

Events allow systems to react without creating direct dependencies on Player State System internals.

Initial events:

```ts
type PlayerStateEvent =
    | PlayerInitializedEvent
    | PlayerActivatedEvent
    | PlayerDisabledEvent
    | PlayerRespawningEvent
    | PlayerRespawnCompletedEvent
    | PlayerUnavailableEvent
    | PlayerCapabilitiesChangedEvent
    | PlayerLifecycleTransitionFailedEvent;
```

Every event must include:

```ts
interface BasePlayerStateEvent {
    eventId: string;

    playerId: string;
    sessionId: string;

    revision: number;
    timestamp: number;

    source: string;
}
```

### 11.1 Event Ordering

Events must be published in a deterministic order.

Requirements:

- Transition-start events precede transition-completed events.
- Events from stale sessions are ignored.
- Consumers must be able to identify duplicate event IDs.
- Capability change events are published only when effective capabilities actually change.
- A failed transition must not publish a successful transition event.
- Events must not expose mutable internal state.

The event bus must not become a second source of truth.

The current snapshot remains authoritative for state queries.

---

## 12. Integration Contracts

### 12.1 Movement System

Player State System:

- Reads Movement state and capability information.
- Requests control suspension through the appropriate coordinator.
- Receives lifecycle-related reset completion signals.

Movement System:

- Owns locomotion state.
- Owns movement physics.
- Owns grounded, jumping, falling, and traversal eligibility.
- Does not depend on Player State System to calculate physical movement.

### 12.2 Input System

Player State System:

- Requests lifecycle-related input restrictions.
- Reads effective input availability.
- Exposes capabilities to gameplay consumers.

Input System:

- Owns device processing and action mapping.
- Owns input contexts.
- Owns focus and pointer-lock behavior.
- Does not interpret player lifecycle independently.

### 12.3 Camera System

Player State System:

- Publishes activation, disablement, and respawn lifecycle events.

Camera System:

- Owns camera presentation and reset behavior.
- Owns camera-specific transition completion.

Camera effects must not be used as a source of gameplay state.

### 12.4 Interaction System

Player State System:

- Exposes lifecycle and aggregate capabilities.

Interaction System:

- Performs final interaction eligibility validation.
- Owns interaction execution and cancellation.
- Owns target selection and prompt lifecycle.

The UI must not infer interaction eligibility from lifecycle state alone.

### 12.5 Level Runtime

Level Runtime:

- Creates and destroys the player runtime.
- Supplies session identity.
- Coordinates level lifecycle.

Player State System:

- Initializes and invalidates the player's lifecycle state.
- Rejects stale events from unloaded sessions.
- Does not load or unload levels itself.

### 12.6 Speedrun System

Speedrun System may consume lifecycle and recovery events to determine whether a run remains valid.

It remains the authority for:

- Run state.
- Timer state.
- Checkpoint order.
- Run failure and abandonment.
- Ranked recovery policy.

Player State System must not modify speedrun state directly.

### 12.7 Save System

Player State System does not persist its transient lifecycle state.

The current player lifecycle is reconstructed from the active session.

Long-term progression and settings remain owned by their respective systems and persisted through Save System.

---

## 13. Session and Lifecycle Safety

Every player state operation must be associated with a valid session.

### 13.1 Session Isolation

When a level session changes:

- Previous session events must be ignored.
- Pending transition operations must be cancelled where possible.
- Player lifecycle must move toward `unavailable` or a controlled reinitialization state.
- New session initialization must use a new session identity.
- Delayed asynchronous callbacks must validate their session before applying changes.

### 13.2 Player Identity

The architecture should support a stable `playerId`, even though the initial game has only one playable character.

This prevents future systems from assuming that a global singleton is the only possible player-state owner.

### 13.3 Concurrency

Lifecycle transitions must be serialized per player.

The implementation must prevent:

- Activation during respawn.
- Multiple simultaneous deactivation operations.
- Reactivation after session unload.
- A stale async completion overwriting a newer lifecycle state.
- Duplicate lifecycle events caused by repeated requests.

Use request IDs and revision checks to protect asynchronous operations.

Do not rely solely on timing delays to prevent conflicting transitions.

---

## 14. Error Handling and Recovery

The system must detect and report:

- Invalid lifecycle transitions.
- Missing domain providers.
- Stale session updates.
- Duplicate transition requests.
- Conflicting control states.
- Incomplete activation.
- Failed deactivation.
- Failed respawn synchronization.
- Invalid player snapshots.

### 14.1 Recovery Strategy

When an inconsistent state is detected:

1. Capture the current snapshot and transition context.
2. Identify the authoritative owner of the conflicting domain.
3. Request validation or recovery from that owner.
4. Recalculate the effective snapshot.
5. Publish a diagnostic event.
6. Keep the player restricted if safe gameplay cannot be guaranteed.

Never silently repair state by changing another system's internal state.

### 14.2 Logging

Diagnostic records should include:

- Player ID.
- Session ID.
- Transition request ID.
- Previous and requested lifecycle states.
- Current revision.
- Transition source.
- Failure reason.
- Monotonic timestamp.

Verbose logging should be configurable and disabled in normal production builds.

---

## 15. Debugging and Development Tools

Provide a development-only Player State Debug Panel.

It should display:

- Player ID and session ID.
- Current lifecycle state.
- Current Movement state.
- Input/control availability.
- Respawn operation state.
- Effective capabilities.
- Current snapshot revision.
- Most recent lifecycle transition.
- Recent transition failures.

The panel must be read-only in the initial implementation.

If developer commands are added later, they must use the same validated transition APIs as normal gameplay.

Do not allow debug tools to mutate internal state directly.

---

## 16. Initial Implementation Boundaries

The initial implementation must remain intentionally small.

Implement:

- One player runtime.
- Player lifecycle state machine.
- Immutable aggregate snapshots.
- Capability resolution.
- Validated lifecycle transitions.
- Session identity checks.
- Event publication.
- Integration with existing core systems.
- Basic debug inspection.

Do not implement:

- Health and damage.
- Stamina.
- Status effects.
- Combat.
- Multiplayer state replication.
- Multiple playable characters.
- Character possession.
- Network authority.
- Persistent lifecycle history.

These features may extend the domain model later without changing the ownership principles.

---

## 17. Future Extension Points

The architecture should permit future integration of:

- Health and damage state.
- Stamina and exertion.
- Temporary gameplay modifiers.
- Character switching.
- Spectator mode.
- Multiplayer player identities.
- Network-authoritative state.
- Replay and Ghost Replay.
- Scripted player possession.
- Advanced accessibility restrictions.

Future features must introduce their own state owners where appropriate.

They must not turn `PlayerStateManager` into a container for unrelated gameplay logic.

---

## 18. Testing Requirements

### 18.1 Unit Tests

Test:

- Every valid lifecycle transition.
- Every invalid lifecycle transition.
- Idempotent activation requests.
- Duplicate transition request handling.
- Capability resolution.
- Capability changes after domain updates.
- Snapshot immutability.
- Revision increments.
- Event ordering.
- Session validation.

### 18.2 Integration Tests

Test:

- Player initialization through Level Runtime.
- Player activation with all required dependencies.
- Player disablement and reactivation.
- Respawn start and completion.
- Respawn failure.
- Movement control suspension.
- Camera recovery synchronization.
- Input context restoration.
- Interaction rejection while disabled.
- Session unload during an asynchronous transition.

### 18.3 Race Condition Tests

Test at minimum:

- Respawn requested during disablement.
- Level unload during respawn.
- Activation requested while initialization is incomplete.
- Duplicate respawn completion events.
- Stale transition completion after a new session starts.
- Two lifecycle requests arriving in the same update cycle.

### 18.4 Regression Tests

Verify:

- Movement physics are unchanged by lifecycle aggregation.
- Movement state transitions remain owned by Movement System.
- Camera effects are not reset by unrelated snapshot updates.
- Interaction validation remains authoritative.
- Speedrun state is not modified by Player State System.
- Pause and UI navigation remain available when gameplay movement is disabled.

---

## 19. Implementation Phases

### Phase 1 — Contracts and Ownership

- Define lifecycle state types.
- Define snapshot and event contracts.
- Define provider interfaces.
- Confirm ownership boundaries with existing systems.

**Deliverable:** Stable public contracts.

### Phase 2 — Lifecycle Manager

- Implement PlayerStateManager.
- Implement PlayerLifecycleController.
- Implement PlayerStateValidator.
- Implement serialized transition handling.

**Deliverable:** Working lifecycle state machine.

### Phase 3 — Snapshot and Capabilities

- Integrate Movement state.
- Integrate input/control availability.
- Integrate Respawn state.
- Implement PlayerCapabilityResolver.
- Publish immutable snapshots.

**Deliverable:** Reliable aggregate player state.

### Phase 4 — System Integration

- Integrate Level Runtime initialization.
- Integrate activation and disablement.
- Integrate Respawn lifecycle.
- Integrate Interaction eligibility.
- Integrate Camera lifecycle events.

**Deliverable:** Coordinated player lifecycle across core systems.

### Phase 5 — Reliability

- Add session isolation.
- Add concurrency protection.
- Add failure recovery.
- Add debug panel.
- Add unit and integration test coverage.

**Deliverable:** Production-ready initial implementation.

---

## 20. Acceptance Criteria

The implementation is accepted when:

1. Player lifecycle has one authoritative owner.
2. Movement state remains exclusively owned by Movement System.
3. Respawn state remains exclusively owned by Respawn System.
4. Input processing remains exclusively owned by Input System.
5. Effective capabilities are derived, not independently mutable.
6. All lifecycle transitions are validated.
7. Duplicate requests do not create duplicate operations.
8. Asynchronous operations cannot update stale sessions.
9. Respawn completion restores the correct lifecycle state.
10. Respawn failure does not accidentally reactivate gameplay.
11. Interaction System can reliably determine lifecycle eligibility.
12. UI actions remain available according to their own policy.
13. Snapshot revisions and events are consistent.
14. The debug panel exposes enough information to diagnose lifecycle conflicts.
15. Automated tests cover normal, failure, and concurrency scenarios.

---

## 21. Definition of Done

The Player State System is complete when:

- All public contracts are implemented and documented.
- Ownership boundaries are respected.
- Lifecycle transitions are deterministic.
- Snapshot generation is consistent.
- Capability resolution is covered by tests.
- Respawn integration is verified.
- Session isolation is verified.
- No core gameplay system directly mutates Player State internals.
- No duplicated lifecycle state machines exist.
- Debug tooling is available in development builds.
- No known lifecycle race condition can leave the player unintentionally active or permanently controllable during recovery.
- The implementation follows `01_AGENT_RULES.md` and `02_TECHNICAL_ARCHITECTURE.md`.

---

## 22. Final Design Constraints

The following constraints are mandatory:

1. Player State System is an aggregation and lifecycle coordination layer, not a replacement for domain-specific state machines.
2. Every state domain has one authoritative owner.
3. Lifecycle state must remain separate from locomotion state.
4. Respawn execution must remain owned by Respawn System.
5. Movement physics must remain owned by Movement System.
6. Input processing must remain owned by Input System.
7. Interaction eligibility must be validated by Interaction System.
8. Capabilities must be derived from authoritative state and policy.
9. Lifecycle transitions must be validated and serialized.
10. Every asynchronous operation must validate player and session identity before applying changes.
11. State snapshots must be immutable and revisioned.
12. Events must be ordered, session-scoped, and diagnostic.
13. UI availability must not be tied blindly to gameplay movement availability.
14. Failure handling must prefer a safe restricted state over accidental gameplay activation.
15. Future systems must extend the architecture without introducing a monolithic player state machine.

**The Player State System must make the overall player condition understandable and consistent without taking ownership away from the systems that actually implement player behavior.**