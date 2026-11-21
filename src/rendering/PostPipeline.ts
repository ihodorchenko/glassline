import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import type { Disposable } from "../core/Disposable";

/**
 * Base film-grain strength in display-sRGB units (the shader's `uGrain`
 * default). `setGrainScale` multiplies it, so scale 1 reproduces the exact
 * pre-W5 pixels and scale 0 removes grain entirely (W5 accessibility toggle).
 */
const BASE_GRAIN_STRENGTH = 0.002;

/**
 * Scene-linear exposure + white-balance pass, applied *before* bloom so the
 * bloom threshold is expressed in displayed white-point units (1.0 = reference
 * white). Only highlights above that point (emissive, sun/specular) bloom.
 */
const EXPOSURE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** Calibrated camera exposure (linear multiplier). */
    // P1: 1.65 -> 1.60 — the restored W1 sky radiance lifted the start-frame
    // luma to 0.656 (shifted band tops at 0.646); -3 % exposure brings it back
    // while keeping p95/near-white margins.
    uExposure: { value: 1.56 },
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
    // P2 note: 2.5 was measured and reverted — +4 % chroma lifted the frame
    // saturation only +0.007 while feeding the blue-dominant sky count +1.1 pp
    // and pushing split toward the band edge. 2.4 keeps the better trade.
    uSaturation: { value: 2.4 },
    /** Multiplier for the darkest tones (cool blue shadows). */
    // P1: shadow blue 1.10 -> 1.07 — the W2.2 grade measured split -29.6 vs
    // the reference mean -21.8 (below the shifted band); this trims the cast.
    uShadowTint: { value: new THREE.Vector3(0.95, 1.0, 1.07) },
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
    uGrain: { value: BASE_GRAIN_STRENGTH },
    /** Idle CA is off (reference is clean); sprint adds a little via uSpeed. */
    uChromaticAberration: { value: 0.0 },
    uSpeed: { value: 0 },
    /** Interior ambient term (W5 perf): global weight from the camera sky probe.
     *  No extra render pass: the whole interior term is this cheap modulation,
     *  so capture and perf always see the same one code path. */
    uInteriorWeight: { value: 0 },
    uInteriorAmbient: { value: 0.82 },
    uBounceColor: { value: new THREE.Color(0xd8dadc) },
    uBounceStrength: { value: 0.85 },
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
    uniform float uInteriorWeight;
    uniform float uInteriorAmbient;
    uniform vec3 uBounceColor;
    uniform float uBounceStrength;

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

      // Interior ambient term (W5 perf). The camera sky-visibility probe in
      // RenderScene publishes a 0..1 interior weight; open roofs publish 0 and
      // this branch is skipped, so their frames stay byte-identical. In covered
      // views the ambient contribution is attenuated globally and pushed toward
      // the neutral-cool bounce — no extra render pass, no AO buffer, so the
      // capture and perf paths see exactly the same state.
      // 0.01 matches the renderer's hysteresis: a tiny residual probe weight
      // (finish-roof has ~0.004 from the gate structure) must not perturb the frame.
      if (uInteriorWeight > 0.01) {
        // Dim mainly the sky-lit part of the interior: the low end (which sets
        // p25) keeps its bounce, the bright walls/exit lose the unoccluded sky
        // contribution. Weight = interior x smoothstep over surface luma.
        float surfaceLuma = gradeLuma(color);
        float dimWeight = uInteriorWeight * smoothstep(0.25, 0.65, surfaceLuma)
          * (1.0 - smoothstep(0.85, 0.98, surfaceLuma));
        color *= mix(1.0, uInteriorAmbient, dimWeight);

        float interiorLuma = gradeLuma(color);
        float bounceLuma = max(gradeLuma(uBounceColor), 1.0e-4);
        vec3 neutralBounce = uBounceColor * (interiorLuma / bounceLuma);
        color = mix(color, neutralBounce, uInteriorWeight * uBounceStrength);
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
  private readonly exposurePass: ShaderPass;
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
    // Contact shadow only: full-strength GTAO reads as dirt on near-white decks.
    this.gtaoPass.blendIntensity = 0.7;
    this.gtaoPass.updateGtaoMaterial({ radius: 0.4 });
    this.gtaoPass.updatePdMaterial({ radius: 0.4 });

    // Emissive-only bloom (AD-3). The threshold is deliberately NOT 1.0: it is
    // expressed in *exposed* scene-linear units, so a sunlit diffuse white sits
    // at ~2.4-3.4 there; a 1.0 threshold would bloom every white wall. 4.0 sits
    // above the diffuse white point and only catches sun/specular/emissive HDR
    // sources ("sunlit whites must not bloom").
    // P1: strength 0.18 -> 0.22, radius 0.45 -> 0.50 — the reference has a
    // soft glare around the sun/specular glints; a slightly wider, fainter
    // halo softens the hard-edged highlight look without blooming whites.
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.5, 4.0);
    this.exposurePass = new ShaderPass(EXPOSURE_SHADER);
    this.gradePass = new ShaderPass(GRADE_SHADER);
    this.gradePass.renderToScreen = true;
    this.bloomPass.enabled = true;

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.gtaoPass);
    this.composer.addPass(this.exposurePass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.gradePass);

    this.setSize(size.x, size.y);
  }

  setQuality(quality: "low" | "medium" | "high"): void {
    this.gtaoPass.enabled = quality !== "low";
    this.bloomPass.enabled = quality !== "low";
  }

  /**
   * Scales the post-processing film grain only (W5 accessibility `reduce_grain`).
   *
   * The scale multiplies {@link BASE_GRAIN_STRENGTH}: `1` keeps the exact
   * pre-W5 shader value (default, byte-identical frames), `0` disables grain.
   * Values are clamped to [0, 1]; non-finite input falls back to `1`.
   * No other grade uniform is touched, so the default render path is unchanged.
   */
  setGrainScale(scale: number): void {
    const normalized = Number.isFinite(scale) ? Math.min(1, Math.max(0, scale)) : 1;
    const grainUniform = this.gradePass.uniforms.uGrain;

    if (grainUniform) {
      grainUniform.value = BASE_GRAIN_STRENGTH * normalized;
    }
  }

  /** Current film-grain scale (1 = authored strength, 0 = grain disabled). */
  get grainScale(): number {
    const grainUniform = this.gradePass.uniforms.uGrain;
    const strength = typeof grainUniform?.value === "number" ? grainUniform.value : 0;

    return strength / BASE_GRAIN_STRENGTH;
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
    const interiorWeight = Math.min(
      1,
      Math.max(0, Number(scene.userData.ambientInteriorWeight ?? 0)),
    );
    const weightUniform = this.gradePass.uniforms.uInteriorWeight;
    if (weightUniform) {
      weightUniform.value = interiorWeight;
    }
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
