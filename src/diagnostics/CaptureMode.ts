import type { Object3D, PerspectiveCamera, Scene, WebGLInfo, WebGLRenderer } from "three";

import {
  CAPTURE_FOV_DEGREES,
  CAPTURE_SHOTS,
  type CaptureRequest,
  type CaptureShot,
  findCaptureShot,
  parseCaptureRequest,
} from "./captureShots";

/**
 * Dev-only deterministic capture boot (`?capture=1&level=prologue&shot=<id>`).
 *
 * The mode is intentionally isolated from `Application`: it reaches into the
 * existing dev handle through a narrow structural interface (TypeScript `private`
 * members do not exist at runtime), hides every DOM overlay, freezes all
 * time-driven world animation and post-processing uniforms, then drives the
 * normal gameplay boot and pins the camera to an authored Prologue pose.
 *
 * Import is dynamic and guarded by `import.meta.env.DEV` in `main.ts`, so the
 * production bundle never loads this module.
 */

const CAPTURE_STYLE_ID = "glassline-capture-style";
const CAPTURE_DATASET_ATTRIBUTE = "capture";
const DISPLAY_QUALITY = "high";
/**
 * Seed for the capture-mode PRNG override. `GTAOPass` builds its 64x64 noise
 * texture from `new SimplexNoise()`, whose permutation table is seeded from
 * `Math.random()`; without a fixed seed every browser launch bakes a different
 * AO noise pattern and the PNG hash changes even though the scene is identical.
 */
const CAPTURE_RANDOM_SEED = 0x5f3759df;
const FRAMES_BEFORE_READY = 2;
/** Frames between GPU pixel probes when waiting for a settled frame. */
const STABILITY_PROBE_FRAMES = 2;
/** Upper bound of probe rounds before `ready` is declared anyway. */
const STABILITY_MAX_ROUNDS = 6;
const GAMEPLAY_READY_TIMEOUT_MS = 20_000;
const GAMEPLAY_POLL_INTERVAL_MS = 50;

const CAPTURE_CSS = [
  'html[data-capture="1"] #boot-loader,',
  'html[data-capture="1"] .gl-ui,',
  'html[data-capture="1"] .gl-ui__screens,',
  'html[data-capture="1"] .gl-hud,',
  'html[data-capture="1"] .gl-toast,',
  'html[data-capture="1"] .gl-status {',
  "  display: none !important;",
  "}",
  'html[data-capture="1"] body {',
  "  background: #000 !important;",
  "  cursor: none;",
  "}",
].join("\n");

/** Shape of one entry in `__glasslineCapture.shots` (JSON serialisable). */
export interface GlasslineCaptureShot {
  readonly id: string;
  readonly title: string;
  readonly position: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly fov: number;
}

/** Frame metrics reported by `__glasslineCapture.stats()`. */
export interface GlasslineCaptureStats {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly textures: number;
  readonly programs: number;
  readonly quality: string;
  /** Backing-buffer size in device pixels (expected 1600x900 at DPR 1). */
  readonly canvas: {
    readonly width: number;
    readonly height: number;
  };
  readonly shot: string | null;
}

/** Contract consumed by the Playwright capture harness and metrics scripts. */
export interface GlasslineCaptureApi {
  ready: boolean;
  readonly shots: readonly GlasslineCaptureShot[];
  apply(id: string): boolean;
  stats(): GlasslineCaptureStats | null;
}

declare global {
  interface Window {
    __glasslineCapture?: GlasslineCaptureApi;
  }
}

/* -------------------------------------------------------------------------- */
/* Runtime view of the application (structural, no Application import).       */
/* -------------------------------------------------------------------------- */

interface ViewModelLike {
  readonly root: { visible: boolean } | null;
  setVisible(visible: boolean): void;
  update(...args: unknown[]): void;
}

interface SkyDomeLike {
  update(deltaSeconds: number): void;
  elapsedSeconds?: number;
}

interface CityLifeLike {
  update(deltaSeconds: number): void;
  elapsedSeconds?: number;
}

interface RenderSceneLike {
  update(deltaSeconds: number): void;
  readonly scene: Scene;
  readonly skyDome: SkyDomeLike;
  readonly cityLife: CityLifeLike;
  /** Re-bakes the PMREM sky probe (private on `RenderScene`, runtime reachable). */
  refreshEnvironmentMap?(): void;
}

interface CameraSystemLike {
  readonly camera: PerspectiveCamera;
  renderUpdate(input: unknown): void;
}

interface PostPipelineLike {
  elapsedSeconds?: number;
}

interface RendererLike {
  render(scene: unknown, camera: unknown, deltaSeconds?: number, speedRatio?: number): void;
  setQuality(quality: string): void;
  resize(width: number, height: number): void;
  refreshShadows(): void;
  readonly currentQuality: string;
  readonly threeRenderer: WebGLRenderer;
}

interface SettingsManagerLike {
  update(changes: Readonly<Record<string, unknown>>): Promise<{ readonly applied: boolean }>;
}

interface FlowManagerLike {
  getState(): string;
}

interface GameplaySessionManagerLike {
  isRunning(): boolean;
}

interface CaptureApplicationLike {
  startGameplay(mode: string): Promise<void>;
  readonly viewModel: ViewModelLike | null;
  readonly renderScene: RenderSceneLike | null;
  readonly cameraSystem: CameraSystemLike | null;
  readonly renderer: RendererLike | null;
  readonly settingsManager: SettingsManagerLike | null;
  readonly flowManager: FlowManagerLike | null;
  readonly sessionManager: GameplaySessionManagerLike | null;
}

interface CaptureRuntimeState {
  app: CaptureApplicationLike | null;
  shotId: string;
  lastStats: GlasslineCaptureStats | null;
  /** True while the settle gate records GPU frame checksums. */
  probeActive: boolean;
  readonly probeHashes: number[];
}

/** Boot handle returned by {@link prepareCaptureMode}. */
export interface CaptureModeHandle {
  readonly request: CaptureRequest;
  /** Switches the booted application into the deterministic capture state. */
  activate(application: unknown): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Public entry points                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Hides every DOM overlay and installs the `window.__glasslineCapture` stub as
 * early as possible when the URL asks for capture mode. Returns `null` (and does
 * nothing) for a normal page load.
 */
export function prepareCaptureMode(search = window.location.search): CaptureModeHandle | null {
  const request = parseCaptureRequest(search);

  if (!request) {
    return null;
  }

  if (!request.shotKnown) {
    console.warn(
      `[Glassline] Unknown capture shot "${request.requestedShotId ?? ""}"; ` +
        `falling back to "${request.shotId}".`,
    );
  }

  installDeterministicRandom(CAPTURE_RANDOM_SEED);
  installCaptureStyle();
  document.documentElement.dataset[CAPTURE_DATASET_ATTRIBUTE] = "1";
  document.documentElement.style.background = "#000";
  document.body.style.background = "#000";

  const state: CaptureRuntimeState = {
    app: null,
    shotId: request.shotId,
    lastStats: null,
    probeActive: false,
    probeHashes: [],
  };

  const api = createCaptureApi(state);

  window.__glasslineCapture = api;

  return {
    request,
    async activate(application: unknown): Promise<void> {
      state.app = application as CaptureApplicationLike;

      await pinDisplayQuality(state.app);
      installFreezes(state);
      await startPrologue(state.app);

      // Reset the time-driven layer once more after the level session has
      // started, then re-pin the surface and rebuild every GPU-side cache
      // (PMREM sky probe, shadow map, shader programs) from that frozen state,
      // so no per-launch "which frame baked what" state can leak into the frame.
      resetAnimatedTime(state.app);
      pinCaptureSurface(state.app);
      rebuildDeterministicGpuState(state.app);
      primeShaderPrograms(state.app);

      applyShot(state, request.shotId);

      await settleCaptureFrame(state);

      api.ready = true;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Capture API                                                                */
/* -------------------------------------------------------------------------- */

function createCaptureApi(state: CaptureRuntimeState): GlasslineCaptureApi {
  return {
    ready: false,
    shots: CAPTURE_SHOTS.map((shot) => ({
      id: shot.id,
      title: shot.title,
      position: [...shot.position] as [number, number, number],
      lookAt: [...shot.lookAt] as [number, number, number],
      fov: shot.fov,
    })),
    apply(id: string): boolean {
      return applyShot(state, id);
    },
    stats(): GlasslineCaptureStats | null {
      return state.lastStats;
    },
  };
}

/**
 * Applies one authored shot. Returns `false` for unknown ids or when the app has
 * not exposed a camera yet.
 */
function applyShot(state: CaptureRuntimeState, id: string): boolean {
  const shot = findCaptureShot(typeof id === "string" ? id.trim() : "");

  if (!shot) {
    return false;
  }

  const camera = state.app?.cameraSystem?.camera;

  if (!camera) {
    return false;
  }

  positionCamera(camera, shot);
  state.shotId = shot.id;

  return true;
}

function positionCamera(camera: PerspectiveCamera, shot: CaptureShot): void {
  camera.position.set(shot.position[0], shot.position[1], shot.position[2]);
  camera.up.set(0, 1, 0);
  camera.lookAt(shot.lookAt[0], shot.lookAt[1], shot.lookAt[2]);
  camera.fov = shot.fov > 0 ? shot.fov : CAPTURE_FOV_DEGREES;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

/* -------------------------------------------------------------------------- */
/* DOM                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Replaces `Math.random` with a fixed-seed mulberry32 PRNG so every GPU-side
 * noise table generated during boot is byte-identical between page loads.
 * Only installed when `?capture=1` is present, i.e. never in production.
 */
function installDeterministicRandom(seed: number): void {
  let state = seed >>> 0;

  Math.random = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function installCaptureStyle(): void {
  if (document.getElementById(CAPTURE_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = CAPTURE_STYLE_ID;
  style.textContent = CAPTURE_CSS;
  document.head.append(style);
}

/* -------------------------------------------------------------------------- */
/* Determinism                                                                */
/* -------------------------------------------------------------------------- */

async function pinDisplayQuality(app: CaptureApplicationLike): Promise<void> {
  const settings = app.settingsManager;

  if (settings) {
    const result = await settings.update({ "display.quality": DISPLAY_QUALITY });

    if (!result.applied) {
      console.warn("[Glassline] Capture mode could not persist display.quality; forcing renderer.");
    }
  }

  const renderer = app.renderer;

  if (!renderer) {
    throw new Error("[Glassline] Capture mode requires an initialized renderer.");
  }

  // Belt and braces: apply the quality tier directly, then pin DPR to 1 so the
  // PNG backing buffer matches the 1600x900 viewport exactly.
  if (renderer.currentQuality !== DISPLAY_QUALITY) {
    renderer.setQuality(DISPLAY_QUALITY);
  }

  renderer.threeRenderer.setPixelRatio(1);
  renderer.resize(window.innerWidth, window.innerHeight);
}

function installFreezes(state: CaptureRuntimeState): void {
  const app = state.app;

  if (!app) {
    throw new Error("[Glassline] Capture mode requires an initialized application.");
  }

  const renderScene = app.renderScene;

  if (renderScene) {
    const originalUpdate = renderScene.update;

    // Sky drift and the city flock are the only world animation consumers.
    renderScene.update = () => {
      originalUpdate.call(renderScene, 0);
    };
  }

  const cameraSystem = app.cameraSystem;

  if (cameraSystem) {
    // The gameplay render path rewrites the camera from the player every frame.
    cameraSystem.renderUpdate = () => {};
    cameraSystem.camera.traverse((object: Object3D) => {
      if (object.name === "view-model") {
        object.visible = false;
      }
    });
  }

  const viewModel = app.viewModel;

  if (viewModel) {
    viewModel.setVisible(false);

    if (viewModel.root) {
      viewModel.root.visible = false;
    }

    // `renderFrame` re-shows and re-updates the view model every frame.
    viewModel.setVisible = () => {};
    viewModel.update = () => {};
  }

  const renderer = app.renderer;

  if (renderer) {
    const threeRenderer = renderer.threeRenderer;

    // Aggregate counters across the scene pass and every post pass so the
    // reported frame cost is the true per-frame draw call count.
    threeRenderer.info.autoReset = false;

    const originalRender = renderer.render;

    renderer.render = (scene: unknown, camera: unknown) => {
      threeRenderer.info.reset();
      originalRender.call(renderer, scene, camera, 0, 0);
      state.lastStats = readFrameStats(state);

      if (state.probeActive) {
        const hash = hashBackbuffer(threeRenderer);

        if (hash !== null) {
          state.probeHashes.push(hash);
        }
      }
    };
  }

  resetAnimatedTime(app);
}

/** Rewinds every animated clock to a fixed phase so repeated loads match. */
function resetAnimatedTime(app: CaptureApplicationLike): void {
  const renderScene = app.renderScene;

  if (renderScene) {
    renderScene.skyDome.elapsedSeconds = 0;
    renderScene.skyDome.update(0);
    renderScene.cityLife.elapsedSeconds = 0;
    renderScene.cityLife.update(0);
  }

  const renderer = app.renderer;

  if (renderer) {
    const post = (renderer as unknown as { post?: PostPipelineLike | null }).post;

    if (post) {
      // Film grain is driven by `uTime`; zeroing the accumulator pins it.
      post.elapsedSeconds = 0;
    }
  }
}

/**
 * Re-pins DPR, backing-buffer size, camera aspect and the quality tier *after*
 * the level session has started. The level boot can trigger resizes / quality
 * application, and a stale aspect or pixel ratio is a per-launch difference.
 */
function pinCaptureSurface(app: CaptureApplicationLike): void {
  const renderer = app.renderer;

  if (renderer) {
    if (renderer.currentQuality !== DISPLAY_QUALITY) {
      renderer.setQuality(DISPLAY_QUALITY);
    }

    renderer.threeRenderer.setPixelRatio(1);
    renderer.resize(window.innerWidth, window.innerHeight);
    renderer.refreshShadows();
  }

  const camera = app.cameraSystem?.camera;

  if (camera) {
    camera.aspect = Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
  }
}

/**
 * Rebuilds every GPU cache that is derived from scene state (PMREM sky probe and
 * the sun shadow map) at a fixed point in the boot: after the level content is
 * loaded and after world time is frozen. Baking these lazily on "whichever frame
 * happens first" is the kind of per-launch state that changes specular LSBs on
 * glass/metal while every JS-side counter stays identical.
 */
function rebuildDeterministicGpuState(app: CaptureApplicationLike): void {
  app.renderScene?.refreshEnvironmentMap?.();
  app.renderer?.refreshShadows();
}

/**
 * Compiles the shader programs for all six authored cameras in a fixed order.
 * Once the program cache is warm for every pose, the captured frame no longer
 * depends on which camera happened to be active when a material/program pair was
 * first used.
 */
function primeShaderPrograms(app: CaptureApplicationLike): void {
  const renderer = app.renderer;
  const cameraSystem = app.cameraSystem;
  const scene = app.renderScene?.scene;

  if (!renderer || !cameraSystem || !scene) {
    return;
  }

  const camera = cameraSystem.camera;
  const threeRenderer = renderer.threeRenderer;

  for (const shot of CAPTURE_SHOTS) {
    positionCamera(camera, shot);
    threeRenderer.compile(scene, camera);
  }
}

/**
 * Waits until two consecutive rendered frames hash identically (or the probe
 * budget is spent). This turns "the frame is stable" into a measured condition
 * instead of a fixed sleep, so a slow machine cannot capture a mid-warm-up frame.
 */
async function settleCaptureFrame(state: CaptureRuntimeState): Promise<void> {
  await nextAnimationFrames(FRAMES_BEFORE_READY);

  if (!state.app?.renderer) {
    return;
  }

  state.probeHashes.length = 0;
  state.probeActive = true;

  try {
    for (let round = 0; round < STABILITY_MAX_ROUNDS; round += 1) {
      await nextAnimationFrames(STABILITY_PROBE_FRAMES);

      const count = state.probeHashes.length;
      const latest = count > 0 ? state.probeHashes[count - 1] : undefined;
      const previous = count > 1 ? state.probeHashes[count - 2] : undefined;

      if (latest !== undefined && previous !== undefined && latest === previous) {
        return;
      }
    }
  } finally {
    state.probeActive = false;
    state.probeHashes.length = 0;
  }
}

/** FNV-1a checksum of the default framebuffer contents. */
function hashBackbuffer(threeRenderer: WebGLRenderer): number | null {
  const gl = threeRenderer.getContext();
  const canvas = threeRenderer.domElement;
  const width = canvas.width;
  const height = canvas.height;

  if (width <= 0 || height <= 0) {
    return null;
  }

  const pixels = new Uint8Array(width * height * 4);

  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  } catch {
    return null;
  }

  let hash = 2166136261;

  for (let index = 0; index < pixels.length; index += 1) {
    hash ^= pixels[index] ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function readFrameStats(state: CaptureRuntimeState): GlasslineCaptureStats | null {
  const renderer = state.app?.renderer;

  if (!renderer) {
    return null;
  }

  const threeRenderer = renderer.threeRenderer;
  const info: WebGLInfo = threeRenderer.info;
  const canvas = threeRenderer.domElement;

  return {
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    textures: info.memory.textures,
    programs: info.programs?.length ?? 0,
    quality: renderer.currentQuality,
    canvas: {
      width: canvas.width,
      height: canvas.height,
    },
    shot: state.shotId,
  };
}

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

async function startPrologue(app: CaptureApplicationLike): Promise<void> {
  await app.startGameplay("prologue");

  const deadline = Date.now() + GAMEPLAY_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (app.flowManager?.getState() === "gameplay" && app.sessionManager?.isRunning()) {
      return;
    }

    await delay(GAMEPLAY_POLL_INTERVAL_MS);
  }

  throw new Error("[Glassline] Capture mode timed out waiting for the prologue gameplay state.");
}

function nextAnimationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number): void => {
      if (remaining <= 0) {
        resolve();

        return;
      }

      window.requestAnimationFrame(() => {
        step(remaining - 1);
      });
    };

    step(count);
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
