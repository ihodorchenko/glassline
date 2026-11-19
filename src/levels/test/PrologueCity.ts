import type { LevelDecorationDefinition, LevelMaterialType } from "../LevelTypes";

type SectionResolver = (z: number) => string;

interface BoxOptions {
  readonly material: LevelMaterialType;
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

  builder.box(11.2, 1.08, 0, coping, 0.07, 44.6, { material: "white" });
  builder.box(0, 1.08, -22.2, 44.6, 0.07, coping, { material: "white" });
  builder.box(0, 1.08, 22.2, 44.6, 0.07, coping, { material: "white" });
}

function addEdgeRailings(builder: CityBuilder): void {
  for (let z = -20; z <= 20; z += 4) {
    builder.box(10.9, 0.55, z, 0.05, 1.1, 0.05, { material: "metal", castShadow: true });
  }

  builder.box(10.9, 1.12, 0, 0.07, 0.07, 41.4, { material: "metal" });
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

  // Painted route markers: dashed red centre line and checkpoint chevrons.
  for (let z = 4.6; z > -21; z -= 2.6) {
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

function addFinishArea(builder: CityBuilder): void {
  builder.box(-3.8, 2.1, -19.6, 0.34, 4.2, 0.34, { material: "white", castShadow: true });
  builder.box(3.8, 2.1, -19.6, 0.34, 4.2, 0.34, { material: "white", castShadow: true });
  builder.box(0, 4.2, -19.6, 7.9, 0.26, 0.38, { material: "white" });
  builder.box(0, 4.02, -19.6, 6.2, 0.08, 0.08, {
    material: "red",
    emissive: 0xc0262d,
    emissiveIntensity: 0.7,
  });
  builder.box(0, 0.016, -19.1, 5.2, 0.02, 0.16, {
    material: "red",
    castShadow: false,
    receiveShadow: false,
  });

  // Finish terminal with a lit screen.
  builder.box(2.5, 1.32, -18, 0.72, 0.5, 0.1, {
    material: "cool-light",
    rotationY: -0.4,
    emissive: 0xbfe6ff,
    emissiveIntensity: 0.8,
  });
  builder.box(2.5, 1.55, -18, 0.78, 0.08, 0.14, { material: "dark-metal", rotationY: -0.4 });
  builder.box(2.5, 0.62, -17.68, 0.5, 0.42, 0.04, {
    material: "cool-light",
    emissive: 0xbfe6ff,
    emissiveIntensity: 0.9,
  });
}

function addCheckpointBeacons(builder: CityBuilder): void {
  for (const z of [3, -2.5, -8.5, -14.5, -18.5]) {
    for (const side of [-1, 1]) {
      builder.box(side * 4.3, 0.38, z, 0.06, 0.76, 0.06, {
        material: "red",
        emissive: 0xc0262d,
        emissiveIntensity: 0.3,
      });
      builder.box(side * 4.3, 0.78, z, 0.22, 0.04, 0.22, {
        material: "red",
        emissive: 0xc0262d,
        emissiveIntensity: 0.25,
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
  const floors = Math.max(2, Math.round((options.top + 22) / floorHeight));
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

        addFaceBox(builder, frame, along, y, resolvedBay * 0.72, 1.8, 0.1, "warm-light", 0.05);
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
          random() > 0.93 ? "warm-light" : "glass",
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

  // Base plinth and service vents along the wall.
  builder.box(-7.9, 0.42, -8, 0.28, 0.84, 35.8, { material: "concrete" });

  for (const z of [4.5, -3.5, -10.5, -19]) {
    builder.box(-7.72, 0.82, z, 0.12, 0.5, 1.8, { material: "dark-metal" });
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
    top: 14,
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
    top: 26,
    facing: "east",
    roofProps: true,
    seed: 67,
  });
  addBuilding(builder, 32, -50, 20, 24, {
    material: "glass",
    top: 30,
    facing: "west",
    roofProps: true,
    seed: 71,
  });

  // Towers ahead, forming the main skyline wall behind the finish.
  addBuilding(builder, -32, -84, 24, 24, {
    material: "glass-far",
    top: 42,
    facing: "south",
    roofProps: true,
    seed: 31,
  });
  addBuilding(builder, 30, -96, 28, 26, {
    material: "facade",
    top: 54,
    facing: "south",
    roofProps: true,
    seed: 37,
  });
  addBuilding(builder, 4, -140, 48, 32, {
    material: "glass-far",
    top: 74,
    facing: "south",
    roofProps: false,
    seed: 41,
  });
  addBuilding(builder, -60, -66, 24, 30, {
    material: "concrete",
    top: 32,
    facing: "east",
    roofProps: true,
    seed: 43,
  });
  addBuilding(builder, 64, -64, 28, 28, {
    material: "glass-far",
    top: 46,
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

function addSkybridge(builder: CityBuilder): void {
  builder.box(0, 13.4, -44, 48, 0.8, 3.4, {
    material: "white",
    castShadow: true,
  });
  builder.box(0, 14.2, -44, 48, 1.4, 0.12, {
    material: "glass-far",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(0, 14.2, -42.6, 48, 1.4, 0.12, {
    material: "glass-far",
    castShadow: false,
    receiveShadow: false,
  });
  builder.box(0, 12.9, -44, 48.4, 0.18, 3.7, { material: "dark-metal" });
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
}

function addBillboards(builder: CityBuilder): void {
  // A smaller rooftop sign, kept off the route's centre sight-line.
  builder.box(8.4, 4.4, -23.9, 5.4, 3.6, 0.36, { material: "white", castShadow: true });
  builder.box(8.4, 4.4, -23.68, 5.0, 3.1, 0.1, { material: "white" });
  builder.box(8.4, 4.55, -23.6, 3.4, 0.34, 0.05, { material: "metal" });
  builder.box(8.4, 3.3, -23.6, 3.2, 0.16, 0.04, { material: "red" });

  for (const x of [6.2, 10.6]) {
    builder.box(x, 2.6, -24, 0.26, 5.2, 0.26, { material: "metal" });
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
    const material: LevelMaterialType =
      random() > 0.62 ? "glass-far" : random() > 0.5 ? "concrete" : "facade";

    builder.box(x, (top + GROUND_Y) / 2, z, width, top - GROUND_Y, depth, {
      material,
      castShadow: false,
      receiveShadow: false,
    });
    builder.box(x, top + 0.4, z, width + 0.5, 0.8, depth + 0.5, {
      material: "concrete",
      castShadow: false,
      receiveShadow: false,
    });

    if (radius < 220 && random() > 0.35) {
      const bandCount = 2 + Math.floor(random() * 5);

      for (let band = 0; band < bandCount; band += 1) {
        const y = 8 + band * (top / (bandCount + 1));
        const face = Math.floor(random() * 4);

        if (face === 0) {
          builder.box(x + width / 2 + 0.05, y, z, 0.1, 1.4, depth * 0.8, {
            material: random() > 0.7 ? "warm-light" : "glass-far",
            castShadow: false,
            receiveShadow: false,
          });
        } else if (face === 1) {
          builder.box(x - width / 2 - 0.05, y, z, 0.1, 1.4, depth * 0.8, {
            material: random() > 0.7 ? "warm-light" : "glass-far",
            castShadow: false,
            receiveShadow: false,
          });
        } else if (face === 2) {
          builder.box(x, y, z + depth / 2 + 0.05, width * 0.8, 1.4, 0.1, {
            material: random() > 0.7 ? "warm-light" : "glass-far",
            castShadow: false,
            receiveShadow: false,
          });
        } else {
          builder.box(x, y, z - depth / 2 - 0.05, width * 0.8, 1.4, 0.1, {
            material: random() > 0.7 ? "warm-light" : "glass-far",
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
  addEdgeRailings(builder);
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
  addFinishArea(builder);
  addCheckpointBeacons(builder);

  addNearCity(builder);
  addSkybridge(builder);
  addCrane(builder);
  addBillboards(builder);
  addFarSkyline(builder);

  return builder.decorations;
}
