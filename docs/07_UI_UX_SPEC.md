# 07_UI_UX_SPEC.md

**Project:** MIRROR'S EDGE — RUNNER PROTOCOL  
**Document:** UI/UX Specification  
**Version:** 1.0  
**Status:** Design Specification  
**Applies to:** Main Menu, HUD, Training UI, Results, Leaderboard, Settings, Navigation

---

## 1. Purpose

This document defines the user interface and user experience requirements for MIRROR'S EDGE — RUNNER PROTOCOL.

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

The interface is inspired by the clean, high-contrast visual language of Mirror's Edge.

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

1. Start Run.
2. Training.
3. Local Records.
4. Settings.
5. Exit.

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

**Start Run**

- Starts a new Prologue run.
- Loads the Prologue level if necessary.
- Initializes run state.
- Presents the start sequence.

**Training**

- Opens the Training environment.
- Restores training progress if available.
- Allows access to completed exercises.

**Local Records**

- Opens the local leaderboard.
- Displays saved valid runs.

**Settings**

- Opens the settings screen.

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
| Paused | Gameplay HUD dimmed or hidden |
| Results | Hidden |
| Respawn | Temporarily simplified |

---

## 8. Runner Vision

### 8.1 Purpose

Runner Vision helps the player understand the intended route.

It should complement environmental navigation.

It must not replace level design or become a permanent glowing path through the environment.

### 8.2 Visual Elements

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
- Configurable in Settings.

Choose one consistent interaction model during implementation.

If activated by input, it must not conflict with core movement controls.

### 8.4 Highlight Priority

Prioritize:

1. Immediate next traversal target.
2. Required route transition.
3. Checkpoint.
4. Finish.

Avoid highlighting unrelated objects.

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
- Update progress.
- Unlock the next exercise.

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

- Stop active gameplay progression.
- Pause the run timer.
- Suspend or pause relevant gameplay systems.
- Release pointer lock.
- Display the pause UI.

Resume should restore the gameplay state.

### 10.4 Restart

Restart must:

- Ask for confirmation if accidental activation is likely.
- Reset the player to the starting position.
- Reset checkpoints.
- Reset run statistics.
- Reset the timer.
- Restore the initial run state.

### 10.5 Main Menu

Leaving the run must:

- Stop the timer.
- Clean up active level state.
- Release gameplay resources.
- Return to the main menu.

Do not save an incomplete run as a valid leaderboard record.

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

If the completed run is a new personal best:

- Highlight the new record.
- Display a short confirmation.
- Update the local record store.

If the run is not a new personal best:

- Display the existing record.
- Show the difference where useful.

### 11.5 Retry

Retry should immediately restart the Prologue with a clean run state.

### 11.6 Main Menu

Return to the main menu and release the current level resources.

### 11.7 Invalid Run

If the run is invalid:

- Show the completion time if useful.
- Clearly identify that the result is invalid.
- Do not save it to the valid leaderboard.
- Explain the reason where possible.
- Offer Retry and Main Menu.

---

## 12. Local Leaderboard

### 12.1 Purpose

The local leaderboard stores valid Prologue runs.

It provides a persistent personal history across browser reloads.

Online leaderboards are outside the initial scope.

### 12.2 Storage

Use IndexedDB.

The storage implementation should follow the persistence architecture in `02_TECHNICAL_ARCHITECTURE.md`.

Do not use localStorage as the primary record database.

### 12.3 Record Model

Illustrative model:

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

Use the project's established persistence model.

### 12.4 Sorting

Sort valid records by:

1. Lowest completion time.
2. Earliest completion timestamp for equal times.

The primary personal best is the valid record with the lowest duration.

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

Do not silently delete records.

### 12.8 Record Validation

Only valid completed Prologue runs may be stored.

Training results, incomplete runs, and invalid runs must not enter the leaderboard.

---

## 13. Settings Screen

### 13.1 Purpose

Settings provides control over input and presentation preferences.

Settings should persist between sessions.

### 13.2 Initial Settings Categories

**Controls**

- Mouse sensitivity.
- Invert mouse Y.
- Key bindings.
- Reset controls.

**Display**

- Resolution or browser rendering scale, where supported.
- Fullscreen.
- UI scale.
- Graphics quality.

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

The exact set of settings may be reduced for the initial implementation.

### 13.3 Settings Persistence

Use the project's settings persistence layer.

Settings should be loaded before gameplay begins.

Invalid or missing settings must fall back to safe defaults.

### 13.4 Settings Validation

Validate values.

Examples:

- Mouse sensitivity must remain within a reasonable range.
- Volume values must remain between 0 and 1.
- UI scale must not produce unusable layouts.
- Unsupported display settings must not break the application.

### 13.5 Reset to Defaults

Provide a reset action.

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

Respect the reduced-motion setting.

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
23. Add persistence.
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

- Run statistics are correct.
- Personal best is calculated correctly.
- Valid runs are persisted.
- Invalid runs are excluded.
- Records survive reload.

### Settings

- Required settings are available.
- Values persist.
- Changes are validated.
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
13. Verify persistence and reload behavior.
14. Do not modify unrelated gameplay systems.

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