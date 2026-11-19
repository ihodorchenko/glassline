# Round 17 visual evidence — rooftop amenity pass

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `start.jpg` | Start roof with planters/hedges at both edges |
| `planter.jpg` | Planter/hedge close-up against the west facade |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

New `foliage`/`soil` materials and three concrete planters with clipped hedges
(plus a bench) break up the white start roof. They are visual-only and off the
route line. The start frame remains 10/13 metrics; `npm run validate` is green
with **275 tests in 36 files**, and performance is ~60 fps.

```bash
npm run capture -- --out docs/evidence/visual/round-17/start.png --pos 0,0.93,6
npm run capture -- --out docs/evidence/visual/round-17/planter.png --pos -3,1.3,3.8 --yaw 1.5708 --pitch -0.18
```
