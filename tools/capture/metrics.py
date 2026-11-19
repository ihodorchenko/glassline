#!/usr/bin/env python3
"""Measure Glassline captures against the Mirror's Edge prologue reference set.

v2: reference recompute (mean + spread per metric), plan §2.1 acceptance bands,
batch candidates (file / glob / directory), JSON + Markdown reports.

The 13 metric formulas are unchanged from v1 so the numbers stay comparable with
the 24 rounds of existing visual evidence. Definitions live in
`docs/reports/METRIC_SPEC.md`. This is a regression gauge, not a proof of
perceptual equivalence, and there is deliberately no per-image normalisation.

Usage:
    # 1. Recompute the reference set with our own script (writes the reference doc)
    $GLASSLINE_PYTHON tools/capture/metrics.py \\
        --reference-set prolog --reference-json docs/reports/reference-prolog.json

    # 2. Score single frames against the measured reference and the plan bands
    $GLASSLINE_PYTHON tools/capture/metrics.py \\
        --candidate docs/evidence/visual/round-93/start.jpg \\
        --bands --json /tmp/report.json --markdown /tmp/report.md

    # 3. Batch mode: a directory or a glob
    $GLASSLINE_PYTHON tools/capture/metrics.py --candidate captures/w0 --bands
    $GLASSLINE_PYTHON tools/capture/metrics.py --candidate 'captures/w0/*.png' --bands

    # 4. Discover metric keys / units / bands
    $GLASSLINE_PYTHON tools/capture/metrics.py --list-metrics

    # 5. W1 perceptual guardrails (diagnostic only, NOT a gate)
    $GLASSLINE_PYTHON tools/capture/metrics.py --candidate captures/w0 --bands --guardrails
    # horizon override for a known shot, in source-image pixels
    $GLASSLINE_PYTHON tools/capture/metrics.py --candidate captures/w0/wallrun-corridor.png \
        --guardrails --horizon-px wallrun-corridor.png:300

Interpreter: the system python3 has no numpy/Pillow. Use the workspace runtime
(numpy 2.3.5, Pillow 12.3.0):
    /Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
or export GLASSLINE_PYTHON to that path and use "$GLASSLINE_PYTHON".

Exit codes: 0 ok; 1 strict/legacy regression failure; 2 environment or input error.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys

INSTALL_HINT = """\
This script requires numpy and Pillow, which the system python3 does not have.

Use the workspace-bundled interpreter (numpy 2.3.5, Pillow 12.3.0):
  /Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3

Example:
  GLASSLINE_PYTHON=/Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
  "$GLASSLINE_PYTHON" tools/capture/metrics.py --help
"""

try:
    import numpy as np
    from PIL import Image
except ImportError as exc:  # pragma: no cover - environment dependent
    print(f"error: missing Python dependency: {exc}", file=sys.stderr)
    print(INSTALL_HINT, file=sys.stderr)
    sys.exit(2)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Reference set used for the prologue look. Local only, not committed (ref/ is
# in .gitignore), hence the explicit error when it is missing.
REFERENCE_SETS = {
    "prolog": "ref/reference/prolog-kit/study/05-prologue-roofs",
}
DEFAULT_REFERENCE_SET = "prolog"

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")

# Metric order is the v1 definition order and must not change.
METRIC_KEYS = [
    "luma",
    "std",
    "p25",
    "p95",
    "near_white",
    "deep_shadow",
    "saturation",
    "local_contrast",
    "edge",
    "sky",
    "top_contrast",
    "split",
    "red",
]

# Display metadata: label, unit, one-line definition (full text in METRIC_SPEC.md).
METRIC_INFO = {
    "luma": ("Luma mean", "0..1", "mean of 0.2126R + 0.7152G + 0.0722B"),
    "std": ("Luma std", "0..1", "population std of luma"),
    "p25": ("Luma p25", "0..1", "25th percentile of luma"),
    "p95": ("Luma p95", "0..1", "95th percentile of luma"),
    "near_white": ("Near-white share", "%", "share of pixels with luma > 0.9"),
    "deep_shadow": ("Deep-shadow share", "%", "share of pixels with luma < 0.05"),
    "saturation": ("Saturation", "0..1", "mean of (max(R,G,B) - min(R,G,B)) / max(R,G,B)"),
    "local_contrast": ("Local contrast", "0..1", "std of 8x8 block luma means"),
    "edge": ("Edge energy", "0..1", "mean gradient magnitude |grad luma|"),
    "sky": ("Sky-blue area", "%", "blue-dominant share of the upper 66% of the frame"),
    "top_contrast": ("Top-third contrast", "0..1", "std of luma in the top third"),
    "split": ("Split-tone dark R-B", "R-B*255", "mean(255*(R-B)) over pixels with luma < 0.18"),
    "red": ("Red accent share", "%", "share of red-dominant pixels"),
}

# Plan docs/VISUAL_AUDIO_LEVEL_PLAN.md §2.1: the "Reference" column as inherited
# from the legacy harness and the target band. min/max are inclusive.
PLAN_BANDS = {
    "luma": {"legacy": 0.589, "min": 0.48, "max": 0.62},
    "std": {"legacy": 0.272, "min": 0.22, "max": None},
    "p25": {"legacy": 0.370, "min": 0.33, "max": 0.42},
    "p95": {"legacy": 0.979, "min": 0.93, "max": None},
    "near_white": {"legacy": 27.3, "min": 15.0, "max": 28.0},
    "deep_shadow": {"legacy": 3.0, "min": None, "max": 6.0},
    "saturation": {"legacy": 0.359, "min": 0.30, "max": 0.38},
    "local_contrast": {"legacy": 0.0713, "min": 0.060, "max": None},
    "edge": {"legacy": 0.0341, "min": 0.028, "max": None},
    "sky": {"legacy": 53.1, "min": 35.0, "max": 55.0},
    "top_contrast": {"legacy": 0.0585, "min": 0.050, "max": None},
    "split": {"legacy": -48.6, "min": -55.0, "max": -40.0},
    "red": {"legacy": 4.2, "min": 2.0, "max": 5.0},
}

# v1 tolerance bands around the measured reference mean. Kept for historical
# continuity: they define the WATCH envelope in --bands mode and the verdict in
# tolerance mode (no --bands).
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


# ---------------------------------------------------------------------------
# Image loading and the 13 metrics (formulas frozen from v1)
# ---------------------------------------------------------------------------


def load_image_with_meta(path: str) -> tuple[np.ndarray, dict[str, int]]:
    """Load a frame as 0..1 float RGB, resizing so max(width, height) == 960."""
    image = Image.open(path).convert("RGB")
    source_width, source_height = image.size
    width, height = image.size
    scale = 960 / max(width, height)

    if scale < 1:
        image = image.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

    pixels = np.asarray(image).astype(np.float32) / 255.0
    meta = {
        "sourceWidth": source_width,
        "sourceHeight": source_height,
        "width": int(pixels.shape[1]),
        "height": int(pixels.shape[0]),
    }
    return pixels, meta


def load_image(path: str) -> np.ndarray:
    return load_image_with_meta(path)[0]


def metrics_from_pixels(pixels: np.ndarray) -> dict[str, float]:
    """Compute the 13 §2.1 metrics for one already-loaded frame."""
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


def metrics(path: str) -> dict[str, float]:
    """Compute the 13 §2.1 metrics for one frame. Formulas are v1-identical."""
    return metrics_from_pixels(load_image(path))


# ---------------------------------------------------------------------------
# Perceptual guardrails (W1, diagnostic only)
# ---------------------------------------------------------------------------
# These do NOT modify, replace or gate the 13 §2.1 metrics above. They are
# review inputs that expose "passing the metric while losing the look":
#   - sky_mask_share      blue pixels that actually look like sky (bright,
#                         desaturated, above the scene horizon) vs the primary
#                         sky-blue share, which also counts blue glass facades;
#   - near_white_seam_energy  detail/seam energy inside near-white areas, so a
#                         flat clipped white cannot pass as detailed white;
#   - red_route_share / red_route_saturation  largest connected red component
#                         and how saturated it is, so a salmon or confetti route
#                         is visible in the numbers.
# Full definitions and limitations: docs/reports/METRIC_SPEC.md.

GUARDRAIL_KEYS = [
    "sky_mask_share",
    "near_white_seam_energy",
    "red_route_share",
    "red_route_saturation",
]

GUARDRAIL_INFO = {
    "sky_mask_share": (
        "Sky mask share",
        "%",
        "bright desaturated blue pixels above the horizon",
    ),
    "near_white_seam_energy": (
        "Near-white seam energy",
        "gradient",
        "mean |grad L| inside the eroded near-white mask",
    ),
    "red_route_share": (
        "Red route share",
        "%",
        "largest 8-connected red component, % of frame",
    ),
    "red_route_saturation": (
        "Red route saturation",
        "0..1",
        "mean HSV-style saturation of that component",
    ),
}

SKY_LUMA_MIN = 0.55
SKY_SATURATION_MAX = 0.45
# Lit white walls are bright *and* nearly achromatic. Calibration for
# service-block (W1.1-FIX-G, 2026-11-19): a pixel brighter than 0.75 with
# HSV-style saturation below 0.20 is treated as a lit wall, not sky. Accepted
# trade-off: a genuinely pale sky patch with luma > 0.75 and S < 0.20 is also
# excluded (documented in METRIC_SPEC.md).
WHITE_WALL_LUMA_MIN = 0.75
WHITE_WALL_SATURATION_MAX = 0.20
HORIZON_SEARCH_LOW = 0.05
HORIZON_SEARCH_HIGH = 0.70
HORIZON_FALLBACK = 0.40
HORIZON_ACCEPT_RATIO = 1.5
NEAR_WHITE_LUMA = 0.9
RED_CHANNEL_MIN = 0.30
RED_DOMINANCE = 1.30
RED_COMPONENT_MIN_SHARE = 0.0002  # 0.02 % of frame
DEFAULT_MAX_COMPONENT_PIXELS = 400_000


def detect_horizon(luma: np.ndarray) -> tuple[int, float, str]:
    """Detect the dominant horizontal edge used as the horizon row.

    Returns (row, edge_strength_ratio, source). The search band is rows
    [5 %, 70 %] of the frame; if no edge is at least 1.5x the median row-edge
    energy, the documented fallback is the 40 % line (i.e. "top 40 % is
    potential sky").
    """
    height = luma.shape[0]
    row_energy = np.abs(np.gradient(luma, axis=0)).mean(axis=1)
    window = max(3, (height // 60) | 1)
    smoothed = np.convolve(row_energy, np.ones(window, dtype=np.float64) / window, mode="same")

    low = int(HORIZON_SEARCH_LOW * height)
    high = int(HORIZON_SEARCH_HIGH * height)
    if high <= low + 1:
        return int(HORIZON_FALLBACK * height), 1.0, "fallback"

    segment = smoothed[low:high]
    index = low + int(np.argmax(segment))
    median = float(np.median(segment))
    ratio = float(smoothed[index] / median) if median > 1e-9 else 0.0
    if ratio >= HORIZON_ACCEPT_RATIO:
        return index, ratio, "edge"
    return int(HORIZON_FALLBACK * height), ratio, "fallback"


def erode4(mask: np.ndarray) -> np.ndarray:
    """4-neighbour erosion by one pixel (no scipy)."""
    eroded = mask.copy()
    eroded[1:, :] &= mask[:-1, :]
    eroded[:-1, :] &= mask[1:, :]
    eroded[:, 1:] &= mask[:, :-1]
    eroded[:, :-1] &= mask[:, 1:]
    return eroded


def _row_runs(mask: np.ndarray) -> tuple[list[list[int]], list[int], list[int], list[int]]:
    """Run-length encode a boolean mask by row.

    Returns (runs_per_row, run_rows, run_starts, run_ends) with end exclusive.
    """
    height = mask.shape[0]
    runs_per_row: list[list[int]] = []
    run_rows: list[int] = []
    run_starts: list[int] = []
    run_ends: list[int] = []
    for y in range(height):
        padded = np.concatenate(([False], mask[y], [False]))
        delta = np.diff(padded.astype(np.int8))
        starts = np.flatnonzero(delta == 1)
        ends = np.flatnonzero(delta == -1)
        indices: list[int] = []
        for start, end in zip(starts.tolist(), ends.tolist()):
            indices.append(len(run_rows))
            run_rows.append(y)
            run_starts.append(start)
            run_ends.append(end)
        runs_per_row.append(indices)
    return runs_per_row, run_rows, run_starts, run_ends


def _largest_component(mask: np.ndarray, min_area_px: int) -> tuple[int, np.ndarray | None]:
    """Largest 8-connected component of a boolean mask, numpy-only.

    Runs are union-found row by row, so cost is O(rows + runs), not O(pixels);
    components smaller than min_area_px are ignored (noise guard).
    """
    height, width = mask.shape
    runs_per_row, run_rows, run_starts, run_ends = _row_runs(mask)
    total_runs = len(run_rows)
    if total_runs == 0:
        return 0, None

    parent = list(range(total_runs))

    def find(index: int) -> int:
        root = index
        while parent[root] != root:
            root = parent[root]
        while parent[index] != root:
            parent[index], index = root, parent[index]
        return root

    def union(left: int, right: int) -> None:
        root_left, root_right = find(left), find(right)
        if root_left != root_right:
            parent[root_right] = root_left

    for y in range(height - 1):
        previous = runs_per_row[y]
        following = runs_per_row[y + 1]
        i = j = 0
        while i < len(previous) and j < len(following):
            left, right = previous[i], following[j]
            if run_starts[left] < run_ends[right] and run_starts[right] < run_ends[left]:
                union(left, right)
            if run_ends[left] < run_ends[right]:
                i += 1
            else:
                j += 1

    sizes: dict[int, int] = {}
    for index in range(total_runs):
        root = find(index)
        sizes[root] = sizes.get(root, 0) + run_ends[index] - run_starts[index]

    best_root: int | None = None
    best_size = 0
    for root, size in sizes.items():
        if size >= min_area_px and size > best_size:
            best_root, best_size = root, size
    if best_root is None:
        return 0, None

    component = np.zeros((height, width), dtype=bool)
    for index in range(total_runs):
        if find(index) == best_root:
            component[run_rows[index], run_starts[index] : run_ends[index]] = True
    return best_size, component


def guardrails_from_pixels(
    pixels: np.ndarray,
    meta: dict[str, int],
    horizon_override: int | None = None,
    max_component_pixels: int = DEFAULT_MAX_COMPONENT_PIXELS,
) -> dict[str, float | int | str | None]:
    """Compute the W1 perceptual guardrails on an already-loaded frame."""
    red, green, blue = pixels[..., 0], pixels[..., 1], pixels[..., 2]
    luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    maximum = pixels.max(axis=2)
    minimum = pixels.min(axis=2)
    saturation = np.where(maximum > 1e-5, (maximum - minimum) / np.maximum(maximum, 1e-5), 0)
    gradient_y, gradient_x = np.gradient(luma)
    gradient_magnitude = np.hypot(gradient_x, gradient_y)

    horizon_row, horizon_ratio, horizon_source = detect_horizon(luma)
    horizon_source_px: int | None = None
    if horizon_override is not None:
        source_height = max(1, int(meta["sourceHeight"]))
        horizon_row = int(round(horizon_override * luma.shape[0] / source_height))
        horizon_row = max(0, min(luma.shape[0] - 1, horizon_row))
        horizon_source = "override"
        horizon_source_px = int(horizon_override)

    rows = np.arange(luma.shape[0])[:, None]
    blue_mask = (blue > red * 1.05) & (blue > 0.45) & (blue > green * 1.02)
    sky_like = (
        blue_mask
        & (saturation <= SKY_SATURATION_MAX)
        & (luma >= SKY_LUMA_MIN)
        & (rows < horizon_row)
    )
    lit_wall = (luma > WHITE_WALL_LUMA_MIN) & (saturation < WHITE_WALL_SATURATION_MAX)
    sky_mask = sky_like & ~lit_wall
    sky_share = float(sky_mask.mean() * 100.0)
    lit_wall_share = float((sky_like & lit_wall).mean() * 100.0)

    near_white = luma > NEAR_WHITE_LUMA
    if near_white.any():
        interior = erode4(near_white)
        if not interior.any():
            interior = near_white  # small highlight: fall back to the raw mask
        seam_energy = float(gradient_magnitude[interior].mean())
    else:
        seam_energy = 0.0

    red_mask = (
        (red > RED_CHANNEL_MIN)
        & (red > green * RED_DOMINANCE)
        & (red > blue * RED_DOMINANCE)
    )
    height, width = luma.shape
    min_area_px = max(1, int(round(RED_COMPONENT_MIN_SHARE * height * width)))
    component_guard = "none"
    component_mask: np.ndarray | None
    if int(red_mask.sum()) > max_component_pixels:
        # Pathological frame (huge red area): decimate 2x for connectivity.
        component_guard = "decimated_x2"
        decimated = red_mask[::2, ::2]
        _, component_decimated = _largest_component(decimated, max(1, min_area_px // 4))
        if component_decimated is None:
            component_mask = None
        else:
            upscaled = np.repeat(np.repeat(component_decimated, 2, axis=0), 2, axis=1)
            component_mask = upscaled[:height, :width]
    else:
        _, component_mask = _largest_component(red_mask, min_area_px)

    if component_mask is not None and bool(component_mask.any()):
        area = int(component_mask.sum())
        red_route_share = float(100.0 * area / (height * width))
        red_route_saturation = float(saturation[component_mask].mean())
    else:
        red_route_share = 0.0
        red_route_saturation = 0.0

    return {
        "sky_mask_share": sky_share,
        "near_white_seam_energy": seam_energy,
        "red_route_share": red_route_share,
        "red_route_saturation": red_route_saturation,
        "sky_horizon_row": int(horizon_row),
        "sky_horizon_source_px": horizon_source_px,
        "sky_horizon_source": horizon_source,
        "sky_horizon_edge_ratio": float(horizon_ratio),
        "sky_lit_wall_pct": lit_wall_share,
        "component_guard": component_guard,
    }


def guardrails(
    path: str,
    horizon_override: int | None = None,
    max_component_pixels: int = DEFAULT_MAX_COMPONENT_PIXELS,
) -> dict[str, float | int | str | None]:
    """Convenience wrapper: load one frame and compute the guardrails."""
    pixels, meta = load_image_with_meta(path)
    return guardrails_from_pixels(pixels, meta, horizon_override, max_component_pixels)


def parse_horizon_overrides(values: list[str] | None) -> dict[str, object]:
    """Parse --horizon-px values: `Y` or `file:Y` tokens (comma-separated)."""
    default: int | None = None
    by_name: dict[str, int] = {}
    for value in values or []:
        for token in str(value).split(","):
            token = token.strip()
            if not token:
                continue
            if ":" in token:
                name, _, raw_y = token.rpartition(":")
                name = name.strip()
                if not name:
                    fail(f"error: malformed --horizon-px entry: {token!r}")
                try:
                    y = int(raw_y)
                except ValueError:
                    fail(f"error: --horizon-px expects an integer pixel row: {token!r}")
                if y < 0:
                    fail(f"error: --horizon-px must be >= 0: {token!r}")
                by_name[name] = y
                by_name[os.path.basename(name)] = y
                by_name[os.path.splitext(os.path.basename(name))[0]] = y
            else:
                try:
                    y = int(token)
                except ValueError:
                    fail(f"error: --horizon-px expects Y or file:Y: {token!r}")
                if y < 0:
                    fail(f"error: --horizon-px must be >= 0: {token!r}")
                default = y
    return {"default": default, "by_name": by_name}


def resolve_horizon_override(path: str, overrides: dict[str, object] | None) -> int | None:
    if not overrides:
        return None
    by_name = overrides.get("by_name") or {}
    if not isinstance(by_name, dict):
        return None
    base = os.path.basename(path)
    stem = os.path.splitext(base)[0]
    for candidate_key in (path, base, stem):
        if candidate_key in by_name:
            return int(by_name[candidate_key])
    default = overrides.get("default")
    return int(default) if isinstance(default, int) else None


def aggregate_series(
    per_frame: list[dict[str, object]], keys: list[str], field: str
) -> dict[str, dict[str, float]]:
    """mean / sample sd / min / p10 / p50 / p90 / max for a list of per-frame dicts."""
    aggregate: dict[str, dict[str, float]] = {}
    for key in keys:
        values = np.array(
            [float(frame[field][key]) for frame in per_frame], dtype=np.float64
        )
        aggregate[key] = {
            "mean": float(values.mean()),
            "sd": float(values.std(ddof=1)) if values.size > 1 else 0.0,
            "min": float(values.min()),
            "p10": float(np.percentile(values, 10)),
            "p50": float(np.percentile(values, 50)),
            "p90": float(np.percentile(values, 90)),
            "max": float(values.max()),
        }
    return aggregate


def guardrail_rows(
    measured_guardrails: dict[str, object],
    guardrail_aggregate: dict[str, dict[str, float]],
    primary_sky: float | None,
) -> tuple[list[dict[str, object]], dict[str, float]]:
    """Rows for JSON/markdown plus the primary-sky vs sky-mask context."""
    rows: list[dict[str, object]] = []
    for key in GUARDRAIL_KEYS:
        label, unit, _ = GUARDRAIL_INFO[key]
        reference = guardrail_aggregate[key]
        value = float(measured_guardrails[key])
        if value < reference["p10"]:
            position = "below p10-p90"
        elif value > reference["p90"]:
            position = "above p10-p90"
        else:
            position = "inside p10-p90"
        rows.append(
            {
                "guardrail": key,
                "label": label,
                "unit": unit,
                "value": value,
                "referenceMean": reference["mean"],
                "referenceSd": reference["sd"],
                "referenceP10": reference["p10"],
                "referenceP90": reference["p90"],
                "position": position,
            }
        )
    context: dict[str, float] = {}
    if primary_sky is not None:
        sky_mask = float(measured_guardrails["sky_mask_share"])
        context = {
            "primarySkyBlue": float(primary_sky),
            "skyMaskShare": sky_mask,
            "skyMaskOfPrimaryPct": (100.0 * sky_mask / primary_sky) if primary_sky > 0 else 0.0,
            "skyLitWallPct": float(measured_guardrails.get("sky_lit_wall_pct", 0.0)),
        }
    return rows, context


# ---------------------------------------------------------------------------
# Input expansion
# ---------------------------------------------------------------------------


def fail(message: str) -> "NoReturn":
    """Print an input/environment error and exit with code 2."""
    print(message, file=sys.stderr)
    raise SystemExit(2)


def is_image(path: str) -> bool:
    return path.lower().endswith(IMAGE_EXTENSIONS)


def expand_patterns(patterns: list[str]) -> list[str]:
    """Expand files, globs and directories into a de-duplicated image list.

    Directories contribute their top-level jpg/jpeg/png files. Globs may be
    recursive (`**`) and are filtered to images. Explicit files are kept even if
    the extension looks unusual; Pillow reports the real error.
    """
    found: list[str] = []
    seen: set[str] = set()

    for pattern in patterns:
        if os.path.isdir(pattern):
            matches = sorted(
                os.path.join(pattern, name) for name in os.listdir(pattern) if is_image(name)
            )
        elif glob.has_magic(pattern):
            matches = sorted(path for path in glob.glob(pattern, recursive=True) if is_image(path))
        elif os.path.isfile(pattern):
            matches = [pattern]
        else:
            fail(f"error: candidate not found: {pattern}")

        if not matches:
            fail(f"error: no jpg/png images matched: {pattern}")

        for path in matches:
            if path not in seen:
                seen.add(path)
                found.append(path)

    return found


# ---------------------------------------------------------------------------
# Reference computation
# ---------------------------------------------------------------------------


def resolve_reference(args: argparse.Namespace) -> tuple[str, str | None]:
    """Return (path, set_name) for the reference frame directory."""
    if args.reference:
        path = args.reference
        if not os.path.isdir(path):
            fail(f"error: reference directory not found: {path}")
        return path, None

    set_name = args.reference_set or DEFAULT_REFERENCE_SET
    if set_name not in REFERENCE_SETS:
        fail(f"error: unknown reference set {set_name!r}; known: {', '.join(REFERENCE_SETS)}")
    relative = REFERENCE_SETS[set_name]
    path = os.path.join(REPO_ROOT, relative)
    if not os.path.isdir(path):
        fail(
            f"error: reference set {set_name!r} not found at {path}\n"
            "       ref/ is local-only; restore the reference frames or pass --reference <dir>"
        )
    return relative, set_name


def compute_reference(
    path: str,
    with_guardrails: bool = False,
    horizon_overrides: dict[str, object] | None = None,
    max_component_pixels: int = DEFAULT_MAX_COMPONENT_PIXELS,
) -> tuple[
    list[dict[str, object]],
    dict[str, dict[str, float]],
    dict[str, dict[str, float]],
]:
    """Per-frame metrics (and optional guardrails) plus aggregate spread statistics."""
    files = expand_patterns([path])
    per_frame: list[dict[str, object]] = []
    for file in files:
        pixels, meta = load_image_with_meta(file)
        entry: dict[str, object] = {
            "file": os.path.relpath(file, REPO_ROOT),
            "metrics": metrics_from_pixels(pixels),
        }
        if with_guardrails:
            entry["guardrails"] = guardrails_from_pixels(
                pixels,
                meta,
                resolve_horizon_override(file, horizon_overrides),
                max_component_pixels,
            )
        per_frame.append(entry)

    aggregate = aggregate_series(per_frame, METRIC_KEYS, "metrics")
    guardrail_aggregate = (
        aggregate_series(per_frame, GUARDRAIL_KEYS, "guardrails") if with_guardrails else {}
    )
    return per_frame, aggregate, guardrail_aggregate


# ---------------------------------------------------------------------------
# Bands, verdicts and formatting
# ---------------------------------------------------------------------------


BANDS_MODES = ("all", "legacy", "shifted", "tolerance")
DEFAULT_BANDS_MODE = "all"
LEGACY_SOURCE = (
    "docs/VISUAL_AUDIO_LEVEL_PLAN.md §2.1 (predecessor harness; identical to "
    "docs/GLASSLINE_REFERENCE_AUDIT.md §2.3 table)"
)
SHIFT_FORMULA = (
    "shifted_min = legacy_min + delta; shifted_max = legacy_max + delta; "
    "delta = measured_ref_mean - legacy_ref"
)


def band_label(spec: dict[str, float | None]) -> str:
    low, high = spec.get("min"), spec.get("max")
    if low is not None and high is not None:
        return f"{low:g}..{high:g}"
    if low is not None:
        return f">={low:g}"
    if high is not None:
        return f"<={high:g}"
    return "-"


def inside_band(value: float, spec: dict[str, float | None]) -> bool:
    low, high = spec.get("min"), spec.get("max")
    if low is not None and value < low:
        return False
    if high is not None and value > high:
        return False
    return True


def band_gap(value: float, spec: dict[str, float | None]) -> float:
    """Signed distance to the nearest band edge in metric units.

    Positive = margin inside the band, negative = how far outside it is.
    """
    low, high = spec.get("min"), spec.get("max")
    if low is not None and value < low:
        return value - low
    if high is not None and value > high:
        return high - value
    margins = []
    if low is not None:
        margins.append(value - low)
    if high is not None:
        margins.append(high - value)
    return min(margins) if margins else 0.0


def band_spec_json(spec: dict[str, float | None]) -> dict[str, object]:
    return {"min": spec.get("min"), "max": spec.get("max"), "label": band_label(spec)}


def compute_shifted_bands(
    aggregate: dict[str, dict[str, float]]
) -> dict[str, dict[str, float]]:
    """Rebase the plan §2.1 bands onto the measured reference mean.

    shifted band = legacy band + delta, delta = measured_ref_mean - legacy_ref.
    Band widths and one-sided margins are preserved 1:1, so by construction the
    measured reference mean is inside every shifted band; that is asserted here.
    """
    shifted: dict[str, dict[str, float]] = {}
    for key in METRIC_KEYS:
        spec = PLAN_BANDS[key]
        delta = aggregate[key]["mean"] - spec["legacy"]
        band: dict[str, float | None] = {
            "legacy": spec["legacy"],
            "delta": delta,
            "min": None if spec["min"] is None else spec["min"] + delta,
            "max": None if spec["max"] is None else spec["max"] + delta,
        }
        if not inside_band(aggregate[key]["mean"], band):
            fail(
                f"internal error: shifted band for {key!r} does not contain the measured "
                f"reference mean {aggregate[key]['mean']:.6f} (band {band_label(band)})"
            )
        shifted[key] = band  # type: ignore[assignment]
    return shifted


def tolerance_verdict(key: str, value: float, measured_mean: float) -> str:
    return "PASS" if abs(value - measured_mean) <= TOLERANCES[key] else "WATCH"


def shifted_verdict(
    key: str, value: float, shifted: dict[str, dict[str, float]]
) -> str:
    return "PASS" if inside_band(value, shifted[key]) else "FAIL"


def legacy_verdict(key: str, value: float) -> str:
    return "PASS" if inside_band(value, PLAN_BANDS[key]) else "FAIL"


def fmt(value: float) -> str:
    return f"{value:.4f}"


def delta_pct(delta: float, legacy: float) -> float:
    return (delta / legacy * 100.0) if abs(legacy) > 1e-12 else 0.0


def reference_rows(
    aggregate: dict[str, dict[str, float]],
    shifted: dict[str, dict[str, float]],
    with_bands: bool,
) -> list[dict[str, object]]:
    rows = []
    for key in METRIC_KEYS:
        label, unit, _ = METRIC_INFO[key]
        stats = aggregate[key]
        legacy = PLAN_BANDS[key]["legacy"]
        delta = stats["mean"] - legacy
        row: dict[str, object] = {
            "metric": key,
            "label": label,
            "unit": unit,
            "mean": stats["mean"],
            "sd": stats["sd"],
            "min": stats["min"],
            "p10": stats["p10"],
            "p50": stats["p50"],
            "p90": stats["p90"],
            "max": stats["max"],
            "legacy": legacy,
            "delta": delta,
            "deltaPct": delta_pct(delta, legacy),
            "tolerance": TOLERANCES[key],
            "legacyBand": band_label(PLAN_BANDS[key]),
            "shift": shifted[key]["delta"],
            "shiftedBand": band_label(shifted[key]),
            "refShifted": "PASS" if inside_band(stats["mean"], shifted[key]) else "FAIL",
            "refLegacy": "PASS" if inside_band(stats["mean"], PLAN_BANDS[key]) else "FAIL",
        }
        if with_bands:
            row["gapShifted"] = band_gap(stats["mean"], shifted[key])
            row["gapLegacy"] = band_gap(stats["mean"], PLAN_BANDS[key])
        rows.append(row)
    return rows


def candidate_rows(
    measured: dict[str, float],
    aggregate: dict[str, dict[str, float]],
    shifted: dict[str, dict[str, float]],
) -> list[dict[str, object]]:
    rows = []
    for key in METRIC_KEYS:
        label, unit, _ = METRIC_INFO[key]
        value = measured[key]
        stats = aggregate[key]
        legacy = PLAN_BANDS[key]["legacy"]
        verdicts = {
            "shifted": shifted_verdict(key, value, shifted),
            "tolerance": tolerance_verdict(key, value, stats["mean"]),
            "legacy": legacy_verdict(key, value),
        }
        rows.append(
            {
                "metric": key,
                "label": label,
                "unit": unit,
                "candidate": value,
                "reference": stats["mean"],
                "referenceSd": stats["sd"],
                "referenceP10": stats["p10"],
                "referenceP50": stats["p50"],
                "referenceP90": stats["p90"],
                "referenceLegacy": legacy,
                "shift": shifted[key]["delta"],
                "tolerance": TOLERANCES[key],
                "bands": {
                    "legacy": band_spec_json(PLAN_BANDS[key]),
                    "shifted": band_spec_json(shifted[key]),
                },
                "gaps": {
                    "shifted": band_gap(value, shifted[key]),
                    "legacy": band_gap(value, PLAN_BANDS[key]),
                },
                "verdicts": verdicts,
                "pass": verdicts["tolerance"] == "PASS",
                "accepted": verdicts["shifted"] == "PASS",
            }
        )
    return rows


def summarize(rows: list[dict[str, object]]) -> dict[str, dict[str, int]]:
    total = len(rows)

    def count(mode: str, result: str) -> int:
        return sum(1 for row in rows if row["verdicts"][mode] == result)

    return {
        "shifted": {
            "pass": count("shifted", "PASS"),
            "fail": count("shifted", "FAIL"),
            "total": total,
        },
        "legacy": {
            "pass": count("legacy", "PASS"),
            "fail": count("legacy", "FAIL"),
            "total": total,
        },
        "tolerance": {
            "pass": count("tolerance", "PASS"),
            "watch": count("tolerance", "WATCH"),
            "fail": 0,
            "total": total,
        },
    }


def summary_line(summary: dict[str, dict[str, int]], mode: str) -> str:
    shifted = summary["shifted"]
    legacy = summary["legacy"]
    tolerance = summary["tolerance"]
    text = (
        f"{shifted['pass']}/{shifted['total']} shifted PASS, {shifted['fail']} FAIL | "
        f"{tolerance['pass']}/{tolerance['total']} tolerance PASS, "
        f"{tolerance['watch']} WATCH | "
        f"{legacy['pass']}/{legacy['total']} legacy PASS, {legacy['fail']} FAIL"
    )
    if mode == "shifted":
        return f"{shifted['pass']}/{shifted['total']} shifted PASS, {shifted['fail']} FAIL"
    if mode == "legacy":
        return f"{legacy['pass']}/{legacy['total']} legacy PASS, {legacy['fail']} FAIL"
    if mode == "tolerance":
        return f"{tolerance['pass']}/{tolerance['total']} tolerance PASS, {tolerance['watch']} WATCH"
    return text


# ---------------------------------------------------------------------------
# Console rendering
# ---------------------------------------------------------------------------


def print_reference(
    path: str,
    frames: int,
    set_name: str | None,
    rows: list[dict[str, object]],
    with_bands: bool,
) -> None:
    suffix = f", set={set_name}" if set_name else ""
    print(f"Reference: {path} ({frames} frames{suffix})")
    header = (
        f"  {'metric':<18} {'mean':>8} {'sd':>8} {'min':>8} {'p10':>8} "
        f"{'p50':>8} {'p90':>8} {'legacy':>8} {'delta':>9} {'delta%':>8}"
    )
    if with_bands:
        header += f" {'shifted band':>19} {'refS':>5} {'refL':>5}"
    print(header)
    for row in rows:
        line = (
            f"  {row['label']:<18} {fmt(row['mean']):>8} {fmt(row['sd']):>8} "
            f"{fmt(row['min']):>8} {fmt(row['p10']):>8} {fmt(row['p50']):>8} "
            f"{fmt(row['p90']):>8} {fmt(row['legacy']):>8} {row['delta']:>+9.4f} "
            f"{row['deltaPct']:>+8.1f}"
        )
        if with_bands:
            line += f" {row['shiftedBand']:>19} {row['refShifted']:>5} {row['refLegacy']:>5}"
        print(line)
    if with_bands:
        shifted_pass = sum(1 for row in rows if row["refShifted"] == "PASS")
        print(
            f"  shifted bands = plan §2.1 band + delta (delta = measured mean - legacy); "
            f"measured reference mean inside {shifted_pass}/{len(rows)} shifted bands"
        )
        print(
            f"  legacy bands (traceability only): measured reference mean inside "
            f"{sum(1 for row in rows if row['refLegacy'] == 'PASS')}/{len(rows)}"
        )


def print_candidate(
    path: str,
    rows: list[dict[str, object]],
    summary: dict[str, dict[str, int]],
    mode: str,
) -> None:
    print(f"\nCandidate: {path}")
    if mode == "all":
        print(
            f"  {'metric':<18} {'value':>8} {'ref':>8} {'delta':>9} "
            f"{'shifted band':>19} {'gap':>9}  {'shift':>5} {'tol':>5} {'legacy':>6}"
        )
        for row in rows:
            print(
                f"  {row['label']:<18} {fmt(row['candidate']):>8} {fmt(row['reference']):>8} "
                f"{row['candidate'] - row['reference']:>+9.4f} {row['bands']['shifted']['label']:>19} "
                f"{row['gaps']['shifted']:>+9.4f}  {row['verdicts']['shifted']:>5} "
                f"{row['verdicts']['tolerance']:>5} {row['verdicts']['legacy']:>6}"
            )
    elif mode == "shifted":
        print(
            f"  {'metric':<18} {'value':>8} {'ref':>8} {'delta':>9} "
            f"{'shifted band':>19} {'gap':>9}  verdict"
        )
        for row in rows:
            print(
                f"  {row['label']:<18} {fmt(row['candidate']):>8} {fmt(row['reference']):>8} "
                f"{row['candidate'] - row['reference']:>+9.4f} {row['bands']['shifted']['label']:>19} "
                f"{row['gaps']['shifted']:>+9.4f}  {row['verdicts']['shifted']}"
            )
    elif mode == "legacy":
        print(
            f"  {'metric':<18} {'value':>8} {'ref':>8} {'delta':>9} "
            f"{'legacy band':>19} {'gap':>9}  verdict"
        )
        for row in rows:
            print(
                f"  {row['label']:<18} {fmt(row['candidate']):>8} {fmt(row['reference']):>8} "
                f"{row['candidate'] - row['reference']:>+9.4f} {row['bands']['legacy']['label']:>19} "
                f"{row['gaps']['legacy']:>+9.4f}  {row['verdicts']['legacy']}"
            )
    else:  # tolerance
        print(
            f"  {'metric':<18} {'value':>8} {'ref':>8} {'delta':>9} "
            f"{'tolerance':>9}  verdict"
        )
        for row in rows:
            print(
                f"  {row['label']:<18} {fmt(row['candidate']):>8} {fmt(row['reference']):>8} "
                f"{row['candidate'] - row['reference']:>+9.4f} {row['tolerance']:>9.4f}  "
                f"{row['verdicts']['tolerance']}"
            )
    print(f"  {summary_line(summary, mode)}")


def print_guardrail_reference(
    path: str, frames: int, aggregate: dict[str, dict[str, float]]
) -> None:
    print(
        f"\nPerceptual guardrails (W1, diagnostic only, not PASS/FAIL) — "
        f"reference: {path} ({frames} frames)"
    )
    print(f"  {'guardrail':<24} {'mean':>9} {'sd':>9} {'p10':>9} {'p90':>9}")
    for key in GUARDRAIL_KEYS:
        label, unit, _ = GUARDRAIL_INFO[key]
        stats = aggregate[key]
        print(
            f"  {label:<24} {fmt(stats['mean']):>9} {fmt(stats['sd']):>9} "
            f"{fmt(stats['p10']):>9} {fmt(stats['p90']):>9}"
        )
    print("  these numbers are review inputs; they do not gate anything")


def print_candidate_guardrails(
    measured_guardrails: dict[str, object],
    aggregate: dict[str, dict[str, float]],
    primary_sky: float | None,
) -> None:
    print("  guardrails (W1, diagnostic only):")
    print(f"    {'guardrail':<24} {'value':>9} {'ref mean':>9} {'ref p10..p90':>19}")
    for key in GUARDRAIL_KEYS:
        label, unit, _ = GUARDRAIL_INFO[key]
        stats = aggregate[key]
        band = f"{fmt(stats['p10'])}..{fmt(stats['p90'])}"
        print(
            f"    {label:<24} {fmt(float(measured_guardrails[key])):>9} "
            f"{fmt(stats['mean']):>9} {band:>19}"
        )
    if primary_sky is not None:
        sky_mask = float(measured_guardrails["sky_mask_share"])
        ratio = (100.0 * sky_mask / primary_sky) if primary_sky > 0 else 0.0
        horizon_px = measured_guardrails["sky_horizon_source_px"]
        horizon_note = (
            f"override {horizon_px}px (source)"
            if horizon_px is not None
            else f"row {measured_guardrails['sky_horizon_row']} ({measured_guardrails['sky_horizon_source']})"
        )
        print(
            f"    sky check: primary sky-blue {primary_sky:.1f} % -> sky mask {sky_mask:.1f} % "
            f"({ratio:.0f} % of the primary share looks like sky; lit-wall exclusion removed "
            f"{float(measured_guardrails.get('sky_lit_wall_pct', 0.0)):.1f} pp); horizon {horizon_note}"
        )
    if measured_guardrails.get("component_guard") not in (None, "none"):
        print(f"    component guard: {measured_guardrails['component_guard']}")


def print_metric_list() -> None:
    print(f"{'metric':<16} {'unit':<9} {'legacy':>8}  {'legacy band':<12} definition")
    for key in METRIC_KEYS:
        label, unit, definition = METRIC_INFO[key]
        spec = PLAN_BANDS[key]
        print(
            f"{key:<16} {unit:<9} {spec['legacy']:>8g}  {band_label(spec):<12} {definition}"
        )
    print()
    print(
        "Shifted bands are derived at runtime: shifted = legacy + (measured_ref_mean - legacy_ref)."
    )
    print()
    print("Perceptual guardrails (W1, diagnostic only; require --guardrails, no PASS/FAIL):")
    for key in GUARDRAIL_KEYS:
        label, unit, definition = GUARDRAIL_INFO[key]
        print(f"  {key:<24} {unit:<9} {definition}")


# ---------------------------------------------------------------------------
# Markdown rendering
# ---------------------------------------------------------------------------


def markdown_reference(
    path: str,
    frames: int,
    set_name: str | None,
    rows: list[dict[str, object]],
    with_bands: bool,
) -> list[str]:
    lines = [
        "# Glassline metrics report",
        "",
        "Script: `tools/capture/metrics.py` (v2.2; formulas unchanged from v1). "
        "Band policy: `docs/reports/METRIC_SPEC.md` (shifted bands = plan §2.1 + "
        "`delta = measured_ref_mean - legacy_ref`).",
        f"Reference: `{path}` ({frames} frames" + (f", set `{set_name}`)" if set_name else ")") + ".",
        "",
    ]
    if with_bands:
        lines += [
            "## Reference recomputed by this script",
            "",
            "| Metric | Mean ± SD | Min | p10 | p50 | p90 | Legacy | Δ | Δ % | v1 tol | Legacy band | Shifted band | Ref shifted | Ref legacy |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|:---:|:---:|",
        ]
        for row in rows:
            lines.append(
                f"| {row['label']} | {fmt(row['mean'])} ± {fmt(row['sd'])} | "
                f"{fmt(row['min'])} | {fmt(row['p10'])} | {fmt(row['p50'])} | {fmt(row['p90'])} | "
                f"{fmt(row['legacy'])} | {row['delta']:+.4f} | {row['deltaPct']:+.1f} % | "
                f"{row['tolerance']:.4f} | {row['legacyBand']} | {row['shiftedBand']} | "
                f"{row['refShifted']} | {row['refLegacy']} |"
            )
    else:
        lines += [
            "## Reference recomputed by this script",
            "",
            "| Metric | Mean | SD | Min | p10 | p50 | p90 | Legacy | Delta | Delta % |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
        for row in rows:
            lines.append(
                f"| {row['label']} | {fmt(row['mean'])} | {fmt(row['sd'])} | {fmt(row['min'])} | "
                f"{fmt(row['p10'])} | {fmt(row['p50'])} | {fmt(row['p90'])} | "
                f"{fmt(row['legacy'])} | {row['delta']:+.4f} | {row['deltaPct']:+.1f} % |"
            )
    lines.append("")
    return lines


def markdown_guardrails_reference(
    path: str, frames: int, aggregate: dict[str, dict[str, float]]
) -> list[str]:
    lines = [
        "## Perceptual guardrails (W1, diagnostic only)",
        "",
        "These are **not** part of the 13 §2.1 metrics and **not** PASS/FAIL gates. "
        "They are review inputs that expose blue-glass-sky, flat-clipped-white and "
        "salmon/fragmented-route failure modes. Definitions and limitations: "
        "`docs/reports/METRIC_SPEC.md`.",
        "",
        f"Measured on the same reference set (`{path}`, {frames} frames):",
        "",
        "| Guardrail | Ref mean | SD | p10 | p90 |",
        "|---|---:|---:|---:|---:|",
    ]
    for key in GUARDRAIL_KEYS:
        label, _unit, _definition = GUARDRAIL_INFO[key]
        stats = aggregate[key]
        lines.append(
            f"| {label} | {fmt(stats['mean'])} | {fmt(stats['sd'])} | "
            f"{fmt(stats['p10'])} | {fmt(stats['p90'])} |"
        )
    lines += [
        "",
        "Reading: read `Sky mask share` next to the primary `Sky-blue area` row — "
        "a large gap means most blue pixels are not sky. `Near-white seam energy` "
        "near 0 means flat clipped white. A small `Red route share` with low "
        "`Red route saturation` means a fragmented or salmon route.",
        "",
    ]
    return lines


def markdown_candidates(
    candidates: list[dict[str, object]], mode: str
) -> list[str]:
    lines = ["## Candidates", ""]
    for candidate in candidates:
        rows = candidate["rows"]
        summary = candidate["summary"]
        lines.append(f"### `{candidate['path']}`")
        lines.append("")
        if mode == "all":
            lines.append(
                "| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted | Tolerance | Legacy |"
            )
            lines.append("|---|---:|---:|---:|---|---:|:---:|:---:|:---:|")
        elif mode == "shifted":
            lines.append("| Metric | Value | Ref mean | Delta | Shifted band | Gap | Shifted |")
            lines.append("|---|---:|---:|---:|---|---:|:---:|")
        elif mode == "legacy":
            lines.append("| Metric | Value | Ref mean | Delta | Legacy band | Gap | Legacy |")
            lines.append("|---|---:|---:|---:|---|---:|:---:|")
        else:
            lines.append("| Metric | Value | Ref mean | Delta | Tolerance | Tolerance verdict |")
            lines.append("|---|---:|---:|---:|---:|:---:|")
        for row in rows:
            if mode == "all":
                lines.append(
                    f"| {row['label']} | {fmt(row['candidate'])} | {fmt(row['reference'])} | "
                    f"{row['candidate'] - row['reference']:+.4f} | "
                    f"{row['bands']['shifted']['label']} | {row['gaps']['shifted']:+.4f} | "
                    f"{row['verdicts']['shifted']} | {row['verdicts']['tolerance']} | "
                    f"{row['verdicts']['legacy']} |"
                )
            elif mode == "shifted":
                lines.append(
                    f"| {row['label']} | {fmt(row['candidate'])} | {fmt(row['reference'])} | "
                    f"{row['candidate'] - row['reference']:+.4f} | "
                    f"{row['bands']['shifted']['label']} | {row['gaps']['shifted']:+.4f} | "
                    f"{row['verdicts']['shifted']} |"
                )
            elif mode == "legacy":
                lines.append(
                    f"| {row['label']} | {fmt(row['candidate'])} | {fmt(row['reference'])} | "
                    f"{row['candidate'] - row['reference']:+.4f} | "
                    f"{row['bands']['legacy']['label']} | {row['gaps']['legacy']:+.4f} | "
                    f"{row['verdicts']['legacy']} |"
                )
            else:
                lines.append(
                    f"| {row['label']} | {fmt(row['candidate'])} | {fmt(row['reference'])} | "
                    f"{row['candidate'] - row['reference']:+.4f} | {row['tolerance']:.4f} | "
                    f"{row['verdicts']['tolerance']} |"
                )
        lines.append("")
        lines.append(f"**{summary_line(summary, mode)}**")
        lines.append("")
        guardrail_rows_data = candidate.get("guardrailRows")
        if guardrail_rows_data:
            lines.append("#### Perceptual guardrails (diagnostic only, not a PASS/FAIL gate)")
            lines.append("")
            lines.append("| Guardrail | Value | Ref mean | Ref p10–p90 | Position |")
            lines.append("|---|---:|---:|---|---|")
            for row in guardrail_rows_data:
                lines.append(
                    f"| {row['label']} | {fmt(row['value'])} | {fmt(row['referenceMean'])} | "
                    f"{fmt(row['referenceP10'])}..{fmt(row['referenceP90'])} | {row['position']} |"
                )
            context = candidate.get("guardrailContext") or {}
            if context:
                lines.append("")
                lines.append(
                    f"sky check: primary sky-blue {context['primarySkyBlue']:.1f} % -> "
                    f"sky mask {context['skyMaskShare']:.1f} % "
                    f"({context['skyMaskOfPrimaryPct']:.0f} % of the primary share looks like sky; "
                    f"lit-wall exclusion removed {context.get('skyLitWallPct', 0.0):.1f} pp)."
                )
            lines.append("")
    return lines


# ---------------------------------------------------------------------------
# JSON schema
# ---------------------------------------------------------------------------


def reference_document(
    path: str,
    set_name: str | None,
    per_frame: list[dict[str, object]],
    aggregate: dict[str, dict[str, float]],
) -> dict[str, object]:
    return {
        "schemaVersion": 2,
        "kind": "reference",
        "script": "tools/capture/metrics.py",
        "set": set_name,
        "path": path,
        "frames": len(per_frame),
        "resizeLongEdge": 960,
        "sdConvention": "sample standard deviation (ddof=1) across frames",
        "percentileConvention": "numpy linear interpolation across per-frame metric values",
        "metrics": aggregate,
        "perFrame": per_frame,
        "legacyReference": {key: PLAN_BANDS[key]["legacy"] for key in METRIC_KEYS},
        "bands": {
            key: {
                "legacy": PLAN_BANDS[key]["legacy"],
                "min": PLAN_BANDS[key]["min"],
                "max": PLAN_BANDS[key]["max"],
                "label": band_label(PLAN_BANDS[key]),
                "unit": METRIC_INFO[key][1],
            }
            for key in METRIC_KEYS
        },
        "tolerances": TOLERANCES,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Measure Glassline captures against the prologue reference set.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage:", 1)[1].split("Exit codes:", 1)[0],
    )
    parser.add_argument(
        "--reference-set",
        choices=sorted(REFERENCE_SETS),
        default=None,
        help=f"Named reference set (default: {DEFAULT_REFERENCE_SET})",
    )
    parser.add_argument(
        "--reference",
        help="Explicit reference frame directory (overrides --reference-set)",
    )
    parser.add_argument(
        "--reference-json",
        help="Write the reference-measurement document (stats + per-frame values) here",
    )
    parser.add_argument(
        "--candidate",
        action="append",
        nargs="+",
        metavar="PATH",
        help="Candidate file, glob (quoted) or directory; repeatable",
    )
    parser.add_argument("--json", help="Write the full report as JSON to this path")
    parser.add_argument("--markdown", help="Write the full report as Markdown to this path")
    parser.add_argument(
        "--bands",
        action="store_true",
        help="Compare candidates with acceptance bands (default band mode: all)",
    )
    parser.add_argument(
        "--bands-mode",
        choices=BANDS_MODES,
        default=None,
        help=(
            "all = shifted + tolerance + legacy verdicts (default with --bands); "
            "shifted = W0 acceptance; legacy = raw plan §2.1; tolerance = v1 gauge"
        ),
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 on FAIL in the selected acceptance scheme (shifted by default; "
        "legacy in legacy mode; WATCH in tolerance mode)",
    )
    parser.add_argument(
        "--guardrails",
        action="store_true",
        help="Add the W1 perceptual guardrail layer (diagnostic only; separate from the "
        "13 §2.1 metrics, never a PASS/FAIL gate)",
    )
    parser.add_argument(
        "--horizon-px",
        action="append",
        metavar="Y|FILE:Y[,...]",
        help="Horizon row for the sky-mask guardrail, in source-image pixels. "
        "Per-file overrides as file:Y (comma-separated or repeatable). "
        "Default: scene-derived horizontal edge, fallback top 40%%.",
    )
    parser.add_argument(
        "--max-component-pixels",
        type=int,
        default=DEFAULT_MAX_COMPONENT_PIXELS,
        help=f"Safety guard for red-component analysis (default {DEFAULT_MAX_COMPONENT_PIXELS}); "
        "larger red masks are decimated 2x",
    )
    parser.add_argument(
        "--list-metrics",
        action="store_true",
        help="Print the 13 metric keys, units, legacy reference and bands, then exit",
    )
    return parser


def write_json(path: str, document: dict[str, object]) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def primary_scheme(mode: str) -> str:
    """Scheme used by --strict: shifted is the W0 acceptance scheme."""
    if mode == "legacy":
        return "legacy"
    if mode == "tolerance":
        return "tolerance"
    return "shifted"


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.list_metrics:
        print_metric_list()
        return 0

    if args.bands_mode and not args.bands:
        args.bands = True
    with_bands = bool(args.bands)
    # Without --bands keep the v1 tolerance-only report; --bands defaults to "all".
    mode = args.bands_mode or (DEFAULT_BANDS_MODE if with_bands else "tolerance")

    horizon_overrides = parse_horizon_overrides(args.horizon_px)
    if args.max_component_pixels <= 0:
        fail("error: --max-component-pixels must be > 0")

    reference_path, set_name = resolve_reference(args)
    per_frame, aggregate, guardrail_aggregate = compute_reference(
        reference_path,
        with_guardrails=bool(args.guardrails),
        horizon_overrides=horizon_overrides,
        max_component_pixels=args.max_component_pixels,
    )
    shifted = compute_shifted_bands(aggregate)
    ref_rows = reference_rows(aggregate, shifted, with_bands)

    print_reference(reference_path, len(per_frame), set_name, ref_rows, with_bands)
    if args.guardrails:
        print_guardrail_reference(reference_path, len(per_frame), guardrail_aggregate)

    reference_doc = reference_document(reference_path, set_name, per_frame, aggregate)
    if args.reference_json:
        write_json(args.reference_json, reference_doc)
        print(f"\nReference document written to {args.reference_json}")

    candidate_paths = expand_patterns([item for group in (args.candidate or []) for item in group])

    report: dict[str, object] = {
        "schemaVersion": 2,
        "script": "tools/capture/metrics.py",
        "reference": reference_path,
        "referenceSet": set_name,
        "referenceFrames": len(per_frame),
        "referenceStats": aggregate,
        "referencePerFrame": per_frame,
        "legacyReference": reference_doc["legacyReference"],
        "bands": reference_doc["bands"],
        "tolerances": TOLERANCES,
        "bandsMode": mode if with_bands else None,
        "bandPolicy": {
            "decision": "W0 band policy, 2026-11-19",
            "legacySource": LEGACY_SOURCE,
            "formula": SHIFT_FORMULA,
            "shiftedBands": {
                key: {
                    "legacy": shifted[key]["legacy"],
                    "delta": shifted[key]["delta"],
                    "min": shifted[key]["min"],
                    "max": shifted[key]["max"],
                    "label": band_label(shifted[key]),
                }
                for key in METRIC_KEYS
            },
            "referenceMeanInsideShiftedBands": (
                f"{sum(1 for key in METRIC_KEYS if inside_band(aggregate[key]['mean'], shifted[key]))}"
                f"/{len(METRIC_KEYS)}"
            ),
            "referenceMeanInsideLegacyBands": (
                f"{sum(1 for key in METRIC_KEYS if inside_band(aggregate[key]['mean'], PLAN_BANDS[key]))}"
                f"/{len(METRIC_KEYS)}"
            ),
            "appliesTo": "the six fixed capture shots, not arbitrary gameplay frames",
        },
                "candidates": [],
    }

    if args.guardrails:
        report["guardrails"] = {
            "note": "W1 perceptual guardrail layer; diagnostic only, not part of the 13 §2.1 "
            "metrics and not a PASS/FAIL gate",
            "referencePolicy": "measured reference is truth; bands are the p10-p90 of the "
            "20-frame reference set (same D-02 policy as the main table)",
            "referenceFrames": len(per_frame),
            "reference": guardrail_aggregate,
            "referencePerFrame": [
                {"file": frame["file"], "guardrails": frame["guardrails"]}
                for frame in per_frame
                if "guardrails" in frame
            ],
        }

    markdown_candidates_payload: list[dict[str, object]] = []
    strict_fail = False
    tolerance_all_pass = True
    scheme = primary_scheme(mode)

    for candidate_path in candidate_paths:
        pixels, meta = load_image_with_meta(candidate_path)
        measured = metrics_from_pixels(pixels)
        rows = candidate_rows(measured, aggregate, shifted)
        summary = summarize(rows)
        print_candidate(candidate_path, rows, summary, mode)

        guardrail_values = None
        guardrail_row_data = None
        guardrail_context = None
        if args.guardrails:
            guardrail_values = guardrails_from_pixels(
                pixels,
                meta,
                resolve_horizon_override(candidate_path, horizon_overrides),
                args.max_component_pixels,
            )
            print_candidate_guardrails(guardrail_values, guardrail_aggregate, measured["sky"])
            guardrail_row_data, guardrail_context = guardrail_rows(
                guardrail_values, guardrail_aggregate, measured["sky"]
            )

        if scheme == "tolerance":
            strict_fail = strict_fail or summary["tolerance"]["watch"] > 0
        else:
            strict_fail = strict_fail or summary[scheme]["fail"] > 0
        tolerance_all_pass = tolerance_all_pass and summary["tolerance"]["pass"] >= len(rows) - 3

        candidate_entry: dict[str, object] = {
            "path": candidate_path,
            "metrics": measured,
            "rows": rows,
            "passed": summary["tolerance"]["pass"],
            "watch": summary["tolerance"]["watch"],
            "failed": summary["tolerance"]["fail"],
            "total": len(rows),
            "shiftedPassed": summary["shifted"]["pass"],
            "legacyPassed": summary["legacy"]["pass"],
            "accepted": summary["shifted"]["pass"] == len(rows),
            "summary": summary,
        }
        if args.guardrails:
            candidate_entry["guardrails"] = guardrail_values
            candidate_entry["guardrailRows"] = guardrail_row_data
            candidate_entry["guardrailContext"] = guardrail_context
        report["candidates"].append(candidate_entry)

        markdown_entry: dict[str, object] = {
            "path": candidate_path,
            "rows": rows,
            "summary": summary,
        }
        if args.guardrails:
            markdown_entry["guardrailRows"] = guardrail_row_data
            markdown_entry["guardrailContext"] = guardrail_context
        markdown_candidates_payload.append(markdown_entry)

    if args.json:
        write_json(args.json, report)
        print(f"\nReport written to {args.json}")

    if args.markdown:
        lines = markdown_reference(reference_path, len(per_frame), set_name, ref_rows, with_bands)
        if args.guardrails:
            lines += markdown_guardrails_reference(reference_path, len(per_frame), guardrail_aggregate)
        lines += markdown_candidates(markdown_candidates_payload, mode)
        parent = os.path.dirname(args.markdown)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(args.markdown, "w", encoding="utf-8") as handle:
            handle.write("\n".join(lines))
            handle.write("\n")
        print(f"Markdown written to {args.markdown}")

    if candidate_paths:
        if args.strict:
            return 1 if strict_fail else 0
        if with_bands:
            # Report-only by default; use --strict to gate a build/CI run.
            return 0
        # v1 compatibility: success when at most 3 metrics per candidate are
        # outside the historical tolerance (the "n-3" rule).
        return 0 if tolerance_all_pass else 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
