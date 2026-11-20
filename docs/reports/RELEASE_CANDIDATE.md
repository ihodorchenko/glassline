# Release candidate — final report

**Date:** 2026-11-20 · **Branch:** `feat/art-audio-level` · **Base:** `main` @
`ae63a95` (unchanged; merge is the owner's explicit decision).

**Owner verdict:** final acceptance checklist approved — **ACCEPT on every area**
(visual look, gameplay/controls/objective marker, RU/EN localization,
accessibility, audio listening, performance/stability, HUD legibility). Record:
[`FINAL_ACCEPTANCE.md`](FINAL_ACCEPTANCE.md) §5.

## What this pass delivered

1. **Look (W1):** HDR-ish grade with monotone ACES shoulder, cobalt procedural
   sky/cumulus, PCFSoft 4096 shadows, neutral sun, GTAO contact AO, no
   highlight-clip hack, reference language (white city, red route, paper/ink UI).
2. **Content language (W2/W2.2/post-G5):** transparent glass bridge rails +
   suspended load, duct/door service block, concrete stairs with red nosings,
   dense city + façade detail, sky openings, mid-deck utilities, BG façade grids,
   physical street grid below the route (8×8 blocks with markings, cars, trees,
   lamps, low buildings), sun-key shadows, prop density.
3. **Materials:** straight-tile albedo/height split (swirl-free surfaces), red
   paint roughness 0.6, glass rail tint/opacity + fresnel, clean seams.
4. **Audio:** procedural ambience/footsteps/parkour/score/radio mix measured at
   5/5 bands; human listening approved by the owner.
5. **UX:** in-world objective marker (apex-down red pyramid over the active
   target, Training lookahead, Prologue next checkpoint/finish, hidden in
   capture mode, reduced-motion static); HUD on translucent plates with
   measured ≥4.5:1 contrast; controls remapped (Shift crouch/slide, X sprint,
   E vault/interact) with «Опорный прыжок» in RU.
6. **Localization:** full EN/RU UI and content localization (295 resource keys,
   Russian plural forms, runtime switch with persistence, boot tagline, native
   language labels); world brand signage stays EN by design.
7. **Accessibility:** reduced motion, high contrast, large text,
   color-independent status (fixed wiring + markers), reduce film grain;
   keyboard-only navigation; audited end-to-end.
8. **Perf/release hygiene:** removed the interior second GTAO scene pass
   (service-block calls 227→156, tris 5.31M→3.54M), rejected decor chunking on
   evidence, measured perf gate, deterministic capture harness, final evidence
   and docs.

## Final measured state

| Gate | Result |
|---|---|
| `npm run validate` | **green** — typecheck, biome, **368/368 tests**, production build |
| Deterministic capture (6 review frames) | 6/6 accepted (5 byte-identical + GPU-LSB ≤5 px Δ1/255, D-13) |
| Headless perf proxy (`--strict`) | **6/6 PASS** (avg 60.00, 1 % low 59.52) |
| Real-window perf (headed, 120 Hz) | avg **69.91–88.67 fps** on 6/6; calm re-measure 1 % low **56.82 (service) / 57.14 (first-gap)** |
| Visual gates | G1 look closed; G2 + W2.2 blind **6/6**; canyon/rooftop **4/4**; post-G5/5.1 + UX/city accepted via guided A/B |
| Voice/listening | W4 human listening **approved by owner** |
| Compatibility | Safari route smoke run; **Firefox gameplay not yet verified** (documented) |

## Accepted limitations (documented, non-blocking)

- Mid-scale LC on five frames and finish/start top_contrast are accepted
  documented (inside the reference per-frame spread; look levers exhausted).
- Skybridge split report-only (revisit trigger > +20); service white point 7.2
  WATCH-verified; 1 % low is host-load sensitive (calm re-measure recorded).
- City-below street grid exceeds the AD's triangle/draw-call brief estimates
  (+0.59 M tris / +20–26 calls) — accepted because the binding perf gate is
  green; trimming priorities recorded in DECISIONS D-26.
- World brand signage (`RUN`, `GLASSLINE`, section numerals, `FINISH`, boot
  chrome) stays English by design; Firefox gameplay untested; static
  `index.html` boot chrome is EN (tagline localizes at boot).

## Evidence and reports

- Final review frames: [`docs/evidence/w5/`](../evidence/w5/).
- Metrics: `docs/reports/w5-metrics.*`, `postg51-metrics.*`, `ux-metrics.*`; perf:
  `w5-perf-*`, `ux-perf-headed.json`; HUD contrast: `docs/evidence/hud/`.
- Reports: [`W5_RELEASE.md`](W5_RELEASE.md), [`W5_TARGETS.md`](W5_TARGETS.md),
  [`W2_ITERATION.md`](W2_ITERATION.md), [`BLIND_REVIEW_W2.md`](BLIND_REVIEW_W2.md),
  [`UX_CITY_TARGETS.md`](UX_CITY_TARGETS.md), [`BASELINE.md`](BASELINE.md),
  [`DECISIONS.md`](DECISIONS.md), [`FINAL_ACCEPTANCE.md`](FINAL_ACCEPTANCE.md).
- Machine status: [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md).

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173/
npm run preview    # http://127.0.0.1:4173/ (after npm run build / validate)
npm run validate   # typecheck + lint + tests + build
node tools/capture/capture.mjs --iteration final --shot all   # deterministic frames
node tools/capture/perf.mjs --shot all --json perf.json --strict
```

## Open decision

Nothing is merged to `main`; the working branch is ready. The owner decides
merge timing/strategy (fast-forward, squash, or PR) — no further code changes
are queued except the documented optional polish.
