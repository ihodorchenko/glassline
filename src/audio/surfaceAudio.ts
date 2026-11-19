import type { SurfaceType } from "../levels/LevelTypes";

export type AudioSurfaceType = SurfaceType | "fallback";

/**
 * Synthesis parameters for one surface family. Values are presentation-only and
 * are not inferred from visual material names; callers pass the SurfaceRegistry
 * classification.
 */
export interface SurfaceAudioPreset {
  readonly type: AudioSurfaceType;
  /** Band-pass centre for the noise transient (Hz). */
  readonly noiseFrequency: number;
  readonly noiseQ: number;
  readonly noiseGain: number;
  /** Low body thump frequency (Hz). */
  readonly impactFrequency: number;
  readonly impactGain: number;
  readonly decaySeconds: number;
  /** Optional metallic/glass ring. */
  readonly tonalFrequency?: number;
  readonly tonalGain?: number;
  readonly tonalDecaySeconds?: number;
  /** High-frequency "tick" for glass or pebbles for asphalt. */
  readonly tickFrequency?: number;
  readonly tickGain?: number;
}

export const SURFACE_AUDIO_PRESETS: Readonly<Record<AudioSurfaceType, SurfaceAudioPreset>> = {
  concrete: {
    type: "concrete",
    noiseFrequency: 880,
    noiseQ: 0.9,
    noiseGain: 0.3,
    impactFrequency: 92,
    impactGain: 0.24,
    decaySeconds: 0.11,
    tickFrequency: 2400,
    tickGain: 0.02,
  },
  metal: {
    type: "metal",
    noiseFrequency: 2100,
    noiseQ: 2.2,
    noiseGain: 0.28,
    impactFrequency: 138,
    impactGain: 0.2,
    decaySeconds: 0.18,
    tonalFrequency: 1180,
    tonalGain: 0.06,
    tonalDecaySeconds: 0.32,
    tickFrequency: 3100,
    tickGain: 0.03,
  },
  rubber: {
    type: "rubber",
    noiseFrequency: 520,
    noiseQ: 1.1,
    noiseGain: 0.22,
    impactFrequency: 76,
    impactGain: 0.26,
    decaySeconds: 0.085,
  },
  glass: {
    type: "glass",
    noiseFrequency: 3300,
    noiseQ: 3.4,
    noiseGain: 0.24,
    impactFrequency: 168,
    impactGain: 0.16,
    decaySeconds: 0.08,
    tonalFrequency: 2650,
    tonalGain: 0.05,
    tonalDecaySeconds: 0.24,
    tickFrequency: 4200,
    tickGain: 0.035,
  },
  asphalt: {
    type: "asphalt",
    noiseFrequency: 1280,
    noiseQ: 0.7,
    noiseGain: 0.34,
    impactFrequency: 68,
    impactGain: 0.2,
    decaySeconds: 0.1,
    tickFrequency: 1900,
    tickGain: 0.045,
  },
  fallback: {
    type: "fallback",
    noiseFrequency: 900,
    noiseQ: 1,
    noiseGain: 0.26,
    impactFrequency: 86,
    impactGain: 0.22,
    decaySeconds: 0.1,
    tickFrequency: 2200,
    tickGain: 0.02,
  },
};

const KNOWN_SURFACES = new Set<string>(["concrete", "metal", "rubber", "glass", "asphalt"]);

/** Resolves a SurfaceRegistry type to its preset, with an explicit fallback. */
export function surfaceAudioPreset(surface: string | null | undefined): SurfaceAudioPreset {
  if (surface && KNOWN_SURFACES.has(surface)) {
    return SURFACE_AUDIO_PRESETS[surface as SurfaceType];
  }

  return SURFACE_AUDIO_PRESETS.fallback;
}

/** Intensity normalization shared by footsteps and landings. */
export function normalizeImpact(value: number, maximum = 12): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, value / maximum));
}
