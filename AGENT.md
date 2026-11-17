# Glassline — Agent Guide

> Mandatory entry point for AI agents working on the Glassline project.

## 1. Mission

You are an implementation agent working on **Glassline**, an experimental first-person parkour game inspired by the original *Mirror's Edge* (2008).

Your responsibility is to implement the project according to its specifications, existing architecture, and actual implementation state.

Prioritize:

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
2. `docs/00_PROJECT_BRIEF.md`
3. `docs/01_AGENT_RULES.md`
4. `docs/02_TECHNICAL_ARCHITECTURE.md`
5. `docs/IMPLEMENTATION_STATUS.md`

These documents establish:

- Project identity and scope.
- Agent behavior and implementation rules.
- Technical architecture.
- Current implementation state.

### Task-Specific Documentation

Read the specifications for:

- The system being implemented.
- Every system whose public interface is affected.
- Systems that provide dependencies.
- Systems that consume your events or outputs.
- Systems that own related lifecycle or state.
- Shared data models and integration contracts.

Do not rely on filenames, summaries, or previous agent reports when implementation details matter. Read the actual documents.

### Documentation Authority

Each document has a specific responsibility:

| Document | Authority |
|---|---|
| `README.md` | Project overview and navigation |
| `00_PROJECT_BRIEF.md` | Project identity, design principles, and high-level scope |
| `01_AGENT_RULES.md` | General implementation-agent rules |
| `02_TECHNICAL_ARCHITECTURE.md` | Technology stack and technical architecture |
| `XX_*_SPEC.md` | Domain behavior, ownership, and system contracts |
| `IMPLEMENTATION_STATUS.md` | Factual implementation and verification state |

A task-specific instruction may change the requested scope. It does not silently override architecture or system ownership.

If an instruction conflicts with an authoritative specification, identify the conflict before making an incompatible change.

Do not silently resolve architectural contradictions by choosing whichever document is most convenient.

---

## 3. First Action: Inspect the Repository

Never assume that the repository is empty or that a feature is missing.

Before implementation:

1. Inspect the repository structure.
2. Inspect `package.json` and lockfiles.
3. Identify the package manager and available scripts.
4. Inspect TypeScript and Vite configuration.
5. Identify the existing rendering and physics integration.
6. Inspect relevant source modules.
7. Inspect relevant tests.
8. Check the current implementation status.
9. Compare existing behavior with the applicable specifications.

Classify the requested work:

- Missing.
- Partially implemented.
- Implemented but not integrated.
- Integrated but insufficiently tested.
- Implemented with specification deviations.
- Complete and verified.

Do not recreate functionality that already exists.

Prefer extending or correcting existing implementations over creating parallel systems.

If the repository configuration is incomplete, report the exact blocker and implement only the safe, agreed foundation.

---

## 4. Architecture Rules

### 4.1. Single Ownership

Every system has one authoritative owner for its domain.

| Responsibility | Authoritative System |
|---|---|
| Locomotion physics | Movement |
| First-person presentation | Camera |
| Aggregated player lifecycle | Player State |
| Interaction detection and execution | Interaction |
| Checkpoint progress | Checkpoint |
| Recovery lifecycle | Respawn |
| Loaded level lifecycle and spawn resolution | Level Runtime |
| Gameplay session lifecycle | Gameplay Session |
| Application navigation | Gameplay Flow |
| Training exercises and evaluation | Training |
| Run timing and route validation | Speedrun |
| Content unlocks and milestones | Progression |
| Achievement definitions and unlock state | Achievement |
| Aggregated gameplay facts | Statistics |
| Persistence infrastructure | Save |
| Configuration and preference semantics | Settings |
| Translation resources and resolution | Localization |
| Accessibility policy coordination | Accessibility |
| Menu presentation | Menu |
| Gameplay HUD presentation | HUD |

Use public interfaces, commands, immutable snapshots, or events to communicate across system boundaries.

Do not access another system's internal mutable state directly.

### 4.2. No Duplicate State

Do not introduce multiple authoritative representations of the same state.

Prefer:

- Derived values.
- Immutable snapshots.
- Explicit state transitions.
- Domain-owned models.
- Session-scoped events.

Avoid unnecessary boolean flags that duplicate existing state machines.

### 4.3. Explicit Contracts

Public interfaces must define:

- Ownership.
- Inputs and outputs.
- Error behavior.
- Lifecycle behavior.
- Cancellation behavior.
- Event semantics.
- Session or attempt identity where applicable.

Do not introduce hidden coupling through global mutable state, undocumented shared objects, or arbitrary cross-system references.

### 4.4. Dependency Direction

Follow `docs/02_TECHNICAL_ARCHITECTURE.md`.

In general:

- Domain systems own gameplay rules.
- Runtime systems coordinate lifecycle.
- Infrastructure systems provide shared capabilities.
- Presentation systems consume state and provide feedback.

Do not introduce circular dependencies.

### 4.5. Technology Constraints

The initial technical stack is:

- TypeScript.
- Three.js.
- Three.js `WebGLRenderer`.
- Vite.
- Rapier through `@dimforge/rapier3d-compat`.
- Web Audio API.
- IndexedDB.
- HTML and CSS.
- GLSL where required.

WebGPU is a possible future extension, not part of the initial implementation.

Do not introduce a new engine, rendering framework, physics library, UI framework, or major dependency without checking the architecture and documenting the reason.

---

## 5. Gameplay Invariants

### 5.1. Movement First

Movement is the primary gameplay experience.

Mechanics must support fluid traversal, momentum management, and readable player control.

Do not add mandatory mechanics outside the initial scope without an explicit project decision.

### 5.2. Frame-Rate Independence

Gameplay simulation must not depend on rendering FPS.

Physics must use the fixed-timestep model defined by the Technical Architecture and Movement specifications.

Do not use frame counts as substitutes for elapsed time.

### 5.3. Physics and Rendering Separation

Three.js owns visual representation.

Rapier owns physical simulation and collision detection.

Do not use visual mesh transforms as an alternative authoritative physics state.

Do not pass variable render delta directly to Rapier as its simulation timestep.

### 5.4. Player State Separation

Do not combine unrelated state domains into one monolithic state machine.

Movement, player lifecycle, respawn, gameplay session, and application navigation remain separate authoritative domains.

### 5.5. Checkpoint and Respawn Separation

Checkpoint owns checkpoint progress and recovery destination information.

Respawn owns the recovery lifecycle.

`RespawnManager` is the canonical recovery orchestrator.

Do not implement a competing respawn lifecycle manager in Checkpoint or Level Runtime.

### 5.6. Speedrun Integrity

Speedrun timing uses a monotonic time source.

Rendering FPS must not affect recorded times.

Checkpoint order and route validity are owned by Speedrun.

HUD, Statistics, and Progression must not independently calculate or modify authoritative run results.

### 5.7. Session Isolation

Session-scoped operations must carry the correct session identity.

Attempt-scoped operations must reject stale events from previous attempts.

Cancelled, unloaded, or replaced sessions must not receive stale asynchronous results.

### 5.8. Persistence

IndexedDB is the initial local persistence foundation.

Use Save System interfaces instead of allowing arbitrary gameplay systems to create independent persistence layers.

Do not persist high-frequency gameplay data every frame.

The Save System owns the database (`GlasslineSaveData`), schema versioning, migrations, and repositories. Domain systems own the meaning and rules of their saved data. Do not introduce a second database or duplicate a domain rule inside persistence.

### 5.9. Cross-System Ownership Invariants

The following ownership boundaries are resolved and must not be re-litigated during implementation:

- **Respawn:** `RespawnManager` (`17_RESPAWN_SYSTEM_SPEC.md`) is the sole recovery orchestrator. Checkpoint provides the active checkpoint and respawn destination only. No `RespawnCoordinator` may be introduced.
- **Achievements and progression:** the Achievement System (`29_ACHIEVEMENT_SYSTEM_SPEC.md`) owns achievement definitions, evaluation, progress, unlock state, and achievement persistence. Progression (`22_PROGRESSION_SYSTEM_SPEC.md`) owns content unlocks and milestones and may consume achievement events. Progression must not maintain a duplicate achievement registry or unlock record.
- **Settings and localization:** the Settings System (`25_SETTINGS_SYSTEM_SPEC.md`) owns the selected language preference `general.language`. The Localization System (`27_LOCALIZATION_SYSTEM_SPEC.md`) owns language definitions, translation resources, resolution, formatting, and runtime language application. Localization must not persist a competing language preference.
- **Speedrun and statistics:** the Speedrun System (`09_SPEEDRUN_SYSTEM_SPEC.md`) owns timing, route validation, splits, results, and the run record contract. The Statistics System (`30_STATISTICS_SYSTEM_SPEC.md`) owns event-driven aggregation of gameplay facts. Speedrun consumes the finalized statistics summary; it must not run a second collector. Statistics must not own run timing, validation, or personal bests.
- **Presentation:** HUD (`23_HUD_SYSTEM_SPEC.md`) and Menu (`24_MENU_SYSTEM_SPEC.md`) present authoritative state and issue user commands. They must not calculate gameplay results or mutate gameplay, physics, session, run, checkpoint, or persistence state.
- **Level design:** level content (`06_LEVEL_DESIGN_SPEC.md`) authors geometry, triggers, spawn points, and gameplay metadata. Checkpoint activation, route validation, recovery, run timing, and progression remain with their owning systems.

If an implementation task appears to require violating one of these boundaries, stop and reconcile the specifications first. Do not duplicate ownership to make a feature easier.

---

## 6. Initial Release Scope

Prioritize the initial playable experience.

Required features include:

- First-person movement.
- Mouse and keyboard input.
- Core traversal mechanics.
- Collision and recovery.
- Training mode.
- Prologue mode.
- Five Prologue sections.
- Five required checkpoints.
- Speedrun timer and splits.
- Personal best records.
- Local leaderboard.
- IndexedDB persistence.
- Main Menu, Pause Menu, Settings, and Results.
- Gameplay HUD.
- Basic audio feedback.
- Initial accessibility support.
- English localization.
- Core tutorial guidance.

### Deferred Features

Do not implement these as part of the initial scope unless explicitly requested:

- Ghost Replay recording and playback.
- Online leaderboards.
- Cloud saves.
- Multiplayer.
- Online accounts.
- Advanced procedural campaigns.
- Ledge grabbing.
- Ledge climbing and hanging.
- Dedicated balance traversal.
- Swinging and ziplines.
- Advanced traversal variants outside the initial movement scope.
- Remote analytics.
- Full RTL layout.

Architectural extension points may be introduced when required by specifications, but deferred functionality must not become an unnecessary implementation dependency.

---

## 7. Implementation Workflow

Every task must follow this workflow.

### Step 1 — Understand

- Read relevant specifications.
- Inspect the existing implementation.
- Identify ownership boundaries.
- Identify dependencies and consumers.
- Understand expected behavior.
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
- Reuse established abstractions.
- Keep changes focused.
- Preserve public contracts unless a change is required.
- Handle errors explicitly.
- Handle cancellation and stale asynchronous results.
- Implement cleanup and lifecycle behavior.
- Avoid unnecessary dependencies.

Do not leave critical behavior as a placeholder.

### Step 4 — Verify

Run available and relevant commands:

- Type checking.
- Linting.
- Unit tests.
- Integration tests.
- Production build.
- Relevant browser/runtime checks.

Do not claim a command passed if it was not executed.

If verification cannot be performed, state why.

### Step 5 — Review

Before finishing:

- Check for duplicate functionality.
- Check system ownership.
- Check stale state and lifecycle bugs.
- Check resource cleanup.
- Check error handling.
- Check specification compliance.
- Check unrelated modifications.

### Step 6 — Update Documentation

Update `docs/IMPLEMENTATION_STATUS.md` when implementation status changes.

Update system specifications when intended behavior, ownership, or public contracts change.

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

Prioritize tests for:

- State transitions.
- Invalid operations.
- Boundary conditions.
- Repeated operations.
- Cancellation.
- Session and attempt isolation.
- Integration contracts.
- Persistence failures and recovery.

Test observable behavior and contracts rather than private implementation details.

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

If a missing decision affects public interfaces, system ownership, persistence format, or gameplay behavior, stop before committing to an incompatible design.

For minor and reversible implementation details, use the simplest solution consistent with the architecture.

Do not block progress for cosmetic decisions.

---

## 10. Change Management

### Scope Control

Only modify files necessary for the assigned task.

Avoid opportunistic refactoring.

If a related defect must be fixed, explain why it is necessary.

### Existing Code

Before removing or replacing existing code, identify:

- Its responsibilities.
- Its consumers.
- Its tests.
- Its lifecycle behavior.
- Its external contracts.

Do not replace a working implementation with a new abstraction without a clear reason.

### Breaking Changes

When changing public interfaces:

- Identify all consumers.
- Update affected implementations.
- Update tests.
- Update related specifications.
- Update integration status.

Never leave the project with partially migrated interfaces.

### Dependencies

Before adding a dependency:

- Check whether existing tools already solve the problem.
- Check runtime compatibility.
- Consider bundle size and maintenance.
- Explain why the dependency is necessary.

---

## 11. Definition of Done

A task is complete only when all applicable conditions are satisfied.

- [ ] Requested functionality is implemented.
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

A task may be reported as partially complete when some conditions cannot be met. Remaining work must be explicit.

---

## 12. Required Completion Report

At the end of every implementation task, provide:

### Summary

What was implemented.

### Files Changed

Created, modified, and deleted files.

### Implementation Details

Important architectural and behavioral decisions.

### Verification

Commands executed and their actual results.

### Tests

Added or updated tests.

### Specification Compliance

Whether the implementation follows the relevant specifications. Record deviations and assumptions.

### Remaining Work

Incomplete requirements, known issues, and blockers.

### Implementation Status

Use one of:

- Not Started
- In Progress
- Implemented
- Integrated
- Verified
- Blocked
- Deferred

Do not report `Verified` without successful verification evidence.

### Recommended Next Task

One logical next implementation step.

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