# GLASSLINE

**A first-person parkour game focused on movement, momentum, and mastery.**

Glassline is an experimental browser-based 3D parkour game inspired by the original *Mirror's Edge* (2008).

The project explores responsive first-person movement, architectural traversal, procedural environments, and repeatable speedrun challenges.

Glassline is an independent project. It is not a remake of Mirror's Edge and does not use its proprietary assets.

---

## Project Vision

**Movement is the primary gameplay experience.**

Glassline is built around the feeling of moving continuously through an urban environment.

The player should learn to:

- Read architecture and recognize traversal opportunities.
- Build and preserve momentum.
- Combine movement mechanics into fluid sequences.
- Discover efficient routes.
- Improve execution through repeated attempts.
- Master routes and achieve better completion times.

The environment should feel like a route to master, not simply a space to explore.

## Visual Direction

The visual identity is inspired by the minimalist architectural presentation of the original Mirror's Edge.

Core principles:

- Predominantly white and light-grey architecture.
- Light concrete and clean geometric surfaces.
- Dark-grey industrial structures.
- Red navigation and gameplay accents.
- Large architectural forms.
- Strong silhouettes and readable traversal geometry.
- High contrast between important surfaces.
- Minimal visual clutter.

The interface follows the same principles: minimal, functional, readable, and unobtrusive.

---

## Gameplay

### Core Movement

The initial gameplay movement set includes:

- Walking and running.
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

Movement must be responsive, consistent, and independent of rendering frame rate.

Advanced traversal features outside the initial scope must not be introduced as mandatory dependencies.

### Game Modes

#### Training

A structured environment for learning and practicing movement mechanics.

Training introduces mechanics progressively through exercises, objectives, instructions, hints, and feedback.

The planned exercise sequence is:

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

Training is separate from the Prologue speedrun leaderboard.

#### Prologue

The primary repeatable gameplay experience.

Prologue is a continuous parkour route divided into five sections:

1. Rooftop.
2. Industrial.
3. Construction.
4. Skybridge.
5. Finish.

The route contains five required checkpoints.

The level is designed around continuous traversal, route readability, movement combinations, and speedrun replayability.

Initial completion-time targets are approximately 2–3 minutes for a normal completion and 1–2 minutes for an experienced run. These are design targets, not gameplay restrictions.

### Speedrunning

Speedrunning is a central part of the gameplay loop.

The system supports:

- Monotonic run timing.
- Checkpoint splits.
- Ordered route validation.
- Bronze, Silver, and Gold performance medals.
- Personal best records.
- Local leaderboard records.
- Repeatable attempts.

Ghost Replay is a future feature and is not required for the initial release.

---

## Technology Stack

Glassline is designed as a desktop browser game.

| Technology | Responsibility |
|---|---|
| TypeScript | Application and gameplay logic |
| Three.js | 3D rendering |
| WebGLRenderer | Initial rendering backend |
| Vite | Development server and production build |
| Rapier Physics | Physics simulation and collision detection |
| Web Audio API | Procedural gameplay and environmental audio |
| IndexedDB | Persistent local data |
| HTML / CSS | Application interface |
| GLSL | Custom shaders where required |

The initial implementation uses Three.js `WebGLRenderer`.

WebGPU is a possible future extension, not part of the initial implementation.

Use Rapier through `@dimforge/rapier3d-compat`, as specified in the technical architecture.

Do not introduce additional frameworks or major dependencies without checking the existing architecture and documenting the reason.

---

## Architecture Principles

### Single Ownership

Every gameplay domain has one authoritative owner.

Examples:

- Movement owns locomotion physics.
- Camera owns first-person presentation.
- Checkpoint owns checkpoint progress.
- Respawn owns the recovery lifecycle.
- Level Runtime owns loaded level lifecycle.
- Gameplay Session owns session lifecycle.
- Gameplay Flow owns application navigation.
- Speedrun owns run timing and validation.
- Save owns persistence infrastructure.
- Settings owns configuration values and semantics.
- Statistics owns aggregated gameplay facts.
- Achievement owns achievement definitions and unlock state.

Systems communicate through defined interfaces, commands, snapshots, and events.

### Separation of Concerns

Gameplay rules, runtime orchestration, persistence, and presentation remain separate.

UI displays authoritative state. It must not independently calculate gameplay outcomes.

### Deterministic Gameplay

Physics uses a fixed timestep.

Speedrun timing uses a monotonic clock and must not depend on rendering FPS.

Procedural generation must support reproducible results through explicit seeds.

### Incremental Development

Implement systems in small, integrated stages.

Prefer a working and verified gameplay foundation over broad but incomplete implementations.

---

## Project Status

Glassline currently has a structured specification covering its intended architecture, gameplay systems, and initial release scope.

The presence of a specification does not mean that its system has been implemented.

For actual implementation, integration, and verification status, see:

**[`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md)**

---

## Documentation

The `docs/` directory is the primary source of implementation specifications.

### Project Foundation

| Document | Description |
|---|---|
| [`00_PROJECT_BRIEF.md`](docs/00_PROJECT_BRIEF.md) | Project concept, scope, and design principles |
| [`01_AGENT_RULES.md`](docs/01_AGENT_RULES.md) | Detailed rules for implementation agents |
| [`02_TECHNICAL_ARCHITECTURE.md`](docs/02_TECHNICAL_ARCHITECTURE.md) | Technical architecture and runtime foundations |
| [`03_GAMEPLAY_SPEC.md`](docs/03_GAMEPLAY_SPEC.md) | Core gameplay design |
| [`04_ASSET_BIBLE.md`](docs/04_ASSET_BIBLE.md) | Asset, material, and visual conventions |
| [`05_PROCEDURAL_GENERATION_SPEC.md`](docs/05_PROCEDURAL_GENERATION_SPEC.md) | Procedural environment generation |
| [`06_LEVEL_DESIGN_SPEC.md`](docs/06_LEVEL_DESIGN_SPEC.md) | Level structure and traversal design |
| [`07_UI_UX_SPEC.md`](docs/07_UI_UX_SPEC.md) | User interface and experience |
| [`08_AUDIO_DESIGN_SPEC.md`](docs/08_AUDIO_DESIGN_SPEC.md) | Audio direction and implementation |

### Core Gameplay Systems

| Document | Description |
|---|---|
| [`09_SPEEDRUN_SYSTEM_SPEC.md`](docs/09_SPEEDRUN_SYSTEM_SPEC.md) | Timing, splits, route validation, and records |
| [`10_SAVE_SYSTEM_SPEC.md`](docs/10_SAVE_SYSTEM_SPEC.md) | Persistence infrastructure |
| [`11_INPUT_SYSTEM_SPEC.md`](docs/11_INPUT_SYSTEM_SPEC.md) | Input abstraction and device handling |
| [`12_MOVEMENT_SYSTEM_SPEC.md`](docs/12_MOVEMENT_SYSTEM_SPEC.md) | Movement and traversal physics |
| [`13_CAMERA_SYSTEM_SPEC.md`](docs/13_CAMERA_SYSTEM_SPEC.md) | First-person camera behavior |
| [`14_INTERACTION_SYSTEM_SPEC.md`](docs/14_INTERACTION_SYSTEM_SPEC.md) | Interaction detection and execution |
| [`15_LEVEL_RUNTIME_SYSTEM_SPEC.md`](docs/15_LEVEL_RUNTIME_SYSTEM_SPEC.md) | Runtime level lifecycle |
| [`16_CHECKPOINT_SYSTEM_SPEC.md`](docs/16_CHECKPOINT_SYSTEM_SPEC.md) | Checkpoint registration and progress |
| [`17_RESPAWN_SYSTEM_SPEC.md`](docs/17_RESPAWN_SYSTEM_SPEC.md) | Player recovery lifecycle |
| [`18_PLAYER_STATE_SYSTEM_SPEC.md`](docs/18_PLAYER_STATE_SYSTEM_SPEC.md) | Aggregated player lifecycle and state |

### Gameplay Orchestration

| Document | Description |
|---|---|
| [`19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`](docs/19_GAMEPLAY_SESSION_SYSTEM_SPEC.md) | Gameplay session lifecycle |
| [`20_GAMEPLAY_FLOW_SYSTEM_SPEC.md`](docs/20_GAMEPLAY_FLOW_SYSTEM_SPEC.md) | Application navigation and transitions |
| [`21_TRAINING_SYSTEM_SPEC.md`](docs/21_TRAINING_SYSTEM_SPEC.md) | Training exercises and objective evaluation |
| [`22_PROGRESSION_SYSTEM_SPEC.md`](docs/22_PROGRESSION_SYSTEM_SPEC.md) | Content unlocks and long-term progression |
| [`28_TUTORIAL_SYSTEM_SPEC.md`](docs/28_TUTORIAL_SYSTEM_SPEC.md) | Tutorial guidance |
| [`29_ACHIEVEMENT_SYSTEM_SPEC.md`](docs/29_ACHIEVEMENT_SYSTEM_SPEC.md) | Achievement definitions and unlocking |
| [`30_STATISTICS_SYSTEM_SPEC.md`](docs/30_STATISTICS_SYSTEM_SPEC.md) | Gameplay statistics and aggregation |

### Presentation and Player Experience

| Document | Description |
|---|---|
| [`23_HUD_SYSTEM_SPEC.md`](docs/23_HUD_SYSTEM_SPEC.md) | In-game HUD and gameplay feedback |
| [`24_MENU_SYSTEM_SPEC.md`](docs/24_MENU_SYSTEM_SPEC.md) | Menu screens and behavior |
| [`25_SETTINGS_SYSTEM_SPEC.md`](docs/25_SETTINGS_SYSTEM_SPEC.md) | Application settings and configuration |
| [`26_ACCESSIBILITY_SYSTEM_SPEC.md`](docs/26_ACCESSIBILITY_SYSTEM_SPEC.md) | Accessibility policies and adaptations |
| [`27_LOCALIZATION_SYSTEM_SPEC.md`](docs/27_LOCALIZATION_SYSTEM_SPEC.md) | Translation and localization |

### Project Tracking

| Document | Description |
|---|---|
| [`IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) | Implementation, integration, and verification tracking |

---

## Development Guidelines

Before implementing a feature:

1. Read [`AGENT.md`](AGENT.md).
2. Read `docs/01_AGENT_RULES.md`.
3. Read `docs/02_TECHNICAL_ARCHITECTURE.md`.
4. Read the relevant system specifications.
5. Inspect the existing codebase and tests.
6. Check `docs/IMPLEMENTATION_STATUS.md`.
7. Implement only the agreed scope.
8. Run relevant validation commands.
9. Update implementation status honestly.

Do not recreate existing functionality, duplicate system ownership, or introduce undocumented gameplay rules.

When specifications conflict, identify the conflict before making an incompatible architectural decision.

---

## Initial Release Scope

The initial release focuses on a complete playable experience:

- First-person parkour movement.
- Mouse and keyboard input.
- Core traversal mechanics.
- Basic collision and player recovery.
- Training mode.
- Prologue with five sections.
- Five required checkpoints.
- Speedrun timing and splits.
- Personal best records.
- Local leaderboard.
- IndexedDB persistence.
- Main Menu, Pause Menu, Settings, and Results.
- Gameplay HUD.
- Basic procedural audio feedback.
- Initial accessibility support.
- English localization.
- Core tutorial guidance.

### Deferred Features

The following features must not block the initial release:

- Ghost Replay recording and playback.
- Online leaderboards.
- Cloud saves.
- Multiplayer.
- Online accounts.
- Advanced procedural campaigns.
- Ledge grabbing.
- Swinging and ziplines.
- Advanced traversal variants outside the initial movement scope.
- Remote analytics.
- Full RTL layout.

Future features should extend the existing architecture rather than introduce parallel systems.

---

## Repository Structure

The following is a conceptual overview. Actual source directories and configuration must follow the repository's technical architecture.

```text
glassline/
├── AGENT.md
├── README.md
├── package.json
├── docs/
│   ├── 00_PROJECT_BRIEF.md
│   ├── 01_AGENT_RULES.md
│   ├── 02_TECHNICAL_ARCHITECTURE.md
│   ├── ...
│   └── IMPLEMENTATION_STATUS.md
├── src/
├── public/
└── tests/
```

Do not create empty directories merely to match this illustration.

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