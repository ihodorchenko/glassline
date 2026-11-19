# Round 25 visual evidence — ambient motion

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `menu.jpg` | Main menu with slow presentation-camera drift, birds, and swinging hoist |
| `start.jpg` | Start canyon with animated suspended hoist under the bridge |
| `metrics.json` | Start-frame metrics (13/13) |

The presentation camera now drifts on slow sinusoids while outside gameplay, and
`CityLife` owns a swinging hoist pendulum under the overhead bridge (cable, red
load, dark cap). Route/collision/audio are unchanged; the Prologue start remains
**13/13** metrics. `npm run validate` is green with **275 tests in 36 files**,
~60 fps.

```bash
npm run capture -- --menu --out docs/evidence/visual/round-25/menu.png
npm run capture -- --out docs/evidence/visual/round-25/start.png --pos 0,0.93,6
```
