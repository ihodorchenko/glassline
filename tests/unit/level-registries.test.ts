import { describe, expect, it, vi } from "vitest";

import { LevelRuntimeError } from "../../src/levels/LevelRuntimeManager";
import type { LevelDefinition } from "../../src/levels/LevelTypes";
import { validateLevelDefinition } from "../../src/levels/LevelValidator";
import { RuntimeObjectRegistry } from "../../src/levels/RuntimeObjectRegistry";
import { SpawnPointManager } from "../../src/levels/SpawnPointManager";
import { SurfaceRegistry } from "../../src/levels/SurfaceRegistry";
import { TriggerManager } from "../../src/levels/TriggerManager";
import { TRAINING_TEST_LEVEL } from "../../src/levels/test/TrainingTestLevel";

describe("validateLevelDefinition", () => {
  it("accepts the authored training test level", () => {
    const result = validateLevelDefinition(TRAINING_TEST_LEVEL);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects duplicate ids and missing references", () => {
    const duplicateSpawn: LevelDefinition = {
      ...TRAINING_TEST_LEVEL,
      spawnPoints: [
        ...TRAINING_TEST_LEVEL.spawnPoints,
        {
          id: "sp_initial",
          sectionId: "sec_start",
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          type: "respawn",
        },
      ],
    };
    const duplicateResult = validateLevelDefinition(duplicateSpawn);

    expect(duplicateResult.valid).toBe(false);
    expect(duplicateResult.errors.some((error) => error.code === "DUPLICATE_ID")).toBe(true);

    const missingCheckpointSpawn: LevelDefinition = {
      ...TRAINING_TEST_LEVEL,
      checkpoints: TRAINING_TEST_LEVEL.checkpoints.map((checkpoint) =>
        checkpoint.id === "cp_rooftop"
          ? { ...checkpoint, spawnPointId: "missing_spawn" }
          : checkpoint,
      ),
    };
    const missingResult = validateLevelDefinition(missingCheckpointSpawn);

    expect(missingResult.valid).toBe(false);
    expect(missingResult.errors.some((error) => error.code === "MISSING_CHECKPOINT_SPAWN")).toBe(
      true,
    );
  });

  it("rejects missing checkpoint triggers and invalid section chains", () => {
    const missingTrigger: LevelDefinition = {
      ...TRAINING_TEST_LEVEL,
      checkpoints: TRAINING_TEST_LEVEL.checkpoints.map((checkpoint) =>
        checkpoint.id === "cp_industrial"
          ? { ...checkpoint, triggerId: "missing_trigger" }
          : checkpoint,
      ),
    };

    expect(
      validateLevelDefinition(missingTrigger).errors.some(
        (error) => error.code === "MISSING_CHECKPOINT_TRIGGER",
      ),
    ).toBe(true);

    const brokenChain: LevelDefinition = {
      ...TRAINING_TEST_LEVEL,
      sections: TRAINING_TEST_LEVEL.sections.map((section) =>
        section.id === "sec_start" ? { ...section, nextSectionId: "missing_section" } : section,
      ),
    };
    const brokenResult = validateLevelDefinition(brokenChain);

    expect(brokenResult.valid).toBe(false);
    expect(brokenResult.errors.some((error) => error.code === "MISSING_NEXT_SECTION")).toBe(true);
  });

  it("validates Prologue section count and ordering", () => {
    const invalidPrologue: LevelDefinition = {
      ...TRAINING_TEST_LEVEL,
      mode: "prologue",
    };
    const result = validateLevelDefinition(invalidPrologue);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "PROLOGUE_SECTION_COUNT")).toBe(true);
  });
});

describe("SpawnPointManager", () => {
  function createManager(): SpawnPointManager {
    const manager = new SpawnPointManager("sp_initial");

    manager.register({
      id: "sp_initial",
      sectionId: "sec_a",
      position: { x: 0, y: 1, z: 0 },
      rotationY: 0,
      type: "initial",
    });
    manager.register({
      id: "sp_entry_b",
      sectionId: "sec_b",
      position: { x: 0, y: 1, z: 5 },
      rotationY: 0.5,
      type: "transition",
    });
    manager.register({
      id: "sp_respawn_b",
      sectionId: "sec_b",
      position: { x: 2, y: 1, z: 5 },
      rotationY: 0,
      type: "respawn",
    });
    manager.register({
      id: "sp_checkpoint_b",
      sectionId: "sec_b",
      position: { x: 3, y: 1, z: 5 },
      rotationY: 0,
      type: "checkpoint",
    });

    return manager;
  }

  it("resolves the initial spawn and validates duplicates", () => {
    const manager = createManager();

    expect(manager.getInitialSpawnPoint()?.id).toBe("sp_initial");

    expect(() =>
      manager.register({
        id: "sp_initial",
        sectionId: "sec_a",
        position: { x: 0, y: 0, z: 0 },
        rotationY: 0,
        type: "initial",
      }),
    ).toThrow(/already registered/);
  });

  it("prefers respawn points within a section", () => {
    const manager = createManager();

    expect(manager.getSpawnPointForSection("sec_b")?.id).toBe("sp_respawn_b");
    expect(manager.resolveSpawnPoint({ sectionId: "sec_b" })?.id).toBe("sp_respawn_b");
  });

  it("uses explicit, section, fallback, and initial resolution order", () => {
    const manager = createManager();

    expect(manager.resolveSpawnPoint({ spawnPointId: "sp_checkpoint_b" })?.id).toBe(
      "sp_checkpoint_b",
    );
    expect(
      manager.resolveSpawnPoint({ sectionId: "missing", fallbackSpawnPointId: "sp_entry_b" })?.id,
    ).toBe("sp_entry_b");
    expect(manager.resolveSpawnPoint({ sectionId: "missing" })?.id).toBe("sp_initial");
  });

  it("ignores disabled explicit spawn points", () => {
    const manager = createManager();

    manager.setEnabled("sp_respawn_b", false);

    expect(manager.getSpawnPointForSection("sec_b")?.id).toBe("sp_checkpoint_b");
    expect(
      manager.resolveSpawnPoint({ spawnPointId: "sp_respawn_b", sectionId: "sec_b" })?.id,
    ).toBe("sp_checkpoint_b");
  });
});

describe("TriggerManager", () => {
  function createManager(): TriggerManager {
    const manager = new TriggerManager();

    manager.register({
      id: "trigger_a",
      sectionId: "sec_a",
      type: "checkpoint",
      center: { x: 0, y: 1, z: 0 },
      halfExtents: { x: 1, y: 1, z: 1 },
      repeatable: true,
      metadata: { checkpointId: "cp_a" },
    });
    manager.register({
      id: "trigger_once",
      sectionId: "sec_a",
      type: "section-entry",
      center: { x: 5, y: 1, z: 0 },
      halfExtents: { x: 1, y: 1, z: 1 },
      repeatable: false,
      metadata: { targetSectionId: "sec_b" },
    });

    return manager;
  }

  it("emits enter once while inside and exit when leaving", () => {
    const manager = createManager();

    const enter = manager.update({ x: 0, y: 1, z: 0 }, "player", 100);

    expect(enter).toHaveLength(1);
    expect(enter[0]).toMatchObject({
      triggerId: "trigger_a",
      actorId: "player",
      eventType: "enter",
      metadata: { checkpointId: "cp_a" },
    });

    expect(manager.update({ x: 0.2, y: 1, z: 0 }, "player", 200)).toEqual([]);

    const exit = manager.update({ x: 5, y: 1, z: 0 }, "player", 300);

    expect(
      exit.filter((event) => event.triggerId === "trigger_a").map((event) => event.eventType),
    ).toEqual(["exit"]);

    const finalExit = manager.update({ x: 9, y: 1, z: 0 }, "player", 400);

    expect(finalExit).toHaveLength(1);
    expect(finalExit[0]).toMatchObject({ triggerId: "trigger_once", eventType: "exit" });
  });

  it("does not repeat non-repeatable triggers", () => {
    const manager = createManager();

    expect(
      manager
        .update({ x: 5, y: 1, z: 0 }, "player", 100)
        .filter((event) => event.eventType === "enter"),
    ).toHaveLength(1);
    manager.update({ x: 9, y: 1, z: 0 }, "player", 200);

    expect(manager.update({ x: 5, y: 1, z: 0 }, "player", 300)).toEqual([]);
  });

  it("releases inside state when disabled or when a section is disabled", () => {
    const manager = createManager();

    manager.update({ x: 0, y: 1, z: 0 }, "player", 100);
    manager.disable("trigger_a");

    const events = manager.update({ x: 0, y: 1, z: 0 }, "player", 200);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ triggerId: "trigger_a", eventType: "exit" });

    manager.update({ x: 5, y: 1, z: 0 }, "player", 300);
    manager.disableSection("sec_a");

    expect(manager.update({ x: 5, y: 1, z: 0 }, "player", 400)[0]).toMatchObject({
      triggerId: "trigger_once",
      eventType: "exit",
    });
  });

  it("skips disabled triggers", () => {
    const manager = createManager();

    manager.setEnabled("trigger_a", false);

    expect(manager.update({ x: 0, y: 1, z: 0 }, "player", 100)).toEqual([]);
    expect(manager.update({ x: 0, y: 1, z: 0 }, "player", 200)).toEqual([]);
  });
});

describe("RuntimeObjectRegistry", () => {
  function object(
    id: string,
    sectionId: string,
    actions = {
      activate: () => undefined,
      deactivate: () => undefined,
      dispose: () => undefined,
    },
  ) {
    return {
      id,
      sectionId,
      objectType: "generic" as const,
      activate: actions.activate,
      deactivate: actions.deactivate,
      dispose: actions.dispose,
    };
  }

  it("registers unique objects and queries by section and type", () => {
    const registry = new RuntimeObjectRegistry();

    registry.register(object("a", "sec_a"));
    registry.register(object("b", "sec_b"));

    expect(registry.get("a")?.id).toBe("a");
    expect(registry.getBySection("sec_a").map((entry) => entry.id)).toEqual(["a"]);
    expect(registry.getCount()).toBe(2);
    expect(() => registry.register(object("a", "sec_a"))).toThrow(/already registered/);
  });

  it("activates and deactivates section objects", () => {
    const registry = new RuntimeObjectRegistry();
    const activateA = { activate: vi.fn(), deactivate: vi.fn(), dispose: vi.fn() };
    const activateB = { activate: vi.fn(), deactivate: vi.fn(), dispose: vi.fn() };

    registry.register(object("a", "sec_a", activateA));
    registry.register(object("b", "sec_b", activateB));

    registry.activateSection("sec_a");

    expect(activateA.activate).toHaveBeenCalledTimes(1);
    expect(activateB.activate).not.toHaveBeenCalled();

    registry.deactivateSection("sec_a");

    expect(activateA.deactivate).toHaveBeenCalledTimes(1);
  });

  it("aggregates activation failures and disposes all objects", () => {
    const registry = new RuntimeObjectRegistry();
    const dispose = vi.fn();

    registry.register(
      object("broken", "sec_a", {
        activate: () => {
          throw new Error("boom");
        },
        deactivate: () => undefined,
        dispose,
      }),
    );
    registry.register(object("ok", "sec_a"));

    const failures = registry.activateSection("sec_a");

    expect(failures).toHaveLength(1);
    expect(failures[0]?.objectId).toContain("broken");

    registry.disposeAll();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(registry.getCount()).toBe(0);
  });
});

describe("SurfaceRegistry", () => {
  const definition = {
    id: "surface_concrete",
    sectionId: "sec_a",
    surfaceType: "concrete" as const,
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
  };

  it("registers surfaces and looks them up by collider handle", () => {
    const registry = new SurfaceRegistry();

    registry.register({
      id: "geo_ground",
      sectionId: "sec_a",
      definition,
      colliderHandle: 42,
      bounds: { center: { x: 0, y: -0.1, z: 0 }, halfExtents: { x: 10, y: 0.1, z: 10 } },
      active: true,
    });

    expect(registry.getByColliderHandle(42)?.id).toBe("geo_ground");
    expect(registry.getBySection("sec_a")).toHaveLength(1);
    expect(() =>
      registry.register({
        id: "geo_ground",
        sectionId: "sec_a",
        definition,
        colliderHandle: 43,
        bounds: null,
        active: true,
      }),
    ).toThrow(/already registered/);
  });

  it("finds the active surface under a feet position", () => {
    const registry = new SurfaceRegistry();

    registry.register({
      id: "geo_ground",
      sectionId: "sec_a",
      definition,
      colliderHandle: 1,
      bounds: { center: { x: 0, y: -0.1, z: 0 }, halfExtents: { x: 10, y: 0.1, z: 10 } },
      active: true,
    });

    expect(registry.getSurfaceAt({ x: 0, y: 0.02, z: 0 })?.id).toBe("geo_ground");
    expect(registry.getSurfaceAt({ x: 50, y: 0.02, z: 0 })).toBeNull();

    registry.setActive("geo_ground", false);

    expect(registry.getSurfaceAt({ x: 0, y: 0.02, z: 0 })).toBeNull();
  });

  it("scopes activation to sections", () => {
    const registry = new SurfaceRegistry();

    registry.register({
      id: "geo_wall",
      sectionId: "sec_a",
      definition: { ...definition, wallRunSurface: true, walkable: false },
      colliderHandle: 2,
      bounds: null,
      active: false,
    });

    registry.activateSection("sec_a");
    expect(registry.get("geo_wall")?.active).toBe(true);
    expect(registry.getActiveCount()).toBe(1);

    registry.deactivateSection("sec_a");
    expect(registry.get("geo_wall")?.active).toBe(false);
  });
});

describe("LevelRuntimeError", () => {
  it("carries structured error codes", () => {
    const error = new LevelRuntimeError("LEVEL_NOT_FOUND", "missing", {
      levelId: "unknown",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("LEVEL_NOT_FOUND");
    expect(error.levelId).toBe("unknown");
    expect(error.recoverable).toBe(false);
  });
});
