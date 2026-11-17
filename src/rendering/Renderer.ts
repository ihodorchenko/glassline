import * as THREE from "three";

import type { Disposable } from "../core/Disposable";

export interface RendererOptions {
  readonly antialias: boolean;
  readonly maxPixelRatio: number;
  readonly shadowsEnabled: boolean;
}

/**
 * Owns the Three.js rendering backend and the canvas lifecycle.
 * Visual world composition lives in `RenderScene`.
 */
export class Renderer implements Disposable {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: options.antialias,
      powerPreference: "high-performance",
    });

    const pixelRatio = Math.min(window.devicePixelRatio || 1, options.maxPixelRatio);

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = options.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.resize(window.innerWidth, window.innerHeight);
  }

  get domElement(): HTMLCanvasElement {
    return this.canvas;
  }

  get backendDescription(): string {
    return `WebGL2 · Three.js r${THREE.REVISION}`;
  }

  /** Resizes the drawing buffer. CSS keeps the canvas at the full viewport size. */
  resize(width: number, height: number): void {
    if (this.disposed) {
      return;
    }

    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));

    this.renderer.setSize(safeWidth, safeHeight, false);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.disposed) {
      return;
    }

    this.renderer.render(scene, camera);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.renderer.dispose();
  }
}
