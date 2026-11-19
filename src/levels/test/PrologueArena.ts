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
    id: "geo_parapet_north",
    position: { x: 0, y: PARAPET_HEIGHT / 2, z: -22.2 },
    size: { x: 44.4, y: PARAPET_HEIGHT, z: PARAPET_THICKNESS },
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
  // Interaction terminal and navigation marker.
  {
    id: "geo_terminal",
    position: { x: 2.5, y: 0.6, z: -18 },
    size: { x: 0.6, y: 1.2, z: 0.6 },
    surfaceId: "surface_terminal",
    material: "metal",
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
