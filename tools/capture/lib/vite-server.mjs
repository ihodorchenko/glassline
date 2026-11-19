/**
 * Owns the local Vite dev server for a capture run.
 *
 * - attaches when something already answers on the port (another agent, a
 *   manually started `npm run dev`, ...);
 * - otherwise spawns `node_modules/.bin/vite --port <port> --strictPort
 *   --host 127.0.0.1` with pipes captured for diagnostics;
 * - always stops the child it spawned, including on failures and signals.
 */

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const HTTP_PROBE_TIMEOUT_MS = 1500;
const START_POLL_INTERVAL_MS = 250;
const STOP_GRACE_MS = 5000;
const PORT_CLOSED_TIMEOUT_MS = 5000;
const OUTPUT_TAIL_LINES = 200;

export class ServerStartError extends Error {}

async function probeStatus(url, timeoutMs = HTTP_PROBE_TIMEOUT_MS) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.status;
  } catch {
    return null;
  }
}

/** True when an HTTP server answers with a non-error status. */
export async function isServing(url) {
  const status = await probeStatus(url);
  return status !== null && status < 500;
}

export function createServerManager({ rootDir, port, host, baseUrl, log }) {
  let child = null;
  let exitInfo = null;
  let spawnError = null;
  let owned = false;
  let stopped = false;
  const output = [];

  const pushOutput = (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line.trim() !== "") {
        output.push(line);
        if (output.length > OUTPUT_TAIL_LINES) {
          output.shift();
        }
      }
    }
  };

  const tail = (lines = 25) => output.slice(-lines).join("\n");

  const waitUntilListening = async (timeoutMs) => {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      if (spawnError) {
        throw new ServerStartError(`Vite failed to spawn: ${spawnError.message}`);
      }

      if (exitInfo) {
        throw new ServerStartError(
          `Vite exited before serving ${baseUrl} (code=${exitInfo.code}, signal=${exitInfo.signal}). Output:\n${tail()}`,
        );
      }

      if (await isServing(baseUrl)) {
        log(`Vite served ${baseUrl} (pid ${child?.pid ?? "?"})`);
        return;
      }

      await delay(START_POLL_INTERVAL_MS);
    }

    throw new ServerStartError(
      `Vite did not serve ${baseUrl} within ${timeoutMs} ms. Output:\n${tail()}`,
    );
  };

  async function ensure({ reuseServer = false, timeoutMs = 90_000 } = {}) {
    if (await isServing(baseUrl)) {
      if (reuseServer) {
        log(`--reuse-server: attaching to ${baseUrl} (no server will be spawned)`);
      } else {
        log(`dev server already listening on ${baseUrl}; attaching (no server will be spawned)`);
      }

      return { attached: true, owned: false };
    }

    if (reuseServer) {
      throw new ServerStartError(
        `--reuse-server was requested but nothing answers on ${baseUrl}. Start the dev server or drop the flag.`,
      );
    }

    const viteBinary = join(rootDir, "node_modules", ".bin", "vite");

    try {
      await access(viteBinary);
    } catch {
      throw new ServerStartError(
        `Vite binary not found at ${viteBinary}. Dependencies are expected to be installed already; run \`npm install\` once by hand if they are missing.`,
      );
    }

    const args = ["--port", String(port), "--strictPort", "--host", host];

    log(`starting Vite: ${viteBinary} ${args.join(" ")}`);

    child = spawn(viteBinary, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    });

    owned = true;

    child.stdout?.on("data", pushOutput);
    child.stderr?.on("data", pushOutput);
    child.on("error", (error) => {
      spawnError = error;
    });
    child.once("exit", (code, signal) => {
      exitInfo = { code, signal };
    });

    // Last-resort safety net: never leave an orphan if the process exits hard.
    process.once("exit", () => {
      if (child && exitInfo === null) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore: process is already gone
        }
      }
    });

    await waitUntilListening(timeoutMs);

    return { attached: false, owned: true };
  }

  async function stop() {
    if (stopped) {
      return { stopped: false, portFree: !(await isServing(baseUrl)) };
    }

    stopped = true;

    if (!owned || child === null || exitInfo !== null) {
      return { stopped: false, portFree: !(await isServing(baseUrl)) };
    }

    log(`stopping Vite (pid ${child.pid})`);
    child.kill("SIGTERM");

    const exitDeadline = Date.now() + STOP_GRACE_MS;

    while (exitInfo === null && Date.now() < exitDeadline) {
      await delay(100);
    }

    if (exitInfo === null) {
      log("Vite ignored SIGTERM; sending SIGKILL");
      child.kill("SIGKILL");

      const killDeadline = Date.now() + 2000;

      while (exitInfo === null && Date.now() < killDeadline) {
        await delay(100);
      }
    }

    const portDeadline = Date.now() + PORT_CLOSED_TIMEOUT_MS;
    let portFree = !(await isServing(baseUrl));

    while (!portFree && Date.now() < portDeadline) {
      await delay(150);
      portFree = !(await isServing(baseUrl));
    }

    if (portFree) {
      log(`Vite stopped; ${baseUrl} no longer answers`);
    } else {
      log(`WARNING: ${baseUrl} still answers after stopping Vite — check the process tree`);
    }

    return { stopped: true, portFree };
  }

  return {
    ensure,
    stop,
    get owned() {
      return owned;
    },
    get pid() {
      return child?.pid ?? null;
    },
    tail,
  };
}
