# Reference capture and metrics

Local-only tooling for comparing Glassline frames with the original *Mirror's
Edge* prologue reference. The reference video and extracted frames live in
`ref/`, which is intentionally git-ignored.

## 1. Capture

`tools/capture/capture.mjs` is a Playwright harness: it owns the dev server and
the browser, so there is nothing to start by hand.

```bash
# Full deterministic Prologue evidence set (6 shots, plus a second pass that
# proves byte-level determinism).
node tools/capture/capture.mjs --iteration w0 --shot all
# or: npm run capture -- --iteration w0 --shot all

# One shot, no determinism re-run.
node tools/capture/capture.mjs --iteration w0 --shot start-roof --no-verify-determinism

# Assert determinism explicitly for a subset (default for --shot all).
node tools/capture/capture.mjs --iteration w0 --shot all --verify-determinism
```

What a run does:

1. If nothing answers on `http://127.0.0.1:5199/`, spawns
   `node_modules/.bin/vite --port 5199 --strictPort --host 127.0.0.1` and waits
   for HTTP 200. If a dev server is already listening (another terminal, another
   agent) it attaches to it instead. The spawned child is always terminated,
   including on failures and on `SIGINT`/`SIGTERM`.
2. Launches Microsoft Edge through Playwright:
   `chromium.launch({ channel: "msedge", headless: true })`. No browser download,
   no `--no-sandbox`, no remote-debugging port. Playwright and system Edge are
   expected to be installed already.
3. Opens `http://127.0.0.1:5199/?capture=1&level=prologue&shot=<id>` (query
   preserved if `--url` already carries parameters) and waits for
   `window.__glasslineCapture.ready === true`. Missing contract is a hard error
   with the page state, console errors and page exceptions printed.
4. For every shot: fresh browser context → navigate → `apply(id)` → wait
   `--frames` requestAnimationFrame ticks → read `stats()` → take a PNG.
5. Writes `captures/<iteration>/<id>.png` (1600x900, dpr 1) and
   `captures/<iteration>/manifest.json` with sha256, PNG size and renderer
   stats per shot, then prints a table.
6. For `--shot all` (unless `--no-verify-determinism`): captures every shot a
   second time in a fresh context and compares sha256. A mismatch exits 1 and
   keeps the second-pass frames under `captures/<iteration>/.determinism/` for
   diagnosis. Identical runs delete that folder.

### Flags

| Flag | Meaning |
|---|---|
| `--iteration <id>` | Evidence folder under `captures/` (default `w0`) |
| `--shot <id\|all>` | Shot id from `window.__glasslineCapture.shots`, or `all` (default) |
| `--level <id>` | Level query parameter (default `prologue`) |
| `--frames <n>` | Extra rAF frames after `apply()` (default `30`) |
| `--verify-determinism` / `--no-verify-determinism` | Force / suppress the second pass (on by default for `--shot all`) |
| `--json <path>` | Also write the machine-readable report there |
| `--server-port <port>` | Vite port, alias `--port` (default `5199`) |
| `--url <url>` | Base URL / attach target (default `http://127.0.0.1:<server-port>/`) |
| `--reuse-server` | Never spawn Vite; fail unless `--url` is already served |
| `--headless` / `--headed` | Edge window visibility (default headless) |
| `--width` / `--height` | Viewport (default `1600x900`; the evidence contract is 1600x900) |
| `--ready-timeout <ms>` | Budget for `__glasslineCapture.ready` (default `60000`) |
| `--server-timeout <ms>` | Budget for Vite readiness (default `90000`) |
| `--strict-console` | Treat console errors as failures (page exceptions are always fatal) |

### Legacy one-off frames

Passing `--out <file>` switches to the legacy path: no capture contract, the
script drives the dev handle (`window.__glassline`) directly, starts gameplay,
teleports/aims the camera and saves **one** PNG frame to exactly that path, then
exits. `--shot`, `--iteration` and determinism checks do not apply.

```bash
node tools/capture/capture.mjs --out /tmp/prologue-start.png \
  --mode prologue --pos 0,0.93,6 --yaw 0 --pitch 0 --wait 1500
```

Legacy flags kept from the old CDP script: `--mode`, `--pos x,y,z`, `--yaw`,
`--pitch`, `--wait`, `--menu`, `--settings`, `--run <ms>`, `--width`,
`--height`, `--close`. `--close` is accepted for compatibility only: the
browser is always closed because Playwright owns it. Output is always PNG,
whatever the file extension says.

Useful viewpoints for the prologue (legacy path):

| View | Position | Yaw | Pitch |
|---|---|---|---|
| Start | `0,0.93,6` | `0` | `0` |
| Wall-run corridor | `0,0.93,-10` | `0` | `0` |
| Looking back | `0,0.93,-10` | `3.14159` | `0` |
| Skylight edge | `4,0.93,0` | `-1.2` | `-0.3` |

The legacy path prints the scene statistics (instances, triangles, textures,
programs, canvas size) plus the PNG sha256. Legacy frames are useful for quick
look checks but are **not** deterministic evidence: time-driven animation is
still running, so use capture mode for anything that must be reproduced.

## 2. Metrics

```bash
npm run metrics -- \
  --candidate docs/evidence/visual/round-1/start.jpg \
  --json docs/evidence/visual/round-1/metrics.json
```

Requires Python 3 with `numpy` and `Pillow`. The default reference set is
`ref/reference/prolog-kit/study/05-prologue-roofs` (20 frames).

The script measures luminance distribution, near-white/deep-shadow coverage,
saturation, local contrast, edge energy, sky area, split-tone bias, and red
accent coverage. It compares the candidate against the reference mean and prints
`PASS`/`WATCH` per metric. Tolerances are wide where the reference frames
themselves vary; treat the report as a regression gauge, not a perceptual
equivalence claim.

## 3. Evidence

Capture evidence is written to `captures/<iteration>/` (git-ignored):

```
captures/w0/
  start-roof.png        # 1600x900 PNG
  first-gap.png
  ...
  manifest.json         # iteration, generatedAt, viewport, url, browser,
                        # shots[{id, file, sha256, png, stats}], determinism
```

Determinism rule: two independent runs of `--shot all` must produce identical
sha256 per frame. The capture mode pins world time, the camera pose and the
GPU-side noise tables (the GTAO noise permutation in `CaptureMode.ts` is seeded
from a fixed PRNG), so a mismatch means a new time- or random-driven source was
introduced. If they do not, the capture mode is not frozen enough
(time-driven animation, random seeds, camera drift); the harness reports the
per-frame hashes and exits 1 rather than post-processing the frames.

Published round evidence stays under `docs/evidence/visual/<round>/` as
compressed JPEGs plus a JSON report; reference frames themselves are not
committed.

## 4. Audio

The audio pipeline is procedural, so it can be rendered offline and measured
without listening.

Render a deterministic 24 s demo (ambience, surface footsteps, parkour,
score) through an `OfflineAudioContext` in the running dev build:

```bash
npm run audio:render -- --out docs/evidence/audio/round-2/mix.wav --seconds 24
npm run audio:metrics -- --wav docs/evidence/audio/round-2/mix.wav \
  --json docs/evidence/audio/round-2/metrics.json

# High-route finale profile: altitude wind, metal catwalk steps, landings, finish hit.
npm run audio:render -- --high-route --seconds 14 \
  --out docs/evidence/audio/round-15/high-route.wav
```

`audio:metrics` computes spectral band shares, BS.1770-style gated loudness,
sample peak, and short-term p5/p95 range. Run it on
`ref/reference/prolog-kit/audio/audio.wav` (or a segment) to re-derive the
reference profile with the identical script.

Probe the live master output through an `AnalyserNode` after a trusted click:

```bash
npm run audio:probe -- --json docs/evidence/audio/round-2/live-probe.json

# Record an actual in-engine WAV (surface/cadence selectable).
npm run audio:probe -- --record docs/evidence/audio/round-29/high-10s.wav \
  --seconds 10 --cadence 650 --at high \
  --json docs/evidence/audio/round-29/high-10s.json
npm run audio:probe -- --record docs/evidence/audio/round-29/ground-8s.wav \
  --seconds 8 --cadence 650 --at ground \
  --json docs/evidence/audio/round-29/ground-8s.json
```

The probe triggers a deterministic footstep/landing sequence, then reports
post-limiter RMS, peak, and band shares plus the debug bus/ambience/music state.

- `safari-smoke.mjs` — real Safari via `safaridriver --mcp` (requires Allow Remote Automation).
