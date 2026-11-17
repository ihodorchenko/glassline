import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { AchievementSystem } from "../../src/achievements/AchievementSystem";
import { INITIAL_ACHIEVEMENTS } from "../../src/achievements/InitialAchievements";
import { createDomainEvent } from "../../src/events/DomainEvent";
import {
  PROGRESSION_CONTENT,
  PROGRESSION_MILESTONES,
} from "../../src/progression/ProgressionContent";
import { ProgressionSystem } from "../../src/progression/ProgressionSystem";
import { SettingsManager } from "../../src/settings/SettingsManager";
import { SpeedrunRecordStore } from "../../src/speedrun/SpeedrunRecordStore";
import { STATISTIC_DEFINITIONS } from "../../src/statistics/StatisticDefinitions";
import { StatisticsSystem } from "../../src/statistics/StatisticsSystem";
import { Database, StorageError } from "../../src/storage/Database";
import {
  AchievementRepository,
  ProgressionRepository,
  SpeedrunRecordRepository,
  StatisticsRepository,
  TutorialRepository,
} from "../../src/storage/repositories/LongTermRepositories";
import { SettingsRepository } from "../../src/storage/repositories/SettingsRepository";
import { INITIAL_TUTORIAL_STEPS } from "../../src/tutorial/InitialTutorial";
import { TutorialSystem } from "../../src/tutorial/TutorialSystem";

let counter = 0;
const databaseNames = new Set<string>();

function nextDatabaseName(): string {
  counter += 1;

  const name = `glassline-stabilization-${counter}`;

  databaseNames.add(name);

  return name;
}

async function openDatabase(name: string): Promise<Database> {
  const database = new Database({ name, version: 1, openTimeoutMs: 2000 });

  await database.open();

  return database;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);

    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

afterEach(async () => {
  for (const name of databaseNames) {
    await deleteDatabase(name);
  }

  databaseNames.clear();
});

describe("persistence resilience", () => {
  it("reports malformed settings and falls back to defaults without blocking startup", async () => {
    const name = nextDatabaseName();
    const database = await openDatabase(name);

    await database.put("settings", "settings", { schemaVersion: "not-a-number" });

    const repository = new SettingsRepository(database);

    await expect(repository.load()).rejects.toMatchObject({
      code: "INVALID_RECORD",
    });

    const settings = new SettingsManager({ persistence: repository });

    await expect(settings.initialize()).resolves.toBeUndefined();
    expect(settings.getPersistenceStatus()).toBe("failed");
    expect(typeof settings.getValue("audio.master_volume")).toBe("number");

    database.close();
  });

  it("starts long-term systems fresh when stored domain payloads are corrupt", async () => {
    const name = nextDatabaseName();
    const database = await openDatabase(name);

    await database.put("progress", "player-progression", { corrupt: true });
    await database.put("achievements", "achievement-records", []);
    await database.put("statistics", "statistics-snapshot", "broken");
    await database.put("tutorial", "tutorial-progress", { progress: 42 });
    await database.put("speedrun", "leaderboard-records", { records: "broken" });

    const statistics = new StatisticsSystem({
      definitions: STATISTIC_DEFINITIONS,
      persistence: new StatisticsRepository(database),
    });
    const achievements = new AchievementSystem({
      definitions: INITIAL_ACHIEVEMENTS,
      persistence: new AchievementRepository(database),
    });
    const progression = new ProgressionSystem({
      contents: PROGRESSION_CONTENT,
      milestones: PROGRESSION_MILESTONES,
      persistence: new ProgressionRepository(database),
    });
    const tutorial = new TutorialSystem({
      steps: INITIAL_TUTORIAL_STEPS,
      persistence: new TutorialRepository(database),
    });
    const records = new SpeedrunRecordStore({
      persistence: new SpeedrunRecordRepository(database),
    });

    await Promise.all([
      statistics.initialize(),
      achievements.initialize(),
      progression.initialize(),
      tutorial.initialize(),
      records.initialize(),
    ]);

    expect(statistics.getLifetime().totalSessions).toBe(0);
    expect(achievements.getUnlockedCount()).toBe(0);
    expect(progression.getSnapshot().trainingCompleted).toBe(0);
    expect(tutorial.getSnapshot().completedSteps).toBe(0);
    expect(records.getRecords()).toHaveLength(0);

    database.close();
  });

  it("does not let a stale gameplay session mutate current statistics", () => {
    const statistics = new StatisticsSystem({ definitions: STATISTIC_DEFINITIONS });

    statistics.startSession({ sessionId: "session-a", mode: "training" });

    const staleEvent = createDomainEvent("movement", "movement.jump", {
      eventId: "stale",
      sessionId: "session-b",
      payload: { value: 1 },
    });

    expect(statistics.recordEvent(staleEvent)).toBe(false);
    expect(statistics.getValue("general.total_jumps")).toBeNull();

    statistics.finalizeSession({ completed: false });
    statistics.startSession({ sessionId: "session-b", mode: "prologue" });

    expect(statistics.recordEvent(staleEvent)).toBe(false);
    expect(statistics.getCurrentSession()?.values["general.total_jumps"]).toBeUndefined();
  });

  it("accepts new events after restoring legacy processed event ids from a previous page load", () => {
    const persistence = {
      load: async () => ({
        schemaVersion: 1,
        revision: 0,
        lifetime: {
          totalPlayTimeSeconds: 0,
          totalSessions: 0,
          completedSessions: 0,
          values: {},
          updatedAt: 0,
        },
        modes: {},
        recentSessions: [],
        // Legacy IDs were sequence-based and could repeat after a page reload.
        processedEventIds: [
          "checkpoint:checkpoint.activated:1",
          "checkpoint:checkpoint.activated:5",
        ],
        updatedAt: 0,
      }),
      save: async () => undefined,
    };
    const statistics = new StatisticsSystem({
      definitions: STATISTIC_DEFINITIONS,
      persistence,
    });

    return statistics.initialize().then(() => {
      statistics.startSession({ sessionId: "session-after-reload", mode: "speedrun" });
      const event = createDomainEvent("checkpoint", "checkpoint.activated", {
        sessionId: "session-after-reload",
        payload: { value: 1, checkpointId: "cp_rooftop" },
      });

      expect(statistics.recordEvent(event)).toBe(true);
      expect(statistics.getCurrentSession()?.values["exploration.checkpoints_activated"]).toBe(1);
    });
  });

  it("surfaces storage errors with a stable code", () => {
    const error = new StorageError("INVALID_RECORD", "bad payload");

    expect(error.name).toBe("StorageError");
    expect(error.code).toBe("INVALID_RECORD");
  });
});
