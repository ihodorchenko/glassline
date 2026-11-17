# GAMEPLAY SPECIFICATION

## Glassline

**Document:** `03_GAMEPLAY_SPEC.md`  
**Version:** 1.1  
**Status:** Canonical High-Level Gameplay Specification  
**Depends on:** `00_PROJECT_BRIEF.md`, `01_AGENT_RULES.md`, `02_TECHNICAL_ARCHITECTURE.md`

---

# 1. Purpose

This document defines the high-level gameplay experience and shared gameplay principles for Glassline. Detailed implementation contracts are owned by the corresponding system specifications.

It describes:

- First-person player control.
- Movement and momentum.
- Jumping and landing.
- Sliding.
- Vaulting.
- Wallrunning.
- Walljumping.
- Player state machine.
- Camera behavior.
- Gameplay feedback.
- Input mapping.
- Mechanic validation.
- Gameplay tuning parameters.

The goal is to create a responsive first-person parkour system inspired by the movement philosophy of Mirror's Edge.

The game should emphasize:

- Speed.
- Momentum.
- Flow.
- Precise movement.
- Spatial awareness.
- Continuous traversal.
- Readable level geometry.

The player should feel that movement is a connected system rather than a collection of isolated actions.

This document is a high-level gameplay contract, not a replacement for system-level specifications. In case of implementation detail or ownership conflict, the relevant system specification is authoritative. Initial-release scope is defined by `00_PROJECT_BRIEF.md`; implementation sequencing and completion status are tracked in `IMPLEMENTATION_STATUS.md`.

---

# 2. Gameplay Philosophy

## 2.1 Core principles

### Momentum matters

Player movement should preserve momentum.

The player should not stop instantly when releasing movement input.

Jumping, sliding, vaulting, wallrunning, walljumping, and landing should influence the player's horizontal velocity.

### Movement should feel responsive

Input should produce predictable results.

The player should have direct control over movement direction without making the character feel weightless.

### Parkour should be contextual

Some actions require specific environmental conditions.

Examples:

- Vaulting requires a suitable obstacle.
- Wallrunning requires a valid wall.

### Mechanics should connect

A good movement sequence should allow combinations such as:

```text
SPRINT
  ↓
JUMP
  ↓
VAULT
  ↓
LAND
  ↓
SLIDE
  ↓
JUMP
  ↓
WALLRUN
  ↓
WALLJUMP
  ↓
LAND
```

The system should preserve momentum whenever physically and mechanically appropriate.

### Failure should be understandable

The player should understand why an action failed.

Examples:

- Insufficient speed.
- Obstacle is outside the supported vault envelope.
- Wall contact is lost.
- Landing surface is unavailable.

Avoid arbitrary failures that feel disconnected from the environment.

---

# 3. Coordinate System and Movement Convention

The project uses the coordinate convention defined in `02_TECHNICAL_ARCHITECTURE.md`.

Initial convention:

- Y axis: up.
- X axis: horizontal right.
- Z axis: horizontal depth.
- World distance: meters.
- Time: seconds.
- Velocity: meters per second.
- Acceleration: meters per second squared.

For the initial player controller:

- Camera forward direction determines the intended forward movement direction.
- Player movement is primarily constrained to the horizontal plane.
- Vertical movement is controlled by jumping, gravity, and parkour actions.

The exact forward vector convention must remain consistent across camera, player, level geometry, and physics.

---

# 4. Player Controller

## 4.1 Responsibilities

The player-facing controller receives normalized gameplay input and forwards movement/action requests to the Movement System.

It may:

- Forward normalized movement and action input.
- Request supported movement actions.
- Expose the current player movement state to presentation systems.

The Movement System owns locomotion, movement-state transitions, traversal execution, and movement physics. The controller must not become a second owner of movement rules or write physics velocity independently.

The controller does not own rendering or low-level Rapier implementation. See `12_MOVEMENT_SYSTEM_SPEC.md` and `18_PLAYER_STATE_SYSTEM_SPEC.md` for authoritative contracts.

## 4.2 Player representation

The player uses:

- A physics capsule.
- A first-person camera.
- Procedural first-person hands.
- A movement state machine.

There is no requirement for a full third-person character model.

## 4.3 Initial player dimensions

Initial collider and camera dimensions are owned by `12_MOVEMENT_SYSTEM_SPEC.md` §5.3 (player collider, capsule dimensions, eye heights, ground detection).

This document does not duplicate those values. The collider dimensions and camera position must be calibrated together.

During sliding, the physical representation must become lower without allowing the collider to intersect the ground.

---

# 5. Input Specification

## 5.1 Default controls

| Action | Input |
|---|---|
| Move forward | W |
| Move backward | S |
| Move left | A |
| Move right | D |
| Look around | Mouse |
| Jump | Space |
| Sprint | Left Shift |
| Slide | Left Ctrl |
| Interact / Context action | E |
| Pause | Escape |

The initial prototype targets keyboard and mouse.

Controller support is optional future work.

## 5.2 Input processing

InputManager must normalize browser input into gameplay actions.

Gameplay systems must not directly depend on keyboard event objects.

Input values should be sampled consistently with the game loop.

## 5.3 Input buffering

Some actions should support short input buffering.

For example:

- Jump pressed shortly before landing.
- Jump pressed while approaching a vault obstacle.
- Context interaction pressed just before entering a valid interaction range.

Buffered actions must be discarded when their conditions are no longer valid.

Per-action buffer durations are owned by the consuming systems. The initial jump and coyote-time values are defined in `12_MOVEMENT_SYSTEM_SPEC.md` §6.2; interaction timing is defined in `14_INTERACTION_SYSTEM_SPEC.md`.

## 5.4 Mouse look

Mouse look should provide:

- Horizontal rotation.
- Vertical rotation.
- Configurable sensitivity.
- Vertical rotation limits.

Initial pitch limits:

```text
Minimum: -85 degrees
Maximum: +85 degrees
```

Mouse movement should not directly change the player's physical velocity.

---

# 6. Movement Model

Movement is the foundation of the entire gameplay system.

All parkour mechanics should use the same movement model where possible.

## 6.1 Movement states

The canonical movement state set is defined in `02_TECHNICAL_ARCHITECTURE.md` §10.4 and `12_MOVEMENT_SYSTEM_SPEC.md` §7.1:

- IDLE
- RUNNING
- SPRINTING
- JUMPING
- FALLING
- LANDING
- SLIDING
- VAULTING
- WALLRUN
- WALLJUMP

Walking is a locomotion band within `RUNNING`. Crouching is a posture modifier, not a separate canonical movement state.

`18_PLAYER_STATE_SYSTEM_SPEC.md` defines the aggregated player lifecycle state; it is not duplicated here.

## 6.2 Initial movement parameters

Initial tuning values are owned by `12_MOVEMENT_SYSTEM_SPEC.md` §6.1.

This document does not duplicate speed, acceleration, friction, or air-control numbers. They must be centralized in the Movement System's tuning configuration and adjusted through playtesting.

## 6.3 Acceleration

Movement should accelerate gradually.

When the player starts moving:

- Velocity approaches the target movement speed.
- Acceleration depends on the current movement state.
- Direction changes should not instantly erase momentum.

Use a controlled acceleration model.

Avoid assigning the desired horizontal velocity directly every frame.

## 6.4 Deceleration

When movement input is released:

- Horizontal speed decreases gradually.
- The player retains some momentum.
- Friction and braking determine how quickly the player stops.

The stopping behavior should be predictable.

Do not use excessive friction that makes the movement feel rigid.

## 6.5 Direction changes

Changing movement direction should require time.

At high speeds:

- Turning should preserve some forward momentum.
- Lateral movement should remain controllable.
- Sharp turns should reduce speed naturally.

Avoid allowing instant 180-degree velocity changes at sprint speed.

## 6.6 Sprint

Sprint increases the target movement speed.

Sprint should:

- Require forward movement input.
- Increase speed progressively.
- Increase FOV slightly.
- Influence footsteps and camera feedback.
- Preserve momentum when sprint input is released.

Sprint must not produce an unlimited speed increase.

---

# 7. Jumping

## 7.1 Purpose

Jumping allows the player to:

- Cross gaps.
- Clear obstacles.
- Reach higher surfaces.
- Start parkour sequences.
- Transition into wallrunning or other mechanics.

## 7.2 Activation

Jump can be activated when:

- The player is grounded.
- A valid jump buffer is active.
- Another mechanic does not prohibit jumping.

Jumping should not activate during an incompatible state.

## 7.3 Initial parameters

Initial jump, gravity, coyote-time, and input-buffer values are owned by `12_MOVEMENT_SYSTEM_SPEC.md` §6.2.

This document does not duplicate them.

## 7.4 Behavior

On jump:

1. Validate the jump request.
2. Confirm the player can jump.
3. Apply vertical impulse or velocity according to the physics implementation.
4. Preserve appropriate horizontal momentum.
5. Enter JUMPING state.
6. Trigger camera response.
7. Publish jump event.

Do not reset horizontal velocity unless a mechanic explicitly requires it.

## 7.5 Air control

The player should retain limited directional control while airborne.

Air control should:

- Allow small corrections.
- Preserve existing momentum.
- Avoid feeling like ground movement.
- Avoid instant horizontal acceleration.

## 7.6 Variable jump height

Optional initial behavior:

Holding jump slightly longer may influence jump height.

If implemented, this must be controlled and limited.

Do not allow the player to increase jump height indefinitely by holding the button.

## 7.7 Landing

Landing occurs when the player transitions from airborne to grounded.

Landing should:

- Detect the ground contact.
- Reset appropriate airborne state.
- Apply landing camera response.
- Trigger landing audio.
- Update statistics.
- Transition to a valid grounded state.

Landing must preserve reasonable horizontal velocity.

A hard landing may produce stronger visual and audio feedback.

---

# 8. Falling

Falling is the state in which the player is airborne without an active jump or traversal action.

Examples:

- Walking off a ledge.
- Losing wallrun contact.
- Failing a jump.

Falling must:

- Apply normal gravity.
- Allow limited air control.
- Detect possible landing surfaces.
- Transition to LANDING on contact.
- Trigger failure handling if the player falls outside the playable environment.

Do not treat all airborne movement as jumping.

---

# 9. Sliding

## 9.1 Purpose

Sliding allows the player to pass beneath low obstacles while preserving forward momentum.

It should feel like a continuation of running rather than an independent movement mode.

## 9.2 Activation

Sliding requires:

- Ground contact.
- A valid slide input.
- Sufficient movement speed.
- No incompatible active state.

The initial minimum entry speed is owned by `12_MOVEMENT_SYSTEM_SPEC.md` §6.3.

## 9.3 Initial parameters

Initial slide speed, friction, duration, and exit thresholds are owned by `12_MOVEMENT_SYSTEM_SPEC.md` §6.3.

This document does not duplicate them.

## 9.4 Behavior

On slide:

1. Validate input and speed.
2. Enter SLIDING state.
3. Lower the player capsule.
4. Lower the camera.
5. Preserve horizontal momentum.
6. Apply controlled friction.
7. Detect overhead and forward obstacles.
8. Exit when duration or conditions require it.

## 9.5 Exit conditions

Sliding ends when:

- The slide duration expires.
- Speed becomes too low.
- The player jumps.
- The player collides with an invalid obstacle.
- The player enters another valid traversal mechanic.

On exit:

- Restore the standing collider.
- Restore camera height smoothly.
- Transition to the appropriate state.

Do not restore the standing capsule while it intersects a low ceiling.

If there is insufficient room to stand, remain crouched or continue sliding until a safe transition is possible.

---

# 10. Vaulting

## 10.1 Purpose

Vaulting allows the player to overcome obstacles without stopping.

The player should maintain as much horizontal momentum as possible.

## 10.2 Activation

Vaulting is contextual.

It requires:

- A valid obstacle ahead.
- A suitable obstacle height.
- Sufficient clearance beyond the obstacle.
- An appropriate player approach.
- A valid movement state.

The default context action is E.

Automatic vault initiation may be considered later, but explicit contextual activation should be implemented first.

## 10.3 Obstacle detection

Use physics queries to detect:

- Obstacle position.
- Obstacle height.
- Obstacle depth.
- Clearance above the obstacle.
- Landing space beyond it.

Do not determine vaultability from visual geometry alone.

## 10.4 Vault types

Initial types:

**Standard Vault**

- Lower speed requirement.
- Controlled traversal.
- Moderate momentum preservation.

**Speed Vault**

- Requires higher approach speed.
- Faster traversal.
- Greater momentum preservation.

## 10.5 Behavior

Vaulting should:

1. Detect a valid obstacle.
2. Select a traversal profile.
3. Enter VAULTING state.
4. Move the player through a controlled trajectory.
5. Prevent collision with the obstacle during the traversal.
6. Restore normal movement when complete.

The traversal trajectory must be validated against nearby geometry.

Avoid moving the player through arbitrary obstacles using an unrestricted teleport.

The implementation may use a controlled kinematic traversal, but it must remain integrated with physics and collision validation.

## 10.6 Failure conditions

Vaulting must fail safely when:

- The obstacle is too high.
- The landing area is blocked.
- The player approaches from an invalid direction.
- The obstacle is too far away.
- The player lacks sufficient speed for the selected vault.

---

# 11. Wallrunning

## 11.1 Purpose

Wallrunning allows the player to traverse a suitable vertical wall horizontally.

It should create a short, controlled movement sequence.

## 11.2 Activation

Wallrunning requires:

- Airborne movement.
- Sufficient horizontal speed.
- A valid wall on the left or right.
- A suitable wall orientation.
- A valid direction of travel.

The initial minimum entry speed is owned by `12_MOVEMENT_SYSTEM_SPEC.md` §6.4.

## 11.3 Wall detection

Use physics queries to detect:

- Wall contact.
- Wall normal.
- Distance to the wall.
- Wall orientation.
- Available traversal space.

Do not activate wallrunning on arbitrary surfaces.

## 11.4 Initial parameters

Initial wallrun duration, gravity multiplier, angle limits, and exit-impulse values are owned by `12_MOVEMENT_SYSTEM_SPEC.md` §6.4.

This document does not duplicate them.

## 11.5 Behavior

During wallrun:

- Maintain controlled horizontal momentum.
- Reduce vertical falling speed.
- Keep the player near the wall.
- Apply limited forward acceleration or momentum preservation.
- Tilt the camera toward the wall.
- Trigger wallrun audio.
- Track duration.

Wallrunning should not provide unlimited vertical movement.

## 11.6 Exit conditions

Wallrun ends when:

- Maximum duration expires.
- Wall contact is lost.
- Forward movement stops.
- The player reaches an invalid surface.
- The player jumps away.
- The player lands.

The player should transition to:

- WALLJUMP.
- FALLING.
- LANDING.
- Another valid traversal state.

---

# 12. Walljumping

## 12.1 Purpose

Walljumping allows the player to push away from a wall during or immediately after wallrun.

## 12.2 Activation

Requires:

- Active wallrun or valid wall contact.
- Jump input.
- Valid wall normal.

## 12.3 Behavior

Walljump applies:

- Vertical impulse.
- Outward impulse from the wall.
- Appropriate forward momentum.

The player should leave the wall in a predictable direction.

Do not simply apply an ordinary jump impulse.

The wall normal must influence the resulting trajectory.

## 12.4 State transition

```text
WALLRUN
   │
   ▼
WALLJUMP
   │
   ▼
FALLING / JUMPING
   │
   ▼
LANDING
```

Walljump may be represented as a short action inside JUMPING if the state machine design supports it.

Do not create redundant states without a clear benefit.

---

# 13. Deferred Traversal Mechanics

The following mechanics are outside the initial Glassline release scope:

- Ledge grabbing and hanging.
- Climbing from a hanging state.
- Dedicated balance traversal.
- Zipline traversal.

They must not be implemented as part of the initial gameplay milestone unless the Project Brief and Implementation Status are explicitly revised.

The initial level design must not require these mechanics to complete Training or the Prologue. Visual geometry that resembles a ledge, narrow beam, ladder, or cable does not imply that the corresponding traversal mechanic is supported.

If these mechanics are introduced in a later milestone, each requires its own system specification, explicit input and state contracts, physics validation, accessibility review, and acceptance criteria. Until then, they are not valid player states or Training objectives.

---

# 14. Player State Machine

## 17.1 Purpose

The state machine defines which movement behavior is active.

It prevents incompatible mechanics from running simultaneously.

## 17.2 Initial states

```ts
type MovementState =
  | "IDLE"
  | "RUNNING"
  | "SPRINTING"
  | "JUMPING"
  | "FALLING"
  | "LANDING"
  | "SLIDING"
  | "VAULTING"
  | "WALLRUN"
  | "WALLJUMP";
```

This set matches `02_TECHNICAL_ARCHITECTURE.md` §10.4. `12_MOVEMENT_SYSTEM_SPEC.md` §7 is authoritative for movement states and transitions.

Walking is a speed band within `RUNNING`. Crouching is a posture modifier, not a separate canonical movement state.

`18_PLAYER_STATE_SYSTEM_SPEC.md` defines the aggregate player lifecycle state; do not duplicate that lifecycle state machine here.

## 17.3 Transition examples

```text
IDLE / RUNNING
 ├── movement input → RUNNING
 ├── sprint input → SPRINTING
 ├── jump → JUMPING
 ├── slide → SLIDING
 └── leave ground → FALLING

SPRINTING
 ├── release sprint → RUNNING
 ├── jump → JUMPING
 ├── slide → SLIDING
 └── leave ground → FALLING

JUMPING
 ├── wall contact → WALLRUN
 ├── valid vault context → VAULTING
 └── ground contact → LANDING

FALLING
 ├── valid wallrun → WALLRUN
 └── ground contact → LANDING

SLIDING
 ├── jump → JUMPING
 ├── vault → VAULTING
 └── duration expired → RUNNING / IDLE

WALLRUN
 ├── jump → WALLJUMP
 ├── contact lost → FALLING
 └── ground contact → LANDING
```

These transitions are conceptual.

The implementation must define exact entry and exit conditions.

## 17.4 State ownership

Each state must have clear ownership of its active movement behavior.

For example:

- SLIDING controls the lowered capsule and slide friction.
- VAULTING controls the validated vault traversal.
- WALLJUMP controls the wall departure impulse.

Do not allow multiple systems to write conflicting velocity values during the same simulation step.

## 17.5 State transition rules

A state transition should:

1. Validate the requested transition.
2. Execute the current state's exit behavior.
3. Execute the new state's entry behavior.
4. Update the current state.
5. Publish a state change event.

Transitions should not leave behind active timers, constraints, or temporary physics settings.

---

# 15. Mechanic Priority and Conflict Resolution

Some mechanics may become valid simultaneously.

The system must resolve conflicts deterministically.

Suggested priority:

1. Forced recovery / invalid movement prevention (cross-system: Respawn).
2. Collision resolution.
3. Landing safety.
4. Vault.
5. Wallrun.
6. Walljump.
7. Slide.
8. Jump.
9. Ground locomotion.
10. Falling.

This mirrors `12_MOVEMENT_SYSTEM_SPEC.md` §7.4, which is authoritative for movement-internal priority. The first item is a cross-system safety rule owned by the Respawn System.

This is a starting priority order.

It may be refined after testing.

Deferred mechanics are excluded from this priority list. A valid action should not be interrupted by a lower-priority action without an explicit rule.

---

# 16. Camera Specification

The camera is first-person and directly connected to player movement state.

## 19.1 Base behavior

- Smooth mouse look.
- Stable horizon.
- Controlled vertical limits.
- Consistent eye height.
- No unnecessary camera lag.

## 19.2 Head bob

Head bob should be subtle.

It should depend on:

- Movement speed.
- Ground contact.
- Movement state.

It should be reduced or disabled while:

- Standing still.
- Performing controlled vaults.

## 19.3 FOV

Initial FOV:

```text
Base FOV: 75 degrees
Sprint FOV: 82 degrees
```

The exact values should be calibrated.

FOV changes should be smooth and limited.

## 19.4 Landing response

Landing should produce a short downward camera response.

The intensity may depend on vertical impact speed.

Avoid excessive camera shake.

## 19.5 Wallrun

Wallrun may produce:

- Camera roll toward the wall.
- Slight horizon tilt.
- Subtle lateral motion.

## 19.6 Sliding

Sliding lowers camera height smoothly.

Restore the camera height only when the player can safely stand.

## 19.7 Accessibility

Camera effects should be configurable.

Provide options to reduce:

- Head bob.
- Camera roll.
- Landing response.
- FOV changes.

---

# 17. First-Person Hands

The player may have simple procedural hands.

They should be created from basic geometry.

Potential animations:

- Running.
- Jumping.
- Landing.
- Vaulting.
- Sliding.
- Wallrunning.

Hands are visual feedback only.

They must not affect player physics or collision.

Do not create a full character rig for the initial prototype.

---

# 18. Gameplay Feedback and Events

Important gameplay actions must publish events.

Initial conceptual events:

```ts
type GameplayEvent =
  | { type: "player:jumped"; speed: number }
  | { type: "player:landed"; impactSpeed: number }
  | { type: "player:sliding-started"; speed: number }
  | { type: "player:sliding-ended" }
  | { type: "player:vault-started"; vaultType: string }
  | { type: "player:wallrun-started"; side: "left" | "right" }
  | { type: "player:wallrun-ended" }
  | { type: "player:walljumped" }
```

The final event model must use a consistent typed event architecture.

Events should be consumed by:

- Audio.
- Camera.
- HUD.
- Statistics.
- Training validation.

Do not make these systems independently infer every movement action from player velocity.

---

# 19. Training Mechanic Validation

Training exercises must verify actual player actions.

Entering an exercise zone does not automatically complete the exercise.

Examples:

| Training exercise | Required validation |
|---|---|
| Movement Basics | Reach and maintain the required movement speeds |
| Running and Sprinting | Accelerate into running and sprinting under the defined conditions |
| Jumping | Perform a valid jump and land safely |
| Crouching and Sliding | Enter crouch and complete a valid momentum-based slide |
| Vaulting | Successfully vault a suitable obstacle |
| Wall Running | Maintain valid wall contact while traversing |
| Wall Jumping | Execute a valid wall jump and leave the wall safely |
| Landing and Momentum | Land safely while preserving appropriate horizontal momentum |
| Interaction | Activate a valid contextual interaction |
| Combined Traversal | Complete a sequence combining the mechanics taught earlier |

The Training system listens to gameplay events and evaluates exercise-specific conditions.

Each lesson should define:

- Activation condition.
- Instructions.
- Required action.
- Completion condition.
- Failure or retry behavior.
- Next lesson.

Detailed exercise layout and progression are defined in `21_TRAINING_SYSTEM_SPEC.md` and `06_LEVEL_DESIGN_SPEC.md`.

---

# 20. Prologue Gameplay Validation

The Prologue must use the same player controller and parkour mechanics as Training.

It must not implement alternative movement logic.

The level defines:

- Route checkpoints.
- Traversal obstacles.
- Required movement opportunities.
- Finish trigger.

The run system validates the route.

The level should reward smooth traversal and speed without requiring a single exact sequence of button presses.

Detailed route design is defined in `06_LEVEL_DESIGN_SPEC.md`.

---

# 21. Mechanic Implementation Priority

Implement mechanics in this order:

| Priority | Mechanic | Requirement |
|---:|---|---|
| 1 | Walking / Running / Sprinting | Core locomotion |
| 2 | Jumping | Basic airborne movement |
| 3 | Landing | Ground recovery and momentum handling |
| 4 | Crouching / Sliding | Low-profile movement and momentum-based traversal |
| 5 | Vaulting | Contextual obstacle traversal |
| 6 | Wall Running | Wall-relative traversal |
| 7 | Wall Jumping | Controlled wall departure |

Do not implement all mechanics at once.

Each mechanic must be integrated with the state machine and tested before moving to the next major mechanic.

---

# 22. Gameplay Acceptance Criteria

## 25.1 Core movement

- The player can walk, run, and sprint.
- Acceleration and deceleration are smooth.
- Direction changes preserve reasonable momentum.
- Movement remains stable at different FPS values.
- The player cannot pass through solid geometry.

## 25.2 Jumping and landing

- Jumping requires a valid condition.
- Horizontal momentum is preserved appropriately.
- Air control is limited.
- Ground contact is detected reliably.
- Landing restores a valid grounded state.
- Buffered jump input behaves predictably.

## 25.3 Sliding

- Sliding requires valid speed and ground contact.
- The capsule and camera lower correctly.
- Momentum is preserved.
- Low obstacles can be passed.
- The player cannot stand inside a low ceiling.
- Slide exit restores the correct movement state.

## 25.4 Vaulting

- Only valid obstacles can be vaulted.
- Obstacle clearance is checked.
- Landing space is validated.
- Traversal does not allow arbitrary movement through geometry.
- Speed Vault and Standard Vault have distinguishable behavior.

## 25.5 Wallrun and walljump

- Wallrun activates only on valid walls.
- Wall contact is maintained correctly.
- Wallrun duration is limited.
- Losing contact transitions safely.
- Walljump moves the player away from the wall.
- The camera returns smoothly to normal.

## 25.6 Overall gameplay

- Mechanics can be combined into continuous movement sequences.
- Incompatible states cannot overlap.
- Gameplay events are published correctly.
- Audio and camera respond to actual gameplay.
- Training can validate each required mechanic.
- Prologue uses the same mechanics as Training.

---

# 23. Final Gameplay Principle

The movement system should feel like one connected experience.

Running should lead naturally into jumping.

Jumping should preserve momentum.

Landing should prepare the player for the next action.

Sliding, vaulting, wallrunning, and walljumping should extend movement rather than interrupt it unnecessarily.

**The player should learn to maintain flow through the environment.**

This is the central gameplay identity of Glassline.