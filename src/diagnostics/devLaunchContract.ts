/**
 * Development-only playable level launch contract (`?dev=<level>`).
 *
 * Distinct from the deterministic capture boot (`?capture=1&level=<route>`):
 * capture mode hides the UI/HUD, freezes world time and pins the camera to an
 * authored shot, so it can never prove normal playable operation. This contract
 * starts one authored level through the normal Application / Gameplay Session
 * lifecycle and leaves every player system, control, HUD and the game loop
 * exactly as a shipped session would.
 *
 * The module is intentionally free of DOM, Three.js, and application imports so
 * the URL contract and level selection can be validated by Node unit tests. The
 * runtime side lives in `DevLaunch.ts` and is only loaded under
 * `import.meta.env.DEV`.
 */

/** URL parameter selecting a playable development level (`?dev=first_section`). */
export const DEV_LAUNCH_QUERY_PARAM = "dev";

/** Development levels understood by `?dev=<id>`. */
export const DEV_LAUNCH_LEVEL_IDS = ["first_section"] as const;

export type DevLaunchLevelId = (typeof DEV_LAUNCH_LEVEL_IDS)[number];

/**
 * One dev launch route. `levelDefinitionId` is the authored `LevelDefinition.id`
 * the Level Runtime must load; `mode` is the gameplay session mode used to run
 * it. `first_section` reuses `prologue` because a dedicated single-section
 * gameplay mode does not exist (see `FirstSectionLevel.ts`).
 */
export interface DevLaunchRoute {
  readonly id: DevLaunchLevelId;
  readonly levelDefinitionId: string;
  readonly mode: "prologue";
  readonly label: string;
}

export const DEV_LAUNCH_ROUTES: readonly DevLaunchRoute[] = [
  {
    id: "first_section",
    levelDefinitionId: "first_section",
    mode: "prologue",
    label: "First Section",
  },
];

/** Explicitly false values keep the normal boot (same convention as capture). */
const DEV_LAUNCH_DISABLED_VALUES = new Set(["", "0", "false", "off", "no"]);

/** Resolved launch request: what to start and how. */
export interface DevLaunchRequest {
  readonly levelId: DevLaunchLevelId;
  readonly levelDefinitionId: string;
  readonly mode: "prologue";
  readonly label: string;
}

/**
 * Parse outcome.
 *
 * - `none` — no dev parameter (or an explicitly false one): boot normally.
 * - `launch` — start the requested route after the application is running.
 * - `unsupported` — the parameter is present but names no known route. The
 *   runtime reports this visibly instead of silently booting into the menu, so
 *   a typo cannot be mistaken for a working launch.
 */
export type DevLaunchParseResult =
  | { readonly kind: "none" }
  | { readonly kind: "launch"; readonly request: DevLaunchRequest }
  | {
      readonly kind: "unsupported";
      readonly requested: string;
      readonly supported: readonly DevLaunchLevelId[];
    };

/** Looks a route up by id. */
export function findDevLaunchRoute(levelId: string): DevLaunchRoute | undefined {
  return DEV_LAUNCH_ROUTES.find((route) => route.id === levelId);
}

/** Comma-separated supported ids for diagnostics and failure messages. */
export function describeDevLaunchRoutes(): string {
  return DEV_LAUNCH_LEVEL_IDS.join(", ");
}

/**
 * Parses the dev launch URL contract.
 *
 * The id is trimmed and lower-cased so `?dev=First_Section` works. Unknown ids
 * are not silently ignored: they resolve to `unsupported` and the runtime shows
 * a visible failure banner without starting a session.
 */
export function parseDevLaunchRequest(search: string): DevLaunchParseResult {
  const normalized = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  const value = params.get(DEV_LAUNCH_QUERY_PARAM);

  if (value === null) {
    return { kind: "none" };
  }

  const requested = value.trim().toLowerCase();

  if (DEV_LAUNCH_DISABLED_VALUES.has(requested)) {
    return { kind: "none" };
  }

  const route = findDevLaunchRoute(requested);

  if (!route) {
    return {
      kind: "unsupported",
      requested: value.trim(),
      supported: DEV_LAUNCH_LEVEL_IDS,
    };
  }

  return {
    kind: "launch",
    request: {
      levelId: route.id,
      levelDefinitionId: route.levelDefinitionId,
      mode: route.mode,
      label: route.label,
    },
  };
}
