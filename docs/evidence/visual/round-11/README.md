# Round 11 visual evidence — authored skyline and return barrier

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `turn.jpg` | Authored hero skyline, GLASSLINE billboard, and distant crane |
| `barrier.jpg` | 0.5 m return-catwalk barrier |
| `start.jpg` | Start regression |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

The three turn towers now use `addBuilding` facades/window grids/roof props; the
central tower carries a GLASSLINE billboard. A 0.5 m construction barrier spans
the return catwalk and is jumped in the physical test. Route length, checkpoints,
and triggers are unchanged. `npm run validate` is green with **274 tests in 36
files**; performance is ~60 fps and the start frame stays at 10/13.

```bash
npm run capture -- --out docs/evidence/visual/round-11/turn.png --pos 50,6.1,-126.8
npm run capture -- --out docs/evidence/visual/round-11/barrier.png --pos 40,6.1,-130.8 --yaw 1.5708
```
