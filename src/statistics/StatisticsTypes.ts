import type { DomainEvent } from "../events/DomainEvent";

export type StatisticCategory =
  | "general"
  | "movement"
  | "training"
  | "speedrun"
  | "interaction"
  | "exploration"
  | "progression";

export type StatisticAggregation = "sum" | "maximum" | "minimum" | "latest" | "count";

export type StatisticUnit = "count" | "meters" | "seconds" | "milliseconds" | "meters-per-second";

export interface StatisticDefinition {
  readonly id: string;
  readonly category: StatisticCategory;
  readonly valueType: "integer" | "float" | "duration";
  readonly aggregation: StatisticAggregation;
  readonly source: string;
  readonly eventTypes: readonly string[];
  readonly unit?: StatisticUnit;
  readonly persistent: boolean;
  readonly visible: boolean;
}

export interface LifetimeStatistics {
  readonly totalPlayTimeSeconds: number;
  readonly totalSessions: number;
  readonly completedSessions: number;
  readonly values: Readonly<Record<string, number>>;
  readonly updatedAt: number;
}

export interface ModeStatistics {
  readonly mode: "training" | "prologue" | "speedrun";
  readonly sessionCount: number;
  readonly completedSessionCount: number;
  readonly totalDurationSeconds: number;
  readonly values: Readonly<Record<string, number>>;
  readonly updatedAt: number;
}

export interface SessionStatistics {
  readonly sessionId: string;
  readonly mode: "training" | "prologue" | "speedrun";
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly durationSeconds: number;
  readonly completed: boolean;
  readonly values: Readonly<Record<string, number>>;
}

export interface SessionSummary {
  readonly sessionId: string;
  readonly mode: "training" | "prologue" | "speedrun";
  readonly startedAt: number;
  readonly endedAt: number;
  readonly durationSeconds: number;
  readonly completed: boolean;
  readonly values: Readonly<Record<string, number>>;
}

export interface StatisticsSnapshot {
  readonly revision: number;
  readonly lifetime: LifetimeStatistics;
  readonly modes: Readonly<Partial<Record<"training" | "prologue" | "speedrun", ModeStatistics>>>;
  readonly currentSession: SessionStatistics | null;
  readonly recentSessions: readonly SessionSummary[];
}

export interface PersistedStatistics {
  readonly schemaVersion: number;
  readonly revision: number;
  readonly lifetime: LifetimeStatistics;
  readonly modes: Readonly<Partial<Record<"training" | "prologue" | "speedrun", ModeStatistics>>>;
  readonly recentSessions: readonly SessionSummary[];
  readonly processedEventIds: readonly string[];
  readonly updatedAt: number;
}

export interface StatisticsPersistence {
  load(): Promise<PersistedStatistics | null>;
  save(data: PersistedStatistics): Promise<void>;
}

export interface StatisticsSystemOptions {
  readonly definitions: readonly StatisticDefinition[];
  readonly clock?: () => number;
  readonly persistence?: StatisticsPersistence | null;
}

export type StatisticsEvent = DomainEvent;

export type StatisticsListener = (
  event:
    | { readonly type: "session:started"; readonly sessionId: string }
    | { readonly type: "session:finalized"; readonly summary: SessionSummary },
) => void;
