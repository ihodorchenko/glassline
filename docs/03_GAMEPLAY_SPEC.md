# GAMEPLAY SPECIFICATION

## MIRROR'S EDGE — RUNNER PROTOCOL

**Document:** `03_GAMEPLAY_SPEC.md`  
**Version:** 1.0  
**Status:** Initial Gameplay Specification  
**Depends on:** `00_PROJECT_BRIEF.md`, `01_AGENT_RULES.md`, `02_TECHNICAL_ARCHITECTURE.md`

---

# 1. Purpose

This document defines the gameplay behavior of MIRROR'S EDGE — RUNNER PROTOCOL.

It describes:

- First-person player control.
- Movement and momentum.
- Jumping and landing.
- Sliding.
- Vaulting.
- Wallrunning.
- Walljumping.
- Ledge grabbing.
- Climbing.
- Balancing.
- Zipline traversal.
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

---

# 2. Gameplay Philosophy

## 2.1 Core principles

### Momentum matters

Player movement should preserve momentum.

The player should not stop instantly when releasing movement input.

Jumping, sliding, wallrunning, and landing should influence the player's horizontal velocity.

### Movement should feel responsive

Input should produce predictable results.

The player should have direct control over movement direction without making the character feel weightless.

### Parkour should be contextual

Some actions require specific environmental conditions.

Examples:

- Vaulting requires a suitable obstacle.
- Wallrunning requires a valid wall.
- Ledge grabbing requires a reachable ledge.
- Zipline traversal requires an available attachment point.

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
- Obstacle too high.
- Wall contact lost.
- Ledge out of reach.
- Landing surface unavailable.

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

`PlayerController` coordinates player behavior.

It receives normalized input and coordinates:

- Movement.
- Player state transitions.
- Jumping.
- Sliding.
- Vaulting.
- Wallrunning.
- Climbing.
- Balancing.
- Zipline traversal.

It does not own rendering or low-level Rapier implementation.

## 4.2 Player representation

The player uses:

- A physics capsule.
- A first-person camera.
- Procedural first-person hands.
- A movement state machine.

There is no requirement for a full third-person character model.

## 4.3 Initial player dimensions

Starting values:

| Parameter | Initial value |
|---|---:|
| Capsule radius | 0.35 m |
| Capsule total height | 1.75 m |
| Camera height | 1.60 m |
| Approximate eye height | 1.60 m |

These values are initial calibration parameters.

The collider dimensions and camera position must be adjusted together.

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
- Context interaction pressed just before reaching a valid ledge.

Initial input buffer:

```ts
const INPUT_BUFFER_DURATION = 0.15;
```

The value is configurable.

Buffered actions must be discarded when their conditions are no longer valid.

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

Basic locomotion:

- IDLE
- WALKING
- RUNNING
- SPRINTING
- AIRBORNE

These are locomotion conditions, not necessarily separate top-level states in every implementation.

## 6.2 Initial movement parameters

<text id="speed-params" weight="semibold">Initial tuning values</text>

| Parameter | Initial value |
|---|---:|
| Walking speed | 3.0 m/s |
| Running speed | 6.0 m/s |
| Sprint speed | 9.0 m/s |
| Ground acceleration | 12.0 m/s² |
| Ground deceleration | 10.0 m/s² |
| Air control factor | 0.35 |
| Maximum air speed adjustment | Configurable |

These are starting values for prototyping.

They are not exact values from the original game.

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

| Parameter | Initial value |
|---|---:|
| Jump vertical velocity | 6.5 m/s |
| Gravity | 19.0 m/s² |
| Coyote time | 0.10 s |
| Jump input buffer | 0.15 s |

These values are initial tuning parameters.

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
- Releasing a ledge.
- Falling after an invalid climb.

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

Initial minimum speed:

```ts
const MIN_SLIDE_SPEED = 4.5;
```

## 9.3 Initial parameters

| Parameter | Initial value |
|---|---:|
| Minimum entry speed | 4.5 m/s |
| Initial duration | 0.8 s |
| Minimum duration | 0.4 s |
| Maximum duration | 1.2 s |
| Friction | Configurable |
| Exit speed threshold | Configurable |

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

Initial minimum speed:

```ts
const MIN_WALLRUN_SPEED = 5.0;
```

## 11.3 Wall detection

Use physics queries to detect:

- Wall contact.
- Wall normal.
- Distance to the wall.
- Wall orientation.
- Available traversal space.

Do not activate wallrunning on arbitrary surfaces.

## 11.4 Initial parameters

| Parameter | Initial value |
|---|---:|
| Minimum entry speed | 5.0 m/s |
| Maximum duration | 1.2 s |
| Gravity reduction | Configurable |
| Wall attraction | Configurable |
| Exit impulse | Configurable |

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

# 13. Ledge Grabbing

## 13.1 Purpose

Ledge grabbing allows the player to catch the edge of a platform when a jump falls short or when approaching a reachable ledge.

## 13.2 Activation

Requires:

- Airborne player.
- Reachable ledge.
- Valid ledge geometry.
- Sufficient space for the player.
- A suitable approach direction.

## 13.3 Detection

Use a combination of physics queries:

1. Forward detection for a vertical surface.
2. Upper detection for the top edge.
3. Downward detection for a valid platform surface.
4. Clearance checks for the player body.

A ledge is valid only if the required geometry is present.

## 13.4 Behavior

When a valid ledge is detected:

- Move the player into a stable hanging position.
- Stop uncontrolled falling.
- Disable incompatible movement.
- Position the camera consistently.
- Enter a hanging/climbing state.

The player should not snap through geometry.

## 13.5 Hanging

While hanging:

- Horizontal movement may be limited.
- The player can move along the edge if the surface is continuous.
- The player can climb up.
- The player can release and fall.

Do not allow arbitrary movement while hanging.

---

# 14. Climbing

## 14.1 Purpose

Climbing allows the player to move from a hanging position onto the platform above.

## 14.2 Activation

Requires:

- Active ledge grab.
- Valid platform top.
- Sufficient clearance.
- Appropriate climb input.

## 14.3 Behavior

Climbing should:

1. Validate the platform.
2. Enter CLIMBING state.
3. Move the player through a controlled path.
4. Check clearance.
5. Restore normal standing capsule.
6. Place the player safely on the platform.
7. Transition to a grounded state.

The player must not end up inside the platform.

## 14.4 Failure conditions

Climbing must fail safely when:

- The platform top is obstructed.
- The player has lost valid ledge contact.
- The destination cannot accommodate the player.
- Another incompatible action has interrupted the climb.

---

# 15. Balancing

## 15.1 Purpose

Balancing allows the player to traverse narrow surfaces.

Examples:

- Metal beams.
- Narrow rooftop ledges.
- Industrial pipes.
- Narrow bridge sections.

## 15.2 Activation

Requires:

- Contact with a designated balance surface.
- Valid player orientation.
- Appropriate movement direction.

## 15.3 Behavior

Balancing should:

- Constrain lateral movement.
- Allow forward movement.
- Provide subtle balance feedback.
- Allow the player to correct direction.
- Allow the player to fall when leaving the surface.

For the initial prototype, balancing may use simplified movement constraints rather than a complex physical balance simulation.

## 15.4 Camera behavior

Use subtle camera motion.

Do not create aggressive camera oscillation that makes the player uncomfortable.

---

# 16. Zipline

## 16.1 Purpose

Zipline traversal allows the player to move along a suspended cable between two points.

## 16.2 Activation

Requires:

- Valid zipline.
- Reachable attachment point.
- Valid approach.
- Interaction input.

## 16.3 Behavior

On activation:

1. Validate attachment.
2. Enter ZIPLINE state.
3. Attach the player to the traversal path.
4. Move the player along the cable.
5. Apply controlled speed.
6. Provide camera and audio feedback.
7. Detach at the end or when permitted.

## 16.4 Implementation

The initial prototype may use a parameterized curve or line segment.

The player follows a controlled path.

Avoid a complex rope simulation.

The zipline must have a clearly defined start, end, direction, and collision behavior.

---

# 17. Player State Machine

## 17.1 Purpose

The state machine defines which movement behavior is active.

It prevents incompatible mechanics from running simultaneously.

## 17.2 Initial states

```ts
type PlayerState =
  | "IDLE"
  | "RUNNING"
  | "SPRINTING"
  | "JUMPING"
  | "FALLING"
  | "LANDING"
  | "SLIDING"
  | "VAULTING"
  | "WALLRUN"
  | "CLIMBING"
  | "BALANCING"
  | "ZIPLINE";
```

Additional internal substates may be introduced when justified.

## 17.3 Transition examples

```text
IDLE
 └── movement input → RUNNING

RUNNING
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
 ├── valid ledge → CLIMBING
 ├── valid vault context → VAULTING
 └── ground contact → LANDING

FALLING
 ├── valid wallrun → WALLRUN
 ├── valid ledge → CLIMBING
 └── ground contact → LANDING

SLIDING
 ├── jump → JUMPING
 ├── vault → VAULTING
 └── duration expired → RUNNING / IDLE

WALLRUN
 ├── jump → JUMPING
 ├── contact lost → FALLING
 └── ground contact → LANDING

CLIMBING
 ├── climb completed → RUNNING / IDLE
 └── release → FALLING
```

These transitions are conceptual.

The implementation must define exact entry and exit conditions.

## 17.4 State ownership

Each state must have clear ownership of its active movement behavior.

For example:

- SLIDING controls the lowered capsule and slide friction.
- WALLRUN controls wall-relative movement.
- CLIMBING controls the traversal path.
- ZIPLINE controls movement along the cable.

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

# 18. Mechanic Priority and Conflict Resolution

Some mechanics may become valid simultaneously.

The system must resolve conflicts deterministically.

Suggested priority:

1. Forced recovery / invalid movement prevention.
2. Active traversal state continuation.
3. Landing.
4. Ledge catch.
5. Wallrun.
6. Vault.
7. Slide.
8. Jump.
9. Ordinary movement.

This is a starting priority order.

It may be refined after testing.

A valid action should not be interrupted by a lower-priority action without an explicit rule.

---

# 19. Camera Specification

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
- Climbing.
- Ziplining.
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

# 20. First-Person Hands

The player may have simple procedural hands.

They should be created from basic geometry.

Potential animations:

- Running.
- Jumping.
- Landing.
- Vaulting.
- Climbing.
- Sliding.
- Wallrunning.

Hands are visual feedback only.

They must not affect player physics or collision.

Do not create a full character rig for the initial prototype.

---

# 21. Gameplay Feedback and Events

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
  | { type: "player:ledge-grabbed" }
  | { type: "player:climb-completed" }
  | { type: "player:balance-started" }
  | { type: "player:zipline-started" }
  | { type: "player:zipline-ended" };
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

# 22. Training Mechanic Validation

Training exercises must verify actual player actions.

Entering an exercise zone does not automatically complete the exercise.

Examples:

| Exercise | Required validation |
|---|---|
| Movement | Reach and maintain a target movement speed |
| Jumping | Perform a valid jump and land safely |
| Sliding | Enter and complete a valid slide |
| Vaulting | Successfully vault a suitable obstacle |
| Wallrun | Maintain wall contact while traversing |
| Climbing | Grab a ledge and climb onto the platform |
| Balance | Traverse a designated narrow surface |
| Zipline | Complete a valid zipline traversal |
| Final Run | Complete a combined sequence of required mechanics |

The Training system listens to gameplay events and evaluates exercise-specific conditions.

Each lesson should define:

- Activation condition.
- Instructions.
- Required action.
- Completion condition.
- Failure or retry behavior.
- Next lesson.

Detailed exercise layout and progression are defined in `05_TRAINING_LEVEL.md`.

---

# 23. Prologue Gameplay Validation

The Prologue must use the same player controller and parkour mechanics as Training.

It must not implement alternative movement logic.

The level defines:

- Route checkpoints.
- Traversal obstacles.
- Required movement opportunities.
- Finish trigger.

The run system validates the route.

The level should reward smooth traversal and speed without requiring a single exact sequence of button presses.

Detailed route design is defined in `06_PROLOGUE_LEVEL.md`.

---

# 24. Mechanic Implementation Priority

Implement mechanics in this order:

| Priority | Mechanic | Requirement |
|---:|---|---|
| 1 | Walking / Running / Sprinting | Core locomotion |
| 2 | Jumping | Basic airborne movement |
| 3 | Landing | Ground recovery |
| 4 | Sliding | Momentum-based traversal |
| 5 | Vaulting | Contextual obstacle traversal |
| 6 | Wallrunning | Wall-relative traversal |
| 7 | Walljumping | Controlled wall departure |
| 8 | Ledge grabbing | Catching reachable ledges |
| 9 | Climbing | Reaching upper platforms |
| 10 | Balancing | Narrow-surface traversal |
| 11 | Zipline | Cable traversal |

Do not implement all mechanics at once.

Each mechanic must be integrated with the state machine and tested before moving to the next major mechanic.

---

# 25. Gameplay Acceptance Criteria

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

## 25.6 Ledge and climbing

- Valid ledges can be detected.
- The player can hang without falling.
- Climbing reaches a valid position.
- Invalid platforms are rejected.
- The player cannot end inside geometry.

## 25.7 Balance and zipline

- Balancing constrains movement appropriately.
- The player can leave a balance surface.
- Zipline attachment is validated.
- Traversal follows the defined cable.
- Detachment leaves the player in a valid state.

## 25.8 Overall gameplay

- Mechanics can be combined into continuous movement sequences.
- Incompatible states cannot overlap.
- Gameplay events are published correctly.
- Audio and camera respond to actual gameplay.
- Training can validate each required mechanic.
- Prologue uses the same mechanics as Training.

---

# 26. Final Gameplay Principle

The movement system should feel like one connected experience.

Running should lead naturally into jumping.

Jumping should preserve momentum.

Landing should prepare the player for the next action.

Sliding, vaulting, wallrunning, climbing, and balancing should extend movement rather than interrupt it unnecessarily.

**The player should learn to maintain flow through the environment.**

This is the central gameplay identity of MIRROR'S EDGE — RUNNER PROTOCOL.