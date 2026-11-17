# Glassline — Implementation Status

**Document:** `IMPLEMENTATION_STATUS.md`  
**Project:** Glassline  
**Last Updated:** 2026-11-17  
**Project Stage:** Core Parkour Complete  
**Status:** Phases 0–3 Complete; Phase 4 Next

---

## 1. Purpose

This document is the central implementation tracking reference for Glassline.

It tracks:

- Specification readiness.
- Implementation progress.
- System integration.
- Testing and verification.
- Known architectural issues.
- Deferred features.
- Remaining implementation work.

This document must represent the actual state of the repository.

The existence of a specification does not mean that its system has been implemented.

The existence of source files does not prove that a system is complete.

---

## 2. Status Definitions

### 2.1. Specification Status

| Status | Meaning |
|---|---|
| Not Started | No specification exists. |
| Draft | Specification exists but is incomplete. |
| Defined | Specification is sufficiently complete for implementation. |
| Needs Revision | Specification requires clarification or architectural correction. |

### 2.2. Implementation Status

| Status | Meaning |
|---|---|
| Not Started | No implementation exists. |
| In Progress | Implementation has started but is incomplete. |
| Implemented | Initial implementation is present in the codebase. |
| Integrated | System is connected to its required dependencies. |
| Verified | Implementation passes its required acceptance criteria and tests. |
| Blocked | Implementation cannot proceed because of an unresolved dependency or decision. |
| Deferred | Intentionally postponed to a later development phase. |

### 2.3. Integration Status

| Status | Meaning |
|---|---|
| Not Started | Integration has not started. |
| In Progress | Integration work is underway. |
| Integrated | Required interfaces are connected. |
| Verified | Integration behavior has been tested. |
| Blocked | Integration is waiting for a dependency or decision. |
| Deferred | Integration is intentionally postponed. |

### 2.4. Important Distinction

`Implemented` does not mean `Integrated`.

`Integrated` does not mean `Verified`.

A system may contain working code while still having:

- Missing edge-case handling.
- Incomplete integrations.
- Temporary placeholders.
- Unverified browser behavior.
- Missing automated tests.
- Known specification deviations.

Only `Verified` means that the applicable acceptance criteria have been checked successfully.

---

## 3. Overall Project Status

| Area | Specification | Implementation | Integration | Verification |
|---|---|---|---|---|
| Project Foundation | Defined | Implemented | Integrated | Verified |
| Technical Architecture | Defined | In Progress | In Progress | Partially Verified |
| Core Gameplay | Defined | In Progress | In Progress | Partially Verified |
| Player Systems | Defined | In Progress | In Progress | Partially Verified |
| Level Systems | Defined | Not Started | Not Started | Not Verified |
| Gameplay Modes | Defined | Not Started | Not Started | Not Verified |
| UI / UX | Defined | Not Started | Not Started | Not Verified |
| Audio | Defined | In Progress | In Progress | Partially Verified |
| Persistence | Defined | In Progress | In Progress | Partially Verified |
| Progression | Defined | Not Started | Not Started | Not Verified |
| Accessibility | Defined | Not Started | Not Started | Not Verified |
| Localization | Defined | In Progress | In Progress | Partially Verified |
| Statistics | Defined | Not Started | Not Started | Not Verified |

**Current phase:** Phases 0 (repository foundation), 1 (application runtime), 2 (first-person player), and 3 (traversal and recovery) are complete. Phase 4 (level runtime) is the next active workstream.

**Implementation readiness:** The core parkour loop is playable in a test environment: first-person movement, jump, crouch/slide, vault, wall running/jumping, checkpoints, contextual interaction, and checkpoint-based respawn. Level runtime, structured gameplay sessions, and presentation systems are the next implementation areas.

### 3.1. Documentation Reconciliation (2026-11-17)

The specification set was reviewed and reconciled. The following ownership conflicts were resolved and must be observed during implementation:

- **Respawn ownership:** `RespawnManager` is the sole recovery orchestrator. The Checkpoint System is a destination provider only; no `RespawnCoordinator` exists or may be introduced.
- **Progression and achievements:** Achievement owns achievement definitions, evaluation, progress, unlock state, and achievement persistence. Progression owns content unlocks and milestones and may consume achievement events only.
- **Settings and language:** The selected language is the Settings-owned preference `general.language`. Localization owns resources, resolution, formatting, and runtime language application.
- **Statistics and Speedrun:** Statistics owns event-driven aggregation. Speedrun owns timing, validation, splits, results, and the record contract, and consumes the Statistics summary.
- **Persistence:** Save owns the database (`GlasslineSaveData`), schema, migrations, and repositories. Other systems must not define competing storage, and the old `MirrorEdge*` database names are obsolete.
- **Level design and gameplay ownership:** Level content authors triggers, spawn points, and metadata. Checkpoint activation, route validation, run timing, recovery, and progression remain with their owning systems.
- **Training scope:** Ten canonical exercises are defined in `21_TRAINING_SYSTEM_SPEC.md`; `06_LEVEL_DESIGN_SPEC.md` provides their environments. Ledge grabbing, climbing, balancing, and ziplines remain deferred.
- **Consistency cleanup:** Terminal section numbering in `03_GAMEPLAY_SPEC.md`, duplicated movement tuning values, duplicated Runner Vision rules, duplicated reduced-motion settings, and the stale legacy project name were removed. The project name is written **Glassline** everywhere.

---

## 4. Specification Registry

The following documents form the current specification baseline.

`Defined` indicates that a specification exists. It does not imply that every implementation detail has already been verified against the codebase.

| # | Document | Specification Status | Implementation Status |
|---:|---|---|---|
| 00 | `00_PROJECT_BRIEF.md` | Defined | Not Started |
| 01 | `01_AGENT_RULES.md` | Defined | Not Started |
| 02 | `02_TECHNICAL_ARCHITECTURE.md` | Defined | In Progress |
| 03 | `03_GAMEPLAY_SPEC.md` | Defined | Not Started |
| 04 | `04_ASSET_BIBLE.md` | Defined | Not Started |
| 05 | `05_PROCEDURAL_GENERATION_SPEC.md` | Defined | Not Started |
| 06 | `06_LEVEL_DESIGN_SPEC.md` | Defined | Not Started |
| 07 | `07_UI_UX_SPEC.md` | Defined | Not Started |
| 08 | `08_AUDIO_DESIGN_SPEC.md` | Defined | In Progress |
| 09 | `09_SPEEDRUN_SYSTEM_SPEC.md` | Defined | Not Started |
| 10 | `10_SAVE_SYSTEM_SPEC.md` | Defined | In Progress |
| 11 | `11_INPUT_SYSTEM_SPEC.md` | Defined | In Progress |
| 12 | `12_MOVEMENT_SYSTEM_SPEC.md` | Defined | In Progress |
| 13 | `13_CAMERA_SYSTEM_SPEC.md` | Defined | In Progress |
| 14 | `14_INTERACTION_SYSTEM_SPEC.md` | Defined | In Progress |
| 15 | `15_LEVEL_RUNTIME_SYSTEM_SPEC.md` | Defined | Not Started |
| 16 | `16_CHECKPOINT_SYSTEM_SPEC.md` | Defined | In Progress |
| 17 | `17_RESPAWN_SYSTEM_SPEC.md` | Defined | In Progress |
| 18 | `18_PLAYER_STATE_SYSTEM_SPEC.md` | Defined | In Progress |
| 19 | `19_GAMEPLAY_SESSION_SYSTEM_SPEC.md` | Defined | Not Started |
| 20 | `20_GAMEPLAY_FLOW_SYSTEM_SPEC.md` | Defined | Not Started |
| 21 | `21_TRAINING_SYSTEM_SPEC.md` | Defined | Not Started |
| 22 | `22_PROGRESSION_SYSTEM_SPEC.md` | Defined | Not Started |
| 23 | `23_HUD_SYSTEM_SPEC.md` | Defined | Not Started |
| 24 | `24_MENU_SYSTEM_SPEC.md` | Defined | Not Started |
| 25 | `25_SETTINGS_SYSTEM_SPEC.md` | Defined | In Progress |
| 26 | `26_ACCESSIBILITY_SYSTEM_SPEC.md` | Defined | Not Started |
| 27 | `27_LOCALIZATION_SYSTEM_SPEC.md` | Defined | In Progress |
| 28 | `28_TUTORIAL_SYSTEM_SPEC.md` | Defined | Not Started |
| 29 | `29_ACHIEVEMENT_SYSTEM_SPEC.md` | Defined | Not Started |
| 30 | `30_STATISTICS_SYSTEM_SPEC.md` | Defined | Not Started |

---

## 5. Implementation Workstreams

Implementation should be organized into coherent workstreams.

Systems are not completely independent. Integration should happen continuously as their contracts become available.

### 5.1. Project Foundation

| System | Specification | Initial Goal | Status |
|---|---|---|---|
| Technical Architecture | 02 | Establish runtime, modules, and application foundation | In Progress |
| Asset Bible | 04 | Establish asset and resource conventions | Not Started |
| Procedural Generation | 05 | Establish reusable procedural generation foundations | Not Started |
| Input | 11 | Provide abstract input actions and device handling | In Progress |
| Save | 10 | Establish IndexedDB persistence infrastructure | In Progress |
| Settings | 25 | Establish configuration registry and runtime application | In Progress |
| Localization | 27 | Establish translation resources and resolution | In Progress |

### 5.2. Core Player

| System | Specification | Initial Goal | Status |
|---|---|---|---|
| Player State | 18 | Establish authoritative player lifecycle state | In Progress |
| Movement | 12 | Implement first-person locomotion and traversal physics | In Progress |
| Camera | 13 | Implement first-person camera and movement feedback | In Progress |
| Interaction | 14 | Implement interaction detection and execution | In Progress |
| Respawn | 17 | Implement player recovery lifecycle | In Progress |

### 5.3. Level Infrastructure

| System | Specification | Initial Goal | Status |
|---|---|---|---|
| Level Design | 06 | Establish level definitions and route structure | Not Started |
| Level Runtime | 15 | Load and manage runtime level sessions | Not Started |
| Checkpoint | 16 | Register and activate checkpoints | In Progress |
| Procedural Generation | 05 | Generate validated environment geometry and assets | Not Started |

### 5.4. Gameplay Orchestration

| System | Specification | Initial Goal | Status |
|---|---|---|---|
| Gameplay Session | 19 | Manage Training and Prologue lifecycle | Not Started |
| Gameplay Flow | 20 | Coordinate application navigation and transitions | Not Started |
| Training | 21 | Implement exercises and objective evaluation | Not Started |
| Speedrun | 09 | Implement timing, splits, validation, and records | Not Started |
| Progression | 22 | Implement content unlocks and milestones | Not Started |
| Tutorial | 28 | Implement contextual guidance and learning progression | Not Started |
| Achievement | 29 | Implement achievement definitions and unlocking | Not Started |
| Statistics | 30 | Aggregate authoritative gameplay statistics | Not Started |

### 5.5. Presentation

| System | Specification | Initial Goal | Status |
|---|---|---|---|
| UI / UX | 07 | Establish visual and interaction conventions | Not Started |
| Menu | 24 | Implement application screens and menu interactions | Not Started |
| HUD | 23 | Implement gameplay HUD and feedback widgets | Not Started |
| Audio | 08 | Implement gameplay audio and feedback | In Progress |
| Accessibility | 26 | Implement accessibility preferences and adaptations | Not Started |

---

## 6. Recommended Implementation Phases

### Phase 0 — Repository and Architecture Validation

**Goal:** Ensure that the specifications form a consistent implementation contract and that the repository can support the initial application.

**Status:** Complete (2026-11-17).

Tasks:

- Normalize documentation filenames and links.
- Review specifications for conflicting ownership.
- Validate public interfaces and event contracts.
- Identify duplicated responsibilities.
- Confirm the actual repository structure.
- Validate package configuration and dependency versions.
- Confirm TypeScript and Vite configuration.
- Confirm Three.js and Rapier integration strategy.
- Define coding conventions and validation commands.
- Establish the initial build and test pipeline.

Implemented:

- `package.json` — npm scripts (`dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `check`, `test`, `test:watch`, `validate`) and dependency set: `three`, `@dimforge/rapier3d-compat`, `vite`, `typescript`, `vitest`, `@biomejs/biome`, `fake-indexeddb` for IndexedDB tests.
- `tsconfig.json` — strict TypeScript (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess, noUnusedLocals/Parameters, verbatimModuleSyntax, isolatedModules).
- `biome.json` — Biome 2 lint + formatter + import organization, using the repository git ignore rules; Markdown documentation is intentionally excluded.
- `.github/workflows/validate.yml` — CI pipeline (Node 22, `npm ci`, `npm run validate`) on pushes to `main` and pull requests.
- `vite.config.ts` — Vite 8 build and Vitest 5 configuration (Node test environment, `tests/**/*.test.ts`).
- `index.html` — application shell with the game canvas.
- `src/` — application structure per `02_TECHNICAL_ARCHITECTURE.md` (`app/`, `core/`, `rendering/`, `physics/`, `input/`, `storage/`, `diagnostics/`, `debug/`, `shared/`).
- `tests/` — unit tests for the game loop, input resolution, IndexedDB/schema, Rapier integration, and the event bus.
- `.gitignore` — dependencies, build output, local caches.

Validation commands (also documented in `README.md`):

```bash
npm run typecheck   # strict TypeScript
npm run check       # Biome: lint, formatting, import order
npm test            # unit tests
npm run build       # typecheck + production build
npm run validate    # typecheck + Biome check + tests + production build
```

CI (`.github/workflows/validate.yml`) runs the same validation pipeline on pushes to `main` and on pull requests.

Exit criteria:

- [x] No unresolved architectural conflicts affecting the first playable build.
- [x] Repository configuration is valid.
- [x] Core module boundaries are clear.
- [x] The application can be built and tested.
- [x] Implementation agents have clear ownership boundaries.

### Phase 1 — Runtime Foundation

**Goal:** Establish a working application runtime.

**Status:** Complete (2026-11-17).

Systems:

- Technical Architecture.
- Input.
- Save.
- Settings.
- Localization.
- Asset loading foundations.

Initial features:

- Application startup.
- Three.js renderer initialization.
- Rapier initialization.
- Main update loop.
- Input abstraction.
- IndexedDB access layer.
- Settings loading and saving.
- Resource loading and error reporting.

Implemented and smoke-verified:

- `Application` composition root: documented startup order (storage → settings → localization → renderer → physics → input → audio → settings application), recoverable storage/settings/localization failures, fatal-error overlay, idempotent shutdown, resize and visibility handling.
- `GameLoop`: fixed 60 Hz simulation step, frame-delta clamping, catch-up protection, interpolation alpha, render/fixed callbacks. Unit-tested (60 steps per simulated second, dropped-time accounting, restart, stop).
- `Renderer` + `RenderScene`: WebGL2 renderer, sRGB/tone mapping, shadows, camera, lighting, placeholder architecture scene.
- `PhysicsWorld`: Rapier init, fixed timestep matching the game loop, world stepping, deterministic disposal. Unit-tested with a falling rigid body.
- `InputManager` + `InputActionResolver`: action registry, configurable keyboard/gamepad bindings, gameplay/menu contexts, pointer lock, mouse deltas, dead zones, pressed/held/released edges. Unit-tested without a DOM.
- Settings System foundation: canonical definitions registry (`audio.*`, `controls.*`, `camera.*`, `display.*`, `hud.*`, `accessibility.*`, `gameplay.*`, `general.language`), validation, defaults, atomic updates, revisioned immutable snapshots, persistence through `SettingsRepository`, runtime application pipeline with domain adapters. Unit-tested.
- Localization foundation: language registry (English), bundled resource loading through the shared `ResourceLoader`, translation resolution with fallback, interpolation, pluralization via `Intl.PluralRules`, runtime language switching wired to `general.language`. Unit-tested.
- Resource loading: `ResourceLoader` with in-flight deduplication, cancellation, timeouts, and structured `ResourceLoadError` values. Unit-tested.
- Audio foundation: `AudioManager` with lazy `AudioContext` creation after a genuine user gesture, resume, master gain, Settings-owned volume/mute application, and deterministic disposal. Unit-tested with a fake context.
- `Database` + `SaveSchema` + `SettingsRepository`: IndexedDB `GlasslineSaveData`, schema migrations, versioned stores, transactions, typed errors, malformed-payload rejection. Tested with fake-indexeddb.
- `EventBus`, `Time`, `Disposable`/`disposeAll`, `StatusOverlay` diagnostics.

Verification performed:

- `npm run typecheck` — passes.
- `npm run check` — Biome lint, formatting, and import order pass.
- `npm test` — 72 unit tests pass across 9 files (game loop, input, database, physics, event bus, settings, localization, resource loading, audio).
- `npm run build` — production build succeeds.
- Headless browser smoke check (Microsoft Edge, WebGL2/SwiftShader): application reaches `phase running`; renderer reports WebGL2 + Three.js r187; Rapier initializes; storage reports `ready (version 1)`; settings report `rev 0 (ready)`; localization reports `ready (en)`; audio reports `idle` until a user gesture; the placeholder scene and falling physics cube render correctly.

Exit criteria:

- [x] Application starts successfully.
- [x] Renderer and physics initialize correctly.
- [x] Input actions can be read through the abstraction layer.
- [x] Settings can be loaded and saved (SettingsManager + SettingsRepository, tested).
- [x] IndexedDB persistence works at the storage layer.
- [x] Resource loading reports failures safely (`ResourceLoader` structured errors; localization fallback path).

Remaining Phase 1 work: none.

Deferred beyond the foundation (belongs to later phases, not Phase 1 gaps):

- Settings transactions, preview, and display confirmation flows — with the Settings UI/menu phase.
- Additional languages and the full translation resource set — with the localization implementation phase.
- Procedural audio synthesis and gameplay sounds — with the audio implementation phase.
- Removal of the temporary debug sandbox — completed in Phase 2 (replaced by the test level and player controller).

Known notes:

- The production bundle is currently a single ~4.9 MB chunk (Three.js + Rapier WASM). Code splitting is deferred until the gameplay modules exist; the build warning is expected and not a blocker for the prototype.
- The `StatusOverlay` remains a temporary diagnostic; the Phase 1 `PhysicsDebugSandbox` was removed in Phase 2.

### Phase 2 — First-Person Player

**Goal:** Make the player controllable in a basic test environment.

**Status:** Complete (2026-11-17).

Systems:

- Player State.
- Movement.
- Camera.

Initial features:

- First-person camera.
- Mouse look.
- Keyboard movement.
- Walking and sprinting.
- Jumping.
- Crouching.
- Basic collision.
- Ground detection.
- Landing behavior.
- Movement state transitions.

Implemented and smoke-verified:

- `MovementTuning` + `MovementModel`: fixed-step locomotion (walk/run/sprint bands), acceleration/deceleration, crouch posture with reduced speed, jump with buffered input (0.12 s), coyote time (0.10 s), variable jump height, air control with a maximum air speed, gravity and fall-speed clamping, landing recovery, and canonical movement state selection. Unit-tested.
- `PlayerSystem`: Rapier capsule on a kinematic-position body driven by `KinematicCharacterController` (autostep, ground snapping, slope limits, wall sliding); reconciles velocity with the movement actually allowed by collisions; interpolated position for rendering; reset; emits canonical `player:jumped` / `player:landed` events. Integration-tested against a Rapier world (settling, movement, jump/land, wall blocking).
- `PlayerStateSystem`: aggregated lifecycle (`initializing` → `active`/`disabled`), control projection, capability resolution (`canMove`, `canLook`, `canJump`, `canSprint`, `canCrouch`, `canSlide` reserved, `canInteract`, `canPause`, `canRestart`), revisioned immutable snapshots, and change listeners. Unit-tested.
- `CameraSystem`: first-person perspective camera, yaw/pitch look with ±85° pitch clamp, mouse and gamepad look with Settings-owned sensitivity/inversion, smooth standing/crouching eye-height transitions, speed-dependent bob, landing dip, single-owner FOV controller with sprint FOV, and reduced-motion behavior. Unit-tested.
- `TestLevel`: temporary authored test environment (ground, boundary walls, steps, obstacles, jumpable platforms, wall surface, accent marker) with matching visual meshes and static Rapier colliders.
- `Application` integration: startup order now includes test level → player state → player → camera; fixed update runs player movement before the physics step; render interpolates the player body between fixed steps and updates the camera; Settings adapters apply `controls.*`, `camera.*`, and shared reduced-motion preferences to the camera; a short warm-up settles the player on the ground before the first frame; status overlay reports player state, speed, grounded flag, and stance.
- Removed the Phase 1 `PhysicsDebugSandbox`; the test level and player controller replace it.

Verification performed:

- `npm run typecheck` — passes.
- `npm run check` — Biome lint, formatting, and import order pass.
- `npm test` — 111 unit tests pass across 13 files (movement model 13, player state 7, camera 13, player physics integration 6, plus the Phase 1 suites).
- `npm run build` — production build succeeds.
- Headless browser smoke check (Microsoft Edge, WebGL2/SwiftShader): first-person view of the test level renders; player reports `IDLE`, `grounded yes`, `stance standing`; settings/localization/audio states remain correct.

Exit criteria:

- [x] Player can move through a test environment (forward/strafe/turn, jump, crouch).
- [x] Movement is independent of rendering frame rate (all movement runs on the fixed 60 Hz step; the render loop only interpolates).
- [x] Collision prevents movement through solid geometry (Rapier character controller integration test against a static wall).
- [x] Camera responds correctly to player movement (look, eye height, bob, landing dip, sprint FOV).
- [x] Focus loss does not leave input actions stuck (InputManager clears held state on focus loss/visibility change; movement decelerates from the fixed step).

Deferred to Phase 3 and later (not Phase 2 gaps):

- Sliding, vaulting, wall running, and wall jumping controllers and their camera responses.
- Player recovery/respawn integration and checkpoint destination usage.
- Physical capsule resizing for crouch/slide clearance (crouch currently changes stance, speed, and camera height; low-ceiling traversal belongs to the slide work).
- Test level ownership moves to Level Design/Level Runtime content once those systems exist.

Known notes:

- The production bundle is currently a single ~4.9 MB chunk (Three.js + Rapier WASM); code splitting is deferred until the gameplay modules settle.
- `TestLevel` and `StatusOverlay` are temporary verification scaffolding.

### Phase 3 — Traversal and Recovery

**Goal:** Implement the core parkour experience.

**Status:** Complete (2026-11-17).

Systems:

- Movement extensions.
- Interaction.
- Checkpoint.
- Respawn.

Initial features:

- Sliding.
- Vaulting.
- Wall running.
- Wall jumping.
- Checkpoint activation.
- Fall detection.
- Respawn at the active checkpoint.
- Interaction prompts.

Implemented and verified:

- Movement extensions:
  - Sliding: entry requires grounded speed ≥ 5.0 m/s and crouch; friction 2.0 m/s², minimum duration 0.25 s, maximum duration 1.2 s, exit at 2.5 m/s, jump-out allowed after the minimum duration. The capsule physically shortens to a 0.9 m posture height with feet anchored, so the player can pass under 1.05 m ceilings.
  - Vaulting: contextual action (`Interact`) with a detector that validates obstacle height (0.35–1.15 m), landing surface, and head clearance; execution is a scripted 0.45 s arc with a 0.25 m lift that preserves horizontal momentum. The player's kinematic body follows the validated trajectory.
  - Wall running: side ray detection within 0.75 m, minimum speed 5.0 m/s, maximum duration 1.5 s, reduced gravity (×0.35), speed decay, and automatic exit when the wall is lost or duration expires.
  - Wall jumping: jump input during a wall run produces outward (5.5 m/s) and upward (6.0 m/s) velocity with a short `WALLJUMP` state.
  - Posture volumes: posture changes move the kinematic body while keeping feet anchored; standing up is blocked under low ceilings; capsule resizing is synchronized with the character-controller queries.
  - Canonical traversal events emitted by `PlayerSystem`: `player:sliding-started`, `player:sliding-ended`, `player:vault-started`, `player:wallrun-started`, `player:wallrun-ended`, `player:walljumped` (plus the Phase 2 jump/land events).
- Camera traversal responses: sliding eye height (0.65 m), wall-run roll toward the wall (±0.06 rad, disabled by reduced motion), posture-aware eye offsets, and respawn reset of transient effects.
- Interaction System: distance/facing validation, physics line-of-sight (rays ignore the player's kinematic body), nearest-target selection, prompt snapshot, 0.6 s cooldown, runtime enable/disable, and execution listeners. The Application executes `Interact` only when the player is not vaulting.
- Checkpoint System: validated definitions and spawn-point references, deterministic activation (one checkpoint per update, definition order), deduplicated session-scoped progress, active-checkpoint tracking, respawn destination resolution (including `respawnEnabled`), reset, and listeners.
- Respawn System: `RespawnManager` is the sole recovery orchestrator. Requests reject while busy, resolve the destination through the Checkpoint System (falling back to the level's initial spawn), suspend player control and input, teleport/reset the player, reset camera transient effects, restore control after a deterministic 0.15 s window, and publish completion results. Fall detection compares the player position with the test level's kill plane.
- Test level: spawn points, three checkpoints, a fall pit, a vault obstacle, a low-ceiling slide tunnel, a wall-run corridor, an interaction terminal, and traversal verification geometry.
- Application integration: traversal systems are created after the player/camera/input, updated in the fixed step (movement → interaction → checkpoint activation → fall detection → physics), and reported in the status overlay (`traversal checkpoint … · interaction … · respawn …`).
- Removed the Phase 2 debug physics scaffolding in favor of gameplay-driven test level content (already removed in Phase 2; no new scaffolding added).

Verification performed:

- `npm run typecheck` — passes.
- `npm run check` — Biome lint/format/import checks pass.
- `npm test` — 151 unit and integration tests across 18 files pass, including: movement model 23 (slide/vault/wall-run/wall-jump), player traversal integration 4 (slide under low ceiling, crouch blocked, vault crossing, respawn restore), checkpoint 5, respawn 5, interaction 6, traversal detection 6 (Rapier ray detection), camera 17, player state 7, player physics 6, plus the prior suites.
- `npm run build` — production build succeeds.
- Headless browser smoke check: first-person test level renders; status reports player `IDLE`, `grounded yes`, `traversal checkpoint none · interaction none · respawn idle`.
- Browser CDP input check: synthetic keyboard movement reaches the first checkpoint (`test_cp_rooftop`); a vault plus continued movement reaches `test_cp_industrial`; crouch changes stance to `crouching`; no fatal overlay or console failure.

Exit criteria:

- [x] Core traversal mechanics work reliably: slide, vault, wall run, and wall jump are implemented, unit-tested, and integrated with the player controller; slide/vault pass end-to-end physics integration tests.
- [x] Recovery restores a valid player state: `RespawnManager` places the player at the active checkpoint destination, resets transient movement/camera state, and restores movement (integration-tested).
- [x] Checkpoint activation is deterministic: definition-order activation, deduplication, revisioned snapshots, and destination resolution are unit-tested.
- [x] Interactions are validated before execution: target enabled state, range, facing, line-of-sight, and cooldown are checked before execution and covered by tests.

Known limitations and deferred integration:

- Vaulting is an explicit contextual interaction (no auto-vault); obstacle detection is horizontal and tuned for the test geometry.
- Wall running requires manual timing and a nearby wall; no wall-run camera framing beyond roll.
- Respawn has no fade/transition presentation yet; the camera snaps to the destination. Recovery presentation belongs to Phase 6.
- Checkpoint progress is session-scoped and not persisted; persistent run state belongs to Phase 5 (Speedrun/Save).
- Checkpoint order is deterministic but not yet validated against the Speedrun route; Speedrun owns ordered validation (Phase 5).
- `TestLevel` remains temporary level content: definitions are passed directly to the checkpoint/interaction systems. Level Runtime will own level loading, spawn registration, and trigger registration in Phase 4.
- Interaction currently exposes prompt snapshots without HUD rendering; HUD belongs to Phase 6.

### Phase 4 — Level Runtime

**Goal:** Establish the runtime level lifecycle.

Systems:

- Level Design.
- Procedural Generation.
- Level Runtime.

Initial features:

- Level definitions.
- Geometry generation or loading.
- Collision and surface metadata.
- Spawn point registration.
- Trigger registration.
- Section lifecycle.
- Runtime cleanup.

Exit criteria:

- A test level can be loaded and unloaded.
- Spawn points resolve correctly.
- Traversal surfaces expose expected metadata.
- Runtime objects do not leak between sessions.

### Phase 5 — Gameplay Sessions and Modes

**Goal:** Make the game playable as a structured experience.

Systems:

- Gameplay Session.
- Gameplay Flow.
- Training.
- Speedrun.

Initial features:

- Main Menu to gameplay transition.
- Training session.
- Ten Training exercises.
- Objective evaluation.
- Prologue session.
- Five Prologue sections.
- Five required checkpoints.
- Speedrun timer and splits.
- Results screen.

Exit criteria:

- Training can be started, completed, and restarted.
- Prologue can be completed from start to finish.
- Speedrun timing is independent of FPS.
- Checkpoint order is validated.
- Results are generated from authoritative gameplay data.

### Phase 6 — Presentation and Player Feedback

**Goal:** Deliver a coherent game interface and feedback experience.

Systems:

- UI / UX.
- Menu.
- HUD.
- Audio.
- Accessibility.
- Localization.

Initial features:

- Main Menu.
- Pause Menu.
- Settings.
- Gameplay HUD.
- Speedrun timer and splits.
- Interaction prompts.
- Training objectives.
- Audio feedback.
- Reduced Motion.
- Keyboard and gamepad navigation.
- Initial English localization.

Exit criteria:

- Primary gameplay states have appropriate presentation.
- UI reflects authoritative gameplay state.
- Accessibility preferences are respected.
- Initial localization resources contain required strings.

### Phase 7 — Progression and Long-Term Systems

**Goal:** Make repeated play meaningful and measurable.

Systems:

- Progression.
- Tutorial.
- Achievement.
- Statistics.

Initial features:

- Training completion tracking.
- Prologue completion tracking.
- Content unlock rules.
- Tutorial progression.
- Achievement unlocking.
- Session and lifetime statistics.
- Persistent player progress.

Exit criteria:

- Progress is consistent after reload.
- Repeated events do not duplicate progress.
- Achievements unlock from authoritative conditions.
- Statistics match authoritative gameplay events.

### Phase 8 — Stabilization

**Goal:** Prepare the initial release.

Tasks:

- Full gameplay regression.
- Browser compatibility checks.
- Performance profiling.
- Memory and resource lifecycle checks.
- Persistence migration tests.
- Input and focus edge-case testing.
- Accessibility checks.
- UI scaling and localization checks.
- Error handling.
- Final acceptance testing.

Exit criteria:

- All critical acceptance criteria pass.
- No unresolved critical gameplay blockers remain.
- Persistence survives reload and supported migration scenarios.
- Core gameplay is stable across supported browsers and devices.

---

## 7. Initial Release Scope

### Required

- First-person movement.
- Mouse and keyboard input.
- Initial gamepad support.
- Walking, running, sprinting, jumping, crouching, sliding, vaulting, wall running, and wall jumping.
- Basic player collision and recovery.
- Training mode with ten exercises.
- Prologue mode with five sections.
- Five required checkpoints.
- Speedrun timer and checkpoint splits.
- Route validation.
- Bronze, Silver, and Gold performance evaluation.
- Personal best records.
- Local leaderboard.
- IndexedDB persistence.
- Main Menu, Pause Menu, Settings, and Results.
- Basic HUD.
- Basic procedural audio feedback.
- Initial accessibility support.
- English localization.
- Core tutorial guidance.

### Deferred

| Feature | Related System | Status |
|---|---|---|
| Ghost Replay recording | Speedrun | Deferred |
| Ghost Replay playback | Speedrun | Deferred |
| Online Leaderboards | Speedrun | Deferred |
| Cloud Save | Save | Deferred |
| Multiplayer | Gameplay Session | Deferred |
| Online Accounts | Progression | Deferred |
| Advanced Procedural Campaign | Procedural Generation | Deferred |
| Ledge Grabbing | Movement | Deferred |
| Ledge Climbing and Hanging | Movement | Deferred |
| Dedicated Balance Traversal | Movement | Deferred |
| Swinging and Ziplines | Movement | Deferred |
| Advanced Traversal Variants | Movement | Deferred |
| Advanced Audio Occlusion | Audio | Deferred |
| Full RTL Layout | Localization | Deferred |
| Remote Analytics | Statistics | Deferred |

Deferred features must not block the initial release.

---

## 8. Cross-System Integration Checklist

Integration is tracked separately from individual system implementation.

| Integration | Expected Contract | Status |
|---|---|---|
| Input → Movement | Abstract movement and traversal actions | Integrated |
| Input → Camera | Look input | Integrated |
| Input → UI | Navigation and confirmation actions | Not Started |
| Movement → Camera | Movement metrics and traversal events | Integrated |
| Movement → Player State | Authoritative locomotion state | Integrated |
| Movement → HUD | Speed and movement feedback | Not Started |
| Interaction → UI | Prompt and interaction state | Not Started |
| Interaction → Training | Interaction completion events | Not Started |
| Checkpoint → Respawn | Active recovery destination | Integrated |
| Level Runtime → Checkpoint | Checkpoint registration and lifecycle | Not Started |
| Level Runtime → Respawn | Spawn point resolution | Not Started |
| Respawn → Movement | Placement and transient state reset | Integrated |
| Respawn → Camera | Camera recovery | Integrated |
| Gameplay Session → Level Runtime | Level lifecycle orchestration | Not Started |
| Gameplay Flow → Gameplay Session | Session lifecycle requests | Not Started |
| Training → Movement | Authoritative traversal events | Not Started |
| Speedrun → Checkpoint | Ordered checkpoint validation | Not Started |
| Speedrun → Save | Persistent records | Not Started |
| Training → Save | Persistent training progress | Not Started |
| Settings → Save | Configuration persistence | Integrated |
| Settings → Accessibility | Accessibility preferences | Not Started |
| Localization → UI | Localized text and formatting | Not Started |
| Gameplay Events → Statistics | Normalized event aggregation | Not Started |
| Achievement → Progression | Achievement unlock notifications | Not Started |
| Progression → Menu | Unlock and milestone snapshots | Not Started |
| Gameplay Events → Audio | Gameplay feedback events | Not Started |

An integration is complete only when both sides use the agreed contract and the interaction has been tested.

---

## 9. Quality Gates

Every system must pass all applicable quality gates before being marked `Verified`.

### Architecture

- [ ] System has a clear ownership boundary.
- [ ] Public interfaces match its specification.
- [ ] No duplicate authoritative state exists.
- [ ] Dependencies do not introduce circular ownership.
- [ ] Events have defined payloads and lifecycle behavior.

### Functionality

- [ ] Required initial features are implemented.
- [ ] Normal gameplay scenarios work.
- [ ] Invalid operations are rejected safely.
- [ ] State transitions are deterministic.
- [ ] Session lifecycle is handled correctly.

### Reliability

- [ ] Errors do not leave the system in an invalid state.
- [ ] Async operations handle cancellation and stale results.
- [ ] Cleanup is performed on teardown.
- [ ] Repeated operations do not cause duplicate effects.
- [ ] Browser focus loss and recovery are handled where applicable.

### Performance

- [ ] No unnecessary per-frame allocations in critical loops.
- [ ] No persistence writes on every frame.
- [ ] Expensive work is kept out of critical gameplay paths.
- [ ] Resource lifecycles are controlled.
- [ ] Performance is profiled in a representative environment.

### Static Analysis and Formatting

- [ ] TypeScript strict check passes (`npm run typecheck`).
- [ ] Biome check passes (`npm run check`): lint, formatting, import order.
- [ ] CI validation passes for the change.

### Testing

- [ ] Unit tests cover important rules.
- [ ] Integration tests cover system boundaries.
- [ ] Edge cases are tested.
- [ ] Acceptance criteria are satisfied.
- [ ] No critical regression is introduced.

---

## 10. Architectural Ownership Resolutions

These ownership boundaries were resolved during the 2026-11-17 documentation reconciliation. They are now reflected in the system specifications and must be preserved during implementation. Any implementation that contradicts them is a specification deviation.

### 10.1. Respawn Ownership

Checkpoint owns checkpoint progress and destination information.

Respawn owns the recovery lifecycle.

`RespawnManager` is the canonical recovery orchestrator.

Checkpoint must not introduce a competing respawn lifecycle manager.

### 10.2. Progression and Achievements

Achievement owns:

- Achievement definitions.
- Unlock conditions.
- Unlock state.
- Achievement notifications.

Progression owns:

- Content unlocks.
- Campaign milestones.
- Long-term progression rules.

Progression may consume achievement events but must not duplicate achievement state.

### 10.3. Settings and Localization

The selected language is a Settings-owned preference.

Localization owns language definitions, resources, loading, and translation resolution.

The language preference must not be persisted independently by Localization.

### 10.4. Statistics and Domain Ownership

Statistics collects facts from authoritative gameplay systems.

It must not independently determine:

- Whether a Training exercise is completed.
- Whether a Speedrun is valid.
- Whether an Achievement is unlocked.
- Whether content should be unlocked.

### 10.5. Session and Event Lifecycles

Session-scoped events must carry sufficient identity to reject stale events.

Systems must not process events from unloaded or replaced sessions.

Attempt-scoped systems must also reject events from previous attempts.

### 10.6. Runtime and Procedural Generation

Procedural Generation creates and validates generated content.

Level Runtime manages the lifecycle of loaded content.

Level Runtime must not become a second procedural generation system.

### 10.7. Specification Consistency

The cross-document review of public interfaces and shared data models was completed on 2026-11-17 for:

- Checkpoint destination resolution.
- Respawn request ownership.
- Gameplay Session lifecycle events.
- Gameplay Flow transition contracts.
- Speedrun checkpoint validation.
- Training objective event correlation.
- Achievement and Progression event contracts.
- Statistics aggregation and unique-value semantics.
- Settings and Localization language ownership.
- Save persistence ownership and database naming.

Shared data models must still be validated against the actual codebase as each system is implemented. If implementation reveals a contract gap, update the owning specification first and record the deviation here.

---

## 11. Implementation Record Template

Use this template whenever a system is started or updated.

```md
### [System Name]

**Specification:** `XX_SYSTEM_SPEC.md`

**Specification Status:** Defined
**Implementation Status:** Not Started
**Integration Status:** Not Started
**Verification Status:** Not Verified

**Owner:**
- [Agent or developer]

**Implementation Scope:**
- [Feature]
- [Feature]

**Completed:**
- [x] [Completed task]

**Remaining:**
- [ ] [Remaining task]

**Known Issues:**
- [Issue or None]

**Tests:**
- [Test suite or None]

**Last Updated:** YYYY-MM-DD
```

Every implementation agent must update this record after completing a meaningful milestone.

---

## 12. Rules for Updating This Document

1. Never mark a feature complete without inspecting its implementation.
2. Never infer implementation status from the existence of source files alone.
3. Update status only when supported by code or test evidence.
4. Keep implementation, integration, and verification statuses separate.
5. Record known deviations from specifications.
6. Record intentionally deferred features explicitly.
7. Do not silently remove unfinished tasks.
8. Update integration status when system boundaries change.
9. Revisit affected entries after architectural refactoring.
10. Keep this document accurate and useful as a project dashboard.

When an implementation agent finishes a task, it must report:

- Files created or modified.
- Systems affected.
- Implemented features.
- Tests executed.
- Test results.
- Remaining limitations.
- Specification deviations.
- Recommended next implementation task.

---

## 13. Definition of Initial Release Completion

The initial Glassline release can be considered complete when:

- All required initial-release features are implemented.
- Core systems are integrated.
- Training is playable from start to finish.
- Prologue is playable from Rooftop to Finish.
- All five required checkpoints work correctly.
- Speedrun timing and route validation work correctly.
- Local records persist across reloads.
- Menus, HUD, and gameplay feedback are functional.
- Required accessibility features are implemented.
- No unresolved critical or high-severity defects remain.
- Required automated and manual acceptance tests pass.

Deferred features are not part of this completion requirement.

---

## 14. Final Principle

**The specification describes what must exist. The implementation status describes what actually exists. Tests demonstrate whether it works.**

This document must always represent the real state of the Glassline repository, not the intended state of the project.