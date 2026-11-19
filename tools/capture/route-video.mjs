#!/usr/bin/env node
/**
 * Continuous gameplay capture: drives forward/sprint/jump input, records the
 * page screencast and live post-limiter audio, then muxes them with ffmpeg.
 *
 * Usage:
 *   node tools/capture/route-video.mjs --launch --out docs/evidence/video/route.mp4 \
 *     --wav docs/evidence/video/route.wav --seconds 12
 */

import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
    wav: null,
    seconds: 12,
    mode: "prologue",
    width: 1280,
    height: 720,
    launch: false,
    jumps: true,
    slide: true,
    verbose: false,
    fps: 30,
    pos: [0, 0.93, 6],
    yaw: 0,
    cinematic: false,
    unlock: false,
    waypoints: null,
    jumpX: [],
    jumpZ: [],
    jumpHold: 110,
    slideRange: null,
    interact: false,
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
      case "--wav":
        args.wav = value();
        break;
      case "--seconds":
        args.seconds = Number(value());
        break;
      case "--mode":
        args.mode = value();
        break;
      case "--width":
        args.width = Number(value());
        break;
      case "--height":
        args.height = Number(value());
        break;
      case "--fps":
        args.fps = Number(value());
        break;
      case "--launch":
        args.launch = true;
        break;
      case "--no-jumps":
        args.jumps = false;
        break;
      case "--no-slide":
        args.slide = false;
        break;
      case "--jump-z":
        args.jumpZ = (argv[++index] ?? "")
          .split(",")
          .map((entry) => {
            const [zPart, holdPart] = entry.split(":");
            const z = Number(zPart);
            const hold = holdPart ? Number(holdPart) : null;

            return Number.isFinite(z) ? { z, hold } : null;
          })
          .filter(Boolean);
        break;
      case "--jump-hold":
        args.jumpHold = Math.max(40, Number(argv[++index] ?? 110) || 110);
        break;
      case "--slide-range": {
        const range = (argv[++index] ?? "").split(",").map(Number);
        args.slideRange = range.length === 2 && range.every(Number.isFinite) ? range : null;
        break;
      }
      case "--cinematic":
        args.cinematic = true;
        break;
      case "--unlock":
        args.unlock = true;
        break;
      case "--interact":
        args.interact = true;
        break;
      case "--jump-x":
        args.jumpX = value()
          .split(",")
          .map((entry) => Number(entry.trim()))
          .filter(Number.isFinite);
        break;
      case "--waypoints":
        args.waypoints = value()
          .split(";")
          .map((pair) => {
            const [x, z] = pair.split(",").map((entry) => Number(entry.trim()));
            return { x, z };
          })
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z));
        break;
      case "--verbose":
        args.verbose = true;
        break;
      case "--pos":
        args.pos = value()
          .split(",")
          .map((entry) => Number(entry.trim()));
        break;
      case "--yaw":
        args.yaw = Number(value());
        break;
      case "--help":
        console.log(
          [
            "Usage: node tools/capture/route-video.mjs --out <file.mp4> [options]",
            "",
            "  --wav <file.wav>   Also save live post-limiter audio",
            "  --seconds <n>      Capture duration (default 12)",
            "  --mode <mode>      prologue | training | speedrun",
            "  --launch           Launch headless Edge",
            "  --no-jumps         Do not auto-jump",
            "  --jump-z <list>    Jump at z thresholds; optional hold ms: z[:hold],...",
            "  --jump-hold <ms>   Hold jump longer for full-height jumps (default 110)",
            "  --slide-range <a,b> Hold crouch/slide between z=a and z=b",
          ].join("\n"),
        );
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
    throw new Error("No Chromium browser found. Set GLASSLINE_BROWSER.");
  }

  const profile = join(process.cwd(), ".npm-cache", "edge-route-video-profile");
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
    this.listeners = new Map();
    this.errors = [];

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        this.errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
      }

      if (message.method === "Runtime.exceptionThrown") {
        this.errors.push(`exception: ${message.params.exceptionDetails?.text ?? "unknown"}`);
      }

      if (message.method) {
        for (const handler of this.listeners.get(message.method) ?? []) {
          handler(message.params);
        }
      }

      if (!message.id || !this.pending.has(message.id)) {
        return;
      }

      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
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

  on(method, handler) {
    const handlers = this.listeners.get(method) ?? [];
    handlers.push(handler);
    this.listeners.set(method, handlers);
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    this.socket.send(JSON.stringify({ id, method, params }));

    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
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

async function sendKey(session, type, code, key, vk, modifiers = 0) {
  await session.send("Input.dispatchKeyEvent", {
    type,
    code,
    key,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    modifiers,
  });
}

const START_RECORDER = `(() => {
  const app = window.__glassline;
  const audio = app.audioManager;
  const context = audio.context;
  const source = audio.limiter ?? audio.mixTrim;

  if (!context || !source || audio.state !== "running") {
    return { error: "audio-not-running" };
  }

  const chunks = [];
  const processor = context.createScriptProcessor(4096, 2, 2);
  const sink = context.createGain();

  sink.gain.value = 0;
  processor.onaudioprocess = (event) => {
    const left = event.inputBuffer.getChannelData(0);
    const right = event.inputBuffer.numberOfChannels > 1 ? event.inputBuffer.getChannelData(1) : left;
    chunks.push([new Float32Array(left), new Float32Array(right)]);
  };
  source.connect(processor);
  processor.connect(sink);
  sink.connect(context.destination);
  window.__routeRecorder = { chunks, processor, sink, source, context };

  return { sampleRate: context.sampleRate };
})()`;

const STOP_RECORDER = `(() => {
  const recorder = window.__routeRecorder;

  if (!recorder) {
    return { error: "recorder-missing" };
  }

  recorder.processor.onaudioprocess = null;
  recorder.source.disconnect(recorder.processor);
  recorder.processor.disconnect();
  recorder.sink.disconnect();

  const frameCount = recorder.chunks.reduce((total, [left]) => total + left.length, 0);
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);
  let offset = 0;

  for (const [l, r] of recorder.chunks) {
    left.set(l, offset);
    right.set(r, offset);
    offset += l.length;
  }

  const buffer = new ArrayBuffer(44 + frameCount * 4);
  const view = new DataView(buffer);
  const writeString = (position, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(position + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + frameCount * 4, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, recorder.context.sampleRate, true);
  view.setUint32(28, recorder.context.sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, frameCount * 4, true);

  let peak = 0;
  let sum = 0;
  let dataOffset = 44;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const l = left[frame] ?? 0;
    const r = right[frame] ?? 0;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sum += (l * l + r * r) * 0.5;
    view.setInt16(dataOffset, Math.max(-1, Math.min(1, l)) * 0x7fff, true);
    view.setInt16(dataOffset + 2, Math.max(-1, Math.min(1, r)) * 0x7fff, true);
    dataOffset += 4;
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  delete window.__routeRecorder;

  return {
    wavBase64: btoa(binary),
    sampleRate: recorder.context.sampleRate,
    durationSeconds: frameCount / recorder.context.sampleRate,
    peak,
    rms: Math.sqrt(sum / Math.max(1, frameCount)),
  };
})()`;

const CINEMATIC_SETUP = `(() => {
  const app = window.__glassline;

  document.querySelectorAll(".gl-hud").forEach((element) => {
    element.style.display = "none";
  });
  app.viewModel.setVisible = () => {};
  app.viewModel.setVisible(false);

  if (app.viewModel.root) {
    app.viewModel.root.visible = false;
  }

  app.viewModel.update = () => {};
  app.cameraSystem.camera.traverse((object) => {
    if (object.name === "view-model") {
      object.visible = false;
    }
  });

  const camera = app.cameraSystem.camera;
  app.cameraSystem.renderUpdate = () => {};
  camera.fov = 65;
  camera.updateProjectionMatrix();

  const shots = [
    {
      from: 0,
      points: [
        { t: 0, p: [0, 1.65, 6], l: [0, 1.5, -18] },
        { t: 3, p: [0, 1.65, -15], l: [0, 1.35, -32] },
        { t: 5.2, p: [0, -1.35, -24], l: [0, -1.1, -40] },
        { t: 7.2, p: [0, -1.35, -33], l: [0, -1.0, -48] },
        { t: 9.2, p: [0, 0.85, -45], l: [0, 1.0, -60] },
        { t: 11.2, p: [0, 1.3, -60], l: [0, 1.25, -72] },
        { t: 13, p: [0, 1.3, -66], l: [0, 1.5, -79] },
      ],
    },
    {
      from: 13,
      points: [
        { t: 13, p: [52, 6.1, -122.8], l: [34, 6.05, -122.8] },
        { t: 15, p: [40, 6.1, -123.4], l: [24, 6.0, -127] },
        { t: 17, p: [26, 6.1, -127.2], l: [10, 6.0, -130.6] },
        { t: 19, p: [10, 6.1, -130.6], l: [0, 6.0, -133] },
        { t: 21, p: [0, 6.1, -129.6], l: [0, 6.0, -134] },
      ],
    },
  ];
  const start = performance.now();

  const update = () => {
    const t = (performance.now() - start) / 1000;
    const shot = t < 13 ? shots[0] : shots[1];
    const points = shot.points;
    let index = 0;

    while (index < points.length - 1 && points[index + 1].t <= t) {
      index += 1;
    }

    const a = points[index];
    const b = points[Math.min(index + 1, points.length - 1)];
    const span = Math.max(0.001, b.t - a.t);
    const raw = Math.max(0, Math.min(1, (t - a.t) / span));
    const e = raw * raw * (3 - 2 * raw);
    camera.position.set(
      a.p[0] + (b.p[0] - a.p[0]) * e,
      a.p[1] + (b.p[1] - a.p[1]) * e,
      a.p[2] + (b.p[2] - a.p[2]) * e,
    );
    camera.lookAt(
      a.l[0] + (b.l[0] - a.l[0]) * e,
      a.l[1] + (b.l[1] - a.l[1]) * e,
      a.l[2] + (b.l[2] - a.l[2]) * e,
    );
    requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
  return true;
})()`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.launch) {
    await launchBrowser(args.port, args.width, args.height);
  } else {
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

  while (Date.now() - readyStarted < 30000) {
    const state = await session
      .evaluate("window.__glassline ? window.__glassline.state : null")
      .catch(() => null);

    if (state === "ready" || state === "running") {
      break;
    }

    await delay(250);
  }

  await session.evaluate(
    `(async () => {
      const app = window.__glassline;
      if (app.flowManager.getState() !== "gameplay") {
        await app.startGameplay(${JSON.stringify(args.mode)});
      }
      if (${args.unlock}) {
        for (const section of ["sec_industrial", "sec_construction", "sec_skybridge", "sec_finish"]) {
          await app.levelRuntime.activateSection(section);
        }
      }
      app.player.teleportTo({ x: ${args.pos[0]}, y: ${args.pos[1]}, z: ${args.pos[2]} });
      app.cameraSystem.resetForRespawn(${args.yaw});
      app.cameraSystem.pitch = 0;
      return app.flowManager.getState();
    })()`,
    true,
  );

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
  await delay(800);

  const recorder = await session.evaluate(START_RECORDER);

  if (recorder?.error) {
    throw new Error(`Audio recorder failed: ${recorder.error}`);
  }

  const frames = [];
  let respawnCount = 0;

  session.on("Page.screencastFrame", (params) => {
    frames.push(params.data);
    session.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => {});
  });

  await session.send("Page.startScreencast", {
    format: "jpeg",
    quality: 82,
    maxWidth: args.width,
    maxHeight: args.height,
    everyNthFrame: 1,
  });

  if (args.cinematic) {
    await session.evaluate(CINEMATIC_SETUP);
    await delay(args.seconds * 1000);
  } else if (args.waypoints && args.waypoints.length > 0) {
    const waypoints = args.waypoints;
    await session.evaluate(
      "window.__glassline.input.heldKeys.add('ShiftLeft'); window.__glassline.input.heldKeys.add('KeyW'); true",
    );
    const started = Date.now();
    let index = 0;
    const jumped = new Set();
    const jumpedZ = new Set();
    let lastLogAt = 0;
    let lastStateZ = 6;
    let stuckSince = 0;
    let lastRecoveryAt = 0;

    while (Date.now() - started < args.seconds * 1000) {
      const state = await session.evaluate(`(() => {
        const app = window.__glassline;
        if (!app.player) return { done: true };
        app.input.heldKeys.add('KeyW');
        app.input.heldKeys.add('ShiftLeft');
        return {
          done: false,
          x: app.player.getPosition().x,
          z: app.player.getPosition().z,
          speed: app.player.model.getSnapshot().speed,
          grounded: app.player.model.getSnapshot().grounded,
        };
      })()`);
      const target = waypoints[index] ?? waypoints[waypoints.length - 1];

      if (!state || state.done || !target) break;

      if (state.z > lastStateZ + 5) {
        respawnCount += 1;
        jumpedZ.clear();
        jumped.clear();
      }

      lastStateZ = state.z;

      const distance = Math.hypot(target.x - state.x, target.z - state.z);

      if (args.verbose && Date.now() - lastLogAt > 500) {
        lastLogAt = Date.now();
        console.log(
          `wp=${index}/${waypoints.length - 1} x=${state.x.toFixed(2)} z=${state.z.toFixed(2)} grounded=${state.grounded}`,
        );
      }

      if (distance < 1.0 && index < waypoints.length - 1) {
        index += 1;
        continue;
      }

      const yaw = Math.atan2(-(target.x - state.x), -(target.z - state.z));
      await session.evaluate(`(() => {
        const camera = window.__glassline.cameraSystem;
        camera.yaw = ${yaw};
        camera.pitch = 0;
        return true;
      })()`);

      if (args.slideRange) {
        const [slideStart, slideEnd] = args.slideRange;
        const shouldSlide = state.z <= slideStart && state.z >= slideEnd;

        await session.evaluate(
          `window.__glassline.input.heldKeys.${shouldSlide ? "add" : "delete"}('KeyC'); true`,
        );
      }

      if (state.grounded) {
        for (const jump of args.jumpZ) {
          const targetZ = jump.z;
          const hold = jump.hold ?? args.jumpHold;

          if (!jumpedZ.has(targetZ) && state.z <= targetZ + 0.45 && state.z >= targetZ - 2.2) {
            jumpedZ.add(targetZ);
            await session.evaluate("window.__glassline.input.heldKeys.delete('Space'); true");
            await delay(40);
            await session.evaluate("window.__glassline.input.heldKeys.add('Space'); true");
            await delay(hold);
            await session.evaluate("window.__glassline.input.heldKeys.delete('Space'); true");
            break;
          }
        }
      }

      if (state.grounded && state.speed < 0.7) {
        if (stuckSince === 0) {
          stuckSince = Date.now();
        } else if (Date.now() - stuckSince > 450 && Date.now() - lastRecoveryAt > 900) {
          lastRecoveryAt = Date.now();
          stuckSince = 0;
          await session.evaluate("window.__glassline.input.heldKeys.delete('Space'); true");
          await delay(40);
          await session.evaluate("window.__glassline.input.heldKeys.add('Space'); true");
          await delay(320);
          await session.evaluate("window.__glassline.input.heldKeys.delete('Space'); true");
        }
      } else {
        stuckSince = 0;
      }

      if (state.z < -128 && state.grounded) {
        for (const x of args.jumpX) {
          if (!jumped.has(x) && Math.abs(state.x - x) < 1.15) {
            jumped.add(x);
            await session.evaluate("window.__glassline.input.heldKeys.delete('Space'); true");
            await delay(40);
            await session.evaluate("window.__glassline.input.heldKeys.add('Space'); true");
            await delay(args.jumpHold);
            await session.evaluate("window.__glassline.input.heldKeys.delete('Space'); true");
            break;
          }
        }
      }

      if (index === waypoints.length - 1 && distance < 1.2) {
        if (args.interact) {
          await sendKey(session, "rawKeyDown", "KeyE", "e", 69);
          await delay(80);
          await sendKey(session, "keyUp", "KeyE", "e", 69);
          await delay(2600);
        }
        break;
      }

      await delay(80);
    }

    await session.evaluate(
      "window.__glassline.input.heldKeys.delete('KeyW'); window.__glassline.input.heldKeys.delete('ShiftLeft'); true",
    );
    await delay(300);
  } else {
    await session.evaluate(
      "window.__glassline.input.heldKeys.add('ShiftLeft'); window.__glassline.input.heldKeys.add('KeyW'); true",
    );

    const started = Date.now();
    let vaultJumped = false;
    let gapJumped = false;
    let sliding = false;
    let lastJumpAt = 0;

    const jump = async () => {
      lastJumpAt = Date.now();
      await sendKey(session, "rawKeyDown", "Space", " ", 32);
      await delay(70);
      await sendKey(session, "keyUp", "Space", " ", 32);
    };

    while (Date.now() - started < args.seconds * 1000) {
      const state = await session.evaluate(`(() => {
      const app = window.__glassline;
      return {
        z: app.player.getPosition().z,
        speed: app.player.model.getSnapshot().speed,
        stance: app.player.model.getSnapshot().stance,
        posture: app.player.postureHeight,
        grounded: app.player.model.getSnapshot().grounded,
        held: [...app.input.heldKeys],
      };
    })()`);
      const z = state?.z ?? 6;

      await session.evaluate(`(() => {
        const h = window.__glassline.input.heldKeys;
        h.add("ShiftLeft");
        h.add("KeyW");
        if (${sliding} || (${z} < -2.4 && ${z} > -10.6)) {
          h.add("KeyC");
        } else {
          h.delete("KeyC");
        }
        return true;
      })()`);

      if (!vaultJumped && z < 1.2) {
        vaultJumped = true;
        await jump();
      }

      if (args.slide && !sliding && z < -2.4 && z > -5.7 && state?.grounded !== false) {
        sliding = true;
        await session.evaluate("window.__glassline.input.heldKeys.add('KeyC'); true");
      } else if (sliding && z < -10.2) {
        sliding = false;
        await session.evaluate("window.__glassline.input.heldKeys.delete('KeyC'); true");
      }

      if (!gapJumped && z < -28) {
        gapJumped = true;
        await jump();
      }

      if (args.jumps && !sliding && z < -12 && Date.now() - lastJumpAt > 2400) {
        await jump();
      }

      if (args.verbose) {
        console.log(
          `z=${z.toFixed(2)} speed=${(state?.speed ?? 0).toFixed(2)} stance=${state?.stance} posture=${state?.posture?.toFixed(2)} slide=${sliding} held=${(state?.held ?? []).join("+")}`,
        );
      }

      await delay(60);
    }

    if (sliding) {
      await session.evaluate("window.__glassline.input.heldKeys.delete('KeyC'); true");
    }

    await sendKey(session, "keyUp", "KeyW", "w", 87);
    await sendKey(session, "keyUp", "ShiftLeft", "Shift", 16, 0);
    await delay(500);
  }

  await session.send("Page.stopScreencast").catch(() => {});

  const audio = await session.evaluate(STOP_RECORDER);

  if (audio?.error) {
    throw new Error(`Audio recorder failed: ${audio.error}`);
  }

  const frameDir = await mkdtemp(join(tmpdir(), "glassline-route-"));
  const total = frames.length;

  for (let index = 0; index < total; index += 1) {
    await writeFile(
      join(frameDir, `frame-${String(index + 1).padStart(5, "0")}.jpg`),
      Buffer.from(frames[index], "base64"),
    );
  }

  const wavPath = args.wav ?? args.out.replace(/\.mp4$/i, ".wav");
  await mkdir(dirname(wavPath), { recursive: true });
  await writeFile(wavPath, Buffer.from(audio.wavBase64, "base64"));
  await mkdir(dirname(args.out), { recursive: true });

  const capturedFps = Math.max(10, Math.min(60, total / Math.max(0.5, audio.durationSeconds)));

  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      capturedFps.toFixed(3),
      "-i",
      join(frameDir, "frame-%05d.jpg"),
      "-i",
      wavPath,
      "-vf",
      "fps=30",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-shortest",
      args.out,
    ],
    { stdio: "ignore" },
  );
  const exitCode = await new Promise((resolve) => ffmpeg.on("exit", resolve));

  await rm(frameDir, { recursive: true, force: true });

  if (exitCode !== 0) {
    throw new Error(`ffmpeg exited with ${exitCode}`);
  }

  console.log(
    JSON.stringify(
      {
        out: args.out,
        wav: wavPath,
        frames: total,
        durationSeconds: audio.durationSeconds,
        sampleRate: audio.sampleRate,
        peak: audio.peak,
        rms: audio.rms,
        respawns: respawnCount,
        errors: session.errors,
      },
      null,
      2,
    ),
  );
  session.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
