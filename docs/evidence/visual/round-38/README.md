# Round 38 visual evidence — roof panel seams

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `start.jpg` | Start roof with a visible panel-seam grid |
| `metrics.json` | Start-frame metrics (13/13) |

The procedural roof texture's seams changed from 256 px/3 px/0.34 alpha to
96 px/1.4 px/0.62 alpha. Thinner, darker, denser lines make the roof panels
readable without dropping the average exposure. Start remains **13/13**:
luma 0.600, p25 0.353, near-white 19.9%, deep-shadow 3.27%, edge 0.0267.
`npm run validate` is green with **278 tests in 37 files**, ~60 fps.
