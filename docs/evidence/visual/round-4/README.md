# Round 4 visual evidence — reference UI, signage, speed blur

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `menu.jpg` | Paper/ink main menu |
| `settings.jpg` | Settings in the same editorial language |
| `start.jpg` | Start roof with RUN billboard and section signage |
| `sprint.jpg` | 8.5 m/s HUD framing on the skybridge with radial speed blur |
| `finish.jpg` | Finish roof with minimal HUD and crosshair |
| `bridge.jpg` | Skybridge with bridge sign |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

Commands:

```bash
npm run capture -- --menu --out docs/evidence/visual/round-4/menu.png
npm run capture -- --settings --out docs/evidence/visual/round-4/settings.png
npm run capture -- --out docs/evidence/visual/round-4/start.png --pos 0,0.93,6
npm run capture -- --out docs/evidence/visual/round-4/finish.png --pos 0,0.03,-56
npm run metrics -- --candidate docs/evidence/visual/round-4/start.jpg \
  --json docs/evidence/visual/round-4/metrics.json
```

The start frame remains 10/13 image metrics in tolerance; the two open highlight
metrics and open-sky composition are unchanged. The sprint frame was captured
with the debug held-key path at 8.5 m/s so the speed HUD and blur are both
visible. UI, signage, and speed-blur
details are documented in
[`docs/VISUAL_REFERENCE_PROGRESS.md`](../../../VISUAL_REFERENCE_PROGRESS.md).
