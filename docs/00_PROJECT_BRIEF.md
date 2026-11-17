# Glassline — Project Brief

**Document:** `00_PROJECT_BRIEF.md`  
**Project:** Glassline  
**Version:** 2.0  
**Project Type:** Experimental 3D First-Person Parkour Game  
**Rendering Engine:** Three.js  
**Language:** TypeScript  
**Target Platform:** Desktop Browsers  
**Project Stage:** Pre-Implementation

---

## 1. Project Overview

### 1.1. Concept

Glassline is an experimental first-person parkour game inspired by the original *Mirror's Edge* (2008).

The project explores the technical and creative possibilities of building a browser-based 3D game with responsive first-person movement, procedural environments, architectural traversal, and speedrun-oriented gameplay.

Glassline is an independent project. It is not a remake of Mirror's Edge and must not use proprietary game assets.

The project focuses on:

- A first-person parkour movement system.
- A structured Training mode.
- A repeatable Prologue level.
- Procedurally generated environments and game-specific assets.
- Procedurally generated gameplay and environmental audio.
- A speedrun system with checkpoint splits.
- Local records and personal best tracking.
- A modular gameplay architecture.
- A minimalist visual identity.

The quality of movement and overall gameplay feel are more important than the quantity of content.

### 1.2. Main Objective

The primary objective is to create a technically and visually convincing first-person parkour experience.

The project must demonstrate:

1. Three-dimensional scene rendering and environment construction.
2. Procedural geometry and asset generation.
3. Procedural materials, textures, and shaders.
4. Physics-based first-person movement.
5. Parkour mechanics and movement combinations.
6. Dynamic first-person camera behavior.
7. Procedural audio generation.
8. HTML and CSS-based game interface.
9. Local statistics and persistent records.
10. Performance optimization of a moderately complex 3D environment.

The initial release should be compact but complete enough to demonstrate the intended gameplay loop.

---

## 2. Design Principles

### 2.1. Movement First

Movement is the most important gameplay subsystem.

The player must feel:

- Acceleration.
- Momentum.
- Weight.
- Speed.
- Inertia.
- Contact with the environment.
- Consistent transitions between traversal actions.

Movement must not feel like ordinary FPS character movement.

The player should be able to combine parkour actions into continuous movement sequences.

### 2.2. Minimalist Visual Style

The visual direction is inspired by the architectural presentation of the original Mirror's Edge.

Main characteristics:

- Predominantly white architecture.
- Light-grey concrete.
- Dark-grey industrial structures.
- Red navigation accents.
- Large architectural forms.
- Clean geometric surfaces.
- Strong silhouettes.
- High contrast between important surfaces.
- Bright outdoor environments.
- Minimal visual clutter.

The environment should communicate navigation through architecture and level composition rather than excessive UI elements.

### 2.3. Procedural Content

Game-specific assets should be generated procedurally.

This includes:

- Buildings and architectural structures.
- Rooftops and platforms.
- Industrial structures.
- Ventilation systems.
- Pipes and railings.
- Scaffolding.
- Decorative architectural elements.
- Materials and textures.
- Navigation markings.
- Environmental and movement audio.

Use Three.js primitives, generated `BufferGeometry`, `CanvasTexture`, `DataTexture`, and procedural shaders where appropriate.

Do not introduce external 3D models, texture packs, or audio files as game assets.

Fonts and development dependencies are not considered game assets.

Procedural generation must support reproducible results through explicit seeds.

### 2.4. Modular Architecture

Gameplay systems must be independent and reusable.

- Level-specific logic must not be embedded inside the player controller.
- Procedural asset generators must be reusable across levels.
- UI must be separated from the Three.js rendering layer.
- Game statistics must be independent of gameplay presentation.
- Persistence must be accessed through the Save System.
- Systems must communicate through defined interfaces and events.

### 2.5. Deterministic Gameplay

Gameplay behavior must be consistent within defined simulation tolerances.

- Physics uses a fixed timestep.
- Rendering and simulation are independent.
- Speedrun timing uses a monotonic clock.
- Procedural generation uses explicit seeds.
- Session-scoped and attempt-scoped events must reject stale data.

---

## 3. Technical Foundation

### 3.1. Technology Stack

| Technology | Responsibility |
|---|---|
| TypeScript | Application and gameplay logic |
| Three.js | 3D rendering |
| WebGLRenderer | Initial rendering backend |
| Vite | Development server and build |
| Rapier Physics | Physics and collision detection |
| Web Audio API | Procedural audio |
| IndexedDB | Persistent local data |
| HTML / CSS | Application interface |
| GLSL | Custom shaders where required |

Physics integration uses:

`@dimforge/rapier3d-compat`

Three.js owns visual representation.

Rapier owns physical simulation and collision detection.

WebGPU may be explored as a future extension. It is not part of the initial implementation.

The detailed architecture, update loop, module boundaries, and runtime contracts are defined in `02_TECHNICAL_ARCHITECTURE.md`.

### 3.2. Target Platform

The initial target is desktop browsers.

The application should support:

- Keyboard and mouse.
- Browser pointer lock for first-person camera control.
- Gamepad support through the Input System.
- Local persistence through IndexedDB.
- Browser-based application startup and production build.

Mobile-specific gameplay optimization is not an initial release requirement.

### 3.3. Rendering

Use Three.js `WebGLRenderer` as the initial rendering backend.

Requirements include:

- Physically based materials.
- Directional and ambient lighting.
- Shadows.
- Fog where appropriate.
- Tone mapping.
- Correct color management.
- Post-processing only where justified.

Visual quality must not compromise movement readability or stable performance.

### 3.4. Physics

Use Rapier for gameplay physics and collision handling.

Requirements include:

- Fixed physics timestep.
- Capsule-based player collision.
- Collision layers.
- Surface classification.
- Ground detection.
- Wall detection.
- Stable landing behavior.
- Separation of visual meshes and physical colliders.

Decorative objects must not automatically generate physical colliders.

### 3.5. Audio

Use Web Audio API for procedural gameplay and environmental audio.

The initial audio system should support:

- Footsteps.
- Jumping.
- Landing.
- Sliding.
- Wall contact.
- Metal impacts.
- Wind.
- Urban ambience.
- UI feedback.

Audio must respond to player movement and relevant environment state.

---

## 4. Gameplay Scope

### 4.1. Core Movement

The initial movement feature set includes:

- Walking.
- Running.
- Sprinting.
- Acceleration and deceleration.
- Jumping.
- Landing.
- Crouching.
- Sliding.
- Vaulting.
- Wall running.
- Wall jumping.
- Momentum management.

Movement must support continuous traversal and combinations of mechanics.

Advanced traversal features are not mandatory for the initial release unless explicitly included in the relevant system specification's initial scope.

### 4.2. Training Mode

Training is an interactive environment designed to teach the player the core movement mechanics and interactions.

Training is divided into ten exercises:

1. Movement Basics.
2. Running and Sprinting.
3. Jumping.
4. Crouching and Sliding.
5. Vaulting.
6. Wall Running.
7. Wall Jumping.
8. Landing and Momentum.
9. Interaction.
10. Combined Traversal.

Each exercise should:

- Introduce a defined mechanic or combination.
- Provide contextual instructions.
- Define measurable objectives.
- Detect successful execution through authoritative gameplay events.
- Provide visual or audio feedback.
- Support replay and practice.
- Track completion and mastery separately.

Training is not part of the Prologue speedrun leaderboard.

Exercise behavior, scoring, objectives, and progression are defined in `21_TRAINING_SYSTEM_SPEC.md`.

### 4.3. Prologue Mode

Prologue is the primary repeatable gameplay experience.

The level is divided into five sections:

1. Rooftop.
2. Industrial.
3. Construction.
4. Skybridge.
5. Finish.

The route must combine the movement mechanics introduced in Training.

It must contain five required checkpoints:

- `prologue_rooftop`
- `prologue_industrial`
- `prologue_construction`
- `prologue_skybridge`
- `prologue_finish`

The route must support:

- Repeated attempts.
- Ordered checkpoint validation.
- Checkpoint split timing.
- Personal best tracking.
- Completion results.
- Local leaderboard records.

Initial completion-time targets:

- Normal completion: approximately 2–3 minutes.
- Experienced completion: approximately 1–2 minutes.

These are design targets, not hard restrictions. The final route must be validated through actual playtesting.

### 4.4. Results

The Prologue results presentation should display relevant authoritative data:

- Completion time.
- Personal best status.
- Average speed.
- Maximum speed.
- Total distance.
- Movement action counts.
- Fall count where applicable.
- Checkpoint split times.
- Medal result where applicable.

Available actions include:

- Retry.
- Return to Main Menu.

The Results UI displays data from the owning gameplay systems. It must not independently calculate authoritative run results.

### 4.5. Local Leaderboard

Completed Prologue attempts are stored locally.

Leaderboard ordering:

1. Lowest valid completion time.
2. Earlier record timestamp as a deterministic tie-breaker.

Records should include:

- Rank.
- Player identifier where supported.
- Completion time.
- Record timestamp.
- Relevant route/version metadata.

The leaderboard must survive page reloads.

No network connection is required.

The Speedrun System owns run validity and record semantics. The Save System owns persistence infrastructure.

---

## 5. Supporting Game Systems

The project includes the following supporting systems.

### Player and Runtime

- Input.
- Movement.
- Camera.
- Interaction.
- Player State.
- Checkpoint.
- Respawn.
- Level Runtime.
- Gameplay Session.
- Gameplay Flow.

### Game Modes and Progress

- Training.
- Speedrun.
- Progression.
- Tutorial.
- Achievement.
- Statistics.

### Infrastructure and Presentation

- Save.
- Settings.
- Localization.
- Accessibility.
- Menu.
- HUD.
- Audio.
- Procedural Generation.
- Level Design.

Each system has a separate specification and an explicit ownership boundary.

---

## 6. Initial Release Scope

The initial release must deliver a complete playable experience.

### Required

- First-person movement.
- Mouse and keyboard input.
- Initial gamepad support through the Input abstraction.
- Walking, running, sprinting, jumping, crouching, sliding, vaulting, wall running, and wall jumping.
- Basic player collision.
- Landing behavior.
- Player recovery and checkpoint respawn.
- Training mode with ten defined exercises.
- Prologue with five sections.
- Five required Prologue checkpoints.
- Speedrun timer and checkpoint splits.
- Route validation.
- Bronze, Silver, and Gold performance evaluation as defined by Speedrun.
- Personal best records.
- Local leaderboard.
- IndexedDB persistence.
- Main Menu.
- Pause Menu.
- Settings.
- Results.
- Gameplay HUD.
- Basic procedural audio feedback.
- Initial accessibility support.
- English localization.
- Core tutorial guidance.
- Persistent training and progression data where required by the relevant specifications.

### Deferred

The following features are outside the initial release scope:

- Ghost Replay recording and playback.
- Online leaderboards.
- Cloud saves.
- Multiplayer.
- Network synchronization.
- Online accounts.
- Combat and firearms.
- Enemies and AI opponents.
- Story campaigns and dialogue systems.
- Destructible environments.
- Open-world exploration.
- User-generated levels.
- Advanced procedural campaigns.
- Ledge grabbing.
- Ledge climbing and hanging.
- Dedicated balance traversal.
- Swinging and ziplines.
- Advanced traversal variants beyond the initial movement scope.
- Remote analytics.
- Full RTL layout.

Deferred features must not block initial release implementation.

Architecture may provide extension points where required, but must not introduce unnecessary complexity for unimplemented features.

---

## 7. Performance Requirements

The initial target is desktop browsers.

Initial performance targets:

- Target 60 FPS on a reasonable modern desktop configuration.
- Stable physics simulation at 60 Hz, with architecture allowing other configured fixed rates where required.
- No continuous memory growth during repeated level restarts.
- No unnecessary recreation of static geometry.
- Efficient rendering of repeated assets.

Potential techniques include:

- `InstancedMesh`.
- `BufferGeometry` reuse.
- Material reuse.
- LOD where appropriate.
- Frustum culling.
- Shared procedural resources.

Performance must be measured rather than assumed.

Detailed performance and validation requirements are defined in the Technical Architecture and relevant system specifications.

---

## 8. Development Priorities

Implementation should follow the dependency-aware sequence in `IMPLEMENTATION_STATUS.md`.

High-level priorities:

1. Validate architecture and repository foundation.
2. Establish runtime, input, and persistence.
3. Implement first-person player movement and camera.
4. Implement traversal mechanics and recovery.
5. Establish level runtime and checkpoints.
6. Implement Training and Prologue sessions.
7. Implement Speedrun timing and records.
8. Integrate UI, HUD, menus, and audio.
9. Implement progression, tutorial, achievements, and statistics.
10. Stabilize and verify the initial release.

Do not prioritize visual details before movement and collision behavior are reliable.

Do not build complete levels before the required movement mechanics are functional.

---

## 9. Definition of Done

The initial release is complete when all required initial-release features are implemented, integrated, and verified.

### Gameplay

- Player can move, run, sprint, jump, crouch, slide, vault, wall run, and wall jump.
- Movement mechanics work in combination.
- Movement is independent of rendering FPS.
- Player collision is stable.
- Camera behavior responds correctly to movement.
- Recovery restores a valid player state.

### Training

- All ten defined exercises are available according to progression rules.
- Exercise objectives are evaluated from authoritative events.
- Completion and mastery are tracked correctly.
- Exercises can be replayed.

### Prologue

- All five sections are present.
- The route is finishable.
- Five required checkpoints work in the intended order.
- Checkpoint progress and recovery behavior are correct.
- Route completion is validated.

### Speedrun

- Timer starts and stops correctly.
- Timing uses a monotonic clock.
- Results are independent of FPS.
- Checkpoint splits are recorded correctly.
- Invalid route completion is rejected or handled according to policy.
- Personal best and local leaderboard records persist.
- Results are generated from authoritative run data.

### Procedural Content

- Required environment assets are generated according to the Asset Bible and Procedural Generation specifications.
- Procedural assets are reusable.
- Materials and textures are generated programmatically.
- Generation supports deterministic seeds.
- Generated geometry has appropriate collision and surface metadata.

### Audio

- Core movement actions produce appropriate audio feedback.
- Footsteps can respond to surface type.
- Environmental ambience is present.
- Audio settings are applied correctly.

### UI and Persistence

- Main Menu works.
- Training and Prologue can be launched.
- Pause and Results screens work.
- Local leaderboard works.
- Settings persist.
- Required progress survives browser reloads.

### Technical Quality

- No unresolved critical runtime errors.
- No persistent memory leaks during repeated runs.
- Physics remains valid after session restart and respawn.
- Application works after browser reload.
- Production build succeeds.
- Required acceptance tests pass.

---

## 10. Rules for Implementation Agents

1. Read `AGENT.md` and the mandatory project documentation before implementation.
2. Follow the established technical architecture.
3. Do not implement features outside the documented scope without authorization.
4. Do not replace specified technologies without justification.
5. Do not introduce external game assets.
6. Do not create large monolithic classes.
7. Do not duplicate existing functionality or ownership.
8. Do not silently change gameplay parameters.
9. Do not consider a feature complete merely because it compiles.
10. Verify implementation through execution and testing.
11. Update `IMPLEMENTATION_STATUS.md` after meaningful progress.
12. Document unresolved issues and technical limitations.
13. Preserve working functionality when modifying existing systems.
14. Resolve conflicting requirements before making incompatible architectural decisions.

When a requirement is insufficiently detailed, check related specifications first. Do not invent complex behavior.

---

## 11. Project Philosophy

Glassline is an exploration of Three.js as a platform for creating a complete interactive 3D game.

The objective is not to produce the largest possible amount of content.

The objective is to create a compact, polished, technically coherent game in which:

- Movement feels good.
- The environment looks convincing.
- Procedural generation is meaningful.
- Game systems are modular.
- Performance is predictable.
- The player has a reason to replay the route.

**Quality of implementation is more important than quantity of features.**