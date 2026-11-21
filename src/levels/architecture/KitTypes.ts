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

/**
 * Key precision (metres) used for geometry pooling. Values are rounded to
 * 1 mm bins so floating-point noise from generated level data does not explode
 * the instanced batch count. A value that straddles a bin boundary can create
 * an extra variant, but never a silent merge: the collision guard compares the
 * full signature before a cached model is reused.
 */
const KEY_PARAMETER_PRECISION = 3;

/**
 * Signature precision used for collision detection. A key collision is only
 * accepted when the full canonical definitions agree to within 1 micrometre;
 * anything larger is a collision between different authored variants and must
 * fail loudly instead of silently reusing the first generated model.
 */
const SIGNATURE_PARAMETER_PRECISION = 6;

type ModuleParameterType = "number" | "integer" | "boolean";

interface ModuleParameterRule {
  readonly type: ModuleParameterType;
  readonly defaultValue: number | boolean;
  /** Optional derived default (for example a stair step count from its height). */
  readonly deriveDefault?: (values: Readonly<Record<string, number | boolean>>) => number;
}

interface ModuleSchema {
  readonly parameters: Readonly<Record<string, ModuleParameterRule>>;
  /** Cross-field checks that cannot be expressed as independent ranges. */
  readonly validateCrossField?: (
    values: Readonly<Record<string, number | boolean>>,
    issues: string[],
  ) => void;
}

function numberRule(defaultValue: number): ModuleParameterRule {
  return { type: "number", defaultValue };
}

function integerRule(defaultValue: number): ModuleParameterRule {
  return { type: "integer", defaultValue };
}

function booleanRule(defaultValue: boolean): ModuleParameterRule {
  return { type: "boolean", defaultValue };
}

function numberValue(values: Readonly<Record<string, number | boolean>>, name: string): number {
  const value = values[name];

  return typeof value === "number" ? value : 0;
}

function booleanValue(values: Readonly<Record<string, number | boolean>>, name: string): boolean {
  return values[name] === true;
}

/**
 * Per-kind authoring schema. Every field is optional at runtime (the builders
 * document defaults), but the schema owns the allowed names, their types, the
 * defaults used by key canonicalization and the cross-field geometry rules.
 * The limits mirror the derived dimensions in the module builders; the
 * collector's positive-size guard is the final backstop if they ever drift.
 */
const MODULE_SCHEMAS: Record<ArchitecturalModuleKind, ModuleSchema> = {
  "facade-bay": {
    parameters: {
      width: numberRule(4.2),
      height: numberRule(4.2),
      revealDepth: numberRule(0.7),
      accent: booleanRule(true),
    },
    validateCrossField: (values, issues) => {
      const width = numberValue(values, "width");
      const height = numberValue(values, "height");
      const reveal = numberValue(values, "revealDepth");
      const borderX = Math.min(0.9, Math.max(0.32, width * 0.2));
      const borderY = Math.min(0.6, Math.max(0.28, height * 0.12));
      const openingWidth = width - borderX * 2;
      const openingHeight = height - borderY * 2;

      if (openingWidth <= 0.1) {
        issues.push(
          `Module "facade-bay" width ${width} m leaves a punched opening narrower than 0.1 m.`,
        );
      }

      if (openingHeight <= 0.1) {
        issues.push(
          `Module "facade-bay" height ${height} m leaves a punched opening shorter than 0.1 m.`,
        );
      }

      if (reveal <= 0.12) {
        issues.push(
          `Module "facade-bay" revealDepth must exceed the 0.12 m wall thickness; received ${reveal} m.`,
        );
      }
    },
  },
  "curtain-wall": {
    parameters: {
      width: numberRule(6),
      height: numberRule(4.2),
      columns: integerRule(3),
      rows: integerRule(2),
      depth: numberRule(0.34),
      spandrel: booleanRule(false),
    },
    validateCrossField: (values, issues) => {
      const width = numberValue(values, "width");
      const height = numberValue(values, "height");
      const columns = numberValue(values, "columns");
      const rows = numberValue(values, "rows");
      const spandrelHeight = booleanValue(values, "spandrel") ? 0.48 : 0;
      const border = 0.1;
      const panelWidth = (width - border * 2) / columns;
      const panelHeight = (height - border * 2 - spandrelHeight) / rows;

      if (panelWidth - 0.055 <= 0) {
        issues.push(
          `Module "curtain-wall" width ${width} m with ${columns} column(s) leaves no positive glazing panel.`,
        );
      }

      if (panelHeight - 0.055 <= 0) {
        issues.push(
          `Module "curtain-wall" height ${height} m with ${rows} row(s) leaves no positive glazing panel.`,
        );
      }
    },
  },
  corner: {
    parameters: {
      width: numberRule(4.2),
      depth: numberRule(4.2),
      height: numberRule(9),
      accent: booleanRule(true),
    },
    validateCrossField: (values, issues) => {
      const width = numberValue(values, "width");
      const depth = numberValue(values, "depth");
      const height = numberValue(values, "height");

      if (width <= 1.2) {
        issues.push(
          `Module "corner" width must exceed 1.2 m so the glass return stays positive; received ${width} m.`,
        );
      }

      if (depth <= 1.2) {
        issues.push(
          `Module "corner" depth must exceed 1.2 m so the glass return stays positive; received ${depth} m.`,
        );
      }

      if (height < 3.15) {
        issues.push(
          `Module "corner" height must be at least 3.15 m for the fixed sill and head; received ${height} m.`,
        );
      }
    },
  },
  column: {
    parameters: {
      height: numberRule(5.2),
      width: numberRule(0.9),
      accent: booleanRule(true),
    },
  },
  cantilever: {
    parameters: {
      width: numberRule(8),
      depth: numberRule(3.2),
      thickness: numberRule(0.8),
      railing: booleanRule(true),
    },
    validateCrossField: (values, issues) => {
      const width = numberValue(values, "width");
      const depth = numberValue(values, "depth");

      if (depth <= 0.24) {
        issues.push(
          `Module "cantilever" depth must exceed 0.24 m so the tapered slab profile stays ordered; received ${depth} m.`,
        );
      }

      if (booleanValue(values, "railing") && width <= 0.3) {
        issues.push(
          `Module "cantilever" width must exceed 0.3 m for the railing glass; received ${width} m.`,
        );
      }
    },
  },
  canopy: {
    parameters: {
      width: numberRule(7),
      depth: numberRule(3.4),
      thickness: numberRule(0.24),
      tensionRods: booleanRule(true),
    },
    validateCrossField: (values, issues) => {
      const width = numberValue(values, "width");

      if (width <= 0.12) {
        issues.push(
          `Module "canopy" width must exceed 0.12 m so the front gutter stays positive; received ${width} m.`,
        );
      }
    },
  },
  bridge: {
    parameters: {
      length: numberRule(10),
      width: numberRule(3.2),
      height: numberRule(3.4),
      bays: integerRule(4),
    },
    validateCrossField: (values, issues) => {
      const length = numberValue(values, "length");
      const width = numberValue(values, "width");
      const height = numberValue(values, "height");

      if (length <= 0.6) {
        issues.push(
          `Module "bridge" length must exceed 0.6 m so the glazing and ceiling line stay positive; received ${length} m.`,
        );
      }

      if (width <= 0.48) {
        issues.push(
          `Module "bridge" width must exceed 0.48 m so the portal frame has a positive opening; received ${width} m.`,
        );
      }

      if (height <= 0.24) {
        issues.push(
          `Module "bridge" height must exceed 0.24 m so the portal frame has a positive opening; received ${height} m.`,
        );
      }

      if (height <= 1.08) {
        issues.push(
          `Module "bridge" height must exceed 1.08 m so the minimum glazing and head channel stay under the roof; received ${height} m.`,
        );
      }
    },
  },
  stair: {
    parameters: {
      width: numberRule(2.4),
      height: numberRule(4.2),
      run: numberRule(4.8),
      steps: {
        type: "integer",
        defaultValue: 25,
        deriveDefault: (values) => Math.max(4, Math.round(numberValue(values, "height") / 0.17)),
      },
      railing: booleanRule(true),
      glassInfill: booleanRule(true),
    },
    validateCrossField: (values, issues) => {
      const run = numberValue(values, "run");

      if (run <= 0.5) {
        issues.push(
          `Module "stair" run must exceed 0.5 m so the glass infill stays positive; received ${run} m.`,
        );
      }
    },
  },
  parapet: {
    parameters: {
      length: numberRule(6),
      height: numberRule(1.1),
      accent: booleanRule(true),
    },
    validateCrossField: (values, issues) => {
      const height = numberValue(values, "height");

      if (height <= 0.18) {
        issues.push(
          `Module "parapet" height must exceed 0.18 m for the upstand profile; received ${height} m.`,
        );
      }
    },
  },
  "service-portal": {
    parameters: {
      width: numberRule(2.8),
      height: numberRule(3),
      depth: numberRule(0.7),
      louvered: booleanRule(true),
    },
    validateCrossField: (values, issues) => {
      const width = numberValue(values, "width");
      const height = numberValue(values, "height");
      const depth = numberValue(values, "depth");
      const louvered = booleanValue(values, "louvered");

      if (depth <= 0.08) {
        issues.push(
          `Module "service-portal" depth must exceed 0.08 m so the door sits inside the reveal; received ${depth} m.`,
        );
      }

      if (height <= (louvered ? 1.16 : 0.5)) {
        issues.push(
          `Module "service-portal" height is too small for its ${louvered ? "louvered door" : "door leaf"}; received ${height} m.`,
        );
      }

      if (louvered && width <= 0.3) {
        issues.push(
          `Module "service-portal" width must exceed 0.3 m for the louver stack; received ${width} m.`,
        );
      }
    },
  },
  ventilation: {
    parameters: {
      width: numberRule(2.8),
      height: numberRule(2.4),
      depth: numberRule(1),
      blades: integerRule(6),
    },
    validateCrossField: (values, issues) => {
      const width = numberValue(values, "width");
      const height = numberValue(values, "height");
      const depth = numberValue(values, "depth");
      const blades = numberValue(values, "blades");

      if (height <= 0.64) {
        issues.push(
          `Module "ventilation" height must exceed 0.64 m for the blade stack; received ${height} m.`,
        );
      }

      if (width <= 0.06) {
        issues.push(`Module "ventilation" width must exceed 0.06 m; received ${width} m.`);
      }

      if (depth <= 0.06) {
        issues.push(
          `Module "ventilation" depth must exceed 0.06 m for the plenum; received ${depth} m.`,
        );
      }

      if (blades > 1 && (height - 0.64) / (blades - 1) <= 0.05) {
        issues.push(
          `Module "ventilation" ${blades} blades do not fit the usable height with a positive spacing.`,
        );
      }
    },
  },
  louver: {
    parameters: {
      width: numberRule(5),
      height: numberRule(4),
      depth: numberRule(0.45),
      bladeCount: integerRule(18),
    },
    validateCrossField: (values, issues) => {
      const width = numberValue(values, "width");
      const height = numberValue(values, "height");
      const bladeCount = numberValue(values, "bladeCount");

      if (height <= 0.34) {
        issues.push(
          `Module "louver" height must exceed 0.34 m for the fins; received ${height} m.`,
        );
      }

      if (width <= 0.5) {
        issues.push(
          `Module "louver" width must exceed 0.5 m for the usable screen; received ${width} m.`,
        );
      }

      if ((width - 0.5) / bladeCount <= 0.055) {
        issues.push(
          `Module "louver" ${bladeCount} fins do not fit the usable width at a positive spacing.`,
        );
      }
    },
  },
  "glass-railing": {
    parameters: {
      length: numberRule(4),
      height: numberRule(1.15),
    },
    validateCrossField: (values, issues) => {
      const length = numberValue(values, "length");
      const height = numberValue(values, "height");
      const postCount = Math.max(2, Math.round(length / 1.35) + 1);
      const panelSpan = (length - 0.2) / (postCount - 1);

      if (height <= 0.36) {
        issues.push(
          `Module "glass-railing" height must exceed 0.36 m for the glass panel; received ${height} m.`,
        );
      }

      if (panelSpan - 0.07 <= 0) {
        issues.push(
          `Module "glass-railing" length ${length} m leaves no positive glass panel between posts.`,
        );
      }
    },
  },
  "facade-screen": {
    parameters: {
      width: numberRule(5),
      height: numberRule(4.5),
      ribbons: integerRule(12),
      depth: numberRule(0.4),
    },
    validateCrossField: (values, issues) => {
      const width = numberValue(values, "width");
      const height = numberValue(values, "height");
      const ribbons = numberValue(values, "ribbons");

      if (height <= 0.3) {
        issues.push(
          `Module "facade-screen" height must exceed 0.3 m for the ribbon field; received ${height} m.`,
        );
      }

      if (width <= 0.24) {
        issues.push(
          `Module "facade-screen" width must exceed 0.24 m for the ribbons; received ${width} m.`,
        );
      }

      if ((height - 0.3) / ribbons <= 0.09) {
        issues.push(
          `Module "facade-screen" ${ribbons} ribbons do not fit the usable height at a positive spacing.`,
        );
      }
    },
  },
  joint: {
    parameters: {
      width: numberRule(0.9),
      height: numberRule(3.6),
      depth: numberRule(0.5),
    },
    validateCrossField: (values, issues) => {
      const height = numberValue(values, "height");

      if (height <= 0.16) {
        issues.push(
          `Module "joint" height must exceed 0.16 m for the accent strip; received ${height} m.`,
        );
      }
    },
  },
};

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
 * Canonical parameter record for one authored variant: every schema field is
 * present, optional/default and boolean values are normalized, and derived
 * defaults (for example the stair step count) are resolved. Unknown fields are
 * intentionally not part of the identity; validation rejects them separately.
 */
function canonicalArchitecturalModuleParameters(
  definition: ArchitecturalModuleDefinition,
): Readonly<Record<string, number | boolean>> {
  const schema = MODULE_SCHEMAS[definition.kind];
  const source = definition as unknown as Readonly<Record<string, unknown>>;
  const values: Record<string, number | boolean> = {};

  for (const [name, rule] of Object.entries(schema.parameters)) {
    const raw = source[name];

    if (raw === undefined) {
      continue;
    }

    if (rule.type === "boolean") {
      values[name] = raw === true;
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      values[name] = raw;
    }
  }

  for (const [name, rule] of Object.entries(schema.parameters)) {
    if (values[name] !== undefined) {
      continue;
    }

    const derived = rule.deriveDefault?.(values);

    values[name] = derived ?? rule.defaultValue;
  }

  return values;
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

  const schema = MODULE_SCHEMAS[candidate.kind];
  const allowedKeys = new Set(["kind", ...Object.keys(schema.parameters)]);

  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      issues.push(`Module "${candidate.kind}" has unknown parameter "${key}".`);
    }
  }

  for (const [key, rule] of Object.entries(schema.parameters)) {
    const value = candidate[key];

    if (value === undefined) {
      continue;
    }

    if (rule.type === "boolean") {
      if (typeof value !== "boolean") {
        issues.push(`Module "${candidate.kind}" parameter "${key}" must be a boolean.`);
      }

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

    if (rule.type === "integer" && !Number.isInteger(value)) {
      issues.push(`Module "${candidate.kind}" parameter "${key}" must be an integer.`);
    }
  }

  if (issues.length === 0) {
    schema.validateCrossField?.(canonicalArchitecturalModuleParameters(definition), issues);
  }

  return issues;
}

function formatModuleParameter(value: number | boolean, precision: number): string {
  return typeof value === "number" ? value.toFixed(precision) : value ? "1" : "0";
}

function formatArchitecturalModuleIdentity(
  definition: ArchitecturalModuleDefinition,
  precision: number,
): string {
  const parameters = canonicalArchitecturalModuleParameters(definition);
  const entries = Object.entries(parameters).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );

  return `${definition.kind}|${entries
    .map(([key, value]) => `${key}=${formatModuleParameter(value, precision)}`)
    .join("|")}`;
}

/**
 * Stable identity for one authored variant. Modules with the same key share
 * generated geometry and one instanced draw batch; placements only differ by
 * their world transform.
 *
 * The key deliberately quantizes metres to 1 mm. A consumer that caches by key
 * must compare {@link architecturalModuleSignature} as well; two definitions
 * that differ by more than 1 micrometre but less than the key precision are
 * different authored variants and must not silently share a model.
 */
export function architecturalModuleKey(definition: ArchitecturalModuleDefinition): string {
  return formatArchitecturalModuleIdentity(definition, KEY_PARAMETER_PRECISION);
}

/**
 * Full canonical identity used by the collision guard. Numbers are quantized to
 * 1 micrometre so ordinary floating-point noise is normalized while sub-
 * millimetre authored differences remain detectable.
 */
export function architecturalModuleSignature(definition: ArchitecturalModuleDefinition): string {
  return formatArchitecturalModuleIdentity(definition, SIGNATURE_PARAMETER_PRECISION);
}
