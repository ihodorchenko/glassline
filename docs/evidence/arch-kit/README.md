# Architectural Kit — review evidence

All frames were captured from the running application through the deterministic
capture boot (`?capture=1&level=architecture`), 1600×900, DPR 1, Microsoft Edge
157 headless, display quality `high`. The PNG originals and their sha256 are in
`capture-manifest.json`; the JPEG files here are review copies of the same frames.

Route: `?capture=1&level=architecture&shot=<id>` (dev builds only). Command:

```bash
npm run capture -- --iteration arch-kit --level architecture --shot all
```

| # | Shot | File | What it shows |
|---|---|---|---|
| 1 | `kit-overview` | [kit-overview.jpg](kit-overview.jpg) | General view of the whole ensemble |
| 2 | `kit-facade` | [kit-facade.jpg](kit-facade.jpg) | Facade bays: punched openings, deep reveal, sill, joint |
| 3 | `kit-glass` | [kit-glass.jpg](kit-glass.jpg) | Glazed atrium, corner expression, cantilever balcony |
| 4 | `kit-corner` | [kit-corner.jpg](kit-corner.jpg) | Expressed corner: pier, glass returns, coping, red reveal |
| 5 | `kit-canopy` | [kit-canopy.jpg](kit-canopy.jpg) | Canopy, tension rods, columns, cantilever above |
| 6 | `kit-service` | [kit-service.jpg](kit-service.jpg) | Technical annex: portal, intake, louvers, rooftop plant |
| 7 | `kit-player-eyes` | [kit-player-eyes.jpg](kit-player-eyes.jpg) | First-person framing from the plaza spawn |
| 8 | `kit-distant` | [kit-distant.jpg](kit-distant.jpg) | Distant silhouette over the podium and lower city |
| 9 | `kit-bridge` | [kit-bridge.jpg](kit-bridge.jpg) | Skybridge: portal frames, glazing, understructure |

## Determinism

`capture-manifest.json` → `determinism`: 9/9 shots captured twice in fresh Edge
instances, **byte-identical** (0 differing pixels, max channel delta 0).

## Lifecycle

`lifecycle.json` is the output of `npm run kit:lifecycle`:

| Step | Scene children | Instanced meshes | Geometries |
|---|---:|---:|---:|
| loaded | 131 | 121 | 118 |
| menu after unload | 10 | 1 | 9 |
| reloaded | 131 | 121 | 118 |
| restart 1 | 131 | 121 | 118 |
| restart 2 | 131 | 121 | 118 |
| menu after final unload | 10 | 1 | 9 |

No page errors, console errors or failed requests during the cycle.

## Prologue regression

`prologue-baseline-manifest.json` (captured before the kit work) and
`prologue-after-manifest.json` (captured after) both report the same
`start-roof` frame:

- sha256 `59c977dddc4a9c638995015698a372cc1b933807b6edcff8e81b622cbc936ba2` (identical);
- 210 draw calls, 4,363,071 triangles, 48 textures, 47 programs.
