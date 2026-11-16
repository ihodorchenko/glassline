# GLASSLINE

**A first-person parkour experience inspired by the original Mirror's Edge.**

Glassline is an experimental first-person parkour game focused on movement, momentum, route discovery, precision traversal, and speedrunning.

The project explores the feeling of moving freely through a clean, architectural urban environment: running across rooftops, jumping between structures, sliding under obstacles, vaulting over barriers, and maintaining momentum through carefully designed routes.

The goal is to build a compact but complete gameplay experience with a strong movement foundation, readable level design, and rewarding replayability.

---

## Project Vision

Glassline is built around one central idea:

**Movement is the primary gameplay experience.**

The environment is designed to encourage continuous traversal rather than stop-and-go interaction.

The player should gradually learn to:

- Read the environment and recognize traversal opportunities.
- Maintain speed and momentum.
- Combine movement mechanics into fluid sequences.
- Discover efficient routes through the level.
- Improve execution through repeated attempts.
- Master the same route and achieve better completion times.

The experience should feel responsive, precise, readable, and rewarding.

## Visual Direction

The visual identity takes inspiration from the minimalist architectural presentation of the original Mirror's Edge.

Core visual principles:

- Predominantly white and light architectural environments.
- Red as the primary navigation and accent color.
- Clean geometry and strong silhouettes.
- Minimal visual noise.
- High contrast between traversable surfaces and environmental hazards.
- Carefully placed color accents that communicate useful gameplay information.

The interface should follow the same principles: minimal, functional, readable, and unobtrusive.

---

## Gameplay

### Core Movement

The player controls a first-person character capable of:

- Walking and running.
- Sprinting.
- Jumping.
- Crouching.
- Sliding.
- Vaulting.
- Wall running.
- Wall jumping.
- Landing and momentum management.

Movement mechanics are designed to work together as a coherent traversal system.

Momentum, collision, surface properties, and player state must be treated consistently across the game.

### Game Modes

#### Training

A structured environment for learning and practicing individual movement mechanics.

Training introduces mechanics progressively through exercises, objectives, feedback, and repeatable challenges.

Planned exercises include:

1. Movement Basics
2. Running and Sprinting
3. Jumping
4. Crouching and Sliding
5. Vaulting
6. Wall Running
7. Wall Jumping
8. Landing and Momentum
9. Interaction
10. Combined Traversal

#### Prologue

The primary gameplay experience.

Prologue is a continuous parkour route divided into five sections:

1. Rooftop
2. Industrial
3. Construction
4. Skybridge
5. Finish

The route contains five required checkpoints and is designed around continuous traversal and speedrun replayability.

### Speedrunning

Speedrunning is a central part of the gameplay loop.

The system is designed around:

- Accurate run timing.
- Checkpoint splits.
- Route validation.
- Personal best records.
- Medal-based performance evaluation.
- Local leaderboard records.
- Repeatable attempts.

Ghost Replay is planned as a future feature and is not part of the initial implementation scope.

---

## Project Status

The project currently has a structured system specification covering its intended architecture and gameplay features.

Implementation progress is tracked separately.

**See [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) for the current implementation state.**

Do not assume that a documented feature is already implemented.

---

## Documentation

The `docs/` directory contains the project specifications.

These documents are the primary reference for implementation decisions and system responsibilities.

### Project Foundation

| Document | Description |
|---|---|
| `01_AGENT_RULES.md` | Rules and expectations for implementation agents |
| `02_TECHNICAL_ARCHITECTURE.md` | Application architecture and technical foundations |
| `03_GAMEPLAY_SPEC.md` | Core gameplay vision and mechanics |
| `04_ASSET_BIBLE.md` | Visual assets and resource conventions |
| `05_PROCEDURAL_GENERATION_SPEC.md` | Procedural environment generation |
| `06_LEVEL_DESIGN_SPEC.md` | Level structure and traversal design |
| `07_UI_UX_SPEC.md` | Interface and user experience |
| `08_AUDIO_DESIGN_SPEC.md` | Audio direction and implementation |

### Core Gameplay Systems

| Document | Description |
|---|---|
| `09_SPEEDRUN_SYSTEM_SPEC.md` | Speedrun timing, splits, validation and records |
| `10_SAVE_SYSTEM_SPEC.md` | Persistence infrastructure and data management |
| `11_INPUT_SYSTEM_SPEC.md` | Input abstraction and device handling |
| `12_MOVEMENT_SYSTEM_SPEC.md` | Player movement and traversal physics |
| `13_CAMERA_SYSTEM_SPEC.md` | First-person camera behavior |
| `14_INTERACTION_SYSTEM_SPEC.md` | Interaction detection and execution |
| `15_LEVEL_RUNTIME_SYSTEM_SPEC.md` | Runtime level lifecycle |
| `16_CHECKPOINT_SYSTEM_SPEC.md` | Checkpoint registration and progress |
| `17_RESPAWN_SYSTEM_SPEC.md` | Player recovery and respawn lifecycle |
| `18_PLAYER_STATE_SYSTEM_SPEC.md` | Aggregated player lifecycle and state |

### Gameplay Orchestration

| Document | Description |
|---|---|
| `19_GAMEPLAY_SESSION_SYSTEM_SPEC.md` | Gameplay session lifecycle |
| `20_GAMEPLAY_FLOW_SYSTEM_SPEC.md` | Application navigation and gameplay transitions |
| `21_TRAINING_SYSTEM_SPEC.md` | Training exercises and objective evaluation |
| `22_PROGRESSION_SYSTEM_SPEC.md` | Long-term progression and content unlocks |
| `28_TUTORIAL_SYSTEM_SPEC.md` | Tutorial guidance and learning progression |
| `29_ACHIEVEMENT_SYSTEM_SPEC.md` | Achievement definitions and unlocking |
| `30_STATISTICS_SYSTEM_SPEC.md` | Gameplay statistics and aggregation |

### Presentation and Player Experience

| Document | Description |
|---|---|
| `23_HUD_SYSTEM_SPEC.md` | In-game HUD and gameplay feedback |
| `24_MENU_SYSTEM_SPEC.md` | Menu screens and menu behavior |
| `25_SETTINGS_SYSTEM_SPEC.md` | Application settings and configuration |
| `26_ACCESSIBILITY_SYSTEM_SPEC.md` | Accessibility policies and adaptations |
| `27_LOCALIZATION_SYSTEM_SPEC.md` | Translation and localization infrastructure |

### Project Tracking

| Document | Description |
|---|---|
| `IMPLEMENTATION_STATUS.md` | Implementation progress, integration status and quality gates |

---

## Technical Direction

The project is intended to run as a browser-based desktop game.

The technical architecture is designed around:

- TypeScript-based application code.
- Browser runtime capabilities.
- IndexedDB for local persistence.
- Modular gameplay systems.
- Explicit system ownership and interfaces.
- Event-driven communication where appropriate.
- Separation of gameplay logic from presentation.
- Frame-rate-independent gameplay simulation.

The exact rendering engine, runtime dependencies, and build configuration must follow the technical architecture specification and the actual repository configuration.

Do not introduce a new framework, engine, or major dependency without first checking the existing architecture and documenting the reason.

---

## Architecture Principles

The project follows several important architectural principles.

### Single Ownership

Every gameplay domain has one authoritative owner.

For example:

- Movement owns locomotion physics.
- Camera owns first-person presentation.
- Checkpoint owns checkpoint progress.
- Respawn owns recovery orchestration.
- Gameplay Session owns session lifecycle.
- Gameplay Flow owns application navigation.
- Speedrun owns run timing and validation.
- Save owns persistence infrastructure.
- Statistics owns aggregated gameplay facts.

Systems must not independently recreate another system's responsibilities.

### Explicit Interfaces

Systems communicate through defined interfaces, commands, and events.

Avoid direct access to internal implementation details of other systems.

### Separation of Concerns

Gameplay rules, runtime orchestration, persistence, and presentation must remain separate.

UI components display authoritative state; they do not independently calculate gameplay outcomes.

### Deterministic Gameplay

Movement, checkpoint progression, run timing, and objective evaluation must behave consistently regardless of rendering frame rate.

### Incremental Development

Implement and validate systems in small, integrated stages.

Prefer a working gameplay foundation over broad but incomplete implementations.

---

## Development Guidelines

Before implementing a feature:

1. Read `docs/01_AGENT_RULES.md`.
2. Read `docs/02_TECHNICAL_ARCHITECTURE.md`.
3. Read the specification relevant to the requested task.
4. Review related systems and their ownership boundaries.
5. Inspect the existing codebase before creating new modules.
6. Identify dependencies and integration requirements.
7. Implement only the agreed scope.
8. Run relevant tests and validation commands.
9. Update `docs/IMPLEMENTATION_STATUS.md`.

Implementation agents must not:

- Invent undocumented gameplay rules.
- Duplicate existing system responsibilities.
- Replace established architecture without justification.
- Introduce unnecessary dependencies.
- Mark untested functionality as verified.
- Implement deferred features as part of initial scope without approval.
- Modify unrelated systems without explaining the reason.

When a specification conflicts with the existing implementation or another specification, identify the conflict before making a potentially incompatible architectural change.

---

## Initial Development Priorities

The recommended development sequence is:

1. Architecture validation and repository setup.
2. Runtime foundation and input handling.
3. First-person player movement and camera.
4. Traversal mechanics and recovery.
5. Level runtime and checkpoints.
6. Gameplay sessions and game modes.
7. Speedrun functionality.
8. UI, HUD, menus, and audio.
9. Progression, tutorials, achievements, and statistics.
10. Stabilization and acceptance testing.

See `docs/IMPLEMENTATION_STATUS.md` for detailed phases and completion criteria.

---

## Current Scope

### Initial Release

The initial release focuses on delivering a complete playable experience:

- First-person parkour movement.
- Training mode.
- Prologue with five sections.
- Five required checkpoints.
- Speedrun timing and splits.
- Local leaderboard.
- Personal best records.
- Persistent local progress.
- Functional menus and HUD.
- Basic audio and accessibility support.

### Future Development

The following are intentionally outside the initial implementation scope:

- Ghost Replay.
- Online leaderboards.
- Cloud saves.
- Multiplayer.
- Online accounts.
- Advanced procedural campaigns.
- Advanced traversal mechanics beyond the initial movement specification.
- Remote analytics.

Future features should extend the existing architecture rather than introduce parallel gameplay systems.

---

## Repository Structure

The following is the intended high-level organization. The actual source directory names should follow the repository's technical architecture.

```text
glassline/
├── README.md
├── docs/
│   ├── 01_AGENT_RULES.md
│   ├── 02_TECHNICAL_ARCHITECTURE.md
│   ├── ...
│   ├── 30_STATISTICS_SYSTEM_SPEC.md
│   └── IMPLEMENTATION_STATUS.md
│
├── src/
│   └── ...
│
├── public/
│   └── ...
│
├── tests/
│   └── ...
│
└── package.json
```

This is a conceptual overview, not a requirement to create empty directories or duplicate the repository's existing structure.

---

## Project Philosophy

Glassline should prioritize:

- Responsive and satisfying movement.
- Consistent physics.
- Readable traversal opportunities.
- Strong level flow.
- Minimalist presentation.
- Reliable gameplay systems.
- Meaningful replayability.

Every feature should support the core experience of moving through the environment.

**The player should feel that the environment is a route to master, not simply a space to explore.**