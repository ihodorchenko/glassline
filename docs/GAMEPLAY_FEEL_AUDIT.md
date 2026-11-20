# GAMEPLAY_FEEL_AUDIT.md

Project: Glassline  
Document: Gameplay Feel Audit  
Status: Active  
Priority: High  
Scope: Movement, Camera, Input, Traversal, Player Feedback

---

## 1. Purpose

This document defines the gameplay feel audit and refinement process for Glassline.

The objective is to evaluate and improve the quality of the first-person parkour experience without expanding the initial gameplay scope or introducing unnecessary mechanics.

Glassline is a movement-first game.

Its primary gameplay experience is not exploration, combat, progression, or visual spectacle.

It is the feeling of moving continuously through an architectural environment while maintaining speed, reading geometry, choosing routes, and executing precise traversal actions.

The player should feel:

- Fast, without losing control.
- Responsive, without feeling weightless.
- Physically grounded, without excessive inertia.
- Skillful, with movement actions that reward timing and execution.
- Connected to the environment through predictable physical interactions.
- In control of the camera, even during complex movement.

The audit must evaluate the actual runtime experience, not only the correctness of the underlying implementation.

### 1.1 Primary Objective

Improve the quality of the existing movement system through controlled evaluation, tuning, and validation.

### 1.2 Secondary Objectives

- Identify inconsistencies between movement mechanics.
- Improve transitions between movement states.
- Improve camera feedback and first-person readability.
- Improve input responsiveness and predictability.
- Identify level geometry that interferes with movement quality.
- Improve the relationship between movement, camera, and audio feedback.
- Establish repeatable gameplay quality checks.

### 1.3 Non-Goals

This document does not authorize:

- Adding new movement mechanics.
- Expanding the initial movement scope.
- Replacing Rapier or Three.js.
- Replacing the existing Movement System architecture.
- Introducing a new animation framework.
- Rewriting Player State or Gameplay Session.
- Introducing online gameplay systems.
- Changing Speedrun validation rules.
- Redesigning the Prologue route without a documented gameplay reason.

New mechanics must be proposed separately and approved before implementation.

---

## 2. Relationship to Existing Specifications

This document complements existing system specifications.

It does not replace their ownership or implementation contracts.

| Document | Relationship |
|---|---|
| `02_TECHNICAL_ARCHITECTURE.md` | Architecture and runtime constraints |
| `03_GAMEPLAY_SPEC.md` | Core gameplay direction |
| `06_LEVEL_DESIGN_SPEC.md` | Traversal geometry and level structure |
| `11_INPUT_SYSTEM_SPEC.md` | Input processing and responsiveness |
| `12_MOVEMENT_SYSTEM_SPEC.md` | Movement physics and traversal |
| `13_CAMERA_SYSTEM_SPEC.md` | First-person camera behavior |
| `18_PLAYER_STATE_SYSTEM_SPEC.md` | Authoritative player state |
| `23_HUD_SYSTEM_SPEC.md` | Player-facing movement information |
| `25_SETTINGS_SYSTEM_SPEC.md` | Configuration ownership |
| `26_ACCESSIBILITY_SYSTEM_SPEC.md` | Accessibility requirements |
| `08_AUDIO_DESIGN_SPEC.md` | Audio feedback and movement sound |

### 2.1 Ownership Rules

The audit must preserve existing Single Ownership principles.

| Domain | Authoritative Owner |
|---|---|
| Physical velocity | Movement System |
| Acceleration and friction | Movement System |
| Movement state | Movement System |
| Player lifecycle state | Player State System |
| Input actions | Input System |
| Camera transforms and effects | Camera System |
| Audio playback and mixing | Audio System |
| Settings values | Settings System |
| Level geometry | Level content / Level Runtime |
| Gameplay progression | Progression System |
| Run timing and route validation | Speedrun System |

The audit may identify integration problems but must not introduce competing owners.

### 2.2 Tuning Ownership

All gameplay tuning values must remain centralized in their existing authoritative configuration.

Do not introduce a second set of movement or camera settings specifically for the audit.

Temporary experimental configurations are permitted only when isolated from production defaults and clearly identified as test configurations.

---

## 3. Gameplay Feel Principles

Every evaluation must consider the following principles.

### 3.1 Responsiveness

Input should produce an understandable and timely response.

The player must not experience unnecessary delays when:

- Starting movement.
- Changing direction.
- Jumping.
- Releasing jump.
- Starting a slide.
- Initiating a vault.
- Starting a wall run.
- Performing a wall jump.
- Regaining control after landing.

Responsiveness does not mean eliminating acceleration or inertia.

### 3.2 Momentum Continuity

Movement actions must feel like parts of one connected physical system.

Momentum should be preserved whenever physically reasonable.

Examples:

- Sprinting into a jump should increase traversal potential.
- A slide should reflect incoming speed.
- A vault should preserve forward movement.
- Landing should not arbitrarily eliminate horizontal velocity.
- Wall jumping should retain an appropriate portion of incoming momentum.
- Consecutive actions should form continuous movement sequences.

Unexplained velocity resets are unacceptable.

### 3.3 Physical Weight

The player should feel connected to the environment.

Movement must have:

- Acceleration.
- Deceleration.
- Gravity.
- Air resistance.
- Ground friction.
- Collision response.
- Appropriate impact feedback.

However, physical weight must never make movement feel unresponsive.

### 3.4 Predictability

Equivalent situations should produce equivalent results.

The player should be able to learn:

- How far a jump travels.
- How much speed a slide preserves.
- Which obstacles can be vaulted.
- When wall running can begin.
- How landing affects momentum.
- How much directional control exists in the air.

Unintended randomness must not determine traversal success.

### 3.5 Skill Expression

Movement should reward player mastery.

The difference between a beginner and an experienced player should emerge through:

- Better approach angles.
- Better jump timing.
- Better momentum management.
- More efficient route selection.
- Better use of traversal mechanics.
- Fewer unnecessary corrections.
- More consistent execution.

The game should not compensate for poor execution by silently automating every traversal action.

### 3.6 First-Person Readability

The player must understand their position, velocity, and relationship with nearby geometry.

Camera effects should communicate movement rather than obscure it.

---

## 4. Audit Methodology

The audit must be performed in controlled stages.

Do not begin by modifying movement constants.

### Phase A — Baseline Inspection

Inspect the current implementation and establish its actual behavior.

Required activities:

1. Read the existing Movement System specification.
2. Inspect MovementController and related movement components.
3. Inspect MovementTuning and actual runtime values.
4. Inspect CameraController and camera effect configuration.
5. Inspect InputManager and action processing.
6. Inspect Player State integration.
7. Inspect traversal detection and collision handling.
8. Inspect Training and Prologue geometry.
9. Inspect existing automated tests.
10. Run the current application in a browser.

Record:

- Actual movement values.
- Actual camera values.
- Current state transitions.
- Known limitations.
- Existing test coverage.
- Reproducible gameplay issues.

Do not assume specification values are identical to runtime values.

### Phase B — Isolated Mechanics Evaluation

Evaluate every movement mechanic independently.

The objective is to identify problems within individual mechanics before evaluating combinations.

### Phase C — Transition Evaluation

Evaluate movement mechanics in sequence.

Focus on momentum preservation, control continuity, collision handling, and state transitions.

### Phase D — Full Gameplay Evaluation

Perform complete Training and Prologue sessions.

Evaluate movement quality under realistic gameplay conditions.

### Phase E — Controlled Refinement

Make targeted adjustments.

Change one logical group of parameters at a time.

Repeat the same test scenarios after every change.

### Phase F — Regression and Acceptance

Verify that improvements do not introduce regressions in:

- Movement.
- Camera.
- Input.
- Collision.
- Checkpoints.
- Respawn.
- Training.
- Speedrun.
- Accessibility.
- Persistence.

---

## 5. Movement Mechanics Audit

Each mechanic must be evaluated independently and as part of combined traversal.

### 5.1 Ground Movement

Evaluate:

- Initial acceleration.
- Maximum running speed.
- Sprint acceleration.
- Deceleration after releasing input.
- Direction changes.
- Strafing.
- Diagonal movement.
- Movement on slopes.
- Ground friction.
- Ground detection stability.

Acceptance criteria:

- Movement starts without noticeable input delay.
- Acceleration feels progressive.
- Direction changes remain controllable at high speed.
- Releasing movement does not cause an unexplained velocity reset.
- Diagonal movement does not provide unintended speed advantages.
- Ground movement remains stable on supported surfaces.

### 5.2 Sprinting

Evaluate:

- Sprint activation.
- Sprint acceleration.
- Maximum speed.
- Sprint release.
- Sprint interruption.
- Sprint-to-jump transition.
- Sprint-to-slide transition.
- Sprint-to-vault transition.

Acceptance criteria:

- Sprint feels meaningfully faster than normal running.
- Sprint activation does not cause an artificial velocity discontinuity.
- Sprinting improves traversal potential.
- Sprint release produces predictable deceleration.
- Sprint transitions do not interrupt valid movement unnecessarily.

### 5.3 Jumping

Evaluate:

- Jump initiation.
- Jump buffering.
- Coyote time.
- Variable jump height.
- Jump apex.
- Gravity.
- Air control.
- Horizontal momentum preservation.
- Jump release behavior.
- Landing detection.

Acceptance criteria:

- Jump activation is reliable.
- Buffered input works consistently.
- Coyote time behaves predictably.
- Jump height responds correctly to input duration if variable height is supported.
- Air control provides meaningful directional adjustment.
- Horizontal momentum is preserved appropriately.
- The player can understand the jump trajectory through first-person feedback.

### 5.4 Falling

Evaluate:

- Transition from jumping to falling.
- Maximum falling speed.
- Air control during falling.
- Collision with vertical surfaces.
- Landing detection.
- Recovery after falling.

Acceptance criteria:

- Falling state transitions are stable.
- Vertical velocity does not reset unexpectedly.
- Ground detection does not produce false landings.
- The player does not remain indefinitely in an invalid movement state.

### 5.5 Landing

Landing is one of the most important gameplay feedback events.

Evaluate:

- Impact detection.
- Vertical impact speed.
- Horizontal momentum preservation.
- Landing on flat surfaces.
- Landing on narrow platforms.
- Landing after a long jump.
- Landing after wall jumping.
- Landing during high-speed traversal.
- Landing camera response.
- Landing audio response.

Acceptance criteria:

- Landing impact reflects actual physical conditions.
- Horizontal momentum is not arbitrarily removed.
- Landing does not produce unexpected movement state transitions.
- The player regains control immediately when appropriate.
- Landing feedback is noticeable without becoming distracting.
- Small height differences do not trigger exaggerated impact effects.

### 5.6 Crouching

Evaluate:

- Crouch activation.
- Collider resizing.
- Camera height transition.
- Movement while crouched.
- Standing up.
- Ceiling collision.
- Interaction with low geometry.

Acceptance criteria:

- Collider and camera height remain consistent.
- Standing up is blocked when overhead geometry prevents it.
- The player cannot become trapped between collider and camera states.
- Crouching remains responsive.

### 5.7 Sliding

Evaluate:

- Slide initiation.
- Minimum entry speed.
- Slide acceleration.
- Friction.
- Duration.
- Direction control.
- Collider height.
- Camera height.
- Slide-to-jump transition.
- Slide exit.
- Low obstacle traversal.

Acceptance criteria:

- Slide entry reflects incoming velocity.
- High-speed entry produces a meaningful difference.
- Slide duration emerges primarily from physics rather than an arbitrary timer.
- Momentum is preserved appropriately.
- The player can control the slide direction.
- Collider resizing does not cause penetration.
- Slide exit is predictable.
- The slide does not feel like an unrelated scripted animation.

### 5.8 Vaulting

Evaluate:

- Obstacle detection.
- Approach angle.
- Approach speed.
- Obstacle height.
- Obstacle width.
- Obstacle depth.
- Vault initiation.
- Movement trajectory.
- Momentum preservation.
- Landing after vaulting.
- Invalid vault rejection.

Acceptance criteria:

- Equivalent obstacles produce consistent results.
- Vault detection does not activate through unrelated geometry.
- The player does not become trapped inside obstacles.
- Vaulting preserves appropriate horizontal momentum.
- The camera follows the physical traversal.
- The player regains control predictably after the action.

### 5.9 Wall Running

Evaluate:

- Wall detection.
- Minimum entry speed.
- Approach angle.
- Wall contact stability.
- Vertical movement.
- Horizontal movement.
- Duration.
- Wall-run termination.
- Camera roll.
- Wall jump transition.

Acceptance criteria:

- Wall running activates only on valid surfaces.
- Entry conditions are predictable.
- The player does not unexpectedly detach from the wall.
- Wall-run duration is controlled.
- Camera roll communicates the action without obscuring navigation.
- Ending a wall run does not leave residual velocity or camera rotation.

### 5.10 Wall Jumping

Evaluate:

- Jump input recognition.
- Wall normal.
- Horizontal impulse.
- Vertical impulse.
- Incoming momentum preservation.
- Direction after jumping.
- Landing after wall jumping.

Acceptance criteria:

- Wall jump direction is understandable.
- The player is not pushed into the wall.
- Incoming momentum is preserved appropriately.
- Wall jumping does not produce unexplained speed amplification.
- The resulting trajectory remains controllable.

---

## 6. Movement Transition Audit

Individual mechanics can work correctly while their transitions feel poor.

This section evaluates the complete movement system.

### 6.1 Required Transition Matrix

| From | To | Primary Evaluation |
|---|---|---|
| Running | Sprinting | Acceleration continuity |
| Sprinting | Jumping | Momentum preservation |
| Running | Jumping | Jump responsiveness |
| Jumping | Falling | Apex transition |
| Falling | Landing | Impact and recovery |
| Sprinting | Sliding | Entry velocity |
| Sliding | Jumping | Input responsiveness |
| Sliding | Running | Exit velocity |
| Running | Vaulting | Detection and continuity |
| Falling | Wall Run | Entry conditions |
| Wall Run | Wall Jump | Direction and impulse |
| Wall Run | Falling | Exit behavior |
| Wall Jump | Landing | Momentum and impact |
| Any valid state | Respawning | State reset and recovery |

### 6.2 Transition Requirements

Every transition must define:

- Entry conditions.
- Exit conditions.
- Required input.
- Velocity behavior.
- Collider behavior.
- Camera response.
- Audio response.
- Invalid transition behavior.

### 6.3 Transition Acceptance

- No unexpected velocity resets.
- No duplicate movement states.
- No permanently active transient states.
- No unexpected control lock.
- No camera effect accumulation.
- No collider mismatch.
- No dependence on rendering frame timing.

---

## 7. Camera Feel Audit

The Camera System must reinforce movement quality without becoming a competing source of movement.

### 7.1 Look Responsiveness

Evaluate:

- Mouse sensitivity.
- Mouse input latency.
- Horizontal look.
- Vertical look.
- Pitch limits.
- Gamepad look.
- Device switching.
- Pointer lock recovery.

Acceptance criteria:

- Mouse look is immediate by default.
- Mouse input does not receive unnecessary smoothing.
- Gamepad look remains controllable.
- Sensitivity is applied exactly once.
- Pointer lock loss does not create incorrect camera state.

### 7.2 Field of View

Evaluate:

- Base FOV.
- Sprint FOV.
- Acceleration response.
- Deceleration response.
- Airborne behavior.
- Return to neutral.

Acceptance criteria:

- Dynamic FOV communicates speed.
- FOV changes do not obscure traversal geometry.
- Transitions remain smooth.
- FOV always returns to the correct base value.
- Reduced Motion settings are respected.

### 7.3 Camera Height

Evaluate:

- Standing height.
- Crouch height.
- Slide height.
- Jump response.
- Landing response.
- Respawn recovery.

Acceptance criteria:

- Camera height follows authoritative player posture.
- Camera does not penetrate the ground.
- Height transitions are smooth.
- Camera does not independently simulate physical movement.

### 7.4 Camera Bob

Evaluate:

- Running bob.
- Sprint bob.
- Frequency.
- Amplitude.
- Speed dependency.
- Acceleration dependency.
- Stop transition.

Acceptance criteria:

- Bob communicates movement without becoming distracting.
- Bob does not continue when movement stops.
- Bob does not accumulate over time.
- Bob does not interfere with precision jumps.
- Reduced Motion can minimize or disable it.

### 7.5 Landing Feedback

Evaluate:

- Impact-based intensity.
- Downward displacement.
- Rotational response.
- Recovery duration.
- Interaction with other camera effects.

Acceptance criteria:

- Camera response reflects actual impact.
- Repeated landings do not accumulate displacement.
- Recovery returns to neutral.
- Landing feedback does not obscure the next traversal target.

### 7.6 Wall-Run and Vault Feedback

Evaluate:

- Wall-run roll.
- Roll recovery.
- Vault anticipation.
- Vault trajectory.
- Interaction between temporary effects.

Acceptance criteria:

- Effects remain proportional to the movement action.
- Effects return to neutral.
- Temporary effects do not permanently modify the base transform.
- Multiple effects do not produce unstable camera behavior.

### 7.7 Camera Comfort

Test:

- Standard camera preset.
- Reduced Motion.
- High-speed traversal.
- Repeated jumps.
- Repeated landings.
- Wall-run sequences.
- Rapid direction changes.

The camera must remain readable and comfortable.

Accessibility preferences must not disable essential gameplay functionality.

---

## 8. Input Feel Audit

### 8.1 Keyboard

Evaluate:

- Key press response.
- Key release response.
- Simultaneous inputs.
- Diagonal movement.
- Jump buffering.
- Crouch and slide activation.
- Sprint activation.
- Focus loss.
- Input recovery.

Acceptance criteria:

- No stuck keys.
- No delayed critical actions.
- No accidental repeated jump execution.
- UI input does not leak into gameplay.
- Input remains consistent across supported frame rates.

### 8.2 Mouse

Evaluate:

- Pointer lock acquisition.
- Relative movement.
- Sensitivity.
- Input accumulation.
- Pointer lock loss.
- Pointer lock recovery.

Acceptance criteria:

- No dependence on absolute cursor position.
- No dropped mouse deltas during normal operation.
- No sensitivity applied in multiple layers.
- Mouse look remains predictable.

### 8.3 Gamepad

Evaluate:

- Left stick movement.
- Right stick camera control.
- Dead zones.
- Analog movement intensity.
- Analog camera response.
- Button transitions.
- Device disconnection.
- Device reconnection.

Acceptance criteria:

- Analog input remains smooth.
- Dead zones prevent unwanted drift.
- Device switching does not create invalid input state.
- Gamepad movement does not introduce inconsistent acceleration.

### 8.4 Input Latency

Measure input-to-response latency where practical.

Record:

- Input event timestamp.
- Input processing timestamp.
- Physics step in which the action is consumed.
- First visible response.
- Input device.
- Browser and display conditions.

Do not invent a latency target before establishing a reliable measurement method.

---

## 9. Traversal and Level Interaction Audit

Movement quality depends on level geometry.

The same mechanic can feel excellent in an open test environment and frustrating inside a poorly configured level.

### 9.1 Geometry Readability

Evaluate:

- Jump distance visibility.
- Platform edges.
- Obstacle dimensions.
- Vaultable geometry.
- Wall-run surfaces.
- Landing areas.
- Ceiling clearance.
- Route direction.
- Alternative traversal paths.

Acceptance criteria:

- Traversal opportunities are visually understandable.
- Important collision surfaces are predictable.
- Decorative geometry does not interfere with movement.
- The player can identify intended landing areas.

### 9.2 Collision Consistency

Evaluate:

- Capsule collision.
- Wall sliding.
- Ground detection.
- Slope handling.
- Corner collisions.
- Low ceilings.
- Narrow platforms.
- High-speed contact.

Acceptance criteria:

- No unexpected penetration.
- No artificial stopping on decorative objects.
- No permanent collision lock.
- No unintended velocity gain from collision resolution.
- Equivalent geometry behaves consistently.

### 9.3 Prologue Traversal

Evaluate the complete Rooftop Run route.

| Section | Gameplay Evaluation |
|---|---|
| Rooftop | Initial acceleration, movement introduction |
| Industrial | Sprinting, jumps, obstacle interaction |
| Construction | Vertical traversal, stairs, momentum |
| Skybridge | Approach speed, major jump, narrow landing |
| Finish | Final ascent, scaffold traversal, catwalk turn |

For each section evaluate:

- Route readability.
- Traversal opportunities.
- Required mechanics.
- Movement continuity.
- Recovery points.
- Landing safety.
- Alternative routes.
- Opportunities for speed optimization.

### 9.4 Training

Evaluate whether each exercise teaches the intended mechanic.

Training should:

- Introduce one primary mechanic at a time.
- Provide sufficient practice space.
- Give clear instructions.
- Provide useful feedback.
- Avoid unnecessary waiting.
- Allow repeated attempts.
- Prepare the player for combined traversal.

The final combined traversal exercise must demonstrate that the player can connect previously learned mechanics.

---

## 10. Movement and Sensory Feedback

Movement feedback should be consistent across physics, camera, and audio.

### 10.1 Audio Synchronization

Evaluate:

- Footsteps against actual movement speed.
- Surface-dependent footsteps.
- Landing sounds against impact intensity.
- Slide audio.
- Wall-run audio.
- Vault audio.
- Wind intensity during high-speed movement.
- Audio transitions after respawn.

Acceptance criteria:

- Audio reflects actual gameplay events.
- Footsteps do not continue when movement stops.
- Landing sounds correspond to real landings.
- Repeated state transitions do not create overlapping loops.
- Audio does not become the authoritative source of movement state.

### 10.2 Feedback Consistency

A movement event should have a coherent presentation.

Example:

**High-speed landing**

- Movement System reports landing and impact.
- Camera System produces an appropriate impact response.
- Audio System plays an appropriate landing sound.
- HUD displays only relevant information.

Each system reacts to the authoritative event through its existing integration contract.

No system should independently infer and redefine the landing outcome.

---

## 11. Performance and Stability

Gameplay feel is directly affected by runtime stability.

Evaluate:

- Fixed-step physics consistency.
- Rendering frame rate.
- Frame-time spikes.
- Physics catch-up behavior.
- Collision query cost.
- Allocation frequency.
- Garbage collection.
- Camera update stability.
- Input processing stability.

### 11.1 Required Measurements

Record:

| Metric | Purpose |
|---|---|
| Average FPS | General rendering performance |
| 1% low FPS | Frame-time consistency |
| Average frame time | Normal rendering cost |
| Maximum frame time | Worst observed spike |
| Physics step duration | Simulation cost |
| Physics catch-up steps | Simulation stability |
| Input-to-response latency | Responsiveness |
| Memory usage | Runtime stability |
| GC activity | Allocation-related interruptions |

Use the same browser, hardware, resolution, and test scenario when comparing results.

### 11.2 Performance Acceptance

- Physics remains independent of rendering FPS.
- Movement does not become unstable during frame-time spikes.
- Rendering interpolation does not create visible movement discontinuities.
- Physics does not enter an uncontrolled catch-up loop.
- Normal gameplay does not produce recurring severe frame spikes.
- Existing performance budgets remain valid.

Do not sacrifice movement quality solely to improve a single benchmark.

---

## 12. Controlled Tuning Process

All tuning must follow a repeatable process.

### 12.1 Baseline First

Before changing any values:

1. Capture current runtime values.
2. Run baseline scenarios.
3. Record observations.
4. Identify the specific problem.
5. Determine the owning system.
6. Identify the smallest relevant parameter group.

### 12.2 Change Isolation

Do not change acceleration, friction, gravity, jump impulse, camera bob, and FOV simultaneously.

Use isolated tuning groups.

Recommended groups:

| Group | Parameters |
|---|---|
| Ground Movement | Acceleration, deceleration, friction |
| Sprint | Speed, acceleration, transitions |
| Jump | Gravity, jump velocity, buffering, coyote time |
| Air Control | Air acceleration, air friction, directional control |
| Slide | Entry speed, friction, duration, exit behavior |
| Vault | Detection, trajectory, momentum retention |
| Wall Run | Entry conditions, duration, gravity |
| Wall Jump | Direction, horizontal and vertical impulse |
| Camera | FOV, bob, height, landing, roll |
| Input | Sensitivity, dead zones, processing |

### 12.3 Parameter Evaluation

For every tuning change, record:

- Previous value.
- New value.
- Reason for change.
- Expected effect.
- Test scenario.
- Actual result.
- Regression result.

### 12.4 Rejection Criteria

Reject a tuning change when it:

- Improves one mechanic but breaks another.
- Produces unexplained velocity discontinuities.
- Makes movement less predictable.
- Makes precision traversal harder without a clear gameplay benefit.
- Creates new collision problems.
- Introduces camera discomfort.
- Breaks Training exercises.
- Invalidates Speedrun route behavior.
- Reduces performance beyond acceptable limits.

A change is not automatically an improvement because it increases speed or jump distance.

---

## 13. Standardized Gameplay Test Scenarios

The following scenarios must be reproducible.

### GF-01 — Ground Acceleration

Start from rest and move forward.

Measure acceleration and time to reach the running speed band.

### GF-02 — Sprint Acceleration

Start from rest and activate sprint.

Measure acceleration and time to reach sprint speed.

### GF-03 — Direction Reversal

Reach high horizontal speed and reverse movement direction.

Evaluate deceleration and directional control.

### GF-04 — Sprint Jump

Reach sprint speed and jump across a known gap.

Evaluate jump distance, trajectory, and momentum preservation.

### GF-05 — Variable Jump

Perform jumps with different input durations.

Evaluate resulting jump height.

### GF-06 — Air Control

Jump while moving and apply directional input during flight.

Evaluate directional influence and consistency.

### GF-07 — Landing Momentum

Jump onto a flat platform and continue moving.

Compare horizontal velocity before and after landing.

### GF-08 — Slide Entry

Enter a slide at different approach speeds.

Compare entry velocity, duration, and exit velocity.

### GF-09 — Slide-to-Jump

Initiate a slide and jump at the earliest valid opportunity.

Evaluate responsiveness and momentum continuity.

### GF-10 — Vault Consistency

Approach the same obstacle repeatedly at equivalent speeds and angles.

Compare detection and resulting trajectories.

### GF-11 — Wall-Run Entry

Approach a valid wall at different speeds and angles.

Evaluate activation boundaries and stability.

### GF-12 — Wall Jump

Perform a wall run followed by a wall jump.

Evaluate direction, impulses, and momentum preservation.

### GF-13 — Narrow Landing

Jump onto a narrow platform at different approach speeds.

Evaluate air control, camera readability, and landing stability.

### GF-14 — Combined Traversal

Perform a continuous sequence:

Sprint → Jump → Land → Slide → Vault → Jump.

Evaluate continuity and player control.

### GF-15 — Full Prologue

Complete the entire Prologue without intentionally stopping.

Evaluate the complete gameplay experience.

### GF-16 — Repeated Attempts

Complete the same route multiple times.

Evaluate consistency and the ability to improve execution.

### GF-17 — Reduced Motion

Repeat representative scenarios with Reduced Motion enabled.

Evaluate gameplay readability and comfort.

### GF-18 — Input Interruption

Interrupt gameplay through focus loss and pointer lock loss.

Evaluate input recovery and movement stability.

---

## 14. Quantitative Evaluation

The audit must combine objective measurements and subjective evaluation.

### 14.1 Objective Measurements

Record where applicable:

- Horizontal velocity.
- Vertical velocity.
- Acceleration.
- Jump height.
- Jump duration.
- Jump distance.
- Slide duration.
- Slide entry and exit speed.
- Wall-run duration.
- Wall-jump velocity.
- Landing impact speed.
- Input-to-response latency.
- Physics step duration.
- Frame-time distribution.

### 14.2 Subjective Evaluation

Evaluate each category on a scale from 1 to 5.

| Score | Meaning |
|---|---|
| 1 | Broken or unacceptable |
| 2 | Noticeably poor |
| 3 | Functional but needs improvement |
| 4 | Good and consistent |
| 5 | Excellent and polished |

Categories:

- Responsiveness.
- Momentum continuity.
- Physical weight.
- Precision.
- Predictability.
- Camera readability.
- Movement comfort.
- Traversal satisfaction.
- Overall flow.

These scores are qualitative evaluation records, not automated gameplay metrics.

### 14.3 Evaluation Record

Each evaluation should use this format:

| Field | Value |
|---|---|
| Scenario | GF-XX |
| Build / commit | Exact identifier |
| Browser | Browser and version |
| Resolution | Test resolution |
| Input device | Keyboard / Mouse / Gamepad |
| Movement configuration | Configuration identifier |
| Camera configuration | Configuration identifier |
| Objective measurements | Recorded values |
| Subjective score | 1–5 |
| Observed issue | Description |
| Reproduction steps | Exact steps |
| Expected behavior | Expected result |
| Actual behavior | Observed result |
| Severity | Critical / High / Medium / Low |
| Status | Open / Investigating / Fixed / Verified |

---

## 15. Issue Severity

### Critical

- Movement becomes unusable.
- Player becomes permanently stuck.
- Physics produces invalid state.
- Traversal can consistently bypass required gameplay validation.
- Input cannot be recovered.

### High

- Core movement mechanic behaves inconsistently.
- Momentum is unexpectedly lost.
- Major traversal actions fail under normal conditions.
- Camera makes important traversal difficult to read.
- Frequent collision failures occur.

### Medium

- Movement feels inconsistent in specific scenarios.
- Camera feedback is excessive or insufficient.
- Minor traversal geometry problems.
- Unnecessary delays in movement transitions.

### Low

- Minor tuning improvements.
- Small camera or audio feedback inconsistencies.
- Non-blocking visual feedback issues.

Critical and High issues must be resolved before declaring the gameplay feel audit accepted.

---

## 16. Regression Requirements

Gameplay feel improvements must preserve the existing project functionality.

After relevant changes, verify:

### Movement

- Ground movement.
- Sprinting.
- Jumping.
- Falling.
- Landing.
- Crouching.
- Sliding.
- Vaulting.
- Wall running.
- Wall jumping.

### Camera

- Mouse look.
- Camera height.
- FOV.
- Bob.
- Landing response.
- Wall-run roll.
- Reduced Motion.

### Input

- Keyboard.
- Mouse.
- Gamepad.
- Pointer lock.
- Focus loss.
- Pause and resume.

### Gameplay

- Training exercises.
- Prologue completion.
- Checkpoint activation.
- Respawn.
- Speedrun timing.
- Route validation.
- Medal calculation.

### Long-Term Systems

- Statistics.
- Achievements.
- Progression.
- Save restoration.
- Settings persistence.

### Runtime

- No new console errors.
- No unexpected resource leaks.
- No physics instability.
- No unacceptable performance regression.

---

## 17. Implementation Rules for Agents

The following rules are mandatory.

1. Read `AGENT.md`.
2. Read `01_AGENT_RULES.md`.
3. Read `02_TECHNICAL_ARCHITECTURE.md`.
4. Read all relevant system specifications.
5. Inspect the actual implementation before making assumptions.
6. Establish a reproducible baseline.
7. Do not change architecture without a demonstrated need.
8. Do not introduce new gameplay mechanics under this audit.
9. Do not duplicate existing system responsibilities.
10. Do not introduce arbitrary constants outside authoritative tuning configuration.
11. Do not change multiple unrelated tuning groups simultaneously.
12. Preserve deterministic fixed-step physics.
13. Preserve existing Speedrun and Training contracts.
14. Preserve accessibility behavior.
15. Add or update automated tests when behavior changes.
16. Verify rendering, physics, and input changes in a real browser.
17. Record before-and-after measurements.
18. Update `IMPLEMENTATION_STATUS.md` when implementation status changes.
19. Document unresolved issues honestly.
20. Do not mark an improvement complete without regression verification.

### 17.1 Audit Before Implementation

The first agent task is an assessment, not a refactor.

The agent must produce:

- Current implementation inventory.
- Actual runtime tuning values.
- Existing test coverage.
- Reproducible gameplay scenarios.
- Identified problems.
- Severity classification.
- Proposed improvements.
- Expected impact.
- Regression risks.

Implementation must begin only after the assessment is complete.

### 17.2 No Unjustified Tuning

Do not blindly apply suggested values from the Movement System specification.

Existing values are starting points and design references.

The final values must be justified by measured and observed gameplay behavior.

---

## 18. Audit Phases and Deliverables

### Phase 0 — Baseline Audit

Deliverables:

- `GAMEPLAY_FEEL_BASELINE.md`
- Existing tuning inventory.
- Existing test inventory.
- Reproducible issue list.
- Baseline gameplay observations.

No gameplay tuning changes.

### Phase 1 — Core Movement

Evaluate:

- Ground movement.
- Sprint.
- Jump.
- Falling.
- Landing.
- Air control.

Deliverables:

- Movement evaluation.
- Identified issues.
- Approved tuning changes.
- Regression results.

### Phase 2 — Advanced Traversal

Evaluate:

- Sliding.
- Vaulting.
- Wall running.
- Wall jumping.
- Movement transitions.

Deliverables:

- Traversal evaluation.
- Transition matrix results.
- Momentum continuity results.
- Regression results.

### Phase 3 — Camera and Input

Evaluate:

- Mouse look.
- Gamepad look.
- Camera height.
- FOV.
- Bob.
- Landing.
- Camera roll.
- Reduced Motion.

Deliverables:

- Camera evaluation.
- Input responsiveness evaluation.
- Comfort assessment.
- Regression results.

### Phase 4 — Full Gameplay

Evaluate:

- Training.
- Prologue.
- Full route traversal.
- Repeated attempts.
- Speedrun execution.
- Geometry interaction.

Deliverables:

- Full gameplay evaluation.
- Level interaction issues.
- Gameplay flow assessment.
- Reproducibility results.

### Phase 5 — Final Acceptance

Verify all approved improvements.

Deliverables:

- `GAMEPLAY_FEEL_AUDIT_REPORT.md`
- Final tuning summary.
- Test results.
- Remaining known issues.
- Acceptance decision.

---

## 19. Final Acceptance Criteria

The audit may be accepted when all of the following conditions are satisfied.

### Movement Quality

- All initial movement mechanics behave consistently.
- Acceleration and deceleration feel responsive.
- Momentum transitions are understandable.
- Jumping is predictable.
- Landing does not arbitrarily remove momentum.
- Sliding, vaulting, and wall mechanics integrate into continuous traversal.

### Camera Quality

- Camera movement reinforces physical movement.
- Mouse look remains responsive.
- Camera effects do not accumulate.
- Camera remains readable during complex traversal.
- Reduced Motion is correctly respected.

### Input Quality

- Keyboard and mouse work consistently.
- Gamepad behavior remains predictable.
- Input focus transitions do not produce stuck actions.
- Critical movement actions are not unnecessarily delayed.

### Gameplay Quality

- Training teaches the existing movement mechanics.
- Prologue supports continuous traversal.
- The player can complete the route consistently.
- Repeated attempts allow improvement through execution.
- Traversal geometry behaves predictably.

### Technical Quality

- Fixed-step physics remains stable.
- Existing system ownership is preserved.
- Automated tests pass.
- Production build passes.
- Browser gameplay verification passes.
- No critical or high-severity gameplay issues remain.
- No unacceptable performance regression is introduced.

### Final Decision

The final report must explicitly select one of:

- **Accepted** — All required criteria are satisfied.
- **Accepted with Known Issues** — No critical blockers remain, but documented non-blocking issues exist.
- **Rejected** — One or more acceptance requirements remain unsatisfied.

---

## 20. Definition of Success

The most important success criterion is not a specific movement speed, jump height, or number of implemented mechanics.

It is the experience of playing Glassline.

A successful result means:

- The player understands how to move.
- The player can predict how movement will behave.
- The player can maintain and build momentum.
- Movement actions connect naturally.
- Mistakes feel attributable to execution rather than inconsistent physics.
- The camera reinforces the experience.
- The environment invites continuous traversal.
- Repeating a route feels rewarding because the player can become better at it.

**Movement should feel like one continuous system, not a collection of separate abilities.**

That is the standard against which Glassline gameplay quality must be evaluated.