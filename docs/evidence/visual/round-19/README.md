# Round 19 visual evidence — atmosphere and highlight balance

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `start.jpg` | Start roof under the final pale/hazy atmosphere |
| `lower.jpg` | Lower service roof/stairs |
| `catwalk.jpg` | High catwalk |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

The prologue environment now uses a paler sky/haze (`0xa9d3ee`/`0xe8f2fa`, fog
near 45/far 340, cloud cover 0.58, sun 5.8) and the grade is exposure 1.0,
contrast 0.22, saturation 1.30. The start frame reaches **13/13** reference
metrics (luma 0.6126 vs 0.6152; p25 0.3714 vs 0.3710; p95 0.9879 vs 0.9806;
near-white 21.1 vs 34.5; sky 34.5 vs 43.3). `npm run validate` is green with
**275 tests in 36 files**; performance is ~60 fps.

The look is intentionally high-key; some roof/route detail is washed or clipped,
which is recorded as a remaining tradeoff.
