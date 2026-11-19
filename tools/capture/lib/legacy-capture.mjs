/**
 * Legacy one-off capture (`--out <file>`): drives the dev handle
 * (`window.__glassline`) exactly like the old raw-CDP script did.
 *
 * This path deliberately stays outside the deterministic capture contract: it
 * starts gameplay, teleports and aims the camera, then grabs one frame. Use the
 * capture mode (`?capture=1`) for reproducible evidence series.
 */

import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { navigate, withIsolatedPage } from "./browser-session.mjs";
import { ensureDir, pngSize, sha256 } from "./evidence.mjs";

const APP_READY_TIMEOUT_MS = 60_000;
const APP_READY_POLL_MS = 150;

async function waitForApp(page, timeoutMs) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const state = await page.evaluate(() => window.__glassline?.state ?? null).catch(() => null);

    if (state === "ready" || state === "running") {
      return state;
    }

    await delay(APP_READY_POLL_MS);
  }

  throw new Error(`Glassline did not initialize within ${timeoutMs} ms.`);
}

const LEGACY_STATS_EXPRESSION = () => {
  const app = window.__glassline;
  const scene = app.renderScene.scene;
  const renderer = app.renderer.threeRenderer;
  let instancedMeshes = 0;
  let instances = 0;
  let triangles = 0;

  scene.traverse((object) => {
    if (!object.isMesh) {
      return;
    }

    const geometry = object.geometry;
    const triangleCount =
      (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;

    if (object.isInstancedMesh) {
      instancedMeshes += 1;
      instances += object.count;
      triangles += triangleCount * object.count;
    } else {
      triangles += triangleCount;
    }
  });

  return {
    flow: app.flowManager.getState(),
    mode: app.currentMode,
    position: app.player ? app.player.getInterpolatedPosition(1) : null,
    quality: app.settingsManager?.getValue?.("graphics.quality") ?? null,
    instancedMeshes,
    instances,
    triangles: Math.round(triangles),
    textures: renderer.info.memory.textures,
    programs: renderer.info.programs?.length ?? null,
    canvas: [renderer.domElement.width, renderer.domElement.height],
  };
};

export async function runLegacyCapture({ browser, baseUrl, options, log }) {
  return withIsolatedPage(
    browser,
    { width: options.width, height: options.height },
    async ({ page, diagnostics }) => {
      await navigate(page, baseUrl, log);
      await waitForApp(page, APP_READY_TIMEOUT_MS);

      let flow = "main-menu";

      if (!options.menu) {
        flow = await page.evaluate(async (mode) => {
          const app = window.__glassline;

          if (app.flowManager.getState() !== "gameplay") {
            await app.startGameplay(mode);
          }

          return app.flowManager.getState();
        }, options.mode);

        if (flow !== "gameplay") {
          throw new Error(`Gameplay did not start (flow: ${flow}).`);
        }

        const hasPosition = Array.isArray(options.pos);
        const hasAim = options.yaw !== 0 || options.pitch !== 0;

        if (hasPosition) {
          await page.evaluate(
            ({ position, yaw, pitch }) => {
              const app = window.__glassline;
              app.player.teleportTo({ x: position[0], y: position[1], z: position[2] });
              app.cameraSystem.resetForRespawn(yaw);
              app.cameraSystem.pitch = pitch;
              return true;
            },
            { position: options.pos, yaw: options.yaw, pitch: options.pitch },
          );
        } else if (hasAim) {
          await page.evaluate(
            ({ yaw, pitch }) => {
              const app = window.__glassline;
              app.cameraSystem.resetForRespawn(yaw);
              app.cameraSystem.pitch = pitch;
              return true;
            },
            { yaw: options.yaw, pitch: options.pitch },
          );
        }
      } else if (options.settings) {
        await page.evaluate(() => window.__glassline.ui.showSettings("main-menu"));
      }

      if (options.run > 0) {
        await page.mouse.click(Math.floor(options.width / 2), Math.floor(options.height / 2));
        await delay(300);
        await page.keyboard.down("w");
        await page.keyboard.down("Shift");
        await delay(options.run);
      }

      await delay(options.wait);

      const buffer = await page.screenshot({
        type: "png",
        animations: "disabled",
        caret: "hide",
      });

      if (options.run > 0) {
        await page.keyboard.up("Shift");
        await page.keyboard.up("w");
      }

      const stats = await page.evaluate(LEGACY_STATS_EXPRESSION);
      const png = pngSize(buffer);
      const captured = diagnostics.snapshot();

      await ensureDir(dirname(options.out));
      await writeFile(options.out, buffer);

      log(
        `saved ${options.out} (${buffer.length} bytes, ${png ? `${png.width}x${png.height}` : "unknown size"})`,
      );

      return {
        mode: "legacy",
        iteration: options.iteration,
        out: options.out,
        flow,
        browser: { name: "Microsoft Edge", channel: "msedge" },
        viewport: { width: options.width, height: options.height, deviceScaleFactor: 1 },
        png,
        bytes: buffer.length,
        sha256: sha256(buffer),
        stats,
        ...captured,
      };
    },
  );
}
