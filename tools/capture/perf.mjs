#!/usr/bin/env node
/**
 * FPS / perf probe for Glassline.
 *
 * Runs the same deterministic capture boot as `capture.mjs`
 * (`?capture=1&level=prologue&shot=<id>`, 1600x900 dpr 1, quality high) but,
 * instead of writing a PNG, measures frame pacing:
 *
 *   1. wait for `window.__glasslineCapture.ready`;
 *   2. apply the pose, discard `--warmup` requestAnimationFrame frames;
 *   3. record the timestamps of `--frames` consecutive rAF callbacks in-page;
 *   4. derive avg/median fps, p95 frame time and the "1 % low" (99th percentile
 *      frame time) from the deltas, keep the raw array;
 *   5. read `__glasslineCapture.stats()` (draw calls, triangles, programs, ...)
 *      plus browser/GPU strings for the report.
 *
 * Per-shot JSON lands in `captures/perf-<iteration>/<id>.json`; a summary table
 * is printed to stdout. `--strict` turns "avg fps below --min-fps" into exit 1.
 *
 * Headless Edge on macOS is a proxy, not a real window: frame pacing is capped
 * and may be software-rendered, so treat these numbers as a regression probe.
 * The JSON records `environment: "headless-edge"` to keep that caveat attached.
 *
 * Usage:
 *   node tools/capture/perf.mjs --shot all --iteration baseline-perf
 *   node tools/capture/perf.mjs --shot start-roof --strict --min-fps 55
 *
 * No commits, no browser downloads: Playwright and system Edge are expected to
 * be installed already.
 */

import { writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { attachDiagnostics, launchBrowser } from "./lib/browser-session.mjs";
import {
  applyShot,
  buildCaptureUrl,
  CaptureModeError,
  readPageViewport,
  readShotIds,
  readStats,
  waitForCaptureReady,
  waitSettleFrames,
} from "./lib/capture-mode.mjs";
import {
  DEFAULT_HEIGHT,
  DEFAULT_READY_TIMEOUT_MS,
  DEFAULT_SERVER_TIMEOUT_MS,
  DEFAULT_WIDTH,
  UsageError,
} from "./lib/cli.mjs";
import * as evidence from "./lib/evidence.mjs";
import { createServerManager } from "./lib/vite-server.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Dedicated port: capture.mjs owns 5199 (and route harnesses use 5301-5303). */
const DEFAULT_SERVER_PORT = 5310;
const DEFAULT_ITERATION = "perf";
const DEFAULT_LEVEL = "prologue";
const DEFAULT_FRAMES = 300;
const DEFAULT_WARMUP = 120;
const DEFAULT_MIN_FPS = 55;
/** Frames rendered after apply() before the warmup starts (pose settle). */
const SETTLE_FRAMES = 5;
/** The hard measurement cap is derived from the frame budget below (25 fps worst case). */
const MEASUREMENT_FRAME_BUDGET_MS = 40;
const MEASUREMENT_TIMEOUT_FLOOR_MS = 30_000;
const MEASUREMENT_TIMEOUT_MARGIN_MS = 5_000;
const MAX_MEASUREMENT_TIMEOUT_MS = 180_000;
/**
 * Teardown grace periods. A renderer wedged by an infinite loop must not make the
 * probe hang: a perf run is worthless if it cannot finish and release the port.
 */
const CONTEXT_CLOSE_TIMEOUT_MS = 12_000;
const BROWSER_CLOSE_TIMEOUT_MS = 30_000;
/** Transient failures (HMR reload, renderer crash) get a fresh Edge, not a failed run. */
const MAX_SHOT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_500;
const QUALITY = "high";

/** Plan §6 fallback list, used only when shot discovery without ?shot fails. */
const DEFAULT_SHOT_IDS = [
  "start-roof",
  "first-gap",
  "wallrun-corridor",
  "service-block",
  "skybridge",
  "finish-roof",
];

const HELP_LINES = [
  "Usage:",
  "  node tools/capture/perf.mjs [options]",
  "",
  "FPS/perf probe for the deterministic capture poses (headless Edge).",
  "",
  "  --shot <id|all>        Shot id from window.__glasslineCapture.shots, or all (default all)",
  "  --iteration <id>       Output folder captures/perf-<id>/ (default perf)",
  "  --level <id>           Level query parameter (default prologue)",
  "  --frames <n>           Measured rAF frames after warmup (default 300)",
  "  --warmup <n>           Discarded warmup rAF frames (default 120)",
  "  --min-fps <n>          Threshold used by the pass/fail column (default 55)",
  "  --strict               Exit 1 when a shot's avg fps is below --min-fps (report-only otherwise)",
  "  --json <path>          Also write the run-summary JSON to <path>",
  "",
  "Server and browser:",
  "  --server-port <port>   Vite port (default 5310; capture.mjs uses 5199)",
  "  --url <url>            Base URL (default http://127.0.0.1:<server-port>/)",
  "  --reuse-server         Never spawn Vite; fail unless something serves --url",
  "  --headless             Run Edge headless (default)",
  "  --headed               Run Edge with a visible window",
  "  --width <px>           Viewport width (default 1600)",
  "  --height <px>          Viewport height (default 900)",
  "  --ready-timeout <ms>   Wait budget for the capture contract (default 60000)",
  "  --server-timeout <ms>  Wait budget for Vite readiness (default 90000)",
  "  --help                 Show this help",
  "",
  "Measurement: in-page requestAnimationFrame timestamps. avg/median fps, p95 frame",
  "time and 1% low (99p frame time) are derived from the deltas; the raw frame-time",
  "array and __glasslineCapture.stats() are stored per shot. Headless Edge frame",
  "pacing is capped/approximated, so read this as a regression probe rather than an",
  "absolute FPS claim for a real window.",
];

function createLogger() {
  const started = Date.now();

  return (message) => {
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[perf ${elapsed}s] ${message}`);
  };
}

function firstLine(text) {
  return String(text).split("\n")[0];
}

function fail(message) {
  throw new UsageError(message);
}

function readNumber(value, flag, { integer = false, min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    fail(`${flag} expects a finite number, got "${value}"`);
  }

  if (integer && !Number.isInteger(number)) {
    fail(`${flag} expects an integer, got "${value}"`);
  }

  if (number < min || number > max) {
    fail(`${flag} must be between ${min} and ${max}, got ${value}`);
  }

  return number;
}

function readId(value, flag) {
  const id = String(value ?? "").trim();

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    fail(`${flag} expects [A-Za-z0-9._-]+, got "${value}"`);
  }

  return id;
}

function parseArgs(argv) {
  const options = {
    help: false,
    iteration: DEFAULT_ITERATION,
    shot: "all",
    level: DEFAULT_LEVEL,
    frames: DEFAULT_FRAMES,
    warmup: DEFAULT_WARMUP,
    minFps: DEFAULT_MIN_FPS,
    strict: false,
    json: null,
    serverPort: DEFAULT_SERVER_PORT,
    url: null,
    reuseServer: false,
    headless: true,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    readyTimeout: DEFAULT_READY_TIMEOUT_MS,
    serverTimeout: DEFAULT_SERVER_TIMEOUT_MS,
  };

  let serverPortExplicit = false;

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    let flag = raw;
    let inlineValue = null;
    const equals = raw.indexOf("=");

    if (raw.startsWith("--") && equals !== -1) {
      flag = raw.slice(0, equals);
      inlineValue = raw.slice(equals + 1);
    }

    const value = (name = flag) => {
      if (inlineValue !== null) {
        return inlineValue;
      }

      const next = argv[index + 1];

      if (next === undefined) {
        fail(`${name} requires a value`);
      }

      index += 1;
      return next;
    };

    switch (flag) {
      case "--iteration":
        options.iteration = readId(value(), flag);
        break;
      case "--shot": {
        const shot = value();
        options.shot = shot === "all" ? "all" : readId(shot, flag);
        break;
      }
      case "--level":
        options.level = readId(value(), flag);
        break;
      case "--frames":
        options.frames = readNumber(value(), flag, { integer: true, min: 1, max: 3600 });
        break;
      case "--warmup":
        options.warmup = readNumber(value(), flag, { integer: true, min: 0, max: 3600 });
        break;
      case "--min-fps":
        options.minFps = readNumber(value(), flag, { min: 1, max: 1000 });
        break;
      case "--strict":
        options.strict = true;
        break;
      case "--json":
        options.json = value();
        break;
      case "--server-port":
      case "--port":
        options.serverPort = readNumber(value(), flag, { integer: true, min: 1, max: 65_535 });
        serverPortExplicit = true;
        break;
      case "--url":
        options.url = value();
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
        options.width = readNumber(value(), flag, { integer: true, min: 1, max: 8192 });
        break;
      case "--height":
        options.height = readNumber(value(), flag, { integer: true, min: 1, max: 8192 });
        break;
      case "--ready-timeout":
        options.readyTimeout = readNumber(value(), flag, { integer: true, min: 1000 });
        break;
      case "--server-timeout":
        options.serverTimeout = readNumber(value(), flag, { integer: true, min: 1000 });
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        fail(`Unknown argument: ${flag}`);
    }
  }

  if (options.help) {
    return options;
  }

  if (options.json !== null && options.json.trim() === "") {
    fail("--json must be a non-empty path");
  }

  if (options.url) {
    let parsed;

    try {
      parsed = new URL(options.url);
    } catch {
      fail(`--url is not a valid URL: ${options.url}`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      fail(`--url must be http(s), got ${parsed.protocol}`);
    }

    if (!serverPortExplicit && parsed.port) {
      options.serverPort = Number(parsed.port);
    }
  }

  options.viewport = { width: options.width, height: options.height };
  options.measurementTimeoutMs = Math.min(
    Math.max(
      MEASUREMENT_TIMEOUT_FLOOR_MS,
      (options.warmup + options.frames) * MEASUREMENT_FRAME_BUDGET_MS +
        MEASUREMENT_TIMEOUT_MARGIN_MS,
    ),
    MAX_MEASUREMENT_TIMEOUT_MS,
  );
  options.environment = options.headless ? "headless-edge" : "headed-edge";

  return options;
}

/** Linear-interpolated percentile over a sorted numeric array (0..1). */
function percentile(sorted, fraction) {
  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length === 1) {
    return sorted[0];
  }

  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = position - lower;

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

/**
 * Host load snapshot. A shared dev machine under load produces bimodal frame
 * times (16.7 ms / 33.4 ms = one skipped vsync) that look like scene regressions,
 * so the report keeps the load averages next to the numbers.
 */
function readHostInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    cpuCount: os.cpus().length,
    loadAvg: os.loadavg().map((value) => round(value, 2)),
  };
}

/**
 * Derives fps / frame-time statistics from the raw rAF deltas.
 *
 * avg fps = 1000 / mean(delta), median fps = 1000 / median(delta),
 * 1 % low = 1000 / p99(delta) — the frame rate of the slowest 1 % of frames.
 */
function computeFrameMetrics(frameTimes) {
  if (!Array.isArray(frameTimes) || frameTimes.length === 0) {
    throw new Error("no frame timestamps were measured");
  }

  const sorted = [...frameTimes].sort((left, right) => left - right);
  const total = frameTimes.reduce((sum, value) => sum + value, 0);
  const avg = total / frameTimes.length;
  const median = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);

  if (!(avg > 0) || !(median > 0) || !(p99 > 0)) {
    throw new Error(`frame deltas are degenerate: avg=${avg} median=${median} p99=${p99}`);
  }

  return {
    durationMs: round(total),
    frameTimeMs: {
      avg: round(avg),
      median: round(median),
      p95: round(p95),
      p99: round(p99),
      min: round(sorted[0]),
      max: round(sorted[sorted.length - 1]),
    },
    fps: {
      avg: round(1000 / avg),
      median: round(1000 / median),
      p1Low: round(1000 / p99),
    },
  };
}

/**
 * In-page measurement: discard `warmupFrames` rAF deltas, then record
 * `measuredFrames` deltas between consecutive `requestAnimationFrame` timestamps.
 * The deltas are the frame times; the app renders from its own rAF loop.
 */
async function measureFrameTimes(page, { warmupFrames, measuredFrames, timeoutMs }) {
  return page.evaluate(
    ({ warmupFrames, measuredFrames, timeoutMs }) =>
      new Promise((resolve, reject) => {
        const started = performance.now();
        const frameTimes = [];
        let warmupRemaining = warmupFrames;
        let previous = null;

        const tick = (timestamp) => {
          if (performance.now() - started > timeoutMs) {
            reject(
              new Error(
                `rAF measurement timed out after ${timeoutMs} ms (${frameTimes.length}/${measuredFrames} frames)`,
              ),
            );
            return;
          }

          if (previous !== null) {
            const delta = timestamp - previous;

            if (warmupRemaining > 0) {
              warmupRemaining -= 1;
            } else {
              frameTimes.push(delta);
            }
          }

          previous = timestamp;

          if (frameTimes.length >= measuredFrames) {
            resolve({ frameTimes, elapsedMs: timestamp - started });
            return;
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      }),
    { warmupFrames, measuredFrames, timeoutMs },
  );
}

/** Node-side guard in case rAF stops entirely and the in-page timer never fires. */
function withTimeout(promise, timeoutMs, message) {
  let timer = null;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
  });
}

/**
 * Runs `callback` with a fresh browser context and closes it afterwards. Teardown
 * is bounded: if the renderer is wedged (for example by a bad HMR update from a
 * concurrent edit), `context.close()` can wait forever, so the probe gives up on
 * the context and lets the browser-level close in `main` clean up.
 */
async function withProbePage(browser, viewport, log, callback) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  try {
    const page = await context.newPage();

    // Do not forward the Vite HMR websocket to the server: another agent saving a
    // file in src/ must not trigger a full-page reload in the middle of a
    // measurement (that invalidates the sample and looks like a harness hang).
    // Each shot still boots from the current on-disk tree over HTTP.
    await page.routeWebSocket(/^wss?:\/\/127\.0\.0\.1:\d+\//, () => {
      // Intentionally mocked: no server forwarding, no HMR reloads.
    });

    const diagnostics = attachDiagnostics(page);

    return await callback({ page, diagnostics });
  } finally {
    const closed = await withTimeout(
      context.close().then(() => true),
      CONTEXT_CLOSE_TIMEOUT_MS,
      "browser context close timed out",
    ).catch(() => false);

    if (!closed) {
      log(
        `WARNING: browser context did not close within ${CONTEXT_CLOSE_TIMEOUT_MS} ms; continuing`,
      );
    }
  }
}

/** Closes the browser with a bounded wait so a wedged renderer cannot hang the run. */
async function closeBrowserBounded(browser, log) {
  if (!browser) {
    return true;
  }

  const closed = await withTimeout(
    browser.close().then(() => true),
    BROWSER_CLOSE_TIMEOUT_MS,
    "browser close timed out",
  ).catch(() => false);

  if (!closed) {
    log(`WARNING: Edge did not close within ${BROWSER_CLOSE_TIMEOUT_MS} ms`);
  }

  return closed;
}

/** Reads the WebGL renderer strings; headless GPU vs SwiftShader matters here. */
async function readGpuInfo(page) {
  return page
    .evaluate(() => {
      const canvas = document.querySelector("canvas");

      if (!canvas) {
        return null;
      }

      for (const type of ["webgl2", "webgl"]) {
        let gl = null;

        try {
          gl = canvas.getContext(type);
        } catch {
          gl = null;
        }

        if (!gl) {
          continue;
        }

        const debug = gl.getExtension("WEBGL_debug_renderer_info");

        return {
          context: type,
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
          unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        };
      }

      return null;
    })
    .catch(() => null);
}

/** True for failures worth one more attempt on a fresh Edge process. */
function isRetryableProbeError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return /Execution context was destroyed|Target closed|Target crashed|has been closed|frame measurement for shot .* did not finish/.test(
    message,
  );
}

async function resolveShotIds({ browser, options, baseUrl, log }) {
  if (options.shot !== "all") {
    return [options.shot];
  }

  try {
    return await withProbePage(browser, options.viewport, log, async ({ page, diagnostics }) => {
      const url = buildCaptureUrl(baseUrl, { level: options.level, shot: null });

      await waitForCaptureReady(page, {
        url,
        timeoutMs: options.readyTimeout,
        log,
        diagnostics,
      });

      return readShotIds(page);
    });
  } catch (error) {
    log(`WARNING: could not discover the shot list without ?shot: ${firstLine(error.message)}`);
    log(`falling back to the plan list: ${DEFAULT_SHOT_IDS.join(", ")}`);

    return DEFAULT_SHOT_IDS;
  }
}

function validateProbe(probe, options) {
  const problems = [];

  if (
    probe.viewport.width !== options.viewport.width ||
    probe.viewport.height !== options.viewport.height
  ) {
    problems.push(
      `page viewport is ${probe.viewport.width}x${probe.viewport.height}, expected ${options.viewport.width}x${options.viewport.height}`,
    );
  }

  if (probe.viewport.devicePixelRatio !== 1) {
    problems.push(`devicePixelRatio is ${probe.viewport.devicePixelRatio}, expected 1`);
  }

  const stats = probe.stats ?? {};
  const canvas = stats.canvas;
  const canvasWidth = Array.isArray(canvas) ? canvas[0] : canvas?.width;
  const canvasHeight = Array.isArray(canvas) ? canvas[1] : canvas?.height;

  if (Number.isFinite(canvasWidth) && Number.isFinite(canvasHeight)) {
    if (canvasWidth !== options.viewport.width || canvasHeight !== options.viewport.height) {
      problems.push(
        `stats().canvas is ${canvasWidth}x${canvasHeight}, expected ${options.viewport.width}x${options.viewport.height}`,
      );
    }
  } else {
    problems.push("stats().canvas is missing (expected [width, height] or { width, height })");
  }

  if (stats.quality !== QUALITY) {
    problems.push(`stats().quality is "${stats.quality}", expected "${QUALITY}"`);
  }

  if (typeof stats.shot === "string" && stats.shot !== "" && stats.shot !== probe.id) {
    problems.push(`stats().shot is "${stats.shot}", expected "${probe.id}"`);
  }

  if (probe.measurement.frameTimes.length !== options.frames) {
    problems.push(
      `measured ${probe.measurement.frameTimes.length} frames, expected ${options.frames}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(`perf probe for shot "${probe.id}" failed:\n  - ${problems.join("\n  - ")}`);
  }
}

async function probeShot({
  browser,
  browserInfo,
  options,
  baseUrl,
  log,
  id,
  outputDir,
  attempt = 1,
}) {
  const url = buildCaptureUrl(baseUrl, { level: options.level, shot: id });

  const probe = await withProbePage(
    browser,
    options.viewport,
    log,
    async ({ page, diagnostics }) => {
      await waitForCaptureReady(page, {
        url,
        timeoutMs: options.readyTimeout,
        log,
        diagnostics,
      });

      const available = await readShotIds(page);

      if (!available.includes(id)) {
        throw new CaptureModeError(
          `shot "${id}" is not exposed by the page (available: ${available.join(", ")})`,
        );
      }

      await applyShot(page, id);
      await waitSettleFrames(page, SETTLE_FRAMES);

      const userAgent = await page.evaluate(() => navigator.userAgent);
      const gpu = await readGpuInfo(page);

      log(
        `measured ${id}: ${options.warmup} warmup + ${options.frames} frames · ` +
          `${gpu?.unmaskedRenderer ?? gpu?.renderer ?? "unknown renderer"}`,
      );

      const measurement = await withTimeout(
        measureFrameTimes(page, {
          warmupFrames: options.warmup,
          measuredFrames: options.frames,
          timeoutMs: options.measurementTimeoutMs,
        }),
        options.measurementTimeoutMs + 10_000,
        `frame measurement for shot "${id}" did not finish within ${options.measurementTimeoutMs + 10_000} ms`,
      );

      const stats = await readStats(page);
      const viewport = await readPageViewport(page);
      const diagnosticsSnapshot = diagnostics.snapshot();

      return {
        id,
        url,
        userAgent,
        gpu,
        measurement,
        stats,
        viewport,
        ...diagnosticsSnapshot,
      };
    },
  );

  validateProbe(probe, options);

  const metrics = computeFrameMetrics(probe.measurement.frameTimes);
  const passed = metrics.fps.avg >= options.minFps;
  const file = resolve(outputDir, `${id}.json`);

  const record = {
    generator: "tools/capture/perf.mjs",
    environment: options.environment,
    iteration: options.iteration,
    shot: id,
    attempt,
    level: options.level,
    url: probe.url,
    generatedAt: new Date().toISOString(),
    browser: {
      name: browserInfo.name,
      channel: browserInfo.channel,
      version: browserInfo.version,
      userAgent: probe.userAgent,
    },
    gpu: probe.gpu,
    viewport: {
      width: probe.viewport.width,
      height: probe.viewport.height,
      deviceScaleFactor: probe.viewport.devicePixelRatio,
    },
    host: readHostInfo(),
    method:
      "in-page requestAnimationFrame timestamps: warmup deltas discarded, then delta between consecutive rAF callbacks is the frame time",
    warmupFrames: options.warmup,
    measuredFrames: options.frames,
    metrics: {
      durationMs: metrics.durationMs,
      fps: metrics.fps,
      frameTimeMs: metrics.frameTimeMs,
    },
    threshold: {
      minFps: options.minFps,
      strict: options.strict,
      passed,
    },
    stats: probe.stats,
    frameTimesMs: probe.measurement.frameTimes,
    diagnostics: {
      consoleErrors: probe.consoleErrors,
      pageErrors: probe.pageErrors,
      failedRequests: probe.failedRequests,
    },
  };

  await evidence.writeJson(file, record);

  log(
    `shot "${id}"${attempt > 1 ? ` (attempt ${attempt})` : ""} avg ${metrics.fps.avg} fps · ` +
      `median ${metrics.fps.median} · ` +
      `1% low ${metrics.fps.p1Low} · p95 ${metrics.frameTimeMs.p95} ms · ` +
      `drawCalls ${probe.stats?.drawCalls ?? "?"}`,
  );

  if (options.strict && !passed) {
    log(`WARNING: shot "${id}" is below --min-fps ${options.minFps} (${metrics.fps.avg} fps)`);
  }

  return {
    id,
    file,
    url: probe.url,
    metrics,
    stats: probe.stats,
    gpu: probe.gpu,
    passed,
    consoleErrors: probe.consoleErrors,
    pageErrors: probe.pageErrors,
    failedRequests: probe.failedRequests,
  };
}

function printSummary({ results, options, baseUrl, browserInfo }) {
  const rows = results.map((result) => [
    result.id,
    result.metrics.fps.avg.toFixed(2),
    result.metrics.fps.median.toFixed(2),
    result.metrics.fps.p1Low.toFixed(2),
    result.metrics.frameTimeMs.p95.toFixed(2),
    String(result.stats?.drawCalls ?? "?"),
    String(result.stats?.triangles ?? "?"),
    result.stats?.quality ?? "?",
    result.passed ? "PASS" : `LOW (<${options.minFps})`,
  ]);

  console.log("");
  console.log(
    `perf iteration "${options.iteration}" · ${baseUrl} · ${browserInfo.name} ${browserInfo.version} · ${options.environment}`,
  );
  console.log("");
  console.log(
    evidence.renderTable(
      [
        "shot",
        "avg fps",
        "median fps",
        "1% low",
        "p95 ms",
        "drawCalls",
        "triangles",
        "quality",
        "verdict",
      ],
      rows,
      {
        aligns: ["left", "right", "right", "right", "right", "right", "right", "right", "left"],
      },
    ),
  );

  const worst = results.reduce(
    (current, result) => (result.metrics.fps.avg < current.metrics.fps.avg ? result : current),
    results[0],
  );
  const failing = results.filter((result) => !result.passed);
  const consoleErrors = results.reduce((total, result) => total + result.consoleErrors.length, 0);
  const pageErrors = results.reduce((total, result) => total + result.pageErrors.length, 0);

  console.log("");
  console.log(
    `viewport ${options.viewport.width}x${options.viewport.height} @1 · ${QUALITY} quality · ` +
      `warmup ${options.warmup} + ${options.frames} frames · min-fps ${options.minFps} · strict ${options.strict ? "on" : "off"}`,
  );
  console.log(
    `worst shot: ${worst.id} ${worst.metrics.fps.avg} fps · below threshold: ${failing.length}/${results.length} · ` +
      `console errors: ${consoleErrors} · page errors: ${pageErrors}`,
  );

  const host = readHostInfo();
  console.log(
    `host: ${host.platform}/${host.arch} · ${host.cpuCount} cpus · load avg ${host.loadAvg.join(" / ")} (1/5/15 min)`,
  );
  console.log(
    "note: headless Edge frame pacing is capped/approximated — this is a regression probe, not a real-window FPS claim.",
  );

  if (failing.length > 0 && !options.strict) {
    console.log(
      `warning: ${failing.length} shot(s) below --min-fps ${options.minFps}; exit code stays 0 without --strict (report-only).`,
    );
  }
}

function buildRunReport({ results, options, baseUrl, browserInfo }) {
  const failing = results.filter((result) => !result.passed);
  const worst = results.reduce(
    (current, result) => (result.metrics.fps.avg < current.metrics.fps.avg ? result : current),
    results[0],
  );

  return {
    generator: "tools/capture/perf.mjs",
    environment: options.environment,
    iteration: options.iteration,
    generatedAt: new Date().toISOString(),
    level: options.level,
    url: baseUrl,
    browser: browserInfo,
    viewport: {
      width: options.viewport.width,
      height: options.viewport.height,
      deviceScaleFactor: 1,
    },
    host: readHostInfo(),
    frames: { warmup: options.warmup, measured: options.frames },
    threshold: { minFps: options.minFps, strict: options.strict },
    shots: results.map((result) => ({
      shot: result.id,
      json: evidence.toRepoPath(ROOT_DIR, result.file),
      fps: result.metrics.fps,
      frameTimeMs: result.metrics.frameTimeMs,
      durationMs: result.metrics.durationMs,
      stats: result.stats,
      gpu: result.gpu,
      passed: result.passed,
      consoleErrors: result.consoleErrors.length,
      pageErrors: result.pageErrors.length,
    })),
    summary: {
      shots: results.length,
      passing: results.length - failing.length,
      failing: failing.length,
      worstShot: worst.id,
      worstAvgFps: worst.metrics.fps.avg,
      belowThreshold: failing.map((result) => result.id),
    },
  };
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`[perf] ${error.message}`);
      console.error("");
      console.log(HELP_LINES.join("\n"));
      process.exitCode = 2;
      return;
    }

    throw error;
  }

  if (options.help) {
    console.log(HELP_LINES.join("\n"));
    return;
  }

  const log = createLogger();
  const baseUrl = options.url
    ? new URL(options.url).href
    : `http://127.0.0.1:${options.serverPort}/`;
  const probeUrl = new URL("/", baseUrl).href;
  const outputDir = evidence.iterationDir(ROOT_DIR, `perf-${options.iteration}`);
  const server = createServerManager({
    rootDir: ROOT_DIR,
    port: options.serverPort,
    host: "127.0.0.1",
    baseUrl: probeUrl,
    log,
  });

  let browser = null;
  let shuttingDown = false;

  const shutdown = async (code, reason) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    log(`${reason}; shutting down`);

    await closeBrowserBounded(browser, log);

    try {
      await server.stop();
    } catch {
      // best effort on a signal path
    }

    process.exit(code);
  };

  process.once("SIGINT", () => {
    void shutdown(130, "SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown(143, "SIGTERM");
  });

  try {
    await server.ensure({ reuseServer: options.reuseServer, timeoutMs: options.serverTimeout });

    let launched = await launchBrowser({ headless: options.headless, log });
    browser = launched.browser;

    await evidence.ensureDir(outputDir);
    log(`perf evidence dir: ${evidence.toRepoPath(ROOT_DIR, outputDir)}`);
    log(
      `environment ${options.environment} · viewport ${options.viewport.width}x${options.viewport.height} @1 · ` +
        `${QUALITY} quality · warmup ${options.warmup} + ${options.frames} frames · min-fps ${options.minFps}`,
    );

    const shotIds = await resolveShotIds({ browser, options, baseUrl, log });

    log(`shots (${shotIds.length}): ${shotIds.join(", ")}`);

    const results = [];

    for (const [index, id] of shotIds.entries()) {
      log(`[${index + 1}/${shotIds.length}] probe "${id}"`);

      let result = null;

      for (let attempt = 1; attempt <= MAX_SHOT_ATTEMPTS; attempt += 1) {
        try {
          result = await probeShot({
            browser,
            browserInfo: launched.info,
            options,
            baseUrl,
            log,
            id,
            outputDir,
            attempt,
          });
          break;
        } catch (error) {
          if (attempt === MAX_SHOT_ATTEMPTS || !isRetryableProbeError(error)) {
            throw error;
          }

          log(
            `shot "${id}" attempt ${attempt}/${MAX_SHOT_ATTEMPTS} hit a transient failure ` +
              `(${firstLine(error instanceof Error ? error.message : String(error))}); ` +
              `restarting Edge and retrying`,
          );

          await closeBrowserBounded(browser, log);
          await delay(RETRY_DELAY_MS);
          launched = await launchBrowser({ headless: options.headless, log });
          browser = launched.browser;
        }
      }

      results.push(result);
    }

    printSummary({ results, options, baseUrl, browserInfo: launched.info });

    const report = buildRunReport({ results, options, baseUrl, browserInfo: launched.info });

    console.log("");
    console.log(
      `per-shot JSON: ${evidence.toRepoPath(ROOT_DIR, outputDir)}/<shot>.json · summary: ${options.json ?? "(stdout only)"}`,
    );

    if (options.json) {
      const jsonPath = resolve(process.cwd(), options.json);
      await evidence.ensureDir(dirname(jsonPath));
      await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
      log(`summary report: ${jsonPath}`);
    }

    const failing = results.filter((result) => !result.passed);

    if (options.strict && failing.length > 0) {
      console.error("");
      console.error(
        `[perf] STRICT FAILED: ${failing.length} of ${results.length} shot(s) below --min-fps ${options.minFps}: ` +
          failing.map((result) => `${result.id} ${result.metrics.fps.avg} fps`).join(", "),
      );
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } finally {
    await closeBrowserBounded(browser, log);

    const stopResult = await server.stop().catch((error) => {
      console.error(`[perf] WARNING: failed to stop the dev server: ${error.message}`);
      return null;
    });

    if (stopResult?.stopped) {
      log(`server child stopped; ${probeUrl} free=${stopResult.portFree}`);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`[perf] ERROR: ${message}`);

  // Only add stack frames; multi-line diagnostics messages must not be repeated.
  if (error instanceof Error && typeof error.stack === "string") {
    const frames = error.stack
      .split("\n")
      .filter((line) => line.trim().startsWith("at "))
      .slice(0, 3);

    if (frames.length > 0) {
      console.error(frames.join("\n"));
    }
  }

  process.exitCode = 1;
});
