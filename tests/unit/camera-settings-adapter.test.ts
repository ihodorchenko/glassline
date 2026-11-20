import { describe, expect, it } from "vitest";

import type { CameraSystem } from "../../src/camera/CameraSystem";
import { CameraSettingsAdapter } from "../../src/settings/adapters/CameraSettingsAdapter";
import type { SettingsSnapshot, SettingValue } from "../../src/settings/SettingsTypes";

interface AppliedView {
  baseFov: number;
  sprintFov: number;
  bobIntensity: number;
  motionIntensity: number;
  reducedMotion: boolean;
}

class FakeCamera {
  applied: AppliedView | null = null;

  setViewConfiguration(view: AppliedView): void {
    this.applied = view;
  }
}

function snapshot(values: Record<string, SettingValue>): SettingsSnapshot {
  return { revision: 1, values };
}

describe("CameraSettingsAdapter", () => {
  it("derives the sprint FOV from the intensity setting", () => {
    const camera = new FakeCamera();
    const adapter = new CameraSettingsAdapter(camera as unknown as CameraSystem);

    adapter.apply(snapshot({ "camera.field_of_view": 75, "camera.sprint_fov_intensity": 1 }));

    expect(camera.applied?.sprintFov).toBe(82);

    adapter.apply(snapshot({ "camera.field_of_view": 75, "camera.sprint_fov_intensity": 0 }));

    expect(camera.applied?.sprintFov).toBe(75);

    adapter.apply(snapshot({ "camera.field_of_view": 80, "camera.sprint_fov_intensity": 2 }));

    expect(camera.applied?.sprintFov).toBe(94);
  });

  it("falls back to the default intensity when the setting is missing", () => {
    const camera = new FakeCamera();
    const adapter = new CameraSettingsAdapter(camera as unknown as CameraSystem);

    adapter.apply(snapshot({ "camera.field_of_view": 75 }));

    expect(camera.applied?.sprintFov).toBe(82);
  });
});
