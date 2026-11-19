/**
 * Pixel-level comparison of two PNG frames for the determinism check.
 *
 * The harness normally proves determinism with sha256 equality. When two byte
 * streams differ (GPU LSB jitter from a hard MSAA-resolved edge, for example),
 * the accepted contract is "identical up to a tiny channel delta on a tiny share
 * of pixels". That comparison needs a PNG decoder, and the repo deliberately has
 * no PNG dependency in Node, so we reuse the bundled Python interpreter that the
 * metrics tooling already documents (numpy + Pillow). It is only spawned when
 * the hashes actually differ; byte-identical runs never touch Python.
 *
 * Interpreter lookup order:
 *   1. `$GLASSLINE_PYTHON` (escape hatch, documented in tools/capture/README.md)
 *   2. the bundled DSH runtime interpreter used by the other capture tools
 *   3. `/usr/bin/python3`
 *   4. `python3` from `PATH`
 *
 * If none of them can `import numpy, PIL`, the harness fails the determinism
 * check with a clear message instead of silently tolerating a difference.
 */

import { spawn, spawnSync } from "node:child_process";
import { accessSync } from "node:fs";

export const BUNDLED_PYTHON =
  "/Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3";

export class PixelDiffError extends Error {}

const PYTHON_TIMEOUT_MS = 120_000;

const PYTHON_SCRIPT = `
import json
import sys

try:
    import numpy as np
    from PIL import Image
except Exception as exc:  # noqa: BLE001 - reported as JSON to the harness
    print(json.dumps({"error": "missing-python-deps", "detail": str(exc)}))
    sys.exit(2)

path_a, path_b = sys.argv[1], sys.argv[2]

try:
    image_a = Image.open(path_a).convert("RGB")
    image_b = Image.open(path_b).convert("RGB")
except Exception as exc:  # noqa: BLE001
    print(json.dumps({"error": "image-open-failed", "detail": str(exc)}))
    sys.exit(3)

if image_a.size != image_b.size:
    print(json.dumps({"error": "size-mismatch", "sizeA": list(image_a.size), "sizeB": list(image_b.size)}))
    sys.exit(3)

array_a = np.asarray(image_a, dtype=np.int16)
array_b = np.asarray(image_b, dtype=np.int16)
delta = np.abs(array_a - array_b)
max_per_pixel = delta.max(axis=2)
differing = max_per_pixel > 0
differing_pixels = int(differing.sum())
total_pixels = int(max_per_pixel.size)
max_channel_delta = int(delta.max()) if differing_pixels else 0
bounding_box = None
samples = []

if differing_pixels:
    ys, xs = np.nonzero(differing)
    bounding_box = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    coordinates = np.argwhere(differing)
    order = sorted(
        range(len(coordinates)),
        key=lambda index: (
            -int(max_per_pixel[coordinates[index][0], coordinates[index][1]]),
            int(coordinates[index][0]),
            int(coordinates[index][1]),
        ),
    )
    for index in order[:8]:
        y = int(coordinates[index][0])
        x = int(coordinates[index][1])
        samples.append(
            {
                "x": x,
                "y": y,
                "run1": [int(value) for value in array_a[y, x]],
                "run2": [int(value) for value in array_b[y, x]],
                "maxChannelDelta": int(max_per_pixel[y, x]),
            }
        )

print(
    json.dumps(
        {
            "width": int(array_a.shape[1]),
            "height": int(array_a.shape[0]),
            "differingPixels": differing_pixels,
            "differingShare": differing_pixels / total_pixels,
            "maxChannelDelta": max_channel_delta,
            "boundingBox": bounding_box,
            "samples": samples,
        }
    )
)
`;

let pythonProbe; // undefined = not probed, null = unavailable, string = path

function commandLooksRunnable(candidate) {
  if (!candidate.includes("/")) {
    return true;
  }

  try {
    accessSync(candidate);
    return true;
  } catch {
    return false;
  }
}

function probeInterpreter(candidate) {
  const result = spawnSync(candidate, ["-c", "import numpy, PIL"], {
    encoding: "utf8",
    timeout: 30_000,
  });

  return result.status === 0;
}

function candidateInterpreters() {
  return [process.env.GLASSLINE_PYTHON, BUNDLED_PYTHON, "/usr/bin/python3", "python3"].filter(
    (candidate) => typeof candidate === "string" && candidate.length > 0,
  );
}

/**
 * Resolves a Python interpreter with numpy + Pillow once per process.
 * Returns `null` when none is usable.
 */
export function resolvePixelDiffPython({ log } = {}) {
  if (pythonProbe !== undefined) {
    return pythonProbe;
  }

  for (const candidate of candidateInterpreters()) {
    if (!commandLooksRunnable(candidate)) {
      continue;
    }

    if (probeInterpreter(candidate)) {
      pythonProbe = candidate;
      log?.(`pixel diff: using Python interpreter ${candidate}`);
      return pythonProbe;
    }
  }

  pythonProbe = null;
  return pythonProbe;
}

/** Human-readable text for the "no usable Python" failure path. */
export function unavailablePythonMessage() {
  return [
    "pixel-tolerance determinism check needs Python 3 with numpy + Pillow, but no usable interpreter was found.",
    `tried: ${candidateInterpreters().join(", ")}`,
    `documented bundled interpreter: ${BUNDLED_PYTHON}`,
    "set GLASSLINE_PYTHON=<path> to point at one, or run with --determinism-tolerance 0 to require byte identity instead.",
  ].join("\n");
}

function runPython(python, args, { timeoutMs = PYTHON_TIMEOUT_MS } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(python, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (callback) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      callback();
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => rejectPromise(new PixelDiffError(`pixel diff timed out after ${timeoutMs} ms`)));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      finish(() => rejectPromise(new PixelDiffError(`could not run ${python}: ${error.message}`)));
    });
    child.on("close", (code) => {
      finish(() => resolvePromise({ code, stdout, stderr }));
    });
  });
}

/**
 * Compares two PNG files pixel-by-pixel.
 *
 * Returns `{ width, height, differingPixels, differingShare, maxChannelDelta,
 * boundingBox, samples }`, throws {@link PixelDiffError} when the comparison
 * cannot be performed (no Python, missing numpy/Pillow, unreadable image).
 */
export async function comparePngFiles(pathA, pathB, { log } = {}) {
  const python = resolvePixelDiffPython({ log });

  if (!python) {
    throw new PixelDiffError(unavailablePythonMessage());
  }

  const { code, stdout, stderr } = await runPython(python, ["-c", PYTHON_SCRIPT, pathA, pathB]);
  let payload;

  try {
    payload = JSON.parse(stdout.trim());
  } catch {
    throw new PixelDiffError(
      `pixel diff produced non-JSON output (exit ${code}): ${stderr.trim() || stdout.trim() || "no output"}`,
    );
  }

  if (payload?.error) {
    if (payload.error === "missing-python-deps") {
      throw new PixelDiffError(
        `Python interpreter ${python} cannot import numpy + Pillow: ${payload.detail}\n${unavailablePythonMessage()}`,
      );
    }

    throw new PixelDiffError(
      `pixel diff could not read the PNGs (${payload.error}): ${JSON.stringify(payload)}`,
    );
  }

  const required = ["width", "height", "differingPixels", "differingShare", "maxChannelDelta"];

  if (code !== 0 || required.some((key) => typeof payload[key] !== "number")) {
    throw new PixelDiffError(
      `pixel diff returned an unexpected result (exit ${code}): ${stdout.trim() || stderr.trim() || "no output"}`,
    );
  }

  return payload;
}
