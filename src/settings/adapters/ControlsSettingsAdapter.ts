import type { CameraSystem } from "../../camera/CameraSystem";
import type { ISettingsApplicationAdapter } from "../SettingsApplication";
import { readBooleanValue, readNumberValue, type SettingsSnapshot } from "../SettingsTypes";

/** Applies Settings-owned look/control values to the Camera System. */
export class ControlsSettingsAdapter implements ISettingsApplicationAdapter {
  readonly domain = "controls" as const;

  private readonly camera: CameraSystem;

  constructor(camera: CameraSystem) {
    this.camera = camera;
  }

  apply(snapshot: SettingsSnapshot): void {
    this.camera.setLookConfiguration({
      mouseSensitivity: readNumberValue(snapshot.values, "controls.mouse_sensitivity", 1),
      invertMouseY: readBooleanValue(snapshot.values, "controls.invert_mouse_y", false),
      gamepadSensitivity: readNumberValue(snapshot.values, "controls.gamepad_sensitivity", 1),
      invertGamepadY: readBooleanValue(snapshot.values, "controls.invert_gamepad_y", false),
    });
  }
}
