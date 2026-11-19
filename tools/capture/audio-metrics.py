#!/usr/bin/env python3
"""Measure the rendered Glassline audio demo against the reference audio profile.

Reads a 16-bit stereo WAV, computes spectral band shares, approximate K-weighted
loudness, peak, and short-term range, and compares them with the target bands in
`docs/VISUAL_AUDIO_LEVEL_PLAN.md` §2.2.

Usage:
    python3 tools/capture/audio-metrics.py --wav docs/evidence/audio/round-2/mix.wav \
        --json docs/evidence/audio/round-2/metrics.json
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import wave

import numpy as np

TARGETS = {
    "low_share": (0.85, 0.94, "Energy < 500 Hz"),
    "high_share": (0.03, 0.08, "Energy > 2 kHz"),
    "lufs": (-31.0, -26.0, "Integrated loudness (approx K-weighted)"),
    "peak_db": (-60.0, -3.0, "Sample peak"),
    "short_term_range": (18.0, 26.0, "Short-term range"),
}


def read_wav(path: str) -> tuple[np.ndarray, int]:
    with wave.open(path, "rb") as handle:
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        rate = handle.getframerate()
        frames = handle.readframes(handle.getnframes())

    if width != 2:
        raise SystemExit("Expected a 16-bit WAV.")

    data = np.frombuffer(frames, dtype="<i2").astype(np.float64) / 32768.0
    data = data.reshape(-1, channels)

    return data, rate


def k_weighting_response(frequencies: np.ndarray, sample_rate: int) -> np.ndarray:
    # ITU-R BS.1770 K-weighting biquads for 48 kHz.
    shelf_b = np.array([1.53512485958697, -2.69169618940638, 1.19839281085285])
    shelf_a = np.array([1.0, -1.69065929318241, 0.73248077421585])
    highpass_b = np.array([1.0, -2.0, 1.0])
    highpass_a = np.array([1.0, -1.99004745483398, 0.99007225036621])

    omega = 2 * np.pi * frequencies / sample_rate
    z = np.exp(-1j * omega)

    def response(b: np.ndarray, a: np.ndarray) -> np.ndarray:
        numerator = b[0] + b[1] * z + b[2] * z * z
        denominator = a[0] + a[1] * z + a[2] * z * z

        return numerator / denominator

    return np.abs(response(shelf_b, shelf_a) * response(highpass_b, highpass_a)) ** 2


def block_powers(samples: np.ndarray, sample_rate: int, block_seconds: float) -> np.ndarray:
    """Per-block K-weighted mean square, summed over channels."""
    block_size = max(1, int(block_seconds * sample_rate))
    hop = max(1, int(0.1 * sample_rate))
    fft_size = 1
    while fft_size < block_size:
        fft_size *= 2
    frequencies = np.fft.rfftfreq(fft_size, 1 / sample_rate)
    weighting = k_weighting_response(frequencies, sample_rate)
    powers: list[float] = []

    for start in range(0, max(1, len(samples) - block_size), hop):
        block = samples[start : start + block_size]

        if len(block) < block_size:
            break

        total_power = 0.0
        for channel in range(block.shape[1]):
            frame = block[:, channel] - float(block[:, channel].mean())
            spectrum = np.fft.rfft(frame, fft_size)
            weighted = float((np.abs(spectrum) ** 2 * weighting).sum())
            # Parseval scaling for a zero-padded FFT.
            total_power += weighted / (fft_size * block_size)

        powers.append(total_power)

    return np.array(powers)


def integrated_loudness(samples: np.ndarray, sample_rate: int) -> float:
    """BS.1770-style gated integrated loudness."""
    powers = block_powers(samples, sample_rate, 0.4)

    if len(powers) == 0:
        return -70.0

    with np.errstate(divide="ignore"):
        loudness = -0.691 + 10 * np.log10(np.maximum(powers, 1e-12))

    absolute = loudness > -70.0

    if not np.any(absolute):
        return -70.0

    relative_threshold = -0.691 + 10 * math.log10(float(powers[absolute].mean())) - 10.0
    gated = absolute & (loudness > relative_threshold)
    integrated_power = float(powers[gated].mean()) if np.any(gated) else float(powers[absolute].mean())

    return -0.691 + 10 * math.log10(max(integrated_power, 1e-12))


def spectral_metrics(samples: np.ndarray, sample_rate: int) -> dict[str, float]:
    mono = samples.mean(axis=1)
    window_size = 4096
    hop = 2048
    window = np.hanning(window_size)
    frequencies = np.fft.rfftfreq(window_size, 1 / sample_rate)
    power = np.zeros_like(frequencies)
    frame_count = 0

    for start in range(0, max(0, len(mono) - window_size), hop):
        frame = mono[start : start + window_size]
        spectrum = np.fft.rfft(frame * window)
        power += np.abs(spectrum) ** 2
        frame_count += 1

    if frame_count == 0:
        return {"low_share": 0.0, "mid_share": 0.0, "high_share": 0.0}

    power /= frame_count
    total = float(power.sum()) or 1.0

    return {
        "low_share": float(power[frequencies < 500].sum() / total),
        "mid_share": float(power[(frequencies >= 500) & (frequencies <= 2000)].sum() / total),
        "high_share": float(power[frequencies > 2000].sum() / total),
    }


def short_term_range(samples: np.ndarray, sample_rate: int, window_seconds: float = 3.0) -> float:
    mono = samples.mean(axis=1)
    window = max(1, int(window_seconds * sample_rate))
    levels: list[float] = []

    for start in range(0, max(1, len(mono) - window), window):
        block = mono[start : start + window]
        rms = math.sqrt(float(np.mean(block * block)))

        if rms > 0:
            levels.append(20 * math.log10(rms))

    if len(levels) < 2:
        return 0.0

    return float(np.percentile(levels, 95) - np.percentile(levels, 5))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wav", required=True)
    parser.add_argument("--json")
    args = parser.parse_args()

    samples, sample_rate = read_wav(args.wav)
    peak = float(np.max(np.abs(samples)))
    peak_db = 20 * math.log10(max(peak, 1e-9))
    rms = float(np.sqrt(np.mean(samples * samples)))
    spectrum = spectral_metrics(samples, sample_rate)
    short_range = short_term_range(samples, sample_rate)
    lufs = integrated_loudness(samples, sample_rate)

    values = {
        "durationSeconds": len(samples) / sample_rate,
        "sampleRate": sample_rate,
        "peak": peak,
        "peak_db": peak_db,
        "rms": rms,
        "rms_db": 20 * math.log10(max(rms, 1e-9)),
        "short_term_range": short_range,
        "lufs": lufs,
        **spectrum,
    }

    rows = []
    passed = 0

    for key, (low, high, label) in TARGETS.items():
        value = values[key]
        ok = low <= value <= high
        passed += int(ok)
        rows.append({"metric": key, "label": label, "value": value, "min": low, "max": high, "pass": ok})

    report = {
        "wav": args.wav,
        "values": values,
        "targets": rows,
        "passed": passed,
        "total": len(rows),
    }

    print(f"{args.wav} · {values['durationSeconds']:.1f}s · {sample_rate} Hz")
    print(f"  {'metric':<16} {'value':>9} {'target':>16}  band")

    for row in rows:
        band = f"{row['min']:.2f} … {row['max']:.2f}"
        marker = "PASS" if row["pass"] else "WATCH"
        print(f"  {row['metric']:<16} {row['value']:>9.3f} {band:>16}  {marker}")

    print(f"  {passed}/{len(rows)} targets satisfied")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
            handle.write("\n")
        print(f"\nWrote {args.json}")

    return 0 if passed >= len(rows) - 1 else 1


if __name__ == "__main__":
    sys.exit(main())
