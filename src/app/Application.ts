import { AudioManager } from "../audio/AudioManager";
import { CameraSystem } from "../camera/CameraSystem";
import { type CheckpointDefinition, CheckpointSystem } from "../checkpoint/CheckpointSystem";
import { type Disposable, disposeAll } from "../core/Disposable";
import { GameLoop } from "../core/GameLoop";
import { StatusOverlay } from "../diagnostics/StatusOverlay";
import { InputManager } from "../input/InputManager";
import { IDLE_INPUT_FRAME, type InputFrame } from "../input/InputState";
import { InteractionSystem } from "../interaction/InteractionSystem";
import { LevelRuntimeManager } from "../levels/LevelRuntimeManager";
import {
  TRAINING_TEST_LEVEL_DEFINITIONS,
  TRAINING_TEST_LEVEL_ID,
} from "../levels/test/TrainingTestLevel";
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
import { AudioSettingsAdapter } from "../settings/adapters/AudioSettingsAdapter";
import { CameraSettingsAdapter } from "../settings/adapters/CameraSettingsAdapter";
import { ControlsSettingsAdapter } from "../settings/adapters/ControlsSettingsAdapter";
import { SettingsApplicationPipeline } from "../settings/SettingsApplication";
import { SETTING_DEFINITIONS } from "../settings/SettingsDefinitions";
import { SettingsManager } from "../settings/SettingsManager";
import { readStringValue, type SettingsSnapshot } from "../settings/SettingsTypes";
import type { Vector3Like } from "../shared/math";
import { Database, StorageError } from "../storage/Database";
import { SettingsRepository } from "../storage/repositories/SettingsRepository";
import { type ApplicationConfig, DEFAULT_APPLICATION_CONFIG } from "./ApplicationConfig";

export type ApplicationState = "idle" | "initializing" | "ready" | "running" | "stopped" | "failed";

const STATUS_WINDOW_MS = 500;

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

/**
 * Composition root.
 *
 * Creates and connects core services in the documented startup order
 * (`docs/02_TECHNICAL_ARCHITECTURE.md` §5), loads the level through the Level
 * Runtime, owns the game loop, and coordinates shutdown. It contains no gameplay
 * implementation.
 */
export class Application implements Disposable {
  private readonly config: ApplicationConfig;
  private readonly resources: Disposable[] = [];

  private state: ApplicationState = "idle";
  private disposed = false;

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
  private player: PlayerSystem | null = null;
  private playerState: PlayerStateSystem | null = null;
  private levelRuntime: LevelRuntimeManager | null = null;
  private checkpointSystem: CheckpointSystem | null = null;
  private interactionSystem: InteractionSystem | null = null;
  private respawnManager: RespawnManager | null = null;
  private levelEventUnsubscribes: (() => void)[] = [];

  private storageStatus = "not initialized";
  private localizationStatus = "not initialized";
  private resizeCleanup: (() => void) | null = null;
  private visibilityCleanup: (() => void) | null = null;

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

      // Recoverable: the application must remain usable without persistence.
      await this.initializeStorage();
      await this.initializeSettings();
      await this.initializeLocalization();

      this.initializeRendering();

      // Fatal: the application requires a working renderer, physics, and level.
      await this.initializePhysics();
      await this.initializeLevelRuntime();
      this.initializePlayer();
      this.initializeCamera();
      this.initializeInput();
      this.initializeAudio();
      this.initializeTraversalSystems();
      await this.initializeSettingsApplication();
      this.initializeGameLoop();
      this.registerWindowHandlers();
      this.handleResize();
      this.resetStatusWindow();

      await this.levelRuntime?.startSession();
      this.syncInteractionPresentation();

      this.player?.activate();
      this.playerState?.activate();
      this.settlePlayer();

      this.state = "ready";
    } catch (error) {
      this.state = "failed";
      const details = describeError(error);

      this.releaseResources();

      // Recreate the overlay after disposal so the fatal state remains visible.
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

  private async initializeLevelRuntime(): Promise<void> {
    if (!this.renderScene || !this.physics) {
      throw new Error("Level Runtime requires initialized rendering and physics.");
    }

    this.levelRuntime = new LevelRuntimeManager({
      scene: this.renderScene,
      physics: this.physics,
      definitions: TRAINING_TEST_LEVEL_DEFINITIONS,
    });
    this.resources.push(this.levelRuntime);

    await this.levelRuntime.loadLevel(TRAINING_TEST_LEVEL_ID);
  }

  private initializePlayer(): void {
    if (!this.physics) {
      throw new Error("Player requires an initialized physics world.");
    }

    const initialSpawn = this.levelRuntime?.getInitialSpawnPoint();

    if (!initialSpawn) {
      throw new Error("Level Runtime did not resolve an initial spawn point.");
    }

    const tuning = this.config.movement;
    const spawnPoint = {
      x: initialSpawn.position.x,
      y: initialSpawn.position.y,
      z: initialSpawn.position.z,
    };

    this.playerState = new PlayerStateSystem();
    this.resources.push(this.playerState);

    this.player = new PlayerSystem(this.physics, { tuning, spawnPoint });
    this.resources.push(this.player);

    this.playerState.updateFromMovement(this.player.getMovementSnapshot(), performance.now());
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
        if (this.statusOverlay) {
          this.statusOverlay.update(this.buildStatusLines(), performance.now());
        }

        console.info(`[Glassline] Pointer lock ${locked ? "acquired" : "released"}.`);
      },
    });
    this.resources.push(this.input);
  }

  private initializeAudio(): void {
    this.audioManager = new AudioManager();
    this.audioManager.initialize();
    this.resources.push(this.audioManager);
  }

  private initializeTraversalSystems(): void {
    const levelRuntime = this.levelRuntime;
    const level = levelRuntime?.getCurrentLevel();
    const session = levelRuntime?.getCurrentSession();
    const player = this.player;
    const camera = this.cameraSystem;
    const input = this.input;
    const physics = this.physics;

    if (!levelRuntime || !level || !session || !player || !camera || !input || !physics) {
      throw new Error(
        "Traversal systems require the loaded level, player, camera, input, and physics.",
      );
    }

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
      sessionId: session.id,
      spawnResolver: {
        resolve: (spawnPointId: string) => {
          const spawnPoint = this.levelRuntime?.resolveSpawnPoint(spawnPointId);

          if (!spawnPoint) {
            return null;
          }

          return { position: spawnPoint.position, rotationY: spawnPoint.rotationY };
        },
      },
    });
    this.resources.push(this.checkpointSystem);

    this.interactionSystem = new InteractionSystem(levelRuntime.getInteractionTargets(), {
      lineOfSight: (eyePosition, target) => this.hasLineOfSight(eyePosition, target.position),
    });
    this.resources.push(this.interactionSystem);

    const initialSpawn = levelRuntime.getInitialSpawnPoint();

    if (!initialSpawn) {
      throw new Error("Level Runtime did not resolve an initial spawn point for respawn fallback.");
    }

    this.respawnManager = new RespawnManager(
      {
        checkpoints: this.checkpointSystem,
        player,
        camera,
        input,
      },
      {
        fallbackSpawn: initialSpawn.position,
        fallbackRotationY: initialSpawn.rotationY,
      },
    );
    this.resources.push(this.respawnManager);

    this.subscribeLevelRuntimeEvents();
  }

  private subscribeLevelRuntimeEvents(): void {
    const levelRuntime = this.levelRuntime;

    if (!levelRuntime) {
      return;
    }

    this.levelEventUnsubscribes.push(
      levelRuntime.on("trigger:enter", (event) => {
        const checkpointId = event.metadata?.checkpointId;

        if (checkpointId) {
          const activation = this.checkpointSystem?.notifyTriggerEnter(
            checkpointId,
            event.timestamp,
          );

          if (activation) {
            console.info(`[Glassline] Checkpoint activated: ${activation.checkpointId}`);
          }

          return;
        }

        if (event.metadata?.kind === "kill-volume") {
          this.respawnManager?.request("fall");
        }
      }),
    );

    this.levelEventUnsubscribes.push(
      levelRuntime.on("section:activated", (event) => {
        console.info(`[Glassline] Section activated: ${event.sectionId}`);
        this.syncInteractionPresentation();
      }),
    );

    this.levelEventUnsubscribes.push(
      levelRuntime.on("level:failed", (event) => {
        console.error("[Glassline] Level Runtime failed.", event.error);
      }),
    );
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

  /** Runs a few fixed steps so the player is grounded before the first frame. */
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

    if (this.player && this.playerState) {
      this.playerState.updateFromMovement(this.player.getMovementSnapshot(), performance.now());
    }
  }

  private fixedUpdate(fixedDeltaSeconds: number): void {
    const frame = this.input?.currentFrame ?? IDLE_INPUT_FRAME;
    const respawn = this.respawnManager;

    if (respawn?.isRespawning) {
      respawn.update(fixedDeltaSeconds);
      this.physics?.step();

      if (this.player && this.playerState) {
        this.playerState.updateFromMovement(this.player.getMovementSnapshot(), performance.now());
      }

      return;
    }

    this.player?.fixedUpdate(
      this.toMovementSample(frame),
      this.cameraSystem?.viewYaw ?? 0,
      fixedDeltaSeconds,
    );

    this.updateInteraction(frame);

    const playerPosition = this.player?.getPosition();

    if (playerPosition) {
      this.levelRuntime?.update(playerPosition, performance.now());
    }

    this.physics?.step();

    if (this.player && this.playerState) {
      this.playerState.updateFromMovement(this.player.getMovementSnapshot(), performance.now());
    }
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

    // A hit close to the target is the target itself (or its host collider).
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
      // Paint once immediately so startup state is visible before rates settle.
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
    const frame = this.input?.currentFrame;
    const movement = this.player?.getMovementSnapshot();
    const gameLoopStats = this.gameLoop?.getStats();

    const move = frame
      ? `(${frame.move.x.toFixed(2)}, ${frame.move.y.toFixed(2)})`
      : "(0.00, 0.00)";
    const look = frame
      ? `(${frame.lookMouse.x.toFixed(1)}, ${frame.lookMouse.y.toFixed(1)})`
      : "(0.0, 0.0)";
    const pointerLock = this.input?.isPointerLocked ? "locked" : "released (click to capture)";
    const context = this.input?.activeContext ?? "gameplay";
    const dropped = gameLoopStats ? gameLoopStats.droppedTimeSeconds.toFixed(3) : "0.000";
    const player = movement
      ? `player ${movement.state} · speed ${movement.speed.toFixed(2)} m/s · vertical ${movement.verticalSpeed.toFixed(2)} · grounded ${movement.grounded ? "yes" : "no"} · stance ${movement.stance}`
      : "player not initialized";

    return [
      `${this.config.appName} ${this.config.appVersion} · phase ${this.state}`,
      `fps ${this.displayedFps.toFixed(1)} · fixed ${this.displayedFixedHz.toFixed(1)} Hz · dropped ${dropped}s`,
      `renderer ${this.renderer?.backendDescription ?? "not initialized"}`,
      `physics Rapier · gravity ${this.config.physics.gravity.y.toFixed(2)} · storage ${this.storageStatus}`,
      `settings ${this.describeSettings()} · language ${this.localizationManager?.activeLanguage.id ?? "n/a"} · audio ${this.audioManager?.state ?? "unavailable"}`,
      `localization ${this.localizationStatus} · resources ${this.resourceLoader?.activeCount ?? 0} active`,
      `input ${context} · pointer lock ${pointerLock} · move ${move} · look ${look}`,
      player,
      this.buildLevelStatusLine(),
      this.buildTraversalStatusLine(),
      "WASD move · Space jump · Ctrl crouch/slide · Shift sprint · E vault/interact · click to capture mouse · Esc pause",
    ];
  }

  private buildLevelStatusLine(): string {
    const runtime = this.levelRuntime?.getSnapshot();

    if (!runtime) {
      return "level not initialized";
    }

    const surface = this.player ? this.getPlayerSurfaceLabel() : "n/a";

    return `level ${runtime.levelId ?? "none"} · ${runtime.sessionState ?? "no session"} · section ${runtime.activeSectionId ?? "none"} · objects ${runtime.objectCount} · triggers ${runtime.activeTriggerCount}/${runtime.triggerCount} · surfaces ${runtime.activeSurfaceCount}/${runtime.objectSurfaceCount} · underfoot ${surface}`;
  }

  private getPlayerSurfaceLabel(): string {
    const player = this.player;

    if (!player) {
      return "n/a";
    }

    const feet = player.getFeetPosition();
    const surface = this.levelRuntime?.getSurfaceAt(feet);

    if (!surface) {
      return "none";
    }

    return `${surface.definition.surfaceType}${surface.definition.walkable ? "/walkable" : ""}`;
  }

  private buildTraversalStatusLine(): string {
    const checkpoint = this.checkpointSystem?.getActiveCheckpointId() ?? "none";
    const interaction = this.interactionSystem?.getSnapshot().prompt ?? "none";
    const respawn = this.respawnManager?.currentState ?? "idle";

    return `traversal checkpoint ${checkpoint} · interaction ${interaction} · respawn ${respawn}`;
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

    for (const unsubscribe of this.levelEventUnsubscribes) {
      unsubscribe();
    }

    this.levelEventUnsubscribes = [];
    this.levelRuntime = null;

    if (this.resizeCleanup) {
      this.resizeCleanup();
      this.resizeCleanup = null;
    }

    if (this.visibilityCleanup) {
      this.visibilityCleanup();
      this.visibilityCleanup = null;
    }

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
