export type EventPayloadMap = Record<string, unknown>;

export type EventListener<T> = (payload: T) => void;

export type Unsubscribe = () => void;

interface Subscription {
  readonly listener: (payload: never) => void;
  readonly once: boolean;
}

/**
 * Typed event bus for notifications with multiple independent consumers.
 * Direct interfaces remain preferred for stable, explicit dependencies.
 */
export class EventBus<Events extends EventPayloadMap> {
  private readonly subscriptions = new Map<keyof Events, Subscription[]>();

  on<K extends keyof Events>(type: K, listener: EventListener<Events[K]>): Unsubscribe {
    return this.add(type, listener, false);
  }

  once<K extends keyof Events>(type: K, listener: EventListener<Events[K]>): Unsubscribe {
    return this.add(type, listener, true);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const subscriptions = this.subscriptions.get(type);

    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    // Copy so listeners may unsubscribe safely while the event is dispatched.
    for (const subscription of [...subscriptions]) {
      if (subscription.once) {
        this.removeSubscription(type, subscription);
      }

      (subscription.listener as EventListener<Events[K]>)(payload);
    }
  }

  listenerCount(type?: keyof Events): number {
    if (type !== undefined) {
      return this.subscriptions.get(type)?.length ?? 0;
    }

    let count = 0;

    for (const subscriptions of this.subscriptions.values()) {
      count += subscriptions.length;
    }

    return count;
  }

  clear(): void {
    this.subscriptions.clear();
  }

  private add<K extends keyof Events>(
    type: K,
    listener: EventListener<Events[K]>,
    once: boolean,
  ): Unsubscribe {
    const subscriptions = this.subscriptions.get(type) ?? [];
    const subscription: Subscription = { listener, once };

    subscriptions.push(subscription);
    this.subscriptions.set(type, subscriptions);

    return () => this.removeSubscription(type, subscription);
  }

  private removeSubscription<K extends keyof Events>(type: K, subscription: Subscription): void {
    const subscriptions = this.subscriptions.get(type);

    if (!subscriptions) {
      return;
    }

    const index = subscriptions.indexOf(subscription);

    if (index >= 0) {
      subscriptions.splice(index, 1);
    }

    if (subscriptions.length === 0) {
      this.subscriptions.delete(type);
    }
  }
}
