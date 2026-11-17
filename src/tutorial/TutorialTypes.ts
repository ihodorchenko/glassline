export interface TutorialStepDefinition {
  readonly id: string;
  readonly titleKey: string;
  readonly hintKey: string;
  readonly source: string;
  readonly eventType: string;
  readonly payloadMatch?: Readonly<Record<string, string>>;
}

export interface TutorialProgress {
  readonly completedStepIds: readonly string[];
  readonly completedAt?: number;
  readonly updatedAt: number;
}

export interface TutorialSnapshot {
  readonly completedStepIds: readonly string[];
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly completed: boolean;
  readonly completedAt?: number;
  readonly nextStep: TutorialStepDefinition | null;
}

export interface PersistedTutorial {
  readonly schemaVersion: number;
  readonly progress: TutorialProgress | null;
  readonly processedEventIds: readonly string[];
  readonly updatedAt: number;
}

export interface TutorialPersistence {
  load(): Promise<PersistedTutorial | null>;
  save(data: PersistedTutorial): Promise<void>;
}

export interface TutorialSystemOptions {
  readonly steps: readonly TutorialStepDefinition[];
  readonly clock?: () => number;
  readonly persistence?: TutorialPersistence | null;
}

export interface TutorialEvent {
  readonly type: "step:completed" | "tutorial:completed";
  readonly stepId?: string;
  readonly completedAt: number;
}

export type TutorialListener = (event: TutorialEvent) => void;
