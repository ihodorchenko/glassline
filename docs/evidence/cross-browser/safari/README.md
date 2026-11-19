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
| `full-run-results.png` | Full Prologue results: **00:33.542**, **0 respawns** |
| `full-run-report.json` | Autopilot state, flow `results`, no console errors |

The full run used the same waypoint/jump thresholds as the Chromium clean run.
Safari completed with 0 respawns but slower wall-clock time (33.5 s vs 24.0 s),
which reflects Safari/WebGL timing, not a different route.

The earlier Playwright WebKit `rawcolliderset_createCollider` trap did **not**
occur in real Safari; it is classified as a headless-Playwright artifact.

Safari start frame also passes **13/13** reference metrics after resizing to
1280×720 (Safari's captured viewport aspect differs). The rAF FPS probe is not
representative: safaridriver throttled animation frames even with Safari
frontmost, so no Safari GPU fps claim is made.
