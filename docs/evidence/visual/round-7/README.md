# Round 7 visual evidence — high catwalk U-turn

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `mid.jpg` | Outbound catwalk with rails, route paint, and `07 / TURN` |
| `return.jpg` | Return catwalk toward the high gate |
| `finish.jpg` | High finish gate and centred FINISH banner |
| `start.jpg` | Start regression |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

The high roof now exits east onto a 3.2 m catwalk, crosses a 10 m turn platform,
and returns on a parallel span to the finish gate at `z = −133`. The route is
~220 m with 8.2 m vertical range; the five checkpoint IDs and section order are
unchanged. `npm run validate` is green with **272 tests in 36 files**.

```bash
npm run capture -- --out docs/evidence/visual/round-7/mid.png --pos 20,6.1,-122.8 --yaw -1.5708
npm run capture -- --out docs/evidence/visual/round-7/return.png --pos 20,6.1,-130.8 --yaw 1.5708
npm run capture -- --out docs/evidence/visual/round-7/finish.png --pos 0,6.1,-129.5
```

Remaining design gaps are documented in
[`docs/VISUAL_REFERENCE_PROGRESS.md`](../../../VISUAL_REFERENCE_PROGRESS.md).
