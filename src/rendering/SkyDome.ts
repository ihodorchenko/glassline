import * as THREE from "three";

import type { Disposable } from "../core/Disposable";

export interface SkyPalette {
  readonly zenithColor: THREE.Color;
  readonly horizonColor: THREE.Color;
  readonly groundColor: THREE.Color;
  readonly cloudColor: THREE.Color;
  readonly cloudShadowColor: THREE.Color;
}

export interface SkyState {
  readonly zenithColor: number;
  /** Mid-sky stop (owned by the level environment: `skyColor`). */
  readonly midColor: number;
  readonly horizonColor: number;
  readonly groundColor: number;
  readonly cloudColor: number;
  readonly cloudShadowColor: number;
  readonly cloudCover: number;
  readonly sunColor: number;
  readonly sunDirection: THREE.Vector3;
  readonly sunIntensity: number;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vSkyPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vSkyPosition = worldPosition.xyz - cameraPosition;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vSkyPosition;

  uniform vec3 uZenithColor;
  uniform vec3 uMidColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uGroundColor;
  uniform vec3 uCloudColor;
  uniform vec3 uCloudShadowColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform float uSunIntensity;
  uniform float uCloudCover;
  uniform float uTime;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int octave = 0; octave < 5; octave += 1) {
      value += amplitude * valueNoise(p);
      p = p * 2.03 + vec2(17.3, 9.7);
      amplitude *= 0.5;
    }

    return value;
  }

  float skyLuma(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    vec3 direction = normalize(vSkyPosition);
    float height = clamp(direction.y, -1.0, 1.0);
    float h = clamp(height, 0.0, 1.0);

    // Three-stop clear-sky gradient: hazy horizon -> mid sky -> cobalt zenith.
    // The mid stop is the level-owned environment sky colour, so the palette
    // stays data-driven; only the stop placement is a rendering constant.
    // Pull the mid stop toward the zenith so the 10-30 degree band reads as
    // saturated cyan-blue instead of washing out at the horizon value.
    vec3 midBand = mix(uMidColor, uZenithColor, 0.35);
    float lowerStops = smoothstep(0.0, 0.26, h);
    float upperStops = smoothstep(0.22, 0.90, h);
    vec3 sky = mix(uHorizonColor, midBand, lowerStops);
    sky = mix(sky, uZenithColor, upperStops);

    // Horizon haze band: the distant canyon dissolves into pale sky, which is
    // what gives the reference its depth cue above the skyline.
    float haze = clamp(exp(-h * 20.0) * 0.8, 0.0, 0.72);
    sky = mix(sky, uHorizonColor, haze);

    sky = mix(sky, uGroundColor, smoothstep(0.0, -0.22, height));

    // Atmospheric chroma/radiance shaping. The grade applies display-space
    // saturation, so the sky dome has to stay slightly desaturated and its
    // zenith a little brighter; with these two terms the rendered zenith lands
    // on the sampled reference #2050D8 and the mid band on #68A8C8 (verified by
    // sampling the captured frames, see W1 look report).
    float skyChroma = mix(0.32, 0.22, smoothstep(0.40, 0.95, h));
    float skyRadiance = mix(1.05, 0.88, smoothstep(0.30, 0.90, h));
    sky = mix(vec3(skyLuma(sky)), sky, skyChroma) * skyRadiance;

    float sunAlignment = max(dot(direction, normalize(uSunDirection)), 0.0);
    float sunDisc = smoothstep(0.99980, 0.99995, sunAlignment);
    float sunGlow = pow(sunAlignment, 700.0) * 0.30 + pow(sunAlignment, 24.0) * 0.05;
    float sunHaze = pow(sunAlignment, 6.0) * 0.010;

    // Sun brightness follows the level key (uSunIntensity is the environment
    // value), so the disc/glow cannot drift away from the directional key.
    sky += uSunColor * (sunDisc * 1.15 + sunGlow + sunHaze) * uSunIntensity;

    if (direction.y > -0.04) {
      // Perspective projection with a wide denominator so low-elevation clouds
      // keep cumulus-sized shapes instead of smearing into horizontal streaks.
      vec2 cloudUv = direction.xz / (max(direction.y, 0.08) + 0.26) * 0.95;
      cloudUv += vec2(uTime * 0.0018, uTime * 0.0007);

      float base = fbm(cloudUv * 1.05);
      float billow = fbm(cloudUv * 2.2 + vec2(4.1, 1.3));
      float erosion = fbm(cloudUv * 4.6 + vec2(11.7, 6.3));
      float density = base * 0.62 + billow * 0.28 + erosion * 0.10;

      // env.cloudCover 0 = few wisps, 1 = heavy cumulus deck.
      float coverage = 0.60 - uCloudCover * 0.26;
      float cloud = smoothstep(coverage, coverage + 0.05, density);
      // Crisp cumulus fringe instead of a hazy veil.
      cloud *= smoothstep(0.26, 0.50, billow + erosion * 0.20);
      cloud *= smoothstep(0.005, 0.10, direction.y);
      cloud *= 1.0 - smoothstep(0.90, 0.999, height) * 0.35;

      // Sun-facing tops are lit, the undersides keep the cool reference base.
      float lit = fbm((cloudUv + normalize(uSunDirection).xz * 0.15) * 1.4);
      float underside = fbm(cloudUv * 1.8 + vec2(2.6, 9.1));
      float topLight = smoothstep(0.30, 0.72, lit) * 0.85 + 0.15;
      vec3 cloudLit = uCloudColor * (1.25 + 1.15 * topLight);
      vec3 cloudBase = uCloudShadowColor * (0.55 + underside * 0.30);
      vec3 cloudColor = mix(cloudBase, cloudLit, topLight);
      // Silver lining only within ~20 degrees of the sun.
      cloudColor += uSunColor * pow(sunAlignment, 10.0) * 0.05 * uSunIntensity;

      sky = mix(sky, cloudColor, clamp(cloud, 0.0, 1.0) * 0.97);
    }

    float dither = (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
    gl_FragColor = vec4(max(sky + dither, vec3(0.0)), 1.0);
  }
`;

/**
 * Procedural daylight sky: three-stop gradient (hazy horizon, mid sky, cobalt
 * zenith), sun disc/glow driven by the level sun key, and drifting cumulus with
 * bright lit tops and cool bases. Runs before tone mapping, so colour values
 * are HDR and can feed bloom.
 */
export class SkyDome implements Disposable {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  private readonly material: THREE.ShaderMaterial;
  private readonly zenithColor: THREE.Color;
  private readonly midColor: THREE.Color;
  private readonly horizonColor: THREE.Color;
  private readonly groundColor: THREE.Color;
  private readonly cloudColor: THREE.Color;
  private readonly cloudShadowColor: THREE.Color;
  private readonly sunColor: THREE.Color;
  private readonly sunDirection: THREE.Vector3;
  private readonly sunIntensity: THREE.IUniform<number>;
  private readonly cloudCover: THREE.IUniform<number>;
  private readonly skyTime: THREE.IUniform<number>;
  private elapsedSeconds = 0;
  private disposed = false;

  constructor(state: SkyState) {
    const geometry = new THREE.SphereGeometry(460, 48, 24);
    this.zenithColor = new THREE.Color(state.zenithColor);
    this.midColor = new THREE.Color(state.midColor);
    this.horizonColor = new THREE.Color(state.horizonColor);
    this.groundColor = new THREE.Color(state.groundColor);
    this.cloudColor = new THREE.Color(state.cloudColor);
    this.cloudShadowColor = new THREE.Color(state.cloudShadowColor);
    this.sunColor = new THREE.Color(state.sunColor);
    this.sunDirection = state.sunDirection.clone();
    this.sunIntensity = { value: state.sunIntensity };
    this.cloudCover = { value: state.cloudCover };
    this.skyTime = { value: 0 };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uZenithColor: { value: this.zenithColor },
        uMidColor: { value: this.midColor },
        uHorizonColor: { value: this.horizonColor },
        uGroundColor: { value: this.groundColor },
        uCloudColor: { value: this.cloudColor },
        uCloudShadowColor: { value: this.cloudShadowColor },
        uSunColor: { value: this.sunColor },
        uSunDirection: { value: this.sunDirection },
        uSunIntensity: this.sunIntensity,
        uCloudCover: this.cloudCover,
        uTime: this.skyTime,
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    });

    this.material = material;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = "sky-dome";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  setState(state: SkyState): void {
    this.zenithColor.setHex(state.zenithColor);
    this.midColor.setHex(state.midColor);
    this.horizonColor.setHex(state.horizonColor);
    this.groundColor.setHex(state.groundColor);
    this.cloudColor.setHex(state.cloudColor);
    this.cloudShadowColor.setHex(state.cloudShadowColor);
    this.sunColor.setHex(state.sunColor);
    this.sunDirection.copy(state.sunDirection);
    this.sunIntensity.value = state.sunIntensity;
    this.cloudCover.value = state.cloudCover;
  }

  update(deltaSeconds: number): void {
    if (this.disposed) {
      return;
    }

    this.elapsedSeconds += deltaSeconds;
    this.skyTime.value = this.elapsedSeconds;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
