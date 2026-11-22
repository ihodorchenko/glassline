import { describe, expect, it } from "vitest";

import {
  createDevLaunch,
  type DevLaunchHost,
  type GlasslineDevLaunchApi,
} from "../../src/diagnostics/DevLaunch";
import {
  DEV_LAUNCH_LEVEL_IDS,
  DEV_LAUNCH_QUERY_PARAM,
  DEV_LAUNCH_ROUTES,
  describeDevLaunchRoutes,
  findDevLaunchRoute,
  parseDevLaunchRequest,
} from "../../src/diagnostics/devLaunchContract";

/**
 * DEV launch contract and runtime (`?dev=first_section`).
 *
 * The runtime is exercised against a structural fake application so the launch
 * gate, failure visibility, timeout and cleanup behavior can be tested in
 * isolation. The real Application lifecycle is covered by
 * `first-section-dev-startup.test.ts`; the browser evidence is produced by
 * `tools/capture/dev-route.mjs`.
 */

/* -------------------------------------------------------------------------- */
/* Fake application + host                                                    */
/* -------------------------------------------------------------------------- */

interface FakeSession {
  id: string;
  mode: string;
  levelId: string;
  status: string;
}

interface FakeVector {
  x: number;
  y: number;
  z: number;
}

interface FakePlayer {
  getPosition(): FakeVector;
  getMovementSnapshot(): {
    speed: number;
    state: string;
    grounded: boolean;
    stance: string;
    postureHeight: number;
  };
}

interface FakeOptions {
  readonly throwOnStart?: Error;
  readonly flowAfterStart?: "gameplay" | "main-menu" | "error" | "loading";
  readonly sessionStatus?: string;
  readonly createSession?: boolean;
  readonly loadedLevelId?: string;
  readonly currentMode?: string | null;
  readonly uiScreen?: string | null;
  readonly keepPlayer?: boolean;
}

interface FakeApplication {
  startCalls: Array<{ readonly mode: string; readonly levelId?: string }>;
  abandonReasons: string[];
  flow: string;
  mode: string | null;
  session: FakeSession | null;
  level: { readonly id: string } | null;
  levelSessionState: string | null;
  activeSectionId: string | null;
  currentMode: string | null;
  player: FakePlayer | null;
  cameraSystem: { viewYaw: number; viewPitch: number };
  input: { activeContext: string; isPointerLocked: boolean };
  checkpoint: { activeId: string | null; activated: string[] };
  respawn: { currentState: string; destination: { position: FakeVector } | null };
  respawnListeners: Set<() => void>;
  ui: {
    screen: string | null;
    errors: string[];
    getActiveScreen(): string | null;
    showError(message: string): void;
  };
  progressionCompleted: boolean;
  lastResults: { mode: string; levelId: string; status: string; durationMs: number } | null;
  flowManager: { getState(): string };
  sessionManager: {
    isRunning(): boolean;
    getActiveSession(): FakeSession | null;
    getLastResults(): FakeApplication["lastResults"];
    abandonSession(reason: string): Promise<{ success: boolean; error?: string }>;
  };
  levelRuntime: {
    getCurrentLevel(): { readonly id: string } | null;
    getCurrentSession(): { readonly state: string } | null;
    getActiveSectionId(): string | null;
    getSnapshot(): { readonly sessionState: string | null };
  };
  checkpointSystem: {
    getActiveCheckpointId(): string | null;
    getSnapshot(): { readonly activatedCheckpointIds: readonly string[] };
  };
  respawnManager: {
    readonly currentState: string;
    getLastDestination(): { position: FakeVector } | null;
    subscribe(listener: () => void): () => void;
  };
  progressionSystem: { getSnapshot(): { readonly prologueCompleted: boolean } };
  startGameplay(mode: string, levelId?: string): Promise<void>;
}

function createFakeApplication(options: FakeOptions = {}): FakeApplication {
  const respawnListeners = new Set<() => void>();

  const fake: FakeApplication = {
    startCalls: [],
    abandonReasons: [],
    flow: "main-menu",
    mode: null,
    session: null,
    level: null,
    levelSessionState: null,
    activeSectionId: null,
    currentMode: null,
    player: null,
    cameraSystem: { viewYaw: 0.25, viewPitch: -0.125 },
    input: { activeContext: "gameplay", isPointerLocked: true },
    checkpoint: { activeId: null, activated: [] },
    respawn: { currentState: "idle", destination: null },
    respawnListeners,
    ui: {
      screen: options.uiScreen ?? null,
      errors: [],
      getActiveScreen: () => fake.ui.screen,
      showError(message: string): void {
        fake.ui.errors.push(message);
      },
    },
    progressionCompleted: false,
    lastResults: null,
    flowManager: { getState: () => fake.flow },
    sessionManager: {
      isRunning: () => fake.session?.status === "running",
      getActiveSession: () => (fake.session === null ? null : { ...fake.session }),
      getLastResults: () => fake.lastResults,
      abandonSession: async (reason: string) => {
        fake.abandonReasons.push(reason);

        if (fake.session === null) {
          return { success: false, error: "no session" };
        }

        fake.session.status = "abandoned";
        fake.level = null;
        fake.levelSessionState = null;
        fake.player = null;

        return { success: true };
      },
    },
    levelRuntime: {
      getCurrentLevel: () => fake.level,
      getCurrentSession: () =>
        fake.levelSessionState === null ? null : { state: fake.levelSessionState },
      getActiveSectionId: () => fake.activeSectionId,
      getSnapshot: () => ({ sessionState: fake.levelSessionState }),
    },
    checkpointSystem: {
      getActiveCheckpointId: () => fake.checkpoint.activeId,
      getSnapshot: () => ({ activatedCheckpointIds: fake.checkpoint.activated }),
    },
    respawnManager: {
      get currentState(): string {
        return fake.respawn.currentState;
      },
      getLastDestination: () => fake.respawn.destination,
      subscribe: (listener: () => void) => {
        respawnListeners.add(listener);

        return () => {
          respawnListeners.delete(listener);
        };
      },
    },
    progressionSystem: { getSnapshot: () => ({ prologueCompleted: fake.progressionCompleted }) },
    async startGameplay(mode: string, levelId?: string): Promise<void> {
      fake.startCalls.push({ mode, ...(levelId === undefined ? {} : { levelId }) });
      fake.mode = mode;
      fake.currentMode = options.currentMode ?? mode;
      fake.flow = options.flowAfterStart ?? "gameplay";

      if (options.createSession !== false) {
        fake.session = {
          id: "gameplay-session-test",
          mode,
          levelId: options.loadedLevelId ?? levelId ?? "unknown",
          status: options.sessionStatus ?? "running",
        };
      }

      fake.level = { id: options.loadedLevelId ?? levelId ?? "unknown" };
      fake.levelSessionState = "active";
      fake.activeSectionId = "sec_start";

      if (options.keepPlayer !== false) {
        fake.player = {
          getPosition: () => ({ x: 0, y: 0.93, z: 14 }),
          getMovementSnapshot: () => ({
            speed: 0,
            state: "IDLE",
            grounded: true,
            stance: "standing",
            postureHeight: 1.75,
          }),
        };
      }

      if (options.throwOnStart) {
        throw options.throwOnStart;
      }
    },
  };

  return fake;
}

function createFakeHost() {
  const exposed: GlasslineDevLaunchApi[] = [];
  const failures: Array<{ readonly title: string; readonly details: string }> = [];
  const logs: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const marked: string[] = [];

  const host: DevLaunchHost = {
    expose: (api) => {
      exposed.push(api);
    },
    markActive: (levelId) => {
      marked.push(levelId);
    },
    log: (message) => {
      logs.push(message);
    },
    warn: (message) => {
      warnings.push(message);
    },
    error: (message) => {
      errors.push(message);
    },
    showFailure: (title, details) => {
      failures.push({ title, details });
    },
  };

  return { host, exposed, failures, logs, warnings, errors, marked };
}

/* -------------------------------------------------------------------------- */
/* URL contract                                                               */
/* -------------------------------------------------------------------------- */

describe("dev launch URL contract", () => {
  it("uses the documented dev parameter", () => {
    expect(DEV_LAUNCH_QUERY_PARAM).toBe("dev");
  });

  it("registers exactly the supported development levels", () => {
    expect(DEV_LAUNCH_LEVEL_IDS).toEqual(["first_section"]);
    expect(DEV_LAUNCH_ROUTES.map((route) => route.id)).toEqual(["first_section"]);
    expect(findDevLaunchRoute("first_section")?.levelDefinitionId).toBe("first_section");
    expect(findDevLaunchRoute("first_section")?.mode).toBe("prologue");
    expect(findDevLaunchRoute("prologue")).toBeUndefined();
    expect(describeDevLaunchRoutes()).toBe("first_section");
  });

  it("selects first_section in prologue mode", () => {
    const parsed = parseDevLaunchRequest("?dev=first_section");

    expect(parsed).toEqual({
      kind: "launch",
      request: {
        levelId: "first_section",
        levelDefinitionId: "first_section",
        mode: "prologue",
        label: "First Section",
      },
    });
  });

  it("tolerates case, whitespace, and a missing leading question mark", () => {
    for (const search of [
      "?dev=FIRST_SECTION",
      "?dev=%20first_section%20",
      "dev=first_section",
      "?foo=1&dev=First_Section&bar=2",
    ]) {
      expect(parseDevLaunchRequest(search).kind, search).toBe("launch");
    }
  });

  it("keeps the normal boot when the parameter is absent or explicitly disabled", () => {
    for (const search of [
      "",
      "?foo=1",
      "?dev",
      "?dev=",
      "?dev=0",
      "?dev=false",
      "?dev=off",
      "?dev=no",
    ]) {
      expect(parseDevLaunchRequest(search), search).toEqual({ kind: "none" });
    }
  });

  it("ignores capture and unrelated level parameters", () => {
    expect(parseDevLaunchRequest("?capture=1&level=prologue")).toEqual({ kind: "none" });
    expect(parseDevLaunchRequest("?level=first_section")).toEqual({ kind: "none" });
  });

  it("reports an unknown development level as unsupported", () => {
    const parsed = parseDevLaunchRequest("?dev=prologue");

    expect(parsed).toEqual({
      kind: "unsupported",
      requested: "prologue",
      supported: ["first_section"],
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Runtime                                                                    */
/* -------------------------------------------------------------------------- */

describe("dev launch runtime", () => {
  it("does nothing and starts no session without the parameter", () => {
    const fake = createFakeApplication();
    const { host, exposed, failures } = createFakeHost();

    const preparation = createDevLaunch("", host);

    expect(preparation).toEqual({ kind: "none" });
    expect(exposed).toHaveLength(0);
    expect(failures).toHaveLength(0);
    expect(fake.startCalls).toHaveLength(0);
  });

  it("reports an unknown level visibly and starts no session", () => {
    const fake = createFakeApplication();
    const { host, exposed, failures, errors } = createFakeHost();

    const preparation = createDevLaunch("?dev=not_a_level", host);

    expect(preparation.kind).toBe("unsupported");
    expect(exposed).toHaveLength(0);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.details).toContain("not_a_level");
    expect(failures[0]?.details).toContain("first_section");
    expect(errors).toHaveLength(1);
    expect(fake.startCalls).toHaveLength(0);
  });

  it("exposes the dev API before activation and starts only after activate", () => {
    const { host, exposed } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host);

    expect(preparation.kind).toBe("launch");
    expect(exposed).toHaveLength(1);

    const api = exposed[0];

    if (!api) {
      throw new Error("expected the dev launch API to be exposed");
    }

    expect(api.levelId).toBe("first_section");
    expect(api.levelDefinitionId).toBe("first_section");
    expect(api.mode).toBe("prologue");
    expect(api.ready).toBe(false);
    expect(api.error).toBeNull();
    expect(api.status()).toBeNull();
  });

  it("starts first_section through startGameplay and becomes ready", async () => {
    const fake = createFakeApplication();
    const { host, exposed, failures, marked } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host);

    if (preparation.kind !== "launch") {
      throw new Error("expected a launch preparation");
    }

    fake.checkpoint.activated = ["cp_start"];
    fake.checkpoint.activeId = "cp_start";

    const result = await preparation.handle.activate(fake);
    const api = exposed[0];
    const status = api?.status() ?? null;

    expect(result).toEqual({ success: true, error: null });
    expect(fake.startCalls).toEqual([{ mode: "prologue", levelId: "first_section" }]);
    expect(api?.ready).toBe(true);
    expect(api?.error).toBeNull();
    expect(marked).toEqual(["first_section"]);
    expect(failures).toHaveLength(0);
    expect(fake.abandonReasons).toEqual([]);
    expect(status?.levelId).toBe("first_section");
    expect(status?.phase).toBe("ready");
    expect(status?.flow).toBe("gameplay");
    expect(status?.sessionStatus).toBe("running");
    expect(status?.loadedLevelId).toBe("first_section");
    expect(status?.levelSessionState).toBe("active");
    expect(status?.activeSectionId).toBe("sec_start");
    expect(status?.screen).toBeNull();
    expect(status?.player?.position).toEqual({ x: 0, y: 0.93, z: 14 });
    expect(status?.camera).toEqual({ yaw: 0.25, pitch: -0.125 });
    expect(status?.activeCheckpointId).toBe("cp_start");
    expect(status?.activatedCheckpointIds).toEqual(["cp_start"]);
    expect(status?.respawnState).toBe("idle");
    expect(status?.results).toBeNull();
    expect(status?.prologueCompleted).toBe(false);
  });

  it("counts respawn events after the launch is ready", async () => {
    const fake = createFakeApplication();
    const { host, exposed } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host);

    if (preparation.kind !== "launch") {
      throw new Error("expected a launch preparation");
    }

    await preparation.handle.activate(fake);

    fake.respawn.destination = { position: { x: 0, y: 0.93, z: 10 } };

    for (const listener of fake.respawnListeners) {
      listener();
    }

    const status = exposed[0]?.status() ?? null;

    expect(status?.respawnCount).toBe(1);
    expect(status?.respawnDestination).toEqual({ x: 0, y: 0.93, z: 10 });
  });

  it("fails visibly, abandons the session, and never reports ready when start throws", async () => {
    const fake = createFakeApplication({ throwOnStart: new Error("boom") });
    const { host, exposed, failures, logs } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host);

    if (preparation.kind !== "launch") {
      throw new Error("expected a launch preparation");
    }

    const result = await preparation.handle.activate(fake);
    const api = exposed[0];

    expect(result.success).toBe(false);
    expect(result.error).toContain("startGameplay threw");
    expect(result.error).toContain("boom");
    expect(api?.ready).toBe(false);
    expect(api?.error).toContain("boom");
    expect(failures).toHaveLength(1);
    expect(failures[0]?.title).toContain("DEV launch failed");
    expect(fake.abandonReasons).toEqual(["session-failure"]);
    expect(fake.session?.status).toBe("abandoned");
    expect(fake.ui.errors).toHaveLength(1);
    expect(logs.some((line) => line.includes("abandoned"))).toBe(true);
  });

  it("fails fast when the flow reports an error and cleans up", async () => {
    const fake = createFakeApplication({ flowAfterStart: "error", sessionStatus: "failed" });
    const { host, exposed, failures } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host, { readyTimeoutMs: 5_000 });

    if (preparation.kind !== "launch") {
      throw new Error("expected a launch preparation");
    }

    const startedAt = Date.now();
    const result = await preparation.handle.activate(fake);

    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(result.success).toBe(false);
    expect(result.error).toContain('flow "error"');
    expect(exposed[0]?.ready).toBe(false);
    expect(failures).toHaveLength(1);
    expect(fake.abandonReasons).toEqual(["session-failure"]);
    expect(fake.session?.status).toBe("abandoned");
  });

  it("times out when gameplay never becomes playable and leaves no partial session", async () => {
    const fake = createFakeApplication({
      flowAfterStart: "main-menu",
      sessionStatus: "created",
    });
    const { host, exposed, failures } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host, {
      readyTimeoutMs: 80,
      pollIntervalMs: 10,
    });

    if (preparation.kind !== "launch") {
      throw new Error("expected a launch preparation");
    }

    const result = await preparation.handle.activate(fake);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Timed out");
    expect(result.error).toContain("flow=main-menu");
    expect(exposed[0]?.ready).toBe(false);
    expect(failures).toHaveLength(1);
    expect(fake.abandonReasons).toEqual(["session-failure"]);
    expect(fake.session?.status).toBe("abandoned");
    expect(fake.level).toBeNull();
    expect(fake.player).toBeNull();
  });

  it("rejects a session that loads the wrong level", async () => {
    const fake = createFakeApplication({ loadedLevelId: "prologue_test" });
    const { host, exposed } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host, {
      readyTimeoutMs: 80,
      pollIntervalMs: 10,
    });

    if (preparation.kind !== "launch") {
      throw new Error("expected a launch preparation");
    }

    const result = await preparation.handle.activate(fake);

    expect(result.success).toBe(false);
    expect(result.error).toContain("level=prologue_test");
    expect(result.error).toContain("expected first_section");
    expect(exposed[0]?.ready).toBe(false);
    expect(fake.abandonReasons).toEqual(["session-failure"]);
  });

  it("does not treat a covering UI screen as playable", async () => {
    const fake = createFakeApplication({ uiScreen: "loading" });
    const { host, exposed } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host, {
      readyTimeoutMs: 80,
      pollIntervalMs: 10,
    });

    if (preparation.kind !== "launch") {
      throw new Error("expected a launch preparation");
    }

    const result = await preparation.handle.activate(fake);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Timed out");
    expect(exposed[0]?.ready).toBe(false);
    expect(fake.abandonReasons).toEqual(["session-failure"]);
  });

  it("does not abandon a session that already completed", async () => {
    const fake = createFakeApplication({
      flowAfterStart: "main-menu",
      sessionStatus: "completed",
    });
    const { host } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host, {
      readyTimeoutMs: 60,
      pollIntervalMs: 10,
    });

    if (preparation.kind !== "launch") {
      throw new Error("expected a launch preparation");
    }

    const result = await preparation.handle.activate(fake);

    expect(result.success).toBe(false);
    expect(fake.abandonReasons).toEqual([]);
  });

  it("is idempotent once ready", async () => {
    const fake = createFakeApplication();
    const { host } = createFakeHost();
    const preparation = createDevLaunch("?dev=first_section", host);

    if (preparation.kind !== "launch") {
      throw new Error("expected a launch preparation");
    }

    const first = await preparation.handle.activate(fake);
    const second = await preparation.handle.activate(fake);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(fake.startCalls).toHaveLength(1);
    expect(fake.abandonReasons).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Production isolation                                                       */
/* -------------------------------------------------------------------------- */

describe("dev launch production isolation", () => {
  it("is not referenced by the production composition root or UI", async () => {
    const { readFileSync } = await import("node:fs");

    for (const file of ["src/app/Application.ts", "src/ui/UIManager.ts"]) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

      expect(source, file).not.toContain("DevLaunch");
      expect(source, file).not.toContain("devLaunch");
      expect(source, file).not.toContain("__glasslineDevLaunch");
    }
  });

  it("is loaded from main.ts only under the DEV guard", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");

    expect(source).toMatch(/import\.meta\.env\.DEV\s*&&\s*capture === null/);
    expect(source).toContain('await import("./diagnostics/DevLaunch")');
    expect(source).toContain("prepareDevLaunch()");
    expect(source).toContain('devLaunch?.kind === "launch"');
  });

  it("keeps the dev launch parameter out of the capture contract", () => {
    // The two dev entry points are separate contracts: capture must not start a
    // playable session and the dev launch must not claim a capture shot.
    expect(parseDevLaunchRequest("?capture=1&level=prologue&shot=start-roof")).toEqual({
      kind: "none",
    });
  });
});
