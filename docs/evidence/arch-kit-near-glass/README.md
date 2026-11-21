# Architectural Kit — Step 2.3A — near glass evidence

Deterministic review evidence for the split between the shared `glass` role and
the new near-facade `glass-near` role.

- **Baseline:** `docs/evidence/arch-kit/` (captured from `f8512c5`; re-captured
  from current `475e2b8` in `captures/step23a-before` with identical 9/9
  sha256 values).
- **After:** `captures/step23a-final2/` (this working tree, no commit).
- **Route:** `?capture=1&level=architecture&shot=<id>`, 1600×900, DPR 1,
  Microsoft Edge 157 headless, display quality `high`.
- **Command:** `npm run capture -- --iteration step23a-final2 --level architecture --shot all --verify-determinism`

## After sha256

| # | Shot | Required | sha256 |
|---|---|---|---|
| 1 | `kit-overview` | yes | `d8a64e071aae84378114d065f89c7ff75693888c4d4ecf56008cca2bfaa771a0` |
| 2 | `kit-facade` | yes | `0f16edf3994e5d60f4d2af843fec3ca04b13f843a6b19527d12904d039d3e6e0` |
| 3 | `kit-glass` | yes | `87ab8642560ef4042251cdb8efa8f108046bd85338605018639ad510f35e8b94` |
| 4 | `kit-corner` | yes | `b74f03c2c8381e92f34f71490ba18e8051ccaa1dc9ca95d2d935e06bd8c304f4` |
| 5 | `kit-canopy` |  | `7f1c6d224c127c7923226ac8f3010b1cc67ce9c4ff14c6f059cf155a1ea24b78` |
| 6 | `kit-service` |  | `800e1c2e857ba937da52a285c6b8643e4d02d9568d4bc896b99529e2042a703b` |
| 7 | `kit-player-eyes` |  | `b343ab85aa53d2ca5f0775d4d83bd44d160c21920f8c0c2b9ad967e07068dbc2` |
| 8 | `kit-distant` |  | `6ed2cb8b05ede3093c28501dd362efe10b24c68ecfdf95159838730c0e4d8131` |
| 9 | `kit-bridge` | yes | `05d17e1b1beff72b61466de2866251ce989eb82f6a9f902ca2772f3fa488bc12` |

Determinism: **9/9 byte-identical** across two fresh Edge instances. All shots
report 270 draw calls / 305,727 triangles / 0 console errors.

Prologue regression: `start-roof` remains
`59c977dddc4a9c638995015698a372cc1b933807b6edcff8e81b622cbc936ba2`
(identical to the archived baseline), 210 draw calls / 4,363,071 triangles.

## Files

- `capture-manifest.json` — full after run, including the determinism verdict.
- `baseline-sha256.json` / `after-sha256.json` — compact hash tables.
- `pixel-diff.json` — whole-frame before/after difference per shot.
- `glass-metrics.json` — pure-pane luma, row gradient, orientation pairs and
  far-city zero-diff checks.
- `prologue-regression.json` — Prologue hash and renderer stats.
- `kit-*.jpg` — after review copies.
- `compare-kit-*.jpg` — before | after frames for all nine shots.
- `detail-kit-facade.jpg`, `detail-kit-corner.jpg`, `detail-kit-glass-atrium.jpg`,
  `detail-kit-glass.jpg` — glass close-ups before | after.

The review report, including the full diff, is
[`docs/reports/ARCH_KIT_STEP_2_3A_NEAR_GLASS.md`](../../reports/ARCH_KIT_STEP_2_3A_NEAR_GLASS.md).
