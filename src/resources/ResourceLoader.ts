/**
 * Asynchronous resource loading with explicit cancellation, timeouts, and
 * structured errors.
 *
 * Phase 1 foundation for procedural asset loading: language resources, audio
 * buffers, and generated assets are loaded through this contract so failures
 * are reported as recoverable errors instead of unhandled rejections.
 */

export type ResourceLoadErrorCode = "FAILED" | "TIMEOUT" | "CANCELLED";

export class ResourceLoadError extends Error {
  readonly code: ResourceLoadErrorCode;
  readonly resourceKey: string;

  constructor(code: ResourceLoadErrorCode, resourceKey: string, message: string, cause?: unknown) {
    super(message);
    this.name = "ResourceLoadError";
    this.code = code;
    this.resourceKey = resourceKey;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export interface ResourceLoadOptions {
  /** Rejects with a TIMEOUT error after this many milliseconds. 0 disables the timeout. */
  readonly timeoutMs?: number;
}

export type ResourceTask<T> = (signal: AbortSignal) => Promise<T>;

interface ActiveLoad {
  readonly controller: AbortController;
  readonly promise: Promise<unknown>;
}

function toResourceError(resourceKey: string, error: unknown): ResourceLoadError {
  if (error instanceof ResourceLoadError) {
    return error;
  }

  return new ResourceLoadError("FAILED", resourceKey, `Loading "${resourceKey}" failed.`, error);
}

/**
 * Loads resources by key with in-flight deduplication.
 * The same key requested twice while loading returns the same promise.
 */
export class ResourceLoader {
  private readonly active = new Map<string, ActiveLoad>();

  get activeCount(): number {
    return this.active.size;
  }

  isLoading(resourceKey: string): boolean {
    return this.active.has(resourceKey);
  }

  load<T>(
    resourceKey: string,
    task: ResourceTask<T>,
    options: ResourceLoadOptions = {},
  ): Promise<T> {
    const existing = this.active.get(resourceKey);

    if (existing) {
      return existing.promise as Promise<T>;
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 0;

    const promise = new Promise<T>((resolve, reject) => {
      let settled = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const finish = (callback: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;

        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
        }

        controller.signal.removeEventListener("abort", onAbort);
        callback();
      };

      const onAbort = (): void => {
        const reason: unknown = controller.signal.reason;

        finish(() => {
          reject(
            reason instanceof ResourceLoadError
              ? reason
              : new ResourceLoadError(
                  "CANCELLED",
                  resourceKey,
                  `Loading "${resourceKey}" was cancelled.`,
                  reason,
                ),
          );
        });
      };

      controller.signal.addEventListener("abort", onAbort, { once: true });

      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          controller.abort(
            new ResourceLoadError(
              "TIMEOUT",
              resourceKey,
              `Loading "${resourceKey}" timed out after ${timeoutMs} ms.`,
            ),
          );
        }, timeoutMs);
      }

      Promise.resolve()
        .then(() => task(controller.signal))
        .then(
          (result) => finish(() => resolve(result)),
          (error: unknown) => finish(() => reject(toResourceError(resourceKey, error))),
        );
    }).finally(() => {
      this.active.delete(resourceKey);
    });

    this.active.set(resourceKey, { controller, promise });

    return promise;
  }

  cancel(resourceKey: string): void {
    const load = this.active.get(resourceKey);

    if (!load) {
      return;
    }

    load.controller.abort(
      new ResourceLoadError("CANCELLED", resourceKey, `Loading "${resourceKey}" was cancelled.`),
    );
  }

  cancelAll(): void {
    for (const resourceKey of [...this.active.keys()]) {
      this.cancel(resourceKey);
    }
  }
}
