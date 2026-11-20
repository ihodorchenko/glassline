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

### GF-ISSUE-05 — Landing camera response ignores impact intensity

- Severity: Medium (feedback). Affected: Landing camera. System: Camera.
- Description: `LANDING_DIP_METERS = 0.06` and the landing roll amplitude are
  constants — a 0.5 m hop and a 15 m/s fall produce identical camera response.
  `13_CAMERA_SYSTEM_SPEC.md` §11.6 requires proportionality to vertical impact
  speed; the rewritten audit doc's GF-08 also explicitly expects "distinct,
  proportional landing response" for low vs high falls. The impact data
  (`impactSpeed`) already exists on the movement snapshot/event path.
- Recommended: scale dip/roll amplitude by a clamped impact factor (e.g.
  `clamp(impactSpeed / 10, 0.25, 1)`), keep the half-sine recovery; add camera
  unit tests for two impact levels; verify Reduced Motion still zeroes it.
- Risk: low; subjective intensity must be human-checked (landing shake was
  flagged "untuned/unverified by human" in IMPLEMENTATION_STATUS Rounds 39/40).

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
| GF-ISSUE-02 | Vaulting implements a single profile (fixed 0.45 s, arc lift 0.25); no Standard/Speed distinction, no speed-based selection, no minimum approach speed, and `player:vault-started` carries `{speed}` instead of the vault type | `12` §14.4 (two profiles + deterministic selection + type in event), `03` §10.4 | **High** (explicit "must" in spec) | `VaultDetector.ts` (single candidate), `MovementModel.beginVault` (no speed check), `PlayerSystem` event payload |
| GF-ISSUE-03 | Wall-run eligibility ignores `wallRunSurface`/`wallJumpSurface` surface metadata authored in the level; any near-vertical collider within 0.75 m qualifies (including `surface_boundary` walls marked not wall-runnable) | `12` §15.2 ("correct collision category or metadata"), `12` §22 (surface metadata) | **Medium** | `WallRunDetector.ts` uses raw raycasts only; `SurfaceRegistry` is consumed only by audio/level validation |
| GF-ISSUE-07 | Vault traversal bypasses collision: the body is moved by direct `setNextKinematicTranslation` along the scripted arc for 0.45 s without controller/collision checks and without cancellation if the destination becomes invalid | `12` §14.6 (fail safely / cancel), `03` §10.5 ("must remain integrated with physics and collision validation") | **Medium** | `PlayerSystem.updateScriptedVault` |
| GF-ISSUE-08 | Camera spec defines a sprint-FOV intensity setting and dynamic-FOV toggle; the Settings registry (`25` §B.1.3) has no such keys — sprint FOV is hard-coded to base+7 | `13` §9.6 vs `25` settings registry | **Low** (spec-vs-spec inconsistency; implement per settings registry) | `CameraSystem` constructor `sprintFov: baseFov + 7` |
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

### Group 3 — Momentum and traversal consistency

| # | Change | Benefit | Risk |
|---|---|---|---|
| 3.1 | Decide and implement the two vault profiles (Standard/Speed) with deterministic selection, min approach speed, and vault type in `player:vault-started` (GF-ISSUE-02); add tests | Spec compliance; speed-based skill expression | Touches detector + model + event consumers (audio/stats/training labels) |
| 3.2 | Gate wall-run eligibility on surface metadata with a sensible default (GF-ISSUE-03); add tests | No unintended wall-runs on boundary/decoration walls | Level surfaces must be audited so intended walls stay runnable |
| 3.3 | Add vault mid-traversal collision validation or cancellation (GF-ISSUE-07) | No more uncontrolled 0.45 s collision bypass | Trajectory may need controller-based integration; test against tunnel/low-ceiling cases |

### Group 4 — Camera and feedback

| # | Change | Benefit | Risk |
|---|---|---|---|
| 4.1 | Impact-scaled landing dip/roll (GF-ISSUE-05) + unit tests | Landings communicate weight | Subjective intensity; human check required; keep Reduced Motion zeroing |
| 4.2 | Sprint-FOV intensity setting (GF-ISSUE-08) wired through the settings pipeline | Spec-aligned configurability | Settings registry + camera application; small |
| 4.3 | Human pass over bob/roll/dip intensities at 60+ fps on real hardware (deferred until hardware runs are available) | Calibrated feedback | — |

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

## 9. Acceptance Assessment (per the rewritten audit methodology)

The rewritten `GAMEPLAY_FEEL_AUDIT.md` evaluates each feel change through its
own phases (baseline → isolate → hypothesis → controlled change → verify →
record/regress); there is no longer a single final acceptance gate, but the
same bar applies per change. Group 1 was executed under that workflow and each
change met it: reproducible baseline, confirmed cause, smallest controlled
change, scenario verification, regression tests, honest reporting.

Still open before the audit can converge on "no critical or high issues":

- GF-ISSUE-02 (vault single profile — spec deviation, High by spec "must").
- GF-ISSUE-03 (wall-run surface metadata — Medium deviation).
- GF-ISSUE-04/05/07/10 and the remaining plan groups (2–6).

**Decision: baseline complete; Group 1 and Group 2 approved and implemented
(slide-kill, wall-jump landing, input edge queue, slide steering — 387/387
tests). Next increment per the plan: Group 3 (3.1 vault profiles, 3.2
wall-run surface metadata, 3.3 vault collision validation). Awaiting owner
approval before starting Group 3.**
