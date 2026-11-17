import type { PersistedSettingsPayload } from "../storage/repositories/SettingsRepository";
import { SETTING_DEFINITIONS, SETTINGS_BY_ID } from "./SettingsDefinitions";
import type {
  SettingCategory,
  SettingDefinition,
  SettingsSnapshot,
  SettingValue,
} from "./SettingsTypes";
import {
  buildSettingsValues,
  type SettingsValidationIssue,
  validateSettingChanges,
} from "./SettingsValidator";

/** Persistence contract consumed by the Settings System. */
export interface SettingsPersistence {
  load(): Promise<PersistedSettingsPayload | null>;
  save(values: Readonly<Record<string, unknown>>, revision: number): Promise<void>;
  clear(): Promise<void>;
}

export type SettingsPersistenceStatus =
  | "uninitialized"
  | "ready"
  | "unavailable"
  | "pending"
  | "failed";

export interface SettingsOperationResult {
  readonly applied: boolean;
  readonly persisted: boolean;
  readonly issues: readonly SettingsValidationIssue[];
}

export type SettingsListener = (
  snapshot: SettingsSnapshot,
  changedSettingIds: readonly string[],
) => void;

export type Unsubscribe = () => void;

export interface SettingsManagerOptions {
  readonly definitions?: readonly SettingDefinition[];
  readonly persistence: SettingsPersistence | null;
}

/**
 * Owns the committed settings values, validation, snapshots, and persistence
 * coordination. Runtime application is delegated to adapters through
 * `SettingsApplicationPipeline` (`docs/25_SETTINGS_SYSTEM_SPEC.md` §3, §9, §11).
 */
export class SettingsManager {
  private readonly definitions: readonly SettingDefinition[];
  private readonly definitionsById: ReadonlyMap<string, SettingDefinition>;
  private readonly persistence: SettingsPersistence | null;
  private readonly listeners = new Set<SettingsListener>();

  private values: Record<string, SettingValue>;
  private revision = 0;
  private persistenceStatus: SettingsPersistenceStatus = "uninitialized";
  private initialized = false;
  private lastLoadIssues: readonly SettingsValidationIssue[] = [];

  constructor(options: SettingsManagerOptions = { persistence: null }) {
    this.definitions = options.definitions ?? SETTING_DEFINITIONS;
    this.definitionsById =
      options.definitions === undefined
        ? SETTINGS_BY_ID
        : new Map(this.definitions.map((definition) => [definition.id, definition]));
    this.persistence = options.persistence;
    this.values = { ...buildSettingsValues(this.definitions, {}).values };
  }

  getSnapshot(): SettingsSnapshot {
    return { revision: this.revision, values: { ...this.values } };
  }

  getValue<T extends SettingValue>(settingId: string): T | undefined {
    return this.values[settingId] as T | undefined;
  }

  getDefinition(settingId: string): SettingDefinition | undefined {
    return this.definitionsById.get(settingId);
  }

  getDefinitions(): readonly SettingDefinition[] {
    return this.definitions;
  }

  getPersistenceStatus(): SettingsPersistenceStatus {
    return this.persistenceStatus;
  }

  getLastLoadIssues(): readonly SettingsValidationIssue[] {
    return this.lastLoadIssues;
  }

  /**
   * Loads persisted values and merges them over canonical defaults.
   * Persistence failures are reported through status and must not prevent startup.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (!this.persistence) {
      this.persistenceStatus = "unavailable";
      return;
    }

    try {
      const payload = await this.persistence.load();

      if (!payload) {
        this.persistenceStatus = "ready";
        return;
      }

      const merged = buildSettingsValues(this.definitions, payload.values);

      this.values = { ...merged.values };
      this.lastLoadIssues = merged.issues;
      this.revision =
        Number.isInteger(payload.revision) && payload.revision >= 0 ? payload.revision : 0;
      this.persistenceStatus = "ready";
    } catch (error) {
      this.persistenceStatus = "failed";
      console.warn("[Glassline] Settings could not be loaded; using defaults.", error);
    }
  }

  /**
   * Validates and applies a set of settings atomically.
   * Invalid changes are rejected without modifying the committed values.
   */
  async update(changes: Readonly<Record<string, unknown>>): Promise<SettingsOperationResult> {
    const validation = validateSettingChanges(this.definitionsById, changes);

    if (!validation.valid) {
      return { applied: false, persisted: false, issues: validation.issues };
    }

    const nextValues: Record<string, SettingValue> = { ...this.values };

    for (const [settingId, value] of Object.entries(changes)) {
      nextValues[settingId] = value as SettingValue;
    }

    return this.commit(nextValues, Object.keys(changes));
  }

  async resetCategory(category: SettingCategory): Promise<SettingsOperationResult> {
    const categoryDefinitions = this.definitions.filter(
      (definition) => definition.category === category,
    );
    const nextValues: Record<string, SettingValue> = { ...this.values };

    for (const definition of categoryDefinitions) {
      nextValues[definition.id] = definition.defaultValue;
    }

    return this.commit(
      nextValues,
      categoryDefinitions.map((definition) => definition.id),
    );
  }

  async resetAll(): Promise<SettingsOperationResult> {
    const { values } = buildSettingsValues(this.definitions, {});

    return this.commit(
      { ...values },
      this.definitions.map((definition) => definition.id),
    );
  }

  subscribe(listener: SettingsListener): Unsubscribe {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
  }

  private async commit(
    nextValues: Record<string, SettingValue>,
    changedSettingIds: readonly string[],
  ): Promise<SettingsOperationResult> {
    this.values = nextValues;
    this.revision += 1;

    const snapshot = this.getSnapshot();
    const persisted = await this.persist(snapshot);

    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot, changedSettingIds);
      } catch (error) {
        console.error("[Glassline] A settings listener failed.", error);
      }
    }

    return { applied: true, persisted, issues: [] };
  }

  private async persist(snapshot: SettingsSnapshot): Promise<boolean> {
    if (!this.persistence) {
      this.persistenceStatus = "unavailable";
      return false;
    }

    this.persistenceStatus = "pending";

    try {
      await this.persistence.save(snapshot.values, snapshot.revision);
      this.persistenceStatus = "ready";
      return true;
    } catch (error) {
      this.persistenceStatus = "failed";
      console.warn("[Glassline] Settings were applied but could not be persisted.", error);
      return false;
    }
  }
}
