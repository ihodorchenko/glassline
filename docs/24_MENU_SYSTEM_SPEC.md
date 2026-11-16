# 24_MENU_SYSTEM_SPEC.md

# Menu System Specification

**Project:** Mirror's Edge-Inspired First-Person Parkour Game  
**Document:** Menu System  
**Version:** 1.0  
**Status:** Implementation Specification  
**Priority:** Core UI System

---

## 1. Purpose

The Menu System defines the structure, content, behavior, and interaction rules of the game's non-HUD screens.

It provides the player's primary interface for navigating game modes, starting gameplay, configuring settings, viewing results, and managing progression-related information.

The Menu System must provide a consistent experience across all application states.

It covers:

- Main Menu.
- Mode Selection.
- Training Selection.
- Prologue Introduction.
- Loading Presentation.
- Ready Screen.
- Pause Menu.
- Settings.
- Results.
- Confirmation Dialogs.
- Error and Recovery Screens.
- Optional Progression and Achievement screens.

The system must be modular enough to support additional screens without introducing a new navigation architecture.

---

## 2. Design Philosophy

### 2.1 Visual Identity

The Menu System follows the visual language defined in `07_UI_UX_SPEC.md`.

The main characteristics are:

- Minimalist composition.
- White and light neutral backgrounds where appropriate.
- Strong black typography.
- Red as the primary accent.
- Large editorial headings.
- Geometric typography.
- Generous whitespace.
- Thin separators.
- Minimal decorative elements.
- Restrained transitions.

The visual identity should evoke the clean, high-contrast interface language of the first Mirror's Edge without reproducing its proprietary assets or exact layouts.

### 2.2 Functional Clarity

Every screen must have a clear purpose.

The player should understand:

- Where they are.
- What they can do.
- What action will happen next.
- How to return to the previous context.

Avoid unnecessary navigation levels.

### 2.3 Fast Navigation

The player should be able to:

- Start Training quickly.
- Enter the Prologue quickly.
- Resume an active session.
- Restart a level.
- Return to the Main Menu.
- Change settings without losing context.

### 2.4 Consistency

All menus must use shared:

- Typography.
- Spacing.
- Button styles.
- Focus states.
- Transitions.
- Dialog behavior.
- Input handling.
- Accessibility rules.

Individual screens must not implement their own unrelated visual systems.

---

## 3. Scope and Ownership

### 3.1 Menu System Responsibilities

The Menu System owns:

- Screen definitions.
- Screen layouts.
- Screen-specific presentation.
- Menu component composition.
- Menu interaction behavior.
- Menu-local view state.
- Navigation intent generation.
- Menu input presentation.
- Menu validation messages.
- Dialog content.
- Screen transition presentation.
- Responsive menu layouts.

### 3.2 Non-responsibilities

The Menu System does not own:

- Application navigation state.
- Gameplay session lifecycle.
- Level loading.
- Player movement.
- Respawn.
- Training exercise execution.
- Speedrun validation.
- Progression rules.
- Persistence infrastructure.
- Input device processing.
- HUD presentation.

### 3.3 Related Specifications

- `02_TECHNICAL_ARCHITECTURE.md`
- `03_GAMEPLAY_SPEC.md`
- `07_UI_UX_SPEC.md`
- `09_SPEEDRUN_SYSTEM_SPEC.md`
- `10_SAVE_SYSTEM_SPEC.md`
- `11_INPUT_SYSTEM_SPEC.md`
- `19_GAMEPLAY_SESSION_SYSTEM_SPEC.md`
- `20_GAMEPLAY_FLOW_SYSTEM_SPEC.md`
- `21_TRAINING_SYSTEM_SPEC.md`
- `22_PROGRESSION_SYSTEM_SPEC.md`
- `23_HUD_SYSTEM_SPEC.md`

---

## 4. Architecture

### 4.1 Core Components

The initial implementation should contain:

- `MenuManager`
- `MenuScreenRegistry`
- `MenuScreenFactory`
- `MenuPresentationCoordinator`
- `MenuInputController`
- `MenuActionDispatcher`
- `MenuViewModel`
- `MenuDialogManager`
- `MenuTransitionPresenter`
- `MenuConfiguration`
- `MenuAccessibilityController`

Screen implementations:

- `MainMenuScreen`
- `ModeSelectionScreen`
- `TrainingSelectionScreen`
- `PrologueIntroductionScreen`
- `LoadingScreen`
- `ReadyScreen`
- `PauseMenuScreen`
- `SettingsScreen`
- `ResultsScreen`
- `ConfirmationDialog`
- `ErrorScreen`

Optional screens:

- `ProgressionScreen`
- `AchievementsScreen`
- `CreditsScreen`

### 4.2 Component Responsibilities

**MenuManager**

Provides the menu presentation entry point and coordinates screen lifecycle.

It does not own application navigation.

**MenuScreenRegistry**

Registers available menu screens and their identifiers.

**MenuScreenFactory**

Creates screen instances and their view models.

**MenuPresentationCoordinator**

Coordinates screen presentation and dismissal with Gameplay Flow.

**MenuInputController**

Maps abstract Input System actions to menu navigation behavior.

**MenuActionDispatcher**

Converts user interactions into explicit application or domain requests.

**MenuViewModel**

Provides screen-specific presentation data and local interaction state.

**MenuDialogManager**

Manages confirmation and informational dialogs.

**MenuTransitionPresenter**

Handles menu-specific visual transitions.

**MenuConfiguration**

Provides shared menu presentation configuration.

**MenuAccessibilityController**

Coordinates accessibility behavior for menu screens.

---

## 5. Navigation Ownership

### 5.1 Gameplay Flow Is Authoritative

`20_GAMEPLAY_FLOW_SYSTEM_SPEC.md` owns application navigation.

Menu System must not introduce a second state machine that independently controls application destinations.

Menu screens request transitions through the Gameplay Flow interface.

### 5.2 Navigation Contract

```ts
type MenuNavigationRequest =
    | {
        type: "open_training_selection";
    }
    | {
        type: "start_training";
        exerciseId?: string;
    }
    | {
        type: "open_prologue_intro";
    }
    | {
        type: "start_prologue";
    }
    | {
        type: "resume_gameplay";
    }
    | {
        type: "restart_session";
    }
    | {
        type: "open_settings";
        returnContext: string;
    }
    | {
        type: "open_results";
    }
    | {
        type: "return_to_main_menu";
    }
    | {
        type: "quit_or_exit";
    };
```

The actual request interface should use the project-wide Gameplay Flow contract.

The Menu System must not directly instantiate gameplay sessions or load levels.

### 5.3 Navigation Result

A navigation request may be:

- Accepted.
- Rejected.
- Deferred.
- Failed.

The screen must react to the authoritative result.

It must not assume that a transition succeeded immediately after dispatching a request.

### 5.4 Return Context

Screens that can be opened from multiple locations must preserve their return context.

Examples:

- Settings opened from Main Menu returns to Main Menu.
- Settings opened from Pause returns to Pause.
- Confirmation opened from Results returns to Results.

Return context must be explicit.

Avoid relying on a global previous-screen variable.

---

## 6. Shared Menu Components

### 6.1 MenuButton

All standard menu actions should use a shared button component.

```ts
interface MenuButtonProps {
    id: string;

    label: string;

    description?: string;

    enabled: boolean;

    selected?: boolean;

    variant: MenuButtonVariant;

    onActivate: () => void;
}
```

```ts
type MenuButtonVariant =
    | "primary"
    | "secondary"
    | "text"
    | "danger";
```

### 6.2 MenuButton States

Buttons must support:

- Default.
- Hover.
- Focused.
- Pressed.
- Disabled.
- Loading.

The focus state must be visible for keyboard and gamepad navigation.

### 6.3 MenuPanel

Provides a shared container for grouped menu content.

It must not force every screen into a card-based layout.

### 6.4 MenuHeading

Provides consistent heading typography and optional supporting text.

### 6.5 MenuDivider

Provides lightweight visual separation.

### 6.6 MenuToggle

Used for boolean settings.

### 6.7 MenuSlider

Used for continuous settings such as volume or sensitivity.

### 6.8 MenuSelect

Used for discrete settings such as resolution or quality level.

### 6.9 MenuDialog

Shared modal presentation for confirmations and informational messages.

### 6.10 MenuNavigationHint

Displays relevant input hints.

Examples:

- Confirm.
- Back.
- Navigate.
- Change Value.

Labels must come from Input System.

---

## 7. Main Menu

### 7.1 Purpose

The Main Menu is the primary entry point into the game.

It should immediately communicate the game's identity and provide fast access to its main experiences.

### 7.2 Content

Initial actions:

1. Continue.
2. Training.
3. Prologue.
4. Settings.
5. Credits.
6. Exit, where supported.

Optional information:

- Current progression summary.
- Last played mode.
- Latest achievement.
- Version/build information.

### 7.3 Continue

The Continue action is contextual.

If a resumable session exists, it may offer to resume that session.

If no resumable session exists, it may open the most relevant available content selection.

The Menu System must query Gameplay Flow and Gameplay Session rather than maintaining its own active-session state.

### 7.4 Training

Opens Training Selection.

### 7.5 Prologue

Opens Prologue Introduction.

The Prologue must remain accessible according to the progression policy defined in `22_PROGRESSION_SYSTEM_SPEC.md`.

Training completion may be recommended without being a mandatory gate.

### 7.6 Settings

Opens Settings with Main Menu as the return context.

### 7.7 Credits

Displays project credits and attribution.

Credits are informational and must not interfere with gameplay systems.

### 7.8 Exit

Exit behavior depends on the runtime platform.

For browser builds, the application must not assume it can close its own browser tab.

If exiting is unsupported, hide the action or provide an appropriate alternative.

---

## 8. Mode Selection

### 8.1 Purpose

Provides a dedicated selection screen when the project supports multiple gameplay modes.

### 8.2 Initial Modes

- Training.
- Prologue.

Speedrun is initially a gameplay variant or session configuration associated with the Prologue, rather than necessarily a separate world or level.

The exact entry point should follow `03_GAMEPLAY_SPEC.md` and `09_SPEEDRUN_SYSTEM_SPEC.md`.

### 8.3 Mode Presentation

Each mode should have:

- Title.
- Short description.
- Availability.
- Optional progress summary.
- Primary action.

### 8.4 Locked Modes

If a future mode is locked:

- Display its locked state.
- Show the requirements.
- Avoid misleading disabled buttons.
- Obtain requirements from Progression System.

### 8.5 Initial Implementation

Mode Selection may be omitted as a separate screen if the Main Menu can present the two modes clearly.

Do not create a redundant navigation screen solely for architectural symmetry.

---

## 9. Training Selection

### 9.1 Purpose

Allows the player to browse and start Training exercises.

### 9.2 Content Structure

Training Selection should organize exercises into sections:

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

The Training System remains authoritative for exercise definitions and requirements.

### 9.3 Exercise Item

```ts
interface TrainingSelectionItem {
    exerciseId: string;

    title: string;

    description?: string;

    sectionId: string;

    status:
        | "locked"
        | "available"
        | "in_progress"
        | "completed"
        | "mastered";

    bestScore?: number;

    medal?: string;

    unmetRequirements?: string[];
}
```

These are presentation fields.

The Menu System must not calculate the status or medal.

### 9.4 Exercise Presentation

Each exercise item may display:

- Exercise title.
- Short description.
- Completion state.
- Mastery state.
- Medal.
- Best score, where relevant.
- Locked requirement.

Avoid showing excessive statistics in the selection list.

### 9.5 Selection Behavior

Selecting an available exercise should provide an action to start it.

The Menu System sends the exercise identifier to Gameplay Flow or the Training entry interface.

Training System determines whether the exercise can start.

### 9.6 Progress Summary

The screen may display:

- Completed exercises.
- Mastered exercises.
- Total available exercises.

The values must come from Training or Progression snapshots.

### 9.7 Replay

Completed and mastered exercises remain replayable unless a specific future design rule says otherwise.

Replaying an exercise must not reset its existing record merely by entering the selection screen.

---

## 10. Prologue Introduction

### 10.1 Purpose

Introduces the Prologue before gameplay begins.

It provides context, progression information, and a clear start action.

### 10.2 Content

- Prologue title.
- Short narrative introduction.
- Difficulty or challenge description, if applicable.
- Previous completion information.
- Optional Training recommendation.
- Start action.
- Back action.

### 10.3 Prologue Structure

The screen may show the five sections:

1. Rooftop.
2. Industrial.
3. Construction.
4. Skybridge.
5. Finish.

This is informational.

It must not duplicate Level Runtime's actual section state.

### 10.4 Previous Results

If the player has completed the Prologue:

- Show completion status.
- Optionally show a previous result summary.
- Offer replay.

Speedrun best time must be queried from Speedrun System.

### 10.5 Start Behavior

Starting the Prologue creates a request through Gameplay Flow.

Gameplay Session owns session creation.

Level Runtime owns level preparation.

Menu System must not perform either operation directly.

---

## 11. Loading Screen

### 11.1 Purpose

Provides presentation during loading and preparation.

### 11.2 Ownership

Gameplay Flow and Level Runtime own loading state.

Menu System owns only the visual presentation.

### 11.3 Content

The loading screen may display:

- Project title.
- Current destination.
- Minimal progress indicator.
- Short contextual message.
- Loading animation.

### 11.4 Progress Reporting

If the underlying runtime exposes reliable loading progress, display it.

Do not fabricate percentage values.

If progress is indeterminate, use an indeterminate animation.

### 11.5 Responsiveness

Loading presentation must not block the main thread or prevent progress updates.

### 11.6 Failure

If loading fails:

- Stop the loading presentation.
- Show an appropriate error state.
- Provide a retry or return action.
- Allow Gameplay Flow to resolve the destination.

---

## 12. Ready Screen

### 12.1 Purpose

Provides a short transition between gameplay preparation and active gameplay.

### 12.2 Content

Possible presentation:

```text
READY

Press to begin
```

The exact wording may depend on the game mode.

### 12.3 Behavior

- Gameplay Session confirms that preparation is complete.
- Gameplay Flow enters the ready state.
- Input System provides the appropriate confirmation action.
- Gameplay Session starts the session.
- Gameplay Flow transitions to active gameplay.

### 12.4 Restrictions

The Menu System must not start gameplay simulation itself.

It only presents the ready state and forwards the player's intent.

### 12.5 Initial Implementation

The Ready Screen may be a lightweight overlay rather than a separate full-screen menu.

---

## 13. Pause Menu

### 13.1 Purpose

Allows the player to temporarily leave active gameplay presentation without unloading the gameplay session.

### 13.2 Content

Initial actions:

1. Resume.
2. Restart.
3. Settings.
4. Return to Main Menu.

Optional contextual information:

- Current mode.
- Current section.
- Current Training exercise.
- Current Speedrun time.

### 13.3 Pause Behavior

Pause is coordinated through Gameplay Flow, Gameplay Session, and Input System.

The Menu System does not independently freeze physics or stop the gameplay loop.

### 13.4 Resume

Resume requests the authoritative flow transition back to gameplay.

Input context and session state must be restored by their owning systems.

### 13.5 Restart

Restart requires an explicit restart request.

The operation may use Respawn System for checkpoint-based or full-level recovery, depending on the mode's restart policy.

The Menu System must not directly reposition the player.

### 13.6 Settings

Opens Settings with Pause as the return context.

### 13.7 Return to Main Menu

This action may abandon the current session.

A confirmation dialog is required if unsaved or active gameplay progress may be lost.

The Menu System requests the transition through Gameplay Flow.

Gameplay Session owns session teardown.

### 13.8 Speedrun Pause Policy

Speedrun pause behavior must follow `09_SPEEDRUN_SYSTEM_SPEC.md`.

The Pause Menu must display the actual run state.

It must not silently stop, reset, or alter the Speedrun timer.

If pausing invalidates or disqualifies a ranked run, the policy must be communicated before confirmation.

---

## 14. Settings Screen

### 14.1 Purpose

Provides access to configurable application and gameplay settings.

### 14.2 Settings Categories

Initial categories:

1. Audio.
2. Controls.
3. Camera.
4. Display.
5. HUD.
6. Accessibility.
7. Gameplay.

Categories may be combined into fewer sections if the initial amount of settings does not justify separate navigation.

### 14.3 Settings Ownership

Settings UI is a presentation and editing layer.

The underlying systems own setting semantics and runtime application.

| Category | Owning system |
|---|---|
| Audio | Audio System |
| Controls | Input System |
| Camera | Camera System |
| Display | Rendering / Technical Architecture |
| HUD | HUD System |
| Accessibility | UI / Accessibility configuration |
| Gameplay | Relevant gameplay systems |

Save System owns persistence infrastructure.

### 14.4 Audio Settings

Initial settings:

- Master Volume.
- Music Volume.
- SFX Volume.
- UI Volume.

Each value uses a normalized range from 0.0 to 1.0 unless the Audio System defines another representation.

### 14.5 Controls Settings

Initial settings:

- Mouse Sensitivity.
- Invert Y Axis.
- Gamepad Look Sensitivity.
- Gamepad Invert Y Axis.
- Mouse and gamepad dead zones where applicable.
- Key bindings.
- Restore Defaults.

Key rebinding is coordinated through Input System.

### 14.6 Camera Settings

Initial settings:

- Field of View.
- Camera Bob Intensity.
- Camera Motion Intensity.
- Look Sensitivity.
- Reduced Motion.

The Camera System owns runtime application.

### 14.7 Display Settings

Initial settings:

- Resolution, where supported.
- Fullscreen or window mode, where supported.
- Render Quality.
- VSync, where supported.

Unsupported browser capabilities must not be displayed as functional controls.

### 14.8 HUD Settings

Initial settings:

- HUD Enabled.
- Show Speed Indicator.
- Show Section Progress.
- Show Training Objectives.
- Show Training Hints.
- Show Interaction Prompts.
- UI Scale.

The HUD System owns runtime behavior.

### 14.9 Accessibility Settings

Initial settings:

- Reduced Motion.
- UI Scale.
- High Contrast Mode.
- Color-independent status indicators.
- Optional camera motion reduction.

Accessibility settings must be consistent across menus and HUD.

### 14.10 Gameplay Settings

Possible initial settings:

- Gameplay tutorial hints.
- Contextual assistance.
- Automatic checkpoint feedback.
- Training assistance level.

Only settings supported by the relevant gameplay systems should be exposed.

### 14.11 Apply Behavior

Settings must define their application strategy.

Possible strategies:

- Immediate.
- On confirmation.
- On screen exit.
- Requires restart.

For example:

- Volume may apply immediately.
- Camera sensitivity may apply immediately.
- Display mode may require confirmation.
- Structural graphics changes may require a restart.

### 14.12 Settings Transactions

Settings screens should support temporary changes when necessary.

For settings that require confirmation:

1. Capture the previous value.
2. Apply the temporary value.
3. Start a confirmation timeout if required.
4. Confirm or revert.
5. Persist only the accepted value.

The timeout mechanism belongs to the settings/application infrastructure, not individual controls.

### 14.13 Restore Defaults

Restore Defaults must require confirmation.

The action must restore settings through their owning systems.

It must not erase progression or gameplay records.

### 14.14 Save Behavior

Settings are persisted through Save System.

The Menu System must not access IndexedDB directly.

---

## 15. Results Screen

### 15.1 Purpose

Displays the outcome of a completed Training exercise, Prologue session, or Speedrun.

### 15.2 Results Ownership

The relevant domain system owns the result.

Menu System owns its presentation.

### 15.3 Result Categories

**Training Results**

Provided by Training System.

May include:

- Exercise title.
- Completion status.
- Score.
- Medal.
- Best score.
- Completion time.
- Objectives completed.
- Mastery status.

**Prologue Results**

Provided by Gameplay Session and the relevant campaign result provider.

May include:

- Completion status.
- Total time, if available.
- Completed sections.
- Completion timestamp.
- Replay action.

**Speedrun Results**

Provided by Speedrun System.

May include:

- Final time.
- Medal.
- Splits.
- Personal best comparison.
- Validation status.
- Route information.

### 15.4 Result Data Model

```ts
interface MenuResultsData {
    resultId: string;

    mode: string;

    title: string;

    completed: boolean;

    durationMilliseconds?: number;

    score?: number;

    medal?: string;

    isPersonalBest?: boolean;

    details: Record<string, unknown>;
}
```

This is a presentation model.

The Menu System must not calculate medals, completion status, or personal bests.

### 15.5 Results Actions

Possible actions:

- Retry.
- Continue.
- Return to Main Menu.
- Open detailed splits.
- Replay Training exercise.
- Start another exercise.

Available actions depend on the result type.

### 15.6 Invalid Speedrun Results

Invalid results must clearly communicate that the run was not accepted as a valid ranked completion.

Do not display an invalid run as a successful medal result.

### 15.7 Persistence

Results are persisted by their owning systems.

Menu System must not independently save duplicate result records.

---

## 16. Confirmation Dialogs

### 16.1 Purpose

Confirmation dialogs prevent accidental destructive or disruptive actions.

### 16.2 Initial Dialogs

- Abandon active session.
- Restart current level.
- Restart Training exercise.
- Reset settings.
- Restore default controls.
- Reset all progression.
- Discard temporary settings.
- Retry failed loading.

### 16.3 Dialog Model

```ts
interface MenuDialogDefinition {
    id: string;

    title: string;

    message: string;

    confirmLabel: string;

    cancelLabel: string;

    severity: "normal" | "warning" | "destructive";
}
```

### 16.4 Behavior

A dialog must:

- Have one clear primary action.
- Have a safe cancel action.
- Support keyboard navigation.
- Support gamepad navigation.
- Preserve the underlying screen context.
- Prevent accidental interaction with background controls.
- Return focus to the originating control after dismissal.

### 16.5 Destructive Actions

Destructive operations must not execute before confirmation.

The dialog only confirms intent.

The owning system executes the operation.

---

## 17. Error and Recovery Screens

### 17.1 Purpose

Provide clear recovery options when an application operation fails.

Examples:

- Level loading failure.
- Session initialization failure.
- Save failure.
- Invalid gameplay configuration.
- Unsupported feature.
- Unexpected runtime recovery state.

### 17.2 Error Model

```ts
interface MenuErrorData {
    errorId: string;

    title: string;

    message: string;

    recoverable: boolean;

    actions: MenuErrorAction[];
}
```

### 17.3 Error Actions

Possible actions:

- Retry.
- Return to Main Menu.
- Return to Previous Screen.
- Continue Without Optional Feature.
- Open Diagnostics in Development Builds.

### 17.4 Error Ownership

The originating system owns the error.

Menu System only displays the supplied error information and forwards recovery intent.

Do not expose raw internal exceptions to the player.

---

## 18. Optional Progression and Achievement Screens

### 18.1 Progression Screen

May display:

- Completed Training sections.
- Completed Prologue.
- Unlocked content.
- Milestones.
- Overall completion summary.

Progression System supplies the authoritative snapshot.

### 18.2 Achievement Screen

May display:

- Unlocked achievements.
- Locked achievements.
- Hidden achievements.
- Achievement categories.
- Unlock timestamps.

Achievement evaluation remains owned by Progression System.

### 18.3 Initial Implementation

A dedicated Progression or Achievement screen is optional.

The initial implementation may present progress summaries directly in Main Menu and Training Selection.

Do not create additional screens unless they improve usability.

---

## 19. Menu Input and Focus Management

### 19.1 Input Source

Menu System consumes abstract actions from Input System.

It must not listen directly to raw keyboard or gamepad events.

### 19.2 Required Actions

- Navigate Up.
- Navigate Down.
- Navigate Left.
- Navigate Right.
- Confirm.
- Cancel.
- Back.
- Pause.
- Adjust Value.

### 19.3 Focus Model

```ts
interface MenuFocusState {
    screenId: string;

    focusedElementId?: string;

    previousFocusedElementId?: string;

    focusContext: "keyboard" | "gamepad" | "pointer";
}
```

### 19.4 Focus Requirements

- Every interactive element must be focusable.
- Focus order must be predictable.
- Disabled controls must be handled consistently.
- Dialog focus must remain inside the active dialog.
- Returning to a screen should restore focus where possible.
- Focus must never reference a destroyed element.

### 19.5 Input Context

When a menu becomes active:

- Gameplay input context is suspended or replaced by the owning flow/input coordination.
- Menu input context becomes active.
- On dismissal, the correct gameplay or application context is restored.

Menu System does not directly manipulate low-level input device state.

---

## 20. Screen State and Data Lifecycle

### 20.1 Screen Instance

```ts
interface MenuScreenInstance {
    id: string;

    screenType: string;

    createdAt: number;

    returnContext?: string;

    viewModelId: string;
}
```

### 20.2 Screen Data

Screen data should be separated into:

- Domain snapshot.
- Screen-local presentation state.
- Temporary interaction state.

Domain snapshots are read-only.

Screen-local state may include:

- Current tab.
- Selected list item.
- Scroll position.
- Expanded section.
- Current focus.

### 20.3 Reopening Screens

Reopening Settings should not recreate or reset every setting unnecessarily.

Returning to Training Selection should preserve useful browsing context where valid.

A destroyed session must not be restored merely because a previous screen instance remains cached.

### 20.4 Stale Data

Screens must refresh their domain snapshots when relevant progression or gameplay events occur.

They must not assume that data remains valid indefinitely.

---

## 21. Responsive Layout

### 21.1 Supported Environments

The Menu System must adapt to the target browser and desktop viewport sizes defined in `02_TECHNICAL_ARCHITECTURE.md`.

### 21.2 Layout Strategy

Prefer:

- Flexible containers.
- Relative spacing.
- Responsive typography.
- Scrollable lists.
- Adaptive columns.
- Minimum readable control sizes.

Avoid hardcoded layouts that only work at one desktop resolution.

### 21.3 Small Viewports

On smaller viewports:

- Collapse secondary navigation.
- Stack columns vertically.
- Reduce decorative space.
- Keep primary actions visible.
- Allow long content to scroll.
- Preserve readable text.

### 21.4 Input Method Adaptation

Pointer-oriented layouts may use hover states.

Keyboard and gamepad navigation must remain fully functional without hover.

---

## 22. Animation and Transitions

### 22.1 General Rules

Transitions should be restrained and fast.

Recommended initial timing:

| Transition | Duration |
|---|---:|
| Screen fade | 150–250 ms |
| Dialog appearance | 150–200 ms |
| Button focus | 100–150 ms |
| Panel transition | 200–300 ms |
| Results reveal | 250–400 ms |

### 22.2 Transition Ownership

Gameplay Flow owns logical navigation.

Menu Transition Presenter owns the visual transition.

Visual animation completion must not be mistaken for successful gameplay initialization.

### 22.3 Interruptions

Transitions must support cancellation or replacement when Gameplay Flow changes the requested destination.

### 22.4 Reduced Motion

When Reduced Motion is enabled:

- Minimize translation.
- Avoid large scale animations.
- Prefer opacity transitions.
- Avoid parallax.
- Avoid unnecessary decorative movement.

---

## 23. Audio Integration

### 23.1 Menu Audio

The Menu System may request:

- Button focus sound.
- Button activation sound.
- Back sound.
- Dialog confirmation sound.
- Error feedback.
- Screen transition sound.

### 23.2 Ownership

Audio System owns playback, mixing, and volume.

Menu System emits semantic UI audio requests.

### 23.3 Audio Feedback

Do not play sounds directly from individual UI components through low-level audio APIs.

Use a shared presentation integration.

### 23.4 Accessibility

All essential information must remain available visually.

Audio feedback is supplementary.

---

## 24. Persistence Integration

### 24.1 Ownership

Save System owns persistence infrastructure.

Settings owners define their own setting schemas.

Progression System owns progression semantics.

Menu System owns none of these storage models.

### 24.2 Required Behavior

- Settings changes are persisted through Save System.
- Progression summaries are loaded through Progression interfaces.
- Training records come from Training System.
- Speedrun results come from Speedrun System.
- Active session information comes from Gameplay Session.

### 24.3 Storage Failure

If a settings save fails:

- Keep the runtime setting where safe.
- Inform the player when appropriate.
- Avoid falsely reporting successful persistence.

The Menu System must not attempt direct storage recovery.

---

## 25. Performance and Reliability

Requirements:

- No unnecessary screen reconstruction.
- No duplicated domain subscriptions.
- No blocking operations on the rendering thread.
- No direct storage operations from UI components.
- No stale screen callbacks.
- No orphaned dialogs.
- No lost focus references.
- No navigation requests from destroyed screens.
- No gameplay state mutation from presentation components.

Asynchronous operations must be cancellable or safely ignored when the originating screen is no longer active.

---

## 26. Testing Requirements

### 26.1 Screen Tests

Test:

- Main Menu.
- Training Selection.
- Prologue Introduction.
- Loading.
- Ready.
- Pause.
- Settings.
- Results.
- Confirmation Dialogs.
- Error Screens.

### 26.2 Navigation Tests

Test:

- Main Menu to Training.
- Main Menu to Prologue.
- Training Selection to exercise start.
- Prologue Introduction to Prologue.
- Gameplay to Pause.
- Pause to Gameplay.
- Pause to Settings.
- Settings back to Pause.
- Results to Retry.
- Results to Main Menu.
- Dialog cancellation.
- Dialog confirmation.

### 26.3 Context Preservation Tests

Test:

- Settings return to Main Menu.
- Settings return to Pause.
- Dialog returns to the correct screen.
- Selection focus restoration.
- Scroll position restoration.
- Invalid session context recovery.

### 26.4 Input Tests

Test:

- Keyboard navigation.
- Mouse navigation.
- Gamepad navigation.
- Focus transitions.
- Dialog focus trapping.
- Input context switching.
- Rebinding integration.

### 26.5 Settings Tests

Test:

- Immediate setting changes.
- Confirmed setting changes.
- Revert behavior.
- Restore Defaults.
- Save failure.
- Persistence after reload.

### 26.6 Results Tests

Test:

- Training completion.
- Training failure.
- Prologue completion.
- Speedrun valid result.
- Speedrun invalid result.
- Personal best.
- Retry behavior.

### 26.7 Responsive Tests

Test:

- Standard desktop viewport.
- Small desktop viewport.
- Resized browser window.
- High UI scale.
- Long localized strings.
- Keyboard-only navigation.
- Gamepad-only navigation.

---

## 27. Implementation Phases

### Phase 1: Shared Menu Foundation

Implement:

- MenuManager.
- MenuScreenRegistry.
- MenuScreenFactory.
- MenuViewModel.
- Shared controls.
- Focus management.

### Phase 2: Main Navigation Screens

Implement:

- MainMenuScreen.
- TrainingSelectionScreen.
- PrologueIntroductionScreen.

### Phase 3: Gameplay Screens

Implement:

- LoadingScreen.
- ReadyScreen.
- PauseMenuScreen.
- ResultsScreen.

### Phase 4: Settings

Implement:

- Settings navigation.
- Audio settings.
- Controls settings.
- Camera settings.
- Display settings.
- HUD settings.
- Accessibility settings.
- Save integration.

### Phase 5: Dialogs and Errors

Implement:

- MenuDialogManager.
- ConfirmationDialog.
- ErrorScreen.
- Recovery actions.

### Phase 6: Integration

Integrate:

- Gameplay Flow.
- Gameplay Session.
- Training.
- Progression.
- Speedrun.
- Input.
- Save System.
- Audio.
- HUD.

### Phase 7: Responsive Behavior and Polish

Implement:

- Responsive layouts.
- Focus restoration.
- Reduced Motion.
- UI scaling.
- Transition interruption.
- Visual consistency.

### Phase 8: Validation

Run:

- Screen tests.
- Navigation tests.
- Input tests.
- Settings tests.
- Results tests.
- Responsive tests.
- End-to-end application flow tests.

---

## 28. Acceptance Criteria

The implementation is accepted when:

1. All required screens are registered and accessible through Gameplay Flow.
2. Menu System does not own application navigation state.
3. Screens generate explicit navigation requests.
4. Main Menu provides access to Training and Prologue.
5. Training Selection displays authoritative exercise status.
6. Prologue Introduction displays authoritative completion information.
7. Pause Menu does not directly freeze or restart gameplay.
8. Settings use the owning systems for runtime application.
9. Settings persistence uses Save System.
10. Results are presented from authoritative domain data.
11. Invalid Speedrun results are clearly identified.
12. Destructive actions require confirmation.
13. Errors provide valid recovery actions.
14. Keyboard and gamepad navigation work.
15. Focus restoration works.
16. Return context is preserved.
17. Responsive layouts remain usable.
18. Reduced Motion is respected.
19. Screen transitions can be interrupted safely.
20. Stale asynchronous callbacks cannot affect new screens.
21. No domain business logic is duplicated in the Menu System.
22. Unit and integration tests pass.

---

## 29. Definition of Done

- [ ] Menu architecture implemented.
- [ ] Screen registry implemented.
- [ ] Screen factory implemented.
- [ ] Shared menu components implemented.
- [ ] Focus management implemented.
- [ ] Main Menu implemented.
- [ ] Training Selection implemented.
- [ ] Prologue Introduction implemented.
- [ ] Loading Screen implemented.
- [ ] Ready Screen implemented.
- [ ] Pause Menu implemented.
- [ ] Settings Screen implemented.
- [ ] Results Screen implemented.
- [ ] Confirmation Dialogs implemented.
- [ ] Error Screen implemented.
- [ ] Gameplay Flow integration complete.
- [ ] Gameplay Session integration complete.
- [ ] Training integration complete.
- [ ] Progression integration complete.
- [ ] Speedrun integration complete.
- [ ] Input integration complete.
- [ ] Save integration complete.
- [ ] Audio integration complete.
- [ ] Responsive layouts implemented.
- [ ] Accessibility behavior implemented.
- [ ] Transition interruption handled.
- [ ] Asynchronous lifecycle safety implemented.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] End-to-end navigation tests pass.
- [ ] No duplicated ownership exists.
- [ ] Visual design follows `07_UI_UX_SPEC.md`.

---

## 30. Final Design Constraints

1. Menu System owns screen content and behavior.
2. Gameplay Flow owns application navigation.
3. Gameplay Session owns session lifecycle.
4. Level Runtime owns level loading and runtime lifecycle.
5. Training owns exercise definitions and results.
6. Speedrun owns run results and validation.
7. Progression owns unlocks and achievements.
8. Save System owns persistence infrastructure.
9. Input System owns device input and abstract actions.
10. Audio System owns audio playback.
11. HUD System owns in-game HUD presentation.
12. Menu screens must not implement gameplay rules.
13. Menu screens must not directly create gameplay sessions.
14. Menu screens must not directly manipulate player state.
15. Menu screens must not directly access IndexedDB.
16. All navigation requests must pass through Gameplay Flow.
17. All destructive operations require explicit confirmation.
18. Settings must be applied through their owning systems.
19. Results must originate from authoritative domain data.
20. Return context must be explicit.
21. Focus must be restored safely.
22. Asynchronous callbacks must not mutate destroyed screens.
23. Menu transitions must not control gameplay simulation.
24. Browser platform limitations must be respected.
25. Keyboard, pointer, and gamepad navigation must be supported by the shared input architecture.
26. Visual consistency must be maintained across all screens.
27. The initial implementation must avoid unnecessary menu layers and redundant screens.

**End of Specification**