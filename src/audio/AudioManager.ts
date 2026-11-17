import type { Disposable } from "../core/Disposable";
import { clamp } from "../shared/math";

/**
 * Minimal structural audio-context contract.
 * Kept independent of the DOM types so the manager can be unit-tested with a fake.
 */
export interface AudioParamLike {
  value: number;
}

export interface GainNodeLike {
  readonly gain: AudioParamLike;
  connect(destination: unknown): void;
  disconnect(): void;
}

export interface OscillatorNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
  connect(destination: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface AudioContextLike {
  readonly state: "suspended" | "running" | "closed" | "interrupted";
  readonly destination: unknown;
  readonly currentTime: number;
  resume(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainNodeLike;
  createOscillator?(): OscillatorNodeLike;
}

export type AudioContextFactory = () => AudioContextLike | null;

export type AudioManagerState = "unavailable" | "idle" | "suspended" | "running" | "closed";

export type UiCue =
  | "navigate"
  | "confirm"
  | "back"
  | "checkpoint"
  | "exercise-complete"
  | "finish"
  | "land";

interface UiCueConfiguration {
  readonly frequency: number;
  readonly durationSeconds?: number;
  readonly volume?: number;
  readonly waveform?: string;
  readonly channel: "ui" | "sfx";
}

const UI_CUES: Readonly<Record<UiCue, UiCueConfiguration>> = {
  navigate: { frequency: 620, durationSeconds: 0.035, volume: 0.12, channel: "ui" },
  confirm: { frequency: 880, durationSeconds: 0.07, volume: 0.16, channel: "ui" },
  back: { frequency: 420, durationSeconds: 0.07, volume: 0.14, channel: "ui" },
  checkpoint: {
    frequency: 1040,
    durationSeconds: 0.16,
    volume: 0.2,
    channel: "sfx",
    waveform: "triangle",
  },
  "exercise-complete": {
    frequency: 1240,
    durationSeconds: 0.18,
    volume: 0.2,
    channel: "sfx",
    waveform: "triangle",
  },
  finish: {
    frequency: 1560,
    durationSeconds: 0.3,
    volume: 0.24,
    channel: "sfx",
    waveform: "triangle",
  },
  land: { frequency: 180, durationSeconds: 0.06, volume: 0.12, channel: "sfx" },
};

export interface AudioManagerOptions {
  /** `null` simulates an environment without Web Audio support. */
  readonly factory?: AudioContextFactory | null;
  readonly gestureTarget?: EventTarget | null;
}

function createDefaultAudioContextFactory(): AudioContextFactory | null {
  const globalWithAudio = globalThis as typeof globalThis & {
    AudioContext?: new () => unknown;
    webkitAudioContext?: new () => unknown;
  };
  const AudioContextConstructor =
    globalWithAudio.AudioContext ?? globalWithAudio.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  return () => {
    try {
      return new AudioContextConstructor() as unknown as AudioContextLike;
    } catch {
      return null;
    }
  };
}

/**
 * Owns the Web Audio lifecycle and applies Settings-owned volume preferences.
 *
 * The AudioContext is created lazily after a genuine user gesture to respect
 * browser autoplay policy. No sounds are produced in Phase 1; procedural audio
 * generators arrive with the audio implementation phase.
 */
export class AudioManager implements Disposable {
  private readonly factory: AudioContextFactory | null;
  private readonly gestureTarget: EventTarget | null;

  private context: AudioContextLike | null = null;
  private masterGain: GainNodeLike | null = null;
  private gestureCleanup: (() => void) | null = null;
  private desiredVolume = 1;
  private desiredMuted = false;
  private uiVolume = 0.8;
  private sfxVolume = 1;
  private disposed = false;

  constructor(options: AudioManagerOptions = {}) {
    this.factory =
      options.factory !== undefined ? options.factory : createDefaultAudioContextFactory();
    this.gestureTarget =
      options.gestureTarget !== undefined
        ? options.gestureTarget
        : typeof window === "undefined"
          ? null
          : window;
  }

  get state(): AudioManagerState {
    if (this.disposed || !this.factory) {
      return "unavailable";
    }

    if (!this.context) {
      return "idle";
    }

    if (this.context.state === "running") {
      return "running";
    }

    if (this.context.state === "closed") {
      return "closed";
    }

    return "suspended";
  }

  /** Registers user-gesture listeners; no AudioContext is created here. */
  initialize(): void {
    if (this.disposed || this.gestureCleanup !== null || !this.factory || !this.gestureTarget) {
      return;
    }

    const onGesture = (): void => {
      void this.notifyUserGesture();
    };
    const target = this.gestureTarget;

    target.addEventListener("pointerdown", onGesture);
    target.addEventListener("keydown", onGesture);
    this.gestureCleanup = () => {
      target.removeEventListener("pointerdown", onGesture);
      target.removeEventListener("keydown", onGesture);
    };
  }

  /**
   * Creates or resumes the AudioContext. Must be triggered by an explicit user
   * gesture. Returns whether audio is running afterwards.
   */
  async notifyUserGesture(): Promise<boolean> {
    if (this.disposed || !this.factory) {
      return false;
    }

    try {
      if (!this.context || this.context.state === "closed") {
        this.context = this.factory();

        if (!this.context) {
          return false;
        }

        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.applyMasterVolume();
      }

      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      this.applyMasterVolume();

      if (this.context.state === "running") {
        this.detachGestureListeners();

        return true;
      }
    } catch (error) {
      console.warn("[Glassline] Audio could not be started.", error);
    }

    return false;
  }

  /** Applies Settings-owned master volume and mute preference. */
  setMasterVolume(volume: number, muted: boolean): void {
    this.desiredVolume = clamp(volume, 0, 1);
    this.desiredMuted = muted;
    this.applyMasterVolume();
  }

  /** Settings-owned UI feedback volume. */
  setUiVolume(volume: number): void {
    this.uiVolume = clamp(volume, 0, 1);
  }

  /** Settings-owned gameplay SFX volume. */
  setSfxVolume(volume: number): void {
    this.sfxVolume = clamp(volume, 0, 1);
  }

  /**
   * Plays a short procedural feedback cue. Presentation systems request cues;
   * the Audio System owns the actual playback and mixing.
   */
  playUiCue(cue: UiCue): void {
    const context = this.context;
    const master = this.masterGain;

    if (
      this.disposed ||
      !context ||
      context.state !== "running" ||
      !master ||
      !context.createOscillator
    ) {
      return;
    }

    const config = UI_CUES[cue];
    const channelVolume = config.channel === "ui" ? this.uiVolume : this.sfxVolume;
    const volume = channelVolume * (config.volume ?? 0.18);

    if (volume <= 0.0001) {
      return;
    }

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = config.waveform ?? "sine";
      oscillator.frequency.value = config.frequency;
      gain.gain.value = volume;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      oscillator.stop(context.currentTime + (config.durationSeconds ?? 0.08));
    } catch (error) {
      console.warn("[Glassline] Audio cue could not be played.", error);
    }
  }

  get effectiveVolume(): number {
    return this.desiredMuted ? 0 : this.desiredVolume;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.detachGestureListeners();

    const context = this.context;

    this.context = null;
    this.masterGain = null;

    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private applyMasterVolume(): void {
    if (this.masterGain) {
      this.masterGain.gain.value = this.effectiveVolume;
    }
  }

  private detachGestureListeners(): void {
    if (this.gestureCleanup) {
      this.gestureCleanup();
      this.gestureCleanup = null;
    }
  }
}
