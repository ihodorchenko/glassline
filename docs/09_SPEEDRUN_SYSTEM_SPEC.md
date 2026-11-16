# 09_SPEEDRUN_SYSTEM_SPEC.md

# Speedrun System Specification

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

The RunManager must support the following states:

| State | Description |
|---|---|
| Idle | No active run |
| Preparing | Loading route and initializing systems |
| Ready | Waiting for player confirmation |
| Running | Timer is active |
| Checkpoint | Processing checkpoint passage |
| Finished | Run completed successfully |
| Failed | Run invalidated |
| Abandoned | Player manually exits the run |

State transitions must be explicit.

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
  +---- Checkpoint 1
  |
  +---- Checkpoint 2
  |
  +---- Checkpoint 3
  |
  +---- Checkpoint 4
  |
  +---- Checkpoint 5
  |
  v
Finished
  |
  v
Results
```

Failure and abandonment can occur during an active run.

A failed or abandoned run must never be saved as a valid leaderboard entry.

## 3.2 Starting a Run

Starting a run must:

1. Load the selected route definition.
2. Validate route configuration.
3. Initialize the player at the start position.
4. Reset movement-related temporary state.
5. Reset checkpoint progress.
6. Reset run statistics.
7. Reset section split data.
8. Initialize the timer.
9. Prepare the HUD.
10. Enter the Ready state.

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
3. Calculate statistics.
4. Evaluate medals.
5. Validate the run.
6. Update personal records.
7. Save the leaderboard entry.
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

## 4.4 Pause Behavior

The initial competitive implementation should not support pausing an official run.

If the application loses focus or the player switches tabs:

- The timer continues.
- The run remains active.
- The event is recorded in run metadata if needed.

This avoids creating a pause-based advantage.

A future practice mode may introduce pause functionality without affecting official competitive records.

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

# 6. Checkpoint System

## 6.1 Purpose

Checkpoints provide:

- Progress tracking.
- Section timing.
- Route validation.
- Recovery opportunities in training.
- Protection against skipping mandatory sections.

The Prologue requires five mandatory checkpoints.

## 6.2 Checkpoint Definition

```typescript
interface CheckpointDefinition {
    id: string;

    index: number;

    position: Vector3;

    trigger: TriggerDefinition;

    sectionId: string;

    mandatory: boolean;
}
```

## 6.3 Sequential Validation

Checkpoints must be completed in the configured order.

Example:

```text
Expected: CP1
Player enters CP1
Result: Accepted

Expected: CP2
Player enters CP3
Result: Rejected

Expected: CP2
Player enters CP2
Result: Accepted
```

The player cannot skip mandatory checkpoints.

The CheckpointManager maintains the expected checkpoint index.

## 6.4 Checkpoint Events

```typescript
interface CheckpointEvent {
    checkpointId: string;

    timestamp: number;

    elapsedTime: number;

    sectionId: string;
}
```

Each accepted checkpoint generates one event.

Duplicate trigger events must be ignored.

## 6.5 Checkpoint Feedback

When a checkpoint is activated:

- Show a visual confirmation.
- Play a short audio cue.
- Update the HUD.
- Record the checkpoint timestamp.
- Update the current section split.

Feedback must be immediate and must not interrupt movement.

## 6.6 Recovery

Training mode may support checkpoint recovery.

The player can restart from the latest checkpoint.

In an official Prologue run, checkpoint recovery must not be silently allowed.

If a recovery mechanic is introduced later, it must have explicit competitive rules and must invalidate or separately classify the run where appropriate.

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

Statistics provide additional context beyond the final completion time.

## 8.1 Initial Statistics

Track the following values:

| Statistic | Description |
|---|---|
| Total Time | Complete run duration |
| Section Times | Individual section durations |
| Checkpoints | Successfully completed checkpoints |
| Jump Count | Number of jumps |
| Slide Count | Number of slides |
| Wall Runs | Number of wall-run actions |
| Wall Jumps | Number of wall jumps |
| Landings | Number of registered landings |
| Falls | Number of falls or route failures |
| Distance | Total player movement distance |
| Run Version | Route and game version |

Not every statistic needs to be displayed on the results screen.

## 8.2 Statistics Collection

Statistics must be collected through gameplay events rather than repeatedly scanning player state.

Recommended events:

```typescript
interface RunStatistics {
    jumpCount: number;

    slideCount: number;

    wallRunCount: number;

    wallJumpCount: number;

    landingCount: number;

    fallCount: number;

    distanceTravelled: number;
}
```

Avoid excessive allocations during gameplay.

Statistics collection must not affect physics performance.

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

Example configuration:

```typescript
const prologueMedals = {
    bronze: 180000,
    silver: 150000,
    gold: 120000
};
```

These are initial balancing placeholders, not final gameplay targets.

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

Use IndexedDB for persistent leaderboard storage.

Do not use localStorage as the primary storage mechanism for run history.

IndexedDB provides structured storage and better support for future expansion.

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

    statistics: RunStatistics;

    validation: RunValidationResult;
}
```

## 11.3 Database Structure

Database name:

```text
MirrorEdgeSpeedrun
```

Object stores:

```text
runs
personalRecords
settings
```

Recommended indexes:

### runs

- routeId
- completionTime
- completedAt
- routeVersion

### personalRecords

- routeId
- routeVersion

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

For the initial version, the run manager is the authoritative source of timing data.

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

The interface should follow the established Mirror's Edge-inspired visual direction:

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

### RunManager

Responsible for:

- Run lifecycle.
- State transitions.
- Starting and finishing runs.
- Coordinating subsystems.
- Run validation.
- Producing completed run results.

### RunTimer

Responsible for:

- Starting the timer.
- Stopping the timer.
- Measuring elapsed time.
- Providing current elapsed time.

### CheckpointManager

Responsible for:

- Checkpoint registration.
- Sequential validation.
- Checkpoint events.
- Progress tracking.

### RunStatistics

Responsible for:

- Collecting gameplay statistics.
- Counting movement events.
- Measuring distance.
- Producing statistics snapshots.

### RouteDefinition

Responsible for:

- Route metadata.
- Section configuration.
- Checkpoint configuration.
- Medal thresholds.
- Route versioning.

### LeaderboardManager

Responsible for:

- Saving completed runs.
- Retrieving run history.
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

Reserved for future implementation.

## 16.2 Dependency Overview

```text
              RunManager
                  |
       +----------+----------+
       |          |          |
       v          v          v
    RunTimer  Checkpoint  Statistics
                  |
                  v
             RunValidator
                  |
                  v
          LeaderboardManager
                  |
                  v
              IndexedDB
```

RouteDefinition provides configuration to the relevant modules.

HUD and Results UI consume state and completed run data.

They must not directly modify timer or checkpoint state.

## 16.3 Event-Driven Integration

Gameplay systems should communicate through explicit events.

Suggested events:

```typescript
type SpeedrunEvent =
    | { type: "RUN_STARTED" }
    | { type: "CHECKPOINT_REACHED"; checkpointId: string }
    | { type: "SECTION_COMPLETED"; sectionId: string }
    | { type: "RUN_FINISHED" }
    | { type: "RUN_FAILED"; reason: string }
    | { type: "RUN_ABANDONED" };
```

Events must be emitted once per valid transition.

Avoid coupling the movement controller directly to IndexedDB or leaderboard logic.

---

# 17. Performance and Reliability

The Speedrun System must not negatively affect gameplay performance.

Requirements:

- No database writes every frame.
- No expensive validation during active movement.
- No unnecessary allocations in the update loop.
- No dependence on rendered frame rate.
- No blocking database operations.
- No timer drift caused by UI rendering.
- No loss of completed results during ordinary UI transitions.

Database operations should happen asynchronously.

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

## 18.3 Database Failure

If IndexedDB is unavailable:

- The current run must still function.
- The player must still see the result.
- The game must report that local persistence failed.
- The result should remain available in memory while the application session continues.

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
- Implement RunManager.
- Implement run states.
- Implement start and finish transitions.
- Connect timer to the Prologue.

Acceptance criteria:

- Timer starts exactly once.
- Timer stops on completion.
- Timing is independent of FPS.
- Invalid state transitions are rejected.

## Phase 2 — Checkpoints

- Implement CheckpointManager.
- Define five Prologue checkpoints.
- Add sequential validation.
- Add checkpoint feedback.
- Implement section boundaries.

Acceptance criteria:

- All checkpoints are detected.
- Skipping mandatory checkpoints is rejected.
- Duplicate events are ignored.
- Checkpoint timestamps are recorded correctly.

## Phase 3 — Statistics and Splits

- Implement RunStatistics.
- Track movement events.
- Calculate section times.
- Implement split comparisons.

Acceptance criteria:

- Statistics are collected correctly.
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

- Implement IndexedDB.
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
- [ ] Gameplay statistics are collected.
- [ ] Medal thresholds are configurable.
- [ ] Results screen displays accurate information.
- [ ] Personal records are maintained.
- [ ] Local leaderboard uses IndexedDB.
- [ ] Run validation works.
- [ ] Invalid runs cannot enter the official leaderboard.
- [ ] Records persist across application reloads.
- [ ] Retry functionality works without restarting the application.
- [ ] Ghost Replay remains outside the initial implementation.
- [ ] The system does not introduce measurable gameplay performance degradation.

---

# 24. Final Design Constraints

The implementation agent must follow these constraints:

1. Do not implement online leaderboards.
2. Do not introduce multiplayer functionality.
3. Do not implement Ghost Replay in the initial release.
4. Do not use frame count as a timing mechanism.
5. Do not use Date.now() for elapsed run time.
6. Do not couple gameplay movement logic to IndexedDB.
7. Do not allow the HUD to modify authoritative run state.
8. Do not accept incomplete checkpoint sequences.
9. Do not save invalid runs as official leaderboard records.
10. Do not hardcode route-specific logic inside generic speedrun modules.
11. Keep route definitions data-driven.
12. Preserve route versioning for future level changes.
13. Keep the system modular and extensible.

**Primary objective:** Build a reliable, replayable time-trial system that makes improving movement execution and route mastery the central motivation for repeatedly playing the Prologue.