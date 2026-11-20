# GAMEPLAY_FEEL_BASELINE.md

Project: Glassline
Document: Gameplay Feel Baseline (Phase 0 — Baseline Audit)
Status: Active
Priority: High
Produced by: Gameplay Feel Audit, Phase 0 (per `docs/GAMEPLAY_FEEL_AUDIT.md` §18)
Date: 2026-11-20

---

## 1. Purpose

This document records the measured baseline of the current first-person parkour
experience: implementation inventory, runtime tuning values, test coverage,
scenario-by-scenario runtime results, known limitations, performance
observations, unverified areas, and reproduction instructions.

It is the Phase 0 deliverable of the audit process defined in
`docs/GAMEPLAY_FEEL_AUDIT.md` §4/§18. No gameplay tuning changes were made
during this phase.

---

## 2. Audit Snapshot

| Field | Value |
|---|---|
| Repository | `/Users/igorhodorchenko/Project/glassline` |
| Commit at audit start | `d21e0b6` "docs(reports): owner final acceptance — release candidate ACCEPTED" |
| Commits during audit | `aeb7625` "fix fizics", `70174f2` "fix ladder" (step-glide riser climb), `ba9e477` "fix ramps" (slope handling) — owner work in parallel with the audit |
| Uncommitted work at audit end | None in `src/` (owner work committed); only documentation changes |
| Group 1 fixes (this audit) | Committed by the owner: `33de0ac` (GF-ISSUE-01), `6796786` (GF-ISSUE-06) + regression tests |
| Group 2 fixes (this audit) | Input edge queue (GF-ISSUE-10), slide steering (GF-ISSUE-04) — committed (`a902866`, `067356f`) |
| Group 3 fixes (this audit) | Vault profiles + interact buffer (GF-ISSUE-02/11), wall-run surface gating (GF-ISSUE-03), collision-validated vaults (GF-ISSUE-07) — implemented and verified; see the report |
| File content pins | `src/player/MovementModel.ts` sha256 `693537d…`-era variants were re-pinned several times during the audit (see §2.1) |
| Browser | Microsoft Edge 157.0.4341.46, headless, WebGL2 on SwiftShader (software rasterizer) |
| Resolution | 1600×900, DPR 1 |
| Input | Real DOM keyboard events (Playwright), pointer lock verified working in headless Edge |
| Runtime snapshot medium | Vite dev build (tree state at each page load), server with watcher disabled |

### 2.1 Concurrent modification notice (important)

The working tree was **actively edited by the project owner (or a parallel
agent) throughout the audit window** (20:27–21:05). `MovementModel.ts`,
`MovementTuning.ts`, `PlayerSystem.ts`, `CameraSystem.ts`, `ViewModel.ts`,
`docs/12_MOVEMENT_SYSTEM_SPEC.md` and several test files changed repeatedly;
part of the work was committed as `aeb7625` ("fix fizics") during the window.

Consequences for this baseline:

- Runtime numbers that depend on jump tuning are **point-in-time observations**:
  the jump height was observed at 1.25 m (spec value), then ≈1.46 m, then 1.6 m
  across three file states within ~20 minutes.
- The audit harness therefore pinned every measurement to a recording file with
  per-step timestamps (see §12). Conclusions that are structural (code-level)
  are hash-pinned and were re-verified against the final state.
- Two test-suite states were observed: (a) 2–3 failing tests with `npm run
  validate` red during the early window; (b) **377/377 passing at audit end**.
  The final state is the one to rely on, but the intermediate state is
  documented because it was real at the time.

---

## 3. Implementation Inventory

Legend: spec = `docs/12_MOVEMENT_SYSTEM_SPEC.md` (movement), `13` camera,
`11` input, `02` architecture, `03` gameplay.

| Area | What is implemented | Where | Owner | Follows spec | Tests | Observable issues |
|---|---|---|---|---|---|---|
| Fixed timestep | 60 Hz accumulator loop, `maxFrameDelta 0.1 s`, max 5 steps/frame, catch-up discard, interpolation alpha | `src/core/GameLoop.ts` | Core / GameLoop | Yes (`02` §7) | `game-loop.test.ts` (8) | None observed; dropped time only on deliberate stalls |
| Physics integration | Rapier kinematic character controller (`KinematicCharacterController`), capsule r=0.3, h=1.75, offset 0.02, autostep 0.4 m (+downcast), snap-to-ground 1.0 m, slope climb 50°/slide 35° | `src/player/PlayerSystem.ts` | Movement | Mostly (`12` §5.3/§9) | `player-physics.test.ts` (8), `traversal-detection.test.ts` (6) | **Slide velocity-kill** (see GF-10); ground-stick is a new, partially tested behavior |
| Movement model | Pure simulation: IDLE/RUNNING/SPRINTING/JUMPING/FALLING/LANDING/SLIDING/VAULTING/WALLRUN/WALLJUMP; posture stance standing/crouching/sliding | `src/player/MovementModel.ts` | Movement | Yes (`12` §7) | `movement-model.test.ts` (28) | Variable-jump semantics changed 3× during the window (now: cut after 2 airborne steps) |
| Ground movement | moveTowards-based acceleration 18 m/s², deceleration 14 m/s², walk/run/sprint speed bands (3.5/6/8.5), diagonal normalized | `MovementModel.resolveTargetVelocity` | Movement | Yes (`12` §6.1/§8.2) | Yes | Start latency fine (1 step) |
| Sprinting | X hold; SPRINTING state when speed > 5.1; FOV +7; footstep interval scales with speed | MovementModel + `CameraSystem` + `Application` | Movement/Camera | Yes | Yes | Sprint cancels when crouched (by design in code) |
| Jumping | sqrt(2·g·h) impulse, jump buffer 0.12 s, coyote 0.14 s, variable height (release cut at `airborneStepsSinceJump >= 2`, ratio 0.6), release gravity ×2.5, max fall 35 m/s | MovementModel | Movement | Yes (`12` §11) | Yes (28 tests incl. buffer/coyote/variable) | Tapped-vs-held feel depends on the grace window being finalized (was actively retuned) |
| Landing | LANDING state 0.18 s, `player:landed {impactSpeed}`, horizontal velocity preserved | MovementModel + PlayerSystem | Movement | Yes (`12` §17) | Partial — no test asserts horizontal-speed preservation at landing | Wall-jump landings do **not** emit `player:landed` (see report GF-ISSUE-06) |
| Crouch | Posture height 1.15, speed ×0.5, stand-up clearance ray | MovementModel/PlayerSystem | Movement | Yes (`12` §12) | `player-traversal` slide-tunnel test | Verified working incl. ceiling block |
| Sliding | Entry ≥5 m/s + crouch, friction 2 m/s² toward zero, min 0.25 s / max 1.2 s, exit <2.5 m/s, slide jump after min duration | MovementModel | Movement | Partial (`12` §13) | 4 model tests | **No steering during slide** (velocity target is zero; `12` §13.3 requires configurable steering); **velocity-kill bug**; exit observed at full stop instead of 2.5 m/s threshold due to the bug |
| Vaulting | E-press contextual vault (interact-buffered 0.15 s): forward ray + top probe + landing probe + head clearance; Standard/Speed profiles (2.5/6 m/s thresholds, 0.45/0.3 s, retention 0.85/0.95); clearance-aware arc moved through the character controller; `player:vault-started {speed, vaultType}` | `detection/VaultDetector.ts` + MovementModel + PlayerSystem | Movement | Yes (`12` §14) | 8 model + 3 detector tests | Group 3 resolved the single-profile deviation, unbuffered presses and the collision bypass |
| Wall running | Airborne ≥5 m/s, side raycasts ≤0.75 m, wall normal |y|≤0.35, tangent alignment ≥0.4, **`wallRunSurface` metadata gate at the hit point**; gravity ×0.35, speed −1 m/s/s (min 5), max 1.5 s; camera roll 3.4° | `detection/WallRunDetector.ts` + MovementModel + CameraSystem | Yes (`12` §15.2) | 4 model + 4 detector tests + physics test | Boundary walls no longer trigger wall runs (runtime-verified) |
| Wall jumping | Jump during wall run: tangent·speed·0.9 + normal·5.5, vy 6; WALLJUMP 0.25 s; `player:walljumped` | MovementModel | Movement | Yes (`12` §16) | Yes | No landing event afterwards (see Landing row) |
| Ground-stick (new) | Walk-off ledges while pushing forward: stick to surfaces ≤1 m below at ≤9 m/s instead of micro free-fall; disarms on jump/wall-kick/snap miss | MovementModel + PlayerSystem | Movement | New behavior; `12` §18 (slopes/uneven geometry) motivation | 2 model tests + stairs tests | New uncommitted-until-`aeb7625` behavior; only forward walk-offs stick (side/back walk-offs still fall) |
| Input | DOM → abstract actions; held-keys set + per-frame pressed/held/released edges **+ pending-press queue (Group 2)**; mouse deltas accumulated; gamepad polling; pointer lock lifecycle; contexts; focus-loss clearing | `src/input/InputManager.ts`, `InputState.ts` | Input | Yes (`11`) | `input.test.ts` (19) | Within-frame taps preserved via `pendingPresses`; edges stay one-shot for catch-up steps |
| Camera | Yaw/pitch ±85°, 0.0022 rad/px mouse (no smoothing), gamepad rate path, FOV 75→82 sprint damped, eye-height damping, bob 0.018 m, landing dip 0.06 m + tiny roll, wall-run roll ±0.06 rad, Reduced Motion zeroes effects | `src/camera/CameraSystem.ts` | Camera | Mostly (`13`) | `camera.test.ts` (19) | **Landing dip amplitude is constant — not proportional to impact speed** (`13` §11.6); no sprint-FOV intensity setting exists (`13` §9.6 vs `25` settings registry) |
| View model | Two-arm rig with bob/air/slide/wall-run/landing poses | `src/rendering/ViewModel.ts` | Rendering | Yes | — | Fine |
| Audio feedback | Footsteps (speed interval, surface-aware), jump/landing/slide loop/vault/wallrun loop/walljump one-shots, wind by speed/altitude; all event-driven | `src/audio/AudioManager.ts` + Application wiring | Audio | Yes (`08`) | `audio.test.ts` (18) | Never human-listened (documented project-wide limitation) |
| HUD | Speed indicator (m/s, bottom-left), interaction prompts, checkpoint/toast notifications | `src/ui/UIManager.ts` | HUD | Yes (`23`) | — | Verified visually at runtime |
| Settings/accessibility | Sensitivity, FOV 60–100, bob/motion intensity, Reduced Motion, volumes; immediate application | `src/settings/*` + Application pipeline | Settings/Accessibility | Yes | `settings.test.ts` (11), `accessibility.test.ts` (9) | Reduced Motion verified at runtime (sprint FOV stays 75) |
| Respawn/restart | `RespawnManager` orchestrates kill-volume falls to active checkpoint; R restarts session to spawn; camera resets | `src/respawn/RespawnManager.ts` + Application | Respawn | Yes (`17`) | `respawn.test.ts` (5) | Verified at runtime (GF-18) |

### 3.1 Runtime tuning values (final observed state, ≈21:00)

`src/player/MovementTuning.ts` (`DEFAULT_MOVEMENT_TUNING`):

| Parameter | Value | Spec target (`12` §5.3/§6) |
|---|---:|---:|
| Capsule height / radius | 1.75 / 0.30 | 1.75 / 0.30 |
| Standing / crouch / slide eye height | 1.60 / 1.05 / 0.65 | 1.60 / 1.05 / 0.65 |
| Walk / run / sprint speed | 3.5 / 6.0 / 8.5 | 3.5 / 6.0 / 8.5 |
| Ground accel / decel | 18 / 14 | 18 / 14 |
| Air accel / max air speed | 5 / 9.5 | 5 / 9.5 |
| Gravity | 22 | 22 |
| Jump height | **1.6** (was 1.25 at audit start; spec target 1.25) | 1.25 |
| Min jump velocity ratio | **0.6** (was 0.55) | min height 0.45 m |
| Jump buffer / coyote | 0.12 / 0.14 | 0.12 / 0.14 |
| Jump release gravity × | 2.5 | — |
| Max fall speed | 35 | 35 |
| Slide min entry / friction / min / max / exit | 5 / 2 / 0.25 / 1.2 / 2.5 | 5 / 2 / 0.25 / — / 2.5 |
| Vault min/max height / duration / arc lift | 0.35 / 1.15 / 0.45 / 0.25 | 0.35 / 1.15 / — / — |
| Wall-run min speed / max dur / gravity × / decay | 5 / 1.5 / 0.35 / 1 | 5 / 1.5 / 0.35 / — |
| Wall jump outward / upward | 5.5 / 6 | configurable |
| Max step height / step min width / snap distance / stick speed | 0.4 / 0.08 / 1.0 / 9 | 0.40 / — / — / — |

Camera constants (`CameraSystem.ts`): mouse 0.0022 rad/px · sensitivity 1.0;
pitch ±85°; FOV base 75 (settings range 60–100), sprint +7; wall-run roll
0.06 rad (≈3.4°, spec max 8°); landing dip 0.06 m; bob amplitude 0.018 m.

---

## 4. Test Coverage Inventory

Executed during the audit:

| Command | Result |
|---|---|
| `npm run typecheck` | PASS (final state) |
| `npm test` | **397/397 PASS** (387 after Group 2 + 6 vault-profile/buffer tests + 1 detector test + 3 physics tests) |
| `npx biome check .` | PASS for project sources at final state; transiently red due to the audit's own scratch files (removed from the tree afterwards) and, mid-window, to uncommitted source formatting |
| `node tools/capture/capture.mjs --iteration audit --shot start-roof` | PASS — 196 draw calls, 4,182,467 triangles, 0 console errors, 0 page errors |
| Runtime scenario harness (custom, Playwright) | See §6 |

Coverage relevant to gameplay feel:

- Movement model: 39 unit tests (locomotion, sprint, crouch, air caps, jump,
  buffer, coyote, variable jump, fall clamp, collision reconciliation, landing
  event, ground-stick, slide, vault, wall run, wall jump).
- Player/physics integration: 12 tests
- Input: 19 tests (incl. 3 pending-press edge tests)
- Traversal detection: 7 tests (incl. wall-run surface gating) (settle, move/strafe, jump+land, wall
  block, body sync, reset, stair descent with ground-stick, camera filter).
- Camera: 19 tests (look, pitch clamp, FOV, reduced motion, etc.).
- Input: 16 tests. Game loop: 8 tests. Traversal detection: 6 tests.
- Prologue traversal (real Rapier world): 6 tests incl. lower-gap sprint jump,
  scaffold ascent, catwalk, slide tunnel clearance, bridge/finish.

**Gaps identified (missing tests):**

1. No test asserts horizontal-velocity preservation across a landing
   (`12` §31.1 momentum preservation) — behavior was only verified at runtime.
1b. No test covers slide entry at low speed (new GF-10) or slide exit on a slope (new GF-11).
2. No vault-profile tests (Standard vs Speed) because profiles do not exist
   (see GF-ISSUE-02).
3. No wall-run surface-metadata tests (detector ignores metadata by design —
   see GF-ISSUE-03).
4. ~~No wall-jump → landing event test~~ — added in Group 1 (the event was never emitted; GF-ISSUE-06 fixed).
5. No movement-outcome tests at 30/120 Hz or unstable frame rates
   (`12` §31.4); only loop mechanics are unit-tested.
6. No slide-steering test (steering is unimplemented — GF-ISSUE-04).
7. ~~`tests/unit/tmp-debug.test.ts` debug scratch file~~ — removed by the owner (commit `aeb7625` era).
8. (Added in Group 1) Slide velocity-kill regression — model + physics tests now guard it.

---

## 5. Performance Observations

Environment caveat: headless Edge on SwiftShader (software WebGL) — same
environment class as the project's own `docs/PERFORMANCE_BASELINE.md`. Numbers
are environment-limited, not representative of a hardware GPU.

| Metric | Measured |
|---|---|
| rAF average frame | 22.4 ms (≈44.6 fps) |
| p95 frame | 37.7 ms |
| Max frame | 47.0 ms |
| Physics steps vs wall time | 1.00× realtime — **no catch-up loss during normal play** |
| Loop stats after session | frameCount 1326, physicsStepCount 1629, droppedTime 9.07 s (accumulated over teleport/evaluate stalls; catch-up clamp works as designed) |
| Draw calls (capture tool, start-roof, quality high) | 196 |
| Triangles (start-roof) | 4,182,467 |
| Console/page errors during full scenario suite | 0 / 0 |

Observations:

- Fixed-step physics kept up with real time in all scenarios; the max-5-steps
  clamp prevented spiral-of-death on deliberate stalls.
- Single-frame spikes up to 47 ms in this environment did not destabilize
  movement (no physics explosions, no catch-up chain).
- No memory growth was measured; level restart in GF-18 rebuilt the session
  cleanly with no observable leaks (no duplicate listeners/errors).

---

## 6. Scenario Results (GF-01 … GF-18)

All scenarios were executed against the current dev tree with real DOM
keyboard/mouse input; player/camera state was recorded per physics step
(60 Hz) inside the page. Each entry lists the recording file under
`/tmp/glassline-rt/` (audit working copies; see §12).

### GF-01 — Ground movement ✅ EXECUTED

- Initial: idle at spawn, flat roof, no input.
- Expected: acceleration to 6 m/s without perceptible lag; smooth stop.
- Actual: first movement within one physics step of keydown; run band in
  ≈0.58 s (theoretical 0.33 s + a ~240 ms rAF stall in the software-rendered
  environment at keydown); peak exactly 6.00 m/s; stop ≈0.39 s after release
  (theoretical 0.43 s at 14 m/s²). Diagonal input normalized (code + input
  tests).
- Repeatable: yes (2 runs + unit tests).
- Problems: none beyond the environment's rAF stall artifact.

### GF-02 — Sprinting ✅ EXECUTED

- Actual: SPRINTING immediately at X press while running (speed already >5.1);
  peak exactly 8.50 m/s; releasing X settles back to 6.0–6.1 m/s in ≈0.12–0.18 s;
  FOV rises 75 → 82 damped and returns. Sprint is cancelled by crouching
  (code intent).
- Problems: none measured.

### GF-03 — Turning ✅ EXECUTED

- Actual: pointer lock acquires in headless Edge; mouse look is exactly
  0.0022 rad/px — 200 px = 25.21° yaw, 170 px = 21.43° pitch (matches the
  single sensitivity layer, no smoothing, no dt scaling). Pitch clamps at ±85°
  (unit tests). Keyboard reversal decelerates progressively (peak 6.0 m/s,
  ≈5.0 m/s 100 ms after reversing input).
- Problems: none measured.

### GF-04 — Jump from standstill ✅ EXECUTED (point-in-time tuning)

- Actual (tuning at the time: jump height ≈1.46 m): held jump rise 1.397 m,
  airborne ≈0.68 s; a short tap rose 0.856 m (variable-jump cut active).
  With the earlier broken state (20:44), tap and hold were identical (1.071 m).
- Problems: the tap/grace semantics were being actively retuned by the owner
  during the audit; final committed semantics = cut from the 2nd airborne step.

### GF-05 — Jump while sprinting ✅ EXECUTED

- Actual: entry 8.5 m/s, tapped rise 0.779 m (cut), air distance 3.68 m,
  airborne 0.43 s. Horizontal momentum carried through the jump.
- Problems: none; the shorter tap arc is the intended variable-jump behavior.

### GF-06 — Jump input buffering ✅ EXECUTED

- Actual: a Space tap during descent (~0.1 s before landing) executed a new
  jump 0.037 s after touchdown-ready — buffering works.
- Problems: none.

### GF-07 — Coyote time ✅ EXECUTED

- Actual: walking forward off the pit edge, pressing Space ≈0.07–0.10 s after
  leaving the edge executed a jump — coyote window works.
- Problems: none measured; coyote is disarmed by ground-stick after the window.

### GF-08 — Landing ✅ EXECUTED

- Actual: horizontal speed 8.5 → 8.5 m/s across landing (momentum fully
  preserved); landing recovery 0.18 s; impact vertical speed ≈7.7 m/s.
- Problems: camera dip/roll is the same for every landing regardless of impact
  (GF-ISSUE-05) — feedback, not physics.

### GF-09 — Crouching ✅ EXECUTED

- Actual: posture 1.75 → 1.15, crouch-run capped at 3.0 m/s (run ×0.5);
  inside the slide tunnel (ceiling 1.35 m) releasing crouch keeps the player
  crouched (stand-up blocked) — collider/camera stay consistent.
- Problems: none.

### GF-10 — Sliding ⚠️→✅ EXECUTED — BUG CONFIRMED, THEN FIXED

Baseline (before the fix, commits ≤ `ba9e477`):

- Actual: slide starts instantly at 8.5 m/s, decelerates at the configured
  2 m/s² for a while, then **speed craters from ≈7–8 m/s to ≈0.3 m/s in a
  single physics step** with zero movement, ending the slide in ~0.36 s at
  near-standstill instead of the intended 2.5 m/s exit.
- Repeatability: reproduced 3× at runtime at different z positions and
  deterministically in a scripted probe (45-step slide, kill at step 44).
  Position-dependent and non-geometric (blocked locations vary with a 1 mm
  lateral offset; no collider exists at the block point).
- Root cause: minimal Rapier repro proved the trigger is
  `enableSnapToGround(>0)` **and** the grounded slide's −0.5 m/s downward
  bias: the bias pushes the already-contacting capsule into the floor every
  step and fights the snap feature; occasionally the controller stalls and
  cancels all movement. Autostep/downcast/snap distance are not triggers;
  removing the bias alone → 0 kills across all repro variants.

After the fix (slide grounded bias removed, `MovementModel.applyVerticalMotion`):

- Actual: slide at 8.5 m/s entry now decays at exactly 2 m/s² per step
  (0.033–0.034 m/s per fixed step measured), runs the full 1.17 s to the
  1.2 s max-duration cap at ≈5.7–6.0 m/s, then exits to RUNNING/SPRINTING.
  No velocity kills across GF-10, GF-11, GF-17 re-runs.
- Regression coverage: model test (grounded slide keeps vy = 0), physics
  regression test that fails on pre-fix HEAD and passes with the fix
  (single-step drop < 1 m/s over a full slide).
- Open item (new audit doc GF-10): entry at **low** approach speed
  (5–6 m/s, just above the 5 m/s minimum) not yet exercised at runtime —
  pending.
- Group 2 steering: a slide now bends toward lateral input at
  `slideSteeringAcceleration` (6 m/s²) without gaining speed — runtime probe:
  +2.76 m lateral drift across a full slide with D held, speed only decayed.

### GF-11 — Slide exit ✅ EXECUTED

- Actual: releasing crouch after min duration exits at ≈7.5 m/s (entry 8.5,
  decay matches 2 m/s²); slide→jump works (vy = jump impulse, state JUMPING).
- Open item (new audit doc GF-11): exit **on a slope** not yet exercised at
  runtime (no slope slide geometry in the arena) — pending.

### GF-12 — Valid vaulting ✅ EXECUTED

- Actual (after Group 3): E held through the approach → vault fires 0.073 s
  after the buffered press at 6 m/s → **speed profile** (0.28 s), clearance-
  aware arc through the character controller, lands ≈0.5 m past the obstacle
  far face, state FALLING → landing. Deterministic detection; invalid
  heights/point-blank/no-speed cases rejected (GF-13).
- Profiles: standard < 6 m/s (0.45 s, retention 0.85), speed ≥ 6 m/s (0.3 s,
  retention 0.95); `player:vault-started` carries `vaultType`.

### GF-13 — Invalid vaulting ✅ EXECUTED

- Actual: E with no obstacle → no vault; E point-blank (≈0.05 m from the
  face) → no vault (detector requires ≥0.08 m). Obstacles outside
  0.35–1.15 m rejected (unit tests).
- Problems: none observed.

### GF-14 — Wall running ✅ EXECUTED

- Actual: hop along the corridor wall → WALLRUN (left side), 29 steps
  (0.48 s), 3.85 m of travel, camera roll peaked at 3.4° (within the 8° spec
  budget) and returned to neutral. Entry requires a speed ≥5 m/s airborne
  approach (detector gates verified in unit tests).
- Group 3: eligibility now gated by `wallRunSurface` metadata — the corridor
  wall remains runnable; a separate probe along the boundary parapet
  (surface_boundary) produced no wall run. Entry is timing-sensitive by
  design (first attempt in GF-15 failed to attach).

### GF-15 — Wall contact loss ✅ EXECUTED

- Actual: strafing away from the wall during a wall run → FALLING; roll decayed
  to 0.07° within 350 ms. No residual velocity or camera state.
- Problems: none observed.

### GF-16 — Wall jumping ✅ EXECUTED — landing feedback FIXED

- Actual: Space during wall run → WALLJUMP, vy = 6.0, outward velocity away
  from the wall (positive x from the west wall), tangent momentum retained.
- Before the fix: landing after the wall jump emitted no `player:landed` event
  (GF-ISSUE-06) — audio/camera/statistics missed that landing.
- After the fix (`wasAirborne` now includes WALLJUMP): the landing produces
  LANDING state with the standard 0.18 s recovery (verified at runtime,
  GF-16 re-run) and a unit regression test.

### GF-17 — Combined traversal sequence ✅ EXECUTED

- Actual sequence after the slide fix: RUNNING → SPRINTING → JUMPING →
  FALLING → LANDING → SPRINTING → SLIDING → JUMPING → FALLING → LANDING →
  SLIDING → RUNNING. Momentum carried across every transition, including
  slide→jump; the former SLIDING → IDLE velocity-kill is gone.

### GF-18 — Restart and respawn consistency ✅ EXECUTED

- Actual: R restarts the session → player back at spawn (z 5.995), settled
  stance, FOV reset to 75, movement works immediately. Falling into the pit
  kill-volume triggers `RespawnManager` → player restored at the active
  checkpoint (cp_rooftop), input and movement work afterwards, camera state
  clean.
- Problems: none observed.
- Open item (new audit doc GF-18): repeated **route** cycles
  (route → restart → route) with resource/state sampling not yet measured —
  pending.

### Reduced Motion (accessibility) ✅ EXECUTED

- Actual: enabling `accessibility.reduced_motion` immediately disables dynamic
  FOV (sprint FOV stays 75), bob, landing dip/roll and wall-run roll; look
  remains responsive. Disabling restores effects.

### Visual verification ✅ EXECUTED

- `captures/audit/start-roof.png` (capture tool): correct rooftop environment,
  white architecture with red accents, sky, no HUD in capture mode, no
  rendering artifacts, 0 console errors.
- Gameplay screenshot (boot-prologue.png): first-person view with runner arms,
  speed indicator HUD bottom-left ("Speed 0.0 m/s"), clear environment.

---

## 7. Known Limitations

1. Software-rendered headless environment — fps/latency numbers are not
   representative of real hardware (matches the project's own baseline caveat).
2. Gamepad could not be exercised (no physical controller; the path is
   unit-tested only). Marked NOT VERIFIED at runtime.
3. Audio was verified structurally (events wired, loops stop on exit) but
   **not listened to** — the project-wide "no human listening pass" limitation
   remains.
4. Full human Prologue run (GF-15 of the doc's numbering / Phase D) was not
   performed — only the automated waypoint/traversal tests and section-level
   scenario runs.
5. Training-mode exercises were not individually played; training geometry was
   used indirectly through the prologue arena (same layout).
6. Jump-release semantics were in flux during the audit window (see §2.1).

## 8. Unverified Areas

- Gamepad look/move (runtime).
- Firefox/Safari gameplay (project-known; Firefox sandbox crash, Safari
  remote automation off).
- Human audio pass.
- Real-hardware frame pacing and vsync behavior.
- Mouse-look feel at >60 Hz displays.
- Full route repeated-attempt learning curve (GF-16 in the doc's numbering).

---

## 9. Reproduction Instructions

All runtime evidence was produced with a Playwright harness that drives real
DOM input and records per-physics-step player/camera state. The harness and
recorded data were kept outside the repository during the audit; to reproduce:

```bash
# 1. Start the game with HMR disabled (so concurrent edits cannot reload):
npx vite --port 5199 --strictPort --host 127.0.0.1 \
  --config /tmp/glassline-audit/vite-audit.config.ts (audit working copy; promote into tools/ before reuse)

# 2. Run scenarios (harness lives in /tmp/glassline-audit/eval.mjs):
node /tmp/glassline-audit/eval.mjs gf01 gf02 ... gf18 perf

# 3. Recordings land in /tmp/glassline-rt/<scenario>.json
#    (per-step rows: t/state/speed/xyz/grounded/stance/... and key events)
```

Deterministic slide-bug repro (in-page, no rendering between steps):

```bash
node /tmp/glassline-audit/slide-probe2.mjs   # slide with per-step trace
node /tmp/glassline-audit/slide-probe4.mjs   # block position vs lateral offset
```

Project-native checks used:

```bash
npm run typecheck && npm test
node tools/capture/capture.mjs --iteration audit --shot start-roof --no-verify-determinism
```
