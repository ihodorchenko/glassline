# Glassline — Step 3.11: Gameplay Feel Acceptance Audit

**Status:** audit complete. **No P0. 5 P1, 7 P2, 14 verified PASS areas.**
**Base:** `main` @ `4255bdd71c2476e6ca49af82f3511e1115dea50b` (verified; `origin/main` unchanged).
**Audit branch:** `feat/gameplay-feel-audit` (evidence only — no production, physics, camera, geometry or content change).
**Date:** 2026-11-23 (Europe/Minsk).
**Harness:** [`tools/capture/feel-audit.mjs`](../tools/capture/feel-audit.mjs).
**Evidence:** [`evidence/gameplay-feel/step-3.11/`](evidence/gameplay-feel/step-3.11/) (`report.json`, 14 route frames, full-route video, live mix, respawn frames, perf attribution).
**Method:** two real menu-launched Prologue playthroughs (start → FINISH → Results) driven by trusted Playwright keyboard input, plus focused probes for jump/slide/vault/wall-run/respawn/gamepad/performance. This is not a traversal test: every finding below is about what the player sees, feels or hears.

---

## 1. Verdict

The Prologue **is completable and coherent**: in the evidence run the player reached FINISH with **0 respawns**, **5/5 checkpoints**, Results at **00:33.889**, and **0 console/page errors**. Movement primitives, step-glide, wall run/jump, slides, respawn and gamepad all behave. The route reads well through the first four sections.

What currently keeps it from feeling like a finished parkour game is **not** the route — it is four things around it:

1. **The default Medium quality runs gameplay at 24–37 fps, not 60** — and the cause is a single per-frame raycast probe, not the art. This is the largest feel problem: input latency, camera smoothness and landing judgement all inherit it.
2. **The vault has a velocity discontinuity at its exit** (11.5–13.9 m/s for one fixed step against a nominal 5.1–8.1), with a 0.17 m backward snap on the standard profile.
3. **The first-person camera vertically trails the collider by up to ~1.1 m in fast falls and keeps sinking for ~0.4 s after landing** — the spec explicitly forbids large collider/camera delays (`13_CAMERA_SYSTEM_SPEC.md` §12.4).
4. **The finale's view is obstructed** by decorative massing that crosses the return catwalk and finish approach, and the finish-deck parapet ends the authored line on an unmarked 1.0 m wall with a hidden landing.

None of these is a crash or a soft-lock. All are reproducible; two of them (performance, vault) are measurable to the fixed step.

---

## 2. What was actually played

| Pass | Route | Result |
|---|---|---|
| A (exploratory) | start → FINISH, full sprint line | completed, 0 deaths, 5/5 CPs, Results |
| B (evidence, committed) | same, recorded video + live audio + 14 frames | **completed**, 0 deaths, 5/5 CPs, Results `00:33.889`, 0 errors |
| Probes | jump, slide, vault (both profiles), wall run, wall jump, stairs up/down, 0.3 m step, skylight death → respawn, gamepad, performance | see §3–§5 |

Environment: Microsoft Edge (Playwright), ANGLE Metal, Apple M1 Pro, 1600×900 dpr 1, Medium quality (default), headless. Host load average ~6 during the runs. Absolute fps is environment-sensitive; the *mechanism* and the static-vs-moving split reproduce on every run.

The harness steers the route with programmatic yaw aiming (equivalent to instant mouse look) while **all movement, jump, sprint, slide, vault and interact input is real trusted keyboard input**. Mouse look was measured separately with real deltas.

---

## 3. P1 — substantial gameplay-experience problems

### P1-1. Medium quality cannot hold 60 fps while the player moves — the ambient probe raycast costs ~35 ms/frame

| | |
|---|---|
| **Where** | Everywhere, on every route section, while translating; independent of view and quality tier |
| **Repro** | Launch the Prologue at default Medium, run forward on the open west roof (`W`, then `W+X`). `Speed 8.5 m/s`, frame rate 24–26 fps. Stand still at the same pose: 58–60 fps. Set `display.quality` to `low` or `high`: still ~26 fps. |
| **Expected** | 60 fps gameplay at the default tier on an M1 Pro (the static scene already runs at 58–60). |
| **Actual** | 25.8 fps (roof lane), 24.0 fps (corridor), 36.8 fps (catwalk); p95 40–44 ms. Static poses: 58.6–60 fps, 261 draw calls / 4.36 M triangles. |
| **Measured cause** | `RenderScene.updateAmbientProbe()` runs `probeSkyVisibility()` whenever the camera has moved > **0.08 m**. It raycasts **9 directions** against **98 collected meshes** — **35.05 ms per call, 27.3 calls/s** while running. Instrumented `renderFrame`: `renderScene.update` = **30.9 ms** moving vs **0.02 ms** idle; camera/audio/viewmodel/UI = <0.1 ms each. |
| **Confirmation** | With `probeSkyVisibility` stubbed at runtime (diagnostic only): **26.6 → 57.8 fps** (+31.2). `renderer.info` and geometry are unchanged; this is not a quality or GPU-limit issue. |
| **Evidence** | [`perf-attribution.json`](evidence/gameplay-feel/step-3.11/perf-attribution.json), `report.json → phases.perf`, frame timings in the route video/telemetry |
| **Impact** | One 60 Hz frame becomes ~2.5 render frames. Jump input lands up to ~40 ms late, camera/landing response is quantised, and the whole movement core — which is tuned for 60 Hz responsiveness — cannot be felt as authored. |
| **Confidence** | Confirmed, 3 independent measurement paths (perf phase, sub-system timings, probe stub) |

This is pre-existing (the earlier audit's Medium sprint pose was also ~38 fps), not introduced by Step 3.11.

### P1-2. Vault exit velocity spike and backward snap

| | |
|---|---|
| **Where** | The authored vault obstacle on the Prologue start roof (z ≈ −1), and every vault |
| **Repro** | Run at the 0.75 m obstacle, press `E` at ~0.5 m. Sample the model velocity per fixed step (harness `mechanics.vaultStandard/vaultSpeed`). |
| **Expected** | Scripted arc speed, then exit speed = entry × retention (0.85 standard / 0.95 speed); no position reversal |
| **Actual (standard, entry 6.0 m/s)** | `4.45 → 4.97 → 11.48 → 12.81 → 10.27 → 5.10 (FALLING) → 5.40 (LANDING)`; z `−1.44 → −1.63 → −1.84 → −1.67` — a **0.17 m backward snap** after the arc |
| **Actual (speed, entry 8.5 m/s)** | `6.84 → 6.85 → 13.91 → 8.07`; a single step covers 0.23 m |
| **Cause** | `PlayerSystem.updateScriptedVault` sets the desired translation from the arc sample; when the vault completes it snaps the target to the landing position, and `MovementModel.applyCollisionResult` writes `actualMovement / dt` back into the velocity — so the final arc sliver becomes 11.5–13.9 m/s. The same path also collapses the first vault sample to 1.55–1.66 m/s. |
| **Evidence** | `report.json` → `phases.mechanics.vaultStandard.steps`, `vaultSpeed.steps`; frame-visible in the route video at 1.0–1.3 s |
| **Impact** | Every vault reads as a short stutter, then a lurch/teleport, instead of a committed momentum transfer. On a 0.75 m wall this is the first mechanic the player uses. |
| **Confidence** | Confirmed at fixed-step resolution, both profiles, two runs |

### P1-3. Camera vertical follow trails the collider by up to ~1.1 m on falls and keeps sinking after landing

| | |
|---|---|
| **Where** | The 3.2 m drop from the start roof to the service roof; the 1.1 m drop off the finish deck; every hard landing |
| **Repro** | Sprint off the start roof's north edge; watch the camera relative to the body, or sample `camera.position.y − player.position.y` |
| **Expected** | The eye stays within a small, bounded distance of the body; a landing dip is short and bounded (~0.06 m) |
| **Actual** | Standing offset 0.725 m. During the drop it rises to **1.82 m (+1.09 m)** at the landing moment, then settles over **~0.4–0.5 s** (`1.82 → 0.93` in ~0.35 s). The first "landing dip" samples read −0.86 to −1.02 m — that is the filter catching up, not the 0.06 m impact response. |
| **Cause** | `PlayerSystem.dampFilteredY` applies an exponential low-pass with λ = 14 (τ ≈ 71 ms) to the camera Y. At 10–11 m/s fall speed the steady-state lag is ~0.75–0.8 m; the observed 1.09 m includes the acceleration phase. |
| **Spec** | `13_CAMERA_SYSTEM_SPEC.md` §12.4: "Do not introduce large position delays between the player collider and camera." |
| **Evidence** | `report.json` → `phases.route.frames` (4.2–5.2 s), `summary.cameraVerticalLag` (`maxAboveStanding: 1.09`), route video 4–5 s |
| **Impact** | On every drop the landing surface is judged from a camera that is still descending after the body has landed; the landing dip feedback (the part that should communicate impact) is buried under a second, much larger camera motion. This is a deliberate smoothing trade-off, but it currently exceeds the spec's "no large delays" rule. |
| **Confidence** | Confirmed by frame telemetry and by inspection of the filter; subjective unpleasantness needs a human pass |

### P1-4. Decorative massing intersects the finale view (return catwalk and finish approach)

| | |
|---|---|
| **Where** | Return catwalk, z = −130.8, roughly x 14–22; finish approach, z ≈ −132 |
| **Repro** | Complete the ascent, take the high catwalk U-turn, run the return leg west. At 8.5 m/s a large white decorative mass fills the centre of the screen; the finish marker is a sliver behind it. The same happens at the finish trigger. |
| **Expected** | An unobstructed line down the return catwalk and across the finish |
| **Actual** | The camera passes through/next to non-collidable white massing that cuts the screen vertically; the route is visible only left of it. Movement is unaffected (no collision), which makes it a pure visual/readability break at the climax. |
| **Evidence** | [`route/12-return.jpg`](evidence/gameplay-feel/step-3.11/route/12-return.jpg), [`route/13-finish.jpg`](evidence/gameplay-feel/step-3.11/route/13-finish.jpg), route video 22–33 s |
| **Impact** | The last ~10 s of a 34 s run — the only part a player will remember as the finish — is visually blocked. It also hides the finish gate and the route line at exactly the moment the player is sprinting at full speed. |
| **Confidence** | Confirmed visually in two runs and in the committed video |

### P1-5. The finish-deck north parapet ends the authored line on an unmarked 1.0 m wall with a hidden landing

| | |
|---|---|
| **Where** | Finish deck, z = −62.2 (parapet), beam at z = −64.5, top 1.1 m lower |
| **Repro** | Run the red line north across the finish deck. The line runs straight into a 1.0 m white parapet. Press `E` at 0.8 m: nothing (`isVaultAvailable` false — the landing is 2.3 m beyond, outside the 0.9 m landing validation). No `E · VAULT` prompt appears anywhere in the Prologue: `PrologueTestLevel` does not set `metadata.vaultAffordance`, and `Application` gates the affordance on it. |
| **Expected** | The route's final gate should be readable as a vault, a climb, or a visible drop with a clear landing |
| **Actual** | The line terminates at the wall; the beam/landing is not visible from the approach at eye height; the only way through is a running jump over the wall and across the 2.3 m gap. A standing jump with `W` did reach the beam in a probe (so this is **not** a soft-lock), but the required action is unmarked. |
| **Evidence** | [`route/07-finish-deck.jpg`](evidence/gameplay-feel/step-3.11/route/07-finish-deck.jpg); `report.json` → route trace (`parapet-E`, `parapet-jump`); `src/levels/test/PrologueArena.ts:285`, `src/app/Application.ts:978` |
| **Impact** | Every playthrough hits the only unreadable gate at the end of the route; the player must guess a blind jump over a wall. |
| **Confidence** | Confirmed geometry + missing affordance; the jump is proven passable |

---

## 4. P2 — quality improvements

| # | Finding | Evidence / numbers | Impact |
|---|---|---|---|
| P2-1 | **Tutorial/feedback arrives long after the action** — "Vault" at 12.95 s (vault at ~1.2 s), "Slide" at 14.75 s (slide at ~1.9 s), "Jump" at 16.56 s (first jump at ~5.2 s); "Move" is restored and shown 4 times as checkpoints preempt it. The Prologue's tutorial step for vaulting is event-driven (`movement.vault`), so it cannot instruct before the first vault gate. | `report.json → summary.routeToasts`; `src/tutorial/InitialTutorial.ts:25`; `src/ui/ToastQueue.ts` | Confirmation feedback becomes meaningless; a first-time player has no in-game cue for `E` at the first vault obstacle. |
| P2-2 | **Slide camera eye transition takes ~0.34–0.49 s** (0.69–0.94 m drop), so the view is still high when the capsule is already low. In the 1.35 m tunnel the camera stayed below the ceiling at the tested timings (max 0.98–1.18 m), but a slide started at the tunnel mouth has no margin left. | `report.json → mechanics.slide` (camDrop −0.69, settle 340 ms); route slide camera 1.41 → 0.69 | The slide reads as a delayed crouch rather than an immediate posture change; low-ceiling clearance is timing-dependent. |
| P2-3 | **The catwalk U-turn needs a brake in practice** — the automated pass had to release sprint at x ≈ 37 and brake into the turn; the U-turn took 3.1 s. The deck is 10 × 11 m, so a human can likely carry more speed, but there is no assisted turn and the barriers sit immediately after the apex. | route trace `turn-slow` (x 37.2), `turn-brake` (x 46.4), `turn-go`; 22.7 → 25.8 s | The finale's only technical input is a near-stop, then a sprint restart; it breaks the rhythm built by the ascent. |
| P2-4 | **Landing recovery scrubs ~2.8 m/s on every landing** — each of the 8 ascent platform landings drops 8.5 → ~5.5 m/s for the 0.18 s recovery, then re-accelerates. | `report.json → route landings` (17 landings; impact 4.9–5.3 on the ascent), stairs min speed 5.48 after the landing | The platform sequence is a series of micro-stutters; it is spec'd (0.18 s) but costs momentum on a rhythm section. |
| P2-5 | **Sprint slides always end by the 1.2 s cap, not by the 2.5 m/s threshold** — 8.35 m/s entry decays to ~3.7–5.0 m/s and the stance pops straight back to standing. | route slide 8.35 → 4.97 over 806 ms; harness 8.37 → 5.56 (released); tuning: friction 4, exit 2.5, cap 1.2 s | The slide exit is an abrupt stand-up at speed rather than a natural threshold exit; pre-existing/accepted tuning, but it is the least "finished" part of the slide. |
| P2-6 | **Tap jumps are very low** — a 90 ms tap rises **0.53 m**, a 55 ms tap **0.386 m**, against **1.13–1.25 m** held. The previous audit recorded 0.8–0.9 m for a tap; the current build is below that record (and below the 0.75 m vault wall). | `report.json → mechanics.jumpTap/jumpTapShort/jumpHold` | A quick tap barely clears a curb; players will learn to hold, which makes the variable-jump input less expressive. Confirm whether this is intended tuning. |
| P2-7 | **A 0.3 m riser at sprint scrubs 3.4 m/s in one frame** — the 0.18 m step is free, the 0.3 m step (the off-line step pair at x = 4) drops 8.50 → 5.07 m/s and re-accelerates. No airborne frames, no penetration, no stall — but it reads as a curb hit at sprint. `stepGlideSpeed` is 4.5 m/s, so the cap is doing what it was tuned to do. | `report.json → mechanics.step03.frames` (z ≈ 0.1, 8.50 → 5.07); the 0.15 m stair flight is clean (min 4.78, no step stalls) | Off the golden path, but any sprint line that clips the step pair loses ~40 % speed; a P2 tuning question for the step-glide cap. |

---

## 5. PASS — verified without a finding

| Area | What was verified | Key numbers |
|---|---|---|
| **Full Prologue** | start → FINISH → Results, one continuous run | completed, 0 respawns, 5/5 CPs, Results `00:33.889`, 0 console/page errors, 883 sampled frames, 13 jumps, 17 landings |
| **Acceleration / braking** | open roof, run → sprint → release | 0 → 6 m/s in ~0.33 s, 6 → 8.5 in ~0.55 s total; release to stop ~0.53 s; peak exactly 8.50; no jitter |
| **Jump (held)** | sprint jump | rise 1.13–1.25 m (design 1.25); tap/hold separation works |
| **Wall run** | authored corridor, north approach | 0.62–0.75 s of `WALLRUN`, 8.48 → 7.87 m/s, camera roll 0.06 rad (3.4°), no snap |
| **Wall jump** | `Space` out of a wall run | rise 0.86 m, outward 2.45 m, LANDING → running, no stuck state |
| **Step-glide / collision safety** | 15 × 0.15 m stair flight up at sprint and down at run; 0.3 m step at sprint | 0 airborne frames on the stairs up and down; stair flight min 4.78 m/s with no per-step stalls (the only >2 m/s drop is the 0.18 s landing recovery at the entry). The 0.3 m riser is safe (0 airborne, 0 penetration) but scrubs 8.50 → 5.07 m/s — P2-7 |
| **Slide + steering** | sprint slide on open roof; slide + `D` | entry 8.37, exit 5.56–5.63; lateral bend +1.32–1.38 m; speed never increases; no collision loss |
| **Vault triggering/profiles** | both profiles, threshold split | standard 453 ms / speed 254 ms at the correct entry speeds (the *exit* is P1-2, not the trigger) |
| **Respawn** | real kill-volume fall into the skylight; checkpoint respawn | respawn at `cp_rooftop` (0, 0.93, 3); **0.000 m / 0.00 m/s phantom step** across 90 instrumented fixed steps; camera snaps 8.8 m instantly (no fly); control returns at 6 m/s on the first `W` press |
| **Gamepad** | mocked standard mapping through `navigator.getGamepads` (the real polling path) | 9/9: left stick, sprint button, jump, right-stick look, crouch, interact-vault, disconnect clears input, keyboard after gamepad, pause → pause screen |
| **Input plumbing** | simultaneous keys, focus loss, mouse sensitivity | `W+X+Shift+Space` all held; `blur` clears held keys; mouse 0.0022 rad/px (120 px → 0.264 rad) |
| **Audio during the run** | live master mix recorded for the whole run | continuous 0–32 s, median 50 ms RMS 0.036, peak 0.687 (−3.25 dBFS), no clipping, no dropouts; silence only after Results (32.05–41.2 s) |
| **Camera stability** | route + wall run | horizon roll within ±0.011 rad (±0.65°) in the run; wall-run roll 0.06 rad; sprint FOV 75 → 82 and back; no unintended shake |
| **UI flow** | checkpoints, toasts, Results | 5/5 checkpoints in order, one toast slot, Results screen free of HUD/prompt, `RETRY`/`MAIN MENU` |

---

## 6. Mandatory checks from the brief

| Required check | Result |
|---|---|
| Collision safety at step-glide | **PASS with P2** — 0.15 m stairs up/down at sprint: 0 airborne frames, no per-step stalls; the 0.3 m riser at sprint is safe (no airborne, no penetration) but scrubs 8.5 → 5.1 m/s (P2-7). The one backward motion observed at the stairs came from a harness steering error, not the game. |
| GF-ISSUE-14 (teleport/respawn phantom step) | **Not reproduced** — 0.000 m displacement / 0.00 m/s over the 90 fixed steps after a real respawn; the recorded 0.21 m / 12 m/s symptom did not appear in this build/path (initial-spawn and checkpoint respawns) |
| Camera and audio in a real run | **Camera:** P1-3 (vertical lag) + PASS (horizon/roll/FOV). **Audio:** PASS (continuous, no clipping/dropouts; silence only after Results) |
| Gamepad | **PASS** (9/9) |
| Full Prologue start → FINISH | **PASS** (0 deaths, 5/5 CPs, Results) |
| Medium FPS | **FAIL** — P1-1 (24–37 fps while moving; the ambient probe is the cause) |

---

## 7. Recommendation for the next step

Ordered by feel-per-fix; **no implementation was performed** (per the brief):

1. **Fix the ambient-probe cost first** (P1-1). It is the single multiplier on every other feel problem: throttle the sky-visibility probe (time or a much larger distance threshold), and/or replace the 9 × 98-mesh render raycast with a cheap ceiling query against physics colliders or a cached proxy. Target < 1 ms/frame and re-measure the moving route at Medium until it holds 58–60 fps.
2. **Fix the vault velocity reconciliation** (P1-2). The scripted arc must not write its final sliver into the model velocity; add a fixed-step regression asserting monotonic position and exit speed = entry × retention.
3. **Bound the camera's vertical follow** (P1-3). Keep the anti-jitter smoothing, but cap the lag (or snap on landing) so the eye never trails by ~1 m and the real landing dip is not buried. Re-check §12.4.
4. **Clear the finale** (P1-4/P1-5): move the decorative massing off the return catwalk/finish approach, and make the finish-deck parapet readable (enable the Prologue vault affordance and author the beam/landing cue, or replace the wall with a vaultable, visible ledge).
5. **Then** the P2 group: toast/tutorial timing, slide camera transition, U-turn line, landing recovery, sprint-slide exit, tap-jump tuning — one controlled tuning group at a time, with the same scenario set.

---

## 8. Reproduce

```bash
# Full evidence run (route + mechanics + respawn + gamepad + perf; ~3 min)
node tools/capture/feel-audit.mjs --out-dir docs/evidence/gameplay-feel/step-3.11

# Individual phases
node tools/capture/feel-audit.mjs --only perf --no-video --no-audio
node tools/capture/feel-audit.mjs --only route --headed

# The committed numbers in this report
docs/evidence/gameplay-feel/step-3.11/report.json
docs/evidence/gameplay-feel/step-3.11/perf-attribution.json
```

Evidence index: [`docs/evidence/gameplay-feel/step-3.11/README.md`](evidence/gameplay-feel/step-3.11/README.md).

**Not changed:** physics, camera tuning, level geometry, authored content, architecture, production UI/audio. The only source addition is the DEV-only harness; nothing it does runs in production. No merge was performed.
