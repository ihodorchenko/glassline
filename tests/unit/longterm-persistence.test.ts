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
import { SpeedrunRecordStore } from "../../src/speedrun/SpeedrunRecordStore";
import { STATISTIC_DEFINITIONS } from "../../src/statistics/StatisticDefinitions";
import { StatisticsSystem } from "../../src/statistics/StatisticsSystem";
import { Database } from "../../src/storage/Database";
import {
  AchievementRepository,
  ProgressionRepository,
  SpeedrunRecordRepository,
  StatisticsRepository,
  TutorialRepository,
} from "../../src/storage/repositories/LongTermRepositories";
import { INITIAL_TUTORIAL_STEPS } from "../../src/tutorial/InitialTutorial";
import { TutorialSystem } from "../../src/tutorial/TutorialSystem";

let counter = 0;
const databaseNames = new Set<string>();

function nextName(): string {
  counter += 1;

  const name = `glassline-longterm-${counter}`;

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

describe("long-term persistence integration", () => {
  it("restores statistics, achievements, progression, tutorial, and records after reload", async () => {
    const name = nextName();

    // First application lifetime.
    const firstDatabase = await openDatabase(name);
    const firstStatistics = new StatisticsSystem({
      definitions: STATISTIC_DEFINITIONS,
      persistence: new StatisticsRepository(firstDatabase),
      clock: () => 1000,
    });
    const firstAchievements = new AchievementSystem({
      definitions: INITIAL_ACHIEVEMENTS,
      persistence: new AchievementRepository(firstDatabase),
      clock: () => 1000,
    });
    const firstProgression = new ProgressionSystem({
      contents: PROGRESSION_CONTENT,
      milestones: PROGRESSION_MILESTONES,
      persistence: new ProgressionRepository(firstDatabase),
      clock: () => 1000,
    });
    const firstTutorial = new TutorialSystem({
      steps: INITIAL_TUTORIAL_STEPS,
      persistence: new TutorialRepository(firstDatabase),
      clock: () => 1000,
    });
    const firstRecords = new SpeedrunRecordStore({
      persistence: new SpeedrunRecordRepository(firstDatabase),
      clock: () => 1000,
    });

    await Promise.all([
      firstStatistics.initialize(),
      firstAchievements.initialize(),
      firstProgression.initialize(),
      firstTutorial.initialize(),
      firstRecords.initialize(),
    ]);

    const trainingEvent = createDomainEvent("training", "training.exercise_completed", {
      eventId: "exercise-1",
      payload: { exerciseId: "ex_01_movement_basics" },
    });

    firstStatistics.startSession({ sessionId: "session-1", mode: "training", startedAt: 1000 });
    firstStatistics.recordEvent(trainingEvent);
    firstStatistics.finalizeSession({ completed: true, endedAt: 11000 });
    firstAchievements.recordEvent(trainingEvent);
    firstProgression.recordEvent(trainingEvent);
    firstTutorial.recordEvent(
      createDomainEvent("movement", "movement.started", { eventId: "tutorial-move" }),
    );
    firstRecords.addRecord({
      id: "record-1",
      routeId: "prologue_test_route",
      routeVersion: 1,
      completionTimeMs: 61000,
      medal: "gold",
      completedAt: 5000,
      splits: [],
      validation: { valid: true, errors: [] },
      sessionId: "session-1",
    });

    await Promise.all([
      firstStatistics.flushPersistence(),
      firstAchievements.flushPersistence(),
      firstProgression.flushPersistence(),
      firstTutorial.flushPersistence(),
      firstRecords.flushPersistence(),
    ]);

    firstDatabase.close();

    // Simulated application reload.
    const secondDatabase = await openDatabase(name);
    const secondStatistics = new StatisticsSystem({
      definitions: STATISTIC_DEFINITIONS,
      persistence: new StatisticsRepository(secondDatabase),
    });
    const secondAchievements = new AchievementSystem({
      definitions: INITIAL_ACHIEVEMENTS,
      persistence: new AchievementRepository(secondDatabase),
    });
    const secondProgression = new ProgressionSystem({
      contents: PROGRESSION_CONTENT,
      milestones: PROGRESSION_MILESTONES,
      persistence: new ProgressionRepository(secondDatabase),
    });
    const secondTutorial = new TutorialSystem({
      steps: INITIAL_TUTORIAL_STEPS,
      persistence: new TutorialRepository(secondDatabase),
    });
    const secondRecords = new SpeedrunRecordStore({
      persistence: new SpeedrunRecordRepository(secondDatabase),
    });

    await Promise.all([
      secondStatistics.initialize(),
      secondAchievements.initialize(),
      secondProgression.initialize(),
      secondTutorial.initialize(),
      secondRecords.initialize(),
    ]);

    expect(secondStatistics.getLifetime().totalSessions).toBe(1);
    expect(secondStatistics.getLifetime().values["training.completed_exercises"]).toBe(1);
    expect(secondAchievements.isUnlocked("first_steps")).toBe(true);
    expect(secondProgression.getSnapshot().trainingCompleted).toBe(1);
    expect(secondProgression.isContentUnlocked("training_running")).toBe(true);
    expect(secondTutorial.getSnapshot().completedStepIds).toContain("move");
    expect(secondRecords.getRecords()).toHaveLength(1);
    expect(secondRecords.getPersonalBest("prologue_test_route", 1)?.completionTimeMs).toBe(61000);

    secondDatabase.close();
  });
});
