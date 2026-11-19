import { afterEach, describe, expect, it } from "vitest";

import { type CheckpointDefinition, CheckpointSystem } from "../../src/checkpoint/CheckpointSystem";
import { LevelRuntimeManager } from "../../src/levels/LevelRuntimeManager";
import { validateLevelDefinition } from "../../src/levels/LevelValidator";
import {
  PROLOGUE_TEST_LEVEL,
  PROLOGUE_TEST_LEVEL_DEFINITIONS,
  PROLOGUE_TEST_LEVEL_ID,
} from "../../src/levels/test/PrologueTestLevel";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import { RenderScene } from "../../src/rendering/RenderScene";
import { createPrologueRoute } from "../../src/speedrun/PrologueRoute";
import { SpeedrunSystem } from "../../src/speedrun/SpeedrunSystem";

const FIXED_CLOCK_BASE = 1000;

interface Harness {
  readonly physics: PhysicsWorld;
  readonly scene: RenderScene;
  readonly runtime: LevelRuntimeManager;
}

const harnesses: Harness[] = [];

async function createHarness(): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: 1 / 60,
  });

  await physics.initialize();

  const scene = new RenderScene();
  const runtime = new LevelRuntimeManager({
    scene,
    physics,
    definitions: PROLOGUE_TEST_LEVEL_DEFINITIONS,
  });
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

describe("Prologue level and route", () => {
  it("validates the authored five-section Prologue level", () => {
    const result = validateLevelDefinition(PROLOGUE_TEST_LEVEL);

    expect(result.valid).toBe(true);
    expect(PROLOGUE_TEST_LEVEL.sections).toHaveLength(5);
    expect(PROLOGUE_TEST_LEVEL.sections.map((section) => section.displayName)).toEqual([
      "Rooftop",
      "Industrial",
      "Construction",
      "Skybridge",
      "Finish",
    ]);
    expect(PROLOGUE_TEST_LEVEL.checkpoints).toHaveLength(5);
  });

  it("builds the Speedrun route from authored checkpoint order and finish trigger", () => {
    const route = createPrologueRoute(PROLOGUE_TEST_LEVEL);

    expect(route.checkpointOrder).toEqual([
      "cp_rooftop",
      "cp_industrial",
      "cp_construction",
      "cp_skybridge",
      "cp_finish",
    ]);
    expect(route.finishTriggerId).toBe("trigger_finish");
    expect(route.sections.map((section) => section.id)).toEqual([
      "sec_rooftop",
      "sec_industrial",
      "sec_construction",
      "sec_skybridge",
      "sec_finish",
    ]);
  });
});

describe("Prologue start-to-finish integration", () => {
  it("completes the route through sections, checkpoints, timer, and finish validation", async () => {
    const harness = await createHarness();
    const level = PROLOGUE_TEST_LEVEL;
    const route = createPrologueRoute(level);

    await harness.runtime.loadLevel(PROLOGUE_TEST_LEVEL_ID);
    await harness.runtime.startSession();

    const levelSession = harness.runtime.getCurrentSession();

    if (!levelSession) {
      throw new Error("Level session missing.");
    }

    const spawnResolver = {
      resolve: (spawnPointId: string) => {
        const spawnPoint = harness.runtime.resolveSpawnPoint(spawnPointId);

        return spawnPoint
          ? { position: spawnPoint.position, rotationY: spawnPoint.rotationY }
          : null;
      },
    };
    const checkpointDefinitions: CheckpointDefinition[] = level.checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      levelId: level.id,
      sectionId: checkpoint.sectionId,
      spawnPointId: checkpoint.spawnPointId,
      displayName: checkpoint.displayName,
      activationMode: "automatic",
      enabled: true,
      repeatable: true,
      respawnEnabled: true,
      ...(checkpoint.order === undefined ? {} : { order: checkpoint.order }),
    }));
    const checkpoints = new CheckpointSystem(checkpointDefinitions, {
      levelId: level.id,
      sessionId: levelSession.id,
      spawnResolver,
    });

    let now = FIXED_CLOCK_BASE;
    const speedrun = new SpeedrunSystem({ route, clock: () => now });

    speedrun.prepare(levelSession.id);
    speedrun.startRun();

    let finishTriggerId: string | null = null;

    harness.runtime.on("trigger:enter", (event) => {
      const checkpointId = event.metadata?.checkpointId;

      if (checkpointId) {
        const activation = checkpoints.notifyTriggerEnter(checkpointId, event.timestamp);

        if (activation) {
          speedrun.recordCheckpoint(activation.checkpointId);
        }

        return;
      }

      if (event.metadata?.kind === "finish") {
        finishTriggerId = event.triggerId;
      }
    });

    const waypoints = [
      { x: 0, y: 0.93, z: 4 },
      { x: 0, y: 0.93, z: 2.2 },
      { x: 0, y: 0.93, z: -2.5 },
      { x: 0, y: 0.93, z: -6.1 },
      { x: 0, y: 0.93, z: -8.5 },
      { x: 0, y: 0.93, z: -10.1 },
      { x: 0, y: -2.07, z: -27.5 },
      { x: 0, y: -0.5, z: -43 },
      { x: 0, y: 0.03, z: -46 },
      { x: 0, y: -0.5, z: -50.3 },
      { x: 0, y: -1.07, z: -66 },
      { x: 0, y: -0.5, z: -74 },
      { x: 0, y: 1.5, z: -86 },
      { x: 0, y: 3.5, z: -104 },
      { x: 0, y: 5.9, z: -130 },
    ];

    for (const waypoint of waypoints) {
      now += 1500;
      harness.runtime.update(waypoint, now);
    }

    expect(checkpoints.getSnapshot().activatedCheckpointIds).toEqual([
      "cp_rooftop",
      "cp_industrial",
      "cp_construction",
      "cp_skybridge",
      "cp_finish",
    ]);
    expect(harness.runtime.getActiveSectionId()).toBe("sec_finish");
    expect(finishTriggerId).toBe("trigger_finish");
    expect(checkpoints.resolveRespawnDestination()).not.toBeNull();

    if (!finishTriggerId) {
      throw new Error("Finish trigger was not reached.");
    }

    now += 1000;
    const result = speedrun.finishRun(finishTriggerId);

    expect(result.validation.valid).toBe(true);
    expect(result.checkpointsCompleted).toBe(5);
    expect(result.splits.map((split) => split.checkpointId)).toEqual(route.checkpointOrder);
    expect(result.totalTimeMs).toBe(waypoints.length * 1500 + 1000);
    expect(result.medal).not.toBe("none");
    expect(speedrun.getState()).toBe("finished");

    speedrun.dispose();
    checkpoints.dispose();
  });
});
