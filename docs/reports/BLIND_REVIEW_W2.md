# Blind review W2 — six unlabeled pairs

**Reviewer:** art director (`qwen-token-plan/qwen4-max`), read-only role.
**Date:** 2026-11-20.
**Blinding:** six pairs in `/tmp/blind-w2b/` — in every pair one frame is ours
(final W2.1 build, FOV 50, deterministic capture, new poses) and one is a
prologue reference frame resized to 1600×900; order randomized, no labels or
commentary.

**Result: 6 / 6 PASS.** No pair was indistinguishable (the reference carries
watermarks/hands/motion blur/subtitles; ours is a clean procedural frame), and
no hack was read at 100 % zoom.

| Pair | Beat | Verdict | Main deviations | Fixes (owner) |
|---|---|---|---|---|
| P1 | start-roof | **PASS** | BG cut-tower grids sparse/thin vs dense punched windows; deck mid-scale empty between props (LC low); gantry beam reads as a thin floating strip | denser grids + props (content W2.2); mid-deck prop clusters (content W2.2); support/cables for the beam (content W2.2) |
| P2 | first-gap | **PASS** | lower-roof underside still pale/sparsely dressed; central BG slab grid sparse; sky is a cloudy strip (blue-mask 1.9), low chroma | props/coping on the lower roof (content W2.2); denser grids (content W2.2); zenith/cloud (look W2.2) |
| P3 | wallrun-corridor | **PASS** | faint swirl on the FG parapet; louvre grille reads as a dark block; narrow sky strip (pose) | straight tile (materials W2.2); recess/lighten grille (content W2.2); pose W2.2+ |
| P4 | service-block | **PASS** | red strip/dashes carry mirror-like specular glints; faint swirl on the floor; pale background tower with sparse grid | red roughness 0.45→0.6 (materials W2.2); straight tile (materials W2.2); grids (content W2.2). Slide clearance ~0.95 m and red soffit frame read correctly ✓ |
| P5 | skybridge | **PASS** | rail glass milky/pale vs the darker transparent glass of the reference; deck shadows weak (~6–8 %); cloudy sky (blue-mask 5.5) | rail tint #1a2530 / opacity 0.35 (materials W2.2); azimuth/shadow coverage (look W2.2); zenith (look W2.2). City below through the glass now reads as structure (parapet/coping/riser/plant) ✓ |
| P6 | finish-roof | **PASS** | faint swirl on the parapet; weak prop shadows; thin BG grids on cut slabs | straight tile (materials W2.2); azimuth (look W2.2); denser grids (content W2.2) |

**Canyon/rooftop gate (G2): closed.** start-roof, first-gap, skybridge and
finish-roof each satisfy depth, continuous-red and BG-detail, plus 5 optional
criteria; skybridge depth through the transparent rails is confirmed.

**Residual → W2.2 (non-blocking):** look chroma/zenith, prop-shadow coverage
8–15 %, mid-scale local contrast; materials straight tile on remaining surfaces,
red roughness, rail tint/opacity; content denser BG grids, mid-deck props,
first-gap lower-roof dressing, gantry support, wallrun grille; W5 real-window
perf.
