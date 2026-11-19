#!/usr/bin/env python3
"""Measure candidate screenshots against the Mirror's Edge prologue reference set.

The metric definitions are intentionally simple and reproducible; they are a
regression gauge, not a claim of perceptual equivalence. Compare like-for-like
frames: the reference set is `ref/reference/prolog-kit/study/05-prologue-roofs`
(local, not committed).

Usage:
    python3 tools/capture/metrics.py --candidate /tmp/start.png
    python3 tools/capture/metrics.py --candidate a.png b.png --json /tmp/report.json

Requires numpy and Pillow (available in the workspace Python runtime).
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys

import numpy as np
from PIL import Image

DEFAULT_REFERENCE = "ref/reference/prolog-kit/study/05-prologue-roofs"

# Tolerance bands around the reference mean. Wide where the reference frames
# themselves vary (near-white, shadow depth) and tight for hue/contrast gauges.
TOLERANCES = {
    "luma": 0.08,
    "std": 0.05,
    "p25": 0.10,
    "p95": 0.05,
    "near_white": 18.0,
    "deep_shadow": 3.0,
    "saturation": 0.08,
    "local_contrast": 0.04,
    "edge": 0.012,
    "sky": 12.0,
    "top_contrast": 0.05,
    "split": 15.0,
    "red": 2.5,
}


def load_image(path: str) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    width, height = image.size
    scale = 960 / max(width, height)

    if scale < 1:
        image = image.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

    return np.asarray(image).astype(np.float32) / 255.0


def metrics(path: str) -> dict[str, float]:
    pixels = load_image(path)
    red, green, blue = pixels[..., 0], pixels[..., 1], pixels[..., 2]
    luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    maximum = pixels.max(axis=2)
    minimum = pixels.min(axis=2)
    saturation = np.where(maximum > 1e-5, (maximum - minimum) / np.maximum(maximum, 1e-5), 0)

    block_height = luma.shape[0] // 8 * 8
    block_width = luma.shape[1] // 8 * 8
    blocks = luma[:block_height, :block_width].reshape(
        block_height // 8, 8, block_width // 8, 8
    ).mean(axis=(1, 3))

    gradient_y, gradient_x = np.gradient(luma)
    edge = float(np.hypot(gradient_x, gradient_y).mean())

    upper = pixels[: int(pixels.shape[0] * 0.66)]
    sky = (
        (upper[..., 2] > upper[..., 0] * 1.05)
        & (upper[..., 2] > 0.45)
        & (upper[..., 2] > upper[..., 1] * 1.02)
    )
    top_third = luma[: luma.shape[0] // 3]
    dark = luma < 0.18
    split = float((red[dark] - blue[dark]).mean() * 255) if dark.any() else 0.0
    red_accent = (red > 0.35) & (red > green * 1.5) & (red > blue * 1.5)

    return {
        "luma": float(luma.mean()),
        "std": float(luma.std()),
        "p25": float(np.percentile(luma, 25)),
        "p95": float(np.percentile(luma, 95)),
        "near_white": float((luma > 0.9).mean() * 100),
        "deep_shadow": float((luma < 0.05).mean() * 100),
        "saturation": float(saturation.mean()),
        "local_contrast": float(blocks.std()),
        "edge": edge,
        "sky": float(sky.mean() * 100),
        "top_contrast": float(top_third.std()),
        "split": split,
        "red": float(red_accent.mean() * 100),
    }


def average_reference(path: str) -> tuple[dict[str, float], int]:
    files = sorted(glob.glob(os.path.join(path, "*.jpg")))

    if not files:
        raise SystemExit(f"No reference frames found in {path}")

    totals: dict[str, float] = {}
    for file in files:
        for key, value in metrics(file).items():
            totals[key] = totals.get(key, 0.0) + value

    return {key: value / len(files) for key, value in totals.items()}, len(files)


def format_row(name: str, candidate: float, reference: float) -> tuple[str, bool]:
    delta = candidate - reference
    tolerance = TOLERANCES.get(name, 0.05)
    ok = abs(delta) <= tolerance
    marker = "PASS" if ok else "WATCH"
    return (
        f"  {name:<15} {candidate:>8.3f} {reference:>10.3f} {delta:>+9.3f} "
        f"{tolerance:>9.3f}   {marker}",
        ok,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidate", nargs="+", required=True, help="Candidate screenshot(s)")
    parser.add_argument("--reference", default=DEFAULT_REFERENCE, help="Reference frame directory")
    parser.add_argument("--json", help="Write a JSON report to this path")
    args = parser.parse_args()

    reference, reference_count = average_reference(args.reference)
    report: dict[str, object] = {
        "reference": args.reference,
        "referenceFrames": reference_count,
        "tolerances": TOLERANCES,
        "candidates": [],
    }
    all_pass = True

    print(f"Reference: {args.reference} ({reference_count} frames)")
    print(f"  {'metric':<15} {'candidate':>8} {'reference':>10} {'delta':>9} {'tolerance':>9}   band")

    for candidate_path in args.candidate:
        candidate = metrics(candidate_path)
        rows = []
        passed = 0

        print(f"\nCandidate: {candidate_path}")
        for name in reference:
            row, ok = format_row(name, candidate[name], reference[name])
            print(row)
            rows.append({"metric": name, "candidate": candidate[name], "reference": reference[name], "pass": ok})
            passed += int(ok)

        all_pass = all_pass and passed >= len(rows) - 3
        report["candidates"].append(
            {
                "path": candidate_path,
                "metrics": candidate,
                "rows": rows,
                "passed": passed,
                "total": len(rows),
            }
        )
        print(f"  {passed}/{len(rows)} metrics inside tolerance")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
            handle.write("\n")
        print(f"\nWrote {args.json}")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
