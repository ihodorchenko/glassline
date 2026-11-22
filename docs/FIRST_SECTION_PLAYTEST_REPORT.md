# First Section — Playtest and Gameplay Polish (Step 3.6)

**Status: PASS with open design findings — 43/43 exploratory browser checks passed,
0 uncaught page errors, 0 console errors, 0 failed requests. Human hands-on playtest
was NOT performed (see §9).**

| Item | Value |
|---|---|
| Tested base | `main` @ `af01f1a228754d4cc6b92ac8bf72f843a29f8d4c` (validated `origin/main` before work) |
| Branch | `feat/first-section-playtest` |
| Date | 2026-11-22 (Europe/Minsk) |
| Level route | DEV launch `?dev=first_section` (S0 Starting Roof → S5 Finish) |
| New tool | `tools/capture/playtest.mjs` (exploratory harness) |
| Published evidence | [`docs/evidence/first-section/step-3.6/`](evidence/first-section/step-3.6/) (`report.json`, 45 gameplay frames) |

This step did not change any production source, authored geometry, physics, camera,
checkpoint/respawn or progression code. It adds a browser playtest harness, evidence,
this report and an implementation-status record.

---

## 1. What was tested and how

### 1.1 Evidence categories

| Category | What it means in this report |
|---|---|
| **A — Automated** | Deterministic checks executed by Node/Vitest or by the harness: route reachability, state transitions, checkpoint/respawn/restart state, console/resource errors, existing test suites. |
| **B — Exploratory browser testing** | A real Edge session driven with trusted Playwright keyboard/mouse through the existing `InputManager`, used adversarially: wrong input, missed jumps, stops inside the duct, restarts, repeated deaths. Closed-loop steering (reads position/yaw, sends normal input); no teleports and no gameplay-state writes. |
| **C — Human hands-on** | A person playing the build and judging feel, comprehension and fairness. **Not performed in this step.** Subjective claims below are explicitly marked `requires human playtest`. |

A successful scripted traversal is **not** treated as proof that the route is
understandable to a new player. The scripted golden path was already verified in
Step 3.4; this step concentrates on the questions it cannot answer.

### 1.2 Environment and commands

| Item | Value |
|---|---|
| Browser | Microsoft Edge **157.0.4341.46**, Playwright **1.65.1**, `channel=msedge`, headless |
| Viewport / DPR | 1600 × 900, device pixel ratio 1 |
| Quality | shipped default (`display.quality = medium`), not a capture-mode pin |
| OS / hardware | macOS 27.2 (Darwin 27.2.0), Apple M1 Pro, 8 cores |
| Host load | `loadAvg ≈ 17.6 / 18.6 / 18.4` during the published run (busy host; performance numbers are not used) |
| Session freshness | a fresh browser context and an empty IndexedDB profile per session |
| Dev server | harness-owned Vite, `http://127.0.0.1:5322/?dev=first_section` |
| Pointer lock | acquired on `#game-canvas` by a real click and held for the runs |

Commands actually executed (in this order):

```bash
# 1. Baseline on the untouched branch point (before adding the harness)
npm run validate                         # typecheck + Biome + tests + build
node tools/capture/dev-route.mjs --no-record --no-perf

# 2. Exploratory playtest (published evidence)
node tools/capture/playtest.mjs \
  --out-dir docs/evidence/first-section/step-3.6 \
  --report  docs/evidence/first-section/step-3.6/report.json

# 3. Prologue + performance smoke through the normal menus
node tools/capture/dev-route.mjs --skip-scenario --no-record

# 4. Final gates
npm run validate
git diff --check
```

The one-off probes quoted in §5 were exploratory instruments, not committed tools;
their results are reproducible from the steps given and are also present in the
published `report.json` where applicable.

---

## 2. Checks performed (A)

| Check | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | PASS |
| Lint/format (`biome check .`) | PASS — 208 files |
| Unit/integration tests (`vitest run`) | PASS — **625/625** in 62 files |
| Production build (`vite build`) | PASS — 128 modules, 5,458.38 kB JS (1,960.28 kB gzip), 17.14 kB CSS |
| Full `npm run validate` | PASS (baseline and final tree) |
| `git diff --check` | PASS (no whitespace errors) |
| DEV golden-path harness (Step 3.4 tool) | PASS — **52/52** checks, 12 frames; run on the same base revision before the harness was added |
| New exploratory harness | PASS — **43/43** checks, 45 frames |
| Console / page errors / failed requests | **0 / 0 / 0** in both exploratory sessions |
| Prologue still launches from the main menu | PASS — menu click → flow `gameplay`, level `prologue_test`, session `running`, section `sec_rooftop`, HUD visible, no overlay, 0 console/page errors (one-off smoke) and the menu-launched Prologue perf path (`dev-route.mjs --skip-scenario`) completed |
| First Section does not publish Prologue completion | PASS — `prologueCompleted = false`, Results says `Level: First Section` |
| Restart / respawn regression | PASS — see §2.1 and §8 |
| Production bundle DEV isolation | PASS for DEV entry points: `__glasslineDevLaunch`, `DevLaunch` and `__glasslineCapture` are absent from `dist/`. **Risk:** First Section *level content* is still bundled as dead code — see F-08. |

### 2.1 Restart, checkpoint and respawn cycle (A/B)

| Step | Measured |
|---|---|
| Walk through `cp_start` | activated at z ≈ 9.3 by the authored trigger; toast `Checkpoint reached: Starting Roof Checkpoint` |
| Reach the Results screen | published `trigger_finish`; session `completed`, `levelId: first_section`, duration 54.251 s, `Level: First Section`, `prologueCompleted = false` |
| Click **Retry** on Results | session restarts in place (`gameplay-session-1` → `gameplay-session-1`); `checkpoint = null`, `activatedCheckpointIds = []`, player back at `sp_initial` `(0, 0.895, 14)`, camera yaw/pitch `0/0`, HUD visible, 0 overlay screens, pointer lock retained, `W` moves immediately |
| Three consecutive falls after the restart | respawn count `1 → 2 → 3` (exactly one per fall); every recovery at `(0, 0.895, 10)` grounded, destination `(0, 0.93, 10)` = `sp_cp_start`; no duplicate respawn after settling; no repeated-diagnostics anomaly |
| Pause (`Esc`) → **Restart** button | flow `paused` with 1 screen; restart returns to a clean session (`checkpoint = null`, no activations, `sp_initial`) |
| Real gap fall (standstill jump at Gap A) | one respawn at `cp_start`, camera level, pointer lock retained, keyboard and mouse look work after recovery |

The automated harness reached the Results screen through the authored finish trigger
and clicked the shipped Retry button; it never called `restartGameplay` or
`completeGameplay` directly.

---

## 3. Route review by segment (B)

All positions are body positions from `window.__glasslineDevLaunch.status()`; the
route runs along −Z. Screenshot numbers refer to
[`docs/evidence/first-section/step-3.6/`](evidence/first-section/step-3.6/).

| # | Segment | What the player must understand and do | Measured result | Readability / status |
|---|---|---|---|---|
| 1 | **Starting roof + orientation** | Face −Z, follow the red route line, reach the first checkpoint | Spawn `(0, 0.895, 14)`, yaw 0, pitch 0; HUD `Speed 0.0 m/s`; no overlay. Four orientation frames (`01`–`04`); body drift while looking around **0 m** | Landmarks are clear (canopy/columns, penthouse, city). **F-02:** a 2 m tall non-collidable joint stands on the route centreline at z = 10 and z = 2; the first one partially overlaps the checkpoint marker in the spawn view |
| 2 | **Checkpoint** | Walk through the authored trigger | `cp_start` active at z ≈ 9.3; toast shown; `05` | Confirmation works. **F-05:** on a fresh profile a tutorial toast (`Move`) is shown first and delays the checkpoint toast by ~1 s |
| 3 | **Approach + Gap A (3.4 m)** | Sprint, jump at the edge, land on roof B | Edge frame at z = −0.76 (`09`, `09-down`); take-off z = **−1.62 @ 8.5 m/s**; landing z = **−7.71**, `LANDING` (`10`, `11`). A standstill jump **fails** (falls at z ≈ −2.9) and respawns at `cp_start` (`42`, `43`) | Route line ends at the edge and resumes on roof B; the next marker is visible beyond. **F-06:** the drop itself is not visible from the approach even when looking steeply down — depth is inferred, not seen |
| 4 | **Gap B (4.2 m)** | Same, with a slightly longer gap | Take-off z = **−13.11 @ 8.5 m/s**; landing z = **−19.48** (`12`, `12-down`, `13`, `14`) | Same as Gap A; no unexpected stop or camera issue |
| 5 | **Plant step (0.90 m)** | Jump the 0.9 m step up to the plant deck | Take-off z = −23.54; landing z = **−25.38**, **y = 1.79** on the step (`15`, `16`) | Step silhouette and route line read clearly; the jump is short and forgiving |
| 6 | **Gallery** | Run the 3.2 m wide, 2.4 m high corridor without snagging | Entry z = −29.75, mid −34.24, exit −41.03; lateral drift **0 m** (`17`–`19`) | Corridor reads as a corridor. **F-02:** two joint modules stand in the centre (z = −30, −36.3), one inside the entry portal; the player passes through them |
| 7 | **Slide duct (1.0 m clearance)** | Approach at sprint speed, hold `Shift` to slide under | Crouch-only attempt stops at z = **−46.71**; sprint-slide inside at z = −48.91 with posture **0.90**, exit z = −55.79 (`20`–`24`) | The `SHIFT · SLIDE` sign, red band and low opening make the intended action clear. **F-03:** crouching at the lip puts the camera against the ceiling slab (screen filled); only the slide view is readable. Stopping inside is not a trap: posture stays 0.90, `W` resumes and exits (`ductStop`: −50.76 → −53.51) |
| 8 | **Vaults (0.5 / 0.7 / 1.1 m)** | Use `E` to vault the three obstacles in the 4.4 m channel | All **3/3** vaulted at sprint; `VAULTING` captured at z = −58.2 (`25`, `26`, `26-vault-moment`, `27`). Walk-speed vaults: 0.70 m done, 1.10 m done (`45`, `46`) | **F-01:** sprinting into the 0.50 m obstacle without `E` produces an unstable launch (bounce up to +1.35 m and 2.4 m backward), while the 0.70 m obstacle blocks cleanly. **F-02:** a joint sits on every obstacle plane and dominates the vault view. **F-04:** no in-level `E` cue |
| 9 | **Stairs + podium** | Walk up two flights (autostep), no jump needed | Approach z = −72.06; podium **y = 5.39** (top 4.50 + capsule offset) (`28`, `29`) | Both flights and the red finish gate are visible from the bottom; no snag |
| 10 | **Checkpoint before finish** | Activate `cp_vault` | Active at z = −70 (`27` toast) | Works |
| 11 | **Kill volume + respawn** | Falling into any void returns the player to the active checkpoint | Standstill gap fall → 1 respawn at `cp_start`; 3 repeated falls → counts 1/2/3, identical position, grounded, input restored (`33`, `34`, `43`) | Recovery is fast and predictable; no duplicate respawn |
| 12 | **Finish + Results** | Cross the authored finish trigger | Results: `Level: First Section`, time 00:54.251, `prologueCompleted = false` (`30`, `31`) | Clear finish gate/marker visible from the podium; Results is correct |

---

## 4. Input, camera and movement probes (B)

| Probe | Measured | Verdict |
|---|---|---|
| WASD (golden-path harness) | `W` z 14 → 10.42; `S` back to 13.37; `D` x 0 → 2.29; `A` back to 1.41 | PASS |
| Mouse look | right 180 px → yaw −0.396 rad; down 120 px → pitch −0.264 rad; restored | PASS |
| Sprint + momentum | 8.5 m/s; 6.63 m/s retained 120 ms after releasing `W`; 0 when stopped | PASS |
| Jump from standstill | rise **1.515 m**, `LANDING` observed, grounded after | PASS |
| Jump after a run-up (Gap A/B) | take-off at 8.5 m/s, landings 6.1/6.4 m past take-off | PASS |
| Jump at the platform edge | take-off 0.38 m before the Gap A edge; coyote/edge behaviour did not drop the jump | PASS |
| Air control | 320 ms of strafe input in the air → lateral **0.46 m**; landed on roof B; **8.41 m/s** after landing; control restored immediately | PASS |
| Narrow surface | stood on the 0.70 m obstacle top (0.7 m deep) at y = 2.45 | PASS |
| Sharp 180° turn | yaw 0 → **−3.52 rad**, body drift **0 m**; sprint then followed the new view (z 9.18 → 14.19) | PASS |
| Look limits | pitch clamps at **±1.484 rad**; no inversion or wrap | PASS |
| Duct stop/recover | stopped inside at posture 0.90; resumed movement after 0.9 s and exited | PASS |
| Restart from Results / pause | clean session, camera reset, control restored | PASS |
| Repeated deaths | exactly one respawn each; no duplicated diagnostics listener | PASS |

### 4.1 Cases where the visual affordance and the result differ

These are recorded because they are exactly the class of problem a scripted
traversal hides:

1. **Route joints look solid but have no collision** (F-02). The camera passes
   through them; at z = 10 the module disappears from the view while the player is
   inside it and the checkpoint marker is partly behind it.
2. **Sprinting into the first vault obstacle launches the player** (F-01). The
   obstacle is a low wall; the expected result of running into it is a stop, but the
   character controller produces a bounce, sometimes over the obstacle and sometimes
   2.4 m backwards.
3. **Crouching at the slide duct fills the view with the ceiling slab** (F-03).
   The player is told to slide, but a natural first attempt (crouch + walk) leaves
   the camera 0.3 m from a metal face, with no visible reason for the block.
4. **`E` is never shown for vaults** (F-04). The duct advertises `SHIFT · SLIDE`;
   the vault channel advertises nothing, and the controls are not listed in the menu.

---

## 5. Findings

Severity uses the Step 3.6 scale: **Blocker** (route impossible / control lost),
**Major** (obstacle cannot be understood or passed with the expected mechanics),
**Minor** (local readability/feedback/comfort), **Polish** (cosmetic).

### F-01 — Sprinting into the 0.50 m vault obstacle bounces the player instead of stopping or vaulting

| Field | Value |
|---|---|
| Segment | S4 Vault Section, first obstacle (z = −59.5, 0.5 m high) |
| Severity | **Major** (collision stability / unexpected motion) — route remains passable with `E` or a jump |
| Category | B (exploratory), reproducible |
| Status | **Open** — changing collision semantics/physics is outside the Step 3.6 change set (§5.5 of the brief) |
| Expected | Running into a 0.5 m obstacle without pressing `E` stops the player in front of it (or a readable `E` prompt appears); it must not move the player involuntarily |
| Actual | At sprint speed the character controller launches the body upward and backwards with no jump or vault input: body y 1.79 → **3.14 m**, z −58.78 → **−56.34** on the first bounce; after re-accelerating to 8.5 m/s it bounces again and ends at z **−58.03**, states `JUMPING`/`FALLING`/`LANDING`. In one earlier run the same contact instead stepped the player onto the obstacle and across it; in another it bounced once and ended 1.5 m behind |
| Frequency | **3/3** exploratory attempts produced a bounce; direction/height varied. The 0.70 m obstacle never bounced (clean stop) |
| Repro | `?dev=first_section` → sprint to the vault channel → keep `W`+`X` held and run into the first 0.5 m obstacle without pressing `E` or `Space` |
| Evidence | [`report.json`](evidence/first-section/step-3.6/report.json) → `scenarios.failureModes.unvaultedObstacles.first.samples` (40 ms timeline); frames `25-vault-1-approach.jpg`, `26-vault-2-approach.jpg`. Excerpt: `…/-58.78/1.79/8.5/SPRINTING → -58.6/2.34/3.43/JUMPING → -58.03/3.14/2.43/FALLING` |
| Cause (observed, not patched) | The 0.5 m obstacle sits just above `maxStepHeight` (0.4 m) and inside the character controller's step handling; the contact resolution injects vertical and backward velocity when the capsule meets the top edge. The exact mechanism needs a physics-focused fix |
| Suggested direction | Align the authored obstacle height/step tolerance, disable step-up on `vaultObstacle` surfaces, or stabilise the controller's contact response; needs a physics/collision decision, not a playtest patch |

### F-02 — Non-collidable joint modules stand on the running line and on every vault obstacle

| Field | Value |
|---|---|
| Segment | S0 (z = 2.0 and 10.0), S2 gallery (z = −30.0 and −36.3), S4 (on each obstacle plane at −59.5, −63.5, −67.5) |
| Severity | **Minor** (visual/readability; no route block) |
| Category | B + C |
| Status | **Open** — authored Architectural Kit placements; changing level content needs a design decision |
| Expected | Route-centreline objects either have collision or do not read as solid obstacles; the objective marker is not occluded |
| Actual | The `joint` module is a 0.9 × 2.0 m anodised column with a dark splice plate at ~1 m. It stands exactly on the route line, has **no collider**, and the first-person camera passes through it (the module vanishes / fills the view for a moment). At spawn it partly covers the `cp_start` marker; in the gallery it is centred in a 3.2 m corridor; on the vault obstacles it can dominate the view when the player runs the centreline and hides the low wall behind a pillar |
| Frequency | Deterministic (7 placements) |
| Repro | `?dev=first_section` → walk forward through z = 10, through the gallery, and vault the first obstacle |
| Evidence | `01-spawn-forward.jpg`, `06-route-joint-inside.jpg`, `08-route-joint-before-gap-a.jpg`, `18-gallery-mid.jpg`, `25-vault-1-approach.jpg`, `26-vault-moment.jpg` |
| Suggested direction | Move the S0/S2 joints to the side walls or sink them into floor/ceiling seams; keep the obstacle-plane joints below the obstacle top or offset them. Requires a level-art decision; no collision change |

### F-03 — Crouching at the slide-duct lip fills the view with the ceiling slab

| Field | Value |
|---|---|
| Segment | S3 slide duct entrance (ceiling bottom y = 1.90, floor top y = 0.90) |
| Severity | **Minor** (feedback/readability; the `SHIFT · SLIDE` sign mitigates it) |
| Category | B + C |
| Status | **Open** — fixing it means changing camera posture height or authored ceiling; both are outside the allowed change set |
| Expected | A crouched player at the opening sees the 1.0 m slot and understands why walking in is blocked |
| Actual | Crouch (1.15 m) and stand (1.75 m) are both taller than the 1.0 m clearance. At the lip the eye is above the slab bottom and ~0.3 m from its face, so the screen is filled by the ceiling face; holding `Shift` + `W` only pushes against it (`z −46.71`). Sprint-slide (posture 0.90) is the only readable way through |
| Frequency | Deterministic |
| Repro | `?dev=first_section` → reach the duct → hold `Shift` and walk into the opening instead of sprinting first |
| Evidence | `20-duct-approach.jpg` (sign and opening), `21-duct-crouch-blocked.jpg` (blocked view), `22-duct-inside-slide.jpg` (correct slide view) |
| Suggested direction | A level-art/camera decision: lower the crouch eye height, keep the duct slot visible from the approach (e.g. recess/thin lip), or make the first crouch attempt give a readable cue. Do not change the 1.0 m clearance casually — it is the Q10(a) anti-bypass volume |

### F-04 — The vault mechanic has no in-level cue and the tutorial hint is Training-only

| Field | Value |
|---|---|
| Segment | S4 Vault Section |
| Severity | **Major (discoverability)** — requires human confirmation; the section is still passable by jumping/vaulting once known |
| Category | C (requires human) + code/UI inspection |
| Status | **Open** — product/tutorial decision, not a local fix |
| Expected | A player who starts First Section directly (without Training) can learn that `E` vaults a low obstacle before or at the first obstacle |
| Actual | No `E` sign, no interaction prompt (`hud.prompt` is empty at every vault pose), no controls list in the pause/main menu. `tutorial.steps.vault.hint` (“Press E near a low obstacle”) exists but `Application.buildHudState()` only supplies `tutorialHint` when `currentMode === "training"`. The “Vault” toast appears only **after** a vault. The duct, by contrast, has a `SHIFT · SLIDE` sign, so the inconsistency is visible inside the same level |
| Frequency | Deterministic (no cue) |
| Repro | `?dev=first_section` → reach the vault channel without reading external controls; observe that nothing names `E` |
| Evidence | `25-vault-1-approach.jpg`, `26-vault-2-approach.jpg`, `45-vault-2-vaulted.jpg`, `report.json` (`hud.prompt` empty in each); code: `Application.buildHudState()`, `UIManager.showMainMenu()`, `FirstSectionCity.ts` (only the slide sign) |
| Suggested direction | Add an `E · VAULT` route sign mirroring `SHIFT · SLIDE`, or surface the existing tutorial hint on the first vault obstacle. Needs a product decision; verify with a human playtest |

### F-05 — A tutorial toast takes priority over the checkpoint confirmation

| Field | Value |
|---|---|
| Segment | S0 checkpoint, fresh profile |
| Severity | **Minor** (feedback priority) |
| Category | A/B |
| Status | **Open** — cross-system UI semantics; changing toast priority affects all levels |
| Expected | Checkpoint activation is confirmed immediately |
| Actual | The first `.gl-toast` after entering `cp_start` is `Move` (tutorial step completed); the checkpoint toast is queued and appears ~1 s later. `report.json` records `firstToast: "Move"` and the eventual `toast: "Checkpoint reached: Starting Roof Checkpoint"` |
| Frequency | Reproducible on a fresh profile (tutorial steps not yet completed); not on a returning profile |
| Repro | Clear site data, `?dev=first_section`, walk into `cp_start` |
| Evidence | `05-checkpoint-start.jpg`, `report.json` → `scenarios.walkthrough.segments.checkpointStart` |
| Suggested direction | Give gameplay confirmations priority over tutorial step toasts, or suppress tutorial toasts while a checkpoint toast is queued. UI decision |

### F-06 — The gap drop is not visible from the approach (`requires human playtest`)

| Field | Value |
|---|---|
| Segment | Gap A and Gap B |
| Severity | **Not confirmed as a defect** — human judgement required |
| Category | C |
| Status | **Open / needs human** |
| Observation | From 0.4–1.3 m before the edge, looking level or even 66° down, the player sees the near roof, the red edge line and the far façade/roof — not the void. The jump is read from the route line ending, the 3.4/4.2 m separation and the objective marker beyond. Whether that is sufficient for a first-time player is a human judgement; the Step 3.4 evidence caption (“deck edge, void and roof B”) overstates the visible void |
| Evidence | `09-gap-a-edge.jpg`, `09-gap-a-edge-down.jpg`, `12-gap-b-edge.jpg`, `12-gap-b-edge-down.jpg` |
| Human check | Run at the gap without looking down; decide whether the drop is legible; then look down at the edge and judge depth readability |

### F-07 — Pause → Resume may leave mouse look disabled until the canvas is clicked (`not reproduced in automation`)

| Field | Value |
|---|---|
| Segment | Pause/Resume (affects First Section gameplay) |
| Severity | **Not confirmed** — potential Minor |
| Category | Code inspection; needs a real browser/human |
| Status | **Unverified** |
| Observation | A real browser releases pointer lock on `Esc`. `Application.resumeGameplayPort()` does not call `requestPointerLock`; only a click on the canvas does (`InputManager` `onCanvasClick`). The pause screen does not tell the player to click. Playwright's synthetic `Escape` paused the game but did **not** release pointer lock (the harness reported `lock=game-canvas`), so this path could not be exercised automatically |
| Evidence | Pause/restart measurements in `report.json` (`pointerLock: "game-canvas"` — automation artefact); code: `Application.resumeGameplayPort`, `InputManager.onCanvasClick` |
| Human check | In a real browser, press `Esc`, click **Resume**, and try to look around without clicking the game first. Record whether a prompt appears |

### F-08 — First Section content is present in the production bundle as dead code

| Field | Value |
|---|---|
| Segment | Build/production, not gameplay |
| Severity | **Minor** (build hygiene / unreleased-content exposure); pre-existing, not introduced by Step 3.6 |
| Category | A |
| Status | **Open** — production startup/registration is outside the allowed change set |
| Observation | `dist/assets/index-*.js` contains `geo_start_deck`, `Starting Roof`, `SHIFT · SLIDE` and `sp_entry_slide` (the authored level and city layer). The DEV **entry points** are correctly absent: 0 matches for `__glasslineDevLaunch`, `DevLaunch`, `__glasslineCapture`, `__glassline`; the level is only registered under `import.meta.env.DEV` in `Application`, so it is unreachable in production |
| Evidence | bundle greps in §2; `Application.ts` (`FIRST_SECTION_LEVEL_DEFINITIONS` imported statically, pushed only under `DEV`) |
| Suggested direction | If shipping size or hiding unreleased content matters, move the First Section registration into a DEV-only module loaded dynamically (like `DevLaunch`/`CaptureMode`). A build-pipeline decision |

### F-09 — Tutorial progression advances from First Section

| Field | Value |
|---|---|
| Segment | Whole route (fresh profile) |
| Severity | Observation, not a defect |
| Category | B |
| Status | **Open (product decision)** |
| Observation | During the first run the tutorial toasts `Move`, `Jump`, `Slide` and `Vault` completed and persisted. The tutorial is global by design, but a First Section run therefore advances first-time tutorial state that was authored for Training/early play. Decide whether tutorial progression should be level-scoped |
| Evidence | `10-gap-a-airborne.jpg` (`Jump` toast), `22-duct-inside-slide.jpg` (`Slide`), `26-vault-2-approach.jpg` (`Vault`), `05-checkpoint-start.jpg` (`Move`) |

### F-10 — Dev status overlay key hints do not match the implemented keys

| Field | Value |
|---|---|
| Segment | Dev diagnostics only (not player-facing) |
| Severity | **Minor (dev tooling)** |
| Category | A (code) |
| Status | **Open** |
| Observation | `Application.buildKeyHints()` advertises `R restart` while paused and `R retry` on Results, but `handleGameplayInput()` only processes `Restart` in the `gameplay` flow; pause and Results use menu buttons. `R` is therefore inert exactly where the overlay claims it works |
| Evidence | `Application.buildKeyHints()` / `handleGameplayInput()`; the browser run used the pause/Results **Restart/Retry** buttons successfully |

---

## 6. Changes applied in this step

**No production source change was made.** No gameplay, physics, camera, collision,
checkpoint, respawn, progression or authored-content file was modified.

Rationale, per finding:

| Finding | Why no fix here |
|---|---|
| F-01 | Requires collision/physics semantics or authored obstacle height — explicitly outside the allowed change set; needs a physics-focused decision with evidence (this report provides the timeline) |
| F-02 | Authored Architectural Kit placements (7 coordinates); a visual/level-art decision that changes the authored route look |
| F-03 | Requires camera posture/eye-height or the authored ceiling volume; the 1.0 m clearance is load-bearing for the Q10(a) anti-bypass rule |
| F-04 | Requires a new in-level sign or a HUD/tutorial presentation change (cross-system, product decision) |
| F-05 | Toast priority is shared UI semantics across all levels |
| F-06/F-07 | Not confirmed defects; require human playtest |
| F-08 | Production registration/startup is explicitly out of scope |
| F-09/F-10 | Product/dev-tooling decisions; F-10 is not player-facing |

The **new harness** (`tools/capture/playtest.mjs`) and its evidence are additive
tooling only. It does not run in production and does not alter gameplay.

---

## 7. Regression results

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run check` (Biome) | PASS — 208 files |
| `npm test` | PASS — 625/625 in 62 files |
| `npm run build` | PASS — production bundle built |
| `npm run validate` (combined) | PASS on the final tree |
| `git diff --check` | PASS |
| DEV First Section browser smoke | PASS — golden path 52/52 (Step 3.4 harness) and exploratory 43/43 |
| Production bundle DEV isolation | DEV entry points absent; First Section level content present as dead code (F-08) |
| Prologue | PASS — normal main-menu launch reaches `prologue_test` / `sec_rooftop`, session running, HUD visible, 0 console/page errors |
| First Section Prologue-only achievement | PASS — `prologueCompleted = false`, no Prologue completion; four checkpoints, no `checkpoint.prologue_all` |
| Results identity | PASS — `Level: First Section`, time and Retry/Main Menu actions |
| Restart / respawn | PASS — clean restart from Results and from pause; three deaths → three respawns; no duplicated listener |

---

## 8. Limitations of this playtest

1. **No human hands-on pass.** Every input was sent by Playwright. Subjective feel,
   comfort, difficulty, comprehension without prior knowledge and fairness are
   **not** claimed. §9 is the checklist for a person.
2. **Headless Edge is a proxy.** Rendering, physics and input are real, but frame
   pacing, pointer-lock behaviour on `Esc`, audio and OS-level input are not the
   same as a windowed session. Host load was high (`loadAvg ≈ 18`), so no
   performance conclusion is drawn.
3. **One route, closed-loop driving.** The harness follows the authored route with
   normal input and validates state; it cannot explore arbitrary player behaviour
   (e.g. wall-hugging, repeated vault spam, alt-tab).
4. **The 0.5 m bounce and the v1/v2 differences were explored with one-off probes**
   in addition to the published harness; their raw timelines are in the report for
   the published run, and the earlier probe outcomes are quoted as variability.
5. **No gamepad, audio, accessibility or localization review** was performed in this
   step beyond the existing automated suites.
6. **Not reproduced:** pointer-lock loss on pause → resume (synthetic `Esc` keeps the
   lock), gap-depth comprehension, the feel of the landing recovery. See §9.

---

## 9. Human hands-on status and checklist

**Human hands-on: NOT PERFORMED.** This is not hidden or replaced by the scripted
run. Before Step 3.6 can claim a *verified* gameplay experience, a person should do
the following (≈15–20 minutes, fresh browser profile, `?dev=first_section`):

1. **Spawn (15 s):** without reading anything, describe where to go. Note whether
   the centre joint reads as a barrier and whether the checkpoint marker is visible.
2. **Gap A:** run and jump normally. Then stand at the edge and look down — is the
   drop legible? Then try a standstill jump; is the failure and the respawn fair?
3. **Gap B:** repeat once; note whether the required run-up is learnable and whether
   the landing is comfortable.
4. **Plant step:** does the 0.9 m step read as jumpable at speed?
5. **Gallery:** run it twice; note any snag, camera discomfort or “solid-looking”
   pole that you pass through.
6. **Slide duct:** first try **crouch + walk** (do not read the sign first). Is the
   blocked view confusing? Then sprint-slide. Does the `SHIFT · SLIDE` sign read in
   time at sprint speed?
7. **Vaults:** without reading controls, try to pass all three. Record whether you
   discovered `E`; whether you tried jumping; then run into the first obstacle at
   sprint and describe the bounce (F-01). Rate it on a 1–5 “feels broken” scale.
8. **Stairs/finish:** note the finish-marker visibility and the Results content.
9. **Death/respawn:** after `cp_building_jump`, fall on purpose three times. Check
   camera orientation, control and the respawn position each time.
10. **Pause/resume (real browser):** press `Esc`, click **Resume**, and immediately
    try to look around. Does mouse look work, or is a canvas click required? Is
    there a prompt?
11. **Restart:** from Results and from the pause menu; confirm a clean spawn and
    no inherited checkpoint.
12. **Comfort:** rate camera at the 180° turn, inside the 3.2 m gallery and inside
    the 1.0 m duct (1–5). Note any motion discomfort.
13. **Tutorial toasts:** do `Move/Jump/Slide/Vault` feel like guidance or noise?
    Does the checkpoint toast arrive late (F-05)?

Record: pass/fail per item, screenshots of anything surprising, and a short verdict
on whether the route is understandable and fair without prior knowledge.

---

## 10. Residual risks and proposals for Step 3.7

1. **Fix F-01 first.** A collision bounce on the first vault obstacle is the most
   player-visible defect found; it needs a physics decision (step tolerance vs
   obstacle height vs controller response) and a regression test that charges the
   obstacle at sprint speed from several contact offsets and asserts a bounded,
   deterministic response. Do not tune it inside a playtest step.
2. **Decide the joint-placement rule (F-02).** Either give the route-centreline
   joints a purpose that reads (floor seams, wall reveals) or move them off the line;
   the spawn view and the vault view are the two places this matters most.
3. **Decide vault guidance (F-04).** The `SHIFT · SLIDE` sign is a good pattern; an
   equivalent `E · VAULT` cue (or the existing tutorial hint on the first obstacle)
   would close the largest comprehension gap without changing mechanics.
4. **Re-run the human checklist (§9).** The automated suite is now a good regression
   net; it cannot judge fairness or comfort.
5. **Consider the duct lip (F-03)** together with the camera owner: the 1.0 m
   clearance is load-bearing, so the readable fix is probably the approach view or
   the crouch camera, not the duct geometry.
6. **Build hygiene (F-08):** move DEV level registration behind a dynamic DEV-only
   module if unreleased content in the production bundle matters.
7. **Re-run this harness** after any physics/camera/content change:
   `node tools/capture/playtest.mjs --out-dir docs/evidence/first-section/step-3.6`.
   It needs no new dependencies and no browser download (system Edge + Playwright).

---

## 11. Evidence index

All frames are 1600 × 900 JPEGs from the live game with the HUD; `report.json`
contains the full check list and the measured state behind every frame.

| File | Scenario |
|---|---|
| `01-spawn-forward.jpg` | Spawn view; joint and checkpoint marker at z = 10 |
| `02-spawn-look-right.jpg` … `04-spawn-look-left.jpg` | Orientation: right/back/left |
| `05-checkpoint-start.jpg` | `cp_start` toast after the queued tutorial toast |
| `06-route-joint-inside.jpg` | Camera inside the non-collidable joint at z = 10 |
| `07-route-joint-after.jpg`, `08-route-joint-before-gap-a.jpg` | Joint exit; second joint before Gap A |
| `09-gap-a-edge.jpg`, `09-gap-a-edge-down.jpg` | Gap A edge, level and steep-down views |
| `10-gap-a-airborne.jpg`, `11-gap-a-landing.jpg` | Gap A jump and landing |
| `12-gap-b-edge.jpg`, `12-gap-b-edge-down.jpg` | Gap B edge views |
| `13-gap-b-airborne.jpg`, `14-gap-b-landing.jpg` | Gap B jump and landing |
| `15-plant-step-approach.jpg`, `16-plant-step-landing.jpg` | Plant step |
| `17`–`19-gallery-*.jpg` | Gallery entry, middle, exit |
| `20-duct-approach.jpg` | `SHIFT · SLIDE` sign and duct opening |
| `21-duct-crouch-blocked.jpg` | Crouch attempt: camera against the ceiling face |
| `22-duct-inside-slide.jpg`, `23-duct-stopped-inside.jpg`, `24-duct-exit.jpg` | Slide, stop inside, exit |
| `25-vault-1-approach.jpg` | Vault channel; joints on the obstacle planes |
| `26-vault-2-approach.jpg`, `26-vault-moment.jpg` | Vault approach; camera during `VAULTING` |
| `27-vaults-cleared.jpg` | `cp_vault` after the third obstacle |
| `28-stairs-approach.jpg`, `29-finish-podium.jpg` | Stairs and podium |
| `30-finish-approach.jpg`, `31-results.jpg` | Finish gate; Results (`Level: First Section`) |
| `32-restart-clean.jpg` | Clean restart from Results |
| `33-respawn-after-restart.jpg`, `34-respawn-third.jpg` | First and third respawn after restart |
| `40-look-limits.jpg`, `41-sharp-turn.jpg` | Pitch limit; 180° turn and new-view sprint |
| `42-gap-a-standstill-edge.jpg`, `43-gap-a-standstill-fell.jpg` | Standstill jump failure and recovery |
| `44-air-control-landing.jpg` | Air-control landing |
| `45-vault-2-vaulted.jpg`, `46-vault-3-approach.jpg` | Walk-speed vaults |
| `47-restart-from-pause.jpg` | Clean restart from the pause menu |

Raw data: [`report.json`](evidence/first-section/step-3.6/report.json) —
43 checks, session A/B scenario state, per-frame position/yaw/posture/HUD, console
and request diagnostics.
