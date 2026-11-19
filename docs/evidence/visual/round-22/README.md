# Round 22 visual evidence — Training glass and yard banner

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `training.jpg` | Training yard with blue glass facade windows and the MOVEMENT YARD banner |
| `start.jpg` | Prologue start regression |
| `metrics.json` | Start-frame metrics (13/13) |

Training windows now use `glass`/`glass-far` with warm cells every seventh cell,
tower roofs carry masts/red beacons, and a 7×1.05 m `MOVEMENT YARD` banner hangs
under the overhead pipe. No route/collision/audio changes. The Prologue start
frame remains **13/13** metrics; `npm run validate` is green with **275 tests in
36 files**, ~60 fps.

```bash
npm run capture -- --mode training --out docs/evidence/visual/round-22/training.png
```
