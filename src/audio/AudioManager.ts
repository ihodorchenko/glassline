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

export interface AudioContextLike {
  readonly state: "suspended" | "running" | "closed" | "interrupted";
  readonly destination: unknown;
  readonly currentTime: number;
  resume(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainNodeLike;
}

export type AudioContextFactory = () => AudioContextLike | null;

export type AudioManagerState = "unavailable" | "idle" | "suspended" | "running" | "closed";

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
