# Final acceptance package — release candidate

**Date:** 2026-11-20 · **Branch:** `feat/art-audio-level` (41 commits; `main` untouched)
**Scope:** owner acceptance of the art/audio/level pass + the post-G5 iterations
(cosmetics, RU localization, controls remap, objective marker, city-below streets).
The automated gates are green; the remaining gates are **human** (visual, audio
listening, gameplay feel).

## 1. How to run it

| Server | URL | What it is |
|---|---|---|
| Dev (live HMR) | **http://127.0.0.1:5173/** | current source, hot reload |
| Preview (production build) | **http://127.0.0.1:4173/** | built bundle, closest to release |

Both servers are running as managed background jobs. Controls (defaults):
`WASD` move · `Space` jump · **`Shift` crouch** (while running → slide) ·
**`X` sprint** · `E` vault/interact · `Esc` pause · `R` restart · arrows/gamepad navigate.

## 2. Automated state (what is already proven)

- `npm run validate`: typecheck + biome + **368/368 tests** + production build —
  green.
- Deterministic capture harness: 6/6 review frames accepted (5 byte-identical +
  GPU-LSB ≤5 px Δ1/255, D-13 tolerance), final set `captures/ux-final2`.
- Perf proxy: headless `perf.mjs --strict` **6/6 PASS**; real window (headed
  Edge, 120 Hz): avg **69.91–88.67 fps on 6/6**, calm re-measure 1 % low
  **56.82 (service) / 57.14 (first-gap)**.
- Gates: G0 baseline, G1 look, G2 content language, G3 level, G4 audio foundation
  (numeric), **G5 release hygiene closed**; post-G5, post-G5.1, RU/localization,
  controls remap and UX/city iterations were all accepted by the art director
  (guided A/B; blind where required). Records: [`W5_RELEASE.md`](W5_RELEASE.md),
  [`DECISIONS.md`](DECISIONS.md), [`W2_ITERATION.md`](W2_ITERATION.md),
  [`BLIND_REVIEW_W2.md`](BLIND_REVIEW_W2.md), [`UX_CITY_TARGETS.md`](UX_CITY_TARGETS.md).
- Reference frames: [`docs/evidence/w5/`](../evidence/w5/) (6 × 1600×900 JPEG);
  RU/EN + boot + marker / city crops: [`docs/evidence/i18n/`](../evidence/i18n/),
  [`docs/evidence/i18n-content/`](../evidence/i18n-content/),
  [`docs/evidence/ux/`](../evidence/ux/).

## 3. Acceptance checklist (owner)

### A. Boot, menu, language
- [ ] Boot screen appears and finishes without errors; brand stays EN by design.
- [ ] Settings → **Язык** / Language: switch EN ↔ Русский — applies immediately
      (no reload), persists after reload, `documentElement.lang` follows,
      content strings (Training titles/objectives, level/section/checkpoint
      names, prompts, results splits) switch too; world brand signage stays EN.
- [ ] Narrow window 1280×720 + large text: language value chip readable, no
      wrapping/clipping.

### B. Training + controls + objective marker
- [ ] Enter Training: an **objective marker** (red pyramid, apex down, ring on
      the floor) is visible immediately over the first target and moves with the
      current objective; it disappears when the objective completes and appears
      over the next one.
- [ ] `Shift` crouches (camera lowers; posture), `X` sprints (FOV/speed);
      `Shift` while running slides; `E` performs the **«Опорный прыжок»** near a
      low obstacle and opens terminals.
- [ ] HUD title/objective/hints are Russian (in RU), tutorial step for vault
      reads «Опорный прыжок».
- [ ] Reduced motion: with `accessibility.reduced_motion` on, the marker is
      static (no bob/rotation) and menu drift is off.

### C. Prologue run (start → finish)
- [ ] Marker points to the next checkpoint, then to the FINISH gate in the final
      section; disappears after finishing.
- [ ] Full run is completable: start roof → gap → stair climb → skybridge →
      service block → finish; checkpoints activate, timer/splits work, results
      valid.
- [ ] Looking down from the roofs/skybridge: **streets below** (blocks,
      carriageways, dashes, crosswalks, sidewalks/curbs, cars, trees, lamps) —
      no empty flat plate; far city stays in haze.
- [ ] Route readability: red line/handrails/nosing/hazard plate lead the eye;
      no visual holes, no floating props in view.

### D. Accessibility + settings
- [ ] Reduced motion, High contrast, Large text, Color-independent status
      (✓/✗ markers, ▸ active tab), Reduce film grain — each applies immediately
      and persists after reload.
- [ ] Audio: master/music/sfx/ui volumes + mute apply immediately.
- [ ] Stats/records/achievements screens render without clipping in RU and EN.

### E. Audio (human listening — the open G4 item)
- [ ] Six layers distinguishable: ambience/wind + city, footsteps by surface
      (concrete/deck/metal), parkour one-shots (jump/land/vault/slide/wall),
      sparse score, radio/interaction cues, UI.
- [ ] No clipping/distortion; balance acceptable at default volumes; high-route
      wind vs ground ambience difference is audible.

### F. Performance & stability
- [ ] High quality, real window: movement feels stable; note any dips (pose /
      place) — compare with the measured proxy above.
- [ ] 10+ minutes of play without crashes, console errors or broken saves;
      reload keeps progress/records/settings.

### G. Visual review against the reference language
- [ ] Compare the six review frames (`docs/evidence/w5/`) with the reference
      study `ref/reference/prolog-kit/study/05-prologue-roofs/`: white city,
      cobalt sky/cumulus, red route, seams/shadows, glass/parallax, paper/ink
      UI — language matches, not frame copying.
- [ ] Accepted residuals (do not block acceptance): mid-scale LC on five frames,
      top_contrast finish/start, skybridge split report-only, service white
      point WATCH, city tris/draw-call overrun (perf gate is the binding one).

## 4. Known limitations (documented, not blockers)

- **W4 human listening** is the only open gate — checklist §E.
- **Firefox gameplay untested**; Safari only the route smoke run.
- Accepted-documented metric residuals (LC/top_contrast/split/white point) as in
  `W5_RELEASE.md` §2 and D-21; the city budget overrun accepted in D-26.
- Optional post-acceptance nits: car windshields/wheel stubs, block-roof tone
  variation, marker occasionally overlaps the MOVEMENT YARD banner edge, boot
  footer «PROLOGUE / ROOFTOP RUN» stays EN during a RU boot, world brand signage
  EN by design.
- `main` has not been merged; the pass lives on `feat/art-audio-level` (owner
  decides merge timing).

## 5. Verdict (owner)

- Visual look (six review frames): ☐ ACCEPT ☐ ACCEPT WITH NOTES ☐ REJECT
- Gameplay/controls/marker: ☐ ACCEPT ☐ ACCEPT WITH NOTES ☐ REJECT
- RU/EN localization: ☐ ACCEPT ☐ ACCEPT WITH NOTES ☐ REJECT
- Accessibility: ☐ ACCEPT ☐ ACCEPT WITH NOTES ☐ REJECT
- Audio (listening): ☐ ACCEPT ☐ ACCEPT WITH NOTES ☐ REJECT
- Performance/stability: ☐ ACCEPT ☐ ACCEPT WITH NOTES ☐ REJECT
- **Overall:** ☐ ACCEPT ☐ ACCEPT WITH NOTES ☐ REJECT

Notes / blockers found:
```
(owner)
```
