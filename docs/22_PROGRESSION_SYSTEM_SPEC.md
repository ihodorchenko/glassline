# 22_PROGRESSION_SYSTEM_SPEC.md

# Progression System Specification

**Project:** Mirror's Edge-Inspired First-Person Parkour Game  
**Document:** Progression System  
**Version:** 1.0  
**Status:** Implementation Specification  
**Priority:** Core Gameplay System

---

## 1. Purpose

The Progression System manages the player's long-term progress across gameplay modes and experiences.

It provides a unified representation of completed content, unlocked content, achievements, milestones, and persistent progression records.

The system connects individual gameplay results into a coherent progression model.

It answers questions such as:

- Which Training exercises has the player completed?
- Which exercises have been mastered?
- Has the player completed the Prologue?
- Which content is currently unlocked?
- Which milestones have been reached?
- Which achievements have been earned?
- What progress should be presented in the Main Menu?
- Which progression requirements must be satisfied before entering specific content?

The initial implementation focuses on Training and Prologue progression.

The architecture must allow future gameplay modes and additional content without requiring a redesign of the progression core.

---

## 2. Design Philosophy

### 2.1 Progression Should Be Meaningful

Progression must represent actual gameplay accomplishments.

Unlocks and achievements must be based on authoritative gameplay events and validated results.

Opening a screen, entering a level, or starting a session must not automatically count as completion.

### 2.2 One Progression Authority

The Progression System is the authoritative owner of persistent cross-mode progression.

Individual gameplay systems remain authoritative for their own domain results.

For example:

- Training owns exercise completion and exercise evaluation.
- Speedrun owns run validation and run results.
- Progression owns the fact that a validated milestone has contributed to long-term player progress.

### 2.3 Event-Driven Updates

Progression changes should be triggered by domain events.

The system must not continuously poll every gameplay subsystem.

### 2.4 Deterministic Unlocks

The same progression state and content configuration must produce the same unlock results.

Unlock rules must be explicit and testable.

### 2.5 Persistence Independence

Progression owns progression data and rules.

Save System owns the underlying persistence infrastructure.

### 2.6 No Artificial Complexity

The initial implementation should not introduce:

- An economy.
- Experience points.
- Skill trees.
- Loot systems.
- Daily quests.
- Online profiles.
- Competitive seasons.

These features are outside the initial game's scope.

---

## 3. Scope and Ownership

### 3.1 Responsibilities

The Progression System owns:

- Persistent player progression.
- Completed content records.
- Content unlock state.
- Progression milestones.
- Achievement definitions.
- Achievement evaluation.
- Achievement completion records.
- Cross-mode progression rules.
- Progression summaries.
- Progression event processing.
- Progression queries for UI and Gameplay Flow.
- Progression data migration coordination.
- Idempotent progression updates.

### 3.2 Non-responsibilities

The Progression System does not own:

- Exercise execution.
- Exercise objectives.
- Exercise scoring.
- Speedrun timing.
- Speedrun validation.
- Checkpoint activation.
- Level runtime state.
- Gameplay session lifecycle.
- Player movement.
- UI navigation.
- Save storage implementation.
- Online leaderboards.
- Multiplayer ranking.

### 3.3 Related Specifications

- `02_TECHNICAL_ARCHITECTURE.md`
- `03_GAMEPLAY_SPEC.md`
- `07_UI_UX_SPEC.md`
- `09_SPEEDRUN_SYSTEM_SPEC.md`
- `10_SAVE_SYSTEM_SPEC.md`
- `15_LEVEL_RUNTIME_SYSTEM_SPEC.md`
- `16_CHECKPOINT_SYSTEM_SPEC.md`
- `19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`
- `20_GAMEPLAY_FLOW_SYSTEM_SPEC.md`
- `21_TRAINING_SYSTEM_SPEC.md`

---

## 4. Progression Architecture

### 4.1 Core Components

The initial implementation should contain:

- `ProgressionManager`
- `ProgressionRepository`
- `ProgressionEventProcessor`
- `ProgressionEventRegistry`
- `ProgressionRuleEngine`
- `ProgressionUnlockResolver`
- `ProgressionMilestoneEvaluator`
- `AchievementManager`
- `AchievementEvaluator`
- `ProgressionSnapshotProvider`
- `ProgressionValidator`
- `ProgressionEvents`

### 4.2 Component Responsibilities

**ProgressionManager**

Public entry point for progression queries and operations.

**ProgressionRepository**

Provides access to persisted progression data through Save System interfaces.

**ProgressionEventProcessor**

Processes authoritative events and applies progression updates.

**ProgressionEventRegistry**

Registers supported progression event types and their handlers.

**ProgressionRuleEngine**

Evaluates configured progression conditions.

**ProgressionUnlockResolver**

Determines which content is available based on current progression.

**ProgressionMilestoneEvaluator**

Evaluates major player accomplishments.

**AchievementManager**

Owns achievement state and completion records.

**AchievementEvaluator**

Evaluates achievement requirements against progression events and accumulated records.

**ProgressionSnapshotProvider**

Produces immutable snapshots for UI and other consumers.

**ProgressionValidator**

Validates progression definitions, persisted data, and update operations.

---

## 5. Progression Data Model

### 5.1 PlayerProgression

The root progression model:

```ts
interface PlayerProgression {
    schemaVersion: number;

    revision: number;

    createdAt: number;

    updatedAt: number;

    training: TrainingProgression;

    campaign: CampaignProgression;

    unlocks: ContentUnlockProgression;

    milestones: ProgressionMilestone[];

    achievements: AchievementProgression;

    statistics: ProgressionStatistics;
}
```

The model represents long-term player progress.

Temporary gameplay session state must not be stored here.

### 5.2 TrainingProgression

Training remains the owner of exercise-specific records.

Progression stores the cross-mode summary needed for unlocks and achievements.

```ts
interface TrainingProgression {
    completedExerciseIds: string[];

    masteredExerciseIds: string[];

    completedSectionIds: string[];

    completedMandatoryExerciseCount: number;

    completedAt?: number;
}
```

The Training System remains authoritative for individual exercise records, scores, and attempts.

The Progression System must not maintain a competing copy of best exercise times or scores.

### 5.3 CampaignProgression

```ts
interface CampaignProgression {
    completedLevelIds: string[];

    completedSectionIds: string[];

    currentCampaignMilestone?: string;

    prologueCompleted: boolean;

    prologueBestCompletionTime?: number;

    lastCompletedAt?: number;
}
```

The initial campaign contains the Prologue.

Section completion must be derived from authoritative level and gameplay events.

### 5.4 ContentUnlockProgression

```ts
interface ContentUnlockProgression {
    unlockedContentIds: string[];

    unlockedAt: Record<string, number>;
}
```

The system must not store duplicate unlock records.

A content item should have one canonical unlock state.

### 5.5 ProgressionMilestone

```ts
interface ProgressionMilestone {
    id: string;

    achievedAt: number;

    sourceEventId: string;

    sourceType: string;
}
```

Milestones represent significant accomplishments.

Examples:

- First Training exercise completed.
- All mandatory Training exercises completed.
- First Prologue completion.
- First Gold Training medal.
- First validated Speedrun completion.

Milestones are permanent records unless an explicit migration or administrative repair changes them.

### 5.6 ProgressionStatistics

```ts
interface ProgressionStatistics {
    totalCompletedExercises: number;

    totalMasteredExercises: number;

    totalCompletedLevels: number;

    totalAchievements: number;

    totalPlayTime: number;

    firstSessionAt?: number;

    lastPlayedAt?: number;
}
```

Statistics are derived or incrementally maintained from validated records.

They must not be updated by unvalidated UI actions.

---

## 6. Content Definition Model

### 6.1 ProgressionContentDefinition

All unlockable content must have a stable identifier.

```ts
interface ProgressionContentDefinition {
    id: string;

    type: ProgressionContentType;

    title: string;

    description?: string;

    unlockRule: ProgressionUnlockRule;

    initiallyUnlocked: boolean;
}
```

### 6.2 Content Types

```ts
type ProgressionContentType =
    | "training_section"
    | "training_exercise"
    | "level"
    | "game_mode"
    | "challenge"
    | "achievement_reward";
```

### 6.3 Initial Content

Initial content identifiers should include:

```text
training_movement
training_running
training_jumping
training_sliding
training_vaulting
training_wall_running
training_wall_jumping
training_landing
training_interaction
training_combined_traversal

prologue
```

Individual exercise IDs are defined by Training System content definitions.

Identifiers must remain stable across application updates.

Renaming a title must not require changing the content ID.

---

## 7. Unlock Rule Engine

### 7.1 Unlock Rule

```ts
interface ProgressionUnlockRule {
    id: string;

    operator: ProgressionRuleOperator;

    conditions: ProgressionCondition[];
}
```

### 7.2 Rule Operators

```ts
type ProgressionRuleOperator =
    | "all"
    | "any";
```

### 7.3 Progression Conditions

```ts
type ProgressionCondition =
    | {
        type: "exercise_completed";
        exerciseId: string;
    }
    | {
        type: "exercise_mastered";
        exerciseId: string;
    }
    | {
        type: "section_completed";
        sectionId: string;
    }
    | {
        type: "level_completed";
        levelId: string;
    }
    | {
        type: "achievement_unlocked";
        achievementId: string;
    }
    | {
        type: "milestone_reached";
        milestoneId: string;
    }
    | {
        type: "count_threshold";
        source: string;
        minimum: number;
    };
```

### 7.4 Rule Evaluation

The rule engine evaluates conditions against an immutable progression snapshot.

Rules must be deterministic.

The engine must not execute arbitrary code from content definitions.

### 7.5 Initial Unlock Rules

Initial rules should be simple.

Examples:

- First Training section is unlocked by default.
- Completing mandatory Movement Basics unlocks Running and Sprinting.
- Completing Jumping unlocks more advanced traversal exercises.
- Completing the required introductory Training content may unlock a Prologue recommendation.
- Prologue remains accessible without mandatory Training completion unless the Gameplay design explicitly changes this requirement.

Training progression and Prologue access must not be coupled so tightly that players cannot skip Training.

### 7.6 Unlock Evaluation

Unlocks should be recalculated when relevant progression events are processed.

The system may also perform a full reconciliation during startup.

Repeated evaluation must not create duplicate unlock events or change timestamps unnecessarily.

### 7.7 Unlock Reasons

The system should be able to explain why content is locked.

```ts
interface ContentUnlockStatus {
    contentId: string;

    unlocked: boolean;

    unlockedAt?: number;

    unmetConditions: ProgressionCondition[];
}
```

This information supports UI explanations.

---

## 8. Achievement System

### 8.1 Purpose

Achievements recognize meaningful gameplay accomplishments.

They are separate from exercise completion and progression unlocks.

An achievement may unlock a cosmetic or additional content item in a future version, but the initial implementation does not require rewards.

### 8.2 AchievementDefinition

```ts
interface AchievementDefinition {
    id: string;

    title: string;

    description: string;

    category: AchievementCategory;

    hidden: boolean;

    conditions: AchievementCondition[];

    rewardContentIds?: string[];
}
```

### 8.3 Achievement Categories

```ts
type AchievementCategory =
    | "training"
    | "campaign"
    | "movement"
    | "speedrun"
    | "exploration"
    | "special";
```

### 8.4 Achievement Status

```ts
type AchievementStatus =
    | "locked"
    | "unlocked";
```

The initial implementation does not need a multi-stage achievement lifecycle.

### 8.5 AchievementProgression

```ts
interface AchievementProgression {
    unlockedAchievementIds: string[];

    unlockedAt: Record<string, number>;
}
```

### 8.6 Initial Achievements

The initial achievement set should include:

**First Steps**

Complete the first Training exercise.

**Learning the Basics**

Complete all mandatory introductory Training exercises.

**Parkour Foundations**

Complete all mandatory movement Training sections.

**Perfect Execution**

Master a configured Training exercise.

**First Run**

Complete the Prologue for the first time.

**No Hesitation**

Complete the Prologue without abandoning the session.

**Speed Is Everything**

Complete a validated Speedrun.

**Gold Standard**

Earn a Gold medal in a supported Training exercise.

These are initial examples. Exact thresholds must be configurable.

### 8.7 Hidden Achievements

Hidden achievements should not reveal their descriptions before unlocking.

The UI may show a generic hidden achievement entry.

### 8.8 Achievement Evaluation

Achievement evaluation must use authoritative progression records and validated source events.

For example:

- Training achievements use confirmed Training results.
- Campaign achievements use confirmed campaign completion.
- Speedrun achievements use validated Speedrun results.

The Progression System must never infer a Gold medal from elapsed time independently of Training or Speedrun.

### 8.9 Achievement Notifications

When an achievement unlocks:

1. Commit the achievement state.
2. Publish an achievement-unlocked event.
3. Allow UI to display a notification.
4. Allow Audio to provide feedback.

Notifications must not block gameplay.

---

## 9. Progression Event Processing

### 9.1 Event-Driven Architecture

Progression receives events from specialized systems.

Examples:

- `training_exercise_completed`
- `training_exercise_mastered`
- `training_section_completed`
- `level_completed`
- `prologue_completed`
- `speedrun_completed`
- `achievement_condition_updated`

Only supported authoritative events may change progression.

### 9.2 ProgressionEvent

```ts
interface ProgressionEvent {
    id: string;

    type: string;

    sourceSystem: string;

    sourceEventId: string;

    sessionId?: string;

    occurredAt: number;

    payload: Record<string, unknown>;
}
```

### 9.3 Source Validation

Every event type must define:

- Authorized source system.
- Required payload fields.
- Session requirements.
- Validation rules.
- Idempotency behavior.

The event processor must reject unsupported or malformed events.

### 9.4 Idempotency

The same source event must not update progression more than once.

Maintain a bounded or otherwise safely managed processed-event record.

The implementation must define how event IDs are retained and compacted without allowing old events to be applied again after compaction.

### 9.5 Event Processing Pipeline

```text
Incoming Domain Event
        |
        v
Source Validation
        |
        v
Payload Validation
        |
        v
Idempotency Check
        |
        v
Progression Update
        |
        v
Unlock Evaluation
        |
        v
Achievement Evaluation
        |
        v
Persist Updated State
        |
        v
Publish Progression Events
```

### 9.6 Atomicity

A single progression event should produce one consistent progression update.

Where the persistence layer supports transactions, progression state and event processing metadata should be committed atomically.

If a transaction is unavailable, use a recoverable update strategy that prevents partially applied progression.

### 9.7 Event Ordering

Events may arrive asynchronously.

The system must not assume that event delivery order is always identical to gameplay occurrence order.

Use source event timestamps and domain validation where ordering affects correctness.

A late event must not overwrite a newer best record with an inferior result.

---

## 10. Milestones

### 10.1 Purpose

Milestones represent major stages in the player's journey.

They provide a lightweight progression narrative without introducing a quest system.

### 10.2 Initial Milestones

- First Training Exercise.
- Training Foundations Complete.
- Advanced Movement Complete.
- Prologue Unlocked Recommendation.
- First Prologue Completion.
- First Validated Speedrun.

### 10.3 Milestone Evaluation

Milestones are evaluated after relevant progression updates.

A milestone may be awarded only once.

### 10.4 Milestone Events

```ts
interface ProgressionMilestoneUnlockedEvent {
    milestoneId: string;

    achievedAt: number;

    sourceEventId: string;
}
```

---

## 11. Progression Snapshot and Queries

### 11.1 ProgressionSnapshot

```ts
interface ProgressionSnapshot {
    revision: number;

    training: {
        completedExerciseCount: number;

        masteredExerciseCount: number;

        completedSectionIds: string[];
    };

    campaign: {
        completedLevelIds: string[];

        prologueCompleted: boolean;
    };

    unlockedContentIds: string[];

    unlockedAchievementIds: string[];

    milestoneIds: string[];

    statistics: ProgressionStatistics;
}
```

The snapshot is immutable and safe for UI consumption.

### 11.2 Public Interface

```ts
interface IProgressionManager {
    getSnapshot(): ProgressionSnapshot;

    getContentStatus(
        contentId: string
    ): ContentUnlockStatus;

    getAchievementStatus(
        achievementId: string
    ): AchievementStatus;

    getUnmetRequirements(
        contentId: string
    ): ProgressionCondition[];

    subscribe(
        listener: ProgressionListener
    ): Unsubscribe;
}
```

The public query interface must not expose mutable internal collections.

### 11.3 UI Consumers

The following systems may consume progression snapshots:

- Main Menu.
- Training Selection.
- Prologue Introduction.
- Results.
- Achievement UI.
- Future content selection screens.

UI must not calculate unlock rules independently.

---

## 12. Training Integration

### 12.1 Training Is Authoritative

Training System owns:

- Exercise definitions.
- Exercise completion.
- Exercise mastery.
- Exercise scores.
- Best exercise times.
- Attempt history.

Progression consumes validated Training results.

### 12.2 Integration Contract

```ts
interface TrainingProgressionEvent {
    exerciseId: string;

    sectionId: string;

    sessionId: string;

    attemptId: string;

    completed: boolean;

    mastered: boolean;

    completedAt: number;

    resultId: string;
}
```

The actual event must include only fields needed for progression.

Do not copy the entire Training result object into Progression.

### 12.3 Duplicate Completion

Replaying an already completed exercise may improve its Training record.

It must not create duplicate completion milestones or duplicate achievements.

### 12.4 Section Completion

Progression may recognize section completion when Training confirms that all required exercises in the section are complete.

Training remains responsible for determining which exercises are mandatory.

---

## 13. Prologue and Campaign Integration

### 13.1 Campaign Completion

Prologue completion is recorded only after the authoritative completion flow confirms success.

A player reaching the final area without satisfying completion conditions must not receive campaign completion.

### 13.2 Campaign Records

Progression records:

- Completed level ID.
- Completion timestamp.
- Completion source event.
- Relevant milestone.
- Associated unlocks.

### 13.3 Section Progress

The Prologue contains:

1. Rooftop.
2. Industrial.
3. Construction.
4. Skybridge.
5. Finish.

Section completion events may be used for milestones or future content unlocks.

They must not replace Speedrun's required checkpoint validation.

### 13.4 Replay

Replaying the Prologue must not erase previous completion records.

A new successful completion may update the best result where the owning system provides an authoritative comparable metric.

### 13.5 Abandoned Sessions

Abandoning a Prologue session does not count as campaign completion.

---

## 14. Speedrun Integration

### 14.1 Speedrun Authority

Speedrun System owns:

- Run state.
- Timer.
- Splits.
- Medal calculation.
- Run validation.
- Personal best.
- Run history.

Progression consumes validated run results.

### 14.2 Accepted Results

Only a result accepted by Speedrun validation may contribute to Speedrun-related achievements or milestones.

### 14.3 Invalid Runs

Invalid runs must not unlock achievements that explicitly require a validated run.

The Progression System must not attempt to independently validate checkpoint order or route integrity.

### 14.4 Personal Best

Progression does not maintain a second Speedrun personal best.

It may expose a summary through a composed snapshot if the UI needs it, but the underlying value must come from Speedrun.

---

## 15. Save System Integration

### 15.1 Persistence Ownership

Progression owns the schema and semantic meaning of progression data.

Save System owns:

- IndexedDB.
- Transactions.
- Serialization infrastructure.
- Schema migration infrastructure.
- Backups.
- Storage error handling.

### 15.2 Repository Contract

```ts
interface IProgressionRepository {
    load(): Promise<PlayerProgression | null>;

    save(
        progression: PlayerProgression
    ): Promise<void>;

    reset(): Promise<void>;
}
```

The implementation must use the Save System repository abstraction.

It must not access IndexedDB directly.

### 15.3 Save Frequency

Persist after meaningful progression changes:

- Exercise completion.
- Exercise mastery.
- Section completion.
- Prologue completion.
- Achievement unlock.
- Content unlock.
- Milestone unlock.

Avoid writing the full progression record for every transient gameplay event.

### 15.4 Save Failure

If saving fails:

- Keep the latest valid state in memory.
- Mark persistence as pending.
- Retry according to Save System policy.
- Avoid publishing an event that falsely claims durable persistence.
- Allow gameplay to continue where safe.
- Surface a non-blocking warning if the failure persists.

### 15.5 Startup Reconciliation

At startup:

1. Load progression data.
2. Validate schema version.
3. Run required migrations.
4. Validate referenced IDs.
5. Reconcile unlock state.
6. Recalculate derived statistics where appropriate.
7. Publish the initial snapshot.

Missing optional content definitions must not invalidate all progression data.

---

## 16. Progression Reset

### 16.1 Reset Scope

The initial implementation may support a complete progression reset.

Resetting progression must be a deliberate user action.

### 16.2 Reset Behavior

Before reset:

- Show a confirmation dialog.
- Explain what data will be lost.
- Ensure no active gameplay session is being modified unexpectedly.

After confirmation:

1. Create a new initial progression state.
2. Clear progression unlock records.
3. Clear achievement unlock records.
4. Clear progression milestones.
5. Reset Training progress through Training System.
6. Coordinate reset of other domain-owned records where required.
7. Persist the resulting state.
8. Publish a progression reset event.

### 16.3 Ownership Boundaries

Progression must not directly delete Training records or Speedrun history from storage.

Each domain owner must expose its own reset operation.

### 16.4 Partial Failure

If one domain reset fails, the application must not silently report that all progress was reset.

The system must provide a recoverable reset workflow or a clearly reported partial failure.

---

## 17. Progression UI Integration

### 17.1 Main Menu

Main Menu may display:

- Training completion summary.
- Prologue completion status.
- Available modes.
- Recent milestone.
- Achievement notification.

### 17.2 Training Selection

Training Selection may display:

- Locked exercises.
- Available exercises.
- Completed exercises.
- Mastered exercises.
- Unlock requirements.

### 17.3 Prologue Introduction

Prologue Introduction may display:

- Completion status.
- Previously completed status.
- Recommended Training status.

Training completion must not be presented as mandatory if Prologue remains accessible without it.

### 17.4 Achievement Presentation

Achievement UI may display:

- Achievement title.
- Description.
- Category.
- Locked/unlocked state.
- Unlock timestamp.
- Hidden status.

### 17.5 Notifications

Notifications must be:

- Non-blocking.
- Deduplicated.
- Ordered predictably.
- Dismissible where appropriate.
- Independent from gameplay simulation.

The UI layer owns notification visuals.

---

## 18. Data Validation and Migration

### 18.1 Validation Requirements

Validate:

- Unique content IDs.
- Unique achievement IDs.
- Unique milestone IDs.
- Valid condition references.
- Valid unlock dependencies.
- No circular unlock dependencies.
- Valid achievement rewards.
- Valid timestamps.
- Non-negative statistics.
- Valid referenced exercise and level IDs.

### 18.2 Invalid Definitions

An invalid optional definition should be disabled with a diagnostic.

An invalid mandatory definition should produce a development error.

The application must not silently unlock all content as a fallback.

### 18.3 Schema Versioning

Progression schema version must be separate from Save System database version.

Migrations must be explicit and deterministic.

### 18.4 Content Version Compatibility

Progression records may reference content that has been removed or renamed.

The system must support:

- Stable IDs.
- ID migration aliases where necessary.
- Retired content records.
- Unknown achievement preservation.
- Safe handling of missing optional content.

Do not discard unknown progression records during a normal load.

---

## 19. Reliability and Performance

Requirements:

- Event-driven updates.
- No per-frame progression evaluation.
- Efficient content lookup.
- Efficient achievement lookup.
- Idempotent event processing.
- Immutable snapshots.
- Bounded event history.
- Session-independent persistent records.
- No synchronous storage operations during gameplay.
- No unnecessary full-state serialization.

Progression evaluation should be lightweight enough to run immediately after gameplay result events.

---

## 20. Testing Requirements

### 20.1 Model Tests

Test:

- Initial progression state.
- Progression revision.
- Training summary.
- Campaign summary.
- Unlock records.
- Milestone records.
- Achievement records.

### 20.2 Unlock Tests

Test:

- Initially unlocked content.
- Single-condition unlock.
- Multiple-condition unlock.
- Any-condition unlock.
- All-condition unlock.
- Unmet requirements.
- Repeated evaluation.
- Circular dependency rejection.

### 20.3 Event Processing Tests

Test:

- Valid Training event.
- Valid Prologue event.
- Valid Speedrun event.
- Invalid source.
- Invalid payload.
- Duplicate event.
- Out-of-order event.
- Stale session event.
- Persistence failure.

### 20.4 Achievement Tests

Test:

- First exercise completion.
- All mandatory exercises completed.
- Exercise mastery.
- Prologue completion.
- Validated Speedrun completion.
- Hidden achievement behavior.
- Duplicate achievement unlock.

### 20.5 Persistence Tests

Test:

- Initial load.
- Save progression.
- Reload progression.
- Migration.
- Corrupt records.
- Unknown content IDs.
- Save failure.
- Startup reconciliation.

### 20.6 Reset Tests

Test:

- Reset confirmation.
- Reset cancellation.
- Successful reset.
- Domain reset failure.
- Partial reset recovery.
- Repeated reset request.

### 20.7 Integration Tests

Test the complete progression path:

```text
New Player
    |
    v
Initial Progression
    |
    v
Complete Training Exercises
    |
    v
Unlock Training Sections
    |
    v
Earn Training Achievements
    |
    v
Complete Prologue
    |
    v
Record Campaign Milestone
    |
    v
Complete Validated Speedrun
    |
    v
Unlock Speedrun Achievement
```

---

## 21. Implementation Phases

### Phase 1: Core Models

Implement:

- PlayerProgression.
- TrainingProgression.
- CampaignProgression.
- ContentUnlockProgression.
- ProgressionMilestone.
- ProgressionStatistics.
- AchievementProgression.
- ProgressionSnapshot.

### Phase 2: Repository Integration

Implement:

- ProgressionRepository.
- Load.
- Save.
- Reset.
- Schema validation.
- Migration integration.

### Phase 3: Event Processing

Implement:

- ProgressionEvent.
- Event registry.
- Event source validation.
- Payload validation.
- Idempotency.
- Progression update pipeline.

### Phase 4: Unlock Rules

Implement:

- Content definitions.
- Unlock condition evaluation.
- Unlock resolver.
- Unmet requirement queries.
- Startup reconciliation.

### Phase 5: Achievements and Milestones

Implement:

- Achievement definitions.
- Achievement evaluator.
- Milestone evaluator.
- Unlock notifications.
- Achievement snapshots.

### Phase 6: Gameplay Integration

Integrate:

- Training.
- Prologue completion.
- Speedrun.
- Gameplay Session.
- Gameplay Flow.
- UI.

### Phase 7: Reset and Recovery

Implement:

- Progression reset.
- Domain reset coordination.
- Partial failure handling.
- Recovery behavior.

### Phase 8: Validation

Run:

- Unit tests.
- Event processing tests.
- Unlock tests.
- Achievement tests.
- Persistence tests.
- End-to-end progression tests.

---

## 22. Acceptance Criteria

The implementation is accepted when:

1. Progression has one authoritative manager.
2. Persistent progression is separate from gameplay session state.
3. Training remains authoritative for exercise records.
4. Speedrun remains authoritative for run records.
5. Prologue completion comes from an authoritative completion event.
6. Unlock rules are data-driven.
7. Unlock evaluation is deterministic.
8. Repeated evaluation does not duplicate unlock records.
9. Achievement definitions are data-driven.
10. Achievement evaluation uses validated events.
11. Duplicate source events are ignored.
12. Invalid events cannot change progression.
13. Progression snapshots are immutable.
14. UI can query locked content requirements.
15. Progression data is persisted through Save System.
16. Save failures do not interrupt active gameplay.
17. Startup reconciliation works.
18. Removed optional content does not corrupt all progression.
19. Progression reset is explicit and coordinated.
20. Domain-owned records are never directly deleted by Progression.
21. Speedrun and Training scoring are not duplicated.
22. Unit and integration tests pass.

---

## 23. Definition of Done

- [ ] Progression data models implemented.
- [ ] Progression manager implemented.
- [ ] Progression repository integrated.
- [ ] Save System integration complete.
- [ ] Progression event registry implemented.
- [ ] Event source validation implemented.
- [ ] Idempotency implemented.
- [ ] Unlock rule engine implemented.
- [ ] Unlock resolver implemented.
- [ ] Milestone evaluator implemented.
- [ ] Achievement manager implemented.
- [ ] Achievement evaluator implemented.
- [ ] Initial content definitions authored.
- [ ] Initial achievement definitions authored.
- [ ] Training integration complete.
- [ ] Prologue integration complete.
- [ ] Speedrun integration complete.
- [ ] Progression snapshot available.
- [ ] UI query integration complete.
- [ ] Reset workflow implemented.
- [ ] Partial failure recovery implemented.
- [ ] Schema validation implemented.
- [ ] Migration strategy implemented.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] End-to-end progression tests pass.
- [ ] No duplicated domain ownership exists.
- [ ] Architecture follows `01_AGENT_RULES.md` and `02_TECHNICAL_ARCHITECTURE.md`.

---

## 24. Final Design Constraints

1. Progression owns long-term cross-mode player progress.
2. Training owns exercise completion, scoring, and mastery records.
3. Speedrun owns run validation, timing, medals, and personal bests.
4. Gameplay Session owns active session lifecycle.
5. Gameplay Flow owns application navigation.
6. Save System owns persistence infrastructure.
7. Progression must not implement gameplay mechanics.
8. Progression changes must originate from validated domain events.
9. Event processing must be idempotent.
10. Unlock rules must be deterministic and data-driven.
11. Achievement evaluation must use authoritative results.
12. UI must not implement unlock logic.
13. Progression snapshots must be immutable.
14. Session-scoped state must not leak into persistent progression.
15. Replaying content must not erase previous accomplishments.
16. Abandoned sessions must not count as successful completion.
17. Invalid Speedrun results must not unlock validated-run achievements.
18. Domain-owned records must be reset through their owning systems.
19. Persistence failures must be recoverable.
20. Schema migrations must preserve valid historical progression.
21. Unknown optional content must not invalidate the entire progression record.
22. The initial implementation must avoid unnecessary XP, currency, skill-tree, and quest-system abstractions.
23. Future progression features must extend the existing event and rule architecture without violating domain ownership.

**End of Specification**