# 06_LEVEL_DESIGN_SPEC.md

**Project:** MIRROR'S EDGE — RUNNER PROTOCOL  
**Document:** Level Design Specification  
**Version:** 1.0  
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
- Enable wallrunning.
- Provide a climbing route.
- Create a balancing challenge.
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

A ledge that can be climbed in one location should not unexpectedly fail in another location because of slightly different collision geometry.

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
- `climbableLedge`
- `balanceSurface`
- `ziplineAnchor`
- `checkpoint`
- `finishTrigger`
- `hazard`

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
    │   ├── CheckpointDefinition.ts
    │   ├── RouteDefinition.ts
    │   └── LevelValidation.ts
    │
    ├── training/
    │   ├── TrainingLevel.ts
    │   ├── TrainingLayout.ts
    │   ├── TrainingConfig.ts
    │   ├── TrainingProgress.ts
    │   └── exercises/
    │       ├── MovementExercise.ts
    │       ├── JumpingExercise.ts
    │       ├── SlidingExercise.ts
    │       ├── VaultingExercise.ts
    │       ├── WallrunExercise.ts
    │       ├── ClimbingExercise.ts
    │       ├── BalanceZiplineExercise.ts
    │       └── FinalRunExercise.ts
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

A level should support:

1. Load configuration.
2. Generate or instantiate environment assets.
3. Register collision geometry.
4. Register gameplay metadata.
5. Initialize checkpoints and triggers.
6. Place the player at the spawn point.
7. Activate gameplay.
8. Handle completion or failure.
9. Unload the environment.
10. Release owned resources.

Level initialization must not start the run timer before the player is ready to begin the actual run.

### 4.3 Level Configuration

Level-specific settings should be explicit and typed.

Illustrative example:

```ts
interface LevelConfig {
  id: string;
  seed: number;
  spawnPosition: Vector3Data;
  bounds: LevelBounds;
  checkpoints: CheckpointDefinition[];
  route: RouteDefinition;
}
```

Use the actual project types and coordinate conventions.

Do not store arbitrary gameplay behavior in untyped configuration objects.

---

# PART I — TRAINING

## 5. Training Overview

### 5.1 Purpose

Training is a dedicated environment for learning the movement system.

It is not a speedrun level and must not contribute to the Prologue leaderboard.

The player learns mechanics through practical exercises rather than text-only instructions.

Each exercise should:

1. Explain the required action.
2. Show a clear visual target.
3. Wait for player input.
4. Detect actual gameplay behavior.
5. Confirm successful execution.
6. Unlock the next exercise or area.

### 5.2 Environment

Training takes place on an isolated rooftop facility.

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

Use a sequence of distinct training areas.

Recommended structure:

```text
Training Spawn
      |
      v
01 Movement
      |
      v
02 Jumping
      |
      v
03 Sliding
      |
      v
04 Vaulting
      |
      v
05 Wallrun
      |
      v
06 Climbing
      |
      v
07 Balance and Zipline
      |
      v
08 Final Run
      |
      v
Training Complete
```

The areas may be arranged linearly, around a central rooftop, or across connected rooftop platforms.

The exact layout should prioritize clarity and short transitions between exercises.

### 5.4 Exercise Progression

Exercises should unlock sequentially.

The player may revisit completed exercises.

Progress should be stored locally if the project persistence system supports it.

Training completion is independent of Prologue completion.

---

## 6. Training Exercise 01 — Movement

<escape> </escape>

**Objective:** Learn basic movement, acceleration, sprinting, and camera control.

### Environment

A wide, unobstructed rooftop lane.

Required elements:

- Starting marker.
- Long straight running surface.
- Directional markers.
- Optional gentle turns.
- Finish marker.

Avoid obstacles during the initial movement demonstration.

### Instructions

Teach:

- WASD movement.
- Mouse camera control.
- Walking.
- Running.
- Sprinting.
- Releasing movement.
- Direction changes.

### Validation

The exercise should detect:

- Player movement in the requested direction.
- Reaching a minimum distance.
- Sprint input.
- A change in movement speed.
- Camera input, if practical to validate without making it a progression blocker.

Do not require the player to achieve an exact speed.

Use reasonable tolerances.

### Completion

Complete after the player demonstrates basic movement and reaches the exercise endpoint.

---

## 7. Training Exercise 02 — Jumping

**Objective:** Learn jumping, air control, and landing.

### Environment

A sequence of platforms with increasing gaps.

Suggested progression:

1. Small gap.
2. Medium gap.
3. Elevated landing platform.
4. Directional jump.

### Instructions

Teach:

- Jump input.
- Taking off while moving.
- Preserving horizontal momentum.
- Air direction adjustment.
- Landing on a target surface.

### Validation

Detect:

- Jump state entered.
- Player left the ground.
- Player reached the intended landing region.
- Landing completed successfully.

A jump input alone is not sufficient.

### Failure Handling

If the player falls:

- Reset to a safe nearby spawn.
- Preserve exercise progress.
- Allow immediate retry.

### Completion

Complete after the player performs the required jump and lands in the target area.

---

## 8. Training Exercise 03 — Sliding

**Objective:** Learn sliding under low obstacles while preserving momentum.

### Environment

A straight running lane with low overhead obstacles.

Required elements:

- Run-up area.
- Slide entry zone.
- Low clearance obstacle.
- Exit area.

### Instructions

Teach:

- Building sufficient speed.
- Holding the slide input.
- Maintaining movement during the slide.
- Returning to normal movement.

### Validation

Detect:

- Minimum entry speed.
- Transition into `SLIDING`.
- Successful traversal beneath the obstacle.
- Exit without collision failure.

The exercise must verify the actual slide state, not just the Ctrl key input.

### Geometry Requirements

Obstacle clearance must account for:

- Player standing capsule.
- Player sliding capsule.
- Collision margins.
- Camera placement.

The slide passage must be physically possible.

### Completion

Complete after the player successfully passes through the slide section.

---

## 9. Training Exercise 04 — Vaulting

**Objective:** Learn standard vaulting and speed vaulting.

### Environment

A sequence of obstacles:

- Low wall.
- Medium-height obstacle.
- Wider obstacle suitable for a speed vault.

### Instructions

Teach:

- Approaching an obstacle.
- Maintaining forward movement.
- Triggering a vault.
- Maintaining momentum.
- Choosing an appropriate approach angle.

### Validation

Detect:

- Valid vault target.
- Transition into `VAULTING`.
- Successful obstacle traversal.
- Exit on the intended side.

Do not mark the exercise complete if the player simply jumps over the obstacle without performing the vault mechanic.

### Completion

Complete after the required vault types have been demonstrated.

---

## 10. Training Exercise 05 — Wallrun

**Objective:** Learn horizontal wallrunning and walljumping.

### Environment

A clear wallrun corridor.

Required elements:

- Running approach.
- Continuous wall surface.
- Safe landing area.
- Optional second wall for wall-to-wall practice.

### Instructions

Teach:

- Approaching the wall at an appropriate angle.
- Maintaining sufficient speed.
- Initiating wallrun.
- Controlling movement.
- Jumping away from the wall.

### Validation

Detect:

- Valid wall contact.
- Transition into `WALLRUN`.
- Minimum wallrun duration or distance.
- Successful walljump.
- Safe landing.

The wallrun must not be counted if the player merely falls beside the wall.

### Geometry Requirements

Wallrun surfaces must:

- Have consistent collision.
- Be sufficiently long.
- Provide a safe exit.
- Expose explicit wallrun metadata.

### Completion

Complete after a valid wallrun and walljump sequence.

---

## 11. Training Exercise 06 — Climbing

**Objective:** Learn ledge grabbing, edge movement, and climbing.

### Environment

A vertical wall with several climbable ledges.

Required elements:

- Reachable ledge.
- Stable hanging position.
- Optional horizontal ledge section.
- Climbable exit platform.

### Instructions

Teach:

- Approaching a ledge.
- Triggering a grab.
- Maintaining a stable hanging position.
- Moving along the edge if supported.
- Pulling up onto the platform.

### Validation

Detect:

- Transition into `CLIMBING` or the appropriate hanging state.
- Stable ledge attachment.
- Successful climb completion.
- Arrival on the target platform.

### Failure Handling

If the player falls, reset to a safe starting point.

Avoid allowing the player to remain indefinitely attached to invalid geometry.

### Completion

Complete after the player successfully climbs onto the target platform.

---

## 12. Training Exercise 07 — Balance and Zipline

**Objective:** Learn balance control and zipline traversal.

This exercise contains two connected sub-exercises.

### 12.1 Balance

Environment:

- Narrow beam.
- Elevated platform.
- Safe landing surface.

Teach:

- Controlled movement.
- Small direction corrections.
- Maintaining balance.
- Reaching the end of the beam.

Validation should verify that the player traversed the designated balance surface using the balancing mechanic.

The implementation may use simplified balance physics rather than a complex simulation.

### 12.2 Zipline

Environment:

- Start platform.
- Zipline anchor.
- Cable.
- Landing platform.

Teach:

- Activating the zipline.
- Entering the traversal state.
- Maintaining the ride.
- Disembarking or reaching the endpoint.

Validation should verify:

- Correct zipline activation.
- Transition into `ZIPLINE`.
- Successful arrival at the destination.

### Completion

Complete when both sub-exercises are successfully finished.

---

## 13. Training Exercise 08 — Final Run

**Objective:** Combine previously learned mechanics into one short traversal sequence.

### Environment

A compact route containing:

1. Sprinting.
2. Jumping.
3. Sliding.
4. Vaulting.
5. Wallrunning.
6. Climbing.
7. Balancing or zipline traversal.

The exact order may be adjusted to produce a coherent route.

### Requirements

- No instructional pause between every mechanic.
- Minimal text.
- Clear environmental guidance.
- Reasonable recovery after failure.
- A visible final marker.

### Validation

Track required mechanics through actual gameplay events.

The player must complete the sequence in the intended order.

Optional mechanics should not be counted unless they are explicitly part of the exercise.

### Completion

After successful traversal:

- Display a completion message.
- Mark Training as completed.
- Return to the Training hub or show the main menu.
- Do not create a Prologue leaderboard entry.

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

<escape> </escape>

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

Place a checkpoint at the transition into the Industrial section.

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

Place a checkpoint after the wallrun exit, before entering the Construction section.

---

## 18. Section 03 — Construction

**Environment:** Temporary construction structures between buildings.

**Gameplay purpose:** Introduce vertical traversal and combine climbing with wall movement.

### 18.1 Visual Elements

- Metal scaffolding.
- Exposed steel beams.
- Temporary platforms.
- Safety railings.
- Ladders.
- Vertical support structures.
- Concrete building surfaces.

### 18.2 Traversal Sequence

Recommended sequence:

1. Enter the scaffold structure.
2. Navigate a narrow platform.
3. Jump to a higher platform.
4. Perform a wallrun or walljump transition.
5. Grab a ledge.
6. Move or climb to the upper platform.
7. Exit the scaffold structure.

### 18.3 Design Requirements

The section must make vertical progression understandable.

Use environmental composition to show the next reachable platform.

Avoid requiring blind jumps where the destination is not visible.

Scaffolding must have predictable collision geometry.

Climbable ledges must have sufficient clearance.

### 18.4 Checkpoint

Place a checkpoint at the exit from the construction area.

This should provide a stable recovery point before the Skybridge section.

---

## 19. Section 04 — Skybridge

**Environment:** Elevated connection between buildings.

**Gameplay purpose:** Create a visual and traversal transition with a major jump and balance challenge.

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
5. Traverse a short balance section.
6. Continue toward the finish rooftop.

### 19.3 Design Requirements

The major jump must be achievable using the intended movement parameters.

Landing geometry must account for:

- Horizontal momentum.
- Vertical jump trajectory.
- Player capsule dimensions.
- Air control.
- Landing detection.

The balance section should challenge movement control without requiring pixel-perfect input.

The section should provide a clear view of the finish area.

### 19.4 Checkpoint

Place a checkpoint after the major jump and balance section.

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

A run is complete only when:

- All mandatory checkpoints have been activated in order.
- The player enters the valid finish trigger.
- The player is in a valid gameplay state.
- The run has not been invalidated.
- The timer is active.

Do not complete the run merely because the player touches an arbitrary object near the finish.

### 20.4 Results

After completion:

- Stop the timer.
- Calculate final time.
- Calculate run statistics.
- Validate the route.
- Compare against the local personal best.
- Save a valid record.
- Display the results screen.

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

### 21.2 Checkpoint Data

Illustrative definition:

```ts
interface CheckpointDefinition {
  id: string;
  order: number;
  position: Vector3Data;
  rotation?: Vector3Data;
  triggerSize: Vector3Data;
  respawnPosition: Vector3Data;
}
```

Use the actual project coordinate types.

### 21.3 Checkpoint Activation

A checkpoint is activated when the player enters its trigger volume.

The system must:

1. Verify the checkpoint is the expected next checkpoint.
2. Register activation.
3. Record split time.
4. Update current route progress.
5. Emit the appropriate gameplay event.

Touching a checkpoint out of order must not silently validate the route.

### 21.4 Checkpoint Order

The required order is fixed.

The initial Prologue should not contain optional shortcuts that bypass mandatory checkpoints.

If alternative routes are introduced later, they must have explicit validation rules.

### 21.5 Respawn

If a player falls or enters an invalid region:

- Stop uncontrolled movement.
- Restore the player at the most recent valid recovery point.
- Reset transient movement states.
- Preserve the run's invalidation status where appropriate.
- Allow the player to continue if the design permits.

The exact penalty policy must be coordinated with the speedrun system.

Do not assume every fall should invalidate the run.

---

## 22. Route Validation

### 22.1 Validation Requirements

The run validator must determine whether the player completed the intended route.

It should verify:

- Checkpoints were activated in order.
- Required sections were completed.
- The finish trigger was reached.
- No invalid route transition occurred.
- The player did not bypass mandatory traversal requirements.

### 22.2 Invalid Conditions

Potential invalid conditions include:

- Skipping a mandatory checkpoint.
- Reaching the finish before all required checkpoints.
- Entering a prohibited out-of-bounds region.
- Using an invalid teleport or debug action in a recorded run.
- Violating an explicitly enforced route rule.

Do not invalidate a run merely because the player uses a different movement technique unless the route specification requires a specific action.

### 22.3 Recovery and Validity

Define whether falling:

- Adds a time penalty.
- Requires a checkpoint respawn.
- Invalidates the run.
- Allows continued play without a penalty.

For the initial prototype, the simplest consistent policy is preferable.

The policy must be visible to the player and consistently applied.

---

# PART IV — GEOMETRY AND GAMEPLAY CONSTRAINTS

## 23. Player Clearance

All level geometry must account for the player capsule and movement states.

Baseline player dimensions from `03_GAMEPLAY_SPEC.md`:

- Capsule radius: approximately 0.35 m.
- Standing height: approximately 1.75 m.
- Camera eye height: approximately 1.60 m.

These are provisional prototype values.

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

### 24.4 Climbing Ledges

Climbable ledges must:

- Have a clearly defined top edge.
- Provide enough room for player attachment.
- Have a reachable approach.
- Have sufficient clearance above the ledge.
- Lead to a valid standing surface.

### 24.5 Balance Surfaces

Balance surfaces should provide:

- A clear start.
- A continuous traversal surface.
- A visible endpoint.
- A safe recovery area.

### 24.6 Zipline

A zipline route must define:

- Start anchor.
- End anchor.
- Cable path.
- Activation region.
- Traversal direction.
- Exit behavior.

The initial implementation may use a straight or parameterized curve without physical rope simulation.

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

Runner Vision should highlight the next relevant route opportunity.

It must not highlight every object simultaneously.

Prioritize:

1. Immediate next traversal target.
2. Important route transition.
3. Checkpoint or finish.
4. Optional contextual hints.

The system should avoid rapidly switching between nearby objects.

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

Where practical, support:

- Adjustable mouse sensitivity.
- Reduced camera motion.
- Reduced head bob.
- Reduced FOV changes.
- Runner Vision intensity.
- Alternative control bindings.

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

- All eight exercises can be entered.
- Exercises unlock in the correct order.
- Each exercise detects the required mechanic.
- Invalid attempts do not grant completion.
- Falling allows recovery.
- Completed exercises remain accessible.
- Training does not create Prologue records.

### 28.2 Prologue Tests

Verify:

- Player spawns correctly.
- All five sections are connected.
- Required checkpoints activate in order.
- Respawn locations are valid.
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
- Fall to respawn.
- Ledge grab to climb.
- Balance to normal movement.
- Zipline to landing.

### 28.4 Geometry Tests

Verify:

- No unintended collision gaps.
- No invisible barriers.
- No player spawn overlap.
- No impossible jumps.
- No unreachable ledges.
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
3. Build a simple rooftop environment.
4. Implement the Movement exercise.
5. Add exercise progression and validation.

### Phase 2 — Training Mechanics

6. Add Jumping.
7. Add Sliding.
8. Add Vaulting.
9. Add Wallrun.
10. Add Climbing.
11. Add Balance and Zipline.
12. Add Final Run.

### Phase 3 — Prologue Foundation

13. Create the Prologue level shell.
14. Define the authored route.
15. Build the Rooftop section.
16. Add checkpoint handling.
17. Build the Industrial section.
18. Build the Construction section.
19. Build the Skybridge section.
20. Build the Finish section.

### Phase 4 — Integration

21. Integrate route validation.
22. Integrate speedrun timer.
23. Integrate results and statistics.
24. Add environmental navigation.
25. Add introductory presentation.
26. Tune traversal difficulty.

Do not implement all level geometry before the player controller and core parkour mechanics are sufficiently stable.

---

## 30. Definition of Done

### Training

- Eight exercises are implemented.
- Each exercise has a clear objective.
- Required mechanics are validated through actual gameplay behavior.
- Exercises unlock correctly.
- Failures can be recovered from.
- Training completion is tracked separately.
- Training does not affect the Prologue leaderboard.

### Prologue

- Five sections are implemented.
- The route is continuous.
- All mandatory checkpoints work.
- Respawn behavior is predictable.
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
9. Add tests for checkpoint order and exercise completion.
10. Playtest every new traversal sequence.
11. Do not modify unrelated systems.
12. Document any changes to route requirements or difficulty.

If a planned obstacle is not reliably achievable with the current movement system, adjust the obstacle or report the required gameplay change. Do not hide the problem with arbitrary collision exceptions.

---

## 32. Final Design Principle

Training teaches the language of movement.

Prologue uses that language to create a continuous traversal experience.

Both levels must be readable, physically consistent, and rewarding to replay.

Procedural architecture provides variety and scale, while authored route design guarantees intentional gameplay.

**Every obstacle must have a purpose. Every route must be understandable. Every traversal challenge must be physically achievable.**