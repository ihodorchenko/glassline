/**
 * Deterministic procedural noise and impulse-response generation.
 *
 * Buffers are generated once and reused by the Audio System. All functions are
 * pure and independent of Web Audio so they can be tested in Node.
 */

export type NoiseColor = "white" | "pink" | "brown";

export interface NoiseOptions {
  readonly seconds: number;
  readonly sampleRate: number;
  readonly seed?: number;
}

export interface ImpulseResponseOptions extends NoiseOptions {
  readonly decaySeconds: number;
  readonly channels?: number;
  readonly fadeInSeconds?: number;
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

function clampSample(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** Fills `target` with deterministic noise of the requested colour. */
export function fillNoise(target: Float32Array, color: NoiseColor, seed = 0x51f15e): Float32Array {
  const random = createRandom(seed);
  let pink0 = 0;
  let pink1 = 0;
  let pink2 = 0;
  let pink3 = 0;
  let pink4 = 0;
  let pink5 = 0;
  let pink6 = 0;
  let brown = 0;

  for (let index = 0; index < target.length; index += 1) {
    const white = random() * 2 - 1;

    if (color === "white") {
      target[index] = white * 0.72;
    } else if (color === "pink") {
      pink0 = 0.99886 * pink0 + white * 0.0555179;
      pink1 = 0.99332 * pink1 + white * 0.0750759;
      pink2 = 0.969 * pink2 + white * 0.153852;
      pink3 = 0.8665 * pink3 + white * 0.3104856;
      pink4 = 0.55 * pink4 + white * 0.5329522;
      pink5 = -0.7616 * pink5 - white * 0.016898;
      const value = (pink0 + pink1 + pink2 + pink3 + pink4 + pink5 + pink6 + white * 0.5362) * 0.11;

      pink6 = white * 0.115926;
      target[index] = clampSample(value * 1.35);
    } else {
      brown = (brown + 0.02 * white) / 1.02;
      target[index] = clampSample(brown * 3.2);
    }
  }

  return target;
}

/**
 * Creates a mono noise buffer. The result is deterministic for a given seed and
 * always finite and bounded to [-1, 1].
 */
export function createNoiseSamples(color: NoiseColor, options: NoiseOptions): Float32Array {
  const length = Math.max(1, Math.floor(options.seconds * options.sampleRate));

  return fillNoise(new Float32Array(length), color, options.seed ?? 0x51f15e);
}

/**
 * Creates a short stereo impulse response for the shared reverb send. The tail
 * is exponential and decorrelated per channel so the convolver produces width.
 */
export function createImpulseResponse(options: ImpulseResponseOptions): Float32Array[] {
  const channels = Math.max(1, Math.floor(options.channels ?? 2));
  const length = Math.max(1, Math.floor(options.seconds * options.sampleRate));
  const decay = Math.max(0.01, options.decaySeconds);
  const fadeIn = Math.max(0, options.fadeInSeconds ?? 0.008);
  const result: Float32Array[] = [];

  for (let channel = 0; channel < channels; channel += 1) {
    const samples = createNoiseSamples("white", {
      seconds: options.seconds,
      sampleRate: options.sampleRate,
      seed: (options.seed ?? 0x1a2b3c) + channel * 7919,
    });

    for (let index = 0; index < length; index += 1) {
      const time = index / options.sampleRate;
      const envelope = Math.exp(-time / decay);
      const attack = fadeIn <= 0 ? 1 : Math.min(1, time / fadeIn);
      const early = index < options.sampleRate * 0.06 ? 1.8 : 1;

      samples[index] = clampSample((samples[index] ?? 0) * envelope * attack * early);
    }

    result.push(samples);
  }

  return result;
}

/** Converts a mono sample array into a Web-Audio-compatible channel pair. */
export function toStereo(samples: Float32Array): Float32Array[] {
  return [samples, samples.slice()];
}
