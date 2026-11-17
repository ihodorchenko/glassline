import type {
  AchievementPersistence,
  PersistedAchievements,
} from "../../achievements/AchievementTypes";
import type {
  PersistedProgression,
  ProgressionPersistence,
} from "../../progression/ProgressionTypes";
import type {
  PersistedSpeedrunRecords,
  SpeedrunRecordsPersistence,
} from "../../speedrun/SpeedrunRecords";
import type { PersistedStatistics, StatisticsPersistence } from "../../statistics/StatisticsTypes";
import type { PersistedTutorial, TutorialPersistence } from "../../tutorial/TutorialTypes";
import type { Database } from "../Database";
import type { ObjectStoreName } from "../SaveSchema";
import { JsonDocumentRepository } from "./JsonDocumentRepository";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class DocumentPersistence<T extends { readonly schemaVersion: number }> {
  private readonly document: JsonDocumentRepository<unknown>;

  constructor(database: Database, store: ObjectStoreName, key: string) {
    this.document = new JsonDocumentRepository(database, store, key);
  }

  async load(): Promise<T | null> {
    const raw = await this.document.load();

    return isRecord(raw) && typeof raw.schemaVersion === "number" ? (raw as T) : null;
  }

  async save(value: T): Promise<void> {
    await this.document.save(value);
  }
}

export class ProgressionRepository
  extends DocumentPersistence<PersistedProgression>
  implements ProgressionPersistence
{
  constructor(database: Database) {
    super(database, "progress", "player-progression");
  }
}

export class AchievementRepository
  extends DocumentPersistence<PersistedAchievements>
  implements AchievementPersistence
{
  constructor(database: Database) {
    super(database, "achievements", "achievement-records");
  }
}

export class StatisticsRepository
  extends DocumentPersistence<PersistedStatistics>
  implements StatisticsPersistence
{
  constructor(database: Database) {
    super(database, "statistics", "statistics-snapshot");
  }
}

export class TutorialRepository
  extends DocumentPersistence<PersistedTutorial>
  implements TutorialPersistence
{
  constructor(database: Database) {
    super(database, "tutorial", "tutorial-progress");
  }
}

export class SpeedrunRecordRepository
  extends DocumentPersistence<PersistedSpeedrunRecords>
  implements SpeedrunRecordsPersistence
{
  constructor(database: Database) {
    super(database, "speedrun", "leaderboard-records");
  }
}
