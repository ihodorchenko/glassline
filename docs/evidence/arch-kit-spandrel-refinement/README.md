# Architectural Kit — Step 2.3C — spandrel refinement evidence

Deterministic review evidence for the spandrel cassette edge/shadow-gap refinement
and the local `spandrel` material correction of the `curtain-wall` module.

- **Base:** `c94ec0a6b01187113217291c1e56cbd42856baa1` (`feat/arch-spandrel`,
  Step 2.3B).
- **Baseline:** `captures/step23c-before` — captured from a clean tree at the base
  commit on the new branch; the nine original hashes match the archived Step 2.3B
  after run `captures/step23b-final` exactly. The tenth shot
  (`kit-spandrel-closeup`) is new in Step 2.3C and was captured on the same clean
  baseline.
- **After:** `captures/step23c-final` — branch `feat/arch-spandrel-refinement`,
  10 shots.
- **Detail pass:** `captures/step23c-detail` (same `kit-glass` route at
  3200×1800), `captures/step23c-detail-before` (the same pass on the baseline)
  and `captures/step23c-detail-closeup` (the new close-up at 3200×1800,
  after-only supporting pass).
- **Route:** `?capture=1&level=architecture&shot=<id>`, 1600×900, DPR 1,
  Microsoft Edge 157 headless, display quality `high`.
- **Commands:**

```bash
npm run capture -- --iteration step23c-before --level architecture --shot all
npm run capture -- --iteration step23c-final --level architecture --shot all
npm run capture -- --iteration step23c-detail --level architecture --shot kit-glass \
  --width 3200 --height 1800 --no-verify-determinism
npm run capture -- --iteration step23c-detail-closeup --level architecture \
  --shot kit-spandrel-closeup --width 3200 --height 1800 --no-verify-determinism
npm run capture -- --iteration step23c-after-prologue --level prologue --shot start-roof \
  --no-verify-determinism
npm run kit:lifecycle -- --iteration step23c-lifecycle
```

The `--iteration step23c-detail-before` and `--iteration step23c-before-prologue`
runs were captured on a clean stash of the same tree.

## After sha256

| # | Shot | sha256 | draw calls | triangles |
|---|---|---|---:|---:|
| 1 | `kit-overview` | `610da66437872f1ca6cb880cc276e81d97f0a3feef6316d60c98fb4d1b8df4f4` | 270 | 309,423 |
| 2 | `kit-facade` | `86af7ca0799ac66fa965e8c707b1d80179a00b896db224631c7af4b6d6fc1945` | 270 | 309,423 |
| 3 | `kit-glass` | `0540169890380506a5086b037f0dfeb72a179d1fa23d6981061e34280fd47ca7` | 270 | 309,423 |
| 4 | `kit-spandrel-closeup` | `32bd04be55b81f03220520d854b7c41ec99cfa865c188f072ab926794704dcd0` | 270 | 309,423 |
| 5 | `kit-corner` | `c2cfa4610aa3879453996603ddb73fbca79f0ab645dacbe53896224fdd1f6136` | 270 | 309,423 |
| 6 | `kit-canopy` | `b2e6802ec34087da80d1081d559fd3a103f5cca102f2f8758dd4ab6607dcec80` | 270 | 309,423 |
| 7 | `kit-service` | `800e1c2e857ba937da52a285c6b8643e4d02d9568d4bc896b99529e2042a703b` | 270 | 309,423 |
| 8 | `kit-player-eyes` | `45e08dad85e25d98b4da3f017141134a77893991e65044057f43e17113ac9c1a` | 270 | 309,423 |
| 9 | `kit-distant` | `e5795f2db8350e98954c08067e00b114b48aef69c3de087fcd9ad0ef0fb2356f` | 270 | 309,423 |
| 10 | `kit-bridge` | `a25e7e23cbf997e6be91a66d9bfab9a392c591633be905975f585f48275c2c2e` | 270 | 309,423 |

Determinism: **10/10 byte-identical** across two fresh Edge instances, 0 differing
pixels, 0 console and 0 page errors on every shot. The nine original frames kept
their previous hashes. Draw calls are unchanged (270); triangles rise from
308,463 to **309,423** (+960, +0.31 %) because of the chamfered cassette plates.
`kit-service` is byte-identical to the baseline: that frame contains no curtain
wall, so the change is scoped to the spandrel modules.

Baseline hashes (`baseline-sha256.json`) are byte-identical to the archived Step
2.3B after run for the nine original shots: the branch starts from the reviewed
2.3B state. The new close-up is the permanent regression view for the spandrel
edges, gasket reveal, dark backing and head rail transition.

## Panel / seam metrics (atrium east face, `kit-glass`, 1600×900)

| Region | before luma | after luma | before sat | after sat |
|---|---:|---:|---:|---:|
| sunlit cassette | 0.585 | **0.475** | 0.199 | **0.082** |
| shaded cassette | 0.409 | **0.329** | 0.393 | **0.277** |
| expressed joint 1 | 0.515 | **0.273** | 0.250 | 0.273 |
| expressed joint 2 | 0.378 | **0.288** | 0.421 | 0.278 |
| glazing above the band | 0.275 | 0.275 | 0.491 | 0.491 |
| anodized sill below the band\* | 0.519 | 0.521 | 0.310 | 0.309 |
| south face band (shaded) | 0.375 | 0.351 | 0.410 | 0.382 |

\* the sill region includes the panel/sill boundary, so it moves with the band;
the `aluminium` material itself was not changed.

The glazing and the aluminium frame are unchanged; the panel is now neutral in
sun (saturation 0.08 vs 0.20) and much less cool in shade (0.28 vs 0.39), and it
keeps the three-value hierarchy frame (≈0.52) / panel (0.475 sun, 0.329 shade) /
glazing (0.275). Joints are now distinctly darker than the face (0.273 vs 0.475
in sun, 0.288 vs 0.329 in shade) where the baseline joints were a pale speckled
strip (0.515 / 0.378).

## Permanent close-up (`kit-spandrel-closeup`, 1600×900)

| Region | before luma | after luma | before sat | after sat |
|---|---:|---:|---:|---:|
| cassette face (sunlit) | 0.493 | **0.375** | 0.232 | **0.151** |
| expressed joint between cassettes | 0.464 | **0.262** | 0.230 | 0.281 |
| gasket / dark backing band | 0.212 | 0.212 | 0.404 | 0.404 |
| head rail front | 0.183 | 0.183 | 0.433 | 0.433 |
| glazing above the head rail | 0.198 | 0.198 | 0.444 | 0.444 |

The joint-to-face contrast rises from 5.8 % (0.493 → 0.464) to 30.1 %
(0.375 → 0.262); the gasket, head rail and glazing are pixel-identical (they are
the untouched `dark-metal` and `glass-near`). This shot is part of the
deterministic contract now, not a supporting one-off.

## Far-view seam legibility (`kit-overview`, tower top storey)

Projected band centreline (x 1080–1220, slope −0.3053, ±3 px), detrended profile:

| Metric | before | after |
|---|---:|---:|
| profile std (levels /255) | 6.5 | **9.3** |
| mean dip at the four internal cassette joints (levels /255) | −18.6 | **−38.4** |

The point where two 6 m modules meet was already a dark break in the baseline
(two authored joints coincide there); the refinement doubles the depth of the
internal cassette seams, which is what makes the grid read at this distance.

## Whole-frame before/after difference (1600×900)

| Shot | mean abs /255 | max /255 | changed pixels |
|---|---:|---:|---:|
| `kit-overview` | 0.136 | 162 | 0.504 % |
| `kit-facade` | 0.351 | 160 | 1.408 % |
| `kit-glass` | 0.287 | 163 | 1.029 % |
| `kit-corner` | 0.398 | 162 | 1.404 % |
| `kit-canopy` | 0.236 | 179 | 0.806 % |
| `kit-service` | 0 | 0 | 0 % |
| `kit-player-eyes` | 0.129 | 130 | 0.448 % |
| `kit-distant` | 0.095 | 142 | 0.371 % |
| `kit-bridge` | 0.189 | 151 | 0.716 % |

Whole-frame luma moves by at most **0.0012** (0.12 %) and luma std by at most
0.0009; the facade's overall brightness and contrast are preserved.

Far-city regions on the shared `glass` / `glass-far` roles are pixel-identical
(max channel delta **0** in five regions across `kit-distant`, `kit-overview` and
`kit-bridge`); see `spandrel-metrics.json` → `farCityZeroDiff`.

## Prologue regression

`start-roof` is **byte-identical** before/after:
`59c977dddc4a9c638995015698a372cc1b933807b6edcff8e81b622cbc936ba2`,
210 draw calls / 4,363,071 triangles unchanged
(`prologue-regression.json`).

## Files

- `capture-manifest.json` — full after run, including the determinism verdict.
- `baseline-sha256.json` / `after-sha256.json` — compact hash tables.
- `pixel-diff.json` — whole-frame before/after difference per shot.
- `spandrel-metrics.json` — whole-frame metrics, panel/joint regions, permanent
  close-up regions, close-up and far-view seam metrics, far-city zero-diff
  checks, renderer counters, lifecycle summary, material contract and the
  close-up shot definition.
- `lifecycle.json` — load / reload / restart ×2 / unload probe (118 geometries,
  121 instanced meshes, 270 draw calls, 36 textures, 41 programs; menu returns to
  9 geometries; 0 errors).
- `prologue-regression.json` — Prologue hash and renderer stats.
- `kit-*.jpg` — after review copies of the ten shots.
- `compare-kit-*.jpg` — before | after frames for all ten shots.
- `detail-kit-glass-band.jpg` — atrium east-face band, before | after (5×).
- `detail-kit-glass-band-2x.jpg` — same band from the 3200×1800 pass, before |
  after (2× of the crop).
- `detail-kit-spandrel-closeup.jpg` — permanent close-up, before | after (2×).
- `detail-kit-spandrel-closeup-2x.jpg` — after-only 3200×1800 close-up crop.
- `detail-kit-overview-tower.jpg` — tower storey bands at review distance,
  before | after (4×).
- `detail-kit-player-eyes-band.jpg` — atrium band from the player-eye shot,
  before | after (3×).
- `detail-kit-glass-spandrel-2x.jpg` — after-only 3200×1800 band crop.
- `detail-kit-glass-spandrel-context.jpg` — locator for the 2× crop.

The review report is
[`docs/reports/ARCH_KIT_STEP_2_3C_SPANDREL_REFINEMENT.md`](../../reports/ARCH_KIT_STEP_2_3C_SPANDREL_REFINEMENT.md).
