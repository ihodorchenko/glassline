import type {
  AuthoredCheckpointDefinition,
  LevelDefinition,
  LevelGeometryDefinition,
  LevelMaterialType,
  LevelSectionDefinition,
  LevelSpawnPointDefinition,
  LevelSurfaceDefinition,
  LevelTriggerDefinition,
  LevelVector3,
} from "../LevelTypes";

/**
 * First standalone gameplay section — authored collision layer (Step 3.2B.1).
 *
 * Source of truth: `docs/reports/FIRST_GAMEPLAY_SECTION_SPEC.md` §4 (route and
 * section chain), §5 (segment geometry), §5.7 (measured jump apex), §7.1
 * (collision requirements), §9.8 (slide-duct bypass) and §10 (decisions).
 *
 * This file owns collision data only: sections, spawn points, triggers,
 * checkpoints, surfaces, and `geometry`. Architectural Kit modules
 * (`FirstSectionArchitecture.ts`), decorations and the city
 * (`FirstSectionCity.ts`), and the composed `FirstSectionLevel.ts` are later
 * substeps and must not be added here.
 *
 * Two conventions apply to every segment:
 * - the route runs along −Z; every collider is an axis-aligned box whose
 *   `position` is its centre and whose `size` is positive;
 * - the spawn convention is `floorTop + 0.93` (capsule centre 0.875 plus
 *   0.055 m of clearance, as in the Training and Prologue levels).
 *
 * Decision Q10 = (a) is applied in S3: the original 0.20 m ceiling plate is
 * replaced with a solid collision volume spanning `y = 1.90 … 2.90`. The
 * 1.00 m slide clearance and the duct floor/width/length are unchanged; the
 * ceiling top now sits 2.00 m above the duct floor, above the measured 1.55 m
 * jump apex, so the duct cannot be bypassed over the top (§5.7, §9.8).
 *
 * Continuous route seams satisfy §7.1 C4: neighbouring boxes overlap by
 * `SEAM_OVERLAP` (0.02 m) along the route axis. The overlap is always hidden
 * under or behind a walkable top: a same-height slab extends 0.02 m into its
 * neighbour, and step-up seams extend the lower slab 0.02 m under the higher
 * one. Every section-end edge keeps its authored z, so the §4.2 section
 * lengths, the two real gaps (3.4 m and 4.2 m), the walkable heights, and the
 * clear widths are unchanged. The 7.0 m duct floor and the 10 × 9 m finish
 * podium keep their authored sizes; the seam allowance is carried by the
 * adjacent runway / exit / approach / stair boxes instead.
 *
 * The `mode` field is `training` for this collision-only definition. The final
 * level will run in the `prologue` mode (Q1), but `validateLevelDefinition`
 * applies the Prologue's hard-coded five-section taxonomy to every
 * `mode: "prologue"` definition (`LevelValidator.validatePrologueSections`),
 * so a six-section `first_section` definition cannot validate cleanly in that
 * mode. Switching the mode belongs to the level-registration substep, together
 * with the validator decision it requires.
 */

export const FIRST_SECTION_LAYOUT_ID = "first_section";

/** Stable section ids shared by the layout, Kit, city, and level files. */
export const FIRST_SECTION_SECTION_IDS = {
  start: "sec_start",
  buildingJump: "sec_building_jump",
  technical: "sec_technical",
  slide: "sec_slide",
  vault: "sec_vault",
  finish: "sec_finish",
} as const;

export type FirstSectionSectionId =
  (typeof FIRST_SECTION_SECTION_IDS)[keyof typeof FIRST_SECTION_SECTION_IDS];

/** Authored collision box before it is stamped with its owning section. */
interface AuthoredCollisionBox {
  readonly id: string;
  readonly position: LevelVector3;
  readonly size: LevelVector3;
  readonly surfaceId: string;
  readonly material: LevelMaterialType;
}

function toGeometry(
  sectionId: FirstSectionSectionId,
  boxes: readonly AuthoredCollisionBox[],
): LevelGeometryDefinition[] {
  return boxes.map((box) => ({
    id: box.id,
    sectionId,
    position: box.position,
    size: box.size,
    surfaceId: box.surfaceId,
    material: box.material,
  }));
}

/** §5.4: the duct floor is at 0.90 and the replacement ceiling starts at 1.90. */
const SLIDE_FLOOR_TOP = 0.9;
const SLIDE_CEILING_BOTTOM = 1.9;
/** §5.7 / Q10(a): solid 1.00 m slab, not the original 0.20 m plate. */
const SLIDE_CEILING_THICKNESS = 1.0;
const SLIDE_CEILING_CENTER_Y = SLIDE_CEILING_BOTTOM + SLIDE_CEILING_THICKNESS / 2;

/** §5.6: 0.30 m rise, 0.35 m tread, six steps per flight. */
const STAIR_RISE = 0.3;
const STAIR_TREAD = 0.35;
const STAIR_FLIGHT_STEPS = 6;
const FIRST_STAIR_TOP = 1.2;
const SECOND_STAIR_TOP = 3.0;
const FIRST_STAIR_CENTER_Z = -73.175;
const SECOND_STAIR_CENTER_Z = -76.575;

/** §5.5: vault obstacle heights above the channel floor (`deckTop 0.9`). */
const VAULT_DECK_TOP = 0.9;
const VAULT_OBSTACLE_HEIGHTS = [0.5, 0.7, 1.1] as const;

/**
 * §5: every section owns the same fall slab; the route never goes below y = 0.
 * The top stays at -3 (fall-detection height unchanged); the bottom reaches
 * -12 so the §9.3/§11.2 `y = -10` acceptance probe is inside with a 2 m margin.
 */
const KILL_VOLUME_CENTER: LevelVector3 = { x: 0, y: -7.5, z: -35 };
const KILL_VOLUME_HALF_EXTENTS: LevelVector3 = { x: 80, y: 4.5, z: 100 };

/** §7.1 C4: minimum hidden overlap between boxes on a continuous route seam. */
const SEAM_OVERLAP = 0.02;

/* ------------------------------------------------------------------------- */
/* §5.1 S0 — Starting Roof                                                    */
/* ------------------------------------------------------------------------- */

const START_BOXES: readonly AuthoredCollisionBox[] = [
  {
    id: "geo_start_deck",
    position: { x: 0, y: -0.1, z: 8 },
    size: { x: 24, y: 0.2, z: 20 },
    surfaceId: "surface_roof",
    material: "roof",
  },
  {
    id: "geo_start_parapet_w",
    position: { x: -11.8, y: 0.525, z: 8 },
    size: { x: 0.35, y: 1.05, z: 20 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_start_parapet_e",
    position: { x: 11.8, y: 0.525, z: 8 },
    size: { x: 0.35, y: 1.05, z: 20 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_start_parapet_n",
    position: { x: 0, y: 0.525, z: 17.82 },
    size: { x: 24, y: 1.05, z: 0.35 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_start_penthouse",
    position: { x: 6.5, y: 2.7, z: 4 },
    size: { x: 7, y: 5.4, z: 10 },
    surfaceId: "surface_wall",
    material: "white",
  },
];

/* ------------------------------------------------------------------------- */
/* §5.2 S1 — Building Jump                                                    */
/* ------------------------------------------------------------------------- */

const BUILDING_JUMP_BOXES: readonly AuthoredCollisionBox[] = [
  {
    id: "geo_roof_b",
    position: { x: 0, y: -0.1, z: -9.4 },
    size: { x: 16, y: 0.2, z: 8 },
    surfaceId: "surface_roof",
    material: "roof",
  },
  {
    // C4: roof C runs 0.02 m under the plant step; its top stays at 0.00.
    id: "geo_roof_c",
    position: { x: 0, y: -0.1, z: -21.31 },
    size: { x: 16, y: 0.2, z: 7.42 },
    surfaceId: "surface_roof",
    material: "roof",
  },
  {
    id: "geo_roof_b_penthouse",
    position: { x: 5.5, y: 2.25, z: -9.4 },
    size: { x: 5, y: 4.5, z: 8 },
    surfaceId: "surface_wall",
    material: "white",
  },
  {
    id: "geo_roof_b_parapet_w",
    position: { x: -7.8, y: 0.525, z: -9.4 },
    size: { x: 0.35, y: 1.05, z: 8 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_roof_b_parapet_e",
    position: { x: 7.8, y: 0.525, z: -9.4 },
    size: { x: 0.35, y: 1.05, z: 8 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_roof_c_parapet_w",
    position: { x: -7.8, y: 0.525, z: -21.3 },
    size: { x: 0.35, y: 1.05, z: 7.4 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_roof_c_parapet_e",
    position: { x: 7.8, y: 0.525, z: -21.3 },
    size: { x: 0.35, y: 1.05, z: 7.4 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    // C4: the vertical face stays at z = -25; the bottom sinks 0.02 m into
    // roof C and the far edge runs 0.02 m under the plant deck. The walkable
    // top remains 0.90 and the visible step run remains 2.4 m.
    id: "geo_plant_step",
    position: { x: 0, y: 0.44, z: -26.21 },
    size: { x: 10, y: 0.92, z: 2.42 },
    surfaceId: "surface_ledge",
    material: "concrete",
  },
];

/* ------------------------------------------------------------------------- */
/* §5.3 S2 — Technical Passage                                                */
/* ------------------------------------------------------------------------- */

const TECHNICAL_BOXES: readonly AuthoredCollisionBox[] = [
  {
    // Unchanged 13.6 m platform: the C4 step/deck overlap is carried by
    // geo_plant_step, which runs 0.02 m under this deck's north edge.
    id: "geo_plant_deck",
    position: { x: 0, y: 0.45, z: -34.2 },
    size: { x: 16, y: 0.9, z: 13.6 },
    surfaceId: "surface_plant",
    material: "concrete",
  },
  {
    id: "geo_gallery_wall_w",
    position: { x: -1.6, y: 2.1, z: -33 },
    size: { x: 0.4, y: 2.4, z: 6.6 },
    surfaceId: "surface_wall",
    material: "white",
  },
  {
    id: "geo_gallery_wall_e",
    position: { x: 1.6, y: 2.1, z: -33 },
    size: { x: 0.4, y: 2.4, z: 6.6 },
    surfaceId: "surface_wall",
    material: "white",
  },
  {
    id: "geo_gallery_ceiling",
    position: { x: 0, y: 3.4, z: -33 },
    size: { x: 3.6, y: 0.2, z: 6.6 },
    surfaceId: "surface_wall",
    material: "concrete",
  },
  {
    id: "geo_chamber_wall_w",
    position: { x: -3.2, y: 2.1, z: -38.5 },
    size: { x: 0.4, y: 2.4, z: 4.6 },
    surfaceId: "surface_wall",
    material: "white",
  },
  {
    id: "geo_chamber_wall_e",
    position: { x: 3.2, y: 2.1, z: -38.5 },
    size: { x: 0.4, y: 2.4, z: 4.6 },
    surfaceId: "surface_wall",
    material: "white",
  },
  {
    id: "geo_chamber_ceiling",
    position: { x: 0, y: 3.4, z: -38.5 },
    size: { x: 7.2, y: 0.2, z: 4.6 },
    surfaceId: "surface_wall",
    material: "concrete",
  },
  {
    // Sits fully on the deck: outer face flush with the deck's north edge at
    // z = -27.4, leaving the central 8 m entrance (x = -4 … 4) open.
    id: "geo_plant_parapet_n_w",
    position: { x: -6, y: 1.425, z: -27.575 },
    size: { x: 4, y: 1.05, z: 0.35 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_plant_parapet_n_e",
    position: { x: 6, y: 1.425, z: -27.575 },
    size: { x: 4, y: 1.05, z: 0.35 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_plant_parapet_w",
    position: { x: -7.82, y: 1.425, z: -34.2 },
    size: { x: 0.35, y: 1.05, z: 13.6 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_plant_parapet_e",
    position: { x: 7.82, y: 1.425, z: -34.2 },
    size: { x: 0.35, y: 1.05, z: 13.6 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
];

/* ------------------------------------------------------------------------- */
/* §5.4 S3 — Slide Section (Q10(a): solid 1.90…2.90 ceiling volume)           */
/* ------------------------------------------------------------------------- */

const SLIDE_BOXES: readonly AuthoredCollisionBox[] = [
  {
    // C4: 0.02 m under the plant deck and 0.02 m under the duct floor. Its top
    // and visible 6 m run are unchanged; the duct floor keeps its 7.0 m.
    id: "geo_slide_runway",
    position: { x: 0, y: 0.45, z: -44 },
    size: { x: 3.6, y: 0.9, z: 6.04 },
    surfaceId: "surface_roof",
    material: "roof",
  },
  {
    id: "geo_slide_floor",
    position: { x: 0, y: SLIDE_FLOOR_TOP - 0.1, z: -50.5 },
    size: { x: 3.6, y: 0.2, z: 7 },
    surfaceId: "surface_plant",
    material: "concrete",
  },
  {
    // Original spec plate (low 1.90, thickness 0.20) replaced by the solid
    // 1.00 m volume required by Q10(a); floor, width, and length are unchanged.
    id: "geo_slide_ceiling",
    position: { x: 0, y: SLIDE_CEILING_CENTER_Y, z: -50.5 },
    size: { x: 3.6, y: SLIDE_CEILING_THICKNESS, z: 7 },
    surfaceId: "surface_slide_slot",
    material: "metal",
  },
  {
    id: "geo_slide_wall_w",
    position: { x: -1.8, y: 1.9, z: -50.5 },
    size: { x: 0.4, y: 2, z: 7 },
    surfaceId: "surface_slide_slot",
    material: "metal",
  },
  {
    id: "geo_slide_wall_e",
    position: { x: 1.8, y: 1.9, z: -50.5 },
    size: { x: 0.4, y: 2, z: 7 },
    surfaceId: "surface_slide_slot",
    material: "metal",
  },
  {
    // C4: 0.02 m back under the duct floor; min-z (section edge) is unchanged.
    id: "geo_slide_exit",
    position: { x: 0, y: 0.45, z: -55.49 },
    size: { x: 6, y: 0.9, z: 3.02 },
    surfaceId: "surface_roof",
    material: "roof",
  },
  {
    id: "geo_slide_exit_parapet_w",
    position: { x: -2.82, y: 1.425, z: -55.5 },
    size: { x: 0.35, y: 1.05, z: 3 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_slide_exit_parapet_e",
    position: { x: 2.82, y: 1.425, z: -55.5 },
    size: { x: 0.35, y: 1.05, z: 3 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
];

/* ------------------------------------------------------------------------- */
/* §5.5 S4 — Vault Section                                                    */
/* ------------------------------------------------------------------------- */

const VAULT_OBSTACLE_BOXES: readonly AuthoredCollisionBox[] = VAULT_OBSTACLE_HEIGHTS.map(
  (height, index) => ({
    id: `geo_vault_${index + 1}`,
    position: {
      x: 0,
      y: VAULT_DECK_TOP + height / 2,
      z: -59.5 - index * 4,
    },
    size: { x: 4, y: height, z: 0.7 },
    surfaceId: "surface_vault",
    material: "concrete",
  }),
);

const VAULT_BOXES: readonly AuthoredCollisionBox[] = [
  {
    // C4: 0.02 m back under the slide exit; min-z (section edge) is unchanged.
    id: "geo_vault_deck",
    position: { x: 0, y: 0.8, z: -63.99 },
    size: { x: 4.4, y: 0.2, z: 14.02 },
    surfaceId: "surface_roof",
    material: "roof",
  },
  {
    id: "geo_vault_wall_w",
    position: { x: -2.4, y: 1.9, z: -64 },
    size: { x: 0.4, y: 2, z: 14 },
    surfaceId: "surface_wall",
    material: "white",
  },
  {
    id: "geo_vault_wall_e",
    position: { x: 2.4, y: 1.9, z: -64 },
    size: { x: 0.4, y: 2, z: 14 },
    surfaceId: "surface_wall",
    material: "white",
  },
  ...VAULT_OBSTACLE_BOXES,
];

/* ------------------------------------------------------------------------- */
/* §5.6 S5 — Finish Point                                                     */
/* ------------------------------------------------------------------------- */

function createStairFlight(
  idPrefix: "geo_stair1" | "geo_stair2",
  firstTop: number,
  firstCenterZ: number,
  lastStepUnderlapsPodium: boolean,
): AuthoredCollisionBox[] {
  return Array.from({ length: STAIR_FLIGHT_STEPS }, (_, index): AuthoredCollisionBox => {
    const top = firstTop + index * STAIR_RISE;
    const extendsDownstream = index < STAIR_FLIGHT_STEPS - 1 || lastStepUnderlapsPodium;
    const underlap = extendsDownstream ? SEAM_OVERLAP : 0;

    return {
      id: `${idPrefix}_${index + 1}`,
      // C4: every step except flight 1's last runs 0.02 m under the next tread
      // (or under the podium); its visible front edge is unchanged.
      position: {
        x: 0,
        y: top / 2,
        z: firstCenterZ - index * STAIR_TREAD - underlap / 2,
      },
      size: { x: 3.6, y: top, z: STAIR_TREAD + underlap },
      surfaceId: "surface_stair",
      material: "concrete",
    };
  });
}

const FINISH_BOXES: readonly AuthoredCollisionBox[] = [
  {
    // C4: 0.02 m under the vault deck and 0.02 m under the first stair; the
    // walkable top (0.90) and the authored 2.0 m route edges are unchanged.
    id: "geo_finish_approach",
    position: { x: 0, y: 0.45, z: -72 },
    size: { x: 4.4, y: 0.9, z: 2.04 },
    surfaceId: "surface_roof",
    material: "roof",
  },
  {
    id: "geo_stair_wall_w",
    position: { x: -2, y: 2.25, z: -75.75 },
    size: { x: 0.4, y: 4.5, z: 5.5 },
    surfaceId: "surface_wall",
    material: "white",
  },
  {
    id: "geo_stair_wall_e",
    position: { x: 2, y: 2.25, z: -75.75 },
    size: { x: 0.4, y: 4.5, z: 5.5 },
    surfaceId: "surface_wall",
    material: "white",
  },
  ...createStairFlight("geo_stair1", FIRST_STAIR_TOP, FIRST_STAIR_CENTER_Z, false),
  {
    // C4: 0.02 m back under flight 1 and 0.02 m under flight 2's first step.
    // The landing top (2.70) and its visible 1.30 m tread are unchanged.
    id: "geo_stair_landing",
    position: { x: 0, y: 1.35, z: -75.75 },
    size: { x: 3.6, y: 2.7, z: 1.34 },
    surfaceId: "surface_stair",
    material: "concrete",
  },
  ...createStairFlight("geo_stair2", SECOND_STAIR_TOP, SECOND_STAIR_CENTER_Z, true),
  {
    id: "geo_finish_deck",
    position: { x: 0, y: 4.4, z: -83 },
    size: { x: 10, y: 0.2, z: 9 },
    surfaceId: "surface_finish",
    material: "roof",
  },
  {
    id: "geo_finish_parapet_w",
    position: { x: -4.8, y: 5.025, z: -83 },
    size: { x: 0.35, y: 1.05, z: 9 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_finish_parapet_e",
    position: { x: 4.8, y: 5.025, z: -83 },
    size: { x: 0.35, y: 1.05, z: 9 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
  {
    id: "geo_finish_parapet_s",
    position: { x: 0, y: 5.025, z: -87.32 },
    size: { x: 10, y: 1.05, z: 0.35 },
    surfaceId: "surface_parapet",
    material: "facade",
  },
];

/* ------------------------------------------------------------------------- */
/* §4.2 Sections and §4.3 chain                                               */
/* ------------------------------------------------------------------------- */

const SECTIONS: readonly LevelSectionDefinition[] = [
  {
    id: FIRST_SECTION_SECTION_IDS.start,
    order: 0,
    displayName: "Starting Roof",
    entrySpawnPointId: "sp_initial",
    activationPolicy: "automatic",
    nextSectionId: FIRST_SECTION_SECTION_IDS.buildingJump,
  },
  {
    id: FIRST_SECTION_SECTION_IDS.buildingJump,
    order: 1,
    displayName: "Building Jump",
    entrySpawnPointId: "sp_entry_building_jump",
    activationPolicy: "automatic",
    nextSectionId: FIRST_SECTION_SECTION_IDS.technical,
  },
  {
    id: FIRST_SECTION_SECTION_IDS.technical,
    order: 2,
    displayName: "Technical Passage",
    entrySpawnPointId: "sp_entry_technical",
    activationPolicy: "automatic",
    nextSectionId: FIRST_SECTION_SECTION_IDS.slide,
  },
  {
    id: FIRST_SECTION_SECTION_IDS.slide,
    order: 3,
    displayName: "Slide Section",
    entrySpawnPointId: "sp_entry_slide",
    activationPolicy: "automatic",
    nextSectionId: FIRST_SECTION_SECTION_IDS.vault,
  },
  {
    id: FIRST_SECTION_SECTION_IDS.vault,
    order: 4,
    displayName: "Vault Section",
    entrySpawnPointId: "sp_entry_vault",
    activationPolicy: "automatic",
    nextSectionId: FIRST_SECTION_SECTION_IDS.finish,
  },
  {
    id: FIRST_SECTION_SECTION_IDS.finish,
    order: 5,
    displayName: "Finish Point",
    entrySpawnPointId: "sp_entry_finish",
    activationPolicy: "automatic",
  },
];

/* ------------------------------------------------------------------------- */
/* Spawn points                                                               */
/* ------------------------------------------------------------------------- */

const SPAWN_POINTS: readonly LevelSpawnPointDefinition[] = [
  {
    id: "sp_initial",
    sectionId: FIRST_SECTION_SECTION_IDS.start,
    position: { x: 0, y: 0.93, z: 14 },
    rotationY: 0,
    type: "initial",
  },
  {
    id: "sp_cp_start",
    sectionId: FIRST_SECTION_SECTION_IDS.start,
    position: { x: 0, y: 0.93, z: 10 },
    rotationY: 0,
    type: "checkpoint",
  },
  {
    id: "sp_entry_building_jump",
    sectionId: FIRST_SECTION_SECTION_IDS.buildingJump,
    position: { x: 0, y: 0.93, z: -5.4 },
    rotationY: 0,
    type: "transition",
  },
  {
    id: "sp_cp_building_jump",
    sectionId: FIRST_SECTION_SECTION_IDS.buildingJump,
    position: { x: 0, y: 0.93, z: -21.3 },
    rotationY: 0,
    type: "checkpoint",
  },
  {
    id: "sp_entry_technical",
    sectionId: FIRST_SECTION_SECTION_IDS.technical,
    position: { x: 0, y: 1.83, z: -27.4 },
    rotationY: 0,
    type: "transition",
  },
  {
    id: "sp_entry_slide",
    sectionId: FIRST_SECTION_SECTION_IDS.slide,
    position: { x: 0, y: 1.83, z: -41 },
    rotationY: 0,
    type: "transition",
  },
  {
    id: "sp_cp_slide",
    sectionId: FIRST_SECTION_SECTION_IDS.slide,
    position: { x: 0, y: 1.83, z: -55.5 },
    rotationY: 0,
    type: "checkpoint",
  },
  {
    id: "sp_entry_vault",
    sectionId: FIRST_SECTION_SECTION_IDS.vault,
    position: { x: 0, y: 1.83, z: -57 },
    rotationY: 0,
    type: "transition",
  },
  {
    id: "sp_cp_vault",
    sectionId: FIRST_SECTION_SECTION_IDS.vault,
    position: { x: 0, y: 1.83, z: -70 },
    rotationY: 0,
    type: "checkpoint",
  },
  {
    id: "sp_entry_finish",
    sectionId: FIRST_SECTION_SECTION_IDS.finish,
    position: { x: 0, y: 1.83, z: -71 },
    rotationY: 0,
    type: "transition",
  },
];

/* ------------------------------------------------------------------------- */
/* Surfaces                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Surfaces describe the whole loaded level and are not gated per section
 * (LevelContentLoader "Surfaces describe the whole loaded level"); `sectionId`
 * therefore names the first section that uses each semantic surface.
 * `wallRunSurface` stays false everywhere: wall run is an explicit non-goal
 * (§10 Q2). `wallJumpSurface` / `vaultObstacle` document intent only; the
 * runtime reads neither flag (§2.7, A8).
 */
const SURFACES: readonly LevelSurfaceDefinition[] = [
  {
    id: "surface_roof",
    sectionId: FIRST_SECTION_SECTION_IDS.start,
    surfaceType: "concrete",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
  },
  {
    id: "surface_parapet",
    sectionId: FIRST_SECTION_SECTION_IDS.start,
    surfaceType: "concrete",
    walkable: false,
    landingSurface: false,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: true,
  },
  {
    id: "surface_wall",
    sectionId: FIRST_SECTION_SECTION_IDS.start,
    surfaceType: "concrete",
    walkable: false,
    landingSurface: false,
    wallRunSurface: false,
    wallJumpSurface: true,
    vaultObstacle: false,
  },
  {
    id: "surface_ledge",
    sectionId: FIRST_SECTION_SECTION_IDS.buildingJump,
    surfaceType: "concrete",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
  },
  {
    id: "surface_plant",
    sectionId: FIRST_SECTION_SECTION_IDS.technical,
    surfaceType: "concrete",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
  },
  {
    id: "surface_slide_slot",
    sectionId: FIRST_SECTION_SECTION_IDS.slide,
    surfaceType: "metal",
    walkable: false,
    landingSurface: false,
    wallRunSurface: false,
    wallJumpSurface: true,
    vaultObstacle: false,
  },
  {
    id: "surface_vault",
    sectionId: FIRST_SECTION_SECTION_IDS.vault,
    surfaceType: "concrete",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: true,
  },
  {
    id: "surface_stair",
    sectionId: FIRST_SECTION_SECTION_IDS.finish,
    surfaceType: "concrete",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
  },
  {
    id: "surface_finish",
    sectionId: FIRST_SECTION_SECTION_IDS.finish,
    surfaceType: "concrete",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
  },
];

/* ------------------------------------------------------------------------- */
/* Triggers                                                                  */
/* ------------------------------------------------------------------------- */

const KILL_VOLUME_TRIGGERS: readonly LevelTriggerDefinition[] = [
  {
    id: "trigger_void_sec_start",
    sectionId: FIRST_SECTION_SECTION_IDS.start,
    type: "generic",
    center: KILL_VOLUME_CENTER,
    halfExtents: KILL_VOLUME_HALF_EXTENTS,
    repeatable: true,
    metadata: { kind: "kill-volume" },
  },
  {
    id: "trigger_void_sec_building_jump",
    sectionId: FIRST_SECTION_SECTION_IDS.buildingJump,
    type: "generic",
    center: KILL_VOLUME_CENTER,
    halfExtents: KILL_VOLUME_HALF_EXTENTS,
    repeatable: true,
    metadata: { kind: "kill-volume" },
  },
  {
    id: "trigger_void_sec_technical",
    sectionId: FIRST_SECTION_SECTION_IDS.technical,
    type: "generic",
    center: KILL_VOLUME_CENTER,
    halfExtents: KILL_VOLUME_HALF_EXTENTS,
    repeatable: true,
    metadata: { kind: "kill-volume" },
  },
  {
    id: "trigger_void_sec_slide",
    sectionId: FIRST_SECTION_SECTION_IDS.slide,
    type: "generic",
    center: KILL_VOLUME_CENTER,
    halfExtents: KILL_VOLUME_HALF_EXTENTS,
    repeatable: true,
    metadata: { kind: "kill-volume" },
  },
  {
    id: "trigger_void_sec_vault",
    sectionId: FIRST_SECTION_SECTION_IDS.vault,
    type: "generic",
    center: KILL_VOLUME_CENTER,
    halfExtents: KILL_VOLUME_HALF_EXTENTS,
    repeatable: true,
    metadata: { kind: "kill-volume" },
  },
  {
    id: "trigger_void_sec_finish",
    sectionId: FIRST_SECTION_SECTION_IDS.finish,
    type: "generic",
    center: KILL_VOLUME_CENTER,
    halfExtents: KILL_VOLUME_HALF_EXTENTS,
    repeatable: true,
    metadata: { kind: "kill-volume" },
  },
];

/**
 * Transition triggers live in the section they lead out of, otherwise an
 * inactive section's triggers are never evaluated (§4.3, A5).
 */
const TRIGGERS: readonly LevelTriggerDefinition[] = [
  {
    id: "trigger_cp_start",
    sectionId: FIRST_SECTION_SECTION_IDS.start,
    type: "checkpoint",
    center: { x: 0, y: 1, z: 10 },
    halfExtents: { x: 2.5, y: 1.5, z: 1.5 },
    repeatable: true,
    metadata: { checkpointId: "cp_start" },
  },
  {
    id: "trigger_to_building_jump",
    sectionId: FIRST_SECTION_SECTION_IDS.start,
    type: "section-entry",
    center: { x: 0, y: 1, z: -1.5 },
    halfExtents: { x: 13, y: 2, z: 0.5 },
    repeatable: true,
    metadata: { targetSectionId: FIRST_SECTION_SECTION_IDS.buildingJump },
  },
  {
    id: "trigger_cp_building_jump",
    sectionId: FIRST_SECTION_SECTION_IDS.buildingJump,
    type: "checkpoint",
    center: { x: 0, y: 1, z: -21.3 },
    halfExtents: { x: 3, y: 1.5, z: 2 },
    repeatable: true,
    metadata: { checkpointId: "cp_building_jump" },
  },
  {
    id: "trigger_to_technical",
    sectionId: FIRST_SECTION_SECTION_IDS.buildingJump,
    type: "section-entry",
    center: { x: 0, y: 1.9, z: -27 },
    halfExtents: { x: 5, y: 1.6, z: 0.5 },
    repeatable: true,
    metadata: { targetSectionId: FIRST_SECTION_SECTION_IDS.technical },
  },
  {
    id: "trigger_to_slide",
    sectionId: FIRST_SECTION_SECTION_IDS.technical,
    type: "section-entry",
    center: { x: 0, y: 1.9, z: -41 },
    halfExtents: { x: 4, y: 1.6, z: 0.5 },
    repeatable: true,
    metadata: { targetSectionId: FIRST_SECTION_SECTION_IDS.slide },
  },
  {
    id: "trigger_cp_slide",
    sectionId: FIRST_SECTION_SECTION_IDS.slide,
    type: "checkpoint",
    center: { x: 0, y: 1.9, z: -55.5 },
    halfExtents: { x: 2.5, y: 1.5, z: 1 },
    repeatable: true,
    metadata: { checkpointId: "cp_slide" },
  },
  {
    id: "trigger_to_vault",
    sectionId: FIRST_SECTION_SECTION_IDS.slide,
    type: "section-entry",
    center: { x: 0, y: 1.9, z: -57 },
    halfExtents: { x: 3, y: 1.6, z: 0.5 },
    repeatable: true,
    metadata: { targetSectionId: FIRST_SECTION_SECTION_IDS.vault },
  },
  {
    id: "trigger_cp_vault",
    sectionId: FIRST_SECTION_SECTION_IDS.vault,
    type: "checkpoint",
    center: { x: 0, y: 1.9, z: -70 },
    halfExtents: { x: 2, y: 1.5, z: 0.7 },
    repeatable: true,
    metadata: { checkpointId: "cp_vault" },
  },
  {
    id: "trigger_to_finish",
    sectionId: FIRST_SECTION_SECTION_IDS.vault,
    type: "section-entry",
    center: { x: 0, y: 1.9, z: -71 },
    halfExtents: { x: 2.2, y: 1.6, z: 0.5 },
    repeatable: true,
    metadata: { targetSectionId: FIRST_SECTION_SECTION_IDS.finish },
  },
  {
    id: "trigger_finish",
    sectionId: FIRST_SECTION_SECTION_IDS.finish,
    type: "level-transition",
    center: { x: 0, y: 5.5, z: -84 },
    halfExtents: { x: 3, y: 2, z: 0.6 },
    repeatable: false,
    metadata: { kind: "finish" },
  },
  ...KILL_VOLUME_TRIGGERS,
];

/* ------------------------------------------------------------------------- */
/* Checkpoints                                                               */
/* ------------------------------------------------------------------------- */

const CHECKPOINTS: readonly AuthoredCheckpointDefinition[] = [
  {
    id: "cp_start",
    sectionId: FIRST_SECTION_SECTION_IDS.start,
    triggerId: "trigger_cp_start",
    spawnPointId: "sp_cp_start",
    displayName: "Starting Roof Checkpoint",
    activationMode: "automatic",
    enabled: true,
    repeatable: true,
    respawnEnabled: true,
    order: 0,
  },
  {
    id: "cp_building_jump",
    sectionId: FIRST_SECTION_SECTION_IDS.buildingJump,
    triggerId: "trigger_cp_building_jump",
    spawnPointId: "sp_cp_building_jump",
    displayName: "Building Jump Checkpoint",
    activationMode: "automatic",
    enabled: true,
    repeatable: true,
    respawnEnabled: true,
    order: 1,
  },
  {
    id: "cp_slide",
    sectionId: FIRST_SECTION_SECTION_IDS.slide,
    triggerId: "trigger_cp_slide",
    spawnPointId: "sp_cp_slide",
    displayName: "Slide Section Checkpoint",
    activationMode: "automatic",
    enabled: true,
    repeatable: true,
    respawnEnabled: true,
    order: 2,
  },
  {
    id: "cp_vault",
    sectionId: FIRST_SECTION_SECTION_IDS.vault,
    triggerId: "trigger_cp_vault",
    spawnPointId: "sp_cp_vault",
    displayName: "Vault Section Checkpoint",
    activationMode: "automatic",
    enabled: true,
    repeatable: true,
    respawnEnabled: true,
    order: 3,
  },
];

/* ------------------------------------------------------------------------- */
/* Composed collision layout                                                 */
/* ------------------------------------------------------------------------- */

/**
 * Collision layer of the first gameplay section. It is a complete
 * `LevelDefinition` so that `validateLevelDefinition` can gate it, but it
 * intentionally carries no Kit placements, decorations, environment, or
 * interactions.
 */
export const FIRST_SECTION_LAYOUT: LevelDefinition = {
  id: FIRST_SECTION_LAYOUT_ID,
  version: "1.0.0",
  mode: "training",
  displayName: "First Section — Starting Roof to Finish",
  initialSpawnPointId: "sp_initial",
  metadata: {
    description:
      "First standalone gameplay section: roof start, two roof gaps, technical gallery, slide duct, vault channel, and finish podium.",
    supportsSpeedrun: false,
    supportsRespawn: true,
  },
  sections: SECTIONS,
  spawnPoints: SPAWN_POINTS,
  triggers: TRIGGERS,
  checkpoints: CHECKPOINTS,
  interactionTargets: [],
  surfaces: SURFACES,
  geometry: [
    ...toGeometry(FIRST_SECTION_SECTION_IDS.start, START_BOXES),
    ...toGeometry(FIRST_SECTION_SECTION_IDS.buildingJump, BUILDING_JUMP_BOXES),
    ...toGeometry(FIRST_SECTION_SECTION_IDS.technical, TECHNICAL_BOXES),
    ...toGeometry(FIRST_SECTION_SECTION_IDS.slide, SLIDE_BOXES),
    ...toGeometry(FIRST_SECTION_SECTION_IDS.vault, VAULT_BOXES),
    ...toGeometry(FIRST_SECTION_SECTION_IDS.finish, FINISH_BOXES),
  ],
};

export const FIRST_SECTION_LAYOUT_DEFINITIONS: readonly LevelDefinition[] = [FIRST_SECTION_LAYOUT];
