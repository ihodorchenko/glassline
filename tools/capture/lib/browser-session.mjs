/**
 * Playwright/Edge session management for capture runs.
 *
 * One browser per run; one isolated context per shot so localStorage, caches
 * and previous captures cannot leak between frames (a determinism requirement).
 * Everything the page logs is collected per page and folded into the report.
 */

import { chromium } from "playwright";

const NAVIGATION_TIMEOUT_MS = 60_000;
const MAX_DIAGNOSTIC_ENTRIES = 40;

function pushBounded(list, entry) {
  list.push(entry);

  if (list.length > MAX_DIAGNOSTIC_ENTRIES) {
    list.shift();
  }
}

/**
 * Attaches console/pageerror/requestfailed listeners to a page.
 * The returned object stays live for the page lifetime.
 */
export function attachDiagnostics(page) {
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    const type = message.type();

    if (type === "error") {
      pushBounded(consoleErrors, message.text());
    } else if (type === "warning") {
      pushBounded(consoleWarnings, message.text());
    }
  });

  page.on("pageerror", (error) => {
    pushBounded(pageErrors, error?.stack ?? error?.message ?? String(error));
  });

  page.on("requestfailed", (request) => {
    pushBounded(
      failedRequests,
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown failure"}`,
    );
  });

  return {
    consoleErrors,
    consoleWarnings,
    pageErrors,
    failedRequests,
    snapshot() {
      return {
        consoleErrors: [...consoleErrors],
        consoleWarnings: [...consoleWarnings],
        pageErrors: [...pageErrors],
        failedRequests: [...failedRequests],
      };
    },
    dump() {
      const lines = [];

      if (pageErrors.length > 0) {
        lines.push(`Uncaught page errors (${pageErrors.length}):`);

        for (const entry of pageErrors.slice(-5)) {
          lines.push(`  • ${entry.split("\n").slice(0, 8).join("\n    ")}`);
        }
      }

      if (consoleErrors.length > 0) {
        lines.push(`Console errors (${consoleErrors.length}):`);

        for (const entry of consoleErrors.slice(-10)) {
          lines.push(`  • ${entry}`);
        }
      }

      if (failedRequests.length > 0) {
        lines.push(`Failed requests (${failedRequests.length}):`);

        for (const entry of failedRequests.slice(-5)) {
          lines.push(`  • ${entry}`);
        }
      }

      return lines.join("\n");
    },
    clear() {
      consoleErrors.length = 0;
      consoleWarnings.length = 0;
      pageErrors.length = 0;
      failedRequests.length = 0;
    },
  };
}

/** Launches Microsoft Edge through Playwright's `msedge` channel. */
export async function launchBrowser({ headless, log }) {
  log(`launching Microsoft Edge (playwright channel=msedge, headless=${headless})`);

  const browser = await chromium.launch({ channel: "msedge", headless });
  const version = await browser.version();

  log(`Edge ${version} ready`);

  return {
    browser,
    version,
    info: { name: "Microsoft Edge", channel: "msedge", version },
  };
}

/**
 * Runs `callback` with a fresh browser context and a fresh page.
 * The context is always closed; diagnostics are captured before teardown.
 */
export async function withIsolatedPage(browser, { width, height }, callback) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  try {
    const page = await context.newPage();
    const diagnostics = attachDiagnostics(page);

    return await callback({ page, diagnostics });
  } finally {
    await context.close().catch(() => {
      // closing a crashed page can reject; nothing useful to do here
    });
  }
}

export { NAVIGATION_TIMEOUT_MS };

/** Navigates and waits for DOMContentLoaded; the app boots after that. */
export async function navigate(page, url, log) {
  log(`open ${url}`);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: NAVIGATION_TIMEOUT_MS,
  });
}
