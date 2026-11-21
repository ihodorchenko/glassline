/**
 * Architectural Kit — data contract for procedural architectural modules.
 *
 * A module definition is authored data, not a runtime system: it describes one
 * reusable building element (a facade bay, a column, a bridge section, ...) in
 * module-local metres. Placement in the world is authored separately on the
 * level (`LevelArchitecturePlacement`), so geometry generation and world
 * placement stay independent.
 *
 * Local coordinate convention for every module:
 * - Y is up; the module base sits at local y = 0 (except where noted);
 * - X is the module width;
 * - +Z is the outward / front direction (the side the architecture faces).
 *
 * Dimensions are metres. Optional fields have documented defaults in the
 * corresponding builder.
 */

import type * as THREE from "three";

import type { MaterialKey } from "../../rendering/MaterialLibrary";

export type ArchitecturalModuleKind =
  | "facade-bay"
  | "curtain-wall"
  | "corner"
  | "column"
  | "cantilever"
  | "canopy"
  | "bridge"
  | "stair"
  | "parapet"
  | "service-portal"
  | "ventilation"
  | "louver"
  | "glass-railing"
  | "facade-screen"
  | "joint";

export interface FacadeBayModule {
  readonly kind: "facade-bay";
  /** Bay width in metres (glass opening proud of the structural grid). */
  readonly width: number;
  /** Storey/bay height in metres. */
  readonly height: number;
  /** Structural depth of the window reveal. */
  readonly revealDepth?: number;
  /** Thin red navigation accent inside the reveal. */
  readonly accent?: boolean;
}

export interface CurtainWallModule {
  readonly kind: "curtain-wall";
  readonly width: number;
  readonly height: number;
  /** Glass panel columns across the module. */
  readonly columns?: number;
  /** Glass panel rows across the module. */
  readonly rows?: number;
  /** Frame depth (mullion / transom section depth). */
  readonly depth?: number;
  /** Solid composite spandrel band at the bottom of the module. */
  readonly spandrel?: boolean;
}

export interface CornerModule {
  readonly kind: "corner";
  /** Wing length along the -X facade. */
  readonly width: number;
  /** Wing length along the -Z facade. */
  readonly depth: number;
  readonly height: number;
  /** Thin red accent in the expressed corner joint. */
  readonly accent?: boolean;
}

export interface ColumnModule {
  readonly kind: "column";
  readonly height: number;
  /** Base width of the tapered square column. */
  readonly width: number;
  /** Red navigation band at the base collar. */
  readonly accent?: boolean;
}

export interface CantileverModule {
  readonly kind: "cantilever";
  /** Slab width along X. */
  readonly width: number;
  /** Projection from the wall along +Z. */
  readonly depth: number;
  /** Structural slab thickness at the wall. */
  readonly thickness?: number;
  /** Glass balustrade around the exposed slab edges. */
  readonly railing?: boolean;
}

export interface CanopyModule {
  readonly kind: "canopy";
  readonly width: number;
  /** Projection from the wall along +Z. */
  readonly depth: number;
  readonly thickness?: number;
  /** Diagonal tension rods back to the wall. */
  readonly tensionRods?: boolean;
}

export interface BridgeModule {
  readonly kind: "bridge";
  /** Span along X (the bridge runs left-to-right in module space). */
  readonly length: number;
  /** Deck width along Z. */
  readonly width: number;
  /** Interior height from deck to roof soffit. */
  readonly height: number;
  /** Number of glass bays per side. */
  readonly bays?: number;
}

export interface StairModule {
  readonly kind: "stair";
  /** Flight width along X. */
  readonly width: number;
  /** Total rise in metres. */
  readonly height: number;
  /** Total run along +Z in metres. */
  readonly run: number;
  /** Number of treads; derived from rise when omitted. */
  readonly steps?: number;
  readonly railing?: boolean;
  /** Glass infill below the handrail. */
  readonly glassInfill?: boolean;
}

export interface ParapetModule {
  readonly kind: "parapet";
  /** Run along X. */
  readonly length: number;
  /** Upstand height above the roof deck. */
  readonly height: number;
  /** Thin red navigation line on the inner face. */
  readonly accent?: boolean;
}

export interface ServicePortalModule {
  readonly kind: "service-portal";
  readonly width: number;
  readonly height: number;
  /** Reveal depth of the portal. */
  readonly depth?: number;
  /** Louvered service door instead of a plain door leaf. */
  readonly louvered?: boolean;
}

export interface VentilationModule {
  readonly kind: "ventilation";
  readonly width: number;
  readonly height: number;
  /** Intake depth (projection from the wall). */
  readonly depth?: number;
  /** Number of intake blades. */
  readonly blades?: number;
}

export interface LouverModule {
  readonly kind: "louver";
  readonly width: number;
  readonly height: number;
  /** Frame depth (how far the fins sit proud of the wall). */
  readonly depth?: number;
  /** Number of vertical fins. */
  readonly bladeCount?: number;
}

export interface GlassRailingModule {
  readonly kind: "glass-railing";
  /** Run along X. */
  readonly length: number;
  /** Railing height above the deck. */
  readonly height?: number;
}

export interface FacadeScreenModule {
  readonly kind: "facade-screen";
  readonly width: number;
  readonly height: number;
  /** Number of horizontal ribbons. */
  readonly ribbons?: number;
  /** Screen depth (ribbons rotate out of the wall plane). */
  readonly depth?: number;
}

export interface JointModule {
  readonly kind: "joint";
  /** Expressed joint width along X. */
  readonly width?: number;
  /** Storey height of the joint assembly. */
  readonly height: number;
  /** Depth of the interlocking extrusion. */
  readonly depth?: number;
}

/** Discriminated union of every supported architectural module. */
export type ArchitecturalModuleDefinition =
  | FacadeBayModule
  | CurtainWallModule
  | CornerModule
  | ColumnModule
  | CantileverModule
  | CanopyModule
  | BridgeModule
  | StairModule
  | ParapetModule
  | ServicePortalModule
  | VentilationModule
  | LouverModule
  | GlassRailingModule
  | FacadeScreenModule
  | JointModule;

/** One material batch of a generated module, in module-local space. */
export interface KitModulePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: MaterialKey;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
}

/** Generated, reusable module: shared geometry + material hierarchy. */
export interface KitModuleModel {
  /** Stable identity of the authored variant (module kind + parameters). */
  readonly key: string;
  readonly kind: ArchitecturalModuleKind;
  readonly parts: readonly KitModulePart[];
  readonly triangles: number;
  dispose(): void;
}

/** Guard rails for authored numeric parameters (metres / counts). */
const MAX_PARAMETER_VALUE = 500;
const INTEGER_PARAMETER_KEYS = new Set([
  "bays",
  "bladeCount",
  "blades",
  "columns",
  "ribbons",
  "rows",
  "steps",
]);

function isArchitecturalModuleKind(value: unknown): value is ArchitecturalModuleKind {
  return (
    value === "facade-bay" ||
    value === "curtain-wall" ||
    value === "corner" ||
    value === "column" ||
    value === "cantilever" ||
    value === "canopy" ||
    value === "bridge" ||
    value === "stair" ||
    value === "parapet" ||
    value === "service-portal" ||
    value === "ventilation" ||
    value === "louver" ||
    value === "glass-railing" ||
    value === "facade-screen" ||
    value === "joint"
  );
}

/**
 * Validates an authored module definition. Returns human-readable problems; an
 * empty array means the definition can be handed to the geometry builder.
 *
 * The builder additionally asserts during construction — invalid data must never
 * produce broken or non-finite geometry, and it must be caught before the level
 * is initialized (`LevelValidator` runs this during load).
 */
export function validateArchitecturalModuleDefinition(
  definition: ArchitecturalModuleDefinition,
): string[] {
  const issues: string[] = [];
  const candidate = definition as unknown as {
    readonly kind?: unknown;
    readonly [key: string]: unknown;
  };

  if (!isArchitecturalModuleKind(candidate.kind)) {
    issues.push(`Unknown architectural module kind "${String(candidate.kind)}".`);

    return issues;
  }

  for (const [key, value] of Object.entries(candidate)) {
    if (key === "kind" || value === undefined) {
      continue;
    }

    if (typeof value === "boolean") {
      continue;
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push(`Module "${candidate.kind}" parameter "${key}" must be a finite number.`);

      continue;
    }

    if (value <= 0) {
      issues.push(`Module "${candidate.kind}" parameter "${key}" must be positive.`);

      continue;
    }

    if (value > MAX_PARAMETER_VALUE) {
      issues.push(
        `Module "${candidate.kind}" parameter "${key}" exceeds ${MAX_PARAMETER_VALUE} m.`,
      );
    }

    if (INTEGER_PARAMETER_KEYS.has(key) && !Number.isInteger(value)) {
      issues.push(`Module "${candidate.kind}" parameter "${key}" must be an integer.`);
    }
  }

  return issues;
}

/**
 * Stable identity for one authored variant. Modules with the same key share
 * generated geometry and one instanced draw batch; placements only differ by
 * their world transform.
 */
export function architecturalModuleKey(definition: ArchitecturalModuleDefinition): string {
  const entries = Object.entries(definition)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

  return entries
    .map(([key, value]) => `${key}=${typeof value === "number" ? value.toFixed(3) : String(value)}`)
    .join("|");
}
