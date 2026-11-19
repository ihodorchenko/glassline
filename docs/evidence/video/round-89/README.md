# Round 89 — reproducible clean full run

| File | Content |
|---|---|
| `clean-full-run.mp4` | 22.57 s, spawn → FINISH, **0 respawns** |
| `clean-full-run.wav` | Live post-limiter audio |
| `results.png` | Results **00:23.123** |
| `audio-metrics.json` | Audio measurements |

`route-video.mjs --in-page` runs the waypoint/jump autopilot inside the page on
`requestAnimationFrame` instead of CDP polling. Four consecutive runs reached
Results with **0 respawns** (21.83, 21.83, 22.57, 23.12 s).

This supersedes the Round 82 reproducibility failure for the automated bot. It
is still an automated run, not a human speedrun.
