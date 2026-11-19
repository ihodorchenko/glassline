import { describe, expect, it } from "vitest";

import { createImpulseResponse, createNoiseSamples, fillNoise } from "../../src/audio/noise";
import {
  normalizeImpact,
  SURFACE_AUDIO_PRESETS,
  surfaceAudioPreset,
} from "../../src/audio/surfaceAudio";
import {
  createContactLoop,
  createImpulseBuffer,
  createNoiseBuffers,
  renderFootstep,
  renderLanding,
  renderUiTone,
  renderWhoosh,
} from "../../src/audio/synthesis";
import {
  FakeAudioContext,
  type FakeBufferSource,
  type FakeGain,
} from "../helpers/fakeAudioContext";

describe("procedural noise", () => {
  it("is deterministic for a seed and bounded", () => {
    const first = createNoiseSamples("pink", { seconds: 0.5, sampleRate: 8000, seed: 42 });
    const second = createNoiseSamples("pink", { seconds: 0.5, sampleRate: 8000, seed: 42 });
    const other = createNoiseSamples("pink", { seconds: 0.5, sampleRate: 8000, seed: 43 });

    expect(first.length).toBe(4000);
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(Array.from(first)).not.toEqual(Array.from(other));
    expect(first.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 1)).toBe(true);
  });

  it("produces non-silent white, pink, and brown noise", () => {
    for (const color of ["white", "pink", "brown"] as const) {
      const samples = createNoiseSamples(color, { seconds: 0.25, sampleRate: 8000, seed: 7 });
      const rms = Math.sqrt(
        samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length,
      );

      expect(rms).toBeGreaterThan(0.005);
    }
  });

  it("supports filling an existing buffer", () => {
    const target = new Float32Array(128);

    fillNoise(target, "brown", 3);

    expect(target.some((sample) => sample !== 0)).toBe(true);
  });

  it("creates a stereo impulse response with a decaying tail", () => {
    const channels = createImpulseResponse({
      seconds: 0.4,
      sampleRate: 8000,
      decaySeconds: 0.15,
      seed: 11,
    });

    expect(channels).toHaveLength(2);
    expect(channels[0]?.length).toBe(3200);

    const head = Math.abs(channels[0]?.[20] ?? 0);
    const tail = Math.abs(channels[0]?.[3000] ?? 0);

    expect(head).toBeGreaterThan(tail);
    expect(channels[0]?.[0]).toBe(0);
  });
});

describe("surface audio presets", () => {
  it("maps every SurfaceType and falls back explicitly", () => {
    expect(surfaceAudioPreset("concrete").type).toBe("concrete");
    expect(surfaceAudioPreset("metal").type).toBe("metal");
    expect(surfaceAudioPreset("rubber").type).toBe("rubber");
    expect(surfaceAudioPreset("glass").type).toBe("glass");
    expect(surfaceAudioPreset("asphalt").type).toBe("asphalt");
    expect(surfaceAudioPreset(null).type).toBe("fallback");
    expect(surfaceAudioPreset("unknown-material").type).toBe("fallback");
  });

  it("keeps surface presets distinct", () => {
    const frequencies = new Set(
      Object.values(SURFACE_AUDIO_PRESETS).map((preset) => preset.noiseFrequency),
    );

    expect(frequencies.size).toBeGreaterThanOrEqual(5);
  });

  it("normalizes impact speed into a clamped 0..1 range", () => {
    expect(normalizeImpact(-2)).toBe(0);
    expect(normalizeImpact(0)).toBe(0);
    expect(normalizeImpact(6)).toBeCloseTo(0.5, 5);
    expect(normalizeImpact(99)).toBe(1);
  });
});

describe("synthesis voices", () => {
  it("renders a surface footstep into dry and reverb destinations", () => {
    const context = new FakeAudioContext();
    const buffers = createNoiseBuffers(context);
    const dry = context.createGain() as FakeGain;
    const reverb = context.createGain() as FakeGain;
    const beforeFilters = context.filters.length;

    const voice = renderFootstep(
      context,
      buffers,
      SURFACE_AUDIO_PRESETS.metal,
      {
        dry,
        reverbSend: reverb,
      },
      {
        when: 0.1,
        intensity: 0.9,
        variation: 0.5,
      },
    );

    expect(voice.sources.length).toBe(2);
    expect(voice.oscillators.length).toBeGreaterThanOrEqual(2);
    expect(context.filters.length).toBeGreaterThan(beforeFilters);
    expect(context.filters.at(-1)?.frequency.value).toBeGreaterThan(1500);
    expect(context.gains.some((gain) => gain.connections.includes(dry))).toBe(true);
    expect(context.gains.some((gain) => gain.connections.includes(reverb))).toBe(true);
  });

  it("scales a landing with impact speed", () => {
    const context = new FakeAudioContext();
    const buffers = createNoiseBuffers(context);
    const dry = context.createGain();
    const soft = renderLanding(
      context,
      buffers,
      { dry },
      {
        when: 0.1,
        impactSpeed: 2,
        surfacePreset: SURFACE_AUDIO_PRESETS.concrete,
      },
    );
    const hard = renderLanding(
      context,
      buffers,
      { dry },
      {
        when: 0.4,
        impactSpeed: 12,
        surfacePreset: SURFACE_AUDIO_PRESETS.concrete,
      },
    );

    expect(soft.sources.length).toBe(1);
    expect(hard.endTime).toBeGreaterThan(soft.endTime);
  });

  it("creates a looping contact voice that stops", () => {
    const context = new FakeAudioContext();
    const buffers = createNoiseBuffers(context);
    const dry = context.createGain();
    const loop = createContactLoop(
      context,
      buffers.white,
      { dry },
      {
        frequency: 700,
        Q: 1,
        gain: 0.2,
      },
    );

    expect(loop.source.loop).toBe(true);
    expect((loop.source as FakeBufferSource).startCount).toBe(1);

    loop.update(0.8, 900);
    expect(loop.filter.frequency.value).toBe(900);

    loop.stop();
    expect((loop.source as FakeBufferSource).stopCount).toBe(1);
  });

  it("renders an envelope-shaped whoosh and UI tone", () => {
    const context = new FakeAudioContext();
    const buffers = createNoiseBuffers(context);
    const dry = context.createGain();
    const whoosh = renderWhoosh(
      context,
      buffers,
      { dry },
      {
        when: 0.1,
        intensity: 1,
        startFrequency: 600,
        endFrequency: 1200,
        duration: 0.2,
        gain: 0.2,
      },
    );

    expect(whoosh.sources.length).toBe(1);
    expect(context.filters.at(-1)?.frequency.value).toBe(1200);

    const tone = renderUiTone(context, dry, {
      frequency: 880,
      duration: 0.1,
      volume: 0.1,
    });

    expect(tone.oscillators.length).toBe(1);
    expect(context.oscillators.at(-1)?.frequency.value).toBe(880);
  });

  it("creates a two-channel impulse buffer", () => {
    const context = new FakeAudioContext();
    const buffer = createImpulseBuffer(context);

    expect(buffer.numberOfChannels).toBe(2);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
