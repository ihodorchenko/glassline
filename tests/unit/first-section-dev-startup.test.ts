import { afterEach, describe, expect, it } from "vitest";

import { Application } from "../../src/app/Application";
import { DEFAULT_APPLICATION_CONFIG } from "../../src/app/ApplicationConfig";
import { CameraSystem } from "../../src/camera/CameraSystem";
import {
  createDevLaunch,
  type DevLaunchHost,
  type GlasslineDevLaunchApi,
} from "../../src/diagnostics/DevLaunch";
import { GameplayFlowManager } from "../../src/flow/GameplayFlowManager";
import {
  FIRST_SECTION_LEVEL,
  FIRST_SECTION_LEVEL_DEFINITIONS,
} from "../../src/levels/first-section/FirstSectionLevel";
import { LevelRuntimeManager } from "../../src/levels/LevelRuntimeManager";
import type { LevelDefinition } from "../../src/levels/LevelTypes";
import { PROLOGUE_TEST_LEVEL_DEFINITIONS } from "../../src/levels/test/PrologueTestLevel";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import {
  PROGRESSION_CONTENT,
  PROGRESSION_MILESTONES,
} from "../../src/progression/ProgressionContent";
import { ProgressionSystem } from "../../src/progression/ProgressionSystem";
import { RenderScene } from "../../src/rendering/RenderScene";
import type { RespawnManager } from "../../src/respawn/RespawnManager";
import {
  type GameplayMode,
  GameplaySessionManager,
  type GameplaySessionPorts,
} from "../../src/sessions/GameplaySessionManager";

/**
 * STEP 3.4 — the DEV launch through the real Application lifecycle.
 *
 * Unlike `dev-launch.test.ts`, this suite does not fake the gameplay stack. It
 * builds a headless `Application` composition root (the same pattern as
 * `first-section-application-integration.test.ts`), injects the real
 * collaborators that `initialize()` would assign (Level Runtime, physics,
 * camera, progression, flow) and lets the real `GameplaySessionManager` call the
 * production `Application.createSessionPorts()` methods. `DevLaunch` then calls
 * the real `Application.startGameplay`, so level loading, validation, player and
 * camera creation, checkpoint/respawn construction and session activation are
 * the production implementations.
 *
 * Presentation resources that need a browser (`Renderer`/WebGL, `InputManager`
 * with a canvas, `UIManager` with DOM, audio) are null here. Their runtime
 * behavior — HUD, pointer lock, keyboard/mouse camera and real locomotion — is
 * verified in the browser by `tools/capture/dev-route.mjs` and recorded under
 * `docs/evidence/first-section/step-3.4/`.
 */

interface ApplicationInternals {
  levelRuntime: LevelRuntimeManager;
  physics: PhysicsWorld;
  cameraSystem: CameraSystem;
  progressionSystem: ProgressionSystem;
  sessionManager: GameplaySessionManager;
  flowManager: GameplayFlowManager;
  player: unknown;
  playerState: unknown;
  checkpointSystem: unknown;
  respawnManager: RespawnManager | null;
  currentMode: GameplayMode | null;
  createSessionPorts(): GameplaySessionPorts;
  shutdownGameplayPort(context: unknown): void;
}

interface Harness {
  readonly app: Application;
  readonly internals: ApplicationInternals;
  readonly physics: PhysicsWorld;
  readonly scene: RenderScene;
  readonly runtime: LevelRuntimeManager;
  readonly camera: CameraSystem;
  readonly progression: ProgressionSystem;
  readonly manager: GameplaySessionManager;
  readonly flow: GameplayFlowManager;
}

interface FakeHost {
  readonly host: DevLaunchHost;
  readonly exposed: GlasslineDevLaunchApi[];
  readonly failures: Array<{ readonly title: string; readonly details: string }>;
  readonly logs: string[];
}

const harnesses: Harness[] = [];

function createFakeHost(): FakeHost {
  const exposed: GlasslineDevLaunchApi[] = [];
  const failures: Array<{ readonly title: string; readonly details: string }> = [];
  const logs: string[] = [];

  return {
    exposed,
    failures,
    logs,
    host: {
      expose: (api) => {
        exposed.push(api);
      },
      markActive: () => undefined,
      log: (message) => {
        logs.push(message);
      },
      warn: () => undefined,
      error: () => undefined,
      showFailure: (title, details) => {
        failures.push({ title, details });
      },
    },
  };
}

async function createHarness(definitions: readonly LevelDefinition[]): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: 1 / 60,
  });

  await physics.initialize();

  const scene = new RenderScene();
  const runtime = new LevelRuntimeManager({ scene, physics, definitions });
  const camera = new CameraSystem({
    fovDegrees: DEFAULT_APPLICATION_CONFIG.camera.fovDegrees,
    nearPlane: DEFAULT_APPLICATION_CONFIG.camera.nearPlane,
    farPlane: DEFAULT_APPLICATION_CONFIG.camera.farPlane,
    tuning: DEFAULT_APPLICATION_CONFIG.movement,
  });
  const progression = new ProgressionSystem({
    contents: PROGRESSION_CONTENT,
    milestones: PROGRESSION_MILESTONES,
    clock: () => 1000,
  });
  const flow = new GameplayFlowManager({ clock: () => 1000 });
  const app = new Application();
  const internals = app as unknown as ApplicationInternals;

  internals.levelRuntime = runtime;
  internals.physics = physics;
  internals.cameraSystem = camera;
  internals.progressionSystem = progression;
  internals.flowManager = flow;

  // Boot → main menu, exactly like `Application.initialize()` ends.
  const navigated = flow.navigate({ target: "main-menu", reason: "boot-complete" });

  expect(navigated.success).toBe(true);

  const manager = new GameplaySessionManager({
    ports: internals.createSessionPorts(),
    clock: () => 1000,
    applicationVersion: "test",
  });

  internals.sessionManager = manager;

  const harness: Harness = {
    app,
    internals,
    physics,
    scene,
    runtime,
    camera,
    progression,
    manager,
    flow,
  };

  harnesses.push(harness);

  return harness;
}

async function runDevLaunch(harness: Harness, search = "?dev=first_section") {
  const fake = createFakeHost();
  const preparation = createDevLaunch(search, fake.host, {
    readyTimeoutMs: 5_000,
    pollIntervalMs: 10,
  });

  if (preparation.kind !== "launch") {
    throw new Error(`expected a launch preparation, received "${preparation.kind}"`);
  }

  const result = await preparation.handle.activate(harness.app);

  return { result, fake, api: fake.exposed[0] ?? null, handle: preparation.handle };
}

afterEach(async () => {
  for (const harness of harnesses) {
    harness.internals.shutdownGameplayPort({});
    harness.manager.dispose();
    await harness.runtime.unloadLevel();
    harness.runtime.dispose();
    harness.flow.dispose();
    harness.camera.dispose();
    harness.scene.dispose();
    harness.physics.dispose();
    harness.progression.dispose();
  }

  harnesses.length = 0;
});

describe("DEV launch — real Application lifecycle", () => {
  it("loads first_section and reaches a running gameplay session from the main menu", async () => {
    const harness = await createHarness(FIRST_SECTION_LEVEL_DEFINITIONS);
    const { result, api, fake } = await runDevLaunch(harness);

    expect(result.success, result.error ?? "").toBe(true);
    expect(api?.ready).toBe(true);
    expect(fake.failures).toEqual([]);
    expect(fake.logs.some((line) => line.includes("DEV launch ready"))).toBe(true);

    // Real navigation → loading → gameplay.
    expect(harness.flow.getState()).toBe("gameplay");

    const session = harness.manager.getActiveSession();

    expect(session).not.toBeNull();
    expect(session?.levelId).toBe("first_section");
    expect(session?.mode).toBe("prologue");
    expect(session?.status).toBe("running");
    expect(session?.metadata.source).toBe("main_menu");
    expect(session?.metadata.levelVersion).toBe(FIRST_SECTION_LEVEL.version);
    expect(session?.configuration.isRanked).toBe(false);
    expect(session?.configuration.enableTimer).toBe(false);
    expect(session?.configuration.enableCheckpoints).toBe(true);

    // Real Level Runtime session, section and content activation.
    const levelSession = harness.runtime.getCurrentSession();

    expect(harness.runtime.getCurrentLevel()?.id).toBe("first_section");
    expect(levelSession?.state).toBe("active");
    expect(harness.runtime.getActiveSectionId()).toBe("sec_start");
    expect(harness.runtime.getSnapshot().sections).toHaveLength(
      FIRST_SECTION_LEVEL.sections.length,
    );

    // Session-scoped gameplay systems created by the production ports.
    expect(harness.internals.player).not.toBeNull();
    expect(harness.internals.playerState).not.toBeNull();
    expect(harness.internals.checkpointSystem).not.toBeNull();
    expect(harness.internals.respawnManager).not.toBeNull();
    expect(harness.internals.currentMode).toBe("prologue");

    // The player is settled on the authored initial spawn by `activateGameplayPort`.
    const player = harness.internals.player as {
      getPosition(): { x: number; y: number; z: number };
      getMovementSnapshot(): { grounded: boolean; state: string };
      getFeetPosition(): { x: number; y: number; z: number };
    };
    const spawn = FIRST_SECTION_LEVEL.spawnPoints.find(
      (candidate) => candidate.id === FIRST_SECTION_LEVEL.initialSpawnPointId,
    );

    if (!spawn) {
      throw new Error("missing authored initial spawn");
    }

    const position = player.getPosition();

    expect(position.x).toBeCloseTo(spawn.position.x, 5);
    expect(position.z).toBeCloseTo(spawn.position.z, 5);
    expect(position.y).toBeGreaterThan(0.8);
    expect(position.y).toBeLessThanOrEqual(0.95);
    expect(player.getMovementSnapshot().grounded).toBe(true);

    // Camera is the real CameraSystem, reset to the authored spawn rotation.
    expect(harness.camera.viewYaw).toBeCloseTo(spawn.rotationY, 5);
    expect(harness.camera.viewPitch).toBe(0);

    // Read-only dev status surfaces the same live state for the browser harness.
    const status = api?.status() ?? null;

    expect(status?.flow).toBe("gameplay");
    expect(status?.loadedLevelId).toBe("first_section");
    expect(status?.levelSessionState).toBe("active");
    expect(status?.sessionStatus).toBe("running");
    expect(status?.activeSectionId).toBe("sec_start");
    expect(status?.screen).toBeNull();
    expect(status?.activeCheckpointId).toBeNull();
    expect(status?.respawnState).toBe("idle");
    expect(status?.results).toBeNull();
    expect(status?.prologueCompleted).toBe(false);
  });

  it("starts nothing without the dev parameter and keeps the main menu", async () => {
    const harness = await createHarness(FIRST_SECTION_LEVEL_DEFINITIONS);
    const fake = createFakeHost();
    const preparation = createDevLaunch("", fake.host);

    expect(preparation.kind).toBe("none");
    expect(fake.exposed).toHaveLength(0);
    expect(harness.flow.getState()).toBe("main-menu");
    expect(harness.manager.getActiveSession()).toBeNull();
    expect(harness.runtime.getCurrentLevel()).toBeNull();
    expect(harness.internals.player).toBeNull();
  });

  it("keeps the shipped Prologue startup mapping unchanged", async () => {
    const harness = await createHarness([
      ...PROLOGUE_TEST_LEVEL_DEFINITIONS,
      ...FIRST_SECTION_LEVEL_DEFINITIONS,
    ]);
    const startGameplay = (
      harness.app as unknown as { startGameplay(mode: string, levelId?: string): Promise<void> }
    ).startGameplay.bind(harness.app);

    // This is exactly what the main menu's `onStartPrologue` action calls.
    await startGameplay("prologue");

    expect(harness.flow.getState()).toBe("gameplay");
    expect(harness.manager.getActiveSession()?.levelId).toBe("prologue_test");
    expect(harness.manager.getActiveSession()?.mode).toBe("prologue");
    expect(harness.runtime.getCurrentLevel()?.id).toBe("prologue_test");
    expect(harness.internals.currentMode).toBe("prologue");
  });

  it("fails visibly and leaves no partial session when the level is not registered", async () => {
    // Only the Prologue is registered, so `first_section` loading fails through
    // the real Level Runtime. This is the production failure path a broken dev
    // launch would hit.
    const harness = await createHarness(PROLOGUE_TEST_LEVEL_DEFINITIONS);
    const { result, api, fake } = await runDevLaunch(harness);

    expect(result.success).toBe(false);
    expect(result.error).toContain('flow "error"');
    expect(api?.ready).toBe(false);
    expect(api?.error).toContain("error");
    expect(fake.failures).toHaveLength(1);

    // Flow moved to error and DevLaunch abandoned the failed session; the
    // level, player, checkpoint and respawn systems are all released.
    expect(harness.flow.getState()).toBe("error");
    expect(harness.manager.getActiveSession()?.status).toBe("abandoned");
    expect(harness.runtime.getCurrentSession()).toBeNull();
    expect(harness.runtime.getCurrentLevel()).toBeNull();
    expect(harness.internals.player).toBeNull();
    expect(harness.internals.playerState).toBeNull();
    expect(harness.internals.checkpointSystem).toBeNull();
    expect(harness.internals.respawnManager).toBeNull();

    // A second attempt is still possible (no wedged session/transitioning flag).
    const retry = await runDevLaunch(harness);

    expect(retry.result.success).toBe(false);
    expect(harness.manager.getActiveSession()?.status).toBe("abandoned");
  });

  it("keeps respawn diagnostics attached to the current manager across restarts", async () => {
    const harness = await createHarness(FIRST_SECTION_LEVEL_DEFINITIONS);
    const { result, api, handle } = await runDevLaunch(harness);

    expect(result.success, result.error ?? "").toBe(true);

    const enterKillVolumeAndRespawn = (): RespawnManager => {
      // Leave the volume first so a repeated call can re-enter it.
      harness.runtime.update({ x: 0, y: 0.93, z: 14 }, Date.now());
      harness.runtime.update({ x: 0, y: -7.5, z: -35 }, Date.now() + 1);

      const respawn = harness.internals.respawnManager;

      if (!respawn) {
        throw new Error("RespawnManager is unavailable.");
      }

      expect(respawn.getLastDestination()).not.toBeNull();

      for (let step = 0; step < 30 && respawn.isRespawning; step += 1) {
        respawn.update(1 / 60);
      }

      expect(respawn.currentState).toBe("idle");

      return respawn;
    };

    expect(api?.status()?.respawnCount).toBe(0);

    const firstManager = enterKillVolumeAndRespawn();

    expect(api?.status()?.respawnCount).toBe(1);

    const restart = await harness.manager.restartSession();

    expect(restart.success, restart.error).toBe(true);

    const secondManager = harness.internals.respawnManager;

    expect(secondManager).not.toBe(firstManager);
    expect(api?.status()?.respawnCount).toBe(1);

    enterKillVolumeAndRespawn();
    expect(api?.status()?.respawnCount).toBe(2);

    const restartAgain = await harness.manager.restartSession();

    expect(restartAgain.success, restartAgain.error).toBe(true);

    const thirdManager = harness.internals.respawnManager;

    expect(thirdManager).not.toBe(secondManager);
    expect(api?.status()?.respawnCount).toBe(2);

    enterKillVolumeAndRespawn();
    expect(api?.status()?.respawnCount).toBe(3);

    handle.dispose();
    enterKillVolumeAndRespawn();

    expect(api?.status()?.respawnCount).toBe(3);
  });
});
