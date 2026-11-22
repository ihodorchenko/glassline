import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { Application } from "../../src/app/Application";
import { DEFAULT_APPLICATION_CONFIG } from "../../src/app/ApplicationConfig";
import { CameraSystem } from "../../src/camera/CameraSystem";
import type { CheckpointSystem } from "../../src/checkpoint/CheckpointSystem";
import type { DomainEvent } from "../../src/events/DomainEvent";
import { FIRST_SECTION_SECTION_IDS } from "../../src/levels/first-section/FirstSectionLayout";
import {
  FIRST_SECTION_LEVEL,
  FIRST_SECTION_LEVEL_DEFINITIONS,
} from "../../src/levels/first-section/FirstSectionLevel";
import { LevelRuntimeManager } from "../../src/levels/LevelRuntimeManager";
import type { LevelDefinition, LevelVector3 } from "../../src/levels/LevelTypes";
import type { TriggerEvent } from "../../src/levels/TriggerManager";
import {
  PROLOGUE_TEST_LEVEL,
  PROLOGUE_TEST_LEVEL_DEFINITIONS,
  PROLOGUE_TEST_LEVEL_ID,
} from "../../src/levels/test/PrologueTestLevel";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import type { PlayerSystem } from "../../src/player/PlayerSystem";
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
  type SessionResults,
} from "../../src/sessions/GameplaySessionManager";
import type { SpeedrunSystem } from "../../src/speedrun/SpeedrunSystem";

/**
 * First Section — actual Application orchestration (`Step 3.3.1`).
 *
 * Unlike `first-section-integration.test.ts`, this suite does not create a
 * custom completion/progression harness. It builds a headless `Application`
 * composition root and lets the real `GameplaySessionManager` call the real
 * `Application.createSessionPorts()` methods: load, prepare, start, complete,
 * and shutdown. Trigger events are delivered by the real Level Runtime to the
 * subscription installed by `Application.prepareGameplayPort`, so
 * `Application.handleTriggerEnter` and `Application.completeGameplay` execute
 * their production implementations.
 *
 * `Application.initialize()` itself needs a canvas, WebGL renderer, audio, UI,
 * and IndexedDB. Those presentation resources are not required by the
 * completion/progression path, so the test injects the same real collaborators
 * that `initialize()` would assign and leaves presentation services null. No
 * completion, progression, or speedrun decision is reimplemented in the test.
 */

interface RouteStep {
  readonly id: string;
  readonly kind: "spawn" | "checkpoint" | "section-entry" | "finish";
  readonly position: LevelVector3;
}

/** The private Application state used by the production orchestration. */
interface ApplicationInternals {
  levelRuntime: LevelRuntimeManager;
  physics: PhysicsWorld;
  cameraSystem: CameraSystem;
  progressionSystem: ProgressionSystem;
  sessionManager: GameplaySessionManager;
  player: PlayerSystem | null;
  checkpointSystem: CheckpointSystem | null;
  respawnManager: RespawnManager | null;
  speedrunSystem: SpeedrunSystem | null;
  currentMode: GameplayMode | null;
  sessionCheckpointIds: Set<string>;
  sessionCheckpointsAllEmitted: boolean;
  sessionRecoveries: number;
  finishTriggered: boolean;
  busy: boolean;
  lastResults: SessionResults | null;
  createSessionPorts(): GameplaySessionPorts;
  shutdownGameplayPort(context: unknown): void;
}

type CompleteGameplay = (source: string, finishTriggerId?: string) => Promise<void>;

interface ApplicationHarness {
  readonly internals: ApplicationInternals;
  readonly physics: PhysicsWorld;
  readonly scene: RenderScene;
  readonly runtime: LevelRuntimeManager;
  readonly camera: CameraSystem;
  readonly progression: ProgressionSystem;
  readonly manager: GameplaySessionManager;
  readonly recordSpy: MockInstance<ProgressionSystem["recordEvent"]>;
  readonly completeGameplaySpy: MockInstance<CompleteGameplay>;
}

const harnesses: ApplicationHarness[] = [];

function requireItem<T>(item: T | undefined, label: string): T {
  if (item === undefined) {
    throw new Error(`Missing ${label}.`);
  }

  return item;
}

function spawnPosition(level: LevelDefinition, spawnPointId: string): LevelVector3 {
  const spawn = requireItem(
    level.spawnPoints.find((candidate) => candidate.id === spawnPointId),
    `spawn point "${spawnPointId}" in "${level.id}"`,
  );

  return { ...spawn.position };
}

/**
 * Test-only level that is *not* the authored Prologue but authors five
 * checkpoints. It reuses the First Section collision layer and adds one
 * checkpoint at the initial spawn, so the real trigger route activates five
 * unique checkpoints. No authored level, geometry, or checkpoint definition is
 * modified.
 */
const ORDINARY_CHECKPOINT_LEVEL_ID = "ordinary_checkpoint_test";

function createOrdinaryCheckpointLevel(): LevelDefinition {
  const initialSpawn = requireItem(
    FIRST_SECTION_LEVEL.spawnPoints.find(
      (candidate) => candidate.id === FIRST_SECTION_LEVEL.initialSpawnPointId,
    ),
    "First Section initial spawn",
  );

  return {
    ...FIRST_SECTION_LEVEL,
    id: ORDINARY_CHECKPOINT_LEVEL_ID,
    displayName: "Ordinary Checkpoint Test",
    checkpoints: [
      ...FIRST_SECTION_LEVEL.checkpoints,
      {
        id: "cp_extra",
        sectionId: FIRST_SECTION_SECTION_IDS.start,
        triggerId: "trigger_cp_extra",
        spawnPointId: initialSpawn.id,
        displayName: "Extra Checkpoint",
        activationMode: "automatic",
        enabled: true,
        repeatable: true,
        respawnEnabled: true,
        order: -1,
      },
    ],
    triggers: [
      ...FIRST_SECTION_LEVEL.triggers,
      {
        id: "trigger_cp_extra",
        sectionId: FIRST_SECTION_SECTION_IDS.start,
        type: "checkpoint",
        center: { ...initialSpawn.position },
        halfExtents: { x: 2, y: 2, z: 2 },
        repeatable: true,
        metadata: { checkpointId: "cp_extra" },
      },
    ],
  };
}

/**
 * Trigger-only route derived from the authored level: checkpoint spawns (which
 * sit inside their checkpoint volumes) and section-entry trigger centres, then
 * the authored finish volume. This is the same trigger contract used by the
 * production runtime; it does not move section state directly.
 */
function buildAuthoredRoute(level: LevelDefinition): RouteStep[] {
  const initialSpawn = requireItem(
    level.spawnPoints.find((candidate) => candidate.id === level.initialSpawnPointId),
    `initial spawn in "${level.id}"`,
  );
  const steps: RouteStep[] = [
    {
      id: initialSpawn.id,
      kind: "spawn",
      position: { ...initialSpawn.position },
    },
  ];
  const sections = [...level.sections].sort((left, right) => left.order - right.order);

  for (const section of sections) {
    const checkpoints = level.checkpoints
      .filter((checkpoint) => checkpoint.sectionId === section.id)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

    for (const checkpoint of checkpoints) {
      steps.push({
        id: checkpoint.id,
        kind: "checkpoint",
        position: spawnPosition(level, checkpoint.spawnPointId),
      });
    }

    if (!section.nextSectionId) {
      continue;
    }

    const entryTriggers = level.triggers.filter(
      (trigger) =>
        trigger.type === "section-entry" &&
        trigger.sectionId === section.id &&
        trigger.metadata?.targetSectionId === section.nextSectionId,
    );

    expect(entryTriggers.length, `${section.id} section-entry trigger`).toBe(1);

    const entryTrigger = entryTriggers[0];

    if (!entryTrigger) {
      continue;
    }

    steps.push({
      id: entryTrigger.id,
      kind: "section-entry",
      position: { ...entryTrigger.center },
    });
  }

  const finishTriggers = level.triggers.filter((trigger) => trigger.metadata?.kind === "finish");

  expect(finishTriggers.length, `${level.id} finish trigger`).toBe(1);

  const finishTrigger = finishTriggers[0];

  if (!finishTrigger) {
    throw new Error(`Level "${level.id}" has no finish trigger.`);
  }

  steps.push({
    id: finishTrigger.id,
    kind: "finish",
    position: { ...finishTrigger.center },
  });

  return steps;
}

function driveRoute(
  harness: ApplicationHarness,
  steps: readonly RouteStep[],
  startNowMs = 1000,
): number {
  let now = startNowMs;

  for (const step of steps) {
    now += 1000;
    harness.runtime.update(step.position, now);
  }

  return now;
}

function sceneMetrics(scene: RenderScene): {
  readonly children: number;
  readonly geometries: number;
  readonly materials: number;
} {
  const geometries = new Set<string>();
  const materials = new Set<string>();

  scene.scene.traverse((object) => {
    const mesh = object as {
      isMesh?: boolean;
      geometry?: { uuid: string };
      material?: { uuid: string } | { uuid: string }[];
    };

    if (!mesh.isMesh) {
      return;
    }

    if (mesh.geometry) {
      geometries.add(mesh.geometry.uuid);
    }

    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        materials.add(material.uuid);
      }
    } else if (mesh.material) {
      materials.add(mesh.material.uuid);
    }
  });

  return {
    children: scene.scene.children.length,
    geometries: geometries.size,
    materials: materials.size,
  };
}

function recordedEvents(harness: ApplicationHarness): DomainEvent[] {
  return harness.recordSpy.mock.calls.map((call) => call[0]);
}

function recordedEventTypes(harness: ApplicationHarness): string[] {
  return recordedEvents(harness).map((event) => event.type);
}

/**
 * `Application.completeGameplay` calls `sessionManager.completeSession` and then
 * performs analytics/results assignment. Wait for the real orchestration to
 * finish instead of assuming the session event is the last observable effect.
 */
async function waitForApplicationCompletion(harness: ApplicationHarness): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (
      !harness.internals.busy &&
      harness.manager.getActiveSession()?.status === "completed" &&
      harness.internals.lastResults !== null
    ) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  throw new Error("Application completion did not finish within the test window.");
}

async function createApplicationHarness(
  definitions: readonly LevelDefinition[],
): Promise<ApplicationHarness> {
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
  const app = new Application();
  const internals = app as unknown as ApplicationInternals;

  internals.levelRuntime = runtime;
  internals.physics = physics;
  internals.cameraSystem = camera;
  internals.progressionSystem = progression;

  const manager = new GameplaySessionManager({
    ports: internals.createSessionPorts(),
    clock: () => 1000,
    applicationVersion: "test",
  });

  internals.sessionManager = manager;

  const recordSpy = vi.spyOn(progression, "recordEvent");
  const completeGameplaySpy = vi.spyOn(
    Application.prototype as unknown as { completeGameplay: CompleteGameplay },
    "completeGameplay",
  );
  const harness: ApplicationHarness = {
    internals,
    physics,
    scene,
    runtime,
    camera,
    progression,
    manager,
    recordSpy,
    completeGameplaySpy,
  };

  harnesses.push(harness);

  return harness;
}

async function startSession(harness: ApplicationHarness, levelId: string): Promise<void> {
  const result = await harness.manager.startSession({
    mode: "prologue",
    levelId,
    source: "level_select",
  });

  expect(result.success, result.error).toBe(true);
  expect(harness.manager.getActiveSession()?.status).toBe("running");
  expect(harness.runtime.getCurrentSession()?.state).toBe("active");
}

afterEach(async () => {
  for (const harness of harnesses) {
    harness.internals.shutdownGameplayPort({});
    harness.manager.dispose();
    harness.recordSpy.mockRestore();
    harness.completeGameplaySpy.mockRestore();

    await harness.runtime.unloadLevel();
    harness.runtime.dispose();
    harness.camera.dispose();
    harness.scene.dispose();
    harness.physics.dispose();
    harness.progression.dispose();
  }

  harnesses.length = 0;
});

describe("Application orchestration — First Section", () => {
  it("starts the supported prologue-mode flow without a SpeedrunSystem", async () => {
    const harness = await createApplicationHarness(FIRST_SECTION_LEVEL_DEFINITIONS);

    await startSession(harness, FIRST_SECTION_LEVEL.id);

    const session = harness.manager.getActiveSession();

    expect(session?.levelId).toBe("first_section");
    expect(session?.mode).toBe("prologue");
    expect(session?.configuration.isRanked).toBe(false);
    expect(session?.configuration.enableTimer).toBe(false);
    expect(session?.configuration.enableCheckpoints).toBe(true);
    expect(harness.internals.currentMode).toBe("prologue");
    expect(harness.internals.speedrunSystem).toBeNull();
    expect(FIRST_SECTION_LEVEL.metadata.supportsSpeedrun).toBe(false);
    expect(harness.runtime.getActiveSectionId()).toBe("sec_start");
    expect(recordedEventTypes(harness)).not.toContain("speedrun.attempt");
    expect(recordedEventTypes(harness)).not.toContain("speedrun.completed");
  });

  it("reaches the authored finish through the real Application handler and applies the completion policy", async () => {
    const harness = await createApplicationHarness(FIRST_SECTION_LEVEL_DEFINITIONS);
    const route = buildAuthoredRoute(FIRST_SECTION_LEVEL);
    const finishIndex = route.findIndex((step) => step.kind === "finish");

    expect(finishIndex).toBeGreaterThan(0);
    expect(route[finishIndex]?.id).toBe("trigger_finish");

    await startSession(harness, FIRST_SECTION_LEVEL.id);

    const finishEvents: TriggerEvent[] = [];

    harness.runtime.on("trigger:enter", (event) => {
      if (event.metadata?.kind === "finish") {
        finishEvents.push(event);
      }
    });

    const beforeFinish = route.slice(0, finishIndex);
    const now = driveRoute(harness, beforeFinish);

    // The Application handler activated every authored checkpoint through the
    // real CheckpointSystem and kept its own session-scoped set.
    expect(harness.internals.checkpointSystem).not.toBeNull();
    expect(harness.internals.checkpointSystem?.getSnapshot().activatedCheckpointIds).toEqual([
      "cp_start",
      "cp_building_jump",
      "cp_slide",
      "cp_vault",
    ]);
    expect([...harness.internals.sessionCheckpointIds]).toEqual([
      "cp_start",
      "cp_building_jump",
      "cp_slide",
      "cp_vault",
    ]);
    expect(harness.internals.sessionCheckpointsAllEmitted).toBe(false);
    expect(
      recordedEventTypes(harness).filter((type) => type === "checkpoint.activated"),
    ).toHaveLength(4);
    expect(recordedEventTypes(harness)).not.toContain("checkpoint.prologue_all");
    expect(recordedEventTypes(harness)).not.toContain("level.completed");
    expect(harness.manager.getActiveSession()?.status).toBe("running");

    const finishStep = route[finishIndex];

    if (!finishStep) {
      throw new Error("Finish step missing.");
    }

    harness.runtime.update(finishStep.position, now + 1000);
    await waitForApplicationCompletion(harness);

    const results = harness.manager.getLastResults();
    const eventTypes = recordedEventTypes(harness);

    expect(finishEvents).toHaveLength(1);
    expect(finishEvents[0]?.triggerId).toBe("trigger_finish");
    expect(finishEvents[0]?.actorId).toBe("player");
    expect(harness.internals.finishTriggered).toBe(true);
    expect(harness.completeGameplaySpy).toHaveBeenCalledTimes(1);
    expect(harness.completeGameplaySpy.mock.calls[0]?.[0]).toBe("finish-trigger");
    expect(harness.completeGameplaySpy.mock.calls[0]?.[1]).toBe("trigger_finish");
    expect(harness.internals.busy).toBe(false);
    expect(harness.manager.getActiveSession()?.status).toBe("completed");
    expect(results).not.toBeNull();
    expect(results?.levelId).toBe("first_section");
    expect(results?.mode).toBe("prologue");
    expect(results?.status).toBe("completed");
    expect(results).not.toHaveProperty("speedrun");
    expect(harness.internals.lastResults).toEqual(results);
    expect(harness.internals.speedrunSystem).toBeNull();
    expect(eventTypes).toContain("session.started");
    expect(eventTypes).toContain("session.completed");
    expect(eventTypes.filter((type) => type.startsWith("speedrun."))).toEqual([]);

    // Actual Application.completeGameplay -> publishDomainEvent ->
    // shouldPublishPrologueCompletion: first_section is rejected.
    expect(eventTypes).not.toContain("level.completed");
    expect(harness.progression.getSnapshot().prologueCompleted).toBe(false);
    expect(harness.progression.getProgression().campaign.completedLevelIds).toEqual([]);
    expect(harness.progression.hasMilestone("first_prologue_completion")).toBe(false);
  });
});

describe("Application orchestration — restart and reload", () => {
  it("restarts, unloads, and reloads through the real Application ports", async () => {
    const harness = await createApplicationHarness(FIRST_SECTION_LEVEL_DEFINITIONS);
    const baseline = sceneMetrics(harness.scene);
    const baselineBodies = harness.physics.rapierWorld.bodies.len();
    const baselineColliders = harness.physics.rapierWorld.colliders.len();
    const route = buildAuthoredRoute(FIRST_SECTION_LEVEL);

    await startSession(harness, FIRST_SECTION_LEVEL.id);

    const firstGameplaySessionId = harness.manager.getActiveSession()?.id;
    const firstLevelSessionId = harness.runtime.getCurrentSession()?.id;
    const firstCheckpointSystem = harness.internals.checkpointSystem;
    const firstRespawnManager = harness.internals.respawnManager;
    const loaded = sceneMetrics(harness.scene);
    const loadedBodies = harness.physics.rapierWorld.bodies.len();
    const loadedColliders = harness.physics.rapierWorld.colliders.len();
    const firstSnapshot = harness.runtime.getSnapshot();

    expect(firstGameplaySessionId).toBeDefined();
    expect(firstLevelSessionId).toBeDefined();
    expect(loaded.children).toBeGreaterThan(baseline.children);
    expect(loadedBodies).toBeGreaterThan(baselineBodies);
    expect(loadedColliders).toBeGreaterThan(baselineColliders);
    expect((harness.scene.scene.background as { getHex(): number }).getHex()).toBe(
      FIRST_SECTION_LEVEL.environment?.skyColor,
    );

    const finishIndex = route.findIndex((step) => step.kind === "finish");

    expect(finishIndex).toBeGreaterThan(0);

    driveRoute(harness, route.slice(0, finishIndex));
    expect(harness.internals.checkpointSystem?.getSnapshot().activatedCheckpointIds).toHaveLength(
      4,
    );

    const finishStep = route[finishIndex];

    if (!finishStep) {
      throw new Error("Finish step missing.");
    }

    harness.runtime.update(finishStep.position, 50_000);
    await waitForApplicationCompletion(harness);

    expect(harness.manager.getActiveSession()?.status).toBe("completed");

    const checkpointEventCount = recordedEventTypes(harness).filter(
      (type) => type === "checkpoint.activated",
    ).length;

    expect(checkpointEventCount).toBe(4);

    // Restart from the completed session. Application.restartGameplayPort
    // shuts the session systems down, unloads the level, loads it again, and
    // re-runs prepare/start/activate.
    const restart = await harness.manager.restartSession();

    expect(restart.success, restart.error).toBe(true);
    expect(harness.manager.getActiveSession()?.status).toBe("running");
    expect(harness.manager.getActiveSession()?.id).toBe(firstGameplaySessionId);
    expect(harness.runtime.getCurrentSession()?.id).not.toBe(firstLevelSessionId);
    expect(harness.runtime.getCurrentSession()?.state).toBe("active");
    expect(harness.runtime.getActiveSectionId()).toBe("sec_start");
    expect(harness.internals.speedrunSystem).toBeNull();
    expect(harness.internals.checkpointSystem?.getSnapshot().activatedCheckpointIds).toEqual([]);
    // A restart creates new session-scoped systems and clears the Application's
    // own per-session accumulator; nothing from the completed run survives.
    expect(harness.internals.checkpointSystem).not.toBe(firstCheckpointSystem);
    expect(harness.internals.respawnManager).not.toBe(firstRespawnManager);
    expect(harness.internals.sessionCheckpointIds.size).toBe(0);
    expect(harness.internals.sessionCheckpointsAllEmitted).toBe(false);
    expect(harness.internals.sessionRecoveries).toBe(0);
    expect(harness.runtime.getSnapshot()).toMatchObject({
      triggerCount: firstSnapshot.triggerCount,
      spawnPointCount: firstSnapshot.spawnPointCount,
      objectSurfaceCount: firstSnapshot.objectSurfaceCount,
      objectCount: firstSnapshot.objectCount,
      lastError: null,
    });
    expect(sceneMetrics(harness.scene)).toEqual(loaded);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(loadedBodies);
    expect(harness.physics.rapierWorld.colliders.len()).toBe(loadedColliders);
    expect(
      recordedEventTypes(harness).filter((type) => type === "checkpoint.activated"),
    ).toHaveLength(checkpointEventCount);

    const abandon = await harness.manager.abandonSession("return-to-menu");

    expect(abandon.success, abandon.error).toBe(true);
    expect(harness.manager.getActiveSession()?.status).toBe("abandoned");
    expect(harness.runtime.getCurrentSession()).toBeNull();
    expect(harness.runtime.getCurrentLevel()).toBeNull();
    expect(harness.runtime.getSnapshot().objectCount).toBe(0);
    expect(harness.runtime.getSnapshot().triggerCount).toBe(0);
    expect(harness.runtime.getSnapshot().spawnPointCount).toBe(0);
    expect(harness.runtime.getSurfaces()).toEqual([]);
    expect(harness.runtime.getSpawnPoints()).toEqual([]);
    expect((harness.scene.scene.background as { getHex(): number }).getHex()).toBe(0xa7b9c4);

    const checkpointActivationsAfterUnload = recordedEventTypes(harness).filter(
      (type) => type === "checkpoint.activated",
    ).length;

    // Updating an unloaded runtime cannot replay a trigger from the destroyed
    // session; the call is a deterministic no-op.
    harness.runtime.update({ x: 0, y: 0.93, z: 10 }, 99_000);
    expect(
      recordedEventTypes(harness).filter((type) => type === "checkpoint.activated"),
    ).toHaveLength(checkpointActivationsAfterUnload);

    expect(sceneMetrics(harness.scene)).toEqual(baseline);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(baselineBodies);
    expect(harness.physics.rapierWorld.colliders.len()).toBe(baselineColliders);

    // Load again through the same composition root.
    await startSession(harness, FIRST_SECTION_LEVEL.id);

    expect(harness.manager.getActiveSession()?.id).not.toBe(firstGameplaySessionId);
    expect(harness.runtime.getCurrentSession()?.state).toBe("active");
    expect(harness.runtime.getActiveSectionId()).toBe("sec_start");
    expect(harness.runtime.getSnapshot().objectCount).toBe(firstSnapshot.objectCount);
    expect(harness.runtime.getSnapshot().triggerCount).toBe(firstSnapshot.triggerCount);
    expect(harness.internals.checkpointSystem?.getSnapshot().activatedCheckpointIds).toEqual([]);
    expect(sceneMetrics(harness.scene)).toEqual(loaded);
    expect(harness.physics.rapierWorld.bodies.len()).toBe(loadedBodies);
    expect(harness.physics.rapierWorld.colliders.len()).toBe(loadedColliders);
  });

  it("keeps checkpoint and respawn progress session-scoped across a running restart", async () => {
    const harness = await createApplicationHarness(FIRST_SECTION_LEVEL_DEFINITIONS);

    await startSession(harness, FIRST_SECTION_LEVEL.id);

    const route = buildAuthoredRoute(FIRST_SECTION_LEVEL);
    const cpStartIndex = route.findIndex(
      (step) => step.kind === "checkpoint" && step.id === "cp_start",
    );
    const cpBuildingJumpIndex = route.findIndex(
      (step) => step.kind === "checkpoint" && step.id === "cp_building_jump",
    );
    const finishIndex = route.findIndex((step) => step.kind === "finish");

    expect(cpStartIndex).toBeGreaterThan(0);
    expect(cpBuildingJumpIndex).toBeGreaterThan(cpStartIndex);
    expect(finishIndex).toBeGreaterThan(cpBuildingJumpIndex);

    driveRoute(harness, route.slice(0, cpStartIndex + 1));

    const firstCheckpointSystem = harness.internals.checkpointSystem;
    const firstRespawnManager = harness.internals.respawnManager;
    const firstPlayer = harness.internals.player;

    expect(firstCheckpointSystem?.getSnapshot().activatedCheckpointIds).toEqual(["cp_start"]);
    expect([...harness.internals.sessionCheckpointIds]).toEqual(["cp_start"]);
    expect(firstRespawnManager).not.toBeNull();
    expect(firstPlayer).not.toBeNull();

    // The existing pause-menu Restart / R action calls `restartSession`.
    const restart = await harness.manager.restartSession();

    expect(restart.success, restart.error).toBe(true);
    expect(harness.manager.getActiveSession()?.status).toBe("running");
    expect(harness.internals.currentMode).toBe("prologue");
    expect(harness.runtime.getCurrentLevel()?.id).toBe("first_section");
    expect(harness.internals.checkpointSystem).not.toBe(firstCheckpointSystem);
    expect(harness.internals.respawnManager).not.toBe(firstRespawnManager);
    expect(harness.internals.player).not.toBe(firstPlayer);
    expect(harness.internals.checkpointSystem?.getSnapshot().activatedCheckpointIds).toEqual([]);
    expect([...harness.internals.sessionCheckpointIds]).toEqual([]);
    expect(harness.internals.sessionCheckpointsAllEmitted).toBe(false);
    expect(harness.internals.sessionRecoveries).toBe(0);

    // The new session can activate checkpoints from scratch.
    driveRoute(harness, buildAuthoredRoute(FIRST_SECTION_LEVEL).slice(0, cpBuildingJumpIndex + 1));

    expect(harness.internals.checkpointSystem?.getSnapshot().activatedCheckpointIds).toEqual([
      "cp_start",
      "cp_building_jump",
    ]);
    expect([...harness.internals.sessionCheckpointIds]).toEqual(["cp_start", "cp_building_jump"]);
    expect(harness.internals.checkpointSystem?.getActiveCheckpointId()).toBe("cp_building_jump");

    // The authored kill volume drives the real Application handler and the new
    // RespawnManager, which resolves the new session's active checkpoint.
    harness.runtime.update({ x: 0, y: -7.5, z: -35 }, 60_000);

    const respawn = harness.internals.respawnManager;
    const respawnDestination = spawnPosition(FIRST_SECTION_LEVEL, "sp_cp_building_jump");

    expect(respawn?.isRespawning).toBe(true);
    expect(respawn?.getLastDestination()?.checkpointId).toBe("cp_building_jump");
    expect(respawn?.getLastDestination()?.spawnPointId).toBe("sp_cp_building_jump");
    expect(harness.internals.player?.getPosition()).toEqual(respawnDestination);

    for (let step = 0; step < 30 && respawn?.isRespawning; step += 1) {
      respawn.update(1 / 60);
    }

    expect(respawn?.currentState).toBe("idle");
    expect(harness.internals.sessionRecoveries).toBe(1);
    expect(harness.internals.player?.getPosition()).toEqual(respawnDestination);

    // Completing the restarted session uses the new session's checkpoint state,
    // not the pre-restart run.
    driveRoute(harness, buildAuthoredRoute(FIRST_SECTION_LEVEL).slice(cpBuildingJumpIndex + 1));
    await waitForApplicationCompletion(harness);

    const results = harness.manager.getLastResults();
    const eventTypes = recordedEventTypes(harness);

    expect(harness.manager.getActiveSession()?.status).toBe("completed");
    expect(results?.levelId).toBe("first_section");
    expect(results?.mode).toBe("prologue");
    expect(harness.internals.lastResults).toEqual(results);
    expect(eventTypes.filter((type) => type === "checkpoint.activated")).toHaveLength(5);
    expect(eventTypes).not.toContain("checkpoint.prologue_all");
    expect(eventTypes).not.toContain("level.completed");
    expect(harness.progression.getSnapshot().prologueCompleted).toBe(false);
    expect(harness.progression.getProgression().campaign.completedLevelIds).toEqual([]);
  });
});

describe("Application orchestration — positive control", () => {
  it("publishes level.completed and checkpoint.prologue_all exactly once for the authored Prologue", async () => {
    const harness = await createApplicationHarness(PROLOGUE_TEST_LEVEL_DEFINITIONS);
    const route = buildAuthoredRoute(PROLOGUE_TEST_LEVEL);
    const finishIndex = route.findIndex((step) => step.kind === "finish");

    expect(PROLOGUE_TEST_LEVEL.sections).toHaveLength(5);
    expect(PROLOGUE_TEST_LEVEL.checkpoints).toHaveLength(5);
    expect(finishIndex).toBeGreaterThan(0);

    await startSession(harness, PROLOGUE_TEST_LEVEL_ID);

    const now = driveRoute(harness, route.slice(0, finishIndex));
    const checkpointSteps = route.filter((step) => step.kind === "checkpoint");
    const lastCheckpoint = checkpointSteps[checkpointSteps.length - 1];

    expect(lastCheckpoint).toBeDefined();
    expect(
      recordedEventTypes(harness).filter((type) => type === "checkpoint.activated"),
    ).toHaveLength(5);
    expect(
      recordedEventTypes(harness).filter((type) => type === "checkpoint.prologue_all"),
    ).toHaveLength(1);
    expect(harness.internals.sessionCheckpointsAllEmitted).toBe(true);

    // Leaving and re-entering an already activated checkpoint must not count it
    // twice or publish the set event again.
    if (lastCheckpoint) {
      harness.runtime.update({ x: 0, y: 100, z: 0 }, now + 1000);
      harness.runtime.update(lastCheckpoint.position, now + 2000);
    }

    const afterReentry = recordedEventTypes(harness);

    expect(afterReentry.filter((type) => type === "checkpoint.activated")).toHaveLength(5);
    expect(afterReentry.filter((type) => type === "checkpoint.prologue_all")).toHaveLength(1);

    const finishStep = route[finishIndex];

    if (!finishStep) {
      throw new Error("Finish step missing.");
    }

    harness.runtime.update(finishStep.position, now + 3000);
    await waitForApplicationCompletion(harness);

    const results = harness.manager.getLastResults();
    const eventTypes = recordedEventTypes(harness);

    expect(harness.manager.getActiveSession()?.status).toBe("completed");
    expect(harness.completeGameplaySpy).toHaveBeenCalledTimes(1);
    expect(results?.levelId).toBe(PROLOGUE_TEST_LEVEL_ID);
    expect(results?.mode).toBe("prologue");
    expect(results).not.toHaveProperty("speedrun");
    expect(harness.internals.lastResults).toEqual(results);

    // Positive control: the same Application orchestration does publish the
    // legitimate Prologue completion and the five-checkpoint set event.
    expect(eventTypes.filter((type) => type === "checkpoint.activated")).toHaveLength(5);
    expect(eventTypes.filter((type) => type === "checkpoint.prologue_all")).toHaveLength(1);

    const prologueAllIndex = eventTypes.indexOf("checkpoint.prologue_all");

    expect(
      eventTypes.slice(0, prologueAllIndex).filter((type) => type === "checkpoint.activated"),
    ).toHaveLength(5);
    expect(eventTypes).toContain("level.completed");

    const snapshot = harness.progression.getSnapshot();

    expect(snapshot.prologueCompleted).toBe(true);
    expect(harness.progression.getProgression().campaign.completedLevelIds).toContain(
      PROLOGUE_TEST_LEVEL_ID,
    );
    expect(harness.progression.hasMilestone("first_prologue_completion")).toBe(true);
  });

  it("does not publish the Prologue checkpoint set for another level with five checkpoints", async () => {
    const ordinaryLevel = createOrdinaryCheckpointLevel();
    const harness = await createApplicationHarness([ordinaryLevel]);
    const route = buildAuthoredRoute(ordinaryLevel);

    await startSession(harness, ordinaryLevel.id);
    driveRoute(harness, route);
    await waitForApplicationCompletion(harness);

    const eventTypes = recordedEventTypes(harness);

    expect(ordinaryLevel.id).not.toBe(PROLOGUE_TEST_LEVEL_ID);
    expect(eventTypes.filter((type) => type === "checkpoint.activated")).toHaveLength(5);
    expect(eventTypes).not.toContain("checkpoint.prologue_all");
    expect(eventTypes).not.toContain("level.completed");
    expect(harness.internals.sessionCheckpointsAllEmitted).toBe(false);
    expect(harness.progression.getSnapshot().prologueCompleted).toBe(false);
    expect(harness.progression.getProgression().campaign.completedLevelIds).toEqual([]);
  });
});
