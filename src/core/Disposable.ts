/** A resource with an explicit lifecycle. */
export interface Disposable {
  dispose(): void;
}

/**
 * Disposes resources in reverse creation order.
 * A failing disposal must not prevent the remaining resources from being released.
 */
export function disposeAll(resources: readonly (Disposable | null | undefined)[]): void {
  for (let index = resources.length - 1; index >= 0; index -= 1) {
    const resource = resources[index];

    if (!resource) {
      continue;
    }

    try {
      resource.dispose();
    } catch (error) {
      console.error("[Glassline] Failed to dispose a resource.", error);
    }
  }
}
