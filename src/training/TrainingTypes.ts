import type { Vector3Like } from "../shared/math";

export type TrainingMechanic =
  | "movement"
  | "running"
  | "sprinting"
  | "jumping"
  | "crouching"
  | "sliding"
  | "vaulting"
  | "wall_running"
  | "wall_jumping"
  | "landing"
  | "interaction"
  | "combined_traversal";

export type TrainingAction =
  | "jump"
  | "slide_started"
  | "slide_ended"
  | "vault_started"
  | "wallrun_started"
  | "wallrun_ended"
  | "walljumped"
  | "landed";

export type TrainingObjectiveType =
  | "perform_action"
  | "perform_action_count"
  | "maintain_speed"
  | "reach_location"
  | "interact_with_target";

export interface TrainingObjectiveDefinition {
  readonly id: string;
  readonly description: string;
  readonly type: TrainingObjectiveType;
  readonly required: boolean;
  readonly action?: TrainingAction;
  readonly targetCount?: number;
  readonly targetSpeed?: number;
  readonly targetDurationSeconds?: number;
  readonly position?: Vector3Like;
  readonly radius?: number;
  readonly targetId?: string;
}

export interface TrainingExerciseDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly mechanic: TrainingMechanic;
  readonly objectives: readonly TrainingObjectiveDefinition[];
  readonly estimatedDurationSeconds?: number;
}

export type TrainingGameplayEvent =
  | {
      readonly type: "action";
      readonly action: TrainingAction;
      readonly timestamp: number;
    }
  | {
      readonly type: "interaction";
      readonly targetId: string;
      readonly timestamp: number;
    };

export interface TrainingObjectiveProgress {
  readonly objectiveId: string;
  readonly currentValue: number;
  readonly targetValue: number;
  readonly completed: boolean;
  readonly startedAt?: number;
  readonly completedAt?: number;
}

export type TrainingExerciseStatus = "pending" | "active" | "completed" | "failed";

export interface TrainingExerciseRuntime {
  readonly definition: TrainingExerciseDefinition;
  readonly status: TrainingExerciseStatus;
  readonly attempts: number;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly currentObjectiveIndex: number;
  readonly objectives: readonly TrainingObjectiveProgress[];
}

export type TrainingSessionStatus = "idle" | "running" | "completed" | "abandoned";

export interface TrainingExerciseResult {
  readonly exerciseId: string;
  readonly title: string;
  readonly completed: boolean;
  readonly attempts: number;
  readonly durationMs: number;
}

export interface TrainingSessionResult {
  readonly sessionId: string;
  readonly completed: boolean;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly exercises: readonly TrainingExerciseResult[];
}

export interface TrainingSnapshot {
  readonly sessionId: string | null;
  readonly status: TrainingSessionStatus;
  readonly exerciseIndex: number;
  readonly exerciseCount: number;
  readonly currentExercise: TrainingExerciseRuntime | null;
  readonly currentObjective: TrainingObjectiveProgress | null;
  readonly completedExercises: number;
  readonly result: TrainingSessionResult | null;
}

export type TrainingEvent =
  | { readonly type: "exercise:started"; readonly exerciseId: string; readonly attempt: number }
  | {
      readonly type: "objective:completed";
      readonly exerciseId: string;
      readonly objectiveId: string;
    }
  | { readonly type: "exercise:completed"; readonly exerciseId: string }
  | { readonly type: "session:completed"; readonly result: TrainingSessionResult }
  | { readonly type: "session:abandoned" };

export type TrainingListener = (event: TrainingEvent) => void;
