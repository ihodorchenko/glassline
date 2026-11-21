# 15_LEVEL_RUNTIME_SYSTEM_SPEC.md

**Project:** Glassline  
**Document:** Level Runtime System Specification

## 1. Purpose

The Level Runtime System is responsible for managing the lifecycle and runtime state of playable levels.

It coordinates:

- Level initialization and shutdown.
- Level-scoped `LevelSession` creation and destruction.
- Section activation and deactivation.
- Spawn point resolution and initial player placement.
- Runtime object registration.
- Level triggers and activation volumes.
- Transitions between level sections.
- Runtime communication between level content and gameplay systems.
- Recovery from loading and initialization failures.

The system provides a stable runtime environment for Training and Prologue.

It does not define level geometry, generate procedural content, implement player movement, own checkpoint progress, orchestrate player recovery, time runs, or own gameplay progression rules.

Those responsibilities belong to other systems.

`LevelSession` is the level-scoped runtime container described in this document. It is not the Gameplay Session owned by `19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`: the Gameplay Session System owns the gameplay session lifecycle and requests the Level Runtime to load or unload a level. Level Runtime never creates a gameplay session. Player recovery after a fall or failure is owned by the Respawn System and orchestrated exclusively by `RespawnManager` (`17_RESPAWN_SYSTEM_SPEC.md`); Level Runtime only resolves and validates spawn points.

## 2. Scope and Responsibilities

### 2.1 Responsibilities

The Level Runtime System must:

1. Load a level definition and its associated runtime content.
2. Create and manage the level-scoped `LevelSession` runtime container when requested by the Gameplay Session System.
3. Initialize level-scoped runtime dependencies required by the level definition; gameplay system initialization is orchestrated by the Gameplay Session System (`19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`).
4. Activate and deactivate level sections.
5. Resolve and validate player spawn points.
6. Register and unregister runtime objects.
7. Coordinate level transitions.
8. Manage section activation volumes and runtime triggers.
9. Notify other systems about lifecycle changes.
10. Handle loading failures and invalid runtime configurations.
11. Release resources when a session ends.
12. Preserve deterministic section ordering and checkpoint runtime availability for supported game modes.

### 2.2 Non-Responsibilities

The system must not:

- Generate procedural geometry.
- Select procedural seeds, presets, or generation policy (owned by Procedural Generation, `05_PROCEDURAL_GENERATION_SPEC.md`).
- Define parkour routes.
- Own movement physics.
- Orchestrate player recovery or respawn placement (owned by `RespawnManager`, `17_RESPAWN_SYSTEM_SPEC.md`).
- Own checkpoint definitions or checkpoint progress (owned by Checkpoint System, `16_CHECKPOINT_SYSTEM_SPEC.md`).
- Create or own the Gameplay Session lifecycle (owned by Gameplay Session System, `19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`).
- Own player input.
- Control camera presentation.
- Implement interaction behavior.
- Calculate speedrun time or medals.
- Store leaderboard records.
- Access IndexedDB directly.
- Implement tutorial logic.
- Own the visual rendering pipeline.
- Define audio playback behavior.

The system coordinates these systems through interfaces and lifecycle events.

## 3. Initial Implementation Scope

### 3.1 Required Modes

The initial implementation must support:

**Training**
- Independent level session.
- Training environment initialization.
- Training spawn points.
- Training-specific runtime objects.
- Restart and return-to-menu lifecycle.

**Prologue**
- Five ordered sections:
  1. Rooftop
  2. Industrial
  3. Construction
  4. Skybridge
  5. Finish
- Player spawn at the beginning of Rooftop.
- Controlled transitions between sections.
- Five checkpoint locations referenced by the Prologue route.
- Final section completion notification.
- Session cleanup and return to the appropriate game state.

### 3.2 Initial Loading Strategy

The initial implementation should load the complete playable level into memory when practical.

Section activation is initially a logical runtime operation.

It may control:

- Section availability.
- Trigger activation.
- Interaction registration.
- Checkpoint runtime availability.
- Section-specific gameplay objects.
- Section-specific audio and environmental states.

The initial implementation does not require advanced asynchronous geometry streaming.

However, the architecture must allow sections to be loaded and unloaded independently in the future.

### 3.3 Future Features

The following are outside the initial implementation:

- Continuous world streaming.
- Background loading of distant sections.
- Complex memory budgeting and predictive loading.
- Seamless multi-scene world transitions.
- Dynamic level replacement during gameplay.
- Multiplayer level synchronization.
- Server-authoritative world state.
- Persistent destructible environments.
- Dynamic world simulation across unloaded sections.

Interfaces should not prevent these features from being added later.

## 4. Architectural Overview

The Level Runtime System consists of the following components:

| Component | Responsibility |
|---|---|
| LevelRuntimeManager | Main runtime lifecycle coordinator |
| LevelSession | Runtime state of one active level session |
| LevelBootstrapper | Initializes level dependencies and objects |
| LevelSectionController | Controls individual section lifecycle |
| SpawnPointManager | Resolves player spawn positions |
| TriggerManager | Manages runtime triggers and activation volumes |
| LevelTransitionManager | Coordinates section and level transitions |
| EnvironmentStateManager | Controls section-specific environment state |
| RuntimeObjectRegistry | Tracks runtime objects and their ownership |
| LevelRuntimeEvents | Publishes lifecycle events |
| LevelDefinitionProvider | Supplies level definitions |
| LevelRuntimeValidator | Validates runtime configuration |

These components must have clearly separated responsibilities.

The LevelRuntimeManager coordinates operations but must not become a container for every level-related gameplay feature.

### 4.1 High-Level Architecture

```text
Game Application
    |
    v
LevelRuntimeManager
    |
    +-- LevelDefinitionProvider
    |
    +-- LevelRuntimeValidator
    |
    +-- LevelBootstrapper
    |
    +-- LevelSession
    |      |
    |      +-- LevelSectionController
    |      |
    |      +-- SpawnPointManager
    |      |
    |      +-- TriggerManager
    |      |
    |      +-- EnvironmentStateManager
    |      |
    |      +-- RuntimeObjectRegistry
    |
    +-- LevelTransitionManager
    |
    +-- LevelRuntimeEvents
```

External systems communicate with the runtime through public interfaces and events.

## 5. Core Data Models

### 5.1 LevelDefinition

Describes a playable level.

```ts
interface LevelDefinition {
    id: string;
    version: string;

    mode: GameMode;

    displayName: string;

    sections: LevelSectionDefinition[];

    initialSpawnPointId: string;

    metadata: LevelMetadata;
}
```

```ts
type GameMode =
    | "training"
    | "prologue";
```

```ts
interface LevelMetadata {
    description?: string;

    difficulty?: string;

    estimatedDuration?: number;

    supportsSpeedrun: boolean;

    supportsRespawn: boolean;
}
```

The definition describes the structure of a level, not its generated geometry.

#### 5.1.1 Visual content contracts

Two optional authored arrays extend the base definition without moving any
lifecycle ownership away from Level Runtime:

```ts
interface LevelDefinition {
    // ...
    decorations?: LevelDecorationDefinition[];
    architecture?: LevelArchitecturePlacement[];
}
```

- `decorations` — visual-only primitives (box/cylinder/plane/sign) batched into
  instanced meshes by material and shape.
- `architecture` — reusable procedural **Architectural Kit** modules
  (`docs/ARCHITECTURAL_KIT.md`). Each authored variant is generated once, merged
  to one part per material batch, and instanced across every placement.

Both arrays are validated before the level is initialized, are disposed with the
level content, and never create gameplay state, runtime objects or colliders.
Decorative and architectural geometry is the responsibility of the physical
layer's authoring, not of the visual content loader (`docs/04` §10).

### 5.2 LevelSectionDefinition

```ts
interface LevelSectionDefinition {
    id: string;

    order: number;

    displayName: string;

    entrySpawnPointId: string;

    exitSpawnPointId?: string;

    activationPolicy: SectionActivationPolicy;

    runtimeObjectIds: string[];

    nextSectionId?: string;

    metadata?: Record<string, unknown>;
}
```

```ts
type SectionActivationPolicy =
    | "automatic"
    | "triggered"
    | "manual";
```

The section definition must have a stable ID.

Section order must be explicit and validated.

Do not rely on the order in which assets happen to load.

### 5.3 LevelSession

A LevelSession represents one active or previously active level instance.

```ts
interface LevelSession {
    id: string;

    levelId: string;

    levelVersion: string;

    mode: GameMode;

    state: LevelSessionState;

    currentSectionId: string | null;

    createdAt: number;

    startedAt?: number;

    completedAt?: number;

    metadata: Record<string, unknown>;
}
```

```ts
type LevelSessionState =
    | "created"
    | "loading"
    | "initializing"
    | "ready"
    | "active"
    | "paused"
    | "completing"
    | "completed"
    | "unloading"
    | "failed";
```

A session must have a unique ID.

Starting a new session must not silently reuse runtime objects from a previous session.

### 5.4 LevelSectionRuntime

```ts
interface LevelSectionRuntime {
    id: string;

    definition: LevelSectionDefinition;

    state: LevelSectionState;

    activatedAt?: number;

    deactivatedAt?: number;

    registeredObjectIds: string[];

    error?: LevelRuntimeError;
}
```

```ts
type LevelSectionState =
    | "unloaded"
    | "loading"
    | "loaded"
    | "activating"
    | "active"
    | "deactivating"
    | "unloading"
    | "failed";
```

State transitions must be explicit and validated.

## 6. LevelRuntimeManager

### 6.1 Purpose

The LevelRuntimeManager is the public entry point for level lifecycle operations.

It owns:

- The active LevelSession.
- The active level definition.
- Session lifecycle coordination.
- Level initialization and shutdown.
- High-level section activation requests.
- Runtime lifecycle event publication.

It does not own individual gameplay mechanics.

### 6.2 Interface

```ts
interface ILevelRuntimeManager {
    getCurrentSession(): LevelSession | null;

    getCurrentLevel(): LevelDefinition | null;

    loadLevel(
        levelId: string,
        options?: LevelLoadOptions
    ): Promise<LevelSession>;

    startSession(): Promise<void>;

    pauseSession(): void;

    resumeSession(): void;

    completeSession(): Promise<void>;

    restartSession(): Promise<LevelSession>;

    unloadLevel(): Promise<void>;

    activateSection(
        sectionId: string
    ): Promise<void>;

    getSection(
        sectionId: string
    ): LevelSectionRuntime | null;
}
```

These lifecycle operations control the level-scoped `LevelSession` only. They are invoked by the Gameplay Session System (`19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`) as part of the gameplay session lifecycle; Level Runtime does not create or own a gameplay session.

### 6.3 Level Loading Options

```ts
interface LevelLoadOptions {
    spawnPointId?: string;

    preservePlayerSettings?: boolean;

    sessionMetadata?: Record<string, unknown>;

    signal?: AbortSignal;
}
```

The initial implementation should support loading a level from its registered definition.

It must reject invalid level IDs.

### 6.4 Lifecycle Rules

The expected lifecycle is:

```text
No Session
    |
    v
Created
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
Active
    |
    +----> Paused
    |         |
    |         v
    |       Active
    |
    v
Completing
    |
    v
Completed
    |
    v
Unloading
    |
    v
No Session
```

Any initialization stage may transition to Failed.

The manager must prevent invalid operations.

Examples:

- Starting a session while another session is loading.
- Activating a section before its level is ready.
- Completing a session that has already been unloaded.
- Resuming a failed session.
- Restarting while another restart operation is in progress.

Concurrent lifecycle operations must be serialized or rejected deterministically.

Every asynchronous lifecycle operation must be identified by an operation generation and must be cancellable. `loadLevel` accepts an optional `AbortSignal`. If an operation is cancelled or superseded (for example by unload, restart, or a newer load), completion of the stale operation must not mutate the active `LevelSession`, publish lifecycle events, or register runtime objects; partially initialized resources must be rolled back through `LevelBootstrapper.rollback` and the resource adapters. Unloading while a load is in progress must cancel the pending initialization and complete cleanup deterministically.

## 7. LevelBootstrapper

### 7.1 Purpose

LevelBootstrapper prepares a level for runtime execution.

It coordinates initialization without implementing the functionality of individual gameplay systems.

### 7.2 Initialization Responsibilities

The bootstrapper must:

1. Receive a validated LevelDefinition.
2. Prepare level runtime resources.
3. Create the LevelSession.
4. Create section runtime controllers.
5. Initialize the runtime object registry.
6. Register static level objects.
7. Initialize spawn points.
8. Initialize triggers.
9. Initialize environment state.
10. Resolve the initial spawn point.
11. Notify dependent systems that the level is ready.

### 7.3 Interface

```ts
interface ILevelBootstrapper {
    initialize(
        definition: LevelDefinition,
        context: LevelBootstrapContext
    ): Promise<LevelSession>;

    rollback(
        sessionId: string
    ): Promise<void>;
}
```

```ts
interface LevelBootstrapContext {
    sessionId: string;

    mode: GameMode;

    signal?: AbortSignal;
}
```

### 7.4 Initialization Order

The initialization sequence must respect dependencies.

Recommended order:

1. Validate level definition.
2. Create session.
3. Prepare level resources.
4. Initialize section controllers.
5. Register runtime objects.
6. Initialize spawn points.
7. Initialize triggers.
8. Initialize environment state.
9. Resolve initial spawn.
10. Notify external systems.
11. Mark session Ready.

Player movement must not begin before the initial spawn and collision environment are ready.

If initialization fails, the bootstrapper must release partially initialized resources.

## 8. LevelSectionController

### 8.1 Purpose

Controls the lifecycle of one section.

Each section has an independent runtime state.

### 8.2 Interface

```ts
interface ILevelSectionController {
    getSectionId(): string;

    getState(): LevelSectionState;

    load(): Promise<void>;

    activate(): Promise<void>;

    deactivate(): Promise<void>;

    unload(): Promise<void>;

    getDefinition(): LevelSectionDefinition;
}
```

### 8.3 Activation Responsibilities

When a section becomes active:

- Mark the section as active.
- Enable its runtime triggers.
- Enable its interactable objects.
- Make its checkpoint runtime objects available when appropriate; checkpoint activation and progress remain owned by the Checkpoint System (`16_CHECKPOINT_SYSTEM_SPEC.md`).
- Enable section-specific environment behavior.
- Notify dependent systems.

When a section becomes inactive:

- Disable section triggers.
- Prevent new interactions with inactive objects.
- Stop section-specific runtime behavior.
- Notify dependent systems.
- Preserve any state explicitly owned by another gameplay system.

Deactivation must not automatically destroy persistent progress or player state.

### 8.4 Section State Transitions

```text
Unloaded
    |
    v
Loading
    |
    v
Loaded
    |
    v
Activating
    |
    v
Active
    |
    v
Deactivating
    |
    v
Loaded
    |
    v
Unloading
    |
    v
Unloaded
```

Failed transitions must produce structured errors.

Repeated activation requests must not create duplicate registrations or duplicate lifecycle events.

## 9. SpawnPointManager

### 9.1 Purpose

Provides deterministic player spawn resolution.

Spawn points are authored or generated level objects.

The manager does not calculate player movement or perform collision simulation.

### 9.2 SpawnPointDefinition

```ts
interface SpawnPointDefinition {
    id: string;

    sectionId: string;

    position: Vector3;

    rotation: Vector3;

    type: SpawnPointType;

    enabled: boolean;

    metadata?: Record<string, unknown>;
}
```

```ts
type SpawnPointType =
    | "initial"
    | "checkpoint"
    | "respawn"
    | "training"
    | "transition";
```

### 9.3 Interface

```ts
interface ISpawnPointManager {
    register(point: SpawnPointDefinition): void;

    unregister(pointId: string): void;

    getSpawnPoint(
        pointId: string
    ): SpawnPointDefinition | null;

    getInitialSpawnPoint(): SpawnPointDefinition | null;

    getSpawnPointForSection(
        sectionId: string
    ): SpawnPointDefinition | null;

    resolveRespawnPoint(
        context: RespawnContext
    ): SpawnPointDefinition | null;
}
```

```ts
interface RespawnContext {
    mode: GameMode;

    currentSectionId?: string;

    checkpointId?: string;

    fallbackSpawnPointId?: string;
}
```

### 9.4 Spawn Resolution Priority

For resolving respawn destinations requested by the Respawn System:

The active checkpoint is selected by the Checkpoint System (`16_CHECKPOINT_SYSTEM_SPEC.md`); the SpawnPointManager only resolves and validates the corresponding spawn point.

1. Explicit spawn point supplied by the checkpoint destination context.
2. Current section respawn point.
3. Current section entry spawn point.
4. Level initial spawn point.

For initial level loading:

1. Explicit spawn point supplied in load options.
2. LevelDefinition.initialSpawnPointId.

The system must validate that the resolved spawn belongs to the loaded level.

The SpawnPointManager only resolves and validates spawn points. It does not execute the recovery lifecycle, place the player, or reset player state.

### 9.5 Spawn Safety

The SpawnPointManager validates a candidate spawn point before it is used:

- Confirm the spawn point exists.
- Confirm its section is loaded and active.
- Confirm the spawn transform is valid.
- Confirm the spawn point carries no known blocking marker in level metadata.

The manager does not perform collision simulation (§9.1). Full collision safety of the final placement is validated by the Respawn System during recovery and by the movement/placement adapter.

Placement and state restoration are not performed by Level Runtime. For respawn, the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`) owns the recovery lifecycle and requests player placement and movement reset through Movement System interfaces, and camera reset through the Camera System. Level Runtime supplies the resolved, validated spawn point; it must not directly manipulate player physics or camera state.

## 10. TriggerManager

### 10.1 Purpose

Manages runtime trigger objects associated with level content.

Triggers provide spatial signals to other systems.

They do not own the gameplay rules executed after a trigger activates.

### 10.2 TriggerDefinition

```ts
interface TriggerDefinition {
    id: string;

    sectionId: string;

    type: TriggerType;

    enabled: boolean;

    repeatable: boolean;

    metadata?: Record<string, unknown>;
}
```

```ts
type TriggerType =
    | "section-entry"
    | "section-exit"
    | "level-transition"
    | "checkpoint"
    | "training"
    | "generic";
```

### 10.3 Interface

```ts
interface ITriggerManager {
    register(trigger: RuntimeTrigger): void;

    unregister(triggerId: string): void;

    enable(triggerId: string): void;

    disable(triggerId: string): void;

    enableSection(sectionId: string): void;

    disableSection(sectionId: string): void;

    getTrigger(
        triggerId: string
    ): RuntimeTrigger | null;
}
```

### 10.4 Trigger Events

```ts
interface TriggerEvent {
    triggerId: string;

    sectionId: string;

    actorId: string;

    timestamp: number;

    eventType: "enter" | "exit";
}
```

Trigger events must be published through the runtime event system.

The TriggerManager must avoid repeated enter events while an actor remains inside the same trigger.

It must also support correct exit behavior when:

- An actor leaves the trigger.
- A trigger is disabled.
- Its owning section is deactivated.
- The level session is unloaded.

### 10.5 Ownership

The TriggerManager owns trigger lifecycle and registration.

Other systems own trigger meaning.

Examples:

- Speedrun System interprets checkpoint triggers.
- Interaction System interprets interaction-related triggers.
- Training System interprets training exercise triggers.
- LevelTransitionManager interprets section transition triggers.

## 11. LevelTransitionManager

### 11.1 Purpose

Coordinates transitions between sections and between level sessions.

It ensures that transitions are consistent with the active level definition.

### 11.2 Interface

```ts
interface ILevelTransitionManager {
    transitionToSection(
        sectionId: string,
        options?: SectionTransitionOptions
    ): Promise<void>;

    transitionToLevel(
        levelId: string,
        options?: LevelLoadOptions
    ): Promise<void>;

    canTransitionToSection(
        sectionId: string
    ): boolean;

    cancelTransition(): void;

    isTransitioning(): boolean;
}
```

```ts
interface SectionTransitionOptions {
    spawnPointId?: string;

    transitionType?: "seamless" | "fade";

    reason?: string;
}
```

### 11.3 Section Transition Sequence

For a standard transition:

1. Validate destination section.
2. Confirm the current session is active.
3. Confirm the destination is reachable according to the level definition.
4. Mark transition as in progress.
5. Prepare destination section.
6. Activate destination section.
7. Resolve destination spawn point.
8. Request controlled player placement through the Movement System adapter.
9. Update current section ID.
10. Deactivate the previous section when safe.
11. Publish transition completion.
12. Clear transition lock.

The transition must be atomic from the perspective of external gameplay systems.

A failed transition must not leave the session in an inconsistent state.

### 11.4 Prologue Section Sequence

The initial Prologue definition must contain the following order:

```text
Rooftop
   |
   v
Industrial
   |
   v
Construction
   |
   v
Skybridge
   |
   v
Finish
```

The sequence must be validated before gameplay starts.

The runtime system must not silently skip required sections.

The Speedrun System remains responsible for validating required checkpoint order and run completion.

Level Runtime provides the section lifecycle and transition signals needed by Speedrun.

### 11.5 Transition Restrictions

A transition must be rejected when:

- The destination section does not exist.
- The current session is not active.
- Another incompatible transition is running.
- The destination is not reachable.
- The destination has failed to initialize.
- The requested spawn point is invalid.

Scripted transitions may use a separate explicit authorization path.

They must not bypass runtime validation.

## 12. EnvironmentStateManager

### 12.1 Purpose

Coordinates section-specific environment states.

Examples include:

- Environmental lighting configuration.
- Fog or atmospheric settings.
- Wind zones.
- Ambient environmental states.
- Local environment activation.

The manager provides an abstraction over the rendering and environment implementation.

### 12.2 Interface

```ts
interface IEnvironmentStateManager {
    initialize(
        definition: LevelDefinition
    ): Promise<void>;

    activateSection(sectionId: string): void;

    deactivateSection(sectionId: string): void;

    reset(): void;

    dispose(): void;
}
```

Environment state must be restored when a session ends.

The manager must not directly own gameplay audio playback.

Audio-related environment changes should be published as events or forwarded through an adapter to the Audio System.

## 13. RuntimeObjectRegistry

### 13.1 Purpose

Provides centralized registration and lookup of objects belonging to a level session.

Examples:

- Interactable objects.
- Checkpoints.
- Spawn points.
- Triggers.
- Movement surfaces.
- Section-specific runtime objects.

The registry must not replace the ownership model of individual gameplay systems.

### 13.2 Runtime Object Contract

```ts
interface ILevelRuntimeObject {
    id: string;

    sectionId: string;

    objectType: RuntimeObjectType;

    initialize(
        context: RuntimeObjectContext
    ): Promise<void>;

    activate(): void;

    deactivate(): void;

    dispose(): void;
}
```

```ts
type RuntimeObjectType =
    | "interactable"
    | "checkpoint"
    | "spawn-point"
    | "trigger"
    | "movement-surface"
    | "environment"
    | "generic";
```

```ts
interface RuntimeObjectContext {
    sessionId: string;

    levelId: string;

    sectionId: string;
}
```

### 13.3 Registry Interface

```ts
interface IRuntimeObjectRegistry {
    register(object: ILevelRuntimeObject): void;

    unregister(objectId: string): void;

    get(
        objectId: string
    ): ILevelRuntimeObject | null;

    getBySection(
        sectionId: string
    ): ILevelRuntimeObject[];

    getByType(
        type: RuntimeObjectType
    ): ILevelRuntimeObject[];

    activateSection(sectionId: string): void;

    deactivateSection(sectionId: string): void;

    disposeAll(): void;
}
```

### 13.4 Registration Rules

- Object IDs must be unique within a session.
- An object must belong to a valid section.
- An object cannot be registered twice.
- Objects must be unregistered when destroyed.
- Section deactivation must disable its objects.
- Session disposal must release all registered objects.
- Registry queries must not expose objects belonging to destroyed sessions.

Registration must be deterministic.

The order of asynchronous resource loading must not change object identity or section ownership.

## 14. Level Runtime Validation

### 14.1 Purpose

Validates level runtime configuration before gameplay begins.

The validator is separate from procedural generation validation.

Procedural Generation validates generated content.

Level Runtime validates that the resulting level definition can be safely initialized and executed.

### 14.2 Validation Rules

The validator must check:

**Level**
- Valid ID.
- Supported game mode.
- Valid version.
- At least one section.
- Valid initial spawn point.
- No duplicate section IDs.

**Sections**
- Unique IDs.
- Valid section ordering.
- Valid entry spawn references.
- Valid optional exit spawn references.
- Valid next-section references.
- Valid runtime object references.
- No invalid section ownership.

**Spawn Points**
- Unique IDs.
- Valid section ownership.
- Finite position and rotation values.
- Valid spawn type.
- Valid initial spawn point reference.

**Triggers**
- Unique IDs.
- Valid section ownership.
- Valid trigger type.
- Valid activation configuration.

**Runtime Objects**
- Unique IDs.
- Valid section ownership.
- Supported object types.
- No unresolved required dependencies.

### 14.3 Prologue-Specific Validation

The Prologue must contain exactly the required five sections in the defined order:

1. Rooftop
2. Industrial
3. Construction
4. Skybridge
5. Finish

The validator must confirm that:

- All five sections exist.
- The section order is correct.
- Every transition destination exists.
- The initial spawn belongs to Rooftop.
- Every required Speedrun checkpoint reference can be resolved.
- The Finish section can signal level completion.

The validator must not duplicate Speedrun's checkpoint sequence validation.

It verifies runtime availability and references, not whether a player's run is valid.

### 14.4 Validation Result

```ts
interface LevelValidationResult {
    valid: boolean;

    errors: LevelValidationError[];

    warnings: LevelValidationWarning[];
}
```

Warnings should be used for recoverable issues.

Errors must block level initialization when they compromise runtime correctness.

## 15. Events and Communication

### 15.1 Event Principles

Runtime events are the primary mechanism for notifying external systems about level lifecycle changes.

Events must:

- Include session ID.
- Include level ID.
- Include section ID when applicable.
- Include a monotonic timestamp.
- Be published only after the corresponding state change is committed.
- Avoid exposing mutable internal objects.

### 15.2 Required Events

```ts
type LevelRuntimeEvent =
    | LevelLoadingStartedEvent
    | LevelLoadedEvent
    | LevelReadyEvent
    | LevelStartedEvent
    | LevelPausedEvent
    | LevelResumedEvent
    | LevelCompletedEvent
    | LevelUnloadingEvent
    | LevelUnloadedEvent
    | LevelFailedEvent
    | SectionLoadingEvent
    | SectionActivatedEvent
    | SectionDeactivatedEvent
    | SectionTransitionStartedEvent
    | SectionTransitionCompletedEvent
    | SpawnResolvedEvent
    | RuntimeObjectRegisteredEvent
    | RuntimeObjectUnregisteredEvent
    | TriggerActivatedEvent;
```

Each event must have a stable event name and typed payload.

### 15.3 Event Ordering

For a section transition, the expected event order is:

```text
SectionTransitionStarted
    |
    v
SectionLoading
    |
    v
SectionActivated
    |
    v
SpawnResolved
    |
    v
SectionTransitionCompleted
    |
    v
PreviousSectionDeactivated
```

The implementation may adjust the exact internal ordering where necessary, but it must guarantee that external systems never receive a completed transition before the player placement and active-section state are committed.

### 15.4 Event Cleanup

All session-scoped subscriptions must be removed when the session is unloaded.

Listeners must not receive events from destroyed sessions.

## 16. Integration with Other Systems

### 16.1 Gameplay Session System

The Gameplay Session System selects the mode and requests the appropriate level through the Level Runtime public interface.

Level Runtime initializes the requested level and reports when the level-scoped session is ready.

### 16.2 Level Design

Level Design owns:

- Section layout.
- Route structure.
- Section connectivity.
- Spawn point placement.
- Traversal geometry.
- Level-specific design constraints.

Level Runtime consumes the resulting definitions.

It must not modify authored route topology.

### 16.3 Procedural Generation

Procedural Generation produces validated level content.

Level Runtime consumes its output through a stable level definition and resource adapter.

```ts
interface IGeneratedLevelAdapter {
    convert(
        generatedLevel: GeneratedLevel
    ): Promise<LevelDefinition>;
}
```

This adapter is responsible for translating generated content into runtime-compatible definitions.

Level Runtime must not generate geometry itself.

### 16.4 Movement System

Level Runtime provides:

- Initial spawn transform.
- Spawn-point data for respawn destinations, resolved for the Respawn System.
- Section activation and deactivation.
- Movement surface registration lifecycle.
- Level boundaries and relevant trigger signals.

The Movement System owns player physics and movement state.

For initial spawning and section transitions, Level Runtime requests controlled placement through a dedicated movement/spawn adapter. For respawn, the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`) owns the complete recovery lifecycle and performs placement and state reset; Level Runtime only supplies the resolved, validated spawn point.

### 16.5 Camera System

Level Runtime may request camera lifecycle actions through the Camera System:

- Apply appropriate camera state after a transition.
- Restore normal camera behavior after loading or pause.

Camera reset after respawn is requested by the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`) as part of its recovery lifecycle. Camera behavior and presentation remain owned by the Camera System (`13_CAMERA_SYSTEM_SPEC.md`).

### 16.6 Interaction System

Level Runtime registers and unregisters interactable runtime objects.

The Interaction System owns:

- Target detection.
- Target selection.
- Prompt behavior.
- Interaction execution.
- Interaction results.

Inactive section objects must not remain valid interaction targets.

### 16.7 Speedrun System

Level Runtime exposes:

- Level-scoped session start notification.
- Section activation.
- Section transition events.
- Checkpoint runtime object availability.
- Level completion notification.
- Level and route version information.

Speedrun owns:

- Timer.
- Run state.
- Checkpoint sequence validation.
- Splits.
- Medals.
- Run result construction and references to the Statistics System summary (aggregation is owned by the Statistics System, `30_STATISTICS_SYSTEM_SPEC.md`).
- Leaderboard records.
- Run validation.

The Level Runtime System must never calculate or persist speedrun results.

The runtime must provide a stable route version so Speedrun can associate a run with the correct level configuration.

### 16.8 Training System

Training System owns exercise logic and training progress.

Level Runtime provides:

- Training environment.
- Training spawn points.
- Training terminals and triggers.
- Runtime object registration.
- Session lifecycle.

Training exercises must not be implemented inside Level Runtime.

### 16.9 Save System

Level Runtime must not access IndexedDB directly.

If runtime state needs persistence, it must request it through the owning gameplay system or Save System interface.

Examples:

- Training progress is owned by Training System.
- Speedrun history is owned by Speedrun System.
- User settings are owned by Settings System.
- General progression is owned by the Progression System.

Level session state is transient unless a specific gameplay feature explicitly requires persistence.

### 16.10 UI/UX System

UI receives runtime events and presents appropriate states.

Examples:

- Loading screen.
- Level ready state.
- Section transition feedback.
- Pause state.
- Level completion.
- Loading error.

UI must not inspect internal Level Runtime objects.

### 16.11 Audio System

Level Runtime publishes environment and lifecycle events.

Audio System decides how to respond.

Examples:

- Section ambient changes.
- Level loading and unloading.
- Checkpoint-related environment transitions.
- Level completion.

Audio playback remains owned by Audio System.

## 17. Training Session Lifecycle

Training is an independent playable mode.

Expected lifecycle:

```text
Main Menu
    |
    v
Request Training
    |
    v
Load Training Level
    |
    v
Initialize Training Environment
    |
    v
Resolve Training Spawn
    |
    v
Start Training Session
    |
    v
Active Training
    |
    +----> Pause
    |
    +----> Restart
    |
    v
Return to Menu
    |
    v
Unload Training Session
```

Training must support:

- Initial spawn.
- Exercise-specific triggers.
- Interaction objects.
- Restarting the session.
- Returning to the main menu.
- Full runtime cleanup.

Training progress and exercise completion are not owned by Level Runtime.

Loading, unloading, and level-scoped initialization are performed by Level Runtime. Starting, restarting, and completing the gameplay session, including the return to the menu, is orchestrated by the Gameplay Session System (`19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`).

## 18. Prologue Session Lifecycle

The Prologue uses a single logical level session.

The initial implementation should not create a new LevelSession for every section.

Expected lifecycle:

```text
Load Prologue
    |
    v
Initialize Rooftop
    |
    v
Start Session
    |
    v
Rooftop
    |
    v
Industrial
    |
    v
Construction
    |
    v
Skybridge
    |
    v
Finish
    |
    v
Complete Session
    |
    v
Unload Prologue
```

Section transitions must preserve the same session ID.

This ensures that Speedrun, UI, Audio, and other dependent systems can associate all section events with one continuous run.

The five mandatory checkpoints are associated with the appropriate sections.

The exact checkpoint validation logic remains in the Speedrun System.

Gameplay session start and completion are requested and owned by the Gameplay Session System (`19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`); Level Runtime manages only the level-scoped session and its sections.

## 19. Pause and Resume Behavior

Level Runtime must support pausing and resuming the active session.

Pause and resume of the level-scoped session is applied when requested by the Gameplay Session System (`19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`), which owns gameplay pause semantics. Level Runtime only suspends its own runtime operations.

Pausing must:

- Mark the session as paused.
- Prevent new section transitions.
- Disable or suspend appropriate runtime triggers.
- Preserve the current section.
- Notify dependent systems.

Resuming must:

- Restore the previous active section.
- Restore valid runtime triggers.
- Notify dependent systems.
- Avoid duplicate object registration.

Level Runtime does not own global time scaling.

The Game/Application lifecycle coordinator is responsible for coordinating global pause behavior with Movement, Input, Camera, Audio, and other systems.

## 20. Failure Handling and Recovery

### 20.1 Failure Categories

```ts
type LevelRuntimeErrorCode =
    | "LEVEL_NOT_FOUND"
    | "INVALID_LEVEL_DEFINITION"
    | "INVALID_SECTION_REFERENCE"
    | "SPAWN_POINT_NOT_FOUND"
    | "SECTION_LOAD_FAILED"
    | "SECTION_ACTIVATION_FAILED"
    | "TRANSITION_FAILED"
    | "OBJECT_REGISTRATION_FAILED"
    | "INITIALIZATION_CANCELLED"
    | "SESSION_ALREADY_ACTIVE"
    | "INVALID_SESSION_STATE"
    | "RESOURCE_DISPOSAL_FAILED";
```

```ts
interface LevelRuntimeError {
    code: LevelRuntimeErrorCode;

    message: string;

    levelId?: string;

    sectionId?: string;

    objectId?: string;

    recoverable: boolean;

    cause?: unknown;
}
```

### 20.2 Recovery Rules

- Invalid level definitions must block initialization.
- Failed initial loading must roll back partial initialization.
- Failed section activation must not update the current section.
- Failed transitions must preserve the last valid active section when possible.
- Invalid spawn points must use the configured fallback or fail safely.
- Object registration failures must be reported with object identity.
- Unloading must attempt cleanup of all owned resources even if one disposal operation fails.

### 20.3 Recovery Strategy

The manager should use a staged cleanup process.

A cleanup failure must not prevent other resources from being released.

Errors should be aggregated and reported after cleanup attempts complete.

The system must not silently ignore failed transitions or invalid runtime objects.

## 21. Performance Requirements

### 21.1 General

The runtime system must avoid expensive work in the gameplay update loop.

- Level loading is asynchronous.
- Initialization should not block rendering unnecessarily.
- Section transitions should avoid unnecessary allocations.
- Registry lookups should be efficient.
- Trigger evaluation should be limited to active triggers.
- Inactive sections should not perform unnecessary runtime work.
- Runtime objects must be released when their owning session ends.

### 21.2 Initial Performance Targets

| Operation | Target |
|---|---|
| Runtime section lookup | O(1) preferred |
| Runtime object lookup by ID | O(1) preferred |
| Section activation | No unnecessary full-level reinitialization |
| Session cleanup | All owned resources released |
| Trigger processing | Only active triggers |
| Gameplay update loop | No asynchronous resource loading |

These are architectural targets rather than strict hardware benchmarks.

Actual loading time and frame performance must be measured on the target browser and device configurations.

### 21.3 Future Streaming Compatibility

The following interfaces should remain independent of the loading implementation:

- LevelSectionController.
- LevelBootstrapper.
- LevelTransitionManager.
- RuntimeObjectRegistry.

This allows a future implementation to load section resources asynchronously without changing gameplay systems.

## 22. Resource Ownership and Cleanup

Every runtime resource must have an explicit owner.

Examples:

| Resource | Owner |
|---|---|
| Level session | LevelRuntimeManager |
| Section controller | LevelRuntimeManager |
| Section runtime objects | RuntimeObjectRegistry |
| Spawn definitions | SpawnPointManager |
| Trigger registrations | TriggerManager |
| Environment state | EnvironmentStateManager |
| Player physics state | Movement System |
| Camera effects | Camera System |
| Interaction state | Interaction System |
| Speedrun state | Speedrun System |

### 22.1 Disposal Requirements

When a session is unloaded:

1. Mark session as unloading.
2. Reject new runtime operations.
3. Cancel pending loads and transitions.
4. Disable active triggers.
5. Deactivate sections.
6. Unregister runtime objects.
7. Dispose section resources.
8. Reset environment state.
9. Remove session-scoped event subscriptions.
10. Release level resources.
11. Clear the active session reference.
12. Publish LevelUnloaded.

Cleanup must be idempotent.

Calling unload more than once must not cause duplicate disposal or invalid state transitions.

Engine-owned resources (geometries, materials, textures, physics colliders, audio nodes) must be disposed through the corresponding resource adapters; dropping references alone is not sufficient. Disposal failures must be aggregated and surfaced as a `RESOURCE_DISPOSAL_FAILED` runtime error without preventing the remaining resources from being released.

## 23. Debugging and Development Tools

The initial implementation should provide a development-only Level Runtime Debug Panel.

It should display:

- Current level ID.
- Current session ID.
- Session state.
- Current section ID.
- All section states.
- Registered runtime object count.
- Active trigger count.
- Current spawn point.
- Current transition state.
- Last runtime error.

### 23.1 Debug Actions

Development builds may expose:

- Load level by ID.
- Restart session.
- Activate section by ID.
- Deactivate section by ID.
- Teleport to a spawn point.
- List registered runtime objects.
- List active triggers.
- Validate current level definition.
- Force session cleanup.

Debug actions must use the same public interfaces as normal gameplay.

They must not directly modify internal component state.

Debug functionality must not be exposed as player-facing UI in production builds.

## 24. Testing Requirements

### 24.1 Unit Tests

Test:

- Session state transitions.
- Section state transitions.
- Level definition validation.
- Prologue section ordering.
- Spawn point resolution.
- Duplicate runtime object registration.
- Runtime object unregistration.
- Trigger registration and activation.
- Invalid transition rejection.
- Session cleanup idempotency.
- Event ordering.
- Error propagation.

### 24.2 Integration Tests

Test:

1. Load Training.
2. Start Training.
3. Restart Training.
4. Unload Training.
5. Load Prologue.
6. Start Prologue.
7. Transition through all five sections.
8. Verify the same session ID is preserved.
9. Verify checkpoint objects are available.
10. Complete the Finish section.
11. Unload Prologue.
12. Verify all runtime objects are released.

### 24.3 Failure Tests

Test:

- Missing level definition.
- Invalid initial spawn point.
- Missing section reference.
- Failed section initialization.
- Failed object registration.
- Failed transition.
- Cancelled loading operation.
- Unload during loading.
- Unload during transition.
- Repeated unload.
- Duplicate lifecycle requests.
- Stale completion from a superseded load operation.
- Stale events from destroyed sessions.

### 24.4 Performance Tests

Verify:

- No expensive initialization in the frame update loop.
- No duplicate object registrations during repeated transitions.
- Inactive triggers do not generate unnecessary processing.
- Repeated session creation does not increase retained runtime objects.
- Session cleanup does not leave stale event listeners.

### 24.5 Testability

Use interfaces and dependency injection for:

- Level definition provider.
- Resource loader.
- Runtime object factory.
- Player spawn adapter.
- Event dispatcher.
- Environment adapter.
- Clock.

Tests must not require a fully rendered game scene when testing runtime lifecycle logic.

## 25. Implementation Phases

### Phase 1 — Core Runtime Models

Implement:

- LevelDefinition.
- LevelSectionDefinition.
- LevelSession.
- LevelSectionRuntime.
- Runtime error models.
- Runtime state enums.

**Deliverable:** Type-safe runtime data structures.

### Phase 2 — Validation and Bootstrap

Implement:

- LevelDefinitionProvider.
- LevelRuntimeValidator.
- LevelBootstrapper.
- Session initialization and rollback.

**Deliverable:** Validated level loading and initialization.

### Phase 3 — Session Management

Implement:

- LevelRuntimeManager.
- Session lifecycle.
- Pause and resume.
- Restart.
- Unload and cleanup.

**Deliverable:** A complete Training session lifecycle.

### Phase 4 — Section Management

Implement:

- LevelSectionController.
- Section state transitions.
- RuntimeObjectRegistry.
- Section activation and deactivation.

**Deliverable:** Independent logical section lifecycle management.

### Phase 5 — Spawn and Trigger Systems

Implement:

- SpawnPointManager.
- TriggerManager.
- Spawn resolution.
- Trigger lifecycle events.

**Deliverable:** Runtime spawn and trigger infrastructure.

### Phase 6 — Level Transitions

Implement:

- LevelTransitionManager.
- Transition validation.
- Transition locking.
- Destination spawn resolution.
- Transition failure recovery.

**Deliverable:** Reliable section transitions.

### Phase 7 — Training Integration

Integrate:

- Training level definition.
- Training spawn points.
- Training terminals and triggers.
- Training System lifecycle.

**Deliverable:** Fully playable Training runtime.

### Phase 8 — Prologue Integration

Integrate:

- Rooftop.
- Industrial.
- Construction.
- Skybridge.
- Finish.
- Five required checkpoint references.
- Speedrun lifecycle events.
- Final level completion.

**Deliverable:** Complete Prologue runtime.

### Phase 9 — Debugging and Verification

Implement:

- Runtime debug panel.
- Validation diagnostics.
- Lifecycle tests.
- Failure tests.
- Resource cleanup verification.

**Deliverable:** Stable and testable Level Runtime System.

## 26. Acceptance Criteria

The implementation is accepted when:

- [ ] Training can be loaded and unloaded independently.
- [ ] Prologue can be loaded as one logical session.
- [ ] All five Prologue sections exist and are correctly ordered.
- [ ] Session lifecycle transitions are validated.
- [ ] Section lifecycle transitions are validated.
- [ ] Initial spawn resolution works.
- [ ] Respawn resolution supports checkpoint and fallback locations.
- [ ] Runtime objects can be registered and unregistered.
- [ ] Inactive section objects cannot be interacted with.
- [ ] Triggers are activated and deactivated with their sections.
- [ ] Section transitions validate their destinations.
- [ ] Player placement is coordinated through an adapter.
- [ ] Failed transitions do not corrupt the active session.
- [ ] Cancelled or superseded asynchronous loads cannot mutate the active session or leak partially initialized resources.
- [ ] Prologue section transitions preserve the session ID.
- [ ] Speedrun receives the required lifecycle and section events.
- [ ] Level Runtime does not own Speedrun timing or validation.
- [ ] Level Runtime does not orchestrate respawn or own checkpoint progress.
- [ ] Save System integration uses the appropriate external interfaces.
- [ ] Session cleanup releases all owned runtime resources.
- [ ] Repeated cleanup is safe.
- [ ] Runtime validation catches invalid definitions before gameplay.
- [ ] Debugging tools can inspect runtime state.
- [ ] Unit and integration tests cover the required lifecycle.

## 27. Definition of Done

The Level Runtime System is considered complete for the initial implementation when:

1. All core runtime components are implemented.
2. Training loads, starts, restarts, and unloads correctly.
3. Prologue loads and executes its complete five-section sequence.
4. Spawn points and triggers operate correctly.
5. Runtime objects follow explicit ownership and lifecycle rules.
6. Section transitions are reliable and recoverable.
7. Runtime events are correctly published and cleaned up.
8. Movement, Camera, Interaction, Speedrun, Training, UI, and Audio integrations use defined interfaces.
9. No direct IndexedDB access exists inside Level Runtime.
10. No runtime lifecycle logic depends on a specific rendering engine API.
11. Automated tests cover normal and failure paths.
12. No known resource leaks or stale session subscriptions remain.

## 28. Final Design Constraints

The implementation agent must follow these constraints:

1. Do not implement procedural geometry generation inside Level Runtime.
2. Do not duplicate Level Design route definitions.
3. Do not implement movement or physics behavior.
4. Do not implement interaction execution.
5. Do not own Speedrun timing, splits, medals, or leaderboard data.
6. Do not access IndexedDB directly.
7. Do not assume a specific 3D engine.
8. Use adapters for engine-specific scene, transform, resource, and physics operations.
9. Keep level sessions and section runtime states explicit.
10. Keep section IDs and runtime object IDs stable.
11. Preserve a single Prologue session across all five sections.
12. Validate all transitions before applying them.
13. Make initialization and cleanup safe against cancellation and failure.
14. Make resource ownership explicit.
15. Keep runtime events typed and session-scoped.
16. Keep initial implementation simple: load the complete level and logically activate sections.
17. Design interfaces so future streaming can be added without rewriting gameplay systems.
18. Do not implement future features unless explicitly requested.
19. Prefer small components with clear responsibilities over a monolithic manager.
20. Follow `01_AGENT_RULES.md` and the architectural constraints in `02_TECHNICAL_ARCHITECTURE.md`.

The Level Runtime System must provide a predictable and reliable execution environment for all playable levels while keeping gameplay logic, level content, persistence, and rendering concerns separated.