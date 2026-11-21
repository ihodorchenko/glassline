# Architectural Kit — Step 2.3B — spandrel zone evidence

Deterministic review evidence for the opaque curtain-wall spandrel zone
(`spandrel: true`), its material role and its framing.

- **Baseline:** `captures/step23b-before` — freshly captured from the base commit
  `4a502bd` (clean tree); 9/9 hashes match the archived Step 2.3A run
  `captures/step23a-final2` exactly.
- **After:** `captures/step23b-final` — branch `feat/arch-spandrel`.
- **Route:** `?capture=1&level=architecture&shot=<id>`, 1600×900, DPR 1,
  Microsoft Edge 157 headless, display quality `high`.
- **Command:** `npm run capture -- --iteration step23b-final --level architecture --shot all`
  (the suggested `--iteration arch-spandrel` run reproduced the same 9/9 hashes)
- **Detail pass:** `npm run capture -- --iteration step23b-detail --level architecture --shot kit-glass --width 3200 --height 1800`
  (same route and scene at 2× viewport, supporting evidence only).

## After sha256

| # | Shot | sha256 | draw calls | triangles |
|---|---|---|---:|---:|
| 1 | `kit-overview` | `b6a68439d8dea8044709b178f5a0bd003e6b967db51ea8aef0dc99d377d2e0f1` | 270 | 308,463 |
| 2 | `kit-facade` | `99a2f9e5a3f17cbbc93529d74ee9e5b6422096d7f977ec3f2065f6fa4948ebfb` | 270 | 308,463 |
| 3 | `kit-glass` | `2a9615230fb0948dfdda99f368498a560f2ae4e0cc42825177b19f9fcabd7753` | 270 | 308,463 |
| 4 | `kit-corner` | `b24726a7a26a03751bb692e79b9f11688a5ddb9c67ee5acc0165e212b47c96b7` | 270 | 308,463 |
| 5 | `kit-canopy` | `dd65a57a985f1ad5e1cc7b1704117a829bed1a3d4a89e31f9916d64c91e60e3f` | 270 | 308,463 |
| 6 | `kit-service` | `800e1c2e857ba937da52a285c6b8643e4d02d9568d4bc896b99529e2042a703b` | 270 | 308,463 |
| 7 | `kit-player-eyes` | `6cb011a67c2be31284ad3f3acea584939c21400dc6b10c7c3a9623f149b78092` | 270 | 308,463 |
| 8 | `kit-distant` | `c270bc3792b2d945ff60d83d745da29ce25753ae9df6780344f1cbb889a59712` | 270 | 308,463 |
| 9 | `kit-bridge` | `394a691e4e6863ce4501a660c807fcd0d6e6fe14c1d07fdfa42cedeaf82c6f82` | 270 | 308,463 |

Determinism: **9/9 byte-identical** across two fresh Edge instances; 0 console
and 0 page errors on every shot. Draw calls are unchanged (270); triangles rise
from 305,727 to **308,463** (+2,736, +0.9 %) because of the framed spandrel field.

Prologue regression: `start-roof` remains
`59c977dddc4a9c638995015698a372cc1b933807b6edcff8e81b622cbc936ba2`
(byte-identical to the baseline), 210 draw calls / 4,363,071 triangles.

`kit-service` is byte-identical to the baseline: that frame contains no curtain
wall, so the change is scoped to the spandrel modules.

## Spandrel metrics (shaded atrium face, 1600×900)

| Region | before luma | after luma |
|---|---:|---:|
| atrium band, sunlit panel | 0.7871 | 0.4037 |
| atrium band, shaded panel | 0.7192 | 0.4027 |
| glazing above sunlit panel | 0.2716 | 0.2716 (unchanged) |
| glazing above shaded panel | 0.3337 | 0.3337 (unchanged) |
| anodized sill below band | 0.7354 | 0.6323* |
| tower band, sunlit (overview) | 0.7891 | 0.6284* |

\* the region includes the panel/rail boundary, so it moves with the band; the
aluminium material itself was not changed.

Before/after whole-frame difference (mean abs /255, max /255, changed pixels):

| Shot | mean | max | changed |
|---|---:|---:|---:|
| `kit-overview` | 0.48 | 209 | 0.649 % |
| `kit-facade` | 1.683 | 207 | 2.004 % |
| `kit-glass` | 1.03 | 210 | 1.337 % |
| `kit-corner` | 1.431 | 210 | 1.835 % |
| `kit-canopy` | 0.91 | 208 | 1.123 % |
| `kit-service` | 0.0 | 0 | 0.0 % |
| `kit-player-eyes` | 0.405 | 209 | 0.552 % |
| `kit-distant` | 0.339 | 209 | 0.459 % |
| `kit-bridge` | 0.745 | 210 | 0.957 % |

Far-city regions on shared `glass`/`glass-far` are pixel-identical (max channel
delta 0) in `kit-distant`, `kit-overview` and `kit-bridge`; see
`spandrel-metrics.json` → `farCityZeroDiff`.

## Files

- `capture-manifest.json` — full after run, including the determinism verdict.
- `baseline-sha256.json` / `after-sha256.json` — compact hash tables.
- `pixel-diff.json` — whole-frame before/after difference per shot.
- `spandrel-metrics.json` — band/glazing/frame luma, saturation, far-city
  zero-diff checks and the material contract summary.
- `lifecycle.json` — load / reload / restart ×2 / unload resource-count probe
  (118 geometries, 121 instanced meshes, 270 draw calls; 37 textures vs 36 before,
  because the new role owns one generated facade map).
- `prologue-regression.json` — Prologue hash and renderer stats.
- `kit-*.jpg` — after review copies of the nine shots.
- `compare-kit-*.jpg` — before | after frames for all nine shots.
- `detail-kit-glass-spandrel-band.jpg` — atrium spandrel band, before | after (5×).
- `detail-kit-glass-spandrel-framing.jpg` — framing/rail detail, before | after (5×).
- `detail-kit-overview-tower.jpg` — tower storey bands, before | after (3×).
- `detail-kit-glass-spandrel-2x.jpg` — after-only 2× viewport crop.
- `detail-kit-glass-spandrel-context.jpg` — locator crop for the 2× image.

The review report is
[`docs/reports/ARCH_KIT_STEP_2_3B_SPANDREL.md`](../../reports/ARCH_KIT_STEP_2_3B_SPANDREL.md).
