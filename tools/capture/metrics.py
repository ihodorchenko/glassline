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


def load_image(path: str) -> np.ndarray:
    """Load an image as 0..1 float RGB, resizing so max(width, height) == 960."""
    image = Image.open(path).convert("RGB")
    width, height = image.size
    scale = 960 / max(width, height)

    if scale < 1:
        image = image.resize((int(width * scale), int(height * scale)), Image.LANCZOS)

    return np.asarray(image).astype(np.float32) / 255.0


def metrics(path: str) -> dict[str, float]:
    """Compute the 13 metrics for one frame. Formulas are v1-identical."""
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


def compute_reference(path: str) -> tuple[list[dict[str, object]], dict[str, dict[str, float]]]:
    """Per-frame metrics plus aggregate mean/sd/min/p10/p50/p90/max per metric."""
    files = expand_patterns([path])
    per_frame: list[dict[str, object]] = []
    for file in files:
        frame = metrics(file)
        per_frame.append(
            {"file": os.path.relpath(file, REPO_ROOT), "metrics": frame}
        )

    aggregate: dict[str, dict[str, float]] = {}
    for key in METRIC_KEYS:
        values = np.array([frame["metrics"][key] for frame in per_frame], dtype=np.float64)
        aggregate[key] = {
            "mean": float(values.mean()),
            "sd": float(values.std(ddof=1)) if values.size > 1 else 0.0,
            "min": float(values.min()),
            "p10": float(np.percentile(values, 10)),
            "p50": float(np.percentile(values, 50)),
            "p90": float(np.percentile(values, 90)),
            "max": float(values.max()),
        }

    return per_frame, aggregate


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
        "Script: `tools/capture/metrics.py` (v2.1; formulas unchanged from v1). "
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

    reference_path, set_name = resolve_reference(args)
    per_frame, aggregate = compute_reference(reference_path)
    shifted = compute_shifted_bands(aggregate)
    ref_rows = reference_rows(aggregate, shifted, with_bands)

    print_reference(reference_path, len(per_frame), set_name, ref_rows, with_bands)

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

    markdown_candidates_payload: list[dict[str, object]] = []
    strict_fail = False
    tolerance_all_pass = True
    scheme = primary_scheme(mode)

    for candidate_path in candidate_paths:
        measured = metrics(candidate_path)
        rows = candidate_rows(measured, aggregate, shifted)
        summary = summarize(rows)
        print_candidate(candidate_path, rows, summary, mode)

        if scheme == "tolerance":
            strict_fail = strict_fail or summary["tolerance"]["watch"] > 0
        else:
            strict_fail = strict_fail or summary[scheme]["fail"] > 0
        tolerance_all_pass = tolerance_all_pass and summary["tolerance"]["pass"] >= len(rows) - 3

        report["candidates"].append(
            {
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
        )
        markdown_candidates_payload.append(
            {"path": candidate_path, "rows": rows, "summary": summary}
        )

    if args.json:
        write_json(args.json, report)
        print(f"\nReport written to {args.json}")

    if args.markdown:
        lines = markdown_reference(reference_path, len(per_frame), set_name, ref_rows, with_bands)
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
