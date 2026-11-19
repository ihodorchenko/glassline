# Round 10 visual evidence — catwalk safety, surface audio, turn skyline

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `turn.jpg` | Turn vista with distant hero towers and crane |
| `gap.jpg` | 2.2 m catwalk gap, clear of the support mast |
| `high.jpg` | High roof and finish gate |
| `start.jpg` | Start regression |
| `metrics.json` | Start-frame metrics against the prologue rooftop reference |

The catwalk now has a fall-only high-route respawn anchor (no checkpoint or
speedrun changes) and a `surface_catwalk` metal surface for footsteps/landings.
Route length/vertical range/checkpoint IDs are unchanged. `npm run validate` is
green with **274 tests in 36 files**; performance is ~60 fps and the start frame
stays at 10/13.

```bash
npm run capture -- --out docs/evidence/visual/round-10/turn.png --pos 50,6.1,-126.8
npm run capture -- --out docs/evidence/visual/round-10/gap.png --pos 21,6.1,-122.8 --yaw -1.5708 --pitch -0.08
```
