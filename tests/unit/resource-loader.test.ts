import { describe, expect, it, vi } from "vitest";

import { ResourceLoadError, ResourceLoader } from "../../src/resources/ResourceLoader";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  signal: AbortSignal;
} {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  const controller = new AbortController();

  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
    signal: controller.signal,
  };
}

describe("ResourceLoader", () => {
  it("resolves loaded resources and clears the active set", async () => {
    const loader = new ResourceLoader();
    const result = await loader.load("test:one", async () => 42);

    expect(result).toBe(42);
    expect(loader.activeCount).toBe(0);
  });

  it("deduplicates concurrent loads by key", async () => {
    const loader = new ResourceLoader();
    const task = vi.fn(async () => "value");

    const first = loader.load("test:shared", task);
    const second = loader.load("test:shared", task);

    await expect(Promise.all([first, second])).resolves.toEqual(["value", "value"]);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("wraps task failures in a structured error", async () => {
    const loader = new ResourceLoader();
    const failure = new Error("network down");

    await expect(() =>
      loader.load("test:broken", async () => {
        throw failure;
      }),
    ).rejects.toMatchObject({ code: "FAILED", resourceKey: "test:broken", cause: failure });
  });

  it("times out a task that does not settle", async () => {
    const loader = new ResourceLoader();

    await expect(() =>
      loader.load("test:slow", () => new Promise(() => undefined), { timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: "TIMEOUT", resourceKey: "test:slow" });

    expect(loader.activeCount).toBe(0);
  });

  it("cancels an in-flight load", async () => {
    const loader = new ResourceLoader();
    const pending = deferred<string>();
    const load = loader.load("test:cancel", () => pending.promise);

    loader.cancel("test:cancel");

    await expect(load).rejects.toMatchObject({ code: "CANCELLED" });
    expect(loader.activeCount).toBe(0);
  });

  it("cancels all in-flight loads", async () => {
    const loader = new ResourceLoader();
    const first = loader.load("test:a", () => new Promise(() => undefined));
    const second = loader.load("test:b", () => new Promise(() => undefined));

    loader.cancelAll();

    await expect(first).rejects.toBeInstanceOf(ResourceLoadError);
    await expect(second).rejects.toBeInstanceOf(ResourceLoadError);
    expect(loader.activeCount).toBe(0);
  });
});
