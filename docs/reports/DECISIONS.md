# DECISIONS — art/audio/level pass

Operating log of lead decisions for the pass defined in
[`../VISUAL_AUDIO_LEVEL_PLAN.md`](../VISUAL_AUDIO_LEVEL_PLAN.md) §5.1(5):
"no silent decisions — design or contract changes go to the lead and are
recorded here with a one-line rationale".

Format: `D-nn` · date · decision · rationale · evidence pointer.

---

## D-01 — Branch and workspace (2026-11-19)

Work happens on `feat/art-audio-level`, branched from the current `grafics`
HEAD (`ae63a95`; `grafics` and `main` were identical at that moment, both 0
commits apart). The pass starts with two prerequisite commits:

- `2c5ed6f` — `chore(checkpoint)`: entry state. The only uncommitted artefact
  was a local generated release bundle (`glassline-final-build.zip`, 4.4 MB);
  it is ignored rather than committed (D-08).
- `32aa2ba` — `chore(tooling)`: `playwright@1.65.1` devDependency (capture
  harness drives the installed Microsoft Edge via `channel: "msedge"`, so no
  browser download) and `captures/` ignored.

**Nothing is merged into `main` without an explicit owner instruction.**

## D-02 — Metric bands: measured reference is the source of truth, uniform shift (2026-11-19)

**Finding.** The `Reference` column of plan §2.1 is not reproducible by the
repository harness. Reproduced with `tools/capture/metrics.py` on
`ref/reference/prolog-kit/study/05-prologue-roofs` (20 frames), the measured
means differ from the plan column for 9 of 13 metrics; the plan column matches
`docs/GLASSLINE_REFERENCE_AUDIT.md` §2.3 exactly, value for value — i.e. it was
produced by a predecessor harness/frame set, not by this repository. At the same
time the v2 script reproduces the v1 numbers bit-for-bit (round-93 `start.jpg`:
max abs diff 0.0 over all 13 metrics), so history stays comparable.

**Decision.** Use the measured reference (this script, this 20-frame set) as the
source of truth, and re-base the plan §2.1 bands by a uniform per-metric shift:

    Δ = measured_reference_mean − legacy_reference_value
    shifted_band = legacy_band + Δ      (widths / margins preserved 1:1)

The shift is computed from data by `metrics.py` and asserted: the measured
reference mean must fall inside all 13 shifted bands (13/13, enforced
invariant). Three verdict modes coexist:

| mode | formula | role |
|---|---|---|
| `tolerance` | `\|candidate − measured_ref_mean\| ≤ v1 tolerance` | v1 continuity / regression gauge, comparable with rounds 1–100 |
| `shifted` | absolute `legacy_band + Δ` | W0 acceptance target (plan intent at the measured scale) |
| `legacy` | raw plan §2.1 band | traceability only |

| Metric | Legacy ref | Δ | Shifted band |
|---|---:|---:|---|
| Luma mean | 0.589 | +0.0262 | 0.506224 … 0.646224 |
| Luma std | 0.272 | +0.0226 | ≥ 0.242584 |
| Luma p25 | 0.370 | +0.0010 | 0.330988 … 0.420988 |
| Luma p95 | 0.979 | +0.0016 | ≥ 0.9316 |
| Near-white share % | 27.3 | +7.1913 | 22.1913 … 35.1913 |
| Deep-shadow share % | 3.0 | −2.3219 | ≤ 3.6781 |
| Saturation | 0.359 | −0.0590 | 0.241027 … 0.321027 |
| Local contrast | 0.0713 | +0.2137 | ≥ 0.273703 |
| Edge energy | 0.0341 | −0.0147 | ≥ 0.0132946 |
| Sky-blue area % | 53.1 | −9.8417 | 25.1583 … 45.1583 |
| Top-third contrast | 0.0585 | +0.1848 | ≥ 0.234796 |
| Split-tone dark R−B | −48.6 | +26.7931 | −28.2069 … −13.2069 |
| Red accent share % | 4.2 | −1.8062 | 0.193789 … 3.19379 |

**Evidence.** [`METRIC_SPEC.md`](METRIC_SPEC.md) (formulas, JSON schema,
limitations), [`reference-prolog.json`](reference-prolog.json) (per-frame
recompute), [`BAND_CALIBRATION.md`](BAND_CALIBRATION.md) (calibration runs).

## D-03 — Gate interpretation: bands are mean-level targets, blind review binds (2026-11-19)

Calibration shows the reference set itself is wider than the legacy band widths:
no single reference frame passes 13/13 under any scheme (shifted mean 7.05/13,
tolerance 8.75/13, legacy 7.25/13; best frame 11–12/13). Reference-frame spread
(`near_white` sd 18.2 pp vs band width 13; `split` sd 25.6 vs 15) means a global
band cannot be per-frame membership.

**Decision.**
1. The §2.1 bands (shifted) are **mean-level targets** for the six fixed shots;
   they are not a per-frame membership test and must not be reported as one.
2. The binding look gate for W1 is the art-director blind review (plan §2.1:
   4/6 shots PASS); metrics are the guardrail and regression detector.
3. Dark compositions legitimately miss `sky-blue`, `near-white`, `p95` by design
   (`service-block`). Per-shot metric verdicts are reported, and a shot's
   applicable metric family is recorded when it is structurally exempt
   (documented per shot in the baseline report, not silently waived).
4. No shot may regress one band to gain another (plan §2.1) — enforced by
   reporting all 13 metrics for every shot, never a subset.
5. Provisional W1 numeric goal (set after the baseline numbers exist): hero
   `start-roof` 13/13 shifted; remaining daylight shots ≥ 11/13 shifted; the
   interior shot judged on `deep_shadow`/`split` plus blind review.

## D-04 — Capture determinism: seed `Math.random` under capture mode (2026-11-19)

Two independent page loads produced different PNG hashes while the scene-state
hash and a raw WebGL render (bypassing post-processing) were identical. Root
cause isolated by `exec-capture`: `GTAOPass._generateNoise()` builds a
`SimplexNoise` whose permutation table is filled via `Math.random()`, so the
64×64 AO noise texture differs per load (mean pixel delta 0.2–0.8/255,
invisible, but hash-breaking). With GTAO off, hashes match.

**Decision.** Under `?capture=1` only, `prepareCaptureMode()` installs a seeded
`Math.random` (mulberry32, fixed seed) before application initialisation, so
the noise table is deterministic. Production path untouched. Acceptance for
W0: byte-identical sha256 for all six shots across independent loads
(`captures/<iteration>/manifest.json` records both passes).

## D-05 — Capture evidence is regenerated, not committed (2026-11-19)

`captures/` is git-ignored: six 1600×900 PNGs ≈ 12–13 MB. The committed record
is the `manifest.json` schema, the shot list, the commands and the numbers in
[`BASELINE.md`](BASELINE.md); images are referenced by path and can be
reproduced with one command. Per-iteration JPEG downscales may be copied under
`docs/evidence/` if a gate sign-off needs a durable image.

## D-06 — Scope and fidelity target (owner directive, 2026-11-19)

Prologue first (Training arenas later); the target is the reference **language**
— palette, composition, lighting key, materials, route beats — not a copy of
specific frames. Recorded from the owner's message; it answers open decisions
§10.2 and §10.3 of the plan.

## D-07 — Roles and amendments (2026-11-19)

- Art director = `qwen-token-plan/qwen4-max` subagent: decides look, shot cards,
  asset specs, blind PASS/FAIL. **Read-only**: does not edit files or run
  builds; the lead records its briefs (see [`ART_BRIEF.md`](ART_BRIEF.md)).
- Executors = `deepseek-account/deepseek-flash` subagents: work only inside the
  task card's write scope, never commit, never switch branches.
- Lead: sequencing, task cards, integration, verification, commits, final
  report; does not paint art or author level geometry directly.

## D-08 — Checkpoint WIP handling (2026-11-19)

The pass was allowed to commit current WIP as one checkpoint commit. The tree
was clean apart from the untracked `glassline-final-build.zip` (4.4 MB generated
release bundle). Committing a binary build artefact would bloat history with no
reproducibility gain, so it is added to `.gitignore`; the checkpoint commit
contains only that ignore rule and a message describing the entry state.

## D-09 — Anti-gaming guardrails are diagnostics, not replacements (2026-11-19)


The art director identified three ways to pass §2.1 while losing the look:
teal glass counted as "sky-blue", clipped whites counted as "near-white", and
banner red counted while the route reads salmon (details in `ART_BRIEF.md` §4).
**Decision.** These become *additional diagnostic checks* in W1 (sky mask above
the horizon, edge energy inside the near-white mask, continuous red component
with HSV saturation ≥ 0.6 on the route line). They never replace the §2.1
metrics and they never become PASS/FAIL substitutes for blind review.

## D-10 — G0 closed with a red baseline; W1 targets recorded (2026-11-19)

**Outcome.** Harness, metrics and baseline exist with real numbers; determinism
is proven (six shots byte-identical across independent Edge launches). The look
is **not** there, and this is recorded as the starting line, not as a failure of
G0: the art-director blind review returned **0/6 PASS** (plan gate for W1 is
4/6), while all six route beats were recognised without labels. Shifted bands:
6–8/13 per shot; hero `start-roof` 6/13. Full record:
[`BASELINE.md`](BASELINE.md), [`BLIND_REVIEW_W0.md`](BLIND_REVIEW_W0.md).

**Rationale for a red baseline.** A baseline that looks good on day one would
mean we never measured the real gap. Metrics alone would have told a different
story (v1 tolerance: four shots 8–13/13) — which is exactly the "numbers pass,
image does not" risk in plan §9, and why D-03 makes blind review binding.

**W1 entry targets (from [`ART_BRIEF.md`](ART_BRIEF.md) §3 and the blind review):**
1. Colour script: neutral `#F8F8F8` whites, sky gradient `#2050D8→#E8F0F8`,
   route red `#E80018`/`#D52E36` without fade/salmon; signal: saturation in
   0.241–0.321, split −28.2…−13.2, sky-blue 25.2–45.2 %, plus a real sky mask.
2. Glass/materials: dark reflective glass `#1A2530` rough 0.10 metal 0.6
   env 1.3, spandrels `#2A3A44`; signal: deep-shadow 2–4 %, luma std ≥ 0.243,
   split in band.
3. Light key: sun elevation 55–65°, readable cool prop shadows (luma 0.25–0.40),
   penumbra 2–4 px; signal: `top_contrast` (currently 0/6) and `local_contrast`
   reach the shifted bands, deep-shadow ≤ 3.68.
4. Re-run the same six-shot capture + blind review after 1–3; a gate closes only
   with attached evidence (plan §7).

**Open items also recorded:** FOV contract disagreement (vertical 65° vs hFOV
78–82°), geometry-limited compositions (no camera roll, white wall-run walls,
no red door in duct, unreachable "city below" in `first-gap`, fixed overhead
bridge in `start-roof`), guardrails from D-09, and the `stats()` vs full-run perf
count discrepancy. See `BASELINE.md` §8.

## D-11 — FOV contract moved to 50° vertical; band policy owner-confirmed (2026-11-19)

**Owner decision (explicit, this date):** the capture contract uses **50° vertical
FOV** (hFOV ≈ 78° at 16:9), replacing the provisional 65° vertical. Both this and
the D-02 band policy ("measured reference is the source of truth, uniform shift")
were confirmed by the owner in the same message.

**Rationale.** 65° vertical ≈ 97° hFOV is a fisheye-like lens that no reference
frame uses; the art director's shot cards are authored for hFOV 78–82°, and the
blind review would otherwise judge the wrong frame. 50° vertical matches the
reference lens and keeps the "readable first-person parkour" feel.

**Implementation and consequences.**
- `src/diagnostics/captureShots.ts` → `CAPTURE_FOV_DEGREES = 50`; contract shape
  unchanged (position + lookAt + fov per shot, no camera roll).
- Frames recorded at 65° (G0 revision 1, commit `2442b54`) are superseded; the
  baseline is re-captured and re-measured at 50° before W1 claims any numbers.
  Revision-1 evidence remains in git history and in the FOV-65 metrics files.
- At 50° one shot (`first-gap`) exposed a scene-state nondeterminism that the
  wider lens had hidden (draw calls 120 vs 122, 976 pixels at ±1/255); it is
  fixed under capture mode before the baseline is re-frozen (task W0-E), so the
  determinism contract stays byte-identical rather than "visually identical".
- The narrow lens changes framing, so pose corrections go through the art
  director (task AD-2) and are applied before the final W0 numbers are taken.

### D-11 addendum — FOV 50 implemented, determinism re-proven, baseline revision 2 (2026-11-19)

- `CAPTURE_FOV_DEGREES = 50`; six poses re-authored after the AD-2 framing pass
  (pose-only corrections; camera roll remains unrepresentable). See `BASELINE.md`
  §2 for the final pose table.
- The narrower lens exposed a **GPU-baked state** nondeterminism in `first-gap`
  (976 px at ±1/255; scene graph and camera matrices identical across loads).
  Fixed in capture mode only: re-pin surface/quality after level start, rebuild
  the PMREM sky probe and shadow map from the frozen state, pre-compile shader
  programs for all six poses in fixed order, and replace the fixed 2-frame wait
  with a GPU-readback settle gate (identical checksum on two consecutive
  frames). Evidence: 3 independent full runs → 18/18 byte-identical PNGs, plus
  the canonical `captures/w0` run reproducing the same hashes.
- Art-director framing corrections that are **not** pose-solvable are recorded
  as W1+/W2/W3 content work in `BASELINE.md` §8 (first-gap stair dominance and
  sky share, start-roof city-wall sky limit, skybridge city-below and suspended
  load, service-block duct edge and red door, wall-run camera roll).
- Revision-1 (FOV 65) artefacts are preserved: archived metrics
  `w0-baseline-metrics-fov65.{md,json}`, archived images
  `docs/evidence/w0-baseline/fov65/`, and git commit `2442b54`. Revision-1 and
  revision-2 metric values are **not comparable** — different lens and poses.
