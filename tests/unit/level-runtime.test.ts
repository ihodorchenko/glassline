import { afterEach, describe, expect, it } from "vitest";

import { LevelRuntimeError, LevelRuntimeManager } from "../../src/levels/LevelRuntimeManager";
import { TRAINING_ENVIRONMENT } from "../../src/levels/test/ReleaseArenaPolish";
import {
  TRAINING_TEST_LEVEL,
  TRAINING_TEST_LEVEL_DEFINITIONS,
  TRAINING_TEST_LEVEL_ID,
} from "../../src/levels/test/TrainingTestLevel";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import { RenderScene } from "../../src/rendering/RenderScene";

interface Harness {
  readonly physics: PhysicsWorld;
  readonly scene: RenderScene;
  readonly runtime: LevelRuntimeManager;
}

const harnesses: Harness[] = [];

async function createHarness(definitions = TRAINING_TEST_LEVEL_DEFINITIONS): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: 1 / 60,
  });

  await physics.initialize();

  const scene = new RenderScene();
  const runtime = new LevelRuntimeManager({ scene, physics, definitions });
  const harness = { physics, scene, runtime };

  harnesses.push(harness);

  return harness;
}

afterEach(async () => {
  for (const harness of harnesses) {
    await harness.runtime.unloadLevel();
    harness.runtime.dispose();
    harness.physics.dispose();
  }

  harnesses.length = 0;
});

describe("LevelRuntimeManager lifecycle", () => {
  it("loads the authored level with spawn points, triggers, surfaces, and objects", async () => {
    const harness = await createHarness();
    const session = await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);

    expect(session.state).toBe("ready");
    expect(session.levelId).toBe(TRAINING_TEST_LEVEL_ID);
    expect(harness.runtime.getCurrentSession()?.id).toBe(session.id);
    expect(harness.runtime.getCurrentLevel()?.displayName).toBe("Training — Movement Yard");
    expect(harness.scene.scene.background).toBeInstanceOf(Object);
    expect(
      TRAINING_TEST_LEVEL.decorations?.every((decoration) => decoration.sectionId.length > 0),
    ).toBe(true);
    expect(harness.runtime.getInitialSpawnPoint()?.id).toBe("sp_initial");

    const snapshot = harness.runtime.getSnapshot();

    expect(snapshot.spawnPointCount).toBe(6);
    expect(snapshot.triggerCount).toBe(6);
    expect(snapshot.objectSurfaceCount).toBe(TRAINING_TEST_LEVEL.geometry.length);
    expect(snapshot.activeTriggerCount).toBe(0);
    expect(snapshot.interactionTargetCount).toBe(1);
    expect(snapshot.objectCount).toBeGreaterThan(TRAINING_TEST_LEVEL.geometry.length);
    expect(snapshot.activeSectionId).toBeNull();
    expect(harness.scene.scene.children.length).toBeGreaterThan(3);
  });

  it("restores the default scene atmosphere when a level unloads", async () => {
    const harness = await createHarness();

    await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);
    const loadedBackground = harness.scene.scene.background as { getHex(): number };

    expect(loadedBackground.getHex()).toBe(TRAINING_ENVIRONMENT.skyColor);

    await harness.runtime.unloadLevel();

    const restoredBackground = harness.scene.scene.background as { getHex(): number };

    expect(restoredBackground.getHex()).toBe(0xa7b9c4);
  });

  it("rejects unknown level ids and invalid definitions", async () => {
    const harness = await createHarness();

    await expect(harness.runtime.loadLevel("missing_level")).rejects.toMatchObject({
      code: "LEVEL_NOT_FOUND",
    });

    const invalidManager = new LevelRuntimeManager({
      scene: harness.scene,
      physics: harness.physics,
      definitions: [
        {
          ...TRAINING_TEST_LEVEL,
          id: "invalid_level",
          checkpoints: TRAINING_TEST_LEVEL.checkpoints.map((checkpoint) =>
            checkpoint.id === "cp_rooftop"
              ? { ...checkpoint, spawnPointId: "missing_spawn" }
              : checkpoint,
          ),
        },
      ],
    });

    await expect(invalidManager.loadLevel("invalid_level")).rejects.toMatchObject({
      code: "INVALID_LEVEL_DEFINITION",
    });
    expect(invalidManager.getCurrentSession()).toBeNull();

    invalidManager.dispose();
  });

  it("starts the session and activates the initial section", async () => {
    const harness = await createHarness();
    const events: string[] = [];

    harness.runtime.on("level:loading", () => events.push("loading"));
    harness.runtime.on("level:ready", () => events.push("ready"));
    harness.runtime.on("level:started", () => events.push("started"));
    harness.runtime.on("section:activated", (event) => events.push(`section:${event.sectionId}`));

    await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);
    await harness.runtime.startSession();

    const session = harness.runtime.getCurrentSession();

    expect(session?.state).toBe("active");
    expect(session?.startedAt).toBeTypeOf("number");
    expect(harness.runtime.getActiveSectionId()).toBe("sec_start");
    expect(harness.runtime.getSection("sec_start")?.state).toBe("active");
    expect(harness.runtime.getSection("sec_traversal")?.state).toBe("loaded");
    expect(events).toEqual(["loading", "ready", "section:sec_start", "started"]);
    expect(harness.runtime.getSnapshot().activeTriggerCount).toBe(3);
  });

  it("rejects starting or transitioning from invalid states", async () => {
    const harness = await createHarness();

    await expect(harness.runtime.startSession()).rejects.toMatchObject({
      code: "INVALID_SESSION_STATE",
    });

    await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);
    await harness.runtime.startSession();

    await expect(harness.runtime.activateSection("sec_finish")).rejects.toMatchObject({
      code: "TRANSITION_FAILED",
    });

    // Re-activating the active section is a deterministic no-op.
    const events: string[] = [];

    harness.runtime.on("section:activated", (event) => events.push(event.sectionId));
    await harness.runtime.activateSection("sec_start");

    expect(events).toEqual([]);
  });

  it("activates sections through authored entry triggers", async () => {
    const harness = await createHarness();
    const enteredCheckpoints: string[] = [];
    const activatedSections: string[] = [];

    harness.runtime.on("trigger:enter", (event) => {
      const checkpointId = event.metadata?.checkpointId;

      if (checkpointId) {
        enteredCheckpoints.push(checkpointId);
      }
    });
    harness.runtime.on("section:activated", (event) => activatedSections.push(event.sectionId));

    await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);
    await harness.runtime.startSession();

    harness.runtime.update({ x: 0, y: 0.93, z: 6 }, 1000);

    expect(enteredCheckpoints).toEqual([]);

    harness.runtime.update({ x: 0, y: 0.93, z: 4 }, 1100);
    expect(enteredCheckpoints).toEqual(["cp_rooftop"]);

    harness.runtime.update({ x: 0, y: 0.93, z: -1.5 }, 1200);
    expect(activatedSections).toContain("sec_traversal");
    expect(harness.runtime.getActiveSectionId()).toBe("sec_traversal");

    harness.runtime.update({ x: 0, y: 0.93, z: -4 }, 1300);
    expect(enteredCheckpoints).toEqual(["cp_rooftop", "cp_industrial"]);

    harness.runtime.update({ x: 0, y: 0.93, z: -16.5 }, 1400);
    harness.runtime.update({ x: 0, y: 0.93, z: -18.5 }, 1500);

    expect(harness.runtime.getActiveSectionId()).toBe("sec_finish");
    expect(enteredCheckpoints).toEqual(["cp_rooftop", "cp_industrial", "cp_skybridge"]);
  });

  it("does not evaluate triggers from inactive sections", async () => {
    const harness = await createHarness();
    const entries: string[] = [];

    harness.runtime.on("trigger:enter", (event) => entries.push(event.triggerId));

    await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);
    await harness.runtime.startSession();

    harness.runtime.update({ x: 0, y: 0.93, z: -4 }, 100);

    expect(entries).toEqual([]);

    await harness.runtime.activateSection("sec_traversal");
    harness.runtime.update({ x: 0, y: 0.93, z: -4 }, 200);

    expect(entries).toContain("trigger_cp_industrial");
  });

  it("pauses trigger evaluation and resumes it", async () => {
    const harness = await createHarness();
    const entries: string[] = [];

    harness.runtime.on("trigger:enter", (event) => entries.push(event.triggerId));

    await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);
    await harness.runtime.startSession();

    harness.runtime.pauseSession();
    harness.runtime.update({ x: 0, y: 0.93, z: 4 }, 100);

    expect(entries).toEqual([]);
    expect(harness.runtime.getCurrentSession()?.state).toBe("paused");

    harness.runtime.resumeSession();
    harness.runtime.update({ x: 0, y: 0.93, z: 4 }, 200);

    expect(entries).toContain("trigger_cp_rooftop");
  });

  it("completes a session and stops trigger evaluation", async () => {
    const harness = await createHarness();
    const entries: string[] = [];

    harness.runtime.on("trigger:enter", (event) => entries.push(event.triggerId));

    await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);
    await harness.runtime.startSession();
    await harness.runtime.completeSession();

    expect(harness.runtime.getCurrentSession()?.state).toBe("completed");
    expect(harness.runtime.getCurrentSession()?.completedAt).toBeTypeOf("number");

    harness.runtime.update({ x: 0, y: 0.93, z: 4 }, 300);

    expect(entries).toEqual([]);
  });

  it("cancels a pending load through AbortSignal", async () => {
    const harness = await createHarness();
    const controller = new AbortController();

    controller.abort();

    await expect(
      harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "INITIALIZATION_CANCELLED" });

    expect(harness.runtime.getCurrentSession()).toBeNull();
    expect(harness.runtime.getSnapshot().objectCount).toBe(0);
  });
});

describe("LevelRuntimeManager resource lifecycle", () => {
  it("unloads all level content and supports reloading with a new session", async () => {
    const harness = await createHarness();
    const baselineChildren = harness.scene.scene.children.length;

    const firstSession = await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);

    await harness.runtime.startSession();

    const loadedChildren = harness.scene.scene.children.length;

    expect(loadedChildren).toBeGreaterThan(baselineChildren);

    await harness.runtime.unloadLevel();

    expect(harness.runtime.getCurrentSession()).toBeNull();
    expect(harness.runtime.getCurrentLevel()).toBeNull();
    expect(harness.runtime.getActiveSectionId()).toBeNull();
    expect(harness.scene.scene.children.length).toBe(baselineChildren);

    const snapshot = harness.runtime.getSnapshot();

    expect(snapshot.objectCount).toBe(0);
    expect(snapshot.triggerCount).toBe(0);
    expect(snapshot.objectSurfaceCount).toBe(0);
    expect(snapshot.spawnPointCount).toBe(0);

    await harness.runtime.unloadLevel();

    const secondSession = await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);

    await harness.runtime.startSession();

    expect(secondSession.id).not.toBe(firstSession.id);
    expect(harness.scene.scene.children.length).toBe(loadedChildren);
  });

  it("exposes traversal surface metadata", async () => {
    const harness = await createHarness();

    await harness.runtime.loadLevel(TRAINING_TEST_LEVEL_ID);
    await harness.runtime.startSession();

    const ground = harness.runtime.getSurfaceAt({ x: 0, y: 0.02, z: 0 });
    const surfaces = harness.runtime.getSurfaces();
    const wallRun = surfaces.find((surface) => surface.definition.wallRunSurface);
    const vault = surfaces.find((surface) => surface.definition.vaultObstacle);

    expect(ground?.definition.surfaceType).toBe("concrete");
    expect(ground?.definition.walkable).toBe(true);
    expect(ground?.definition.landingSurface).toBe(true);
    expect(wallRun?.definition.wallJumpSurface).toBe(true);
    expect(vault?.definition.surfaceType).toBe("concrete");
    expect(surfaces.length).toBe(TRAINING_TEST_LEVEL.geometry.length);

    await harness.runtime.unloadLevel();

    expect(harness.runtime.getSurfaces()).toEqual([]);
  });

  it("rejects duplicate level definitions at construction", async () => {
    const harness = await createHarness();

    expect(
      () =>
        new LevelRuntimeManager({
          scene: harness.scene,
          physics: harness.physics,
          definitions: [TRAINING_TEST_LEVEL, TRAINING_TEST_LEVEL],
        }),
    ).toThrow(/Duplicate level definition/);
  });

  it("reports structured errors", () => {
    const error = new LevelRuntimeError("TRANSITION_FAILED", "blocked", {
      levelId: "l",
      sectionId: "s",
      recoverable: true,
    });

    expect(error.code).toBe("TRANSITION_FAILED");
    expect(error.levelId).toBe("l");
    expect(error.sectionId).toBe("s");
    expect(error.recoverable).toBe(true);
  });
});
