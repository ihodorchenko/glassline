#!/usr/bin/env node
/**
 * Step 3.9 — First Section UX acceptance session 6 (route from Gap A to Results; DEV evidence tooling only).
 *
 * Session 6 continues the acceptance pass with pointer lock actually acquired
 * (session 1 never captured the mouse, so mouse-look evidence was missing) and
 * continues through Gap B, CP2 and the rest of the route to the Results screen.
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
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "session-6");
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
/** Set once the mouse controller exists, so direct clicks can resync its base. */
let mouseBase = null;

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

  // Closed-loop aiming converts a yaw/pitch error into a *relative* mouse move.
  // A direct `page.mouse.click` changes the real pointer position, so the base
  // must be resynchronised afterwards or every delta is off by the click offset.
  const setPosition = (nextX, nextY) => {
    x = Math.round(nextX);
    y = Math.round(nextY);
  };

  return {
    async moveBy(dx, dy) {
      x += dx;
      y += dy;
      await page.mouse.move(x, y);
    },
    setPosition,
    async syncToCenter() {
      setPosition(VIEWPORT.width / 2, VIEWPORT.height / 2);
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

    // Camera applies yaw -= mouseX * 0.0022, so the delta is (current - target).
    const dx = Math.round(Math.max(-320, Math.min(320, error / 0.0022)));
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

    // Camera applies pitch -= mouseY * 0.0022 (mouse down = look down = negative).
    const dy = Math.round(Math.max(-260, Math.min(260, error / 0.0022)));
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
    mouseBase?.setPosition(VIEWPORT.width / 2, VIEWPORT.height / 2);
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
async function sprintJump(page, { takeoffZ, landZ, label, onAirborne = null, onLanding = null }) {
  await hold(page, "KeyX");
  await hold(page, "KeyW");

  try {
    await waitForStatus(
      page,
      (status) => status.player?.grounded === true && (status.player?.position.z ?? 0) <= takeoffZ,
      { timeout: 12_000, interval: 10, label: `${label} take-off` },
    );

    const takeoff = await readStatus(page);

    // Hold the jump through the whole arc (no variable-jump early release) and
    // verify the input actually produced a jump instead of a run-off.
    await hold(page, "Space");
    const jumped = await waitForStatus(page, (status) => status.player?.state === "JUMPING", {
      timeout: 600,
      interval: 8,
      label: `${label} jump input`,
    })
      .then(() => true)
      .catch(() => false);

    if (!jumped) {
      throw new Error(
        `${label}: Space did not produce a jump (take-off z=${takeoff?.player?.position.z?.toFixed?.(2)}, grounded=${takeoff?.player?.grounded})`,
      );
    }

    if (onAirborne !== null) {
      await onAirborne(await readStatus(page));
    }

    const landing = await waitForStatus(
      page,
      (status) => status.player?.grounded === true && (status.player?.position.z ?? 0) <= landZ,
      { timeout: 6_000, interval: 10, label: `${label} landing` },
    );

    await release(page, "Space");
    await release(page, "KeyW");
    await release(page, "KeyX");

    if (onLanding !== null) {
      await onLanding(landing);
    }

    await delay(250);

    return { takeoff, landing };
  } finally {
    await release(page, "Space");
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
mouseBase = mouse;
const VIDEO = process.env.VIDEO === "1";
const screencast = VIDEO ? await startScreencast(context, page) : null;

await mkdir(OUT_DIR, { recursive: true });

/* Session 2 choreography --------------------------------------------------- */

async function clickMenuButton(page, label) {
  const rect = await page.evaluate((wanted) => {
    const node = [...document.querySelectorAll('.gl-ui [role="button"]')].find(
      (candidate) => (candidate.textContent ?? "").trim().toLowerCase() === wanted,
    );

    if (!node) {
      return null;
    }

    const box = node.getBoundingClientRect();

    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }, label.toLowerCase());

  if (rect === null) {
    return false;
  }

  await page.mouse.click(rect.x, rect.y);
  mouseBase?.setPosition(rect.x, rect.y);

  return true;
}

const pageNow = async () => await page.evaluate(() => Math.round(performance.now()));

async function mouseLookDelta(page, mouse, dx) {
  const before = (await readStatus(page))?.camera?.yaw ?? 0;

  await mouse.moveBy(dx, 0);
  await delay(350);

  const after = (await readStatus(page))?.camera?.yaw ?? 0;

  return { before, after, changed: Math.abs(after - before) > 0.02 };
}

/* Boot, acquire the mouse, then walk straight to Gap A. -------------------- */

await phase("A-boot", async () => {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitHud(page, 30_000);
  await delay(600);
  await page.bringToFront();
  await delay(400);
  await installSampler(page);

  const locked = await acquirePointerLock(page, "route run");
  await delay(300);
  await aimYaw(page, mouse, 0);
  await aimPitch(page, mouse, 0);
  await delay(200);
  await shot(page, "S6-A-01-spawn-locked", "spawn with the mouse captured");
  report.raw.routeStart = { locked, status: slimStatus(await readStatus(page)) };
});

/* C — Gap A ---------------------------------------------------------------- */

await phase("C-gap-a", async () => {
  await aimYaw(page, mouse, 0);
  await aimPitch(page, mouse, 0);
  await stepToZ(page, ROUTE.gapATakeoffZ + 0.5);
  await delay(400);
  await shot(page, "S6-C-01-gap-a-edge", "Gap A edge, level view");

  await aimPitch(page, mouse, -0.62);
  await delay(300);
  await shot(page, "S6-C-02-gap-a-look-down", "Gap A edge, looking down");
  report.raw.gapALookDownPitch = (await readStatus(page))?.camera?.pitch;
  await aimPitch(page, mouse, 0);

  await backUpToZ(page, 4.0);
  await aimYaw(page, mouse, 0);

  const start = await readStatus(page);
  const result = await sprintJump(page, {
    takeoffZ: -1.2,
    landZ: ROUTE.gapALandZ,
    label: "gap A",
    onAirborne: async () => {
      await shot(page, "S6-C-03-gap-a-airborne", "mid-air over Gap A, Jump toast due");
    },
    onLanding: async (landing) => {
      report.raw.gapA = { ...(report.raw.gapA ?? {}), landing: slimStatus(landing) };
      await shot(page, "S6-C-04-gap-a-landing", "the frame the player lands on roof B");
    },
  });

  const after = await readStatus(page);

  report.raw.gapA = {
    ...(report.raw.gapA ?? {}),
    before: slimStatus(start),
    takeoff: slimStatus(result.takeoff),
    crossing: slimStatus(after),
    crossed:
      (after?.player?.position.z ?? 0) <= ROUTE.gapALandZ &&
      after?.respawnCount === start?.respawnCount,
  };

  report.checklist.push({
    name: "C — Gap A crossed with one normal sprint jump",
    passed: report.raw.gapA.crossed === true,
    details: JSON.stringify({
      takeoff: result.takeoff?.player?.position,
      landing: result.landing?.player?.position,
      respawns: after?.respawnCount,
    }),
  });
});

/* C/D — Gap B and CP2 ------------------------------------------------------ */

await phase("C-gap-b-cp2", async () => {
  await aimYaw(page, mouse, 0);
  await aimPitch(page, mouse, 0);
  await stepToZ(page, ROUTE.gapBTakeoffZ + 1.2);
  await delay(350);
  await shot(page, "S6-C-05-gap-b-edge", "Gap B edge, level view");

  await aimPitch(page, mouse, -0.62);
  await delay(300);
  await shot(page, "S6-C-06-gap-b-look-down", "Gap B edge, looking down");
  await aimPitch(page, mouse, 0);

  await backUpToZ(page, -8.0);
  await aimYaw(page, mouse, 0);

  const start = await readStatus(page);
  const result = await sprintJump(page, {
    takeoffZ: -12.4,
    landZ: ROUTE.gapBLandZ,
    label: "gap B",
    onAirborne: async () => {
      await shot(page, "S6-C-07-gap-b-airborne", "mid-air over Gap B");
    },
    onLanding: async (landing) => {
      report.raw.gapB = { ...(report.raw.gapB ?? {}), landing: slimStatus(landing) };
      await shot(page, "S6-C-08-gap-b-landing", "the frame the player lands past Gap B");
    },
  });

  const after = await readStatus(page);

  report.raw.gapB = {
    ...(report.raw.gapB ?? {}),
    before: slimStatus(start),
    takeoff: slimStatus(result.takeoff),
    crossing: slimStatus(after),
    crossed:
      (after?.player?.position.z ?? 0) <= ROUTE.gapBLandZ &&
      after?.respawnCount === start?.respawnCount,
  };

  report.checklist.push({
    name: "C — Gap B crossed with one normal sprint jump",
    passed: report.raw.gapB.crossed === true,
    details: JSON.stringify({
      takeoff: result.takeoff?.player?.position,
      landing: result.landing?.player?.position,
      respawns: after?.respawnCount,
    }),
  });

  // CP2 sits just past the Gap B landing; walk into it naturally.
  await hold(page, "KeyW");
  await waitForStatus(page, (status) => status.activeCheckpointId === "cp_building_jump", {
    timeout: 8_000,
    interval: 12,
    label: "CP2 activation",
  });
  const cp2At = await pageNow();
  await release(page, "KeyW");

  await shot(page, "S6-D-05-cp2-activation", "CP2 activation after Gap B");
  await delay(450);
  await shot(page, "S6-D-06-cp2-toast", "CP2 confirmation on screen");
  await waitToastHidden(page, 6_000);
  await delay(200);
  await shot(page, "S6-D-07-cp2-hidden", "toast slot empty after CP2");

  report.raw.cp2Sequence = {
    cp2At,
    activatedCheckpointIds: (await readStatus(page))?.activatedCheckpointIds,
  };
});

/* Plant step, gallery, duct, CP3, vaults, CP4, finish ---------------------- */

await phase("C-rest-of-route", async () => {
  await aimYaw(page, mouse, 0);

  // Plant step.
  await backUpToZ(page, -19.0);
  await aimYaw(page, mouse, 0);
  const stepStart = await readStatus(page);
  const step = await sprintJump(page, {
    takeoffZ: -23.5,
    landZ: ROUTE.stepLandZ,
    label: "plant step",
    onLanding: async (landing) => {
      report.raw.plantStep = { before: slimStatus(stepStart), landing: slimStatus(landing) };
      await shot(page, "S6-C-09-plant-step-landing", "landed up the 0.9 m plant step");
    },
  });
  report.raw.plantStep = { ...(report.raw.plantStep ?? {}), takeoff: slimStatus(step.takeoff) };

  // Gallery.
  await driveToZ(page, ROUTE.galleryMidZ);
  await delay(300);
  await shot(page, "S6-C-10-gallery", "gallery mid-point");

  // Slide duct.
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
  await shot(page, "S6-C-11-duct-slide", "inside the slide duct");

  await waitForStatus(page, (status) => (status.player?.position.z ?? 0) <= ROUTE.ductExitZ + 0.8, {
    timeout: 10_000,
    interval: 12,
    label: "duct exit",
  });
  await release(page, "ShiftLeft");
  await release(page, "KeyX");
  await release(page, "KeyW");
  await delay(350);
  await shot(page, "S6-C-12-duct-exit", "out of the slide duct");

  // CP3.
  await hold(page, "KeyW");
  await waitForStatus(page, (status) => status.activeCheckpointId === "cp_slide", {
    timeout: 8_000,
    interval: 12,
    label: "CP3 activation",
  });
  await release(page, "KeyW");
  await shot(page, "S6-D-08-cp3-activation", "CP3 activation");
  await delay(450);
  await shot(page, "S6-D-09-cp3-toast", "CP3 confirmation");
  await waitToastHidden(page, 6_000);
  await delay(200);
  await shot(page, "S6-D-10-cp3-hidden", "toast empty after CP3");

  // Vault channel.
  await aimYaw(page, mouse, 0);
  await aimPitch(page, mouse, 0);
  await driveToZ(page, -56.0);
  await delay(350);
  await shot(page, "S6-C-13-vault-prompt", "E · VAULT prompt before the first obstacle");

  for (let index = 0; index < ROUTE.vaultCenters.length; index += 1) {
    const centerZ = ROUTE.vaultCenters[index];

    await hold(page, "KeyW");

    const deadline = Date.now() + 14_000;
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

    await delay(300);
    log(`vault ${index + 1} cleared (vaulting seen: ${sawVaulting})`);

    if (index === 0) {
      await shot(page, "S6-C-14-vault-toast", "after the first vault");
    }
  }

  await delay(350);
  await shot(page, "S6-C-15-vaults-cleared", "past the three obstacles");

  // CP4.
  await hold(page, "KeyW");
  await waitForStatus(page, (status) => status.activeCheckpointId === "cp_vault", {
    timeout: 8_000,
    interval: 12,
    label: "CP4 activation",
  });
  await release(page, "KeyW");
  await shot(page, "S6-D-11-cp4-activation", "CP4 activation");
  await delay(450);
  await shot(page, "S6-D-12-cp4-toast", "CP4 confirmation");
  await waitToastHidden(page, 6_000);
  await delay(200);
  await shot(page, "S6-D-13-cp4-hidden", "toast empty after CP4");

  // Stairs and finish.
  await aimYaw(page, mouse, 0);
  await driveToZ(page, -80.0, { timeout: 35_000 });
  await delay(300);
  await shot(page, "S6-E-05-finish-approach", "approach to the finish");

  await hold(page, "KeyW");
  await waitForStatus(page, (status) => status.flow !== "gameplay" || status.screen === "results", {
    timeout: 15_000,
    interval: 25,
    label: "results screen",
  });
  await release(page, "KeyW");
  await delay(700);
  await shot(page, "S6-E-06-results", "Results screen");
  await mark(page, "E-results", "run complete");

  report.raw.results = {
    dom: await readDom(page),
    status: slimStatus(await readStatus(page)),
  };

  report.checklist.push({
    name: "E — the HUD is hidden and the toast slot is empty on the Results screen",
    passed: report.raw.results.dom.hud === false && report.raw.results.dom.toast?.visible !== true,
    details: JSON.stringify({
      hud: report.raw.results.dom.hud,
      toast: report.raw.results.dom.toast,
      screenTitle: report.raw.results.dom.screenTitle,
      screenCount: report.raw.results.dom.screenCount,
    }),
  });
});

/* Snapshot the sampler before any further navigation. ---------------------- */

let recorder = null;

try {
  recorder = await readRecorder(page);
} catch (error) {
  report.raw.recorderError = error?.message ?? String(error);
}

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

try {
  report.raw.finalDom = await readDom(page);
  report.raw.finalStatus = slimStatus(await readStatus(page));
} catch (error) {
  report.raw.finalDom = { error: error?.message ?? String(error) };
}

await releaseAllSafe();

if (screencast !== null) {
  const recording = await screencast.stop();

  await encodeVideo(recording.frames, join(OUT_DIR, "session-6-playthrough.mp4")).catch((error) => {
    report.video = { error: error?.message ?? String(error) };
  });
  report.video = {
    ...report.video,
    source: "CDP Page.startScreencast (JPEG) -> H.264 via system ffmpeg",
    frames: recording.frames.length,
    file: "session-6-playthrough.mp4",
  };
}

await browser.close().catch(() => undefined);
await rm(FRAME_DIR, { recursive: true, force: true }).catch(() => undefined);

report.generatedAt = new Date().toISOString();

await writeFile(join(OUT_DIR, "session-6-report.json"), JSON.stringify(report, null, 2));
await writeFile(join(OUT_DIR, "session-6-summary.txt"), buildTextSummary(report));

log(`done: ${report.screenshots.length} frames, ${report.toast.segments.length} toast segments`);
console.log(buildTextSummary(report));

function buildTextSummary(data) {
  const lines = [];

  lines.push("Step 3.9 — First Section UX acceptance session 6");
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
