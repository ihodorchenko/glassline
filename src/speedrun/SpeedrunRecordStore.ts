import type { Disposable } from "../core/Disposable";
import type {
  PersistedSpeedrunRecords,
  SpeedrunRecordEntry,
  SpeedrunRecordStoreOptions,
  SpeedrunRecordsPersistence,
} from "./SpeedrunRecords";

const SCHEMA_VERSION = 1;
const MAX_STORED_RECORDS = 50;
const PLAUSIBLE_EPOCH_MIN = Date.UTC(2000, 0, 1);

function sortRecords(records: readonly SpeedrunRecordEntry[]): SpeedrunRecordEntry[] {
  return [...records].sort((left, right) => {
    if (left.completionTimeMs !== right.completionTimeMs) {
      return left.completionTimeMs - right.completionTimeMs;
    }

    return left.completedAt - right.completedAt;
  });
}

/**
 * Local validated Speedrun records and personal bests (`docs/09` §11).
 * Persistence is provided through Save System repositories.
 */
export class SpeedrunRecordStore implements Disposable {
  private readonly persistence: SpeedrunRecordsPersistence | null;
  private readonly clock: () => number;
  private records: SpeedrunRecordEntry[] = [];
  private saveChain: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(options: SpeedrunRecordStoreOptions = {}) {
    this.persistence = options.persistence ?? null;
    this.clock = options.clock ?? (() => Date.now());
  }

  async initialize(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    try {
      const loaded = await this.persistence.load();

      if (loaded) {
        this.records = sortRecords(
          loaded.records
            .map((entry) => this.normalizeLoadedRecord(entry))
            .filter((entry): entry is SpeedrunRecordEntry => entry !== null),
        );
      }
    } catch (error) {
      console.warn("[Glassline] Speedrun records could not be restored.", error);
    }
  }

  addRecord(entry: SpeedrunRecordEntry): boolean {
    if (this.disposed || !entry.validation.valid) {
      return false;
    }

    if (this.records.some((record) => record.id === entry.id)) {
      return false;
    }

    this.records = sortRecords([...this.records, entry]).slice(0, MAX_STORED_RECORDS);
    this.schedulePersistence();

    return true;
  }

  getRecords(routeId?: string, routeVersion?: number): readonly SpeedrunRecordEntry[] {
    return this.records.filter(
      (record) =>
        (routeId === undefined || record.routeId === routeId) &&
        (routeVersion === undefined || record.routeVersion === routeVersion),
    );
  }

  getRecent(limit = 5): readonly SpeedrunRecordEntry[] {
    return [...this.records]
      .sort((left, right) => right.completedAt - left.completedAt)
      .slice(0, limit);
  }

  getPersonalBest(routeId?: string, routeVersion?: number): SpeedrunRecordEntry | null {
    return this.getRecords(routeId, routeVersion)[0] ?? null;
  }

  isPersonalBest(entry: SpeedrunRecordEntry): boolean {
    const best = this.getPersonalBest(entry.routeId, entry.routeVersion);

    return best?.id === entry.id;
  }

  async clear(): Promise<void> {
    this.records = [];
    this.schedulePersistence();
    await this.saveChain;
  }

  async flushPersistence(): Promise<void> {
    await this.saveChain;
  }

  dispose(): void {
    this.disposed = true;
  }

  /**
   * Recovers records written by older builds where `completedAt` used a
   * monotonic clock value instead of an epoch timestamp.
   */
  private normalizeLoadedRecord(record: SpeedrunRecordEntry): SpeedrunRecordEntry | null {
    if (
      !record ||
      typeof record.id !== "string" ||
      typeof record.routeId !== "string" ||
      !Number.isFinite(record.routeVersion) ||
      !Number.isFinite(record.completionTimeMs) ||
      record.completionTimeMs <= 0 ||
      record.validation?.valid !== true
    ) {
      return null;
    }

    const completedAt =
      Number.isFinite(record.completedAt) && record.completedAt >= PLAUSIBLE_EPOCH_MIN
        ? record.completedAt
        : this.clock();

    return {
      ...record,
      completedAt,
      splits: Array.isArray(record.splits) ? [...record.splits] : [],
    };
  }

  private schedulePersistence(): void {
    if (!this.persistence) {
      return;
    }

    const payload: PersistedSpeedrunRecords = {
      schemaVersion: SCHEMA_VERSION,
      records: [...this.records],
      updatedAt: this.clock(),
    };

    this.saveChain = this.saveChain
      .then(() => this.persistence?.save(payload))
      .catch((error: unknown) => {
        console.warn("[Glassline] Speedrun record persistence failed.", error);
      });
  }
}
