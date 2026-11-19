# Round 5 visual evidence — menu city vignette

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `menu.jpg` | Paper/ink main menu over the visual-only Prologue city vignette |

The vignette is a `MenuBackdrop` group owned by `RenderScene`: roof deck,
parapets, glass tower, RUN billboards, window grids, and layered skyline. It has
no colliders or level runtime and is hidden for gameplay/pause. The gameplay
start frame remains unchanged and at 10/13 metrics (see
[`round-4/metrics.json`](../round-4/metrics.json)).

```bash
npm run capture -- --menu --out docs/evidence/visual/round-5/menu.png
```
