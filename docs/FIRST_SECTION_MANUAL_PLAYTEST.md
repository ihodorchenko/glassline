# First Section — Manual Playtest Checklist

**Purpose:** the only checklist that can answer the subjective questions the
automated runs cannot: is the route understandable, is the camera comfortable,
does the vault prompt read at speed, is the checkpoint feedback noticeable?

**Scope:** `?dev=first_section` in a **desktop browser window** (not headless),
fresh browser profile, default settings (display quality `medium`, FOV as
shipped), one continuous session unless a step says otherwise.

**Status of the current build:** **Human hands-on: NOT PERFORMED.**
The Step 3.8 automated evidence (Playwright + headless Edge) covers ordering,
ranges and geometry, but it is *not* a human playtest. Do not mark this
checklist as passed without a person playing.

How to use: run the steps in order, write the observed result and any note, and
tick `Pass`/`Fail`. If a step fails, capture a screenshot and the time; the
report should say whether the failure reproduces.

---

## Setup

| Item | Value / step |
|---|---|
| Build | `npm run dev` → open `http://127.0.0.1:5173/?dev=first_section` |
| Browser | Windowed Microsoft Edge / Chrome / Firefox (record which) |
| Profile | Fresh site data (DevTools → Application → Clear site data) |
| Display | 1600 × 900 or larger, default DPR, no zoom |
| Audio | On (if reviewing cues) |
| Input | Mouse + keyboard; optional gamepad second pass |
| Recording | Screen capture recommended for the vault and duct steps |
| Tester / date | |
| Browser + version | |

---

## 1. Spawn and basic controls

**Do:** spawn, do not read the controls first. Describe aloud where to go, then
look around 360°, then W/A/S/D, mouse look, jump, sprint (`X`).

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| The route reads from the spawn: red route line, checkpoint ring, floating red marker. | | |
| Nothing stands on the route centreline between the spawn and the checkpoint (no non-collidable column in front of the marker). | | |
| `W`/`A`/`S`/`D`, mouse look, `Space` jump and `X` sprint respond immediately. | | |
| Speed HUD updates; `Esc` hint is visible. | | |

## 2. Run-up and Gap A

**Do:** sprint to the edge, jump (a normal running jump), land on roof B.
Then stand at the edge and look down; then try a standstill jump.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| The gap is readable in time for a normal run-and-jump. | | |
| Landing is stable (no bounce, no slide-off). | | |
| Looking down at the edge gives a sense of depth. | | |
| A standstill jump fails and respawns at the last checkpoint with no penalty loop. | | |

## 3. Gap B and landing

**Do:** repeat with the longer gap. Land, keep sprinting.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| The required run-up is learnable (the gap is not a surprise). | | |
| Landing and the next stretch are comfortable at sprint speed. | | |
| No involuntary camera or body motion. | | |

## 4. Plant step and gallery

**Do:** jump the 0.9 m step, then run the gallery twice, once on the centreline
and once hugging a wall. Look forward and at both walls.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| The step reads as jumpable at speed. | | |
| The gallery corridor is clear down the middle: no pillar or panel in the running line. | | |
| Wall-mounted detail (service portals, vents, wall joints) does not enter the walk path. | | |
| Camera is comfortable in the 3.2 m corridor; no clipping or flicker. | | |

## 5. Slide duct — screen readability and camera comfort

**Do (first):** try the duct **without** sliding: walk into it standing, then
hold crouch (`Shift`) and walk into it. Observe for 2–3 s while crouched.
**Then:** back up and sprint + `Shift` to slide through. Stop in the middle of
the duct once (release the keys) and look around.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| Standing at the lip: the lintel is above the eye; the slot is visible when crouched. | | |
| Crouched at the lip: the red band and the 1 m slot are readable; the screen is not a featureless metal wall. | | |
| Sprint-slide: the view stays under the ceiling; no frame where the ceiling fills the screen. | | |
| Stopping inside: the ceiling is rendered normally (not see-through), the camera stays below it. | | |
| Comfort rating while sliding (1 = uncomfortable, 5 = comfortable). | | |

## 6. Vault prompt on approach at different speeds

**Do:** approach the first vault obstacle at walk, then run, then sprint. Before
pressing anything, watch when `E · VAULT` appears and whether it is readable in
time. Repeat at a lateral offset (±1 m).

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| `E · VAULT` appears before the obstacle, early enough to read at sprint speed. | | |
| The prompt is a single line, does not flicker and does not overlap other HUD text. | | |
| At walk speed the prompt is clearly readable; at sprint it is readable enough to react. | | |
| The prompt remains visible while stopped against the obstacle. | | |

## 7. Vault with `E` and collision without `E`

**Do:** vault each of the three obstacles with `E` at a run. Then sprint into
the 0.50 m obstacle **without** `E` and without jumping.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| `E` vaults cleanly; the player lands beyond and keeps momentum. | | |
| Without `E`, the 0.50 m obstacle stops the player in front of it: no launch, no backward bounce, no self-vault. | | |
| The 0.70 m and 1.10 m obstacles also block cleanly. | | |
| Obstacle height reads before the approach (red stripe + silhouette). | | |

## 8. Stairs and surface transitions

**Do:** walk up both flights without jumping; step on and off the parapet/coping
edges; walk from concrete to metal surfaces and back.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| Stairs climb smoothly at walk and run; no snag or hop. | | |
| Surface transitions do not produce footstep/camera glitches. | | |
| The finish gate and the final checkpoint are visible from the stairs. | | |

## 9. Checkpoint — notification appearance and readability

**Do:** on the **fresh profile**, walk into the first checkpoint and watch the
toast. Repeat for the later checkpoints. Note the order if a tutorial toast is
also due.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| The checkpoint toast (`Checkpoint reached: …`) appears immediately when the checkpoint activates. | | |
| It is not delayed behind a tutorial toast (`Move`, `Jump`, `Slide`, `Vault`). | | |
| It stays on screen long enough to read (~2 s) and is not cut off. | | |
| A delayed tutorial toast still appears afterwards (nothing is lost). | | |

## 10. Kill volume, death and respawn

**Do:** fall into the void on purpose three times from different places.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| Falling triggers exactly one respawn per fall. | | |
| Respawn is at the active checkpoint, grounded, camera level, control back immediately. | | |
| No duplicate respawn, no stuck screen, no repeated toast. | | |

## 11. Pause → Resume (pointer lock)

**Do:** in a **real browser window**, press `Esc` (the browser releases pointer
lock), click **Resume**, and immediately move the mouse without clicking the
game.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| Mouse look works immediately after Resume, or the game tells the player to click to recapture. | | |
| Movement keys work; the timer resumes correctly. | | |
| The pause overlay does not flicker or stay partially visible. | | |

## 12. Restart and a second run

**Do:** restart from the pause menu; then finish the run and press **Retry** on
the Results screen. Play the first segments again.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| Restart returns to the initial spawn with no checkpoint carried over. | | |
| No toast from the previous run remains on screen. | | |
| Camera, HUD and pointer lock are correct; the second run behaves like the first. | | |
| Tutorial/checkpoint notifications behave consistently on the second run (tutorial may already be complete). | | |

## 13. Finish and Results screen

**Do:** cross the finish trigger and read the Results screen.

| Expected | Result (Pass/Fail) | Notes |
|---|---|---|
| The finish is unmistakable (gate/marker) and triggers once. | | |
| Results shows `Level: First Section`, the run time and the correct actions (Retry / Main Menu). | | |
| Prologue completion is **not** granted by a First Section run. | | |
| Retry and Main Menu both work; the menu shows no stale state. | | |

---

## Overall verdict

| Question | Answer |
|---|---|
| Is the route understandable without prior knowledge? | |
| Is the camera comfortable at speed, in the gallery and in the duct? | |
| Did the vault prompt teach `E` before the first obstacle? | |
| Was any involuntary movement observed (bounce, launch, teleport)? | |
| Any console error, freeze or lost control? | |
| Would a first-time player finish the section unassisted? | |

**Human hands-on status:** `NOT PERFORMED` / `PERFORMED (date, tester)`

**Evidence attached:** screenshots / recording paths, and any `report.json`
re-run command used to compare against the automated evidence.
