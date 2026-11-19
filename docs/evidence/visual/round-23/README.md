# Round 23 visual evidence — Training facade depth

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `training.jpg` | Training towers with projecting balcony bands and glass rails |
| `start.jpg` | Prologue start regression |
| `metrics.json` | Start-frame metrics (13/13) |

Every third floor of each Training tower now has a projecting concrete balcony
band and 0.9 m glass rail on both inward and south faces, adding depth and
shadow breakup. Route, collision, triggers, and audio are unchanged; Prologue
start remains **13/13** metrics. `npm run validate` is green with **275 tests in
36 files**, ~60 fps.

```bash
npm run capture -- --mode training --out docs/evidence/visual/round-23/training.png
```
