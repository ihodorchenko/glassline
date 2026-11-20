# Reference project audit — `project/glassline` (saltline-fable-5.2)

**Date:** 2026-11-17  
**Audited source:** `/Users/igorhodorchenko/Project/saltline-fable-5.2`, branch `project/glassline`, commit `ed9342efcb3f96f5f2afad19202933562239ec86` (2026-11-16)  
**Method:** branch archive + isolated build/test run, static inspection, browser runtime probe, comparison with this repository (`/Users/igorhodorchenko/Project/glassline`).

This document is an audit, not a merge plan approval. No files in the Saltline
repository were modified.

---

## 1. Executive verdict

`project/glassline` is a **second, much more visually mature Glassline implementation**,
not merely a renderer reference. It is a complete playable parkour vertical slice
on a custom JS engine with:

- HDR post-processing, procedural PBR materials, an atmospheric sky, a dense
  procedural city, a 219 m multi-level tutorial route, a first-person body, and a
  substantial procedural audio mix.
- Measured visual metrics in the same acceptance bands as the reference video
  (13/13 after the visual-gap tiers and content passes).
- A passing build and test suite (168 Vitest tests in 33 files; 30 Playwright E2E
  tests, verified locally on 2026-11-17).

However, it is **not a drop-in replacement** for this repository:

- It has no Training mode, no ranked speedrun validation/medals/records, no
  achievements, statistics, long-term progression, IndexedDB save system,
  localization, gamepad support, or the accessibility/UI layers present here.
- Its gameplay/physics is a custom AABB engine, not the Rapier/TypeScript
  architecture used by this project.
- Its renderer, level builder, and player/viewmodel stack are tightly coupled to
  its own game context.
- Its engine modules were extracted from the original Saltline artifact, whose
  rights are explicitly **not** covered by the fork's MIT license.

**Recommendation:** do not merge the two projects wholesale. Keep the current
Glassline game/systems as the source of truth and treat `project/glassline` as the
visual target and a source of **MIT-authored Glassline content/design**. Close the
visual gap in phases, starting with an independent HDR renderer/post pipeline and
lighting/sky/material foundation. A wholesale branch-based rebuild is a valid
alternative only if visual fidelity outranks the existing game systems and the
engine licensing question is resolved.

---

## 2. Evidence collected

### 2.1 Build and automated tests

Run from a clean archive of the branch with a writable dependency layout:

| Check | Result |
|---|---|
| `npm test` | **168 tests passed**, 33 files |
| `npm run build` | **PASS** — Vite single-file, `dist/index.html` ≈ **949.6 kB** |
| `PLAYWRIGHT_CHANNEL=msedge npx playwright test` | **30 tests passed** (2.2 min) |

The branch's own `docs/GLASSLINE_AUDIT.md` records a previous PASS for code/asset
originality and QA at an earlier commit. Its `docs/VISUAL_GAP.md` records the
measured visual work and tier history.

### 2.2 Runtime probe

Headless Edge, `?show=glassline-tutorial&q=high&autostart=1&shot=1`, 1600×900:

```json
{
  "ready": true,
  "fatal": null,
  "errors": [],
  "quality": "high",
  "calls": 294,
  "triangles": 85531,
  "geometries": 126,
  "textures": 71,
  "programs": 65,
  "resolution": [1751, 846],
  "advancedPipeline": true,
  "softShadows": true,
  "fps": 60
}
```

The screenshot at the start viewpoint shows the intended visual language: bright
ivory roofs, a saturated blue sky with cumulus, dark glass/metal facade bays,
close canyon verticals, red route accents, and first-person arms. The captured
frame also showed the tutorial's `Stuck? Press R` hint because the capture path
autostarts without input; this is shell state, not a render failure.

### 2.3 Measured visual result (branch documentation)

After the visual-gap tiers and the owner content pass, the branch records 13/13
acceptance metrics in band against the reference frame set:

| Metric | Reference | Branch final |
|---|---:|---:|
| luma mean | 0.589 | 0.560 |
| luma std | 0.272 | 0.253 |
| luma p25 | 0.370 | 0.374 |
| luma p95 | 0.979 | 0.951 |
| near-white | 27.3 % | 12.36 % |
| deep shadow | 3.0 % | 4.18 % |
| saturation | 0.359 | 0.323 |
| local contrast | 0.0713 | 0.0635 |
| edge energy | 0.0341 | 0.0272 |
| sky-blue area | 53.1 % | 41.8 % |
| top-third contrast | 0.0585 | 0.0592 |
| split-tone dark R−B | −48.6 | −42.0 |
| red accent | 4.2 % | 2.21 % |

The remaining known content limitation is the amount of near-white surface in
frame (12.36 % vs 27.3 %), attributed to the route/canyon composition rather than
the grade.

---

## 3. Architecture inventory

Branch source size: ~11.5k non-test JS lines (~728 kB), plus the Three.js
dependency. Main areas:

| Area | Modules | What they do |
|---|---|---|
| Engine | `src/engine/render/index.js` (622 lines), `engine/core`, `engine/physics` | HDR renderer + post chain, event/time/rng, custom AABB physics and nav grid |
| Level | `src/levels/build.js` (1403), `city.js` (1074), `textures.js` (1054), `tutorial.js` (415), `sky.js` (214), `reflections.js`, `lighting.js`, `atmosphere.js`, `contact.js`, `floor.js`, `guides.js`, `signs.js` | data-driven 219 m three-act route, procedural city/props, texture/normal/roughness generation, sky/reflection/lighting, route guidance |
| Game | `src/game/glassline/player.js` (1062), `tutorial.js` (1003), `audio.js` (1782), `menu.js`, `viewmodel.js`, `characters.js`, movement modules | custom controller and all parkour moves, tutorial flow, UI shell, procedural audio, first-person body |
| UI | `src/ui/styles.css`, tutorial/menu modules | custom title/pause/complete/settings/controls and HUD |

The branch uses JS + JSDoc, not TypeScript. It is a standalone Vite single-file
build. The custom engine is deliberately minimal; GLASSLINE game code lives
outside `src/engine`.

### 3.1 Renderer pipeline

`installRender(game, deps)` creates:

- an HDR (RGBA half-float) scene target with MSAA and a depth texture;
- custom soft shadows (PCSS-style chunk patch with fallback), a sky dome shader,
  PMREM sky environment;
- a full-screen post chain: depth copy → depth half → AO → AO blur → volumetrics →
  volumetric blur → composite → motion blur → 6-level bloom → streak →
  adaptation → dirt → grade (ACES/AgX mix, split tone, S-curve, CA, vignette,
  grain) → FXAA/sharpen/dither;
- quality profiles (`low/medium/high/ultra`) with dynamic resolution and a
  fallback path if a pass/shader fails.

This is the dominant visual difference from the current project. As of the
audit date (2026-11-17) the current Glassline rendered directly with a plain
`WebGLRenderer`, so it had no HDR, post-processing, AO, bloom, volumetrics,
grade, or advanced AA. (This changed after the audit: the release candidate
ships an HDR post chain with GTAO/bloom/ACES — see `RELEASE_NOTES.md`.)

### 3.2 Materials and content

- Runtime Canvas-generated albedo + height/normal + roughness atlases for
  concrete, sides/facades, glass, metal, route paint and signs.
- Glass/metal environment probes from actual scene captures; road/roof surfaces
  use world-space UVs and shared material pools.
- 26 platform slabs in the original blockout expanded by the content pass into a
  multi-level 219 m route with a courtyard, covered service block, summit, drops,
  high/low branch, wall-run gaps, wall climbs, slide ducts and balance sections.
- Generated near-facade canyon, instanced city rings, window bands, balconies,
  rooftop service kits, solar arrays, fencing, plant rooms, cranes/helicopter,
  and a large prop vocabulary.
- First-person hands/arms/legs on a dedicated layer-1 camera; head bob and move
  poses.

### 3.3 Audio

A 1,782-line procedural Web Audio module: layered wind/city/cloth ambience,
four-chord synth score, surface-aware footsteps and landings, slide/wall-run
loops, convolution-like reverb send, ducking, compressor/limiter, and offline
render tooling. No samples or third-party tracks.

### 3.4 Game systems present in the branch

- Single tutorial route with 21 checkpoints, respawn, finish, timer/splits/best.
- Pause/complete/start-over menu, sensitivity, audio on/off/volume, rebindable
  keys, conflict rejection and reset.
- localStorage progress (`checkpoint`, `respawns`, `finished`, started) and best
  time.
- Editor/inspector mode, performance overlay/benchmark, golden captures.
- No Training exercise system, ranked speedrun validation/medals/records,
  achievement/statistics/progression systems, IndexedDB save schema, localization,
  gamepad, or the full accessibility/screen stack from this repository.

---

## 4. Direct comparison with this repository

| Area | Current Glassline (this repo) | `project/glassline` |
|---|---|---|
| Language/architecture | TypeScript, Rapier, Level Runtime, fixed 60 Hz, modular domain systems | JS/JSDoc, custom AABB physics, custom renderer/scene, one showcase game |
| Rendering | Forward Three.js renderer; color/fog/lights (snapshot before the visual reference rounds; the release candidate uses an HDR post chain) | HDR post stack, AO, volumetrics, bloom, motion blur, grade, sky/PMREM, soft shadows |
| Materials | Mostly flat color/emissive; simple decorations | Runtime PBR atlases, normal/roughness, glass/metal, decals/signage |
| Content | Two small authored test arenas; Training/Prologue | 219 m multi-level tutorial, city canyon, many props, inspector |
| Movement | Rapier kinematic; slide/vault/wall-run/wall-jump; gamepad | Custom capsule/AABB; slide/vault/mantle/wall-run/wall-climb/roll/balance; head bob; no gamepad |
| Modes | Training, Prologue, ranked Speedrun, sessions/results | Tutorial vertical slice + mechanic sandbox + editor |
| Long-term systems | Progression, achievements, statistics, tutorial, speedrun records/PB, IndexedDB, Save repositories | localStorage checkpoint/best only |
| UI | Full screens, settings categories, records, results, accessibility | Minimal custom title/pause/complete/settings/controls, keyboard |
| Audio | Procedural cues, simple ambience/footsteps | Full procedural dynamic mix, score, reverb, surface footsteps |
| Tests | 247 unit/integration tests / 34 files (as of 2026-11-17; the frozen release verification is 282 tests / 38 files — `VERIFICATION.md`) + browser acceptance | 168 unit / 33 files + 30 Playwright E2E; golden/perf/audits |
| Build | TS Vite (~5.1 MB JS chunk) | JS Vite single-file (~950 kB) |
| Licensing | Project code | Engine derived from Saltline artifact; fork MIT covers fork changes only |

### 4.1 What the branch does better

- Look: measured 13/13 vs the reference metrics; HDR pipeline and content density
  produce the Mirror's Edge-family image.
- Parkour vocabulary and camera feel: mantle, wallclimb, roll, balance, viewmodel
  body, head bob, route composition.
- Content scale and art direction: city canyon, props, act structure, inspector.
- Audio design depth.
- Performance headroom evidence (8.36 ms average in a documented M1 Pro peak run;
  ~429 calls / 77.6k triangles at high after content pass).

### 4.2 What this repository does better

- Real game systems and release scope: Training, ranked Prologue validation and
  medals, local records/PB, progression, achievements, statistics, tutorial
  persistence, Save System versioning and recovery.
- Rapier-based player, Level Runtime ownership, extensive automated coverage and
  Phases 0–8 documentation.
- Localization, gamepad, accessibility settings, full menu/records/settings UI.
- TypeScript architecture and a cleaner ownership boundary for long-term data.

---

## 5. Portability findings

### 5.1 Renderer

The renderer is the highest-value and most self-contained transfer, but it still
expects a game context (`quality`, `sky`, `skyColors`, `player`), a custom camera
and view camera, and the branch's render loop (`render.frame(dt)`). Adapting it to
this repository means replacing or wrapping `Renderer`/`RenderScene`, syncing our
camera each fixed frame, handling resize/quality tiers, and integrating its
shadow/sky/material contracts. It is a substantial but bounded rendering project.

### 5.2 Level/content

`buildLevel()` is authored against the branch's `game.physics` AABB API and scene;
it is not a `LevelDefinition` consumer. Porting its content into this project
requires either:

- a conversion layer that emits Three meshes/decorations from the branch builders
  and builds Rapier colliders separately, or
- a new level-content representation (props, city, detailed geometry) in this
  repository.

The city/route cannot be copied as data into the current small arenas without a
content-authoring effort; visual quality depends heavily on that content density.

### 5.3 Player/viewmodel/audio

- Viewmodel is tied to the branch renderer's layer-1 view camera and its player
  state; our camera system would need a view-model pass/layer.
- Audio is a standalone procedural factory and is the most directly reusable
  concept; adapting it to our AudioManager/Settings is feasible.
- Merge UI/menu is not reusable; our UIManager should stay.

### 5.4 Systems

The branch has no equivalent of our progression/achievement/statistics/speedrun
record/save layers. Moving our systems onto the branch would mean porting TS
domain logic into its JS/JSDoc codebase, replacing localStorage with IndexedDB,
and adapting our UI/screens — essentially a second large project, not a merge.

---

## 6. Licensing and provenance

`NOTICE.md` in the reference repository says:

- The MIT license in that fork applies to **original fork contributions** (Phase 1
  refactor, module boundaries, build tooling, docs, etc.).
- It does **not** grant rights to the original Saltline game material. The engine
  modules used by GLASSLINE were extracted from that original artifact.
- GLASSLINE-specific source/level/assets authored in the branch are described as
  original MIT work, but that does not automatically relicense the extracted
  engine code.

Therefore:

- Copying **engine renderer/physics/audio code wholesale** into this repository
  is a licensing risk without permission from the original Saltline author.
- Copying GLASSLINE-authored level/content/design code may be acceptable under
  the fork's MIT scope, but should preserve `NOTICE`/attribution and be reviewed
  by the owner.
- Reimplementing the techniques independently (or using MIT three.js addons) is
  the safer path for this repository.

---

## 7. Options and recommendation

### Option A — Keep this repository, port the presentation stack in phases

**Best for:** keeping the completed game systems, tests, save architecture and
release documentation.

Phases:

1. **Look foundation:** independent HDR renderer/post pipeline, fixed exposure,
   key/fill lighting, sky shader, soft shadows, quality tiers. Target luma mean
   0.48–0.62, saturation ≥ 0.22, sky-blue area > 35 %.
2. **Materials and surface detail:** procedural albedo/normal/roughness atlases,
   world-space UVs, material pooling, route paint, edge/coping geometry.
3. **Content language:** denser route/canyon, city facades, props, service kit,
   route guidance; convert/authors content for our Level Runtime/Rapier.
4. **Body and motion:** viewmodel hands/legs on a dedicated layer, head bob, move
   poses, camera feedback.
5. **Audio:** adapt the procedural ambience/music/surface design to our audio
   manager and settings.

Risks: long visual catch-up; renderer/content integration is the main unknown.
This path preserves product scope and licensing posture.

### Option B — Use `project/glassline` as the base, port our game systems

**Best for:** reaching the visual target fastest and accepting a product reset.

Work: port/reimplement Training, ranked Speedrun validation/records, progression,
achievements, statistics, tutorial persistence, IndexedDB save layer, localization,
gamepad, accessibility and our UI; reconcile the custom physics/movement with our
systems; decide TS vs JS/JSDoc; re-establish release docs/QA.

Risks: large systems migration, loss of existing architecture/tests, custom
physics/Level Runtime replacement, and the engine licensing question. It is a new
product base, not a merge.

### Recommendation

**Start with Option A, Phase 1 only**, as a bounded renderer/light/sky spike. It
answers the key question — can this repository's architecture reach the
reference-family look with an independent HDR pipeline? — without discarding the
game systems. Use the branch as the measured target and source of MIT-authored
content/design; do not copy its extracted engine code without permission.

If the Phase 1 spike reaches the target bands and content work remains the only
gap, continue Option A. If it cannot reach the look within the budget, revisit
Option B with an explicit decision on the engine license and feature tradeoff.

---

## 8. Open decisions for the owner

1. Is visual fidelity or preserving the current game systems the higher priority?
2. May the extracted Saltline engine code be reused, or should the renderer be
   reimplemented independently?
3. Is the target "reference-family look" (measured bands) or a specific scene
   composition from the branch?
4. Do we keep the current ~220 m tutorial/prologue content, or adopt the
   branch's 219 m multi-level route?
5. Is the branch's JS/JSDoc stack acceptable for the game code if Option B is
   chosen, or must the project remain TypeScript?

Until these are answered, no source migration should start.
