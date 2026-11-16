# TECHNICAL ARCHITECTURE

## MIRROR'S EDGE — RUNNER PROTOCOL

**Document:** `02_TECHNICAL_ARCHITECTURE.md`  
**Version:** 1.0  
**Status:** Proposed Architecture  
**Depends on:** `00_PROJECT_BRIEF.md`, `01_AGENT_RULES.md`

---

# 1. Purpose

This document defines the technical architecture of MIRROR'S EDGE — RUNNER PROTOCOL.

It describes:

- Application architecture.
- Project directory structure.
- Core system responsibilities.
- System communication.
- Application lifecycle.
- Game loop and timing.
- Rendering architecture.
- Physics architecture.
- Player architecture.
- Procedural generation architecture.
- Level architecture.
- Audio architecture.
- UI architecture.
- Persistence architecture.
- Resource management.
- Error handling.
- Performance considerations.

This document is the primary technical reference for implementation.

The architecture should support the complete prototype without introducing unnecessary engine-level complexity.

---

# 2. Technology Stack

## 2.1 Core technologies

| Technology | Responsibility |
|---|---|
| TypeScript | Application and gameplay logic |
| Three.js | 3D rendering |
| WebGLRenderer | Initial rendering backend |
| Vite | Development server and build |
| Rapier | Physics simulation |
| Web Audio API | Procedural audio |
| GLSL | Custom shaders |
| IndexedDB | Persistent local data |
| HTML/CSS | Application interface |

Primary dependencies:

```text
three
@dimforge/rapier3d-compat
```

Additional dependencies must be evaluated before introduction.

Do not introduce a frontend framework unless explicitly approved.

## 2.2 Rendering backend

Use Three.js `WebGLRenderer` for the initial implementation.

The architecture should avoid unnecessary dependence on renderer-specific implementation details where practical.

WebGPU is a possible future extension, not part of the initial implementation.

## 2.3 Physics engine

Use Rapier through:

```text
@dimforge/rapier3d-compat
```

Rapier is responsible for gameplay physics and collision detection.

Three.js is responsible for visual representation.

Do not implement a second physics engine.

---

# 3. Architectural Principles

The architecture follows these principles:

1. Separation of responsibilities.
2. Explicit system ownership.
3. Composition over inheritance.
4. Deterministic gameplay behavior where required.
5. Physics and rendering separation.
6. Data-driven configuration.
7. Explicit resource lifecycle.
8. Minimal global state.
9. Small, testable modules.
10. Incremental implementation.

## 3.1 High-level architecture

The application consists of the following logical layers:

```text
APPLICATION
│
├── CORE
│   ├── Application Lifecycle
│   ├── Game Loop
│   ├── Scene Management
│   ├── Event System
│   └── Configuration
│
├── GAMEPLAY
│   ├── Player
│   ├── Movement
│   ├── Parkour
│   ├── Run Management
│   ├── Checkpoints
│   └── Statistics
│
├── WORLD
│   ├── Level Management
│   ├── Procedural Generation
│   ├── Environment
│   └── Navigation
│
├── ENGINE SYSTEMS
│   ├── Rendering
│   ├── Physics
│   ├── Audio
│   └── Camera
│
├── PRESENTATION
│   ├── Main Menu
│   ├── HUD
│   ├── Training UI
│   ├── Results
│   └── Settings
│
└── DATA
    ├── IndexedDB
    ├── Run Repository
    └── Settings Repository
```

This is a logical architecture, not a requirement to create one class for every box.

---

# 4. Project Structure

Recommended initial directory structure:

```text
runner-protocol/
│
├── public/
│   └── fonts/
│
├── src/
│   │
│   ├── app/
│   │   ├── Application.ts
│   │   ├── ApplicationConfig.ts
│   │   └── ApplicationLifecycle.ts
│   │
│   ├── core/
│   │   ├── Game.ts
│   │   ├── GameLoop.ts
│   │   ├── SceneManager.ts
│   │   ├── EventBus.ts
│   │   ├── InputManager.ts
│   │   ├── Time.ts
│   │   └── Disposable.ts
│   │
│   ├── rendering/
│   │   ├── Renderer.ts
│   │   ├── RenderScene.ts
│   │   ├── LightingManager.ts
│   │   ├── MaterialLibrary.ts
│   │   ├── CameraManager.ts
│   │   ├── CameraEffects.ts
│   │   └── PostProcessing.ts
│   │
│   ├── physics/
│   │   ├── PhysicsWorld.ts
│   │   ├── PhysicsConfig.ts
│   │   ├── PhysicsLayers.ts
│   │   ├── PhysicsQueries.ts
│   │   ├── PhysicsBodyFactory.ts
│   │   └── SurfaceRegistry.ts
│   │
│   ├── player/
│   │   ├── Player.ts
│   │   ├── PlayerConfig.ts
│   │   ├── PlayerController.ts
│   │   ├── PlayerInput.ts
│   │   ├── PlayerState.ts
│   │   ├── PlayerStateMachine.ts
│   │   ├── MovementController.ts
│   │   ├── MovementConfig.ts
│   │   ├── GroundDetector.ts
│   │   ├── CameraController.ts
│   │   ├── HandController.ts
│   │   └── parkour/
│   │       ├── ParkourSystem.ts
│   │       ├── JumpSystem.ts
│   │       ├── SlideSystem.ts
│   │       ├── VaultSystem.ts
│   │       ├── WallRunSystem.ts
│   │       ├── WallJumpSystem.ts
│   │       ├── LedgeSystem.ts
│   │       ├── ClimbSystem.ts
│   │       ├── BalanceSystem.ts
│   │       └── ZiplineSystem.ts
│   │
│   ├── world/
│   │   ├── World.ts
│   │   ├── WorldConfig.ts
│   │   ├── EnvironmentManager.ts
│   │   └── navigation/
│   │       ├── RouteDefinition.ts
│   │       └── NavigationMarker.ts
│   │
│   ├── procedural/
│   │   ├── ProceduralSeed.ts
│   │   ├── RandomGenerator.ts
│   │   ├── GeometryFactory.ts
│   │   ├── TextureGenerator.ts
│   │   ├── MaterialGenerator.ts
│   │   ├── generators/
│   │   │   ├── BuildingGenerator.ts
│   │   │   ├── FacadeGenerator.ts
│   │   │   ├── RooftopGenerator.ts
│   │   │   ├── PipeGenerator.ts
│   │   │   ├── VentGenerator.ts
│   │   │   ├── StairGenerator.ts
│   │   │   ├── RailGenerator.ts
│   │   │   ├── PlatformGenerator.ts
│   │   │   ├── ScaffoldGenerator.ts
│   │   │   └── SignGenerator.ts
│   │   └── presets/
│   │
│   ├── levels/
│   │   ├── Level.ts
│   │   ├── LevelManager.ts
│   │   ├── LevelContext.ts
│   │   ├── training/
│   │   │   ├── TrainingLevel.ts
│   │   │   ├── TrainingLayout.ts
│   │   │   └── TrainingLessons.ts
│   │   └── prologue/
│   │       ├── PrologueLevel.ts
│   │       ├── PrologueLayout.ts
│   │       ├── PrologueRoute.ts
│   │       └── PrologueCheckpoints.ts
│   │
│   ├── gameplay/
│   │   ├── RunManager.ts
│   │   ├── RunTimer.ts
│   │   ├── RunStatistics.ts
│   │   ├── CheckpointManager.ts
│   │   ├── RunValidation.ts
│   │   └── GhostRecorder.ts
│   │
│   ├── audio/
│   │   ├── AudioManager.ts
│   │   ├── AudioContextManager.ts
│   │   ├── ProceduralAudio.ts
│   │   ├── FootstepGenerator.ts
│   │   ├── EnvironmentAudio.ts
│   │   └── AudioConfig.ts
│   │
│   ├── ui/
│   │   ├── UIManager.ts
│   │   ├── screens/
│   │   │   ├── MainMenu.ts
│   │   │   ├── TrainingScreen.ts
│   │   │   ├── ResultsScreen.ts
│   │   │   ├── LeaderboardScreen.ts
│   │   │   └── SettingsScreen.ts
│   │   ├── hud/
│   │   │   ├── HUD.ts
│   │   │   ├── SpeedIndicator.ts
│   │   │   ├── RunTimerDisplay.ts
│   │   │   └── NavigationIndicator.ts
│   │   └── styles/
│   │
│   ├── storage/
│   │   ├── Database.ts
│   │   ├── RunRepository.ts
│   │   ├── SettingsRepository.ts
│   │   └── migrations/
│   │
│   ├── shared/
│   │   ├── types/
│   │   ├── constants/
│   │   └── utils/
│   │
│   └── main.ts
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 4.1 Structure rules

This structure is the target organization, not a requirement to create every file immediately.

Create files only when their functionality is being implemented.

Do not create empty classes or placeholder modules solely to match the directory tree.

The architecture may be refined during implementation if a concrete technical reason appears.

---

# 5. Application Lifecycle

`Application` is the composition root of the application.

It creates and connects the main systems.

It should not contain gameplay implementation.

## 5.1 Startup sequence

Expected initialization order:

```text
BOOT
 │
 ▼
LOAD CONFIGURATION
 │
 ▼
INITIALIZE STORAGE
 │
 ▼
INITIALIZE RENDERER
 │
 ▼
INITIALIZE PHYSICS
 │
 ▼
INITIALIZE INPUT
 │
 ▼
INITIALIZE AUDIO MANAGER
 │
 ▼
INITIALIZE UI
 │
 ▼
INITIALIZE GAME SYSTEMS
 │
 ▼
SHOW MAIN MENU
```

Some systems may initialize lazily.

For example, browser audio should not necessarily start before a user gesture.

The actual initialization order must respect dependency requirements.

## 5.2 Application responsibilities

`Application`:

- Creates core services.
- Owns application lifecycle.
- Connects systems.
- Handles startup errors.
- Coordinates shutdown.
- Exposes application-level operations.

It must not directly implement:

- Player movement.
- Parkour logic.
- Level geometry.
- Run validation.
- UI rendering details.

## 5.3 Shutdown

When the application is disposed:

- Stop the game loop.
- Remove global listeners.
- Stop active audio.
- Dispose the current level.
- Release physics resources.
- Dispose rendering resources.
- Release DOM references.
- Close persistent connections where appropriate.

Shutdown must be safe to call more than once.

---

# 6. Core Systems

## 6.1 Game

`Game` coordinates the active gameplay session.

Responsibilities:

- Starting a game session.
- Pausing and resuming gameplay.
- Stopping a session.
- Connecting the active level to player and gameplay systems.
- Coordinating session state.

It does not own low-level rendering or physics implementation.

## 6.2 GameLoop

`GameLoop` coordinates update timing.

Responsibilities:

- Scheduling frame updates.
- Maintaining the physics accumulator.
- Executing fixed physics steps.
- Executing gameplay updates.
- Executing rendering.
- Handling visibility changes.
- Preventing unlimited catch-up simulation.

It must not contain mechanic-specific movement logic.

## 6.3 SceneManager

`SceneManager` manages the active Three.js scene.

Responsibilities:

- Creating and switching scenes.
- Registering scene objects.
- Managing environment roots.
- Removing scene content.
- Coordinating scene lifecycle.

It does not decide gameplay progression.

## 6.4 EventBus

`EventBus` provides typed communication between loosely coupled systems.

Responsibilities:

- Publishing events.
- Subscribing to events.
- Removing subscriptions.
- Maintaining typed event payloads.

Do not use it for every internal method call.

## 6.5 InputManager

`InputManager` collects user input.

Responsibilities:

- Keyboard input.
- Mouse movement.
- Pointer lock.
- Input state.
- Input action mapping.
- Focus and visibility handling.

It should provide normalized input data rather than directly controlling the player.

The player controller consumes this data.

---

# 7. Game Loop and Timing Architecture

The game loop uses a fixed physics timestep and variable rendering timestep.

## 7.1 Timing model

Initial configuration:

```ts
interface GameLoopConfig {
  physicsHz: 60 | 120;
  maxFrameDelta: number;
  maxPhysicsStepsPerFrame: number;
}
```

Initial defaults:

```ts
const GAME_LOOP_CONFIG: GameLoopConfig = {
  physicsHz: 60,
  maxFrameDelta: 0.1,
  maxPhysicsStepsPerFrame: 5,
};
```

These are initial implementation values, not final performance guarantees.

## 7.2 Update sequence

Conceptual update:

```text
FRAME START
    │
    ▼
READ INPUT
    │
    ▼
ACCUMULATE FRAME TIME
    │
    ▼
FIXED PHYSICS LOOP
    │
    ├── Update player intent
    ├── Update movement and parkour
    ├── Apply physics commands
    ├── Step Rapier
    └── Read physics results
    │
    ▼
GAMEPLAY UPDATE
    │
    ├── Checkpoints
    ├── Run timer
    ├── Statistics
    └── Gameplay events
    │
    ▼
INTERPOLATE VISUAL TRANSFORMS
    │
    ▼
CAMERA AND VISUAL EFFECTS
    │
    ▼
RENDER
    │
    ▼
FRAME END
```

The exact ordering of gameplay and physics operations must be implemented consistently.

## 7.3 Fixed timestep

```ts
const fixedDelta = 1 / physicsHz;
```

Physics simulation must use this fixed value.

Do not pass variable render delta directly to Rapier as the simulation timestep.

## 7.4 Catch-up protection

When the browser experiences a long frame delay:

- Clamp the accumulated frame delta.
- Limit the number of physics steps per frame.
- Prevent an unlimited catch-up loop.
- Avoid allowing the simulation to run indefinitely behind real time.

If the browser tab becomes inactive, pause or suspend gameplay according to the active game state.

A speedrun must not silently continue in an undefined simulation state.

---

# 8. Rendering Architecture

## 8.1 Renderer

`Renderer` owns the Three.js rendering backend.

Responsibilities:

- Creating `WebGLRenderer`.
- Managing canvas.
- Configuring pixel ratio.
- Handling resize.
- Executing rendering.
- Releasing GPU resources.

Initial renderer configuration should favor compatibility and predictable performance.

Avoid enabling expensive rendering features before they are needed.

## 8.2 RenderScene

`RenderScene` represents a visual world.

It contains:

- Environment geometry.
- Level objects.
- Visual player representation.
- Lighting.
- Background.
- Visual effects.

It does not own physics bodies.

## 8.3 LightingManager

Responsible for:

- Main directional lighting.
- Ambient illumination.
- Environment lighting.
- Shadow configuration.
- Lighting presets.

Avoid excessive dynamic lights.

Use a controlled lighting setup appropriate for the intended clean architectural visual style.

## 8.4 MaterialLibrary

Provides reusable materials.

Material creation should be centralized where appropriate.

The initial material palette:

| Material | Color |
|---|---|
| Pure White | `#F1F1ED` |
| Concrete | `#C7C9C7` |
| Steel | `#747A7D` |
| Dark Metal | `#33393D` |
| Runner Red | `#D52E36` |
| Sky | `#A7B9C4` |

MaterialLibrary should not become a global mutable object containing all visual state.

## 8.5 CameraManager

Owns the active Three.js camera.

Responsibilities:

- Camera creation.
- Projection settings.
- Aspect ratio.
- Camera positioning.
- Camera lifecycle.

Player-specific camera motion belongs to `CameraController`.

## 8.6 CameraController

Responsible for:

- First-person camera positioning.
- Head bob.
- FOV changes.
- Landing response.
- Jump response.
- Sliding camera behavior.
- Wallrun tilt.
- Smooth camera transitions.

Camera effects must derive from player state and movement information.

The camera must not control the physics body.

## 8.7 PostProcessing

Post-processing is optional and should be implemented only when required.

Potential effects:

- Color grading.
- Subtle bloom.
- Vignette.
- Carefully controlled motion effects.

Post-processing must not compromise gameplay readability or performance.

---

# 9. Physics Architecture

## 9.1 PhysicsWorld

`PhysicsWorld` owns the Rapier world.

Responsibilities:

- Physics initialization.
- World configuration.
- Fixed simulation step.
- Physics body creation and removal.
- Collision event handling.
- World cleanup.

Other modules should interact with physics through defined interfaces rather than directly modifying the underlying Rapier world everywhere.

## 9.2 Player collider

The player uses a capsule collider.

The capsule represents the physical body, not the visible player.

Initial player physics configuration should be centralized.

Example configuration:

```ts
interface PlayerPhysicsConfig {
  capsuleRadius: number;
  capsuleHalfHeight: number;
  mass: number;
  gravityScale: number;
  friction: number;
  restitution: number;
}
```

Exact values will be calibrated during the player controller implementation.

## 9.3 Physics body ownership

The player controller owns the player's physical representation through the physics abstraction.

The level owns static environment colliders.

Parkour systems request physics queries and apply movement commands through the player movement interface.

## 9.4 Collision layers

Define explicit collision groups.

Initial conceptual categories:

```text
PLAYER
WORLD
PARKOUR
TRIGGER
DECORATION
INTERACTION
```

Not every category needs a physical collider.

`DECORATION` should normally be excluded from gameplay collision.

Use a documented mapping to Rapier collision groups.

## 9.5 Physics queries

Centralize common queries where practical:

- Ground detection.
- Forward obstacle detection.
- Wall detection.
- Ledge detection.
- Landing prediction.
- Vault clearance.
- Zipline attachment.

Queries should support appropriate collision filtering.

Do not let every parkour mechanic independently implement slightly different versions of the same ground or wall detection logic.

## 9.6 SurfaceRegistry

Provides surface metadata.

Example:

```ts
type SurfaceType =
  | "concrete"
  | "metal"
  | "rubber"
  | "glass"
  | "asphalt";
```

Surface metadata can be used by:

- Footstep audio.
- Landing sounds.
- Movement friction.
- Gameplay feedback.

The surface type should be associated with physical environment objects through an explicit mapping.

---

# 10. Player Architecture

The player system is one of the central gameplay components.

It must be modular enough to support multiple parkour mechanics without duplicating movement logic.

## 10.1 Player

`Player` is the composition root of the player subsystem.

It coordinates:

- PlayerController.
- MovementController.
- PlayerStateMachine.
- ParkourSystem.
- CameraController.
- HandController.

It should not contain the complete implementation of all these systems.

## 10.2 PlayerController

Responsible for high-level player updates.

It:

- Reads normalized input.
- Determines player intent.
- Coordinates movement.
- Coordinates state transitions.
- Exposes player state to other systems.

## 10.3 MovementController

Responsible for common locomotion:

- Walking.
- Running.
- Sprinting.
- Acceleration.
- Deceleration.
- Direction changes.
- Air control.
- Momentum preservation.

Parkour mechanics should reuse this common movement foundation.

## 10.4 PlayerStateMachine

Defines the current movement state.

Initial state set:

```ts
type PlayerState =
  | "IDLE"
  | "RUNNING"
  | "SPRINTING"
  | "JUMPING"
  | "FALLING"
  | "LANDING"
  | "SLIDING"
  | "VAULTING"
  | "WALLRUN"
  | "CLIMBING"
  | "BALANCING"
  | "ZIPLINE";
```

State transitions must be explicit.

Each state should define:

- Entry conditions.
- Active behavior.
- Exit conditions.
- Allowed transitions.
- Required cleanup.

Do not allow incompatible mechanics to remain active simultaneously.

## 10.5 ParkourSystem

`ParkourSystem` coordinates individual parkour mechanics.

It is not responsible for rendering their visual effects.

Each mechanic should be implemented as an independent module.

Examples:

- JumpSystem.
- SlideSystem.
- VaultSystem.
- WallRunSystem.
- WallJumpSystem.
- LedgeSystem.
- ClimbSystem.
- BalanceSystem.
- ZiplineSystem.

## 10.6 Player data

Expose a stable read-only snapshot of player information for HUD, statistics, and audio.

Conceptual interface:

```ts
interface PlayerSnapshot {
  position: Vector3Like;
  velocity: Vector3Like;
  speed: number;
  grounded: boolean;
  state: PlayerState;
  surface: SurfaceType | null;
}
```

Avoid allowing UI or audio to mutate this snapshot.

The actual project should use suitable immutable or readonly data structures.

---

# 11. Input Architecture

Input is separated from gameplay behavior.

## 11.1 Input actions

Initial action mapping:

| Action | Default input |
|---|---|
| Move forward | W |
| Move backward | S |
| Move left | A |
| Move right | D |
| Jump | Space |
| Sprint | Shift |
| Slide | Ctrl |
| Interact / Vault | E |
| Pause | Escape |

Mouse movement controls the first-person camera.

The mapping should be configurable in the future, but full key rebinding is not required for the first prototype.

## 11.2 Input abstraction

Gameplay systems should consume actions rather than browser-specific keyboard events.

Example:

```ts
interface PlayerInputSnapshot {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;

  jumpPressed: boolean;
  sprintHeld: boolean;
  slidePressed: boolean;
  interactPressed: boolean;
}
```

Input events should be normalized before reaching the player controller.

## 11.3 Pointer lock

Pointer lock is required for first-person mouse control.

Handle:

- User gesture requirements.
- Pointer lock activation.
- Pointer lock release.
- Escape key.
- Window focus loss.
- Returning to the game.

Do not assume pointer lock is always available.

---

# 12. Procedural Generation Architecture

Procedural generation is responsible for creating all game environment assets.

## 12.1 Generator contract

Generators should follow a consistent conceptual interface.

Example:

```ts
interface GeneratorContext {
  seed: number;
  materials: MaterialProvider;
  geometry: GeometryFactory;
}

interface GeneratedObject {
  visual: Object3D;
  colliders: ColliderDefinition[];
  dispose(): void;
}
```

This is a conceptual contract. Final interfaces should be adjusted to the actual implementation.

A generator should:

- Receive explicit configuration.
- Use a deterministic random source.
- Produce visual geometry.
- Describe physical collision geometry.
- Expose resource cleanup.
- Avoid controlling unrelated gameplay systems.

## 12.2 RandomGenerator

Provide a deterministic random number generator.

The generator should support:

- Explicit seed initialization.
- Repeatable number sequences.
- Range generation.
- Integer generation.
- Weighted selection where needed.

Do not use global random state for deterministic environment construction.

## 12.3 GeometryFactory

Provides reusable geometry construction helpers.

Examples:

- Boxes.
- Cylinders.
- Pipes.
- Rails.
- Platforms.
- Panels.
- Repeated structural elements.

Avoid duplicating low-level geometry creation code in every generator.

## 12.4 TextureGenerator

Produces procedural textures.

Potential texture types:

- Concrete.
- Painted concrete.
- Brushed metal.
- Dark steel.
- Asphalt.
- Rubber.
- Glass.

Texture generation must support reusable configurations and appropriate resolution.

Avoid generating high-resolution textures for objects that do not need them.

## 12.5 Generator output

A generated object should distinguish between:

1. Visual representation.
2. Physical representation.
3. Metadata.
4. Resource ownership.

Do not attach gameplay behavior to a geometry generator.

---

# 13. World and Level Architecture

## 13.1 World

`World` represents the currently loaded game environment.

Responsibilities:

- Holding the active level.
- Managing world-level environment systems.
- Coordinating level activation.
- Coordinating level cleanup.

## 13.2 Level interface

Levels should follow a common lifecycle contract.

Conceptual interface:

```ts
interface Level {
  readonly id: string;

  load(context: LevelContext): Promise<void>;
  activate(): void;
  deactivate(): void;
  update(deltaTime: number): void;
  dispose(): void;
}
```

An asynchronous load operation may be used for expensive procedural generation.

The actual implementation should avoid making every operation asynchronous without a reason.

## 13.3 LevelContext

`LevelContext` provides the dependencies required to construct a level.

It may expose:

- Rendering scene.
- Physics world interface.
- Event bus.
- Procedural generation services.
- Material provider.
- Level configuration.

Avoid giving every level unrestricted access to the entire application object.

## 13.4 LevelManager

`LevelManager` handles:

- Loading a level.
- Activating a level.
- Deactivating the current level.
- Unloading a level.
- Switching between Training and Prologue.

It must ensure that previous level resources are correctly released.

## 13.5 Training and Prologue

Training and Prologue are separate levels with different gameplay purposes.

Training:

- Exercises.
- Instructional triggers.
- Completion validation.
- Progression between lessons.

Prologue:

- Route definition.
- Checkpoints.
- Run timing.
- Run validation.
- Finish trigger.

Do not combine their progression logic into one large level class.

---

# 14. Gameplay Architecture

## 14.1 RunManager

`RunManager` coordinates a speedrun session.

Responsibilities:

- Starting a run.
- Pausing or invalidating a run.
- Completing a run.
- Managing run state.
- Collecting results.
- Communicating with checkpoint and statistics systems.

It does not render the HUD or write directly to IndexedDB.

## 14.2 RunTimer

Responsible for elapsed run time.

Use a monotonic time source.

Do not calculate run time from frame count.

The timer should support:

- Start.
- Pause.
- Resume.
- Stop.
- Reset.
- Elapsed time.

The timer must not be affected by rendering FPS.

## 14.3 CheckpointManager

Responsible for route progression.

It should:

- Track the current checkpoint.
- Validate checkpoint order.
- Reject invalid checkpoint sequences.
- Notify RunManager about progression.
- Expose split information.

## 14.4 RunValidation

Responsible for determining whether a completed run is valid.

Potential validation rules:

- All mandatory checkpoints were reached.
- Checkpoints were reached in the correct order.
- Finish trigger was reached.
- The run was not already invalidated.
- The player did not complete the run through an unsupported route.

Validation must be independent of HUD presentation.

## 14.5 RunStatistics

Collects:

- Total distance.
- Average speed.
- Maximum speed.
- Jump count.
- Wallrun count.
- Slide count.
- Vault count.
- Fall count.
- Checkpoint splits.

Statistics should be collected through gameplay events and reliable state information.

Do not derive all statistics from visual animations.

## 14.6 GhostRecorder

A minimal ghost recording system is optional future work.

Do not implement full replay serialization in the initial prototype.

If a basic recorder is introduced for experimentation, it must not delay core gameplay development.

---

# 15. Audio Architecture

## 15.1 AudioManager

Owns audio subsystem lifecycle.

Responsibilities:

- AudioContext initialization.
- Audio state.
- Volume settings.
- Sound generation coordination.
- Audio cleanup.

Audio must respect browser autoplay restrictions.

Initialize or resume the audio context after a valid user gesture.

## 15.2 ProceduralAudio

Provides reusable sound generation utilities.

Examples:

- Noise generation.
- Oscillator setup.
- Filtering.
- Envelopes.
- Spatialization where appropriate.

## 15.3 Gameplay-driven audio

Audio should react to gameplay information.

Examples:

| Event | Audio behavior |
|---|---|
| Footstep | Surface-dependent impact |
| Landing | Low-frequency impact |
| Sliding | Filtered friction noise |
| Wallrun | Movement-related surface sound |
| Zipline | Metallic resonance and friction |
| Sprint | Stronger movement ambience |
| UI interaction | Short synthesized signal |

Do not use downloaded sound files.

---

# 16. UI Architecture

## 16.1 UIManager

Coordinates application screens.

Responsibilities:

- Screen transitions.
- Screen lifecycle.
- HUD visibility.
- Modal presentation.
- UI cleanup.

UIManager should not implement gameplay mechanics.

## 16.2 UI rendering

Use HTML and CSS for the interface.

Use Three.js only for 3D game presentation.

Do not create complex menus using 3D geometry.

## 16.3 Screen separation

Keep separate screens for:

- Main Menu.
- Training.
- Results.
- Leaderboard.
- Settings.

HUD is a separate presentation layer that appears during gameplay.

## 16.4 Data flow

UI reads gameplay state through explicit interfaces or events.

UI actions invoke application or gameplay commands.

Avoid direct mutation of internal player or physics state.

---

# 17. Persistence Architecture

Use IndexedDB for persistent local data.

## 17.1 Database

`Database` owns database initialization and schema management.

Responsibilities:

- Opening the database.
- Creating object stores.
- Handling version upgrades.
- Providing transaction support.
- Closing connections.

## 17.2 RunRepository

Stores completed run results.

Example conceptual model:

```ts
interface RunRecord {
  id: string;
  levelId: string;
  timestamp: number;
  elapsedTimeMs: number;

  averageSpeed: number;
  maxSpeed: number;
  distance: number;

  jumps: number;
  wallruns: number;
  slides: number;
  falls: number;

  checkpointSplits: number[];
  valid: boolean;
}
```

Only valid Prologue runs should be included in the leaderboard.

Training results should not be included in the speedrun leaderboard.

## 17.3 SettingsRepository

Stores local settings.

Potential settings:

- Mouse sensitivity.
- Master volume.
- Music and ambience volume.
- Graphics quality.
- Camera effects.
- Control configuration.

## 17.4 Data safety

Handle:

- Database initialization failures.
- Transaction errors.
- Version upgrades.
- Missing records.
- Corrupted or incompatible data.

Do not silently discard stored results when a schema changes.

Use explicit migrations when necessary.

---

# 18. System Communication

Systems should communicate through a combination of direct interfaces and typed events.

Use direct calls for stable, explicit dependencies.

Use events for notifications that may have multiple independent consumers.

## 18.1 Example: Player landing

```text
RAPIER
  │
  ▼
PLAYER CONTROLLER
  │
  ▼
STATE MACHINE
  │
  ▼
LANDING EVENT
  │
  ├── AUDIO MANAGER
  ├── RUN STATISTICS
  ├── CAMERA CONTROLLER
  └── HUD
```

## 18.2 Example: Checkpoint reached

```text
LEVEL TRIGGER
  │
  ▼
CHECKPOINT MANAGER
  │
  ▼
CHECKPOINT VALIDATION
  │
  ├── RUN MANAGER
  ├── RUN TIMER / SPLITS
  ├── RUN STATISTICS
  └── HUD
```

## 18.3 Example: Run completed

```text
FINISH TRIGGER
  │
  ▼
RUN MANAGER
  │
  ▼
RUN VALIDATION
  │
  ├── INVALID RUN
  │
  └── VALID RUN
        │
        ▼
    BUILD RESULT
        │
        ▼
    RUN REPOSITORY
        │
        ▼
    RESULTS SCREEN
```

The exact data flow should remain explicit and testable.

---

# 19. Error Handling

The application must distinguish between recoverable and critical errors.

## 19.1 Recoverable errors

Examples:

- Audio initialization failure.
- Pointer lock unavailable.
- IndexedDB temporarily unavailable.
- Nonessential visual effect failure.
- Optional post-processing failure.

The application should continue operating where possible.

## 19.2 Critical errors

Examples:

- Renderer initialization failure.
- Physics initialization failure.
- Invalid core configuration.
- Failure to load a mandatory level.
- Unrecoverable application state.

Show a clear error state instead of leaving the application silently broken.

## 19.3 Error reporting

Use structured error reporting.

Include:

- System name.
- Operation.
- Error details.
- Whether recovery is possible.

Do not swallow exceptions without explanation.

Avoid excessive logging in production builds.

---

# 20. Performance Architecture

Initial performance targets:

- 60 FPS on a typical desktop system.
- Stable physics simulation.
- Reasonable memory consumption.
- Fast level restart.
- No progressive resource accumulation.

## 20.1 Rendering

Priorities:

- Reuse geometry.
- Reuse materials.
- Use instancing for repeated objects.
- Keep shadow maps controlled.
- Avoid excessive draw calls.
- Limit unnecessary post-processing.
- Use appropriate pixel ratio.

## 20.2 Physics

Priorities:

- Simple colliders.
- Efficient collision filtering.
- Avoid unnecessary raycasts.
- Avoid excessive dynamic bodies.
- Keep decorative geometry out of physics.

## 20.3 Procedural generation

Priorities:

- Generate only required geometry.
- Reuse repeated structures.
- Avoid unnecessary texture duplication.
- Release temporary generation resources.
- Separate generation from per-frame updates.

## 20.4 Profiling

Do not optimize based only on intuition.

When performance problems appear, inspect:

- Frame time.
- Physics step duration.
- Draw calls.
- Triangle count.
- GPU memory.
- JavaScript allocation.
- Level loading time.

---

# 21. Testing Architecture

Testing should be organized into three levels.

## 21.1 Unit tests

Test isolated deterministic logic.

Examples:

- Movement calculations.
- State transitions.
- Checkpoint ordering.
- Run validation.
- Timer calculations.
- Seed generation.
- Statistics aggregation.

## 21.2 Integration tests

Test system interactions.

Examples:

- Player controller and physics.
- Parkour mechanics and state machine.
- Level triggers and checkpoint manager.
- Run manager and persistence.
- Application startup and shutdown.

## 21.3 Runtime tests

Test actual behavior in the browser.

Examples:

- Player can complete movement exercises.
- Physics collisions behave correctly.
- Level restart works.
- HUD reflects actual gameplay state.
- Results survive page reload.
- Audio responds to player movement.

Do not treat a successful production build as proof that the game is functional.

---

# 22. Implementation Order

The architecture should be implemented incrementally.

Recommended order:

1. Project foundation and application lifecycle.
2. Rendering initialization.
3. Physics initialization.
4. Game loop and input.
5. Basic player controller.
6. Player state machine.
7. Jumping and landing.
8. Sliding and vaulting.
9. Wallrun and walljump.
10. Ledge grab and climbing.
11. Camera and hand animation.
12. Procedural geometry foundation.
13. Training level.
14. Prologue level.
15. Lighting and visual effects.
16. Procedural audio.
17. Speedrun systems.
18. UI and persistence.
19. Optimization and polish.

The detailed task sequence is defined in `10_IMPLEMENTATION_ROADMAP.md`.

Do not implement all systems simultaneously.

---

# 23. Architecture Acceptance Criteria

The architecture is considered correctly implemented when:

- Application startup and shutdown are explicit.
- Rendering and physics have separate ownership.
- Physics uses a fixed timestep.
- Player movement is controlled by a modular controller.
- Player states have explicit transitions.
- Parkour mechanics are independent modules.
- Input is separated from gameplay behavior.
- Levels follow a common lifecycle.
- Procedural generation supports deterministic seeds.
- Gameplay events are typed.
- Run validation is independent of UI.
- Persistence is isolated behind repositories.
- Resource cleanup is explicit.
- Level restart does not accumulate resources.
- The application can be built and executed reliably.

---

# 24. Architectural Constraints

The following rules are mandatory:

1. Three.js owns visual representation.
2. Rapier owns physical simulation.
3. The player controller coordinates movement.
4. Parkour mechanics do not duplicate common locomotion logic.
5. The game loop owns simulation timing.
6. The run timer does not depend on FPS.
7. Levels own their environment content and lifecycle.
8. Procedural generators do not own gameplay progression.
9. UI does not directly modify physics state.
10. Audio reacts to gameplay state and events.
11. Persistence is accessed through repositories.
12. All allocated resources have an explicit lifecycle.
13. All procedural generation uses explicit seeds.
14. Systems communicate through defined interfaces.
15. Future functionality must not be implemented ahead of the roadmap without authorization.

---

# 25. Final Architecture Principle

MIRROR'S EDGE — RUNNER PROTOCOL is a small, focused game prototype.

Its architecture should provide enough structure to support:

- First-person movement.
- Parkour mechanics.
- Procedural environments.
- Two playable levels.
- Speedrun gameplay.
- Procedural audio.
- Local persistence.
- A complete user interface.

It should not become a general-purpose game engine.

**Build only the systems the game needs, but build them with clear responsibilities, predictable behavior, and a reliable lifecycle.**