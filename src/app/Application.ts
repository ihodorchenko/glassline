import { GameLoop } from "../core/GameLoop";
import { disposeAll, type Disposable } from "../core/Disposable";
import { PhysicsDebugSandbox } from "../debug/PhysicsDebugSandbox";
import { StatusOverlay } from "../diagnostics/StatusOverlay";
import { InputManager } from "../input/InputManager";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { Renderer } from "../rendering/Renderer";
import { RenderScene } from "../rendering/RenderScene";
import { Database, StorageError } from "../storage/Database";
import { SettingsRepository } from "../storage/repositories/SettingsRepository";
import { DEFAULT_APPLICATION_CONFIG, type ApplicationConfig } from "./ApplicationConfig";

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
 * (`docs/02_TECHNICAL_ARCHITECTURE.md` §5), owns the game loop, and coordinates
 * shutdown. It contains no gameplay implementation.
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
  private debugSandbox: PhysicsDebugSandbox | null = null;
  private gameLoop: GameLoop | null = null;

  private storageStatus = "not initialized";
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

      this.initializeRendering();

      // Fatal: the application requires a working renderer and physics world.
      await this.initializePhysics();
      this.initializeInput();
      this.initializeDebugSandbox();
      this.initializeGameLoop();
      this.registerWindowHandlers();
      this.handleResize();
      this.resetStatusWindow();

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

      const settingsRepository = new SettingsRepository(database);
      const settings = await settingsRepository.load();

      this.storageStatus = settings
        ? `ready (schema ${settings.schemaVersion}, revision ${settings.revision})`
        : "ready (no saved data)";
    } catch (error) {
      this.database = null;
      this.storageStatus = `unavailable (${error instanceof StorageError ? error.code : "unknown"})`;

      console.warn(
        "[Glassline] Persistence is unavailable; continuing without saved data.",
        error,
      );
    }
  }

  private initializeRendering(): void {
    if (!this.canvas) {
      throw new Error("Canvas is not available.");
    }

    this.renderer = new Renderer(this.canvas, this.config.renderer);
    this.resources.push(this.renderer);

    this.renderScene = new RenderScene(this.config.renderScene);
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

  private initializeDebugSandbox(): void {
    if (!this.config.enableDebugSandbox) {
      return;
    }

    if (!this.physics || !this.renderScene) {
      throw new Error("Debug sandbox requires initialized physics and rendering.");
    }

    this.debugSandbox = new PhysicsDebugSandbox(this.physics, this.renderScene);
    this.resources.push(this.debugSandbox);
  }

  private initializeGameLoop(): void {
    this.gameLoop = new GameLoop(this.config.gameLoop, {
      onFrameStart: (timestampMs) => {
        this.input?.updateFrame(timestampMs);
      },
      onFixedUpdate: () => {
        this.physics?.step();
      },
      onRender: (alpha, frameDeltaSeconds) => {
        this.renderFrame(alpha, frameDeltaSeconds);
      },
    });
  }

  private renderFrame(_alpha: number, _frameDeltaSeconds: number): void {
    this.debugSandbox?.syncMesh();

    if (this.renderer && this.renderScene) {
      this.renderer.render(this.renderScene.scene, this.renderScene.camera);
    }

    this.updateStatus();
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

  private buildStatusLines(): string[] {
    const frame = this.input?.currentFrame;
    const gameLoopStats = this.gameLoop?.getStats();

    const move = frame ? `(${frame.move.x.toFixed(2)}, ${frame.move.y.toFixed(2)})` : "(0.00, 0.00)";
    const look = frame
      ? `(${frame.lookMouse.x.toFixed(1)}, ${frame.lookMouse.y.toFixed(1)})`
      : "(0.0, 0.0)";
    const pointerLock = this.input?.isPointerLocked ? "locked" : "released (click to capture)";
    const context = this.input?.activeContext ?? "gameplay";
    const dropped = gameLoopStats ? gameLoopStats.droppedTimeSeconds.toFixed(3) : "0.000";

    return [
      `${this.config.appName} ${this.config.appVersion} · phase ${this.state}`,
      `fps ${this.displayedFps.toFixed(1)} · fixed ${this.displayedFixedHz.toFixed(1)} Hz · dropped ${dropped}s`,
      `renderer ${this.renderer?.backendDescription ?? "not initialized"}`,
      `physics Rapier · gravity ${this.config.physics.gravity.y.toFixed(2)} · storage ${this.storageStatus}`,
      `input ${context} · pointer lock ${pointerLock} · move ${move} · look ${look}`,
      "WASD move · Space jump · Ctrl crouch/slide · Shift sprint · E interact · Esc pause",
    ];
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
    this.visibilityCleanup = () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer?.resize(width, height);
    this.renderScene?.resize(width, height);
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
    this.debugSandbox = null;
  }
}
