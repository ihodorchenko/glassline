import type { LevelGeometryDefinition, LevelSurfaceDefinition, LevelVector3 } from "../LevelTypes";

export const ARENA_COLORS = {
  concrete: 0xc7c9c7,
  pureWhite: 0xf1f1ed,
  steel: 0x747a7d,
  darkMetal: 0x33393d,
  boundary: 0xd8d9d4,
  runnerRed: 0xd52e36,
} as const;

export interface ArenaBox {
  readonly id: string;
  readonly position: LevelVector3;
  readonly size: LevelVector3;
  readonly surfaceId: string;
  readonly color: number;
}

export const ARENA_BOXES: readonly ArenaBox[] = [
  // Ground plates (a square fall pit remains at x/z in [8, 14] x [2, 8]).
  {
    id: "geo_ground_west",
    position: { x: -7, y: -0.1, z: 0 },
    size: { x: 30, y: 0.2, z: 44 },
    surfaceId: "surface_concrete",
    color: ARENA_COLORS.concrete,
  },
  {
    id: "geo_ground_east",
    position: { x: 18, y: -0.1, z: 0 },
    size: { x: 8, y: 0.2, z: 44 },
    surfaceId: "surface_concrete",
    color: ARENA_COLORS.concrete,
  },
  {
    id: "geo_ground_north",
    position: { x: 11, y: -0.1, z: -10 },
    size: { x: 6, y: 0.2, z: 24 },
    surfaceId: "surface_concrete",
    color: ARENA_COLORS.concrete,
  },
  {
    id: "geo_ground_south",
    position: { x: 11, y: -0.1, z: 15 },
    size: { x: 6, y: 0.2, z: 14 },
    surfaceId: "surface_concrete",
    color: ARENA_COLORS.concrete,
  },
  // Boundary walls.
  {
    id: "geo_wall_west",
    position: { x: -22.25, y: 1.5, z: 0 },
    size: { x: 0.5, y: 3, z: 44 },
    surfaceId: "surface_boundary",
    color: ARENA_COLORS.boundary,
  },
  {
    id: "geo_wall_east",
    position: { x: 22.25, y: 1.5, z: 0 },
    size: { x: 0.5, y: 3, z: 44 },
    surfaceId: "surface_boundary",
    color: ARENA_COLORS.boundary,
  },
  {
    id: "geo_wall_north",
    position: { x: 0, y: 1.5, z: -22.25 },
    size: { x: 44, y: 3, z: 0.5 },
    surfaceId: "surface_boundary",
    color: ARENA_COLORS.boundary,
  },
  {
    id: "geo_wall_south",
    position: { x: 0, y: 1.5, z: 22.25 },
    size: { x: 44, y: 3, z: 0.5 },
    surfaceId: "surface_boundary",
    color: ARENA_COLORS.boundary,
  },
  // Vault obstacle.
  {
    id: "geo_vault_obstacle",
    position: { x: 0, y: 0.375, z: -1 },
    size: { x: 2.4, y: 0.75, z: 0.7 },
    surfaceId: "surface_vault",
    color: ARENA_COLORS.pureWhite,
  },
  // Steps.
  {
    id: "geo_step_low",
    position: { x: 4, y: 0.09, z: 1 },
    size: { x: 1.6, y: 0.18, z: 1.6 },
    surfaceId: "surface_step",
    color: ARENA_COLORS.pureWhite,
  },
  {
    id: "geo_step_high",
    position: { x: 4, y: 0.15, z: -0.8 },
    size: { x: 1.6, y: 0.3, z: 1.6 },
    surfaceId: "surface_step",
    color: ARENA_COLORS.pureWhite,
  },
  // Slide tunnel.
  {
    id: "geo_tunnel_west",
    position: { x: -1.9, y: 1.3, z: -7.6 },
    size: { x: 0.4, y: 2.6, z: 4 },
    surfaceId: "surface_tunnel",
    color: ARENA_COLORS.steel,
  },
  {
    id: "geo_tunnel_east",
    position: { x: 1.9, y: 1.3, z: -7.6 },
    size: { x: 0.4, y: 2.6, z: 4 },
    surfaceId: "surface_tunnel",
    color: ARENA_COLORS.steel,
  },
  {
    id: "geo_tunnel_ceiling",
    position: { x: 0, y: 1.15, z: -7.6 },
    size: { x: 4, y: 0.2, z: 4 },
    surfaceId: "surface_tunnel",
    color: ARENA_COLORS.steel,
  },
  // Wall-run corridor.
  {
    id: "geo_wallrun_west",
    position: { x: -2.4, y: 1.7, z: -12.5 },
    size: { x: 0.4, y: 3.4, z: 7 },
    surfaceId: "surface_wallrun",
    color: ARENA_COLORS.pureWhite,
  },
  {
    id: "geo_wallrun_east",
    position: { x: 2.4, y: 1.7, z: -12.5 },
    size: { x: 0.4, y: 3.4, z: 7 },
    surfaceId: "surface_wallrun",
    color: ARENA_COLORS.pureWhite,
  },
  // Interaction terminal and navigation marker.
  {
    id: "geo_terminal",
    position: { x: 2.5, y: 0.6, z: -18 },
    size: { x: 0.6, y: 1.2, z: 0.6 },
    surfaceId: "surface_terminal",
    color: ARENA_COLORS.darkMetal,
  },
  {
    id: "geo_marker",
    position: { x: 6, y: 1.1, z: -8 },
    size: { x: 0.5, y: 2.2, z: 0.5 },
    surfaceId: "surface_marker",
    color: ARENA_COLORS.runnerRed,
  },
];

type SurfaceMetadata = Omit<LevelSurfaceDefinition, "sectionId">;

export const ARENA_SURFACES: readonly SurfaceMetadata[] = [
  {
    id: "surface_concrete",
    surfaceType: "concrete",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
  },
  {
    id: "surface_vault",
    surfaceType: "concrete",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: true,
  },
  {
    id: "surface_step",
    surfaceType: "concrete",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
  },
  {
    id: "surface_boundary",
    surfaceType: "metal",
    walkable: false,
    landingSurface: false,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
    metadata: { role: "boundary" },
  },
  {
    id: "surface_tunnel",
    surfaceType: "metal",
    walkable: false,
    landingSurface: false,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
    metadata: { role: "slide-clearance" },
  },
  {
    id: "surface_wallrun",
    surfaceType: "concrete",
    walkable: false,
    landingSurface: false,
    wallRunSurface: true,
    wallJumpSurface: true,
    vaultObstacle: false,
  },
  {
    id: "surface_terminal",
    surfaceType: "metal",
    walkable: false,
    landingSurface: false,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
    metadata: { role: "interactable" },
  },
  {
    id: "surface_catwalk",
    surfaceType: "metal",
    walkable: true,
    landingSurface: true,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
    metadata: { role: "catwalk" },
  },
  {
    id: "surface_marker",
    surfaceType: "concrete",
    walkable: false,
    landingSurface: false,
    wallRunSurface: false,
    wallJumpSurface: false,
    vaultObstacle: false,
    metadata: { role: "navigation" },
  },
];

export function createArenaGeometry(
  sectionForPosition: (position: LevelVector3) => string,
): LevelGeometryDefinition[] {
  return ARENA_BOXES.map((box) => ({
    id: box.id,
    sectionId: sectionForPosition(box.position),
    position: box.position,
    size: box.size,
    surfaceId: box.surfaceId,
    color: box.color,
  }));
}

export function createArenaSurfaces(
  sectionForSurfaceId: (surfaceId: string) => string,
): LevelSurfaceDefinition[] {
  return ARENA_SURFACES.map((surface) => ({
    ...surface,
    sectionId: sectionForSurfaceId(surface.id),
  }));
}
