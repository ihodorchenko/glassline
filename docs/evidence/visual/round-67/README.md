# Round 67 — soft 4K sun shadows

Captured from the dev build.

| File | View |
|---|---|
| `start-soft-shadows.jpg` | Start frame with PCF-soft 4096 sun shadows |
| `metrics.json` | Start metrics |

## What changed

- `PCFShadowMap` → `PCFSoftShadowMap`.
- Sun shadow map 2048 → 4096; normalBias 0.035 → 0.025; radius 2.
- Purpose: remove stair-stepped/hard contact shadows from roof props and
  parapets, closer to the reference's overcast-soft directionality.

Performance remains ~60.4 fps; start metrics **13/13**.
