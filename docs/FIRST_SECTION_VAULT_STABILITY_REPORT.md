# First Section — Vault Collision Stability & Traversal Discoverability (Step 3.7)

**Status: PASS — 53/53 exploratory browser checks, 52/52 golden-path checks,
650/650 unit/integration tests, 0 console/page errors. Human hands-on playtest
was NOT performed (see §10).**

| Item | Value |
|---|---|
| Base branch / SHA | `main` @ `0ba0f0eea4bbea01642df586cbd225008dad3f6f` (validated `origin/main` before work) |
| Feature branch | `feat/first-section-vault-stability` |
| Date | 2026-11-22 (Europe/Minsk) |
| Level route | DEV launch `?dev=first_section` (S0 Starting Roof → S5 Finish) |
| Browser evidence | [`docs/evidence/first-section/step-3.7/`](evidence/first-section/step-3.7/) (53 checks, 51 frames) and [`step-3.7-golden/`](evidence/first-section/step-3.7-golden/) (52 checks) |
| Harnesses | `tools/capture/playtest.mjs` (extended), `tools/capture/dev-route.mjs` (unchanged), `tools/capture/lib/route-math.mjs` (new) |
| Merge / PR | **Not performed** (explicitly out of scope) |

This step closes the two confirmed First Section findings from Step 3.6:

- **F-01 (Major):** sprinting into the 0.50 m vault obstacle without `E` launched
  the player upward and backwards instead of stopping.
- **F-04 (Major, discoverability):** nothing in First Section told the player that
  `E` vaults the obstacles, and the existing tutorial hint was Training-only.

It also fixes the Step 3.6 gallery lateral-position assertion (**Scope C**).

No authored geometry, obstacle height, movement tuning, global physics constant,
camera, checkpoint/respawn, progression or tutorial-progression logic was changed.

---

## 1. Scope

| Area | In scope | Result |
|---|---|---|
| A — F-01 collision stability | Root-cause investigation, minimal collision-response fix, regression tests | Fixed |
| B — F-04 discoverability | Contextual `E · VAULT` affordance across the existing HUD/localization systems | Implemented |
| C — harness correctness | Absolute-value gallery assertion + proof that both signs are detected | Fixed |

Explicitly out of scope and untouched: F-02 (route joint placement), F-03 (duct lip
camera), F-05 (toast priority), F-06/F-07 (human-judgement findings), F-08 (production
bundle registration), Gap A/B geometry, the global movement controller, the tutorial
progression model, and unrelated camera/window/UI/lifecycle code.

---

## 2. F-01 — Investigation (A1)

### 2.1 Authored geometry

The vault channel is authored in `FirstSectionLayout.ts`:

| Object | Deck top | Obstacle height | Obstacle top |
|---|---:|---:|---:|
| `geo_vault_1` | 0.90 m | **0.50 m** | 1.40 m |
| `geo_vault_2` | 0.90 m | 0.70 m | 1.60 m |
| `geo_vault_3` | 0.90 m | 1.10 m | 2.00 m |

The player capsule is 1.75 m tall with a 0.30 m radius; the character-controller skin
is 0.02 m; `maxStepHeight` is **0.40 m** (`MovementTuning`). A grounded body centre is
at y = 1.795 m, feet at y = 0.92 m.

### 2.2 Reproduced mechanism

An instrumented headless reproduction (real authored colliders, `PlayerSystem`,
1/60 s fixed step) recorded the sprint charge:

| Step | z | body y | velocity y | state |
|---|---:|---:|---:|---|
| approach | −58.78 | 1.795 | 0.00 | SPRINTING |
| contact | −58.60 | 2.34 | 3.43 | JUMPING |
| next samples | −58.03 | **3.14** | 2.43 | FALLING |

The same pose was then resolved directly through Rapier's controller, with and
without autostep, at a pure horizontal command of 0.1417 m:

| Controller setting | z | computed movement | `computedGrounded()` |
|---|---:|---|---|
| autostep **on** | −0.582 | (0, **+0.0836**, +0.0043) | false |
| autostep **on** | −0.68 | (0, **+0.2337**, **+0.0878**) | false |
| autostep **off** | −0.582 | (0, 0.0000, −0.0999) | true |
| autostep **off** | −0.68 | (0, 0.0000, +0.0001) | true |

A sweep of obstacle heights with `maxStepHeight = 0.40` showed that legal steps
(0.15–0.40 m) return an upward movement **with `grounded = true`**, while the 0.42,
0.45 and 0.50 m obstacles return a *partial* upward correction with
`grounded = false` (0.239 m, 0.263 m and 0.234 m in the sampled poses). 0.55 m and
above do not trigger autostep at all. That is why the 0.50 m obstacle misbehaved and
the 0.70 m obstacle always blocked cleanly.

### 2.3 Root cause

Two defects compounded:

1. **Rapier autostep attempted a step above `maxStepHeight`.** For the 0.50 m obstacle
   the controller returned a partial, unresolved climb (up to ~0.23 m of lift and a
   backward shove) instead of a clean block. The movement is not a legal step: the
   controller reports `computedGrounded() === false`, and in some poses it also
   returns a component *against* the commanded direction.
2. **Collision response converted the support lift into ballistic velocity.**
   `MovementModel.applyCollisionResult` computed
   `velocity.y = actualMovement.y / dt` for any non-grounded movement. A one-frame
   0.086 m support correction therefore became **+5.16 m/s** of upward velocity,
   the model entered `JUMPING`, and the player was launched into an uncontrolled
   arc. The same lift could also carry the capsule onto the obstacle top on a
   following frame, which explains the earlier runs where the obstacle was
   "self-vaulted" instead of blocking.

Neither the authored height nor the global physics tuning was wrong in isolation;
the defect is the collision response trusting a one-frame geometric correction as
player intent, combined with an engine step-up attempt outside the configured step
limit.

### 2.4 Rejected alternatives

| Option | Why rejected |
|---|---|
| Lower the 0.50 m obstacle | Changes authored geometry and the vault-height design; the obstacle is meant to be a vaultable 0.50 m wall |
| Raise `maxStepHeight` to 0.50 | Would make the obstacle legitimately walkable and would change stair/ramp feel everywhere; does not fix the velocity trust bug |
| Disable autostep entirely | Regressed the 35° ramp traversal and the stair-flight speed floor (`player-physics` tests); autostep is still needed as a fallback for small ledges |
| Change global gravity/movement constants | Unrelated to the mechanism and would affect every level |
| Tune the vault detector | The launch happens without `E`; detection is not involved |

---

## 3. F-01 — Implemented behaviour (A2)

### 3.1 Changes

| File | Change |
|---|---|
| `src/player/PlayerSystem.ts` | New `resolveControllerMovement()`. When the controller returns an upward correction the model did not request (`desiredTranslation.y <= 0`) and the controller could not land it (`computedGrounded() === false`) or the horizontal movement is against the command, the **same command is re-resolved with autostep disabled for that step**. The deterministic `computeStepGlide()` remains the authoritative step mechanism. Autostep stays enabled for genuine steps. |
| `src/player/MovementModel.ts` | `applyCollisionResult()` no longer turns an unrequested upward displacement into velocity (`verticalBefore <= 0 && actualMovement.y > 0` → `velocity.y = 0`). Commanded upward motion (jumps, wall jumps, rising vault arcs) is preserved. |
| `src/player/PlayerSystem.ts` | Corrected the misleading `includeDowncast` comment: the third `enableAutostep` argument is Rapier's `includeDynamicBodies`. |

No units, heights, colliders or tuning values changed.

### 3.2 Behaviour before/after

| Scenario | Before (Step 3.6) | After (Step 3.7) |
|---|---|---|
| Sprint into `geo_vault_1` (0.50 m) without `E` | Body y 1.795 → 3.14 m, z −58.78 → −56.34 (backwards), `JUMPING`/`FALLING`, 3/3 attempts, direction/height varied | Stops at z −58.83 (0.32 m in front of the authored face), body y stays 1.795 m (max support lift 0.01 m), vertical speed 0, grounded, `IDLE`; 3/3 attempts identical |
| Same, lateral offsets −1.8, −1.2, +1.2, +1.8 | Not characterised | All block at z −58.83; max rise 0.01 m; no backward bounce |
| Sprint into `geo_vault_2` (0.70 m) | Clean block | Clean block (unchanged) |
| Sprint into `geo_vault_3` (1.10 m) | Not asserted | Clean block |
| Press `E` while approaching | Vaults (existing behaviour) | Vaults unchanged: one `player:vault-started` (speed profile), `VAULTING`, no penetration, lands beyond |
| Jump near the obstacle | Not asserted | Normal 1.50 m standing-jump apex, clean landing |
| Stairs, ramps, slide, wall run, air control | Green | Green (629 pre-existing tests plus the new ones) |

The browser run measured `rise=0.01 m`, `backBounce=0 m`,
`closest=final=-58.83`, and the only observed states were
`IDLE`/`RUNNING`/`SPRINTING`.

### 3.3 Why this fix is minimal

The fix is confined to how the existing controller output is interpreted. It does
not introduce a second movement system, does not change the authored route, and
does not change the step/ramp/slide tuning that the rest of the game depends on.
Genuine steps still go through the same `computeStepGlide()` path and the same
Rapier autostep fallback; only unresolved, out-of-range step attempts are rejected.

---

## 4. F-01 — Regression tests (A3)

New `tests/unit/first-section-vault-stability.test.ts` (11 tests) uses the real
authored First Section collision layer, `PhysicsWorld` (Rapier), `PlayerSystem` and
`DEFAULT_MOVEMENT_TUNING` at a fixed 1/60 s step. It asserts intermediate values, not
only the final pose:

- peak feet height and peak/min vertical speed during the charge;
- every observed movement state (no `JUMPING`/`FALLING`/`LANDING`/`VAULTING`);
- per-step capsule/obstacle intersection (`world.intersectionPair`);
- final z against the authored front face and the backward bounce (`finalZ − closestZ`);
- emitted `player:jumped` / `player:vault-started` events;
- grounded state, final speed and body height;
- full per-step trajectory equality across two identical runs.

Coverage:

| Case | Assertion |
|---|---|
| Sprint into 0.50 m, centre | Stable block, no launch/self-vault |
| 0.50 m at five lateral offsets (−1.8, −1.2, 0, +1.2, +1.8) | Stable block and bounded lateral drift (browser-measured start x: −1.69, −1.31, 0, +1.10, +1.68) |
| Slow (analog 0.35), run and sprint approaches | Stable block at every supported speed |
| Two identical runs | Trajectories equal to < 1e-9 |
| 0.70 m control, sprint | Clean block |
| 1.10 m control, sprint | Clean block |
| Sprint + `E` | Exactly one speed vault, `VAULTING` observed, no penetration, lands beyond |
| Standing jump next to the obstacle | Normal 1.1–1.8 m apex, `JUMPING`→`LANDING`, grounded |
| Running jump over the 0.50 m obstacle | Clears it without penetration |
| `MovementModel.applyCollisionResult` unit cases | Unrequested lift yields 0 vertical speed; a real jump keeps its velocity |

Existing assertions were not weakened. The pre-existing vault/traversal suites
(including 3 obstacles × 3 lateral offsets at 6 m/s) remain green.

---

## 5. F-04 — Vault discoverability (B)

### 5.1 Existing systems reviewed

- **Interaction prompts** — `InteractionSystem` + `Application.localizeInteractionPrompt`
  feed the single bottom-centre HUD line (`.gl-hud__prompt`, rendered by `UIManager`).
- **Tutorial hints** — the top-left `.gl-hud__tutorial` panel; `Application` only
  supplies it when `currentMode === "training"`.
- **World signs** — the `SHIFT · SLIDE` sign is a static authored 3D plane with
  hardcoded English text in `FirstSectionCity.ts`; it is visible from far away and
  cannot follow the localization system.
- **Localization** — `hud.*` keys in `src/localization/resources/{en,ru}.ts`, with
  enforced key/placeholder parity.

No parallel hint architecture was introduced.

### 5.2 Chosen implementation

The existing HUD contextual-prompt line is reused; the vault affordance is a new,
lowest-priority owner of that line:

1. `PlayerSystem` now keeps the vault candidate it already detects each fixed step
   and exposes `isVaultAvailable()` (grounded, not `VAULTING`, candidate present).
   This is read-only presentation state; it never starts an action and publishes no
   movement/tutorial event.
2. `LevelMetadata.vaultAffordance` is a new optional level opt-in. Only
   `FIRST_SECTION_LAYOUT` sets `vaultAffordance: true`; Prologue and Training are
   unchanged.
3. `src/ui/ContextualPrompt.ts` holds the pure priority policy:
   **interaction target → Training tutorial hint → vault affordance**. The vault
   line is shown only when the level opts in, the same detection the action uses
   reports an obstacle, and nothing more specific owns the line.
4. `HudState.vaultPrompt` is localized through the existing `LocalizationManager`
   (`hud.vaultPrompt`) and rendered by the existing prompt element. The HUD still
   renders at most one line.

| Language | String |
|---|---|
| English | `E · VAULT` |
| Russian | `E · ОПОРНЫЙ ПРЫЖОК` |

### 5.3 Behaviour

| Situation | Behaviour |
|---|---|
| Far from a vaultable obstacle | Hidden (`text=""`, `is-visible` false) |
| Within the vault detector's range (~1.1 m ahead, any speed) | Shown as one line; stays visible while the player is blocked against the obstacle |
| Holding forward against the obstacle for 0.9 s | 15/15 samples visible, one DOM node, text unchanged — no flicker, no duplicate notification |
| Airborne or during `VAULTING` | Hidden immediately (post-step presentation consistency) |
| After a successful vault | Hidden (no candidate ahead) |
| Returning to the obstacle | Shown again |
| First Section, regardless of Training progress | Shown — the affordance is level-scoped, not tutorial-scoped |
| Prologue / Training | Not shown — those levels do not opt in; Training keeps its existing tutorial panel and order |
| HUD interaction prompts disabled in settings | Hidden with the rest of the prompt line (`hud.show_interaction_prompts`) |

The action still requires the existing minimum approach speed (2.5 m/s); the prompt
advertises the input, not a standing vault. The Step 3.6 report already noted that
the vault needs a running approach, and the Training exercise says the same.

### 5.4 Isolation

- **Prologue:** no `vaultAffordance` metadata → the policy can never select the line;
  the Prologue launch smoke shows no new prompt.
- **Training:** no `vaultAffordance` → unchanged; additionally, the policy suppresses
  the vault line whenever a Training tutorial hint is visible, so priorities cannot
  collide.
- **Tutorial milestones:** the affordance emits nothing. `player:vault-started` (the
  event that advances the `vault` tutorial step) is only emitted by an actual vault.
- **No duplicates:** one boolean → one string → one existing DOM node.

### 5.5 Tests

New `tests/unit/first-section-vault-hint.test.ts` (9 tests):

- unavailable far away, available inside the range, still available while blocked;
- stable across 120 fixed steps, with zero jump/vault events (no action, no tutorial
  progression);
- hidden while airborne, restored after landing;
- hidden during and after a vault, restored after re-entering the approach;
- cleared immediately on teleport/outside range;
- policy priority (level opt-in, vault availability, interaction prompt, tutorial
  hint) and stability across repeated evaluations;
- Prologue/Training metadata isolation;
- English/Russian strings both exist, contain `E` and the action name, and differ.

`tests/unit/localization-ui.test.ts` now requires `hud.vaultPrompt`; the existing
RU parity suite covers key/placeholder parity.

---

## 6. Scope C — Harness assertion correctness

**Defect:** `tools/capture/playtest.mjs` checked the gallery corridor with
`(galleryEntry.x ?? 9) < 1.0 && (galleryMid.x ?? 9) < 1.0 && (galleryExit.x ?? 9) < 1.0`.
Any negative deviation (e.g. x = −3.2) passed.

**Fix:** a new pure module `tools/capture/lib/route-math.mjs`:

- `isWithinLateralTolerance(x, tolerance)` → `|x| < tolerance`, finite numbers only,
  and missing/NaN samples always fail;
- `maxLateralOffset(samples)` → maximum absolute deviation, with a sentinel for a
  missing pose so it cannot be silently dropped;
- `lateralToleranceSelfCheck(tolerance)` → an explicit case table, including
  `x = −1.4` (the exact case the old predicate accepted), `x = +1.4`, both boundary
  values, a far negative offset and a missing sample.

The harness runs the self-check at startup, records it under
`harnessSelfChecks.lateralTolerance` in `report.json`, and fails the run if any case
is wrong. `tests/unit/capture-lateral-tolerance.test.ts` (5 tests) pins the predicate
and the self-check. The Step 3.6 report and its evidence were **not** modified; this
step has its own run in `docs/evidence/first-section/step-3.7/`.

Measured in the new run: `maxLateral=0 m` and the self-check passed all 11 cases.

---

## 7. Validation results

| Gate | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | PASS |
| Biome (changed files) | `biome check <files>` | PASS |
| Biome (repository) | `npm run check` | PASS — 215 files (no errors; pre-existing warnings only, none in changed files) |
| Unit/integration | `npm test` | PASS — **650/650** in 65 files |
| Production build | `npm run build` | PASS — 129 modules, 5,459.82 kB JS (1,960.73 kB gzip), 17.14 kB CSS |
| Full gate | `npm run validate` | PASS (typecheck + Biome + tests + build) |
| Whitespace | `git diff --check` | PASS |
| Golden path | `node tools/capture/dev-route.mjs --no-record --no-perf` | PASS — **52/52** checks, 12 frames, 0 errors |
| Exploratory browser | `node tools/capture/playtest.mjs --out-dir docs/evidence/first-section/step-3.7` | PASS — **53/53** checks, 51 frames, 0 console/page errors |
| Prologue menu/gameplay smoke | `node tools/capture/dev-route.mjs --skip-scenario --no-record` | PASS — **2/2**; main-menu Prologue button → `flow=gameplay`, `levelId=prologue_test`, `sessionLevelId=prologue_test`, 300 frames |
| First Section completion / Results | playtest walkthrough + golden path | PASS — `Level: First Section`, `prologueCompleted=false`, Retry/Restart clean |
| DEV entry points absent from production | grep `dist/assets/index-*.js` | PASS for `__glasslineDevLaunch`, `DevLaunch`, `__glasslineCapture`, `__glassline` |

### 7.1 Browser scenarios exercised

| Scenario | Result |
|---|---|
| Approach to the 0.50 m obstacle without `E` (sprint) | Blocked: rise 0.01 m, back-bounce 0 m, no jump/vault states |
| Three repeated charges from identical conditions | Same final z (−58.83), spread 0, rise 0.01 m |
| Four lateral offsets (±1.2, ±1.8; measured start x −1.69/−1.31/+1.10/+1.68) | All blocked at z −58.83, rise 0.01 m, no back-bounce, prompt seen in each, one prompt node |
| Vault with `E` (walk-speed and golden-path sprint) | `VAULTING` observed, lands beyond, prompt hides |
| Ordinary jump next to the obstacle | Apex 1.50 m, airborne, grounded landing |
| Air control / landing | Lateral 0.49 m; speed 8.32 m/s after landing |
| Hint far / near / blocked / after vault | Hidden / `E · VAULT` / 15/15 stable / hidden |
| Hint duplication while in range | 1 DOM node, no tutorial-panel conflict |
| First Section completion | Results screen, correct level, `prologueCompleted=false` |
| Prologue | Menu launch and gameplay smoke pass; no vault prompt (level not opted in, policy unit-tested) |

---

## 8. Browser evidence

| Artifact | Content |
|---|---|
| [`step-3.7/report.json`](evidence/first-section/step-3.7/report.json) | 53 checks, per-frame pose/HUD, console/request diagnostics, harness self-check |
| `48-vault-hint-far.jpg` | Prompt hidden 3.2 m before the obstacle |
| `49-vault-hint-near.jpg` | `E · VAULT` visible in range |
| `50-vault-hint-blocked.jpg` | Prompt stable while blocked against the 0.50 m obstacle |
| `52-vault-offset-blocked.jpg` | Blocked charge at x = −1.8 |
| `53-vault-jump-near.jpg` | Normal jump next to the obstacle |
| `54-vault-hint-after.jpg` | Prompt hidden after the vault |
| `25-vault-1-approach.jpg`, `26-vault-2-approach.jpg`, `45/46` | Vault channel context and walk-speed vaults |
| `31-results.jpg` | First Section Results |
| [`step-3.7-golden/report.json`](evidence/first-section/step-3.7-golden/report.json) | 52/52 golden-path checks, finish/Results, checkpoint/respawn/restart |
| [`step-3.7-prologue/report.json`](evidence/first-section/step-3.7-prologue/report.json) | 2/2 Prologue menu-launch + gameplay frames; `levelId=prologue_test`, `flow=gameplay` |

Latest run: `53 checks, 51 frames` in its own directory, generated by
`node tools/capture/playtest.mjs --out-dir docs/evidence/first-section/step-3.7`.
The Step 3.6 evidence directory was not touched.

---

## 9. Files changed

| File | Purpose |
|---|---|
| `src/player/PlayerSystem.ts` | F-01 partial-autostep rejection; F-04 vault availability signal; corrected autostep comment |
| `src/player/MovementModel.ts` | F-01 collision-response guard for unrequested upward corrections |
| `src/ui/ContextualPrompt.ts` | F-04 pure prompt-priority policy |
| `src/ui/UIManager.ts` | Renders the interaction or vault prompt in the existing single line |
| `src/app/Application.ts` | Resolves the localized vault prompt for the HUD state |
| `src/levels/LevelTypes.ts` | `LevelMetadata.vaultAffordance` opt-in |
| `src/levels/first-section/FirstSectionLayout.ts` | Opts First Section into the affordance |
| `src/localization/resources/en.ts`, `ru.ts` | `hud.vaultPrompt` |
| `tests/helpers/first-section-harness.ts` | Shared authored-level harness for the new suites |
| `tests/unit/first-section-vault-stability.test.ts` | F-01 regression matrix |
| `tests/unit/first-section-vault-hint.test.ts` | F-04 availability/priority/isolation |
| `tests/unit/capture-lateral-tolerance.test.ts` | Scope C predicate/self-check |
| `tests/unit/localization-ui.test.ts` | Requires the new HUD key |
| `tools/capture/lib/route-math.mjs`, `.d.mts` | Scope C predicate, self-check, typings |
| `tools/capture/playtest.mjs` | Scope C gallery assertion; F-01/F-04 browser checks; lateral evidence |
| `docs/FIRST_SECTION_VAULT_STABILITY_REPORT.md` | This report |
| `docs/IMPLEMENTATION_STATUS.md` | Step 3.7 record |
| `docs/evidence/first-section/step-3.7/` | New browser run evidence |
| `docs/evidence/first-section/step-3.7-golden/` | Golden-path run report |
| `docs/evidence/first-section/step-3.7-prologue/` | Prologue menu/gameplay smoke report |

---

## 10. Limitations of automated testing

1. **No human hands-on pass.** Every input was Playwright-driven. Feel, comfort,
   fairness, readability at speed and the subjective "does the prompt teach `E`?"
   question are **not** claimed. The Step 3.6 human checklist still applies.
2. **Headless Edge is a proxy.** Rendering, physics and input are real; frame pacing,
   real pointer-lock behavior, audio and OS input are not identical to a windowed
   session.
3. **Fixed 60 Hz.** The unit regression uses the production fixed step; frame-rate
   independence and long-session behavior are not measured here.
4. **Browser lateral offsets are closed-loop, not exact teleports.** The harness
   records the measured start x (`startX`) and requires it within 0.25 m of the
   requested offset; the collision assertions use the measured pose.
5. **The prompt is range-based.** It appears inside the vault detector's ~1.1 m
   range; a sprint crosses that in ~0.13 s. It persists when the player is stopped
   against the obstacle, which is the useful discovery moment, but a first-time
   sprint may only see it briefly. A wider hint zone or a world sign remains a
   product option (see §11).
6. **`E` at a standstill does not vault** (the pre-existing 2.5 m/s minimum entry
   speed). The prompt advertises the input; it cannot make a stationary vault work
   without changing gameplay.
7. **No audio/gamepad/accessibility review** beyond the existing suites.

---

## 11. Residual risks and known issues

1. **Prompt reach.** The affordance uses the execution detector's range. If a human
   playtest shows it is too late at sprint speed, the next minimal step is a
   level-authored approach sign or a wider hint-only reach; do not change the vault
   mechanics for this.
2. **Autostep guard scope.** The guard rejects unresolved upward corrections; it is
   not a general replacement for Rapier's autostep. The deterministic step glide
   remains the authoritative 0–0.4 m step mechanism, and the re-resolve is exercised
   only near too-high obstacles.
3. **Level opt-in maintenance.** A future level with vaultable obstacles must set
   `metadata.vaultAffordance: true` to advertise the action. This is intentional:
   it keeps the Prologue and Training unchanged until their design opts in.
4. **Pre-existing findings untouched:** F-02 (route joints), F-03 (duct lip),
   F-05 (toast priority), F-06/F-07 (need a human), F-08 (bundle dead code), F-09
   (tutorial progression scope).
5. **No merge / no PR.** The branch is pushed for review only.

## 12. Human hands-on status

**NOT PERFORMED.** The automated evidence above is not a substitute. A reviewer
should still run the Step 3.6 §9 checklist, adding: approach the first vault obstacle
at sprint and at walk without `E` (confirm a stop, no bounce), press `E` while
running (confirm the vault), stand in front and observe the `E · VAULT` line, then
check that it disappears after the vault and does not appear in the Prologue.

## 13. Merge / PR

No merge was performed and no pull request was created. The feature branch is pushed
to `origin` for review.
