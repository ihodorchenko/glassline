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

**Caveat:** this is an automated waypoint/held-key run. It is physical (no unlock/teleport), but it is not a human-verified or speedrun-valid record. Instrumented reruns counted **7 checkpoint respawns** with the default 110 ms jump hold; the video is a completion, not yet a clean no-respawn run. Later tuning with per-jump holds/edge resets reached **25.449 s with 1 respawn**; a 0-respawn run is still flaky.

## Tooling added

- `--jump-z` thresholds, `--slide-range a,b`, and configurable `--jump-hold`;
- respawn counter in the JSON summary;
- jumps injected through `input.heldKeys` (more reliable than CDP key events);
- W/Shift refreshed every loop so checkpoint respawns recover;
- jump thresholds reset on a large z reversal (respawn).
