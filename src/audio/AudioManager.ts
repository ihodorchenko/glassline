import type { Disposable } from "../core/Disposable";
import { clamp } from "../shared/math";
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioBusName,
  AudioContextFactory,
  AudioContextLike,
  AudioMovementState,
  AudioNodeLike,
  AudioParamLike,
  GainNodeLike,
  OscillatorNodeLike,
} from "./AudioTypes";
import { type SurfaceAudioPreset, surfaceAudioPreset } from "./surfaceAudio";
import {
  createContactLoop,
  createImpulseBuffer,
  createNoiseBuffers,
  type LoopVoice,
  type NoiseBufferSet,
  renderFootstep,
  renderLanding,
  renderUiTone,
  renderWhoosh,
  type SynthDestination,
  type SynthVoice,
} from "./synthesis";

export type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextFactory,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  BiquadFilterNodeLike,
  ConvolverNodeLike,
  DynamicsCompressorNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
} from "./AudioTypes";

export type AudioManagerState = "unavailable" | "idle" | "suspended" | "running" | "closed";

export type UiCue =
  | "navigate"
  | "confirm"
  | "back"
  | "checkpoint"
  | "exercise-complete"
  | "finish"
  | "land"
  | "achievement";

interface UiCueConfiguration {
  readonly frequency: number;
  readonly durationSeconds?: number;
  readonly volume?: number;
  readonly waveform?: string;
  readonly channel: "ui" | "sfx";
}

const UI_CUES: Readonly<Record<UiCue, UiCueConfiguration>> = {
  navigate: { frequency: 620, durationSeconds: 0.045, volume: 0.1, channel: "ui" },
  confirm: { frequency: 880, durationSeconds: 0.09, volume: 0.14, channel: "ui" },
  back: { frequency: 420, durationSeconds: 0.09, volume: 0.12, channel: "ui" },
  checkpoint: {
    frequency: 1040,
    durationSeconds: 0.18,
    volume: 0.18,
    channel: "sfx",
    waveform: "triangle",
  },
  "exercise-complete": {
    frequency: 1240,
    durationSeconds: 0.2,
    volume: 0.18,
    channel: "sfx",
    waveform: "triangle",
  },
  finish: {
    frequency: 1560,
    durationSeconds: 0.34,
    volume: 0.2,
    channel: "sfx",
    waveform: "triangle",
  },
  land: { frequency: 180, durationSeconds: 0.08, volume: 0.1, channel: "sfx" },
  achievement: {
    frequency: 1320,
    durationSeconds: 0.24,
    volume: 0.18,
    channel: "sfx",
    waveform: "triangle",
  },
};

export interface AudioManagerOptions {
  /** `null` simulates an environment without Web Audio support. */
  readonly factory?: AudioContextFactory | null;
  readonly gestureTarget?: EventTarget | null;
  readonly voiceLimit?: number;
  readonly randomSeed?: number;
}

const AMBIENCE_PROFILES = {
  training: {
    windGain: 0.014,
    windFilter: 260,
    cityGain: 0.008,
    cityFilter: 85,
    airGain: 0.009,
  },
  prologue: {
    windGain: 0.018,
    windFilter: 330,
    cityGain: 0.012,
    cityFilter: 110,
    airGain: 0.012,
  },
} as const;

const CHORDS: readonly (readonly number[])[] = [
  [110, 164.81, 220, 261.63],
  [87.31, 130.81, 174.61, 220],
  [130.81, 196, 261.63, 329.63],
  [98, 146.83, 196, 246.94],
];

interface AmbienceNodes {
  readonly sources: AudioBufferSourceNodeLike[];
  readonly oscillators: OscillatorNodeLike[];
  readonly nodes: AudioNodeLike[];
  readonly windGain: GainNodeLike;
  readonly windFilter: {
    frequency: {
      value: number;
      setTargetAtTime?: (value: number, time: number, constant: number) => void;
    };
  };
  readonly cityGain: GainNodeLike;
  readonly cityFilter: {
    frequency: {
      value: number;
      setTargetAtTime?: (value: number, time: number, constant: number) => void;
    };
  };
  readonly airGain: GainNodeLike;
  readonly humGain: GainNodeLike;
}

interface MusicState {
  active: boolean;
  chordIndex: number;
  nextChordTime: number;
  nextArpTime: number;
  arpStep: number;
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

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function safeDisconnect(node: AudioNodeLike): void {
  try {
    node.disconnect();
  } catch {
    // A disconnected or closed-context node is already silent.
  }
}

function safeStopOscillator(oscillator: OscillatorNodeLike): void {
  try {
    oscillator.stop();
  } catch {
    // Already stopped.
  }
}

function setBusGain(gain: AudioParamLike, value: number): void {
  if (gain.setTargetAtTime) {
    gain.setTargetAtTime(value, 0, 0.02);
  } else {
    gain.value = value;
  }
}

/**
 * Owns the Web Audio lifecycle, buses, procedural ambience, surface-aware
 * movement feedback, parkour one-shots, and the sparse score.
 *
 * All sound is generated at runtime; no samples or downloaded assets are used.
 */
export class AudioManager implements Disposable {
  private readonly factory: AudioContextFactory | null;
  private readonly gestureTarget: EventTarget | null;
  private readonly voiceLimit: number;
  private readonly random: () => number;

  private context: AudioContextLike | null = null;
  private masterGain: GainNodeLike | null = null;
  private mixTrim: GainNodeLike | null = null;
  private limiter: AudioNodeLike | null = null;
  private buses: Partial<Record<AudioBusName, GainNodeLike>> = {};
  private reverbSend: GainNodeLike | null = null;
  private reverbReturn: GainNodeLike | null = null;
  private buffers: NoiseBufferSet | null = null;
  private gestureCleanup: (() => void) | null = null;

  private desiredVolume = 1;
  private desiredMuted = false;
  private uiVolume = 0.8;
  private sfxVolume = 1;
  private musicVolume = 0.8;
  private ambienceProfile: "training" | "prologue" | null = null;
  private ambience: AmbienceNodes | null = null;
  private slideLoop: LoopVoice | null = null;
  private wallRunLoop: LoopVoice | null = null;
  private music: MusicState = {
    active: false,
    chordIndex: 0,
    nextChordTime: 0,
    nextArpTime: 0,
    arpStep: 0,
  };
  private readonly activeVoices = new Set<SynthVoice>();
  private readonly musicVoices = new Set<SynthVoice>();
  private paused = false;
  private elapsedSeconds = 0;
  private lastSurface: SurfaceAudioPreset = surfaceAudioPreset(null);
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
    this.voiceLimit = Math.max(4, options.voiceLimit ?? 24);
    this.random = createRandom(options.randomSeed ?? 0x9e3779b9);
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

  get effectiveVolume(): number {
    return this.desiredMuted ? 0 : this.desiredVolume;
  }

  get activeVoiceCount(): number {
    return this.activeVoices.size;
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

        this.buildGraph(this.context);
      }

      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      this.applyVolumes();

      if (this.context.state === "running") {
        this.detachGestureListeners();
        this.startAmbienceNodes();
        this.startMusic();

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
    this.applyVolumes();
  }

  /** Settings-owned UI feedback volume. */
  setUiVolume(volume: number): void {
    this.uiVolume = clamp(volume, 0, 1);
    this.applyVolumes();
  }

  /** Settings-owned gameplay SFX volume. */
  setSfxVolume(volume: number): void {
    this.sfxVolume = clamp(volume, 0, 1);
    this.applyVolumes();
  }

  /** Settings-owned music volume. */
  setMusicVolume(volume: number): void {
    this.musicVolume = clamp(volume, 0, 1);
    this.applyVolumes();
  }

  /** Starts level ambience and the sparse score once audio is running. */
  startAmbience(profile: "training" | "prologue"): void {
    this.ambienceProfile = profile;

    if (this.context?.state === "running") {
      this.startAmbienceNodes();
      this.startMusic();
      this.applyVolumes();
    }
  }

  stopAmbience(): void {
    this.ambienceProfile = null;
    this.stopAmbienceNodes();
    this.stopMusic();
    this.stopSlide();
    this.stopWallRun();
  }

  /** Reconciles loops, wind, and score intensity with movement state. */
  update(deltaSeconds: number, state: AudioMovementState): void {
    if (this.disposed) {
      return;
    }

    this.elapsedSeconds += Math.max(0, Math.min(deltaSeconds, 0.1));

    if (this.paused !== state.paused) {
      this.paused = state.paused;
      this.applyVolumes();
    }

    this.lastSurface = surfaceAudioPreset(state.surface);

    if (!this.context || this.context.state !== "running") {
      return;
    }

    this.updateAmbience(state);
    this.updateLoops(state);
    this.updateMusic(state);
  }

  setGameplayPaused(paused: boolean): void {
    this.paused = paused;
    this.applyVolumes();

    if (paused) {
      this.stopSlide();
      this.stopWallRun();
    }
  }

  /** Speed- and surface-scaled footstep. */
  playFootstep(intensity: number, surface?: string | null): void {
    const context = this.context;

    if (!this.ready(context) || this.paused || !this.buffers) {
      return;
    }

    const preset = surfaceAudioPreset(surface ?? this.lastSurface.type);
    const strength = clamp(intensity, 0, 1);

    if (!this.reserveVoice(strength > 0.6 ? 1 : 0)) {
      return;
    }

    const variation = this.random();
    const voice = renderFootstep(context, this.buffers, preset, this.destination("movement"), {
      when: context.currentTime + 0.005,
      intensity: strength,
      variation,
    });

    this.trackVoice(voice);
  }

  /** Impact-scaled landing with surface resonance. */
  playLanding(impactSpeed: number, surface?: string | null): void {
    const context = this.context;

    if (!this.ready(context) || this.paused || !this.buffers) {
      return;
    }

    if (!this.reserveVoice(2)) {
      return;
    }

    const preset = surfaceAudioPreset(surface ?? this.lastSurface.type);
    const voice = renderLanding(context, this.buffers, this.destination("parkour"), {
      when: context.currentTime + 0.003,
      impactSpeed,
      surfacePreset: preset,
    });

    this.trackVoice(voice);
  }

  /** Confirmed jump whoosh, scaled by approach speed. */
  playJump(speed: number): void {
    this.playWhooshCue(speed, 0.18, 620, 980, 0.18);
  }

  /** Wall jump adds a sharper push and a body thump. */
  playWallJump(surface?: string | null): void {
    this.playWhooshCue(1, 0.26, 480, 1500, 0.22);

    if (surface === "metal" || surface === "glass") {
      this.playMetalContact();
    }
  }

  /** Short gear/cloth accent for vaulting. */
  playVault(speed: number): void {
    this.playWhooshCue(speed / 8.5, 0.1, 900, 1700, 0.14);
  }

  startSlide(surface?: string | null): void {
    const context = this.context;

    if (!this.ready(context) || this.paused || this.slideLoop) {
      return;
    }

    const preset = surfaceAudioPreset(surface ?? this.lastSurface.type);

    this.slideLoop = createContactLoop(
      context,
      this.noiseBuffer("pink"),
      this.destination("parkour"),
      {
        frequency: Math.max(320, preset.noiseFrequency * 0.62),
        Q: 0.8,
        gain: 0.2,
        filterType: "bandpass",
        reverbScale: 0.1,
      },
    );
    this.slideLoop.update(0.2, preset.noiseFrequency);
  }

  stopSlide(): void {
    if (!this.slideLoop) {
      return;
    }

    this.slideLoop.stop();
    this.slideLoop = null;
  }

  startWallRun(side: "left" | "right", surface?: string | null): void {
    const context = this.context;

    if (!this.ready(context) || this.paused || this.wallRunLoop) {
      return;
    }

    const preset = surfaceAudioPreset(surface ?? this.lastSurface.type);
    const sideBias = side === "left" ? -18 : 18;

    this.wallRunLoop = createContactLoop(
      context,
      this.noiseBuffer("white"),
      this.destination("parkour"),
      {
        frequency: Math.max(480, preset.noiseFrequency * 0.5 + sideBias),
        Q: 1.4,
        gain: 0.14,
        filterType: "bandpass",
        reverbScale: 0.08,
      },
    );
    this.wallRunLoop.update(0.35, preset.noiseFrequency * 0.5 + sideBias);
  }

  stopWallRun(): void {
    if (!this.wallRunLoop) {
      return;
    }

    this.wallRunLoop.stop();
    this.wallRunLoop = null;
  }

  /** Plays a short procedural feedback cue. */
  playUiCue(cue: UiCue): void {
    const context = this.context;

    if (!this.ready(context)) {
      return;
    }

    const config = UI_CUES[cue];
    const channelVolume = config.channel === "ui" ? this.uiVolume : this.sfxVolume;
    const volume = channelVolume * (config.volume ?? 0.14);

    if (volume <= 0.0001) {
      return;
    }

    const bus = config.channel === "ui" ? "ui" : "parkour";
    const voice = renderUiTone(context, this.bus(bus), {
      frequency: config.frequency,
      duration: config.durationSeconds ?? 0.08,
      volume,
      waveform: config.waveform ?? "sine",
    });

    this.trackVoice(voice);
  }

  /**
   * Procedural radio transmission: filtered static and two signal tones with a
   * brief ambience duck. Used for the prologue's radio beats.
   */
  playRadioCue(): void {
    const context = this.context;

    if (!this.ready(context) || !this.buffers) {
      return;
    }

    const when = context.currentTime + 0.02;
    const radioBus = this.bus("radio");
    const staticVoice = renderWhoosh(
      context,
      this.buffers,
      { dry: radioBus },
      {
        when,
        intensity: 0.5,
        startFrequency: 900,
        endFrequency: 1700,
        duration: 0.26,
        gain: 0.22,
      },
    );

    this.trackVoice(staticVoice);

    for (const [index, frequency] of [880, 1180].entries()) {
      const tone = renderUiTone(context, radioBus, {
        frequency,
        duration: 0.11,
        volume: 0.1,
        waveform: "triangle",
        when: when + 0.2 + index * 0.16,
      });

      this.trackVoice(tone);
    }

    const environment = this.buses.environment;

    if (environment?.gain.setTargetAtTime) {
      const base = this.environmentGain();

      environment.gain.setTargetAtTime(base * 0.38, when, 0.08);
      environment.gain.setTargetAtTime(base, when + 0.9, 0.45);
    }
  }

  /**
   * Diagnostic probe: samples the live master signal through an AnalyserNode.
   * Presentation-only; never used by gameplay.
   */
  async measureOutput(durationMs = 1200): Promise<{
    readonly rms: number;
    readonly peak: number;
    readonly lowShare: number;
    readonly midShare: number;
    readonly highShare: number;
    readonly samples: number;
  } | null> {
    const context = this.context;
    const source = this.limiter ?? this.mixTrim;

    if (!context || !source || context.state !== "running" || !context.createAnalyser) {
      return null;
    }

    const analyser = context.createAnalyser();

    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    const timeData = new Float32Array(analyser.fftSize);
    const frequencyData = new Float32Array(analyser.frequencyBinCount);
    let peak = 0;
    let sumSquares = 0;
    let samples = 0;
    let low = 0;
    let mid = 0;
    let high = 0;
    let bands = 0;
    const started = performance.now();

    while (performance.now() - started < durationMs) {
      analyser.getFloatTimeDomainData(timeData);
      analyser.getFloatFrequencyData(frequencyData);

      for (const sample of timeData) {
        peak = Math.max(peak, Math.abs(sample));
        sumSquares += sample * sample;
        samples += 1;
      }

      let lowPower = 0;
      let midPower = 0;
      let highPower = 0;
      const binWidth = context.sampleRate / analyser.fftSize;

      for (let index = 1; index < frequencyData.length; index += 1) {
        const value = frequencyData[index] ?? -120;
        const power = 10 ** (value / 10);
        const frequency = index * binWidth;

        if (frequency < 500) {
          lowPower += power;
        } else if (frequency > 2000) {
          highPower += power;
        } else {
          midPower += power;
        }
      }

      const total = lowPower + midPower + highPower || 1;
      low += lowPower / total;
      mid += midPower / total;
      high += highPower / total;
      bands += 1;

      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    safeDisconnect(analyser);

    return {
      rms: Math.sqrt(sumSquares / Math.max(1, samples)),
      peak,
      lowShare: low / Math.max(1, bands),
      midShare: mid / Math.max(1, bands),
      highShare: high / Math.max(1, bands),
      samples,
    };
  }

  getDebugSnapshot(): {
    readonly state: AudioManagerState;
    readonly buses: Record<string, number>;
    readonly ambienceActive: boolean;
    readonly ambienceSources: number;
    readonly musicActive: boolean;
    readonly slideActive: boolean;
    readonly wallRunActive: boolean;
    readonly activeVoices: number;
    readonly paused: boolean;
    readonly profile: string | null;
    readonly surface: string;
  } {
    const buses: Record<string, number> = {};

    for (const [name, bus] of Object.entries(this.buses)) {
      buses[name] = bus?.gain.value ?? 0;
    }

    return {
      state: this.state,
      buses,
      ambienceActive: this.ambience !== null,
      ambienceSources: this.ambience?.sources.length ?? 0,
      musicActive: this.music.active,
      slideActive: this.slideLoop !== null,
      wallRunActive: this.wallRunLoop !== null,
      activeVoices: this.activeVoices.size,
      paused: this.paused,
      profile: this.ambienceProfile,
      surface: this.lastSurface.type,
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.stopAmbience();
    this.stopAllVoices();
    this.detachGestureListeners();

    const context = this.context;

    this.context = null;
    this.masterGain = null;
    this.mixTrim = null;
    this.limiter = null;
    this.buses = {};
    this.reverbSend = null;
    this.reverbReturn = null;
    this.buffers = null;

    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  private buildGraph(context: AudioContextLike): void {
    this.limiter = context.createDynamicsCompressor();
    const limiter = this.limiter as unknown as {
      threshold: AudioParamLike;
      knee: AudioParamLike;
      ratio: AudioParamLike;
      attack: AudioParamLike;
      release: AudioParamLike;
      connect: (destination: unknown) => void;
    };

    limiter.threshold.value = -16;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.2;
    limiter.connect(context.destination);

    this.masterGain = context.createGain();
    this.mixTrim = context.createGain();
    this.mixTrim.gain.value = 2.5;
    this.masterGain.connect(this.mixTrim);
    this.mixTrim.connect(this.limiter);

    for (const name of ["environment", "movement", "parkour", "ui", "music", "radio"] as const) {
      const bus = context.createGain();

      bus.connect(this.masterGain);
      this.buses[name] = bus;
    }

    const convolver = context.createConvolver();
    convolver.buffer = createImpulseBuffer(context);
    convolver.normalize = true;

    this.reverbReturn = context.createGain();
    this.reverbReturn.gain.value = 0.18;
    convolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.masterGain);

    this.reverbSend = context.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(convolver);

    this.buffers = createNoiseBuffers(context, 0x51f15e);
    this.applyVolumes();
  }

  private ready(context: AudioContextLike | null): context is AudioContextLike {
    return !this.disposed && context !== null && context.state === "running";
  }

  private destination(bus: AudioBusName): SynthDestination {
    return {
      dry: this.bus(bus),
      ...(this.reverbSend ? { reverbSend: this.reverbSend } : {}),
    };
  }

  private bus(name: AudioBusName): GainNodeLike {
    const bus = this.buses[name];

    if (!bus) {
      throw new Error(`Audio bus "${name}" is not initialized.`);
    }

    return bus;
  }

  private noiseBuffer(color: "white" | "pink" | "brown"): AudioBufferLike {
    if (!this.buffers) {
      throw new Error("Noise buffers are not initialized.");
    }

    return this.buffers[color];
  }

  private applyVolumes(): void {
    if (this.masterGain) {
      setBusGain(this.masterGain.gain, this.effectiveVolume);
    }

    const values: Record<AudioBusName, number> = {
      master: this.effectiveVolume,
      environment: this.environmentGain(),
      movement: this.sfxVolume * 0.9,
      parkour: this.sfxVolume,
      ui: this.uiVolume,
      music: this.musicGain(),
      radio: this.sfxVolume * 0.8,
    };

    for (const [name, bus] of Object.entries(this.buses)) {
      if (bus && name in values) {
        setBusGain(bus.gain, values[name as AudioBusName]);
      }
    }
  }

  private environmentGain(): number {
    return this.sfxVolume * (this.paused ? 0.28 : 0.8);
  }

  private musicGain(): number {
    return this.musicVolume * (this.paused ? 0.18 : 0.42);
  }

  private startAmbienceNodes(): void {
    const profile = this.ambienceProfile;
    const context = this.context;
    const environment = this.buses.environment;

    if (
      this.disposed ||
      !profile ||
      !context ||
      context.state !== "running" ||
      !environment ||
      this.ambience ||
      !this.buffers
    ) {
      return;
    }

    const settings = AMBIENCE_PROFILES[profile];
    const sources: AudioBufferSourceNodeLike[] = [];
    const oscillators: OscillatorNodeLike[] = [];
    const nodes: AudioNodeLike[] = [];

    const createNoiseLayer = (
      buffer: AudioBufferLike,
      filterType: string,
      frequency: number,
      Q: number,
      gainValue: number,
    ): {
      gain: GainNodeLike;
      filter: {
        frequency: {
          value: number;
          setTargetAtTime?: (value: number, time: number, constant: number) => void;
        };
      };
    } => {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();

      source.buffer = buffer;
      source.loop = true;
      filter.type = filterType;
      filter.frequency.value = frequency;
      filter.Q.value = Q;
      gain.gain.value = gainValue;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(environment);
      source.start();
      sources.push(source);
      nodes.push(filter, gain);

      return { gain, filter };
    };

    const wind = createNoiseLayer(
      this.noiseBuffer("brown"),
      "lowpass",
      settings.windFilter,
      0.7,
      settings.windGain,
    );
    const city = createNoiseLayer(
      this.noiseBuffer("pink"),
      "lowpass",
      settings.cityFilter,
      0.8,
      settings.cityGain,
    );
    const air = createNoiseLayer(this.noiseBuffer("pink"), "highpass", 2400, 0.6, settings.airGain);

    const humGain = context.createGain();

    humGain.gain.value = 0.0014;
    humGain.connect(environment);
    nodes.push(humGain);

    for (const frequency of [55, 82.4]) {
      const oscillator = context.createOscillator();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(humGain);
      oscillator.start();
      oscillators.push(oscillator);
    }

    this.ambience = {
      sources,
      oscillators,
      nodes,
      windGain: wind.gain,
      windFilter: wind.filter,
      cityGain: city.gain,
      cityFilter: city.filter,
      airGain: air.gain,
      humGain,
    };
  }

  private stopAmbienceNodes(): void {
    const ambience = this.ambience;

    if (!ambience) {
      return;
    }

    this.ambience = null;

    for (const source of ambience.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }

      safeDisconnect(source);
    }

    for (const oscillator of ambience.oscillators) {
      safeStopOscillator(oscillator);
      safeDisconnect(oscillator);
    }

    for (const node of ambience.nodes) {
      safeDisconnect(node);
    }
  }

  private updateAmbience(state: AudioMovementState): void {
    const ambience = this.ambience;
    const context = this.context;

    if (!ambience || !context) {
      return;
    }

    const now = context.currentTime;
    const speedRatio = Math.min(1, Math.max(0, state.speed) / 8.5);
    const breath = Math.sin(this.elapsedSeconds * 0.35) * 0.0035;
    const pauseScale = state.paused ? 0.3 : 1;
    const altitude = Number.isFinite(state.altitude) ? (state.altitude ?? 0) : 0;
    const altitudeRatio = Math.min(1, Math.max(0, (altitude - 1.5) / 6));
    const windTarget =
      (0.012 + speedRatio * 0.014 + breath * 0.5 + altitudeRatio * 0.012) * pauseScale;
    const windCutoff = 250 + speedRatio * 340 + altitudeRatio * 220;

    ambience.windGain.gain.setTargetAtTime?.(windTarget, now, 0.25);
    ambience.windFilter.frequency.setTargetAtTime?.(windCutoff, now, 0.35);

    if (!ambience.windGain.gain.setTargetAtTime) {
      ambience.windGain.gain.value = windTarget;
    }

    if (!ambience.windFilter.frequency.setTargetAtTime) {
      ambience.windFilter.frequency.value = windCutoff;
    }
  }

  private updateLoops(state: AudioMovementState): void {
    if (state.paused) {
      this.stopSlide();
      this.stopWallRun();

      return;
    }

    if (state.stance === "sliding") {
      if (!this.slideLoop) {
        this.startSlide(state.surface);
      }

      const preset = surfaceAudioPreset(state.surface);
      const intensity = Math.min(1, state.speed / 8.5);

      this.slideLoop?.update(
        intensity,
        Math.max(300, preset.noiseFrequency * 0.7 + state.speed * 18),
      );
    } else {
      this.stopSlide();
    }

    if (state.wallRunSide) {
      if (!this.wallRunLoop) {
        this.startWallRun(state.wallRunSide, state.surface);
      }

      const preset = surfaceAudioPreset(state.surface);
      const intensity = Math.min(1, state.speed / 8.5);

      this.wallRunLoop?.update(
        intensity,
        Math.max(460, preset.noiseFrequency * 0.5 + state.speed * 12),
      );
    } else {
      this.stopWallRun();
    }
  }

  private startMusic(): void {
    const context = this.context;

    if (!this.ready(context) || this.music.active || !this.ambienceProfile) {
      return;
    }

    this.music.active = true;
    this.music.chordIndex = 0;
    this.music.nextChordTime = context.currentTime + 0.6;
    this.music.nextArpTime = context.currentTime + 1.1;
    this.music.arpStep = 0;
    this.applyVolumes();
  }

  private stopMusic(): void {
    this.music.active = false;

    for (const voice of [...this.musicVoices]) {
      this.releaseVoice(voice);
    }

    this.musicVoices.clear();
  }

  private updateMusic(state: AudioMovementState): void {
    const context = this.context;

    if (!this.music.active || !this.ready(context) || !this.ambienceProfile) {
      return;
    }

    if (state.paused) {
      return;
    }

    const now = context.currentTime;
    const horizon = now + 0.2;

    while (this.music.nextChordTime <= horizon) {
      const when = this.music.nextChordTime;
      const chord = CHORDS[this.music.chordIndex % CHORDS.length] ?? CHORDS[0];

      if (chord) {
        this.scheduleChord(chord, when);
      }

      this.music.chordIndex += 1;
      this.music.nextChordTime += 6.4;
    }

    const intensity = Math.min(1, Math.max(0, state.speed) / 8.5);

    if (state.speed > 2.2) {
      const stride = 0.34;

      while (this.music.nextArpTime <= horizon) {
        const chord = CHORDS[this.music.chordIndex % CHORDS.length] ?? CHORDS[0];
        const note = chord?.[(this.music.arpStep + 1) % chord.length];

        if (note !== undefined) {
          this.scheduleArp(note * 2, this.music.nextArpTime, intensity);
        }

        this.music.arpStep += 1;
        this.music.nextArpTime += stride;
      }
    } else {
      this.music.nextArpTime = Math.max(this.music.nextArpTime, context.currentTime + 0.4);
    }

    const musicBus = this.buses.music;

    if (musicBus) {
      const target = this.musicGain() * (0.75 + intensity * 0.35);
      musicBus.gain.setTargetAtTime?.(target, now, 0.6);
    }
  }

  private scheduleChord(chord: readonly number[], when: number): void {
    const context = this.context;

    if (!context) {
      return;
    }

    const musicBus = this.buses.music;

    if (!musicBus) {
      return;
    }

    const filter = context.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 640;
    filter.Q.value = 0.6;
    filter.connect(musicBus);

    const voiceNodes: AudioNodeLike[] = [filter];
    const oscillators: OscillatorNodeLike[] = [];

    for (const [index, frequency] of chord.entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = index % 2 === 0 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.0001;
      gain.gain.setValueAtTime?.(0.0001, when);
      gain.gain.linearRampToValueAtTime?.(0.012, when + 1.3);
      gain.gain.linearRampToValueAtTime?.(0.008, when + 4.6);
      gain.gain.linearRampToValueAtTime?.(0.0001, when + 6.2);
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start(when);
      oscillator.stop(when + 6.4);
      oscillators.push(oscillator);
      voiceNodes.push(gain);
    }

    const voice: SynthVoice = {
      endTime: when + 6.6,
      nodes: voiceNodes,
      sources: [],
      oscillators,
    };

    this.musicVoices.add(voice);
    this.trackVoice(voice, false);
  }

  private scheduleArp(frequency: number, when: number, intensity: number): void {
    const context = this.context;

    if (!context) {
      return;
    }

    const musicBus = this.buses.music;

    if (!musicBus) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.0001;
    gain.gain.setValueAtTime?.(0.0001, when);
    gain.gain.linearRampToValueAtTime?.(0.007 + intensity * 0.006, when + 0.006);
    gain.gain.exponentialRampToValueAtTime?.(0.0001, when + 0.24);
    gain.gain.setValueAtTime?.(0, when + 0.28);
    oscillator.connect(gain);
    gain.connect(musicBus);
    oscillator.start(when);
    oscillator.stop(when + 0.32);

    const voice: SynthVoice = {
      endTime: when + 0.35,
      nodes: [gain],
      sources: [],
      oscillators: [oscillator],
    };

    this.musicVoices.add(voice);
    this.trackVoice(voice, false);
  }

  private playWhooshCue(
    speed: number,
    gain: number,
    startFrequency: number,
    endFrequency: number,
    duration: number,
  ): void {
    const context = this.context;

    if (!this.ready(context) || this.paused || !this.buffers) {
      return;
    }

    if (!this.reserveVoice(2)) {
      return;
    }

    const voice = renderWhoosh(context, this.buffers, this.destination("parkour"), {
      when: context.currentTime + 0.002,
      intensity: Math.max(0.35, Math.min(1, speed / 8.5)),
      startFrequency,
      endFrequency,
      duration,
      gain,
    });

    this.trackVoice(voice);
  }

  private playMetalContact(): void {
    const context = this.context;

    if (!this.ready(context)) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const when = context.currentTime + 0.01;

    oscillator.type = "triangle";
    oscillator.frequency.value = 1320;
    gain.gain.setValueAtTime?.(0.0001, when);
    gain.gain.linearRampToValueAtTime?.(0.035, when + 0.004);
    gain.gain.exponentialRampToValueAtTime?.(0.0001, when + 0.22);
    oscillator.connect(gain);
    gain.connect(this.bus("parkour"));
    oscillator.start(when);
    oscillator.stop(when + 0.26);

    this.trackVoice(
      { endTime: when + 0.3, nodes: [gain], sources: [], oscillators: [oscillator] },
      false,
    );
  }

  private reserveVoice(priority: number): boolean {
    if (this.activeVoices.size < this.voiceLimit) {
      return true;
    }

    if (priority < 2) {
      return false;
    }

    // Drop the oldest low-priority voice to make room for a landing or cue.
    const oldest = this.activeVoices.values().next().value as SynthVoice | undefined;

    if (oldest) {
      this.releaseVoice(oldest);
    }

    return true;
  }

  private trackVoice(voice: SynthVoice, cleanup = true): void {
    this.activeVoices.add(voice);

    let released = false;
    const release = (): void => {
      if (released) {
        return;
      }

      released = true;
      this.activeVoices.delete(voice);
      this.musicVoices.delete(voice);

      for (const source of voice.sources) {
        safeDisconnect(source);
      }

      for (const oscillator of voice.oscillators) {
        safeDisconnect(oscillator);
      }

      for (const node of voice.nodes) {
        safeDisconnect(node);
      }
    };

    if (cleanup) {
      for (const source of voice.sources) {
        source.onended = release;
      }
    }

    const delayMs = Math.max(50, (voice.endTime - (this.context?.currentTime ?? 0)) * 1000 + 120);
    const timer = setTimeout(release, delayMs);

    if (typeof timer === "object" && timer !== null && "unref" in timer) {
      (timer as { unref: () => void }).unref();
    }
  }

  private releaseVoice(voice: SynthVoice): void {
    for (const oscillator of voice.oscillators) {
      safeStopOscillator(oscillator);
    }

    for (const source of voice.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }

    this.activeVoices.delete(voice);
    this.musicVoices.delete(voice);

    for (const node of [...voice.nodes, ...voice.sources, ...voice.oscillators]) {
      safeDisconnect(node);
    }
  }

  private stopAllVoices(): void {
    for (const voice of [...this.activeVoices]) {
      this.releaseVoice(voice);
    }

    this.activeVoices.clear();
    this.musicVoices.clear();
  }

  private detachGestureListeners(): void {
    if (this.gestureCleanup) {
      this.gestureCleanup();
      this.gestureCleanup = null;
    }
  }
}
