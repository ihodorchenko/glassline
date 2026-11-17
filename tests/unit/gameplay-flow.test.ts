import { describe, expect, it } from "vitest";

import { GameplayFlowManager } from "../../src/flow/GameplayFlowManager";

describe("GameplayFlowManager", () => {
  it("owns validated navigation transitions", () => {
    const flow = new GameplayFlowManager({ clock: () => 1000 });

    expect(flow.getState()).toBe("boot");

    expect(flow.navigate({ target: "main-menu", reason: "boot-complete" }).success).toBe(true);
    expect(flow.navigate({ target: "loading", reason: "start-gameplay" }).success).toBe(true);
    expect(flow.navigate({ target: "gameplay", reason: "gameplay-ready" }).success).toBe(true);
    expect(flow.navigate({ target: "paused", reason: "pause" }).success).toBe(true);
    expect(flow.navigate({ target: "gameplay", reason: "resume" }).success).toBe(true);
    expect(flow.navigate({ target: "results", reason: "complete" }).success).toBe(true);
    expect(flow.navigate({ target: "main-menu", reason: "return-to-menu" }).success).toBe(true);

    expect(flow.getState()).toBe("main-menu");
  });

  it("rejects invalid transitions", () => {
    const flow = new GameplayFlowManager();

    flow.navigate({ target: "main-menu", reason: "boot-complete" });

    const result = flow.navigate({ target: "results", reason: "complete" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not allowed");
    expect(flow.getState()).toBe("main-menu");
  });

  it("tracks snapshots, history, and listeners", () => {
    const flow = new GameplayFlowManager({ clock: () => 42 });
    const transitions: string[] = [];

    flow.subscribe((transition) => transitions.push(`${transition.from}->${transition.to}`));
    flow.navigate({ target: "main-menu", reason: "boot-complete" });
    flow.navigate({ target: "loading", reason: "start-gameplay" });

    const snapshot = flow.getSnapshot();

    expect(snapshot.state).toBe("loading");
    expect(snapshot.previousState).toBe("main-menu");
    expect(snapshot.reason).toBe("start-gameplay");
    expect(snapshot.updatedAt).toBe(42);
    expect(transitions).toEqual(["boot->main-menu", "main-menu->loading"]);
    expect(flow.getHistory()).toHaveLength(2);
  });
});
