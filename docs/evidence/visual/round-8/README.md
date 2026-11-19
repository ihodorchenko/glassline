# Round 8 visual evidence — finale polish and altitude wind

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `mid.jpg` | Catwalk with suspended construction load, seams, and turn markings |
| `high.jpg` | Dressed high roof, service kit, gate, and centred FINISH banner |
| `finish.jpg` | Finish gate close-up |
| `start.jpg` | Start regression |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

No route, checkpoint, or collider changes this round. Catwalk/high-roof props are
visual-only; the altitude-scaled wind is a code-level ambience mix change.
`npm run validate` is green with **272 tests in 36 files**; performance is
~60 fps and the start frame remains 10/13 metrics.

```bash
npm run capture -- --out docs/evidence/visual/round-8/mid.png --pos 20,6.1,-122.8 --yaw -1.5708
npm run capture -- --out docs/evidence/visual/round-8/high.png --pos 0,6.1,-121.5
```
