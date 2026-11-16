# 10_SAVE_SYSTEM_SPEC.md

# Save System Specification

## 1. Overview

The Save System provides persistent storage for all player-related data.

Its primary responsibility is to preserve player progress and configuration across application sessions.

The system must support:

- Game settings.
- Player preferences.
- Gameplay progress.
- Training progress.
- Speedrun records.
- Personal bests.
- Unlocked content.
- Data versioning.
- Data migration.
- Backup and restore.
- Import and export.
- Data integrity validation.

The system must work entirely offline.

No account, server, cloud synchronization, or authentication is required for the initial implementation.

### Design Philosophy

The Save System must be:

1. Reliable.
2. Modular.
3. Versioned.
4. Asynchronous.
5. Independent of gameplay simulation.
6. Resilient to application interruptions.
7. Extensible without requiring a complete rewrite.

Persistent data must not be coupled directly to gameplay objects or UI components.

---

# 2. Storage Architecture

## 2.1 Storage Technology

Use IndexedDB as the primary persistent storage mechanism.

IndexedDB is suitable because:

- It supports structured data.
- It supports asynchronous operations.
- It handles larger datasets than localStorage.
- It supports indexes and transactions.
- It provides object stores for different data domains.

Do not use localStorage as the primary storage mechanism.

localStorage may be used only for small bootstrap information if absolutely necessary.

## 2.2 Database Name

```text
MirrorEdgeSaveData
```

## 2.3 Database Version

Initial database version:

```typescript
const DATABASE_VERSION = 1;
```

The database version must increase whenever a structural IndexedDB schema migration is required.

Database schema version and application save-data version are separate concepts.

- Database version controls IndexedDB structure.
- Save-data version controls serialized application data.

## 2.4 Object Stores

Initial database structure:

| Object Store | Responsibility |
|---|---|
| settings | Player and game settings |
| progress | General gameplay progression |
| training | Training exercise progress |
| speedrun | Speedrun records and history |
| metadata | Save metadata and migration information |
| backups | Local backup snapshots |

Each store must have a clearly defined owner.

Specialized systems must access their own data through repository interfaces rather than manipulating IndexedDB directly.

## 2.5 Architecture Overview

```text
             Game Systems
                  |
       +----------+----------+
       |          |          |
       v          v          v
   Settings    Progress   Speedrun
   Manager     Manager    Manager
       |          |          |
       +----------+----------+
                  |
                  v
              SaveService
                  |
                  v
           Repository Layer
                  |
                  v
               IndexedDB
```

The UI must never communicate directly with IndexedDB.

---

# 3. Data Domains

Persistent data is divided into independent domains.

## 3.1 Settings

Contains player configuration.

Examples:

- Audio volume.
- Music volume.
- Master volume.
- Mouse sensitivity.
- Camera sensitivity.
- Invert Y axis.
- Graphics quality.
- Resolution scale.
- VSync.
- Field of view.
- HUD visibility.
- Accessibility settings.

Settings should be loaded before entering gameplay.

## 3.2 Gameplay Progress

Contains general game progression.

Examples:

- Completed tutorials.
- Completed training exercises.
- Unlocked levels.
- Completed objectives.
- Last selected game mode.
- Last selected route.

Progress must be independent of temporary gameplay state.

## 3.3 Training Progress

Contains information about completed training exercises.

Examples:

- Exercise completion status.
- Best exercise time.
- Number of attempts.
- Last completion date.
- Unlocked exercises.

Training progress must not depend on Speedrun leaderboard data.

## 3.4 Speedrun Data

Contains:

- Completed runs.
- Personal best times.
- Section records.
- Medal achievements.
- Run history.
- Route version information.

The Speedrun System owns the interpretation and validation of these records.

The Save System only provides persistence infrastructure.

## 3.5 Metadata

Contains:

- Save-data version.
- Database schema version.
- Save creation timestamp.
- Last modification timestamp.
- Application version.
- Migration history.
- Data integrity information.

---

# 4. Save Data Model

## 4.1 Root Save Structure

The logical save-data structure should be represented by the following interface.

```typescript
interface GameSaveData {
    schemaVersion: number;

    createdAt: number;

    updatedAt: number;

    applicationVersion: string;

    settings: GameSettings;

    progress: GameProgress;

    training: TrainingProgress;

    metadata: SaveMetadata;
}
```

Speedrun records are stored separately to avoid unnecessarily loading the entire run history when initializing the game.

The root save structure describes the logical contents of the save system, not necessarily one physical IndexedDB record.

## 4.2 Save Metadata

```typescript
interface SaveMetadata {
    saveId: string;

    schemaVersion: number;

    createdAt: number;

    updatedAt: number;

    lastSuccessfulSave: number;

    migrationHistory: MigrationRecord[];
}
```

```typescript
interface MigrationRecord {
    fromVersion: number;

    toVersion: number;

    migratedAt: number;

    success: boolean;
}
```

The save identifier must remain stable across ordinary save operations.

---

# 5. Settings Persistence

## 5.1 Settings Model

```typescript
interface GameSettings {
    audio: AudioSettings;

    controls: ControlsSettings;

    graphics: GraphicsSettings;

    camera: CameraSettings;

    interface: InterfaceSettings;

    accessibility: AccessibilitySettings;
}
```

### Audio Settings

```typescript
interface AudioSettings {
    masterVolume: number;

    musicVolume: number;

    effectsVolume: number;

    ambientVolume: number;

    muted: boolean;
}
```

Volume values are normalized between 0 and 1.

### Controls Settings

```typescript
interface ControlsSettings {
    mouseSensitivity: number;

    invertY: boolean;

    keyBindings: Record<string, string>;

    mouseBindings: Record<string, string>;
}
```

### Graphics Settings

```typescript
interface GraphicsSettings {
    quality: "low" | "medium" | "high";

    resolutionScale: number;

    antialiasing: boolean;

    shadows: boolean;

    vsync: boolean;
}
```

### Camera Settings

```typescript
interface CameraSettings {
    fieldOfView: number;

    cameraSensitivity: number;

    cameraShake: boolean;

    headBob: boolean;
}
```

### Interface Settings

```typescript
interface InterfaceSettings {
    showHUD: boolean;

    showSpeedometer: boolean;

    showTimer: boolean;

    showCheckpointMarkers: boolean;
}
```

### Accessibility Settings

```typescript
interface AccessibilitySettings {
    reducedMotion: boolean;

    highContrast: boolean;

    colorblindMode: "none" | "protanopia" | "deuteranopia" | "tritanopia";
}
```

These settings are initial examples. Their final values and supported options must match actual game features.

## 5.2 Default Settings

The game must provide a complete default settings configuration.

```typescript
const DEFAULT_SETTINGS: GameSettings = {
    audio: {
        masterVolume: 1,
        musicVolume: 0.8,
        effectsVolume: 1,
        ambientVolume: 0.7,
        muted: false
    },

    controls: {
        mouseSensitivity: 1,
        invertY: false,
        keyBindings: {},
        mouseBindings: {}
    },

    graphics: {
        quality: "high",
        resolutionScale: 1,
        antialiasing: true,
        shadows: true,
        vsync: true
    },

    camera: {
        fieldOfView: 90,
        cameraSensitivity: 1,
        cameraShake: true,
        headBob: true
    },

    interface: {
        showHUD: true,
        showSpeedometer: true,
        showTimer: true,
        showCheckpointMarkers: true
    },

    accessibility: {
        reducedMotion: false,
        highContrast: false,
        colorblindMode: "none"
    }
};
```

Default settings must be merged with loaded settings.

Missing fields must receive defaults.

Invalid values must be clamped or replaced with defaults according to the field's validation rules.

Do not replace the entire settings object because one optional field is missing.

## 5.3 Settings Save Behavior

Settings should be saved automatically when modified.

However, avoid writing to IndexedDB on every slider movement.

Use debounced persistence.

Recommended behavior:

1. Update settings immediately in memory.
2. Update the relevant game subsystem.
3. Schedule a persistent save.
4. Combine rapid consecutive modifications.
5. Save after a short inactivity period.

Recommended debounce interval:

```typescript
const SETTINGS_SAVE_DEBOUNCE = 500;
```

Save settings immediately when leaving the settings screen if a write is pending.

The application must also attempt to persist dirty settings during an orderly shutdown or page lifecycle transition.

Do not rely exclusively on shutdown events for data integrity.

---

# 6. Gameplay Progress Persistence

## 6.1 Progress Model

```typescript
interface GameProgress {
    completedTutorials: string[];

    unlockedLevels: string[];

    completedObjectives: string[];

    unlockedContent: string[];

    lastSelectedMode: string | null;

    lastSelectedRoute: string | null;
}
```

## 6.2 Progress Rules

Progress is updated only when a relevant gameplay event is confirmed.

Examples:

- Tutorial completed.
- Training exercise completed.
- Level unlocked.
- Objective completed.

Temporary state must not be persisted as permanent progress.

Examples of data that should not be saved:

- Current player velocity.
- Current jump state.
- Current wall-run state.
- Temporary collision information.
- Active movement animation.
- Current physics simulation state.

The initial implementation does not support saving and restoring the player in the middle of a speedrun.

## 6.3 Progress Updates

Progress updates must be idempotent.

Completing the same tutorial twice must not create duplicate entries.

Unlocked content must remain unlocked unless the game explicitly supports progression reset.

---

# 7. Training Persistence

## 7.1 Training Progress Model

```typescript
interface TrainingProgress {
    exercises: Record<string, TrainingExerciseRecord>;
}
```

```typescript
interface TrainingExerciseRecord {
    exerciseId: string;

    completed: boolean;

    attempts: number;

    bestTime: number | null;

    lastAttemptAt: number | null;

    completedAt: number | null;
}
```

## 7.2 Rules

- Every completed exercise updates its record.
- Attempts are counted independently.
- Best times only improve.
- Incomplete attempts do not overwrite completion records.
- Training data is separate from official Prologue speedrun records.

If training exercises support timed challenges, their times must use the same monotonic timing principles as Speedrun.

---

# 8. Save Service

## 8.1 Responsibilities

SaveService is the central persistence coordinator.

It is responsible for:

- Database initialization.
- Database connection management.
- Repository access.
- Transaction coordination.
- Error handling.
- Schema upgrades.
- Data validation.
- Backup creation.
- Data export and import.

It must not contain gameplay rules.

## 8.2 Interface

```typescript
interface SaveService {
    initialize(): Promise<void>;

    close(): void;

    isAvailable(): boolean;

    getRepository<T>(
        name: string
    ): Repository<T>;

    createBackup(): Promise<BackupResult>;

    exportData(): Promise<ExportResult>;

    importData(
        data: unknown
    ): Promise<ImportResult>;

    clearAllData(): Promise<void>;
}
```

The public interface is conceptual.

The actual implementation may use concrete repository types instead of a generic string-based repository lookup.

## 8.3 Repository Interface

```typescript
interface Repository<T> {
    get(id: string): Promise<T | null>;

    getAll(): Promise<T[]>;

    put(data: T): Promise<void>;

    delete(id: string): Promise<void>;

    clear(): Promise<void>;
}
```

Repositories must encapsulate their object store access.

## 8.4 Initialization

Initialization must happen before systems that depend on persisted data become available.

Recommended sequence:

```text
Application Start
       |
       v
Initialize SaveService
       |
       v
Open IndexedDB
       |
       v
Check Database Version
       |
       v
Run Migrations
       |
       v
Load Save Metadata
       |
       v
Load Settings
       |
       v
Load Gameplay Progress
       |
       v
Initialize Game Systems
       |
       v
Show Main Menu
```

If persistent storage is unavailable, the game must still be able to start using in-memory defaults.

The user must receive a clear indication that changes may not persist.

---

# 9. Save Scheduling

## 9.1 General Strategy

Different data domains have different persistence requirements.

| Data | Save Strategy |
|---|---|
| Settings | Debounced |
| Gameplay Progress | On confirmed event |
| Training Results | On exercise completion |
| Speedrun Results | On validated run completion |
| Metadata | Updated with successful saves |
| Backups | On explicit request and selected milestones |

Avoid continuous writes during gameplay.

## 9.2 Dirty State

The Save System must track unsaved changes.

```typescript
interface SaveState {
    initialized: boolean;

    available: boolean;

    dirtyDomains: Set<string>;

    lastSuccessfulSave: number | null;

    isSaving: boolean;

    lastError: string | null;
}
```

Each repository or domain should track its own dirty state.

Saving one domain must not incorrectly mark unrelated domains as saved.

## 9.3 Save Queue

Concurrent save requests must be handled safely.

Requirements:

- Serialize writes where necessary.
- Avoid overlapping conflicting transactions.
- Preserve the latest version of data.
- Prevent older queued writes from overwriting newer state.
- Expose saving status to the application.

If several updates occur while a save is running, the system must schedule another save using the newest data.

## 9.4 Atomic Operations

Operations involving multiple related records should use IndexedDB transactions.

Examples:

- Saving a completed run and updating the personal best.
- Creating a backup snapshot.
- Importing multiple data domains.
- Applying a migration.

If an operation fails, related writes must roll back together.

---

# 10. Data Versioning and Migration

## 10.1 Why Versioning Is Required

The game will evolve during development.

Settings, progress structures, and leaderboard formats may change.

Existing player data must not become unusable after an application update.

The Save System must support forward migration between supported historical versions.

## 10.2 Save Schema Version

Initial application save schema:

```typescript
const SAVE_SCHEMA_VERSION = 1;
```

Every serialized domain must either include a schema version or be governed by an explicitly versioned parent record.

## 10.3 Migration Interface

```typescript
interface SaveMigration {
    fromVersion: number;

    toVersion: number;

    migrate(data: unknown): Promise<unknown>;
}
```

Migrations must be sequential.

Example:

```text
Version 1
    |
    v
Version 2
    |
    v
Version 3
```

A migration from version 1 to version 3 must not skip version 2 unless a specifically tested migration path is provided.

## 10.4 Migration Rules

1. Never mutate the original data before a migration succeeds.
2. Validate input before transformation.
3. Preserve unrelated data.
4. Supply defaults for newly introduced fields.
5. Record successful migration history.
6. Make migrations deterministic.
7. Avoid depending on current gameplay state.
8. Do not silently discard unsupported data.

## 10.5 Migration Failure

If migration fails:

- Abort the migration transaction.
- Preserve the original stored data.
- Report the failure.
- Attempt recovery from a valid backup if available.
- Do not initialize the game with partially migrated data.

If recovery is unsuccessful, offer the player a clear recovery path.

---

# 11. Backup System

## 11.1 Purpose

Backups protect against:

- Failed migrations.
- Corrupted data.
- Accidental deletion.
- Import errors.
- Unexpected application changes.

## 11.2 Backup Format

```typescript
interface SaveBackup {
    format: "mirror-edge-save";

    formatVersion: number;

    createdAt: number;

    applicationVersion: string;

    databaseVersion: number;

    saveData: {
        settings: GameSettings;

        progress: GameProgress;

        training: TrainingProgress;

        speedrun: unknown;
    };

    checksum: string;
}
```

The speedrun payload must use the actual versioned Speedrun data model rather than remaining `unknown` in the final implementation.

## 11.3 Backup Policy

Recommended initial policy:

- Create a backup before schema migrations.
- Create a backup before importing external data.
- Create a backup before clearing all data.
- Allow manual export at any time.

Keep a limited number of automatic backups.

Recommended initial limit:

```typescript
const MAX_AUTOMATIC_BACKUPS = 3;
```

Older automatic backups may be removed when the limit is exceeded.

Manual exports must not be deleted automatically.

## 11.4 Backup Integrity

A backup must be validated before restoration.

Validation includes:

- Supported format.
- Supported format version.
- Required fields.
- Correct data types.
- Valid checksums.
- Domain-specific validation.

A checksum detects accidental corruption but does not prove authenticity.

Do not treat imported backup data as trusted.

---

# 12. Export and Import

## 12.1 Export

The player should be able to export their local save data as JSON.

Suggested filename:

```text
mirror-edge-save-YYYY-MM-DD.json
```

The export must include:

- Settings.
- Gameplay progress.
- Training progress.
- Speedrun records.
- Metadata.
- Export format version.

The export process must produce a consistent snapshot.

If the game is modifying related records during export, use an appropriate read transaction or another consistent snapshot mechanism.

## 12.2 Import

Import must be explicit.

The application must never automatically import a file without user confirmation.

Import sequence:

```text
Select File
    |
    v
Parse JSON
    |
    v
Validate Format
    |
    v
Validate Schema
    |
    v
Validate Data
    |
    v
Show Import Summary
    |
    v
Confirm Replacement
    |
    v
Create Current Backup
    |
    v
Import Transaction
    |
    v
Verify Imported Data
    |
    v
Refresh Game State
```

## 12.3 Import Modes

Initial implementation supports:

**Replace All**

Replaces the existing local save with the imported save.

Merging is intentionally excluded from the initial release because merging records from different versions and sources requires additional conflict-resolution rules.

## 12.4 Import Failure

If import fails:

- Roll back the transaction.
- Keep the existing save intact.
- Report the error.
- Do not partially apply the imported data.

## 12.5 Imported Speedrun Records

Imported speedrun records must be treated as external data.

They must not automatically receive verified status.

The game must:

- Validate the record structure.
- Validate route compatibility.
- Validate checkpoint sequences where available.
- Preserve original import metadata.
- Distinguish imported records from locally generated records.

Imported records must not silently overwrite a better trusted personal record.

---

# 13. Save Recovery

## 13.1 Failure Scenarios

The system must handle:

- IndexedDB unavailable.
- Storage quota exceeded.
- Transaction aborted.
- Database connection closed.
- Invalid stored data.
- Unsupported schema version.
- Failed migration.
- Browser storage cleared.
- Interrupted application session.

## 13.2 Recovery Strategy

Recommended recovery sequence:

1. Attempt to open the primary database.
2. Validate metadata.
3. Validate critical data domains.
4. Check available backups.
5. Restore from backup only when explicitly required and safe.
6. Fall back to in-memory defaults if recovery is impossible.
7. Inform the player about persistence status.

The system must never silently replace corrupted data with defaults.

## 13.3 In-Memory Fallback

When persistence is unavailable:

- Continue gameplay.
- Continue tracking progress in memory.
- Continue running speedruns.
- Allow results to be displayed.
- Clearly indicate that persistent saving is unavailable.

When storage becomes available again, the application may retry saving dirty domains.

It must not overwrite existing valid data without a clear recovery policy.

---

# 14. Browser Lifecycle and Storage Limitations

## 14.1 Browser Compatibility

The initial target is a modern desktop browser.

The implementation must use standard IndexedDB APIs.

Do not depend on browser-specific proprietary storage behavior.

## 14.2 Tab Closing

The game should not rely on unload handlers to complete critical writes.

All important data must be persisted when the corresponding event occurs.

Examples:

- Settings after debounced updates.
- Progress after confirmed completion.
- Speedrun results immediately after validation.

## 14.3 Storage Quotas

IndexedDB storage is subject to browser-specific quotas and eviction policies.

The game should:

- Handle quota errors.
- Avoid unnecessary duplicate data.
- Limit run history where appropriate.
- Allow manual export.
- Optionally request persistent storage through the browser Storage API.

Requesting persistent storage does not guarantee approval.

## 14.4 Private Browsing

Some browser configurations may restrict or limit IndexedDB persistence.

The game must handle these situations gracefully.

Do not assume storage is permanent simply because a database connection succeeded.

---

# 15. Security and Data Integrity

## 15.1 Trust Boundaries

All imported data is untrusted.

All persisted data must be validated before being used by gameplay systems.

Never execute code or evaluate expressions from save files.

## 15.2 Validation

Validate:

- Numeric ranges.
- Required fields.
- String lengths.
- Array sizes.
- Enum values.
- Unique identifiers.
- Version compatibility.
- Cross-domain references.

Examples:

- Volume must be between 0 and 1.
- Resolution scale must be within configured limits.
- Sensitivity must be within supported limits.
- Route identifiers must exist.
- Medal values must be valid.
- Run times must be positive.

## 15.3 Data Sanitization

Imported text must be treated as plain data.

Do not insert arbitrary imported strings into HTML.

Do not use imported values as executable JavaScript.

## 15.4 Integrity Limitations

The initial Save System does not provide cryptographic protection against local modification.

Because data is stored on the player's device, a technically capable user can modify it.

The local leaderboard should therefore be described as a personal progression system rather than a secure competitive ranking service.

---

# 16. Performance Requirements

The Save System must not interrupt gameplay.

Requirements:

- All IndexedDB operations are asynchronous.
- No synchronous database access.
- No database writes every frame.
- No large JSON serialization during active movement.
- No blocking migration during gameplay.
- No unnecessary full-database reads.
- Use indexes for frequently queried records.
- Keep frequently accessed settings in memory.

Large backup creation and export should preferably happen outside active gameplay.

---

# 17. UI Integration

## 17.1 Save Status

The player does not need a permanent save notification.

However, important save errors must be visible.

Possible states:

| State | Meaning |
|---|---|
| Saved | All required changes persisted |
| Saving | A save operation is in progress |
| Unsaved | Changes are pending |
| Unavailable | Persistent storage is unavailable |
| Error | A save operation failed |

## 17.2 Settings Screen

The Settings screen should:

- Load stored settings.
- Display defaults for missing fields.
- Update values immediately.
- Save automatically.
- Indicate save failures when necessary.

## 17.3 Data Management Screen

Provide a dedicated section in Settings.

Suggested actions:

```text
DATA MANAGEMENT

Export Save
Import Save
Clear All Data

STORAGE STATUS

Available
Last Saved
Save Version
```

## 17.4 Clear All Data

Clearing data must require confirmation.

The confirmation must clearly explain what will be removed:

- Settings.
- Gameplay progress.
- Training records.
- Speedrun history.
- Personal bests.

The operation must not happen accidentally.

Before deletion, create a backup or allow the player to export their current data.

---

# 18. Reset and New Game

The system must distinguish between resetting progression and resetting all data.

## 18.1 Reset Progress

Resets:

- Tutorial completion.
- Unlocked levels.
- Training completion.
- Progress-related objectives.

Preserves:

- Settings.
- Accessibility configuration.
- Speedrun history, unless explicitly selected.

## 18.2 Reset Speedrun Records

Resets:

- Completed run history.
- Personal best times.
- Section records.
- Speedrun medals.

Preserves:

- General game settings.
- Training progress.
- Other game progression.

## 18.3 Factory Reset

Resets all locally stored game data.

Must require explicit confirmation.

The operation must be transactional where possible.

---

# 19. Integration With Other Systems

## 19.1 Speedrun System

The Speedrun System owns run validation and record semantics.

The Save System provides persistent storage.

Integration requirements:

- Save only completed results.
- Preserve route versions.
- Preserve validation metadata.
- Update records transactionally.
- Support run history retrieval.
- Support personal best retrieval.

The Save System must not independently determine whether a speedrun is valid.

## 19.2 Training System

Training owns exercise completion logic.

The Save System persists training records.

Training must not write directly to IndexedDB.

## 19.3 Settings System

Settings owns configuration semantics.

The Save System persists settings.

Settings must be loaded before dependent gameplay systems initialize.

## 19.4 UI

UI components consume application state.

They must not access repositories directly.

The UI must not determine whether a save transaction succeeded without receiving the actual result.

---

# 20. Suggested Project Structure

```text
src/
  systems/
    save/
      SaveService.ts
      SaveDatabase.ts
      SaveState.ts

      repositories/
        SettingsRepository.ts
        ProgressRepository.ts
        TrainingRepository.ts
        SpeedrunRepository.ts
        MetadataRepository.ts
        BackupRepository.ts

      migrations/
        MigrationManager.ts
        migrations/
          MigrationV1.ts

      backup/
        BackupManager.ts
        BackupValidator.ts
        BackupSerializer.ts

      validation/
        SaveValidator.ts
        SettingsValidator.ts
        ProgressValidator.ts

      types/
        SaveTypes.ts
        SaveMetadata.ts
        BackupTypes.ts

    settings/
      SettingsManager.ts

    progress/
      ProgressManager.ts

    training/
      TrainingProgressManager.ts

    speedrun/
      LeaderboardManager.ts
```

This is a suggested structure.

Adapt it to the existing project architecture instead of duplicating existing systems.

---

# 21. Testing Requirements

## 21.1 Database Tests

- Database initialization.
- Database version upgrades.
- Object store creation.
- Repository CRUD.
- Transaction rollback.
- Connection closure.
- Database unavailable.

## 21.2 Settings Tests

- Load default settings.
- Load existing settings.
- Merge partial settings.
- Validate numeric ranges.
- Debounced saving.
- Multiple rapid modifications.
- Persistence across reloads.

## 21.3 Progress Tests

- Save tutorial completion.
- Unlock level.
- Prevent duplicate progress entries.
- Reset progress.
- Preserve unrelated domains.

## 21.4 Training Tests

- Save exercise completion.
- Update best time.
- Increment attempt count.
- Preserve best time when a slower result is submitted.

## 21.5 Migration Tests

- Version 1 to version 2.
- Multiple sequential migrations.
- Missing fields.
- Invalid legacy data.
- Failed migration rollback.
- Backup recovery.

## 21.6 Backup Tests

- Backup creation.
- Backup restoration.
- Invalid checksum.
- Unsupported format version.
- Missing fields.
- Corrupted JSON.

## 21.7 Import and Export Tests

- Export complete save.
- Import valid save.
- Reject malformed save.
- Preserve existing data after failed import.
- Handle unsupported versions.
- Handle duplicate record identifiers.

## 21.8 Reliability Tests

- Browser refresh during save.
- Tab closing after completed run.
- Storage quota exceeded.
- IndexedDB transaction failure.
- Storage unavailable at startup.
- Multiple rapid save requests.

---

# 22. Implementation Phases

## Phase 1 — Database Foundation

Implement:

- SaveDatabase.
- SaveService.
- Database initialization.
- Initial object stores.
- Repository interfaces.
- Error handling.

Acceptance criteria:

- Database opens correctly.
- Object stores are initialized.
- Repositories can perform CRUD.
- Database errors do not crash gameplay.

## Phase 2 — Settings Persistence

Implement:

- Settings data model.
- Default configuration.
- SettingsRepository.
- SettingsManager integration.
- Debounced persistence.

Acceptance criteria:

- Settings survive application reload.
- Missing fields receive defaults.
- Invalid values are corrected.
- Rapid changes do not cause excessive writes.

## Phase 3 — Progress and Training

Implement:

- ProgressRepository.
- TrainingRepository.
- ProgressManager integration.
- TrainingProgressManager integration.

Acceptance criteria:

- Progress persists.
- Training results persist.
- Duplicate events do not corrupt records.
- Domain resets work independently.

## Phase 4 — Speedrun Integration

Implement:

- SpeedrunRepository.
- LeaderboardManager integration.
- Personal best persistence.
- Run history persistence.

Acceptance criteria:

- Completed valid runs persist.
- Personal records survive reload.
- Existing Speedrun validation remains authoritative.
- Run updates are transactional.

## Phase 5 — Migration System

Implement:

- Save schema versioning.
- MigrationManager.
- Migration history.
- Backup before migration.
- Migration rollback handling.

Acceptance criteria:

- Existing save data migrates correctly.
- Failed migrations preserve original data.
- Unsupported versions are handled safely.

## Phase 6 — Backup and Data Management

Implement:

- BackupManager.
- BackupValidator.
- Export.
- Import.
- Clear All Data.
- Reset Progress.

Acceptance criteria:

- Exported data can be restored.
- Invalid imports are rejected.
- Existing data remains intact after failed import.
- Destructive operations require confirmation.

## Phase 7 — Reliability and Polish

Implement:

- Storage status UI.
- Persistence error handling.
- Recovery logic.
- Storage quota handling.
- Lifecycle tests.
- Performance verification.

Acceptance criteria:

- Game works without persistent storage.
- Save failures are visible.
- No critical save operation blocks gameplay.
- No data domain can silently overwrite unrelated data.

---

# 23. Definition of Done

The Save System is complete when:

- [ ] IndexedDB is initialized reliably.
- [ ] Database schema is versioned.
- [ ] Application save data is versioned.
- [ ] Settings persist across reloads.
- [ ] Gameplay progress persists.
- [ ] Training progress persists.
- [ ] Speedrun records persist.
- [ ] Personal bests persist.
- [ ] Repository interfaces isolate database access.
- [ ] Save operations are asynchronous.
- [ ] Concurrent writes are handled safely.
- [ ] Migrations work.
- [ ] Migration failures preserve original data.
- [ ] Backups can be created and restored.
- [ ] JSON export works.
- [ ] JSON import is validated.
- [ ] Failed imports do not corrupt existing data.
- [ ] Data reset operations are independent.
- [ ] Storage failures do not crash gameplay.
- [ ] The application provides meaningful save status feedback.

---

# 24. Final Design Constraints

The implementation agent must follow these rules:

1. IndexedDB is the primary persistence mechanism.
2. localStorage must not become the primary save database.
3. Database schema version and application save schema version must remain separate.
4. All database operations must be asynchronous.
5. Gameplay systems must not access IndexedDB directly.
6. UI components must not access repositories directly.
7. Save operations must not block gameplay.
8. Settings must use debounced persistence.
9. Completed speedruns must be saved only after validation.
10. Related record updates must use transactions.
11. Migrations must preserve existing data.
12. Failed migrations must not partially overwrite the original save.
13. Imported data must always be treated as untrusted.
14. Backup checksums must not be treated as proof of authenticity.
15. Storage unavailability must not prevent the game from starting.
16. The system must never silently discard existing valid data.
17. The initial implementation must remain fully offline.
18. Cloud synchronization is explicitly outside the current scope.

**Primary objective:** Provide a dependable, versioned persistence layer that protects player progress and settings while remaining independent of gameplay systems and ready for future expansion.