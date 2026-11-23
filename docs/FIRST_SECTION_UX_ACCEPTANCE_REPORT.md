# First Section — UX Acceptance (Step 3.9)

**Status: PASS WITH FINDINGS — no P0; no regression introduced by Step 3.8 /
3.8.1. Two pre-existing UX gaps confirmed (one P1, one P2) and three P3
observations recorded. Merge recommendation in §7.**

| Item | Value |
|---|---|
| Branch | `feat/first-section-remaining-polish` |
| HEAD (local = `origin`) | `ad835f620cbbd2e6bda649135b472d5c6cc7c383` |
| Working tree | Clean at start (no changes). At the end this report and `docs/evidence/first-section/step-3.9/` are the only additions — untracked, not committed. No tracked file changed. |
| Production code changed | **None** (evidence/report files only) |
| Browser | Microsoft Edge 157.0.4341.46, **headed real window**, 1600 × 900, DPR 1, locale `en-US` |
| Level route | DEV launch `?dev=first_section` (S0 Starting Roof → S5 Finish) |
| Profile | Fresh browser context per run (empty IndexedDB/localStorage), default settings |
| Input | Trusted Playwright keyboard/mouse through the production `InputManager`; **no teleports, no state edits, no tuning changes** |
| Evidence | [`docs/evidence/first-section/step-3.9/`](evidence/first-section/step-3.9/) — 4 runs, 79 frames + 2 video frames, 1 continuous video, per-run `report.json` |
| Video | [`session-1/session-1-playthrough.mp4`](evidence/first-section/step-3.9/session-1/session-1-playthrough.mp4) (65.4 s, 1963 frames, 1280 × 720) |
| Date | 2026-11-23 (Europe/Minsk) |
| Commit / push / merge | **Not performed** (explicitly out of scope) |

**One sentence:** the notification layer behaves as specified (checkpoint
preempts tutorial, tutorial is restored, one message at a time, no duplicates,
no overlaps, no console errors) and the four Step 3.8 fixes are visible in
play; the remaining UX problems are pre-existing: the mouse is never captured
without an undisclosed click (P1) and the gaps still do not read as gaps (P2).

---

## 1. Method

This step is a **manual-style acceptance pass**, not another automated gate. The
reviewer is an agent driving a **real headed Edge window**: the level is played
continuously from the spawn to the Results screen with normal input, and the
acceptance judgement is made **from the captured frames**, not from DOM
assertions.

What was actually done:

1. Four recorded play passes in a fresh profile
   ([`session-1`](evidence/first-section/step-3.9/session-1/),
   [`-5`](evidence/first-section/step-3.9/session-5/),
   [`-6`](evidence/first-section/step-3.9/session-6/),
   [`-7`](evidence/first-section/step-3.9/session-7/)): boot, mouse capture,
   pause/resume, Move → CP1, CP2, plant step, gallery, slide duct, CP3, three
   vaults, CP4, finish and Results.
2. 79 full-resolution 1600 × 900 frames (8 boot, 71 at the UX moments under
   review: toast appearance/duration/restoration, checkpoint activation, gap
   edge + look-down, airborne/landing, vault prompt, duct interior, Results),
   plus 2 frames lifted from the video for the toast-hide pair.
3. One continuous CDP screencast of the first pass (65.4 s) for motion/flicker.
4. DOM sampling every 25 ms **only as instrumentation** for toast timing,
   duplicate nodes and rectangle overlap; every claim below is backed by a frame
   or by the transition record, and the visual judgement is the reviewer's.
5. The review deliberately stopped at authored points instead of racing through,
   and re-ran passes when a jump/pointer-lock automation artefact invalidated a
   scenario (see §8).

The reviewer did **not** change geometry, physics, authored content, the toast
queue or the checkpoint mechanics. No file under `src/` was modified.

---

## 2. Scenario results

**32 scenario checks: 30 PASS, 2 FAIL** (C1 → F-3.9-02, E2 → F-3.9-03). Both
failures are pre-existing and documented below. Human-only items are **NOT
TESTED** and listed in §8.

| Area | Result | Note |
|---|---|---|
| A — Level start | **PASS** (5/5) | Clean first frame, stable HUD, Move toast at first movement, no overlap |
| B — Tutorial / Move | **PASS** (6/6) | Timing, readability, 1.75–1.80 s total, no re-appearance, restoration |
| C — Gap A / Gap B | **FAIL** (5/6) | No geometry/physics change; the **drop is not readable** from the approach (C1 / F-3.9-02) |
| D — Checkpoints CP1/CP2 | **PASS** (8/8) | Prompt, readable, 2.2 s, no duplicate, CP1→CP2→CP3→CP4, no tutorial conflict |
| E — Visual stability | **FAIL** (6/7) | No stuck/repeated/overlapping message, HUD hides correctly, 0 console errors; every toast leaves a ~125 ms **empty plate** at hide (E2 / F-3.9-03) |

### A — Level start

| # | Check | Result | Evidence / note |
|---|---|---|---|
| A1 | The first game screen appears correctly | **PASS** | `session-1/A-00-boot-01…08`, `A-01-first-gameplay-frame`. The scene is fully rendered; no black frame in the eight captured boot frames, no missing geometry. Mean luminance 203.5 → 200.8 → 200.8 across the transition. |
| A2 | No visual jumps at start | **PASS** | Frame 1→2 differs only where the translucent boot overlay (`GLASSLINE` wordmark, progress bars) fades out: 16.6 % of pixels changed, luminance −2.7. Every later frame differs by < 1.05 mean and < 1.4 % of pixels (clouds/birds). No camera or geometry pop. |
| A3 | HUD displayed correctly | **PASS** | `Speed 0.0 m/s` bottom-left, `ESC pause` bottom-right; no stray panels; speed-run/timer panel and tutorial panel are `display:none` in this mode (`A-01`, `S5-A-01`). |
| A4 | Tutorial hints appear correctly | **PASS (toast) / see F-3.9-04** | The `Move` toast appears 86 ms after the first `W` press (`session-1/B-01`, speed 1.2 m/s). There is no pre-movement HUD hint in First Section (by design, Training-only) — recorded as F-3.9-04, not a regression. |
| A5 | No toast over important UI | **PASS** | Toast is top-centre (22 px), HUD is at the three corners + bottom centre; **0 rectangle overlaps** in all four runs. `session-1/B-01`, `S7-D-12`. |

### B — Tutorial and Move

| # | Check | Result | Evidence / note |
|---|---|---|---|
| B1 | Move hint appears at the right moment | **PASS** | On `movement.started`, 86 ms after `W` (`raw.moveToast`, `session-1/B-01`). |
| B2 | Text is readable | **PASS** | White 0.9 rem text on `rgba(10,14,17,0.8)` with a red top rule, one line, over the sky (`B-01`, `D-03`). Subjective note: 14 px is small for a 900 px-tall window (see §6). |
| B3 | Sufficient display time | **PASS** | Total on-screen time per message: Move ≈ 1.75–1.80 s (split by preemption), Jump 1.77–1.83 s, Slide 1.79 s, Vault 1.76 s, checkpoints 2.17–2.22 s. |
| B4 | Correct behaviour when movement starts | **PASS** | The toast appears as the body starts moving and does not block input (`pointer-events: none`); the player keeps running. |
| B5 | No unexpected re-appearance | **PASS** | Returning profile (same context after a reload): walking for 1.6 s produced **no** `Move` toast (`session-1/E-06`, `E-07`; `raw.returningPlayer.toast` empty). |
| B6 | Interrupted hint is restored | **PASS** | `Move` is preempted by CP1 and replayed with its remaining time: 549–1153 ms + 600–1274 ms = **1.75–1.80 s total** (`session-1/D-03`, all run reports). |

### C — Gap A and Gap B

| # | Check | Result | Evidence / note |
|---|---|---|---|
| C1 | Obstacle visual structure is understandable | **FAIL (P2, pre-existing)** | The red edge line and the route line are visible, but the **drop is not**: from 0.6–1.4 m before the edge the far roof reads as adjacent, and looking down (pitch −0.62) shows a white facade, not a chasm. `session-6/C-01`, `C-02`, `C-05`, `C-06`. See **F-3.9-02**. |
| C2 | In-game hints are readable | **PASS** | No message is on screen at the edge. During the flight the slot can still hold CP1 or the restored `Move` (the faster pass reaches Gap A before CP1 clears); the `Jump` confirmation is then queued and appears after them, and it never covers the landing area (`session-1/C-03`, `session-7/C-03`, `C-07`). |
| C3 | Enough time to read the situation | **PASS with caveat** | The approach view is stable while standing; at sprint the only cue is the red line (see C1). The physical jump is comfortable from both edges. |
| C4 | No conflict between tutorial and game messages | **PASS** | Only one notification at a time and 0 overlaps. Because a checkpoint is `critical`, a `Jump` confirmation fired while CP1 is still visible is delayed behind it and replayed after — delayed, never lost (the same trade-off documented in 3.8 §4.6). |
| C5 | Success of the passage is clear | **PASS (observation)** | Landing is stable (no bounce or slide-off), the route line continues, and control returns immediately. There is no explicit "gap cleared" message; the landing is the cue. Accepted. |
| C6 | No geometry/physics/authored content changed | **PASS** | No `src/` change; gap take-off/landing positions and jump speed measured at the authored values (8.5 m/s). |

Measured crossings: Gap A take-off `z = −1.20…−1.26`, landing `z = −7.58…−7.64`,
0 respawns; Gap B take-off `z = −12.42…−12.45`, landing `z = −18.79…−18.82`,
0 respawns (`session-6`, `session-7`).

### D — Checkpoints CP1 and CP2 (plus CP3/CP4 in the full pass)

| # | Check | Result | Evidence / note |
|---|---|---|---|
| D1 | Confirmation appears in time | **PASS** | The confirmation is present in the activation frames of every pass (within the same sampler interval); Step 3.8 measured `checkpointDelay = 0 ms` at the same threshold. |
| D2 | Message is readable | **PASS** | Single line, e.g. `Checkpoint reached: Starting Roof Checkpoint` (352 × 37 px), white on dark, 2.2 s (`B-02`, `S7-D-06`, `D-09`, `D-12`). |
| D3 | No premature disappearance | **PASS** | Every checkpoint segment is 2172–2220 ms and is not replaced by a tutorial message. |
| D4 | No duplication | **PASS** | 0 duplicate toast DOM nodes in all runs; walking back through `cp_start` again produced **no** second confirmation (`session-1/D-05`, `D-06`; `activatedCheckpointIds = ["cp_start"]`). |
| D5 | Sequential checkpoints behave correctly | **PASS** | In one pass: CP1 → CP2 → CP3 → CP4, each exactly once, in order (`session-7`). |
| D6 | No conflict with tutorial toasts | **PASS** | CP1 preempted `Move` and the tutorial was restored; CP2/CP3/CP4 did not collide with `Jump`/`Slide`/`Vault`; 0 overlaps. |
| D7 | Natural `Move → CP1` | **PASS** | Reproduced in **4 passes** (`session-1`, `-5`, `-6`, `-7`): Move visible 495–1153 ms, CP1 2197–2220 ms, Move restored 600–1274 ms. |
| D8 | Natural `Move → CP1 → CP2` | **PASS** | `session-7`: Move 549 ms → CP1 2200 ms → Move 1225 ms → Jump 1825 ms → **CP2 2176 ms**, no duplication or overlap. CP1→CP2 are 31 m apart, so a natural CP1/CP2 overlap cannot occur; the back-to-back case is covered by Step 3.8.1's injected sequence, not re-injected here. |

### E — General visual stability

| # | Check | Result | Evidence / note |
|---|---|---|---|
| E1 | No stuck toast | **PASS** | Final toast hidden in every pass; after Results the slot is empty (`S7-E-06`, `raw.results`: `toast.visible = false`). |
| E2 | No empty toast | **FAIL (P3 cosmetic)** | At the end of **every** message the text is cleared at the start of the 150 ms opacity fade, so an empty plate stays visible for ~125 ms and collapses to 32 × 20 px at ≈0.9 opacity (`session-5` transition at 10427 ms; 11–35 such samples per run; video pair in F-3.9-03). |
| E3 | No visual flicker | **PASS** | Opacity fades 0→1 (≈150 ms) and 1→0; no show/hide/show inside a message; no duplicate nodes; the boot transition is a stable fade (A2). |
| E4 | No unexpected repeats | **PASS** | Each tutorial message fires once per profile; each checkpoint once per session; the only repeat is the by-design restored `Move` (F-3.9-05). |
| E5 | No overlapping messages | **PASS** | One toast node only; tutorial panel never visible; the `Vault` toast and the next `E · VAULT` prompt co-exist but are separated (top vs bottom) and semantically consistent (`S7-C-14`). A checkpoint toast and the contextual prompt can also co-exist (`S7-D-05`) — different systems, different screen zones, no overlap. |
| E6 | Interface hides correctly | **PASS** | Pause hides the HUD and shows `Paused` (`S5-E-01`); Resume restores the HUD with no leftover overlay (`S5-E-03`); Results hides the HUD (`S7-E-06`). |
| E7 | No browser console errors | **PASS** | 0 console errors, 0 page exceptions, 0 failed requests in all four runs. The only warnings (6) were pointer-lock rejections in the one pass whose window was not focused — an automation artefact, not a page error (§8). |

---

## 3. Notification timeline (all runs)

Every visible message in the four recorded passes. Times are from the in-page
sampler, boundaries within one 25 ms sample.

| Run | Message | Start | End | Duration |
|---|---|---:|---:|---:|
| 1 | Move | 3 759 | 4 254 | 495 ms (preempted) |
| 1 | Checkpoint reached: Starting Roof Checkpoint | 4 254 | 6 451 | 2 197 ms |
| 1 | Move (restored) | 6 451 | 7 725 | 1 274 ms |
| 1 | Jump | 21 677 | 23 452 | 1 775 ms |
| 5 | Move | 6 427 | 7 556 | 1 129 ms (preempted) |
| 5 | Checkpoint reached: Starting Roof Checkpoint | 7 556 | 9 754 | 2 198 ms |
| 5 | Move (restored) | 9 754 | 10 427 | 673 ms |
| 5 | Jump | 14 032 | 15 802 | 1 770 ms |
| 6 | Move | 1 203 | 2 356 | 1 153 ms (preempted) |
| 6 | Checkpoint reached: Starting Roof Checkpoint | 2 356 | 4 576 | 2 220 ms |
| 6 | Move (restored) | 4 576 | 5 176 | 600 ms |
| 6 | Jump | 10 104 | 11 877 | 1 773 ms |
| 6 | Checkpoint reached: Building Jump Checkpoint | 16 902 | 19 077 | 2 175 ms |
| 7 | Move | 1 677 | 2 226 | 549 ms (preempted) |
| 7 | Checkpoint reached: Starting Roof Checkpoint | 2 226 | 4 426 | 2 200 ms |
| 7 | Move (restored) | 4 426 | 5 651 | 1 225 ms |
| 7 | Jump | 5 651 | 7 476 | 1 825 ms |
| 7 | Checkpoint reached: Building Jump Checkpoint | 7 951 | 10 127 | 2 176 ms |
| 7 | Slide | 18 637 | 20 426 | 1 789 ms |
| 7 | Checkpoint reached: Slide Section Checkpoint | 21 355 | 23 527 | 2 172 ms |
| 7 | Vault | 25 527 | 27 283 | 1 756 ms |
| 7 | Checkpoint reached: Vault Section Checkpoint | 28 663 | 30 851 | 2 188 ms |

No message was ever empty while meant to be read, no message was cut by another
one, and no message appeared twice in a row.

---

## 4. Findings

### F-3.9-01 — The mouse is never captured without an undisclosed click, and Resume does not restore it (P1)

| Field | Value |
|---|---|
| Scenario | A (level start) and E (pause → resume) |
| Severity | **P1 — substantial UX, hinders normal play** (recoverable) |
| Reproducible | Yes; confirmed in the focused pass (session 5), and the same silent no-look state appeared in every exploratory pass. |
| Pre-existing | Yes — this is Step 3.6 **F-07**, previously "unverified"; now confirmed in a real headed browser. Not introduced by 3.8. |

**Steps to reproduce**

1. Fresh profile, open `?dev=first_section` in a windowed browser.
2. Move the mouse without clicking → the camera does **not** turn; the HUD
   shows only `Speed 0.0 m/s` and `ESC pause`.
3. Click the game canvas → the mouse is captured and look works.
4. Press `Esc` (the game pauses), click **Resume**.
5. Move the mouse without clicking the game → the camera does **not** turn;
   the HUD is back and there is no instruction.
6. Click the game canvas once → the mouse is captured again and look works.

**Expected:** the game tells the player that a click captures the mouse (first
entry and after Resume), or the Resume click itself re-acquires pointer lock
(it is an explicit user gesture).

**Actual:** pointer lock is only requested from the canvas `click` handler
(`InputManager.onCanvasClick`); `resumeGameplayPort` does not request it, and
neither the HUD nor the pause screen mentions clicking. Measured: before the
click `pointerLockElement = null`, yaw unchanged after a 200 px mouse move;
after the click `pointerLockElement = game-canvas`, yaw 0 → −0.44. After
Resume: flow `gameplay`, HUD visible, `pointerLockElement = null`, yaw unchanged
after a 240 px move; a click restores lock and look.

**Impact:** in a mouse-look parkour game the player may conclude that looking is
broken; after every pause the same happens. It is recoverable with a click, but
nothing on screen suggests it.

**Evidence**

- Frames: [`S5-A-01`](evidence/first-section/step-3.9/session-5/S5-A-01-spawn-no-pointer-lock.jpg),
  [`S5-A-02`](evidence/first-section/step-3.9/session-5/S5-A-02-mouse-without-lock.jpg),
  [`S5-A-03`](evidence/first-section/step-3.9/session-5/S5-A-03-mouse-look-works.jpg),
  [`S5-E-01`](evidence/first-section/step-3.9/session-5/S5-E-01-pause-screen.jpg) …
  [`S5-E-05`](evidence/first-section/step-3.9/session-5/S5-E-05-lock-recovered.jpg).
- Data: `session-5-report.json` → `raw.firstEntry` and `raw.pause`
  (`mouseLookWorks: false` after Resume, `true` after the click).
- Code: `src/input/InputManager.ts` (`onCanvasClick` → `requestPointerLock`),
  `src/app/Application.ts` (`resumeGameplayPort` does not request it).

**Recommendation:** **separate follow-up step** (does not block the Step 3.8
merge — it predates it and is outside its change set). Minimal fix: request
pointer lock in the Resume handler and add a one-line "click to capture the
mouse" hint at first entry, then re-run this check.

---

### F-3.9-02 — The gap drop is invisible from the approach (P2)

| Field | Value |
|---|---|
| Scenario | C (Gap A and Gap B) |
| Severity | **P2 — noticeable readability problem**, not blocking |
| Reproducible | Yes, deterministic (both gaps, every pass) |
| Pre-existing | Yes — Step 3.6 **F-06** ("needs human judgement"), now assessed from a real look-down. Authored content, out of scope for 3.8/3.9. |

**Steps to reproduce**

1. Walk to the Gap A edge (stop ≈ 0.6 m before it, `z = −1.39`) and look level.
2. Walk to the Gap B edge (`z = −11.61`, ≈ 1.4 m before it) and look level.
3. Look down (pitch −0.62) at both edges.

**Expected:** the drop and the required jump distance are readable in time for a
normal run-and-jump.

**Actual:** the far roof appears as an adjacent surface behind a red line; the
void is hidden by the near edge. Looking down shows a bright white facade going
down, not a readable chasm. Only the red edge line and the end of the route line
signal the gap. Frames:
[`S6-C-01`](evidence/first-section/step-3.9/session-6/S6-C-01-gap-a-edge.jpg),
[`S6-C-02`](evidence/first-section/step-3.9/session-6/S6-C-02-gap-a-look-down.jpg),
[`S6-C-05`](evidence/first-section/step-3.9/session-6/S6-C-05-gap-b-edge.jpg),
[`S6-C-06`](evidence/first-section/step-3.9/session-6/S6-C-06-gap-b-look-down.jpg).

**Impact:** a first-time player can misread the gap as a step-down and run off;
the first failure teaches the drop, which is a costly way to learn it. The jumps
themselves are comfortable once the distance is known (take-off/landing measured
above).

**Recommendation:** **separate level-art polish** (not blocking): a dark gap
interior or contact shadow under the lip, a contrasting far-wall shade, or a
distance marker on the edge. Any change is authored-content/geometry work,
explicitly out of scope here.

---

### F-3.9-03 — Every toast collapses to an empty plate before fading (P3)

| Field | Value |
|---|---|
| Scenario | E (visual stability) |
| Severity | **P3 — cosmetic** |
| Reproducible | Yes, at the end of every message |

**Steps to reproduce:** show any toast (Move / checkpoint / Jump / Slide /
Vault) and watch the top-centre plate at the end of its life.

**Expected:** the message fades out at its final size, or the plate disappears
with it.

**Actual:** `UIManager` clears `toast.textContent` first and then removes
`is-visible`; the 150 ms opacity transition therefore animates an **empty**
plate. The plate collapses instantly from the message width to 32 × 20 px and
fades from ≈ 0.9 to 0. Measured transition: `text = ""`, `visible = true`,
`opacity = 0.89`, `32 × 20` at 10 427 ms in
[`session-5-report.json`](evidence/first-section/step-3.9/session-5/session-5-report.json)
(`toast.transitions`); 11–35 such samples per run.

**Impact:** a small dark box with a red line pops at the top centre for ~0.1 s at
the end of each message. It is visible in the video but easy to miss during play.
The pair extracted from the session-1 video 70 ms apart shows the transition:
[`toast-hide-01-message.jpg`](evidence/first-section/step-3.9/session-1/toast-hide-01-message.jpg)
(`Move`, 69 × 37) →
[`toast-hide-02-empty-plate.jpg`](evidence/first-section/step-3.9/session-1/toast-hide-02-empty-plate.jpg)
(empty, 32 × 20, still ≈ 0.9 opaque).

**Recommendation:** **accept for the 3.8 merge**; optional one-line polish
(clear the text on `transitionend`, or hide before clearing). Pre-existing, not
introduced by 3.8.

---

### F-3.9-04 — The tutorial toast confirms the action instead of teaching it, and First Section shows no tutorial hint (P3, product decision)

| Field | Value |
|---|---|
| Scenario | A/B (first movement) |
| Severity | **P3 — product/design gap**, pre-existing |
| Reproducible | Yes |

**Steps to reproduce:** fresh profile, `?dev=first_section`, stand still and look
around before pressing anything; then press `W` and watch the top-centre slot.

**Expected:** an instruction at (or before) the first mechanic — the authored
`Move in any direction.` hint is available.

**Actual:** no instruction is on screen; `Move` appears only **after** the first
movement (86 ms after `W`).
The authored hint `tutorial.steps.move.hint` = "Move in any direction." exists,
but `Application.buildHudState()` only supplies `tutorialHint` when
`currentMode === "training"`; First Section runs in `prologue` mode, so the HUD
tutorial panel is never shown. This is the same root cause as Step 3.6 F-04/F-09
(the vault case was mitigated by the new `E · VAULT` prompt in 3.8; movement
still has only the route line).

**Impact:** the section is still learnable (route line, marker, red edges), but
the tutorial messaging reads as confirmation rather than instruction, and the
first run advances global tutorial state authored for Training (F-09).

**Evidence:** [`S1-B-01`](evidence/first-section/step-3.9/session-1/B-01-move-toast-appears.jpg)
(Move at 1.2 m/s); no tutorial panel in any frame; `session-1-report.json` →
`raw.moveToast`; code `Application.buildHudState()`.

**Recommendation:** **separate product step** (show the hint at the first
mechanic or accept confirmation-only). Not blocking; no code change in this step.

---

### F-3.9-05 — The restored `Move` toast can read as a repeat (P3, accepted by design)

| Field | Value |
|---|---|
| Scenario | B/D (`Move → CP1`) |
| Severity | **P3 — subjective, accepted** |

**Steps to reproduce:** fresh profile, `?dev=first_section`, walk into `cp_start`
within ~1 s of the first movement and watch the slot for ~4 s.

**Observation:** the interrupted tutorial toast is restored after the checkpoint
confirmation (495–1153 ms + 600–1274 ms = 1.75–1.80 s in total), visually
identical to its first appearance. A player who already moved sees `Move` again
~2.2 s later and may read it as a duplicate, although it is the remainder of the
same message.

**Impact:** low; the message is a completion confirmation and losing it would be
worse (that was the pre-3.8 behaviour). The queue is correct; only the
presentation is ambiguous.

**Evidence:** table in §3; [`S1-D-03`](evidence/first-section/step-3.9/session-1/D-03-move-restored.jpg);
Step 3.8 report §4.4.

**Recommendation:** **accept** (deliberate 3.8 behaviour). If desired later, mark
a restored toast visually (shorter duration or a subtle "continued" cue) — do not
reclassify it as critical.

---

## 5. What the Step 3.8 / 3.8.1 fixes look like in play

| Fix | Verified in this pass | Evidence |
|---|---|---|
| **F-02** route-clearance joints | No free-standing column at the spawn or on the start-roof centreline; the checkpoint ring and floating marker are unobstructed; the relocated joint modules sit on the penthouse wall beside the route (visible right of the lane in `A-01`). | `session-1/A-01`, `B-01` |
| **F-03** duct camera | The sprint-slide through the 1.0 m duct keeps the exit and the far stairs visible; the ceiling fills the upper ~55 % of the frame, not the whole screen, and is rendered normally (no see-through). The settled crouch-at-lip frame was not re-captured in this pass; the late-slide transition was not re-measured (documented residual in 3.8 §2.6). | `S7-C-11`, `S7-C-12` |
| **F-04** vault prompt | `E · VAULT` is visible at the bottom centre before the first vault obstacle (2.8 m from its centre, inside the 4 m display reach), advances to the next obstacle after a vault, and is a single line that never overlaps the toast. It is a level-wide affordance, so it also appears 3.7 m before the plant step near CP2 (a 0.9 m obstacle inside the vault height range) — accepted as a legitimate low-obstacle cue. Readability at **full sprint** is not certified (the vaults were taken at run speed, ~6 m/s). | `S7-C-13`, `C-14`, `D-05` |
| **F-05 + 3.8.1** toast priority | Checkpoint confirmation preempts a routine tutorial toast immediately, plays its full ~2.2 s, and the interrupted tutorial is restored **after** it (never before); CP1→CP2→CP3→CP4 appear once each and in order in one pass. The back-to-back critical case (the 3.8.1 fix) is not naturally reproducible — CP1 and CP2 are 31 m apart — and was not re-injected here. | §3 table; `session-7-report.json` |
| **No regression** | No new overlap, duplicate, stuck or empty-for-a-message toast; no console/page error; Results screen clean. | all four `report.json` files |

---

## 6. Subjective notes (not defects)

Recorded so they are not mistaken for findings: (a) the toast type is 0.9 rem
(≈ 14 px) — legible at 1600 × 900 but small on a large display; (b) the pause
and Results screens use a very bright paper overlay that washes the 3D background
to near-white — functional, but the left side is visually empty; (c) the duct
interior's striated metal texture is visually noisy at slide speed. None of these
meets the defect bar and none is a Step 3.8 change.

---

## 7. Merge recommendation

**Step 3.8 + 3.8.1: recommended for merge from the First Section UX standpoint —
PASS with findings.**

- No **P0** and no **new** P1 regression was found. All four fixes asserted by
  Step 3.8 are observable in a real playthrough, the four checkpoints confirm
  once and in order in one run, and the pause/Results overlays hide and restore
  the HUD correctly.
- **F-3.9-01 (P1)** is a real, reproducible UX problem, but it is the
  pre-existing Step 3.6 F-07 (input/pointer-lock capture), not a 3.8 change and
  not in this step's allowed change set. It should **not block this merge**, and
  it **must be scheduled before any public/demo build** (one-line pointer-lock
  request on Resume + a capture hint).
- **F-3.9-02 (P2)** is pre-existing authored-level readability (Step 3.6 F-06);
  schedule as level-art polish.
- **F-3.9-03/04/05 (P3)** — accept for this merge; optional later polish.
- This report is **not** a human playtest sign-off. Feel, comfort and
  first-time-player comprehension still require a person; see §8.

---

## 8. Untested scenarios and verification limits

1. **Human feel/comfort is not tested.** Camera comfort in the duct, the sense
   of speed at the gaps, and whether `E · VAULT` is readable at full sprint were
   not judged by a person; the vaults were taken at run speed (~6 m/s), not at
   sprint. Mark **NOT TESTED (human)**. `docs/FIRST_SECTION_MANUAL_PLAYTEST.md` remains
   `Human hands-on: NOT PERFORMED`.
2. **Pointer-lock release path is emulated.** A synthetic `Esc` pauses the game
   but does not perform the browser-level pointer-lock release; the release was
   reproduced with `document.exitPointerLock()` before clicking Resume, exactly
   what the browser does on a real `Esc`. The pause itself and everything after
   Resume were real. The first-entry lock test, by contrast, used a real click.
3. **Window focus is an automation dependency.** A headed Playwright window can
   start unfocused; Chromium then rejects pointer lock with
   `WrongDocumentError` and the game logs a warning (6 in the first pass, 0 once
   `bringToFront()` was used). This is an automation artefact, **not** a game
   error, and is excluded from the findings.
4. **Checkpoint toast latency** is not re-measured to the millisecond here; the
   in-page sampler shows the confirmation present within the same second as the
   activation, and Step 3.8 measured `0 ms` on the same path. The frames at
   CP1/CP2/CP3/CP4 are the evidence.
5. **No full second run** after completing the tutorial (only the returning-
   profile reload check, which shows the `Move` toast does not reappear).
   Retry/Restart from the Results and pause screens were not re-exercised in
   this step (covered by Step 3.8).
6. **Audio, gamepad, Firefox and Safari** were not evaluated. The pass ran in
   English at 1600 × 900 only: other viewports/aspect ratios and the RU
   localization were not exercised.
7. **Performance/frame pacing** is not a valid measurement here: screenshots
   stall the renderer (5 rAF gaps > 60 ms clustered around captures). The pass
   is not a performance gate.
8. Several harness passes failed mid-run for automation reasons (a synthetic
   `Space` occasionally not registering, a take-off plane set past the gap lip,
   a Resume click hitting a still-locked canvas). Those runs were discarded
   and the affected scenarios were re-run; the surviving runs are listed in §1.
   The harness is DEV-only evidence tooling and is not part of production.

---

## 9. Evidence index

[`docs/evidence/first-section/step-3.9/`](evidence/first-section/step-3.9/)

| Path | Content |
|---|---|
| [`README.md`](evidence/first-section/step-3.9/README.md) | Run index, reproduction commands, harness notes |
| [`session-1/`](evidence/first-section/step-3.9/session-1/) | Pass 1: boot sequence (`A-00-01…08`), spawn, Move, CP1 preemption/restoration, CP1 recross, Gap A edge/airborne/landing, returning-player reload, the toast-hide pair. Continuous video `session-1-playthrough.mp4` (65.4 s). |
| [`session-5/`](evidence/first-section/step-3.9/session-5/) | Pointer-lock first-entry test, real `Esc` pause, Resume without look, click to recover, Gap A look-down. |
| [`session-6/`](evidence/first-section/step-3.9/session-6/) | Both gap edges with look-down, both jumps, CP2. |
| [`session-7/`](evidence/first-section/step-3.9/session-7/) | Full route: Move → CP1 → CP2 → plant step → gallery → duct/Slide → CP3 → three vaults/Vault → CP4 → finish → Results. |
| [`session-*/session-*-report.json`](evidence/first-section/step-3.9/) | Per-run checks, poses, toast transitions/segments, overlaps, console diagnostics |
| [`session-*/session-*-summary.txt`](evidence/first-section/step-3.9/) | Human-readable run summary |
| [`harness/`](evidence/first-section/step-3.9/harness/) | DEV-only Playwright session scripts used for the pass (not production code) |
| [`session-1/toast-hide-01-message.jpg`](evidence/first-section/step-3.9/session-1/toast-hide-01-message.jpg), [`…-02-empty-plate.jpg`](evidence/first-section/step-3.9/session-1/toast-hide-02-empty-plate.jpg) | Two video frames 70 ms apart: `Move` plate → collapsed empty plate (supports E2/F-3.9-03) |

Run commands (dev server already on `:5325`; the harnesses own the browser):

```bash
node docs/evidence/first-section/step-3.9/harness/step-3.9-session.mjs      # pass 1 (+ video)
node docs/evidence/first-section/step-3.9/harness/step-3.9-session-5.mjs    # pointer lock / pause
node docs/evidence/first-section/step-3.9/harness/step-3.9-session-6.mjs    # gaps + CP2
node docs/evidence/first-section/step-3.9/harness/step-3.9-session-7.mjs    # full route
```
