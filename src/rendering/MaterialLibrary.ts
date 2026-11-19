import * as THREE from "three";

import type { Disposable } from "../core/Disposable";

export type MaterialKey =
  | "white"
  | "concrete"
  | "roof"
  | "facade"
  | "glass"
  | "glass-far"
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
    color: 0xf4f1e9,
    roughness: 0.74,
    metalness: 0.02,
    uvScale: 0.24,
    texture: "plaster",
  },
  concrete: {
    color: 0xe1ded5,
    roughness: 0.84,
    metalness: 0.02,
    uvScale: 0.2,
    texture: "concrete",
  },
  roof: {
    color: 0xf3f0e7,
    roughness: 0.9,
    metalness: 0.03,
    uvScale: 0.13,
    texture: "roof",
  },
  facade: {
    color: 0xe8e5dd,
    roughness: 0.68,
    metalness: 0.05,
    uvScale: 0.16,
    texture: "facade",
  },
  glass: {
    color: 0x6b879b,
    roughness: 0.14,
    metalness: 0.72,
    uvScale: 0.4,
    envMapIntensity: 1.35,
  },
  "glass-far": {
    color: 0x7f9aab,
    roughness: 0.24,
    metalness: 0.5,
    uvScale: 0.4,
    envMapIntensity: 0.95,
  },
  metal: {
    color: 0xb4b8ba,
    roughness: 0.45,
    metalness: 0.58,
    uvScale: 0.34,
    texture: "metal",
    envMapIntensity: 1.05,
  },
  "dark-metal": {
    color: 0x5b6268,
    roughness: 0.55,
    metalness: 0.42,
    uvScale: 0.3,
    texture: "metal",
  },
  red: {
    color: 0xc0262d,
    roughness: 0.48,
    metalness: 0.08,
    uvScale: 0.3,
    texture: "red",
  },
  orange: {
    color: 0xdd5d1b,
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
    color: 0x4f6b45,
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
  plaster: 0.16,
  concrete: 0.34,
  roof: 0.26,
  facade: 0.17,
  metal: 0.1,
  asphalt: 0.36,
  red: 0.08,
  stain: 0,
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
      fillBase(context, "#e9e6de");
      addMottle(context, random, 90, 0.05, "#ffffff", "#b9b5aa", 64);
      addCracks(context, random, 9, "#8f8a80", 0.16);
      addSpeckle(context, random, 2400, ["#ffffff", "#c9c5bb", "#a8a49a"], 1.2);
      break;
    }
    case "concrete": {
      fillBase(context, "#d7d4cb");
      addMottle(context, random, 110, 0.07, "#f4f1e9", "#a8a49a", 80);
      addCracks(context, random, 16, "#77736a", 0.2);
      addSpeckle(context, random, 4200, ["#f6f2ea", "#b7b3a8", "#8d897f"], 1.4);
      break;
    }
    case "roof": {
      fillBase(context, "#ddd9cf");
      addMottle(context, random, 110, 0.09, "#fdfaf2", "#a8a49a", 120);
      addSpeckle(context, random, 7000, ["#fbf7ee", "#bdb8ad", "#8b877e"], 1.4);

      for (let y = 0; y < TEXTURE_SIZE; y += 96) {
        for (let x = 0; x < TEXTURE_SIZE; x += 96) {
          context.fillStyle = random() > 0.5 ? "#f2eee5" : "#cac6bc";
          context.globalAlpha = 0.012 + random() * 0.028;
          context.fillRect(x + 1, y + 1, 94, 94);
        }
      }

      context.globalAlpha = 1;
      drawSeams(context, 96, "#f8f4ea", 1, 0.22, 1.4);
      drawSeams(context, 96, "#7d7970", 1.4, 0.52);
      addCracks(context, random, 10, "#6f6b62", 0.14);

      for (let index = 0; index < 36; index += 1) {
        const x = random() * TEXTURE_SIZE;
        const y = random() * TEXTURE_SIZE;
        const radius = 8 + random() * 34;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

        gradient.addColorStop(0, `rgba(92, 88, 79, ${0.04 + random() * 0.08})`);
        gradient.addColorStop(1, "rgba(92, 88, 79, 0)");
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      break;
    }
    case "facade": {
      fillBase(context, "#dedbd3");
      addMottle(context, random, 60, 0.04, "#ffffff", "#aaa69c", 90);
      drawSeams(context, 170, "#96928a", 2, 0.32);
      drawSeams(context, 85, "#b9b5aa", 1, 0.14);
      addCracks(context, random, 7, "#8f8b82", 0.12);

      for (let index = 0; index < 26; index += 1) {
        const x = random() * TEXTURE_SIZE;
        const y = random() * TEXTURE_SIZE;
        const length = 30 + random() * 120;

        context.globalAlpha = 0.03 + random() * 0.05;
        context.fillStyle = "#6f6b62";
        context.fillRect(x, y, 1 + random() * 2, length);
      }

      context.globalAlpha = 1;
      addSpeckle(context, random, 2200, ["#ffffff", "#c6c2b8", "#9c988e"], 1);
      break;
    }
    case "metal": {
      fillBase(context, "#a9adaf");
      for (let index = 0; index < 2600; index += 1) {
        context.strokeStyle = random() > 0.5 ? "#c7cbcd" : "#85898b";
        context.globalAlpha = 0.08 + random() * 0.16;
        context.lineWidth = 0.6 + random();
        const x = random() * TEXTURE_SIZE;
        const length = 12 + random() * 90;
        context.beginPath();
        context.moveTo(x, random() * TEXTURE_SIZE);
        context.lineTo(x, random() * TEXTURE_SIZE + length);
        context.stroke();
      }
      context.globalAlpha = 1;
      addRust(context, random, 52);
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
      fillBase(context, "#c2262c");
      addMottle(context, random, 40, 0.08, "#e4555a", "#7d151a", 70);
      addSpeckle(context, random, 1800, ["#e0555a", "#8e171c"], 1.2);
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

  vec4 sampleTriplanarAt(sampler2D source, vec3 scaled, vec3 weights) {
    return texture2D(source, scaled.zy) * weights.x
      + texture2D(source, scaled.xz) * weights.y
      + texture2D(source, scaled.xy) * weights.z;
  }

  vec4 sampleTriplanar(sampler2D source, vec3 position, vec3 weights) {
    vec3 scaled = position * uTriplanarScale;
    vec4 base = sampleTriplanarAt(source, scaled, weights);
    float height = dot(base.rgb, vec3(0.299, 0.587, 0.114)) - 0.5;
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
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTriplanarScale = { value: scale };
    shader.uniforms.uBumpScale = { value: bumpScale };
    shader.uniforms.uDetailScale = { value: 3.3 };
    shader.uniforms.uDetailMix = { value: 0.16 };
    shader.uniforms.uParallaxDepth = { value: 0.06 };

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
          diffuseColor *= triplanarTexel;
          #ifdef USE_ROUGHNESSMAP
          #else
          float triplanarLuma = dot(triplanarTexel.rgb, vec3(0.299, 0.587, 0.114));
          #endif
        #endif`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        #if defined( USE_MAP ) && ! defined( USE_ROUGHNESSMAP )
          roughnessFactor *= mix(0.84, 1.12, triplanarLuma);
        #endif`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        #if defined( USE_MAP ) && defined( USE_BUMPMAP )
          // Triplanar bump: derive a world-space gradient from the same
          // procedural map, then convert the perturbed normal back to view
          // space for Three's lighting stage.
          vec3 bumpWeights = pow(abs(normalize(vTriplanarNormal)), vec3(4.0));
          bumpWeights /= (bumpWeights.x + bumpWeights.y + bumpWeights.z);
          float bumpHeight = dot(
            sampleTriplanar(map, vTriplanarPosition, bumpWeights).rgb,
            vec3(0.299, 0.587, 0.114)
          );
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
    });

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
      applyTriplanar(material, spec.uvScale, TEXTURE_BUMP_SCALE[spec.texture]);
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
      roughness: 0.62,
      metalness: 0.03,
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
