# GLASSLINE — AGENT GUIDE

> Mandatory entry point for AI agents working on the Glassline project.

## 1. Mission

You are an implementation agent working on **Glassline**, a first-person parkour game inspired by the original Mirror's Edge.

Your primary responsibility is to implement the project according to its specifications, existing architecture, and current implementation state.

You must prioritize:

1. Correctness.
2. Architectural consistency.
3. Gameplay quality.
4. Maintainability.
5. Performance.
6. Incremental and verifiable progress.

Do not optimize for the amount of code produced.

Optimize for a working, integrated, maintainable game.

---

## 2. Mandatory Reading Order

Before making changes, read the following documents.

### Always Required

1. `README.md`
2. `docs/01_AGENT_RULES.md`
3. `docs/02_TECHNICAL_ARCHITECTURE.md`
4. `docs/IMPLEMENTATION_STATUS.md`

These documents establish the project identity, implementation rules, technical architecture, and current development state.

### Task-Specific Documentation

Read the specification for every system directly affected by your task.

Also read specifications for systems that:

- Provide dependencies.
- Consume your system's interfaces or events.
- Own related gameplay state.
- Participate in the same lifecycle.
- Define shared data models or contracts.

Do not rely on document filenames or summaries alone when implementation details matter.

Read the actual specifications.

### Documentation Priority

Use the following precedence when resolving conflicts:

1. Explicit instructions in the current task.
2. `docs/01_AGENT_RULES.md` for general agent behavior.
3. `docs/02_TECHNICAL_ARCHITECTURE.md` for technical architecture.
4. The relevant system specifications for domain behavior and ownership.
5. Existing implementation and tests as evidence of current behavior.
6. `README.md` for project overview.

This precedence does not authorize silently ignoring contradictions.

If two authoritative specifications conflict, identify the conflict and resolve it before making an incompatible implementation decision.

If the current task explicitly changes an architectural decision, update the affected documentation as part of the task.

---

## 3. First Action: Inspect the Repository

Never assume the repository is empty or that a feature is missing.

Before implementation:

1. Inspect the repository structure.
2. Inspect the package manager and project configuration.
3. Identify the runtime, rendering technology, and build tools.
4. Inspect existing modules and public interfaces.
5. Check available scripts and test commands.
6. Inspect the relevant implementation.
7. Compare the implementation with the relevant specification.
8. Check `docs/IMPLEMENTATION_STATUS.md`.

Determine whether the requested feature is:

- Completely missing.
- Partially implemented.
- Implemented but not integrated.
- Integrated but insufficiently tested.
- Implemented with architectural deviations.
- Already complete.

Do not recreate functionality that already exists.

Prefer extending or correcting existing implementations over creating parallel systems.

---

## 4. Architecture Rules

### 4.1 Single Responsibility and Ownership

Every system has one authoritative owner for its domain.

Do not duplicate business logic, state, or lifecycle orchestration.

Examples:

| Responsibility | Authoritative System |
|---|---|
| Locomotion physics | Movement |
| First-person presentation | Camera |
| Player lifecycle aggregation | Player State |
| Interaction detection and execution | Interaction |
| Checkpoint progress | Checkpoint |
| Recovery lifecycle | Respawn |
| Spawn point and level runtime | Level Runtime |
| Gameplay session lifecycle | Gameplay Session |
| Application navigation | Gameplay Flow |
| Training exercises and evaluation | Training |
| Run timing and validation | Speedrun |
| Content unlocks and milestones | Progression |
| Achievement definitions and unlocking | Achievement |
| Gameplay statistics | Statistics |
| Persistence infrastructure | Save |
| Configuration and preferences | Settings |
| Translation resources and resolution | Localization |
| Accessibility policy coordination | Accessibility |
| Menu presentation | Menu |
| Gameplay HUD presentation | HUD |

When another system needs information, use its public interface, snapshot, command, or event contract.

Do not access its internal mutable state directly.

### 4.2 No Duplicate State

Do not introduce multiple authoritative representations of the same state.

Prefer:

- Derived values.
- Immutable snapshots.
- Explicit state transitions.
- Domain-owned models.
- Event-driven updates.

Avoid unnecessary boolean flags that duplicate existing state machines.

### 4.3 Explicit Contracts

Public interfaces must have clear:

- Ownership.
- Input and output types.
- Error behavior.
- Lifecycle behavior.
- Cancellation behavior.
- Event semantics.
- Session or attempt identity where applicable.

Avoid implicit coupling through global variables, arbitrary object references, or undocumented shared state.

### 4.4 Dependency Direction

Follow the dependency boundaries defined in `docs/02_TECHNICAL_ARCHITECTURE.md`.

In general:

- Domain systems own gameplay rules.
- Runtime systems coordinate lifecycle.
- Infrastructure systems provide shared capabilities.
- Presentation systems consume state and provide feedback.

Do not introduce circular dependencies.

### 4.5 Engine and Framework Decisions

Do not introduce a new game engine, rendering framework, state-management library, physics library, or major dependency without checking the existing project architecture.

Do not assume that a conceptual interface in a specification already exists in the codebase.

Inspect the actual repository before selecting implementation details.

---

## 5. Gameplay Invariants

These rules are central to Glassline and must remain consistent across implementations.

### 5.1 First-Person Parkour

Movement is the primary gameplay experience.

All mechanics should support fluid traversal and momentum management.

Do not introduce mechanics that undermine the established movement model without explicit approval.

### 5.2 Frame-Rate Independence

Gameplay simulation must not depend on rendering FPS.

Use the timing and update model defined in the Movement and Technical Architecture specifications.

Do not use frame counts as substitutes for elapsed time.

### 5.3 Player State Separation

Do not combine unrelated state domains into one monolithic state machine.

Movement, player lifecycle, respawn, session lifecycle, and application navigation remain separate authoritative domains.

### 5.4 Checkpoint and Respawn Separation

Checkpoint owns checkpoint progress and recovery destination information.

Respawn owns the recovery lifecycle.

`RespawnManager` is the canonical recovery orchestrator.

Do not implement a second respawn lifecycle manager inside Checkpoint or Level Runtime.

### 5.5 Speedrun Integrity

Speedrun timing must use a monotonic time source.

Rendering frame rate must not affect recorded times.

Checkpoint order and route validity must be checked by the Speedrun system.

Do not independently calculate or modify speedrun results in HUD, Statistics, or Progression.

### 5.6 Session Isolation

Session-scoped operations must be associated with the correct session identity.

Attempt-scoped operations must reject stale events from previous attempts.

Cancelled, unloaded, or replaced sessions must not receive stale asynchronous results.

### 5.7 Persistence

IndexedDB is the intended local persistence foundation.

Use Save System interfaces rather than allowing arbitrary gameplay systems to create their own persistence layers.

Never persist high-frequency gameplay data every frame.

---

## 6. Initial Release Scope

Prioritize the initial playable experience.

Required systems and features include:

- First-person movement.
- Mouse and keyboard input.
- Core traversal mechanics.
- Collision and player recovery.
- Training mode.
- Prologue mode.
- Five Prologue sections.
- Five required checkpoints.
- Speedrun timer and splits.
- Personal best records.
- Local leaderboard.
- IndexedDB persistence.
- Main Menu and Pause Menu.
- Settings.
- Gameplay HUD.
- Basic audio feedback.
- Initial accessibility support.
- English localization.
- Core tutorial guidance.

### Deferred Features

Do not implement these as part of the initial scope unless explicitly requested:

- Ghost Replay.
- Online leaderboards.
- Cloud saves.
- Multiplayer.
- Online accounts.
- Advanced procedural campaigns.
- Advanced traversal mechanics outside the initial movement scope.
- Remote analytics.

Architectural extension points may be introduced when required by specifications, but deferred functionality must not become an unnecessary implementation dependency.

---

## 7. Implementation Workflow

Every task must follow this workflow.

### Step 1 — Understand

- Read the relevant specifications.
- Inspect the existing implementation.
- Identify ownership boundaries.
- Identify dependencies.
- Understand the expected behavior.
- Determine what is already complete.

### Step 2 — Plan

Define:

- Files and modules to change.
- Interfaces affected.
- Dependencies required.
- Data models affected.
- Events affected.
- Tests required.
- Documentation updates required.

Keep the plan proportional to the task.

Do not redesign unrelated architecture.

### Step 3 — Implement

- Follow existing code conventions.
- Reuse existing abstractions.
- Keep changes focused.
- Preserve public contracts unless the task requires changing them.
- Handle errors explicitly.
- Handle asynchronous cancellation and stale results.
- Implement cleanup and lifecycle behavior.
- Avoid unnecessary dependencies.

Do not leave critical behavior as a placeholder.

### Step 4 — Verify

Run the relevant available commands:

- Type checking.
- Linting.
- Unit tests.
- Integration tests.
- Build.
- Relevant runtime or browser checks.

Do not claim a command passed if it was not executed.

If verification cannot be performed, explain why.

### Step 5 — Review

Before finishing:

- Check for duplicate functionality.
- Check system ownership boundaries.
- Check for stale state and lifecycle bugs.
- Check resource cleanup.
- Check error handling.
- Check specification compliance.
- Check whether unrelated code was modified.

### Step 6 — Update Documentation

Update `docs/IMPLEMENTATION_STATUS.md` when implementation status changes.

Update system specifications when architectural contracts or intended behavior change.

Do not modify documentation merely to make incomplete implementation appear complete.

---

## 8. Code Quality Requirements

### General

- Prefer readable, explicit code.
- Use strong typing.
- Avoid unnecessary abstractions.
- Avoid oversized classes and modules.
- Keep domain logic testable.
- Avoid hidden side effects.
- Keep interfaces small and purposeful.
- Handle invalid input and failure states explicitly.

### Asynchronous Operations

- Avoid unhandled promise rejections.
- Support cancellation where appropriate.
- Reject stale asynchronous results.
- Avoid race conditions during session transitions.
- Do not assume asynchronous completion order.
- Ensure cleanup happens even when operations fail.

### Runtime and Performance

- Avoid unnecessary allocations in critical gameplay loops.
- Avoid expensive work in per-frame updates.
- Avoid unnecessary DOM operations during gameplay.
- Avoid persistence operations in high-frequency loops.
- Profile before introducing complex optimizations.

### Testing

Tests should focus on behavior and contracts, not private implementation details.

Prioritize:

- State transitions.
- Invalid operations.
- Boundary conditions.
- Repeated operations.
- Cancellation.
- Session and attempt isolation.
- Integration contracts.
- Persistence failures and recovery.

---

## 9. Handling Unclear or Missing Specifications

Do not invent major architectural decisions.

If required information is missing:

1. Check related specifications.
2. Check the technical architecture.
3. Inspect existing patterns.
4. Determine whether a conservative implementation is possible.
5. Record assumptions explicitly.
6. Identify unresolved decisions.

If an unresolved decision affects public interfaces, system ownership, persistence format, or gameplay behavior, stop before committing to an incompatible design.

For minor implementation details, use the simplest solution consistent with the architecture.

Do not block progress for cosmetic or easily reversible decisions.

---

## 10. Change Management

### Scope Control

Only modify files necessary for the assigned task.

Avoid opportunistic refactoring.

If a related defect must be fixed, explain why it is necessary.

### Existing Code

Never replace a working implementation with a new abstraction without a clear reason.

Before removing code, identify:

- Its current responsibilities.
- Its consumers.
- Its tests.
- Its lifecycle behavior.
- Any external contracts.

### Breaking Changes

When changing public interfaces:

- Identify all consumers.
- Update affected implementations.
- Update tests.
- Update related specifications.
- Update integration status.

Never leave a project with partially migrated interfaces.

### Dependencies

Before adding a dependency:

- Check whether existing tools already solve the problem.
- Check compatibility with the project runtime.
- Consider bundle size and maintenance.
- Explain why the dependency is necessary.

---

## 11. Definition of Done

A task is complete only when all applicable conditions are satisfied.

- [ ] The requested functionality is implemented.
- [ ] Existing architecture is respected.
- [ ] No duplicate authoritative system was introduced.
- [ ] Public contracts are consistent.
- [ ] Error and lifecycle behavior are handled.
- [ ] Relevant tests have been added or updated.
- [ ] Relevant tests have been executed.
- [ ] Build and type checking pass, where available.
- [ ] No unrelated changes remain.
- [ ] Documentation is updated where necessary.
- [ ] `docs/IMPLEMENTATION_STATUS.md` reflects the actual state.

A task may be reported as partially complete when some conditions cannot be met, but the remaining work must be explicit.

---

## 12. Required Completion Report

At the end of every implementation task, provide a concise report.

Use this structure:

### Summary

Describe what was implemented.

### Files Changed

List created, modified, and deleted files.

### Implementation Details

Explain the important architectural and behavioral decisions.

### Verification

List commands executed and their actual results.

### Tests

List added or updated tests.

### Specification Compliance

Describe whether the implementation follows the relevant specifications.

Record deviations and assumptions.

### Remaining Work

List incomplete requirements, known issues, and blockers.

### Implementation Status

State whether the system or feature is:

- Not Started
- In Progress
- Implemented
- Integrated
- Verified
- Blocked
- Deferred

Do not report `Verified` without successful verification evidence.

### Recommended Next Task

Suggest one logical next implementation step.

---

## 13. Final Rules

1. Read before writing.
2. Inspect before creating.
3. Reuse before duplicating.
4. Respect system ownership.
5. Follow documented contracts.
6. Keep gameplay deterministic.
7. Protect session and attempt isolation.
8. Test behavior, not assumptions.
9. Update implementation status honestly.
10. Prefer a small, verified increment over a large, unverified change.

**Your goal is not to produce code that merely looks complete. Your goal is to make Glassline work as a coherent game.**