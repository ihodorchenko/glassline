# 09_SPEEDRUN_SYSTEM_SPEC.md

**Project:** Glassline  
**Document:** Speedrun System Specification

## 1. Overview

The Speedrun System provides a structured time-trial experience focused on replayability, route optimization, movement mastery, and measurable player improvement.

The system must allow players to:

- Start a timed run.
- Complete a predefined route.
- Pass mandatory checkpoints.
- Track total completion time.
- Track individual section times.
- Compare results with previous attempts.
- Earn performance medals.
- Save personal records.
- View a local leaderboard.
- Replay levels to improve their performance.

The system must be deterministic enough to provide meaningful time comparisons across multiple attempts.

### Ownership

| Responsibility | Owner |
|---|---|
| Run lifecycle, run state, and attempt identity | Speedrun System |
| Monotonic run timing | Speedrun System |
| Required checkpoint sequence and route validation | Speedrun System |
| Section splits and personal bests | Speedrun System |
| Medal evaluation and run result construction | Speedrun System |
| Run record semantics and leaderboard ordering | Speedrun System |
| Checkpoint activation, progress, and destination data | Checkpoint System (`16_CHECKPOINT_SYSTEM_SPEC.md`) |
| Player recovery lifecycle | Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`) |
| Aggregated gameplay statistics | Statistics System (`30_STATISTICS_SYSTEM_SPEC.md`) |
| Persistence infrastructure, schema, and repositories | Save System (`10_SAVE_SYSTEM_SPEC.md`) |
| Gameplay session lifecycle and pause coordination | Gameplay Session System (`19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`) |
| HUD and Results presentation | HUD / Menu / UI |

The Speedrun System owns run validity and record semantics. It must not implement checkpoint detection, statistics aggregation, player recovery, or direct persistence.

### Design Philosophy

Speedrunning is not a separate game mode built around additional mechanics.

It is a different way of interacting with the existing movement system.

The player should gradually discover:

1. The intended route.
2. More efficient movement combinations.
3. Alternative traversal paths.
4. Better momentum management.
5. Opportunities to reduce unnecessary movement.
6. Advanced routes that reward skill and precision.

The game should reward mastery rather than arbitrary shortcuts.

---

# 2. Game Modes

The Speedrun System supports two primary modes.

## 2.1 Training

Training provides a safe environment for learning movement mechanics and experimenting with routes.

Characteristics:

- No mandatory global timer.
- Individual movement exercises.
- Optional time measurements.
- No competitive leaderboard by default.
- Unlimited retries.
- Optional checkpoint-based exercises.

Training can optionally provide personal best times for individual exercises.

## 2.2 Prologue Speedrun

The Prologue is the primary competitive time-trial experience.

Characteristics:

- Fixed route.
- Five mandatory sections.
- Five checkpoints.
- Continuous timer.
- Section split tracking.
- Completion statistics.
- Medal evaluation.
- Local leaderboard.
- Personal records.

The Prologue must be replayable without restarting the entire application.

---

# 3. Run Lifecycle

Every speedrun follows a clearly defined lifecycle.

## 3.1 Run States

The run lifecycle coordinator supports the following states:

| State | Description |
|---|---|
| Idle | No active run |
| Preparing | Loading route and initializing systems |
| Ready | Waiting for player confirmation |
| Running | Timer is active |
| Finished | Run reached the finish trigger and is being finalized |
| Invalidated | Completed run failed validation and is not eligible for records |
| Abandoned | Player manually exits the run |
| Failed | The run could not continue because of a system or session failure |

State transitions must be explicit.

`Invalidated` is a validation outcome, not a system failure. `Failed` indicates that the run could not be completed normally.

Checkpoint passage is an event within `Running`, not a separate run state. Recovery during a run is coordinated by the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`) and may affect the final classification without creating a separate run state.

### State Flow

```text
Idle
  |
  v
Preparing
  |
  v
Ready
  |
  | Player confirms start
  v
Running
  |
  +---- Checkpoint 1 ... Checkpoint 5 (events)
  |
  v
Finished
  |
  +---- validation passes --> Results (valid)
  |
  +---- validation fails  --> Invalidated
```

Abandonment and system failure can occur during an active run.

A failed, abandoned, or invalidated run must never be saved as a valid leaderboard entry.

## 3.2 Starting a Run

Starting a run must:

1. Load and validate the selected route definition.
2. Obtain a valid start position from Level Runtime spawn resolution.
3. Request the gameplay session start through the Gameplay Session System.
4. Request checkpoint progress reset through the Checkpoint System.
5. Request transient movement state reset through the owning player interfaces.
6. Establish a fresh statistics session scope through the Statistics System.
7. Reset section split data owned by the Speedrun System.
8. Initialize the timer without starting it.
9. Request HUD preparation.
10. Enter the Ready state.

The Speedrun System must not directly place the player, mutate checkpoint state, reset movement physics, or manipulate level objects. It coordinates these operations through the owning systems' public interfaces.

The timer must not start during loading or preparation.

## 3.3 Countdown

The initial implementation should support an optional short countdown.

Recommended sequence:

- 3
- 2
- 1
- GO!

The timer starts exactly when the run transitions into Running.

The countdown must not introduce additional simulation time that affects the recorded result.

## 3.4 Completing a Run

A run is completed when:

- The player reaches the final finish trigger.
- All mandatory checkpoints have been completed.
- The route validation succeeds.

On completion:

1. Stop the timer.
2. Finalize section splits.
3. Request the finalized statistics summary from the Statistics System.
4. Evaluate medals.
5. Validate the run.
6. Update personal records.
7. Persist the leaderboard entry through the Save System.
8. Display the results screen.

---

# 4. Timer System

## 4.1 Core Requirements

The timer is the authoritative source of run duration.

Requirements:

- Monotonic time source.
- Millisecond precision in stored results.
- No dependency on frame count.
- No dependency on rendered FPS.
- No accumulation of deltaTime for official timing.
- No timer reset during ordinary gameplay.

Use a monotonic clock, such as `performance.now()`.

Never use `Date.now()` for measuring elapsed run time.

System clock changes must not affect active run timing.

## 4.2 Timer Representation

Internally, store elapsed time as integer milliseconds.

```typescript
type RunTime = number;
```

Example:

```typescript
const elapsedMs = endTime - startTime;
```

Display format:

```text
MM:SS.mmm
```

Examples:

```text
00:58.324
01:42.817
02:15.093
```

The display can optionally omit milliseconds when presenting less prominent HUD information.

Stored values must always retain full precision.

## 4.3 Timer API

```typescript
interface RunTimer {
    start(): void;

    stop(): number;

    reset(): void;

    getElapsedTime(): number;

    isRunning(): boolean;
}
```

The implementation must prevent:

- Starting an already running timer.
- Stopping an inactive timer.
- Negative elapsed time.
- Accidental timer resets.
- Multiple independent timer instances for one run.

## 4.4 Pause, Focus Loss, and Application Lifecycle

An official ranked run must not support a gameplay pause that stops the run timer.

The Gameplay Session System may still suspend simulation on application focus loss or system interruption (`19_GAMEPLAY_SESSION_SYSTEM_SPEC.md` §10). The two decisions are separate:

- The session owns whether simulation and input are suspended.
- The Speedrun System owns whether an active ranked run continues, is invalidated, or is abandoned.

Required behavior for a ranked run:

- The run remains active during a focus-loss interruption.
- The monotonic run timer continues to measure real elapsed time.
- The run must not be silently restarted, reset, or converted into a new attempt.
- The session coordinator must not pause or resume the ranked timer against Speedrun policy.
- If the application cannot restore a consistent simulation state, the run may be classified by an explicit Speedrun policy; it must not silently continue in an undefined simulation state.

Practice and unranked attempts may pause the timer according to their session policy. A paused practice attempt cannot produce an official record.

A future practice mode may introduce additional pause functionality without affecting official competitive records.

---

# 5. Route Definition

Routes must be data-driven.

The Speedrun System must not depend on hardcoded level-specific checkpoint logic.

## 5.1 Route Structure

```typescript
interface RouteDefinition {
    id: string;

    name: string;

    version: number;

    startPosition: Vector3;

    finishTrigger: TriggerDefinition;

    sections: RouteSection[];

    checkpoints: CheckpointDefinition[];

    timingRules: TimingRules;

    medalThresholds: MedalThresholds;
}
```

## 5.2 Prologue Route

The initial route consists of five sections.

| Index | Section | Description |
|---|---|---|
| 01 | Rooftop | Initial traversal and movement introduction |
| 02 | Industrial | Complex geometry and momentum management |
| 03 | Construction | Vertical traversal and precision |
| 04 | Skybridge | Extended traversal and advanced movement |
| 05 | Finish | Final route and completion |

Each section has:

- Unique identifier.
- Start trigger.
- End trigger.
- Associated checkpoint.
- Optional section-specific statistics.

## 5.3 Route Versioning

Every route must have a version number.

This is important because changes to level geometry or checkpoint positions may invalidate previously recorded times.

Leaderboard records must store the route version.

Records from incompatible versions must not be mixed without explicit migration or validation.

---

# 6. Checkpoint and Route Progression

## 6.1 Ownership Boundary

The Speedrun System owns the required checkpoint sequence for a route and the validation of that sequence.

The Checkpoint System (`16_CHECKPOINT_SYSTEM_SPEC.md`) owns checkpoint runtime behavior: registration, activation, progress, and recovery destination data.

Level Design (`06_LEVEL_DESIGN_SPEC.md`) owns the authored checkpoint positions, triggers, and sections.

These are not competing authorities:

| Fact | Owner |
|---|---|
| Checkpoint physical location and trigger volume | Level content / Level Design |
| Checkpoint activation and progress state | Checkpoint System |
| Required checkpoint order for the route | Speedrun System |
| Whether a run followed the route | Speedrun System |
| Recovery destination transform | Checkpoint System + Level Runtime |

The Speedrun System must not implement its own checkpoint activation detection, and the Checkpoint System must not implement route validation.

Checkpoints provide progress tracking, section timing, route validation evidence, recovery opportunities in Training and Prologue, and protection against skipping mandatory sections.

The Prologue requires five mandatory checkpoints.

## 6.2 Route Checkpoint Definition

The route definition references checkpoints by stable ID and declares the required sequence. It does not duplicate physical checkpoint data.

```typescript
interface RouteCheckpointReference {
    checkpointId: string;

    index: number;

    sectionId: string;

    mandatory: boolean;
}
```

The physical definition (trigger volume, spawn point reference, display name) is owned by the level content and the Checkpoint System.

## 6.3 Sequential Validation

Checkpoints must be completed in the configured order.

Example:

```text
Expected: CP1
Checkpoint System reports CP1 activation
Result: Accepted

Expected: CP2
Checkpoint System reports CP3 activation
Result: Rejected for route validation

Expected: CP2
Checkpoint System reports CP2 activation
Result: Accepted
```

The player cannot skip mandatory checkpoints.

The Speedrun System maintains the expected checkpoint index for validation purposes. The Checkpoint System records actual activations independently and must not be asked to infer the expected order.

## 6.4 Checkpoint Events

The Speedrun System consumes checkpoint activation facts published by the Checkpoint System.

The canonical event payload is defined in `16_CHECKPOINT_SYSTEM_SPEC.md` §13.2. The fields the Speedrun System consumes for route validation are:

```typescript
interface CheckpointActivatedFact {
    sessionId: string;

    levelId: string;

    checkpointId: string;

    sectionId: string;

    timestamp: number;

    activationIndex: number;
}
```

The Speedrun System correlates each accepted activation with the active run and derives the split time from the monotonic timer. The event timestamp is used for correlation, not as the authoritative split time.

Each accepted checkpoint contributes exactly one route-validation record.

Duplicate trigger events must be ignored. The Speedrun System owns deduplication for route validation; the Checkpoint System owns activation deduplication.

## 6.5 Checkpoint Feedback

Checkpoint activation feedback (visual confirmation, audio cue, HUD notification) is owned by the Checkpoint System and presentation layers.

The Speedrun System provides only the values it owns:

- The current section split.
- The comparison against the personal best split.
- The checkpoint progress used for run validation.

Feedback must be immediate and must not interrupt movement.

## 6.6 Recovery During a Run

Checkpoint recovery is part of the initial release.

The recovery lifecycle is owned by the Respawn System (`17_RESPAWN_SYSTEM_SPEC.md`) and orchestrated by `RespawnManager`.

When a recovery is requested during a ranked run:

1. The Respawn System requests an evaluation from the Speedrun System before recovery.
2. The Speedrun System decides how the run is affected.
3. The Respawn System executes the allowed recovery.

Possible Speedrun policies:

- Continue the run with the timer unchanged.
- Apply an explicit time penalty where a mode defines one.
- Invalidate the run.
- Classify the attempt as unranked practice.

The initial policy must be explicitly configured by the Speedrun System and must not be inferred by the Checkpoint or Respawn Systems.

A recovery must never silently restart the timer or the run.

---

# 7. Section Timing and Splits

## 7.1 Purpose

Split times help players understand where they are gaining or losing time.

The system records:

- Total elapsed time.
- Individual section times.
- Cumulative checkpoint times.
- Personal best section times.

## 7.2 Split Data

```typescript
interface SectionSplit {
    sectionId: string;

    startTime: number;

    endTime: number;

    duration: number;

    cumulativeTime: number;
}
```

All times are stored in milliseconds.

## 7.3 Split Comparison

The HUD can compare the current run with the player's personal best.

Example:

```text
ROOFTOP

Current: 00:18.420
Best:    00:17.850

+00:00.570
```

Comparison states:

- Ahead of personal best.
- Behind personal best.
- Equal within display precision.

Use actual stored values for comparison, not rounded display strings.

## 7.4 Personal Best Splits

The system must preserve the best time for each section independently.

This allows the game to calculate an optional theoretical best time.

```typescript
theoreticalBestTime =
    sum(personalBestSectionTimes);
```

The theoretical best is informational.

It does not represent an actual completed run and must never appear as a real leaderboard result.

---

# 8. Run Statistics

## 8.1 Ownership

Aggregation of gameplay facts is owned by the Statistics System (`30_STATISTICS_SYSTEM_SPEC.md`).

The Speedrun System does not independently collect movement counters, distance, or speed. It consumes a session-scoped statistics summary when a run finishes.

The Statistics System owns event-driven collection, deduplication, aggregation, and session correlation.

The Speedrun System owns the run result model and associates the statistics summary with the completed run.

## 8.2 Result Data

The Speedrun System owns:

| Value | Description |
|---|---|
| Total Time | Complete run duration measured by the monotonic timer |
| Section Times | Split durations derived from checkpoint events |
| Checkpoints | Completed mandatory checkpoint count |
| Run Version | Route and game version metadata |
| Validation Status | Result of route validation |
| Medal | Medal derived from completion time and route thresholds |

The Statistics System provides the remaining gameplay counters as a typed summary:

| Statistic | Description |
|---|---|
| Jump Count | Number of jumps |
| Slide Count | Number of slides |
| Wall Runs | Number of wall-run actions |
| Wall Jumps | Number of wall jumps |
| Landings | Number of registered landings |
| Falls | Number of falls or route failures |
| Distance | Total player movement distance |

Not every statistic needs to be displayed on the results screen.

## 8.3 Completion Sequence

When a run finishes:

1. The finish trigger is accepted.
2. The timer is stopped.
3. The Speedrun System requests the finalized session statistics summary from the Statistics System.
4. The Speedrun System builds the run result from its own timing data and the provided summary.
5. Route validation is applied.
6. The validated result is persisted through the Save System records contract.
7. Results presentation consumes the authoritative result.

The Speedrun System must not sample player transforms or recompute statistics independently.

---

# 9. Medal System

## 9.1 Purpose

Medals provide achievable performance goals.

The initial implementation supports:

- Bronze
- Silver
- Gold

Medals are based on completion time.

## 9.2 Threshold Configuration

Medal thresholds belong to the route configuration.

Example:

```typescript
interface MedalThresholds {
    bronze: number;

    silver: number;

    gold: number;
}
```

All values are milliseconds.

Example configuration (implemented initial release values, `PrologueRoute.ts`):

```typescript
const prologueMedals = {
    bronze: 240000,
    silver: 180000,
    gold: 120000
};
```

Thresholds live in the route configuration and may be rebalanced through
playtesting; historical records must preserve the threshold configuration used
at the time of completion.

## 9.3 Medal Evaluation

```typescript
function calculateMedal(
    elapsedTime: number,
    thresholds: MedalThresholds
): Medal {
    if (elapsedTime <= thresholds.gold) {
        return "gold";
    }

    if (elapsedTime <= thresholds.silver) {
        return "silver";
    }

    if (elapsedTime <= thresholds.bronze) {
        return "bronze";
    }

    return "none";
}
```

Only validated runs can receive official medals.

Medals must be recalculated if the route's official thresholds change.

Historical records should preserve the threshold configuration version used at the time of completion.

---

# 10. Personal Records

## 10.1 Requirements

The game must maintain personal records locally.

Records include:

- Best overall time.
- Best section times.
- Best medal.
- Number of completed runs.
- Last completed run.
- Recent run history.

## 10.2 Record Comparison

When a new valid run is completed:

1. Compare the result with the personal best.
2. Update the overall record if improved.
3. Compare individual section times.
4. Update improved section records.
5. Update medal progression.
6. Save the new run.
7. Refresh the leaderboard.

An invalid run must never overwrite a personal record.

## 10.3 Personal Best Feedback

When the player achieves a new record, show clear feedback.

Example:

```text
NEW PERSONAL BEST

01:32.418

Previous: 01:35.672
Improvement: -00:03.254
```

The presentation should be celebratory but consistent with the minimalistic visual language of the game.

---

# 11. Local Leaderboard

## 11.1 Storage

Run records are persisted through the Save System (`10_SAVE_SYSTEM_SPEC.md`) using its repository interfaces.

The Speedrun System owns record semantics, sorting rules, and validity. The Save System owns the database, schema versioning, migrations, and transactions.

The Speedrun System must not access IndexedDB directly or define a competing physical database schema.

## 11.2 Data Model

```typescript
interface LeaderboardEntry {
    id: string;

    routeId: string;

    routeVersion: number;

    completionTime: number;

    medal: Medal;

    completedAt: number;

    splits: SectionSplit[];

    statisticsSummaryId: string;

    validation: RunValidationResult;
}
```

The statistics summary is referenced by ID and stored through the Statistics System's persistence contract; the run record must not maintain a duplicate copy of aggregated gameplay statistics.

## 11.3 Logical Storage

The physical database, object stores, schema version, and migrations are owned by the Save System.

Logical collections required by the Speedrun System:

```text
runs              -> validated and invalid completed run records
personalRecords   -> best results per route and compatible route version
```

Required lookup keys for run records:

- routeId
- completionTime
- completedAt
- routeVersion

The Save System database name and schema are defined in `10_SAVE_SYSTEM_SPEC.md` (`GlasslineSaveData`). This document must not define a second database name or schema.

## 11.4 Leaderboard Sorting

Default ordering:

1. Fastest completion time.
2. Earliest completion timestamp when times are equal.

Only validated runs are eligible.

Records must be grouped by route and compatible route version.

## 11.5 Leaderboard UI

The initial leaderboard is local-only.

Suggested layout:

```text
PROLOGUE RECORDS

01   01:32.418   GOLD
02   01:34.105   GOLD
03   01:38.902   SILVER
04   01:41.228   SILVER
05   01:45.614   SILVER

YOUR BEST

01:32.418
```

The UI should also provide:

- Run date.
- Medal.
- Section splits.
- Personal best indicator.
- Detailed run statistics.

## 11.6 Data Management

Provide the ability to:

- View run history.
- Delete individual records.
- Clear local records.
- Export records to JSON.

All record operations must be performed through Save System repository interfaces.

Importing records must not automatically mark them as verified.

Imported data must pass validation and should be treated as untrusted.

---

# 12. Run Validation and Anti-Cheating

## 12.1 Goals

The initial validation system is designed to prevent accidental or straightforward manipulation.

It is not intended to provide full protection against a determined attacker.

Because the leaderboard is local-only, client-side validation cannot guarantee competitive integrity.

## 12.2 Validation Rules

Every completed run must pass the following checks:

1. Correct route identifier.
2. Compatible route version.
3. Correct checkpoint sequence.
4. All mandatory checkpoints completed.
5. Valid start event.
6. Valid finish event.
7. Positive elapsed time.
8. Consistent checkpoint timestamps.
9. Consistent section splits.
10. Plausible completion time.

## 12.3 Validation Result

```typescript
interface RunValidationResult {
    valid: boolean;

    errors: string[];

    warnings: string[];

    validatedAt: number;
}
```

Possible validation errors:

```text
INVALID_ROUTE
INVALID_ROUTE_VERSION
MISSING_CHECKPOINT
CHECKPOINT_ORDER_VIOLATION
INVALID_TIMESTAMP
INVALID_SPLIT
INVALID_COMPLETION_TIME
INCOMPLETE_RUN
```

Warnings should not automatically invalidate a run unless the relevant rule explicitly requires it.

## 12.4 Checkpoint-Based Validation

Checkpoint events must be recorded sequentially.

The final result must contain a complete checkpoint history.

The validation system should verify:

- The first event corresponds to the run start.
- Every mandatory checkpoint appears exactly once.
- Events are in chronological order.
- Section boundaries are consistent.
- The finish event occurs after the final checkpoint.

## 12.5 Time Validation

The recorded time must be derived from the monotonic timer.

Do not accept a manually supplied completion time from the results UI.

For the initial version, the Speedrun System is the authoritative source of timing data.

## 12.6 Future Improvements

Possible future measures:

- Movement trajectory validation.
- Physics-state consistency checks.
- Maximum movement speed constraints.
- Checkpoint traversal plausibility.
- Replay-based validation.
- Signed run records.
- Server-side verification.

These are not requirements for the initial implementation.

---

# 13. HUD Integration

The Speedrun HUD must provide essential information without obstructing movement.

## 13.1 HUD Elements

During an active run:

- Main timer.
- Current section.
- Checkpoint progress.
- Optional personal best comparison.
- Optional split indicator.

Example:

```text
01:24.382

SECTION 04 / 05
SKYBRIDGE

CHECKPOINT 04 / 05
```

## 13.2 Visual Principles

The interface should follow the established Glassline visual direction (`04_ASSET_BIBLE.md`, `07_UI_UX_SPEC.md`):

- Minimalist typography.
- Strong contrast.
- Limited color palette.
- Geometric layout.
- Clear numerical hierarchy.
- Minimal decorative elements.

The timer must remain readable during fast movement.

## 13.3 HUD Performance

HUD updates must not trigger unnecessary scene reconstruction.

Use a lightweight state update mechanism.

The rendering system and gameplay simulation must remain independent from the HUD update frequency.

---

# 14. Results Screen

The results screen appears after a valid completed run.

## 14.1 Main Information

Display:

- Final completion time.
- Medal.
- Personal best status.
- Improvement compared to previous record.
- Section splits.

## 14.2 Secondary Information

Optionally display:

- Movement statistics.
- Total distance.
- Number of jumps.
- Number of wall runs.
- Number of falls.

## 14.3 Actions

Available actions:

- Retry.
- Return to Training.
- Return to Main Menu.
- View Leaderboard.
- View Detailed Statistics.

## 14.4 Results Example

```text
PROLOGUE COMPLETE

01:32.418

GOLD MEDAL

NEW PERSONAL BEST

SECTION RESULTS

ROOFTOP        00:16.320
INDUSTRIAL     00:21.412
CONSTRUCTION   00:19.830
SKYBRIDGE      00:18.605
FINISH         00:16.251

TOTAL          01:32.418

[ RETRY ]
[ LEADERBOARD ]
[ MAIN MENU ]
```

The actual results screen should use the game's established UI design system rather than a generic browser-style interface.

---

# 15. Ghost Replay — Future Feature

Ghost Replay is intentionally excluded from the initial implementation.

However, the architecture should allow it to be added without rewriting the entire Speedrun System.

## 15.1 Intended Functionality

A ghost represents a previous run.

The player can see a translucent representation of their previous movement while completing a new attempt.

Potential ghost modes:

- Personal best.
- Previous attempt.
- Theoretical best.
- Downloaded community records.

## 15.2 Future Recording Data

```typescript
interface GhostFrame {
    timestamp: number;

    position: Vector3;

    rotation: Quaternion;

    movementState: string;
}
```

## 15.3 Recording Requirements

The future GhostRecorder should:

- Capture player transforms.
- Record movement states.
- Use timestamps independent of rendering FPS.
- Support interpolation.
- Avoid affecting the official timer.
- Store recordings separately from leaderboard metadata.

The initial version may define the GhostRecorder interface but does not need to implement recording or playback.

---

# 16. Technical Architecture

The Speedrun System should be divided into independent modules.

## 16.1 Core Modules

The Speedrun System is composed of focused components. Component names are illustrative; `02_TECHNICAL_ARCHITECTURE.md` does not require a specific class named `RunManager`.

### Run Controller

Responsible for:

- Run lifecycle.
- State transitions.
- Starting and finishing runs.
- Coordinating subsystems.
- Producing completed run results.

### RunTimer

Responsible for:

- Starting the timer.
- Stopping the timer.
- Measuring elapsed time.
- Providing current elapsed time.

### Checkpoint Integration

Responsible for:

- Consuming checkpoint activation facts from the Checkpoint System.
- Maintaining the expected checkpoint index for route validation.
- Deriving checkpoint split timestamps.
- Publishing checkpoint-progress facts for the HUD.

The Speedrun System must not perform checkpoint detection, activation, or progress storage.

### Statistics Summary Consumer

Responsible for:

- Requesting the finalized session statistics summary from the Statistics System.
- Attaching the summary to the run result.

The Speedrun System must not collect movement statistics independently.

### RouteDefinition

Responsible for:

- Route metadata.
- Section configuration.
- Checkpoint sequence configuration.
- Medal thresholds.
- Route versioning.

### LeaderboardManager

Responsible for:

- Saving completed runs through Save System repositories.
- Retrieving run history through Save System repositories.
- Sorting records.
- Updating personal records.
- Managing local leaderboard data.

### RunValidator

Responsible for:

- Validating completed runs.
- Checking checkpoint history.
- Checking timing consistency.
- Producing validation results.

### GhostRecorder

Reserved for future implementation and not part of the initial release.

## 16.2 Dependency Overview

```text
            Run Controller
                  |
       +----------+----------+
       |          |          |
       v          v          v
    RunTimer  Checkpoint  Statistics
              Integration  Summary
                  |
                  v
             RunValidator
                  |
                  v
          LeaderboardManager
                  |
                  v
      Save System repositories
                  |
                  v
              IndexedDB
```

RouteDefinition provides configuration to the relevant modules.

HUD and Results UI consume state and completed run data.

They must not directly modify timer or checkpoint state.

The Speedrun System never talks to IndexedDB directly; persistence is accessed through Save System repositories.

## 16.3 Event-Driven Integration

Gameplay systems should communicate through explicit events.

Suggested events (implemented as canonical domain events):

```typescript
type SpeedrunEvent =
    | { type: "run:prepared" }
    | { type: "run:started" }
    | { type: "run:checkpoint"; checkpointId: string }
    | { type: "run:finished" }
    | { type: "run:invalidated" }
    | { type: "run:abandoned" };
```

Section activation is published by the Level Runtime as `section:activated` /
`section:deactivated`; invalid runs publish `run:invalidated` instead of a
separate failure event.

Events must be emitted once per valid transition.

Avoid coupling the movement controller directly to IndexedDB or leaderboard logic.

---

# 17. Performance and Reliability

The Speedrun System must not negatively affect gameplay performance.

Requirements:

- No persistence writes every frame.
- No expensive validation during active movement.
- No unnecessary allocations in the update loop.
- No dependence on rendered frame rate.
- No blocking persistence operations.
- No timer drift caused by UI rendering.
- No loss of completed results during ordinary UI transitions.

Persistence operations should happen asynchronously through the Save System.

A completed run should be validated before being persisted as an official leaderboard entry.

If persistence fails, the application should report the error without corrupting the in-memory result.

---

# 18. Persistence and Data Integrity

## 18.1 Save Timing

Persist data only when:

- A run has finished.
- The run has passed validation.
- The final result has been assembled.

Do not save partially completed runs as leaderboard entries.

## 18.2 Record Integrity

All stored records must include:

- Unique record ID.
- Route ID.
- Route version.
- Completion time.
- Completion timestamp.
- Checkpoint history or sufficient validation metadata.
- Section splits.
- Statistics.
- Validation status.

## 18.3 Persistence Failure

If persistence is unavailable:

- The current run must still function.
- The player must still see the result.
- The game must report that local persistence failed.
- The result should remain available in memory while the application session continues.

The Save System owns the failure classification and recovery policy (`10_SAVE_SYSTEM_SPEC.md`).

Do not silently claim that a record has been saved.

---

# 19. Accessibility and Usability

The system should support:

- Readable timer typography.
- High-contrast HUD elements.
- Non-color-only split comparisons.
- Clear checkpoint feedback.
- Consistent interaction patterns.
- Optional reduced HUD animation.

Ahead/behind indicators must use text or symbols in addition to color.

The timer must remain understandable without relying on animation.

---

# 20. Initial Balancing Targets

The Prologue is designed to be completed repeatedly.

Initial target completion times:

| Player Level | Target Time |
|---|---:|
| Beginner | 2–3 minutes |
| Advanced | Around 2 minutes |
| Speedrunner | 1–2 minutes |

These are design targets, not hard-coded restrictions.

Final medal thresholds should be determined through actual playtesting.

The route should reward improvements in movement execution and route selection.

---

# 21. Implementation Phases

Implementation must follow this order.

## Phase 1 — Core Timing

- Implement RunTimer.
- Implement the run lifecycle controller.
- Implement run states.
- Implement start and finish transitions.
- Connect timer to the Prologue.

Acceptance criteria:

- Timer starts exactly once.
- Timer stops on completion.
- Timing is independent of FPS.
- Invalid state transitions are rejected.

## Phase 2 — Checkpoints

- Integrate with the Checkpoint System.
- Define five Prologue checkpoint references in the route.
- Add sequential route validation.
- Add checkpoint split recording.
- Implement section boundaries.

Acceptance criteria:

- All checkpoints are detected.
- Skipping mandatory checkpoints is rejected.
- Duplicate route events are ignored.
- Checkpoint timestamps are recorded correctly.

## Phase 3 — Statistics and Splits

- Integrate with the Statistics System summary.
- Calculate section times.
- Implement split comparisons.

Acceptance criteria:

- Statistics are provided by the Statistics System, not collected by Speedrun.
- Section durations sum to the total run duration within timing precision.
- Personal best comparisons work correctly.

## Phase 4 — Results and Medals

- Implement medal evaluation.
- Create the results data model.
- Create the results screen.
- Add retry functionality.

Acceptance criteria:

- Medals are calculated correctly.
- Results display the correct timing data.
- Retry starts a completely new run.
- Previous run state does not leak into the next attempt.

## Phase 5 — Local Leaderboard

- Integrate with Save System repositories.
- Implement LeaderboardManager.
- Store completed runs.
- Maintain personal records.
- Add leaderboard UI.
- Add run history.

Acceptance criteria:

- Valid runs persist across reloads.
- Invalid runs are never saved as official records.
- Sorting is correct.
- Personal records update only when improved.

## Phase 6 — Validation and Polish

- Implement RunValidator.
- Add route version validation.
- Add persistence error handling.
- Improve HUD feedback.
- Test edge cases.
- Verify repeatability.

Acceptance criteria:

- All mandatory validation rules pass.
- Invalid run data cannot overwrite valid records.
- The system works across repeated attempts.
- Database failures do not break gameplay.

---

# 22. Testing Requirements

The Speedrun System requires unit tests and gameplay integration tests.

## Timer Tests

- Start and stop.
- Reset.
- Repeated start.
- Repeated stop.
- Elapsed time accuracy.
- Long-running timer.
- Background tab behavior.

## Checkpoint Tests

- Correct sequence.
- Incorrect sequence.
- Skipped checkpoint.
- Duplicate trigger.
- Checkpoint entered multiple times.
- Finish without completing checkpoints.

## Statistics Tests

- Movement event counting.
- Section split calculation.
- Cumulative time calculation.
- Personal best split comparison.

## Leaderboard Tests

- New record.
- Existing record.
- Equal completion times.
- Multiple routes.
- Different route versions.
- Database persistence.
- Database failure.

## Run Lifecycle Tests

- Start and finish.
- Abandonment.
- Failure.
- Retry.
- Multiple consecutive runs.
- Unexpected state transitions.

---

# 23. Definition of Done

The initial Speedrun System is considered complete when:

- [ ] The Prologue can be started repeatedly.
- [ ] The timer is accurate and independent of FPS.
- [ ] Five mandatory checkpoints work.
- [ ] Checkpoints are validated sequentially.
- [ ] Five section splits are recorded.
- [ ] Gameplay statistics summary is consumed from the Statistics System.
- [ ] Medal thresholds are configurable.
- [ ] Results screen displays accurate information.
- [ ] Personal records are maintained.
- [ ] Local leaderboard persists through the Save System.
- [ ] Run validation works.
- [ ] Invalid runs cannot enter the official leaderboard.
- [ ] Records persist across application reloads.
- [ ] Retry functionality works without restarting the application.
- [ ] Ghost Replay remains outside the initial implementation.
- [ ] The system does not introduce measurable gameplay performance degradation.
- [ ] The system exposes no competing checkpoint detector, statistics collector, or persistence layer.

---

# 24. Final Design Constraints

The implementation agent must follow these constraints:

1. Do not implement online leaderboards.
2. Do not introduce multiplayer functionality.
3. Do not implement Ghost Replay in the initial release.
4. Do not use frame count as a timing mechanism.
5. Do not use Date.now() for elapsed run time.
6. Do not couple gameplay movement logic to persistence or leaderboard logic.
7. Do not allow the HUD to modify authoritative run state.
8. Do not accept incomplete checkpoint sequences.
9. Do not save invalid runs as official leaderboard records.
10. Do not hardcode route-specific logic inside generic speedrun modules.
11. Keep route definitions data-driven.
12. Preserve route versioning for future level changes.
13. Keep the system modular and extensible.
14. Do not re-implement checkpoint activation, statistics aggregation, or the respawn lifecycle inside the Speedrun System.
15. Access persistence only through Save System repositories; never write to IndexedDB from Speedrun modules.
16. `RespawnManager` from `17_RESPAWN_SYSTEM_SPEC.md` is the only recovery orchestrator; Speedrun only decides how recovery affects run validity.
17. Statistics for results are provided by the Statistics System; Speedrun must not sample player transforms or recount movement events.

**Primary objective:** Build a reliable, replayable time-trial system that makes improving movement execution and route mastery the central motivation for repeatedly playing the Prologue.