import { describe, expect, it } from "vitest";

import type { DisplayQuality } from "../../src/rendering/Renderer";
import { DisplaySettingsAdapter } from "../../src/settings/adapters/DisplaySettingsAdapter";
import type { SettingsSnapshot } from "../../src/settings/SettingsTypes";

class FakeRenderer {
  quality: DisplayQuality | null = null;

  setQuality(quality: DisplayQuality): void {
    this.quality = quality;
  }
}

function snapshot(quality: string): SettingsSnapshot {
  return { revision: 1, values: { "display.quality": quality } };
}

describe("DisplaySettingsAdapter", () => {
  it("applies low/medium/high quality", () => {
    const renderer = new FakeRenderer();
    const adapter = new DisplaySettingsAdapter(renderer);

    adapter.apply(snapshot("low"));
    expect(renderer.quality).toBe("low");

    adapter.apply(snapshot("high"));
    expect(renderer.quality).toBe("high");
  });

  it("falls back to medium for unknown values", () => {
    const renderer = new FakeRenderer();
    const adapter = new DisplaySettingsAdapter(renderer);

    adapter.apply(snapshot("ultra"));
    expect(renderer.quality).toBe("medium");
  });
});
