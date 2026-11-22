import type { Disposable } from "../core/Disposable";
import type { DomainEvent } from "../events/DomainEvent";
import { readPayloadNumber, readPayloadString } from "../events/DomainEvent";
import { PROLOGUE_COMPLETION_LEVEL_ID } from "./LevelCompletionPolicy";
import type {
  PersistedProgression,
  PlayerProgression,
  ProgressionCondition,
  ProgressionContentDefinition,
  ProgressionListener,
  ProgressionMilestoneDefinition,
  ProgressionPersistence,
  ProgressionSnapshot,
  ProgressionSystemOptions,
} from "./ProgressionTypes";

const SCHEMA_VERSION = 2;
const MAX_PROCESSED_EVENT_IDS = 500;
const TRAINING_EXERCISE_COUNT = 10;

function createEmptyProgression(timestamp: number): PlayerProgression {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    training: { completedExerciseIds: [], masteredExerciseIds: [] },
    campaign: { completedLevelIds: [], prologueCompleted: false },
    unlocks: { unlockedContentIds: [], unlockedAt: {} },
    milestones: [],
    statistics: {
      totalCompletedExercises: 0,
      totalMasteredExercises: 0,
      totalCompletedLevels: 0,
      totalPlayTimeSeconds: 0,
    },
    consumedAchievementIds: [],
  };
}

/**
 * Authoritative cross-mode progression (`docs/22`).
 *
 * It consumes validated domain events, owns persistent completion/unlock/
 * milestone state, and exposes deterministic snapshots. It does not evaluate
 * achievements or gameplay.
 */
export class ProgressionSystem implements Disposable {
  private readonly contents: readonly ProgressionContentDefinition[];
  private readonly contentById = new Map<string, ProgressionContentDefinition>();
  private readonly milestones: readonly ProgressionMilestoneDefinition[];
  private readonly milestoneById = new Map<string, ProgressionMilestoneDefinition>();
  private readonly clock: () => number;
  private readonly persistence: ProgressionPersistence | null;
  private readonly listeners = new Set<ProgressionListener>();
  private readonly processedEventIds = new Set<string>();

  private progression: PlayerProgression;
  private saveChain: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(options: ProgressionSystemOptions) {
    this.contents = [...options.contents];
    this.milestones = [...options.milestones];
    this.clock = options.clock ?? (() => Date.now());
    this.persistence = options.persistence ?? null;
    this.progression = createEmptyProgression(this.clock());

    for (const content of this.contents) {
      if (this.contentById.has(content.id)) {
        throw new Error(`Duplicate progression content id "${content.id}".`);
      }

      this.contentById.set(content.id, content);
    }

    for (const milestone of this.milestones) {
      if (this.milestoneById.has(milestone.id)) {
        throw new Error(`Duplicate progression milestone id "${milestone.id}".`);
      }

      this.milestoneById.set(milestone.id, milestone);
    }

    this.reconcileUnlocks();
    this.reconcileMilestones();
  }

  async initialize(): Promise<void> {
    if (this.persistence) {
      try {
        const loaded = await this.persistence.load();

        if (loaded) {
          this.progression = this.sanitizeProgression(loaded.progression);

          for (const eventId of loaded.processedEventIds) {
            this.processedEventIds.add(eventId);
          }
        }
      } catch (error) {
        console.warn("[Glassline] Progression could not be restored; starting fresh.", error);
        this.progression = createEmptyProgression(this.clock());
      }
    }

    this.reconcileUnlocks();
    this.reconcileMilestones();
  }

  getSnapshot(): ProgressionSnapshot {
    const progression = this.progression;

    return {
      revision: progression.revision,
      trainingCompleted: progression.training.completedExerciseIds.length,
      trainingMastered: progression.training.masteredExerciseIds.length,
      prologueCompleted: progression.campaign.prologueCompleted,
      prologueBestCompletionTime: progression.campaign.prologueBestCompletionTime ?? null,
      milestones: progression.milestones.map((milestone) => ({ ...milestone })),
      unlockedContentIds: [...progression.unlocks.unlockedContentIds],
      statistics: { ...progression.statistics },
    };
  }

  getProgression(): PlayerProgression {
    return JSON.parse(JSON.stringify(this.progression)) as PlayerProgression;
  }

  isContentUnlocked(contentId: string): boolean {
    return this.progression.unlocks.unlockedContentIds.includes(contentId);
  }

  getContentDefinitions(): readonly ProgressionContentDefinition[] {
    return this.contents;
  }

  hasMilestone(milestoneId: string): boolean {
    return this.progression.milestones.some((milestone) => milestone.id === milestoneId);
  }

  subscribe(listener: ProgressionListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  recordEvent(event: DomainEvent): boolean {
    if (this.disposed || this.processedEventIds.has(event.eventId)) {
      return false;
    }

    this.processedEventIds.add(event.eventId);
    this.trimProcessedEventIds();

    let changed = false;

    switch (event.type) {
      case "training.exercise_completed": {
        const exerciseId = readPayloadString(event, "exerciseId");

        if (exerciseId && !this.progression.training.completedExerciseIds.includes(exerciseId)) {
          this.progression.training.completedExerciseIds.push(exerciseId);
          this.progression.statistics.totalCompletedExercises =
            this.progression.training.completedExerciseIds.length;

          if (this.progression.training.completedExerciseIds.length >= TRAINING_EXERCISE_COUNT) {
            this.progression.training.completedAt = event.timestamp;
          }

          changed = true;
        }

        break;
      }
      case "level.completed": {
        const levelId = readPayloadString(event, "levelId") ?? PROLOGUE_COMPLETION_LEVEL_ID;

        if (!this.progression.campaign.completedLevelIds.includes(levelId)) {
          this.progression.campaign.completedLevelIds.push(levelId);
          this.progression.statistics.totalCompletedLevels =
            this.progression.campaign.completedLevelIds.length;
          changed = true;
        }

        if (!this.progression.campaign.prologueCompleted) {
          this.progression.campaign.prologueCompleted = true;
          changed = true;
        }

        this.progression.campaign.lastCompletedAt = event.timestamp;
        changed = true;
        break;
      }
      case "speedrun.completed": {
        const valid = event.payload?.valid !== false;
        const levelId = readPayloadString(event, "levelId") ?? PROLOGUE_COMPLETION_LEVEL_ID;
        const completionTime = readPayloadNumber(event, "completionTimeMs");

        // `speedrun.completed` is published for every authored level so that
        // statistics can aggregate runs. Only the Prologue may advance campaign
        // progression: another level's valid run must not complete the Prologue,
        // join `completedLevelIds`, or overwrite `prologueBestCompletionTime`.
        if (valid && levelId === PROLOGUE_COMPLETION_LEVEL_ID) {
          if (!this.progression.campaign.completedLevelIds.includes(levelId)) {
            this.progression.campaign.completedLevelIds.push(levelId);
            this.progression.statistics.totalCompletedLevels =
              this.progression.campaign.completedLevelIds.length;
            changed = true;
          }

          if (!this.progression.campaign.prologueCompleted) {
            this.progression.campaign.prologueCompleted = true;
            changed = true;
          }

          if (completionTime !== null && completionTime >= 0) {
            const best = this.progression.campaign.prologueBestCompletionTime;

            if (best === undefined || completionTime < best) {
              this.progression.campaign.prologueBestCompletionTime = completionTime;
              changed = true;
            }
          }

          this.progression.campaign.lastCompletedAt = event.timestamp;
          changed = true;
        }

        break;
      }
      case "achievement.unlocked": {
        const achievementId = readPayloadString(event, "achievementId");

        if (achievementId && !this.progression.consumedAchievementIds.includes(achievementId)) {
          this.progression.consumedAchievementIds.push(achievementId);
          changed = true;
        }

        break;
      }
      case "session.started": {
        if (this.progression.statistics.firstSessionAt === undefined) {
          this.progression.statistics.firstSessionAt = event.timestamp;
          changed = true;
        }

        this.progression.statistics.lastPlayedAt = event.timestamp;
        changed = true;
        break;
      }
      case "session.completed":
      case "session.abandoned": {
        const durationSeconds = readPayloadNumber(event, "durationSeconds");

        if (durationSeconds !== null && durationSeconds >= 0) {
          this.progression.statistics.totalPlayTimeSeconds += durationSeconds;
          changed = true;
        }

        this.progression.statistics.lastPlayedAt = event.timestamp;
        changed = true;
        break;
      }
      default:
        break;
    }

    if (!changed) {
      return false;
    }

    this.progression.updatedAt = event.timestamp;
    this.progression.revision += 1;

    if (this.evaluateMilestones(event.eventId, event.type, event.timestamp)) {
      changed = true;
    }

    this.evaluateUnlocks(event.eventId, event.type, event.timestamp);
    this.schedulePersistence();

    return changed;
  }

  async flushPersistence(): Promise<void> {
    await this.saveChain;
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  private reconcileUnlocks(): void {
    this.evaluateUnlocks("init", "progression.init", this.progression.updatedAt, false);
  }

  private reconcileMilestones(): void {
    this.evaluateMilestones("init", "progression.init", this.progression.updatedAt, false);
  }

  private evaluateUnlocks(
    sourceEventId: string,
    sourceType: string,
    timestamp: number,
    emit = true,
  ): void {
    for (const content of this.contents) {
      if (this.progression.unlocks.unlockedContentIds.includes(content.id)) {
        continue;
      }

      const unlocked =
        content.initiallyUnlocked ||
        this.evaluateConditions(content.unlockRule.operator, content.unlockRule.conditions);

      if (!unlocked) {
        continue;
      }

      this.progression.unlocks.unlockedContentIds.push(content.id);
      this.progression.unlocks.unlockedAt[content.id] = timestamp;
      this.progression.revision += 1;
      void sourceEventId;
      void sourceType;

      if (emit) {
        this.emit({ type: "content-unlocked", contentId: content.id });
      }
    }
  }

  private evaluateMilestones(
    sourceEventId: string,
    sourceType: string,
    timestamp: number,
    emit = true,
  ): boolean {
    let changed = false;

    for (const definition of this.milestones) {
      if (this.hasMilestone(definition.id)) {
        continue;
      }

      if (!this.evaluateConditions(definition.operator, definition.conditions)) {
        continue;
      }

      this.progression.milestones.push({
        id: definition.id,
        achievedAt: timestamp,
        sourceEventId,
        sourceType,
      });
      this.progression.revision += 1;
      changed = true;

      if (emit) {
        this.emit({ type: "milestone-reached", milestoneId: definition.id });
      }
    }

    return changed;
  }

  private evaluateConditions(
    operator: "all" | "any",
    conditions: readonly ProgressionCondition[],
  ): boolean {
    if (conditions.length === 0) {
      return true;
    }

    const results = conditions.map((condition) => this.evaluateCondition(condition));

    return operator === "all" ? results.every(Boolean) : results.some(Boolean);
  }

  private evaluateCondition(condition: ProgressionCondition): boolean {
    switch (condition.type) {
      case "exercise_completed":
        return this.progression.training.completedExerciseIds.includes(condition.exerciseId);
      case "exercise_mastered":
        return this.progression.training.masteredExerciseIds.includes(condition.exerciseId);
      case "level_completed":
        return this.progression.campaign.completedLevelIds.includes(condition.levelId);
      case "achievement_unlocked":
        return this.progression.consumedAchievementIds.includes(condition.achievementId);
      case "milestone_reached":
        return this.hasMilestone(condition.milestoneId);
      case "prologue_completed":
        return this.progression.campaign.prologueCompleted;
      case "count_threshold":
        if (condition.source === "training_exercises") {
          return this.progression.statistics.totalCompletedExercises >= condition.minimum;
        }

        if (condition.source === "completed_levels") {
          return this.progression.statistics.totalCompletedLevels >= condition.minimum;
        }

        return this.progression.statistics.totalPlayTimeSeconds >= condition.minimum;
      default:
        return false;
    }
  }

  private sanitizeProgression(raw: PlayerProgression): PlayerProgression {
    const fallback = createEmptyProgression(this.clock());

    return {
      schemaVersion: SCHEMA_VERSION,
      revision: Number.isFinite(raw.revision) ? raw.revision : 0,
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : fallback.createdAt,
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : fallback.updatedAt,
      training: {
        completedExerciseIds: [...(raw.training?.completedExerciseIds ?? [])],
        masteredExerciseIds: [...(raw.training?.masteredExerciseIds ?? [])],
        ...(raw.training?.completedAt === undefined
          ? {}
          : { completedAt: raw.training.completedAt }),
      },
      campaign: {
        completedLevelIds: [...(raw.campaign?.completedLevelIds ?? [])],
        prologueCompleted: raw.campaign?.prologueCompleted === true,
        ...(raw.campaign?.prologueBestCompletionTime === undefined
          ? {}
          : { prologueBestCompletionTime: raw.campaign.prologueBestCompletionTime }),
        ...(raw.campaign?.lastCompletedAt === undefined
          ? {}
          : { lastCompletedAt: raw.campaign.lastCompletedAt }),
      },
      unlocks: {
        unlockedContentIds: [...(raw.unlocks?.unlockedContentIds ?? [])],
        unlockedAt: { ...(raw.unlocks?.unlockedAt ?? {}) },
      },
      milestones: (raw.milestones ?? []).map((milestone) => ({ ...milestone })),
      statistics: {
        totalCompletedExercises: this.sanitizeNumber(raw.statistics?.totalCompletedExercises),
        totalMasteredExercises: this.sanitizeNumber(raw.statistics?.totalMasteredExercises),
        totalCompletedLevels: this.sanitizeNumber(raw.statistics?.totalCompletedLevels),
        totalPlayTimeSeconds: this.sanitizeNumber(raw.statistics?.totalPlayTimeSeconds),
        ...(raw.statistics?.firstSessionAt === undefined
          ? {}
          : { firstSessionAt: raw.statistics.firstSessionAt }),
        ...(raw.statistics?.lastPlayedAt === undefined
          ? {}
          : { lastPlayedAt: raw.statistics.lastPlayedAt }),
      },
      consumedAchievementIds: [...(raw.consumedAchievementIds ?? [])],
    };
  }

  private sanitizeNumber(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
  }

  private schedulePersistence(): void {
    if (!this.persistence) {
      return;
    }

    const payload: PersistedProgression = {
      schemaVersion: SCHEMA_VERSION,
      progression: this.getProgression(),
      processedEventIds: [...this.processedEventIds].slice(-MAX_PROCESSED_EVENT_IDS),
      updatedAt: this.clock(),
    };

    this.saveChain = this.saveChain
      .then(() => this.persistence?.save(payload))
      .catch((error: unknown) => {
        console.warn("[Glassline] Progression persistence failed.", error);
      });
  }

  private trimProcessedEventIds(): void {
    if (this.processedEventIds.size <= MAX_PROCESSED_EVENT_IDS * 2) {
      return;
    }

    const kept = [...this.processedEventIds].slice(-MAX_PROCESSED_EVENT_IDS);

    this.processedEventIds.clear();

    for (const eventId of kept) {
      this.processedEventIds.add(eventId);
    }
  }

  private emit(event: Parameters<ProgressionListener>[0]): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error("[Glassline] A progression listener failed.", error);
      }
    }
  }
}
