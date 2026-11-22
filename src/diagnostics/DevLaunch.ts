import {
  type DevLaunchLevelId,
  type DevLaunchParseResult,
  type DevLaunchRequest,
  describeDevLaunchRoutes,
  parseDevLaunchRequest,
} from "./devLaunchContract";

/**
 * Development-only playable launch runtime (`?dev=first_section`).
 *
 * The module reaches into the existing composition root through a narrow
 * structural interface (TypeScript `private` members do not exist at runtime;
 * `CaptureMode.ts` uses the same pattern) and calls the normal
 * `Application.startGameplay(mode, levelId)` path. Everything after that call is
 * production lifecycle: Gameplay Session → Level Runtime → player, camera,
 * input, checkpoint, respawn, HUD and the game loop. This module owns no
 * gameplay authority, no second runtime, and no additional composition root.
 *
 * Import is dynamic and guarded by `import.meta.env.DEV` in `main.ts`, so the
 * production bundle never loads this module. Both new diagnostics modules are
 * excluded from production builds by that guard.
 */

const READY_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 50;
const FAILURE_BANNER_ID = "glassline-dev-launch-failure";

/* -------------------------------------------------------------------------- */
/* Structural view of the running application (no Application import).        */
/* -------------------------------------------------------------------------- */

interface DevLaunchVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface DevLaunchSession {
  readonly id: string;
  readonly mode: string;
  readonly levelId: string;
  readonly status: string;
}

interface DevLaunchResults {
  readonly mode: string;
  readonly levelId: string;
  readonly status: string;
  readonly durationMs: number;
}

interface SessionManagerLike {
  isRunning(): boolean;
  getActiveSession(): DevLaunchSession | null;
  getLastResults(): DevLaunchResults | null;
  abandonSession(reason: "session-failure"): Promise<{
    readonly success: boolean;
    readonly error?: string;
  }>;
  /**
   * Lifecycle events used only to re-bind the read-only diagnostics listener
   * when the session replaces its respawn manager (restart/reload).
   */
  on?(event: string, listener: () => void): () => void;
}

interface FlowManagerLike {
  getState(): string;
}

interface LevelRuntimeLike {
  getCurrentLevel(): { readonly id: string } | null;
  getCurrentSession(): { readonly state: string } | null;
  getActiveSectionId(): string | null;
  getSnapshot(): { readonly sessionState: string | null };
}

interface PlayerSnapshotLike {
  readonly speed: number;
  readonly state: string;
  readonly grounded: boolean;
  readonly stance: string;
  readonly postureHeight: number;
}

interface PlayerLike {
  getPosition(): DevLaunchVector;
  getMovementSnapshot(): PlayerSnapshotLike;
}

/** Read-only camera facts; `camera` is optional so simple test doubles work. */
interface CameraSystemLike {
  readonly viewYaw: number;
  readonly viewPitch: number;
  readonly camera?: {
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
  } | null;
}

interface InputLike {
  readonly activeContext: string;
  readonly isPointerLocked: boolean;
}

interface CheckpointSystemLike {
  getActiveCheckpointId(): string | null;
  getSnapshot(): { readonly activatedCheckpointIds: readonly string[] };
}

interface RespawnDestinationLike {
  readonly position: DevLaunchVector;
  readonly checkpointId?: string;
  readonly spawnPointId?: string;
}

interface RespawnManagerLike {
  readonly currentState: string;
  getLastDestination(): RespawnDestinationLike | null;
  subscribe(listener: () => void): () => void;
}

interface UILike {
  getActiveScreen(): string | null;
  showError(message: string): void;
}

interface ProgressionLike {
  getSnapshot(): { readonly prologueCompleted: boolean };
}

interface DevLaunchApplication {
  startGameplay(mode: string, levelId?: string): Promise<void>;
  readonly flowManager: FlowManagerLike | null;
  readonly sessionManager: SessionManagerLike | null;
  readonly levelRuntime: LevelRuntimeLike | null;
  readonly player: PlayerLike | null;
  readonly cameraSystem: CameraSystemLike | null;
  readonly input: InputLike | null;
  readonly checkpointSystem: CheckpointSystemLike | null;
  readonly respawnManager: RespawnManagerLike | null;
  readonly ui: UILike | null;
  readonly progressionSystem: ProgressionLike | null;
  readonly currentMode: string | null;
}

/* -------------------------------------------------------------------------- */
/* Public contract                                                            */
/* -------------------------------------------------------------------------- */

export type DevLaunchPhase = "idle" | "launching" | "ready" | "failed";

/** Read-only status for the browser verification harness and QA. */
export interface GlasslineDevLaunchStatus {
  readonly levelId: DevLaunchLevelId;
  readonly levelDefinitionId: string;
  readonly mode: string;
  readonly phase: DevLaunchPhase;
  readonly ready: boolean;
  readonly error: string | null;
  readonly flow: string | null;
  readonly sessionId: string | null;
  readonly sessionStatus: string | null;
  readonly sessionMode: string | null;
  readonly loadedLevelId: string | null;
  readonly levelSessionState: string | null;
  readonly activeSectionId: string | null;
  readonly screen: string | null;
  readonly inputContext: string | null;
  readonly pointerLocked: boolean;
  readonly player: {
    readonly position: DevLaunchVector;
    readonly speed: number;
    readonly state: string;
    readonly grounded: boolean;
    readonly stance: string;
    readonly postureHeight: number;
  } | null;
  readonly camera: {
    readonly yaw: number;
    readonly pitch: number;
    /** World-space eye position; null when the camera double omits it. */
    readonly position: DevLaunchVector | null;
  } | null;
  readonly activeCheckpointId: string | null;
  readonly activatedCheckpointIds: readonly string[];
  readonly respawnState: string;
  readonly respawnCount: number;
  readonly respawnDestination: DevLaunchVector | null;
  readonly results: DevLaunchResults | null;
  readonly prologueCompleted: boolean;
}

/** Contract consumed by the Playwright dev-route harness. */
export interface GlasslineDevLaunchApi {
  readonly ready: boolean;
  readonly levelId: DevLaunchLevelId;
  readonly levelDefinitionId: string;
  readonly mode: string;
  readonly error: string | null;
  status(): GlasslineDevLaunchStatus | null;
}

declare global {
  interface Window {
    __glasslineDevLaunch?: GlasslineDevLaunchApi;
  }
}

/** Browser surface used by the launch runtime; injectable for Node tests. */
export interface DevLaunchHost {
  expose(api: GlasslineDevLaunchApi): void;
  markActive(levelId: DevLaunchLevelId): void;
  log(message: string): void;
  warn(message: string): void;
  error(message: string, details?: unknown): void;
  showFailure(title: string, details: string): void;
}

export interface DevLaunchOptions {
  /** Budget for "flow gameplay + session running + level loaded" (default 20 s). */
  readonly readyTimeoutMs?: number;
  /** Poll interval while waiting for the session (default 50 ms). */
  readonly pollIntervalMs?: number;
}

export interface DevLaunchResult {
  readonly success: boolean;
  readonly error: string | null;
}

export interface DevLaunchHandle {
  readonly request: DevLaunchRequest;
  /** Starts the normal gameplay session and waits until it is actually playable. */
  activate(application: unknown): Promise<DevLaunchResult>;
  /** Releases every diagnostics subscription owned by this launch. */
  dispose(): void;
}

/**
 * Preparation outcome. `launch` must be activated after `application.start()`;
 * `unsupported` has already been reported visibly and starts no session.
 */
export type DevLaunchPreparation =
  | { readonly kind: "none" }
  | { readonly kind: "unsupported"; readonly requested: string }
  | { readonly kind: "launch"; readonly handle: DevLaunchHandle };

interface DevLaunchState {
  app: DevLaunchApplication | null;
  phase: DevLaunchPhase;
  error: string | null;
  disposed: boolean;
  respawnCount: number;
  respawnDestination: DevLaunchVector | null;
  /** Respawn manager the diagnostics listener is currently attached to. */
  boundRespawnManager: RespawnManagerLike | null;
  respawnUnsubscribe: (() => void) | null;
  sessionUnsubscribes: (() => void)[];
}

/* -------------------------------------------------------------------------- */
/* Browser entry point                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Browser entry point used by `main.ts`. Reads `window.location.search`, parses
 * the contract, and (for a supported route) exposes `window.__glasslineDevLaunch`
 * immediately so tooling can distinguish "still launching" from "never loaded".
 */
export function prepareDevLaunch(search = window.location.search): DevLaunchPreparation {
  const preparation = createDevLaunch(search, createBrowserDevLaunchHost());

  // The dev launch is a page-lifetime tool. `pagehide` is the browser's
  // guaranteed teardown signal, so diagnostics never outlive the page.
  if (preparation.kind === "launch" && typeof window !== "undefined") {
    const handle = preparation.handle;

    window.addEventListener("pagehide", () => handle.dispose(), { once: true });
  }

  return preparation;
}

/**
 * Host-independent preparation. `host` isolates DOM/console access so the whole
 * runtime can be exercised by Node unit tests against a fake host.
 */
export function createDevLaunch(
  search: string,
  host: DevLaunchHost,
  options: DevLaunchOptions = {},
): DevLaunchPreparation {
  const parsed: DevLaunchParseResult = parseDevLaunchRequest(search);

  if (parsed.kind === "none") {
    return { kind: "none" };
  }

  if (parsed.kind === "unsupported") {
    const details =
      `"${parsed.requested}" is not a development launch route.\n` +
      `Supported levels: ${describeDevLaunchRoutes()}.\n` +
      "No gameplay session was started; the application boots normally.";

    host.error("[Glassline] Unknown DEV launch level.", details);
    host.showFailure("Unknown dev launch level", details);

    return { kind: "unsupported", requested: parsed.requested };
  }

  const request = parsed.request;
  const state: DevLaunchState = {
    app: null,
    phase: "idle",
    error: null,
    disposed: false,
    respawnCount: 0,
    respawnDestination: null,
    boundRespawnManager: null,
    respawnUnsubscribe: null,
    sessionUnsubscribes: [],
  };
  const api = createDevLaunchApi(request, state);
  const readyTimeoutMs = options.readyTimeoutMs ?? READY_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;

  host.expose(api);

  return {
    kind: "launch",
    handle: {
      request,
      async activate(application: unknown): Promise<DevLaunchResult> {
        return await activateDevLaunch(
          request,
          state,
          host,
          application as DevLaunchApplication,
          readyTimeoutMs,
          pollIntervalMs,
        );
      },
      dispose(): void {
        disposeDevLaunch(state);
      },
    },
  };
}

function createDevLaunchApi(
  request: DevLaunchRequest,
  state: DevLaunchState,
): GlasslineDevLaunchApi {
  return {
    get ready(): boolean {
      return state.phase === "ready";
    },
    levelId: request.levelId,
    levelDefinitionId: request.levelDefinitionId,
    mode: request.mode,
    get error(): string | null {
      return state.error;
    },
    status(): GlasslineDevLaunchStatus | null {
      return buildStatus(request, state);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Launch                                                                     */
/* -------------------------------------------------------------------------- */

async function activateDevLaunch(
  request: DevLaunchRequest,
  state: DevLaunchState,
  host: DevLaunchHost,
  app: DevLaunchApplication,
  readyTimeoutMs: number,
  pollIntervalMs: number,
): Promise<DevLaunchResult> {
  if (state.phase === "ready") {
    return { success: true, error: null };
  }

  state.app = app;
  state.phase = "launching";
  state.error = null;

  host.markActive(request.levelId);
  host.log(
    `DEV launch: starting "${request.label}" as level "${request.levelDefinitionId}" ` +
      `in ${request.mode} mode through the normal gameplay session lifecycle.`,
  );

  try {
    await app.startGameplay(request.mode, request.levelDefinitionId);
  } catch (error) {
    return await failDevLaunch(app, state, host, `startGameplay threw: ${describeError(error)}`);
  }

  const deadline = Date.now() + Math.max(0, readyTimeoutMs);

  while (Date.now() <= deadline) {
    const failure = describeStartFailure(app);

    if (failure !== null) {
      return await failDevLaunch(app, state, host, failure);
    }

    if (isPlayable(app, request)) {
      return succeedDevLaunch(app, state, host, request);
    }

    await delay(pollIntervalMs);
  }

  return await failDevLaunch(
    app,
    state,
    host,
    "Timed out waiting for a playable First Section session " +
      `(${formatLiveState(app, request)}).`,
  );
}

/**
 * True only when the normal lifecycle has actually reached playable gameplay:
 * the flow is on the gameplay screen, the gameplay session is running, the
 * expected level is loaded, the mode matches and no UI screen covers the game.
 */
function isPlayable(app: DevLaunchApplication, request: DevLaunchRequest): boolean {
  if (app.flowManager?.getState() !== "gameplay") {
    return false;
  }

  if (!app.sessionManager?.isRunning()) {
    return false;
  }

  if (app.levelRuntime?.getCurrentLevel()?.id !== request.levelDefinitionId) {
    return false;
  }

  if (app.currentMode !== request.mode) {
    return false;
  }

  return (app.ui?.getActiveScreen() ?? null) === null;
}

/** Fast, explicit failure signal so the launch does not wait out the timeout. */
function describeStartFailure(app: DevLaunchApplication): string | null {
  const flow = app.flowManager?.getState() ?? null;
  const session = app.sessionManager?.getActiveSession() ?? null;

  if (flow === "error") {
    return 'The gameplay session reported an error while starting (flow "error").';
  }

  if (session?.status === "failed") {
    return `The gameplay session "${session.id}" failed while starting.`;
  }

  return null;
}

function succeedDevLaunch(
  app: DevLaunchApplication,
  state: DevLaunchState,
  host: DevLaunchHost,
  request: DevLaunchRequest,
): DevLaunchResult {
  state.phase = "ready";
  state.error = null;

  bindRespawnDiagnostics(state, app);

  const snapshot = buildStatus(request, state);
  const checkpointCount = snapshot?.activatedCheckpointIds.length ?? 0;

  host.log(
    `DEV launch ready: level "${request.levelDefinitionId}" · section ` +
      `"${snapshot?.activeSectionId ?? "none"}" · checkpoints ${checkpointCount} · ` +
      "HUD active. Click the canvas for pointer lock, then use WASD / mouse / Space / " +
      "Shift / X / E. Dev-only route: ?dev=" +
      request.levelId,
  );

  return { success: true, error: null };
}

async function failDevLaunch(
  app: DevLaunchApplication,
  state: DevLaunchState,
  host: DevLaunchHost,
  message: string,
): Promise<DevLaunchResult> {
  state.phase = "failed";
  state.error = message;

  host.error("[Glassline] DEV launch failed.", message);

  releaseDiagnosticsSubscriptions(state);

  const cleanup = await cleanupSession(app, host);
  const details = `${message}\n${cleanup}`;

  host.showFailure("DEV launch failed", details);

  // Reuse the shipped error screen when the UI is available, so the failure is
  // visible over the game and the normal flow owns the presentation.
  app.ui?.showError(`DEV launch failed: ${message}`);

  return { success: false, error: message };
}

/**
 * Abandons a partially started session through the Gameplay Session manager.
 * `abandonSession` runs the same shutdown/unload ports a normal return-to-menu
 * uses and is idempotent for levels, so a failure cannot leave a loaded level or
 * a half-running session behind.
 */
async function cleanupSession(app: DevLaunchApplication, host: DevLaunchHost): Promise<string> {
  const manager = app.sessionManager;
  const session = manager?.getActiveSession() ?? null;

  if (!manager || !session) {
    return "No gameplay session was created.";
  }

  if (session.status === "completed" || session.status === "abandoned") {
    return `Session "${session.id}" is already ${session.status}; nothing to clean up.`;
  }

  try {
    const result = await manager.abandonSession("session-failure");

    if (!result.success) {
      const error = `Session "${session.id}" cleanup failed: ${result.error ?? "unknown error"}.`;
      host.warn(`[Glassline] ${error}`);

      return error;
    }

    host.log(`DEV launch: session "${session.id}" abandoned; no partial session left running.`);

    return `Session "${session.id}" abandoned; no partial session left running.`;
  } catch (error) {
    const details = `Session "${session.id}" cleanup threw: ${describeError(error)}.`;
    host.warn(`[Glassline] ${details}`);

    return details;
  }
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Session events that may replace or release the session-scoped respawn
 * manager. `restartGameplayPort` and `shutdownGameplayPort` run before these
 * events are emitted, so re-reading `app.respawnManager` is always current.
 */
const DIAGNOSTICS_SESSION_EVENTS = [
  "session:started",
  "session:restarted",
  "session:completed",
  "session:abandoned",
  "session:failed",
] as const;

function bindRespawnDiagnostics(state: DevLaunchState, app: DevLaunchApplication): void {
  if (state.disposed) {
    return;
  }

  const session = app.sessionManager;

  for (const unsubscribe of state.sessionUnsubscribes) {
    unsubscribe();
  }

  state.sessionUnsubscribes = [];

  if (session?.on) {
    for (const event of DIAGNOSTICS_SESSION_EVENTS) {
      state.sessionUnsubscribes.push(session.on(event, () => syncRespawnDiagnostics(state, app)));
    }
  }

  syncRespawnDiagnostics(state, app);
}

/**
 * Moves the diagnostics listener from the previous respawn manager to the
 * current one. Unsubscribing first and remembering the bound instance keeps the
 * counter at exactly one listener, so repeated restarts can neither miss a new
 * respawn nor double-count one.
 */
function syncRespawnDiagnostics(state: DevLaunchState, app: DevLaunchApplication): void {
  if (state.disposed) {
    return;
  }

  const manager = app.respawnManager;

  if (state.boundRespawnManager === manager) {
    return;
  }

  state.respawnUnsubscribe?.();
  state.respawnUnsubscribe = null;
  state.boundRespawnManager = manager;

  if (!manager) {
    return;
  }

  state.respawnUnsubscribe = manager.subscribe(() => {
    // A disposed or replaced manager must never keep mutating diagnostics.
    if (state.disposed || state.boundRespawnManager !== manager) {
      return;
    }

    state.respawnCount += 1;
    state.respawnDestination = normalizeDestination(manager.getLastDestination());
  });
}

function releaseDiagnosticsSubscriptions(state: DevLaunchState): void {
  for (const unsubscribe of state.sessionUnsubscribes) {
    unsubscribe();
  }

  state.sessionUnsubscribes = [];
  state.respawnUnsubscribe?.();
  state.respawnUnsubscribe = null;
  state.boundRespawnManager = null;
}

function disposeDevLaunch(state: DevLaunchState): void {
  state.disposed = true;
  releaseDiagnosticsSubscriptions(state);
}

function buildStatus(
  request: DevLaunchRequest,
  state: DevLaunchState,
): GlasslineDevLaunchStatus | null {
  const app = state.app;

  if (!app) {
    return null;
  }

  // Read-only reconcile: diagnostics may be sampled between a manager
  // replacement and its lifecycle event. This is not a per-frame poll.
  syncRespawnDiagnostics(state, app);

  const session = app.sessionManager?.getActiveSession() ?? null;
  const level = app.levelRuntime?.getCurrentLevel() ?? null;
  const levelSession = app.levelRuntime?.getCurrentSession() ?? null;
  const movement = app.player?.getMovementSnapshot() ?? null;
  const position = app.player?.getPosition() ?? null;
  const camera = app.cameraSystem;
  const cameraPosition = camera?.camera?.position ?? null;
  const checkpoint = app.checkpointSystem;
  const respawn = app.respawnManager;
  const results = app.sessionManager?.getLastResults() ?? null;

  return {
    levelId: request.levelId,
    levelDefinitionId: request.levelDefinitionId,
    mode: request.mode,
    phase: state.phase,
    ready: state.phase === "ready",
    error: state.error,
    flow: app.flowManager?.getState() ?? null,
    sessionId: session?.id ?? null,
    sessionStatus: session?.status ?? null,
    sessionMode: session?.mode ?? null,
    loadedLevelId: level?.id ?? null,
    levelSessionState: levelSession?.state ?? app.levelRuntime?.getSnapshot().sessionState ?? null,
    activeSectionId: app.levelRuntime?.getActiveSectionId() ?? null,
    screen: app.ui?.getActiveScreen() ?? null,
    inputContext: app.input?.activeContext ?? null,
    pointerLocked: app.input?.isPointerLocked ?? false,
    player:
      position === null || movement === null
        ? null
        : {
            position: { x: position.x, y: position.y, z: position.z },
            speed: movement.speed,
            state: movement.state,
            grounded: movement.grounded,
            stance: movement.stance,
            postureHeight: movement.postureHeight,
          },
    camera:
      camera === null
        ? null
        : {
            yaw: camera.viewYaw,
            pitch: camera.viewPitch,
            position:
              cameraPosition === null
                ? null
                : { x: cameraPosition.x, y: cameraPosition.y, z: cameraPosition.z },
          },
    activeCheckpointId: checkpoint?.getActiveCheckpointId() ?? null,
    activatedCheckpointIds: checkpoint?.getSnapshot().activatedCheckpointIds ?? [],
    respawnState: respawn?.currentState ?? "unavailable",
    respawnCount: state.respawnCount,
    respawnDestination: state.respawnDestination,
    results:
      results === null
        ? null
        : {
            mode: results.mode,
            levelId: results.levelId,
            status: results.status,
            durationMs: results.durationMs,
          },
    prologueCompleted: app.progressionSystem?.getSnapshot().prologueCompleted ?? false,
  };
}

function formatLiveState(app: DevLaunchApplication, request: DevLaunchRequest): string {
  const flow = app.flowManager?.getState() ?? "unavailable";
  const session = app.sessionManager?.getActiveSession() ?? null;
  const level = app.levelRuntime?.getCurrentLevel()?.id ?? "none";

  return (
    `flow=${flow}, session=${session?.status ?? "none"}` +
    `, level=${level} (expected ${request.levelDefinitionId})` +
    `, mode=${app.currentMode ?? "none"}`
  );
}

function normalizeDestination(destination: RespawnDestinationLike | null): DevLaunchVector | null {
  if (!destination) {
    return null;
  }

  return {
    x: destination.position.x,
    y: destination.position.y,
    z: destination.position.z,
  };
}

/* -------------------------------------------------------------------------- */
/* Browser host                                                               */
/* -------------------------------------------------------------------------- */

function createBrowserDevLaunchHost(): DevLaunchHost {
  return {
    expose(api: GlasslineDevLaunchApi): void {
      window.__glasslineDevLaunch = api;
    },
    markActive(levelId: DevLaunchLevelId): void {
      if (typeof document !== "undefined") {
        document.documentElement.dataset.devLaunch = levelId;
      }
    },
    log(message: string): void {
      console.info(`[Glassline] ${message}`);
    },
    warn(message: string): void {
      console.warn(`[Glassline] ${message}`);
    },
    error(message: string, details?: unknown): void {
      console.error(`[Glassline] ${message}`, details ?? "");
    },
    showFailure(title: string, details: string): void {
      showDevLaunchFailureBanner(title, details);
    },
  };
}

/**
 * Minimal, dependency-free failure surface that works before/independent of the
 * game UI (a boot failure may leave the menu overlay covering the screen). The
 * banner is dev-only and never shipped.
 */
function showDevLaunchFailureBanner(title: string, details: string): void {
  if (typeof document === "undefined") {
    return;
  }

  // Replace a previous failure banner instead of stacking duplicates.
  document.getElementById(FAILURE_BANNER_ID)?.remove();

  const banner = document.createElement("div");

  banner.id = FAILURE_BANNER_ID;
  banner.setAttribute("role", "alert");
  banner.style.position = "fixed";
  banner.style.top = "0";
  banner.style.left = "0";
  banner.style.right = "0";
  banner.style.zIndex = "2147483647";
  banner.style.padding = "14px 18px";
  banner.style.background = "#3a0d0d";
  banner.style.color = "#ffffff";
  banner.style.font = "13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace";
  banner.style.whiteSpace = "pre-wrap";
  banner.style.borderBottom = "2px solid #ff4d4d";
  banner.textContent = `DEV LAUNCH FAILED — ${title}\n${details}`;

  document.body.prepend(banner);
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, milliseconds));
  });
}
