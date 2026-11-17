import { describe, expect, it, vi } from "vitest";

import {
  type CheckpointDefinition,
  CheckpointSystem,
  type SpawnPointDefinition,
} from "../../src/checkpoint/CheckpointSystem";

const spawnPoints: SpawnPointDefinition[] = [
  { id: "sp_initial", position: { x: 0, y: 0.93, z: 6 }, rotationY: 0 },
  { id: "sp_cp_01", position: { x: 0, y: 0.93, z: 3 }, rotationY: 0 },
  { id: "sp_cp_02", position: { x: 0, y: 0.93, z: -3 }, rotationY: 1.2 },
];

const definitions: CheckpointDefinition[] = [
  {
    id: "cp_01",
    sectionId: "rooftop",
    displayName: "Rooftop",
    trigger: { center: { x: 0, y: 1, z: 3 }, halfExtents: { x: 2, y: 1.5, z: 2 } },
    spawnPointId: "sp_cp_01",
    respawnEnabled: true,
  },
  {
    id: "cp_02",
    sectionId: "industrial",
    displayName: "Industrial",
    trigger: { center: { x: 0, y: 1, z: -3 }, halfExtents: { x: 2, y: 1.5, z: 2 } },
    spawnPointId: "sp_cp_02",
    respawnEnabled: true,
  },
  {
    id: "cp_03",
    sectionId: "skybridge",
    displayName: "Skybridge",
    trigger: { center: { x: 0, y: 1, z: -9 }, halfExtents: { x: 2, y: 1.5, z: 1 } },
    spawnPointId: "sp_cp_01",
    respawnEnabled: false,
  },
];

function createSystem(): CheckpointSystem {
  return new CheckpointSystem(definitions, spawnPoints, "sp_initial");
}

describe("CheckpointSystem", () => {
  it("activates a checkpoint once when the player enters its trigger", () => {
    const system = createSystem();
    const listener = vi.fn();

    system.subscribe(listener);

    const event = system.update({ x: 0, y: 0.93, z: 3 }, 1000);
    const snapshot = system.getSnapshot();

    expect(event?.checkpointId).toBe("cp_01");
    expect(event?.sectionId).toBe("rooftop");
    expect(snapshot.activeCheckpointId).toBe("cp_01");
    expect(snapshot.activatedCheckpointIds).toEqual(["cp_01"]);
    expect(snapshot.revision).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(system.update({ x: 0, y: 0.93, z: 3 }, 1100)).toBeNull();
    expect(system.getSnapshot().revision).toBe(1);
  });

  it("activates overlapping checkpoints deterministically in definition order", () => {
    const overlapping: CheckpointDefinition[] = [
      {
        id: "a",
        sectionId: "section",
        displayName: "A",
        trigger: { center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 5, y: 5, z: 5 } },
        spawnPointId: "sp_cp_01",
        respawnEnabled: true,
      },
      {
        id: "b",
        sectionId: "section",
        displayName: "B",
        trigger: { center: { x: 0, y: 0, z: 0 }, halfExtents: { x: 5, y: 5, z: 5 } },
        spawnPointId: "sp_cp_02",
        respawnEnabled: true,
      },
    ];
    const system = new CheckpointSystem(overlapping, spawnPoints, "sp_initial");

    expect(system.update({ x: 0, y: 0, z: 0 }, 1)?.checkpointId).toBe("a");
    expect(system.update({ x: 0, y: 0, z: 0 }, 2)?.checkpointId).toBe("b");
    expect(system.getSnapshot().activatedCheckpointIds).toEqual(["a", "b"]);
  });

  it("resolves respawn destinations only for activated, enabled checkpoints", () => {
    const system = createSystem();

    expect(system.resolveRespawnDestination()).toBeNull();

    system.update({ x: 0, y: 0.93, z: 3 }, 1000);

    const destination = system.resolveRespawnDestination();

    expect(destination).toEqual({
      checkpointId: "cp_01",
      spawnPointId: "sp_cp_01",
      position: { x: 0, y: 0.93, z: 3 },
      rotationY: 0,
    });
    expect(system.resolveRespawnDestination("cp_02")).toBeNull();

    system.update({ x: 0, y: 0.93, z: -3 }, 2000);

    expect(system.resolveRespawnDestination("cp_02")?.rotationY).toBe(1.2);

    system.update({ x: 0, y: 0.93, z: -9 }, 3000);

    expect(system.resolveRespawnDestination()).toBeNull();
  });

  it("resets session progress", () => {
    const system = createSystem();

    system.update({ x: 0, y: 0.93, z: 3 }, 1000);
    system.reset("session-2");

    expect(system.getSnapshot()).toEqual({
      sessionId: "session-2",
      activeCheckpointId: null,
      activatedCheckpointIds: [],
      revision: 2,
    });
    expect(system.resolveRespawnDestination()).toBeNull();
  });

  it("rejects invalid definitions", () => {
    expect(
      () =>
        new CheckpointSystem(
          [
            { ...definitions[0]!, id: "duplicate" },
            { ...definitions[0]!, id: "duplicate" },
          ],
          spawnPoints,
          "sp_initial",
        ),
    ).toThrow(/Duplicate checkpoint id/);

    expect(
      () =>
        new CheckpointSystem(
          [{ ...definitions[0]!, spawnPointId: "missing" }],
          spawnPoints,
          "sp_initial",
        ),
    ).toThrow(/missing spawn point/);

    expect(() => new CheckpointSystem([], spawnPoints, "missing")).toThrow(/Initial spawn point/);
  });
});
