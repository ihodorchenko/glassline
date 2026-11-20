import type { CameraSystem } from "../../camera/CameraSystem";
import type { ISettingsApplicationAdapter } from "../SettingsApplication";
import { readBooleanValue, readNumberValue, type SettingsSnapshot } from "../SettingsTypes";

const SPRINT_FOV_DELTA_DEGREES = 7;

/** Applies Settings-owned camera values to the Camera System. */
export class CameraSettingsAdapter implements ISettingsApplicationAdapter {
  readonly domain = "camera" as const;

  private readonly camera: CameraSystem;

  constructor(camera: CameraSystem) {
    this.camera = camera;
  }

  apply(snapshot: SettingsSnapshot): void {
    const baseFov = readNumberValue(snapshot.values, "camera.field_of_view", 75);
    const sprintFovIntensity = readNumberValue(snapshot.values, "camera.sprint_fov_intensity", 1);

    this.camera.setViewConfiguration({
      baseFov,
      sprintFov: baseFov + SPRINT_FOV_DELTA_DEGREES * sprintFovIntensity,
      bobIntensity: readNumberValue(snapshot.values, "camera.bob_intensity", 1),
      motionIntensity: readNumberValue(snapshot.values, "camera.motion_intensity", 1),
      reducedMotion: readBooleanValue(snapshot.values, "accessibility.reduced_motion", false),
    });
  }
}
