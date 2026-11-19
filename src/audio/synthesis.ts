import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  BiquadFilterNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
} from "./AudioTypes";
import { createNoiseSamples, type NoiseColor } from "./noise";
import type { SurfaceAudioPreset } from "./surfaceAudio";

export interface SynthVoice {
  readonly endTime: number;
  readonly nodes: AudioNodeLike[];
  readonly sources: AudioBufferSourceNodeLike[];
  readonly oscillators: OscillatorNodeLike[];
}

export interface SynthDestination {
  readonly dry: AudioNodeLike;
  readonly reverbSend?: AudioNodeLike;
}

export interface NoiseBufferSet {
  readonly white: AudioBufferLike;
  readonly pink: AudioBufferLike;
  readonly brown: AudioBufferLike;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function ramp(value: AudioParamLike, target: number, when: number): void {
  if (value.setValueAtTime) {
    value.setValueAtTime(target, when);
  } else {
    value.value = target;
  }
}

/**
 * Fast-attack / exponential-release envelope. Avoids clicks by starting and
 * ending at a tiny non-zero gain before muting the parameter.
 */
export function applyEnvelope(
  gain: AudioParamLike,
  peak: number,
  when: number,
  attackSeconds: number,
  decaySeconds: number,
): void {
  const safePeak = Math.max(0.0001, peak);
  const attack = Math.max(0.001, attackSeconds);
  const decay = Math.max(0.01, decaySeconds);

  gain.cancelScheduledValues?.(when);
  ramp(gain, 0.0001, when);
  gain.linearRampToValueAtTime?.(safePeak, when + attack);
  gain.exponentialRampToValueAtTime?.(0.0001, when + attack + decay);
  gain.setValueAtTime?.(0, when + attack + decay + 0.02);
}

function connectToDestinations(
  context: AudioContextLike,
  source: AudioNodeLike,
  destinations: SynthDestination,
  sendScale = 0.55,
): AudioNodeLike[] {
  source.connect(destinations.dry);

  if (!destinations.reverbSend) {
    return [];
  }

  const send = context.createGain();
  send.gain.value = sendScale;
  source.connect(send);
  send.connect(destinations.reverbSend);
  return [send];
}

function createNoiseSource(
  context: AudioContextLike,
  buffer: AudioBufferLike,
  when: number,
  duration: number,
): AudioBufferSourceNodeLike {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = false;
  source.onended = null;
  source.start(when);
  source.stop(when + duration + 0.02);
  return source;
}

function createBuffer(
  context: AudioContextLike,
  samples: Float32Array,
  channels = 1,
): AudioBufferLike {
  const buffer = context.createBuffer(channels, samples.length, context.sampleRate);

  for (let channel = 0; channel < channels; channel += 1) {
    buffer.getChannelData(channel).set(samples);
  }

  return buffer;
}

export function createNoiseBuffers(context: AudioContextLike, seed = 0x51f15e): NoiseBufferSet {
  const options = { seconds: 1.5, sampleRate: context.sampleRate, seed };

  return {
    white: createBuffer(context, createNoiseSamples("white", options)),
    pink: createBuffer(context, createNoiseSamples("pink", { ...options, seed: seed + 17 })),
    brown: createBuffer(context, createNoiseSamples("brown", { ...options, seed: seed + 31 })),
  };
}

export function createImpulseBuffer(context: AudioContextLike): AudioBufferLike {
  const seconds = 1.8;
  const length = Math.floor(seconds * context.sampleRate);
  const buffer = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const samples = buffer.getChannelData(channel);
    const random = (() => {
      let state = (0x1a2b3c + channel * 7919) >>> 0;

      return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };
    })();

    for (let index = 0; index < length; index += 1) {
      const time = index / context.sampleRate;
      const envelope = Math.exp(-time / 0.42);
      const attack = Math.min(1, time / 0.006);
      const white = random() * 2 - 1;

      samples[index] = white * envelope * attack * (index < context.sampleRate * 0.05 ? 1.5 : 1);
    }
  }

  return buffer;
}

function noiseColorForPreset(preset: SurfaceAudioPreset): NoiseColor {
  if (preset.type === "rubber" || preset.type === "asphalt") {
    return "pink";
  }

  return "white";
}

export interface FootstepOptions {
  readonly when: number;
  readonly intensity: number;
  readonly pan?: number;
  readonly variation?: number;
}

/** One-shot surface-aware footstep: filtered noise + body thump + optional ring. */
export function renderFootstep(
  context: AudioContextLike,
  buffers: NoiseBufferSet,
  preset: SurfaceAudioPreset,
  destination: SynthDestination,
  options: FootstepOptions,
): SynthVoice {
  const { when, intensity } = options;
  const strength = clamp01(intensity);
  const variation = options.variation ?? 0;
  const nodes: AudioNodeLike[] = [];
  const sources: AudioBufferSourceNodeLike[] = [];
  const oscillators: OscillatorNodeLike[] = [];
  const duration = preset.decaySeconds + 0.08;

  const noise = createNoiseSource(context, buffers[noiseColorForPreset(preset)], when, duration);
  const filter = context.createBiquadFilter();

  filter.type = "bandpass";
  filter.frequency.value = preset.noiseFrequency * (0.9 + variation * 0.2);
  filter.Q.value = preset.noiseQ;
  nodes.push(filter);

  const noiseGain = context.createGain();
  const noisePeak = preset.noiseGain * (0.45 + strength * 0.65);
  applyEnvelope(noiseGain.gain, noisePeak, when, 0.002, preset.decaySeconds);
  nodes.push(noiseGain);

  noise.connect(filter);
  filter.connect(noiseGain);
  nodes.push(...connectToDestinations(context, noiseGain, destination));
  sources.push(noise);

  const thump = context.createOscillator();
  const thumpGain = context.createGain();

  thump.type = "sine";
  thump.frequency.value = preset.impactFrequency * (0.94 + variation * 0.12);
  applyEnvelope(
    thumpGain.gain,
    preset.impactGain * (0.5 + strength * 0.55),
    when,
    0.004,
    preset.decaySeconds * 1.1,
  );
  thump.connect(thumpGain);
  nodes.push(...connectToDestinations(context, thumpGain, destination, 0.25));
  thump.start(when);
  thump.stop(when + duration + 0.05);
  nodes.push(thump, thumpGain);
  oscillators.push(thump);

  if (preset.tonalFrequency !== undefined && preset.tonalGain !== undefined) {
    const ring = context.createOscillator();
    const ringGain = context.createGain();

    ring.type = "triangle";
    ring.frequency.value = preset.tonalFrequency * (0.97 + variation * 0.06);
    applyEnvelope(
      ringGain.gain,
      preset.tonalGain * (0.4 + strength * 0.7),
      when,
      0.003,
      preset.tonalDecaySeconds ?? 0.2,
    );
    ring.connect(ringGain);
    nodes.push(...connectToDestinations(context, ringGain, destination, 0.5));
    ring.start(when);
    ring.stop(when + (preset.tonalDecaySeconds ?? 0.2) + 0.1);
    nodes.push(ring, ringGain);
    oscillators.push(ring);
  }

  const texture = createNoiseSource(context, buffers.white, when, 0.07);
  const textureFilter = context.createBiquadFilter();
  const textureGain = context.createGain();

  textureFilter.type = "highpass";
  textureFilter.frequency.value = 2600;
  textureFilter.Q.value = 0.7;
  applyEnvelope(textureGain.gain, preset.noiseGain * (0.22 + strength * 0.3), when, 0.001, 0.055);
  texture.connect(textureFilter);
  textureFilter.connect(textureGain);
  nodes.push(textureFilter, textureGain);
  nodes.push(...connectToDestinations(context, textureGain, destination, 0.35));
  sources.push(texture);

  if (preset.tickFrequency !== undefined && preset.tickGain !== undefined) {
    const tick = context.createOscillator();
    const tickGain = context.createGain();

    tick.type = "square";
    tick.frequency.value = preset.tickFrequency;
    applyEnvelope(tickGain.gain, preset.tickGain * strength, when, 0.001, 0.035);
    tick.connect(tickGain);
    nodes.push(...connectToDestinations(context, tickGain, destination, 0.3));
    tick.start(when);
    tick.stop(when + 0.08);
    nodes.push(tick, tickGain);
    oscillators.push(tick);
  }

  return { endTime: when + duration + 0.1, nodes, sources, oscillators };
}

export interface LandingOptions {
  readonly when: number;
  readonly impactSpeed: number;
  readonly surfacePreset: SurfaceAudioPreset;
}

/** Impact-scaled landing: broad noise, low body and surface ring. */
export function renderLanding(
  context: AudioContextLike,
  buffers: NoiseBufferSet,
  destination: SynthDestination,
  options: LandingOptions,
): SynthVoice {
  const strength = clamp01(options.impactSpeed / 12);
  const when = options.when;
  const nodes: AudioNodeLike[] = [];
  const sources: AudioBufferSourceNodeLike[] = [];
  const oscillators: OscillatorNodeLike[] = [];
  const decay = 0.16 + strength * 0.18;

  const noise = createNoiseSource(context, buffers.white, when, decay + 0.1);
  const filter = context.createBiquadFilter();

  filter.type = "lowpass";
  filter.frequency.value = 900 + strength * 1200;
  filter.Q.value = 0.7;
  nodes.push(filter);

  const noiseGain = context.createGain();
  applyEnvelope(noiseGain.gain, 0.22 + strength * 0.34, when, 0.002, decay);
  nodes.push(noiseGain);
  noise.connect(filter);
  filter.connect(noiseGain);
  nodes.push(...connectToDestinations(context, noiseGain, destination));
  sources.push(noise);

  const thump = context.createOscillator();
  const thumpGain = context.createGain();

  thump.type = "sine";
  thump.frequency.value = options.surfacePreset.impactFrequency * (0.8 + strength * 0.25);
  applyEnvelope(thumpGain.gain, 0.28 + strength * 0.4, when, 0.003, decay * 1.2);
  thump.connect(thumpGain);
  nodes.push(...connectToDestinations(context, thumpGain, destination, 0.3));
  thump.start(when);
  thump.stop(when + decay + 0.15);
  nodes.push(thump, thumpGain);
  oscillators.push(thump);

  if (options.surfacePreset.tonalFrequency !== undefined) {
    const ring = context.createOscillator();
    const ringGain = context.createGain();

    ring.type = "triangle";
    ring.frequency.value = options.surfacePreset.tonalFrequency;
    applyEnvelope(ringGain.gain, 0.04 + strength * 0.08, when, 0.002, 0.34);
    ring.connect(ringGain);
    nodes.push(...connectToDestinations(context, ringGain, destination, 0.6));
    ring.start(when);
    ring.stop(when + 0.42);
    nodes.push(ring, ringGain);
    oscillators.push(ring);
  }

  return { endTime: when + decay + 0.2, nodes, sources, oscillators };
}

/** Short air/gear whoosh used by jumps, wall jumps, and vaults. */
export function renderWhoosh(
  context: AudioContextLike,
  buffers: NoiseBufferSet,
  destination: SynthDestination,
  options: {
    readonly when: number;
    readonly intensity: number;
    readonly startFrequency: number;
    readonly endFrequency: number;
    readonly duration: number;
    readonly gain: number;
  },
): SynthVoice {
  const nodes: AudioNodeLike[] = [];
  const sources: AudioBufferSourceNodeLike[] = [];
  const noise = createNoiseSource(context, buffers.pink, options.when, options.duration);
  const filter = context.createBiquadFilter();

  filter.type = "bandpass";
  filter.frequency.value = options.startFrequency;
  filter.Q.value = 0.8;
  filter.frequency.linearRampToValueAtTime?.(options.endFrequency, options.when + options.duration);
  nodes.push(filter);

  const gain = context.createGain();
  applyEnvelope(
    gain.gain,
    options.gain * clamp01(options.intensity),
    options.when,
    0.02,
    options.duration,
  );
  nodes.push(gain);
  noise.connect(filter);
  filter.connect(gain);
  nodes.push(...connectToDestinations(context, gain, destination, 0.4));
  sources.push(noise);

  return { endTime: options.when + options.duration + 0.1, nodes, sources, oscillators: [] };
}

export interface LoopVoice {
  readonly source: AudioBufferSourceNodeLike;
  readonly filter: BiquadFilterNodeLike;
  readonly gain: GainNodeLike;
  update(intensity: number, frequency: number): void;
  stop(): void;
}

/** Continuous filtered-noise loop used by slide and wall-run contact. */
export function createContactLoop(
  context: AudioContextLike,
  buffer: AudioBufferLike,
  destination: SynthDestination,
  options: {
    readonly frequency: number;
    readonly Q: number;
    readonly gain: number;
    readonly filterType?: "bandpass" | "lowpass" | "highpass";
    readonly reverbScale?: number;
  },
): LoopVoice {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = buffer;
  source.loop = true;
  filter.type = options.filterType ?? "bandpass";
  filter.frequency.value = options.frequency;
  filter.Q.value = options.Q;
  gain.gain.value = 0.0001;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination.dry);

  if (destination.reverbSend) {
    const send = context.createGain();
    send.gain.value = options.reverbScale ?? 0.15;
    gain.connect(send);
    send.connect(destination.reverbSend);
  }

  source.start();

  return {
    source,
    filter,
    gain,
    update(intensity, frequency) {
      const safeIntensity = clamp01(intensity);
      const targetGain = options.gain * (0.15 + safeIntensity * 0.85);

      if (gain.gain.setTargetAtTime) {
        gain.gain.setTargetAtTime(targetGain, context.currentTime, 0.08);
      } else {
        gain.gain.value = targetGain;
      }

      if (filter.frequency.setTargetAtTime) {
        filter.frequency.setTargetAtTime(frequency, context.currentTime, 0.1);
      } else {
        filter.frequency.value = frequency;
      }
    },
    stop() {
      const now = context.currentTime;

      gain.gain.cancelScheduledValues?.(now);
      gain.gain.setTargetAtTime?.(0.0001, now, 0.04);
      source.stop(now + 0.12);

      if (!gain.gain.setTargetAtTime) {
        gain.gain.value = 0;
      }
    },
  };
}

/** Short, readable UI tone with a soft attack and decay. */
export function renderUiTone(
  context: AudioContextLike,
  destination: AudioNodeLike,
  options: {
    readonly frequency: number;
    readonly duration: number;
    readonly volume: number;
    readonly waveform?: string;
    readonly when?: number;
  },
): SynthVoice {
  const when = options.when ?? context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = options.waveform ?? "sine";
  oscillator.frequency.value = options.frequency;
  applyEnvelope(gain.gain, options.volume, when, 0.006, options.duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(when);
  oscillator.stop(when + options.duration + 0.06);

  return {
    endTime: when + options.duration + 0.1,
    nodes: [gain],
    sources: [],
    oscillators: [oscillator],
  };
}
