import { EventBus, type Unsubscribe } from "../core/EventBus";
import type { Vector3Like } from "../shared/math";
import type {
  TrainingEvent,
  TrainingExerciseDefinition,
  TrainingExerciseRuntime,
  TrainingGameplayEvent,
  TrainingListener,
  TrainingObjectiveDefinition,
  TrainingObjectiveProgress,
  TrainingSessionResult,
  TrainingSessionStatus,
  TrainingSnapshot,
} from "./TrainingTypes";

export interface TrainingPlayerSample {
  readonly position: Vector3Like;
  readonly speed: number;
}

export type TrainingClock = () => number;

interface ObjectiveTracking {
  maintainSinceMs: number | null;
}

interface ExerciseInternal {
  definition: TrainingExerciseDefinition;
  status: TrainingExerciseRuntime["status"];
  attempts: number;
  startedAt?: number;
  completedAt?: number;
  currentObjectiveIndex: number;
  objectives: TrainingObjectiveProgress[];
  startedEventTimestamp?: number;
}

export interface TrainingSystemOptions {
  readonly clock?: TrainingClock;
}

/**
 * Owns Training exercise definitions, session-scoped exercise progress,
 * objective evaluation, and completion (`docs/21`).
 *
 * Objective evaluation consumes authoritative gameplay events and Movement
 * metrics; it does not implement its own movement physics.
 */
export class TrainingSystem {
  private readonly definitions: readonly TrainingExerciseDefinition[];
  private readonly clock: TrainingClock;
  private readonly events = new EventBus<TrainingEventMap>();

  private sessionId: string | null = null;
  private status: TrainingSessionStatus = "idle";
  private startedAt = 0;
  private completedAt = 0;
  private exercises: ExerciseInternal[] = [];
  private exerciseIndex = 0;
  private result: TrainingSessionResult | null = null;
  private readonly objectiveTracking = new Map<string, ObjectiveTracking>();

  constructor(
    definitions: readonly TrainingExerciseDefinition[],
    options: TrainingSystemOptions = {},
  ) {
    this.definitions = [...definitions];
    this.clock = options.clock ?? (() => performance.now());

    const ids = new Set<string>();

    for (const definition of this.definitions) {
      if (ids.has(definition.id)) {
        throw new Error(`Duplicate training exercise id "${definition.id}".`);
      }

      ids.add(definition.id);

      if (definition.objectives.length === 0) {
        throw new Error(`Training exercise "${definition.id}" has no objectives.`);
      }
    }
  }

  getDefinitions(): readonly TrainingExerciseDefinition[] {
    return this.definitions;
  }

  getStatus(): TrainingSessionStatus {
    return this.status;
  }

  getSnapshot(): TrainingSnapshot {
    const current = this.exercises[this.exerciseIndex] ?? null;
    const objective = current ? (current.objectives[current.currentObjectiveIndex] ?? null) : null;

    return {
      sessionId: this.sessionId,
      status: this.status,
      exerciseIndex: this.exerciseIndex,
      exerciseCount: this.exercises.length,
      currentExercise: current ? this.toRuntime(current) : null,
      currentObjective: objective,
      completedExercises: this.exercises.filter((exercise) => exercise.status === "completed")
        .length,
      result: this.result,
    };
  }

  startSession(sessionId: string): void {
    if (this.status === "running") {
      throw new Error("Training session is already running.");
    }

    if (this.definitions.length === 0) {
      throw new Error("Training requires at least one exercise definition.");
    }

    this.sessionId = sessionId;
    this.status = "running";
    this.startedAt = this.clock();
    this.completedAt = 0;
    this.result = null;
    this.exerciseIndex = 0;
    this.objectiveTracking.clear();
    this.exercises = this.definitions.map((definition) => this.createExercise(definition));

    this.activateExercise(0);
  }

  /** Evaluates time-based objectives (speed maintenance and location zones). */
  update(player: TrainingPlayerSample, timestampMs: number): void {
    if (this.status !== "running") {
      return;
    }

    const exercise = this.exercises[this.exerciseIndex];

    if (exercise?.status !== "active") {
      return;
    }

    const objective = exercise.objectives[exercise.currentObjectiveIndex];

    if (!objective) {
      return;
    }

    const definition = exercise.definition.objectives[exercise.currentObjectiveIndex];

    if (!definition) {
      return;
    }

    if (definition.type === "maintain_speed") {
      this.evaluateMaintainSpeed(exercise, definition, objective, player.speed, timestampMs);
    } else if (definition.type === "reach_location" && definition.position) {
      this.evaluateReachLocation(objective, definition, player.position, timestampMs);
    }
  }

  /** Consumes authoritative gameplay events. */
  handleEvent(event: TrainingGameplayEvent): void {
    if (this.status !== "running") {
      return;
    }

    const exercise = this.exercises[this.exerciseIndex];

    if (exercise?.status !== "active") {
      return;
    }

    const definition = exercise.definition.objectives[exercise.currentObjectiveIndex];
    const objective = exercise.objectives[exercise.currentObjectiveIndex];

    if (!definition || !objective) {
      return;
    }

    if (event.type === "action") {
      if (definition.type !== "perform_action" && definition.type !== "perform_action_count") {
        return;
      }

      if (definition.action !== event.action) {
        return;
      }

      const target = definition.targetCount ?? 1;
      const nextValue = Math.min(target, objective.currentValue + 1);

      this.updateObjectiveProgress(exercise, objective, nextValue, event.timestamp, target);
    } else if (
      definition.type === "interact_with_target" &&
      definition.targetId === event.targetId
    ) {
      this.updateObjectiveProgress(exercise, objective, 1, event.timestamp, 1);
    }
  }

  /** Restarts the current exercise, preserving session identity. */
  restartCurrentExercise(timestampMs = this.clock()): void {
    if (this.status !== "running") {
      return;
    }

    const exercise = this.exercises[this.exerciseIndex];

    if (!exercise) {
      return;
    }

    this.activateExercise(this.exerciseIndex, timestampMs, true);
  }

  restartSession(timestampMs = this.clock()): void {
    if (!this.sessionId) {
      return;
    }

    this.status = "idle";
    this.startSession(this.sessionId);
    this.startedAt = timestampMs;
  }

  abandon(): void {
    if (this.status !== "running") {
      return;
    }

    this.status = "abandoned";
    this.emit({ type: "session:abandoned" });
  }

  subscribe(listener: TrainingListener): Unsubscribe {
    return this.events.on("training", listener);
  }

  dispose(): void {
    this.events.clear();
    this.objectiveTracking.clear();
  }

  private createExercise(definition: TrainingExerciseDefinition): ExerciseInternal {
    return {
      definition,
      status: "pending",
      attempts: 0,
      currentObjectiveIndex: 0,
      objectives: definition.objectives.map((objective) => ({
        objectiveId: objective.id,
        currentValue: 0,
        targetValue: this.targetValueFor(objective),
        completed: false,
      })),
    };
  }

  private activateExercise(index: number, timestampMs = this.clock(), restart = false): void {
    const exercise = this.exercises[index];

    if (!exercise) {
      return;
    }

    void restart;
    this.exerciseIndex = index;
    exercise.status = "active";
    exercise.attempts += 1;
    exercise.startedAt = timestampMs;
    exercise.startedEventTimestamp = timestampMs;
    exercise.currentObjectiveIndex = 0;
    exercise.objectives = exercise.definition.objectives.map((objective) => ({
      objectiveId: objective.id,
      currentValue: 0,
      targetValue: this.targetValueFor(objective),
      completed: false,
    }));
    this.objectiveTracking.clear();
    this.emit({
      type: "exercise:started",
      exerciseId: exercise.definition.id,
      attempt: exercise.attempts,
    });
  }

  private targetValueFor(objective: TrainingObjectiveDefinition): number {
    if (objective.type === "perform_action_count") {
      return objective.targetCount ?? 1;
    }

    if (objective.type === "maintain_speed") {
      return objective.targetDurationSeconds ?? 1;
    }

    return 1;
  }

  private evaluateMaintainSpeed(
    exercise: ExerciseInternal,
    definition: TrainingObjectiveDefinition,
    objective: TrainingObjectiveProgress,
    speed: number,
    timestampMs: number,
  ): void {
    const tracking = this.objectiveTracking.get(objective.objectiveId) ?? { maintainSinceMs: null };
    const requiredSpeed = definition.targetSpeed ?? 0;
    const requiredSeconds = definition.targetDurationSeconds ?? 1;
    const requiredMs = requiredSeconds * 1000;

    if (speed >= requiredSpeed) {
      if (tracking.maintainSinceMs === null) {
        tracking.maintainSinceMs = timestampMs;
      }

      const maintainedMs = timestampMs - tracking.maintainSinceMs;
      const nextValue = Number((maintainedMs / 1000).toFixed(2));

      this.objectiveTracking.set(objective.objectiveId, tracking);

      if (maintainedMs >= requiredMs) {
        this.completeObjective(exercise, objective, timestampMs, requiredSeconds);
      } else if (nextValue !== objective.currentValue) {
        this.replaceObjective(exercise, objective.objectiveId, {
          ...objective,
          currentValue: nextValue,
          targetValue: requiredSeconds,
        });
      }
    } else {
      tracking.maintainSinceMs = null;
      this.objectiveTracking.set(objective.objectiveId, tracking);

      if (objective.currentValue !== 0) {
        this.replaceObjective(exercise, objective.objectiveId, {
          ...objective,
          currentValue: 0,
        });
      }
    }
  }

  private evaluateReachLocation(
    objective: TrainingObjectiveProgress,
    definition: TrainingObjectiveDefinition,
    position: Vector3Like,
    timestampMs: number,
  ): void {
    const target = definition.position;

    if (!target) {
      return;
    }

    const distance = Math.hypot(
      position.x - target.x,
      position.y - target.y,
      position.z - target.z,
    );

    if (distance <= (definition.radius ?? 1)) {
      const exercise = this.exercises[this.exerciseIndex];

      if (exercise) {
        this.completeObjective(exercise, objective, timestampMs, 1);
      }
    }
  }

  private updateObjectiveProgress(
    exercise: ExerciseInternal,
    objective: TrainingObjectiveProgress,
    value: number,
    timestampMs: number,
    target: number,
  ): void {
    if (value >= target) {
      this.completeObjective(exercise, objective, timestampMs, target);

      return;
    }

    this.replaceObjective(exercise, objective.objectiveId, {
      ...objective,
      currentValue: value,
      targetValue: target,
    });
  }

  private replaceObjective(
    exercise: ExerciseInternal,
    objectiveId: string,
    next: TrainingObjectiveProgress,
  ): void {
    const index = exercise.objectives.findIndex(
      (candidate) => candidate.objectiveId === objectiveId,
    );

    if (index >= 0) {
      exercise.objectives[index] = next;
    }
  }

  private completeObjective(
    exercise: ExerciseInternal,
    objective: TrainingObjectiveProgress,
    timestampMs: number,
    target: number,
  ): void {
    const index = exercise.objectives.findIndex(
      (candidate) => candidate.objectiveId === objective.objectiveId,
    );

    exercise.objectives[index] = {
      ...objective,
      currentValue: target,
      targetValue: target,
      completed: true,
      completedAt: timestampMs,
    };

    this.emit({
      type: "objective:completed",
      exerciseId: exercise.definition.id,
      objectiveId: objective.objectiveId,
    });

    exercise.currentObjectiveIndex += 1;

    if (exercise.currentObjectiveIndex >= exercise.definition.objectives.length) {
      this.completeExercise(exercise, timestampMs);
    }
  }

  private completeExercise(exercise: ExerciseInternal, timestampMs: number): void {
    exercise.status = "completed";
    exercise.completedAt = timestampMs;
    this.emit({ type: "exercise:completed", exerciseId: exercise.definition.id });

    if (this.exerciseIndex + 1 >= this.exercises.length) {
      this.completeSession(timestampMs);

      return;
    }

    this.activateExercise(this.exerciseIndex + 1, timestampMs);
  }

  private completeSession(timestampMs: number): void {
    this.status = "completed";
    this.completedAt = timestampMs;

    const result: TrainingSessionResult = {
      sessionId: this.sessionId ?? "unknown",
      completed: true,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      exercises: this.exercises.map((exercise) => ({
        exerciseId: exercise.definition.id,
        title: exercise.definition.title,
        completed: exercise.status === "completed",
        attempts: exercise.attempts,
        durationMs: Math.max(0, (exercise.completedAt ?? 0) - (exercise.startedAt ?? 0)),
      })),
    };

    this.result = result;
    this.emit({ type: "session:completed", result });
  }

  private toRuntime(exercise: ExerciseInternal): TrainingExerciseRuntime {
    return {
      definition: exercise.definition,
      status: exercise.status,
      attempts: exercise.attempts,
      ...(exercise.startedAt === undefined ? {} : { startedAt: exercise.startedAt }),
      ...(exercise.completedAt === undefined ? {} : { completedAt: exercise.completedAt }),
      currentObjectiveIndex: exercise.currentObjectiveIndex,
      objectives: [...exercise.objectives],
    };
  }

  private emit(event: TrainingEvent): void {
    this.events.emit("training", event);
  }
}

export interface TrainingEventMap {
  [key: string]: unknown;
  training: TrainingEvent;
}

export type { TrainingListener };
