# PROJECT BRIEF
## MIRROR'S EDGE — RUNNER PROTOCOL

**Document:** 00_PROJECT_BRIEF.md  
**Version:** 1.0  
**Project type:** Experimental 3D First-Person Parkour Game  
**Engine:** Three.js  
**Language:** TypeScript  
**Status:** Pre-production

---

# 1. Project Overview

## 1.1. Concept

Runner Protocol is a small first-person parkour game inspired by the original Mirror's Edge (2008).

The project is intended to explore the capabilities of Three.js by recreating the visual atmosphere, movement mechanics, architectural style and gameplay feel of Mirror's Edge.

This is an independent experimental project, not a complete remake of the original game.

The project consists of:

- A main menu.
- A playable training level.
- A playable prologue level.
- A first-person parkour movement system.
- Procedurally generated 3D environments and assets.
- Procedurally generated audio.
- A speedrun timer and statistics system.
- A local leaderboard.
- A settings interface.

The primary gameplay experience is based on running, jumping, sliding, vaulting, wall running and maintaining momentum while navigating an urban environment.

## 1.2. Main Objective

The primary objective is to create a technically and visually convincing first-person parkour prototype.

The project must demonstrate:

1. Three.js scene rendering and environment construction.
2. Procedural geometry generation.
3. Procedural materials and textures.
4. Physics-based first-person movement.
5. Parkour mechanics and movement combinations.
6. Dynamic camera effects.
7. Procedural audio generation.
8. Game UI implemented using HTML and CSS.
9. Local game statistics and persistent records.
10. Performance optimization of a moderately complex 3D environment.

The quality of movement and the overall gameplay feel are more important than the quantity of content.

---

# 2. Design Principles

The following principles must guide all implementation decisions.

## 2.1. Movement First

The movement system is the most important subsystem.

The player must feel acceleration, momentum, weight, speed and interaction with the environment.

Movement must not feel like ordinary FPS character movement.

The player should be able to combine parkour actions into continuous movement sequences.

## 2.2. Minimalist Visual Style

The visual direction is inspired by Mirror's Edge (2008).

Main characteristics:

- Predominantly white architecture.
- Light grey concrete.
- Dark grey industrial structures.
- Red navigation accents.
- Large architectural forms.
- Clean geometric surfaces.
- Strong contrast between light and shadow.
- Bright outdoor environments.
- Minimal visual clutter.

The environment should communicate navigation through architecture rather than excessive UI elements.

## 2.3. Procedural Content

All game-specific assets must be generated procedurally.

This includes:

- Buildings.
- Rooftops.
- Industrial structures.
- Ventilation systems.
- Pipes.
- Ladders.
- Railings.
- Platforms.
- Construction scaffolding.
- Decorative architectural elements.
- Materials.
- Textures.
- Navigation markings.
- Environmental sounds.
- Movement sounds.

Do not introduce external 3D models, texture packs or audio files.

Three.js primitives, generated BufferGeometry, CanvasTexture, DataTexture and procedural shaders are permitted.

Fonts and development dependencies are not considered game assets.

## 2.4. Modular Architecture

Gameplay systems must be independent and reusable.

Level-specific logic must not be embedded inside the player controller.

Procedural asset generators must be reusable across both levels.

UI must be separated from the Three.js rendering layer.

Game statistics and storage must be independent of the visual interface.

## 2.5. Deterministic Gameplay

The same movement input and initial conditions should produce consistent results within reasonable simulation tolerances.

Physics must use a fixed timestep.

Speedrun timing must not depend on rendering FPS.

Procedural environments must support reproducible generation through explicit seeds.

---

# 3. Project Scope

## 3.1. Included Features

### Core Gameplay

- First-person camera.
- Mouse look.
- Walking.
- Running.
- Sprinting.
- Acceleration and deceleration.
- Jumping.
- Landing.
- Sliding.
- Vaulting.
- Wall running.
- Wall jumping.
- Ledge grabbing.
- Climbing.
- Balancing.
- Zipline traversal.

### Game Modes

**Training**

An interactive tutorial designed to teach movement mechanics.

**Prologue**

A short urban parkour route designed for repeated time-trial attempts.

### Game Systems

- Player controller.
- Physics integration.
- Collision detection.
- Movement state machine.
- Camera animation.
- Procedural environment generation.
- Procedural audio.
- HUD.
- Main menu.
- Settings.
- Checkpoints.
- Run timer.
- Run statistics.
- Local leaderboard.
- Personal best tracking.

## 3.2. Excluded Features

The following features are explicitly outside the initial project scope:

- Multiplayer.
- Online leaderboards.
- Network synchronization.
- Combat.
- Firearms.
- Enemies.
- AI opponents.
- Full character models.
- Story campaigns.
- Dialogue systems.
- Complex cinematic sequences.
- Destructible environments.
- Open-world exploration.
- User-generated levels.
- Full replay file serialization.

These features must not be implemented unless explicitly requested in a later project revision.

---

# 4. Game Structure

## 4.1. Main Menu

The main menu is the central navigation point.

Available sections:

1. Start Run.
2. Training.
3. Local Records.
4. Settings.

The interface must follow the minimalist visual direction of Mirror's Edge.

## 4.2. Training Level

Purpose: teach the player all core movement mechanics.

The level is divided into eight sequential training zones:

1. Movement.
2. Jumping.
3. Sliding.
4. Vaulting.
5. Wall Running.
6. Climbing.
7. Balance and Zipline.
8. Final Run.

Each zone must:

- Introduce a specific mechanic.
- Display contextual instructions.
- Detect successful execution.
- Provide visual or audio feedback.
- Unlock the next exercise.

Training is not included in the speedrun leaderboard.

## 4.3. Prologue Level

Purpose: provide the primary repeatable gameplay experience.

The level is divided into five major sections:

1. Rooftop.
2. Industrial.
3. Construction.
4. Skybridge.
5. Finish.

The route must combine the movement mechanics introduced in Training.

The level must support repeated attempts and local time records.

Target completion time:

- Normal completion: approximately 2–3 minutes.
- Experienced completion: approximately 1–2 minutes.

These are initial design targets, not hard gameplay restrictions.

The route must be validated through actual playtesting.

## 4.4. Results Screen

After completing Prologue, display:

- Completion time.
- Personal best status.
- Average speed.
- Maximum speed.
- Total distance.
- Jump count.
- Wall run count.
- Slide count.
- Fall count.
- Checkpoint split times.

Available actions:

- Retry.
- Return to Main Menu.

## 4.5. Local Leaderboard

Store completed Prologue attempts locally.

Leaderboard ordering:

1. Lowest completion time.
2. Earlier record timestamp as a deterministic tie-breaker.

Display:

- Rank.
- Player identifier.
- Completion time.
- Date.

The leaderboard must survive page reloads.

No network connection must be required.

---

# 5. Technical Requirements

## 5.1. Technology Stack

Primary technologies:

- TypeScript.
- Three.js.
- Vite.
- Rapier Physics.
- Web Audio API.
- IndexedDB.
- HTML.
- CSS.

Recommended packages:

- three
- @dimforge/rapier3d-compat
- vite
- typescript

Additional dependencies must be justified before introduction.

Avoid unnecessary frameworks and large third-party libraries.

## 5.2. Rendering

Use Three.js WebGLRenderer as the initial rendering backend.

Requirements:

- Physically based materials.
- Directional lighting.
- Ambient lighting.
- Shadows.
- Fog.
- Tone mapping.
- Color management.
- Post-processing where justified.

WebGPU may be explored separately after the WebGL implementation is functional.

## 5.3. Physics

Use Rapier for physical simulation and collision handling.

Requirements:

- Fixed physics timestep.
- Capsule-based player collision.
- Collision layers.
- Surface classification.
- Ground detection.
- Wall detection.
- Ledge detection.
- Stable landing behavior.

Visual meshes and physical colliders must be separate systems.

Decorative objects must not automatically generate physical colliders.

## 5.4. Audio

All gameplay and environmental audio must be generated through Web Audio API.

The audio system must support:

- Footsteps.
- Jump sounds.
- Landing sounds.
- Sliding sounds.
- Wall contact.
- Metal impacts.
- Wind.
- Urban ambience.
- UI feedback.

Audio must react to player movement and environment state.

---

# 6. Performance Requirements

The project should target desktop browsers.

Initial performance targets:

- 60 FPS on a reasonable modern desktop configuration.
- Stable physics simulation at 60 or 120 Hz.
- No continuous memory growth during level restarts.
- No unnecessary recreation of static geometry.
- Efficient rendering of repeated assets.

Use:

- InstancedMesh.
- BufferGeometry reuse.
- Material reuse.
- LOD where appropriate.
- Frustum culling.
- Shared procedural resources.

Performance must be measured rather than assumed.

---

# 7. Development Priorities

Implementation must follow this order:

1. Project foundation.
2. First-person movement.
3. Physics and collisions.
4. Parkour mechanics.
5. Camera behavior.
6. Procedural asset framework.
7. Training level.
8. Prologue level.
9. Visual effects and lighting.
10. Procedural audio.
11. Speedrun system.
12. UI and leaderboard.
13. Optimization and polish.

Do not prioritize visual details before basic movement and collision behavior are reliable.

Do not build complete levels before the corresponding movement mechanics are functional.

---

# 8. Definition of Done

The project is considered complete when all of the following conditions are satisfied.

## Gameplay

- Player can move, run and jump.
- Player can perform all required parkour mechanics.
- Movement mechanics work in combination.
- Player collisions are stable.
- Camera animations respond to movement.

## Levels

- Training contains all eight exercises.
- Each exercise validates successful completion.
- Prologue contains all five sections.
- Prologue has a valid and finishable route.
- Checkpoints are correctly ordered.
- Route completion is validated.

## Procedural Content

- Required environment assets are generated procedurally.
- Procedural assets can be reused.
- Materials and textures are generated programmatically.
- Asset generation supports deterministic seeds.

## Audio

- Core movement actions produce appropriate audio.
- Footsteps react to surface type.
- Environmental ambience is present.
- Audio settings work.

## Speedrun

- Timer starts and stops correctly.
- Results are independent of FPS.
- Statistics are recorded.
- Invalid route completion is rejected.
- Results are saved locally.
- Leaderboard is sorted correctly.
- Personal best is maintained.

## UI

- Main menu works.
- Training can be launched.
- Prologue can be launched.
- Results screen works.
- Leaderboard works.
- Settings are persistent.

## Technical Quality

- No critical runtime errors.
- No persistent memory leaks during repeated runs.
- No broken physics after restarting levels.
- Application works after a browser reload.
- Project can be built for production.

---

# 9. Rules for AI Implementation Agents

1. Read the project documentation before implementing any subsystem.
2. Follow the established architecture.
3. Do not implement features outside the documented scope.
4. Do not replace specified technologies without justification.
5. Do not introduce external game assets.
6. Do not create large monolithic classes.
7. Do not duplicate existing functionality.
8. Do not silently change gameplay parameters.
9. Do not consider a feature complete merely because its code compiles.
10. Verify implementation through actual execution and testing.
11. Update implementation status after completing a task.
12. Document unresolved issues and technical limitations.
13. Preserve working functionality when modifying existing systems.
14. Ask for clarification when requirements conflict or an important design decision is missing.

When a requirement is not sufficiently detailed, do not invent complex behavior. Identify the missing specification and document the proposed solution.

---

# 10. Project Philosophy

This project is an exploration of Three.js as a platform for creating a complete interactive 3D game.

The main objective is not to produce the largest possible amount of content.

The main objective is to create a small, polished and technically interesting game in which:

- Movement feels good.
- The environment looks convincing.
- Procedural generation is meaningful.
- Game systems are modular.
- Performance is predictable.
- The player has a reason to replay the level.

**Quality of implementation is more important than quantity of features.**