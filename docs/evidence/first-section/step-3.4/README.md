# Step 3.4 — First Section DEV launch and playable verification

Status: **PASS** — 54/54 browser checks, 0 page/console errors, one continuous
gameplay recording, 12 gameplay captures, and a same-conditions performance
comparison against the Prologue.

Branch: `feat/first-section-dev-launch` (base `main` @ `fdfc334`). Source of truth:
`FIRST_GAMEPLAY_SECTION_SPEC.md` §11.3 and the Step 3.4 brief.

The evidence in this folder was produced by a real browser run of the normal
gameplay lifecycle, not by the deterministic capture/screenshot mode.

---

## 1. Environment

| Item | Value |
|---|---|
| Browser | Microsoft Edge **157.0.4341.46** (Playwright 1.65, `channel=msedge`) |
| Browser mode | **headless** (real browser and WebGL; no visible window) |
| OS / hardware | macOS 27.2 (Darwin 27.2.0), Apple M1 Pro, 8 CPU cores |
| GPU | `ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)` |
| Viewport | **1600 × 900**, device pixel ratio **1** |
| Canvas backing buffer | 1600 × 900 (measured) |
| Display quality | **medium** — the shipped default (`display.quality`), not the capture-mode `high` pin |
| Host load at measurement | `loadAvg ≈ 17.7 / 19.0 / 18.6` (busy host; see §7 caveats) |
| Pointer lock | acquired on the game canvas by a real click |

## 2. Launch URL and how to play it

Dev-only URL contract: **`?dev=first_section`** (any other value is rejected
visibly; no menu entry exists).

```bash
npm run dev
# then open:
http://127.0.0.1:5173/?dev=first_section
```

Click the canvas once to capture the mouse, then play with the normal controls:
`WASD` move, mouse look, `Space` jump, `Shift` crouch/slide, `X` sprint, `E` vault,
`Esc` pause, `R` restart.

The harness run used its own server port and the same URL shape:

```bash
node tools/capture/dev-route.mjs --out-dir docs/evidence/first-section/step-3.4
# harness URL: http://127.0.0.1:5321/?dev=first_section
```

`?dev=…` is parsed only under `import.meta.env.DEV` and the runtime module is a
DEV-only dynamic import (same isolation as capture mode). A production build
ignores the parameter and boots the normal main menu.

## 3. How the evidence was produced

`tools/capture/dev-route.mjs`:

1. owns (or attaches to) a local Vite dev server and launches Edge via Playwright;
2. opens `?dev=first_section` and waits for `window.__glasslineDevLaunch.ready`;
3. acquires pointer lock with a real click, then drives the game with **trusted
   Playwright keyboard/mouse events** (`keyboard.down/up`, `mouse.move`) through
   the existing `InputManager`;
4. steers **closed-loop**: it reads the player position and camera yaw from the
   dev status and sends normal input (it never teleports, edits tuning, mutates
   player state, or calls gameplay internals to move the player);
5. records a continuous CDP page screencast, captures PNG frames at scenario
   points, and writes `report.json` (all checks, observations, renderer metrics);
6. repeats the launch in a fresh page for the dedicated Gap inspection frames;
7. measures FPS/frame time/draw calls/triangles in two fresh pages: First Section
   via `?dev=first_section`, and the Prologue via the **normal main-menu Prologue
   button**, with the identical 1.2 s sprint warm-up, 350 ms settle, 120 warmup
   and 300 measured rAF frames.

No deterministic camera pose is used anywhere in this folder.

Capture/reproduction command:

```bash
node tools/capture/dev-route.mjs --out-dir docs/evidence/first-section/step-3.4
```

## 4. Visual evidence

All PNGs are 1600×900 viewport screenshots of the live game with the HUD.
Hashes and byte sizes are in [`report.json`](report.json) → `screenshots`.

| File | Scenario | What it shows |
|---|---|---|
| [01-spawn.png](01-spawn.png) | Startup | Authored initial spawn at `(0, 0.895, 14)`, first-person view model, HUD `Speed 0.0 m/s`, no menu/loading overlay |
| [02-movement.png](02-movement.png) | Representative gameplay | Sprinting on the start roof at `8.5 m/s` with the HUD and route marker |
| [03-gap-a.png](03-gap-a.png) | Gap A (route) | Airborne frame immediately after the Gap A take-off, `Speed 8.5 m/s`, take-off edge visible |
| [04-gap-b.png](04-gap-b.png) | Gap B (route) | Airborne frame immediately after the Gap B take-off, `Speed 8.5 m/s`, landing roof ahead |
| [05-checkpoint.png](05-checkpoint.png) | Checkpoint | The existing checkpoint toast `Checkpoint reached: Starting Roof Checkpoint` and the HUD |
| [06-respawn.png](06-respawn.png) | Respawn | Player back at the `cp_start` spawn `(0, 0.895, 10)` after the real fall, camera level, HUD active |
| [07-slide-duct.png](07-slide-duct.png) | Route | Slide posture (`postureHeight 0.90 m`) inside the 1.00 m duct |
| [08-vault.png](08-vault.png) | Route | An actual `VAULTING` frame at the first vault obstacle |
| [09-finish-approach.png](09-finish-approach.png) | Route end | Finish podium approach toward the authored finish marker |
| [10-results.png](10-results.png) | Completion | The normal Results screen after the authored finish |
| [11-gap-a-inspection.png](11-gap-a-inspection.png) | Gap A (inspection) | Real gameplay frame from the take-off edge looking down: deck edge, void and roof B |
| [12-gap-b-inspection.png](12-gap-b-inspection.png) | Gap B (inspection) | Real gameplay frame from roof B looking down: roof B edge, void and roof C |

The Gap inspection frames come from a second dev launch driven with the same real
controls; they are additional evidence, not substitutes for the route captures.

### Continuous gameplay recording

[route.mp4](route.mp4) — 1600×900, H.264, 30 fps, **26.73 s**, 1321 screencast
frames. It covers the whole session from the initial spawn (after the dev launch
became ready) through movement, the fall/respawn, both gap jumps, the technical
passage, slide duct, three vaults, stairs, finish trigger and Results. Audio is
not included (the recording is video-only); input remains trusted browser
keyboard/mouse events with pointer lock held for the run.

## 5. Scenario results

The **54 checks** are listed individually with pass/fail and details in
[`report.json`](report.json) → `checks`. Key observations:

### A. Startup

| Check | Measured |
|---|---|
| Flow / session | `gameplay` / `running` (`gameplay-session-1`) |
| Level / section | `first_section` loaded, Level Session `active`, section `sec_start` |
| Player | `(0, 0.8947, 14)`, `IDLE`, grounded, standing, posture 1.75 |
| Camera | yaw `0`, pitch `0`, attached to the player |
| HUD | `.gl-hud` visible, `Speed 0.0 m/s` |
| Overlays | 0 screen children, no loading screen, boot loader removed |
| Input | existing `InputManager` context `gameplay`; pointer lock `game-canvas` after click |

### B. Input and movement (existing InputManager)

| Check | Measured |
|---|---|
| Mouse right | yaw `0 → -0.396 rad` (180 px at 0.0022 rad/px); restored to `0` |
| Mouse down | pitch `0 → -0.264 rad`; restored to `0` |
| `W` | z `14 → 10.31` |
| `S` | z `10.31 → 13.27` |
| `D` / `A` | x `0 → 2.37 → 1.62` |
| Jump | apex `2.396 m`, rise **1.501 m**; airborne and `LANDING` observed; grounded after |
| Sprint | **8.5 m/s** (`SPRINTING`); **6.633 m/s** retained 120 ms after releasing `W`; `0` after stopping |
| Pointer lock survives respawn | yes (`game-canvas`) |

### C. Route traversal (authored direction, normal controls)

| Segment | Measured |
|---|---|
| Gap A (3.4 m) | take-off z `-1.657` @ `8.5 m/s`; airborne z `-2.082`, y `1.278`; landing z `-8.032`, `LANDING` on roof B |
| Gap B (4.2 m) | take-off z `-13.132` @ `8.5 m/s`; airborne z `-14.124`, y `1.703`; landing z `-19.507`, `LANDING` on roof C |
| Plant step (0.90 m) | jumped at z `-23.616`; landed z `-25.328`, y `1.747` |
| Technical gallery | crossed; max lateral drift `0 m` (centre line) |
| Slide duct (1.00 m clearance) | crouch held from z `-45.485` @ `8.5 m/s` to z `-54.404`; posture `0.90` throughout |
| Vault obstacles | **3/3** vaulted via `E`; `VAULTING` observed; no obstacle blocked the route |
| Stairs | sprint released at z `-71.603`; both flights walked up with autostep to podium y `5.395` (top 4.50 + capsule offset) |
| Finish | `trigger_finish` → Results |

### D. Checkpoint

| Check | Measured |
|---|---|
| Activation | `cp_start` activated by the authored `trigger_cp_start` volume (not by script) |
| Active checkpoint | `cp_start`; `activatedCheckpointIds = ["cp_start"]` |
| Existing toast | `Checkpoint reached: Starting Roof Checkpoint`, visible |
| Other route checkpoints | `cp_building_jump` (z `-19.366`), `cp_slide` (z `-54.519`), `cp_vault` (z `-69.336`) all activated by their authored volumes |

### E. Respawn

| Check | Measured |
|---|---|
| Fall | walked off the start deck (first sampled z after the edge: `-2.539`); the fall then entered the kill volume, whose top is at `y = -3` |
| Respawn count | **1** at `cp_start`; still 1 after 1.8 s of settling (no repeat) |
| Destination | `(0, 0.93, 10)` = `sp_cp_start`; after settle `(0, 0.895, 10)`, grounded |
| State | `RespawnManager` back to `idle`; active checkpoint `cp_start` |
| Camera / input | pointer lock still held; `W` moved z `10 → 7.35`; mouse yaw changed `-0.132 rad` |

### F. Completion

| Check | Measured |
|---|---|
| Trigger | authored `trigger_finish` |
| Session results | `completed`, `levelId: first_section`, `mode: prologue`, duration `30.808 s` |
| Flow / screen | `results` / Results panel |
| Prologue campaign | `prologueCompleted = false`; no `level.completed` publication for `first_section` (completion policy gates on `prologue_test`) |
| Console | 0 uncaught page errors, 0 console errors |

## 6. Performance (measured, not estimated)

Method: in-page rAF frame deltas after a 1.2 s normal sprint and 350 ms settle;
draw calls and triangles aggregated per frame across the scene pass and every post
pass (the capture-mode statistic). Both samples: same browser instance, viewport,
DPR, quality (`medium`), warmup 120 + measured 300 frames.

| Metric | First Section | Prologue | Delta (FS − Prologue) |
|---|---:|---:|---:|
| Average FPS | 60.00 | 58.44 | +1.56 |
| Median FPS | 59.88 | 59.88 | 0.00 |
| 1 % low FPS | 59.52 | 30.03 | +29.49 |
| p95 frame time | 16.7 ms | 16.8 ms | −0.1 ms |
| p99 frame time | 16.8 ms | 33.3 ms | −16.5 ms |
| Max frame time | 16.8 ms | 33.4 ms | −16.6 ms |
| Draw calls (median) | 218 | 261 | −43 |
| Triangles (median) | 478,071 | 4,363,995 | −3,885,924 |
| Quality / canvas | medium / 1600×900 | medium / 1600×900 | — |

Interpretation:

- **No frame-pacing regression was observed** at the measured gameplay state.
  Median FPS is identical; p95 is within 0.1 ms. The Prologue average/1 % low is
  lower because that sample contains a single 33.4 ms frame (one skipped vsync),
  while the First Section sample has none. The +1.56 average FPS delta is that
  artifact, not a performance claim.
- The measured First Section viewpoint renders **fewer triangles and 43 fewer
  draw calls** than the measured Prologue viewpoint. These are different authored
  scenes; this is a same-conditions comparison at one representative rooftop
  state, not a full-level benchmark, and no rendering or level content was
  changed in Step 3.4.
- Full per-frame arrays, percentiles and renderer environment are in
  [`report.json`](report.json) → `performance`.

## 7. Limitations

- **No human hands-on pass.** The browser run is a real Edge session with real
  rendering and trusted keyboard/mouse events, but all input was driven by the
  Playwright harness, not by a person. No gamepad, audio, or subjective feel
  assessment is claimed.
- **Headless metrics are a proxy.** Headless Edge frame pacing saturates near
  60 FPS and the host was busy (`loadAvg ≈ 18`); use median/1 % low rather than
  average, and treat absolute numbers as a regression gauge.
- **Results panel mode label.** First Section reuses the `prologue` gameplay mode
  (no dedicated single-section mode exists), so the Results panel says
  `Mode: Prologue`. Campaign progression is unaffected: the completion policy
  rejects `first_section`, `prologueCompleted` stays `false`, and no Prologue
  milestone unlocks.
- **`checkpoint.prologue_all` guard.** The Application guard remains
  count-based (`>= 5` unique checkpoints, non-training). First Section authors
  exactly four, so it cannot fire; a fifth First Section checkpoint would need a
  level-id gate before Prologue achievement isolation stays guaranteed.
- **Timing-dependent automation.** The run drives normal movement with closed-loop
  observation; a slower frame or host stall can change jump/vault timing. This run
  passed all checks with no vault retries; earlier development runs occasionally
  needed one legal back-up retry. The authored geometry and movement tuning were
  never changed to make a run pass.
- **Video is silent and dev-only.** The recording has no audio track; `?dev=…` is
  a development entry point and is absent from production behavior and bundles.
- **Snapshot speeds during scripted actions.** `PlayerSystem`'s movement snapshot
  reports the instantaneous scripted trajectory rate during a vault (used nowhere
  as a tuning claim); the approach speed on each obstacle is the normal `8.5 m/s`
  sprint. The slide duct exit snapshot is `3.0 m/s` as the stance settles after the
  duct; the route then continues normally.

## 8. Reproduction checklist

```bash
npm run dev    # or let the harness own the server
node tools/capture/dev-route.mjs --out-dir docs/evidence/first-section/step-3.4
# expected: PASS — 54/54 checks, 12 screenshots, report.json + route.mp4
```

The report records the browser version, URL, viewport/DPR, quality, GPU strings,
host CPU/load, every check with details, scenario observations, screenshot
sha256/bytes and the full performance samples.
