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
   `--frames` requestAnimationFrame ticks → read `stats()` → take a PNG. The
   Vite HMR websocket is mocked for the page, so a concurrent `src/` edit cannot
   full-reload a shot mid-capture; every shot still boots from the current
   on-disk tree over HTTP. Contract calls, screenshots and browser teardown are
   bounded by timeouts, so a wedged renderer fails with a diagnostic instead of
   hanging the run.
5. Writes `captures/<iteration>/<id>.png` (1600x900, dpr 1) and
   `captures/<iteration>/manifest.json` with sha256, PNG size and renderer
   stats per shot, then prints a table.
6. For `--shot all` (unless `--no-verify-determinism`): captures every shot a
   second time in a **fresh Edge instance**, then applies the determinism rule
   from §3 — byte-identical sha256 first, and a pixel-level tolerance check only
   when the hashes differ. A failure exits 1 and keeps the second-pass frames
   under `captures/<iteration>/.determinism/` for diagnosis; a passing run
   deletes that folder.

### Flags

| Flag | Meaning |
|---|---|
| `--iteration <id>` | Evidence folder under `captures/` (default `w0`) |
| `--shot <id\|all>` | Shot id from `window.__glasslineCapture.shots`, or `all` (default) |
| `--level <id>` | Level query parameter (default `prologue`) |
| `--frames <n>` | Extra rAF frames after `apply()` (default `30`) |
| `--verify-determinism` / `--no-verify-determinism` | Force / suppress the second pass (on by default for `--shot all`) |
| `--determinism-tolerance <n>` | Max channel delta accepted when the two PNG hashes differ (default `1`; `0` = require byte identity) |
| `--determinism-max-share <f>` | Max share of differing pixels accepted when the hashes differ (default `0.0001`, i.e. 144 px at 1600x900) |
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

### Determinism rule (D-13)

The check runs each shot twice in two independent Edge instances. There are
three outcomes, and the manifest records which one happened:

| Outcome | Meaning | `manifest.determinism` |
|---|---|---|
| `BYTE` | Preferred. The two PNGs are byte-identical, so sha256 matches. | `byteIdentical: true`, `passed: true`, `differingPixels: 0`, `maxChannelDelta: 0` |
| `PASS` | The hashes differ only because of GPU LSB jitter: every channel differs by at most `--determinism-tolerance` (default `1`/255) and at most `--determinism-max-share` (default `0.0001` = 144 px at 1600x900) pixels differ. | `byteIdentical: false`, `passed: true`, plus the measured `differingPixels`, `differingShare`, `maxChannelDelta`, bounding box and sample coordinates |
| `FAIL` | Either the channel delta or the differing share exceeds the rule, or the pixel comparison could not run. Exit code 1; the second-pass frames are kept under `captures/<iteration>/.determinism/`. | `passed: false` and a `reason` per offending shot |

The rule exists because a hard MSAA-resolved raster edge can flip its last
rendering bit between browser instances (`finish-roof`, 1 px at `683,396`,
±1/255 in W1 evidence). The two variants swap between runs and reproduce
deterministically inside a run; it is the same class of GPU-state LSB jitter as
the W0 GTAO noise issue (which was fixed by seeding the noise PRNG), not a look
or scene regression. Byte-identical remains the target: `PASS` only tolerates
the residue that the GPU will not pin, and reports it instead of hiding it.
`--determinism-tolerance 0` disables the pixel tolerance entirely and turns any
hash mismatch into a failure, which is how a stricter gate is run.

Pixel decoding uses Python 3 with `numpy` + `Pillow`, and only runs when the
hashes differ (byte-identical runs never spawn Python). The interpreter lookup
is: `$GLASSLINE_PYTHON`, then the bundled DSH runtime interpreter
`/Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3`,
then `/usr/bin/python3`, then `python3` from `PATH`. If none can import
numpy/Pillow, the harness fails the determinism check with an explicit message —
it does not silently accept a difference. No npm dependency is required.

Read the result from `captures/<iteration>/manifest.json`:

```json
"determinism": {
  "verified": true,
  "passed": true,
  "byteIdentical": false,
  "byteMatches": 5,
  "passedShots": 6,
  "total": 6,
  "tolerance": 1,
  "maxShare": 0.0001,
  "maxAllowedPixels": 144,
  "differingPixels": 1,
  "maxChannelDelta": 1,
  "keptSecondPassDir": null,
  "shots": [
    { "id": "finish-roof", "byteIdentical": false, "passed": true,
      "differingPixels": 1, "differingShare": 0.0000694, "maxChannelDelta": 1,
      "boundingBox": [683, 396, 683, 396],
      "samples": [{ "x": 683, "y": 396, "run1": [..], "run2": [..], "maxChannelDelta": 1 }] }
  ]
}
```

`passed` is the exit-code gate; `byteIdentical` and `byteMatches` report how much
of the run was byte-exact, so a regression from `BYTE` to `PASS` is visible
without being treated as a failure.

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

## 5. Performance probe

`tools/capture/perf.mjs` measures sustained frame rate on the same six authored
capture poses that `capture.mjs` photographs, using the same plumbing: it owns
(or attaches to) a Vite server, launches Microsoft Edge through Playwright, opens
`?capture=1&level=prologue&shot=<id>`, waits for `__glasslineCapture.ready`, then
measures `requestAnimationFrame` timestamps in-page instead of writing a PNG.

```bash
# All six poses into captures/perf-baseline-perf/<shot>.json + stdout table.
node tools/capture/perf.mjs --shot all --iteration baseline-perf --json /tmp/perf-baseline.json

# One pose, and arm the threshold as a gate (exit 1 when avg fps < --min-fps).
node tools/capture/perf.mjs --shot start-roof --iteration gate --strict

# Real window instead of headless (numbers are more representative, far louder).
node tools/capture/perf.mjs --shot all --iteration headed --headed
```

What a run does, per shot: fresh browser context → boot the capture page → apply
the pose → discard `--warmup` rAF frames (default 120) → record the timestamps of
`--frames` consecutive rAF callbacks (default 300) → read
`__glasslineCapture.stats()` (draw calls, triangles, textures, programs, quality,
canvas) → write the JSON and continue. Query parameters preserve `--url`
parameters, the viewport is 1600x900 at deviceScaleFactor 1, and the capture mode
pins `high` quality.

Measured values (all derived in Node from the raw in-page frame-time array):

| Value | Meaning |
|---|---|
| `avg fps` | `1000 / mean(frame time)` — the number the ≥55 fps exit criterion uses |
| `median fps` | `1000 / median(frame time)` — steady-state pacing |
| `1% low` | `1000 / p99(frame time)` — frame rate of the slowest 1 % of frames |
| `p95 frame time` | 95th percentile frame time in ms (a 33.4 ms value = one skipped 60 Hz vsync) |

Each `captures/perf-<iteration>/<id>.json` keeps the raw `frameTimesMs` array
(default 300 numbers), the derived metrics, renderer stats, browser/UA/GPU
strings (`ANGLE (Apple, … Metal Renderer…)` or a SwiftShader line, whichever is
active), `environment: "headless-edge" | "headed-edge"`, host CPU count and load
averages, console/page errors, and the threshold verdict. `--json <path>` writes
one run-level summary with the same numbers for all shots.

Flags: `--shot <id|all>`, `--iteration <id>` (folder `captures/perf-<id>/`,
default `perf`), `--level <id>` (default `prologue`), `--frames <n>` (default
300), `--warmup <n>` (default 120), `--min-fps <n>` (default 55), `--strict`
(exit 1 if any shot is below `--min-fps`; otherwise the run is report-only and
exits 0), `--json <path>`, `--server-port <port>` (default **5310**, so it does
not collide with `capture.mjs` on 5199), `--url`, `--reuse-server`,
`--headless`/`--headed`, `--width`/`--height`, `--ready-timeout`,
`--server-timeout`. Usage errors exit 2.

Caveats — read these before quoting a number:

- **Headless Edge on macOS is a proxy, not a real window.** rAF is paced by the
  headless compositor, so `avg fps` saturates around 60: 60 fps means "the frame
  keeps up", not "60 fps of headroom". Absolute values understate a real window;
  use them for before/after comparisons of the same environment.
- **System load dominates.** With other capture harnesses, builds or agents
  running, frame times turn bimodal (16.7 ms ↔ 33.4 ms) and avg fps drops to
  40–50 while median fps stays ~60. The JSON records `host.loadAvg`; compare only
  runs with comparable load, and prefer median/1% low over avg for noisy pairs.
- **HMR reloads are muted inside a probe.** The harness mocks the Vite HMR
  websocket so a concurrent `src/` edit cannot navigate the page away
  mid-measurement; each shot still boots from the current on-disk tree. A
  transient failure (reload, renderer crash) restarts Edge and retries the shot
  up to 3 times; the JSON records `attempt`.
- **This is a regression probe, not the acceptance gate.** The ≥55 fps gate is
  measured by a single isolated run on the integrated tree; numbers taken while
  other agents edit `src/` are a harness smoke test.

To compare iterations, run the same command with another `--iteration` and diff
the per-shot JSON:

```bash
node tools/capture/perf.mjs --shot all --iteration before --json /tmp/perf-before.json
node tools/capture/perf.mjs --shot all --iteration after  --json /tmp/perf-after.json
# compare metrics.fps.avg / median / p1Low and metrics.frameTimeMs.p95 per shot;
# on an idle machine run-to-run noise is well under 1 fps, under load it is
# tens of fps — repeat a pair before calling a delta real.
```
