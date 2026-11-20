import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import type { Disposable } from "../core/Disposable";

/**
 * Scene-linear exposure + white-balance pass, applied *before* bloom so the
 * bloom threshold is expressed in displayed white-point units (1.0 = reference
 * white). Only highlights above that point (emissive, sun/specular) bloom.
 */
const EXPOSURE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** Calibrated camera exposure (linear multiplier). */
    uExposure: { value: 1.65 },
    /** Camera white balance in linear space; neutral = vec3(1). */
    uWhiteBalance: { value: new THREE.Vector3(1.004, 1.008, 1.02) },
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
    uniform float uExposure;
    uniform vec3 uWhiteBalance;

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      color *= uWhiteBalance * uExposure;
      gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
    }
  `,
};

/**
 * Filmic grade: ACES shoulder, display-space contrast/split-tone/saturation,
 * and minimal lens character. Deliberately contains **no** highlight clip and
 * no "mix toward white" term: the old W0 grade pushed a broad range of scene
 * luminance to flat white and was removed in W1 (plan §1 anti-rule).
 *
 * The highlight path is monotone end to end: the ACES fit is left unclamped and
 * `softShoulder` compresses everything above `uHighlightKnee` into
 * [knee, knee + range) with an exponential (strictly increasing) rolloff, so no
 * output pixel can share a flat 1.0 plateau over a range of input luminance.
 */
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    /** Monotone S-curve amplitude (0 = off; 0.5–0.9 for the reference look). */
    uContrast: { value: 0.68 },
    /** Chroma multiplier applied around display luma. */
    uSaturation: { value: 2.4 },
    /** Multiplier for the darkest tones (cool blue shadows). */
    uShadowTint: { value: new THREE.Vector3(0.94, 1.0, 1.1) },
    /** Multiplier for the brightest tones (neutral: no warm "paper" cast). */
    uHighlightTint: { value: new THREE.Vector3(0.99, 1.0, 1.02) },
    /** Luma where the split tone is 50/50 and the transition half-width. */
    uSplitPivot: { value: 0.3 },
    uSplitWidth: { value: 0.22 },
    /** Display-linear black-point lift: keeps DS in band without crushed blacks. */
    uBlackLift: { value: 0.02 },
    /** Highlight shoulder: identity to the knee, exponential approach to
     *  knee + range (0.985) so nothing ever reaches a flat 1.0 plateau. */
    uHighlightKnee: { value: 0.92 },
    uHighlightRange: { value: 0.06 },
    uVignette: { value: 0.03 },
    uGrain: { value: 0.002 },
    /** Idle CA is off (reference is clean); sprint adds a little via uSpeed. */
    uChromaticAberration: { value: 0.0 },
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
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uSplitPivot;
    uniform float uSplitWidth;
    uniform float uBlackLift;
    uniform float uHighlightKnee;
    uniform float uHighlightRange;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uChromaticAberration;
    uniform float uSpeed;

    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float gradeLuma(vec3 color) {
      return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }

    // ACES RRT+ODT fit (Stephen Hill). Intentionally NOT clamped: the monotone
    // shoulder below owns the highlight rolloff, so the curve stays strictly
    // increasing over the whole scene-luminance range.
    vec3 acesToneMap(vec3 color) {
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

      return outputMatrix * (a / b);
    }

    // Strictly monotone soft shoulder: identity up to the knee, then an
    // exponential approach to 1.0. Slope at the knee is 1.0, so the highlight
    // rolloff is continuous and every input luminance keeps a distinct output.
    vec3 softShoulder(vec3 color, float knee, float range) {
      vec3 above = max(color - knee, 0.0);
      vec3 limited = knee + range * (1.0 - exp(-above / range));
      return mix(color, limited, step(knee, color));
    }

    // Display-linear black-point lift: raises the darkest tones without
    // touching the highlights, so crushed blacks cannot be traded for contrast.
    vec3 liftBlacks(vec3 color, float lift) {
      return lift + color * (1.0 - lift);
    }

    // Monotone, endpoint-preserving S-curve: derivative at 0/1 is 1 - amount/2,
    // so the curve adds mid-scale contrast without flattening whites or blacks.
    vec3 contrastCurve(vec3 color, float amount) {
      vec3 c = clamp(color, 0.0, 1.0);
      return c + amount * c * (1.0 - c) * (c - 0.5);
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
      vec2 aberration = centered * radial * (uChromaticAberration + uSpeed * 0.02) * 0.004;

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

        color = mix(color, blurred / 5.0, clamp(uSpeed * 0.35, 0.0, 0.3));
      }

      // Display-linear filmic tone curve. Exposure/white balance are applied in
      // the pass before bloom, so this is the only tone mapping in the chain.
      color = acesToneMap(color);
      color = liftBlacks(max(color, 0.0), uBlackLift);
      // First monotone shoulder keeps the tonemapped values inside [0, 1) so the
      // display-space operations below can never hard-clamp a highlight; the
      // clamp inside contrastCurve is therefore inert.
      color = softShoulder(color, uHighlightKnee, uHighlightRange);
      color = contrastCurve(color, uContrast);

      float luma = gradeLuma(color);
      float split = smoothstep(uSplitPivot - uSplitWidth, uSplitPivot + uSplitWidth, luma);
      color *= mix(uShadowTint, uHighlightTint, split);

      float gradedLuma = gradeLuma(color);
      color = mix(vec3(gradedLuma), color, uSaturation);

      // Final monotone shoulder catches split-tone / saturation overshoot.
      color = softShoulder(max(color, 0.0), uHighlightKnee, uHighlightRange);

      float vignette = smoothstep(0.95, 0.22, radial * 1.7);
      color *= mix(1.0, vignette, uVignette);

      vec3 srgb = linearToSrgb(max(color, vec3(0.0)));
      float grain = hash(vUv * uResolution + vec2(uTime * 37.0, uTime * 17.0)) - 0.5;
      srgb += grain * uGrain;

      float dither = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(srgb + dither, 0.0, 1.0), 1.0);
    }
  `,
};

/**
 * Per-pixel ambient occlusion term (W1.1 fix round, items 1+2).
 *
 * A small AO-only GTAO pass (large radius/thickness, `OUTPUT.Off`, quarter
 * resolution, only enabled while the camera probe reports a covered view) gives
 * the ambient term per-pixel structure: dark interior pockets get much darker
 * while the bright exit slit (AO ~1) keeps its highlight. On open roofs the
 * renderer publishes `ambientInteriorWeight = 0`, this pass is disabled and the
 * frame is bit-for-bit untouched.
 *
 * Lighting intent: ambient/IBL *= mix(1.0, AO, 0.75) in covered regions, and
 * the ambient colour is pulled toward neutral-cool #c8d4dc where AO is low.
 */
const AMBIENT_AO_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tAO: { value: null as THREE.Texture | null },
    /** 0 = open / no effect, 1 = fully covered (set from scene.userData). */
    uInteriorWeight: { value: 0 },
    uAOStrength: { value: 0.85 },
    /** AO exponent: measured large-radius AO is ~0.78 indoors, ~0.95+ outside. */
    uAOPower: { value: 3.2 },
    uAOOpen: { value: 0.9 },
    uAOCovered: { value: 0.72 },
    uBounceColor: { value: new THREE.Color(0xd4d8dc) },
    uBounceStrength: { value: 0.55 },
    /** Tap spacing (UV) for the 3x3 low-pass; set from the AO target size. */
    uAOKernel: { value: new THREE.Vector2(1 / 400, 1 / 225) },
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
    uniform sampler2D tAO;
    uniform float uInteriorWeight;
    uniform float uAOStrength;
    uniform float uAOPower;
    uniform float uAOOpen;
    uniform float uAOCovered;
    uniform vec3 uBounceColor;
    uniform float uBounceStrength;
    uniform vec2 uAOKernel;

    float ambientLuma(vec3 color) {
      return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }

    float smoothedAO(vec2 uv) {
      float ao = 0.0;

      for (int iy = -1; iy <= 1; iy += 1) {
        for (int ix = -1; ix <= 1; ix += 1) {
          ao += texture2D(tAO, uv + vec2(float(ix), float(iy)) * uAOKernel).r;
        }
      }

      return ao / 9.0;
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      if (uInteriorWeight > 0.001) {
        float ao = clamp(smoothedAO(vUv), 0.0, 1.0);
        // 1 in deep occlusion, 0 on open/highlight surfaces.
        float pixelInterior = 1.0 - smoothstep(uAOCovered, uAOOpen, ao);
        pixelInterior = pixelInterior * pixelInterior;

        float ambientFactor = pow(max(ao, 0.0), uAOPower);
        float ambientScale = mix(
          1.0,
          ambientFactor,
          uInteriorWeight * uAOStrength * pixelInterior
        );
        color *= ambientScale;

        // Neutral-cool bounce where the sky bounce tints white walls blue.
        float colourLuma = ambientLuma(color);
        float bounceLuma = max(ambientLuma(uBounceColor), 1.0e-4);
        vec3 neutralBounce = uBounceColor * (colourLuma / bounceLuma);
        color = mix(
          color,
          neutralBounce,
          uInteriorWeight * uBounceStrength * pixelInterior
        );
      }

      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

/**
 * HDR post-processing chain: render → contact AO → calibrated exposure/white
 * balance → emissive-only bloom → filmic grade (ACES shoulder, split tone,
 * saturation, minimal lens character).
 *
 * The grade is intentionally free of highlight clipping: see `GRADE_SHADER`.
 */
export class PostPipeline implements Disposable {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly gtaoPass: GTAOPass;
  private readonly ambientAoPass: GTAOPass;
  private readonly ambientAoCompositePass: ShaderPass;
  private readonly exposurePass: ShaderPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly gradePass: ShaderPass;
  private elapsedSeconds = 0;
  private currentQuality: "low" | "medium" | "high" = "high";
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
    // Contact shadow only: full-strength GTAO reads as dirt on near-white decks.
    this.gtaoPass.blendIntensity = 0.7;
    this.gtaoPass.updateGtaoMaterial({ radius: 0.4 });
    this.gtaoPass.updatePdMaterial({ radius: 0.4 });

    // Large-radius ambient AO term at quarter resolution: low frequency, and it
    // is toggled off entirely whenever the camera probe reports an open view.
    this.ambientAoPass = new GTAOPass(
      new THREE.Scene(),
      new THREE.PerspectiveCamera(),
      Math.max(1, Math.floor(size.x * renderer.getPixelRatio() * 0.25)),
      Math.max(1, Math.floor(size.y * renderer.getPixelRatio() * 0.25)),
    );
    this.ambientAoPass.output = GTAOPass.OUTPUT.Off;
    this.ambientAoPass.needsSwap = false;
    this.ambientAoPass.enabled = false;
    this.ambientAoPass.updateGtaoMaterial({ radius: 6.0, thickness: 6.0, distanceExponent: 1.0 });
    this.ambientAoPass.updatePdMaterial({ radius: 8 });
    this.ambientAoCompositePass = new ShaderPass(AMBIENT_AO_SHADER);
    this.ambientAoCompositePass.enabled = false;
    const ambientAoUniform = this.ambientAoCompositePass.uniforms.tAO;
    if (ambientAoUniform) {
      ambientAoUniform.value = this.ambientAoPass.pdRenderTarget.texture;
    }
    // Emissive-only bloom (AD-3: strength 0.18, radius 0.45). The threshold is
    // deliberately NOT 1.0: it is expressed in *exposed* scene-linear units, so
    // a sunlit diffuse white sits at ~2.4-3.4 there; a 1.0 threshold would bloom
    // every white wall. 4.0 sits above the diffuse white point and only catches
    // sun/specular/emissive HDR sources ("sunlit whites must not bloom").
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.18, 0.45, 4.0);
    this.exposurePass = new ShaderPass(EXPOSURE_SHADER);
    this.gradePass = new ShaderPass(GRADE_SHADER);

    this.gradePass.renderToScreen = true;
    this.bloomPass.enabled = true;

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.gtaoPass);
    this.composer.addPass(this.ambientAoPass);
    this.composer.addPass(this.ambientAoCompositePass);
    this.composer.addPass(this.exposurePass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.gradePass);

    this.setSize(size.x, size.y);
  }

  setQuality(quality: "low" | "medium" | "high"): void {
    this.currentQuality = quality;
    this.gtaoPass.enabled = quality !== "low";
    this.bloomPass.enabled = quality !== "low";
  }

  setSize(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));

    this.composer.setSize(safeWidth, safeHeight);
    const pixelRatio = this.renderer.getPixelRatio();
    const ambientAoWidth = Math.max(1, Math.floor(safeWidth * pixelRatio * 0.25));
    const ambientAoHeight = Math.max(1, Math.floor(safeHeight * pixelRatio * 0.25));
    this.ambientAoPass.setSize(ambientAoWidth, ambientAoHeight);
    const aoKernelUniform = this.ambientAoCompositePass.uniforms.uAOKernel;
    if (aoKernelUniform) {
      aoKernelUniform.value.set(2 / ambientAoWidth, 2 / ambientAoHeight);
    }
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
    this.ambientAoPass.scene = scene;
    this.ambientAoPass.camera = camera;
    const interiorWeight = Math.min(
      1,
      Math.max(0, Number(scene.userData.ambientInteriorWeight ?? 0)),
    );
    const weightUniform = this.ambientAoCompositePass.uniforms.uInteriorWeight;
    if (weightUniform) {
      weightUniform.value = interiorWeight;
    }
    const ambientEnabled = interiorWeight > 0.01 && this.currentQuality !== "low";
    this.ambientAoPass.enabled = ambientEnabled;
    this.ambientAoCompositePass.enabled = ambientEnabled;
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
