# Round 12 visual evidence — mid-ascent safety pad

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `safe-pad.jpg` | Safe-retry pad on scaffold platform 5, looking up the jump chain |
| `start.jpg` | Start regression |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

A fall from platform 5 or the high/scaffold route now respawns at platform 5
(0, 2.875, -98.7) instead of the beam; the high-roof anchor still takes
precedence on the catwalk. No checkpoint IDs, triggers, or speedrun splits
changed. `npm run validate` is green with **274 tests in 36 files**; the start
frame remains 10/13.

```bash
npm run capture -- --out docs/evidence/visual/round-12/safe-pad.png --pos 0,2.875,-97.3 --pitch -0.06
```
