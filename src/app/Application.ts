import { AudioManager } from "../audio/AudioManager";
import { CameraSystem } from "../camera/CameraSystem";
import { type CheckpointDefinition, CheckpointSystem } from "../checkpoint/CheckpointSystem";
import { type Disposable, disposeAll } from "../core/Disposable";
import { GameLoop } from "../core/GameLoop";
import { StatusOverlay } from "../diagnostics/StatusOverlay";
import { GameplayFlowManager, type GameplayFlowState } from "../flow/GameplayFlowManager";
import type { InputContext } from "../input/InputActions";
import { InputManager } from "../input/InputManager";
import { IDLE_INPUT_FRAME, type InputFrame } from "../input/InputState";
import { InteractionSystem } from "../interaction/InteractionSystem";
import { LevelRuntimeManager } from "../levels/LevelRuntimeManager";
import type { TriggerEvent } from "../levels/TriggerManager";
import { PROLOGUE_TEST_LEVEL_DEFINITIONS } from "../levels/test/PrologueTestLevel";
import { TRAINING_TEST_LEVEL_DEFINITIONS } from "../levels/test/TrainingTestLevel";
import { DEFAULT_LANGUAGE_ID, DEFAULT_LANGUAGE_REGISTRY } from "../localization/Language";
import { LocalizationManager } from "../localization/LocalizationManager";
import { createDefaultLocalizationResourceLoader } from "../localization/LocalizationResourceLoader";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import type { MovementInputSample } from "../player/MovementModel";
import { PlayerStateSystem } from "../player/PlayerStateSystem";
import { PlayerSystem } from "../player/PlayerSystem";
import { Renderer } from "../rendering/Renderer";
import { RenderScene } from "../rendering/RenderScene";
import { ResourceLoader } from "../resources/ResourceLoader";
import { RespawnManager } from "../respawn/RespawnManager";
import {
  type GameplayMode,
  type GameplaySessionContext,
  GameplaySessionManager,
  type GameplaySessionPorts,
  type LoadedLevelInfo,
  type SessionResults,
} from "../sessions/GameplaySessionManager";
import { AudioSettingsAdapter } from "../settings/adapters/AudioSettingsAdapter";
import { CameraSettingsAdapter } from "../settings/adapters/CameraSettingsAdapter";
import { ControlsSettingsAdapter } from "../settings/adapters/ControlsSettingsAdapter";
import { SettingsApplicationPipeline } from "../settings/SettingsApplication";
import { SETTING_DEFINITIONS } from "../settings/SettingsDefinitions";
import { SettingsManager } from "../settings/SettingsManager";
import { readStringValue, type SettingsSnapshot } from "../settings/SettingsTypes";
import type { Vector3Like } from "../shared/math";
import { createPrologueRoute } from "../speedrun/PrologueRoute";
import { formatRunTime } from "../speedrun/RunTimer";
import { SpeedrunSystem } from "../speedrun/SpeedrunSystem";
import { Database, StorageError } from "../storage/Database";
import { SettingsRepository } from "../storage/repositories/SettingsRepository";
import { TRAINING_EXERCISES } from "../training/TrainingExercises";
import { TrainingSystem } from "../training/TrainingSystem";
import { type ApplicationConfig, DEFAULT_APPLICATION_CONFIG } from "./ApplicationConfig";

export type ApplicationState = "idle" | "initializing" | "ready" | "running" | "stopped" | "failed";

const STATUS_WINDOW_MS = 500;
const TRAINING_LEVEL_ID = "training_test";
const PROLOGUE_LEVEL_ID = "prologue_test";

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

/**
 * Composition root.
 *
 * Creates persistent services, owns the game loop, and drives gameplay sessions
 * through the Gameplay Session manager. Level content is loaded and unloaded by
 * Level Runtime per session; player/traversal/mode systems are session-scoped.
 */
export class Application implements Disposable {
  private readonly config: ApplicationConfig;
  private readonly resources: Disposable[] = [];
  private readonly sessionDisposables: Disposable[] = [];
  private readonly sessionUnsubscribes: (() => void)[] = [];

  private state: ApplicationState = "idle";
  private disposed = false;
  private busy = false;
  private completionRequested = false;

  private canvas: HTMLCanvasElement | null = null;
  private statusOverlay: StatusOverlay | null = null;
  private renderer: Renderer | null = null;
  private renderScene: RenderScene | null = null;
  private physics: PhysicsWorld | null = null;
  private input: InputManager | null = null;
  private database: Database | null = null;
  private gameLoop: GameLoop | null = null;
  private settingsManager: SettingsManager | null = null;
  private settingsPipeline: SettingsApplicationPipeline | null = null;
  private settingsUnsubscribe: (() => void) | null = null;
  private localizationManager: LocalizationManager | null = null;
  private resourceLoader: ResourceLoader | null = null;
  private audioManager: AudioManager | null = null;
  private cameraSystem: CameraSystem | null = null;
  private levelRuntime: LevelRuntimeManager | null = null;
  private sessionManager: GameplaySessionManager | null = null;
  private flowManager: GameplayFlowManager | null = null;

  private player: PlayerSystem | null = null;
  private playerState: PlayerStateSystem | null = null;
  private checkpointSystem: CheckpointSystem | null = null;
  private interactionSystem: InteractionSystem | null = null;
  private respawnManager: RespawnManager | null = null;
  private trainingSystem: TrainingSystem | null = null;
  private speedrunSystem: SpeedrunSystem | null = null;
  private currentMode: GameplayMode | null = null;
  private lastResults: SessionResults | null = null;

  private storageStatus = "not initialized";
  private localizationStatus = "not initialized";
  private resizeCleanup: (() => void) | null = null;
  private visibilityCleanup: (() => void) | null = null;
  private devKeyCleanup: (() => void) | null = null;

  private statusWindowStartMs = 0;
  private statusFrameCount = 0;
  private displayedFps = 0;
  private displayedFixedHz = 0;
  private lastPhysicsStepCount = 0;

  constructor(config: ApplicationConfig = DEFAULT_APPLICATION_CONFIG) {
    this.config = config;
  }

  get currentState(): ApplicationState {
    return this.state;
  }

  get hasPersistence(): boolean {
    return this.database !== null;
  }

  async initialize(): Promise<void> {
    if (this.state !== "idle") {
      throw new Error(`Application cannot initialize from state "${this.state}".`);
    }

    this.state = "initializing";

    if (this.config.enableStatusOverlay) {
      this.statusOverlay = new StatusOverlay();
      this.resources.push(this.statusOverlay);
    }

    try {
      this.canvas = this.resolveCanvas();

      await this.initializeStorage();
      await this.initializeSettings();
      await this.initializeLocalization();

      this.initializeRendering();

      await this.initializePhysics();
      this.initializeLevelRuntime();
      this.initializeCamera();
      this.initializeInput();
      this.initializeAudio();
      this.initializeFlowAndSessions();
      await this.initializeSettingsApplication();
      this.initializeGameLoop();
      this.registerWindowHandlers();
      this.registerDevKeys();
      this.handleResize();
      this.resetStatusWindow();

      this.flowManager?.navigate({ target: "main-menu", reason: "boot-complete" });
      this.syncInputContext();

      this.state = "ready";
    } catch (error) {
      this.state = "failed";
      const details = describeError(error);

      this.releaseResources();

      if (this.config.enableStatusOverlay) {
        const failureOverlay = new StatusOverlay();

        failureOverlay.showFatal("Glassline failed to start", details);
        this.statusOverlay = failureOverlay;
        this.resources.push(failureOverlay);
      }

      throw error;
    }
  }

  start(): void {
    if (this.state === "running") {
      return;
    }

    if (this.state === "failed") {
      throw new Error("Cannot start a failed application.");
    }

    if (!this.gameLoop) {
      throw new Error("Application is not initialized. Await initialize() first.");
    }

    this.state = "running";
    this.resetStatusWindow();
    this.gameLoop.start();
  }

  stop(): void {
    if (!this.gameLoop) {
      return;
    }

    this.gameLoop.stop();

    if (this.state === "running") {
      this.state = "stopped";
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.releaseResources();

    if (this.state !== "failed") {
      this.state = "stopped";
    }
  }

  private async initializeStorage(): Promise<void> {
    try {
      const database = new Database(this.config.storage);

      await database.open();

      this.database = database;
      this.resources.push(database);
      this.storageStatus = `ready (version ${this.config.storage.version})`;
    } catch (error) {
      this.database = null;
      this.storageStatus = `unavailable (${error instanceof StorageError ? error.code : "unknown"})`;

      console.warn("[Glassline] Persistence is unavailable; continuing without saved data.", error);
    }
  }

  private async initializeSettings(): Promise<void> {
    const persistence = this.database ? new SettingsRepository(this.database) : null;

    this.settingsManager = new SettingsManager({
      definitions: SETTING_DEFINITIONS,
      persistence,
    });
    await this.settingsManager.initialize();
  }

  private async initializeLocalization(): Promise<void> {
    this.resourceLoader = new ResourceLoader();

    const localizationLoader = createDefaultLocalizationResourceLoader(this.resourceLoader);
    const localization = new LocalizationManager({
      loader: localizationLoader,
      registry: DEFAULT_LANGUAGE_REGISTRY,
    });

    this.localizationManager = localization;

    const requestedLanguage =
      this.settingsManager?.getValue<string>("general.language") ?? DEFAULT_LANGUAGE_ID;

    try {
      const result = await localization.initialize(requestedLanguage);

      this.localizationStatus = result.usedFallback
        ? `fallback to ${result.languageId} (${result.error})`
        : `ready (${result.languageId})`;
    } catch (error) {
      this.localizationStatus = `unavailable (${describeError(error)})`;
      console.warn("[Glassline] Localization is unavailable; using raw keys.", error);
    }
  }

  private initializeRendering(): void {
    if (!this.canvas) {
      throw new Error("Canvas is not available.");
    }

    this.renderer = new Renderer(this.canvas, this.config.renderer);
    this.resources.push(this.renderer);

    this.renderScene = new RenderScene();
    this.resources.push(this.renderScene);
  }

  private async initializePhysics(): Promise<void> {
    const expectedTimestep = 1 / this.config.gameLoop.physicsHz;

    if (Math.abs(this.config.physics.timestepSeconds - expectedTimestep) > 1e-9) {
      throw new Error(
        "Physics timestep must match the game loop fixed timestep " +
          `(${expectedTimestep}s), received ${this.config.physics.timestepSeconds}s.`,
      );
    }

    this.physics = new PhysicsWorld(this.config.physics);
    await this.physics.initialize();
    this.resources.push(this.physics);
  }

  private initializeLevelRuntime(): void {
    if (!this.renderScene || !this.physics) {
      throw new Error("Level Runtime requires initialized rendering and physics.");
    }

    this.levelRuntime = new LevelRuntimeManager({
      scene: this.renderScene,
      physics: this.physics,
      definitions: [...TRAINING_TEST_LEVEL_DEFINITIONS, ...PROLOGUE_TEST_LEVEL_DEFINITIONS],
    });
    this.resources.push(this.levelRuntime);
  }

  private initializeCamera(): void {
    this.cameraSystem = new CameraSystem({
      fovDegrees: this.config.camera.fovDegrees,
      nearPlane: this.config.camera.nearPlane,
      farPlane: this.config.camera.farPlane,
      tuning: this.config.movement,
    });
    this.resources.push(this.cameraSystem);
  }

  private initializeInput(): void {
    if (!this.canvas) {
      throw new Error("Canvas is not available.");
    }

    this.input = new InputManager({
      canvas: this.canvas,
      onPointerLockChanged: (locked) => {
        console.info(`[Glassline] Pointer lock ${locked ? "acquired" : "released"}.`);
      },
    });
    this.input.setEnabled(false);
    this.resources.push(this.input);
  }

  private initializeAudio(): void {
    this.audioManager = new AudioManager();
    this.audioManager.initialize();
    this.resources.push(this.audioManager);
  }

  private initializeFlowAndSessions(): void {
    this.flowManager = new GameplayFlowManager();
    this.resources.push(this.flowManager);

    this.sessionManager = new GameplaySessionManager({
      ports: this.createSessionPorts(),
      applicationVersion: this.config.appVersion,
    });
    this.resources.push(this.sessionManager);
  }

  private createSessionPorts(): GameplaySessionPorts {
    return {
      loadLevel: (context) => this.loadLevelPort(context),
      startLevel: (context) => this.startLevelPort(context),
      unloadLevel: (context) => this.unloadLevelPort(context),
      prepareGameplay: (context) => this.prepareGameplayPort(context),
      activateGameplay: (context) => this.activateGameplayPort(context),
      suspendGameplay: (context, reason) => this.suspendGameplayPort(context, reason),
      resumeGameplay: (context) => this.resumeGameplayPort(context),
      restartGameplay: (context) => this.restartGameplayPort(context),
      shutdownGameplay: async (context) => {
        this.shutdownGameplayPort(context);
      },
      buildResults: (context) => this.buildResults(context),
    };
  }

  private async loadLevelPort(context: GameplaySessionContext): Promise<LoadedLevelInfo> {
    const runtime = this.levelRuntime;

    if (!runtime) {
      throw new Error("Level Runtime is unavailable.");
    }

    await runtime.loadLevel(context.levelId);

    const levelSession = runtime.getCurrentSession();
    const level = runtime.getCurrentLevel();
    const initialSpawn = runtime.getInitialSpawnPoint();

    if (!levelSession || !level || !initialSpawn) {
      throw new Error(`Level "${context.levelId}" did not resolve initial runtime data.`);
    }

    return {
      levelVersion: levelSession.levelVersion,
      initialSpawnId: initialSpawn.id,
    };
  }

  private async startLevelPort(_context: GameplaySessionContext): Promise<void> {
    await this.levelRuntime?.startSession();
  }

  private async unloadLevelPort(_context: GameplaySessionContext): Promise<void> {
    await this.levelRuntime?.unloadLevel();
  }

  private async prepareGameplayPort(context: GameplaySessionContext): Promise<void> {
    const levelRuntime = this.levelRuntime;
    const physics = this.physics;
    const camera = this.cameraSystem;

    if (!levelRuntime || !physics || !camera) {
      throw new Error("Gameplay systems require Level Runtime, physics, and camera.");
    }

    const level = levelRuntime.getCurrentLevel();
    const levelSession = levelRuntime.getCurrentSession();
    const initialSpawn = levelRuntime.getInitialSpawnPoint();

    if (!level || !levelSession || !initialSpawn) {
      throw new Error("Gameplay preparation requires a loaded level and resolved spawn.");
    }

    this.currentMode = context.mode;
    this.completionRequested = false;

    this.playerState = new PlayerStateSystem("local-player", context.sessionId);
    this.sessionDisposables.push(this.playerState);

    this.player = new PlayerSystem(physics, {
      tuning: this.config.movement,
      spawnPoint: initialSpawn.position,
    });
    this.sessionDisposables.push(this.player);

    camera.resetForRespawn(initialSpawn.rotationY);
    this.playerState.updateFromMovement(this.player.getMovementSnapshot(), performance.now());

    const checkpointDefinitions: CheckpointDefinition[] = level.checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      levelId: level.id,
      sectionId: checkpoint.sectionId,
      spawnPointId: checkpoint.spawnPointId,
      displayName: checkpoint.displayName,
      activationMode: checkpoint.activationMode ?? "automatic",
      enabled: checkpoint.enabled ?? true,
      repeatable: checkpoint.repeatable ?? true,
      respawnEnabled: checkpoint.respawnEnabled ?? true,
      ...(checkpoint.order === undefined ? {} : { order: checkpoint.order }),
    }));

    this.checkpointSystem = new CheckpointSystem(checkpointDefinitions, {
      levelId: level.id,
      sessionId: levelSession.id,
      spawnResolver: {
        resolve: (spawnPointId: string) => {
          const spawnPoint = levelRuntime.resolveSpawnPoint(spawnPointId);

          return spawnPoint
            ? { position: spawnPoint.position, rotationY: spawnPoint.rotationY }
            : null;
        },
      },
    });
    this.sessionDisposables.push(this.checkpointSystem);

    this.interactionSystem = new InteractionSystem(levelRuntime.getInteractionTargets(), {
      lineOfSight: (eyePosition, target) => this.hasLineOfSight(eyePosition, target.position),
    });
    this.sessionDisposables.push(this.interactionSystem);

    this.respawnManager = new RespawnManager(
      {
        checkpoints: this.checkpointSystem,
        player: this.player,
        camera,
        input: this.input ?? {
          setEnabled: () => undefined,
        },
      },
      {
        fallbackSpawn: initialSpawn.position,
        fallbackRotationY: initialSpawn.rotationY,
      },
    );
    this.sessionDisposables.push(this.respawnManager);

    if (context.mode === "training") {
      this.trainingSystem = new TrainingSystem(TRAINING_EXERCISES);
      this.sessionDisposables.push(this.trainingSystem);
    } else if (context.mode === "speedrun") {
      this.speedrunSystem = new SpeedrunSystem({
        route: createPrologueRoute(level),
      });
      this.speedrunSystem.prepare(context.sessionId);
      this.sessionDisposables.push(this.speedrunSystem);
    }

    this.subscribeGameplayEvents();
    this.syncInteractionPresentation();
  }

  private subscribeGameplayEvents(): void {
    const levelRuntime = this.levelRuntime;
    const player = this.player;
    const interaction = this.interactionSystem;
    const training = this.trainingSystem;

    if (!levelRuntime) {
      return;
    }

    this.sessionUnsubscribes.push(
      levelRuntime.on("trigger:enter", (event) => this.handleTriggerEnter(event)),
    );

    this.sessionUnsubscribes.push(
      levelRuntime.on("section:activated", () => this.syncInteractionPresentation()),
    );

    if (player) {
      const movementEvents: readonly [Parameters<PlayerSystem["onMovementEvent"]>[0], string][] = [
        ["player:jumped", "jump"],
        ["player:landed", "landed"],
        ["player:sliding-started", "slide_started"],
        ["player:sliding-ended", "slide_ended"],
        ["player:vault-started", "vault_started"],
        ["player:wallrun-started", "wallrun_started"],
        ["player:wallrun-ended", "wallrun_ended"],
        ["player:walljumped", "walljumped"],
      ];

      for (const [eventName, action] of movementEvents) {
        const unsubscribe = player.onMovementEvent(eventName, () => {
          training?.handleEvent({
            type: "action",
            action: action as Parameters<TrainingSystem["handleEvent"]>[0] extends {
              type: "action";
              action: infer T;
            }
              ? T
              : never,
            timestamp: performance.now(),
          });
        });

        this.sessionUnsubscribes.push(unsubscribe);
      }
    }

    if (interaction) {
      this.sessionUnsubscribes.push(
        interaction.subscribe((targetId) => {
          this.trainingSystem?.handleEvent({
            type: "interaction",
            targetId,
            timestamp: performance.now(),
          });
        }),
      );
    }

    if (training) {
      this.sessionUnsubscribes.push(
        training.subscribe((event) => {
          if (event.type === "session:completed") {
            void this.completeGameplay("training-complete");
          }
        }),
      );
    }
  }

  private async activateGameplayPort(context: GameplaySessionContext): Promise<void> {
    const input = this.input;

    input?.setContext("gameplay");
    input?.setEnabled(true);

    this.player?.activate();
    this.playerState?.activate();
    this.settlePlayer();

    if (this.trainingSystem) {
      this.trainingSystem.startSession(context.sessionId);
    }

    this.speedrunSystem?.startRun();
    this.syncInteractionPresentation();
    this.syncPlayerState();
  }

  private async suspendGameplayPort(
    _context: GameplaySessionContext,
    _reason: "player" | "focus-loss" | "system" | "menu",
  ): Promise<void> {
    this.input?.setEnabled(false);
    this.levelRuntime?.pauseSession();
  }

  private async resumeGameplayPort(_context: GameplaySessionContext): Promise<void> {
    this.levelRuntime?.resumeSession();
    this.input?.setEnabled(true);
    this.input?.setContext("gameplay");
  }

  private async restartGameplayPort(context: GameplaySessionContext): Promise<void> {
    this.shutdownGameplayPort(context);

    const runtime = this.levelRuntime;

    if (!runtime) {
      throw new Error("Level Runtime is unavailable for restart.");
    }

    await runtime.unloadLevel();
    await runtime.loadLevel(context.levelId);
    await this.prepareGameplayPort(context);
    await runtime.startSession();
    await this.activateGameplayPort(context);
  }

  private shutdownGameplayPort(_context: GameplaySessionContext): void {
    this.input?.setEnabled(false);

    for (const unsubscribe of this.sessionUnsubscribes) {
      unsubscribe();
    }

    this.sessionUnsubscribes.length = 0;

    disposeAll(this.sessionDisposables);
    this.sessionDisposables.length = 0;

    this.player = null;
    this.playerState = null;
    this.checkpointSystem = null;
    this.interactionSystem = null;
    this.respawnManager = null;
    this.trainingSystem = null;
    this.speedrunSystem = null;
    this.lastResults = null;
    this.completionRequested = false;
  }

  private buildResults(context: GameplaySessionContext): SessionResults {
    const trainingResult = this.trainingSystem?.getSnapshot().result ?? null;
    const speedrunResult = this.speedrunSystem?.getResult() ?? null;

    return {
      sessionId: context.sessionId,
      mode: context.mode,
      levelId: context.levelId,
      status: "completed",
      durationMs: 0,
      completedAt: Date.now(),
      ...(trainingResult ? { training: trainingResult } : {}),
      ...(speedrunResult ? { speedrun: speedrunResult } : {}),
    };
  }

  private handleTriggerEnter(event: TriggerEvent): void {
    if (!this.sessionManager?.isRunning()) {
      return;
    }

    const checkpointId = event.metadata?.checkpointId;

    if (checkpointId) {
      const activation = this.checkpointSystem?.notifyTriggerEnter(checkpointId, event.timestamp);

      if (activation) {
        console.info(`[Glassline] Checkpoint activated: ${activation.checkpointId}`);
        this.speedrunSystem?.recordCheckpoint(activation.checkpointId);
      }

      return;
    }

    if (event.metadata?.kind === "kill-volume") {
      this.respawnManager?.request("fall");

      return;
    }

    if (event.metadata?.kind === "finish") {
      void this.completeGameplay("finish-trigger", event.triggerId);
    }
  }

  private async completeGameplay(source: string, finishTriggerId?: string): Promise<void> {
    if (this.completionRequested || this.busy) {
      return;
    }

    if (!this.sessionManager?.isRunning()) {
      return;
    }

    this.completionRequested = true;
    this.busy = true;

    try {
      if (this.speedrunSystem && finishTriggerId) {
        this.speedrunSystem.finishRun(finishTriggerId);
      }

      const result = await this.sessionManager.completeSession({ reason: source });

      if (!result.success) {
        console.error(`[Glassline] Session completion failed: ${result.error}`);
        this.completionRequested = false;

        return;
      }

      this.lastResults = this.sessionManager.getLastResults();
      this.flowManager?.navigate({ target: "results", reason: "complete" });
      this.syncInputContext();
      this.syncPlayerState();
    } finally {
      this.busy = false;
    }
  }

  private async startGameplay(mode: GameplayMode): Promise<void> {
    if (this.busy) {
      return;
    }

    const flow = this.flowManager?.getState();

    if (flow !== "main-menu" && flow !== "results" && flow !== "error") {
      return;
    }

    this.busy = true;

    try {
      if (this.sessionManager?.getActiveSession()) {
        await this.sessionManager.abandonSession("player");
      }

      this.lastResults = null;

      if (this.flowManager?.getState() === "error") {
        this.flowManager.navigate({ target: "main-menu", reason: "return-to-menu" });
      }

      const navigated = this.flowManager?.navigate({ target: "loading", reason: "start-gameplay" });

      if (!navigated?.success) {
        return;
      }

      this.syncInputContext();

      const levelId = mode === "training" ? TRAINING_LEVEL_ID : PROLOGUE_LEVEL_ID;
      const result = await this.sessionManager?.startSession({
        mode,
        levelId,
        source: "main_menu",
      });

      if (!result?.success) {
        console.error(`[Glassline] Session start failed: ${result?.error ?? "unknown"}`);
        this.flowManager?.navigate({ target: "error", reason: "error" });

        return;
      }

      this.currentMode = mode;
      this.completionRequested = false;
      this.flowManager?.navigate({ target: "gameplay", reason: "gameplay-ready" });
      this.syncInputContext();
    } finally {
      this.busy = false;
    }
  }

  private async pauseGameplay(): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;

    try {
      const result = await this.sessionManager?.pauseSession("player");

      if (result?.success) {
        this.flowManager?.navigate({ target: "paused", reason: "pause" });
        this.syncInputContext();
      }
    } finally {
      this.busy = false;
    }
  }

  private async resumeGameplay(): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;

    try {
      const result = await this.sessionManager?.resumeSession();

      if (result?.success) {
        this.flowManager?.navigate({ target: "gameplay", reason: "resume" });
        this.syncInputContext();
      }
    } finally {
      this.busy = false;
    }
  }

  private async restartGameplay(): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;

    try {
      const fromResults = this.flowManager?.getState() === "results";

      if (fromResults) {
        this.flowManager?.navigate({ target: "loading", reason: "restart" });
      }

      const result = await this.sessionManager?.restartSession();

      if (!result?.success) {
        console.error(`[Glassline] Session restart failed: ${result?.error ?? "unknown"}`);
        this.flowManager?.navigate({ target: "error", reason: "error" });

        return;
      }

      this.currentMode = result.session?.mode ?? this.currentMode;
      this.completionRequested = false;
      this.flowManager?.navigate({ target: "gameplay", reason: "restart" });
      this.syncInputContext();
    } finally {
      this.busy = false;
    }
  }

  private async returnToMenu(): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;

    try {
      if (this.sessionManager?.getActiveSession()) {
        await this.sessionManager.abandonSession("return-to-menu");
      }

      this.flowManager?.navigate({ target: "main-menu", reason: "return-to-menu" });
      this.lastResults = null;
      this.syncInputContext();
    } finally {
      this.busy = false;
    }
  }

  private syncInputContext(): void {
    const flow = this.flowManager?.getState() ?? "main-menu";
    const context: InputContext =
      flow === "gameplay"
        ? "gameplay"
        : flow === "paused"
          ? "pause-menu"
          : flow === "results"
            ? "results"
            : "main-menu";

    this.input?.setContext(context);
    this.input?.setEnabled(flow === "gameplay");
  }

  private syncInteractionPresentation(): void {
    const interaction = this.interactionSystem;
    const levelRuntime = this.levelRuntime;

    if (!interaction || !levelRuntime) {
      return;
    }

    const activeSectionId = levelRuntime.getActiveSectionId();

    for (const target of levelRuntime.getInteractionTargets()) {
      interaction.setTargetEnabled(
        target.id,
        target.enabled !== false && target.sectionId === activeSectionId,
      );
    }
  }

  private syncPlayerState(): void {
    if (this.player && this.playerState) {
      this.playerState.updateFromMovement(this.player.getMovementSnapshot(), performance.now());
    }
  }

  private async initializeSettingsApplication(): Promise<void> {
    if (!this.settingsManager) {
      return;
    }

    const pipeline = new SettingsApplicationPipeline();

    if (this.audioManager) {
      pipeline.register(new AudioSettingsAdapter(this.audioManager));
    }

    if (this.cameraSystem) {
      pipeline.register(new CameraSettingsAdapter(this.cameraSystem));
      pipeline.register(new ControlsSettingsAdapter(this.cameraSystem));
    }

    this.settingsPipeline = pipeline;
    await pipeline.apply(this.settingsManager.getSnapshot());

    this.settingsUnsubscribe = this.settingsManager.subscribe((snapshot) => {
      void this.handleSettingsChange(snapshot);
    });
  }

  private async handleSettingsChange(snapshot: SettingsSnapshot): Promise<void> {
    await this.settingsPipeline?.apply(snapshot);

    const language = readStringValue(snapshot.values, "general.language", DEFAULT_LANGUAGE_ID);
    const localization = this.localizationManager;

    if (!localization || language === localization.activeLanguage.id) {
      return;
    }

    const result = await localization.setLanguage(language);

    if (!result.changed) {
      console.warn(`[Glassline] Language "${language}" could not be applied: ${result.error}`);
    }
  }

  private initializeGameLoop(): void {
    this.gameLoop = new GameLoop(this.config.gameLoop, {
      onFrameStart: (timestampMs) => {
        this.input?.updateFrame(timestampMs);
      },
      onFixedUpdate: (fixedDeltaSeconds) => {
        this.fixedUpdate(fixedDeltaSeconds);
      },
      onRender: (alpha, frameDeltaSeconds) => {
        this.renderFrame(alpha, frameDeltaSeconds);
      },
    });
  }

  private settlePlayer(steps = 20): void {
    const idleSample: MovementInputSample = {
      move: { x: 0, y: 0 },
      jumpPressed: false,
      jumpHeld: false,
      sprintHeld: false,
      crouchHeld: false,
      interactPressed: false,
    };
    const fixedDelta = 1 / this.config.gameLoop.physicsHz;

    for (let step = 0; step < steps; step += 1) {
      this.player?.fixedUpdate(idleSample, this.cameraSystem?.viewYaw ?? 0, fixedDelta);
      this.physics?.step();
    }

    this.syncPlayerState();
  }

  private fixedUpdate(fixedDeltaSeconds: number): void {
    if (!this.sessionManager?.isRunning()) {
      return;
    }

    if (this.respawnManager?.isRespawning) {
      this.respawnManager.update(fixedDeltaSeconds);
      this.physics?.step();
      this.syncPlayerState();

      return;
    }

    const frame = this.input?.currentFrame ?? IDLE_INPUT_FRAME;

    this.player?.fixedUpdate(
      this.toMovementSample(frame),
      this.cameraSystem?.viewYaw ?? 0,
      fixedDeltaSeconds,
    );

    this.updateInteraction(frame);

    const playerPosition = this.player?.getPosition();
    const nowMs = performance.now();

    if (playerPosition) {
      this.levelRuntime?.update(playerPosition, nowMs);

      if (this.trainingSystem) {
        this.trainingSystem.update(
          {
            position: playerPosition,
            speed: this.player?.getMovementSnapshot().speed ?? 0,
          },
          nowMs,
        );
      }
    }

    this.physics?.step();
    this.syncPlayerState();
  }

  private updateInteraction(frame: InputFrame): void {
    const player = this.player;
    const camera = this.cameraSystem;
    const interaction = this.interactionSystem;

    if (!player || !camera || !interaction) {
      return;
    }

    const eyePosition = player.getEyePosition(this.config.movement.standingEyeHeight);

    interaction.update(eyePosition, camera.getLookDirection(), performance.now());

    if (frame.buttons.Interact.pressed && player.getState() !== "VAULTING") {
      const result = interaction.tryInteract(true, performance.now());

      if (result.executed) {
        console.info(`[Glassline] Interaction executed: ${result.targetId}`);
      }
    }
  }

  private hasLineOfSight(from: Vector3Like, to: Vector3Like): boolean {
    if (!this.physics) {
      return true;
    }

    const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const length = Math.hypot(delta.x, delta.y, delta.z);

    if (length < 1e-6) {
      return true;
    }

    const hit = this.physics.castRay(from, to, { ignoreKinematic: true });

    if (!hit) {
      return true;
    }

    return hit.distance >= length - 0.4;
  }

  private renderFrame(alpha: number, frameDeltaSeconds: number): void {
    if (this.cameraSystem && this.player) {
      this.cameraSystem.renderUpdate({
        frame: this.input?.currentFrame ?? IDLE_INPUT_FRAME,
        movement: this.player.getMovementSnapshot(),
        playerPosition: this.player.getInterpolatedPosition(alpha),
        deltaSeconds: frameDeltaSeconds,
      });
    }

    if (this.renderer && this.renderScene && this.cameraSystem) {
      this.renderer.render(this.renderScene.scene, this.cameraSystem.camera);
    }

    this.updateStatus();
  }

  private toMovementSample(frame: InputFrame): MovementInputSample {
    return {
      move: frame.move,
      jumpPressed: frame.buttons.Jump.pressed,
      jumpHeld: frame.buttons.Jump.held,
      sprintHeld: frame.buttons.Sprint.held,
      crouchHeld: frame.buttons.Crouch.held,
      interactPressed: frame.buttons.Interact.pressed,
    };
  }

  private updateStatus(): void {
    const nowMs = performance.now();

    if (this.statusWindowStartMs === 0) {
      this.statusWindowStartMs = nowMs;
      this.statusFrameCount = 0;
      this.statusOverlay?.update(this.buildStatusLines(), nowMs);
    }

    this.statusFrameCount += 1;

    const elapsedMs = nowMs - this.statusWindowStartMs;

    if (elapsedMs < STATUS_WINDOW_MS) {
      return;
    }

    this.displayedFps = (this.statusFrameCount * 1000) / elapsedMs;

    const totalPhysicsSteps = this.gameLoop?.getStats().physicsStepCount ?? 0;
    const physicsSteps = totalPhysicsSteps - this.lastPhysicsStepCount;

    this.displayedFixedHz = (physicsSteps * 1000) / elapsedMs;
    this.lastPhysicsStepCount = totalPhysicsSteps;
    this.statusFrameCount = 0;
    this.statusWindowStartMs = nowMs;

    this.statusOverlay?.update(this.buildStatusLines(), nowMs);
  }

  private describeSettings(): string {
    const manager = this.settingsManager;

    if (!manager) {
      return "unavailable";
    }

    return `rev ${manager.getSnapshot().revision} (${manager.getPersistenceStatus()})`;
  }

  private buildStatusLines(): string[] {
    const flow = this.flowManager?.getState() ?? "boot";
    const frame = this.input?.currentFrame;
    const gameLoopStats = this.gameLoop?.getStats();
    const dropped = gameLoopStats ? gameLoopStats.droppedTimeSeconds.toFixed(3) : "0.000";
    const pointerLock = this.input?.isPointerLocked ? "locked" : "released";
    const droppedLine = `fps ${this.displayedFps.toFixed(1)} · fixed ${this.displayedFixedHz.toFixed(1)} Hz · dropped ${dropped}s`;

    const lines: string[] = [
      `${this.config.appName} ${this.config.appVersion} · phase ${this.state} · flow ${flow}`,
      droppedLine,
      `renderer ${this.renderer?.backendDescription ?? "not initialized"} · input ${this.input?.activeContext ?? "n/a"} · pointer ${pointerLock}`,
      `settings ${this.describeSettings()} · language ${this.localizationManager?.activeLanguage.id ?? "n/a"} · audio ${this.audioManager?.state ?? "unavailable"} · storage ${this.storageStatus} · localization ${this.localizationStatus}`,
      this.buildSessionStatusLine(),
      this.buildLevelStatusLine(),
      this.buildModeStatusLine(),
      this.buildPlayerStatusLine(frame),
    ];

    if (this.lastResults) {
      lines.push(this.buildResultsLine());
    }

    lines.push(this.buildKeyHints(flow));

    return lines;
  }

  private buildSessionStatusLine(): string {
    const session = this.sessionManager?.getActiveSession();
    const execution = this.sessionManager?.getSnapshot().execution;

    if (!session) {
      return "session none · waiting in main menu";
    }

    return `session ${session.id} · ${session.mode} · ${session.status} · generation ${execution?.generation ?? 0} · level ${session.levelId}`;
  }

  private buildLevelStatusLine(): string {
    const snapshot = this.levelRuntime?.getSnapshot();

    if (!snapshot?.levelId) {
      return "level not loaded";
    }

    const surface = this.player ? this.getPlayerSurfaceLabel() : "n/a";

    return `level ${snapshot.levelId} · ${snapshot.sessionState ?? "no session"} · section ${snapshot.activeSectionId ?? "none"} · objects ${snapshot.objectCount} · triggers ${snapshot.activeTriggerCount}/${snapshot.triggerCount} · underfoot ${surface}`;
  }

  private buildModeStatusLine(): string {
    if (this.trainingSystem) {
      const snapshot = this.trainingSystem.getSnapshot();
      const exercise = snapshot.currentExercise;
      const objective = snapshot.currentObjective;
      const title = exercise?.definition.title ?? "none";

      return `training ${snapshot.completedExercises}/${snapshot.exerciseCount} · "${title}" · objective ${objective?.objectiveId ?? "none"} ${objective ? `${objective.currentValue}/${objective.targetValue}` : ""}`;
    }

    if (this.speedrunSystem) {
      const snapshot = this.speedrunSystem.getSnapshot();

      return `speedrun ${snapshot.state} · ${formatRunTime(snapshot.elapsedTimeMs)} · checkpoints ${snapshot.checkpointsCompleted}/${snapshot.requiredCheckpoints} · splits ${snapshot.splits.length} · medal ${snapshot.result?.medal ?? "pending"}`;
    }

    if (this.currentMode === "prologue") {
      return "prologue · checkpoints and finish route active";
    }

    return "mode none · T Training · P Prologue · O Ranked Prologue";
  }

  private buildPlayerStatusLine(frame: InputFrame | undefined): string {
    const movement = this.player?.getMovementSnapshot();

    if (!movement) {
      return "player not spawned · press T/P/O to start a session";
    }

    const move = frame
      ? `(${frame.move.x.toFixed(2)}, ${frame.move.y.toFixed(2)})`
      : "(0.00, 0.00)";

    return `player ${movement.state} · speed ${movement.speed.toFixed(2)} m/s · grounded ${movement.grounded ? "yes" : "no"} · stance ${movement.stance} · input ${move} · checkpoint ${this.checkpointSystem?.getActiveCheckpointId() ?? "none"} · respawn ${this.respawnManager?.currentState ?? "idle"}`;
  }

  private buildResultsLine(): string {
    const results = this.lastResults;

    if (!results) {
      return "results none";
    }

    const training = results.training
      ? `training ${results.training.exercises.filter((exercise) => exercise.completed).length}/${results.training.exercises.length}`
      : "";
    const speedrun = results.speedrun
      ? `speedrun ${formatRunTime(results.speedrun.totalTimeMs)} · ${results.speedrun.medal} · ${results.speedrun.validation.valid ? "valid" : "invalid"}`
      : "";

    return `RESULTS ${results.mode} · ${(results.durationMs / 1000).toFixed(2)}s ${training} ${speedrun}`.trim();
  }

  private getPlayerSurfaceLabel(): string {
    const player = this.player;

    if (!player) {
      return "n/a";
    }

    const surface = this.levelRuntime?.getSurfaceAt(player.getFeetPosition());

    return surface ? surface.definition.surfaceType : "none";
  }

  private buildKeyHints(flow: GameplayFlowState): string {
    if (flow === "main-menu") {
      return "T Training · P Prologue · O Ranked Prologue · click canvas to enable audio";
    }

    if (flow === "loading") {
      return "loading…";
    }

    if (flow === "gameplay") {
      return "WASD move · Space jump · Ctrl crouch/slide · Shift sprint · E vault/interact · Esc pause · R restart · Q abandon";
    }

    if (flow === "paused") {
      return "PAUSED · Esc resume · R restart · Q abandon";
    }

    if (flow === "results") {
      return "RESULTS · R retry · Q/Esc return to menu";
    }

    if (flow === "error") {
      return "ERROR · Q return to menu";
    }

    return "starting…";
  }

  private registerWindowHandlers(): void {
    const onResize = (): void => this.handleResize();

    window.addEventListener("resize", onResize);
    this.resizeCleanup = () => window.removeEventListener("resize", onResize);

    const onVisibilityChange = (): void => {
      if (document.hidden) {
        this.input?.releaseHeldInput();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    this.visibilityCleanup = () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  private registerDevKeys(): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || this.busy) {
        return;
      }

      const flow = this.flowManager?.getState() ?? "boot";
      const key = event.code;

      if (import.meta.env.DEV && key === "F2" && flow === "gameplay" && !this.completionRequested) {
        event.preventDefault();
        void this.completeGameplay("debug-complete");

        return;
      }

      if (key === "KeyT" && (flow === "main-menu" || flow === "results" || flow === "error")) {
        event.preventDefault();
        void this.startGameplay("training");

        return;
      }

      if (key === "KeyP" && (flow === "main-menu" || flow === "results" || flow === "error")) {
        event.preventDefault();
        void this.startGameplay("prologue");

        return;
      }

      if (key === "KeyO" && (flow === "main-menu" || flow === "results" || flow === "error")) {
        event.preventDefault();
        void this.startGameplay("speedrun");

        return;
      }

      if (key === "Escape") {
        if (flow === "gameplay") {
          void this.pauseGameplay();
        } else if (flow === "paused") {
          void this.resumeGameplay();
        } else if (flow === "results") {
          void this.returnToMenu();
        }

        return;
      }

      if (key === "KeyR") {
        if (flow === "gameplay" || flow === "paused" || flow === "results") {
          event.preventDefault();
          void this.restartGameplay();
        }

        return;
      }

      if (key === "KeyQ") {
        if (flow === "gameplay" || flow === "paused" || flow === "results" || flow === "error") {
          event.preventDefault();
          void this.returnToMenu();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    this.devKeyCleanup = () => window.removeEventListener("keydown", onKeyDown);
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer?.resize(width, height);
    this.cameraSystem?.resize(width, height);
  }

  private resetStatusWindow(): void {
    this.statusWindowStartMs = 0;
    this.statusFrameCount = 0;
    this.lastPhysicsStepCount = this.gameLoop?.getStats().physicsStepCount ?? 0;
  }

  private resolveCanvas(): HTMLCanvasElement {
    const element = document.getElementById(this.config.canvasId);

    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error(`Canvas element "#${this.config.canvasId}" was not found.`);
    }

    return element;
  }

  private releaseResources(): void {
    this.gameLoop?.stop();
    this.gameLoop = null;

    if (this.devKeyCleanup) {
      this.devKeyCleanup();
      this.devKeyCleanup = null;
    }

    if (this.resizeCleanup) {
      this.resizeCleanup();
      this.resizeCleanup = null;
    }

    if (this.visibilityCleanup) {
      this.visibilityCleanup();
      this.visibilityCleanup = null;
    }

    for (const unsubscribe of this.sessionUnsubscribes) {
      unsubscribe();
    }

    this.sessionUnsubscribes.length = 0;

    disposeAll(this.sessionDisposables);
    this.sessionDisposables.length = 0;

    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = null;
    this.settingsManager?.dispose();
    this.settingsManager = null;
    this.settingsPipeline = null;

    this.localizationManager?.dispose();
    this.localizationManager = null;

    this.resourceLoader?.cancelAll();
    this.resourceLoader = null;

    this.audioManager = null;
    this.cameraSystem = null;
    this.player = null;
    this.playerState = null;
    this.checkpointSystem = null;
    this.interactionSystem = null;
    this.respawnManager = null;
    this.trainingSystem = null;
    this.speedrunSystem = null;
    this.lastResults = null;
    this.flowManager = null;
    this.sessionManager = null;
    this.levelRuntime = null;

    disposeAll(this.resources);
    this.resources.length = 0;

    this.canvas = null;
    this.statusOverlay = null;
    this.renderer = null;
    this.renderScene = null;
    this.physics = null;
    this.input = null;
    this.database = null;
  }
}

// Keep the lifecycle type visible for diagnostics and future UI adapters.
