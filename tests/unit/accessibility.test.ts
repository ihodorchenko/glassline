import { describe, expect, it } from "vitest";

import { AccessibilitySettingsAdapter } from "../../src/settings/adapters/AccessibilitySettingsAdapter";
import { SETTINGS_BY_ID } from "../../src/settings/SettingsDefinitions";
import { SettingsManager, type SettingsPersistence } from "../../src/settings/SettingsManager";
import type { SettingsSnapshot } from "../../src/settings/SettingsTypes";
import { validateSettingValue } from "../../src/settings/SettingsValidator";
import type { PersistedSettingsPayload } from "../../src/storage/repositories/SettingsRepository";
import { colorIndependentStatusMarker } from "../../src/ui/UIManager";

const GRAIN_SETTING_ID = "accessibility.reduce_grain";

class MemorySettingsPersistence implements SettingsPersistence {
  saved: PersistedSettingsPayload | null;

  constructor(initial: PersistedSettingsPayload | null = null) {
    this.saved = initial;
  }

  async load(): Promise<PersistedSettingsPayload | null> {
    return this.saved;
  }

  async save(values: Readonly<Record<string, unknown>>, revision: number): Promise<void> {
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
  revision = 4,
): PersistedSettingsPayload {
  return { schemaVersion: 1, revision, committedAt: 0, values };
}

function snapshot(values: Readonly<Record<string, unknown>>, revision = 1): SettingsSnapshot {
  return { revision, values: values as SettingsSnapshot["values"] };
}

class FakeGrainTarget {
  readonly scales: number[] = [];

  setGrainScale(scale: number): void {
    this.scales.push(scale);
  }

  get lastScale(): number | undefined {
    return this.scales.at(-1);
  }
}

describe("accessibility.reduce_grain definition", () => {
  it("is a boolean accessibility setting, default off, applied immediately", () => {
    const definition = SETTINGS_BY_ID.get(GRAIN_SETTING_ID);

    expect(definition).toBeDefined();
    expect(definition?.category).toBe("accessibility");
    expect(definition?.type).toBe("boolean");
    expect(definition?.defaultValue).toBe(false);
    expect(definition?.applyPolicy).toBe("immediate");
  });

  it("validates booleans and rejects other types", () => {
    const definition = SETTINGS_BY_ID.get(GRAIN_SETTING_ID);

    expect(definition && validateSettingValue(definition, true)).toBeNull();
    expect(definition && validateSettingValue(definition, false)).toBeNull();
    expect(definition && validateSettingValue(definition, 1)?.code).toBe("INVALID_TYPE");
    expect(definition && validateSettingValue(definition, "on")?.code).toBe("INVALID_TYPE");
    expect(definition && validateSettingValue(definition, null)?.code).toBe("INVALID_TYPE");
  });
});

describe("accessibility.reduce_grain persistence", () => {
  it("merges a persisted true value over the false default", async () => {
    const manager = new SettingsManager({
      persistence: new MemorySettingsPersistence(persisted({ [GRAIN_SETTING_ID]: true })),
    });

    await manager.initialize();

    expect(manager.getValue(GRAIN_SETTING_ID)).toBe(true);
    expect(manager.getSnapshot().revision).toBe(4);
  });

  it("falls back to the default when the persisted value is invalid", async () => {
    const manager = new SettingsManager({
      persistence: new MemorySettingsPersistence(persisted({ [GRAIN_SETTING_ID]: "yes" })),
    });

    await manager.initialize();

    expect(manager.getValue(GRAIN_SETTING_ID)).toBe(false);
    expect(manager.getLastLoadIssues().map((issue) => issue.code)).toContain("INVALID_TYPE");
  });

  it("persists an explicit update and rejects an invalid one atomically", async () => {
    const persistence = new MemorySettingsPersistence();
    const manager = new SettingsManager({ persistence });

    await manager.initialize();

    const enabled = await manager.update({ [GRAIN_SETTING_ID]: true });

    expect(enabled.applied).toBe(true);
    expect(enabled.persisted).toBe(true);
    expect(manager.getValue(GRAIN_SETTING_ID)).toBe(true);
    expect(persistence.saved?.values[GRAIN_SETTING_ID]).toBe(true);

    const rejected = await manager.update({ [GRAIN_SETTING_ID]: "off" });

    expect(rejected.applied).toBe(false);
    expect(rejected.issues[0]?.code).toBe("INVALID_TYPE");
    expect(manager.getValue(GRAIN_SETTING_ID)).toBe(true);

    const restored = await manager.update({ [GRAIN_SETTING_ID]: false });

    expect(restored.applied).toBe(true);
    expect(manager.getValue(GRAIN_SETTING_ID)).toBe(false);
    expect(persistence.saved?.values[GRAIN_SETTING_ID]).toBe(false);
  });
});

describe("AccessibilitySettingsAdapter", () => {
  it("maps reduce_grain true to grain scale 0 and false to 1", () => {
    const target = new FakeGrainTarget();
    const adapter = new AccessibilitySettingsAdapter(target);

    adapter.apply(snapshot({ [GRAIN_SETTING_ID]: true }));
    expect(target.lastScale).toBe(0);

    adapter.apply(snapshot({ [GRAIN_SETTING_ID]: false }));
    expect(target.lastScale).toBe(1);
  });

  it("keeps the authored grain (scale 1) when the setting is missing or invalid", () => {
    const target = new FakeGrainTarget();
    const adapter = new AccessibilitySettingsAdapter(target);

    adapter.apply(snapshot({}));
    adapter.apply(snapshot({ [GRAIN_SETTING_ID]: "on" }));

    expect(target.scales).toEqual([1, 1]);
  });

  it("reports the accessibility domain", () => {
    const adapter = new AccessibilitySettingsAdapter(new FakeGrainTarget());

    expect(adapter.domain).toBe("accessibility");
  });
});

describe("colorIndependentStatusMarker", () => {
  it("adds non-colour status markers only when enabled", () => {
    expect(colorIndependentStatusMarker("complete", true)).toBe("✓ ");
    expect(colorIndependentStatusMarker("incomplete", true)).toBe("✗ ");
    expect(colorIndependentStatusMarker("active-tab", true)).toBe("▸ ");

    expect(colorIndependentStatusMarker("complete", false)).toBe("");
    expect(colorIndependentStatusMarker("incomplete", false)).toBe("");
    expect(colorIndependentStatusMarker("active-tab", false)).toBe("");
  });
});
