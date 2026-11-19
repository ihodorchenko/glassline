import type { DisplayQuality } from "../../rendering/Renderer";
import type { ISettingsApplicationAdapter } from "../SettingsApplication";
import type { SettingCategory, SettingsSnapshot } from "../SettingsTypes";
import { readStringValue } from "../SettingsTypes";

interface QualityTarget {
  setQuality(quality: DisplayQuality): void;
}

const QUALITY_VALUES = new Set<DisplayQuality>(["low", "medium", "high"]);

/** Applies display quality to the renderer, shadows and post effects. */
export class DisplaySettingsAdapter implements ISettingsApplicationAdapter {
  readonly domain: SettingCategory = "display";

  constructor(private readonly renderer: QualityTarget) {}

  apply(snapshot: SettingsSnapshot): void {
    const value = readStringValue(snapshot.values, "display.quality", "medium");
    const quality = QUALITY_VALUES.has(value as DisplayQuality)
      ? (value as DisplayQuality)
      : "medium";

    this.renderer.setQuality(quality);
  }
}
