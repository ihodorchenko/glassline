#!/usr/bin/env node
/**
 * Renders the deterministic audio demo in the running dev build and writes a WAV.
 *
 * Usage:
 *   node tools/capture/audio-render.mjs --out docs/evidence/audio/round-2/mix.wav
 *   node tools/capture/audio-render.mjs --seconds 24 --port 9222
 *
 * Requires the dev server and a CDP browser (see tools/capture/README.md).
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

function parseArgs(argv) {
  const args = { port: 9222, out: "docs/evidence/audio/round-2/mix.wav", seconds: 24 };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => argv[++index];

    if (flag === "--port") {
      args.port = Number(value());
    } else if (flag === "--out") {
      args.out = value();
    } else if (flag === "--seconds") {
      args.seconds = Number(value());
    } else if (flag === "--help") {
      console.log("Usage: node tools/capture/audio-render.mjs --out <file.wav> [--seconds 24]");
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

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

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
  await session.send("Page.bringToFront").catch(() => {});

  let ready = false;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    ready = await session.evaluate("Boolean(window.__glasslineAudioDemo)").catch(() => false);

    if (ready) {
      break;
    }

    await delay(250);
  }

  if (!ready) {
    throw new Error("Audio demo is not available. Is the dev server running?");
  }

  const result = await session.evaluate(`window.__glasslineAudioDemo(${args.seconds})`, true);

  await mkdir(dirname(args.out), { recursive: true });
  await writeFile(args.out, Buffer.from(result.wavBase64, "base64"));
  session.close();

  console.log(
    JSON.stringify(
      {
        out: args.out,
        durationSeconds: result.durationSeconds,
        sampleRate: result.sampleRate,
        peak: result.peak,
        peakDb: 20 * Math.log10(Math.max(result.peak, 1e-9)),
        rms: result.rms,
        rmsDb: 20 * Math.log10(Math.max(result.rms, 1e-9)),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
