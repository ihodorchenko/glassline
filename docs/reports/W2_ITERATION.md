# W2 iteration 1 — content language and materials (report)

**Date:** 2026-11-20 · **Branch:** `feat/art-audio-level` (nothing merged to `main`).
**Scope:** W2.1 bounded iteration (DECISIONS D-16): content language + materials,
look layer frozen, route geometry/colliders/triggers untouched.
**Targets:** [`W2_TARGETS.md`](W2_TARGETS.md) (incl. AD amendments §6).

## 1. What changed (by owner)

| Owner | Files | Change |
|---|---|---|
| materials | `MaterialLibrary.ts`, `LevelTypes.ts` | New **`glass-rail`** material (transparent, opacity 0.4, rough 0.08, metal 0.2, env 1.2, double-sided, depthWrite false); **straight-tile albedo/height split** for roof/concrete/plaster — the swirl-bump source (stains in the luma/height path) is gone, straight seams 0.96 m, height in the alpha channel, bump reuses the sampled height (−6 texture fetches/pixel), stains/roughness stay in albedo |
| content-2 | `PrologueArena.ts` | `geo_skybridge_rail_west/east` `glass`→`glass-rail`; the 15 flight steps `geo_skybridge_step_*` `metal`→`concrete`; material-only, no size/position/surfaceId/collider changes |
| content | `PrologueCity.ts` | Suspended load + gantry above the skybridge (skip 1.8×1.2×1.4, 4 cables, red band, 3.4 m clearance), cap rails + posts 5/side, side service roofs (y −12/−16, x ±8…14, z −44…−56) and near-band with plants/risers under the span, city-below props; duct soffit with ribs + red frame + side ducts; red door on the wallrun corridor (x −2.2, z −14.0) with frame/handle/pipe; first-gap red nosing on 15 steps + lower-roof dressing (caps, vents, AC); start-roof bulkhead panels/vents + continuous red strip; finish-roof red strip + AC; sky opening by cutting the approved decorative towers (start: (−30,−48)→10, (32,−50)→14, (−32,−84)→20, (−60,−66)→16, (64,−64)→20; finish: `city_2313`→8, `city_2197`→10, (4,−215)→10, (32,−26) reverted to 11); background facade grids for `addBuilding`/`addFarSkyline` towers (empty-slab fix); floating decoration audit (crane/trims removed or re-bound); red strips widened 0.15→0.35 m; deck joint colour `0x9aa0a4` |
| boot | `captureShots.ts` | Four poses re-framed per AD shot cards (start-roof lookAt up, service-block z −8.6→−6.7 with 12° yaw so the moved door is MG-left, skybridge z −46.5 on the span, finish-roof pitch/yaw), FOV 50 unchanged, ids unchanged |

Look layer (`PostPipeline/SkyDome/Renderer/RenderScene`) was **not touched** in
W2.1, so content effects are attributable.

## 2. Determinism and validation

- Final capture `captures/w2-final2`: determinism **6/6 accepted** under D-13
  (5 byte-identical + 3 px at Δ1/255; 6/6 passed), PNG 1600×900 @DPR1, console
  and page errors 0.
- `npm run validate` green: typecheck, biome, **293/293 tests**, production
  build. Route validator/integration tests green — no collider/geometry changes.
- Scene density grew: open shots 1.38M→1.58M triangles, service-block
  1.38M→2.38M triangles / 194 draw calls (the tunnel batch enters the frustum);
  the perf probe still reports 60.00 fps on all six poses.

## 3. Numbers (W1 final → W2.1 final)

Shifted-band PASS per shot (family-calibrated per AD amendments; traceability):

| Shot | W1 final | W2.1 final | Reading |
|---|---:|---:|---|
| start-roof | 9 | 6 | open sky/high-key family (AD L\* 0.55–0.70); sky-mask 13.8 in window 12–22 |
| first-gap | 10 | 10 | unchanged; sky-mask 1.9 in amended 1.5–25 |
| wallrun-corridor | 9 | 10 | improved; seam 0.0038 WATCH |
| service-block | 5 | 6 | improved; interior red 2.25 % (door+reflections, report-only), split report-only |
| skybridge | 10 | 8 | glass rails visible; sky-mask 5.5 (override 522) inside 4–14 |
| finish-roof | 9 | 6 | open sky/high-key family (AD L\* 0.55–0.80); sky-mask 10.1 in 8–18 |
| **Total** | **52/78** | **46/78** | shifted is traceability; the gate is the blind verdict + amended windows |

Guardrails: near-white seam 0.0031–0.0047 (WATCH with plateau ≤1.5 % verified at
100 % zoom); red continuity 0.31–2.25 % with HSV S 0.79–0.98 — continuous line
mandatory criterion passed; sky-mask windows per AD amendments; white point
neutral.

Perf gate (`perf.mjs --shot all --strict`, host load ≈4): **60.00 fps average on
all six poses**, 0/6 below 55, median 59.88, 1 % low 59.52, p95 frame time
≈16.7 ms (`docs/reports/w2-perf.json`). Headless-rAF cap caveat applies; real
window number is W5. Frame density increased while fps stayed at the cap.

## 4. Blind gate result

**6/6 PASS** on unlabeled pairs; **canyon/rooftop gate G2 closed** (4/4 frames
meet the mandatory depth / continuous-red / BG-detail criteria plus ≥3 optional
ones; skybridge depth through the transparent rails confirmed). Full record:
[`BLIND_REVIEW_W2.md`](BLIND_REVIEW_W2.md). Gate conditions: no shot lost >1
band to gain another (no look/shot edits this iteration; the shifted drop is the
documented open-sky family calibration), fps proxy ≥55 without regression,
determinism 6/6 accepted.

## 5. Residual → W2.2 / W5 (non-blocking)

1. **Look (W2.2):** chroma/zenith punch, prop-shadow coverage 8–15 %, mid-scale
   local contrast (LC 0.203–0.248), skybridge rail tint/opacity
   (#1a2530/0.35 vs the current milky look).
2. **Materials (W2.2):** straight tile on the remaining surfaces (wallrun
   parapet, service floor), red paint roughness 0.45→0.6 (kills the mirror
   glints on route dashes).
3. **Content (W2.2):** denser BG grids on cut/ring towers, mid-deck prop
   clusters, first-gap lower-roof dressing, gantry beam support on start-roof,
   wallrun grille recess.
4. **W5:** real-window FPS measurement and release hygiene.

## 6. Evidence

- Final frames: `captures/w2-final2/*.png` (git-ignored) and committed JPEGs in
  `docs/evidence/w2-1/`.
- Metrics: [`w2-metrics.md`](w2-metrics.md) / `.json` (with `--horizon-px 522`
  override for skybridge), perf: [`w2-perf.json`](w2-perf.json).
- Targets and amendments: [`W2_TARGETS.md`](W2_TARGETS.md) §6.

## 7. W2.2 residual polish (2026-11-20)

One bounded iteration closing the non-blocking list from `BLIND_REVIEW_W2` /
§5 (DECISIONS D-18). Look layer was unfrozen for this iteration only; route
geometry/colliders/triggers untouched; `validate` green (293 tests).

| Owner | Change |
|---|---|
| look (AD-5 numbers) | contrast curve 0.62→0.68, shadowTint (1.06,1.01,0.98)→(0.94,1.00,1.10), SkyDome chroma/radiance recalibrated to the new stops (skyChroma 0.55/0.42→0.32/0.22, skyRadiance 1.0/1.15→1.05/0.88); exposure 1.65, knee 0.92, sat 2.4, GTAO 0.70, bloom/grain/CA/vignette frozen |
| env (content-2) | PROLOGUE_ENVIRONMENT: zenith `#1c48d0`, mid `#4a86c8`, horizon `#dceaf6`, cloudCover 0.42, cloudShadow `#a8b8cc`, sunAzimuth 2.6 rad, sunElevation 0.92 rad, hemisphereIntensity 0.20; sun 7.4 and fog 60/380 unchanged |
| materials | straight-tile for `facade` (wallrun parapet walls), residual triplanar moiré removed via detail scale 3.3→2.3 / mix 0.12→0.05 on straight-tile maps; red roughness 0.45→0.60 (kills the mirror glints on route dashes); glass-rail tint `#1a2530` / opacity 0.35 |
| content | denser background facade grids (rows 4–12, 3 punched windows per bay, 4 pilasters, roof caps/props), mid-deck prop clusters (3 on start roof, 2 on finish, 2 lower decks + planter), first-gap underside/deep-roof dressing, gantry beam now a cable-stayed truss with piers/masts/stays, wallrun grille recessed with frame/louvers; decorations 2623→3101, Δdraw calls 0 |

**Numbers (W2.1 → W2.2 final):** shifted 46→**49/78** (traceability; family
windows are the reading), luma families all inside AD windows (start 0.624,
finish 0.600, skybridge 0.650, first-gap 0.614, wallrun 0.485, service 0.488),
saturation start 0.295 / gap 0.275 / skybridge 0.252 in band, wallrun 0.324
hairline, finish 0.371 (amended 0.20–0.40), service 0.248; plateau/clip clean
(pure255 = 0, luma ≥0.995 = 0.00 %), white point |R−B| 3.9–5.8 ≤6, seam
0.0032–0.0043 (WATCH window), sky-mask in windows (wallrun amended 1–15),
red continuity continuous lines (component ≥0.25 amended).

**Perf:** headless `--strict` worst 59.8 avg (0/6 <55) at 1.86 M open / 2.79 M
service-block triangles; **real window (headed Edge, 120 Hz display) worst
service-block 66.77 avg, median 66.23, 1 % low 45.04; other shots 84–96 avg** —
the W5 real-window FPS item is materially answered (1 % low service remains a
W5 optimization). Determinism 6/6 byte-identical.

**Blind re-run: 6/6 PASS** ([`BLIND_REVIEW_W2.md`](BLIND_REVIEW_W2.md) re-run
section). **W2.2 closed** with an accepted-residual register moved to W5
(see `W2_TARGETS.md` §8): LC ≥0.274 (≥0.240 service), tc ≥0.235 on
finish/start, split family window −42.5…−13.2, skybridge/service split
report-only, service 1 % low ≥55.
