import { isFiniteNumber } from "../../shared/math";
import { type Database, StorageError } from "../Database";
import { type ObjectStoreName, SAVE_DATA_VERSION } from "../SaveSchema";

/**
 * Persisted settings payload.
 *
 * The payload is owned by the Settings System (`docs/25_SETTINGS_SYSTEM_SPEC.md`);
 * the Save System stores it as an opaque, versioned record
 * (`docs/10_SAVE_SYSTEM_SPEC.md` §5.1).
 */
export interface PersistedSettingsPayload {
  readonly schemaVersion: number;
  readonly revision: number;
  readonly committedAt: number;
  readonly values: Readonly<Record<string, unknown>>;
}

const SETTINGS_STORE: ObjectStoreName = "settings";
const SETTINGS_RECORD_KEY = "settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePayload(raw: unknown): PersistedSettingsPayload {
  if (
    !isRecord(raw) ||
    !isFiniteNumber(raw.schemaVersion) ||
    !isFiniteNumber(raw.revision) ||
    !isFiniteNumber(raw.committedAt) ||
    !isRecord(raw.values)
  ) {
    throw new StorageError(
      "INVALID_RECORD",
      "Persisted settings payload is malformed. The Settings System decides how to repair it.",
    );
  }

  return {
    schemaVersion: raw.schemaVersion,
    revision: raw.revision,
    committedAt: raw.committedAt,
    values: raw.values,
  };
}

/** Repository for the single committed settings payload. */
export class SettingsRepository {
  private readonly database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async load(): Promise<PersistedSettingsPayload | null> {
    const raw = await this.database.get<unknown>(SETTINGS_STORE, SETTINGS_RECORD_KEY);

    if (raw === undefined) {
      return null;
    }

    return validatePayload(raw);
  }

  async save(values: Readonly<Record<string, unknown>>, revision: number): Promise<void> {
    const payload: PersistedSettingsPayload = {
      schemaVersion: SAVE_DATA_VERSION,
      revision,
      committedAt: Date.now(),
      values,
    };

    await this.database.put(SETTINGS_STORE, SETTINGS_RECORD_KEY, payload);
  }

  async clear(): Promise<void> {
    await this.database.delete(SETTINGS_STORE, SETTINGS_RECORD_KEY);
  }
}
