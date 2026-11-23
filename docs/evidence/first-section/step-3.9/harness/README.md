# Step 3.9 harness — DEV evidence tooling

These Playwright scripts produced the browser evidence for
[`docs/FIRST_SECTION_UX_ACCEPTANCE_REPORT.md`](../../../../FIRST_SECTION_UX_ACCEPTANCE_REPORT.md).
They are **not production code**, **not** a new CI gate, and are not imported by
the game.

| Script | Pass |
|---|---|
| `step-3.9-session.mjs` | Session 1: boot sequence, Move → CP1 (preemption + restoration), CP1 recross, Gap A, returning-player reload; records the CDP screencast video. |
| `step-3.9-session-5.mjs` | Pointer-lock first entry, real `Esc` pause, Resume without mouse look, click to recover, Gap A look-down. |
| `step-3.9-session-6.mjs` | Gap A and Gap B edges/look-down/airborne/landing, CP2. |
| `step-3.9-session-7.mjs` | Full route to the Results screen (Move → CP1 → CP2 → plant step → gallery → duct → CP3 → vaults → CP4 → finish). |

## Design rules the scripts follow

- Real headed Edge window, 1600 × 900, fresh context per run.
- Only trusted Playwright keyboard/mouse through the production `InputManager`.
- No teleports, no gameplay state writes, no tuning changes, no authored-content
  changes.
- Screenshots are taken **at the UX moments under review**; the DOM sampler is
  instrumentation only (timing, duplicates, rectangle overlap).
- `page.bringToFront()` is required before the first click: Chromium rejects
  pointer lock with `WrongDocumentError` while the headed window is unfocused.
- A synthetic `Esc` pauses the game but does not release pointer lock; pass 5
  emulates the browser release with `document.exitPointerLock()` before clicking
  Resume.
- Jump take-off planes are set **before** the authored edge with margin; the
  harness verifies the `JUMPING` state and retries a synthetic press that did not
  register. A failed synthetic press is not a gameplay event.
