import { afterEach, describe, expect, it } from "vitest";

import { type CheckpointDefinition, CheckpointSystem } from "../../src/checkpoint/CheckpointSystem";
import { FIRST_SECTION_SECTION_IDS } from "../../src/levels/first-section/FirstSectionLayout";
import {
  FIRST_SECTION_LEVEL,
  FIRST_SECTION_LEVEL_DEFINITIONS,
} from "../../src/levels/first-section/FirstSectionLevel";
import { LevelRuntimeManager } from "../../src/levels/LevelRuntimeManager";
import type { LevelVector3 } from "../../src/levels/LevelTypes";
import { validateLevelDefinition } from "../../src/levels/LevelValidator";
import type { TriggerEvent } from "../../src/levels/TriggerManager";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld";
import type { MovementInputSample } from "../../src/player/MovementModel";
import { DEFAULT_MOVEMENT_TUNING } from "../../src/player/MovementTuning";
import { PlayerSystem } from "../../src/player/PlayerSystem";
import { RenderScene } from "../../src/rendering/RenderScene";
import { type RespawnCompletionEvent, RespawnManager } from "../../src/respawn/RespawnManager";

/**
 * First gameplay section — Level Runtime integration (`FIRST_GAMEPLAY_SECTION_SPEC`
 * §11.3 criteria 16–19, Step 3.3).
 *
 * The suite uses the real authored `FIRST_SECTION_LEVEL`, the production
 * `LevelRuntimeManager` / `BoxLevelContentLoader` stack, a real Rapier
 * `PhysicsWorld`, `RenderScene`, `CheckpointSystem`, `RespawnManager`, and
 * `PlayerSystem`. Section transitions happen only through authored
 * `section-entry` trigger volumes evaluated by the runtime; no test writes
 * section state directly and no authored geometry is copied.
 *
 * Completion, progression, checkpoint-threshold, and Speedrun isolation are
 * verified through the real `Application` composition root in the companion
 * suite `first-section-application-integration.test.ts`.
 */

const LEVEL = FIRST_SECTION_LEVEL;
const DT = 1 / 60;
const CASUAL_CLOCK_STEP_MS = 1000;

const SECTION_ORDER = [
  FIRST_SECTION_SECTION_IDS.start,
  FIRST_SECTION_SECTION_IDS.buildingJump,
  FIRST_SECTION_SECTION_IDS.technical,
  FIRST_SECTION_SECTION_IDS.slide,
  FIRST_SECTION_SECTION_IDS.vault,
  FIRST_SECTION_SECTION_IDS.finish,
] as const;

const IDLE_INPUT: MovementInputSample = {
  move: { x: 0, y: 0 },
  jumpPressed: false,
  jumpHeld: false,
  sprintHeld: false,
  crouchHeld: false,
  interactPressed: false,
};

type RouteStepKind = "spawn" | "checkpoint" | "section-entry" | "finish";

interface RouteStep {
  readonly id: string;
  readonly kind: RouteStepKind;
  readonly position: LevelVector3;
  readonly checkpointId?: string;
}

interface LevelEventRecord {
  readonly type: string;
  readonly sessionId: string;
  readonly levelId?: string;
}

interface Harness {
  readonly physics: PhysicsWorld;
  readonly scene: RenderScene;
  readonly runtime: LevelRuntimeManager;
  readonly levelEvents: LevelEventRecord[];
  readonly sectionEvents: { readonly sessionId: string; readonly sectionId: string }[];
  readonly triggerEntries: TriggerEvent[];
  readonly checkpointEvents: {
    readonly checkpointId: string;
    readonly sessionId: string;
  }[];
  readonly respawnEvents: RespawnCompletionEvent[];
  readonly cameraResets: number[];
  readonly inputStates: boolean[];
  readonly unsubscribes: (() => void)[];
  player: PlayerSystem | null;
  checkpoints: CheckpointSystem | null;
  respawn: RespawnManager | null;
  gameplayUnsubscribe: (() => void) | null;
  levelSessionId: string | null;
  finishTriggerId: string | null;
  nowMs: number;
}

const harnesses: Harness[] = [];

function requireItem<T>(item: T | undefined, label: string): T {
  if (item === undefined) {
    throw new Error(`FIRST_SECTION_LEVEL is missing ${label}.`);
  }

  return item;
}

function findTrigger(id: string) {
  return requireItem(
    LEVEL.triggers.find((trigger) => trigger.id === id),
    `trigger "${id}"`,
  );
}

function findSpawn(id: string) {
  return requireItem(
    LEVEL.spawnPoints.find((spawnPoint) => spawnPoint.id === id),
    `spawn point "${id}"`,
  );
}

function findCheckpoint(id: string) {
  return requireItem(
    LEVEL.checkpoints.find((checkpoint) => checkpoint.id === id),
    `checkpoint "${id}"`,
  );
}

function spawnPosition(id: string): LevelVector3 {
  return { ...findSpawn(id).position };
}

/**
 * The authored route in runtime order. Checkpoint steps use the authored
 * checkpoint spawn (the player stands inside the checkpoint volume); section
 * steps use the authored section-entry trigger centre; the finish step uses the
 * authored finish volume. No positions are invented.
 *
 * `trigger_to_slide` is called out explicitly: the Technical Passage has no
 * checkpoint, so a route built only from checkpoint records would skip it and
 * leave the Slide Section inactive.
 */
const AUTHORED_ROUTE: readonly {
  readonly id: string;
  readonly kind: RouteStepKind;
  readonly checkpointId?: string;
  readonly targetSectionId?: string;
}[] = [
  { id: "sp_initial", kind: "spawn" },
  { id: "cp_start", kind: "checkpoint", checkpointId: "cp_start" },
  {
    id: "trigger_to_building_jump",
    kind: "section-entry",
    targetSectionId: FIRST_SECTION_SECTION_IDS.buildingJump,
  },
  { id: "cp_building_jump", kind: "checkpoint", checkpointId: "cp_building_jump" },
  {
    id: "trigger_to_technical",
    kind: "section-entry",
    targetSectionId: FIRST_SECTION_SECTION_IDS.technical,
  },
  {
    id: "trigger_to_slide",
    kind: "section-entry",
    targetSectionId: FIRST_SECTION_SECTION_IDS.slide,
  },
  { id: "cp_slide", kind: "checkpoint", checkpointId: "cp_slide" },
  {
    id: "trigger_to_vault",
    kind: "section-entry",
    targetSectionId: FIRST_SECTION_SECTION_IDS.vault,
  },
  { id: "cp_vault", kind: "checkpoint", checkpointId: "cp_vault" },
  {
    id: "trigger_to_finish",
    kind: "section-entry",
    targetSectionId: FIRST_SECTION_SECTION_IDS.finish,
  },
  { id: "trigger_finish", kind: "finish" },
];

function buildRouteSteps(): RouteStep[] {
  return AUTHORED_ROUTE.map((entry) => {
    if (entry.kind === "spawn") {
      return {
        id: entry.id,
        kind: entry.kind,
        position: spawnPosition(entry.id),
      };
    }

    if (entry.kind === "checkpoint") {
      const checkpointId = requireItem(entry.checkpointId, `checkpoint id for "${entry.id}"`);
      const checkpoint = findCheckpoint(checkpointId);

      return {
        id: entry.id,
        kind: entry.kind,
        position: spawnPosition(checkpoint.spawnPointId),
        checkpointId,
      };
    }

    const trigger = findTrigger(entry.id);

    if (
      entry.targetSectionId !== undefined &&
      trigger.metadata?.targetSectionId !== entry.targetSectionId
    ) {
      throw new Error(
        `Trigger "${entry.id}" targets "${trigger.metadata?.targetSectionId}", expected "${entry.targetSectionId}".`,
      );
    }

    if (entry.kind === "finish" && trigger.metadata?.kind !== "finish") {
      throw new Error(`Trigger "${entry.id}" is not the authored finish trigger.`);
    }

    return {
      id: entry.id,
      kind: entry.kind,
      position: { ...trigger.center },
    };
  });
}

async function createHarness(): Promise<Harness> {
  const physics = new PhysicsWorld({
    gravity: { x: 0, y: -9.81, z: 0 },
    timestepSeconds: DT,
  });

  await physics.initialize();

  const scene = new RenderScene();
  const runtime = new LevelRuntimeManager({
    scene,
    physics,
    definitions: FIRST_SECTION_LEVEL_DEFINITIONS,
  });
  const harness: Harness = {
    physics,
    scene,
    runtime,
    levelEvents: [],
    sectionEvents: [],
    triggerEntries: [],
    checkpointEvents: [],
    respawnEvents: [],
    cameraResets: [],
    inputStates: [],
    unsubscribes: [],
    player: null,
    checkpoints: null,
    respawn: null,
    gameplayUnsubscribe: null,
    levelSessionId: null,
    finishTriggerId: null,
    nowMs: 1000,
  };

  harness.unsubscribes.push(
    runtime.on("level:loading", (event) => harness.levelEvents.push({ type: "loading", ...event })),
    runtime.on("level:ready", (event) => harness.levelEvents.push({ type: "ready", ...event })),
    runtime.on("level:started", (event) => harness.levelEvents.push({ type: "started", ...event })),
    runtime.on("level:completed", (event) =>
      harness.levelEvents.push({ type: "completed", ...event }),
    ),
    runtime.on("level:unloading", (event) =>
      harness.levelEvents.push({ type: "unloading", ...event }),
    ),
    runtime.on("level:unloaded", (event) =>
      harness.levelEvents.push({ type: "unloaded", ...event }),
    ),
    runtime.on("level:failed", (event) =>
      harness.levelEvents.push({ type: "failed", sessionId: event.sessionId }),
    ),
    runtime.on("section:activated", (event) =>
      harness.sectionEvents.push({
        sessionId: event.sessionId,
        sectionId: event.sectionId,
      }),
    ),
    runtime.on("trigger:enter", (event) => harness.triggerEntries.push(event)),
  );

  harnesses.push(harness);

  return harness;
}

async function createLoadedHarness(): Promise<Harness> {
  const harness = await createHarness();

  await harness.runtime.loadLevel(LEVEL.id);

  return harness;
}

function checkpointDefinitions(): CheckpointDefinition[] {
  return LEVEL.checkpoints.map((checkpoint) => ({
    id: checkpoint.id,
    levelId: LEVEL.id,
    sectionId: checkpoint.sectionId,
    spawnPointId: checkpoint.spawnPointId,
    displayName: checkpoint.displayName,
    activationMode: checkpoint.activationMode ?? "automatic",
    enabled: checkpoint.enabled ?? true,
    repeatable: checkpoint.repeatable ?? true,
    respawnEnabled: checkpoint.respawnEnabled ?? true,
    ...(checkpoint.order === undefined ? {} : { order: checkpoint.order }),
  }));
}

function handleTriggerEnter(harness: Harness, event: TriggerEvent): void {
  if (event.eventType !== "enter") {
    return;
  }

  const checkpointId = event.metadata?.checkpointId;

  if (checkpointId) {
    harness.checkpoints?.notifyTriggerEnter(checkpointId, event.timestamp);

    return;
  }

  if (event.metadata?.kind === "kill-volume") {
    harness.respawn?.request("fall");

    return;
  }

  if (event.metadata?.kind === "finish") {
    harness.finishTriggerId = event.triggerId;
  }
}

function attachGameplaySystems(harness: Harness): void {
  const level = harness.runtime.getCurrentLevel();
  const levelSession = harness.runtime.getCurrentSession();
  const initialSpawn = harness.runtime.getInitialSpawnPoint();

  if (!level || !levelSession || !initialSpawn) {
    throw new Error("Gameplay attachment requires a loaded level session.");
  }

  harness.levelSessionId = levelSession.id;

  const player = new PlayerSystem(harness.physics, {
    tuning: DEFAULT_MOVEMENT_TUNING,
    spawnPoint: initialSpawn.position,
    isWallRunnable: (position) =>
      harness.runtime.getSurfaceContaining(position)?.definition.wallRunSurface ?? false,
  });

  harness.player = player;

  const checkpoints = new CheckpointSystem(checkpointDefinitions(), {
    levelId: level.id,
    sessionId: levelSession.id,
    spawnResolver: {
      resolve: (spawnPointId) => {
        const spawnPoint = harness.runtime.resolveSpawnPoint(spawnPointId);

        return spawnPoint
          ? { position: spawnPoint.position, rotationY: spawnPoint.rotationY }
          : null;
      },
    },
  });

  harness.checkpoints = checkpoints;
  checkpoints.subscribe((event) => {
    harness.checkpointEvents.push({
      checkpointId: event.checkpointId,
      sessionId: event.sessionId,
    });
  });

  const respawn = new RespawnManager(
    {
      checkpoints,
      player,
      camera: {
        resetForRespawn: (rotationY) => {
          harness.cameraResets.push(rotationY);
        },
      },
      input: {
        setEnabled: (enabled) => {
          harness.inputStates.push(enabled);
        },
      },
    },
    {
      fallbackSpawn: initialSpawn.position,
      fallbackRotationY: initialSpawn.rotationY,
    },
  );

  harness.respawn = respawn;
  respawn.subscribe((event) => {
    harness.respawnEvents.push(event);
  });

  harness.gameplayUnsubscribe = harness.runtime.on("trigger:enter", (event) =>
    handleTriggerEnter(harness, event),
  );
}

function detachGameplaySystems(harness: Harness): void {
  harness.gameplayUnsubscribe?.();
  harness.gameplayUnsubscribe = null;
  harness.respawn?.dispose();
  harness.respawn = null;
  harness.checkpoints?.dispose();
  harness.checkpoints = null;
  harness.player?.dispose();
  harness.player = null;
}

function gameplayRoute(harness: Harness, steps: readonly RouteStep[]): void {
  const player = harness.player;

  if (!player) {
    throw new Error("Gameplay route requires an attached player.");
  }

  for (const step of steps) {
    harness.nowMs += CASUAL_CLOCK_STEP_MS;
    player.teleportTo(step.position);
    harness.runtime.update(player.getPosition(), harness.nowMs);
  }
}

function runtimeRoute(harness: Harness, steps: readonly RouteStep[]): void {
  for (const step of steps) {
    harness.nowMs += CASUAL_CLOCK_STEP_MS;
    harness.runtime.update(step.position, harness.nowMs);
  }
}

function fixedStep(harness: Harness, nowMs: number): void {
  const player = harness.player;

  if (!player) {
    throw new Error("Fixed step requires an attached player.");
  }

  player.fixedUpdate(IDLE_INPUT, 0, DT);
  harness.runtime.update(player.getPosition(), nowMs);
  harness.physics.step();
}

function fallProbe(sectionId: string): LevelVector3 {
  const geometry = LEVEL.geometry.filter((candidate) => candidate.sectionId === sectionId);

  if (geometry.length === 0) {
    throw new Error(`Section "${sectionId}" has no authored geometry.`);
  }

  const maxHalfX = Math.max(
    ...geometry.map((candidate) => Math.abs(candidate.position.x) + candidate.size.x / 2),
  );
  const maxTop = Math.max(
    ...geometry.map((candidate) => candidate.position.y + candidate.size.y / 2),
  );
  const section = requireItem(
    LEVEL.sections.find((candidate) => candidate.id === sectionId),
    `section "${sectionId}"`,
  );
  const entry = findSpawn(section.entrySpawnPointId);

  return { x: maxHalfX + 1, y: maxTop + 1, z: entry.position.z - 0.5 };
}

afterEach(async () => {
  for (const harness of harnesses) {
    detachGameplaySystems(harness);

    for (const unsubscribe of harness.unsubscribes) {
      unsubscribe();
    }

    harness.unsubscribes.length = 0;

    await harness.runtime.unloadLevel();
    harness.runtime.dispose();
    harness.scene.dispose();
    harness.physics.dispose();
  }

  harnesses.length = 0;
});

describe("First Section loading and registration", () => {
  it("loads first_section and activates the authored initial section", async () => {
    const harness = await createLoadedHarness();
    const session = harness.runtime.getCurrentSession();

    expect(session).not.toBeNull();
    expect(session?.levelId).toBe("first_section");
    expect(session?.levelVersion).toBe(LEVEL.version);
    expect(session?.mode).toBe("prologue");
    expect(session?.state).toBe("ready");
    expect(harness.runtime.getCurrentLevel()?.id).toBe("first_section");
    expect(harness.runtime.getInitialSpawnPoint()?.id).toBe(LEVEL.initialSpawnPointId);
    expect(harness.runtime.getInitialSpawnPoint()?.position).toEqual(
      findSpawn(LEVEL.initialSpawnPointId).position,
    );

    const ready = harness.runtime.getSnapshot();

    expect(ready.sections).toHaveLength(SECTION_ORDER.length);
    expect(ready.sections.map((section) => section.id)).toEqual([...SECTION_ORDER]);
    expect(ready.sections.every((section) => section.state === "loaded")).toBe(true);
    expect(ready.activeSectionId).toBeNull();
    expect(ready.activeTriggerCount).toBe(0);
    expect(ready.spawnPointCount).toBe(LEVEL.spawnPoints.length);
    expect(ready.triggerCount).toBe(LEVEL.triggers.length);
    expect(ready.objectSurfaceCount).toBe(LEVEL.geometry.length);
    expect(ready.interactionTargetCount).toBe(0);
    expect(ready.sessionId).toBe(session?.id);
    expect(ready.lastError).toBeNull();

    if (!session) {
      throw new Error("Level session missing.");
    }

    expect(harness.levelEvents).toEqual([
      { type: "loading", sessionId: session.id, levelId: "first_section" },
      { type: "ready", sessionId: session.id, levelId: "first_section" },
    ]);

    await harness.runtime.startSession();

    const running = harness.runtime.getCurrentSession();

    expect(running?.state).toBe("active");
    expect(running?.id).toBe(session.id);
    expect(running?.currentSectionId).toBe(FIRST_SECTION_SECTION_IDS.start);
    expect(harness.runtime.getActiveSectionId()).toBe(FIRST_SECTION_SECTION_IDS.start);
    expect(harness.runtime.getSection(FIRST_SECTION_SECTION_IDS.start)?.state).toBe("active");

    for (const sectionId of SECTION_ORDER.slice(1)) {
      expect(harness.runtime.getSection(sectionId)?.state).toBe("loaded");
    }

    expect(harness.runtime.getSnapshot().activeTriggerCount).toBe(3);
    expect(harness.sectionEvents).toEqual([
      { sessionId: session.id, sectionId: FIRST_SECTION_SECTION_IDS.start },
    ]);
    expect(harness.levelEvents.map((event) => event.type)).toEqual(["loading", "ready", "started"]);
    expect(harness.levelEvents.at(-1)?.sessionId).toBe(session.id);
  });

  it("registers authored geometry, surfaces, spawns, triggers, and checkpoints without broken references", async () => {
    const harness = await createLoadedHarness();
    const baselineBodies = harness.physics.rapierWorld.bodies.len();
    const baselineColliders = harness.physics.rapierWorld.colliders.len();
    const validation = validateLevelDefinition(LEVEL);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);

    // Loading is the only thing that registered the authored colliders.
    expect(baselineBodies).toBe(LEVEL.geometry.length);
    expect(baselineColliders).toBe(LEVEL.geometry.length);

    const snapshot = harness.runtime.getSnapshot();

    expect(snapshot.objectSurfaceCount).toBe(LEVEL.geometry.length);
    expect(snapshot.objectCount).toBe(
      LEVEL.geometry.length +
        LEVEL.spawnPoints.length +
        LEVEL.triggers.length +
        LEVEL.checkpoints.length,
    );
    expect(snapshot.interactionTargetCount).toBe(0);

    const surfaces = harness.runtime.getSurfaces();

    expect(surfaces).toHaveLength(LEVEL.geometry.length);

    for (const geometry of LEVEL.geometry) {
      const surface = surfaces.find((candidate) => candidate.id === geometry.id);

      expect(surface, geometry.id).toBeDefined();
      expect(surface?.sectionId).toBe(geometry.sectionId);
      expect(surface?.active).toBe(true);
      expect(harness.runtime.getSurfaceContaining(geometry.position)).not.toBeNull();
    }

    for (const spawnPoint of LEVEL.spawnPoints) {
      const resolved = harness.runtime.resolveSpawnPoint(spawnPoint.id);

      expect(resolved, spawnPoint.id).not.toBeNull();
      expect(resolved?.position).toEqual(spawnPoint.position);
      expect(resolved?.sectionId).toBe(spawnPoint.sectionId);
      expect(resolved?.enabled).toBe(true);
    }

    // One namespace: every authored checkpoint resolves its own trigger and
    // spawn through the live runtime, not through the definition array.
    for (const checkpoint of LEVEL.checkpoints) {
      const resolvedSpawn = harness.runtime.resolveSpawnPoint(checkpoint.spawnPointId);
      const trigger = findTrigger(checkpoint.triggerId);

      expect(resolvedSpawn, checkpoint.id).not.toBeNull();
      expect(trigger.type).toBe("checkpoint");
      expect(trigger.metadata?.checkpointId).toBe(checkpoint.id);
      expect(trigger.sectionId).toBe(checkpoint.sectionId);
    }

    // Initial spawn resolves to the first authored section's walkable roof.
    const initialSpawn = harness.runtime.getInitialSpawnPoint();

    expect(initialSpawn).not.toBeNull();

    if (!initialSpawn) {
      throw new Error("Initial spawn missing.");
    }

    const feet = {
      x: initialSpawn.position.x,
      y: initialSpawn.position.y - DEFAULT_MOVEMENT_TUNING.capsuleHeight / 2,
      z: initialSpawn.position.z,
    };
    const underfoot = harness.runtime.getSurfaceAt(feet);

    expect(underfoot).not.toBeNull();
    expect(underfoot?.definition.walkable).toBe(true);
    expect(underfoot?.sectionId).toBe(FIRST_SECTION_SECTION_IDS.start);

    await harness.runtime.startSession();

    expect(harness.runtime.getSnapshot().lastError).toBeNull();
    expect(harness.levelEvents.some((event) => event.type === "failed")).toBe(false);
  });
});

describe("First Section authored route", () => {
  it("walks all six sections in authored order through real trigger volumes", async () => {
    const harness = await createLoadedHarness();

    await harness.runtime.startSession();

    const session = harness.runtime.getCurrentSession();

    if (!session) {
      throw new Error("Level session missing.");
    }

    runtimeRoute(harness, buildRouteSteps());

    expect(harness.sectionEvents.map((event) => event.sectionId)).toEqual([...SECTION_ORDER]);
    expect(harness.sectionEvents.every((event) => event.sessionId === session.id)).toBe(true);
    expect(harness.runtime.getActiveSectionId()).toBe(FIRST_SECTION_SECTION_IDS.finish);
    expect(harness.runtime.getCurrentSession()?.state).toBe("active");
    expect(harness.runtime.getCurrentSession()?.id).toBe(session.id);
    expect(harness.runtime.getSnapshot().lastError).toBeNull();

    // The runtime never completes itself: only the Application completion flow
    // may turn the finish trigger into a completed gameplay session.
    expect(harness.levelEvents.some((event) => event.type === "completed")).toBe(false);
    expect(harness.finishTriggerId).toBeNull();

    const finishEntries = harness.triggerEntries.filter(
      (event) => event.metadata?.kind === "finish",
    );

    expect(finishEntries).toHaveLength(1);
    expect(finishEntries[0]?.triggerId).toBe("trigger_finish");
    expect(finishEntries[0]?.sectionId).toBe(FIRST_SECTION_SECTION_IDS.finish);
    expect(finishEntries[0]?.actorId).toBe("player");

    // The authored finish trigger is non-repeatable: leaving and re-entering
    // the volume must not publish a second finish or re-activate sec_finish.
    const finishPosition = buildRouteSteps().at(-1)?.position;

    if (!finishPosition) {
      throw new Error("Finish route step missing.");
    }

    harness.runtime.update({ x: 0, y: 5.43, z: -78 }, 50_000);
    harness.runtime.update(finishPosition, 51_000);

    expect(
      harness.triggerEntries.filter((event) => event.metadata?.kind === "finish"),
    ).toHaveLength(1);
    expect(harness.sectionEvents).toHaveLength(SECTION_ORDER.length);
  });

  it("reaches trigger_finish only after the fourth checkpoint and never duplicates section activation", async () => {
    const harness = await createLoadedHarness();

    await harness.runtime.startSession();
    attachGameplaySystems(harness);

    const steps = buildRouteSteps();
    const finishIndex = steps.findIndex((step) => step.kind === "finish");

    expect(finishIndex).toBeGreaterThan(0);

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];

      if (!step) {
        continue;
      }

      if (index === finishIndex) {
        expect(harness.checkpointEvents.map((event) => event.checkpointId)).toEqual([
          "cp_start",
          "cp_building_jump",
          "cp_slide",
          "cp_vault",
        ]);
      }

      gameplayRoute(harness, [step]);
    }

    expect(harness.sectionEvents.map((event) => event.sectionId)).toEqual([...SECTION_ORDER]);
    expect(harness.checkpointEvents.map((event) => event.checkpointId)).toEqual([
      "cp_start",
      "cp_building_jump",
      "cp_slide",
      "cp_vault",
    ]);
    expect(harness.runtime.getActiveSectionId()).toBe(FIRST_SECTION_SECTION_IDS.finish);
    expect(harness.finishTriggerId).toBe("trigger_finish");
    expect(harness.levelEvents.some((event) => event.type === "completed")).toBe(false);
    expect(harness.checkpoints?.getSnapshot().activatedCheckpointIds).toHaveLength(4);
  });
});

describe("First Section checkpoint and respawn integration", () => {
  it("activates every authored checkpoint through its trigger and selects the latest destination", async () => {
    const harness = await createLoadedHarness();

    await harness.runtime.startSession();
    attachGameplaySystems(harness);
    gameplayRoute(harness, buildRouteSteps());

    const checkpoints = harness.checkpoints;

    if (!checkpoints) {
      throw new Error("Checkpoint system missing.");
    }

    expect(harness.checkpointEvents.map((event) => event.checkpointId)).toEqual([
      "cp_start",
      "cp_building_jump",
      "cp_slide",
      "cp_vault",
    ]);
    expect(new Set(harness.checkpointEvents.map((event) => event.sessionId))).toEqual(
      new Set([harness.levelSessionId]),
    );
    expect(checkpoints.getSnapshot()).toMatchObject({
      levelId: "first_section",
      sessionId: harness.levelSessionId,
      activeCheckpointId: "cp_vault",
      activatedCheckpointIds: ["cp_start", "cp_building_jump", "cp_slide", "cp_vault"],
      revision: 4,
    });

    const destination = checkpoints.resolveRespawnDestination();
    const authored = findCheckpoint("cp_vault");
    const spawn = findSpawn(authored.spawnPointId);

    expect(destination).toEqual({
      checkpointId: "cp_vault",
      spawnPointId: spawn.id,
      position: spawn.position,
      rotationY: spawn.rotationY,
    });

    // A preferred activated checkpoint resolves deterministically without
    // changing the active checkpoint.
    expect(checkpoints.resolveRespawnDestination("cp_start")?.checkpointId).toBe("cp_start");
    expect(checkpoints.getActiveCheckpointId()).toBe("cp_vault");

    // Authored-but-not-activated and unknown ids cannot become destinations.
    expect(checkpoints.resolveRespawnDestination("cp_unknown")).toBeNull();
    expect(checkpoints.notifyTriggerEnter("cp_unknown", 1)).toBeNull();
    expect(checkpoints.notifyTriggerEnter("cp_start", 1)).toBeNull();
    expect(checkpoints.getSnapshot().revision).toBe(4);

    // A second system for another session starts clean and cannot resolve a
    // checkpoint from this session.
    const other = new CheckpointSystem(checkpointDefinitions(), {
      levelId: LEVEL.id,
      sessionId: "another-session",
      spawnResolver: {
        resolve: (spawnPointId) => {
          const spawnPoint = findSpawn(spawnPointId);

          return spawnPoint
            ? { position: spawnPoint.position, rotationY: spawnPoint.rotationY }
            : null;
        },
      },
    });

    expect(other.getSnapshot().activatedCheckpointIds).toEqual([]);
    expect(other.resolveRespawnDestination()).toBeNull();
    expect(other.getSnapshot().sessionId).not.toBe(harness.levelSessionId);
    other.dispose();
  });

  it("respawns at the active checkpoint after a real fall through the authored kill volume", async () => {
    const harness = await createLoadedHarness();

    await harness.runtime.startSession();
    attachGameplaySystems(harness);

    const cpSlideIndex = buildRouteSteps().findIndex((step) => step.id === "cp_slide");

    expect(cpSlideIndex).toBeGreaterThan(0);
    gameplayRoute(harness, buildRouteSteps().slice(0, cpSlideIndex + 1));

    const player = harness.player;
    const respawn = harness.respawn;
    const checkpoints = harness.checkpoints;

    if (!player || !respawn || !checkpoints) {
      throw new Error("Gameplay systems missing.");
    }

    expect(harness.runtime.getActiveSectionId()).toBe(FIRST_SECTION_SECTION_IDS.slide);
    expect(checkpoints.getActiveCheckpointId()).toBe("cp_slide");

    player.activate();

    const probe = fallProbe(FIRST_SECTION_SECTION_IDS.slide);

    player.teleportTo(probe);
    harness.physics.step();

    let now = 10_000;
    let detectedAtY = Number.NaN;
    let detectedTriggerId = "";
    let steps = 0;

    for (; steps < 240 && respawn.getLastDestination() === null; steps += 1) {
      now += 1000 * DT;

      if (respawn.isRespawning) {
        respawn.update(DT);
        harness.physics.step();
        continue;
      }

      player.fixedUpdate(IDLE_INPUT, 0, DT);

      const stepPosition = player.getPosition();

      harness.runtime.update(stepPosition, now);
      harness.physics.step();

      const killEntry = harness.triggerEntries.find(
        (event) =>
          event.eventType === "enter" &&
          event.metadata?.kind === "kill-volume" &&
          event.sectionId === FIRST_SECTION_SECTION_IDS.slide,
      );

      if (killEntry && respawn.getLastDestination()) {
        detectedAtY = stepPosition.y;
        detectedTriggerId = killEntry.triggerId;
      }
    }

    expect(respawn.getLastDestination(), "kill volume was not reached").not.toBeNull();
    expect(detectedTriggerId).toBe("trigger_void_sec_slide");
    expect(detectedAtY).toBeLessThanOrEqual(-3);
    expect(detectedAtY).toBeGreaterThan(-12);
    expect(respawn.getLastDestination()?.checkpointId).toBe("cp_slide");
    expect(respawn.getLastDestination()?.spawnPointId).toBe("sp_cp_slide");

    const destination = findSpawn("sp_cp_slide");

    // The RespawnManager places the player immediately, then restores control
    // after its deterministic recovery window.
    expect(player.getPosition()).toEqual(destination.position);
    expect(harness.cameraResets.at(-1)).toBe(destination.rotationY);

    for (let index = 0; index < 30 && respawn.isRespawning; index += 1) {
      respawn.update(DT);
      harness.physics.step();
    }

    expect(respawn.currentState).toBe("idle");
    expect(respawn.isRespawning).toBe(false);
    expect(harness.inputStates).toContain(false);
    expect(harness.inputStates.at(-1)).toBe(true);
    expect(harness.respawnEvents).toHaveLength(1);
    expect(harness.respawnEvents[0]?.reason).toBe("fall");
    expect(harness.respawnEvents[0]?.usedFallback).toBe(false);
    expect(harness.respawnEvents[0]?.destination?.checkpointId).toBe("cp_slide");

    // Movement state was reset: the body is reactivated at the checkpoint and
    // settles on the authored floor instead of continuing the fall.
    for (let index = 0; index < 30; index += 1) {
      now += 1000 * DT;
      fixedStep(harness, now);
    }

    const movement = player.getMovementSnapshot();

    expect(player.isActive).toBe(true);
    expect(movement.grounded).toBe(true);
    expect(movement.state).not.toBe("FALLING");
    expect(movement.speed).toBeLessThan(0.05);
    expect(player.getPosition().x).toBeCloseTo(destination.position.x, 2);
    expect(player.getPosition().z).toBeCloseTo(destination.position.z, 2);
    expect(player.getPosition().y).toBeCloseTo(destination.position.y, 1);
    expect(steps).toBeLessThan(240);
  });

  it("falls back to the initial spawn when no checkpoint has been activated", async () => {
    const harness = await createLoadedHarness();

    await harness.runtime.startSession();
    attachGameplaySystems(harness);

    const player = harness.player;
    const respawn = harness.respawn;

    if (!player || !respawn) {
      throw new Error("Gameplay systems missing.");
    }

    player.activate();
    player.teleportTo(fallProbe(FIRST_SECTION_SECTION_IDS.start));
    harness.physics.step();

    let now = 20_000;

    for (let index = 0; index < 240 && !respawn.isRespawning; index += 1) {
      now += 1000 * DT;

      player.fixedUpdate(IDLE_INPUT, 0, DT);
      harness.runtime.update(player.getPosition(), now);
      harness.physics.step();
    }

    expect(respawn.isRespawning).toBe(true);
    expect(respawn.getLastDestination()?.checkpointId).toBe("fallback");

    const initial = findSpawn(LEVEL.initialSpawnPointId);

    expect(player.getPosition()).toEqual(initial.position);
    expect(harness.respawnEvents).toHaveLength(0);

    for (let index = 0; index < 30 && respawn.isRespawning; index += 1) {
      respawn.update(DT);
      harness.physics.step();
    }

    expect(harness.respawnEvents).toHaveLength(1);
    expect(harness.respawnEvents[0]?.usedFallback).toBe(true);
    expect(harness.respawnEvents[0]?.destination?.position).toEqual(initial.position);
    expect(harness.checkpoints?.getSnapshot().activatedCheckpointIds).toEqual([]);
  });
});
