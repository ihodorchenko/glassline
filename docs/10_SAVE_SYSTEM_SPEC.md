# 10_SAVE_SYSTEM_SPEC.md

**Project:** Glassline  
**Document:** Save System Specification

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
- Player statistics.
- Achievement history.
- Tutorial history.
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

The single canonical database for all persisted game data:

```text
GlasslineSaveData
```

This database name and its version (see 2.3) are owned exclusively by this specification. Every persistent domain — settings, progression, training, speedrun, statistics, achievements, tutorial history, metadata, and backups — lives in this database. Other documents must reference this name and must not declare a separate database name or version.

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
| settings | Player and game settings (owned by the Settings System) |
| progress | Gameplay progression records (owned by the Progression System) |
| training | Training exercise progress (owned by the Training System) |
| speedrun | Speedrun records, personal records, and run history (owned by the Speedrun System) |
| statistics | Aggregated statistics, mode aggregates, session summaries, and deduplication metadata (owned by the Statistics System) |
| achievements | Achievement history and unlock state (owned by the Achievement System) |
| tutorial | Tutorial history records (owned by the Tutorial System) |
| metadata | Save metadata and migration information (owned by the Save System) |
| backups | Local backup snapshots (owned by the Save System) |

Each store must have exactly one owning system. The owning system defines the meaning of the stored payload; the Save System defines the store layout, indexes, versioning, and transaction boundaries.

Specialized systems must access their own data through repository interfaces rather than manipulating IndexedDB directly.

## 2.5 Architecture Overview

```text
             Game Systems
                  |
                  v
   Domain Systems and Repositories
   (Settings, Progression, Training,
    Speedrun, Statistics, Achievement,
    Tutorial)
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

The Speedrun System owns the interpretation, validation, personal-best comparison, and ranking semantics of these records.

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

## 3.6 Statistics

Contains aggregated statistics owned by the Statistics System (`30_STATISTICS_SYSTEM_SPEC.md`).

Examples:

- Lifetime aggregates.
- Mode aggregates.
- Recent session summaries.
- Statistics deduplication metadata.
- Statistics schema version.

The Statistics System defines aggregation, reset scopes, and snapshot semantics. The Save System only provides versioned persistence and transactionality.

## 3.7 Achievements

Contains achievement history and unlock state owned by the Achievement System (`29_ACHIEVEMENT_SYSTEM_SPEC.md`).

Examples:

- Unlocked achievements.
- Achievement progress snapshots.
- Unlock timestamps.
- Achievement schema version.

The Achievement System owns definitions, evaluation, and unlock state. The Save System must not evaluate achievement conditions.

## 3.8 Tutorial History

Contains tutorial history records owned by the Tutorial System (`28_TUTORIAL_SYSTEM_SPEC.md`).

Examples:

- Completed and skipped tutorials.
- Tutorial repeat and cooldown history.
- Tutorial schema version.

The Tutorial System owns history semantics, repetition policy, and completion meaning. The Save System only persists the records and their schema version.

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

    settings: PersistedSettingsPayload;

    progress: GameProgress;

    training: TrainingProgress;

    metadata: SaveMetadata;
}
```

Speedrun history, statistics, achievement history, and tutorial history are stored separately from the startup root record to avoid loading large histories during initialization. They are accessed through their owning systems' repositories.

The root save structure describes the logical contents of the save system, not necessarily one physical IndexedDB record.

The interfaces in this document describe the persisted representation only. The owning domain systems define their payload schemas and rules; the Save System stores, versions, and validates the envelope.

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

The Settings System owns the canonical settings schema, default values, validation constraints, merge semantics, and runtime application (`25_SETTINGS_SYSTEM_SPEC.md`).

The Save System persists the committed settings payload through `SettingsRepository`. It must not define an independent settings model, default set, or clamping rules. The structures below are illustrative of the persisted payload only; where they differ from the Settings System specification, the Settings System is authoritative.

## 5.1 Settings Payload (Illustrative)

The persisted settings payload is the committed `SettingsConfiguration` defined by `25_SETTINGS_SYSTEM_SPEC.md` §5.1.

```typescript
interface PersistedSettingsPayload {
    schemaVersion: number;

    revision: number;

    committedAt: number;

    /** Canonical SettingsConfiguration serialized by the Settings System. */
    values: Record<string, unknown>;
}
```

The Save System treats the committed values as an opaque, versioned payload. The canonical setting IDs, value types, categories, and defaults are defined by `25_SETTINGS_SYSTEM_SPEC.md` §5 and §7 and must not be duplicated in this document.

## 5.2 Default Settings

Default values are defined by the Settings System (`25_SETTINGS_SYSTEM_SPEC.md`). The Save System must not maintain or apply an independent default configuration.

When a persisted payload is incomplete or invalid, the Save System reports the problem to the Settings System; the Settings System decides how to merge defaults or repair values. The Save System must not silently rewrite the payload.

## 5.3 Settings Save Behavior

Settings should be saved automatically when modified.

However, avoid writing to IndexedDB on every slider movement.

Use debounced persistence.

Recommended behavior:

1. The Settings System updates the value immediately in memory.
2. The Settings System applies the value to the relevant runtime systems.
3. The Save System schedules a persistent save.
4. Combine rapid consecutive modifications.
5. Save after a short inactivity period.

Recommended debounce interval:

```typescript
const SETTINGS_SAVE_DEBOUNCE = 500;
```

Flush pending settings writes when the Settings System requests it (for example when leaving the settings screen).

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

The Tutorial, Training, Level Runtime, and Progression Systems decide when a completion or unlock event is confirmed. The Save System persists the confirmed result.

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

Unlock and progression rules are owned by the Progression System (`22_PROGRESSION_SYSTEM_SPEC.md`); this section describes only the persistence guarantees.

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

Training result semantics, mastery, and scoring are owned by the Training System (`21_TRAINING_SYSTEM_SPEC.md`). The repository applies the following persistence rules:

- Every completed exercise updates its stored record.
- Attempt counts are supplied by the Training System.
- The stored best time is replaced only when the Training System reports an improvement.
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

It must not depend on gameplay objects, rendering objects, or UI components. Domain-specific validation and interpretation are delegated to the owning systems.

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

Large histories (speedrun, statistics, achievement, and tutorial records) are loaded by their owning systems after startup, only when required. They are not part of the startup root record.

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
| Statistics | Batched on session finalization and meaningful revisions |
| Achievement History | On confirmed unlock or progress change |
| Tutorial History | On confirmed tutorial event |
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

- Saving a completed run together with the personal-record update supplied by the Speedrun System.
- Creating a backup snapshot.
- Importing multiple data domains.
- Applying a migration.

If an operation fails, related writes must roll back together.

---

# 10. Data Versioning and Migration

## 10.1 Why Versioning Is Required

The game will evolve during development.

Settings, progress structures, and speedrun record formats may change.

Existing player data must not become unusable after an application update.

The Save System must support forward migration between supported historical versions.

## 10.2 Save Schema Version

Initial application save schema:

```typescript
const SAVE_SCHEMA_VERSION = 1;
```

Every serialized domain must either include a schema version or be governed by an explicitly versioned parent record.

Domains with independently versioned payloads (for example Statistics, Achievement history, and Tutorial history) register their schema versions and migrations through the Save migration infrastructure. The Save System must not reinterpret or migrate a domain payload without the owning system's migration definition.

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
4. Supply defaults for newly introduced fields according to the owning system's migration definition.
5. Record successful migration history.
6. Make migrations deterministic.
7. Avoid depending on current gameplay state.
8. Do not silently discard unsupported data.
9. Never delete data solely because its schema version is unsupported or newer than expected; preserve it and report the incompatibility.

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
    format: "glassline-save";

    formatVersion: number;

    createdAt: number;

    applicationVersion: string;

    databaseVersion: number;

    saveData: {
        settings: PersistedSettingsPayload;

        progress: GameProgress;

        training: TrainingProgress;

        speedrun: unknown;

        statistics: unknown;

        achievements: unknown;

        tutorial: unknown;
    };

    checksum: string;
}
```

The `settings`, `progress`, `training`, `speedrun`, `statistics`, `achievements`, and `tutorial` payloads must use the actual versioned models owned by their respective systems in the final implementation; the field references above are illustrative.

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

Semantic validation of a domain payload is delegated to its owning system. The Save System validates the envelope, format, checksum, required fields, types, and cross-domain references.

A checksum detects accidental corruption but does not prove authenticity.

Do not treat imported backup data as trusted.

---

# 12. Export and Import

## 12.1 Export

The player should be able to export their local save data as JSON.

Suggested filename:

```text
glassline-save-YYYY-MM-DD.json
```

The export must include:

- Settings.
- Gameplay progress.
- Training progress.
- Speedrun records.
- Statistics.
- Achievement history.
- Tutorial history.
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

Semantic domain validation is delegated to the owning systems. The Save System validates the import envelope, schema, types, version compatibility, and cross-domain references; a domain payload rejected by its owner must not be persisted as valid.

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

Imported speedrun records must be treated as external, untrusted data.

They must not automatically receive verified status.

The Save System validates the structural envelope and preserves import metadata. Run validity, route compatibility, checkpoint order, and record acceptance are decided by the Speedrun System (`09_SPEEDRUN_SYSTEM_SPEC.md`), which owns validation and personal-best semantics.

The Save System must:

- Persist imported records with an explicit untrusted/import provenance marker until the Speedrun System accepts or rejects them.
- Preserve original import metadata.
- Distinguish imported records from locally generated records.
- Never silently overwrite a trusted personal record; personal-best comparison and replacement are Speedrun responsibilities.

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

Run-history retention policy is owned by the Speedrun System. The Save System must not silently discard stored records merely to save space; any pruning must follow an explicit, documented policy.

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

Semantic validation of domain values is delegated to the owning system. For example, the Speedrun System validates run validity, route compatibility, checkpoint order, medal evaluation, and personal-best semantics; the Save System validates structure, types, ranges, and referential integrity.

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

Persistence must therefore not be treated as proof of record authenticity. How local Speedrun records and leaderboard limitations are presented is defined by the Speedrun System and the UI specifications (`09_SPEEDRUN_SYSTEM_SPEC.md`).

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

UI screens are owned by the Menu and HUD specifications (`23_HUD_SYSTEM_SPEC.md`, `24_MENU_SYSTEM_SPEC.md`, `25_SETTINGS_SYSTEM_SPEC.md`). This section defines only the save status and data-management contracts the Save System exposes to those screens; it does not grant the Save System ownership of UI behavior.

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
- Display missing values using the Settings System's canonical defaults.
- Update values immediately.
- Save automatically.
- Indicate save failures when necessary.

## 17.3 Data Management Screen

The Settings screen should provide a dedicated section backed by the Save System.

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
- Statistics.
- Achievement history.
- Tutorial history.

The operation must not happen accidentally.

Before deletion, create a backup or allow the player to export their current data.

---

# 18. Reset and New Game

The system must distinguish between resetting progression and resetting all data.

The scope and semantics of each reset are defined by the owning domain systems (Progression, Speedrun, Statistics, Achievement, Tutorial). The Save System executes the coordinated deletion and persistence; it must not invent or duplicate domain reset rules.

## 18.1 Reset Progress

Coordinated by the Progression System (`22_PROGRESSION_SYSTEM_SPEC.md`).

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

Coordinated by the Speedrun System (`09_SPEEDRUN_SYSTEM_SPEC.md`).

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

The Speedrun System owns run validation, run record semantics, and personal-best decisions (`09_SPEEDRUN_SYSTEM_SPEC.md`).

The Save System provides persistent storage.

Integration requirements:

- Save only completed results.
- Preserve route versions.
- Preserve validation metadata.
- Update records transactionally.
- Support run history retrieval.
- Support personal best retrieval.

The Save System must not independently determine whether a speedrun is valid, compare run times, or decide whether a personal best was improved.

## 19.2 Training System

Training owns exercise completion, evaluation, and result semantics (`21_TRAINING_SYSTEM_SPEC.md`).

The Save System persists training records.

Training must not write directly to IndexedDB.

## 19.3 Settings System

Settings owns configuration semantics (`25_SETTINGS_SYSTEM_SPEC.md`).

The Save System persists settings.

Settings must be loaded before dependent gameplay systems initialize.

## 19.4 UI

UI components consume application state.

They must not access repositories directly.

The UI must not determine whether a save transaction succeeded without receiving the actual result.

## 19.5 Statistics, Achievement, Tutorial, and Progression Systems

For every persisted domain, the owning system defines the payload schema and semantics, and the Save System provides the repository, versioning, and transaction boundaries.

- Statistics persistence follows `30_STATISTICS_SYSTEM_SPEC.md`.
- Achievement persistence follows `29_ACHIEVEMENT_SYSTEM_SPEC.md`.
- Tutorial history persistence follows `28_TUTORIAL_SYSTEM_SPEC.md`.
- Progression persistence follows `22_PROGRESSION_SYSTEM_SPEC.md`.

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
        StatisticsRepository.ts
        AchievementRepository.ts
        TutorialHistoryRepository.ts
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
      SpeedrunRepository.ts
```

This is a suggested structure.

Repository names are indicative. The canonical repository interfaces belong to the owning system specifications (for example `ISettingsRepository` in `25_SETTINGS_SYSTEM_SPEC.md`, `IProgressionRepository` in `22_PROGRESSION_SYSTEM_SPEC.md`, `IStatisticsRepository` in `30_STATISTICS_SYSTEM_SPEC.md`, `IAchievementRepository` in `29_ACHIEVEMENT_SYSTEM_SPEC.md`, `ITutorialHistoryRepository` in `28_TUTORIAL_SYSTEM_SPEC.md`) and to `02_TECHNICAL_ARCHITECTURE.md`.

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

- Load an existing settings payload.
- Request canonical defaults from the Settings System when the payload is missing.
- Report an invalid payload to the Settings System without silently rewriting it.
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

## 21.9 Domain Persistence Tests

- Statistics aggregates survive reload through their repository.
- Achievement history survives reload through its repository.
- Tutorial history survives reload through its repository.
- Domain payloads are stored unchanged and are not reinterpreted by the Save System.
- A domain schema version upgrade is handled in coordination with the owning system.

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

- Settings payload integration (schema owned by the Settings System).
- SettingsRepository.
- SettingsManager integration.
- Debounced persistence.

Acceptance criteria:

- Settings survive application reload.
- A missing settings payload is reported so that the Settings System can apply its canonical defaults.
- An invalid payload is reported to the Settings System and is not silently rewritten.
- Rapid changes do not cause excessive writes.

## Phase 3 — Progress, Training, and Domain Repositories

Implement:

- ProgressRepository.
- TrainingRepository.
- Repository interfaces for Statistics, Achievement history, and Tutorial history (payload schemas owned by those systems).
- ProgressManager integration.
- TrainingProgressManager integration.

Acceptance criteria:

- Progress persists.
- Training results persist.
- Domain payloads persist unchanged through their owning repositories.
- Duplicate events do not corrupt records.
- Domain resets work independently.

## Phase 4 — Speedrun Integration

Implement:

- SpeedrunRepository.
- Speedrun record contract integration (reference semantics owned by `09_SPEEDRUN_SYSTEM_SPEC.md`).
- Personal-record persistence supplied by the Speedrun System.
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
- [ ] Statistics aggregates persist through Save repositories.
- [ ] Achievement history persists through Save repositories.
- [ ] Tutorial history persists through Save repositories.
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
19. The database name and version defined in this specification are canonical; no other system may declare a separate save database.
20. Domain rules (settings semantics, progression, training results, run validity and personal bests, achievements, statistics aggregation, tutorial history) remain owned by their respective systems; the Save System must not duplicate them.

**Primary objective:** Provide a dependable, versioned persistence layer that protects player progress and settings while remaining independent of gameplay systems and ready for future expansion.