import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import type { Disposable } from "../core/Disposable";

const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uExposure: { value: 1.08 },
    uContrast: { value: 0.22 },
    uSaturation: { value: 1.3 },
    uShadowTint: { value: new THREE.Color(0.9, 0.97, 1.08) },
    uHighlightTint: { value: new THREE.Color(1.04, 1.0, 0.94) },
    uVignette: { value: 0.36 },
    uGrain: { value: 0.02 },
    uChromaticAberration: { value: 0.6 },
    uSpeed: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;

    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uExposure;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uChromaticAberration;
    uniform float uSpeed;

    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    vec3 acesFilm(vec3 color) {
      const mat3 inputMatrix = mat3(
        vec3(0.59719, 0.07600, 0.02840),
        vec3(0.35458, 0.90834, 0.13383),
        vec3(0.04823, 0.01566, 0.83777)
      );
      const mat3 outputMatrix = mat3(
        vec3(1.60475, -0.10208, -0.00327),
        vec3(-0.53108, 1.10813, -0.07276),
        vec3(-0.07367, -0.00605, 1.07602)
      );

      color = inputMatrix * color;
      vec3 a = color * (color + 0.0245786) - 0.000090537;
      vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
      color = a / b;

      return clamp(outputMatrix * color, 0.0, 1.0);
    }

    vec3 linearToSrgb(vec3 color) {
      return mix(
        color * 12.92,
        1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
        step(vec3(0.0031308), color)
      );
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float radial = dot(centered, centered);
      vec2 aberration = centered * radial * uChromaticAberration * 0.006;

      vec3 color;
      color.r = texture2D(tDiffuse, vUv + aberration).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv - aberration).b;

      if (uSpeed > 0.01) {
        float blurStep = uSpeed * 0.014 * smoothstep(0.05, 0.5, length(centered));
        vec3 blurred = color;

        for (int index = 1; index <= 4; index += 1) {
          blurred += texture2D(tDiffuse, vUv + centered * blurStep * float(index)).rgb;
        }

        color = mix(color, blurred / 5.0, clamp(uSpeed * 0.42, 0.0, 0.35));
      }

      color *= uExposure;
      color = acesFilm(color);

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

      color = mix(vec3(luma), color, uSaturation);
      color *= mix(uShadowTint, vec3(1.0), smoothstep(0.0, 0.55, luma));
      color *= mix(vec3(1.0), uHighlightTint, smoothstep(0.45, 1.0, luma));

      color = clamp((color - 0.5) * (1.0 + uContrast) + 0.5, 0.0, 1.0);

      // Photographic highlight shoulder: let sunlit whites clip like the
      // reference footage instead of compressing into grey.
      float highlightLuma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float clip = smoothstep(0.62, 0.9, highlightLuma);
      color = mix(color, vec3(1.0), clip * 0.38);

      float vignette = smoothstep(0.95, 0.22, radial * 1.7);
      color *= mix(1.0, vignette, uVignette);

      vec3 srgb = linearToSrgb(color);
      float grain = hash(vUv * uResolution + vec2(uTime * 37.0, uTime * 17.0)) - 0.5;
      srgb += grain * uGrain;

      float dither = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(srgb + dither, 0.0, 1.0), 1.0);
    }
  `,
};

/**
 * HDR post-processing chain: render, bloom, and a filmic grade with
 * chromatic aberration, split toning, vignette, and grain.
 */
export class PostPipeline implements Disposable {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly gtaoPass: GTAOPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly gradePass: ShaderPass;
  private elapsedSeconds = 0;
  private disposed = false;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;

    const size = renderer.getSize(new THREE.Vector2());
    const renderTarget = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(size.x * renderer.getPixelRatio())),
      Math.max(1, Math.floor(size.y * renderer.getPixelRatio())),
      {
        type: THREE.HalfFloatType,
        samples: 4,
        colorSpace: THREE.LinearSRGBColorSpace,
        depthBuffer: true,
        stencilBuffer: false,
      },
    );

    this.composer = new EffectComposer(renderer, renderTarget);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.gtaoPass = new GTAOPass(
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      size.x * renderer.getPixelRatio(),
      size.y * renderer.getPixelRatio(),
    );
    this.gtaoPass.output = GTAOPass.OUTPUT.Default;
    this.gtaoPass.blendIntensity = 0.9;
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.2, 0.54, 1.05);
    this.gradePass = new ShaderPass(GRADE_SHADER);

    this.gradePass.renderToScreen = true;
    this.bloomPass.enabled = true;

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.gtaoPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.gradePass);

    this.setSize(size.x, size.y);
  }

  setQuality(quality: "low" | "medium" | "high"): void {
    this.gtaoPass.enabled = quality !== "low";
    this.bloomPass.enabled = quality !== "low";
  }

  setSize(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));

    this.composer.setSize(safeWidth, safeHeight);
    this.gradePass.uniforms.uResolution?.value.set(
      safeWidth * this.renderer.getPixelRatio(),
      safeHeight * this.renderer.getPixelRatio(),
    );
  }

  render(scene: THREE.Scene, camera: THREE.Camera, deltaSeconds: number, speedRatio = 0): void {
    if (this.disposed) {
      return;
    }

    this.elapsedSeconds += deltaSeconds;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.gtaoPass.scene = scene;
    this.gtaoPass.camera = camera;
    const timeUniform = this.gradePass.uniforms.uTime;
    const speedUniform = this.gradePass.uniforms.uSpeed;

    if (timeUniform) {
      timeUniform.value = this.elapsedSeconds;
    }

    if (speedUniform) {
      speedUniform.value = Math.max(0, Math.min(1, speedRatio));
    }
    this.composer.render(deltaSeconds);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.composer.dispose();
  }
}
