# 28_TUTORIAL_SYSTEM_SPEC.md

# Tutorial System Specification

**Project:** Glassline  
**Document:** 28 — Tutorial System  
**Status:** Implementation Specification  
**Version:** 1.0

---

## 1. Purpose

The Tutorial System provides contextual, lightweight guidance that helps players understand gameplay mechanics, controls, interactions, and level-specific situations.

It introduces mechanics at appropriate moments without interrupting the core parkour experience unnecessarily.

The system must support:

- Contextual gameplay instructions.
- First-time mechanic explanations.
- Control hints based on the active input device.
- Situational guidance during Training and Prologue.
- Tutorial acknowledgement and dismissal.
- Repetition policies.
- Player familiarity tracking.
- Accessibility-aware presentation.
- Localization.
- Persistent tutorial history.

The Tutorial System is a supporting gameplay system. It must not become a second Training System or a general-purpose dialogue framework.

### 1.1 Core Design Principle

Tutorials explain what the player can do and why it may be useful.

They do not evaluate whether the player performed an action correctly.

They must not change gameplay rules, mechanics, physics, timing, or other authoritative gameplay outcomes.

The distinction is important:

- Tutorial System explains a mechanic.
- Training System teaches and evaluates a mechanic through exercises.
- HUD System displays tutorial presentation.
- Input System provides the actual available controls.
- Movement System implements movement mechanics.

---

## 2. Scope

### 2.1 In Scope

The initial implementation includes:

1. Tutorial definitions.
2. Tutorial eligibility evaluation.
3. Trigger and condition processing.
4. Tutorial prioritization.
5. Presentation requests.
6. Dismissal and acknowledgement.
7. Repeat and cooldown policies.
8. Player familiarity tracking.
9. Session-scoped tutorial lifecycle.
10. Persistent tutorial history.
11. Localization integration.
12. Accessibility integration.
13. Training and Prologue integration.
14. Debugging and diagnostics.

### 2.2 Out of Scope

The Tutorial System does not own:

- Full Training exercises.
- Training objectives and evaluation.
- Training hints associated with active exercises.
- Movement implementation.
- Input device processing.
- HUD rendering.
- Menu navigation.
- Gameplay session lifecycle.
- Level loading.
- Checkpoint activation.
- Respawn execution.
- Speedrun timing or validation.
- General dialogue trees.
- Narrative cutscenes.
- Save database implementation.
- Localization resource storage.
- Achievement and unlock logic.

### 2.3 Deferred Features

The following features are not required initially:

- Voice-over tutorial narration.
- Interactive multi-step tutorial sequences.
- Adaptive tutorials based on advanced player behavior.
- Dynamic tutorial recommendations using machine learning.
- Multiplayer tutorials.
- Tutorial analytics backend.
- Complex branching instructional sequences.
- Video-based tutorials.

The architecture should not prevent these features from being introduced later.

---

## 3. Architectural Ownership

The Tutorial System owns instructional content semantics and the decision of when contextual guidance should be presented.

It does not own the presentation layer or the gameplay mechanics being explained.

| Responsibility | Owner |
|---|---|
| Tutorial definitions | Tutorial System |
| Tutorial eligibility | Tutorial System |
| Trigger evaluation | Tutorial System |
| Tutorial priority | Tutorial System |
| Tutorial acknowledgement | Tutorial System |
| Tutorial history semantics | Tutorial System |
| Tutorial persistence infrastructure | Save System |
| Training exercises | Training System |
| Training exercise hints | Training System |
| Movement mechanics | Movement System |
| Input bindings | Input System |
| Input device detection | Input System |
| Tutorial UI rendering | HUD / UI Systems |
| Menu navigation | Gameplay Flow |
| Language resources | Localization System |
| Accessibility preferences | Settings System |
| Tutorial and assistance preferences | Settings System |
| Accessibility policy | Accessibility System |
| Level triggers | Level Runtime |
| Gameplay session lifecycle | Gameplay Session System |
| Cross-mode unlocks | Progression System |

### 3.1 Training System Boundary

Training and Tutorial are related but independent.

Training owns structured instruction sequences with objectives and measurable outcomes.

Tutorial owns contextual explanations that may appear anywhere in the game.

Examples:

| Situation | Owner |
|---|---|
| Explain how sprinting works before the player tries it | Tutorial |
| Ask the player to sprint through a marked corridor | Training |
| Display a hint when a Training objective is not completed | Training |
| Explain a new wall-running surface in Prologue | Tutorial |
| Evaluate whether the player completed a wall-run exercise | Training |
| Show a temporary explanation of checkpoint behavior | Tutorial |
| Track checkpoint activation | Checkpoint System |

The Tutorial System must not duplicate Training objective definitions or Training hint logic.

### 3.2 HUD Boundary

The Tutorial System produces presentation data and requests presentation.

It must not directly construct UI components or manipulate HUD widgets.

The HUD System owns rendering, layout, animations, visibility, and input-device-specific visual presentation.

### 3.3 Persistence Boundary

Tutorial history is persisted through the Save System.

The Tutorial System owns the meaning of persisted data, including:

- Which tutorials were acknowledged.
- Which tutorials were completed.
- Which tutorials were dismissed.
- Which tutorials should be shown again.
- Player familiarity records.

The Tutorial System must not access IndexedDB directly.

### 3.4 Settings Boundary

Tutorial visibility and assistance preferences are owned by the Settings System (`25_SETTINGS_SYSTEM_SPEC.md`).

The Tutorial System consumes effective values such as `gameplay.show_tutorial_hints` and `gameplay.contextual_assistance` from the Settings System. It must not maintain its own preference store or persist duplicate copies of those settings.

---

## 4. High-Level Architecture

The system is divided into independent components.

```text
Gameplay Events
      |
      v
Tutorial Trigger Adapter
      |
      v
Tutorial Event Router
      |
      v
Tutorial Eligibility Evaluator
      |
      v
Tutorial Priority Resolver
      |
      v
Tutorial Queue Manager
      |
      v
Tutorial Presentation Coordinator
      |
      v
HUD / UI Presentation
      |
      v
Player Response
      |
      v
Tutorial State Manager
      |
      v
Tutorial History Repository
      |
      v
Save System
```

Supporting services:

```text
Localization System
Accessibility System
Input System
Gameplay Session System
Training System
Progression System
```

The system must remain event-driven.

Gameplay systems publish authoritative events. Tutorial System subscribes to those events and evaluates whether they make a tutorial eligible.

---

## 5. Core Components

### 5.1 TutorialManager

Central public entry point.

Responsibilities:

- Initialize the Tutorial System.
- Register tutorial definitions.
- Receive relevant gameplay events.
- Coordinate eligibility evaluation.
- Coordinate tutorial queue operations.
- Manage active tutorial state.
- Expose tutorial history snapshots.
- Handle session transitions.
- Coordinate persistence.

It must not contain the implementation of every individual subsystem.

Suggested interface:

```typescript
interface ITutorialManager {
    initialize(): Promise<void>;

    startSession(context: TutorialSessionContext): void;
    endSession(sessionId: string): void;

    processEvent(event: TutorialTriggerEvent): void;

    acknowledge(tutorialId: string): void;
    dismiss(tutorialId: string): void;

    requestTutorial(tutorialId: string): TutorialRequestResult;

    getSnapshot(): TutorialSnapshot;

    subscribe(
        listener: (event: TutorialSystemEvent) => void
    ): Unsubscribe;
}
```

`requestTutorial` is intended for explicit system integrations and debugging. It must still validate eligibility and presentation policies.

### 5.2 TutorialRegistry

Owns the collection of available tutorial definitions.

Responsibilities:

- Register definitions.
- Validate unique identifiers.
- Resolve definitions by ID.
- Provide definitions filtered by game mode.
- Validate references to localization keys.
- Detect invalid trigger configurations.

Tutorial definitions should be data-driven.

The registry must not contain player-specific runtime state.

### 5.3 TutorialEventRouter

Receives relevant gameplay events and maps them to tutorial triggers.

Responsibilities:

- Subscribe to authoritative system events.
- Normalize event information.
- Attach session correlation.
- Route events to eligibility evaluation.
- Reject stale events.
- Avoid duplicate event processing.

The router must not modify source events.

### 5.4 TutorialEligibilityEvaluator

Determines whether a tutorial can be presented.

Responsibilities:

- Check trigger requirements.
- Check game mode restrictions.
- Check session context.
- Check prerequisites.
- Check previous acknowledgements.
- Check cooldowns.
- Check repeat policies.
- Check suppression conditions.
- Evaluate player familiarity.

The evaluator must be deterministic for a given snapshot and event.

It must not directly display tutorials.

### 5.5 TutorialPriorityResolver

Determines which eligible tutorial should be presented first.

Responsibilities:

- Calculate effective priority.
- Resolve priority conflicts.
- Apply interruption restrictions.
- Preserve stable ordering.
- Avoid repeatedly replacing the current tutorial.

Priority resolution must not modify tutorial definitions.

### 5.6 TutorialQueueManager

Maintains pending tutorial requests.

Responsibilities:

- Queue eligible tutorials.
- Deduplicate requests.
- Enforce queue limits.
- Remove expired requests.
- Handle cancellation.
- Preserve priority ordering.
- Prevent simultaneous blocking tutorials.

The initial implementation should use a single active tutorial with a small pending queue.

Recommended default queue capacity: 5.

A tutorial must not remain queued indefinitely after its triggering context becomes invalid.

### 5.7 TutorialPresentationCoordinator

Coordinates presentation requests with HUD and UI.

Responsibilities:

- Convert tutorial definitions into presentation models.
- Request tutorial presentation.
- Handle acknowledgement and dismissal callbacks.
- Suspend presentation when gameplay context prohibits it.
- Handle presentation cancellation.
- Coordinate presentation lifecycle.

It does not render UI.

### 5.8 TutorialStateManager

Maintains runtime tutorial state.

Responsibilities:

- Track active tutorial.
- Track queued tutorials.
- Track session-local completion.
- Track acknowledgement and dismissal transitions.
- Maintain player familiarity snapshots.
- Publish state changes.

It must not become a replacement for the Save System.

### 5.9 TutorialHistoryRepository

Provides a persistence abstraction.

Responsibilities:

- Load tutorial history.
- Save acknowledged tutorials.
- Save completion records.
- Save dismissal records.
- Save familiarity data.
- Handle versioned records.
- Expose repository errors.

The repository delegates actual persistence to Save System infrastructure.

### 5.10 TutorialValidator

Validates tutorial definitions and runtime operations.

Responsibilities:

- Validate identifiers.
- Validate trigger definitions.
- Validate localization references.
- Validate prerequisites.
- Validate presentation duration.
- Validate repeat policies.
- Detect dependency cycles.
- Reject invalid state transitions.

Validation must be available during development and testing.

---

## 6. Data Models

All identifiers must be stable strings.

Tutorial IDs must not depend on localized display names.

### 6.1 TutorialDefinition

```typescript
interface TutorialDefinition {
    id: string;

    category: TutorialCategory;

    titleKey: string;
    bodyKey: string;

    inputActionIds?: string[];

    trigger: TutorialTriggerDefinition;

    eligibility?: TutorialEligibilityDefinition;

    prerequisites?: string[];

    presentation: TutorialPresentationDefinition;

    repeatPolicy: TutorialRepeatPolicy;

    priority: number;

    supportedModes: GameplayMode[];

    enabled: boolean;
}
```

Definitions must be immutable after registration.

Runtime changes should be represented by state, not by modifying the definition.

### 6.2 TutorialCategory

```typescript
type TutorialCategory =
    | "movement"
    | "traversal"
    | "interaction"
    | "navigation"
    | "checkpoint"
    | "speedrun"
    | "system";
```

Categories are used for filtering, diagnostics, and future configuration.

They must not determine gameplay behavior by themselves.

### 6.3 TutorialTriggerDefinition

```typescript
interface TutorialTriggerDefinition {
    type:
        | "event"
        | "level-trigger"
        | "session-start"
        | "manual";

    eventType?: string;

    triggerId?: string;

    mode?: GameplayMode;

    sectionId?: string;

    oncePerSession?: boolean;
}
```

Trigger definitions describe what can make a tutorial eligible.

They must not contain executable scripts or arbitrary code.

### 6.4 TutorialEligibilityDefinition

```typescript
interface TutorialEligibilityDefinition {
    requiredFlags?: string[];

    forbiddenFlags?: string[];

    minimumFamiliarity?: number;

    maximumFamiliarity?: number;

    requirePlayerControl?: boolean;

    requireGrounded?: boolean;

    allowDuringPause?: boolean;

    allowDuringHighSpeedMovement?: boolean;

    minimumTimeSinceLastTutorial?: number;
}
```

Flags must be provided by registered context providers.

Avoid using unstructured global variables as tutorial conditions.

### 6.5 TutorialPresentationDefinition

```typescript
interface TutorialPresentationDefinition {
    style:
        | "compact"
        | "instruction"
        | "control-hint"
        | "contextual";

    duration?: number;

    dismissible: boolean;

    acknowledgementRequired: boolean;

    blocksGameplay: boolean;

    preferredPosition:
        | "top"
        | "center"
        | "bottom";

    showInputHints: boolean;
}
```

`duration` is an optional presentation hint, not a guaranteed dismissal timer.

Important instructions must not disappear before the player has a reasonable opportunity to read them.

### 6.6 TutorialRepeatPolicy

```typescript
interface TutorialRepeatPolicy {
    type:
        | "once-ever"
        | "once-per-session"
        | "after-dismissal"
        | "cooldown"
        | "always";

    cooldownSeconds?: number;

    maximumDisplays?: number;
}
```

Repeat policy is evaluated against persisted history and current session state.

### 6.7 TutorialRuntimeState

```typescript
type TutorialRuntimeStatus =
    | "pending"
    | "queued"
    | "presenting"
    | "acknowledged"
    | "dismissed"
    | "completed"
    | "cancelled"
    | "expired";

interface TutorialRuntimeState {
    tutorialId: string;

    status: TutorialRuntimeStatus;

    sessionId: string;

    attemptId?: string;

    triggeredAt: number;

    presentedAt?: number;

    resolvedAt?: number;

    displayCount: number;
}
```

Runtime state must be scoped to a valid session or explicitly marked as global.

### 6.8 TutorialHistoryRecord

```typescript
interface TutorialHistoryRecord {
    tutorialId: string;

    firstPresentedAt?: number;

    lastPresentedAt?: number;

    acknowledgedAt?: number;

    completedAt?: number;

    dismissedAt?: number;

    totalDisplays: number;

    totalDismissals: number;

    status:
        | "unknown"
        | "seen"
        | "acknowledged"
        | "completed";
}
```

Use persisted timestamps for history and cooldown calculations.

Do not use wall-clock timestamps for gameplay timing or Speedrun measurement.

### 6.9 PlayerFamiliarityRecord

```typescript
interface PlayerFamiliarityRecord {
    mechanicId: string;

    familiarity: number;

    lastObservedAt?: number;

    evidenceCount: number;

    source:
        | "tutorial"
        | "training"
        | "gameplay";
}
```

Familiarity is a lightweight instructional signal.

It must not become a hidden skill rating or affect gameplay physics, difficulty, or Speedrun scoring.

Initial implementation may use simple deterministic increments based on authoritative events.

---

## 7. Tutorial Lifecycle

A tutorial follows this lifecycle:

```text
Unavailable
    |
    v
Eligible
    |
    v
Queued
    |
    v
Presenting
    |
    +------> Acknowledged
    |
    +------> Dismissed
    |
    +------> Cancelled
    |
    +------> Expired
```

### 7.1 Eligibility

A tutorial becomes eligible when:

1. Its trigger is satisfied.
2. Its game mode is supported.
3. Its prerequisites are satisfied.
4. Its repeat policy permits presentation.
5. Its current session is valid.
6. Its presentation conditions are satisfied or can become satisfied later.

Eligibility does not guarantee immediate presentation.

### 7.2 Queueing

Eligible tutorials are submitted to the queue.

The queue manager must:

- Deduplicate identical tutorial IDs within the same session.
- Keep the highest-priority valid request.
- Remove expired requests.
- Avoid replacing an active tutorial unnecessarily.
- Revalidate conditions before presentation.

### 7.3 Presentation

When presentation becomes possible:

1. Validate the tutorial again.
2. Resolve localized content.
3. Resolve available input action labels.
4. Resolve effective accessibility configuration.
5. Build a presentation model.
6. Send the presentation request to HUD/UI.
7. Mark the tutorial as presenting.

A presentation failure must not permanently mark the tutorial as acknowledged.

### 7.4 Acknowledgement

Acknowledgement means the player explicitly confirms that they have seen the instruction.

Examples:

- Pressing a continue action.
- Selecting a confirmation control.
- Using a supported keyboard or gamepad action.

Acknowledgement does not necessarily mean the player has mastered the mechanic.

The Tutorial System must not infer mastery from acknowledgement.

### 7.5 Dismissal

Dismissal means the player closes the tutorial without explicitly confirming its instructional content.

Dismissal behavior depends on the repeat policy.

Examples:

- `once-ever`: do not show again after dismissal if the definition explicitly allows dismissal to count as seen.
- `after-dismissal`: allow another presentation when its cooldown expires.
- `cooldown`: suppress until the configured interval has elapsed.
- `always`: allow future presentations when the trigger occurs again.

The exact behavior must be documented in the definition and validated.

### 7.6 Completion

Completion is an optional semantic state for tutorials that require a specific acknowledgement sequence.

For the initial implementation, completion should normally mean that all required tutorial presentation steps were acknowledged.

It must not be confused with Training exercise completion.

### 7.7 Cancellation

A tutorial may be cancelled when:

- Its session ends.
- Its triggering section unloads.
- Its context becomes invalid.
- A higher-level blocking UI takes control.
- The player enters a state where presentation is prohibited.
- The tutorial definition becomes unavailable.

Cancellation must not automatically count as dismissal.

---

## 8. Trigger Sources

The Tutorial System may subscribe to the following authoritative events.

| Source | Example events |
|---|---|
| Gameplay Session | Session started, mode entered |
| Level Runtime | Section entered, level trigger activated |
| Movement | First sprint, first jump, first slide, first vault |
| Interaction | First successful interaction |
| Checkpoint | Checkpoint activated |
| Speedrun | Run started, first split reached |
| Training | Exercise completed, mechanic introduced |
| Progression | Relevant milestone unlocked |
| Input | Input device changed, binding context changed |

The exact event names must follow the owning system's public contracts.

The Tutorial System must not create duplicate events just to satisfy its own trigger model.

### 8.1 Event Correlation

Every event must be associated with sufficient context to determine whether it belongs to the current session.

Where applicable, event envelopes should include:

```typescript
interface TutorialTriggerEvent {
    eventId: string;

    type: string;

    sessionId?: string;

    attemptId?: string;

    levelId?: string;

    sectionId?: string;

    timestamp: number;

    source: string;

    payload?: Record<string, unknown>;
}
```

The event router must reject events belonging to:

- Previous sessions.
- Ended attempts.
- Unloaded levels.
- Invalid or unknown sources.

The Tutorial System must not mutate the original event or attach correlation data to it after publication.

Use an adapter or correlation context when the source event does not provide all required metadata.

### 8.2 Duplicate Event Protection

Use `eventId` where available.

Otherwise, use a documented deduplication strategy based on source, event type, session, and relevant event identity.

Deduplication must not suppress legitimate repeated gameplay actions.

---

## 9. Presentation Rules

Tutorials must respect the pace of the game.

The player should not receive a large blocking instruction while performing a difficult parkour maneuver.

### 9.1 Presentation Safety

By default, contextual tutorials should wait until:

- The player is not in a critical traversal action.
- The player has control of the character.
- The player is not respawning.
- The game is not transitioning between levels.
- No higher-priority blocking dialog is active.

The following movement states should normally suppress blocking tutorials:

- Sliding.
- Vaulting.
- WallRunning.
- WallJumping.
- Falling.
- Landing.

Small non-blocking contextual indicators may be allowed if they do not obscure essential gameplay information.

### 9.2 High-Speed Movement

Tutorials triggered during high-speed movement should normally be queued.

The system should wait for a safe presentation window.

Do not force the player to stop or slow down.

### 9.3 Priority

Suggested priority bands:

| Priority | Meaning |
|---|---|
| 100–90 | Critical system instructions |
| 89–70 | Important mechanic introduction |
| 69–40 | Contextual guidance |
| 39–10 | Optional tips |
| 9–0 | Low-priority informational hints |

Priority values must be validated.

When priorities are equal, use stable ordering based on trigger time and definition ID.

### 9.4 Interruption Policy

The initial implementation should not interrupt an already visible tutorial with another tutorial of equal or lower priority.

A critical system instruction may replace a lower-priority presentation only through an explicit policy.

The replaced tutorial must return to the queue if it remains valid.

### 9.5 Gameplay Blocking

Most tutorials should be non-blocking.

A short instructional overlay may optionally pause or block gameplay, but this behavior must be explicitly configured and coordinated with Gameplay Flow and Gameplay Session.

The Tutorial System must never freeze physics directly.

---

## 10. Initial Tutorial Content

The initial implementation should include a small, focused set of tutorials.

The set should stay consistent with the canonical ten Training exercises (`21_TRAINING_SYSTEM_SPEC.md`). Mechanics that are only combinations of earlier ones are explained contextually through their component tutorials rather than by a separate blocking tutorial.

The exact wording belongs to Localization resources.

Suggested identifiers:

| Tutorial ID | Trigger | Purpose |
|---|---|---|
| `tutorial_movement_basics` | First gameplay session | Introduce directional movement |
| `tutorial_sprint` | First sprint opportunity | Explain sprinting |
| `tutorial_jump` | First jump opportunity | Explain jumping |
| `tutorial_slide` | First suitable low obstacle | Explain sliding |
| `tutorial_vault` | First vaultable obstacle | Explain vaulting |
| `tutorial_wall_run` | First wall-run opportunity | Explain wall running |
| `tutorial_wall_jump` | First wall-jump opportunity | Explain wall jumping |
| `tutorial_landing` | First relevant landing | Explain controlled landings |
| `tutorial_interaction` | First interactable target | Explain interaction |
| `tutorial_checkpoint` | First checkpoint | Explain checkpoint behavior |
| `tutorial_speedrun` | First Speedrun preparation | Explain timing and splits |

Not all tutorials must be enabled in every mode.

### 10.1 Training

Training may provide context in which contextual tutorials become eligible before or during an exercise.

However:

- Exercise instructions remain owned by Training.
- Objective-specific hints remain owned by Training.
- Tutorial content should not repeat the active exercise instructions.
- Training may provide an explicit context indicating that a mechanic has already been introduced.

### 10.2 Prologue

Prologue should introduce mechanics gradually.

Suggested introduction sequence:

- Rooftop: movement, sprinting, jumping.
- Industrial: sliding and vaulting.
- Construction: wall running and wall jumping.
- Skybridge: combined traversal and momentum.
- Finish: checkpoint and completion feedback where appropriate.

These are recommended content placements, not mandatory hardcoded triggers.

Level Design and Level Runtime definitions should identify actual tutorial trigger locations.

### 10.3 Speedrun

Speedrun tutorials should explain the rules before the run begins whenever possible.

They must not:

- Change the timer.
- Add time penalties unless explicitly defined by Speedrun rules.
- Change checkpoint order.
- Interrupt a running attempt with blocking content.

Tutorial presentation during an active run should be disabled by default.

---

## 11. Player Familiarity

The Tutorial System may track whether a player has already demonstrated familiarity with a mechanic.

Examples:

- Successfully sprinted several times.
- Completed a jump.
- Successfully performed a vault.
- Activated a checkpoint.
- Completed a Training exercise for a mechanic.

### 11.1 Familiarity Rules

Familiarity should be deterministic and explainable.

A possible initial scale:

| Value | Meaning |
|---|---|
| 0 | Unknown |
| 1 | Introduced |
| 2 | Attempted |
| 3 | Demonstrated |
| 4 | Practiced |
| 5 | Familiar |

The scale is instructional metadata only.

It must not be used as a hidden difficulty adjustment.

### 11.2 Sources of Familiarity

Familiarity may be updated from authoritative events.

Examples:

- Tutorial acknowledged: introduced.
- Movement action performed: attempted.
- Successful traversal event: demonstrated.
- Training exercise completed: practiced.
- Repeated successful use: familiar.

Training remains authoritative for exercise results.

The Tutorial System consumes those results but does not recalculate them.

### 11.3 Familiarity and Eligibility

A tutorial may require a familiarity range.

For example, an introductory tutorial should not repeatedly appear when the player has already demonstrated the mechanic.

However, familiarity must not be the only condition for critical instructions.

---

## 12. Persistence

Tutorial history is persistent player data.

The Tutorial System uses the Save System through a dedicated repository interface.

Suggested repository:

```typescript
interface ITutorialHistoryRepository {
    load(): Promise<TutorialHistoryRecord[]>;

    save(
        records: TutorialHistoryRecord[]
    ): Promise<void>;

    reset(): Promise<void>;
}
```

### 12.1 Persisted Data

Persist:

- Acknowledged tutorials.
- Completed tutorials.
- Dismissal history.
- Display counts.
- Last presentation time.
- Familiarity records.

Do not persist transient presentation state such as:

- Active overlay.
- Current queue.
- Pending UI callback.
- Current session trigger state.

### 12.2 Save Behavior

Persistence must be asynchronous.

It must not block the gameplay loop.

The system should:

- Batch non-critical updates where appropriate.
- Avoid writing after every frame or repeated movement event.
- Persist meaningful state transitions.
- Handle storage failures.
- Preserve the latest valid in-memory state.
- Report failures through diagnostics.

### 12.3 Data Versioning

Tutorial history requires its own schema version.

This version must be independent of:

- IndexedDB database version.
- Save System schema version.
- Localization resource version.

Migration logic must preserve valid history.

Unknown tutorial IDs should not crash loading. They may be retained for migration compatibility or safely ignored according to repository policy.

### 12.4 Reset

Tutorial history reset must be explicit.

The Tutorial System must not delete Training progress or other player data.

A reset request should be coordinated through the appropriate Settings/Menu/Progression flows and executed through the Save System.

---

## 13. Localization Integration

All player-visible tutorial content must use Localization System keys.

Example:

```json
{
  "tutorial": {
    "movement": {
      "basics": {
        "title": "tutorial.movement.basics.title",
        "body": "tutorial.movement.basics.body"
      }
    }
  }
}
```

The example illustrates key organization. Actual translation resources must follow the Localization System's namespace and key conventions.

Requirements:

- No hardcoded player-facing strings.
- Named interpolation parameters.
- Localized input action labels.
- Support for text expansion.
- Safe fallback when a translation is missing.
- Language changes must update visible tutorial content where practical.

The Tutorial System owns references to localization keys, not translation strings.

---

## 14. Input Integration

Tutorials may explain controls.

They must obtain action labels from the Input System.

Example:

```typescript
interface TutorialInputHint {
    actionId: string;

    localizedLabel: string;

    displayGlyph?: string;

    deviceType: InputDeviceType;
}
```

The Tutorial System must not:

- Hardcode keyboard keys.
- Hardcode gamepad buttons.
- Read raw DOM keyboard events.
- Infer bindings independently.
- Modify input mappings.

If the player changes input device while a tutorial is visible, the presentation model may be refreshed.

If an action has no binding, the system should omit the control hint or display a localized unavailable state.

---

## 15. Accessibility Integration

Tutorial presentation must respect the effective Accessibility configuration.

Requirements:

- Reduced Motion.
- UI scale.
- High Contrast.
- Text readability.
- Keyboard navigation.
- Gamepad navigation.
- Visible focus.
- Screen-reader-friendly labels where supported.
- No audio-only instructional information.

Tutorial animations must not interfere with gameplay readability.

Blocking tutorial content must provide an accessible acknowledgement or dismissal path.

The Tutorial System must not maintain its own accessibility preferences.

It consumes the effective configuration from Accessibility System.

### 15.1 Reduced Motion

When Reduced Motion is enabled:

- Disable unnecessary movement and scale animations.
- Prefer simple opacity transitions or immediate presentation.
- Avoid animated tutorial indicators that repeatedly draw attention.
- Preserve clear state changes.

---

## 16. UI / HUD Integration

The Tutorial System sends presentation requests to the HUD/UI layer.

Suggested presentation model:

```typescript
interface TutorialPresentationModel {
    tutorialId: string;

    title: string;

    body: string;

    style: TutorialPresentationStyle;

    inputHints: TutorialInputHint[];

    dismissible: boolean;

    acknowledgementRequired: boolean;

    blocksGameplay: boolean;

    preferredPosition: string;

    priority: number;
}
```

The HUD System owns:

- Rendering.
- Positioning.
- Animation.
- Visibility.
- Responsive layout.
- Input focus.
- Visual consistency.

The Tutorial System owns:

- Content selection.
- Eligibility.
- Lifecycle.
- Presentation policy.
- Acknowledgement semantics.

### 16.1 HUD Visibility

Tutorial presentation must coordinate with HUD visibility rules.

Examples:

- Hide or suspend contextual tutorials during Results.
- Suppress tutorials during loading transitions.
- Avoid overlap with interaction prompts.
- Avoid overlap with critical Speedrun information.
- Preserve essential accessibility information.

The HUD System decides the final layout.

The Tutorial System should provide priority and presentation metadata rather than assuming a fixed screen position.

---

## 17. Gameplay Session Integration

Tutorial runtime state is associated with a gameplay session.

On session start:

1. Receive the session context.
2. Load or reuse persistent history.
3. Initialize session-local tutorial state.
4. Register relevant event subscriptions.
5. Evaluate session-start triggers.

On session end:

1. Cancel pending session-bound tutorials.
2. Dismiss active presentation safely.
3. Flush pending history updates.
4. Remove session subscriptions.
5. Invalidate the session correlation token.
6. Clear session-local state.

### 17.1 Session Identity

Every session-bound request must carry a session ID.

If an asynchronous operation completes after the session ends, its result must be ignored.

### 17.2 Training Attempts

Where Training attempts are relevant, tutorial requests may carry an attempt ID.

A tutorial triggered by an old attempt must not appear during a new attempt.

Training remains authoritative for attempt lifecycle.

### 17.3 Pause and Resume

Tutorial presentation must respect the Gameplay Flow and Gameplay Session states.

The Tutorial System must not independently pause or resume gameplay.

If a tutorial is suspended during pause, it may resume only when the session is active and presentation conditions are valid.

---

## 18. Progression Integration

The Tutorial System may consume Progression events to determine whether optional instructional content is relevant.

Examples:

- A new gameplay mechanic becomes available.
- A mode is unlocked.
- A milestone indicates that a tutorial may be useful.

However, tutorial acknowledgement must not automatically grant achievements or unlock content.

If a tutorial is intended to contribute to a progression milestone, it should publish a stable semantic event.

Example:

```typescript
interface TutorialAcknowledgedEvent {
    tutorialId: string;

    sessionId?: string;

    acknowledgedAt: number;
}
```

Progression decides whether this event contributes to any milestone.

---

## 19. Events

The Tutorial System should publish semantic events.

Suggested event types:

```typescript
type TutorialSystemEvent =
    | TutorialEligibleEvent
    | TutorialQueuedEvent
    | TutorialPresentedEvent
    | TutorialAcknowledgedEvent
    | TutorialDismissedEvent
    | TutorialCompletedEvent
    | TutorialCancelledEvent
    | TutorialExpiredEvent
    | TutorialHistoryUpdatedEvent;
```

All events should include:

- Event ID.
- Tutorial ID.
- Timestamp.
- Optional session ID.
- Optional attempt ID.
- Event source.

Events must be emitted after the corresponding state transition is committed.

Subscribers must not receive duplicate terminal events for the same tutorial instance.

### 19.1 Event Ordering

For a normal presentation:

1. Eligible.
2. Queued.
3. Presented.
4. Acknowledged or dismissed.
5. History updated.

A tutorial may skip queue notification when it is immediately presented, but its lifecycle must remain valid.

---

## 20. Failure Handling

The system must handle:

- Missing tutorial definition.
- Invalid trigger configuration.
- Missing localization resource.
- Missing input binding.
- Invalid prerequisite.
- Dependency cycle.
- Persistence failure.
- Presentation failure.
- Stale session event.
- Duplicate event.
- Invalid acknowledgement callback.
- Session ending during presentation.
- Level unloading during presentation.

Failure handling principles:

1. Never crash gameplay because a tutorial cannot be shown.
2. Do not mark a tutorial acknowledged after a presentation failure.
3. Do not display stale session content.
4. Do not leave the queue permanently blocked.
5. Preserve valid persisted history.
6. Report development errors through diagnostics.
7. Provide safe fallbacks for optional content.

Critical gameplay systems must remain functional when the Tutorial System is unavailable.

---

## 21. Performance Requirements

The Tutorial System must have negligible impact on gameplay performance.

Requirements:

- Event-driven evaluation.
- No per-frame polling for tutorial eligibility.
- No synchronous persistence operations.
- No repeated localization loading during presentation.
- Cached immutable definitions.
- Bounded queue size.
- Bounded history data.
- Efficient trigger lookup.
- No allocations proportional to frame count.

Suggested targets:

| Operation | Target |
|---|---|
| Event routing | Under 1 ms |
| Eligibility evaluation | Under 1 ms |
| Priority resolution | Under 1 ms |
| Queue update | Under 1 ms |
| Presentation model creation | Under 2 ms |

These are development targets, not guaranteed browser timing limits.

Heavy localization or persistence operations must remain asynchronous.

---

## 22. Debugging and Diagnostics

Development builds should provide tutorial diagnostics.

Recommended information:

- Registered tutorial definitions.
- Current active tutorial.
- Pending queue.
- Eligibility evaluation result.
- Failed eligibility conditions.
- Trigger source.
- Session ID.
- Attempt ID.
- Repeat policy decision.
- Last presentation timestamp.
- Familiarity value.
- Persistence status.

Suggested debug commands:

```text
tutorial.list
tutorial.show <id>
tutorial.dismiss
tutorial.acknowledge
tutorial.reset
tutorial.history
tutorial.queue
tutorial.evaluate <id>
```

Debug commands must use the same validation and lifecycle paths as normal gameplay.

They must not bypass session validation or directly mutate persisted records.

---

## 23. Initial Implementation Plan

### Phase 1 — Foundation

Implement:

- TutorialDefinition.
- TutorialRegistry.
- TutorialManager.
- TutorialValidator.
- Basic runtime state.
- Static tutorial definitions.

Acceptance:

- Definitions can be registered and resolved.
- Invalid definitions are rejected.
- Stable identifiers are enforced.
- No presentation is required yet.

### Phase 2 — Event and Eligibility System

Implement:

- TutorialEventRouter.
- Trigger adapters.
- TutorialEligibilityEvaluator.
- Prerequisite checks.
- Session correlation.
- Duplicate event protection.

Acceptance:

- Relevant gameplay events produce deterministic eligibility decisions.
- Stale events are rejected.
- Unsupported modes do not activate tutorials.

### Phase 3 — Queue and Presentation

Implement:

- TutorialPriorityResolver.
- TutorialQueueManager.
- TutorialPresentationCoordinator.
- HUD/UI presentation adapter.
- Acknowledgement and dismissal callbacks.

Acceptance:

- Only one blocking tutorial is active.
- Queue ordering is deterministic.
- Presentation is deferred during unsafe movement states.
- Failed presentation does not count as acknowledgement.

### Phase 4 — Persistence

Implement:

- TutorialHistoryRepository.
- Save System adapter.
- History migration.
- Display counts.
- Acknowledgement and dismissal persistence.
- Familiarity persistence.

Acceptance:

- Tutorial history survives reload.
- Storage failure does not break gameplay.
- Reset affects only tutorial history.

### Phase 5 — Game Integration

Implement initial tutorial content.

Integrate with:

- Training.
- Prologue.
- Movement.
- Interaction.
- Checkpoint.
- Speedrun.
- Gameplay Session.
- Gameplay Flow.
- HUD.
- Input.
- Localization.
- Accessibility.
- Progression.

Acceptance:

- Tutorials appear in intended contexts.
- Training instructions are not duplicated.
- Speedrun rules are explained before a run.
- Input labels reflect current bindings.
- Language and accessibility settings are respected.

### Phase 6 — Validation and Polish

Implement:

- Debug commands.
- Diagnostic output.
- Automated tests.
- Queue stress tests.
- Session transition tests.
- Presentation edge-case handling.

Acceptance:

- No stale tutorials appear after session transitions.
- Queue cannot become permanently blocked.
- Tutorial failures do not affect core gameplay.
- All initial definitions pass validation.

---

## 24. Testing Requirements

### 24.1 Unit Tests

Test:

- Tutorial definition validation.
- Registry uniqueness.
- Trigger matching.
- Prerequisite evaluation.
- Repeat policies.
- Cooldown behavior.
- Priority ordering.
- Queue deduplication.
- Queue expiration.
- State transitions.
- Acknowledgement.
- Dismissal.
- Familiarity updates.
- History serialization.
- Migration behavior.

### 24.2 Integration Tests

Test:

- Movement event triggers.
- Interaction event triggers.
- Checkpoint event triggers.
- Training event integration.
- Gameplay Session lifecycle.
- Level section transitions.
- HUD presentation.
- Input binding labels.
- Localization changes.
- Accessibility configuration changes.
- Save System integration.
- Progression event publication.

### 24.3 Lifecycle Tests

Test the following cases:

1. Tutorial triggered during active gameplay.
2. Tutorial triggered during sliding.
3. Tutorial triggered during vaulting.
4. Tutorial triggered while falling.
5. Tutorial queued while another tutorial is visible.
6. Session ends while tutorial is visible.
7. Session restarts with pending tutorial requests.
8. Level section unloads while tutorial is queued.
9. Language changes while tutorial is visible.
10. Input device changes while tutorial is visible.
11. Persistence fails after acknowledgement.
12. Stale event arrives after session end.

### 24.4 Regression Tests

Verify:

- Training exercises still function independently.
- Training hints remain controlled by Training.
- HUD visibility rules remain unchanged.
- Movement is never blocked by non-blocking tutorials.
- Speedrun timing remains independent.
- Respawn behavior is unaffected.
- Gameplay Flow remains authoritative for navigation.
- Tutorial System can be disabled without breaking gameplay.

---

## 25. Definition of Done

The Tutorial System is considered complete when:

- [ ] Tutorial definitions are data-driven.
- [ ] Definitions have stable identifiers.
- [ ] Trigger processing is event-driven.
- [ ] Eligibility evaluation is deterministic.
- [ ] Prerequisites and repeat policies work.
- [ ] Tutorial prioritization is implemented.
- [ ] Queue management is implemented.
- [ ] Only one blocking tutorial can be presented at a time.
- [ ] Presentation is deferred during unsafe movement states.
- [ ] Acknowledgement and dismissal are distinct.
- [ ] Tutorial history is persisted through Save System.
- [ ] Persistence failures do not break gameplay.
- [ ] Familiarity tracking is implemented.
- [ ] Training and Prologue integrations work.
- [ ] Training objectives and hints are not duplicated.
- [ ] Input labels use Input System bindings.
- [ ] All player-facing text uses Localization System.
- [ ] Accessibility settings are respected.
- [ ] HUD owns all rendering.
- [ ] Session and attempt correlation prevent stale tutorials.
- [ ] Debugging and diagnostics are available.
- [ ] Automated tests cover core behavior and integrations.

---

## 26. Final Design Constraints

The implementation agent must follow these constraints:

1. Do not merge Tutorial System with Training System.
2. Do not implement a second Training hint mechanism.
3. Do not evaluate Training objectives inside Tutorial System.
4. Do not implement movement or input processing.
5. Do not render tutorial UI directly.
6. Do not access IndexedDB directly.
7. Do not introduce hardcoded player-facing strings.
8. Do not use tutorial acknowledgement as proof of mechanic mastery.
9. Do not block parkour movement with ordinary tutorials.
10. Do not interrupt active Speedrun attempts with blocking tutorials.
11. Do not allow stale events from previous sessions to activate tutorials.
12. Do not modify authoritative gameplay events.
13. Do not introduce per-frame tutorial polling.
14. Do not make tutorial failures fatal to gameplay.
15. Do not introduce an unnecessary general-purpose dialogue engine.
16. Keep tutorial content data-driven and independently testable.
17. Keep all gameplay decisions in their owning systems.
18. Use Save System for persistence and Localization System for text.
19. Use Accessibility System for effective accessibility configuration.
20. Preserve compatibility with future tutorial sequences without implementing them prematurely.

**The Tutorial System is responsible for deciding when and how instructional guidance should be offered. It must never become responsible for teaching through gameplay evaluation, implementing mechanics, or controlling the player.**