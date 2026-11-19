# Round 14 visual evidence — turn billboard and high-roof helipad

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `billboard.jpg` | Outbound catwalk approach with the close RUN billboard |
| `high.jpg` | High roof with helipad, gate, and service kit |
| `start.jpg` | Start regression |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

The turn now has a steel-framed RUN billboard on its outer rail, and the high
roof has a decorative helipad/H marking with cool edge lights. Both are
visual-only: route length, checkpoints, triggers, colliders, and speedrun splits
are unchanged. `npm run validate` is green with **275 tests in 36 files**;
performance is ~60 fps and the start frame remains 10/13.

```bash
npm run capture -- --out docs/evidence/visual/round-14/billboard.png --pos 30,6.1,-122.8 --yaw -1.5708 --pitch 0.04
npm run capture -- --out docs/evidence/visual/round-14/high.png --pos 0,6.1,-119.8 --pitch -0.08
```
