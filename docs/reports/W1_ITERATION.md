# W1 iteration 1 — look foundation (report)

**Date:** 2026-11-19 · **Branch:** `feat/art-audio-level` (nothing merged to `main`).
**Scope:** W1.1 bounded iteration (see [`DECISIONS.md`](DECISIONS.md) D-12):
colour script, glass/materials, light key, emissive hygiene, guardrails, perf
probe. Poses frozen at FOV 50 (BASELINE revision 2). Targets:
[`W1_TARGETS.md`](W1_TARGETS.md).

## 1. What changed (by owner)

| Owner | Files | Change |
|---|---|---|
| exec-look | `PostPipeline.ts`, `SkyDome.ts`, `Renderer.ts`, `RenderScene.ts` | Removed the plan-banned highlight-clip hack; added a scene-linear exposure/white-balance pass before bloom (bloom now emissive-only, threshold 4.0 in exposed units), ACES tone map with a strictly monotone exponential shoulder (no flat white plateau), black-point lift, display-space contrast curve, split-tone pivot/width control, CA off at idle, grain/vignette reduced; brighter cobalt sky gradients + horizon haze; PCFSoft shadows; in the fix round: deterministic sky-visibility probe + AO-only quarter-res pass that modulates **ambient only in interior views** (open-roof frames are byte-identical to before, Δluma ≈ 0.0002), neutral-cool bounce in interiors, GTAO blend 0.65→0.70 |
| exec-content | `ReleaseArenaPolish.ts`, `PrologueCity.ts` | `PROLOGUE_ENVIRONMENT`: sun 47.6°→59°, neutral sun `0xfff8f0`, sun intensity 7.4, hemisphere 0.23, cobalt zenith `0x2050d8`, horizon `0xe8f0f8`, fog 60/380, cloud cover 0.50; emissive hygiene (signs ≤0.15/0.10, window cells unlit, route markers ≤0.10, roof-edge strips 0); muted foliage; fix round: black void panels → louvre/grating, skybridge fascia thinned, continuous red route strip (continuity 0.22 %→0.58 %), deck expansion joints `dark-metal`→`metal` (not black holes) |
| exec-materials | `MaterialLibrary.ts` | Glass `0x6b879b/0.14/0.72` → `0x1a2530/0.10/0.60` (dark reflective mass, env 1.30), glass-far `0x283038`; white `0xf8f8f8` (rough 0.62); roof `0xf1f1ed` (rough 0.60, seams 0.96 m, bump 0.40); concrete `0xc7c9c7`; red `0xd52e36`, neutral wear mask (salmon fade removed); metal `0x747a7d/0.40/0.85`; orange `0xf08a2a`; smooth roughness modulation; anti-swirl detail/parallax; fix round: glass sheen env 1.70 / rough 0.13 / fresnel tint |
| exec-metrics | `metrics.py`, `METRIC_SPEC.md` | Perceptual guardrails as diagnostics: `sky_mask_share` (real sky vs blue facades, horizon-based, lit-white-wall exclusion calibrated in the fix round), `near_white_seam_energy`, `red_route_share` + `red_route_saturation`; measured-reference bands; §2.1 metrics untouched (round-93 diff 0.0) |
| exec-perf | `tools/capture/perf.mjs`, README | FPS probe: headless Edge, 6 poses, warmup 120 + 300 rAF frames, avg/median/1 % low/p95, JSON + summary, `--strict --min-fps`; HMR suppressed during measurement, bounded teardown |

## 2. Determinism

Final integrated capture: **6/6 byte-identical** across two independent passes
(`captures/w1-final/manifest.json`), console/page errors 0. The W1.1 flake
(1 px ±1/255 on the FINISH glyph rim) is covered by the new contract D-13:
byte-identical preferred, otherwise ≤1/255 on ≤0.01 % pixels with identical
scene stats; the harness records `byteIdentical`, `differingPixels`,
`differingShare`, `maxChannelDelta`.

## 3. Numbers: baseline revision 2 → W1.1

Shifted-band PASS count per shot (of 13), baseline → mid-iteration → final:

| Shot | Baseline rev2 | W1.1 mid | W1.1 final | Final verdict |
|---|---:|---:|---:|---|
| `start-roof` | 6 | 10 | 10 | **blind PASS** |
| `first-gap` | 5 | 11 | 11 | blind FAIL (depth read/stairs, content) |
| `wallrun-corridor` | 3 | 9 | 7 | **blind PASS** |
| `service-block` | 6 | 3 | 5 | **blind PASS** (flat interior fixed) |
| `skybridge` | 3 | 11 | 8 | blind FAIL (solid parapets, W2 content) |
| `finish-roof` | 5 | 9 | 8 | **blind PASS** |
| **Total** | **28/78** | 53/78 | **49/78** | |
| tolerance total | 43/78 | – | 62/78 | |

Final per-shot values and failures: [`w1-metrics.md`](w1-metrics.md) /
[`w1-metrics.json`](w1-metrics.json). Working metrics after the iteration:
luma std 0.225–0.296 (5/6 in band), near-white 25.5–28.8 % on roof shots (in
band), deep-shadow 0.0 (band ≤3.68), edge energy 6/6, red share 6/6, top-third
contrast 4/6 (was 1/6), split 1/6 (warm/cool balance still off on some shots),
local_contrast 1/6 (regressed from a mid-iteration 4/6 — the less-contrasty
`metal` joints and the new sheen cost mid-scale contrast; fix list §6).

Guardrails (v2.3): seam energy 0.0053–0.0092 (healthy 0.0047–0.012 → no flat
clip); red continuity 0.31–1.99 % with HSV S 0.73–0.99 (green); sky-mask
service 17.9 % (still flags the interior; the diagnostic is being read with the
frame, recalibrated windows in W1_TARGETS §6); real-sky shares on exterior
shots 4.7–14.3 % vs sky-blue metric 30–59 % — the over-count is now visible
instead of hidden.

## 4. Blind art-director gate

Six unlabeled pairs (our frame + reference frame, randomized order):
**4/6 PASS** — `start-roof`, `wallrun-corridor`, `service-block`, `finish-roof`.
`first-gap` and `skybridge` fail on content/geometry, not on look: floating
lower-roof underside + stair monolith; solid parapets hiding the city (W2
glass rails and vista). The blind threshold 4/6 is reached, but the gate is
**not closed** yet: the plan rule "no shot may regress more than one band to
gain another" is violated by three shots between mid-iteration and final
(sheen blue cast + lower-contrast joints), and the fps ≥ 55 proof is still
pending on a quiet machine.

## 5. Performance probe

`perf.mjs` runs (instrument smoke): 60.00 fps on a clean single-shot reference;
in a contended 6-shot run the worst pose read 47.87 fps (host load average 7–16
from parallel agent harnesses) — **not accepted as the gate number**. The gate
run must be a single isolated pass on a quiet machine after the fix round;
numbers and caveat are recorded in [`w1-perf.json`](w1-perf.json) /
`captures/perf-w1-gate/`.

## 6. Remaining fix list (bounded, W1.1b)

1. Materials: deck joints `metal`→ cool dark steel `0x2b3542`-class; glass sheen
   fresnel tint → neutral steel `#585c60`, env 1.70→1.55 (removes the blue cast
   that pushed sky-blue/split/saturation out of band).
2. Content: joints/steel line read — tie the first-gap floating tab to a hazard
   plate and dress the lower-roof underside (contact shadow), project 5/6 blind.
3. Look: GTAO blend 0.70→0.78 for mid-scale contact contrast; interior ambient
   tint → `#d4d8dc`, AO weight 0.85 (service sky-mask, white point).
4. Harness/targets: record AD amendment to iteration-1 sky-mask windows
   (pose-limited) in `W1_TARGETS.md`; service `split` → report-only (dark mask
   there is shadowed route-red, structurally warm).
5. Gate: isolated `perf.mjs --strict` run for the fps claim; fresh integrated
   capture + metrics + full blind set after the fixes.

Explicitly deferred: skybridge glass rails and city-below vista, first-gap stair
geometry, sky vistas for start/finish, duct and red door for service-block,
04/SKYBRIDGE billboard (all W2/W3 per W1_TARGETS §5).
