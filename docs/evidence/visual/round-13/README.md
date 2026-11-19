# Round 13 visual evidence — return-catwalk bypass

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `choice.jpg` | Return barrier and the lower bypass opening |
| `bypass.jpg` | Bypass deck looking back toward the catwalk |
| `start.jpg` | Start regression |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

The return catwalk now offers a direct 0.5 m barrier jump or a lower 4.8 m bypass
with two 0.2 m step ledges back to 5.2 m. Route length, checkpoints, and triggers
are unchanged. `npm run validate` is green with **275 tests in 36 files**;
performance is ~60 fps and the start frame stays at 10/13.

```bash
npm run capture -- --out docs/evidence/visual/round-13/choice.png --pos 40,6.1,-130.8 --yaw 1.5708 --pitch -0.12
npm run capture -- --out docs/evidence/visual/round-13/bypass.png --pos 34,5.675,-135.0 --yaw 3.1416
```
