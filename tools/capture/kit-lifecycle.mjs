#!/usr/bin/env node
/**
 * Level lifecycle probe for the Architectural Kit review composition.
 *
 * Boots the dev-only capture route (`?capture=1&level=architecture`), then
 * drives the real Gameplay Session ports: leave to the menu, start the review
 * level again, restart it twice, and leave again. At every step it reads the
 * renderer resource counters and the scene graph, so a leaked kit geometry or a
 * stale instanced mesh becomes a measured number instead of a code review
 * opinion.
 *
 * Checks:
 *   - the review level loads through the existing Level Runtime;
 *   - repeated load / restart / unload returns the renderer geometry count and
 *     the scene child count to their menu baseline;
 *   - no console errors or uncaught page errors occur during the cycle.
 *
 * Usage:
 *   node tools/capture/kit-lifecycle.mjs
 *   node tools/capture/kit-lifecycle.mjs --headed
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { launchBrowser, withIsolatedPage } from "./lib/browser-session.mjs";
import { buildCaptureUrl, waitForCaptureReady } from "./lib/capture-mode.mjs";
import { DEFAULT_READY_TIMEOUT_MS, DEFAULT_SERVER_TIMEOUT_MS, UsageError } from "./lib/cli.mjs";
import { createServerManager } from "./lib/vite-server.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_SERVER_PORT = 5199;
const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 900;
const DEFAULT_ITERATION = "arch-kit-lifecycle";
const CAPTURE_LEVEL = "architecture";
const LEVEL_ID = "architectural_kit_demo";
const POLL_INTERVAL_MS = 50;
const STATE_TIMEOUT_MS = 30_000;
const LOADED_SHOT = "kit-overview";

const HELP_LINES = [
  "Usage:",
  "  node tools/capture/kit-lifecycle.mjs [options]",
  "",
  "  --iteration <id>       Evidence folder under captures/ (default arch-kit-lifecycle)",
  "  --server-port <port>   Vite port (default 5199)",
  "  --url <url>            Base URL (default http://127.0.0.1:<server-port>/)",
  "  --reuse-server         Never spawn Vite; fail unless --url is already served",
  "  --headless / --headed  Edge window visibility (default headless)",
  "  --width / --height     Viewport (default 1600x900)",
  "  --ready-timeout <ms>   Budget for the capture contract (default 60000)",
  "  --server-timeout <ms>  Budget for Vite readiness (default 90000)",
  "  --help                 Show this help",
];

function parseArgs(argv) {
  const options = {
    help: false,
    iteration: DEFAULT_ITERATION,
    serverPort: DEFAULT_SERVER_PORT,
    url: null,
    reuseServer: false,
    headless: true,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    readyTimeout: DEFAULT_READY_TIMEOUT_MS,
    serverTimeout: DEFAULT_SERVER_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--help":
        options.help = true;
        break;
      case "--iteration":
        options.iteration = String(argv[++index] ?? "");
        break;
      case "--server-port":
      case "--port":
        options.serverPort = Number(argv[++index]);
        break;
      case "--url":
        options.url = String(argv[++index] ?? "");
        break;
      case "--reuse-server":
        options.reuseServer = true;
        break;
      case "--headless":
        options.headless = true;
        break;
      case "--headed":
        options.headless = false;
        break;
      case "--width":
        options.width = Number(argv[++index]);
        break;
      case "--height":
        options.height = Number(argv[++index]);
        break;
      case "--ready-timeout":
        options.readyTimeout = Number(argv[++index]);
        break;
      case "--server-timeout":
        options.serverTimeout = Number(argv[++index]);
        break;
      default:
        throw new UsageError(`Unknown argument "${arg}".`);
    }
  }

  return options;
}

function createLogger() {
  const started = Date.now();

  return (message) => {
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[kit-lifecycle ${elapsed}s] ${message}`);
  };
}

/** Reads runtime state + renderer resource counters from the live page. */
function readProbe(page) {
  return page.evaluate(() => {
    const app = window.__glassline;

    if (!app) {
      return { missing: true };
    }

    const scene = app.renderScene?.scene ?? null;
    const threeRenderer = app.renderer?.threeRenderer ?? null;
    const session = app.sessionManager?.getActiveSession?.() ?? null;
    const level = app.levelRuntime?.getCurrentLevel?.() ?? null;
    let instancedMeshes = 0;
    let meshes = 0;

    scene?.traverse((object) => {
      if (object.isInstancedMesh) {
        instancedMeshes += 1;
      }

      if (object.isMesh) {
        meshes += 1;
      }
    });

    const stats = window.__glasslineCapture?.stats?.() ?? null;

    return {
      missing: false,
      flow: app.flowManager?.getState?.() ?? null,
      running: app.sessionManager?.isRunning?.() ?? false,
      sessionStatus: session?.status ?? null,
      levelId: level?.id ?? null,
      sceneChildren: scene?.children.length ?? 0,
      meshes,
      instancedMeshes,
      geometries: threeRenderer?.info.memory.geometries ?? 0,
      textures: threeRenderer?.info.memory.textures ?? 0,
      programs: threeRenderer?.info.programs?.length ?? 0,
      drawCalls: stats?.drawCalls ?? 0,
      triangles: stats?.triangles ?? 0,
    };
  });
}

async function waitForState(page, predicate, label) {
  const started = Date.now();
  let state = await readProbe(page);

  while (Date.now() - started < STATE_TIMEOUT_MS) {
    if (predicate(state)) {
      return state;
    }

    await delay(POLL_INTERVAL_MS);
    state = await readProbe(page);
  }

  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(state, null, 2)}`);
}

function waitForLevel(page) {
  return waitForState(
    page,
    (state) => state.running && state.flow === "gameplay" && state.levelId === LEVEL_ID,
    "the Architectural Kit gameplay session",
  );
}

function waitForMenu(page) {
  return waitForState(
    page,
    (state) => !state.running && state.flow === "main-menu" && state.levelId === null,
    "the main menu after unload",
  );
}

async function restartLevel(page) {
  const result = await page.evaluate(async () => {
    const app = window.__glassline;
    const outcome = await app.sessionManager.restartSession();

    return { success: outcome?.success === true, error: outcome?.error ?? null };
  });

  if (!result.success) {
    throw new Error(`restartSession() failed: ${result.error ?? "unknown"}`);
  }

  return waitForLevel(page);
}

async function abandonToMenu(page) {
  // Drive the real application action (abandon -> flow -> main menu), not just
  // the session state machine: the flow transition is what tears the level down.
  await page.evaluate(async () => {
    const app = window.__glassline;

    await app.returnToMenu();
  });

  return waitForMenu(page);
}

async function startLevel(page) {
  await page.evaluate(async () => {
    const app = window.__glassline;

    await app.startGameplay("training", "architectural_kit_demo");
  });

  return waitForLevel(page);
}

function compareStates(label, expected, actual, failures) {
  // Program count is a shader-program cache and legitimately changes when the
  // menu materials are rendered after a level unload, so it is reported but not
  // treated as a leak signal.
  const keys = ["sceneChildren", "meshes", "instancedMeshes", "geometries", "textures"];

  for (const key of keys) {
    if (expected[key] !== actual[key]) {
      failures.push(
        `${label}: ${key} changed from ${String(expected[key])} to ${String(actual[key])}`,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(HELP_LINES.join("\n"));
    return;
  }

  if (!Number.isFinite(options.serverPort)) {
    throw new UsageError("--server-port expects a number.");
  }

  const log = createLogger();
  const baseUrl = options.url ?? `http://127.0.0.1:${options.serverPort}/`;
  const outputDir = resolve(ROOT_DIR, "captures", options.iteration);
  const server = createServerManager({
    rootDir: ROOT_DIR,
    port: options.serverPort,
    host: "127.0.0.1",
    baseUrl,
    log,
  });
  let browserSession = null;

  try {
    await server.ensure({
      reuseServer: options.reuseServer,
      timeoutMs: options.serverTimeout,
    });

    browserSession = await launchBrowser({ headless: options.headless, log });

    const report = await withIsolatedPage(
      browserSession.browser,
      { width: options.width, height: options.height },
      async ({ page, diagnostics }) => {
        const url = buildCaptureUrl(baseUrl, { level: CAPTURE_LEVEL, shot: LOADED_SHOT });

        await waitForCaptureReady(page, {
          url,
          timeoutMs: options.readyTimeout,
          log,
          diagnostics,
        });

        const snapshots = [];
        const failures = [];

        const loaded = await waitForLevel(page);

        log(
          `loaded: ${loaded.sceneChildren} children, ${loaded.instancedMeshes} instanced meshes, ` +
            `${loaded.geometries} geometries, ${loaded.drawCalls} draw calls`,
        );
        snapshots.push({ step: "loaded", ...loaded });

        const menu = await abandonToMenu(page);

        log(
          `menu after unload: ${menu.sceneChildren} children, ${menu.instancedMeshes} instanced meshes, ` +
            `${menu.geometries} geometries`,
        );
        snapshots.push({ step: "menu", ...menu });

        const reloaded = await startLevel(page);

        log(`reloaded: ${reloaded.sceneChildren} children, ${reloaded.geometries} geometries`);
        snapshots.push({ step: "reloaded", ...reloaded });

        const restart1 = await restartLevel(page);

        log(`restart 1: ${restart1.sceneChildren} children, ${restart1.geometries} geometries`);
        snapshots.push({ step: "restart-1", ...restart1 });

        const restart2 = await restartLevel(page);

        log(`restart 2: ${restart2.sceneChildren} children, ${restart2.geometries} geometries`);
        snapshots.push({ step: "restart-2", ...restart2 });

        const menuAgain = await abandonToMenu(page);

        log(
          `menu after final unload: ${menuAgain.sceneChildren} children, ` +
            `${menuAgain.geometries} geometries`,
        );
        snapshots.push({ step: "menu-again", ...menuAgain });

        // Same authored level must land on identical resource counts ...
        compareStates("reloaded vs loaded", loaded, reloaded, failures);
        compareStates("restart-1 vs reloaded", reloaded, restart1, failures);
        compareStates("restart-2 vs restart-1", restart1, restart2, failures);

        // ... and unloading must return to the pre-level state exactly.
        compareStates("menu-again vs menu", menu, menuAgain, failures);

        if (reloaded.levelId !== LEVEL_ID) {
          failures.push(`reloaded level id is "${String(reloaded.levelId)}"`);
        }

        const pageErrors = diagnostics.snapshot();
        const errorCount =
          pageErrors.pageErrors.length +
          pageErrors.consoleErrors.length +
          pageErrors.failedRequests.length;

        if (errorCount > 0) {
          failures.push(
            `browser reported ${pageErrors.pageErrors.length} page error(s), ` +
              `${pageErrors.consoleErrors.length} console error(s), ` +
              `${pageErrors.failedRequests.length} failed request(s)`,
          );
        }

        return {
          iteration: options.iteration,
          generatedAt: new Date().toISOString(),
          route: { level: CAPTURE_LEVEL, levelId: LEVEL_ID, shot: LOADED_SHOT },
          browser: browserSession.info,
          viewport: { width: options.width, height: options.height, deviceScaleFactor: 1 },
          snapshots,
          diagnostics: pageErrors,
          failures,
          passed: failures.length === 0,
        };
      },
    );

    if (!report.passed) {
      console.error("\nLifecycle check FAILED:");
      for (const failure of report.failures) {
        console.error(`  • ${failure}`);
      }
    } else {
      console.log("\nLifecycle check PASSED: load, reload, restart x2 and unload are stable.");
    }

    console.log(
      `\nresource counts — loaded: ${report.snapshots[0].geometries} geometries / ` +
        `${report.snapshots[0].textures} textures / ${report.snapshots[0].programs} programs; ` +
        `menu: ${report.snapshots[1].geometries} geometries / ` +
        `${report.snapshots[1].textures} textures / ${report.snapshots[1].programs} programs`,
    );

    await mkdir(outputDir, { recursive: true });
    await writeFile(resolve(outputDir, "lifecycle.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`report: ${resolve(outputDir, "lifecycle.json")}`);

    if (!report.passed) {
      process.exitCode = 1;
    }
  } finally {
    await browserSession?.browser.close().catch(() => undefined);
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
