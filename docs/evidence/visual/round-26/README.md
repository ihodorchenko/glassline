# Round 26 visual evidence — Training floor and reduced-motion menu

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `training.jpg` | MOVEMENT YARD floor mat and red lane chevrons |
| `menu.jpg` | Main menu drift (disabled when reduced motion is on) |
| `start.jpg` | Prologue start regression |
| `metrics.json` | Start-frame metrics (13/13) |

Training now has a 3.2×0.8 m floor mat and four red V-chevron pairs; menu camera
drift scales to zero under the reduced-motion setting while retaining the static
presentation pose. Route/collision/audio are unchanged; Prologue start remains
**13/13** metrics. `npm run validate` is green with **275 tests in 36 files**,
~60 fps.

```bash
npm run capture -- --mode training --out docs/evidence/visual/round-26/training.png
npm run capture -- --menu --out docs/evidence/visual/round-26/menu.png
```
