# 30_STATISTICS_SYSTEM_SPEC.md

# Statistics System Specification

**Project:** Glassline  
**Document:** 30 — Statistics System  
**Status:** Implementation Specification  
**Version:** 1.0

---

## 1. Purpose

The Statistics System collects, aggregates, stores, and exposes gameplay statistics across the application.

It provides a unified source of historical and aggregate information about player activity without duplicating the business logic of individual gameplay systems.

The system answers questions such as:

- How far has the player travelled?
- How much time has been spent in gameplay?
- How many jumps, vaults, slides, and wall-runs have been performed?
- How many Training exercises have been attempted?
- How many Prologue sessions have been completed?
- How many Speedrun attempts have been made?
- How many successful interactions have occurred?
- Which movement mechanics are used most frequently?
- How has gameplay activity changed over time?

Statistics are intended for:

- Player-facing statistics screens.
- Progression summaries.
- Achievement condition evaluation.
- Training and gameplay summaries.
- Debugging and development diagnostics.
- Future analytics and optional external integrations.

### 1.1 Core Design Principle

Statistics System records and aggregates facts reported by authoritative systems.

It does not decide what those facts mean for gameplay.

For example:

- Movement System reports successful movement actions.
- Statistics System counts them.
- Achievement System evaluates achievement conditions.
- Progression System evaluates progression milestones.
- Speedrun System owns official run timing and validation.
- Statistics System may retain a historical summary of completed runs.

No consumer should independently reconstruct the same aggregate statistics when those values can be obtained from Statistics System.

---

## 2. Scope

### 2.1 In Scope

The initial implementation includes:

1. Statistics event ingestion.
2. Event validation and normalization.
3. Event deduplication.
4. Session-scoped statistics.
5. Lifetime statistics.
6. Mode-specific statistics.
7. Movement statistics.
8. Training statistics.
9. Speedrun summary statistics.
10. Interaction statistics.
11. Checkpoint statistics.
12. Section and level completion statistics.
13. Aggregation and snapshot generation.
14. Persistence integration.
15. Statistics reset.
16. Query interfaces.
17. Achievement and Progression integration.
18. Debugging and diagnostics.

### 2.2 Out of Scope

Statistics System does not own:

- Gameplay mechanics.
- Movement physics.
- Movement state transitions.
- Training exercise evaluation.
- Training scoring or mastery.
- Speedrun timers.
- Speedrun validation.
- Official Speedrun personal bests.
- Checkpoint order validation.
- Achievement definitions or unlocking.
- Progression rules.
- Player health or damage systems.
- Save database implementation.
- HUD or Menu rendering.
- Online leaderboards.
- User tracking or telemetry transmission.

### 2.3 Deferred Features

The following are not required initially:

- Cloud statistics synchronization.
- Remote analytics.
- Cross-device aggregation.
- Multiplayer statistics.
- Competitive player comparisons.
- Advanced heatmaps.
- Detailed route telemetry.
- Replay-derived statistics.
- Ghost Replay analytics.
- Statistical trend prediction.
- Export to third-party services.
- Real-time external dashboards.

The architecture should allow future data consumers without changing the ownership of existing gameplay systems.

---

## 3. Architectural Ownership

Statistics System owns aggregated historical facts about player activity.

It does not own the gameplay rules that produce those facts.

### 3.1 Responsibility Matrix

| Responsibility | Owner |
|---|---|
| Gameplay event authority | Source gameplay systems |
| Event ingestion | Statistics System |
| Event normalization | Statistics System |
| Event deduplication | Statistics System |
| Session statistics | Statistics System |
| Lifetime statistics | Statistics System |
| Mode-specific aggregates | Statistics System |
| Historical statistics | Statistics System |
| Statistics snapshots | Statistics System |
| Statistics payload schema and reset scopes | Statistics System |
| Persistence infrastructure | Save System |
| Movement action validation | Movement System |
| Training results | Training System |
| Speedrun timer, validation, run result construction, and official personal bests | Speedrun System |
| Checkpoint progress | Checkpoint System |
| Achievement conditions | Achievement System |
| Progression milestones | Progression System |
| Statistics presentation | Menu / HUD Systems |
| Localization | Localization System |
| Accessibility policy | Accessibility System |

### 3.2 Relationship with Achievement System

Achievement System consumes statistics when an achievement condition requires an aggregate value (`29_ACHIEVEMENT_SYSTEM_SPEC.md`).

Examples:

- Complete 100 vaults.
- Travel a cumulative distance.
- Perform a specified number of wall-runs.

Achievement System remains responsible for evaluating achievement conditions and unlocking achievements.

Statistics System must not know which achievements depend on its values.

### 3.3 Relationship with Progression System

Progression System may consume statistics snapshots or statistic threshold events (`22_PROGRESSION_SYSTEM_SPEC.md`).

Examples:

- Reach a cumulative movement distance.
- Complete a certain number of gameplay sessions.
- Reach a total number of Training attempts.

Progression System owns milestone and unlock semantics.

Statistics System only provides the underlying facts.

### 3.4 Relationship with Speedrun System

Speedrun System is authoritative for (`09_SPEEDRUN_SYSTEM_SPEC.md`):

- Official run time.
- Split times.
- Checkpoint sequence.
- Run validity.
- Medal calculation.
- Personal best.
- Run completion status.

Statistics System may store aggregate summaries of valid and invalid attempts.

It must never become an alternative Speedrun timer or validation system.

Conversely, the Speedrun System consumes the finalized session-scoped statistics summary for the run (section 13.4). It must not maintain a second collector for those values. Statistics System does not produce, rank, or persist the official run record; it supplies aggregate facts only.

### 3.5 Relationship with Training System

Training System is authoritative for (`21_TRAINING_SYSTEM_SPEC.md`):

- Exercise definitions.
- Exercise attempts.
- Exercise completion.
- Mastery.
- Scores.
- Exercise-specific results.

Statistics System may aggregate these results.

It must not calculate Training scores or decide whether an exercise was mastered.

### 3.6 Relationship with Save System

Statistics System owns aggregation semantics, statistic definitions, snapshot structure, and reset scopes.

Save System owns persistence infrastructure, database schema versioning, repositories, transactions, backup, and import/export (`10_SAVE_SYSTEM_SPEC.md`).

Statistics System persists data only through its Save repository. It must not access IndexedDB directly and must not introduce a competing save format or database name.

Save System must not recalculate, reinterpret, or mutate statistics aggregates.

---

## 4. High-Level Architecture

```text
Authoritative Gameplay Systems
          |
          v
Statistics Event Adapters
          |
          v
Statistics Event Router
          |
          v
Event Validation
          |
          v
Event Deduplication
          |
          v
Statistics Processor
          |
          +----------------------+
          |                      |
          v                      v
Session Aggregator        Lifetime Aggregator
          |                      |
          +----------+-----------+
                     |
                     v
             Statistics Store
                     |
                     v
            Statistics Snapshot
                     |
          +----------+----------+
          |          |          |
          v          v          v
       Menu UI   Achievement  Progression
                    System      System
```

Supporting systems:

```text
Save System
Gameplay Session System
Movement System
Training System
Speedrun System
Interaction System
Checkpoint System
Level Runtime
Gameplay Flow
Localization System
Accessibility System
```

Statistics processing must be event-driven.

The initial implementation must not poll gameplay systems every frame.

Snapshots are consumed by Menu/HUD presentation, Achievement evaluation, Progression milestones, and Speedrun run-result construction. Persistence is delegated to the Save System, which stores and returns statistics records without deriving or reinterpreting gameplay facts.

---

## 5. Core Components

### 5.1 StatisticsManager

Central public entry point.

Responsibilities:

- Initialize the Statistics System.
- Register event adapters.
- Load persisted statistics.
- Receive normalized events.
- Coordinate event processing.
- Expose statistics snapshots.
- Provide query interfaces.
- Coordinate persistence.
- Publish aggregate update events.
- Handle reset operations.

Suggested interface:

```typescript
interface IStatisticsManager {
    initialize(): Promise<void>;

    processEvent(event: StatisticsEvent): void;

    getSnapshot(
        scope?: StatisticsQueryScope
    ): StatisticsSnapshot;

    getLifetimeStatistics(): LifetimeStatistics;

    getSessionStatistics(
        sessionId: string
    ): SessionStatistics | undefined;

    finalizeSession(
        sessionId: string
    ): Promise<SessionStatistics>;

    getModeStatistics(
        mode: GameplayMode
    ): ModeStatistics | undefined;

    subscribe(
        listener: (event: StatisticsSystemEvent) => void
    ): Unsubscribe;

    reset(
        scope: StatisticsResetScope
    ): Promise<void>;
}
```

The manager coordinates specialized components and must not contain all aggregation logic itself.

### 5.2 StatisticsEventRouter

Receives events from authoritative systems.

Responsibilities:

- Subscribe to public domain events.
- Normalize event envelopes.
- Preserve source identity.
- Attach correlation context where required.
- Reject stale events.
- Route valid events to processors.

The router must not modify the source events.

### 5.3 StatisticsEventValidator

Validates incoming events.

Responsibilities:

- Validate event identity.
- Validate event type.
- Validate source.
- Validate payload schema.
- Validate timestamps.
- Validate numeric values.
- Validate session and attempt context.
- Reject malformed data.

Invalid events must not modify statistics.

### 5.4 StatisticsDeduplicationManager

Prevents repeated delivery from producing duplicate aggregate updates.

Responsibilities:

- Track processed event IDs.
- Detect duplicates.
- Maintain bounded deduplication state.
- Coordinate persistence of relevant deduplication metadata.
- Support safe recovery after reload.

Deduplication must distinguish repeated delivery from legitimate repeated gameplay actions.

### 5.5 StatisticsProcessor

Converts validated events into statistic updates.

Responsibilities:

- Resolve event-to-statistic mappings.
- Apply aggregation rules.
- Update session statistics.
- Update lifetime statistics.
- Update mode-specific statistics.
- Produce change notifications.

It must not contain source gameplay validation logic.

### 5.6 SessionStatisticsAggregator

Maintains statistics scoped to a single gameplay session.

Responsibilities:

- Initialize session aggregates.
- Apply session events.
- Track session duration.
- Track movement activity.
- Track mode-specific activity.
- Produce immutable session snapshots.
- Finalize session statistics.

Session identity must be validated before updates.

### 5.7 LifetimeStatisticsAggregator

Maintains cumulative statistics across sessions.

Responsibilities:

- Aggregate finalized session results.
- Apply valid persistent events.
- Maintain cumulative counters.
- Maintain lifetime distance and time.
- Maintain lifetime mode totals.
- Produce lifetime snapshots.

It must not reconstruct official results from raw gameplay state.

### 5.8 ModeStatisticsAggregator

Maintains aggregates for individual gameplay modes.

Initial supported modes:

- Training.
- Prologue.
- Speedrun, where represented as a distinct session or run category.

Responsibilities:

- Track mode-specific session counts.
- Aggregate relevant counters.
- Track completion totals.
- Track accumulated activity.
- Produce mode snapshots.

Mode classification must use the authoritative session context.

### 5.9 StatisticsRepository

Provides persistence abstraction.

Responsibilities:

- Load statistics records.
- Save aggregate snapshots.
- Save deduplication metadata.
- Save session summaries.
- Migrate historical records.
- Reset selected statistics scopes.
- Report persistence failures.

Actual persistence must be delegated to Save System.

### 5.10 StatisticsQueryService

Provides read-only queries.

Responsibilities:

- Return lifetime snapshots.
- Return session snapshots.
- Return mode snapshots.
- Filter statistics by category.
- Return supported statistic metadata.
- Avoid exposing mutable internal state.

Queries must not trigger gameplay mutations.

### 5.11 StatisticsValidator

Validates:

- Statistic identifiers.
- Aggregation definitions.
- Event mappings.
- Scope definitions.
- Numeric ranges.
- Snapshot consistency.
- Migration output.

---

## 6. Data Model

Statistics must use stable identifiers independent of localized display names.

### 6.1 StatisticDefinition

Defines a statistic that can be collected.

```typescript
interface StatisticDefinition {
    id: string;

    category: StatisticCategory;

    valueType:
        | "integer"
        | "float"
        | "duration";

    aggregation:
        | "sum"
        | "maximum"
        | "minimum"
        | "latest"
        | "count";

    source: string;

    eventTypes: string[];

    unit?: StatisticUnit;

    persistent: boolean;

    visible: boolean;
}
```

Definitions must be immutable after registration.

### 6.2 StatisticCategory

```typescript
type StatisticCategory =
    | "general"
    | "movement"
    | "training"
    | "speedrun"
    | "interaction"
    | "exploration"
    | "progression";
```

Categories are used for grouping and presentation.

They must not determine event processing behavior by themselves.

### 6.3 StatisticUnit

```typescript
type StatisticUnit =
    | "count"
    | "meters"
    | "seconds"
    | "milliseconds"
    | "meters-per-second";
```

All internal units must be explicit.

Do not mix milliseconds and seconds within the same statistic.

### 6.4 StatisticValue

```typescript
interface StatisticValue {
    statisticId: string;

    value: number;

    updatedAt: number;

    scope: StatisticsScope;

    sourceEventId?: string;
}
```

Values must be finite numbers.

Invalid values such as `NaN` and `Infinity` must be rejected.

### 6.5 StatisticsScope

```typescript
type StatisticsScope =
    | {
        type: "lifetime";
    }
    | {
        type: "session";
        sessionId: string;
    }
    | {
        type: "mode";
        mode: GameplayMode;
    };
```

Additional scopes may be introduced later.

### 6.6 StatisticsQueryScope

```typescript
interface StatisticsQueryScope {
    type:
        | "lifetime"
        | "session"
        | "mode";

    sessionId?: string;

    mode?: GameplayMode;

    category?: StatisticCategory;
}
```

Invalid combinations must be rejected.

### 6.7 SessionStatistics

```typescript
interface SessionStatistics {
    sessionId: string;

    summaryId: string;

    mode: GameplayMode;

    startedAt: number;

    finalizedAt?: number;

    durationSeconds: number;

    completed: boolean;

    values: Record<string, number>;
}
```

`durationSeconds` is an aggregate session duration.

It must not be used as an official Speedrun time.

A finalized session summary is identified by `summaryId`. Consumers such as the Speedrun System reference this identifier instead of copying aggregate values into their own records.

### 6.8 ModeStatistics

```typescript
interface ModeStatistics {
    mode: GameplayMode;

    sessionCount: number;

    completedSessionCount: number;

    totalDurationSeconds: number;

    values: Record<string, number>;

    updatedAt: number;
}
```

### 6.9 LifetimeStatistics

```typescript
interface LifetimeStatistics {
    totalPlayTimeSeconds: number;

    totalSessions: number;

    completedSessions: number;

    totalDistanceMeters: number;

    totalJumps: number;

    totalVaults: number;

    totalSlides: number;

    totalWallRuns: number;

    totalWallJumps: number;

    totalFalls: number;

    totalInteractions: number;

    totalCheckpoints: number;

    values: Record<string, number>;

    updatedAt: number;
}
```

The explicit fields provide a convenient stable interface for common statistics.

`values` supports extensible statistic identifiers.

The implementation must avoid maintaining two independently mutable representations of the same value.

Prefer generating explicit snapshot fields from the canonical statistic registry.

### 6.10 StatisticsSnapshot

```typescript
interface StatisticsSnapshot {
    revision: number;

    generatedAt: number;

    scope: StatisticsScope;

    values: Record<string, StatisticValue>;

    categories: Record<
        StatisticCategory,
        Record<string, number>
    >;
}
```

Snapshots must be immutable from the consumer's perspective.

---

## 7. Initial Statistic Catalog

The initial implementation should use a focused catalog.

### 7.1 General Statistics

| ID | Description | Aggregation |
|---|---|---|
| `general.total_play_time` | Total gameplay time | Sum |
| `general.total_sessions` | Number of gameplay sessions | Count |
| `general.completed_sessions` | Completed gameplay sessions | Count |
| `general.total_distance` | Total distance travelled | Sum |
| `general.longest_session` | Longest session duration | Maximum |

### 7.2 Movement Statistics

| ID | Description | Aggregation |
|---|---|---|
| `movement.total_jumps` | Successful jumps | Sum |
| `movement.total_vaults` | Successful vaults | Sum |
| `movement.total_slides` | Successful slides | Sum |
| `movement.total_wall_runs` | Successful wall-runs | Sum |
| `movement.total_wall_jumps` | Successful wall-jumps | Sum |
| `movement.total_landings` | Completed landings | Sum |
| `movement.total_falls` | Falls reported by the authoritative gameplay source | Sum |
| `movement.maximum_speed` | Highest valid reported speed | Maximum |
| `movement.total_sprint_time` | Time spent sprinting | Sum |
| `movement.total_air_time` | Time spent airborne | Sum |

A movement action should be counted only when the Movement System reports the corresponding successful semantic event.

Do not count raw input presses as successful movement actions.

### 7.3 Training Statistics

| ID | Description | Aggregation |
|---|---|---|
| `training.total_attempts` | Training exercise attempts | Sum |
| `training.completed_exercises` | Completed exercises | Sum |
| `training.mastered_exercises` | Mastered exercises | Sum |
| `training.total_time` | Time spent in Training | Sum |
| `training.highest_score` | Highest reported exercise score | Maximum |

Training System remains authoritative for these results.

Repeated completion of the same exercise must follow Training's event semantics.

### 7.4 Speedrun Statistics

| ID | Description | Aggregation |
|---|---|---|
| `speedrun.total_attempts` | Speedrun attempts | Sum |
| `speedrun.completed_runs` | Valid completed runs | Sum |
| `speedrun.failed_runs` | Failed or invalid attempts | Sum |
| `speedrun.total_medals` | Awarded medals | Sum |
| `speedrun.personal_best_improvements` | Personal best improvement events reported by the Speedrun System | Sum |

Statistics System may additionally retain a limited history of run summaries.

It must not calculate personal bests or medal results.

These are aggregate historical counters. Run-result statistics are not separate statistics: they are the same aggregate keys evaluated in the run's statistics session scope (section 13.4). Total time, section times, checkpoint completion, run validity, medals, and personal bests are owned by the Speedrun System and are never derived here.

### 7.5 Interaction Statistics

| ID | Description | Aggregation |
|---|---|---|
| `interaction.total_interactions` | Successful interactions | Sum |
| `interaction.unique_targets` | Unique successfully used targets | Count |
| `interaction.failed_attempts` | Failed interactions, if reported | Sum |

Unique target counts require stable target identifiers and an explicit deduplication policy.

### 7.6 Exploration Statistics

| ID | Description | Aggregation |
|---|---|---|
| `exploration.sections_entered` | Sections entered | Sum |
| `exploration.sections_completed` | Sections completed | Sum |
| `exploration.levels_completed` | Levels completed | Sum |
| `exploration.checkpoints_activated` | Checkpoints activated | Sum |

A repeated section entry may legitimately count more than once.

If unique section discovery is desired, define a separate statistic with unique-ID semantics.

---

## 8. Event Processing

### 8.1 Event Envelope

All incoming events must be normalized into a common envelope.

```typescript
interface StatisticsEvent {
    eventId: string;

    type: string;

    source: string;

    timestamp: number;

    sessionId?: string;

    attemptId?: string;

    levelId?: string;

    sectionId?: string;

    mode?: GameplayMode;

    payload?: Record<string, unknown>;
}
```

The envelope must preserve the identity and semantics of the original source event.

Session-scoped statistics require a valid `sessionId`. Events for subordinate contexts (Training exercise attempts, Speedrun attempts) must preserve `attemptId` so that they correlate with the correct attempt and are not counted twice. Events with stale, ended, or missing session context must be rejected.

### 8.2 Processing Pipeline

For every incoming event:

1. Validate event structure.
2. Validate source ownership.
3. Validate required payload.
4. Validate session context.
5. Check deduplication.
6. Resolve matching statistic definitions.
7. Calculate updates according to aggregation rules.
8. Apply updates to in-memory aggregates.
9. Publish update events.
10. Schedule persistence.

A rejected event must not modify any aggregate.

### 8.3 Aggregation Rules

#### Sum

Adds a valid numeric value.

Example:

```text
total_jumps += 1
```

#### Maximum

Retains the highest valid value.

Example:

```text
maximum_speed = max(current, reportedSpeed)
```

#### Minimum

Retains the lowest valid value.

Useful for best-duration metrics when the source supplies an authoritative duration.

#### Latest

Replaces the stored value with the latest valid value.

#### Count

Increments by one for each accepted event.

The implementation must define whether each event contributes once globally, once per session, or once per unique entity.

### 8.4 Numeric Validation

All numeric values must be validated.

Requirements:

- Finite numbers only.
- Non-negative values for counters and durations.
- Explicit units.
- Defined precision.
- Bounded values where applicable.
- No implicit conversion between incompatible units.

### 8.5 Event Timestamp

Event timestamps are used for ordering and historical metadata.

They must not be used as a replacement for monotonic gameplay clocks.

If the source reports elapsed gameplay duration, use the source's authoritative duration.

For example, Speedrun durations must originate from Speedrun System.

---

## 9. Session Statistics Lifecycle

Session statistics are scoped to a Gameplay Session.

### 9.1 Session Start

When Gameplay Session starts:

1. Receive session ID.
2. Receive authoritative gameplay mode.
3. Create session aggregate.
4. Initialize counters.
5. Subscribe to relevant session events.
6. Record start timestamp.

Repeated initialization with the same active session ID must not create duplicate sessions.

### 9.2 Active Session

During gameplay:

- Apply valid session events.
- Update session aggregates.
- Update relevant lifetime aggregates according to persistence policy.
- Publish snapshot revisions when meaningful changes occur.

The system must not create a new session for every Training exercise or Speedrun checkpoint.

Training attempts and Speedrun attempts are subordinate contexts.

A ranked run establishes a fresh statistics session scope at run start (see `09_SPEEDRUN_SYSTEM_SPEC.md`); the finalized summary of that session is what the Speedrun run result consumes.

### 9.3 Session Completion

When Gameplay Session reports completion:

1. Validate the session.
2. Finalize duration.
3. Mark completion status.
4. Generate immutable session summary.
5. Update mode aggregates.
6. Commit lifetime session counters.
7. Persist finalized data.

A consumer such as the Speedrun System may request session finalization when its own completion sequence needs the finalized summary. Such a request finalizes the same session aggregate exactly once; a later Gameplay Session completion reuses the already finalized summary rather than creating a second one.

### 9.4 Session Abandonment

An abandoned session is still a valid gameplay session.

It should contribute to:

- Total sessions.
- Gameplay duration.
- Activity counters accumulated before abandonment.

It must not contribute to completed session counts.

### 9.5 Session Failure

Failed sessions should be recorded according to the session result semantics.

A failed session must not be counted as a completed session.

The system must distinguish failure, abandonment, and successful completion.

### 9.6 Session Unload

When a session unloads:

- Stop accepting new session-scoped events.
- Finalize or discard transient state according to authoritative session result.
- Flush pending persistence operations.
- Remove subscriptions.
- Reject late events.

Late asynchronous updates must not recreate an ended session.

---

## 10. Time and Duration Statistics

Time statistics require special care.

### 10.1 General Play Time

General play time measures gameplay session duration.

It must exclude time spent in:

- Main Menu.
- Loading screens.
- Application initialization.
- Non-gameplay settings screens.

Pause behavior must be explicit.

The initial implementation should exclude paused time from active gameplay duration where the session lifecycle provides reliable pause and resume transitions.

### 10.2 Timing Source

Use monotonic time for measuring elapsed durations within a running application.

Use wall-clock timestamps for historical metadata.

Do not subtract wall-clock timestamps to calculate authoritative gameplay durations when a monotonic source is available.

### 10.3 Speedrun Time

Speedrun timing remains exclusively owned by Speedrun System.

Statistics System may store the reported run duration for aggregate reporting.

It must not derive official run time from session duration.

### 10.4 Active Movement Time

Movement-specific durations should be reported by authoritative source events or duration summaries.

Avoid per-frame statistics updates.

For example, Movement System may emit a sprint duration summary when sprinting ends or when a session is finalized.

---

## 11. Movement Integration

Movement System is the authoritative source of movement-related events.

Statistics System may consume (implemented long-term envelopes):

- `movement.jump` (jump completed).
- `movement.vault` (vault started).
- `movement.slide` (slide started).
- `movement.wall_run` (wall run started).
- `movement.wall_jump` (wall jump).
- `movement.landing` (landing completed).
- `movement.distance` (distance summary).
- `movement.maximum_speed` (maximum speed update).
- `movement.started` / `movement.fall`.

The Movement System is the authoritative source of these facts.

### 11.1 Distance Tracking

Distance should be calculated by the system that owns authoritative player movement.

Statistics System must not independently sample player position every frame.

The Movement integration should provide validated distance deltas or a session summary.

Distance must be defined consistently:

- World-space movement distance.
- Whether vertical movement contributes.
- Whether teleports and respawns are excluded.
- Whether scripted movement is included.

Initial recommendation:

- Track actual locomotion distance.
- Exclude teleportation and respawn placement.
- Exclude camera-only movement.
- Include intentional movement in all supported locomotion states.
- Keep scripted traversal contributions explicit.

### 11.2 Movement Action Counts

Count successful mechanic events rather than attempts.

Examples:

- A jump counts when the Movement System confirms jump execution.
- A vault counts when the vault action successfully completes.
- A wall-run counts according to the Movement System's defined completion semantics.

The Statistics System must not decide what constitutes a successful action.

### 11.3 Duration Aggregation

Sprint time and airborne time must be provided as durations or completed intervals.

Avoid accumulating duration through per-frame event ingestion.

---

## 12. Training Integration

Training System publishes authoritative exercise events.

Statistics System may consume:

- Exercise attempt started.
- Exercise attempt completed.
- Exercise completed.
- Exercise mastered.
- Exercise abandoned.
- Training session completed.

### 12.1 Attempt Semantics

An exercise retry is a new attempt, not a new Gameplay Session.

Statistics must distinguish:

- Training session count.
- Exercise attempt count.
- Exercise completion count.
- Exercise mastery count.

### 12.2 Scores

Training System owns score calculation.

Statistics System may aggregate:

- Highest reported score.
- Number of completed exercises.
- Number of mastered exercises.

It must not recalculate medals or mastery.

### 12.3 Duplicate Completion

If Training System publishes a completion event more than once, event deduplication must prevent duplicate counts.

A legitimate replay completion must count according to the event's unique attempt or completion identity.

---

## 13. Speedrun Integration

Speedrun System is the authoritative source of run results.

Statistics System may consume:

- Run started.
- Run completed.
- Run failed.
- Run abandoned.
- Medal awarded.
- Personal best improved.

### 13.1 Run Summary

An optional compact run summary may be stored:

```typescript
interface SpeedrunStatisticsRecord {
    runId: string;

    sessionId: string;

    completed: boolean;

    valid: boolean;

    durationMilliseconds?: number;

    medal?: "bronze" | "silver" | "gold";

    completedAt: number;
}
```

This record is a historical summary.

It is not a replacement for the Speedrun System's authoritative run record.

Values such as `valid`, `medal`, and `durationMilliseconds` are copied from the authoritative Speedrun result. Statistics System must not compute, promote, or validate them.

### 13.2 Personal Best

Statistics System may count personal best improvements.

It must not calculate the best time by scanning run history.

The Speedrun System reports the improvement event.

### 13.3 Invalid Runs

Invalid runs may contribute to attempt counts.

They must not contribute to completed valid run counts or medal totals.

The exact classification must follow Speedrun event semantics.

### 13.4 Run Result Consumption

The Speedrun System constructs the official run result and record. For the aggregate gameplay facts that belong to Statistics, it consumes the finalized session-scoped statistics summary instead of running a second collector.

When a run finishes:

1. The Speedrun System requests finalization of its session statistics scope and receives the finalized session summary from Statistics System.
2. Statistics System finalizes the session aggregate (once) and returns the summary identified by `summaryId`.
3. The Speedrun System builds the run result from its own timer, splits, checkpoint, validation, and medal data plus the provided summary values.
4. The run record stores `statisticsSummaryId` (see `09_SPEEDRUN_SYSTEM_SPEC.md`); it must not store a duplicate copy of the aggregate statistics summary.

The finalization request uses `IStatisticsManager.finalizeSession(sessionId)` and returns the finalized `SessionStatistics`; the returned `summaryId` is the value the run record stores as `statisticsSummaryId`.

The summary covers the statistics session scope established at run start. Run-result statistics defined in `09_SPEEDRUN_SYSTEM_SPEC.md` map to Statistics aggregate keys as follows:

| Run result statistic (Speedrun, 09) | Statistics source |
|---|---|
| Total Time | Not a statistic; Speedrun timer value |
| Section Times | Not a statistic; Speedrun split value |
| Checkpoints | Not a statistic; Checkpoint/Speedrun progress value |
| Jump Count | `movement.total_jumps` (session scope) |
| Slide Count | `movement.total_slides` (session scope) |
| Wall Runs | `movement.total_wall_runs` (session scope) |
| Wall Jumps | `movement.total_wall_jumps` (session scope) |
| Landings | `movement.total_landings` (session scope) |
| Falls | `movement.total_falls` (session scope) |
| Distance | `general.total_distance` (session scope) |
| Run Version | Not a statistic; Speedrun/route metadata |

This mapping identifies where values come from; it does not transfer ownership of run-result semantics to Statistics System. The Speedrun System may project the generic aggregate values into its typed run-result view; the canonical aggregate definitions remain in Statistics System. Statistics System does not validate the run, order checkpoints, calculate medals, or persist the official run record. The Speedrun System must not attach a duplicate statistics summary to its record or recompute these values independently.

---

## 14. Interaction and Checkpoint Integration

### 14.1 Interaction

Interaction System may report:

- Interaction completed.
- Interaction failed.
- Unique target successfully used.

Statistics System counts only events explicitly reported by Interaction System.

It must not infer successful interactions from prompt visibility or input presses.

### 14.2 Checkpoints

Checkpoint System may report:

- Checkpoint activated.
- Checkpoint reactivated, where allowed.
- Checkpoint progress finalized.

Statistics System may count activations.

It must not validate Prologue checkpoint order or determine whether a Speedrun route is valid.

Unique checkpoint discovery and total checkpoint activations should be separate statistics if both are needed.

---

## 15. Persistence

Statistics are persistent player data.

Statistics System accesses persistence through Save System.

Suggested repository:

```typescript
interface IStatisticsRepository {
    loadLifetime(): Promise<LifetimeStatistics>;

    loadModes(): Promise<ModeStatistics[]>;

    loadRecentSessions(): Promise<SessionStatistics[]>;

    loadSessionSummary(
        summaryId: string
    ): Promise<SessionStatistics | undefined>;

    saveLifetime(
        statistics: LifetimeStatistics
    ): Promise<void>;

    saveMode(
        statistics: ModeStatistics
    ): Promise<void>;

    saveSession(
        statistics: SessionStatistics
    ): Promise<void>;

    reset(
        scope: StatisticsResetScope
    ): Promise<void>;
}
```

### 15.1 Persisted Data

Persist:

- Lifetime aggregates.
- Mode aggregates.
- Recent session summaries.
- Finalized session summaries referenced by other domain records (for example by a Speedrun run record's `statisticsSummaryId`) for as long as the reference exists.
- Relevant deduplication metadata.
- Schema version.

Do not persist:

- Per-frame position history.
- Temporary movement samples.
- Pending UI notifications.
- Active event-processing objects.
- Unbounded raw event logs.
- Duplicate copies of session summary values inside the Speedrun run record; the run record references `statisticsSummaryId` instead.

Persistence goes through the Save System (section 3.6). Statistics System must not define its own database name, database version, or IndexedDB schema.

### 15.2 Storage Strategy

The initial implementation should persist aggregate snapshots rather than every raw event.

Requirements:

- Asynchronous writes.
- Batched updates.
- Session finalization persistence.
- Periodic safe checkpoints where useful.
- Recovery after interrupted sessions.
- Storage quota handling.
- Migration support.

A sudden application termination may result in loss of recent uncommitted aggregate updates.

The implementation should minimize this window without blocking gameplay.

### 15.3 Atomicity

Related aggregate updates should be committed as a consistent persistence transaction where supported by Save System infrastructure.

For example, finalizing a session may update:

- Session summary.
- Lifetime counters.
- Mode counters.
- Deduplication state.

These records must not become inconsistent due to partial writes.

### 15.4 Data Versioning

Statistics require an independent schema version.

It must be separate from:

- IndexedDB database version.
- Save System schema version.
- Statistic definition version.

The Save System owns the storage schema for statistics records; Statistics System owns the statistics payload schema version and its migrations. Migrations must preserve valid aggregates and are coordinated with Save System migration infrastructure.

Unknown statistic IDs must not crash loading.

### 15.5 Reset

Statistics reset must support explicit scopes.

Suggested model:

```typescript
type StatisticsResetScope =
    | "all"
    | "lifetime"
    | "session-history"
    | "mode";
```

A mode-specific reset should additionally identify the target mode through the reset request.

Resetting statistics must not delete:

- Speedrun personal bests.
- Training progression.
- Achievement unlocks.
- Tutorial history.
- Player settings.
- Progression unlocks.

Those records belong to their respective systems.

A statistics reset must not leave dangling `statisticsSummaryId` references in other domains' records. Session summaries referenced by another domain record are preserved, or the reset is coordinated with the owning system so that references are updated or removed together.

### 15.6 Reset Concurrency

A reset operation must invalidate pending writes based on an older statistics revision.

Late asynchronous writes must not restore data that has already been reset.

Use revision numbers or generation tokens to protect reset operations.

---

## 16. Query and Snapshot API

Statistics consumers must use read-only interfaces.

Suggested query methods:

```typescript
interface IStatisticsQueryService {
    getLifetime(): LifetimeStatistics;

    getSession(
        sessionId: string
    ): SessionStatistics | undefined;

    getSessionSummary(
        summaryId: string
    ): SessionStatistics | undefined;

    getMode(
        mode: GameplayMode
    ): ModeStatistics | undefined;

    getCategory(
        category: StatisticCategory,
        scope?: StatisticsQueryScope
    ): Record<string, number>;

    getStatistic(
        statisticId: string,
        scope?: StatisticsQueryScope
    ): number | undefined;

    getSnapshot(
        scope?: StatisticsQueryScope
    ): StatisticsSnapshot;
}
```

### 16.1 Snapshot Consistency

Snapshots must represent a consistent statistics revision.

A consumer should never receive a mixture of values from incompatible revisions.

Finalized session summaries remain available through the query service and by `summaryId`. Summaries referenced by another domain record are retained until that reference is removed (section 15.1). Consumers must treat snapshots and summaries as read-only views.

### 16.2 Immutability

Consumers must not mutate internal aggregate objects.

Return immutable copies or read-only views.

### 16.3 Query Performance

Common queries should use indexed aggregates.

Avoid recalculating lifetime statistics by scanning all historical sessions on every request.

---

## 17. Events

Statistics System publishes semantic update events.

Suggested event types:

```typescript
type StatisticsSystemEvent =
    | StatisticsUpdatedEvent
    | SessionStatisticsFinalizedEvent
    | LifetimeStatisticsUpdatedEvent
    | ModeStatisticsUpdatedEvent
    | StatisticsResetEvent;
```

Example:

```typescript
interface StatisticsUpdatedEvent {
    revision: number;

    scope: StatisticsScope;

    changedStatisticIds: string[];

    updatedAt: number;
}
```

```typescript
interface SessionStatisticsFinalizedEvent {
    sessionId: string;

    summaryId: string;

    mode: GameplayMode;

    completed: boolean;

    durationSeconds: number;

    revision: number;
}
```

Events must be published after the corresponding in-memory state transition is committed.

Persistence completion should be represented separately when a consumer needs to know whether data is durably stored.

### 17.1 Consumer Independence

Statistics System must not directly call Achievement or Progression business logic.

Those systems subscribe to statistics events or query snapshots through defined interfaces.

---

## 18. Achievement Integration

Achievement System may use Statistics System for aggregate conditions.

Examples:

- Total vault count reaches a threshold.
- Total distance reaches a threshold.
- Total sprint time reaches a threshold.
- Total completed sessions reaches a threshold.

### 18.1 Authoritative Values

Achievement System must use the canonical statistic values.

It must not maintain independent counters for values already owned by Statistics System.

### 18.2 Event vs Snapshot

Use update events when an achievement depends on a threshold crossing.

Use snapshots when displaying current progress or evaluating an initial state.

### 18.3 Initialization

When Achievement System initializes after Statistics System:

- It should receive a statistics snapshot.
- It should reconcile relevant aggregate thresholds.
- It must not award the same achievement repeatedly.
- It must preserve existing achievement unlock history.

This allows achievements to remain correct after loading saved statistics.

---

## 19. Progression Integration

Progression System may consume statistics for milestones.

Examples:

- Total movement distance.
- Total gameplay sessions.
- Total completed Training exercises.
- Total successful movement actions.

Statistics System provides the underlying values.

Progression System owns:

- Milestone definitions.
- Unlock conditions.
- Milestone completion.
- Content unlock decisions.

Statistics must not directly unlock game content.

### 19.1 Milestone Reconciliation

When Progression System initializes, it may evaluate a statistics snapshot to reconcile threshold-based milestones.

This must be idempotent.

A statistics reset must trigger an explicit reconciliation policy rather than silently deleting progression milestones.

Already completed milestones should normally remain completed unless the owning Progression policy explicitly supports revocation.

---

## 20. Menu and HUD Integration

Statistics System exposes read-only snapshots.

A dedicated statistics screen is not part of the initial release menu; the
Local Records screen presents the lifetime statistics summary. If a full
statistics screen is introduced later, it belongs to the Menu System
(`24_MENU_SYSTEM_SPEC.md`).

Suggested sections:

- Overview.
- Movement.
- Training.
- Speedrun.
- Exploration.
- Interactions.

The HUD System may display selected session statistics where useful (`23_HUD_SYSTEM_SPEC.md`).

Statistics System does not own visual presentation.

### 20.1 Presentation Requirements

The presentation layer should support:

- Integer formatting.
- Decimal formatting.
- Duration formatting.
- Distance formatting.
- Unit localization.
- Empty states.
- Loading states.
- Unavailable statistics.

Do not hardcode localized labels or unit names in the Statistics System.

---

## 21. Localization Integration

Statistic identifiers must be independent of localized names.

Presentation metadata should resolve through Localization System.

Example:

```typescript
interface StatisticPresentationDefinition {
    statisticId: string;

    titleKey: string;

    descriptionKey?: string;

    unitKey?: string;
}
```

Requirements:

- No hardcoded player-facing strings.
- Localized category names.
- Localized unit names.
- Locale-aware numeric formatting.
- Locale-aware duration formatting.
- Safe fallback for missing translations.

Stored values must remain numeric.

Never persist formatted values such as `"12.5 km"` or `"03:42"` as authoritative statistics.

---

## 22. Accessibility Integration

Statistics presentation must respect Accessibility System configuration.

Requirements:

- High Contrast.
- UI scaling.
- Readable typography.
- Keyboard navigation.
- Gamepad navigation.
- Visible focus.
- Screen-reader-friendly labels where supported.
- Color-independent visual meaning.
- Reduced Motion.

Statistics System provides semantic values.

UI owns accessible presentation.

---

## 23. Failure Handling

The system must handle:

- Invalid event payloads.
- Unknown statistic identifiers.
- Duplicate event delivery.
- Stale session events.
- Missing session context.
- Invalid numeric values.
- Persistence failure.
- Interrupted application execution.
- Schema migration failure.
- Concurrent reset and save.
- Missing optional statistic definitions.
- Unknown source event types.
- Inconsistent historical records.

Failure handling principles:

1. Invalid events must not modify statistics.
2. Statistics failures must not break gameplay.
3. A persistence failure must not invalidate current in-memory values.
4. Stale events must not recreate finalized sessions.
5. Reset operations must invalidate stale writes.
6. Missing optional statistics must use safe defaults.
7. Source gameplay systems remain authoritative.
8. Partial historical data must be handled without crashing.

---

## 24. Performance Requirements

Statistics processing must have negligible impact on gameplay.

Requirements:

- Event-driven ingestion.
- No per-frame polling.
- No per-frame persistence.
- No full-history scans for common queries.
- Indexed statistic definitions.
- Bounded recent-session history; summaries referenced by other domain records are retained (section 15.1).
- Bounded event deduplication state.
- Cached snapshots where useful.
- Asynchronous persistence.
- Efficient aggregate updates.

Suggested development targets:

| Operation | Target |
|---|---|
| Event validation | Under 1 ms |
| Event routing | Under 1 ms |
| Aggregate update | Under 1 ms |
| Snapshot retrieval | Under 2 ms |
| Session finalization | Under 5 ms excluding persistence |
| Persistence scheduling | Non-blocking |

These are development targets, not guaranteed browser timing limits.

---

## 25. Debugging and Diagnostics

Development builds should provide statistics diagnostics.

Recommended information:

- Registered statistic definitions.
- Current lifetime snapshot.
- Current session snapshot.
- Mode aggregates.
- Latest processed event.
- Event rejection reason.
- Deduplication result.
- Current revision.
- Pending persistence state.
- Last successful persistence timestamp.
- Reset generation.
- Migration status.

Suggested debug commands:

```text
statistics.list
statistics.show <id>
statistics.lifetime
statistics.session
statistics.mode <mode>
statistics.events
statistics.reset
statistics.validate
statistics.export
```

Debug commands must use normal validation and repository paths.

Manual statistic modification must be development-only.

Debug-generated values must be clearly marked and must not contaminate production records.

---

## 26. Initial Implementation Plan

### Phase 1 — Foundation

Implement:

- StatisticDefinition.
- StatisticCategory.
- StatisticValue.
- StatisticsScope.
- StatisticsSnapshot.
- StatisticsManager.
- StatisticsValidator.
- StatisticsRegistry.

Acceptance:

- Statistic definitions can be registered.
- IDs are unique.
- Units are explicit.
- Invalid definitions are rejected.
- Read-only snapshots can be created.

### Phase 2 — Event Ingestion

Implement:

- StatisticsEventRouter.
- StatisticsEventValidator.
- StatisticsDeduplicationManager.
- Event adapters.
- Session correlation.
- Event-to-statistic mapping.

Acceptance:

- Valid events are processed.
- Invalid events are rejected.
- Duplicate events do not produce duplicate updates.
- Stale session events are ignored.

### Phase 3 — Aggregation

Implement:

- StatisticsProcessor.
- SessionStatisticsAggregator.
- LifetimeStatisticsAggregator.
- ModeStatisticsAggregator.
- Sum, count, minimum, maximum, and latest aggregation.

Acceptance:

- Session aggregates update correctly.
- Lifetime aggregates update correctly.
- Mode aggregates update correctly.
- Abandoned and failed sessions are classified correctly.
- Snapshots remain internally consistent.

### Phase 4 — Persistence

Implement:

- StatisticsRepository.
- Save System adapter.
- Aggregate persistence.
- Session summary persistence.
- Schema versioning.
- Migrations.
- Reset generation protection.

Acceptance:

- Statistics survive reload.
- Recent sessions can be restored.
- Interrupted sessions are handled safely.
- Reset does not allow stale writes to restore old data.
- Persistence failures do not break gameplay.

### Phase 5 — Gameplay Integration

Connect:

- Movement.
- Training.
- Speedrun.
- Interaction.
- Checkpoint.
- Level Runtime.
- Gameplay Session.

Implement the initial statistic catalog.

Acceptance:

- Successful movement actions are counted.
- Distance comes from authoritative movement data.
- Training statistics reflect Training results.
- Speedrun statistics reflect authoritative run results.
- Interaction and checkpoint statistics use source events.
- No duplicate gameplay rules are introduced.

### Phase 6 — Consumer Integration

Connect:

- Achievement System.
- Progression System.
- Menu System.
- HUD System.
- Localization System.
- Accessibility System.

Acceptance:

- Achievement conditions can query aggregate statistics.
- Progression can evaluate statistics-based milestones.
- Menu can display detailed statistics.
- HUD can display selected session values.
- Localization and accessibility requirements are satisfied.

### Phase 7 — Validation and Polish

Implement:

- Automated tests.
- Debug commands.
- Diagnostic logging.
- Persistence stress tests.
- Event replay tests.
- Migration tests.
- Regression tests.

Acceptance:

- Event processing is deterministic.
- Aggregate values remain consistent.
- No stale events corrupt historical data.
- No gameplay system depends on Statistics availability for core functionality.

---

## 27. Testing Requirements

### 27.1 Unit Tests

Test:

- Statistic definition validation.
- Registry uniqueness.
- Numeric validation.
- Unit consistency.
- Sum aggregation.
- Count aggregation.
- Maximum aggregation.
- Minimum aggregation.
- Latest aggregation.
- Event deduplication.
- Session correlation.
- Snapshot consistency.
- Scope filtering.
- Reset behavior.
- Revision handling.

### 27.2 Integration Tests

Test:

- Movement event ingestion.
- Distance aggregation.
- Sprint duration aggregation.
- Training attempts.
- Training completion.
- Training mastery.
- Speedrun attempt aggregation.
- Speedrun completion.
- Medal counting.
- Finalized session statistics summary consumed for a Speedrun run result.
- Interaction counting.
- Checkpoint counting.
- Session finalization.
- Session summary retrieval by `summaryId` after reload.
- Save System persistence.
- Achievement threshold integration.
- Progression milestone integration.

### 27.3 Lifecycle Tests

Test:

1. Session starts and initializes statistics.
2. Session receives movement events.
3. Session is paused and resumed.
4. Session completes successfully.
5. Session is abandoned.
6. Session fails.
7. Session unloads with pending events.
8. Duplicate event arrives after reload.
9. Stale event arrives after finalization.
10. Persistence fails during session finalization.
11. Statistics reset occurs during pending writes.
12. Application restarts after an interrupted session.

### 27.4 Regression Tests

Verify:

- Movement physics remain independent of Statistics.
- Speedrun timer remains authoritative.
- Training scores remain authoritative.
- Checkpoint progress remains authoritative.
- Achievement state is not duplicated.
- Progression rules are not duplicated.
- Statistics failures do not break gameplay.
- Statistics processing does not introduce frame-dependent behavior.

---

## 28. Definition of Done

The Statistics System is considered complete when:

- [ ] Statistic definitions are data-driven.
- [ ] Statistic IDs are stable.
- [ ] Units are explicit.
- [ ] Event ingestion is implemented.
- [ ] Event validation is implemented.
- [ ] Event deduplication is implemented.
- [ ] Session statistics are supported.
- [ ] Lifetime statistics are supported.
- [ ] Mode-specific statistics are supported.
- [ ] General statistics are implemented.
- [ ] Movement statistics are implemented.
- [ ] Training statistics are implemented.
- [ ] Speedrun summary statistics are implemented.
- [ ] Interaction statistics are implemented.
- [ ] Exploration statistics are implemented.
- [ ] Session finalization is implemented.
- [ ] Failed and abandoned sessions are distinguished.
- [ ] Snapshots are immutable and consistent.
- [ ] Finalized session summaries feed Speedrun run results.
- [ ] Speedrun records reference `statisticsSummaryId` without duplicating summary values.
- [ ] Speedrun results do not run a second statistics collector.
- [ ] Persistence uses Save System.
- [ ] Reset is scope-aware.
- [ ] Stale writes cannot restore reset data.
- [ ] Achievement integration works.
- [ ] Progression integration works.
- [ ] Menu and HUD integrations work.
- [ ] Localization is integrated.
- [ ] Accessibility is respected.
- [ ] Diagnostics are available.
- [ ] Automated tests cover all core aggregation paths.

---

## 29. Final Design Constraints

The implementation agent must follow these constraints:

1. Do not merge Statistics System with Achievement System.
2. Do not merge Statistics System with Progression System.
3. Do not calculate authoritative Speedrun times.
4. Do not validate Speedrun results.
5. Do not calculate Training scores or mastery.
6. Do not independently validate movement actions.
7. Do not sample player position every frame for distance tracking.
8. Do not introduce per-frame statistics polling.
9. Do not persist formatted display strings as numeric statistics.
10. Do not access IndexedDB directly.
11. Do not render statistics UI directly.
12. Do not allow duplicate event delivery to produce duplicate aggregate updates.
13. Do not allow stale session events to modify finalized records.
14. Do not let persistence failures break gameplay.
15. Do not delete records belonging to other systems during statistics reset.
16. Keep event sources authoritative.
17. Keep aggregation definitions data-driven and independently testable.
18. Use monotonic clocks for elapsed durations.
19. Use Save System for persistence infrastructure.
20. Use Localization System for player-facing labels and units.
21. Use Accessibility System for effective accessibility configuration.
22. Expose immutable snapshots to consumers.
23. Keep aggregate processing independent of rendering and frame rate.
24. Preserve compatibility with future analytics and platform integrations without implementing them prematurely.
25. Do not duplicate facts owned by the Speedrun System (run time, splits, checkpoint sequence, validity, medals, official personal bests) in statistics records.
26. Do not persist a duplicate copy of a finalized session statistics summary in another domain's record; reference its `summaryId` instead.

**Statistics System is responsible for collecting and aggregating what happened during gameplay. It must never decide whether those events constitute valid gameplay achievements, progression milestones, Training results, or Speedrun records.**