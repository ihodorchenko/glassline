/**
 * Architectural Kit — demonstration composition layout.
 *
 * A rooftop architecture court that shows the kit as one designed ensemble
 * instead of a module line-up: a long deep-reveal facade wing, a fully glazed
 * atrium volume with expressed corners, an east tower served by an aerial
 * bridge, a canopy / cantilever / colonnade cluster at the entrance, and a
 * low technical annex across the court. Every placement is authored in world
 * metres; repeated module variants share generated geometry and instanced draw
 * batches.
 *
 * This is a review composition, not a gameplay level: the plaza is walkable,
 * the architecture is visual-only and owns no collider (`docs/06` §3.4,
 * `docs/04` §10).
 */

import type { ArchitecturalModuleDefinition } from "../architecture/KitTypes";
import type {
  LevelArchitecturePlacement,
  LevelDecorationDefinition,
  LevelEnvironmentDefinition,
  LevelGeometryDefinition,
  LevelMaterialType,
  LevelSurfaceDefinition,
} from "../LevelTypes";

export const KIT_DEMO_SECTION_ID = "sec_kit_plaza";

/** Daylight calibrated for a clean reading of white concrete and deep reveals. */
export const KIT_DEMO_ENVIRONMENT: LevelEnvironmentDefinition = {
  skyColor: 0x9fc4e4,
  fogColor: 0xdfeaf4,
  fogNear: 85,
  fogFar: 430,
  sunColor: 0xfff6ea,
  sunIntensity: 7.0,
  hemisphereIntensity: 0.26,
  zenithColor: 0x2456c8,
  horizonColor: 0xe6eff8,
  groundColor: 0xbfcedb,
  cloudColor: 0xfafafa,
  cloudShadowColor: 0xb9c8d8,
  cloudCover: 0.46,
  sunAzimuth: 2.05,
  sunElevation: 0.86,
};

/* -------------------------------------------------------------------------- */
/* Authored module variants                                                   */
/* -------------------------------------------------------------------------- */

const FACADE_BAY: ArchitecturalModuleDefinition = { kind: "facade-bay", width: 4.2, height: 4.2 };
const CURTAIN_WALL_6: ArchitecturalModuleDefinition = {
  kind: "curtain-wall",
  width: 6,
  height: 4.2,
  columns: 3,
  rows: 1,
  spandrel: true,
};
const CURTAIN_WALL_4: ArchitecturalModuleDefinition = {
  kind: "curtain-wall",
  width: 4,
  height: 4.2,
  columns: 2,
  rows: 1,
  spandrel: true,
};
const CORNER_3_HERO: ArchitecturalModuleDefinition = {
  kind: "corner",
  width: 3,
  depth: 3,
  height: 12.6,
  accent: true,
};
const CORNER_3_PLAIN: ArchitecturalModuleDefinition = {
  kind: "corner",
  width: 3,
  depth: 3,
  height: 12.6,
  accent: false,
};
const CORNER_2: ArchitecturalModuleDefinition = {
  kind: "corner",
  width: 2,
  depth: 2,
  height: 12.6,
  accent: false,
};
const COLUMN_CANOPY: ArchitecturalModuleDefinition = { kind: "column", height: 4.25, width: 0.8 };
const COLUMN_TERRACE: ArchitecturalModuleDefinition = { kind: "column", height: 3.75, width: 0.7 };
const CANTILEVER: ArchitecturalModuleDefinition = {
  kind: "cantilever",
  width: 6,
  depth: 3,
  thickness: 0.7,
  railing: true,
};
const CANOPY: ArchitecturalModuleDefinition = {
  kind: "canopy",
  width: 7,
  depth: 3.4,
  thickness: 0.24,
  tensionRods: true,
};
const BRIDGE: ArchitecturalModuleDefinition = {
  kind: "bridge",
  length: 15,
  width: 3.2,
  height: 3.4,
  bays: 5,
};
const STAIR: ArchitecturalModuleDefinition = {
  kind: "stair",
  width: 2.4,
  height: 4.2,
  run: 5.2,
  steps: 24,
  railing: true,
  glassInfill: true,
};
const PARAPET_WING: ArchitecturalModuleDefinition = {
  kind: "parapet",
  length: 8.4,
  height: 1.1,
  accent: true,
};
const PARAPET_ATRIUM: ArchitecturalModuleDefinition = {
  kind: "parapet",
  length: 12,
  height: 1.1,
  accent: true,
};
const PARAPET_TOWER: ArchitecturalModuleDefinition = {
  kind: "parapet",
  length: 10,
  height: 1.1,
  accent: true,
};
const SERVICE_PORTAL: ArchitecturalModuleDefinition = {
  kind: "service-portal",
  width: 2.8,
  height: 3,
  depth: 0.7,
  louvered: true,
};
const VENTILATION_LARGE: ArchitecturalModuleDefinition = {
  kind: "ventilation",
  width: 2.8,
  height: 2.4,
  depth: 1.0,
  blades: 6,
};
const VENTILATION_ROOF: ArchitecturalModuleDefinition = {
  kind: "ventilation",
  width: 2.2,
  height: 1.6,
  depth: 0.8,
  blades: 4,
};
const LOUVER: ArchitecturalModuleDefinition = {
  kind: "louver",
  width: 4,
  height: 4,
  depth: 0.45,
  bladeCount: 15,
};
const RAILING_PLAZA: ArchitecturalModuleDefinition = { kind: "glass-railing", length: 54 };
const RAILING_TERRACE_SIDE: ArchitecturalModuleDefinition = {
  kind: "glass-railing",
  length: 5,
};
const RAILING_TERRACE_EDGE: ArchitecturalModuleDefinition = {
  kind: "glass-railing",
  length: 4.8,
};
const SCREEN_PLANT: ArchitecturalModuleDefinition = {
  kind: "facade-screen",
  width: 5,
  height: 2.8,
  ribbons: 6,
  depth: 0.35,
};
const SCREEN_ANNEX: ArchitecturalModuleDefinition = {
  kind: "facade-screen",
  width: 5,
  height: 4.2,
  ribbons: 10,
  depth: 0.4,
};
const SCREEN_TOWER: ArchitecturalModuleDefinition = {
  kind: "facade-screen",
  width: 8,
  height: 4.2,
  ribbons: 10,
  depth: 0.4,
};
const JOINT_WING: ArchitecturalModuleDefinition = {
  kind: "joint",
  width: 0.9,
  height: 8.4,
  depth: 0.5,
};

/* -------------------------------------------------------------------------- */
/* Placement authoring                                                        */
/* -------------------------------------------------------------------------- */

interface Composer {
  readonly placements: LevelArchitecturePlacement[];
  nextId: number;
}

function kit(
  composer: Composer,
  module: ArchitecturalModuleDefinition,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): void {
  composer.placements.push({
    id: `kit_${composer.nextId++}`,
    sectionId: KIT_DEMO_SECTION_ID,
    module,
    position: { x, y, z },
    ...(rotationY === 0 ? {} : { rotationY }),
  });
}

function facadeWing(composer: Composer): void {
  for (const z of [-31.9, -36.1, -51.9, -56.1]) {
    for (const y of [0, 4.2]) {
      kit(composer, FACADE_BAY, -17, y, z, Math.PI / 2);
    }
  }

  kit(composer, JOINT_WING, -17, 0, -34, Math.PI / 2);
  kit(composer, JOINT_WING, -17, 0, -54, Math.PI / 2);
  kit(composer, PARAPET_WING, -17, 8.4, -34, Math.PI / 2);
  kit(composer, PARAPET_WING, -17, 8.4, -54, Math.PI / 2);

  // End-wall screens: the wing ends are a visible part of the ensemble, not
  // blank boxes, so they get the same louver language as the technical zones.
  kit(composer, LOUVER, -20.5, 0, -29.8, 0);
  kit(composer, LOUVER, -20.5, 0, -58.2, Math.PI);
}

function atrium(composer: Composer): void {
  for (const y of [0, 4.2, 8.4]) {
    kit(composer, CURTAIN_WALL_6, -5, y, -44, Math.PI / 2);
    kit(composer, CURTAIN_WALL_6, -17, y, -44, -Math.PI / 2);
    kit(composer, CURTAIN_WALL_6, -11, y, -50, Math.PI);
    kit(composer, CURTAIN_WALL_6, -11, y, -38, 0);
  }

  kit(composer, CORNER_3_HERO, -5, 0, -38, 0);
  kit(composer, CORNER_3_HERO, -5, 0, -50, Math.PI / 2);
  kit(composer, CORNER_3_PLAIN, -17, 0, -38, -Math.PI / 2);
  kit(composer, CORNER_3_PLAIN, -17, 0, -50, Math.PI);

  kit(composer, PARAPET_ATRIUM, -11, 13.0, -38, 0);
  kit(composer, PARAPET_ATRIUM, -11, 13.0, -50, 0);
  kit(composer, PARAPET_ATRIUM, -5, 13.0, -44, Math.PI / 2);
  kit(composer, PARAPET_ATRIUM, -17, 13.0, -44, Math.PI / 2);
}

function atriumEntrance(composer: Composer): void {
  // South face: cantilevered balcony over a thin tensile canopy on two columns.
  kit(composer, CANTILEVER, -11, 8.4, -38, 0);
  kit(composer, CANOPY, -11, 4.2, -38, 0);
  kit(composer, COLUMN_CANOPY, -13.3, 0, -35.3);
  kit(composer, COLUMN_CANOPY, -8.7, 0, -35.3);
}

function tower(composer: Composer): void {
  // Expressed 2 m corners turn the concrete mass; the west face is glazed
  // between them and receives the skybridge.
  kit(composer, CORNER_2, 10, 0, -38, -Math.PI / 2);
  kit(composer, CORNER_2, 10, 0, -50, Math.PI);

  for (const y of [0, 4.2, 8.4]) {
    kit(composer, CURTAIN_WALL_4, 10, y, -42, -Math.PI / 2);
    kit(composer, CURTAIN_WALL_4, 10, y, -46, -Math.PI / 2);
    kit(composer, CURTAIN_WALL_6, 20, y, -41, Math.PI / 2);
    kit(composer, CURTAIN_WALL_6, 20, y, -47, Math.PI / 2);
    kit(composer, SCREEN_TOWER, 16, y, -50, Math.PI);
  }

  // North face: intake at grade under the terrace, louvers at the middle floor,
  // a ribbon screen at the top.
  kit(composer, VENTILATION_LARGE, 13, 0, -38, 0);
  kit(composer, VENTILATION_LARGE, 16.8, 0, -38, 0);
  kit(composer, LOUVER, 13, 4.2, -38, 0);
  kit(composer, LOUVER, 17, 4.2, -38, 0);
  kit(composer, SCREEN_TOWER, 16, 8.4, -38, 0);

  kit(composer, PARAPET_TOWER, 15, 13.0, -38, 0);
  kit(composer, PARAPET_TOWER, 15, 13.0, -50, 0);
  kit(composer, PARAPET_ATRIUM, 10, 13.0, -44, Math.PI / 2);
  kit(composer, PARAPET_ATRIUM, 20, 13.0, -44, Math.PI / 2);

  kit(composer, VENTILATION_ROOF, 12.5, 13.0, -47);
  kit(composer, VENTILATION_ROOF, 17.5, 13.0, -47);
}

function skybridge(composer: Composer): void {
  kit(composer, BRIDGE, 2.5, 8.4, -44);
}

function terraceAndStair(composer: Composer): void {
  // Stair rises from the plaza to a terrace held on two columns against the
  // tower's north face.
  kit(composer, STAIR, 14, 0, -28, Math.PI);
  kit(composer, COLUMN_TERRACE, 10.5, 0, -36.2);
  kit(composer, COLUMN_TERRACE, 17.5, 0, -36.2);
  kit(composer, RAILING_TERRACE_SIDE, 8, 4.2, -36.2, Math.PI / 2);
  kit(composer, RAILING_TERRACE_SIDE, 20, 4.2, -36.2, Math.PI / 2);
  kit(composer, RAILING_TERRACE_EDGE, 10.4, 4.2, -34.35, 0);
  kit(composer, RAILING_TERRACE_EDGE, 17.6, 4.2, -34.35, 0);
}

function serviceAnnex(composer: Composer): void {
  kit(composer, VENTILATION_LARGE, -10.2, 0, -60);
  kit(composer, FACADE_BAY, -6.2, 0, -60);
  kit(composer, FACADE_BAY, -2.0, 0, -60);
  kit(composer, SERVICE_PORTAL, 1.9, 0, -60);
  kit(composer, LOUVER, 5.6, 0, -60);
  kit(composer, SCREEN_ANNEX, 8, 0, -64, Math.PI / 2);

  kit(composer, VENTILATION_ROOF, 2, 4.55, -63);
  kit(composer, VENTILATION_ROOF, 4.8, 4.55, -63);
  kit(composer, SCREEN_PLANT, -4.5, 4.55, -61.8, 0);
}

function plazaEdge(composer: Composer): void {
  kit(composer, RAILING_PLAZA, 25.9, 0, -51, Math.PI / 2);
  kit(composer, RAILING_PLAZA, -25.9, 0, -51, Math.PI / 2);
}

/** Every authored Architectural Kit placement in the demonstration court. */
export function createKitDemoPlacements(): readonly LevelArchitecturePlacement[] {
  const composer: Composer = { placements: [], nextId: 0 };

  facadeWing(composer);
  atrium(composer);
  atriumEntrance(composer);
  tower(composer);
  skybridge(composer);
  terraceAndStair(composer);
  serviceAnnex(composer);
  plazaEdge(composer);

  return composer.placements;
}

/* -------------------------------------------------------------------------- */
/* Context masses and props (authored decorations, visual-only)               */
/* -------------------------------------------------------------------------- */

interface DecorationOptions {
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

function decoration(
  out: LevelDecorationDefinition[],
  id: string,
  position: readonly [number, number, number],
  size: readonly [number, number, number],
  material: LevelMaterialType,
  options: DecorationOptions = {},
): void {
  out.push({
    id,
    sectionId: KIT_DEMO_SECTION_ID,
    shape: "box",
    position: { x: position[0], y: position[1], z: position[2] },
    size: { x: size[0], y: size[1], z: size[2] },
    material,
    ...(options.castShadow === undefined ? {} : { castShadow: options.castShadow }),
    ...(options.receiveShadow === undefined ? {} : { receiveShadow: options.receiveShadow }),
  });
}

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

/** Distant city massing: context and scale, never gameplay geometry. */
function addContextCity(out: LevelDecorationDefinition[]): void {
  const random = createRandom(0x4b1d0d);
  const shellMaterials: readonly LevelMaterialType[] = ["facade", "white", "glass", "concrete"];
  const baseY = -12.3;
  const centerZ = -51;

  for (let index = 0; index < 30; index += 1) {
    const angle = (index / 30) * Math.PI * 2 + (random() - 0.5) * 0.14;
    const radius = 102 + random() * 108;
    const x = Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    const width = 12 + random() * 20;
    const depth = 12 + random() * 20;
    const height = 16 + random() * 46;
    const material = shellMaterials[index % shellMaterials.length] ?? "facade";

    decoration(out, `city_${index}`, [x, baseY + height / 2, z], [width, height, depth], material, {
      castShadow: false,
      receiveShadow: false,
    });

    // Roof cap gives the distant silhouette a designed top edge.
    decoration(
      out,
      `city_cap_${index}`,
      [x, baseY + height + 0.5, z],
      [width + 0.8, 1.0, depth + 0.8],
      index % 3 === 0 ? "roof" : "dark-metal",
      { castShadow: false, receiveShadow: false },
    );

    // Window bands on the face that looks towards the composition: context
    // towers read as inhabited buildings instead of blank boxes.
    const facesX = Math.abs(x) >= Math.abs(z - centerZ);
    const bandCount = 4 + Math.floor(random() * 3);

    for (let band = 0; band < bandCount; band += 1) {
      const y = baseY + height * (0.14 + (band / Math.max(1, bandCount - 1)) * 0.72);

      if (facesX) {
        const bandX = x + (x > 0 ? -(width / 2 + 0.06) : width / 2 + 0.06);

        decoration(
          out,
          `city_win_${index}_${band}`,
          [bandX, y, z],
          [0.12, 1.15, depth * 0.72],
          "glass-far",
          { castShadow: false, receiveShadow: false },
        );
      } else {
        const bandZ = z + (z > centerZ ? -(depth / 2 + 0.06) : depth / 2 + 0.06);

        decoration(
          out,
          `city_win_${index}_${band}`,
          [x, y, bandZ],
          [width * 0.72, 1.15, 0.12],
          "glass-far",
          { castShadow: false, receiveShadow: false },
        );
      }
    }
  }
}

/** Authored visual masses that give the kit modules a building to belong to. */
export function createKitDemoDecorations(): readonly LevelDecorationDefinition[] {
  const out: LevelDecorationDefinition[] = [];

  // Site: a wide roof deck on a podium, grounded in a lower city layer.
  decoration(out, "podium", [0, -6.6, -51], [60, 11.4, 58], "concrete");
  decoration(out, "ground", [0, -12.6, -51], [360, 0.6, 360], "asphalt", {
    castShadow: false,
    receiveShadow: false,
  });

  // Facade wing masses. Their front faces sit behind the facade-bay reveal
  // depth so the glass is never swallowed by the mass.
  decoration(out, "wing_north", [-21.3, 4.2, -34], [7, 8.4, 8.4], "concrete");
  decoration(out, "wing_south", [-21.3, 4.2, -54], [7, 8.4, 8.4], "concrete");

  // Atrium: dark interior cavity and warm roof deck under the parapet.
  decoration(out, "atrium_interior", [-11.1, 6.2, -44.1], [11.4, 12.4, 11.4], "glass-far", {
    castShadow: false,
  });
  decoration(out, "atrium_roof", [-11, 12.8, -44], [12.4, 0.4, 12.4], "roof");

  // East tower mass and roof deck, inset behind the glazed faces.
  decoration(out, "tower_mass", [15, 6.3, -44.5], [9.2, 12.6, 10.8], "white");
  decoration(out, "tower_roof", [15, 12.8, -44], [10.3, 0.4, 12.3], "roof");

  // Technical annex volume, roof deck and expressed fascia edge.
  decoration(out, "annex_mass", [-2, 2.1, -64.7], [19.4, 4.2, 7.0], "concrete");
  decoration(out, "annex_roof", [-2, 4.375, -64.2], [20.3, 0.35, 8.0], "roof");
  decoration(out, "annex_fascia", [-2, 4.5, -60.12], [20.4, 0.1, 0.16], "dark-metal");
  decoration(out, "annex_plant_room", [-4.5, 5.95, -64], [7.2, 2.8, 4.4], "concrete");

  // Stair terrace deck.
  decoration(out, "terrace", [14, 3.975, -36.2], [12.2, 0.45, 3.7], "white");

  // Entrance court: a warm composite paving field, a dark-sided reflection
  // pool and two long benches scale the plaza in front of the atrium and keep
  // the deck from reading as empty ground.
  decoration(out, "court_paving", [-4, 0.012, -33], [32, 0.024, 18], "composite", {
    castShadow: false,
    receiveShadow: false,
  });
  decoration(out, "pool_basin", [0, -0.03, -31], [7.2, 0.12, 9.2], "dark-metal", {
    castShadow: false,
    receiveShadow: false,
  });
  decoration(out, "pool_surface", [0, 0.06, -31], [7, 0.04, 9], "glass", {
    castShadow: false,
    receiveShadow: false,
  });
  decoration(out, "pool_rim_north", [0, 0.06, -26.35], [8.0, 0.12, 0.3], "concrete");
  decoration(out, "pool_rim_south", [0, 0.06, -35.65], [8.0, 0.12, 0.3], "concrete");
  decoration(out, "pool_rim_east", [3.65, 0.06, -31], [0.3, 0.12, 9.6], "concrete");
  decoration(out, "pool_rim_west", [-3.65, 0.06, -31], [0.3, 0.12, 9.6], "concrete");
  decoration(out, "bench_east_base", [6.2, 0.15, -31], [1.0, 0.3, 5.4], "dark-metal");
  decoration(out, "bench_east_seat", [6.2, 0.35, -31], [1.18, 0.1, 5.5], "white");
  decoration(out, "bench_west_base", [-6.2, 0.15, -31], [1.0, 0.3, 5.4], "dark-metal");
  decoration(out, "bench_west_seat", [-6.2, 0.35, -31], [1.18, 0.1, 5.5], "white");

  // Podium articulation: facade joints and a shadow reveal tie the plinth into
  // the same construction language as the buildings above.
  for (let index = 0; index < 9; index += 1) {
    decoration(
      out,
      `podium_joint_east_${index}`,
      [30.04, -7.4, -76 + index * 6],
      [0.16, 8.8, 0.22],
      "dark-metal",
      { castShadow: false, receiveShadow: false },
    );
    decoration(
      out,
      `podium_joint_north_${index}`,
      [-28 + index * 7, -7.4, -22.04],
      [0.22, 8.8, 0.16],
      "dark-metal",
      { castShadow: false, receiveShadow: false },
    );
  }

  decoration(out, "podium_reveal_east", [30.04, -1.5, -51], [0.18, 0.3, 58], "dark-metal", {
    castShadow: false,
    receiveShadow: false,
  });
  decoration(out, "podium_reveal_north", [0, -1.5, -22.04], [60, 0.3, 0.18], "dark-metal", {
    castShadow: false,
    receiveShadow: false,
  });

  addContextCity(out);

  return out;
}

/* -------------------------------------------------------------------------- */
/* Physical site layer                                                        */
/* -------------------------------------------------------------------------- */

/** The only physical element of the composition: the plaza deck itself. */
export function createKitDemoGeometry(): readonly LevelGeometryDefinition[] {
  return [
    {
      id: "geo_plaza_deck",
      sectionId: KIT_DEMO_SECTION_ID,
      position: { x: 0, y: -0.45, z: -48 },
      size: { x: 64, y: 0.9, z: 56 },
      surfaceId: "surface_plaza",
      material: "concrete",
    },
  ];
}

export function createKitDemoSurfaces(): readonly LevelSurfaceDefinition[] {
  return [
    {
      id: "surface_plaza",
      sectionId: KIT_DEMO_SECTION_ID,
      surfaceType: "concrete",
      walkable: true,
      landingSurface: true,
      wallRunSurface: false,
      wallJumpSurface: false,
      vaultObstacle: false,
    },
  ];
}
