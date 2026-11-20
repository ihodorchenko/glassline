# W5 — release hygiene and final evidence

**Date:** 2026-11-20 · **Branch:** `feat/art-audio-level` (nothing merged to `main`).
**Scope:** plan §6 W5 + the accepted-residual register from
[`W2_TARGETS.md`](W2_TARGETS.md) §8 (DECISIONS D-20). This is the release-candidate
record for the art/audio/level pass; the binding look gate remains the blind
review, human acceptance remains the owner's.

## 1. What W5 delivered

| Line | Change | Evidence |
|---|---|---|
| Perf (rendering) | Removed the second interior ambient GTAO pass and its composite; the interior look is now one cheap global modulation inside the grade pass (`dimWeight` by luma, neutral bounce, weight 0.85; deterministic activation, one code path). service-block 227 calls / 5.31 M tris → **156 / 3.54 M**; open frames 117–168 / 3.51–3.54 M | `w5-perf-headed.json`, `w5-perf-headless.json` |
| Perf (negative result) | Decor/static-batch spatial chunking measured and **rejected**: +2–4× draw calls, 0 fps, non-pixel-identical; `LevelContentLoader.ts` returned to HEAD | perf-opt report (task-40) |
| Content (AD-6) | +13 density clusters (AC/vent/pipe/tray + contact shadows) on open decks and 2 service pipe-runs, rooftop masts/caps on 11 BG towers, denser BG facade grids (spandrel 3 m, windows 1.5 m, mullions), 4 underside props on first-gap, gantry posts + diagonal cables in the start angle; decorations 3101→5965 | `captures/w5-final`, metrics below |
| Materials (AD-6) | Glass-rail opacity 0.32 with fresnel falloff to 0.22 at grazing (structure reads through, no milkiness) | `w5-metrics.md`, materials report |
| Accessibility | New `accessibility.reduce_grain` (default off, pixels unchanged at default) wired to the post pipeline; found and fixed `accessibility.color_independent_status` (was defined/UI-localized but never applied — now non-colour markers for training results and the active settings tab); audited reduced-motion / high-contrast / large-text end-to-end; audio-reactivity documented (no audio-reactive visuals exist; `reduced_motion` + audio mute/volume cover intent); 9 new tests (suite 293→302) | `accessibility-audit.json`, a11y report |
| Hygiene | `npm run validate` green (typecheck, biome, **302/302 tests**, production build); determinism **6/6 byte-identical**; docs current | this file, DECISIONS D-21 |

## 2. Final numbers

Shifted-band PASS (traceability; family windows are the reading): **50/78**
(W2.2 final 49, baseline rev2 28). Per shot: start-roof 9, first-gap 10,
wallrun-corridor 8, service-block 6, skybridge 10, finish-roof 7.
Tolerance gauge: 58/78.

Guardrails: plateau/pure255 = 0; seam 0.0031–0.0044 (WATCH window); white point
open frames ≤6, **service-block 7.2 = WATCH** (AD-approved with a fix trigger);
sky-mask start 12.8 / finish 8.4 / skybridge 5.9 (override 522) / first-gap 5.5 /
wallrun 1.5 (within amended windows) / service 3.5 report-only; red continuity
continuous lines, component ≥0.25.

Perf, real window (headed Edge, 120 Hz display, 1600×900 high): avg
**68.95–94.22 fps on 6/6 poses** (all ≥55); 1 % low **56.8–57.8** (wallrun
re-measured 57.47 at load 5.4; service 56.82) — the previous wallrun 40.98 was
host load. Headless `perf.mjs --strict`: **6/6 PASS** (avg 60.00, 1 % low 59.52,
p95 ≈16.7 ms). Caveat recorded: headless rAF is capped ≈60 Hz and headed fps
above 60 reflects the 120 Hz display; 1 % low is measurement-sensitive to host
load.

Accepted documented residuals (AD-6 fallback; inside reference per-frame
spread or structurally unavailable without unfreezing frozen levers):
mid-scale LC on start/first-gap/skybridge/finish/service, top_contrast on
finish/start, split family readings (gap/wallrun/finish inside −42.5…−13.2),
skybridge split report-only (trigger > +20), service white point WATCH (trigger
if the blind flags a cast).

## 3. Blind gate

**6/6 PASS** on the final blind set (same reference anchors as W1/W2;
W2.2 frames were not in the set). Canyon/rooftop regression check: **4/4 PASS**
(start-roof, first-gap, skybridge, finish-roof satisfy depth / continuous-red /
BG-detail plus 5 optional criteria each). The white-point WATCH on service-block
was verified visually as neutral-cool — the fix trigger did not fire. Guided
side-by-side W2.2 → W5 showed no blocking regressions and no hacks.

**G5 is closed** (AD verdict, 2026-11-20) with the residual register below.
Residuals and the do-not-claim list are documented, not silently closed. The
final gate record: `npm run validate` green (302 tests), determinism 6/6
byte-identical, blind 6/6, no frame lost more than one shifted band versus W2.2
(50/78 vs 49/78), perf gate met (headed avg 68.95–94.22 on 6/6, service 1 % low
56.8; wallrun calm re-measure 57.47 at load 5.4), a11y audit closed.

**Post-G5 follow-up register (documented limitations, AD verdict):** mid-scale
LC on start/first-gap/skybridge/finish/service; top_contrast finish/start;
skybridge split report-only (revisit trigger > +20); service white point 7.2
(WATCH-verified, trigger if a future capture flags a cast); cosmetic nudges
(underside +2 props, grille/flanges, gantry cable Ø, finish pipe-run shift,
spandrel contrast); headless rAF caveat; Firefox unverified; W4 human listening
still open. None of these reopens G5; they are the documented next steps.

## 4. Do-not-claim (AD-6)

Photorealism or reference equivalence (only the language is targeted); real FPS
outside the measured headed set; Safari/Firefox gameplay (Safari only the route
run, Firefox untested); human listening acceptance (W4 listening remains open);
"metrics = win" (blind is binding); closing the accepted LC/tc residuals;
copying reference frames.

## 5. Owner acceptance checklist (manual)

1. Start the dev or preview server (lead can start either) and play the
   Prologue start→finish; verify: route readability (red line, hazards),
   checkpoint flow, no visual holes, HUD readable.
2. Look at the six review frames (`docs/evidence/w5/`) against the reference
   language (`ref/reference/prolog-kit/study/05-prologue-roofs/`).
3. Listen to the six audio layers (W4): wind/ambience, footsteps by surface,
   parkour one-shots, score, radio, UI; confirm no clipping and layer separation.
4. Check accessibility toggles in Settings → Accessibility (reduced motion,
   high contrast, large text, color-independent status, reduce film grain).
5. Confirm FPS feels stable at high quality in a real window (the headed probe
   is the numeric proxy).

## 6. Evidence index and reproduction

- Frames: `captures/w5-final/` (regenerable) and committed JPEGs in
  [`docs/evidence/w5/`](../evidence/w5/).
- Metrics: [`w5-metrics.md`](w5-metrics.md) / `.json` (skybridge `--horizon-px 522`).
- Perf: [`w5-perf-headed.json`](w5-perf-headed.json),
  [`w5-perf-headless.json`](w5-perf-headless.json).
- Reproduce:
  ```bash
  node tools/capture/capture.mjs --iteration w5-final --shot all
  PY=/Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
  $PY tools/capture/metrics.py --candidate captures/w5-final --bands --guardrails \
      --horizon-px "skybridge:522" --json docs/reports/w5-metrics.json
  node tools/capture/perf.mjs --shot all --json docs/reports/w5-perf-headless.json --strict
  node tools/capture/perf.mjs --shot all --json docs/reports/w5-perf-headed.json --headed
  npm run validate
  ```
- Gate history: [`BASELINE.md`](BASELINE.md) (G0), [`W1_ITERATION.md`](W1_ITERATION.md)
  (G1), [`BLIND_REVIEW_W2.md`](BLIND_REVIEW_W2.md) (G2), [`W2_ITERATION.md`](W2_ITERATION.md)
  §7 (W2.2), this file (G5). Decisions: [`DECISIONS.md`](DECISIONS.md).

## 7. Post-G5 pass — cosmetic register closed + Russian localization (2026-11-20)

Owner request after G5: finish the post-G5 cosmetic register and add Russian
localization with an RU/EN switch in Settings.

### 7.1 Cosmetics (all register items closed)

| Item | Result |
|---|---|
| first-gap underside | +2 props (vent + AC) and coping on the FG under-roof — underside reads as a dressed roof |
| wallrun grille | recessed another 0.05 m, light steel louvers (0x9aa0a4 class) + visible frame — reads as a vent, not a dark block |
| pipe-run flanges | sphere-ish "mushrooms" replaced by flat discs (0.05 m thick, −20 % diameter) in service-block MG-left and wallrun FG-right |
| gantry stay cables | Ø0.02 → Ø0.03 against the sky |
| finish-roof FG pipe-run | shifted +0.5 m right / out of the bottom frame edge |
| BG spandrel contrast | thin towers (<18 m): dark spandrel bands + light windows, Δluma ≥0.15; heights/silhouettes unchanged |
| glass-rail grazing | alpha falloff 0.22 → 0.18 (mean \|panel−background\| 77.33 → 73.96; panel still 23.9 luma darker than background, structure reads through) |

Re-captured final frames `captures/postg5-final` → determinism **6/6
byte-identical**, shifted **50/78** (unchanged), guardrails unchanged
(sky-mask / red continuity / seam as in §2), headless perf `--strict`
**6/6 PASS** (worst avg 60.00 at load 4.4). Evidence refreshed in
[`docs/evidence/w5/`](../evidence/w5/) and metrics in
[`postg5-metrics.md`](postg5-metrics.md); perf in [`postg5-perf.json`](postg5-perf.json).
The AD reviewed the W5 final ↔ post-G5 side-by-side (A/B) and the cosmetics are
recorded as closed; no new look or content risks were introduced.

### 7.2 Russian localization with RU/EN switch

- **`ru` language shipped:** registry entry (native label «Русский», locale
  `ru-RU`, ltr), `src/localization/resources/ru.ts` with **212 keys** — zero
  missing/extra keys, placeholders and plural categories verified (Russian
  one/few/many/other; e.g. «1 попытка / 2 попытки / 5 попыток»).
- **Switch:** Settings → Язык / Language (enum `general.language` = en/ru with
  native labels); switching applies immediately without reload, re-renders the
  visible screen, sets `documentElement.lang`, and persists (verified in the
  live dev server: 21/21 checks, 0 console errors; RU survives reload, back to
  EN restores English).
- **Hardcoded strings localized:** loading network/detail lines, results
  incomplete/attempts (plural), medals (`gold/silver/bronze/none`), records date
  by locale, session-start error, language labels.
- **Tests:** 20 new localization-RU tests (structure, placeholders, plurals,
  switching, settings enum, UI re-render) → **322 tests**, `npm run validate`
  green. Evidence: [`docs/evidence/i18n/`](../evidence/i18n/) (EN/RU screenshots
  + `switch-report.json`).
- **Follow-up (content-owned, still English):** training exercise
  titles/objectives, level/checkpoint display names and the pre-localization
  boot screen. In-world brand signage (`RUN`, `GLASSLINE`) stays English by
  design (branding, confirmed by the art director). Tracked in DECISIONS D-22.

### 7.3 Content-string localization (follow-up from §7.2 closed)

The remaining content-owned English strings are localized with the same EN/RU
architecture (authored English stays as a fallback, deterministic keys derive
from stable content ids, resolution happens at the UI boundaries):

- **Training:** 10 exercise titles, 10 descriptions and 23 objective
  descriptions (43 keys), resolved in HUD title/objective and results.
- **Levels:** level names (2), route name, section names (8) and checkpoint
  names (8) for Prologue and Training, resolved in HUD section/split labels,
  checkpoint toast, results splits and the speedrun route builder; interaction
  prompts (2) resolved in the HUD prompt.
- **Boot screen:** 9 stage labels/details + error label detected from
  `navigator.language` (`ru*` → Russian, otherwise English) because settings are
  not loaded at boot; boot timing/behavior unchanged.
- **Totals:** resources now **295 keys** in both en and ru (212 → 295).
  Content-key coverage, EN-equals-authored drift, no-stale-keys, language-switch
  and route-with-resolver tests added → **334 tests**, `npm run validate` green.
- **Live verification:** Playwright against the dev server with `ru-RU` and
  `en-US` contexts: **35/35 checks, 0 console errors**, covering boot stages,
  Training HUD, interaction prompt, checkpoint toast, HUD section splits and
  results splits; screenshots + report in
  [`docs/evidence/i18n-content/`](../evidence/i18n-content/). The six review
  frames stayed **byte-identical** to the post-G5 capture (UI-only change).
- **Still English by design:** in-world brand/decor signage (`RUN`,
  `GLASSLINE`, section numerals, `FINISH`, `MOVEMENT YARD`), the static
  pre-localization `index.html` boot chrome, and developer console/status
  overlay. `level.metadata.description` is not displayed anywhere.

Also fixed a pre-existing results nit found during the checks: the split list no
longer shows double numbering (`1.` from the `<ol>` plus a manual prefix).
