# Round 61 visual evidence — procedural material relief

Captured 2026-11-19 from the dev build.

| File | View |
|---|---|
| `start-bump.jpg` | Start frame with triplanar bump enabled (13/13 metrics) |
| `material-closeup.jpg` | Close floor/roof panels showing relief and grime detail |
| `metrics.json` | Start metrics after the material change |

## What changed

- `MaterialLibrary` now derives a **triplanar bump gradient** from the same
  procedural map (no new image assets): dFdx/dFdy height gradients perturb the
  world normal, then convert back to view space.
- Per-material bump strength: concrete 0.20, roof 0.15, asphalt 0.22, metal
  0.06, plaster 0.09, facade 0.10, red 0.05.
- Roughness still varies with the triplanar luma.

Start metrics remain **13/13**; performance ~60.1 fps. This is subtle
micro-relief, not a photorealism overhaul: panel repetition and low-poly silhouettes
remain.
