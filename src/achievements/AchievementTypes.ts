import type { DomainEvent } from "../events/DomainEvent";

export type AchievementCategory =
  | "general"
  | "movement"
  | "training"
  | "speedrun"
  | "exploration"
  | "interaction"
  | "progression";

export type AchievementRarity = "common" | "uncommon" | "rare" | "exceptional";

export type AchievementConditionType =
  | "event"
  | "counter"
  | "threshold"
  | "milestone"
  | "achievement";

export interface AchievementCondition {
  readonly id: string;
  readonly type: AchievementConditionType;
  readonly source?: string;
  readonly eventType?: string;
  readonly targetValue?: number;
  readonly referenceId?: string;
}

export interface AchievementConditionGroup {
  readonly id: string;
  readonly operator: "all" | "any";
  readonly conditions: readonly AchievementCondition[];
}

export interface AchievementDefinition {
  readonly id: string;
  readonly category: AchievementCategory;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly iconId: string;
  readonly rarity: AchievementRarity;
  readonly hidden: boolean;
  readonly enabled: boolean;
  readonly prerequisites: readonly string[];
  readonly groups: readonly AchievementConditionGroup[];
}

export interface AchievementRecord {
  achievementId: string;
  unlocked: boolean;
  unlockedAt?: number;
  conditionProgress: Record<string, number>;
  completedConditionIds: string[];
  updatedAt: number;
}

export interface AchievementSnapshot {
  readonly id: string;
  readonly category: AchievementCategory;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly iconId: string;
  readonly rarity: AchievementRarity;
  readonly hidden: boolean;
  readonly unlocked: boolean;
  readonly unlockedAt?: number;
  readonly progress: number;
}

export interface PersistedAchievements {
  readonly schemaVersion: number;
  readonly records: readonly AchievementRecord[];
  readonly processedEventIds: readonly string[];
  readonly updatedAt: number;
}

export interface AchievementPersistence {
  load(): Promise<PersistedAchievements | null>;
  save(data: PersistedAchievements): Promise<void>;
}

export interface AchievementSystemOptions {
  readonly definitions: readonly AchievementDefinition[];
  readonly clock?: () => number;
  readonly persistence?: AchievementPersistence | null;
}

export type AchievementEvent = DomainEvent;

export interface AchievementUnlockedEvent {
  readonly achievementId: string;
  readonly unlockedAt: number;
  readonly definition: AchievementDefinition;
}

export type AchievementListener = (event: AchievementUnlockedEvent) => void;
