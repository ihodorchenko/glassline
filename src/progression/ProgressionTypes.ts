export type ProgressionContentType =
  | "training_section"
  | "training_exercise"
  | "level"
  | "game_mode"
  | "challenge";

export type ProgressionRuleOperator = "all" | "any";

export type ProgressionCondition =
  | { readonly type: "exercise_completed"; readonly exerciseId: string }
  | { readonly type: "exercise_mastered"; readonly exerciseId: string }
  | { readonly type: "level_completed"; readonly levelId: string }
  | { readonly type: "achievement_unlocked"; readonly achievementId: string }
  | { readonly type: "milestone_reached"; readonly milestoneId: string }
  | {
      readonly type: "count_threshold";
      readonly source: "training_exercises" | "completed_levels" | "play_time_seconds";
      readonly minimum: number;
    }
  | { readonly type: "prologue_completed" };

export interface ProgressionUnlockRule {
  readonly id: string;
  readonly operator: ProgressionRuleOperator;
  readonly conditions: readonly ProgressionCondition[];
}

export interface ProgressionContentDefinition {
  readonly id: string;
  readonly type: ProgressionContentType;
  readonly titleKey: string;
  readonly descriptionKey?: string;
  readonly initiallyUnlocked: boolean;
  readonly unlockRule: ProgressionUnlockRule;
}

export interface ProgressionMilestoneDefinition {
  readonly id: string;
  readonly titleKey: string;
  readonly operator: ProgressionRuleOperator;
  readonly conditions: readonly ProgressionCondition[];
}

export interface ProgressionMilestone {
  readonly id: string;
  readonly achievedAt: number;
  readonly sourceEventId: string;
  readonly sourceType: string;
}

export interface TrainingProgression {
  completedExerciseIds: string[];
  masteredExerciseIds: string[];
  completedAt?: number;
}

export interface CampaignProgression {
  completedLevelIds: string[];
  prologueCompleted: boolean;
  prologueBestCompletionTime?: number;
  lastCompletedAt?: number;
}

export interface ContentUnlockProgression {
  unlockedContentIds: string[];
  unlockedAt: Record<string, number>;
}

export interface ProgressionStatistics {
  totalCompletedExercises: number;
  totalMasteredExercises: number;
  totalCompletedLevels: number;
  totalPlayTimeSeconds: number;
  firstSessionAt?: number;
  lastPlayedAt?: number;
}

export interface PlayerProgression {
  schemaVersion: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
  training: TrainingProgression;
  campaign: CampaignProgression;
  unlocks: ContentUnlockProgression;
  milestones: ProgressionMilestone[];
  statistics: ProgressionStatistics;
  /** Achievement unlock inputs consumed from the Achievement System. */
  consumedAchievementIds: string[];
}

export interface PersistedProgression {
  readonly schemaVersion: number;
  readonly progression: PlayerProgression;
  readonly processedEventIds: readonly string[];
  readonly updatedAt: number;
}

export interface ProgressionPersistence {
  load(): Promise<PersistedProgression | null>;
  save(data: PersistedProgression): Promise<void>;
}

export interface ProgressionSnapshot {
  readonly revision: number;
  readonly trainingCompleted: number;
  readonly trainingMastered: number;
  readonly prologueCompleted: boolean;
  readonly prologueBestCompletionTime: number | null;
  readonly milestones: readonly ProgressionMilestone[];
  readonly unlockedContentIds: readonly string[];
  readonly statistics: Readonly<ProgressionStatistics>;
}

export interface ProgressionUnlockEvent {
  readonly contentId: string;
  readonly unlockedAt: number;
}

export interface ProgressionMilestoneEvent {
  readonly milestoneId: string;
  readonly achievedAt: number;
}

export interface ProgressionSystemOptions {
  readonly contents: readonly ProgressionContentDefinition[];
  readonly milestones: readonly ProgressionMilestoneDefinition[];
  readonly clock?: () => number;
  readonly persistence?: ProgressionPersistence | null;
}

export type ProgressionListener = (
  event:
    | { readonly type: "content-unlocked"; readonly contentId: string }
    | { readonly type: "milestone-reached"; readonly milestoneId: string },
) => void;
