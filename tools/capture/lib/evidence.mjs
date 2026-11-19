/**
 * Filesystem, hashing and reporting helpers for capture evidence.
 *
 * Evidence layout (git-ignored):
 *   captures/<iteration>/<shot>.png
 *   captures/<iteration>/manifest.json
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Returns { width, height } for a PNG buffer, or null when it is not a PNG. */
export function pngSize(buffer) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(PNG_SIGNATURE)
  ) {
    return null;
  }

  if (buffer.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

/** Compares two files at the byte level for determinism diagnostics. */
export function compareBuffers(left, right) {
  const length = Math.min(left.length, right.length);
  let firstDifference = -1;
  let differingBytes = 0;

  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      differingBytes += 1;

      if (firstDifference === -1) {
        firstDifference = index;
      }
    }
  }

  differingBytes += Math.abs(left.length - right.length);

  return {
    identical: differingBytes === 0,
    sizeLeft: left.length,
    sizeRight: right.length,
    differingBytes,
    firstDifference,
  };
}

export function iterationDir(rootDir, iteration) {
  return resolve(rootDir, "captures", iteration);
}

export function shotFile(outputDir, id) {
  return resolve(outputDir, `${id}.png`);
}

/** Repo-relative path with forward slashes (stable across platforms). */
export function toRepoPath(rootDir, path) {
  return relative(rootDir, path).split("\\").join("/");
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

export async function writeJson(path, value) {
  await ensureDir(dirname(path));
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "?";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/** Small dependency-free fixed-width table renderer. */
export function renderTable(headers, rows, { aligns = [] } = {}) {
  const widths = headers.map((header, column) =>
    Math.max(String(header).length, ...rows.map((row) => String(row[column] ?? "").length)),
  );

  const formatRow = (cells) =>
    cells
      .map((cell, column) => {
        const text = String(cell ?? "");
        const width = widths[column];

        return aligns[column] === "right" ? text.padStart(width) : text.padEnd(width);
      })
      .join("  ")
      .trimEnd();

  const separator = widths.map((width) => "-".repeat(width)).join("  ");

  return [formatRow(headers), separator, ...rows.map(formatRow)].join("\n");
}
