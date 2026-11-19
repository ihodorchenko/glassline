import type { AudioManager } from "../../audio/AudioManager";
import type { ISettingsApplicationAdapter } from "../SettingsApplication";
import { readBooleanValue, readNumberValue, type SettingsSnapshot } from "../SettingsTypes";

/** Applies Settings-owned audio values to the Audio System. */
export class AudioSettingsAdapter implements ISettingsApplicationAdapter {
  readonly domain = "audio" as const;

  private readonly audioManager: AudioManager;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;
  }

  apply(snapshot: SettingsSnapshot): void {
    const volume = readNumberValue(snapshot.values, "audio.master_volume", 1);
    const muted = readBooleanValue(snapshot.values, "audio.muted", false);

    this.audioManager.setMasterVolume(volume, muted);
    this.audioManager.setUiVolume(readNumberValue(snapshot.values, "audio.ui_volume", 0.8));
    this.audioManager.setSfxVolume(readNumberValue(snapshot.values, "audio.sfx_volume", 1));
    this.audioManager.setMusicVolume(readNumberValue(snapshot.values, "audio.music_volume", 0.8));
  }
}
