# Display quality

`display.quality` now actually drives the renderer (previously it was a dead
setting).

| Mode | Shadows | GTAO | Bloom | DPR cap |
|---|---|:---:|:---:|---:|
| low | off | off | off | 1.0 |
| medium | on | on | on | 1.5 |
| high | on | on | on | 2.0 |

- `Renderer.setQuality()` applies the mode live and resizes the drawing buffer.
- `DisplaySettingsAdapter` registers in the settings pipeline; initial/default
  mode is **medium**.
- Low is the fallback for weak GPUs/Safari; high restores full DPR on Retina.
- Tests: `display-settings-adapter.test.ts` covers mapping and invalid fallback.

The quality selector is already present in the Settings UI (`display.quality`).
