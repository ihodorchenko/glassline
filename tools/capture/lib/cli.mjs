/**
 * Command-line surface for the deterministic capture harness.
 *
 * Two modes share one flag set:
 * - capture mode (default): `--iteration`, `--shot`, deterministic `?capture=1`
 *   pages that the app exposes through `window.__glasslineCapture`.
 * - legacy one-off mode (`--out <file>`): drive the dev handle
 *   (`window.__glassline`) directly, exactly like the old CDP script.
 */

export const DEFAULT_SERVER_PORT = 5199;
export const DEFAULT_WIDTH = 1600;
export const DEFAULT_HEIGHT = 900;
export const DEFAULT_READY_TIMEOUT_MS = 60_000;
export const DEFAULT_SERVER_TIMEOUT_MS = 90_000;

const HELP_LINES = [
  "Usage:",
  "  node tools/capture/capture.mjs [options]                 # deterministic capture mode",
  "  node tools/capture/capture.mjs --out <file.png> [legacy] # one-off frame through window.__glassline",
  "",
  "Capture mode (default):",
  "  --iteration <id>       Evidence folder under captures/ (default w0)",
  "  --shot <id|all>        Shot id from window.__glasslineCapture.shots, or all (default all)",
  "  --level <id>           Level query parameter (default prologue)",
  "  --frames <n>           Extra requestAnimationFrame frames after apply() (default 30)",
  "  --json <path>          Also write the machine-readable report to <path>",
  "  --verify-determinism   Capture twice and require identical sha256 per shot",
  "  --no-verify-determinism  Disable the double capture (on by default for --shot all)",
  "",
  "Legacy one-off mode:",
  "  --out <file>           Write a single PNG frame and exit (no manifest)",
  "  --mode <mode>          training | prologue | speedrun (default prologue)",
  "  --pos x,y,z            Teleport the player before the frame",
  "  --yaw <radians>        Camera yaw (default 0)",
  "  --pitch <radians>      Camera pitch (default 0)",
  "  --wait <ms>            Settle time after the last action (default 2500)",
  "  --menu                 Capture the main menu instead of starting gameplay",
  "  --settings             Open the settings screen before capture",
  "  --run <ms>             Hold sprint for <ms> while settling",
  "",
  "Server and browser:",
  "  --server-port <port>   Vite port (default 5199; alias --port)",
  "  --url <url>            Base URL (default http://127.0.0.1:<server-port>/)",
  "  --reuse-server         Never spawn Vite; fail unless something serves --url",
  "  --headless             Run Edge headless (default)",
  "  --headed               Run Edge with a visible window",
  "  --width <px>           Viewport width (default 1600)",
  "  --height <px>          Viewport height (default 900)",
  "  --ready-timeout <ms>   Wait budget for the capture contract (default 60000)",
  "  --server-timeout <ms>  Wait budget for Vite readiness (default 90000)",
  "  --strict-console       Treat console errors as failures",
  "  --close                Accepted for compatibility; the browser is always closed",
  "  --help                 Show this help",
];

export class UsageError extends Error {}

function fail(message) {
  throw new UsageError(message);
}

function readNumber(value, flag, { integer = false, min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    fail(`${flag} expects a finite number, got "${value}"`);
  }

  if (integer && !Number.isInteger(number)) {
    fail(`${flag} expects an integer, got "${value}"`);
  }

  if (number < min || number > max) {
    fail(`${flag} must be between ${min} and ${max}, got ${value}`);
  }

  return number;
}

function readId(value, flag) {
  const id = String(value ?? "").trim();

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    fail(`${flag} expects [A-Za-z0-9._-]+, got "${value}"`);
  }

  return id;
}

function readPosition(value, flag) {
  const parts = String(value)
    .split(",")
    .map((part) => Number(part.trim()));

  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    fail(`${flag} expects three comma-separated numbers, got "${value}"`);
  }

  return parts;
}

export function parseArgs(argv) {
  const options = {
    help: false,
    iteration: "w0",
    shot: "all",
    out: null,
    serverPort: DEFAULT_SERVER_PORT,
    url: null,
    reuseServer: false,
    headless: true,
    frames: 30,
    json: null,
    mode: "prologue",
    level: "prologue",
    pos: null,
    yaw: 0,
    pitch: 0,
    wait: 2500,
    menu: false,
    settings: false,
    run: 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    verifyDeterminism: null,
    readyTimeout: DEFAULT_READY_TIMEOUT_MS,
    serverTimeout: DEFAULT_SERVER_TIMEOUT_MS,
    strictConsole: false,
    close: false,
  };

  let serverPortExplicit = false;
  const legacyFlagsUsed = [];

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    let flag = raw;
    let inlineValue = null;
    const equals = raw.indexOf("=");

    if (raw.startsWith("--") && equals !== -1) {
      flag = raw.slice(0, equals);
      inlineValue = raw.slice(equals + 1);
    }

    const value = (name = flag) => {
      if (inlineValue !== null) {
        return inlineValue;
      }

      const next = argv[index + 1];

      if (next === undefined) {
        fail(`${name} requires a value`);
      }

      index += 1;
      return next;
    };

    switch (flag) {
      case "--iteration":
        options.iteration = readId(value(), flag);
        break;
      case "--shot": {
        const shot = value();
        options.shot = shot === "all" ? "all" : readId(shot, flag);
        break;
      }
      case "--out":
        options.out = value();
        break;
      case "--server-port":
      case "--port":
        options.serverPort = readNumber(value(), flag, { integer: true, min: 1, max: 65_535 });
        serverPortExplicit = true;
        break;
      case "--url":
        options.url = value();
        break;
      case "--level":
        options.level = readId(value(), flag);
        break;
      case "--reuse-server":
        options.reuseServer = true;
        break;
      case "--headless":
        options.headless = true;
        break;
      case "--headed":
        options.headless = false;
        break;
      case "--frames":
        options.frames = readNumber(value(), flag, { integer: true, min: 0, max: 600 });
        break;
      case "--json":
        options.json = value();
        break;
      case "--mode":
        legacyFlagsUsed.push("--mode");
        options.mode = readId(value(), flag);
        break;
      case "--pos":
        legacyFlagsUsed.push("--pos");
        options.pos = readPosition(value(), flag);
        break;
      case "--yaw":
        legacyFlagsUsed.push("--yaw");
        options.yaw = readNumber(value(), flag);
        break;
      case "--pitch":
        legacyFlagsUsed.push("--pitch");
        options.pitch = readNumber(value(), flag);
        break;
      case "--wait":
        legacyFlagsUsed.push("--wait");
        options.wait = readNumber(value(), flag, { min: 0, max: 600_000 });
        break;
      case "--menu":
        legacyFlagsUsed.push("--menu");
        options.menu = true;
        break;
      case "--settings":
        legacyFlagsUsed.push("--settings");
        options.menu = true;
        options.settings = true;
        break;
      case "--run":
        legacyFlagsUsed.push("--run");
        options.run = readNumber(value(), flag, { min: 0, max: 600_000 });
        break;
      case "--width":
        options.width = readNumber(value(), flag, { integer: true, min: 1, max: 8192 });
        break;
      case "--height":
        options.height = readNumber(value(), flag, { integer: true, min: 1, max: 8192 });
        break;
      case "--verify-determinism":
        options.verifyDeterminism = true;
        break;
      case "--no-verify-determinism":
        options.verifyDeterminism = false;
        break;
      case "--ready-timeout":
        options.readyTimeout = readNumber(value(), flag, { integer: true, min: 1000 });
        break;
      case "--server-timeout":
        options.serverTimeout = readNumber(value(), flag, { integer: true, min: 1000 });
        break;
      case "--strict-console":
        options.strictConsole = true;
        break;
      case "--close":
        options.close = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        fail(`Unknown argument: ${flag}`);
    }
  }

  if (options.help) {
    return options;
  }

  if (options.url) {
    let parsed;

    try {
      parsed = new URL(options.url);
    } catch {
      fail(`--url is not a valid URL: ${options.url}`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      fail(`--url must be http(s), got ${parsed.protocol}`);
    }

    if (!serverPortExplicit && parsed.port) {
      options.serverPort = Number(parsed.port);
    }
  }

  if (options.out !== null && options.out.trim() === "") {
    fail("--out must be a non-empty path");
  }

  options.viewport = { width: options.width, height: options.height };
  options.legacy = options.out !== null;
  options.legacyFlagsUsed = legacyFlagsUsed;
  options.shotMode = options.shot === "all" ? "all" : "single";

  if (options.verifyDeterminism === null) {
    options.verifyDeterminism = !options.legacy && options.shotMode === "all";
  }

  return options;
}

export function printHelp() {
  console.log(HELP_LINES.join("\n"));
}
