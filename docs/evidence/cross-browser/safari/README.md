# Real Safari evidence

Safari **27.2**, macOS **27.2.1**, real browser via `safaridriver --mcp`
(not Playwright WebKit).

| File | Content |
|---|---|
| `production-menu.png` | Production menu |
| `production-training.png` | Training running |
| `production-report.json` | Production smoke report, **0 console errors** |
| `prologue-gameplay.png` | Prologue after entering gameplay |
| `start.png` / `start-1280.jpg` | Safari start frame |
| `start-metrics.json` | Safari start: **13/13** metrics |
| `fps-probe.json` | rAF probe caveat (remote automation throttling) |
| `prologue-report.json` | Prologue state + **5.85 m movement** probe |
| `full-run-results.png` | Earlier full Prologue results: **00:33.542**, 0 respawns |
| `full-run-results-final.png` | Final visual pass: **00:27.037**, **0 respawns** |
| `full-run-report-final.json` | Final Safari state/flow report, 0 console errors |
| `full-run-report.json` | Autopilot state, flow `results`, no console errors |
| `prologue-audio.png` / `audio-report.json` | Safari audio context **running**, 44.1 kHz, 6.33 m movement |

The full run used the same waypoint/jump thresholds as the Chromium clean run.
Final visual-pass rerun: **0 respawns, Results 00:27.037**, 0 console errors.
Safari wall-clock varies between runs (33.5 s earlier, 27.0 s final) due
automation/window timing;
which reflects Safari/WebGL timing, not a different route.

The earlier Playwright WebKit `rawcolliderset_createCollider` trap did **not**
occur in real Safari; it is classified as a headless-Playwright artifact.

Safari Web Audio context is `running` at 44.1 kHz with ~2.9 ms base latency;
movement probe covered 6.33 m. This is technical audio verification, not a
human listening verdict. Safari start frame also passes **13/13** reference metrics after resizing to
1280×720 (Safari's captured viewport aspect differs). The rAF FPS probe is not
representative: safaridriver throttled animation frames even with Safari
frontmost, so no Safari GPU fps claim is made.
