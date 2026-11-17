# 07_UI_UX_SPEC.md

**Project:** Glassline — First-Person Parkour Game  
**Document:** UI/UX Specification  
**Version:** 1.0  
**Status:** Design Specification  
**Applies to:** Main Menu, HUD, Runner Vision, Training UI, Pause, Results, Leaderboard, Settings, Navigation

---

## 1. Purpose

This document defines the user interface and user experience requirements for Glassline.

It describes:

- Main menu.
- Game mode selection.
- Training interface.
- In-game HUD.
- Runner Vision.
- Pause menu.
- Checkpoint feedback.
- Run results.
- Local leaderboard.
- Settings.
- Keyboard and mouse controls.
- UI visual language.
- Responsive behavior.
- Accessibility requirements.

The interface should reinforce the project's visual identity while remaining lightweight and readable.

The game is a first-person movement experience. The interface must not distract from movement, obscure important environmental details, or introduce unnecessary interaction complexity.

The interface is a presentation layer. HUD and menu screens render authoritative snapshots and events provided by their owning systems and emit explicit user commands. The UI does not own or mutate gameplay, physics, session, timer, checkpoint, progression, achievement, or persistence state.

Setting values are owned by the Settings System, translated text is resolved by the Localization System, and accessibility policy is coordinated by the Accessibility System; the UI consumes their authoritative state and applies it to its own presentation.

---

## 2. UX Principles

### 2.1 Minimalism

Use only interface elements that provide useful information.

Avoid:

- Large permanent HUD panels.
- Excessive decorative borders.
- Unnecessary icons.
- Dense text.
- Complex menu hierarchies.
- Persistent notifications.

### 2.2 Functional Clarity

Every interactive element must communicate its purpose.

The player should understand:

- What can be selected.
- What action will happen.
- Whether an action is currently available.
- Whether an operation succeeded or failed.

### 2.3 Visual Consistency

All UI screens must follow one visual language.

Use:

- White and light-gray surfaces.
- Dark gray typography.
- Red accent elements.
- Strong alignment.
- Clean geometric layouts.
- Consistent spacing.
- Minimal decoration.

### 2.4 Gameplay Priority

During gameplay:

- The environment is the primary visual content.
- The HUD provides only essential information.
- Temporary messages should disappear automatically.
- Notifications must not block movement.
- UI animations must not interfere with input.

### 2.5 Responsive Layout

The UI must work across common desktop browser window sizes.

Support:

- 16:9 desktop displays.
- 16:10 displays.
- Ultrawide displays.
- Resizable browser windows.

The initial target is desktop keyboard-and-mouse gameplay.

Mobile and touch controls are outside the initial scope.

---

## 3. Visual Identity

### 3.1 General Direction

The Glassline interface is inspired by the clean, high-contrast visual language of the original *Mirror's Edge* (2008) without reproducing its proprietary assets or exact layouts.

It should feel:

- Modern.
- Technical.
- Lightweight.
- Precise.
- Architectural.
- Functional.

Do not reproduce the original game's exact layouts, logos, fonts, or proprietary graphic assets.

### 3.2 UI Color Palette

Use the project's core palette from `04_ASSET_BIBLE.md`.

| Name | Hex | Usage |
|---|---|---|
| Pure White | `#F1F1ED` | Main light surfaces |
| Concrete | `#C7C9C7` | Secondary surfaces |
| Light Gray | `#A8ADAE` | Disabled or secondary UI |
| Steel | `#747A7D` | Secondary text |
| Dark Metal | `#33393D` | Main dark text and overlays |
| Runner Red | `#D52E36` | Primary accent |
| Sky | `#A7B9C4` | Secondary environmental tone |

Use color consistently.

Red should identify important actions, selected states, progress, and gameplay guidance.

### 3.3 Typography

Use a clean sans-serif typeface.

Typography should prioritize:

- Legibility.
- Strong hierarchy.
- Compact labels.
- Clear numeric values.
- Consistent alignment.

Suggested hierarchy:

| Type | Usage |
|---|---|
| Display | Main menu titles and large results |
| Heading | Section titles |
| Body | Descriptions and instructions |
| Label | Small UI labels |
| Numeric | Timer, speed, statistics |

Use CSS font stacks initially.

Bundled fonts may be introduced later if licensing and loading requirements are satisfied.

Do not make the UI depend on an external font CDN.

### 3.4 Typography Rules

- Use uppercase sparingly for technical labels.
- Prefer short phrases.
- Avoid long explanatory paragraphs during gameplay.
- Use tabular numerals for timers and statistics.
- Maintain sufficient contrast.
- Do not use excessively thin fonts for small text.

### 3.5 Layout

Use a consistent spacing scale.

Suggested base spacing:

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
}
```

Use these values as a starting point.

The layout should align to a consistent grid.

Avoid unnecessary rounded cards and heavy shadows.

---

## 4. UI Architecture

### 4.1 Technology

Use:

- HTML.
- CSS.
- TypeScript.
- Existing application architecture.

The UI should be rendered independently from the Three.js scene.

Do not implement ordinary menus, buttons, text, and settings as 3D objects.

### 4.2 Proposed Directory Structure

```text
src/
└── ui/
    ├── core/
    │   ├── UIManager.ts
    │   ├── UIState.ts
    │   ├── UIEvent.ts
    │   └── UIOverlay.ts
    │
    ├── components/
    │   ├── Button.ts
    │   ├── Panel.ts
    │   ├── ProgressBar.ts
    │   ├── Notification.ts
    │   ├── Modal.ts
    │   └── Typography.ts
    │
    ├── screens/
    │   ├── MainMenuScreen.ts
    │   ├── ModeSelectionScreen.ts
    │   ├── TrainingScreen.ts
    │   ├── PauseScreen.ts
    │   ├── ResultsScreen.ts
    │   ├── LeaderboardScreen.ts
    │   └── SettingsScreen.ts
    │
    ├── hud/
    │   ├── GameHUD.ts
    │   ├── TimerDisplay.ts
    │   ├── SpeedDisplay.ts
    │   ├── DirectionIndicator.ts
    │   ├── CheckpointIndicator.ts
    │   └── RunnerVisionIndicator.ts
    │
    └── styles/
        ├── tokens.css
        ├── global.css
        ├── layout.css
        ├── components.css
        └── screens.css
```

This is a proposed organization.

Do not create every module in advance.

Introduce components when they are required by the active implementation task.

### 4.3 UI State

The UI must reflect application and gameplay state.

Possible high-level UI states:

```ts
type UIState =
  | 'mainMenu'
  | 'modeSelection'
  | 'training'
  | 'gameplay'
  | 'paused'
  | 'results'
  | 'leaderboard'
  | 'settings';
```

Use the actual application state architecture where available.

Do not allow the UI to become an independent source of gameplay truth.

UI state is a presentation projection of the Gameplay Flow state. Application navigation remains owned by Gameplay Flow (`20_GAMEPLAY_FLOW_SYSTEM_SPEC.md`); the UI must not introduce a competing navigation, session, or gameplay state machine.

### 4.4 Communication

UI should communicate with game systems through explicit interfaces or typed events.

Examples:

- Start requested.
- Pause requested.
- Resume requested.
- Settings changed.
- Exercise selected.
- Checkpoint activated.
- Run completed.
- Results requested.
- Return to menu requested.

Avoid direct manipulation of internal player physics state from UI components.

User-facing text is resolved through the Localization System (`27_LOCALIZATION_SYSTEM_SPEC.md`); UI components must not hardcode user-facing strings.

### 4.5 Lifecycle

UI components must support:

- Initialization.
- Mounting.
- Updating.
- Hiding.
- Unmounting.
- Cleanup.

Remove event listeners and subscriptions when components are destroyed.

Do not leave hidden screens running unnecessary update loops.

---

## 5. Main Menu

### 5.1 Purpose

The main menu is the initial entry point.

It should provide direct access to the main game modes and local records.

### 5.2 Menu Options

Required options:

1. Continue, when a resumable session exists.
2. Training.
3. Prologue.
4. Local Records.
5. Settings.
6. Credits.
7. Exit, where supported.

The exact menu content and action semantics are owned by `24_MENU_SYSTEM_SPEC.md` §7. This document defines the presentation of that content.

In a browser, Exit may be replaced with a suitable action such as returning to the initial screen or displaying a short exit message.

Do not rely on `window.close()` working in ordinary browser tabs.

### 5.3 Layout

Recommended composition:

- Project title in the upper-left or upper area.
- Main menu options arranged vertically.
- Subtle architectural background.
- Small technical status or version label.
- Minimal decorative red accent.

Avoid a large opaque panel covering the entire screen.

### 5.4 Main Menu Actions

**Continue**

- Requests resumption of the resumable session through Gameplay Flow.
- Is hidden or disabled when no resumable session exists.

**Training**

- Requests the Training destination through Gameplay Flow.
- Displays Training progress from authoritative Training and Progression snapshots.
- Allows access to completed exercises.

**Prologue**

- Requests a new Prologue session through Gameplay Flow.
- Opens the Prologue introduction presentation defined in `24_MENU_SYSTEM_SPEC.md`.
- Gameplay Session owns run initialization; Level Runtime owns level loading.

**Local Records**

- Opens the local leaderboard presentation.
- Displays validated records provided by the Speedrun record contract.

**Settings**

- Opens the settings screen.

**Credits**

- Opens the credits presentation.

**Exit**

- Performs a browser-compatible exit or navigation action.
- Must not cause an unexpected page reload.

### 5.5 Menu Input

Support:

- Mouse selection.
- Keyboard navigation.
- Enter to activate.
- Escape to return to the previous screen where appropriate.

All focused elements must have a visible focus state.

---

## 6. Mode Selection

A separate mode selection screen is optional.

If included, it should be concise.

Available modes:

- Training.
- Prologue Run.

Show a short description for each.

Training:

> Learn movement and parkour mechanics through guided exercises.

Prologue:

> Complete the route as fast as possible and improve your personal record.

Do not create additional game modes in the initial scope.

---

## 7. In-Game HUD

### 7.1 Purpose

The HUD provides essential gameplay information without obstructing the environment.

It should remain minimal during normal movement.

### 7.2 HUD Elements

Required elements:

- Timer.
- Speed indicator.
- Direction indicator.
- Checkpoint or route progress.
- Runner Vision.

Optional contextual elements:

- Short action hints.
- Temporary checkpoint notifications.
- Training instructions.
- Temporary gameplay warnings.

Widget ownership, data sources, and lifecycle are defined in `23_HUD_SYSTEM_SPEC.md`; this section defines presentation requirements only. The HUD displays authoritative snapshots and events and must not render independently calculated gameplay results.

### 7.3 HUD Layout

Recommended arrangement:

```text
+--------------------------------------------------+
|                                                  |
|  ROUTE / CHECKPOINT                     TIMER    |
|                                                  |
|                                                  |
|                                                  |
|                 GAME VIEW                        |
|                                                  |
|                                                  |
|                                                  |
|                                                  |
|  SPEED                                  STATUS   |
+--------------------------------------------------+
```

This is a conceptual layout.

The actual HUD should use a restrained amount of screen space.

### 7.4 Timer

The timer is the most important speedrun HUD element.

Display:

- Minutes.
- Seconds.
- Milliseconds or centiseconds.

Suggested format:

```text
02:14.38
```

Use tabular numerals.

The display must be driven by the run timer, not by a separate UI interval counter.

The timer must not depend on rendering FPS.

### 7.5 Speed Indicator

Display current player speed.

Example:

```text
08.4 m/s
```

Requirements:

- Update from the player movement system.
- Avoid excessive decimal precision.
- Use a stable display format.
- Optionally distinguish sprint speed from normal movement.

Do not calculate speed independently from camera movement.

### 7.6 Direction Indicator

Provide a subtle indication of the next route direction.

Possible visual representations:

- Minimal arrow.
- Small directional marker.
- Short route indicator.

The indicator should not behave like a permanent large compass.

It should be most visible when the next route transition is unclear.

### 7.7 Checkpoint Progress

Display current route progress.

Possible format:

```text
02 / 04
```

The finish area may be shown separately.

Checkpoint progress must reflect the actual route validation system.

Do not increment progress merely because the player visually approaches a checkpoint.

### 7.8 HUD Visibility

The HUD should support visibility changes by gameplay state.

Examples:

| State | HUD behavior |
|---|---|
| Main menu | Hidden |
| Training | Training HUD |
| Prologue introduction | Minimal |
| Active run | Full gameplay HUD |
| Paused | Suspended or hidden |
| Results | Hidden |
| Respawning | Temporarily suppressed |

---

## 8. Runner Vision

### 8.1 Purpose

Runner Vision presents navigational hints authored by level design. It helps the player understand the intended route while complementing environmental navigation.

Route guidance rules, highlight priorities, and target selection are defined in `06_LEVEL_DESIGN_SPEC.md` §25. Visual treatment is defined in `04_ASSET_BIBLE.md` §7.9. This section defines presentation requirements only.

The presentation must remain subordinate to the environment; Runner Vision must not become a permanent glowing path through the level.

### 8.2 Visual Elements

Presentation follows `04_ASSET_BIBLE.md` §7.9.

Possible indicators:

- Red route accents.
- Direction arrows.
- Highlighted parkour objects.
- Landing target markers.
- Checkpoint markers.

### 8.3 Activation

Runner Vision may be:

- Always available in the initial prototype.
- Triggered by a dedicated input.
- Controlled by a Settings preference.

Choose one consistent interaction model during implementation.

If activated by input, it must not conflict with core movement controls.

### 8.4 Highlight Priority

Highlight selection and priority are owned by level design (`06_LEVEL_DESIGN_SPEC.md` §25.2).

The UI presents the resulting highlight state and must not independently decide which object or route element to highlight.

### 8.5 Visual Behavior

Highlights should be:

- Subtle.
- Brief.
- Readable.
- Consistent.
- Non-obstructive.

Avoid excessive bloom or full-screen effects.

### 8.6 Accessibility

Allow the player to adjust:

- Runner Vision intensity.
- Highlight color.
- Whether the system is always available or manually activated, if both modes are supported.

These are Settings preferences; their effective presentation is applied by the UI and HUD systems.

Important route information must remain available through environmental design.

---

## 9. Training Interface

### 9.1 Purpose

Training UI guides the player through exercises.

It should explain the next action briefly and provide clear success feedback.

### 9.2 Exercise Panel

Each exercise may show:

- Exercise number.
- Exercise title.
- Short description.
- Required control.
- Progress state.
- Completion status.

Example:

```text
02 / 08

JUMPING

Build speed and jump across the gap.
Land on the marked platform.

SPACE — JUMP
```

This is an illustrative layout.

### 9.3 Instruction Timing

Instructions should appear before the player reaches the relevant challenge.

Do not cover the player's view during the actual maneuver.

Use short contextual prompts.

### 9.4 Control Hints

Display the actual configured input binding.

Do not hardcode key names if controls are remappable.

The UI should obtain bindings from the input configuration system.

### 9.5 Exercise Progress

Show:

- Current exercise.
- Completed exercises.
- Locked exercises.
- Available next exercise.

Completed exercises should be visually distinguishable.

The player may revisit completed exercises.

### 9.6 Completion Feedback

After successful exercise completion:

- Show a short success message.
- Play a subtle confirmation sound.
- Display the updated progress supplied by Training and Progression.

The UI must not unlock exercises or alter Training progress itself; those operations are owned by the Training and Progression systems.

Do not pause gameplay for a long animation.

### 9.7 Training Completion Screen

Display:

- Training completed.
- Completed exercise count.
- Optional total training time.
- Return to Training hub.
- Return to Main Menu.

Training completion must not create a Prologue speedrun record.

---

## 10. Pause Menu

### 10.1 Purpose

Pause provides access to basic run controls.

### 10.2 Options

Required options:

- Resume.
- Restart Run.
- Settings.
- Main Menu.

### 10.3 Behavior

When paused:

- Display the pause UI.
- Release pointer lock through the Input System.
- Request the pause transition through Gameplay Flow.

Gameplay Session owns pausing and resuming session behavior. The Speedrun System owns run timer pause policy (`09_SPEEDRUN_SYSTEM_SPEC.md`). The UI must not freeze physics or stop the gameplay loop directly.

Resume must restore the presentation from authoritative session state.

### 10.4 Restart

Restart must:

- Ask for confirmation if accidental activation is likely.
- Request a session restart through Gameplay Flow.
- Let Gameplay Session create a clean run state and let Respawn System own any recovery lifecycle required by the restart policy.

The UI must not reposition the player, reset checkpoints, reset run statistics, or reset the timer directly.

### 10.5 Main Menu

Leaving the run must:

- Request session abandonment through Gameplay Flow.
- Let Gameplay Session and Level Runtime stop the run and release level resources.
- Return to the main menu presentation.

The UI must not save an incomplete run; persistence remains with the owning systems.

---

## 11. Results Screen

### 11.1 Purpose

The Results screen presents the outcome of a completed Prologue run.

It should provide clear feedback and encourage replay.

### 11.2 Required Information

Display:

- Final time.
- Personal best.
- Average speed.
- Maximum speed.
- Distance traveled.
- Jump count.
- Wallrun count.
- Slide count.
- Fall count.
- Checkpoint split times.

All values are provided by authoritative result snapshots: the Speedrun System supplies timing, splits, personal-best status, and validation; the Statistics System supplies aggregated movement facts. The UI must not calculate, reconstruct, or modify these values.

### 11.3 Example Layout

```text
RUN COMPLETE

02:14.38

PERSONAL BEST
02:11.92

STATISTICS
Average Speed     6.8 m/s
Maximum Speed     10.2 m/s
Distance          842 m
Jumps              12
Wallruns            4
Slides              6
Falls               1

CHECKPOINT SPLITS
01  00:31.20
02  01:02.45
03  01:34.12
04  01:58.30

[ RETRY ]   [ MAIN MENU ]
```

The values are illustrative.

### 11.4 Personal Best

If the authoritative result reports a new personal best:

- Highlight the new record.
- Display a short confirmation.
- Display the new-record state supplied by the Speedrun System.

Record persistence is owned by the Speedrun record contract and the Save System; the UI must not write to the record store.

If the run is not a new personal best:

- Display the existing record.
- Show the difference where useful.

### 11.5 Retry

Retry should request a restart through Gameplay Flow; Gameplay Session owns creation of a clean run state.

### 11.6 Main Menu

Request return to the main menu through Gameplay Flow; session teardown and level resource release belong to Gameplay Session and Level Runtime.

### 11.7 Invalid Run

If the run is invalid:

- Show the completion time if useful.
- Clearly identify that the result is invalid.
- Display only the validation status supplied by the Speedrun System; do not present it as a valid leaderboard record.
- Explain the reason where possible.
- Offer Retry and Main Menu.

---

## 12. Local Leaderboard

### 12.1 Purpose

The local leaderboard presents validated Prologue runs recorded by the Speedrun System.

It provides a persistent personal history across browser reloads.

Online leaderboards are outside the initial scope.

### 12.2 Storage

Leaderboard records are produced by the Speedrun record contract (`09_SPEEDRUN_SYSTEM_SPEC.md` §11) and persisted through the Save System (`10_SAVE_SYSTEM_SPEC.md`).

The UI must not access IndexedDB directly, maintain a duplicate record store, or use localStorage as a record source.

### 12.3 Record Model

Illustrative display fields, mapped from the authoritative Speedrun record contract (`09_SPEEDRUN_SYSTEM_SPEC.md` §11.2):

```ts
interface RunRecord {
  id: string;
  levelId: string;
  completedAt: number;
  durationMs: number;
  averageSpeed: number;
  maxSpeed: number;
  distance: number;
  jumps: number;
  wallruns: number;
  slides: number;
  falls: number;
  checkpointSplits: number[];
  valid: boolean;
}
```

The UI must not compute, validate, or persist these values itself.

### 12.4 Sorting

Sorting, grouping, and tie-breaking are owned by the Speedrun record contract (`09_SPEEDRUN_SYSTEM_SPEC.md` §11.4).

The leaderboard displays records in the order supplied by the owning system and must not re-sort or re-group them independently.

### 12.5 Display

Show:

- Rank.
- Completion time.
- Date.
- Optional key statistics.

Do not overload the table with every available metric.

### 12.6 Empty State

If no valid records exist:

Display a short message:

> No records yet. Complete the Prologue to set your first time.

Provide a direct action to start a run.

### 12.7 Data Management

The player should be able to:

- View records.
- Clear local records after confirmation.

Record deletion is executed by the owning record and persistence systems; the UI only requests the operation and reports the authoritative result.

Do not silently delete records.

### 12.8 Record Validation

Record validity is determined by the Speedrun validation contract (`09_SPEEDRUN_SYSTEM_SPEC.md` §12).

Training results, incomplete runs, and invalid runs must not be stored or presented as valid leaderboard records.

---

## 13. Settings Screen

### 13.1 Purpose

Settings provides control over input and presentation preferences.

The Settings System (`25_SETTINGS_SYSTEM_SPEC.md`) owns setting values, validation, categories, and semantics. The Settings screen is a presentation and editing layer; it must request changes through the Settings interface and must not maintain a second settings store or access IndexedDB directly.

Setting values persist between sessions through the Save System (`10_SAVE_SYSTEM_SPEC.md`).

### 13.2 Initial Settings Categories

**Controls**

- Mouse sensitivity.
- Invert mouse Y.
- Key bindings.
- Reset controls.

**Camera**

- Field of view.
- Camera bob intensity.
- Camera motion intensity.
- Look sensitivity.

**Display**

- Resolution or browser rendering scale, where supported.
- Fullscreen.
- Graphics quality.

**HUD**

- HUD enabled.
- Widget visibility.
- UI scale.

**Gameplay**

- Runner Vision mode.
- Runner Vision intensity.
- Show speed.
- Show direction indicator.

**Accessibility**

- Reduced camera motion.
- Reduced head bob.
- Reduced FOV changes.
- UI contrast options.

**Audio**

- Master volume.
- Effects volume.
- Ambient volume.
- UI volume.

**Language**

- Display language.

The selected language is a Settings preference (`general.language`); the Localization System resolves and applies the corresponding resources (`27_LOCALIZATION_SYSTEM_SPEC.md`).

Each category's values are owned and applied by the corresponding system as defined in `25_SETTINGS_SYSTEM_SPEC.md`.

The exact set of settings may be reduced for the initial implementation.

### 13.3 Settings Persistence

Setting values are owned by the Settings System and persisted by the Save System.

The Settings screen must not write to IndexedDB or implement its own persistence layer.

Settings should be loaded before gameplay begins.

Invalid or missing settings must fall back to safe defaults.

### 13.4 Settings Validation

Validation is owned by the Settings System; the screen displays validation errors and must not silently accept invalid values.

Examples:

- Mouse sensitivity must remain within a reasonable range.
- Volume values must remain between 0 and 1.
- UI scale must not produce unusable layouts.
- Unsupported display settings must not break the application.

### 13.5 Reset to Defaults

Provide a reset action that requests restore-to-defaults through the Settings System.

Require confirmation if the operation changes multiple settings.

---

## 14. Input and Interaction

### 14.1 Keyboard and Mouse

The initial interface targets keyboard and mouse.

Support:

- Mouse click.
- Keyboard focus.
- Enter.
- Escape.
- Arrow keys where appropriate.

### 14.2 Pointer Lock

During gameplay:

- Request pointer lock when appropriate.
- Release pointer lock when opening menus.
- Restore it after resuming gameplay when required.

Do not request pointer lock before a valid user gesture.

### 14.3 Focus Management

When a menu opens:

- Move focus to an appropriate element.
- Preserve predictable keyboard navigation.
- Prevent gameplay input from activating menu controls unintentionally.

When gameplay resumes:

- Restore gameplay input ownership.
- Avoid duplicate event listeners.

### 14.4 Input Conflict Prevention

Menu input and gameplay input must not process the same key simultaneously.

For example, pressing Escape to pause must not also trigger an unrelated gameplay action.

Use explicit input context management.

---

## 15. Notifications and Feedback

### 15.1 Notification Types

Initial notification categories:

- Checkpoint activated.
- Exercise completed.
- New personal best.
- Run completed.
- Invalid run.
- Settings updated.
- Error or warning.

### 15.2 Notification Rules

Notifications should:

- Be short.
- Have a clear purpose.
- Appear near a consistent screen location.
- Disappear automatically when appropriate.
- Avoid blocking movement.

### 15.3 Feedback Channels

Use a combination of:

- Visual feedback.
- Audio feedback.
- Small UI animations.

Do not communicate critical information through sound alone.

### 15.4 Error Messages

Errors should be understandable.

Avoid exposing internal stack traces or technical implementation details to the player.

Development builds may include additional diagnostics.

---

## 16. UI Animation

### 16.1 General Principles

Animations should be subtle and fast.

Use them to communicate:

- Screen transitions.
- Focus changes.
- Button selection.
- Checkpoint activation.
- Progress updates.
- Results presentation.

### 16.2 Animation Guidelines

Suggested durations:

| Animation | Duration |
|---|---:|
| Button hover/focus | 100–150 ms |
| Small notification | 150–250 ms |
| Menu transition | 200–300 ms |
| Results reveal | 250–400 ms |

These are initial guidelines.

### 16.3 Performance

Avoid expensive full-screen animations.

UI animations must not block the render loop.

Prefer CSS transforms and opacity where appropriate.

### 16.4 Reduced Motion

Respect the effective reduced-motion configuration coordinated by the Accessibility System (`26_ACCESSIBILITY_SYSTEM_SPEC.md`); the preference is owned by the Settings System.

When enabled:

- Reduce large transitions.
- Disable unnecessary scaling.
- Reduce animated highlights.
- Keep important state changes visible.

---

## 17. Responsive Behavior

### 17.1 Desktop Layout

The initial target is desktop browser gameplay.

The UI must adapt to:

- 1280 × 720.
- 1920 × 1080.
- 2560 × 1440.
- Ultrawide aspect ratios.

These are representative test sizes, not an exhaustive compatibility guarantee.

### 17.2 Layout Adaptation

Use flexible layout techniques:

- CSS Grid.
- Flexbox.
- Relative dimensions.
- Viewport-aware spacing.
- Maximum content widths.

Avoid hardcoding every element's position in pixels.

### 17.3 Ultrawide Displays

On ultrawide displays:

- Keep menus within a readable content width.
- Avoid spreading critical UI to extreme edges.
- Preserve HUD alignment.
- Avoid excessive empty horizontal space.

### 17.4 Small Windows

If the browser viewport becomes too small:

- Keep critical UI accessible.
- Reduce nonessential decoration.
- Allow menu scrolling where appropriate.
- Avoid overlapping controls.

The game may display a recommended minimum viewport message if gameplay becomes impractical.

---

## 18. Accessibility Requirements

Accessibility preferences are stored by the Settings System and coordinated by the Accessibility System (`26_ACCESSIBILITY_SYSTEM_SPEC.md`). The UI presents the effective settings and applies them to its own presentation; it does not own accessibility preferences or replace domain behavior.

Support the following where practical:

- High-contrast text.
- Keyboard navigation.
- Visible focus indicators.
- Reduced camera motion.
- Adjustable UI scale.
- Adjustable Runner Vision intensity.
- Adjustable mouse sensitivity.
- Clear error and success messages.
- Color-independent gameplay indicators.

Camera motion, bob, and FOV effects are applied by the Camera System; movement physics remain unchanged by accessibility settings.

Avoid flashing effects and excessive screen shake.

The interface should remain usable without relying exclusively on color perception.

---

## 19. UI Performance and Cleanup

### 19.1 Performance

- Avoid unnecessary DOM updates.
- Update timer text only when displayed values change.
- Avoid creating new DOM nodes every frame.
- Reuse UI components.
- Avoid excessive CSS filters and blur.
- Keep event handlers stable.
- Avoid layout thrashing.

### 19.2 HUD Updates

The HUD should subscribe to relevant gameplay state.

Examples:

- Timer updates.
- Player speed updates.
- Checkpoint progress.
- Runner Vision state.

Do not poll every gameplay system independently every frame if an event-driven update is sufficient.

### 19.3 Cleanup

When a screen is removed:

- Unsubscribe from events.
- Remove event listeners.
- Cancel pending UI work.
- Release references.
- Remove owned DOM nodes.

Repeatedly opening and closing screens must not create duplicate listeners or stale UI state.

---

## 20. Testing Requirements

### 20.1 Main Menu

Verify:

- All menu actions work.
- Keyboard navigation works.
- Focus state is visible.
- Returning from submenus restores the expected state.

### 20.2 HUD

Verify:

- Timer matches the run timer.
- Speed matches the player movement system.
- Checkpoint progress is accurate.
- Runner Vision displays the correct target.
- HUD visibility follows gameplay state.

### 20.3 Training

Verify:

- Instructions correspond to the active exercise.
- Control hints use current bindings.
- Completion messages appear only after valid actions.
- Progress updates correctly.

### 20.4 Results

Verify:

- Time formatting is correct.
- Statistics match the recorded run.
- Personal best comparison is correct.
- Invalid runs are not saved.
- Retry resets the game correctly.

### 20.5 Leaderboard

Verify:

- Records survive reload.
- Sorting is correct.
- Equal times use timestamp tie-breaking.
- Empty state is correct.
- Clear-records confirmation works.

### 20.6 Settings

Verify:

- Values persist.
- Invalid values fall back safely.
- Changes take effect in the correct systems.
- Reset restores defaults.

### 20.7 Responsive Testing

Test representative viewport sizes and aspect ratios.

Verify that no critical controls become inaccessible or overlap.

---

## 21. Implementation Roadmap

Implement the UI incrementally.

### Phase 1 — UI Foundation

1. Create UI root.
2. Define design tokens.
3. Implement basic layout primitives.
4. Implement UI state handling.
5. Implement screen lifecycle.

### Phase 2 — Main Menu

6. Implement Main Menu.
7. Add Training and Prologue navigation.
8. Add keyboard and mouse interaction.

### Phase 3 — Gameplay HUD

9. Implement timer display.
10. Implement speed display.
11. Implement checkpoint progress.
12. Implement direction indicator.
13. Integrate Runner Vision.

### Phase 4 — Training UI

14. Implement exercise instructions.
15. Implement control hints.
16. Implement progress display.
17. Implement completion feedback.

### Phase 5 — Results and Leaderboard

18. Implement Results screen.
19. Integrate local records.
20. Implement leaderboard display.
21. Add invalid-run presentation.

### Phase 6 — Settings and Polish

22. Implement settings categories.
23. Integrate persistence through the Settings System and Save System.
24. Add pause menu.
25. Add responsive behavior.
26. Add accessibility options.
27. Profile UI performance.

Do not implement all screens before their underlying game systems exist.

---

## 22. Definition of Done

### Main Menu

- All required actions work.
- Navigation is clear.
- Keyboard and mouse input work.
- Screen transitions are stable.

### HUD

- Timer and speed are accurate.
- Checkpoint progress is correct.
- Runner Vision is useful.
- HUD does not obstruct gameplay.
- UI updates do not depend on FPS.

### Training

- Instructions are contextual.
- Control hints reflect actual bindings.
- Exercise progress is accurate.
- Completion feedback is clear.

### Results and Leaderboard

- Run statistics are displayed from authoritative snapshots.
- Personal best status is displayed from the authoritative Speedrun result.
- Valid runs are persisted by the owning systems.
- Invalid runs are excluded.
- Records survive reload.

### Settings

- Required settings are available.
- Values persist through the Settings System and Save System.
- Changes are validated by the Settings System.
- Reset works.

### Quality

- UI works at supported desktop viewport sizes.
- Keyboard focus is visible.
- Reduced-motion preferences are respected.
- No duplicate event listeners remain after screen transitions.
- No significant UI-related performance issues occur.

---

## 23. AI Agent Rules

When implementing the UI:

1. Follow this document for interface behavior and presentation.
2. Follow `04_ASSET_BIBLE.md` for the visual palette.
3. Follow `02_TECHNICAL_ARCHITECTURE.md` for system boundaries.
4. Use existing application state and event architecture.
5. Keep gameplay state outside UI components.
6. Use typed interfaces and explicit event contracts.
7. Avoid unnecessary DOM abstractions.
8. Do not update every UI element every frame.
9. Ensure all controls perform their advertised actions.
10. Implement proper event and DOM cleanup.
11. Keep accessibility in scope.
12. Do not add online services or external dependencies without approval.
13. Verify persistence and reload behavior through the owning systems, not through direct UI storage access.
14. Do not modify unrelated gameplay systems.
15. Resolve user-facing strings through the Localization System and setting values through the Settings System.

If the underlying game system is not implemented yet, create only the UI structure needed for the current vertical slice. Do not simulate successful gameplay behavior with fake data in production code.

---

## 24. Final Design Principle

The interface should feel like an extension of the environment: precise, restrained, and functional.

Menus provide access.

HUD provides awareness.

Runner Vision provides guidance.

Results provide motivation to improve.

No interface element should compete with the player's movement or the environment.

**The player should focus on the route, not on managing the interface.**