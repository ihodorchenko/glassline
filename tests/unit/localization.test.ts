import { describe, expect, it, vi } from "vitest";

import { LanguageRegistry } from "../../src/localization/Language";
import { LocalizationManager } from "../../src/localization/LocalizationManager";
import type { LocalizationResourceLoader } from "../../src/localization/LocalizationResourceLoader";
import type { TranslationResources } from "../../src/localization/TranslationTypes";

const REGISTRY = new LanguageRegistry([
  {
    id: "en",
    displayName: "English",
    nativeDisplayName: "English",
    locale: "en-US",
    direction: "ltr",
    supported: true,
  },
  {
    id: "xx",
    displayName: "Testish",
    nativeDisplayName: "Testish",
    locale: "xx-XX",
    direction: "ltr",
    supported: true,
  },
  {
    id: "zz",
    displayName: "Disabled",
    nativeDisplayName: "Disabled",
    locale: "zz-ZZ",
    direction: "ltr",
    supported: false,
  },
]);

const ENGLISH: TranslationResources = {
  "app.title": "Glassline",
  greeting: "Hello, {name}!",
  "only.english": "English only",
  items: { one: "{count} item", other: "{count} items" },
};

const TESTISH: TranslationResources = {
  "app.title": "Glassline (xx)",
  greeting: "Salut, {name}!",
};

class MemoryResourceLoader implements LocalizationResourceLoader {
  readonly available = new Map<string, TranslationResources>();
  readonly failing = new Set<string>();

  has(languageId: string): boolean {
    return this.available.has(languageId);
  }

  async load(languageId: string): Promise<TranslationResources> {
    if (this.failing.has(languageId)) {
      throw new Error(`Resources for "${languageId}" are unavailable.`);
    }

    const resources = this.available.get(languageId);

    if (!resources) {
      throw new Error(`No resources for "${languageId}".`);
    }

    return resources;
  }
}

function createLoader(): MemoryResourceLoader {
  const loader = new MemoryResourceLoader();

  loader.available.set("en", ENGLISH);
  loader.available.set("xx", TESTISH);

  return loader;
}

function createManager(loader: LocalizationResourceLoader): LocalizationManager {
  return new LocalizationManager({ loader, registry: REGISTRY, fallbackLanguageId: "en" });
}

describe("LocalizationManager", () => {
  it("initializes with the fallback language and resolves strings", async () => {
    const manager = createManager(createLoader());

    const result = await manager.initialize();

    expect(result).toEqual({ languageId: "en", usedFallback: false });
    expect(manager.activeLanguage.id).toBe("en");
    expect(manager.t("app.title")).toBe("Glassline");
  });

  it("interpolates named parameters", async () => {
    const manager = createManager(createLoader());

    await manager.initialize();

    expect(manager.t("greeting", { name: "Runner" })).toBe("Hello, Runner!");
  });

  it("returns the key and records missing translations", async () => {
    const manager = createManager(createLoader());

    await manager.initialize();

    expect(manager.t("missing.key")).toBe("missing.key");
    expect(manager.getMissingKeys()).toContain("missing.key");
  });

  it("falls back to the default language for missing translations", async () => {
    const manager = createManager(createLoader());

    await manager.initialize("xx");

    expect(manager.t("app.title")).toBe("Glassline (xx)");
    expect(manager.t("only.english")).toBe("English only");
  });

  it("selects plural forms by count", async () => {
    const manager = createManager(createLoader());

    await manager.initialize();

    expect(manager.t("items", { count: 1 })).toBe("1 item");
    expect(manager.t("items", { count: 5 })).toBe("5 items");
    expect(manager.t("items")).toBe("{count} items");
  });

  it("switches language and notifies subscribers", async () => {
    const manager = createManager(createLoader());
    const listener = vi.fn();

    await manager.initialize();
    manager.subscribe(listener);

    const result = await manager.setLanguage("xx");

    expect(result).toEqual({ changed: true, languageId: "xx" });
    expect(listener).toHaveBeenCalledWith({ previousLanguageId: "en", languageId: "xx" });
    expect(manager.t("app.title")).toBe("Glassline (xx)");
  });

  it("rejects unsupported languages without changing the active one", async () => {
    const manager = createManager(createLoader());

    await manager.initialize();

    const result = await manager.setLanguage("zz");

    expect(result.changed).toBe(false);
    expect(manager.activeLanguage.id).toBe("en");
  });

  it("retains the active language when resources fail to load", async () => {
    const loader = createLoader();
    const manager = createManager(loader);

    await manager.initialize();

    loader.failing.add("xx");

    const result = await manager.setLanguage("xx");

    expect(result.changed).toBe(false);
    expect(manager.activeLanguage.id).toBe("en");
    expect(manager.t("app.title")).toBe("Glassline");
  });

  it("falls back when the requested language fails during initialization", async () => {
    const loader = createLoader();
    const manager = createManager(loader);

    loader.failing.add("xx");

    const result = await manager.initialize("xx");

    expect(result).toEqual({
      languageId: "en",
      usedFallback: true,
      error: 'Resources for "xx" are unavailable.',
    });
    expect(manager.activeLanguage.id).toBe("en");
  });

  it("rejects initialization when the fallback language cannot load", async () => {
    const loader = createLoader();
    const manager = createManager(loader);

    loader.failing.add("en");

    await expect(manager.initialize()).rejects.toThrow(/unavailable/);
  });
});
