# 29_ACHIEVEMENT_SYSTEM_SPEC.md

# Achievement System Specification

**Project:** Glassline  
**Document:** 29 — Achievement System  
**Status:** Implementation Specification  
**Version:** 1.0

---

## 1. Purpose

The Achievement System manages player achievements across all gameplay modes.

It provides a unified mechanism for defining achievements, evaluating completion conditions, awarding achievements, tracking progress, and publishing achievement events.

Achievements recognize meaningful player accomplishments without taking ownership of the gameplay systems that produce those accomplishments.

The system must support:

- Data-driven achievement definitions.
- Event-driven condition evaluation.
- Immediate and incremental achievements.
- Multi-condition achievements.
- Hidden and secret achievements.
- Achievement categories and rarity metadata.
- Progress tracking.
- Achievement unlocking.
- Persistent achievement history.
- Duplicate event protection.
- Localization.
- UI and HUD notifications.
- Progression integration.
- Debugging and diagnostics.

### 1.1 Core Design Principle

Gameplay systems are authoritative for their own results.

Achievement System observes validated results and determines whether they satisfy achievement requirements.

For example:

- Movement System reports movement-related events.
- Training System reports completed exercises and mastery.
- Speedrun System reports validated run results.
- Progression System reports milestones and unlocks.
- Achievement System evaluates these events against achievement definitions.

Achievement System must never independently reconstruct or validate the underlying gameplay result.

---

## 2. Scope

### 2.1 In Scope

The initial implementation includes:

1. Achievement definitions and registry.
2. Achievement categories.
3. Achievement condition models.
4. Event subscriptions and routing.
5. Condition evaluation.
6. Incremental progress tracking.
7. Achievement unlocking.
8. Hidden achievement support.
9. Achievement history.
10. Persistent storage integration.
11. Achievement notifications.
12. Localization.
13. Progression integration.
14. Debugging and diagnostics.

### 2.2 Out of Scope

Achievement System does not own:

- Gameplay mechanics.
- Training exercise evaluation.
- Speedrun timing or validation.
- Checkpoint order validation.
- Training progression.
- Cross-mode progression rules.
- Content unlock rules.
- Player statistics aggregation outside achievement requirements.
- HUD rendering.
- Menu navigation.
- Save database implementation.
- Localization resources.
- Multiplayer leaderboards.
- Online achievement synchronization.
- Platform-specific achievement APIs.

### 2.3 Deferred Features

The following features are not required initially:

- Online achievement synchronization.
- Platform achievements integration.
- Global leaderboards.
- Competitive ranking.
- Multiplayer achievements.
- Seasonal achievements.
- Time-limited events.
- Achievement reward inventory.
- Dynamic achievement generation.
- Complex achievement sharing.
- Cloud synchronization.

The architecture should allow platform integrations to be introduced through adapters without changing achievement evaluation rules.

---

## 3. Architectural Ownership

Achievement System is responsible for the achievement domain.

It owns achievement definitions, criteria, progress, completion, and unlock history.

### 3.1 Responsibility Matrix

| Responsibility | Owner |
|---|---|
| Achievement definitions | Achievement System |
| Achievement categories | Achievement System |
| Achievement criteria | Achievement System |
| Achievement condition evaluation | Achievement System |
| Achievement progress | Achievement System |
| Achievement unlocking | Achievement System |
| Achievement history | Achievement System |
| Gameplay event authority | Source gameplay systems |
| Training exercise results | Training System |
| Speedrun validation and results | Speedrun System |
| Training exercise progression | Training System |
| Cross-mode progression | Progression System |
| Milestone definitions | Progression System |
| Content unlock rules | Progression System |
| Achievement persistence semantics | Achievement System |
| Persistence infrastructure | Save System |
| Achievement UI rendering | Menu / HUD Systems |
| Achievement notifications | HUD System |
| Localization | Localization System |
| Accessibility policy | Accessibility System |

### 3.2 Relationship with Progression System

Achievement System and Progression System are separate domains.

Achievement System answers:

- What achievements exist?
- What conditions must be satisfied?
- How much progress has been made?
- Has an achievement been unlocked?
- When was it unlocked?

Progression System answers:

- What long-term milestones has the player reached?
- Which content is unlocked?
- What progression rules apply across gameplay modes?
- Which achievements or domain events contribute to broader progression?

Progression System may consume achievement events.

Achievement System may consume Progression milestone events.

Neither system should duplicate the other's authoritative state.

### 3.3 Consistency with the Progression Specification

`22_PROGRESSION_SYSTEM_SPEC.md` defines cross-mode progression, milestones, and content unlock rules. It does not define or maintain achievement state.

The ownership split is:

- Achievement System owns achievement definitions, criteria, progress, unlock state, history, and achievement persistence semantics.
- Progression System owns cross-mode progression, milestones, unlock rules, and progression statistics.
- Progression System may consume achievement events as inputs to milestones and unlock rules.
- Progression System must not maintain a second authoritative achievement registry, progress model, or unlock record.

This section previously recorded a required amendment to the Progression specification. The amendment has been applied to `22_PROGRESSION_SYSTEM_SPEC.md`; the two specifications are now consistent.

This is an ownership boundary, not a requirement to duplicate or migrate the same runtime implementation into two systems.

---

## 4. High-Level Architecture

```text
Authoritative Gameplay Systems
          |
          v
Achievement Event Adapters
          |
          v
Achievement Event Router
          |
          v
Achievement Condition Evaluator
          |
          v
Achievement Progress Manager
          |
          v
Achievement Unlock Manager
          |
          +----------------------+
          |                      |
          v                      v
Achievement History       Achievement Events
          |                      |
          v                      +------> Progression System
     Save System                 |
                                 +------> HUD Notifications
                                 |
                                 +------> Menu / UI
```

Supporting integrations:

```text
Training System
Speedrun System
Movement System
Interaction System
Checkpoint System
Gameplay Session System
Progression System
Tutorial System
Localization System
Accessibility System
```

The system must be event-driven.

It must not poll gameplay systems every frame or repeatedly query their internal state to detect achievement conditions.

---

## 5. Core Components

### 5.1 AchievementManager

Central public entry point.

Responsibilities:

- Initialize the Achievement System.
- Register achievement definitions.
- Receive authoritative domain events.
- Coordinate condition evaluation.
- Coordinate progress updates.
- Coordinate unlocking.
- Expose achievement snapshots.
- Manage persistence.
- Publish achievement lifecycle events.

Suggested interface:

```typescript
interface IAchievementManager {
    initialize(): Promise<void>;

    processEvent(event: AchievementTriggerEvent): void;

    getAchievement(id: string): AchievementSnapshot | undefined;

    getAllAchievements(): AchievementSnapshot[];

    getUnlockedAchievements(): AchievementSnapshot[];

    getProgress(category?: AchievementCategory): AchievementSnapshot[];

    subscribe(
        listener: (event: AchievementSystemEvent) => void
    ): Unsubscribe;

    resetHistory(): Promise<void>;
}
```

The manager must coordinate specialized components rather than implementing every subsystem internally.

### 5.2 AchievementRegistry

Owns registered achievement definitions.

Responsibilities:

- Register definitions.
- Validate unique IDs.
- Resolve definitions by ID.
- Filter definitions by category.
- Filter hidden and visible achievements.
- Validate condition references.
- Detect invalid dependency graphs.

Definitions must be immutable after registration.

### 5.3 AchievementEventRouter

Receives events from authoritative gameplay systems.

Responsibilities:

- Subscribe to supported domain events.
- Normalize event envelopes.
- Preserve source identity.
- Attach session correlation where available.
- Reject stale or invalid events.
- Deduplicate event delivery.
- Route relevant events to the evaluator.

The router must not alter source events.

### 5.4 AchievementConditionEvaluator

Evaluates achievement requirements.

Responsibilities:

- Evaluate event-based conditions.
- Evaluate compound conditions.
- Evaluate numeric thresholds.
- Evaluate prerequisite achievements.
- Evaluate mode restrictions.
- Evaluate event-specific constraints.
- Return deterministic evaluation results.

The evaluator must not persist progress or publish unlock notifications directly.

### 5.5 AchievementProgressManager

Maintains incremental achievement progress.

Responsibilities:

- Track counters.
- Track completed condition groups.
- Apply valid progress updates.
- Prevent duplicate increments.
- Calculate normalized progress.
- Determine whether an achievement is ready to unlock.

It must not own unrelated player statistics.

### 5.6 AchievementUnlockManager

Commits achievement unlocks.

Responsibilities:

- Validate unlock eligibility.
- Ensure an achievement is unlocked only once.
- Commit unlock timestamps.
- Publish unlock events.
- Trigger history persistence.
- Produce notification requests.

Unlocking must be idempotent.

### 5.7 AchievementHistoryRepository

Provides persistence abstraction.

Responsibilities:

- Load achievement records.
- Save progress changes.
- Save unlock records.
- Migrate historical data.
- Reset achievement history.
- Report persistence failures.

The repository delegates actual storage operations to Save System infrastructure.

### 5.8 AchievementNotificationProvider

Produces notification requests after successful unlocks.

Responsibilities:

- Convert unlock events into notification data.
- Resolve notification priority.
- Deduplicate repeated notification requests.
- Respect session and presentation context.
- Send requests to HUD.

It must not render notifications.

### 5.9 AchievementValidator

Validates definitions and runtime operations.

Responsibilities:

- Validate achievement IDs.
- Validate criteria.
- Validate thresholds.
- Validate prerequisites.
- Detect circular dependencies.
- Validate localization keys.
- Validate category assignments.
- Validate source event references.

Invalid definitions must be rejected during initialization or development validation.

---

## 6. Data Models

All achievement identifiers must be stable strings.

IDs must not depend on localized names, display order, or implementation-specific class names.

### 6.1 AchievementDefinition

```typescript
interface AchievementDefinition {
    id: string;

    category: AchievementCategory;

    titleKey: string;

    descriptionKey: string;

    unlockedDescriptionKey?: string;

    iconId: string;

    rarity: AchievementRarity;

    hidden: boolean;

    enabled: boolean;

    conditions: AchievementConditionGroup[];

    prerequisites?: string[];

    supportedModes?: GameplayMode[];

    repeatable: false;
}
```

Definitions are immutable after registration.

The initial implementation must use non-repeatable achievements.

### 6.2 AchievementCategory

```typescript
type AchievementCategory =
    | "general"
    | "movement"
    | "training"
    | "speedrun"
    | "exploration"
    | "interaction"
    | "progression";
```

Categories organize achievements for presentation and filtering.

They must not implicitly change evaluation behavior.

### 6.3 AchievementRarity

```typescript
type AchievementRarity =
    | "common"
    | "uncommon"
    | "rare"
    | "exceptional";
```

Rarity is presentation metadata.

It must not be treated as an estimate of actual player population or global completion percentage.

### 6.4 AchievementConditionGroup

```typescript
interface AchievementConditionGroup {
    id: string;

    operator: "all" | "any";

    conditions: AchievementCondition[];
}
```

An achievement may contain multiple condition groups.

All groups must be satisfied for the achievement to unlock.

Within each group:

- `all` requires every condition.
- `any` requires at least one condition.

### 6.5 AchievementCondition

```typescript
interface AchievementCondition {
    id: string;

    type:
        | "event"
        | "counter"
        | "threshold"
        | "milestone"
        | "achievement";

    source?: string;

    eventType?: string;

    targetValue?: number;

    comparison?: "equal" | "greater-or-equal";

    referenceId?: string;

    parameters?: Record<string, unknown>;
}
```

Conditions must be declarative.

Do not execute arbitrary scripts from achievement definitions.

Complex conditions should be implemented through registered condition evaluators.

### 6.6 AchievementProgress

```typescript
interface AchievementProgress {
    achievementId: string;

    conditionProgress: Record<string, number>;

    completedConditionIds: string[];

    currentValue: number;

    targetValue?: number;

    normalizedProgress: number;

    updatedAt: number;
}
```

`normalizedProgress` is a presentation value between 0 and 1.

It must not replace individual condition results.

### 6.7 AchievementRecord

```typescript
interface AchievementRecord {
    achievementId: string;

    unlocked: boolean;

    unlockedAt?: number;

    progress: AchievementProgress;

    firstProgressAt?: number;

    lastProgressAt?: number;
}
```

The record is authoritative for the Achievement System.

### 6.8 AchievementSnapshot

```typescript
interface AchievementSnapshot {
    id: string;

    category: AchievementCategory;

    title: string;

    description: string;

    iconId: string;

    rarity: AchievementRarity;

    hidden: boolean;

    unlocked: boolean;

    unlockedAt?: number;

    progress: number;

    targetValue?: number;
}
```

Snapshots are read-only presentation data.

They may contain resolved localization strings when requested by the UI adapter.

---

## 7. Condition Evaluation

Achievement conditions must be deterministic and testable.

### 7.1 Event Conditions

An event condition is satisfied when a matching authoritative event is received.

Example:

```typescript
{
    id: "first_run",
    type: "event",
    source: "speedrun",
    eventType: "run.completed"
}
```

The event must be validated by Speedrun System before it can satisfy the condition.

### 7.2 Counter Conditions

Counter conditions accumulate valid events.

Example:

```typescript
{
    id: "vault_count",
    type: "counter",
    source: "movement",
    eventType: "vault.completed",
    targetValue: 25
}
```

Counter updates must use unique event identity to prevent duplicate increments.

### 7.3 Threshold Conditions

Threshold conditions evaluate a numeric value supplied by an authoritative source.

Examples:

- Maximum speed reached.
- Number of successful jumps.
- Number of completed Training exercises.
- Best Speedrun time below a target.

The Achievement System must not calculate authoritative values itself.

For example, it may compare a validated Speedrun result against a target, but it must not independently calculate the official run duration.

### 7.4 Milestone Conditions

Milestone conditions consume events from Progression System.

Examples:

- Campaign milestone reached.
- Required content unlocked.
- Cross-mode progression threshold reached.

Achievement System must not recreate Progression milestone rules.

### 7.5 Achievement Prerequisites

An achievement may require another achievement to be unlocked.

Prerequisite dependencies must be validated during registration.

Circular dependencies are invalid.

### 7.6 Compound Conditions

An achievement may combine conditions.

Example:

```typescript
{
    id: "parkour_master",
    operator: "all",
    conditions: [
        {
            id: "vaults",
            type: "counter",
            source: "movement",
            eventType: "vault.completed",
            targetValue: 25
        },
        {
            id: "wall_runs",
            type: "counter",
            source: "movement",
            eventType: "wallrun.completed",
            targetValue: 25
        },
        {
            id: "training",
            type: "event",
            source: "training",
            eventType: "exercise.mastered"
        }
    ]
}
```

The example illustrates condition composition, not a mandatory achievement requirement.

---

## 8. Event Integration

Achievement System consumes semantic events from owning systems.

### 8.1 Supported Sources

| Source | Example events |
|---|---|
| Movement | Jump completed, vault completed, wall run completed |
| Training | Exercise completed, exercise mastered |
| Speedrun | Run completed, medal awarded, personal best achieved |
| Checkpoint | Checkpoint activated |
| Interaction | Interaction completed |
| Level Runtime | Section completed, level completed |
| Gameplay Session | Session completed |
| Progression | Milestone reached, content unlocked |
| Tutorial | Tutorial acknowledged |

Event names must follow the actual public contracts of their owning systems.

Do not introduce duplicate event names solely for Achievement System.

### 8.2 Event Envelope

```typescript
interface AchievementTriggerEvent {
    eventId: string;

    type: string;

    source: string;

    timestamp: number;

    sessionId?: string;

    attemptId?: string;

    levelId?: string;

    sectionId?: string;

    payload?: Record<string, unknown>;
}
```

Events must preserve source identity and relevant context.

The event router must reject events that are invalid, stale, or outside their authoritative lifecycle.

### 8.3 Event Validation

Before evaluating a condition:

1. Validate event identity.
2. Validate source.
3. Validate session and attempt context where applicable.
4. Validate event type.
5. Validate required payload fields.
6. Check deduplication state.
7. Resolve matching conditions.

An invalid event must not modify achievement progress.

### 8.4 Event Deduplication

The system must maintain processed event identity.

For events with stable IDs, use `eventId`.

For events without stable IDs, the owning integration must provide a documented deduplication strategy.

Do not deduplicate solely by event type and timestamp because legitimate repeated actions may occur close together.

### 8.5 Session Correlation

Events from previous sessions or attempts must not accidentally update current session-scoped progress.

Long-term achievements may accumulate across sessions, but the source event must still be valid.

Session correlation is a validation mechanism, not a requirement that all achievements be session-local.

---

## 9. Achievement Lifecycle

An achievement follows this lifecycle:

```text
Locked
  |
  v
In Progress
  |
  v
Conditions Satisfied
  |
  v
Unlock Validation
  |
  v
Unlocked
```

### 9.1 Locked

The achievement is registered but has no qualifying progress.

### 9.2 In Progress

At least one incremental condition has received valid progress.

An achievement may remain locked while showing partial progress.

### 9.3 Conditions Satisfied

All required conditions are satisfied.

The system prepares an unlock request.

### 9.4 Unlock Validation

Before committing the unlock:

- Verify the achievement is enabled.
- Verify it has not already been unlocked.
- Verify all prerequisites.
- Verify all condition groups.
- Verify relevant event identity.
- Verify that no reset or migration invalidated the record.

### 9.5 Unlocked

Once committed:

- Set `unlocked = true`.
- Store the unlock timestamp.
- Persist the achievement record.
- Publish the unlock event.
- Request a notification.
- Expose the updated snapshot.

Unlocking must be idempotent.

Repeated delivery of the same event must never generate repeated unlocks.

### 9.6 Disabled Achievements

Disabled definitions must not be newly unlocked.

Existing unlocked history must be preserved.

A disabled definition may remain available for historical display if its metadata is retained.

---

## 10. Initial Achievement Set

The initial implementation should include a focused set of achievements that demonstrate all major condition types.

Suggested definitions:

| ID | Display Name | Condition |
|---|---|---|
| `first_steps` | First Steps | Complete the first Training exercise |
| `learning_the_basics` | Learning the Basics | Complete the introductory Training exercises |
| `parkour_foundations` | Parkour Foundations | Master the required core movement exercises |
| `perfect_execution` | Perfect Execution | Complete a designated Training exercise with its highest result |
| `first_run` | First Run | Complete a valid Speedrun |
| `no_hesitation` | No Hesitation | Complete a designated route without invalid recovery |
| `speed_is_everything` | Speed Is Everything | Achieve a defined Speedrun medal |
| `gold_standard` | Gold Standard | Earn Gold on the required Prologue route |
| `checkpoint_pro` | Checkpoint Pro | Activate all five Prologue checkpoints |
| `master_of_movement` | Master of Movement | Demonstrate all required core movement mechanics |
| `interaction_complete` | Making Contact | Complete the first required interaction |
| `tutorial_graduate` | Tutorial Graduate | Acknowledge all mandatory introductory tutorials |

These definitions are examples of the initial content set.

Exact targets and event contracts must be validated against the implemented gameplay systems.

### 10.1 Training Achievements

Training achievements consume authoritative Training events.

Examples:

- Exercise completed.
- Exercise mastered.
- Required group of exercises completed.

Achievement System must not calculate Training scores or determine whether an exercise was mastered.

### 10.2 Speedrun Achievements

Speedrun achievements consume validated Speedrun results.

Examples:

- First valid completion.
- Medal earned.
- Personal best improved.
- Required route completed.

Achievement System must not run its own timer or independently validate checkpoints.

### 10.3 Movement Achievements

Movement achievements may use semantic events for successful mechanics.

Examples:

- Vault completed.
- Wall run completed.
- Wall jump completed.
- Maximum speed threshold reached.

Movement System remains authoritative for movement execution and success criteria.

### 10.4 Hidden Achievements

Some achievements may be hidden until unlocked.

Hidden achievements must:

- Remain registered.
- Participate in evaluation normally.
- Avoid revealing title and description in ordinary locked-achievement views.
- Provide a generic localized hidden state.
- Become visible after unlocking.

Hidden status is presentation metadata, not an evaluation restriction.

---

## 11. Persistence

Achievement history is persistent player data.

Achievement System accesses persistence through Save System.

Suggested repository:

```typescript
interface IAchievementRepository {
    load(): Promise<AchievementRecord[]>;

    save(records: AchievementRecord[]): Promise<void>;

    reset(): Promise<void>;
}
```

### 11.1 Persisted Data

Persist:

- Achievement unlock state.
- Unlock timestamps.
- Incremental progress.
- Condition completion.
- Relevant event deduplication information.
- Schema version.

Do not persist transient data such as:

- Pending notification animations.
- Active UI panels.
- Current presentation focus.
- Temporary event evaluation objects.

### 11.2 Persistence Strategy

Persistence must be asynchronous.

The gameplay loop must never wait for achievement storage.

Requirements:

- Save meaningful progress transitions.
- Batch frequent counter updates where appropriate.
- Preserve valid in-memory state after storage failures.
- Retry according to Save System policy.
- Avoid writing every frame.
- Avoid unbounded processed-event history.

The repository should use an efficient representation for event deduplication.

### 11.3 Data Versioning

Achievement records require their own schema version.

It must remain independent of:

- IndexedDB database version.
- Save System schema version.
- Achievement definition version.
- Localization resource version.

Migration must preserve unlocked achievements and valid progress.

Unknown achievement IDs must not crash loading.

### 11.4 Reset

Achievement history reset must be explicit.

It must not automatically reset:

- Training progress.
- Speedrun records.
- Player settings.
- Tutorial history.
- Campaign progression.

If a full player-data reset is requested, the owning application flow must coordinate the separate domain resets.

### 11.5 Persistence Failure

If saving fails:

- Keep the current valid in-memory state.
- Report the failure.
- Do not display false confirmation of durable persistence.
- Retry through Save System mechanisms.
- Avoid awarding the same achievement repeatedly after recovery.

---

## 12. Progression Integration

Achievement System publishes semantic events for Progression System.

Suggested events:

```typescript
interface AchievementUnlockedEvent {
    achievementId: string;

    category: AchievementCategory;

    rarity: AchievementRarity;

    unlockedAt: number;

    sourceEventId?: string;
}
```

```typescript
interface AchievementProgressUpdatedEvent {
    achievementId: string;

    progress: number;

    unlocked: boolean;
}
```

Progression may use achievement events as inputs to:

- Milestone conditions.
- Content unlock rules.
- Cross-mode progression.
- Aggregate player statistics.

Achievement System must not decide what content becomes available.

Progression must not independently unlock the same achievement.

### 12.1 Avoiding Circular Dependencies

The preferred event relationship is:

```text
Gameplay Systems
       |
       v
Achievement System
       |
       v
Achievement Unlocked
       |
       v
Progression System
```

Progression may publish milestone events consumed by Achievement System.

However, an achievement must not require a Progression milestone that itself requires that same achievement.

Such circular dependency chains must be rejected during validation.

---

## 13. HUD and Menu Integration

Achievement System provides read-only snapshots and notification requests.

### 13.1 HUD Notifications

After an achievement is successfully unlocked, Achievement System sends a notification request to HUD.

The notification model should contain:

```typescript
interface AchievementNotificationModel {
    achievementId: string;

    title: string;

    description: string;

    iconId: string;

    rarity: AchievementRarity;

    unlockedAt: number;
}
```

HUD owns:

- Rendering.
- Animation.
- Position.
- Visibility.
- Notification queue.
- Accessibility presentation.

Achievement System owns the semantic unlock event and notification payload.

### 13.2 Notification Rules

- Only committed unlocks produce notifications.
- Duplicate unlock events must not create duplicate notifications.
- Notifications should respect HUD visibility and priority rules.
- Notifications must not obscure critical Speedrun information.
- Notifications should not interrupt difficult traversal.
- Notifications may be queued during unsuitable gameplay states.

### 13.3 Achievement Menu

Menu System may expose an achievement overview.

Suggested sections:

- All Achievements.
- Unlocked.
- In Progress.
- Hidden.
- Categories.

Menu reads snapshots from Achievement System.

It must not calculate progress independently.

### 13.4 Display Rules

The presentation layer should support:

- Locked state.
- Unlocked state.
- Partial progress.
- Hidden state.
- Unlock timestamp.
- Category filtering.
- Rarity metadata.

Achievement ordering should be stable and deterministic.

---

## 14. Localization Integration

All player-facing achievement text must use Localization System.

Achievement definitions store localization keys, not translated strings.

Example:

```typescript
{
    id: "first_run",
    titleKey: "achievement.first_run.title",
    descriptionKey: "achievement.first_run.description"
}
```

Requirements:

- No hardcoded player-facing strings.
- Stable localization keys.
- Safe fallback for missing translations.
- Support for text expansion.
- Localized unlock notifications.
- Localized category names.
- Localized hidden-achievement state.
- Accessible labels for achievement icons.

Localization changes must update visible achievement content without changing achievement state.

---

## 15. Accessibility Integration

Achievement presentation must respect effective Accessibility configuration.

Requirements:

- High Contrast support.
- UI scaling.
- Readable text.
- Keyboard navigation.
- Gamepad navigation.
- Visible focus.
- Screen-reader-friendly labels where supported.
- Reduced Motion.
- No audio-only achievement notifications.

Rarity must not be communicated through color alone.

Achievement icons must have meaningful accessible labels.

The Achievement System does not own accessibility preferences or rendering behavior.

---

## 16. Tutorial Integration

Tutorial System may publish acknowledgement and completion events.

Achievement System may use these events as conditions.

Example:

- Acknowledge all mandatory introductory tutorials.
- Complete a defined tutorial sequence.

Tutorial acknowledgement must not be interpreted as proof of gameplay mastery.

Achievement System must not inspect Tutorial System internal state directly.

It consumes published semantic events or read-only snapshots through a defined interface.

---

## 17. Failure Handling

The system must handle:

- Invalid achievement definitions.
- Unknown event types.
- Invalid event payloads.
- Duplicate events.
- Stale session events.
- Missing prerequisites.
- Circular dependencies.
- Persistence failures.
- Missing localization keys.
- Disabled achievements.
- Definition changes.
- Reset during pending updates.
- Duplicate unlock requests.
- HUD notification failure.

Failure handling principles:

1. Invalid events must not modify progress.
2. Achievement failures must not break gameplay.
3. Already unlocked achievements must not be silently lost.
4. Notification failures must not invalidate unlocks.
5. Persistence failures must preserve valid in-memory state.
6. Missing optional content must use safe fallbacks.
7. Stale asynchronous operations must not overwrite newer state.
8. Achievement System must never modify authoritative source gameplay results.

---

## 18. Performance Requirements

Achievement evaluation must have negligible impact on gameplay.

Requirements:

- Event-driven processing.
- No per-frame polling.
- Indexed event-to-condition lookup.
- Cached immutable definitions.
- Bounded event deduplication history.
- Asynchronous persistence.
- No synchronous UI work.
- No expensive global scans for each event.

Suggested development targets:

| Operation | Target |
|---|---|
| Event routing | Under 1 ms |
| Condition evaluation | Under 1 ms |
| Progress update | Under 1 ms |
| Unlock validation | Under 1 ms |
| Snapshot generation | Under 2 ms |

These are development targets, not guaranteed browser timing limits.

Large achievement catalogs should use indexed lookups rather than scanning every condition for every event.

---

## 19. Debugging and Diagnostics

Development builds should expose achievement diagnostics.

Recommended information:

- Registered achievement definitions.
- Enabled and disabled achievements.
- Current progress.
- Completed conditions.
- Unlocked achievements.
- Trigger event source.
- Event deduplication result.
- Failed condition evaluation.
- Prerequisite state.
- Persistence status.
- Pending notifications.

Suggested debug commands:

```text
achievement.list
achievement.show <id>
achievement.progress <id>
achievement.evaluate <id>
achievement.unlock <id>
achievement.lock <id>
achievement.reset
achievement.history
achievement.events
```

Debug commands must use the same validation and state-transition paths as normal gameplay.

Forced unlock operations must be development-only and must be clearly marked as debug-generated.

They must not contaminate production achievement records or Speedrun validation.

---

## 20. Initial Implementation Plan

### Phase 1 — Foundation

Implement:

- AchievementDefinition.
- AchievementCategory.
- AchievementCondition.
- AchievementRegistry.
- AchievementValidator.
- AchievementManager.
- AchievementSnapshot.

Acceptance:

- Definitions can be registered and resolved.
- Duplicate IDs are rejected.
- Invalid definitions are rejected.
- Achievement snapshots are available.
- No gameplay event integration is required yet.

### Phase 2 — Event Evaluation

Implement:

- AchievementEventRouter.
- Domain event adapters.
- AchievementConditionEvaluator.
- Event validation.
- Event deduplication.
- Session correlation.

Acceptance:

- Valid events produce deterministic evaluation.
- Invalid events do not modify progress.
- Duplicate events do not increment counters twice.
- Stale events are rejected.

### Phase 3 — Progress and Unlocking

Implement:

- AchievementProgressManager.
- AchievementUnlockManager.
- Compound conditions.
- Prerequisites.
- Incremental counters.
- Hidden achievements.

Acceptance:

- Progress updates correctly.
- Compound conditions are evaluated correctly.
- Prerequisite dependencies are validated.
- Achievements unlock only once.
- Unlock events are published after state commitment.

### Phase 4 — Persistence

Implement:

- AchievementHistoryRepository.
- Save System adapter.
- Schema versioning.
- Migrations.
- Reset behavior.
- Persistence failure handling.

Acceptance:

- Unlocks survive reload.
- Partial progress survives reload.
- Migrations preserve valid records.
- Storage failures do not break gameplay.
- Reset affects only achievement data.

### Phase 5 — UI and System Integration

Implement:

- HUD notification adapter.
- Menu achievement overview.
- Localization integration.
- Accessibility integration.
- Progression integration.
- Tutorial integration.

Connect initial achievement definitions to:

- Training.
- Movement.
- Interaction.
- Checkpoint.
- Level Runtime.
- Speedrun.
- Gameplay Session.
- Progression.
- Tutorial.

Acceptance:

- Notifications appear after valid unlocks.
- Menu displays authoritative snapshots.
- Hidden achievements remain hidden until unlocked.
- Localized text is displayed correctly.
- Accessibility preferences are respected.
- Progression consumes achievement events without duplicating achievement state.

### Phase 6 — Validation and Polish

Implement:

- Automated tests.
- Debug commands.
- Diagnostic logging.
- Event stress tests.
- Migration tests.
- Integration regression tests.

Acceptance:

- Achievement processing remains deterministic.
- No duplicate unlocks occur.
- No stale events modify current progress.
- Achievement failures do not affect core gameplay.
- All initial definitions pass validation.

---

## 21. Testing Requirements

### 21.1 Unit Tests

Test:

- Definition validation.
- Registry uniqueness.
- Category filtering.
- Condition evaluation.
- Compound conditions.
- Counter conditions.
- Threshold conditions.
- Prerequisites.
- Circular dependency detection.
- Progress calculation.
- Event deduplication.
- Unlock idempotency.
- Hidden achievement visibility.
- Achievement reset.
- Snapshot generation.

### 21.2 Integration Tests

Test:

- Training completion events.
- Training mastery events.
- Movement mechanic events.
- Checkpoint activation events.
- Interaction events.
- Speedrun completion events.
- Speedrun medal events.
- Personal best events.
- Progression milestone events.
- Tutorial acknowledgement events.
- Save System integration.
- HUD notifications.
- Menu snapshots.
- Localization updates.
- Accessibility configuration updates.

### 21.3 Lifecycle Tests

Test the following cases:

1. Achievement unlocked during active gameplay.
2. Achievement progress updated across multiple sessions.
3. Duplicate source event delivered.
4. Stale event delivered after session end.
5. Session ends during asynchronous processing.
6. Achievement history loaded after application restart.
7. Persistence fails during unlock.
8. Achievement definition is disabled after unlock.
9. Achievement prerequisite is not satisfied.
10. Two conditions are completed by the same event.
11. Achievement reset occurs during pending persistence.
12. HUD notification fails after successful unlock.

### 21.4 Regression Tests

Verify:

- Training results remain authoritative.
- Speedrun validation remains independent.
- Speedrun timing is unaffected.
- Progression unlock rules remain authoritative.
- Tutorial acknowledgement does not imply mastery.
- HUD notification failures do not affect achievement state.
- Achievement System can be disabled without breaking gameplay.
- Save System remains the only persistence infrastructure.

---

## 22. Definition of Done

The Achievement System is considered complete when:

- [ ] Achievement definitions are data-driven.
- [ ] Stable achievement identifiers are enforced.
- [ ] Categories and rarity metadata are supported.
- [ ] Condition groups support `all` and `any`.
- [ ] Event-based conditions work.
- [ ] Counter conditions work.
- [ ] Threshold conditions work.
- [ ] Prerequisites are supported.
- [ ] Circular dependencies are rejected.
- [ ] Event processing is deterministic.
- [ ] Duplicate events cannot produce duplicate progress.
- [ ] Stale events are rejected.
- [ ] Incremental progress is tracked.
- [ ] Achievement unlocking is idempotent.
- [ ] Hidden achievements are supported.
- [ ] Achievement history is persisted through Save System.
- [ ] Persistence failures do not break gameplay.
- [ ] Reset affects only achievement data.
- [ ] Training and Speedrun integrations work.
- [ ] Progression consumes achievement events.
- [ ] Achievement state is not duplicated in Progression.
- [ ] HUD notifications work.
- [ ] Menu snapshots work.
- [ ] Localization is integrated.
- [ ] Accessibility is respected.
- [ ] Debugging and diagnostics are available.
- [ ] Automated tests cover core behavior and integrations.

---

## 23. Final Design Constraints

The implementation agent must follow these constraints:

1. Do not merge Achievement System with Progression System.
2. Do not maintain duplicate achievement state in Progression.
3. Do not independently validate Training results.
4. Do not independently validate Speedrun results.
5. Do not calculate authoritative gameplay statistics.
6. Do not modify source gameplay events.
7. Do not introduce per-frame achievement polling.
8. Do not access IndexedDB directly.
9. Do not render achievement UI directly.
10. Do not hardcode player-facing strings.
11. Do not use achievement rarity as an unsupported global statistic.
12. Do not award achievements from invalid or stale events.
13. Do not allow duplicate event delivery to produce duplicate progress.
14. Do not let notification failures invalidate achievement unlocks.
15. Do not let achievement processing block gameplay.
16. Do not introduce online services in the initial implementation.
17. Keep definitions data-driven and independently testable.
18. Keep gameplay result ownership within source systems.
19. Use Save System for persistence infrastructure.
20. Use Localization System for all player-facing text.
21. Use Accessibility System for effective accessibility configuration.
22. Publish semantic events for Progression and presentation consumers.
23. Preserve compatibility with future platform achievement adapters without implementing them prematurely.

**Achievement System is responsible for recognizing and recording player accomplishments. It must consume authoritative gameplay results, never recreate the rules that produced them.**