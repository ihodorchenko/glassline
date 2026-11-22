#!/usr/bin/env node
/**
 * First Section exploratory playtest harness (Step 3.6).
 *
 * `dev-route.mjs` proves the authored golden path can be driven end to end. This
 * tool exists for the questions that a golden path cannot answer, so it
 * intentionally behaves like a player probing the route instead of an autopilot:
 *
 *   A. Walkthrough — stops at every authored segment, looks around, records what
 *      the player can see, and captures one frame per decision point (spawn and
 *      four orientations, checkpoint, Gap A edge, Gap B edge, plant step,
 *      gallery, duct approach, vault approaches, stairs, finish, results).
 *   B. Failure modes — jumps the gap from a standstill (must fail and recover),
 *      adds lateral input in the air, turns 180° while sprinting, drives the
 *      pitch to its limit, walks into the slide duct while only crouching,
 *      vaults at walk speed, jumps onto the tallest vault obstacle, stops inside
 *      the duct, and restarts from the results screen and from the pause menu.
 *   C. Restart / respawn isolation — after a restart the new generation must not
 *      inherit checkpoint, respawn or camera state; three consecutive falls must
 *      produce exactly three respawns with no duplicated diagnostics listener.
 *
 * Input is trusted Playwright keyboard/mouse through the existing InputManager.
 * The harness never teleports, edits movement state, sets tuning or calls
 * gameplay internals to move the player; it only reads `?dev=first_section`
 * status and sends normal input.
 *
 * It writes JPEG evidence (quality 82) plus report.json. Failure of any assertion
 * exits 1; observations that need a human are recorded without failing the run
 * and marked `requiresHuman: true`.
 *
 * Usage:
 *   node tools/capture/playtest.mjs
 *   node tools/capture/playtest.mjs --out-dir /tmp/playtest --no-walkthrough
 *   node tools/capture/playtest.mjs --headed
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { attachDiagnostics, launchBrowser } from "./lib/browser-session.mjs";
import {
  isWithinLateralTolerance,
  lateralToleranceSelfCheck,
  maxLateralOffset,
} from "./lib/route-math.mjs";
import { createServerManager } from "./lib/vite-server.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_PORT = 5322;
const DEFAULT_OUT_DIR = "docs/evidence/first-section/step-3.6";
const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 900;
const GAMEPLAY_TIMEOUT_MS = 60_000;
const MOUSE_RADIANS_PER_PIXEL = 0.0022;
const SHOT_QUALITY = 82;

/** Authored route facts used only to time normal input (metres). */
const ROUTE = {
  spawnZ: 14,
  checkpointStartZ: 10,
  gapATakeoffZ: -1.55,
  gapAEdgeZ: -2.0,
  gapALandingZ: -5.4,
  gapBTakeoffZ: -13.0,
  gapBLandingZ: -17.6,
  stepTakeoffZ: -23.5,
  stepLandingZ: -25.2,
  ductEntryZ: -45.4,
  ductInsideZ: -48.8,
  ductExitZ: -54.4,
  vaultCenters: [-59.5, -63.5, -67.5],
  stairsWalkZ: -71.6,
  podiumZ: -78.6,
  finishApproachZ: -81,
};

function createLogger() {
  const started = Date.now();

  return (message) => {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    console.log(`[playtest ${seconds}s] ${message}`);
  };
}

function usageError(message) {
  console.error(`playtest: ${message}\n`);

  return null;
}

function parseArgs(argv) {
  const options = {
    url: `http://127.0.0.1:${DEFAULT_PORT}/?dev=first_section`,
    serverPort: DEFAULT_PORT,
    outDir: DEFAULT_OUT_DIR,
    report: null,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    headless: true,
    reuseServer: false,
    readyTimeout: GAMEPLAY_TIMEOUT_MS,
    serverTimeout: 90_000,
    walkthrough: true,
    failureModes: true,
    polish: true,
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
      case "--ready-timeout":
        options.readyTimeout = number();
        break;
      case "--server-timeout":
        options.serverTimeout = number();
        break;
      case "--reuse-server":
        options.reuseServer = true;
        break;
      case "--headed":
        options.headless = false;
        break;
      case "--no-walkthrough":
        options.walkthrough = false;
        break;
      case "--no-failure-modes":
        options.failureModes = false;
        break;
      case "--no-polish":
        options.polish = false;
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
  console.log(`Glassline — First Section exploratory playtest harness

Usage:
  node tools/capture/playtest.mjs [options]

Options:
  --url <url>              Page URL (default http://127.0.0.1:5322/?dev=first_section)
  --server-port <port>     Vite port to own/attach (default 5322)
  --out-dir <path>         Evidence folder (default ${DEFAULT_OUT_DIR})
  --report <path>          Report JSON (default <out-dir>/report.json)
  --width/--height         Viewport (default 1600x900, DPR 1)
  --ready-timeout <ms>     Budget for window.__glasslineDevLaunch.ready
  --server-timeout <ms>    Budget for Vite readiness
  --reuse-server           Never spawn Vite; fail unless the URL is served
  --headed                 Visible Edge window (default headless)
  --no-walkthrough         Skip the segment walkthrough session
  --no-failure-modes       Skip the failure-mode session
  --no-polish              Skip the Step 3.8 toast/duct-camera session`);
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
    get failed() {
      return checks.filter((entry) => !entry.passed);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Page helpers                                                               */
/* -------------------------------------------------------------------------- */

const heldKeys = new Set();

/** Reads only the contextual prompt line (F-04 evidence). */
async function readVaultPrompt(page) {
  return await page.evaluate(() => {
    const node = document.querySelector(".gl-hud__prompt");

    return {
      text: node?.textContent ?? null,
      visible: node?.classList.contains("is-visible") ?? false,
      count: document.querySelectorAll(".gl-hud__prompt").length,
      tutorialVisible:
        document.querySelector(".gl-hud__tutorial")?.classList.contains("is-visible") ?? false,
    };
  });
}

/** Minimal poll for the toast-ordering scenario (F-05). */
async function readToastState(page) {
  return await page.evaluate(() => {
    const status = window.__glasslineDevLaunch?.status?.() ?? null;
    const toast = document.querySelector(".gl-toast");

    return {
      z: status?.player?.position.z ?? null,
      checkpoint: status?.activeCheckpointId ?? null,
      text: toast?.textContent ?? "",
      visible: toast?.classList.contains("is-visible") ?? false,
      tutorialVisible:
        document.querySelector(".gl-hud__tutorial")?.classList.contains("is-visible") ?? false,
    };
  });
}

/**
 * Read-only vault signals for the affordance range scenario (F-04).
 *
 * `available` is the production execution condition (`isVaultAvailable`);
 * `affordance` is the wider presentation signal. Reading them together proves
 * the display range did not widen the action.
 */
async function readVaultSignals(page) {
  return await page.evaluate(() => {
    const player = window.__glassline?.player ?? null;
    const prompt = document.querySelector(".gl-hud__prompt");

    return {
      available: player?.isVaultAvailable?.() ?? null,
      affordance: player?.isVaultAffordanceAvailable?.() ?? null,
      prompt: prompt?.textContent ?? null,
      promptVisible: prompt?.classList.contains("is-visible") ?? false,
      promptCount: document.querySelectorAll(".gl-hud__prompt").length,
    };
  });
}

async function readStatus(page) {
  return await page.evaluate(() => {
    const api = window.__glasslineDevLaunch;

    if (!api) {
      return null;
    }

    return api.status ? api.status() : null;
  });
}

/** One read of the dev status plus the HUD/DOM facts a player actually sees. */
async function snapshotPage(page) {
  return await page.evaluate(() => {
    const api = window.__glasslineDevLaunch;
    const status = api?.status ? api.status() : null;
    const text = (selector) => document.querySelector(selector)?.textContent ?? null;
    const hasClass = (selector, name) =>
      document.querySelector(selector)?.classList.contains(name) ?? false;

    return {
      status,
      dom: {
        hudVisible: hasClass(".gl-hud", "is-visible"),
        speed: text(".gl-hud__speed"),
        prompt: text(".gl-hud__prompt"),
        promptVisible: hasClass(".gl-hud__prompt", "is-visible"),
        promptCount: document.querySelectorAll(".gl-hud__prompt").length,
        tutorialHint: text(".gl-hud__tutorial-hint"),
        tutorialVisible: hasClass(".gl-hud__tutorial", "is-visible"),
        toast: text(".gl-toast"),
        toastVisible: hasClass(".gl-toast", "is-visible"),
        screenCount: document.querySelector(".gl-ui__screens")?.children.length ?? -1,
        loading: document.querySelector(".gl-screen--loading") !== null,
        bootLoader: document.getElementById("boot-loader") !== null,
        pointerLock: document.pointerLockElement?.id ?? null,
        firstResultsRow: text(".gl-results__row"),
        retryButton:
          [...document.querySelectorAll('.gl-ui [role="button"]')].find((button) =>
            (button.textContent ?? "").trim().toLowerCase().includes("retry"),
          )?.textContent ?? null,
      },
    };
  });
}

async function waitForStatus(page, predicate, { timeout, interval = 16, label }) {
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
    `Timed out waiting for ${label}; last status: ${JSON.stringify(last)?.slice(0, 700)}`,
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
      `last state: ${JSON.stringify(last)?.slice(0, 700)}`,
  );
}

async function waitForBootChrome(page) {
  await page
    .waitForFunction(() => document.getElementById("boot-loader") === null, null, {
      timeout: 8_000,
    })
    .catch(() => undefined);
}

async function acquirePointerLock(page, viewport) {
  const x = Math.floor(viewport.width / 2);
  const y = Math.floor(viewport.height / 2);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.mouse.click(x, y);

    try {
      await page.waitForFunction(() => document.pointerLockElement !== null, null, {
        timeout: 2_500,
      });
    } catch {
      // Retry below: the first click can land before the canvas accepts input.
    }

    const locked = await page.evaluate(() => document.pointerLockElement?.id ?? null);

    if (locked !== null) {
      return locked;
    }

    await delay(400);
  }

  return await page.evaluate(() => document.pointerLockElement?.id ?? null);
}

/**
 * Mouse look controller. In pointer lock, movement is derived from the delta
 * between consecutive positions, so the position may leave the viewport bounds
 * (verified: `mouse.move(2400, 450)` rotates the camera by the full delta). Not
 * clamping is what allows a 180° look-back inside a 1600 px viewport.
 */
function createMouseController(page, viewport) {
  let x = Math.floor(viewport.width / 2);
  let y = Math.floor(viewport.height / 2);

  return {
    async moveBy(dx, dy) {
      x += dx;
      y += dy;
      await page.mouse.move(x, y);
    },
    get position() {
      return { x, y };
    },
  };
}

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
 * Closed-loop yaw aiming with real mouse deltas. The camera applies
 * `yaw -= mouseX * 0.0022`, so the pixel delta is derived from measured yaw.
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

async function aimPitch(page, mouse, target, tolerance = 0.03, maxIterations = 20) {
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

/**
 * Captures one JPEG frame plus the full state at that instant. Every entry is
 * appended to `report.poses`, so the report ties each screenshot to measured
 * position/yaw/posture instead of to a filename alone.
 */
async function capturePose(page, outDir, name, log) {
  const snapshot = await snapshotPage(page);
  const file = `${name}.jpg`;
  const path = join(outDir, file);

  await page.screenshot({ path, type: "jpeg", quality: SHOT_QUALITY, animations: "allow" });

  const status = snapshot.status;
  const player = status?.player ?? null;
  const entry = {
    name,
    file,
    z: player === null ? null : round(player.position.z, 2),
    x: player === null ? null : round(player.position.x, 2),
    y: player === null ? null : round(player.position.y, 2),
    speed: player === null ? null : round(player.speed, 2),
    state: player?.state ?? null,
    grounded: player?.grounded ?? null,
    postureHeight: player === null ? null : round(player.postureHeight, 2),
    yaw:
      status?.camera === null || status?.camera === undefined ? null : round(status.camera.yaw, 2),
    pitch:
      status?.camera === null || status?.camera === undefined
        ? null
        : round(status.camera.pitch, 2),
    section: status?.activeSectionId ?? null,
    checkpoint: status?.activeCheckpointId ?? null,
    hud: snapshot.dom,
  };

  log(`captured ${file} @ z=${entry.z} x=${entry.x} y=${entry.y} (${entry.state})`);

  return entry;
}

/* -------------------------------------------------------------------------- */
/* Session lifecycle                                                          */
/* -------------------------------------------------------------------------- */

async function bootSession(browser, options, viewport, log) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);

  // A concurrent source edit must not reload a session mid-playtest.
  await page.routeWebSocket(/^wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//, () => undefined);

  await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 60_000 });

  const launchStatus = await waitForDevLaunchReady(page, options.readyTimeout, log);

  await waitForBootChrome(page);
  await page.waitForTimeout(250);

  const locked = await acquirePointerLock(page, viewport);
  const mouse = createMouseController(page, viewport);

  log(`pointer lock: ${locked}`);

  return { context, page, diagnostics, mouse, launchStatus };
}

async function closeSession(session) {
  await releaseAll(session.page).catch(() => undefined);
  await session.context.close().catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Movement helpers                                                           */
/* -------------------------------------------------------------------------- */

/** Holds W (and X) until the player reaches `targetZ`, then stops. */
async function driveTo(page, mouse, targetZ, { sprint = false, timeoutMs = 20_000 } = {}) {
  await aimYaw(page, mouse, 0);

  await hold(page, "KeyW");

  if (sprint) {
    await hold(page, "KeyX");
  }

  try {
    await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= targetZ, {
      timeout: timeoutMs,
      label: `z <= ${targetZ}`,
    });
  } finally {
    await release(page, "KeyW");
    await release(page, "KeyX");
  }

  await delay(sprint ? 700 : 450);

  return await readStatus(page);
}

/** Backs up (S) until `targetZ` is reached, so a jump has a run-up. */
async function backUpTo(page, targetZ, timeoutMs = 12_000) {
  await hold(page, "KeyS");

  try {
    await waitForStatus(page, (status) => (status.player?.position.z ?? 0) >= targetZ, {
      timeout: timeoutMs,
      label: `z >= ${targetZ}`,
    });
  } finally {
    await release(page, "KeyS");
  }

  await delay(450);
}

/**
 * Closed-loop lateral walk with A/D pulses; used to charge a vault obstacle from
 * a measured lateral offset. Normal input only, no teleports.
 */
async function strafeToX(page, mouse, targetX, { tolerance = 0.12, timeoutMs = 8_000 } = {}) {
  await aimYaw(page, mouse, 0);

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await readStatus(page);
    const x = status?.player?.position.x ?? 0;
    const error = targetX - x;

    if (Math.abs(error) <= tolerance) {
      await delay(300);

      return await readStatus(page);
    }

    const key = error > 0 ? "KeyD" : "KeyA";
    const pulse = clamp(Math.abs(error) * 160, 40, 140);

    await hold(page, key);
    await delay(pulse);
    await release(page, key);

    // Ground deceleration (14 m/s²) needs ~0.4 s from run speed; wait for the
    // body to settle so the next read is not a mid-slide position.
    await waitForStatus(page, (status) => Math.abs(status.player?.speed ?? 99) < 0.25, {
      timeout: 1_500,
      interval: 20,
      label: "strafe settle",
    }).catch(() => undefined);
    await delay(80);
  }

  throw new Error(`could not strafe to x=${targetX}`);
}

/**
 * Precise short walk with 60–260 ms pulses, used to stop at a specific
 * authored z (for example the route-clearance views on the start roof). It only
 * sends normal W input; the position feedback closes the loop.
 */
async function stepToZ(
  page,
  mouse,
  targetZ,
  { tolerance = 0.15, sprint = false, timeoutMs = 20_000 } = {},
) {
  await aimYaw(page, mouse, 0);

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await readStatus(page);
    const z = status?.player?.position.z ?? 0;
    const error = z - targetZ;

    if (Math.abs(error) <= tolerance) {
      return await readStatus(page);
    }

    const forward = error > 0;

    await hold(page, forward ? "KeyW" : "KeyS");

    if (sprint) {
      await hold(page, "KeyX");
    }

    const pulse = clamp(Math.abs(error) * 140, 60, 260);

    await delay(pulse);
    await release(page, forward ? "KeyW" : "KeyS");
    await release(page, "KeyX");
    await delay(220);
  }

  throw new Error(`could not step to z=${targetZ}`);
}

/**
 * Sprint jump over an authored gap/step. Holds W+X until take-off, presses Space
 * for 320 ms (full-height jump), keeps holding W+X through the arc, and waits
 * for a grounded landing past `landZ`. The optional airborne capture fires
 * ~140 ms after take-off, while the player is still rising.
 */
async function sprintJump(page, mouse, { takeoffZ, landZ, label, onAirborne = null }) {
  await aimYaw(page, mouse, 0);
  await hold(page, "KeyX");
  await hold(page, "KeyW");

  try {
    await waitForStatus(
      page,
      (status) => status.player?.grounded === true && (status.player?.position.z ?? 0) <= takeoffZ,
      { timeout: 9_000, interval: 10, label: `${label} take-off at z=${takeoffZ}` },
    );

    const takeoff = await readStatus(page);

    await hold(page, "Space");
    await delay(160);

    if (onAirborne !== null) {
      await onAirborne(await readStatus(page));
    }

    await delay(160);
    await release(page, "Space");

    const landing = await waitForStatus(
      page,
      (status) => status.player?.grounded === true && (status.player?.position.z ?? 0) <= landZ,
      { timeout: 5_000, interval: 10, label: `${label} landing past z=${landZ}` },
    );

    return { takeoff, landing };
  } finally {
    await release(page, "KeyW");
    await release(page, "KeyX");
    await delay(350);
  }
}

async function waitForRespawn(page, expectedCount, { timeoutMs = 8_000 } = {}) {
  return await waitForStatus(
    page,
    (status) =>
      status.respawnCount >= expectedCount &&
      status.respawnState === "idle" &&
      status.player?.grounded === true,
    { timeout: timeoutMs, interval: 25, label: `respawn #${expectedCount}` },
  );
}

/* -------------------------------------------------------------------------- */
/* Session A — segment walkthrough                                            */
/* -------------------------------------------------------------------------- */

async function runWalkthrough(browser, options, viewport, outDir, report, checklist, log) {
  const session = await bootSession(browser, options, viewport, log);
  const { page, diagnostics, mouse } = session;
  const poses = report.poses;
  const segments = {};

  const capture = async (name) => {
    const entry = await capturePose(page, outDir, name, log);

    poses.push(entry);

    return entry;
  };

  try {
    const startup = await snapshotPage(page);

    report.scenarios.walkthrough = { startup, segments };

    checklist.check(
      "startup: First Section runs in gameplay with the authored spawn",
      startup.status?.flow === "gameplay" &&
        startup.status?.sessionStatus === "running" &&
        startup.status?.loadedLevelId === "first_section" &&
        startup.status?.activeSectionId === "sec_start" &&
        Math.abs((startup.status?.player?.position.z ?? 0) - ROUTE.spawnZ) < 0.6 &&
        Math.abs(startup.status?.camera?.yaw ?? 1) < 0.05,
      `flow=${startup.status?.flow}, level=${startup.status?.loadedLevelId}, ` +
        `z=${round(startup.status?.player?.position.z ?? 0, 2)}`,
    );
    checklist.check(
      "startup: HUD is visible and no overlay covers the game",
      startup.dom.hudVisible &&
        startup.dom.screenCount === 0 &&
        !startup.dom.loading &&
        !startup.dom.bootLoader,
      `hud=${startup.dom.hudVisible}, screens=${startup.dom.screenCount}`,
    );

    /* --- A1. Spawn orientation ------------------------------------------- */

    const spawnForward = await capture("01-spawn-forward");

    await aimYaw(page, mouse, -Math.PI / 2);
    await delay(150);
    const spawnRight = await capture("02-spawn-look-right");

    await aimYaw(page, mouse, Math.PI);
    await delay(150);
    const spawnBack = await capture("03-spawn-look-back");

    await aimYaw(page, mouse, Math.PI / 2);
    await delay(150);
    const spawnLeft = await capture("04-spawn-look-left");

    await aimYaw(page, mouse, 0);
    await delay(150);

    const afterLook = await readStatus(page);

    segments.spawn = {
      forward: spawnForward,
      right: spawnRight,
      back: spawnBack,
      left: spawnLeft,
      driftWhileLooking: round(
        Math.hypot(
          (afterLook?.player?.position.x ?? 0) - (spawnForward.x ?? 0),
          (afterLook?.player?.position.z ?? 0) - (spawnForward.z ?? 0),
        ),
        3,
      ),
    };

    checklist.check(
      "startup: looking around does not move or rotate the body",
      segments.spawn.driftWhileLooking < 0.05 && Math.abs(afterLook?.camera?.yaw ?? 1) < 0.05,
      `drift=${segments.spawn.driftWhileLooking} m`,
    );

    /* --- A2. Checkpoint and the start-roof route clearance ------------- */

    await driveTo(page, mouse, ROUTE.checkpointStartZ + 0.55, { sprint: false });
    await delay(120);

    const firstToast = await snapshotPage(page);

    // Toast messages are queued, so a first-time tutorial toast can sit ahead of
    // the checkpoint confirmation. Record it and then wait for the checkpoint
    // toast itself instead of asserting on whatever happens to be visible.
    const checkpointToastDeadline = Date.now() + 6_000;
    let checkpointToast = null;

    while (Date.now() < checkpointToastDeadline) {
      const snapshot = await snapshotPage(page);

      if (snapshot.dom.toastVisible === true && (snapshot.dom.toast ?? "").includes("Checkpoint")) {
        checkpointToast = snapshot;
        break;
      }

      await delay(100);
    }

    const checkpointPose = await capture("05-checkpoint-start");
    const checkpointStatus = await readStatus(page);

    segments.checkpointStart = {
      pose: checkpointPose,
      activeCheckpointId: checkpointStatus?.activeCheckpointId ?? null,
      activated: checkpointStatus?.activatedCheckpointIds ?? [],
      firstToast: firstToast.dom.toast,
      toast: checkpointToast?.dom.toast ?? null,
      toastVisible: checkpointToast !== null,
    };

    checklist.check(
      "checkpoint: cp_start activated by walking through the authored trigger",
      checkpointStatus?.activeCheckpointId === "cp_start" &&
        (checkpointStatus?.activatedCheckpointIds ?? []).includes("cp_start"),
      JSON.stringify(checkpointStatus?.activatedCheckpointIds ?? []),
    );
    checklist.check(
      "checkpoint: the checkpoint toast reaches the player",
      checkpointToast !== null,
      checkpointToast?.dom.toast ?? firstToast.dom.toast,
    );

    // Step 3.8 F-02: the two S0 joints that used to stand on the centreline at
    // z = 10 and z = 2 are now mounted on the penthouse face. These frames
    // document that the checkpoint marker and the Gap A approach are clear.
    await stepToZ(page, mouse, ROUTE.checkpointStartZ);
    const routeClearAtCheckpoint = await capture("06-route-clearance-checkpoint");

    await stepToZ(page, mouse, ROUTE.checkpointStartZ - 1.4);
    const routeClearPastCheckpoint = await capture("07-route-clearance-past-checkpoint");

    segments.routeClearance = {
      checkpoint: routeClearAtCheckpoint,
      pastCheckpoint: routeClearPastCheckpoint,
    };

    await stepToZ(page, mouse, 2);
    const routeClearBeforeGap = await capture("08-route-clearance-before-gap-a");

    segments.routeClearance.beforeGapA = routeClearBeforeGap;

    /* --- A3. Gap A ------------------------------------------------------- */

    await driveTo(page, mouse, 2.5, { sprint: true });
    await stepToZ(page, mouse, -0.7, { tolerance: 0.15 });
    await aimPitch(page, mouse, -0.5);
    await delay(150);
    const gapAEdge = await capture("09-gap-a-edge");
    await aimPitch(page, mouse, -1.15);
    await delay(150);
    const gapAEdgeDown = await capture("09-gap-a-edge-down");
    await aimPitch(page, mouse, 0);

    await backUpTo(page, 2.2);

    let gapAAir = null;
    const gapA = await sprintJump(page, mouse, {
      takeoffZ: ROUTE.gapATakeoffZ,
      landZ: ROUTE.gapALandingZ,
      label: "Gap A",
      onAirborne: async () => {
        gapAAir = await capture("10-gap-a-airborne");
      },
    });
    const gapALanding = await capture("11-gap-a-landing");

    segments.gapA = {
      edge: gapAEdge,
      edgeDown: gapAEdgeDown,
      airborne: gapAAir,
      takeoff: {
        z: round(gapA.takeoff?.player?.position.z ?? 0, 2),
        speed: round(gapA.takeoff?.player?.speed ?? 0, 2),
      },
      landing: {
        z: round(gapA.landing?.player?.position.z ?? 0, 2),
        y: round(gapA.landing?.player?.position.y ?? 0, 2),
        state: gapA.landing?.player?.state ?? null,
        speed: round(gapA.landing?.player?.speed ?? 0, 2),
      },
      pose: gapALanding,
    };

    checklist.check(
      "route: Gap A (3.4 m) is cleared by a normal sprint jump",
      (gapA.landing?.player?.position.z ?? 0) <= ROUTE.gapALandingZ &&
        (gapA.landing?.player?.position.y ?? 0) > 0.8,
      `landed z=${round(gapA.landing?.player?.position.z ?? 0, 2)}`,
    );
    checklist.check(
      "route: Gap A take-off has a visible edge and enough run-up",
      gapAEdge.z !== null && gapAEdge.z > ROUTE.gapAEdgeZ,
      `edge frame z=${gapAEdge.z}, take-off z=${round(gapA.takeoff?.player?.position.z ?? 0, 2)}`,
    );

    /* --- A4. Gap B ------------------------------------------------------- */

    await driveTo(page, mouse, -10.0, { sprint: true });
    await stepToZ(page, mouse, -12.9, { tolerance: 0.15 });
    await aimPitch(page, mouse, -0.5);
    await delay(150);
    const gapBEdge = await capture("12-gap-b-edge");
    await aimPitch(page, mouse, -1.15);
    await delay(150);
    const gapBEdgeDown = await capture("12-gap-b-edge-down");
    await aimPitch(page, mouse, 0);

    await backUpTo(page, -8.4);

    let gapBAir = null;
    const gapB = await sprintJump(page, mouse, {
      takeoffZ: ROUTE.gapBTakeoffZ,
      landZ: ROUTE.gapBLandingZ,
      label: "Gap B",
      onAirborne: async () => {
        gapBAir = await capture("13-gap-b-airborne");
      },
    });
    const gapBLanding = await capture("14-gap-b-landing");

    segments.gapB = {
      edge: gapBEdge,
      edgeDown: gapBEdgeDown,
      airborne: gapBAir,
      takeoff: {
        z: round(gapB.takeoff?.player?.position.z ?? 0, 2),
        speed: round(gapB.takeoff?.player?.speed ?? 0, 2),
      },
      landing: {
        z: round(gapB.landing?.player?.position.z ?? 0, 2),
        y: round(gapB.landing?.player?.position.y ?? 0, 2),
        state: gapB.landing?.player?.state ?? null,
      },
      pose: gapBLanding,
    };

    checklist.check(
      "route: Gap B (4.2 m) is cleared by a normal sprint jump",
      (gapB.landing?.player?.position.z ?? 0) <= ROUTE.gapBLandingZ &&
        (gapB.landing?.player?.position.y ?? 0) > 0.8,
      `landed z=${round(gapB.landing?.player?.position.z ?? 0, 2)}`,
    );

    /* --- A5. Plant step -------------------------------------------------- */

    await driveTo(page, mouse, -19.0, { sprint: true });
    await stepToZ(page, mouse, -22.0, { tolerance: 0.2 });
    await aimPitch(page, mouse, -0.15);
    await delay(150);
    const stepApproach = await capture("15-plant-step-approach");
    await aimPitch(page, mouse, 0);

    await backUpTo(page, -19.8);

    const step = await sprintJump(page, mouse, {
      takeoffZ: ROUTE.stepTakeoffZ,
      landZ: ROUTE.stepLandingZ,
      label: "plant step",
    });
    const stepLanding = await capture("16-plant-step-landing");

    segments.plantStep = {
      approach: stepApproach,
      takeoff: { z: round(step.takeoff?.player?.position.z ?? 0, 2) },
      landing: {
        z: round(step.landing?.player?.position.z ?? 0, 2),
        y: round(step.landing?.player?.position.y ?? 0, 2),
        state: step.landing?.player?.state ?? null,
      },
      pose: stepLanding,
    };

    checklist.check(
      "route: the 0.90 m plant step is cleared and landed on",
      (step.landing?.player?.position.y ?? 0) > 0.8 &&
        (step.landing?.player?.position.z ?? 0) <= ROUTE.stepLandingZ,
      `y=${round(step.landing?.player?.position.y ?? 0, 2)}`,
    );

    /* --- A6. Gallery ----------------------------------------------------- */

    await driveTo(page, mouse, -28.6, { sprint: false });
    const galleryEntry = await capture("17-gallery-entry");

    await driveTo(page, mouse, -33.0, { sprint: false });
    const galleryMid = await capture("18-gallery-mid");

    await driveTo(page, mouse, -39.6, { sprint: false });
    const galleryExit = await capture("19-gallery-exit");

    const galleryStatus = await readStatus(page);
    // Step 3.7 Scope C: the Step 3.6 check used `(x ?? 9) < 1.0`, which accepted
    // any negative offset. Judge the absolute deviation and keep missing poses
    // failing through the sentinel.
    const galleryMaxLateral = maxLateralOffset([galleryEntry.x, galleryMid.x, galleryExit.x]);

    segments.gallery = {
      entry: galleryEntry,
      mid: galleryMid,
      exit: galleryExit,
      maxLateral: galleryMaxLateral,
      state: galleryStatus?.player?.state ?? null,
    };

    checklist.check(
      "route: the gallery corridor is crossed inside its authored 3.2 m width",
      [galleryEntry, galleryMid, galleryExit].every((pose) =>
        isWithinLateralTolerance(pose.x, 1.0),
      ),
      `maxLateral=${galleryMaxLateral} m`,
    );

    /* --- A7. Slide duct: crouch attempt, then a real slide ---------------- */

    await driveTo(page, mouse, -43.0, { sprint: true });
    await stepToZ(page, mouse, -44.5, { tolerance: 0.2 });
    await aimPitch(page, mouse, -0.1);
    await delay(150);
    const ductApproach = await capture("20-duct-approach");
    await aimPitch(page, mouse, 0);

    // Natural first attempt: walk up and hold crouch. Crouch height (1.15 m) is
    // taller than the authored 1.0 m duct clearance, so the player must slide.
    await stepToZ(page, mouse, -46.2, { tolerance: 0.2 });
    const crouchBefore = await readStatus(page);

    await hold(page, "ShiftLeft");
    await hold(page, "KeyW");
    await delay(1_000);
    await release(page, "KeyW");

    // Capture while crouch is still held. Releasing Shift starts the stand-up
    // transition, and a frame taken then (as in Step 3.6) shows the lintel
    // filling the view — that is not the settled crouch state.
    const ductCrouchBlocked = await capture("21-duct-crouch-blocked");
    const crouchBlocked = await readStatus(page);

    await release(page, "ShiftLeft");
    await delay(300);

    // Back out, then sprint-slide through.
    await backUpTo(page, -44.2);
    await delay(400);

    await hold(page, "KeyX");
    await hold(page, "KeyW");

    let ductInside = null;
    let ductCrouchMax = 0;

    await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= ROUTE.ductEntryZ, {
      timeout: 8_000,
      interval: 10,
      label: "the duct entry",
    });
    await hold(page, "ShiftLeft");

    const ductDeadline = Date.now() + 12_000;

    while (Date.now() < ductDeadline) {
      const status = await readStatus(page);
      const z = status?.player?.position.z ?? 0;

      if (z <= -47.2 && z >= ROUTE.ductExitZ) {
        ductCrouchMax = Math.max(ductCrouchMax, status?.player?.postureHeight ?? 0);
      }

      if (ductInside === null && z <= ROUTE.ductInsideZ) {
        ductInside = await capture("22-duct-inside-slide");

        // Playtest probe: stop inside the 1.0 m duct and see whether the body
        // can stand, stay still, and move again. A player who stops here must
        // never be trapped.
        await release(page, "KeyW");
        await release(page, "KeyX");
        await release(page, "ShiftLeft");

        const stopped = await snapshotPage(page);

        await delay(900);

        const settled = await snapshotPage(page);

        await capture("23-duct-stopped-inside");

        await hold(page, "KeyW");
        await delay(600);
        await release(page, "KeyW");

        const afterMove = await snapshotPage(page);

        report.scenarios.walkthrough.ductStop = {
          stopped: summarizePose(stopped),
          settled: summarizePose(settled),
          afterMove: summarizePose(afterMove),
        };

        checklist.check(
          "duct: stopping inside the 1.0 m duct does not trap or teleport the player",
          Math.abs(
            (afterMove.status?.player?.position.z ?? 0) - (settled.status?.player?.position.z ?? 0),
          ) > 0.3 &&
            (settled.status?.player?.position.y ?? 0) > 0.7 &&
            Math.abs((settled.status?.player?.postureHeight ?? 0) - 0.9) < 0.2,
          `z ${round(settled.status?.player?.position.z ?? 0, 2)} → ` +
            `${round(afterMove.status?.player?.position.z ?? 0, 2)}, posture=` +
            `${round(settled.status?.player?.postureHeight ?? 0, 2)}`,
        );

        // The slide was interrupted by the probe; re-enter the duct flow with a
        // normal slide from the current position.
        await hold(page, "ShiftLeft");
        await hold(page, "KeyX");
        await hold(page, "KeyW");

        await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= ROUTE.ductExitZ, {
          timeout: 12_000,
          interval: 10,
          label: "the duct exit after the stop probe",
        });
        break;
      }

      if (z <= ROUTE.ductExitZ) {
        break;
      }

      await delay(10);
    }

    await release(page, "ShiftLeft");
    await release(page, "KeyW");
    await release(page, "KeyX");
    await delay(500);

    const ductExitPose = await capture("24-duct-exit");

    segments.duct = {
      approach: ductApproach,
      crouchBeforeZ: round(crouchBefore?.player?.position.z ?? 0, 2),
      crouchBlockedZ: round(crouchBlocked?.player?.position.z ?? 0, 2),
      crouchBlockedState: crouchBlocked?.player?.state ?? null,
      crouchBlockedPose: ductCrouchBlocked,
      inside: ductInside,
      exit: ductExitPose,
      maxPostureInDuct: round(ductCrouchMax, 2),
    };

    checklist.check(
      "duct: holding crouch alone does not enter the 1.0 m duct",
      (crouchBlocked?.player?.position.z ?? 0) > ROUTE.ductEntryZ - 1.7,
      `crouch stopped at z=${round(crouchBlocked?.player?.position.z ?? 0, 2)} ` +
        `(${crouchBlocked?.player?.state ?? "?"})`,
    );
    checklist.check(
      "duct: a normal sprint-slide crosses the duct",
      (ductExitPose.z ?? 0) <= ROUTE.ductExitZ && (ductCrouchMax ?? 9) <= 0.92,
      `exit z=${ductExitPose.z}, maxPosture=${round(ductCrouchMax, 2)}`,
    );

    /* --- A8. Vaults ------------------------------------------------------ */

    await driveTo(page, mouse, -56.4, { sprint: false });
    await aimPitch(page, mouse, -0.1);
    await delay(150);
    const vaultApproach1 = await capture("25-vault-1-approach");
    await aimPitch(page, mouse, 0);

    let vaultMoment = null;
    const firstVault = await runVaultSequence(page, mouse, [ROUTE.vaultCenters[0]], async () => {
      vaultMoment = await capture("26-vault-moment");
    });
    const vaultApproach2 = await capture("26-vault-2-approach");
    const remainingVaults = await runVaultSequence(page, mouse, ROUTE.vaultCenters.slice(1));
    const vaultsCleared = await capture("27-vaults-cleared");

    const vaultResults = [
      {
        centerZ: ROUTE.vaultCenters[0],
        passed: firstVault.results[0]?.passed === true,
      },
      ...remainingVaults.results.map((entry) => ({
        centerZ: entry.centerZ,
        passed: entry.passed === true,
      })),
    ];
    const sawVaulting = firstVault.sawVaulting || remainingVaults.sawVaulting;

    segments.vaults = {
      results: vaultResults,
      sawVaulting,
      approach1: vaultApproach1,
      approach2: vaultApproach2,
      moment: vaultMoment,
      cleared: vaultsCleared,
      stuckRecoveries: firstVault.stuckRecoveries + remainingVaults.stuckRecoveries,
    };

    checklist.check(
      "route: all three vault obstacles are passed in normal play",
      ROUTE.vaultCenters.every((_, index) => vaultResults[index]?.passed === true),
      JSON.stringify(vaultResults),
    );
    checklist.check(
      "route: the vault action is an observed VAULTING state, not a jump shortcut",
      sawVaulting === true,
      String(sawVaulting),
    );

    /* --- A9. Stairs and podium ------------------------------------------ */

    await driveTo(page, mouse, -71.0, { sprint: false });
    await aimPitch(page, mouse, 0.15);
    await delay(150);
    const stairsApproach = await capture("28-stairs-approach");
    await aimPitch(page, mouse, 0);

    await hold(page, "KeyW");

    await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= ROUTE.podiumZ, {
      timeout: 12_000,
      interval: 16,
      label: "the finish podium",
    });
    await release(page, "KeyW");
    await delay(500);

    const podium = await capture("29-finish-podium");

    segments.stairs = {
      approach: stairsApproach,
      podium,
    };

    checklist.check(
      "route: the stair flights reach the 4.50 m podium without a jump",
      (podium.y ?? 0) > 5.2,
      `podium y=${podium.y}`,
    );

    /* --- A10. Finish and results ---------------------------------------- */

    await aimYaw(page, mouse, 0);
    await driveTo(page, mouse, ROUTE.finishApproachZ, { sprint: false });
    const finishApproach = await capture("30-finish-approach");

    await hold(page, "KeyW");

    const results = await waitForStatus(page, (status) => status.flow === "results", {
      timeout: 12_000,
      interval: 25,
      label: "the results screen",
    });
    await release(page, "KeyW");
    await delay(600);

    const resultsPose = await capture("31-results");
    const resultsSnapshot = await snapshotPage(page);

    segments.finish = {
      approach: finishApproach,
      results: resultsPose,
      resultsRow: resultsSnapshot.dom.firstResultsRow,
    };

    checklist.check(
      "completion: the authored finish trigger ends the session with First Section results",
      results.sessionStatus === "completed" &&
        results.results?.levelId === "first_section" &&
        results.flow === "results" &&
        results.screen === "results",
      JSON.stringify(results.results ?? null),
    );
    checklist.check(
      "completion: the Results screen names First Section",
      (resultsSnapshot.dom.firstResultsRow ?? "").toLowerCase().includes("first section"),
      resultsSnapshot.dom.firstResultsRow,
    );
    checklist.check(
      "completion: First Section does not complete the Prologue campaign",
      results.prologueCompleted === false,
      String(results.prologueCompleted),
    );

    /* --- A11. Restart from results, then three clean deaths -------------- */

    const sessionIdBefore = results.sessionId;
    const respawnBefore = results.respawnCount;
    const retryButton = resultsSnapshot.dom.retryButton;

    checklist.check(
      "restart: the Results screen offers the Retry action",
      retryButton !== null && retryButton.trim().length > 0,
      retryButton,
    );

    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.gl-ui [role="button"]')].find((candidate) =>
        (candidate.textContent ?? "").trim().toLowerCase().includes("retry"),
      );

      button?.click();
    });

    await waitForStatus(
      page,
      (status) =>
        status.flow === "gameplay" &&
        status.sessionStatus === "running" &&
        (status.player?.position.z ?? 0) > 12.5 &&
        status.screen === null,
      { timeout: 30_000, interval: 25, label: "the restarted First Section session" },
    );

    await delay(900);

    const restartPose = await capture("32-restart-clean");
    const restartSnapshot = await snapshotPage(page);

    const restartCheckpoint = restartSnapshot.status?.activeCheckpointId ?? null;
    const restartActivated = restartSnapshot.status?.activatedCheckpointIds ?? [];

    report.scenarios.walkthrough.restart = {
      sessionIdBefore,
      sessionIdAfter: restartSnapshot.status?.sessionId ?? null,
      checkpoint: restartCheckpoint,
      activated: restartActivated,
      camera: restartSnapshot.status?.camera ?? null,
      player: restartSnapshot.status?.player?.position ?? null,
      pose: restartPose,
      pointerLock: restartSnapshot.dom.pointerLock,
      toast: restartSnapshot.dom.toast,
      toastVisible: restartSnapshot.dom.toastVisible,
    };

    checklist.check(
      "restart: the restarted session spawns at the initial spawn",
      Math.abs((restartSnapshot.status?.player?.position.z ?? 0) - ROUTE.spawnZ) < 0.7 &&
        (restartSnapshot.status?.player?.grounded ?? false) === true,
      `z=${round(restartSnapshot.status?.player?.position.z ?? 0, 2)}`,
    );
    checklist.check(
      "restart: no checkpoint from the previous session leaks into the new one",
      restartCheckpoint === null && restartActivated.length === 0,
      `active=${restartCheckpoint}, activated=${JSON.stringify(restartActivated)}`,
    );
    checklist.check(
      "restart: the camera is reset to the forward view",
      Math.abs(restartSnapshot.status?.camera?.yaw ?? 1) < 0.05,
      JSON.stringify(restartSnapshot.status?.camera ?? null),
    );
    checklist.check(
      "restart: HUD and pointer lock are available immediately",
      restartSnapshot.dom.hudVisible === true &&
        restartSnapshot.dom.screenCount === 0 &&
        restartSnapshot.dom.pointerLock === "game-canvas",
      `hud=${restartSnapshot.dom.hudVisible}, lock=${restartSnapshot.dom.pointerLock}`,
    );
    checklist.check(
      "restart: no toast from the previous run survives into the new session",
      restartSnapshot.dom.toastVisible !== true &&
        (restartSnapshot.dom.toast ?? "").trim().length === 0,
      `toast=${JSON.stringify(restartSnapshot.dom.toast ?? null)}, ` +
        `visible=${String(restartSnapshot.dom.toastVisible)}`,
    );

    // Control must work immediately after the restart (no extra click).
    const restartZBefore = restartSnapshot.status?.player?.position.z ?? 0;

    await hold(page, "KeyW");
    await delay(500);
    await release(page, "KeyW");
    await delay(300);

    const restartMoved = await readStatus(page);

    checklist.check(
      "restart: movement input works immediately after the restart",
      (restartMoved?.player?.position.z ?? 0) < restartZBefore - 0.8,
      `z ${round(restartZBefore, 2)} → ${round(restartMoved?.player?.position.z ?? 0, 2)}`,
    );

    // Three consecutive deaths, each expected to produce exactly one respawn.
    const deathRounds = [];
    let expectedRespawns = respawnBefore;

    for (let round = 1; round <= 3; round += 1) {
      expectedRespawns += 1;

      await aimYaw(page, mouse, 0);
      await hold(page, "KeyX");
      await hold(page, "KeyW");
      await waitForStatus(page, (status) => (status.player?.position.y ?? 1) < -0.5, {
        timeout: 8_000,
        interval: 16,
        label: `death #${round}`,
      });
      await release(page, "KeyW");
      await release(page, "KeyX");

      const respawned = await waitForRespawn(page, expectedRespawns);

      await delay(500);

      const settled = await readStatus(page);

      deathRounds.push({
        round,
        respawnCount: settled?.respawnCount ?? 0,
        position: settled?.player?.position ?? null,
        grounded: settled?.player?.grounded ?? null,
        state: settled?.player?.state ?? null,
        destination: respawned.respawnDestination,
        activeCheckpointId: settled?.activeCheckpointId ?? null,
      });

      if (round === 1) {
        await capture("33-respawn-after-restart");
      }

      if (round === 3) {
        await capture("34-respawn-third");
      }
    }

    segments.deaths = { rounds: deathRounds, expectedRespawns };

    checklist.check(
      "respawn: three consecutive deaths produce exactly three respawns",
      expectedRespawns === respawnBefore + 3 &&
        deathRounds.every((round, index) => round.respawnCount === respawnBefore + index + 1),
      JSON.stringify(deathRounds.map((round) => round.respawnCount)),
    );
    checklist.check(
      "respawn: every recovery lands at the same checkpoint position",
      deathRounds.every(
        (round) =>
          Math.abs((round.position?.z ?? 0) - ROUTE.checkpointStartZ) < 0.8 &&
          (round.grounded ?? false) === true,
      ),
      JSON.stringify(deathRounds.map((round) => round.position)),
    );
    checklist.check(
      "respawn: repeated deaths do not duplicate diagnostics listeners",
      deathRounds.every((round, index) => round.respawnCount === respawnBefore + index + 1),
      `counts=${JSON.stringify(deathRounds.map((round) => round.respawnCount))}`,
    );

    await releaseAll(page);

    const diagnosticsSnapshot = diagnostics.snapshot();

    report.scenarios.walkthrough.console = diagnosticsSnapshot;

    checklist.check(
      "runtime: the walkthrough produced no console or page errors",
      diagnosticsSnapshot.consoleErrors.length === 0 &&
        diagnosticsSnapshot.pageErrors.length === 0 &&
        diagnosticsSnapshot.failedRequests.length === 0,
      JSON.stringify({
        consoleErrors: diagnosticsSnapshot.consoleErrors.slice(0, 3),
        pageErrors: diagnosticsSnapshot.pageErrors.slice(0, 3),
      }),
    );
  } finally {
    await closeSession(session);
  }

  return segments;
}

function summarizePose(snapshot) {
  const player = snapshot.status?.player ?? null;

  return {
    z: player === null ? null : round(player.position.z, 2),
    y: player === null ? null : round(player.position.y, 2),
    state: player?.state ?? null,
    postureHeight: player === null ? null : round(player.postureHeight, 2),
    grounded: player?.grounded ?? null,
    camera: snapshot.status?.camera ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Session B — failure modes and control edge cases                           */
/* -------------------------------------------------------------------------- */

async function runFailureModes(browser, options, viewport, outDir, report, checklist, log) {
  const session = await bootSession(browser, options, viewport, log);
  const { page, diagnostics, mouse } = session;
  const poses = report.poses;
  const failureModes = {};

  const capture = async (name) => {
    const entry = await capturePose(page, outDir, name, log);

    poses.push(entry);

    return entry;
  };

  try {
    /* --- B0. Look limits and a sharp 180° turn on the start roof ---------- */

    const pitchBefore = (await readStatus(page))?.camera?.pitch ?? 0;

    await mouse.moveBy(0, -1_400);
    await delay(200);
    const pitchUp = (await readStatus(page))?.camera?.pitch ?? 0;

    await mouse.moveBy(0, 2_800);
    await delay(200);
    const pitchDown = (await readStatus(page))?.camera?.pitch ?? 0;

    await aimPitch(page, mouse, 0);

    const lookPose = await capture("40-look-limits");

    failureModes.lookLimits = {
      pitchBefore: round(pitchBefore, 3),
      pitchUp: round(pitchUp, 3),
      pitchDown: round(pitchDown, 3),
      pose: lookPose,
    };

    checklist.check(
      "camera: pitch stays inside a finite, non-inverted range",
      Number.isFinite(pitchUp) &&
        Number.isFinite(pitchDown) &&
        Math.abs(pitchUp) < Math.PI / 2 &&
        Math.abs(pitchDown) < Math.PI / 2,
      `up=${round(pitchUp, 3)}, down=${round(pitchDown, 3)}`,
    );

    await aimYaw(page, mouse, 0);

    // Sprint forward, stop, turn 180° in place, then sprint along the new view.
    // This separates camera control from the curved path a turn produces while
    // moving, so a direction bug cannot hide behind the turn arc.
    await hold(page, "KeyW");
    await hold(page, "KeyX");
    await delay(500);
    await release(page, "KeyW");
    await release(page, "KeyX");
    await delay(600);

    const beforeTurn = await readStatus(page);

    for (let step = 0; step < 8; step += 1) {
      await mouse.moveBy(200, 0);
      await delay(40);
    }

    await delay(300);

    const afterTurn = await readStatus(page);
    const turnDrift = Math.hypot(
      (afterTurn?.player?.position.x ?? 0) - (beforeTurn?.player?.position.x ?? 0),
      (afterTurn?.player?.position.z ?? 0) - (beforeTurn?.player?.position.z ?? 0),
    );

    const zBeforeSprint = afterTurn?.player?.position.z ?? 0;

    // Sprint along the new (turned) view: it must follow the camera, not the
    // previous heading.
    await hold(page, "KeyW");
    await hold(page, "KeyX");
    await delay(600);
    await release(page, "KeyW");
    await release(page, "KeyX");
    await delay(400);

    const afterSprint = await readStatus(page);
    const turnPose = await capture("41-sharp-turn");
    const zAfterTurn = afterSprint?.player?.position.z ?? 0;
    const turnedBackwards = zAfterTurn > zBeforeSprint + 1.0;

    failureModes.sharpTurn = {
      yawBefore: round(beforeTurn?.camera?.yaw ?? 0, 3),
      yawAfter: round(afterTurn?.camera?.yaw ?? 0, 3),
      yawDelta: round((afterTurn?.camera?.yaw ?? 0) - (beforeTurn?.camera?.yaw ?? 0), 3),
      zBeforeTurn: round(beforeTurn?.player?.position.z ?? 0, 2),
      zBeforeSprint: round(zBeforeSprint, 2),
      zAfterSprint: round(zAfterTurn, 2),
      driftDuringTurn: round(turnDrift, 3),
      turnedBackwards,
      state: afterSprint?.player?.state ?? null,
      pose: turnPose,
    };

    checklist.check(
      "camera: a sharp 180° turn does not drag the body and the new view steers the sprint",
      Math.abs((afterTurn?.camera?.yaw ?? 0) - (beforeTurn?.camera?.yaw ?? 0)) > 2.8 &&
        turnDrift < 0.1 &&
        turnedBackwards,
      `yaw ${round(beforeTurn?.camera?.yaw ?? 0, 2)} → ${round(afterTurn?.camera?.yaw ?? 0, 2)}, ` +
        `drift=${round(turnDrift, 3)} m, z ${round(zBeforeSprint, 2)} → ${round(zAfterTurn, 2)}`,
    );

    await aimYaw(page, mouse, 0);

    /* --- B1. Standstill jump at the Gap A edge --------------------------- */

    await driveTo(page, mouse, 2.0, { sprint: true });
    await stepToZ(page, mouse, -1.2, { tolerance: 0.15 });
    await aimPitch(page, mouse, -0.35);
    await delay(150);
    const edgePose = await capture("42-gap-a-standstill-edge");
    await aimPitch(page, mouse, 0);

    const beforeJump = await snapshotPage(page);
    const respawnBefore = beforeJump.status?.respawnCount ?? 0;

    await hold(page, "KeyW");
    await hold(page, "Space");
    await delay(320);
    await release(page, "Space");

    let wasAirborne = false;
    let minY = 1;
    let fellAtZ = null;

    const flightDeadline = Date.now() + 4_000;

    while (Date.now() < flightDeadline) {
      const status = await readStatus(page);

      if ((status?.player?.grounded ?? true) === false) {
        wasAirborne = true;
      }

      minY = Math.min(minY, status?.player?.position.y ?? 1);

      if (fellAtZ === null && (status?.player?.position.y ?? 1) < 0) {
        fellAtZ = round(status?.player?.position.z ?? 0, 2);
        await release(page, "KeyW");
        break;
      }

      await delay(16);
    }

    await release(page, "KeyW");
    await release(page, "Space");

    const respawned = await waitForRespawn(page, respawnBefore + 1);
    await delay(500);

    const afterFall = await snapshotPage(page);
    const fellPose = await capture("43-gap-a-standstill-fell");

    failureModes.standstillJump = {
      edge: edgePose,
      wasAirborne,
      minY: round(minY, 2),
      fellAtZ,
      respawnDestination: respawned.respawnDestination,
      afterRespawn: summarizePose(afterFall),
      pose: fellPose,
    };

    checklist.check(
      "gap A: a standstill jump cannot clear the 3.4 m gap (the run-up is required)",
      wasAirborne && minY < 0 && fellAtZ !== null,
      `airborne=${wasAirborne}, minY=${round(minY, 2)}, fellAtZ=${fellAtZ}`,
    );
    checklist.check(
      "gap A: falling into the gap recovers at the active checkpoint",
      Math.abs((afterFall.status?.player?.position.z ?? 0) - ROUTE.checkpointStartZ) < 0.8 &&
        (afterFall.status?.player?.grounded ?? false) === true &&
        (afterFall.status?.respawnCount ?? 0) === respawnBefore + 1,
      `z=${round(afterFall.status?.player?.position.z ?? 0, 2)}, ` +
        `count=${afterFall.status?.respawnCount ?? 0}`,
    );
    checklist.check(
      "gap A: the camera and input are usable immediately after the fall",
      (afterFall.status?.pointerLocked ?? false) === true &&
        Math.abs(afterFall.status?.camera?.yaw ?? 1) < 0.06,
      JSON.stringify(afterFall.status?.camera ?? null),
    );

    /* --- B2. Air control on a real Gap A jump ---------------------------- */

    await driveTo(page, mouse, 2.5, { sprint: true });
    await backUpTo(page, 2.2);

    let airStart = null;

    const airJump = await sprintJump(page, mouse, {
      takeoffZ: ROUTE.gapATakeoffZ,
      landZ: ROUTE.gapALandingZ,
      label: "Gap A air control",
      onAirborne: async (status) => {
        airStart = status;
        await hold(page, "KeyA");
        await delay(320);
        await release(page, "KeyA");
      },
    });

    const airLandingPose = await capture("44-air-control-landing");

    const lateral = Math.abs(
      (airJump.landing?.player?.position.x ?? 0) - (airJump.takeoff?.player?.position.x ?? 0),
    );

    failureModes.airControl = {
      takeoff: {
        x: round(airJump.takeoff?.player?.position.x ?? 0, 2),
        z: round(airJump.takeoff?.player?.position.z ?? 0, 2),
        speed: round(airJump.takeoff?.player?.speed ?? 0, 2),
      },
      airStart: {
        y: round(airStart?.player?.position.y ?? 0, 2),
        speed: round(airStart?.player?.speed ?? 0, 2),
      },
      landing: {
        x: round(airJump.landing?.player?.position.x ?? 0, 2),
        z: round(airJump.landing?.player?.position.z ?? 0, 2),
        state: airJump.landing?.player?.state ?? null,
        speed: round(airJump.landing?.player?.speed ?? 0, 2),
      },
      lateral: round(lateral, 2),
      pose: airLandingPose,
    };

    checklist.check(
      "air control: holding a strafe key in the air bends the jump without losing the landing",
      airJump.landing !== null &&
        lateral > 0.2 &&
        lateral < 2.5 &&
        (airJump.landing?.player?.position.z ?? 0) <= ROUTE.gapALandingZ,
      `lateral=${round(lateral, 2)} m, landed z=${round(airJump.landing?.player?.position.z ?? 0, 2)}`,
    );
    checklist.check(
      "air control: speed is preserved through the landing into the next run",
      (airJump.landing?.player?.speed ?? 0) > 4.5,
      `${round(airJump.landing?.player?.speed ?? 0, 2)} m/s after landing`,
    );

    /* --- B5. Vault stability (F-01) and discoverability (F-04) ---------- */

    await aimYaw(page, mouse, 0);
    await traverseToVaults(page, mouse, log);

    const firstCenter = ROUTE.vaultCenters[0];

    // 1. Sprint charge without E from outside the display reach: predictable
    //    block, no launch/back-bounce, and a measurable prompt lead.
    // The duct wall limits the standing back-up to ~z = -54.3; 4.5 m from the
    // obstacle centre is the longest reachable approach outside the 4.0 m
    // display reach.
    await backUpTo(page, firstCenter + 4.5);
    await strafeToX(page, mouse, 0);

    const unvaultedFirst = await chargeObstacle(page, mouse, {
      centerZ: firstCenter,
      sprint: true,
    });

    failureModes.unvaultedObstacles = { first: unvaultedFirst };

    const firstLaunchRise = round((unvaultedFirst.maxY ?? 0) - (unvaultedFirst.startY ?? 0), 2);
    const firstBackBounce = round((unvaultedFirst.finalZ ?? 0) - (unvaultedFirst.closestZ ?? 0), 2);

    failureModes.unvaultedFirstResponse = {
      launchRise: firstLaunchRise,
      backBounce: firstBackBounce,
      closestZ: unvaultedFirst.closestZ,
      finalZ: unvaultedFirst.finalZ,
      states: unvaultedFirst.states,
    };

    checklist.check(
      "vault: the 0.50 m obstacle blocks a sprint without E — no launch, no backward bounce, no self-vault",
      firstLaunchRise < 0.12 &&
        firstBackBounce < 0.08 &&
        (unvaultedFirst.finalZ ?? 0) > firstCenter + 0.45 &&
        unvaultedFirst.finalGrounded === true &&
        !(unvaultedFirst.states ?? []).some((state) =>
          ["JUMPING", "FALLING", "VAULTING"].includes(state),
        ),
      `rise=${firstLaunchRise} m, backBounce=${firstBackBounce} m, ` +
        `closest=${unvaultedFirst.closestZ}, final=${unvaultedFirst.finalZ}, ` +
        `states=${JSON.stringify(unvaultedFirst.states)}`,
    );
    checklist.check(
      "vault: the E · VAULT affordance appears while charging the 0.50 m obstacle without E",
      unvaultedFirst.promptSeen === true &&
        /E\s*·\s*VAULT/i.test(unvaultedFirst.promptText ?? "") &&
        unvaultedFirst.promptCountMax === 1,
      `prompt=${JSON.stringify(unvaultedFirst.promptText)}, ` +
        `count=${unvaultedFirst.promptCountMax}`,
    );
    checklist.check(
      "vault hint: the approach shows the prompt for at least 2 m before contact",
      unvaultedFirst.promptSeen === true && (unvaultedFirst.promptLeadMeters ?? 0) >= 2,
      `lead=${unvaultedFirst.promptLeadMeters} m at entry, ` +
        `entrySpeed=${unvaultedFirst.promptEntrySpeed} m/s`,
    );

    // 2. F-04 (Step 3.8): the display reach is 4.0 m while the vault action
    //    keeps its original 1.1 m. Sample all three zones: outside the display
    //    reach, inside it but outside the action, and inside the action.
    await backUpTo(page, firstCenter + 4.5);
    await strafeToX(page, mouse, 0);

    const hintFar = await readVaultPrompt(page);
    const hintFarSignals = await readVaultSignals(page);
    const hintFarPose = await capture("48-vault-hint-far");

    await stepToZ(page, mouse, firstCenter + 3.0, { tolerance: 0.2 });

    const hintEarly = await readVaultPrompt(page);
    const hintEarlySignals = await readVaultSignals(page);
    const hintEarlyStatus = await readStatus(page);
    const hintEarlyPose = await capture("51-vault-hint-display-range");

    await driveTo(page, mouse, firstCenter + 1.2, { sprint: false });

    const hintNear = await readVaultPrompt(page);
    const hintNearSignals = await readVaultSignals(page);
    const hintNearPose = await capture("49-vault-hint-near");

    await hold(page, "KeyW");

    const hintHoldSamples = [];

    for (let index = 0; index < 15; index += 1) {
      hintHoldSamples.push(await readVaultPrompt(page));
      await delay(60);
    }

    await release(page, "KeyW");
    await delay(300);

    const hintBlockedPose = await capture("50-vault-hint-blocked");
    const hintBlockedStatus = await readStatus(page);

    failureModes.vaultHint = {
      far: hintFar,
      farSignals: hintFarSignals,
      early: hintEarly,
      earlySignals: hintEarlySignals,
      earlyDistance: round((hintEarlyStatus?.player?.position.z ?? 0) - firstCenter, 2),
      earlySpeed: round(hintEarlyStatus?.player?.speed ?? 0, 2),
      near: hintNear,
      nearSignals: hintNearSignals,
      holdSamples: hintHoldSamples,
      blockedZ: round(hintBlockedStatus?.player?.position.z ?? 0, 2),
      poses: {
        far: hintFarPose,
        early: hintEarlyPose,
        near: hintNearPose,
        blocked: hintBlockedPose,
      },
    };

    checklist.check(
      "vault hint: hidden outside the 4.0 m display reach",
      hintFar.visible === false &&
        hintFarPose.hud?.promptVisible === false &&
        hintFarSignals.affordance === false,
      JSON.stringify({ ...hintFar, affordance: hintFarSignals.affordance }),
    );
    checklist.check(
      "vault hint: shown early, before the action range, and still reports the action unavailable",
      hintEarly.visible === true &&
        /E\s*·\s*VAULT/i.test(hintEarly.text ?? "") &&
        hintEarly.count === 1 &&
        hintEarlySignals.affordance === true &&
        hintEarlySignals.available === false &&
        failureModes.vaultHint.earlyDistance > 1.5,
      JSON.stringify({
        prompt: hintEarly,
        signals: hintEarlySignals,
        distance: failureModes.vaultHint.earlyDistance,
      }),
    );
    checklist.check(
      "vault hint: E · VAULT is shown inside the interaction range as a single line",
      hintNear.visible === true &&
        /E\s*·\s*VAULT/i.test(hintNear.text ?? "") &&
        hintNear.count === 1 &&
        hintNear.tutorialVisible === false &&
        hintNearSignals.affordance === true &&
        hintNearSignals.available === true,
      JSON.stringify({ prompt: hintNear, signals: hintNearSignals }),
    );
    checklist.check(
      "vault hint: visible and unduplicated while holding forward against the obstacle",
      hintHoldSamples.length === 15 &&
        hintHoldSamples.every(
          (sample) =>
            sample.visible === true &&
            sample.count === 1 &&
            /E\s*·\s*VAULT/i.test(sample.text ?? "") &&
            sample.tutorialVisible === false,
        ),
      JSON.stringify(hintHoldSamples.map((sample) => sample.visible)),
    );

    // 3. Repeated sprint charges: bounded, repeatable response.
    const repeatedCharges = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await backUpTo(page, firstCenter + 3.0);
      await strafeToX(page, mouse, 0);
      repeatedCharges.push(
        await chargeObstacle(page, mouse, { centerZ: firstCenter, sprint: true }),
      );
    }

    const repeatedFinalZ = repeatedCharges.map((entry) => entry.finalZ);
    const repeatedRise = repeatedCharges.map((entry) =>
      round((entry.maxY ?? 0) - (entry.startY ?? 0), 2),
    );
    const repeatedSpread = round(Math.max(...repeatedFinalZ) - Math.min(...repeatedFinalZ), 2);

    failureModes.vaultRepeats = {
      finals: repeatedFinalZ,
      rises: repeatedRise,
      spread: repeatedSpread,
    };

    checklist.check(
      "vault: three repeated charges from the same conditions stay bounded and repeatable",
      repeatedSpread < 0.05 &&
        repeatedRise.every((rise) => rise < 0.12) &&
        repeatedCharges.every((entry) => (entry.finalZ ?? 0) > firstCenter + 0.45),
      `finals=${JSON.stringify(repeatedFinalZ)}, rises=${JSON.stringify(repeatedRise)}, ` +
        `spread=${repeatedSpread}`,
    );

    // 4. Lateral offsets across the 4 m obstacle.
    const lateralCharges = [];

    for (const lateral of [-1.8, -1.2, 1.2, 1.8]) {
      await backUpTo(page, firstCenter + 3.0);
      await strafeToX(page, mouse, lateral);

      const charge = await chargeObstacle(page, mouse, {
        centerZ: firstCenter,
        sprint: true,
      });
      const offsetPose = lateral === -1.8 ? await capture("52-vault-offset-blocked") : null;
      const offsetStatus = await readStatus(page);

      lateralCharges.push({
        requestedLateral: lateral,
        startX: charge.startX,
        finalX: round(offsetStatus?.player?.position.x ?? 0, 2),
        finalZ: charge.finalZ,
        rise: round((charge.maxY ?? 0) - (charge.startY ?? 0), 2),
        backBounce: round((charge.finalZ ?? 0) - (charge.closestZ ?? 0), 2),
        promptSeen: charge.promptSeen,
        promptCountMax: charge.promptCountMax,
        pose: offsetPose,
      });
    }

    failureModes.vaultLateral = { charges: lateralCharges };

    checklist.check(
      "vault: sprint charges at ±1.2 m and ±1.8 m lateral offsets all block predictably",
      lateralCharges.every(
        (entry) =>
          Math.abs((entry.startX ?? 0) - entry.requestedLateral) <= 0.25 &&
          Math.abs(entry.startX ?? 0) >= 1.0 &&
          entry.rise < 0.12 &&
          entry.backBounce < 0.08 &&
          entry.finalZ > firstCenter + 0.45 &&
          entry.promptSeen === true &&
          entry.promptCountMax === 1,
      ),
      JSON.stringify(lateralCharges),
    );

    // 5. An ordinary jump next to the obstacle must keep its normal apex.
    await backUpTo(page, firstCenter + 2.0);
    await strafeToX(page, mouse, 0);
    await aimYaw(page, mouse, 0);

    const jumpStart = await readStatus(page);
    let jumpMaxY = jumpStart?.player?.position.y ?? 0;
    let jumpAirborne = false;
    let jumpLanded = false;

    await tap(page, "Space", 300);

    const jumpDeadline = Date.now() + 3_000;

    while (Date.now() < jumpDeadline) {
      const status = await readStatus(page);
      const player = status?.player;

      jumpMaxY = Math.max(jumpMaxY, player?.position.y ?? 0);

      if (player?.grounded === false) {
        jumpAirborne = true;
      }

      if (jumpAirborne && player?.grounded === true) {
        jumpLanded = true;
        break;
      }

      await delay(16);
    }

    const jumpRise = round(jumpMaxY - (jumpStart?.player?.position.y ?? 0), 2);
    const jumpPose = await capture("53-vault-jump-near");

    failureModes.vaultJump = {
      rise: jumpRise,
      airborne: jumpAirborne,
      landed: jumpLanded,
      pose: jumpPose,
    };

    checklist.check(
      "vault: an ordinary jump next to the obstacle keeps its normal apex and landing",
      jumpAirborne === true && jumpLanded === true && jumpRise > 1.1 && jumpRise < 1.9,
      `rise=${jumpRise} m, airborne=${jumpAirborne}, landed=${jumpLanded}`,
    );

    // 6. Vault with E: the affordance then advertises the *next* obstacle
    //    (obstacle 2 is ~2.4 m ahead of the landing), and stays a display-only
    //    signal until the execution range is reached.
    await backUpTo(page, firstCenter + 3.0);
    await strafeToX(page, mouse, 0);

    const firstVault = await vaultAtWalkSpeed(page, mouse, {
      centerZ: firstCenter,
      approachZ: firstCenter + 3.0,
    });

    await delay(500);

    const hintAfter = await readVaultPrompt(page);
    const hintAfterSignals = await readVaultSignals(page);
    const hintAfterPose = await capture("54-vault-hint-after");
    const afterVaultZ = round((await readStatus(page))?.player?.position.z ?? 0, 2);
    // The route runs towards -Z, so a target ahead is at a smaller z.
    const nextObstacleDistance = round(afterVaultZ - ROUTE.vaultCenters[1], 2);

    failureModes.vaultHintAfter = {
      prompt: hintAfter,
      signals: hintAfterSignals,
      nextObstacleDistance,
      vault: firstVault,
      pose: hintAfterPose,
    };

    checklist.check(
      "vault: E performs the vault and the affordance then advertises the next obstacle, not the cleared one",
      firstVault.vaulted === true &&
        hintAfter.count === 1 &&
        hintAfter.visible === true &&
        hintAfterSignals.affordance === true &&
        hintAfterSignals.available === false &&
        nextObstacleDistance > 1.5 &&
        nextObstacleDistance < 4,
      `vaulted=${firstVault.vaulted}, z=${afterVaultZ}, next=${nextObstacleDistance} m, ` +
        `prompt=${JSON.stringify(hintAfter)}, signals=${JSON.stringify(hintAfterSignals)}`,
    );

    await driveTo(page, mouse, ROUTE.vaultCenters[1] + 2.9, { sprint: true });

    // 2. Charge the 0.70 m obstacle the same way: it must block.
    const unvaultedSecond = await chargeObstacle(page, mouse, {
      centerZ: ROUTE.vaultCenters[1],
      sprint: true,
    });

    failureModes.unvaultedObstacles = {
      first: unvaultedFirst,
      second: unvaultedSecond,
    };

    checklist.check(
      "vault: the 0.70 m obstacle blocks a sprint that does not vault",
      unvaultedSecond.finalZ > ROUTE.vaultCenters[1] - 0.7,
      `closest=${unvaultedSecond.closestZ}, final=${unvaultedSecond.finalZ}, ` +
        `maxY=${unvaultedSecond.maxY}`,
    );

    // 3. Walk-vault the 0.70 m obstacle (E at walking speed), then the tallest
    //    1.10 m obstacle. This also moves the run past the obstacle that just
    //    blocked the unvaulted sprint.
    await backUpTo(page, ROUTE.vaultCenters[1] + 3.0);

    const walkVaultSecond = await vaultAtWalkSpeed(page, mouse, {
      centerZ: ROUTE.vaultCenters[1],
      approachZ: ROUTE.vaultCenters[1] + 3.0,
    });
    const vaultSecondPose = await capture("45-vault-2-vaulted");

    const vault3Approach = await capture("46-vault-3-approach");
    const walkVaultThird = await vaultAtWalkSpeed(page, mouse, {
      centerZ: ROUTE.vaultCenters[2],
      approachZ: ROUTE.vaultCenters[2] + 3.0,
    });

    // Let the last vault finish and land before reading the prompt: a hidden
    // line during `VAULTING` would prove nothing about the display reach.
    await waitForStatus(
      page,
      (status) =>
        status.player?.grounded === true &&
        status.player?.state !== "VAULTING" &&
        (status.player?.position.z ?? 0) <= -68,
      { timeout: 8_000, interval: 25, label: "the landing after the last vault" },
    ).catch(() => undefined);
    await delay(400);

    const hintClearedAll = await readVaultPrompt(page);
    const hintClearedAllSignals = await readVaultSignals(page);
    const clearedAllPose = await capture("60-vault-hint-cleared");

    failureModes.walkSpeedVault = {
      second: walkVaultSecond,
      third: walkVaultThird,
      cleared: {
        prompt: hintClearedAll,
        signals: hintClearedAllSignals,
        pose: clearedAllPose,
      },
      poses: { second: vaultSecondPose, third: vault3Approach },
    };

    checklist.check(
      "vault: walking into the 0.70 m obstacle and pressing E vaults it",
      walkVaultSecond.vaulted === true,
      JSON.stringify(walkVaultSecond),
    );
    checklist.check(
      "vault: walking into the 1.10 m obstacle and pressing E vaults it",
      walkVaultThird.vaulted === true,
      JSON.stringify(walkVaultThird),
    );
    checklist.check(
      "vault hint: hidden past the last obstacle when nothing is inside the display reach",
      hintClearedAll.visible === false &&
        hintClearedAll.count === 1 &&
        hintClearedAllSignals.affordance === false,
      JSON.stringify({ prompt: hintClearedAll, signals: hintClearedAllSignals }),
    );

    /* --- B6. Restart from the pause menu -------------------------------- */

    await page.keyboard.press("Escape");
    await delay(700);

    const paused = await waitForStatus(page, (status) => status.flow === "paused", {
      timeout: 5_000,
      interval: 25,
      label: "the paused flow",
    });
    const pauseSnapshot = await snapshotPage(page);

    failureModes.pause = {
      flow: paused.flow,
      screen: pauseSnapshot.dom.screenCount,
      pointerLock: pauseSnapshot.dom.pointerLock,
    };

    // A real browser releases pointer lock on Escape. Playwright's synthetic
    // Escape pauses the game but does not go through the browser's lock-exit
    // path, so the lock state is recorded rather than asserted.
    checklist.check(
      "pause: Escape pauses the session and shows the pause screen",
      paused.flow === "paused" && pauseSnapshot.dom.screenCount > 0,
      `flow=${paused.flow}, screens=${pauseSnapshot.dom.screenCount}, ` +
        `lock=${pauseSnapshot.dom.pointerLock}`,
    );

    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.gl-ui [role="button"]')].find((candidate) =>
        (candidate.textContent ?? "").trim().toLowerCase().includes("restart"),
      );

      button?.click();
    });

    const restarted = await waitForStatus(
      page,
      (status) =>
        status.flow === "gameplay" &&
        status.sessionStatus === "running" &&
        (status.player?.position.z ?? 0) > 12.5 &&
        status.screen === null,
      { timeout: 30_000, interval: 25, label: "the session restarted from the pause menu" },
    );

    await delay(800);

    const restartedPose = await capture("47-restart-from-pause");
    const restartedSnapshot = await snapshotPage(page);

    failureModes.restartFromPause = {
      flow: restarted.flow,
      checkpoint: restartedSnapshot.status?.activeCheckpointId ?? null,
      activated: restartedSnapshot.status?.activatedCheckpointIds ?? [],
      pointerLock: restartedSnapshot.dom.pointerLock,
      pose: restartedPose,
    };

    checklist.check(
      "restart: the pause-menu Restart returns to a clean First Section session",
      restarted.flow === "gameplay" &&
        restarted.sessionStatus === "running" &&
        (restartedSnapshot.status?.activeCheckpointId ?? null) === null &&
        (restartedSnapshot.status?.activatedCheckpointIds ?? []).length === 0,
      `checkpoint=${restartedSnapshot.status?.activeCheckpointId ?? "none"}`,
    );

    // Re-acquire the mouse after the browser released it, then prove both
    // keyboard and mouse look work in the new generation.
    const lockAfterRestart = restartedSnapshot.dom.pointerLock;
    const lockedAgain = await acquirePointerLock(page, viewport);
    const yawBeforeClick = (await readStatus(page))?.camera?.yaw ?? 0;

    await mouse.moveBy(140, 0);
    await delay(200);

    const yawAfterClick = (await readStatus(page))?.camera?.yaw ?? 0;
    const zBeforeMove = (await readStatus(page))?.player?.position.z ?? 0;

    await hold(page, "KeyW");
    await delay(450);
    await release(page, "KeyW");
    await delay(300);

    const movedAfterRestart = await readStatus(page);

    failureModes.restartFromPause.pointerLockAfterRestart = lockAfterRestart;
    failureModes.restartFromPause.pointerLockReacquired = lockedAgain;
    failureModes.restartFromPause.yawDelta = round(yawAfterClick - yawBeforeClick, 3);

    checklist.check(
      "restart: mouse look and movement work after re-acquiring pointer lock",
      Math.abs(yawAfterClick - yawBeforeClick) > 0.1 &&
        (movedAfterRestart?.player?.position.z ?? 0) < zBeforeMove - 0.5,
      `yawΔ=${round(yawAfterClick - yawBeforeClick, 3)}, ` +
        `z ${round(zBeforeMove, 2)} → ${round(movedAfterRestart?.player?.position.z ?? 0, 2)}`,
    );

    await releaseAll(page);

    const diagnosticsSnapshot = diagnostics.snapshot();

    report.scenarios.failureModes = failureModes;
    report.scenarios.failureModes.console = diagnosticsSnapshot;

    checklist.check(
      "runtime: failure-mode probing produced no console or page errors",
      diagnosticsSnapshot.consoleErrors.length === 0 &&
        diagnosticsSnapshot.pageErrors.length === 0 &&
        diagnosticsSnapshot.failedRequests.length === 0,
      JSON.stringify({
        consoleErrors: diagnosticsSnapshot.consoleErrors.slice(0, 3),
        pageErrors: diagnosticsSnapshot.pageErrors.slice(0, 3),
      }),
    );
  } finally {
    await closeSession(session);
  }

  return failureModes;
}

/**
 * Step 3.8 polish checks (F-05 toast priority, F-03 duct camera clearance).
 *
 * A fresh context is required for F-05: the tutorial `Move` step must still be
 * pending so the checkpoint confirmation collides with it, exactly as on a new
 * profile. The session then reuses the same run for the duct camera checks so
 * the evidence comes from one continuous First Section session.
 */
async function runPolishChecks(browser, options, viewport, outDir, report, checklist, log) {
  const session = await bootSession(browser, options, viewport, log);
  const { page, diagnostics, mouse } = session;
  const poses = report.poses;

  const capture = async (name) => {
    const entry = await capturePose(page, outDir, name, log);

    poses.push(entry);

    return entry;
  };

  const polish = {
    toastOrder: null,
    ductCamera: null,
  };

  report.scenarios.polish = polish;

  try {
    /* ---- F-05: checkpoint feedback must beat the tutorial toast ---------- */

    await aimYaw(page, mouse, 0);

    const toastSamples = [];
    const startedAt = Date.now();
    let activationMs = null;

    await hold(page, "KeyW");

    try {
      while (Date.now() - startedAt < 25_000) {
        const state = await readToastState(page);
        const sample = { ms: Date.now() - startedAt, ...state };

        toastSamples.push(sample);

        if (activationMs === null && state.checkpoint !== null) {
          activationMs = sample.ms;
        }

        if (activationMs !== null) {
          break;
        }

        await delay(35);
      }
    } finally {
      await release(page, "KeyW");
    }

    // Photograph the checkpoint toast while it is on screen (the capture takes
    // a few hundred ms, well inside the toast duration), then let the whole
    // sequence play out without any further input.
    await delay(150);
    const checkpointToastPose = await capture("55-checkpoint-toast-priority");
    const settleUntil = Date.now() + 7_000;

    while (Date.now() < settleUntil) {
      toastSamples.push({ ms: Date.now() - startedAt, ...(await readToastState(page)) });
      await delay(70);
    }

    const afterActivation = toastSamples.filter(
      (sample) => activationMs !== null && sample.ms >= activationMs - 50,
    );
    const visibleAfterActivation = afterActivation.filter((sample) => sample.visible === true);
    const firstVisible = visibleAfterActivation[0] ?? null;
    const checkpointToastSamples = visibleAfterActivation.filter((sample) =>
      (sample.text ?? "").includes("Checkpoint"),
    );
    const firstCheckpoint = checkpointToastSamples[0] ?? null;
    const firstCheckpointMs = firstCheckpoint?.ms ?? null;
    // No other toast may become visible between activation and the checkpoint
    // confirmation: that is exactly the "Move queued first" defect.
    const betweenActivationAndCheckpoint = toastSamples
      .filter(
        (sample) =>
          activationMs !== null &&
          firstCheckpointMs !== null &&
          sample.ms >= activationMs &&
          sample.ms < firstCheckpointMs &&
          sample.visible === true,
      )
      .map((sample) => sample.text ?? "");
    const checkpointIntactSamples = toastSamples.filter(
      (sample) =>
        firstCheckpointMs !== null &&
        sample.visible === true &&
        sample.ms >= firstCheckpointMs &&
        sample.ms <= firstCheckpointMs + 1_500,
    );
    const checkpointUninterrupted =
      checkpointIntactSamples.length >= 5 &&
      checkpointIntactSamples.every((sample) => (sample.text ?? "").includes("Checkpoint"));
    const checkpointVisibleFor =
      checkpointToastSamples.length === 0
        ? 0
        : (checkpointToastSamples[checkpointToastSamples.length - 1].ms -
            checkpointToastSamples[0].ms) /
          1000;
    const tutorialAfterCheckpoint = visibleAfterActivation.filter(
      (sample, index) =>
        index > 0 &&
        (sample.text ?? "").trim().length > 0 &&
        !(sample.text ?? "").includes("Checkpoint") &&
        firstCheckpoint !== null &&
        sample.ms > firstCheckpoint.ms,
    );
    const firstTutorialAfter = tutorialAfterCheckpoint[0] ?? null;
    const finalSample = toastSamples[toastSamples.length - 1] ?? null;
    const emptyVisible = toastSamples.some(
      (sample) => sample.visible === true && (sample.text ?? "").trim().length === 0,
    );

    polish.toastOrder = {
      activationMs,
      firstVisibleToast: firstVisible?.text ?? null,
      checkpointToastMs: firstCheckpointMs,
      checkpointDelayMs:
        activationMs === null || firstCheckpointMs === null
          ? null
          : firstCheckpointMs - activationMs,
      checkpointVisibleSeconds: round(checkpointVisibleFor, 2),
      betweenActivationAndCheckpoint,
      checkpointUninterrupted,
      tutorialAfterCheckpoint: firstTutorialAfter?.text ?? null,
      tutorialAfterCheckpointMs: firstTutorialAfter?.ms ?? null,
      finalVisible: finalSample?.visible ?? null,
      emptyVisible,
      samples: toastSamples,
    };

    const checkpointDelay = polish.toastOrder.checkpointDelayMs;

    polish.toastOrder.pose = checkpointToastPose;

    checklist.check(
      "toast: the checkpoint confirmation is visible immediately after activation (not queued behind the tutorial toast)",
      activationMs !== null &&
        checkpointDelay !== null &&
        checkpointDelay <= 250 &&
        checkpointUninterrupted &&
        betweenActivationAndCheckpoint.every(
          (text) => text.length === 0 || text.includes("Checkpoint") || text === firstVisible?.text,
        ),
      `activation=${activationMs} ms, checkpointDelay=${checkpointDelay} ms, ` +
        `firstVisible=${JSON.stringify(firstVisible?.text ?? null)}, ` +
        `between=${JSON.stringify(betweenActivationAndCheckpoint)}, ` +
        `uninterrupted=${String(checkpointUninterrupted)}`,
    );
    checklist.check(
      "toast: the interrupted tutorial toast is not lost — it plays after the checkpoint toast",
      firstTutorialAfter !== null &&
        firstCheckpointMs !== null &&
        (firstTutorialAfter?.ms ?? 0) > firstCheckpointMs &&
        (firstTutorialAfter?.text ?? "").length > 0,
      JSON.stringify({
        checkpointMs: firstCheckpointMs,
        tutorial: firstTutorialAfter?.text ?? null,
        tutorialMs: firstTutorialAfter?.ms ?? null,
      }),
    );
    checklist.check(
      "toast: the checkpoint confirmation stays readable and nothing is left stuck",
      checkpointVisibleFor >= 1.5 && finalSample?.visible === false && emptyVisible === false,
      `visible=${round(checkpointVisibleFor, 2)} s, finalVisible=${String(finalSample?.visible)}, ` +
        `emptyVisible=${String(emptyVisible)}`,
    );

    /* ---- F-03: duct camera clearance ------------------------------------ */

    const DUCT_CEILING_BOTTOM = 1.9;
    const DUCT_FLOOR_TOP = 0.9;

    // 1. Crouch at the lip. Capture while crouching is still held: the Step 3.6
    //    frame was taken after releasing Shift, i.e. mid stand-up.
    await traverseToDuctRunway(page, mouse, log);
    await stepToZ(page, mouse, -46.2, { tolerance: 0.2 });
    await aimYaw(page, mouse, 0);
    await hold(page, "ShiftLeft");
    await hold(page, "KeyW");
    await delay(1_400);

    const crouchStatus = await readStatus(page);
    const crouchCameraY = round(crouchStatus?.camera?.position?.y ?? Number.NaN, 3);
    const crouchPose = await capture("56-duct-crouch-lip");

    await release(page, "KeyW");
    await release(page, "ShiftLeft");
    await delay(400);

    const crouchClearance = round(DUCT_CEILING_BOTTOM - crouchCameraY, 3);

    polish.ductCamera = {
      crouch: {
        stance: crouchStatus?.player?.stance ?? null,
        postureHeight: round(crouchStatus?.player?.postureHeight ?? 0, 2),
        z: round(crouchStatus?.player?.position.z ?? 0, 2),
        cameraY: crouchCameraY,
        clearance: crouchClearance,
        pose: crouchPose,
      },
      slide: null,
      stopInside: null,
    };

    // The crouched eye is above the authored lintel plane by design (crouch eye
    // 1.05 m > 1.00 m slot). The camera is still in open air in front of the
    // slab (z > -47), so this is a documented measurement, not a camera inside
    // solid geometry. See the Step 3.8 report.
    checklist.check(
      "duct camera: the crouched lip view is settled, outside the ceiling slab, and documents the 0.07 m lintel overlap",
      crouchStatus?.player?.stance === "crouching" &&
        crouchCameraY > DUCT_FLOOR_TOP + 1.0 &&
        crouchCameraY < DUCT_FLOOR_TOP + 1.12 &&
        (crouchStatus?.player?.position.z ?? 0) > -47.0 &&
        Math.abs(crouchClearance + 0.07) < 0.04,
      `stance=${crouchStatus?.player?.stance}, z=${round(crouchStatus?.player?.position.z ?? 0, 2)}, ` +
        `cameraY=${crouchCameraY}, clearance=${crouchClearance}`,
    );

    // 2. Sprint-slide in, then release inside the duct so the slide ends there.
    await backUpTo(page, -43.5);
    await aimYaw(page, mouse, 0);
    await hold(page, "KeyX");
    await hold(page, "KeyW");

    const slideSamples = [];

    try {
      await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= -44.6, {
        timeout: 20_000,
        interval: 16,
        label: "the duct slide run-up",
      });
      await hold(page, "ShiftLeft");

      const slideDeadline = Date.now() + 20_000;

      while (Date.now() < slideDeadline) {
        const status = await readStatus(page);
        const z = status?.player?.position.z ?? 0;

        slideSamples.push({
          z: round(z, 3),
          y: round(status?.player?.position.y ?? 0, 3),
          stance: status?.player?.stance ?? null,
          posture: round(status?.player?.postureHeight ?? 0, 2),
          speed: round(status?.player?.speed ?? 0, 2),
          cameraY: round(status?.camera?.position?.y ?? Number.NaN, 3),
        });

        if (z <= -49.0) {
          break;
        }

        await delay(16);
      }
    } finally {
      await release(page, "KeyW");
      await release(page, "KeyX");
      await release(page, "ShiftLeft");
    }

    const slideInsidePose = await capture("57-duct-slide-inside");

    // Let the ended slide settle; the body cannot stand, so the collider stays
    // at slide height and the camera must remain below the ceiling.
    await delay(2_500);

    const stoppedStatus = await readStatus(page);
    const stoppedCameraY = round(stoppedStatus?.camera?.position?.y ?? Number.NaN, 3);
    const stoppedPose = await capture("58-duct-stopped-inside");

    const movingInside = slideSamples.filter(
      (sample) => sample.z < -47.05 && sample.z > -53.95 && sample.stance === "sliding",
    );
    const maxMovingCameraY =
      movingInside.length === 0 ? null : Math.max(...movingInside.map((sample) => sample.cameraY));

    polish.ductCamera.slide = {
      samples: movingInside,
      maxCameraY: maxMovingCameraY,
      clearance:
        maxMovingCameraY === null ? null : round(DUCT_CEILING_BOTTOM - maxMovingCameraY, 3),
      pose: slideInsidePose,
    };
    polish.ductCamera.stopInside = {
      z: round(stoppedStatus?.player?.position.z ?? 0, 2),
      stance: stoppedStatus?.player?.stance ?? null,
      postureHeight: round(stoppedStatus?.player?.postureHeight ?? 0, 2),
      cameraY: stoppedCameraY,
      clearance: round(DUCT_CEILING_BOTTOM - stoppedCameraY, 3),
      pose: stoppedPose,
    };

    checklist.check(
      "duct camera: a sprint-slide keeps the eye below the ceiling for the whole crossing",
      movingInside.length >= 3 &&
        maxMovingCameraY !== null &&
        maxMovingCameraY < DUCT_CEILING_BOTTOM - 0.2,
      `samples=${movingInside.length}, maxCameraY=${maxMovingCameraY}, ` +
        `clearance=${polish.ductCamera.slide.clearance}`,
    );
    checklist.check(
      "duct camera: a slide that ends inside the duct keeps the camera below the ceiling (no camera inside the slab)",
      stoppedStatus?.player?.stance === "crouching" &&
        Math.abs((stoppedStatus?.player?.postureHeight ?? 0) - 0.9) < 0.03 &&
        (stoppedStatus?.player?.position.z ?? 0) < -47.05 &&
        (stoppedStatus?.player?.position.z ?? 0) > -53.95 &&
        stoppedCameraY < DUCT_CEILING_BOTTOM - 0.05,
      `stance=${stoppedStatus?.player?.stance}, posture=${round(stoppedStatus?.player?.postureHeight ?? 0, 2)}, ` +
        `z=${round(stoppedStatus?.player?.position.z ?? 0, 2)}, cameraY=${stoppedCameraY}, ` +
        `clearance=${polish.ductCamera.stopInside.clearance}`,
    );

    // 3. Crouch-walk out of the duct so the session ends in a valid state.
    await hold(page, "KeyW");

    try {
      await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= -54.6, {
        timeout: 25_000,
        interval: 32,
        label: "the duct exit after the stop probe",
      });
    } finally {
      await release(page, "KeyW");
    }

    const exitPose = await capture("59-duct-exit-after-stop");

    polish.ductCamera.exit = {
      z: round((await readStatus(page))?.player?.position.z ?? 0, 2),
      pose: exitPose,
    };

    checklist.check(
      "duct camera: crouch-walking out of the duct still works after the slide-ended stop",
      (polish.ductCamera.exit.z ?? 0) <= -54.6,
      `exit z=${polish.ductCamera.exit.z}`,
    );

    const diagnosticsSnapshot = diagnostics.snapshot();

    polish.diagnostics = diagnosticsSnapshot;

    checklist.check(
      "runtime: the Step 3.8 polish scenario produced no console or page errors",
      diagnosticsSnapshot.consoleErrors.length === 0 &&
        diagnosticsSnapshot.pageErrors.length === 0 &&
        diagnosticsSnapshot.failedRequests.length === 0,
      JSON.stringify({
        consoleErrors: diagnosticsSnapshot.consoleErrors.slice(0, 3),
        pageErrors: diagnosticsSnapshot.pageErrors.slice(0, 3),
      }),
    );
  } finally {
    await closeSession(session);
  }

  return polish;
}

/**
 * Runs the vault channel with normal sprint input, pressing E at each obstacle.
 * Bounded by a deadline and by a legal back-up retry (never a teleport), so a
 * missed detection cannot hang the harness or fake a vault.
 */
async function runVaultSequence(page, mouse, centers, onVaulting = null) {
  const results = [];
  let index = 0;
  let lastPressAt = 0;
  let stuckSince = 0;
  let stuckRecoveries = 0;
  let sawVaulting = false;
  let capturedVault = false;

  await aimYaw(page, mouse, 0);
  await hold(page, "KeyX");
  await hold(page, "KeyW");

  const deadline = Date.now() + 20_000;

  try {
    while (Date.now() < deadline && index < centers.length) {
      const status = await readStatus(page);

      if (status === null) {
        throw new Error("dev launch status disappeared during the vault run");
      }

      const player = status.player;

      if (!player) {
        await delay(16);
        continue;
      }

      const center = centers[index];
      const z = player.position.z;
      const now = Date.now();

      if (player.state === "VAULTING") {
        sawVaulting = true;

        if (!capturedVault && onVaulting !== null) {
          capturedVault = true;
          await onVaulting();
        }
      }

      if (z <= center - 0.7) {
        results.push({
          centerZ: center,
          passed: true,
          state: player.state,
          speed: round(player.speed, 2),
        });
        index += 1;
        lastPressAt = 0;
        stuckSince = 0;
        continue;
      }

      if (player.grounded && z <= center + 3.0 && z >= center - 0.5) {
        if (player.state !== "VAULTING" && now - lastPressAt > 220) {
          await tap(page, "KeyE", 45);
          lastPressAt = now;
        }

        if (Math.abs(player.speed) < 0.8) {
          stuckSince = stuckSince === 0 ? now : stuckSince;
        } else {
          stuckSince = 0;
        }

        if (stuckSince > 0 && now - stuckSince > 500) {
          await release(page, "KeyX");
          await release(page, "KeyW");
          await hold(page, "KeyS");
          await delay(220);
          await release(page, "KeyS");
          await hold(page, "KeyW");
          await hold(page, "KeyX");
          lastPressAt = 0;
          stuckSince = 0;
          stuckRecoveries += 1;
        }
      }

      await delay(10);
    }
  } finally {
    await release(page, "KeyW");
    await release(page, "KeyX");
    await delay(400);
  }

  return { results, sawVaulting, stuckRecoveries };
}

/**
 * Charges an obstacle with normal movement input and no E press, recording the
 * collision response: the closest approach, the height reached, and whether the
 * player ended up on the far side. Used to check that the authored obstacles
 * still require the intended action (the character controller also handles small
 * steps, so a low obstacle may be climbed instead of blocking).
 */
async function chargeObstacle(page, mouse, { centerZ, sprint, durationMs = 1_600 }) {
  await aimYaw(page, mouse, 0);

  const start = await readStatus(page);
  const samples = [];
  const promptSamples = [];

  await hold(page, "KeyW");

  if (sprint) {
    await hold(page, "KeyX");
  }

  const deadline = Date.now() + durationMs;

  try {
    while (Date.now() < deadline) {
      const snapshot = await snapshotPage(page);
      const status = snapshot.status;
      const player = status?.player;

      samples.push({
        z: player === undefined || player === null ? null : round(player.position.z, 2),
        y: player === undefined || player === null ? null : round(player.position.y, 2),
        speed: player === undefined || player === null ? null : round(player.speed, 2),
        state: player?.state ?? null,
        grounded: player?.grounded ?? null,
        prompt: snapshot.dom.prompt,
        promptVisible: snapshot.dom.promptVisible,
        promptCount: snapshot.dom.promptCount,
      });

      if (snapshot.dom.promptVisible) {
        promptSamples.push(snapshot.dom);
      }

      await delay(40);
    }
  } finally {
    await release(page, "KeyW");
    await release(page, "KeyX");
    await delay(400);
  }

  const zs = samples.map((sample) => sample.z).filter((value) => value !== null);
  const ys = samples.map((sample) => sample.y).filter((value) => value !== null);
  const closestZ = zs.length === 0 ? 0 : Math.min(...zs);
  const maxY = ys.length === 0 ? 0 : Math.max(...ys);
  const last = samples[samples.length - 1];
  const firstPrompt = samples.find((sample) => sample.promptVisible === true) ?? null;
  const promptLeadMeters =
    firstPrompt?.z === null || firstPrompt?.z === undefined
      ? null
      : round(firstPrompt.z - closestZ, 2);

  return {
    startZ: round(start?.player?.position.z ?? 0, 2),
    startX: round(start?.player?.position.x ?? 0, 2),
    startY: round(start?.player?.position.y ?? 0, 2),
    sprint,
    closestZ: round(closestZ, 2),
    maxY: round(maxY, 2),
    finalZ: round(zs[zs.length - 1] ?? 0, 2),
    finalGrounded: last?.grounded ?? null,
    finalState: last?.state ?? null,
    states: [...new Set(samples.map((sample) => sample.state).filter(Boolean))],
    promptSeen: promptSamples.length > 0,
    promptText: promptSamples[promptSamples.length - 1]?.prompt ?? null,
    promptCountMax: Math.max(0, ...samples.map((sample) => sample.promptCount ?? 0)),
    promptLeadMeters,
    promptEntrySpeed: firstPrompt?.speed ?? null,
    crossed: closestZ <= centerZ - 0.7,
    samples,
  };
}

/**
 * Walks (without sprint) into an obstacle and vaults it with E.
 *
 * E is pressed repeatedly while the obstacle is in range (a single press at the
 * edge of detection range expires before reach), and a blocked attempt backs up
 * for a legal retry instead of reporting a false failure.
 */
async function vaultAtWalkSpeed(page, mouse, { centerZ, approachZ }) {
  await driveTo(page, mouse, approachZ, { sprint: false });

  const startZ = (await readStatus(page))?.player?.position.z ?? approachZ;
  let firstPress = null;
  let lastPressAt = 0;
  let stuckSince = 0;
  let retries = 0;
  let sawVaulting = false;

  await hold(page, "KeyW");

  const deadline = Date.now() + 15_000;

  try {
    while (Date.now() < deadline) {
      const status = await readStatus(page);

      if (status === null) {
        break;
      }

      const player = status.player;

      if (!player) {
        await delay(16);
        continue;
      }

      const now = Date.now();
      const z = player.position.z;

      if (player.state === "VAULTING") {
        sawVaulting = true;
      }

      if (z <= centerZ - 0.7) {
        return {
          startZ: round(startZ, 2),
          firstPress,
          sawVaulting,
          vaulted: sawVaulting,
          retries,
          endZ: round(z, 2),
        };
      }

      if (player.grounded && z <= centerZ + 2.6 && z >= centerZ - 0.5) {
        if (player.state !== "VAULTING" && now - lastPressAt > 200) {
          await tap(page, "KeyE", 45);
          firstPress ??= { z: round(z, 2), speed: round(player.speed, 2) };
          lastPressAt = now;
        }

        if (Math.abs(player.speed) < 0.8) {
          stuckSince = stuckSince === 0 ? now : stuckSince;
        } else {
          stuckSince = 0;
        }

        if (stuckSince > 0 && now - stuckSince > 600) {
          await release(page, "KeyW");
          await hold(page, "KeyS");
          await delay(260);
          await release(page, "KeyS");
          await hold(page, "KeyW");
          lastPressAt = 0;
          stuckSince = 0;
          retries += 1;
        }
      }

      await delay(10);
    }
  } finally {
    await release(page, "KeyW");
  }

  const endZ = (await readStatus(page))?.player?.position.z ?? startZ;

  return {
    startZ: round(startZ, 2),
    firstPress,
    sawVaulting,
    vaulted: sawVaulting && endZ <= centerZ - 0.7,
    retries,
    endZ: round(endZ, 2),
  };
}

/** Sprint traversal from the start roof to the vault channel, no captures. */
/**
 * Runs the route with normal input and the authored jumps, stopping on the
 * slide-duct runway. Same jump points as {@link traverseToVaults} but no duct
 * slide, because the Step 3.8 camera checks control the slide themselves.
 */
async function traverseToDuctRunway(page, mouse, log) {
  await aimYaw(page, mouse, 0);
  await hold(page, "KeyX");
  await hold(page, "KeyW");

  let jumpedA = false;
  let jumpedB = false;
  let jumpedStep = false;

  const deadline = Date.now() + 45_000;

  try {
    while (Date.now() < deadline) {
      const status = await readStatus(page);
      const player = status?.player;

      if (!player) {
        await delay(16);
        continue;
      }

      if (player.position.z <= -43.2) {
        break;
      }

      if (!jumpedA && player.grounded && player.position.z <= ROUTE.gapATakeoffZ) {
        await tap(page, "Space", 320);
        jumpedA = true;
      } else if (
        !jumpedB &&
        jumpedA &&
        player.grounded &&
        player.position.z <= ROUTE.gapBTakeoffZ
      ) {
        await tap(page, "Space", 320);
        jumpedB = true;
      } else if (
        !jumpedStep &&
        jumpedB &&
        player.grounded &&
        player.position.z <= ROUTE.stepTakeoffZ
      ) {
        await tap(page, "Space", 320);
        jumpedStep = true;
      }

      await delay(10);
    }
  } finally {
    await release(page, "KeyW");
    await release(page, "KeyX");
  }

  await delay(600);
  log("traversed to the duct runway");
}

async function traverseToVaults(page, mouse, log) {
  await aimYaw(page, mouse, 0);
  await hold(page, "KeyX");
  await hold(page, "KeyW");

  let jumpedA = false;
  let jumpedB = false;
  let jumpedStep = false;
  let sliding = false;

  const deadline = Date.now() + 45_000;

  try {
    while (Date.now() < deadline) {
      const status = await readStatus(page);
      const player = status?.player;

      if (!player) {
        await delay(16);
        continue;
      }

      const z = player.position.z;

      if (z <= -56.0) {
        break;
      }

      if (!jumpedA && player.grounded && z <= ROUTE.gapATakeoffZ) {
        await tap(page, "Space", 320);
        jumpedA = true;
      } else if (!jumpedB && jumpedA && player.grounded && z <= ROUTE.gapBTakeoffZ) {
        await tap(page, "Space", 320);
        jumpedB = true;
      } else if (!jumpedStep && jumpedB && player.grounded && z <= ROUTE.stepTakeoffZ) {
        await tap(page, "Space", 320);
        jumpedStep = true;
      }

      if (!sliding && z <= ROUTE.ductEntryZ) {
        await hold(page, "ShiftLeft");
        sliding = true;
      }

      if (sliding && z <= ROUTE.ductExitZ) {
        await release(page, "ShiftLeft");
        sliding = false;
      }

      await delay(10);
    }
  } finally {
    await release(page, "ShiftLeft");
    await release(page, "KeyW");
    await release(page, "KeyX");
  }

  await delay(600);
  log("traversed to the vault channel");
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
  const baseUrl = `${new URL(options.url).origin}/`;
  const checklist = createChecklist(log);
  const report = {
    tool: "tools/capture/playtest.mjs",
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
    poses: [],
    scenarios: {},
    passed: false,
    error: null,
  };

  // Step 3.7 Scope C: prove the symmetric lateral predicate catches deviations
  // on both sides before any route measurement is trusted.
  report.harnessSelfChecks = {
    lateralTolerance: lateralToleranceSelfCheck(1.0),
  };

  checklist.check(
    "harness: lateral tolerance rejects deviations on both sides",
    report.harnessSelfChecks.lateralTolerance.passed,
    JSON.stringify(report.harnessSelfChecks.lateralTolerance.failures),
  );

  await mkdir(outDir, { recursive: true });

  // Remove this run's previous frames so a failed retry cannot leave stale
  // evidence next to the new report.
  for (const entry of await readdir(outDir, { withFileTypes: true })) {
    if (entry.isFile() && /^\d{2}-[\w-]+\.jpg$/.test(entry.name)) {
      await rm(join(outDir, entry.name), { force: true });
    }
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

    if (options.walkthrough) {
      log("session A — segment walkthrough");
      await runWalkthrough(browser, options, viewport, outDir, report, checklist, log);
    }

    if (options.failureModes) {
      log("session B — failure modes and control edge cases");
      await runFailureModes(browser, options, viewport, outDir, report, checklist, log);
    }

    if (options.polish) {
      log("session C — Step 3.8 toast priority and duct camera clearance");
      await runPolishChecks(browser, options, viewport, outDir, report, checklist, log);
    }

    report.passed = checklist.failed.length === 0;
  } catch (error) {
    report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

    log(`ERROR ${report.error}`);
  } finally {
    if (browser !== null) {
      await browser.close().catch(() => undefined);
    }

    await server.stop().catch(() => undefined);

    report.checks = checklist.checks;
    report.failedChecks = checklist.failed.map((entry) => entry.name);
    report.finishedAt = new Date().toISOString();

    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    log(
      report.passed
        ? `PASS — ${checklist.checks.length} checks, ${report.poses.length} frames, report: ${reportPath}`
        : `FAIL — ${checklist.failed.length}/${checklist.checks.length} checks failed, ` +
            `${report.poses.length} frames, report: ${reportPath}`,
    );

    if (report.error !== null) {
      log(`run error: ${report.error}`);
    }
  }

  return report.passed && report.error === null ? 0 : 1;
}

process.exitCode = await main();
