# ART_BRIEF — Prologue look language and W0 shot cards

**Author:** art director (Qwen4 Max, `qwen-token-plan/qwen4-max`), session 2026-11-19.
**Recorded by:** lead (the art director does not edit files).
**Contract:** fidelity target is the reference *language* (palette, composition,
lighting, materials), not a copy of specific frames. Scope: Prologue only.
**Sources:** `ref/reference/prolog-kit/study/05-prologue-roofs/*.jpg` (20 frames),
`05-prologue-roofs-sheet.jpg`, `03-movement-training-sheet.jpg`, `study/index.csv`;
current build `docs/evidence/visual/round-93/{start,stair-rails}.jpg` + `metrics.json`.
Palette sampled with `sample_colors`; composition judged by direct viewing.

> Status: brief accepted by lead as the W0/W1 art direction input. Band policy
> lives in [`METRIC_SPEC.md`](METRIC_SPEC.md) and [`DECISIONS.md`](DECISIONS.md).

---

## 1. Shot cards

**`start-roof`** — beat 1: open white rooftop, city canyon on one side, large sky.
Reference: `0824`, `0834`, `0916-prologue-roofs.jpg`, `07-props-materials/0820`.
Camera 1.65 m, hFOV 78–82°, gaze along the roof; facade only on the left, canyon
and sky on the right; horizon at 45–55 % of frame height, sky 35–50 %.
FG: white deck with seams + vent cluster. MG: one continuous red element
(stair/ramp) leading inward. BG: hazy canyon.

**`first-gap`** — beat 2: acceleration run into a readable first jump.
Reference: `0926`, `1114-prologue-roofs.jpg`, `03-movement-training/0256`, `0306`.
Camera 1.55 m on the run-up, −5…−10° tilt across the gap; horizon 55–65 %, sky
25–40 %. FG: deck edge + red hazard line. MG: 2.4–5.0 m gap with a sunlit
landing edge. BG: city below, not a black hole.

**`wallrun-corridor`** — beat 3: wall-run along glass.
Reference: `0926`, `1134`, `1304-prologue-roofs.jpg`, `03-movement-training/0346`.
Camera 1.5 m, roll 8–15°, gaze 30–45° to the wall; glass 50–70 % of frame, sky
strip 10–25 %. FG: spandrel band. MG: mullion rhythm receding to the vanishing
point. BG: exit ledge + red marker.

**`service-block`** — beat 4: covered service block, slide under a duct.
Reference: `0904`, `1004`, `1144-prologue-roofs.jpg`, `06-prologue-interiors/1010`.
Camera 1.3 m (slide 0.9 m), gaze along the lanes; sky 0–15 %. FG: duct edge
(0.95–1.15 m clearance). MG: red door + pipe run. BG: bright exit slit;
deep-shadow ≤ 6 %.

**`skybridge`** — beat 6: crossing with a long sightline to the finish.
Reference: `0844`, `1104`, `1114-prologue-roofs.jpg`.
Camera 1.6 m on a 3.4 m deck, gaze along the span; horizon 45–55 %, sky 40–55 %.
FG: rails + deck seams. MG: span + suspended load. BG: finish silhouette +
red marker; city below on both sides.

**`finish-roof`** — beat 7: clean silhouette and a single red marker.
Reference: `1244`, `1154`, `1204-prologue-roofs.jpg`.
Camera 1.6 m, +3…+8° tilt to the gate; sky 45–60 %. FG: clean deck.
MG: gate/terminal + the only red marker. BG: hazy skyline; flare only when
looking within 20° of the sun.

### Blind-review PASS checklists

| Shot | PASS means |
|---|---|
| `start-roof` | 1) facade mass on one side, sky on the other ≥ 30 %; 2) slab seams and bump readable at 100 % zoom; 3) at least one continuous red element leads the eye; 4) prop shadows on deck cool, not black; 5) sky is a gradient with cumulus, not flat fill |
| `first-gap` | 1) far landing edge lit and readable in the same frame; 2) depth/city visible in the gap, not void; 3) red edge marks on both sides; 4) horizon tilt ≤ 2°; 5) gap reads ≤ 5 m by parapet/prop scale |
| `wallrun-corridor` | 1) mullion grid converges in perspective; 2) sky-reflection gradient on glass, not flat color; 3) 8–15° roll is readable; 4) exit ledge visible; 5) red ≤ 5 % of frame |
| `service-block` | 1) duct clearance reads as 0.95–1.15 m relative to camera; 2) one red door landmark; 3) pipe shadows on the wall; 4) bright exit slit in BG; 5) deep-shadow share ≤ 6 % |
| `skybridge` | 1) rail vanishing point lands on the finish gate; 2) both rails with glass inserts; 3) city below readable; 4) distant red marker ≤ 2 % of frame; 5) horizon ± 2° |
| `finish-roof` | 1) the only red marker is the dominant accent; 2) clean parapet silhouette against sky; 3) no clutter within 2 m of the gate; 4) near-white 15–28 % with seams; 5) flare only at the sun |

---

## 2. Look language

| Anchor | Sampled frame hex | Albedo/recipe anchor | Area share |
|---|---|---|---|
| Sky | zenith `#2050D8` (1304), mid `#68A8C8` (0844), horizon `#E8F0F8` | gradient + cumulus, tops `#F8F8F8`, bases `#B8C8D8` | 35–50 % (mean ≈ 43) |
| White roof / paint | `#F8F8F8` (19–27 % of frame: 0824, 1114) | `#F1F1ED` | 30–40 % |
| Concrete/steel + shadows on white | shadow `#405068`–`#607090` (0824) | `#C7C9C7` / `#747A7D` | 10–15 % |
| Dark glass | `#101820`–`#283038` (1114), mullions `#D8DDE2` | `#1A2530` | 8–15 % |
| Red accent | `#E80018` (1224) | `#D52E36` | 2–5 % |
| Orange billboard (secondary) | ≈`#F08010` (0824) | `#F08A2A` | ≤ 2 % |

**Light:** sun elevation 55–65°, azimuth 30–45° side/back from the view axis
(shadows 0.5–0.8× object height: 0824, 1224); soft but readable penumbra
(2–4 px edge at 1600×900 for a 1 m object at 5 m); cool blue shadows
(≈`#5A6A85`), shadow luma 0.25–0.40, never black; high-key exposure with a
shoulder: p95 0.93–0.98 without a clip plateau, seams must survive.

| Material | Albedo | Rough | Metal | Detail |
|---|---|---|---|---|
| Roof paint | `#F1F1ED` | 0.55–0.70 ±0.1 | 0 | seams 0.6–1.2 m `#D8D8D4`, bump 0.26, low-frequency stains |
| Curtain glass | `#1A2530` | 0.10 | 0.6 | envMapIntensity 1.3 (sky gradient), spandrel `#2A3A44`, grid 1.5×3 m |
| Steel | `#747A7D` / dark `#33393D` | 0.35–0.5 / 0.5 | 0.85 / 0.8 | directional brush; grating `#2A2F33` with worn white edges |
| Red paint | `#D52E36` | 0.40–0.50 | 0–0.1 | wear mask ≤ 15 % locally, not a global fade |
| Concrete | `#C7C9C7` | 0.85–0.95 | 0 | bump 0.34, stains `#A8ADAE`, formwork lines |

**Contrast structure:** what must stay light — deck, parapets, white walls,
cloud tops (p95 ≥ 0.93); what must stay dark — glass masses, underside of
duct/bridge, grating holes, shadowed window bands (deep-shadow ≤ 6 %, split-tone
dark R−B −55…−40). Red must be saturated at mid luma. Mid-grey mush is banned.

---

## 3. Top-3 highest-leverage fixes

1. **Colour script.** White balance to neutral (whites currently `#F8F0E8` →
   `#F8F8F8`), sky gradient `#2050D8`→`#E8F0F8` (currently pale fill), route red
   without fade (route dashes currently `#E8B8A8` → `#E01020`).
   Signal: split-tone dark R−B −55…−40 (now −23.5), saturation 0.30–0.38, red
   accent share 2–5 % on route elements, sky-blue area 35–55 % by sky mask.
2. **Glass.** Dark reflective masses (`#1A2530`, rough 0.10, metal 0.6, env 1.3)
   instead of flat teal `#005888`; 8–15 % of frame.
   Signal: deep-shadow share 2–4 % (now 1.05), luma std ≥ 0.22, split in band;
   blind check: reflection gradient on glass.
3. **Sun key.** Readable cool prop shadows on the deck (8–15 % deck coverage),
   elevation 55–65°, penumbra 2–4 px.
   Signal: local contrast ≥ 0.060 and top-third contrast ≥ 0.050 (§2.1; on the
   current script ≥ 0.85× reference: 0.242/0.207), edge energy ≥ 0.028,
   deep-shadow ≤ 6 %.

---

## 4. Top-3 metric-gaming risks and the check that catches each

1. **sky-blue area is measured as blue-dominant pixels in the upper 66 %**
   (`metrics.py`), so our teal glass yields 43.2 % "sky" while visible sky is
   ~12 %. Check: sky mask above the horizon/without geometry + blind "is there a
   gradient sky with clouds".
2. **near-white/p95 via clipping** — flat white without seams. Check: edge
   energy inside the near-white mask ≥ 0.02 + seams at 100 % zoom; blind zoom
   on the deck.
3. **red share gained from banners while the route reads salmon** — metric red
   (r > 1.5 g,b) does not count `#E8B8A8`, so 3 % "PASS" while the route is not
   red. Check: continuous red component ≥ 0.8 % of frame on the route line,
   HSV S ≥ 0.6; blind "does red lead the eye".

---

## 5. Do-not-do

- Copy one frame's composition (`0824`) or make the canyon symmetric — the
  reference is asymmetric.
- Hard-clip/exposure push for near-white (the old hack is banned by the plan).
- Bloom on whites: emissive only, threshold ≥ 1.0, strength ≤ 0.25.
- Flat-teal glass, or black mirror everywhere.
- Warm "paper" grade in the world (paper is UI only).
- Pale flat sky or neon cyan.
- Red confetti / "everything red"; salmon route fade.
- Saturated planter greenery, clutter for edge-energy, heavy vignette/CA/grain,
  motion blur at idle.

---

## 6. Open items handed to the lead

- §2.1 and `metrics.py` disagree in scale and in metric set (`local_contrast`
  0.0713 vs 0.285; `edge` 0.0341 vs 0.0194; `luma` ref 0.589 vs 0.615; `split`
  −48.6 vs −21.8): W0 must recompute bands with one script on an agreed set.
  Until then the operative targets are §2.1 for `split`/`sky`/`red` plus blind
  review. → **Resolved in [`DECISIONS.md`](DECISIONS.md) D-02 (uniform shift),
  reference recomputed in [`METRIC_SPEC.md`](METRIC_SPEC.md).**
- Capture set: only 2 of the 6 ids exist in `round-93`; the W0 series is needed.
  → **W0-B/W0-A deliver the six-shot capture.**
- `metrics.py` has no sky mask and no red component/HSV semantics; W1 should
  add them as anti-gaming guardrails, not as replacements for §2.1.
