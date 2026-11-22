import type { ArchitecturalModuleDefinition } from "../architecture/KitTypes";
import type { LevelArchitecturePlacement } from "../LevelTypes";
import { FIRST_SECTION_SECTION_IDS, type FirstSectionSectionId } from "./FirstSectionLayout";

/**
 * First gameplay section — Architectural Kit visual layer (Step 3.2B.2).
 *
 * Source of truth: `docs/reports/FIRST_GAMEPLAY_SECTION_SPEC.md` §6 (module,
 * placement, and batch totals) and §§5.1–5.6 (coordinates, rotations, owning
 * section), plus the module contract in `docs/ARCHITECTURAL_KIT.md`.
 *
 * The layer is visual-only: every entry is a `LevelArchitecturePlacement`
 * consumed by the existing `BoxLevelContentLoader`, which instances the
 * generated modules and never creates Rapier colliders. The physical route
 * stays entirely owned by `FirstSectionLayout.ts`; no placement here writes
 * to, replaces, or re-registers collision geometry.
 *
 * Totals: 11 module kinds, 13 unique variants, 52 placements, and 55 instanced
 * material batches (the sum of the 13 variants' parts). §6 and §12 now state
 * the same 52 placements.
 *
 * Placement corrections against earlier spec text:
 *
 * 1. The four entries that the old §6 total of 48 omitted are included: two
 *    `joint` (h 2.0) placements on S0 at (0, 0, 2.0) and (0, 0, 10.0), and two
 *    `facade-bay` placements on S4 at (-2.65, 0.90, -61.0) and
 *    (-2.65, 0.90, -67.0).
 * 2. The S2 north parapet copings use z = -27.575, following the physical
 *    parapets corrected in Step 3.2B.1. The old z = -27.225 would leave both
 *    copings completely outside the collision parapet.
 * 3. The S5 side parapet copings use x = ±4.80, centered on the collision
 *    parapets (x = ±4.80, depth 0.35). The old x = ±4.62 shifted the 0.46 m
 *    coping inward so most of its upstand was unsupported over the deck.
 * 4. The S5 east corner uses rotationY = -π/2. The Kit `corner` is handed:
 *    local wings run -X/-Z and the facades face +X/+Z. With the west corner at
 *    yaw 0, the mirrored east corner requires -π/2; at yaw 0 its wing runs
 *    inward (x 2.8…7.075) and intersects the curtain-wall zone. The two yaw
 *    values in the spec are now 0 and -π/2.
 */

/**
 * The 13 authored variants from §6, in summary order. `architecturalModuleKey`
 * folds each one into a stable identity; placements share these objects so a
 * variant is generated once and instanced everywhere.
 */
export const FIRST_SECTION_ARCHITECTURE_VARIANTS = {
  facadeBay: {
    kind: "facade-bay",
    width: 4.2,
    height: 4.2,
    revealDepth: 0.7,
    accent: true,
  },
  curtainWall: {
    kind: "curtain-wall",
    width: 6,
    height: 4.2,
    columns: 3,
    rows: 1,
    spandrel: true,
  },
  corner: {
    kind: "corner",
    width: 4.2,
    depth: 4.2,
    height: 9,
    accent: true,
  },
  column: {
    kind: "column",
    height: 3.6,
    width: 0.9,
    accent: true,
  },
  canopy: {
    kind: "canopy",
    width: 7,
    depth: 3.4,
    thickness: 0.24,
    tensionRods: true,
  },
  parapetSixMeters: {
    kind: "parapet",
    length: 6,
    height: 0.2,
    accent: true,
  },
  parapetFourMeters: {
    kind: "parapet",
    length: 4,
    height: 0.2,
    accent: true,
  },
  servicePortal: {
    kind: "service-portal",
    width: 2.8,
    height: 2.4,
    depth: 0.7,
    louvered: true,
  },
  ventilation: {
    kind: "ventilation",
    width: 2.8,
    height: 2.4,
    depth: 1,
    blades: 6,
  },
  louver: {
    kind: "louver",
    width: 5,
    height: 4,
    depth: 0.45,
    bladeCount: 18,
  },
  facadeScreen: {
    kind: "facade-screen",
    width: 6,
    height: 4.2,
    ribbons: 12,
  },
  jointTwoMeters: {
    kind: "joint",
    width: 0.9,
    height: 2,
    depth: 0.5,
  },
  jointFourPointFiveMeters: {
    kind: "joint",
    width: 0.9,
    height: 4.5,
    depth: 0.5,
  },
} as const satisfies Readonly<Record<string, ArchitecturalModuleDefinition>>;

function place(
  id: string,
  sectionId: FirstSectionSectionId,
  module: ArchitecturalModuleDefinition,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): LevelArchitecturePlacement {
  return {
    id,
    sectionId,
    module,
    position: { x, y, z },
    rotationY,
  };
}

const HALF_PI = Math.PI / 2;

/**
 * 48 authored placements in route order. Rotations follow the Kit convention:
 * the module's authored face is local +Z; `rotationY` yaws it around the
 * vertical axis, so a west-facing module uses -π/2 and an east-facing one +π/2.
 */
export const FIRST_SECTION_ARCHITECTURE: readonly LevelArchitecturePlacement[] = [
  /* S0 — Starting Roof: penthouse bays, parapet copings, canopy and columns. */
  place(
    "arch_start_facade_bay_1",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.facadeBay,
    3,
    0,
    2.1,
    -HALF_PI,
  ),
  place(
    "arch_start_facade_bay_2",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.facadeBay,
    3,
    0,
    6.3,
    -HALF_PI,
  ),
  place(
    "arch_start_parapet_west",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    -11.8,
    1.05,
    8,
    HALF_PI,
  ),
  place(
    "arch_start_parapet_east",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    11.8,
    1.05,
    8,
    HALF_PI,
  ),
  place(
    "arch_start_parapet_north",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    0,
    1.05,
    17.82,
  ),
  place(
    "arch_start_column_west",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.column,
    -2.6,
    0,
    12,
  ),
  place(
    "arch_start_column_east",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.column,
    2.6,
    0,
    12,
  ),
  place(
    "arch_start_canopy",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.canopy,
    0,
    3.6,
    12,
  ),
  place(
    "arch_start_joint_1",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters,
    0,
    0,
    2,
  ),
  place(
    "arch_start_joint_2",
    FIRST_SECTION_SECTION_IDS.start,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters,
    0,
    0,
    10,
  ),

  /* S1 — Building Jump: penthouse glass, canyon facades, copings, joints. */
  place(
    "arch_jump_curtain_penthouse",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.curtainWall,
    3,
    0,
    -9.4,
    -HALF_PI,
  ),
  place(
    "arch_jump_curtain_canyon_north",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.curtainWall,
    0,
    -8.4,
    -5.4,
  ),
  place(
    "arch_jump_curtain_canyon_south",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.curtainWall,
    0,
    -8.4,
    -13.4,
    Math.PI,
  ),
  place(
    "arch_jump_curtain_canyon_far",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.curtainWall,
    0,
    -8.4,
    -17.6,
  ),
  place(
    "arch_jump_facade_screen",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.facadeScreen,
    8.02,
    0,
    -9.4,
    HALF_PI,
  ),
  place(
    "arch_jump_parapet_b_west",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    -7.8,
    1.05,
    -9.4,
    HALF_PI,
  ),
  place(
    "arch_jump_parapet_b_east",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    7.8,
    1.05,
    -9.4,
    HALF_PI,
  ),
  place(
    "arch_jump_parapet_c_west",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    -7.8,
    1.05,
    -21.3,
    HALF_PI,
  ),
  place(
    "arch_jump_parapet_c_east",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    7.8,
    1.05,
    -21.3,
    HALF_PI,
  ),
  place(
    "arch_jump_joint_north",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointFourPointFiveMeters,
    3.05,
    0,
    -5.45,
  ),
  place(
    "arch_jump_joint_south",
    FIRST_SECTION_SECTION_IDS.buildingJump,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointFourPointFiveMeters,
    3.05,
    0,
    -13.35,
  ),

  /* S2 — Technical Passage: portals, intakes, screens, north copings, joints. */
  place(
    "arch_technical_portal_entry",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.servicePortal,
    0,
    0.9,
    -30,
  ),
  place(
    "arch_technical_portal_exit",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.servicePortal,
    0,
    0.9,
    -40.7,
  ),
  place(
    "arch_technical_ventilation_north",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.ventilation,
    1.85,
    0.9,
    -33,
    HALF_PI,
  ),
  place(
    "arch_technical_ventilation_south",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.ventilation,
    1.85,
    0.9,
    -38.5,
    HALF_PI,
  ),
  place(
    "arch_technical_louver_west",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.louver,
    -3.45,
    0.9,
    -38.5,
    -HALF_PI,
  ),
  place(
    "arch_technical_screen_east",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.facadeScreen,
    3.45,
    0.9,
    -38.5,
    HALF_PI,
  ),
  place(
    "arch_technical_parapet_north_west",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetFourMeters,
    -6,
    1.95,
    -27.575,
  ),
  place(
    "arch_technical_parapet_north_east",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetFourMeters,
    6,
    1.95,
    -27.575,
  ),
  place(
    "arch_technical_joint_entry",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters,
    0,
    0.9,
    -30,
  ),
  place(
    "arch_technical_joint_chamber",
    FIRST_SECTION_SECTION_IDS.technical,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters,
    0,
    0.9,
    -36.3,
  ),

  /* S3 — Slide Section: doorway jambs at the duct entrance. */
  place(
    "arch_slide_jamb_west",
    FIRST_SECTION_SECTION_IDS.slide,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters,
    -1.85,
    0.9,
    -47,
  ),
  place(
    "arch_slide_jamb_east",
    FIRST_SECTION_SECTION_IDS.slide,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters,
    1.85,
    0.9,
    -47,
  ),

  /* S4 — Vault Section: west facade bays and expressed obstacle joints. */
  place(
    "arch_vault_facade_bay_1",
    FIRST_SECTION_SECTION_IDS.vault,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.facadeBay,
    -2.65,
    0.9,
    -61,
    -HALF_PI,
  ),
  place(
    "arch_vault_facade_bay_2",
    FIRST_SECTION_SECTION_IDS.vault,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.facadeBay,
    -2.65,
    0.9,
    -67,
    -HALF_PI,
  ),
  place(
    "arch_vault_joint_1",
    FIRST_SECTION_SECTION_IDS.vault,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters,
    0,
    0.9,
    -59.5,
  ),
  place(
    "arch_vault_joint_2",
    FIRST_SECTION_SECTION_IDS.vault,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters,
    0,
    0.9,
    -63.5,
  ),
  place(
    "arch_vault_joint_3",
    FIRST_SECTION_SECTION_IDS.vault,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointTwoMeters,
    0,
    0.9,
    -67.5,
  ),

  /* S5 — Finish Point: tower facade, corners, canopy, podium copings, joints. */
  place(
    "arch_finish_curtain_lower_west",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.curtainWall,
    -3,
    4.5,
    -87.5,
  ),
  place(
    "arch_finish_curtain_lower_east",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.curtainWall,
    3,
    4.5,
    -87.5,
  ),
  place(
    "arch_finish_curtain_upper_west",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.curtainWall,
    -3,
    8.7,
    -87.5,
  ),
  place(
    "arch_finish_curtain_upper_east",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.curtainWall,
    3,
    8.7,
    -87.5,
  ),
  place(
    "arch_finish_corner_west",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.corner,
    -7,
    4.5,
    -87.5,
  ),
  place(
    "arch_finish_corner_east",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.corner,
    7,
    4.5,
    -87.5,
    -HALF_PI,
  ),
  place(
    "arch_finish_column_west",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.column,
    -3.2,
    4.5,
    -84,
  ),
  place(
    "arch_finish_column_east",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.column,
    3.2,
    4.5,
    -84,
  ),
  place(
    "arch_finish_canopy",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.canopy,
    0,
    8.1,
    -84,
  ),
  place(
    "arch_finish_parapet_west",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    -4.8,
    5.55,
    -83,
    HALF_PI,
  ),
  place(
    "arch_finish_parapet_east",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    4.8,
    5.55,
    -83,
    HALF_PI,
  ),
  place(
    "arch_finish_parapet_south",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.parapetSixMeters,
    0,
    5.55,
    -87.32,
  ),
  place(
    "arch_finish_joint_west",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointFourPointFiveMeters,
    -5,
    4.5,
    -83,
  ),
  place(
    "arch_finish_joint_east",
    FIRST_SECTION_SECTION_IDS.finish,
    FIRST_SECTION_ARCHITECTURE_VARIANTS.jointFourPointFiveMeters,
    5,
    4.5,
    -83,
  ),
];
