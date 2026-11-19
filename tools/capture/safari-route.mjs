import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outDir = "/tmp/glassline-safari-route";
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
    if (line) {
      try {
        const message = JSON.parse(line);
        const resolve = message.id ? pending.get(message.id) : undefined;
        if (resolve) {
          pending.delete(message.id);
          resolve(message);
        }
      } catch {}
    }
    newline = buffer.indexOf("\n");
  }
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`timeout ${method}`));
    }, 60000);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "glassline-safari-route", version: "0.1" },
});
proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
await tool("navigate_to_url", { url: "http://127.0.0.1:5199/" });
await sleep(3000);
await tool("page_interactions", {
  interactions: [{ type: "click", text: "Prologue", purpose: "Start Prologue" }],
});
await sleep(3500);
console.log(
  "start",
  JSON.stringify(
    await tool("evaluate_javascript", {
      expression:
        "return { flow: window.__glassline?.flowManager?.getState?.(), pos: window.__glassline?.player?.getPosition?.() };",
    }),
  ),
);

const autopilot = String.raw`(() => {
  const app = window.__glassline;
  if (!app?.player) return false;
  const wps = [[0,4],[0,0],[0,-4.5],[0,-10.8],[0,-20],[0,-26],[0,-33],[0,-40],[0,-45],[0,-52],[0,-60],[0,-67],[0,-72],[0,-77],[0,-82],[0,-87],[0,-92],[0,-98],[0,-103],[0,-109],[0,-115],[0,-121],[0,-128],[0,-133]];
  const jumps = [{z:1.9,hold:110},{z:-30.8,hold:110},{z:-60.8,hold:300},{z:-71,hold:250},{z:-77.6,hold:300},{z:-83.2,hold:300},{z:-88.8,hold:300},{z:-94.4,hold:300},{z:-100,hold:300},{z:-105.6,hold:300},{z:-111.2,hold:300},{z:-116.8,hold:300}];
  const state = window.__safariState = { done:false, respawns:0, waypoint:0, z:null, flow:null };
  const jumped = new Set();
  let lastZ = app.player.getPosition().z;
  let jumpUntil = 0;
  const frame = () => {
    if (!app.player) { state.done = true; state.flow = 'disposed'; return; }
    state.flow = app.flowManager.getState();
    if (state.flow === 'results') { state.done = true; return; }
    const p = app.player.getPosition();
    const snap = app.player.model.getSnapshot();
    state.z = p.z;
    if (p.z > lastZ + 5) { state.respawns += 1; jumped.clear(); }
    lastZ = p.z;
    let target = wps[state.waypoint];
    if (Math.hypot(target[0]-p.x, target[1]-p.z) < 1.0 && state.waypoint < wps.length-1) {
      state.waypoint += 1;
      target = wps[state.waypoint];
    }
    app.cameraSystem.yaw = Math.atan2(-(target[0]-p.x), -(target[1]-p.z));
    app.cameraSystem.pitch = 0;
    const h = app.input.heldKeys;
    h.add('KeyW'); h.add('ShiftLeft');
    if (p.z <= -4.2 && p.z >= -10.6) h.add('KeyC'); else h.delete('KeyC');
    if (snap.grounded) {
      for (const jump of jumps) {
        if (!jumped.has(jump.z) && p.z <= jump.z + 0.45 && p.z >= jump.z - 2.2) {
          jumped.add(jump.z); h.add('Space'); jumpUntil = performance.now() + jump.hold; break;
        }
      }
    }
    if (performance.now() > jumpUntil) h.delete('Space');
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return true;
})()`;

console.log(
  "inject",
  JSON.stringify(await tool("evaluate_javascript", { expression: `return ${autopilot};` })),
);
await sleep(30000);
console.log(
  "status",
  JSON.stringify(
    await tool("evaluate_javascript", { expression: "return window.__safariState ?? null;" }),
    null,
    2,
  ),
);
await tool("screenshot", { savePath: join(outDir, "route.png") });
const consoleState = await tool("browser_console_messages", { limit: 50 });
await writeFile(
  join(outDir, "report.json"),
  JSON.stringify(
    {
      status: await tool("evaluate_javascript", {
        expression:
          "return { state: window.__safariState ?? null, flow: window.__glassline?.flowManager?.getState?.(), time: window.__glassline?.lastResults?.durationMs ?? null };",
      }),
      consoleState,
    },
    null,
    2,
  ),
);
console.log("report written");
proc.kill();
