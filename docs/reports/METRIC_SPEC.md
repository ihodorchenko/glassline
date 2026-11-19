# Metric spec — image acceptance bands (W0)

Status: implemented in `tools/capture/metrics.py` v2.1 (W0-C2, `feat/art-audio-level`).
Supersedes the informal description in `docs/VISUAL_REFERENCE_PROGRESS.md`; the
plan itself (`docs/VISUAL_AUDIO_LEVEL_PLAN.md` §2.1) stays the source of the
acceptance bands.

Purpose: a **regression gauge** that can be computed identically for the
reference frames and for our own captures. It is not a proof of perceptual
equality, and a passing row is not an art-direction approval.

> Anti-hack rule: the same script, the same resize and the same thresholds are
> applied to both sides. There is no per-image normalisation, no auto-exposure,
> no per-shot curve fitting and no metric-specific grading. A frame must not be
> made to pass by clipping highlights to white, crushing shadows or flattening
> texture — the metric gaps are meant to be closed by lighting, content and
> exposure, not by moving the measurement. The W0 band policy only translates
> the plan bands by one data-derived offset per metric (see "Band policy W0");
> it never widens or narrows them. Changing a formula retroactively
> invalidates 24 rounds of evidence, so any formula change requires a version
> bump and an explicit note here.

## Interpreter

The system `python3` has no numpy/Pillow. Use the workspace runtime
(numpy 2.3.5, Pillow 12.3.0):

```
/Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
```

or export it once and use the variable:

```
export GLASSLINE_PYTHON=/Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
"$GLASSLINE_PYTHON" tools/capture/metrics.py --help
```

If the script cannot import numpy or Pillow it prints this path and exits 2.

## Pipeline (both sides, identical)

1. Open with Pillow, `convert("RGB")` (alpha dropped, no EXIF rotation is applied).
2. If `max(width, height) > 960`, resize so that `max(width, height) == 960`
   (`Image.LANCZOS`, the other side scaled by the same factor and floored with
   `int()`). Images already at or below 960 px on the long edge are not resized.
3. `np.asarray(...).astype(np.float32) / 255.0`: every metric works on gamma-encoded
   sRGB floats in `[0, 1]`; there is no linearisation.
4. All 13 metrics are computed on those same pixels. No per-image statistics
   (mean, percentiles, exposure) are used to precondition the pixels.

Consequence: a 1600×900 PNG capture and a 1280×720 JPG reference frame both end
up at 960-px long edge and are measured by exactly the same code.

## The 13 metrics

`R, G, B` are the resized 0..1 float channels; `L = 0.2126 R + 0.7152 G + 0.0722 B`
(Rec.709 weights on gamma-encoded values). `mean(...)`/`std(...)` are population
statistics over all pixels of the resized frame (numpy `ddof=0`). Percentages are
reported on the 0..100 scale.

| # | Key | Display | Unit | Definition |
|---:|---|---|---|---|
| 1 | `luma` | Luma mean | 0..1 | `mean(L)` |
| 2 | `std` | Luma std | 0..1 | `std(L)` (population) |
| 3 | `p25` | Luma p25 | 0..1 | 25th percentile of `L` (numpy linear interpolation) |
| 4 | `p95` | Luma p95 | 0..1 | 95th percentile of `L` (numpy linear interpolation) |
| 5 | `near_white` | Near-white share | % | `100 * mean(L > 0.9)` |
| 6 | `deep_shadow` | Deep-shadow share | % | `100 * mean(L < 0.05)` |
| 7 | `saturation` | Saturation | 0..1 | `M = max(R,G,B)`, `m = min(R,G,B)`; per pixel `(M - m) / max(M, 1e-5)` if `M > 1e-5` else `0`; then `mean(...)` |
| 8 | `local_contrast` | Local contrast | 0..1 | crop `L` to `H//8*8` × `W//8*8`, reshape into 8×8 blocks, take block means, report `std(block means)` (population) |
| 9 | `edge` | Edge energy | 0..1 | `mean(hypot(dL/dx, dL/dy))` with `np.gradient` (central differences in the interior, one-sided at the border) |
| 10 | `sky` | Sky-blue area | % | take rows `[0 : int(H * 0.66)]`; mask `B > 1.05*R` **and** `B > 0.45` **and** `B > 1.02*G`; report `100 * mean(mask)` |
| 11 | `top_contrast` | Top-third contrast | 0..1 | take rows `[0 : H // 3]`; report `std(L)` (population) on them |
| 12 | `split` | Split-tone dark R−B | R−B × 255 | mask `L < 0.18`; report `mean(255 * (R - B))` over the mask; `0.0` if the mask is empty |
| 13 | `red` | Red accent share | % | mask `R > 0.35` **and** `R > 1.5*G` **and** `R > 1.5*B`; report `100 * mean(mask)` |

Notes:

- `near_white` and `deep_shadow` are **shares of pixels**, not luminance mass.
- `local_contrast` deliberately measures the spread of 8×8 block *means*
  (large-scale composition contrast), not within-block texture energy; up to 7
  border pixels per axis are excluded by the crop.
- `sky` is a blue-dominance heuristic, not semantic segmentation; it also counts
  blue-grey haze/facades.
- `split` is a cheap warm/cool balance gauge for the shadows only; it is `0.0`
  on frames with no pixels below luma 0.18.
- Rounding: console and Markdown print 4 decimal places (deltas as `+0.0000`),
  percentage deltas with 1 decimal; JSON stores full float precision. Percent
  metrics are always 0..100.

## Reference recompute (the core of W0)

Reference set `prolog` = `ref/reference/prolog-kit/study/05-prologue-roofs`,
20 JPG frames at 1280×720. The set is local only (`ref/` is gitignored); if it is
missing the script exits 2 and suggests `--reference <dir>`.

Aggregate across the 20 frames, per metric:

- `mean` — arithmetic mean of the 20 per-frame values;
- `sd` — **sample** standard deviation (`ddof=1`, i.e. n−1);
- `min`, `max`;
- `p10`, `p50`, `p90` — numpy linear interpolation over the 20 per-frame values.

The full per-frame table is stored alongside the aggregates, so any aggregate
can be re-derived.

Recompute and save the reference document:

```
"$GLASSLINE_PYTHON" tools/capture/metrics.py \
    --reference-set prolog --reference-json docs/reports/reference-prolog.json
```

### Measured reference vs the plan's legacy column

`Reference` = `docs/VISUAL_AUDIO_LEVEL_PLAN.md` §2.1 legacy column.
`Measured` = this script on the 20 reference frames (`docs/reports/reference-prolog.json`).
`Δ = measured − legacy`; `ref vs band` = is the measured **mean** inside the §2.1 band.

| Metric | Key | Unit | Measured mean | SD | Min | p10 | p50 | p90 | Legacy | Δ | Δ % | Band | Ref vs band |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|:---:|
| Luma mean | `luma` | 0..1 | 0.6152 | 0.1334 | 0.3276 | 0.4715 | 0.6217 | 0.7639 | 0.589 | +0.0262 | +4.5 % | 0.48 .. 0.62 | PASS |
| Luma std | `std` | 0..1 | 0.2946 | 0.0492 | 0.1904 | 0.2204 | 0.2936 | 0.3504 | 0.272 | +0.0226 | +8.3 % | >= 0.22 | PASS |
| Luma p25 | `p25` | 0..1 | 0.3710 | 0.1389 | 0.1619 | 0.2191 | 0.3694 | 0.5757 | 0.37 | +0.0010 | +0.3 % | 0.33 .. 0.42 | PASS |
| Luma p95 | `p95` | 0..1 | 0.9806 | 0.0453 | 0.8522 | 0.9158 | 1.0000 | 1.0000 | 0.979 | +0.0016 | +0.2 % | >= 0.93 | PASS |
| Near-white share | `near_white` | % | 34.4913 | 18.2421 | 3.2222 | 6.1797 | 32.5802 | 51.6213 | 27.3 | +7.1913 | +26.3 % | 15 .. 28 | FAIL |
| Deep-shadow share | `deep_shadow` | % | 0.6781 | 1.6127 | 0.0006 | 0.0022 | 0.1254 | 1.4190 | 3 | -2.3219 | -77.4 % | <= 6 | PASS |
| Saturation | `saturation` | 0..1 | 0.3000 | 0.1410 | 0.1578 | 0.1802 | 0.2682 | 0.4816 | 0.359 | -0.0590 | -16.4 % | 0.3 .. 0.38 | PASS |
| Local contrast | `local_contrast` | 0..1 | 0.2850 | 0.0484 | 0.1874 | 0.2178 | 0.2833 | 0.3407 | 0.0713 | +0.2137 | +299.7 % | >= 0.06 | PASS |
| Edge energy | `edge` | 0..1 | 0.0194 | 0.0093 | 0.0068 | 0.0097 | 0.0181 | 0.0293 | 0.0341 | -0.0147 | -43.1 % | >= 0.028 | FAIL |
| Sky-blue area | `sky` | % | 43.2583 | 16.8632 | 13.1493 | 20.2221 | 42.9366 | 63.4790 | 53.1 | -9.8417 | -18.5 % | 35 .. 55 | PASS |
| Top-third contrast | `top_contrast` | 0..1 | 0.2433 | 0.0555 | 0.1438 | 0.1786 | 0.2498 | 0.3089 | 0.0585 | +0.1848 | +315.9 % | >= 0.05 | PASS |
| Split-tone dark R−B | `split` | R−B × 255 | -21.8069 | 25.5737 | -54.9619 | -42.5112 | -28.1224 | -3.9531 | -48.6 | +26.7931 | -55.1 % | -55 .. -40 | FAIL |
| Red accent share | `red` | % | 2.3938 | 2.8508 | 0.0000 | 0.0507 | 2.0201 | 4.6508 | 4.2 | -1.8062 | -43.0 % | 2 .. 5 | PASS |

Facts (no judgement, decision belongs to the lead):

- 4 of 13 metrics agree with the legacy column within 10 %: `luma`, `std`, `p25`, `p95`.
- `local_contrast` and `top_contrast` are ~4.0× and ~4.2× larger when measured here
  (0.2850 vs 0.0713 and 0.2433 vs 0.0585). This is consistent with the legacy
  harness using a different aggregation for those two gauges; the legacy
  definition is not documented anywhere in this repo.
- `split` differs by +26.79 units, `near_white` by +7.19 pp, `sky` by −9.84 pp,
  `edge` by −0.0147, `red` by −1.81 pp, `deep_shadow` by −2.32 pp,
  `saturation` by −0.059.
- 10 of 13 measured reference **means** fall inside the §2.1 bands; three do not:
  `near_white` (34.49 vs 15..28), `edge` (0.0194 vs ≥ 0.028) and `split`
  (−21.81 vs −55..−40). The measured reference therefore does not satisfy three
  of the bands that were derived from the legacy numbers.
- Independent continuity check: this pipeline reproduces the stored
  `docs/evidence/visual/round-93/metrics.json` candidate values for
  `start.jpg` **exactly** (max abs diff 0.0 over all 13 metrics), so the formulas
  are the same ones used across the previous rounds.

## Band policy W0 (decision, 2026-11-19)

The plan's §2.1 "Reference" column is **not reproducible by this harness**. All
13 of its values are identical to the predecessor audit table in
`docs/GLASSLINE_REFERENCE_AUDIT.md` §2.3 (checked value by value: 0.589 / 0.272 /
0.370 / 0.979 / 27.3 / 3.0 / 0.359 / 0.0713 / 0.0341 / 53.1 / 0.0585 / −48.6 /
4.2), so it was measured by a different harness/frame set. Our script reproduces
the v1 conclusions exactly (round-93 `start.jpg`: max abs diff 0.0), therefore
**the measured reference from this script is the source of truth** and the plan
bands are re-based with one uniform, data-derived shift.

Formula (per metric, both bounds; one-sided bands shift their single bound):

```
delta   = measured_ref_mean - legacy_ref
shifted = legacy_band + delta          # min+delta, max+delta
```

Band widths and one-sided margins are preserved 1:1 — nothing is widened or
narrowed. Since the legacy reference value lies inside every legacy band (13/13),
the shifted bands contain the measured reference mean 13/13 by construction; the
script asserts this at runtime and exits 2 if the invariant is ever broken.

### Shifted band table (computed from `docs/reports/reference-prolog.json`)

| Metric | Legacy ref | Delta = measured − legacy | Legacy band | Shifted band | Ref mean inside? |
|---|---:|---:|---|---|:---:|
| Luma mean | 0.589 | +0.0262 | 0.48 .. 0.62 | 0.506224 .. 0.646224 | YES |
| Luma std | 0.272 | +0.0226 | >= 0.22 | >= 0.242584 | YES |
| Luma p25 | 0.37 | +0.0010 | 0.33 .. 0.42 | 0.330988 .. 0.420988 | YES |
| Luma p95 | 0.979 | +0.0016 | >= 0.93 | >= 0.9316 | YES |
| Near-white share | 27.3 | +7.1913 | 15 .. 28 | 22.1913 .. 35.1913 | YES |
| Deep-shadow share | 3 | -2.3219 | <= 6 | <= 3.6781 | YES |
| Saturation | 0.359 | -0.0590 | 0.3 .. 0.38 | 0.241027 .. 0.321027 | YES |
| Local contrast | 0.0713 | +0.2137 | >= 0.06 | >= 0.273703 | YES |
| Edge energy | 0.0341 | -0.0147 | >= 0.028 | >= 0.0132946 | YES |
| Sky-blue area | 53.1 | -9.8417 | 35 .. 55 | 25.1583 .. 45.1583 | YES |
| Top-third contrast | 0.0585 | +0.1848 | >= 0.05 | >= 0.234796 | YES |
| Split-tone dark R-B | -48.6 | +26.7931 | -55 .. -40 | -28.2069 .. -13.2069 | YES |
| Red accent share | 4.2 | -1.8062 | 2 .. 5 | 0.193789 .. 3.19379 | YES |

### Three verdict schemes

`--bands` evaluates all three; `--bands-mode` selects what is displayed and what
`--strict` gates on.

| Scheme | Band | Verdict | Role |
|---|---|---|---|
| `shifted` | shifted band above | `PASS` / `FAIL` | **Proposed W0 acceptance** for the six fixed shots. |
| `tolerance` | none (v1 tolerance envelope) | `PASS` if `abs(value - measured_ref_mean) <= tolerance`, else `WATCH` | v1 regression gauge / continuity with 24 rounds. |
| `legacy` | raw plan §2.1 band | `PASS` / `FAIL` | Traceability only — not a gate, since the column is another harness's numbers. |

Default behaviour: `--bands` = `--bands-mode all` (three verdicts per metric);
`--bands-mode shifted|legacy|tolerance` selects one scheme; without `--bands`
the report is the v1 tolerance table only. `--strict` exits 1 on `FAIL` in the
selected acceptance scheme (`shifted` by default, `legacy` in legacy mode, any
`WATCH` in tolerance mode).

`gap` is the signed distance to the nearest band edge in metric units:
**positive = margin inside the band, negative = how far outside it is** (e.g.
`-0.0012` means 0.0012 above a `max` bound). Both shifted and legacy gaps are
stored in JSON; the console/markdown show the gap of the selected scheme.

### Calibration (reference set scored with the same script)

All 20 reference frames were passed back as candidates (see
[`BAND_CALIBRATION.md`](BAND_CALIBRATION.md) for the full tables):

- measured reference **mean**: 13/13 shifted, 10/13 raw legacy — the shifted gate
  is reference-consistent by construction;
- per-frame (not a gate criterion): mean 7.05/13 shifted vs 8.75/13 tolerance vs
  7.25/13 legacy passing metrics; no single reference frame passes all 13 under
  any scheme (max 11 shifted, 12 tolerance), because the 20-frame set spans
  compositions/time-of-day whose spread exceeds several legacy band widths
  (`near_white` sd 18.24 pp vs 13 pp width, `split` sd 25.57 vs 15, `p25`
  sd 13.89 vs 9);
- the bands are a **mean-level target for the six fixed shots**, not a
  per-frame membership requirement for the 20-frame reference set;
- observed on the shipped round-93 start frame: 9/13 shifted (`near_white`,
  `saturation`, `local_contrast`, `top_contrast` just outside shifted margins),
  13/13 tolerance, 10/13 legacy. This is the intended tightening relative to the
  v1 gauge; the gate decision is the lead's.

### v1 tolerance envelope

Kept unchanged for historical continuity (the v1 script compared against the
recomputed reference mean, i.e. the same check the previous 24 rounds used):

| luma | std | p25 | p95 | near_white | deep_shadow | saturation | local_contrast | edge | sky | top_contrast | split | red |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.08 | 0.05 | 0.10 | 0.05 | 18.0 | 3.0 | 0.08 | 0.04 | 0.012 | 12.0 | 0.05 | 15.0 | 2.5 |

## CLI

```
metrics.py [--reference-set {prolog}] [--reference DIR] [--reference-json PATH]
           [--candidate PATH ...] [--json PATH] [--markdown PATH]
           [--bands] [--bands-mode {all,shifted,legacy,tolerance}]
           [--strict] [--list-metrics]
```

| Flag | Meaning |
|---|---|
| `--reference-set prolog` | Named reference set (default). Currently only `prolog`; add entries in `REFERENCE_SETS`. |
| `--reference DIR` | Explicit reference directory; overrides `--reference-set`. Accepts jpg/jpeg/png. |
| `--reference-json PATH` | Write the reference document (per-frame values + mean/sd/min/p10/p50/p90/max) to `PATH`. Format is deterministic: no timestamps, so two runs are byte-identical. |
| `--candidate PATH ...` | One or more files, quoted globs (`'captures/w0/*.png'`, `**` is recursive) or directories (top-level jpg/png). Repeatable. Every match is scored. |
| `--json PATH` | Full report: reference path/stats/per-frame, legacy column, raw bands, shifted bands (`bandPolicy`), tolerances, per-candidate rows with all three verdicts and per-scheme summaries. |
| `--markdown PATH` | Markdown report: reference table (mean ± sd, p10/p50/p90, legacy, delta, tolerance, legacy/shifted bands, ref statuses) and one table per candidate with the selected scheme's verdict columns. |
| `--bands` | Enable acceptance-band comparison; defaults to `--bands-mode all` (shifted + tolerance + legacy verdicts). |
| `--bands-mode {all,shifted,legacy,tolerance}` | `all` = three verdicts (default with `--bands`); `shifted` = W0 acceptance; `legacy` = raw plan §2.1 traceability; `tolerance` = v1 gauge. Also implies `--bands`. |
| `--strict` | Exit 1 on `FAIL` in the selected acceptance scheme (`shifted` by default, `legacy` in legacy mode, any `WATCH` in tolerance mode). |
| `--list-metrics` | Print keys, units, legacy reference and bands; exit 0. |

Exit codes: `0` ok (with `--bands` and without `--strict` the run is report-only);
`1` strict gate triggered, or (without `--bands`) the v1 "more than 3 metrics
outside tolerance" rule; `2` missing numpy/Pillow, missing reference set, missing
candidate, empty glob, or a broken shifted-band invariant.

Backward compatibility: `metrics.py --candidate a.jpg --json out.json` still
works and still uses the default reference set and the v1 tolerance table; the
JSON keeps the v1 keys `reference` (path string), `referenceFrames` (int),
`tolerances`, `candidates[].{path, metrics, rows, passed, total}` while adding:
`bandsMode`, `bandPolicy` (provenance + formula + shifted bands + 13/13 checks),
per-row `bands` (legacy/shifted min/max/label), `gaps`, `verdicts`
(shifted/tolerance/legacy), `referenceSd/P10/P50/P90`, `shift`, `pass`
(= tolerance PASS, v1 meaning) and `accepted` (= shifted PASS), plus per-candidate
`shiftedPassed`, `legacyPassed`, `watch`, `failed`, `summary` (per-scheme counts).

Batch mode:

```
"$GLASSLINE_PYTHON" tools/capture/metrics.py --candidate captures/w0 --bands \
    --json captures/w0/metrics.json --markdown captures/w0/metrics.md
```

## Reference document schema (`docs/reports/reference-prolog.json`)

Top-level keys: `schemaVersion` (2), `kind` ("reference"), `script`, `set`
(`"prolog"`), `path` (repo-relative), `frames` (20), `resizeLongEdge` (960),
`sdConvention`, `percentileConvention`, `metrics` (13 keys → `{mean, sd, min,
p10, p50, p90, max}`), `perFrame` (20 × `{file, metrics}`), `legacyReference`
(13 keys), `bands` (13 × `{legacy, min, max, label, unit}`), `tolerances`
(13 keys).

There is intentionally no generation timestamp, so the file is reproducible and
a diff means the measurements changed.

## Determinism and format comparability

- The same file measured twice returns bit-identical floats (verified on
  `round-93/start.jpg`; also byte-identical reference JSON across two runs).
- PNG and JPG are both decoded to RGB and resized to the 960-px long edge by the
  same code path. On a synthetic pair made from one 2560×1232 source frame
  (1600×900 PNG vs 1280×720 JPG q=90) the largest cross-format delta was 0.73
  units (`sky` +0.58 pp, `split` +0.73, `red` −0.10 pp); the remaining ten
  metrics moved by less than 0.01 in their own units. Format/resolution is
  therefore not a confounder beyond JPEG compression noise.

## Known limitations

- `edge` is `0` for a perfectly flat frame; `split` is `0` when no pixel is
  below luma 0.18; `sky` can count blue-grey architecture.
- `local_contrast` and `top_contrast` react to composition (large bright sky vs
  dark roofs), not to texture quality; they cannot distinguish real detail from
  a high-contrast flat grade.
- Percentile metrics (`p95`) saturate at 1.0 — frames with any clipped region
  read `1.0000` and lose resolution there.
- Reference spread is large (`near_white` sd 18.24, `split` sd 25.57,
  `sky` sd 16.86), so a single frame can sit legitimately far from the mean; all
  §2.1 verdicts are computed from one frame, not from median-of-3.
- The reference frames are local-only, and the script writes but does not read
  reference JSON. A CI run without the frames needs the frames restored (or a
  future `--reference-load`).

## Open questions for the lead

Resolved on 2026-11-19 (W0 band decision):

- legacy-column provenance = `docs/GLASSLINE_REFERENCE_AUDIT.md` §2.3 (another
  harness) → the measured reference is the source of truth;
- plan bands re-based by the uniform shift onto the measured reference;
- median-of-3 not needed: the six acceptance shots are deterministic, single-frame
  noise is a blind-review matter.

Remaining:

1. The script writes but does not read reference JSON. CI without the local
   reference frames needs a future `--reference-load` (or the frames restored).
2. The six fixed acceptance shots have not yet been captured/scored under
   `shifted` (this is the W0 baseline report).
3. Calibration shows the shifted gate is reference-consistent at the mean but
   strict per frame for `near_white`, `split`, `local_contrast`, `top_contrast`,
   `p25` and `sky` (legacy widths narrower than the reference spread). If the six
   fixed shots need looser margins, that is a policy decision; no code change is
   made here.

## Changelog

- **v2.1** (W0-C2): added `--bands-mode {all,shifted,legacy,tolerance}`, the
  data-derived shifted band table (`delta = measured_ref_mean - legacy_ref`,
  widths preserved, reference mean inside 13/13 asserted), three verdicts per
  metric, per-scheme summaries, shifted/legacy gaps, `bandPolicy` in JSON,
  three-column markdown, and `docs/reports/BAND_CALIBRATION.md`. Formulas and
  tolerance values unchanged from v1.
- **v2** (W0-C): unchanged 13 formulas; added reference per-frame storage and
  aggregate spread statistics, `--reference-set`, `--reference-json`, multi-input
  `--candidate` (file/glob/dir, repeatable), `--bands` (PASS/WATCH/FAIL + gap),
  `--markdown`, `--strict`, `--list-metrics`, structured exit codes (2 for input
  errors), and this spec.
- **v1**: single `--candidate a.png b.png`, `--reference DIR`, `--json PATH`;
  in-memory reference mean only; tolerance PASS/WATCH per metric.
