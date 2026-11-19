# Reference alignment progress

**Objective:** Bring Glassline to the presentation level of the *Mirror's Edge*
prologue reference — design, graphics, and sound.

**Reference:** `ref/reference/Прохождение Mirror's Edge #1 - Пролог (и обучение)
[dlbJTerGxCM].mp4` plus the extracted prologue study frames in
`ref/reference/prolog-kit/` (local only, git-ignored).

**Method:** deterministic gameplay screenshots, measured image statistics, and
manual review against the prologue rooftop frames. Tooling lives in
[`tools/capture`](../tools/capture/README.md).

---

## Round 1 — presentation foundation (2026-11-19)

### Scope

Replace the flat forward renderer and placeholder arena with an HDR
first-person presentation: sky and atmosphere, PBR materials, a dense rooftop
city, a shaped prologue route, and first-person runner arms. Sound and gameplay
depth are intentionally left for later rounds.

### What changed

**Rendering**

- New HDR post chain in `PostPipeline`: half-float MSAA target, GTAO, bloom,
  filmic ACES tone mapping, split toning, saturation/contrast grade, chromatic
  aberration, vignette, grain, dither, and a photographic highlight clip for
  clipped sunlit whites.
- Procedural sky dome (`SkyDome`): zenith/horizon gradient, sun disc and glow,
  two-scale cumulus with lit tops and shaded bases, and slow cloud drift.
- Sky-derived PMREM environment probe so glass and metal reflect the actual sky.
- Sun (PCF soft shadows), hemisphere, ambient fill, and a cool rim light; level
  environments now drive sky palette, sun angle, sun intensity, and fog.
- Procedural PBR material library (`MaterialLibrary`) with runtime canvas textures
  for roof, concrete, plaster, facade, metal, asphalt, and red paint. Materials
  use world-space triplanar mapping, so box geometry keeps a consistent surface
  scale at any size.
- Decorations are batched into instanced meshes by material/shape/shadow flags.

**Prologue design and content**

- The flat 44 m box arena becomes a 22 m rooftop with low parapets, an open
  skylight, and city visible over every edge.
- A close glazed tower wall runs along the west side with floor slabs, mullions,
  diagonal bracing, an orange billboard, a red maintenance ladder, and a red
  handrail — the reference's asymmetric "roof against a facade" composition.
- Dense surround: near facades with punched/curtain/ribbon window systems,
  rooftop plant, lower roofs, a 54 m skybridge, construction crane, billboards,
  and a 64-building far skyline above a city floor 31 m below.
- Rooftop kit: skylight glazing and rails, solar array, AC clusters, duct and pipe
  runs, stair bulkhead with red door, water tank, antenna, vents, crates, route
  paint, checkpoint chevrons, start/finish gantries, and a lit finish terminal.
- The wall-run corridor, slide duct, vault ledge, steps, and terminal are clad in
  white/metal with red trim instead of flat black boxes.
- Void kill triggers cover all five sections, so leaving the roof always respawns
  at the last checkpoint.

**Player presentation**

- First-person viewmodel: sleeves, forearms, gloved hands, red wrist wraps, and
  fingers attached to the camera.
- Viewmodel responds to idle breathing, run bob and arm swing, airtime, sliding,
  landing compression, and wall-run roll. It is lit by a dedicated camera light
  on layer 1.

**Tooling**

- `tools/capture/capture.mjs`: deterministic capture from CDP (start gameplay,
  teleport, aim, screenshot, scene statistics).
- `tools/capture/metrics.py`: luminance/contrast/colour/accent metrics against the
  reference frame set, with a JSON report.
- Round evidence: [`docs/evidence/visual/round-1`](evidence/visual/round-1/).

### Result

| View | Image |
|---|---|
| Prologue start | ![Prologue start](evidence/visual/round-1/start.jpg) |
| Wall-run corridor | ![Wall-run corridor](evidence/visual/round-1/mid.jpg) |
| Looking back | ![Looking back](evidence/visual/round-1/back.jpg) |

Measured against the 20-frame prologue rooftop reference set
(`docs/evidence/visual/round-1/metrics.json`):

| Metric | Glassline start | Reference mean | Delta | Band |
|---|---:|---:|---:|---|
| luma mean | 0.586 | 0.615 | −0.029 | PASS |
| luma std | 0.265 | 0.295 | −0.030 | PASS |
| p25 luma | 0.331 | 0.371 | −0.040 | PASS |
| p95 luma | 0.895 | 0.981 | −0.086 | WATCH |
| near-white | 3.6 % | 34.5 % | −30.9 | WATCH |
| deep shadow | 1.9 % | 0.7 % | +1.2 | PASS |
| saturation | 0.360 | 0.300 | +0.060 | PASS |
| local contrast | 0.248 | 0.285 | −0.037 | PASS |
| edge energy | 0.027 | 0.019 | +0.007 | PASS |
| sky-blue area | 60.1 % | 43.3 % | +16.8 | WATCH |
| top-third contrast | 0.209 | 0.243 | −0.034 | PASS |
| split-tone dark R−B | −25.5 | −21.8 | −3.7 | PASS |
| red accent | 2.7 % | 2.4 % | +0.3 | PASS |

10/13 metrics are inside tolerance. Sky area runs high because the start frame
is a wide, open rooftop composition; reference sky area ranges from 15 % to
54 % across the set.

The two highlight metrics are the deliberate trade-off for this round. An
earlier grade clipped hard from luma 0.52 and reached 12/13 (near-white 27.7 %,
p95 0.953), but it flattened the roof and facade texture into flat white. The
shipped grade uses a gentler shoulder (0.62 → 0.90, 70 % blend), keeping surface
detail and accepting less clipped white. Closing the remaining highlight gap is
a lighting/content task — stronger sun, brighter albedo and more white surfaces —
not a reason to reintroduce the hard clip.

Runtime on Apple M1 Pro / ANGLE Metal, 1600×900:

- 60 fps (16.6 ms average, 16.8 ms p95) during live gameplay.
- 27 instanced decoration batches, 1,656 instances, ~24k triangles.
- 31 textures, 22 shader programs.

Functional checks:

- `npm run validate` passes: typecheck, Biome, 250 tests in 34 files, production
  build.
- Synthetic input: holding `W` moves the player 6.3 m in 1.8 s; `Space` enters
  `JUMPING` with +5.6 m/s vertical speed and returns to `FALLING`.
- Leaving the roof at x = 12 respawns at the rooftop checkpoint (z = 3).
- No console errors or exceptions during load, gameplay, jump, and respawn.

### Honest gaps

- **Sound is unchanged.** The release ambience/footstep bed is still the simple
  oscillator mix; there is no reference-grade wind/city bed, music, surface
  footsteps, wall-run/slide layers, or reverb/mix bus.
- **Design is still a straight rooftop corridor.** The prologue has one lane, a
  duct, a wall-run corridor, and a vault; it lacks the reference's leaps between
  rooftops, drops, climbs, ladders, and readable branching.
- **Graphics are stylized, not photoreal.** Facades are box masses with window
  grids; glass lacks local reflections; clouds are soft; billboards have no
  typography; hands are simple low-poly forms. Highlights do not clip as much as
  the reference (near-white 3.6 % vs 34.5 %); closing that needs stronger real
  lighting/content, not a harder grade clip.
- **No motion blur, depth of field, or animated world** (crane, birds, cloth,
  helicopter) yet.
- Training still uses the old 44 m yard and flat skyline dressing.
- Quality tiers and a dynamic-resolution policy are not wired to the new pipeline.

### Next

1. **Sound pass:** layered procedural wind/city ambience, a four-chord score,
   surface-aware footsteps, slide/wall-run/landing layers, reverb and ducking,
   exposed through the existing AudioManager and settings.
2. **Route design pass:** break the straight corridor into rooftop gaps, drops,
   climbs, and a readable red guidance language while preserving checkpoint and
   speedrun contracts.
3. **Graphics polish:** cloud shaping, billboard typography, facade variation,
   contact decals, motion blur, and animated city props.
4. **Training and menu presentation** to match the same language.

## Round log

| Round | Date | Focus | Outcome |
|---|---|---|---|
| 1 | 2026-11-19 | HDR renderer, sky, materials, city, viewmodel | 10/13 reference metrics in band (2 highlight metrics open); 60 fps at 1600×900 |
