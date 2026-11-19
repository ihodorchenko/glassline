import { AudioManager } from "../../src/audio/AudioManager";
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  BiquadFilterNodeLike,
  ConvolverNodeLike,
  DynamicsCompressorNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
} from "../../src/audio/AudioTypes";

export class FakeParam implements AudioParamLike {
  value: number;
  readonly events: string[] = [];

  constructor(value = 0) {
    this.value = value;
  }

  setValueAtTime(value: number): void {
    this.value = value;
    this.events.push("set");
  }

  linearRampToValueAtTime(value: number): void {
    this.value = value;
    this.events.push("linear");
  }

  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
    this.events.push("exponential");
  }

  setTargetAtTime(value: number): void {
    this.value = value;
    this.events.push("target");
  }

  cancelScheduledValues(): void {
    this.events.push("cancel");
  }
}

export class FakeNode implements AudioNodeLike {
  readonly connections: unknown[] = [];
  disconnectCount = 0;

  connect(destination: unknown): void {
    this.connections.push(destination);
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }
}

export class FakeGain extends FakeNode implements GainNodeLike {
  readonly gain = new FakeParam();
}

export class FakeOscillator extends FakeNode implements OscillatorNodeLike {
  type = "sine";
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);
  startCount = 0;
  stopCount = 0;
  onended: (() => void) | null = null;

  start(): void {
    this.startCount += 1;
  }

  stop(): void {
    this.stopCount += 1;
  }
}

export class FakeBuffer implements AudioBufferLike {
  readonly channels: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel] ?? new Float32Array(this.length);
  }
}

export class FakeBufferSource extends FakeNode implements AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null = null;
  loop = false;
  readonly playbackRate = new FakeParam(1);
  startCount = 0;
  stopCount = 0;
  onended: (() => void) | null = null;

  start(): void {
    this.startCount += 1;
  }

  stop(): void {
    this.stopCount += 1;
    this.onended?.();
  }
}

export class FakeFilter extends FakeNode implements BiquadFilterNodeLike {
  type = "lowpass";
  readonly frequency = new FakeParam(1000);
  readonly Q = new FakeParam(1);
  readonly gain = new FakeParam(0);
}

export class FakeConvolver extends FakeNode implements ConvolverNodeLike {
  buffer: AudioBufferLike | null = null;
  normalize = true;
}

export class FakeCompressor extends FakeNode implements DynamicsCompressorNodeLike {
  readonly threshold = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();
}

export class FakeAudioContext implements AudioContextLike {
  state: "suspended" | "running" | "closed" | "interrupted" = "suspended";
  readonly destination: unknown = {};
  currentTime = 0;
  readonly sampleRate = 48000;
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];
  readonly bufferSources: FakeBufferSource[] = [];
  readonly filters: FakeFilter[] = [];
  readonly convolvers: FakeConvolver[] = [];
  readonly compressors: FakeCompressor[] = [];
  resumeCount = 0;
  closeCount = 0;

  createGain(): GainNodeLike {
    const gain = new FakeGain();

    this.gains.push(gain);

    return gain;
  }

  createOscillator(): OscillatorNodeLike {
    const oscillator = new FakeOscillator();

    this.oscillators.push(oscillator);

    return oscillator;
  }

  createBufferSource(): AudioBufferSourceNodeLike {
    const source = new FakeBufferSource();

    this.bufferSources.push(source);

    return source;
  }

  createBiquadFilter(): BiquadFilterNodeLike {
    const filter = new FakeFilter();

    this.filters.push(filter);

    return filter;
  }

  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike {
    return new FakeBuffer(channels, length, sampleRate);
  }

  createConvolver(): ConvolverNodeLike {
    const convolver = new FakeConvolver();

    this.convolvers.push(convolver);

    return convolver;
  }

  createDynamicsCompressor(): DynamicsCompressorNodeLike {
    const compressor = new FakeCompressor();

    this.compressors.push(compressor);

    return compressor;
  }

  async resume(): Promise<void> {
    this.resumeCount += 1;
    this.state = "running";
  }

  async close(): Promise<void> {
    this.closeCount += 1;
    this.state = "closed";
  }
}

export function createRunningManager(): { context: FakeAudioContext; manager: AudioManager } {
  const context = new FakeAudioContext();
  const manager = new AudioManager({ factory: () => context, gestureTarget: null });

  return { context, manager };
}
