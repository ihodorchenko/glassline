# Round 27 visual evidence — painted floor and reduced-motion ambience

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `training.jpg` | Floor-toned MOVEMENT YARD mat and lane chevrons |
| `start.jpg` | Prologue start regression |
| `metrics.json` | Start-frame metrics (13/13) |

The Training floor mat now uses a floor-toned base with dark ink and red accent,
reading as painted lane lettering instead of a black sticker. `CityLife` freezes
birds/hoist and `RenderScene` stops cloud/sky update when reduced motion is on;
menu drift already scales to zero. No route/collision/audio changes; Prologue
start remains **13/13** metrics. `npm run validate` is green with **275 tests in
36 files**, ~60 fps.

```bash
npm run capture -- --mode training --out docs/evidence/visual/round-27/training.png
```
