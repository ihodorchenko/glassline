# Round 62 — full Prologue run from spawn

Captured 2026-11-19 with `route-video.mjs` (dev build at 5199).

| File | Content |
|---|---|
| [`full-run.mp4`](full-run.mp4) | 31.95 s / 1280×720 / 30 fps, start → vault → slide tunnel → lower roofs → stairs → skybridge → beam → 8 ascent platforms → FINISH gate |
| [`full-run.wav`](full-run.wav) | Live post-limiter audio, peak −3.25 dBFS |
| [`results-full.png`](results-full.png) | Results screen after completion: **Time 00:32.739** |
| [`poster-finish.png`](poster-finish.png) | FINISH gate at the end of the video |

## Route

Initial spawn `(0, 0.93, 6)`, no `--unlock`, no end teleport.

- vault jump at z≈1.9;
- slide range z −4.2…−10.6 through the service duct;
- lower roof drop + gap jump at z≈−30.8;
- stair/skybridge auto-step;
- finish-deck-to-beam jump at z≈−60.8, beam end jump at z≈−71;
- eight scaffold platforms with jumps at z≈−77.6, −83.2, −88.8, −94.4, −100.0, −105.6, −111.2, −116.8;
- run into the FINISH trigger at z≈−133.

Result: `Time 00:32.739` (Prologue). Video ends on the gate; results are captured separately.

**Caveat:** this is an automated waypoint/held-key run. It is physical (no unlock/teleport), but it is not a human-verified or speedrun-valid record; checkpoint respawns may occur during the run.

## Tooling added

- `--jump-z` thresholds and `--slide-range a,b`;
- jumps injected through `input.heldKeys` (more reliable than CDP key events);
- W/Shift refreshed every loop so checkpoint respawns recover;
- jump thresholds reset on a large z reversal (respawn).
