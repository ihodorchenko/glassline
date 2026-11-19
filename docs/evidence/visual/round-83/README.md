# Round 83 — 16× texture anisotropy

| File | View |
|---|---|
| `start.jpg` | Start frame |
| `graze-anisotropy.jpg` | Floor at a grazing angle |
| `metrics.json` | Start metrics |

Procedural material textures now use 16× anisotropic filtering instead of 8×.
Roof panels and seams stay sharper at grazing angles without extra draw calls.
Start **13/13**, 60.3 fps, 282 tests.
