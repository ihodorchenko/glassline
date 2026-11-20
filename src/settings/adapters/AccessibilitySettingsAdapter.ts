import type { ISettingsApplicationAdapter } from "../SettingsApplication";
import { readBooleanValue, type SettingsSnapshot } from "../SettingsTypes";

/** Rendering-side accessibility surface consumed by this adapter. */
export interface GrainScaleTarget {
  /** 1 = authored grain, 0 = grain disabled (see `PostPipeline.setGrainScale`). */
  setGrainScale(scale: number): void;
}

/**
 * Applies accessibility preferences that adjust the rendered image.
 *
 * Domain split (no duplicate ownership):
 * - `accessibility.reduced_motion` is applied by `CameraSettingsAdapter`
 *   (camera + `RenderScene` motion); this adapter does not duplicate it.
 * - `accessibility.high_contrast` / `large_text` / `color_independent_status`
 *   are applied by `UIManager.applySettings` (UI layer).
 * - `accessibility.reduce_grain` is the only setting owned here: it scales the
 *   post-processing film grain on the renderer.
 *
 * W5 plan §6 also lists "audio-reactivity" toggles. The build has no
 * audio-reactive visual effect to switch off, so no toggle is fabricated:
 * audio is owned by `AudioSettingsAdapter` (`audio.muted` / volumes) and motion
 * by `CameraSettingsAdapter`.
 */
export class AccessibilitySettingsAdapter implements ISettingsApplicationAdapter {
  readonly domain = "accessibility" as const;

  private readonly target: GrainScaleTarget;

  constructor(target: GrainScaleTarget) {
    this.target = target;
  }

  apply(snapshot: SettingsSnapshot): void {
    const reduceGrain = readBooleanValue(snapshot.values, "accessibility.reduce_grain", false);

    this.target.setGrainScale(reduceGrain ? 0 : 1);
  }
}
