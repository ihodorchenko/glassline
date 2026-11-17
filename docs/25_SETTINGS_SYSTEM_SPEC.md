# 25_SETTINGS_SYSTEM_SPEC.md

# Settings System Specification

**Project:** Glassline — First-Person Parkour Game  
**Document:** Settings System  
**Version:** 2.0  
**Status:** Implementation Specification  
**Priority:** Core System

---

## 1. Purpose

The Settings System manages the player's configurable application and gameplay preferences.

It provides a centralized configuration model for all supported settings and coordinates their runtime application, validation, persistence, reset behavior, and change notifications.

The system ensures that different gameplay and presentation systems use a consistent set of configuration values.

It supports:

- Audio settings.
- Input settings.
- Camera settings.
- Display settings.
- HUD settings.
- Accessibility settings.
- Gameplay assistance settings.
- Localization settings, including the selected language (`general.language`).
- Default configurations.
- Runtime configuration updates.
- Temporary settings previews.
- Settings validation.
- Persistence.
- Reset to defaults.
- Configuration migration.

The initial implementation must cover all settings required by the existing gameplay and UI specifications.

---

## 2. Design Philosophy

### 2.1 Single Configuration Authority

The Settings System is the authoritative owner of user-configurable settings.

Individual systems may consume settings and apply them to their runtime behavior, but must not independently maintain competing copies of user preferences.

### 2.2 Separation of Configuration and Application

A setting has two distinct responsibilities:

1. Store the user's desired value.
2. Apply that value to the relevant runtime system.

The Settings System owns the configuration value.

The target system owns its runtime implementation.

For example:

- Settings System owns mouse sensitivity.
- Input System applies mouse sensitivity to input processing.
- Settings System owns camera motion intensity.
- Camera System applies camera motion parameters.

### 2.3 Predictable Changes

Settings changes must have explicit application behavior.

Some settings can be applied immediately.

Others require confirmation, a preview, or an application restart.

### 2.4 Safe Persistence

Settings must be saved without blocking gameplay or UI interaction.

Temporary preview values must not accidentally overwrite committed settings.

### 2.5 Extensibility

New settings should be added through definitions and domain integrations without requiring a redesign of the central settings infrastructure.

---

## 3. Scope and Ownership

### 3.1 Settings System Responsibilities

The Settings System owns:

- Settings definitions.
- Default values.
- Current committed values.
- Temporary preview values.
- Setting validation.
- Setting metadata.
- Setting categories.
- Application policies.
- Configuration snapshots.
- Change notifications.
- Reset operations.
- Settings schema versioning.
- Migration coordination.
- Persistence coordination.
- Runtime application orchestration.
- The canonical selected-language preference (`general.language`).

### 3.2 Non-responsibilities

The Settings System does not own:

- Settings screen UI.
- Input device event processing.
- Audio playback.
- Camera rendering.
- Movement physics.
- HUD rendering.
- Display rendering implementation.
- IndexedDB implementation.
- Gameplay rules.
- Application navigation.
- Translation resources, translation resolution, and localized string formatting.

### 3.3 Ownership Table

| Responsibility | Owner |
|---|---|
| Setting definitions and values | Settings System |
| Selected language preference (`general.language`) | Settings System |
| Settings UI | Menu System |
| Input behavior | Input System |
| Audio behavior | Audio System |
| Camera behavior | Camera System |
| HUD behavior | HUD System |
| Display application | Rendering / Platform layer |
| Accessibility presentation | UI / Accessibility layer |
| Translation resources and resolution | Localization System |
| Language selector presentation | Menu System |
| Persistence infrastructure | Save System |
| Configuration serialization | Settings System through Save System |

### 3.4 Related Specifications

- `02_TECHNICAL_ARCHITECTURE.md`
- `07_UI_UX_SPEC.md`
- `08_AUDIO_DESIGN_SPEC.md`
- `10_SAVE_SYSTEM_SPEC.md`
- `11_INPUT_SYSTEM_SPEC.md`
- `13_CAMERA_SYSTEM_SPEC.md`
- `20_GAMEPLAY_FLOW_SYSTEM_SPEC.md`
- `23_HUD_SYSTEM_SPEC.md`
- `24_MENU_SYSTEM_SPEC.md`
- `26_ACCESSIBILITY_SYSTEM_SPEC.md`
- `27_LOCALIZATION_SYSTEM_SPEC.md`

---

## 4. Architecture

### 4.1 Core Components

The initial implementation should contain:

- `SettingsManager`
- `SettingsRegistry`
- `SettingsDefinitionProvider`
- `SettingsRepository`
- `SettingsValidator`
- `SettingsSnapshotProvider`
- `SettingsTransactionManager`
- `SettingsApplicationCoordinator`
- `SettingsChangeDispatcher`
- `SettingsMigrationManager`
- `SettingsResetCoordinator`
- `SettingsDefaultProvider`
- `SettingsEvents`

### 4.2 Component Responsibilities

**SettingsManager**

Public entry point for reading and modifying settings.

**SettingsRegistry**

Registers supported setting definitions.

**SettingsDefinitionProvider**

Provides metadata, defaults, constraints, and application policies.

**SettingsRepository**

Loads and saves settings through Save System.

**SettingsValidator**

Validates values against registered definitions.

**SettingsSnapshotProvider**

Creates immutable snapshots for consumers.

**SettingsTransactionManager**

Manages temporary edits, previews, commits, and rollback.

**SettingsApplicationCoordinator**

Coordinates applying configuration changes to owning systems.

**SettingsChangeDispatcher**

Publishes setting change notifications.

**SettingsMigrationManager**

Handles settings schema migrations.

**SettingsResetCoordinator**

Coordinates restoring defaults.

**SettingsDefaultProvider**

Provides initial and platform-specific defaults.

---

## 5. Settings Data Model

### 5.1 SettingsConfiguration

```ts
interface SettingsConfiguration {
    schemaVersion: number;

    revision: number;

    updatedAt: number;

    values: Record<string, SettingValue>;
}
```

This is the persisted configuration model.

It must not contain temporary preview state.

### 5.2 SettingValue

```ts
type SettingValue =
    | boolean
    | number
    | string
    | string[];
```

Only explicitly supported serializable value types are allowed.

Arbitrary objects and executable values must not be stored as setting values.

### 5.3 SettingDefinition

```ts
interface SettingDefinition<T extends SettingValue = SettingValue> {
    id: string;

    category: SettingCategory;

    type: SettingType;

    defaultValue: T;

    description?: string;

    applyPolicy: SettingApplyPolicy;

    constraints?: SettingConstraints;

    platformSupport?: string[];

    requiresRestart?: boolean;
}
```

### 5.4 Setting Categories

```ts
type SettingCategory =
    | "general"
    | "audio"
    | "controls"
    | "camera"
    | "display"
    | "hud"
    | "accessibility"
    | "gameplay";
```

The `general` category holds application-wide preferences that are not owned by a single domain-specific adapter, including `general.language`.

### 5.5 Setting Types

```ts
type SettingType =
    | "boolean"
    | "number"
    | "integer"
    | "string"
    | "enum"
    | "key_binding";
```

The type determines validation and UI metadata.

### 5.6 Setting Constraints

```ts
interface SettingConstraints {
    minimum?: number;

    maximum?: number;

    step?: number;

    allowedValues?: SettingValue[];

    minimumLength?: number;

    maximumLength?: number;
}
```

Validation must also verify that the value's runtime type matches the definition.

### 5.7 Apply Policies

```ts
type SettingApplyPolicy =
    | "immediate"
    | "preview"
    | "on_commit"
    | "requires_confirmation"
    | "requires_restart";
```

These policies describe the expected behavior when a setting changes.

They do not replace the transaction lifecycle.

---

## 6. Setting Lifecycle

### 6.1 Lifecycle Stages

A setting may pass through the following stages:

```text
Definition Registered
        |
        v
Default Value Resolved
        |
        v
Persisted Value Loaded
        |
        v
Value Validated
        |
        v
Runtime Configuration Applied
        |
        v
Configuration Ready
```

### 6.2 Initialization

During application startup:

1. Register setting definitions.
2. Resolve platform-specific defaults.
3. Load persisted configuration.
4. Validate the configuration schema.
5. Migrate older versions if necessary.
6. Resolve missing values.
7. Validate individual values.
8. Build the initial immutable snapshot.
9. Apply settings to their owning systems.
10. Publish the initial configuration-ready event.

### 6.3 Missing Values

If a setting is absent from persisted data:

- Use its default value.
- Add it to the in-memory configuration.
- Persist it through the normal save process.

### 6.4 Invalid Values

If a setting value is invalid:

- Replace it with a valid default.
- Record a diagnostic.
- Continue loading other valid settings.
- Do not discard the entire configuration unless the root schema is unusable.

### 6.5 Unknown Settings

Unknown setting IDs may belong to a newer application version or an optional feature.

The migration layer should preserve unknown values where safe.

They must not be applied to runtime systems until a valid definition is registered.

---

## 7. Settings Categories and Initial Definitions

The following settings form the initial supported configuration.

Values are starting defaults and may be tuned during implementation.

### 7.1 Audio Settings

| ID | Type | Default | Range |
|---|---|---:|---|
| `audio.master_volume` | Number | 1.0 | 0.0–1.0 |
| `audio.music_volume` | Number | 0.8 | 0.0–1.0 |
| `audio.sfx_volume` | Number | 1.0 | 0.0–1.0 |
| `audio.ui_volume` | Number | 0.8 | 0.0–1.0 |
| `audio.muted` | Boolean | false | — |

Audio System owns runtime volume application.

The Settings System only stores and distributes values.

### 7.2 Controls Settings

| ID | Type | Default | Range |
|---|---|---:|---|
| `controls.mouse_sensitivity` | Number | 1.0 | 0.1–5.0 |
| `controls.invert_mouse_y` | Boolean | false | — |
| `controls.gamepad_sensitivity` | Number | 1.0 | 0.1–5.0 |
| `controls.invert_gamepad_y` | Boolean | false | — |
| `controls.gamepad_dead_zone` | Number | 0.15 | 0.0–0.95 |
| `controls.gamepad_look_dead_zone` | Number | 0.10 | 0.0–0.95 |

Key bindings are managed by Input System.

Settings System may coordinate their persistence, but must not introduce a competing key-binding registry.

### 7.3 Camera Settings

| ID | Type | Default | Range |
|---|---|---:|---|
| `camera.field_of_view` | Number | 75 | 60–100 |
| `camera.bob_intensity` | Number | 1.0 | 0.0–1.5 |
| `camera.motion_intensity` | Number | 1.0 | 0.0–1.5 |

Camera System applies camera-specific parameters.

Look sensitivity is owned by the Input System as `controls.mouse_sensitivity` and `controls.gamepad_sensitivity`. The Camera System consumes the effective look input and must not maintain a second editable sensitivity setting.

Reduced motion is a shared accessibility preference, not a camera setting. Its canonical ID is `accessibility.reduced_motion` (§7.6).

Do not maintain two independently editable settings that control the same input path.

### 7.4 Display Settings

| ID | Type | Default | Notes |
|---|---|---|---|
| `display.fullscreen` | Boolean | false | Platform-dependent |
| `display.resolution` | String | `auto` | Supported modes only |
| `display.quality` | Enum | `medium` | Platform-dependent |
| `display.vsync` | Boolean | true | If supported |

Unsupported display options must not be exposed as active controls.

### 7.5 HUD Settings

| ID | Type | Default |
|---|---|---|
| `hud.enabled` | Boolean | true |
| `hud.show_speed_indicator` | Boolean | true |
| `hud.show_speedrun_timer` | Boolean | true |
| `hud.show_section_progress` | Boolean | true |
| `hud.show_training_objectives` | Boolean | true |
| `hud.show_training_hints` | Boolean | true |
| `hud.show_interaction_prompts` | Boolean | true |
| `hud.ui_scale` | Number | 1.0 |

Recommended UI scale range: 0.8–1.4.

HUD System owns presentation behavior.

### 7.6 Accessibility Settings

| ID | Type | Default |
|---|---|---|
| `accessibility.reduced_motion` | Boolean | false |
| `accessibility.high_contrast` | Boolean | false |
| `accessibility.color_independent_status` | Boolean | true |
| `accessibility.large_text` | Boolean | false |

Accessibility settings may affect multiple presentation systems.

They should be applied through a coordinated accessibility configuration.

### 7.7 Gameplay Settings

| ID | Type | Default |
|---|---|---|
| `gameplay.show_tutorial_hints` | Boolean | true |
| `gameplay.contextual_assistance` | Boolean | true |
| `gameplay.training_assistance` | Enum | `standard` |
| `gameplay.show_checkpoint_feedback` | Boolean | true |

Training System owns the meaning and application of Training assistance settings.

Checkpoint feedback visibility is consumed by HUD System.

These settings must not modify authoritative checkpoint or exercise completion behavior.

### 7.8 Localization Settings

| ID | Type | Default | Notes |
|---|---|---|---|
| `general.language` | String | `en` | Must reference a registered language identifier |

The Settings System owns the stored preference. It validates that the value is a registered language identifier supplied by the Localization System.

The Localization System owns resource loading, translation resolution, formatting, and runtime language application (`27_LOCALIZATION_SYSTEM_SPEC.md`).

The Menu System presents the language selector.

Changing the language:

- Must not restart the gameplay session.
- Must not reset the level, checkpoints, or Speedrun timer.
- Must not reset Training progress.
- Must be applied through the Localization System's language-change flow.

If the requested language resources are unavailable, the previously active language remains in effect and the failure is reported.

---

## 8. Canonical Setting Ownership

### 8.1 One Setting, One Canonical Value

Some parameters may be consumed by multiple systems.

The project must define one canonical setting ID for each user preference.

For example:

- Mouse sensitivity belongs to Input configuration.
- Camera field of view belongs to Camera configuration.
- UI scale belongs to shared UI configuration.
- Reduced Motion belongs to shared Accessibility configuration.
- Selected language (`general.language`) belongs to General/Localization configuration; the Localization System consumes it and does not store a competing preference.

Other systems may consume the value without creating duplicates.

### 8.2 Shared Accessibility Settings

Reduced Motion may affect:

- Camera bob.
- Camera roll.
- HUD animations.
- Menu transitions.
- Notification animations.

The Settings System provides the canonical preference.

Each consumer determines how that preference affects its own presentation.

### 8.3 Conflicting Settings

If two settings influence the same runtime behavior, define precedence explicitly.

For example:

- `accessibility.reduced_motion` may impose a maximum allowed camera motion.
- `camera.motion_intensity` controls the user's preferred intensity.

The effective camera motion should respect both values.

The user preference must not override an accessibility restriction.

### 8.4 Derived Runtime Configuration

The Settings System may provide a composed snapshot containing raw preferences.

Domain systems calculate their effective runtime configuration according to their own rules.

Avoid storing duplicate derived values as additional persistent settings.

---

## 9. Settings Snapshot

### 9.1 SettingsSnapshot

```ts
interface SettingsSnapshot {
    revision: number;

    values: Readonly<Record<string, SettingValue>>;

    initialized: boolean;
}
```

The snapshot is immutable.

Consumers must not modify its values.

### 9.2 Public Interface

```ts
interface ISettingsManager {
    getSnapshot(): SettingsSnapshot;

    getValue<T extends SettingValue>(
        settingId: string
    ): T | undefined;

    setValue<T extends SettingValue>(
        settingId: string,
        value: T
    ): Promise<SettingOperationResult>;

    beginTransaction(
        context: string
    ): SettingsTransaction;

    resetCategory(
        category: SettingCategory
    ): Promise<SettingOperationResult>;

    resetAll(): Promise<SettingOperationResult>;

    subscribe(
        listener: SettingsListener
    ): Unsubscribe;
}
```

The actual implementation may use a transaction-scoped API for all edits performed from Settings UI.

### 9.3 Snapshot Revision

Each committed configuration update increments the revision.

Consumers may use revisions to avoid applying stale snapshots.

Temporary preview updates must have a separate transaction revision or token and must not increment the committed configuration revision.

---

## 10. Settings Transactions

### 10.1 Purpose

Transactions prevent incomplete or temporary edits from being treated as permanent configuration.

They are particularly important for settings that require confirmation.

### 10.2 SettingsTransaction

```ts
interface SettingsTransaction {
    id: string;

    context: string;

    baseRevision: number;

    status:
        | "active"
        | "previewing"
        | "committed"
        | "rolled_back"
        | "expired";
}
```

### 10.3 Transaction Operations

```ts
interface ISettingsTransaction {
    setValue(
        settingId: string,
        value: SettingValue
    ): Promise<SettingOperationResult>;

    preview(): Promise<SettingOperationResult>;

    commit(): Promise<SettingOperationResult>;

    rollback(): Promise<SettingOperationResult>;

    getSnapshot(): SettingsSnapshot;
}
```

### 10.4 Transaction Lifecycle

```text
Begin Transaction
        |
        v
Edit Temporary Values
        |
        v
Validate
        |
        v
Apply Preview If Supported
        |
        +------> Rollback
        |
        v
Commit
        |
        v
Persist
        |
        v
Publish Committed Snapshot
```

### 10.5 Transaction Isolation

A transaction must not silently overwrite unrelated committed changes.

If the committed configuration revision changes after the transaction starts:

- Detect the revision conflict.
- Rebase non-conflicting changes where safe.
- Reject or request resolution for conflicting changes.
- Never silently discard newer committed values.

### 10.6 Preview Behavior

Preview applies temporary values to the runtime system without permanently changing committed configuration.

For example:

- Camera FOV may be previewed.
- Display mode may be previewed.
- Audio volume may be previewed.

Not every setting needs preview support.

### 10.7 Commit Behavior

Commit:

1. Revalidate all changed values.
2. Check transaction revision.
3. Apply required runtime changes.
4. Persist the committed configuration.
5. Publish the new immutable snapshot.
6. Close the transaction.

The implementation must define recovery behavior if runtime application or persistence fails.

### 10.8 Rollback Behavior

Rollback restores the previously committed effective values for all settings modified by the transaction.

It must not revert unrelated changes committed by another transaction.

### 10.9 Transaction Lifetime

Transactions must not remain active indefinitely.

When a settings screen is closed or its context is destroyed:

- Commit explicitly accepted changes.
- Roll back unconfirmed temporary changes.
- Release transaction resources.

---

## 11. Settings Application Pipeline

### 11.1 Purpose

Coordinates applying changed settings to owning systems.

### 11.2 Application Adapters

Each domain system provides an application adapter.

```ts
interface ISettingsApplicationAdapter {
    readonly domain: SettingCategory;

    validate(
        values: Readonly<Record<string, SettingValue>>
    ): ValidationResult;

    apply(
        snapshot: SettingsSnapshot
    ): Promise<SettingsApplyResult>;
}
```

The exact adapter boundaries may be more granular than one adapter per category.

The `general` category (including `general.language`) is applied through the Localization integration (`27_LOCALIZATION_SYSTEM_SPEC.md`); it is not owned by one of the domain-specific adapters below.

### 11.3 Application Order

When several settings change together, apply them in a deterministic order.

Recommended order:

1. Platform and display configuration.
2. Localization configuration and resource availability.
3. Input configuration.
4. Audio configuration.
5. Camera configuration.
6. Accessibility configuration.
7. HUD configuration.
8. Gameplay assistance configuration.

The actual order must respect dependency relationships.

Localization must be applied before presentation layers refresh visible strings, so that a language change does not briefly render mixed-language UI.

### 11.4 Application Failure

If an adapter fails:

- Report the failed setting or domain.
- Avoid marking the entire operation as successfully applied.
- Roll back temporary preview changes where possible.
- Preserve the last known valid runtime configuration.
- Report persistence status separately.

### 11.5 Partial Application

Some runtime changes cannot be reversed perfectly.

For these operations:

- Use explicit confirmation policies.
- Define fallback behavior.
- Keep the committed configuration consistent with the actual runtime state.
- Avoid reporting success when the runtime is in an unknown state.

### 11.6 Application Status

```ts
type SettingsApplyStatus =
    | "pending"
    | "applied"
    | "partially_applied"
    | "failed"
    | "requires_restart";
```

---

## 12. Display Settings Confirmation

### 12.1 Purpose

Some display changes may make the application difficult to use.

The player must be able to revert them if the new configuration is not acceptable.

### 12.2 Confirmation Flow

```text
Select Display Mode
        |
        v
Apply Temporary Configuration
        |
        v
Show Confirmation Dialog
        |
        +------> Confirm
        |           |
        |           v
        |       Commit
        |
        +------> Cancel / Timeout
                    |
                    v
                Rollback
```

### 12.3 Requirements

- Temporary display changes must be reversible where platform capabilities permit.
- A confirmation timeout must be bounded.
- Losing window focus must not accidentally confirm a change.
- A failed display operation must return a recoverable result.
- The previous known-good configuration must be preserved.

### 12.4 Unsupported Platforms

If the browser cannot reliably change display mode or resolution, the relevant controls must be hidden or disabled with an explanation.

---

## 13. Persistence Integration

### 13.1 Ownership

Settings System owns configuration semantics.

Save System owns persistence infrastructure.

### 13.2 Repository Interface

```ts
interface ISettingsRepository {
    load(): Promise<SettingsConfiguration | null>;

    save(
        configuration: SettingsConfiguration
    ): Promise<void>;

    reset(): Promise<void>;
}
```

The repository implementation must delegate to Save System.

### 13.3 Persistence Rules

- Persist committed values only.
- Never persist temporary previews.
- Save after successful configuration commits.
- Avoid unnecessary writes when values have not changed.
- Preserve valid values when an unrelated setting fails validation.
- Persist the selected language as part of the committed configuration; do not store a separate language copy outside Settings.
- Use schema versioning.

### 13.4 Save Failure

If persistence fails after runtime application:

- Keep the runtime value if it is safe to do so.
- Mark persistence as pending or failed.
- Notify the user when appropriate.
- Retry according to Save System policy.
- Do not falsely report that the configuration was durably saved.

The application must distinguish:

- Runtime applied.
- Configuration committed in memory.
- Configuration persisted.

These are separate outcomes.

### 13.5 Startup

Settings must be loaded and applied before gameplay systems depend on their configuration.

A default configuration must be available if storage is unavailable.

---

## 14. Reset to Defaults

### 14.1 Reset Scope

Support:

- Reset one setting.
- Reset one category.
- Reset all settings.

### 14.2 Reset Behavior

A reset operation must:

1. Resolve the correct default values.
2. Validate the default configuration.
3. Apply changes through the relevant adapters.
4. Persist the resulting configuration.
5. Publish change notifications.
6. Update the configuration snapshot.

### 14.3 Category Reset

Resetting Audio must not modify Camera or Progression settings.

### 14.4 Full Reset

Reset All Settings must not:

- Delete player progression.
- Delete Training records.
- Delete Speedrun history.
- Delete application data unrelated to settings.

### 14.5 Confirmation

Full reset and reset operations with disruptive runtime effects require confirmation through Menu System.

---

## 15. Platform-Specific Defaults

### 15.1 Purpose

Some defaults may depend on platform capabilities.

Examples:

- Display mode.
- Resolution.
- VSync support.
- Gamepad availability.
- Audio capabilities.

### 15.2 Default Resolution

The default provider may use platform information to resolve supported values.

### 15.3 Portability

A setting saved on one platform may be unsupported on another.

The Settings System must:

- Validate platform compatibility.
- Select a safe fallback.
- Preserve the original value where useful.
- Avoid repeatedly attempting unsupported configurations.

### 15.4 Runtime Capability Registry

The platform layer may expose available capabilities.

Settings definitions should be filtered against this capability information before the Menu System presents controls.

---

## 16. Input Settings Integration

### 16.1 Ownership

Input System owns:

- Input actions.
- Device mapping.
- Key bindings.
- Gamepad mappings.
- Dead-zone application.
- Pointer lock.
- Input processing.

Settings System owns general user preferences related to input.

### 16.2 Settings

Initial shared preferences:

- Mouse sensitivity.
- Mouse Y inversion.
- Gamepad sensitivity.
- Gamepad Y inversion.
- Gamepad movement dead zone.
- Gamepad look dead zone.

### 16.3 Key Bindings

Key bindings are specialized input configuration.

The Settings System may coordinate their persistence through Save System, but Input System owns their schema and semantics.

Avoid defining a second key-binding representation.

### 16.4 Application

Input System must apply changed settings without requiring a gameplay session restart unless technically necessary.

---

## 17. Camera Settings Integration

### 17.1 Ownership

Camera System owns camera runtime behavior.

### 17.2 Settings

- Field of View.
- Camera Bob Intensity.
- Camera Motion Intensity.
- Reduced Motion.

### 17.3 Effective Configuration

Camera System computes effective presentation parameters.

For example:

```ts
interface EffectiveCameraSettings {
    fieldOfView: number;

    bobIntensity: number;

    rollIntensity: number;

    landingEffectIntensity: number;
}
```

Effective values may be constrained by Reduced Motion.

### 17.4 Runtime Updates

Camera settings should update without recreating the camera rig.

Settings must not directly manipulate the camera transform.

---

## 18. Audio Settings Integration

### 18.1 Ownership

Audio System owns audio playback and mixing.

### 18.2 Settings

- Master Volume.
- Music Volume.
- SFX Volume.
- UI Volume.
- Mute.

### 18.3 Application

Audio changes should apply immediately where supported.

Volume updates must not restart audio playback.

### 18.4 Mute

Mute must be treated as a user preference rather than destructive modification of individual volume values.

Unmuting must restore the previously selected volume levels.

---

## 19. HUD and UI Settings Integration

### 19.1 HUD

HUD System consumes:

- HUD Enabled.
- Speed Indicator Visibility.
- Speedrun Timer Visibility.
- Section Progress Visibility.
- Training Objective Visibility.
- Training Hint Visibility.
- Interaction Prompt Visibility.
- UI Scale.

### 19.2 Shared UI

Menu System and HUD System may share UI scale and accessibility configuration.

They must use the same canonical values.

### 19.3 Reduced Motion

Menu transitions, HUD animations, and camera motion should all respect the shared accessibility preference.

### 19.4 High Contrast

The UI presentation layer owns high-contrast rendering.

Settings System supplies the preference.

---

## 20. Gameplay Assistance Settings

### 20.1 Purpose

Provides player-controlled assistance preferences.

### 20.2 Initial Settings

- Tutorial hints enabled.
- Contextual assistance enabled.
- Training assistance level.
- Checkpoint feedback enabled.

### 20.3 Ownership

Training System owns the interpretation of Training assistance.

HUD System owns whether optional feedback is presented.

Checkpoint System owns checkpoint activation behavior.

Settings must never disable authoritative checkpoint validation or other required gameplay rules.

### 20.4 Future Expansion

Additional assistance settings may be introduced for:

- More forgiving timing.
- Extended tutorial guidance.
- Alternative control layouts.
- Additional movement explanations.

Do not introduce difficulty modifiers or accessibility gameplay changes without an explicit gameplay design.

---

## 21. Settings Events

### 21.1 Event Model

```ts
interface SettingChangedEvent {
    settingId: string;

    previousValue: SettingValue;

    currentValue: SettingValue;

    revision: number;

    source: string;
}
```

### 21.2 Configuration Events

```ts
interface SettingsConfigurationChangedEvent {
    revision: number;

    changedSettingIds: string[];

    occurredAt: number;
}
```

### 21.3 Lifecycle Events

The system should publish:

- Settings Loaded.
- Settings Initialized.
- Settings Preview Started.
- Settings Preview Applied.
- Settings Committed.
- Settings Rolled Back.
- Settings Persistence Failed.
- Settings Reset.
- Settings Application Failed.

### 21.4 Event Rules

- Events are emitted only after the corresponding state transition.
- Preview events are distinct from committed change events.
- Failed operations must not emit successful commit events.
- Consumers must be able to identify the configuration revision.
- Event subscriptions must be removable.

---

## 22. Concurrency and Consistency

### 22.1 Single Authority

Only Settings Manager may mutate committed configuration.

### 22.2 Concurrent Transactions

The system must handle overlapping transactions safely.

Examples:

- Settings screen edits.
- Platform configuration changes.
- External system requests.
- Reset operation.

### 22.3 Conflict Resolution

Concurrent changes must not silently overwrite newer values.

Use revision checks and explicit conflict handling.

### 22.4 Runtime Application

Changes must be applied in a deterministic order.

If two adapters depend on the same setting, they must receive the same committed or preview snapshot.

### 22.5 External Changes

If a platform-level setting changes outside the application, the platform adapter may report the actual state.

Settings System must decide whether to:

- Update the committed preference.
- Mark it unsupported.
- Apply a safe fallback.
- Notify the user.

External changes must not bypass validation.

---

## 23. Performance and Reliability

Requirements:

- No per-frame settings validation.
- No synchronous storage operations.
- No unnecessary configuration serialization.
- No repeated runtime adapter application for unchanged values.
- No duplicated setting definitions.
- No mutable snapshots exposed to consumers.
- No preview values accidentally persisted.
- No orphaned transactions.
- No unbounded change-event history.
- No blocking gameplay initialization on optional settings.
- No silent application failures.

Configuration changes should be lightweight and event-driven.

---

## 24. Testing Requirements

### 24.1 Definition Tests

Test:

- Unique setting IDs.
- Valid categories.
- Valid types.
- Valid defaults.
- Valid constraints.
- Supported application policies.
- Platform capability filtering.

### 24.2 Validation Tests

Test:

- Valid numeric values.
- Out-of-range numeric values.
- Invalid boolean values.
- Invalid enum values.
- Missing values.
- Unknown values.
- Wrong runtime types.
- Boundary values.

### 24.3 Initialization Tests

Test:

- No persisted configuration.
- Valid persisted configuration.
- Missing settings.
- Invalid individual settings.
- Invalid root schema.
- Migration from previous versions.
- Unsupported platform values.

### 24.4 Transaction Tests

Test:

- Begin transaction.
- Change values.
- Preview.
- Commit.
- Rollback.
- Expired transaction.
- Concurrent transaction.
- Revision conflict.
- Preview failure.
- Commit failure.

### 24.5 Application Tests

Test:

- Immediate application.
- Preview application.
- Application ordering.
- Adapter failure.
- Partial application.
- Runtime rollback.
- Requires restart behavior.

### 24.6 Persistence Tests

Test:

- Initial load.
- Save.
- Reload.
- Save failure.
- Pending persistence.
- Reset.
- Migration.
- Unknown setting preservation.

### 24.7 Integration Tests

Test:

- Audio volume changes.
- Input sensitivity changes.
- Camera FOV changes.
- Camera Reduced Motion.
- HUD visibility.
- UI scale.
- Accessibility settings.
- Gameplay assistance settings.
- Selected language change applied through the Localization System.
- Language preference persists across reload and is restored on startup.
- Invalid or unregistered language identifier is rejected without breaking the UI.

### 24.8 User Flow Tests

Test:

1. Open Settings.
2. Change multiple settings.
3. Apply immediate values.
4. Preview a temporary value.
5. Confirm or revert it.
6. Leave Settings.
7. Reopen Settings.
8. Verify persisted values.
9. Restore one category.
10. Restore all settings.

---

## 25. Implementation Phases

### Phase 1: Core Data Model

Implement:

- SettingsConfiguration.
- SettingDefinition.
- SettingValue.
- SettingConstraints.
- SettingApplyPolicy.
- SettingsSnapshot.

### Phase 2: Registry and Validation

Implement:

- SettingsRegistry.
- SettingsDefinitionProvider.
- SettingsDefaultProvider.
- SettingsValidator.
- Platform capability filtering.

### Phase 3: Persistence

Implement:

- SettingsRepository.
- Save System integration.
- Schema versioning.
- Migration.
- Startup initialization.

### Phase 4: Configuration Management

Implement:

- SettingsManager.
- Snapshot provider.
- Change dispatcher.
- Revision tracking.
- Configuration subscriptions.

### Phase 5: Transactions

Implement:

- SettingsTransactionManager.
- Temporary values.
- Preview.
- Commit.
- Rollback.
- Conflict handling.

### Phase 6: Runtime Application

Implement adapters for:

- Input.
- Audio.
- Camera.
- Display.
- HUD.
- Accessibility.
- Gameplay assistance.

### Phase 7: Reset and Recovery

Implement:

- Reset single setting.
- Reset category.
- Reset all.
- Application failure handling.
- Persistence retry coordination.

### Phase 8: UI Integration

Integrate:

- Menu Settings screen.
- Sliders.
- Toggles.
- Select controls.
- Key binding editor.
- Display confirmation.
- Restore Defaults confirmation.

### Phase 9: Validation

Run:

- Unit tests.
- Transaction tests.
- Persistence tests.
- Adapter integration tests.
- Settings UI tests.
- End-to-end settings tests.

---

## 26. Acceptance Criteria

The implementation is accepted when:

1. Settings have a single authoritative manager.
2. All supported settings have stable identifiers.
3. Definitions contain defaults and validation constraints.
4. Invalid values cannot be applied.
5. Missing values resolve to defaults.
6. Platform-specific capabilities are respected.
7. Settings snapshots are immutable.
8. Committed configuration has revision tracking.
9. Temporary previews are separate from committed values.
10. Transactions support commit and rollback.
11. Concurrent transactions cannot silently overwrite newer values.
12. Runtime application is delegated to domain adapters.
13. Application failures are reported.
14. Persistence uses Save System.
15. Preview values are never persisted.
16. Reset operations are scoped correctly.
17. Full settings reset does not delete progression.
18. Reduced Motion is shared across Camera, HUD, and Menu.
19. Input settings are applied through Input System.
20. Audio settings are applied through Audio System.
21. Camera settings are applied through Camera System.
22. HUD settings are applied through HUD System.
23. The selected language is stored as `general.language` by Settings System.
24. Language change is applied through the Localization System.
25. A language change does not restart the session or reset gameplay state.
26. Localization System does not maintain a competing language preference.
27. Settings UI contains no duplicated business logic.
28. Schema migration preserves valid settings.
29. Unit and integration tests pass.

---

## 27. Definition of Done

- [ ] Settings architecture implemented.
- [ ] SettingsManager implemented.
- [ ] SettingsRegistry implemented.
- [ ] Default provider implemented.
- [ ] SettingsValidator implemented.
- [ ] SettingsSnapshot implemented.
- [ ] SettingsRepository integrated.
- [ ] Save System integration complete.
- [ ] Schema versioning implemented.
- [ ] Migration support implemented.
- [ ] Revision tracking implemented.
- [ ] Transaction manager implemented.
- [ ] Preview behavior implemented.
- [ ] Commit behavior implemented.
- [ ] Rollback behavior implemented.
- [ ] Concurrent transaction handling implemented.
- [ ] Application adapters implemented.
- [ ] Audio settings integrated.
- [ ] Input settings integrated.
- [ ] Camera settings integrated.
- [ ] Display settings integrated where supported.
- [ ] HUD settings integrated.
- [ ] Localization settings integrated.
- [ ] Accessibility settings integrated.
- [ ] Gameplay assistance settings integrated.
- [ ] Reset operations implemented.
- [ ] Application failure handling implemented.
- [ ] Persistence failure handling implemented.
- [ ] Menu System integration complete.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] End-to-end settings tests pass.
- [ ] No duplicated setting ownership exists.

---

## 28. Final Design Constraints

1. Settings System is the single authority for user-configurable preferences.
2. Every setting must have one stable canonical identifier.
3. Every setting must have one authoritative definition.
4. Every setting must have a validated default.
5. Domain systems own runtime application.
6. Menu System owns settings presentation only.
7. Save System owns persistence infrastructure.
8. Settings System must not access IndexedDB directly.
9. Temporary preview values must never be persisted.
10. Committed configuration must use revision tracking.
11. Concurrent changes must not silently overwrite each other.
12. Failed runtime application must be reported.
13. Failed persistence must be distinguishable from failed runtime application.
14. Settings reset must not erase progression or gameplay records.
15. Input System remains authoritative for key bindings.
16. Audio System remains authoritative for playback and mixing.
17. Camera System remains authoritative for camera behavior.
18. HUD System remains authoritative for HUD presentation.
19. Localization System remains authoritative for translation resources, resolution, and formatting.
20. Selected language preference is owned by Settings System as `general.language`; Localization must not maintain a competing preference.
21. Accessibility preferences must be shared across relevant systems.
22. Platform-specific settings must respect actual capabilities.
23. Unsupported settings must not be presented as functional controls.
24. Configuration snapshots must be immutable.
25. Runtime changes must be deterministic.
26. Settings must not modify gameplay state unless explicitly defined by a gameplay setting.
27. The initial implementation must avoid unnecessary configuration frameworks and dynamic plugin systems.

**End of Specification**