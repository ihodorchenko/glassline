import { describe, expect, it, vi } from "vitest";

import {
  type CheckpointDefinition,
  type CheckpointSpawnResolver,
  CheckpointSystem,
} from "../../src/checkpoint/CheckpointSystem";

const LEVEL_ID = "test_level";
const SESSION_ID = "test_session";

const spawnTransforms: Record<
  string,
  { position: { x: number; y: number; z: number }; rotationY: number }
> = {
  sp_cp_01: { position: { x: 0, y: 0.93, z: 3 }, rotationY: 0 },
  sp_cp_02: { position: { x: 0, y: 0.93, z: -3 }, rotationY: 1.2 },
  sp_cp_03: { position: { x: 0, y: 0.93, z: -9 }, rotationY: 0.5 },
};

function checkpoint(
  overrides: Partial<CheckpointDefinition> &
    Pick<CheckpointDefinition, "id" | "sectionId" | "spawnPointId">,
): CheckpointDefinition {
  return {
    levelId: LEVEL_ID,
    displayName: overrides.id,
    activationMode: "automatic",
    enabled: true,
    repeatable: true,
    respawnEnabled: true,
    ...overrides,
  };
}

function createSystem(
  options: {
    readonly definitions?: readonly CheckpointDefinition[];
    readonly resolver?: CheckpointSpawnResolver;
  } = {},
): CheckpointSystem {
  const resolver: CheckpointSpawnResolver = options.resolver ?? {
    resolve: (spawnPointId) => spawnTransforms[spawnPointId] ?? null,
  };

  return new CheckpointSystem(
    options.definitions ?? [
      checkpoint({ id: "cp_01", sectionId: "rooftop", spawnPointId: "sp_cp_01" }),
      checkpoint({ id: "cp_02", sectionId: "industrial", spawnPointId: "sp_cp_02" }),
      checkpoint({
        id: "cp_03",
        sectionId: "skybridge",
        spawnPointId: "sp_cp_03",
        respawnEnabled: false,
      }),
    ],
    { levelId: LEVEL_ID, sessionId: SESSION_ID, spawnResolver: resolver },
  );
}

describe("CheckpointSystem", () => {
  it("activates a checkpoint from a validated Level Runtime trigger signal", () => {
    const system = createSystem();
    const listener = vi.fn();

    system.subscribe(listener);

    const event = system.notifyTriggerEnter("cp_01", 1000);
    const snapshot = system.getSnapshot();

    expect(event).toEqual({
      sessionId: SESSION_ID,
      levelId: LEVEL_ID,
      checkpointId: "cp_01",
      sectionId: "rooftop",
      spawnPointId: "sp_cp_01",
      timestamp: 1000,
      activationIndex: 0,
    });
    expect(snapshot.activeCheckpointId).toBe("cp_01");
    expect(snapshot.activatedCheckpointIds).toEqual(["cp_01"]);
    expect(snapshot.revision).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(system.notifyTriggerEnter("cp_01", 1100)).toBeNull();
    expect(system.getSnapshot().revision).toBe(1);
  });

  it("ignores disabled and non-automatic checkpoints", () => {
    const system = createSystem({
      definitions: [
        checkpoint({
          id: "cp_01",
          sectionId: "rooftop",
          spawnPointId: "sp_cp_01",
          enabled: false,
        }),
        checkpoint({
          id: "cp_02",
          sectionId: "industrial",
          spawnPointId: "sp_cp_02",
          activationMode: "interaction",
        }),
      ],
    });

    expect(system.notifyTriggerEnter("cp_01", 100)).toBeNull();
    expect(system.notifyTriggerEnter("cp_02", 100)).toBeNull();
    expect(system.notifyTriggerEnter("missing", 100)).toBeNull();
  });

  it("does not activate a checkpoint whose spawn point cannot be resolved", () => {
    const system = createSystem({
      resolver: {
        resolve: () => null,
      },
    });

    expect(system.notifyTriggerEnter("cp_01", 100)).toBeNull();
    expect(system.getSnapshot().activeCheckpointId).toBeNull();
  });

  it("resolves the active respawn destination through Level Runtime spawn resolution", () => {
    const system = createSystem();

    expect(system.resolveRespawnDestination()).toBeNull();

    system.notifyTriggerEnter("cp_01", 1000);

    expect(system.resolveRespawnDestination()).toEqual({
      checkpointId: "cp_01",
      spawnPointId: "sp_cp_01",
      position: { x: 0, y: 0.93, z: 3 },
      rotationY: 0,
    });
    expect(system.resolveRespawnDestination("cp_02")).toBeNull();

    system.notifyTriggerEnter("cp_02", 2000);

    expect(system.resolveRespawnDestination("cp_02")?.rotationY).toBe(1.2);
  });

  it("does not resolve a destination for checkpoints with respawn disabled", () => {
    const system = createSystem();

    system.notifyTriggerEnter("cp_03", 1000);

    expect(system.getSnapshot().activeCheckpointId).toBe("cp_03");
    expect(system.resolveRespawnDestination()).toBeNull();
  });

  it("resets session progress", () => {
    const system = createSystem();

    system.notifyTriggerEnter("cp_01", 1000);
    system.reset("session-2");

    expect(system.getSnapshot()).toEqual({
      sessionId: "session-2",
      levelId: LEVEL_ID,
      activeCheckpointId: null,
      activatedCheckpointIds: [],
      revision: 2,
    });
    expect(system.resolveRespawnDestination()).toBeNull();
  });

  it("rejects invalid checkpoint configuration", () => {
    expect(
      () =>
        new CheckpointSystem([checkpoint({ id: "cp", sectionId: "a", spawnPointId: "sp_cp_01" })], {
          levelId: "other_level",
          sessionId: SESSION_ID,
          spawnResolver: { resolve: () => null },
        }),
    ).toThrow(/belongs to level/);

    expect(
      () =>
        new CheckpointSystem(
          [
            checkpoint({ id: "cp", sectionId: "a", spawnPointId: "sp_cp_01" }),
            checkpoint({ id: "cp", sectionId: "b", spawnPointId: "sp_cp_01" }),
          ],
          {
            levelId: LEVEL_ID,
            sessionId: SESSION_ID,
            spawnResolver: { resolve: () => null },
          },
        ),
    ).toThrow(/Duplicate checkpoint id/);
  });
});
