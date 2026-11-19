#!/usr/bin/env node
/**
 * Live audio probe: starts gameplay, enables audio through a trusted click, and
 * measures the post-limiter master output while triggering a deterministic
 * footstep/landing sequence.
 *
 * Usage:
 *   node tools/capture/audio-probe.mjs [--port 9222] [--json report.json]
 */

import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

function parseArgs(argv) {
  const args = { port: 9222, json: null };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => argv[++index];

    if (flag === "--port") {
      args.port = Number(value());
    } else if (flag === "--json") {
      args.json = value();
    } else if (flag === "--help") {
      console.log("Usage: node tools/capture/audio-probe.mjs [--port 9222] [--json report.json]");
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
    `(async () => {
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

      audio.playLanding(10, "metal");

      return {
        measurement: await output,
        snapshot: audio.getDebugSnapshot(),
      };
    })()`,
    true,
  );

  const report = {
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
