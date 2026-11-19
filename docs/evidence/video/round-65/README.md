# Round 65 — clean full Prologue run (0 respawns)

Captured 2026-11-19 from the dev build.

| File | Content |
|---|---|
| [`clean-full-run.mp4`](clean-full-run.mp4) | 23.13 s, initial spawn → FINISH, **0 checkpoint respawns** |
| [`clean-full-run.wav`](clean-full-run.wav) | Live post-limiter audio, peak −3.43 dBFS |
| [`results.png`](results.png) | Results: **Time 00:24.014** |
| [`audio-metrics.json`](audio-metrics.json) | Audio measurements |

## Configuration

- Start `(0, 0.93, 6)`, no `--unlock`, no end teleport.
- `--jump-z` per-jump holds:
  - vault z 1.9:110, lower gap z −30.8:110;
  - finish parapet z −60.8:300;
  - beam→pad0 z −71:**250**;
  - ascent pads z −77.6…−116.8:300.
- Slide range −4.2…−10.6.
- Stuck recovery: if grounded and speed <0.7 for 450 ms, re-press jump.
- JSON summary: `respawns: 0`.

**Caveat:** automated waypoint/held-key run; physical completion, not a
human-driven speedrun. Time 24.014 s is an automation reference, not a human record.
