import type {
  LevelDecorationDefinition,
  LevelGeometryDefinition,
  LevelMaterialType,
  LevelVector3,
} from "../LevelTypes";
import {
  FIRST_SECTION_LAYOUT,
  FIRST_SECTION_SECTION_IDS,
  type FirstSectionSectionId,
} from "./FirstSectionLayout";

/**
 * First gameplay section — decorations and city layer (Step 3.2B.5).
 *
 * Source of truth: `docs/reports/FIRST_GAMEPLAY_SECTION_SPEC.md` §5 (segment
 * decoration lists), §7.2 V1–V7 (visual-geometry contract), §9.7 (empty roof),
 * §11.4 (resources) and §12 item 4.
 *
 * This module owns the visual layer only. Every entry is a
 * `LevelDecorationDefinition` consumed by the existing `BoxLevelContentLoader`,
 * which batches decorations into instanced meshes and never creates a collider
 * for them (§7.2 V1). The physical route stays entirely owned by
 * `FirstSectionLayout.ts`, and the reusable module layer by
 * `FirstSectionArchitecture.ts`; neither file is imported for mutation here.
 *
 * ## Building bodies
 *
 * §5 gives every segment a decorative "building body" mass whose top meets the
 * underside of its floor plate, so a roof reads as a volume instead of a box
 * (§5.1 `dec_start_body`, §5.2 `dec_jump_mass_b/c` and the canyon street, §5.3
 * `dec_plant_body`, §5.4 `dec_duct_body`, §5.5 `dec_channel_body`, §5.6
 * `dec_podium_body`/`dec_tower_body`).
 *
 * Each support body is derived from its collision slab, not re-typed: `top`
 * equals the slab bottom and the footprint equals the slab footprint, so V4
 * ("body top below the plate top and never past its edge") holds by
 * construction. Two plates are themselves solid blocks with no single owning
 * slab — the S1 plant step (a 0.93 m plate spanning the 2.4 m seam between roof
 * C and the platform) and the S5 stair block (two walls, two flights and the
 * landing) — so each gets an authored support body that stays inside the union
 * of its collision footprints. Two further deviations from the §5 numbers are
 * required for the V4 rule and are recorded here:
 *
 * 1. The §5.3 plant body is given as 44 m long. The S2 platform is 13.6 m
 *    deep, so a 44 m mass at top 0.00 would run 30 m past the platform and
 *    present a horizontal plane at y = 0 without a collider next to the
 *    narrower slide duct — exactly the false walkable surface V4 forbids. The
 *    plant body therefore matches the platform footprint; the technical
 *    ribbon south of it is carried by its own duct / exit / channel bodies,
 *    each seated on its plate.
 * 2. §5 body heights (18 m, 11 m, 4.4 m) do not reach the §5.2 street level
 *    (-20 m): every mass would float 1.8–9 m above the street, which is
 *    visible through the two roof gaps and from the roof edge. Each body is
 *    therefore extended from its slab bottom down to the street level, so the
 *    section reads as a building block. This changes body height only; no
 *    body gains area above its plate or beyond its slab edge.
 *
 * `dec_tower_body` is the single authored background mass (§5.6): it is not a
 * support body, it stands behind the finish facade and must stay clear of the
 * podium deck.
 *
 * ## Shadows (§7.2 V6, V7)
 *
 * `castShadow` defaults to `true` in the loader, so every entry states it.
 * Only building bodies cast: they are the near masses that give the city and
 * the route their depth. Every dressing prop, every sign and every city mass
 * is authored without a shadow — the far city is explicitly shadowless (V7).
 *
 * ## Draw-call budget (§11.4, §12 item 4)
 *
 * The loader batches opaque decorations by `material + shape + castShadow`
 * (`LevelContentLoader` decoration batches) and draws each `plane` and each
 * translucent decoration on its own. This layer is authored to land inside the
 * §11.4 decoration budget: 13 batches for the section dressing and 11 for the
 * city (see `tests/unit/first-section-city.test.ts`). Batches that share a key
 * across the two sub-layers merge when both are loaded, so the combined count
 * never exceeds the sum.
 *
 * ## Determinism (§7.2 V5)
 *
 * The dressing is fully authored arithmetic. The city massing is generated from
 * `FIRST_SECTION_CITY_SEED` through the same mulberry32-family generator used
 * by `PrologueCity.ts`, with its own seed: no `Math.random`, no clock, no
 * global state.
 */

/** Deterministic seed of the city massing (the Prologue uses `0x91135`). */
export const FIRST_SECTION_CITY_SEED = 0x3c5e71;
/** Id namespaces of the two sub-layers; they share one decoration namespace. */
export const FIRST_SECTION_DRESSING_ID_PREFIX = "dec";
export const FIRST_SECTION_CITY_ID_PREFIX = "city";
/** §5.2: the street between the two jump masses has its top at -20 m. */
const STREET_LEVEL_Y = -20;
const HALF_PI = Math.PI / 2;

/* ------------------------------------------------------------------------- */
/* Deterministic PRNG                                                        */
/* ------------------------------------------------------------------------- */

/** Same mulberry32-family generator as `PrologueCity.ts` (§7.2 V5). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------------- */
/* Decoration contract helpers                                               */
/* ------------------------------------------------------------------------- */

interface DecorationOptions {
  readonly material?: LevelMaterialType;
  readonly color?: number;
  readonly rotationX?: number;
  readonly rotationY?: number;
  readonly rotationZ?: number;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly opacity?: number;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
}

interface SignOptions {
  readonly text: string;
  readonly background: number;
  readonly textColor: number;
  readonly accentColor: number;
}

/** Authored prop palette shared by the segment dressing (§5.1–§5.6). */
const SIGN_PALETTE = {
  background: 0x14191d,
  textColor: 0xf4f1e9,
  accentColor: 0xd52e36,
} as const;

class DecorationBuilder {
  readonly decorations: LevelDecorationDefinition[] = [];

  add(decoration: LevelDecorationDefinition): void {
    this.decorations.push(decoration);
  }

  box(
    id: string,
    sectionId: FirstSectionSectionId,
    x: number,
    y: number,
    z: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    options: DecorationOptions = {},
  ): void {
    this.decorations.push({
      id,
      sectionId,
      shape: "box",
      position: { x, y, z },
      size: { x: sizeX, y: sizeY, z: sizeZ },
      ...options,
    });
  }

  cylinder(
    id: string,
    sectionId: FirstSectionSectionId,
    x: number,
    y: number,
    z: number,
    diameter: number,
    height: number,
    options: DecorationOptions = {},
  ): void {
    this.decorations.push({
      id,
      sectionId,
      shape: "cylinder",
      position: { x, y, z },
      size: { x: diameter, y: height, z: diameter },
      ...options,
    });
  }

  sign(
    id: string,
    sectionId: FirstSectionSectionId,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    rotationY: number,
    options: SignOptions,
  ): void {
    this.decorations.push({
      id,
      sectionId,
      shape: "plane",
      position: { x, y, z },
      size: { x: width, y: height, z: 0.02 },
      rotationY,
      color: options.background,
      text: options.text,
      textColor: options.textColor,
      accentColor: options.accentColor,
      castShadow: false,
      receiveShadow: false,
    });
  }
}

/* ------------------------------------------------------------------------- */
/* Building bodies                                                           */
/* ------------------------------------------------------------------------- */

export interface FirstSectionSupportBodyFootprint {
  readonly centerX: number;
  readonly centerZ: number;
  readonly sizeX: number;
  readonly sizeZ: number;
}

export interface FirstSectionSupportBody {
  readonly kind: "support";
  readonly id: string;
  /** Collision slabs whose bottom the body meets and whose footprint contains it. */
  readonly slabIds: readonly string[];
  readonly material: LevelMaterialType;
  /** Set only when a body spans several slabs (the S5 stair block). */
  readonly footprint?: FirstSectionSupportBodyFootprint;
}

export interface FirstSectionBackgroundMass {
  readonly kind: "background";
  readonly id: string;
  readonly sectionId: FirstSectionSectionId;
  readonly position: LevelVector3;
  readonly size: LevelVector3;
  readonly material: LevelMaterialType;
}

export type FirstSectionBody = FirstSectionSupportBody | FirstSectionBackgroundMass;

const STAIR_BODY_SLAB_IDS: readonly string[] = [
  "geo_stair_wall_w",
  "geo_stair_wall_e",
  ...Array.from({ length: 6 }, (_, index) => `geo_stair1_${index + 1}`),
  "geo_stair_landing",
  ...Array.from({ length: 6 }, (_, index) => `geo_stair2_${index + 1}`),
];

/**
 * The 13 authored masses of §5. Support bodies are the only shadow casters of
 * this layer; the background mass is the finish backdrop.
 */
export const FIRST_SECTION_BODIES: readonly FirstSectionBody[] = [
  { kind: "support", id: "dec_start_body", slabIds: ["geo_start_deck"], material: "facade" },
  { kind: "support", id: "dec_jump_mass_b", slabIds: ["geo_roof_b"], material: "facade" },
  { kind: "support", id: "dec_jump_mass_c", slabIds: ["geo_roof_c"], material: "facade" },
  {
    kind: "support",
    id: "dec_jump_step_body",
    slabIds: ["geo_plant_step"],
    material: "concrete",
  },
  { kind: "support", id: "dec_plant_body", slabIds: ["geo_plant_deck"], material: "concrete" },
  {
    kind: "support",
    id: "dec_slide_runway_body",
    slabIds: ["geo_slide_runway"],
    material: "concrete",
  },
  { kind: "support", id: "dec_duct_body", slabIds: ["geo_slide_floor"], material: "concrete" },
  {
    kind: "support",
    id: "dec_slide_exit_body",
    slabIds: ["geo_slide_exit"],
    material: "concrete",
  },
  { kind: "support", id: "dec_channel_body", slabIds: ["geo_vault_deck"], material: "concrete" },
  {
    kind: "support",
    id: "dec_finish_approach_body",
    slabIds: ["geo_finish_approach"],
    material: "concrete",
  },
  {
    // §5.6: the stair well is a solid 0…4.5 m block made of two walls, two
    // flights and the landing; no single slab owns the 4.4 x 5.5 m footprint,
    // so it is authored and the slab list documents the covering boxes.
    kind: "support",
    id: "dec_stair_body",
    slabIds: STAIR_BODY_SLAB_IDS,
    material: "concrete",
    footprint: { centerX: 0, centerZ: -75.75, sizeX: 4.4, sizeZ: 5.5 },
  },
  { kind: "support", id: "dec_podium_body", slabIds: ["geo_finish_deck"], material: "facade" },
  {
    // §5.6 `dec_tower_body`: the mass behind the finish curtain wall. Pulled
    // 0.17 m behind the facade plane so the Kit cavity keeps its depth, and
    // seated on the street so the tower does not float.
    kind: "background",
    id: "dec_tower_body",
    sectionId: FIRST_SECTION_SECTION_IDS.finish,
    position: { x: 0, y: -3.5, z: -92.17 },
    size: { x: 14, y: 33, z: 9 },
    material: "facade",
  },
];

const LAYOUT_GEOMETRY: ReadonlyMap<string, LevelGeometryDefinition> = new Map(
  FIRST_SECTION_LAYOUT.geometry.map((geometry) => [geometry.id, geometry]),
);

function slabTop(geometry: LevelGeometryDefinition): number {
  return geometry.position.y + geometry.size.y / 2;
}

function slabBottom(geometry: LevelGeometryDefinition): number {
  return geometry.position.y - geometry.size.y / 2;
}

function requireSlab(id: string): LevelGeometryDefinition {
  const slab = LAYOUT_GEOMETRY.get(id);

  if (!slab) {
    throw new Error(`First-section city: unknown collision slab "${id}".`);
  }

  return slab;
}

function supportBodyDecoration(body: FirstSectionSupportBody): LevelDecorationDefinition {
  const slabs = body.slabIds.map(requireSlab);
  const primary = slabs[0];

  if (!primary) {
    throw new Error(`First-section city: body "${body.id}" lists no slab.`);
  }

  const top = slabBottom(primary);

  for (const slab of slabs) {
    if (Math.abs(slabBottom(slab) - top) > 1e-6) {
      throw new Error(`First-section city: body "${body.id}" spans slabs with different bottoms.`);
    }

    if (slabTop(slab) <= top) {
      throw new Error(`First-section city: body "${body.id}" rests on a zero-thickness slab.`);
    }
  }

  const footprint = body.footprint ?? {
    centerX: primary.position.x,
    centerZ: primary.position.z,
    sizeX: primary.size.x,
    sizeZ: primary.size.z,
  };
  const height = top - STREET_LEVEL_Y;

  if (height <= 0) {
    throw new Error(`First-section city: body "${body.id}" has no mass above the street.`);
  }

  return {
    id: body.id,
    sectionId: primary.sectionId,
    shape: "box",
    position: {
      x: footprint.centerX,
      y: STREET_LEVEL_Y + height / 2,
      z: footprint.centerZ,
    },
    size: { x: footprint.sizeX, y: height, z: footprint.sizeZ },
    material: body.material,
    castShadow: true,
    receiveShadow: true,
  };
}

function backgroundMassDecoration(mass: FirstSectionBackgroundMass): LevelDecorationDefinition {
  return {
    id: mass.id,
    sectionId: mass.sectionId,
    shape: "box",
    position: mass.position,
    size: mass.size,
    material: mass.material,
    castShadow: true,
    receiveShadow: true,
  };
}

/* ------------------------------------------------------------------------- */
/* §5.1 S0 — Starting Roof decorations                                       */
/* ------------------------------------------------------------------------- */

function addStartingRoofDressing(builder: DecorationBuilder): void {
  const section = FIRST_SECTION_SECTION_IDS.start;

  // §5.1 `dec_start_marker`: red band on the take-off edge z = -1.6. The
  // spec's "0.12 x 0.02 x 3.0" is read as a 3.0 m band across the route (x)
  // with a 0.12 m depth (z): a 3.0 m run along z would cantilever past the
  // cut at z = -2, where the deck ends.
  builder.box("dec_start_edge_marker", section, 0, 0.01, -1.6, 3, 0.02, 0.12, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  // Red navigation accent from the spawn to the take-off edge (§5.1 "красный
  // акцент ведёт взгляд к кромке"). 12 mm proud, below the 30 mm capsule
  // tolerance, like the Prologue route paint.
  builder.box("dec_start_route_line", section, 0, 0.006, 7.5, 0.12, 0.012, 18, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  // The first gap is 20 m deep; its north wall is the start building's south
  // facade. A glazed band gives that wall a lower-storey read when the player
  // looks down the gap (§9.7 "roof without context").
  builder.box("dec_start_south_glazing", section, 0, -6.5, -1.975, 10, 3.6, 0.05, {
    material: "glass-far",
    castShadow: false,
    receiveShadow: false,
  });

  for (const x of [-3.75, -1.25, 1.25, 3.75]) {
    builder.box(
      `dec_start_south_mullion_${x < 0 ? "w" : "e"}${Math.abs(Math.round(x * 100))}`,
      section,
      x,
      -6.5,
      -2.01,
      0.08,
      3.6,
      0.04,
      { material: "dark-metal", castShadow: false, receiveShadow: false },
    );
  }
}

/* ------------------------------------------------------------------------- */
/* §5.2 S1 — Building Jump decorations                                       */
/* ------------------------------------------------------------------------- */

function addBuildingJumpDressing(builder: DecorationBuilder): void {
  const section = FIRST_SECTION_SECTION_IDS.buildingJump;

  // §5.2 "красная линия акцента по кромке": one take-off / landing band on
  // each roof edge of the two gaps. 100 mm deep and 20 mm proud, inside the
  // roof footprint so no paint hangs over the cut.
  const edges: readonly (readonly [string, number])[] = [
    ["dec_jump_edge_b_north", -5.5],
    ["dec_jump_edge_b_south", -13.3],
    ["dec_jump_edge_c_north", -17.7],
  ];

  for (const [id, z] of edges) {
    builder.box(id, section, 0, 0.01, z, 16, 0.02, 0.1, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }

  // §5.2 "«улица» между массами — бокс-декорация с верхом на -20": the alley
  // floor between masses B and C. It sits 20 mm proud of the city pavement
  // (the loader's decoration decal convention) and tucks 0.3 m under both
  // bodies, so the alley reads as a resurfaced side street instead of a slot
  // into the ground plate.
  builder.box("dec_jump_canyon_street", section, 0, STREET_LEVEL_Y - 0.18, -15.5, 16, 0.4, 4.8, {
    material: "asphalt",
    castShadow: false,
    receiveShadow: true,
  });
}

/* ------------------------------------------------------------------------- */
/* §5.3 S2 — Technical Passage decorations                                   */
/* ------------------------------------------------------------------------- */

/** Gallery / chamber lining, soffit and cold light strips (§5.3). */
function addGalleryDressing(builder: DecorationBuilder): void {
  const section = FIRST_SECTION_SECTION_IDS.technical;

  // "внутри — металлический пол": a steel deck plate over the gallery floor.
  // 5 mm proud of the collision top, inside the capsule tolerance.
  builder.box("dec_gallery_floor", section, 0, 0.895, -33, 3.6, 0.02, 6.6, {
    material: "metal",
    castShadow: false,
    receiveShadow: true,
  });

  // "тёмные стены (dark-metal)": lining panels on the inner wall faces. The
  // inner face lands on the collision plane x = ±1.4, so the authoring adds no
  // intrusion into the 2.8 m clear width; the visible face stands 35 mm proud
  // of the beveled collision wall, which is the §7.3 seam allowance.
  for (const side of [-1, 1] as const) {
    builder.box(
      `dec_gallery_lining_${side < 0 ? "west" : "east"}`,
      section,
      side * 1.42,
      2.1,
      -33,
      0.04,
      2.34,
      5.8,
      { material: "dark-metal", castShadow: false, receiveShadow: true },
    );
  }

  // Service soffit under both ceilings, 20 mm below the collision underside of
  // the concrete ceiling (height 0.9 … 3.3 m, so it stays 0.5 m above the
  // standing capsule).
  builder.box("dec_gallery_soffit", section, 0, 3.29, -33, 3.5, 0.02, 5.8, {
    material: "dark-metal",
    castShadow: false,
    receiveShadow: true,
  });
  builder.box("dec_chamber_soffit", section, 0, 3.29, -38.5, 7, 0.02, 4.2, {
    material: "dark-metal",
    castShadow: false,
    receiveShadow: true,
  });

  // "холодные линейные светильники (cool-light) внутри галереи на y = 3.2".
  // The strip hangs 70 mm below the ceiling underside on two stems, so the
  // fixture reads as suspended service lighting instead of a floating bar.
  const lightStrips: readonly (readonly [string, number, number, number])[] = [
    ["dec_gallery_light_west", -0.65, -33, 5.8],
    ["dec_gallery_light_east", 0.65, -33, 5.8],
    ["dec_chamber_light", 0, -38.5, 4.2],
  ];

  for (const [id, x, z, length] of lightStrips) {
    builder.box(id, section, x, 3.2, z, 0.12, 0.06, length, {
      material: "cool-light",
      emissive: 0xcfe8ff,
      emissiveIntensity: 0.25,
      castShadow: false,
    });

    for (const side of [-1, 1] as const) {
      builder.box(
        `${id}_stem_${side < 0 ? "north" : "south"}`,
        section,
        x,
        3.265,
        z + side * (length / 2 - 0.3),
        0.03,
        0.07,
        0.03,
        { material: "dark-metal", castShadow: false, receiveShadow: false },
      );
    }
  }

  // Red accent only on the portals (§5.3): a threshold strip at each service
  // portal, 20 mm proud, inside the capsule tolerance.
  for (const [id, z] of [
    ["dec_portal_entry_threshold", -30],
    ["dec_portal_exit_threshold", -40.7],
  ] as const) {
    builder.box(id, section, 0, 0.91, z, 2.8, 0.02, 0.16, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }
}

/**
 * Rooftop ventilation cluster on the S2 platform (§5.3): concrete curb, steel
 * housing, louvre grille on the route side and two fan cowls. Placed off the
 * 4 m route band, so it never enters the capsule corridor.
 */
function addPlatformVent(builder: DecorationBuilder, name: string, x: number, z: number): void {
  const section = FIRST_SECTION_SECTION_IDS.technical;

  builder.box(`dec_plant_vent_${name}_curb`, section, x, 0.97, z, 2.6, 0.14, 1.8, {
    material: "concrete",
    castShadow: false,
    receiveShadow: true,
  });
  builder.box(`dec_plant_vent_${name}_body`, section, x, 1.59, z, 2.2, 1.1, 1.4, {
    material: "metal",
    castShadow: false,
    receiveShadow: true,
  });
  builder.box(`dec_plant_vent_${name}_grille`, section, x, 1.62, z + 0.72, 1.9, 0.72, 0.04, {
    material: "dark-metal",
    castShadow: false,
    receiveShadow: true,
  });

  for (const side of [-1, 1] as const) {
    builder.cylinder(
      `dec_plant_vent_${name}_cowl_${side < 0 ? "west" : "east"}`,
      section,
      x + side * 0.55,
      2.21,
      z,
      0.9,
      0.14,
      { material: "metal", castShadow: false, receiveShadow: true },
    );
  }
}

/** Service pipe run along the platform's west parapet (§5.3 "технический объём"). */
function addPlatformServices(builder: DecorationBuilder): void {
  const section = FIRST_SECTION_SECTION_IDS.technical;

  builder.cylinder("dec_plant_pipe_run", section, -7.35, 1.06, -34.2, 0.16, 12.4, {
    material: "metal",
    rotationX: HALF_PI,
    castShadow: false,
    receiveShadow: true,
  });

  for (const [index, z] of [-39.6, -34.2, -28.8].entries()) {
    builder.box(`dec_plant_pipe_bracket_${index + 1}`, section, -7.35, 0.99, z, 0.08, 0.28, 0.12, {
      material: "dark-metal",
      castShadow: false,
      receiveShadow: true,
    });
  }
}

/* ------------------------------------------------------------------------- */
/* §5.4 S3 — Slide Section decorations                                       */
/* ------------------------------------------------------------------------- */

function addSlideDressing(builder: DecorationBuilder): void {
  const section = FIRST_SECTION_SECTION_IDS.slide;

  // Duct shell ribs on the ceiling top (outside the 1.00 m slide clearance, so
  // the §5.4 clearance rule is untouched).
  for (const [index, z] of [-48.3, -50.1, -51.9, -53.7].entries()) {
    builder.box(`dec_duct_rib_${index + 1}`, section, 0, 2.925, z, 3.58, 0.05, 0.1, {
      material: "dark-metal",
      castShadow: false,
      receiveShadow: false,
    });
  }

  // §5.4: red band on the ceiling edge of the entrance side. It sits on the
  // front face above the 1.90 m underside, so the duct clearance stays 1.00 m.
  builder.box("dec_duct_lintel_band", section, 0, 1.97, -47, 3.6, 0.06, 0.04, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  // §5.4: `SHIFT · SLIDE` plane fixed on a screen above the opening. The
  // backing plate gives the sign a support and keeps the plane off the 1.90 m
  // ceiling underside.
  builder.box("dec_slide_sign_backing", section, 0, 3.2, -47.03, 2.6, 0.62, 0.06, {
    material: "dark-metal",
    castShadow: false,
    receiveShadow: false,
  });
  builder.sign("dec_slide_sign", section, 0, 3.2, -46.96, 2.4, 0.5, 0, {
    text: "SHIFT · SLIDE",
    ...SIGN_PALETTE,
  });

  // §5.4 risk 1: the entry cue is "red band + SHIFT · SLIDE sign". Two red
  // chevrons on the runway floor point into the duct.
  for (const side of [-1, 1] as const) {
    builder.box(
      `dec_slide_chevron_${side < 0 ? "west" : "east"}`,
      section,
      side * 0.6,
      0.906,
      -46.3,
      0.9,
      0.012,
      0.16,
      {
        material: "red",
        rotationY: side * 0.6,
        castShadow: false,
        receiveShadow: false,
      },
    );
  }
}

/* ------------------------------------------------------------------------- */
/* §5.5 S4 — Vault Section decorations                                       */
/* ------------------------------------------------------------------------- */

interface VaultObstacleDressing {
  readonly top: number;
  /** The obstacle's +Z face (the route approaches from +Z). */
  readonly edgeZ: number;
}

function addVaultDressing(
  builder: DecorationBuilder,
  obstacles: readonly VaultObstacleDressing[],
): void {
  const section = FIRST_SECTION_SECTION_IDS.vault;

  for (const [index, obstacle] of obstacles.entries()) {
    // §5.5: red band on the front face of each obstacle. 3.8 m wide, 0.06 m
    // tall, 20 mm proud so the height reads before the approach; it stays on
    // the obstacle face, which keeps the channel aisle clear.
    builder.box(
      `dec_vault_${index + 1}_stripe`,
      section,
      0,
      obstacle.top - 0.05,
      obstacle.edgeZ + 0.01,
      3.8,
      0.06,
      0.02,
      { material: "red", castShadow: false, receiveShadow: false },
    );

    // Expressed steel edge plate on the obstacle's top front edge: it sits on
    // the landing plate (20 mm proud, the loader's bevel allowance) and inside
    // the obstacle footprint, so nothing overhangs the vault aisle.
    builder.box(
      `dec_vault_${index + 1}_nosing`,
      section,
      0,
      obstacle.top + 0.01,
      obstacle.edgeZ - 0.05,
      3.8,
      0.02,
      0.1,
      { material: "dark-metal", castShadow: false, receiveShadow: true },
    );
  }
}

/* ------------------------------------------------------------------------- */
/* §5.6 S5 — Finish Point decorations                                        */
/* ------------------------------------------------------------------------- */

function addFinishDressing(builder: DecorationBuilder): void {
  const section = FIRST_SECTION_SECTION_IDS.finish;

  // White cornice under the podium plate: the podium body is a facade mass, so
  // the top 0.22 m is expressed as a white band, matching the white roof of
  // the route. 0.1 m overhang on each side, top flush with the plate underside.
  builder.box("dec_podium_fascia", section, 0, 4.19, -83, 10.2, 0.22, 9.2, {
    material: "white",
    castShadow: false,
    receiveShadow: true,
  });

  // §5.6 `dec_finish_marker`: the single red marker at the finish line. The
  // loader ignores `emissive` for opaque semantic materials, so the value is
  // data hygiene only; the route red comes from albedo, as in the Prologue.
  builder.box("dec_finish_marker", section, 0, 5.8, -84, 0.16, 2.6, 0.16, {
    material: "red",
    emissive: 0xd52e36,
    emissiveIntensity: 0.15,
    castShadow: false,
    receiveShadow: false,
  });

  // Two warm marker lights frame the finish volume without competing with the
  // single red marker (§5.6 visual requirement).
  for (const side of [-1, 1] as const) {
    builder.box(
      `dec_podium_light_${side < 0 ? "west" : "east"}`,
      section,
      side * 4.1,
      4.62,
      -86.6,
      0.18,
      0.24,
      0.18,
      { material: "warm-light", emissive: 0xffd9a0, emissiveIntensity: 0.4, castShadow: false },
    );
  }
}

/* ------------------------------------------------------------------------- */
/* Dressing assembly                                                         */
/* ------------------------------------------------------------------------- */

function vaultObstacles(): readonly VaultObstacleDressing[] {
  return [1, 2, 3].map((index) => {
    const obstacle = requireSlab(`geo_vault_${index}`);

    return {
      top: slabTop(obstacle),
      // The route runs towards -Z, so an obstacle's front face is its +Z face.
      edgeZ: obstacle.position.z + obstacle.size.z / 2,
    };
  });
}

/** Section dressing (bodies, markers, gallery, vents, slide, vault, finish). */
export function createFirstSectionDressing(): LevelDecorationDefinition[] {
  const builder = new DecorationBuilder();

  for (const body of FIRST_SECTION_BODIES) {
    builder.add(
      body.kind === "support" ? supportBodyDecoration(body) : backgroundMassDecoration(body),
    );
  }

  addStartingRoofDressing(builder);
  addBuildingJumpDressing(builder);
  addGalleryDressing(builder);
  addPlatformVent(builder, "west", -5.4, -30.6);
  addPlatformVent(builder, "east", 5.4, -37.4);
  addPlatformServices(builder);
  addSlideDressing(builder);
  addVaultDressing(builder, vaultObstacles());
  addFinishDressing(builder);

  return builder.decorations;
}

/* ------------------------------------------------------------------------- */
/* City layer                                                                */
/* ------------------------------------------------------------------------- */

/** City massing keeps this footprint free: it belongs to the playable route. */
const SECTION_SITE = {
  minX: -14,
  maxX: 14,
  minZ: -101,
  maxZ: 19,
} as const;

/** 30 m blocks on a 40 m pitch: 20 m of building plus 10 m of street. */
const BLOCK_PITCH = 40;
const BLOCK_SIZE = 30;
const BLOCK_COLUMNS: readonly number[] = Array.from(
  { length: 9 },
  (_, index) => (index - 4) * BLOCK_PITCH,
);
const BLOCK_ROWS: readonly number[] = Array.from(
  { length: 7 },
  (_, index) => 20 - index * BLOCK_PITCH,
);
/** Roads sit in the 10 m gaps between two blocks of the pitch. */
const ROAD_COLUMNS: readonly number[] = [-140, -100, -60, -20, 20, 60, 100, 140];
const ROAD_ROWS: readonly number[] = [0, -40, -80, -120, -160, -200];

function overlapsSectionSite(minX: number, maxX: number, minZ: number, maxZ: number): boolean {
  return (
    maxX > SECTION_SITE.minX &&
    minX < SECTION_SITE.maxX &&
    maxZ > SECTION_SITE.minZ &&
    minZ < SECTION_SITE.maxZ
  );
}

/**
 * §5 city sectioning: a city mass belongs to the section whose route band
 * contains its z. Decorations carry no activation state, so the field only
 * documents where a mass sits relative to the route.
 */
function citySectionForZ(z: number): FirstSectionSectionId {
  if (z >= -2) {
    return FIRST_SECTION_SECTION_IDS.start;
  }

  if (z >= -27) {
    return FIRST_SECTION_SECTION_IDS.buildingJump;
  }

  if (z >= -41) {
    return FIRST_SECTION_SECTION_IDS.technical;
  }

  if (z >= -57) {
    return FIRST_SECTION_SECTION_IDS.slide;
  }

  if (z >= -71) {
    return FIRST_SECTION_SECTION_IDS.vault;
  }

  return FIRST_SECTION_SECTION_IDS.finish;
}

interface CityTowerOptions {
  readonly material: LevelMaterialType;
  readonly top: number;
  readonly receiveShadow: boolean;
}

/**
 * Deterministic city background (§5, §9.7): pavement and street grid, low
 * blocks, near towers, a seeded far ring and one billboard. Every mass is
 * authored without a shadow (§7.2 V7) and stays outside the route footprint.
 */
export function createFirstSectionCity(): LevelDecorationDefinition[] {
  const builder = new DecorationBuilder();
  const random = createRandom(FIRST_SECTION_CITY_SEED);
  let nextId = 0;

  const id = (): string => `${FIRST_SECTION_CITY_ID_PREFIX}_${nextId++}`;
  const box = (
    x: number,
    y: number,
    z: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    options: DecorationOptions = {},
  ): void => {
    builder.box(id(), citySectionForZ(z), x, y, z, sizeX, sizeY, sizeZ, {
      castShadow: false,
      ...options,
    });
  };
  const cylinder = (
    x: number,
    y: number,
    z: number,
    diameter: number,
    height: number,
    options: DecorationOptions = {},
  ): void => {
    builder.cylinder(id(), citySectionForZ(z), x, y, z, diameter, height, {
      castShadow: false,
      ...options,
    });
  };

  /** One tower mass: body, concrete cap, window bands, mast, far-ring beacon. */
  const addCityTower = (
    centerX: number,
    centerZ: number,
    width: number,
    depth: number,
    options: CityTowerOptions,
  ): void => {
    const { material, top, receiveShadow } = options;
    const height = top - STREET_LEVEL_Y;

    box(centerX, STREET_LEVEL_Y + height / 2, centerZ, width, height, depth, {
      material,
      receiveShadow,
    });
    box(centerX, top + 0.3, centerZ, width + 0.6, 0.6, depth + 0.6, {
      material: "concrete",
      receiveShadow,
    });

    // Window bands on the face that looks at the route.
    const towardX = -centerX;
    const towardZ = -35 - centerZ;
    const bands = 3 + Math.floor(random() * 3);
    const bandStep = Math.max(3.2, (height - 6) / bands);

    for (let band = 0; band < bands; band += 1) {
      const y = STREET_LEVEL_Y + 4 + band * bandStep;

      if (Math.abs(towardX) > Math.abs(towardZ)) {
        const faceX = centerX + Math.sign(towardX) * (width / 2 + 0.05);

        box(faceX, y, centerZ, 0.1, 1.5, depth * 0.82, {
          material: "dark-metal",
          receiveShadow,
        });
      } else {
        const faceZ = centerZ + Math.sign(towardZ) * (depth / 2 + 0.05);

        box(centerX, y, faceZ, width * 0.82, 1.5, 0.1, {
          material: "dark-metal",
          receiveShadow,
        });
      }
    }

    // Roof mast on the taller masses: a skyline silhouette, no shadow.
    if (top > 6) {
      const mastHeight = 6 + random() * 8;

      cylinder(centerX + width * 0.3, top + 0.6 + mastHeight / 2, centerZ, 0.3, mastHeight, {
        material: "metal",
        receiveShadow,
      });
    }

    // Aviation beacons only on the far ring, seated on the roof cap.
    if (!receiveShadow && top > 22 && random() > 0.55) {
      box(centerX - width * 0.3, top + 0.8, centerZ, 0.5, 0.5, 0.5, {
        material: "red",
        emissive: 0xc0262d,
        emissiveIntensity: 0.1,
        receiveShadow,
      });
    }
  };

  // Pavement: two large asphalt plates seat every mass and the section's own
  // bodies on one street level (§5.2 street at -20 m).
  box(0, STREET_LEVEL_Y - 0.2, -110, 560, 0.4, 320, {
    material: "asphalt",
    receiveShadow: true,
  });
  box(0, STREET_LEVEL_Y - 0.2, 130, 560, 0.4, 160, {
    material: "asphalt",
    receiveShadow: true,
  });

  // Street grid: 30 m sidewalk blocks on a 40 m pitch. The block under the
  // section is skipped, which leaves the route's masses standing on a cleared
  // asphalt site instead of on a pavement slab.
  for (const blockX of BLOCK_COLUMNS) {
    for (const blockZ of BLOCK_ROWS) {
      if (
        overlapsSectionSite(
          blockX - BLOCK_SIZE / 2,
          blockX + BLOCK_SIZE / 2,
          blockZ - BLOCK_SIZE / 2,
          blockZ + BLOCK_SIZE / 2,
        )
      ) {
        continue;
      }

      box(blockX, STREET_LEVEL_Y + 0.05, blockZ, BLOCK_SIZE, 0.1, BLOCK_SIZE, {
        material: "concrete",
        receiveShadow: true,
      });

      const roll = random();

      if (roll < 0.34) {
        // Low block: a 5…11 m building with a concrete cap, one dark window
        // band and one roof unit, so the pavement below the roofs is not empty.
        const width = 12 + random() * 8;
        const depth = 12 + random() * 8;
        const height = 5 + random() * 6;
        const top = STREET_LEVEL_Y + height;
        const centerX = blockX + (random() - 0.5) * (BLOCK_SIZE - width - 2);
        const centerZ = blockZ + (random() - 0.5) * (BLOCK_SIZE - depth - 2);

        box(centerX, STREET_LEVEL_Y + height / 2, centerZ, width, height, depth, {
          material: "roof",
          receiveShadow: true,
        });
        box(centerX, top + 0.2, centerZ, width + 0.4, 0.4, depth + 0.4, {
          material: "concrete",
          receiveShadow: true,
        });
        box(centerX, top - 2.2, centerZ + depth / 2 + 0.05, width * 0.78, 1.4, 0.1, {
          material: "dark-metal",
        });
        box(centerX + width * 0.2, top + 0.9, centerZ, 2.4, 1.2, 1.8, {
          material: "metal",
        });
      } else if (roll < 0.5) {
        // Near tower: taller than the section's roofs only when it stands far
        // enough away not to wall in the route.
        const width = 14 + random() * 8;
        const depth = 14 + random() * 8;
        const near = Math.abs(blockX) <= 60;
        const top = STREET_LEVEL_Y + (near ? 18 + random() * 8 : 26 + random() * 22);
        const material: LevelMaterialType = random() > 0.55 ? "glass-far" : "facade";
        const centerX = blockX + (random() - 0.5) * (BLOCK_SIZE - width - 2);
        const centerZ = blockZ + (random() - 0.5) * (BLOCK_SIZE - depth - 2);

        addCityTower(centerX, centerZ, width, depth, { material, top, receiveShadow: true });
      } else if (roll < 0.58) {
        // Plaza block: a kiosk and a bollard line keep the block from reading
        // as a bare slab. Both stand on the 0.1 m sidewalk slab.
        box(blockX + 6, STREET_LEVEL_Y + 1.6, blockZ - 6, 5, 3.2, 4, {
          material: "roof",
          receiveShadow: true,
        });

        for (const offset of [-8, -4, 4, 8]) {
          cylinder(blockX + offset, STREET_LEVEL_Y + 0.8, blockZ + 10, 0.5, 1.6, {
            material: "metal",
          });
        }
      }
    }
  }

  // Road markings: centre dashes on the streets closest to the route, so the
  // grid reads from the roof edge and through the gaps. Dashes over the site
  // are skipped; they would sit under a building.
  for (const roadX of ROAD_COLUMNS) {
    if (Math.abs(roadX) > 60) {
      continue;
    }

    for (let z = -140; z <= 40; z += 12) {
      if (overlapsSectionSite(roadX - 1, roadX + 1, z - 1.5, z + 1.5)) {
        continue;
      }

      box(roadX, STREET_LEVEL_Y + 0.02, z, 0.14, 0.02, 3, { material: "white" });
    }
  }

  for (const roadZ of ROAD_ROWS) {
    if (Math.abs(roadZ) > 120) {
      continue;
    }

    for (let x = -84; x <= 84; x += 12) {
      if (overlapsSectionSite(x - 1.5, x + 1.5, roadZ - 1, roadZ + 1)) {
        continue;
      }

      box(x, STREET_LEVEL_Y + 0.02, roadZ, 3, 0.02, 0.14, { material: "white" });
    }
  }

  // Two fixed skyline anchors behind the start: they frame the turn-around
  // view and carry the district billboard. Fixed, not seeded, so the
  // composition is authored and the billboard always has a support.
  addCityTower(-38, 50, 26, 24, { material: "facade", top: 22, receiveShadow: true });
  addCityTower(36, 56, 24, 22, { material: "glass-far", top: 30, receiveShadow: true });

  // The west anchor's south face is the billboard plane (z = 38): the backing
  // and the sign sit in front of it, facing the start with yaw π.
  builder.box(id(), citySectionForZ(37.85), -38, 14, 37.85, 12.6, 5.6, 0.3, {
    material: "dark-metal",
    castShadow: false,
    receiveShadow: false,
  });
  builder.sign(id(), citySectionForZ(37.66), -38, 14, 37.66, 12, 5, Math.PI, {
    text: "SECTOR 4",
    ...SIGN_PALETTE,
  });

  // Far ring: the skyline that closes the horizon on every side (§9.7).
  for (let index = 0; index < 34; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 135 + random() * 120;
    const x = Math.cos(angle) * radius;
    const z = -60 + Math.sin(angle) * radius;
    const width = 14 + random() * 26;
    const depth = 14 + random() * 26;

    if (overlapsSectionSite(x - width / 2, x + width / 2, z - depth / 2, z + depth / 2)) {
      continue;
    }

    const top = STREET_LEVEL_Y + 34 + random() * 76;
    const material: LevelMaterialType =
      random() > 0.62 ? "glass-far" : random() > 0.5 ? "concrete" : "facade";

    addCityTower(x, z, width, depth, { material, top, receiveShadow: false });
  }

  return builder.decorations;
}

/* ------------------------------------------------------------------------- */
/* Public layer                                                              */
/* ------------------------------------------------------------------------- */

/** Generated once; `createFirstSectionCity` is deterministic, so the two agree. */
export const FIRST_SECTION_DRESSING: readonly LevelDecorationDefinition[] =
  createFirstSectionDressing();
export const FIRST_SECTION_CITY: readonly LevelDecorationDefinition[] = createFirstSectionCity();

/**
 * Complete visual decoration layer of the first gameplay section — the section
 * dressing followed by the city background. The next substep
 * (`FirstSectionLevel.ts`) attaches this to `LevelDefinition.decorations`;
 * §7.2 V1 keeps every entry collider-free.
 */
export const FIRST_SECTION_DECORATIONS: readonly LevelDecorationDefinition[] = [
  ...FIRST_SECTION_DRESSING,
  ...FIRST_SECTION_CITY,
];

export function createFirstSectionDecorations(): LevelDecorationDefinition[] {
  return [...createFirstSectionDressing(), ...createFirstSectionCity()];
}
