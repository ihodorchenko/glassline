#!/usr/bin/env node
/**
 * Step 3.9 — First Section UX acceptance session (DEV evidence tooling only).
 *
 * This is NOT production code and NOT a new automated gate. It exists so a
 * human-style acceptance pass can be performed in a REAL headed Edge window:
 *
 *   - fresh browser profile (empty IndexedDB / localStorage),
 *   - 1600x900, default settings, pointer lock acquired with a real click,
 *   - every movement is trusted Playwright keyboard/mouse input through the
 *     production InputManager: NO teleports, NO state edits, NO tuning changes,
 *   - the route is driven continuously and the harness STOPS at the UX moments
 *     under review (spawn, first frame, Move toast, CP1, backlog, Gap A edge,
 *     Gap A jump, Gap B edge, Gap B jump, CP2, and the rest of the route) so a
 *     frame can be captured and judged visually,
 *   - one CDP screencast records the whole session (H.264 via system ffmpeg).
 *
 * DOM sampling is instrumentation for timing/duplication only. The acceptance
 * judgement in the report is made from the captured frames, not from asserts.
 *
 * Usage:
 *   node docs/evidence/first-section/step-3.9/harness/step-3.9-session.mjs
 *   PORT=5325 node .../step-3.9-session.mjs
 */

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 5325);
const URL = `http://127.0.0.1:${PORT}/?dev=first_section`;
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRAME_DIR = "/tmp/glassline-step39-frames";
const VIEWPORT = { width: 1600, height: 900 };
const START = Date.now();

const ROUTE = {
  spawnZ: 14,
  cp1Z: 10,
  gapATakeoffZ: -1.55,
  gapALandZ: -5.4,
  gapBTakeoffZ: -13.0,
  gapBLandZ: -17.6,
  cp2Z: -21.3,
  stepTakeoffZ: -23.5,
  stepLandZ: -25.2,
  galleryMidZ: -35,
  ductEntryZ: -45.4,
  ductExitZ: -54.4,
  vaultCenters: [-59.5, -63.5, -67.5],
  finishZ: -81,
};

const report = {
  tool: "docs/evidence/first-section/step-3.9/harness/step-3.9-session.mjs",
  generatedAt: new Date().toISOString(),
  launchUrl: URL,
  viewport: VIEWPORT,
  environment: "headed-edge",
  browser: null,
  host: {
    platform: process.platform,
    arch: process.arch,
    cpuCount: (await import("node:os")).cpus().length,
    loadAvg: (await import("node:os")).loadavg(),
  },
  checklist: [],
  marks: [],
  screenshots: [],
  phases: [],
  toast: { transitions: [], segments: [], emptyVisibleSamples: 0, duplicateToastNodes: 0 },
  overlaps: [],
  hitches: [],
  console: { errors: [], warnings: [] },
  pageErrors: [],
  failedRequests: [],
  video: null,
  raw: {},
};

const log = (message) => {
  const seconds = ((Date.now() - START) / 1000).toFixed(1);
  console.log(`[step-3.9 ${seconds}s] ${message}`);
};

const held = new Set();
const state = { pointerLockLostAtMs: null, lastToastAt: null };

async function hold(page, code) {
  if (!held.has(code)) {
    await page.keyboard.down(code);
    held.add(code);
  }
}

async function release(page, code) {
  if (held.has(code)) {
    await page.keyboard.up(code);
    held.delete(code);
  }
}

async function releaseAll(page) {
  for (const code of [...held]) {
    await release(page, code);
  }
}

async function tap(page, code, milliseconds = 60) {
  await page.keyboard.down(code);
  await delay(milliseconds);
  await page.keyboard.up(code);
}

/* -------------------------------------------------------------------------- */
/* Read-only state                                                            */
/* -------------------------------------------------------------------------- */

async function readStatus(page) {
  return await page.evaluate(() => window.__glasslineDevLaunch?.status?.() ?? null);
}

async function readDom(page) {
  return await page.evaluate(() => {
    const info = (selector) => {
      const node = document.querySelector(selector);

      if (!node) {
        return null;
      }

      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);

      return {
        text: (node.textContent ?? "").trim().slice(0, 200),
        visible:
          style.display !== "none" &&
          Number(style.opacity) > 0.01 &&
          rect.width > 0 &&
          rect.height > 0,
        display: style.display,
        opacity: Number(Number(style.opacity).toFixed(2)),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      };
    };

    return {
      hud: document.querySelector(".gl-hud")?.classList.contains("is-visible") ?? false,
      toast: info(".gl-toast"),
      toastCount: document.querySelectorAll(".gl-toast").length,
      tutorial: info(".gl-hud__tutorial"),
      timer: info(".gl-hud__panel--timer"),
      speed: info(".gl-hud__speed"),
      prompt: info(".gl-hud__prompt"),
      hint: info(".gl-hud__hint"),
      screenCount: document.querySelector(".gl-ui__screens")?.children.length ?? -1,
      screenTitle: (document.querySelector(".gl-screen__title")?.textContent ?? "").trim(),
      buttons: [...document.querySelectorAll('.gl-ui [role="button"]')].map((node) =>
        (node.textContent ?? "").trim(),
      ),
      pointerLock: document.pointerLockElement?.id ?? null,
      loading: document.querySelector(".gl-screen--loading") !== null,
      bootLoader: document.getElementById("boot-loader") !== null,
    };
  });
}

function slimStatus(status) {
  if (!status) {
    return null;
  }

  return {
    flow: status.flow,
    sessionStatus: status.sessionStatus,
    section: status.activeSectionId,
    player: status.player,
    camera: status.camera,
    activeCheckpointId: status.activeCheckpointId,
    activatedCheckpointIds: status.activatedCheckpointIds,
    respawnCount: status.respawnCount,
    screen: status.screen,
    pointerLocked: status.pointerLocked,
  };
}

async function mark(page, name, note) {
  const status = await readStatus(page);
  const dom = await readDom(page);
  const entry = {
    name,
    note: note ?? null,
    atMs: Date.now() - START,
    pageMs: await page.evaluate(() => Math.round(performance.now())),
    status: slimStatus(status),
    dom,
  };

  report.marks.push(entry);
  log(
    `mark ${name} z=${status?.player?.position?.z?.toFixed?.(2) ?? "?"} toast="${dom.toast?.text ?? ""}"`,
  );

  return entry;
}

async function shot(page, name, note) {
  await page.screenshot({
    path: join(OUT_DIR, `${name}.jpg`),
    type: "jpeg",
    quality: 86,
  });
  const status = await readStatus(page);
  const dom = await readDom(page);
  const atMs = Date.now() - START;

  report.screenshots.push({ name, note: note ?? null, atMs, status: slimStatus(status), dom });
  log(`shot ${name} (${note ?? ""})`);

  return { status, dom };
}

/* -------------------------------------------------------------------------- */
/* Instrumentation                                                            */
/* -------------------------------------------------------------------------- */

async function installSampler(page) {
  await page.evaluate(() => {
    const rectOf = (selector) => {
      const node = document.querySelector(selector);

      if (!node) {
        return null;
      }

      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);

      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        visible:
          style.display !== "none" &&
          Number(style.opacity) > 0.01 &&
          rect.width > 0 &&
          rect.height > 0,
        opacity: Number(Number(style.opacity).toFixed(2)),
        display: style.display,
        text: (node.textContent ?? "").trim().slice(0, 200),
      };
    };

    const sample = () => ({
      toast: rectOf(".gl-toast"),
      toastCount: document.querySelectorAll(".gl-toast").length,
      tutorial: rectOf(".gl-hud__tutorial"),
      timer: rectOf(".gl-hud__panel--timer"),
      speed: rectOf(".gl-hud__speed"),
      prompt: rectOf(".gl-hud__prompt"),
      hint: rectOf(".gl-hud__hint"),
      hud: document.querySelector(".gl-hud")?.classList.contains("is-visible") ?? false,
      screens: document.querySelector(".gl-ui__screens")?.children.length ?? -1,
      pointerLock: document.pointerLockElement?.id ?? null,
      paused: document.querySelector(".gl-screen__title")?.textContent === "Paused",
    });

    const recorder = {
      t0: performance.now(),
      transitions: [],
      emptyVisibleSamples: 0,
      duplicateToastNodes: 0,
      overlaps: [],
      hitches: [],
      sampleCount: 0,
    };
    window.__step39 = recorder;

    let lastKey = null;

    const tick = () => {
      const s = sample();

      recorder.sampleCount += 1;

      const key = [
        s.toast?.text,
        s.toast?.visible,
        s.tutorial?.visible,
        s.tutorial?.text,
        s.timer?.visible,
        s.prompt?.text,
        s.prompt?.visible,
        s.hud,
        s.screens,
        s.pointerLock,
        s.paused,
      ].join("|");

      if (key !== lastKey) {
        lastKey = key;
        recorder.transitions.push({ ms: Math.round(performance.now() - recorder.t0), ...s });
      }

      if (s.toast !== null && s.toast.visible && s.toast.text.length === 0) {
        recorder.emptyVisibleSamples += 1;
      }

      if (s.toastCount > 1) {
        recorder.duplicateToastNodes += 1;
      }

      const toast = s.toast;

      if (toast !== null && toast.visible) {
        for (const [name, other] of [
          ["speed", s.speed],
          ["prompt", s.prompt],
          ["hint", s.hint],
          ["timer", s.timer],
          ["tutorial", s.tutorial],
        ]) {
          if (
            other !== null &&
            other.visible &&
            !(
              toast.x + toast.w <= other.x ||
              other.x + other.w <= toast.x ||
              toast.y + toast.h <= other.y ||
              other.y + other.h <= toast.y
            )
          ) {
            recorder.overlaps.push({
              ms: Math.round(performance.now() - recorder.t0),
              with: name,
              toast: toast.text,
            });
          }
        }
      }
    };

    tick();
    setInterval(tick, 25);

    let lastFrame = performance.now();

    const loop = (ts) => {
      const gap = ts - lastFrame;

      lastFrame = ts;

      if (gap > 60 && recorder.hitches.length < 400) {
        recorder.hitches.push({ ms: Math.round(ts - recorder.t0), gap: Math.round(gap) });
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  });
}

async function readRecorder(page) {
  return await page.evaluate(() => {
    const r = window.__step39;

    if (!r) {
      return null;
    }

    return {
      t0: r.t0,
      sampleCount: r.sampleCount,
      transitions: r.transitions,
      emptyVisibleSamples: r.emptyVisibleSamples,
      duplicateToastNodes: r.duplicateToastNodes,
      overlaps: r.overlaps,
      hitches: r.hitches,
    };
  });
}

/**
 * Collapses the sampler's toast transitions into visible segments. A segment
 * ends when the message changes or the toast hides. Boundaries are within one
 * 25 ms sampling interval.
 */
function toastSegments(transitions) {
  const segments = [];
  let current = null;

  for (const entry of transitions) {
    const toast = entry.toast;
    const visible = toast !== null && toast.visible === true && toast.text.length > 0;
    const text = toast?.text ?? "";

    if (!visible) {
      if (current !== null) {
        segments.push({ ...current, endMs: entry.ms });
        current = null;
      }

      continue;
    }

    if (current === null) {
      current = { message: text, startMs: entry.ms };
      continue;
    }

    if (current.message !== text) {
      segments.push({ ...current, endMs: entry.ms });
      current = { message: text, startMs: entry.ms };
    }
  }

  if (current !== null) {
    const last = transitions[transitions.length - 1];
    segments.push({ ...current, endMs: last?.ms ?? current.startMs });
  }

  return segments;
}

/* -------------------------------------------------------------------------- */
/* Input / movement                                                           */
/* -------------------------------------------------------------------------- */

function createMouseController(page) {
  let x = Math.floor(VIEWPORT.width / 2);
  let y = Math.floor(VIEWPORT.height / 2);

  return {
    async moveBy(dx, dy) {
      x += dx;
      y += dy;
      await page.mouse.move(x, y);
    },
    async reset() {
      x = Math.floor(VIEWPORT.width / 2);
      y = Math.floor(VIEWPORT.height / 2);
      await page.mouse.move(x, y);
    },
    get position() {
      return { x, y };
    },
  };
}

async function aimYaw(page, mouse, target, tolerance = 0.02, maxIterations = 30) {
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const status = await readStatus(page);
    const current = status?.camera?.yaw ?? 0;
    const error = current - target;

    if (Math.abs(error) <= tolerance) {
      return true;
    }

    const dx = Math.round(-error / 0.0022);
    await mouse.moveBy(dx, 0);
    await delay(40);
  }

  return false;
}

async function aimPitch(page, mouse, target, tolerance = 0.02, maxIterations = 30) {
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const status = await readStatus(page);
    const current = status?.camera?.pitch ?? 0;
    const error = current - target;

    if (Math.abs(error) <= tolerance) {
      return true;
    }

    const dy = Math.round(-error / 0.0022);
    await mouse.moveBy(0, dy);
    await delay(40);
  }

  return false;
}

async function waitForStatus(page, predicate, { timeout = 12_000, interval = 16, label } = {}) {
  const deadline = Date.now() + timeout;
  let last = null;

  while (Date.now() < deadline) {
    last = await readStatus(page);

    if (last !== null && predicate(last)) {
      return last;
    }

    await delay(interval);
  }

  throw new Error(`Timed out waiting for ${label}; last=${JSON.stringify(slimStatus(last))}`);
}

async function waitHud(page, timeout = 20_000) {
  await waitForStatus(page, () => true, { timeout, interval: 100, label: "dev launch present" });
  await page.waitForFunction(
    () =>
      document.querySelector(".gl-hud")?.classList.contains("is-visible") === true &&
      window.__glasslineDevLaunch?.ready === true,
    null,
    { timeout },
  );
}

async function acquirePointerLock(page, label = "pointer lock") {
  if ((await page.evaluate(() => document.pointerLockElement?.id ?? null)) !== null) {
    return true;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await delay(250);

    if ((await page.evaluate(() => document.pointerLockElement?.id ?? null)) !== null) {
      log(`${label}: acquired`);
      return true;
    }
  }

  log(`${label}: NOT acquired`);
  return false;
}

/** Holds W (optionally X) until z passes the target. Normal input only. */
async function driveToZ(page, targetZ, { sprint = false, timeout = 25_000 } = {}) {
  await hold(page, "KeyW");

  if (sprint) {
    await hold(page, "KeyX");
  }

  try {
    await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= targetZ, {
      timeout,
      interval: 12,
      label: `z <= ${targetZ}`,
    });
  } finally {
    await release(page, "KeyW");
    await release(page, "KeyX");
  }

  await delay(sprint ? 650 : 400);
}

/** Backs up with S until z is >= target. */
async function backUpToZ(page, targetZ, timeout = 15_000) {
  await hold(page, "KeyS");

  try {
    await waitForStatus(page, (status) => (status.player?.position.z ?? 0) >= targetZ, {
      timeout,
      interval: 12,
      label: `z >= ${targetZ}`,
    });
  } finally {
    await release(page, "KeyS");
  }

  await delay(450);
}

/** Short closed-loop pulses to stop at an authored z (viewpoints). */
async function stepToZ(page, targetZ, { tolerance = 0.2, timeout = 20_000 } = {}) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const status = await readStatus(page);
    const z = status?.player?.position.z ?? 0;
    const error = z - targetZ;

    if (Math.abs(error) <= tolerance) {
      return status;
    }

    const forward = error > 0;
    const pulse = Math.min(260, Math.max(60, Math.abs(error) * 140));

    await hold(page, forward ? "KeyW" : "KeyS");
    await delay(pulse);
    await release(page, forward ? "KeyW" : "KeyS");
    await delay(240);
  }

  throw new Error(`could not step to z=${targetZ}`);
}

/**
 * Sprint jump over an authored gap/step. Holds W+X through the arc, presses
 * Space for 320 ms at the take-off plane, and waits for the landing.
 */
async function sprintJump(page, { takeoffZ, landZ, label, onAirborne = null }) {
  await hold(page, "KeyX");
  await hold(page, "KeyW");

  try {
    await waitForStatus(
      page,
      (status) => status.player?.grounded === true && (status.player?.position.z ?? 0) <= takeoffZ,
      { timeout: 12_000, interval: 10, label: `${label} take-off` },
    );

    const takeoff = await readStatus(page);

    await hold(page, "Space");
    await delay(170);

    if (onAirborne !== null) {
      await onAirborne(await readStatus(page));
    }

    await delay(150);
    await release(page, "Space");

    const landing = await waitForStatus(
      page,
      (status) => status.player?.grounded === true && (status.player?.position.z ?? 0) <= landZ,
      { timeout: 6_000, interval: 10, label: `${label} landing` },
    );

    await delay(250);

    return { takeoff, landing };
  } finally {
    await release(page, "KeyW");
    await release(page, "KeyX");
    await delay(300);
  }
}

/* -------------------------------------------------------------------------- */
/* Toast helpers                                                              */
/* -------------------------------------------------------------------------- */

async function waitToastText(page, expected, { timeout = 6_000, exact = true } = {}) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const sample = await page.evaluate(() => {
      const node = document.querySelector(".gl-toast");
      const style = node ? getComputedStyle(node) : null;

      return {
        text: (node?.textContent ?? "").trim(),
        visible: (style?.display ?? "none") !== "none" && Number(style?.opacity ?? 0) > 0.01,
      };
    });

    if (sample.visible && (exact ? sample.text === expected : sample.text.includes(expected))) {
      return sample.text;
    }

    await delay(15);
  }

  return null;
}

async function waitToastHidden(page, timeout = 6_000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const visible = await page.evaluate(() => {
      const node = document.querySelector(".gl-toast");
      const style = node ? getComputedStyle(node) : null;

      return (style?.display ?? "none") !== "none" && Number(style?.opacity ?? 0) > 0.01;
    });

    if (!visible) {
      return true;
    }

    await delay(15);
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* Video                                                                      */
/* -------------------------------------------------------------------------- */

async function startScreencast(context, page) {
  const cdp = await context.newCDPSession(page);
  await mkdir(FRAME_DIR, { recursive: true });

  const frames = [];
  let writeChain = Promise.resolve();
  let index = 0;

  cdp.on("Page.screencastFrame", (params) => {
    const number = index;
    index += 1;
    frames.push({
      file: `frame-${String(number + 1).padStart(5, "0")}.jpg`,
      timestamp: params.metadata?.timestamp ?? Date.now() / 1000,
    });
    writeChain = writeChain.then(() =>
      writeFile(
        join(FRAME_DIR, `frame-${String(number + 1).padStart(5, "0")}.jpg`),
        Buffer.from(params.data, "base64"),
      ),
    );
    cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => undefined);
  });

  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 68,
    maxWidth: 1280,
    maxHeight: 720,
    everyNthFrame: 1,
  });

  return {
    frames,
    async stop() {
      await cdp.send("Page.stopScreencast").catch(() => undefined);
      await cdp.detach().catch(() => undefined);
      await writeChain;

      return { frames, wallClockSeconds: (Date.now() - START) / 1000 };
    },
  };
}

async function encodeVideo(frames, outputPath) {
  if (frames.length < 2) {
    throw new Error(`screencast produced ${frames.length} frames`);
  }

  const rawDurations = frames.map((frame, i) => {
    const next = frames[i + 1];

    if (next === undefined) {
      return 1 / 30;
    }

    const raw = next.timestamp - frame.timestamp;

    return Number.isFinite(raw) && raw > 0 ? Math.min(2, Math.max(0.005, raw)) : 1 / 30;
  });

  const lines = ["ffconcat version 1.0"];

  for (let i = 0; i < frames.length; i += 1) {
    lines.push(
      `file '${frames[i].file}'`,
      `duration ${Math.max(0.001, rawDurations[i]).toFixed(4)}`,
    );
  }

  lines.push(`file '${frames[frames.length - 1].file}'`);
  await writeFile(join(FRAME_DIR, "frames.txt"), `${lines.join("\n")}\n`);

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
        join(FRAME_DIR, "frames.txt"),
        "-vf",
        "fps=30",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "25",
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
      stderr = `${stderr}${chunk.toString()}`.slice(-3000);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise(undefined);
      } else {
        reject(new Error(`ffmpeg exited ${code}:\n${stderr}`));
      }
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Phase runner                                                               */
/* -------------------------------------------------------------------------- */

async function phase(name, fn) {
  log(`--- phase ${name} ---`);
  const startedAt = Date.now();
  const entry = { name, startedAtMs: startedAt - START, status: "running", error: null };

  report.phases.push(entry);

  try {
    await fn();
    entry.status = "completed";
  } catch (error) {
    entry.status = "failed";
    entry.error = error?.stack ?? String(error);
    log(`phase ${name} FAILED: ${error?.message ?? error}`);
    await releaseAllSafe();
  }

  entry.durationMs = Date.now() - startedAt;
  log(`--- phase ${name} ${entry.status} in ${entry.durationMs} ms ---`);
}

let activePage = null;

async function releaseAllSafe() {
  if (activePage !== null) {
    await releaseAll(activePage).catch(() => undefined);
  }
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

const browser = await chromium.launch({ channel: "msedge", headless: false });
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
  locale: "en-US",
});

report.browser = {
  name: "Microsoft Edge",
  channel: "msedge",
  version: await browser.version(),
  engine: "Chromium (playwright)",
  window: "headed",
};

const page = await context.newPage();
activePage = page;

page.on("console", (message) => {
  if (message.type() === "error") {
    report.console.errors.push({ atMs: Date.now() - START, text: message.text() });
  } else if (message.type() === "warning") {
    report.console.warnings.push({ atMs: Date.now() - START, text: message.text() });
  }
});
page.on("pageerror", (error) => {
  report.pageErrors.push({ atMs: Date.now() - START, text: error?.stack ?? String(error) });
});
page.on("requestfailed", (request) => {
  report.failedRequests.push({
    atMs: Date.now() - START,
    url: request.url(),
    error: request.failure()?.errorText ?? "unknown",
  });
});

const mouse = createMouseController(page);
const screencast = await startScreencast(context, page);

await mkdir(OUT_DIR, { recursive: true });

/* A — boot and first gameplay frame ---------------------------------------- */

await phase("A-boot", async () => {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // Rapid boot frames: the loading screen, the first composited frame and the
  // HUD appearing are all part of "no visual jump at level start".
  for (let i = 0; i < 8; i += 1) {
    await delay(200);
    await page.screenshot({
      path: join(OUT_DIR, `A-00-boot-${String(i + 1).padStart(2, "0")}.jpg`),
      type: "jpeg",
      quality: 86,
    });
  }

  await waitHud(page, 30_000);
  await shot(page, "A-01-first-gameplay-frame", "first frame with the HUD visible");

  await delay(700);
  await installSampler(page);
  await shot(page, "A-02-settled", "settled spawn frame, no input yet");
  await mark(page, "A-spawn", "spawn state before any input");
});

/* B/D/E — pause/resume pointer lock, Move toast, CP1 ----------------------- */

await phase("B-pause-resume", async () => {
  const before = await readDom(page);
  const yawBefore = (await readStatus(page))?.camera?.yaw ?? 0;

  await page.keyboard.press("Escape");
  await delay(600);

  const pausedDom = await readDom(page);
  const pausedStatus = await readStatus(page);

  await shot(page, "E-01-pause-screen", "real Escape in a headed window");
  await mark(page, "E-pause", "after real Escape");

  report.raw.pause = {
    pointerLockBefore: before.pointerLock,
    pointerLockAfterEscape: pausedDom.pointerLock,
    flow: pausedStatus?.flow,
    screenTitle: pausedDom.screenTitle,
    buttons: pausedDom.buttons,
  };

  const resume = pausedDom.buttons.findIndex((label) => label.toLowerCase() === "resume");

  if (resume === -1) {
    throw new Error(`Resume button not found; buttons=${JSON.stringify(pausedDom.buttons)}`);
  }

  const buttonRect = await page.evaluate((wanted) => {
    const node = [...document.querySelectorAll('.gl-ui [role="button"]')].find(
      (candidate) => (candidate.textContent ?? "").trim().toLowerCase() === wanted,
    );

    if (!node) {
      return null;
    }

    const rect = node.getBoundingClientRect();

    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, "resume");

  await page.mouse.click(buttonRect.x, buttonRect.y);
  await delay(700);

  const resumedDom = await readDom(page);
  const yawAfterResume = (await readStatus(page))?.camera?.yaw ?? 0;

  await shot(page, "E-02-after-resume", "immediately after Resume, before clicking the canvas");

  // Try mouse look WITHOUT clicking the game first (the F-07 question).
  await mouse.moveBy(240, 0);
  await delay(350);
  const yawAfterMouse = (await readStatus(page))?.camera?.yaw ?? 0;

  report.raw.pause.afterResume = {
    pointerLock: resumedDom.pointerLock,
    hudVisible: resumedDom.hud,
    screenCount: resumedDom.screenCount,
    yawBefore,
    yawAfterResume,
    yawAfterMouse,
    mouseLookWorksWithoutClick: Math.abs(yawAfterMouse - yawAfterResume) > 0.02,
  };

  await shot(page, "E-03-resume-mouse-look", "after moving the mouse without clicking the game");
  await mark(page, "E-resume", "resume + mouse look probe");
});

await phase("B-move-toast", async () => {
  // Safety net: if the pause screen is still up (resume probe failed), press
  // Resume again so the rest of the session can proceed. The result of the
  // probe itself is already recorded in report.raw.pause.
  const flowBefore = (await readStatus(page))?.flow;

  if (flowBefore === "paused") {
    const rect = await page.evaluate(() => {
      const node = [...document.querySelectorAll('.gl-ui [role="button"]')].find(
        (candidate) => (candidate.textContent ?? "").trim().toLowerCase() === "resume",
      );
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });

    if (rect !== null) {
      await page.mouse.click(rect.x, rect.y);
      await delay(800);
    }
  }

  // Re-acquire pointer lock if Resume did not (recorded above, not hidden).
  const locked = await page.evaluate(() => document.pointerLockElement?.id ?? null);

  if (locked === null) {
    await acquirePointerLock(page, "after resume");
  }

  await aimYaw(page, mouse, 0);
  await aimPitch(page, mouse, 0);
  await delay(400);

  const t0 = await page.evaluate(() => Math.round(performance.now()));
  await hold(page, "KeyW");

  const moveText = await waitToastText(page, "Move", { timeout: 4_000 });
  const moveShownAt = await page.evaluate(() => Math.round(performance.now()));

  if (moveText !== null) {
    await shot(page, "B-01-move-toast-appears", "Move toast as it appears on first movement");
    await delay(500);
    await shot(page, "B-02-move-toast-reading", "Move toast mid-duration");
  }

  await mark(page, "B-move-toast", "first movement");

  report.raw.moveToast = { pressedAtPageMs: t0, shownAtPageMs: moveShownAt, text: moveText };

  // Walk straight into CP1 (cp_start at z=10) while the Move toast is up.
  await waitForStatus(page, (status) => status.activeCheckpointId === "cp_start", {
    timeout: 6_000,
    interval: 12,
    label: "CP1 activation",
  });

  const cp1At = await page.evaluate(() => Math.round(performance.now()));

  // A player slows down at the checkpoint; stop walking so the toast sequence is
  // observed standing still instead of running on toward Gap A.
  await delay(550);
  await release(page, "KeyW");

  await shot(page, "D-01-cp1-activation", "checkpoint activates while Move toast is visible");
  await delay(450);
  await shot(page, "D-02-cp1-toast", "checkpoint confirmation after preemption");
  await mark(page, "D-cp1", "CP1 activated");

  // The interrupted Move toast is restored after the checkpoint toast.
  const restored = await waitToastText(page, "Move", { timeout: 6_000 });
  const restoredAt = await page.evaluate(() => Math.round(performance.now()));

  if (restored !== null) {
    await shot(page, "D-03-move-restored", "Move toast restored after the checkpoint confirmation");
  }

  await waitToastHidden(page, 6_000);
  await delay(200);
  await shot(page, "D-04-toast-hidden", "toast slot empty after the whole sequence");

  report.raw.cp1Sequence = { cp1At, moveRestoredAt: restoredAt, restored };

  // Stop on the start roof after the checkpoint.
  await driveToZ(page, ROUTE.cp1Z - 2.5);
  await delay(400);
});

await phase("D-recross-cp1", async () => {
  // A player may walk back; the checkpoint trigger is repeatable in the level
  // content, and re-entering must not duplicate the confirmation.
  await aimYaw(page, mouse, 0);
  await backUpToZ(page, ROUTE.cp1Z + 3.2);
  await delay(200);
  await shot(page, "D-05-recross-before", "walking back through CP1");

  await driveToZ(page, ROUTE.cp1Z - 2.0);
  await delay(300);

  const status = await readStatus(page);
  const dom = await readDom(page);
  const cpToast = await page.evaluate(() => {
    const node = document.querySelector(".gl-toast");
    return (node?.textContent ?? "").trim();
  });

  await shot(page, "D-06-recross-after", "after re-entering the CP1 trigger volume");
  report.raw.recross = {
    activatedCheckpointIds: status?.activatedCheckpointIds,
    toast: cpToast,
    toastVisible: dom.toast?.visible,
  };

  report.checklist.push({
    name: "D — re-entering an activated checkpoint does not repeat the confirmation",
    passed: !String(cpToast).includes("Checkpoint reached"),
    details: JSON.stringify(report.raw.recross),
  });
});

/* C — Gap A ---------------------------------------------------------------- */

await phase("C-gap-a", async () => {
  await aimYaw(page, mouse, 0);
  await aimPitch(page, mouse, 0);

  await stepToZ(page, ROUTE.gapATakeoffZ + 0.65);
  await delay(450);
  await shot(page, "C-01-gap-a-edge", "standing at the Gap A edge, level view");

  await aimPitch(page, mouse, -0.6);
  await delay(300);
  await shot(page, "C-02-gap-a-look-down", "looking down at the Gap A edge");
  await aimPitch(page, mouse, 0);

  // Run-up from the start roof and a normal sprint jump.
  await backUpToZ(page, 4.0);
  await aimYaw(page, mouse, 0);

  const start = await readStatus(page);
  const result = await sprintJump(page, {
    takeoffZ: ROUTE.gapATakeoffZ,
    landZ: ROUTE.gapALandZ,
    label: "gap A",
    onAirborne: async (status) => {
      await shot(page, "C-03-gap-a-airborne", "mid-air over Gap A with the Jump toast due");
      report.raw.gapA = { airborne: slimStatus(status) };
    },
  });

  await shot(page, "C-04-gap-a-landing", "landed past Gap A");
  await delay(300);

  const after = await readStatus(page);

  report.raw.gapA = {
    ...report.raw.gapA,
    before: slimStatus(start),
    takeoff: slimStatus(result.takeoff),
    landing: slimStatus(result.landing),
    after: slimStatus(after),
    crossed:
      (after?.player?.position.z ?? 0) <= ROUTE.gapALandZ &&
      after?.respawnCount === start?.respawnCount,
  };

  await mark(page, "C-gap-a", "Gap A crossed");
});

/* C — Gap B and CP2 -------------------------------------------------------- */

await phase("C-gap-b", async () => {
  await aimYaw(page, mouse, 0);
  await stepToZ(page, ROUTE.gapBTakeoffZ + 1.4);
  await delay(400);
  await shot(page, "C-05-gap-b-edge", "standing at the Gap B edge");

  await aimPitch(page, mouse, -0.6);
  await delay(250);
  await shot(page, "C-06-gap-b-look-down", "looking down at the Gap B edge");
  await aimPitch(page, mouse, 0);

  await backUpToZ(page, -8.0);
  await aimYaw(page, mouse, 0);

  const start = await readStatus(page);
  const result = await sprintJump(page, {
    takeoffZ: ROUTE.gapBTakeoffZ,
    landZ: ROUTE.gapBLandZ,
    label: "gap B",
    onAirborne: async (status) => {
      await shot(page, "C-07-gap-b-airborne", "mid-air over Gap B");
      report.raw.gapB = { airborne: slimStatus(status) };
    },
  });

  await shot(page, "C-08-gap-b-landing", "landed past Gap B");

  const after = await readStatus(page);

  report.raw.gapB = {
    ...report.raw.gapB,
    before: slimStatus(start),
    takeoff: slimStatus(result.takeoff),
    landing: slimStatus(result.landing),
    crossed:
      (after?.player?.position.z ?? 0) <= ROUTE.gapBLandZ &&
      after?.respawnCount === start?.respawnCount,
  };

  // Walk on into CP2. The Jump toast may still be on screen — natural overlap.
  await hold(page, "KeyW");
  await waitForStatus(page, (status) => status.activeCheckpointId === "cp_building_jump", {
    timeout: 8_000,
    interval: 12,
    label: "CP2 activation",
  });
  await release(page, "KeyW");

  const cp2At = await page.evaluate(() => Math.round(performance.now()));
  await shot(page, "D-07-cp2-activation", "CP2 activates (natural sequence after Gap B)");
  await delay(500);
  await shot(page, "D-08-cp2-toast", "CP2 confirmation visible");
  await mark(page, "D-cp2", "CP2 activated");

  await waitToastHidden(page, 6_000);
  await delay(200);
  await shot(page, "D-09-cp2-toast-hidden", "toast slot empty after CP2");

  report.raw.cp2Sequence = {
    cp2At,
    activatedCheckpointIds: (await readStatus(page))?.activatedCheckpointIds,
  };
});

/* Rest of the route — visual stability across the whole section ------------- */

await phase("C-rest-of-route", async () => {
  await aimYaw(page, mouse, 0);

  // Plant step: enough run-up for a full sprint jump.
  await backUpToZ(page, -19.0);
  await aimYaw(page, mouse, 0);
  await sprintJump(page, {
    takeoffZ: ROUTE.stepTakeoffZ,
    landZ: ROUTE.stepLandZ,
    label: "plant step",
  });

  // Gallery.
  await driveToZ(page, ROUTE.galleryMidZ);
  await delay(300);
  await shot(page, "C-09-gallery", "gallery mid-point");

  // Slide duct: sprint to the lip, then hold Shift while at speed.
  await aimYaw(page, mouse, 0);
  await driveToZ(page, ROUTE.ductEntryZ + 2.2);

  await hold(page, "KeyW");
  await hold(page, "KeyX");
  await waitForStatus(
    page,
    (status) =>
      (status.player?.speed ?? 0) >= 6.5 &&
      (status.player?.position.z ?? 0) <= ROUTE.ductEntryZ + 1.6,
    { timeout: 4_000, interval: 10, label: "duct lip at sprint speed" },
  );

  await hold(page, "ShiftLeft");
  await waitForStatus(
    page,
    (status) => (status.player?.position.z ?? 0) <= ROUTE.ductEntryZ - 2.2,
    {
      timeout: 4_000,
      interval: 10,
      label: "inside the duct",
    },
  );
  await shot(page, "C-10-duct-slide", "inside the slide duct");

  // Keep W held through the exit: a slide that ends inside leaves the body in
  // the clamped crouch, and a player walks out of the duct.
  await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= ROUTE.ductExitZ + 0.6, {
    timeout: 10_000,
    interval: 12,
    label: "duct exit",
  });
  await release(page, "ShiftLeft");
  await release(page, "KeyX");
  await release(page, "KeyW");
  await delay(300);

  // Vault channel: walk-speed vaults, pressing E through the detection window
  // the same way a player would.
  await aimYaw(page, mouse, 0);
  await driveToZ(page, ROUTE.vaultCenters[0] + 3.6);
  await delay(300);
  await shot(page, "C-11-vault-prompt", "E · VAULT prompt before the first obstacle");

  for (let index = 0; index < ROUTE.vaultCenters.length; index += 1) {
    const centerZ = ROUTE.vaultCenters[index];

    await hold(page, "KeyW");

    const deadline = Date.now() + 12_000;
    let lastPressAt = 0;
    let sawVaulting = false;

    try {
      while (Date.now() < deadline) {
        const status = await readStatus(page);
        const player = status?.player;

        if (!player) {
          await delay(16);
          continue;
        }

        if (player.state === "VAULTING") {
          sawVaulting = true;
        }

        if (player.position.z <= centerZ - 0.7) {
          break;
        }

        if (
          player.grounded &&
          player.position.z <= centerZ + 2.6 &&
          player.position.z >= centerZ - 0.5 &&
          player.state !== "VAULTING" &&
          Date.now() - lastPressAt > 200
        ) {
          await tap(page, "KeyE", 45);
          lastPressAt = Date.now();
        }

        await delay(12);
      }
    } finally {
      await release(page, "KeyW");
    }

    await delay(350);
    log(`vault ${index + 1} cleared (vaulting seen: ${sawVaulting})`);

    if (index === 0) {
      await shot(page, "C-12-vault-after", "after the first vault");
    }
  }

  await delay(400);
  await shot(page, "C-13-vaults-cleared", "past the three obstacles");

  // Stairs and finish.
  await driveToZ(page, -80.0, { timeout: 30_000 });
  await delay(300);
  await shot(page, "E-04-finish-approach", "approach to the finish");

  await hold(page, "KeyW");
  await waitForStatus(page, (status) => status.flow !== "gameplay" || status.screen === "results", {
    timeout: 12_000,
    interval: 25,
    label: "results screen",
  });
  await release(page, "KeyW");
  await delay(600);
  await shot(page, "E-05-results", "Results screen");
  await mark(page, "E-results", "run complete");

  const dom = await readDom(page);
  report.raw.results = {
    dom,
    status: slimStatus(await readStatus(page)),
  };
});

/* Snapshot the sampler before the page reload replaces window.__step39. ------ */

const recorder = await readRecorder(page);

/* E — returning player: no unexpected tutorial re-appearance ---------------- */

await phase("E-returning-player", async () => {
  const before = await page.evaluate(
    () => window.__glasslineDevLaunch?.status?.()?.activatedCheckpointIds ?? [],
  );

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitHud(page, 30_000);
  await delay(400);
  await acquirePointerLock(page, "returning player");
  await aimYaw(page, mouse, 0);
  await aimPitch(page, mouse, 0);

  await shot(page, "E-06-reload-first-frame", "reloaded profile, first gameplay frame");

  await hold(page, "KeyW");
  await delay(1_600);

  const toast = await page.evaluate(() => {
    const node = document.querySelector(".gl-toast");
    return {
      text: (node?.textContent ?? "").trim(),
      visible: node ? Number(getComputedStyle(node).opacity) > 0.01 : false,
    };
  });

  await release(page, "KeyW");
  await shot(page, "E-07-reload-after-move", "after moving on the returning profile");

  report.raw.returningPlayer = { previousCheckpoints: before, toast };
  report.checklist.push({
    name: "E — returning profile: the tutorial 'Move' toast does not reappear",
    passed: toast.text !== "Move",
    details: JSON.stringify(toast),
  });

  await delay(400);
});

/* Flush ------------------------------------------------------------------- */

if (recorder !== null) {
  report.toast.transitions = recorder.transitions;
  report.toast.segments = toastSegments(recorder.transitions);
  report.toast.emptyVisibleSamples = recorder.emptyVisibleSamples;
  report.toast.duplicateToastNodes = recorder.duplicateToastNodes;
  report.overlaps = recorder.overlaps;
  report.hitches = recorder.hitches;
  report.raw.sampler = { sampleCount: recorder.sampleCount, t0: recorder.t0 };
}

report.raw.finalDom = await readDom(page);
report.raw.finalStatus = slimStatus(await readStatus(page));

await releaseAllSafe();

const recording = await screencast.stop();

await encodeVideo(recording.frames, join(OUT_DIR, "session-1-playthrough.mp4")).catch((error) => {
  report.video = { error: error?.message ?? String(error) };
});
report.video = {
  ...report.video,
  source: "CDP Page.startScreencast (JPEG) -> H.264 via system ffmpeg",
  frames: recording.frames.length,
  file: "session-1-playthrough.mp4",
};

await browser.close();
await rm(FRAME_DIR, { recursive: true, force: true });

report.generatedAt = new Date().toISOString();

await writeFile(join(OUT_DIR, "session-1-report.json"), JSON.stringify(report, null, 2));
await writeFile(join(OUT_DIR, "session-1-summary.txt"), buildTextSummary(report));

log(`done: ${report.screenshots.length} frames, ${report.toast.segments.length} toast segments`);
console.log(buildTextSummary(report));

function buildTextSummary(data) {
  const lines = [];

  lines.push("Step 3.9 — First Section UX acceptance session");
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Browser: ${data.browser?.name} ${data.browser?.version} (${data.environment})`);
  lines.push(`Frames: ${data.screenshots.length}, video frames: ${data.video?.frames ?? 0}`);
  lines.push("");
  lines.push("Phases:");
  for (const entry of data.phases) {
    lines.push(`  ${entry.status.toUpperCase().padEnd(9)} ${entry.name} (${entry.durationMs} ms)`);
    if (entry.error) {
      lines.push(`            ${entry.error.split("\n")[0]}`);
    }
  }
  lines.push("");
  lines.push("Toast segments (visible message windows):");
  for (const segment of data.toast.segments) {
    lines.push(
      `  ${String(segment.startMs).padStart(7)} → ${String(segment.endMs).padStart(7)} ms  ${String(segment.endMs - segment.startMs).padStart(5)} ms  "${segment.message}"`,
    );
  }
  lines.push("");
  lines.push(`Empty visible toast samples: ${data.toast.emptyVisibleSamples}`);
  lines.push(`Duplicate toast DOM nodes: ${data.toast.duplicateToastNodes}`);
  lines.push(`Overlaps: ${data.overlaps.length}`);
  for (const overlap of data.overlaps.slice(0, 20)) {
    lines.push(`  ${overlap.ms} ms with ${overlap.with}: "${overlap.toast}"`);
  }
  lines.push("");
  lines.push(`Console errors: ${data.console.errors.length}`);
  for (const error of data.console.errors.slice(0, 20)) {
    lines.push(`  ${error.atMs} ms: ${error.text.slice(0, 300)}`);
  }
  lines.push(`Page errors: ${data.pageErrors.length}`);
  for (const error of data.pageErrors.slice(0, 10)) {
    lines.push(`  ${error.text.slice(0, 300)}`);
  }
  lines.push(`Failed requests: ${data.failedRequests.length}`);
  lines.push("");
  lines.push("Checks:");
  for (const check of data.checklist) {
    lines.push(`  ${check.passed ? "PASS" : "FAIL"} ${check.name} — ${check.details}`);
  }

  return `${lines.join("\n")}\n`;
}
