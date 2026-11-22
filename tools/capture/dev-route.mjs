#!/usr/bin/env node
/**
 * First Section DEV-route verification and capture harness.
 *
 * Unlike `capture.mjs` (deterministic screenshot rig), this tool boots the real
 * playable development route `?dev=first_section`, drives the game with trusted
 * browser keyboard/mouse input through the existing InputManager, verifies the
 * authored route in the browser, and records evidence:
 *
 *   1. spawn: level/session/player/camera/HUD and no blocking overlay;
 *   2. input: WASD, pointer-lock mouse look, jump, sprint momentum, landing;
 *   3. route: Gap A (3.4 m) and Gap B (4.2 m) sprint jumps, plant step, gallery,
 *      slide duct, three vaults, stairs and the authored finish;
 *   4. checkpoint: activation through the authored trigger (state + toast);
 *   5. respawn: real fall into the kill volume, respawn at the active
 *      checkpoint, input/camera still operational, no repeated respawn;
 *   6. completion: authored finish trigger → results; First Section must not
 *      publish Prologue completion;
 *   7. performance: same-conditions FPS/frame-time/draw-call sampling for
 *      First Section and the menu-launched Prologue.
 *
 * Steering is closed-loop: the harness only *reads* position/yaw and sends
 * normal input. It never teleports, sets movement state, edits tuning or calls
 * gameplay internals to move the player.
 *
 * Usage:
 *   node tools/capture/dev-route.mjs --out-dir docs/evidence/first-section/step-3.4
 *   node tools/capture/dev-route.mjs --headed --no-record        # watch it play
 *   node tools/capture/dev-route.mjs --no-perf --report /tmp/dev-route.json
 *
 * No browser downloads: Playwright and system Edge are expected already.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { attachDiagnostics, launchBrowser } from "./lib/browser-session.mjs";
import * as evidence from "./lib/evidence.mjs";
import { createServerManager } from "./lib/vite-server.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_PORT = 5321;
const DEFAULT_OUT_DIR = "docs/evidence/first-section/step-3.4";
const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 900;
const DEFAULT_FRAMES = 300;
const DEFAULT_WARMUP = 120;
const MEASUREMENT_TIMEOUT_MS = 120_000;
const GAMEPLAY_TIMEOUT_MS = 60_000;
const RESPAWN_TIMEOUT_MS = 8_000;
const ROUTE_TIMEOUT_MS = 90_000;
const MOUSE_RADIANS_PER_PIXEL = 0.0022;

/** Authored route facts used only to time normal inputs (metres). */
const GAP_A_JUMP_Z = -1.55;
const GAP_A_EDGE_Z = -2.0;
const GAP_A_LANDING_MAX_Z = -5.4;
const GAP_B_JUMP_Z = -13.0;
const GAP_B_LANDING_MAX_Z = -17.6;
const STEP_JUMP_Z = -23.5;
const STEP_LANDING_Z = -27.4;
const DUCT_CROUCH_Z = -45.4;
const DUCT_EXIT_Z = -54.4;
const VAULT_CENTERS = [-59.5, -63.5, -67.5];
const STAIRS_WALK_Z = -71.5;
const FINISH_APPROACH_Z = -81;
const KILL_FALL_Z = -2.5;

const SHOT_NAMES = [
  "01-spawn.png",
  "02-movement.png",
  "03-gap-a.png",
  "04-gap-b.png",
  "05-checkpoint.png",
  "06-respawn.png",
  "07-slide-duct.png",
  "08-vault.png",
  "09-finish-approach.png",
  "10-results.png",
  "11-gap-a-inspection.png",
  "12-gap-b-inspection.png",
];

function createLogger() {
  const started = Date.now();

  return (message) => {
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[dev-route ${elapsed}s] ${message}`);
  };
}

function usageError(message) {
  const error = new Error(message);
  error.name = "UsageError";

  return error;
}

function parseArgs(argv) {
  const options = {
    url: `http://127.0.0.1:${DEFAULT_PORT}/?dev=first_section`,
    serverPort: DEFAULT_PORT,
    outDir: DEFAULT_OUT_DIR,
    report: null,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    frames: DEFAULT_FRAMES,
    warmup: DEFAULT_WARMUP,
    headless: true,
    record: true,
    perf: true,
    reuseServer: false,
    readyTimeout: GAMEPLAY_TIMEOUT_MS,
    serverTimeout: 90_000,
    skipScenario: false,
    skipPrologueBaseline: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      const next = argv[++index];

      if (next === undefined) {
        throw usageError(`Missing value for ${flag}`);
      }

      return next;
    };
    const number = () => {
      const parsed = Number(value());

      if (!Number.isFinite(parsed)) {
        throw usageError(`Expected a number for ${flag}`);
      }

      return parsed;
    };

    switch (flag) {
      case "--url":
        options.url = value();
        break;
      case "--server-port":
      case "--port":
        options.serverPort = number();
        break;
      case "--out-dir":
        options.outDir = value();
        break;
      case "--report":
        options.report = value();
        break;
      case "--width":
        options.width = number();
        break;
      case "--height":
        options.height = number();
        break;
      case "--frames":
        options.frames = number();
        break;
      case "--warmup":
        options.warmup = number();
        break;
      case "--headless":
        options.headless = true;
        break;
      case "--headed":
        options.headless = false;
        break;
      case "--record":
        options.record = true;
        break;
      case "--no-record":
        options.record = false;
        break;
      case "--perf":
        options.perf = true;
        break;
      case "--no-perf":
        options.perf = false;
        break;
      case "--reuse-server":
        options.reuseServer = true;
        break;
      case "--ready-timeout":
        options.readyTimeout = number();
        break;
      case "--server-timeout":
        options.serverTimeout = number();
        break;
      case "--skip-scenario":
        options.skipScenario = true;
        break;
      case "--skip-prologue-baseline":
        options.skipPrologueBaseline = true;
        break;
      case "--help":
      case "-h":
        printHelp();

        return null;
      default:
        throw usageError(`Unknown option: ${flag}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Glassline — First Section DEV-route verification harness

Usage:
  node tools/capture/dev-route.mjs [options]

Options:
  --url <url>            Page URL (default http://127.0.0.1:5321/?dev=first_section)
  --server-port <port>   Vite port to own/attach (default 5321)
  --out-dir <path>       Evidence folder (default ${DEFAULT_OUT_DIR})
  --report <path>        Report JSON path (default <out-dir>/report.json)
  --width/--height       Viewport (default 1600x900, DPR 1)
  --frames <n>           Measured rAF frames per perf run (default 300)
  --warmup <n>           Discarded warmup rAF frames (default 120)
  --headed               Visible Edge window (default headless)
  --no-record            Skip the continuous gameplay video
  --no-perf              Skip the FPS/draw-call comparison
  --skip-scenario        Skip gameplay verification (perf only)
  --skip-prologue-baseline   Do not measure the Prologue comparison
  --reuse-server         Never spawn Vite; fail unless the URL is already served
  --ready-timeout <ms>   Budget for window.__glasslineDevLaunch.ready (default 60000)
  --server-timeout <ms>  Budget for Vite readiness (default 90000)`);
}

/* -------------------------------------------------------------------------- */
/* Small utilities                                                            */
/* -------------------------------------------------------------------------- */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) {
    return 0;
  }

  const index = clamp(Math.ceil(sorted.length * fraction) - 1, 0, sorted.length - 1);

  return sorted[index] ?? 0;
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function computeFrameMetrics(frameTimes) {
  const sorted = [...frameTimes].sort((left, right) => left - right);
  const mean = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
  const median = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);

  return {
    frames: frameTimes.length,
    fps: {
      avg: round(1000 / mean, 2),
      median: round(1000 / median, 2),
      p1Low: round(1000 / p99, 2),
    },
    frameTimeMs: {
      mean: round(mean, 2),
      median: round(median, 2),
      p95: round(p95, 2),
      p99: round(p99, 2),
      max: round(sorted[sorted.length - 1] ?? 0, 2),
    },
  };
}

function summarize(values) {
  if (values.length === 0) {
    return { median: 0, mean: 0, max: 0 };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    median: Math.round(percentile(sorted, 0.5)),
    mean: Math.round(mean),
    max: Math.round(sorted[sorted.length - 1] ?? 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Report + checks                                                            */
/* -------------------------------------------------------------------------- */

function createChecklist(log) {
  const checks = [];

  return {
    checks,
    check(name, passed, details = null) {
      const entry = { name, passed: Boolean(passed), details };
      checks.push(entry);
      log(`${entry.passed ? "PASS" : "FAIL"} ${name}${details ? ` — ${details}` : ""}`);

      return entry.passed;
    },
    require(name, passed, details = null) {
      if (!this.check(name, passed, details)) {
        throw new Error(`Required check failed: ${name}`);
      }
    },
    get failed() {
      return checks.filter((entry) => !entry.passed);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Page helpers                                                               */
/* -------------------------------------------------------------------------- */

async function readStatus(page) {
  return await page.evaluate(() => {
    const api = window.__glasslineDevLaunch;

    if (!api) {
      return null;
    }

    return api.status ? api.status() : null;
  });
}

async function waitForStatus(page, predicate, { timeout, interval, label }) {
  const deadline = Date.now() + timeout;
  let last = null;

  while (Date.now() < deadline) {
    last = await readStatus(page);

    if (last !== null && predicate(last)) {
      return last;
    }

    await delay(interval);
  }

  throw new Error(
    `Timed out waiting for ${label}; last status: ${JSON.stringify(last)?.slice(0, 600)}`,
  );
}

async function waitForDevLaunchReady(page, timeoutMs, log) {
  const deadline = Date.now() + timeoutMs;
  let last = null;

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const api = window.__glasslineDevLaunch;

      if (!api) {
        return { present: false, ready: false, error: null, status: null };
      }

      return {
        present: true,
        ready: api.ready === true,
        error: api.error ?? null,
        status: api.status ? api.status() : null,
      };
    });

    last = state;

    if (state.ready) {
      log(
        `dev launch ready: level=${state.status?.loadedLevelId} ` +
          `session=${state.status?.sessionStatus} section=${state.status?.activeSectionId}`,
      );

      return state.status;
    }

    if (state.present && state.error) {
      throw new Error(`DEV launch failed in the browser: ${state.error}`);
    }

    await delay(100);
  }

  throw new Error(
    `window.__glasslineDevLaunch did not become ready within ${timeoutMs} ms; ` +
      `last state: ${JSON.stringify(last)?.slice(0, 600)}`,
  );
}

async function acquirePointerLock(page, viewport) {
  await page.mouse.click(Math.floor(viewport.width / 2), Math.floor(viewport.height / 2));
  await page.waitForFunction(() => document.pointerLockElement !== null, { timeout: 5_000 });

  return await page.evaluate(() => document.pointerLockElement?.id ?? null);
}

function createMouseController(page, viewport) {
  let x = Math.floor(viewport.width / 2);
  let y = Math.floor(viewport.height / 2);

  return {
    async moveBy(dx, dy) {
      x = clamp(x + dx, 1, viewport.width - 2);
      y = clamp(y + dy, 1, viewport.height - 2);
      await page.mouse.move(x, y);
    },
    get position() {
      return { x, y };
    },
  };
}

const heldKeys = new Set();

async function hold(page, code) {
  if (!heldKeys.has(code)) {
    await page.keyboard.down(code);
    heldKeys.add(code);
  }
}

async function release(page, code) {
  if (heldKeys.has(code)) {
    await page.keyboard.up(code);
    heldKeys.delete(code);
  }
}

async function releaseAll(page) {
  for (const code of [...heldKeys]) {
    await release(page, code);
  }
}

async function tap(page, code, milliseconds = 50) {
  await page.keyboard.down(code);
  await delay(milliseconds);
  await page.keyboard.up(code);
}

/**
 * Closed-loop yaw aiming with real mouse deltas. `CameraSystem.applyLook` uses
 * `yaw -= mouseX * 0.0022 * sensitivity`, so the required pixel delta is
 * derived from the measured yaw, never assumed.
 */
async function aimYaw(page, mouse, target, tolerance = 0.03, maxIterations = 24) {
  let last = 0;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const status = await readStatus(page);
    const current = status?.camera?.yaw;
    last = current ?? 0;
    const error = current === undefined ? 0 : current - target;

    if (Math.abs(error) <= tolerance) {
      return last;
    }

    await mouse.moveBy(clamp(error / MOUSE_RADIANS_PER_PIXEL, -320, 320), 0);
    await delay(40);
  }

  throw new Error(`could not aim yaw to ${target} (last ${last})`);
}

async function aimPitch(page, mouse, target, tolerance = 0.03, maxIterations = 16) {
  let last = 0;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const status = await readStatus(page);
    const current = status?.camera?.pitch;
    last = current ?? 0;
    const error = current === undefined ? 0 : current - target;

    if (Math.abs(error) <= tolerance) {
      return last;
    }

    await mouse.moveBy(0, clamp(error / MOUSE_RADIANS_PER_PIXEL, -260, 260));
    await delay(40);
  }

  throw new Error(`could not aim pitch to ${target} (last ${last})`);
}

const capturedScreenshots = new Set();

async function capture(page, outDir, name, log) {
  const path = join(outDir, name);

  await page.screenshot({ path, type: "png", fullPage: false, animations: "allow" });
  capturedScreenshots.add(name);
  log(`captured ${name}`);

  return path;
}

/* -------------------------------------------------------------------------- */
/* Scenario                                                                   */
/* -------------------------------------------------------------------------- */

async function waitForBootChrome(page) {
  // The styled boot loader removes itself after the minimum visible window; a
  // lingering loader would cover the gameplay evidence.
  await page
    .waitForFunction(() => document.getElementById("boot-loader") === null, { timeout: 8_000 })
    .catch(() => undefined);
}

async function runMovementChecks(page, mouse, viewport, outDir, report, checklist, log) {
  const startup = await readStatus(page);
  const startupDom = await page.evaluate(() => ({
    hudVisible: document.querySelector(".gl-hud")?.classList.contains("is-visible") ?? false,
    hudSpeedText: document.querySelector(".gl-hud__speed")?.textContent ?? "",
    screenChildren: document.querySelector(".gl-ui__screens")?.children.length ?? -1,
    loadingVisible: document.querySelector(".gl-screen--loading") !== null,
    bootLoaderPresent: document.getElementById("boot-loader") !== null,
    canvas: {
      width: document.querySelector("#game-canvas")?.width ?? 0,
      height: document.querySelector("#game-canvas")?.height ?? 0,
    },
    pointerLocked: document.pointerLockElement?.id ?? null,
  }));

  const cameraAttached =
    startup !== null &&
    startup.camera !== null &&
    startup.player !== null &&
    Math.abs(startup.camera.yaw) < 0.35;

  report.startup = {
    status: startup,
    dom: startupDom,
    cameraAttached,
  };

  checklist.check("startup: flow is gameplay", startup?.flow === "gameplay", startup?.flow);
  checklist.check(
    "startup: gameplay session running",
    startup?.sessionStatus === "running",
    startup?.sessionStatus,
  );
  checklist.check(
    "startup: first_section loaded",
    startup?.loadedLevelId === "first_section",
    startup?.loadedLevelId,
  );
  checklist.check(
    "startup: authored initial section active",
    startup?.activeSectionId === "sec_start",
    startup?.activeSectionId,
  );
  checklist.check(
    "startup: player at the authored spawn",
    startup?.player !== null &&
      Math.abs((startup?.player?.position.z ?? 0) - 14) < 0.6 &&
      Math.abs(startup?.player?.position.x ?? 1) < 0.4,
    startup?.player ? JSON.stringify(startup.player.position) : "no player",
  );
  checklist.check(
    "startup: camera is attached to the player",
    cameraAttached,
    startup?.camera ? JSON.stringify(startup.camera) : "no camera",
  );
  checklist.check(
    "startup: gameplay HUD is visible",
    startupDom.hudVisible && startupDom.hudSpeedText.includes("m/s"),
    startupDom.hudSpeedText.trim(),
  );
  checklist.check(
    "startup: no menu or loading overlay",
    startupDom.screenChildren === 0 && !startupDom.loadingVisible,
    `screens=${startupDom.screenChildren}, loading=${startupDom.loadingVisible}`,
  );
  checklist.check(
    "startup: boot loader is gone",
    !startupDom.bootLoaderPresent,
    String(startupDom.bootLoaderPresent),
  );
  checklist.check(
    "startup: existing InputManager context is gameplay",
    startup?.inputContext === "gameplay",
    startup?.inputContext,
  );

  await capture(page, outDir, "01-spawn.png", log);

  /* --- Pointer lock + real mouse look ------------------------------------ */

  const lockedElement = await acquirePointerLock(page, viewport);

  checklist.check(
    "input: pointer lock acquired on the game canvas",
    lockedElement === "game-canvas",
    lockedElement,
  );

  const yawBefore = (await readStatus(page))?.camera?.yaw ?? 0;

  await mouse.moveBy(180, 0);
  await delay(180);

  const yawAfterRight = (await readStatus(page))?.camera?.yaw ?? 0;

  await aimYaw(page, mouse, 0, 0.02);

  const yawRestored = (await readStatus(page))?.camera?.yaw ?? 0;
  const pitchBefore = (await readStatus(page))?.camera?.pitch ?? 0;

  await mouse.moveBy(0, 120);
  await delay(180);

  const pitchAfterDown = (await readStatus(page))?.camera?.pitch ?? 0;

  await aimPitch(page, mouse, 0, 0.02);

  const pitchRestored = (await readStatus(page))?.camera?.pitch ?? 0;

  report.mouseLook = {
    yawBefore,
    yawAfterRight,
    yawDelta: round(yawAfterRight - yawBefore, 3),
    yawRestored: round(yawRestored, 3),
    pitchBefore,
    pitchAfterDown,
    pitchDelta: round(pitchAfterDown - pitchBefore, 3),
    pitchRestored: round(pitchRestored, 3),
    pointerLocked: lockedElement,
  };

  checklist.check(
    "input: mouse right rotates the camera right (yaw decreases)",
    yawAfterRight < yawBefore - 0.25 && yawAfterRight > yawBefore - 0.6,
    `delta=${round(yawAfterRight - yawBefore, 3)} rad`,
  );
  checklist.check(
    "input: mouse look is restored to forward",
    Math.abs(yawRestored) < 0.05,
    `yaw=${round(yawRestored, 3)}`,
  );
  checklist.check(
    "input: mouse down pitches the camera down",
    pitchAfterDown < pitchBefore - 0.15,
    `delta=${round(pitchAfterDown - pitchBefore, 3)} rad`,
  );
  checklist.check(
    "input: pitch is restored to level",
    Math.abs(pitchRestored) < 0.05,
    `pitch=${round(pitchRestored, 3)}`,
  );

  /* --- WASD -------------------------------------------------------------- */

  const spawnZ = (await readStatus(page))?.player?.position.z ?? 0;
  const spawnX = (await readStatus(page))?.player?.position.x ?? 0;

  await hold(page, "KeyW");
  await delay(650);
  await release(page, "KeyW");
  await delay(450);

  const afterW = await readStatus(page);

  await hold(page, "KeyS");
  await delay(450);
  await release(page, "KeyS");
  await delay(350);

  const afterS = await readStatus(page);

  await hold(page, "KeyD");
  await delay(350);
  await release(page, "KeyD");
  await delay(300);

  const afterD = await readStatus(page);

  await hold(page, "KeyA");
  await delay(300);
  await release(page, "KeyA");
  await delay(350);

  const afterA = await readStatus(page);

  report.wasd = {
    spawn: { x: round(spawnX, 3), z: round(spawnZ, 3) },
    afterW: afterW?.player
      ? { x: round(afterW.player.position.x, 3), z: round(afterW.player.position.z, 3) }
      : null,
    afterS: afterS?.player
      ? { x: round(afterS.player.position.x, 3), z: round(afterS.player.position.z, 3) }
      : null,
    afterD: afterD?.player
      ? { x: round(afterD.player.position.x, 3), z: round(afterD.player.position.z, 3) }
      : null,
    afterA: afterA?.player
      ? { x: round(afterA.player.position.x, 3), z: round(afterA.player.position.z, 3) }
      : null,
  };

  checklist.check(
    "input: W moves forward along −Z",
    (afterW?.player?.position.z ?? 0) < spawnZ - 1.0,
    `z ${round(spawnZ, 2)} → ${round(afterW?.player?.position.z ?? 0, 2)}`,
  );
  checklist.check(
    "input: S moves backward along +Z",
    (afterS?.player?.position.z ?? 0) > (afterW?.player?.position.z ?? 0) + 0.6,
    `z ${round(afterW?.player?.position.z ?? 0, 2)} → ${round(afterS?.player?.position.z ?? 0, 2)}`,
  );
  checklist.check(
    "input: D strafes right (+X)",
    (afterD?.player?.position.x ?? 0) > spawnX + 0.3,
    `x ${round(spawnX, 2)} → ${round(afterD?.player?.position.x ?? 0, 2)}`,
  );
  checklist.check(
    "input: A strafes left (−X)",
    (afterA?.player?.position.x ?? 0) < (afterD?.player?.position.x ?? 0) - 0.2,
    `x ${round(afterD?.player?.position.x ?? 0, 2)} → ${round(afterA?.player?.position.x ?? 0, 2)}`,
  );

  await aimYaw(page, mouse, 0, 0.02);

  /* --- Jump + landing ---------------------------------------------------- */

  const jumpStartY = (await readStatus(page))?.player?.position.y ?? 0;
  let maxY = jumpStartY;
  let sawLanding = false;
  let sawAirborne = false;
  let spaceReleased = false;

  await page.keyboard.down("Space");

  const jumpStartedAt = Date.now();
  const jumpDeadline = jumpStartedAt + 3_000;

  while (Date.now() < jumpDeadline) {
    const status = await readStatus(page);
    const y = status?.player?.position.y ?? jumpStartY;

    maxY = Math.max(maxY, y);

    if (status?.player && !status.player.grounded) {
      sawAirborne = true;
    }

    if (sawAirborne && status?.player?.state === "LANDING") {
      sawLanding = true;
    }

    if (!spaceReleased && Date.now() - jumpStartedAt >= 320) {
      await page.keyboard.up("Space");
      spaceReleased = true;
    }

    if (sawAirborne && spaceReleased && status?.player?.grounded === true && y < jumpStartY + 0.1) {
      break;
    }

    await delay(12);
  }

  if (!spaceReleased) {
    await page.keyboard.up("Space");
  }

  const afterJump = await readStatus(page);

  report.jump = {
    startY: round(jumpStartY, 3),
    apexY: round(maxY, 3),
    rise: round(maxY - jumpStartY, 3),
    sawAirborne,
    sawLanding,
    groundedAfter: afterJump?.player?.grounded ?? null,
    stateAfter: afterJump?.player?.state ?? null,
  };

  checklist.check(
    "input: Space produces a real jump",
    sawAirborne && maxY - jumpStartY > 0.8,
    `rise=${round(maxY - jumpStartY, 3)} m`,
  );
  checklist.check(
    "input: landing state is observed and the player is grounded",
    sawLanding && afterJump?.player?.grounded === true,
    `LANDING=${sawLanding}, grounded=${afterJump?.player?.grounded}`,
  );

  /* --- Sprint + momentum + checkpoint through the authored trigger ------ */

  await hold(page, "KeyX");
  await hold(page, "KeyW");

  const sprintDeadline = Date.now() + 1_400;
  let maxSpeed = 0;
  let sprintStatus = null;
  let checkpoint = null;

  while (Date.now() < sprintDeadline) {
    const status = await readStatus(page);
    const speed = status?.player?.speed ?? 0;

    if (speed > maxSpeed) {
      maxSpeed = speed;
      sprintStatus = status;
    }

    // Capture the checkpoint moment immediately: the toast lives for 2.2 s and
    // the run continues to accelerate, so waiting until the sprint ends would
    // lose the visual evidence.
    if (
      checkpoint === null &&
      status?.activeCheckpointId === "cp_start" &&
      (status?.activatedCheckpointIds ?? []).includes("cp_start")
    ) {
      const toast = await page.evaluate(() => ({
        text: document.querySelector(".gl-toast")?.textContent ?? "",
        visible: document.querySelector(".gl-toast")?.classList.contains("is-visible") ?? false,
      }));

      checkpoint = {
        activeCheckpointId: status.activeCheckpointId,
        activated: status.activatedCheckpointIds,
        toast: toast.text,
        toastVisible: toast.visible,
        playerZ: round(status.player?.position.z ?? 0, 3),
      };

      await capture(page, outDir, "05-checkpoint.png", log);
    }

    if (maxSpeed >= 8.4 && checkpoint !== null) {
      break;
    }

    await delay(16);
  }

  await capture(page, outDir, "02-movement.png", log);

  await release(page, "KeyW");
  await delay(120);

  const momentumStatus = await readStatus(page);
  const speedAfterRelease = momentumStatus?.player?.speed ?? 0;

  await release(page, "KeyX");
  await delay(700);

  const stoppedStatus = await readStatus(page);

  if (checkpoint === null) {
    const status = await readStatus(page);
    const toast = await page.evaluate(() => ({
      text: document.querySelector(".gl-toast")?.textContent ?? "",
      visible: document.querySelector(".gl-toast")?.classList.contains("is-visible") ?? false,
    }));

    checkpoint = {
      activeCheckpointId: status?.activeCheckpointId ?? null,
      activated: status?.activatedCheckpointIds ?? [],
      toast: toast.text,
      toastVisible: toast.visible,
      playerZ: round(status?.player?.position.z ?? 0, 3),
      capturedAfterToastWindow: true,
    };

    await capture(page, outDir, "05-checkpoint.png", log);
  }

  report.sprint = {
    maxSpeed: round(maxSpeed, 3),
    speedAfterRelease: round(speedAfterRelease, 3),
    stoppedSpeed: round(stoppedStatus?.player?.speed ?? 0, 3),
    stateAtSpeed: sprintStatus?.player?.state ?? null,
  };

  checklist.check(
    "input: sprint reaches the authored sprint speed",
    maxSpeed >= 8.2,
    `max=${round(maxSpeed, 2)} m/s`,
  );
  checklist.check(
    "input: releasing W preserves momentum before friction stops the player",
    speedAfterRelease > 3 && speedAfterRelease < maxSpeed,
    `speed after release=${round(speedAfterRelease, 2)} m/s`,
  );
  checklist.check(
    "input: the player comes to rest when input stops",
    (stoppedStatus?.player?.speed ?? 999) < 0.6,
    `speed=${round(stoppedStatus?.player?.speed ?? 0, 2)} m/s`,
  );

  report.checkpoint = checkpoint;

  checklist.check(
    "checkpoint: cp_start activated through the authored trigger",
    checkpoint.activeCheckpointId === "cp_start" && checkpoint.activated.includes("cp_start"),
    JSON.stringify(checkpoint.activated),
  );
  checklist.check(
    "checkpoint: the existing checkpoint toast is shown",
    checkpoint.toastVisible && checkpoint.toast.length > 0,
    checkpoint.toast,
  );

  /* --- Real fall → respawn at the active checkpoint ---------------------- */

  await aimYaw(page, mouse, 0, 0.02);
  await hold(page, "KeyW");

  const beforeFall = await waitForStatus(
    page,
    (status) => (status.player?.position.z ?? 0) < KILL_FALL_Z,
    { timeout: 6_000, interval: 16, label: "the player to leave the start deck" },
  );

  // Keep walking into the void; no jump input is sent.
  const respawned = await waitForStatus(
    page,
    (status) =>
      status.respawnCount >= 1 &&
      status.respawnState === "idle" &&
      Math.abs((status.player?.position.z ?? 0) - 10) < 0.8,
    { timeout: RESPAWN_TIMEOUT_MS, interval: 25, label: "respawn at cp_start" },
  );

  await release(page, "KeyW");
  await delay(900);

  const afterRespawn = await readStatus(page);

  // No duplicate or repeated respawn after settling.
  await delay(900);

  const afterRespawnSettled = await readStatus(page);

  report.respawn = {
    zBeforeFall: round(beforeFall.player?.position.z ?? 0, 3),
    respawnCount: afterRespawn?.respawnCount ?? 0,
    respawnCountAfterSettling: afterRespawnSettled?.respawnCount ?? 0,
    respawnState: afterRespawnSettled?.respawnState ?? null,
    destination: respawned.respawnDestination,
    positionAfter: afterRespawnSettled?.player
      ? {
          x: round(afterRespawnSettled.player.position.x, 3),
          y: round(afterRespawnSettled.player.position.y, 3),
          z: round(afterRespawnSettled.player.position.z, 3),
        }
      : null,
    activeCheckpointId: afterRespawnSettled?.activeCheckpointId ?? null,
    grounded: afterRespawnSettled?.player?.grounded ?? null,
    pointerLocked: afterRespawnSettled?.pointerLocked ?? false,
  };

  checklist.check(
    "respawn: the fall reached the kill volume below the start deck",
    beforeFall.player !== null,
    `z=${round(beforeFall.player?.position.z ?? 0, 2)}`,
  );
  checklist.check(
    "respawn: exactly one respawn at the active checkpoint",
    afterRespawn?.respawnCount === 1,
    String(afterRespawn?.respawnCount ?? 0),
  );
  checklist.check(
    "respawn: destination is cp_start's authored spawn",
    Math.abs((respawned.respawnDestination?.z ?? 0) - 10) < 0.6 &&
      Math.abs(respawned.respawnDestination?.x ?? 1) < 0.4,
    JSON.stringify(respawned.respawnDestination),
  );
  checklist.check(
    "respawn: player is back at the checkpoint and grounded",
    Math.abs((afterRespawnSettled?.player?.position.z ?? 0) - 10) < 0.7 &&
      (afterRespawnSettled?.player?.position.y ?? 0) > 0.8 &&
      afterRespawnSettled?.player?.grounded === true,
    afterRespawnSettled?.player ? JSON.stringify(afterRespawnSettled.player.position) : "no player",
  );
  checklist.check(
    "respawn: no duplicate respawn after settling",
    afterRespawnSettled?.respawnCount === 1 && afterRespawnSettled?.respawnState === "idle",
    `count=${afterRespawnSettled?.respawnCount}, state=${afterRespawnSettled?.respawnState}`,
  );
  checklist.check(
    "respawn: camera and pointer lock remain operational",
    afterRespawnSettled?.pointerLocked === true && afterRespawnSettled?.camera !== null,
    `locked=${afterRespawnSettled?.pointerLocked}`,
  );

  await capture(page, outDir, "06-respawn.png", log);

  // Input still works after respawn.
  await aimYaw(page, mouse, 0, 0.02);

  const zBeforePostRespawnMove = afterRespawnSettled?.player?.position.z ?? 0;

  await hold(page, "KeyW");
  await delay(400);
  await release(page, "KeyW");
  await delay(350);

  const postRespawnMove = await readStatus(page);

  report.postRespawnInput = {
    zBefore: round(zBeforePostRespawnMove, 3),
    zAfter: round(postRespawnMove?.player?.position.z ?? 0, 3),
    yawChange: null,
  };

  const yawBeforePostRespawn = (await readStatus(page))?.camera?.yaw ?? 0;

  await mouse.moveBy(60, 0);
  await delay(150);

  const yawAfterPostRespawn = (await readStatus(page))?.camera?.yaw ?? 0;

  await aimYaw(page, mouse, 0, 0.02);

  report.postRespawnInput.yawChange = round(yawAfterPostRespawn - yawBeforePostRespawn, 3);

  checklist.check(
    "respawn: keyboard movement works after respawn",
    (postRespawnMove?.player?.position.z ?? 0) < zBeforePostRespawnMove - 0.5,
    `z ${round(zBeforePostRespawnMove, 2)} → ${round(postRespawnMove?.player?.position.z ?? 0, 2)}`,
  );
  checklist.check(
    "respawn: mouse look works after respawn",
    Math.abs(yawAfterPostRespawn - yawBeforePostRespawn) > 0.08,
    `delta=${round(yawAfterPostRespawn - yawBeforePostRespawn, 3)} rad`,
  );

  return { checkpoint, respawnCount: afterRespawnSettled?.respawnCount ?? 0 };
}

/**
 * Drives the authored route with normal input and records the traversal facts.
 * Every jump/vault/slide is a normal key event; thresholds are authored
 * positions, not teleports.
 */
async function runRouteTraversal(page, mouse, outDir, report, checklist, log) {
  await aimYaw(page, mouse, 0, 0.02);

  const traversal = {
    start: await readStatus(page),
    gapA: {},
    gapB: {},
    plantStep: {},
    gallery: {},
    slideDuct: {},
    vaults: VAULT_CENTERS.map((center) => ({ centerZ: center })),
    stairs: {},
    checkpoints: [],
    finish: null,
    screenshots: [],
  };
  const startedAt = Date.now();
  const seenCheckpoints = new Set(traversal.start?.activatedCheckpointIds ?? []);
  let spaceReleaseAt = 0;
  let jumpedA = false;
  let jumpedB = false;
  let jumpedStep = false;
  let ductEntered = false;
  let ductExited = false;
  let vaultIndex = 0;
  let lastVaultPressAt = 0;
  let stuckSince = 0;
  let maxDuctPosture = 0;
  let minDuctPosture = Number.POSITIVE_INFINITY;
  let maxGalleryLateral = 0;
  let shotGapA = false;
  let shotGapB = false;
  let shotDuct = false;
  let shotVault = false;
  let shotFinishApproach = false;
  let sawVaulting = false;

  await hold(page, "KeyW");
  await hold(page, "KeyX");

  while (Date.now() - startedAt < ROUTE_TIMEOUT_MS) {
    const status = await readStatus(page);

    if (status === null) {
      throw new Error("dev launch status disappeared during traversal");
    }

    if (status.flow === "results" || status.results !== null) {
      traversal.finish = {
        flow: status.flow,
        results: status.results,
        screen: status.screen,
        prologueCompleted: status.prologueCompleted,
        sessionStatus: status.sessionStatus,
        elapsedMs: Date.now() - startedAt,
      };
      break;
    }

    for (const checkpointId of status.activatedCheckpointIds) {
      if (!seenCheckpoints.has(checkpointId)) {
        seenCheckpoints.add(checkpointId);
        traversal.checkpoints.push({
          id: checkpointId,
          z: round(status.player?.position.z ?? 0, 3),
        });
      }
    }

    const player = status.player;

    if (!player) {
      await delay(16);
      continue;
    }

    const { x, y, z } = player.position;
    const now = Date.now();

    if (spaceReleaseAt > 0 && now >= spaceReleaseAt) {
      await release(page, "Space");
      spaceReleaseAt = 0;
    }

    // Gallery lateral drift (chamber walls at x = ±1.6).
    if (z <= -27.4 && z >= -45.4) {
      maxGalleryLateral = Math.max(maxGalleryLateral, Math.abs(x));
    }

    // S1/S2: sprint jumps over Gap A (3.4 m) and Gap B (4.2 m).
    if (!jumpedA && player.grounded && z <= GAP_A_JUMP_Z) {
      traversal.gapA.takeoff = {
        x: round(x, 3),
        y: round(y, 3),
        z: round(z, 3),
        speed: round(player.speed, 2),
      };
      await hold(page, "Space");
      spaceReleaseAt = now + 320;
      jumpedA = true;
    }

    if (jumpedA && !shotGapA && !player.grounded && z < GAP_A_EDGE_Z) {
      traversal.screenshots.push(await capture(page, outDir, "03-gap-a.png", log));
      shotGapA = true;
      traversal.gapA.airborne = { z: round(z, 3), y: round(y, 3), speed: round(player.speed, 2) };
    }

    if (
      jumpedA &&
      traversal.gapA.landing === undefined &&
      player.grounded &&
      z <= GAP_A_LANDING_MAX_Z
    ) {
      traversal.gapA.landing = { z: round(z, 3), y: round(y, 3), state: player.state };
    }

    if (
      !jumpedB &&
      jumpedA &&
      player.grounded &&
      z <= GAP_B_JUMP_Z &&
      traversal.gapA.landing !== undefined
    ) {
      traversal.gapB.takeoff = {
        x: round(x, 3),
        y: round(y, 3),
        z: round(z, 3),
        speed: round(player.speed, 2),
      };
      await hold(page, "Space");
      spaceReleaseAt = now + 320;
      jumpedB = true;
    }

    if (jumpedB && !shotGapB && !player.grounded && z < -14.0) {
      traversal.screenshots.push(await capture(page, outDir, "04-gap-b.png", log));
      shotGapB = true;
      traversal.gapB.airborne = { z: round(z, 3), y: round(y, 3), speed: round(player.speed, 2) };
    }

    if (
      jumpedB &&
      traversal.gapB.landing === undefined &&
      player.grounded &&
      z <= GAP_B_LANDING_MAX_Z
    ) {
      traversal.gapB.landing = { z: round(z, 3), y: round(y, 3), state: player.state };
    }

    // S2: jump the 0.90 m plant step.
    if (!jumpedStep && jumpedB && player.grounded && z <= STEP_JUMP_Z) {
      traversal.plantStep.takeoff = { z: round(z, 3), y: round(y, 3) };
      await hold(page, "Space");
      spaceReleaseAt = now + 320;
      jumpedStep = true;
    }

    if (
      jumpedStep &&
      traversal.plantStep.landing === undefined &&
      player.grounded &&
      z <= -25.2 &&
      z >= STEP_LANDING_Z
    ) {
      traversal.plantStep.landing = { z: round(z, 3), y: round(y, 3), state: player.state };
    }

    // S3: hold crouch before the 1.00 m slide duct, once per run.
    if (!ductEntered && z <= DUCT_CROUCH_Z) {
      await hold(page, "ShiftLeft");
      ductEntered = true;
      traversal.slideDuct.entry = { z: round(z, 3), speed: round(player.speed, 2) };
    }

    if (ductEntered && !ductExited && z <= DUCT_EXIT_Z) {
      await release(page, "ShiftLeft");
      ductExited = true;
      traversal.slideDuct.exit = { z: round(z, 3), speed: round(player.speed, 2) };
    }

    if (z <= -47.0 && z >= -54.0) {
      maxDuctPosture = Math.max(maxDuctPosture, player.postureHeight);
      minDuctPosture = Math.min(minDuctPosture, player.postureHeight);
    }

    if (ductEntered && !ductExited && !shotDuct && z < -48.5) {
      traversal.screenshots.push(await capture(page, outDir, "07-slide-duct.png", log));
      shotDuct = true;
      traversal.slideDuct.screenshot = {
        z: round(z, 3),
        postureHeight: round(player.postureHeight, 3),
      };
    }

    // S4: three vault obstacles, each triggered by a normal E press.
    if (vaultIndex < VAULT_CENTERS.length) {
      const center = VAULT_CENTERS[vaultIndex];
      const vault = traversal.vaults[vaultIndex];

      if (player.state === "VAULTING") {
        sawVaulting = true;
        vault.vaulting = true;

        if (!shotVault) {
          traversal.screenshots.push(await capture(page, outDir, "08-vault.png", log));
          shotVault = true;
        }
      }

      if (z <= center - 0.7) {
        vault.passed = true;
        vaultIndex += 1;
        lastVaultPressAt = 0;
        stuckSince = 0;
      } else if (player.grounded && z <= center + 3.0 && z >= center - 0.5) {
        if (player.state !== "VAULTING" && now - lastVaultPressAt > 250) {
          await tap(page, "KeyE", 45);
          lastVaultPressAt = now;
        }

        if (Math.abs(player.speed) < 0.8) {
          stuckSince = stuckSince === 0 ? now : stuckSince;
        } else {
          stuckSince = 0;
        }

        // Recovery: back up for a run-up and try again (never teleports).
        if (stuckSince > 0 && now - stuckSince > 450) {
          await release(page, "KeyX");
          await release(page, "KeyW");
          await hold(page, "KeyS");
          await delay(220);
          await release(page, "KeyS");
          await hold(page, "KeyW");
          await hold(page, "KeyX");
          lastVaultPressAt = 0;
          stuckSince = 0;
          vault.retries = (vault.retries ?? 0) + 1;
        }
      }
    }

    // S5: stop sprinting before the stairs and walk up with autostep.
    if (z <= STAIRS_WALK_Z && heldKeys.has("KeyX")) {
      await release(page, "KeyX");
      traversal.stairs.sprintReleasedAt = round(z, 3);
    }

    if (z <= -78.6 && traversal.stairs.podiumReached === undefined) {
      traversal.stairs.podiumReached = { z: round(z, 3), y: round(y, 3) };
    }

    if (z <= FINISH_APPROACH_Z && !shotFinishApproach) {
      traversal.screenshots.push(await capture(page, outDir, "09-finish-approach.png", log));
      shotFinishApproach = true;
    }

    await delay(10);
  }

  await releaseAll(page);
  await delay(300);

  const finishStatus = await readStatus(page).catch(() => null);

  if (traversal.finish === null && finishStatus?.results) {
    traversal.finish = {
      flow: finishStatus.flow,
      results: finishStatus.results,
      screen: finishStatus.screen,
      prologueCompleted: finishStatus.prologueCompleted,
      sessionStatus: finishStatus.sessionStatus,
      elapsedMs: Date.now() - startedAt,
    };
  }

  traversal.slideDuct.posture = {
    min: Number.isFinite(minDuctPosture) ? round(minDuctPosture, 3) : null,
    max: round(maxDuctPosture, 3),
  };
  traversal.gallery.maxLateral = round(maxGalleryLateral, 3);

  const finalStatus = finishStatus ?? (await readStatus(page));

  if (finalStatus?.flow === "results" || finalStatus?.screen === "results") {
    traversal.screenshots.push(await capture(page, outDir, "10-results.png", log));
  }

  report.traversal = traversal;

  checklist.check(
    "route: Gap A sprint jump landed on roof B",
    traversal.gapA.landing !== undefined && traversal.gapA.landing.z <= GAP_A_LANDING_MAX_Z,
    JSON.stringify(traversal.gapA.landing ?? null),
  );
  checklist.check(
    "route: Gap B sprint jump landed on roof C",
    traversal.gapB.landing !== undefined && traversal.gapB.landing.z <= GAP_B_LANDING_MAX_Z,
    JSON.stringify(traversal.gapB.landing ?? null),
  );
  checklist.check(
    "route: the 0.90 m plant step was cleared with a jump",
    traversal.plantStep.landing !== undefined && traversal.plantStep.landing.y > 0.8,
    JSON.stringify(traversal.plantStep.landing ?? null),
  );
  checklist.check(
    "route: gallery traversal stayed inside the authored corridor",
    traversal.gallery.maxLateral < 1.0,
    `maxLateral=${traversal.gallery.maxLateral} m`,
  );
  checklist.check(
    "route: the slide duct was crossed in slide posture",
    traversal.slideDuct.exit !== undefined &&
      traversal.slideDuct.posture.max !== null &&
      traversal.slideDuct.posture.max <= 0.92,
    JSON.stringify(traversal.slideDuct.posture),
  );
  checklist.check(
    "route: all three vault obstacles were vaulted",
    VAULT_CENTERS.every((_, index) => traversal.vaults[index]?.passed === true),
    JSON.stringify(
      traversal.vaults.map((vault) => ({
        passed: vault.passed ?? false,
        retries: vault.retries ?? 0,
      })),
    ),
  );
  checklist.check("route: VAULTING state observed", sawVaulting, String(sawVaulting));
  checklist.check(
    "route: the stair flights were climbed to the 4.50 m podium",
    traversal.stairs.podiumReached !== undefined && traversal.stairs.podiumReached.y > 5.2,
    JSON.stringify(traversal.stairs.podiumReached ?? null),
  );
  checklist.check(
    "checkpoint: all authored route checkpoints activated",
    ["cp_building_jump", "cp_slide", "cp_vault"].every((id) =>
      traversal.checkpoints.some((entry) => entry.id === id),
    ),
    JSON.stringify(traversal.checkpoints),
  );

  /* --- Completion -------------------------------------------------------- */

  const completion = finalStatus ?? (await readStatus(page));

  report.completion = {
    flow: completion?.flow ?? null,
    screen: completion?.screen ?? null,
    results: completion?.results ?? null,
    sessionStatus: completion?.sessionStatus ?? null,
    prologueCompleted: completion?.prologueCompleted ?? null,
  };

  checklist.check(
    "completion: the authored finish trigger completed the session",
    completion?.sessionStatus === "completed" &&
      completion?.results?.status === "completed" &&
      completion?.results?.levelId === "first_section",
    JSON.stringify(completion?.results ?? null),
  );
  checklist.check(
    "completion: the results screen is shown",
    completion?.flow === "results" && completion?.screen === "results",
    `flow=${completion?.flow}, screen=${completion?.screen}`,
  );
  checklist.check(
    "completion: First Section did not complete the Prologue campaign",
    completion?.prologueCompleted === false,
    String(completion?.prologueCompleted),
  );

  return traversal;
}

/* -------------------------------------------------------------------------- */
/* Gap inspection (separate fresh dev launch, still real controls)            */
/* -------------------------------------------------------------------------- */

/**
 * The main route run records the actual sprint jumps at a level camera, where
 * the void is below the frame. This second dev launch walks back to the authored
 * edges and looks down so the 3.4 m / 4.2 m gaps are unambiguous. It is still a
 * normal playable session driven only by keyboard/mouse input; it is never a
 * deterministic capture pose.
 */
async function runGapInspection(browser, options, viewport, outDir, report, checklist, log) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });
  let page = null;

  try {
    page = await context.newPage();

    const diagnostics = attachDiagnostics(page);

    await page.routeWebSocket(/^wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//, () => undefined);
    await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForDevLaunchReady(page, options.readyTimeout, log);
    await waitForBootChrome(page);
    await page.waitForTimeout(200);

    const mouse = createMouseController(page, viewport);

    await acquirePointerLock(page, viewport);

    // Walk to the Gap A edge and look down at the void.
    await hold(page, "KeyW");
    await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= 1.4, {
      timeout: 8_000,
      interval: 16,
      label: "the Gap A take-off edge",
    });
    await release(page, "KeyW");
    await delay(350);
    await aimYaw(page, mouse, 0, 0.02);
    await aimPitch(page, mouse, -0.45, 0.03);
    await delay(250);

    const gapAView = await readStatus(page);

    await capture(page, outDir, "11-gap-a-inspection.png", log);

    // Restore the level gaze, walk back for a full run-up and jump Gap A with
    // the same normal input the route run uses.
    await aimPitch(page, mouse, 0, 0.02);

    await hold(page, "KeyS");
    await waitForStatus(page, (status) => (status.player?.position.z ?? 0) >= 9.0, {
      timeout: 8_000,
      interval: 16,
      label: "the Gap A run-up start",
    });
    await release(page, "KeyS");
    await delay(300);
    await aimYaw(page, mouse, 0, 0.02);

    await hold(page, "KeyX");
    await hold(page, "KeyW");

    let jumped = false;
    let spaceReleaseAt = 0;
    let takeoff = null;
    let landed = null;
    const jumpDeadline = Date.now() + 10_000;

    while (Date.now() < jumpDeadline) {
      const status = await readStatus(page);
      const player = status?.player;

      if (!player) {
        break;
      }

      if (spaceReleaseAt > 0 && Date.now() >= spaceReleaseAt) {
        await release(page, "Space");
        spaceReleaseAt = 0;
      }

      if (!jumped && player.grounded && player.position.z <= -1.55) {
        takeoff = {
          z: round(player.position.z, 3),
          speed: round(player.speed, 2),
        };
        await hold(page, "Space");
        spaceReleaseAt = Date.now() + 320;
        jumped = true;
      }

      if (jumped && player.grounded && player.position.z <= -5.4) {
        landed = { z: round(player.position.z, 3), y: round(player.position.y, 3) };
        break;
      }

      if (jumped && player.position.y < 0.2) {
        break;
      }

      await delay(10);
    }

    await release(page, "Space");
    await release(page, "KeyX");
    await release(page, "KeyW");

    if (landed === null) {
      checklist.check(
        "evidence: Gap A inspection jump landed on roof B",
        false,
        "the jump did not land",
      );
      report.gapInspection = { gapA: gapAView, takeoff, landed, gapB: null };

      return;
    }

    await delay(400);
    await aimYaw(page, mouse, 0, 0.02);

    // Sprint to a controlled stop on roof B, short of the Gap B edge.
    await hold(page, "KeyX");
    await hold(page, "KeyW");
    await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= -6.5, {
      timeout: 4_000,
      interval: 12,
      label: "roof B for the Gap B inspection",
    });
    await release(page, "KeyW");
    await release(page, "KeyX");
    await delay(700);

    await aimYaw(page, mouse, 0, 0.02);
    await aimPitch(page, mouse, -0.3, 0.03);
    await delay(250);

    const gapBView = await readStatus(page);

    await capture(page, outDir, "12-gap-b-inspection.png", log);

    report.gapInspection = {
      gapA: {
        z: round(gapAView?.player?.position.z ?? 0, 3),
        pitch: round(gapAView?.camera?.pitch ?? 0, 3),
      },
      gapB: {
        z: round(gapBView?.player?.position.z ?? 0, 3),
        pitch: round(gapBView?.camera?.pitch ?? 0, 3),
      },
      takeoff,
      landed,
      diagnostics: diagnostics.snapshot(),
    };

    checklist.check(
      "evidence: Gap A inspection frame captured from the authored edge",
      gapAView !== null &&
        (gapAView?.player?.position.z ?? 0) <= 2.2 &&
        (gapAView?.player?.position.z ?? 0) >= -1.2,
      `z=${round(gapAView?.player?.position.z ?? 0, 2)}`,
    );
    checklist.check(
      "evidence: Gap A inspection jump landed on roof B",
      landed !== null && landed.z <= -5.4,
      JSON.stringify(landed),
    );
    checklist.check(
      "evidence: Gap B inspection frame captured from roof B",
      gapBView !== null && (gapBView?.player?.position.z ?? 0) < -6.0,
      `z=${round(gapBView?.player?.position.z ?? 0, 2)}`,
    );
  } finally {
    if (page !== null) {
      await releaseAll(page).catch(() => undefined);
    }

    await withTimeout(context.close(), 30_000, "gap inspection context close").catch(
      () => undefined,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Performance                                                                */
/* -------------------------------------------------------------------------- */

async function measureFrameTimes(page, { warmup, measured, timeoutMs }) {
  return await page.evaluate(
    async ({ warmup, measured, timeoutMs }) => {
      const threeRenderer = window.__glassline?.renderer?.threeRenderer ?? null;
      const previousAutoReset = threeRenderer?.info?.autoReset ?? true;

      // `info.autoReset` would make every read report only the final post pass
      // (one fullscreen draw). Disable it and reset once per measured frame so
      // the counters aggregate the scene pass and every post pass, matching the
      // capture-mode statistic that `perf.mjs` reports.
      if (threeRenderer) {
        threeRenderer.info.autoReset = false;
      }

      return await new Promise((resolvePromise, reject) => {
        const frameTimes = [];
        const drawCalls = [];
        const triangles = [];
        const startedAt = performance.now();
        let lastTimestamp = 0;
        let warmed = 0;
        let finished = false;

        const finish = (error, value) => {
          if (finished) {
            return;
          }

          finished = true;

          if (threeRenderer) {
            threeRenderer.info.autoReset = previousAutoReset;
            threeRenderer.info.reset();
          }

          if (error) {
            reject(error);
          } else {
            resolvePromise(value);
          }
        };

        const tick = (timestamp) => {
          if (finished) {
            return;
          }

          if (performance.now() - startedAt > timeoutMs) {
            finish(new Error(`frame measurement timed out (${frameTimes.length}/${measured})`));

            return;
          }

          if (lastTimestamp > 0) {
            const delta = timestamp - lastTimestamp;
            const info = threeRenderer?.info;

            if (warmed < warmup) {
              warmed += 1;
              info?.reset();
            } else {
              frameTimes.push(delta);
              drawCalls.push(info?.render.calls ?? 0);
              triangles.push(info?.render.triangles ?? 0);
              info?.reset();

              if (frameTimes.length >= measured) {
                finish(null, { frameTimes, drawCalls, triangles });

                return;
              }
            }
          }

          lastTimestamp = timestamp;
          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });
    },
    { warmup, measured, timeoutMs },
  );
}

async function readRenderEnvironment(page) {
  return await page.evaluate(() => {
    const renderer = window.__glassline?.renderer;
    const threeRenderer = renderer?.threeRenderer ?? null;
    const gl = threeRenderer?.getContext?.() ?? null;
    const debug = gl?.getExtension?.("WEBGL_debug_renderer_info") ?? null;
    const canvas = threeRenderer?.domElement ?? null;

    return {
      quality: renderer?.currentQuality ?? null,
      canvas: canvas === null ? null : { width: canvas.width, height: canvas.height },
      pixelRatio: threeRenderer?.getPixelRatio?.() ?? null,
      webgl: {
        vendor: gl ? gl.getParameter(gl.VENDOR) : null,
        renderer: gl ? gl.getParameter(gl.RENDERER) : null,
        version: gl ? gl.getParameter(gl.VERSION) : null,
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      },
      flow: window.__glassline?.flowManager?.getState?.() ?? null,
      levelId: window.__glassline?.levelRuntime?.getCurrentLevel?.()?.id ?? null,
      sessionLevelId: window.__glassline?.sessionManager?.getActiveSession?.()?.levelId ?? null,
    };
  });
}

async function runPerfSample(page, viewport, { frames, warmup, label, log }) {
  await acquirePointerLock(page, viewport).catch(() => null);

  // Representative gameplay: a short normal sprint away from the spawn, then an
  // idle standing frame with the HUD and the full city visible. Both levels use
  // the identical warmup/measurement recipe.
  await hold(page, "KeyX");
  await hold(page, "KeyW");
  await delay(1_200);
  await release(page, "KeyW");
  await release(page, "KeyX");
  await delay(350);

  const environment = await readRenderEnvironment(page);

  log(`${label}: measuring ${frames} frames after ${warmup} warmup frames`);

  const sample = await measureFrameTimes(page, {
    warmup,
    measured: frames,
    timeoutMs: MEASUREMENT_TIMEOUT_MS,
  });
  const metrics = computeFrameMetrics(sample.frameTimes);

  return {
    environment,
    metrics: {
      ...metrics,
      drawCalls: summarize(sample.drawCalls),
      triangles: summarize(sample.triangles),
    },
  };
}

async function runFirstSectionPerf(browser, options, viewport, log) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  try {
    const page = await context.newPage();
    const diagnostics = attachDiagnostics(page);

    await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForDevLaunchReady(page, options.readyTimeout, log);
    await waitForBootChrome(page);
    await page.waitForTimeout(300);

    const sample = await runPerfSample(page, viewport, {
      frames: options.frames,
      warmup: options.warmup,
      label: "First Section",
      log,
    });

    return {
      ...sample,
      diagnostics: diagnostics.snapshot(),
    };
  } finally {
    await withTimeout(context.close(), 20_000, "First Section perf context close").catch(
      () => undefined,
    );
  }
}

async function runProloguePerf(browser, baseUrl, options, viewport, log) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  try {
    const page = await context.newPage();
    const diagnostics = attachDiagnostics(page);

    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForBootChrome(page);

    // Menu labels follow the active language; accept the authored English and
    // Russian labels (the default headless locale is English).
    const prologueButton = page
      .locator(".gl-menu-button")
      .filter({ hasText: /^(Prologue|Пролог)$/ })
      .first();

    await prologueButton.waitFor({ state: "visible", timeout: 30_000 });
    await prologueButton.click();

    await page.waitForFunction(
      () =>
        window.__glassline?.flowManager?.getState?.() === "gameplay" &&
        window.__glassline?.sessionManager?.isRunning?.() === true,
      { timeout: options.readyTimeout },
    );

    const sessionLevelId = await page.evaluate(
      () => window.__glassline?.sessionManager?.getActiveSession?.()?.levelId ?? null,
    );

    const sample = await runPerfSample(page, viewport, {
      frames: options.frames,
      warmup: options.warmup,
      label: "Prologue",
      log,
    });

    return {
      ...sample,
      source: "main-menu Prologue button",
      sessionLevelId,
      diagnostics: diagnostics.snapshot(),
    };
  } finally {
    await withTimeout(context.close(), 20_000, "Prologue perf context close").catch(
      () => undefined,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Video                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Starts a CDP page screencast. Playwright's own `recordVideo` requires its
 * bundled ffmpeg download; the existing Glassline tooling already uses the
 * system `ffmpeg` with CDP frames (`route-video.mjs`), so the same approach
 * avoids a new tool dependency.
 */
async function startScreencast(context, page, viewport) {
  const cdp = await context.newCDPSession(page);
  const frames = [];
  const startedAtMs = Date.now();

  cdp.on("Page.screencastFrame", (params) => {
    frames.push({
      data: params.data,
      timestamp: params.metadata?.timestamp ?? Date.now() / 1000,
    });
    cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => undefined);
  });

  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 82,
    maxWidth: viewport.width,
    maxHeight: viewport.height,
    everyNthFrame: 1,
  });

  return {
    frames,
    async stop() {
      await cdp.send("Page.stopScreencast").catch(() => undefined);
      await cdp.detach().catch(() => undefined);

      return {
        frames,
        wallClockSeconds: (Date.now() - startedAtMs) / 1000,
      };
    },
  };
}

/** Replays the screencast frames at their measured wall-clock timestamps. */
async function encodeFrames(frames, frameDir, outputPath, log, wallClockSeconds) {
  if (frames.length < 2) {
    throw new Error(`the screencast produced only ${frames.length} frame(s)`);
  }

  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  // Raw screencast timestamps pace frames relative to each other; rescaling their
  // sum to the measured Node-side wall clock keeps the video duration honest even
  // when a screenshot pauses frame delivery.
  const rawDurations = frames.map((frame, index) => {
    const next = frames[index + 1];

    if (next === undefined) {
      return 1 / 30;
    }

    const raw = next.timestamp - frame.timestamp;

    return Number.isFinite(raw) && raw > 0 ? Math.min(2, Math.max(0.005, raw)) : 1 / 30;
  });
  const rawTotal = rawDurations.reduce((sum, value) => sum + value, 0);
  const scale =
    Number.isFinite(wallClockSeconds) && wallClockSeconds > 0 && rawTotal > 0
      ? wallClockSeconds / rawTotal
      : 1;

  const lines = ["ffconcat version 1.0"];

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const name = `frame-${String(index + 1).padStart(5, "0")}.jpg`;

    await writeFile(join(frameDir, name), Buffer.from(frame.data, "base64"));

    const duration = Math.max(0.001, (rawDurations[index] ?? 1 / 30) * scale);

    lines.push(`file '${name}'`, `duration ${duration.toFixed(4)}`);
  }

  // The concat demuxer needs the final file repeated to honour the last duration.
  lines.push(`file 'frame-${String(frames.length).padStart(5, "0")}.jpg'`);
  await writeFile(join(frameDir, "frames.txt"), `${lines.join("\n")}\n`);

  await new Promise((resolvePromise, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        join(frameDir, "frames.txt"),
        "-vf",
        "fps=30",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "24",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        outputPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";

    child.stderr?.on("data", (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4_000);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise(undefined);

        return;
      }

      reject(new Error(`ffmpeg exited with code ${code}:\n${stderr}`));
    });
  });

  log(`encoded ${outputPath}`);
}

async function probeDuration(path) {
  return await new Promise((resolvePromise) => {
    const child = spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    let output = "";

    child.stdout?.on("data", (chunk) => {
      output = `${output}${chunk.toString()}`;
    });
    child.once("error", () => resolvePromise(null));
    child.once("exit", (code) => {
      const parsed = Number.parseFloat(output.trim());

      resolvePromise(code === 0 && Number.isFinite(parsed) ? parsed : null);
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options === null) {
    return 0;
  }

  const log = createLogger();
  const viewport = { width: options.width, height: options.height };
  const outDir = resolve(ROOT_DIR, options.outDir);
  const reportPath = resolve(ROOT_DIR, options.report ?? join(options.outDir, "report.json"));
  const videoTmpDir = join(outDir, ".video");
  const baseUrl = `${new URL(options.url).origin}/`;
  const checklist = createChecklist(log);
  const report = {
    tool: "tools/capture/dev-route.mjs",
    generatedAt: new Date().toISOString(),
    launchUrl: options.url,
    viewport: { ...viewport, deviceScaleFactor: 1 },
    environment: options.headless ? "headless-edge" : "headed-edge",
    browser: null,
    host: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpuCount: os.cpus().length,
      loadAvg: os.loadavg().map((value) => round(value, 2)),
    },
    checks: checklist.checks,
    screenshots: [],
    scenario: {},
    console: { errors: [], warnings: [], pageErrors: [], failedRequests: [] },
    performance: null,
    passed: false,
    error: null,
  };

  await evidence.ensureDir(outDir);
  await rm(videoTmpDir, { recursive: true, force: true });
  await evidence.ensureDir(videoTmpDir);

  // Remove this run's previous artifacts so a failed retry cannot leave stale
  // frames that look like fresh evidence.
  for (const name of [...SHOT_NAMES, "route.mp4"]) {
    await rm(join(outDir, name), { force: true });
  }

  const server = createServerManager({
    rootDir: ROOT_DIR,
    port: options.serverPort,
    host: "127.0.0.1",
    baseUrl,
    log,
  });
  let browser = null;

  try {
    await server.ensure({ reuseServer: options.reuseServer, timeoutMs: options.serverTimeout });

    const launched = await launchBrowser({ headless: options.headless, log });

    browser = launched.browser;
    report.browser = launched.info;

    if (!options.skipScenario) {
      log("starting playable verification run (real keyboard/mouse input)");

      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      });
      let page = null;
      let screencast = null;
      let recordedFrames = null;
      let recordedWallClockSeconds = null;

      try {
        page = await context.newPage();

        const diagnostics = attachDiagnostics(page);

        // Another editor saving a file must not reload the recorded run.
        await page.routeWebSocket(/^wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//, () => undefined);

        await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 60_000 });

        const launchStatus = await waitForDevLaunchReady(page, options.readyTimeout, log);

        checklist.require(
          "launch: First Section selected by the DEV entry point",
          launchStatus?.levelId === "first_section" &&
            launchStatus?.loadedLevelId === "first_section" &&
            launchStatus?.mode === "prologue",
          `levelId=${launchStatus?.levelId}, loaded=${launchStatus?.loadedLevelId}`,
        );

        await waitForBootChrome(page);
        await page.waitForTimeout(250);

        if (options.record) {
          screencast = await startScreencast(context, page, viewport);
          log("screencast recording started");
        }

        const mouse = createMouseController(page, viewport);
        const movement = await runMovementChecks(
          page,
          mouse,
          viewport,
          outDir,
          report,
          checklist,
          log,
        );

        const traversal = await runRouteTraversal(page, mouse, outDir, report, checklist, log);

        report.scenario = {
          launch: launchStatus,
          movement,
          traversal: {
            gapA: traversal.gapA,
            gapB: traversal.gapB,
            plantStep: traversal.plantStep,
            gallery: traversal.gallery,
            slideDuct: traversal.slideDuct,
            vaults: traversal.vaults,
            stairs: traversal.stairs,
            checkpoints: traversal.checkpoints,
            finish: traversal.finish,
          },
        };

        const diagnosticsSnapshot = diagnostics.snapshot();

        report.console = diagnosticsSnapshot;

        const severeConsole = diagnosticsSnapshot.consoleErrors.filter(
          (entry) => !entry.includes("favicon"),
        );

        checklist.check(
          "runtime: no uncaught page errors",
          diagnosticsSnapshot.pageErrors.length === 0,
          `${diagnosticsSnapshot.pageErrors.length} page error(s)`,
        );
        checklist.check(
          "runtime: no console errors",
          severeConsole.length === 0,
          `${severeConsole.length} console error(s)`,
        );

        if (screencast !== null) {
          const recording = await screencast.stop();

          recordedFrames = recording.frames;
          recordedWallClockSeconds = recording.wallClockSeconds;
          screencast = null;
          log(
            `screencast stopped: ${recordedFrames.length} frames over ` +
              `${recordedWallClockSeconds.toFixed(1)} s`,
          );
        }
      } finally {
        if (screencast !== null) {
          await screencast.stop().catch(() => undefined);
        }

        if (page !== null) {
          await releaseAll(page).catch(() => undefined);
        }

        await withTimeout(context.close(), 30_000, "scenario context close").catch(() => undefined);
      }

      if (recordedFrames !== null && recordedFrames.length > 1) {
        const mp4Path = join(outDir, "route.mp4");

        try {
          await encodeFrames(
            recordedFrames,
            videoTmpDir,
            mp4Path,
            log,
            recordedWallClockSeconds ?? 0,
          );

          const videoStats = await stat(mp4Path);

          report.video = {
            file: evidence.toRepoPath(ROOT_DIR, mp4Path),
            bytes: videoStats.size,
            durationSeconds: await probeDuration(mp4Path),
            frames: recordedFrames.length,
            source: "CDP Page.startScreencast (JPEG, timestamped) → H.264 via system ffmpeg",
            controls: "trusted Playwright keyboard/mouse events; pointer lock held during the run",
          };
        } catch (error) {
          log(`video encoding failed: ${error.message}`);
          report.video = { file: null, error: String(error) };
          checklist.check("evidence: continuous gameplay video encoded", false, String(error));
        }
      }
    }

    if (!options.skipScenario) {
      log("capturing dedicated Gap A / Gap B inspection frames (same dev launch)");

      await runGapInspection(browser, options, viewport, outDir, report, checklist, log);
    }

    if (options.perf) {
      log("measuring performance (headless Edge, identical conditions)");

      const firstSection = await runFirstSectionPerf(browser, options, viewport, log);
      const prologue = options.skipPrologueBaseline
        ? null
        : await runProloguePerf(browser, baseUrl, options, viewport, log);

      const comparison = prologue
        ? {
            fpsAvgDelta: round(firstSection.metrics.fps.avg - prologue.metrics.fps.avg, 2),
            fpsMedianDelta: round(firstSection.metrics.fps.median - prologue.metrics.fps.median, 2),
            frameTimeP95DeltaMs: round(
              firstSection.metrics.frameTimeMs.p95 - prologue.metrics.frameTimeMs.p95,
              2,
            ),
            drawCallsMedianDelta: round(
              firstSection.metrics.drawCalls.median - prologue.metrics.drawCalls.median,
              2,
            ),
            trianglesMedianDelta: round(
              firstSection.metrics.triangles.median - prologue.metrics.triangles.median,
              2,
            ),
          }
        : null;

      report.performance = {
        method:
          "In-page requestAnimationFrame timestamps after a 1.2 s normal sprint and 350 ms settle; " +
          "draw calls/triangles sampled per frame from threeRenderer.info.render.",
        frames: { warmup: options.warmup, measured: options.frames },
        firstSection,
        prologue,
        comparison,
        caveats: [
          "Headless Edge frames are paced by the headless compositor; avg fps saturates near 60.",
          "Both samples use the same viewport, DPR, quality and measurement recipe in one browser instance.",
          "Numbers are a same-conditions regression comparison, not a capture-mode determinism claim.",
        ],
      };

      checklist.check(
        "performance: First Section gameplay frame metrics captured",
        firstSection.metrics.frames === options.frames,
        `frames=${firstSection.metrics.frames}`,
      );

      if (prologue) {
        checklist.check(
          "performance: Prologue baseline frame metrics captured",
          prologue.metrics.frames === options.frames,
          `frames=${prologue.metrics.frames}`,
        );
      }
    }
  } catch (error) {
    report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    log(`FAILED: ${report.error}`);
  } finally {
    if (browser !== null) {
      await withTimeout(browser.close(), 30_000, "browser close").catch(() => undefined);
    }

    await server.stop().catch(() => undefined);
    await rm(videoTmpDir, { recursive: true, force: true });
  }

  // Screenshot evidence index (sha256 + bytes) for every PNG captured this run.
  for (const name of [...capturedScreenshots].sort()) {
    const filePath = join(outDir, name);
    const buffer = await readFile(filePath);

    report.screenshots.push({
      file: evidence.toRepoPath(ROOT_DIR, filePath),
      bytes: buffer.length,
      sha256: evidence.sha256(buffer),
    });
  }

  report.passed = report.error === null && checklist.failed.length === 0;
  report.checks = checklist.checks;

  await evidence.writeJson(reportPath, report);

  console.log(
    `\n${report.passed ? "PASS" : "FAIL"} — ${checklist.checks.filter((entry) => entry.passed).length}/${checklist.checks.length} checks, ` +
      `${report.screenshots.length} screenshots, report: ${evidence.toRepoPath(ROOT_DIR, reportPath)}`,
  );

  if (!report.passed) {
    for (const failure of checklist.failed) {
      console.error(`  FAIL ${failure.name}${failure.details ? ` — ${failure.details}` : ""}`);
    }

    return 1;
  }

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = error?.name === "UsageError" ? 2 : 1;
  });
