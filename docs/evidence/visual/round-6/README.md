# Round 6 visual evidence — final scaffold ascent

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `beam.jpg` | Narrow beam below the eight-platform jump tower |
| `ascent.jpg` | Mid-ascent platform view toward the high finish roof |
| `top.jpg` | High finish roof, gate, terminal, and dark FINISH billboard |
| `start.jpg` | Start regression |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

The route now runs from the upper roof through the low finish roof, a beam at
`y = −2.0`, eight rising platforms, and a high roof at `y = 5.2`. `cp_finish`
moved onto the beam; the finish trigger moved to the high roof. `npm run
validate` is green with **271 tests in 36 files**.

```bash
npm run capture -- --out docs/evidence/visual/round-6/beam.png --pos 0,-1.07,-66 --pitch 0.1
npm run capture -- --out docs/evidence/visual/round-6/ascent.png --pos 0,2.88,-98 --pitch 0.12
npm run capture -- --out docs/evidence/visual/round-6/top.png --pos 0,6.1,-122
```

Route facts and remaining gaps are in
[`docs/VISUAL_REFERENCE_PROGRESS.md`](../../../VISUAL_REFERENCE_PROGRESS.md).
