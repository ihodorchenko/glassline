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

/** The shipped capture route (Prologue look review). */
export const SUPPORTED_CAPTURE_LEVEL_ID = "prologue";

/**
 * Architectural Kit review route. Boots the dev-only kit composition through
 * the existing Level Runtime; it is never registered in a production build.
 */
export const ARCHITECTURE_CAPTURE_LEVEL_ID = "architecture";

/** Capture routes understood by `?capture=1&level=<id>`. */
export const CAPTURE_LEVEL_IDS = [
  SUPPORTED_CAPTURE_LEVEL_ID,
  ARCHITECTURE_CAPTURE_LEVEL_ID,
] as const;

export type CaptureLevelId = (typeof CAPTURE_LEVEL_IDS)[number];

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
 *
 * Framing history: AD-2 (W0) set the six cards at FOV 50; W2.1 re-framed
 * start-roof, service-block, skybridge and finish-roof so the new content
 * (open sky, continuous red strip, dressed duct + red door, suspended load and
 * the city layer below the span) is visible. first-gap and wallrun-corridor are
 * unchanged since AD-2.
 */
export const CAPTURE_SHOTS: readonly CaptureShot[] = [
  {
    id: "start-roof",
    title: "Prologue Start Roof",
    position: [-2.5, 1.65, 3.0],
    // P1 (2026-11-21): reverted to the AD-2/round-93 reference framing. The
    // W2.1 7-deg-up pitch put ~2/3 of the frame into sky, which cannot match
    // the reference composition (horizon ~59 %, sky-blue ~43 % of the upper
    // band, architecture-dominant card); the 13 §2.1 metrics are only defined
    // against the reference-like framing.
    lookAt: [0.0, 2.6, -8.7],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "AD-2 framing (reference card): horizon-level gaze with the red route " +
      "leading into the middle ground; matches the Mirror's Edge prologue " +
      "start composition the 13 §2.1 metrics are measured against.",
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
    position: [0.0, 0.4, -6.7],
    lookAt: [1.5, 0.75, -13.8],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "W2.1-P2 framing: slide-eye 0.4 m with the dressed duct soffit edge and red perimeter frame " +
      "in the FG top (0.95 m clearance read), ~12 deg right yaw placing the moved red service door " +
      "(x -2.2, z -14.0) in MG-left and the bright exit slit in BG behind the steel pipe run.",
  },
  {
    id: "skybridge",
    title: "Skybridge Deck",
    position: [0.0, 0.75, -46.5],
    lookAt: [0.0, 1.45, -56.5],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "W2.1-P2 framing: eye height on the span itself so both transparent glass-rail balustrades " +
      "are FG/MG and the city layer reads below through them; the suspended white/red service skip " +
      "and gantry sit in the upper MG 15.5 m ahead, route centreline to the far silhouette clear.",
  },
  {
    id: "finish-roof",
    title: "High Finish Roof",
    position: [0.0, 6.8, -123.5],
    lookAt: [3.0, 8.6, -132.4],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "W2.1 framing: 11 deg up pitch and 19 deg right yaw lift the gate into a clean silhouette " +
      "against the opened sky (target sky-mask 8-18 %) with the continuous red strip and terminal " +
      "on the deck below; single red monolith remains the only dominant accent.",
  },
];

/** Ordered ids of the six canonical shots. */
export const CAPTURE_SHOT_IDS: readonly string[] = CAPTURE_SHOTS.map((shot) => shot.id);

/**
 * Architectural Kit review shots. Geometry references:
 *
 * - facade wing: x = -17, z = -29.8…-38.2 and -49.8…-58.2, 8.4 m tall;
 * - glazed atrium: x = -17…-5, z = -38…-50, 12.6 m tall + parapet;
 * - east tower: x = 10…20, z = -38…-50, 12.6 m tall;
 * - skybridge: deck y = 8.4, z = -44, spanning x = -5…10;
 * - canopy: y = 4.2 on the atrium south face, 3.4 m projection;
 * - technical annex: x = -12…8, z = -68…-60, 4.2 m tall;
 * - plaza deck: 64 x 56 m, top y = 0.
 */
export const ARCHITECTURE_CAPTURE_SHOTS: readonly CaptureShot[] = [
  {
    id: "kit-overview",
    title: "Architectural Kit — Overview",
    position: [36, 16, -10],
    lookAt: [-5, 5, -50],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "General view of the whole composition: facade wing, glazed atrium, tower, bridge and canopy read as one architecture.",
  },
  {
    id: "kit-facade",
    title: "Facade Wing — Deep Reveals",
    position: [-3.5, 5.6, -28.5],
    lookAt: [-17.5, 4.4, -36],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "Close facade read: two bays x two storeys, reveal depth, protruding sill, articulated joints and parapet silhouette.",
  },
  {
    id: "kit-glass",
    title: "Glazed Atrium",
    position: [8, 8, -28],
    lookAt: [-11, 7, -44],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "Curtain wall as a glass volume: mullion grid, spandrel rhythm, corner expression and the cantilever balcony.",
  },
  {
    id: "kit-corner",
    title: "Architectural Corner",
    position: [8, 7.5, -26],
    lookAt: [-6, 6, -39.5],
    fov: 40,
    intent:
      "Expressed corner: concrete pier, glass returns, coping caps, metal drip edge and the red navigation reveal.",
  },
  {
    id: "kit-canopy",
    title: "Canopy and Structure",
    position: [-3.5, 2.0, -28.5],
    lookAt: [-11, 4.4, -37.5],
    fov: 55,
    intent:
      "Canopy blade, tension rods, columns and the cantilevered balcony above: the structural language of the kit at eye level.",
  },
  {
    id: "kit-service",
    title: "Technical Zone",
    position: [3, 3.2, -47],
    lookAt: [-4, 3.4, -61],
    fov: 55,
    intent:
      "Service annex: louvered portal, intake, louver screen and roof plant, framed by the reflection pool in the court.",
  },
  {
    id: "kit-player-eyes",
    title: "Player Eye Level",
    position: [11, 1.65, -27],
    lookAt: [-8, 5.0, -45],
    fov: 60,
    intent:
      "First-person framing from the plaza spawn: scale, route reading and the architecture above the player.",
  },
  {
    id: "kit-distant",
    title: "Distant Silhouette",
    position: [46, 20, 2],
    lookAt: [-2, 4, -48],
    fov: 45,
    intent:
      "Long view: the composition as a skyline element above the podium and the lower city context.",
  },
  {
    id: "kit-bridge",
    title: "Skybridge Crossing",
    position: [12, 14, -28],
    lookAt: [-1, 9.2, -43],
    fov: CAPTURE_FOV_DEGREES,
    intent:
      "Aerial crossing between the glazed volume and the tower: portal frames, glazed sides, roof edge and understructure.",
  },
];

/** Ordered ids of the nine Architectural Kit review shots. */
export const ARCHITECTURE_CAPTURE_SHOT_IDS: readonly string[] = ARCHITECTURE_CAPTURE_SHOTS.map(
  (shot) => shot.id,
);

/** One capture route: level definition, session mode and authored shots. */
export interface CaptureLevelRoute {
  readonly id: CaptureLevelId;
  readonly levelDefinitionId: string;
  readonly mode: "prologue" | "training";
  readonly shots: readonly CaptureShot[];
}

/** Routes resolved from `?capture=1&level=<id>`. */
export const CAPTURE_LEVELS: readonly CaptureLevelRoute[] = [
  {
    id: SUPPORTED_CAPTURE_LEVEL_ID,
    levelDefinitionId: "prologue_test",
    mode: "prologue",
    shots: CAPTURE_SHOTS,
  },
  {
    id: ARCHITECTURE_CAPTURE_LEVEL_ID,
    // Kept as a literal so capture metadata never imports level content.
    levelDefinitionId: "architectural_kit_demo",
    mode: "training",
    shots: ARCHITECTURE_CAPTURE_SHOTS,
  },
];

const CAPTURE_DISABLED_VALUES = new Set(["", "0", "false", "off", "no"]);

/** Resolved capture request produced by {@link parseCaptureRequest}. */
export interface CaptureRequest {
  /** Capture route id (`prologue` or `architecture`). */
  readonly levelId: CaptureLevelId;
  /** Authored level definition started through the Level Runtime. */
  readonly levelDefinitionId: string;
  /** Gameplay session mode used to boot the route. */
  readonly mode: "prologue" | "training";
  /** Shot id that must be applied on boot (first shot when unspecified). */
  readonly shotId: string;
  /** Raw `?shot=` / `?view=` value, `null` when absent. */
  readonly requestedShotId: string | null;
  /** Whether the requested shot id exists in the route's shot list. */
  readonly shotKnown: boolean;
}

/** Looks a capture route up by id. */
export function findCaptureLevelRoute(levelId: CaptureLevelId): CaptureLevelRoute | undefined {
  return CAPTURE_LEVELS.find((route) => route.id === levelId);
}

/** Shot list for one capture route; unknown ids fall back to the Prologue list. */
export function captureShotsForLevel(levelId: CaptureLevelId): readonly CaptureShot[] {
  return findCaptureLevelRoute(levelId)?.shots ?? CAPTURE_SHOTS;
}

/** Looks a shot up by id within a route; returns `undefined` for unknown ids. */
export function findCaptureShot(
  id: string,
  levelId: CaptureLevelId = SUPPORTED_CAPTURE_LEVEL_ID,
): CaptureShot | undefined {
  return captureShotsForLevel(levelId).find((shot) => shot.id === id);
}

function isCaptureLevelId(value: string): value is CaptureLevelId {
  return (CAPTURE_LEVEL_IDS as readonly string[]).includes(value);
}

/**
 * Parses the capture URL contract.
 *
 * Returns `null` when the page must boot normally: no `capture` flag, an
 * explicitly false flag, or an unsupported level. Unknown shot ids are tolerated
 * and fall back to the route's first shot (`shotKnown === false`) so a typo
 * cannot make the harness hang without a frame.
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

  if (!isCaptureLevelId(requestedLevel)) {
    return null;
  }

  const route = findCaptureLevelRoute(requestedLevel);

  if (!route) {
    return null;
  }

  const requestedShotId =
    params.get(CAPTURE_SHOT_PARAM)?.trim() || params.get(CAPTURE_VIEW_PARAM)?.trim() || null;
  const requestedShot =
    requestedShotId === null ? undefined : findCaptureShot(requestedShotId, route.id);
  const resolvedShot = requestedShot ?? route.shots[0];

  if (!resolvedShot) {
    return null;
  }

  return {
    levelId: route.id,
    levelDefinitionId: route.levelDefinitionId,
    mode: route.mode,
    shotId: resolvedShot.id,
    requestedShotId,
    shotKnown: requestedShotId === null || requestedShot !== undefined,
  };
}

/**
 * Validates a shot list used by the capture boot. Returns a list of human
 * readable problems; an empty array means the list is usable.
 */
export function validateCaptureShots(
  shots: readonly CaptureShot[] = CAPTURE_SHOTS,
  expectedCount = CAPTURE_SHOTS.length,
): string[] {
  const issues: string[] = [];

  if (shots.length !== expectedCount) {
    issues.push(`Expected exactly ${expectedCount} shots, received ${shots.length}.`);
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
