import type { Disposable } from "../core/Disposable";
import type { DomainEvent } from "../events/DomainEvent";
import { readPayloadNumber, readPayloadString } from "../events/DomainEvent";
import type {
  AchievementCondition,
  AchievementDefinition,
  AchievementListener,
  AchievementPersistence,
  AchievementRecord,
  AchievementSnapshot,
  AchievementSystemOptions,
  AchievementUnlockedEvent,
  PersistedAchievements,
} from "./AchievementTypes";

const SCHEMA_VERSION = 1;
const MAX_PROCESSED_EVENT_IDS = 500;

function createRecord(achievementId: string, timestamp: number): AchievementRecord {
  return {
    achievementId,
    unlocked: false,
    conditionProgress: {},
    completedConditionIds: [],
    updatedAt: timestamp,
  };
}

/**
 * Evaluates declarative achievements from validated domain events (`docs/29`).
 *
 * Definitions, evaluation, progress, and unlock state are owned here. Progression
 * consumes unlock events but does not duplicate achievement state.
 */
export class AchievementSystem implements Disposable {
  private readonly definitions: readonly AchievementDefinition[];
  private readonly definitionById = new Map<string, AchievementDefinition>();
  private readonly clock: () => number;
  private readonly persistence: AchievementPersistence | null;
  private readonly listeners = new Set<AchievementListener>();
  private readonly processedEventIds = new Set<string>();

  private readonly records = new Map<string, AchievementRecord>();
  private saveChain: Promise<void> = Promise.resolve();

  constructor(options: AchievementSystemOptions) {
    this.definitions = [...options.definitions];
    this.clock = options.clock ?? (() => Date.now());
    this.persistence = options.persistence ?? null;

    for (const definition of this.definitions) {
      if (this.definitionById.has(definition.id)) {
        throw new Error(`Duplicate achievement definition "${definition.id}".`);
      }

      this.definitionById.set(definition.id, definition);
      this.records.set(definition.id, createRecord(definition.id, this.clock()));
    }

    this.validateDefinitions();
  }

  async initialize(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    try {
      const loaded = await this.persistence.load();

      if (!loaded) {
        return;
      }

      for (const record of loaded.records) {
        if (!this.definitionById.has(record.achievementId)) {
          continue;
        }

        this.records.set(record.achievementId, {
          achievementId: record.achievementId,
          unlocked: record.unlocked,
          ...(record.unlockedAt === undefined ? {} : { unlockedAt: record.unlockedAt }),
          conditionProgress: { ...record.conditionProgress },
          completedConditionIds: [...record.completedConditionIds],
          updatedAt: record.updatedAt,
        });
      }

      for (const eventId of loaded.processedEventIds) {
        this.processedEventIds.add(eventId);
      }
    } catch (error) {
      console.warn("[Glassline] Achievements could not be restored; starting fresh.", error);
    }
  }

  getSnapshot(): readonly AchievementSnapshot[] {
    return this.definitions.map((definition) => this.createSnapshot(definition));
  }

  getUnlockedCount(): number {
    let count = 0;

    for (const record of this.records.values()) {
      if (record.unlocked) {
        count += 1;
      }
    }

    return count;
  }

  isUnlocked(achievementId: string): boolean {
    return this.records.get(achievementId)?.unlocked ?? false;
  }

  getRecord(achievementId: string): AchievementRecord | null {
    const record = this.records.get(achievementId);

    return record ? { ...record, conditionProgress: { ...record.conditionProgress } } : null;
  }

  getRecentlyUnlocked(limit = 5): AchievementSnapshot[] {
    return this.getSnapshot()
      .filter((snapshot) => snapshot.unlocked && snapshot.unlockedAt !== undefined)
      .sort((left, right) => (right.unlockedAt ?? 0) - (left.unlockedAt ?? 0))
      .slice(0, limit);
  }

  subscribe(listener: AchievementListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Processes one authoritative event and returns definitions unlocked by it. */
  recordEvent(event: DomainEvent): AchievementDefinition[] {
    const unlocked: AchievementDefinition[] = [];

    if (this.processedEventIds.has(event.eventId)) {
      return unlocked;
    }

    this.processedEventIds.add(event.eventId);
    this.trimProcessedEventIds();

    let changed = false;

    for (const definition of this.definitions) {
      if (!definition.enabled) {
        continue;
      }

      const record = this.records.get(definition.id);

      if (!record || record.unlocked) {
        continue;
      }

      if (this.applyEventToRecord(definition, record, event)) {
        changed = true;
      }

      if (this.areConditionsSatisfied(definition, record)) {
        record.unlocked = true;
        record.unlockedAt = this.clock();
        record.updatedAt = record.unlockedAt;
        changed = true;

        const unlockEvent: AchievementUnlockedEvent = {
          achievementId: definition.id,
          unlockedAt: record.unlockedAt,
          definition,
        };

        this.emit(unlockEvent);
        unlocked.push(definition);
      }
    }

    if (changed || unlocked.length > 0) {
      this.schedulePersistence();
    }

    return unlocked;
  }

  async flushPersistence(): Promise<void> {
    await this.saveChain;
  }

  dispose(): void {
    this.listeners.clear();
  }

  private validateDefinitions(): void {
    for (const definition of this.definitions) {
      for (const prerequisiteId of definition.prerequisites) {
        if (!this.definitionById.has(prerequisiteId)) {
          throw new Error(
            `Achievement "${definition.id}" references unknown prerequisite "${prerequisiteId}".`,
          );
        }
      }

      const conditionIds = new Set<string>();

      for (const group of definition.groups) {
        for (const condition of group.conditions) {
          if (conditionIds.has(condition.id)) {
            throw new Error(
              `Achievement "${definition.id}" has duplicate condition id "${condition.id}".`,
            );
          }

          conditionIds.add(condition.id);
        }
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (achievementId: string): void => {
      if (visited.has(achievementId)) {
        return;
      }

      if (visiting.has(achievementId)) {
        throw new Error(`Achievement prerequisite cycle involving "${achievementId}".`);
      }

      visiting.add(achievementId);

      const definition = this.definitionById.get(achievementId);

      for (const prerequisiteId of definition?.prerequisites ?? []) {
        visit(prerequisiteId);
      }

      visiting.delete(achievementId);
      visited.add(achievementId);
    };

    for (const definition of this.definitions) {
      visit(definition.id);
    }
  }

  private applyEventToRecord(
    definition: AchievementDefinition,
    record: AchievementRecord,
    event: DomainEvent,
  ): boolean {
    let changed = false;

    for (const group of definition.groups) {
      for (const condition of group.conditions) {
        if (record.completedConditionIds.includes(condition.id)) {
          continue;
        }

        if (this.applyEventToCondition(condition, record, event)) {
          changed = true;
        }
      }
    }

    if (changed) {
      record.updatedAt = this.clock();
    }

    return changed;
  }

  private applyEventToCondition(
    condition: AchievementCondition,
    record: AchievementRecord,
    event: DomainEvent,
  ): boolean {
    if (condition.type === "achievement") {
      if (condition.referenceId && this.isUnlocked(condition.referenceId)) {
        return this.completeCondition(record, condition.id);
      }

      return false;
    }

    if (condition.type === "milestone") {
      if (
        event.type === "milestone.reached" &&
        condition.referenceId !== undefined &&
        readPayloadString(event, "milestoneId") === condition.referenceId
      ) {
        return this.completeCondition(record, condition.id);
      }

      return false;
    }

    if (condition.source !== undefined && condition.source !== event.source) {
      return false;
    }

    if (condition.eventType !== undefined && condition.eventType !== event.type) {
      return false;
    }

    if (condition.type === "event") {
      return this.completeCondition(record, condition.id);
    }

    if (condition.type === "threshold") {
      const value = readPayloadNumber(event);

      if (value !== null && value >= (condition.targetValue ?? 1)) {
        return this.completeCondition(record, condition.id);
      }

      return false;
    }

    if (condition.type === "counter") {
      const target = condition.targetValue ?? 1;
      const current = record.conditionProgress[condition.id] ?? 0;
      const next = Math.min(target, current + 1);

      record.conditionProgress[condition.id] = next;

      if (next >= target) {
        return this.completeCondition(record, condition.id);
      }

      return true;
    }

    return false;
  }

  private completeCondition(record: AchievementRecord, conditionId: string): boolean {
    if (!record.completedConditionIds.includes(conditionId)) {
      record.completedConditionIds.push(conditionId);

      return true;
    }

    return false;
  }

  private areConditionsSatisfied(
    definition: AchievementDefinition,
    record: AchievementRecord,
  ): boolean {
    for (const prerequisiteId of definition.prerequisites) {
      if (!this.isUnlocked(prerequisiteId)) {
        return false;
      }
    }

    for (const group of definition.groups) {
      const results = group.conditions.map((condition) =>
        this.isConditionSatisfied(condition, record),
      );

      if (group.operator === "all" && !results.every(Boolean)) {
        return false;
      }

      if (group.operator === "any" && !results.some(Boolean)) {
        return false;
      }
    }

    return true;
  }

  private isConditionSatisfied(
    condition: AchievementCondition,
    record: AchievementRecord,
  ): boolean {
    if (record.completedConditionIds.includes(condition.id)) {
      return true;
    }

    if (condition.type === "achievement" && condition.referenceId) {
      return this.isUnlocked(condition.referenceId);
    }

    if (condition.type === "counter") {
      return (record.conditionProgress[condition.id] ?? 0) >= (condition.targetValue ?? 1);
    }

    return false;
  }

  private createSnapshot(definition: AchievementDefinition): AchievementSnapshot {
    const record = this.records.get(definition.id) ?? createRecord(definition.id, this.clock());
    const totalConditions = definition.groups.reduce(
      (total, group) => total + group.conditions.length,
      0,
    );
    const progress =
      totalConditions === 0 ? 0 : record.completedConditionIds.length / totalConditions;

    return {
      id: definition.id,
      category: definition.category,
      titleKey: definition.titleKey,
      descriptionKey: definition.descriptionKey,
      iconId: definition.iconId,
      rarity: definition.rarity,
      hidden: definition.hidden,
      unlocked: record.unlocked,
      ...(record.unlockedAt === undefined ? {} : { unlockedAt: record.unlockedAt }),
      progress: Math.min(1, Math.max(0, progress)),
    };
  }

  private schedulePersistence(): void {
    if (!this.persistence) {
      return;
    }

    const payload: PersistedAchievements = {
      schemaVersion: SCHEMA_VERSION,
      records: [...this.records.values()].map((record) => ({
        ...record,
        conditionProgress: { ...record.conditionProgress },
        completedConditionIds: [...record.completedConditionIds],
      })),
      processedEventIds: [...this.processedEventIds].slice(-MAX_PROCESSED_EVENT_IDS),
      updatedAt: this.clock(),
    };

    this.saveChain = this.saveChain
      .then(() => this.persistence?.save(payload))
      .catch((error: unknown) => {
        console.warn("[Glassline] Achievement persistence failed.", error);
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

  private emit(event: AchievementUnlockedEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error("[Glassline] An achievement listener failed.", error);
      }
    }
  }
}
