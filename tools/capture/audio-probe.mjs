#!/usr/bin/env node
/**
 * Live audio probe: starts gameplay, enables audio through a trusted click, and
 * measures the post-limiter master output while triggering a deterministic
 * footstep/landing sequence.
 *
 * Usage:
 *   node tools/capture/audio-probe.mjs [--port 9222] [--json report.json]
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

function parseArgs(argv) {
  const args = {
    port: 9222,
    json: null,
    highRoute: false,
    record: null,
    seconds: 10,
    cadence: 650,
    at: "high",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => argv[++index];

    if (flag === "--port") {
      args.port = Number(value());
    } else if (flag === "--json") {
      args.json = value();
    } else if (flag === "--high-route") {
      args.highRoute = true;
    } else if (flag === "--record") {
      args.record = value();
      args.highRoute = true;
    } else if (flag === "--seconds") {
      args.seconds = Number(value());
    } else if (flag === "--cadence") {
      args.cadence = Number(value());
    } else if (flag === "--at") {
      args.at = value();
    } else if (flag === "--help") {
      console.log(
        "Usage: node tools/capture/audio-probe.mjs [--port 9222] [--json report.json] [--high-route] [--record file.wav] [--seconds 10] [--cadence 650] [--at high|ground]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return args;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.json();
}

class CdpSession {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    this.errors = [];

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        this.errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
      }

      if (message.method === "Runtime.exceptionThrown") {
        this.errors.push(`exception: ${message.params.exceptionDetails?.text ?? "unknown"}`);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const session = await CdpSession.connect(args.port);

  await session.send("Runtime.enable");
  await session.send("Page.enable");
  await session.send("Page.bringToFront").catch(() => {});
  await session.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});

  await session.evaluate(
    `(async () => {
    const app = window.__glassline;

    if (app.flowManager.getState() !== "gameplay") {
      await app.startGameplay("prologue");
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    return app.audioManager.state;
  })()`,
    true,
  );

  const state = await session.evaluate("window.__glassline.audioManager.state");

  if (state !== "running") {
    await session.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: 800,
      y: 400,
      button: "left",
      clickCount: 1,
    });
    await session.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: 800,
      y: 400,
      button: "left",
      clickCount: 1,
    });
    await delay(800);
  }

  const result = await session.evaluate(
    args.record
      ? `(async () => {
          const app = window.__glassline;
          const audio = app.audioManager;
          const context = audio.context;
          const source = audio.limiter ?? audio.mixTrim;
          const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

          if (!context || !source || audio.state !== "running") {
            return { error: "Audio is not running after the trusted click." };
          }

          const onGround = ${JSON.stringify(args.at)} === "ground";

          app.player.teleportTo(onGround ? { x: 0, y: 0.93, z: 6 } : { x: 0, y: 6.1, z: -121 });
          app.cameraSystem.resetForRespawn(0);
          await wait(1500);

          const chunks = [];
          const processor = context.createScriptProcessor(4096, 2, 2);
          const sink = context.createGain();

          sink.gain.value = 0;
          processor.onaudioprocess = (event) => {
            const left = event.inputBuffer.getChannelData(0);
            const right =
              event.inputBuffer.numberOfChannels > 1
                ? event.inputBuffer.getChannelData(1)
                : left;

            chunks.push([new Float32Array(left), new Float32Array(right)]);
          };
          source.connect(processor);
          processor.connect(sink);
          sink.connect(context.destination);

          const steps = setInterval(() => {
            audio.playFootstep(0.9, onGround ? "concrete" : "metal");
          }, ${Math.max(150, args.cadence)});

          await wait(${Math.max(1, args.seconds) * 1000});
          clearInterval(steps);
          audio.playLanding(onGround ? 6 : 10, onGround ? "concrete" : "metal");
          await wait(350);

          processor.onaudioprocess = null;
          source.disconnect(processor);
          processor.disconnect();
          sink.disconnect();

          const frameCount = chunks.reduce((total, [left]) => total + left.length, 0);
          const left = new Float32Array(frameCount);
          const right = new Float32Array(frameCount);
          let offset = 0;

          for (const [l, r] of chunks) {
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
          view.setUint32(24, context.sampleRate, true);
          view.setUint32(28, context.sampleRate * 4, true);
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

          return {
            wavBase64: btoa(binary),
            sampleRate: context.sampleRate,
            durationSeconds: frameCount / context.sampleRate,
            peak,
            rms: Math.sqrt(sum / Math.max(1, frameCount)),
            snapshot: audio.getDebugSnapshot(),
            position: app.player.getPosition(),
          };
        })()`
      : args.highRoute
        ? `(async () => {
          const app = window.__glassline;
          const audio = app.audioManager;
          const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

          if (audio.state !== "running") {
            return { error: "Audio is not running after the trusted click." };
          }

          app.player.teleportTo({ x: 0, y: 0.93, z: 6 });
          app.cameraSystem.resetForRespawn(0);
          await wait(900);

          const groundOutput = audio.measureOutput(1100);
          const groundSnapshot = audio.getDebugSnapshot();
          const ground = await groundOutput;

          app.player.teleportTo({ x: 0, y: 6.1, z: -121 });
          app.cameraSystem.resetForRespawn(0);
          await wait(1400);

          const highOutput = audio.measureOutput(1800);

          for (let index = 0; index < 11; index += 1) {
            audio.playFootstep(0.85, "metal");
            await wait(130);
          }

          audio.playLanding(onGround ? 6 : 10, onGround ? "concrete" : "metal");

          const high = await highOutput;

          return {
            ground,
            groundSnapshot,
            high,
            snapshot: audio.getDebugSnapshot(),
            position: app.player.getPosition(),
          };
        })()`
        : `(async () => {
          const app = window.__glassline;
          const audio = app.audioManager;

          if (audio.state !== "running") {
            return { error: "Audio is not running after the trusted click." };
          }

          const output = audio.measureOutput(1600);

          for (let index = 0; index < 10; index += 1) {
            audio.playFootstep(0.9, "metal");
            await new Promise((resolve) => setTimeout(resolve, 130));
          }

          audio.playLanding(onGround ? 6 : 10, onGround ? "concrete" : "metal");

          return {
            measurement: await output,
            snapshot: audio.getDebugSnapshot(),
          };
        })()`,
    true,
  );

  if (args.record) {
    if (!result.wavBase64) {
      throw new Error("Live recording did not return WAV data.");
    }

    await mkdir(dirname(args.record), { recursive: true });
    await writeFile(args.record, Buffer.from(result.wavBase64, "base64"));
    delete result.wavBase64;
  }

  const report = {
    profile: args.record
      ? "live-high-route-recording"
      : args.highRoute
        ? "live-high-route"
        : "live-prologue",
    ...result,
    errors: session.errors,
  };

  if (args.json) {
    await writeFile(args.json, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log(JSON.stringify(report, null, 2));
  session.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
