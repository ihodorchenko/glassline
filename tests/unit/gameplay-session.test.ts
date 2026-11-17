import { describe, expect, it } from "vitest";

import type {
  GameplaySessionContext,
  GameplaySessionPorts,
  SessionResults,
} from "../../src/sessions/GameplaySessionManager";
import { GameplaySessionManager } from "../../src/sessions/GameplaySessionManager";

interface Harness {
  readonly manager: GameplaySessionManager;
  readonly calls: string[];
  readonly advance: (milliseconds: number) => void;
}

function createHarness(): Harness {
  const calls: string[] = [];
  let now = 1000;

  const ports: GameplaySessionPorts = {
    loadLevel: async (_context: GameplaySessionContext) => {
      calls.push("loadLevel");
      return { levelVersion: "1.0.0", initialSpawnId: "sp_initial" };
    },
    startLevel: async () => {
      calls.push("startLevel");
    },
    unloadLevel: async () => {
      calls.push("unloadLevel");
    },
    prepareGameplay: async () => {
      calls.push("prepareGameplay");
    },
    activateGameplay: async () => {
      calls.push("activateGameplay");
    },
    suspendGameplay: async (_context, reason) => {
      calls.push(`suspend:${reason}`);
    },
    resumeGameplay: async () => {
      calls.push("resumeGameplay");
    },
    restartGameplay: async () => {
      calls.push("restartGameplay");
    },
    shutdownGameplay: async () => {
      calls.push("shutdownGameplay");
    },
    buildResults: (context: GameplaySessionContext): SessionResults => {
      calls.push("buildResults");
      return {
        sessionId: context.sessionId,
        mode: context.mode,
        levelId: context.levelId,
        status: "completed",
        durationMs: 0,
        completedAt: now,
      };
    },
  };

  const manager = new GameplaySessionManager({ ports, clock: () => now });

  return {
    manager,
    calls,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}

describe("GameplaySessionManager", () => {
  it("starts a training session through the ordered lifecycle", async () => {
    const harness = createHarness();
    const events: string[] = [];

    harness.manager.on("session:started", () => events.push("started"));

    const result = await harness.manager.startSession({
      mode: "training",
      levelId: "training_test",
    });

    expect(result.success).toBe(true);
    expect(result.session?.status).toBe("running");
    expect(result.session?.mode).toBe("training");
    expect(result.session?.configuration).toMatchObject({
      levelId: "training_test",
      isRanked: false,
      enableCheckpoints: false,
      enableTimer: false,
    });
    expect(result.session?.metadata.levelVersion).toBe("1.0.0");
    expect(harness.calls).toEqual([
      "loadLevel",
      "prepareGameplay",
      "startLevel",
      "activateGameplay",
    ]);
    expect(events).toEqual(["started"]);
    expect(harness.manager.getSnapshot().execution?.generation).toBe(1);
  });

  it("pauses and resumes a running session", async () => {
    const harness = createHarness();

    await harness.manager.startSession({ mode: "training" });

    const paused = await harness.manager.pauseSession("player");

    expect(paused.success).toBe(true);
    expect(paused.session?.status).toBe("paused");
    expect(harness.calls).toContain("suspend:player");

    const resumed = await harness.manager.resumeSession();

    expect(resumed.success).toBe(true);
    expect(resumed.session?.status).toBe("running");
    expect(harness.calls).toContain("resumeGameplay");
  });

  it("rejects invalid concurrent operations", async () => {
    const harness = createHarness();

    await harness.manager.startSession({ mode: "training" });

    const second = await harness.manager.startSession({ mode: "prologue" });

    expect(second.success).toBe(false);
    expect(second.error).toContain("active");

    const resume = await harness.manager.resumeSession();

    expect(resume.success).toBe(false);
  });

  it("rejects ranked training sessions", async () => {
    const harness = createHarness();
    const result = await harness.manager.startSession({
      mode: "training",
      isRanked: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid session configuration");
  });

  it("restarts with a new execution generation", async () => {
    const harness = createHarness();

    await harness.manager.startSession({ mode: "prologue" });
    harness.advance(5000);

    const restarted = await harness.manager.restartSession();

    expect(restarted.success).toBe(true);
    expect(harness.calls).toContain("restartGameplay");
    expect(harness.manager.getSnapshot().execution?.generation).toBe(2);
    expect(restarted.session?.status).toBe("running");
  });

  it("completes a session and exposes authoritative results", async () => {
    const harness = createHarness();

    await harness.manager.startSession({ mode: "speedrun" });
    harness.advance(61000);

    const completed = await harness.manager.completeSession({ reason: "finish" });
    const results = harness.manager.getLastResults();

    expect(completed.success).toBe(true);
    expect(completed.session?.status).toBe("completed");
    expect(results?.status).toBe("completed");
    expect(results?.durationMs).toBe(61000);
    expect(harness.calls).toContain("buildResults");
    expect(harness.calls).toContain("shutdownGameplay");
  });

  it("abandons a session and unloads the level", async () => {
    const harness = createHarness();

    await harness.manager.startSession({ mode: "prologue" });

    const abandoned = await harness.manager.abandonSession("player");

    expect(abandoned.success).toBe(true);
    expect(abandoned.session?.status).toBe("abandoned");
    expect(harness.calls).toContain("shutdownGameplay");
    expect(harness.calls).toContain("unloadLevel");
  });

  it("fails safely when level loading fails", async () => {
    const calls: string[] = [];
    const failingPorts: GameplaySessionPorts = {
      loadLevel: async () => {
        calls.push("loadLevel");
        throw new Error("level unavailable");
      },
      startLevel: async () => undefined,
      unloadLevel: async () => {
        calls.push("unloadLevel");
      },
      prepareGameplay: async () => undefined,
      activateGameplay: async () => undefined,
      suspendGameplay: async () => undefined,
      resumeGameplay: async () => undefined,
      restartGameplay: async () => undefined,
      shutdownGameplay: async () => {
        calls.push("shutdownGameplay");
      },
      buildResults: () => ({
        sessionId: "failed",
        mode: "training",
        levelId: "training_test",
        status: "failed",
        durationMs: 0,
        completedAt: 0,
      }),
    };
    const manager = new GameplaySessionManager({ ports: failingPorts });
    const failures: string[] = [];

    manager.on("session:failed", (event) => failures.push(event.error));

    const result = await manager.startSession({ mode: "training" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("level unavailable");
    expect(failures.length).toBe(1);
    expect(calls).toContain("shutdownGameplay");
    expect(calls).toContain("unloadLevel");
  });
});
