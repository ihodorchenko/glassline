import * as THREE from "three";

import type { Disposable } from "../core/Disposable";

export type MaterialKey =
  | "white"
  | "concrete"
  | "roof"
  | "facade"
  | "glass"
  | "glass-far"
  | "glass-rail"
  | "metal"
  | "dark-metal"
  | "red"
  | "orange"
  | "rubber"
  | "asphalt"
  | "warm-light"
  | "cool-light"
  | "foliage"
  | "soil"
  | "stain"
  | "water"
  | "membrane";

interface MaterialSpec {
  readonly color: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly uvScale: number;
  readonly texture?: TextureKind;
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
  readonly envMapIntensity?: number;
  readonly transparent?: boolean;
  readonly depthWrite?: boolean;
  readonly opacity?: number;
  readonly side?: THREE.Side;
  /** Straight-tile maps store tile height in the canvas alpha channel. */
  readonly heightFromAlpha?: boolean;
}

type TextureKind =
  | "plaster"
  | "concrete"
  | "roof"
  | "facade"
  | "metal"
  | "asphalt"
  | "red"
  | "stain";

function createWaterAlphaMap(): THREE.Texture {
  const canvas = document.createElement("canvas");

  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126);

    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.58, "#d8d8d8");
    gradient.addColorStop(0.86, "#4a4a4a");
    gradient.addColorStop(1, "#000000");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  return texture;
}

const MATERIAL_SPECS: Record<MaterialKey, MaterialSpec> = {
  white: {
    color: 0xf8f8f8,
    roughness: 0.62,
    metalness: 0.02,
    uvScale: 0.24,
    texture: "plaster",
    heightFromAlpha: true,
  },
  concrete: {
    color: 0xc7c9c7,
    roughness: 0.9,
    metalness: 0,
    uvScale: 0.2,
    texture: "concrete",
    heightFromAlpha: true,
  },
  roof: {
    color: 0xf1f1ed,
    roughness: 0.6,
    metalness: 0,
    uvScale: 0.13,
    texture: "roof",
    heightFromAlpha: true,
  },
  facade: {
    color: 0xd8d6d0,
    roughness: 0.7,
    metalness: 0.05,
    uvScale: 0.16,
    texture: "facade",
    heightFromAlpha: true,
  },
  glass: {
    color: 0x1a2530,
    roughness: 0.13,
    metalness: 0.6,
    uvScale: 0.4,
    envMapIntensity: 1.55,
  },
  "glass-far": {
    color: 0x283038,
    roughness: 0.2,
    metalness: 0.5,
    uvScale: 0.4,
    envMapIntensity: 1.25,
  },
  "glass-rail": {
    color: 0x1a2530,
    roughness: 0.08,
    metalness: 0.2,
    uvScale: 0.4,
    envMapIntensity: 1.2,
    transparent: true,
    depthWrite: false,
    opacity: 0.32,
    side: THREE.DoubleSide,
  },
  metal: {
    color: 0x747a7d,
    roughness: 0.4,
    metalness: 0.85,
    uvScale: 0.34,
    texture: "metal",
    envMapIntensity: 1.05,
  },
  "dark-metal": {
    color: 0x2b3542,
    roughness: 0.5,
    metalness: 0.8,
    uvScale: 0.3,
    texture: "metal",
    envMapIntensity: 0.85,
  },
  red: {
    color: 0xd52e36,
    roughness: 0.6,
    metalness: 0,
    uvScale: 0.3,
    texture: "red",
  },
  orange: {
    color: 0xf08a2a,
    roughness: 0.62,
    metalness: 0.04,
    uvScale: 0.3,
  },
  rubber: {
    color: 0x24282b,
    roughness: 0.94,
    metalness: 0,
    uvScale: 0.4,
  },
  asphalt: {
    color: 0x55585b,
    roughness: 0.92,
    metalness: 0.02,
    uvScale: 0.07,
    texture: "asphalt",
  },
  "warm-light": {
    color: 0xf3e3c8,
    roughness: 0.5,
    metalness: 0,
    uvScale: 0.3,
    emissive: 0xffd9a5,
    emissiveIntensity: 0.16,
  },
  "cool-light": {
    color: 0xdfeef8,
    roughness: 0.4,
    metalness: 0.1,
    uvScale: 0.3,
    emissive: 0xcfe8ff,
    emissiveIntensity: 0.18,
  },
  foliage: {
    color: 0x4a5a40,
    roughness: 0.96,
    metalness: 0,
    uvScale: 0.28,
  },
  stain: {
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
    uvScale: 0.3,
    texture: "stain",
    transparent: true,
    depthWrite: false,
  },
  membrane: {
    color: 0x8b8e8c,
    roughness: 0.88,
    metalness: 0.02,
    uvScale: 0.18,
    texture: "asphalt",
  },
  water: {
    color: 0x718793,
    roughness: 0.05,
    metalness: 0.32,
    uvScale: 1,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    envMapIntensity: 1.5,
  },
  soil: {
    color: 0x3a3028,
    roughness: 0.98,
    metalness: 0,
    uvScale: 0.3,
  },
};

const TEXTURE_SIZE = 512;

const TEXTURE_BUMP_SCALE: Record<TextureKind, number> = {
  plaster: 0.08,
  concrete: 0.34,
  roof: 0.4,
  facade: 0.17,
  metal: 0.1,
  asphalt: 0.36,
  red: 0.08,
  stain: 0,
};

/**
 * Baseline value of the authored alpha height channel for straight-tile maps
 * (used to centre the parallax offset). Only plaster/concrete/roof author it.
 */
const TEXTURE_HEIGHT_BASE: Record<TextureKind, number> = {
  plaster: 0.86,
  concrete: 0.8,
  roof: 0.82,
  facade: 0.78,
  metal: 0.5,
  asphalt: 0.5,
  red: 0.5,
  stain: 0.5,
};

export interface SignMaterialOptions {
  readonly text: string;
  readonly background: number;
  readonly textColor: number;
  readonly accent: number;
}

function hexColor(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

function paintSign(options: SignMaterialOptions): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  canvas.width = 1024;
  canvas.height = 512;

  const context = canvas.getContext("2d");

  if (!context) {
    return canvas;
  }

  context.fillStyle = hexColor(options.background);
  context.fillRect(0, 0, 1024, 512);

  // Sparse diagonal texture and bold frame keep the sign in the same graphic
  // language as the HUD: flat colour, hard red rule, heavy uppercase type.
  context.save();
  context.globalAlpha = 0.08;
  context.strokeStyle = hexColor(options.textColor);
  context.lineWidth = 3;

  for (let offset = -512; offset < 1024; offset += 38) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + 512, 512);
    context.stroke();
  }

  context.restore();

  context.fillStyle = hexColor(options.accent);
  context.fillRect(0, 0, 18, 512);
  context.fillRect(0, 452, 1024, 18);

  const lines = options.text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const maxWidth = 860;
  const lineHeight = lines.length > 1 ? 128 : 170;
  let fontSize = lines.length > 1 ? 118 : 176;

  context.fillStyle = hexColor(options.textColor);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;

  for (const line of lines) {
    const width = context.measureText(line).width;

    if (width > maxWidth) {
      fontSize = Math.max(48, Math.floor(fontSize * (maxWidth / width)));
      context.font = `800 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
    }
  }

  const totalHeight = lines.length * lineHeight;
  const startY = 236 - totalHeight / 2 + lineHeight / 2;

  lines.forEach((line, index) => {
    context.fillText(line, 522, startY + index * lineHeight);
  });

  context.font = '600 24px "Helvetica Neue", Arial, sans-serif';
  context.textAlign = "left";
  context.globalAlpha = 0.62;
  context.fillText("GLASSLINE / RUNNER NETWORK", 48, 490);
  context.globalAlpha = 1;

  return canvas;
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

function fillBase(context: CanvasRenderingContext2D, color: string): void {
  context.fillStyle = color;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
}

function addMottle(
  context: CanvasRenderingContext2D,
  random: () => number,
  count: number,
  alpha: number,
  light: string,
  dark: string,
  radius = 48,
): void {
  for (let index = 0; index < count; index += 1) {
    const x = random() * TEXTURE_SIZE;
    const y = random() * TEXTURE_SIZE;
    const size = radius * (0.2 + random() * 0.8);
    const gradient = context.createRadialGradient(x, y, 0, x, y, size);

    gradient.addColorStop(0, random() > 0.5 ? light : dark);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.globalAlpha = alpha * (0.35 + random() * 0.65);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = 1;
}

function addSpeckle(
  context: CanvasRenderingContext2D,
  random: () => number,
  count: number,
  colors: readonly string[],
  maxSize = 1.6,
): void {
  for (let index = 0; index < count; index += 1) {
    const color = colors[Math.floor(random() * colors.length)] ?? "#000000";
    context.fillStyle = color;
    context.globalAlpha = 0.12 + random() * 0.32;
    const size = 0.5 + random() * maxSize;
    context.fillRect(random() * TEXTURE_SIZE, random() * TEXTURE_SIZE, size, size);
  }

  context.globalAlpha = 1;
}

function drawSeams(
  context: CanvasRenderingContext2D,
  spacing: number,
  color: string,
  width: number,
  alpha: number,
  startOffset = 0,
): void {
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineWidth = width;

  for (let offset = spacing + startOffset; offset < TEXTURE_SIZE; offset += spacing) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset, TEXTURE_SIZE);
    context.stroke();
    context.beginPath();
    context.moveTo(0, offset);
    context.lineTo(TEXTURE_SIZE, offset);
    context.stroke();
  }

  context.globalAlpha = 1;
}

/**
 * Starts a straight-tile map: albedo in RGB, tile height in the alpha channel.
 * Drawing uses `source-in` for the base colour and `source-atop` afterwards, so
 * every subsequent albedo detail (stains, grain, cracks) leaves the authored
 * tile height untouched.
 */
function beginTileMap(context: CanvasRenderingContext2D, albedo: string, baseHeight: number): void {
  context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.fillStyle = `rgba(255, 255, 255, ${baseHeight})`;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = albedo;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.globalCompositeOperation = "source-atop";
}

/**
 * Cuts a straight groove (vertical + horizontal grid, never diagonal) into the
 * alpha height channel. The albedo RGB is left as painted.
 */
function cutTileGrooves(
  context: CanvasRenderingContext2D,
  spacing: number,
  width: number,
  strength: number,
  startOffset = 0,
): void {
  context.globalCompositeOperation = "destination-out";
  drawSeams(context, spacing, "rgba(0, 0, 0, 1)", width, strength, startOffset);
  context.globalCompositeOperation = "source-atop";
}

/** Cuts only horizontal bands (trowel lines on plaster) into the height channel. */
function cutHorizontalBands(
  context: CanvasRenderingContext2D,
  spacing: number,
  width: number,
  strength: number,
  startOffset = 0,
): void {
  context.globalCompositeOperation = "destination-out";
  context.globalAlpha = strength;
  context.strokeStyle = "rgba(0, 0, 0, 1)";
  context.lineWidth = width;

  for (let offset = spacing + startOffset; offset < TEXTURE_SIZE; offset += spacing) {
    context.beginPath();
    context.moveTo(0, offset);
    context.lineTo(TEXTURE_SIZE, offset);
    context.stroke();
  }

  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-atop";
}

/** Restores normal canvas composition after the height-channel cuts. */
function finishTileMap(context: CanvasRenderingContext2D): void {
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
}

function addCracks(
  context: CanvasRenderingContext2D,
  random: () => number,
  count: number,
  color: string,
  alpha: number,
): void {
  context.strokeStyle = color;
  context.lineCap = "round";

  for (let index = 0; index < count; index += 1) {
    let x = random() * TEXTURE_SIZE;
    let y = random() * TEXTURE_SIZE;
    const segments = 2 + Math.floor(random() * 5);

    context.globalAlpha = alpha * (0.35 + random() * 0.65);
    context.lineWidth = 0.5 + random() * 0.9;
    context.beginPath();
    context.moveTo(x, y);

    for (let segment = 0; segment < segments; segment += 1) {
      x += (random() - 0.5) * 46;
      y += 12 + random() * 34;
      context.lineTo(x, y);
    }

    context.stroke();
  }

  context.globalAlpha = 1;
}

function addRust(context: CanvasRenderingContext2D, random: () => number, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const x = random() * TEXTURE_SIZE;
    const y = random() * TEXTURE_SIZE;
    const radius = 1.5 + random() * 8;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, `rgba(104, 61, 34, ${0.14 + random() * 0.28})`);
    gradient.addColorStop(0.6, `rgba(122, 74, 40, ${0.06 + random() * 0.12})`);
    gradient.addColorStop(1, "rgba(122, 74, 40, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function paintTexture(kind: TextureKind): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;

  const context = canvas.getContext("2d");

  if (!context) {
    return canvas;
  }

  const random = createRandom(kind.length * 7919 + TEXTURE_SIZE);

  switch (kind) {
    case "plaster": {
      // Straight-tile plaster: albedo + grain live in RGB, the alpha channel
      // carries only straight trowel bands. Radial mottle stays out of the
      // height channel, so long white walls cannot pick up swirl-bump.
      beginTileMap(context, "#f9f9f7", 0.86);
      addMottle(context, random, 90, 0.05, "#ffffff", "#e0e0dd", 64);
      addCracks(context, random, 9, "#b4b4b0", 0.1);
      addSpeckle(context, random, 2000, ["#ffffff", "#e8e8e5", "#d6d6d2"], 1.2);
      cutHorizontalBands(context, 128, 3, 0.1, -64);
      finishTileMap(context);
      break;
    }
    case "concrete": {
      // Straight-tile concrete: formwork joints are authored straight in the
      // albedo and again as grooves in the alpha height channel; stains and
      // cracks stay albedo-only so they cannot bend the bump map.
      beginTileMap(context, "#f4f5f4", 0.8);
      addMottle(context, random, 110, 0.06, "#ffffff", "#c2c7c8", 80);
      drawSeams(context, 128, "#cfd3d4", 1.4, 0.24, -64);
      drawSeams(context, 128, "#ffffff", 1, 0.16, -62);
      addCracks(context, random, 16, "#9a9fa0", 0.18);
      addSpeckle(context, random, 4200, ["#ffffff", "#dcdfe0", "#b9bec0"], 1.4);

      for (let index = 0; index < 20; index += 1) {
        const x = random() * TEXTURE_SIZE;
        const y = random() * TEXTURE_SIZE;
        const radius = 30 + random() * 80;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

        gradient.addColorStop(0, `rgba(168, 173, 174, ${0.05 + random() * 0.09})`);
        gradient.addColorStop(1, "rgba(168, 173, 174, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      cutTileGrooves(context, 128, 6.5, 0.18, -64);
      cutTileGrooves(context, 128, 1.8, 0.46, -64);
      finishTileMap(context);
      break;
    }
    case "roof": {
      // Straight-tile roof paint: albedo in RGB (panel tints, stains, grain),
      // the 0.96 m seam grid repeated in the alpha height channel as straight
      // grooves. No radial gradient reaches the bump map, so the deck keeps
      // seam detail without swirl-bump at grazing angles.
      beginTileMap(context, "#f8f8f5", 0.82);
      addMottle(context, random, 90, 0.06, "#ffffff", "#eaeae6", 110);
      addSpeckle(context, random, 1600, ["#fbfbf9", "#f0f0ed", "#e6e6e2"], 1.4);

      // Painted sheet panels aligned to the seam grid: 64 px at the roof UV
      // scale is the 0.6-1.2 m seam language from the art brief.
      for (let y = 32; y < TEXTURE_SIZE; y += 64) {
        for (let x = 32; x < TEXTURE_SIZE; x += 64) {
          context.fillStyle = random() > 0.5 ? "#ffffff" : "#deded9";
          context.globalAlpha = 0.012 + random() * 0.03;
          context.fillRect(x + 1, y + 1, 62, 62);
        }
      }

      context.globalAlpha = 1;
      // Raised seam albedo (dark groove + mid lip) so the near-white deck keeps
      // edge detail instead of reading as chalk.
      drawSeams(context, 64, "#b0b0ab", 1.9, 0.66, -32);
      drawSeams(context, 64, "#dcdcd7", 1.1, 0.55, -29.9);
      addCracks(context, random, 10, "#948f89", 0.1);

      for (let index = 0; index < 30; index += 1) {
        const x = random() * TEXTURE_SIZE;
        const y = random() * TEXTURE_SIZE;
        const radius = 8 + random() * 34;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

        gradient.addColorStop(0, `rgba(118, 117, 112, ${0.05 + random() * 0.08})`);
        gradient.addColorStop(1, "rgba(118, 117, 112, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      // Straight groove grid in the height channel: soft bevel + sharp centre.
      cutTileGrooves(context, 64, 6, 0.2, -32);
      cutTileGrooves(context, 64, 1.8, 0.5, -32);
      finishTileMap(context);
      break;
    }
    case "facade": {
      // Straight-tile facade: straight panel joints authored in the albedo and
      // again as grooves in the alpha height channel; mottle, streaks and
      // cracks stay albedo-only so long city walls keep no diagonal swirl.
      beginTileMap(context, "#f6f5f3", 0.78);
      addMottle(context, random, 60, 0.04, "#ffffff", "#cfcfcb", 90);
      drawSeams(context, 256, "#c9c8c4", 2, 0.26, -128);
      drawSeams(context, 128, "#deddd9", 1, 0.14, -64);
      addCracks(context, random, 7, "#a4a39f", 0.1);

      for (let index = 0; index < 26; index += 1) {
        const x = random() * TEXTURE_SIZE;
        const y = random() * TEXTURE_SIZE;
        const length = 30 + random() * 120;

        context.globalAlpha = 0.02 + random() * 0.04;
        context.fillStyle = "#90908c";
        context.fillRect(x, y, 1 + random() * 2, length);
      }

      context.globalAlpha = 1;
      addSpeckle(context, random, 2200, ["#ffffff", "#deddda", "#cbcac6"], 1);
      cutTileGrooves(context, 256, 6, 0.2, -128);
      cutTileGrooves(context, 256, 1.8, 0.45, -128);
      finishTileMap(context);
      break;
    }
    case "metal": {
      // Bright neutral base so the steel albedo comes from MATERIAL_SPECS; the
      // map only carries the directional brush and sparse rust.
      fillBase(context, "#edeff0");
      for (let index = 0; index < 2600; index += 1) {
        context.strokeStyle = random() > 0.5 ? "#fbfdfd" : "#c8cccd";
        context.globalAlpha = 0.06 + random() * 0.14;
        context.lineWidth = 0.6 + random();
        const x = random() * TEXTURE_SIZE;
        const length = 12 + random() * 90;
        context.beginPath();
        context.moveTo(x, random() * TEXTURE_SIZE);
        context.lineTo(x, random() * TEXTURE_SIZE + length);
        context.stroke();
      }
      context.globalAlpha = 1;
      addRust(context, random, 26);
      break;
    }
    case "stain": {
      for (let index = 0; index < 22; index += 1) {
        const x = random() * TEXTURE_SIZE;
        const y = random() * TEXTURE_SIZE;
        const radius = 18 + random() * 64;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

        gradient.addColorStop(0, `rgba(72, 68, 61, ${0.16 + random() * 0.24})`);
        gradient.addColorStop(0.55, `rgba(92, 88, 80, ${0.08 + random() * 0.12})`);
        gradient.addColorStop(1, "rgba(92, 88, 80, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      break;
    }
    case "asphalt": {
      fillBase(context, "#55585a");
      addSpeckle(context, random, 9000, ["#74777a", "#3d4042", "#8b8e90"], 2.2);
      break;
    }
    case "red": {
      // Neutral wear mask, not a red gradient: the saturated route red is the
      // material colour (#D52E36), and wear darkens <=15 % of the surface
      // locally instead of fading the whole panel towards salmon in the light.
      fillBase(context, "#f5f5f5");

      for (let index = 0; index < 16; index += 1) {
        const x = random() * TEXTURE_SIZE;
        const y = random() * TEXTURE_SIZE;
        const radius = 14 + random() * 26;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

        gradient.addColorStop(0, `rgba(196, 196, 192, ${0.16 + random() * 0.2})`);
        gradient.addColorStop(0.7, `rgba(196, 196, 192, ${0.06 + random() * 0.1})`);
        gradient.addColorStop(1, "rgba(196, 196, 192, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      addSpeckle(context, random, 900, ["#d0d0cc", "#ffffff"], 1.1);
      break;
    }
  }

  return canvas;
}

const TRIPLANAR_PATCH = /* glsl */ `
  varying vec3 vTriplanarPosition;
  varying vec3 vTriplanarNormal;
`;

const TRIPLANAR_SAMPLE = /* glsl */ `
  uniform float uTriplanarScale;
  uniform float uBumpScale;
  uniform float uDetailScale;
  uniform float uDetailMix;
  uniform float uParallaxDepth;
  uniform float uHeightFromAlpha;
  uniform float uHeightBase;
  uniform float uHeightScale;

  vec4 sampleTriplanarAt(sampler2D source, vec3 scaled, vec3 weights) {
    return texture2D(source, scaled.zy) * weights.x
      + texture2D(source, scaled.xz) * weights.y
      + texture2D(source, scaled.xy) * weights.z;
  }

  vec4 sampleTriplanar(sampler2D source, vec3 position, vec3 weights) {
    vec3 scaled = position * uTriplanarScale;
    vec4 base = sampleTriplanarAt(source, scaled, weights);
    // Straight-tile maps keep the physical tile height in the alpha channel;
    // older maps fall back to albedo luma. Same number of texture fetches.
    // Authored alpha height is scaled down to the same relief range the
    // legacy luma bump used, so straight seams stay a seam and do not turn
    // the deck into a glossy tile grid.
    float height = mix(
      dot(base.rgb, vec3(0.299, 0.587, 0.114)) - 0.5,
      (base.a - uHeightBase) * uHeightScale,
      uHeightFromAlpha
    );
    vec3 viewDir = normalize(cameraPosition - position);
    vec3 shifted = (position + viewDir * height * uParallaxDepth) * uTriplanarScale;
    vec4 parallaxed = sampleTriplanarAt(source, shifted, weights);
    vec4 detail = sampleTriplanarAt(source, shifted * uDetailScale, weights);

    return mix(parallaxed, detail, uDetailMix);
  }
`;

function applyTriplanar(
  material: THREE.MeshStandardMaterial,
  scale: number,
  bumpScale: number,
  heightFromAlpha: boolean,
  heightBase: number,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTriplanarScale = { value: scale };
    shader.uniforms.uBumpScale = { value: bumpScale };
    // Straight-tile maps keep a little grain but avoid the 3.3x detail sample
    // that moires into diagonal swirl on long floors and walls.
    shader.uniforms.uDetailScale = { value: heightFromAlpha ? 2.3 : 3.3 };
    shader.uniforms.uDetailMix = { value: heightFromAlpha ? 0.05 : 0.12 };
    shader.uniforms.uParallaxDepth = { value: 0.03 };
    shader.uniforms.uHeightFromAlpha = { value: heightFromAlpha ? 1 : 0 };
    shader.uniforms.uHeightBase = { value: heightBase };
    shader.uniforms.uHeightScale = { value: heightFromAlpha ? 0.34 : 1 };

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${TRIPLANAR_PATCH}`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>

        vec4 triplanarPosition = vec4(transformed, 1.0);
        vec3 triplanarNormal = objectNormal;

        #ifdef USE_INSTANCING
          triplanarPosition = instanceMatrix * triplanarPosition;
          triplanarNormal = mat3(instanceMatrix) * triplanarNormal;
        #endif

        triplanarPosition = modelMatrix * triplanarPosition;
        vTriplanarPosition = triplanarPosition.xyz;
        vTriplanarNormal = normalize(mat3(modelMatrix) * triplanarNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${TRIPLANAR_PATCH}\n${TRIPLANAR_SAMPLE}`)
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          vec3 triplanarWeights = pow(abs(normalize(vTriplanarNormal)), vec3(4.0));
          triplanarWeights /= (triplanarWeights.x + triplanarWeights.y + triplanarWeights.z);
          vec4 triplanarTexel = sampleTriplanar(map, vTriplanarPosition, triplanarWeights);
          // Albedo from RGB. For straight-tile maps alpha is tile height and
          // must not leak into opacity; for legacy maps alpha is still the
          // transparency mask (e.g. the stain decals).
          diffuseColor.rgb *= triplanarTexel.rgb;
          diffuseColor.a *= mix(triplanarTexel.a, 1.0, uHeightFromAlpha);
          float triplanarLuma = dot(triplanarTexel.rgb, vec3(0.299, 0.587, 0.114));
          float triplanarHeight = mix(
            triplanarLuma,
            (triplanarTexel.a - uHeightBase) * uHeightScale,
            uHeightFromAlpha
          );
        #endif`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        #if defined( USE_MAP ) && ! defined( USE_ROUGHNESSMAP )
          // Legacy maps modulate roughness by albedo luma (+-6 %). Straight-tile
          // maps instead make the recessed grooves slightly rougher, so albedo
          // stains no longer drag the highlight roughness around.
          float triplanarTileMask = clamp(triplanarTexel.a / max(uHeightBase, 1e-3), 0.0, 1.0);
          float tileRoughness = mix(1.0, 1.06, 1.0 - triplanarTileMask);
          roughnessFactor *= mix(mix(0.94, 1.06, triplanarLuma), tileRoughness, uHeightFromAlpha);
        #endif`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        #if defined( USE_MAP ) && defined( USE_BUMPMAP )
          // Triplanar bump: reuse the height already sampled for the albedo
          // (straight-tile alpha channel, or albedo luma for legacy maps), so
          // the bump costs no extra texture fetches, then convert the
          // world-space gradient back to view space for Three's lighting stage.
          float bumpHeight = triplanarHeight;
          vec3 bumpDpdx = dFdx(vTriplanarPosition);
          vec3 bumpDpdy = dFdy(vTriplanarPosition);
          float bumpDhdx = dFdx(bumpHeight);
          float bumpDhdy = dFdy(bumpHeight);
          vec3 bumpN = normalize(vTriplanarNormal);
          vec3 bumpR1 = cross(bumpDpdy, bumpN);
          vec3 bumpR2 = cross(bumpN, bumpDpdx);
          float bumpDet = dot(bumpDpdx, bumpR1);
          if (abs(bumpDet) > 1e-8) {
            vec3 bumpGrad = sign(bumpDet) * (bumpDhdx * bumpR1 + bumpDhdy * bumpR2);
            vec3 bumpedWorld = normalize(abs(bumpDet) * bumpN - uBumpScale * bumpGrad);
            normal = normalize(mat3(viewMatrix) * bumpedWorld);
          }
        #endif`,
      );
  };
  material.customProgramCacheKey = () => "glassline-triplanar";
}

/**
 * Fresnel-weighted opacity for the transparent glass-rail panels.
 *
 * The rail panels are seen at grazing angles on the skybridge, where a flat
 * transparency lets the bright sky reflection stack up and read milky. This
 * keeps the authored 0.32 base opacity at head-on angles and falls off toward
 * `grazingOpacity` as the view grazes the panel (pure ALU: one dot, one pow,
 * one mix; no extra texture fetch, no change to sorting or the material cache).
 * `material.opacity` stays the base value, so a head-on fallback is unchanged.
 */
function applyGlassRailOpacity(
  material: THREE.MeshStandardMaterial,
  baseOpacity: number,
  grazingOpacity: number,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRailOpacityBase = { value: baseOpacity };
    shader.uniforms.uRailOpacityGrazing = { value: grazingOpacity };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uRailOpacityBase;
        uniform float uRailOpacityGrazing;`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        {
          float railNdotV = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          float railGrazing = pow(1.0 - railNdotV, 1.8);
          diffuseColor.a = mix(uRailOpacityBase, uRailOpacityGrazing, railGrazing);
        }`,
      );
  };
  material.customProgramCacheKey = () => "glassline-glass-rail-opacity";
}

const GLASS_SHEEN_TINT = 0x585c60;

/**
 * Grazing sheen for the dark glass masses.
 *
 * With `metalness` 0.6 the specular lobe is tinted by the dark albedo, so a
 * large facade seen close to normal reads as flat near-black instead of a
 * reflective mass. This adds a view-dependent blue-grey term to the indirect
 * specular (pure ALU: one dot, one pow, one add in the glass fragment shaders;
 * no extra texture fetch, so the `low` tier cost is unchanged). At normal
 * incidence it is ~0, at grazing angles it restores the sky-gradient sheen
 * without brightening the albedo.
 */
function applyGlassSheen(
  material: THREE.MeshStandardMaterial,
  tint: number,
  strength: number,
  base: number,
): void {
  const linearTint = new THREE.Color(tint);

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlassSheenTint = {
      value: new THREE.Vector3(linearTint.r, linearTint.g, linearTint.b),
    };
    shader.uniforms.uGlassSheenStrength = { value: strength };
    shader.uniforms.uGlassSheenBase = { value: base };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uGlassSheenTint;
        uniform float uGlassSheenStrength;
        uniform float uGlassSheenBase;`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        {
          float glassNdotV = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
          float glassGrazing = min(1.0 - glassNdotV, 0.62);
          float glassSheen = uGlassSheenBase
            + (1.0 - uGlassSheenBase) * pow(glassGrazing, 1.4);
          reflectedLight.indirectSpecular += uGlassSheenTint * glassSheen * uGlassSheenStrength;
        }`,
      );
  };
  material.customProgramCacheKey = () => "glassline-glass-sheen";
}

/**
 * Shared PBR material set for level surfaces and decorations. All textures are
 * generated at runtime, so the game ships no image assets.
 */
export class MaterialLibrary implements Disposable {
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly textures: THREE.Texture[] = [];
  private readonly colorMaterials = new Map<number, THREE.MeshStandardMaterial>();
  private disposed = false;

  get(key: MaterialKey): THREE.MeshStandardMaterial {
    const cached = this.materials.get(key);

    if (cached) {
      return cached;
    }

    const spec = MATERIAL_SPECS[key];
    const material = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness,
      envMapIntensity: spec.envMapIntensity ?? 0.5,
      transparent: spec.transparent ?? false,
      depthWrite: spec.depthWrite ?? true,
      opacity: spec.opacity ?? 1,
      side: spec.side ?? THREE.FrontSide,
    });

    if (key === "glass-rail") {
      // Fresnel-weighted transparency: 0.32 head-on, thinner at grazing so the
      // balustrade stops reading milky while the structure below stays visible.
      applyGlassRailOpacity(material, 0.32, 0.18);
    }

    if (key === "glass" || key === "glass-far") {
      // Env sheen is a pure fragment-shader term; see applyGlassSheen.
      applyGlassSheen(
        material,
        GLASS_SHEEN_TINT,
        key === "glass" ? 0.9 : 1.0,
        key === "glass" ? 0.07 : 0.15,
      );
    }

    if (key === "water" && typeof document !== "undefined") {
      const alphaMap = createWaterAlphaMap();

      material.alphaMap = alphaMap;
      material.alphaTest = 0.08;
      this.textures.push(alphaMap);
    }

    if (spec.emissive !== undefined) {
      material.emissive.setHex(spec.emissive);
      material.emissiveIntensity = spec.emissiveIntensity ?? 1;
    }

    if (spec.texture && typeof document !== "undefined") {
      const texture = new THREE.CanvasTexture(paintTexture(spec.texture));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 16;
      texture.needsUpdate = true;
      material.map = texture;
      material.bumpScale = 1;
      material.bumpMap = texture;
      this.textures.push(texture);
      applyTriplanar(
        material,
        spec.uvScale,
        TEXTURE_BUMP_SCALE[spec.texture],
        spec.heightFromAlpha === true,
        TEXTURE_HEIGHT_BASE[spec.texture],
      );
    }

    this.materials.set(key, material);

    return material;
  }

  /** Stable muted material for authored decoration colours without a semantic key. */
  getSign(options: SignMaterialOptions): THREE.MeshStandardMaterial {
    const key = `sign:${options.text}:${options.background}:${options.textColor}:${options.accent}`;
    const cached = this.materials.get(key);

    if (cached) {
      return cached;
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      // Matte print: the canvas albedo must carry the sign, not a glossy sheen.
      roughness: 0.78,
      metalness: 0,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
    });

    if (typeof document !== "undefined") {
      const texture = new THREE.CanvasTexture(paintSign(options));

      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 16;
      texture.needsUpdate = true;
      material.map = texture;
      material.emissiveMap = texture;
      this.textures.push(texture);
    } else {
      material.color.setHex(options.background);
    }

    this.materials.set(key, material);

    return material;
  }

  getColor(color: number, roughness = 0.7, metalness = 0.1): THREE.MeshStandardMaterial {
    const key = `${color}:${roughness}:${metalness}`;
    const cached = this.materials.get(key);

    if (cached) {
      return cached;
    }

    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    this.materials.set(key, material);

    return material;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const material of this.materials.values()) {
      material.dispose();
    }

    for (const material of this.colorMaterials.values()) {
      material.dispose();
    }

    for (const texture of this.textures) {
      texture.dispose();
    }

    this.materials.clear();
    this.colorMaterials.clear();
    this.textures.length = 0;
  }
}
