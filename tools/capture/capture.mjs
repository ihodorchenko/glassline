#!/usr/bin/env node
/**
 * Deterministic gameplay capture for reference review.
 *
 * Connects to a Chromium-family browser running with remote debugging, starts a
 * gameplay mode, optionally teleports the player and aims the camera, then saves
 * a screenshot plus scene statistics.
 *
 * Usage:
 *   node tools/capture/capture.mjs --out docs/evidence/visual/round-1/start.jpg
 *   node tools/capture/capture.mjs --mode training --pos 0,0.93,6 --yaw 0 --pitch 0
 *   node tools/capture/capture.mjs --launch --out /tmp/prologue.png
 *
 * Prerequisites: a dev server (`npm run dev`) and a browser exposing CDP:
 *   "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
 *     --headless=new --no-sandbox --remote-debugging-port=9222 \
 *     --user-data-dir=.npm-cache/edge-profile --window-size=1600,900 about:blank
 *
 * `--launch` starts that browser automatically. `--no-sandbox` is only acceptable
 * for local, disposable capture profiles.
 */

import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EDGE_CANDIDATES = [
  process.env.GLASSLINE_BROWSER,
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

function parseArgs(argv) {
  const args = {
    url: process.env.GLASSLINE_URL ?? "http://127.0.0.1:5199/",
    port: Number(process.env.GLASSLINE_CDP_PORT ?? 9222),
    out: null,
    mode: "prologue",
    pos: null,
    yaw: 0,
    pitch: 0,
    wait: 2500,
    width: 1600,
    height: 900,
    launch: false,
    keepOpen: true,
    menu: false,
    settings: false,
    runMs: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => argv[++index];

    switch (flag) {
      case "--url":
        args.url = value();
        break;
      case "--port":
        args.port = Number(value());
        break;
      case "--out":
        args.out = value();
        break;
      case "--mode":
        args.mode = value();
        break;
      case "--pos":
        args.pos = value()
          .split(",")
          .map((number) => Number(number.trim()));
        break;
      case "--yaw":
        args.yaw = Number(value());
        break;
      case "--pitch":
        args.pitch = Number(value());
        break;
      case "--wait":
        args.wait = Number(value());
        break;
      case "--width":
        args.width = Number(value());
        break;
      case "--height":
        args.height = Number(value());
        break;
      case "--launch":
        args.launch = true;
        break;
      case "--menu":
        args.menu = true;
        break;
      case "--settings":
        args.menu = true;
        args.settings = true;
        break;
      case "--run":
        args.runMs = Number(value());
        break;
      case "--close":
        args.keepOpen = false;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (!args.out) {
    throw new Error("Missing --out path.");
  }

  return args;
}

function printHelp() {
  console.log(
    [
      "Usage: node tools/capture/capture.mjs --out <file.png> [options]",
      "",
      "  --url <url>        Dev server URL (default http://127.0.0.1:5199/)",
      "  --port <port>      CDP port (default 9222)",
      "  --mode <mode>      training | prologue | speedrun (default prologue)",
      "  --pos x,y,z        Teleport the player before capture",
      "  --yaw <radians>    Camera yaw (0 looks down the route)",
      "  --pitch <radians>  Camera pitch",
      "  --wait <ms>        Settle time after teleport (default 2500)",
      "  --launch           Launch a headless Edge instance automatically",
      "  --menu             Capture the main menu instead of starting gameplay",
      "  --settings         Open the settings screen before capture",
      "  --run <ms>         Hold sprint while settling, for a moving HUD capture",
      "  --close            Stop the launched browser when finished",
    ].join("\n"),
  );
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.json();
}

async function waitForCdp(port, timeoutMs = 15000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      await fetchJson(`http://127.0.0.1:${port}/json/version`);
      return;
    } catch {
      await delay(250);
    }
  }

  throw new Error(`CDP endpoint on port ${port} did not become available.`);
}

async function launchBrowser(port, width, height) {
  const browser = EDGE_CANDIDATES.find(Boolean);

  if (!browser || !(await fileExists(browser))) {
    throw new Error(
      "No Chromium browser found. Set GLASSLINE_BROWSER to an executable or launch one manually.",
    );
  }

  const profile = join(process.cwd(), ".npm-cache", "edge-capture-profile");
  await mkdir(profile, { recursive: true });

  const child = spawn(
    browser,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu-sandbox",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      `--window-size=${width},${height}`,
      "--use-angle=metal",
      "about:blank",
    ],
    { detached: true, stdio: "ignore" },
  );

  child.unref();
  await waitForCdp(port);

  return child;
}

class CdpSession {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (!message.id || !this.pending.has(message.id)) {
        return;
      }

      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);

      if (message.error) {
        reject(new Error(JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
    });
  }

  static async connect(port) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find((target) => target.type === "page");

    if (!page) {
      throw new Error("No page target found.");
    }

    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });

    return new CdpSession(socket);
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    this.socket.send(JSON.stringify({ id, method, params }));

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression, awaitPromise = false) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 2000));
    }

    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const launched = args.launch ? await launchBrowser(args.port, args.width, args.height) : null;

  if (!launched) {
    await waitForCdp(args.port);
  }

  const session = await CdpSession.connect(args.port);

  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: args.width,
    height: args.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await session.send("Page.navigate", { url: args.url });
  await session.send("Page.bringToFront").catch(() => {});

  const readyStarted = Date.now();
  let ready = false;

  while (Date.now() - readyStarted < 30000) {
    const state = await session
      .evaluate("window.__glassline ? window.__glassline.state : null")
      .catch(() => null);

    if (state === "ready" || state === "running") {
      ready = true;
      break;
    }

    await delay(250);
  }

  if (!ready) {
    throw new Error("Glassline did not initialize in the browser.");
  }

  let flow = "main-menu";

  if (!args.menu) {
    flow = await session.evaluate(
      `(async () => {
        const app = window.__glassline;

        if (app.flowManager.getState() !== "gameplay") {
          await app.startGameplay(${JSON.stringify(args.mode)});
        }

        return app.flowManager.getState();
      })()`,
      true,
    );

    if (flow !== "gameplay") {
      throw new Error(`Gameplay did not start (flow: ${flow}).`);
    }
  } else if (args.settings) {
    await session.evaluate('window.__glassline.ui.showSettings("main-menu")', true);
  }

  if (
    !args.menu &&
    Array.isArray(args.pos) &&
    args.pos.length === 3 &&
    args.pos.every(Number.isFinite)
  ) {
    await session.evaluate(`(() => {
      const app = window.__glassline;
      app.player.teleportTo({ x: ${args.pos[0]}, y: ${args.pos[1]}, z: ${args.pos[2]} });
      app.cameraSystem.resetForRespawn(${args.yaw});
      app.cameraSystem.pitch = ${args.pitch};
      return true;
    })()`);
  } else if (!args.menu && (args.yaw !== 0 || args.pitch !== 0)) {
    await session.evaluate(`(() => {
      const app = window.__glassline;
      app.cameraSystem.resetForRespawn(${args.yaw});
      app.cameraSystem.pitch = ${args.pitch};
      return true;
    })()`);
  }

  if (args.runMs > 0) {
    await session.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: Math.floor(args.width / 2),
      y: Math.floor(args.height / 2),
      button: "left",
      clickCount: 1,
    });
    await session.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: Math.floor(args.width / 2),
      y: Math.floor(args.height / 2),
      button: "left",
      clickCount: 1,
    });
    await delay(300);

    for (const [code, key, vk] of [
      ["KeyW", "w", 87],
      ["ShiftLeft", "Shift", 16],
    ]) {
      await session.send("Input.dispatchKeyEvent", {
        type: code === "ShiftLeft" ? "keyDown" : "rawKeyDown",
        code,
        key,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
      });
    }

    await delay(args.runMs);
  }

  await delay(args.wait);

  const screenshot = await session.send("Page.captureScreenshot", { format: "png" });

  if (args.runMs > 0) {
    await session.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: Math.floor(args.width / 2),
      y: Math.floor(args.height / 2),
      button: "left",
      clickCount: 1,
    });
    await session.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: Math.floor(args.width / 2),
      y: Math.floor(args.height / 2),
      button: "left",
      clickCount: 1,
    });
    await delay(300);

    for (const [code, key, vk] of [
      ["KeyW", "w", 87],
      ["ShiftLeft", "Shift", 16],
    ]) {
      await session.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        code,
        key,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
      });
    }
  }
  const buffer = Buffer.from(screenshot.data, "base64");
  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, buffer);

  const info = await session.evaluate(`(() => {
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
      const triangleCount = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;

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
      quality: app.settingsManager.getValue("graphics.quality"),
      instancedMeshes,
      instances,
      triangles: Math.round(triangles),
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? null,
      canvas: [renderer.domElement.width, renderer.domElement.height],
    };
  })()`);

  session.close();

  console.log(
    JSON.stringify(
      {
        out: args.out,
        flow,
        mode: args.mode,
        position: info.position,
        instancedMeshes: info.instancedMeshes,
        instances: info.instances,
        triangles: info.triangles,
        textures: info.textures,
        programs: info.programs,
        canvas: info.canvas,
      },
      null,
      2,
    ),
  );

  if (launched && !args.keepOpen) {
    launched.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
