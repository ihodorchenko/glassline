/**
 * Normalized domain event envelope shared by long-term systems.
 *
 * Event identity is stable so consumers can deduplicate repeated delivery.
 * Timestamps are wall-clock metadata; authoritative durations stay with their
 * owning systems (`docs/30` §8).
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly type: string;
  readonly source: string;
  readonly timestamp: number;
  readonly sessionId?: string;
  readonly mode?: "training" | "prologue" | "speedrun";
  readonly payload?: Readonly<Record<string, unknown>>;
}

export type DomainEventPayload = Readonly<Record<string, unknown>>;

let eventSequence = 0;

export function createDomainEvent(
  source: string,
  type: string,
  options: {
    readonly sessionId?: string;
    readonly mode?: DomainEvent["mode"];
    readonly timestamp?: number;
    readonly payload?: DomainEventPayload;
    readonly eventId?: string;
  } = {},
): DomainEvent {
  eventSequence += 1;

  return {
    eventId: options.eventId ?? `${source}:${type}:${eventSequence}`,
    type,
    source,
    timestamp: options.timestamp ?? Date.now(),
    ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.payload === undefined ? {} : { payload: options.payload }),
  };
}

export function readPayloadNumber(event: DomainEvent, key = "value"): number | null {
  const value = event.payload?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readPayloadString(event: DomainEvent, key: string): string | null {
  const value = event.payload?.[key];

  return typeof value === "string" ? value : null;
}
