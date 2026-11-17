import type { Disposable } from "../core/Disposable";
import { EventBus, type Unsubscribe } from "../core/EventBus";
import type { SpeedrunResult } from "../speedrun/SpeedrunSystem";
import type { TrainingSessionResult } from "../training/TrainingTypes";

export type GameplayMode = "training" | "prologue" | "speedrun";

export type GameplaySessionStatus =
  | "created"
  | "preparing"
  | "loading"
  | "initializing"
  | "ready"
  | "starting"
  | "running"
  | "paused"
  | "resuming"
  | "restarting"
  | "completing"
  | "completed"
  | "abandoning"
  | "abandoned"
  | "failed";

export interface GameplaySessionConfiguration {
  readonly levelId: string;
  readonly isRanked: boolean;
  readonly enableCheckpoints: boolean;
  readonly enableTimer: boolean;
  readonly enableGhostRecording: boolean;
  readonly startPointId?: string;
}

export interface GameplaySessionMetadata {
  readonly source:
    | "main_menu"
    | "training_menu"
    | "level_select"
    | "restart"
    | "recovery"
    | "system";
  readonly applicationVersion: string;
  readonly levelVersion: string;
  readonly createdBy: "player" | "system";
}

export interface GameplaySession {
  readonly id: string;
  readonly mode: GameplayMode;
  readonly levelId: string;
  readonly status: GameplaySessionStatus;
  readonly configuration: GameplaySessionConfiguration;
  readonly createdAt: number;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly metadata: GameplaySessionMetadata;
}

export interface GameplaySessionContext {
  readonly sessionId: string;
  readonly generation: number;
  readonly mode: GameplayMode;
  readonly levelId: string;
  readonly configuration: Readonly<GameplaySessionConfiguration>;
  readonly isCurrent: () => boolean;
}

export interface GameplaySessionExecution {
  readonly sessionId: string;
  readonly generation: number;
  readonly startedAt?: number;
  readonly status: GameplaySessionStatus;
}

export interface StartSessionRequest {
  readonly mode: GameplayMode;
  readonly levelId?: string;
  readonly isRanked?: boolean;
  readonly startPointId?: string;
  readonly source?: GameplaySessionMetadata["source"];
}

export interface SessionCompletionRequest {
  readonly reason?: string;
}

export interface SessionResults {
  readonly sessionId: string;
  readonly mode: GameplayMode;
  readonly levelId: string;
  readonly status: "completed" | "abandoned" | "failed";
  readonly durationMs: number;
  readonly completedAt: number;
  readonly training?: TrainingSessionResult;
  readonly speedrun?: SpeedrunResult;
}

export type SessionPauseReason = "player" | "focus-loss" | "system" | "menu";
export type SessionAbandonReason = "player" | "return-to-menu" | "session-failure";

export interface GameplaySessionSnapshot {
  readonly session: GameplaySession | null;
  readonly execution: GameplaySessionExecution | null;
  readonly transitioning: boolean;
  readonly lastResults: SessionResults | null;
}

export interface LoadedLevelInfo {
  readonly levelVersion: string;
  readonly initialSpawnId: string;
}

/** Lifecycle adapters implemented by the composition root. */
export interface GameplaySessionPorts {
  loadLevel(context: GameplaySessionContext): Promise<LoadedLevelInfo>;
  startLevel(context: GameplaySessionContext): Promise<void>;
  unloadLevel(context: GameplaySessionContext): Promise<void>;
  prepareGameplay(context: GameplaySessionContext): Promise<void>;
  activateGameplay(context: GameplaySessionContext): Promise<void>;
  suspendGameplay(context: GameplaySessionContext, reason: SessionPauseReason): Promise<void>;
  resumeGameplay(context: GameplaySessionContext): Promise<void>;
  restartGameplay(context: GameplaySessionContext): Promise<void>;
  shutdownGameplay(context: GameplaySessionContext): Promise<void>;
  buildResults(context: GameplaySessionContext): SessionResults;
}

export interface SessionOperationResult {
  readonly success: boolean;
  readonly session: GameplaySession | null;
  readonly error?: string;
}

export interface GameplaySessionEventMap {
  [key: string]: unknown;
  "session:created": { readonly session: GameplaySession };
  "session:started": { readonly session: GameplaySession; readonly generation: number };
  "session:paused": { readonly sessionId: string; readonly reason: SessionPauseReason };
  "session:resumed": { readonly sessionId: string };
  "session:restarted": { readonly session: GameplaySession; readonly generation: number };
  "session:completed": {
    readonly session: GameplaySession;
    readonly results: SessionResults;
  };
  "session:abandoned": { readonly sessionId: string; readonly reason: SessionAbandonReason };
  "session:failed": { readonly sessionId: string; readonly error: string };
}

export interface GameplaySessionManagerOptions {
  readonly ports: GameplaySessionPorts;
  readonly clock?: () => number;
  readonly applicationVersion?: string;
}

interface MutableSession {
  id: string;
  mode: GameplayMode;
  levelId: string;
  status: GameplaySessionStatus;
  configuration: GameplaySessionConfiguration;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  metadata: GameplaySessionMetadata;
}

function copySession(session: MutableSession | null): GameplaySession | null {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    mode: session.mode,
    levelId: session.levelId,
    status: session.status,
    configuration: { ...session.configuration },
    createdAt: session.createdAt,
    ...(session.startedAt === undefined ? {} : { startedAt: session.startedAt }),
    ...(session.completedAt === undefined ? {} : { completedAt: session.completedAt }),
    metadata: { ...session.metadata },
  };
}

/**
 * Gameplay session lifecycle owner (`docs/19`).
 *
 * It coordinates loading, mode system activation, pause/resume, restart,
 * completion, and teardown through explicit ports. It does not own level
 * geometry, player physics, timer math, or results aggregation.
 */
export class GameplaySessionManager implements Disposable {
  private readonly ports: GameplaySessionPorts;
  private readonly clock: () => number;
  private readonly applicationVersion: string;
  private readonly events = new EventBus<GameplaySessionEventMap>();
  private readonly resultsCache = new Map<string, SessionResults>();

  private session: MutableSession | null = null;
  private generation = 0;
  private transitioning = false;
  private sessionCounter = 0;
  private lastResults: SessionResults | null = null;
  private disposed = false;

  constructor(options: GameplaySessionManagerOptions) {
    this.ports = options.ports;
    this.clock = options.clock ?? (() => Date.now());
    this.applicationVersion = options.applicationVersion ?? "0.1.0";
  }

  getActiveSession(): GameplaySession | null {
    return copySession(this.session);
  }

  getSnapshot(): GameplaySessionSnapshot {
    const session = this.session;

    return {
      session: copySession(session),
      execution:
        session === null
          ? null
          : {
              sessionId: session.id,
              generation: this.generation,
              ...(session.startedAt === undefined ? {} : { startedAt: session.startedAt }),
              status: session.status,
            },
      transitioning: this.transitioning,
      lastResults: this.lastResults,
    };
  }

  isRunning(): boolean {
    return this.session?.status === "running";
  }

  on<K extends keyof GameplaySessionEventMap>(
    event: K,
    listener: (payload: GameplaySessionEventMap[K]) => void,
  ): Unsubscribe {
    return this.events.on(event, listener);
  }

  async startSession(request: StartSessionRequest): Promise<SessionOperationResult> {
    if (this.transitioning) {
      return this.failure("Another session operation is in progress.");
    }

    if (
      this.session &&
      this.session.status !== "completed" &&
      this.session.status !== "abandoned" &&
      this.session.status !== "failed"
    ) {
      return this.failure(`Cannot start a new session while "${this.session.status}" is active.`);
    }

    const configuration = this.resolveConfiguration(request);

    if (!configuration) {
      return this.failure("Invalid session configuration.");
    }

    this.transitioning = true;

    try {
      const session: MutableSession = {
        id: `gameplay-session-${++this.sessionCounter}`,
        mode: request.mode,
        levelId: configuration.levelId,
        status: "created",
        configuration,
        createdAt: this.clock(),
        metadata: {
          source: request.source ?? "main_menu",
          applicationVersion: this.applicationVersion,
          levelVersion: "unknown",
          createdBy: "player",
        },
      };

      this.session = session;
      this.generation = 1;
      this.lastResults = null;

      this.setStatus("preparing");
      this.emit("session:created", { session: copySession(session) as GameplaySession });

      const context = this.createContext();
      this.setStatus("loading");

      const loaded = await this.ports.loadLevel(context);

      if (!context.isCurrent()) {
        return this.failure("Session was superseded while loading.");
      }

      session.metadata = {
        ...session.metadata,
        levelVersion: loaded.levelVersion,
      };
      session.configuration = {
        ...configuration,
        startPointId: configuration.startPointId ?? loaded.initialSpawnId,
      };

      this.setStatus("initializing");
      await this.ports.prepareGameplay(this.createContext());

      if (!this.isContextCurrent(context)) {
        return this.failure("Session was superseded during initialization.");
      }

      this.setStatus("ready");
      await this.ports.startLevel(this.createContext());
      this.setStatus("starting");

      await this.ports.activateGameplay(this.createContext());

      session.startedAt = this.clock();
      this.setStatus("running");
      this.emit("session:started", {
        session: copySession(session) as GameplaySession,
        generation: this.generation,
      });

      return { success: true, session: copySession(session) };
    } catch (error) {
      return await this.failStart(error);
    } finally {
      this.transitioning = false;
    }
  }

  async pauseSession(reason: SessionPauseReason): Promise<SessionOperationResult> {
    if (this.session?.status !== "running" || this.transitioning) {
      return this.failure("Cannot pause the current session.");
    }

    this.transitioning = true;

    try {
      await this.ports.suspendGameplay(this.createContext(), reason);
      this.setStatus("paused");
      this.emit("session:paused", {
        sessionId: this.session.id,
        reason,
      });

      return { success: true, session: this.getActiveSession() };
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    } finally {
      this.transitioning = false;
    }
  }

  async resumeSession(): Promise<SessionOperationResult> {
    if (this.session?.status !== "paused" || this.transitioning) {
      return this.failure("Cannot resume the current session.");
    }

    this.transitioning = true;

    try {
      this.setStatus("resuming");
      await this.ports.resumeGameplay(this.createContext());
      this.setStatus("running");
      this.emit("session:resumed", { sessionId: this.session.id });

      return { success: true, session: this.getActiveSession() };
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    } finally {
      this.transitioning = false;
    }
  }

  async restartSession(): Promise<SessionOperationResult> {
    if (
      !this.session ||
      this.transitioning ||
      (this.session.status !== "running" &&
        this.session.status !== "paused" &&
        this.session.status !== "completed")
    ) {
      return this.failure("Cannot restart the current session.");
    }

    this.transitioning = true;

    try {
      this.setStatus("restarting");
      this.generation += 1;
      await this.ports.restartGameplay(this.createContext());
      this.session.startedAt = this.clock();
      delete this.session.completedAt;
      this.setStatus("running");
      this.emit("session:restarted", {
        session: copySession(this.session) as GameplaySession,
        generation: this.generation,
      });

      return { success: true, session: this.getActiveSession() };
    } catch (error) {
      return await this.failStart(error);
    } finally {
      this.transitioning = false;
    }
  }

  async completeSession(request: SessionCompletionRequest = {}): Promise<SessionOperationResult> {
    if (
      !this.session ||
      this.transitioning ||
      (this.session.status !== "running" && this.session.status !== "paused")
    ) {
      return this.failure("Cannot complete the current session.");
    }

    this.transitioning = true;

    try {
      this.setStatus("completing");
      this.session.completedAt = this.clock();

      const results = this.ports.buildResults(this.createContext());
      const finalized: SessionResults = {
        ...results,
        durationMs:
          this.session.startedAt === undefined
            ? 0
            : Math.max(0, this.session.completedAt - this.session.startedAt),
        completedAt: this.session.completedAt,
      };

      this.lastResults = finalized;
      this.resultsCache.set(this.session.id, finalized);
      this.setStatus("completed");

      await this.ports.shutdownGameplay(this.createContext());

      this.emit("session:completed", {
        session: copySession(this.session) as GameplaySession,
        results: finalized,
      });

      void request;

      return { success: true, session: this.getActiveSession() };
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    } finally {
      this.transitioning = false;
    }
  }

  async abandonSession(reason: SessionAbandonReason): Promise<SessionOperationResult> {
    if (!this.session || this.transitioning) {
      return this.failure("Cannot abandon the current session.");
    }

    this.transitioning = true;

    try {
      this.setStatus("abandoning");

      const context = this.createContext();
      const sessionId = this.session.id;

      await this.ports.shutdownGameplay(context);
      await this.ports.unloadLevel(context);

      this.session.completedAt = this.clock();
      this.setStatus("abandoned");
      this.emit("session:abandoned", { sessionId, reason });

      return { success: true, session: this.getActiveSession() };
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    } finally {
      this.transitioning = false;
    }
  }

  getLastResults(): SessionResults | null {
    return this.lastResults;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.events.clear();
    this.resultsCache.clear();
    this.session = null;
  }

  private resolveConfiguration(request: StartSessionRequest): GameplaySessionConfiguration | null {
    const levelId =
      request.levelId ?? (request.mode === "training" ? "training_test" : "prologue_test");
    const isRanked = request.isRanked ?? request.mode === "speedrun";

    if (!levelId) {
      return null;
    }

    if (request.mode === "training" && isRanked) {
      return null;
    }

    return {
      levelId,
      isRanked,
      enableCheckpoints: request.mode !== "training",
      enableTimer: request.mode === "speedrun",
      enableGhostRecording: false,
      ...(request.startPointId === undefined ? {} : { startPointId: request.startPointId }),
    };
  }

  private createContext(): GameplaySessionContext {
    const session = this.session;

    if (!session) {
      throw new Error("No active gameplay session.");
    }

    const sessionId = session.id;
    const generation = this.generation;
    const isCurrent = (): boolean =>
      this.session?.id === sessionId && this.generation === generation;

    return {
      sessionId,
      generation,
      mode: session.mode,
      levelId: session.levelId,
      configuration: { ...session.configuration },
      isCurrent,
    };
  }

  private isContextCurrent(context: GameplaySessionContext): boolean {
    return context.isCurrent() && this.session?.id === context.sessionId;
  }

  private setStatus(status: GameplaySessionStatus): void {
    if (this.session) {
      this.session.status = status;
    }
  }

  private async failStart(error: unknown): Promise<SessionOperationResult> {
    const message = error instanceof Error ? error.message : String(error);

    if (this.session) {
      this.setStatus("failed");
      this.emit("session:failed", {
        sessionId: this.session.id,
        error: message,
      });
    }

    try {
      if (this.session) {
        const context = this.createContext();

        await this.ports.shutdownGameplay(context);
        await this.ports.unloadLevel(context);
      }
    } catch (cleanupError) {
      console.error("[Glassline] Gameplay session cleanup failed.", cleanupError);
    }

    return this.failure(message);
  }

  private failure(error: string): SessionOperationResult {
    return { success: false, session: this.getActiveSession(), error };
  }

  private emit<K extends keyof GameplaySessionEventMap>(
    event: K,
    payload: GameplaySessionEventMap[K],
  ): void {
    this.events.emit(event, payload);
  }
}
