import * as THREE from "three";

import type { Disposable } from "../core/Disposable";
import { PostPipeline } from "./PostPipeline";

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
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions) {
    this.canvas = canvas;
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

  render(scene: THREE.Scene, camera: THREE.Camera, deltaSeconds = 1 / 60): void {
    if (this.disposed) {
      return;
    }

    if (this.post) {
      this.post.render(scene, camera, deltaSeconds);

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
