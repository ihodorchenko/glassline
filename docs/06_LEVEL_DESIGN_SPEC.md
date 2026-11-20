# 06_LEVEL_DESIGN_SPEC.md

**Project:** Glassline  
**Document:** Level Design Specification  
**Version:** 2.0  
**Status:** Design Specification  
**Applies to:** Training Level, Prologue Level, Level Geometry, Route Design, Checkpoints, Gameplay Validation

---

## 1. Purpose

This document defines the structure, layout principles, gameplay requirements, and implementation rules for the project's playable levels.

The initial release contains two playable environments:

1. **Training** — an isolated rooftop training facility designed to teach and validate the movement and parkour mechanics.
2. **Prologue** — a short, authored speedrun level that combines the learned mechanics into a continuous traversal route.

Both levels use procedural environment assets, but their gameplay layouts are intentionally designed.

Procedural generation must support level construction without compromising route readability, traversal precision, or player progression.

This document defines level composition, environment requirements, geometry, navigation affordances, and spatial organization. It does not own exercise objectives or evaluation — those belong to `21_TRAINING_SYSTEM_SPEC.md`. It does not own run timing or route validation — those belong to `09_SPEEDRUN_SYSTEM_SPEC.md`. It does not own checkpoint activation, progress, or recovery lifecycle — those belong to `16_CHECKPOINT_SYSTEM_SPEC.md` and `17_RESPAWN_SYSTEM_SPEC.md`.

This document describes the intended gameplay experience and level construction requirements. Exact coordinates, obstacle dimensions, and route geometry may be tuned during implementation and playtesting.

---

## 2. Design Principles

### 2.1 Movement First

Every level must be designed around player movement.

Architecture exists to create traversal opportunities, not simply to fill space.

Each gameplay structure should have a purpose:

- Provide a running surface.
- Create a jump opportunity.
- Require a vault or slide.
- Enable wallrunning or walljumping.
- Connect different elevation levels.
- Guide the player toward the next section.

### 2.2 Readable Routes

The player should understand where to move next without constantly stopping.

Use:

- Architectural composition.
- Platform placement.
- Contrasting surfaces.
- Red route accents.
- Environmental arrows.
- Runner Vision.
- Lighting and sightlines.

The route should remain understandable even when Runner Vision is reduced or disabled.

### 2.3 Consistent Rules

Similar obstacles must behave consistently.

A vaultable obstacle that works in one location should not unexpectedly fail in another location because of slightly different collision geometry.

Gameplay surfaces must expose explicit metadata and use consistent detection rules.

### 2.4 Progressive Difficulty

Introduce mechanics individually before combining them.

Training establishes basic competence.

Prologue combines mechanics into a continuous route with increasing complexity.

### 2.5 Momentum and Flow

The level should encourage continuous movement.

Avoid unnecessary narrow corridors, excessive stopping points, and obstacles that force the player to wait without a gameplay reason.

---

## 3. Global Level Standards

### 3.1 Coordinate System

Follow the project-wide conventions:

- Y is up.
- One world unit represents one meter.
- Distances use meters.
- Speeds use meters per second.
- Time uses seconds.
- All gameplay geometry uses the same scale as the physics system.

The forward direction must be consistent across:

- Player controller.
- Camera.
- Level geometry.
- Navigation markers.
- Checkpoint orientation.

### 3.2 Level Bounds

Every level should define:

- Spawn location.
- Main playable area.
- Traversal route.
- Checkpoint locations.
- Recovery or respawn locations.
- Finish area, when applicable.
- Out-of-bounds regions.

The player should not be able to accidentally leave the intended environment without a clear failure or recovery response.

### 3.3 Geometry Requirements

Playable geometry must:

- Have stable collision.
- Avoid unintended gaps.
- Avoid invisible obstacles.
- Provide enough space for the player capsule.
- Respect slide and jump clearance.
- Use consistent collision layers.
- Avoid unnecessary decorative collision.

Visual and physical representations must follow `04_ASSET_BIBLE.md` and `05_PROCEDURAL_GENERATION_SPEC.md`.

### 3.4 Gameplay Metadata

Important level objects should expose explicit semantic information.

Examples:

- `walkable`
- `landingSurface`
- `vaultObstacle`
- `wallrunSurface`
- `walljumpSurface`
- `checkpoint`
- `finishTrigger`
- `hazard`
- `killVolume`
- `outOfBounds`

These identifiers are illustrative. The implementation should use the project's established typed gameplay metadata system.

Do not infer gameplay behavior exclusively from mesh names or materials.

---

## 4. Level Architecture

### 4.1 Proposed Directory Structure

```text
src/
└── levels/
    ├── shared/
    │   ├── LevelBase.ts
    │   ├── LevelConfig.ts
    │   ├── LevelBounds.ts
    │   ├── AuthoredCheckpoint.ts
    │   ├── AuthoredRoute.ts
    │   └── LevelValidation.ts
    │
    ├── training/
    │   ├── TrainingLevel.ts
    │   ├── TrainingLayout.ts
    │   ├── TrainingConfig.ts
    │   └── exercises/
    │       ├── MovementBasicsExercise.ts
    │       ├── RunningSprintingExercise.ts
    │       ├── JumpingExercise.ts
    │       ├── CrouchingSlidingExercise.ts
    │       ├── VaultingExercise.ts
    │       ├── WallRunningExercise.ts
    │       ├── WallJumpingExercise.ts
    │       ├── LandingMomentumExercise.ts
    │       ├── InteractionExercise.ts
    │       └── CombinedTraversalExercise.ts
    │
    └── prologue/
        ├── PrologueLevel.ts
        ├── PrologueLayout.ts
        ├── PrologueConfig.ts
        ├── PrologueRoute.ts
        └── sections/
            ├── RooftopSection.ts
            ├── IndustrialSection.ts
            ├── ConstructionSection.ts
            ├── SkybridgeSection.ts
            └── FinishSection.ts
```

This is a proposed structure.

Do not create every file before implementation requires it.

### 4.2 Level Lifecycle

A level must support:

1. Load authored level configuration.
2. Generate or instantiate environment assets through procedural generators.
3. Register collision geometry.
4. Register gameplay metadata.
5. Provide checkpoint definitions, spawn points, trigger volumes, and kill/boundary volumes to the owning systems.
6. Request initial player spawn through Level Runtime and the Gameplay Session.
7. Activate authored gameplay content (environment and triggers).
8. Expose completion, checkpoint, and failure signals to the owning systems.
9. Deactivate content.
10. Unload the environment and release owned resources.

The level owns authored content and its geometry. It does not own run timing, checkpoint progress, player recovery, session identity, or persistence.

Level initialization must not start the run timer before the player is ready to begin the actual run.

### 4.3 Level Configuration

Level-specific settings should be explicit and typed.

Illustrative example:

```ts
interface LevelConfig {
  id: string;
  seed: number;
  spawnPointId: string;
  bounds: LevelBounds;
  checkpointIds: string[];
  routeId: string;
}
```

The level configuration references owning-system identifiers. It must not embed authoritative checkpoint progress, route validation state, or run timing data.

Use the actual project types and coordinate conventions.

Do not store arbitrary gameplay behavior in untyped configuration objects.

---

# PART I — TRAINING

## 5. Training Overview

### 5.1 Purpose

Training is a dedicated environment for learning and validating the movement system.

It is not a speedrun level and must not contribute to the Prologue leaderboard.

The Training System (`21_TRAINING_SYSTEM_SPEC.md`) owns exercise definitions, objectives, evaluation, instructions, hints, completion, and exercise progression. This document defines only the physical environment and spatial layout required to support those exercises.

Each exercise environment must:

1. Make the required action visually obvious.
2. Provide a clear approach, target, and exit.
3. Expose the gameplay metadata needed for authoritative evaluation.
4. Support safe recovery through the Respawn System.
5. Avoid requiring precision beyond the intended instruction.

Entering an exercise zone does not complete an exercise. Completion is evaluated by the Training System from gameplay events.

### 5.2 Environment

Training takes place in a daylight movement yard (`Training — Movement Yard`,
`training_test`), not on a rooftop.

Visual characteristics:

- White concrete surfaces.
- Gray industrial structures.
- Red navigation markings.
- Metal platforms and railings.
- Pipes and ventilation.
- Open sky.
- Distant simplified city skyline.

The environment should feel like a purpose-built training facility rather than a natural city block.

### 5.3 Spatial Organization

Use a sequence of ten exercise zones corresponding to the implemented exercise set defined in `21_TRAINING_SYSTEM_SPEC.md` §4.2.

Recommended structure:

```text
Training Spawn
      |
      v
01 Basic Movement (ex_01)
      |
      v
02 Running (ex_02)
      |
      v
03 Basic Jump (ex_03)
      |
      v
04 Basic Vault (ex_04)
      |
      v
05 Slide (ex_05)
      |
      v
06 Wall Run (ex_06)
      |
      v
07 Wall Jump (ex_07)
      |
      v
08 Controlled Landing (ex_08)
      |
      v
09 Interaction Basics (ex_09)
      |
      v
10 Parkour Sequence (ex_10)
      |
      v
Training Complete
```

The areas may be arranged linearly or around a central yard.

The exact layout should prioritize clarity and short transitions between exercises.

The physical order should follow the instructional order, but the Training System owns availability and unlock rules.

### 5.4 Environment Support for Progression

- Each exercise must have a defined start marker and restart spawn point.
- Exercise restart is requested by the Training System and executed by the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`); level geometry must not execute recovery itself.
- Training progress persistence is owned by the Training and Progression Systems through the Save System; level objects must not persist progress.
- Training completion is independent of Prologue completion.

---

## 6. Exercise Environments 01–02 — Basic Movement, Running

These environments support the implemented exercises 1 and 2 (`ex_01_movement_basics`, `ex_02_running`; see `21_TRAINING_SYSTEM_SPEC.md` §4.2).

### 6.1 Purpose

Introduce locomotion, directional control, running, and sprinting in a hazard-free environment.

### 6.2 Basic Movement Environment

A wide, unobstructed rooftop lane.

Required elements:

- Starting marker.
- Long straight running surface.
- Directional movement area with simple, low-risk obstacles for left/right/backward movement.
- Target zone and finish marker.

Avoid hazards during the introductory movement area.

### 6.3 Running Environment

A longer straight lane for controlled acceleration and sprinting.

Required elements:

- Clear start gate.
- Straight running lane with a stable flat surface.
- Visually marked sprint corridor.
- Finish zone.

Avoid obstacles that require jumping or sliding.

### 6.4 Geometry Requirements

- The lane must be wide enough to change direction safely.
- The surface must be continuous and free of unintended collision edges.
- Start and finish zones must be unambiguous.
- Distance must be sufficient for the player to reach and maintain sprint speed with the calibrated movement parameters.

Exact lengths are starting values to be tuned through playtesting.

### 6.5 Evaluation Support

The environment must expose:

- Start and finish zone triggers.
- Walkable surface metadata.
- Reference points or measurement zones where the Training System requires them.

The Training System consumes movement metrics from the Movement System. Level scripts must not calculate authoritative speed or completion independently.

### 6.6 Recovery

No failure conditions are expected in these exercises.

If the player leaves the intended area, an out-of-bounds recovery volume must return the player to the exercise start through the Respawn System.

---

## 7. Exercise Environment 03 — Basic Jump

This environment supports the implemented exercise 3 (`ex_03_jumping`; see `21_TRAINING_SYSTEM_SPEC.md` §4.2).

### 7.1 Purpose

Provide a readable sequence of jumps that teaches takeoff, air control, and landing.

### 7.2 Environment

A sequence of platforms with increasing gaps.

Suggested progression:

1. Small gap.
2. Medium gap.
3. Elevated landing platform.
4. Directional jump.

### 7.3 Required Elements

- Clear takeoff surfaces.
- Distinct target landing zones.
- A visible route between platforms.
- A safe recovery area below the platforms.

### 7.4 Geometry Requirements

- Gaps must be derived from the calibrated jump trajectory, gravity, and movement speed — not from visual estimation.
- Landing platforms must be wider than the theoretical minimum capsule footprint.
- Elevation changes must be reachable with the intended jump parameters.
- Do not require blind jumps where the landing surface is not visible.
- Platform edges must have stable, predictable collision.

### 7.5 Evaluation Support

The environment must expose:

- Jump takeoff region.
- Target landing zone.
- Surface metadata for landing detection.

The Training System evaluates takeoff, airborne state, and landing through Movement System events. A jump input alone must not complete the exercise.

### 7.6 Recovery

If the player falls, an out-of-bounds or kill volume returns the player to a safe nearby spawn through the Respawn System.

Exercise progress must be preserved and immediate retry must be possible.

---

## 8. Exercise Environment 05 — Slide

This environment supports the implemented exercise 5 (`ex_05_sliding`; see `21_TRAINING_SYSTEM_SPEC.md` §4.2). In the implemented course the vault exercise (`ex_04`) precedes it; this section keeps the crouch/slide environment for the slide mechanic.

### 8.1 Purpose

Teach low-profile movement: entering crouch, moving through a low-clearance area, and performing a momentum-based slide.

### 8.2 Environment

Two connected sub-areas:

1. A crouch area with a low but clearly visible ceiling opening. It should not require momentum.
2. A slide lane with a run-up, a low overhead obstacle, and an exit.

### 8.3 Required Elements

- Crouch passage with a visible entrance.
- Open run-up area before the slide obstacle.
- Low clearance obstacle.
- Exit area after the obstacle.

### 8.4 Geometry Requirements

Obstacle clearance must account for:

- Player standing capsule.
- Player crouching and sliding capsule.
- Collision margins.
- Camera placement.

The crouch passage must be physically passable in the crouch state without requiring a slide. The slide passage must be physically possible at a reachable entry speed.

The low obstacle must visibly communicate that the player has to go low; avoid geometry that only becomes passable through an undocumented collision exception.

### 8.5 Evaluation Support

The environment must expose:

- Crouch passage entry and exit zones.
- Slide obstacle metadata.
- Landing space beyond the obstacle.

The Training System validates the actual crouch and slide execution from Movement System events. Input alone must not count as completion.

### 8.6 Recovery

If the player becomes blocked or falls, recovery returns the player to the exercise start through the Respawn System.

---

## 9. Exercise Environment 04 — Basic Vault

This environment supports the implemented exercise 4 (`ex_04_vaulting`; see `21_TRAINING_SYSTEM_SPEC.md` §4.2).

### 9.1 Purpose

Teach contextual vaulting over obstacles while preserving forward momentum.

### 9.2 Environment

A sequence of vaultable obstacles:

- Low wall.
- Medium-height obstacle.
- Wider obstacle suitable for a speed vault.

### 9.3 Required Elements

- Straight approach lane before each obstacle.
- Valid vault obstacle with a readable top edge.
- Safe landing area beyond the obstacle.
- Visible continuation of the route.

### 9.4 Geometry Requirements

Vault obstacles must:

- Have a supported height range compatible with the Movement System's vault detection.
- Provide a valid approach surface at running speed.
- Provide unobstructed space on the landing side.
- Expose the correct `vaultObstacle` metadata.
- Have predictable collision geometry.

The landing area must be wide enough to absorb variations in approach speed and angle.

### 9.5 Evaluation Support

The environment must expose:

- Vault obstacle definitions.
- Before and after zones around each obstacle.

The Training System validates the vault lifecycle through Movement System events. Jumping over the obstacle without vaulting must not complete the exercise.

### 9.6 Recovery

If the player falls or becomes blocked, recovery returns the player to the exercise start through the Respawn System.

---

## 10. Exercise Environment 06 — Wall Run

This environment supports the implemented exercise 6 (`ex_06_wall_running`; see `21_TRAINING_SYSTEM_SPEC.md` §4.2).

### 10.1 Purpose

Teach approach angle, speed threshold, wall contact, and controlled wallrun traversal.

### 10.2 Environment

A clear wallrun corridor.

Required elements:

- Running approach.
- Continuous wall surface.
- Safe landing area or exit platform.
- Optional second wall for wall-to-wall practice.

### 10.3 Geometry Requirements

Wallrun surfaces must:

- Have consistent, flat collision.
- Be long enough to sustain the intended wallrun duration.
- Provide a safe exit.
- Expose explicit `wallrunSurface` metadata.
- Avoid interruptions such as gaps, protrusions, or decorative colliders on the run surface.
- Use consistent surface normals.

The approach lane must allow the player to reach the wall at a viable angle and speed.

### 10.4 Evaluation Support

The environment must expose:

- Wallrun surface definitions.
- Entry and exit zones.
- Landing detection surfaces.

The Training System validates wall contact and wallrun duration through Movement System events. The environment must not implement its own wall detection.

### 10.5 Recovery

If the player falls or loses contact, recovery returns the player to the exercise start through the Respawn System.

---

## 11. Exercise Environment 07 — Wall Jump

This environment supports the implemented exercise 7 (`ex_07_wall_jumping`; see `21_TRAINING_SYSTEM_SPEC.md` §4.2).

### 11.1 Purpose

Teach deliberate departure from a wall and landing on a designated platform.

### 11.2 Environment

A wallrun surface with a dedicated landing platform placed to the side or ahead.

Required elements:

- Wallrun approach.
- Valid wall surface.
- Visible target platform.
- Safe recovery area below.

### 11.3 Geometry Requirements

- The wall must be long enough to establish a wallrun before the jump.
- The target platform must be reachable using the wall-jump trajectory from the intended wallrun exit region.
- The target platform must be visible before the player commits to the jump.
- The wall and platform must expose `wallrunSurface` and `landingSurface` metadata.

The landing platform must be wider than the theoretical minimum footprint to tolerate timing variation.

### 11.4 Evaluation Support

The environment must expose:

- Wallrun surface.
- Wall-jump exit region reference.
- Target landing zone.

The Training System distinguishes a wall jump from an ordinary jump through Movement System events. The level must not infer the mechanic from animation.

### 11.5 Recovery

If the player misses the platform, recovery returns the player to the exercise start through the Respawn System.

---

## 12. Exercise Environment 08 — Controlled Landing

This environment supports the implemented exercise 8 (`ex_08_landing_momentum`; see `21_TRAINING_SYSTEM_SPEC.md` §4.2).

### 12.1 Purpose

Teach controlled landing and preservation of horizontal momentum through a short sequence.

### 12.2 Environment

Two connected sub-areas:

1. A landing area: an elevated platform with designated landing target zones at a lower level.
2. A momentum lane: a sequence of low obstacles that can be traversed without stopping.

### 12.3 Required Elements for Landing

- Takeoff platform.
- Distinct target landing zones.
- Safe area beyond the target zones.
- Visible height and distance.

### 12.4 Required Elements for Momentum

- Approach lane.
- Low hurdles or vaultable obstacles.
- Continuous exit lane.
- Optional measured speed reference points.

### 12.5 Geometry Requirements

- Landing zones must be wide enough to tolerate normal trajectory variation.
- The drop must not force a permanently stuck state.
- Momentum obstacles must be low-risk: a failed attempt must not immediately invalidate the whole exercise.
- Surfaces must be continuous and expose `landingSurface` metadata.

### 12.6 Evaluation Support

The environment must expose:

- Landing target zones.
- Takeoff region.
- Obstacle metadata for the momentum lane.
- Speed or distance reference zones where the Training System requires them.

The Training System evaluates landing quality and momentum preservation using Movement System metrics. The level must not calculate authoritative speed.

### 12.7 Recovery

A missed landing returns the player to the landing start through the Respawn System.

The momentum lane should keep recovery local so the exercise can be retried without restarting Training.

---

## 13. Exercise Environments 09–10 — Interaction Basics and Parkour Sequence

These environments support the implemented exercises 9 and 10 (`ex_09_interaction`, `ex_10_combined_traversal`; see `21_TRAINING_SYSTEM_SPEC.md` §4.2).

### 13.1 Purpose

Exercise 9 teaches contextual interaction. Exercise 10 combines the previously learned mechanics into one continuous traversal sequence.

### 13.2 Interaction Environment

A compact area containing a valid interaction target.

Required elements:

- A visible interaction object such as a training terminal.
- A position from which the prompt is readable.
- Clear space around the object.
- A distinct completion zone after the interaction.

The Interaction System owns target detection, selection, prompt data, and interaction execution. The level provides the interactable object and its interaction definition; it must not implement detection logic.

### 13.3 Combined Traversal Environment

A compact route containing:

1. Sprinting.
2. Jumping.
3. Sliding.
4. Vaulting.
5. Wallrunning.
6. Walljumping.
7. Landing.

The exact order may be adjusted to produce a coherent route.

Requirements:

- No instructional pause between every mechanic.
- Minimal text.
- Clear environmental guidance.
- Reasonable recovery after failure.
- A visible final marker.

### 13.4 Geometry Requirements

- Every traversal obstacle on the combined route must reuse the same gameplay metadata and collision conventions as the individual exercises.
- The route must not require a mechanic that has no corresponding canonical exercise.
- Spacing must allow continuous movement rather than stop-and-restart attempts between every obstacle.
- Recovery points must keep retries short.

### 13.5 Evaluation Support

The environment must expose:

- Interaction target and completion zone.
- Required traversal obstacles with their metadata.
- Start and finish zones for the combined route.

The Training System evaluates the required mechanics from gameplay events. Level scripts must not mark an exercise complete merely because the player entered a zone.

### 13.6 Recovery

A fall on the combined route returns the player to the most recent safe recovery point through the Respawn System.

Recovery must preserve the exercise state and allow immediate retry.

After successful traversal, the Training System marks the exercise complete and decides the next presentation. The level must not create a Prologue leaderboard entry.

---

# PART II — PROLOGUE

## 14. Prologue Overview

### 14.1 Purpose

Prologue is the first authored speedrun level.

It combines the mechanics introduced in Training into one continuous traversal route.

The level should feel like a short rooftop escape or urban delivery route.

It is not intended to reproduce the exact layout of the original Mirror's Edge campaign.

### 14.2 Target Duration

Initial design targets:

| Skill level | Target time |
|---|---:|
| First-time player | 2–3 minutes |
| Familiar player | 1–2 minutes |
| Optimized run | Subject to playtesting |

These are prototype goals, not guaranteed completion times.

The level should be tuned after the movement system and route geometry are playable.

### 14.3 Level Structure

The Prologue contains five sections:

1. Rooftop.
2. Industrial.
3. Construction.
4. Skybridge.
5. Finish.

```text
START
  |
  v
01 ROOFTOP
  |
  v
02 INDUSTRIAL
  |
  v
03 CONSTRUCTION
  |
  v
04 SKYBRIDGE
  |
  v
05 FINISH
  |
  v
RESULTS
```

Each section introduces a distinct environmental identity and traversal challenge.

### 14.4 Route Design

The main route must be authored and deterministic.

Do not randomly generate the location of critical obstacles or checkpoints.

Procedural variation may be applied to:

- Background buildings.
- Non-critical rooftop equipment.
- Facade patterns.
- Decorative industrial elements.
- Material variation.

The actual speedrun route must remain stable.

---

## 15. Prologue Introduction

### 15.1 Opening Experience

The player begins on a rooftop with a view of the city.

The opening should establish atmosphere without using a full cinematic sequence.

Elements:

- Open sky.
- Distant skyline.
- Wind and city ambience.
- A short radio transmission.
- A visible route direction.
- A clear starting point.

### 15.2 Radio Message

The radio message should be short and functional.

It communicates:

- The destination.
- The urgency of the task.
- The availability of the route.

Avoid lengthy dialogue or extensive narrative exposition.

Voice content may be synthesized using the project's procedural audio system or represented by concise UI text.

### 15.3 Start Sequence

Suggested sequence:

1. Load the level.
2. Position the player at the starting rooftop.
3. Show the environment.
4. Play ambient sound.
5. Present the short radio message.
6. Display `RUNNER ROUTE AVAILABLE`.
7. Show the start prompt.
8. Start the timer when the player begins the run.

The introduction must not inflate the recorded speedrun time unless the timer rules explicitly include it.

---

## 16. Section 01 — Rooftop

**Environment:** Open rooftop and surrounding office buildings.

**Gameplay purpose:** Establish movement and introduce the first route decisions.

### 16.1 Visual Elements

- White concrete rooftop.
- Parapets.
- Ventilation units.
- Pipes.
- Rooftop access structures.
- Distant buildings.
- Red route markings.

### 16.2 Traversal Sequence

Recommended sequence:

1. Start running.
2. Build sprint speed.
3. Navigate rooftop equipment.
4. Jump across a small gap.
5. Land on a lower or adjacent platform.
6. Continue toward the industrial section.

### 16.3 Design Requirements

- The starting area must provide sufficient acceleration distance.
- The first jump must be readable.
- Landing surfaces must be wide enough for initial attempts.
- Decorative rooftop elements must not obstruct the route.
- The route toward the next section must be visible.

### 16.4 Checkpoint

Place the first checkpoint inside the Rooftop section, at the start roof
(implemented as `cp_rooftop`). It doubles as the initial fall-recovery anchor.

The checkpoint should be activated automatically when crossed.

---

## 17. Section 02 — Industrial

**Environment:** Industrial rooftop infrastructure.

**Gameplay purpose:** Combine sliding, vaulting, and wallrunning.

### 17.1 Visual Elements

- Large gray concrete structures.
- Ventilation ducts.
- Red-painted pipes.
- Metal railings.
- Technical platforms.
- Industrial equipment.
- Narrow maintenance walkways.

### 17.2 Traversal Sequence

Recommended sequence:

1. Enter an industrial corridor.
2. Slide under a low ventilation structure.
3. Vault over a barrier.
4. Accelerate along a straight section.
5. Wallrun along a designated surface.
6. Walljump or exit onto a platform.
7. Continue toward the construction area.

### 17.3 Design Requirements

The section must provide enough space to approach obstacles at the intended speed.

The slide passage must be physically compatible with the reduced player capsule.

The vault obstacle must expose the correct gameplay metadata.

The wallrun surface must have a valid entry and exit.

Do not require the player to perform an extremely precise wallrun immediately after an unavoidable collision.

### 17.4 Checkpoint

Place the second checkpoint inside the Industrial section, after the wallrun
exit (implemented as `cp_industrial`).

---

## 18. Section 03 — Construction

**Environment:** Temporary construction structures between buildings.

**Gameplay purpose:** Introduce vertical traversal and combine wall movement with short platforming.

### 18.1 Visual Elements

- Metal scaffolding.
- Exposed steel beams.
- Temporary platforms.
- Safety railings.
- Vertical support structures.
- Concrete building surfaces.

### 18.2 Traversal Sequence

Recommended sequence:

1. Enter the scaffold structure.
2. Navigate a narrow platform.
3. Jump to a higher platform.
4. Perform a wallrun along a supported scaffold surface.
5. Use a walljump to reach the upper platform.
6. Continue toward the exit.

Only the mechanics in the initial movement set may be required here.

### 18.3 Design Requirements

The section must make vertical progression understandable.

Use environmental composition to show the next reachable platform.

Avoid requiring blind jumps where the destination is not visible.

Scaffolding must have predictable collision geometry.

Wallrun and walljump surfaces must expose correct metadata and provide a safe landing area.

### 18.4 Checkpoint

Place the third checkpoint inside the Construction section, at the exit from
the construction stair climb (implemented as `cp_construction`).

This should provide a stable recovery point before the Skybridge section.

---

## 19. Section 04 — Skybridge

**Environment:** Elevated connection between buildings.

**Gameplay purpose:** Create a visual and traversal transition with a major jump and a momentum-driven approach.

### 19.1 Visual Elements

- Elevated bridge.
- Large open skyline view.
- Metal or concrete structural supports.
- Narrow traversal surfaces.
- Safety structures where appropriate.
- Strong architectural silhouettes.

### 19.2 Traversal Sequence

Recommended sequence:

1. Approach the elevated bridge.
2. Build speed.
3. Perform a larger jump between structures.
4. Land on a narrow or elevated platform.
5. Maintain momentum through a short sequence of low obstacles.
6. Continue toward the finish rooftop.

### 19.3 Design Requirements

The major jump must be achievable using the intended movement parameters.

Landing geometry must account for:

- Horizontal momentum.
- Vertical jump trajectory.
- Player capsule dimensions.
- Air control.
- Landing detection.

The momentum sequence should challenge movement control without requiring pixel-perfect input.

The section should provide a clear view of the finish area.

### 19.4 Checkpoint

Place the fourth checkpoint inside the Skybridge section, after the major jump
and momentum sequence (implemented as `cp_skybridge`).

The player should not have to repeat the entire Skybridge after a failure near the finish.

---

## 20. Section 05 — Finish

**Environment:** Final rooftop.

**Gameplay purpose:** Complete the run and record the result.

### 20.1 Visual Elements

- Clean rooftop platform.
- Visible finish marker.
- Minimal architectural clutter.
- Clear destination area.
- Distinct finish visual indicator.

### 20.2 Traversal Sequence

The final approach should be simple.

The player should be able to recognize the finish area without confusing it with an ordinary checkpoint.

### 20.3 Finish Validation

The level provides a single unambiguous finish trigger.

Run completion is determined by the Speedrun System (`09_SPEEDRUN_SYSTEM_SPEC.md`). The level must not decide completion itself.

### 20.4 Checkpoint

Place the fifth and final required checkpoint inside the Finish section,
before the finish trigger (implemented as `cp_finish`).

The authored finish area must make it impossible to reach the finish trigger before the intended route under normal traversal, and the trigger must not overlap unrelated geometry.

Do not complete the run merely because the player touches an arbitrary object near the finish.

### 20.4 Results

After completion, the owning systems perform the result sequence:

- The Speedrun System stops the timer and builds the run result.
- The Statistics System supplies the finalized session statistics summary.
- The Speedrun System validates the route and compares records.
- The Save System persists the validated record.
- The Results screen displays authoritative result data.

The level's only responsibility is the authored finish trigger and the surrounding presentation.

---

# PART III — ROUTE AND CHECKPOINT SYSTEM

## 21. Route Definition

### 21.1 Authored Route

The Prologue route must be defined explicitly.

It should contain:

- Route identifier.
- Ordered checkpoints.
- Finish trigger.
- Optional route segments.
- Validation rules.
- Recovery points.

The route definition is independent of visual geometry.

### 21.2 Checkpoint Authoring Data

Level design authors checkpoint trigger volumes and spawn point references.

Runtime checkpoint models are owned by the Checkpoint System (`16_CHECKPOINT_SYSTEM_SPEC.md`). The required route sequence is owned by the Speedrun System (`09_SPEEDRUN_SYSTEM_SPEC.md`).

Illustrative authored definition:

```ts
interface AuthoredCheckpoint {
  id: string;
  sectionId: string;
  trigger: TriggerDefinition;
  spawnPointId: string;
  displayName: string;
}
```

The level must not duplicate runtime progress fields, activation history, or route-order validation state.

Use the actual project coordinate and trigger types.

### 21.3 Checkpoint Activation

Checkpoint activation is owned by the Checkpoint System.

The level's responsibilities are limited to:

1. Authoring a trigger volume in traversable space.
2. Authoring a valid spawn point reference resolved by Level Runtime.
3. Placing the checkpoint where following the route naturally crosses it.
4. Emitting a spatial activation signal through the trigger mechanism.

Level scripts must not implement activation rules, duplicate-activation handling, split timing, or route progress.

The consequence of activation — checkpoint progress, split time, route validation — is handled by the owning systems.

### 21.4 Checkpoint Order

The required order is fixed by the route definition owned by the Speedrun System.

The initial Prologue should not contain optional shortcuts that bypass mandatory checkpoints.

Authored checkpoint placement must match the required sequence to avoid accidental out-of-order activation.

If alternative routes are introduced later, they must have explicit validation rules.

### 21.5 Recovery

If a player falls or enters a kill or out-of-bounds region:

- Level-authored boundaries and volumes detect the failure condition.
- A recovery request is issued to the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`).
- `RespawnManager` orchestrates the complete recovery lifecycle.
- The Checkpoint System supplies the recovery destination.
- Movement and Camera Systems reset their transient state through their owning interfaces.

Level scripts must not place the player, reset movement state, or execute a custom recovery sequence.

Whether a fall invalidates the run is a Speedrun policy, evaluated by the Respawn System before recovery. Do not assume every fall should invalidate the run.

---

## 22. Route Validation

Route validation is owned by the Speedrun System (`09_SPEEDRUN_SYSTEM_SPEC.md`). This section defines what the authored level must provide so that validation is possible and fair.

### 22.1 Validation Requirements

The level must provide:

- Authored checkpoint triggers in the required order.
- A single unambiguous finish trigger.
- Section boundaries aligned with the five Prologue sections.
- Valid spawn points for every checkpoint.
- Out-of-bounds and kill volumes that prevent accidental level escape.

The Speedrun System determines whether an activated checkpoint sequence constitutes a valid run.

### 22.2 Invalid Conditions

The level design must avoid accidental invalid conditions such as:

- A checkpoint that can be reached without following the intended route.
- A finish trigger reachable before all required checkpoints in normal traversal.
- Out-of-bounds regions that are reachable through normal play.
- Trigger volumes that overlap or activate unintentionally.

The level must not encode its own invalidation rules. The Speedrun System owns route validation policy.

### 22.3 Recovery and Validity

Whether falling:

- Adds a time penalty.
- Requires a checkpoint recovery.
- Invalidates the run.
- Allows continued play without a penalty.

is a Speedrun System policy coordinated through the Respawn System.

For the initial prototype, the simplest consistent policy is preferable.

The policy must be visible to the player and consistently applied.

---

# PART IV — GEOMETRY AND GAMEPLAY CONSTRAINTS

## 23. Player Clearance

All level geometry must account for the player capsule and movement states.

Baseline player dimensions are owned by `12_MOVEMENT_SYSTEM_SPEC.md` §5.3:

- Capsule radius: approximately 0.30 m.
- Standing capsule height: approximately 1.75 m.
- Camera eye height: approximately 1.60 m.

These are provisional prototype values and must be read from the Movement System's tuning configuration rather than duplicated in level content.

### 23.1 Standing Clearance

Standing passages must provide sufficient vertical and horizontal clearance for the player capsule.

Avoid geometry that visually appears passable but blocks the player.

### 23.2 Sliding Clearance

Sliding passages must support the reduced capsule dimensions.

The player must be able to enter and exit the passage without collision overlap.

### 23.3 Jump Clearance

Jump trajectories must account for:

- Initial vertical velocity.
- Gravity.
- Horizontal speed.
- Air control.
- Player capsule radius.
- Landing surface dimensions.

Do not validate a jump using visual distance alone.

Use actual physics and playtesting.

### 23.4 Landing Surfaces

Landing surfaces should provide a reasonable tolerance for movement variation.

Important landing platforms should be wider than the minimum theoretical capsule footprint.

The exact dimensions depend on approach speed and jump difficulty.

---

## 24. Obstacle Design

### 24.1 General Rules

Every obstacle should communicate:

- Its intended interaction.
- Its approximate physical dimensions.
- Its relation to the route.
- Its expected traversal method.

Avoid visually ambiguous objects.

### 24.2 Vault Obstacles

Vault obstacles must:

- Have a supported height range.
- Provide a valid approach surface.
- Provide a safe exit area.
- Expose the correct gameplay metadata.
- Have predictable collision geometry.

### 24.3 Wallrun Surfaces

Wallrun surfaces must:

- Be long enough for the intended action.
- Provide a valid entry angle.
- Have a safe exit.
- Avoid unexpected interruptions.
- Use consistent collision normals.

### 24.4 Wall-Jump Surfaces

Wall-jump surfaces must:

- Support a valid wallrun approach.
- Provide a visible landing target.
- Have a safe recovery area.
- Lead to a valid standing surface.
- Expose explicit wallrun and landing metadata.

### 24.5 Landing Surfaces

Landing surfaces should provide:

- A clear approach direction.
- A continuous, stable collision surface.
- A visible landing zone.
- A safe recovery area.

### 24.6 Checkpoint and Finish Triggers

Checkpoint and finish triggers must:

- Be placed in traversable, non-colliding space.
- Have an unambiguous activation volume.
- Be readable in the environment.
- Reference a valid spawn point managed by Level Runtime.
- Never rely on visual geometry alone for activation.

Checkpoint activation, progress, and recovery destination data are owned by the Checkpoint System (`16_CHECKPOINT_SYSTEM_SPEC.md`). The level provides the authored trigger and spawn point references only.

---

# PART V — LEVEL PRESENTATION

## 25. Environmental Navigation

### 25.1 Route Guidance

Use a combination of environmental and UI navigation.

Environmental guidance:

- Red arrows.
- Painted markings.
- Contrasting platforms.
- Repeated visual motifs.
- Architectural framing.

UI guidance:

- Minimal direction indicator.
- Runner Vision.
- Checkpoint notifications.
- Section progress.

The environment should remain understandable without relying entirely on HUD guidance.

### 25.2 Runner Vision Rules

Runner Vision presentation is owned by the UI layer (`07_UI_UX_SPEC.md` §8).

The level's responsibility is to author navigation data that Runner Vision can consume:

- Mark the intended next traversal target.
- Mark route transitions and section entries.
- Mark checkpoints and the finish.
- Avoid ambiguous or competing highlight targets in the same sightline.

The level must not implement Runner Vision rendering or highlight-selection logic.

Presentation rules — highlight priority, switching behavior, intensity, and accessibility — are defined in `07_UI_UX_SPEC.md`.

### 25.3 Checkpoint Presentation

Checkpoint activation should provide clear feedback.

Possible elements:

- Short sound.
- Brief visual animation.
- Small HUD notification.
- Updated progress indicator.

Avoid long blocking animations.

### 25.4 Section Transitions

Transitions between sections should be readable through architecture and environment.

Do not use loading screens between the five Prologue sections unless a technical limitation requires them.

The initial Prologue should ideally be one continuous playable level.

---

## 26. Difficulty and Accessibility

### 26.1 Difficulty Progression

Training introduces mechanics in isolation.

Prologue increases challenge through combinations of mechanics and tighter route transitions.

Do not increase difficulty exclusively by making every platform smaller.

Vary challenge through:

- Approach speed.
- Obstacle sequence.
- Elevation.
- Route visibility.
- Landing direction.
- Momentum management.

### 26.2 Recovery

Provide reasonable recovery opportunities.

A failed jump should not necessarily require restarting the entire level.

Use checkpoints to keep retries short.

### 26.3 Accessibility

Level design should preserve comprehension for players using supported accessibility settings.

Where practical:

- Keep the route understandable when camera effects are reduced.
- Keep critical route information available without color alone.
- Provide sufficient contrast for navigation markings.
- Avoid geometry that requires intense screen motion to read.
- Keep checkpoints and the finish readable without effects.

Accessibility preferences are stored by the Settings System (`25_SETTINGS_SYSTEM_SPEC.md`) and applied by the owning systems. Level design must not implement or store accessibility settings.

Avoid making camera effects essential for gameplay comprehension.

---

# PART VI — LEVEL DATA AND TESTING

## 27. Level Configuration

### 27.1 Configuration Principles

Level configuration should define:

- Level ID.
- Generation seed.
- Spawn position.
- Environment composition.
- Gameplay route.
- Checkpoints.
- Recovery positions.
- Finish trigger.
- Optional presentation settings.

The exact schema should be developed alongside the level implementation.

### 27.2 Authored Layout

The initial levels should use authored layouts.

Do not attempt to generate the complete Training or Prologue route procedurally.

Use procedural generators to create the structures referenced by the layout.

This allows gameplay geometry to remain stable while environmental details vary.

### 27.3 Stable Level Seeds

Each level should have a stable generation seed.

Changing the level seed may alter permitted procedural details, but must not invalidate the authored route.

---

## 28. Testing Requirements

### 28.1 Training Tests

Verify:

- All ten exercises have an authored environment that can be entered.
- Exercise environments expose the required start, target, and finish zones.
- The Training System can evaluate each exercise from gameplay events without level-side authority.
- Invalid attempts do not grant completion.
- Falling or leaving bounds allows recovery through the Respawn System.
- Completed exercises remain accessible.
- Training does not create Prologue records.

### 28.2 Prologue Tests

Verify:

- Player spawns correctly.
- All five sections are connected.
- Required checkpoints activate in order.
- Recovery destinations are valid.
- The finish trigger works.
- Route validation rejects invalid completion.
- Valid runs produce results.
- Level restart resets transient state.

### 28.3 Gameplay Tests

Test important transitions:

- Sprint to jump.
- Jump to landing.
- Sprint to slide.
- Approach to vault.
- Sprint to wallrun.
- Wallrun to walljump.
- Walljump to landing.
- Fall to recovery.

### 28.4 Geometry Tests

Verify:

- No unintended collision gaps.
- No invisible barriers.
- No player spawn overlap.
- No impossible jumps.
- No unreachable platforms.
- No blocked sliding passages.
- No invalid checkpoint placement.

### 28.5 Playtesting

Both levels require repeated manual playtesting.

Measure:

- Completion time.
- Failed attempts.
- Missed route transitions.
- Unexpected collisions.
- Player confusion.
- Checkpoint recovery time.
- Performance.

Do not finalize target times until the movement system and level geometry have been tuned together.

---

## 29. Implementation Order

Implement the levels in the following order.

### Phase 1 — Training Foundation

1. Create the Training level shell.
2. Add spawn and level bounds.
3. Build the movement yard environment.
4. Implement the Basic Movement and Running environments.
5. Add exercise start points and recovery volumes.

### Phase 2 — Training Mechanics

6. Add the Basic Jump environment.
7. Add the Basic Vault environment.
8. Add the Slide environment.
9. Add the Wall Run environment.
10. Add the Wall Jump environment.
11. Add the Controlled Landing environment.
12. Add the Interaction Basics environment.
13. Add the Parkour Sequence environment.

Exercise objectives and evaluation are implemented in `21_TRAINING_SYSTEM_SPEC.md`; this phase delivers the environments and the metadata they expose.

### Phase 3 — Prologue Foundation

14. Create the Prologue level shell.
15. Define the authored route.
16. Build the Rooftop section.
17. Add checkpoint trigger and spawn point authoring.
18. Build the Industrial section.
19. Build the Construction section.
20. Build the Skybridge section.
21. Build the Finish section.

### Phase 4 — Integration

22. Integrate route validation through the Speedrun System.
23. Integrate speedrun timer and splits.
24. Integrate results and statistics.
25. Add environmental navigation and Runner Vision navigation data.
26. Add introductory presentation.
27. Tune traversal difficulty.

Do not implement all level geometry before the player controller and core parkour mechanics are sufficiently stable.

---

## 30. Definition of Done

### Training

- Ten exercise environments are implemented.
- Each environment supports the objective defined by the Training System.
- Required mechanics are validated through actual gameplay behavior.
- Exercise availability and completion are owned by the Training System.
- Failures can be recovered from through the Respawn System.
- Training completion is tracked separately.
- Training does not affect the Prologue leaderboard.

### Prologue

- Five sections are implemented.
- The route is continuous.
- All mandatory checkpoints work.
- Recovery behavior is predictable.
- The finish trigger validates the route.
- Invalid completion is rejected.
- Valid runs produce results.

### Geometry

- All required traversal surfaces are physically valid.
- Player clearance is correct.
- No unintended collision barriers exist.
- Generated objects use appropriate gameplay metadata.
- Collision geometry is independent from decorative geometry.

### Presentation

- Route direction is understandable.
- Checkpoint feedback is clear.
- Runner Vision is useful but not mandatory.
- Environmental composition supports traversal.
- Section transitions are readable.

### Performance

- Level initialization is controlled.
- Generated resources are released on unload.
- No significant frame-time spikes occur during normal gameplay.
- Repeated environment geometry is reused where appropriate.

---

## 31. AI Agent Rules

When implementing levels:

1. Read the project brief, gameplay specification, asset bible, and procedural generation specification.
2. Inspect existing player and physics implementations.
3. Build levels using the established architecture.
4. Keep critical gameplay layouts authored and deterministic.
5. Use procedural generators for reusable environmental structures.
6. Validate actual player movement rather than theoretical geometry alone.
7. Keep checkpoint and route validation separate from visual presentation.
8. Do not create decorative collision geometry unnecessarily.
9. Add tests for checkpoint placement, spawn resolution, and exercise environment reachability.
10. Playtest every new traversal sequence.
11. Do not modify unrelated systems.
12. Document any changes to route requirements or difficulty.
13. Do not implement checkpoint activation, progress, or recovery logic in level scripts.
14. Do not implement route validation or run timing in level scripts.
15. Do not implement player placement or movement reset in level scripts; use the Respawn System.
16. Do not require mechanics outside the initial movement set — no ledge grabbing, climbing, balancing, or ziplines.
17. Expose authored data (triggers, spawn points, gameplay metadata) to the owning systems rather than embedding behavior in level content.

If a planned obstacle is not reliably achievable with the current movement system, adjust the obstacle or report the required gameplay change. Do not hide the problem with arbitrary collision exceptions.

---

## 32. Final Design Principle

Training teaches the language of movement.

Prologue uses that language to create a continuous traversal experience.

Both levels must be readable, physically consistent, and rewarding to replay.

Procedural architecture provides variety and scale, while authored route design guarantees intentional gameplay.

**Every obstacle must have a purpose. Every route must be understandable. Every traversal challenge must be physically achievable.**