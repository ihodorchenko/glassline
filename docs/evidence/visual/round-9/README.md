# Round 9 visual evidence — turn vista and catwalk gap

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `gap.jpg` | 2.2 m construction gap in the outbound catwalk, suspended load beyond |
| `turn.jpg` | Open turn vista with distant tower crane |
| `mid.jpg` | Catwalk detail (suspended load, seams, route paint) |
| `start.jpg` | Start regression |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

The outbound catwalk is split at x 23.8…26.0 with a 2.2 m jump; the turn view is
now open skyline with a distant crane. Route length, vertical range, checkpoint
IDs, and trigger layout are unchanged. `npm run validate` is green with **272
tests in 36 files**; performance is ~60 fps and the start frame stays at 10/13.

```bash
npm run capture -- --out docs/evidence/visual/round-9/gap.png --pos 21,6.1,-122.8 --yaw -1.5708 --pitch -0.08
npm run capture -- --out docs/evidence/visual/round-9/turn.png --pos 50,6.1,-126.8
```
