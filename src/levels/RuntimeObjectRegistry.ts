export type RuntimeObjectType =
  | "interactable"
  | "checkpoint"
  | "spawn-point"
  | "trigger"
  | "movement-surface"
  | "environment"
  | "generic";

export interface RuntimeObjectContext {
  readonly sessionId: string;
  readonly levelId: string;
  readonly sectionId: string;
}

/** A level-scoped runtime object with explicit lifecycle (`docs/15` §13). */
export interface ILevelRuntimeObject {
  readonly id: string;
  readonly sectionId: string;
  readonly objectType: RuntimeObjectType;
  initialize?(context: RuntimeObjectContext): void | Promise<void>;
  activate(): void;
  deactivate(): void;
  dispose(): void;
}

export interface RuntimeObjectRegistrationFailure {
  readonly objectId: string;
  readonly error: unknown;
}

/**
 * Central registration and lookup for level-session runtime objects.
 *
 * It tracks ownership and lifecycle only; gameplay state stays with the owning
 * systems (`docs/15` §13.1).
 */
export class RuntimeObjectRegistry {
  private readonly objects = new Map<string, ILevelRuntimeObject>();

  register(object: ILevelRuntimeObject): void {
    if (this.objects.has(object.id)) {
      throw new Error(`Runtime object "${object.id}" is already registered.`);
    }

    this.objects.set(object.id, object);
  }

  unregister(objectId: string): void {
    this.objects.delete(objectId);
  }

  get(objectId: string): ILevelRuntimeObject | null {
    return this.objects.get(objectId) ?? null;
  }

  getBySection(sectionId: string): ILevelRuntimeObject[] {
    return [...this.objects.values()].filter((object) => object.sectionId === sectionId);
  }

  getByType(objectType: RuntimeObjectType): ILevelRuntimeObject[] {
    return [...this.objects.values()].filter((object) => object.objectType === objectType);
  }

  activateSection(sectionId: string): RuntimeObjectRegistrationFailure[] {
    return this.applyToSection(sectionId, (object) => object.activate(), "activate");
  }

  deactivateSection(sectionId: string): RuntimeObjectRegistrationFailure[] {
    return this.applyToSection(sectionId, (object) => object.deactivate(), "deactivate");
  }

  /** Disposes all registered objects, aggregating failures instead of stopping cleanup. */
  disposeAll(): RuntimeObjectRegistrationFailure[] {
    const failures: RuntimeObjectRegistrationFailure[] = [];

    for (const object of [...this.objects.values()]) {
      try {
        object.dispose();
      } catch (error) {
        failures.push({ objectId: object.id, error });
      }
    }

    this.objects.clear();

    return failures;
  }

  getCount(): number {
    return this.objects.size;
  }

  clear(): void {
    this.objects.clear();
  }

  private applyToSection(
    sectionId: string,
    action: (object: ILevelRuntimeObject) => void,
    label: string,
  ): RuntimeObjectRegistrationFailure[] {
    const failures: RuntimeObjectRegistrationFailure[] = [];

    for (const object of this.objects.values()) {
      if (object.sectionId !== sectionId) {
        continue;
      }

      try {
        action(object);
      } catch (error) {
        failures.push({ objectId: `${object.id}:${label}`, error });
      }
    }

    return failures;
  }
}
