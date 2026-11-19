# Round 24 visual evidence — balcony detail and living skyline

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `training.jpg` | Training balconies with doors/warm interiors; birds over the city |
| `start.jpg` | Prologue start regression |
| `metrics.json` | Start-frame metrics (13/13) |

Inward balconies now project on the street-facing side, each gets a dark door and
warm interior strip, and a new `CityLife` renders 18 instanced birds on circular
orbits with banking/bob. No route/collision/audio changes; Prologue start remains
**13/13** metrics. `npm run validate` is green with **275 tests in 36 files**,
~60 fps.

```bash
npm run capture -- --mode training --out docs/evidence/visual/round-24/training.png
```
