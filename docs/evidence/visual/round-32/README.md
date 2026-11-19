# Round 32 visual evidence — foreground roof utility

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `start.jpg` | Start roof with drain grates, access hatch, and conduit |
| `metrics.json` | Start-frame metrics (13/13) |

Three metal drain grates, a roof access hatch with red handle, and an east-edge
conduit break up the high-key foreground without adding route colliders. The
start frame remains **13/13** metrics (luma 0.606, near-white 20.6%, deep shadow
3.26%). `npm run validate` is green with **276 tests in 36 files**, ~60 fps.
