import type { LevelGeometryDefinition, LevelSurfaceDefinition, LevelVector3 } from "../LevelTypes";
import { createArenaSurfaces } from "./SharedArena";

export interface PrologueArenaBox {
  readonly id: string;
  readonly position: LevelVector3;
  readonly size: LevelVector3;
  readonly surfaceId: string;
  readonly material:
    | "white"
    | "concrete"
    | "roof"
    | "facade"
    | "glass"
    | "metal"
    | "dark-metal"
    | "red"
    | "orange";
}

const PARAPET_HEIGHT = 1.05;
const PARAPET_THICKNESS = 0.36;

/**
 * Prologue colliders: a broad white roof with low parapets, an open skylight
 * pit, a service duct, a wall-run corridor, and a finish terminal. The roof is
 * deliberately open so the city and sky read as the dominant composition.
 */
export const PROLOGUE_ARENA_BOXES: readonly PrologueArenaBox[] = [
  // Roof deck, split around the skylight opening at x/z [8, 14] x [2, 8].
  {
    id: "geo_roof_west",
    position: { x: -3, y: -0.1, z: 0 },
    size: { x: 16, y: 0.2, z: 44 },
    surfaceId: "surface_concrete",
    material: "roof",
  },
  {
    id: "geo_roof_east",
    position: { x: 10, y: -0.1, z: 0 },
    size: { x: 2, y: 0.2, z: 44 },
    surfaceId: "surface_concrete",
    material: "roof",
  },
  {
    id: "geo_roof_north",
    position: { x: 7, y: -0.1, z: -9.5 },
    size: { x: 4, y: 0.2, z: 25 },
    surfaceId: "surface_concrete",
    material: "roof",
  },
  {
    id: "geo_roof_south",
    position: { x: 7, y: -0.1, z: 14.5 },
    size: { x: 4, y: 0.2, z: 15 },
    surfaceId: "surface_concrete",
    material: "roof",
  },
  // Tower wall along the west edge: the route runs against a glass facade,
  // with the open city canyon on the east side.
  {
    id: "geo_west_tower",
    position: { x: -8.4, y: 9, z: -8 },
    size: { x: 0.8, y: 18, z: 36 },
    surfaceId: "surface_boundary",
    material: "glass",
  },
  // Parapets: low enough to read the city, high enough to stay on the roof.
  {
    id: "geo_parapet_west",
    position: { x: -11.2, y: PARAPET_HEIGHT / 2, z: 0 },
    size: { x: PARAPET_THICKNESS, y: PARAPET_HEIGHT, z: 44.4 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_parapet_east",
    position: { x: 11.2, y: PARAPET_HEIGHT / 2, z: 0 },
    size: { x: PARAPET_THICKNESS, y: PARAPET_HEIGHT, z: 44.4 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_parapet_north_west",
    position: { x: -13.1, y: PARAPET_HEIGHT / 2, z: -22.2 },
    size: { x: 18.2, y: PARAPET_HEIGHT, z: PARAPET_THICKNESS },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_parapet_north_east",
    position: { x: 13.1, y: PARAPET_HEIGHT / 2, z: -22.2 },
    size: { x: 18.2, y: PARAPET_HEIGHT, z: PARAPET_THICKNESS },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_parapet_south",
    position: { x: 0, y: PARAPET_HEIGHT / 2, z: 22.2 },
    size: { x: 44.4, y: PARAPET_HEIGHT, z: PARAPET_THICKNESS },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  // Skylight curb around the opening.
  {
    id: "geo_skylight_curb_north",
    position: { x: 7, y: 0.12, z: 2.7 },
    size: { x: 4.8, y: 0.24, z: 0.32 },
    surfaceId: "surface_step",
    material: "metal",
  },
  {
    id: "geo_skylight_curb_south",
    position: { x: 7, y: 0.12, z: 7.3 },
    size: { x: 4.8, y: 0.24, z: 0.32 },
    surfaceId: "surface_step",
    material: "metal",
  },
  {
    id: "geo_skylight_curb_west",
    position: { x: 4.6, y: 0.12, z: 5 },
    size: { x: 0.32, y: 0.24, z: 5.0 },
    surfaceId: "surface_step",
    material: "metal",
  },
  {
    id: "geo_skylight_curb_east",
    position: { x: 9.4, y: 0.12, z: 5 },
    size: { x: 0.32, y: 0.24, z: 5.0 },
    surfaceId: "surface_step",
    material: "metal",
  },
  // Vault obstacle.
  {
    id: "geo_vault_obstacle",
    position: { x: 0, y: 0.375, z: -1 },
    size: { x: 2.4, y: 0.75, z: 0.7 },
    surfaceId: "surface_vault",
    material: "white",
  },
  // Steps.
  {
    id: "geo_step_low",
    position: { x: 4, y: 0.09, z: 1 },
    size: { x: 1.6, y: 0.18, z: 1.6 },
    surfaceId: "surface_step",
    material: "white",
  },
  {
    id: "geo_step_high",
    position: { x: 4, y: 0.15, z: -0.8 },
    size: { x: 1.6, y: 0.3, z: 1.6 },
    surfaceId: "surface_step",
    material: "white",
  },
  // Slide tunnel / service duct.
  {
    id: "geo_tunnel_west",
    position: { x: -1.9, y: 1.3, z: -7.6 },
    size: { x: 0.4, y: 2.6, z: 4 },
    surfaceId: "surface_tunnel",
    material: "white",
  },
  {
    id: "geo_tunnel_east",
    position: { x: 1.9, y: 1.3, z: -7.6 },
    size: { x: 0.4, y: 2.6, z: 4 },
    surfaceId: "surface_tunnel",
    material: "white",
  },
  {
    id: "geo_tunnel_ceiling",
    position: { x: 0, y: 1.15, z: -7.6 },
    size: { x: 4, y: 0.2, z: 4 },
    surfaceId: "surface_tunnel",
    material: "metal",
  },
  // Wall-run corridor.
  {
    id: "geo_wallrun_west",
    position: { x: -2.4, y: 1.7, z: -12.5 },
    size: { x: 0.4, y: 3.4, z: 7 },
    surfaceId: "surface_wallrun",
    material: "facade",
  },
  {
    id: "geo_wallrun_east",
    position: { x: 2.4, y: 1.7, z: -12.5 },
    size: { x: 0.4, y: 3.4, z: 7 },
    surfaceId: "surface_wallrun",
    material: "facade",
  },
  // Lower service roof after the north drop: two decks with a sprint gap.
  {
    id: "geo_lower_roof_a",
    position: { x: 0, y: -3.1, z: -27.5 },
    size: { x: 28, y: 0.2, z: 9 },
    surfaceId: "surface_concrete",
    material: "roof",
  },
  {
    id: "geo_lower_roof_b",
    position: { x: 0, y: -3.1, z: -38.2 },
    size: { x: 28, y: 0.2, z: 7.6 },
    surfaceId: "surface_concrete",
    material: "roof",
  },
  {
    id: "geo_lower_parapet_west",
    position: { x: -14.2, y: -2.5, z: -32.5 },
    size: { x: PARAPET_THICKNESS, y: 1, z: 19 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_lower_parapet_east",
    position: { x: 14.2, y: -2.5, z: -32.5 },
    size: { x: PARAPET_THICKNESS, y: 1, z: 19 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  // Stair flight up onto the skybridge. The character controller reliably
  // autosteps 0.15 m; steeper risers stall against the capsule.
  ...Array.from({ length: 15 }, (_, index) => {
    const top = -3 + (index + 1) * 0.15;

    return {
      id: `geo_skybridge_step_${index}`,
      position: {
        x: 0,
        y: (top + -3.1) / 2,
        z: -34.4 - (index + 0.5) * 0.5,
      },
      size: { x: 3.2, y: top + 3.1, z: 0.5 },
      surfaceId: "surface_step",
      material: "metal" as const,
    };
  }),
  // Skybridge deck and rails.
  {
    id: "geo_skybridge_deck",
    position: { x: 0, y: -1.0, z: -46 },
    size: { x: 3.4, y: 0.2, z: 8 },
    surfaceId: "surface_concrete",
    material: "roof",
  },
  {
    id: "geo_skybridge_rail_west",
    position: { x: -1.8, y: -0.25, z: -46 },
    size: { x: 0.2, y: 1.3, z: 8 },
    surfaceId: "surface_boundary",
    material: "glass",
  },
  {
    id: "geo_skybridge_rail_east",
    position: { x: 1.8, y: -0.25, z: -46 },
    size: { x: 0.2, y: 1.3, z: 8 },
    surfaceId: "surface_boundary",
    material: "glass",
  },
  // Finish roof.
  {
    id: "geo_finish_deck",
    position: { x: 0, y: -1.0, z: -56 },
    size: { x: 18, y: 0.2, z: 12 },
    surfaceId: "surface_concrete",
    material: "roof",
  },
  {
    id: "geo_finish_parapet_west",
    position: { x: -9.2, y: -0.4, z: -56 },
    size: { x: PARAPET_THICKNESS, y: 1, z: 12 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_finish_parapet_east",
    position: { x: 9.2, y: -0.4, z: -56 },
    size: { x: PARAPET_THICKNESS, y: 1, z: 12 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_finish_parapet_north",
    position: { x: 0, y: -0.4, z: -62.2 },
    size: { x: 18.4, y: 1, z: PARAPET_THICKNESS },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_finish_parapet_south_west",
    position: { x: -5.5, y: -0.4, z: -49.8 },
    size: { x: 7.4, y: 1, z: PARAPET_THICKNESS },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_finish_parapet_south_east",
    position: { x: 5.5, y: -0.4, z: -49.8 },
    size: { x: 7.4, y: 1, z: PARAPET_THICKNESS },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  // Final ascent: a narrow beam over the gap, then eight rising scaffold
  // platforms (0.8 m each) onto the high finish roof at y = 5.2.
  {
    id: "geo_final_beam",
    position: { x: 0, y: -2.1, z: -68.5 },
    size: { x: 2.4, y: 0.2, z: 8 },
    surfaceId: "surface_step",
    material: "concrete",
  },
  ...Array.from({ length: 8 }, (_, index) => {
    const top = -2 + (index + 1) * 0.8;
    const start = -74.5 - index * 5.6;

    return {
      id: `geo_ascent_platform_${index}`,
      position: {
        x: 0,
        y: top - 0.1,
        z: start - 1.8,
      },
      size: { x: 3.4, y: 0.2, z: 3.6 },
      surfaceId: "surface_concrete",
      material: "roof" as const,
    };
  }),
  // High catwalk U-turn over the city: out, east turn, and back to the roof.
  {
    id: "geo_catwalk_out_west",
    position: { x: 15.9, y: 5.1, z: -122.8 },
    size: { x: 15.8, y: 0.2, z: 3.2 },
    surfaceId: "surface_catwalk",
    material: "roof",
  },
  {
    id: "geo_catwalk_out_east",
    position: { x: 36, y: 5.1, z: -122.8 },
    size: { x: 20, y: 0.2, z: 3.2 },
    surfaceId: "surface_catwalk",
    material: "roof",
  },
  {
    id: "geo_catwalk_return",
    position: { x: 32, y: 5.1, z: -130.8 },
    size: { x: 48, y: 0.2, z: 3.2 },
    surfaceId: "surface_catwalk",
    material: "roof",
  },
  {
    id: "geo_catwalk_barrier",
    position: { x: 34, y: 5.45, z: -130.8 },
    size: { x: 0.5, y: 0.5, z: 3.2 },
    surfaceId: "surface_boundary",
    material: "metal",
  },
  {
    id: "geo_catwalk_turn",
    position: { x: 51, y: 5.1, z: -126.8 },
    size: { x: 10, y: 0.2, z: 11.2 },
    surfaceId: "surface_catwalk",
    material: "roof",
  },
  ...[
    ["geo_catwalk_rail_out_north", 27, 5.75, -121.2, 38, 1.1, 0.16],
    ["geo_catwalk_rail_out_south", 27, 5.75, -124.4, 38, 1.1, 0.16],
    ["geo_catwalk_rail_return_north", 27, 5.75, -129.2, 38, 1.1, 0.16],
    ["geo_catwalk_rail_return_south_west", 19, 5.75, -132.4, 22, 1.1, 0.16],
    ["geo_catwalk_rail_return_south_east", 47, 5.75, -132.4, 18, 1.1, 0.16],
    ["geo_catwalk_rail_turn_east", 56.1, 5.75, -126.8, 0.16, 1.1, 11.2],
  ].map(([id, x, y, z, sx, sy, sz]) => ({
    id: id as string,
    position: { x: x as number, y: y as number, z: z as number },
    size: { x: sx as number, y: sy as number, z: sz as number },
    surfaceId: "surface_boundary",
    material: "glass" as const,
  })),
  // Optional lower bypass around the return barrier, with 0.2 m steps back up.
  {
    id: "geo_catwalk_bypass",
    position: { x: 34, y: 4.7, z: -135.3 },
    size: { x: 8, y: 0.2, z: 3.0 },
    surfaceId: "surface_catwalk",
    material: "metal",
  },
  {
    id: "geo_bypass_step_west",
    position: { x: 31, y: 4.9, z: -133.1 },
    size: { x: 2, y: 0.2, z: 1.4 },
    surfaceId: "surface_catwalk",
    material: "metal",
  },
  {
    id: "geo_bypass_step_east",
    position: { x: 37, y: 4.9, z: -133.1 },
    size: { x: 2, y: 0.2, z: 1.4 },
    surfaceId: "surface_catwalk",
    material: "metal",
  },
  ...[
    ["geo_bypass_rail_south", 34, 5.35, -136.85, 8, 1.1, 0.16],
    ["geo_bypass_rail_west", 29.9, 5.35, -134.3, 0.16, 1.1, 2.8],
    ["geo_bypass_rail_east", 38.1, 5.35, -134.3, 0.16, 1.1, 2.8],
  ].map(([id, x, y, z, sx, sy, sz]) => ({
    id: id as string,
    position: { x: x as number, y: y as number, z: z as number },
    size: { x: sx as number, y: sy as number, z: sz as number },
    surfaceId: "surface_boundary",
    material: "glass" as const,
  })),
  {
    id: "geo_final_deck",
    position: { x: 0, y: 5.1, z: -127.15 },
    size: { x: 16, y: 0.2, z: 15.7 },
    surfaceId: "surface_concrete",
    material: "roof",
  },
  {
    id: "geo_final_parapet_west",
    position: { x: -8.2, y: 5.7, z: -127.15 },
    size: { x: PARAPET_THICKNESS, y: 1, z: 15.7 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_final_parapet_east_north",
    position: { x: 8.2, y: 5.7, z: -120.25 },
    size: { x: PARAPET_THICKNESS, y: 1, z: 1.9 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_final_parapet_east_middle",
    position: { x: 8.2, y: 5.7, z: -126.8 },
    size: { x: PARAPET_THICKNESS, y: 1, z: 4.8 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_final_parapet_east_south",
    position: { x: 8.2, y: 5.7, z: -133.7 },
    size: { x: PARAPET_THICKNESS, y: 1, z: 2.6 },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_final_parapet_south_west",
    position: { x: -5, y: 5.7, z: -119.3 },
    size: { x: 6.4, y: 1, z: PARAPET_THICKNESS },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_final_parapet_south_east",
    position: { x: 5, y: 5.7, z: -119.3 },
    size: { x: 6.4, y: 1, z: PARAPET_THICKNESS },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  {
    id: "geo_final_parapet_north",
    position: { x: 0, y: 5.7, z: -135 },
    size: { x: 16.4, y: 1, z: PARAPET_THICKNESS },
    surfaceId: "surface_boundary",
    material: "facade",
  },
  // Interaction terminal and finish marker on the high roof.
  {
    id: "geo_terminal_finish",
    position: { x: 2.5, y: 5.82, z: -131.5 },
    size: { x: 0.6, y: 1.2, z: 0.6 },
    surfaceId: "surface_terminal",
    material: "metal",
  },
  {
    id: "geo_finish_marker",
    position: { x: 6, y: 6.3, z: -131.5 },
    size: { x: 0.5, y: 2.2, z: 0.5 },
    surfaceId: "surface_marker",
    material: "red",
  },
  {
    id: "geo_marker",
    position: { x: 6, y: 1.1, z: -8 },
    size: { x: 0.5, y: 2.2, z: 0.5 },
    surfaceId: "surface_marker",
    material: "red",
  },
];

function sectionForPosition(position: LevelVector3, sectionForZ: (z: number) => string): string {
  return sectionForZ(position.z);
}

export function createPrologueArenaGeometry(
  sectionForZ: (z: number) => string,
): LevelGeometryDefinition[] {
  return PROLOGUE_ARENA_BOXES.map((box) => ({
    id: box.id,
    sectionId: sectionForPosition(box.position, sectionForZ),
    position: box.position,
    size: box.size,
    surfaceId: box.surfaceId,
    material: box.material,
  }));
}

export function createPrologueArenaSurfaces(
  sectionForSurfaceId: (surfaceId: string) => string,
): LevelSurfaceDefinition[] {
  return createArenaSurfaces(sectionForSurfaceId);
}
