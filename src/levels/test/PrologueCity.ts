import type { LevelDecorationDefinition, LevelMaterialType } from "../LevelTypes";

type SectionResolver = (z: number) => string;

interface BoxOptions {
  /** Semantic PBR material; omitted when the box is a flat authored colour. */
  readonly material?: LevelMaterialType;
  readonly rotationX?: number;
  readonly rotationY?: number;
  readonly rotationZ?: number;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly color?: number;
  readonly opacity?: number;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
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

class CityBuilder {
  readonly decorations: LevelDecorationDefinition[] = [];
  private nextId = 0;

  constructor(
    private readonly sectionForZ: SectionResolver,
    private readonly random: () => number,
  ) {}

  box(
    x: number,
    y: number,
    z: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    options: BoxOptions,
  ): void {
    this.decorations.push({
      id: `city_${this.nextId++}`,
      sectionId: this.sectionForZ(z),
      shape: "box",
      position: { x, y, z },
      size: { x: sizeX, y: sizeY, z: sizeZ },
      ...options,
    });
  }

  plane(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    rotationY: number,
    options: {
      readonly text: string;
      readonly background: number;
      readonly textColor: number;
      readonly accentColor: number;
    },
  ): void {
    this.decorations.push({
      id: `city_${this.nextId++}`,
      sectionId: this.sectionForZ(z),
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

  cylinder(
    x: number,
    y: number,
    z: number,
    diameter: number,
    height: number,
    options: BoxOptions,
  ): void {
    this.decorations.push({
      id: `city_${this.nextId++}`,
      sectionId: this.sectionForZ(z),
      shape: "cylinder",
      position: { x, y, z },
      size: { x: diameter, y: height, z: diameter },
      ...options,
    });
  }

  /** Deterministic fraction in [0, 1). */
  chance(): number {
    return this.random();
  }
}

const GROUND_Y = -31;

function addParapetCoping(builder: CityBuilder): void {
  const coping = 0.5;

  builder.box(11.2, 1.08, 0, coping, 0.08, 44.6, { material: "dark-metal" });
  builder.box(0, 1.08, -22.2, 44.6, 0.08, coping, { material: "dark-metal" });
  builder.box(0, 1.08, 22.2, 44.6, 0.08, coping, { material: "dark-metal" });
  builder.box(-11.2, 1.08, 0, coping, 0.08, 44.6, { material: "dark-metal" });

  // A darker base band reads as years of runoff at the parapet foot.
  builder.box(11.18, 0.07, 0, 0.02, 0.14, 44.2, { material: "dark-metal", castShadow: false });
  builder.box(-11.18, 0.07, 0, 0.02, 0.14, 44.2, { material: "dark-metal", castShadow: false });
}

function addRoofExpansionJoints(builder: CityBuilder): void {
  // Cool dark-steel expansion joints break up the roof panels at human scale.
  // The darker steel reads as a structural seam without becoming a black hole.
  for (const z of [-16, -8, 0, 8, 16]) {
    builder.box(-3.2, 0.018, z, 15.6, 0.024, 0.05, {
      // The tunnel-floor joint (z -8) is seen at close range in the
      // service-block frame; a mid-grey steel seam reads as a joint instead of
      // a black hole. Other roof joints keep the cool dark steel.
      ...(z === -8 ? { color: 0x9aa0a4 } : { material: "dark-metal" as const }),
      castShadow: false,
    });
  }

  for (const z of [-16, -8, 0, 8, 16]) {
    builder.box(10, 0.018, z, 2, 0.024, 0.05, {
      material: "dark-metal",
      castShadow: false,
    });
  }
}

function addEdgeRailings(builder: CityBuilder): void {
  for (let z = -20; z <= 20; z += 4) {
    builder.box(10.9, 0.55, z, 0.05, 1.1, 0.05, { material: "metal", castShadow: true });
  }

  builder.box(10.9, 1.12, 0, 0.07, 0.07, 41.4, { material: "metal" });
}

function addPuddles(builder: CityBuilder): void {
  // Shallow rain puddles pick up the sky/parapet and break the dry white roof.
  const puddles: readonly [number, number, number][] = [
    [-5.2, 10.2, 2.6],
    [-3.2, 3.2, 2.4],
    [3.4, -4.4, 1.9],
    [-7.4, -12.8, 1.35],
    [8.6, 4.2, 2.1],
    [-2.8, 18.4, 1.6],
  ];

  for (const [x, z, diameter] of puddles) {
    builder.cylinder(x, 0.014, z, diameter, 0.008, {
      material: "water",
      castShadow: false,
      receiveShadow: false,
    });
  }
}

function addRoofRepairs(builder: CityBuilder): void {
  // Patched asphalt membrane strips read as maintenance history on a white roof.
  const patches: readonly [number, number, number, number, number][] = [
    [-5.5, 2.5, 2.4, 1.4, 0.06],
    [4.5, -12, 1.8, 2.4, -0.05],
    [-7.8, 15.2, 2.2, 1.6, 0.03],
    [8.8, -2, 1.5, 2.6, -0.08],
  ];

  for (const [x, z, width, depth, rotation] of patches) {
    builder.box(x, 0.012, z, width, 0.01, depth, {
      material: "membrane",
      rotationY: rotation,
      castShadow: false,
      receiveShadow: true,
    });
  }
}

function addSkylight(builder: CityBuilder): void {
  // Glass below the opening, with a visible frame grid.
  builder.box(7, -2.65, 5, 4.2, 0.08, 4.2, {
    material: "glass-far",
    castShadow: false,
    receiveShadow: false,
  });

  for (const offset of [-1.4, 0, 1.4]) {
    builder.box(7 + offset, -2.6, 5, 0.1, 0.14, 4.2, { material: "metal" });
    builder.box(7, -2.6, 5 + offset, 4.2, 0.14, 0.1, { material: "metal" });
  }

  // Railings on the far and outer edges of the pit.
  for (let x = 5; x <= 9; x += 2) {
    builder.box(x, 0.55, 2.55, 0.06, 1.1, 0.06, { material: "metal" });
  }

  builder.box(7, 1.1, 2.55, 4.2, 0.07, 0.07, { material: "metal" });

  for (let z = 3.5; z <= 6.5; z += 2) {
    builder.box(9.5, 0.55, z, 0.06, 1.1, 0.06, { material: "metal" });
  }

  builder.box(9.5, 1.1, 5, 0.07, 0.07, 3.4, { material: "metal" });
}

function addSolarArray(builder: CityBuilder): void {
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const x = 6.8 + column * 2.5;
      const z = -8.4 + row * 3.1;

      builder.box(x, 1.05, z, 2.2, 0.09, 2.4, {
        material: "glass",
        rotationX: -0.42,
        castShadow: true,
      });
      builder.box(x, 0.42, z, 0.12, 0.84, 0.12, { material: "metal" });
    }
  }

  builder.box(8.2, 0.32, -5.3, 5.6, 0.12, 9.8, { material: "dark-metal" });
}

function addAcUnit(builder: CityBuilder, x: number, z: number, rotationY = 0, scale = 1): void {
  const width = 2.4 * scale;
  const height = 1.5 * scale;
  const depth = 1.7 * scale;

  builder.box(x, height / 2 + 0.06, z, width, height, depth, {
    material: "metal",
    rotationY,
    castShadow: true,
  });
  builder.box(x, 0.05, z, width * 1.04, 0.12, depth * 1.04, {
    material: "dark-metal",
    rotationY,
  });
  builder.box(x, height + 0.18, z, width * 0.86, 0.18, depth * 0.86, {
    material: "dark-metal",
    rotationY,
  });

  const fanX = x + Math.cos(rotationY) * width * 0.26;
  const fanZ = z - Math.sin(rotationY) * width * 0.26;

  builder.cylinder(fanX, height + 0.28, fanZ, depth * 0.44, 0.08, {
    material: "metal",
    rotationY,
  });
  builder.cylinder(
    x - Math.cos(rotationY) * width * 0.26,
    height + 0.28,
    z + Math.sin(rotationY) * width * 0.26,
    depth * 0.44,
    0.08,
    {
      material: "metal",
      rotationY,
    },
  );

  for (let index = 0; index < 4; index += 1) {
    builder.box(
      x,
      0.3 + index * 0.26,
      z + (depth / 2 + 0.015) * Math.cos(rotationY),
      width * 0.68,
      0.06,
      0.03,
      { material: "dark-metal", rotationY },
    );
  }
}

function addDuctRun(builder: CityBuilder, x: number, zStart: number, length: number): void {
  builder.box(x, 0.62, zStart + length / 2, 0.86, 0.62, length, {
    material: "metal",
    castShadow: true,
  });
  builder.box(x, 0.94, zStart + length / 2, 1.02, 0.08, length + 0.3, {
    material: "dark-metal",
  });

  for (let z = zStart + 1; z < zStart + length; z += 2.4) {
    builder.box(x, 0.22, z, 0.9, 0.44, 0.16, { material: "dark-metal" });
  }
}

function addPipeRun(
  builder: CityBuilder,
  x: number,
  y: number,
  zStart: number,
  length: number,
): void {
  builder.cylinder(x, y, zStart + length / 2, 0.34, length, {
    material: "metal",
    rotationX: Math.PI / 2,
  });

  for (let z = zStart; z <= zStart + length; z += 2.2) {
    builder.cylinder(x, y, z, 0.48, 0.16, {
      material: "dark-metal",
      rotationX: Math.PI / 2,
    });
  }

  for (let z = zStart + 1.2; z < zStart + length; z += 4.4) {
    builder.box(x - 0.34, y - 0.55, z, 0.14, 1.1, 0.14, { material: "dark-metal" });
  }
}

function addStairBulkhead(builder: CityBuilder): void {
  builder.box(7.8, 1.45, 16.8, 4.6, 2.9, 4.2, {
    material: "white",
    castShadow: true,
  });
  builder.box(7.8, 2.95, 16.8, 4.9, 0.18, 4.5, { material: "concrete" });
  builder.box(5.35, 1.02, 16.8, 0.08, 2.04, 1.1, { material: "red" });
  builder.box(5.28, 1.05, 16.8, 0.06, 0.1, 0.26, { material: "metal" });
  builder.box(5.28, 0.86, 16.8, 0.06, 0.1, 0.26, { material: "metal" });
  builder.box(9.4, 1.35, 14.6, 0.08, 2.7, 1.6, { material: "dark-metal" });

  // Ladder to the bulkhead roof.
  for (const offset of [-0.24, 0.24]) {
    builder.box(9.5, 1.4, 19.1 + offset, 0.06, 2.8, 0.06, { material: "metal" });
  }

  for (let step = 0; step < 7; step += 1) {
    builder.box(9.5, 0.28 + step * 0.38, 19.1, 0.06, 0.05, 0.66, {
      material: "metal",
    });
  }
}

function addMiscRoofProps(builder: CityBuilder): void {
  // Crate and barrel cluster near the west service area.
  for (let index = 0; index < 4; index += 1) {
    builder.box(-5.9 + (index % 2) * 1.1, 0.45, 8.2 + Math.floor(index / 2) * 1.15, 1, 0.9, 1, {
      material: "dark-metal",
    });
  }

  for (let index = 0; index < 3; index += 1) {
    builder.cylinder(-5.7 + index * 0.9, 0.55, 11.2, 0.62, 1.1, {
      material: "red",
      opacity: 1,
    });
  }

  builder.box(-6.6, 0.42, -16.4, 2.0, 0.82, 1.4, { material: "metal", castShadow: true });
  builder.box(-6.6, 0.92, -16.4, 2.04, 0.18, 1.44, { material: "dark-metal" });
  builder.box(8.6, 0.32, -20.2, 1.8, 0.6, 1.2, { material: "white" });

  // Vent stacks and drains.
  const ventStacks: readonly (readonly [number, number])[] = [
    [10.3, -13.2],
    [10.3, 7.8],
  ];

  for (const [x, z] of ventStacks) {
    builder.cylinder(x, 0.34, z, 0.56, 0.68, { material: "metal" });
    builder.cylinder(x, 0.72, z, 0.72, 0.1, { material: "dark-metal" });
  }

  // A tall service mast on the open edge: adds vertical scale and casts a
  // long diagonal shadow across the roof.
  builder.box(9.6, 4.9, 5.2, 0.14, 9.8, 0.14, { material: "metal", castShadow: true });
  builder.box(9.6, 6.4, 5.2, 0.12, 0.12, 2.6, { material: "metal" });
  builder.box(9.6, 8.1, 5.2, 0.12, 0.12, 1.8, { material: "metal" });
  builder.box(9.6, 9.9, 5.2, 0.38, 0.16, 0.38, { material: "red" });
  builder.cylinder(9.6, 0.2, 5.2, 1.0, 0.4, { material: "concrete" });

  // Faint worn concrete patches add mottling without darkening the deck.
  for (const [x, z, width, depth] of [
    [-2.8, 2.8, 1.7, 1.0],
    [2.2, -1.4, 1.2, 0.8],
    [-1.8, -4.0, 1.4, 0.9],
    [4.4, 4.6, 1.2, 1.3],
    [-4.6, 0.8, 0.9, 1.2],
  ] as const) {
    builder.box(x, 0.055, z, width, 0.012, depth, {
      material: "stain",
      castShadow: false,
      receiveShadow: false,
    });
  }

  // Foreground roof utility: drains, a hatch, and a conduit run break up the
  // high-key deck without adding route obstacles.
  for (const [x, z] of [
    [-3.6, 3.4],
    [2.6, 2.0],
    [3.4, -2.6],
    [-4.0, -5.2],
  ] as const) {
    builder.box(x, 0.045, z, 0.86, 0.06, 0.86, { material: "metal", castShadow: true });
    builder.box(x, 0.085, z, 0.66, 0.02, 0.66, { material: "dark-metal" });
  }

  builder.box(-5.4, 0.14, 4.3, 1.4, 0.16, 1.4, { material: "metal", castShadow: true });
  builder.box(-5.4, 0.24, 4.3, 1.16, 0.04, 1.16, { material: "dark-metal" });
  builder.box(-4.95, 0.32, 4.3, 0.5, 0.06, 0.08, { material: "red" });

  builder.box(-7.2, 0.1, -0.4, 0.16, 0.12, 8.2, { material: "metal", castShadow: true });

  // Low planters and shrubs break up the white roof perimeter.
  for (const [x, z] of [
    [-6.5, 1.2],
    [6.8, 1.2],
    [-6.5, 14.2],
  ] as const) {
    builder.box(x, 0.36, z, 2.4, 0.72, 1.5, { material: "concrete" });
    builder.box(x, 0.74, z, 2.1, 0.08, 1.2, { material: "soil" });

    const shrubs: readonly (readonly [number, number, number])[] = [
      [-0.88, -0.1, 0.34],
      [-0.66, 0.24, 0.48],
      [-0.44, -0.22, 0.4],
      [-0.22, 0.14, 0.56],
      [0.0, -0.04, 0.72],
      [0.22, 0.24, 0.44],
      [0.44, -0.2, 0.52],
      [0.66, 0.12, 0.38],
      [0.88, -0.06, 0.5],
    ];

    for (const [offsetX, offsetZ, height] of shrubs) {
      builder.cylinder(x + offsetX, 0.78 + height / 2, z + offsetZ, 0.4, height, {
        material: "foliage",
      });
    }
  }

  builder.box(-6.7, 0.48, 5.0, 1.1, 0.08, 2.2, { material: "dark-metal" });
  builder.box(-6.7, 0.82, 5.0, 0.08, 0.65, 2.0, { material: "metal" });

  // Wall-run corridor coping and hand rail.
  for (const side of [-1, 1]) {
    builder.box(side * 2.4, 3.44, -12.5, 0.55, 0.12, 7.1, { material: "white" });

    for (let z = -15.5; z <= -9.5; z += 2.1) {
      builder.box(side * 2.18, 1.4, z, 0.04, 1.6, 0.9, { material: "concrete" });
    }
  }

  builder.box(-2.18, 1.15, -12.5, 0.06, 0.06, 6.6, { material: "red" });

  for (let z = -15.4; z <= -9.6; z += 2.1) {
    builder.box(-2.18, 0.6, z, 0.05, 1.15, 0.05, { material: "metal" });
  }

  // Tunnel trim and dark interior lining.
  for (const side of [-1, 1]) {
    builder.box(side * 1.7, 2.58, -7.6, 0.12, 0.08, 4.0, { material: "red" });
    builder.box(side * 2.06, 1.3, -7.6, 0.06, 2.2, 3.7, { material: "metal" });
  }

  // Step nosings.
  builder.box(4, 0.19, 0.22, 1.66, 0.03, 0.06, { material: "dark-metal" });
  builder.box(4, 0.31, -1.58, 1.66, 0.03, 0.06, { material: "dark-metal" });

  // Solar panel frames.
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const x = 6.8 + column * 2.5;
      const z = -8.4 + row * 3.1;
      builder.box(x, 1.06, z - 1.22, 2.2, 0.12, 0.07, { material: "metal" });
      builder.box(x, 1.06, z + 1.22, 2.2, 0.12, 0.07, { material: "metal" });
    }
  }

  // Start-roof bulkhead (the plain vault box in the FG-right of the start
  // frame): 0.6 m panel-seam grid in #d8d8d4, two dark-steel vent grilles on
  // the camera-facing side and a steel cap on the top edge. Decorative only;
  // the collider is untouched.
  for (const x of [-0.6, 0, 0.6]) {
    builder.box(x, 0.375, -0.645, 0.02, 0.75, 0.012, {
      color: 0xd8d8d4,
      castShadow: false,
      receiveShadow: false,
    });
  }

  builder.box(0, 0.6, -0.645, 2.4, 0.02, 0.012, {
    color: 0xd8d8d4,
    castShadow: false,
    receiveShadow: false,
  });

  for (const side of [-1, 1]) {
    builder.box(side * 0.9, 0.36, -0.645, 0.6, 0.4, 0.02, {
      material: "dark-metal",
      castShadow: false,
    });

    for (const y of [0.24, 0.36, 0.48]) {
      builder.box(side * 0.9, y, -0.632, 0.52, 0.05, 0.015, {
        material: "metal",
        castShadow: false,
      });
    }
  }

  builder.box(0, 0.775, -0.66, 2.4, 0.05, 0.12, { material: "metal", castShadow: false });

  // Painted route markers: one continuous stripe from the spawn to the first
  // vault (z 2.0 to -8.0, replaces the dashes on this deck), then the dashed
  // centre line and checkpoint chevrons.
  builder.box(0, 0.005, -3.0, 0.35, 0.01, 10.0, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  for (let z = -8.4; z > -21; z -= 2.6) {
    builder.box(0, 0.012, z, 0.16, 0.02, 1.15, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }

  for (const z of [3, -2.5, -8.5, -14.5, -18.5]) {
    for (const side of [-1, 1]) {
      builder.box(side * 1.1, 0.014, z, 0.62, 0.02, 0.16, {
        material: "red",
        rotationY: side * 0.5,
        castShadow: false,
        receiveShadow: false,
      });
    }
  }

  // Red safety rails around the service duct entrance.
  for (const side of [-1, 1]) {
    builder.box(side * 2.55, 0.55, -5.6, 0.08, 1.1, 0.08, { material: "red" });
    builder.box(side * 2.55, 1.1, -5.6, 0.08, 0.08, 1.2, { material: "red" });
  }
}

function addFinishArea(builder: CityBuilder, z: number, deckY: number): void {
  builder.box(-3.8, deckY + 2.1, z, 0.34, 4.2, 0.34, { material: "white", castShadow: true });
  builder.box(3.8, deckY + 2.1, z, 0.34, 4.2, 0.34, { material: "white", castShadow: true });
  builder.box(0, deckY + 4.2, z, 7.9, 0.26, 0.38, { material: "white" });
  builder.box(0, deckY + 4.02, z, 6.2, 0.08, 0.08, {
    material: "red",
  });
  builder.box(0, deckY + 0.016, z + 0.5, 5.2, 0.02, 0.16, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  // Finish terminal with a matte screen. The screen is a white printed panel,
  // not a light source: without a texture canvas the library `cool-light`
  // material glowed (emissive 0.18) and read as an emissive panel, so it is
  // printed on the same matte white as the gate; the decoration-level emissive
  // stays at 0.05 for data hygiene.
  builder.box(2.5, deckY + 1.32, z + 1.8, 0.72, 0.5, 0.1, {
    material: "white",
    rotationY: -0.4,
    emissive: 0xbfe6ff,
    emissiveIntensity: 0.05,
  });
  builder.box(2.5, deckY + 1.55, z + 1.8, 0.78, 0.08, 0.14, {
    material: "dark-metal",
    rotationY: -0.4,
  });
  builder.box(2.5, deckY + 0.62, z + 2.12, 0.5, 0.42, 0.04, {
    material: "white",
    emissive: 0xbfe6ff,
    emissiveIntensity: 0.05,
  });

  // Continuous red route line from z -124 to the finish line at -132.5 (the
  // finish line stays as the transverse stripe) and one AC unit so the high
  // deck does not read empty.
  builder.box(0, deckY + 0.005, z + 4.75, 0.35, 0.01, 8.5, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(7.2, deckY + 0.72, z + 1.5, 2.2, 1.3, 1.6, {
    material: "metal",
    castShadow: true,
  });
  builder.box(7.2, deckY + 1.43, z + 1.5, 2.0, 0.1, 1.4, { material: "dark-metal" });
}

function addCheckpointBeacons(builder: CityBuilder): void {
  const checkpoints: readonly (readonly [number, number, number])[] = [
    [3, 0, 4.3],
    [-2.5, 0, 4.3],
    [-8.5, 0, 4.3],
    [-46, -0.9, 1.3],
    [-66, -2.0, 1.5],
  ];

  for (const [z, deckY, offset] of checkpoints) {
    for (const side of [-1, 1]) {
      builder.box(side * offset, deckY + 0.38, z, 0.06, 0.76, 0.06, {
        material: "red",
      });
      builder.box(side * offset, deckY + 0.78, z, 0.22, 0.04, 0.22, {
        material: "red",
      });
    }
  }
}

interface BuildingOptions {
  readonly material: LevelMaterialType;
  readonly top: number;
  readonly facing: "east" | "west" | "north" | "south";
  readonly style?: "punched" | "curtain" | "ribbon";
  readonly roofProps?: boolean;
  readonly seed: number;
}

interface FaceFrame {
  readonly axis: "x" | "z";
  readonly sign: number;
  readonly plane: number;
  readonly start: number;
  readonly length: number;
}

function faceFrame(
  x: number,
  z: number,
  width: number,
  depth: number,
  facing: BuildingOptions["facing"],
): FaceFrame {
  if (facing === "east") {
    return { axis: "x", sign: 1, plane: x + width / 2, start: z - depth / 2, length: depth };
  }

  if (facing === "west") {
    return { axis: "x", sign: -1, plane: x - width / 2, start: z - depth / 2, length: depth };
  }

  if (facing === "south") {
    return { axis: "z", sign: 1, plane: z + depth / 2, start: x - width / 2, length: width };
  }

  return { axis: "z", sign: -1, plane: z - depth / 2, start: x - width / 2, length: width };
}

function addFaceBox(
  builder: CityBuilder,
  frame: FaceFrame,
  along: number,
  y: number,
  alongSize: number,
  height: number,
  thickness: number,
  material: LevelMaterialType,
  proud = 0.04,
  castShadow = false,
): void {
  const offset = frame.plane + frame.sign * proud;
  const isX = frame.axis === "x";

  builder.box(
    isX ? offset : along,
    y,
    isX ? along : offset,
    isX ? thickness : alongSize,
    height,
    isX ? alongSize : thickness,
    { material, castShadow, receiveShadow: false },
  );
}

function addBuilding(
  builder: CityBuilder,
  x: number,
  z: number,
  width: number,
  depth: number,
  options: BuildingOptions,
): void {
  const height = options.top - GROUND_Y;
  const centerY = (options.top + GROUND_Y) / 2;
  const frame = faceFrame(x, z, width, depth, options.facing);
  const random = createRandom(options.seed);
  const style =
    options.style ??
    (options.material === "glass" || options.material === "glass-far"
      ? "curtain"
      : options.material === "concrete"
        ? "ribbon"
        : "punched");

  builder.box(x, centerY, z, width, height, depth, {
    material: options.material,
    castShadow: true,
    receiveShadow: true,
  });

  const bayWidth = 3.4;
  const floorHeight = 3.6;
  const bays = Math.max(2, Math.round(frame.length / bayWidth));
  const resolvedBay = frame.length / bays;
  const floors = Math.max(2, Math.round((options.top - GROUND_Y - 5) / floorHeight));
  const baseY = GROUND_Y + 5;

  if (style === "curtain") {
    for (let floor = 0; floor < floors; floor += 1) {
      const y = baseY + floor * floorHeight;

      addFaceBox(
        builder,
        frame,
        frame.start + frame.length / 2,
        y,
        frame.length,
        0.3,
        0.24,
        "white",
        0.08,
        true,
      );
    }

    for (let bay = 0; bay <= bays; bay += 1) {
      const along = frame.start + bay * resolvedBay;

      addFaceBox(builder, frame, along, centerY, 0.14, height, 0.18, "metal", 0.06);
    }

    for (let bay = 0; bay < bays; bay += 1) {
      if (random() > 0.84) {
        const along = frame.start + resolvedBay * (bay + 0.5);
        const y = baseY + Math.floor(random() * floors) * floorHeight + 1.8;

        addFaceBox(builder, frame, along, y, resolvedBay * 0.72, 1.8, 0.1, "glass", 0.05);
      }
    }
  } else if (style === "punched") {
    for (let floor = 0; floor < floors; floor += 1) {
      const y = baseY + floor * floorHeight;

      addFaceBox(
        builder,
        frame,
        frame.start + frame.length / 2,
        y + 0.15,
        frame.length,
        0.3,
        0.2,
        "concrete",
        0.07,
        true,
      );

      for (let bay = 0; bay < bays; bay += 1) {
        const along = frame.start + resolvedBay * (bay + 0.5);
        const widthRatio = 0.58 + random() * 0.1;

        addFaceBox(
          builder,
          frame,
          along,
          y + 1.55,
          resolvedBay * widthRatio,
          2.1,
          0.12,
          random() > 0.93 ? "glass-far" : "glass",
          0.02,
        );
      }
    }

    for (let bay = 0; bay <= bays; bay += 1) {
      const along = frame.start + bay * resolvedBay;
      const pierWidth = 0.34 + (bay % 3 === 0 ? 0.28 : 0);

      addFaceBox(builder, frame, along, centerY, pierWidth, height, 0.24, "white", 0.13, true);
    }
  } else {
    for (let floor = 0; floor < floors; floor += 1) {
      const y = baseY + floor * floorHeight;

      addFaceBox(
        builder,
        frame,
        frame.start + frame.length / 2,
        y + 1.6,
        frame.length,
        1.5,
        0.14,
        "glass",
        0.03,
      );
      addFaceBox(
        builder,
        frame,
        frame.start + frame.length / 2,
        y,
        frame.length,
        0.34,
        0.22,
        "white",
        0.1,
        true,
      );
    }

    for (let bay = 0; bay <= bays; bay += 2) {
      const along = frame.start + bay * resolvedBay;

      addFaceBox(builder, frame, along, centerY, 0.55, height, 0.3, "white", 0.15);
    }
  }

  // Roof cap and perimeter parapet.
  builder.box(x, options.top + 0.18, z, width + 0.4, 0.36, depth + 0.4, {
    material: "concrete",
    castShadow: true,
  });
  builder.box(x, options.top + 0.62, z - depth / 2, width, 0.32, 0.3, { material: "concrete" });
  builder.box(x, options.top + 0.62, z + depth / 2, width, 0.32, 0.3, { material: "concrete" });
  builder.box(x - width / 2, options.top + 0.62, z, 0.3, 0.32, depth, { material: "concrete" });
  builder.box(x + width / 2, options.top + 0.62, z, 0.3, 0.32, depth, { material: "concrete" });

  if (options.roofProps === true) {
    const props = 2 + Math.floor(random() * 3);

    for (let index = 0; index < props; index += 1) {
      const propX = x - width * 0.32 + random() * width * 0.64;
      const propZ = z - depth * 0.32 + random() * depth * 0.64;

      builder.box(propX, options.top + 0.9, propZ, 2.2, 1.2, 1.7, { material: "metal" });
      builder.box(propX, options.top + 1.55, propZ, 2.0, 0.12, 1.5, { material: "dark-metal" });
    }

    builder.box(x + width * 0.24, options.top + 4.2, z, 0.16, 8, 0.16, { material: "metal" });
  }
}

function addWestTowerWall(builder: CityBuilder): void {
  const faceX = -7.96;

  // Curtain-wall floor slabs and mullions on the glazed facade.
  for (let level = 0; level < 5; level += 1) {
    const y = 2.2 + level * 3.6;

    builder.box(faceX, y, -8, 0.2, 0.22, 35.6, { material: "facade", castShadow: true });
  }

  for (let z = -25; z <= 9; z += 3.2) {
    builder.box(faceX - 0.02, 9, z, 0.16, 17.6, 0.16, { material: "metal" });
  }

  // Structural diagonal bracing across the facade.
  for (const z of [-22, -12, -2]) {
    builder.box(-7.82, 8.6, z, 0.26, 18.5, 0.26, {
      material: "metal",
      rotationX: 0.28,
      castShadow: true,
    });
  }

  // Orange billboard: the reference's saturated colour anchor.
  builder.box(-7.78, 7.2, -4.6, 0.16, 3.6, 3.6, { material: "white", castShadow: true });
  builder.box(-7.68, 7.2, -4.6, 0.08, 3.2, 3.2, { material: "orange" });
  builder.box(-7.6, 7.2, -5.1, 0.04, 1.6, 0.9, { material: "white" });
  builder.box(-7.6, 5.5, -4.6, 0.04, 0.14, 2.9, { material: "red" });
  builder.plane(-7.54, 7.2, -4.6, 3.0, 3.0, Math.PI / 2, {
    text: "RUN",
    background: 0xf08a2a,
    textColor: 0xfff6ea,
    accentColor: 0x111418,
  });

  const sectionSigns: readonly (readonly [number, string])[] = [
    [1.4, "01\nROOFTOP"],
    [-8.2, "02\nINDUSTRIAL"],
    [-16.2, "03\nCONSTRUCTION"],
  ];

  for (const [z, label] of sectionSigns) {
    builder.plane(-7.9, 3.1, z, 2.2, 0.95, Math.PI / 2, {
      text: label,
      background: 0xf4f1e9,
      textColor: 0x14191d,
      accentColor: 0xd52e36,
    });
  }

  // Red maintenance ladder and handrail against the tower base.
  for (const offset of [-0.42, 0.42]) {
    builder.box(-7.5, 2.7, -14.2 + offset, 0.06, 5.4, 0.06, { material: "red" });
  }

  for (let step = 0; step < 12; step += 1) {
    builder.box(-7.5, 0.3 + step * 0.44, -14.2, 0.06, 0.05, 0.86, { material: "red" });
  }

  builder.box(-7.55, 1.02, -4, 0.06, 0.06, 20.4, { material: "red" });

  for (let z = -14; z <= 6; z += 2.4) {
    builder.box(-7.55, 0.55, z, 0.05, 1.05, 0.05, { material: "metal" });
  }

  // Base plinth and steel louver vents along the wall. The vents are a dark
  // recess plus three light steel slats, so they read as a grille in the glass
  // wall rather than a flat black void panel.
  builder.box(-7.9, 0.42, -8, 0.28, 0.84, 35.8, { material: "concrete" });

  for (const z of [4.5, -3.5, -10.5, -19]) {
    builder.box(-7.76, 0.82, z, 0.06, 0.5, 1.78, { material: "dark-metal" });

    for (const y of [0.63, 0.82, 1.01]) {
      builder.box(-7.71, y, z, 0.14, 0.055, 1.78, { material: "metal" });
    }
  }

  // Tower roof above the glass wall.
  builder.box(-8.4, 18.35, -8, 6.4, 0.5, 36.6, { material: "concrete", castShadow: true });
  builder.box(-8.4, 18.85, -25.8, 6.4, 0.6, 0.4, { material: "concrete" });
  builder.box(-8.4, 18.85, 9.8, 6.4, 0.6, 0.4, { material: "concrete" });

  for (const z of [-18, -6, 4]) {
    builder.box(-10.4, 19.5, z, 2.6, 1.4, 2.0, { material: "metal", castShadow: true });
    builder.box(-10.4, 20.3, z, 2.4, 0.14, 1.8, { material: "dark-metal" });
  }

  builder.cylinder(-10.4, 20.5, -12, 2.2, 2.4, { material: "metal", castShadow: true });
  builder.cylinder(-10.4, 21.75, -12, 2.4, 0.16, { material: "dark-metal" });

  builder.box(-10.4, 23.4, -22, 0.12, 8, 0.12, { material: "metal" });
}

function addNearCity(builder: CityBuilder): void {
  // Very close facades that frame the roof canyon.
  addBuilding(builder, -26, -10, 16, 36, {
    material: "facade",
    top: 10,
    facing: "east",
    roofProps: true,
    seed: 11,
  });
  addBuilding(builder, 32, -26, 18, 32, {
    material: "facade",
    top: 11,
    facing: "west",
    roofProps: true,
    seed: 19,
  });
  addBuilding(builder, -27, 24, 18, 26, {
    material: "concrete",
    top: 10,
    facing: "east",
    roofProps: false,
    seed: 23,
  });
  addBuilding(builder, 28, 15, 16, 22, {
    material: "facade",
    top: 10,
    facing: "west",
    roofProps: true,
    seed: 29,
  });

  // Lower roofs across the canyon create depth below the parapet line.
  builder.box(-30, -8.4, 3, 18, 0.8, 28, { material: "roof", castShadow: true });
  builder.box(-30, -7.8, 3, 18.4, 0.3, 28.4, { material: "concrete" });
  builder.box(30, -5.4, 2, 18, 0.8, 30, { material: "roof", castShadow: true });
  builder.box(30, -4.8, 2, 18.4, 0.3, 30.4, { material: "concrete" });

  for (let index = 0; index < 5; index += 1) {
    builder.box(-27 + index * 3, -7.7, -6 + index * 4, 2.2, 1.2, 1.7, { material: "metal" });
    builder.box(27 + index * 3, -4.7, -8 + index * 4, 2.2, 1.2, 1.7, { material: "metal" });
  }

  addBuilding(builder, -30, -48, 18, 22, {
    material: "facade",
    top: 10,
    facing: "east",
    roofProps: true,
    seed: 67,
  });
  addBuilding(builder, 32, -50, 20, 24, {
    material: "glass",
    top: 14,
    facing: "west",
    roofProps: true,
    seed: 71,
  });

  // Towers ahead, forming the main skyline wall behind the finish.
  addBuilding(builder, -32, -84, 24, 24, {
    material: "glass-far",
    top: 20,
    facing: "south",
    roofProps: true,
    seed: 31,
  });
  addBuilding(builder, 22, -96, 20, 26, {
    material: "facade",
    top: 16,
    facing: "south",
    roofProps: true,
    seed: 37,
  });
  addBuilding(builder, 4, -215, 48, 32, {
    material: "glass-far",
    top: 10,
    facing: "south",
    roofProps: false,
    seed: 41,
  });
  addBuilding(builder, -60, -66, 24, 30, {
    material: "concrete",
    top: 16,
    facing: "east",
    roofProps: true,
    seed: 43,
  });
  addBuilding(builder, 64, -64, 28, 28, {
    material: "glass-far",
    top: 20,
    facing: "west",
    roofProps: true,
    seed: 47,
  });

  // Behind the start, so turning around still shows a city.
  addBuilding(builder, -26, 58, 30, 26, {
    material: "facade",
    top: 40,
    facing: "north",
    roofProps: true,
    seed: 53,
  });
  addBuilding(builder, 28, 64, 28, 24, {
    material: "glass",
    top: 52,
    facing: "north",
    roofProps: true,
    seed: 59,
  });
}

function addOverheadBridge(builder: CityBuilder): void {
  // A local pedestrian bridge frames the start canyon and breaks the open sky.
  builder.box(0, 11.0, -6, 27, 1.2, 4.0, { material: "white", castShadow: true });
  builder.box(0, 11.65, -8.15, 27, 1.3, 0.14, {
    material: "glass-far",
    castShadow: false,
  });
  builder.box(0, 11.65, -3.85, 27, 1.3, 0.14, {
    material: "glass-far",
    castShadow: false,
  });

  for (const x of [-12.6, 12.6]) {
    builder.box(x, 5.2, -6, 0.5, 10.4, 0.5, { material: "metal", castShadow: true });
    builder.box(x, 1.0, -6, 1.1, 0.3, 1.1, { material: "concrete" });
  }

  for (const z of [-8.2, -3.8]) {
    builder.box(0, 10.95, z, 27.2, 0.2, 0.2, { material: "dark-metal" });
  }

  for (let x = -11; x <= 11; x += 2.75) {
    builder.box(x, 10.42, -6, 0.18, 0.18, 4.0, { material: "metal" });
    builder.box(x, 10.48, -6, 0.5, 0.08, 0.08, {
      material: "cool-light",
      emissive: 0xcfe8ff,
      emissiveIntensity: 0.25,
      castShadow: false,
    });
  }

  for (const z of [-8.05, -3.95]) {
    builder.box(0, 10.36, z, 27, 0.22, 0.22, { material: "metal" });
  }

  // Hanging red network banners keep the warm accent under the raised span.
  for (const [x, text] of [
    [-6.8, "GLASSLINE"],
    [6.8, "RUNNER"],
  ] as const) {
    builder.plane(x, 9.45, -5.55, 1.3, 1.9, 0, {
      text,
      background: 0xd52e36,
      textColor: 0xf8f2e8,
      accentColor: 0x14191d,
    });
    builder.box(x, 10.36, -5.58, 0.08, 0.12, 0.08, {
      material: "metal",
      castShadow: false,
    });
  }
  builder.box(0, 10.26, -3.74, 27, 0.12, 0.1, {
    material: "red",
    castShadow: false,
  });

  builder.box(0, 11.62, -3.72, 27, 0.12, 0.05, {
    material: "red",
    castShadow: false,
  });
}

function addSkybridge(builder: CityBuilder): void {
  // Distant skybridge linking the far skyline; the playable bridge is part of
  // the level geometry.
  builder.box(0, 24, -118, 58, 0.8, 3.4, {
    material: "white",
    castShadow: false,
  });
  builder.box(0, 24.8, -118, 58, 1.4, 0.12, {
    material: "glass-far",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(0, 24.8, -116.6, 58, 1.4, 0.12, {
    material: "glass-far",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(0, 23.5, -118, 58.4, 0.18, 0.6, { material: "dark-metal" });
}

/**
 * Skybridge suspended construction load + the city layer below the span.
 * The gantry lands in the upper middle-ground of the skybridge shot; the low
 * roofs sit under and beside the span so the transparent rails reveal a city
 * layer instead of fog. Purely decorative boxes (no colliders/triggers).
 */
function addSkybridgeOverhead(builder: CityBuilder): void {
  // Steel cap handrail and outer posts on the two existing glass-rail boxes
  // (0.2 x 1.3 x 8 m at x +/-1.8): decoration only, rail geometry frozen.
  for (const side of [-1, 1]) {
    builder.box(side * 1.8, 0.43, -46, 0.08, 0.06, 8, { material: "metal" });

    for (let index = 0; index < 5; index += 1) {
      builder.box(side * 1.93, -0.25, -50 + index * 2, 0.06, 1.3, 0.06, {
        material: "metal",
      });
    }
  }

  // Suspended service skip on four steel cables, over the far end of the span
  // (z -62, x +1.2 off the route centreline so the route stays clear): white
  // body #f1f1ed, 0.1 m red band, dark-steel bottom; bottom 3.4 m above deck.
  builder.box(1.2, 3.2, -62, 1.2, 1.4, 1.8, { material: "white", castShadow: true });
  builder.box(1.2, 3.75, -62, 1.22, 0.1, 1.82, { material: "red", castShadow: false });
  builder.box(1.2, 2.5, -62, 1.26, 0.06, 1.86, { material: "dark-metal" });

  // Gantry the cables hang from, so the load reads in the upper middle-ground.
  builder.box(0, 5.6, -62, 12, 0.35, 0.5, { material: "metal", castShadow: true });

  for (const side of [-1, 1]) {
    builder.box(side * 6, 2.44, -61.5, 0.45, 6.68, 0.45, {
      material: "metal",
      castShadow: true,
    });
    builder.box(side * 6, -0.86, -61.5, 0.9, 0.1, 0.9, { material: "dark-metal" });
  }

  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      builder.cylinder(1.2 + dx * 0.42, 4.66, -62 + dz * 0.72, 0.02, 1.53, {
        material: "metal",
        castShadow: false,
      });
    }
  }

  // Vista below the span: the lower service roof 16 m down with parapets and
  // vents, a near east tower facade grid set back ~7 m from the bridge edge,
  // and a lower roof + crane to the west. City floor (-31 m) already exists.
  builder.box(0, -16.25, -52, 17, 0.5, 22, { material: "roof", castShadow: true });
  builder.box(0, -15.85, -52, 17.4, 0.3, 22.4, { material: "concrete" });

  for (const z of [-63.2, -40.8]) {
    builder.box(0, -15.35, z, 17.4, 0.7, 0.4, { material: "concrete" });
    builder.box(0, -14.98, z, 17.8, 0.06, 0.5, { material: "dark-metal" });
  }

  for (const side of [-1, 1]) {
    builder.box(side * 8.5, -15.35, -52, 0.4, 0.7, 22, { material: "concrete" });
    builder.box(side * 8.5, -14.98, -52, 0.5, 0.06, 22.4, { material: "dark-metal" });
  }

  for (const [x, z] of [
    [-5, -50],
    [3, -56],
    [4.5, -46],
  ] as const) {
    builder.box(x, -15.25, z, 1.2, 0.9, 0.8, { material: "metal", castShadow: true });
    builder.box(x, -14.77, z, 1.0, 0.06, 0.6, { material: "dark-metal" });
  }

  // East near tower, kept set back from the bridge edge and shifted south so
  // the dressed east side roof fits between it and the span.
  addBuilding(builder, 15, -70, 12, 16, {
    material: "facade",
    top: 2,
    facing: "west",
    roofProps: true,
    seed: 91,
  });

  // West low-rise block: roof deck at -11.5 with the construction crane on it.
  builder.box(-19, -22, -50, 10, 20, 18, { material: "facade", castShadow: true });
  builder.box(-19, -11.75, -50, 10.4, 0.5, 18.4, { material: "roof", castShadow: true });
  builder.box(-19, -11.4, -50, 10.8, 0.3, 18.8, { material: "concrete" });
  builder.box(-19, -11.15, -41.2, 10.8, 0.08, 0.4, { material: "dark-metal" });
  builder.box(-18, -4.25, -47, 0.7, 14.5, 0.7, { material: "metal", castShadow: true });
  builder.box(-13, 2.9, -47, 10, 0.35, 0.35, { material: "metal" });
  builder.box(-20, 2.9, -47, 4, 0.3, 0.3, { material: "metal" });
  builder.box(-21.8, 2.6, -47, 1.6, 1.0, 1.0, { material: "dark-metal" });
  builder.cylinder(-12.9, 1.65, -47, 0.02, 2.5, {
    material: "dark-metal",
    castShadow: false,
  });
}
function addServiceBlockLandmarks(builder: CityBuilder): void {
  // Tunnel ceiling dressed as a duct: dark-steel underside plate, rib seams
  // every 0.3 m and a 0.08 m red frame around the lower perimeter. Elements
  // are thin, so the soffit stays at the 1.35 m duct line (0.95 m above the
  // 0.4 m slide eye; physical clearance is W3).
  builder.box(0, 1.346, -7.6, 3.9, 0.005, 4.0, { material: "dark-metal", castShadow: false });

  builder.box(0, 1.342, -9.55, 3.9, 0.01, 0.08, { material: "red", castShadow: false });

  for (let index = 0; index < 13; index += 1) {
    builder.box(0, 1.343, -5.75 - index * 0.3, 3.9, 0.006, 0.05, {
      material: "metal",
      castShadow: false,
    });
  }

  // Two side duct boxes on the shoulders (soffit 1.05 m): steel body, dark
  // steel underside, red lower frame, rib seams every 0.3 m on the inner face.
  for (const side of [-1, 1]) {
    builder.box(side * 1.45, 1.33, -7.6, 0.5, 0.44, 4, {
      material: "metal",
      castShadow: true,
    });
    builder.box(side * 1.45, 1.08, -7.6, 0.5, 0.06, 4, { material: "dark-metal" });

    for (let index = 0; index < 13; index += 1) {
      builder.box(side * 1.19, 1.33, -5.75 - index * 0.3, 0.03, 0.44, 0.06, {
        material: "metal",
      });
    }
  }

  // Red service door on the wall-run corridor west wall (inner face x -2.2,
  // z -14.0): matte red, dark-steel frame 0.06 m, steel handle, no emissive.
  builder.box(-2.175, 1.05, -14.0, 0.05, 2.1, 0.9, { material: "red", castShadow: false });
  builder.box(-2.17, 2.13, -14.0, 0.06, 0.06, 1.02, { material: "dark-metal" });
  builder.box(-2.14, 1.05, -13.6, 0.03, 0.12, 0.03, { material: "metal" });

  for (const side of [-1, 1]) {
    builder.box(-2.17, 1.05, -14.0 + side * 0.48, 0.06, 2.16, 0.06, {
      material: "dark-metal",
    });
  }

  // Steel pipe run along the west wall of the wall-run corridor.
  builder.cylinder(-2.13, 1.95, -12.8, 0.22, 5.6, {
    material: "metal",
    rotationX: Math.PI / 2,
  });

  for (const z of [-10.8, -12.8, -14.8]) {
    builder.box(-2.21, 1.8, z, 0.2, 0.18, 0.1, { material: "dark-metal" });
  }
}
function addFirstGapDressing(builder: CityBuilder): void {
  // Red nosing strip on the front edge of each of the 15 sprint steps:
  // 3.2 x 0.02 x 0.05 m at z = -34.4 - i * 0.5 (decorative, no colliders).
  for (let index = 0; index < 15; index += 1) {
    const top = -3 + (index + 1) * 0.15;

    builder.box(0, top + 0.01, -34.4 - index * 0.5, 3.2, 0.02, 0.05, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }

  // Steel cap strips on the existing lower-roof parapets (top at y -2.0) and
  // the landing-lip cap from the W1 fix round.
  for (const side of [-1, 1]) {
    builder.box(side * 14.2, -1.975, -32.5, 0.3, 0.05, 19, { material: "metal" });
  }

  builder.box(0, -2.97, -34.22, 28, 0.06, 0.3, { material: "dark-metal" });

  // Landing roof plant: three vent boxes on deck b and two AC units on deck a.
  for (const [x, z] of [
    [6, -36.5],
    [-6, -38],
    [6, -39.5],
  ] as const) {
    builder.box(x, -2.55, z, 1.2, 0.9, 0.8, { material: "metal", castShadow: true });
    builder.box(x, -2.07, z, 1.0, 0.06, 0.6, { material: "dark-metal" });
  }

  for (const x of [-8, 8]) {
    builder.box(x, -2.5, -26, 1.6, 1.0, 1.2, { material: "metal", castShadow: true });
    builder.box(x, -1.96, -26, 1.4, 0.08, 1.0, { material: "dark-metal" });
  }
}
/**
 * Dressed lower roofs flanking the skybridge span: two low-rise service
 * buildings with roof decks (y -12...-14), parapets/coping, vents/AC and a
 * pipe run, so the city below reads as structure through both glass panels.
 */
function addSkybridgeSideRoofs(builder: CityBuilder): void {
  for (const side of [-1, 1]) {
    const x = side * 11;
    const z = -50;

    builder.box(x, -22, z, 6, 18, 12, { material: "facade", castShadow: true });
    builder.box(x, -12.75, z, 6.4, 0.5, 12.4, { material: "roof", castShadow: true });
    builder.box(x, -12.4, z, 6.8, 0.3, 12.8, { material: "concrete" });

    for (const [px, pz, sx, sz] of [
      [0, 6.1, 6.8, 0.35],
      [0, -6.1, 6.8, 0.35],
      [3.1, 0, 0.35, 12.8],
      [-3.1, 0, 0.35, 12.8],
    ] as const) {
      builder.box(x + px, -11.95, z + pz, sx, 0.7, sz, { material: "concrete" });
      builder.box(x + px, -11.55, z + pz, sx + 0.12, 0.08, sz + 0.12, {
        material: "dark-metal",
      });
    }

    builder.box(x - 1.4, -11.5, z + 3, 1.6, 1.0, 1.2, { material: "metal" });
    builder.box(x - 1.4, -10.96, z + 3, 1.4, 0.08, 1.0, { material: "dark-metal" });
    builder.box(x + 1.6, -11.7, z - 2.6, 1.2, 0.7, 0.9, { material: "metal" });
    builder.box(x + 1.6, -11.32, z - 2.6, 1.0, 0.06, 0.7, { material: "dark-metal" });

    builder.cylinder(x + 2.4, -11.2, z - 1, 0.22, 8, {
      material: "metal",
      rotationX: Math.PI / 2,
    });

    for (const pz of [-3.5, -1, 1.5]) {
      builder.box(x + 2.4, -11.35, z + pz, 0.2, 0.18, 0.1, { material: "dark-metal" });
    }

    // Service risers under the span and a dressed band along the finish-deck
    // near edge: both sit inside the glass sightline of the approved skybridge
    // pose, so the side glass panels read structure instead of pale haze.
    builder.box(side * 2.6, -6.5, -49.6, 0.7, 11.5, 0.7, { material: "metal" });
    builder.box(side * 2.6, -0.7, -49.6, 1.0, 0.3, 1.0, { material: "dark-metal" });

    builder.box(side * 4.9, -0.45, -50.4, 5.0, 0.9, 0.4, { material: "concrete" });
    builder.box(side * 4.9, 0.03, -50.4, 5.2, 0.08, 0.5, { material: "dark-metal" });

    builder.box(side * 5.2, -0.3, -52.6, 1.4, 1.2, 1.1, { material: "metal" });
    builder.box(side * 5.2, 0.33, -52.6, 1.2, 0.08, 0.9, { material: "dark-metal" });
    builder.box(side * 3.4, -0.55, -52.4, 1.0, 0.7, 0.8, { material: "metal" });
    builder.box(side * 3.4, -0.2, -52.4, 0.8, 0.06, 0.6, { material: "dark-metal" });

    builder.cylinder(side * 6.6, -0.72, -51.6, 0.18, 7.2, {
      material: "metal",
      rotationX: Math.PI / 2,
    });
  }
}

function addCrane(builder: CityBuilder): void {
  builder.box(-40, 12, -34, 1.2, 86, 1.2, { material: "metal", castShadow: true });
  builder.box(-40, 55.4, -34, 44, 0.9, 0.9, { material: "red", castShadow: true });
  builder.box(-49, 54.2, -34, 12, 0.8, 1.4, { material: "dark-metal" });
  builder.box(-55, 57, -34, 2.4, 3.2, 2.4, { material: "dark-metal" });
  builder.box(-21, 54.9, -34, 0.9, 0.6, 2.2, { material: "red" });
  builder.box(-19.4, 48.6, -34, 0.06, 12.6, 0.06, { material: "dark-metal" });
  builder.box(-19.4, 43.2, -34, 1.2, 0.5, 0.5, { material: "metal" });

  // Lattice X-bracing suggestion along the mast.
  for (let index = 0; index < 9; index += 1) {
    builder.box(-40, 8 + index * 9.2, -34, 1.3, 0.12, 1.3, { material: "dark-metal" });
  }

  // The far east tower crane was removed in W2.1: after the AD-approved sky
  // cut its red jib/counterweight hung in open sky with no readable mast in
  // the finish-roof and first-gap frames. The west crane below stays as the
  // distant construction silhouette.
}

function addLowerZone(builder: CityBuilder): void {
  // Warning edge at the drop, then a red guide line down the service roof.
  builder.box(0, 0.022, -21.85, 7.6, 0.02, 0.34, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  for (let z = -24; z > -32; z -= 2.4) {
    builder.box(0, -2.985, z, 0.18, 0.02, 1.15, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }

  for (let z = -36; z > -41.5; z -= 2.2) {
    builder.box(0, -2.985, z, 0.18, 0.02, 1.0, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }

  // First-gap edge dressing: a 0.3 m parapet cap on the lower-roof lip, the
  // route red bound to the edge as a 0.6 × 0.3 m hazard plate instead of a tab
  // floating over the gap, and a soft contact shadow where the cap meets the
  // deck. Visual only: no collider, section or trigger metadata.
  builder.box(0, -2.97, -31.85, 28, 0.06, 0.3, { material: "dark-metal" });
  builder.box(0, -2.93, -31.85, 0.6, 0.02, 0.3, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(0, -2.991, -31.59, 28, 0.012, 0.22, {
    color: 0x101820,
    opacity: 0.28,
    castShadow: false,
    receiveShadow: false,
  });

  // Lower roof edge rails.
  for (const side of [-1, 1]) {
    for (let z = -24; z >= -41; z -= 3.2) {
      builder.box(side * 13.9, -1.5, z, 0.06, 2.0, 0.06, { material: "metal" });
    }

    builder.box(side * 13.9, -0.55, -32.5, 0.07, 0.07, 18.2, { material: "metal" });
  }

  // Scaffold cage around the stair flight.
  for (const side of [-1, 1]) {
    for (const z of [-35.2, -38.1, -41.0]) {
      builder.box(side * 1.95, -1.1, z, 0.09, 4.0, 0.09, { material: "metal" });
    }

    builder.box(side * 1.95, 0.65, -38.1, 0.07, 0.07, 6.6, { material: "metal" });
    builder.box(side * 1.95, -1.1, -38.1, 0.07, 0.07, 6.6, { material: "metal" });

    for (const z of [-36.6, -39.5]) {
      builder.box(side * 1.95, -1.1, z, 0.07, 3.5, 0.07, {
        material: "metal",
        rotationX: 0.5,
      });
    }
  }

  // Red stair handrail inside the scaffold cage, matching the reference
  // stair rail line. Visual only; the character collider uses the steps.
  for (const side of [-1, 1]) {
    builder.box(side * 1.65, -0.85, -38.275, 0.06, 0.06, 7.6, {
      material: "red",
      rotationX: 0.283,
    });

    for (const [z, y] of [
      [-35.2, -2.05],
      [-38.1, -1.21],
      [-41, -0.39],
    ] as const) {
      builder.box(side * 1.65, y, z, 0.06, 0.9, 0.06, { material: "red" });
    }
  }

  // Service units and construction kit on the lower deck.
  for (const [x, z, rotation] of [
    [-9.5, -26.5, 0.1],
    [9.2, -29.5, -0.12],
    [-8.6, -37.8, 0.18],
  ] as const) {
    builder.box(x, -2.35, z, 2.2, 1.3, 1.6, { material: "metal", rotationY: rotation });
    builder.box(x, -1.66, z, 2.0, 0.12, 1.4, { material: "dark-metal", rotationY: rotation });
    builder.box(x, -2.98, z, 2.3, 0.08, 1.7, { material: "dark-metal", rotationY: rotation });
  }

  builder.box(12.2, -2.5, -31, 0.8, 0.6, 9.0, { material: "metal" });
  builder.box(12.2, -2.15, -31, 0.95, 0.08, 9.2, { material: "dark-metal" });

  for (let index = 0; index < 3; index += 1) {
    builder.box(-6.2 + index * 1.0, -2.55, -24.6, 0.9, 0.9, 0.9, {
      material: "dark-metal",
    });
  }

  builder.cylinder(-5.4, -2.4, -27.6, 0.6, 1.2, { material: "red" });
  builder.cylinder(-4.6, -2.4, -27.6, 0.6, 1.2, { material: "red" });

  for (const x of [-12.5, 12.5]) {
    builder.box(x, -1.3, -24.8, 0.14, 3.4, 0.14, { material: "metal" });
    builder.box(x, 0.35, -24.8, 0.5, 0.18, 0.5, {
      material: "cool-light",
      emissive: 0xcfe8ff,
      emissiveIntensity: 0.25,
    });
  }

  // A lower service roof far below the gap gives the drop depth instead of a
  // black hole; it is visual-only and sits below the kill volume.
  builder.box(0, -19.2, -34, 30, 0.8, 16, {
    material: "roof",
    castShadow: false,
  });
  builder.box(0, -18.8, -34, 30.4, 0.3, 16.4, { material: "concrete" });

  for (const [x, z] of [
    [-8, -30],
    [7, -35],
    [0, -39],
  ] as const) {
    builder.box(x, -18.2, z, 2.0, 1.2, 1.6, { material: "metal" });
    builder.box(x, -17.55, z, 1.8, 0.1, 1.4, { material: "dark-metal" });
  }

  for (const x of [-12, 12]) {
    builder.box(x, -18.2, -34, 0.3, 0.8, 13, { material: "concrete" });
  }

  // Bridge supports down into the city canyon.
  for (const side of [-1, 1]) {
    for (const z of [-43.4, -48.6]) {
      builder.box(side * 1.55, -16, z, 0.5, 30, 0.5, {
        material: "concrete",
        castShadow: false,
      });
    }

    builder.box(side * 1.55, -5.4, -46, 0.3, 0.3, 7.2, { material: "metal" });
    builder.box(side * 1.55, -9.6, -46, 0.24, 0.24, 6.4, {
      material: "metal",
      rotationX: 0.3,
    });
  }

  // Bridge rail markers and lamps.
  for (const side of [-1, 1]) {
    for (const z of [-43, -46, -49]) {
      builder.box(side * 1.92, -0.2, z, 0.12, 0.12, 0.12, {
        material: "red",
        emissive: 0xc0262d,
        emissiveIntensity: 0.08,
      });
    }
  }

  builder.plane(-1.66, -0.05, -45.5, 1.7, 0.55, Math.PI / 2, {
    text: "04 / SKYBRIDGE",
    background: 0x14191d,
    textColor: 0xf4f1e9,
    accentColor: 0xd52e36,
  });

  builder.plane(-9.0, 1.4, -55.5, 2.0, 0.66, Math.PI / 2, {
    text: "05 / ASCENT",
    background: 0xf4f1e9,
    textColor: 0x14191d,
    accentColor: 0xd52e36,
  });

  builder.plane(-1.82, 2.1, -76, 1.7, 0.55, Math.PI / 2, {
    text: "06 / ASCENT",
    background: 0x14191d,
    textColor: 0xf4f1e9,
    accentColor: 0xd52e36,
  });

  // Finish roof lines, floodlight masts, and service kit.
  for (let x = -7.5; x <= 7.5; x += 1.5) {
    builder.box(x, -0.885, -60, 0.8, 0.02, 0.12, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }

  // Continuous route line: one unbroken 0.15 m red paint stripe along the deck
  // centreline from the skybridge landing (z=-42) to the final-beam gap
  // (z=-61.9). Decorative only: no collider, section or trigger; the route red
  // comes from albedo, so there is no emissive.
  builder.box(0, -0.885, -51.95, 0.35, 0.02, 19.9, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  for (const x of [-7.8, 7.8]) {
    builder.box(x, 1.6, -61.2, 0.14, 5.0, 0.14, { material: "metal" });
    builder.box(x, 4.1, -61.2, 0.4, 0.2, 0.4, {
      material: "cool-light",
      emissive: 0xcfe8ff,
      emissiveIntensity: 0.25,
    });
  }

  const finishProps: readonly (readonly [number, number])[] = [
    [-7.2, -52.4],
    [7.2, -53.6],
    [6.8, -61.0],
  ];

  for (const [x, z] of finishProps) {
    builder.box(x, -0.4, z, 1.8, 1.0, 1.4, { material: "metal" });
    builder.box(x, 0.14, z, 1.7, 0.1, 1.3, { material: "dark-metal" });
  }

  builder.cylinder(-8.0, -0.1, -56.5, 0.9, 1.8, { material: "metal" });
  builder.cylinder(-8.0, 0.85, -56.5, 1.0, 0.12, { material: "dark-metal" });

  // Close service facades frame the lower route without blocking it.
  builder.box(-21, -8.5, -33, 12, 14, 26, { material: "facade", castShadow: true });
  builder.box(-21, -1.2, -33, 12.4, 0.4, 26.4, { material: "concrete" });
  builder.box(22, -6.5, -47, 12, 16, 24, { material: "glass-far", castShadow: true });
  builder.box(22, 1.7, -47, 12.4, 0.4, 24.4, { material: "concrete" });

  for (let z = -26; z >= -40; z -= 4) {
    builder.box(-14.8, -1.4, z, 0.12, 1.2, 2.2, { material: "metal" });
    builder.box(14.8, -1.4, z, 0.12, 1.2, 2.2, { material: "metal" });
  }
}

function addFinaleScaffold(builder: CityBuilder): void {
  // Red edge at the old finish roof and a narrow beam below it.
  builder.box(0, -0.885, -61.9, 17.4, 0.02, 0.18, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  // Four scaffold standards and cross-braces around the ascending platforms.
  for (const x of [-2.6, 2.6]) {
    for (const z of [-74.5, -118]) {
      builder.box(x, -12, z, 0.22, 38, 0.22, { material: "metal" });
      builder.box(x, 5.6, z, 0.34, 0.34, 0.34, { material: "red" });
    }
  }

  for (let index = 0; index < 8; index += 1) {
    const start = -74.5 - index * 5.6;
    const top = -2 + (index + 1) * 0.8;

    for (const side of [-1, 1]) {
      builder.box(side * 2.6, top, start - 1.8, 0.18, 0.18, 3.8, { material: "metal" });
      builder.box(side * 1.85, top + 0.55, start - 1.8, 0.06, 0.06, 3.4, { material: "red" });

      for (const postZ of [start - 0.35, start - 3.25]) {
        builder.box(side * 1.85, top + 0.275, postZ, 0.06, 0.55, 0.06, {
          material: "red",
        });
      }
    }

    builder.box(0, top + 0.015, start - 0.15, 3.4, 0.02, 0.12, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }

  // Diagonal braces and hanging work lights make the tower read as construction.
  for (let index = 0; index < 4; index += 1) {
    const z = -76 - index * 11;
    builder.box(-2.6, 0.5, z, 0.16, 0.16, 12.6, {
      material: "metal",
      rotationX: 0.55,
    });
    builder.box(2.6, 0.5, z, 0.16, 0.16, 12.6, {
      material: "metal",
      rotationX: -0.55,
    });
  }

  for (const z of [-78, -92, -106]) {
    builder.box(-2.3, 5.0, z, 0.1, 0.1, 0.1, {
      material: "cool-light",
      emissive: 0xcfe8ff,
      emissiveIntensity: 0.25,
    });
  }

  // High finish roof support and service kit.
  for (const x of [-6.8, 6.8]) {
    for (const z of [-120.5, -133.5]) {
      builder.box(x, -12.5, z, 0.4, 37, 0.4, { material: "metal" });
    }
  }

  builder.box(-5.6, 5.82, -133.4, 2.2, 1.0, 1.6, { material: "metal" });
  builder.box(-5.6, 6.36, -133.4, 2.0, 0.1, 1.4, { material: "dark-metal" });
  builder.box(-6.6, 6.2, -126.8, 0.16, 2.0, 0.16, {
    material: "cool-light",
    emissive: 0xcfe8ff,
    emissiveIntensity: 0.25,
  });

  // A low city roof under the tower, so the climb has depth.
  builder.box(0, -30.5, -108, 64, 0.8, 82, { material: "roof", castShadow: false });
  builder.box(0, -30.1, -108, 64.4, 0.3, 82.4, { material: "concrete" });
}

function addCatwalk(builder: CityBuilder): void {
  // Red route paint along the outbound and return spans.
  for (let x = 10; x <= 44; x += 2.4) {
    if (x > 23.4 && x < 26.4) {
      continue;
    }

    builder.box(x, 5.218, -122.8, 1.1, 0.02, 0.14, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
    builder.box(x, 5.218, -130.8, 1.1, 0.02, 0.14, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }

  // Support masts down the catwalk and cables back to the tower.
  for (const x of [12, 22, 40, 52]) {
    for (const z of [-122.8, -130.8]) {
      builder.box(x, -12, z, 0.32, 35, 0.32, { material: "metal" });
    }
  }

  for (const x of [20, 35, 50]) {
    builder.box(x, 9.2, -126.8, 0.1, 0.1, 8.4, { material: "metal" });
    builder.box(x, 12.4, -126.8, 0.1, 0.1, 8.4, {
      material: "metal",
      rotationX: 0.5,
    });
  }

  for (const x of [14, 28, 42]) {
    builder.box(x, 5.5, -126.8, 1.2, 0.06, 0.06, {
      material: "cool-light",
      emissive: 0xcfe8ff,
      emissiveIntensity: 0.25,
      castShadow: false,
    });
  }

  // The turn marker faces the player on the outbound span.
  builder.plane(51.92, 6.55, -126.8, 2.2, 0.7, -Math.PI / 2, {
    text: "07 / TURN",
    background: 0x14191d,
    textColor: 0xf4f1e9,
    accentColor: 0xd52e36,
  });

  // A close RUN billboard gives the turn a designed foreground landmark.
  for (const z of [-130.4, -123.2]) {
    builder.box(56.2, 7.4, z, 0.28, 4.4, 0.28, { material: "metal" });
  }

  builder.box(56.2, 9.55, -126.8, 0.28, 0.28, 7.6, { material: "metal" });
  builder.box(56.32, 8.35, -126.8, 0.28, 3.0, 7.8, { material: "white" });
  builder.box(56.12, 8.35, -126.8, 0.04, 2.7, 7.4, { material: "orange" });

  builder.plane(56.06, 8.35, -126.8, 7.0, 2.5, -Math.PI / 2, {
    text: "RUN",
    background: 0xf08a2a,
    textColor: 0xfff6ea,
    accentColor: 0x111418,
  });

  // The upper scaffold's safe-retry pad is marked so the fall anchor has a
  // visible landmark.
  builder.cylinder(0, 2.02, -98.7, 2.1, 0.02, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  for (const side of [-1, 1]) {
    builder.box(side * 1.55, 2.6, -98.7, 0.08, 1.2, 0.08, { material: "metal" });
    builder.box(side * 1.55, 3.22, -98.7, 0.24, 0.08, 0.24, {
      material: "cool-light",
      emissive: 0xcfe8ff,
      emissiveIntensity: 0.25,
    });
  }

  // Deck seams and a suspended construction load break the long span.
  for (let x = 14; x <= 44; x += 6) {
    for (const z of [-122.8, -130.8]) {
      builder.box(x, 5.218, z, 0.12, 0.02, 3.2, {
        material: "dark-metal",
        castShadow: false,
        receiveShadow: false,
      });
    }
  }

  builder.box(33, 10.4, -126.8, 3.6, 2.0, 2.2, { material: "metal" });
  builder.box(33, 11.45, -126.8, 3.4, 0.12, 2.0, { material: "dark-metal" });
  builder.box(33, 9.35, -126.8, 3.8, 0.12, 2.4, { material: "dark-metal" });

  for (const x of [31.3, 34.7]) {
    for (const z of [-127.7, -125.9]) {
      builder.box(x, 15.2, z, 0.06, 9.6, 0.06, { material: "dark-metal" });
    }
  }

  for (const z of [-123.4, -129.9]) {
    builder.cylinder(54.4, 5.75, z, 1.1, 0.8, { material: "dark-metal" });
  }

  // Chevrons and a hazard block at the turn make the 180 readable.
  for (let offset = 0; offset < 3; offset += 1) {
    builder.box(49 + offset * 1.4, 5.218, -124.9, 0.8, 0.02, 0.22, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
  }

  builder.box(47.2, 5.225, -132.0, 1.2, 0.02, 0.6, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  // Hazard plates on both return barriers make the two-jump line readable
  // against the lower bypass.
  for (const x of [39, 34]) {
    builder.box(x + 0.27, 5.45, -130.8, 0.03, 0.36, 3.0, {
      material: "red",
      castShadow: false,
    });
  }

  // Finish-approach cue: the return rail ends near x=8; signpost the west-end
  // detour so the final gate is readable from the return catwalk.
  builder.plane(10.5, 6.45, -131.85, 2.5, 0.62, Math.PI / 2, {
    text: "FINISH / WEST END",
    background: 0x14191d,
    textColor: 0xf4f1e9,
    accentColor: 0xd52e36,
  });
  for (const z of [-131.55, -132.15]) {
    builder.box(10.5, 5.85, z, 0.06, 2.1, 0.06, {
      material: "metal",
      castShadow: false,
    });
  }
  for (const side of [-1, 1]) {
    builder.box(11.4 + side * 0.42, 5.218, -131.9, 0.74, 0.02, 0.16, {
      material: "red",
      rotationY: side * 0.52,
      castShadow: false,
      receiveShadow: false,
    });
  }

  // Entrance cue for the lower bypass: sign, edge paint, and a floor chevron.
  builder.plane(37, 6.55, -131.85, 2.1, 0.58, Math.PI / 2, {
    text: "BYPASS",
    background: 0x14191d,
    textColor: 0xf4f1e9,
    accentColor: 0xd52e36,
  });
  for (const z of [-131.55, -132.15]) {
    builder.box(37, 5.85, z, 0.06, 2.1, 0.06, {
      material: "metal",
      castShadow: false,
    });
  }
  builder.box(34, 5.215, -132.32, 8.0, 0.02, 0.14, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });
  for (const side of [-1, 1]) {
    builder.box(34 + side * 0.42, 5.218, -131.9, 0.74, 0.02, 0.16, {
      material: "red",
      rotationY: side * 0.52,
      castShadow: false,
      receiveShadow: false,
    });
  }

  // A distant hero skyline closes the open turn view without forming a wall.
  addBuilding(builder, 50, -300, 26, 18, {
    material: "glass-far",
    top: 12,
    facing: "north",
    roofProps: true,
    seed: 77,
  });
  addBuilding(builder, 18, -330, 18, 14, {
    material: "glass-far",
    top: 72,
    facing: "north",
    roofProps: true,
    seed: 78,
  });
  addBuilding(builder, 82, -318, 20, 16, {
    material: "glass-far",
    top: 82,
    facing: "north",
    roofProps: true,
    seed: 79,
  });

  // The far hero billboard now sits on the correspondingly cut skyline tower
  // (top 12) instead of floating in the opened sky.
  builder.plane(50, 14, -290.7, 13, 6.4, 0, {
    text: "GLASSLINE",
    background: 0x14191d,
    textColor: 0xf4f1e9,
    accentColor: 0xd52e36,
  });
  builder.box(50, 17.8, -300, 0.5, 2.0, 0.5, {
    material: "red",
    emissive: 0xc0262d,
    emissiveIntensity: 0.1,
    castShadow: false,
  });

  // A lower city roof under the catwalk keeps the drop readable.
  builder.box(32, -24, -126.8, 58, 0.8, 30, {
    material: "roof",
    castShadow: false,
  });
  builder.box(32, -23.6, -126.8, 58.4, 0.3, 30.4, { material: "concrete" });

  for (const x of [14, 30, 46]) {
    builder.box(x, -22.8, -126.8, 2.2, 1.4, 1.8, { material: "metal" });
    builder.box(x, -22.05, -126.8, 2.0, 0.1, 1.6, { material: "dark-metal" });
  }

  // Barrier face plates and the lower bypass entrance.
  for (let index = 0; index < 4; index += 1) {
    builder.box(34.27, 5.45, -132.1 + index * 0.9, 0.04, 0.4, 0.7, {
      material: index % 2 === 0 ? "red" : "white",
      castShadow: false,
    });
  }

  builder.plane(34, 6.65, -136.92, 1.8, 0.55, 0, {
    text: "BYPASS",
    background: 0x14191d,
    textColor: 0xf4f1e9,
    accentColor: 0xd52e36,
  });

  for (const x of [31, 37]) {
    builder.box(x, 4.815, -135.0, 1.4, 0.02, 0.44, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
    builder.box(x, 5.02, -133.1, 1.6, 0.02, 0.18, {
      material: "red",
      castShadow: false,
      receiveShadow: false,
    });
    builder.box(x, 5.5, -136.7, 0.18, 0.18, 0.18, {
      material: "cool-light",
      emissive: 0xcfe8ff,
      emissiveIntensity: 0.25,
      castShadow: false,
    });
  }
}

function addHighRoofDressing(builder: CityBuilder): void {
  builder.box(-5.6, 5.9, -121.4, 2.2, 1.4, 1.6, { material: "metal" });
  builder.box(-5.6, 6.65, -121.4, 2.0, 0.12, 1.4, { material: "dark-metal" });
  builder.box(-6.6, 6.2, -121.4, 0.2, 0.5, 0.2, {
    material: "red",
    emissive: 0xc0262d,
    emissiveIntensity: 0.1,
  });

  for (const [x, z] of [
    [5.4, -122.2],
    [6.2, -123.4],
    [4.9, -123.8],
  ] as const) {
    builder.box(x, 5.62, z, 0.8, 0.8, 0.8, { material: "dark-metal" });
  }

  builder.box(6.8, 7.0, -127.4, 0.18, 3.6, 0.18, { material: "metal" });
  builder.box(6.8, 8.8, -127.4, 2.8, 0.12, 0.12, { material: "metal" });
  builder.box(8.1, 8.6, -127.4, 0.4, 0.24, 0.24, {
    material: "cool-light",
    emissive: 0xcfe8ff,
    emissiveIntensity: 0.25,
  });

  builder.box(-6.9, 5.45, -127.8, 2.8, 0.5, 1.8, { material: "dark-metal" });
  builder.box(-6.9, 5.78, -127.8, 2.6, 0.08, 1.6, { material: "glass" });

  // Helipad marking north of the gate, off the finish approach.
  builder.cylinder(-4.2, 5.215, -123.6, 4.4, 0.02, {
    material: "dark-metal",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(-5.0, 5.23, -123.6, 0.28, 0.02, 1.9, {
    material: "white",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(-3.4, 5.23, -123.6, 0.28, 0.02, 1.9, {
    material: "white",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(-4.2, 5.23, -123.6, 1.6, 0.02, 0.28, {
    material: "white",
    castShadow: false,
    receiveShadow: false,
  });

  for (const [x, z] of [
    [-7.1, -121.0],
    [-1.3, -121.0],
    [-7.1, -126.2],
    [-1.3, -126.2],
  ] as const) {
    builder.box(x, 5.36, z, 0.22, 0.3, 0.22, {
      material: "cool-light",
      emissive: 0xcfe8ff,
      emissiveIntensity: 0.25,
    });
  }

  builder.cylinder(7.0, 5.7, -132.7, 0.9, 1.0, { material: "metal" });
  builder.cylinder(7.0, 6.25, -132.7, 1.0, 0.1, { material: "dark-metal" });
}

function addBillboards(builder: CityBuilder): void {
  // Finish banner centred in the gate so it reads on approach from the
  // catwalk return.
  builder.box(0, 8.2, -132.9, 5.0, 1.3, 0.32, { material: "white", castShadow: true });
  builder.box(0, 8.2, -132.72, 4.6, 1.1, 0.08, { material: "white" });

  builder.plane(0, 8.2, -132.62, 4.4, 1.0, 0, {
    text: "FINISH",
    background: 0x14191d,
    textColor: 0xf4f1e9,
    accentColor: 0xd52e36,
  });
}

/**
 * Cheap batched facade rhythm + roof props for the far-ring background towers.
 * The ring is plain boxes; after the W2 sky opening they read as blank slabs in
 * the canyon/rooftop frames, so the south-half ring gets spandrels, window
 * strips and piers on the camera-facing side plus a roof prop on near towers.
 */
function addFarTowerFacade(
  builder: CityBuilder,
  x: number,
  z: number,
  width: number,
  depth: number,
  top: number,
  radius: number,
): void {
  const baseY = GROUND_Y;
  const nearFace = z + depth / 2 + 0.06;
  const floors = Math.max(3, Math.min(9, Math.round((top - baseY) / 12)));
  const step = (top - baseY) / floors;

  for (let floor = 1; floor < floors; floor += 1) {
    const y = baseY + floor * step;

    builder.box(x, y, nearFace, width * 0.9, 0.3, 0.18, {
      material: "concrete",
      castShadow: false,
      receiveShadow: false,
    });
    builder.box(x, y + step * 0.42, nearFace, width * 0.82, Math.min(2.4, step * 0.4), 0.12, {
      material: floor % 2 === 0 ? "glass" : "glass-far",
      castShadow: false,
      receiveShadow: false,
    });
  }

  for (const px of [-0.32, 0, 0.32]) {
    builder.box(x + width * px, (baseY + top) / 2, nearFace + 0.02, 0.42, top - baseY, 0.16, {
      material: "white",
      castShadow: false,
      receiveShadow: false,
    });
  }

  if (radius < 230) {
    builder.box(x + width * 0.2, top + 0.95, z, 2.2, 1.2, 1.7, {
      material: "metal",
      castShadow: false,
    });
    builder.box(x + width * 0.2, top + 1.6, z, 2.0, 0.12, 1.5, {
      material: "dark-metal",
      castShadow: false,
    });
  }
}

function addFarSkyline(builder: CityBuilder): void {
  const random = createRandom(0x5eed1234);

  for (let index = 0; index < 64; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 135 + random() * 190;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const width = 14 + random() * 26;
    const depth = 14 + random() * 26;
    const top = 24 + random() * 120;
    // Two far-ring towers behind the finish gate block the W2 sky opening;
    // the AD-approved cut keeps the gate a silhouette against sky.
    const cutTop =
      Math.abs(x + 18.4) < 1 && Math.abs(z + 165.9) < 1
        ? 8
        : Math.abs(x + 65.4) < 1.5 && Math.abs(z + 215.8) < 1.5
          ? 10
          : top;
    const material: LevelMaterialType =
      random() > 0.62 ? "glass-far" : random() > 0.5 ? "concrete" : "facade";
    const crowdsCatwalkTurn = x > 20 && x < 95 && z < -112 && z > -260;

    if (crowdsCatwalkTurn) {
      continue;
    }

    builder.box(x, (cutTop + GROUND_Y) / 2, z, width, cutTop - GROUND_Y, depth, {
      material,
      castShadow: false,
      receiveShadow: false,
    });
    builder.box(x, cutTop + 0.4, z, width + 0.5, 0.8, depth + 0.5, {
      material: "concrete",
      castShadow: false,
      receiveShadow: false,
    });

    if (z < -100 && Math.abs(x) < 200) {
      addFarTowerFacade(builder, x, z, width, depth, cutTop, radius);
    }

    if (radius < 220 && random() > 0.35) {
      const bandCount = 2 + Math.floor(random() * 5);

      for (let band = 0; band < bandCount; band += 1) {
        const y = 8 + band * (cutTop / (bandCount + 1));
        const face = Math.floor(random() * 4);

        if (face === 0) {
          builder.box(x + width / 2 + 0.05, y, z, 0.1, 1.4, depth * 0.8, {
            material: random() > 0.7 ? "glass" : "glass-far",
            castShadow: false,
            receiveShadow: false,
          });
        } else if (face === 1) {
          builder.box(x - width / 2 - 0.05, y, z, 0.1, 1.4, depth * 0.8, {
            material: random() > 0.7 ? "glass" : "glass-far",
            castShadow: false,
            receiveShadow: false,
          });
        } else if (face === 2) {
          builder.box(x, y, z + depth / 2 + 0.05, width * 0.8, 1.4, 0.1, {
            material: random() > 0.7 ? "glass" : "glass-far",
            castShadow: false,
            receiveShadow: false,
          });
        } else {
          builder.box(x, y, z - depth / 2 - 0.05, width * 0.8, 1.4, 0.1, {
            material: random() > 0.7 ? "glass" : "glass-far",
            castShadow: false,
            receiveShadow: false,
          });
        }
      }
    }
  }

  // City floor far below the roof and a couple of arterial roads.
  builder.box(0, GROUND_Y - 0.3, 0, 760, 0.4, 760, {
    material: "asphalt",
    castShadow: false,
    receiveShadow: true,
  });
  builder.box(0, GROUND_Y + 0.02, -70, 680, 0.06, 20, {
    material: "dark-metal",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(-110, GROUND_Y + 0.02, 0, 18, 0.06, 680, {
    material: "dark-metal",
    castShadow: false,
    receiveShadow: false,
  });
}

/**
 * Prologue visual dressing: dense rooftop props, a close city canyon, a skybridge,
 * a construction crane, and a deep skyline. Visual only; route colliders live in
 * `PrologueArena`.
 */
export function createPrologueCityDecorations(
  sectionForZ: SectionResolver,
): LevelDecorationDefinition[] {
  const builder = new CityBuilder(sectionForZ, createRandom(0x91135));

  addParapetCoping(builder);
  addRoofExpansionJoints(builder);
  addEdgeRailings(builder);
  addPuddles(builder);
  addRoofRepairs(builder);
  addSkylight(builder);
  addSolarArray(builder);

  addAcUnit(builder, 9.4, -11.4, Math.PI / 2, 0.92);
  addAcUnit(builder, 9.4, 16.6, Math.PI / 2, 1.05);
  addAcUnit(builder, 8.8, 7.6, Math.PI / 2, 0.8);

  addDuctRun(builder, 10.4, 8, 12);
  addPipeRun(builder, 10.7, 0.68, -20, 14);

  addWestTowerWall(builder);

  addStairBulkhead(builder);
  addMiscRoofProps(builder);
  addServiceBlockLandmarks(builder);
  addLowerZone(builder);
  addFirstGapDressing(builder);
  addFinaleScaffold(builder);
  addCatwalk(builder);
  addHighRoofDressing(builder);
  addFinishArea(builder, -133, 5.2);
  addCheckpointBeacons(builder);

  addNearCity(builder);
  addOverheadBridge(builder);
  addSkybridge(builder);
  addSkybridgeOverhead(builder);
  addSkybridgeSideRoofs(builder);
  addCrane(builder);
  addBillboards(builder);
  addFarSkyline(builder);

  return builder.decorations;
}
