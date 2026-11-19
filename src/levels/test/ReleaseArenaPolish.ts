import type { LevelDecorationDefinition, LevelEnvironmentDefinition } from "../LevelTypes";

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
      emissive: color,
      emissiveIntensity: 0.06,
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
      emissive: accent,
      emissiveIntensity: 0.7,
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

/** Prologue atmosphere: clear high-summer daylight over the city. */
export const PROLOGUE_ENVIRONMENT: LevelEnvironmentDefinition = {
  skyColor: 0x8fc4e6,
  fogColor: 0xdfeaf2,
  fogNear: 90,
  fogFar: 560,
  sunColor: 0xfff2dc,
  sunIntensity: 5.6,
  hemisphereIntensity: 0.3,
  zenithColor: 0x2f6ec0,
  horizonColor: 0xd3e9f8,
  groundColor: 0xb9ccd8,
  cloudColor: 0xffffff,
  cloudShadowColor: 0xaebfce,
  cloudCover: 0.46,
  sunAzimuth: 2.25,
  sunElevation: 0.83,
};

export function createTrainingDecorations(
  sectionForPosition: (z: number) => string,
): LevelDecorationDefinition[] {
  const start = sectionForPosition(5);
  const mid = sectionForPosition(-4);
  const finish = sectionForPosition(-18.5);

  return [
    ...skyline("training", (z) => sectionForPosition(z), TRAINING_SKYLINE, 10, 0xdcecf2, 0.2),
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
      emissive: 0xd52e36,
      emissiveIntensity: 0.12,
    },
    {
      id: "training_board_finish",
      sectionId: finish,
      shape: "box",
      position: { x: 5.6, y: 2.1, z: -16.6 },
      size: { x: 2.4, y: 1.3, z: 0.15 },
      color: 0x343b40,
      emissive: 0xd52e36,
      emissiveIntensity: 0.12,
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
      emissiveIntensity: 0.5,
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
    ...skyline("prologue", (z) => sectionForPosition(z), PROLOGUE_SKYLINE, 14, 0xffd6a0, 0.5),
    ...gate("prologue_finish", finish, -19.6, 0x30373d, 0x9fcfdf),
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
      emissive: 0x9fcfdf,
      emissiveIntensity: 0.1,
    },
    {
      id: "prologue_section_board_skybridge",
      sectionId: sectionForPosition(-12),
      shape: "box",
      position: { x: 5.4, y: 2.15, z: -12.8 },
      size: { x: 2.2, y: 1.2, z: 0.12 },
      color: 0x293239,
      emissive: 0x9fcfdf,
      emissiveIntensity: 0.1,
    },
    {
      id: "prologue_beacon_rooftop_w",
      sectionId: start,
      shape: "box",
      position: { x: -3.4, y: 1.1, z: 3 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0x9fcfdf,
      emissive: 0x9fcfdf,
      emissiveIntensity: 0.6,
    },
    {
      id: "prologue_beacon_industrial_w",
      sectionId: sectionForPosition(-2.5),
      shape: "box",
      position: { x: -3.4, y: 1.1, z: -2.5 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0x9fcfdf,
      emissive: 0x9fcfdf,
      emissiveIntensity: 0.6,
    },
    {
      id: "prologue_beacon_construction_w",
      sectionId: construction,
      shape: "box",
      position: { x: -3.4, y: 1.1, z: -8.5 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0x9fcfdf,
      emissive: 0x9fcfdf,
      emissiveIntensity: 0.6,
    },
    {
      id: "prologue_beacon_skybridge_w",
      sectionId: sectionForPosition(-14.5),
      shape: "box",
      position: { x: -3.4, y: 1.1, z: -14.5 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0x9fcfdf,
      emissive: 0x9fcfdf,
      emissiveIntensity: 0.6,
    },
    {
      id: "prologue_beacon_finish_w",
      sectionId: finish,
      shape: "box",
      position: { x: -3.4, y: 1.1, z: -18.5 },
      size: { x: 0.1, y: 2.2, z: 0.1 },
      color: 0x9fcfdf,
      emissive: 0x9fcfdf,
      emissiveIntensity: 0.6,
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
      color: 0x9fcfdf,
      emissive: 0x9fcfdf,
      emissiveIntensity: 0.15,
    },
  ];
}
