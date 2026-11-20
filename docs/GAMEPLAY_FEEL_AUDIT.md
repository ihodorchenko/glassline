# Gameplay Feel Audit

## 1. Purpose

This document defines how Glassline evaluates, tunes, and verifies the quality of its first-person movement experience.

Movement is the primary gameplay experience. A mechanic is not complete merely because its state transition and physics implementation work: it must also be responsive, readable, predictable, and satisfying to control.

This document is an evaluation and quality-control contract. It does not replace the system specifications or authorize new mechanics.

## 2. Scope and authority

Apply this audit whenever a change can affect:

- Player input, input buffering, or control responsiveness.
- Ground movement, acceleration, deceleration, sprinting, jumping, falling, or landing.
- Crouching, sliding, vaulting, wall running, or wall jumping.
- Player collision, traversal transitions, or momentum.
- First-person camera behavior, motion feedback, or visual readability.
- Movement-related audio, effects, or HUD feedback.
- Runtime performance when it can affect perceived control or simulation consistency.

Relevant specifications remain authoritative for system ownership and expected behavior:

- `02_TECHNICAL_ARCHITECTURE.md`
- `03_GAMEPLAY_SPEC.md`
- `06_LEVEL_DESIGN_SPEC.md`
- `08_AUDIO_DESIGN_SPEC.md`
- `11_INPUT_SYSTEM_SPEC.md`
- `12_MOVEMENT_SYSTEM_SPEC.md`
- `13_CAMERA_SYSTEM_SPEC.md`
- `18_PLAYER_STATE_SYSTEM_SPEC.md`
- `23_HUD_SYSTEM_SPEC.md`
- `25_SETTINGS_SYSTEM_SPEC.md`
- `26_ACCESSIBILITY_SYSTEM_SPEC.md`

If this audit appears to conflict with a system specification, do not silently change ownership or contracts. Identify the conflict and reconcile the documents first.

## 3. Quality principles

### 3.1 Responsiveness

- Player commands should produce timely and understandable responses.
- Input buffering and coyote time must be intentional, bounded, and consistent with the Movement specification.
- Releasing input should have a predictable effect.
- No mechanic should depend on a favorable render frame rate.

### 3.2 Momentum continuity

- Acceleration, deceleration, air control, landing, and traversal transitions should form a coherent movement model.
- Mechanics should preserve or modify momentum according to explicit rules.
- Transitions must not introduce unexplained velocity loss, spikes, or direction changes.

### 3.3 Physical weight

- Movement should communicate speed, mass, contact, and impact without making control sluggish.
- Jump takeoff, fall, landing, slide, vault, and wall interactions should have distinct but coherent feedback.
- Camera and audio feedback must reinforce the physical event rather than obscure it.

### 3.4 Predictability and fairness

- The same input and equivalent gameplay conditions should produce equivalent outcomes within the deterministic simulation model.
- Valid traversal opportunities must be readable before the player commits whenever level design allows it.
- Collision and state-transition rules must not produce arbitrary-looking failures.
- Failure should be understandable and recoverable.

### 3.5 Skill expression

- Skilled play should reward route reading, timing, speed control, and momentum management.
- Assistance systems must not erase the intended skill or make outcomes opaque.
- Tuning must support both learning and mastery.

### 3.6 First-person readability and comfort

- The camera must preserve awareness of nearby geometry, landing surfaces, and traversal targets.
- Effects must not hide collision-relevant information.
- Comfort settings and reduced-motion behavior must remain effective.
- Visual feedback must not imply a gameplay state that the authoritative systems have not entered.

## 4. Ownership and implementation boundaries

- Movement owns locomotion physics and movement-state behavior.
- Input owns device abstraction and input interpretation.
- Camera owns first-person presentation and camera effects.
- Player State owns aggregated player lifecycle and capabilities.
- Level Runtime owns runtime level content and lifecycle.
- HUD presents authoritative state; it does not calculate movement outcomes.
- Audio reacts to authoritative gameplay events.
- Settings owns user-facing configuration semantics.

Do not implement a second movement model in the camera, presentation, or level code. Do not use visual transforms as authoritative physics state. Do not add a new mechanic as a tuning workaround.

## 5. Audit workflow

### Phase A — Establish the baseline

Before changing behavior:

1. Read this document and the affected system specifications.
2. Inspect the actual implementation, configuration, tests, and call sites.
3. Identify the authoritative owner of each affected behavior.
4. Run the existing relevant tests and available validation commands.
5. Reproduce the behavior in the running game where possible.
6. Record the baseline, including the scenario, input device, build, and observed result.

Do not tune values based only on source-code intuition.

### Phase B — Isolate the problem

Describe the issue as an observable player-facing symptom. Examples:

- Jump input is occasionally ignored near landing.
- Sprint acceleration feels abrupt.
- Landing removes too much horizontal speed.
- Slide entry is inconsistent at equivalent speeds.
- Wall-run activation is difficult to predict.
- Camera motion hides the next landing surface.

Separate the likely cause from the symptom. Check input sampling, fixed-step timing, state transitions, collision queries, camera smoothing, and frame pacing before changing tuning constants.

### Phase C — Form a hypothesis

For every proposed change, state:

- What observable problem it addresses.
- Which system owns the behavior.
- Which parameter, rule, or transition is responsible.
- Why the proposed change should improve the result.
- Which other mechanics may be affected.
- How the result will be measured or observed.

### Phase D — Make a controlled change

- Change the smallest relevant set of parameters or rules.
- Keep gameplay, physics, rendering, and presentation responsibilities separate.
- Avoid unrelated refactoring.
- Do not change multiple independent variables at once when evaluating feel.
- Preserve documented defaults and settings semantics unless the task explicitly changes them.

### Phase E — Verify

Repeat the same baseline scenarios under equivalent conditions. Compare before and after behavior. Run relevant automated tests, type checking, linting, and production build using the actual project scripts.

Perform browser verification for any change affecting actual movement, camera, input, collision, or traversal when runtime access is available.

### Phase F — Record and regress

Record the outcome, including unresolved issues and any trade-offs. Add or update automated regression coverage for deterministic logic and state transitions. Update implementation status only to the level actually verified.

## 6. Mechanics checklist

Evaluate each affected mechanic against the following criteria.

| Mechanic | Audit questions |
|---|---|
| Ground movement | Are acceleration, braking, turning, and stopping controllable and consistent? |
| Sprinting | Is the speed increase readable and predictable? Does sprint entry/exit behave consistently? |
| Jumping | Is input recognized reliably? Are takeoff, buffering, coyote time, and air control consistent with the specification? |
| Falling | Is the airborne state clear? Does control remain predictable? |
| Landing | Is contact detected reliably? Is horizontal momentum handled intentionally? Is impact feedback proportional? |
| Crouching | Are posture changes, clearance, and movement restrictions coherent? |
| Sliding | Are entry conditions readable? Does speed and friction behavior feel intentional? Does exit restore a valid posture and state? |
| Vaulting | Are valid obstacles detected consistently? Is the path clear of collision artifacts? Does the player retain understandable control? |
| Wall running | Is activation limited to valid surfaces? Is contact loss handled promptly? Is direction and duration predictable? |
| Wall jumping | Is launch direction understandable? Are wall contact and cooldown rules consistent? |

For every mechanic, inspect both its steady-state behavior and its entry, exit, interruption, and failure transitions.

## 7. Transition audit

At minimum, verify the transitions relevant to the changed mechanics:

- Grounded → Jumping.
- Jumping → Falling.
- Falling → Landing / Grounded.
- Grounded → Crouching.
- Crouching → Grounded.
- Running → Sliding → Running.
- Running → Vaulting → Grounded / Falling.
- Airborne → Wall Running → Falling.
- Wall Running → Wall Jumping → Falling.
- Any active traversal state → Respawn / recovery.

Check that incompatible states cannot remain active simultaneously, that interrupted transitions clean up correctly, and that stale input or events cannot reactivate a previous state.

## 8. Camera and feedback audit

### Camera

Check:

- Look input responsiveness and sensitivity consistency.
- Camera height during posture changes.
- FOV changes and their relationship to speed.
- Head bob, sway, shake, and landing feedback.
- Camera behavior during vaulting and wall running.
- Smoothing latency and overshoot.
- Reduced Motion and other comfort settings.
- Visibility of the next traversal target and landing surface.

Camera feedback should communicate movement, not compensate for incorrect physics.

### Audio and visual feedback

Check that:

- Footsteps and landing sounds correspond to actual contacts and surfaces.
- Slide and wall-run loops start and stop with authoritative states.
- Feedback intensity is proportional to the event.
- Important cues remain distinguishable in the mix.
- Visual effects do not obscure geometry or imply false collision.
- Feedback is not duplicated after restart, respawn, or session replacement.

## 9. Standardized manual scenarios

Use repeatable scenarios to compare behavior. Keep starting position, orientation, input device, and approach speed as consistent as practical.

| ID | Scenario | Expected observation |
|---|---|---|
| GF-01 | Walk, accelerate, and stop on flat ground | Smooth, repeatable acceleration and braking |
| GF-02 | Sprint from rest and release sprint | Predictable speed build-up and exit |
| GF-03 | Turn while running at several speeds | Controlled turning without unexplained snapping |
| GF-04 | Jump from standstill | Reliable takeoff and readable arc |
| GF-05 | Jump while sprinting | Intentional horizontal momentum retention |
| GF-06 | Press jump shortly before landing | Buffer behavior matches the specification |
| GF-07 | Jump just after leaving an edge | Coyote-time behavior matches the specification |
| GF-08 | Land after a low and a high fall | Distinct, proportional landing response |
| GF-09 | Crouch under a low obstacle | Clearance and posture remain correct |
| GF-10 | Slide at low and high entry speeds | Valid entry and coherent speed behavior |
| GF-11 | Exit slide on flat ground and slope | Stable recovery to a valid movement state |
| GF-12 | Vault equivalent obstacles repeatedly | Consistent detection and traversal |
| GF-13 | Approach invalid vault geometry | No false activation or collision exploit |
| GF-14 | Wall-run along a valid surface | Reliable contact, direction, and exit |
| GF-15 | Lose wall contact during wall-run | Prompt, stable transition out of wall-run |
| GF-16 | Wall-jump from valid contact | Consistent launch and state cleanup |
| GF-17 | Traverse a combined movement sequence | Momentum and transitions remain coherent |
| GF-18 | Repeat a route after respawn or restart | No stale state, input, effects, or resource accumulation |

Not every task requires all scenarios. Select the relevant scenarios and explain any omissions.

## 10. Evaluation record

For each audited issue, record:

- Scenario ID(s).
- Build or commit under test.
- Input device and relevant settings.
- Initial conditions.
- Observed behavior before the change.
- Change made and its rationale.
- Observed behavior after the change.
- Automated tests and runtime checks executed.
- Remaining limitations or regressions.

Use a simple 1–5 subjective rating when useful:

1. Unusable or unreliable.
2. Noticeably poor or inconsistent.
3. Functional, but with clear friction.
4. Good and predictable.
5. Excellent, coherent, and repeatable.

Subjective ratings are supporting observations, not substitutes for reproducible evidence. Do not claim numerical improvement without measurements or a documented evaluation method.

## 11. Issue severity

- **Critical:** input or movement failure blocks progress, causes unrecoverable state, or corrupts a run.
- **High:** a core mechanic is unreliable, unfair, or regularly causes unintended failure.
- **Medium:** noticeable responsiveness, readability, or feedback problem with a viable workaround.
- **Low:** minor inconsistency or polish issue that does not materially affect traversal.

Prioritize issues by player impact and frequency, not by how easy they are to fix.

## 12. Regression requirements

A gameplay-feel change must not silently break:

- Fixed-timestep simulation and frame-rate independence.
- Movement-state invariants and transition ownership.
- Collision and traversal validity.
- Checkpoint, respawn, and session isolation.
- Speedrun timing and route integrity.
- Input device abstraction.
- Accessibility and reduced-motion behavior.
- Audio event lifecycle.
- Performance and resource cleanup.

Add deterministic tests for rules that can be tested without rendering. Use manual runtime scenarios for experiential behavior that cannot be meaningfully asserted in unit tests.

## 13. Agent implementation rules

Agents working on gameplay feel must:

1. Read this document and the relevant system specifications before changing behavior.
2. Inspect the existing implementation and reproduce the issue before tuning, when possible.
3. Identify the owning system and preserve its contracts.
4. Establish a baseline and use repeatable scenarios.
5. Make the smallest controlled change that addresses the observed cause.
6. Avoid changing several unrelated tuning variables at once.
7. Verify the result against the same scenarios and relevant regressions.
8. Report what was actually tested and what remains subjective or unverified.
9. Update documentation when intended behavior or approved tuning contracts change.

Do not:

- Tune by intuition without inspecting the implementation.
- Hide a physics defect with camera effects.
- Use presentation code to change authoritative movement state.
- Add mechanics or dependencies outside the approved scope.
- Claim that a mechanic feels correct based only on compilation or unit tests.

## 14. Definition of success

A gameplay-feel change is accepted when:

- The original issue is reproducible or its baseline is clearly documented.
- The change addresses the identified cause within the correct system.
- Relevant repeatable scenarios show the intended behavior.
- No critical movement, transition, input, camera, accessibility, or session regression is introduced.
- Relevant automated checks and runtime verification are reported honestly.
- Remaining trade-offs and unverified aspects are explicit.

The goal is not to maximize animation, camera motion, or mechanical complexity. The goal is a first-person parkour experience that feels responsive, coherent, readable, and rewarding to master.
