# 12_MOVEMENT_SYSTEM_SPEC.md

**Project:** Glassline  
**Document:** Movement System Specification

## 1. Purpose

This document defines the player movement system for Glassline, a first-person parkour game inspired by the original *Mirror's Edge* (2008).

The Movement System is responsible for:

- Ground movement.
- Acceleration and deceleration.
- Momentum preservation.
- Jumping and landing.
- Crouching and sliding.
- Vaulting over obstacles.
- Wall running.
- Wall jumping.
- Air control.
- Movement state transitions.
- Interaction between player movement and level geometry.
- Communicating movement state to animation, camera, audio, and gameplay systems.

The goal is to create movement that feels fast, fluid, readable, responsive, and skill-based.

The player should feel that movement abilities are connected parts of one coherent physical system rather than isolated scripted actions.

---

## 2. Design Principles

### 2.1 Movement First

Movement is the primary gameplay mechanic.

The player should spend most of the gameplay experience moving through the environment, discovering routes, maintaining speed, and executing parkour actions.

Movement quality has higher priority than visual complexity.

### 2.2 Momentum Matters

The player must preserve momentum across movement actions whenever physically reasonable.

Examples:

- Running speed contributes to jump distance.
- Sprinting into a slide produces a faster slide.
- A wall jump should preserve part of the player's incoming velocity.
- Landing should not arbitrarily reset horizontal speed.
- Vaulting should preserve forward movement.

Movement actions should not feel like independent animations that temporarily disable physics.

### 2.3 Responsive but Not Instantaneous

The player must respond immediately to input, but physical movement should have acceleration and inertia.

The system should avoid two extremes:

- Instant movement with no physical weight.
- Excessive inertia that makes precise parkour difficult.

### 2.4 Predictable Geometry Interaction

Parkour detection must be consistent.

The same obstacle approached at the same speed and angle should produce the same result.

The player should not randomly vault, wall-run, or collide depending on small frame timing differences.

### 2.5 First-Person Readability

Movement must remain understandable from a first-person camera.

Camera effects should communicate physical actions without hiding important geometry or causing excessive discomfort.

### 2.6 Skill-Based Execution

Movement quality should reward:

- Correct approach angle.
- Appropriate speed.
- Timing.
- Route selection.
- Maintaining momentum.
- Correct use of movement abilities.

The initial implementation should prioritize reliable execution over an excessively complicated physics simulation.

---

## 3. Scope

### 3.1 Initial Implementation

The initial Movement System must support:

- Walking.
- Running.
- Sprinting.
- Jumping.
- Falling.
- Landing.
- Crouching.
- Sliding.
- Basic vaulting.
- Wall running.
- Wall jumping.
- Air control.
- Collision detection.
- Ground detection.
- Movement state management.
- Momentum preservation.
- Integration with the Input System.
- Integration with the Camera System.

### 3.2 Future Features

The architecture should allow future implementation of:

- Advanced vault variations.
- Low and high obstacle vaults.
- Precision landing.
- Rolling landings.
- Advanced wall-run transitions.
- Ledge grabbing.
- Ledge climbing.
- Swinging.
- Ziplines.
- Advanced momentum tricks.
- Movement challenges with specialized physics parameters.

These features are not required for the initial playable version.

---

## 4. Movement Architecture

The Movement System must be independent from the Input System, Camera System, and Level Generation System.

It consumes abstract input actions and produces movement state information.

### 4.1 Main Components

| Component | Responsibility |
|---|---|
| MovementController | Main movement orchestration |
| MovementPhysics | Velocity, acceleration, friction, gravity |
| GroundDetector | Ground contact and surface detection |
| CollisionResolver | Collision handling |
| MovementStateMachine | Movement state transitions |
| JumpController | Jump execution and air movement |
| SlideController | Crouch and slide behavior |
| VaultController | Obstacle detection and vault execution |
| WallRunController | Wall-run detection and movement |
| MovementTuning | Configurable movement parameters |
| MovementEvents | Movement events for other systems |

### 4.2 Recommended Architecture

```text
Input System
     |
     v
MovementController
     |
     +-- MovementStateMachine
     |
     +-- MovementPhysics
     |
     +-- GroundDetector
     |
     +-- CollisionResolver
     |
     +-- JumpController
     |
     +-- SlideController
     |
     +-- VaultController
     |
     +-- WallRunController
     |
     v
Movement State / Events
     |
     +-- Camera System
     +-- Animation System
     +-- Audio System
     +-- Gameplay Systems
```

### 4.3 Core Responsibilities

`MovementController` coordinates the movement update.

It must not contain every movement mechanic directly.

Each specialized controller owns its own detection and execution logic.

`MovementPhysics` owns the player's physical velocity and applies acceleration, gravity, friction, and collision response.

`MovementStateMachine` determines which movement behavior is currently active.

Specialized controllers must not independently overwrite the player's velocity without going through the movement physics interface.

---

## 5. Coordinate System and Player Representation

### 5.1 Coordinate System

Use the engine's world coordinate system consistently.

For the initial implementation, define:

- World up: positive Y.
- Ground plane: XZ.
- Vertical movement: Y.
- Horizontal movement: XZ.

All movement calculations must use this convention.

### 5.2 Player Collider

The player should be represented by a capsule collider.

The capsule is preferable to a box collider because it:

- Avoids catching on small geometry edges.
- Provides smoother movement around corners.
- Supports predictable ground contact.
- Works well with first-person movement.

The player collider must not rotate with camera pitch.

### 5.3 Player Dimensions

Initial tuning values:

| Parameter | Suggested Value |
|---|---:|
| Capsule height | 1.75 m |
| Capsule radius | 0.30 m |
| Standing eye height | 1.60 m |
| Crouching eye height | 1.05 m |
| Ground detection distance | 0.12 m |
| Maximum step height | 0.40 m (autostep enabled in both directions) |

These values are starting points, not immutable requirements.

All dimensions must be configurable.

The player collider must resize smoothly or safely during crouching and sliding.

It must not expand into ceilings or other geometry.

---

## 6. Movement Parameters

Movement values should be centralized in `MovementTuning`.

Do not scatter physics constants across controllers.

### 6.1 Horizontal Movement

Initial tuning targets:

| Parameter | Suggested Value |
|---|---:|
| Walk speed | 3.5 m/s |
| Run speed | 6.0 m/s |
| Sprint speed | 8.5 m/s |
| Ground acceleration | 18.0 m/s² |
| Ground deceleration | 14.0 m/s² |
| Air acceleration | 5.0 m/s² |
| Maximum air speed | 9.5 m/s |

Braking is implemented through `groundDeceleration` (move-towards model); the
implementation has no separate ground/air friction constants.

These values should be tested and adjusted during gameplay tuning.

### 6.2 Vertical Movement

| Parameter | Suggested Value |
|---|---:|
| Gravity | 22.0 m/s² |
| Jump height | 1.25 m |
| Minimum jump height | 0.45 m |
| Maximum falling speed | 35.0 m/s |
| Jump input buffer | 0.12 s |
| Coyote time | 0.14 s |

Jump height should be calculated from gravity and desired height rather than implemented as an arbitrary impulse.

For a simplified ballistic jump:

```text
jumpVelocity = sqrt(2 * gravity * jumpHeight)
```

The actual implementation may use a configurable jump curve or variable jump height.

### 6.3 Slide

| Parameter | Suggested Value |
|---|---:|
| Minimum slide entry speed | 5.0 m/s |
| Slide friction | 4.0 m/s² (tuned from 2.0 in the Gameplay Feel audit, Group 6) |
| Slide duration | 0.25–1.2 s (min/max caps; duration emerges from friction — measured ≈0.86 s at a 5.93 m/s entry) |
| Slide exit speed threshold | 2.5 m/s |
| Slide steering acceleration | 6.0 m/s² (limited steering, §13.3) |

Slide duration should primarily emerge from velocity and friction.

A fixed duration may be used as a maximum limit or animation constraint, but should not be the only determinant of slide behavior.

### 6.4 Wall Run

| Parameter | Suggested Value |
|---|---:|
| Minimum entry speed | 5.0 m/s |
| Maximum wall-run duration | 1.5 s |
| Wall-run gravity multiplier | 0.35 |
| Wall-run speed decay | 1.0 m/s² |
| Maximum wall tilt from vertical | ≈20.5° (implemented as wall normal \|y\| ≤ 0.35) |
| Wall jump horizontal impulse | 5.5 m/s (`wallJumpOutwardSpeed`) |
| Wall jump vertical impulse | 6.0 m/s (`wallJumpUpSpeed`) |

Wall-run parameters should be adjustable independently from general movement physics.

---

## 7. Movement State Machine

### 7.1 States

The initial implementation must use the canonical movement state set defined in `02_TECHNICAL_ARCHITECTURE.md` §10.4:

| State | Description |
|---|---|
| IDLE | Player is grounded and not moving |
| RUNNING | Player is moving on the ground; walking and running speeds are locomotion bands within this state |
| SPRINTING | Player is sprinting |
| JUMPING | Player is ascending after a jump |
| FALLING | Player is descending without ground contact |
| LANDING | Player has just contacted the ground |
| SLIDING | Player is performing a slide |
| VAULTING | Player is traversing an obstacle |
| WALLRUN | Player is running along a suitable wall |
| WALLJUMP | Player has jumped away from a wall |

Walking is a speed band of `RUNNING`, not a separate top-level state.

Crouching is a posture modifier, not a separate canonical state: it changes the collider height and stance and may be active while `IDLE`/`RUNNING` or as an entry condition for `SLIDING`. It must not duplicate Player State lifecycle state (`18_PLAYER_STATE_SYSTEM_SPEC.md`) or the state machines of other systems.

The implementation must avoid unnecessary state duplication.

### 7.2 State Transitions

```text
              +--------------------+
              |   IDLE / RUNNING   |
              +--------------------+
                 |           |
        Jump     |           | Crouch stance + speed
                 |           v
                 |      +----------+
                 |      | SLIDING  |
                 |      +----------+
                 |
                 v
            +----------+
            | JUMPING  |
            +----------+
                 |
                 | Apex
                 v
            +----------+
            | FALLING  |
            +----------+
                 |
                 | Ground contact
                 v
            +----------+
            | LANDING  |
            +----------+
                 |
                 v
              +--------------------+
              |   IDLE / RUNNING   |
              +--------------------+

Additional transitions:

RUNNING -> SPRINTING
RUNNING -> VAULTING
FALLING -> WALLRUN
WALLRUN -> WALLJUMP
WALLRUN -> FALLING
WALLJUMP -> FALLING
SLIDING -> JUMPING
```

### 7.3 State Transition Rules

- A state must have a clearly defined entry condition.
- A state must have a clearly defined exit condition.
- A state must not remain active indefinitely unless intended.
- A state must not be entered if required geometry is unavailable.
- A state must not override a higher-priority movement action.
- State transitions must be deterministic.

### 7.4 Movement Priority

When multiple movement actions are possible simultaneously, use an explicit priority system.

Suggested priority:

1. Collision resolution.
2. Forced recovery or landing safety.
3. Vaulting.
4. Wall running.
5. Wall jumping.
6. Sliding.
7. Jumping.
8. Ground locomotion.
9. Falling.

The exact order may be refined during implementation, but priority must be explicit.

A valid jump input during a slide may transition to jumping if the slide has reached its minimum duration.

A vault must not start if the player is already performing an incompatible action.

---

## 8. Core Movement Physics

### 8.1 Velocity Model

The player velocity should be represented as a world-space vector.

```ts
interface MovementVelocity {
  horizontal: Vector3;
  vertical: number;
}
```

Alternatively, a single `Vector3` may be used if vertical and horizontal calculations remain clearly separated.

The physics system should expose controlled methods:

```ts
interface MovementPhysics {
  getVelocity(): Vector3;
  setVelocity(velocity: Vector3): void;

  addImpulse(impulse: Vector3): void;
  applyAcceleration(acceleration: Vector3, deltaTime: number): void;

  applyGravity(deltaTime: number): void;
  applyGroundFriction(deltaTime: number): void;
  applyAirFriction(deltaTime: number): void;
}
```

These are conceptual interfaces. Adapt the vector types to the selected rendering or physics engine.

### 8.2 Acceleration

Ground acceleration should be based on the difference between current velocity and desired velocity.

```text
desiredVelocity = inputDirection * targetSpeed

velocity = moveTowards(
    velocity,
    desiredVelocity,
    acceleration * deltaTime
)
```

The implementation should preserve momentum when the player releases movement input.

Deceleration should be controlled by friction rather than an immediate velocity reset.

### 8.3 Direction Changes

Changing direction at high speed should require time.

The player should not instantly reverse direction.

However, the player must retain enough control to navigate tight rooftop routes.

Use acceleration and friction values to balance responsiveness and physical weight.

### 8.4 Momentum Preservation

Momentum must be preserved across:

- Jumping.
- Landing.
- Sliding.
- Vaulting.
- Wall running.
- Wall jumping.

Each action may modify velocity, but should not reset it arbitrarily.

Example:

```text
incomingVelocity = currentVelocity

wallJumpVelocity =
    preserveHorizontalMomentum(incomingVelocity)
    + wallJumpImpulse
```

The implementation should define explicit momentum retention factors for movement transitions.

### 8.5 Frame Rate Independence

Movement must behave consistently at different frame rates.

All velocity and acceleration calculations must use `deltaTime`.

Avoid direct per-frame position changes that assume a fixed frame rate.

For collision-critical movement, use the fixed physics timestep defined in §8.6. The rendering loop may run independently from the physics update.

### 8.6 Fixed Timestep

Recommended initial physics update rate:

- Physics simulation: 60 Hz.
- Rendering: variable frame rate.

The physics loop should use an accumulator.

If a frame takes longer than expected, the system may perform multiple physics steps.

Limit the maximum number of catch-up steps to prevent the spiral-of-death problem.

Do not use a large variable `deltaTime` for collision-critical movement.

---

## 9. Ground Detection and Collision

### 9.1 Ground Detection

Ground detection must be independent from visual character position.

Use capsule-based collision queries or an equivalent reliable method.

Ground detection should provide:

```ts
interface GroundContact {
  isGrounded: boolean;
  distance: number;
  point: Vector3 | null;
  normal: Vector3 | null;
  colliderId: string | null;
}
```

Ground detection must distinguish between:

- Walkable ground.
- Steep slopes.
- Walls.
- Ceiling contact.
- Temporary contact during a jump.

### 9.2 Walkable Surfaces

Define a maximum walkable slope angle.

Initial target:

```text
maximumWalkableSlope = 45 degrees
```

The value should be configurable.

Surfaces exceeding this angle should not automatically count as ground.

### 9.3 Collision Resolution

The player must not:

- Pass through walls.
- Fall through floors.
- Become trapped inside geometry.
- Gain unintended speed from collision penetration.
- Stop permanently when touching small decorative objects.

Use a capsule sweep or equivalent continuous collision detection for movement.

A simple raycast from the player's center is not sufficient for robust character collision.

### 9.4 Collision Layers

Use collision categories to distinguish:

- Solid world geometry.
- Walkable surfaces.
- Vaultable obstacles.
- Wall-run surfaces.
- Triggers.
- Decorative geometry.
- Player collision.

Decorative objects should not interfere with parkour unless explicitly configured to do so.

### 9.5 Collision Response

When a collision blocks movement:

1. Resolve penetration.
2. Remove velocity directed into the collision surface.
3. Preserve tangential velocity.
4. Continue movement along the remaining valid direction.

This allows the player to slide along walls instead of stopping completely.

---

## 10. Walking, Running, and Sprinting

### 10.1 Walking

Walking is the low-speed movement mode.

It should support precise positioning and exploration.

### 10.2 Running

Running is the standard gameplay movement mode.

It should be responsive and maintain moderate momentum.

### 10.3 Sprinting

Sprinting is the fastest standard ground locomotion mode.

Sprint activation should be controlled by the abstract `Sprint` input action.

Sprint should:

- Increase target horizontal speed.
- Increase acceleration requirements.
- Affect camera behavior.
- Affect audio intensity.
- Improve slide entry speed.
- Improve jump range through preserved momentum.

Sprinting should not provide an arbitrary jump multiplier unless explicitly configured.

### 10.4 Speed Transitions

Transitions between walking, running, and sprinting should be smooth.

The system should not instantly change current velocity when the requested movement mode changes.

The target speed changes immediately, but the physical velocity approaches it through acceleration.

---

## 11. Jumping

### 11.1 Jump Requirements

Jumping must support:

- Ground jump.
- Variable jump height.
- Air control.
- Jump buffering.
- Coyote time.
- Momentum preservation.
- Landing detection.

### 11.2 Jump Initiation

A jump can be initiated when:

- The player is grounded.
- The player is within the coyote-time window.
- A valid buffered jump is available.
- A movement action explicitly supports jumping, such as a wall jump.

### 11.3 Jump Height

Use gravity and initial vertical velocity to calculate jump height.

```text
jumpVelocity = sqrt(2 * gravity * targetJumpHeight)
```

The jump controller should allow the player to influence jump height by releasing the jump input early.

Variable jump height should be implemented by modifying upward acceleration or applying additional gravity when the jump button is released.

Avoid abrupt vertical velocity resets.

### 11.4 Jump Buffering

If the player presses jump shortly before landing, the input should be buffered.

When the player becomes grounded, the buffered jump should execute if it has not expired.

Initial buffer duration:

```text
jumpBufferDuration = 0.12 seconds
```

### 11.5 Coyote Time

The player should be allowed to jump shortly after leaving a platform.

Initial coyote time:

```text
coyoteTime = 0.14 seconds
```

Coyote time should not be refreshed by arbitrary wall contact or invalid collision.

### 11.6 Air Control

Air control should allow directional correction without eliminating existing momentum.

The player should be able to:

- Adjust horizontal direction.
- Correct a jump trajectory.
- Move toward a landing surface.
- Prepare for a wall interaction.

Air acceleration should be lower than ground acceleration.

### 11.7 Jump Events

The system must publish the canonical gameplay event defined in `03_GAMEPLAY_SPEC.md` §18:

- `player:jumped` with the player's speed.

Additional jump-lifecycle signals (apex reached, jump cancelled) may remain internal to the Movement System's interface and must not create a competing public event model.

The canonical events are consumed by Camera, Audio, HUD, Statistics, and Training validation.

---

## 12. Crouching

### 12.1 Crouch Behavior

Crouching changes the player's collider and stance. Camera height is derived and applied by the Camera System (`13_CAMERA_SYSTEM_SPEC.md`); Movement does not animate the camera.

It must support:

- Stationary crouching.
- Crouched movement.
- Entering a slide.
- Exiting a slide.
- Checking whether standing is possible.

### 12.2 Standing Clearance

Before returning to standing height, the system must check for ceiling or obstacle collision.

If there is insufficient clearance:

- Keep the player crouched.
- Do not expand the collider into the obstacle.
- Allow the player to move out from under the obstruction.

### 12.3 Camera Height

The Movement System exposes the current crouch stance and collider height. Camera height interpolation is owned by the Camera System (`13_CAMERA_SYSTEM_SPEC.md`); the camera must not move independently of the collider in a way that creates misleading spatial perception.

### 12.4 Crouch Input

The crouch action should remain active while the input is held.

Whether crouch uses hold or toggle behavior should be configurable in the Input System.

The Movement System should only consume the resulting abstract action state.

---

## 13. Sliding

### 13.1 Slide Entry

A slide can begin when:

- The player is grounded.
- Crouch input is active.
- Horizontal speed exceeds the minimum slide entry speed.
- There is sufficient clearance.
- No incompatible movement state is active.

### 13.2 Slide Physics

A slide should preserve forward momentum.

Initial slide velocity should be derived from current horizontal velocity.

```text
slideVelocity = currentHorizontalVelocity
```

Friction should gradually reduce speed.

Slide friction should be lower than normal ground friction.

### 13.3 Slide Steering

The player should retain limited directional control while sliding.

Steering should not be as strong as normal ground movement.

The amount of steering should be configurable.

### 13.4 Slide Exit

A slide may end when:

- The player releases crouch after the minimum duration.
- The player reaches the maximum duration.
- Speed drops below the minimum threshold.
- The player jumps.
- The player encounters an incompatible movement action.
- The player leaves the ground.

### 13.5 Slide Jump

Slide jumping should be supported.

A slide jump should:

- Preserve part of the horizontal slide velocity.
- Apply the normal jump impulse.
- Transition directly into an airborne state.
- Avoid resetting horizontal momentum.

### 13.6 Slide Events

Emit the canonical gameplay events from `03_GAMEPLAY_SPEC.md` §18:

- `player:sliding-started` with the player's speed.
- `player:sliding-ended`.

Camera and Audio systems may use these events to trigger corresponding feedback.

---

## 14. Vaulting

### 14.1 Purpose

Vaulting allows the player to traverse suitable obstacles without manually jumping over every object.

It should feel like a natural continuation of forward movement.

### 14.2 Obstacle Requirements

An obstacle may be vaultable if:

- Its height is within the configured vault range.
- Its width and depth are suitable.
- There is sufficient space beyond the obstacle.
- The player approaches from a valid direction.
- The player has sufficient movement speed.
- The obstacle is explicitly marked as vaultable or passes geometry validation.

Initial suggested obstacle height:

```text
minimumVaultHeight = 0.35 m
maximumVaultHeight = 1.15 m
```

These values should be adjusted during level testing.

### 14.3 Vault Detection

Vault detection should use a combination of:

1. Forward obstacle detection.
2. Height measurement.
3. Top-surface detection.
4. Landing-space validation.
5. Movement direction validation.

A single forward raycast is not sufficient.

### 14.4 Vault Types and Execution

The initial implementation distinguishes two vault profiles, as required by `03_GAMEPLAY_SPEC.md` §10.4:

| Type | Requirements | Behavior |
|---|---|---|
| Standard Vault | Valid obstacle, moderate approach speed | Controlled traversal, moderate momentum preservation |
| Speed Vault | Higher approach speed and sufficient clearance | Faster traversal, greater momentum preservation |

Profiles are configured in `MovementTuning` (for example minimum approach speed, trajectory duration, and momentum retention per type). The selection rule must be explicit and deterministic: when the conditions for a speed vault are not met but the obstacle is valid, the standard vault is used.

The chosen type is reported in the canonical `player:vault-started` event.

The initial implementation may use a controlled movement trajectory.

The trajectory should be generated from:

- Vault profile.
- Entry position.
- Obstacle dimensions.
- Exit position.
- Current velocity.
- Vault duration.

The player should continue moving forward during the action.

The movement system must retain control over collision and destination validation.

### 14.5 Momentum

Vaulting should preserve forward momentum.

The exit velocity should be based on incoming velocity with configurable losses.

```text
exitVelocity =
    incomingVelocity * vaultMomentumRetention
```

Initial suggested retention:

```text
vaultMomentumRetention = 0.85
```

Do not apply this factor blindly to every velocity component.

Vertical and horizontal velocity should be handled separately.

### 14.6 Vault Failure

If the destination becomes invalid before execution:

- Cancel the vault.
- Preserve a safe movement state.
- Resolve collision normally.
- Avoid teleporting the player through geometry.

### 14.7 Vault Events

Emit the canonical gameplay event from `03_GAMEPLAY_SPEC.md` §18:

- `player:vault-started` with the vault type.

Vault completion and cancellation are internal lifecycle states of the movement action and must not be published as a competing public event model.

---

## 15. Wall Running

### 15.1 Purpose

Wall running allows the player to traverse suitable vertical surfaces while maintaining forward momentum.

It should expand route possibilities rather than become a universal movement shortcut.

### 15.2 Wall Eligibility

A surface may support wall running if:

- It is sufficiently vertical.
- It is long enough.
- It has the correct collision category or metadata.
- The player approaches with sufficient speed.
- The approach angle is valid.
- There is enough space for the player capsule.

The system should not allow wall running on arbitrary decorative surfaces.

### 15.3 Wall Detection

Use left and right capsule or ray-based probes.

The detection result should include:

```ts
interface WallContact {
  isValid: boolean;
  normal: Vector3 | null;
  point: Vector3 | null;
  colliderId: string | null;
  side: "left" | "right" | null;
}
```

The wall normal is used to calculate the movement direction along the wall.

### 15.4 Wall Run Initiation

Wall running may start when:

- The player is airborne or entering a valid wall-run transition.
- A valid wall is detected.
- Horizontal speed exceeds the minimum threshold.
- The player is moving in a compatible direction.
- The wall-run duration limit has not been exceeded.

### 15.5 Wall Run Movement

During wall running:

- Preserve forward momentum.
- Reduce gravity.
- Keep the player close to the wall.
- Allow limited directional control.
- Prevent penetration into the wall.
- Prevent automatic movement through corners without valid geometry.

The wall-run direction should be calculated using the wall normal and the player's forward movement.

### 15.6 Wall Run Limits

Wall running must have:

- Maximum duration.
- Minimum speed.
- Maximum acceptable wall angle.
- Maximum acceptable deviation from the wall.
- Clear termination conditions.

It must not allow indefinite movement along a wall.

### 15.7 Wall Run Termination

Wall running ends when:

- The wall is no longer valid.
- The player loses sufficient speed.
- The duration limit is reached.
- The player jumps away.
- The player collides with an incompatible obstacle.
- The player changes direction beyond the allowed threshold.

The transition should preserve as much valid velocity as possible.

### 15.8 Wall Run Events

Emit the canonical gameplay events from `03_GAMEPLAY_SPEC.md` §18:

- `player:wallrun-started` with the wall side.
- `player:wallrun-ended`.

A wall-side change while the wall run remains active is internal to the movement state and must not create a separate public event.

---

## 16. Wall Jumping

### 16.1 Purpose

Wall jumping allows the player to push away from a wall and gain additional vertical or horizontal movement.

### 16.2 Initiation

A wall jump may be triggered when:

- The player is wall running or has a valid wall contact.
- Jump input is pressed.
- The wall jump cooldown has expired.
- The destination direction is valid.

### 16.3 Velocity

Wall jump velocity combines:

- An outward impulse from the wall.
- A vertical jump impulse.
- Preserved tangential momentum.

Conceptually:

```text
wallJumpVelocity =
    preservedMomentum
    + wallNormal * horizontalImpulse
    + worldUp * verticalImpulse
```

The exact impulse values must be configurable.

### 16.4 Direction

The player should move away from the wall rather than into it.

The wall normal must be used to determine the outward direction.

### 16.5 Cooldown

A short cooldown should prevent repeated wall jumps from a single contact.

The cooldown must not prevent legitimate jumps from a different wall.

### 16.6 Wall Jump Events

Emit the canonical gameplay event from `03_GAMEPLAY_SPEC.md` §18:

- `player:walljumped`.

Camera, Audio, and Training systems consume this event instead of inferring the wall jump from velocity.

---

## 17. Landing

### 17.1 Landing Detection

Landing occurs when the player transitions from airborne movement to valid ground contact.

The system must distinguish between:

- Normal landing.
- Hard landing.
- Landing after a wall jump.
- Landing after a vault.
- Landing while sliding.

### 17.2 Landing Velocity

Landing should not automatically reset horizontal velocity.

Vertical velocity should be resolved safely.

Horizontal velocity should be retained unless the landing surface or movement action requires modification.

### 17.3 Hard Landing

A hard landing may be detected using vertical impact speed.

Initial behavior:

- Small impact: normal landing.
- Medium impact: stronger camera response.
- Large impact: stronger audio and camera response.

The initial version does not require a complex damage or stumble system.

### 17.4 Landing Events

Emit the canonical gameplay event from `03_GAMEPLAY_SPEC.md` §18:

- `player:landed` with the impact speed.

Include surface information where available. Hard-landing classification is an internal Movement distinction used for feedback intensity; it is not a separate public event.

---

## 18. Slopes and Uneven Geometry

### 18.1 Slope Movement

Movement should adapt to the ground normal.

The player should move along walkable surfaces without becoming airborne due to minor geometry variations.

### 18.2 Uphill Movement

Uphill movement may reduce speed naturally or through configurable slope resistance.

### 18.3 Downhill Movement

Downhill movement may preserve or increase momentum, within defined speed limits.

Avoid uncontrolled acceleration.

### 18.4 Surface Transitions

The system should handle transitions between:

- Flat surfaces.
- Slopes.
- Ramps.
- Rooftop edges.
- Small steps.
- Uneven platforms.

The player should not become stuck on minor level geometry imperfections.

---

## 19. Movement and Camera Integration

The Movement System must not directly control camera animation.

It exposes state and movement metrics.

The Camera System is responsible for visual response. Where a response corresponds to a canonical gameplay event (`03_GAMEPLAY_SPEC.md` §18), the Camera System consumes that event rather than independently inferring the action from velocity.

### 19.1 Exposed Data

The Movement System should expose:

```ts
interface MovementCameraData {
  horizontalSpeed: number;
  verticalSpeed: number;
  movementState: MovementState;
  isGrounded: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  isWallRunning: boolean;
  landingImpact: number;
  acceleration: Vector3;
}
```

### 19.2 Camera Responses

The Camera System may use this data for:

- Running camera bob.
- Sprint FOV increase.
- Jump anticipation.
- Jump apex response.
- Landing impact.
- Slide camera height.
- Vault camera movement.
- Wall-run tilt.
- Speed-based visual effects.

### 19.3 Separation of Responsibilities

The Movement System determines physical state.

The Camera System determines visual presentation.

Camera effects must never modify actual player movement.

---

## 20. Movement and Animation Integration

The initial game uses first-person presentation, but movement animation support should be possible.

The Movement System should expose:

- Current movement state.
- Horizontal speed.
- Vertical speed.
- Acceleration.
- Movement direction.
- Ground contact.
- Active parkour action.

Future animation systems may use this information for:

- Hand animations.
- Vault animations.
- Landing animations.
- Slide animations.
- Wall-run animations.
- First-person body and leg visibility.

Animation must not become the authoritative source of player position.

---

## 21. Movement and Audio Integration

The Movement System emits events and exposes movement metrics.

The Audio System may use these to trigger:

- Footsteps.
- Sprint footsteps.
- Jump sounds.
- Landing sounds.
- Slide friction.
- Vault interaction.
- Wall-run contact.
- Wall-jump impact.

Footstep frequency should be based on movement speed rather than a fixed timer.

Surface material should influence footstep sound selection.

The Movement System must not directly load or play audio assets.

---

## 22. Surface Metadata

Level geometry should provide optional surface metadata.

```ts
interface SurfaceMetadata {
  id: string;
  material: string;

  isWalkable: boolean;
  isVaultable: boolean;
  isWallRunnable: boolean;

  friction?: number;
  movementMultiplier?: number;
}
```

Surface metadata allows level designers and procedural generation systems to control movement interactions.

Default behavior must be defined for geometry without explicit metadata.

Decorative geometry should not accidentally become parkour geometry.

---

## 23. Movement Configuration

All tuning parameters must be configurable through a centralized configuration object.

Example:

```ts
interface MovementTuning {
  walkSpeed: number;
  runSpeed: number;
  sprintSpeed: number;

  groundAcceleration: number;
  groundDeceleration: number;
  airAcceleration: number;

  gravity: number;
  jumpHeight: number;
  minimumJumpHeight: number;

  jumpBufferDuration: number;
  coyoteTime: number;

  slideMinimumSpeed: number;
  slideFriction: number;
  slideMaximumDuration: number;

  wallRunMinimumSpeed: number;
  wallRunMaximumDuration: number;
  wallRunGravityMultiplier: number;

  vaultMomentumRetention: number;

  maximumWalkableSlope: number;
  maximumFallSpeed: number;
}
```

Configuration must support:

- Default gameplay values.
- Debug tuning.
- Future difficulty or mode-specific profiles.

Avoid runtime dependencies on editor-only configuration systems.

---

## 24. Public Movement Interface

The Movement System should expose a stable interface to other gameplay systems.

Conceptual interface:

```ts
interface IMovementController {
  readonly state: MovementState;
  readonly velocity: Vector3;
  readonly isGrounded: boolean;

  update(input: MovementInput, deltaTime: number): void;

  getMovementMetrics(): MovementMetrics;

  subscribe(
    event: MovementEvent,
    callback: (data: MovementEventData) => void
  ): Unsubscribe;
}
```

The exact interface may change to match the project architecture.

External systems must not directly modify internal movement state.

Specialized gameplay systems should request movement actions through controlled methods.

---

## 25. Input Integration

The Movement System consumes abstract actions from `11_INPUT_SYSTEM_SPEC.md`.

Required actions:

| Action | Movement Usage |
|---|---|
| Move | Horizontal movement direction |
| Jump | Jump initiation |
| Crouch | Crouching and sliding |
| Sprint | Sprint activation |
| Interact | Not directly used by physics |
| Pause | Not directly used by physics |

The Movement System must not subscribe directly to keyboard or mouse DOM events.

Input state should be sampled consistently for each physics update.

Buffered actions such as Jump must be handled by the Movement System or a dedicated action buffer.

---

## 26. Speedrun Integration

Movement must provide stable and predictable behavior for Speedrun mode.

Requirements:

- No random movement physics.
- No frame-rate-dependent acceleration.
- No inconsistent collision behavior.
- No hidden speed boosts.
- No arbitrary velocity resets.
- Consistent parkour detection.
- Deterministic movement tuning for a given build and route configuration.

Speedrun timer logic must remain independent from movement physics.

Movement events may be used for analytics and debugging, but must not control the official timer.

Movement configuration changes that materially affect route completion should be associated with a movement configuration or game build version.

---

## 27. Training Mode Integration

Training Mode should expose movement mechanics progressively.

Implemented training sequence (`21_TRAINING_SYSTEM_SPEC.md` §4.2):

1. Basic Movement.
2. Running.
3. Basic Jump.
4. Basic Vault.
5. Slide.
6. Wall Run.
7. Wall Jump.
8. Controlled Landing.
9. Interaction Basics.
10. Parkour Sequence.

Each training activity should validate the relevant movement state or event.

Training should not duplicate movement logic.

It must use the same Movement System as Prologue.

---

## 28. Debugging and Visualization

The Movement System must provide a debug mode.

Debug visualization should include:

- Player capsule.
- Ground detection ray or shape.
- Collision contacts.
- Wall detection probes.
- Vault detection probes.
- Current velocity vector.
- Current movement state.
- Horizontal speed.
- Vertical speed.
- Ground normal.
- Current surface metadata.
- Active movement action.
- Physics update frequency.

Example debug overlay:

```text
MOVEMENT DEBUG

State: Sprinting
Grounded: YES
Horizontal Speed: 7.82 m/s
Vertical Speed: 0.00 m/s

Ground Normal: (0.00, 1.00, 0.00)
Surface: RooftopConcrete

Jump Buffer: 0.00 s
Coyote Time: 0.00 s

Wall Contact: NONE
Vault Candidate: NONE
```

Debug features must be disabled in production builds unless explicitly enabled.

---

## 29. Performance Requirements

The Movement System must remain lightweight.

Requirements:

- Avoid unnecessary object allocation in physics updates.
- Reuse vectors and temporary objects where practical.
- Avoid expensive scene-wide collision queries.
- Use collision layers and spatial filtering.
- Limit the number of detection probes.
- Avoid excessive raycasts per frame.
- Keep physics update independent from rendering frequency.
- Avoid repeated geometry scans for the same obstacle.

Procedurally generated geometry should provide collision metadata during creation.

Movement detection should use that metadata rather than repeatedly inspecting complex render meshes.

---

## 30. Error Handling and Recovery

The system must handle invalid movement situations safely.

Examples:

- Player collider overlaps geometry.
- Ground detection fails temporarily.
- Vault destination becomes invalid.
- Wall-run surface disappears.
- Player falls below the level.
- Physics update receives invalid delta time.
- A movement action is requested from an incompatible state.

Recovery behavior should prioritize:

1. Preventing invalid physics state.
2. Avoiding permanent movement lock.
3. Preserving valid momentum where possible.
4. Returning to a safe movement state.

A fall-below-level detection may report the condition to the gameplay layer; the recovery lifecycle is owned and orchestrated by the Respawn System (`RespawnManager`, `17_RESPAWN_SYSTEM_SPEC.md`). The Movement System must not execute respawn, own checkpoint progress, or own save and checkpoint persistence.

---

## 31. Testing Requirements

### 31.1 Unit Tests

Test:

- Acceleration.
- Deceleration.
- Friction.
- Jump velocity calculation.
- Variable jump height.
- Jump buffering.
- Coyote time.
- Momentum preservation.
- Slide friction.
- Wall jump impulse.
- State transition validation.
- Maximum speed limits.

### 31.2 Integration Tests

Test:

- Ground movement on flat surfaces.
- Movement on slopes.
- Jumping from platform edges.
- Landing on different surfaces.
- Sliding under low obstacles.
- Vaulting over valid obstacles.
- Vault rejection for invalid obstacles.
- Wall running on valid walls.
- Wall-run termination.
- Wall jumping.
- Collision with corners.
- Movement at different frame rates.
- Canonical gameplay events (`player:jumped`, `player:landed`, `player:sliding-started`, `player:sliding-ended`, `player:vault-started`, `player:wallrun-started`, `player:wallrun-ended`, `player:walljumped`) are published with the required payload.

### 31.3 Regression Tests

The following scenarios must be tested repeatedly:

- Running directly into a wall.
- Running along a wall.
- Jumping near an edge.
- Jumping immediately before landing.
- Sliding into a low ceiling.
- Attempting to stand under a ceiling.
- Vaulting near an edge.
- Wall running near a corner.
- Landing while moving at maximum speed.
- Falling between closely spaced platforms.

### 31.4 Frame Rate Tests

Test at:

- 30 FPS.
- 60 FPS.
- 120 FPS.
- Unstable frame rates.

The same input sequence should produce comparable movement outcomes within defined tolerances.

Exact determinism across different hardware is not required for the initial implementation, but major physics differences are unacceptable.

---

## 32. Implementation Phases

### Phase 1 — Core Physics

Implement:

- Player capsule.
- Ground detection.
- Collision resolution.
- Horizontal acceleration.
- Friction.
- Gravity.
- Walking.
- Running.
- Sprinting.

Acceptance criteria:

- The player can move reliably.
- Collision prevents movement through solid geometry.
- Movement remains stable across frame rates.
- Horizontal momentum behaves predictably.

### Phase 2 — Jumping

Implement:

- Jump initiation.
- Variable jump height.
- Air control.
- Jump buffering.
- Coyote time.
- Landing detection.

Acceptance criteria:

- Jump height is configurable.
- Jump input feels responsive.
- Air control is predictable.
- Landing preserves horizontal momentum.

### Phase 3 — Crouching and Sliding

Implement:

- Crouch collider.
- Camera height integration.
- Standing clearance detection.
- Slide initiation.
- Slide friction.
- Slide steering.
- Slide jump.

Acceptance criteria:

- Crouching works under low geometry.
- The player cannot stand through ceilings.
- Sliding preserves momentum.
- Slide transitions do not cause collider penetration.

### Phase 4 — Vaulting

Implement:

- Obstacle detection.
- Height validation.
- Landing-space validation.
- Vault trajectory.
- Momentum retention.
- Vault cancellation.

Acceptance criteria:

- Valid obstacles can be vaulted.
- Invalid obstacles are rejected.
- Vaulting does not teleport through geometry.
- The player retains forward movement.

### Phase 5 — Wall Running and Wall Jumping

Implement:

- Wall detection.
- Wall eligibility.
- Wall-run movement.
- Gravity modification.
- Duration limits.
- Wall jumping.
- Wall-run termination.

Acceptance criteria:

- The player can run along valid walls.
- Invalid surfaces do not trigger wall running.
- Wall running terminates reliably.
- Wall jumps move away from the wall.
- Momentum remains predictable.

### Phase 6 — Integration and Tuning

Implement:

- Camera data integration.
- Audio events.
- Training integration.
- Speedrun integration.
- Debug visualization.
- Movement tuning profiles.

Acceptance criteria:

- All systems consume movement data through stable interfaces.
- Training and Prologue use identical movement logic.
- Debug information is available.
- Movement feels consistent throughout the Prologue route.

---

## 33. Definition of Done

The Movement System is considered complete for the initial implementation when:

- [ ] Player capsule and collision are implemented.
- [ ] Ground detection is reliable.
- [ ] Walking, running, and sprinting work.
- [ ] Acceleration and friction are configurable.
- [ ] Momentum is preserved across movement actions.
- [ ] Jumping and landing work.
- [ ] Jump buffering and coyote time work.
- [ ] Air control is implemented.
- [ ] Crouching works.
- [ ] Standing clearance is validated.
- [ ] Sliding works.
- [ ] Slide jumping works.
- [ ] Basic vaulting works.
- [ ] Wall running works.
- [ ] Wall jumping works.
- [ ] Movement state transitions are validated.
- [ ] Collision response is stable.
- [ ] Movement is frame-rate independent.
- [ ] Camera integration is available.
- [ ] Canonical movement events from `03_GAMEPLAY_SPEC.md` §18 are exposed.
- [ ] Training Mode can validate movement actions.
- [ ] Speedrun Mode uses the same movement implementation.
- [ ] Debug visualization is available.
- [ ] Unit and integration tests pass.
- [ ] No critical movement lock or geometry penetration issues remain.

---

## 34. Final Design Constraints

The implementation agent must follow these constraints:

1. Movement must be implemented as a coherent physics-driven system.
2. Do not implement each parkour action as an isolated teleport or animation.
3. Preserve momentum whenever physically reasonable.
4. Keep physics calculations independent from rendering frame rate.
5. Centralize all movement tuning values.
6. Use a capsule collider or equivalent character collision representation.
7. Validate geometry before starting vaults and wall runs.
8. Do not allow decorative geometry to trigger parkour actions accidentally.
9. Keep movement state transitions explicit and testable.
10. Keep camera and audio behavior separate from movement physics.
11. Use the same movement implementation in Training and Prologue.
12. Prioritize predictable collision behavior over complex but unreliable movement features.
13. Do not implement future parkour features before the initial movement foundation is stable.
14. Expose movement events and metrics through stable interfaces.
15. Treat movement feel as a core gameplay requirement, not merely a technical implementation detail.

The final result should deliver a fluid first-person parkour experience where speed, momentum, timing, and route selection are meaningful parts of gameplay.