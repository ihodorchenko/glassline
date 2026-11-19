# Round 34 visual evidence — procedural stain material

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `start.jpg` | Start roof with five procedural grunge patches |
| `metrics.json` | Start-frame metrics (13/13) |

Added a semantic `stain` material: a transparent procedural canvas with radial
grime blobs, rendered through the triplanar material path and applied to five
floor patches. It replaces the flat translucent boxes from Round 33 with softer,
organic edges. Start remains **13/13**: luma 0.601, p25 0.355, near-white 20.0%,
deep-shadow 3.30%, local contrast 0.269. `npm run validate` is green with **276
tests in 36 files**, ~60 fps.
