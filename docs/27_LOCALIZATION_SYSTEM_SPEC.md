# 27_LOCALIZATION_SYSTEM_SPEC.md

# Localization System Specification

**Project:** Glassline — First-Person Parkour Game  
**Document:** Localization System  
**Version:** 2.0  
**Status:** Implementation Specification  
**Priority:** Core System

---

## 1. Purpose

The Localization System provides a centralized mechanism for translating and formatting all player-facing text.

It allows the game to support multiple languages without embedding language-specific strings inside gameplay, UI, or presentation systems.

The system is responsible for:

- Language selection.
- Translation resource loading.
- Translation key resolution.
- Fallback language handling.
- Dynamic text formatting.
- Pluralization.
- Number and time formatting.
- Date formatting.
- Localized input action labels.
- Localized gameplay messages.
- Runtime language switching.
- Missing translation detection.
- Translation resource validation.

The initial implementation must support English as the primary development language and provide an architecture that allows additional languages to be added without changing gameplay systems.

---

## 2. Design Philosophy

### 2.1 Language-Agnostic Gameplay

Gameplay systems must not depend on a particular language.

They should identify messages using stable localization keys and provide structured context data.

Example:

```ts
interface LocalizedMessage {
    key: string;

    parameters?: Record<string, unknown>;
}
```

The system resolves the actual text.

### 2.2 Centralized Translation Resources

All player-facing text must be defined in localization resources.

Avoid hardcoded user-facing strings inside UI components and gameplay logic.

### 2.3 Stable Identifiers

Translation keys must remain stable across languages.

A key identifies a semantic message, not its current English wording.

Changing the English text must not require renaming the key.

### 2.4 Context-Aware Formatting

The same value may require different formatting depending on context.

Examples:

- A speed value.
- A checkpoint number.
- A duration.
- A distance.
- A medal name.
- A pluralized objective count.

Formatting must be centralized.

### 2.5 Runtime Language Switching

Changing the language should update visible text without restarting the application whenever possible.

Gameplay state, session state, and progress must remain unchanged.

---

## 3. Scope and Ownership

### 3.1 Localization System Responsibilities

The Localization System owns:

- Language definitions.
- Translation resource registration.
- Resource loading.
- Translation key resolution.
- Fallback resolution.
- Interpolation.
- Pluralization.
- Locale-aware formatting.
- Language change notifications.
- Translation diagnostics.
- Resource validation.
- Localized text direction metadata.

### 3.2 Non-responsibilities

The Localization System does not own:

- Settings UI.
- Menu navigation.
- Gameplay rules.
- Training objectives.
- Input action definitions.
- Input event processing.
- HUD layout.
- Font asset creation.
- The selected language preference.
- Persistent settings storage.
- Save data migration.
- General-purpose content management.

### 3.3 Ownership Table

| Responsibility | Owner |
|---|---|
| Selected language preference | Settings System |
| Language persistence | Save System through Settings System |
| Translation resources | Localization System |
| Translation resolution | Localization System |
| UI presentation | Menu / HUD / UI layer |
| Gameplay message meaning | Domain systems |
| Input action definitions | Input System |
| Localized action labels | Localization System using Input metadata |
| Font rendering | UI / Rendering layer |
| Layout direction | UI layer using locale metadata |
| Text content authoring | Game content / localization resources |

### 3.4 Related Specifications

- `02_TECHNICAL_ARCHITECTURE.md`
- `04_ASSET_BIBLE.md`
- `07_UI_UX_SPEC.md`
- `08_AUDIO_DESIGN_SPEC.md`
- `10_SAVE_SYSTEM_SPEC.md`
- `11_INPUT_SYSTEM_SPEC.md`
- `21_TRAINING_SYSTEM_SPEC.md`
- `23_HUD_SYSTEM_SPEC.md`
- `24_MENU_SYSTEM_SPEC.md`
- `25_SETTINGS_SYSTEM_SPEC.md`
- `26_ACCESSIBILITY_SYSTEM_SPEC.md`

---

## 4. Architecture

### 4.1 Core Components

The initial implementation should contain:

- `LocalizationManager`
- `LanguageRegistry`
- `LanguageDefinitionProvider`
- `LocalizationResourceLoader`
- `LocalizationResourceRegistry`
- `TranslationResolver`
- `TranslationFormatter`
- `PluralizationResolver`
- `LocaleFormatter`
- `LocalizationFallbackResolver`
- `LocalizationValidator`
- `LocalizationEvents`
- `LocalizationDiagnostics`

### 4.2 Component Responsibilities

**LocalizationManager**

Public entry point for localization operations.

**LanguageRegistry**

Stores supported language definitions.

**LanguageDefinitionProvider**

Provides metadata for each supported language.

**LocalizationResourceLoader**

Loads translation resources.

**LocalizationResourceRegistry**

Registers and indexes loaded resources.

**TranslationResolver**

Resolves localization keys to translated messages.

**TranslationFormatter**

Interpolates parameters into translated messages.

**PluralizationResolver**

Selects the correct plural form for a given locale and quantity.

**LocaleFormatter**

Formats numbers, dates, durations, and measurements.

**LocalizationFallbackResolver**

Resolves missing translations through configured fallback languages.

**LocalizationValidator**

Checks resource structure, missing keys, invalid placeholders, and duplicate definitions.

**LocalizationDiagnostics**

Provides development-time translation diagnostics.

---

## 5. Supported Languages

### 5.1 Initial Language

English is the initial development and fallback language.

The architecture must allow additional languages to be registered without changes to core gameplay systems.

### 5.2 Language Definition

```ts
interface LanguageDefinition {
    id: string;

    displayName: string;

    nativeDisplayName: string;

    locale: string;

    fallbackLanguageId: string;

    direction: TextDirection;

    supported: boolean;

    resourceVersion: number;
}
```

### 5.3 Text Direction

```ts
type TextDirection =
    | "ltr"
    | "rtl";
```

Initial implementation may support left-to-right languages only.

However, language metadata must be capable of describing right-to-left languages.

Full RTL layout support is a separate implementation requirement and must not be claimed merely because the language can be registered.

### 5.4 Language Identifiers

Use stable language identifiers based on standard locale conventions.

Examples:

- `en`
- `en-GB`
- `en-US`
- `nl`
- `de`
- `fr`
- `es`
- `ja`

Do not use display names as identifiers.

### 5.5 System Language Detection

At first launch, the game may inspect the browser or operating system language.

Language detection must:

1. Read available platform locale information.
2. Normalize the locale identifier.
3. Search for an exact supported match.
4. Search for a compatible base-language match.
5. Fall back to the default language.

Automatic detection must not override an existing saved user preference.

---

## 6. Language Selection

### 6.1 Canonical Setting

The selected language is stored and owned by the Settings System.

Canonical setting:

`general.language`

The setting is defined in `25_SETTINGS_SYSTEM_SPEC.md` §7.8 and must be registered in the Settings System definition registry.

Suggested type:

```ts
type LanguageSetting = string;
```

The value must reference a language identifier registered with the Localization System.

### 6.2 Ownership

- Settings System owns the selected language preference and its persistence contract.
- Localization System owns language definitions, translation resources, resolution, formatting, and runtime language application.
- Localization System does not store a competing language preference.
- Menu System presents the language selector.

### 6.3 Language Change

When the language changes:

1. Settings System validates that the value's type and shape are valid.
2. Localization System validates that the identifier refers to a registered, supported language with available mandatory resources.
3. Localization System loads or retrieves its resources.
4. Required resources are validated.
5. The active language is updated.
6. Visible localized components are refreshed.
7. A language change event is published.

Settings must not mark a language change as successfully applied until the Localization System has confirmed that the language can be activated.

### 6.4 Failure Handling

If resources cannot be loaded:

- Retain the previous active language.
- Report the failure.
- Keep the application usable.
- Display an error using the current active language where possible.

Never switch to a language with unavailable mandatory resources.

### 6.5 Runtime Switching

Language changes must not:

- Restart the gameplay session.
- Reset the current level.
- Reset the Speedrun timer.
- Modify checkpoints.
- Reset Training progress.
- Change player state.
- Reinitialize physics.

---

## 7. Translation Resource Format

### 7.1 Resource Structure

Use structured JSON resources for the initial implementation.

Example:

```json
{
  "meta": {
    "language": "en",
    "version": 1
  },
  "common": {
    "confirm": "Confirm",
    "cancel": "Cancel",
    "back": "Back",
    "continue": "Continue"
  },
  "menu": {
    "main": {
      "title": "MAIN MENU",
      "training": "TRAINING",
      "prologue": "PROLOGUE",
      "settings": "SETTINGS",
      "exit": "EXIT"
    }
  }
}
```

The actual resource format may be split into multiple files by domain.

### 7.2 Recommended Resource Structure

```text
localization/
    en/
        meta.json
        common.json
        menu.json
        settings.json
        hud.json
        training.json
        gameplay.json
        speedrun.json
        interaction.json
        progression.json
        accessibility.json
        errors.json
    nl/
        meta.json
        common.json
        menu.json
        settings.json
        hud.json
        training.json
        gameplay.json
        speedrun.json
        interaction.json
        progression.json
        accessibility.json
        errors.json
```

Not every language needs to contain every file during development.

Missing resources must be handled through the fallback system.

### 7.3 Namespaces

Translation keys must use stable namespaces.

Recommended namespaces:

- `common.*`
- `menu.*`
- `settings.*`
- `hud.*`
- `training.*`
- `gameplay.*`
- `speedrun.*`
- `checkpoint.*`
- `interaction.*`
- `progression.*`
- `accessibility.*`
- `errors.*`

### 7.4 Key Naming

Keys should describe semantic meaning.

Good:

```text
training.objective.jump_over_gap
speedrun.result.personal_best
checkpoint.feedback.activated
interaction.prompt.open_door
```

Avoid:

```text
text_001
button_7
red_label
first_string
```

### 7.5 Resource Granularity

Keep resources logically separated.

Do not create one enormous translation file containing the entire game.

However, avoid excessive fragmentation into files containing only one or two strings.

---

## 8. Public Interface

### 8.1 LocalizationManager

```ts
interface ILocalizationManager {
    getCurrentLanguage(): string;

    getSupportedLanguages(): LanguageDefinition[];

    translate(
        key: string,
        parameters?: TranslationParameters
    ): string;

    translatePlural(
        key: string,
        count: number,
        parameters?: TranslationParameters
    ): string;

    formatNumber(
        value: number,
        options?: NumberFormatOptions
    ): string;

    formatDate(
        value: Date,
        options?: DateFormatOptions
    ): string;

    formatDuration(
        milliseconds: number,
        options?: DurationFormatOptions
    ): string;

    setLanguage(
        languageId: string
    ): Promise<LanguageChangeResult>;

    subscribe(
        listener: LocalizationListener
    ): Unsubscribe;
}
```

### 8.2 Translation Parameters

```ts
type TranslationParameter =
    | string
    | number
    | boolean
    | Date;

type TranslationParameters =
    Record<string, TranslationParameter>;
```

Parameters must be serializable or safely formatable.

Do not pass arbitrary runtime objects into translation resources.

### 8.3 Translation Result

The simple `translate` method returns a string.

For diagnostics-sensitive contexts, the implementation may also provide:

```ts
interface TranslationResult {
    text: string;

    key: string;

    resolvedLanguage: string;

    usedFallback: boolean;

    missing: boolean;
}
```

The detailed result is useful for development tools and validation.

---

## 9. Translation Resolution

### 9.1 Resolution Order

When resolving a key:

1. Search the active language.
2. Search its configured fallback language.
3. Search the default language.
4. Return a development diagnostic if no translation exists.

The fallback chain must not contain cycles.

### 9.2 Missing Translation Behavior

In development:

- Log the missing key.
- Include the active language.
- Include the requesting domain where available.
- Display a readable placeholder.

Example:

```text
[MISSING: training.objective.jump_over_gap]
```

In production:

- Use the default language if available.
- Otherwise return a safe fallback label.
- Never crash gameplay because a translation is missing.

### 9.3 Missing Key Cache

Missing keys may be cached to avoid repeated diagnostics.

The cache must be invalidated when resources are reloaded.

### 9.4 Fallback Language

English is the initial default language.

The fallback language must be explicitly defined rather than inferred from resource loading order.

---

## 10. Dynamic Text Formatting

### 10.1 Purpose

Allows translated messages to include runtime values.

Example resource:

```json
{
  "speedrun": {
    "checkpoint_time": "Checkpoint reached in {time}"
  }
}
```

Usage:

```ts
localization.translate(
    "speedrun.checkpoint_time",
    {
        time: localization.formatDuration(45230)
    }
);
```

### 10.2 Placeholder Rules

- Placeholders must have stable names.
- All required placeholders must be supplied.
- Missing parameters must be reported in development.
- Parameter values must be escaped by the rendering layer.
- Translation resources must not be treated as executable code.

### 10.3 Rich Text

The initial implementation should return plain text.

If a message requires styled segments, use a structured rich-text representation.

Do not embed arbitrary HTML inside translation strings.

Example:

```ts
interface LocalizedTextSegment {
    text: string;

    emphasis?: boolean;

    style?: string;
}
```

Rendering and styling remain the responsibility of UI components.

### 10.4 Parameter Formatting

The localization layer may format primitive values.

Domain-specific calculations remain in the owning systems.

For example:

- Speedrun calculates elapsed time.
- Localization formats the duration.
- HUD renders the resulting text.

---

## 11. Pluralization

### 11.1 Purpose

Different languages use different plural rules.

The system must not construct pluralized messages by appending suffixes.

### 11.2 Resource Structure

Plural resources should support locale-aware categories.

Example:

```json
{
  "training": {
    "completed_exercises": {
      "one": "{count} exercise completed",
      "other": "{count} exercises completed"
    }
  }
}
```

### 11.3 Plural Categories

The resolver must support the standard categories:

- `zero`
- `one`
- `two`
- `few`
- `many`
- `other`

Not every language uses every category.

### 11.4 Runtime Implementation

Use the platform's `Intl.PluralRules` API where available.

Do not hardcode English plural rules for all languages.

### 11.5 Missing Categories

If a specific plural category is unavailable, use `other`.

If `other` is missing, fall back to the configured fallback language.

### 11.6 Zero Values

Zero must be treated according to locale plural rules.

A separate zero-specific message may be provided when the content requires it.

---

## 12. Number, Date, and Duration Formatting

### 12.1 Number Formatting

Use locale-aware number formatting.

Examples:

- Decimal separators.
- Thousands separators.
- Percentages.
- Measurement units.

Use `Intl.NumberFormat` where supported.

### 12.2 Duration Formatting

Speedrun timing must preserve its authoritative precision.

Localization formats the value but does not calculate elapsed time.

Example formats:

```text
00:42.381
1:24.502
```

The display format may vary by context, but the underlying time remains milliseconds.

### 12.3 Speedrun Requirements

- Do not introduce locale-dependent ambiguity into leaderboard storage.
- Store numerical timing values, not formatted strings.
- Sort leaderboard entries numerically.
- Format times only for presentation.
- Preserve the precision required by Speedrun System.

### 12.4 Distance and Speed

Measurement formatting must be centralized.

The initial implementation should define a canonical internal unit system.

Suggested canonical units:

- Distance: meters.
- Speed: meters per second.
- Time: milliseconds.

If alternate display units are introduced, conversion must be explicit.

Do not modify physics or movement values because of locale preferences.

### 12.5 Date Formatting

Use locale-aware date formatting.

Dates should be stored in a machine-readable representation and formatted only when displayed.

---

## 13. Input Action Localization

### 13.1 Purpose

Input labels must be understandable in the active language.

### 13.2 Ownership

Input System owns action definitions and device mappings.

Localization System owns translated action labels.

### 13.3 Input Action Metadata

Input System should expose stable action identifiers.

Examples:

- `input.move`
- `input.jump`
- `input.crouch`
- `input.sprint`
- `input.interact`
- `input.restart`
- `input.pause`
- `input.confirm`
- `input.cancel`

Localization resources provide the corresponding labels.

### 13.4 Device-Specific Labels

The displayed label may depend on the active input device.

Examples:

- Keyboard action: `SPACE`
- Gamepad action: localized action description with a controller glyph.
- Mouse action: localized button description.

The physical key or button representation remains owned by Input System.

### 13.5 Binding Display

Input System provides:

- Current binding.
- Device type.
- Physical key or button identifier.
- Input action ID.

Localization System provides the translated action description.

UI combines these values.

### 13.6 Dynamic Binding Labels

Changing a binding must update visible labels without requiring localization resources to be reloaded.

---

## 14. UI Integration

### 14.1 General Requirements

All player-facing UI text must use localization keys.

This includes:

- Main Menu.
- Mode Selection.
- Training Selection.
- Prologue Introduction.
- Pause.
- Settings.
- Results.
- Confirmation Dialogs.
- Error Screens.
- HUD.
- Interaction Prompts.
- Notifications.

### 14.2 Menu Integration

Menu System owns the presentation and navigation behavior.

Localization System provides translated text.

Menu components must not contain hardcoded language-specific strings.

### 14.3 HUD Integration

HUD System receives localized messages and formats them for display.

HUD must not independently implement translation logic.

### 14.4 Dynamic UI

Components must refresh their text when the active language changes.

Avoid destroying and recreating entire gameplay UI trees when only text has changed.

### 14.5 Layout Adaptation

Localized strings may be longer or shorter than the English source.

UI must support:

- Text wrapping.
- Flexible panel sizes.
- Responsive button widths.
- Reflow.
- Scrollable content where necessary.
- Truncation only for noncritical content.

Important actions must never become inaccessible because a translation is longer.

---

## 15. Gameplay Integration

### 15.1 General Rule

Gameplay systems must emit semantic identifiers and parameters rather than localized strings.

### 15.2 Training

Training definitions should use localization keys for:

- Exercise names.
- Exercise descriptions.
- Objectives.
- Instructions.
- Hints.
- Completion messages.
- Failure messages.

Example:

```ts
interface TrainingLocalizedContent {
    titleKey: string;

    descriptionKey: string;

    instructionKeys: string[];

    hintKeys: string[];
}
```

Training remains authoritative for exercise behavior and evaluation.

### 15.3 Interaction

Interaction definitions should expose localized content identifiers.

Example:

```ts
interface LocalizedInteractionInfo {
    titleKey: string;

    descriptionKey?: string;

    actionLabelKey?: string;
}
```

Interaction System remains responsible for deciding which interaction is available.

### 15.4 Checkpoints

Checkpoint definitions should reference localized display names.

Checkpoint IDs must remain stable and language-independent.

### 15.5 Speedrun

Speedrun presentation should localize:

- Section names.
- Split labels.
- Result labels.
- Medal names.
- Personal best messages.
- Run status messages.

The underlying route IDs and timing data remain language-independent.

### 15.6 Progression

Achievements and milestones should use localization keys.

Achievement IDs and unlock conditions must not depend on localized strings.

### 15.7 Errors

Error codes and domain failure reasons must be separate from their translated messages.

Example:

```ts
interface LocalizedError {
    code: string;

    messageKey: string;

    parameters?: TranslationParameters;
}
```

---

## 16. Runtime Language Switching

### 16.1 Requirements

The player may change language from Settings.

The change must not reset the active gameplay session.

### 16.2 Switching Sequence

```text
Language Selected
        |
        v
Settings Transaction Updated
        |
        v
Localization Resources Loaded
        |
        v
Resources Validated
        |
        v
Active Language Changed
        |
        v
Localized Components Refreshed
        |
        v
Settings Transaction Committed
```

### 16.3 Atomic Switching

The system must avoid displaying a mixture of languages during resource loading.

The previous active language remains active until the new language is ready.

### 16.4 Preview and Rollback

Language changes must integrate with Settings transactions.

If the player previews a language and cancels:

- Restore the previous language.
- Restore the previous visible text.
- Preserve unrelated settings changes.

### 16.5 Async Safety

If multiple language changes are requested quickly:

- Assign a request identifier or generation token.
- Ignore stale resource-loading completions.
- Apply only the most recent valid request.

### 16.6 Resource Caching

Loaded translation resources may be cached.

The cache must be bounded and invalidated when resources are reloaded or their version changes.

---

## 17. Resource Loading and Performance

### 17.1 Loading Strategy

The initial implementation may load all small translation resources during startup.

For larger content sets, use namespace-based lazy loading.

### 17.2 Mandatory Resources

The following namespaces should be available before entering the main application:

- `common`
- `menu`
- `settings`
- `errors`

Gameplay namespaces may be loaded before their corresponding mode starts.

### 17.3 Loading Failure

If a noncritical namespace fails:

- Continue using fallback resources.
- Report diagnostics.
- Avoid blocking unrelated gameplay.

If mandatory resources fail, use the default language resource bundle.

### 17.4 Performance Requirements

- Do not load translation files every frame.
- Cache resolved resource namespaces.
- Cache compiled formatting metadata where useful.
- Avoid repeated parsing of unchanged resources.
- Keep translation lookup lightweight.
- Do not block the game loop on language changes.

---

## 18. Accessibility Integration

### 18.1 Ownership

Accessibility System owns accessibility policy.

Localization System provides language-aware text and metadata.

### 18.2 Text Direction

Language definitions expose text direction.

UI layer uses that information to determine layout direction.

### 18.3 Text Expansion

Localized text must remain usable with:

- Large Text.
- Increased UI scale.
- High Contrast.
- Reduced Motion.

### 18.4 Screen Readers

Where supported by the platform and rendering architecture, important UI elements should expose accessible text labels.

These labels should use the same localization resources as visible text.

### 18.5 Accessible Naming

Icons and controls must not rely exclusively on visual appearance.

Interactive elements should have localized accessible names and descriptions where needed.

### 18.6 Consistency

Changing language must update both visible text and corresponding accessibility labels.

---

## 19. Localization Quality and Validation

### 19.1 Resource Validation

The validation process must check:

- Valid resource structure.
- Unique translation keys.
- Required namespaces.
- Missing keys.
- Invalid placeholders.
- Missing plural categories.
- Invalid language identifiers.
- Invalid fallback references.
- Fallback cycles.
- Unsupported formatting patterns.

### 19.2 Key Parity

The default language defines the required key set.

Other languages should be checked against it.

Missing translations may be permitted during development but must be visible in reports.

### 19.3 Placeholder Parity

Translations must preserve the expected placeholders.

Example:

English:

```text
"Reached checkpoint in {time}"
```

Another language must contain a compatible `{time}` placeholder.

### 19.4 Translation Review

Translation quality requires human review.

Automated validation can detect structural errors but cannot guarantee linguistic correctness.

### 19.5 Pseudo-Localization

A development-only pseudo-localization mode should be considered.

It may:

- Expand text length.
- Replace characters with accented variants.
- Mark translated strings.
- Reveal hardcoded UI text.

Pseudo-localization must never be included in normal production language selection.

---

## 20. Localization Diagnostics

### 20.1 Development Diagnostics

The system should report:

- Missing translation keys.
- Fallback usage.
- Missing placeholders.
- Invalid plural resources.
- Resource loading failures.
- Unsupported language selection.
- Stale resource versions.

### 20.2 Debug Information

Each resolved translation may expose:

- Original key.
- Active language.
- Resolved language.
- Whether fallback was used.
- Namespace.
- Resource version.

### 20.3 Production Behavior

Production diagnostics should avoid exposing internal implementation details to players.

A safe fallback message must be displayed instead.

---

## 21. Testing Requirements

### 21.1 Language Registry Tests

Test:

- Valid language registration.
- Duplicate language IDs.
- Invalid locale identifiers.
- Fallback language validation.
- Unsupported language selection.
- Text direction metadata.

### 21.2 Translation Tests

Test:

- Existing keys.
- Missing keys.
- Fallback resolution.
- Nested namespaces.
- Empty translations.
- Invalid resources.
- Duplicate keys.

### 21.3 Formatting Tests

Test:

- String interpolation.
- Number formatting.
- Date formatting.
- Duration formatting.
- Missing parameters.
- Invalid parameter types.
- Locale-specific decimal separators.

### 21.4 Pluralization Tests

Test:

- Singular forms.
- Plural forms.
- Zero values.
- Multiple plural categories.
- Missing plural categories.
- Fallback behavior.

### 21.5 Language Switching Tests

Test:

- Initial language selection.
- Runtime language switching.
- Resource loading failure.
- Rapid language switching.
- Stale async completion.
- Transaction preview.
- Transaction rollback.
- Persistence failure.

### 21.6 Integration Tests

Verify localization in:

- Main Menu.
- Settings.
- HUD.
- Training.
- Interaction Prompts.
- Checkpoint Feedback.
- Speedrun Results.
- Progression Notifications.
- Error Dialogs.

### 21.7 Layout Tests

Verify:

- Long translated strings.
- Large Text.
- UI scaling.
- Narrow viewport.
- Wide viewport.
- Button resizing.
- Text wrapping.
- Dialog layout.

### 21.8 Regression Tests

Language switching must not modify:

- Gameplay session state.
- Movement state.
- Checkpoint progress.
- Respawn state.
- Speedrun timer.
- Training progress.
- Save data unrelated to language.

---

## 22. Implementation Phases

### Phase 1: Language Model

Implement:

- LanguageDefinition.
- LanguageRegistry.
- TextDirection.
- Default language.
- Fallback configuration.

### Phase 2: Resource Infrastructure

Implement:

- JSON resource format.
- Resource loader.
- Resource registry.
- Namespace organization.
- Resource caching.

### Phase 3: Translation Resolution

Implement:

- LocalizationManager.
- TranslationResolver.
- Fallback resolver.
- Missing-key handling.
- Translation diagnostics.

### Phase 4: Formatting

Implement:

- Parameter interpolation.
- Pluralization.
- Number formatting.
- Date formatting.
- Duration formatting.

### Phase 5: Settings Integration

Implement:

- `general.language` setting.
- Language selection.
- Settings transaction support.
- Preview.
- Rollback.
- Persistence.

### Phase 6: UI Integration

Localize:

- Main Menu.
- Settings.
- Pause.
- Results.
- Dialogs.
- HUD.
- Interaction Prompts.

### Phase 7: Gameplay Integration

Localize:

- Training content.
- Checkpoint names.
- Speedrun sections.
- Medal labels.
- Progression content.
- Error messages.

### Phase 8: Accessibility Integration

Implement:

- Text direction metadata.
- Accessible labels.
- Large Text compatibility.
- UI expansion validation.

### Phase 9: Validation

Implement:

- Resource validation.
- Key parity checks.
- Placeholder parity checks.
- Pseudo-localization.
- Localization regression tests.

---

## 23. Acceptance Criteria

The implementation is accepted when:

1. Localization is centralized.
2. All supported languages have stable identifiers.
3. English is available as the default fallback language.
4. Translation resources use structured namespaces.
5. UI does not contain hardcoded player-facing text.
6. Gameplay systems use semantic localization keys.
7. Missing translations fall back safely.
8. Translation parameters are validated.
9. Pluralization uses locale-aware rules.
10. Numbers and dates use locale-aware formatting.
11. Speedrun timing remains numerically stored.
12. Input action labels can be localized.
13. Runtime language switching works.
14. Language switching does not reset gameplay state.
15. Settings transactions support language preview and rollback.
16. Async language requests cannot apply stale resources.
17. Mandatory resources are available before main application use.
18. Translation diagnostics work in development.
19. Resource validation detects missing keys and placeholders.
20. Long translations do not break critical UI.
21. Accessibility labels update with language changes.
22. Unit and integration tests pass.

---

## 24. Definition of Done

- [ ] Localization architecture implemented.
- [ ] LanguageDefinition implemented.
- [ ] LanguageRegistry implemented.
- [ ] Resource loader implemented.
- [ ] Resource registry implemented.
- [ ] Namespace structure established.
- [ ] LocalizationManager implemented.
- [ ] TranslationResolver implemented.
- [ ] Fallback resolver implemented.
- [ ] Parameter interpolation implemented.
- [ ] Pluralization implemented.
- [ ] Number formatting implemented.
- [ ] Date formatting implemented.
- [ ] Duration formatting implemented.
- [ ] English resource bundle created.
- [ ] `general.language` setting registered.
- [ ] Settings integration complete.
- [ ] Language preview and rollback implemented.
- [ ] Runtime language switching implemented.
- [ ] Menu localization complete.
- [ ] HUD localization complete.
- [ ] Training localization integrated.
- [ ] Interaction localization integrated.
- [ ] Checkpoint localization integrated.
- [ ] Speedrun localization integrated.
- [ ] Progression localization integrated.
- [ ] Error messages localized.
- [ ] Accessibility labels localized.
- [ ] Missing translation diagnostics implemented.
- [ ] Resource validation implemented.
- [ ] Pseudo-localization available in development.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Layout regression tests pass.

---

## 25. Final Design Constraints

1. Localization System is the single authority for translation resolution.
2. Settings System owns the selected language preference.
3. Save System owns persistence infrastructure.
4. Menu System owns language selection UI.
5. Gameplay systems must not contain hardcoded player-facing strings.
6. Translation keys must be stable and language-independent.
7. Gameplay identifiers must never depend on translated text.
8. Translation resources must not contain executable code.
9. Missing translations must not crash gameplay.
10. English is the initial default fallback language.
11. Fallback chains must not contain cycles.
12. Dynamic parameters must be validated and safely rendered.
13. Pluralization must use locale-aware rules.
14. Speedrun data must remain language-independent.
15. Input System remains authoritative for physical bindings.
16. Localization provides translated input action labels only.
17. Runtime language switching must not reset gameplay sessions.
18. Language switching must handle asynchronous resource loading safely.
19. Temporary language previews must be reversible.
20. UI must accommodate translated text expansion.
21. Accessibility labels must use the active language.
22. Resource loading must not block the gameplay loop.
23. Development diagnostics must identify missing and invalid translations.
24. The initial implementation must prioritize architecture and English resources before expanding the number of supported languages.
25. Full right-to-left layout support must be treated as a separate verified capability, not assumed from language registration.

**End of Specification**