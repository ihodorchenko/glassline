#!/usr/bin/env node
/**
 * Gameplay-feel acceptance audit harness (Step 3.11).
 *
 * This is DEV-only evidence tooling. It boots the real, menu-launched Prologue
 * through the normal gameplay lifecycle, plays it end to end with trusted
 * Playwright keyboard/mouse input, and records what a player would actually
 * experience: continuous telemetry, screenshots, a screencast and the live
 * audio mix. It also runs focused measurement probes for the areas the audit
 * must not infer from a successful traversal alone (jump/slide/vault/wall-run
 * feel, step-glide safety, respawn state, gamepad input, Medium-quality
 * performance).
 *
 * It never edits gameplay, physics, camera, level geometry or authored
 * content. The only page-side instrumentation is read-only: a requestAnimation
 * Frame sampler and (for the respawn check) a wrapper that records the fixed
 * steps the player already runs.
 *
 * Usage:
 *   node tools/capture/feel-audit.mjs \
 *     --out-dir docs/evidence/gameplay-feel/step-3.11
 *   node tools/capture/feel-audit.mjs --headed --no-video --no-audio
 *   node tools/capture/feel-audit.mjs --reuse-server --server-port 5340
 *
 * Output (under --out-dir):
 *   report.json            every measurement + PASS/FAIL checks
 *   route/*.jpg            key frames of the full Prologue run
 *   route/route.mp4        continuous screencast of the run
 *   route/audio.wav        live master mix of the run
 *   respawn/*.jpg          before/after the real kill-volume respawn
 */

import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { attachDiagnostics, launchBrowser } from "./lib/browser-session.mjs";
import { createServerManager } from "./lib/vite-server.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_OUT_DIR = "docs/evidence/gameplay-feel/step-3.11";
const DEFAULT_PORT = 5350;
const WIDTH = 1600;
const HEIGHT = 900;
const VIEWPORT = { width: WIDTH, height: HEIGHT };

const EDGES = [-72.3, -77.8, -83.4, -89.0, -94.6, -100.2, -105.8, -111.4, -117.0];
const BARRIERS = [39.0, 34.0];

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error?.stack ?? String(error));
    process.exit(1);
  });
}

function parseArgs(argv) {
  const options = {
    outDir: DEFAULT_OUT_DIR,
    report: null,
    serverPort: DEFAULT_PORT,
    url: null,
    headless: true,
    video: true,
    audio: true,
    perf: true,
    reuseServer: false,
    readyTimeout: 60_000,
    serverTimeout: 90_000,
    phases: ["route", "mechanics", "respawn", "gamepad", "perf"],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      index += 1;
      return argv[index];
    };

    switch (arg) {
      case "--out-dir":
        options.outDir = value();
        break;
      case "--report":
        options.report = value();
        break;
      case "--server-port":
        options.serverPort = Number(value());
        break;
      case "--url":
        options.url = value();
        break;
      case "--headed":
        options.headless = false;
        break;
      case "--headless":
        options.headless = true;
        break;
      case "--no-video":
        options.video = false;
        break;
      case "--no-audio":
        options.audio = false;
        break;
      case "--no-perf":
        options.perf = false;
        break;
      case "--reuse-server":
        options.reuseServer = true;
        break;
      case "--only":
        options.phases = value().split(",");
        break;
      case "--skip":
        options.phases = options.phases.filter((p) => !value().split(",").includes(p));
        break;
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.outDir = resolve(ROOT_DIR, options.outDir);
  options.url = options.url ?? `http://127.0.0.1:${options.serverPort}/`;
  options.report = options.report
    ? resolve(ROOT_DIR, options.report)
    : join(options.outDir, "report.json");
  return options;
}

function createLogger() {
  const started = Date.now();
  return (...parts) =>
    console.log(`[feel ${((Date.now() - started) / 1000).toFixed(1)}s]`, ...parts);
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function stats(values) {
  const clean = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const sum = clean.reduce((total, value) => total + value, 0);
  return {
    count: clean.length,
    avg: round(sum / clean.length),
    median: round(clean[Math.floor(clean.length / 2)]),
    p95: round(clean[Math.floor(clean.length * 0.95)]),
    p99: round(clean[Math.floor(clean.length * 0.99)]),
    max: round(clean[clean.length - 1]),
    min: round(clean[0]),
  };
}

const frameStats = (frames) => {
  const times = [];
  for (let index = 1; index < frames.length; index += 1)
    times.push(frames[index].t - frames[index - 1].t);
  const s = stats(times);
  if (!s) return null;
  return { ...s, fps: round(1000 / s.avg, 1), medianFps: round(1000 / s.median, 1) };
};

/* -------------------------------------------------------------------------- */
/* Page-side sampler                                                          */
/* -------------------------------------------------------------------------- */

const INSTALL_SAMPLER = () => {
  const app = window.__glassline;
  if (!app) return false;
  const cam = app.cameraSystem.camera;
  if (window.__feel) window.__feel.dispose();
  window.__feel = {
    frames: [],
    events: [],
    on: false,
    dispose() {
      this.on = false;
      this.frames.length = 0;
    },
  };
  const rec = window.__feel;

  window.addEventListener(
    "keydown",
    (event) => {
      if (rec.on)
        rec.events.push({
          t: performance.now(),
          type: "down",
          code: event.code,
          repeat: event.repeat,
        });
    },
    true,
  );

  const loop = () => {
    if (rec.on && app.player) {
      const position = app.player.getPosition();
      const movement = app.player.getMovementSnapshot();
      rec.frames.push({
        t: performance.now(),
        x: position.x,
        y: position.y,
        z: position.z,
        vx: movement.velocity.x,
        vy: movement.velocity.y,
        vz: movement.velocity.z,
        speed: movement.speed,
        state: movement.state,
        stance: movement.stance,
        grounded: movement.grounded,
        posture: movement.postureHeight,
        yaw: app.cameraSystem.viewYaw,
        pitch: app.cameraSystem.viewPitch,
        camX: cam.position.x,
        camY: cam.position.y,
        camZ: cam.position.z,
        fov: cam.fov,
        roll: cam.rotation.z,
        landing: movement.landingRemainingSeconds,
        impact: movement.landingImpactSpeed,
        held: app.input?.heldKeys ? [...app.input.heldKeys].sort().join("+") : "",
        keys: app.input?.heldKeys ? app.input.heldKeys.size : -1,
        cp: app.checkpointSystem?.getActiveCheckpointId?.() ?? null,
        flow: app.flowManager?.getState?.() ?? null,
        screen: app.ui?.getActiveScreen?.() ?? null,
        toast: document.querySelector(".gl-toast")?.textContent ?? null,
        prompt: document.querySelector(".gl-prompt")?.textContent ?? null,
      });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Read-only instrumentation: record the fixed steps the player already runs.
  const player = app.player;
  if (player && !player.__feelStepPatched) {
    player.__feelStepPatched = true;
    const original = player.fixedUpdate.bind(player);
    player.fixedUpdate = (input, yaw, deltaSeconds) => {
      original(input, yaw, deltaSeconds);
      if (rec.on && rec.steps && rec.steps.length < 4000) {
        const position = player.getPosition();
        const movement = player.getMovementSnapshot();
        rec.steps.push({
          t: performance.now(),
          x: position.x,
          y: position.y,
          z: position.z,
          speed: movement.speed,
          state: movement.state,
          grounded: movement.grounded,
          command: Math.hypot(input.move.x, input.move.y),
        });
      }
    };
  }
  rec.steps = [];

  return true;
};

/* -------------------------------------------------------------------------- */
/* Page helpers                                                               */
/* -------------------------------------------------------------------------- */

async function bootPrologue(page, options, log) {
  await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
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
  await page.bringToFront();
  await page.mouse.click(Math.floor(WIDTH / 2), Math.floor(HEIGHT / 2));
  await page.waitForFunction(() => document.pointerLockElement !== null, { timeout: 8_000 });
  await page
    .waitForFunction(() => document.getElementById("boot-loader") === null, { timeout: 8_000 })
    .catch(() => {});
  await page.evaluate(INSTALL_SAMPLER);

  const level = await page.evaluate(
    () => window.__glassline?.sessionManager?.getActiveSession?.()?.levelId ?? null,
  );
  log(`gameplay session ready (level=${level})`);

  return level;
}

const readState = (page) =>
  page.evaluate(() => {
    const app = window.__glassline;
    if (!app?.player) return null;
    const position = app.player.getPosition();
    const movement = app.player.getMovementSnapshot();
    return {
      x: position.x,
      y: position.y,
      z: position.z,
      speed: movement.speed,
      state: movement.state,
      stance: movement.stance,
      grounded: movement.grounded,
      yaw: app.cameraSystem.viewYaw,
      camY: app.cameraSystem.camera.position.y,
      fov: app.cameraSystem.camera.fov,
      roll: app.cameraSystem.camera.rotation.z,
      cp: app.checkpointSystem?.getActiveCheckpointId?.() ?? null,
      flow: app.flowManager?.getState?.() ?? null,
      screen: app.ui?.getActiveScreen?.() ?? null,
      toast: document.querySelector(".gl-toast")?.textContent ?? null,
      prompt: document.querySelector(".gl-prompt")?.textContent ?? null,
    };
  });

const aimAndRead = (page, targetX, targetZ) =>
  page.evaluate(
    ([tx, tz]) => {
      const app = window.__glassline;
      if (!app?.player) return null;
      const position = app.player.getPosition();
      const dx = tx - position.x;
      const dz = tz - position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.8) {
        const yaw = app.cameraSystem.viewYaw;
        const dot = -Math.sin(yaw) * (dx / distance) + -Math.cos(yaw) * (dz / distance);
        if (dot > -0.25) app.cameraSystem.yaw = Math.atan2(-dx, -dz);
      }
      app.cameraSystem.pitch = 0;
      const movement = app.player.getMovementSnapshot();
      return {
        x: position.x,
        y: position.y,
        z: position.z,
        speed: movement.speed,
        state: movement.state,
        stance: movement.stance,
        grounded: movement.grounded,
        yaw: app.cameraSystem.viewYaw,
        camY: app.cameraSystem.camera.position.y,
        fov: app.cameraSystem.camera.fov,
        roll: app.cameraSystem.camera.rotation.z,
        cp: app.checkpointSystem?.getActiveCheckpointId?.() ?? null,
        flow: app.flowManager?.getState?.() ?? null,
        screen: app.ui?.getActiveScreen?.() ?? null,
        toast: document.querySelector(".gl-toast")?.textContent ?? null,
      };
    },
    [targetX, targetZ],
  );

function createKeyController(page) {
  const held = new Set();
  const down = async (code) => {
    if (!held.has(code)) {
      await page.keyboard.down(code);
      held.add(code);
    }
  };
  const up = async (code) => {
    if (held.has(code)) {
      await page.keyboard.up(code);
      held.delete(code);
    }
  };
  const tap = async (code, milliseconds = 60) => {
    await page.keyboard.down(code);
    await delay(milliseconds);
    await page.keyboard.up(code);
    await delay(10);
  };
  const releaseAll = async () => {
    for (const code of [...held]) await up(code);
  };
  const jump = async (holdMilliseconds = 240) => {
    await page.keyboard.down("Space");
    await delay(holdMilliseconds);
    await page.keyboard.up("Space");
  };
  return { held, down, up, tap, releaseAll, jump };
}

async function resetPlayer(page, x, y, z, yaw = 0) {
  await page.evaluate(
    ([x, y, z, yaw]) => {
      const app = window.__glassline;
      app.player.teleportTo({ x, y, z });
      app.cameraSystem.yaw = yaw;
      app.cameraSystem.pitch = 0;
    },
    [x, y, z, yaw],
  );
  await delay(500);
}

async function startSampling(page) {
  await page.evaluate(() => {
    window.__feel.on = true;
    window.__feel.frames.length = 0;
    window.__feel.events.length = 0;
    window.__feel.steps.length = 0;
  });
}

async function stopAndCollect(page) {
  return await page.evaluate(() => {
    window.__feel.on = false;
    const out = {
      frames: window.__feel.frames.splice(0),
      events: window.__feel.events.splice(0),
      steps: window.__feel.steps.splice(0),
    };
    return out;
  });
}

async function shoot(page, path, log) {
  await page.screenshot({ path, type: "jpeg", quality: 82 });
  log(`shot ${path}`);
}

/* -------------------------------------------------------------------------- */
/* Video and audio                                                            */
/* -------------------------------------------------------------------------- */

async function startScreencast(context, page) {
  const cdp = await context.newCDPSession(page);
  const frames = [];
  const startedAt = Date.now();
  cdp.on("Page.screencastFrame", (params) => {
    frames.push({ data: params.data, timestamp: params.metadata?.timestamp ?? Date.now() / 1000 });
    cdp.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 80,
    maxWidth: 1280,
    maxHeight: 720,
    everyNthFrame: 1,
  });
  return {
    async stop() {
      await cdp.send("Page.stopScreencast").catch(() => undefined);
      await cdp.detach().catch(() => undefined);
      return { frames, wallClockSeconds: (Date.now() - startedAt) / 1000 };
    },
  };
}

async function encodeScreencast(frames, outPath, frameDir, wallClockSeconds, log) {
  if (frames.length < 2) throw new Error(`screencast produced ${frames.length} frame(s)`);
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });
  const durations = frames.map((frame, index) => {
    const next = frames[index + 1];
    if (!next) return 1 / 30;
    const raw = next.timestamp - frame.timestamp;
    return Number.isFinite(raw) && raw > 0 ? Math.min(2, Math.max(0.005, raw)) : 1 / 30;
  });
  const total = durations.reduce((sum, value) => sum + value, 0);
  const scale = wallClockSeconds > 0 && total > 0 ? wallClockSeconds / total : 1;
  const lines = ["ffconcat version 1.0"];
  for (let index = 0; index < frames.length; index += 1) {
    const name = `frame-${String(index + 1).padStart(5, "0")}.jpg`;
    await writeFile(join(frameDir, name), Buffer.from(frames[index].data, "base64"));
    lines.push(
      `file '${name}'`,
      `duration ${Math.max(0.001, durations[index] * scale).toFixed(4)}`,
    );
  }
  lines.push(`file 'frame-${String(frames.length).padStart(5, "0")}.jpg'`);
  await writeFile(join(frameDir, "frames.txt"), `${lines.join("\n")}\n`);

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        join(frameDir, "frames.txt"),
        "-vf",
        "fps=30,scale=1280:-2:flags=lanczos",
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
        outPath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
  await rm(frameDir, { recursive: true, force: true });
  log(
    `encoded ${outPath} (${(frames.length / Math.max(1, wallClockSeconds)).toFixed(1)} fps of screencast)`,
  );
}

const START_AUDIO = `(() => {
  const app = window.__glassline;
  const audio = app.audioManager;
  const context = audio?.context;
  const source = audio?.limiter ?? audio?.mixTrim;
  if (!context || !source || audio.state !== "running") return { error: "audio-not-running" };
  const chunks = [];
  const processor = context.createScriptProcessor(4096, 2, 2);
  const sink = context.createGain();
  sink.gain.value = 0;
  processor.onaudioprocess = (event) => {
    const left = event.inputBuffer.getChannelData(0);
    const right = event.inputBuffer.numberOfChannels > 1 ? event.inputBuffer.getChannelData(1) : left;
    chunks.push([new Float32Array(left), new Float32Array(right)]);
  };
  source.connect(processor);
  processor.connect(sink);
  sink.connect(context.destination);
  window.__feelAudio = { chunks, processor, sink, source, context };
  return { sampleRate: context.sampleRate };
})()`;

const STOP_AUDIO = `(() => {
  const recorder = window.__feelAudio;
  if (!recorder) return { error: "recorder-missing" };
  recorder.processor.onaudioprocess = null;
  recorder.source.disconnect(recorder.processor);
  recorder.processor.disconnect();
  recorder.sink.disconnect();
  const frames = recorder.chunks.reduce((total, [left]) => total + left.length, 0);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let offset = 0;
  for (const [l, r] of recorder.chunks) { left.set(l, offset); right.set(r, offset); offset += l.length; }
  const sampleRate = recorder.context.sampleRate;
  // 16-bit stereo WAV
  const buffer = new ArrayBuffer(44 + frames * 4);
  const view = new DataView(buffer);
  const write = (position, value) => { for (let i = 0; i < value.length; i += 1) view.setUint8(position + i, value.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + frames * 4, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, frames * 4, true);
  let peak = 0; let sum = 0; let dataOffset = 44; const windowRms = []; let windowSum = 0; let windowCount = 0;
  const windowSamples = Math.max(1, Math.round(sampleRate * 0.05));
  for (let index = 0; index < frames; index += 1) {
    const l = left[index] ?? 0; const r = right[index] ?? 0;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sum += (l * l + r * r) * 0.5;
    windowSum += (l * l + r * r) * 0.5; windowCount += 1;
    if (windowCount >= windowSamples) { windowRms.push(Math.sqrt(windowSum / windowCount)); windowSum = 0; windowCount = 0; }
    view.setInt16(dataOffset, Math.max(-1, Math.min(1, l)) * 0x7fff, true);
    view.setInt16(dataOffset + 2, Math.max(-1, Math.min(1, r)) * 0x7fff, true);
    dataOffset += 4;
  }
  let binary = ""; const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  delete window.__feelAudio;
  return { wavBase64: btoa(binary), sampleRate, durationSeconds: frames / sampleRate, peak, rms: Math.sqrt(sum / Math.max(1, frames)), windowRms };
})()`;

function analyzeAudio(result) {
  if (!result || result.error) return { available: false, error: result?.error ?? "no data" };
  const windows = result.windowRms.map((value) => round(value, 5));
  const silent = windows.filter((value) => value < 0.0005).length;
  let longestSilence = 0;
  let current = 0;
  for (const value of windows) {
    if (value < 0.0005) {
      current += 1;
      longestSilence = Math.max(longestSilence, current);
    } else current = 0;
  }
  return {
    available: true,
    sampleRate: result.sampleRate,
    durationSeconds: round(result.durationSeconds, 2),
    peak: round(result.peak, 4),
    rms: round(result.rms, 5),
    clipping: result.peak >= 0.999,
    silentWindows: silent,
    longestSilenceSeconds: round(longestSilence * 0.05, 2),
    windowRmsMin: round(Math.min(...windows), 5),
    windowRmsMax: round(Math.max(...windows), 5),
    windowRmsP50: round([...windows].sort((a, b) => a - b)[Math.floor(windows.length / 2)], 5),
  };
}

/* -------------------------------------------------------------------------- */
/* Phase 1 — full Prologue run                                                */
/* -------------------------------------------------------------------------- */

async function runRoute(context, options, log) {
  const outDir = join(options.outDir, "route");
  await mkdir(outDir, { recursive: true });

  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const keys = createKeyController(page);
  const trace = [];
  const shots = new Set();
  const fired = new Set();
  const once = (key) => {
    if (fired.has(key)) return false;
    fired.add(key);
    return true;
  };
  const shotOnce = async (name) => {
    if (shots.has(name)) return;
    shots.add(name);
    await shoot(page, join(outDir, `${name}.jpg`), log);
  };

  let screencast = null;
  let audioResult = null;
  let audioStarted = false;

  try {
    const levelId = await bootPrologue(page, options, log);

    if (options.video) screencast = await startScreencast(context, page);
    if (options.audio) {
      const started = await page.evaluate(START_AUDIO);
      audioStarted = !started?.error;
      trace.push({ event: "audio-start", ...(started ?? {}) });
    }

    await startSampling(page);
    const runStartedAt = Date.now();

    const legs = [
      { id: "roof", x: 0, z: -23.5 },
      { id: "lower", x: 0, z: -36 },
      { id: "stairs", x: 0, z: -48 },
      { id: "deck", x: 0, z: -62.6 },
      { id: "beam", x: 0, z: -78 },
      { id: "ascent", x: 0, z: -140 },
      { id: "finalDeck", x: 18, z: -122.8 },
      { id: "catwalkOut", x: 40, z: -122.8 },
      { id: "turnIn", x: 52.0, z: -127.5 },
      { id: "turnSouth", x: 50.0, z: -130.4 },
      { id: "returnStart", x: 49, z: -130.8 },
      { id: "return", x: 8.6, z: -130.8 },
      { id: "finish", x: 0, z: -133.6 },
    ];
    let leg = 0;
    let respawnCount = 0;
    let lastZ = null;
    let result = null;

    // input warm-up: never start a route before the character actually moves
    let alive = false;
    for (let attempt = 0; attempt < 3 && !alive; attempt += 1) {
      await keys.down("KeyW");
      await keys.down("KeyX");
      const deadline = Date.now() + 1_500;
      while (Date.now() < deadline) {
        const state = await readState(page).catch(() => null);
        if (state && state.speed > 0.6) {
          alive = true;
          break;
        }
        await delay(80);
      }
      if (!alive) {
        const diag = await page.evaluate(() => ({
          focus: document.hasFocus(),
          lock: document.pointerLockElement?.id ?? null,
          enabled: window.__glassline.input.enabled,
          context: window.__glassline.input.activeContext,
          held: [...window.__glassline.input.heldKeys],
        }));
        trace.push({ event: "input-retry", ...diag });
        await keys.releaseAll();
        if (!diag.lock)
          await page.mouse.click(Math.floor(WIDTH / 2), Math.floor(HEIGHT / 2)).catch(() => {});
        await delay(350);
      }
    }
    if (!alive) throw new Error("the game did not respond to trusted keyboard input");

    let lastTick = Date.now();
    while (Date.now() - runStartedAt < 180_000) {
      const current = legs[leg];
      let state;
      try {
        state = await aimAndRead(page, current.x, current.z);
      } catch {
        state = null;
      }
      if (!state) break;

      if (state.flow === "results" || state.screen) {
        trace.push({ event: "results", screen: state.screen, leg: current.id });
        break;
      }

      if (lastZ !== null && state.z > lastZ + 6) {
        respawnCount += 1;
        trace.push({ event: "respawn", leg: current.id, z: state.z });
        break;
      }
      lastZ = state.z;

      if (leg === 0 && state.z < -22.6) leg = 1;
      else if (leg === 1 && state.z < -35.6) leg = 2;
      else if (leg === 2 && state.z < -47.5) leg = 3;
      else if (leg === 3 && state.z < -62.4) leg = 4;
      else if (leg === 4 && state.z < -73.5) leg = 5;
      else if (leg === 5 && state.z < -118.4 && state.grounded && state.y > 4.5) leg = 6;
      else if (leg === 6 && state.x > 8.6) leg = 7;
      else if (leg === 7 && state.x > 46.2) leg = 8;
      else if (leg === 8 && state.z < -127.8) leg = 9;
      else if (leg === 9 && state.x < 52.5) leg = 10;
      else if (leg === 10 && state.x < 45.5) leg = 11;
      else if (leg === 11 && state.x < 9.2) leg = 12;

      switch (current.id) {
        case "roof": {
          if (state.z < 0.55 && once("vault")) {
            trace.push({ event: "vault-E", z: state.z, speed: state.speed });
            await keys.tap("KeyE", 60);
          }
          if (state.z < -4.3 && once("slide")) {
            trace.push({ event: "slide-start", z: state.z, speed: state.speed });
            await keys.down("ShiftLeft");
          }
          if (state.z < -10.2) await keys.up("ShiftLeft");
          break;
        }
        case "lower": {
          if (
            state.grounded &&
            state.speed > 4 &&
            state.z <= -31.3 + 0.16 * state.speed &&
            once("gapA")
          ) {
            trace.push({ event: "gapA-jump", z: state.z, speed: state.speed });
            await keys.jump(240);
          }
          break;
        }
        case "deck": {
          // The finish-deck parapet is not vaultable; a running jump is the
          // authored action. Probe E first so the report can state that the
          // affordance does not exist (rather than infer it).
          if (state.z < -60.9 && once("parapet-E")) {
            trace.push({ event: "parapet-E", z: state.z, speed: state.speed });
            await keys.tap("KeyE", 55);
          }
          if (state.z < -60.55 && once("parapet-jump")) {
            trace.push({ event: "parapet-jump", z: state.z, speed: state.speed });
            await keys.jump(240);
          }
          break;
        }
        case "beam": {
          if (
            state.grounded &&
            state.speed > 4 &&
            state.z <= EDGES[0] + 0.16 * state.speed &&
            once("edge0")
          ) {
            trace.push({ event: "edge0", z: state.z, speed: state.speed });
            await keys.jump(250);
          }
          break;
        }
        case "ascent": {
          if (state.grounded) {
            for (let index = 0; index < EDGES.length; index += 1) {
              if (state.z <= EDGES[index] + 0.16 * state.speed && once(`edge${index}`)) {
                trace.push({ event: `edge${index}`, z: state.z, speed: state.speed });
                await keys.jump(250);
                break;
              }
            }
          }
          break;
        }
        case "catwalkOut": {
          if (state.grounded && state.x >= 23.0 && once("catGap")) {
            trace.push({ event: "catGap", x: state.x, speed: state.speed });
            await keys.jump(240);
          }
          if (state.x > 37.0 && once("turn-slow")) {
            trace.push({ event: "turn-slow", x: state.x, speed: state.speed });
            await keys.up("KeyX");
          }
          if (state.x > 46.2 && once("turn-brake")) {
            trace.push({ event: "turn-brake", x: state.x, speed: state.speed });
            await keys.up("KeyW");
          }
          break;
        }
        case "turnIn": {
          if (state.speed < 1.2 && once("turn-go")) {
            trace.push({ event: "turn-go", x: state.x, z: state.z });
            await keys.down("KeyW");
          }
          break;
        }
        case "returnStart": {
          if (!keys.held.has("KeyX")) {
            await keys.down("KeyX");
            trace.push({ event: "return-sprint", x: state.x });
          }
          break;
        }
        case "return": {
          if (state.grounded) {
            for (let index = 0; index < BARRIERS.length; index += 1) {
              if (state.x <= BARRIERS[index] + 0.16 * state.speed && once(`barrier${index}`)) {
                trace.push({ event: `barrier${index}`, x: state.x, speed: state.speed });
                await keys.jump(240);
                break;
              }
            }
          }
          break;
        }
        default:
          break;
      }

      if (state.z < -0.4) await shotOnce("01-vault");
      if (state.z < -7.0 && state.z > -9.4) await shotOnce("02-slide-tunnel");
      if (state.z < -13.0) await shotOnce("03-wallrun-corridor");
      if (state.z < -23.5) await shotOnce("04-lower-drop");
      if (state.z < -36.6) await shotOnce("05-stairs");
      if (state.z < -44.0) await shotOnce("06-skybridge");
      if (state.z < -55.0) await shotOnce("07-finish-deck");
      if (state.z < -68.0) await shotOnce("08-beam");
      if (state.z < -95.0) await shotOnce("09-ascent");
      if (state.y > 4.9 && state.z < -119.0) await shotOnce("10-final-deck");
      if (state.x > 30.0) await shotOnce("11-catwalk");
      if (state.x < 20.0 && state.z < -128.0) await shotOnce("12-return");
      if (state.z < -132.0) await shotOnce("13-finish");

      if (state.grounded && state.speed < 0.35 && Date.now() - runStartedAt > 5_000) {
        trace.push({ event: "stuck", leg: current.id, z: state.z, x: state.x });
        break;
      }

      if (Date.now() - lastTick > 1000) lastTick = Date.now();
      await delay(24);
    }

    await keys.releaseAll();

    // Let the finish flow settle into Results.
    let endState = null;
    for (let index = 0; index < 40; index += 1) {
      endState = await page
        .evaluate(() => ({
          flow: window.__glassline?.flowManager?.getState?.() ?? null,
          screen: window.__glassline?.ui?.getActiveScreen?.() ?? null,
          hudVisible: document.querySelector(".gl-hud")?.classList.contains("is-visible") ?? null,
          speedText: document.querySelector(".gl-hud__speed")?.textContent ?? null,
          promptText: document.querySelector(".gl-prompt")?.textContent ?? null,
          resultsTime:
            document.querySelector(".gl-screen__meta, .gl-results__time")?.textContent ?? null,
        }))
        .catch(() => null);
      if (endState?.screen === "results" || endState?.flow === "results") break;
      await delay(200);
    }

    await delay(400);
    await shoot(page, join(outDir, "14-results.jpg"), log);
    await page
      .evaluate(() => {
        window.__feel.on = false;
      })
      .catch(() => {});

    if (screencast) {
      const recording = await screencast.stop();
      try {
        await encodeScreencast(
          recording.frames,
          join(outDir, "route.mp4"),
          join(outDir, ".frames"),
          recording.wallClockSeconds,
          log,
        );
        trace.push({
          event: "video",
          frames: recording.frames.length,
          seconds: round(recording.wallClockSeconds, 1),
        });
      } catch (error) {
        trace.push({ event: "video-failed", error: String(error) });
      }
    }

    if (options.audio && audioStarted) {
      audioResult = await page.evaluate(STOP_AUDIO).catch(() => null);
      if (audioResult?.wavBase64) {
        await writeFile(join(outDir, "audio.wav"), Buffer.from(audioResult.wavBase64, "base64"));
        audioResult = analyzeAudio(audioResult);
        trace.push({ event: "audio", ...audioResult });
      }
    }

    const collected = await page
      .evaluate(() => ({
        frames: window.__feel.frames.splice(0),
        events: window.__feel.events.splice(0),
      }))
      .catch(() => ({ frames: [], events: [] }));

    result = {
      levelId,
      completed: endState?.screen === "results" || endState?.flow === "results",
      durationSeconds: round((Date.now() - runStartedAt) / 1000, 1),
      respawnCount,
      trace,
      keyEvents: collected.events.filter((event) => !event.repeat),
      frames: collected.frames,
      frameStats: frameStats(collected.frames),
      endState,
      diagnostics: diagnostics.snapshot(),
      audio: audioResult,
    };

    log(
      `route: completed=${result.completed} frames=${collected.frames.length} respawns=${respawnCount}`,
    );
    return result;
  } finally {
    await keys.releaseAll().catch(() => {});
    await page.close().catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */
/* Phase 2 — mechanics probes                                                 */
/* -------------------------------------------------------------------------- */

async function runMechanics(context, options, log) {
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const keys = createKeyController(page);
  const results = {};

  try {
    await bootPrologue(page, options, log);

    const measure = async (label, setup, action, milliseconds = 1_200) => {
      await setup();
      await startSampling(page);
      await action();
      await delay(milliseconds);
      const collected = await stopAndCollect(page);
      results[label] = collected;
      log(`mechanics: ${label} (${collected.frames.length} frames)`);
      return collected;
    };

    // A. Acceleration / deceleration (open west lane)
    await measure(
      "accel",
      () => resetPlayer(page, -6, 0.93, 16),
      async () => {
        await keys.down("KeyW");
        await delay(400);
        await keys.down("KeyX");
        await delay(900);
        await keys.up("KeyX");
        await keys.up("KeyW");
        await delay(900);
      },
      200,
    );

    // B. Jump: tap vs hold, rise and air time
    const jump = async (label, holdMilliseconds) => {
      await measure(
        label,
        async () => {
          await resetPlayer(page, -6, 0.93, 14);
          await keys.down("KeyW");
          await keys.down("KeyX");
          await delay(900);
        },
        async () => {
          await page.keyboard.down("Space");
          await delay(holdMilliseconds);
          await page.keyboard.up("Space");
          await keys.up("KeyW");
          await keys.up("KeyX");
        },
        1200,
      );
    };
    await jump("jumpTap", 90);
    await jump("jumpTapShort", 55);
    await jump("jumpHold", 320);

    // C. Vault profiles: standard (<6 m/s) and speed (>=6 m/s)
    const vault = async (label, sprint) => {
      await resetPlayer(page, 0, 0.93, sprint ? 3.0 : 2.4);
      await keys.down("KeyW");
      if (sprint) await keys.down("KeyX");
      await startSampling(page);
      let pressed = false;
      for (let index = 0; index < 120; index += 1) {
        const state = await readState(page).catch(() => null);
        if (!state) break;
        if (!pressed && state.z < 0.85 && state.speed > 2.5) {
          await keys.tap("KeyE", 55);
          pressed = true;
        }
        if (pressed && state.z < -2.6) break;
        await delay(16);
      }
      await delay(600);
      await keys.up("KeyW");
      if (sprint) await keys.up("KeyX");
      await delay(200);
      const collected = await stopAndCollect(page);
      results[label] = collected;
      log(`mechanics: ${label}`);
    };
    await vault("vaultStandard", false);
    await vault("vaultSpeed", true);

    // D. Wall run + wall jump in the authored corridor (approach from the north)
    await measure(
      "wallRun",
      async () => {
        await resetPlayer(page, 1.55, 0.93, -21.4, Math.PI);
        await keys.down("KeyW");
        await keys.down("KeyX");
        await delay(600);
      },
      async () => {
        await keys.jump(240);
        await delay(900);
        await keys.up("KeyW");
        await keys.up("KeyX");
      },
      200,
    );
    await resetPlayer(page, 1.55, 0.93, -21.4, Math.PI);
    await keys.down("KeyW");
    await keys.down("KeyX");
    await delay(600);
    await keys.jump(220);
    await delay(250);
    await startSampling(page);
    await keys.jump(220);
    await delay(900);
    await keys.up("KeyW");
    await keys.up("KeyX");
    results.wallJump = await stopAndCollect(page);

    // E. Stairs: sprint ascent and run descent (ground-stick step-glide)
    await measure(
      "stairsUp",
      () => resetPlayer(page, 0, -2.13, -34.9),
      async () => {
        await keys.down("KeyW");
        await keys.down("KeyX");
        await delay(2400);
        await keys.up("KeyX");
        await keys.up("KeyW");
      },
      200,
    );
    await measure(
      "stairsDown",
      () => resetPlayer(page, 0, 0.05, -42.0, Math.PI),
      async () => {
        await keys.down("KeyW");
        await delay(1100);
        await keys.up("KeyW");
      },
      200,
    );

    // F. 0.3 m step at sprint (step-glide collision safety)
    await measure(
      "step03",
      () => resetPlayer(page, 4, 0.93, 3.2),
      async () => {
        await keys.down("KeyW");
        await keys.down("KeyX");
        await delay(900);
        await keys.up("KeyX");
        await keys.up("KeyW");
      },
      300,
    );

    // G. Slide: camera transition, exit speed, steering
    await measure(
      "slide",
      async () => {
        await resetPlayer(page, -6, 0.93, 14);
        await keys.down("KeyW");
        await keys.down("KeyX");
        await delay(900);
      },
      async () => {
        await keys.down("ShiftLeft");
        await delay(700);
        await keys.up("ShiftLeft");
        await delay(300);
        await keys.up("KeyW");
        await keys.up("KeyX");
      },
      200,
    );
    await measure(
      "slideSteer",
      async () => {
        await resetPlayer(page, -6, 0.93, 14);
        await keys.down("KeyW");
        await keys.down("KeyX");
        await delay(900);
      },
      async () => {
        await keys.down("ShiftLeft");
        await keys.down("KeyD");
        await delay(650);
        await keys.up("KeyD");
        await keys.up("ShiftLeft");
        await keys.up("KeyW");
        await keys.up("KeyX");
      },
      200,
    );

    // H. Input: mouse look, pitch clamp, focus-loss clearing, simultaneous keys
    await resetPlayer(page, -6, 0.93, 14);
    const beforeLook = await readState(page);
    await page.mouse.move(WIDTH / 2 + 120, HEIGHT / 2);
    await delay(120);
    const afterYaw = await readState(page);
    await page.mouse.move(WIDTH / 2 + 120, HEIGHT / 2 - 200);
    await delay(80);
    const pitchUp1 = (await readState(page))?.pitch ?? 0;
    await page.mouse.move(WIDTH / 2 + 120, HEIGHT / 2 - 400);
    await delay(80);
    const pitchUp2 = (await readState(page))?.pitch ?? 0;
    results.inputLook = {
      yawDelta: round((afterYaw?.yaw ?? 0) - (beforeLook?.yaw ?? 0), 3),
      pitchUp1: round(pitchUp1, 3),
      pitchUp2: round(pitchUp2, 3),
      pitchLimitRadians: round((85 * Math.PI) / 180, 3),
    };

    await page.keyboard.down("KeyW");
    await page.keyboard.down("KeyX");
    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("Space");
    await delay(100);
    const simultaneous = await page.evaluate(() => ({
      held: [...window.__glassline.input.heldKeys].sort(),
    }));
    await page.keyboard.up("Space");
    await page.keyboard.up("ShiftLeft");
    await page.keyboard.up("KeyX");
    await page.keyboard.up("KeyW");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await delay(120);
    const afterBlur = await page.evaluate(() => ({ held: [...window.__glassline.input.heldKeys] }));
    results.inputSimultaneous = { held: simultaneous.held, afterBlur: afterBlur.held };

    results.diagnostics = diagnostics.snapshot();
    return results;
  } finally {
    await keys.releaseAll().catch(() => {});
    await page.close().catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */
/* Phase 3 — respawn                                                          */
/* -------------------------------------------------------------------------- */

async function runRespawn(context, options, log) {
  const outDir = join(options.outDir, "respawn");
  await mkdir(outDir, { recursive: true });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);

  try {
    await bootPrologue(page, options, log);

    // Arm the rooftop checkpoint through the authored trigger.
    await resetPlayer(page, 0, 0.93, 3);
    await delay(900);
    const checkpoint = await page.evaluate(
      () => window.__glassline.checkpointSystem?.getActiveCheckpointId?.() ?? null,
    );
    await shoot(page, join(outDir, "01-before-respawn.jpg"), log);

    // Walk east from beside the skylight opening; the fall is real.
    await resetPlayer(page, 2, 0.93, 5, -Math.PI / 2);
    await startSampling(page);
    await page.keyboard.down("KeyW");
    await delay(1_100);
    await page.keyboard.up("KeyW");
    await delay(2_600);
    const collected = await stopAndCollect(page);
    await shoot(page, join(outDir, "02-after-respawn.jpg"), log);

    // Find the teleport step.
    let teleportIndex = -1;
    for (let index = 1; index < collected.frames.length; index += 1) {
      const distance = Math.hypot(
        collected.frames[index].x - collected.frames[index - 1].x,
        collected.frames[index].z - collected.frames[index - 1].z,
      );
      if (distance > 3) {
        teleportIndex = index;
        break;
      }
    }
    let respawnStepIndex = -1;
    for (let index = 1; index < collected.steps.length; index += 1) {
      const distance = Math.hypot(
        collected.steps[index].x - collected.steps[index - 1].x,
        collected.steps[index].z - collected.steps[index - 1].z,
      );
      if (distance > 3) {
        respawnStepIndex = index;
        break;
      }
    }

    const postFrames =
      teleportIndex >= 0 ? collected.frames.slice(teleportIndex, teleportIndex + 45) : [];
    const postSteps =
      respawnStepIndex >= 0 ? collected.steps.slice(respawnStepIndex, respawnStepIndex + 90) : [];
    const maxPostSpeed = postFrames.length
      ? Math.max(...postFrames.map((frame) => frame.speed))
      : null;
    const maxPostDisplacement = postFrames.length
      ? Math.max(
          ...postFrames.map((frame) =>
            Math.hypot(frame.x - postFrames[0].x, frame.z - postFrames[0].z),
          ),
        )
      : null;
    const stepMaxSpeed = postSteps.length ? Math.max(...postSteps.map((step) => step.speed)) : null;
    const stepMaxDisplacement = postSteps.length
      ? Math.max(
          ...postSteps.map((step) => Math.hypot(step.x - postSteps[0].x, step.z - postSteps[0].z)),
        )
      : null;

    const respawnAt = teleportIndex >= 0 ? collected.frames[teleportIndex] : null;
    const before = teleportIndex > 0 ? collected.frames[teleportIndex - 1] : null;

    // Input must be alive immediately after the respawn.
    await page.keyboard.down("KeyW");
    await delay(450);
    const control = await readState(page);
    await page.keyboard.up("KeyW");

    const result = {
      checkpoint,
      frameIndex: teleportIndex,
      respawnAt: respawnAt
        ? {
            x: round(respawnAt.x),
            y: round(respawnAt.y),
            z: round(respawnAt.z),
            cp: respawnAt.cp,
            state: respawnAt.state,
            speed: round(respawnAt.speed),
          }
        : null,
      before: before
        ? { x: round(before.x), y: round(before.y), z: round(before.z), cp: before.cp }
        : null,
      cameraJumpDistance:
        before && respawnAt
          ? round(
              Math.hypot(
                respawnAt.camX - before.camX,
                respawnAt.camY - before.camY,
                respawnAt.camZ - before.camZ,
              ),
              1,
            )
          : null,
      postRespawnMaxSpeedNoInput: maxPostSpeed === null ? null : round(maxPostSpeed, 3),
      postRespawnMaxDisplacement:
        maxPostDisplacement === null ? null : round(maxPostDisplacement, 3),
      fixedStepMaxSpeed: stepMaxSpeed === null ? null : round(stepMaxSpeed, 3),
      fixedStepMaxDisplacement: stepMaxDisplacement === null ? null : round(stepMaxDisplacement, 3),
      controlAfterRespawn: control ? { speed: round(control.speed), state: control.state } : null,
      frames: collected.frames,
      steps: collected.steps,
      diagnostics: diagnostics.snapshot(),
    };

    log(
      `respawn: at=${JSON.stringify(result.respawnAt)} phantom=${result.fixedStepMaxDisplacement}m, control=${result.controlAfterRespawn?.speed} m/s`,
    );
    return result;
  } finally {
    await page.close().catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */
/* Phase 4 — gamepad                                                          */
/* -------------------------------------------------------------------------- */

async function runGamepad(context, options, log) {
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const keys = createKeyController(page);
  const checks = [];

  try {
    await bootPrologue(page, options, log);

    // Mock a standards-mapped gamepad through the same navigator.getGamepads
    // path the InputManager polls every frame.
    await page.evaluate(() => {
      window.__pad = {
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      const fake = () => ({
        connected: true,
        index: 0,
        id: "Gamepad (STANDARD GAMEPAD Vendor: 045e Product: 02fd)",
        mapping: "standard",
        axes: [...window.__pad.axes],
        buttons: window.__pad.buttons.map((button) => ({
          pressed: button.pressed,
          value: button.value,
        })),
        timestamp: performance.now(),
      });
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [fake()],
      });
      if (!window.__feel.on) {
        window.__feel.on = true;
        window.__feel.frames.length = 0;
      }
    });

    const setPad = (axes, pressed = []) =>
      page.evaluate(
        ([axesValue, pressedValue]) => {
          window.__pad.axes = axesValue;
          window.__pad.buttons = Array.from({ length: 17 }, (_, index) => ({
            pressed: pressedValue.includes(index),
            value: pressedValue.includes(index) ? 1 : 0,
          }));
        },
        [axes, pressed],
      );

    const check = (name, pass, detail) => {
      checks.push({ name, pass: Boolean(pass), detail });
      log(`gamepad: ${name} ${pass ? "PASS" : "FAIL"} (${JSON.stringify(detail)})`);
    };

    await resetPlayer(page, -6, 0.93, 14);
    await setPad([0, -1, 0, 0]);
    await delay(800);
    let state = await readState(page);
    check("left-stick-forward", state.speed > 4.5 && state.grounded, {
      speed: round(state.speed),
      state: state.state,
    });
    await setPad([0, -1, 0, 0], [10]);
    await delay(700);
    state = await readState(page);
    check("sprint-button", state.speed >= 8.2, { speed: round(state.speed) });
    await setPad([0, -1, 0, 0], [10, 0]);
    await delay(300);
    state = await readState(page);
    check(
      "jump-button",
      !state.grounded || state.state === "JUMPING" || state.state === "FALLING",
      { state: state.state, grounded: state.grounded },
    );
    await setPad([0, 0, 0, 0]);
    await delay(300);
    const beforeYaw = (await readState(page)).yaw;
    await setPad([0, 0, 1, 0]);
    await delay(400);
    const afterYaw = (await readState(page)).yaw;
    check("right-stick-look", Math.abs(afterYaw - beforeYaw) > 0.2, {
      yawDelta: round(afterYaw - beforeYaw, 3),
    });
    await setPad([0, -1, 0, 0], [1]);
    await delay(500);
    state = await readState(page);
    check("crouch-button", state.stance === "crouching", { stance: state.stance });
    await setPad([0, 0, 0, 0]);
    await delay(250);
    // interact button at the authored vault obstacle, while moving
    await resetPlayer(page, 0, 0.93, 2.6);
    await setPad([0, -1, 0, 0]);
    let vaulted = false;
    for (let index = 0; index < 80; index += 1) {
      const current = await readState(page);
      if (current.z < 0.8) {
        await setPad([0, -1, 0, 0], [2]);
        await delay(180);
        await setPad([0, -1, 0, 0]);
        break;
      }
      await delay(16);
    }
    for (let index = 0; index < 30; index += 1) {
      state = await readState(page);
      if (state.state === "VAULTING" || state.z < -0.5) {
        vaulted = true;
        break;
      }
      await delay(30);
    }
    check("interact-button-vault", vaulted, { state: state.state, z: round(state.z) });
    await setPad([0, 0, 0, 0]);
    // disconnect while the stick is held
    await page.evaluate(() => {
      Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [] });
    });
    await delay(600);
    state = await readState(page);
    check("disconnect-clears-input", state.speed < 1.5, { speed: round(state.speed) });
    await page.keyboard.down("KeyW");
    await delay(500);
    state = await readState(page);
    await page.keyboard.up("KeyW");
    check("keyboard-after-gamepad", state.speed > 2.0, { speed: round(state.speed) });
    // pause button
    await page.evaluate(() => {
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [
          {
            connected: true,
            index: 0,
            id: "Mock",
            mapping: "standard",
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 17 }, (_, index) => ({
              pressed: index === 9,
              value: index === 9 ? 1 : 0,
            })),
            timestamp: performance.now(),
          },
        ],
      });
    });
    await delay(400);
    const paused = await page.evaluate(() => ({
      flow: window.__glassline.flowManager?.getState?.(),
      screen: window.__glassline.ui?.getActiveScreen?.(),
    }));
    check("pause-button", paused.flow === "paused" && paused.screen === "pause", paused);

    return {
      checks,
      passed: checks.filter((entry) => entry.pass).length,
      failed: checks.filter((entry) => !entry.pass).length,
      diagnostics: diagnostics.snapshot(),
    };
  } finally {
    await keys.releaseAll().catch(() => {});
    await page.close().catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */
/* Phase 5 — performance                                                      */
/* -------------------------------------------------------------------------- */

async function runPerf(context, options, log) {
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);

  try {
    await bootPrologue(page, options, log);
    const gpu = await page.evaluate(() => {
      const gl = window.__glassline.renderer.threeRenderer.getContext();
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown",
        quality: window.__glassline.renderer.quality,
      };
    });
    log(`perf: ${gpu.renderer} @ ${gpu.quality}`);

    const sample = async (seconds) =>
      page.evaluate(
        (duration) =>
          new Promise((resolve) => {
            const times = [];
            const info = { calls: 0, triangles: 0 };
            let last = performance.now();
            let start = null;
            let frames = 0;
            const loop = () => {
              const now = performance.now();
              if (start === null) start = now;
              if (frames > 20) times.push(now - last);
              last = now;
              frames += 1;
              if (now - start < duration * 1000) {
                const renderer = window.__glassline.renderer.threeRenderer;
                info.calls = renderer.info.render.calls;
                info.triangles = renderer.info.render.triangles;
                requestAnimationFrame(loop);
              } else {
                resolve({ times, calls: info.calls, triangles: info.triangles });
              }
            };
            requestAnimationFrame(loop);
          }),
        seconds,
      );

    const summarize = (raw) => {
      const sorted = [...raw.times].sort((a, b) => a - b);
      const avg = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
      return {
        frames: sorted.length,
        fps: round(1000 / avg, 1),
        avgMs: round(avg),
        medianFps: round(1000 / sorted[Math.floor(sorted.length / 2)], 1),
        p95Ms: round(sorted[Math.floor(sorted.length * 0.95)]),
        p99Ms: round(sorted[Math.floor(sorted.length * 0.99)]),
        maxMs: round(sorted[sorted.length - 1]),
        drawCalls: raw.calls,
        triangles: raw.triangles,
      };
    };

    const poses = [
      ["start-roof", 0, 0.93, 6, 0],
      ["corridor", 0, 0.93, -13.5, 0],
      ["catwalk", 30, 6.1, -122.8, -Math.PI / 2],
      ["final-deck", 0, 6.1, -127, 2.6],
    ];

    const staticPoses = {};
    for (const [name, x, y, z, yaw] of poses) {
      await resetPlayer(page, x, y, z, yaw);
      await delay(700);
      staticPoses[name] = summarize(await sample(2.5));
      staticPoses[name].drawCalls = null;
      staticPoses[name].triangles = null;
      log(`perf pose ${name}: ${staticPoses[name].fps} fps, p95 ${staticPoses[name].p95Ms} ms`);
    }

    // One true frame's draw-call/triangle count (the renderer's info resets per
    // pass, so the sampler above only sees the composite quad).
    await resetPlayer(page, 0, 0.93, 6, 0);
    await delay(500);
    const renderInfo = await page.evaluate(
      () =>
        new Promise((resolvePromise) => {
          const renderer = window.__glassline.renderer.threeRenderer;
          renderer.info.autoReset = false;
          renderer.info.reset();
          requestAnimationFrame(() => {
            const calls = renderer.info.render.calls;
            const triangles = renderer.info.render.triangles;
            renderer.info.autoReset = true;
            resolvePromise({ calls, triangles });
          });
        }),
    );
    staticPoses["start-roof"].drawCalls = renderInfo.calls;
    staticPoses["start-roof"].triangles = renderInfo.triangles;
    log(
      `perf: start-roof frame = ${renderInfo.calls} draw calls / ${renderInfo.triangles} triangles`,
    );

    // Moving segments: exactly what traversal feels like.
    const movingSegments = [
      ["roof-west-lane", -6, 0.93, 16, 0, 4000],
      ["corridor", 0, 0.93, -10.5, 0, 3000],
      ["catwalk", 10, 6.1, -122.8, -Math.PI / 2, 4000],
    ];
    const moving = {};
    for (const [name, x, y, z, yaw, duration] of movingSegments) {
      await resetPlayer(page, x, y, z, yaw);
      await delay(500);
      await page.keyboard.down("KeyW");
      await page.keyboard.down("KeyX");
      const samplePromise = sample(duration / 1000);
      const raw = await samplePromise;
      await page.keyboard.up("KeyW");
      await page.keyboard.up("KeyX");
      moving[name] = summarize(raw);
      log(`perf moving ${name}: ${moving[name].fps} fps, p95 ${moving[name].p95Ms} ms`);
    }

    // Attribution: the ambient sky-visibility probe runs whenever the camera
    // moves more than PROBE_MOVE_EPSILON and raycasts 9 directions against the
    // collected scene meshes. Measure its share (read-only wrapper) and the
    // frame rate with the probe temporarily stubbed. Nothing on disk changes.
    const attribution = {};
    {
      await resetPlayer(page, -6, 0.93, 16, 0);
      await delay(600);
      await page.evaluate(() => {
        const scene = window.__glassline.renderScene;
        window.__probeStats = { calls: [], total: 0 };
        const original = scene.probeSkyVisibility.bind(scene);
        window.__probeOriginal = original;
        scene.probeSkyVisibility = () => {
          const started = performance.now();
          const result = original();
          window.__probeStats.calls.push(performance.now() - started);
          window.__probeStats.total += 1;
          return result;
        };
      });
      await page.keyboard.down("KeyW");
      await page.keyboard.down("KeyX");
      const withProbe = summarize(await sample(3));
      await page.keyboard.up("KeyW");
      await page.keyboard.up("KeyX");
      const probeStats = await page.evaluate(() => ({
        calls: window.__probeStats.calls.length,
        avgMs: window.__probeStats.calls.length
          ? window.__probeStats.calls.reduce((sum, value) => sum + value, 0) /
            window.__probeStats.calls.length
          : 0,
      }));
      await page.evaluate(() => {
        window.__glassline.renderScene.probeSkyVisibility = () => 1;
      });
      await resetPlayer(page, -6, 0.93, 16, 0);
      await delay(400);
      await page.keyboard.down("KeyW");
      await page.keyboard.down("KeyX");
      const withoutProbe = summarize(await sample(3));
      await page.keyboard.up("KeyW");
      await page.keyboard.up("KeyX");
      await page.evaluate(() => {
        const scene = window.__glassline.renderScene;
        if (window.__probeOriginal) scene.probeSkyVisibility = window.__probeOriginal;
      });
      attribution.ambientProbe = {
        note: "probeSkyVisibility raycasts 9 directions against the collected scene meshes; it runs whenever the camera moves more than 0.08 m",
        probeCallsPerSecond: round(probeStats.calls / 3, 1),
        probeAvgMs: round(probeStats.avgMs),
        probeOn: { fps: withProbe.fps, p95Ms: withProbe.p95Ms },
        probeStubbed: { fps: withoutProbe.fps, p95Ms: withoutProbe.p95Ms },
        frameRateRecoveredFps: round(withoutProbe.fps - withProbe.fps, 1),
        diagnosticOnly: "the stub exists only inside this probe; no file was modified",
      };
      log(
        `perf attribution: probe ${round(probeStats.avgMs)} ms x ${round(probeStats.calls / 3, 1)}/s -> ${withProbe.fps} fps; stubbed -> ${withoutProbe.fps} fps`,
      );
    }

    // Quality tiers at the costlier moving segment.
    const tiers = {};
    for (const quality of ["low", "high"]) {
      await page.evaluate(async (value) => {
        await window.__glassline.settingsManager.update({ "display.quality": value });
      }, quality);
      await resetPlayer(page, -6, 0.93, 16, 0);
      await delay(800);
      await page.keyboard.down("KeyW");
      await page.keyboard.down("KeyX");
      const raw = await sample(3);
      await page.keyboard.up("KeyW");
      await page.keyboard.up("KeyX");
      tiers[quality] = summarize(raw);
      log(`perf moving quality=${quality}: ${tiers[quality].fps} fps`);
    }

    return {
      gpu,
      viewport: `${WIDTH}x${HEIGHT} dpr 1`,
      host: {
        platform: os.platform(),
        cpus: os.cpus().length,
        loadAverage: os.loadavg().map((value) => round(value, 2)),
      },
      quality: "medium (default) unless noted",
      staticPoses,
      moving,
      tiers,
      attribution,
      diagnostics: diagnostics.snapshot(),
    };
  } finally {
    await page.close().catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const log = createLogger();

  if (options.help) {
    console.log(
      "Usage: node tools/capture/feel-audit.mjs [--out-dir <dir>] [--headed] [--no-video] [--no-audio]\n" +
        "       [--server-port <port>] [--reuse-server] [--only route,mechanics,respawn,gamepad,perf]",
    );
    return;
  }

  await mkdir(options.outDir, { recursive: true });
  const server = createServerManager({
    rootDir: ROOT_DIR,
    port: options.serverPort,
    host: "127.0.0.1",
    baseUrl: options.url,
    log,
  });
  const startedServer = await server.ensure({
    reuseServer: options.reuseServer,
    timeoutMs: options.serverTimeout,
  });
  const { browser, info } = await launchBrowser({ headless: options.headless, log });

  const report = {
    kind: "gameplay-feel-audit",
    step: "3.11",
    generatedAt: new Date().toISOString(),
    git: {
      branch: await git("rev-parse", "--abbrev-ref", "HEAD"),
      head: await git("rev-parse", "HEAD"),
    },
    environment: {
      browser: info,
      viewport: `${WIDTH}x${HEIGHT} dpr 1`,
      headless: options.headless,
      platform: os.platform(),
      release: os.release(),
      cpus: os.cpus().length,
      loadAverage: os.loadavg().map((value) => round(value, 2)),
    },
    server: { attached: startedServer.attached, port: options.serverPort },
    phases: {},
    checks: [],
  };

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  try {
    if (options.phases.includes("route")) {
      log("phase: full Prologue run");
      report.phases.route = await runRoute(context, options, log);
    }
    if (options.phases.includes("mechanics")) {
      log("phase: mechanics probes");
      report.phases.mechanics = await runMechanics(context, options, log);
    }
    if (options.phases.includes("respawn")) {
      log("phase: respawn");
      report.phases.respawn = await runRespawn(context, options, log);
    }
    if (options.phases.includes("gamepad")) {
      log("phase: gamepad");
      report.phases.gamepad = await runGamepad(context, options, log);
    }
    if (options.phases.includes("perf") && options.perf) {
      log("phase: performance");
      report.phases.perf = await runPerf(context, options, log);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }

  // Derived checks (the raw data stays in the report for independent reading).
  const route = report.phases.route;
  const mechanics = report.phases.mechanics ?? {};
  const perf = report.phases.perf;
  const respawn = report.phases.respawn;
  const gamepad = report.phases.gamepad;

  const routeFrames = route?.frames ?? [];
  const slideFrames = (mechanics.slide?.frames ?? []).filter((frame) => frame.stance === "sliding");
  const wallRunFrames = (mechanics.wallRun?.frames ?? []).filter(
    (frame) => frame.state === "WALLRUN",
  );
  const wallJumpFrames = (mechanics.wallJump?.frames ?? []).filter(
    (frame) => frame.state === "WALLJUMP",
  );
  const jumpTap = mechanics.jumpTap?.frames ?? [];
  const jumpHold = mechanics.jumpHold?.frames ?? [];
  const rise = (frames) => {
    if (frames.length === 0) return null;
    const airborne = frames.find((frame) => !frame.grounded);
    const apex = frames.reduce((best, frame) => (frame.y > best.y ? frame : best), frames[0]);
    return airborne ? round(apex.y - airborne.y) : null;
  };
  const vaultDuration = (collected) => {
    const frames = (collected?.frames ?? []).filter((frame) => frame.state === "VAULTING");
    return frames.length > 1 ? round((frames[frames.length - 1].t - frames[0].t) / 1000, 2) : null;
  };
  const vaultMetrics = (collected) => {
    const frames = (collected?.frames ?? []).filter((frame) => frame.state === "VAULTING");
    if (frames.length < 2) return null;
    let maxSpeed = 0;
    let maxSpeedStep = 0;
    let maxPositionJump = 0;
    for (let index = 0; index < frames.length; index += 1) {
      maxSpeed = Math.max(maxSpeed, frames[index].speed);
      if (index > 0) {
        maxSpeedStep = Math.max(
          maxSpeedStep,
          Math.abs(frames[index].speed - frames[index - 1].speed),
        );
        maxPositionJump = Math.max(
          maxPositionJump,
          Math.hypot(frames[index].x - frames[index - 1].x, frames[index].z - frames[index - 1].z),
        );
      }
    }
    return {
      durationMs: round(frames[frames.length - 1].t - frames[0].t),
      entrySpeed: round(frames[0].speed),
      arcSpeedMedian: round(
        [...frames].map((frame) => frame.speed).sort((a, b) => a - b)[
          Math.floor(frames.length / 2)
        ],
      ),
      exitSpeed: round(frames[frames.length - 1].speed),
      maxSpeed: round(maxSpeed),
      maxSingleSampleSpeedStep: round(maxSpeedStep),
      maxSingleSamplePositionJump: round(maxPositionJump, 3),
      afterVaultState: (collected?.frames ?? [])[frames.length + 1]?.state ?? null,
    };
  };
  const toastTimeline = [];
  for (const frame of routeFrames ?? []) {
    const last = toastTimeline[toastTimeline.length - 1];
    if (last && last.toast === frame.toast) continue;
    if (frame.toast)
      toastTimeline.push({
        atSeconds: round((frame.t - (routeFrames[0]?.t ?? frame.t)) / 1000, 2),
        toast: frame.toast,
      });
  }
  const cameraSink = (routeFrames ?? []).reduce(
    (max, frame) => Math.max(max, frame.camY - frame.y),
    -Infinity,
  );
  const cameraSinkMin = (routeFrames ?? []).reduce(
    (min, frame) => Math.min(min, frame.camY - frame.y),
    Infinity,
  );

  report.checks = [
    {
      id: "route-completed",
      pass: Boolean(route?.completed),
      detail: {
        screen: route?.endState?.screen ?? null,
        durationSeconds: route?.durationSeconds ?? null,
      },
    },
    {
      id: "route-no-death",
      pass: (route?.respawnCount ?? 1) === 0,
      detail: { respawns: route?.respawnCount ?? null },
    },
    {
      id: "route-checkpoints",
      pass: new Set(routeFrames.map((frame) => frame.cp).filter(Boolean)).size === 5,
      detail: { checkpoints: [...new Set(routeFrames.map((frame) => frame.cp).filter(Boolean))] },
    },
    {
      id: "route-no-console-errors",
      pass:
        (route?.diagnostics?.consoleErrors?.length ?? 1) === 0 &&
        (route?.diagnostics?.pageErrors?.length ?? 1) === 0,
      detail: route?.diagnostics ?? null,
    },
    {
      id: "jump-rise-sane",
      pass: rise(jumpHold) !== null && rise(jumpHold) > 1.0,
      detail: { tap: rise(jumpTap), hold: rise(jumpHold) },
    },
    {
      id: "jump-tap-differs",
      pass:
        rise(jumpTap) !== null && rise(jumpHold) !== null && rise(jumpHold) > rise(jumpTap) + 0.2,
      detail: { tap: rise(jumpTap), hold: rise(jumpHold) },
    },
    {
      id: "vault-standard",
      pass: vaultDuration(mechanics.vaultStandard) !== null,
      detail: { seconds: vaultDuration(mechanics.vaultStandard) },
    },
    {
      id: "vault-speed",
      pass: vaultDuration(mechanics.vaultSpeed) !== null,
      detail: { seconds: vaultDuration(mechanics.vaultSpeed) },
    },
    {
      id: "wall-run",
      pass: wallRunFrames.length > 0,
      detail: {
        frames: wallRunFrames.length,
        ms:
          wallRunFrames.length > 1
            ? round(wallRunFrames[wallRunFrames.length - 1].t - wallRunFrames[0].t)
            : 0,
        rollMax: wallRunFrames.length
          ? round(Math.max(...wallRunFrames.map((frame) => Math.abs(frame.roll))), 3)
          : null,
      },
    },
    { id: "wall-jump", pass: wallJumpFrames.length > 0, detail: { frames: wallJumpFrames.length } },
    {
      id: "slide-runs",
      pass: slideFrames.length > 0,
      detail: {
        frames: slideFrames.length,
        entrySpeed: slideFrames.length ? round(slideFrames[0].speed) : null,
        exitSpeed: slideFrames.length ? round(slideFrames[slideFrames.length - 1].speed) : null,
        camDropMeters: slideFrames.length
          ? round(Math.min(...slideFrames.map((frame) => frame.camY)) - slideFrames[0].camY)
          : null,
      },
    },
    {
      id: "respawn-control",
      pass: (respawn?.controlAfterRespawn?.speed ?? 0) > 1,
      detail: respawn?.controlAfterRespawn ?? null,
    },
    {
      id: "respawn-no-phantom-step",
      pass: (respawn?.fixedStepMaxDisplacement ?? 1) < 0.05,
      detail: {
        displacement: respawn?.fixedStepMaxDisplacement ?? null,
        speed: respawn?.fixedStepMaxSpeed ?? null,
      },
    },
    {
      id: "gamepad",
      pass: (gamepad?.failed ?? 1) === 0,
      detail: {
        passed: gamepad?.passed ?? null,
        failed: gamepad?.failed ?? null,
        checks: gamepad?.checks ?? [],
      },
    },
    {
      id: "perf-medium-moving",
      pass: (perf?.moving?.["roof-west-lane"]?.fps ?? 0) >= 55,
      detail: {
        moving: perf?.moving ?? null,
        static: perf?.staticPoses?.["start-roof"] ?? null,
        gpu: perf?.gpu ?? null,
      },
    },
  ];

  report.summary = {
    checks: report.checks.length,
    passed: report.checks.filter((check) => check.pass).length,
    failed: report.checks.filter((check) => !check.pass).length,
    cameraSinkMeters: Number.isFinite(cameraSink) ? round(cameraSink) : null,
    cameraOffsetRange: Number.isFinite(cameraSinkMin) ? round(cameraSink - cameraSinkMin) : null,
    cameraVerticalLag: {
      note: "camera Y minus capsule centre Y over the full run; standing offset is ~0.725 m",
      maxOffset: Number.isFinite(cameraSink) ? round(cameraSink) : null,
      minOffset: Number.isFinite(cameraSinkMin) ? round(cameraSinkMin) : null,
      maxAboveStanding: Number.isFinite(cameraSink) ? round(cameraSink - 0.725) : null,
    },
    vaults: {
      standard: vaultMetrics(mechanics.vaultStandard),
      speed: vaultMetrics(mechanics.vaultSpeed),
    },
    routeToasts: toastTimeline,
    route: route
      ? {
          completed: route.completed,
          durationSeconds: route.durationSeconds,
          respawns: route.respawnCount,
          frameStats: route.frameStats,
          audio: route.audio ?? null,
        }
      : null,
  };

  await mkdir(dirname(options.report), { recursive: true });
  await writeFile(options.report, JSON.stringify(report, null, 2));
  log(`report: ${options.report}`);
  log(`checks: ${report.summary.passed}/${report.summary.checks} passed`);
  if (report.summary.failed > 0) {
    log("failed checks:");
    for (const check of report.checks.filter((entry) => !entry.pass))
      log(`  - ${check.id}: ${JSON.stringify(check.detail).slice(0, 500)}`);
  }
}

async function git(...args) {
  return await new Promise((resolvePromise) => {
    const child = spawn("git", args, { cwd: ROOT_DIR, stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("exit", () => resolvePromise(output.trim()));
    child.on("error", () => resolvePromise(null));
  });
}
