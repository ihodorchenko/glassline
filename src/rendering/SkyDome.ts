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

  void main() {
    vec3 direction = normalize(vSkyPosition);
    float height = clamp(direction.y, -1.0, 1.0);

    vec3 sky = mix(uHorizonColor, uZenithColor, pow(clamp(height, 0.0, 1.0), 0.55));
    sky = mix(uHorizonColor, sky, smoothstep(0.0, 0.18, height));
    sky = mix(sky, uGroundColor, smoothstep(0.0, -0.24, height));

    float sunAlignment = max(dot(direction, normalize(uSunDirection)), 0.0);
    float sunDisc = smoothstep(0.99935, 0.99972, sunAlignment);
    float sunGlow = pow(sunAlignment, 900.0) * 1.6 + pow(sunAlignment, 28.0) * 0.28;
    float sunHaze = pow(sunAlignment, 5.0) * 0.12;

    sky += uSunColor * (sunDisc * 18.0 + sunGlow + sunHaze) * uSunIntensity;

    if (direction.y > -0.04) {
      vec2 cloudUv = direction.xz / (max(direction.y, 0.06) + 0.2) * 1.35;
      cloudUv += vec2(uTime * 0.0022, uTime * 0.0009);

      float base = fbm(cloudUv * 1.35);
      float billow = fbm(cloudUv * 2.9 + vec2(7.1, 3.7));
      float erosion = fbm(cloudUv * 6.2 + vec2(13.7, 5.3));
      float density = base * 0.58 + billow * 0.3 + erosion * 0.12;
      float coverage = 0.67 - uCloudCover * 0.34;
      float cloud = smoothstep(coverage, coverage + 0.11, density);

      // Erode the soft fringe so cumulus edges stay crisp instead of hazy.
      cloud *= smoothstep(0.28, 0.52, billow + erosion * 0.18);
      cloud *= smoothstep(-0.02, 0.14, direction.y);
      cloud *= 1.0 - smoothstep(0.9, 0.995, height) * 0.4;

      float lit = fbm((cloudUv + normalize(uSunDirection).xz * 0.2) * 1.7);
      float underside = fbm(cloudUv * 2.1 + vec2(2.6, 9.1));
      vec3 cloudColor = mix(
        uCloudShadowColor * (0.88 + underside * 0.2),
        uCloudColor,
        clamp(lit * 1.45 + 0.18, 0.0, 1.0)
      );
      cloudColor += uSunColor * pow(sunAlignment, 10.0) * 0.55;

      sky = mix(sky, cloudColor, clamp(cloud, 0.0, 1.0) * 0.96);
    }

    float dither = (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
    gl_FragColor = vec4(max(sky + dither, vec3(0.0)), 1.0);
  }
`;

/**
 * Procedural daylight sky: gradient, sun disc and glow, and drifting cumulus
 * layers. Runs before tone mapping, so colour values are HDR and feed bloom.
 */
export class SkyDome implements Disposable {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  private readonly material: THREE.ShaderMaterial;
  private readonly zenithColor: THREE.Color;
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
