import type { Disposable } from "../core/Disposable";
import type { DomainEvent } from "../events/DomainEvent";
import type {
  PersistedTutorial,
  TutorialEvent,
  TutorialListener,
  TutorialPersistence,
  TutorialProgress,
  TutorialSnapshot,
  TutorialStepDefinition,
  TutorialSystemOptions,
} from "./TutorialTypes";

const SCHEMA_VERSION = 1;
const MAX_PROCESSED_EVENT_IDS = 300;

function matchesStep(step: TutorialStepDefinition, event: DomainEvent): boolean {
  if (step.source !== event.source || step.eventType !== event.type) {
    return false;
  }

  if (!step.payloadMatch) {
    return true;
  }

  for (const [key, expected] of Object.entries(step.payloadMatch)) {
    if (event.payload?.[key] !== expected) {
      return false;
    }
  }

  return true;
}

/**
 * Tracks first-time tutorial progression from authoritative gameplay events
 * (`docs/28`). It does not own hints presentation or gameplay logic.
 */
export class TutorialSystem implements Disposable {
  private readonly steps: readonly TutorialStepDefinition[];
  private readonly clock: () => number;
  private readonly persistence: TutorialPersistence | null;
  private readonly listeners = new Set<TutorialListener>();
  private readonly processedEventIds = new Set<string>();
  private readonly completedStepIds = new Set<string>();

  private completedAt: number | null = null;
  private updatedAt = 0;
  private saveChain: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(options: TutorialSystemOptions) {
    this.steps = [...options.steps];
    this.clock = options.clock ?? (() => Date.now());
    this.persistence = options.persistence ?? null;

    const ids = new Set<string>();

    for (const step of this.steps) {
      if (ids.has(step.id)) {
        throw new Error(`Duplicate tutorial step id "${step.id}".`);
      }

      ids.add(step.id);
    }
  }

  async initialize(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    try {
      const loaded = await this.persistence.load();

      if (!loaded) {
        return;
      }

      for (const stepId of loaded.progress?.completedStepIds ?? []) {
        if (this.steps.some((step) => step.id === stepId)) {
          this.completedStepIds.add(stepId);
        }
      }

      this.completedAt = loaded.progress?.completedAt ?? null;
      this.updatedAt = loaded.progress?.updatedAt ?? 0;

      for (const eventId of loaded.processedEventIds) {
        this.processedEventIds.add(eventId);
      }
    } catch (error) {
      console.warn("[Glassline] Tutorial progress could not be restored.", error);
    }
  }

  getSnapshot(): TutorialSnapshot {
    const nextStep = this.steps.find((step) => !this.completedStepIds.has(step.id)) ?? null;
    const completed = nextStep === null && this.steps.length > 0;

    return {
      completedStepIds: [...this.completedStepIds],
      completedSteps: this.completedStepIds.size,
      totalSteps: this.steps.length,
      completed,
      ...(this.completedAt === null ? {} : { completedAt: this.completedAt }),
      nextStep,
    };
  }

  subscribe(listener: TutorialListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  recordEvent(event: DomainEvent): boolean {
    if (this.disposed || this.processedEventIds.has(event.eventId)) {
      return false;
    }

    if (this.getSnapshot().completed) {
      return false;
    }

    this.processedEventIds.add(event.eventId);
    this.trimProcessedEventIds();

    const step = this.steps.find(
      (candidate) => !this.completedStepIds.has(candidate.id) && matchesStep(candidate, event),
    );

    if (!step) {
      return false;
    }

    this.completedStepIds.add(step.id);
    this.updatedAt = this.clock();
    this.emit({ type: "step:completed", stepId: step.id, completedAt: this.updatedAt });

    if (this.getSnapshot().completed) {
      this.completedAt = this.updatedAt;
      this.emit({ type: "tutorial:completed", completedAt: this.completedAt });
    }

    this.schedulePersistence();

    return true;
  }

  async flushPersistence(): Promise<void> {
    await this.saveChain;
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  private schedulePersistence(): void {
    if (!this.persistence) {
      return;
    }

    const progress: TutorialProgress = {
      completedStepIds: [...this.completedStepIds],
      ...(this.completedAt === null ? {} : { completedAt: this.completedAt }),
      updatedAt: this.updatedAt,
    };
    const payload: PersistedTutorial = {
      schemaVersion: SCHEMA_VERSION,
      progress,
      processedEventIds: [...this.processedEventIds].slice(-MAX_PROCESSED_EVENT_IDS),
      updatedAt: this.updatedAt,
    };

    this.saveChain = this.saveChain
      .then(() => this.persistence?.save(payload))
      .catch((error: unknown) => {
        console.warn("[Glassline] Tutorial persistence failed.", error);
      });
  }

  private trimProcessedEventIds(): void {
    if (this.processedEventIds.size <= MAX_PROCESSED_EVENT_IDS * 2) {
      return;
    }

    const kept = [...this.processedEventIds].slice(-MAX_PROCESSED_EVENT_IDS);

    this.processedEventIds.clear();

    for (const eventId of kept) {
      this.processedEventIds.add(eventId);
    }
  }

  private emit(event: TutorialEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error("[Glassline] A tutorial listener failed.", error);
      }
    }
  }
}
