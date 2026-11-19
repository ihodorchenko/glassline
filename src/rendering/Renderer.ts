import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import { PostPipeline } from "./PostPipeline";

export type DisplayQuality = "low" | "medium" | "high";

export interface RendererOptions {
  readonly antialias: boolean;
  readonly maxPixelRatio: number;
  readonly shadowsEnabled: boolean;
  readonly postProcessing?: boolean;
}

/**
 * Owns the Three.js rendering backend and the canvas lifecycle.
 * Visual world composition lives in `RenderScene`; this class owns the HDR
 * post-processing chain and the final presentation.
 */
export class Renderer implements Disposable {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly post: PostPipeline | null;
  private readonly baseMaxPixelRatio: number;
  private readonly shadowsEnabled: boolean;
  private quality: DisplayQuality = "high";
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions) {
    this.canvas = canvas;
    this.baseMaxPixelRatio = options.maxPixelRatio;
    this.shadowsEnabled = options.shadowsEnabled;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: options.antialias,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
    });

    const pixelRatio = Math.min(window.devicePixelRatio || 1, options.maxPixelRatio);

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = options.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // All shadow casters are static (level props/billboards); birds and the
    // viewmodel do not cast. Refresh explicitly on level/quality changes.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.info.autoReset = true;

    this.post = options.postProcessing === false ? null : this.createPostPipeline();

    this.resize(window.innerWidth, window.innerHeight);
  }

  get domElement(): HTMLCanvasElement {
    return this.canvas;
  }

  get backendDescription(): string {
    return `WebGL2 · Three.js r${THREE.REVISION} · HDR ${this.post ? "post" : "direct"}`;
  }

  /** Underlying Three.js renderer for systems that need GPU resources. */
  get threeRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /** Applies the display-quality setting to shadows, post effects and DPR. */
  setQuality(quality: DisplayQuality): void {
    this.quality = quality;

    const pixelRatioCap =
      quality === "low" ? 1 : quality === "medium" ? 1.5 : this.baseMaxPixelRatio;

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, this.baseMaxPixelRatio, pixelRatioCap),
    );
    this.renderer.shadowMap.enabled = this.shadowsEnabled && quality !== "low";
    this.post?.setQuality(quality);
    this.refreshShadows();
    this.resize(window.innerWidth, window.innerHeight);
  }

  get currentQuality(): DisplayQuality {
    return this.quality;
  }

  /** Re-renders the static shadow map after a level/quality change. */
  refreshShadows(): void {
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  /** Resizes the drawing buffer. CSS keeps the canvas at the full viewport size. */
  resize(width: number, height: number): void {
    if (this.disposed) {
      return;
    }

    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));

    this.renderer.setSize(safeWidth, safeHeight, false);
    this.post?.setSize(safeWidth, safeHeight);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, deltaSeconds = 1 / 60, speedRatio = 0): void {
    if (this.disposed) {
      return;
    }

    if (this.post) {
      this.post.render(scene, camera, deltaSeconds, speedRatio);

      return;
    }

    this.renderer.render(scene, camera);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.post?.dispose();
    this.renderer.dispose();
  }

  private createPostPipeline(): PostPipeline | null {
    try {
      return new PostPipeline(this.renderer);
    } catch (error) {
      console.warn("[Glassline] HDR post-processing unavailable; using direct rendering.", error);

      return null;
    }
  }
}
