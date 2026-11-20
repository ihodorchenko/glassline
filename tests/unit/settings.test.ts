import "fake-indexeddb/auto";

import { describe, expect, it, vi } from "vitest";
import {
  type ISettingsApplicationAdapter,
  SettingsApplicationPipeline,
} from "../../src/settings/SettingsApplication";
import { SETTING_DEFINITIONS, SETTINGS_BY_ID } from "../../src/settings/SettingsDefinitions";
import { SettingsManager, type SettingsPersistence } from "../../src/settings/SettingsManager";
import { buildSettingsValues, validateSettingValue } from "../../src/settings/SettingsValidator";
import { Database } from "../../src/storage/Database";
import type { PersistedSettingsPayload } from "../../src/storage/repositories/SettingsRepository";
import { SettingsRepository } from "../../src/storage/repositories/SettingsRepository";

class MemorySettingsPersistence implements SettingsPersistence {
  saved: PersistedSettingsPayload | null;
  failOnSave = false;

  constructor(initial: PersistedSettingsPayload | null = null) {
    this.saved = initial;
  }

  async load(): Promise<PersistedSettingsPayload | null> {
    return this.saved;
  }

  async save(values: Readonly<Record<string, unknown>>, revision: number): Promise<void> {
    if (this.failOnSave) {
      throw new Error("disk full");
    }

    this.saved = {
      schemaVersion: 1,
      revision,
      committedAt: 0,
      values: values as Record<string, unknown>,
    };
  }

  async clear(): Promise<void> {
    this.saved = null;
  }
}

function persisted(
  values: Readonly<Record<string, unknown>>,
  revision = 3,
): PersistedSettingsPayload {
  return { schemaVersion: 1, revision, committedAt: 0, values };
}

describe("settings definitions", () => {
  it("uses unique IDs and valid default values", () => {
    const ids = new Set<string>();

    for (const definition of SETTING_DEFINITIONS) {
      expect(ids.has(definition.id)).toBe(false);
      ids.add(definition.id);
      expect(validateSettingValue(definition, definition.defaultValue)).toBeNull();
    }

    expect(SETTINGS_BY_ID.size).toBe(SETTING_DEFINITIONS.length);
  });

  it("validates numeric ranges, enum values and types", () => {
    const volume = SETTINGS_BY_ID.get("audio.master_volume");
    const quality = SETTINGS_BY_ID.get("display.quality");
    const muted = SETTINGS_BY_ID.get("audio.muted");
    const language = SETTINGS_BY_ID.get("general.language");

    expect(volume && validateSettingValue(volume, 1.5)?.code).toBe("OUT_OF_RANGE");
    expect(volume && validateSettingValue(volume, "loud")?.code).toBe("INVALID_TYPE");
    expect(quality && validateSettingValue(quality, "ultra")?.code).toBe("INVALID_ENUM");
    expect(muted && validateSettingValue(muted, 1)?.code).toBe("INVALID_TYPE");
    expect(language && validateSettingValue(language, "de")?.code).toBe("INVALID_ENUM");
  });
});

describe("settings value merging", () => {
  it("merges persisted values over defaults and reports invalid entries", () => {
    const merged = buildSettingsValues(SETTING_DEFINITIONS, {
      "audio.master_volume": 0.4,
      "display.quality": "ultra",
      "unknown.setting": true,
    });

    expect(merged.values["audio.master_volume"]).toBe(0.4);
    expect(merged.values["display.quality"]).toBe("medium");
    expect(merged.issues.map((issue) => issue.code).sort()).toEqual([
      "INVALID_ENUM",
      "UNKNOWN_SETTING",
    ]);
  });
});

describe("SettingsManager", () => {
  it("starts with defaults when persistence is unavailable", async () => {
    const manager = new SettingsManager({ persistence: null });

    await manager.initialize();

    expect(manager.getSnapshot().revision).toBe(0);
    expect(manager.getValue("audio.master_volume")).toBe(1);
    expect(manager.getPersistenceStatus()).toBe("unavailable");
  });

  it("loads persisted values and revision", async () => {
    const manager = new SettingsManager({
      persistence: new MemorySettingsPersistence(persisted({ "camera.field_of_view": 90 })),
    });

    await manager.initialize();

    expect(manager.getValue("camera.field_of_view")).toBe(90);
    expect(manager.getSnapshot().revision).toBe(3);
    expect(manager.getPersistenceStatus()).toBe("ready");
  });

  it("registers the sprint FOV intensity with its default and range", async () => {
    const manager = new SettingsManager({ persistence: null });

    await manager.initialize();

    expect(manager.getValue("camera.sprint_fov_intensity")).toBe(1);

    const applied = await manager.update({ "camera.sprint_fov_intensity": 0.5 });

    expect(applied.applied).toBe(true);
    expect(manager.getValue("camera.sprint_fov_intensity")).toBe(0.5);

    const rejected = await manager.update({ "camera.sprint_fov_intensity": 5 });

    expect(rejected.applied).toBe(false);
    expect(manager.getValue("camera.sprint_fov_intensity")).toBe(0.5);
  });

  it("rejects invalid updates atomically", async () => {
    const manager = new SettingsManager({ persistence: null });

    await manager.initialize();

    const result = await manager.update({
      "camera.field_of_view": 90,
      "audio.master_volume": 4,
    });

    expect(result.applied).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(manager.getValue("camera.field_of_view")).toBe(75);
    expect(manager.getSnapshot().revision).toBe(0);
  });

  it("applies, persists, and notifies subscribers", async () => {
    const persistence = new MemorySettingsPersistence();
    const manager = new SettingsManager({ persistence });
    const listener = vi.fn();

    await manager.initialize();
    manager.subscribe(listener);

    const result = await manager.update({ "audio.master_volume": 0.25 });

    expect(result).toEqual({ applied: true, persisted: true, issues: [] });
    expect(manager.getValue("audio.master_volume")).toBe(0.25);
    expect(manager.getSnapshot().revision).toBe(1);
    expect(persistence.saved?.values["audio.master_volume"]).toBe(0.25);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[1]).toEqual(["audio.master_volume"]);
  });

  it("keeps applied values when persistence fails", async () => {
    const persistence = new MemorySettingsPersistence();
    const manager = new SettingsManager({ persistence });

    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    persistence.failOnSave = true;
    await manager.initialize();

    const result = await manager.update({ "audio.muted": true });

    expect(result.applied).toBe(true);
    expect(result.persisted).toBe(false);
    expect(manager.getValue("audio.muted")).toBe(true);
    expect(manager.getPersistenceStatus()).toBe("failed");
  });

  it("resets all settings and categories to defaults", async () => {
    const manager = new SettingsManager({ persistence: null });

    await manager.initialize();
    await manager.update({ "audio.master_volume": 0.2, "camera.field_of_view": 95 });

    const categoryResult = await manager.resetCategory("camera");

    expect(categoryResult.applied).toBe(true);
    expect(manager.getValue("camera.field_of_view")).toBe(75);
    expect(manager.getValue("audio.master_volume")).toBe(0.2);

    await manager.resetAll();

    expect(manager.getValue("audio.master_volume")).toBe(1);
    expect(manager.getSnapshot().revision).toBe(3);
  });
});

describe("SettingsApplicationPipeline", () => {
  it("applies adapters in order and isolates failures", async () => {
    const order: string[] = [];
    const failing: ISettingsApplicationAdapter = {
      domain: "display",
      apply: () => {
        order.push("display");
        throw new Error("adapter failed");
      },
    };
    const audio: ISettingsApplicationAdapter = {
      domain: "audio",
      apply: () => {
        order.push("audio");
      },
    };

    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const pipeline = new SettingsApplicationPipeline([failing, audio]);
    const result = await pipeline.apply({ revision: 1, values: {} });

    expect(order).toEqual(["display", "audio"]);
    expect(result.appliedDomains).toEqual(["audio"]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.domain).toBe("display");
  });
});

describe("SettingsManager with IndexedDB persistence", () => {
  it("persists updates through the SettingsRepository and reloads them", async () => {
    const databaseName = `glassline-settings-test-${Date.now()}`;
    const database = new Database({ name: databaseName, version: 1, openTimeoutMs: 2000 });

    try {
      await database.open();

      const manager = new SettingsManager({
        persistence: new SettingsRepository(database),
      });

      await manager.initialize();
      await manager.update({ "audio.master_volume": 0.3, "general.language": "en" });

      expect(manager.getPersistenceStatus()).toBe("ready");
      database.close();

      const reopened = new Database({ name: databaseName, version: 1, openTimeoutMs: 2000 });

      await reopened.open();

      const reloaded = new SettingsManager({
        persistence: new SettingsRepository(reopened),
      });

      await reloaded.initialize();

      expect(reloaded.getValue("audio.master_volume")).toBe(0.3);
      expect(reloaded.getSnapshot().revision).toBe(1);
      expect(reloaded.getPersistenceStatus()).toBe("ready");
      reopened.close();
    } finally {
      database.close();

      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(databaseName);

        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    }
  });
});
