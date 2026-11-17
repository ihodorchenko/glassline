import type { Disposable } from "../core/Disposable";
import { EventBus, type Unsubscribe } from "../core/EventBus";
import type { PhysicsWorld } from "../physics/PhysicsWorld";
import type { RenderScene } from "../rendering/RenderScene";
import {
  BoxLevelContentLoader,
  type LevelContentDependencies,
  type LoadedLevelContent,
} from "./LevelContentLoader";
import type {
  LevelDefinition,
  LevelInteractionTargetDefinition,
  LevelSectionDefinition,
  LevelVector3,
} from "./LevelTypes";
import { validateLevelDefinition } from "./LevelValidator";
import { RuntimeObjectRegistry } from "./RuntimeObjectRegistry";
import { type RuntimeSpawnPoint, SpawnPointManager } from "./SpawnPointManager";
import type { RuntimeSurface } from "./SurfaceRegistry";
import { SurfaceRegistry } from "./SurfaceRegistry";
import { type TriggerEvent, TriggerManager } from "./TriggerManager";

export type LevelSessionState =
  | "created"
  | "loading"
  | "initializing"
  | "ready"
  | "active"
  | "paused"
  | "completing"
  | "completed"
  | "unloading"
  | "failed";

export type LevelSectionState =
  | "unloaded"
  | "loading"
  | "loaded"
  | "activating"
  | "active"
  | "deactivating"
  | "failed";

export interface LevelSession {
  readonly id: string;
  readonly levelId: string;
  readonly levelVersion: string;
  readonly mode: LevelDefinition["mode"];
  readonly state: LevelSessionState;
  readonly currentSectionId: string | null;
  readonly createdAt: number;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface LevelSectionRuntime {
  readonly id: string;
  readonly definition: LevelSectionDefinition;
  readonly state: LevelSectionState;
  readonly activatedAt?: number;
}

export type LevelRuntimeErrorCode =
  | "LEVEL_NOT_FOUND"
  | "INVALID_LEVEL_DEFINITION"
  | "INVALID_SECTION_REFERENCE"
  | "SPAWN_POINT_NOT_FOUND"
  | "SECTION_LOAD_FAILED"
  | "SECTION_ACTIVATION_FAILED"
  | "TRANSITION_FAILED"
  | "OBJECT_REGISTRATION_FAILED"
  | "INITIALIZATION_CANCELLED"
  | "SESSION_ALREADY_ACTIVE"
  | "INVALID_SESSION_STATE"
  | "RESOURCE_DISPOSAL_FAILED";

export class LevelRuntimeError extends Error {
  readonly code: LevelRuntimeErrorCode;
  readonly levelId: string | undefined;
  readonly sectionId: string | undefined;
  readonly recoverable: boolean;
  override readonly cause: unknown;

  constructor(
    code: LevelRuntimeErrorCode,
    message: string,
    options: {
      readonly levelId?: string;
      readonly sectionId?: string;
      readonly recoverable?: boolean;
      readonly cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "LevelRuntimeError";
    this.code = code;
    this.recoverable = options.recoverable ?? false;
    this.levelId = options.levelId;
    this.sectionId = options.sectionId;
    this.cause = options.cause;
  }
}

export interface LevelLoadOptions {
  readonly sessionId?: string;
  readonly signal?: AbortSignal;
}

export interface LevelRuntimeEventMap {
  [key: string]: unknown;
  "level:loading": { readonly sessionId: string; readonly levelId: string };
  "level:ready": { readonly sessionId: string; readonly levelId: string };
  "level:started": { readonly sessionId: string; readonly levelId: string };
  "level:paused": { readonly sessionId: string };
  "level:resumed": { readonly sessionId: string };
  "level:completed": { readonly sessionId: string };
  "level:unloading": { readonly sessionId: string };
  "level:unloaded": { readonly sessionId: string; readonly levelId: string };
  "level:failed": {
    readonly sessionId: string;
    readonly levelId: string;
    readonly error: LevelRuntimeError;
  };
  "section:activated": {
    readonly sessionId: string;
    readonly sectionId: string;
    readonly order: number;
  };
  "section:deactivated": {
    readonly sessionId: string;
    readonly sectionId: string;
  };
  "trigger:enter": TriggerEvent;
  "trigger:exit": TriggerEvent;
}

export interface LevelRuntimeSnapshot {
  readonly levelId: string | null;
  readonly sessionId: string | null;
  readonly sessionState: LevelSessionState | null;
  readonly activeSectionId: string | null;
  readonly sections: readonly {
    readonly id: string;
    readonly state: LevelSectionState;
  }[];
  readonly objectCount: number;
  readonly activeTriggerCount: number;
  readonly triggerCount: number;
  readonly objectSurfaceCount: number;
  readonly activeSurfaceCount: number;
  readonly spawnPointCount: number;
  readonly interactionTargetCount: number;
  readonly lastError: LevelRuntimeError | null;
}

export interface LevelRuntimeManagerOptions {
  readonly scene: RenderScene;
  readonly physics: PhysicsWorld;
  readonly definitions: readonly LevelDefinition[];
}

interface LoadedManagers {
  readonly spawnPoints: SpawnPointManager;
  readonly triggers: TriggerManager;
  readonly surfaces: SurfaceRegistry;
  readonly objects: RuntimeObjectRegistry;
  readonly content: LoadedLevelContent;
  readonly interactionTargets: readonly LevelInteractionTargetDefinition[];
}

interface MutableSession {
  id: string;
  levelId: string;
  levelVersion: string;
  mode: LevelDefinition["mode"];
  state: LevelSessionState;
  currentSectionId: string | null;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  metadata: Record<string, unknown>;
}

interface MutableSectionRuntime {
  id: string;
  definition: LevelSectionDefinition;
  state: LevelSectionState;
  activatedAt?: number;
}

function toRuntimeError(
  error: unknown,
  code: LevelRuntimeErrorCode,
  levelId: string,
  sectionId?: string,
): LevelRuntimeError {
  if (error instanceof LevelRuntimeError) {
    return error;
  }

  return new LevelRuntimeError(code, error instanceof Error ? error.message : String(error), {
    levelId,
    ...(sectionId === undefined ? {} : { sectionId }),
    cause: error,
  });
}

function copySession(session: MutableSession | null): LevelSession | null {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    levelId: session.levelId,
    levelVersion: session.levelVersion,
    mode: session.mode,
    state: session.state,
    currentSectionId: session.currentSectionId,
    createdAt: session.createdAt,
    ...(session.startedAt === undefined ? {} : { startedAt: session.startedAt }),
    ...(session.completedAt === undefined ? {} : { completedAt: session.completedAt }),
    metadata: { ...session.metadata },
  };
}

/**
 * Level Runtime manager: owns the active level session, level content lifecycle,
 * section activation, spawn resolution, triggers, and runtime object cleanup.
 *
 * It does not own checkpoint progress, player recovery, interaction behavior, or
 * gameplay session orchestration (`docs/15` §1–§2).
 */
export class LevelRuntimeManager implements Disposable {
  private readonly definitions = new Map<string, LevelDefinition>();
  private readonly scene: RenderScene;
  private readonly physics: PhysicsWorld;
  private readonly loader = new BoxLevelContentLoader();
  private readonly events = new EventBus<LevelRuntimeEventMap>();

  private readonly clock: () => number;
  private sessionCounter = 0;
  private generation = 0;
  private loading = false;
  private transitionInProgress = false;

  private session: MutableSession | null = null;
  private definition: LevelDefinition | null = null;
  private managers: LoadedManagers | null = null;
  private readonly sections = new Map<string, MutableSectionRuntime>();
  private activeSectionId: string | null = null;
  private lastError: LevelRuntimeError | null = null;
  private disposed = false;

  constructor(options: LevelRuntimeManagerOptions) {
    this.scene = options.scene;
    this.physics = options.physics;
    this.clock = Date.now;

    for (const definition of options.definitions) {
      if (this.definitions.has(definition.id)) {
        throw new Error(`Duplicate level definition id "${definition.id}".`);
      }

      this.definitions.set(definition.id, definition);
    }
  }

  getCurrentSession(): LevelSession | null {
    return copySession(this.session);
  }

  getCurrentLevel(): LevelDefinition | null {
    return this.definition;
  }

  getActiveSectionId(): string | null {
    return this.activeSectionId;
  }

  getSection(sectionId: string): LevelSectionRuntime | null {
    const section = this.sections.get(sectionId);

    if (!section) {
      return null;
    }

    return {
      id: section.id,
      definition: section.definition,
      state: section.state,
      ...(section.activatedAt === undefined ? {} : { activatedAt: section.activatedAt }),
    };
  }

  getInitialSpawnPoint(): RuntimeSpawnPoint | null {
    return this.managers?.spawnPoints.getInitialSpawnPoint() ?? null;
  }

  resolveSpawnPoint(spawnPointId: string): RuntimeSpawnPoint | null {
    return this.managers?.spawnPoints.get(spawnPointId) ?? null;
  }

  resolveSpawnPointForContext(context: {
    readonly spawnPointId?: string;
    readonly sectionId?: string;
    readonly fallbackSpawnPointId?: string;
  }): RuntimeSpawnPoint | null {
    return this.managers?.spawnPoints.resolveSpawnPoint(context) ?? null;
  }

  getInteractionTargets(): readonly LevelInteractionTargetDefinition[] {
    return this.managers?.interactionTargets ?? [];
  }

  getSurfaceAt(feetPosition: LevelVector3): RuntimeSurface | null {
    return this.managers?.surfaces.getSurfaceAt(feetPosition) ?? null;
  }

  getSurfaces(): readonly RuntimeSurface[] {
    return this.managers?.surfaces.getAll() ?? [];
  }

  getSpawnPoints(): readonly RuntimeSpawnPoint[] {
    return this.managers?.spawnPoints.getAll() ?? [];
  }

  getSnapshot(): LevelRuntimeSnapshot {
    const managers = this.managers;

    return {
      levelId: this.definition?.id ?? null,
      sessionId: this.session?.id ?? null,
      sessionState: this.session?.state ?? null,
      activeSectionId: this.activeSectionId,
      sections: [...this.sections.values()].map((section) => ({
        id: section.id,
        state: section.state,
      })),
      objectCount: managers?.objects.getCount() ?? 0,
      activeTriggerCount: managers?.triggers.getActiveCount() ?? 0,
      triggerCount: managers?.triggers.getCount() ?? 0,
      objectSurfaceCount: managers?.surfaces.getCount() ?? 0,
      activeSurfaceCount: managers?.surfaces.getActiveCount() ?? 0,
      spawnPointCount: managers?.spawnPoints.getCount() ?? 0,
      interactionTargetCount: managers?.interactionTargets.length ?? 0,
      lastError: this.lastError,
    };
  }

  on<K extends keyof LevelRuntimeEventMap>(
    event: K,
    listener: (payload: LevelRuntimeEventMap[K]) => void,
  ): Unsubscribe {
    return this.events.on(event, listener);
  }

  async loadLevel(levelId: string, options: LevelLoadOptions = {}): Promise<LevelSession> {
    if (this.disposed) {
      throw new LevelRuntimeError("INVALID_SESSION_STATE", "Level Runtime is disposed.", {
        levelId,
      });
    }

    if (this.session || this.loading) {
      throw new LevelRuntimeError(
        "SESSION_ALREADY_ACTIVE",
        `Cannot load level "${levelId}" while another level session is active.`,
        { levelId },
      );
    }

    const definition = this.definitions.get(levelId);

    if (!definition) {
      throw new LevelRuntimeError("LEVEL_NOT_FOUND", `Unknown level id "${levelId}".`, {
        levelId,
      });
    }

    if (options.signal?.aborted) {
      throw new LevelRuntimeError(
        "INITIALIZATION_CANCELLED",
        `Level "${levelId}" loading was cancelled.`,
        { levelId },
      );
    }

    const validation = validateLevelDefinition(definition);

    if (!validation.valid) {
      throw new LevelRuntimeError(
        "INVALID_LEVEL_DEFINITION",
        `Level "${levelId}" is invalid: ${validation.errors
          .map((error) => `${error.code}: ${error.message}`)
          .join("; ")}`,
        { levelId },
      );
    }

    const generation = this.generation + 1;

    this.generation = generation;
    this.loading = true;

    const session: MutableSession = {
      id: options.sessionId ?? `level-session-${++this.sessionCounter}`,
      levelId: definition.id,
      levelVersion: definition.version,
      mode: definition.mode,
      state: "loading",
      currentSectionId: null,
      createdAt: this.clock(),
      metadata: {},
    };

    this.session = session;
    this.definition = definition;
    this.lastError = null;

    this.events.emit("level:loading", { sessionId: session.id, levelId: definition.id });

    const spawnPoints = new SpawnPointManager(definition.initialSpawnPointId);
    const triggers = new TriggerManager();
    const surfaces = new SurfaceRegistry();
    const objects = new RuntimeObjectRegistry();

    let content: LoadedLevelContent | null = null;

    try {
      session.state = "initializing";

      const dependencies: LevelContentDependencies = {
        sessionId: session.id,
        levelId: definition.id,
        scene: this.scene,
        physics: this.physics,
        spawnPoints,
        triggers,
        surfaces,
        objects,
      };

      content = await this.loader.load(definition, dependencies);

      if (this.generation !== generation || options.signal?.aborted) {
        throw new LevelRuntimeError(
          "INITIALIZATION_CANCELLED",
          `Level "${definition.id}" loading was superseded or cancelled.`,
          { levelId: definition.id },
        );
      }

      for (const section of definition.sections) {
        this.sections.set(section.id, {
          id: section.id,
          definition: section,
          state: "loaded",
        });
      }

      if (!spawnPoints.getInitialSpawnPoint()) {
        throw new LevelRuntimeError(
          "SPAWN_POINT_NOT_FOUND",
          `Initial spawn point "${definition.initialSpawnPointId}" is unavailable.`,
          { levelId: definition.id },
        );
      }

      this.managers = {
        spawnPoints,
        triggers,
        surfaces,
        objects,
        content,
        interactionTargets: content.interactionTargets,
      };
      this.loading = false;
      session.state = "ready";

      this.events.emit("level:ready", { sessionId: session.id, levelId: definition.id });

      return copySession(session) as LevelSession;
    } catch (error) {
      this.loading = false;

      const runtimeError = toRuntimeError(error, "INITIALIZATION_CANCELLED", definition.id);

      this.lastError = runtimeError;
      this.rollbackLoad(content, spawnPoints, triggers, surfaces, objects);

      this.session = null;
      this.definition = null;
      this.lastError = runtimeError;

      this.events.emit("level:failed", {
        sessionId: session.id,
        levelId: definition.id,
        error: runtimeError,
      });

      throw runtimeError;
    }
  }

  async startSession(): Promise<void> {
    const session = this.session;

    if (!session || !this.managers) {
      throw new LevelRuntimeError(
        "INVALID_SESSION_STATE",
        "Cannot start a level session before a level is loaded.",
      );
    }

    if (session.state !== "ready") {
      throw new LevelRuntimeError(
        "INVALID_SESSION_STATE",
        `Cannot start a level session in state "${session.state}".`,
        { levelId: session.levelId },
      );
    }

    const initialSpawn = this.managers.spawnPoints.getInitialSpawnPoint();
    const initialSectionId =
      initialSpawn?.sectionId ??
      [...this.sections.values()].sort(
        (left, right) => left.definition.order - right.definition.order,
      )[0]?.id;

    if (!initialSectionId) {
      throw new LevelRuntimeError("INVALID_SECTION_REFERENCE", "Level has no initial section.", {
        levelId: session.levelId,
      });
    }

    session.state = "active";
    session.startedAt = this.clock();
    this.performSectionActivation(initialSectionId, true);

    this.events.emit("level:started", { sessionId: session.id, levelId: session.levelId });
  }

  pauseSession(): void {
    const session = this.session;

    if (!session) {
      throw new LevelRuntimeError("INVALID_SESSION_STATE", "No active level session.");
    }

    if (session.state !== "active") {
      throw new LevelRuntimeError(
        "INVALID_SESSION_STATE",
        `Cannot pause a session in state "${session.state}".`,
        { levelId: session.levelId },
      );
    }

    session.state = "paused";
    this.events.emit("level:paused", { sessionId: session.id });
  }

  resumeSession(): void {
    const session = this.session;

    if (!session) {
      throw new LevelRuntimeError("INVALID_SESSION_STATE", "No active level session.");
    }

    if (session.state !== "paused") {
      throw new LevelRuntimeError(
        "INVALID_SESSION_STATE",
        `Cannot resume a session in state "${session.state}".`,
        { levelId: session.levelId },
      );
    }

    session.state = "active";
    this.events.emit("level:resumed", { sessionId: session.id });
  }

  async completeSession(): Promise<void> {
    const session = this.session;

    if (!session) {
      throw new LevelRuntimeError("INVALID_SESSION_STATE", "No active level session.");
    }

    if (session.state !== "active" && session.state !== "paused") {
      throw new LevelRuntimeError(
        "INVALID_SESSION_STATE",
        `Cannot complete a session in state "${session.state}".`,
        { levelId: session.levelId },
      );
    }

    session.state = "completing";
    session.state = "completed";
    session.completedAt = this.clock();
    this.events.emit("level:completed", { sessionId: session.id });
  }

  async activateSection(sectionId: string): Promise<void> {
    this.performSectionActivation(sectionId, false);
  }

  /** Evaluates level triggers for the player actor. Call once per fixed step. */
  update(playerPosition: LevelVector3, timestampMs: number, actorId = "player"): void {
    const session = this.session;

    if (!session || !this.managers || session.state !== "active") {
      return;
    }

    const events = this.managers.triggers.update(playerPosition, actorId, timestampMs);

    for (const event of events) {
      this.events.emit(event.eventType === "enter" ? "trigger:enter" : "trigger:exit", event);

      if (event.eventType !== "enter" || event.type !== "section-entry") {
        continue;
      }

      const targetSectionId = event.metadata?.targetSectionId;

      if (!targetSectionId) {
        continue;
      }

      try {
        this.performSectionActivation(targetSectionId, false);
      } catch (error) {
        this.lastError = toRuntimeError(
          error,
          "TRANSITION_FAILED",
          session.levelId,
          targetSectionId,
        );
      }
    }
  }

  /** Unloads the level session and releases all owned resources. Idempotent. */
  async unloadLevel(): Promise<void> {
    const session = this.session;

    if (!session) {
      return;
    }

    const { id: sessionId, levelId } = session;

    this.generation += 1;
    session.state = "unloading";
    this.transitionInProgress = false;
    this.events.emit("level:unloading", { sessionId });

    const disposalFailures: unknown[] = [];
    const managers = this.managers;

    if (managers) {
      for (const failure of managers.objects.disposeAll()) {
        disposalFailures.push(failure);
      }

      try {
        managers.content.dispose();
      } catch (error) {
        disposalFailures.push(error);
      }

      managers.triggers.clear();
      managers.spawnPoints.clear();
      managers.surfaces.clear();
    }

    this.managers = null;
    this.sections.clear();
    this.activeSectionId = null;
    this.session = null;
    this.definition = null;

    if (disposalFailures.length > 0) {
      this.lastError = new LevelRuntimeError(
        "RESOURCE_DISPOSAL_FAILED",
        `Level "${levelId}" cleanup reported ${disposalFailures.length} failure(s).`,
        { levelId, cause: disposalFailures },
      );
      console.error("[Glassline] Level cleanup reported failures.", disposalFailures);
    }

    this.events.emit("level:unloaded", { sessionId, levelId });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    void this.unloadLevel();
    this.events.clear();
  }

  private performSectionActivation(sectionId: string, initial: boolean): void {
    const session = this.session;
    const managers = this.managers;

    if (!session || !managers) {
      throw new LevelRuntimeError("INVALID_SESSION_STATE", "No loaded level session.");
    }

    const section = this.sections.get(sectionId);

    if (!section) {
      throw new LevelRuntimeError("INVALID_SECTION_REFERENCE", `Unknown section "${sectionId}".`, {
        levelId: session.levelId,
        sectionId,
      });
    }

    if (this.activeSectionId === sectionId) {
      return;
    }

    if (this.transitionInProgress) {
      throw new LevelRuntimeError(
        "TRANSITION_FAILED",
        "A section transition is already in progress.",
        { levelId: session.levelId, sectionId },
      );
    }

    if (!initial && this.activeSectionId) {
      const current = this.sections.get(this.activeSectionId);

      if (!current || current.definition.nextSectionId !== sectionId) {
        throw new LevelRuntimeError(
          "TRANSITION_FAILED",
          `Section transition "${this.activeSectionId}" -> "${sectionId}" is not allowed by the level definition.`,
          { levelId: session.levelId, sectionId },
        );
      }
    }

    this.transitionInProgress = true;

    try {
      if (this.activeSectionId) {
        const previous = this.sections.get(this.activeSectionId);

        if (previous) {
          const failures = managers.objects.deactivateSection(previous.id);

          if (failures.length > 0) {
            throw new LevelRuntimeError(
              "SECTION_ACTIVATION_FAILED",
              `Section "${previous.id}" deactivation reported failures.`,
              { levelId: session.levelId, sectionId: previous.id, cause: failures },
            );
          }

          previous.state = "loaded";
          this.events.emit("section:deactivated", {
            sessionId: session.id,
            sectionId: previous.id,
          });
        }
      }

      section.state = "active";
      section.activatedAt = this.clock();

      const failures = managers.objects.activateSection(section.id);

      if (failures.length > 0) {
        throw new LevelRuntimeError(
          "SECTION_ACTIVATION_FAILED",
          `Section "${section.id}" activation reported failures.`,
          { levelId: session.levelId, sectionId: section.id, cause: failures },
        );
      }

      this.activeSectionId = section.id;
      session.currentSectionId = section.id;

      this.events.emit("section:activated", {
        sessionId: session.id,
        sectionId: section.id,
        order: section.definition.order,
      });
    } finally {
      this.transitionInProgress = false;
    }
  }

  private rollbackLoad(
    content: LoadedLevelContent | null,
    spawnPoints: SpawnPointManager,
    triggers: TriggerManager,
    surfaces: SurfaceRegistry,
    objects: RuntimeObjectRegistry,
  ): void {
    try {
      content?.dispose();
    } catch (error) {
      console.error("[Glassline] Failed to roll back level content.", error);
    }

    for (const failure of objects.disposeAll()) {
      console.error("[Glassline] Failed to roll back a runtime object.", failure);
    }

    triggers.clear();
    spawnPoints.clear();
    surfaces.clear();
    this.sections.clear();
    this.activeSectionId = null;
    this.managers = null;
  }
}
