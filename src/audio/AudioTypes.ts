/**
 * Structural Web Audio contracts used by the Audio System.
 *
 * They intentionally model only the API surface Glassline uses, so the manager
 * and synthesis helpers can be unit-tested with deterministic fakes.
 */

export interface AudioParamLike {
  value: number;
  setValueAtTime?(value: number, time: number): void;
  linearRampToValueAtTime?(value: number, time: number): void;
  exponentialRampToValueAtTime?(value: number, time: number): void;
  setTargetAtTime?(value: number, time: number, timeConstant: number): void;
  cancelScheduledValues?(time: number): void;
}

export interface AudioNodeLike {
  connect(destination: unknown): void;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
  readonly detune?: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
  onended?: (() => void) | null;
}

export interface AudioBufferLike {
  readonly length: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  readonly playbackRate: AudioParamLike;
  start(when?: number, offset?: number, duration?: number): void;
  stop(when?: number): void;
  onended?: (() => void) | null;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
  readonly Q: AudioParamLike;
  readonly gain: AudioParamLike;
}

export interface ConvolverNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  normalize: boolean;
}

export interface DynamicsCompressorNodeLike extends AudioNodeLike {
  readonly threshold: AudioParamLike;
  readonly knee: AudioParamLike;
  readonly ratio: AudioParamLike;
  readonly attack: AudioParamLike;
  readonly release: AudioParamLike;
}

export interface StereoPannerNodeLike extends AudioNodeLike {
  readonly pan: AudioParamLike;
}

export interface AnalyserNodeLike extends AudioNodeLike {
  fftSize: number;
  readonly frequencyBinCount: number;
  smoothingTimeConstant: number;
  getFloatTimeDomainData(target: Float32Array): void;
  getFloatFrequencyData(target: Float32Array): void;
}

export interface AudioContextLike {
  readonly state: "suspended" | "running" | "closed" | "interrupted";
  readonly destination: unknown;
  readonly currentTime: number;
  readonly sampleRate: number;
  resume(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createConvolver(): ConvolverNodeLike;
  createDynamicsCompressor(): DynamicsCompressorNodeLike;
  createStereoPanner?(): StereoPannerNodeLike;
  createAnalyser?(): AnalyserNodeLike;
}

export type AudioContextFactory = () => AudioContextLike | null;

export type AudioBusName =
  | "master"
  | "environment"
  | "movement"
  | "parkour"
  | "ui"
  | "music"
  | "radio";

export interface AudioMovementState {
  readonly speed: number;
  readonly grounded: boolean;
  readonly stance: "standing" | "crouching" | "sliding";
  readonly wallRunSide: "left" | "right" | null;
  readonly surface: string | null;
  readonly paused: boolean;
  /** Player centre height, used to make high-roof wind stronger. */
  readonly altitude?: number;
}
