/**
 * Client for the deterministic capture contract implemented by the app
 * (`?capture=1&level=<level>&shot=<id>`).
 *
 * Contract consumed here:
 *   window.__glasslineCapture = {
 *     ready: boolean,
 *     shots: [{ id: string, ... }],
 *     apply(id: string): void | Promise<void>,
 *     stats(): { drawCalls, triangles, textures, programs, quality, canvas, shot },
 *   }
 *
 * The harness never reaches into gameplay internals in capture mode; it only
 * navigates, applies a shot, waits a fixed number of rendered frames, reads
 * stats and takes the PNG.
 */

import { navigate } from "./browser-session.mjs";

const READY_POLL_INTERVAL_MS = 100;

export class CaptureModeError extends Error {}

/** Builds the capture URL without dropping query parameters already in `baseUrl`. */
export function buildCaptureUrl(baseUrl, { level, shot }) {
  const url = new URL(baseUrl);

  url.searchParams.set("capture", "1");

  if (level) {
    url.searchParams.set("level", level);
  }

  if (shot) {
    url.searchParams.set("shot", shot);
  } else {
    url.searchParams.delete("shot");
  }

  return url.href;
}

/** Reads a compact, safe diagnostics snapshot of the page for failure reports. */
async function describeCaptureState(page) {
  return page
    .evaluate(() => {
      const app = window.__glassline;
      const capture = window.__glasslineCapture;
      const bootStage =
        document.querySelector("[data-boot-stage]")?.textContent?.trim() ??
        document.querySelector(".gl-boot__stage")?.textContent?.trim() ??
        null;

      return {
        readyState: document.readyState,
        capturePresent: Boolean(capture),
        captureReady: capture?.ready ?? null,
        captureShots: Array.isArray(capture?.shots)
          ? capture.shots.map((entry) => (typeof entry === "string" ? entry : (entry?.id ?? null)))
          : null,
        appState: app?.state ?? null,
        flowState: app?.flowManager?.getState?.() ?? null,
        bootStage,
        bodyClasses: document.body?.className ?? null,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio,
        },
      };
    })
    .catch((error) => ({ probeFailed: error.message }));
}

export async function waitForCaptureReady(page, { url, timeoutMs, log, diagnostics }) {
  await navigate(page, url, log);

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const ready = await page
      .evaluate(() => window.__glasslineCapture?.ready === true)
      .catch(() => false);

    if (ready) {
      log(`capture contract ready after ${((Date.now() - started) / 1000).toFixed(1)}s`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
  }

  const state = await describeCaptureState(page);
  const diagnosticLines = [
    `window.__glasslineCapture.ready was not true within ${timeoutMs} ms on ${url}`,
    `page state: ${JSON.stringify(state, null, 2)}`,
  ];

  const dump = diagnostics?.dump?.();

  if (dump) {
    diagnosticLines.push(dump);
  }

  diagnosticLines.push(
    "hint: the capture contract is provided by src/diagnostics/CaptureMode.ts (task W0-B).",
    "hint: for a quick one-off frame without capture mode use: --out <file.png> --pos <x,y,z>",
  );

  throw new CaptureModeError(diagnosticLines.join("\n"));
}

/** Reads shot ids from the contract; throws with a precise message when malformed. */
export async function readShotIds(page) {
  const entries = await page.evaluate(() => {
    const capture = window.__glasslineCapture;

    if (!capture || !Array.isArray(capture.shots)) {
      return null;
    }

    return capture.shots.map((entry) =>
      typeof entry === "string"
        ? { id: entry }
        : { id: typeof entry?.id === "string" ? entry.id : null },
    );
  });

  if (entries === null) {
    throw new CaptureModeError("window.__glasslineCapture.shots is missing or not an array");
  }

  if (entries.length === 0) {
    throw new CaptureModeError("window.__glasslineCapture.shots is empty");
  }

  const invalid = entries.filter((entry) => entry.id === null || entry.id === "");

  if (invalid.length > 0) {
    throw new CaptureModeError(
      `window.__glasslineCapture.shots contains entries without a string id: ${JSON.stringify(entries)}`,
    );
  }

  const ids = entries.map((entry) => entry.id);
  const unique = new Set(ids);

  if (unique.size !== ids.length) {
    throw new CaptureModeError(
      `window.__glasslineCapture.shots has duplicate ids: ${ids.join(", ")}`,
    );
  }

  return ids;
}

export async function applyShot(page, id) {
  const result = await page.evaluate(async (shotId) => {
    const capture = window.__glasslineCapture;

    if (typeof capture?.apply !== "function") {
      return { ok: false, reason: "window.__glasslineCapture.apply is not a function" };
    }

    try {
      const returned = await capture.apply(shotId);

      if (returned === false) {
        return {
          ok: false,
          reason: `apply("${shotId}") returned false (unknown shot or no camera)`,
        };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, reason: `apply("${shotId}") threw: ${error?.message ?? String(error)}` };
    }
  }, id);

  if (!result?.ok) {
    throw new CaptureModeError(
      `could not apply shot "${id}": ${result?.reason ?? "unknown error"}`,
    );
  }
}

/** Waits for `frames` requestAnimationFrame ticks (the app renders on rAF). */
export async function waitSettleFrames(page, frames) {
  if (frames <= 0) {
    return;
  }

  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let remaining = count;

        const tick = () => {
          remaining -= 1;

          if (remaining <= 0) {
            resolve(count);
            return;
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      }),
    frames,
  );
}

export async function readStats(page) {
  const stats = await page.evaluate(() => {
    const capture = window.__glasslineCapture;

    if (typeof capture?.stats !== "function") {
      return null;
    }

    try {
      return capture.stats();
    } catch (error) {
      return { error: error?.message ?? String(error) };
    }
  });

  if (stats === null) {
    throw new CaptureModeError("window.__glasslineCapture.stats() is not available");
  }

  if (stats?.error) {
    throw new CaptureModeError(`window.__glasslineCapture.stats() threw: ${stats.error}`);
  }

  return stats;
}

export async function readPageViewport(page) {
  return page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  }));
}
