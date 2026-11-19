# Round 18 visual evidence — overhead canyon bridge

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `start.jpg` | Start roof framed by the overhead canyon bridge |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

The 27 m bridge at y=9/z=−6 adds glass rails, supports, light-metal underside
ribs, cool lights, a red fascia, and a hanging hoist. It is visual-only and sits
above the route. Sky share moves from ~57.7% to ~47.5% (reference 43.3%,
tolerance ±12), making the sky metric **PASS** and lifting the start frame from
**10/13 to 11/13**. Only `p95` and `near_white` highlight metrics remain open.

`npm run validate` is green with **275 tests in 36 files**; performance is
~60 fps.

```bash
npm run capture -- --out docs/evidence/visual/round-18/start.png --pos 0,0.93,6
```
