import { describe, expect, it, vi } from "vitest";

import type { RespawnDestination } from "../../src/checkpoint/CheckpointSystem";
import { RespawnManager, type RespawnManagerDependencies } from "../../src/respawn/RespawnManager";

const checkpointDestination: RespawnDestination = {
  checkpointId: "cp_01",
  spawnPointId: "sp_cp_01",
  position: { x: 0, y: 0.93, z: 3 },
  rotationY: 0.5,
};

interface Harness {
  readonly manager: RespawnManager;
  readonly player: {
    teleportTo: ReturnType<typeof vi.fn>;
    activate: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
  };
  readonly camera: { resetForRespawn: ReturnType<typeof vi.fn> };
  readonly input: { setEnabled: ReturnType<typeof vi.fn> };
  readonly checkpoints: { resolveRespawnDestination: ReturnType<typeof vi.fn> };
}

function createHarness(
  destination: RespawnDestination | null,
  respawnDurationSeconds = 0.1,
): Harness {
  const player = {
    teleportTo: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  };
  const camera = { resetForRespawn: vi.fn() };
  const input = { setEnabled: vi.fn() };
  const checkpoints = { resolveRespawnDestination: vi.fn(() => destination) };
  const dependencies: RespawnManagerDependencies = {
    checkpoints,
    player,
    camera,
    input,
  };
  const manager = new RespawnManager(dependencies, {
    fallbackSpawn: { x: 1, y: 2, z: 3 },
    respawnDurationSeconds,
  });

  return { manager, player, camera, input, checkpoints };
}

describe("RespawnManager", () => {
  it("suspends control, places the player at the active checkpoint, and restores control", () => {
    const harness = createHarness(checkpointDestination);
    const listener = vi.fn();

    harness.manager.subscribe(listener);

    expect(harness.manager.request("fall")).toBe(true);
    expect(harness.manager.isRespawning).toBe(true);
    expect(harness.player.deactivate).toHaveBeenCalledTimes(1);
    expect(harness.input.setEnabled).toHaveBeenCalledWith(false);
    expect(harness.player.teleportTo).toHaveBeenCalledWith(checkpointDestination.position);
    expect(harness.camera.resetForRespawn).toHaveBeenCalledWith(0.5);

    harness.manager.update(0.05);
    expect(harness.manager.isRespawning).toBe(true);

    harness.manager.update(0.06);
    expect(harness.manager.isRespawning).toBe(false);
    expect(harness.player.activate).toHaveBeenCalledTimes(1);
    expect(harness.input.setEnabled).toHaveBeenLastCalledWith(true);
    expect(listener).toHaveBeenCalledWith({
      reason: "fall",
      destination: checkpointDestination,
      usedFallback: false,
    });
  });

  it("falls back to the initial spawn when no checkpoint is active", () => {
    const harness = createHarness(null);

    harness.manager.request("fall");

    expect(harness.player.teleportTo).toHaveBeenCalledWith({ x: 1, y: 2, z: 3 });
    expect(harness.camera.resetForRespawn).toHaveBeenCalledWith(0);

    harness.manager.update(0.11);

    expect(harness.manager.getLastDestination()).toEqual({
      checkpointId: "fallback",
      spawnPointId: "fallback",
      position: { x: 1, y: 2, z: 3 },
      rotationY: 0,
    });
  });

  it("prefers a fall-only emergency anchor over the active checkpoint", () => {
    const harness = createHarness(checkpointDestination);
    const anchor: RespawnDestination = {
      checkpointId: "respawn_high_route",
      spawnPointId: "sp_respawn_high_route",
      position: { x: 0, y: 6.075, z: -121 },
      rotationY: 0,
    };

    harness.manager.setEmergencyAnchor(anchor);
    harness.manager.request("fall");

    expect(harness.player.teleportTo).toHaveBeenCalledWith(anchor.position);
    expect(harness.checkpoints.resolveRespawnDestination).not.toHaveBeenCalled();
    expect(harness.manager.getLastDestination()).toEqual(anchor);

    harness.manager.update(0.11);

    expect(harness.manager.getLastDestination()).toEqual(anchor);
  });

  it("ignores the emergency anchor for non-fall recovery and can clear it", () => {
    const harness = createHarness(checkpointDestination);
    const anchor: RespawnDestination = {
      checkpointId: "respawn_high_route",
      spawnPointId: "sp_respawn_high_route",
      position: { x: 0, y: 6.075, z: -121 },
      rotationY: 0,
    };

    harness.manager.setEmergencyAnchor(anchor);
    harness.manager.request("manual-restart");

    expect(harness.player.teleportTo).toHaveBeenCalledWith(checkpointDestination.position);

    harness.manager.update(0.11);
    harness.manager.setEmergencyAnchor(null);
    harness.manager.request("fall");

    expect(harness.player.teleportTo).toHaveBeenLastCalledWith(checkpointDestination.position);
  });

  it("passes a preferred checkpoint id to the destination resolver", () => {
    const harness = createHarness(checkpointDestination);

    harness.manager.request("scripted", "cp_02");

    expect(harness.checkpoints.resolveRespawnDestination).toHaveBeenCalledWith("cp_02");
  });

  it("rejects a second request while recovery is in progress", () => {
    const harness = createHarness(checkpointDestination);

    expect(harness.manager.request("fall")).toBe(true);
    expect(harness.manager.request("manual-restart")).toBe(false);

    harness.manager.update(0.11);

    expect(harness.manager.request("manual-restart")).toBe(true);
  });

  it("supports immediate recovery with a zero duration", () => {
    const harness = createHarness(null, 0);

    harness.manager.request("scripted");
    harness.manager.update(1 / 60);

    expect(harness.manager.isRespawning).toBe(false);
    expect(harness.player.activate).toHaveBeenCalledTimes(1);
  });
});
