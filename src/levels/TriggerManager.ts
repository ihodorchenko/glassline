import type {
  LevelTriggerDefinition,
  LevelTriggerMetadata,
  LevelTriggerType,
  LevelVector3,
} from "./LevelTypes";

export interface RuntimeTriggerDefinition extends LevelTriggerDefinition {
  readonly enabled: boolean;
  readonly repeatable: boolean;
}

export interface TriggerEvent {
  readonly triggerId: string;
  readonly sectionId: string;
  readonly type: LevelTriggerType;
  readonly actorId: string;
  readonly timestamp: number;
  readonly eventType: "enter" | "exit";
  readonly metadata?: LevelTriggerMetadata;
}

function contains(trigger: RuntimeTriggerDefinition, position: LevelVector3): boolean {
  return (
    Math.abs(position.x - trigger.center.x) <= trigger.halfExtents.x &&
    Math.abs(position.y - trigger.center.y) <= trigger.halfExtents.y &&
    Math.abs(position.z - trigger.center.z) <= trigger.halfExtents.z
  );
}

function insideKey(triggerId: string, actorId: string): string {
  return `${triggerId}::${actorId}`;
}

/**
 * Owns runtime trigger registration, enablement, and enter/exit detection
 * (`docs/15` §10). Trigger meaning belongs to the consuming systems.
 */
export class TriggerManager {
  private readonly triggers = new Map<string, RuntimeTriggerDefinition>();
  private readonly inside = new Set<string>();
  private readonly consumed = new Set<string>();
  private readonly pendingEvents: TriggerEvent[] = [];
  private lastTimestamp = 0;

  register(trigger: LevelTriggerDefinition): void {
    if (this.triggers.has(trigger.id)) {
      throw new Error(`Trigger "${trigger.id}" is already registered.`);
    }

    this.triggers.set(trigger.id, {
      ...trigger,
      enabled: trigger.enabled ?? true,
      repeatable: trigger.repeatable ?? true,
    });
  }

  unregister(triggerId: string): void {
    this.triggers.delete(triggerId);

    for (const key of [...this.inside]) {
      if (key.startsWith(`${triggerId}::`)) {
        this.inside.delete(key);
      }
    }
  }

  get(triggerId: string): RuntimeTriggerDefinition | null {
    return this.triggers.get(triggerId) ?? null;
  }

  setEnabled(triggerId: string, enabled: boolean): void {
    const trigger = this.triggers.get(triggerId);

    if (!trigger || trigger.enabled === enabled) {
      return;
    }

    this.triggers.set(triggerId, { ...trigger, enabled });

    if (!enabled) {
      this.releaseActorState(triggerId, (actorId) =>
        this.publishExit(trigger, actorId, this.lastTimestamp),
      );
    }
  }

  enable(triggerId: string): void {
    this.setEnabled(triggerId, true);
  }

  disable(triggerId: string): void {
    this.setEnabled(triggerId, false);
  }

  enableSection(sectionId: string): void {
    for (const trigger of this.triggers.values()) {
      if (trigger.sectionId === sectionId) {
        this.setEnabled(trigger.id, true);
      }
    }
  }

  disableSection(sectionId: string): void {
    for (const trigger of this.triggers.values()) {
      if (trigger.sectionId === sectionId) {
        this.setEnabled(trigger.id, false);
      }
    }
  }

  /** Evaluates active triggers for one actor. Returns enter/exit events. */
  update(actorPosition: LevelVector3, actorId: string, timestamp: number): TriggerEvent[] {
    this.lastTimestamp = timestamp;

    const events: TriggerEvent[] = [...this.pendingEvents];

    this.pendingEvents.length = 0;

    for (const trigger of this.triggers.values()) {
      if (!trigger.enabled) {
        continue;
      }

      const key = insideKey(trigger.id, actorId);
      const wasInside = this.inside.has(key);
      const isInside = contains(trigger, actorPosition);

      if (wasInside && !isInside) {
        this.inside.delete(key);

        const exit = this.createEvent(trigger, actorId, timestamp, "exit");

        events.push(exit);
        continue;
      }

      if (wasInside || !isInside) {
        continue;
      }

      const consumedKey = `${trigger.id}::${actorId}`;

      if (!trigger.repeatable && this.consumed.has(consumedKey)) {
        continue;
      }

      this.inside.add(key);

      if (!trigger.repeatable) {
        this.consumed.add(consumedKey);
      }

      events.push(this.createEvent(trigger, actorId, timestamp, "enter"));
    }

    return events;
  }

  getActiveCount(): number {
    let count = 0;

    for (const trigger of this.triggers.values()) {
      if (trigger.enabled) {
        count += 1;
      }
    }

    return count;
  }

  getCount(): number {
    return this.triggers.size;
  }

  getInsideCount(): number {
    return this.inside.size;
  }

  getAll(): readonly RuntimeTriggerDefinition[] {
    return [...this.triggers.values()];
  }

  clear(): void {
    this.triggers.clear();
    this.inside.clear();
    this.consumed.clear();
    this.pendingEvents.length = 0;
  }

  private releaseActorState(triggerId: string, onActor: (actorId: string) => void): void {
    for (const key of [...this.inside]) {
      if (!key.startsWith(`${triggerId}::`)) {
        continue;
      }

      this.inside.delete(key);
      onActor(key.slice(triggerId.length + 2));
    }
  }

  private createEvent(
    trigger: RuntimeTriggerDefinition,
    actorId: string,
    timestamp: number,
    eventType: "enter" | "exit",
  ): TriggerEvent {
    return {
      triggerId: trigger.id,
      sectionId: trigger.sectionId,
      type: trigger.type,
      actorId,
      timestamp,
      eventType,
      ...(trigger.metadata === undefined ? {} : { metadata: trigger.metadata }),
    };
  }

  private publishExit(trigger: RuntimeTriggerDefinition, actorId: string, timestamp: number): void {
    this.pendingEvents.push(this.createEvent(trigger, actorId, timestamp, "exit"));
  }
}
