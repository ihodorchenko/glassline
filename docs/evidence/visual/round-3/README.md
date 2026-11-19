# Round 3 visual evidence — vertical Prologue

Captured 2026-11-19 with `npm run capture` from the dev build.

| File | View |
|---|---|
| `start.jpg` | Prologue start / upper roof |
| `drop.jpg` | North edge, looking down at the service roof |
| `lower.jpg` | Lower service roof, sprint gap, and scaffold stairs |
| `bridge.jpg` | Narrow skybridge toward the finish roof |
| `finish.jpg` | Finish gate, terminal, and sign |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

Commands:

```bash
npm run capture -- --out docs/evidence/visual/round-3/start.png --pos 0,0.93,6
npm run capture -- --out docs/evidence/visual/round-3/lower.png --pos 0,-2.07,-29
npm run capture -- --out docs/evidence/visual/round-3/bridge.png --pos 0,0.03,-46
npm run capture -- --out docs/evidence/visual/round-3/finish.png --pos 0,0.03,-56
npm run metrics -- --candidate docs/evidence/visual/round-3/start.jpg \
  --json docs/evidence/visual/round-3/metrics.json
```

The start frame remains 10/13 image metrics in tolerance; the two open
highlight metrics and open-sky composition are unchanged from Round 1. The
route facts and remaining design gaps are recorded in
[`docs/VISUAL_REFERENCE_PROGRESS.md`](../../../VISUAL_REFERENCE_PROGRESS.md).
