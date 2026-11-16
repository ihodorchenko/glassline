# 21_TRAINING_SYSTEM_SPEC.md

# Training System Specification

**Project:** Mirror's Edge-Inspired First-Person Parkour Game  
**Document:** Training System  
**Version:** 1.0  
**Status:** Implementation Specification  
**Priority:** Core Gameplay System

---

## 1. Purpose

The Training System provides a structured environment where players can learn, practice, and improve the game's movement and traversal mechanics.

It introduces gameplay mechanics progressively through practical exercises rather than relying exclusively on text instructions.

The system must teach players:

- Basic movement.
- Running and sprinting.
- Jumping.
- Crouching and sliding.
- Vaulting.
- Wall running.
- Wall jumping.
- Landing and momentum control.
- Interaction mechanics.
- Checkpoint usage.
- Basic route navigation.
- Movement combinations.

Training should establish the mechanical foundation required to complete the Prologue.

The experience should be accessible to new players while remaining useful for players who want to improve their movement consistency and speed.

---

## 2. Design Philosophy

### 2.1 Learn by Doing

Every major mechanic should be introduced through an exercise.

The player should perform an action, receive immediate feedback, and understand whether the attempt was successful.

Text instructions should support gameplay rather than replace it.

### 2.2 Progressive Complexity

Exercises should introduce mechanics in a controlled order.

A new mechanic should initially be presented in isolation before being combined with previously learned mechanics.

### 2.3 Immediate Feedback

The player should receive clear feedback about:

- Correct action.
- Incorrect action.
- Successful traversal.
- Missed timing.
- Failed attempt.
- Exercise completion.

Feedback must be concise and visually consistent with the game's UI direction.

### 2.4 Repetition Without Friction

Exercises must be easy to restart.

Players should be able to repeat individual exercises without restarting the entire Training mode.

### 2.5 Shared Gameplay Systems

Training uses the same movement, camera, input, interaction, and level runtime systems as the Prologue.

Training must not create a separate movement implementation.

---

## 3. Scope and Ownership

### 3.1 Responsibilities

The Training System owns:

- Training exercise definitions.
- Exercise sequence and progression.
- Exercise lifecycle.
- Exercise objectives.
- Exercise completion conditions.
- Exercise failure conditions.
- Training-specific instructions.
- Training hints.
- Training feedback.
- Exercise scoring.
- Training session progress.
- Exercise restart requests.
- Training result generation.
- Training-specific tutorial triggers.

### 3.2 Non-responsibilities

The Training System does not own:

- Player movement physics.
- Movement state machine.
- Camera behavior.
- Input device handling.
- Generic interaction detection.
- Generic checkpoint activation.
- Respawn execution.
- Level loading.
- Gameplay session lifecycle.
- Persistent storage infrastructure.
- Main application navigation.
- HUD rendering.

These responsibilities belong to their respective systems.

### 3.3 Related Specifications

- `02_TECHNICAL_ARCHITECTURE.md`
- `03_GAMEPLAY_SPEC.md`
- `04_ASSET_BIBLE.md`
- `06_LEVEL_DESIGN_SPEC.md`
- `07_UI_UX_SPEC.md`
- `08_AUDIO_DESIGN_SPEC.md`
- `09_SPEEDRUN_SYSTEM_SPEC.md`
- `10_SAVE_SYSTEM_SPEC.md`
- `11_INPUT_SYSTEM_SPEC.md`
- `12_MOVEMENT_SYSTEM_SPEC.md`
- `13_CAMERA_SYSTEM_SPEC.md`
- `14_INTERACTION_SYSTEM_SPEC.md`
- `15_LEVEL_RUNTIME_SYSTEM_SPEC.md`
- `16_CHECKPOINT_SYSTEM_SPEC.md`
- `17_RESPAWN_SYSTEM_SPEC.md`
- `18_PLAYER_STATE_SYSTEM_SPEC.md`
- `19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`
- `20_GAMEPLAY_FLOW_SYSTEM_SPEC.md`

---

## 4. Training Mode Structure

### 4.1 Training Environment

Training takes place in a dedicated training environment.

The environment should contain clearly recognizable traversal elements:

- Flat movement areas.
- Straight running lanes.
- Jump platforms.
- Low obstacles.
- Vaultable objects.
- Sliding passages.
- Wall-running surfaces.
- Wall-jump opportunities.
- Landing platforms.
- Combined traversal routes.
- Training terminals.
- Exercise restart points.

The environment should use the established architectural and visual language of the game.

It should feel like a controlled urban training facility rather than a generic test map.

### 4.2 Training Sections

The initial Training mode should be divided into the following sections:

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

The sections should become available progressively.

The player must be able to replay previously completed exercises.

### 4.3 Exercise Structure

Each section contains one or more exercises.

An exercise should focus on one primary mechanic or a small combination of mechanics.

Example:

```text
Training
    |
    +-- Movement Basics
    |       |
    |       +-- Walk
    |       +-- Directional Movement
    |
    +-- Running and Sprinting
    |       |
    |       +-- Run
    |       +-- Sprint
    |
    +-- Jumping
    |       |
    |       +-- Basic Jump
    |       +-- Jump Distance
    |
    +-- Sliding
    |       |
    |       +-- Crouch
    |       +-- Slide Under Obstacle
    |
    +-- Vaulting
    |
    +-- Wall Running
    |
    +-- Wall Jumping
    |
    +-- Landing and Momentum
    |
    +-- Interaction
    |
    +-- Combined Traversal
```

### 4.4 Exercise Availability

An exercise may be:

- Available.
- Locked.
- In Progress.
- Completed.
- Mastered.

```ts
type TrainingExerciseStatus =
    | "locked"
    | "available"
    | "in_progress"
    | "completed"
    | "mastered";
```

A locked exercise must have an explicit prerequisite.

The system must not create progression deadlocks where an exercise becomes permanently inaccessible.

---

## 5. Training Exercise Model

### 5.1 TrainingExerciseDefinition

```ts
interface TrainingExerciseDefinition {
    id: string;

    sectionId: string;

    title: string;

    description: string;

    mechanic: TrainingMechanic;

    levelId: string;

    startPointId: string;

    objectives: TrainingObjectiveDefinition[];

    prerequisites: string[];

    restartPolicy: TrainingRestartPolicy;

    evaluation: TrainingEvaluationDefinition;

    hints: TrainingHintDefinition[];

    estimatedDuration?: number;

    optional: boolean;
}
```

Definitions must be authored data.

The Training System must not generate arbitrary level geometry during exercise initialization.

### 5.2 TrainingMechanic

```ts
type TrainingMechanic =
    | "movement"
    | "running"
    | "sprinting"
    | "jumping"
    | "crouching"
    | "sliding"
    | "vaulting"
    | "wall_running"
    | "wall_jumping"
    | "landing"
    | "interaction"
    | "combined_traversal";
```

### 5.3 Exercise Instance

The runtime representation of an exercise:

```ts
interface TrainingExerciseInstance {
    exerciseId: string;

    sessionId: string;

    attemptId: string;

    status: TrainingExerciseStatus;

    startedAt?: number;

    completedAt?: number;

    currentObjectiveIndex: number;

    attemptCount: number;

    collectedMetrics: TrainingExerciseMetrics;
}
```

Exercise instances must be session-scoped.

A stale exercise instance must not modify the state of a newer Training session.

---

## 6. Training Exercise Lifecycle

### 6.1 Exercise States

```ts
type TrainingExerciseRuntimeState =
    | "inactive"
    | "preparing"
    | "ready"
    | "active"
    | "evaluating"
    | "completed"
    | "failed"
    | "restarting"
    | "abandoned";
```

### 6.2 Lifecycle

```text
Inactive
   |
   v
Preparing
   |
   v
Ready
   |
   v
Active
   |
   +------> Evaluating
   |            |
   |            +----> Completed
   |            |
   |            +----> Failed
   |
   +------> Restarting
   |            |
   |            v
   |          Ready
   |
   +------> Abandoned
```

### 6.3 Preparing

The Training System:

1. Validates the exercise definition.
2. Checks prerequisites.
3. Validates required level objects.
4. Resolves the exercise start point.
5. Initializes objectives.
6. Resets exercise-specific metrics.
7. Requests player placement through the Respawn System where appropriate.
8. Prepares instructional presentation.
9. Enters `ready`.

The system must not directly move the player by modifying physics or transform state.

### 6.4 Ready

The exercise is prepared but has not started.

The player receives the initial instruction.

The exercise may begin:

- After a player confirmation.
- After a short countdown.
- Automatically when the player enters the designated start zone.

The start behavior must be defined per exercise.

### 6.5 Active

The player performs the exercise.

The Training System observes relevant gameplay events and updates objective progress.

It must not poll all movement properties every rendered frame when an event-based signal is available.

### 6.6 Evaluating

The system evaluates the exercise against its objective and scoring definitions.

Evaluation must be deterministic for identical input events and exercise configuration.

### 6.7 Completed

The exercise has satisfied its required completion conditions.

The system records the result and updates Training progress.

### 6.8 Failed

The exercise failed because of a defined condition.

Examples:

- Falling into a failure volume.
- Missing a required traversal target.
- Exceeding a configured time limit.
- Performing an invalid action where the exercise explicitly requires a specific action.

Failure must not be inferred merely because the player moved slowly.

### 6.9 Restarting

The exercise returns to its configured start state.

Restarting must:

- End the current attempt.
- Cancel active exercise timers.
- Clear temporary objective state.
- Reset exercise metrics.
- Resolve the start point.
- Reset player transient movement state through Movement and Respawn interfaces.
- Restore the initial instructional state.

The exercise attempt identifier must change on restart.

### 6.10 Abandoned

The player exits the current exercise without completing it.

The result may be recorded as an incomplete attempt for diagnostics or optional statistics.

It must not count as successful completion.

---

## 7. Objective System

### 7.1 Objective Model

Exercises are composed of objectives.

An objective represents a verifiable gameplay requirement.

```ts
interface TrainingObjectiveDefinition {
    id: string;

    description: string;

    type: TrainingObjectiveType;

    required: boolean;

    targetValue?: number;

    completionCondition: TrainingCompletionCondition;

    failureCondition?: TrainingFailureCondition;
}
```

### 7.2 Objective Types

```ts
type TrainingObjectiveType =
    | "reach_location"
    | "perform_action"
    | "perform_action_count"
    | "maintain_speed"
    | "traverse_surface"
    | "interact_with_target"
    | "complete_route"
    | "land_in_zone"
    | "avoid_obstacle"
    | "custom_event";
```

### 7.3 Objective Progress

```ts
interface TrainingObjectiveProgress {
    objectiveId: string;

    currentValue: number;

    targetValue?: number;

    completed: boolean;

    startedAt?: number;

    completedAt?: number;
}
```

### 7.4 Objective Evaluation

Objective evaluation must use authoritative events from the owning gameplay systems.

Examples:

- `jump_performed` from Movement System.
- `slide_started` from Movement System.
- `vault_completed` from Movement System.
- `wall_run_completed` from Movement System.
- `interaction_completed` from Interaction System.
- `checkpoint_activated` from Checkpoint System.
- `entered_training_zone` from Level Runtime.

The Training System must not infer a successful vault from player position alone when Movement System already exposes a vault completion event.

### 7.5 Objective Ordering

An exercise may define:

- Sequential objectives.
- Independent objectives.
- Optional objectives.
- Alternative objectives.

The initial implementation should support sequential and optional objectives.

Complex branching objectives are deferred.

### 7.6 Completion Conditions

An exercise is complete when all required objectives are satisfied and its evaluation policy accepts the attempt.

Optional objectives may improve the result but must not block completion.

---

## 8. Training Exercise Definitions

The initial implementation should include the following exercise set.

### 8.1 Movement Basics

**Exercise: Basic Movement**

Objectives:

- Move forward.
- Move backward.
- Move left.
- Move right.
- Reach the designated target.

Evaluation:

- All directional movement actions must be demonstrated.
- The player must reach the target area.

**Exercise: Directional Control**

Objectives:

- Change direction while moving.
- Navigate around a simple obstacle.
- Reach the finish zone.

Purpose:

Teach directional control and spatial awareness.

### 8.2 Running and Sprinting

**Exercise: Running**

Objectives:

- Reach a configured movement speed.
- Maintain movement for a short distance.
- Reach the finish zone.

**Exercise: Sprinting**

Objectives:

- Activate sprint.
- Maintain sprint movement.
- Reach the finish zone.

Evaluation may use movement metrics exposed by Movement System.

The Training System must not implement its own speed calculation.

### 8.3 Jumping

**Exercise: Basic Jump**

Objectives:

- Perform a jump.
- Land on a designated platform.

**Exercise: Jump Distance**

Objectives:

- Build sufficient approach speed.
- Jump across a gap.
- Land inside the target zone.

Evaluation may use:

- Jump event.
- Takeoff speed.
- Landing event.
- Target zone entry.

### 8.4 Crouching and Sliding

**Exercise: Crouch**

Objectives:

- Enter crouch.
- Move through a low-clearance area.
- Reach the target.

**Exercise: Slide**

Objectives:

- Build approach speed.
- Initiate slide.
- Pass beneath an obstacle.
- Exit the slide successfully.

The exercise must validate actual slide execution, not merely a crouch input.

### 8.5 Vaulting

**Exercise: Basic Vault**

Objectives:

- Approach a vaultable object.
- Execute a vault.
- Land safely beyond the obstacle.

Evaluation uses the Movement System's vault lifecycle events.

### 8.6 Wall Running

**Exercise: Wall Run**

Objectives:

- Approach a valid wall.
- Initiate wall running.
- Maintain the traversal for a configured duration or distance.
- Reach the exit platform.

The Training System must not perform wall detection.

### 8.7 Wall Jumping

**Exercise: Wall Jump**

Objectives:

- Initiate a valid wall run.
- Execute a wall jump.
- Land on the designated platform.

The exercise must use Movement System events to distinguish a wall jump from an ordinary jump.

### 8.8 Landing and Momentum

**Exercise: Controlled Landing**

Objectives:

- Jump from a designated platform.
- Land in the target zone.
- Avoid a hard failure landing where applicable.

**Exercise: Momentum Preservation**

Objectives:

- Approach at sufficient speed.
- Traverse a sequence of obstacles.
- Maintain acceptable speed through the route.

The exact speed thresholds must be configurable and use Movement System metrics.

### 8.9 Interaction

**Exercise: Interaction Basics**

Objectives:

- Detect a training terminal.
- Read the interaction prompt.
- Perform the Interact action.
- Complete the interaction.

The Interaction System owns target detection and interaction execution.

Training observes the completion event.

### 8.10 Combined Traversal

**Exercise: Parkour Sequence**

Objectives:

- Sprint.
- Jump.
- Vault.
- Slide.
- Wall run.
- Wall jump.
- Land in the finish zone.

The route should demonstrate how individual mechanics combine into continuous movement.

This exercise introduces the player to the traversal language required by the Prologue.

---

## 9. Training Event Integration

### 9.1 Event-Driven Evaluation

Training subscribes to events from:

- Movement System.
- Interaction System.
- Level Runtime.
- Checkpoint System.
- Player State System.
- Input System where action intent is relevant.

Events should be normalized through a Training event adapter.

### 9.2 TrainingEvent

```ts
interface TrainingEvent {
    id: string;

    type: string;

    sessionId: string;

    attemptId: string;

    timestamp: number;

    sourceSystem: string;

    payload?: Record<string, unknown>;
}
```

The event adapter must attach the current Training attempt identity where appropriate.

### 9.3 Event Validation

Before processing an event, verify:

- Session identity matches.
- Exercise attempt is active.
- Event timestamp is valid.
- Source system is authorized to emit the event.
- The event belongs to the current exercise generation.

Events from previous attempts must be ignored.

### 9.4 Event Ordering

When multiple events contribute to one objective, process them in a deterministic order.

The system must not assume that asynchronous event delivery always matches the player's visual experience.

---

## 10. Instruction and Hint System

### 10.1 Instruction Model

```ts
interface TrainingInstruction {
    id: string;

    title: string;

    body: string;

    inputAction?: string;

    visualReference?: string;

    displayDuration?: number;

    dismissible: boolean;
}
```

Instructions should explain:

- What the player should do.
- Which input action is relevant.
- What result is expected.

### 10.2 Hint Model

```ts
interface TrainingHintDefinition {
    id: string;

    trigger: TrainingHintTrigger;

    message: string;

    priority: number;

    cooldown?: number;

    maximumDisplays?: number;
}
```

### 10.3 Hint Triggers

```ts
type TrainingHintTrigger =
    | "exercise_started"
    | "objective_not_started"
    | "objective_failed"
    | "low_speed"
    | "repeated_failure"
    | "incorrect_action"
    | "player_stuck"
    | "manual_request";
```

### 10.4 Hint Behavior

Hints must:

- Be concise.
- Avoid repeating excessively.
- Respect cooldowns.
- Avoid interrupting critical traversal.
- Be dismissible where appropriate.
- Use current input bindings rather than hardcoded key labels.

### 10.5 Progressive Assistance

The initial implementation should support simple progressive hints.

Example:

1. Initial instruction.
2. Contextual reminder.
3. More explicit action guidance after repeated failure.

The system should not automatically complete exercises for the player.

### 10.6 Accessibility

Training instructions must support:

- Keyboard and mouse.
- Gamepad.
- Remapped controls.
- Reduced motion.
- Readable contrast.
- Clear text hierarchy.

---

## 11. Evaluation and Scoring

### 11.1 Evaluation Principles

Training should reward successful execution and encourage improvement.

The system must avoid excessive punishment for experimentation.

Completion and mastery must remain distinct.

### 11.2 Evaluation Model

```ts
interface TrainingEvaluationDefinition {
    completionRules: TrainingCompletionRule[];

    scoringRules: TrainingScoringRule[];

    masteryThreshold?: number;

    timeLimit?: number;

    allowMultipleAttempts: boolean;
}
```

### 11.3 Scoring Dimensions

Initial scoring may consider:

- Completion.
- Execution accuracy.
- Traversal time.
- Movement consistency.
- Required mechanic usage.
- Optional route efficiency.

Not every exercise needs a numeric score.

### 11.4 TrainingResult

```ts
interface TrainingResult {
    exerciseId: string;

    sessionId: string;

    attemptId: string;

    completed: boolean;

    mastered: boolean;

    score?: number;

    elapsedTime: number;

    attempts: number;

    metrics: TrainingExerciseMetrics;

    completedAt?: number;
}
```

### 11.5 Mastery

An exercise may be marked as mastered when the player reaches its configured mastery threshold.

Mastery must not be required to unlock the next mandatory exercise unless explicitly specified by the Training design.

### 11.6 Medals

The initial implementation may use:

- Completion.
- Bronze.
- Silver.
- Gold.

Medal thresholds must be defined per exercise.

Training medals are independent from Speedrun medals.

Do not reuse Speedrun scoring or validation rules.

---

## 12. Training Progression

### 12.1 Progress Model

```ts
interface TrainingProgress {
    completedExerciseIds: string[];

    masteredExerciseIds: string[];

    unlockedExerciseIds: string[];

    exerciseRecords: Record<string, TrainingExerciseRecord>;
}
```

### 12.2 Exercise Record

```ts
interface TrainingExerciseRecord {
    exerciseId: string;

    completed: boolean;

    mastered: boolean;

    bestScore?: number;

    bestTime?: number;

    totalAttempts: number;

    lastPlayedAt?: number;
}
```

### 12.3 Unlock Rules

The initial progression should be mostly sequential.

Completing a mandatory exercise unlocks the next exercise or section.

Optional exercises may be available independently.

The player must be able to replay unlocked exercises.

### 12.4 Prologue Access

The Training System may report that the required introductory exercises are completed.

The Progression System or gameplay flow policy determines whether this is required to access Prologue.

The Training System must not independently block the entire application from entering Prologue.

If the game design allows skipping Training, that path must remain available.

---

## 13. Training Checkpoints and Restart

### 13.1 Exercise Start Points

Each exercise references a Level Runtime spawn point.

The Training System does not create or position spawn points.

### 13.2 Restart Policy

```ts
type TrainingRestartPolicy =
    | "exercise_start"
    | "last_checkpoint"
    | "current_section_start";
```

The initial implementation should prioritize `exercise_start`.

Checkpoint-based restart may be enabled for longer combined exercises.

### 13.3 Restart Integration

When restarting:

1. Mark the current attempt as abandoned or failed according to policy.
2. Generate a new attempt ID.
3. Clear active objectives.
4. Cancel exercise-specific timers.
5. Request recovery through Respawn System.
6. Resolve the configured spawn point.
7. Reset transient movement state through Movement System.
8. Reset camera effects through Camera System.
9. Restore exercise instructions.
10. Enter `ready`.

The Training System must not directly reposition the player.

### 13.4 Failure Recovery

A failed exercise may offer:

- Retry.
- Show Hint.
- Return to Training Selection.

The initial implementation should always provide a retry path for mandatory exercises.

---

## 14. Training UI Integration

### 14.1 Training HUD

The Training HUD may display:

- Exercise title.
- Current instruction.
- Objective progress.
- Current hint.
- Completion feedback.
- Restart action.

It should not display unnecessary permanent information.

### 14.2 Objective Presentation

Objective feedback should be visually clear.

Example:

```text
OBJECTIVE

Reach the platform

[ ] Build speed
[ ] Jump across the gap
[ ] Land safely
```

The actual visual design must follow `07_UI_UX_SPEC.md`.

### 14.3 Completion Presentation

When an exercise is completed, display:

- Exercise title.
- Completion status.
- Score or medal where applicable.
- Best result improvement where applicable.
- Retry.
- Continue.
- Return to Training Selection.

### 14.4 Prompt Integration

Training instructions and hints must not conflict with generic Interaction prompts.

The UI presentation coordinator must resolve prompt priority.

For example, a required interaction prompt may take priority over a non-critical instructional hint.

### 14.5 Input Labels

Input labels must be resolved by Input System.

Never hardcode a specific key name in the exercise definition.

---

## 15. Audio Integration

The Training System may request audio feedback for:

- Exercise start.
- Objective completion.
- Hint presentation.
- Exercise failure.
- Exercise completion.
- Medal achievement.

Audio playback remains owned by Audio System.

Audio feedback must be configurable and must not interfere with spatial gameplay cues.

---

## 16. Persistence

### 16.1 Ownership

Training owns the meaning of Training progress.

Save System owns the persistence infrastructure.

Training must not directly access IndexedDB.

### 16.2 Persisted Data

The following information should be persisted:

- Completed exercises.
- Mastered exercises.
- Unlocked exercises.
- Best scores.
- Best times.
- Attempt counts.
- Last played timestamps.

### 16.3 Save Timing

Save progress after:

- Successful exercise completion.
- Mastery improvement.
- Unlock progression.
- Relevant Training session completion.

Temporary attempt state does not need to be persisted in the initial implementation.

### 16.4 Recovery

If persistence fails:

- Preserve the current in-memory result.
- Notify the Save System.
- Avoid duplicating progression updates.
- Allow the player to continue Training.
- Report the failure through diagnostics.

---

## 17. Integration with Other Systems

### 17.1 Gameplay Session System

Gameplay Session owns the Training session lifecycle.

Training owns exercise lifecycle inside that session.

The relationship is:

```text
Gameplay Session
    |
    v
Training Session
    |
    v
Training Exercise
    |
    v
Training Objectives
```

### 17.2 Gameplay Flow System

Gameplay Flow:

- Provides Training entry.
- Presents Training Selection.
- Presents exercise results.
- Coordinates navigation out of Training.

Training requests navigation through Gameplay Flow rather than directly switching application screens.

### 17.3 Level Runtime

Level Runtime provides:

- Training level.
- Exercise start points.
- Training zones.
- Trigger registrations.
- Runtime objects.

Training references these resources through stable IDs.

### 17.4 Movement System

Movement provides:

- Movement state events.
- Jump events.
- Slide events.
- Vault events.
- Wall-run events.
- Wall-jump events.
- Landing events.
- Movement metrics.

Training consumes these events and metrics.

### 17.5 Camera System

Camera provides player-facing presentation.

Training may request camera reset or instructional presentation through the appropriate interface.

Training must not directly modify camera transforms.

### 17.6 Input System

Input provides abstract action information and current binding labels.

Training does not process raw keyboard or gamepad events.

### 17.7 Interaction System

Interaction provides:

- Interaction completion.
- Target identity.
- Interaction failure.
- Interaction cancellation.

Training observes these events.

### 17.8 Checkpoint System

Checkpoint System owns checkpoint progress.

Training may define exercise-specific checkpoints and request a progress reset according to policy.

### 17.9 Respawn System

Respawn performs player recovery and placement.

Training requests exercise restart through Respawn.

### 17.10 Player State System

Player State determines whether the player is currently eligible to perform required actions.

Training must not create a separate player availability state.

### 17.11 Save System

Save System persists Training progress.

### 17.12 Audio System

Audio System presents Training-related sound feedback.

---

## 18. Configuration and Data Authoring

### 18.1 Data-Driven Exercises

Exercise definitions should be stored as structured data rather than hardcoded inside the Training System.

The chosen serialization format must follow the project architecture.

JSON-like examples in this specification are conceptual contracts, not a requirement to use JSON for every asset.

### 18.2 Example Exercise

```json
{
  "id": "training_basic_jump",
  "sectionId": "training_jumping",
  "title": "Basic Jump",
  "description": "Jump across the gap and land safely.",
  "mechanic": "jumping",
  "levelId": "training_level",
  "startPointId": "jump_start",
  "objectives": [
    {
      "id": "perform_jump",
      "type": "perform_action",
      "required": true,
      "completionCondition": {
        "event": "jump_performed"
      }
    },
    {
      "id": "reach_platform",
      "type": "land_in_zone",
      "required": true,
      "completionCondition": {
        "zoneId": "jump_target"
      }
    }
  ],
  "prerequisites": [],
  "restartPolicy": "exercise_start",
  "evaluation": {
    "allowMultipleAttempts": true
  },
  "hints": [],
  "optional": false
}
```

The production schema must validate all required references and condition types.

### 18.3 Validation

At load time, validate:

- Unique exercise IDs.
- Unique objective IDs within an exercise.
- Valid section references.
- Valid level references.
- Valid start point references.
- Valid objective conditions.
- Valid prerequisites.
- No circular prerequisite dependencies.
- Valid evaluation thresholds.
- Valid hint configurations.

Invalid mandatory exercises must produce clear development diagnostics.

---

## 19. Performance and Reliability

The Training System should be lightweight.

Requirements:

- No unnecessary per-frame polling.
- Event-driven objective evaluation.
- No duplicate event subscriptions.
- Session-scoped cleanup.
- No stale attempt references.
- Bounded hint processing.
- Efficient exercise lookup by ID.
- Minimal allocations during active traversal.

Exercise evaluation must not introduce noticeable frame-time spikes.

---

## 20. Testing Requirements

### 20.1 Exercise Lifecycle Tests

Test:

- Exercise preparation.
- Ready state.
- Exercise start.
- Objective completion.
- Exercise completion.
- Exercise failure.
- Restart.
- Abandonment.

### 20.2 Objective Tests

Test:

- Single objective.
- Sequential objectives.
- Optional objectives.
- Multiple required objectives.
- Invalid events.
- Duplicate events.
- Out-of-order events.
- Stale attempt events.

### 20.3 Progression Tests

Test:

- Exercise unlock.
- Section unlock.
- Replay completed exercise.
- Mastery update.
- Best score update.
- Best time update.
- Optional exercise behavior.
- Invalid prerequisite configuration.

### 20.4 Evaluation Tests

Test:

- Successful completion.
- Failure conditions.
- Time limit.
- Medal thresholds.
- Accuracy scoring.
- Repeated attempts.
- Deterministic scoring.

### 20.5 Restart Tests

Test:

- Restart before starting.
- Restart during traversal.
- Restart after failure.
- Restart after completion where permitted.
- Restart during active interaction.
- Restart during respawn.
- Old attempt event rejection.

### 20.6 Persistence Tests

Test:

- Save completed exercise.
- Save mastery improvement.
- Restore Training progress.
- Save failure.
- Duplicate completion events.
- Invalid persisted data.

### 20.7 Integration Tests

Test a complete Training sequence:

```text
Start Training Session
    |
    v
Movement Basics
    |
    v
Running and Sprinting
    |
    v
Jumping
    |
    v
Sliding
    |
    v
Vaulting
    |
    v
Wall Running
    |
    v
Wall Jumping
    |
    v
Landing and Momentum
    |
    v
Interaction
    |
    v
Combined Traversal
    |
    v
Training Results
```

Also test skipping optional exercises and replaying previously completed exercises.

---

## 21. Implementation Phases

### Phase 1: Core Models

Implement:

- TrainingExerciseDefinition.
- TrainingExerciseInstance.
- TrainingExerciseStatus.
- TrainingExerciseRuntimeState.
- TrainingObjectiveDefinition.
- TrainingObjectiveProgress.
- TrainingResult.
- TrainingProgress.

### Phase 2: Exercise Lifecycle

Implement:

- TrainingManager.
- TrainingExerciseController.
- TrainingExerciseStateMachine.
- Exercise preparation.
- Exercise start.
- Exercise completion.
- Exercise failure.
- Exercise restart.

### Phase 3: Objective Evaluation

Implement:

- Objective evaluator.
- Event adapter.
- Event validation.
- Sequential objectives.
- Optional objectives.
- Completion conditions.

### Phase 4: Initial Exercise Content

Implement the initial exercise set:

- Movement.
- Running.
- Sprinting.
- Jumping.
- Crouching.
- Sliding.
- Vaulting.
- Wall running.
- Wall jumping.
- Landing.
- Interaction.
- Combined traversal.

### Phase 5: Instructions and Hints

Implement:

- Instruction presentation data.
- Contextual hints.
- Hint cooldown.
- Input binding labels.
- Completion feedback.

### Phase 6: Evaluation and Progression

Implement:

- Exercise metrics.
- Scoring.
- Medals.
- Mastery.
- Unlock rules.
- Best result tracking.

### Phase 7: Persistence and Integration

Integrate:

- Gameplay Session.
- Gameplay Flow.
- Level Runtime.
- Movement.
- Interaction.
- Checkpoint.
- Respawn.
- Player State.
- Save System.
- UI and Audio.

### Phase 8: Validation

Run:

- Unit tests.
- Exercise integration tests.
- Progression tests.
- Restart tests.
- Persistence tests.
- Full Training playthrough.

---

## 22. Acceptance Criteria

The implementation is accepted when:

1. Training can be launched through Gameplay Flow.
2. Training runs inside a valid Gameplay Session.
3. Exercise definitions are data-driven.
4. Exercises have explicit lifecycle states.
5. Objectives are evaluated from authoritative gameplay events.
6. Stale attempt events are ignored.
7. Exercises can be restarted independently.
8. Restart uses Respawn and Movement interfaces.
9. Training does not implement duplicate movement logic.
10. Initial movement exercises are available.
11. Vault and wall-run exercises validate actual traversal events.
12. Combined traversal works.
13. Hints use current input bindings.
14. Exercise completion is deterministic.
15. Failure conditions are explicit.
16. Progression unlocks are consistent.
17. Completed exercises can be replayed.
18. Training progress can be persisted.
19. Persistence failures do not interrupt active gameplay.
20. Training results are available to Gameplay Flow.
21. Training does not duplicate Speedrun scoring.
22. All session-scoped subscriptions are released correctly.
23. Full Training integration tests pass.

---

## 23. Definition of Done

- [ ] Training data models implemented.
- [ ] Exercise definitions are data-driven.
- [ ] Exercise lifecycle implemented.
- [ ] Objective system implemented.
- [ ] Event adapter implemented.
- [ ] Event validation implemented.
- [ ] Exercise restart implemented.
- [ ] Initial exercise set authored.
- [ ] Instruction system implemented.
- [ ] Hint system implemented.
- [ ] Input binding labels integrated.
- [ ] Exercise evaluation implemented.
- [ ] Mastery and medals implemented.
- [ ] Progression rules implemented.
- [ ] Training progress persistence integrated.
- [ ] Gameplay Session integration complete.
- [ ] Gameplay Flow integration complete.
- [ ] Movement integration complete.
- [ ] Interaction integration complete.
- [ ] Checkpoint integration complete.
- [ ] Respawn integration complete.
- [ ] UI integration complete.
- [ ] Audio integration complete.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Full Training playthrough validated.
- [ ] No duplicate gameplay domain logic exists.
- [ ] Architecture follows `01_AGENT_RULES.md` and `02_TECHNICAL_ARCHITECTURE.md`.

---

## 24. Final Design Constraints

1. Training System owns exercise and instructional logic.
2. Gameplay Session owns Training session lifecycle.
3. Gameplay Flow owns application navigation.
4. Movement System remains the authority for movement and traversal events.
5. Interaction System remains the authority for interaction execution.
6. Checkpoint System remains the authority for checkpoint progress.
7. Respawn System remains the authority for player recovery.
8. Level Runtime remains the authority for runtime level objects and spawn points.
9. Player State remains the authority for player lifecycle and aggregated state.
10. Save System remains the authority for persistence infrastructure.
11. Training exercises must be data-driven.
12. Objective evaluation must be deterministic.
13. Stale attempt events must never modify the current exercise.
14. Restart must not directly modify player transforms or physics.
15. Training must not implement a parallel movement system.
16. Training must not reuse Speedrun validation or scoring as its own evaluation mechanism.
17. Instructions and hints must use abstract input actions.
18. Mastery must remain separate from basic exercise completion.
19. Optional exercises must not create mandatory progression deadlocks.
20. Training must remain extensible without introducing unnecessary scripting or quest-system complexity.

**End of Specification**