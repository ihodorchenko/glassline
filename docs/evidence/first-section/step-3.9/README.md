# Step 3.9 — First Section UX acceptance evidence

DEV-only browser evidence for
[`docs/FIRST_SECTION_UX_ACCEPTANCE_REPORT.md`](../../../FIRST_SECTION_UX_ACCEPTANCE_REPORT.md).
Nothing here is production code; no `src/` file was changed by this step.

## Browser and profile

| Item | Value |
|---|---|
| Browser | Microsoft Edge 157.0.4341.46, **headed** real window (Playwright `channel=msedge`) |
| Viewport | 1600 × 900, DPR 1, locale `en-US` |
| URL | `http://127.0.0.1:5325/?dev=first_section` |
| Profile | Fresh browser context per run (empty IndexedDB/localStorage) |
| Input | Trusted Playwright keyboard/mouse through the production `InputManager`; no teleports, no state edits, no tuning changes |
| Settings | Default (display quality `medium`, shipped FOV) |

## Runs

| Run | Frames | What it covers | Notes |
|---|---:|---|---|
| [`session-1/`](session-1/) | 32 | Boot sequence (`A-00-01…08`), first gameplay frame, Move, CP1 preemption + restoration, CP1 recross, Gap A edge/airborne/landing, returning-player reload | Includes the only continuous video (`session-1-playthrough.mp4`, 65.4 s, 1963 frames). Gap B and the rest of the route in this pass failed for harness reasons; they are covered by sessions 6 and 7. |
| [`session-5/`](session-5/) | 14 | Pointer-lock first-entry behaviour, real `Esc` pause, Resume without mouse look, click to recover, Gap A look-down | The browser-level lock release is emulated with `document.exitPointerLock()` because a synthetic `Esc` does not release it. |
| [`session-6/`](session-6/) | 12 | Gap A and Gap B: level view, look-down, airborne, landing, CP2 activation | Both gaps crossed, 0 respawns. |
| [`session-7/`](session-7/) | 23 | Full route: Move → CP1 → CP2 → plant step → gallery → duct/Slide → CP3 → three vaults/Vault → CP4 → finish → Results | Completes in one continuous pass; 9 notification segments. |

Each run writes `session-N-report.json` (checks, marks, per-frame pose/HUD, toast
transitions and segments, overlaps, console/page diagnostics) and
`session-N-summary.txt`.

## Totals

- 79 full-resolution JPEG frames.
- 0 console errors, 0 page exceptions, 0 failed requests (all four runs).
- 0 toast rectangles overlapping HUD elements; 0 duplicate toast DOM nodes.
- 22 visible notification segments (see the report §3).

## Reproduce

Start the dev server once (or let a harness attach to an existing one):

```bash
node_modules/.bin/vite --port 5325 --strictPort --host 127.0.0.1
```

Then, from the repository root:

```bash
node docs/evidence/first-section/step-3.9/harness/step-3.9-session.mjs    # pass 1 + video
node docs/evidence/first-section/step-3.9/harness/step-3.9-session-5.mjs  # pointer lock / pause
node docs/evidence/first-section/step-3.9/harness/step-3.9-session-6.mjs  # gaps + CP2
node docs/evidence/first-section/step-3.9/harness/step-3.9-session-7.mjs  # full route
```

Each script opens a real Edge window and drives the level with normal input.
`VIDEO=1` enables the CDP screencast for sessions 5–7 (`session-1` always records).

## What the harness must not be mistaken for

The scripts are **evidence tooling**, not a new acceptance gate and not
production code. They do not teleport, do not write gameplay state and do not
call gameplay internals to move the player; they only read the DEV status and
send Playwright input. Where an automation artefact invalidated a scenario
(unfocused window rejecting pointer lock, a synthetic `Space` occasionally not
registering, a take-off plane set past the gap lip), the pass was re-run and the
affected run discarded — see the report §8. The acceptance judgement itself is
made from the captured frames, not from the DOM assertions.
