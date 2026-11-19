# Blind review W1 — six unlabeled pairs

**Reviewer:** art director (`qwen-token-plan/qwen4-max`), read-only role.
**Date:** 2026-11-19.
**Blinding:** six pairs in `/tmp/blind-w1/` — in every pair one frame is ours
(current build, FOV 50, deterministic capture) and one is a prologue reference
frame resized to 1600×900; order randomized, no labels or commentary given.
Reference anchors: `05-prologue-roofs` frames.

**Result: 4 / 6 PASS** — `start-roof`, `wallrun-corridor`, `service-block`,
`finish-roof`. The two FAILs are content/geometry, not look. The blind threshold
of plan §2.1 is reached, but the W1 gate is not closed: the "no shot may regress
more than one band" rule and the fps ≥ 55 proof are still outstanding
(see [`W1_ITERATION.md`](W1_ITERATION.md) §4–§6).

| Pair | Beat | Verdict (ours) | Deviations | Fixes |
|---|---|---|---|---|
| P1 | start-roof | **PASS** | plain bulkhead box in FG-right; deck shadow coverage <8 %; real sky 14.3 % in the left patch (pose/W2) | panels/vents on bulkhead (content); section sun azimuth + GTAO 0.78 (look); vista is W2 |
| P2 | first-gap | **FAIL** | lower-roof underside reads as pale "mirror" with a floating red tab; stair monolith without nosing; sky ~7 % strip (pose/W2) | parapet cap 0.3 m + attached hazard plate 0.3×0.6 m + contact shadow (content); steps `0xc7c9c7` + red nosing (materials, W2); pose/geometry W2/W3 |
| P3 | wallrun-corridor | **PASS** | swirl-bump on white parapet wall in FG-left; louvre grille still a dark floating block under the rail; sky strip 4.9 % (pose) | bump → straight tile (materials); recess/lighter steel for the grille (content); pose W2 |
| P4 | service-block | **PASS** | swirl-bump on the floor (~40 % of frame); heavy dark metal joint bar across the floor; no duct edge + strict one-point symmetry (sub-beat/pose, W2) | straight tile + stains (materials); joint 0.05 m / `0x9aa0a4` (content/materials); duct + yaw W2 |
| P5 | skybridge | **FAIL** | solid parapets hide the city — the crossing reads as a corridor; real sky 7.8 % in a patch (pose/W2); deck shadows almost absent | glass rails W2; vista W2; section sun azimuth + GTAO (look, now) |
| P6 | finish-roof | **PASS** | gate/monolith shadows barely visible, deck flat; real sky 4.7 % (pose/W2); terminal screen reads as an emissive panel | section sun azimuth + GTAO 0.78 (look); vista W2; screen emissive ≤0.10 (content) |

**Systemic read:** the image language is assembled — neutral white with seams,
saturated continuous red, cobalt sky with cumulus, dark glass with gradient,
matte signage, interior light-shadow. Remaining failures are W2 content
(skybridge glass rails/vista, first-gap stair geometry and underside dressing)
and two small look items (section sun azimuth, slightly stronger contact AO).

**Bounded follow-up (fix round W1.1b):** see [`W1_ITERATION.md`](W1_ITERATION.md)
§6 — cool dark steel joints, neutral (not blue) glass fresnel tint, GTAO 0.78,
interior tint/AO weight, first-gap underside dressing, then a fresh capture +
metrics + full blind set and the isolated fps gate.
