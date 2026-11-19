#!/usr/bin/env node
/**
 * Deterministic capture harness for Glassline.
 *
 * Capture mode (default) consumes the in-app capture contract:
 *   http://127.0.0.1:5199/?capture=1&level=prologue&shot=<id>
 *   window.__glasslineCapture = { ready, shots, apply(id), stats() }
 *
 * It boots (or attaches to) a local Vite dev server, launches Microsoft Edge
 * through Playwright's `msedge` channel at 1600x900 dpr 1, captures each shot as
 * a PNG into `captures/<iteration>/`, records sha256 + renderer stats in
 * `captures/<iteration>/manifest.json`, and optionally captures every shot
 * twice to prove determinism. Byte-identical frames are the preferred outcome;
 * when hashes differ, the accepted rule is "at most 1/255 channel delta on at
 * most 0.01% of pixels" (see README §3), measured by decoding both PNGs.
 *
 * Legacy one-off mode keeps the old flag surface (`--out`, `--mode`, `--pos`,
 * `--yaw`, `--pitch`, `--wait`, `--menu`, `--run`) and drives
 * `window.__glassline` directly instead of the capture contract.
 *
 * Usage:
 *   node tools/capture/capture.mjs --iteration w0 --shot all
 *   node tools/capture/capture.mjs --iteration w0 --shot start-roof --no-verify-determinism
 *   node tools/capture/capture.mjs --out /tmp/prologue.png --mode prologue --pos 0,0.93,6
 *
 * No commits, no browser downloads: Playwright 1.65+ and system Edge are
 * expected to be provisioned already.
 */

import { rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { launchBrowser, withIsolatedPage } from "./lib/browser-session.mjs";
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
import { parseArgs, printHelp, UsageError } from "./lib/cli.mjs";
import * as evidence from "./lib/evidence.mjs";
import { runLegacyCapture } from "./lib/legacy-capture.mjs";
import { comparePngFiles } from "./lib/pixel-diff.mjs";
import { createServerManager } from "./lib/vite-server.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Plan §6 fallback list, used only when shot discovery without ?shot fails. */
const DEFAULT_SHOT_IDS = [
  "start-roof",
  "first-gap",
  "wallrun-corridor",
  "service-block",
  "skybridge",
  "finish-roof",
];

function createLogger() {
  const started = Date.now();

  return (message) => {
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[capture ${elapsed}s] ${message}`);
  };
}

function firstLine(text) {
  return String(text).split("\n")[0];
}

const SHOT_TIMEOUT_MS = 240_000;
const BROWSER_CLOSE_TIMEOUT_MS = 20_000;

/** Races a promise against a timeout so a wedged Chromium cannot hang the run. */
function withTimeout(promise, timeoutMs, label) {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function printLegacyReport(report) {
  const stats = report.stats ?? {};

  console.log(
    JSON.stringify(
      {
        out: report.out,
        mode: report.mode,
        flow: report.flow,
        sha256: report.sha256,
        png: report.png,
        bytes: report.bytes,
        position: stats.position ?? null,
        instancedMeshes: stats.instancedMeshes ?? null,
        instances: stats.instances ?? null,
        triangles: stats.triangles ?? null,
        textures: stats.textures ?? null,
        programs: stats.programs ?? null,
        canvas: stats.canvas ?? null,
      },
      null,
      2,
    ),
  );

  if (report.pageErrors.length > 0) {
    console.error(
      `WARNING: ${report.pageErrors.length} uncaught page error(s) during legacy capture`,
    );
  }

  if (report.consoleErrors.length > 0) {
    console.error(`WARNING: ${report.consoleErrors.length} console error(s) during legacy capture`);
  }
}

async function resolveShotIds({ browser, options, baseUrl, log }) {
  if (options.shotMode === "single") {
    return [options.shot];
  }

  try {
    return await withIsolatedPage(browser, options.viewport, async ({ page, diagnostics }) => {
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

async function captureShot({ browser, options, baseUrl, log, id }) {
  const url = buildCaptureUrl(baseUrl, { level: options.level, shot: id });
  const captured = await withTimeout(
    withIsolatedPage(browser, options.viewport, async ({ page, diagnostics }) => {
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
      await waitSettleFrames(page, options.frames);

      const viewport = await readPageViewport(page);
      const stats = await readStats(page);
      const buffer = await page.screenshot({
        type: "png",
        animations: "disabled",
        caret: "hide",
        timeout: 60_000,
      });
      const diagnosticsSnapshot = diagnostics.snapshot();

      return {
        id,
        buffer,
        stats,
        viewport,
        ...diagnosticsSnapshot,
      };
    }),
    SHOT_TIMEOUT_MS,
    `shot "${id}" capture`,
  );

  const png = evidence.pngSize(captured.buffer);
  const file = evidence.shotFile(options.outputDir, id);

  await writeFile(file, captured.buffer);

  const problems = [];

  if (png === null) {
    problems.push("screenshot is not a PNG");
  } else if (png.width !== options.viewport.width || png.height !== options.viewport.height) {
    problems.push(
      `PNG is ${png.width}x${png.height}, expected ${options.viewport.width}x${options.viewport.height}`,
    );
  }

  if (
    captured.viewport.width !== options.viewport.width ||
    captured.viewport.height !== options.viewport.height
  ) {
    problems.push(
      `page viewport is ${captured.viewport.width}x${captured.viewport.height}, expected ${options.viewport.width}x${options.viewport.height}`,
    );
  }

  if (captured.viewport.devicePixelRatio !== 1) {
    problems.push(`devicePixelRatio is ${captured.viewport.devicePixelRatio}, expected 1`);
  }

  // The contract may expose `canvas` as [width, height] or { width, height }.
  const canvas = captured.stats?.canvas;
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

  if (
    typeof captured.stats?.shot === "string" &&
    captured.stats.shot !== "" &&
    captured.stats.shot !== id
  ) {
    problems.push(`stats().shot is "${captured.stats.shot}", expected "${id}"`);
  }

  if (captured.pageErrors.length > 0) {
    problems.push(
      `uncaught page exception(s):\n${captured.pageErrors.map((entry) => `    ${firstLine(entry)}`).join("\n")}`,
    );
  }

  if (options.strictConsole && captured.consoleErrors.length > 0) {
    problems.push(
      `console errors (--strict-console):\n${captured.consoleErrors.map((entry) => `    ${entry}`).join("\n")}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `shot "${id}" failed (file written for inspection: ${file}):\n  - ${problems.join("\n  - ")}`,
    );
  }

  const sha256 = evidence.sha256(captured.buffer);

  log(
    `shot "${id}" → ${evidence.toRepoPath(ROOT_DIR, file)} ${png.width}x${png.height} sha256=${sha256.slice(0, 16)}…`,
  );

  return {
    id,
    file,
    buffer: captured.buffer,
    png,
    sha256,
    stats: captured.stats,
    viewport: captured.viewport,
    consoleErrors: captured.consoleErrors,
    pageErrors: captured.pageErrors,
    failedRequests: captured.failedRequests,
  };
}

async function capturePass({ browser, options, baseUrl, log, shotIds, outputDir, label }) {
  const shots = [];

  for (const [index, id] of shotIds.entries()) {
    log(`[${label} ${index + 1}/${shotIds.length}] capture "${id}"`);
    shots.push(
      await captureShot({
        browser,
        options: { ...options, outputDir },
        baseUrl,
        log,
        id,
      }),
    );
  }

  return shots;
}

function buildManifest({ options, baseUrl, browserInfo, shots, determinism }) {
  return {
    iteration: options.iteration,
    generatedAt: new Date().toISOString(),
    generator: "tools/capture/capture.mjs",
    mode: "capture",
    level: options.level,
    url: baseUrl,
    browser: browserInfo,
    viewport: {
      width: options.viewport.width,
      height: options.viewport.height,
      deviceScaleFactor: 1,
    },
    frames: options.frames,
    shots: shots.map((shot) => ({
      id: shot.id,
      file: evidence.toRepoPath(ROOT_DIR, shot.file),
      sha256: shot.sha256,
      png: { ...shot.png, bytes: shot.buffer.length },
      stats: shot.stats,
      consoleErrors: shot.consoleErrors,
    })),
    determinism,
  };
}

function formatChannelDelta(delta) {
  return typeof delta === "number" ? `${delta}/255` : "?";
}

function formatShare(share) {
  return typeof share === "number" ? `${(share * 100).toFixed(4)}%` : "?";
}

async function verifyDeterminism({ options, baseUrl, log, shotIds, firstShots, outputDir }) {
  const tempDir = resolve(outputDir, ".determinism");
  await rm(tempDir, { recursive: true, force: true });
  await evidence.ensureDir(tempDir);

  log(
    `determinism: capturing every shot a second time in a fresh Edge instance into ${evidence.toRepoPath(ROOT_DIR, tempDir)}`,
  );

  // A second, independent browser launch matches the "two separate runs" rule
  // more strictly than reusing the first browser process.
  const secondBrowser = await launchBrowser({ headless: options.headless, log });
  let secondShots;

  try {
    secondShots = await capturePass({
      browser: secondBrowser.browser,
      options,
      baseUrl,
      log,
      shotIds,
      outputDir: tempDir,
      label: "determinism",
    });
  } finally {
    await withTimeout(
      secondBrowser.browser.close().catch(() => undefined),
      BROWSER_CLOSE_TIMEOUT_MS,
      "closing the determinism browser",
    ).catch(() => {
      // already closed or wedged; process exit cleans up the rest
    });
  }

  const comparisons = [];

  for (const [index, first] of firstShots.entries()) {
    const second = secondShots[index];
    const byteIdentical = first.sha256 === second.sha256;
    const byteDiff = evidence.compareBuffers(first.buffer, second.buffer);
    let pixel = null;
    let pixelError = null;

    // Only pay for the PNG decode when the byte streams actually differ.
    if (!byteIdentical) {
      try {
        pixel = await comparePngFiles(first.file, second.file, { log });
      } catch (error) {
        pixelError = error instanceof Error ? error.message : String(error);
        log(`determinism: pixel diff unavailable for "${first.id}": ${firstLine(pixelError)}`);
      }
    }

    const differingPixels = byteIdentical ? 0 : (pixel?.differingPixels ?? null);
    const differingShare = byteIdentical ? 0 : (pixel?.differingShare ?? null);
    const maxChannelDelta = byteIdentical ? 0 : (pixel?.maxChannelDelta ?? null);

    let passed;
    let reason = null;

    if (byteIdentical) {
      passed = true;
    } else if (options.determinismTolerance === 0) {
      passed = false;
      reason = "byte-identical required (--determinism-tolerance 0)";
    } else if (pixel === null) {
      passed = false;
      reason = `pixel diff unavailable: ${firstLine(pixelError ?? "unknown error")}`;
    } else {
      passed =
        pixel.maxChannelDelta <= options.determinismTolerance &&
        pixel.differingShare <= options.determinismMaxShare;

      if (!passed) {
        reason =
          `exceeds tolerance: maxChannelDelta ${formatChannelDelta(pixel.maxChannelDelta)} ` +
          `(allowed <= ${formatChannelDelta(options.determinismTolerance)}), ` +
          `differing share ${formatShare(pixel.differingShare)} ` +
          `(allowed <= ${formatShare(options.determinismMaxShare)})`;
      }
    }

    comparisons.push({
      id: first.id,
      sha256First: first.sha256,
      sha256Second: second.sha256,
      byteIdentical,
      passed,
      differingPixels,
      differingShare,
      maxChannelDelta,
      differingBytes: byteDiff.differingBytes,
      firstDifference: byteDiff.firstDifference,
      boundingBox: pixel?.boundingBox ?? null,
      samples: pixel?.samples ?? [],
      statsIdentical: JSON.stringify(first.stats) === JSON.stringify(second.stats),
      reason,
    });
  }

  const passed = comparisons.every((comparison) => comparison.passed);
  const byteMatches = comparisons.filter((comparison) => comparison.byteIdentical).length;
  const passedShots = comparisons.filter((comparison) => comparison.passed).length;
  const differingPixels = comparisons.reduce(
    (total, comparison) => total + (comparison.differingPixels ?? 0),
    0,
  );
  const maxChannelDelta = comparisons.reduce(
    (maximum, comparison) => Math.max(maximum, comparison.maxChannelDelta ?? 0),
    0,
  );
  const maxAllowedPixels = Math.floor(
    options.viewport.width * options.viewport.height * options.determinismMaxShare,
  );

  if (passed) {
    await rm(tempDir, { recursive: true, force: true });

    if (byteMatches === comparisons.length) {
      log(`determinism: PASS (${byteMatches}/${comparisons.length} shots byte-identical)`);
    } else {
      log(
        `determinism: PASS within tolerance (${byteMatches}/${comparisons.length} byte-identical, ` +
          `${passedShots}/${comparisons.length} accepted, max channel delta ${formatChannelDelta(maxChannelDelta)}, ` +
          `${differingPixels} differing px)`,
      );
    }
  } else {
    log(
      `determinism: FAIL (${passedShots}/${comparisons.length} shots within rule); second-pass frames kept in ${evidence.toRepoPath(ROOT_DIR, tempDir)}`,
    );
  }

  const rows = comparisons.map((comparison) => [
    comparison.id,
    `${comparison.sha256First.slice(0, 16)}…`,
    `${comparison.sha256Second.slice(0, 16)}…`,
    comparison.byteIdentical ? "yes" : "no",
    comparison.differingPixels === null ? "?" : String(comparison.differingPixels),
    formatChannelDelta(comparison.maxChannelDelta),
    formatShare(comparison.differingShare),
    comparison.byteIdentical ? "BYTE" : comparison.passed ? "PASS" : "FAIL",
  ]);

  console.log("");
  console.log(
    evidence.renderTable(
      [
        "id",
        "run1 sha256",
        "run2 sha256",
        "byte-identical",
        "diff px",
        "max delta",
        "share",
        "verdict",
      ],
      rows,
      { aligns: ["left", "left", "left", "left", "right", "right", "right", "left"] },
    ),
  );
  console.log("");
  console.log(
    `determinism rule: byte-identical preferred; tolerance = max channel delta <= ${formatChannelDelta(options.determinismTolerance)} ` +
      `on <= ${formatShare(options.determinismMaxShare)} of pixels (${maxAllowedPixels} px at ${options.viewport.width}x${options.viewport.height})`,
  );
  console.log("");

  return {
    verified: true,
    passed,
    byteIdentical: byteMatches === comparisons.length,
    byteMatches,
    // `matches` kept as a backward-compatible alias for byte-identical shots.
    matches: byteMatches,
    passedShots,
    total: comparisons.length,
    tolerance: options.determinismTolerance,
    maxShare: options.determinismMaxShare,
    maxAllowedPixels,
    differingPixels,
    maxChannelDelta,
    keptSecondPassDir: passed ? null : evidence.toRepoPath(ROOT_DIR, tempDir),
    shots: comparisons,
  };
}

function printShotTable(shots, options) {
  const rows = shots.map((shot) => [
    shot.id,
    shot.sha256,
    String(shot.stats?.drawCalls ?? "?"),
    String(shot.stats?.triangles ?? "?"),
    String(shot.stats?.textures ?? "?"),
    String(shot.stats?.programs ?? "?"),
    shot.png ? `${shot.png.width}x${shot.png.height}` : "?",
    evidence.formatBytes(shot.buffer.length),
  ]);

  console.log(
    evidence.renderTable(
      ["id", "sha256", "drawCalls", "triangles", "textures", "programs", "png", "bytes"],
      rows,
      { aligns: ["left", "left", "right", "right", "right", "right", "right", "right"] },
    ),
  );

  const consoleErrors = shots.reduce((total, shot) => total + shot.consoleErrors.length, 0);
  const pageErrors = shots.reduce((total, shot) => total + shot.pageErrors.length, 0);

  console.log("");
  console.log(
    `viewport ${options.viewport.width}x${options.viewport.height} @1 · ${shots.length} shot(s) · console errors: ${consoleErrors} · page errors: ${pageErrors}`,
  );
}

async function runCaptureMode({ browser, browserInfo, options, baseUrl, log }) {
  const outputDir = evidence.iterationDir(ROOT_DIR, options.iteration);
  await evidence.ensureDir(outputDir);

  log(`evidence dir: ${evidence.toRepoPath(ROOT_DIR, outputDir)}`);

  const shotIds = await resolveShotIds({ browser, options, baseUrl, log });
  log(`shots (${shotIds.length}): ${shotIds.join(", ")}`);

  const framesLabel = options.frames === 1 ? "frame" : "frames";
  log(`settling ${options.frames} ${framesLabel} after apply()`);

  const firstPass = await capturePass({
    browser,
    options,
    baseUrl,
    log,
    shotIds,
    outputDir,
    label: "capture",
  });

  const manifestPath = resolve(outputDir, "manifest.json");
  const manifest = buildManifest({
    options,
    baseUrl,
    browserInfo,
    shots: firstPass,
    determinism: null,
  });

  await evidence.writeJson(manifestPath, manifest);
  log(`manifest: ${evidence.toRepoPath(ROOT_DIR, manifestPath)}`);

  let determinism = null;

  if (options.verifyDeterminism) {
    determinism = await verifyDeterminism({
      options,
      baseUrl,
      log,
      shotIds,
      firstShots: firstPass,
      outputDir,
    });

    manifest.determinism = determinism;
    await evidence.writeJson(manifestPath, manifest);
    log(
      `manifest updated with determinism verdict: ${evidence.toRepoPath(ROOT_DIR, manifestPath)}`,
    );
  }

  console.log("");
  console.log(
    `iteration "${options.iteration}" · ${baseUrl} · ${browserInfo.name} ${browserInfo.version}`,
  );
  console.log("");
  printShotTable(firstPass, options);

  if (determinism !== null && !determinism.passed) {
    console.error("");
    console.error(
      "determinism check FAILED — the two passes do not match within the accepted tolerance.",
    );
    console.error(
      `rule: max channel delta <= ${determinism.tolerance}/255 on <= ` +
        `${(determinism.maxShare * 100).toFixed(4)}% of pixels ` +
        `(${determinism.maxAllowedPixels} px at ${options.viewport.width}x${options.viewport.height})`,
    );

    for (const shot of determinism.shots.filter((comparison) => !comparison.passed)) {
      console.error(`  - ${shot.id}: ${shot.reason}`);
    }

    console.error(
      "Byte-identical output is the preferred outcome; a tolerance pass means GPU LSB jitter (MSAA resolve), not a look/scene change.",
    );
    console.error(`Second-pass frames: ${determinism.keptSecondPassDir}`);
    return { exitCode: 1, manifestPath, manifest };
  }

  return { exitCode: 0, manifestPath, manifest };
}

async function runLegacy({ browser, options, baseUrl, log }) {
  const report = await runLegacyCapture({ browser, baseUrl, options, log });
  printLegacyReport(report);

  if (options.json) {
    const jsonPath = resolve(process.cwd(), options.json);
    await evidence.ensureDir(dirname(jsonPath));
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    log(`report: ${jsonPath}`);
  }

  return { exitCode: 0 };
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`[capture] ${error.message}`);
      console.error("");
      printHelp();
      process.exitCode = 2;
      return;
    }

    throw error;
  }

  if (options.help) {
    printHelp();
    return;
  }

  const log = createLogger();

  if (!options.legacy && options.legacyFlagsUsed.length > 0) {
    log(
      `legacy flag(s) ignored in capture mode: ${options.legacyFlagsUsed.join(", ")} (pass --out <file> for a one-off frame)`,
    );
  }

  const baseUrl = options.url
    ? new URL(options.url).href
    : `http://127.0.0.1:${options.serverPort}/`;
  const probeUrl = new URL("/", baseUrl).href;
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

    try {
      await browser?.close();
    } catch {
      // browser may already be gone
    }

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

    const launched = await launchBrowser({ headless: options.headless, log });
    browser = launched.browser;

    let result;

    if (options.legacy) {
      result = await runLegacy({ browser, options, baseUrl, log });
    } else {
      result = await runCaptureMode({
        browser,
        browserInfo: launched.info,
        options,
        baseUrl,
        log,
      });

      if (options.json) {
        const jsonPath = resolve(process.cwd(), options.json);
        await evidence.ensureDir(dirname(jsonPath));
        await writeFile(
          jsonPath,
          `${JSON.stringify(
            {
              ...result.manifest,
              manifestPath: evidence.toRepoPath(ROOT_DIR, result.manifestPath),
            },
            null,
            2,
          )}\n`,
        );
        log(`report: ${jsonPath}`);
      }
    }

    process.exitCode = result.exitCode;
  } finally {
    try {
      await withTimeout(
        Promise.resolve()
          .then(() => browser?.close())
          .catch(() => undefined),
        BROWSER_CLOSE_TIMEOUT_MS,
        "closing the browser",
      );
    } catch {
      // already closed (or wedged) by the signal path
    }

    const stopResult = await server.stop().catch((error) => {
      console.error(`[capture] WARNING: failed to stop the dev server: ${error.message}`);
      return null;
    });

    if (stopResult?.stopped) {
      log(`server child stopped; ${probeUrl} free=${stopResult.portFree}`);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[capture] ERROR: ${message}`);

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
