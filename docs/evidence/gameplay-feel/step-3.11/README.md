# Step 3.11 — Gameplay feel evidence

Recorded 2026-11-23 against `main` @ `4255bdd71c2476e6ca49af82f3511e1115dea50b`
(audit branch `feat/gameplay-feel-audit`).
Report: [`../../../GAMEPLAY_FEEL_ACCEPTANCE_AUDIT.md`](../../../GAMEPLAY_FEEL_ACCEPTANCE_AUDIT.md).

## How this was produced

```bash
node tools/capture/feel-audit.mjs --out-dir docs/evidence/gameplay-feel/step-3.11
```

One run of the DEV-only harness, which:

1. launches the **menu Prologue** through the normal gameplay lifecycle and acquires pointer lock;
2. plays it start → FINISH → Results with trusted Playwright keyboard input (all movement,
   jump, sprint, slide, vault and interact keys are real key events; route steering sets the
   camera yaw directly, which is equivalent to instant mouse look — mouse look itself is
   measured separately with real mouse deltas);
3. records a CDP screencast, the live master audio mix, the 14 key frames and per-frame
   telemetry;
4. runs the isolated probes (jump/slide/vault/wall-run/stairs/step/respawn/gamepad/perf).

Environment: Microsoft Edge via Playwright, ANGLE Metal (**Apple M1 Pro**),
1600×900 dpr 1, Medium quality (the default), headless, host load average ≈ 6.
Absolute frame rates are environment-sensitive; the static-vs-moving split and the
provenance of the cost reproduce.

## Files

| File | Content |
|---|---|
| `report.json` | every measurement + PASS/FAIL checks (route telemetry, mechanics probes, respawn fixed steps, gamepad checks, perf, audio analysis) |
| `perf-attribution.json` | the separate `--only perf` run that isolates the ambient-probe cost (read-only wrapper + a runtime-only stub; no file modified) |
| `route/route.mp4` | continuous screencast of the full Prologue run (1280×720, ~41 s, silent) |
| `route/audio.wav` | live master mix of the same run, mono 22.05 kHz 16-bit (gameplay 0–32 s, Results 32–41 s) |
| `route/01…14-*.jpg` | 1600×900 key frames: vault, slide tunnel, wall-run corridor, lower drop, stairs, skybridge, finish deck, beam, ascent, final deck, catwalk, return, finish, Results |
| `respawn/01-before-respawn.jpg`, `respawn/02-after-respawn.jpg` | real skylight kill-volume fall and the checkpoint respawn |

The raw screencast intermediate frames are deleted after encoding; `route.mp4` is the
H.264 result (CRF 28), and `audio.wav` is the mono downmix of the recorded stereo mix.

## Headline numbers

- Full run: **completed**, 0 respawns, 5/5 checkpoints, Results **00:33.889**, 0 console/page errors.
- Performance at Medium: static poses **58.6–60 fps**; moving **25.8 / 24.0 / 36.8 fps**
  (roof / corridor / catwalk). `low` 26.4 and `high` 26.3 fps on the same moving lane.
  The ambient sky-visibility probe (`RenderScene.probeSkyVisibility`, 9 rays × 98 meshes)
  runs at **27.3 Hz and 35.05 ms/call** while the camera moves; stubbing it recovers
  **26.6 → 57.8 fps**.
- Vault (fixed steps): standard `4.45 → 4.97 → 11.48 → 12.81 → 10.27 → 5.10`,
  z `−1.44 → −1.63 → −1.84 → −1.67`; speed `6.84 → 6.85 → 13.91 → 8.07`.
- Camera vertical offset: standing 0.725 m; **1.82 m** at the landing of the 3.2 m roof drop
  (+1.09 m), settling over ~0.4–0.5 s.
- Respawn: 0.000 m / 0.00 m/s phantom over 90 fixed steps; camera snaps 8.8 m; control
  returns at 6 m/s.
- Gamepad: 9/9 checks pass.

## Caveats

- No human hands or ears were used. This is instrumented browser play; the subjective
  "feel" wording in the report is grounded in the numbers and frames, but a human pass is
  still required for audio/tuning verdicts.
- Frame rates are from headless Edge on this Mac at load ≈ 6. Treat the ratios and the
  probe attribution as the finding, not the absolute fps.
- The `perf-attribution.json` stub exists only inside that diagnostic measurement; the
  game source was not modified for it.
