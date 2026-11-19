# W0 baseline — Prologue capture, metrics, blind review

**Gate:** G0 (measurement harness + baseline) of
[`../VISUAL_AUDIO_LEVEL_PLAN.md`](../VISUAL_AUDIO_LEVEL_PLAN.md) §6–§7.
**Date:** 2026-11-19. **Branch:** `feat/art-audio-level` (nothing merged to
`main`). **Scope:** Prologue route only.
**Purpose:** freeze the *current* numbers before W1 look work, using one script
for the reference and for our captures, plus a blind art-director verdict.

> Numbers here are a regression gauge, not a perceptual-equivalence claim. The
> binding look gate is the blind review ([`BLIND_REVIEW_W0.md`](BLIND_REVIEW_W0.md));
> metric policy is [`DECISIONS.md`](DECISIONS.md) D-02/D-03.

---

## 1. Method

| Item | Value |
|---|---|
| Browser | Microsoft Edge 157.0.4341.46, Playwright `channel: "msedge"`, headless |
| Viewport | 1600 × 900 CSS px, deviceScaleFactor 1, PNG (not JPEG) |
| Capture mode | dev-only `?capture=1&level=prologue&shot=<id>`; menu skipped, HUD and first-person viewmodel hidden, world time frozen, `display.quality=high`, seeded `Math.random` |
| Settle | 30 `requestAnimationFrame` after `window.__glasslineCapture.ready` |
| Reference | `ref/reference/prolog-kit/study/05-prologue-roofs` — 20 JPEG 1280×720 frames (git-ignored), the same `05` prologue-roof segment used by the plan |
| Metrics | `tools/capture/metrics.py` v2.1, identical formulas for both sides, max dimension 960 LANCZOS, 13 metrics |
| Bands | plan §2.1 bands shifted by Δ = measured_reference_mean − legacy_reference_value; reference mean inside 13/13 shifted bands ([`METRIC_SPEC.md`](METRIC_SPEC.md), [`BAND_CALIBRATION.md`](BAND_CALIBRATION.md)) |
| Durable images | [`docs/evidence/w0-baseline/`](../evidence/w0-baseline/) — 1600×900 JPEG q84 copies of the six committed captures |

```bash
# six deterministic 1600x900 PNGs + manifest (starts/kills its own Vite)
node tools/capture/capture.mjs --iteration w0 --shot all

PY=/Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
$PY tools/capture/metrics.py --candidate captures/w0 --bands \
    --json docs/reports/w0-baseline-metrics.json \
    --markdown docs/reports/w0-baseline-metrics.md

# reference recompute (identical script)
$PY tools/capture/metrics.py --reference-set prolog \
    --reference-json docs/reports/reference-prolog.json
```

`captures/` is git-ignored (12–13 MB per iteration); the committed record is the
manifest schema, these numbers and the JPEG copies above.

## 2. Six fixed shots

FOV 65° vertical for all shots (contract value; the art brief asked for hFOV
78–82° ≈ vertical 50° — open item for W1, see §7).

| Shot | Camera position | lookAt | Intent (beat) |
|---|---|---|---|
| `start-roof` | `(-2.5, 1.65, 21.0)` | `(1.5, 1.6, -9.0)` | beat 1: eye-level along the start roof, facade mass left, canyon/sky right |
| `first-gap` | `(0.0, -1.45, -30.0)` | `(0.0, -3.2, -38.5)` | beat 2: run-up edge, sprint gap and landing edge on the lower roofs |
| `wallrun-corridor` | `(-3.6, 1.5, 0.0)` | `(-8.0, 1.3, -7.0)` | beat 3: gaze into the glass facade, mullion rhythm, red handrail |
| `service-block` | `(0.0, 0.35, -4.9)` | `(0.0, 0.75, -12.0)` | beat 4: slide-camera under the duct (≈1.0 m clearance), exit slit in BG |
| `skybridge` | `(0.0, 0.75, -42.4)` | `(0.0, 0.45, -55.5)` | beat 6: long sightline along the 3.4 m deck to the finish gate |
| `finish-roof` | `(0.0, 6.8, -125.5)` | `(2.0, 6.9, -133.0)` | beat 7: FINISH gate, single red marker, clean silhouette |

Scene statistics from `window.__glasslineCapture.stats()` (per frame, `quality:
high`, canvas 1600×900, 26 shader programs):

| Shot | draw calls | triangles | textures* | PNG bytes | sha256 (first 12) |
|---|---:|---:|---:|---:|---|
| `start-roof` | 136 | 1,356,546 | 49 | 2,087,611 | `e4d7d8df7bcc` |
| `first-gap` | 122 | 1,353,522 | 43 | 2,115,182 | `7a840b297b75` |
| `wallrun-corridor` | 124 | 1,356,522 | 45 | 2,234,109 | `8b2dec531870` |
| `service-block` | 126 | 1,356,526 | 44 | 2,157,364 | `15ddb0443530` |
| `skybridge` | 122 | 1,353,522 | 46 | 1,910,775 | `6ec7fc19a374` |
| `finish-roof` | 106 | 1,352,894 | 37 | 1,938,516 | `f95a94429c87` |

\* `renderer.info.memory.textures` is a GPU counter that floats 37–49 between
runs even when the PNG is byte-identical; it is not part of the determinism
check. Draw calls and triangles are stable per shot.

**Caveat vs earlier rounds:** `docs/DECISION_AT_100.md` and
`docs/FINAL_REPORT.md` claim 352 draw calls / 2.67 M triangles. This capture
reports 106–136 calls / ≈1.35 M triangles at the six review poses. The numbers
come from different instruments (capture `stats()` vs a full-run overlay) and
different poses/quality, so they are **not comparable**; a real perf pass is W5,
not W0. No regression is claimed either way.

## 3. Determinism

Two independent Edge launches (separate browser processes), one with the
harness's own Vite and one on an external port, produced **byte-identical PNGs
for all six shots** (`captures/w0/manifest.json`, `determinism.verified = true`,
`matches = 6/6`).

Root cause found during W0: `GTAOPass._generateNoise()` builds a `SimplexNoise`
whose permutation table is filled with `Math.random()`, so the 64×64 AO noise
texture changed per page load (mean pixel delta 0.2–0.8/255 — invisible, but
hash-breaking). Under `?capture=1` only, `prepareCaptureMode()` now installs a
seeded `Math.random` (mulberry32, fixed seed) before application initialisation,
plus frozen sky/city/grain time (`update(0)`, `elapsedSeconds = 0`). Production
path untouched: the production bundle contains zero capture-mode symbols.
Decision: [`DECISIONS.md`](DECISIONS.md) D-04.

## 4. Reference recomputed by our own script

20 frames, `ref/reference/prolog-kit/study/05-prologue-roofs`. Full per-frame
data in [`reference-prolog.json`](reference-prolog.json).

| Metric | Measured mean | SD | p10–p90 | Plan §2.1 legacy | Δ | Shifted band |
|---|---:|---:|---|---:|---:|---|
| Luma mean | 0.6152 | 0.1334 | 0.4715–0.7639 | 0.589 | +0.0262 | 0.506224 … 0.646224 |
| Luma std | 0.2946 | 0.0492 | 0.2204–0.3504 | 0.272 | +0.0226 | ≥ 0.242584 |
| Luma p25 | 0.3710 | 0.1389 | 0.2191–0.5757 | 0.370 | +0.0010 | 0.330988 … 0.420988 |
| Luma p95 | 0.9806 | 0.0453 | 0.9158–1.0000 | 0.979 | +0.0016 | ≥ 0.9316 |
| Near-white share % | 34.4913 | 18.2421 | 6.1797–51.6213 | 27.3 | +7.1913 | 22.1913 … 35.1913 |
| Deep-shadow share % | 0.6781 | 1.6127 | 0.0022–1.4190 | 3.0 | −2.3219 | ≤ 3.6781 |
| Saturation | 0.3000 | 0.1410 | 0.1802–0.4816 | 0.359 | −0.0590 | 0.241027 … 0.321027 |
| Local contrast | 0.2850 | 0.0484 | 0.2178–0.3407 | 0.0713 | +0.2137 | ≥ 0.273703 |
| Edge energy | 0.0194 | 0.0093 | 0.0097–0.0293 | 0.0341 | −0.0147 | ≥ 0.0132946 |
| Sky-blue area % | 43.2583 | 16.8632 | 20.2221–63.4790 | 53.1 | −9.8417 | 25.1583 … 45.1583 |
| Top-third contrast | 0.2433 | 0.0555 | 0.1786–0.3089 | 0.0585 | +0.1848 | ≥ 0.234796 |
| Split-tone dark R−B | −21.8069 | 25.5737 | −42.5112–−3.9531 | −48.6 | +26.7931 | −28.2069 … −13.2069 |
| Red accent share % | 2.3938 | 2.8508 | 0.0507–4.6508 | 4.2 | −1.8062 | 0.193789 … 3.19379 |

The legacy column equals `docs/GLASSLINE_REFERENCE_AUDIT.md` §2.3 value for
value — it was measured by a predecessor harness, not by this repository. Our
script reproduces the historical v1 numbers bit-for-bit (round-93 `start.jpg`:
max abs diff 0.0 over all 13 metrics), so round 1–100 evidence stays
comparable. Provenance and band policy: [`DECISIONS.md`](DECISIONS.md) D-02.

## 5. Baseline numbers (six shots)

Verdict columns: `shifted` = W0/W1 target (13 metrics), `tol` = v1 tolerance
continuity gauge, `legacy` = raw plan band (traceability). Full 13×6 table:
[`w0-baseline-metrics.md`](w0-baseline-metrics.md), JSON:
[`w0-baseline-metrics.json`](w0-baseline-metrics.json).

| Shot | luma | std | p25 | p95 | nw% | ds% | sat | lc | edge | sky% | tc | split | red% | shifted | tol | legacy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `start-roof` | 0.700✗ | 0.224✗ | 0.554✗ | 0.969 | 25.5 | 0.5 | 0.204✗ | 0.210✗ | 0.026 | 37.4 | 0.187✗ | 31.7✗ | 1.6 | **6/13** | 6/13 | 7/13 |
| `first-gap` | 0.635 | 0.220✗ | 0.495✗ | 0.946 | 14.4✗ | 0.5 | 0.234✗ | 0.204✗ | 0.028 | 39.7 | 0.209✗ | −4.6✗ | 0.9 | **6/13** | 8/13 | 5/13 |
| `wallrun-corridor` | 0.593 | 0.273 | 0.316✗ | 0.950 | 17.3✗ | 2.0 | 0.365✗ | 0.264✗ | 0.025 | 50.0✗ | 0.221✗ | −26.8 | 1.7 | **7/13** | 13/13 | 9/13 |
| `service-block` | 0.605 | 0.291 | 0.321✗ | 0.970 | 18.7✗ | 2.9 | 0.281 | 0.285 | 0.026 | 2.7✗ | 0.233✗ | −65.4✗ | 1.8 | **8/13** | 11/13 | 7/13 |
| `skybridge` | 0.561 | 0.246 | 0.362 | 0.946 | 10.9✗ | 1.4 | 0.388✗ | 0.235✗ | 0.021 | 54.2✗ | 0.166✗ | −66.5✗ | 0.6 | **7/13** | 8/13 | 8/13 |
| `finish-roof` | 0.760✗ | 0.203✗ | 0.655✗ | 0.962 | 30.7 | 0.6 | 0.155✗ | 0.196✗ | 0.017 | 39.0 | 0.187✗ | 61.3✗ | 1.7 | **6/13** | 6/13 | 5/13 |

Per-metric passes across the six shots:

| Metric | PASS | Reading |
|---|---:|---|
| Luma p95 | 6/6 | highlights reach the reference level |
| Deep-shadow share | 6/6 | no crushed blacks |
| Edge energy | 6/6 | enough detail at 960 px |
| Red accent share | 6/6 | red is present — but the art director reports salmon/terracotta hue, so the metric over-counts |
| Luma mean | 4/6 | three shots are too bright (0.70–0.76 vs band 0.51–0.65) |
| Luma std | 3/6 | flat frames (0.20–0.22 vs ≥ 0.243) |
| Sky-blue area | 3/6 | interior shot 2.7 %; but the metric also counts blue facades (see §7) |
| Near-white share | 2/6 | four shots too far from the bright reference roofs (10.9–18.7 % vs 22.2–35.2) |
| Luma p25 | 1/6 | shadows/midtones too bright and flat |
| Saturation | 1/6 | bimodal: too grey (0.155–0.234) or too saturated (0.365–0.388) |
| Local contrast | 1/6 | flat mid-scale structure |
| Split-tone dark R−B | 1/6 | dark masses are not the cool blue of the reference |
| Top-third contrast | 0/6 | **flat pale sky in every shot — the single most systematic gap** |

Read with D-03: a dark composition (`service-block`, `sky% = 2.7`) cannot pass
`sky-blue`/`near-white` by design. These are reported, not waived; the
applicable metric family is noted when a shot is structurally exempt.

## 6. Blind art-director verdict

**0/6 PASS** against the "can this frame stand in the reference prologue"
criterion; the W1 gate is 4/6. Beats were recognised 6/6 without labels, so
route readability is in place — the image language is not. Full per-frame
deviations and fixes: [`BLIND_REVIEW_W0.md`](BLIND_REVIEW_W0.md).

Systemic defects, in leverage order (inputs to W1):
1. **Colour script** — warm whites `#F0E8E0` instead of neutral `#F8F8F8`;
   pale sky without the `#2050D8` zenith; route red reads salmon/terracotta
   `#E08870`/`#C86850` instead of `#E80018`.
2. **Glass/plastic** — flat `#005888`/`#006088`/`#003050` panels with no
   reflection gradient and no dark masses; reference glass is `#1A2530`,
   rough 0.10, metal 0.6, env 1.3.
3. **Light key** — prop shadows on the deck almost absent (reference 55–65° sun,
   shadows 0.5–0.8× object height, luma 0.25–0.40); interior lighting flat.
4. Point defects — emissive glow signage/roof edges/window cells, black void
   panels, swirl-bump instead of seams, saturated green planters, gradient
   "red" monoliths.

## 7. What these numbers do not prove (anti-hack rule, plan §1)

1. **Sample.** The reference anchor is 20 frames of the `05 prologue-roofs`
   segment, not the whole 827 s prologue. A shot can pass the mean bands while
   missing the reference's interior beats.
2. **Sky-blue is not a sky mask.** The metric counts blue-dominant pixels in the
   upper 66 % of the frame; our saturated blue facades count as "sky". The art
   director measured ~8–12 % real sky on frames with `sky% ≈ 37–54`. This is a
   known over-count, not a win (guardrail planned, D-09).
3. **Near-white is not a clip detector.** `luma > 0.9` also counts clipped
   whites; edge energy inside the near-white mask and seam readability must be
   checked by eye (art director checks in `ART_BRIEF.md` §4).
4. **Red share is not route readability.** Banners and props satisfy the metric;
   hue/saturation and continuity of the route line are not measured.
5. **No human acceptance.** W0 numbers and the blind review are machine/
   model-mediated; owner acceptance remains required (plan §2.1, `DECISION_AT_100`).
6. **No frame-copy intent.** Passing the bands is not "matching a screenshot";
   the target is the reference language (D-06).
7. **FPS not measured here.** The plan's W1 gate (≥ 55 fps at 1600×900 high) is
   out of scope for W0.

## 8. Open items handed to W1

1. **Fix the three systemic defects** from §6/`ART_BRIEF.md` §3; verify with the
   same six-shot capture and blind review (4/6 gate).
2. **FOV contract.** Capture contract fixes vertical FOV 65; the art brief asks
   hFOV 78–82° (vertical ≈ 50°). Decide in W1 and record in D-2x before the next
   baseline.
3. **Composition deviations** forced by geometry (honest list from the capture
   executor): no camera roll in the position+lookAt contract (wall-run 8–15°
   roll unrepresentable); the wall-run corridor walls are white panels, so the
   glass language was framed on the west tower instead; there is no red door in
   the duct (red landmark is a handrail); `first-gap` opens onto a lower roof at
   −19 m rather than "city below"; the overhead canyon bridge is fixed geometry
   and stays in `start-roof` MG.
4. **Anti-gaming guardrails** (D-09): sky mask above the horizon, edge energy
   inside the near-white mask, continuous red component with HSV S ≥ 0.6.
5. **Perf instrumentation** — reconcile `stats()` counts with the full-run
   overlay before any perf claim (W5).

## 9. Audio baseline (already landed, not re-run in W0)

Plan §6 W0 also lists `tools/capture/audio-render.*` + `audio-metrics.py`; both
exist from the earlier W4 foundation (`tools/capture/audio-render.mjs`,
`audio-probe.mjs`, `audio-metrics.py`) and were measured before this pass. The
committed prologue-mix evidence
([`docs/evidence/audio/round-2/`](../evidence/audio/round-2/)) passes 5/5 §2.2
targets: energy < 500 Hz 0.8955 (0.85–0.94), energy > 2 kHz 0.0602 (0.03–0.08),
integrated loudness −26.0 LUFS (−31…−26), sample peak −5.26 dBFS (≤ −3),
short-term range 22.86 dB (18–26); live in-engine recordings
([`round-29/`](../evidence/audio/round-29/)) peak at 0.65 linear with no
clipping. The six required layers are wired in the mix graph. **A human
listening pass is still required for the W4 gate and is not claimed here.**

## 10. G0 exit status

| G0 item (plan §6 W0) | Status |
|---|---|
| Dev-only capture boot, six fixed poses, no menu/HUD, frozen time | ✅ `?capture=1&level=prologue&shot=<id>`; byte-identical across independent loads |
| `tools/capture.*` Playwright Edge harness, 1600×900 PNGs, iteration dirs | ✅ `tools/capture/capture.mjs` + `captures/<iteration>/manifest.json` |
| `tools/metrics.py` measured identically for reference and captures | ✅ v2.1, three verdict modes, reference recompute + calibration |
| Audio render + metrics tooling | ✅ landed earlier, 5/5 prologue targets in existing evidence (listening pass open) |
| `docs/reports/BASELINE.md` with real numbers and six images | ✅ this document + `docs/evidence/w0-baseline/` |
| Meta-requirement: reference bands recomputed by our own script | ✅ [`reference-prolog.json`](reference-prolog.json), [`METRIC_SPEC.md`](METRIC_SPEC.md), D-02 |

**G0 is not a look gate.** The baseline is red by design: AD 0/6 PASS, shifted
bands 6–8/13 per shot. That is the starting line for W1, with the fixes in
`ART_BRIEF.md` §3 and `BLIND_REVIEW_W0.md`.
