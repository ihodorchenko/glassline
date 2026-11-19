#!/usr/bin/env node
/**
 * Real-Safari smoke test through `safaridriver --mcp`.
 *
 * Requires Safari → Settings → Advanced → "Show features for web developers",
 * then Develop → "Allow Remote Automation".
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const url = args.find((value, index) => args[index - 1] === "--url") ?? "http://127.0.0.1:4173/";
const outDir =
  args.find((value, index) => args[index - 1] === "--out-dir") ?? "/tmp/glassline-safari";
const modeArg = args.find((value, index) => args[index - 1] === "--mode") ?? "training";
const modeLabel = modeArg.toLowerCase() === "prologue" ? "Prologue" : "Training";
const modeSlug = modeLabel.toLowerCase();
const probeMovement = args.includes("--probe-movement");
const probeFps = args.includes("--probe-fps");
const viewportArg = args.find((value, index) => args[index - 1] === "--viewport") ?? "1280x720";
const [viewportWidth, viewportHeight] = viewportArg.split("x").map(Number);

await mkdir(outDir, { recursive: true });

const proc = spawn("safaridriver", ["--mcp"], { stdio: ["pipe", "pipe", "pipe"] });
let id = 0;
let buffer = "";
const pending = new Map();

proc.stdout.setEncoding("utf8");
proc.stdout.on("data", (chunk) => {
  buffer += chunk;
  let newline = buffer.indexOf("\n");
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    try {
      const message = JSON.parse(line);
      const resolve = message.id ? pending.get(message.id) : undefined;
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      }
    } catch {
      // Ignore non-JSON stderr noise on stdout.
    }
    newline = buffer.indexOf("\n");
  }
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`Safari MCP timeout: ${method}`));
    }, 45000);
    pending.set(requestId, (message) => {
      clearTimeout(timer);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
    proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params })}\n`);
  });
}

async function tool(name, toolArgs = {}) {
  const result = await send("tools/call", { name, arguments: toolArgs });
  const text = result?.content?.find((part) => part.type === "text")?.text ?? "";
  if (text.startsWith("Tool error:")) throw new Error(text);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  try {
    await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "glassline-safari", version: "0.1" },
    });
    proc.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
    );

    await tool("navigate_to_url", { url });
    await tool("set_viewport_size", {
      width: Number.isFinite(viewportWidth) ? viewportWidth : 1280,
      height: Number.isFinite(viewportHeight) ? viewportHeight : 720,
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await tool("screenshot", { savePath: join(outDir, "menu.png") });

    await tool("page_interactions", {
      interactions: [{ type: "click", text: modeLabel, purpose: `Open ${modeLabel}` }],
    });
    await new Promise((resolve) => setTimeout(resolve, 4500));
    await tool("screenshot", { savePath: join(outDir, `${modeSlug}.png`) });

    const state = await tool("evaluate_javascript", {
      expression:
        "return { body: document.body.innerText.slice(0, 200), canvas: !!document.querySelector('canvas'), hud: !!document.querySelector('.gl-hud.is-visible'), flow: window.__glassline?.flowManager?.getState?.(), player: window.__glassline?.player?.getPosition?.() };",
    });

    let movement = null;

    if (probeMovement && state?.flow === "gameplay") {
      const before = state.player;

      await tool("evaluate_javascript", {
        expression:
          "window.__glassline.input.heldKeys.add('KeyW'); window.__glassline.input.heldKeys.add('ShiftLeft'); return true;",
      });
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const after = await tool("evaluate_javascript", {
        expression: `const app = window.__glassline; const p = app.player.getPosition(); app.input.heldKeys.delete('KeyW'); app.input.heldKeys.delete('ShiftLeft'); return { player: p };`,
      });
      movement = {
        before,
        after: after?.player,
        distance:
          before && after?.player
            ? Math.hypot(after.player.x - before.x, after.player.z - before.z)
            : null,
      };
    }

    let fps = null;

    if (probeFps) {
      await tool("evaluate_javascript", {
        expression: `window.__safariFps = { frames: 0, startedAt: performance.now(), done: false };
          const tick = () => {
            const state = window.__safariFps;
            state.frames += 1;
            if (performance.now() - state.startedAt < 2000) requestAnimationFrame(tick);
            else { state.done = true; state.elapsed = performance.now() - state.startedAt; }
          };
          requestAnimationFrame(tick);
          return true;`,
      });
      await new Promise((resolve) => setTimeout(resolve, 2400));
      const result = await tool("evaluate_javascript", {
        expression: "return window.__safariFps ?? null;",
      });
      fps = result;
    }

    const consoleState = await tool("browser_console_messages", { limit: 40 });
    await writeFile(
      join(outDir, "report.json"),
      JSON.stringify({ url, mode: modeLabel, state, movement, fps, consoleState }, null, 2),
    );

    console.log(JSON.stringify({ ok: true, outDir, state, movement, fps }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (message.includes("Allow remote automation")) {
      console.error(
        "Enable Safari → Settings → Advanced → Show features for web developers, then Develop → Allow Remote Automation, and rerun.",
      );
    }
    process.exitCode = 1;
  } finally {
    proc.kill();
  }
}

void main();
