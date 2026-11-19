# Glassline — Implementation Status

**Document:** `IMPLEMENTATION_STATUS.md`  
**Project:** Glassline  
**Last Updated:** 2026-11-17  
**Project Stage:** Polished Initial Release Candidate  
**Status:** Phases 0–8 Complete; Release Polish Pass Complete

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
| Technical Architecture | Defined | Implemented | Integrated | Partially Verified |
| Core Gameplay | Defined | Implemented | Integrated | Verified |
| Player Systems | Defined | Implemented | Integrated | Verified |
| Level Systems | Defined | Implemented | Integrated | Verified |
| Gameplay Modes | Defined | Implemented | Integrated | Verified |
| UI / UX | Defined | Implemented | Integrated | Verified |
| Audio | Defined | Implemented | Integrated | Partially Verified |
| Persistence | Defined | Implemented | Integrated | Verified |
| Progression | Defined | Implemented | Integrated | Verified |
| Accessibility | Defined | Implemented | Integrated | Partially Verified |
| Localization | Defined | Implemented | Integrated | Verified |
| Statistics | Defined | Implemented | Integrated | Verified |
| Reference Presentation | Defined | In Progress | Integrated | Partially Verified |

**Current phase:** Phases 0–7 and Phase 8 (stabilization) are complete. A post-roadmap **Release Polish** pass has also been completed: initial release content presentation, HUD tutorial guidance, atmosphere, and procedural ambience/footsteps. A **Reference Presentation Pass** is in progress to bring design, graphics, and sound up to the *Mirror's Edge* prologue reference. Round 1 (HDR rendering, sky, materials, rooftop city, first-person arms) is complete and measured. Round 2 (procedural audio architecture, surface-aware movement, parkour set, ambience, score, radio) is implemented and measured. Round 3 extends the Prologue from a 25 m flat corridor to a ~66 m route with a roof drop, sprint gap, stair climb, narrow skybridge, and finish roof. Round 4 applies the reference's editorial UI language (paper panels, ink type, red rules, minimal HUD), canvas signage (`RUN`, section indices, `FINISH`), and a speed-reactive radial blur. Round 5 adds a visual-only Prologue city vignette behind the paper menu, shown only outside gameplay. Round 6 extends the playable route with a final scaffold ascent: a beam, eight rising jump platforms, and a high finish roof. Round 7 adds an exposed high catwalk U-turn before the finish gate, bringing the path to ~220 m with 8.2 m vertical range in the 180–220 m band. Round 8 polishes the finale with a suspended construction load, deck/high-roof kit, turn-view cleanup, and altitude-scaled wind ambience. Round 9 adds a 2.2 m catwalk gap and opens the turn vista with a distant crane. Round 10 adds a fall-only high-route respawn anchor, metal catwalk surface audio, and distant hero towers at the turn. Round 11 replaces those towers with authored facades/billboard and adds a 0.5 m return barrier. Round 12 adds a platform-5 fall anchor with a visible safe-retry pad on the scaffold climb. Round 13 adds an optional lower bypass around the return-catwalk barrier. Round 14 adds a close RUN billboard at the turn and a high-roof helipad detail. Round 15 adds a measured high-route audio profile (altitude wind, metal catwalk steps, landings, finish hit) with a 5/5 custom band result while preserving the prologue 5/5 mix. Round 16 verifies the live in-engine altitude wind and metal catwalk steps with a ground-vs-high analyser probe. Round 17 adds foliage/soil materials and amenity planters/bench to the start roof. Round 18 adds an overhead canyon bridge that brings the start sky metric into band. Round 19 rebalances sky haze/fog/grade and reaches **13/13** start-frame reference metrics. Round 20 brings the Training yard to the same light parapet/city/signage language. Round 21 adds authored window-grid facades to Training towers and balances the Prologue billboard/helipad. Round 22 moves Training windows to glass materials, adds rooftop masts/beacons and a readable MOVEMENT YARD banner. Round 23 adds projecting balcony bands and glass rails for facade depth. Round 24 fixes balcony projection, adds doors/warm interiors, and a small animated bird flock over the city. Round 25 adds slow menu-camera drift and a swinging bridge hoist for ambient motion. Round 26 adds Training floor identity and makes menu drift respect reduced motion. Round 27 paints the floor mat into the lane and freezes ambient motion (birds/hoist/clouds) under reduced motion. Round 28 records an actual in-engine high-route WAV for listening, with peak/LUFS/spectral metrics. Round 29 adds normal-cadence high/ground recordings and a direct RMS/LUFS comparison. Round 30 adds a cinematic route-video capture with live engine ambience. Round 31 raises slide-tunnel clearance to 1.35 m, guards it with a test, and captures a 9 s continuous gameplay clip. Round 32 adds foreground roof utility detail while retaining 13/13. Round 33 adds faint worn-concrete patches, also retaining 13/13. A human listening pass, bypass tradeoff, clipped-highlight recovery, and final motion polish remain.

**Implementation readiness:** The game is feature-complete for the initial release scope, stabilized, and visually/audio-polished: core gameplay, Training/Prologue sessions, Speedrun validation and local records, persistent progression/achievements/statistics/tutorial, HUD tutorial guidance, level atmosphere and ambience, UI/accessibility/localization, Save System recovery, and the fixed-step loop are implemented, integrated, and covered by automated and browser checks. The reference pass has added an HDR post pipeline, procedural sky/reflections, PBR materials, a dense Prologue city, a first-person body, a procedural audio mix with surface-aware movement, parkour loops, ambience, and a sparse score, a vertical Prologue route with drop, gap, stair climb, skybridge, and finish roof, a reference-style paper/ink UI with canvas signage and speed blur, a visual-only menu city vignette, a high-roof scaffold finale, an exposed catwalk U-turn, altitude-scaled wind, a catwalk gap, a high-route safety anchor, metal catwalk surface audio, authored turn skyline, a return barrier, a mid-ascent safety pad, a return-catwalk bypass, a turn billboard, a high-roof helipad, a measured high-route sound profile, a live altitude/metal audio probe, rooftop planters, an overhead canyon bridge, a pale/hazy reference atmosphere, a restyled Training yard, authored Training facades, glass Training windows, a yard banner, projecting Training balconies, balcony doors, a living skyline, menu drift, a swinging hoist, Training floor markings, reduced-motion-aware menu/ambience, a painted floor mat, a live in-engine audio recording, a high/ground listening pair, a cinematic route video, a real gameplay clip, foreground roof utility, and worn-concrete patches. The measured start frame is inside the reference tolerance band on 10/13 image metrics (highlight headroom and sky area are open gaps); the offline audio demo is inside all five planned audio bands (5/5). Remaining limitations are compatibility verification depth (Firefox/Safari gameplay, actual assistive-technology testing), reference-level sound and route design, asset-level art polish, and intentionally deferred features.

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
| 07 | `07_UI_UX_SPEC.md` | Defined | In Progress |
| 08 | `08_AUDIO_DESIGN_SPEC.md` | Defined | In Progress |
| 09 | `09_SPEEDRUN_SYSTEM_SPEC.md` | Defined | In Progress |
| 10 | `10_SAVE_SYSTEM_SPEC.md` | Defined | In Progress |
| 11 | `11_INPUT_SYSTEM_SPEC.md` | Defined | In Progress |
| 12 | `12_MOVEMENT_SYSTEM_SPEC.md` | Defined | In Progress |
| 13 | `13_CAMERA_SYSTEM_SPEC.md` | Defined | In Progress |
| 14 | `14_INTERACTION_SYSTEM_SPEC.md` | Defined | In Progress |
| 15 | `15_LEVEL_RUNTIME_SYSTEM_SPEC.md` | Defined | In Progress |
| 16 | `16_CHECKPOINT_SYSTEM_SPEC.md` | Defined | In Progress |
| 17 | `17_RESPAWN_SYSTEM_SPEC.md` | Defined | In Progress |
| 18 | `18_PLAYER_STATE_SYSTEM_SPEC.md` | Defined | In Progress |
| 19 | `19_GAMEPLAY_SESSION_SYSTEM_SPEC.md` | Defined | In Progress |
| 20 | `20_GAMEPLAY_FLOW_SYSTEM_SPEC.md` | Defined | In Progress |
| 21 | `21_TRAINING_SYSTEM_SPEC.md` | Defined | In Progress |
| 22 | `22_PROGRESSION_SYSTEM_SPEC.md` | Defined | In Progress |
| 23 | `23_HUD_SYSTEM_SPEC.md` | Defined | In Progress |
| 24 | `24_MENU_SYSTEM_SPEC.md` | Defined | In Progress |
| 25 | `25_SETTINGS_SYSTEM_SPEC.md` | Defined | In Progress |
| 26 | `26_ACCESSIBILITY_SYSTEM_SPEC.md` | Defined | In Progress |
| 27 | `27_LOCALIZATION_SYSTEM_SPEC.md` | Defined | In Progress |
| 28 | `28_TUTORIAL_SYSTEM_SPEC.md` | Defined | In Progress |
| 29 | `29_ACHIEVEMENT_SYSTEM_SPEC.md` | Defined | In Progress |
| 30 | `30_STATISTICS_SYSTEM_SPEC.md` | Defined | In Progress |

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
| Level Runtime | 15 | Load and manage runtime level sessions | In Progress |
| Checkpoint | 16 | Register and activate checkpoints | In Progress |
| Procedural Generation | 05 | Generate validated environment geometry and assets | Not Started |

### 5.4. Gameplay Orchestration

| System | Specification | Initial Goal | Status |
|---|---|---|---|
| Gameplay Session | 19 | Manage Training and Prologue lifecycle | In Progress |
| Gameplay Flow | 20 | Coordinate application navigation and transitions | In Progress |
| Training | 21 | Implement exercises and objective evaluation | In Progress |
| Speedrun | 09 | Implement timing, splits, validation, and records | In Progress |
| Progression | 22 | Implement content unlocks and milestones | In Progress |
| Tutorial | 28 | Implement contextual guidance and learning progression | In Progress |
| Achievement | 29 | Implement achievement definitions and unlocking | In Progress |
| Statistics | 30 | Aggregate authoritative gameplay statistics | In Progress |

### 5.5. Presentation

| System | Specification | Initial Goal | Status |
|---|---|---|---|
| UI / UX | 07 | Establish visual and interaction conventions | In Progress |
| Menu | 24 | Implement application screens and menu interactions | In Progress |
| HUD | 23 | Implement gameplay HUD and feedback widgets | In Progress |
| Audio | 08 | Implement gameplay audio and feedback | In Progress |
| Accessibility | 26 | Implement accessibility preferences and adaptations | In Progress |

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
- Test-level content: temporary authored test environment (ground, boundary walls, steps, obstacles, jumpable platforms, wall surface, accent marker) with matching visual meshes and static Rapier colliders. Superseded by the Level Runtime content rewrite in Phase 4.
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
- The test environment and `StatusOverlay` are temporary verification scaffolding; level content now loads through Level Runtime.

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
- Level content was moved under Level Runtime in Phase 4: authored definitions now provide spawn points, triggers, checkpoints, interaction targets, surfaces, and geometry. Final Training/Prologue content is still deferred.
- Interaction currently exposes prompt snapshots without HUD rendering; HUD belongs to Phase 6.

### Phase 4 — Level Runtime

**Goal:** Establish the runtime level lifecycle.

**Status:** Complete (2026-11-17).

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

Implemented and verified:

- Level definitions and validation:
  - Typed `LevelDefinition`, section, spawn point, trigger, authored checkpoint, interaction target, geometry, and surface metadata models.
  - `validateLevelDefinition` checks ids, section ordering/references, spawn ownership and finite transforms, geometry/surface references, trigger volumes and target references, checkpoint trigger/spawn references, interaction targets, and Prologue section count/order.
- `LevelRuntimeManager` session lifecycle:
  - Load → initializing → ready → active → paused/completed → unloading with structured `LevelRuntimeError` codes.
  - Loaded definitions are validated before initialization; unknown levels, duplicate definitions, invalid definitions, invalid session states, and disallowed transitions are rejected deterministically.
  - Cancellation through `AbortSignal` and operation generations; partially initialized content rolls back on failure.
  - Level lifecycle and section/trigger events via a typed event bus; session IDs are unique per load and preserved across section transitions.
  - Idempotent unload that disposes content, clears registries/managers, and supports clean reloading with a new session.
- Section lifecycle: explicit `loaded`/`active` states, chain-validated activation (`nextSectionId`), deterministic no-op for repeated activation, deactivation of previous-section trigger/interactable objects, and section events.
- Spawn points (`SpawnPointManager`): registration, validation, initial spawn resolution, section-aware priority, and explicit/section/fallback/initial resolution order.
- Triggers (`TriggerManager`): registration, enabled state, section gating, enter/exit deduplication, repeatable/non-repeatable behavior, exit events on disable, metadata pass-through, and clearing on unload. Section-entry triggers drive automatic section activation.
- Surface metadata (`SurfaceRegistry`): registered per geometry with concrete/metal surface type and walkable/landing/wall-run/wall-jump/vault flags, collider-handle lookup, active state, and feet-position surface resolution. The player status line reports the surface underfoot.
- Runtime object registry (`RuntimeObjectRegistry`): unique ids, section/type queries, section activation/deactivation, aggregated failure reporting, and aggregated disposal.
- Content loading (`BoxLevelContentLoader`): instantiates authored box geometry as Three.js meshes and static Rapier colliders, registers surfaces/spawn points/triggers/checkpoints/interactables, and releases meshes, materials, colliders, and registrations on unload. Whole-level loading is synchronous behind an asynchronous contract, ready for procedural generation or streaming adapters.
- Checkpoint integration refactor: Level Runtime owns trigger detection and spawn resolution; `CheckpointSystem` now activates from validated trigger signals and resolves spawn points through Level Runtime, scoped to the active level session. Trigger-based activation replaces direct position polling.
- Interaction integration: interaction targets come from the level definition; only targets in the active section are enabled, and prompts remain owned by the Interaction System.
- Failure volumes: the test level authors a kill-volume trigger in the fall pit; the Application interprets the validated trigger signal and requests recovery through `RespawnManager`.
- Application integration: level is loaded through Level Runtime before player creation; player spawn comes from the resolved initial spawn; player movement starts only after session start; fixed-step order is movement → interaction → Level Runtime triggers/section → physics; status overlay shows level/session/section/object/trigger/surface counts and underfoot surface.
- Content: temporary authored `training_test` level with three sections (Start, Traversal, Finish), six spawn points, three checkpoints, six triggers (two section-entry, three checkpoint, one kill volume), one interaction terminal, 18 box geometry objects, and eight surface definitions.

Verification performed:

- `npm run typecheck` — passes.
- `npm run check` — Biome lint/format/import checks pass.
- `npm test` — 185 unit and integration tests across 20 files pass, including: Level Runtime lifecycle 13, level registries/validator 19, checkpoint 7, plus the Phase 1–3 suites (movement, player traversal, respawn, interaction, detection, camera, player state, player physics, and foundations).
- `npm run build` — production build succeeds.
- Headless browser smoke check: level loads and starts (`level training_test · active · section sec_start · objects 34 · triggers 3/6 · surfaces 18/18 · underfoot concrete/walkable`), player spawns grounded, no fatal overlay.
- Browser CDP check: movement activates `cp_rooftop`; vaulting crosses the section-entry trigger into `sec_traversal` (trigger count changes to 2/6); continued movement activates `cp_industrial`; Level Runtime content remains stable.

Exit criteria:

- [x] A test level can be loaded and unloaded: load/start/complete/unload covered by tests; unload removes all scene content and runtime registrations, and reload works with a new session ID.
- [x] Spawn points resolve correctly: initial, explicit, section, fallback, and checkpoint-resolved spawns are covered by tests and used by player initialization/respawn.
- [x] Traversal surfaces expose expected metadata: concrete/metal types and walkable/landing/wall-run/wall-jump/vault flags are registered per geometry, queryable by section/collider/feet position, and displayed in the status overlay.
- [x] Runtime objects do not leak between sessions: scene children return to baseline after unload, registry/trigger/surface/spawn/object counts return to zero, reload produces a fresh session and identical content count, and unload is idempotent.

Known limitations and deferred integration:

- Only the initial Training test level is authored. The five-section Prologue definition, final Training content, procedural generation adapter, and asset streaming are deferred to later phases.
- Section transitions currently use trigger-driven automatic activation through `LevelRuntimeManager.activateSection`; the dedicated `LevelTransitionManager` façade (fades, cancellation, scripted transitions) and `EnvironmentStateManager` are deferred until presentation/session phases.
- `restartSession` is not exposed by Level Runtime: restart orchestration belongs to Gameplay Session (Phase 5), which will unload and load through the public lifecycle.
- Pause/resume suspends trigger evaluation but does not yet apply global time/input/camera pause; that coordination belongs to Gameplay Session/Application.
- Interaction targets are enabled per active section in the Application; Runtime Object Registry interactable objects are registered for lifecycle counts but do not yet own Interaction System state.
- Level Runtime debug panel UI is not implemented; the status overlay exposes the runtime snapshot.
- Checkpoint progress remains session-scoped and non-persistent; Speedrun ordered checkpoint validation is Phase 5.

### Phase 5 — Gameplay Sessions and Modes

**Goal:** Make the game playable as a structured experience.

**Status:** Complete (2026-11-17).

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

Implemented and verified:

- Gameplay Session (`GameplaySessionManager`):
  - Session identity, immutable configuration, metadata, and execution generation.
  - Lifecycle: created → preparing → loading → initializing → ready → starting → running, plus paused/resuming, restarting, completing/completed, abandoning/abandoned, and failed.
  - Explicit lifecycle ports for Level Runtime loading/starting/unloading, gameplay preparation/activation, suspend/resume, restart, shutdown, and authoritative result building; the Application implements these ports.
  - One active session at a time, transition guarding, ranked-run configuration validation, stale contexts via `isCurrent`, restart with generation increment, failure cleanup, and event publication.
- Gameplay Flow (`GameplayFlowManager`): validated application navigation between boot, main menu, loading, gameplay, paused, results, and error, with single navigation authority, history, snapshots, and events.
- Training (`TrainingSystem`):
  - Ten authored exercises covering movement, running, jumping, sliding, vaulting, wall running, wall jumping, landing/momentum, interaction, and a combined final sequence.
  - Objective types: perform action, action count, maintain speed, reach location, interact with target.
  - Event-driven evaluation from Movement/Interaction authoritative events; time-based evaluation for speed maintenance and authored zones (no independent movement physics).
  - Sequential exercise progression, objective progress, attempt tracking, current-exercise restart, session restart, abandonment, completion result, and session-scoped identity.
- Speedrun (`SpeedrunSystem`, `MonotonicRunTimer`):
  - Single monotonic run timer using `performance.now()` (no delta accumulation, no frame dependence); millisecond precision; MM:SS.mmm formatting.
  - Route model built from authored Prologue sections/checkpoint order/finish trigger/medal thresholds.
  - Run states idle/preparing/ready/running/finished/invalidated/abandoned/failed.
  - Sequential checkpoint validation with split times; missing/out-of-order checkpoints invalidate the run; finish validation covers checkpoint completeness, sequence, timestamps, and completion time.
  - Result model with total time, splits, checkpoint count, validation, medal, route version, and optional statistics summary; abandonment support.
- Prologue level: authored five-section route (Rooftop, Industrial, Construction, Skybridge, Finish) with five mandatory checkpoints, section-entry triggers, finish trigger, and route metadata; Speedrun route is derived from the authored content.
- Application integration (menu-first):
  - Boots to main menu without loading level content; sessions are started from the menu.
  - Gameplay Session ports load/unload levels through Level Runtime, create session-scoped player, checkpoint, interaction, respawn, and mode systems, and tear them down on completion/abandonment/restart.
  - Training exercises consume Movement/Interaction events; checkpoint triggers update Checkpoint progress and the Speedrun sequence; kill-volume triggers request recovery; finish triggers complete the session.
  - Flow transitions for loading/gameplay/paused/results/error; pause suspends Level Runtime and gameplay input, ranked timer keeps running.
  - Results are built from authoritative Training/Speedrun state before shutdown and displayed in the diagnostic overlay.
  - Temporary development session controls (until Phase 6 presentation): `T` Training, `P` Prologue, `O` Ranked Prologue, `Esc` pause/resume, `R` restart, `Q` abandon/return; dev-only `F2` completes the current session for verification.
  - Status overlay reports flow, session/mode status, generation, level/section, player state, training progress, speedrun timer/checkpoints/medal, and results.
- Level content: `PrologueTestLevel` (five sections/checkpoints) and `TrainingTestLevel` share authored arena geometry through `SharedArena`, keeping level content data-driven.

Verification performed:

- `npm run typecheck` — passes.
- `npm run check` — Biome lint/format/import checks pass.
- `npm test` — 211 unit and integration tests across 25 files pass, including: Speedrun 7, Training 5, Gameplay Session 8, Gameplay Flow 3, Prologue start-to-finish integration 3, plus all Phase 1–4 suites.
- `npm run build` — production build succeeds.
- Headless browser smoke: main menu renders with flow/session status and no level loaded.
- Browser CDP verification:
  - Main menu → Training session (level `training_test`, section `sec_start`, player spawned, exercise 1/10 active); movement completes the first exercise and activates `cp_rooftop`.
  - Pause suspends Level Runtime input/simulation status (`flow paused`, level paused); resume restores gameplay.
  - Restart creates execution generation 2 and resets Training to 0/10.
  - Abandon returns to main menu and unloads the level.
  - Prologue starts at `sec_rooftop`; vaulting transitions to `sec_industrial` and activates `cp_industrial`.
  - Ranked Prologue starts a running speedrun with ticking timer (00:02 → 00:03); timer continues while paused per ranked-run policy.
  - Dev completion shows the results flow (`RESULTS training · duration`), retry from results restarts, and return-to-menu abandons/unloads cleanly.

Exit criteria:

- [x] Training can be started, completed, and restarted: start/restart verified in-browser; the ten-exercise completion path is covered by TrainingSystem tests and session completion/result tests.
- [x] Prologue can be completed from start to finish: automated integration test drives all five sections/checkpoints/finish through Level Runtime + Checkpoint System + Speedrun and produces a valid `finished` run.
- [x] Speedrun timing is independent of FPS: monotonic timer tests advance an injected clock without frame updates and produce exact elapsed times; no delta-time accumulation is used.
- [x] Checkpoint order is validated: out-of-order activation invalidates the run; missing checkpoints invalidate the finish; the five-checkpoint Prologue sequence is validated by an integration test.
- [x] Results are generated from authoritative gameplay data: session results are built from TrainingSystem/SpeedrunSystem state (completion and duration from the session clock), covered by unit tests and shown in the results flow.

Known limitations and deferred integration:

- Main menu, pause menu, results screen, and key hints are temporary diagnostic overlay scaffolding, not the final UI (Phase 6).
- Training exercises are authored against the temporary shared test arena; the final Training environments and a full combined-traversal exercise route are content work for later phases.
- Prologue content is a test route reusing the arena; final level design/content and route balancing remain deferred.
- Speedrun records, personal bests, leaderboard persistence, and statistics summaries are not implemented (Save/Speedrun records and Statistics phases).
- Ranked-run focus-loss/invalidation policy is not yet wired to application lifecycle events; pause behavior currently follows the ranked timer rule.
- Training/speedrun results are session-scoped and not persisted.
- Interaction-based Training objective evaluates interaction completion after the terminal target becomes available; full prompt/hint presentation is deferred.
- `F2` completion and keyboard session controls are development-only scaffolding and must not ship as player-facing UI.

### Phase 6 — Presentation and Player Feedback

**Goal:** Deliver a coherent game interface and feedback experience.

**Status:** Complete (2026-11-17).

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

Implemented and verified:

- UI layer (`UIManager`, DOM/CSS):
  - Main menu (Training, Prologue, Ranked Prologue, Local Records, Settings, Credits, version/hints), loading screen, pause menu (Resume, Restart, Settings, Abandon), settings screen, results screen, records placeholder, credits, and error screen.
  - Menu screens use typographic hierarchy, accent panels, focus states, and accessible dialog semantics; mouse, keyboard, and gamepad share Input System navigation actions.
- HUD:
  - Speedrun timer with `MM:SS.mmm` formatting, checkpoint progress, recent splits, and medal/result state.
  - Training exercise number/title, objective description, and progress; speed indicator; interaction prompt; pause hint; checkpoint/exercise notification toasts with a short queue.
  - HUD respects `hud.*` visibility settings, UI scale, and authoritative Speedrun/Training/Interaction snapshots from the Application.
- Settings UI:
  - Category tabs (Audio, Controls, Camera, HUD, Accessibility, Gameplay, Language), localized setting labels, boolean/number/enum controls, immediate validation/application through SettingsManager and existing adapters, category reset, and focus preservation while adjusting values.
  - Unsupported browser display settings are hidden; optional note communicates this.
- Menu input:
  - Arrow keys/gamepad navigate; Enter/Space/confirm activates; Escape/cancel returns; focus is DOM-visible and trapped within the active screen; gamepad navigation uses the same `Navigate`/`Confirm`/`Cancel` actions as keyboard.
- Accessibility:
  - Reduced Motion disables interface transitions/spinner animation and is already respected by camera presentation.
  - High contrast and large text modes apply UI classes; UI scale respects the HUD setting.
  - ARIA dialog labeling, button roles/labels, focus outlines, and polite/assertive live regions for feedback. Keyboard-only operation is fully supported.
- Localization:
  - Initial English resource set extended with all UI/settings/HUD/results/pause/credits/error strings and plural keys; UI text resolves through LocalizationManager, and switching language refreshes the active screen.
- Audio feedback:
  - Procedural UI/gameplay cues (navigate, confirm, back, checkpoint, exercise complete, finish, landing) through the Audio System, honoring master/mute plus UI/SFX channel volumes.
- Application integration:
  - Flow-driven screens: boot → main menu; loading; gameplay HUD; pause; results; error. Settings overlays from main menu/pause preserve the return context; gameplay pause/resume, result retry, and abandon-to-menu all work through the Gameplay Session ports.
  - Diagnostics moved behind a development overlay toggled with `F3`; `F2` (dev builds) completes the current session for results verification. Status overlay is disabled by default and is no longer player-facing presentation.
  - Settings changes apply immediately, including reduced motion/high contrast/large text and UI scale; localization refresh occurs on language change.
- Localization/UI tests cover required interface keys and every exposed settings label (English resource completeness).

Verification performed:

- `npm run typecheck` — passes.
- `npm run check` — Biome lint/format/import checks pass.
- `npm test` — 218 unit/integration tests across 26 files pass, including three new audio feedback-cue tests and four UI localization resource tests, plus all Phase 1–5 suites.
- `npm run build` — production build succeeds.
- Headless browser screenshots:
  - Main menu renders title, subtitle, six actions, focus ring, hints, and version.
  - Gameplay HUD renders training exercise/objective/progress, speed, and pause hint without stray widgets.
  - Ranked Prologue HUD renders timer, checkpoint count, split, and speed.
- Browser CDP verification:
  - Keyboard navigation moves through menu items; Enter starts Training; HUD shows exercise 1/10; movement completes the exercise and shows a queued checkpoint toast; pause menu appears with Resume/Restart/Settings/Abandon.
  - Settings opens from pause; category tabs, setting rows, and values render; Left/Right adjusts numeric settings with focus preserved across re-render; Accessibility tab toggles Reduced Motion and High Contrast classes on the UI root; Back returns to the pause context.
  - Credits and records screens render; results flow shows mode/duration/actions; retry or main-menu navigation returns to the correct state.
  - Ranked session timer HUD updates, checkpoint toast appears, and split data is displayed.

Exit criteria:

- [x] Primary gameplay states have appropriate presentation: main menu, loading, gameplay HUD, pause, settings, results, credits/records, and error states all render.
- [x] UI reflects authoritative gameplay state: HUD derives from Speedrun/Training/Interaction/Player snapshots; results derive from Gameplay Session results; settings read/write through SettingsManager.
- [x] Accessibility preferences are respected: Reduced Motion classes/animation policy, high contrast, large text, UI scale, focus visibility, ARIA labeling, keyboard navigation, and live-region feedback are implemented and browser-verified; camera already honors Reduced Motion.
- [x] Initial localization resources contain required strings: English resource completeness is covered by tests for all UI keys and setting labels.

Known limitations and deferred integration:

- Mode Selection/local record persistence, Continue, and browser-exit handling are placeholders or omitted; records screen currently reports that no records exist.
- Some HUD widgets from the full spec (section progress, directional/runner-vision indicators, tutorial guidance, crosshair) are deferred; interaction prompts and training objectives are implemented.
- Settings presentation exposes all registry controls, but some underlying values (music volume, gamepad dead zones, HUD section toggles, tutorial/gameplay hints) are not yet consumed by their target systems; display settings are hidden as unsupported.
- Audio uses procedural cues only; no music, ambience, footsteps, or asset-based mix yet.
- Localization ships English only; additional languages and RTL layout remain deferred.
- Screen-reader support is partial (labels/live regions/focus trap) and has not been tested with an actual AT/browser combination.
- Gamepad navigation shares the Input System action path and is covered by input resolver tests, but was not exercised with physical hardware in this environment.
- `F2`/`F3` are development-only diagnostics and must be removed or gated from release configuration; the diagnostic status overlay remains a development tool.

### Phase 7 — Progression and Long-Term Systems

**Goal:** Make repeated play meaningful and measurable.

**Status:** Complete (2026-11-17).

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

Implemented and verified:

- Shared domain-event envelope with stable event identity, source, session/mode context, payload helpers, and deterministic deduplication across long-term systems.
- Statistics (`StatisticsSystem`):
  - Initial statistic catalog covering movement, training, speedrun, interaction, exploration, and progression counters.
  - Session, mode, and lifetime scopes; sum/count/maximum/minimum/latest aggregation; finite-value validation; event-id deduplication.
  - Session lifecycle aggregation (duration, completed sessions, longest session), recent session summaries, and immutable snapshots.
  - Persistence through the Save System `statistics` store; reload restoration covered by tests.
  - Lifetime statistics and recent sessions are presented in the Local Records screen.
- Achievements (`AchievementSystem`):
  - Eleven initial definitions across training, speedrun, movement, interaction, and progression categories with stable title/description localization keys and rarity metadata.
  - Event, counter, threshold, milestone, and achievement-reference conditions; condition groups (`all`/`any`); prerequisites with cycle/unknown-reference validation.
  - Event-id deduplication, idempotent unlock validation, progress computation, snapshots, and persistent records in the `achievements` store.
  - Unlock notifications through toasts and procedural audio cues; unlock events are consumed by Progression.
- Progression (`ProgressionSystem`):
  - Player progression model: training completion, campaign completion/best Prologue time, content unlock state, permanent milestones, play-time/statistics summary, and consumed achievement inputs.
  - Declarative content definitions (ten Training exercise unlocks with a prerequisite chain, Prologue, Ranked Prologue) and six milestone definitions.
  - Deterministic unlock/milestone rule engine supporting exercise/level completion, achievement inputs, milestones, count thresholds, and Prologue completion.
  - Event-driven idempotent updates from Training, Speedrun, Level, Session, Achievement, and Tutorial events; startup reconciliation; revisioned snapshots; persistence in the `progress` store.
- Tutorial (`TutorialSystem`):
  - Eight-step initial progression (start Training, move, jump, slide, vault, wall run, wall jump, interact) driven by authoritative gameplay events with restart-safe/deduped progress, completion event, and persistence in the `tutorial` store.
- Speedrun records (`SpeedrunRecordStore`):
  - Validated local run records, fastest-first sorting with deterministic tie-breaking, personal-best lookup, duplicate protection, recent records, and persistence in the `speedrun` store.
  - `SpeedrunSystem` automatically records valid finished runs.
- Presentation:
  - Main menu shows persistent progress summary (Training, Prologue, achievements).
  - Local Records screen now presents Prologue records/PB, progression summary, tutorial completion, lifetime statistics, and unlocked achievements.
  - Achievement/milestone/content/tutorial notifications use the existing toast queue and audio feedback.
- Application integration:
  - Long-term systems initialize after Save System setup and before UI creation, using repositories when persistence is available and in-memory fallbacks otherwise.
  - Normalized gameplay events are routed through Statistics, Achievements, Tutorial, and Progression with cascade handling for achievement/tutorial events.
  - Session analytics track start/finish, distance, maximum speed, checkpoint count, falls/recoveries, and Speedrun attempt/completion/medal/clean/invalid events.
  - Training exercise starts/completions, Prologue level completion, checkpoint activation, interactions, movement mechanics, and session lifecycle feed progression/achievements/statistics.
  - Development-only QA hook (`window.__glassline`) is exposed in dev builds for diagnostics.

Verification performed:

- `npm run typecheck` — passes.
- `npm run check` — Biome lint/format/import checks pass.
- `npm test` — 238 unit/integration tests across 32 files pass, including Statistics 4, Achievements 5, Tutorial 2, Progression 5, Speedrun records 3, and a fake-IndexedDB long-term persistence reload integration test.
- `npm run build` — production build succeeds.
- Browser verification (fresh Edge profile, CDP):
  - Main menu showed persistent summary (`Training 1/10`, `Prologue complete`, `Achievements 1/11`) after a page reload.
  - Training session movement completed exercises, unlocked `first_steps`, activated a checkpoint, and recorded movement/tutorial/statistics events.
  - Local Records screen displayed no-runs empty state, progression summary, tutorial 3/8, lifetime sessions/play-time/distance, movement counters, checkpoint count, and the unlocked achievement.
  - Completing Prologue through the dev finish path set `Prologue complete`; after a full page reload the state remained.
  - Statistics matched observed authoritative actions (one jump recorded as one jump, distance/checkpoints reflected gameplay, sessions/completed sessions incremented).
  - Achievement toasts/cues and tutorial step notifications are emitted through the presentation layer.

Exit criteria:

- [x] Progress is consistent after reload: Save repositories restore progression, achievements, tutorial, statistics, and Speedrun records; covered by the fake-IndexedDB reload integration test and browser reload checks.
- [x] Repeated events do not duplicate progress: Statistics/Achievements/Tutorial deduplicate event ids, Progression uses structural idempotence plus event ids, and duplicate event tests cover each system.
- [x] Achievements unlock from authoritative conditions: evaluation consumes only validated domain events/results; unit tests cover counts, thresholds, prerequisites, compound conditions, and tutorial events.
- [x] Statistics match authoritative gameplay events: aggregation is event-driven with explicit units/definitions; session/lifetime values and browser checks match observed gameplay.

Known limitations and deferred integration:

- Content unlock rules are evaluated and persisted, but the Training session/UI does not yet gate exercise selection by unlocks; Training currently runs the ten-exercise set. Applying unlocks needs the Training Selection UI/content split.
- The initial achievement set (11) covers representative condition types but not the full long-term catalog; there is no dedicated achievements screen/notification history UI, and hidden-achievement presentation is generic.
- Statistics presentation is limited to the Local Records summary; per-mode/query screens and speedrun statistics-summary references are not exposed.
- Speedrun records are local-only with no delete/export/detailed-run UI; personal bests are displayed through records/progression summaries.
- Tutorial progression is automatic event tracking; contextual in-game hints are notifications only.
- Save schema version was not bumped because the required object stores already existed in `GlasslineSaveData`; future payload migrations still need end-to-end migration tests.
- No online leaderboards, cloud save, accounts, multiplayer, ghost replay, or advanced progression systems (explicitly deferred).
- Development diagnostics (`F2`, `F3`, `window.__glassline`) remain dev-only and must not ship in release UI.

### Phase 8 — Stabilization

**Goal:** Prepare the initial release.

**Status:** Complete — initial release candidate (2026-11-17).

Tasks and results:

- **Full gameplay regression:** Chromium headless full-route Prologue speedrun from spawn to finish completed all five sections/checkpoints in order, produced a valid Gold run (5.663s), rendered results with splits, and persisted the record/PB across reload. Training was exercised in-browser through the first six exercises; the ten-exercise completion path is covered by the TrainingSystem integration test. Pause/resume, restart (player and exercise reset), abandonment, focus-loss input release, and results/menu transitions were exercised.
- **Browser compatibility:** Chromium (Microsoft Edge, headless, WebGL2/SwiftShader) passed the full E2E flow. Firefox 160 headless reached the main menu with the real UI, progress summary, and persistence initialization through WebDriver Marionette; gameplay/WebGL could not be exercised in this host environment because Firefox renderer processes crash under the sandbox/software-renderer constraints. Safari 27 WebDriver is present but `Allow Remote Automation` is disabled and cannot be enabled non-interactively in this environment. See Residual risks.
- **Performance profiling:** Headless Edge at 1280×720 measured ~54 FPS over five seconds with 35 draw calls and 420 triangles; the fixed 60 Hz simulation remained deterministic, with no per-frame persistence writes. Repeated Training retry cycles produced no cumulative renderer geometry/program growth after level unload; dropped fixed-step time occurred only during loading/restart transitions (catch-up protection bounded by the loop configuration).
- **Memory and resource lifecycle:** JavaScript heap stayed around 20–23 MB across menu/gameplay/restart cycles. After five retry cycles and return to menu, forced-GC DOM nodes dropped from 460 to 125 with 31 event listeners; level geometry, materials, colliders, and scene objects were released, and renderer geometries returned to zero. No leak was observed in repeated session lifecycle tests.
- **Persistence migration tests:** IndexedDB structural migration v1→v2 is covered by an automated test that preserves existing data; malformed settings and malformed long-term domain payloads are covered by automated recovery tests; browser corruption injection recovered to a clean main menu with defaults and no fatal overlay, and settings persistence recovered on the next committed update. Legacy Speedrun records written with monotonic `completedAt` values are normalized on load to a wall-clock date. Logical save-data version remains 1; no historical logical migrations exist yet.
- **Critical persistence regression fixed:** domain-event IDs were sequence-based and reset on page reload while processed IDs were persisted, causing new events after reload to collide with old IDs and be silently deduplicated (lost checkpoints/statistics/progression). Event IDs now use a random UUID identity; a regression test covers restoration of legacy processed IDs and acceptance of new post-reload events.
- **Input and focus edge cases:** window blur releases held input (move/speed drop to zero), visibility loss releases held keys, Tab focus remains trapped inside the active screen, Escape pause/resume works, and `R` restart resets the player position and Training exercise while creating a fresh Analytics session.
- **Accessibility checks:** accessibility tree exposes all menu actions with names; screens use dialog/aria-modal and tab roles; keyboard focus trap and live regions are present and browser-checked. Menu buttons now carry explicit `aria-label` values so CSS arrow decoration is not announced. High contrast, large text, reduced motion, and UI scale classes were verified; actual screen-reader testing remains outstanding.
- **UI scaling and localization checks:** 800×600 viewport with UI scale 1.4 and large text produced no horizontal/vertical overflow; the canvas resized to the viewport; English resource completeness is covered by localization/ui tests. All UI strings used by the new screens are keyed/localized.
- **Error handling:** malformed settings fall back to defaults and are reported; corrupt long-term payloads initialize fresh systems without blocking startup; settings recover after a successful save; storage-unavailable/fatal paths remain guarded; error paths do not leave partially initialized gameplay.
- **Final acceptance testing:** `npm run validate` passes (typecheck, Biome, **247 tests in 34 files**, production build). Browser acceptance verified: full Prologue speedrun with all checkpoints and persistence; progression/achievements/statistics/records screens; reload consistency; corrupted-save recovery; accessibility/focus/scaling checks; performance and lifecycle sampling.

Notable stabilization fixes:

- Random UUID domain-event identity to survive page reloads and prevent cross-reload deduplication loss.
- Wall-clock `completedAt` for Speedrun records and normalization of legacy monotonic timestamps.
- Medal statistics counted as count instead of summing medal ranks.
- Stale statistics events are consumed on rejection and cannot replay into a later session with a reused session ID.
- Explicit accessible names for menu buttons.
- Regression tests for persistence corruption, stale sessions, legacy event IDs, record date repair, medal aggregation, and event identity.

Exit criteria:

- [x] All critical acceptance criteria pass: full required initial-release feature set is implemented; core gameplay and full Prologue route are browser-verified; Training completion logic is automated-test verified; menus/HUD/results/records function.
- [x] No unresolved critical gameplay blockers remain: the reload event-ID collision (silent progress/statistics loss) and record-date/medal issues were fixed; no open blocker was found in the final regression.
- [x] Persistence survives reload and supported migration scenarios: reload persistence is verified automatically and in-browser; structural migration, corrupt payloads, and legacy record dates are tested. Only save-data version 1 is supported at this time.
- [x] Core gameplay is stable in the verified environment: Chromium desktop passes the full E2E; Firefox/Safari gameplay verification remains environment-limited (see Residual risks). Desktop Chromium (Chrome/Edge) with WebGL2 is the initial verified browser target.

Residual risks / limitations:

- Firefox gameplay/WebGL and Safari gameplay were not fully exercised in this environment (Firefox renderer sandbox crash; Safari Remote Automation disabled). The UI/menu boot path passed in Firefox. These remain pre-release compatibility risks if Firefox/Safari are in the supported matrix.
- Real screen-reader/hardware gamepad/device testing has not been performed; accessibility was verified through ARIA/live-region inspection, keyboard focus testing, and preference classes. Physical gamepads were unavailable (gamepad path shares the input resolver and has unit coverage).
- Performance was profiled in headless software WebGL; GPU/desktop-vsync performance on target hardware should be spot-checked.
- Logical save-schema migrations beyond version 1 do not exist yet; unsupported newer-schema payloads may be treated as recoverable fresh data rather than preserved indefinitely.
- Visual/audio regressions still rely on manual verification; automated coverage is dominated by logic/integration tests.
- Content unlock rules remain evaluated/persisted but Training selection gating is still deferred (as recorded in Phase 7).
- Deferred features (ghost replay, online leaderboards/cloud/accounts/multiplayer, advanced traversal/audio, RTL, remote analytics) remain out of initial-release scope.

---
### Release Polish (post-Phase 8)

**Goal:** Turn the stabilized candidate into a presentable initial release without changing validated gameplay contracts.

**Status:** Complete (2026-11-17).

Implemented:

- **Initial release content identity:** the authored arenas are promoted from verification content to release content and renamed for players:
  - `Training — Movement Yard` (technical id remains `training_test`).
  - `Prologue — Rooftop Run` (technical id remains `prologue_test`).
  - Internal IDs and Speedrun route IDs are intentionally retained so existing save data, route validation, tests, and progression identifiers remain valid.
- **Level presentation layer:** `LevelDefinition` now supports optional visual decorations and environment settings. The validator checks decoration sections/dimensions/opacity and fog/light ranges; the content loader instantiates decoration meshes without colliders and applies level-owned sky/fog/sun/hemisphere values; `RenderScene` restores its default atmosphere when a level unloads.
- **Training course dressing:** start/finish gates, route lane markings, start/finish lines, training signage, scaffold frame, traffic cones, checkpoint beacons, and a surrounding city silhouette with lit window accents.
- **Prologue rooftop dressing:** dusk skyline with lit windows, construction cranes, rooftop ventilation units and pipes, section signage, checkpoint beacons, edge trim, finish gate/stripes, and cool atmospheric fog.
- **Tutorial HUD guidance:** Training now shows the next incomplete tutorial step and its instruction (`TUTORIAL · MOVE`, `TUTORIAL · JUMP`, etc.) in a dedicated HUD panel. It is localized, appears only in Training, hides when the tutorial is complete, and is presentation-only — Tutorial System remains authoritative.
- **Procedural atmosphere audio:** a low-volume ambience bed starts per mode (Training/Prologue) after the user gesture and stops when gameplay is shut down; it respects the SFX volume setting. Speed-scaled procedural footsteps play while grounded and moving, and stop during slides/airtime.
- **Player-facing naming:** results, level metadata, and session displays use `Training — Movement Yard` / `Prologue — Rooftop Run`; UI copy no longer calls the courses test ranges.
- **Regression coverage:** validator tests for decoration/environment support, scene atmosphere restoration, ambience/footstep audio tests, HUD tutorial localization key coverage, and updated level display-name expectations.

Verification performed:

- `npm run validate` passes: typecheck, Biome, **250 tests in 34 files**, production build.
- Browser (Chromium headless, WebGL2/SwiftShader):
  - Training shows the tutorial panel, level name `Training — Movement Yard`, skyline/decorated course, 77 draw calls / ~1k triangles; Prologue shows `Prologue — Rooftop Run`, dusk skyline with lit windows, 80 draw calls / ~1,068 triangles.
  - Level environment values applied at load and level unload restores defaults (covered by test); HUD tutorial updates as tutorial steps progress.
  - Trusted-gesture audio startup produced a running AudioContext, 3 ambience oscillators for Training; ambience/audio lifecycle is also unit-tested. Actual audible output cannot be assessed in headless automation.
  - Screenshots captured for menu, Training yard, and Prologue rooftop presentations.

Known limitations:

- Visual dressing uses procedural primitives, not final authored art assets; it is a cohesive stylized direction for the initial release, not a replacement for a full art pass.
- The initial release content is one Training course and one Prologue route; broader campaign content remains deferred.
- Ambience is a simple procedural oscillator bed; no mixing buses, reverb zones, or asset-based environmental sound.
- Tutorial guidance is HUD copy; contextual in-world hint markers remain deferred.
- Content-unlock gating for Training selection remains evaluated/persisted but not enforced in the exercise list (as recorded previously).
- Browser/AT verification limitations from Phase 8 remain unchanged.

---
### Reference Presentation Pass — Round 1 (2026-11-19)

**Goal:** align the presentation with the *Mirror's Edge* prologue reference
(design, graphics, sound). Reference record: `docs/VISUAL_REFERENCE_PROGRESS.md`.

**Status:** In Progress — graphics foundation complete, sound and route design
not started.

Implemented:

- **HDR post pipeline** (`src/rendering/PostPipeline.ts`): half-float MSAA target,
  GTAO, bloom, ACES tone mapping, split tone, grade, chromatic aberration,
  vignette, grain, dither, and highlight clipping.
- **Procedural sky and reflections** (`SkyDome.ts`): gradient, sun disc/glow,
  drifting cumulus, and PMREM sky environment for PBR reflections.
- **Lighting/atmosphere:** PCF soft sun shadows, hemisphere/ambient/rim fill, and
  level-owned sky palette, sun angle, sun intensity, and fog.
- **Procedural materials** (`MaterialLibrary.ts`): runtime canvas PBR textures for
  roof/concrete/plaster/facade/metal/asphalt/red paint with world-space triplanar
  mapping, plus glass/emissive families.
- **Instanced decoration batching** in `LevelContentLoader`; 1,657 instances in 27
  batches for the Prologue.
- **Prologue presentation:** 22 m rooftop with low parapets and void kill
  volumes; close west glass tower with orange billboard, bracing, red ladder and
  handrail; dense near facades, skybridge, crane, billboards, lower roofs, and a
  64-building skyline; skylight, solar array, AC/duct/pipe kit, bulkhead, tank,
  antenna, route paint, checkpoint chevrons, start/finish gantries, lit terminal.
- **First-person viewmodel** (`ViewModel.ts`): sleeves, forearms, gloves, red
  wraps, fingers; idle/run/air/slide/landing/wall-run response; dedicated layer-1
  camera light.
- **Capture/metrics tooling** (`tools/capture/`): deterministic CDP screenshots and
  reference-frame statistics. Round evidence in `docs/evidence/visual/round-1/`.

Verification:

- `npm run validate`: typecheck, Biome, **250 tests in 34 files**, production build.
- Deterministic capture at the Prologue start is inside tolerance on 10/13
  reference metrics (luma 0.586 vs 0.615, std 0.265 vs 0.295, saturation 0.360
  vs 0.300, red 2.7 % vs 2.4 %). Open gaps: p95 0.895 vs 0.981, near-white 3.6 %
  vs 34.5 % (highlight headroom), sky area 60.1 % vs 43.3 % (open composition).
  An earlier hard highlight clip reached 12/13 but flattened surface detail and
  was replaced with a gentler shoulder.
- Live gameplay on Apple M1 Pro / ANGLE Metal at 1600×900: 60 fps (16.6 ms mean,
  16.8 ms p95), 27 batches / 1,657 instances / ~24k triangles.
- Synthetic input: forward movement, jump state/vertical speed, and fall-off-roof
  respawn to the rooftop checkpoint verified; no console errors.

Known limitations:

- Sound is unchanged (the simple oscillator ambience/footstep bed).
- The Prologue route is still one straight rooftop lane; it lacks the reference's
  leaps, drops, climbs, and branching.
- Graphics remain stylized: box facades, soft clouds, no billboard typography,
  no local reflections, no motion blur, no animated world. Sunlit whites do not
  clip as much as the reference (near-white 3.6 % vs 34.5 %); this needs stronger
  real lighting/content next round.
- Training still uses the old yard and flat skyline dressing.
- The post pipeline has no quality tiers/dynamic resolution yet.

---
### Reference Presentation Pass — Round 2 (2026-11-19)

**Goal:** replace the placeholder audio with a reference-grade procedural mix
(design, graphics, sound axis 3).

**Status:** Implemented, integrated, measured; human listening pass pending.

Implemented:

- **Audio graph and buses:** master → mix trim → compressor/limiter →
  destination, with environment, movement, parkour, UI, music, and radio buses,
  a shared convolutional reverb send, and per-bus gain control.
- **Procedural buffers:** deterministic white/pink/brown noise and stereo impulse
  responses generated once and cached; no samples or downloaded assets.
- **Surface-aware footsteps:** band-passed noise, body thump, high texture, and
  metal/glass ring/tick selected from the SurfaceRegistry classification
  (`concrete`, `metal`, `rubber`, `glass`, `asphalt`, explicit fallback).
- **Parkour set:** impact-scaled landings, jump/wall-jump/vault whooshes, and
  continuous slide/wall-run filtered-noise loops that stop on state change,
  pause, and shutdown. Footstep interval now follows actual speed.
- **Ambience:** wind, distant city, rooftop air, and low hum layers with
  Training/Prologue profiles; wind responds to speed and breathes while idle.
- **Score:** sparse four-chord pad plus a quiet moving arpeggio, started with
  gameplay and scaled by speed; `audio.music_volume` is now applied.
- **Radio:** procedural static and signal tones with smooth environment ducking;
  plays at Prologue start and on section entries.
- **Lifecycle:** pause/resume stops contact loops and ducks ambience/music;
  voice limits and cleanup prevent node accumulation.
- **Verification tools:** offline 24 s demo render, BS.1770-style metrics,
  live post-limiter analyser probe, and 30 dedicated audio tests.

Verification:

- `npm run validate`: typecheck, Biome, **268 tests in 35 files**, build.
- Offline demo (24 s) vs the reference Prologue 500–800 s segment measured by the
  same script:

  | Metric | Demo | Reference | Target | Band |
  |---|---:|---:|---:|---|
  | Energy < 500 Hz | 0.896 | 0.909 | 0.85–0.94 | PASS |
  | Energy > 2 kHz | 0.060 | 0.026 | 0.03–0.08 | PASS |
  | Gated loudness | −26.0 LUFS | −26.6 LUFS | −31…−26 | PASS |
  | Sample peak | −5.26 dBFS | −1.94 dBFS | ≤ −3 dBFS | PASS |
  | Short-term p95−p5 | 22.9 dB | 12.9 dB | 18–26 dB | PASS |

- Live probe after a trusted gesture: audio running, 3 ambience sources, music
  active, all seven buses present; deterministic footstep/landing stress sequence
  peak −3.7 dBFS post-limiter; no console errors.
- Evidence: `docs/evidence/audio/round-2/` (mix WAV, metrics, live probe,
  waveform/spectrogram) and `docs/VISUAL_REFERENCE_PROGRESS.md`.

Known limitations:

- No human listening pass has been performed; headless metrics do not prove
  subjective character, separation, or absence of clicks.
- No spatial emitters/listener/occlusion; all current sources are player-local or
  bus-routed.
- The score is a simple pad plus arpeggio with no section/tension layers; radio
  has no speech content.
- Continuous loops do not crossfade between surface materials.
- The demo peak is conservatively low versus the reference; transient headroom
  can be raised after listening.

---
### Reference Presentation Pass — Round 3 (2026-11-19)

**Goal:** move the Prologue design from a flat 25 m corridor toward the
reference's rooftop traversal beats without breaking checkpoint/speedrun
contracts.

**Status:** Implemented, integrated, verified by physics and route integration;
reference-scale route length remains open.

Implemented:

- **Vertical route:** upper roof (y = 0) → 1 m drop through the north parapet gap
  → lower service roof (y = −3) → 2.4 m sprint gap → 15-step 0.15 m stair climb
  → 3.4 m skybridge (y = −0.9) → finish roof (z = −62).
- **Checkpoint/section migration:** all five checkpoint IDs and their order are
  unchanged; positions moved to the new beats (`cp_skybridge` z = −46,
  `cp_finish` z = −56), with matching spawn points, section triggers, and finish
  trigger at z = −60.
- **Safety:** void kill volumes moved below the lower route; the upper roof drop
  and lower-gap fall still respawn at the last checkpoint.
- **Presentation:** construction scaffold, red route paint, hazard edge, bridge
  rails/lights, lower-deck AC/duct/crate kit, floodlights, finish terminal/sign,
  and lower background roof for drop depth. The decorative skybridge moved to
  the distant skyline so it no longer occludes the playable route.
- **Shadow coverage:** the sun shadow frustum now covers the lower route and
  finish roof; the deprecated `PCFSoftShadowMap` setting was replaced with
  `PCFShadowMap`.
- **Tests:** new `prologue-traversal.test.ts` builds every Prologue collider and
  physically sprint-jumps the gap, climbs the stairs, and crosses the bridge to
  the finish roof; `prologue-integration.test.ts` waypoints cover the extended
  checkpoint chain.

Verification:

- `npm run validate` green: typecheck, Biome, **270 tests in 36 files**, build.
- Physical traversal: 2.4 m gap cleared, 2.1 m stair climb completed, bridge and
  finish reached (z < −58, y > −1.2).
- Browser: upper-roof drop settles at y ≈ −2.11 on the lower deck; lower route,
  stairs, bridge, and finish render with no console errors.
- Evidence: `docs/evidence/visual/round-3/` (start, drop, lower, bridge, finish,
  metrics) and `docs/VISUAL_REFERENCE_PROGRESS.md`.

Known limitations:

- Route is ~66 m with one explicit gap, versus the 180–220 m reference-scale
  target; vertical delta is 5.1 m versus ≥ 8 m.
- The 0.15 m stair risers are reliable under autostep but slow; a parkour line
  needs jump platforms or a tuned ramp.
- Section IDs for boundary geometry are still inferred from z; surface metadata
  on a boundary can deactivate a beat early.
- Lower roof remains broad and partially empty; the gap can read as a black void
  from the deck edge.
- No sound or UI changes this round; the Round 2 mix still awaits a human
  listening pass.

---
### Reference Presentation Pass — Round 4 (2026-11-19)

**Goal:** align the shell and in-world typography with the reference's editorial
design language and add speed feedback.

**Status:** Implemented, integrated, captured; motion-blur calibration and menu
backdrop remain.

Implemented:

- **Paper/ink UI:** ivory split-panel main menu, pause, settings, results, and
  records; black uppercase type, hard red rules, solid-ink selected rows,
  red-focused settings controls. High-contrast, large-text, and reduced-motion
  rules updated for the new surfaces.
- **Minimal HUD:** dark backdrop panels removed; timer, checkpoint progress,
  objective, speed, and hints are white type with a soft shadow and a single red
  rule. Added the reference-style centre dot; tutorial panel is ivory with ink
  text.
- **Menu cleanliness:** first-person body hidden outside gameplay.
- **Canvas signage:** `plane` decoration shape + `MaterialLibrary.getSign`
  (1024×512 canvas, background/accent/text, diagonal tint, small network line)
  used for the orange **RUN** billboard, section indices `01`–`05`, and the
  **FINISH** billboard. Cached materials/textures and owned plane geometry are
  disposed with the level.
- **Speed blur:** grade pass samples a radial blur driven by normalized player
  speed; idle frames are unchanged.
- **Tooling:** capture script supports `--menu`, `--settings`, and `--run <ms>`.

Verification:

- `npm run validate`: typecheck, Biome, **270 tests in 36 files**, build.
- Captures: main menu, settings, start with visible RUN/section signs, finish
  roof, and the lower route; no new console errors.
- Start frame remains 10/13 image metrics in tolerance.

Known limitations:

- Menu right side is procedural sky only; no city/level preview or key art.
- Sign copy is placeholder typography, not a full brand system.
- Motion blur is implemented but not separately calibrated at sustained sprint
  speed; headless moving-HUD captures need a more reliable input-focus path.
- Route length, stair climb, and the audio listening pass remain open.

---
### Reference Presentation Pass — Round 5 (2026-11-19)

**Goal:** replace the empty menu sky with a reference-like prologue vignette
without coupling the menu to gameplay or level runtime.

**Status:** Implemented, captured, verified; final colour/parallax polish remains.

Implemented:

- **MenuBackdrop:** visual-only rooftop + glass tower + city, with parapets,
  mullions, diagonal braces, orange RUN signs, window grids, roof route paint,
  AC units, and layered skyline. No physics, colliders, or level runtime.
- **Flow integration:** `RenderScene` owns the group and toggles it for boot,
  main menu, loading, results, and error; gameplay and pause keep it hidden.
- **Camera:** `CameraSystem.setPresentationPose` frames the vignette at
  `(0, 2.1, 11)`; the application applies the pose outside gameplay and leaves
  the gameplay camera untouched during pause/resume. First-person body remains
  hidden outside gameplay.
- **Menu contrast:** paper gradient fades by 66–72% rather than 100%, exposing
  the city instead of washing it out.

Verification:

- `npm run validate`: typecheck, Biome, **270 tests in 36 files**, build.
- Menu capture shows the city vignette and retains the paper/ink hierarchy;
  gameplay capture confirms the backdrop is hidden.
- Start-frame metrics unchanged at 10/13.

Known limitations:

- Static simplified set, not the real loaded Prologue; no animated character,
  traffic, or camera drift.
- Lighting/colour at the paper-to-city transition is still bright and needs a
  final reference comparison.
- Route length, stair climb, listening pass, and world detail remain open.

---
### Reference Presentation Pass — Round 6 (2026-11-19)

**Goal:** extend the Prologue beyond the low finish roof with a vertical finale
and move the route toward the reference-scale target.

**Status:** Implemented, physically verified, captured; route is ~136 m, still
short of 180–220 m.

Implemented:

- **Final route:** old finish roof → 2.3 m gap → 2.4 m beam at y = −2.0 →
  eight 0.8 m jump platforms (2.0 m gaps) → 16 m high finish roof at y = 5.2.
  Finish gate/terminal/sign at z = −130/−128; `cp_finish` moved to the beam
  (z = −66); `trigger_finish` moved to the high roof, IDs/order unchanged.
- **Ascent construction:** scaffold standards, ledges, diagonal braces, red
  caps, work lights, edge paint, support columns, lower city roof.
- **Old finish deck:** now a transition roof with `05 / ASCENT`; new tower has
  `06 / FINISH`; final billboard is dark for contrast.
- **Environment:** shadow frustum extended to z ≈ −140; far central tower moved
  from −140 to −160 so it no longer intersects the finish roof.
- **Tests:** new physical ascent test (beam + eight jumps + high-roof landing);
  integration waypoints updated for `cp_finish` and the high-roof finish.

Verification:

- `npm run validate`: typecheck, Biome, **271 tests in 36 files**, build.
- Physical test exposed a solid south parapet blocking the landing; split into
  two parapets with a 3.6 m opening and re-verified.
- Browser captures at beam, mid-ascent, and high roof; start metrics remain
  10/13.

Known limitations:

- ~136 m vs 180–220 m target; one long jump chain rather than another turn.
- Platforms float over a dark void; high roof is sparse; jump rhythm is
  repetitive; no mid-climb checkpoint without changing the five-ID contract.
- Audio listening and final motion/menu calibration remain open.

---
### Reference Presentation Pass — Round 7 (2026-11-19)

**Goal:** bring the route into the reference-scale 180–220 m band without
changing the five checkpoint IDs or section order.

**Status:** Implemented, physically verified, captured; ~220 m and 8.2 m
vertical. Mid-route variation and final art/audio polish remain.

Implemented:

- **Catwalk U-turn:** high roof exits east onto a 3.2 m catwalk, crosses a 10 m
  turn platform, and returns on a parallel span; blue glass rails, red route
  paint, support masts, cables, work lights, `07 / TURN` marker.
- **Finish gate/banner:** moved to z = −133; centered dark FINISH banner in the
  gate; finish trigger moved with it. `cp_finish` remains on the beam.
- **Connections:** high-roof east parapet split into three segments for the two
  catwalk openings; turn platform/rail seams fixed so a full 180° walk is
  possible.
- **Environment:** near east tower moved west, far-skyline boxes near the turn
  skipped, shadow frustum widened, lower city roof under the catwalk.
- **Tests:** new physical catwalk walk-out/turn/return test; integration
  waypoints include both catwalk legs and the high gate.

Verification:

- `npm run validate`: typecheck, Biome, **272 tests in 36 files**, build.
- Integration passes five checkpoints and the relocated finish.
- Browser captures at outbound/return/gate; start frame 10/13; ~60 fps.

Known limitations:

- Length is partly earned by an out-and-back catwalk, not another vertical
  sequence.
- Turn view is partly blocked by a tower wall; catwalk rails/dashes repeat for
  ~80 m; high roof sparse.
- No mid-climb/mid-catwalk checkpoint without changing the five-ID contract.
- Audio listening and final motion/colour calibration remain open.

---
### Reference Presentation Pass — Round 8 (2026-11-19)

**Goal:** polish the finale and make altitude audible without changing the route
contract.

**Status:** Implemented, captured; turn-view art and listening pass remain.

Implemented:

- **Catwalk detail:** suspended container on four cables, deck seams, red
  chevrons/hazard plate at the turn, cable drums, work lights; corrected
  `06 / ASCENT`/`07 / TURN` labelling.
- **High roof:** AC/service box, crates, mast with cool light, solar panel, vent
  drum, and service kit around the gate; finish banner remains centred.
- **Turn view:** near east tower moved west, far-skyline boxes near the turn
  skipped, far central tower moved to z = −190. South view improved but still
  partly blocked by a skyline face.
- **Sound:** `AudioMovementState.altitude`; ambience wind gain and cutoff now
  rise above the lower roof (ratio from ~1.5 m to ~7.5 m), independent of speed.
  Code-level mix change only; no human listening verdict yet.
- No new colliders, checkpoint changes, or route-length changes.

Verification:

- `npm run validate`: typecheck, Biome, **272 tests in 36 files**, build.
- Catwalk tests unchanged and green; captures show the new finale dressing.
- Performance **60.2 fps**; start frame 10/13.

Known limitations:

- Turn south view still has a mostly blank skyline wall.
- Catwalk rails/seams remain repetitive; high roof still sparse vs the start.
- Altitude wind needs ear balancing against footsteps/music.
- No mid-climb/mid-catwalk checkpoint; uniform jump rhythm and final
  menu/motion calibration remain.

---
### Reference Presentation Pass — Round 9 (2026-11-19)

**Goal:** turn the long catwalk into a traversal beat and open the turn view.

**Status:** Implemented, physically verified, captured; mid-route safety and
final art/audio remain.

Implemented:

- **Catwalk gap:** outbound span split at x 23.8…26.0 with a 2.2 m gap, red edge
  plates, and a rail-mounted `GAP / 2.2M` sign. Physical test now jumps the gap
  with held input and continues through the turn/return.
- **Turn vista:** far-skyline exclusion widened to z > −260; a second distant
  tower crane (x 74) gives the open sky a silhouette; floating red accent removed.
- **No route/checkpoint changes:** length ~220 m, 8.2 m vertical, five IDs.
- Round 8 dressing and altitude wind retained.

Verification:

- `npm run validate`: typecheck, Biome, **272 tests in 36 files**, build.
- Catwalk gap/turn/return test green; integration route unchanged.
- Performance 60.1 fps; start frame 10/13; captures at gap/turn.

Known limitations:

- Turn view is open but sparse; crane is a distant silhouette.
- Gap is punishing without a mid-catwalk anchor; falls return to the beam.
- Catwalk still repeats; one traversal beat only.
- No dedicated catwalk surface audio; listening/motion/menu calibration remain.

---
### Reference Presentation Pass — Round 10 (2026-11-19)

**Goal:** make the catwalk safe to retry and audibly distinct, and give the open
turn a horizon.

**Status:** Implemented, verified in-browser and by tests; listening and authored
turn architecture remain.

Implemented:

- **Fall-only anchor:** `RespawnManager.setEmergencyAnchor`; Application sets a
  high-route anchor at (0, 6.075, −121) when above y 4.6/past z −110 and clears
  it when grounded below y 3 at z > −112. Falls retry the catwalk without
  replaying the climb; no checkpoint IDs, splits, or triggers changed. Training
  excluded.
- **Catwalk metal surface:** new `surface_catwalk` (metal) on all four decks;
  footsteps/landings use the metal preset. In-browser surface probe confirms
  metal at ~6.1 m altitude.
- **Turn vista:** distant hero towers at z = −300/−318/−330 with red beacon,
  plus the existing crane; removed confusing red mast caps and moved a support
  mast out of the 2.2 m gap.
- **Tests:** two new respawn-anchor tests (precedence/clear + non-fall ignore);
  physical catwalk/gap/turn test unchanged and green.

Verification:

- `npm run validate`: typecheck, Biome, **274 tests in 36 files**, build.
- Browser anchor probe: destination `respawn_high_route`, then cleared on beam.
- 60.1 fps; start frame 10/13.

Known limitations:

- Anchor covers high route only; scaffold-ascent falls still return to the beam.
- Hero towers are boxes, not authored facades; metal footsteps are not
  listening-verified.
- One catwalk jump beat; no mid-climb safety; final menu/motion calibration
  remains.

---
### Reference Presentation Pass — Round 11 (2026-11-19)

**Goal:** make the turn horizon authored rather than blank boxes and add a
second, different catwalk traversal beat.

**Status:** Implemented, verified, captured; mid-climb safety/listening remain.

Implemented:

- **Hero towers:** `addBuilding` facades/window grids/roof props at z = −300/−318/
  −330; central 13 × 6.4 m GLASSLINE billboard, red beacon.
- **Return barrier:** 0.5 m collider at x = 34 across the return catwalk, with
  red/white face plates; physical test jumps it with held input.
- **No route/checkpoint changes:** ~220 m, 8.2 m vertical, five IDs/triggers.
- Round 10 anchor/metal surface retained.

Verification:

- `npm run validate`: typecheck, Biome, **274 tests in 36 files**, build.
- Catwalk test: gap + turn + barrier + return green; integration unchanged.
- Performance 60.1 fps; start 10/13; captures at turn/barrier.

Known limitations:

- Hero facades are 160+ m away; billboard is small; barrier stripes only partly
  legible.
- Two discrete catwalk obstacles, no lateral/detour choice.
- No mid-climb safety; scaffold falls return to the beam.
- Audio listening, final menu/motion/colour, high-roof density remain.

---
### Reference Presentation Pass — Round 12 (2026-11-19)

**Goal:** reduce retry cost on the scaffold climb without adding checkpoints.

**Status:** Implemented, verified in-browser and by tests; lateral catwalk/listening
remain.

Implemented:

- **Mid-ascent anchor:** grounded on platform 5 (top y=2.0, z=-98.7) sets an
  emergency anchor at (0, 2.875, -98.7); high-roof anchor still overrides; both
  clear when grounded below y=1 at z > -112. No checkpoint IDs/splits changed.
- **Visible pad:** red disc, cyan-capped posts, rail frame on platform 5; the
  oversized SAFE sign was removed to keep the jump sightline.
- **Tests:** respawn anchor precedence/clear tests; browser probe mid → high →
  cleared; physical catwalk test unchanged.

Verification:

- `npm run validate`: typecheck, Biome, **274 tests in 36 files**, build.
- Start frame 10/13; ~60 fps.

Known limitations:

- Platforms 1–4 still fall back to the beam.
- Pad may read as hazard; no text label.
- Lateral catwalk choice, listening pass, final menu/motion and high-roof density
  remain.

---
### Reference Presentation Pass — Round 13 (2026-11-19)

**Goal:** give the return catwalk a real route choice rather than one mandatory
barrier jump.

**Status:** Implemented, physically verified, captured; signposting/tradeoff and
listening remain.

Implemented:

- **Bypass:** 8 × 3 m metal deck at y=4.8 under the return span, opened through
  an 8 m rail gap, with two 0.2 m step ledges back up to the catwalk.
- **Choice:** direct barrier jump vs drop/run/step-up bypass; both converge.
- **Marking:** red pad/step paint and a BYPASS rail sign; barrier stripe plates.
- **Test:** bypass walk-up test added; five catwalk physics tests green.
- **No route/checkpoint changes:** ~220 m, 8.2 m, five IDs/triggers.

Verification:

- `npm run validate`: typecheck, Biome, **275 tests in 36 files**, build.
- 60.1 fps; start frame 10/13; captures at choice/bypass.

Known limitations:

- Bypass reads like a fall/void; entrance sign is too late.
- No reward/time tradeoff; direct jump is likely always faster.
- Bypass deck detail is plain; listening/turn landmark/high-roof density remain.

---
### Reference Presentation Pass — Round 14 (2026-11-19)

**Goal:** give the turn a close graphic landmark and add scale/detail to the high
roof.

**Status:** Implemented, captured, verified; visual balance and listening remain.

Implemented:

- **RUN billboard:** 8.7 × 2.9 m orange/red sign on a steel frame on the turn's
  outer east rail, facing the outbound approach; `07 / TURN` remains below.
- **High-roof helipad:** 5.4 m dark pad with white H bars and four cool edge
  lights north of the finish gate, off the approach path.
- **No route/checkpoint/collider changes:** ~220 m, 8.2 m, five IDs; bypass,
  anchors, and catwalk surfaces unchanged.
- Visual-only; 275 tests unchanged.

Verification:

- `npm run validate`: typecheck, Biome, **275 tests in 36 files**, build.
- 60.3 fps; start frame 10/13; captures at billboard/high roof.

Known limitations:

- Billboard is dominant and renders red in shade, obscuring part of the skyline.
- Helipad is oversized in the entry frame and decorative only.
- Bypass has no measured time/risk advantage; no new traversal beat.
- Listening pass, final menu/motion/colour, and start-roof detail remain.

---
### Reference Presentation Pass — Round 15 (2026-11-19)

**Goal:** verify the finale's sound separately from the prologue mix.

**Status:** Implemented, rendered/measured; human listening and live recording
remain.

Implemented:

- `renderHighRouteAudioDemo`: 14 s deterministic profile with altitude wind
  swell/lull/gust, metal catwalk footsteps, jump whoosh, metal landings, cable
  creak, 58/87 Hz hum, finish boom.
- `audio-render.mjs --high-route` and dev `window.__glasslineHighRouteAudioDemo`.
- Prologue render regression unchanged and 5/5.

Measured high-route: low share 0.853, high 0.040, LUFS −23.86, peak −4.83 dBFS,
per-second RMS range 24.4 dB; custom 5/5 bands. Per-second drop to −40.3 dB in
the wind lull.

Verification:

- `npm run validate`: typecheck, Biome, **275 tests in 36 files**, build.
- Evidence WAV/waveform/metrics in `docs/evidence/audio/round-15/`.

Known limitations:

- Synthesized demo, not live gameplay recording or human listening.
- High-route bands are authored here, not reference-derived.
- Visual balance/bypass tradeoff/final motion remain.

---
### Reference Presentation Pass — Round 16 (2026-11-19)

**Goal:** verify the live in-engine high-route sound, not only the offline demo.

**Status:** Implemented, measured; human listening remains.

Implemented:

- `audio-probe.mjs --high-route`: resets to start roof, measures live ambience,
  teleports to high roof, waits for wind ramp, measures metal footsteps/landing.
- `AudioManager.getDebugSnapshot()` exposes live `windGain`/`windCutoff`.
- Measured: wind gain 0.0131→0.0197, cutoff 263→418 Hz; RMS 0.0238→0.1240 (high
  includes 11 footsteps + landing); mid-band 0.008→0.114, high 0.116→0.028.
- No route/mix code changes.

Verification:

- `npm run validate`: typecheck, Biome, **275 tests in 36 files**, build.
- Live probe errors: none; offline profiles unchanged.

Known limitations:

- Analyser only, no WAV/human listening; high segment not ambience-only.
- Wind gain absolute difference modest; needs ear balancing vs music/radio.
- Visual balance/bypass/final motion remain.

---
### Reference Presentation Pass — Round 17 (2026-11-19)

**Goal:** break up the white start roof with low-cost amenity detail.

**Status:** Implemented, captured, measured; planting silhouette needs improvement.

Implemented:

- `foliage`/`soil` materials; three concrete planters with nine-cylinder hedges
  at x −6.5/6.8; west bench/back; off-route, visual-only.
- No route/checkpoint/audio changes.

Verification:

- `npm run validate`: typecheck, Biome, **275 tests in 36 files**, build.
- Start frame 10/13; 60.1 fps; captures at start/planter.

Known limitations:

- Close-up foliage reads as green cylinders/cups, not authored planting.
- Billboards/helipad balance, bypass tradeoff, listening/final motion remain.

---
### Reference Presentation Pass — Round 18 (2026-11-19)

**Goal:** bring the start frame's open-sky composition into the reference band.

**Status:** Implemented, metrics improved to 11/13; highlight headroom remains.

Implemented:

- 27 m overhead bridge at y=9/z=−6 with glass rails, supports, light-metal ribs,
  cool underside lights, red fascia, and hanging hoist; no collider.
- Sky share 57.7%→47.5% (ref 43.3%, tolerance ±12) → **PASS**; start frame
  10/13→**11/13**. Remaining watches: p95 highlight and near_white.
- No route/checkpoint/audio changes.

Verification:

- `npm run validate`: typecheck, Biome, **275 tests in 36 files**, build.
- 60.1 fps; catwalk/integration tests unchanged.

Known limitations:

- Bridge is visually dominant and may read as a ceiling.
- p95/near-white highlight gap; no human listening.
- Billboard/helipad, bypass tradeoff, high-roof density, final motion remain.

---
### Reference Presentation Pass — Round 19 (2026-11-19)

**Goal:** close the remaining highlight-headroom metrics without global clipping.

**Status:** Implemented; start frame reaches **13/13** reference metrics.

Implemented:

- Prologue atmosphere: pale sky/fog (`0xa9d3ee`/`0xe8f2fa`, near45/far340),
  horizon/zenith/cloud changes, sun 5.8.
- Grade: exposure 1.0, contrast 0.22, saturation 1.30.
- No geometry/route/audio changes.

Metrics (start frame): luma 0.6126/0.6152, p25 0.3714/0.3710, p95
0.9879/0.9806, near-white 21.1/34.5, deep-shadow 3.17/0.68, saturation
0.308/0.300, local contrast 0.269/0.285, sky 34.5/43.3, red 2.22/2.39 —
**13/13**.

Verification:

- `npm run validate`: typecheck, Biome, **275 tests in 36 files**, build.
- 60.2 fps; captures at start/lower/catwalk.

Known limitations:

- High-key look clips/washes some roof/route detail; near-white distribution is
  inside tolerance but not like-for-like.
- Haze reduces distant architecture; no human listening.
- Billboard/helipad balance, bypass tradeoff, high-roof density, final motion
  remain.

---
### Reference Presentation Pass — Round 20 (2026-11-19)

**Goal:** bring the Training yard shell/backdrop to Prologue presentation level.

**Status:** Implemented, captured; authored tower detail/parapet openness remain.

Implemented:

- Boundary walls light concrete + red coping (all four sides); no dark black
  horizon.
- Five material-based city towers with lit bands/roof mechanical; old skyline
  retained deeper.
- `TRAVERSAL`/`FINISH` board signs, section signs, `MOVEMENT YARD` east-wall
  sign, AC/duct/crate/pipe service kit; no route/collision changes.
- 275 tests unchanged; Prologue metrics unaffected.

Known limitations:

- Towers are simple boxes with striped bands; yard sign outside initial frustum.
- 3 m walls keep city above rather than through the yard; no Training reference
  metric suite.
- Billboard/helipad, bypass tradeoff, listening, final motion remain.

---
### Reference Presentation Pass — Round 21 (2026-11-19)

**Goal:** replace flat Training tower faces with authored facade grids and
balance Prologue accents.

**Status:** Implemented, captured; emissive-window tuning/listening remain.

Implemented:

- Training towers: inward/south floor slabs, window grids, vertical mullions,
  occasional warm windows, roof mechanical; five towers detailed.
- Turn billboard 8.7×2.9→7.0×2.5 m, lighter orange, narrower frame; helipad
  5.4→4.4 m with shorter H bars.
- No route/gameplay/audio changes; start frame remains 13/13.

Verification:

- `npm run validate`: typecheck, Biome, **275 tests in 36 files**, build.
- 60.2 fps; captures at Training/billboard/high/start.

Known limitations:

- Training windows are emissive boxes; some read as white panels, no real glass
  reflection. No Training reference metric suite.
- `MOVEMENT YARD` sign outside initial frustum.
- Human listening/clipped highlights/final motion-menu remain.

---
### Reference Presentation Pass — Round 22 (2026-11-19)

**Goal:** make Training windows read as reflective glazing and put the yard name
in the initial composition.

**Status:** Implemented, captured; real curtain-wall depth/listening remain.

Implemented:

- Window grids now use `glass`/`glass-far` with warm cells every seventh cell,
  emissive limited to warm; blue glazing replaces white checkerboard panels.
- Metal masts + red beacons above Training tower mechanical units.
- 7×1.05 m `MOVEMENT YARD` banner hung under the overhead pipe at z=−13.8,
  readable from start.
- No route/collision/audio changes; Prologue start remains 13/13.

Verification:

- `npm run validate`: typecheck, Biome, **275 tests in 36 files**, build.
- Prologue 60.3 fps; captures at Training/start.

Known limitations:

- Windows are still box geometry, not true curtain-wall/interior shader.
- Training has no reference metric suite; banner small; east-wall sign outside
  initial frame.
- Listening/clipped highlights/final motion remain.

---
### Reference Presentation Pass — Round 23 (2026-11-19)

**Goal:** give Training facades depth beyond flat window planes.

**Status:** Implemented, captured; interiors/listening remain.

Implemented:

- Every third floor gets a projecting concrete balcony band + 0.9 m glass rail
  on inward/south faces of all five Training towers.
- Existing glass windows/mullions/masts/banner/parapets retained.
- No route/collision/audio changes; Prologue start 13/13; 275 tests.

Known limitations:

- No doors/interior/furniture; close-up still geometric.
- Training has no reference metric suite; listening/clipped highlights/final
  motion remain.

---
### Reference Presentation Pass — Round 24 (2026-11-19)

**Goal:** make Training balconies inhabited and add city life.

**Status:** Implemented, captured; interiors/audio/listening remain.

Implemented:

- Corrected inward balcony projection (was into the tower body).
- Dark balcony doors + warm interior strips on inward/south balconies.
- `CityLife`: 18 instanced birds with circular orbits, banking and vertical bob;
  one draw call, no shadows, updated each frame.
- No route/collision/audio changes; Prologue start remains 13/13; 275 tests.

Known limitations:

- Doors are simple panels; no interiors/furniture.
- Birds are tiny silhouettes; no bird audio.
- Training has no reference metric suite; listening/clipped highlights/final
  motion remain.

---
### Reference Presentation Pass — Round 25 (2026-11-19)

**Goal:** add ambient motion to the menu/start canyon.

**Status:** Implemented, captured; reduced-motion/listening remain.

Implemented:

- Presentation camera drift (position/yaw/pitch sinusoids) outside gameplay.
- Static bridge hoist replaced by `CityLife` pendulum group (cable/load/cap) at
  (4.2,8.3,−6), sways ±0.045 rad Z / ±0.028 X.
- No route/collision/audio changes; Prologue 13/13; 275 tests.

Known limitations:

- Drift not reduced-motion aware/configurable; hoist has no audio/flex.
- Human listening/clipped highlights/bypass/final calibration remain.

---
### Reference Presentation Pass — Round 26 (2026-11-19)

**Goal:** identify the Training start on the floor and respect reduced motion in
the presentation camera.

**Status:** Implemented, captured; painted/worn surface and listening remain.

Implemented:

- Training 3.2×0.8 m MOVEMENT YARD floor mat + four red V-chevron pairs.
- CameraSystem.reducedMotionEnabled; menu drift scales to zero while retaining
  static pose.
- No route/collision/audio changes; Prologue 13/13; 275 tests.

Known limitations:

- Floor logo is a thin sign plane (sticker-like); reduced motion doesn't stop
  birds/hoist/clouds.
- Listening/clipped highlights/bypass/final motion remain.

---
### Reference Presentation Pass — Round 27 (2026-11-19)

**Goal:** make the Training floor mat read as paint and honor reduced motion for
ambient animation.

**Status:** Implemented, captured; decal material/listening remain.

Implemented:

- Floor mat uses floor-toned `0xd8d4ca` + dark ink + red accent; wall/banner
  signs remain dark.
- `CityLife.setMotionEnabled`; RenderScene freezes birds/hoist/cloud updates when
  reduced motion is on; menu drift already zero.
- No route/collision/audio changes; Prologue 13/13; 275 tests.

Known limitations:

- Mat is still a thin plane, no wear/paint decal; reduced motion fully freezes
  ambience with no indicator.
- Listening/clipped highlights/bypass/final motion remain.

---
### Reference Presentation Pass — Round 28 (2026-11-19)

**Goal:** provide a listenable live in-engine recording, not only offline/analyser
audio.

**Status:** Implemented; human listening still pending.

Implemented:

- `audio-probe --record`: ScriptProcessor tap on post-limiter master, 16-bit
  stereo WAV, high-roof wind + metal footsteps + landing + music.
- 6.32 s/44.1 kHz live recording; peak −3.65 dBFS, LUFS ≈ −22.15, low share
  0.863, high 0.034, per-second RMS range 5.1 dB.
- No game/mix/route changes; 275 tests.

Known limitations:

- Dense/loud 6 s clip, not full route; no human verdict.
- Diagnostic ScriptProcessor capture, not production recorder.
- Bypass/clipped highlights/final motion remain.

---
### Reference Presentation Pass — Round 29 (2026-11-19)

**Goal:** produce cleaner, comparable live recordings at normal cadence.

**Status:** Implemented; human verdict still pending.

Implemented:

- `audio-probe --cadence/--at`; high 10.31 s and ground 8.27 s stereo WAVs at
  650 ms cadence with final landings.
- High RMS −23.78/LUFS −24.67/low 0.867; ground RMS −24.74/LUFS −26.52/low
  0.952; high is ~1 dB louder in RMS.
- No game/mix/route changes; 275 tests.

Known limitations:

- Synthetic footstep/landing triggers, not continuous traversal; short clips.
- No human listening; bypass/clipped highlights/final motion remain.

---
### Reference Presentation Pass — Round 30 (2026-11-19)

**Goal:** capture the authored route as continuous motion with live audio.

**Status:** Implemented; continuous player traversal and human review pending.

Implemented:

- `route-video.mjs`: CDP screencast + live post-limiter WAV, ffmpeg mux.
- `--cinematic` hides HUD/arms and follows start→lower→stairs→skybridge→beam,
  then catwalk→finish; 17.5 s/1280×720/30 fps H.264+AAC.
- Live ambient wind/music at −9.85 dBFS peak / −24.85 LUFS after +8 dB review
  gain; no footsteps.
- No game/mix/route changes; 275 tests.

Known limitations:

- Cinematic camera, not continuous traversal; hard cut at catwalk.
- Input-driven mode stalls at slide tunnel; no human verdict; bypass/clipped
  highlights/final motion remain.

---
### Reference Presentation Pass — Round 31 (2026-11-19)

**Goal:** make the slide tunnel reliably passable and capture real input-driven
gameplay.

**Status:** Implemented; later autopilot obstacles/human review remain.

Implemented:

- Tunnel clearance 1.05→1.35 m (Prologue + Training); crouch/slide pass,
  standing still blocked; new unit test guards 1.3–1.75 m.
- Input-driven capture with injected sprint/slide keys and grounded slide timing.
- 9 s real gameplay video start→tunnel→lower roof→construction stairs with live
  audio (peak −3.44 dBFS, LUFS ≈ −22.19).
- Start still 13/13; 276 tests.

Known limitations:

- Clip stops before later sections; autopilot can still stall.
- No human verdict; bypass/clipped highlights/final motion remain.

---
### Reference Presentation Pass — Round 32 (2026-11-19)

**Goal:** break up the washed start-roof foreground without losing metrics.

**Status:** Implemented; material/wear detail remains.

Implemented:

- Three drain grates, roof access hatch/red handle, east-edge conduit (visual
  only, no colliders).
- Start 13/13 retained: luma 0.606, near-white 20.6%, deep-shadow 3.26%,
  local contrast 0.270.
- 276 tests; 60.2 fps.

Known limitations:

- Details subtle at 720p; roof still photographic-detail gap.
- Listening/bypass/final motion remain.

---
### Reference Presentation Pass — Round 33 (2026-11-19)

**Goal:** add visible wear to the foreground roof without losing metrics.

**Status:** Implemented; grunge material/human review remain.

Implemented:

- Five translucent gray concrete patches at 28% opacity/`0x8a867d`.
- Start 13/13: luma 0.598, p25 0.352, near-white 19.2%, deep-shadow 3.48%
  (2.80 delta), local contrast 0.268.
- 276 tests; 60.3 fps.

Known limitations:

- Flat translucent boxes, not a wear shader; deep-shadow margin thin.
- Listening/bypass/final motion remain.

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
| Input → UI | Navigation and confirmation actions | Integrated |
| Movement → Camera | Movement metrics and traversal events | Integrated |
| Movement → Player State | Authoritative locomotion state | Integrated |
| Movement → HUD | Speed and movement feedback | Integrated |
| Interaction → UI | Prompt and interaction state | Integrated |
| Interaction → Training | Interaction completion events | Integrated |
| Checkpoint → Respawn | Active recovery destination | Integrated |
| Level Runtime → Checkpoint | Checkpoint registration and lifecycle | Integrated |
| Level Runtime → Respawn | Spawn point resolution | Integrated |
| Respawn → Movement | Placement and transient state reset | Integrated |
| Respawn → Camera | Camera recovery | Integrated |
| Gameplay Session → Level Runtime | Level lifecycle orchestration | Integrated |
| Gameplay Flow → Gameplay Session | Session lifecycle requests | Integrated |
| Training → Movement | Authoritative traversal events | Integrated |
| Speedrun → Checkpoint | Ordered checkpoint validation | Integrated |
| Speedrun → Save | Persistent records | Integrated |
| Training → Save | Persistent training progress | Integrated |
| Settings → Save | Configuration persistence | Integrated |
| Settings → Accessibility | Accessibility preferences | Integrated |
| Localization → UI | Localized text and formatting | Integrated |
| Gameplay Events → Statistics | Normalized event aggregation | Integrated |
| Achievement → Progression | Achievement unlock notifications | Integrated |
| Progression → Menu | Unlock and milestone snapshots | Integrated |
| Gameplay Events → Audio | Gameplay feedback events | Integrated |

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