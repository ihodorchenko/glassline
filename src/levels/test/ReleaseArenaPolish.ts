import type {
  LevelDecorationDefinition,
  LevelEnvironmentDefinition,
  LevelMaterialType,
} from "../LevelTypes";

const TRAINING_SKYLINE = [0x74838f, 0x687782, 0x7f8d97, 0x5d6a75] as const;
const PROLOGUE_SKYLINE = [0x586778, 0x647587, 0x4d5b6b, 0x708192] as const;

function skyline(
  prefix: string,
  sectionOf: (z: number) => string,
  palette: readonly number[],
  count: number,
  windowColor: number,
  windowIntensity: number,
): LevelDecorationDefinition[] {
  const decorations: LevelDecorationDefinition[] = [];

  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * (32 + ((index * 7) % 20));
    const z = -46 + ((index * 13) % 82);
    const height = 9 + ((index * 11) % 24);
    const width = 6 + ((index * 5) % 10);
    const depth = 6 + ((index * 3) % 10);

    const color = palette[index % palette.length] ?? 0x647587;
    const sectionId = sectionOf(z);

    decorations.push({
      id: `${prefix}_skyline_${index}`,
      sectionId,
      shape: "box",
      position: { x, y: height / 2 - 0.1, z },
      size: { x: width, y: height, z: depth },
      color,
    });

    const inwardX = x - Math.sign(x) * (width / 2 + 0.03);

    for (const [windowIndex, offset] of [-0.28, 0.28].entries()) {
      decorations.push({
        id: `${prefix}_skyline_window_${index}_${windowIndex}`,
        sectionId,
        shape: "box",
        position: {
          x: inwardX,
          y: height * (windowIndex === 0 ? 0.62 : 0.34),
          z: z + depth * offset,
        },
        size: { x: 0.08, y: height * 0.16, z: 0.34 },
        color: windowColor,
        emissive: windowColor,
        emissiveIntensity: windowIntensity,
      });
    }
  }

  return decorations;
}

function gate(
  prefix: string,
  sectionId: string,
  z: number,
  color: number,
  accent: number,
): LevelDecorationDefinition[] {
  return [
    {
      id: `${prefix}_gate_west`,
      sectionId,
      shape: "box",
      position: { x: -3.2, y: 2, z },
      size: { x: 0.28, y: 4, z: 0.28 },
      color,
    },
    {
      id: `${prefix}_gate_east`,
      sectionId,
      shape: "box",
      position: { x: 3.2, y: 2, z },
      size: { x: 0.28, y: 4, z: 0.28 },
      color,
    },
    {
      id: `${prefix}_gate_bar`,
      sectionId,
      shape: "box",
      position: { x: 0, y: 4.05, z },
      size: { x: 6.7, y: 0.22, z: 0.3 },
      color,
    },
    {
      id: `${prefix}_gate_accent`,
      sectionId,
      shape: "box",
      position: { x: 0, y: 3.86, z: z - 0.17 },
      size: { x: 5.2, y: 0.06, z: 0.04 },
      color: accent,
    },
  ];
}

/** Training yard atmosphere: bright, slightly warmer midday. */
export const TRAINING_ENVIRONMENT: LevelEnvironmentDefinition = {
  skyColor: 0xa8cfe9,
  fogColor: 0xe2edf4,
  fogNear: 80,
  fogFar: 480,
  sunColor: 0xfff0da,
  sunIntensity: 4.9,
  hemisphereIntensity: 0.32,
  zenithColor: 0x3379ca,
  horizonColor: 0xe5f1f9,
  groundColor: 0xc8d8e1,
  cloudColor: 0xffffff,
  cloudShadowColor: 0xb0c1cf,
  cloudCover: 0.34,
  sunAzimuth: 2.4,
  sunElevation: 0.82,
};

/**
 * Prologue atmosphere: neutral high-summer daylight over the city.
 * Palette/light anchors from docs/reports/ART_BRIEF.md §2 and the W2.2 numeric
 * brief (W2_TARGETS.md §7): cobalt zenith #1C48D0, mid-sky #4A86C8, horizon
 * haze #DCEAF6 (= fog), neutral sun (#FFF8F0), sun elevation 52.7° (shadows
 * 0.76× object height, inside the 0.5–0.8× language), low hemisphere fill so
 * shadows stay cool and readable. sunAzimuth 2.6 rad: the sun 31° off the +Z
 * (behind) axis, right-behind the route view, so the key rakes shadows
 * left-forward across the deck without changing shot framing.
 */
export const PROLOGUE_ENVIRONMENT: LevelEnvironmentDefinition = {
  skyColor: 0x4a86c8,
  fogColor: 0xdceaf6,
  fogNear: 60,
  fogFar: 380,
  sunColor: 0xfff8f0,
  sunIntensity: 7.4,
  hemisphereIntensity: 0.2,
  zenithColor: 0x1c48d0,
  horizonColor: 0xdceaf6,
  groundColor: 0xb9cbd8,
  cloudColor: 0xf8f8f8,
  cloudShadowColor: 0xa8b8cc,
  cloudCover: 0.42,
  sunAzimuth: 2.6,
  sunElevation: 0.92,
};

function trainingTower(
  prefix: string,
  sectionId: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  top: number,
  material: LevelMaterialType,
): LevelDecorationDefinition[] {
  const decorations: LevelDecorationDefinition[] = [
    {
      id: `${prefix}_body`,
      sectionId,
      shape: "box",
      position: { x, y: top / 2 - 0.1, z },
      size: { x: width, y: top, z: depth },
      material,
      castShadow: true,
      receiveShadow: true,
    },
    {
      id: `${prefix}_cap`,
      sectionId,
      shape: "box",
      position: { x, y: top + 0.25, z },
      size: { x: width + 0.6, y: 0.5, z: depth + 0.6 },
      material: "concrete",
      castShadow: true,
    },
  ];
  const inward = x < 0 ? width / 2 + 0.05 : -width / 2 - 0.05;
  const rows = Math.max(4, Math.floor((top - 4) / 3.8));
  const columns = Math.max(3, Math.floor(depth / 4.2));

  for (let row = 0; row < rows; row += 1) {
    const y = 4 + row * 3.8;

    decorations.push({
      id: `${prefix}_slab_${row}`,
      sectionId,
      shape: "box",
      position: { x: x + inward, y, z },
      size: { x: 0.24, y: 0.18, z: depth * 0.98 },
      material: "concrete",
      castShadow: false,
    });

    for (let column = 0; column < columns; column += 1) {
      const zOffset = -depth / 2 + 2.4 + column * ((depth - 4.8) / Math.max(1, columns - 1));

      decorations.push({
        id: `${prefix}_window_${row}_${column}`,
        sectionId,
        shape: "box",
        position: { x: x + inward - Math.sign(x) * 0.02, y: y + 1.5, z: z + zOffset },
        size: { x: 0.06, y: 1.7, z: 2.2 },
        material: (row + column) % 3 === 0 ? "glass" : "glass-far",
        castShadow: false,
      });
    }
  }

  for (let column = 0; column <= columns; column += 1) {
    const zOffset = -depth / 2 + 2.4 + column * ((depth - 4.8) / Math.max(1, columns));

    decorations.push({
      id: `${prefix}_mullion_${column}`,
      sectionId,
      shape: "box",
      position: { x: x + inward + 0.02, y: top / 2, z: z + zOffset },
      size: { x: 0.12, y: top - 2, z: 0.18 },
      material: "metal",
      castShadow: false,
    });
  }

  // Projecting balcony bands break the flat curtain wall and add depth.
  for (let row = 2; row < rows; row += 3) {
    const y = 4 + row * 3.8 + 0.9;
    const side = -Math.sign(x);

    decorations.push(
      {
        id: `${prefix}_balcony_in_${row}`,
        sectionId,
        shape: "box",
        position: { x: x + inward + side * 0.38, y, z },
        size: { x: 0.76, y: 0.16, z: depth * 0.72 },
        material: "concrete",
        castShadow: true,
      },
      {
        id: `${prefix}_balcony_in_rail_${row}`,
        sectionId,
        shape: "box",
        position: { x: x + inward + side * 0.74, y: y + 0.5, z },
        size: { x: 0.08, y: 0.9, z: depth * 0.7 },
        material: "glass",
        castShadow: false,
      },
      {
        id: `${prefix}_balcony_in_door_${row}`,
        sectionId,
        shape: "box",
        position: { x: x + inward + side * 0.05, y: y + 1.05, z },
        size: { x: 0.08, y: 2.0, z: 1.15 },
        material: "dark-metal",
        castShadow: false,
      },
      {
        id: `${prefix}_balcony_in_warm_${row}`,
        sectionId,
        shape: "box",
        position: { x: x + inward + side * 0.06, y: y + 1.4, z: z + depth * 0.18 },
        size: { x: 0.06, y: 0.9, z: 0.42 },
        material: "glass",
        castShadow: false,
      },
    );
  }

  // South-facing facade for towers seen from the Training start.
  const southZ = z + depth / 2 + 0.05;
  const southColumns = Math.max(3, Math.floor(width / 4.2));

  for (let row = 0; row < rows; row += 1) {
    const y = 4 + row * 3.8;

    decorations.push({
      id: `${prefix}_south_slab_${row}`,
      sectionId,
      shape: "box",
      position: { x, y, z: southZ },
      size: { x: width * 0.98, y: 0.18, z: 0.24 },
      material: "concrete",
      castShadow: false,
    });

    for (let column = 0; column < southColumns; column += 1) {
      const xOffset = -width / 2 + 2.4 + column * ((width - 4.8) / Math.max(1, southColumns - 1));

      decorations.push({
        id: `${prefix}_south_window_${row}_${column}`,
        sectionId,
        shape: "box",
        position: { x: x + xOffset, y: y + 1.5, z: southZ - 0.02 },
        size: { x: 2.2, y: 1.7, z: 0.06 },
        material: (row + column) % 3 === 0 ? "glass" : "glass-far",
        castShadow: false,
      });
    }
  }

  for (let column = 0; column <= southColumns; column += 1) {
    const xOffset = -width / 2 + 2.4 + column * ((width - 4.8) / Math.max(1, southColumns));

    decorations.push({
      id: `${prefix}_south_mullion_${column}`,
      sectionId,
      shape: "box",
      position: { x: x + xOffset, y: top / 2, z: southZ + 0.02 },
      size: { x: 0.18, y: top - 2, z: 0.12 },
      material: "metal",
      castShadow: false,
    });
  }

  for (let row = 2; row < rows; row += 3) {
    const y = 4 + row * 3.8 + 0.9;

    decorations.push(
      {
        id: `${prefix}_balcony_south_${row}`,
        sectionId,
        shape: "box",
        position: { x, y, z: southZ + 0.38 },
        size: { x: width * 0.7, y: 0.16, z: 0.76 },
        material: "concrete",
        castShadow: true,
      },
      {
        id: `${prefix}_balcony_south_rail_${row}`,
        sectionId,
        shape: "box",
        position: { x, y: y + 0.5, z: southZ + 0.74 },
        size: { x: width * 0.68, y: 0.9, z: 0.08 },
        material: "glass",
        castShadow: false,
      },
      {
        id: `${prefix}_balcony_south_door_${row}`,
        sectionId,
        shape: "box",
        position: { x, y: y + 1.05, z: southZ + 0.05 },
        size: { x: 1.15, y: 2.0, z: 0.08 },
        material: "dark-metal",
        castShadow: false,
      },
      {
        id: `${prefix}_balcony_south_warm_${row}`,
        sectionId,
        shape: "box",
        position: { x: x + width * 0.18, y: y + 1.4, z: southZ + 0.06 },
        size: { x: 0.42, y: 0.9, z: 0.06 },
        material: "glass",
        castShadow: false,
      },
    );
  }

  decorations.push({
    id: `${prefix}_mechanical`,
    sectionId,
    shape: "box",
    position: { x: x + inward * 0.3, y: top + 1.1, z },
    size: { x: width * 0.32, y: 1.4, z: depth * 0.35 },
    material: "metal",
    castShadow: true,
  });

  decorations.push(
    {
      id: `${prefix}_mast`,
      sectionId,
      shape: "box",
      position: { x: x + inward * 0.7, y: top + 3.4, z },
      size: { x: 0.16, y: 5.8, z: 0.16 },
      material: "metal",
      castShadow: true,
    },
    {
      id: `${prefix}_beacon`,
      sectionId,
      shape: "box",
      position: { x: x + inward * 0.7, y: top + 6.4, z },
      size: { x: 0.38, y: 0.38, z: 0.38 },
      material: "red",
      emissive: 0xd52e36,
      emissiveIntensity: 0.1,
      castShadow: false,
    },
  );

  return decorations;
}

export function createTrainingDecorations(
  sectionForPosition: (z: number) => string,
): LevelDecorationDefinition[] {
  const start = sectionForPosition(5);
  const mid = sectionForPosition(-4);
  const finish = sectionForPosition(-18.5);
  const trainingTowers = [
    ...trainingTower("training_tower_west", sectionForPosition(-34), -31, -34, 18, 24, 30, "glass"),
    ...trainingTower("training_tower_east", sectionForPosition(-42), 32, -42, 20, 26, 34, "facade"),
    ...trainingTower(
      "training_tower_far_w",
      sectionForPosition(-64),
      -35,
      -64,
      22,
      28,
      46,
      "glass-far",
    ),
    ...trainingTower(
      "training_tower_far_e",
      sectionForPosition(-70),
      36,
      -70,
      24,
      26,
      42,
      "facade",
    ),
    ...trainingTower(
      "training_tower_north",
      sectionForPosition(-92),
      0,
      -92,
      34,
      30,
      58,
      "glass-far",
    ),
  ];

  return [
    ...trainingTowers,
    ...skyline("training", (z) => sectionForPosition(z), TRAINING_SKYLINE, 10, 0xdcecf2, 0.06),
    ...gate("training_start", start, 5.9, 0xd7d9d4, 0xd52e36),
    ...gate("training_finish", finish, -19.6, 0x3c444b, 0xd52e36),
    {
      id: "training_lane_west",
      sectionId: start,
      shape: "box",
      position: { x: -2.7, y: 0.015, z: -7 },
      size: { x: 0.09, y: 0.02, z: 25 },
      color: 0x3b4248,
    },
    {
      id: "training_lane_east",
      sectionId: start,
      shape: "box",
      position: { x: 2.7, y: 0.015, z: -7 },
      size: { x: 0.09, y: 0.02, z: 25 },
      color: 0x3b4248,
    },
    {
      id: "training_floor_logo",
      sectionId: start,
      shape: "plane",
      position: { x: 0, y: 0.035, z: 1.0 },
      size: { x: 3.2, y: 0.8, z: 0.02 },
      rotationX: -Math.PI / 2,
      text: "MOVEMENT YARD",
      color: 0xd8d4ca,
      textColor: 0x1b2226,
      accentColor: 0xd52e36,
      castShadow: false,
      receiveShadow: false,
    },
    ...([0.2, -5.8, -10.9, -16.2] as const).flatMap((z) => [
      {
        id: `training_chevron_w_${z}`,
        sectionId: sectionForPosition(z),
        shape: "box" as const,
        position: { x: -0.45, y: 0.025, z },
        size: { x: 0.8, y: 0.02, z: 0.18 },
        color: 0xd52e36,
        rotationY: 0.6,
        castShadow: false,
        receiveShadow: false,
      },
      {
        id: `training_chevron_e_${z}`,
        sectionId: sectionForPosition(z),
        shape: "box" as const,
        position: { x: 0.45, y: 0.025, z },
        size: { x: 0.8, y: 0.02, z: 0.18 },
        color: 0xd52e36,
        rotationY: -0.6,
        castShadow: false,
        receiveShadow: false,
      },
    ]),
    {
      id: "training_start_line",
      sectionId: start,
      shape: "box",
      position: { x: 0, y: 0.02, z: 4.6 },
      size: { x: 5.2, y: 0.02, z: 0.12 },
      color: 0xd52e36,
    },
    {
      id: "training_finish_line",
      sectionId: finish,
      shape: "box",
      position: { x: 0, y: 0.02, z: -19.1 },
      size: { x: 5.2, y: 0.02, z: 0.12 },
      color: 0xd52e36,
    },
    {
      id: "training_board_traversal",
      sectionId: mid,
      shape: "box",
      position: { x: -5.6, y: 2.1, z: -5 },
      size: { x: 2.4, y: 1.3, z: 0.15 },
      color: 0x343b40,
    },
    {
      id: "training_board_finish",
      sectionId: finish,
      shape: "box",
      position: { x: 5.6, y: 2.1, z: -16.6 },
      size: { x: 2.4, y: 1.3, z: 0.15 },
      color: 0x343b40,
    },
    {
      id: "training_board_traversal_sign",
      sectionId: mid,
      shape: "plane",
      position: { x: -5.6, y: 2.1, z: -4.91 },
      size: { x: 2.2, y: 1.1, z: 0.02 },
      rotationY: 0,
      text: "TRAVERSAL",
      color: 0x14191d,
      textColor: 0xf4f1e9,
      accentColor: 0xd52e36,
      castShadow: false,
      receiveShadow: false,
    },
    {
      id: "training_board_finish_sign",
      sectionId: finish,
      shape: "plane",
      position: { x: 5.6, y: 2.1, z: -16.51 },
      size: { x: 2.2, y: 1.1, z: 0.02 },
      rotationY: 0,
      text: "FINISH",
      color: 0x14191d,
      textColor: 0xf4f1e9,
      accentColor: 0xd52e36,
      castShadow: false,
      receiveShadow: false,
    },
    {
      id: "training_scaffold_west",
      sectionId: mid,
      shape: "box",
      position: { x: -6.4, y: 1.8, z: -11 },
      size: { x: 0.22, y: 3.6, z: 0.22 },
      color: 0x8b9194,
    },
    {
      id: "training_scaffold_east",
      sectionId: mid,
      shape: "box",
      position: { x: -4.4, y: 1.8, z: -11 },
      size: { x: 0.22, y: 3.6, z: 0.22 },
      color: 0x8b9194,
    },
    {
      id: "training_scaffold_cross",
      sectionId: mid,
      shape: "box",
      position: { x: -5.4, y: 3.4, z: -11 },
      size: { x: 2.2, y: 0.18, z: 0.18 },
      color: 0x8b9194,
    },
    {
      id: "training_cone_01",
      sectionId: start,
      shape: "cylinder",
      position: { x: 3.6, y: 0.35, z: 3.4 },
      size: { x: 0.45, y: 0.7, z: 0.45 },
      color: 0xe06b32,
    },
    {
      id: "training_cone_02",
      sectionId: start,
      shape: "cylinder",
      position: { x: -3.6, y: 0.35, z: 0.8 },
      size: { x: 0.45, y: 0.7, z: 0.45 },
      color: 0xe06b32,
    },
    {
      id: "training_cone_03",
      sectionId: mid,
      shape: "cylinder",
      position: { x: 3.4, y: 0.35, z: -10.5 },
      size: { x: 0.45, y: 0.7, z: 0.45 },
      color: 0xe06b32,
    },
    {
      id: "training_cone_04",
      sectionId: finish,
      shape: "cylinder",
      position: { x: -3.4, y: 0.35, z: -17.2 },
      size: { x: 0.45, y: 0.7, z: 0.45 },
      color: 0xe06b32,
    },
    {
      id: "training_checkpoint_beacon_w",
      sectionId: start,
      shape: "box",
      position: { x: -3.4, y: 1.05, z: 3 },
      size: { x: 0.1, y: 2.1, z: 0.1 },
      color: 0xd52e36,
      emissive: 0xd52e36,
      emissiveIntensity: 0.1,
    },
    // Red coping turns the boundary into a rooftop parapet rather than a black wall.
    ...[
      ["north", 0, 3.02, -22.05, 44, 0.1, 0.2],
      ["south", 0, 3.02, 22.05, 44, 0.1, 0.2],
      ["west", -22.05, 3.02, 0, 0.2, 0.1, 44],
      ["east", 22.05, 3.02, 0, 0.2, 0.1, 44],
    ].map(([id, x, y, z, sx, sy, sz]) => ({
      id: `training_coping_${id}`,
      sectionId: start,
      shape: "box" as const,
      position: { x: x as number, y: y as number, z: z as number },
      size: { x: sx as number, y: sy as number, z: sz as number },
      color: 0xd52e36,
      castShadow: false,
    })),
    {
      id: "training_yard_sign",
      sectionId: mid,
      shape: "plane",
      position: { x: 21.94, y: 3.65, z: -6 },
      size: { x: 7.5, y: 1.1, z: 0.02 },
      rotationY: -Math.PI / 2,
      text: "MOVEMENT YARD",
      color: 0x14191d,
      textColor: 0xf4f1e9,
      accentColor: 0xd52e36,
      castShadow: false,
      receiveShadow: false,
    },
    ...(
      [
        ["01 START", 2.4],
        ["02 TRAVERSAL", -7.2],
        ["03 FINISH", -17.8],
      ] as const
    ).map(([text, z]) => ({
      id: `training_section_sign_${z}`,
      sectionId: sectionForPosition(z),
      shape: "plane" as const,
      position: { x: -21.94, y: 2.1, z },
      size: { x: 2.4, y: 0.58, z: 0.02 },
      rotationY: Math.PI / 2,
      text,
      color: 0xf4f1e9,
      textColor: 0x14191d,
      accentColor: 0xd52e36,
      castShadow: false,
      receiveShadow: false,
    })),
    // Rooftop service kit framing the training lane.
    ...[
      [-15.2, 0.65, -4.2],
      [15.0, 0.55, -8.4],
      [-14.8, 0.75, -15.5],
    ].flatMap(([x, y, z], index) => [
      {
        id: `training_ac_body_${index}`,
        sectionId: start,
        shape: "box" as const,
        position: { x: x as number, y: y as number, z: z as number },
        size: { x: 2.2, y: 1.3, z: 1.6 },
        material: "metal" as LevelMaterialType,
        castShadow: true,
      },
      {
        id: `training_ac_cap_${index}`,
        sectionId: start,
        shape: "box" as const,
        position: { x: x as number, y: (y as number) + 0.7, z: z as number },
        size: { x: 2.0, y: 0.1, z: 1.4 },
        material: "dark-metal" as LevelMaterialType,
        castShadow: true,
      },
    ]),
    {
      id: "training_duct",
      sectionId: start,
      shape: "box",
      position: { x: -14.9, y: 0.5, z: -10.2 },
      size: { x: 0.7, y: 0.7, z: 11.5 },
      material: "metal",
      castShadow: true,
    },
    ...[
      [-10.8, 0.5, 9.4],
      [-9.7, 0.4, 10.2],
      [11.2, 0.45, 12.2],
    ].map(([x, y, z], index) => ({
      id: `training_crate_${index}`,
      sectionId: start,
      shape: "box" as const,
      position: { x: x as number, y: y as number, z: z as number },
      size: { x: 0.9, y: 0.8, z: 0.9 },
      material: "dark-metal" as LevelMaterialType,
      rotationY: index * 0.2,
      castShadow: true,
    })),
    {
      id: "training_overhead_pipe",
      sectionId: mid,
      shape: "box",
      position: { x: 0, y: 5.2, z: -14 },
      size: { x: 44, y: 0.35, z: 0.35 },
      material: "metal",
      castShadow: true,
    },
    {
      id: "training_yard_banner",
      sectionId: mid,
      shape: "plane",
      position: { x: 0, y: 4.35, z: -13.82 },
      size: { x: 7.0, y: 1.05, z: 0.02 },
      rotationY: 0,
      text: "MOVEMENT YARD",
      color: 0x14191d,
      textColor: 0xf4f1e9,
      accentColor: 0xd52e36,
      castShadow: false,
      receiveShadow: false,
    },
    {
      id: "training_yard_banner_hanger_w",
      sectionId: mid,
      shape: "box",
      position: { x: -3.2, y: 4.95, z: -13.85 },
      size: { x: 0.06, y: 0.5, z: 0.06 },
      material: "metal",
      castShadow: false,
    },
    {
      id: "training_yard_banner_hanger_e",
      sectionId: mid,
      shape: "box",
      position: { x: 3.2, y: 4.95, z: -13.85 },
      size: { x: 0.06, y: 0.5, z: 0.06 },
      material: "metal",
      castShadow: false,
    },
    {
      id: "training_overhead_pipe_red",
      sectionId: mid,
      shape: "box",
      position: { x: 0, y: 5.55, z: -14 },
      size: { x: 44, y: 0.1, z: 0.1 },
      color: 0xd52e36,
      castShadow: false,
    },
  ];
}

export function createPrologueDecorations(
  sectionForPosition: (z: number) => string,
): LevelDecorationDefinition[] {
  const start = sectionForPosition(5);
  const construction = sectionForPosition(-8);
  const finish = sectionForPosition(-18);

  return [
    ...skyline("prologue", (z) => sectionForPosition(z), PROLOGUE_SKYLINE, 14, 0xffd6a0, 0.06),
    ...gate("prologue_finish", finish, -19.6, 0x30373d, 0xd52e36),
    {
      id: "prologue_crane_mast",
      sectionId: start,
      shape: "box",
      position: { x: -25, y: 10, z: -9 },
      size: { x: 0.7, y: 20, z: 0.7 },
      color: 0x8d969b,
    },
    {
      id: "prologue_crane_jib",
      sectionId: start,
      shape: "box",
      position: { x: -20, y: 19.7, z: -9 },
      size: { x: 10, y: 0.45, z: 0.45 },
      color: 0x8d969b,
    },
    {
      id: "prologue_crane_counter",
      sectionId: start,
      shape: "box",
      position: { x: -27.5, y: 18.9, z: -9 },
      size: { x: 3, y: 1.1, z: 0.8 },
      color: 0x59636a,
    },
    {
      id: "prologue_unit_west",
      sectionId: start,
      shape: "box",
      position: { x: -5.4, y: 0.7, z: -3 },
      size: { x: 2.2, y: 1.4, z: 1.5 },
      color: 0x6c767c,
    },
    {
      id: "prologue_unit_west_fan",
      sectionId: start,
      shape: "cylinder",
      position: { x: -5.4, y: 1.5, z: -3 },
      size: { x: 1.2, y: 0.18, z: 1.2 },
      color: 0x3e464b,
    },
    {
      id: "prologue_unit_east",
      sectionId: construction,
      shape: "box",
      position: { x: 5.6, y: 0.65, z: -7.4 },
      size: { x: 2.4, y: 1.3, z: 2 },
      color: 0x6c767c,
    },
    {
      id: "prologue_pipe_west",
      sectionId: construction,
      shape: "cylinder",
      position: { x: -7.2, y: 0.22, z: -3.8 },
      size: { x: 0.35, y: 0.44, z: 0.35 },
      color: 0x556166,
      rotationY: 0,
    },
    {
      id: "prologue_pipe_east",
      sectionId: construction,
      shape: "cylinder",
      position: { x: 7.2, y: 0.22, z: -12.4 },
      size: { x: 0.35, y: 0.44, z: 0.35 },
      color: 0x556166,
      rotationY: 0,
    },
    {
      id: "prologue_section_board_industrial",
      sectionId: sectionForPosition(-3),
      shape: "box",
      position: { x: -5.4, y: 2.15, z: -2.4 },
      size: { x: 2.2, y: 1.2, z: 0.12 },
      color: 0x293239,
    },
    {
      id: "prologue_section_board_skybridge",
      sectionId: sectionForPosition(-12),
      shape: "box",
      position: { x: 5.4, y: 2.15, z: -12.8 },
      size: { x: 2.2, y: 1.2, z: 0.12 },
      color: 0x293239,
    },
    {
      id: "prologue_beacon_rooftop_w",
      sectionId: start,
      shape: "box",
      position: { x: -3.4, y: 1.1, z: 3 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0xd52e36,
      emissive: 0xd52e36,
      emissiveIntensity: 0.1,
    },
    {
      id: "prologue_beacon_industrial_w",
      sectionId: sectionForPosition(-2.5),
      shape: "box",
      position: { x: -3.4, y: 1.1, z: -2.5 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0xd52e36,
      emissive: 0xd52e36,
      emissiveIntensity: 0.1,
    },
    {
      id: "prologue_beacon_construction_w",
      sectionId: construction,
      shape: "box",
      position: { x: -3.4, y: 1.1, z: -8.5 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0xd52e36,
      emissive: 0xd52e36,
      emissiveIntensity: 0.1,
    },
    {
      id: "prologue_beacon_skybridge_w",
      sectionId: sectionForPosition(-14.5),
      shape: "box",
      position: { x: -3.4, y: 1.1, z: -14.5 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0xd52e36,
      emissive: 0xd52e36,
      emissiveIntensity: 0.1,
    },
    {
      id: "prologue_beacon_finish_w",
      sectionId: finish,
      shape: "box",
      position: { x: -3.4, y: 1.1, z: -18.5 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0xd52e36,
      emissive: 0xd52e36,
      emissiveIntensity: 0.1,
    },
    {
      id: "prologue_edge_west",
      sectionId: start,
      shape: "box",
      position: { x: -3.1, y: 0.08, z: -6 },
      size: { x: 0.12, y: 0.16, z: 25 },
      color: 0x3b444b,
    },
    {
      id: "prologue_edge_east",
      sectionId: start,
      shape: "box",
      position: { x: 3.1, y: 0.08, z: -6 },
      size: { x: 0.12, y: 0.16, z: 25 },
      color: 0x3b444b,
    },
    {
      id: "prologue_finish_stripes",
      sectionId: finish,
      shape: "box",
      position: { x: 0, y: 0.02, z: -19.1 },
      size: { x: 5.2, y: 0.02, z: 1.1 },
      color: 0xd52e36,
    },
  ];
}
