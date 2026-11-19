# Round 21 visual evidence — Training facades and accent balance

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `training.jpg` | Training yard with authored window-grid tower facades |
| `billboard.jpg` | Balanced orange RUN billboard on the catwalk turn |
| `high.jpg` | High roof/helipad after size balance |
| `start.jpg` | Prologue start regression |
| `metrics.json` | Start-frame metrics (13/13) |

Training towers now have inward/south floor slabs, window grids, and vertical
mullions; the Prologue turn billboard is 7.0×2.5 m in lighter orange and the
helipad is 4.4 m. Route, collision, triggers, and audio are unchanged; the
Prologue start frame remains **13/13** reference metrics. `npm run validate` is
green with **275 tests in 36 files**, ~60 fps.

```bash
npm run capture -- --mode training --out docs/evidence/visual/round-21/training.png
npm run capture -- --out docs/evidence/visual/round-21/billboard.png --pos 30,6.1,-122.8 --yaw -1.5708 --pitch 0.04
```
