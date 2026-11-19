import type { AudioContextLike, AudioNodeLike, GainNodeLike } from "./AudioTypes";
import { SURFACE_AUDIO_PRESETS, type SurfaceAudioPreset } from "./surfaceAudio";
import {
  applyEnvelope,
  createImpulseBuffer,
  createNoiseBuffers,
  renderFootstep,
  renderLanding,
  renderWhoosh,
} from "./synthesis";

export interface AudioDemoResult {
  readonly wavBase64: string;
  readonly sampleRate: number;
  readonly durationSeconds: number;
  readonly peak: number;
  readonly rms: number;
}

interface OfflineContextConstructor {
  new (
    channels: number,
    length: number,
    sampleRate: number,
  ): AudioContextLike & {
    startRendering(): Promise<AudioBuffer>;
  };
}

function getOfflineContext(): OfflineContextConstructor | null {
  const globalWithOffline = globalThis as typeof globalThis & {
    OfflineAudioContext?: OfflineContextConstructor;
    webkitOfflineAudioContext?: OfflineContextConstructor;
  };

  return (
    globalWithOffline.OfflineAudioContext ?? globalWithOffline.webkitOfflineAudioContext ?? null
  );
}

function encodeWav(channels: readonly Float32Array[], sampleRate: number): string {
  const frameCount = channels[0]?.length ?? 0;
  const channelCount = channels.length;
  const bytesPerSample = 2;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;

  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const source = channels[channel];
      const sample = Math.max(-1, Math.min(1, source?.[frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

function wireBus(context: AudioContextLike, master: AudioNodeLike): Record<string, GainNodeLike> {
  const buses: Record<string, GainNodeLike> = {};

  for (const [name, gain] of [
    ["environment", 0.8],
    ["movement", 0.9],
    ["parkour", 1],
    ["music", 0.42],
  ] as const) {
    const bus = context.createGain();

    bus.gain.value = gain;
    bus.connect(master);
    buses[name] = bus;
  }

  return buses;
}

function scheduleFootsteps(
  context: AudioContextLike,
  buffers: ReturnType<typeof createNoiseBuffers>,
  movement: AudioNodeLike,
  reverbSend: AudioNodeLike,
  durationSeconds: number,
): void {
  const surfaces: readonly [SurfaceAudioPreset, number][] = [
    [SURFACE_AUDIO_PRESETS.concrete, 0.55],
    [SURFACE_AUDIO_PRESETS.concrete, 0.7],
    [SURFACE_AUDIO_PRESETS.metal, 0.8],
    [SURFACE_AUDIO_PRESETS.glass, 0.65],
    [SURFACE_AUDIO_PRESETS.asphalt, 0.75],
    [SURFACE_AUDIO_PRESETS.rubber, 0.5],
  ];
  let step = 0;

  for (let time = 5.6; time < durationSeconds - 2.5; time += 0.36) {
    const entry = surfaces[step % surfaces.length];

    if (!entry) {
      continue;
    }

    renderFootstep(
      context,
      buffers,
      entry[0],
      { dry: movement, reverbSend },
      {
        when: time,
        intensity: entry[1],
        variation: (step % 3) / 3,
      },
    );
    step += 1;
  }
}

function scheduleParkour(
  context: AudioContextLike,
  buffers: ReturnType<typeof createNoiseBuffers>,
  parkour: AudioNodeLike,
  reverbSend: AudioNodeLike,
): void {
  const destination = { dry: parkour, reverbSend };

  renderWhoosh(context, buffers, destination, {
    when: 9.1,
    intensity: 1,
    startFrequency: 620,
    endFrequency: 980,
    duration: 0.18,
    gain: 0.2,
  });
  renderLanding(context, buffers, destination, {
    when: 9.9,
    impactSpeed: 6,
    surfacePreset: SURFACE_AUDIO_PRESETS.concrete,
  });
  renderWhoosh(context, buffers, destination, {
    when: 18.2,
    intensity: 0.8,
    startFrequency: 900,
    endFrequency: 1700,
    duration: 0.14,
    gain: 0.14,
  });
  renderWhoosh(context, buffers, destination, {
    when: 20.4,
    intensity: 1,
    startFrequency: 480,
    endFrequency: 1500,
    duration: 0.22,
    gain: 0.24,
  });
  renderLanding(context, buffers, destination, {
    when: 21.4,
    impactSpeed: 12,
    surfacePreset: SURFACE_AUDIO_PRESETS.metal,
  });
}

function scheduleAmbience(
  context: AudioContextLike,
  buffers: ReturnType<typeof createNoiseBuffers>,
  environment: AudioNodeLike,
  reverbSend: AudioNodeLike,
): void {
  const intro = context.createGain();

  intro.gain.value = 0.09;
  intro.gain.setValueAtTime?.(0.09, 0);
  intro.gain.linearRampToValueAtTime?.(0.09, 4.0);
  intro.gain.linearRampToValueAtTime?.(1.0, 6.5);
  intro.connect(environment);

  const createIntroLayer = (
    bufferKey: "brown" | "pink",
    type: string,
    frequency: number,
    gainValue: number,
  ): void => {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = buffers[bufferKey];
    source.loop = true;
    filter.type = type;
    filter.frequency.value = frequency;
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(intro);
    source.start();
  };

  createIntroLayer("brown", "lowpass", 300, 0.016);
  createIntroLayer("pink", "lowpass", 95, 0.009);
  createIntroLayer("pink", "highpass", 2600, 0.006);

  const hum = context.createGain();

  hum.gain.value = 0.0012;
  hum.connect(intro);

  for (const frequency of [55, 82.4]) {
    const oscillator = context.createOscillator();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(hum);
    oscillator.start();
  }

  const send = context.createGain();

  send.gain.value = 0.12;
  environment.connect(send);
  send.connect(reverbSend);
}

function scheduleMusic(
  context: AudioContextLike,
  music: AudioNodeLike,
  durationSeconds: number,
): void {
  const chords = [
    [110, 164.81, 220, 261.63],
    [87.31, 130.81, 174.61, 220],
    [130.81, 196, 261.63, 329.63],
    [98, 146.83, 196, 246.94],
  ];

  for (let time = 4.4; time < durationSeconds; time += 6.4) {
    const chord = chords[Math.floor((time - 4.4) / 6.4) % chords.length];

    if (!chord) {
      continue;
    }

    const filter = context.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.connect(music);

    for (const [index, frequency] of chord.entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = index % 2 === 0 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      applyEnvelope(gain.gain, 0.012, time, 1.2, 4.8);
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start(time);
      oscillator.stop(time + 6.2);
    }
  }
}

function scheduleHighRoute(
  context: AudioContextLike,
  buffers: ReturnType<typeof createNoiseBuffers>,
  environment: AudioNodeLike,
  movement: AudioNodeLike,
  parkour: AudioNodeLike,
  reverbSend: AudioNodeLike,
  durationSeconds: number,
): void {
  // High-altitude wind bed: filtered pink/brown noise with a slow swell.
  const wind = context.createGain();

  wind.gain.value = 0.001;
  wind.gain.setValueAtTime?.(0.001, 0);
  wind.gain.linearRampToValueAtTime?.(0.024, 2.5);
  wind.gain.linearRampToValueAtTime?.(0.0006, 6.4);
  wind.gain.linearRampToValueAtTime?.(0.0006, 8.3);
  wind.gain.linearRampToValueAtTime?.(0.05, 9.2);
  wind.gain.linearRampToValueAtTime?.(0.018, 10.2);
  wind.gain.linearRampToValueAtTime?.(0.03, Math.max(11, durationSeconds * 0.85));
  wind.connect(environment);

  for (const [bufferKey, filterType, frequency, gainValue] of [
    ["brown", "highpass", 480, 0.014],
    ["pink", "bandpass", 980, 0.018],
    ["pink", "highpass", 3200, 0.004],
  ] as const) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = buffers[bufferKey];
    source.loop = true;
    filter.type = filterType;
    filter.frequency.value = frequency;
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(wind);
    source.start();
  }

  // Low structural hum and a cable-creak sweep.
  const hum = context.createGain();

  hum.gain.value = 0.002;
  hum.gain.setValueAtTime?.(0.002, 0);
  hum.gain.linearRampToValueAtTime?.(0.0004, 6.4);
  hum.gain.linearRampToValueAtTime?.(0.0004, 8.3);
  hum.gain.linearRampToValueAtTime?.(0.002, 9.2);
  hum.connect(environment);

  for (const frequency of [58, 87]) {
    const oscillator = context.createOscillator();

    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    oscillator.connect(hum);
    oscillator.start();
  }

  const creak = context.createOscillator();
  const creakGain = context.createGain();

  creak.type = "sawtooth";
  creak.frequency.setValueAtTime?.(94, 4.4);
  creak.frequency.linearRampToValueAtTime?.(68, 6.8);
  applyEnvelope(creakGain.gain, 0.001, 4.4, 0.35, 2.4);
  creak.connect(creakGain);
  creakGain.connect(environment);
  creak.start(4.4);
  creak.stop(7.0);

  // Metal catwalk cadence.
  let step = 0;

  for (let time = 1.3; time < durationSeconds - 1.2; time += 0.34) {
    if (time > 6.5 && time < 8.9) {
      continue;
    }

    renderFootstep(
      context,
      buffers,
      SURFACE_AUDIO_PRESETS.metal,
      { dry: movement, reverbSend },
      {
        when: time,
        intensity: 0.62 + (step % 3) * 0.1,
        variation: (step % 4) / 4,
      },
    );
    step += 1;
  }

  renderWhoosh(
    context,
    buffers,
    { dry: parkour, reverbSend },
    {
      when: 2.6,
      intensity: 1,
      startFrequency: 520,
      endFrequency: 1200,
      duration: 0.2,
      gain: 0.22,
    },
  );
  renderLanding(
    context,
    buffers,
    { dry: parkour, reverbSend },
    {
      when: 3.35,
      impactSpeed: 7,
      surfacePreset: SURFACE_AUDIO_PRESETS.metal,
    },
  );
  renderLanding(
    context,
    buffers,
    { dry: parkour, reverbSend },
    {
      when: 6.9,
      impactSpeed: 10,
      surfacePreset: SURFACE_AUDIO_PRESETS.metal,
    },
  );
  renderWhoosh(
    context,
    buffers,
    { dry: parkour, reverbSend },
    {
      when: 8.9,
      intensity: 0.9,
      startFrequency: 780,
      endFrequency: 1800,
      duration: 0.16,
      gain: 0.18,
    },
  );
  renderLanding(
    context,
    buffers,
    { dry: parkour, reverbSend },
    {
      when: durationSeconds - 0.9,
      impactSpeed: 12,
      surfacePreset: SURFACE_AUDIO_PRESETS.metal,
    },
  );

  const finishBoom = context.createOscillator();
  const finishGain = context.createGain();

  finishBoom.type = "sine";
  finishBoom.frequency.setValueAtTime?.(52, durationSeconds - 0.9);
  finishBoom.frequency.exponentialRampToValueAtTime?.(34, durationSeconds - 0.1);
  applyEnvelope(finishGain.gain, 0.001, durationSeconds - 0.9, 0.18, 1.6);
  finishBoom.connect(finishGain);
  finishGain.connect(parkour);
  finishBoom.start(durationSeconds - 0.9);
  finishBoom.stop(durationSeconds + 0.2);
}

async function renderScheduledDemo(
  durationSeconds: number,
  masterGain: number,
  limiterThreshold: number,
  schedule: (
    context: AudioContextLike,
    buffers: ReturnType<typeof createNoiseBuffers>,
    buses: Record<string, GainNodeLike>,
    reverbSend: AudioNodeLike,
    master: AudioNodeLike,
  ) => void,
): Promise<AudioDemoResult> {
  const OfflineContext = getOfflineContext();

  if (!OfflineContext) {
    throw new Error("OfflineAudioContext is unavailable.");
  }

  const sampleRate = 48000;
  const context = new OfflineContext(2, Math.ceil(durationSeconds * sampleRate), sampleRate);
  const audioContext = context as unknown as AudioContextLike;
  const limiter = audioContext.createDynamicsCompressor();

  limiter.threshold.value = limiterThreshold;
  limiter.knee.value = 4;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  limiter.connect(audioContext.destination);

  const master = audioContext.createGain();

  master.gain.value = masterGain;
  master.connect(limiter);

  const buses = wireBus(audioContext, master);
  const convolver = audioContext.createConvolver();

  convolver.buffer = createImpulseBuffer(audioContext);
  convolver.normalize = true;

  const reverbReturn = audioContext.createGain();

  reverbReturn.gain.value = 0.18;
  convolver.connect(reverbReturn);
  reverbReturn.connect(master);

  const reverbSend = audioContext.createGain();

  reverbSend.gain.value = 1;
  reverbSend.connect(convolver);

  const buffers = createNoiseBuffers(audioContext);

  schedule(audioContext, buffers, buses, reverbSend, master);

  const buffer = await context.startRendering();
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0);
  let peak = 0;
  let sum = 0;

  for (let index = 0; index < left.length; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;

    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sum += (l * l + r * r) * 0.5;
  }

  return {
    wavBase64: encodeWav([left, right], buffer.sampleRate),
    sampleRate: buffer.sampleRate,
    durationSeconds: buffer.duration,
    peak,
    rms: Math.sqrt(sum / left.length),
  };
}

/** Deterministic prologue mix demo (existing reference profile). */
export async function renderAudioDemo(durationSeconds = 24): Promise<AudioDemoResult> {
  return renderScheduledDemo(
    durationSeconds,
    2.15,
    -20,
    (context, buffers, buses, reverb, master) => {
      scheduleAmbience(context, buffers, buses.environment ?? master, reverb);
      scheduleFootsteps(context, buffers, buses.movement ?? master, reverb, durationSeconds);
      scheduleParkour(context, buffers, buses.parkour ?? master, reverb);
      scheduleMusic(context, buses.music ?? master, durationSeconds);
    },
  );
}

/** Deterministic high-route demo: wind, metal catwalk steps, landing/finish hits. */
export async function renderHighRouteAudioDemo(durationSeconds = 14): Promise<AudioDemoResult> {
  return renderScheduledDemo(
    durationSeconds,
    1.4,
    -18,
    (context, buffers, buses, reverb, master) => {
      scheduleHighRoute(
        context,
        buffers,
        buses.environment ?? master,
        buses.movement ?? master,
        buses.parkour ?? master,
        reverb,
        durationSeconds,
      );
    },
  );
}
