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
export const CAPTURE_FOV_DEGREES = 50;

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
    position: [-2.5, 1.65, 3.0],
    lookAt: [0.0, 2.6, -8.7],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "AD-2 framing: dollied north to z=3 so the overhead canyon bridge leaves the frustum and " +
      "the FG planters/barrels drop behind; 12 deg right yaw, 4.5 deg up pitch, horizon ~59 %, " +
      "red maintenance ladder on the west facade as the leading red element.",
  },
  {
    id: "first-gap",
    title: "First Roof Gap",
    position: [0.0, -1.45, -27.0],
    lookAt: [0.0, -1.0, -41.0],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "AD-2 framing: dollied ~3 m back from the gap edge (5 m to the edge), 2 deg up pitch; FG " +
      "deck edge, MG 2.4 m sprint gap with sunlit landing edge, lower structure visible through it.",
  },
  {
    id: "wallrun-corridor",
    title: "Wall-Run Corridor",
    position: [-4.6, 1.5, 0.0],
    lookAt: [-10.6, 2.2, -8.0],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "AD-2 framing: dollied 1 m toward the glass wall, 37 deg gaze into it (effective wall " +
      "angle ~30 deg), 4 deg up pitch; exit ledge and stairs stay on the right edge.",
  },
  {
    id: "service-block",
    title: "Service Block Descent",
    position: [0.0, 0.4, -6.3],
    lookAt: [1.7, 0.75, -14.1],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "AD-2 framing: slide-eye kept at 0.4 m; dollied 1.4 m into the duct, 12 deg right yaw and " +
      "2.5 deg up pitch so the duct edge reads in FG and the bright exit slit stays in MG.",
  },
  {
    id: "skybridge",
    title: "Skybridge Deck",
    position: [0.0, 0.75, -47.5],
    lookAt: [0.0, 1.8, -57.5],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "AD-2 framing: dollied 5 m along the span, ~6 deg up pitch; both glass-insert rails still " +
      "converge on the finish silhouette while more sky enters the top of frame.",
  },
  {
    id: "finish-roof",
    title: "High Finish Roof",
    position: [0.0, 6.8, -123.5],
    lookAt: [1.4, 7.75, -132.4],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "AD-2 framing: dolly 2 m back, 9 deg right yaw and ~6 deg up pitch; FINISH gate sits in the " +
      "left third, terminal fully in frame, clean deck in FG and ~45 % sky above.",
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
