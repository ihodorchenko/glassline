# W5_TARGETS — release hygiene, residual policy, G5

**Author:** art director (`qwen-token-plan/qwen4-max`), recorded by lead.
**Date:** 2026-11-20. **Recorded from:** task AD-6 (`task-39`).

Look is frozen at the W2.2 final values: contrast 0.68, shadowTint
(0.94, 1.00, 1.10), exposure 1.65, knee 0.92, GTAO blend 0.70. Look unfreeze is
**not authorised** (W2.2 look levers gave only +0.002–0.005).

## 1. Residual register

| Residual | Decision | Exact levers / target |
|---|---|---|
| mid-scale LC 0.237–0.257 (target ≥0.274) | **fix via content**, fallback accept | +3–5 prop clusters per open deck (start-roof, first-gap, skybridge, finish-roof): AC 1.6×1.0×1.2, vent 1.2×0.9×0.8, pipe-run Ø0.15×6, cable-tray 0.3×0.1×8; outside the route line and sightline, with shadows. service-block: +2 pipe-runs on ceiling/walls. Target LC ≥0.274 (service ≥0.240). If one final capture does not reach it → **accept as documented limitation**, no look unfreeze, no second iteration |
| top_contrast finish 0.189 / start 0.229 (target ≥0.235) | **fix via content**, fallback accept | rooftop masts/antennas/AC caps on BG towers in the upper third: 2–4 elements per tower (mast Ø0.1×3–5 m, cap 0.8×0.4×0.6). Target tc ≥0.235; otherwise accept (structurally sky+gate) |
| split gap −34.9 / wallrun −29.5 / finish −33.7 | **accept documented** | family window −42.5…−13.2 (= reference p10…shifted upper); all three inside the reference per-frame spread; no action |
| skybridge +12.5 / service −1.3 split | **accept documented, report-only** | mechanism = shaded route red in the dark mask. Revisit trigger: skybridge split > +20 → content fix (strip out of the gantry shadow or a local shadow), not tint |
| service 1 % low 45 fps | **fix now, perf line** | spatial chunking of static batches; target 1 % low ≥55 headed; pixels byte-identical → no re-blind needed for this line |

Anti-hack boundary for the content fixes: no collider/trigger/route/sightline
changes, no tower height/silhouette changes, no black-paint "depth"; LC/tc gains
must come with 8–15 % shadow coverage, seam ±0.001, plateau ≤1.5 %, white point
|R−B| ≤6.

## 2. Cosmetics — authorised; "enough for W5" = all four in one pass

| Item | Exact target | Sufficiency |
|---|---|---|
| glass-rail opacity at grazing | opacity 0.35→**0.32** (fresnel-weighted at grazing), tint #1a2530 unchanged | structure under the glass (parapet/coping/riser/plant) reads at 100 % zoom, no milkiness at grazing |
| denser BG grids | spandrel bands + mullions on cut/ring towers: Δluma bands ≥0.15, pitch 1.5×3 m; heights/silhouettes unchanged | BG masses read as authored facades at 100 % zoom, no blank slabs |
| first-gap underside props | **4 props** on the lower-roof FG underside: vent 1.2×0.9×0.8 ×2, AC 1.6×1.0×1.2 ×1, pipe-run Ø0.15×4 ×1; z −24…−30, x ±6…10 + coping caps; no colliders | underside reads as a dressed roof, not a pale plane |
| gantry supports in the start angle | **2 posts 0.12×0.12×4 + 2 diagonal cables Ø0.02** at the beam ends in start MG; if the posts cut the sightline — remove the beam entirely (one of the two options, not both) | beam reads as a load-bearing structure, not a floating strip |

All four cosmetics + the LC/tc content fixes = **one integration → one final
capture → one blind re-run**. No second iteration: if LC/tc still fall short
after this pass they are accepted documented. The perf and a11y lines do not
change pixels and do not enter the blind.

## 3. G5 acceptance checklist

- Final blind: **6 pairs**; PASS overall = **≥5/6** with mandatory **4/4
  canyon/rooftop** (start-roof, first-gap, skybridge, finish-roof: (a) depth
  reads without black void, (b) a continuous red element leads the eye, (c) BG
  masses carry facade detail + ≥3 optional: geometric sky in window with
  cobalt/cumulus, deck seams + prop shadows 8–15 %, clean silhouette against sky,
  glass reflection gradient, no emissive/void/swirl).
- **0 regressions >1 shifted band** vs the W2.2 final.
- Guardrails: plateau/pure255 = 0; white point |R−B| ≤6; seam 0.0030–0.0047 and
  seams at zoom; sky-mask start 12–22, finish 8–18, skybridge 4–14 (override
  522), first-gap 1.5–25, wallrun 1–15, service report-only; red continuity
  visually continuous + component ≥0.25.
- Perf: headed avg ≥55 on 6/6 poses + service 1 % low ≥55; determinism 6/6
  byte-identical; `validate` green.
- A11y: grain toggle works and does not change the world when off; audit of
  reduced-motion / high-contrast / large-text / color-independent-status closed.
- Docs: W5_TARGETS, IMPLEMENTATION_STATUS, DECISIONS, final captures + manifest
  current.
- **Do-not-claim:** photorealism / reference equivalence (language only); real
  FPS outside the measured headed set; Safari/Firefox gameplay (Safari only the
  route run, Firefox untested); human listening acceptance (W4 listening open);
  "metrics = win" (blind is binding); closing LC/tc if accepted; copying
  reference frames.

## 4. Blind protocol (confirmed)

6 pairs; **same reference anchors** (0824, 0926, 1134, 0904, 0844, 1244) to keep
comparability with W1/W2; **W2.2 final ↔ W5 final side-by-side only in the
guided stage** (regression check before blind), never in the blind set. Order:
guided side-by-side → metrics/guardrails → blind 6 pairs → G5 verdict.
