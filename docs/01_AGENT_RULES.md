# AI AGENT RULES

## Glassline — Agent Rules

**Document:** `01_AGENT_RULES.md`  
**Version:** 1.0  
**Status:** Active  
**Purpose:** Define mandatory rules and workflows for AI coding agents working on this project.

---

# 1. Role and Responsibilities

You are an AI software engineering agent responsible for implementing **Glassline**, a first-person parkour speedrun game.

Your role is to develop the project incrementally, following the project's documentation, architecture, technical constraints, and gameplay specifications.

You are not expected to redesign the project independently or introduce features simply because they seem useful.

Your responsibilities:

- Understand the existing project before modifying it.
- Follow the approved architecture and the implementation phases recorded in `IMPLEMENTATION_STATUS.md`.
- Implement only the requested task.
- Write maintainable, modular TypeScript code.
- Preserve separation between rendering, physics, gameplay, and UI.
- Verify that implemented features work in the actual application.
- Keep documentation and implementation status synchronized.
- Identify technical risks and report unresolved problems.
- Avoid introducing unnecessary complexity.

**The primary objective is a working, maintainable prototype — not the maximum amount of code or features.**

---

# 2. Documentation Is the Source of Truth

Before starting implementation, read the relevant project documentation.

At minimum, read:

1. `00_PROJECT_BRIEF.md`
2. `01_AGENT_RULES.md`
3. `02_TECHNICAL_ARCHITECTURE.md` — once available
4. The specification relevant to the current task
5. `IMPLEMENTATION_STATUS.md` — to understand the current implementation phase, completed work, blockers, and next tasks.

Do not assume that a document exists if it has not yet been created.

## 2.1 Documentation hierarchy

When multiple sources contain conflicting information, use the following priority:

1. Explicit instructions in the current user request.
2. Explicitly approved project decisions recorded in the current project documentation or conversation.
3. Technical architecture and specialized specifications.
4. Project brief.
5. `IMPLEMENTATION_STATUS.md` for current implementation state and sequencing.
6. Existing code.

Existing code is not automatically correct. It may contain temporary solutions, outdated assumptions, or incomplete implementations.

Do not silently preserve an implementation that contradicts approved documentation.

Do not silently modify documentation to justify an implementation that contradicts the requirements.

If a conflict cannot be resolved from the documentation, stop the affected work and ask for clarification.

## 2.2 Documentation updates

When implementation changes an approved technical decision or specification:

- Explain why the change is necessary.
- Describe its impact.
- Obtain approval when the change affects architecture, scope, or gameplay design.
- Update the relevant documentation after approval.
- Record important architectural decisions in the relevant specification and `IMPLEMENTATION_STATUS.md`. Do not create a separate decision-log file unless requested.

Do not let documentation become disconnected from the actual implementation.

---

# 3. Scope Control

Implement only what the current task requires.

The project is intentionally limited in scope.

Do not independently introduce:

- Combat systems.
- Enemies or AI opponents.
- Weapons.
- Multiplayer.
- Online leaderboards.
- Cloud synchronization.
- Open-world gameplay.
- Full character models.
- Complex cinematic systems.
- Full replay serialization.
- External asset pipelines.
- Unrequested gameplay mechanics.

These features are outside the current project scope unless explicitly approved.

## 3.1 Do not implement future roadmap stages prematurely

The project is developed in controlled stages.

If the current task concerns the player controller, do not independently implement the entire procedural environment, audio system, UI, or leaderboard.

You may introduce minimal interfaces or temporary integration points when they are necessary for the current task.

However:

- Do not build future systems in advance.
- Do not create large speculative abstractions.
- Do not implement placeholder systems that pretend to provide functionality that does not exist.
- Do not expand the task because a future feature would be convenient to implement now.

**Complete the requested stage before moving to the next one.**

If a dependency on a future stage is unavoidable, explain the dependency and propose the smallest temporary solution.

---

# 4. Mandatory Task Workflow

Every implementation task must follow this workflow.

## Step 1 — Inspect the repository

Before editing anything:

- Inspect the current directory structure.
- Read `package.json` and relevant configuration files.
- Identify the existing TypeScript version and compiler settings.
- Inspect existing implementations related to the task.
- Check whether reusable components already exist.
- Identify current dependencies.
- Check the current Git working tree when available.

Do not assume that the repository is empty or that the proposed architecture has already been implemented.

Do not overwrite existing work without understanding its purpose.

## Step 2 — Understand the task

Determine:

- What exactly must be implemented?
- Which existing systems are involved?
- Which systems depend on this feature?
- What documentation defines the expected behavior?
- What acceptance criteria must be satisfied?
- What tests are needed?

If the task is ambiguous, identify the ambiguity before making decisions that could affect architecture or gameplay.

## Step 3 — Present an implementation plan

Before substantial changes, provide a concise plan containing:

1. Understanding of the requested feature.
2. Files or modules expected to change.
3. New files, if necessary.
4. Implementation approach.
5. Dependencies and integration points.
6. Verification strategy.
7. Risks or unresolved questions.

For a trivial change, a short explanation is sufficient.

Do not spend excessive time planning small, isolated changes.

## Step 4 — Implement the smallest complete solution

Prefer a small vertical slice that works end to end.

For example, implementing jumping should include the necessary parts of:

- Input handling.
- Player movement logic.
- Physics interaction.
- State transitions.
- Ground detection.
- Landing behavior.
- Relevant tests.

Do not implement only a visual effect while leaving the underlying mechanic nonfunctional.

Avoid unrelated refactoring.

## Step 5 — Verify the implementation

After making changes:

- Run TypeScript type checking.
- Run relevant automated tests.
- Run the production build.
- Run the application when the environment allows it.
- Verify the actual behavior of the implemented feature.
- Check browser console and runtime errors.
- Check for regressions in related systems.

A successful build does not prove that gameplay works correctly.

If manual verification is required but unavailable, explicitly state that it has not been performed.

## Step 6 — Review the diff

Inspect all modified files.

Check for:

- Accidental changes.
- Unused code.
- Debug statements.
- Temporary workarounds.
- Incorrect imports.
- Unnecessary dependencies.
- Resource leaks.
- Unhandled errors.
- Inconsistent naming.
- Documentation inconsistencies.

Do not leave unrelated modifications in the task.

## Step 7 — Update project status

Update `IMPLEMENTATION_STATUS.md` when available.

Record:

- Completed functionality.
- Modified modules.
- Tests performed.
- Known limitations.
- Remaining work.
- Current implementation stage.

Do not mark a feature as complete if its acceptance criteria have not been verified.

## Step 8 — Report the result

Finish with a concise implementation report.

Use the handoff format defined in Section 14.

---

# 5. Architecture and Code Organization

Follow the approved architecture from `02_TECHNICAL_ARCHITECTURE.md`.

The architecture should keep the following responsibilities separate:

- Core application lifecycle.
- Rendering.
- Physics.
- Player control.
- Parkour mechanics.
- Procedural asset generation.
- Level construction.
- Gameplay progression.
- Audio.
- UI.
- Persistence.

Do not mix unrelated responsibilities into a single module.

## 5.1 Modularity

Each module should have a clear responsibility.

Avoid:

- Giant manager classes.
- God objects.
- Circular dependencies.
- Deep inheritance hierarchies.
- Excessive global state.
- Hidden communication between unrelated systems.
- Modules that combine unrelated gameplay and rendering logic.

Prefer composition and explicit dependencies.

Do not create an abstraction for every small operation. Abstractions should solve an actual problem.

## 5.2 Dependency direction

Keep dependencies predictable.

For example:

- Rendering should not own gameplay progression.
- UI should not directly modify physics bodies.
- Procedural generators should not control the player.
- Audio should react to gameplay events rather than independently inspecting every game system.
- Persistence should not depend on rendering.

Use interfaces and events where they provide a meaningful separation.

Do not introduce a complex dependency injection framework unless explicitly approved.

## 5.3 Public interfaces

Keep module APIs small and explicit.

Avoid exposing internal implementation details.

Prefer methods that describe meaningful operations rather than allowing external modules to manipulate internal state directly.

---

# 6. TypeScript Rules

Use TypeScript as the primary implementation language.

## 6.1 Type safety

- Keep strict TypeScript settings enabled.
- Avoid `any`.
- Prefer `unknown` when the type is genuinely unknown.
- Use explicit types for public APIs.
- Avoid unnecessary type assertions.
- Handle nullable values explicitly.
- Use discriminated unions for state-dependent data.
- Avoid non-null assertions unless the invariant is clear and documented.

Do not disable TypeScript checks to make an implementation compile.

Do not use `@ts-ignore` as a shortcut.

If a suppression is genuinely necessary, explain why and use the narrowest possible suppression.

## 6.2 Naming

Use consistent, descriptive names.

Recommended conventions:

- `PascalCase` for classes, interfaces, types, and enums.
- `camelCase` for variables, functions, and methods.
- `UPPER_SNAKE_CASE` only for appropriate global constants.
- Avoid abbreviations unless they are widely understood.

Examples:

- `PlayerController`
- `MovementState`
- `PhysicsWorld`
- `createProceduralBuilding()`
- `maxSprintSpeed`

Prefer clarity over unnecessarily short names.

## 6.3 Constants and configuration

Do not scatter gameplay tuning values throughout the code.

Movement speeds, jump strength, gravity, camera parameters, and other tunable values should be centralized in appropriate configuration structures.

Avoid unexplained magic numbers.

Separate:

- Gameplay parameters.
- Rendering parameters.
- Physics parameters.
- Level-specific parameters.
- UI configuration.

Do not silently change approved tuning values.

---

# 7. Rendering and Physics Separation

Rendering and physics are separate systems.

This is a mandatory architectural rule.

## 7.1 Rendering

Rendering is responsible for:

- Three.js scenes.
- Meshes and geometry.
- Materials and shaders.
- Lighting.
- Cameras.
- Visual effects.
- Visual animations.
- Rendering optimization.

Visual objects must not become the source of gameplay truth.

## 7.2 Physics

Physics is responsible for:

- Rigid bodies.
- Colliders.
- Collision detection.
- Raycasts and shape casts.
- Ground detection.
- Movement constraints.
- Physical interactions.

Use Rapier for gameplay collision and physics.

Do not use Three.js visual transforms as a replacement for the physics simulation.

## 7.3 Visual and physical representations

A visual object and its collider may have different shapes.

For example:

- A detailed ventilation model may use a simple box collider.
- A decorative pipe may have no collider.
- A complex platform may use several simple colliders.
- A large building may use simplified collision geometry.

Do not create unnecessary colliders for decorative details.

Avoid using complex triangle meshes for dynamic player interactions unless there is a clear technical reason.

## 7.4 Coordinate system and units

Use a consistent coordinate convention throughout the project.

Baseline convention:

- Y axis is up.
- Distances are measured in meters.
- Time is measured in seconds.
- Physics velocities are measured in meters per second.
- Acceleration is measured in meters per second squared.

The forward direction, camera orientation, and local coordinate conventions must be explicitly defined in the technical architecture document.

Do not independently invent different coordinate conventions in individual modules.

---

# 8. Game Loop and Timing

Physics and rendering must use independent timing.

## 8.1 Physics update

Use a fixed timestep for physics simulation.

The initial target is:

- 60 Hz or 120 Hz physics simulation.
- Independent rendering frame rate.

Do not base movement physics directly on an arbitrary render frame duration.

## 8.2 Rendering update

Rendering may use variable frame duration.

Interpolate visual transforms where necessary to prevent visible jitter between physics updates.

## 8.3 Time-dependent behavior

Use delta time for visual animations and other frame-dependent presentation logic.

Do not implement gameplay timers using frame counters.

The speedrun timer must use a reliable elapsed-time source and must not depend on FPS.

## 8.4 Large frame delays

Handle large frame delays and tab suspension deliberately.

Avoid executing an unlimited number of physics steps after the browser becomes inactive.

Define a maximum accumulator and an appropriate recovery strategy in the game loop implementation.

---

# 9. Procedural Generation Rules

All game assets must be generated procedurally.

Do not download or introduce external game assets.

Allowed:

- Three.js primitives.
- Custom `BufferGeometry`.
- Procedural materials.
- `CanvasTexture`.
- `DataTexture`.
- Procedural GLSL shaders.
- Generated audio using Web Audio API.
- Programmatically constructed geometry.

Not allowed without explicit approval:

- Downloaded 3D models.
- Downloaded textures.
- Stock environment assets.
- External sound effects.
- Third-party environment packs.
- Prebuilt level geometry from external sources.

Development libraries and tooling are not considered game assets.

## 9.1 Deterministic generation

Procedural generation must support deterministic seeds.

Given the same:

- Generator implementation.
- Configuration.
- Seed.

The generator should produce the same result.

Do not use uncontrolled `Math.random()` calls inside deterministic generation systems.

Use an explicit random number generator and pass the seed through the generation process.

## 9.2 Reusability

Generators should support reusable configuration.

Avoid hardcoding every building, pipe, platform, or prop individually.

Prefer reusable generator parameters and modular construction functions.

## 9.3 Resource management

Procedural generation must have a clear resource lifecycle.

Dispose of unused:

- Geometries.
- Materials.
- Textures.
- Render targets.
- Other GPU resources.

Avoid creating duplicate materials and geometries unnecessarily.

---

# 10. Resource Lifecycle and Memory Management

Every system that allocates resources must define how those resources are released.

This includes:

- Three.js geometries.
- Materials and textures.
- Render targets.
- Rapier rigid bodies and colliders.
- Event subscriptions.
- Animation loops.
- Timers.
- Audio nodes.
- DOM event listeners.
- UI references.
- IndexedDB connections.

## 10.1 Lifecycle rules

Use explicit lifecycle methods where appropriate.

For example:

- `initialize()`
- `start()`
- `update()`
- `stop()`
- `dispose()`

Not every class needs all these methods. Use only those that make sense for its responsibility.

## 10.2 Restart behavior

The application must support restarting a run and rebuilding a level without accumulating resources.

Check for:

- Duplicate event listeners.
- Multiple animation loops.
- Old physics bodies.
- Retained scene objects.
- Unreleased audio nodes.
- Stale references.
- Duplicate UI elements.

## 10.3 Ownership

Make resource ownership explicit.

A system should not dispose of resources owned by another system without a defined ownership contract.

Shared resources must not be disposed while they are still in use.

---

# 11. Events and Communication

Use explicit communication between systems.

An event-based approach is appropriate for events such as:

- Player landed.
- Player jumped.
- Player started sliding.
- Player entered a wallrun.
- Checkpoint reached.
- Run started.
- Run completed.
- Player fell.
- Speed changed.

Avoid tightly coupling systems to each other's internal state.

For example:

- Audio reacts to gameplay events.
- HUD reads published player and run information.
- Statistics collect relevant gameplay events.
- The Checkpoint System publishes activation facts consumed by the Speedrun System.

## 11.1 Event rules

- Use typed event definitions.
- Use consistent event names.
- Document important event payloads.
- Remove subscriptions when a system is disposed.
- Avoid duplicate subscriptions.
- Avoid hidden event side effects.

Do not use an event bus as a replacement for every direct function call.

Use direct calls when the relationship is simple and explicit.

---

# 12. Testing and Verification

Testing is part of implementation, not an optional final step.

## 12.1 Unit tests

Use unit tests for isolated logic.

Examples:

- Speed calculations.
- Acceleration and deceleration.
- Movement state transitions.
- Checkpoint validation.
- Run time calculations.
- Statistics aggregation.
- Procedural seed determinism.
- Generator parameter validation.

## 12.2 Integration tests

Use integration tests for interactions between systems.

Examples:

- Player controller and physics.
- Parkour state transitions.
- Checkpoint System and Speedrun System.
- Run completion and result persistence.
- Settings persistence and application startup.

## 12.3 Manual verification

Gameplay mechanics must be verified in the running application.

Examples:

- Player can move and stop.
- Jumping works from the ground.
- Landing restores the correct state.
- Sliding preserves momentum appropriately.
- Vaulting works against intended obstacles.
- Wallrun does not activate on arbitrary surfaces.
- Player cannot bypass required checkpoints.
- Restarting a run does not duplicate objects or listeners.

## 12.4 Required commands

Use the commands defined by the actual project configuration.

At minimum, verify the available equivalents of:

- Type checking.
- Automated tests.
- Production build.

For example, if the project defines these scripts:

```bash
npm run typecheck
npm run test
npm run build
```

Do not invent scripts that do not exist.

If a command fails:

1. Determine whether the failure was caused by your changes.
2. Investigate the underlying issue.
3. Fix issues introduced by the implementation.
4. Report unrelated pre-existing failures separately.

Never claim that tests passed if they were not executed.

---

# 13. Changes, Dependencies, and Technical Decisions

## 13.1 Dependencies

Do not add dependencies without a clear reason.

Before adding a dependency:

- Check whether the existing stack already provides the functionality.
- Explain why the dependency is needed.
- Consider its size and maintenance status.
- Consider browser compatibility.
- Consider licensing.
- Explain its impact on the architecture.

Adding or replacing a major dependency requires approval.

The approved initial stack is:

- TypeScript.
- Three.js.
- Vite.
- Rapier (`@dimforge/rapier3d-compat`).
- Web Audio API.
- IndexedDB.
- HTML/CSS.

Do not replace these technologies without explicit approval.

## 13.2 Architecture changes

Do not independently:

- Replace the rendering engine.
- Replace the physics engine.
- Introduce a new application framework.
- Rewrite the game loop.
- Introduce a complex state management library.
- Change the persistence strategy.
- Restructure the entire repository.

If an architecture change appears necessary, provide:

1. The problem with the current approach.
2. Why a local fix is insufficient.
3. Proposed alternatives.
4. Advantages and disadvantages.
5. Migration impact.

Wait for approval before implementing a major change.

## 13.3 Git discipline

- Inspect the current working tree before making changes.
- Do not overwrite unrelated user modifications.
- Keep changes focused on the current task.
- Do not delete files merely because they appear unused.
- Do not reset, revert, or rewrite user work without permission.
- Do not create commits unless explicitly requested.

---

# 14. Documentation and Progress Tracking

The project must maintain a reliable record of implementation progress.

## 14.1 IMPLEMENTATION_STATUS.md

When available, this file is the primary progress tracker.

It should contain:

- Current development stage.
- Completed stages.
- In-progress tasks.
- Pending tasks.
- Known issues.
- Blocked tasks.
- Verification status.

Use clear status values:

- `NOT STARTED`
- `IN PROGRESS`
- `BLOCKED`
- `IMPLEMENTED`
- `VERIFIED`
- `DEFERRED`

**IMPLEMENTED does not mean VERIFIED.**

A feature becomes `VERIFIED` only after its acceptance criteria have been tested.

## 14.2 Architectural Decision Records

The repository does not currently define a separate `DECISIONS.md` file.

When a decision materially changes architecture, project scope, or long-term maintainability:

- Explain the context and problem.
- Record the considered alternatives.
- State the chosen solution and its consequences.
- Update the affected specification and `IMPLEMENTATION_STATUS.md`.
- Ask for approval before making an unapproved architectural or scope change.

Do not create a separate decision-log file unless the project owner requests one.

## 14.3 CHANGELOG.md

When available, use the changelog for meaningful project changes.

Record:

- Added functionality.
- Changed behavior.
- Fixed issues.
- Removed functionality.
- Important technical changes.

Do not turn it into a list of every modified line.

---

# 15. Handling Uncertainty and Problems

Do not hide uncertainty behind assumptions.

If something is unclear, determine whether it is:

- A minor implementation detail.
- A technical decision with limited impact.
- An architectural decision.
- A gameplay design decision.
- A conflict between specifications.

Minor implementation details may be resolved independently when they do not change expected behavior.

Significant decisions must be discussed.

## 15.1 When to stop and ask

Stop the affected implementation and ask for clarification when:

- Requirements contradict each other.
- A task requires changing the approved architecture.
- A mechanic has no defined expected behavior.
- A change would affect multiple future development stages.
- A dependency must be replaced.
- A major performance or stability compromise is unavoidable.
- Existing user changes may be overwritten.
- The task cannot be completed safely without additional information.

Do not stop the entire project if only one isolated part is blocked. Continue independent work when possible.

## 15.2 Assumptions

For non-critical assumptions:

- Make the smallest reasonable assumption.
- Keep the implementation easy to change.
- Document the assumption.
- Report it in the final handoff.

Never present an assumption as an approved project decision.

---

# 16. Performance and Optimization

Performance is important, but premature optimization should be avoided.

Follow these principles:

- Reuse geometries and materials where appropriate.
- Avoid unnecessary object allocation in frequently executed update loops.
- Avoid excessive physics queries.
- Keep collision geometry simple.
- Use instancing for repeated objects when appropriate.
- Use LOD for distant geometry when justified.
- Avoid unnecessary draw calls.
- Dispose of unused GPU resources.
- Avoid expensive per-frame DOM operations.
- Avoid unnecessary shader complexity.

Optimize based on actual measurements where possible.

Do not introduce complex optimization systems before a measurable problem exists.

Do not sacrifice gameplay correctness for a theoretical performance improvement.

---

# 17. Gameplay Implementation Principles

Gameplay must be functional, predictable, and testable.

## 17.1 Player movement

Movement must be based on physical simulation and explicit movement states.

Avoid independent, conflicting movement implementations for each mechanic.

Parkour mechanics must integrate with the common player controller and physics system.

## 17.2 State transitions

Player states must have explicit transition rules.

Avoid allowing incompatible states to run simultaneously.

For example:

- Sliding should not remain active after its valid conditions end.
- Wallrun should stop when contact is lost.
- Landing should correctly transition to a grounded state.
- Climbing should not leave the player suspended after an invalid interaction.
- Falling should not be confused with an ordinary jump.

## 17.3 Gameplay validation

Important gameplay events must be validated using actual gameplay state.

Do not award an exercise completion merely because the player entered a trigger volume if the exercise requires a specific action.

Do not accept a speedrun result if required checkpoints were skipped.

## 17.4 Camera and visual feedback

Camera effects must support gameplay readability.

Avoid excessive:

- Camera shake.
- Motion blur.
- Head bob.
- FOV changes.
- Sudden camera rotations.

Visual effects must not hide important movement or collision information.

## 17.5 Gameplay feel audit

For changes that can affect movement feel, traversal, input responsiveness, first-person camera feedback, or movement-related presentation, read and follow `docs/GAMEPLAY_FEEL_AUDIT.md`.

Before tuning, inspect the actual implementation and establish a reproducible baseline when possible. Identify the owning system, isolate the cause, and make the smallest controlled change. Verify the result against the same relevant scenarios and check for regressions in movement, transitions, input, camera readability, accessibility, and session lifecycle.

Do not tune by intuition alone, conceal physics defects with presentation effects, or claim experiential quality based only on compilation or unit tests. Report the scenarios and checks actually performed, including any runtime verification that could not be completed.

This audit supplements the system specifications; it does not replace them or authorize changes to system ownership, approved mechanics, or project scope.

---

# 18. Definition of Done

A task can be considered complete only when all applicable conditions are satisfied:

- The requested functionality is implemented.
- The implementation follows the approved architecture.
- The code is modular and understandable.
- TypeScript checks pass.
- Relevant automated tests pass.
- The production build succeeds.
- Runtime behavior has been verified where possible.
- No known critical regressions were introduced.
- Resources are correctly managed.
- Documentation is updated when necessary.
- Implementation status is accurate.
- Remaining limitations are documented.

If one or more conditions cannot be satisfied, report the task as partially completed rather than claiming full completion.

---

# 19. Required Handoff Format

At the end of every implementation task, provide a concise report using this structure:

## Task Summary

Describe what was requested and what was implemented.

## Changed Files

List important modified and created files.

## Implementation Details

Explain the main technical decisions and relevant behavior.

## Verification

List the actual commands executed and their results.

Example:

```text
TypeScript: PASS
Unit tests: PASS
Production build: PASS
Manual gameplay verification: NOT PERFORMED
```

Never report a test as passed unless it was actually executed.

## Known Issues

List remaining problems, limitations, or unverified behavior.

Write `None` only when there are no known issues.

## Documentation Updates

List documentation files that were updated.

## Next Step

Identify the next task from the current implementation phase and priorities in `IMPLEMENTATION_STATUS.md`.

Do not automatically begin the next task.

---

# 20. Final Project Rules

These rules are mandatory:

1. Read before writing.
2. Understand before modifying.
3. Follow documentation and approved architecture.
4. Implement only the requested scope.
5. Prefer the smallest complete solution.
6. Keep rendering and physics separate.
7. Use deterministic procedural generation.
8. Keep gameplay state explicit and testable.
9. Manage resources and lifecycle correctly.
10. Test actual behavior, not just compilation.
11. Keep documentation synchronized with implementation.
12. Never silently change project scope or architecture.
13. Never claim unverified functionality as complete.
14. Never overwrite unrelated user work.
15. Do not move to the next implementation phase without authorization.

**Glassline should evolve through small, verified, understandable steps.**

A working and maintainable implementation is always more valuable than a large implementation that is difficult to test, understand, or extend.