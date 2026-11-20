# GAMEPLAY_FEEL_AUDIT_REPORT.md

Project: Glassline
Document: Gameplay Feel Audit Report (Phase 0 — Baseline Audit)
Status: Active
Priority: High
Date: 2026-11-20
Companion: `docs/GAMEPLAY_FEEL_BASELINE.md` (inventory, tuning values, scenario records, repro)

> **Methodology note:** `docs/GAMEPLAY_FEEL_AUDIT.md` was rewritten during this
> audit into a compact evaluation contract (phases A–F per change, scenario
> table GF-01…GF-18 matching this report's numbering, new severity ladder,
> per-issue evaluation records). This report follows the rewritten document.
> Group 1 of the improvement plan (approved by the owner) is implemented and
> verified; GF-ISSUE-01 and GF-ISSUE-06 are **Fixed**.

---

## 1. Executive Summary

Glassline's movement core is **functional, spec-faithful in its structure, and
measurably responsive**: ground movement, sprint, look input, jumping,
buffering, coyote time, landing momentum, crouch/ceiling handling, vault
detection, wall running, wall jumping, restart and checkpoint respawn all
behaved correctly at runtime (GF-01…GF-18 executed; results in the Baseline).

Three areas need attention before gameplay-feel work can proceed:

1. **One confirmed, reproducible core-mechanic bug**: slides intermittently
   die mid-slide (velocity → ~0 in a single physics step) — observed at runtime
   and reproduced deterministically in a scripted probe (GF-ISSUE-01).
2. **Two specification deviations in traversal**: vaulting has a single
   profile instead of the required Standard/Speed pair (GF-ISSUE-02), and
   wall-run eligibility ignores level-authored surface metadata
   (GF-ISSUE-03).
3. **Presentation gaps**: landing camera response is not impact-proportional
   (GF-ISSUE-05), wall-jump landings emit no landing event (GF-ISSUE-06), and
   slides have no steering (GF-ISSUE-04).

The audit window overlapped with active owner edits to the movement code (the
tree changed repeatedly; part was committed as `aeb7625` "fix fizics"). The
final state at audit end passes **377/377 tests**, typecheck, and (with the
audit's scratch files removed) Biome. All findings below were re-verified
against the final committed code and are hash/timestamp-pinned in the Baseline.

**Phase 0 decision: baseline recorded. No tuning changes made. Proceed to
approval of the improvement plan (Section 8) before Phase 1 work.**

---

## 2. Confirmed Bugs

### GF-ISSUE-01 — Slide velocity-kill (mid-slide full stop)

| Field | Value |
|---|---|
| Severity | **High** |
| Affected mechanic | Sliding |
| Affected system | Movement (PlayerSystem character-controller integration, `KinematicCharacterController` config) |
| Description | During a slide, horizontal speed suddenly drops from ~7–8 m/s to ~0.3 m/s in one fixed step with zero controller movement; the slide then exits at near-standstill. Occurred 3× at runtime (GF-10, GF-17) and reproducibly in a scripted probe. The kill point is position-dependent and non-geometric: with no collider at the block location, shifting the run by 1 mm moved the kill point from z≈2.61 to z≈-0.08. |
| Reproduction | `node /tmp/glassline-audit/slide-probe2.mjs` (slide dies at step 44/45) and `slide-probe4.mjs` (kill point moves with 1 mm lateral offset); or GF-10 of the eval harness: sprint to 8.5 m/s, hold Shift, observe speed crater. |
| Expected | Slide decelerates smoothly at ~2 m/s² and exits at the 2.5 m/s threshold (~0.8–1.2 s at sprint entry). |
| Actual | Velocity killed to ~0 in one step; slide ends in 0.3–0.75 s at standstill. |
| Root cause (current hypothesis) | Interaction of Rapier's `KinematicCharacterController` features enabled for the new ground-stick work: `enableSnapToGround(1.0)` + autostep with downcast + `setSlideEnabled(true)` against the shortened slide capsule (half-height 0.15). Probe variants: with snap-to-ground off the crash no longer reproduced but the slide ended early at ~19 steps; with `setSlideEnabled(false)` it ended after ~5 steps. The controller refuses horizontal movement while reporting grounded on both sides of the step. Needs a focused Rapier-level repro (minimal world, no game code) to separate engine behavior from configuration. |
| Supporting evidence | `/tmp/glassline-rt/gf10.json`, `slide-probe2/4` traces; no collider within the block volume (runtime collider sweep). |
| Recommended correction | Bisect controller features in a minimal Rapier world; then adjust `PlayerSystem` configuration (snap distance, autostep, slide flag, or the -0.5 m/s slide ground bias) and re-verify GF-10/GF-17 plus the stair tests. |
| Regression risk | Changes to controller config affect stairs/ledges (ground-stick tests), wall collisions, and slide-under-tunnel clearance — rerun the full player-physics, traversal-detection and prologue-traversal suites plus GF-09/GF-10 runtime checks. |

### GF-ISSUE-13 — Jerky stair ascent (bumping into step edges) — ✅ FIXED (post-Group-6, owner report)

| Field | Value |
|---|---|
| Severity | Medium (core traversal feel) |
| Affected mechanic | Stair ascent (step-glide riser climb) |
| Affected system | Movement (PlayerSystem.computeStepGlide, collision reconciliation) |
| Description | Walking UP the prologue's 0.15 m stair flight felt like bumping into each step: measured speed sawtooth 0.2–0.5 ↔ 4.5 m/s with 11–12 near-stall steps; in the deterministic test world the minimum climb speed was **0.054 m/s**. Descent was already smooth (ground-stick ride). |
| Root cause (confirmed, two mechanisms) | 1) The step-glide's final sliver step reconciled velocity against the tiny remaining travel (≈1 m/s collapse **on every riser**). 2) The riser face probe ray started at the capsule's FRONT surface: when the capsule was already touching the riser, the ray could start on/inside the face and miss it entirely → the controller ground into the step for several frames. |
| Change made | 1) Glide steps now feed the collision result with the model's commanded horizontal momentum (the glide is kinematic by construction; only the actual vertical lift is taken from the movement). 2) The face probe now casts from the capsule center at two heights (feet+0.04 / feet+0.12), taking the nearest hit. No tuning constants changed. |
| Verification after | Deterministic stair regression test: min climb speed **> 3 m/s** (was 0.054 on pre-fix HEAD), no single-step drop ≥ 2 m/s, zero stall steps; runtime probe: run speed holds exactly 6.0 m/s through the flight, sprint holds 8.5; descent unchanged (0 airborne steps). Full suite 402/402. |
| Regression risk | The probe runs every grounded step (two short raycasts) — negligible cost; the stairs/step/ramp tests and the prologue route tests all pass. |

### GF-ISSUE-14 — Phantom step after teleport/respawn (known, not fixed)

- Severity: Low. Affected: Respawn/teleport. System: Movement (controller state).
- Description: the first fixed step after `teleportTo` can produce a ~0.21 m
  phantom horizontal movement with a zero command, inflating the model
  velocity to ~12 m/s for ~0.7 s (decays at ground deceleration). Observed
  only right after teleports/respawns; pre-existing, unrelated to the stair
  work.
- Recommendation: investigate the controller's internal state flush after
  teleport (e.g. a zero-command warm-up compute before gameplay resumes);
  low priority — one step and a brief speed inflation on respawn.

### GF-ISSUE-12 — Level reload leaked static-batch geometries — ✅ FIXED (Group 6)

| Field | Value |
|---|---|
| Severity | Medium (resource accumulation, GF-18) |
| Affected | Level lifecycle / rendering |
| Description | Each route restart leaked the merged static-batch `BufferGeometry` objects: measured +8 geometries per restart (57 → 65 → 73 → 81 over three cycles) while bodies/colliders/textures/programs stayed constant. |
| Root cause | `LevelContentLoader.dispose` removed static-batch meshes from the scene but never disposed their merged geometry. |
| Change made | `mesh.geometry.dispose()` in the unload loop. |
| Verification after | Resource probe across 3 restarts: geometries constant at 57; full suite 401/401. |

### GF-ISSUE-06 — Wall-jump landing emits no `player:landed` event — ✅ FIXED (Group 1.3)

| Field | Value |
|---|---|
| Severity | Medium |
| Affected mechanic | Wall jumping / landing feedback |
| Affected system | Movement (MovementModel event bookkeeping) |
| Description | `applyCollisionResult` emitted the landing event only when the pre-landing state was `JUMPING` or `FALLING`; a `WALLJUMP` touchdown went silent (no audio/camera/statistics landing). |
| Change made | The `wasAirborne` predicate now includes `WALLJUMP` (vault-origin falls already land via FALLING). |
| Verification after | Unit regression test (wall jump → touchdown → `landed` event, fails on pre-fix HEAD); runtime GF-16 re-run shows LANDING state with the standard 0.18 s recovery after a wall jump. |
| Regression risk | Low — events only; statistics/audio consumers already handle landings from other states. |

---

## 3. Gameplay Feel Weaknesses

### GF-ISSUE-11 — Vault interact press had no buffering — ✅ FIXED (Group 3.1)

- Severity: Medium. Affected: Vault activation responsiveness. System: Movement/Input.
- Description: `interactPressed` lived for a single frame; an E press even
  slightly before the obstacle entered detection range (1.1 m ≈ 0.13 s at
  sprint speed) was lost and the vault never fired. `03_GAMEPLAY_SPEC.md` §5.3
  explicitly requires buffering for "context interaction pressed just before
  entering a valid interaction range".
- Change made: `MovementModel` arms `interactBufferSeconds`
  (`vaultInteractBufferSeconds: 0.15`) on `interactPressed`; `beginVault`
  consumes the buffered press once a candidate and the speed gate are valid,
  and the buffer expires naturally.
- Verification after: 2 unit tests (buffer fires / expires); runtime GF-12:
  E press 0.073 s before the candidate window now starts the vault reliably.

### GF-ISSUE-04 — Slides have no steering — ✅ FIXED (Group 2.2)

- Severity: Medium. Affected: Sliding. System: Movement.
- Description (before): while sliding, the model moved velocity toward
  **zero** (`sliding ? 0 : target`), so directional input had no effect at
  all. `12_MOVEMENT_SYSTEM_SPEC.md` §13.3 requires "limited directional
  control" with a configurable steering amount.
- Change made: new `MovementModel.updateSlideMovement` — `slideFriction`
  decays the speed magnitude while the velocity bends toward the current
  input direction at the new tuning value `slideSteeringAcceleration`
  (default 6 m/s², a third of ground acceleration; centralized in
  `MovementTuning` per `12` §23). The target magnitude never exceeds the
  decayed speed, so steering cannot add speed; without input the direction is
  preserved and the straight-slide decay is bit-identical to before.
- Verification after: unit tests (exact straight decay = friction·dt;
  lateral input bends the velocity without gaining speed); runtime probe with
  the real input path (slide + D strafe: x drift +2.76 m across the slide,
  speed only decayed); GF-10/GF-11 re-runs unchanged (1.2 s cap, exit-by-
  release, slide jump). Full suite 387/387.
- Regression risk: low — the straight-line path is mathematically unchanged;
  guarded by the exact-decay test.

### GF-ISSUE-05 — Landing camera response ignores impact intensity — ✅ FIXED (Group 4.1)

- Severity: Medium (feedback). Affected: Landing camera. System: Camera/Movement.
- Description (before): `LANDING_DIP_METERS = 0.06` and the roll amplitude were
  constants — a 0.5 m hop and a 15 m/s fall produced identical camera response.
  `13_CAMERA_SYSTEM_SPEC.md` §11.6 requires proportionality to vertical impact
  speed; the rewritten audit doc's GF-08 explicitly expects "distinct,
  proportional landing response".
- Change made: `MovementModelSnapshot.landingImpactSpeed` (authoritative
  movement data, spec `12` §19.1 `landingImpact`); `CameraSystem` captures it
  at the landing onset and scales dip/roll by
  `0.3 + 0.7 · clamp(impact / 10 m/s, 0, 1)` — soft landings keep a subtle
  response, hard falls reach the full 0.06 m dip. Half-sine recovery, sign
  logic and Reduced Motion behavior unchanged.
- Verification after: camera unit tests (soft vs hard proportionality,
  mid-recovery peak, motion-intensity zeroing); runtime probe: impact 2 m/s →
  0.026 m dip, impact 12 m/s → 0.060 m dip. Human calibration remains for
  Group 6 (project-wide "untuned by human" caveat).
- Regression risk: low; landing onset capture is guarded by the recovery
  window so consecutive landings re-capture correctly.

### GF-ISSUE-09 — Jump-release grace window was unstable during the window

- Severity: Low (resolved-in-flight). Affected: Variable jump. System: Movement.
- Description: three different cut semantics existed within ~20 minutes
  (grace 2 frames + `vy*ratio`; a broken `jumpAgeSteps` version that never cut
  — tapped and held jumps identical at 1.071 m; final `airborneStepsSinceJump >= 2`
  cut). The final committed semantics pass all tests.
- Recommended: freeze the semantics with a regression test that locks the exact
  grace boundary (already exists), and do a human tap-vs-hold check once the
  tree is stable.

### GF-ISSUE-10 — Press+release inside one render frame can be lost — ✅ FIXED (Group 2.1)

- Severity: Low. Affected: Input responsiveness. System: Input.
- Description (before): pressed/released edges were derived per rendered
  frame from the held-keys set; a tap that begins and ends between two
  frames never appeared in any frame (window ≈16.7 ms at 60 fps, larger on
  stuttering frames). The spec requires one-shot events not be lost
  (`11` §14.4).
- Change made: `InputManager` now keeps a `pendingPresses` set (non-repeat
  keydowns since the last frame build, cleared on focus loss/disable);
  `InputActionResolver` maps pending key codes to `pressedActions` per
  context, and `InputFrameBuilder` ORs them into the `pressed` edge. Edges
  stay one-shot; auto-repeat keydowns are excluded; menu contexts benefit
  identically (Space = Confirm).
- Verification after: 3 unit tests (within-frame tap preserved, no duplicate
  edges, context gating); full suite 387/387; runtime scenarios unaffected.
- Regression risk: low — adds edges only where none existed; focus-loss
  clearing prevents stale presses.

---

## 4. Specification Deviations

| ID | Deviation | Spec | Severity | Evidence |
|---|---|---|---|---|
| GF-ISSUE-02 | Vaulting implements a single profile (fixed 0.45 s, arc lift 0.25); no Standard/Speed distinction, no speed-based selection, no minimum approach speed, and `player:vault-started` carries `{speed}` instead of the vault type | `12` §14.4 (two profiles + deterministic selection + type in event), `03` §10.4 | **High** (explicit "must" in spec) — **FIXED (Group 3.1)** | Two profiles with tuning values (`vaultMinEntrySpeed 2.5`, `vaultSpeedMinEntrySpeed 6`, `vaultSpeedDurationSeconds 0.3`, per-profile retention 0.85/0.95); event carries `vaultType`; plus the spec-mandated interact buffer (`vaultInteractBufferSeconds 0.15`, GF-ISSUE-11). 6 model tests + physics event test |
| GF-ISSUE-03 | Wall-run eligibility ignores `wallRunSurface`/`wallJumpSurface` surface metadata authored in the level; any near-vertical collider within 0.75 m qualifies (including `surface_boundary` walls marked not wall-runnable) | `12` §15.2 ("correct collision category or metadata"), `12` §22 (surface metadata) | **Medium** — **FIXED (Group 3.2)** | `WallRunDetectorOptions.isWallRunnable` gate at the hit point; `PlayerSystemOptions.isWallRunnable`; Application resolves via new `SurfaceRegistry.getSurfaceContaining`. Detector + physics tests; runtime: corridor wall still runnable, boundary parapet no longer triggers wall runs |
| GF-ISSUE-07 | Vault traversal bypasses collision: the body is moved by direct `setNextKinematicTranslation` along the scripted arc for 0.45 s without controller/collision checks and without cancellation if the destination becomes invalid | `12` §14.6 (fail safely / cancel), `03` §10.5 ("must remain integrated with physics and collision validation") | **Medium** — **FIXED (Group 3.3)** | The scripted arc now moves through `computeColliderMovement` (snap-to-ground suspended for the traversal, restored after); the arc lift is clearance-aware so the capsule sweeps over the obstacle instead of through it. `intersectionPair`-based penetration regression test |
| GF-ISSUE-08 | Camera spec defines a sprint-FOV intensity setting and dynamic-FOV toggle; the Settings registry (`25` §B.1.3) has no such keys — sprint FOV is hard-coded to base+7 | `13` §9.6 vs `25` settings registry | **Low** — **FIXED (Group 4.2)** | New `camera.sprint_fov_intensity` (default 1, range 0–2) in `SettingsDefinitions`; `CameraSettingsAdapter` derives `sprintFov = base + 7 · intensity` (0 = dynamic FOV off); UI label + EN/RU localization; settings + adapter tests; runtime: 75/82/89° at 0/1/2 |
| — | Jump tuning at audit end (height 1.6 m, min ratio 0.6) differs from `12` §6.2 suggested values (1.25 m) — permitted ("starting points", §17.2 forbids blind application; values must be justified by playtest) | `12` §6.2 note | Info | `MovementTuning.ts` |

---

## 5. Missing Tests

(Details and file names in Baseline §4.)

1. Landing horizontal-momentum preservation assertion (runtime-verified only).
2. Vault profile selection + vault-type event payload (blocked by GF-ISSUE-02).
3. Wall-run metadata gating (blocked by GF-ISSUE-03).
4. Wall-jump landing event (blocked by GF-ISSUE-06).
5. Slide steering (blocked by GF-ISSUE-04).
6. Movement outcome comparison at 30/60/120 Hz and unstable frame rates (`12` §31.4).
7. Slide velocity-kill regression test once GF-ISSUE-01 is fixed (scripted probe exists — promote it to a unit test).
8. Remove `tests/unit/tmp-debug.test.ts` (untracked scratch with console.log).
9. Input within-frame tap loss test (GF-ISSUE-10).

---

## 6. Improvement Opportunities (non-blocking)

- Landing dip/roll impact scaling (GF-ISSUE-05) — also the "untuned by human"
  item from IMPLEMENTATION_STATUS.
- Sprint FOV intensity as a settings key (GF-ISSUE-08), defaulting to +7.
- Wall-run camera roll is subtle (3.4° of an 8° budget) — a human pass may
  justify a small increase for readability; do not change before Phase 3.
- Slide surface audio: slide loop exists; a brief whoosh on entry/exit is a
  polish item after the kill bug is fixed.
- A `speed-vault`-style momentum bonus could later compensate the single
  profile (after GF-ISSUE-02 is decided) — but no new mechanics without
  approval (audit rule 8).
- Ground-stick currently applies only to forward walk-offs; evaluate
  side/backward walk-offs during Phase 1 playtesting (no change yet).

---

## 7. Performance and Stability Findings

- Fixed 60 Hz step kept 1.00× realtime across the whole suite; the 5-step
  catch-up clamp worked (no spiral-of-death), dropped time accumulated only
  across deliberate stalls (teleports/evaluate pauses).
- No console or page errors in any scenario run or in the deterministic
  capture; capture tool reports 196 draw calls / 4.18 M triangles at the
  start-roof pose with quality high (0 errors).
- Environment-limited fps (≈44.6 avg / 37.7 ms p95 / 47 ms max on headless
  SwiftShader at 1600×900). The project's own baseline has the same caveat;
  real-GPU/vsync verification remains open (project-known).
- No per-frame allocation hotspots were identified by inspection in the
  movement/camera/input paths (reused scratch vectors, no per-step object
  churn beyond the movement snapshot; the snapshot allocates one velocity copy
  per step — acceptable, but a candidate for a reusable buffer if profiling on
  real hardware ever shows GC pressure).

---

## 8. Recommended Improvement Plan (prioritized)

Order respects the audit methodology (no tuning without baseline approval,
one parameter group at a time). Groups are sequenced; within a group items are
in dependency order.

### Group 1 — Critical correctness issues — ✅ DONE (2026-11-20, evening pass)

| # | Change | Status |
|---|---|---|
| 1.1 | Fix the slide velocity-kill (GF-ISSUE-01): minimal Rapier bisect isolated the cause (snap-to-ground × grounded-slide downward bias); bias removed in `MovementModel` | **Done** — verified by unit regressions (fail on pre-fix HEAD, pass on fixed tree) and runtime GF-10/11/17 |
| 1.2 | Regression tests for the kill; debug leftovers | **Done** — 3 regression tests added; `tmp-debug.test.ts` was removed by the owner (`aeb7625` era) |
| 1.3 | Emit `player:landed` for WALLJUMP landings (GF-ISSUE-06) + unit test | **Done** — verified by unit regression and runtime GF-16 |

### Group 2 — Core movement responsiveness — ✅ DONE (2026-11-20)

| # | Change | Status |
|---|---|---|
| 2.1 | Input edge queue for within-frame taps (GF-ISSUE-10) + tests | **Done** — `pendingPresses` → `pressedActions` → `pressed` edge; 3 unit tests |
| 2.2 | Slide steering at a configurable rate (GF-ISSUE-04) + tests | **Done** — `slideSteeringAcceleration: 6` in `MovementTuning`; 2 unit tests + runtime steering probe |
| 2.3 | Variable-jump grace semantics | Already frozen by the owner (`aeb7625` era, committed with tests); human tap-vs-hold check remains for Group 6 |

### Group 3 — Momentum and traversal consistency — ✅ DONE (2026-11-20)

| # | Change | Status |
|---|---|---|
| 3.1 | Standard/Speed vault profiles, min entry speed, vault type in `player:vault-started`, per-profile momentum retention, interact buffering (GF-ISSUE-02, GF-ISSUE-11) | **Done** — 6 model tests + physics event test; runtime GF-12: buffered E press → speed vault 0.28 s, lands past the obstacle |
| 3.2 | Wall-run eligibility gated by `wallRunSurface` metadata (GF-ISSUE-03) | **Done** — detector + physics tests; runtime: corridor wall runnable, boundary parapet rejected |
| 3.3 | Vault traversal through the character controller + clearance-aware arc (GF-ISSUE-07) | **Done** — `intersectionPair` penetration regression test; runtime GF-12 clean |

### Group 4 — Camera and feedback — ✅ DONE (2026-11-20)

| # | Change | Status |
|---|---|---|
| 4.1 | Impact-scaled landing dip/roll (GF-ISSUE-05) + unit tests | **Done** — `landingImpactSpeed` in the movement snapshot, camera scales dip/roll by the clamped impact factor; runtime 0.026 m (2 m/s) vs 0.060 m (12 m/s) |
| 4.2 | Sprint-FOV intensity setting (GF-ISSUE-08) | **Done** — `camera.sprint_fov_intensity` through Settings → adapter → camera; UI + EN/RU; runtime 75/82/89° at 0/1/2 |
| 4.3 | Human pass over bob/roll/dip intensities | Deferred (needs real hardware + human verdict) — tracked for Group 6 |

### Group 5 — Performance

| # | Change | Benefit | Risk |
|---|---|---|---|
| 5.1 | Real-GPU/vsync performance run (project-known gap) using the capture/metrics tooling | Validates the 60 fps budget outside SwiftShader | — |
| 5.2 | Only if 5.1 shows pressure: reuse buffers for per-step snapshot copies; profile physics-step cost | Headroom | Premature otherwise |

### Group 6 — Fine tuning and polish (Phase E, only after 1–4)

| # | Change | Benefit | Risk |
|---|---|---|---|
| 6.1 | One-at-a-time tuning groups per `GAMEPLAY_FEEL_AUDIT.md` §12: ground accel/decel → sprint → jump grace/coyote → slide friction → wall-run duration | Justified-by-measurement values | Each change needs the GF scenario set + regression matrix |
| 6.2 | Evaluate ground-stick for side/back walk-offs | Stair/ledge consistency | Changes descent feel; test on stairs tests |
| 6.3 | Slide entry/exit audio polish | Flow readability | Low |

---

## 8.5. Group 6 — Fine tuning evaluation records (this environment)

Per the controlled tuning process (`GAMEPLAY_FEEL_AUDIT.md` §12), each tuning
group was measured against its spec targets on this environment before any
change. Records use the §12.3 format.

### Tuning group evaluation table (measured, no change unless justified)

| Group | Measured (this env) | Spec target | Decision |
|---|---|---|---|
| Ground accel/decel (18/14) | 0→6 m/s in ~0.33 s sim; stop ~0.43 s; smooth, no jolt | 18/14 (suggested) | No change — measured behavior matches the targets |
| Sprint (8.5 m/s, X) | SPRINTING immediate, peak 8.50, exit settles to 6.0–6.1 | 8.5 | No change |
| Jump grace/coyote (0.12/0.14 s) | Buffer executes on touchdown; coyote jump after edge ✓ | 0.12/0.14 | No change |
| Jump height 1.6 / min ratio 0.6 (owner-tuned) | Held rise ≈1.4–1.6 m; tap rise ≈0.8–0.9 m (≥ the 0.45 m minimum) | 1.25 suggested; 0.45 min | No change — owner values are deliberate; tap stays above the minimum |
| Wall-run duration (1.5 s max, decay 1) | 0.5–0.65 s wall runs; ends by contact/duration cleanly | 1.5 max | No change |
| **Slide friction** | **2.0: every entry ≥5 m/s hit the 1.2 s max-duration cap (5.93 m/s entry exited the cap at 3.57 m/s, never at the 2.5 m/s threshold) — duration never emerged from friction, violating `12` §6.3** | 2.0 suggested; duration "primarily emerges from velocity and friction"; exit threshold 2.5 | **Changed 2 → 4 (see record below)** |

### Change record — slideFriction 2.0 → 4.0

| Field | Value |
|---|---|
| Previous value | 2.0 m/s² |
| New value | 4.0 m/s² (single parameter, `MovementTuning`) |
| Reason | With friction 2, 1.2 s of decay removes only 2.4 m/s — every valid entry (≥5 m/s) hit the max-duration cap and exited at ~3.6 m/s, so duration was determined solely by the cap. Spec `12` §6.3 requires duration to primarily emerge from velocity and friction. |
| Expected effect | Run-speed slides (≈6 m/s) exit naturally at the 2.5 m/s threshold inside the 0.8–1.2 s target band; sprint slides still use the cap as the safety maximum. |
| Test scenario | GF-10 (low + high entry), GF-11, GF-17, full suite. |
| Actual result | Low entry 5.93 m/s → 0.86 s slide, **exit 2.46 m/s (natural threshold exit)**, decay 4.02 m/s² per step. High entry 8.43 m/s → 1.14 s (cap), exit 3.70 m/s. GF-11 release-exit 6.57 m/s, slide-jump intact; GF-17 sequence clean. |
| Regression result | 401/401 tests; no route/timing test uses slides (verified); tunnel passage unaffected (sprint slide still covers >10 m). |

### GF-10 low-speed entry — closed

Measured at 5.93 m/s entry (friction 4): slide starts immediately, decays at
exactly 4.02 m/s², exits at the 2.5 m/s threshold after 0.86 s — predictable
and within the spec duration target.

### GF-11 slide exit on slope — closed (unit-level)

The arena has no slope geometry (the ramp work in `ba9e477` is controller
handling; level ramps are not authored), so the scenario was closed with a
deterministic physics test: a 35° ramp, backward downhill input into a slide —
the slide runs the descent, no single-step velocity kill, and exits to
RUNNING grounded at the ramp bottom. Level-side verification remains for
when slope geometry is authored.

### GF-18 repeated route→restart — closed, leak found and fixed (GF-ISSUE-12)

- Measurement (before fix): engine resources across 3 route restarts —
  bodies 89/89/89/89 ✓, colliders 89 ✓, textures 48 ✓, programs 34 ✓, HUD
  nodes 14 ✓, **geometries 57 → 65 → 73 → 81 (+8 per restart)**.
- Root cause: `LevelContentLoader.dispose` removed the static-batch meshes
  from the scene but never disposed their merged `BufferGeometry`.
- Fix: `mesh.geometry.dispose()` in the unload loop.
- After: geometries stay 57 across all cycles. New issue: GF-ISSUE-12 (fixed).

### 6.2 Ground-stick side/back walk-offs — evaluated, no change

Measured at the step geometry (0.3 m riser): forward, backward and strafe
walk-offs all ride down with **zero airborne steps** — the controller's
snap-to-ground keeps the capsule glued in every direction, so the model-level
forward-only stick arming produces no observable asymmetry on supported step
heights. Beyond snap range (the pit) all directions fall into the kill volume
as intended. **Recommendation: keep the current behavior** — the asymmetry
only exists in model state and only matters beyond snap range, where falling
is the intended outcome.

### 6.3 Slide entry/exit audio polish — blocked

Requires a human listening pass; the slide loop is already event-driven
(start/stop on authoritative state). Deferred to the human audio pass.

## 8.6. Group 5 — Real-GPU performance (this Mac, M1 Pro / ANGLE Metal)

The environment has a real GPU: headless Chromium defaults to SwiftShader,
but with ANGLE/Metal flags (and in a headed window) the game renders on
**"ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro)"**. A headed run at
1600×900, DPR 1, sprint pose (worst-case scene exposure), 4 s windows per
quality tier:

| Tier | Draw calls | Triangles | Avg frame | p95 frame | Max frame | FPS |
|---|---:|---:|---:|---:|---:|---:|
| low | 204 | 4 178 340 | 10.9 ms | 11.9 ms | 53.2 ms | **91.8** |
| medium (default) | 486 | 8 853 758 | ~26 ms | ~42 ms | 227.8 ms | **≈38** |
| high | 462 | 8 844 142 | 19.7 ms | 22.0 ms | 24.3 ms | **50.7** |

Physics: 0.065 ms average fixed step (1.3 ms max) — negligible against the
frame budget; the simulation kept 1.00× realtime throughout. JS heap
59–65 MB, stable across the session. The 200+ ms max frames are
boot/shader-warm-up spikes (first frames after level load), not recurring.

Findings:

1. **The default medium tier does not hold 60 fps on the M1 Pro** in the
   sprint pose (~38 fps, p95 ≈42 ms): ~486 draw calls and ~8.8 M triangles
   (beveled/triplanar geometry + GTAO) are the budget consumers. This
   matches the direction of `PERFORMANCE_BASELINE.md` next-targets (merge
   static geometry by material, reduce shadow casters, 2048 shadows on
   low-power tiers).
2. The **low tier easily clears 60 fps** (91.8 fps) with half the workload —
   a viable fallback for weaker machines; medium needs the planned
   geometry/pass optimization or a rebalanced medium tier.
3. The medium/high ordering anomaly (high faster than medium in the sweep)
   is likely a warm-up/cache ordering artifact of the sweep; both tiers sit
   in the 38–51 fps band. A re-run with counterbalanced ordering and the
   capture tool's deterministic poses is recommended before tier rebalancing.
4. Physics, input and the game loop show no performance regressions from the
   feel work: step cost 0.065 ms, catch-up clamp healthy, heap stable.

Recommendation: keep Group 5 open as a recorded baseline; tier rebalancing
or the geometry-merge optimization is a separate scope decision for the
owner (per audit rules, performance optimization beyond measurement was not
performed).

## 9. Acceptance Assessment (per the rewritten audit methodology)

The rewritten `GAMEPLAY_FEEL_AUDIT.md` evaluates each feel change through its
own phases (baseline → isolate → hypothesis → controlled change → verify →
record/regress); there is no longer a single final acceptance gate, but the
same bar applies per change. Group 1 was executed under that workflow and each
change met it: reproducible baseline, confirmed cause, smallest controlled
change, scenario verification, regression tests, honest reporting.

Still open before the audit can converge on "no critical or high issues":

- No open GF-ISSUE items from the baseline remain: all confirmed issues and
  spec deviations (GF-ISSUE-01…08, 10, 11) are fixed and verified.
- Remaining plan groups 5–6 (performance, controlled tuning) plus the pending
  runtime scenario gaps (low-speed slide entry, slide exit on slope,
  repeated-route resource check) and the human camera/audio passes.

**Decision: Groups 1–6 executed. All baseline issues fixed and verified;
Group 6 closed the remaining measurable gaps (GF-10 low entry, GF-11 slope
via deterministic test, GF-18 resource check with the geometry-leak fix
GF-ISSUE-12) and made one measurement-justified tuning change (slideFriction
2→4 with before/after records). Remaining blockers are environment/human:
Group 5 (real-GPU performance), the human camera/audio passes, and
level-slope verification. 401/401 tests.**
