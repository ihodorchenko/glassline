# W0 baseline — Prologue capture, metrics, blind review

**Gate:** G0 (measurement harness + baseline) of
[`../VISUAL_AUDIO_LEVEL_PLAN.md`](../VISUAL_AUDIO_LEVEL_PLAN.md) §6–§7.
**Branch:** `feat/art-audio-level` (nothing merged to `main`). **Scope:** Prologue route only.
**Purpose:** freeze the *current* numbers before W1 look work, using one script
for the reference and for our captures, plus a blind art-director verdict.

**Revision 2 (2026-11-19, FOV 50).** Owner approved the capture lens change from
65° to **50° vertical** (D-11) and confirmed the band policy (D-02). All six
frames were re-captured and re-measured at 50° with art-director framing
corrections (AD-2), and the determinism contract was re-proven after a GPU-state
nondeterminism exposed by the narrower lens was fixed. Revision 1 (FOV 65)
evidence: git history commit `2442b54`, archived numbers in
[`w0-baseline-metrics-fov65.md`](w0-baseline-metrics-fov65.md) /
[`.json`](w0-baseline-metrics-fov65.json), archived images in
[`docs/evidence/w0-baseline/fov65/`](../evidence/w0-baseline/fov65/). Frames at
the two lenses are **not comparable**; W1 starts from revision 2.

> Numbers here are a regression gauge, not a perceptual-equivalence claim. The
> binding look gate is the blind review ([`BLIND_REVIEW_W0.md`](BLIND_REVIEW_W0.md));
> metric policy is [`DECISIONS.md`](DECISIONS.md) D-02/D-03.

---

## 1. Method

| Item | Value |
|---|---|
| Browser | Microsoft Edge 157.0.4341.46, Playwright `channel: "msedge"`, headless |
| Viewport | 1600 × 900 CSS px, deviceScaleFactor 1, PNG (not JPEG) |
| Capture mode | dev-only `?capture=1&level=prologue&shot=<id>`; menu skipped, HUD and first-person viewmodel hidden, world time frozen, `display.quality=high`, seeded `Math.random`, GPU caches (PMREM sky probe, shadow map, shader programs for all six poses) rebuilt from the frozen state, GPU-readback settle gate |
| FOV | **50° vertical** (≈ 78° horizontal at 16:9) for all six shots, per owner decision D-11 |
| Settle | until two consecutive default-framebuffer checksums match (max 6 probe rounds), then 30 rAF |
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

FOV 50° vertical for all shots. Poses were re-authored after the art director's
AD-2 framing pass (pose-only corrections; camera roll is not representable in
the position+lookAt contract and was not faked).

| Shot | Camera position | lookAt | Intent (beat) |
|---|---|---|---|
| `start-roof` | `(-2.5, 1.65, 3.0)` | `(0.0, 2.6, -8.7)` | beat 1: open start roof, bridge out of frustum, red maintenance ladder leads the eye, facade mass left |
| `first-gap` | `(0.0, -1.45, -27.0)` | `(0.0, -1.0, -41.0)` | beat 2: 5 m run-up to the 2.4 m sprint gap, landing edge readable, stairs behind |
| `wallrun-corridor` | `(-4.6, 1.5, 0.0)` | `(-10.6, 2.2, -8.0)` | beat 3: ~30° to the glass wall, mullion rhythm, red handrail, exit ledge right |
| `service-block` | `(0.0, 0.4, -6.3)` | `(1.7, 0.75, -14.1)` | beat 4: slide-eye 0.4 m, duct edge in FG, bright exit slit in MG |
| `skybridge` | `(0.0, 0.75, -47.5)` | `(0.0, 1.8, -57.5)` | beat 6: long sightline along the deck, rails converge on the finish gate |
| `finish-roof` | `(0.0, 6.8, -123.5)` | `(1.4, 7.75, -132.4)` | beat 7: FINISH gate in the left third, clean silhouette, single red marker |

Scene statistics from `window.__glasslineCapture.stats()` (per frame, `quality:
high`, canvas 1600×900, 36 shader programs after pre-compiling all six poses):

| Shot | draw calls | triangles | textures* | programs | PNG bytes | sha256 (first 12) |
|---|---:|---:|---:|---:|---:|---|
| `start-roof` | 130 | 1,356,534 | 47 | 36 | 2,097,144 | `9fbfd14ff579` |
| `first-gap` | 122 | 1,353,522 | 43 | 36 | 2,047,823 | `737c46fc8dc1` |
| `wallrun-corridor` | 116 | 1,356,506 | 40 | 36 | 2,265,805 | `a8463514f60f` |
| `service-block` | 124 | 1,356,522 | 46 | 36 | 2,135,423 | `034c95772328` |
| `skybridge` | 118 | 1,353,514 | 44 | 36 | 1,906,287 | `c150f2904983` |
| `finish-roof` | 106 | 1,352,894 | 40 | 36 | 1,904,214 | `69e1b9491daa` |

\* `renderer.info.memory.textures` is a GPU counter that floats 40–47 between
runs even when the PNG is byte-identical; it is not part of the determinism
check. Draw calls and triangles are stable per shot.

**Caveat vs earlier rounds:** `docs/DECISION_AT_100.md` and
`docs/FINAL_REPORT.md` claim 352 draw calls / 2.67 M triangles. This capture
reports 106–130 calls / ≈1.35 M triangles at the six review poses. The numbers
come from different instruments (capture `stats()` vs a full-run overlay) and
different poses/quality, so they are **not comparable**; a real perf pass is W5,
not W0. No regression is claimed either way.

## 3. Determinism

Three independent full runs (`captures/w0-fov50-poses-a|b|c`) produced
byte-identical PNGs for all six shots (18/18), and the canonical
`captures/w0` run reproduced the same hashes (`manifest.determinism.verified =
true, matches = 6/6`).

Under the 50° lens one shot (`first-gap`) initially differed between loads
(976 pixels at ±1/255). Diagnosis: the scene graph, camera matrices and shader
counters were identical across loads — the difference was LSB jitter of
per-launch **GPU-baked state** (which frame first baked the PMREM sky probe /
shadow map / compiled a program). Fix in capture mode only:
1. re-pin display quality, DPR and aspect after the level session starts;
2. rebuild the PMREM sky probe and shadow map from the frozen state;
3. pre-compile shader programs for all six authored cameras in fixed order;
4. replace the fixed 2-frame wait with a GPU-readback settle gate (default
   framebuffer checksum must be identical on two consecutive frames).

Production path untouched: the production bundle contains zero capture-mode
symbols. Decision: [`DECISIONS.md`](DECISIONS.md) D-04, D-11.

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

## 5. Baseline numbers (six shots, FOV 50)

Verdict columns: `shifted` = W0/W1 target (13 metrics), `tol` = v1 tolerance
continuity gauge, `legacy` = raw plan band (traceability). Full 13×6 table:
[`w0-baseline-metrics.md`](w0-baseline-metrics.md), JSON:
[`w0-baseline-metrics.json`](w0-baseline-metrics.json).

| Shot | luma | std | p25 | p95 | nw% | ds% | sat | lc | edge | sky% | tc | split | red% | shifted | tol | legacy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `start-roof` | 0.636 | 0.231✗ | 0.458✗ | 0.953 | 15.3✗ | 0.3 | 0.265 | 0.219✗ | 0.025 | 51.0✗ | 0.207✗ | 12.0✗ | 1.5 | **6/13** | 9/13 | 7/13 |
| `first-gap` | 0.660✗ | 0.215✗ | 0.529✗ | 0.943 | 16.1✗ | 0.4 | 0.231✗ | 0.198✗ | 0.028 | 52.6✗ | 0.205✗ | −22.9 | 0.5 | **5/13** | 9/13 | 6/13 |
| `wallrun-corridor` | 0.480✗ | 0.260 | 0.275✗ | 0.907✗ | 5.6✗ | 4.0✗ | 0.501✗ | 0.248✗ | 0.027 | 65.9✗ | 0.192✗ | −12.6✗ | 1.9 | **3/13** | 6/13 | 5/13 |
| `service-block` | 0.508 | 0.219✗ | 0.437✗ | 0.794✗ | 0.2✗ | 3.6 | 0.268 | 0.206✗ | 0.028 | 8.7✗ | 0.248 | −49.0✗ | 1.1 | **6/13** | 6/13 | 5/13 |
| `skybridge` | 0.661✗ | 0.196✗ | 0.557✗ | 0.946 | 13.1✗ | 0.5 | 0.230✗ | 0.185✗ | 0.020 | 48.5✗ | 0.172✗ | −37.2✗ | 0.2✗ | **3/13** | 7/13 | 5/13 |
| `finish-roof` | 0.740✗ | 0.185✗ | 0.620✗ | 0.955 | 20.3✗ | 0.6 | 0.154✗ | 0.175✗ | 0.017 | 44.0 | 0.127✗ | 52.2✗ | 1.9 | **5/13** | 6/13 | 6/13 |

Per-metric passes across the six shots:

| Metric | PASS | Reading |
|---|---:|---|
| Edge energy | 6/6 | enough detail at 960 px |
| Deep-shadow share | 5/6 | no crushed blacks (the glass-heavy corridor is the exception, 4.0 %) |
| Red accent share | 5/6 | red present — but the art director reports salmon/terracotta hue, so the metric over-counts |
| Luma p95 | 4/6 | highlights near the reference level; the two darker interiors fall short |
| Luma mean | 2/6 | four shots too bright or too flat versus 0.506–0.646 |
| Saturation | 2/6 | bimodal: too grey (0.154–0.231) or far too saturated (0.501 on the glass corridor) |
| Luma std | 1/6 | flat frames (0.185–0.231 vs ≥ 0.243) |
| Sky-blue area | 1/6 | **the metric counts blue facades**: 48–66 % "sky" on facade-heavy frames; real sky is a fraction of that |
| Top-third contrast | 1/6 | flat pale sky in every frame except one |
| Split-tone dark R−B | 1/6 | dark masses are not the cool blue of the reference (positive/warm on many frames) |
| Luma p25 | 0/6 | shadows/midtones too bright and flat everywhere |
| Near-white share | 0/6 | 0.2–20.3 % vs 22.2–35.2 %: the reference's blown-out white roofs are simply not in our frames |
| Local contrast | 0/6 | flat mid-scale structure everywhere |

Read with D-03: `service-block` and `wallrun-corridor` are structurally dark/sky-dark
compositions; `sky-blue` and `near-white` are not their metric family. They are
reported, not waived. **Framing sensitivity:** `near-white` fell versus revision 1
mostly because the AD-2 poses show less bright deck (the reference frames are
roof-dominant). That is an honest content gap for W1, not a lens artefact to game.

## 6. Blind art-director verdict

**0/6 PASS** against the "can this frame stand in the reference prologue"
criterion; the W1 gate is 4/6. Beats were recognised 6/6 without labels, so
route readability is in place — the image language is not. The blind review was
performed on the revision-1 frames (FOV 65); the defects it names are
systemic and independent of the lens, and the AD-2 framing pass on the FOV-50
frames changed composition, not materials/colour. Full per-frame deviations and
fixes: [`BLIND_REVIEW_W0.md`](BLIND_REVIEW_W0.md); framing corrections already
applied: [`BLIND_REVIEW_W0.md`](BLIND_REVIEW_W0.md) §AD-2 and D-11.

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
   upper 66 % of the frame; our saturated blue facades and glass count as "sky"
   (65.9 % on the glass corridor while visible sky is a thin strip). Known
   over-count, not a win (guardrail planned, D-09).
3. **Near-white is not a clip detector.** `luma > 0.9` also counts clipped
   whites; edge energy inside the near-white mask and seam readability must be
   checked by eye (art director checks in `ART_BRIEF.md` §4).
4. **Red share is not route readability.** Banners and props satisfy the metric;
   hue/saturation and continuity of the route line are not measured.
5. **Framing changes metrics.** The same renderer at a different pose or lens
   moves `near-white`/`sky`/`luma` strongly; revision-1 and revision-2 numbers are
   not comparable, and no W1 claim may be based on re-framing a shot instead of
   changing the look.
6. **No human acceptance.** W0 numbers and the blind review are machine/
   model-mediated; owner acceptance remains required (plan §2.1, `DECISION_AT_100`).
7. **No frame-copy intent.** Passing the bands is not "matching a screenshot";
   the target is the reference language (D-06).
8. **FPS not measured here.** The plan's W1 gate (≥ 55 fps at 1600×900 high) is
   out of scope for W0.

## 8. Open items handed to W1

1. **Fix the three systemic defects** from §6/`ART_BRIEF.md` §3; verify with the
   same six-shot capture and blind review (4/6 gate).
2. **Composition limits forced by geometry/contract** (from the capture executor,
   honest list): no camera roll in the contract (wall-run 8–15° roll is
   unrepresentable, accepted as roll=0 for capture); `first-gap` is backed by a
   15-step stair only 4 m after the landing, so the gap cannot dominate MG without
   W3 geometry, and the closed canyon tops out its sky share; `start-roof` sky is
   limited by the tall city wall on the right (22–28 % visible vs 35–40 % card);
   `skybridge` cannot show the city below or 40–55 % sky before W1+/W2 (solid
   parapets, missing suspended load); `service-block` has no red door in the duct
   (red landmark is an entrance rail that leaves the frame after the dolly) and
   the duct edge is thin — W2 content; the "04 / SKYBRIDGE" billboard left the
   frame as a side effect of the dolly and is a candidate to re-introduce in W1.
3. **Anti-gaming guardrails** (D-09): sky mask above the horizon, edge energy
   inside the near-white mask, continuous red component with HSV S ≥ 0.6. Given
   §5 (`sky-blue` 65.9 % on a glass wall), this is the first W1 measurement task.
4. **Perf instrumentation** — reconcile `stats()` counts with the full-run
   overlay before any perf claim (W5).
5. **FOV contract** — resolved: 50° vertical (D-11).

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
| Dev-only capture boot, six fixed poses, no menu/HUD, frozen time | ✅ `?capture=1&level=prologue&shot=<id>` at 50° FOV; byte-identical across independent loads |
| `tools/capture.*` Playwright Edge harness, 1600×900 PNGs, iteration dirs | ✅ `tools/capture/capture.mjs` + `captures/<iteration>/manifest.json` |
| `tools/metrics.py` measured identically for reference and captures | ✅ v2.1, three verdict modes, reference recompute + calibration |
| Audio render + metrics tooling | ✅ landed earlier, 5/5 prologue targets in existing evidence (listening pass open) |
| `docs/reports/BASELINE.md` with real numbers and six images | ✅ this document + `docs/evidence/w0-baseline/` |
| Meta-requirement: reference bands recomputed by our own script | ✅ [`reference-prolog.json`](reference-prolog.json), [`METRIC_SPEC.md`](METRIC_SPEC.md), D-02 |

**G0 is not a look gate.** The baseline is red by design: AD 0/6 PASS, shifted
bands 3–6/13 per shot at the owner-approved 50° lens. That is the starting line
for W1, with the fixes in `ART_BRIEF.md` §3 and `BLIND_REVIEW_W0.md`.
