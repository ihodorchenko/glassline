import type { Disposable } from "../core/Disposable";
import type { DomainEvent } from "../events/DomainEvent";
import { readPayloadNumber } from "../events/DomainEvent";
import type {
  LifetimeStatistics,
  ModeStatistics,
  PersistedStatistics,
  SessionStatistics,
  SessionSummary,
  StatisticDefinition,
  StatisticsListener,
  StatisticsPersistence,
  StatisticsSnapshot,
  StatisticsSystemOptions,
} from "./StatisticsTypes";

const SCHEMA_VERSION = 1;
const MAX_RECENT_SESSIONS = 20;
const MAX_PROCESSED_EVENT_IDS = 500;

type GameplayMode = "training" | "prologue" | "speedrun";

interface MutableLifetime {
  totalPlayTimeSeconds: number;
  totalSessions: number;
  completedSessions: number;
  values: Record<string, number>;
  updatedAt: number;
}

interface MutableMode {
  mode: GameplayMode;
  sessionCount: number;
  completedSessionCount: number;
  totalDurationSeconds: number;
  values: Record<string, number>;
  updatedAt: number;
}

interface MutableSession {
  sessionId: string;
  mode: GameplayMode;
  startedAt: number;
  values: Record<string, number>;
}

function finiteOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

function applyAggregation(
  values: Record<string, number>,
  definition: StatisticDefinition,
  value: number,
): void {
  const current = values[definition.id] ?? 0;

  switch (definition.aggregation) {
    case "sum":
      values[definition.id] = current + value;
      break;
    case "count":
      values[definition.id] = current + 1;
      break;
    case "maximum":
      values[definition.id] = Math.max(current, value);
      break;
    case "minimum":
      values[definition.id] =
        values[definition.id] === undefined ? value : Math.min(current, value);
      break;
    case "latest":
      values[definition.id] = value;
      break;
  }
}

/**
 * Aggregates validated gameplay events into session, mode, and lifetime scopes
 * (`docs/30`).
 *
 * It consumes domain events; it does not detect gameplay, calculate speedrun
 * timing, or own achievements/progression.
 */
export class StatisticsSystem implements Disposable {
  private readonly definitions: readonly StatisticDefinition[];
  private readonly definitionIds = new Set<string>();
  private readonly clock: () => number;
  private readonly persistence: StatisticsPersistence | null;
  private readonly listeners = new Set<StatisticsListener>();
  private readonly processedEventIds = new Set<string>();

  private lifetime: MutableLifetime = {
    totalPlayTimeSeconds: 0,
    totalSessions: 0,
    completedSessions: 0,
    values: {},
    updatedAt: 0,
  };
  private modes = new Map<GameplayMode, MutableMode>();
  private recentSessions: SessionSummary[] = [];
  private currentSession: MutableSession | null = null;
  private revision = 0;
  private saveChain: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(options: StatisticsSystemOptions) {
    this.definitions = [...options.definitions];
    this.clock = options.clock ?? (() => Date.now());
    this.persistence = options.persistence ?? null;

    for (const definition of this.definitions) {
      if (this.definitionIds.has(definition.id)) {
        throw new Error(`Duplicate statistic definition "${definition.id}".`);
      }

      this.definitionIds.add(definition.id);
    }
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

      this.revision = Number.isFinite(loaded.revision) ? loaded.revision : 0;
      this.lifetime = {
        totalPlayTimeSeconds: this.sanitizeNumber(loaded.lifetime.totalPlayTimeSeconds),
        totalSessions: this.sanitizeNumber(loaded.lifetime.totalSessions),
        completedSessions: this.sanitizeNumber(loaded.lifetime.completedSessions),
        values: this.sanitizeValues(loaded.lifetime.values),
        updatedAt: this.sanitizeNumber(loaded.lifetime.updatedAt),
      };

      for (const [mode, modeStatistics] of Object.entries(loaded.modes)) {
        if (mode === "training" || mode === "prologue" || mode === "speedrun") {
          this.modes.set(mode, {
            mode,
            sessionCount: this.sanitizeNumber(modeStatistics.sessionCount),
            completedSessionCount: this.sanitizeNumber(modeStatistics.completedSessionCount),
            totalDurationSeconds: this.sanitizeNumber(modeStatistics.totalDurationSeconds),
            values: this.sanitizeValues(modeStatistics.values),
            updatedAt: this.sanitizeNumber(modeStatistics.updatedAt),
          });
        }
      }

      this.recentSessions = [...loaded.recentSessions].slice(-MAX_RECENT_SESSIONS);

      for (const eventId of loaded.processedEventIds) {
        this.processedEventIds.add(eventId);
      }
    } catch (error) {
      console.warn("[Glassline] Statistics could not be restored; starting fresh.", error);
    }
  }

  getSnapshot(): StatisticsSnapshot {
    return {
      revision: this.revision,
      lifetime: this.copyLifetime(),
      modes: Object.fromEntries(
        [...this.modes.entries()].map(([mode, statistics]) => [mode, this.copyMode(statistics)]),
      ),
      currentSession: this.currentSession
        ? {
            sessionId: this.currentSession.sessionId,
            mode: this.currentSession.mode,
            startedAt: this.currentSession.startedAt,
            durationSeconds: Math.max(0, (this.clock() - this.currentSession.startedAt) / 1000),
            completed: false,
            values: { ...this.currentSession.values },
          }
        : null,
      recentSessions: [...this.recentSessions],
    };
  }

  getLifetime(): LifetimeStatistics {
    return this.copyLifetime();
  }

  getCurrentSession(): SessionStatistics | null {
    return this.getSnapshot().currentSession;
  }

  getValue(statisticId: string, scope: "session" | "lifetime" = "session"): number | null {
    if (scope === "session") {
      return this.currentSession?.values[statisticId] ?? null;
    }

    return this.lifetime.values[statisticId] ?? null;
  }

  subscribe(listener: StatisticsListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  startSession(options: {
    readonly sessionId: string;
    readonly mode: GameplayMode;
    readonly startedAt?: number;
  }): void {
    if (this.currentSession?.sessionId === options.sessionId) {
      return;
    }

    if (this.currentSession) {
      this.finalizeSession({ completed: false });
    }

    this.currentSession = {
      sessionId: options.sessionId,
      mode: options.mode,
      startedAt: options.startedAt ?? this.clock(),
      values: {},
    };
    this.emit({ type: "session:started", sessionId: options.sessionId });
  }

  /** Applies one validated event. Repeated event ids are ignored. */
  recordEvent(event: DomainEvent): boolean {
    if (this.disposed || this.processedEventIds.has(event.eventId)) {
      return false;
    }

    if (!this.currentSession) {
      return false;
    }

    if (event.sessionId !== undefined && event.sessionId !== this.currentSession.sessionId) {
      return false;
    }

    const payloadValue = readPayloadNumber(event, "value");
    const value = payloadValue === null ? 1 : finiteOrNull(payloadValue);

    if (value === null) {
      return false;
    }

    let changed = false;

    for (const definition of this.definitions) {
      if (definition.source !== event.source || !definition.eventTypes.includes(event.type)) {
        continue;
      }

      applyAggregation(this.currentSession.values, definition, value);

      if (definition.persistent) {
        applyAggregation(this.lifetime.values, definition, value);

        const mode =
          this.modes.get(this.currentSession.mode) ?? this.createMode(this.currentSession.mode);

        applyAggregation(mode.values, definition, value);
        mode.updatedAt = this.clock();
        this.modes.set(this.currentSession.mode, mode);
      }

      changed = true;
    }

    if (!changed) {
      return false;
    }

    this.processedEventIds.add(event.eventId);
    this.trimProcessedEventIds();
    this.revision += 1;
    this.lifetime.updatedAt = this.clock();
    this.schedulePersistence();

    return true;
  }

  finalizeSession(options: {
    readonly completed: boolean;
    readonly endedAt?: number;
  }): SessionSummary | null {
    const session = this.currentSession;

    if (!session) {
      return null;
    }

    this.currentSession = null;

    const endedAt = options.endedAt ?? this.clock();
    const durationSeconds = Math.max(0, (endedAt - session.startedAt) / 1000);
    const summary: SessionSummary = {
      sessionId: session.sessionId,
      mode: session.mode,
      startedAt: session.startedAt,
      endedAt,
      durationSeconds,
      completed: options.completed,
      values: { ...session.values },
    };

    this.lifetime.totalSessions += 1;
    this.lifetime.totalPlayTimeSeconds += durationSeconds;
    this.lifetime.updatedAt = endedAt;

    if (options.completed) {
      this.lifetime.completedSessions += 1;
    }

    this.lifetime.values["general.longest_session"] = Math.max(
      this.lifetime.values["general.longest_session"] ?? 0,
      durationSeconds,
    );

    const mode = this.modes.get(session.mode) ?? this.createMode(session.mode);

    mode.sessionCount += 1;
    mode.totalDurationSeconds += durationSeconds;
    mode.updatedAt = endedAt;

    if (options.completed) {
      mode.completedSessionCount += 1;
    }

    this.modes.set(session.mode, mode);
    this.recentSessions.push(summary);

    if (this.recentSessions.length > MAX_RECENT_SESSIONS) {
      this.recentSessions = this.recentSessions.slice(-MAX_RECENT_SESSIONS);
    }

    this.revision += 1;
    this.emit({ type: "session:finalized", summary });
    this.schedulePersistence();

    return summary;
  }

  async flushPersistence(): Promise<void> {
    await this.saveChain;
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  private createMode(mode: GameplayMode): MutableMode {
    return {
      mode,
      sessionCount: 0,
      completedSessionCount: 0,
      totalDurationSeconds: 0,
      values: {},
      updatedAt: 0,
    };
  }

  private schedulePersistence(): void {
    if (!this.persistence) {
      return;
    }

    const payload = this.createPersistedPayload();

    this.saveChain = this.saveChain
      .then(() => this.persistence?.save(payload))
      .catch((error: unknown) => {
        console.warn("[Glassline] Statistics persistence failed.", error);
      });
  }

  private createPersistedPayload(): PersistedStatistics {
    return {
      schemaVersion: SCHEMA_VERSION,
      revision: this.revision,
      lifetime: this.copyLifetime(),
      modes: Object.fromEntries(
        [...this.modes.entries()].map(([mode, statistics]) => [mode, this.copyMode(statistics)]),
      ),
      recentSessions: [...this.recentSessions],
      processedEventIds: [...this.processedEventIds].slice(-MAX_PROCESSED_EVENT_IDS),
      updatedAt: this.clock(),
    };
  }

  private copyLifetime(): LifetimeStatistics {
    return {
      totalPlayTimeSeconds: this.lifetime.totalPlayTimeSeconds,
      totalSessions: this.lifetime.totalSessions,
      completedSessions: this.lifetime.completedSessions,
      values: { ...this.lifetime.values },
      updatedAt: this.lifetime.updatedAt,
    };
  }

  private copyMode(mode: MutableMode): ModeStatistics {
    return {
      mode: mode.mode,
      sessionCount: mode.sessionCount,
      completedSessionCount: mode.completedSessionCount,
      totalDurationSeconds: mode.totalDurationSeconds,
      values: { ...mode.values },
      updatedAt: mode.updatedAt,
    };
  }

  private sanitizeValues(values: unknown): Record<string, number> {
    const sanitized: Record<string, number> = {};

    if (typeof values !== "object" || values === null) {
      return sanitized;
    }

    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeNumber(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
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

  private emit(event: Parameters<StatisticsListener>[0]): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error("[Glassline] A statistics listener failed.", error);
      }
    }
  }
}
