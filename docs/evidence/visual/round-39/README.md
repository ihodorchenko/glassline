# Round 39 visual evidence — panel variation + landing camera

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `start.jpg` | Start roof with per-panel tint variation and seam grid |
| `metrics.json` | Start-frame metrics (13/13) |

The roof texture now tints each 96 px panel with a low-alpha warm/cool wash, in
addition to the seam grid. CameraSystem also adds a brief landing lift/roll
(±8 mm / ±0.012 rad) driven by `landingIntensity`, disabled by reduced motion.
Start remains **13/13**: luma 0.600, p25 0.353, near-white 19.9%, deep-shadow
3.28%, local contrast 0.268. `npm run validate` is green with **278 tests in 37
files**, ~60 fps.
