# Round 33 visual evidence — worn concrete patches

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `start.jpg` | Start roof with faint worn concrete patches + utility kit |
| `metrics.json` | Start-frame metrics (13/13) |

Five semi-transparent gray concrete patches (16% → 28% opacity after tuning) add
mottling to the foreground roof without darkening the scene beyond tolerance.
Start frame remains **13/13**: luma 0.598, p25 0.352, near-white 19.2%, deep
shadow 3.48% (2.80 delta). `npm run validate` is green with **276 tests in 36
files**, ~60 fps.
