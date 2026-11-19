# Reference capture and metrics

Local-only tooling for comparing Glassline frames with the original *Mirror's
Edge* prologue reference. The reference video and extracted frames live in
`ref/`, which is intentionally git-ignored.

## 1. Capture

Start the dev server and a Chromium-family browser with remote debugging:

```bash
npm run dev -- --port 5199 --host 127.0.0.1

"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  --headless=new --no-sandbox --disable-gpu-sandbox \
  --remote-debugging-port=9222 \
  --user-data-dir=.npm-cache/edge-capture-profile \
  --window-size=1600,900 \
  about:blank
```

Then capture a deterministic frame:

```bash
npm run capture -- \
  --out docs/evidence/visual/round-1/start.png \
  --mode prologue \
  --pos 0,0.93,6 \
  --yaw 0 \
  --pitch 0
```

`--launch` starts the browser automatically. `--no-sandbox` is only acceptable
for a disposable local capture profile. The script calls `Page.bringToFront`
and enables focus emulation because headless pages otherwise report
`visibilityState === "hidden"` and stop advancing the game loop.

Useful viewpoints for the prologue:

| View | Position | Yaw | Pitch |
|---|---|---|---|
| Start | `0,0.93,6` | `0` | `0` |
| Wall-run corridor | `0,0.93,-10` | `0` | `0` |
| Looking back | `0,0.93,-10` | `3.14159` | `0` |
| Skylight edge | `4,0.93,0` | `-1.2` | `-0.3` |

The capture prints draw-batch, instance, triangle, texture, and program counts.

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

Round evidence is stored under `docs/evidence/visual/<round>/` as compressed
JPEGs plus a JSON report. Reference frames themselves are not committed.
