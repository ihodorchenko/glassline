# 23_HUD_SYSTEM_SPEC.md

# HUD System Specification

**Project:** Glassline — First-Person Parkour Game  
**Document:** HUD System  
**Version:** 1.0  
**Status:** Implementation Specification  
**Priority:** Core Gameplay System

---

## 1. Purpose

The HUD System manages the in-game heads-up display during active gameplay.

It presents essential gameplay information without obstructing the first-person view or distracting the player from movement and environmental navigation.

The HUD is a presentation layer that aggregates information from gameplay systems and displays it using a consistent visual language.

The primary design goal is:

**Show only the information that helps the player make an immediate gameplay decision.**

The HUD must support:

- Normal gameplay.
- Training exercises.
- Prologue progression.
- Speedrun sessions.
- Checkpoint feedback.
- Interaction prompts.
- Gameplay state transitions.
- Pause and recovery transitions.
- Accessibility settings.

The initial implementation should provide a complete but deliberately minimal HUD.

---

## 2. Design Philosophy

### 2.1 Minimalism

The HUD should occupy as little screen space as possible.

The player should spend most of their attention on the environment.

Avoid persistent decorative panels, unnecessary labels, excessive icons, and large opaque backgrounds.

### 2.2 Contextual Information

HUD elements should appear only when relevant.

Examples:

- A speed indicator may be visible during movement-focused gameplay.
- A checkpoint notification appears after checkpoint activation.
- An interaction prompt appears when a valid target is selected.
- Training objectives remain visible while an exercise is active.
- Speedrun timing is visible only during an active or recently completed run.

### 2.3 Consistent Visual Language

The HUD follows the visual identity established in `07_UI_UX_SPEC.md`.

Core visual characteristics:

- White and light neutral typography.
- Red as the primary accent.
- Dark translucent backgrounds only when necessary.
- Strong geometric typography.
- Clear alignment and spacing.
- Minimal borders.
- No excessive gradients.
- No unnecessary rounded cards.
- Subtle motion and transitions.

### 2.4 Gameplay First

HUD animations must never interfere with:

- Player input.
- Movement.
- Camera control.
- Interaction detection.
- Collision.
- Speedrun timing.
- Gameplay simulation.

HUD presentation must be independent of gameplay simulation timing.

### 2.5 Accessibility

The HUD must support:

- Reduced Motion.
- Configurable visibility where appropriate.
- Readable typography.
- Sufficient contrast.
- Non-color-only status communication.
- Scalable UI.
- Safe-area handling.

---

## 3. Scope and Ownership

### 3.1 HUD Responsibilities

The HUD System owns:

- In-game HUD composition.
- HUD element lifecycle.
- HUD visibility.
- Context-dependent presentation.
- HUD layout.
- HUD element priority.
- HUD animation.
- HUD presentation state.
- Data binding to gameplay systems.
- HUD-specific accessibility behavior.
- HUD presentation configuration resolved from Settings.
- Debug HUD mode.

### 3.2 HUD Does Not Own

The HUD System does not own:

- Gameplay rules.
- Movement calculations.
- Speedrun timing.
- Checkpoint activation.
- Respawn logic.
- Training objectives.
- Interaction target detection.
- Player state.
- Input processing.
- Camera effects.
- Audio playback.
- Application navigation.
- Persistent settings storage.
- Runner Vision route target selection.
- Localized text resources.

### 3.3 Related Specifications

- `02_TECHNICAL_ARCHITECTURE.md`
- `03_GAMEPLAY_SPEC.md`
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
- `21_TRAINING_SYSTEM_SPEC.md`
- `22_PROGRESSION_SYSTEM_SPEC.md`
- `24_MENU_SYSTEM_SPEC.md`
- `25_SETTINGS_SYSTEM_SPEC.md`
- `26_ACCESSIBILITY_SYSTEM_SPEC.md`
- `27_LOCALIZATION_SYSTEM_SPEC.md`
- `29_ACHIEVEMENT_SYSTEM_SPEC.md`

---

## 4. HUD Architecture

### 4.1 Core Components

The initial implementation should contain:

- `HUDManager`
- `HUDCoordinator`
- `HUDStateProvider`
- `HUDLayoutManager`
- `HUDVisibilityController`
- `HUDPresentationController`
- `HUDEventProcessor`
- `HUDPriorityResolver`
- `HUDConfiguration`
- `HUDAccessibilityController`
- `HUDView`
- `HUDWidgetRegistry`

Individual widgets:

- `SpeedIndicatorWidget`
- `SpeedrunTimerWidget`
- `SpeedrunSplitWidget`
- `CheckpointFeedbackWidget`
- `InteractionPromptWidget`
- `TrainingObjectiveWidget`
- `TrainingHintWidget`
- `TutorialGuidanceWidget`
- `SectionProgressWidget`
- `DirectionIndicatorWidget`
- `RunnerVisionIndicatorWidget`
- `GameplayStatusWidget`
- `CrosshairWidget` (optional and disabled by default)
- `HUDNotificationWidget`

### 4.2 Architecture Responsibilities

**HUDManager**

Public entry point for HUD lifecycle and configuration.

**HUDCoordinator**

Coordinates HUD state with Gameplay Flow and Gameplay Session.

**HUDStateProvider**

Builds the current immutable presentation state from authoritative domain data.

**HUDLayoutManager**

Determines widget placement and available screen space.

**HUDVisibilityController**

Determines which widgets are currently visible.

**HUDPresentationController**

Handles widget transitions, animations, and temporary presentation.

**HUDEventProcessor**

Processes gameplay events that produce HUD feedback.

**HUDPriorityResolver**

Resolves conflicts between simultaneous HUD elements.

**HUDConfiguration**

Stores the resolved runtime HUD configuration provided by the Settings System.

It does not own persisted preferences or write settings storage.

**HUDAccessibilityController**

Applies accessibility-related presentation changes.

**HUDView**

Root visual container for gameplay HUD.

**HUDWidgetRegistry**

Registers and manages available HUD widgets.

### 4.3 Domain Ownership

Widgets must receive presentation data from their owning systems.

Examples:

| HUD element | Authoritative source |
|---|---|
| Player speed | Movement System |
| Movement state | Movement System / Player State |
| Run timer | Speedrun System |
| Splits | Speedrun System |
| Checkpoint activation | Checkpoint System |
| Interaction prompt | Interaction System |
| Training objective | Training System |
| Training hint | Training System |
| Tutorial guidance | Tutorial System (`28_TUTORIAL_SYSTEM_SPEC.md`) |
| Section information | Level Runtime |
| Direction indicator | Level Runtime (navigation hints authored per `06_LEVEL_DESIGN_SPEC.md`) |
| Runner Vision highlight | Level Runtime (navigation hints authored per `06_LEVEL_DESIGN_SPEC.md`) |
| Gameplay status | Gameplay Session / Player State |
| Content unlock notification | Progression System |
| Achievement unlock notification | Achievement System |

The HUD must never calculate authoritative gameplay results itself.

The HUD must not select Runner Vision targets or infer route guidance; it presents highlight state derived from level-authored navigation hints. Presentation requirements for Runner Vision are defined in `07_UI_UX_SPEC.md`.

---

## 5. HUD Lifecycle

### 5.1 Lifecycle States

```ts
type HUDLifecycleState =
    | "uninitialized"
    | "initializing"
    | "ready"
    | "visible"
    | "hidden"
    | "suspended"
    | "destroyed";
```

### 5.2 Initialization

During initialization:

1. Create the HUD root container.
2. Register supported widgets.
3. Load the resolved HUD configuration from the Settings System.
4. Subscribe to relevant domain events.
5. Resolve the current gameplay context.
6. Build the initial HUD snapshot.
7. Apply visibility rules.
8. Enter the ready state.

The HUD must not subscribe to domain events multiple times during repeated activation.

### 5.3 Activation

When gameplay becomes active:

- Enable relevant widgets.
- Resolve the current mode.
- Subscribe or activate presentation bindings.
- Apply the latest domain snapshot.
- Display the appropriate HUD layout.

### 5.4 Suspension

The HUD must be suspended when gameplay presentation is temporarily unavailable.

Examples:

- Pause menu.
- Blocking dialog.
- Gameplay loading.
- Session teardown.
- Full-screen results screen.

Suspension does not necessarily mean destroying the HUD.

### 5.5 Destruction

When the gameplay session is unloaded:

- Remove event subscriptions.
- Cancel temporary notifications.
- Cancel pending presentation animations.
- Release widget resources.
- Clear session-specific presentation data.
- Destroy the HUD root when appropriate.

Stale events from an earlier session must not affect a newly created HUD.

---

## 6. HUD Layout

### 6.1 General Layout

The HUD should use a small number of stable screen regions.

Recommended layout:

```text
+------------------------------------------------------+
|                                                      |
|  SECTION / OBJECTIVE                SPEEDRUN TIMER   |
|                                                      |
|                                                      |
|                                                      |
|                                                      |
|                                                      |
|                   INTERACTION                        |
|                     PROMPT                           |
|                                                      |
|                                                      |
|                                                      |
|  SPEED / MOVEMENT                    NOTIFICATIONS   |
+------------------------------------------------------+
```

This is a logical layout, not a requirement for fixed pixel coordinates.

### 6.2 Layout Regions

**Top Left**

- Current section.
- Active Training objective.
- Optional contextual objective information.

**Top Right**

- Speedrun timer.
- Current split.
- Compact run status.

**Center**

- Interaction prompt.
- Optional contextual feedback.
- No permanent large crosshair.

**Bottom Left**

- Speed indicator.
- Optional movement state feedback.

**Bottom Right**

- Temporary notifications.
- Checkpoint feedback.
- Achievement notifications.

### 6.3 Safe Areas

The HUD must respect:

- Browser viewport boundaries.
- Desktop window resizing.
- Device safe areas where applicable.
- UI scaling.
- Minimum supported viewport dimensions.

HUD positioning must be responsive.

### 6.4 Viewport Adaptation

For smaller viewports:

1. Reduce secondary information.
2. Collapse non-essential widgets.
3. Preserve critical interaction prompts.
4. Preserve active Training objectives.
5. Preserve Speedrun timer visibility during Speedrun.
6. Avoid overlapping the center of the view.

The system must not solve layout conflicts by shrinking all text below readable sizes.

---

## 7. HUD Visibility Model

### 7.1 Visibility Context

```ts
interface HUDVisibilityContext {
    gameplayMode: "training" | "prologue" | "unknown";

    sessionActive: boolean;

    playerAvailable: boolean;

    paused: boolean;

    respawning: boolean;

    blockingOverlayVisible: boolean;

    speedrunActive: boolean;

    trainingExerciseActive: boolean;
}
```

The context is derived from authoritative owner snapshots and events (Gameplay Session, Player State, Respawn, Speedrun, Training, Gameplay Flow). The HUD must not maintain independent gameplay equivalents of these states; they are presentation inputs only.

### 7.2 Visibility Rules

| Context | HUD behavior |
|---|---|
| Main Menu | Hidden |
| Loading | Hidden or minimal loading presentation owned by Flow |
| Ready | Minimal contextual HUD |
| Active Training | Training HUD |
| Active Prologue | Standard gameplay HUD |
| Active Speedrun | Speedrun HUD |
| Pause | Suspended or hidden |
| Respawning | Temporarily suppressed |
| Results | Hidden |
| Gameplay Complete | Hidden or final feedback only |
| Session Unloaded | Destroyed |

### 7.3 Widget Visibility

Each widget must define:

- Required context.
- Optional context.
- Visibility priority.
- Minimum viewport requirements.
- Whether it may be suppressed.
- Whether it is persistent or temporary.

Visibility must be derived from context, not controlled through unrelated boolean flags spread across widgets.

### 7.4 Manual Visibility

The initial implementation may provide:

- HUD enabled/disabled.
- Speed indicator visibility.
- Training objective visibility.
- Optional section label visibility.

Core critical information must remain available where required by gameplay.

---

## 8. Speed Indicator Widget

### 8.1 Purpose

Displays the player's current movement speed.

It supports movement awareness and speedrun feedback.

### 8.2 Data Source

Movement System.

The HUD must consume the speed value provided by Movement.

It must not calculate speed from player transforms or input values.

### 8.3 Data Model

```ts
interface SpeedIndicatorData {
    currentSpeed: number;

    normalizedSpeed?: number;

    movementState: string;

    isGrounded: boolean;
}
```

### 8.4 Presentation

The indicator should be compact.

Possible presentation:

```text
SPEED
8.4 m/s
```

The unit must be consistent across the application.

The initial implementation uses meters per second.

### 8.5 Visual Feedback

Optional accent changes may communicate:

- Walking.
- Running.
- Sprinting.
- Sliding.
- Wall running.

Avoid excessive color changes or flashing.

### 8.6 Update Frequency

The displayed value should update smoothly.

The HUD may interpolate presentation values, but must not modify the authoritative speed value.

Avoid unnecessary per-frame UI reconstruction.

### 8.7 Visibility

The speed indicator may be enabled by default.

It may be hidden in standard gameplay if the visual design benefits from a cleaner view.

It should remain available in Training and Speedrun configurations.

---

## 9. Speedrun Timer Widget

### 9.1 Purpose

Displays the active Speedrun timer.

### 9.2 Data Source

Speedrun System.

The HUD must never own the timer or calculate elapsed run time.

### 9.3 Data Model

```ts
interface SpeedrunTimerData {
    runId: string;

    elapsedMilliseconds: number;

    state: string;

    currentCheckpointId?: string;

    currentSplitIndex?: number;

    isValid: boolean;
}
```

### 9.4 Display Format

Recommended format:

```text
00:42.583
```

Formatting requirements:

- Minutes.
- Seconds.
- Milliseconds.
- Leading zeroes.
- Stable width where possible.

### 9.5 Timer Behavior

- Idle: hidden.
- Preparing: optional countdown presentation.
- Ready: show ready state if configured.
- Running: continuously display authoritative elapsed time.
- Checkpoint: preserve timer visibility.
- Finished: show final time.
- Failed: show invalid/failed status.
- Abandoned: hide after transition.

### 9.6 Performance

Timer updates must not create unnecessary allocations or expensive UI updates.

Display precision may be lower than internal timer precision.

The Speedrun System remains responsible for exact timing.

---

## 10. Speedrun Split Widget

### 10.1 Purpose

Displays the latest split and optional comparison against the personal best.

### 10.2 Data Source

Speedrun System.

### 10.3 Data Model

```ts
interface SpeedrunSplitData {
    checkpointId: string;

    checkpointName: string;

    splitMilliseconds: number;

    cumulativeMilliseconds: number;

    personalBestDelta?: number;

    status: "ahead" | "behind" | "neutral";
}
```

### 10.4 Presentation

The split should appear briefly after a valid checkpoint event.

Example:

```text
INDUSTRIAL
+00:01.240
```

Use color and a textual or symbolic indicator together.

Do not rely on color alone to communicate ahead/behind status.

### 10.5 Visibility Duration

Recommended initial display duration: 2 seconds.

The duration is configurable.

A new split may replace an existing split notification.

### 10.6 Invalid Splits

Invalid or rejected checkpoint events must not display successful split feedback.

---

## 11. Checkpoint Feedback Widget

### 11.1 Purpose

Communicates successful checkpoint activation.

### 11.2 Data Source

Checkpoint System.

### 11.3 Data Model

```ts
interface CheckpointFeedbackData {
    checkpointId: string;

    checkpointName: string;

    activatedAt: number;

    isNewActivation: boolean;
}
```

### 11.4 Presentation

Example:

```text
CHECKPOINT
INDUSTRIAL
```

The presentation should be brief and visually clear.

### 11.5 Animation

Recommended sequence:

1. Fade in.
2. Brief emphasis.
3. Fade out.

Avoid large screen-covering animations.

### 11.6 Duplicate Activation

Repeated activation events must not create repeated notifications unless the Checkpoint System explicitly identifies a meaningful new activation.

### 11.7 Speedrun Interaction

When Speedrun is active, checkpoint feedback may be combined with split feedback.

The HUD must avoid showing two large notifications in the same location.

---

## 12. Interaction Prompt Widget

### 12.1 Purpose

Displays the currently selected interaction target.

### 12.2 Data Source

Interaction System.

### 12.3 Data Model

```ts
interface InteractionPromptData {
    targetId: string;

    title: string;

    description?: string;

    actionLabel: string;

    inputAction: string;

    priority: number;

    available: boolean;
}
```

### 12.4 Presentation

Example:

```text
E
INTERACT
```

Optional title:

```text
TRAINING TERMINAL
E  INTERACT
```

### 12.5 Input Labels

The HUD must not hardcode keyboard or gamepad labels.

Input System provides the current binding label for an abstract action.

For example:

- Keyboard: `E`
- Gamepad: corresponding mapped button label.

### 12.6 Visibility

The prompt appears only when a valid target is selected.

It disappears when:

- The target becomes invalid.
- The player leaves interaction range.
- The player cannot interact.
- A blocking UI overlay appears.
- Gameplay is suspended.
- The target is destroyed or unregistered.

### 12.7 Hold Interactions

The initial implementation may support simple press interactions.

The architecture should allow future hold-progress presentation without requiring changes to the interaction detection system.

---

## 13. Training Objective Widget

### 13.1 Purpose

Displays the current Training exercise objective.

### 13.2 Data Source

Training System.

### 13.3 Data Model

```ts
interface TrainingObjectiveHUDData {
    exerciseId: string;

    exerciseTitle: string;

    objectiveTitle: string;

    description?: string;

    currentProgress?: number;

    targetProgress?: number;

    status: string;

    isPrimary: boolean;
}
```

### 13.4 Presentation

Example:

```text
OBJECTIVE

Reach the opposite rooftop
```

Optional progress:

```text
2 / 3
```

### 13.5 Objective Updates

The widget updates when:

- Exercise starts.
- Objective changes.
- Progress changes.
- Objective completes.
- Exercise completes.
- Exercise fails.
- Exercise restarts.

### 13.6 Multiple Objectives

The initial implementation should display:

- One primary objective.
- Optional compact secondary objective information.

Do not display every objective as a large persistent list.

### 13.7 Completion Feedback

When an objective is completed:

- Briefly emphasize its completed state.
- Allow Training to provide the next objective.
- Avoid permanently retaining completed objectives in the active HUD.

---

## 14. Training Hint Widget

### 14.1 Purpose

Displays contextual Training instructions and hints.

### 14.2 Data Source

Training System.

### 14.3 Presentation

Example:

```text
HINT

Hold Sprint while approaching the gap.
```

### 14.4 Behavior

Hints may be:

- Automatically presented.
- Triggered by exercise state.
- Requested by the player.
- Repeated after a configurable interval.

The Training System determines when a hint is relevant.

HUD only presents it.

### 14.5 Priority

Hints are secondary to:

- Critical interaction prompts.
- Active objective changes.
- Checkpoint feedback.
- Respawn presentation.

### 14.6 Dismissal

A hint may be dismissed where the Training design allows it.

Dismissal must not alter exercise objectives or completion conditions.

---

## 15. Section Progress Widget

### 15.1 Purpose

Displays the current Prologue section.

### 15.2 Data Source

Level Runtime.

### 15.3 Data Model

```ts
interface SectionProgressHUDData {
    levelId: string;

    sectionId: string;

    sectionName: string;

    sectionIndex: number;

    totalSections: number;
}
```

### 15.4 Prologue Sections

The initial section sequence is:

1. Rooftop.
2. Industrial.
3. Construction.
4. Skybridge.
5. Finish.

### 15.5 Presentation

Example:

```text
PROLOGUE
02 / 05
INDUSTRIAL
```

### 15.6 Visibility

The section label should be displayed:

- At the beginning of a section.
- During a section transition.
- When the player requests contextual information, if supported.

It should not remain visually dominant throughout gameplay.

---

## 16. Gameplay Status Widget

### 16.1 Purpose

Displays brief contextual status information.

Examples:

- Ready.
- Paused.
- Respawning.
- Session complete.
- Run failed.

### 16.2 Data Source

Gameplay Session, Player State, Gameplay Flow, and Respawn System.

### 16.3 Ownership

The widget does not determine gameplay status.

It only presents an already-resolved status.

### 16.4 Visibility

Major states such as Pause and Results are normally represented by their dedicated screens.

The HUD should not duplicate those screens with large status labels.

The widget is intended for short transitions and lightweight contextual feedback.

---

## 17. HUD Notifications

### 17.1 Purpose

Displays short-lived gameplay notifications.

Examples:

- Checkpoint activated.
- Objective completed.
- Achievement unlocked.
- New section entered.
- Training exercise completed.
- Contextual tutorial guidance requested by the Tutorial System.
- Speedrun split recorded.

### 17.2 Data Model

```ts
interface HUDNotification {
    id: string;

    category: HUDNotificationCategory;

    title: string;

    message?: string;

    priority: number;

    durationMilliseconds: number;

    createdAt: number;

    deduplicationKey?: string;
}
```

```ts
type HUDNotificationCategory =
    | "checkpoint"
    | "objective"
    | "achievement"
    | "section"
    | "speedrun"
    | "tutorial"
    | "system";
```

Tutorial guidance presentation requests include the Tutorial System's presentation model (content, priority, dismissal and acknowledgement metadata). The HUD owns rendering, layout, animation, and visibility; it must not decide tutorial eligibility or lifecycle.

### 17.3 Notification Queue

The HUD must use a centralized notification queue.

Requirements:

- Prevent notification overlap.
- Deduplicate repeated events.
- Respect priority.
- Support replacement of lower-priority notifications.
- Expire notifications automatically.
- Clear session-scoped notifications on session teardown.

### 17.4 Priority Rules

Recommended initial priority:

| Priority | Notification |
|---|---|
| Critical | Gameplay recovery or system error |
| High | Checkpoint activation, objective completion |
| Medium | Achievement unlock, section transition |
| Low | Optional information and hints |

A critical notification may temporarily replace a lower-priority notification.

### 17.5 Notification Overflow

If multiple notifications arrive simultaneously:

1. Display the highest-priority notification.
2. Queue eligible remaining notifications.
3. Discard expired low-priority notifications.
4. Merge notifications where the content and event semantics allow it.

Never delay critical gameplay feedback indefinitely.

---

## 18. HUD Priority Resolution

### 18.1 Purpose

Multiple gameplay systems may request HUD presentation simultaneously.

The HUD must resolve conflicts centrally.

### 18.2 Priority Categories

Recommended presentation order:

1. Critical system feedback.
2. Respawn/recovery feedback.
3. Interaction prompt.
4. Checkpoint and Speedrun split feedback.
5. Primary Training objective.
6. Training hint.
7. Section label.
8. Optional speed information.
9. Decorative or secondary information.

This is a presentation priority, not a gameplay priority.

### 18.3 Spatial Conflict Resolution

Widgets should declare their preferred region.

The layout manager must avoid overlapping widgets.

Possible strategies:

- Move secondary widgets.
- Temporarily hide low-priority widgets.
- Combine related notifications.
- Use compact variants.

### 18.4 Non-Blocking Behavior

Priority resolution must never block gameplay or delay domain event processing.

---

## 19. Animation and Motion

### 19.1 General Rules

HUD animations should be short, restrained, and consistent.

Use animation to communicate:

- Appearance.
- Disappearance.
- State change.
- Progress.
- Confirmation.
- Important feedback.

Avoid continuous decorative animation.

### 19.2 Recommended Timing

| Animation | Duration |
|---|---:|
| Widget fade in | 150–200 ms |
| Widget fade out | 120–180 ms |
| Notification appearance | 180–250 ms |
| Objective transition | 200–300 ms |
| Checkpoint feedback | 250–350 ms |
| Progress indicator update | 150–250 ms |

These values are initial tuning targets.

### 19.3 Reduced Motion

When Reduced Motion is enabled:

- Remove unnecessary sliding transitions.
- Avoid scaling effects.
- Minimize pulsing.
- Prefer simple opacity changes.
- Avoid flashing or repeated emphasis.

### 19.4 Animation Interruption

Animations must be interruptible.

A new state must not wait for an old animation to finish.

When a widget is removed or its session ends, pending animations must be cancelled safely.

---

## 20. Accessibility and Configuration

### 20.1 HUD Settings

Initial configuration:

```ts
interface HUDConfiguration {
    enabled: boolean;

    showSpeedIndicator: boolean;

    showSpeedrunTimer: boolean;

    showSectionProgress: boolean;

    showTrainingObjectives: boolean;

    showTrainingHints: boolean;

    showInteractionPrompts: boolean;

    uiScale: number;

    reducedMotion: boolean;
}
```

Settings values are owned by the Settings System (`25_SETTINGS_SYSTEM_SPEC.md`) and provided to the HUD as a resolved configuration snapshot. Persistence is owned by the Save System (`10_SAVE_SYSTEM_SPEC.md`).

The HUD must not maintain a second settings store, write persistence directly, or reinterpret raw user preferences outside the shared accessibility configuration.

All user-facing HUD text is resolved through the Localization System (`27_LOCALIZATION_SYSTEM_SPEC.md`); widgets must not hardcode display strings.

### 20.2 UI Scale

Recommended supported range:

```text
0.80 – 1.40
```

Default:

```text
1.00
```

The exact range may be adjusted based on viewport testing.

### 20.3 Contrast

All essential HUD text must remain readable against the game environment.

Use a subtle background, shadow, or outline only when necessary.

Avoid permanently displaying large opaque panels.

### 20.4 Color Semantics

The visual language should remain consistent:

- White: neutral information.
- Red: important emphasis or active objective.
- Green: success, where appropriate.
- Amber: warning or caution.
- Gray: secondary information.

Color must not be the only way to communicate meaning.

---

## 21. Input and Interaction

### 21.1 Input Ownership

HUD must not read keyboard or gamepad events directly.

Input System provides abstract actions and binding labels.

### 21.2 HUD Interaction

The initial HUD is primarily informational.

Optional interactions may include:

- Dismissing a hint.
- Requesting another hint.
- Showing optional status information.

These actions must be routed through Input System and the relevant domain owner.

### 21.3 Pointer Lock

The HUD must not unexpectedly release pointer lock.

UI interactions requiring a visible pointer must be coordinated with Gameplay Flow and Input System.

---

## 22. Performance Requirements

The HUD must remain lightweight.

Requirements:

- No gameplay calculations.
- No expensive layout recomputation every frame.
- No unnecessary widget creation.
- No repeated subscription registration.
- No unbounded notification queues.
- No memory leaks from event listeners.
- No animation timers surviving session teardown.
- Efficient text formatting.
- Smooth presentation during high-speed movement.

High-frequency movement updates should use a presentation update strategy appropriate to the UI framework.

The HUD does not need to render every internal physics update.

A lower display refresh frequency is acceptable if visual feedback remains smooth.

---

## 23. Debug HUD

### 23.1 Purpose

Development builds may include a debug HUD.

It must not be confused with the production HUD.

### 23.2 Debug Information

Optional values:

- Current Movement State.
- Current speed.
- Grounded state.
- Active checkpoint.
- Active section.
- Current session ID.
- Current gameplay mode.
- Respawn state.
- Selected interaction target.
- Active Training exercise.
- Speedrun state.
- HUD widget visibility.
- Current HUD priority queue.

### 23.3 Activation

Debug HUD should be available only in development builds or through an explicit developer configuration.

It must not be enabled accidentally in production.

### 23.4 Ownership

Debug HUD is a presentation tool.

It must not modify gameplay state.

---

## 24. Testing Requirements

### 24.1 Lifecycle Tests

Test:

- Initialization.
- Activation.
- Suspension.
- Resume.
- Destruction.
- Repeated initialization.
- Session transition.
- Stale event rejection.

### 24.2 Widget Tests

Test:

- Speed display.
- Timer formatting.
- Split presentation.
- Checkpoint feedback.
- Interaction prompt.
- Training objective.
- Training hint.
- Section progress.
- Achievement notification.

### 24.3 Visibility Tests

Test every relevant combination:

- Training.
- Prologue.
- Speedrun.
- Pause.
- Loading.
- Respawning.
- Results.
- Session unload.
- Blocking overlays.

### 24.4 Priority Tests

Test:

- Simultaneous checkpoint and split events.
- Interaction prompt during objective update.
- Achievement during checkpoint feedback.
- Critical recovery during low-priority notification.
- Multiple notifications in one frame.
- Notification deduplication.
- Notification queue overflow.

### 24.5 Accessibility Tests

Test:

- Reduced Motion.
- UI scaling.
- Small viewport.
- High contrast backgrounds.
- Color-independent status.
- Readable text.
- Safe areas.

### 24.6 Performance Tests

Test:

- High-frequency speed updates.
- Timer updates.
- Repeated objective progress updates.
- Large notification bursts.
- Rapid session transitions.
- Widget creation and destruction.
- Event subscription cleanup.

### 24.7 Integration Tests

Verify:

- Movement provides speed data.
- Speedrun provides authoritative timer and split data.
- Checkpoint System provides activation events.
- Interaction System provides prompt data.
- Training provides objectives and hints.
- Level Runtime provides section information.
- Level data provides Runner Vision and direction hints.
- Progression provides content unlock events.
- Achievement System provides achievement unlock events.
- Respawn System provides recovery state.
- Gameplay Flow controls HUD visibility.

---

## 25. Implementation Phases

### Phase 1: HUD Foundation

Implement:

- HUDManager.
- HUDCoordinator.
- HUDView.
- HUDStateProvider.
- HUDWidgetRegistry.
- HUDVisibilityController.
- Basic lifecycle.

### Phase 2: Layout and Configuration

Implement:

- Responsive layout.
- HUD regions.
- Safe-area support.
- HUD configuration.
- UI scaling.
- Reduced Motion integration.

### Phase 3: Core Gameplay Widgets

Implement:

- SpeedIndicatorWidget.
- InteractionPromptWidget.
- SectionProgressWidget.
- GameplayStatusWidget.

### Phase 4: Speedrun Widgets

Implement:

- SpeedrunTimerWidget.
- SpeedrunSplitWidget.
- CheckpointFeedbackWidget.
- Combined split/checkpoint presentation.

### Phase 5: Training Widgets

Implement:

- TrainingObjectiveWidget.
- TrainingHintWidget.
- Exercise completion feedback.

### Phase 6: Notifications

Implement:

- HUDNotificationWidget.
- Notification queue.
- Deduplication.
- Priority resolution.
- Session-scoped cleanup.

### Phase 7: Accessibility and Polish

Implement:

- Reduced Motion.
- UI scaling.
- Contrast adjustments.
- Responsive behavior.
- Animation interruption.
- Viewport testing.

### Phase 8: Debugging and Validation

Implement:

- Debug HUD.
- Lifecycle diagnostics.
- Widget visibility diagnostics.
- Integration tests.
- Performance tests.

---

## 26. Acceptance Criteria

The implementation is accepted when:

1. HUD has a single root presentation layer.
2. HUD lifecycle follows gameplay lifecycle.
3. Widgets do not own gameplay rules.
4. All authoritative data comes from domain systems.
5. HUD does not calculate player speed.
6. HUD does not calculate Speedrun time.
7. HUD does not validate checkpoints.
8. HUD does not evaluate Training objectives.
9. Interaction prompts use Input System binding labels.
10. HUD visibility is context-driven.
11. Pause and results transitions suppress inappropriate gameplay widgets.
12. Notifications are centrally managed.
13. Notification priority prevents important feedback from being hidden.
14. Simultaneous events do not create overlapping UI.
15. Session teardown removes all subscriptions and temporary state.
16. HUD supports responsive layouts.
17. HUD supports UI scaling.
18. HUD supports Reduced Motion.
19. Essential information does not rely exclusively on color.
20. Debug HUD is separated from production HUD.
21. High-frequency updates do not cause unnecessary rendering work.
22. HUD settings come from the Settings System and persist through the Save System.
23. HUD text is resolved through the Localization System.
24. Runner Vision and direction presentation consume level-authored hints without selecting targets.
25. Unit and integration tests pass.

---

## 27. Definition of Done

- [ ] HUD architecture implemented.
- [ ] HUD lifecycle implemented.
- [ ] HUD root view implemented.
- [ ] Widget registry implemented.
- [ ] Visibility controller implemented.
- [ ] Layout manager implemented.
- [ ] Priority resolver implemented.
- [ ] Speed indicator implemented.
- [ ] Speedrun timer implemented.
- [ ] Speedrun split implemented.
- [ ] Checkpoint feedback implemented.
- [ ] Interaction prompt implemented.
- [ ] Training objective widget implemented.
- [ ] Training hint widget implemented.
- [ ] Section progress widget implemented.
- [ ] Gameplay status widget implemented.
- [ ] Notification queue implemented.
- [ ] Notification deduplication implemented.
- [ ] Accessibility integration implemented.
- [ ] UI scaling implemented.
- [ ] Responsive layout implemented.
- [ ] Session lifecycle integration implemented.
- [ ] Input binding label integration implemented.
- [ ] Debug HUD implemented.
- [ ] Event subscriptions cleaned up correctly.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Performance tests pass.
- [ ] No duplicated domain ownership exists.
- [ ] Visual design follows `07_UI_UX_SPEC.md`.

---

## 28. Final Design Constraints

1. HUD is a presentation-only system.
2. HUD must not own gameplay state.
3. HUD must not implement gameplay rules.
4. HUD must consume authoritative domain data.
5. HUD must remain minimal and contextual.
6. HUD must not obstruct first-person navigation.
7. HUD must not duplicate Pause, Results, or Main Menu screens.
8. HUD must use a centralized widget lifecycle.
9. HUD visibility must be derived from gameplay context.
10. HUD notifications must use a centralized queue.
11. Notification priority must be deterministic.
12. HUD animations must be interruptible.
13. Session teardown must remove all temporary HUD state.
14. Input labels must come from Input System.
15. Speed values must come from Movement System.
16. Timer values must come from Speedrun System.
17. Checkpoint feedback must come from Checkpoint System.
18. Interaction prompts must come from Interaction System.
19. Training objectives must come from Training System.
20. Section information must come from Level Runtime.
21. Runner Vision and direction hints must come from level-authored navigation data.
22. Content unlock notifications must come from Progression System.
23. Achievement notifications must come from Achievement System.
24. Respawn presentation must not duplicate Respawn System logic.
25. HUD settings must come from Settings System and be persisted by Save System.
26. Accessibility behavior must follow `26_ACCESSIBILITY_SYSTEM_SPEC.md` and the effective accessibility configuration.
27. HUD text must be resolved through Localization System.
28. Debug information must remain separate from production presentation.
29. HUD must not introduce unnecessary gameplay dependencies.
30. The visual hierarchy must prioritize gameplay readability over information density.

**End of Specification**