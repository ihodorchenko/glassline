# First Section — Remaining Polish & Manual Validation (Step 3.8)

**Status: PASS — 65/65 exploratory browser checks, 52/52 golden-path checks,
2/2 Prologue smoke checks, 677/677 unit/integration tests, 0 console/page
errors. Human hands-on playtest was NOT performed (see §11).**

| Item | Value |
|---|---|
| Base branch / SHA | `main` @ `b9e045731245fc006c52dab732e2d347d839d93e` (validated `origin/main` before work) |
| Feature branch | `feat/first-section-remaining-polish` |
| Implementation commit | `057c36451780cc0d50ccc4d839ce56c6b889ce20` (the published branch head is the docs-only follow-up commit that records this line) |
| Date | 2026-11-23 (Europe/Minsk) |
| Level route | DEV launch `?dev=first_section` (S0 Starting Roof → S5 Finish) |
| Browser evidence | [`docs/evidence/first-section/step-3.8/`](evidence/first-section/step-3.8/) (65 checks, 58 frames), [`step-3.8-golden/`](evidence/first-section/step-3.8-golden/) (52 checks) and [`step-3.8-prologue/`](evidence/first-section/step-3.8-prologue/) (2 checks) |
| Harnesses | `tools/capture/playtest.mjs` (new Step 3.8 session + F-04 range checks), `tools/capture/dev-route.mjs` (unchanged) |
| Manual checklist | [`docs/FIRST_SECTION_MANUAL_PLAYTEST.md`](FIRST_SECTION_MANUAL_PLAYTEST.md) |
| Merge / PR | **Not performed** (explicitly out of scope) |

This step closes the four open UX findings from Step 3.6/3.7 that were
confirmed in the current build, and records one new pre-existing finding it
deliberately does not fix:

| Finding | Status | Change |
|---|---|---|
| **F-02** non-collidable joints on the route centreline | **Fixed** | 7 Kit placements moved from the centreline onto the wall each one expresses; no collision geometry touched |
| **F-03** camera clearance in the slide duct | **Fixed (state) + residual** | Camera eye clamped to the current collider envelope; the stable "camera inside the ceiling slab" state is gone. A ~3-frame transition exposure remains (documented) |
| **F-04** vault prompt discoverability | **Improved** | Display reach 4.0 m separated from the unchanged 1.1 m action reach |
| **F-05** tutorial toast displacing the checkpoint toast | **Fixed** | Priority toast queue: checkpoint confirmation is `critical` and preempts routine toasts; the interrupted toast is restored |
| **New, not fixed** | Recorded | `arch_technical_ventilation_north` intake plenum penetrates the gallery wall (0.57 m into the clear width) |

Movement tuning, Rapier configuration, obstacle sizes/positions, Gap A/B
geometry, traversal geometry, the camera architecture, tutorial progression,
progression/achievements and DEV launch architecture were **not** changed.

---

## 1. F-02 — Non-collidable joint modules on the route centreline

### 1.1 Observation (Step 3.6)

Seven 2 m `joint` modules stood at `x = 0` on the route: S0 at `z = 2.0` and
`z = 10.0`, S2 in the gallery at `z = -30.0`/`-36.3`, and S4 on every vault
obstacle plane (`-59.5`, `-63.5`, `-67.5`). The Kit is visual-only, so the
camera passed straight through them; they covered the starting checkpoint
marker and dominated the vault approach.

### 1.2 Reproduction in the current build

`?dev=first_section`, then:

1. spawn `(0, 0.895, 14)` and look down −Z: the `arch_start_joint_2` column
   (0.9 × 2.0 m, no collider) stood directly between the camera and the
   `cp_start` ring/marker at `z = 10`;
2. vault channel: the three obstacles each carried a 2 m column rising out of
   the 0.5/0.7/1.1 m wall, with 1.04 m splice plates at ~1 m height.

Reference frames from the Step 3.6 run: `01-spawn-forward.jpg`,
`25-vault-1-approach.jpg`. Both were re-taken in this step (`01-spawn-forward`,
`25-vault-1-approach` in the new evidence) with the modules moved.

### 1.3 Cause

Authored placement, not a renderer or collision bug. The `joint` module is a
wall/panel seam (`KitModulesEnvelope.buildJoint`: two anodised extrusions, a
gasket, cover plates and a red reveal) and every other instance in the level
(S1 at `x = 3.05`, S5 at `x = ±5`, S3 jambs at `x = ±1.85`) is already mounted
on or beside a solid surface. These seven were placed at `x = 0` on the walking
line, where the module has no architectural host and the camera passes through
it.

### 1.4 Change

Only the seven placements moved (module variants, counts, rotations used for
the other 45 placements, and the collision layer are unchanged):

| Placement | Old `(x, y, z)` / yaw | New `(x, y, z)` / yaw | Host surface |
|---|---|---|---|
| `arch_start_joint_1` | `(0, 0, 2)` / 0 | `(3.06, 0, 4.2)` / −π/2 | penthouse west face, seam between the two facade bays |
| `arch_start_joint_2` | `(0, 0, 10)` / 0 | `(3.06, 0, 8.4)` / −π/2 | penthouse west face, end of the facade-bay run |
| `arch_technical_joint_entry` | `(0, 0.9, -30)` / 0 | `(-1.46, 0.9, -31)` / +π/2 | gallery west lining |
| `arch_technical_joint_chamber` | `(0, 0.9, -36.3)` / 0 | `(-1.46, 0.9, -35.35)` / +π/2 | gallery west lining |
| `arch_vault_joint_1` | `(0, 0.9, -59.5)` / 0 | `(2.26, 0.9, -59.5)` / −π/2 | vault east wall at obstacle 1 |
| `arch_vault_joint_2` | `(0, 0.9, -63.5)` / 0 | `(2.26, 0.9, -63.5)` / −π/2 | vault east wall at obstacle 2 |
| `arch_vault_joint_3` | `(0, 0.9, -67.5)` / 0 | `(2.26, 0.9, -67.5)` / −π/2 | vault east wall at obstacle 3 |

The chosen origins sit 0.06 m inside each host wall face: the red reveal
stands 0.015 m proud, the 0.22 m body back sits 0.28 m inside the wall, and the
0.295 m front tip stands 0.235 m in front of it. That tip keeps **6.5 cm** from
the capsule's maximum wall-hugging camera position (body centre 0.3 m from the
wall), so the near plane cannot clip it. At the vault planes the tip overhangs
the obstacle end by 3.5 cm in plan above the obstacle top, so the seam reads as
the obstacle/wall junction without a visible gap. The spec placement table in
[`docs/reports/FIRST_GAMEPLAY_SECTION_SPEC.md`](reports/FIRST_GAMEPLAY_SECTION_SPEC.md)
§§5.1/5.3/5.5 was updated to the same coordinates.

No decorative element was deleted; the visual module count stays 52
placements / 55 instanced batches.

### 1.5 Regression test

New [`tests/unit/first-section-route-clearance.test.ts`](../tests/unit/first-section-route-clearance.test.ts)
(5 tests) derives each placement's world AABB from the **real generated module
parts** and pins a geometric rule rather than a coordinate snapshot:

- no authored module intersects the camera-travel volumes (S0: ±2 m around the
  route; gallery: ±1.1 m of its 3.2 m width; vault channel: ±1.9 m of its
  4.4 m width);
- the same predicate is re-run against the seven historical centreline
  coordinates and **must** flag them (a self-check, so the rule cannot silently
  stop detecting the defect);
- every `joint` module is embedded in collision geometry (no free-standing
  columns);
- the S0/S2/S4 joints are all ≥ 1 m from the centreline;
- the visual layer still adds no collision ids.

The test carries a documented allowlist for two known non-F-02 intrusions: the
`service-portal` ring (its AABB is the empty frame, the opening passes the
camera) and the pre-existing gallery ventilation plenum (§9). The allowlist
fails if either entry stops being true.

### 1.6 Evidence and residual risk

Browser frames: `01-spawn-forward.jpg` (checkpoint marker and ring fully
visible, no column), `06/07/08-route-cle…`, `17/18/19-gallery…` (clear
centreline), `25/26/45/46` (vault obstacles readable). The moved joints are
visible on the penthouse face and on the gallery/vault walls in the same
frames. Remaining risk: the mount is a visual judgement (relief depth 22–23 cm
on a wall); it is evaluated from screenshots only, not by a human in motion —
see §11.

---

## 2. F-03 — Camera clearance in the slide duct

### 2.1 Observation (Step 3.6)

"Crouching at the lip fills the screen with the ceiling slab." The Step 3.6
frame `21-duct-crouch-blocked.jpg` shows a full-screen metal face.

### 2.2 Reproduction and measurement

Authored geometry (`FirstSectionLayout.ts` §5.4): duct floor top **0.90 m**,
ceiling underside **1.90 m** → a **1.00 m** slot. Measured with the production
camera (`window.__glassline.cameraSystem.camera.position`, read-only DEV probe):

| State | Body / collider | Camera Y | Clearance to 1.90 m |
|---|---|---|---|
| Standing at the lip | posture 1.75, `z = -46.71` | 2.52 | −0.62 m (eye above the whole slot) |
| **Crouching at the lip (settled)** | posture 1.15, `z = -46.71` | **1.97** | **−0.07 m** (in open air 0.29 m in front of the lintel) |
| Sprint-slide inside | posture 0.90 | 1.56–1.58 | +0.32…+0.34 m |
| **Slide ends inside the duct** | posture 0.90, stance `crouching` | **1.97 before / 1.76 after** | −0.07 before / **+0.14 after** |
| Press Shift at the lip (sprint) | posture 0.90, entering | 2.07 → 1.84 between z −47.01 and −47.41 | briefly negative (residual, §2.6) |

### 2.3 Root cause — two separate things

1. **The Step 3.6 evidence was captured in the wrong state.** The Step 3.6
   harness released `ShiftLeft` before the screenshot
   (`playtest.mjs`, `await release(page, "ShiftLeft"); await delay(300);
   capture("21-duct-crouch-blocked")`), so the frame shows the stand-up
   transition, not the settled crouch. The settled crouch view (new frame
   `56-duct-crouch-lip.jpg`) is readable: lintel and red band above, the 1 m
   slot, floor and both walls below. "The screen is almost entirely ceiling"
   is **not reproduced** as a stable crouch/slide state.
2. **A real camera-state defect does exist.** The slide ends inside the duct
   (speed drops or crouch is released) but the collider cannot grow, so the
   body keeps the 0.90 m posture while the stance is reported as `crouching`.
   The camera then targets `crouchingEyeHeight` 1.05 m — *above* the 0.90 m
   collider and above the 1.90 m ceiling underside by 0.07 m — and sits
   **inside the ceiling slab**. Because the slab is drawn with front-face
   culling, the result is a see-through ceiling (an x-ray), not a filled
   screen, which is why it went unnoticed.
   The crouch-at-the-lip 0.07 m is the same tuning relationship (crouch eye
   1.05 m > slot 1.00 m); there the camera is outside any solid (in front of
   the lintel) and the view is readable.

### 2.4 Change

`CameraSystem.updateEyeHeight()` now clamps the **target** eye height to the
current collider envelope:

```
maxEyeHeight = postureHeight - 0.06   // eye is part of the body
eyeHeight    = min(posture stance eye height, maxEyeHeight)
```

- Only the "capped crouch" state changes: 1.05 → 0.84 above the feet when the
  posture is 0.90 m. Settled standing (1.60), crouch (1.05 with a 1.15 m
  posture) and slide (0.65) heights are unchanged, as is the damping
  (`EYE_HEIGHT_DAMPING = 12`), so no movement-feel parameter changed.
- Duct slide camera: 1.76 m (0.14 m below the ceiling) instead of 1.97 m
  (inside the slab). The new frame `58-duct-stopped-inside.jpg` shows the
  ceiling rendered normally.
- No duct height, collision geometry, MovementTuning value or camera
  architecture change.

### 2.5 Tests

[`tests/unit/camera-duct-clearance.test.ts`](../tests/unit/camera-duct-clearance.test.ts)
(7 tests) uses the real authored duct bounds and the production `CameraSystem`:

- settles the slide camera below the ceiling (clearance > 0.25 m);
- keeps the capped crouch below the ceiling and below the collider top;
- never places the settled eye above the top of its own collider for
  standing/crouch/slide/capped-crouch;
- keeps the normal standing and crouch eye heights unchanged;
- returns to the standing eye after respawn;
- documents the authored 1.00 m slot and the crouch-eye relationship that makes
  crouch-only entry impossible (so a tuning/geometry change must revisit the
  finding).

Browser assertions (`playtest.mjs` Step 3.8 session, fresh context):
`56-duct-crouch-lip` (settled crouch, camera 1.97, outside the slab),
`57-duct-slide-inside` (14 samples inside, max camera 1.576, clearance 0.324),
`58-duct-stopped-inside` (stance `crouching`, posture 0.90, camera 1.76,
clearance 0.14), `59-duct-exit-after-stop` (crouch-walk out still works).

### 2.6 Residual risk

**Late-slide transition.** If the player presses `Shift` within ~0.3 m of the
lip at 8.5 m/s, the camera lags the newly shrunk collider for about **3 render
frames (~35–50 ms)**: measured max 2.071 m at `z = -47.01`, i.e. 0.17 m above the
ceiling underside; the eye is below 1.90 m by `z = -47.28` (0.28 m inside the
duct) and at 1.84 m by `z = -47.41`. The
target clamp deliberately does not change transition speed, because a hard
clamp of the *current* offset would snap the camera down ~0.3 m in one frame on
every crouch/slide (a movement-feel change), and a physics ceiling query would
be a new camera capability. Both are outside this step; see §10 for the
options. Because the slab is backface-culled, the visible effect is a brief
see-through of the ceiling, not a filled screen.

**Crouch at the lip** remains at 1.97 m (0.07 m above the lintel plane,
outside solid geometry). Lowering it would require changing
`crouchingEyeHeight` (MovementTuning, explicitly out of scope) or the authored
duct; the settled view is readable and the human checklist covers comfort.

---

## 3. F-04 — Vault prompt display range

### 3.1 Observation (Step 3.7)

`E · VAULT` was driven by the same detection as the vault action, with a
1.1 m forward reach. At sprint speed (8.5 m/s) that is ~0.13 s of visible
approach before contact — too short to read.

### 3.2 Change

The execution range and the display range are now separate:

| Signal | Reach | Consumer |
|---|---|---|
| Vault action / `isVaultAvailable()` | **1.1 m** (unchanged) | `MovementModel` / vault execution |
| `E · VAULT` affordance / `isVaultAffordanceAvailable()` | **4.0 m** (`VAULT_AFFORDANCE_FORWARD_REACH`) | `ContextualPrompt` / HUD |

The wider probe reuses `VaultDetector.detect(..., forwardReach)` — the same
height, landing-space and head-clearance validation, only from farther away —
so it cannot advertise an obstacle the action would reject. `PlayerSystem`
computes the execution signal first and only runs the wider probe when the
action signal is absent and the level opted in (`vaultAffordance`), so other
levels pay nothing. It never starts an action and emits no event.

Priority is unchanged and still explicit in `ContextualPrompt`:
**interaction target → Training tutorial hint → vault affordance**. EN/RU
strings are unchanged (`E · VAULT` / `E · ОПОРНЫЙ ПРЫЖОК`); the prompt remains
First-Section-only (the level is the only one with `metadata.vaultAffordance`).

### 3.3 Measured behaviour

Browser (`step-3.8` report, `scenarios.failureModes`):

| Position | Distance to obstacle face | `isVaultAvailable` | `isVaultAffordanceAvailable` | Prompt |
|---|---|---|---|---|
| Outside the display reach | ~4.8 m | false | false | hidden |
| Early (3.0 m sample) | 2.81 m | **false** | **true** | `E · VAULT`, one line |
| Inside the action range | 0.32 m | true | true | `E · VAULT`, one line |
| After the first vault | next obstacle 2.37 m ahead | **false** | **true** | `E · VAULT` |
| Past the last obstacle | nothing within 4 m | false | false | hidden |

A sprint approach from outside the reach shows the prompt for **3.46 m** before
contact (entry at 6.0 m/s); the display window before the action becomes
available is 4.0 − 1.1 = 2.9 m ≈ 0.34 s at sprint and ≈ 0.64 s at walk speed.
The prompt stays visible while the player is stopped against the obstacle.

### 3.4 Tests

`tests/unit/first-section-vault-hint.test.ts` (5 new tests, 14 total):

- the affordance is visible at 2.6 m while `isVaultAvailable()` is false;
- walking in, the affordance starts at ~4.0 m and the action at ~1.1 m, giving
  a > 2.5 m readable lead (measured, not derived from the constant);
- an obstacle above `vaultMaxHeight` (the 2.0 m channel wall at 2.2 m) is
  rejected by the wider probe;
- the wider probe never starts an action or emits jump/vault events;
- a level without the opt-in gets no affordance even inside the action range.

The existing suite still covers appearance/hiding, stability while blocked, no
tutorial progression, the Prologue/Training isolation and the EN/RU strings.
The harness's vault-hint checks were updated for the new semantics: hidden
outside 4.0 m, visible before the action range with `available === false`,
visible in range, hidden past the last obstacle, and a single unduplicated line
throughout.

### 3.5 Residual risk

The prompt is an affordance, not a guarantee: `E` at a standstill still does
nothing (the 2.5 m/s minimum entry speed is unchanged). A longer display reach
also means the next obstacle's prompt appears immediately after a vault — that
is intended (it advertises the upcoming action) and is asserted as such. Human
readability at full sprint is the one thing the automation cannot certify.

---

## 4. F-05 — Checkpoint toast priority

### 4.1 Observation (Step 3.6)

On a fresh profile the tutorial `Move` toast and the `cp_start` confirmation
coincide. The first `.gl-toast` was `Move`; the checkpoint toast surfaced ~1 s
later.

### 4.2 Reproduction and root cause

Fresh profile, `?dev=first_section`, walk into `cp_start` while sampling the
toast element every ~35 ms:

```text
t=71 ms    toast "Move"                                        (tutorial step completed)
t=1954 ms  toast "Checkpoint reached: Starting Roof Checkpoint"  (queued behind it)
```

`UIManager.showToast` was a plain FIFO: if any toast was visible, the new
message was pushed behind up to five pending messages with no priority concept.
The tutorial handler and the checkpoint handler both call the same method, so
the result depended only on event order.

### 4.3 Change

A pure [`src/ui/ToastQueue.ts`](../src/ui/ToastQueue.ts) replaces the inline
queue in `UIManager` (the existing single toast element, durations and
announce path are reused — no parallel notification system):

- `critical` messages preempt a visible `normal` message immediately;
- the preempted message is restored **next**, with the time it had left
  (minimum 400 ms), so routine feedback is delayed, not lost;
- `normal` messages never preempt and queue behind anything visible;
- among equal priorities the order is FIFO;
- the five-message backlog drops the oldest `normal` first and never a queued
  `critical` while a normal remains;
- `clear()` drops everything (called when a new gameplay session starts and on
  return to menu, so a restart cannot show the previous run's toast).

Checkpoint confirmation is the first `critical` message. Other existing
notifications (achievements, milestones, content unlocks, training/exercise
confirmations, tutorial steps) keep their previous `normal` behaviour
deliberately — reclassifying them is a product decision outside F-05.

### 4.4 Measured behaviour (same fresh-profile scenario)

```text
t=71 ms    toast "Move"
t=602 ms   toast "Checkpoint reached: Starting Roof Checkpoint"   (at activation, 0 ms queue)
t=2872 ms  toast "Move"                                           (interrupted tutorial restored)
t=4111 ms  hidden
```

Harness measurement (`step-3.8`, sampler interval ≈37 ms): the checkpoint
status and the checkpoint toast text first appear in the **same** sample at
607 ms (`checkpointDelay = 0 ms`, i.e. within one sampling interval; the
previous sample at 569 ms still showed `Move` with no active checkpoint),
checkpoint visible 2.11 s and uninterrupted for the first 1.5 s, tutorial
`Move` replayed at 2787 ms, final toast hidden, no visible-but-empty toast. The walkthrough's own fresh-profile checkpoint now
records `firstToast: "Checkpoint reached: Starting Roof Checkpoint"` (it was
`Move` in Step 3.6). After a Results Retry the toast slot is empty
(`toast: "", visible: false`).

### 4.5 Tests

[`tests/unit/toast-priority.test.ts`](../tests/unit/toast-priority.test.ts)
(10 tests): immediate show/FIFO, checkpoint preemption with the remaining
duration, routine messages never preempting a checkpoint, critical FIFO,
minimum re-queue duration, backlog cap and critical preservation, invalid
input, `clear()` (restart), and no interruption of a critical toast by routine
ones. Browser assertions cover the ordering, the restored tutorial toast,
readability duration, no stuck/empty toast and the cleared slot after restart.

### 4.6 Residual risk

Only the checkpoint is `critical`. If design later wants achievements to
outrank routine toasts, the same queue accepts the classification without new
architecture. There is one toast slot by design; a critical toast can still
delay a routine one by up to ~2.2 s (it is restored). The queue was verified in
headless Edge; OS-level audio/DOM timing is not part of the claim.

---

## 5. Manual playtest preparation

[`docs/FIRST_SECTION_MANUAL_PLAYTEST.md`](FIRST_SECTION_MANUAL_PLAYTEST.md) is a
13-section checklist with expected behaviour and a result/notes column per
item: spawn/basic controls, Gap A, Gap B, plant step and gallery, slide duct
(readability + comfort), vault prompt at different speeds, vault with `E` and
collision without `E`, stairs/surfaces, checkpoint notification order, kill
volume/death/respawn, pause→resume and pointer lock, restart and a second run,
finish/Results.

Automated runs (Playwright, headless Edge) are explicitly **not** a substitute.
The checklist states the current status as `Human hands-on: NOT PERFORMED`.

---

## 6. Validation results

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | PASS |
| Biome (repository) | `npm run check` | PASS — 219 files; no errors, 15 pre-existing warnings, none in changed files |
| Unit/integration | `npm test` | PASS — **677/677** in 68 files (baseline 650; +27 new) |
| Production build | `npm run build` | PASS — 130 modules, 5,461.86 kB JS (1,961.25 kB gzip), 17.14 kB CSS |
| Full gate | `npm run validate` | PASS (typecheck + Biome + tests + build) |
| Whitespace | `git diff --check` | PASS |
| Golden path | `node tools/capture/dev-route.mjs --no-record --no-perf --out-dir docs/evidence/first-section/step-3.8-golden` | PASS — **52/52** checks, 12 screenshots, 0 errors |
| Exploratory browser | `node tools/capture/playtest.mjs --out-dir docs/evidence/first-section/step-3.8` | PASS — **65/65** checks, 58 frames, 0 console/page errors |
| Prologue menu/gameplay smoke | `node tools/capture/dev-route.mjs --skip-scenario --no-record --out-dir docs/evidence/first-section/step-3.8-prologue` | PASS — **2/2** checks, 300 frames after 120 warmup |
| First Section completion / Results | golden path + exploratory walkthrough | PASS — `Level: First Section`, `prologueCompleted=false`, Retry/Restart clean |
| DEV entry points absent from production | grep `dist/assets/index-*.js` | PASS — `__glasslineDevLaunch`, `DevLaunch`, `__glasslineCapture`, `__glassline`: **0** occurrences |
| Production bundle content | grep `dist/assets/index-*.js` | First Section content still present as dead code (pre-existing F-08, unchanged; see §9) |

Host load during the published exploratory run: `loadAvg 3.61 / 4.22 / 5.99`
on 8 cores; the performance numbers are not used for any claim in this step.

### 6.1 Browser scenarios exercised (step-3.8)

| Scenario | Result |
|---|---|
| Spawn view and 4-way orientation | route line, checkpoint ring and floating marker fully visible; no centreline column |
| Checkpoint walkthrough (fresh profile) | `cp_start` activated; checkpoint toast is the first visible toast |
| Gap A / Gap B / plant step | unchanged golden-path behaviour |
| Gallery entry/mid/exit | clear centreline; lateral drift 0 m |
| Duct crouch at the lip (settled) | camera 1.97, outside the slab; readable slot (0.07 m lintel overlap documented) |
| Duct sprint-slide | 14 samples inside, max camera 1.576 m, clearance 0.324 m |
| Duct slide ends inside | camera 1.76 m, clearance 0.14 m, ceiling rendered (fix verified) |
| Duct stop/recover | crouch-walk out works |
| Vault prompt far/early/near/blocked/after/cleared | hidden / shown with action unavailable / shown+available / stable / next obstacle / hidden |
| Sprint charge without `E` | blocks at z −58.83, rise 0.01 m, no launch/back-bounce |
| Vault with `E` (walk speed ×2) | vaults, prompt advances |
| Toast priority (fresh profile) | checkpoint first, tutorial restored, nothing stuck |
| Restart from Results and pause | clean spawn, no inherited checkpoint, empty toast slot |
| Three deaths | exactly three respawns, identical recovery |
| First Section completion | Results, `Level: First Section`, `prologueCompleted=false` |

---

## 7. Browser evidence index

All frames are 1600 × 900 JPEGs from the live game with the HUD;
`report.json` holds the full check list and the measured state behind each
frame.

| Artifact | Content |
|---|---|
| [`step-3.8/report.json`](evidence/first-section/step-3.8/report.json) | 65 checks, per-frame pose/camera/HUD, console/request diagnostics |
| `01-spawn-forward.jpg` | Spawn view: checkpoint ring/marker unobstructed; wall-mounted joints on the penthouse |
| `06-route-clearance-checkpoint.jpg`, `07-…past-checkpoint.jpg`, `08-…before-gap-a.jpg` | Start-roof route clearance after the F-02 move |
| `17/18/19-gallery-*.jpg` | Gallery entry/mid/exit, centreline clear |
| `25/26-vault-*-approach.jpg`, `45/46-*.jpg` | Vault channel with the joints on the east wall |
| `48-vault-hint-far.jpg` | Hidden outside the 4.0 m display reach |
| `51-vault-hint-display-range.jpg` | `E · VAULT` visible at ~2.6 m from the face, action still unavailable |
| `49-vault-hint-near.jpg`, `50-vault-hint-blocked.jpg` | Visible inside the action range and while blocked; single line |
| `54-vault-hint-after.jpg` | Prompt advances to the next obstacle after a vault |
| `55-checkpoint-toast-priority.jpg` | Checkpoint confirmation on screen at activation |
| `56-duct-crouch-lip.jpg` | Settled crouch at the lip (slot readable, red band visible) |
| `57-duct-slide-inside.jpg` | Sprint-slide inside the duct |
| `58-duct-stopped-inside.jpg` | Slide ended inside: ceiling rendered, camera 1.76 m (F-03 fix) |
| `59-duct-exit-after-stop.jpg` | Crouch-walk exit after the stop probe |
| `60-vault-hint-cleared.jpg` | Hidden past the last obstacle |
| [`step-3.8-golden/report.json`](evidence/first-section/step-3.8-golden/report.json) | 52/52 golden path, finish/Results, checkpoint/respawn/restart; `07-slide-duct.png` and `10-results.png` retained |
| [`step-3.8-prologue/report.json`](evidence/first-section/step-3.8-prologue/report.json) | Prologue menu launch + gameplay frames, 2/2 |

The late-slide transition measurement (2.071 m max, 3 samples above 1.90 m) was
taken with a one-off instrumented probe (teleport to the runway, sprint, press
`Shift` at `z = -46.42`, sample every ~8 ms); it is not part of the published
harness run and is quoted as a residual measurement, not as a regression gate.

---

## 8. Files changed

| File | Purpose |
|---|---|
| `src/levels/first-section/FirstSectionArchitecture.ts` | F-02: 7 joint placements moved to their host walls; placement notes |
| `src/camera/CameraSystem.ts` | F-03: eye height clamped to the collider envelope |
| `src/ui/ToastQueue.ts` | F-05: new pure priority queue |
| `src/ui/UIManager.ts` | F-05: renders queue transitions; `critical` priority; `clearToasts()` |
| `src/app/Application.ts` | F-05 checkpoint is `critical` + clear on new session/menu; F-04 affordance signal + level player option |
| `src/player/PlayerSystem.ts` | F-04: separate `isVaultAffordanceAvailable()` signal (display-only) |
| `src/player/detection/VaultDetector.ts` | F-04: `forwardReach` parameter + 4.0 m affordance reach constant |
| `src/ui/ContextualPrompt.ts` | F-04: policy input renamed to the affordance signal |
| `src/diagnostics/DevLaunch.ts` | Read-only camera position in the DEV status (browser evidence) |
| `tests/helpers/first-section-harness.ts` | Harness affordance option (mirrors Application wiring) |
| `tests/unit/first-section-route-clearance.test.ts` | New F-02 regression (5 tests) |
| `tests/unit/camera-duct-clearance.test.ts` | New F-03 regression/characterisation (7 tests) |
| `tests/unit/toast-priority.test.ts` | New F-05 regression (10 tests) |
| `tests/unit/first-section-vault-hint.test.ts` | F-04 display-range tests (+5) and renamed policy field |
| `tests/unit/first-section-architecture.test.ts`, `tests/unit/dev-launch.test.ts` | Expected table / camera status updated |
| `tools/capture/playtest.mjs` | Step 3.8 session (toast order, duct camera), F-04 range checks, restart toast check, camera status |
| `docs/reports/FIRST_GAMEPLAY_SECTION_SPEC.md` | Placement table matches the moved joints |
| `docs/FIRST_SECTION_MANUAL_PLAYTEST.md` | New manual checklist |
| `docs/FIRST_SECTION_REMAINING_POLISH_REPORT.md` | This report |
| `docs/IMPLEMENTATION_STATUS.md` | Step 3.8 record |
| `docs/evidence/first-section/step-3.8/`, `step-3.8-golden/`, `step-3.8-prologue/` | Browser evidence |

No collision geometry, MovementTuning value, Rapier configuration, traversal
obstacle, Gap A/B geometry, camera architecture, tutorial progression,
progression/achievement or DEV launch file was changed.

---

## 9. Findings deliberately not fixed

1. **Gallery ventilation plenum intrudes into the clear width.**
   `arch_technical_ventilation_north` is mounted at `x = 1.85` facing *away*
   from the gallery, so its 1 m intake plenum penetrates the 0.4 m east wall and
   reaches `x = 0.83` — 0.57 m inside the 2.8 m clear width (0.23 m inside the
   camera envelope). It is dark metal against the dark lining, so it reads as
   part of the wall, and the player's centre line is unaffected. It is not one
   of the seven F-02 joints; correcting it is a level-art decision (rotate the
   unit to face the corridor, or move it outside the wall). The new route
   clearance test allowlists it explicitly and fails if the geometry changes
   without updating the entry. Proposed separately.
2. **Late-slide camera transition** (§2.6). Needs a feel decision or a new
   camera-clearance capability; out of scope here.
3. **F-08 / F-09 / F-10 from Step 3.6** (production dead-code content,
   tutorial progression scope, DEV key hints) are unchanged and outside this
   step; the production bundle still contains the First Section **content** as
   dead code while all DEV **entry points** are absent.
4. **The crouch-at-the-lip 0.07 m lintel overlap** (§2.6) — expected result of
   the authored 1.00 m slot against the tuned 1.05 m crouch eye; no code change.

---

## 10. Options left open (not implemented)

| Finding | Option | Why deferred |
|---|---|---|
| F-03 residual | Faster downward eye-height damping (e.g. 40 instead of 12) when the posture shrinks | Removes the 3-frame exposure, but changes crouch/slide feel in every level; needs a human pass |
| F-03 residual | Hard-clamp the *current* eye offset to the collider top | Removes the exposure but snaps the camera ~0.3 m in one frame on each crouch/slide |
| F-03 crouch lip | Lower `crouchingEyeHeight` below 1.00 m, or recess the duct lintel | Changes MovementTuning or authored geometry — explicitly out of scope |
| Ventilation plenum | Rotate/move the unit to face the corridor or mount it fully outside the wall | Level-art decision; recorded as a separate finding |
| Toast priority | Classify achievements/milestones as `critical` | Product decision; the queue already supports it |

---

## 11. Human hands-on status

**Human hands-on: NOT PERFORMED.** Every input in this step was
Playwright-driven in headless Edge. The automated evidence proves ordering,
ranges, geometry and camera positions; it does **not** prove feel, comfort,
readability at speed or comprehension without prior knowledge.

To close the UX questions, a person should run
[`docs/FIRST_SECTION_MANUAL_PLAYTEST.md`](FIRST_SECTION_MANUAL_PLAYTEST.md)
(≈20–25 minutes, fresh profile, windowed browser), in particular:

1. whether the relocated joints read as architecture rather than floating
   props (§1.6);
2. whether the duct is comfortable as a crouch and as a slide, including
   stopping inside (§2.6);
3. whether `E · VAULT` is readable early enough at full sprint (§3.5);
4. whether the checkpoint confirmation is noticed before the tutorial toast on
   a fresh profile (§4.6);
5. the Step 3.6 F-06/F-07 items (gap visibility, pause→resume pointer lock)
   that still need a real browser.

The Step 3.6 and Step 3.7 human checklists remain valid; this step adds the
items above.

---

## 12. Merge / PR

No merge was performed and no pull request was created. The feature branch is
pushed to `origin` for review. Base `main` was not modified.
