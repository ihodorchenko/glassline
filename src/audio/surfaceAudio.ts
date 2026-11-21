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
  // P3 (2026-11-21, reference spectrum pass): the reference prologue keeps
  // ~90 % of energy below 500 Hz and only ~2.5 % above 2 kHz; our offline mix
  // measured 5.6 % high share, carried by bright transients. Every preset is
  // darkened: noise band-pass centres down ~30 %, ticks down ~25 % and quieter,
  // impact thumps deeper and hotter. Character signatures (metal ring, glass
  // tonal) stay — the goal is warmth, not muting.
  concrete: {
    type: "concrete",
    noiseFrequency: 620,
    noiseQ: 0.9,
    noiseGain: 0.3,
    impactFrequency: 78,
    impactGain: 0.28,
    decaySeconds: 0.11,
    tickFrequency: 1800,
    tickGain: 0.012,
  },
  metal: {
    type: "metal",
    noiseFrequency: 1600,
    noiseQ: 2.2,
    noiseGain: 0.28,
    impactFrequency: 110,
    impactGain: 0.24,
    decaySeconds: 0.18,
    tonalFrequency: 1180,
    tonalGain: 0.06,
    tonalDecaySeconds: 0.32,
    tickFrequency: 2600,
    tickGain: 0.02,
  },
  rubber: {
    type: "rubber",
    noiseFrequency: 430,
    noiseQ: 1.1,
    noiseGain: 0.22,
    impactFrequency: 70,
    impactGain: 0.28,
    decaySeconds: 0.085,
  },
  glass: {
    type: "glass",
    noiseFrequency: 2600,
    noiseQ: 3.4,
    noiseGain: 0.24,
    impactFrequency: 150,
    impactGain: 0.18,
    decaySeconds: 0.08,
    tonalFrequency: 2650,
    tonalGain: 0.05,
    tonalDecaySeconds: 0.24,
    tickFrequency: 3400,
    tickGain: 0.028,
  },
  asphalt: {
    type: "asphalt",
    noiseFrequency: 900,
    noiseQ: 0.7,
    noiseGain: 0.34,
    impactFrequency: 62,
    impactGain: 0.24,
    decaySeconds: 0.1,
    tickFrequency: 1400,
    tickGain: 0.03,
  },
  fallback: {
    type: "fallback",
    noiseFrequency: 700,
    noiseQ: 1,
    noiseGain: 0.26,
    impactFrequency: 76,
    impactGain: 0.24,
    decaySeconds: 0.1,
    tickFrequency: 1700,
    tickGain: 0.012,
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
