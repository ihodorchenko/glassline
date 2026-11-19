# Blind review W0 — six Prologue captures

**Reviewer:** art director (`qwen-token-plan/qwen4-max`), read-only role.
**Date:** 2026-11-19.
**Blinding:** the six frames were copied to `/tmp/blind-w0/frame-A…F.png` under
randomized names (`frame-A`=wallrun-corridor, `B`=finish-roof, `C`=start-roof,
`D`=first-gap, `E`=skybridge, `F`=service-block); no labels, no commentary, no
shot ids were given. Reference anchors are those of
[`ART_BRIEF.md`](ART_BRIEF.md) (sampled from the 20 prologue-roof frames).
**Question per frame:** *"can this frame stand in the reference prologue without
breaking its language?"*

**Result: 0 / 6 PASS** (the plan's W1 gate is 4/6). Beats were recognised 6/6
without labels — route readability is there, the image language is not.
Systemic defects, in leverage order: (1) colour script — warm whites
`#F0E8E0`, pale sky without `#2050D8`, salmon/terracotta instead of `#E80018`;
(2) glass/plastic — flat `#005888`/`#006088`/`#003050` panels with no reflection
or dark masses; (3) light key — shadows almost absent, interior flat. Point
defects: emissive glow signage/edges/windows, black void panels, swirl-bump
instead of seams, saturated green planters, gradient "red" objects.

| Frame | Recognised beat | Verdict | 3 deviations | 3 fixes |
|---|---|---|---|---|
| A | wallrun-corridor | FAIL | flat teal glass `#005888` (MG left), terracotta `#C86850` bollards + black void panel (FG/MG), pale sky ~8 %, warm deck `#F0E8E0`, weak shadows (BG) | glass albedo `#1A2530` rough 0.10 metal 0.6 env 1.3; continuous red `#D52E36` instead of bollards, void panel → grating `#33393D`; neutral WB, sky strip 15–25 % with `#2050D8` zenith, sun 55–65°, shadows luma 0.25–0.40 |
| B | finish-roof | FAIL | gradient monolith `#B00000→#600000` (MG right), empty shadowless deck + salmon line (FG), pale sky, black cube, glow banner (BG) | monolith `#D52E36`, emissive 0; portal shadow on deck + continuous red line 0.3 m; sky gradient, suspended load with cables, banner emissive ≤ 0.15 |
| C | start-roof | FAIL | saturated green planters `#387800` (FG left), flat glass + emissive roof edges (left/right), symmetry + overhead bridge as ceiling, sky ~10 % | greenery muted `#4A5A40` ≤ 1 % or removed; yaw 25–35° aside, sky 35–50 %, dark glass, emissive 0; uniform red `#D52E36` |
| D | first-gap | FAIL | monolithic grey-blue stair `#708088` without structure (MG), sky ~5 % and pale towers (BG), flat void, floating tab, black hole panel (FG) | white concrete `#C7C9C7` + red stringers, open risers; pitch +5–8°, sky 25–40 %; dress the lower roof, hazard plate 0.3×0.6 m on the edge |
| E | skybridge | FAIL | solid teal parapets `#006088`, no depth (FG/MG), black void strip + glow sign/lamps (MG), sky ~12 %, emissive window cells (BG) | glass rails 1.3 m + posts every 2 m; fascia `#F1F1ED` + red stripe 0.1 m, emissive ≤ 0.15; sky 40–55 %, rail shadows on deck |
| F | service-block | FAIL | navy ceiling `#003050` (~35 % of frame), salmon route stripe `#E08870` + black seam + clipped exit (FG/MG), flat light, symmetry (whole frame) | ceiling `#A8ADAE`/`#747A7D` + pipes; stripe `#D52E36` 0.3 m, seam `#D8D8D4`, p95 ≤ 0.98; cold interior shadow 0.25–0.40 against bright exit ≥ 3:1, yaw 15–25° |

Consequences recorded in [`DECISIONS.md`](DECISIONS.md) D-03: the binding look
gate is this blind review, metrics are the guardrail; the W0 baseline is
expected to fail the 4/6 gate and exists to make W1 measurable.
