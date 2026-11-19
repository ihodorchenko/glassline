/**
 * Deterministic capture metadata for the dev-only screenshot boot mode.
 *
 * This module is intentionally free of DOM, Three.js, and application imports so
 * the shot list and URL contract can be validated by the Node unit tests. The
 * runtime side lives in `CaptureMode.ts` and is only loaded under
 * `import.meta.env.DEV`.
 */

/** URL flag that switches the app into the capture boot mode (`?capture=1`). */
export const CAPTURE_QUERY_PARAM = "capture";

/** Primary URL parameter selecting a shot id (`?shot=skybridge`). */
export const CAPTURE_SHOT_PARAM = "shot";

/** Alias kept for the plan document wording (`?view=skybridge`). */
export const CAPTURE_VIEW_PARAM = "view";

/** URL parameter selecting the level; only the prologue capture route exists. */
export const CAPTURE_LEVEL_PARAM = "level";

/** The only level supported by the capture boot mode. */
export const SUPPORTED_CAPTURE_LEVEL_ID = "prologue";

/** Fixed field of view (degrees) applied to every capture shot. */
export const CAPTURE_FOV_DEGREES = 65;

export type CaptureVector3 = readonly [number, number, number];

export interface CaptureShot {
  /** Stable id used by `?shot=` and `__glasslineCapture.apply(id)`. */
  readonly id: string;
  /** Human-readable label surfaced in `__glasslineCapture.shots`. */
  readonly title: string;
  /** Camera world position in metres. */
  readonly position: CaptureVector3;
  /** Camera look-at target in world space (never yaw/pitch). */
  readonly lookAt: CaptureVector3;
  /** Vertical field of view in degrees. */
  readonly fov: number;
  /** Short production note describing what the frame is meant to prove. */
  readonly intent: string;
}

/**
 * Ordered Prologue shot list. Geometry references come from
 * `src/levels/test/PrologueArena.ts` / `PrologueTestLevel.ts`:
 *
 * - start roof deck: y = 0, z = -22…+22;
 * - service duct / wall-run corridor: z = -5.6…-16;
 * - lower service roofs: y = -3, z = -23…-42 (2.4 m sprint gap at z ≈ -33);
 * - skybridge deck: y = -0.9, z = -42…-50;
 * - high finish roof: y = 5.2, z = -120…-135 (reached via the catwalk U-turn).
 */
export const CAPTURE_SHOTS: readonly CaptureShot[] = [
  {
    id: "start-roof",
    title: "Prologue Start Roof",
    position: [-2.5, 1.65, 21.0],
    lookAt: [1.5, 1.6, -9.0],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "ART_BRIEF beat 1: runner-height gaze north along the white start roof; glass tower mass " +
      "on the left, canyon and open sky on the right, overhead canyon bridge as MG landmark.",
  },
  {
    id: "first-gap",
    title: "First Roof Gap",
    position: [0.0, -1.45, -30.0],
    lookAt: [0.0, -3.2, -38.5],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "ART_BRIEF beat 2: accentuation run-up on lower_roof_a; deck edge and red route dashes in " +
      "FG, 2.4 m sprint gap with sunlit landing edge and lower-city structure visible through it.",
  },
  {
    id: "wallrun-corridor",
    title: "Wall-Run Corridor",
    position: [-3.6, 1.5, 0.0],
    lookAt: [-8.0, 1.3, -7.0],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "ART_BRIEF beat 3: 32 deg gaze into the glass tower; mullion rhythm on the left, red " +
      "handrail leading to the exit ledge, city and sky strip on the right.",
  },
  {
    id: "service-block",
    title: "Service Block Descent",
    position: [0.0, 0.35, -4.9],
    lookAt: [0.0, 0.75, -12.0],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "ART_BRIEF beat 4: slide-height camera (1.0 m ceiling clearance) inside the covered " +
      "service duct; red handrail landmark and bright exit slit, sky kept below 5 %.",
  },
  {
    id: "skybridge",
    title: "Skybridge Deck",
    position: [0.0, 0.75, -42.4],
    lookAt: [0.0, 0.45, -55.5],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "ART_BRIEF beat 6: long sightline along the 3.4 m span; both glass-insert rails converge " +
      "on the distant finish gate, city canyon below on both sides.",
  },
  {
    id: "finish-roof",
    title: "High Finish Roof",
    position: [0.0, 6.8, -125.5],
    lookAt: [2.0, 6.9, -133.0],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "ART_BRIEF beat 7: clean eye-level silhouette of the FINISH gate and terminal, the single " +
      "red finish marker as the only accent, hazy skyline behind.",
  },
];

/** Ordered ids of the six canonical shots. */
export const CAPTURE_SHOT_IDS: readonly string[] = CAPTURE_SHOTS.map((shot) => shot.id);

const CAPTURE_DISABLED_VALUES = new Set(["", "0", "false", "off", "no"]);

/** Resolved capture request produced by {@link parseCaptureRequest}. */
export interface CaptureRequest {
  /** Level id that will be started; always `prologue`. */
  readonly levelId: string;
  /** Shot id that must be applied on boot (first shot when unspecified). */
  readonly shotId: string;
  /** Raw `?shot=` / `?view=` value, `null` when absent. */
  readonly requestedShotId: string | null;
  /** Whether the requested shot id exists in {@link CAPTURE_SHOTS}. */
  readonly shotKnown: boolean;
}

/** Looks a shot up by id; returns `undefined` for unknown ids. */
export function findCaptureShot(id: string): CaptureShot | undefined {
  return CAPTURE_SHOTS.find((shot) => shot.id === id);
}

/**
 * Parses the capture URL contract.
 *
 * Returns `null` when the page must boot normally: no `capture` flag, an
 * explicitly false flag, or an unsupported level. Unknown shot ids are tolerated
 * and fall back to the first shot (`shotKnown === false`) so a typo cannot make
 * the harness hang without a frame.
 */
export function parseCaptureRequest(search: string): CaptureRequest | null {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  const captureValue = params.get(CAPTURE_QUERY_PARAM);

  if (captureValue === null) {
    return null;
  }

  if (CAPTURE_DISABLED_VALUES.has(captureValue.trim().toLowerCase())) {
    return null;
  }

  const requestedLevel = (params.get(CAPTURE_LEVEL_PARAM) ?? SUPPORTED_CAPTURE_LEVEL_ID)
    .trim()
    .toLowerCase();

  if (requestedLevel !== SUPPORTED_CAPTURE_LEVEL_ID) {
    return null;
  }

  const requestedShotId =
    params.get(CAPTURE_SHOT_PARAM)?.trim() || params.get(CAPTURE_VIEW_PARAM)?.trim() || null;
  const requestedShot = requestedShotId === null ? undefined : findCaptureShot(requestedShotId);
  const resolvedShot = requestedShot ?? CAPTURE_SHOTS[0];

  if (!resolvedShot) {
    return null;
  }

  return {
    levelId: SUPPORTED_CAPTURE_LEVEL_ID,
    shotId: resolvedShot.id,
    requestedShotId,
    shotKnown: requestedShotId === null || requestedShot !== undefined,
  };
}

/**
 * Validates a shot list used by the capture boot. Returns a list of human
 * readable problems; an empty array means the list is usable.
 */
export function validateCaptureShots(shots: readonly CaptureShot[] = CAPTURE_SHOTS): string[] {
  const issues: string[] = [];

  if (shots.length !== 6) {
    issues.push(`Expected exactly 6 shots, received ${shots.length}.`);
  }

  const seen = new Set<string>();

  for (const shot of shots) {
    const label = shot.id || "<missing id>";

    if (shot.id.length === 0) {
      issues.push("Shot id must not be empty.");
    } else if (seen.has(shot.id)) {
      issues.push(`Duplicate shot id "${shot.id}".`);
    }

    seen.add(shot.id);

    if (shot.title.trim().length === 0) {
      issues.push(`Shot "${label}" has an empty title.`);
    }

    if (!Number.isFinite(shot.fov) || shot.fov <= 0) {
      issues.push(`Shot "${label}" has an invalid fov: ${String(shot.fov)}.`);
    }

    for (const [name, vector] of [
      ["position", shot.position],
      ["lookAt", shot.lookAt],
    ] as const) {
      if (vector.length !== 3) {
        issues.push(`Shot "${label}" ${name} must have 3 components.`);

        continue;
      }

      for (const component of vector) {
        if (!Number.isFinite(component)) {
          issues.push(`Shot "${label}" ${name} contains a non-finite component.`);
        }
      }
    }

    if (
      shot.position[0] === shot.lookAt[0] &&
      shot.position[1] === shot.lookAt[1] &&
      shot.position[2] === shot.lookAt[2]
    ) {
      issues.push(`Shot "${label}" lookAt must differ from its position.`);
    }
  }

  return issues;
}
